import { Router, Response } from 'express';
import { db, ROLE_PERMISSIONS } from '../db';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText, hashPassword, normalizeEmail, normalizeUserName, validatePasswordPolicy } from '../security';
import { User, UserRole, WorkspaceMember, FeaturePermissions } from '../../src/types';
import { realtimeHub } from '../realtime';

export const adminRouter = Router();

// Get feature permissions for current tenant
adminRouter.get('/features', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  try {
    const { pool } = await import('../../src/db/index.ts');
    const row = await pool.query('SELECT permissions FROM feature_permissions WHERE tenant_id = $1', [tenantId]);
    if (row.rows.length > 0 && row.rows[0].permissions) {
      const p = typeof row.rows[0].permissions === 'string' ? JSON.parse(row.rows[0].permissions) : row.rows[0].permissions;
      db.featurePermissions.set(tenantId, p);
      return res.json({ success: true, data: p });
    }
  } catch (e) {
    // fallback to memory
  }
  const features = db.getFeaturePermissions(tenantId);
  res.json({ success: true, data: features });
});

// Update feature permissions (Admin / Owner ONLY)
adminRouter.put('/features', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'Admin' && user.role !== 'Owner') {
    return res.status(403).json({
      success: false,
      message: 'Permiso denegado. Solo los administradores pueden modificar los permisos de funcionalidades.',
      code: 'FORBIDDEN'
    });
  }

  const tenantId = user.tenantId;
  const permissions: Partial<FeaturePermissions> = req.body;

  const updated = await db.setFeaturePermissions(tenantId, permissions, user.id);
  db.logAudit(
    tenantId,
    user.id,
    user.displayName,
    'FEATURE_PERMISSIONS_UPDATED',
    'FeaturePermissions',
    `fp-${tenantId}`,
    req.ip,
    updated,
    req.workspace?.id
  );

  realtimeHub.broadcastToTenant(tenantId, 'FeaturePermissionsUpdated', updated);
  res.json({ success: true, data: updated });
});

// Get workspace & tenant statistics
adminRouter.get('/stats', authenticate, requirePermission('workspace.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;

  const tenantUsers = db.users.filter(u => u.tenantId === tenantId && u.accountStatus !== 'Deleted');
  const workspaceMembers = db.workspaceMembers.filter(m => m.workspaceId === workspaceId && m.status === 'Active');
  const tenantChannels = db.channels.filter(c => c.workspaceId === workspaceId && !c.isArchived);
  const tenantMessages = db.messages.filter(m => m.tenantId === tenantId && !m.isDeleted);
  const tenantTasks = db.tasks.filter(t => t.workspaceId === workspaceId);
  const tenantFiles = db.files.filter(f => f.workspaceId === workspaceId);
  const activeSessions = db.sessions.filter(s => s.workspaceId === workspaceId);

  const totalStorage = tenantFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const activeUsers = tenantUsers.filter(u => u.status !== 'Offline').length;

  res.json({
    success: true,
    data: {
      totalUsers: tenantUsers.length,
      workspaceMembersCount: workspaceMembers.length,
      activeUsers,
      totalChannels: tenantChannels.length,
      totalMessages: tenantMessages.length,
      totalTasks: tenantTasks.length,
      completedTasks: tenantTasks.filter(t => t.status === 'Completed').length,
      totalFiles: tenantFiles.length,
      activeSessionsCount: activeSessions.length,
      totalStorageBytes: totalStorage,
      storageFormatted: `${(totalStorage / (1024 * 1024)).toFixed(2)} MB`
    }
  });
});

// Query security audit logs (filtered strictly by tenant & workspace)
adminRouter.get('/audit-logs', authenticate, requirePermission('audit.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;
  const { action, userId, entity, limit = 100, page = 1 } = req.query;

  let logs = db.auditLogs.filter(l => l.tenantId === tenantId);

  if (action) {
    logs = logs.filter(l => l.action.toLowerCase() === String(action).toLowerCase());
  }
  if (userId) {
    logs = logs.filter(l => l.userId === userId);
  }
  if (entity) {
    logs = logs.filter(l => l.entity.toLowerCase() === String(entity).toLowerCase());
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  const paginated = logs.slice(offset, offset + limitNum);

  res.json({
    success: true,
    data: paginated,
    pagination: {
      total: logs.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(logs.length / limitNum)
    }
  });
});

// Update workspace settings
adminRouter.put('/settings', authenticate, requirePermission('settings.manage'), (req: AuthenticatedRequest, res: Response) => {
  const ws = req.workspace!;
  const { name, description, timeZone, language } = req.body;

  if (name) ws.name = sanitizeText(name);
  if (description !== undefined) ws.description = sanitizeText(description);
  if (timeZone) ws.timeZone = timeZone;
  if (language) ws.language = language;

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'SETTINGS_UPDATED',
    'WorkspaceSettings',
    ws.id,
    req.ip,
    { name: ws.name, timeZone: ws.timeZone, language: ws.language },
    ws.id
  );

  res.json({ success: true, data: ws });
});

