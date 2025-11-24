/**
 * @fileoverview Daemon Authentication Service
 * Provides authentication and authorization for VP daemons connecting to the Genesis platform.
 *
 * @packageDocumentation
 */

import { DAEMON_TOKEN_EXPIRY, DAEMON_REDIS_KEYS, DAEMON_SCOPE_SETS } from '../types/daemon';

import type {
  DaemonToken,
  DaemonTokenPair,
  DaemonTokenPayload,
  DaemonCredentials,
  DaemonAuthResult,
  DaemonSession,
  DaemonSessionStatus,
  DaemonScope,
  DaemonMetrics,
  DaemonMetadata,
} from '../types/daemon';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// Configuration Types
// =============================================================================

export interface DaemonAuthServiceConfig {
  /** Prisma client for database operations */
  prisma: PrismaClient;

  /** Redis client for session management */
  redis: Redis;

  /** JWT secret for token signing/verification */
  jwtSecret: string;

  /** Token issuer (defaults to 'genesis-platform') */
  issuer?: string;

  /** Token audience (defaults to 'genesis-api') */
  audience?: string;

  /** Access token TTL in seconds (defaults to 3600) */
  accessTokenTtl?: number;

  /** Refresh token TTL in seconds (defaults to 604800) */
  refreshTokenTtl?: number;

  /** Session TTL in seconds (defaults to 86400) */
  sessionTtl?: number;
}

// =============================================================================
// Error Classes
// =============================================================================

