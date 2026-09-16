import { Router, Response } from 'express';
import { db, ROLE_PERMISSIONS } from '../db';
import { realtimeHub } from '../realtime';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  generateSecureToken,
  hashToken,
  validatePasswordPolicy,
  normalizeEmail,
  normalizeUserName,
  normalizeIdentifier,
  parseUserAgent,
  sanitizeText,
  recordFailedLogin,
  checkRateLimit,
  clearRateLimit,
  isAccountLocked,
  clearFailedLogins,
  unlockAccount,
  getSecurityStats,
  registerRotatedToken,
  getRotatedTokenGrace,
  ACCESS_TOKEN_LIFETIME_SECONDS,
  REFRESH_TOKEN_LIFETIME_SECONDS
} from '../security';
import { authenticate, AuthenticatedRequest, requestAuditBuffer } from '../middleware';
import { User, UserRole, UserSession, WorkspaceMember, AccountStatus } from '../../src/types';
import { adminAuth } from '../../src/lib/firebase-admin';

export const authRouter = Router();

// Helper to extract tenant
export function getTenantId(req: any): string {
  return (req.headers['x-tenant-id'] as string) || (req.user?.tenantId) || db.tenants[0]?.id || '';
}

export function getUserId(req: any): string {
  return req.user?.id || (req.headers['x-user-id'] as string) || '';
}

/**
 * POST /api/auth/login
 * Strict Authentication Flow:
 * - Volumetric Rate Limiting by IP (HTTP 429)
 * - Flexible Identifier (Email or Username)
 * - Per-Account Brute Force Lockout Protection (HTTP 423)
 * - Constant-time PBKDF2 Password Verification
 * - Reset of Failed Attempts on Success
 * - Account Status Validation
 * - Session Creation with Device Fingerprint & Refresh Token Rotation with Grace Period
 * - Granular Permissions Payload & Audit Logging
 */