// Helper to find a user by user.id OR workspaceMember.id
function findTenantUser(id: string, tenantId?: string): User | undefined {
  let user = db.users.find(u => u.id === id);
  if (!user) {
    const wm = db.workspaceMembers.find(m => m.id === id);
    if (wm) {
      user = db.users.find(u => u.id === wm.userId);
    }
  }
  return user;
}

// Get all users for admin management (includes organizations per user and lifecycle status)
adminRouter.get('/users', authenticate, requirePermission('workspace.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace?.id || db.workspaces[0]?.id || '';
  const statusFilter = ((req.query.status as string) || '').trim().toUpperCase();

  const members = db.workspaceMembers.filter(m => m.workspaceId === workspaceId);
  const memberMap = new Map(members.map(m => [m.userId, m]));

  // Global enterprise user listing for Admin/Owner, or filtered by status
  let userList = db.users.filter(u => u.accountStatus !== 'Deleted');
  if (statusFilter) {
    userList = userList.filter(u => (u.accountStatus || '').toUpperCase() === statusFilter);
  }

  const users = userList.map(u => {
    const wm = memberMap.get(u.id);

    // Get organizations this user belongs to
    const userOrgs = db.organizationMembers
      .filter(m => m.userId === u.id && ((m.status || '').toUpperCase() === 'ACTIVE'))
      .map(m => {
        const org = db.organizations.find(o => o.id === m.organizationId);
        return {
          id: m.organizationId,
          name: org?.name || 'Organización',
          slug: org?.slug || '',
          role: m.role,
          status: m.status
        };
      });

    // Backwards compatibility fallback if no explicit organization_member row yet
    if (userOrgs.length === 0 && u.tenantId) {
      const fallbackOrg = db.organizations.find(o => o.id === u.tenantId);
      if (fallbackOrg) {
        userOrgs.push({
          id: fallbackOrg.id,
          name: fallbackOrg.name,
          slug: fallbackOrg.slug,
          role: u.role || 'Member',
          status: 'Active'
        });
      }
    }

    return {
      id: u.id,
      memberId: wm?.id,
      workspaceId,
      tenantId: u.tenantId || tenantId,
      email: u.email,
      userName: u.userName,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.userName,
      role: wm?.role || u.role,
      jobTitle: u.jobTitle || 'Especialista',
      avatarUrl: u.avatarUrl,
      status: u.status,
      accountStatus: u.accountStatus || (u.isActive ? 'ACTIVE' : 'INACTIVE'),
      isActive: u.isActive !== false && ((u.accountStatus || '').toUpperCase() === 'ACTIVE' || u.accountStatus === 'Active'),
      organizations: userOrgs,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      joinedAt: wm?.joinedAt || u.createdAt
    };
  });

  res.json({
    success: true,
    data: users
  });
});

// Update user account status (ACTIVE / INACTIVE / PENDING_ACTIVATION / Suspended)
const handleStatusUpdate = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { accountStatus, status, isActive } = req.body;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace?.id || db.workspaces[0]?.id || '';

  const target = findTenantUser(id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
  }

  if (target.id === req.user!.id) {
    return res.status(400).json({ success: false, message: 'No puede modificar el estado de su propia cuenta', code: 'CANNOT_MODIFY_SELF' });
  }

  let resolvedStatus = accountStatus || status;
  if (!resolvedStatus && typeof isActive === 'boolean') {
    resolvedStatus = isActive ? 'ACTIVE' : 'INACTIVE';
  }

  const upper = (resolvedStatus || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'].includes(upper)) {
    return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
  }

  const oldStatus = target.accountStatus;
  target.accountStatus = upper as any;
  target.isActive = upper === 'ACTIVE';
  target.updatedAt = new Date().toISOString();

  // If suspended or inactive, revoke all active sessions immediately
  if (upper === 'SUSPENDED' || upper === 'INACTIVE' || upper === 'PENDING_ACTIVATION') {
    db.sessions = db.sessions.filter(s => s.userId !== target.id);
  }

  const wm = db.workspaceMembers.find(m => m.userId === target.id && m.workspaceId === workspaceId);
  if (wm) {
    wm.status = upper === 'ACTIVE' ? 'Active' : 'Suspended';
    await db.persistWorkspaceMemberUpdate(workspaceId, target.id, { status: wm.status });
  }

  await db.persistUserUpdate(target.id, {
    accountStatus: target.accountStatus,
    isActive: target.isActive
  });

  db.logAudit(
    tenantId,
    req.user!.id,
    req.user!.displayName,
    'USER_STATUS_CHANGED',
    'User',
    target.id,
    req.ip,
    { targetEmail: target.email, oldStatus, newStatus: upper },
    workspaceId
  );

  res.json({
    success: true,
    message: `Estado de usuario actualizado a ${upper}`,
    data: target
  });
};

