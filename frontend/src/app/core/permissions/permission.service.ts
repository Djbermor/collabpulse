import { Injectable, computed } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SystemPermission } from '../models/permission.model';
import { UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  // Static Role-to-Permissions Mapping
  private readonly rolePermissions: Record<UserRole, SystemPermission[]> = {
    owner: [
      'workspace.read', 'workspace.update',
      'channel.create', 'channel.update', 'channel.delete', 'channel.manage_members',
      'message.create', 'message.update', 'message.delete', 'message.pin',
      'user.read', 'user.invite', 'user.update',
      'task.create', 'task.update', 'task.delete',
      'calendar.create', 'calendar.update',
      'meeting.create', 'meeting.manage',
      'admin.access', 'audit.read'
    ],
    administrator: [
      'workspace.read', 'workspace.update',
      'channel.create', 'channel.update', 'channel.delete', 'channel.manage_members',
      'message.create', 'message.update', 'message.delete', 'message.pin',
      'user.read', 'user.invite', 'user.update',
      'task.create', 'task.update', 'task.delete',
      'calendar.create', 'calendar.update',
      'meeting.create', 'meeting.manage',
      'admin.access', 'audit.read'
    ],
    member: [
      'workspace.read',
      'channel.create',
      'message.create', 'message.update', 'message.pin',
      'user.read',
      'task.create', 'task.update',
      'calendar.create',
      'meeting.create'
    ],
    guest: [
      'workspace.read',
      'message.create'
    ]
  };

  public readonly currentRole = computed(() => {
    const user = this.authService.currentUser();
    return (user?.role || 'member') as UserRole;
  });

  public readonly grantedPermissions = computed(() => {
    const role = this.currentRole();
    return this.rolePermissions[role] || [];
  });

  constructor(private authService: AuthService) {}

  public hasPermission(permission: SystemPermission): boolean {
    return this.grantedPermissions().includes(permission);
  }

  public hasAnyPermission(permissions: SystemPermission[]): boolean {
    const granted = this.grantedPermissions();
    return permissions.some(p => granted.includes(p));
  }

  public hasRole(requiredRole: UserRole): boolean {
    return this.currentRole() === requiredRole;
  }

  public isAdminOrOwner(): boolean {
    const role = this.currentRole();
    return role === 'owner' || role === 'administrator';
  }
}