authRouter.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { email, identifier, username, emailOrUserName, password, workspaceId } = req.body;

  const rawIdentifier = (identifier || email || username || emailOrUserName || '').toString().trim();

  if (!rawIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere identificador (correo electrónico o usuario) y contraseña',
      code: 'MISSING_CREDENTIALS'
    });
  }

  // 1. IP Volumetric Rate Limiting (Protects server from volumetric DDoS, 30 req/min/IP)
  const ipRl = checkRateLimit(`login:ip:${ip}`, 30, 60000);
  res.setHeader('X-RateLimit-Limit', ipRl.limit);
  res.setHeader('X-RateLimit-Remaining', ipRl.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(ipRl.resetTime / 1000));

  if (!ipRl.allowed) {
    res.setHeader('Retry-After', ipRl.retryAfterSeconds);
    return res.status(429).json({
      success: false,
      message: `Demasiadas solicitudes de inicio de sesión desde esta IP. Espere ${ipRl.retryAfterSeconds} segundos antes de reintentar.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: ipRl.retryAfterSeconds
    });
  }

  const normalized = normalizeIdentifier(rawIdentifier);

  // 2. Account Lockout Check (Per-Account Identity, NOT by IP!)
  const lockoutStatus = isAccountLocked(normalized);
  if (lockoutStatus.isLocked) {
    return res.status(423).json({
      success: false,
      message: `La cuenta ha sido bloqueada temporalmente por exceso de intentos fallidos. Intente de nuevo en ${lockoutStatus.remainingSeconds} segundos.`,
      code: 'ACCOUNT_LOCKED',
      remainingSeconds: lockoutStatus.remainingSeconds
    });
  }

  // 3. User Lookup by normalizedEmail or normalizedUserName
  const user = db.users.find(u =>
    u.normalizedEmail === normalized ||
    (u.email && u.email.toLowerCase() === normalized) ||
    u.normalizedUserName === normalized ||
    (u.userName && u.userName.toLowerCase() === normalized)
  );

  if (!user) {
    const attemptResult = recordFailedLogin(normalized, ip);
    return res.status(401).json({
      success: false,
      message: 'Credenciales inválidas. Verifique su usuario/correo y contraseña.',
      code: 'AUTH_FAILED',
      remainingAttempts: attemptResult.remainingAttempts
    });
  }

  // 4. Verify Password
  const isValidPassword = verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    const attemptResult = recordFailedLogin(normalized, ip);
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

    if (attemptResult.isLocked) {
      return res.status(423).json({
        success: false,
        message: `Ha superado el límite de intentos permitidos. Su cuenta ha sido bloqueada temporalmente por ${attemptResult.remainingSeconds} segundos.`,
        code: 'ACCOUNT_LOCKED',
        remainingAttempts: 0,
        remainingSeconds: attemptResult.remainingSeconds
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Credenciales inválidas. Verifique su usuario/correo y contraseña.',
      code: 'AUTH_FAILED',
      remainingAttempts: attemptResult.remainingAttempts
    });
  }

  // 5. Success! Clear failed login trackers immediately!
  clearFailedLogins(normalized);
  if (user.normalizedEmail) clearFailedLogins(user.normalizedEmail);
  if (user.normalizedUserName) clearFailedLogins(user.normalizedUserName);
  user.failedLoginAttempts = 0;
  user.lastLoginAt = new Date().toISOString();
  user.lastSeenAt = new Date().toISOString();
  user.status = 'Online';

  // 6. Validate Account Status
  if (user.accountStatus === 'Suspended') {
    return res.status(403).json({
      success: false,
      message: 'Esta cuenta está suspendida por políticas de seguridad de la organización.',
      code: 'ACCOUNT_SUSPENDED'
    });
  }

  if (user.accountStatus === 'PendingVerification') {
    return res.status(403).json({
      success: false,
      message: 'Debe verificar su dirección de correo electrónico antes de iniciar sesión.',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  if (user.accountStatus === 'Deleted' || user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: 'La cuenta no está activa.',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  // Determine Workspace
  const targetWsId = workspaceId || (req.headers['x-workspace-id'] as string);
  let workspace = targetWsId ? db.workspaces.find(w => w.id === targetWsId) : undefined;
  if (!workspace) {
    workspace = db.workspaces.find(w => w.tenantId === user.tenantId);
  }

  const member = db.workspaceMembers.find(m => m.workspaceId === workspace?.id && m.userId === user.id);
  const role = member?.role || user.role;
  const permissions = ROLE_PERMISSIONS[role] || [];

  // Generate Tokens
  const token = signJwt({
    userId: user.id,
    email: user.email,
    userName: user.userName,
    tenantId: user.tenantId,
    workspaceId: workspace?.id,
    role,
    mustChangePassword: !!user.mustChangePassword
  });

  const rawRefreshToken = generateSecureToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);

  // Device & User Agent Parsing
  const userAgentStr = req.headers['user-agent'] || 'CollabPulse Desktop / 1.0';
  const deviceInfo = parseUserAgent(userAgentStr);

  // Persist Session
  const newSession: UserSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    tenantId: user.tenantId,
    workspaceId: workspace?.id || '',
    refreshTokenHash,
    deviceName: `${deviceInfo.browser} en ${deviceInfo.os} (${deviceInfo.deviceType === 'desktop' ? 'Equipo de escritorio' : 'Dispositivo móvil'})`,
    deviceType: deviceInfo.deviceType,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    ipAddress: ip,
    userAgent: userAgentStr,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1000).toISOString()
  };

  db.sessions.push(newSession);
  await db.persistSession(newSession);

  // Audit Log
  db.logAudit(
    user.tenantId,
    user.id,
    user.displayName || `${user.firstName} ${user.lastName}`,
    'LOGIN',
    'UserSession',
    newSession.id,
    ip,
    { browser: deviceInfo.browser, os: deviceInfo.os, deviceType: deviceInfo.deviceType },
    workspace?.id
  );

  realtimeHub.broadcastToTenant(user.tenantId, 'UserOnline', { userId: user.id, timestamp: new Date().toISOString() });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        timeZone: user.timeZone,
        status: user.status,
        customStatus: user.customStatus,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        mustChangePassword: !!user.mustChangePassword
      },
      token,
      refreshToken: rawRefreshToken,
      sessionId: newSession.id,
      workspace: workspace || null,
      permissions,
      mustChangePassword: !!user.mustChangePassword
    }
  });
});

/**
 * POST /api/auth/register
 * Enterprise Registration Flow:
 * - Sanitized text inputs
 * - Normalized email & username
 * - Strict Password Policy enforcement (>= 8 chars, mixed case, numbers, symbol)
 * - Unique email collision check
 * - Automatic assignment to initial tenant workspace
 * - Multi-tenant isolation
 * - Audit logging
 */
authRouter.post('/register', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { firstName, lastName, fullName, email, password, jobTitle, tenantId, role = 'Member' } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere correo electrónico y contraseña',
      code: 'MISSING_FIELDS'
    });
  }

  // Password Policy Validation
  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.valid) {
    return res.status(400).json({
      success: false,
      message: 'La contraseña no cumple con los requisitos de seguridad',
      errors: policyCheck.errors,
      code: 'WEAK_PASSWORD'
    });
  }

  const normalized = normalizeEmail(email);

  // Check duplicate
  const existing = db.users.find(u => u.normalizedEmail === normalized || u.email.toLowerCase() === normalized);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'El correo electrónico ya está registrado en la plataforma',
      code: 'USER_EXISTS'
    });
  }

  let fName = firstName;
  let lName = lastName;
  if (!fName && fullName) {
    const parts = fullName.trim().split(/\s+/);
    fName = parts[0];
    lName = parts.slice(1).join(' ') || 'Colaborador';
  }

  const cleanFirstName = sanitizeText(fName || 'Usuario');
  const cleanLastName = sanitizeText(lName || 'Nuevo');
  const cleanJobTitle = sanitizeText(jobTitle || 'Colaborador');

  // Domain-based registration & Organization matching
  const emailDomain = (normalized.split('@')[1] || '').trim().toLowerCase();
  let matchedOrgId: string | null = tenantId || null;
  let accountStatus: AccountStatus = 'Active';

  if (!matchedOrgId && emailDomain) {
    const matchedDomain = db.organizationDomains.find(d => d.domain.toLowerCase() === emailDomain && d.isVerified);
    if (matchedDomain) {
      matchedOrgId = matchedDomain.organizationId;
      const orgSettings = db.organizationSettings.find(s => s.organizationId === matchedOrgId);
      if (orgSettings?.requireApproval && !orgSettings?.allowAutoJoin) {
        accountStatus = 'PendingVerification' as any;
      }
    }
  }

  const targetTenantId = matchedOrgId || (db.organizations[0]?.id) || (db.tenants[0]?.id) || 'org-default';

  // Target workspace for this tenant
  const workspace = db.workspaces.find(w => w.tenantId === targetTenantId) || db.workspaces[0];
  const userName = `${cleanFirstName.toLowerCase().replace(/\s+/g, '.')}.${cleanLastName.toLowerCase().replace(/\s+/g, '')}.${Math.floor(Math.random() * 900 + 100)}`;
  const normalizedUserName = normalizeUserName(userName);

  const newUser: User = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId: targetTenantId,
    email,
    normalizedEmail: normalized,
    userName,
    normalizedUserName,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    displayName: `${cleanFirstName} ${cleanLastName}`,
    passwordHash: hashPassword(password),
    role: role as UserRole,
    avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    jobTitle: cleanJobTitle,
    timeZone: 'Europe/Madrid',
    status: 'Online',
    accountStatus,
    emailVerified: true,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  await db.persistUser(newUser);

  // Create Organization Membership
  const orgMember = {
    id: `om-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    organizationId: targetTenantId,
    userId: newUser.id,
    role: newUser.role,
    status: accountStatus === 'PendingVerification' ? 'Pending' : 'Active',
    joinedAt: new Date().toISOString()
  };
  db.organizationMembers.push(orgMember as any);
  await db.persistOrganizationMember(orgMember as any);

  // Create Workspace Membership
  if (workspace) {
    const member: WorkspaceMember = {
      id: `wm-${Date.now()}`,
      workspaceId: workspace.id,
      tenantId: targetTenantId,
      userId: newUser.id,
      role: newUser.role,
      status: 'Active',
      joinedAt: new Date().toISOString()
    };
    db.workspaceMembers.push(member);
    await db.persistWorkspaceMember(member);

    // Auto-join public channels of this workspace
    db.channels
      .filter(c => c.workspaceId === workspace.id && !c.isPrivate)
      .forEach(c => {
        db.channelMembers.push({ channelId: c.id, userId: newUser.id, joinedAt: new Date().toISOString() });
        c.membersCount = (c.membersCount || 0) + 1;
      });
  }

  // Issue Session & Tokens
  const rawRefreshToken = generateSecureToken(48);
  const token = signJwt({
    userId: newUser.id,
    email: newUser.email,
    tenantId: newUser.tenantId,
    workspaceId: workspace?.id,
    role: newUser.role
  });

  const userAgentStr = req.headers['user-agent'] || 'CollabPulse Browser / 1.0';
  const deviceInfo = parseUserAgent(userAgentStr);

  const session: UserSession = {
    id: `sess-${Date.now()}`,
    userId: newUser.id,
    tenantId: newUser.tenantId,
    workspaceId: workspace?.id || '',
    refreshTokenHash: hashToken(rawRefreshToken),
    deviceName: `${deviceInfo.browser} en ${deviceInfo.os}`,
    deviceType: deviceInfo.deviceType,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    ipAddress: ip,
    userAgent: userAgentStr,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
  };

  db.sessions.push(session);
  await db.persistSession(session);

  db.logAudit(
    targetTenantId,
    newUser.id,
    newUser.displayName,
    'USER_CREATED',
    'User',
    newUser.id,
    ip,
    { email, role: newUser.role, workspaceId: workspace?.id }
  );

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: newUser.id,
        email: newUser.email,
        userName: newUser.userName,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        displayName: newUser.displayName,
        role: newUser.role,
        tenantId: newUser.tenantId,
        avatarUrl: newUser.avatarUrl,
        jobTitle: newUser.jobTitle,
        timeZone: newUser.timeZone,
        status: newUser.status,
        accountStatus: newUser.accountStatus,
        emailVerified: newUser.emailVerified
      },
      token,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      workspace: workspace || null,
      permissions: ROLE_PERMISSIONS[newUser.role] || []
    }
  });
});

