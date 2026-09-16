import crypto from 'crypto';

// Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'collabpulse_enterprise_secure_jwt_secret_2026_key_!@#$';
export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// 1. Password Policy Checker
export interface PasswordValidationResult {
  isValid: boolean;
  valid?: boolean;
  errors: string[];
  score: number; // 0 to 4
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial (!@#$%^&*)');
  }

  let score = 0;
  if (password && password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  const isValid = errors.length === 0;
  return {
    isValid,
    valid: isValid,
    errors,
    score
  };
}

// 2. Email Normalization
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizeUserName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '_');
}

export function normalizeIdentifier(identifier: string): string {
  if (!identifier) return '';
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed);
  }
  return normalizeUserName(trimmed);
}

// 3. Password Hashing with Salt (PBKDF2 SHA-512)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

// 4. Secure Random Tokens and Token Hashing
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 5. JWT Implementation (HMAC SHA-256)
export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  workspaceId: string;
  tenantId: string;
  role: string;
  exp: number;
  iat: number;
  [key: string]: any;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signJwt(payload: Record<string, any>, secret: string = JWT_SECRET, expiresInSeconds: number = ACCESS_TOKEN_LIFETIME_SECONDS): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    sub: payload.sub,
    email: payload.email,
    sessionId: payload.sessionId,
    workspaceId: payload.workspaceId,
    tenantId: payload.tenantId,
    role: payload.role,
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt<T = JwtPayload>(token: string, secret: string = JWT_SECRET): { valid: boolean; payload?: T; error?: string } {
  if (!token) {
    return { valid: false, error: 'Token no provisto' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Formato de token inválido' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return { valid: false, error: 'Firma de token inválida' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T & { exp?: number };
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expirado', payload };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Error decodificando payload de token' };
  }
}

// 6. User-Agent and Device Parser
export function parseDevice(userAgent: string = ''): { deviceName: string; deviceType: 'desktop' | 'mobile' | 'tablet'; browser: string; os: string } {
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let os = 'Windows';
  let browser = 'Chrome';

  if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'tablet';
  } else if (/mobile|android|iphone/i.test(userAgent)) {
    deviceType = 'mobile';
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macOS';
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    os = 'Android';
  } else if (/iphone|ipad/i.test(userAgent)) {
    os = 'iOS';
  }

  if (/firefox/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = 'Safari';
  }

  const deviceName = `${browser} en ${os} (${deviceType === 'desktop' ? 'Equipo de escritorio' : deviceType === 'mobile' ? 'Dispositivo móvil' : 'Tableta'})`;

  return { deviceName, deviceType, browser, os };
}

export const parseUserAgent = parseDevice;

// 7. Rate Limiting (Volumetric Request Protection - HTTP 429)
export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

const rateLimitRegistry = new Map<string, RateLimitRecord>();

/**
 * IP / Endpoint Volumetric Rate Limiter
 * Standard sliding/fixed window tracker returning headers-compliant data
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitRegistry.get(key);

  if (!record || record.resetTime < now) {
    rateLimitRegistry.set(key, { count: 1, resetTime: now + windowMs });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
      retryAfterSeconds: 0
    };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfterSeconds
    };
  }

  record.count++;
  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
    retryAfterSeconds: 0
  };
}

export function clearRateLimit(key: string): void {
  rateLimitRegistry.delete(key);
}

// 8. Account Lockout & Brute Force Protection (Per-Account Identity - HTTP 423)
// Never lock an IP solely to avoid blocking whole offices or proxies!
export interface LockoutRecord {
  identifier: string;
  failedAttempts: number;
  lockedUntil: number;
  lastAttemptAt: number;
  lockoutCount: number;
  recentIps: string[];
}

const accountLockouts = new Map<string, LockoutRecord>();

/**
 * Checks if a specific account identifier (email/username) is currently locked out
 */
