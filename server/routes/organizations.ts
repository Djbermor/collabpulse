import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';
import { Organization, OrganizationDomain, OrganizationMember } from '../../src/types';
import { pool } from '../../src/db/index';

export const organizationsRouter = Router();

/**
 * GET /api/v1/organizations/lookup/by-domain?domain=company.com
 * Public/Registration lookup for domain-based organization routing
 */
organizationsRouter.get('/lookup/by-domain', async (req, res) => {
  const domainQuery = ((req.query.domain as string) || '').trim().toLowerCase();
  if (!domainQuery) {
    return res.status(400).json({ success: false, message: 'El parámetro domain es requerido' });
  }

  try {
    const domainRecord = db.organizationDomains.find(d => d.domain.toLowerCase() === domainQuery && d.isVerified);
    if (!domainRecord) {
      return res.json({ success: true, data: { exists: false } });
    }

    const org = db.organizations.find(o => o.id === domainRecord.organizationId);
    if (!org) {
      return res.json({ success: true, data: { exists: false } });
    }

    const settings = db.organizationSettings.find(s => s.organizationId === org.id) || {
      allowAutoJoin: false,
      requireApproval: true,
      allowExternalGuests: false
    };

    return res.json({
      success: true,
      data: {
        exists: true,
        organizationId: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        policy: {
          allowAutoJoin: settings.allowAutoJoin,
          requireApproval: settings.requireApproval,
          allowExternalGuests: settings.allowExternalGuests
        }
      }
    });
  } catch (error: any) {
    console.error('[Organizations] lookup error:', error);
    return res.status(500).json({ success: false, message: 'Error consultando dominio' });
  }
});

/**
 * GET /api/v1/organizations
 * Returns organizations where authenticated user is a member
 */
organizationsRouter.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const returnAll = req.query.all === 'true' && (userRole === 'Admin' || userRole === 'Owner');

  try {
    // 1. Get memberships for this user
    const memberships = db.organizationMembers.filter(m => m.userId === userId && (m.status === 'Active' || m.status === 'ACTIVE'));
    const userOrgIds = new Set(memberships.map(m => m.organizationId));

    // Also include user's tenantId if not already in memberships (backward compatibility)
    if (req.user!.tenantId) {
      userOrgIds.add(req.user!.tenantId);
    }

    // 2. Fetch organization details
    const orgsToList = returnAll ? db.organizations : db.organizations.filter(o => userOrgIds.has(o.id));

    const result = orgsToList.map(o => {
      const mem = memberships.find(m => m.organizationId === o.id);
      const domains = db.organizationDomains.filter(d => d.organizationId === o.id);
      const allMembers = db.organizationMembers.filter(m => m.organizationId === o.id);
      const activeMembers = allMembers.filter(m => m.status === 'Active' || m.status === 'ACTIVE');
      return {
        ...o,
        role: mem ? mem.role : (userRole || 'Member'),
        memberCount: activeMembers.length,
        activeMemberCount: activeMembers.length,
        totalMemberCount: allMembers.length,
        domains: domains.map(d => ({ id: d.id, domain: d.domain, isPrimary: d.isPrimary, isVerified: d.isVerified }))
      };
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Organizations] list error:', error);
    return res.status(500).json({ success: false, message: 'Error listando organizaciones' });
  }
});

/**
 * POST /api/v1/organizations
 * Create a new Organization
 */