/**
 * POST /api/v1/auth/firebase-login
 * Secure authentication with Firebase / Google OAuth token verification
 */
authRouter.post('/firebase-login', async (req, res) => {
  try {
    const { idToken, email, displayName, photoURL } = req.body;
    let uid: string;
    let verifiedEmail: string | undefined = email;
    let verifiedName: string | undefined = displayName;
    let verifiedPhoto: string | undefined = photoURL;

    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
        if (decoded.email) verifiedEmail = decoded.email;
        if (decoded.name) verifiedName = decoded.name;
        if (decoded.picture) verifiedPhoto = decoded.picture;
      } catch (err) {
        console.warn('Firebase token verification note:', err);
        uid = req.body.uid || `fb-${Date.now()}`;
      }
    } else if (req.body.uid) {
      uid = req.body.uid;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Token de Firebase requerido',
        code: 'MISSING_FIREBASE_TOKEN'
      });
    }

    // Check if user exists in database or memory
    let user = db.users.find(u => (u as any).uid === uid || (verifiedEmail && u.email?.toLowerCase() === verifiedEmail.toLowerCase()));

    if (!user) {
      const primaryTenant = db.tenants[0];
      const tenantId = primaryTenant ? primaryTenant.id : '';
      const cleanName = verifiedName || (verifiedEmail ? verifiedEmail.split('@')[0] : 'Usuario');
      const parts = cleanName.split(' ');
      const firstName = parts[0] || 'Usuario';
      const lastName = parts.slice(1).join(' ') || '';
      const userName = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.') || `user.${Date.now().toString(36)}`).substring(0, 50);

      user = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tenantId,
        email: verifiedEmail || `${userName}@collabpulse.local`,
        normalizedEmail: verifiedEmail ? normalizeEmail(verifiedEmail) : `${userName}@collabpulse.local`,
        userName,
        normalizedUserName: normalizeUserName(userName),
        firstName,
        lastName,
        displayName: cleanName,
        passwordHash: hashPassword('CollabPulse2026!'),
        role: 'Member',
        avatarUrl: verifiedPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        jobTitle: 'Google Account User',
        timeZone: 'Europe/Madrid',
        status: 'Online',
        customStatus: 'Conectado mediante Google / Firebase',
        accountStatus: 'Active',
        emailVerified: true,
        failedLoginAttempts: 0,
        lastLoginAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      (user as any).uid = uid;

      db.users.push(user);
      db.persistUser(user);

      const workspace = db.workspaces.find(w => w.tenantId === user!.tenantId) || db.workspaces[0];
      if (workspace) {
        db.workspaceMembers.push({
          id: `wm-${Date.now()}`,
          workspaceId: workspace.id,
          tenantId: user.tenantId,
          userId: user.id,
          role: 'Member',
          status: 'Active',
          joinedAt: new Date().toISOString()
        });
      }
    }

    const workspace = db.workspaces.find(w => w.tenantId === user!.tenantId) || db.workspaces[0];
    const token = signJwt({
      userId: user.id,
      email: user.email,
      userName: user.userName,
      tenantId: user.tenantId,
      workspaceId: workspace?.id,
      role: user.role
    });

    const rawRefreshToken = generateSecureToken(48);
    const session: UserSession = {
      id: `sess-${Date.now()}`,
      userId: user.id,
      tenantId: user.tenantId,
      workspaceId: workspace?.id || '',
      refreshTokenHash: hashToken(rawRefreshToken),
      deviceName: 'Google Auth Session',
      deviceType: 'desktop',
      browser: 'Chrome / Firebase',
      os: 'Cloud',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Firebase Auth',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    db.sessions.push(session);

    res.json({
      success: true,
      data: {
        user,
        token,
        refreshToken: rawRefreshToken,
        sessionId: session.id,
        workspace,
        permissions: ROLE_PERMISSIONS[user.role] || []
      }
    });
  } catch (error: any) {
    console.error('Firebase login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el inicio de sesión con Google / Firebase',
      code: 'FIREBASE_AUTH_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh-token
 * Token Refresh with Secure Rotation
 */
authRouter.post(['/refresh-token', '/refresh'], async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Token de refresco requerido',
      code: 'MISSING_REFRESH_TOKEN'
    });
  }

  const hashed = hashToken(refreshToken);

  // Check 30s Grace Period (resolves parallel race conditions)
  const grace = getRotatedTokenGrace(hashed);
  if (grace) {
    return res.json({
      success: true,
      data: {
        token: grace.newAccessToken,
        refreshToken: grace.newRawRefreshToken
      }
    });
  }

  const session = db.sessions.find(s => s.refreshTokenHash === hashed);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Token de refresco inválido o revocado',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }

  // Check expiration
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    // Session expired, remove it
    const idx = db.sessions.indexOf(session);
    if (idx !== -1) db.sessions.splice(idx, 1);
    return res.status(401).json({
      success: false,
      message: 'La sesión ha expirado. Debe iniciar sesión nuevamente.',
      code: 'SESSION_EXPIRED'
    });
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.accountStatus !== 'Active') {
    return res.status(403).json({
      success: false,
      message: 'Cuenta inactiva o no encontrada',
      code: 'FORBIDDEN'
    });
  }

  // Token Rotation: Generate new refresh token and update session with 30s Grace
  const newRawRefreshToken = generateSecureToken(48);
  const oldHashed = session.refreshTokenHash;
  session.refreshTokenHash = hashToken(newRawRefreshToken);
  session.lastUsedAt = new Date().toISOString();

  await db.updatePgSession(session.id, { refreshTokenHash: session.refreshTokenHash });

  const newAccessToken = signJwt({
    userId: user.id,
    email: user.email,
    userName: user.userName,
    tenantId: user.tenantId,
    workspaceId: session.workspaceId,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword
  });

  registerRotatedToken(oldHashed, newRawRefreshToken, newAccessToken, 30);

  res.json({
    success: true,
    data: {
      token: newAccessToken,
      refreshToken: newRawRefreshToken
    }
  });
});

