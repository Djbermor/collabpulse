export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs
}

export interface Message {
  id: string;
  tenantId: string;
  workspaceId: string;
  channelId?: string;
  conversationId?: string;
  parentId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole?: string;
  content: string;
  type: 'text' | 'file' | 'system' | 'announcement';
  attachments: Attachment[];
  reactions: Reaction[];
  replyCount: number;
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  workspaceId: string;
  type: 'direct' | 'group';
  name?: string;
  participantIds: string[];
  unreadCount: number;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  otherUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    status: 'online' | 'away' | 'dnd' | 'offline';
  };
  updatedAt: string;
}
