import {
  Tenant,
  Workspace,
  User,
  WorkspaceMember,
  UserSession,
  WorkspaceInvitation,
  EmailVerificationToken,
  PasswordResetToken,
  Channel,
  ChannelMember,
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  MessageEditHistory,
  PinnedMessage,
  SavedMessage,
  OutboxEvent,
  Task,
  TaskComment,
  CalendarEvent,
  Meeting,
  Notification,
  FileItem,
  AuditLog,
  UserRole,
  UserStatus,
  Organization,
  OrganizationDomain,
  OrganizationMember,
  OrganizationSettings,
  CallSession,
  CallParticipant,
  CallHistoryRecord,
  FeaturePermissions,
  DEFAULT_MVP_FEATURES
} from '../src/types';
import { hashPassword, hashToken, normalizeEmail, normalizeUserName } from './security';
import { db as pgDb, pool } from '../src/db/index.ts';
import {
  tenants as pgTenants,
  workspaces as pgWorkspaces,
  workspaceMembers as pgWorkspaceMembers,
  users as pgUsers,
  channels as pgChannels,
  channelMembers as pgChannelMembers,
  conversations as pgConversations,
  conversationMembers as pgConversationMembers,
  messages as pgMessages,
  messageReactions as pgMessageReactions,
  pinnedMessages as pgPinnedMessages,
  savedMessages as pgSavedMessages,
  tasks as pgTasks,
  calendarEvents as pgCalendarEvents,
  meetings as pgMeetings,
  files as pgFiles,
  auditLogs as pgAuditLogs,
  userSessions as pgUserSessions,
  calls as pgCalls,
  callParticipants as pgCallParticipants,
  callHistory as pgCallHistory,
  messageReads as pgMessageReads,
  messageDeliveries as pgMessageDeliveries,
  messageAttachments as pgMessageAttachments
} from '../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { bootstrapDatabase } from './bootstrap.ts';

// Granular Role Permissions Matrix (format: resource.action)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Owner: [
    'workspace.read', 'workspace.update', 'workspace.delete',
    'members.read', 'members.invite', 'members.remove', 'members.update_role',
    'channels.create', 'channels.update', 'channels.archive', 'channels.delete', 'channels.manage_members',
    'messages.read', 'messages.create', 'messages.update', 'messages.delete', 'messages.pin',
    'reactions.add', 'reactions.remove',
    'dms.create', 'dms.read',
    'files.read', 'files.upload', 'files.delete',
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete',
    'calendar.read', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.manage',
    'meetings.create', 'meetings.manage', 'meetings.join',
    'audit.read', 'settings.manage'
  ],
  Admin: [
    'workspace.read', 'workspace.update',
    'members.read', 'members.invite', 'members.remove', 'members.update_role',
    'channels.create', 'channels.update', 'channels.archive', 'channels.manage_members',
    'messages.read', 'messages.create', 'messages.update', 'messages.delete', 'messages.pin',
    'reactions.add', 'reactions.remove',
    'dms.create', 'dms.read',
    'files.read', 'files.upload', 'files.delete',
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete',
    'calendar.read', 'calendar.create', 'calendar.update', 'calendar.delete', 'calendar.manage',
    'meetings.create', 'meetings.manage', 'meetings.join',
    'audit.read', 'settings.manage'
  ],
  Member: [
    'workspace.read',
    'members.read',
    'channels.create', 'channels.update',
    'messages.read', 'messages.create', 'messages.update', 'messages.pin',
    'reactions.add', 'reactions.remove',
    'dms.create', 'dms.read',
    'files.read', 'files.upload',
    'tasks.read', 'tasks.create', 'tasks.update',
    'calendar.read', 'calendar.create', 'calendar.update', 'calendar.manage',
    'meetings.create', 'meetings.join'
  ],
  Guest: [
    'workspace.read',
    'members.read',
    'messages.read', 'messages.create',
    'reactions.add', 'reactions.remove',
    'dms.read',
    'files.read'
  ]
};

class CollabDatabase {
  public tenants: Tenant[] = [];
  public workspaces: Workspace[] = [];
  public users: User[] = [];
  public workspaceMembers: WorkspaceMember[] = [];
  public sessions: UserSession[] = [];
  public verificationTokens: EmailVerificationToken[] = [];
  public passwordResetTokens: PasswordResetToken[] = [];
  public channels: Channel[] = [];
  public channelMembers: ChannelMember[] = [];
  public conversations: Conversation[] = [];
  public conversationMembers: ConversationMember[] = [];
  public messages: Message[] = [];
  public pinnedMessages: PinnedMessage[] = [];
  public savedMessages: SavedMessage[] = [];
  public messageEdits: MessageEditHistory[] = [];
  public outboxEvents: OutboxEvent[] = [];
  public tasks: Task[] = [];
  public taskComments: TaskComment[] = [];
  public calendarEvents: CalendarEvent[] = [];
  public meetings: Meeting[] = [];
  public calls: CallSession[] = [];
  public callParticipants: CallParticipant[] = [];
  public callHistory: CallHistoryRecord[] = [];
  public notifications: Notification[] = [];
  public organizations: Organization[] = [];
  public organizationDomains: OrganizationDomain[] = [];
  public organizationMembers: OrganizationMember[] = [];
  public organizationSettings: OrganizationSettings[] = [];
  public files: FileItem[] = [];
  public auditLogs: AuditLog[] = [];
  public invitations: WorkspaceInvitation[] = [];
  public typingUsers: Map<string, { userId: string; userName: string; channelId?: string; conversationId?: string; timestamp: number }> = new Map();
  public featurePermissions: Map<string, FeaturePermissions> = new Map();

  public isPostgresConnected: boolean = false;

  constructor() {
    // Clean initial state: no hardcoded demo users, channels or messages.
    // Real data is synchronized from PostgreSQL on server startup.
  }