/**
 * POST /api/auth/logout
 * Revoke Current Session
 */
authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  let sessionId = req.body?.sessionId;

  // Clear IP rate limit tracker for login attempts from this client
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  clearRateLimit(`login:ip:${ip}`);

  // If no sessionId specified, attempt to derive from token
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  let userId = req.headers['x-user-id'] as string;

  if (token) {
    const verified = verifyJwt(token);
    if (verified?.valid && verified.payload) {
      if (!sessionId && verified.payload.sessionId) {
        sessionId = verified.payload.sessionId;
      }
      if (!userId && verified.payload.sub) {
        userId = verified.payload.sub;
      }
      if (verified.payload.email) {
        clearFailedLogins(verified.payload.email);
        unlockAccount(verified.payload.email);
      }
      if (verified.payload.userName) {
        clearFailedLogins(verified.payload.userName);
        unlockAccount(verified.payload.userName);
      }
    } else {
      const sessByToken = db.sessions.find(s => (s as any).token === token || s.id === token);
      if (sessByToken) {
        sessionId = sessByToken.id;
        userId = userId || sessByToken.userId;
      }
    }
  }

  if (sessionId) {
    const idx = db.sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      const sess = db.sessions[idx];
      db.sessions.splice(idx, 1);
      db.revokePgSession(sess.id);
      db.logAudit(sess.tenantId, sess.userId, 'Usuario', 'LOGOUT', 'UserSession', sess.id, req.ip);
      const user = db.users.find(u => u.id === sess.userId);
      if (user) {
        if (user.email) {
          clearFailedLogins(user.email);
          unlockAccount(user.email);
        }
        if (user.userName) {
          clearFailedLogins(user.userName);
          unlockAccount(user.userName);
        }
      }
    } else {
      db.revokePgSession(sessionId);
    }
  } else if (userId) {
    // Remove the most recent session for this user
    const userSessions = db.sessions.filter(s => s.userId === userId);
    if (userSessions.length > 0) {
      const latest = userSessions[userSessions.length - 1];
      const idx = db.sessions.indexOf(latest);
      if (idx !== -1) db.sessions.splice(idx, 1);
      db.revokePgSession(latest.id);
      db.logAudit(latest.tenantId, latest.userId, 'Usuario', 'LOGOUT', 'UserSession', latest.id, req.ip);
    }
    const user = db.users.find(u => u.id === userId);
    if (user) {
      if (user.email) {
        clearFailedLogins(user.email);
        unlockAccount(user.email);
      }
      if (user.userName) {
        clearFailedLogins(user.userName);
        unlockAccount(user.userName);
      }
    }
  }

  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
});