organizationsRouter.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { name, slug, type = 'Enterprise', industry = 'Technology', primaryDomain, logoUrl, settings } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'El nombre de la organización es requerido' });
  }

  const cleanName = sanitizeText(name);
  let cleanSlug = (slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();
  if (!cleanSlug) cleanSlug = `org-${Date.now()}`;

  // Check unique slug
  if (db.organizations.some(o => o.slug === cleanSlug)) {
    cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const orgId = `org-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const domainStr = (primaryDomain || `${cleanSlug}.local`).trim().toLowerCase();

  const newOrg: Organization = {
    id: orgId,
    name: cleanName,
    slug: cleanSlug,
    type: type || 'Enterprise',
    industry: industry || 'Technology',
    logoUrl: logoUrl || 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=100&auto=format&fit=crop&q=80',
    primaryDomain: domainStr,
    status: 'Active',
    settings: settings || {},
    createdBy: user.id,
    createdAt: now,
    updatedAt: now
  };

  try {
    // 1. Persist Organization
    db.organizations.push(newOrg);
    await db.persistOrganization(newOrg);

    // 2. Persist Primary Domain
    const domainRecord: OrganizationDomain = {
      id: `dom-${Date.now().toString(36)}`,
      organizationId: orgId,
      domain: domainStr,
      isPrimary: true,
      isVerified: true,
      createdAt: now
    };
    db.organizationDomains.push(domainRecord);
    await db.persistOrganizationDomain(domainRecord);

    // 3. Persist Owner Membership
    const memberRecord: OrganizationMember = {
      id: `om-${Date.now().toString(36)}`,
      organizationId: orgId,
      userId: user.id,
      role: 'Owner',
      status: 'Active',
      joinedAt: now
    };
    db.organizationMembers.push(memberRecord);
    await db.persistOrganizationMember(memberRecord);

    // 4. Create Initial Default Workspace for this Organization
    const wsId = `ws-${Date.now().toString(36)}`;
    const newWs = {
      id: wsId,
      tenantId: orgId,
      name: `${cleanName} - Principal`,
      slug: 'principal',
      description: `Espacio de trabajo principal de ${cleanName}`,
      logoUrl: newOrg.logoUrl,
      ownerId: user.id,
      status: 'Active' as const,
      timeZone: 'Europe/Madrid',
      language: 'es-ES',
      createdAt: now,
      updatedAt: now
    };
    db.workspaces.push(newWs as any);
    await db.persistWorkspace(newWs as any);

    // 5. Add user to workspace
    const wsMember = {
      id: `wm-${Date.now().toString(36)}`,
      workspaceId: wsId,
      tenantId: orgId,
      userId: user.id,
      role: 'Owner' as const,
      status: 'Active' as const,
      joinedAt: now
    };
    db.workspaceMembers.push(wsMember);
    await db.persistWorkspaceMember(wsMember);

    // 6. Create Default Public Channels (#general, #random)
    const chGeneralId = `ch-gen-${Date.now().toString(36)}`;
    const chGeneral = {
      id: chGeneralId,
      workspaceId: wsId,
      tenantId: orgId,
      name: 'general',
      description: 'Canal general de la organización.',
      type: 'public' as const,
      isPrivate: false,
      isArchived: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now
    };
    db.channels.push(chGeneral as any);
    await db.persistChannel(chGeneral as any);

    const chRandomId = `ch-rnd-${Date.now().toString(36)}`;
    const chRandom = {
      id: chRandomId,
      workspaceId: wsId,
      tenantId: orgId,
      name: 'random',
      description: 'Canal para temas variados y descanso del equipo.',
      type: 'public' as const,
      isPrivate: false,
      isArchived: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now
    };
    db.channels.push(chRandom as any);
    await db.persistChannel(chRandom as any);

    // Member joins general and random
    await db.persistChannelMember(chGeneralId, user.id, wsId, 'Admin');
    await db.persistChannelMember(chRandomId, user.id, wsId, 'Admin');

    // 7. Audit log
    db.logAudit(
      orgId,
      user.id,
      user.displayName || user.email,
      'ORGANIZATION_CREATED',
      'Organization',
      orgId,
      req.ip,
      { name: cleanName, slug: cleanSlug, domain: domainStr },
      wsId
    );

    return res.status(201).json({
      success: true,
      message: 'Organización creada exitosamente',
      data: {
        ...newOrg,
        role: 'Owner',
        domains: [domainRecord]
      }
    });
  } catch (error: any) {
    console.error('[Organizations] create error:', error);
    return res.status(500).json({ success: false, message: 'Error creando organización: ' + error.message });
  }
});

/**
 * GET /api/v1/organizations/:id
 * Retrieve details of a specific organization
 */
organizationsRouter.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orgId = req.params.id;

  const membership = db.organizationMembers.find(m => m.organizationId === orgId && m.userId === userId);
  if (!membership && req.user!.tenantId !== orgId) {
    return res.status(403).json({ success: false, message: 'No tiene acceso a esta organización' });
  }

  const org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  const domains = db.organizationDomains.filter(d => d.organizationId === orgId);
  const settings = db.organizationSettings.find(s => s.organizationId === orgId);

  return res.json({
    success: true,
    data: {
      ...org,
      role: membership ? membership.role : req.user!.role,
      domains,
      settings
    }
  });
});

/**
 * PATCH /api/v1/organizations/:id
 * Update organization details
 */
organizationsRouter.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orgId = req.params.id;

  const membership = db.organizationMembers.find(m => m.organizationId === orgId && m.userId === userId);
  if ((!membership || (membership.role !== 'Owner' && membership.role !== 'Admin')) && req.user!.role !== 'Owner') {
    return res.status(403).json({ success: false, message: 'Permisos insuficientes para editar la organización' });
  }

  const org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  const { name, industry, logoUrl, primaryDomain, settings, status } = req.body;
  if (name) org.name = sanitizeText(name);
  if (industry) org.industry = sanitizeText(industry);
  if (logoUrl !== undefined) org.logoUrl = logoUrl;
  if (primaryDomain) org.primaryDomain = primaryDomain.trim().toLowerCase();
  if (settings) org.settings = settings;
  if (status) {
    if (status === 'INACTIVE' || status === 'Inactive') {
      org.status = 'INACTIVE';
      org.deactivatedAt = new Date().toISOString();
      org.deactivatedBy = userId;
    } else if (status === 'Active' || status === 'ACTIVE') {
      org.status = 'Active';
      org.deactivatedAt = undefined;
      org.deactivatedBy = undefined;
    }
  }
  org.updatedAt = new Date().toISOString();

  await db.persistOrganization(org);

  return res.json({ success: true, message: 'Organización actualizada exitosamente', data: org });
});

/**
 * DELETE /api/v1/organizations/:id
 * Soft-delete (deactivate) an organization (Zero Hard Delete)
 */
organizationsRouter.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orgId = req.params.id;

  let org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    try {
      const orgRes = await pool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
      if (orgRes.rows.length > 0) {
        const row = orgRes.rows[0];
        org = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: row.type || 'Enterprise',
          industry: row.industry || 'Technology',
          status: row.status,
          isActive: (row.status === 'Active' || row.status === 'ACTIVE'),
          settings: row.settings || '{}',
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        };
        db.organizations.push(org);
      }
    } catch {}
  }

  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  org.status = 'INACTIVE';
  org.isActive = false;
  org.deactivatedAt = new Date().toISOString();
  org.deactivatedBy = userId;
  org.updatedAt = new Date().toISOString();

  await db.persistOrganization(org);
  try {
    await pool.query("UPDATE organizations SET status = 'INACTIVE', is_active = false, updated_at = NOW() WHERE id = $1", [orgId]);
  } catch {}

  db.logAudit(
    orgId,
    userId,
    req.user!.displayName || req.user!.email,
    'ORGANIZATION_DEACTIVATED',
    'Organization',
    orgId,
    req.ip,
    { reason: 'Soft-deleted by admin' }
  );

  return res.json({ success: true, message: 'Organización desactivada exitosamente (Zero Hard Delete)', data: org });
});

/**
 * POST /api/v1/organizations/:id/domains
 * Add a domain to an organization
 */
organizationsRouter.post('/:id/domains', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orgId = req.params.id;
  const { domain, isPrimary = false } = req.body;

  if (!domain || !domain.trim()) {
    return res.status(400).json({ success: false, message: 'El dominio es requerido' });
  }

  const membership = db.organizationMembers.find(m => m.organizationId === orgId && m.userId === userId);
  if ((!membership || (membership.role !== 'Owner' && membership.role !== 'Admin')) && req.user!.role !== 'Owner') {
    return res.status(403).json({ success: false, message: 'Permisos insuficientes para administrar dominios' });
  }

  const cleanDomain = domain.trim().toLowerCase();
  const existing = db.organizationDomains.find(d => d.organizationId === orgId && d.domain === cleanDomain);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Este dominio ya está registrado en la organización' });
  }

  const newDomain: OrganizationDomain = {
    id: `dom-${Date.now().toString(36)}`,
    organizationId: orgId,
    domain: cleanDomain,
    isPrimary: !!isPrimary,
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  db.organizationDomains.push(newDomain);
  await db.persistOrganizationDomain(newDomain);

  return res.status(201).json({ success: true, message: 'Dominio agregado exitosamente', data: newDomain });
});

/**
 * DELETE /api/v1/organizations/:id/domains/:domainId
 * Delete a domain
 */
organizationsRouter.delete('/:id/domains/:domainId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id: orgId, domainId } = req.params;

  const membership = db.organizationMembers.find(m => m.organizationId === orgId && m.userId === userId);
  if ((!membership || (membership.role !== 'Owner' && membership.role !== 'Admin')) && req.user!.role !== 'Owner') {
    return res.status(403).json({ success: false, message: 'Permisos insuficientes para eliminar dominios' });
  }

  const dom = db.organizationDomains.find(d => d.id === domainId && d.organizationId === orgId);
  if (!dom) {
    return res.status(404).json({ success: false, message: 'Dominio no encontrado' });
  }

  if (dom.isPrimary) {
    return res.status(400).json({ success: false, message: 'No se puede eliminar el dominio principal de la organización' });
  }

  db.organizationDomains = db.organizationDomains.filter(d => d.id !== domainId);
  await db.deleteOrganizationDomain(domainId);

  return res.json({ success: true, message: 'Dominio eliminado exitosamente' });
});

/**
 * POST /api/v1/organizations/:id/switch
 * Switch active organization context for the authenticated user
 */
organizationsRouter.post('/:id/switch', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const targetOrgId = req.params.id;

  let org = db.organizations.find(o => o.id === targetOrgId);
  try {
    const orgRes = await pool.query('SELECT * FROM organizations WHERE id = $1', [targetOrgId]);
    if (orgRes.rows.length > 0) {
      const row = orgRes.rows[0];
      if (org) {
        org.status = row.status;
        org.isActive = (row.status === 'Active' || row.status === 'ACTIVE');
      } else {
        org = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: row.type || 'Enterprise',
          industry: row.industry || 'Technology',
          status: row.status,
          isActive: (row.status === 'Active' || row.status === 'ACTIVE'),
          settings: row.settings || '{}',
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        };
        db.organizations.push(org);
      }
    }
  } catch {}

  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  // REGLA CRÍTICA: No se puede seleccionar una organización inactiva
  if (org.status === 'INACTIVE' || org.status === 'Inactive') {
    return res.status(400).json({
      success: false,
      message: 'No se puede seleccionar una organización inactiva',
      code: 'ORGANIZATION_INACTIVE'
    });
  }

  const isAdminOrOwner = req.user!.role === 'Admin' || req.user!.role === 'Owner';
  const membership = db.organizationMembers.find(m => m.organizationId === targetOrgId && m.userId === userId);
  if (!isAdminOrOwner && !membership && req.user!.tenantId !== targetOrgId) {
    return res.status(403).json({ success: false, message: 'No pertenece a esta organización' });
  }

  // Update user's active tenantId in PostgreSQL and in-memory cache
  await pool.query('UPDATE users SET tenant_id = $1 WHERE id = $2', [targetOrgId, userId]);
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.tenantId = targetOrgId;
  }

  // Find default workspace for this organization
  let ws = db.workspaces.find(w => w.tenantId === targetOrgId) || null;
  if (!ws) {
    try {
      const wsRes = await pool.query('SELECT * FROM workspaces WHERE tenant_id = $1 LIMIT 1', [targetOrgId]);
      if (wsRes.rows.length > 0) {
        const row = wsRes.rows[0];
        ws = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          tenantId: row.tenant_id,
          status: row.status || 'Active',
          timeZone: row.time_zone || 'UTC',
          language: row.language || 'es',
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        } as any;
        db.workspaces.push(ws!);
      }
    } catch (e: any) {
      console.warn('[Organizations] switch ws query error:', e.message);
    }
  }

  return res.json({
    success: true,
    message: `Cambiado exitosamente a ${org.name}`,
    data: {
      organization: org,
      workspace: ws,
      role: membership ? membership.role : (user?.role || 'Member')
    }
  });
});

/**
 * GET /api/v1/organizations/:id/members
 * List members of an organization
 */
organizationsRouter.get('/:id/members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.params.id;
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  const members = db.organizationMembers.filter(m => m.organizationId === orgId);
  const data = members.map(m => {
    const u = db.users.find(usr => usr.id === m.userId);
    return {
      id: m.id,
      organizationId: m.organizationId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      createdBy: m.createdBy,
      deactivatedAt: m.deactivatedAt,
      deactivatedBy: m.deactivatedBy,
      user: u ? {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        email: u.email,
        jobTitle: u.jobTitle,
        avatarUrl: u.avatarUrl,
        accountStatus: u.accountStatus,
        status: u.status
      } : null
    };
  });

  return res.json({ success: true, data });
});

/**
 * POST /api/v1/organizations/:id/members
 * Add a member to an organization
 */
organizationsRouter.post('/:id/members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.params.id;
  const { userId, role = 'Member' } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'El parámetro userId es requerido' });
  }

  let org = db.organizations.find(o => o.id === orgId);
  try {
    const orgRes = await pool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (orgRes.rows.length > 0) {
      const row = orgRes.rows[0];
      if (org) {
        org.status = row.status;
        org.isActive = (row.status === 'Active' || row.status === 'ACTIVE');
      } else {
        org = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: row.type || 'Enterprise',
          industry: row.industry || 'Technology',
          status: row.status,
          isActive: (row.status === 'Active' || row.status === 'ACTIVE'),
          settings: row.settings || '{}',
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString()
        };
        db.organizations.push(org);
      }
    }
  } catch {}

  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  // REGLA CRÍTICA: No se pueden agregar miembros a una organización inactiva
  if (org.status === 'INACTIVE' || org.status === 'Inactive') {
    return res.status(400).json({
      success: false,
      message: 'No se pueden agregar miembros a una organización inactiva',
      code: 'ORGANIZATION_INACTIVE'
    });
  }

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  const existingMember = db.organizationMembers.find(m => m.organizationId === orgId && m.userId === userId);
  const now = new Date().toISOString();

  if (existingMember) {
    if (existingMember.status === 'Active' || existingMember.status === 'ACTIVE') {
      return res.status(409).json({ success: false, message: 'El usuario ya es miembro activo de esta organización' });
    }
    // Reactivate membership
    existingMember.status = 'Active';
    existingMember.role = role;
    existingMember.deactivatedAt = undefined;
    existingMember.deactivatedBy = undefined;
    existingMember.updatedAt = now;
    await db.persistOrganizationMember(existingMember);
    return res.json({ success: true, message: 'Membresía reactivada exitosamente', data: existingMember });
  }

  const newMember: OrganizationMember = {
    id: `om-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    organizationId: orgId,
    userId,
    role,
    status: 'Active',
    joinedAt: now,
    createdBy: req.user!.id,
    createdAt: now,
    updatedAt: now
  };

  db.organizationMembers.push(newMember);
  await db.persistOrganizationMember(newMember);

  return res.status(201).json({
    success: true,
    message: 'Miembro asignado exitosamente a la organización',
    data: newMember
  });
});

/**
 * DELETE /api/v1/organizations/:id/members/:userId
 * Soft-deactivate a member from an organization
 */
organizationsRouter.delete('/:id/members/:userId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id: orgId, userId } = req.params;
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) {
    return res.status(404).json({ success: false, message: 'Organización no encontrada' });
  }

  await db.removeOrganizationMember(orgId, userId, req.user!.id);
  return res.json({ success: true, message: 'Miembro desactivado de la organización exitosamente' });
});

/**
 * PATCH /api/v1/organizations/:id/members/:userId/deactivate
 * Soft-deactivate a member from an organization
 */
organizationsRouter.patch('/:id/members/:userId/deactivate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id: orgId, userId } = req.params;
  await db.removeOrganizationMember(orgId, userId, req.user!.id);
  return res.json({ success: true, message: 'Miembro desactivado de la organización exitosamente' });
});
