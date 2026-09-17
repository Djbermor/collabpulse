import { Router, Response } from 'express';
import { db, ROLE_PERMISSIONS } from '../db';
import { pool } from '../../src/db/index.ts';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { generateSecureToken, hashToken, normalizeEmail, sanitizeText } from '../security';
import { Workspace, Channel, WorkspaceMember, WorkspaceInvitation } from '../../src/types';

export const workspacesRouter = Router();

// List public/accessible tenants
workspacesRouter.get('/tenants', (req, res) => {
  res.json({
    success: true,
    data: db.tenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      domain: t.domain,
      logoUrl: t.logoUrl,
      plan: t.plan
    }))
  });
});

// List workspaces for authenticated tenant
workspacesRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaces = db.workspaces.filter(w => w.tenantId === tenantId);
  res.json({ success: true, data: workspaces });
});

// Create new workspace
workspacesRouter.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, timeZone = 'Europe/Madrid', logoUrl } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'El nombre del workspace es requerido', code: 'INVALID_NAME' });
  }

  const cleanName = sanitizeText(name.trim());
  let baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!baseSlug) baseSlug = `workspace-${Date.now()}`;

  // Ensure unique slug
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (db.workspaces.some(w => w.slug === uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const newWorkspace: Workspace = {
    id: `ws-${Date.now()}`,
    tenantId: req.user!.tenantId,
    name: cleanName,
    slug: uniqueSlug,
    description: sanitizeText(description || ''),
    logoUrl: logoUrl || 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=100&auto=format&fit=crop&q=80',
    ownerId: req.user!.id,
    status: 'Active',
    timeZone,
    language: 'es-ES',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.workspaces.push(newWorkspace);
  await db.persistWorkspace(newWorkspace);

  // Section 8: Add creator as Owner member of this workspace with default roles available
  const member: WorkspaceMember = {
    id: `wm-${Date.now()}`,
    workspaceId: newWorkspace.id,
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    role: 'Owner',
    status: 'Active',
    joinedAt: new Date().toISOString()
  };
  db.workspaceMembers.push(member);
  await db.persistWorkspaceMember(member);

  // Section 7: Default Channel (#general) created automatically, creator becomes member
  const defaultChannel: Channel = {
    id: `ch-gen-${Date.now()}`,
    tenantId: req.user!.tenantId,
    workspaceId: newWorkspace.id,
    name: 'general',
    normalizedName: 'general',
    description: 'Canal general de la organización para anuncios y discusiones de equipo.',
    topic: 'Bienvenida al workspace',
    type: 'public',
    isPrivate: false,
    isArchived: false,
    isPinned: true,
    isMuted: false,
    createdBy: req.user!.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    membersCount: 1,
    unreadCount: 0
  };
  db.channels.push(defaultChannel);
  await db.persistChannel(defaultChannel);
  db.channelMembers.push({
    id: `cm-${Date.now()}`,
    channelId: defaultChannel.id,
    userId: req.user!.id,
    role: 'Owner',
    joinedAt: new Date().toISOString()
  });

  // Outbox event and audit
  db.enqueueOutbox('WorkspaceCreated', { workspace: newWorkspace, defaultChannelId: defaultChannel.id });

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'WORKSPACE_CREATED',
    'Workspace',
    newWorkspace.id,
    req.ip,
    { name: cleanName, slug: uniqueSlug },
    newWorkspace.id
  );

  res.status(201).json({
    success: true,
    data: {
      ...newWorkspace,
      defaultChannel
    }
  });
});

