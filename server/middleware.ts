import { Request, Response, NextFunction } from 'express';
import { db, ROLE_PERMISSIONS } from './db';
import { verifyJwt, checkRateLimit } from './security';
import { User, Workspace, WorkspaceMember, FeaturePermissions } from '../src/types';
import { adminAuth } from '../src/lib/firebase-admin';

// Extended Express Request interface for authenticated context
export interface AuthenticatedRequest extends Request {
  user?: User;
  workspace?: Workspace;
  member?: WorkspaceMember;
  permissions?: string[];
  tenantId?: string;
  correlationId?: string;
}

// Request Audit Observability Model
export interface RequestLogEntry {
  id: string;
  correlationId: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  user: string;
  ip: string;
  userAgent: string;
  durationMs: number;
}

export const requestAuditBuffer: RequestLogEntry[] = [];

/**
 * Correlation ID & Request Tracking Middleware
 * Sets X-Correlation-Id and logs request telemetry
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const userIdentifier = (req as any).user?.email || (req as any).user?.userName || (req.headers['x-user-id'] as string) || (req.body?.email || req.body?.identifier ? String(req.body.email || req.body.identifier) : 'anonymous');
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const entry: RequestLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      correlationId,
      timestamp: new Date().toISOString(),
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: res.statusCode,
      user: userIdentifier,
      ip,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      durationMs
    };

    requestAuditBuffer.unshift(entry);
    if (requestAuditBuffer.length > 500) {
      requestAuditBuffer.pop();
    }
  });

  next();
}

/**
 * IP Rate Limiting Middleware
 */
export function rateLimitMiddleware(limit: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `ratelimit:${ip}:${req.path}`;
    const rl = checkRateLimit(key, limit, windowMs);

    res.setHeader('X-RateLimit-Limit', rl.limit);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rl.resetTime / 1000));

    if (!rl.allowed) {
      res.setHeader('Retry-After', rl.retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message: `Demasiadas solicitudes. Por favor intente más tarde (espera ${rl.retryAfterSeconds} segundos).`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: rl.retryAfterSeconds
      });
    }
    next();
  };
}

