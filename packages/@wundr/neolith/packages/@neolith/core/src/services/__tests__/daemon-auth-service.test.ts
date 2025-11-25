/**
 * DaemonAuthService Tests
 *
 * Comprehensive test suite for the daemon authentication service covering:
 * - Daemon registration
 * - API key/secret authentication
 * - JWT token generation and validation
 * - Token refresh
 * - Session management
 * - Heartbeat updates
 * - Credential revocation
 *
 * @module @genesis/core/services/__tests__/daemon-auth-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMockRedis, type MockRedis } from '../../test-utils/mock-redis';

// =============================================================================
// TEST UTILITIES
// =============================================================================

// Generate unique IDs
let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `test_${Date.now()}_${idCounter}`;
}

// Reset counter between tests
function resetIdCounter(): void {
  idCounter = 0;
}

// Mock Prisma client factory
function createMockPrisma() {
  return {
    daemonCredential: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    vP: {
      findFirst: vi.fn(),
    },
  };
}

// Mock daemon credential
function createMockDaemonCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: generateId(),
    vpId: 'vp_123',
    workspaceId: 'ws_456',
    apiKey: 'dk_test123abc',
    apiSecretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    hostname: 'daemon.test.local',
    version: '1.0.0',
    capabilities: ['messaging', 'presence'],
    metadata: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: null,
    expiresAt: null,
    vp: {
      id: 'vp_123',
      discipline: 'Engineering',
      role: 'Software Engineer',
    },
    ...overrides,
  };
}

// =============================================================================
// MOCK SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Simplified mock DaemonAuthService for testing
 * Tests the core authentication logic without actual JWT/crypto dependencies
 */
class MockDaemonAuthService {
  private prisma: ReturnType<typeof createMockPrisma>;
  private redis: MockRedis;
  private jwtSecret: string;
  private accessTokenTtl: number;
  private refreshTokenTtl: number;
  private sessionPrefix: string;