// List members of active workspace (defined first so /members is not captured by /:workspaceId)
workspacesRouter.get('/members', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const tenantId = req.user!.tenantId;
  const searchQuery = (req.query.search as string || req.query.q as string || '').toLowerCase().trim();

  // Filter members belonging to this workspace and tenant
  let members = db.workspaceMembers
    .filter(m => m.workspaceId === workspaceId && m.tenantId === tenantId)
    .map(m => {
      const user = db.users.find(u => u.id === m.userId);
      return {
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          email: user.email,
          userName: user.userName,
          avatarUrl: user.avatarUrl,
          jobTitle: user.jobTitle,
          phone: user.phone,
          status: user.status,
          customStatus: user.customStatus,
          accountStatus: user.accountStatus,
          lastSeenAt: user.lastSeenAt
        } : null,
        permissions: ROLE_PERMISSIONS[m.role] || []
      };
    });

  if (searchQuery) {
    members = members.filter(m =>
      m.user?.displayName?.toLowerCase().includes(searchQuery) ||
      m.user?.userName?.toLowerCase().includes(searchQuery) ||
      m.user?.email?.toLowerCase().includes(searchQuery) ||
      m.user?.jobTitle?.toLowerCase().includes(searchQuery)
    );
  }

  res.json({ success: true, data: members });
});

// List or search users in tenant for DM starting or collaborator lookup
workspacesRouter.get('/users', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const rawQ = (req.query.q as string || req.query.search as string || '').trim();
  const norm = (s: string) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const q = norm(rawQ);

  try {
    const dbRes = await pool.query(
      'SELECT id, user_name as "userName", display_name as "displayName", first_name as "firstName", last_name as "lastName", email, avatar_url as "avatarUrl", job_title as "jobTitle", role, status, custom_status as "customStatus", last_seen_at as "lastSeenAt" FROM users WHERE tenant_id = $1 AND (account_status = $2 OR account_status IS NULL)',
      [tenantId, 'Active']
    );
    if (dbRes.rows.length > 0) {
      for (const row of dbRes.rows) {
        const existing = db.users.find(u => u.id === row.id);
        if (existing) {
          existing.tenantId = tenantId;
          existing.displayName = row.displayName || existing.displayName;
          existing.avatarUrl = row.avatarUrl || existing.avatarUrl;
        } else {
          db.users.push({
            id: row.id,
            tenantId,
            email: row.email,
            normalizedEmail: (row.email || '').toLowerCase(),
            userName: row.userName,
            normalizedUserName: (row.userName || '').toLowerCase(),
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            displayName: row.displayName || row.userName,
            passwordHash: '',
            avatarUrl: row.avatarUrl || '',
            jobTitle: row.jobTitle || '',
            role: row.role || 'Member',
            status: row.status || 'Active',
            customStatus: row.customStatus || '',
            accountStatus: 'Active',
            isActive: true,
            emailVerified: true,
            failedLoginAttempts: 0,
            timeZone: 'UTC',
            lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Workspaces] DB lookup fallback warning:', err.message);
  }

  let matched = db.users.filter(u => u.tenantId === tenantId && u.accountStatus === 'Active');

  if (q) {
    matched = matched.filter(u =>
      norm(u.displayName).includes(q) ||
      norm(u.userName).includes(q) ||
      (u.email && norm(u.email).includes(q)) ||
      (u.firstName && norm(u.firstName).includes(q)) ||
      (u.lastName && norm(u.lastName).includes(q)) ||
      (u.jobTitle && norm(u.jobTitle).includes(q))
    );
  }

  const result = matched.map(u => ({
    id: u.id,
    userName: u.userName,
    displayName: u.displayName,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    jobTitle: u.jobTitle,
    role: u.role,
    status: u.status,
    customStatus: u.customStatus,
    lastSeenAt: u.lastSeenAt
  }));

  res.json({ success: true, data: result });
});

// Section 10-11: List members of workspace with filters and pagination
workspacesRouter.get('/:workspaceId/members', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { workspaceId } = req.params;
  const { search, role, status, cursor, limit = 50 } = req.query;
  const tenantId = req.user!.tenantId;

  // Verify workspace exists and belongs to user's tenant
  const workspace = db.workspaces.find(w => w.id === workspaceId && w.tenantId === tenantId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: 'Workspace no encontrado', code: 'WORKSPACE_NOT_FOUND' });
  }

  // Section 5: If workspace is suspended, restrict access
  if (workspace.status === 'Suspended') {
    return res.status(403).json({
      success: false,
      message: 'Este workspace se encuentra suspendido.',
      code: 'WORKSPACE_SUSPENDED'
    });
  }

  let members = db.workspaceMembers.filter(m => m.workspaceId === workspaceId && m.tenantId === tenantId);

  if (role) {
    members = members.filter(m => m.role === role);
  }
  if (status) {
    members = members.filter(m => m.status === status);
  }

  // Map to detailed profiles
  let detailed = members.map(m => {
    const user = db.users.find(u => u.id === m.userId);
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        phone: user.phone,
        status: user.status, // Presence: Online, Away, DoNotDisturb, Offline
        customStatus: user.customStatus,
        lastSeenAt: user.lastSeenAt
      } : null,
      permissions: ROLE_PERMISSIONS[m.role] || []
    };
  });

  if (search) {
    const query = String(search).toLowerCase();
    detailed = detailed.filter(m =>
      m.user?.displayName?.toLowerCase().includes(query) ||
      m.user?.email?.toLowerCase().includes(query) ||
      m.user?.jobTitle?.toLowerCase().includes(query)
    );
  }

  // Cursor pagination
  let startIndex = 0;
  if (cursor) {
    const foundIdx = detailed.findIndex(d => d.id === cursor);
    if (foundIdx !== -1) startIndex = foundIdx + 1;
  }

  const pageLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const paged = detailed.slice(startIndex, startIndex + pageLimit);
  const nextCursor = paged.length === pageLimit && startIndex + pageLimit < detailed.length
    ? paged[paged.length - 1].id
    : null;

  res.json({
    success: true,
    data: paged,
    pagination: {
      nextCursor,
      total: detailed.length
    }
  });
});