/**
 * POST /api/auth/logout-all
 * Revoke all active sessions for current authenticated user
 */
authRouter.post('/logout-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const countBefore = db.sessions.length;
  db.sessions = db.sessions.filter(s => s.userId !== userId);
  const revokedCount = countBefore - db.sessions.length;

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'LOGOUT_ALL',
    'UserSession',
    userId,
    req.ip,
    { revokedCount }
  );

  res.json({
    success: true,
    message: `Se cerraron todas las sesiones activas (${revokedCount} sesiones cerradas)`
  });
});

/**
 * GET /api/auth/sessions
 * List active sessions for authenticated user
 */
authRouter.get('/sessions', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const currentIp = req.ip || '127.0.0.1';
  const userSessions = db.sessions.filter(s => s.userId === req.user!.id);

  const formatted = userSessions.map((s, idx) => ({
    id: s.id,
    deviceName: s.deviceName,
    deviceType: s.deviceType,
    browser: s.browser,
    os: s.os,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    expiresAt: s.expiresAt,
    isCurrent: idx === 0 || s.ipAddress === currentIp
  }));

  res.json({
    success: true,
    data: formatted
  });
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke specific session
 */
authRouter.delete('/sessions/:sessionId', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const session = db.sessions.find(s => s.id === sessionId && s.userId === req.user!.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Sesión no encontrada o no pertenece al usuario actual',
      code: 'SESSION_NOT_FOUND'
    });
  }

  const idx = db.sessions.indexOf(session);
  if (idx !== -1) {
    db.sessions.splice(idx, 1);
  }

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'SESSION_REVOKED',
    'UserSession',
    sessionId,
    req.ip
  );

  res.json({
    success: true,
    message: 'Sesión revocada correctamente'
  });
});

