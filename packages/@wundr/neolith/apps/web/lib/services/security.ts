/**
 * Security Service
 *
 * Business logic for account security operations including password management,
 * 2FA, session handling, login history tracking, and security audit logging.
 *
 * @module lib/services/security
 */

import * as crypto from 'crypto';

import { prisma } from '@neolith/database';

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return hash === verifyHash;
}

/**
 * Generate TOTP secret for 2FA
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  return buffer.toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 32);
}

/**
 * Generate backup codes for 2FA
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(6).toString('hex');
    codes.push(
      `${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}`,
    );
  }
  return codes;
}

/**
 * Verify TOTP code
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  // In production, use a proper TOTP library like 'otplib'
  // This is a simplified implementation
  const window = 1; // Allow codes from 1 time window before/after
  const timeStep = 30; // 30 second time steps
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);

  for (let i = -window; i <= window; i++) {
    const testCode = generateTOTPCodeForTime(secret, currentTime + i);
    if (testCode === code) {
      return true;
    }
  }
  return false;
}

/**
 * Generate TOTP code for a specific time
 */
function generateTOTPCodeForTime(secret: string, timeCounter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeCounter));

  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const code = binary % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate phone verification code
 */
export function generatePhoneVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Parse user agent string
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'desktop';

  // Parse browser
  if (userAgent.includes('Chrome')) {
browser = 'Chrome';
} else if (userAgent.includes('Safari')) {
browser = 'Safari';
} else if (userAgent.includes('Firefox')) {
browser = 'Firefox';
} else if (userAgent.includes('Edge')) {
browser = 'Edge';
}

  // Parse OS
  if (userAgent.includes('Windows')) {
os = 'Windows';
} else if (userAgent.includes('Mac')) {
os = 'macOS';
} else if (userAgent.includes('Linux')) {
os = 'Linux';
} else if (userAgent.includes('Android')) {
os = 'Android';
} else if (userAgent.includes('iOS')) {
os = 'iOS';
}

  // Parse device type
  if (userAgent.includes('Mobile')) {
device = 'mobile';
} else if (userAgent.includes('Tablet')) {
device = 'tablet';
}

  return { browser, os, device };
}

/**
 * Get approximate location from IP address
 * In production, use a proper geolocation service like MaxMind
 */
export async function getLocationFromIP(
  ip: string,
): Promise<{ city: string; country: string }> {
  // Simplified implementation - in production use a proper geolocation service
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
    return { city: 'Local', country: 'Local' };
  }

  // Default fallback
  return { city: 'Unknown', country: 'Unknown' };
}

/**
 * Log security event to audit log
 */
export async function logSecurityEvent(params: {
  userId: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const {
    userId,
    eventType,
    severity,
    description,
    metadata,
    ipAddress,
    userAgent,
  } = params;

  try {
    await prisma.$executeRaw`
      INSERT INTO security_audit_logs (
        id, user_id, event_type, severity, description,
        metadata, ip_address, user_agent, created_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${eventType},
        ${severity},
        ${description},
        ${JSON.stringify(metadata || {})},
        ${ipAddress || null},
        ${userAgent || null},
        ${new Date()}
      )
    `;
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

/**
 * Record login attempt
 */
export async function recordLoginAttempt(params: {
  userId: string;
  status: 'success' | 'failed' | 'blocked';
  ipAddress: string;
  userAgent: string;
  failureReason?: string;
}): Promise<void> {
  const { userId, status, ipAddress, userAgent, failureReason } = params;

  const agentInfo = parseUserAgent(userAgent);
  const location = await getLocationFromIP(ipAddress);

  try {
    await prisma.$executeRaw`
      INSERT INTO login_history (
        id, user_id, status, ip_address, user_agent,
        browser, os, device_type, city, country,
        failure_reason, created_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${status},
        ${ipAddress},
        ${userAgent},
        ${agentInfo.browser},
        ${agentInfo.os},
        ${agentInfo.device},
        ${location.city},
        ${location.country},
        ${failureReason || null},
        ${new Date()}
      )
    `;
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
}

/**
 * Check if user should be rate limited
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Get recent attempts from a rate_limit table or cache
    // Simplified implementation - in production use Redis
    const attempts = await prisma.$queryRaw<Array<{ created_at: Date }>>`
      SELECT created_at FROM rate_limits
      WHERE user_id = ${userId}
      AND action = ${action}
      AND created_at > ${new Date(windowStart)}
    `;

    if (attempts.length >= limit) {
      return false; // Rate limited
    }

    // Record this attempt
    await prisma.$executeRaw`
      INSERT INTO rate_limits (id, user_id, action, created_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${action}, ${new Date()})
    `;

    return true; // Not rate limited
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open - allow the action
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM sessions
      WHERE expires_at < ${new Date()}
    `;
    return result as number;
  } catch (error) {
    console.error('Failed to clean up expired sessions:', error);
    return 0;
  }
}

/**
 * Clean up old login history entries
 */
export async function cleanupOldLoginHistory(
  retentionDays: number = 90,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM login_history
      WHERE created_at < ${cutoffDate}
    `;
    return result as number;
  } catch (error) {
    console.error('Failed to clean up login history:', error);
    return 0;
  }
}

/**
 * Clean up old audit logs
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = 365,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM security_audit_logs
      WHERE created_at < ${cutoffDate}
    `;
    return result as number;
  } catch (error) {
    console.error('Failed to clean up audit logs:', error);
    return 0;
  }
}
