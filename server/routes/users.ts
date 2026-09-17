import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware';

export const usersRouter = Router();

/**
 * GET /api/v1/users/search?q=...
 * Global Collaborator Directory Search
 * 
 * Rules:
 * - Searches across all collaborators in Nexora regardless of organization_id.
 * - Matches by firstName, lastName, displayName, email, jobTitle.
 * - Returns ONLY users with ACTIVE account status.
 * - Strictly excludes INACTIVE, PENDING_ACTIVATION, Deleted, Suspended accounts.
 * - Exposes only public safe fields + the organizations they belong to.
 */
usersRouter.get('/search', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();

  // Normalize query removing diacritics
  const normalizeStr = (str: string = '') =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const term = normalizeStr(q);

  // Active users only (no INACTIVE, no PENDING_ACTIVATION, no Deleted, no Suspended)
  const activeUsers = db.users.filter(u => {
    const status = (u.accountStatus || '').toUpperCase();
    return (status === 'ACTIVE') && u.isActive !== false;
  });

  const matched = term
    ? activeUsers.filter(u => {
        const full = normalizeStr(`${u.firstName || ''} ${u.lastName || ''} ${u.displayName || ''}`);
        const email = normalizeStr(u.email || '');
        const job = normalizeStr(u.jobTitle || '');
        const username = normalizeStr(u.userName || '');
        return full.includes(term) || email.includes(term) || job.includes(term) || username.includes(term);
      })
    : activeUsers;

  // Map to safe public fields with public organizations
  const results = matched.map(u => {
    // Find active memberships for this user
    const userMemberships = db.organizationMembers.filter(
      m => m.userId === u.id && ((m.status || '').toUpperCase() === 'ACTIVE')
    );

    const orgIds = new Set(userMemberships.map(m => m.organizationId));
    if (u.tenantId) {
      orgIds.add(u.tenantId);
    }

    const publicOrganizations = db.organizations
      .filter(o => orgIds.has(o.id) && ((o.status || '').toUpperCase() === 'ACTIVE'))
      .map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        logoUrl: o.logoUrl || ''
      }));

    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.userName,
      email: u.email,
      jobTitle: u.jobTitle || 'Colaborador',
      avatarUrl: u.avatarUrl || '',
      status: u.status || 'Offline',
      accountStatus: 'ACTIVE',
      organizations: publicOrganizations
    };
  });

  return res.json({
    success: true,
    data: results,
    count: results.length
  });
});

/**
 * GET /api/v1/users/:id
 * Retrieve public profile for a specific collaborator
 */
usersRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = db.users.find(u => u.id === id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Colaborador no encontrado' });
  }

  const userMemberships = db.organizationMembers.filter(
    m => m.userId === user.id && ((m.status || '').toUpperCase() === 'ACTIVE')
  );

  const orgIds = new Set(userMemberships.map(m => m.organizationId));
  if (user.tenantId) {
    orgIds.add(user.tenantId);
  }

  const publicOrganizations = db.organizations
    .filter(o => orgIds.has(o.id) && ((o.status || '').toUpperCase() === 'ACTIVE'))
    .map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logoUrl: o.logoUrl || ''
    }));

  return res.json({
    success: true,
    data: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.userName,
      email: user.email,
      jobTitle: user.jobTitle || 'Colaborador',
      avatarUrl: user.avatarUrl || '',
      status: user.status || 'Offline',
      accountStatus: user.accountStatus,
      organizations: publicOrganizations
    }
  });
});