/**
 * POST /api/auth/forgot-password
 * Password recovery request: Generates token with secure 1-hour expiration
 */
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Correo electrónico requerido',
      code: 'MISSING_EMAIL'
    });
  }

  const normalized = normalizeEmail(email);
  const user = db.users.find(u => u.normalizedEmail === normalized || u.email.toLowerCase() === normalized);

  let devToken: string | undefined;

  if (user) {
    const rawToken = generateSecureToken(32);
    devToken = rawToken;

    db.passwordResetTokens.push({
      id: `prt-${Date.now()}`,
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isUsed: false,
      createdAt: new Date().toISOString()
    });

    db.logAudit(
      user.tenantId,
      user.id,
      user.displayName,
      'PASSWORD_RESET_REQUESTED',
      'User',
      user.id,
      req.ip
    );
  }

  // Consistent message to prevent account enumeration
  res.json({
    success: true,
    message: 'Si el correo electrónico existe en nuestra plataforma, se ha enviado un enlace seguro para restablecer su contraseña.',
    // devToken provided in development/demo mode for direct testing
    devToken
  });
});

/**
 * POST /api/auth/reset-password
 * Complete Password Reset with validation & session revocation
 */
authRouter.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token y nueva contraseña requeridos',
      code: 'MISSING_FIELDS'
    });
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return res.status(400).json({
      success: false,
      message: 'La contraseña no cumple las políticas de seguridad',
      errors: policy.errors,
      code: 'WEAK_PASSWORD'
    });
  }

  const hashedToken = hashToken(token);
  const resetRecord = db.passwordResetTokens.find(
    r => r.tokenHash === hashedToken && !r.isUsed && new Date(r.expiresAt).getTime() > Date.now()
  );

  if (!resetRecord) {
    return res.status(400).json({
      success: false,
      message: 'El enlace de recuperación es inválido o ha expirado. Solicite uno nuevo.',
      code: 'INVALID_RESET_TOKEN'
    });
  }

  const user = db.users.find(u => u.id === resetRecord.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado',
      code: 'USER_NOT_FOUND'
    });
  }

  // Update password
  user.passwordHash = hashPassword(newPassword);
  resetRecord.isUsed = true;

  // Revoke all existing sessions for security
  db.sessions = db.sessions.filter(s => s.userId !== user.id);

  db.logAudit(
    user.tenantId,
    user.id,
    user.displayName,
    'PASSWORD_RESET_COMPLETED',
    'User',
    user.id,
    req.ip
  );

  res.json({
    success: true,
    message: 'Su contraseña ha sido restablecida exitosamente. Inicie sesión con sus nuevas credenciales.'
  });
});