  // Synchronize state with PostgreSQL (Cloud SQL / Local Container)
  public async syncFromPostgres() {
    try {
      console.log('[CollabDatabase] Synchronizing from PostgreSQL...');
      await bootstrapDatabase();

      const [
        loadedTenants,
        loadedWorkspaces,
        loadedWorkspaceMembers,
        loadedUsers,
        loadedChannels,
        loadedChannelMembers,
        loadedConversations,
        loadedConversationMembers,
        loadedMessages,
        loadedReactions,
        loadedTasks,
        loadedCalendar,
        loadedMeetings,
        loadedFiles,
        loadedAudit,
        loadedSessions,
        loadedSaved
      ] = await Promise.all([
        pgDb.select().from(pgTenants),
        pgDb.select().from(pgWorkspaces),
        pgDb.select().from(pgWorkspaceMembers),
        pgDb.select().from(pgUsers),
        pgDb.select().from(pgChannels),
        pgDb.select().from(pgChannelMembers),
        pgDb.select().from(pgConversations),
        pgDb.select().from(pgConversationMembers),
        pgDb.select().from(pgMessages),
        pgDb.select().from(pgMessageReactions),
        pgDb.select().from(pgTasks),
        pgDb.select().from(pgCalendarEvents),
        pgDb.select().from(pgMeetings),
        pgDb.select().from(pgFiles),
        pgDb.select().from(pgAuditLogs),
        pgDb.select().from(pgUserSessions),
        pgDb.select().from(pgSavedMessages)
      ]);

      // 1. Tenants
      this.tenants = loadedTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        domain: t.domain || '',
        logoUrl: t.logoUrl || '',
        plan: (t.plan || 'Enterprise') as any,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      }));

      // 2. Workspaces
      this.workspaces = loadedWorkspaces.map(w => ({
        id: w.id,
        tenantId: w.tenantId,
        name: w.name,
        slug: w.slug,
        description: w.description || '',
        logoUrl: w.logoUrl || '',
        ownerId: w.ownerId || '',
        status: (w.status || 'Active') as any,
        timeZone: w.timeZone || 'Europe/Madrid',
        language: w.language || 'es-ES',
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString()
      }));

      // 3. Workspace Members
      this.workspaceMembers = loadedWorkspaceMembers.map(m => ({
        id: m.id,
        workspaceId: m.workspaceId,
        tenantId: m.tenantId,
        userId: m.userId,
        role: (m.role || 'Member') as UserRole,
        status: (m.status || 'Active') as any,
        joinedAt: m.joinedAt.toISOString()
      }));

      // 4. Users
      this.users = loadedUsers.map(u => ({
        id: u.id,
        tenantId: u.tenantId || this.tenants[0]?.id || '',
        email: u.email || '',
        normalizedEmail: u.normalizedEmail || (u.email ? normalizeEmail(u.email) : ''),
        userName: u.userName,
        normalizedUserName: u.normalizedUserName || normalizeUserName(u.userName),
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        displayName: u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.userName,
        passwordHash: u.passwordHash || '',
        role: (u.role || 'Member') as UserRole,
        avatarUrl: u.avatarUrl || '',
        jobTitle: u.jobTitle || '',
        phone: u.phone || '',
        timeZone: u.timeZone || 'Europe/Madrid',
        status: (u.status || 'Offline') as UserStatus,
        customStatus: u.customStatus || '',
        accountStatus: (u.accountStatus || 'Active') as any,
        emailVerified: !!u.emailVerified,
        failedLoginAttempts: u.failedLoginAttempts || 0,
        isActive: !!u.isActive,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : u.updatedAt.toISOString(),
        lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : u.updatedAt.toISOString(),
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString()
      }));

      // 5. Channels
      this.channels = loadedChannels.map(c => ({
        id: c.id,
        tenantId: c.tenantId,
        workspaceId: c.workspaceId,
        name: c.name,
        normalizedName: c.name.toLowerCase(),
        description: c.description || '',
        topic: c.topic || '',
        type: (c.type === 'Private' ? 'private' : 'public') as any,
        isPrivate: c.type === 'Private',
        isArchived: !!c.isArchived,
        isPinned: false,
        isMuted: false,
        createdBy: c.createdBy || '',
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        membersCount: loadedChannelMembers.filter(cm => cm.channelId === c.id).length,
        unreadCount: 0
      }));

      // 6. Channel Members
      this.channelMembers = loadedChannelMembers.map(cm => ({
        id: cm.id,
        channelId: cm.channelId,
        userId: cm.userId,
        role: (cm.role || 'Member') as any,
        joinedAt: cm.joinedAt.toISOString()
      }));

      // 7. Conversations
      this.conversations = loadedConversations.map(conv => {
        const members = loadedConversationMembers.filter(cm => cm.conversationId === conv.id).map(cm => cm.userId);
        return {
          id: conv.id,
          tenantId: conv.tenantId,
          workspaceId: conv.workspaceId,
          isGroup: conv.type === 'Group',
          name: conv.name || undefined,
          memberIds: members,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
          unreadCount: 0
        };
      });

      this.conversationMembers = loadedConversationMembers.map(cm => ({
        id: cm.id,
        conversationId: cm.conversationId,
        userId: cm.userId,
        joinedAt: cm.joinedAt.toISOString()
      }));

      // 8. Messages & Reactions
      const reactionsByMessage = new Map<string, MessageReaction[]>();
      for (const rx of loadedReactions) {
        const user = this.users.find(u => u.id === rx.userId);
        const list = reactionsByMessage.get(rx.messageId) || [];
        list.push({
          id: rx.id,
          messageId: rx.messageId,
          userId: rx.userId,
          userName: user ? user.displayName : 'Usuario',
          emoji: rx.emoji,
          createdAt: rx.createdAt.toISOString()
        });
        reactionsByMessage.set(rx.messageId, list);
      }

      this.messages = loadedMessages.map(m => {
        const sender = this.users.find(u => u.id === m.userId);
        return {
          id: m.id,
          tenantId: m.tenantId,
          channelId: m.channelId || undefined,
          conversationId: m.conversationId || undefined,
          parentMessageId: m.parentMessageId || undefined,
          threadRootMessageId: m.parentMessageId || undefined,
          senderId: m.userId,
          senderName: sender ? sender.displayName : 'Usuario',
          senderAvatar: sender ? sender.avatarUrl : undefined,
          content: m.content,
          messageType: 'text',
          isEdited: !!m.isEdited,
          isDeleted: !!m.deletedAt,
          isPinned: !!m.isPinned,
          reactions: reactionsByMessage.get(m.id) || [],
          attachments: (() => {
            if (!m.attachments) return [];
            try { return JSON.parse(m.attachments); } catch { return []; }
          })(),
          repliesCount: m.replyCount || 0,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString()
        };
      });

      // 9. Tasks
      this.tasks = loadedTasks.map(t => {
        const assignee = this.users.find(u => u.id === t.assigneeId);
        return {
          id: t.id,
          tenantId: t.tenantId,
          workspaceId: t.workspaceId,
          title: t.title,
          description: t.description || '',
          status: (t.status || 'Pending') as any,
          priority: (t.priority || 'Medium') as any,
          assignedTo: t.assigneeId || undefined,
          assignedUserName: assignee ? assignee.displayName : undefined,
          assignedUserAvatar: assignee ? assignee.avatarUrl : undefined,
          createdBy: t.creatorId,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
          commentsCount: 0,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString()
        };
      });

      // 10. Calendar Events
      this.calendarEvents = loadedCalendar.map(c => ({
        id: c.id,
        tenantId: c.tenantId,
        workspaceId: c.workspaceId,
        title: c.title,
        description: c.description || '',
        location: c.location || '',
        startAt: c.startDate,
        endAt: c.endDate,
        allDay: !!c.allDay,
        createdBy: c.creatorId,
        attendees: [],
        createdAt: c.createdAt.toISOString()
      }));

      // 11. Meetings
      this.meetings = loadedMeetings.map(m => ({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        title: m.title,
        hostId: m.hostId,
        isLive: m.status === 'Active',
        meetingCode: m.roomName,
        participants: [],
        createdAt: m.startedAt.toISOString()
      }));

      // 12. Files
      this.files = loadedFiles.map(f => {
        const uploader = this.users.find(u => u.id === f.uploadedBy);
        return {
          id: f.id,
          tenantId: f.tenantId,
          workspaceId: f.workspaceId,
          name: f.fileName,
          size: f.fileSize,
          fileType: f.contentType,
          url: f.url,
          uploadedBy: f.uploadedBy,
          uploaderName: uploader ? uploader.displayName : 'Colaborador',
          createdAt: f.createdAt.toISOString()
        };
      });

      // 13. Audit Logs
      this.auditLogs = loadedAudit.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
        workspaceId: this.workspaces[0]?.id || '',
        userId: a.userId || 'system',
        userName: 'Usuario',
        action: a.action,
        entity: a.resource,
        entityId: a.resourceId || '',
        ipAddress: a.ipAddress || '127.0.0.1',
        userAgent: 'CollabPulse-Web/1.0',
        metadata: a.details ? JSON.parse(a.details) : {},
        createdAt: a.createdAt.toISOString()
      }));

      // 14. Sessions
      this.sessions = loadedSessions.map(s => ({
        id: s.id,
        userId: s.userId,
        tenantId: s.tenantId,
        workspaceId: s.workspaceId || '',
        refreshTokenHash: s.refreshToken,
        deviceName: s.deviceName || 'Web Browser',
        deviceType: 'desktop',
        browser: s.userAgent || 'Chrome',
        os: 'Windows',
        ipAddress: s.ipAddress || '127.0.0.1',
        userAgent: s.userAgent || 'CollabPulse',
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastActiveAt.toISOString(),
        expiresAt: s.expiresAt.toISOString()
      }));

      // 15. Saved Messages
      this.savedMessages = loadedSaved.map(sm => ({
        id: sm.id,
        messageId: sm.messageId,
        userId: sm.userId,
        savedAt: sm.savedAt.toISOString(),
        createdAt: sm.savedAt.toISOString()
      }));

      // 16. Task Comments
      try {
        const loadedComments = await pool.query('SELECT * FROM task_comments ORDER BY created_at ASC');
        this.taskComments = loadedComments.rows.map((tc: any) => ({
          id: tc.id,
          taskId: tc.task_id,
          userId: tc.user_id,
          userName: tc.user_name,
          userAvatar: tc.user_avatar || '',
          content: tc.content,
          createdAt: tc.created_at ? new Date(tc.created_at).toISOString() : new Date().toISOString()
        }));
        this.tasks.forEach(t => {
          t.commentsCount = this.taskComments.filter(c => c.taskId === t.id).length;
        });
      } catch (commentErr: any) {
        // Table created on bootstrap
      }

      // 17. Organizations, Domains, Members, and Settings
      try {
        const orgsRes = await pool.query('SELECT * FROM organizations ORDER BY created_at ASC');
        this.organizations = orgsRes.rows.map((o: any) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          type: o.type || 'Enterprise',
          industry: o.industry || 'Technology',
          logoUrl: o.logo_url || '',
          primaryDomain: o.primary_domain || '',
          status: o.status || 'Active',
          settings: typeof o.settings === 'string' ? o.settings : JSON.stringify(o.settings || {}),
          createdAt: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
          updatedAt: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
        }));

        const domsRes = await pool.query('SELECT * FROM organization_domains ORDER BY created_at ASC');
        this.organizationDomains = domsRes.rows.map((d: any) => ({
          id: d.id,
          organizationId: d.organization_id,
          domain: d.domain,
          isPrimary: !!d.is_primary,
          isVerified: !!d.is_verified,
          verificationToken: d.verification_token || undefined,
          createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString()
        }));

        const membersRes = await pool.query('SELECT * FROM organization_members ORDER BY joined_at ASC');
        this.organizationMembers = membersRes.rows.map((m: any) => ({
          id: m.id,
          organizationId: m.organization_id,
          userId: m.user_id,
          role: m.role || 'Member',
          status: m.status || 'Active',
          joinedAt: m.joined_at ? new Date(m.joined_at).toISOString() : new Date().toISOString()
        }));

        const settingsRes = await pool.query('SELECT * FROM organization_settings');
        this.organizationSettings = settingsRes.rows.map((s: any) => ({
          id: s.id,
          organizationId: s.organization_id,
          allowAutoJoin: !!s.allow_auto_join,
          requireApproval: !!s.require_approval,
          allowExternalGuests: !!s.allow_external_guests,
          createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
          updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString()
        }));
      } catch (orgErr: any) {
        console.warn('[CollabDatabase] Organization tables load warning:', orgErr.message);
      }

      // 18. Notifications from PostgreSQL
      try {
        const notifsRes = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500');
        this.notifications = notifsRes.rows.map((n: any) => ({
          id: n.id,
          tenantId: n.tenant_id,
          userId: n.user_id,
          type: n.type as any,
          title: n.title,
          message: n.body,
          linkUrl: n.entity_id ? `/${n.entity_type}/${n.entity_id}` : undefined,
          isRead: !!n.read_at,
          createdAt: n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString()
        }));
      } catch (notifErr: any) {
        console.warn('[CollabDatabase] Notifications table load warning:', notifErr.message);
      }

      // 19. Calls, Call Participants, and Call History from PostgreSQL (Fase 1: Call Engine Core)
      try {
        const callsRes = await pool.query('SELECT * FROM calls ORDER BY created_at DESC LIMIT 500');
        this.calls = callsRes.rows.map((c: any) => ({
          id: c.id,
          tenantId: c.tenant_id,
          workspaceId: c.workspace_id,
          roomId: c.room_id,
          origin: c.origin || 'direct',
          type: c.type || '1:1',
          mediaType: c.media_type || 'video',
          direction: c.direction || 'outbound',
          callerId: c.caller_id,
          calleeId: c.callee_id || undefined,
          conversationId: c.conversation_id || undefined,
          channelId: c.channel_id || undefined,
          state: c.status || 'ended',
          participantIds: [c.caller_id, c.callee_id].filter(Boolean) as string[],
          createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
          startedAt: c.started_at ? new Date(c.started_at).toISOString() : undefined,
          connectedAt: c.connected_at ? new Date(c.connected_at).toISOString() : undefined,
          endedAt: c.ended_at ? new Date(c.ended_at).toISOString() : undefined,
          durationSeconds: c.duration_seconds || 0,
          endReason: c.end_reason || undefined
        }));

        const participantsRes = await pool.query('SELECT * FROM call_participants ORDER BY created_at ASC');
        this.callParticipants = participantsRes.rows.map((p: any) => ({
          id: p.id,
          callId: p.call_id,
          userId: p.user_id,
          role: p.role || 'participant',
          state: p.state || 'invited',
          joinedAt: p.joined_at ? new Date(p.joined_at).toISOString() : undefined,
          leftAt: p.left_at ? new Date(p.left_at).toISOString() : undefined,
          createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString()
        }));

        const historyRes = await pool.query('SELECT * FROM call_history ORDER BY created_at DESC LIMIT 1000');
        this.callHistory = historyRes.rows.map((h: any) => ({
          id: h.id,
          callId: h.call_id,
          eventType: h.event_type,
          userId: h.user_id || undefined,
          metadata: typeof h.metadata === 'string' ? (() => { try { return JSON.parse(h.metadata); } catch { return {}; } })() : h.metadata,
          createdAt: h.created_at ? new Date(h.created_at).toISOString() : new Date().toISOString()
        }));
      } catch (callErr: any) {
        console.warn('[CollabDatabase] Call Engine tables load warning:', callErr.message);
      }

      // 20. Feature Permissions from PostgreSQL
      try {
        const fpRes = await pool.query('SELECT tenant_id, permissions FROM feature_permissions');
        this.featurePermissions.clear();
        for (const row of fpRes.rows) {
          const perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
          this.featurePermissions.set(row.tenant_id, perms);
        }
      } catch (fpErr: any) {
        console.warn('[CollabDatabase] Feature permissions load warning:', fpErr.message);
      }

      this.isPostgresConnected = true;
      console.log(`[CollabDatabase] Synced successfully from PostgreSQL (${this.organizations.length} orgs, ${this.users.length} users, ${this.channels.length} channels, ${this.messages.length} messages, ${this.notifications.length} notifications, ${this.calls.length} calls).`);
    } catch (err) {
      console.error('[CollabDatabase] Failed to sync from PostgreSQL:', err);
    }
  }

  // Feature Permissions & Feature Flags Management
  public getFeaturePermissions(tenantId: string): FeaturePermissions {
    const existing = this.featurePermissions.get(tenantId);
    if (existing) return { ...existing };
    return { ...DEFAULT_MVP_FEATURES };
  }

  public async setFeaturePermissions(
    tenantId: string,
    permissions: Partial<FeaturePermissions>,
    updatedBy?: string
  ): Promise<FeaturePermissions> {
    const current = this.getFeaturePermissions(tenantId);
    const updated: FeaturePermissions = { ...current, ...permissions };
    this.featurePermissions.set(tenantId, updated);

    try {
      await pool.query(`
        INSERT INTO feature_permissions (id, tenant_id, permissions, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (tenant_id) DO UPDATE 
        SET permissions = EXCLUDED.permissions,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW();
      `, [
        `fp-${tenantId}`,
        tenantId,
        JSON.stringify(updated),
        updatedBy || null
      ]);
    } catch (err: any) {
      console.error('[CollabDatabase] Failed to persist feature_permissions to PostgreSQL:', err);
    }

    return updated;
  }

  // Multi-tenant audit helper
  public logAudit(
    tenantId: string,
    userId: string,
    userName: string,
    action: string,
    entity: string,
    entityId: string,
    ip: string = '127.0.0.1',
    metadata?: any,
    workspaceId?: string
  ) {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      workspaceId,
      userId,
      userName,
      action,
      entity,
      entityId,
      ipAddress: ip,
      userAgent: 'CollabPulse-Web/1.0',
      metadata,
      createdAt: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    this.persistAuditLog({
      id: log.id,
      tenantId: log.tenantId,
      userId: log.userId,
      action: log.action,
      resourceType: log.entity,
      resourceId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.metadata,
      createdAt: new Date(log.createdAt)
    });
    return log;
  }

  // Outbox Pattern Implementation for Reliable Realtime Event Delivery
  public enqueueOutbox(eventType: string, payload: any): OutboxEvent {
    const event: OutboxEvent = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0
    };
    this.outboxEvents.push(event);
    return event;
  }

  public processOutbox(handler: (event: OutboxEvent) => boolean | Promise<boolean>) {
    const pending = this.outboxEvents.filter(e => !e.processedAt && e.retryCount < 5);
    for (const evt of pending) {
      try {
        const success = handler(evt);
        if (success) {
          evt.processedAt = new Date().toISOString();
        } else {
          evt.retryCount++;
          evt.error = 'Handler reported delivery failure';
        }
      } catch (err: any) {
        evt.retryCount++;
        evt.error = err?.message || 'Unknown processing error';
      }
    }
  }

  // Mention Parser Helper
  public parseMentions(content: string, tenantId: string): {
    users: User[];
    isChannelMention: boolean;
    isHereMention: boolean;
  } {
    const isChannelMention = /@channel\b/i.test(content);
    const isHereMention = /@here\b/i.test(content);
    const mentionedUsers: User[] = [];

    const tenantUsers = this.users.filter(u => u.tenantId === tenantId && u.accountStatus === 'Active');
    for (const user of tenantUsers) {
      const uName = user.userName.toLowerCase();
      const fName = user.firstName.toLowerCase();
      const lName = user.lastName.toLowerCase();
      const regex = new RegExp(`@(${uName}|${fName}|${lName})\\b`, 'i');
      if (regex.test(content)) {
        mentionedUsers.push(user);
      }
    }

    return {
      users: mentionedUsers,
      isChannelMention,
      isHereMention
    };
  }

  // -------------------------------------------------------------
  // Persistent PostgreSQL Write-Through Operations
  // -------------------------------------------------------------

  public async persistUser(user: User) {
    try {
      await pgDb.insert(pgUsers).values({
        id: user.id,
        tenantId: user.tenantId,
        email: user.email || null,
        normalizedEmail: user.normalizedEmail || null,
        userName: user.userName,
        normalizedUserName: user.normalizedUserName,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        role: user.role,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        phone: user.phone,
        timeZone: user.timeZone,
        status: user.status,
        customStatus: user.customStatus,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        failedLoginAttempts: user.failedLoginAttempts || 0,
        isActive: user.isActive,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistUser error:', error);
    }
  }

  public async persistUserUpdate(id: string, updates: Partial<User>) {
    try {
      const updatePayload: any = { updatedAt: new Date() };
      if (updates.status) updatePayload.status = updates.status;
      if (updates.customStatus !== undefined) updatePayload.customStatus = updates.customStatus;
      if (updates.failedLoginAttempts !== undefined) updatePayload.failedLoginAttempts = updates.failedLoginAttempts;
      if (updates.accountStatus) {
        updatePayload.accountStatus = updates.accountStatus;
        if (updates.accountStatus === 'Deleted') {
          updatePayload.deletedAt = new Date();
          updatePayload.isActive = false;
        }
      }
      if (updates.isActive !== undefined) updatePayload.isActive = updates.isActive;
      if (updates.role) updatePayload.role = updates.role;
      if (updates.passwordHash) updatePayload.passwordHash = updates.passwordHash;
      if (updates.firstName) updatePayload.firstName = updates.firstName;
      if (updates.lastName) updatePayload.lastName = updates.lastName;
      if (updates.displayName) updatePayload.displayName = updates.displayName;
      if (updates.jobTitle !== undefined) updatePayload.jobTitle = updates.jobTitle;
      if (updates.email) updatePayload.email = updates.email;
      if (updates.normalizedEmail) updatePayload.normalizedEmail = updates.normalizedEmail;

      await pgDb.update(pgUsers).set(updatePayload).where(eq(pgUsers.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistUserUpdate error:', error);
    }
  }

  public async persistWorkspaceMemberUpdate(workspaceId: string, userId: string, updates: Partial<WorkspaceMember>) {
    try {
      const payload: any = {};
      if (updates.role) payload.role = updates.role;
      if (updates.status) payload.status = updates.status;
      await pgDb
        .update(pgWorkspaceMembers)
        .set(payload)
        .where(
          and(
            eq(pgWorkspaceMembers.workspaceId, workspaceId),
            eq(pgWorkspaceMembers.userId, userId)
          )
        );
    } catch (error) {
      console.error('[PostgreSQL] persistWorkspaceMemberUpdate error:', error);
    }
  }

  public async persistChannel(channel: Channel) {
    try {
      await pgDb.insert(pgChannels).values({
        id: channel.id,
        tenantId: channel.tenantId,
        workspaceId: channel.workspaceId,
        name: channel.name,
        description: channel.description,
        topic: channel.topic,
        type: channel.isPrivate ? 'Private' : 'Public',
        isArchived: channel.isArchived,
        isGeneral: channel.name === 'general',
        createdBy: channel.createdBy,
        createdAt: new Date(channel.createdAt),
        updatedAt: new Date(channel.updatedAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistChannel error:', error);
    }
  }

  public async persistChannelSoftDelete(id: string) {
    try {
      await pgDb.update(pgChannels).set({
        isArchived: true,
        updatedAt: new Date()
      }).where(eq(pgChannels.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistChannelSoftDelete error:', error);
    }
  }

  public async persistChannelUpdate(id: string, updates: Partial<Channel>) {
    try {
      const payload: any = { updatedAt: new Date() };
      if (updates.name) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.topic !== undefined) payload.topic = updates.topic;
      if (updates.isArchived !== undefined) payload.isArchived = updates.isArchived;
      await pgDb.update(pgChannels).set(payload).where(eq(pgChannels.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistChannelUpdate error:', error);
    }
  }

  public async persistChannelMember(channelId: string, userId: string, workspaceId: string, role: string = 'Member') {
    try {
      await pgDb.insert(pgChannelMembers).values({
        id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channelId,
        userId,
        workspaceId,
        role,
        notifications: 'All',
        joinedAt: new Date()
      });
    } catch (error) {
      console.error('[PostgreSQL] persistChannelMember error:', error);
    }
  }

  public async persistConversation(conv: Conversation) {
    try {
      await pgDb.insert(pgConversations).values({
        id: conv.id,
        tenantId: conv.tenantId,
        workspaceId: conv.workspaceId,
        type: conv.isGroup ? 'Group' : 'Direct',
        name: conv.name || null,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt || conv.createdAt)
      }).onConflictDoNothing();

      if (conv.memberIds && conv.memberIds.length > 0) {
        for (const mId of conv.memberIds) {
          const cmId = `cm-${conv.id}-${mId}`;
          await pgDb.insert(pgConversationMembers).values({
            id: cmId,
            conversationId: conv.id,
            userId: mId,
            workspaceId: conv.workspaceId,
            joinedAt: new Date(conv.createdAt)
          }).onConflictDoNothing();
          if (!this.conversationMembers.some(cm => cm.conversationId === conv.id && cm.userId === mId)) {
            this.conversationMembers.push({
              id: cmId,
              conversationId: conv.id,
              userId: mId,
              joinedAt: conv.createdAt
            });
          }
        }
      }
    } catch (error) {
      console.error('[PostgreSQL] persistConversation error:', error);
    }
  }

  public async persistConversationMember(conversationId: string, userId: string, workspaceId: string) {
    try {
      await pgDb.insert(pgConversationMembers).values({
        id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        conversationId,
        userId,
        workspaceId,
        joinedAt: new Date()
      });
    } catch (error) {
      console.error('[PostgreSQL] persistConversationMember error:', error);
    }
  }

  public async removeConversationMember(conversationId: string, userId: string) {
    try {
      await pool.query('DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, userId]);
      this.conversationMembers = this.conversationMembers.filter(cm => !(cm.conversationId === conversationId && cm.userId === userId));
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.memberIds = conv.memberIds.filter(id => id !== userId);
      }
    } catch (error) {
      console.error('[PostgreSQL] removeConversationMember error:', error);
    }
  }

  public async updateConversation(id: string, updates: Partial<Conversation>) {
    try {
      const payload: any = { updatedAt: new Date() };
      if (updates.name !== undefined) payload.name = updates.name;
      await pgDb.update(pgConversations).set(payload).where(eq(pgConversations.id, id));
      const conv = this.conversations.find(c => c.id === id);
      if (conv) {
        if (updates.name !== undefined) conv.name = updates.name;
        conv.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      console.error('[PostgreSQL] updateConversation error:', error);
    }
  }

  public async deleteConversation(id: string) {
    try {
      await pool.query('DELETE FROM messages WHERE conversation_id = $1', [id]);
      await pool.query('DELETE FROM conversation_members WHERE conversation_id = $1', [id]);
      await pool.query('DELETE FROM conversations WHERE id = $1', [id]);
      this.conversations = this.conversations.filter(c => c.id !== id);
      this.conversationMembers = this.conversationMembers.filter(cm => cm.conversationId !== id);
      this.messages = this.messages.filter(m => m.conversationId !== id);
    } catch (error) {
      console.error('[PostgreSQL] deleteConversation error:', error);
    }
  }


  public async persistMessage(msg: Message, clientMessageId?: string) {
    try {
      const wsId = msg.workspaceId || this.workspaces.find(w => w.tenantId === msg.tenantId)?.id || this.workspaces[0]?.id || '';
      await pgDb.insert(pgMessages).values({
        id: msg.id,
        tenantId: msg.tenantId,
        workspaceId: wsId,
        channelId: msg.channelId || null,
        conversationId: msg.conversationId || null,
        parentMessageId: msg.parentMessageId || null,
        userId: msg.senderId,
        content: msg.content,
        attachments: msg.attachments && msg.attachments.length > 0 ? JSON.stringify(msg.attachments) : null,
        isEdited: !!msg.isEdited,
        isPinned: !!msg.isPinned,
        replyCount: msg.repliesCount || 0,
        clientMessageId: clientMessageId || (msg as any).clientMessageId || null,
        createdAt: new Date(msg.createdAt),
        updatedAt: new Date(msg.updatedAt),
        deletedAt: msg.isDeleted ? new Date() : null
      });
    } catch (error) {
      console.error('[PostgreSQL] persistMessage error:', error);
    }
  }

  public async persistMessageUpdate(msg: Message) {
    try {
      await pgDb
        .update(pgMessages)
        .set({
          content: msg.content,
          isEdited: !!msg.isEdited,
          isPinned: !!msg.isPinned,
          replyCount: msg.repliesCount || 0,
          updatedAt: new Date(),
          deletedAt: msg.isDeleted ? new Date() : null
        })
        .where(eq(pgMessages.id, msg.id));
    } catch (error) {
      console.error('[PostgreSQL] persistMessageUpdate error:', error);
    }
  }

  public async persistReaction(rx: MessageReaction) {
    try {
      await pgDb.insert(pgMessageReactions).values({
        id: rx.id,
        messageId: rx.messageId,
        userId: rx.userId,
        emoji: rx.emoji,
        createdAt: new Date(rx.createdAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistReaction error:', error);
    }
  }

  public async removeReaction(messageId: string, userId: string, emoji: string) {
    try {
      await pgDb
        .delete(pgMessageReactions)
        .where(
          and(
            eq(pgMessageReactions.messageId, messageId),
            eq(pgMessageReactions.userId, userId),
            eq(pgMessageReactions.emoji, emoji)
          )
        );
    } catch (error) {
      console.error('[PostgreSQL] removeReaction error:', error);
    }
  }

  public async persistTask(task: Task) {
    try {
      await pgDb.insert(pgTasks).values({
        id: task.id,
        tenantId: task.tenantId,
        workspaceId: task.workspaceId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assignedTo || null,
        creatorId: task.createdBy,
        dueDate: task.dueDate || null,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistTask error:', error);
    }
  }

  public async persistTaskUpdate(id: string, updates: Partial<Task>) {
    try {
      const updatePayload: any = { updatedAt: new Date() };
      if (updates.status) updatePayload.status = updates.status;
      if (updates.priority) updatePayload.priority = updates.priority;
      if (updates.title) updatePayload.title = updates.title;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.assignedTo !== undefined) updatePayload.assigneeId = updates.assignedTo || null;
      if (updates.dueDate !== undefined) updatePayload.dueDate = updates.dueDate || null;

      await pgDb.update(pgTasks).set(updatePayload).where(eq(pgTasks.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistTaskUpdate error:', error);
    }
  }

  public async deleteTask(id: string) {
    try {
      await pgDb.delete(pgTasks).where(eq(pgTasks.id, id));
    } catch (error) {
      console.error('[PostgreSQL] deleteTask error:', error);
    }
  }

  public async persistWorkspace(ws: Workspace) {
    try {
      await pgDb.insert(pgWorkspaces).values({
        id: ws.id,
        tenantId: ws.tenantId,
        name: ws.name,
        slug: ws.slug,
        description: ws.description || null,
        logoUrl: ws.logoUrl || null,
        ownerId: ws.ownerId || null,
        status: ws.status || 'Active',
        timeZone: ws.timeZone || 'Europe/Madrid',
        language: ws.language || 'es-ES',
        createdAt: new Date(ws.createdAt),
        updatedAt: new Date(ws.updatedAt || ws.createdAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistWorkspace error:', error);
    }
  }

  public async persistWorkspaceMember(wm: WorkspaceMember) {
    try {
      await pgDb.insert(pgWorkspaceMembers).values({
        id: wm.id,
        workspaceId: wm.workspaceId,
        tenantId: wm.tenantId,
        userId: wm.userId,
        role: wm.role || 'Member',
        status: wm.status || 'Active',
        joinedAt: new Date(wm.joinedAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistWorkspaceMember error:', error);
    }
  }

  public async persistCalendarEvent(evt: any) {
    try {
      await pgDb.insert(pgCalendarEvents).values({
        id: evt.id,
        tenantId: evt.tenantId,
        workspaceId: evt.workspaceId,
        title: evt.title,
        description: evt.description || null,
        location: evt.location || null,
        startDate: evt.startAt || evt.startDate,
        endDate: evt.endAt || evt.endDate,
        allDay: !!evt.allDay,
        creatorId: evt.createdBy || evt.creatorId,
        createdAt: new Date(evt.createdAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistCalendarEvent error:', error);
    }
  }

  public async deleteCalendarEvent(id: string) {
    try {
      await pgDb.delete(pgCalendarEvents).where(eq(pgCalendarEvents.id, id));
    } catch (error) {
      console.error('[PostgreSQL] deleteCalendarEvent error:', error);
    }
  }

  public async persistMeeting(m: any) {
    try {
      await pgDb.insert(pgMeetings).values({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        title: m.title,
        hostId: m.hostId,
        status: m.isLive ? 'Active' : 'Ended',
        roomName: m.meetingCode || m.roomName || m.id,
        isRecording: false,
        startedAt: new Date(m.createdAt || Date.now())
      }).onConflictDoUpdate({
        target: pgMeetings.id,
        set: {
          status: m.isLive ? 'Active' : 'Ended',
          endedAt: m.isLive ? null : new Date()
        }
      });
    } catch (error) {
      console.error('[PostgreSQL] persistMeeting error:', error);
    }
  }

  public async persistCall(c: CallSession) {
    try {
      await pgDb.insert(pgCalls).values({
        id: c.id,
        tenantId: c.tenantId,
        workspaceId: c.workspaceId,
        roomId: c.roomId,
        origin: c.origin || 'direct',
        type: c.type || '1:1',
        mediaType: c.mediaType || 'video',
        direction: c.direction || 'outbound',
        callerId: c.callerId,
        calleeId: c.calleeId || null,
        conversationId: c.conversationId || null,
        channelId: c.channelId || null,
        status: c.state || 'initiating',
        startedAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        connectedAt: c.connectedAt ? new Date(c.connectedAt) : null,
        endedAt: c.endedAt ? new Date(c.endedAt) : null,
        durationSeconds: c.durationSeconds || 0,
        endReason: c.endReason || null,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
      }).onConflictDoUpdate({
        target: pgCalls.id,
        set: {
          status: c.state,
          connectedAt: c.connectedAt ? new Date(c.connectedAt) : null,
          endedAt: c.endedAt ? new Date(c.endedAt) : null,
          durationSeconds: c.durationSeconds || 0,
          endReason: c.endReason || null
        }
      });

      const existingIdx = this.calls.findIndex(call => call.id === c.id);
      if (existingIdx >= 0) {
        this.calls[existingIdx] = { ...this.calls[existingIdx], ...c };
      } else {
        this.calls.unshift(c);
      }
    } catch (error) {
      console.error('[PostgreSQL] persistCall error:', error);
    }
  }

  public async persistCallParticipant(p: CallParticipant) {
    try {
      await pgDb.insert(pgCallParticipants).values({
        id: p.id,
        callId: p.callId,
        userId: p.userId,
        role: p.role || 'caller',
        state: p.state || 'invited',
        joinedAt: p.joinedAt ? new Date(p.joinedAt) : null,
        leftAt: p.leftAt ? new Date(p.leftAt) : null,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
      }).onConflictDoUpdate({
        target: pgCallParticipants.id,
        set: {
          state: p.state,
          joinedAt: p.joinedAt ? new Date(p.joinedAt) : null,
          leftAt: p.leftAt ? new Date(p.leftAt) : null
        }
      });

      const existingIdx = this.callParticipants.findIndex(part => part.id === p.id);
      if (existingIdx >= 0) {
        this.callParticipants[existingIdx] = { ...this.callParticipants[existingIdx], ...p };
      } else {
        this.callParticipants.push(p);
      }
    } catch (error) {
      console.error('[PostgreSQL] persistCallParticipant error:', error);
    }
  }

  public async persistCallHistory(h: CallHistoryRecord) {
    try {
      await pgDb.insert(pgCallHistory).values({
        id: h.id,
        callId: h.callId,
        eventType: h.eventType,
        userId: h.userId || null,
        metadata: typeof h.metadata === 'string' ? h.metadata : JSON.stringify(h.metadata || {}),
        createdAt: h.createdAt ? new Date(h.createdAt) : new Date()
      });

      this.callHistory.unshift(h);
    } catch (error) {
      console.error('[PostgreSQL] persistCallHistory error:', error);
    }
  }

  public getCall(id: string): CallSession | undefined {
    return this.calls.find(c => c.id === id || c.roomId === id);
  }

  public getCallsByTenant(tenantId: string): CallSession[] {
    return this.calls.filter(c => c.tenantId === tenantId);
  }

  public async persistFile(f: any) {
    try {
      await pgDb.insert(pgFiles).values({
        id: f.id,
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        uploadedBy: f.uploadedBy,
        fileName: f.name || f.fileName,
        fileSize: Number(f.size || f.fileSize) || 1024,
        contentType: f.fileType || f.contentType || 'application/octet-stream',
        url: f.url,
        createdAt: new Date(f.createdAt)
      });
    } catch (error) {
      console.error('[PostgreSQL] persistFile error:', error);
    }
  }

  public async deleteFile(id: string) {
    try {
      await pgDb.delete(pgFiles).where(eq(pgFiles.id, id));
    } catch (error) {
      console.error('[PostgreSQL] deleteFile error:', error);
    }
  }

  public async persistAuditLog(entry: any) {
    try {
      await pgDb.insert(pgAuditLogs).values({
        id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tenantId: entry.tenantId,
        userId: entry.userId || null,
        action: entry.action,
        resource: entry.resource || entry.resourceType || 'System',
        resourceId: entry.resourceId || null,
        ipAddress: entry.ipAddress || null,
        details: typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details || {}),
        createdAt: new Date(entry.createdAt || Date.now())
      });
    } catch (error) {
      console.error('[PostgreSQL] persistAuditLog error:', error);
    }
  }

  public async persistSession(session: any) {
    try {
      await pgDb.insert(pgUserSessions).values({
        id: session.id,
        tenantId: session.tenantId,
        userId: session.userId,
        workspaceId: session.workspaceId || null,
        token: session.token || session.id,
        refreshToken: session.refreshToken || session.refreshTokenHash,
        ipAddress: session.ipAddress || null,
        userAgent: session.userAgent || null,
        deviceName: session.deviceName || null,
        isActive: session.isActive !== undefined ? session.isActive : true,
        expiresAt: new Date(session.expiresAt),
        createdAt: new Date(session.createdAt || Date.now()),
        lastActiveAt: new Date(session.lastUsedAt || Date.now())
      });
    } catch (error) {
      console.error('[PostgreSQL] persistSession error:', error);
    }
  }

  public async revokePgSession(sessionId: string) {
    try {
      await pgDb
        .update(pgUserSessions)
        .set({ isActive: false, revokedAt: new Date() })
        .where(eq(pgUserSessions.id, sessionId));
    } catch (error) {
      console.error('[PostgreSQL] revokePgSession error:', error);
    }
  }

  public async updatePgSession(sessionId: string, updates: any) {
    try {
      const payload: any = { lastActiveAt: new Date() };
      if (updates.refreshTokenHash) payload.refreshToken = updates.refreshTokenHash;
      if (updates.token) payload.token = updates.token;
      await pgDb
        .update(pgUserSessions)
        .set(payload)
        .where(eq(pgUserSessions.id, sessionId));
    } catch (error) {
      console.error('[PostgreSQL] updatePgSession error:', error);
    }
  }

  public async persistMessageSoftDelete(id: string) {
    try {
      await pgDb
        .update(pgMessages)
        .set({
          deletedAt: new Date(),
          content: 'Este mensaje fue eliminado.',
          updatedAt: new Date()
        })
        .where(eq(pgMessages.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistMessageSoftDelete error:', error);
    }
  }

  public async persistCalendarEventUpdate(id: string, updates: Partial<CalendarEvent>) {
    try {
      const payload: any = {};
      if (updates.title) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.startAt) payload.startDate = updates.startAt;
      if (updates.endAt) payload.endDate = updates.endAt;
      await pgDb
        .update(pgCalendarEvents)
        .set(payload)
        .where(eq(pgCalendarEvents.id, id));
    } catch (error) {
      console.error('[PostgreSQL] persistCalendarEventUpdate error:', error);
    }
  }

  public async persistTaskComment(comment: TaskComment) {
    try {
      await pool.query(
        'INSERT INTO task_comments (id, task_id, user_id, user_name, user_avatar, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [comment.id, comment.taskId, comment.userId, comment.userName, comment.userAvatar || '', comment.content, new Date(comment.createdAt)]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistTaskComment error:', error);
    }
  }

  public async deleteTaskComment(commentId: string) {
    try {
      await pool.query('DELETE FROM task_comments WHERE id = $1', [commentId]);
    } catch (error) {
      console.error('[PostgreSQL] deleteTaskComment error:', error);
    }
  }

  // --- Notifications Persistence ---
  public async persistNotification(notif: Notification) {
    try {
      await pool.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, entity_type, entity_id, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           read_at = EXCLUDED.read_at`,
        [
          notif.id,
          notif.tenantId,
          notif.userId,
          notif.type,
          notif.title,
          notif.message,
          (notif as any).entityType || null,
          (notif as any).entityId || null,
          notif.isRead ? new Date() : null,
          new Date(notif.createdAt)
        ]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistNotification error:', error);
    }
  }

  public async markNotificationRead(id: string) {
    try {
      await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = $1', [id]);
    } catch (error) {
      console.error('[PostgreSQL] markNotificationRead error:', error);
    }
  }

  public async markAllNotificationsRead(tenantId: string, userId: string) {
    try {
      await pool.query('UPDATE notifications SET read_at = NOW() WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL', [tenantId, userId]);
    } catch (error) {
      console.error('[PostgreSQL] markAllNotificationsRead error:', error);
    }
  }

  // --- Organizations Persistence ---
  public async persistOrganization(org: Organization) {
    try {
      await pool.query(
        `INSERT INTO organizations (id, name, slug, type, industry, logo_url, primary_domain, status, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           type = EXCLUDED.type,
           industry = EXCLUDED.industry,
           logo_url = EXCLUDED.logo_url,
           primary_domain = EXCLUDED.primary_domain,
           status = EXCLUDED.status,
           settings = EXCLUDED.settings,
           updated_at = NOW()`,
        [
          org.id, org.name, org.slug, org.type || 'Enterprise', org.industry || 'Technology',
          org.logoUrl || null, org.primaryDomain || null, org.status || 'Active',
          typeof org.settings === 'string' ? org.settings : JSON.stringify(org.settings || {}),
          new Date(org.createdAt), new Date(org.updatedAt)
        ]
      );
      // Keep tenants in sync for 100% backwards-compatibility with existing foreign keys
      await pool.query(
        `INSERT INTO tenants (id, name, slug, domain, logo_url, plan, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'Enterprise', $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           domain = EXCLUDED.domain,
           logo_url = EXCLUDED.logo_url,
           updated_at = NOW()`,
        [org.id, org.name, org.slug, org.primaryDomain, org.logoUrl || null, new Date(org.createdAt), new Date(org.updatedAt)]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistOrganization error:', error);
    }
  }

  public async persistOrganizationDomain(dom: OrganizationDomain) {
    try {
      await pool.query(
        `INSERT INTO organization_domains (id, organization_id, domain, is_primary, is_verified, verification_token, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           domain = EXCLUDED.domain,
           is_primary = EXCLUDED.is_primary,
           is_verified = EXCLUDED.is_verified`,
        [dom.id, dom.organizationId, dom.domain, dom.isPrimary, dom.isVerified, dom.verificationToken || null, new Date(dom.createdAt)]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistOrganizationDomain error:', error);
    }
  }

  public async deleteOrganizationDomain(id: string) {
    try {
      await pool.query('DELETE FROM organization_domains WHERE id = $1', [id]);
    } catch (error) {
      console.error('[PostgreSQL] deleteOrganizationDomain error:', error);
    }
  }

  public async persistOrganizationMember(om: OrganizationMember) {
    try {
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           role = EXCLUDED.role,
           status = EXCLUDED.status`,
        [om.id, om.organizationId, om.userId, om.role, om.status, new Date(om.joinedAt)]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistOrganizationMember error:', error);
    }
  }

  public async removeOrganizationMember(orgId: string, userId: string) {
    try {
      await pool.query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [orgId, userId]);
    } catch (error) {
      console.error('[PostgreSQL] removeOrganizationMember error:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FASE 6: IN-CALL CHAT & MESSAGING — PERSISTENCE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record that a specific user has read a message.
   * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
   */
  public async persistMessageRead(messageId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO message_reads (id, message_id, user_id, read_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [`mr-${messageId}-${userId}`, messageId, userId]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistMessageRead error:', error);
    }
  }

  /**
   * Record that a specific message has been delivered to a user.
   * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
   */
  public async persistMessageDelivered(messageId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO message_deliveries (id, message_id, user_id, delivered_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [`md-${messageId}-${userId}`, messageId, userId]
      );
    } catch (error) {
      console.error('[PostgreSQL] persistMessageDelivered error:', error);
    }
  }

  /**
   * Find or create a conversation associated with a call.
   * - For 1:1 calls: finds existing direct conversation between caller and callee, or creates one.
   * - For group calls: creates a conversation of type 'call' and adds participants.
   * Idempotent: safe to call multiple times for the same callId.
   */
  public async findOrCreateCallConversation(params: {
    callId: string;
    tenantId: string;
    workspaceId: string;
    memberIds: string[];
    title?: string;
    type?: 'call' | 'direct' | 'group';
  }): Promise<{ id: string; isNew: boolean }> {
    const { callId, tenantId, workspaceId, memberIds, title, type = 'call' } = params;

    // Check if this call already has a linked conversation
    const existingByCall = await pool.query(
      `SELECT id FROM conversations WHERE call_id = $1 AND tenant_id = $2 LIMIT 1`,
      [callId, tenantId]
    );
    if (existingByCall.rows.length > 0) {
      return { id: existingByCall.rows[0].id, isNew: false };
    }

    // For 1:1 direct calls — check if a direct conversation between the two users already exists
    if (type === 'direct' && memberIds.length === 2) {
      const [uA, uB] = memberIds;
      const existingDirect = this.conversations.find(c =>
        c.tenantId === tenantId &&
        !c.isGroup &&
        c.memberIds.length === 2 &&
        c.memberIds.includes(uA) &&
        c.memberIds.includes(uB)
      );
      if (existingDirect) {
        // Link this call to the existing conversation
        await pool.query(
          `UPDATE conversations SET call_id = $1, updated_at = NOW() WHERE id = $2`,
          [callId, existingDirect.id]
        );
        return { id: existingDirect.id, isNew: false };
      }
    }

    // Create a new conversation linked to this call
    const convId = `conv-call-${callId}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO conversations (id, tenant_id, workspace_id, type, name, call_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO NOTHING`,
      [convId, tenantId, workspaceId, type === 'direct' ? 'Direct' : 'call', title || null, callId, now]
    );

    // Add all members
    for (const userId of memberIds) {
      await pool.query(
        `INSERT INTO conversation_members (id, conversation_id, user_id, workspace_id, joined_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [`cm-${convId}-${userId}`, convId, userId, workspaceId, now]
      );
    }

    // Sync into in-memory store
    const inMemory = {
      id: convId,
      tenantId,
      workspaceId,
      isGroup: type !== 'direct',
      name: title,
      memberIds,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      unreadCount: 0
    };
    if (!this.conversations.some(c => c.id === convId)) {
      this.conversations.push(inMemory);
    }
    for (const userId of memberIds) {
      if (!this.conversationMembers.some(cm => cm.conversationId === convId && cm.userId === userId)) {
        this.conversationMembers.push({
          id: `cm-${convId}-${userId}`,
          conversationId: convId,
          userId,
          joinedAt: now.toISOString()
        });
      }
    }

    return { id: convId, isNew: true };
  }

  /**
   * Update a conversation's call_id association and update in-memory cache.
   */
  public async linkConversationToCall(conversationId: string, callId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE conversations SET call_id = $1, updated_at = NOW() WHERE id = $2`,
        [callId, conversationId]
      );
    } catch (error) {
      console.error('[PostgreSQL] linkConversationToCall error:', error);
    }
  }

  /**
   * Add a participant to an existing call conversation.
   */
  public async addMemberToCallConversation(conversationId: string, userId: string, workspaceId: string): Promise<void> {
    try {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv && !conv.memberIds.includes(userId)) {
        conv.memberIds.push(userId);
      }
      await pool.query(
        `INSERT INTO conversation_members (id, conversation_id, user_id, workspace_id, joined_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`cm-${conversationId}-${userId}`, conversationId, userId, workspaceId]
      );
    } catch (error) {
      console.error('[PostgreSQL] addMemberToCallConversation error:', error);
    }
  }

  /**
   * Persist a system message (e.g. "X joined the call", "Call ended") to a conversation.
   */
  public async persistSystemMessage(params: {
    conversationId: string;
    tenantId: string;
    workspaceId: string;
    content: string;
    userId?: string;
  }): Promise<string> {
    const id = `sysmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      let authorId = params.userId;
      if (!authorId) {
        const conv = this.conversations.find(c => c.id === params.conversationId);
        authorId = conv?.memberIds?.[0] || this.users.find(u => u.tenantId === params.tenantId)?.id || this.users[0]?.id;
      }
      if (!authorId) {
        const uRes = await pool.query('SELECT id FROM users LIMIT 1');
        authorId = uRes.rows[0]?.id;
      }
      if (authorId) {
        await pool.query(
          `INSERT INTO messages (id, workspace_id, tenant_id, conversation_id, user_id, content, message_type, status, is_edited, is_pinned, reply_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'system', 'sent', false, false, 0, NOW(), NOW())`,
          [id, params.workspaceId, params.tenantId, params.conversationId, authorId, params.content]
        );
      }
    } catch (error) {
      console.error('[PostgreSQL] persistSystemMessage error:', error);
    }
    return id;
  }

  /**
   * Check idempotency: return existing message ID if client_message_id was already persisted.
   */
  public async findMessageByClientId(clientMessageId: string, tenantId: string): Promise<string | null> {
    try {
      const res = await pool.query(
        `SELECT id FROM messages WHERE client_message_id = $1 AND tenant_id = $2 LIMIT 1`,
        [clientMessageId, tenantId]
      );
      return res.rows.length > 0 ? res.rows[0].id : null;
    } catch (error) {
      console.error('[PostgreSQL] findMessageByClientId error:', error);
      return null;
    }
  }
}

export const db = new CollabDatabase();