// Invite member to workspace
workspacesRouter.post('/invite', authenticate, requirePermission('members.invite'), (req: AuthenticatedRequest, res: Response) => {
  const { email, role = 'Member' } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Correo electrónico requerido', code: 'MISSING_EMAIL' });
  }

  const normalized = normalizeEmail(email);

  // Check if user is already an active member of this workspace
  const existingUser = db.users.find(u => u.normalizedEmail === normalized || u.email.toLowerCase() === normalized);
  if (existingUser) {
    const isMember = db.workspaceMembers.some(m => m.workspaceId === req.workspace!.id && m.userId === existingUser.id && m.status === 'Active');
    if (isMember) {
      return res.status(409).json({
        success: false,
        message: 'Este usuario ya es un miembro activo del workspace',
        code: 'ALREADY_MEMBER'
      });
    }
  }

  // Check if pending invitation exists
  const existingInv = db.invitations.find(i => i.workspaceId === req.workspace!.id && i.email.toLowerCase() === normalized && i.status === 'Pending');
  if (existingInv && new Date(existingInv.expiresAt).getTime() > Date.now()) {
    return res.status(409).json({
      success: false,
      message: 'Ya existe una invitación pendiente activa para este correo electrónico',
      code: 'INVITATION_EXISTS'
    });
  }

  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);

  const invitation: WorkspaceInvitation = {
    id: `inv-${Date.now()}`,
    tenantId: req.user!.tenantId,
    workspaceId: req.workspace!.id,
    email: normalized,
    role,
    token: rawToken,
    tokenHash,
    status: 'Pending',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdBy: req.user!.id,
    createdAt: new Date().toISOString()
  };

  db.invitations.unshift(invitation);

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'MEMBER_INVITED',
    'WorkspaceInvitation',
    invitation.id,
    req.ip,
    { email: normalized, role, workspaceId: req.workspace!.id },
    req.workspace!.id
  );

  res.status(201).json({
    success: true,
    message: `Invitación generada exitosamente para ${email}`,
    data: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      createdAt: invitation.createdAt
    }
  });
});

