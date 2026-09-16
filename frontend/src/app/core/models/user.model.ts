export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

export type UserRole = 'owner' | 'administrator' | 'member' | 'guest';

export interface User {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  statusText?: string;
  timezone: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  about?: string;
  isActive: boolean;
  lastActiveAt?: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}
