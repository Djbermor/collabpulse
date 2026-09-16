export type NotificationType =
  | 'Mention'
  | 'DirectMessage'
  | 'ThreadReply'
  | 'Reaction'
  | 'Task'
  | 'Calendar'
  | 'Meeting'
  | 'System';

export interface NotificationItem {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceType?: 'channel' | 'conversation' | 'task' | 'meeting' | 'calendar';
  resourceId?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface FileItem {
  id: string;
  tenantId: string;
  workspaceId: string;
  channelId?: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedBy: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