// List invitations for active workspace
workspacesRouter.get('/invitations', authenticate, requirePermission('members.invite'), (req: AuthenticatedRequest, res: Response) => {
  const list = db.invitations.filter(i => i.workspaceId === req.workspace!.id && i.tenantId === req.user!.tenantId);
  res.json({ success: true, data: list });
});

// Revoke/cancel invitation
workspacesRouter.delete('/invitations/:id', authenticate, requirePermission('members.invite'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const invitation = db.invitations.find(i => i.id === id && i.workspaceId === req.workspace!.id);

  if (!invitation) {
    return res.status(404).json({ success: false, message: 'Invitación no encontrada', code: 'NOT_FOUND' });
  }

  invitation.status = 'Revoked';

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'INVITATION_REVOKED',
    'WorkspaceInvitation',
    id,
    req.ip,
    { email: invitation.email },
    req.workspace!.id
  );

  res.json({ success: true, message: 'Invitación revocada exitosamente' });
});

// Update member role
workspacesRouter.put('/members/:userId/role', authenticate, requirePermission('members.update_role'), (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['Owner', 'Admin', 'Member', 'Guest'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Rol inválido', code: 'INVALID_ROLE' });
  }

  const member = db.workspaceMembers.find(m => m.workspaceId === req.workspace!.id && m.userId === userId);
  if (!member) {
    return res.status(404).json({ success: false, message: 'Miembro no encontrado en este workspace', code: 'MEMBER_NOT_FOUND' });
  }

  // Prevent demoting the last Owner
  if (member.role === 'Owner' && role !== 'Owner') {
    const ownerCount = db.workspaceMembers.filter(m => m.workspaceId === req.workspace!.id && m.role === 'Owner' && m.status === 'Active').length;
    if (ownerCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'No puede degradar al único Propietario del workspace. Asigne otro Propietario primero.',
        code: 'LAST_OWNER_PROTECTION'
      });
    }
  }

  const oldRole = member.role;
  member.role = role;

  // Also sync on user entity if same tenant
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.role = role;
  }

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'MEMBER_ROLE_UPDATED',
    'WorkspaceMember',
    member.id,
    req.ip,
    { targetUserId: userId, oldRole, newRole: role },
    req.workspace!.id
  );

  res.json({
    success: true,
    message: `Rol actualizado a ${role}`,
    data: { member, permissions: ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] }
  });
});

// Remove member from workspace
workspacesRouter.delete('/members/:userId', authenticate, requirePermission('members.remove'), (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  if (userId === req.user!.id) {
    return res.status(400).json({
      success: false,
      message: 'No puede auto-expulsarse usando esta ruta. Use la opción de abandonar workspace.',
      code: 'CANNOT_REMOVE_SELF'
    });
  }

  const member = db.workspaceMembers.find(m => m.workspaceId === req.workspace!.id && m.userId === userId);
  if (!member) {
    return res.status(404).json({ success: false, message: 'Miembro no encontrado', code: 'MEMBER_NOT_FOUND' });
  }

  // Prevent removing last Owner
  if (member.role === 'Owner') {
    const ownerCount = db.workspaceMembers.filter(m => m.workspaceId === req.workspace!.id && m.role === 'Owner' && m.status === 'Active').length;
    if (ownerCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'No puede eliminar al único Propietario del workspace.',
        code: 'LAST_OWNER_PROTECTION'
      });
    }
  }

  member.status = 'Removed';
  const idx = db.workspaceMembers.indexOf(member);
  if (idx !== -1) {
    db.workspaceMembers.splice(idx, 1);
  }

  // Revoke user sessions in this workspace
  db.sessions = db.sessions.filter(s => !(s.userId === userId && s.workspaceId === req.workspace!.id));

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'MEMBER_REMOVED',
    'WorkspaceMember',
    member.id,
    req.ip,
    { targetUserId: userId },
    req.workspace!.id
  );

  res.json({ success: true, message: 'Miembro removido exitosamente del workspace' });
});