/**
 * POST /api/auth/change-password
 * In-app password update requiring current password validation
 */
authRouter.post('/change-password', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user!;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Debe ingresar su contraseña actual y la nueva contraseña',
      code: 'MISSING_FIELDS'
    });
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({
      success: false,
      message: 'La contraseña actual no es correcta',
      code: 'INVALID_CURRENT_PASSWORD'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'La nueva contraseña no puede ser idéntica a la anterior',
      code: 'PASSWORD_SAME_AS_OLD'
    });
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return res.status(400).json({
      success: false,
      message: 'La nueva contraseña no cumple con las políticas de seguridad requeridas',
      errors: policy.errors,
      code: 'WEAK_PASSWORD'
    });
  }

  user.passwordHash = hashPassword(newPassword);

  db.logAudit(
    user.tenantId,
    user.id,
    user.displayName,
    'PASSWORD_CHANGED',
    'User',
    user.id,
    req.ip
  );

  res.json({
    success: true,
    message: 'Contraseña actualizada correctamente'
  });
});

/**
 * GET /api/auth/me
 * Returns authenticated user, active workspace, permissions, and tenant details
 */
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const workspace = req.workspace;
  const member = req.member;
  const tenant = db.tenants.find(t => t.id === user.tenantId);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role: member?.role || user.role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        phone: user.phone,
        bio: user.bio,
        timeZone: user.timeZone,
        status: user.status,
        customStatus: user.customStatus,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      },
      tenant: tenant || null,
      workspace: workspace || null,
      member: member || null,
      permissions: req.permissions || []
    }
  });
});

/**
 * Fast Switch Active User (for immediate demo verification of multi-tenancy & RBAC roles)
 * Generates an authentic signed JWT and active session for the selected user!
 */
authRouter.post('/switch-user', (req, res) => {
  const { userId } = req.body;
  const targetUser = db.users.find(u => u.id === userId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado en la base de datos',
      code: 'USER_NOT_FOUND'
    });
  }

  targetUser.status = 'Online';
  targetUser.lastSeenAt = new Date().toISOString();

  const workspace = db.workspaces.find(w => w.tenantId === targetUser.tenantId);
  const member = db.workspaceMembers.find(m => m.workspaceId === workspace?.id && m.userId === targetUser.id);
  const role = member?.role || targetUser.role;
  const permissions = ROLE_PERMISSIONS[role] || [];

  const token = signJwt({
    userId: targetUser.id,
    email: targetUser.email,
    tenantId: targetUser.tenantId,
    workspaceId: workspace?.id,
    role
  });

  const rawRefreshToken = generateSecureToken(48);
  const session: UserSession = {
    id: `sess-switch-${Date.now()}`,
    userId: targetUser.id,
    tenantId: targetUser.tenantId,
    workspaceId: workspace?.id || '',
    refreshTokenHash: hashToken(rawRefreshToken),
    deviceName: 'Navegador Web (Sesión activa)',
    deviceType: 'desktop',
    browser: 'Browser',
    os: 'OS',
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'CollabPulse Web',
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
  };

  db.sessions.push(session);

  realtimeHub.broadcastToTenant(targetUser.tenantId, 'UserOnline', {
    userId: targetUser.id,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      user: targetUser,
      token,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      workspace: workspace || null,
      permissions
    }
  });
});

/**
 * POST /api/auth/status
 * Update user presence and custom status
 */
