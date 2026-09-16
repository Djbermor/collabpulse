export type SystemPermission =
  | 'workspace.read'
  | 'workspace.update'
  | 'channel.create'
  | 'channel.update'
  | 'channel.delete'
  | 'channel.manage_members'
  | 'message.create'
  | 'message.update'
  | 'message.delete'
  | 'message.pin'
  | 'user.read'
  | 'user.invite'
  | 'user.update'
  | 'task.create'
  | 'task.update'
  | 'task.delete'
  | 'calendar.create'
  | 'calendar.update'
  | 'meeting.create'
  | 'meeting.manage'
  | 'admin.access'
  | 'audit.read';

export interface AuditLogItem {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  result: 'Success' | 'Failure';
  details?: string;
  timestamp: string;
}
