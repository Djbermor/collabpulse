export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  role: string;
  membersCount: number;
  channelsCount: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Channel {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  description?: string;
  topic?: string;
  isPrivate: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  createdBy: string;
  membersCount: number;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}
