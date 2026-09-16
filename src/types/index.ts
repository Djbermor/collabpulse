// Types definition for CollabPulse Enterprise Platform

export type UserPresenceStatus = 'Online' | 'Away' | 'Busy' | 'DoNotDisturb' | 'Offline';
export type UserStatus = UserPresenceStatus; // Backward compatibility

export type AccountStatus = 'Active' | 'Inactive' | 'Suspended' | 'Deleted' | 'PendingVerification';

export type UserRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

export type GranularPermission =
  | 'workspace.read'
  | 'workspace.update'
  | 'workspace.delete'
  | 'members.read'
  | 'members.invite'
  | 'members.remove'
  | 'members.update_role'
  | 'channels.create'
  | 'channels.update'
  | 'channels.archive'
  | 'channels.delete'
  | 'channels.manage_members'
  | 'messages.read'
  | 'messages.create'
  | 'messages.update'
  | 'messages.delete'
  | 'messages.pin'
  | 'files.read'
  | 'files.upload'
  | 'files.delete'
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.delete'
  | 'calendar.create'
  | 'calendar.update'
  | 'calendar.delete'
  | 'meetings.create'
  | 'meetings.manage'
  | 'audit.read'
  | 'settings.manage';

export type Permission = GranularPermission | string;

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logoUrl?: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  industry: string;
  logoUrl?: string;
  primaryDomain: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  settings?: Record<string, any> | string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDomain {
  id: string;
  organizationId: string;
  domain: string;
  isPrimary: boolean;
  isVerified: boolean;
  verificationToken?: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  joinedAt: string;
  user?: User;
  organization?: Organization;
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  allowAutoJoin: boolean;
  requireApproval: boolean;
  allowExternalGuests: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  ownerId?: string;
  status?: 'Active' | 'Suspended' | 'Archived' | 'Deleted';
  timeZone: string;
  language: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  normalizedEmail: string;
  userName: string;
  normalizedUserName: string;
  firstName: string;
  lastName: string;
  displayName: string;
  passwordHash?: string;
  avatarUrl: string;
  jobTitle: string;
  phone?: string;
  phoneNumber?: string;
  bio?: string;
  timeZone: string;
  status: UserPresenceStatus;
  customStatus?: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  lockoutUntil?: string;
  lastLoginAt?: string;
  lastSeenAt: string;
  isActive: boolean;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  status: 'Active' | 'Invited' | 'Suspended' | 'Removed' | 'Inactive';
  joinedAt: string;
  invitedBy?: string;
  user?: User;
}

export interface UserSession {
  id: string;
  userId: string;
  tenantId: string;
  workspaceId: string;
  refreshTokenHash: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt?: string;
  revocationReason?: string;
  isCurrent?: boolean;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  token?: string; // only provided on initial creation
  invitedBy?: string;
  createdBy?: string;
  status?: 'Pending' | 'Accepted' | 'Revoked' | 'Expired';
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  token?: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  token?: string;
  expiresAt: string;
  isUsed?: boolean;
  usedAt?: string;
  createdAt: string;
}

export type AuthState = 'Loading' | 'Unauthenticated' | 'Authenticated' | 'Refreshing' | 'SessionExpired';

export interface AuthSessionResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  permissions: string[];
  session: {
    id: string;
    deviceName: string;
    browser: string;
    os: string;
    ipAddress: string;
    lastUsedAt: string;
    expiresAt: string;
  };
}

export interface Channel {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  normalizedName?: string;
  description: string;
  topic?: string;
  type?: 'public' | 'private';
  isPrivate: boolean;
  isArchived: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  notificationLevel?: 'all' | 'mentions' | 'nothing';
  lastReadMessageId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
  membersCount?: number;
  unreadCount?: number;
}

export interface ChannelMember {
  id?: string;
  channelId: string;
  userId: string;
  role?: UserRole;
  joinedAt: string;
  isMuted?: boolean;
  notificationLevel?: 'all' | 'mentions' | 'nothing';
  lastReadMessageId?: string;
  user?: User;
}

export interface Conversation {
  id: string;
  tenantId: string;
  workspaceId: string;
  isGroup: boolean;
  name?: string;
  avatarUrl?: string;
  memberIds: string[];
  createdBy?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId?: string;
}