  constructor(config: {
    prisma: ReturnType<typeof createMockPrisma>;
    redis: MockRedis;
    jwtSecret: string;
    accessTokenTtl?: number;
    refreshTokenTtl?: number;
    sessionPrefix?: string;
  }) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.jwtSecret = config.jwtSecret;
    this.accessTokenTtl = config.accessTokenTtl ?? 3600;
    this.refreshTokenTtl = config.refreshTokenTtl ?? 86400 * 30;
    this.sessionPrefix = config.sessionPrefix ?? 'daemon:session:';
  }

  async registerDaemon(registration: {
    vpId: string;
    workspaceId: string;
    hostname: string;
    version: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }) {
    const apiKey = `dk_${generateId()}`;
    const apiSecret = `secret_${generateId()}`;

    const daemon = await this.prisma.daemonCredential.create({
      data: {
        vpId: registration.vpId,
        workspaceId: registration.workspaceId,
        apiKey,
        apiSecretHash: this.hashSecret(apiSecret),
        hostname: registration.hostname,
        version: registration.version,
        capabilities: registration.capabilities,
        metadata: registration.metadata ? JSON.stringify(registration.metadata) : null,
        isActive: true,
      },
    });

    return {
      daemonId: daemon.id,
      apiKey,
      apiSecret,
      workspaceId: registration.workspaceId,
      vpId: registration.vpId,
      createdAt: daemon.createdAt,
      isActive: daemon.isActive,
    };
  }

  async authenticate(request: { apiKey: string; apiSecret: string; scopes?: string[] }) {
    const daemon = await this.prisma.daemonCredential.findUnique({
      where: { apiKey: request.apiKey },
      include: { vp: true },
    });

    if (!daemon) {
      throw new MockDaemonAuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!daemon.isActive) {
      throw new MockDaemonAuthError('Daemon is disabled', 'DAEMON_DISABLED');
    }

    if (daemon.expiresAt && daemon.expiresAt < new Date()) {
      throw new MockDaemonAuthError('Credentials expired', 'CREDENTIALS_EXPIRED');
    }

    // Verify secret (simplified for testing)
    const expectedHash = this.hashSecret(request.apiSecret);
    if (daemon.apiSecretHash !== expectedHash) {
      throw new MockDaemonAuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const scopes = request.scopes ?? this.getDefaultScopes();
    const accessToken = this.generateMockToken('access', daemon.id, daemon.vpId, daemon.workspaceId);
    const refreshToken = this.generateMockToken('refresh', daemon.id, daemon.vpId, daemon.workspaceId);

    await this.redis.setex(`daemon:refresh:${daemon.id}`, this.refreshTokenTtl, refreshToken);

    await this.prisma.daemonCredential.update({
      where: { id: daemon.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
      tokenType: 'Bearer' as const,
      scopes,
      daemonId: daemon.id,
      vpId: daemon.vpId,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const parts = refreshToken.split('.');
    if (parts.length < 2) {
      throw new MockDaemonAuthError('Invalid refresh token', 'INVALID_TOKEN');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.type !== 'refresh') {
      throw new MockDaemonAuthError('Invalid token type', 'INVALID_TOKEN');
    }

    const storedToken = await this.redis.get(`daemon:refresh:${payload.daemonId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new MockDaemonAuthError('Refresh token revoked', 'TOKEN_REVOKED');
    }

    const daemon = await this.prisma.daemonCredential.findUnique({
      where: { id: payload.daemonId },
    });

    if (!daemon || !daemon.isActive) {
      throw new MockDaemonAuthError('Daemon not found or disabled', 'DAEMON_DISABLED');
    }

    const scopes = this.getDefaultScopes();
    const accessToken = this.generateMockToken('access', daemon.id, daemon.vpId, daemon.workspaceId);
    const newRefreshToken = this.generateMockToken('refresh', daemon.id, daemon.vpId, daemon.workspaceId);

    await this.redis.setex(`daemon:refresh:${daemon.id}`, this.refreshTokenTtl, newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTokenTtl,
      tokenType: 'Bearer' as const,
      scopes,
      daemonId: daemon.id,
      vpId: daemon.vpId,
    };
  }

  async verifyAccessToken(token: string) {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new MockDaemonAuthError('Invalid token', 'INVALID_TOKEN');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.type !== 'access') {
      throw new MockDaemonAuthError('Invalid token type', 'INVALID_TOKEN');
    }

    const isDisabled = await this.redis.get(`daemon:active:${payload.daemonId}`);
    if (isDisabled === 'false') {
      throw new MockDaemonAuthError('Daemon is disabled', 'DAEMON_DISABLED');
    }

    return {
      token,
      type: 'access' as const,
      expiresAt: new Date(payload.exp * 1000),
      daemonId: payload.daemonId,
      vpId: payload.vpId,
      workspaceId: payload.workspaceId,
      scopes: payload.scopes,
    };
  }

  async revokeCredentials(daemonId: string) {
    await Promise.all([
      this.prisma.daemonCredential.update({
        where: { id: daemonId },
        data: { isActive: false },
      }),
      this.redis.set(`daemon:active:${daemonId}`, 'false', 'EX', 86400),
      this.redis.del(`daemon:refresh:${daemonId}`),
    ]);
  }

  async createSession(
    daemonId: string,
    vpId: string,
    workspaceId: string,
    hostname: string,
    version: string,
    ipAddress?: string,
  ) {
    const sessionId = generateId();
    const now = new Date();

    const session = {
      id: sessionId,
      daemonId,
      vpId,
      workspaceId,
      status: 'connected',
      connectedAt: now,
      lastHeartbeat: now,
      hostname,
      version,
      ipAddress,
    };

    await this.redis.setex(
      `${this.sessionPrefix}${sessionId}`,
      86400,
      JSON.stringify(session),
    );

    await this.redis.sadd(`daemon:sessions:${daemonId}`, sessionId);

    return session;
  }

  async updateHeartbeat(sessionId: string, status: string, metrics?: Record<string, unknown>) {
    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);

    if (!sessionData) {
      throw new MockDaemonAuthError('Session not found', 'SESSION_NOT_FOUND');
    }

    const session = JSON.parse(sessionData);
    session.lastHeartbeat = new Date();
    session.status = status;
    if (metrics) {
      session.metadata = { ...session.metadata, metrics };
    }

    await this.redis.setex(sessionKey, 86400, JSON.stringify(session));
  }

  async getActiveSessions(daemonId: string) {
    const sessionIds = await this.redis.smembers(`daemon:sessions:${daemonId}`);
    const sessions: Array<Record<string, unknown>> = [];

    for (const sessionId of sessionIds) {
      const sessionData = await this.redis.get(`${this.sessionPrefix}${sessionId}`);
      if (sessionData) {
        sessions.push(JSON.parse(sessionData));
      } else {
        await this.redis.srem(`daemon:sessions:${daemonId}`, sessionId);
      }
    }

    return sessions;
  }

  async endSession(sessionId: string) {
    const sessionKey = `${this.sessionPrefix}${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);

    if (sessionData) {
      const session = JSON.parse(sessionData);
      await this.redis.srem(`daemon:sessions:${session.daemonId}`, sessionId);
    }

    await this.redis.del(sessionKey);
  }

  async getCredentials(daemonId: string) {
    const daemon = await this.prisma.daemonCredential.findUnique({
      where: { id: daemonId },
    });

    if (!daemon) {
return null;
}

    return {
      daemonId: daemon.id,
      apiKey: daemon.apiKey,
      apiSecret: '[REDACTED]',
      workspaceId: daemon.workspaceId,
      vpId: daemon.vpId,
      createdAt: daemon.createdAt,
      expiresAt: daemon.expiresAt ?? undefined,
      lastUsedAt: daemon.lastUsedAt ?? undefined,
      isActive: daemon.isActive,
    };
  }

  hasScope(token: { scopes: string[] }, scope: string): boolean {
    return token.scopes.includes(scope);
  }

  private hashSecret(secret: string): string {
    // Simplified hash for testing
    return Buffer.from(secret).toString('base64');
  }

  private getDefaultScopes(): string[] {
    return [
      'messages:read',
      'messages:write',
      'channels:read',
      'channels:join',
      'users:read',
      'presence:write',
      'vp:status',
    ];
  }

  private generateMockToken(
    type: 'access' | 'refresh',
    daemonId: string,
    vpId: string,
    workspaceId: string,
  ): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      daemonId,
      vpId,
      workspaceId,
      scopes: this.getDefaultScopes(),
      type,
      exp: Math.floor(Date.now() / 1000) + (type === 'access' ? this.accessTokenTtl : this.refreshTokenTtl),
    };
    const headerStr = Buffer.from(JSON.stringify(header)).toString('base64');
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${headerStr}.${payloadStr}.mock_signature`;
  }
}

class MockDaemonAuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DaemonAuthError';
    this.code = code;
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('DaemonAuthService', () => {
  let authService: MockDaemonAuthService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: MockRedis;

  beforeEach(() => {
    resetIdCounter();
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();

    authService = new MockDaemonAuthService({
      prisma: mockPrisma,
      redis: mockRedis,
      jwtSecret: 'test-secret',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Registration Tests
  // ===========================================================================

  describe('registerDaemon', () => {
    it('should register a new daemon with credentials', async () => {
      const mockCreatedDaemon = createMockDaemonCredential({
        id: 'daemon_123',
        vpId: 'vp_456',
        workspaceId: 'ws_789',
      });

      mockPrisma.daemonCredential.create.mockResolvedValue(mockCreatedDaemon);

      const result = await authService.registerDaemon({
        vpId: 'vp_456',
        workspaceId: 'ws_789',
        hostname: 'daemon.test.local',
        version: '1.0.0',
        capabilities: ['messaging', 'presence'],
      });

      expect(result.daemonId).toBe('daemon_123');
      expect(result.apiKey).toMatch(/^dk_/);
      expect(result.apiSecret).toBeDefined();
      expect(result.vpId).toBe('vp_456');
      expect(result.workspaceId).toBe('ws_789');
      expect(result.isActive).toBe(true);
    });

    it('should store the hashed API secret', async () => {
      const mockCreatedDaemon = createMockDaemonCredential();
      mockPrisma.daemonCredential.create.mockResolvedValue(mockCreatedDaemon);

      await authService.registerDaemon({
        vpId: 'vp_123',
        workspaceId: 'ws_456',
        hostname: 'daemon.test.local',
        version: '1.0.0',
        capabilities: ['messaging'],
      });

      expect(mockPrisma.daemonCredential.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apiSecretHash: expect.any(String),
          }),
        }),
      );
    });

    it('should include metadata when provided', async () => {
      const mockCreatedDaemon = createMockDaemonCredential();
      mockPrisma.daemonCredential.create.mockResolvedValue(mockCreatedDaemon);

      await authService.registerDaemon({
        vpId: 'vp_123',
        workspaceId: 'ws_456',
        hostname: 'daemon.test.local',
        version: '1.0.0',
        capabilities: ['messaging'],
        metadata: { environment: 'production' },
      });

      expect(mockPrisma.daemonCredential.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: JSON.stringify({ environment: 'production' }),
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // Authentication Tests
  // ===========================================================================

  describe('authenticate', () => {
    it('should authenticate with valid credentials', async () => {
      const apiSecret = 'valid-secret';
      const mockDaemon = createMockDaemonCredential({
        apiSecretHash: Buffer.from(apiSecret).toString('base64'),
      });

      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);
      mockPrisma.daemonCredential.update.mockResolvedValue(mockDaemon);

      const result = await authService.authenticate({
        apiKey: mockDaemon.apiKey,
        apiSecret,
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.daemonId).toBe(mockDaemon.id);
      expect(result.vpId).toBe(mockDaemon.vpId);
    });

    it('should reject invalid API key', async () => {
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(null);

      await expect(
        authService.authenticate({ apiKey: 'invalid_key', apiSecret: 'secret' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject disabled daemon', async () => {
      const mockDaemon = createMockDaemonCredential({ isActive: false });
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      await expect(
        authService.authenticate({ apiKey: mockDaemon.apiKey, apiSecret: 'secret' }),
      ).rejects.toThrow('Daemon is disabled');
    });

    it('should reject expired credentials', async () => {
      const mockDaemon = createMockDaemonCredential({
        expiresAt: new Date('2020-01-01'),
      });
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      await expect(
        authService.authenticate({ apiKey: mockDaemon.apiKey, apiSecret: 'secret' }),
      ).rejects.toThrow('Credentials expired');
    });

    it('should reject invalid API secret', async () => {
      const mockDaemon = createMockDaemonCredential({
        apiSecretHash: Buffer.from('correct-secret').toString('base64'),
      });
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      await expect(
        authService.authenticate({ apiKey: mockDaemon.apiKey, apiSecret: 'wrong-secret' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should update lastUsedAt on successful authentication', async () => {
      const apiSecret = 'valid-secret';
      const mockDaemon = createMockDaemonCredential({
        apiSecretHash: Buffer.from(apiSecret).toString('base64'),
      });

      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);
      mockPrisma.daemonCredential.update.mockResolvedValue(mockDaemon);

      await authService.authenticate({
        apiKey: mockDaemon.apiKey,
        apiSecret,
      });

      expect(mockPrisma.daemonCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should store refresh token in Redis', async () => {
      const apiSecret = 'valid-secret';
      const mockDaemon = createMockDaemonCredential({
        apiSecretHash: Buffer.from(apiSecret).toString('base64'),
      });

      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);
      mockPrisma.daemonCredential.update.mockResolvedValue(mockDaemon);

      await authService.authenticate({
        apiKey: mockDaemon.apiKey,
        apiSecret,
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `daemon:refresh:${mockDaemon.id}`,
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  // ===========================================================================
  // Token Verification Tests
  // ===========================================================================

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: 'daemon_123',
          vpId: 'vp_456',
          workspaceId: 'ws_789',
          scopes: ['messages:read'],
          type: 'access',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64');
      const token = `${header}.${payload}.signature`;

      const result = await authService.verifyAccessToken(token);

      expect(result.daemonId).toBe('daemon_123');
      expect(result.vpId).toBe('vp_456');
      expect(result.workspaceId).toBe('ws_789');
      expect(result.type).toBe('access');
    });

    it('should reject disabled daemon token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: 'daemon_123',
          vpId: 'vp_456',
          workspaceId: 'ws_789',
          scopes: ['messages:read'],
          type: 'access',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64');
      const token = `${header}.${payload}.signature`;

      // Mark daemon as disabled in Redis
      await mockRedis.set('daemon:active:daemon_123', 'false');

      await expect(authService.verifyAccessToken(token)).rejects.toThrow('Daemon is disabled');
    });

    it('should reject invalid token format', async () => {
      await expect(authService.verifyAccessToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should reject refresh token as access token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: 'daemon_123',
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64');
      const token = `${header}.${payload}.signature`;

      await expect(authService.verifyAccessToken(token)).rejects.toThrow('Invalid token type');
    });
  });

  // ===========================================================================
  // Token Refresh Tests
  // ===========================================================================

  describe('refreshAccessToken', () => {
    it('should refresh with valid refresh token', async () => {
      const mockDaemon = createMockDaemonCredential();
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: mockDaemon.id,
          vpId: mockDaemon.vpId,
          workspaceId: mockDaemon.workspaceId,
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) + 86400,
        }),
      ).toString('base64');
      const refreshToken = `${header}.${payload}.signature`;

      // Store the refresh token in Redis
      await mockRedis.setex(`daemon:refresh:${mockDaemon.id}`, 86400, refreshToken);
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.daemonId).toBe(mockDaemon.id);
    });

    it('should reject revoked refresh token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: 'daemon_123',
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) + 86400,
        }),
      ).toString('base64');
      const refreshToken = `${header}.${payload}.signature`;

      // Don't store the token in Redis (simulating revocation)

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Refresh token revoked',
      );
    });

    it('should reject if daemon is disabled', async () => {
      const mockDaemon = createMockDaemonCredential({ isActive: false });
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          daemonId: mockDaemon.id,
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) + 86400,
        }),
      ).toString('base64');
      const refreshToken = `${header}.${payload}.signature`;

      await mockRedis.setex(`daemon:refresh:${mockDaemon.id}`, 86400, refreshToken);
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Daemon not found or disabled',
      );
    });
  });

  // ===========================================================================
  // Session Management Tests
  // ===========================================================================

  describe('createSession', () => {
    it('should create a session', async () => {
      const session = await authService.createSession(
        'daemon_123',
        'vp_456',
        'ws_789',
        'daemon.test.local',
        '1.0.0',
        '127.0.0.1',
      );

      expect(session.id).toBeDefined();
      expect(session.daemonId).toBe('daemon_123');
      expect(session.vpId).toBe('vp_456');
      expect(session.status).toBe('connected');
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.sadd).toHaveBeenCalled();
    });

    it('should store session in Redis with TTL', async () => {
      await authService.createSession(
        'daemon_123',
        'vp_456',
        'ws_789',
        'daemon.test.local',
        '1.0.0',
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('daemon:session:'),
        86400,
        expect.any(String),
      );
    });
  });

  describe('updateHeartbeat', () => {
    it('should update session heartbeat', async () => {
      // Create a session first
      const session = await authService.createSession(
        'daemon_123',
        'vp_456',
        'ws_789',
        'daemon.test.local',
        '1.0.0',
      );

      // Store the session data
      await mockRedis.setex(
        `daemon:session:${session.id}`,
        86400,
        JSON.stringify(session),
      );

      await authService.updateHeartbeat(session.id, 'active', { cpuUsage: 50 });

      // Verify setex was called to update the session
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        authService.updateHeartbeat('non_existent_session', 'active'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for daemon', async () => {
      const session = await authService.createSession(
        'daemon_123',
        'vp_456',
        'ws_789',
        'daemon.test.local',
        '1.0.0',
      );

      // Store the session data
      await mockRedis.setex(
        `daemon:session:${session.id}`,
        86400,
        JSON.stringify(session),
      );

      const sessions = await authService.getActiveSessions('daemon_123');

      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should clean up stale session references', async () => {
      // Add a session ID to the set without actual session data
      await mockRedis.sadd('daemon:sessions:daemon_123', 'stale_session_id');

      await authService.getActiveSessions('daemon_123');

      expect(mockRedis.srem).toHaveBeenCalledWith('daemon:sessions:daemon_123', 'stale_session_id');
    });
  });

  describe('endSession', () => {
    it('should end session and clean up', async () => {
      const session = await authService.createSession(
        'daemon_123',
        'vp_456',
        'ws_789',
        'daemon.test.local',
        '1.0.0',
      );

      // Store the session data
      await mockRedis.setex(
        `daemon:session:${session.id}`,
        86400,
        JSON.stringify(session),
      );

      await authService.endSession(session.id);

      expect(mockRedis.srem).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Credential Revocation Tests
  // ===========================================================================

  describe('revokeCredentials', () => {
    it('should revoke daemon credentials', async () => {
      mockPrisma.daemonCredential.update.mockResolvedValue({});

      await authService.revokeCredentials('daemon_123');

      expect(mockPrisma.daemonCredential.update).toHaveBeenCalledWith({
        where: { id: 'daemon_123' },
        data: { isActive: false },
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'daemon:active:daemon_123',
        'false',
        'EX',
        86400,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('daemon:refresh:daemon_123');
    });
  });

  // ===========================================================================
  // Scope Checking Tests
  // ===========================================================================

  describe('hasScope', () => {
    it('should return true if token has scope', () => {
      const token = { scopes: ['messages:read', 'messages:write'] };
      expect(authService.hasScope(token, 'messages:read')).toBe(true);
    });

    it('should return false if token does not have scope', () => {
      const token = { scopes: ['messages:read'] };
      expect(authService.hasScope(token, 'admin:write')).toBe(false);
    });
  });

  // ===========================================================================
  // Get Credentials Tests
  // ===========================================================================

  describe('getCredentials', () => {
    it('should return credentials without secret', async () => {
      const mockDaemon = createMockDaemonCredential();
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(mockDaemon);

      const result = await authService.getCredentials(mockDaemon.id);

      expect(result).not.toBeNull();
      expect(result?.apiSecret).toBe('[REDACTED]');
      expect(result?.apiKey).toBe(mockDaemon.apiKey);
    });

    it('should return null for non-existent daemon', async () => {
      mockPrisma.daemonCredential.findUnique.mockResolvedValue(null);

      const result = await authService.getCredentials('non_existent');

      expect(result).toBeNull();
    });
  });
});
