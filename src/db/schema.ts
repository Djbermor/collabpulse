import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// 1. TENANTS
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'),
  logoUrl: text('logo_url'),
  plan: text('plan').default('Free').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 2. USERS
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  uid: text('uid').unique(), // Firebase Auth UID for Google OAuth
  email: text('email'), // Nullable for users without email
  normalizedEmail: text('normalized_email'),
  userName: text('user_name').notNull().unique(),
  normalizedUserName: text('normalized_user_name').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url').default(''),
  jobTitle: text('job_title').default(''),
  phone: text('phone'),
  timeZone: text('time_zone').default('Europe/Madrid').notNull(),
  status: text('status').default('Offline').notNull(),
  customStatus: text('custom_status'),
  accountStatus: text('account_status').default('Active').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  mustChangePassword: boolean('must_change_password').default(false),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  role: text('role').default('Member').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 3. WORKSPACES
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  logoUrl: text('logo_url'),
  ownerId: text('owner_id').references(() => users.id),
  status: text('status').default('Active').notNull(),
  timeZone: text('time_zone').default('Europe/Madrid').notNull(),
  language: text('language').default('es-ES').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 4. WORKSPACE MEMBERS
export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').default('Member').notNull(),
  status: text('status').default('Active').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. WORKSPACE INVITATIONS
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  inviterId: text('inviter_id').references(() => users.id).notNull(),
  email: text('email').notNull(),
  role: text('role').default('Member').notNull(),
  token: text('token').notNull().unique(),
  status: text('status').default('Pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. USER SESSIONS
export const userSessions = pgTable('user_sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  workspaceId: text('workspace_id'),
  token: text('token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  isActive: boolean('is_active').default(true).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. EMAIL VERIFICATION TOKENS
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. PASSWORD RESET TOKENS
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. CHANNELS
export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  topic: text('topic'),
  type: text('type').default('Public').notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  isGeneral: boolean('is_general').default(false).notNull(),
  createdBy: text('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. CHANNEL MEMBERS
export const channelMembers = pgTable('channel_members', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').references(() => channels.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  role: text('role').default('Member').notNull(),
  notifications: text('notifications').default('All').notNull(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. CONVERSATIONS
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  type: text('type').default('Direct').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 12. CONVERSATION MEMBERS
export const conversationMembers = pgTable('conversation_members', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. MESSAGES
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  channelId: text('channel_id').references(() => channels.id),
  conversationId: text('conversation_id').references(() => conversations.id),
  parentMessageId: text('parent_message_id'),
  userId: text('user_id').references(() => users.id).notNull(),
  clientMessageId: text('client_message_id'),
  content: text('content').notNull(),
  richContent: text('rich_content'),
  attachments: text('attachments'),
  isEdited: boolean('is_edited').default(false).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  lastReplyAt: timestamp('last_reply_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 14. MESSAGE REACTIONS
export const messageReactions = pgTable('message_reactions', {
  id: text('id').primaryKey(),
  messageId: text('message_id').references(() => messages.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. PINNED MESSAGES
export const pinnedMessages = pgTable('pinned_messages', {
  id: text('id').primaryKey(),
  messageId: text('message_id').references(() => messages.id).notNull(),
  pinnedBy: text('pinned_by').references(() => users.id).notNull(),
  channelId: text('channel_id'),
  conversationId: text('conversation_id'),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }).defaultNow().notNull(),
});

// 16. SAVED MESSAGES
export const savedMessages = pgTable('saved_messages', {
  id: text('id').primaryKey(),
  messageId: text('message_id').references(() => messages.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
});

// 17. TASKS
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('Todo').notNull(),
  priority: text('priority').default('Medium').notNull(),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  assigneeId: text('assignee_id').references(() => users.id),
  dueDate: text('due_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 18. CALENDAR EVENTS
export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  allDay: boolean('all_day').default(false).notNull(),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 19. MEETINGS
export const meetings = pgTable('meetings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  title: text('title').notNull(),
  hostId: text('host_id').references(() => users.id).notNull(),
  status: text('status').default('Active').notNull(),
  roomName: text('room_name').notNull(),
  isRecording: boolean('is_recording').default(false).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

// 20. FILES
export const files = pgTable('files', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  uploadedBy: text('uploaded_by').references(() => users.id).notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  contentType: text('content_type').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 21. AUDIT LOGS
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  ipAddress: text('ip_address'),
  details: text('details'),
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 22. ORGANIZATIONS
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type').default('Enterprise').notNull(),
  industry: text('industry').default('Technology').notNull(),
  logoUrl: text('logo_url'),
  primaryDomain: text('primary_domain'),
  status: text('status').default('Active').notNull(),
  settings: text('settings').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 23. ORGANIZATION DOMAINS
export const organizationDomains = pgTable('organization_domains', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  domain: text('domain').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationToken: text('verification_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 24. ORGANIZATION MEMBERS
export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').default('Member').notNull(),
  status: text('status').default('Active').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

// 25. ORGANIZATION SETTINGS
export const organizationSettings = pgTable('organization_settings', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  allowAutoJoin: boolean('allow_auto_join').default(false).notNull(),
  requireApproval: boolean('require_approval').default(true).notNull(),
  allowExternalGuests: boolean('allow_external_guests').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 26. NOTIFICATIONS
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 27. TASK COMMENTS
export const taskComments = pgTable('task_comments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  userName: text('user_name').notNull(),
  userAvatar: text('user_avatar').default(''),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// RELATIONS
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  workspaces: many(workspaces),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  sessions: many(userSessions),
  channelMemberships: many(channelMembers),
  workspaceMemberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [workspaces.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  channels: many(channels),
  conversations: many(conversations),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id],
  }),
  author: one(users, {
    fields: [channels.createdBy],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  author: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  reactions: many(messageReactions),
}));