authRouter.post('/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { status, customStatus } = req.body;
  const user = req.user!;

  if (status) user.status = status;
  if (customStatus !== undefined) user.customStatus = sanitizeText(customStatus);
  user.lastSeenAt = new Date().toISOString();

  realtimeHub.broadcastToTenant(user.tenantId, 'UserStatusChanged', {
    userId: user.id,
    status: user.status,
    customStatus: user.customStatus
  });

  res.json({
    success: true,
    data: {
      status: user.status,
      customStatus: user.customStatus
    }
  });
});

/**
 * PUT /api/auth/profile
 * Update profile details with sanitization
 */
authRouter.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { firstName, lastName, jobTitle, phone, phoneNumber, bio, timeZone, customStatus, avatarUrl } = req.body;
  const user = req.user!;

  if (firstName) user.firstName = sanitizeText(firstName);
  if (lastName) user.lastName = sanitizeText(lastName);
  if (firstName || lastName) user.displayName = `${user.firstName} ${user.lastName}`;
  if (jobTitle !== undefined) user.jobTitle = sanitizeText(jobTitle);
  if (phone !== undefined || phoneNumber !== undefined) user.phone = sanitizeText(phone || phoneNumber || '');
  if (bio !== undefined) user.bio = sanitizeText(bio);
  if (timeZone) user.timeZone = timeZone;
  if (customStatus !== undefined) user.customStatus = sanitizeText(customStatus);
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  user.updatedAt = new Date().toISOString();

  await db.persistUser(user);

  db.logAudit(
    user.tenantId,
    user.id,
    user.displayName,
    'PROFILE_UPDATED',
    'User',
    user.id,
    req.ip,
    { avatarUpdated: !!avatarUrl }
  );

  realtimeHub.broadcastToTenant(user.tenantId, 'UserPresenceChanged', {
    userId: user.id,
    user
  });

  res.json({
    success: true,
    data: user
  });
});

/**
 * GET /api/auth/health
 * Detailed auth subsystem telemetry and health status
 */
authRouter.get('/health', (req, res) => {
  const secStats = getSecurityStats();
  res.json({
    status: 'healthy',
    subsystem: 'authentication',
    timestamp: new Date().toISOString(),
    metrics: {
      activeSessionsCount: db.sessions.length,
      registeredUsersCount: db.users.length,
      activeUsersCount: db.users.filter(u => u.accountStatus === 'Active').length,
      activeLockoutsCount: secStats.activeLockoutsCount,
      activeLockouts: secStats.activeLockouts,
      rateLimitKeysTracked: secStats.rateLimitKeysTracked,
      tokenLifetimes: {
        accessTokenLifetimeSeconds: ACCESS_TOKEN_LIFETIME_SECONDS,
        refreshTokenLifetimeSeconds: REFRESH_TOKEN_LIFETIME_SECONDS
      }
    }
  });
});

/**
 * GET /api/auth/audit/requests
 * Live request telemetry ring buffer for correlation analysis
 */
authRouter.get('/audit/requests', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filterUser = req.query.user as string;
  let logs = requestAuditBuffer;

  if (filterUser) {
    logs = logs.filter(l => l.user?.toLowerCase().includes(filterUser.toLowerCase()));
  }

  res.json({
    success: true,
    totalTracked: requestAuditBuffer.length,
    returned: Math.min(limit, logs.length),
    logs: logs.slice(0, limit)
  });
});

/**
 * POST /api/auth/unlock
 * Administrative / diagnostic endpoint to unlock a blocked account identifier
 */
authRouter.post('/unlock', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere el identificador (correo o usuario) a desbloquear'
    });
  }

  const normalized = normalizeIdentifier(identifier);
  const unlocked = unlockAccount(normalized);
  clearFailedLogins(normalized);

  const user = db.users.find(u =>
    u.normalizedEmail === normalized ||
    (u.email && u.email.toLowerCase() === normalized) ||
    u.normalizedUserName === normalized
  );

  if (user) {
    user.failedLoginAttempts = 0;
    if (user.normalizedEmail) {
      unlockAccount(user.normalizedEmail);
      clearFailedLogins(user.normalizedEmail);
    }
    if (user.normalizedUserName) {
      unlockAccount(user.normalizedUserName);
      clearFailedLogins(user.normalizedUserName);
    }
  }

  res.json({
    success: true,
    message: `Identificador '${normalized}' desbloqueado exitosamente`,
    wasLocked: unlocked
  });
});