/**
 * Authentication Middleware:
 * 1. Validates JWT Bearer Token
 * 2. Identifies User
 * 3. Checks Account Status
 * 4. Identifies Workspace Context & Multi-Tenant Isolation
 * 5. Validates Workspace Membership
 * 6. Loads Granular Permissions
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // Fallback for demo convenience: header x-user-id if no token is sent
  let userId: string | undefined;
  if (token) {
    const result = verifyJwt(token);
    if (result.valid && result.payload) {
      userId = (result.payload as any).sub || (result.payload as any).userId;
    } else {
      // Try verifying via Firebase Admin
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const fbUser = db.users.find(u => (u as any).uid === decoded.uid || (decoded.email && u.email?.toLowerCase() === decoded.email.toLowerCase()));
        if (fbUser) {
          userId = fbUser.id;
        }
      } catch {
        // Token invalid under both
      }
    }
  }

  if (!userId || !token) {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso inválido o expirado. Proporcione un token Bearer válido.',
      code: 'INVALID_TOKEN'
    });
  }

  // 2. Identify User in Database
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no encontrado o sesión terminada',
      code: 'USER_NOT_FOUND'
    });
  }

  // 3. Account Status Check
  if (user.accountStatus === 'Suspended') {
    return res.status(403).json({
      success: false,
      message: 'Su cuenta ha sido suspendida. Contacte al administrador de su organización.',
      code: 'ACCOUNT_SUSPENDED'
    });
  }

  if (user.accountStatus === 'PendingVerification') {
    return res.status(403).json({
      success: false,
      message: 'Debe verificar su dirección de correo electrónico para acceder.',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  if (user.accountStatus === 'Deleted' || user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: 'Cuenta desactivada.',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  req.user = user;
  req.tenantId = user.tenantId;

  // 4. Identify Workspace Context
  const isWorkspaceCreationOrListing = req.baseUrl?.endsWith('/workspaces') && (req.path === '/' || req.path === '');
  if (isWorkspaceCreationOrListing) {
    req.permissions = ROLE_PERMISSIONS[user.role] || [];
    return next();
  }

  const headerWsId = (req.headers['x-workspace-id'] as string) || (req.query.workspaceId as string);
  let workspace: Workspace | undefined;

  if (headerWsId) {
    workspace = db.workspaces.find(w => w.id === headerWsId);
  } else {
    // Default to first workspace matching user's tenant
    workspace = db.workspaces.find(w => w.tenantId === user.tenantId);
  }

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: 'Workspace no encontrado o no configurado',
      code: 'WORKSPACE_NOT_FOUND'
    });
  }

  // Tenant Isolation Check: Workspace must belong to the user's tenant
  if (workspace.tenantId !== user.tenantId) {
    return res.status(403).json({
      success: false,
      message: 'Violación de aislamiento multi-tenant. No tiene acceso a este workspace.',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }

  req.workspace = workspace;

  // 5. Validate Workspace Membership
  let member = db.workspaceMembers.find(
    m => m.workspaceId === workspace!.id && m.userId === user.id
  );

  if (!member) {
    // Auto-associate active member of the organization or tenant to the organization's workspace
    const hasOrgMembership = db.organizationMembers.some(
      om => om.organizationId === workspace!.tenantId && om.userId === user.id && ((om.status || '').toUpperCase() === 'ACTIVE' || om.status === 'Active')
    );
    if (hasOrgMembership || user.tenantId === workspace!.tenantId) {
      member = {
        id: `wm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: workspace!.id,
        tenantId: workspace!.tenantId,
        userId: user.id,
        role: user.role || 'Member',
        status: 'Active',
        joinedAt: new Date().toISOString()
      };
      db.workspaceMembers.push(member);
      db.persistWorkspaceMember(member).catch(console.error);
    }
  }

  if (!member || member.status !== 'Active') {
    return res.status(403).json({
      success: false,
      message: 'No es miembro activo de este workspace.',
      code: 'NOT_A_WORKSPACE_MEMBER'
    });
  }

  req.member = member;

  // 6. Compute Granular Permissions
  const role = member.role || user.role;
  req.permissions = ROLE_PERMISSIONS[role] || [];

  next();
}

/**
 * RBAC Permission Middleware
 * Checks if the authenticated member has the specific granular permission
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.member || !req.permissions) {
      return res.status(403).json({
        success: false,
        message: 'No se pudo verificar la membresía o permisos',
        code: 'FORBIDDEN'
      });
    }

    // Owners have all permissions implicitly
    if (req.member.role === 'Owner') {
      return next();
    }

    if (!req.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permiso denegado. Se requiere el permiso: ${permission}`,
        code: 'FORBIDDEN',
        requiredPermission: permission
      });
    }

    next();
  };
}

/**
 * Strict Multi-Tenant Resource Isolation Validator
 * Ensures that the requested entity belongs to the requester's tenant
 */
export function assertTenantMatch(req: AuthenticatedRequest, entityTenantId: string) {
  if (!req.user || req.user.tenantId !== entityTenantId) {
    const error: any = new Error('Violación de aislamiento multi-tenant');
    error.statusCode = 403;
    error.code = 'TENANT_ISOLATION_VIOLATION';
    throw error;
  }
}

/**
 * Feature Guard Middleware (Layer 5: API-level blocking for modular MVP governance)
 * Rejects requests to disabled features with 403 FEATURE_DISABLED.
 */
export function requireFeature(feature: keyof FeaturePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'tenant-mu36yjdt';
    const permissions = db.getFeaturePermissions(tenantId);
    if (!permissions[feature]) {
      return res.status(403).json({
        success: false,
        message: `Funcionalidad '${feature}' no disponible en esta versión.`,
        code: 'FEATURE_DISABLED',
        feature
      });
    }
    next();
  };
}