export interface MessageReaction {
  id?: string;
  messageId?: string;
  userId?: string;
  userName?: string;
  emoji: string;
  count?: number;
  users?: string[];
  reactedByCurrentUser?: boolean;
  createdAt?: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  fileType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface Message {
  id: string;
  tenantId: string;
  workspaceId?: string;
  channelId?: string;
  conversationId?: string;
  threadRootMessageId?: string;
  parentMessageId?: string; // alias for threadRootMessageId
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  clientMessageId?: string;
  messageType: 'text' | 'file' | 'system';
  type?: 'text' | 'file' | 'system';
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  isPinned: boolean;
  isSaved?: boolean;
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  repliesCount: number;
  lastReplyAt?: string;
  thread?: {
    replyCount: number;
    participants?: Array<{ id: string; displayName: string; avatarUrl: string }>;
    lastReplyAt?: string;
  };
  sender?: {
    id: string;
    displayName: string;
    avatarUrl: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MessageEditHistory {
  id: string;
  messageId: string;
  previousContent: string;
  editedBy: string;
  editedAt: string;
}

export interface PinnedMessage {
  id: string;
  messageId: string;
  channelId: string;
  pinnedBy: string;
  pinnedAt: string;
  message?: Message;
}

export interface SavedMessage {
  id: string;
  userId: string;
  messageId: string;
  note?: string;
  createdAt: string;
  message?: Message;
}

export interface OutboxEvent {
  id: string;
  eventType: string;
  payload: any;
  createdAt: string;
  processedAt?: string;
  retryCount: number;
  error?: string;
}

export type TaskStatus = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled' | 'Postponed';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assignedUserName?: string;
  assignedUserAvatar?: string;
  createdBy: string;
  dueDate?: string;
  completedAt?: string;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string;
  createdBy: string;
  attendees: string[];
  createdAt: string;
}

export interface MeetingParticipant {
  userId: string;
  userName: string;
  userAvatar: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
}

export interface Meeting {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  meetingCode: string;
  isLive: boolean;
  hostId: string;
  participants: MeetingParticipant[];
  callType?: 'video' | 'audio';
  createdAt: string;
}

// --- CALL ENGINE CORE (FASE 1) ---
export type CallState =
  | 'idle'
  | 'initiating'
  | 'ringing_outgoing'
  | 'ringing_incoming'
  | 'connecting'
  | 'active'
  | 'held'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type CallDirection = 'inbound' | 'outbound';
export type CallMediaType = 'audio' | 'video';
export type CallOrigin = 'direct' | 'conversation' | 'channel' | 'meeting';

export interface CallSession {
  id: string;
  roomId: string;
  tenantId: string;
  workspaceId: string;
  type: '1:1' | 'group';
  mediaType: CallMediaType;
  direction: CallDirection;
  origin: CallOrigin;
  state: CallState;
  callerId: string;
  calleeId?: string;
  callerName?: string;
  calleeName?: string;
  callerAvatar?: string;
  calleeAvatar?: string;
  conversationId?: string;
  channelId?: string;
  participantIds: string[];
  createdAt: string;
  startedAt?: string;
  ringingAt?: string;
  connectedAt?: string;
  endedAt?: string;
  endReason?: string;
  durationSeconds?: number;
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  role: 'caller' | 'callee' | 'participant' | 'host';
  state: 'invited' | 'ringing' | 'connected' | 'held' | 'left' | 'declined' | 'missed';
  joinedAt?: string;
  leftAt?: string;
  createdAt: string;
}

export interface CallHistoryRecord {
  id: string;
  callId: string;
  tenantId?: string;
  eventType: 'outgoing' | 'incoming' | 'accepted' | 'declined' | 'missed' | 'cancelled' | 'connected' | 'held' | 'resumed' | 'reconnecting' | 'completed' | 'failed' | 'timeout';
  userId?: string;
  metadata?: any;
  createdAt: string;
}


export type NotificationType =
  | 'Mention'
  | 'DirectMessage'
  | 'ChannelMessage'
  | 'Invitation'
  | 'TaskAssigned'
  | 'TaskDue'
  | 'Reaction'
  | 'System';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface FileItem {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  fileType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  workspaceId?: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: string[];
  total?: number;
  cursor?: string;
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

export interface SavedItem {
  id: string;
  type: 'message' | 'file' | 'task';
  title: string;
  subtitle: string;
  content?: string;
  createdAt: string;
  data?: any;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  enterSendsMessage: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  language: 'es' | 'en';
}