export function isAccountLocked(identifier: string): { isLocked: boolean; remainingSeconds: number; lockedUntil?: number } {
  if (!identifier) return { isLocked: false, remainingSeconds: 0 };
  const key = normalizeIdentifier(identifier);
  const now = Date.now();
  const record = accountLockouts.get(key);

  if (record && record.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return { isLocked: true, remainingSeconds, lockedUntil: record.lockedUntil };
  }

  // If lockout period has passed, reset the lock while retaining history
  if (record && record.lockedUntil > 0 && record.lockedUntil <= now) {
    record.lockedUntil = 0;
    record.failedAttempts = 0;
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records a failed credential attempt against an account identifier.
 * Progressive lockout: 5 attempts = 5 minutes lockout. Subsequent lockouts extend dynamically.
 */
export function recordFailedLogin(
  identifier: string,
  ip?: string
): { isLocked: boolean; remainingAttempts: number; remainingSeconds: number } {
  if (!identifier) return { isLocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS, remainingSeconds: 0 };
  const key = normalizeIdentifier(identifier);
  const now = Date.now();
  const record = accountLockouts.get(key) || {
    identifier: key,
    failedAttempts: 0,
    lockedUntil: 0,
    lastAttemptAt: now,
    lockoutCount: 0,
    recentIps: []
  };

  // Track recent IPs for audit
  if (ip && !record.recentIps.includes(ip)) {
    record.recentIps.push(ip);
    if (record.recentIps.length > 5) record.recentIps.shift();
  }

  // If already locked, do not extend repeatedly
  if (record.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return { isLocked: true, remainingAttempts: 0, remainingSeconds };
  }

  record.failedAttempts++;
  record.lastAttemptAt = now;

  if (record.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockoutCount++;
    // Progressive duration: 5min, 10min, max 30min
    const multiplier = Math.min(record.lockoutCount, 6);
    const duration = LOCKOUT_DURATION_MS * multiplier;
    record.lockedUntil = now + duration;
    accountLockouts.set(key, record);

    const remainingSeconds = Math.ceil(duration / 1000);
    return { isLocked: true, remainingAttempts: 0, remainingSeconds };
  }

  accountLockouts.set(key, record);
  return {
    isLocked: false,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - record.failedAttempts),
    remainingSeconds: 0
  };
}

/**
 * Resets failed attempts upon a successful login
 */
export function clearFailedLogins(identifier: string): void {
  if (!identifier) return;
  const key = normalizeIdentifier(identifier);
  accountLockouts.delete(key);
}

/**
 * Administrative manual unlock
 */
export function unlockAccount(identifier: string): boolean {
  if (!identifier) return false;
  const key = normalizeIdentifier(identifier);
  const existed = accountLockouts.has(key);
  accountLockouts.delete(key);
  return existed;
}

/**
 * Observability: get active lockouts count and summary
 */
export function getSecurityStats() {
  const now = Date.now();
  const activeLockouts = Array.from(accountLockouts.values()).filter(r => r.lockedUntil > now);
  return {
    activeLockoutsCount: activeLockouts.length,
    activeLockouts: activeLockouts.map(r => ({
      identifier: r.identifier,
      remainingSeconds: Math.ceil((r.lockedUntil - now) / 1000),
      failedAttempts: r.failedAttempts,
      lockoutCount: r.lockoutCount,
      recentIps: r.recentIps
    })),
    rateLimitKeysTracked: rateLimitRegistry.size
  };
}

// 9. Grace Period Token Rotation Store (Prevents race conditions in parallel requests)
interface TokenGraceRecord {
  newRawRefreshToken: string;
  newAccessToken: string;
  expiresAt: number;
}
const tokenRotationGraceMap = new Map<string, TokenGraceRecord>();

export function registerRotatedToken(oldTokenHash: string, newRawRefreshToken: string, newAccessToken: string, graceSeconds: number = 30) {
  tokenRotationGraceMap.set(oldTokenHash, {
    newRawRefreshToken,
    newAccessToken,
    expiresAt: Date.now() + graceSeconds * 1000
  });

  // Cleanup old grace tokens periodically
  if (tokenRotationGraceMap.size > 200) {
    const now = Date.now();
    for (const [k, v] of tokenRotationGraceMap.entries()) {
      if (v.expiresAt < now) tokenRotationGraceMap.delete(k);
    }
  }
}

export function getRotatedTokenGrace(oldTokenHash: string): TokenGraceRecord | null {
  const record = tokenRotationGraceMap.get(oldTokenHash);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    tokenRotationGraceMap.delete(oldTokenHash);
    return null;
  }
  return record;
}

// 8. Content Sanitizer for XSS Prevention
export function sanitizeText(content: string): string {
  if (!content) return '';
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, 'blocked:');
}