export class DaemonAuthError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode = 401) {
    super(message);
    this.name = 'DaemonAuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InvalidCredentialsError extends DaemonAuthError {
  constructor(message = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

export class TokenExpiredError extends DaemonAuthError {
  constructor(message = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED', 401);
  }
}

export class TokenRevokedError extends DaemonAuthError {
  constructor(message = 'Token has been revoked') {
    super(message, 'TOKEN_REVOKED', 401);
  }
}

export class SessionNotFoundError extends DaemonAuthError {
  constructor(message = 'Session not found') {
    super(message, 'SESSION_NOT_FOUND', 401);
  }
}

export class InsufficientScopeError extends DaemonAuthError {
  constructor(requiredScope: string) {
    super(`Insufficient scope: ${requiredScope} required`, 'INSUFFICIENT_SCOPE', 403);
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

export class DaemonAuthService {
  private prisma: PrismaClient;
  private redis: Redis;
  private jwtSecret: string;
  private issuer: string;
  private audience: string;
  private accessTokenTtl: number;
  private refreshTokenTtl: number;
  private sessionTtl: number;

  constructor(config: DaemonAuthServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.jwtSecret = config.jwtSecret;
    this.issuer = config.issuer ?? 'genesis-platform';
    this.audience = config.audience ?? 'genesis-api';
    this.accessTokenTtl = config.accessTokenTtl ?? DAEMON_TOKEN_EXPIRY.accessTokenSeconds;
    this.refreshTokenTtl = config.refreshTokenTtl ?? DAEMON_TOKEN_EXPIRY.refreshTokenSeconds;
    this.sessionTtl = config.sessionTtl ?? DAEMON_TOKEN_EXPIRY.sessionSeconds;
  }

  /**
   * Authenticate a daemon using VP API key.
   */
  async authenticate(credentials: DaemonCredentials): Promise<DaemonAuthResult> {
    // Validate API key and get VP
    // Note: We look for any VP user that has vpConfig set
    const user = await this.prisma.user.findFirst({
      where: {
        isVP: true,
        vpConfig: {
          not: { equals: null },
        },
      },
    });

    if (!user) {
      throw new InvalidCredentialsError('Invalid API key');
    }

    /**
     * VP configuration stored as JSON in the user record.
     */
    interface VPConfig {
      apiKeyHash?: string;
      apiKeyRevoked?: boolean;
      apiKeyExpiresAt?: string;
    }

    // Verify API key hash
    const vpConfig = user.vpConfig as VPConfig | null;
    const storedHash = vpConfig?.apiKeyHash;

    if (!storedHash || !await this.verifyApiKey(credentials.apiKey, storedHash)) {
      throw new InvalidCredentialsError('Invalid API key');
    }

    // Check if API key is revoked
    if (vpConfig?.apiKeyRevoked) {
      throw new InvalidCredentialsError('API key has been revoked');
    }

    // Check if API key is expired
    const expiresAt = vpConfig?.apiKeyExpiresAt;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new InvalidCredentialsError('API key has expired');
    }

    // Get VP record
    const vp = await this.prisma.vP.findFirst({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            workspaces: {
              take: 1,
            },
          },
        },
      },
    });

    if (!vp) {
      throw new InvalidCredentialsError('VP not found');
    }

    const workspace = vp.organization?.workspaces?.[0];
    if (!workspace) {
      throw new InvalidCredentialsError('No workspace found for VP');
    }

    // Determine granted scopes
    const requestedScopes = credentials.requestedScopes ?? DAEMON_SCOPE_SETS.standard;
    const vpCapabilities = Array.isArray(vp.capabilities) ? vp.capabilities as string[] : [];
    const grantedScopes = this.resolveScopes(requestedScopes, vpCapabilities);

    // Create session
    const session = await this.createSession({
      daemonId: credentials.daemonId,
      vpId: vp.id,
      workspaceId: workspace.id,
      organizationId: vp.organizationId,
      scopes: grantedScopes,
      metadata: credentials.metadata,
    });

    // Generate tokens
    const tokens = await this.generateTokenPair({
      daemonId: credentials.daemonId,
      vpId: vp.id,
      workspaceId: workspace.id,
      organizationId: vp.organizationId,
      scopes: grantedScopes,
      sessionId: session.id,
    });

    return {
      tokens,
      vp: {
        id: vp.id,
        name: user.name ?? user.displayName ?? 'VP',
        discipline: vp.discipline,
        role: vp.role,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      grantedScopes,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshToken(refreshToken: string): Promise<DaemonTokenPair> {
    const payload = await this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new DaemonAuthError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    // Verify session still exists and is active
    const session = await this.getSession(payload.jti);
    if (!session || session.status !== 'active') {
      throw new SessionNotFoundError();
    }

    // Generate new token pair
    const tokens = await this.generateTokenPair({
      daemonId: payload.daemonId,
      vpId: payload.sub,
      workspaceId: payload.workspaceId,
      organizationId: payload.organizationId,
      scopes: payload.scopes,
      sessionId: session.id,
    });

    // Update session activity
    await this.updateSessionActivity(session.id);

    return tokens;
  }

  /**
   * Validate an access token and return the token payload.
   */
  async validateToken(accessToken: string): Promise<DaemonToken> {
    const payload = await this.verifyToken(accessToken);

    if (payload.type !== 'access') {
      throw new DaemonAuthError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    // Check if token is revoked
    const isRevoked = await this.redis.sismember(DAEMON_REDIS_KEYS.revokedTokens, payload.jti);
    if (isRevoked) {
      throw new TokenRevokedError();
    }

    return {
      token: accessToken,
      type: 'access',
      expiresAt: new Date(payload.exp * 1000),
      daemonId: payload.daemonId,
      vpId: payload.sub,
      workspaceId: payload.workspaceId,
      organizationId: payload.organizationId,
      scopes: payload.scopes,
      sessionId: payload.jti,
    };
  }

  /**
   * Revoke a token.
   */
  async revokeToken(token: string): Promise<void> {
    const payload = await this.verifyToken(token);
    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.redis.sadd(DAEMON_REDIS_KEYS.revokedTokens, payload.jti);
      // Set expiry on the revoked token entry
      await this.redis.expire(DAEMON_REDIS_KEYS.revokedTokens, ttl);
    }
  }

  /**
   * Terminate a session.
   */
  async terminateSession(sessionId: string, reason: DaemonSessionStatus = 'terminated'): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
return;
}

    session.status = reason;
    await this.saveSession(session);

    // Clean up session references
    await this.redis.srem(DAEMON_REDIS_KEYS.vpSessions(session.vpId), sessionId);
    await this.redis.srem(DAEMON_REDIS_KEYS.daemonSessions(session.daemonId), sessionId);
  }

  /**
   * Get active sessions for a daemon.
   */
  async getActiveSessions(daemonId: string): Promise<DaemonSession[]> {
    const sessionIds = await this.redis.smembers(DAEMON_REDIS_KEYS.daemonSessions(daemonId));
    const sessions: DaemonSession[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session && session.status === 'active') {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Update heartbeat for a session.
   */
  async updateHeartbeat(
    sessionId: string,
    status: DaemonSessionStatus = 'active',
    metrics?: DaemonMetrics,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    session.status = status;
    session.lastActiveAt = new Date();
    if (metrics) {
      session.metrics = { ...session.metrics, ...metrics };
    }

    await this.saveSession(session);
  }

  /**
   * Check if a token has a specific scope.
   */
  hasScope(token: DaemonToken, requiredScope: DaemonScope): boolean {
    return token.scopes.includes(requiredScope);
  }

  /**
   * Check if a token has all required scopes.
   */
  hasScopes(token: DaemonToken, requiredScopes: DaemonScope[]): boolean {
    return requiredScopes.every(scope => token.scopes.includes(scope));
  }

  /**
   * Require a specific scope or throw error.
   */
  requireScope(token: DaemonToken, requiredScope: DaemonScope): void {
    if (!this.hasScope(token, requiredScope)) {
      throw new InsufficientScopeError(requiredScope);
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async generateTokenPair(params: {
    daemonId: string;
    vpId: string;
    workspaceId: string;
    organizationId?: string;
    scopes: DaemonScope[];
    sessionId: string;
  }): Promise<DaemonTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessJti = this.generateJti();
    const refreshJti = this.generateJti();

    const accessPayload: DaemonTokenPayload = {
      sub: params.vpId,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.accessTokenTtl,
      jti: accessJti,
      daemonId: params.daemonId,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      scopes: params.scopes,
      type: 'access',
    };

    const refreshPayload: DaemonTokenPayload = {
      ...accessPayload,
      exp: now + this.refreshTokenTtl,
      jti: refreshJti,
      type: 'refresh',
    };

    const accessToken = await this.signToken(accessPayload);
    const refreshToken = await this.signToken(refreshPayload);

    return {
      accessToken: {
        token: accessToken,
        type: 'access',
        expiresAt: new Date((now + this.accessTokenTtl) * 1000),
        daemonId: params.daemonId,
        vpId: params.vpId,
        workspaceId: params.workspaceId,
        organizationId: params.organizationId,
        scopes: params.scopes,
        sessionId: params.sessionId,
      },
      refreshToken: {
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date((now + this.refreshTokenTtl) * 1000),
        daemonId: params.daemonId,
        vpId: params.vpId,
        workspaceId: params.workspaceId,
        organizationId: params.organizationId,
        scopes: params.scopes,
        sessionId: params.sessionId,
      },
    };
  }

  private async createSession(params: {
    daemonId: string;
    vpId: string;
    workspaceId: string;
    organizationId?: string;
    scopes: DaemonScope[];
    metadata?: DaemonMetadata;
  }): Promise<DaemonSession> {
    const now = new Date();
    const session: DaemonSession = {
      id: this.generateJti(),
      daemonId: params.daemonId,
      vpId: params.vpId,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      status: 'active',
      scopes: params.scopes,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + this.sessionTtl * 1000),
      metadata: params.metadata,
    };

    await this.saveSession(session);

    // Add to session indices
    await this.redis.sadd(DAEMON_REDIS_KEYS.vpSessions(params.vpId), session.id);
    await this.redis.sadd(DAEMON_REDIS_KEYS.daemonSessions(params.daemonId), session.id);

    return session;
  }

  private async saveSession(session: DaemonSession): Promise<void> {
    const key = DAEMON_REDIS_KEYS.session(session.id);
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);

    if (ttl > 0) {
      await this.redis.setex(key, ttl, JSON.stringify(session));
    }
  }

  private async getSession(sessionId: string): Promise<DaemonSession | null> {
    const key = DAEMON_REDIS_KEYS.session(sessionId);
    const data = await this.redis.get(key);

    if (!data) {
return null;
}

    const session = JSON.parse(data) as DaemonSession;
    session.createdAt = new Date(session.createdAt);
    session.lastActiveAt = new Date(session.lastActiveAt);
    session.expiresAt = new Date(session.expiresAt);

    return session;
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActiveAt = new Date();
      await this.saveSession(session);
    }
  }

  /**
   * Resolves the scopes to grant based on requested scopes and VP capabilities.
   *
   * @param requested - Scopes requested by the daemon
   * @param vpCapabilities - Capabilities configured for the VP
   * @returns Array of granted scopes
   */
  private resolveScopes(requested: DaemonScope[], vpCapabilities: string[]): DaemonScope[] {
    // Build allowed scopes based on VP capabilities
    const allowedScopes = new Set(DAEMON_SCOPE_SETS.full);

    // If VP has specific capabilities configured, restrict scopes accordingly
    if (vpCapabilities.length > 0) {
      // Map capabilities to allowed scope sets
      const capabilityToScopes: Record<string, DaemonScope[]> = {
        messaging: ['messages:read', 'messages:write', 'channels:read'],
        channels: ['channels:read', 'channels:join'],
        presence: ['presence:read', 'presence:write'],
        files: ['files:read', 'files:write'],
        calls: ['calls:join', 'calls:manage'],
        users: ['users:read'],
        admin: ['admin:read', 'admin:write'],
      };

      // Build restricted scope set from capabilities
      const restrictedScopes = new Set<DaemonScope>();
      for (const capability of vpCapabilities) {
        const scopes = capabilityToScopes[capability];
        if (scopes) {
          scopes.forEach(scope => restrictedScopes.add(scope));
        }
      }

      // Always allow basic VP scopes
      restrictedScopes.add('vp:status');
      restrictedScopes.add('vp:config');

      // Return intersection of requested, allowed, and restricted
      return requested.filter(
        scope => allowedScopes.has(scope) && restrictedScopes.has(scope),
      );
    }

    // No capability restrictions - grant all allowed requested scopes
    return requested.filter(scope => allowedScopes.has(scope));
  }

  private async signToken(payload: DaemonTokenPayload): Promise<string> {
    // Simple base64 encoding for mock implementation
    // In production, use proper JWT signing with jsonwebtoken or jose
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = Buffer.from(
      `${encodedHeader}.${encodedPayload}.${this.jwtSecret}`,
    ).toString('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private async verifyToken(token: string): Promise<DaemonTokenPayload> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new DaemonAuthError('Invalid token format', 'INVALID_TOKEN');
      }

      const encodedPayload = parts[1];
      if (!encodedPayload) {
        throw new DaemonAuthError('Invalid token format', 'INVALID_TOKEN');
      }

      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString(),
      ) as DaemonTokenPayload;

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new TokenExpiredError();
      }

      return payload;
    } catch (error) {
      if (error instanceof DaemonAuthError) {
throw error;
}
      throw new DaemonAuthError('Invalid token', 'INVALID_TOKEN');
    }
  }

  private async verifyApiKey(apiKey: string, storedHash: string): Promise<boolean> {
    // Simple comparison for mock implementation
    // In production, use proper password hashing (argon2, bcrypt)
    const keyHash = Buffer.from(apiKey).toString('base64');
    return keyHash === storedHash || apiKey === storedHash;
  }

  /**
   * Generate a unique JWT ID (jti) using crypto.randomUUID().
   *
   * @returns A unique identifier for the token
   */
  private generateJti(): string {
    return `${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new DaemonAuthService instance.
 */
export function createDaemonAuthService(config: DaemonAuthServiceConfig): DaemonAuthService {
  return new DaemonAuthService(config);
}

export default DaemonAuthService;