adminRouter.put('/users/:id/status', authenticate, requirePermission('members.update_role'), handleStatusUpdate);
adminRouter.patch('/users/:id/status', authenticate, requirePermission('members.update_role'), handleStatusUpdate);

// Update user role
adminRouter.put('/users/:id/role', authenticate, requirePermission('members.update_role'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;

  if (!role || !['Owner', 'Admin', 'Member', 'Guest'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Rol inválido', code: 'INVALID_ROLE' });
  }

  const target = findTenantUser(id, tenantId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
  }

  target.role = role as UserRole;
  target.updatedAt = new Date().toISOString();

  const wm = db.workspaceMembers.find(m => m.userId === target.id && m.workspaceId === workspaceId);
  if (wm) {
    wm.role = role as UserRole;
    await db.persistWorkspaceMemberUpdate(workspaceId, target.id, { role: role as UserRole });
  }
  await db.persistUserUpdate(target.id, { role: role as UserRole });

  db.logAudit(
    tenantId,
    req.user!.id,
    req.user!.displayName,
    'USER_ROLE_CHANGED',
    'User',
    target.id,
    req.ip,
    { newRole: role, targetEmail: target.email },
    workspaceId
  );

  res.json({
    success: true,
    message: `Rol actualizado a ${role}`,
    data: target
  });
});

// Security Overview
adminRouter.get('/security/overview', authenticate, requirePermission('audit.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;

  const tenantUsers = db.users.filter(u => u.tenantId === tenantId);
  const activeSessions = db.sessions.filter(s => s.tenantId === tenantId);
  const recentAudit = db.auditLogs.filter(l => l.tenantId === tenantId).slice(0, 10);
  const suspendedUsers = tenantUsers.filter(u => u.accountStatus === 'Suspended').length;

  res.json({
    success: true,
    data: {
      totalMembers: tenantUsers.length,
      activeSessions: activeSessions.length,
      suspendedAccounts: suspendedUsers,
      recentSecurityEvents: recentAudit,
      securityPolicies: {
        passwordMinLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        sessionExpiryDays: 7,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15
      }
    }
  });
});

// Admin: Create User
adminRouter.post('/users', authenticate, requirePermission('members.invite'), async (req: AuthenticatedRequest, res: Response) => {
  const { email, firstName, lastName, role = 'Member', jobTitle, password, accountStatus, organizationId } = req.body;
  const tenantId = req.user!.tenantId;
  const workspace = req.workspace || db.workspaces[0];

  if (!email || !firstName || !lastName || !password) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos requeridos deben completarse (nombre, apellido, email, contraseña)'
    });
  }

  const normalized = normalizeEmail(email);
  const existing = db.users.find(u => u.normalizedEmail === normalized);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un usuario registrado con este correo electrónico en la plataforma'
    });
  }

  const passVal = validatePasswordPolicy(password);
  if (!passVal.isValid) {
    return res.status(400).json({
      success: false,
      message: passVal.errors[0] || 'Contraseña no cumple con los requisitos de seguridad'
    });
  }

  const cleanFirstName = sanitizeText(firstName);
  const cleanLastName = sanitizeText(lastName);
  const cleanJobTitle = sanitizeText(jobTitle || 'Especialista');
  const normalizedUser = normalizeUserName(normalized.split('@')[0]);

  const rawStatus = (accountStatus || 'ACTIVE').toUpperCase();
  const finalAccountStatus = ['ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION'].includes(rawStatus) ? rawStatus : 'ACTIVE';
  const finalIsActive = finalAccountStatus === 'ACTIVE';

  const newUser: User = {
    id: `usr-${Date.now()}`,
    tenantId: organizationId || tenantId,
    email: normalized,
    normalizedEmail: normalized,
    userName: normalizedUser,
    normalizedUserName: normalizedUser,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    displayName: `${cleanFirstName} ${cleanLastName}`,
    passwordHash: hashPassword(password),
    role: role as UserRole,
    avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    jobTitle: cleanJobTitle,
    timeZone: 'Europe/Madrid',
    status: 'Offline',
    accountStatus: finalAccountStatus as any,
    emailVerified: true,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    isActive: finalIsActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  await db.persistUser(newUser);

  // If organizationId provided, link collaborator to that organization
  if (organizationId) {
    const org = db.organizations.find(o => o.id === organizationId);
    if (org && org.status !== 'INACTIVE' && org.status !== 'Inactive') {
      const om = {
        id: `om-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        organizationId,
        userId: newUser.id,
        role: role as any,
        status: 'Active' as const,
        joinedAt: new Date().toISOString(),
        createdBy: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.organizationMembers.push(om);
      await db.persistOrganizationMember(om);
    }
  }

  // Add workspace member if workspace exists
  if (workspace) {
    const member: WorkspaceMember = {
      id: `wm-${Date.now()}`,
      workspaceId: workspace.id,
      tenantId: newUser.tenantId,
      userId: newUser.id,
      role: newUser.role,
      status: finalIsActive ? 'Active' : 'Suspended',
      joinedAt: new Date().toISOString()
    };
    db.workspaceMembers.push(member);
    await db.persistWorkspaceMember(member);
  }

  // Join public channels
  db.channels
    .filter(c => c.workspaceId === workspace.id && !c.isPrivate)
    .forEach(async c => {
      db.channelMembers.push({ channelId: c.id, userId: newUser.id, joinedAt: new Date().toISOString() });
      c.membersCount = (c.membersCount || 0) + 1;
      await db.persistChannelMember(c.id, newUser.id, workspace.id, 'Member');
    });

  db.logAudit(
    tenantId,
    req.user!.id,
    req.user!.displayName,
    'USER_CREATED_BY_ADMIN',
    'User',
    newUser.id,
    req.ip,
    { email: newUser.email, role: newUser.role },
    workspace.id
  );

  res.status(201).json({
    success: true,
    message: 'Usuario creado y registrado exitosamente en la organización',
    data: newUser
  });
});

// Admin: Update User
adminRouter.put('/users/:id', authenticate, requirePermission('members.update_role'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, jobTitle, role, email, accountStatus, isActive } = req.body;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;

  const target = findTenantUser(id, tenantId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  if (firstName) target.firstName = sanitizeText(firstName);
  if (lastName) target.lastName = sanitizeText(lastName);
  if (firstName || lastName) target.displayName = `${target.firstName} ${target.lastName}`;
  if (jobTitle !== undefined) target.jobTitle = sanitizeText(jobTitle);

  if (role && ['Owner', 'Admin', 'Member', 'Guest'].includes(role)) {
    target.role = role as UserRole;
    const wm = db.workspaceMembers.find(m => m.userId === target.id && m.tenantId === tenantId);
    if (wm) {
      wm.role = role as UserRole;
      await db.persistWorkspaceMemberUpdate(workspaceId, target.id, { role: role as UserRole });
    }
  }

  if (accountStatus && ['Active', 'Suspended', 'Inactive'].includes(accountStatus)) {
    target.accountStatus = accountStatus;
    target.isActive = accountStatus === 'Active';
    if (accountStatus !== 'Active') {
      db.sessions = db.sessions.filter(s => s.userId !== target.id);
    }
  } else if (typeof isActive === 'boolean') {
    target.isActive = isActive;
    target.accountStatus = isActive ? 'Active' : 'Inactive';
    if (!isActive) {
      db.sessions = db.sessions.filter(s => s.userId !== target.id);
    }
  }

  if (email) {
    const normalized = normalizeEmail(email);
    const existingOther = db.users.find(u => u.tenantId === tenantId && u.normalizedEmail === normalized && u.id !== target.id);
    if (existingOther) {
      return res.status(409).json({ success: false, message: 'El correo electrónico ya está en uso por otro usuario' });
    }
    target.email = normalized;
    target.normalizedEmail = normalized;
  }

  target.updatedAt = new Date().toISOString();

  await db.persistUserUpdate(target.id, {
    firstName: target.firstName,
    lastName: target.lastName,
    displayName: target.displayName,
    jobTitle: target.jobTitle,
    role: target.role,
    email: target.email,
    normalizedEmail: target.normalizedEmail,
    accountStatus: target.accountStatus,
    isActive: target.isActive
  });

  db.logAudit(
    tenantId,
    req.user!.id,
    req.user!.displayName,
    'USER_UPDATED_BY_ADMIN',
    'User',
    target.id,
    req.ip,
    { updatedFields: req.body },
    workspaceId
  );

  res.json({
    success: true,
    message: 'Datos del usuario actualizados correctamente',
    data: target
  });
});

// Admin: Delete User
adminRouter.delete('/users/:id', authenticate, requirePermission('members.remove'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;

  const target = findTenantUser(id, tenantId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  if (target.id === req.user!.id) {
    return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta de administrador' });
  }

  // Remove sessions and workspace membership
  db.sessions = db.sessions.filter(s => s.userId !== target.id);
  db.workspaceMembers = db.workspaceMembers.filter(m => m.userId !== target.id);
  db.channelMembers = db.channelMembers.filter(cm => cm.userId !== target.id);
  target.accountStatus = 'INACTIVE';
  target.isActive = false;
  target.deletedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();

  await db.persistUserUpdate(target.id, {
    accountStatus: 'INACTIVE',
    isActive: false
  });

  await db.persistWorkspaceMemberUpdate(workspaceId, target.id, {
    status: 'Removed'
  });

  db.logAudit(
    tenantId,
    req.user!.id,
    req.user!.displayName,
    'USER_DELETED_BY_ADMIN',
    'User',
    target.id,
    req.ip,
    { deletedEmail: target.email },
    workspaceId
  );

  res.json({
    success: true,
    message: `Usuario ${target.email} ha sido dado de baja de la organización`
  });
});

// Admin: Get User Details
adminRouter.get('/users/:id', authenticate, requirePermission('workspace.read'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const target = findTenantUser(id, tenantId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  const activeSessions = db.sessions.filter(s => s.userId === target.id);
  const permissions = ROLE_PERMISSIONS[target.role] || [];

  res.json({
    success: true,
    data: {
      ...target,
      activeSessionsCount: activeSessions.length,
      sessions: activeSessions,
      permissions
    }
  });
});

// Admin: Assign Collaborator to Organization
adminRouter.post('/users/:id/organizations', authenticate, requirePermission('members.invite'), async (req: AuthenticatedRequest, res: Response) => {
  const { id: userId } = req.params;
  const { organizationId, role = 'Member' } = req.body;

  if (!organizationId) {
    return res.status(400).json({ success: false, message: 'organizationId es requerido' });
  }

  const org = db.organizations.find(o => o.id === organizationId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  if (org.status === 'INACTIVE' || org.status === 'Inactive') {
    return res.status(400).json({
      success: false,
      message: 'No se pueden asignar colaboradores a una organización inactiva',
      code: 'ORGANIZATION_INACTIVE'
    });
  }

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  const existingMember = db.organizationMembers.find(m => m.organizationId === organizationId && m.userId === userId);
  const now = new Date().toISOString();

  if (existingMember) {
    if (existingMember.status === 'Active' || existingMember.status === 'ACTIVE') {
      return res.status(409).json({ success: false, message: 'El usuario ya pertenece a esta organización' });
    }
    existingMember.status = 'Active';
    existingMember.role = role;
    existingMember.deactivatedAt = undefined;
    existingMember.deactivatedBy = undefined;
    existingMember.updatedAt = now;
    await db.persistOrganizationMember(existingMember);
    return res.json({ success: true, message: 'Membresía reactivada exitosamente', data: existingMember });
  }

  const newMember = {
    id: `om-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    organizationId,
    userId,
    role,
    status: 'Active' as const,
    joinedAt: now,
    createdBy: req.user!.id,
    createdAt: now,
    updatedAt: now
  };

  db.organizationMembers.push(newMember);
  await db.persistOrganizationMember(newMember);

  return res.status(201).json({
    success: true,
    message: 'Colaborador asignado a la organización exitosamente',
    data: newMember
  });
});

// Admin: Soft-Deactivate Collaborator from Organization (ZERO HARD DELETE)
adminRouter.delete('/users/:id/organizations/:orgId', authenticate, requirePermission('members.remove'), async (req: AuthenticatedRequest, res: Response) => {
  const { id: userId, orgId } = req.params;

  const org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  await db.removeOrganizationMember(orgId, userId, req.user!.id);

  return res.json({
    success: true,
    message: 'Colaborador desvinculado de la organización exitosamente'
  });
});
