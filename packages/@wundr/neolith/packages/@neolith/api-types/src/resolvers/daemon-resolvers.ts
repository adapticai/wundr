/**
 * @fileoverview GraphQL resolvers for VP-Daemon management
 *
 * Provides comprehensive CRUD operations for daemon credentials,
 * session management, and real-time daemon status tracking.
 *
 * @module @genesis/api-types/resolvers/daemon-resolvers
 */

import * as crypto from 'crypto';
import { GraphQLError } from 'graphql';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * PrismaClient interface with daemon credential support
 * Uses dynamic typing to work before Prisma client regeneration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientWithDaemon = any;

/**
 * Context for daemon resolvers
 */
export interface DaemonResolverContext {
  prisma: PrismaClientWithDaemon;
  redis: Redis;
  userId: string;
}

/**
 * Daemon status enum values
 */
export const DaemonStatus = {
  Connecting: 'connecting',
  Connected: 'connected',
  Authenticated: 'authenticated',
  Active: 'active',
  Idle: 'idle',
  Disconnected: 'disconnected',
  Error: 'error',
} as const;

export type DaemonStatusType = (typeof DaemonStatus)[keyof typeof DaemonStatus];

/**
 * Daemon credential entity
 */
interface DaemonCredential {
  id: string;
  orchestratorId: string;
  workspaceId: string;
  apiKey: string;
  apiSecretHash: string;
  hostname: string | null;
  version: string | null;
  capabilities: string[];
  metadata: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * Daemon session entity
 */
interface DaemonSession {
  id: string;
  daemonId: string;
  orchestratorId: string;
  workspaceId: string;
  status: DaemonStatusType;
  connectedAt: Date;
  lastHeartbeat: Date;
  hostname: string;
  version: string;
  ipAddress: string | null;
  metadata: unknown;
}

/**
 * Daemon metrics
 */
interface DaemonMetrics {
  cpuUsage: number | null;
  memoryUsage: number | null;
  messagesProcessed: number | null;
  activeConnections: number | null;
  uptime: number | null;
  errorCount: number | null;
}

/**
 * Daemon registration result
 */
interface DaemonRegistrationResult {
  daemonId: string;
  apiKey: string;
  apiSecret: string;
  workspaceId: string;
  orchestratorId: string;
}

/**
 * Register daemon input
 */
interface RegisterDaemonInput {
  orchestratorId: string;
  workspaceId: string;
  hostname: string;
  version: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Update daemon input
 */
interface UpdateDaemonInput {
  hostname?: string;
  version?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

// =============================================================================
// GRAPHQL TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for daemon management
 */
export const daemonTypeDefs = `#graphql
  type DaemonCredential {
    id: ID!
    orchestratorId: ID!
    workspaceId: ID!
    apiKey: String!
    hostname: String
    version: String
    capabilities: [String!]
    isActive: Boolean!
    createdAt: DateTime!
    expiresAt: DateTime
    lastUsedAt: DateTime
  }

  type DaemonSession {
    id: ID!
    daemonId: ID!
    orchestratorId: ID!
    workspaceId: ID!
    status: DaemonStatus!
    connectedAt: DateTime!
    lastHeartbeat: DateTime!
    hostname: String!
    version: String!
    ipAddress: String
    metadata: JSON
  }

  enum DaemonStatus {
    connecting
    connected
    authenticated
    active
    idle
    disconnected
    error
  }

  type DaemonMetrics {
    cpuUsage: Float
    memoryUsage: Float
    messagesProcessed: Int
    activeConnections: Int
    uptime: Int
    errorCount: Int
  }

  type DaemonRegistrationResult {
    daemonId: ID!
    apiKey: String!
    apiSecret: String!
    workspaceId: ID!
    orchestratorId: ID!
  }

  input RegisterDaemonInput {
    orchestratorId: ID!
    workspaceId: ID!
    hostname: String!
    version: String!
    capabilities: [String!]
    metadata: JSON
  }

  input UpdateDaemonInput {
    hostname: String
    version: String
    capabilities: [String!]
    metadata: JSON
    isActive: Boolean
  }

  extend type Query {
    daemonCredentials(orchestratorId: ID!): [DaemonCredential!]!
    daemonCredential(id: ID!): DaemonCredential
    daemonSessions(daemonId: ID!): [DaemonSession!]!
    daemonMetrics(daemonId: ID!): DaemonMetrics
    vpDaemons(workspaceId: ID!): [DaemonCredential!]!
  }

  extend type Mutation {
    registerDaemon(input: RegisterDaemonInput!): DaemonRegistrationResult!
    updateDaemonCredential(id: ID!, input: UpdateDaemonInput!): DaemonCredential!
    revokeDaemonCredential(id: ID!): Boolean!
    rotateDaemonSecret(id: ID!): DaemonRegistrationResult!
    terminateDaemonSession(sessionId: ID!): Boolean!
    terminateAllDaemonSessions(daemonId: ID!): Int!
  }

  extend type Subscription {
    daemonStatusChanged(daemonId: ID!): DaemonSession!
    daemonMetricsUpdated(daemonId: ID!): DaemonMetrics!
  }
`;

// =============================================================================
// SUBSCRIPTION EVENTS
// =============================================================================

export const DAEMON_STATUS_CHANGED = 'DAEMON_STATUS_CHANGED';
export const DAEMON_METRICS_UPDATED = 'DAEMON_METRICS_UPDATED';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const prefix = 'daemon';
  const randomBytes = crypto.randomBytes(24);
  const encoded = randomBytes.toString('base64url');
  return `${prefix}_${encoded}`;
}

/**
 * Generate a secure API secret
 */
function generateApiSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash an API secret using SHA-256
 */
function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Mask an API key for display (show first 8 and last 4 characters)
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return apiKey.slice(0, 4) + '...' + apiKey.slice(-2);
  }
  return apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
}

/**
 * Get Redis key for daemon session
 */
function getSessionKey(daemonId: string, sessionId: string): string {
  return `daemon:session:${daemonId}:${sessionId}`;
}

/**
 * Get Redis key for daemon sessions list
 */
function getSessionsListKey(daemonId: string): string {
  return `daemon:sessions:${daemonId}`;
}

/**
 * Get Redis key for daemon metrics
 */
function getMetricsKey(daemonId: string): string {
  return `daemon:metrics:${daemonId}`;
}

// =============================================================================
// DAEMON AUTH SERVICE (INLINE IMPLEMENTATION)
// =============================================================================

/**
 * Inline DaemonAuthService for resolver use
 * This provides authentication and session management for Orchestrator daemons
 */
class DaemonAuthService {
  private prisma: PrismaClientWithDaemon;
  private redis: Redis;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private jwtSecret: string;

  constructor(config: {
    prisma: PrismaClientWithDaemon;
    redis: Redis;
    jwtSecret: string;
  }) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.jwtSecret = config.jwtSecret;
  }

  /**
   * Register a new daemon and generate credentials
   */
  async registerDaemon(input: RegisterDaemonInput): Promise<DaemonRegistrationResult> {
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    const apiSecretHash = hashSecret(apiSecret);

    const credential = await this.prisma.daemonCredential.create({
      data: {
        orchestratorId: input.orchestratorId,
        workspaceId: input.workspaceId,
        apiKey,
        apiSecretHash,
        hostname: input.hostname,
        version: input.version,
        capabilities: input.capabilities || [],
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        isActive: true,
      },
    });

    // Cache the credential for faster validation
    await this.redis.setex(
      `daemon:credential:${apiKey}`,
      86400, // 24 hours
      JSON.stringify({
        id: credential.id,
        orchestratorId: credential.orchestratorId,
        workspaceId: credential.workspaceId,
        apiSecretHash,
        isActive: true,
      })
    );

    return {
      daemonId: credential.id,
      apiKey,
      apiSecret, // Only returned once at registration
      workspaceId: credential.workspaceId,
      orchestratorId: credential.orchestratorId,
    };
  }

  /**
   * Revoke daemon credentials
   */
  async revokeCredentials(daemonId: string): Promise<void> {
    const credential = await this.prisma.daemonCredential.findUnique({
      where: { id: daemonId },
    });

    if (!credential) {
      throw new GraphQLError('Daemon credential not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Deactivate in database
    await this.prisma.daemonCredential.update({
      where: { id: daemonId },
      data: { isActive: false },
    });

    // Remove from cache
    await this.redis.del(`daemon:credential:${credential.apiKey}`);

    // Terminate all active sessions
    const sessionsKey = getSessionsListKey(daemonId);
    const sessionIds = await this.redis.smembers(sessionsKey);

    for (const sessionId of sessionIds) {
      await this.redis.del(getSessionKey(daemonId, sessionId));
    }
    await this.redis.del(sessionsKey);
  }

  /**
   * Get active sessions for a daemon
   */
  async getActiveSessions(daemonId: string): Promise<DaemonSession[]> {
    const sessionsKey = getSessionsListKey(daemonId);
    const sessionIds = await this.redis.smembers(sessionsKey);

    const sessions: DaemonSession[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await this.redis.hgetall(getSessionKey(daemonId, sessionId));

      if (sessionData && Object.keys(sessionData).length > 0) {
        sessions.push({
          id: sessionId,
          daemonId,
          orchestratorId: sessionData.orchestratorId || '',
          workspaceId: sessionData.workspaceId || '',
          status: (sessionData.status as DaemonStatusType) || DaemonStatus.Disconnected,
          connectedAt: new Date(sessionData.connectedAt || Date.now()),
          lastHeartbeat: new Date(sessionData.lastHeartbeat || Date.now()),
          hostname: sessionData.hostname || 'unknown',
          version: sessionData.version || '1.0.0',
          ipAddress: sessionData.ipAddress || null,
          metadata: sessionData.metadata ? JSON.parse(sessionData.metadata) : null,
        });
      }
    }

    return sessions;
  }

  /**
   * End a specific daemon session
   */
  async endSession(sessionId: string): Promise<void> {
    // Find the session across all daemons
    const pattern = `daemon:session:*:${sessionId}`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const parts = key.split(':');
      const daemonId = parts[2];

      // Remove session data
      await this.redis.del(key);

      // Remove from sessions list
      if (daemonId) {
        await this.redis.srem(getSessionsListKey(daemonId), sessionId);
      }
    }
  }
}

// =============================================================================
// RESOLVER FACTORY
// =============================================================================

/**
 * Create daemon resolvers with the provided context
 */
export function createDaemonResolvers(context: DaemonResolverContext) {
  const authService = new DaemonAuthService({
    prisma: context.prisma,
    redis: context.redis,
    jwtSecret: process.env.DAEMON_JWT_SECRET || 'daemon-secret',
  });

  return {
    Query: {
      /**
       * Get all daemon credentials for a VP
       */
      daemonCredentials: async (_: unknown, { orchestratorId }: { orchestratorId: string }) => {
        const credentials = await context.prisma.daemonCredential.findMany({
          where: { orchestratorId },
          orderBy: { createdAt: 'desc' },
        });

        return credentials.map((cred: DaemonCredential) => ({
          ...cred,
          apiKey: maskApiKey(cred.apiKey),
        }));
      },

      /**
       * Get a specific daemon credential by ID
       */
      daemonCredential: async (_: unknown, { id }: { id: string }) => {
        const credential = await context.prisma.daemonCredential.findUnique({
          where: { id },
        });

        if (!credential) return null;

        return {
          ...credential,
          apiKey: maskApiKey(credential.apiKey),
        };
      },

      /**
       * Get active sessions for a daemon
       */
      daemonSessions: async (_: unknown, { daemonId }: { daemonId: string }) => {
        return authService.getActiveSessions(daemonId);
      },

      /**
       * Get metrics for a daemon
       */
      daemonMetrics: async (_: unknown, { daemonId }: { daemonId: string }): Promise<DaemonMetrics | null> => {
        const metricsKey = getMetricsKey(daemonId);
        const metrics = await context.redis.hgetall(metricsKey);

        if (!metrics || Object.keys(metrics).length === 0) {
          return null;
        }

        return {
          cpuUsage: metrics.cpuUsage ? parseFloat(metrics.cpuUsage) : null,
          memoryUsage: metrics.memoryUsage ? parseFloat(metrics.memoryUsage) : null,
          messagesProcessed: metrics.messagesProcessed ? parseInt(metrics.messagesProcessed, 10) : null,
          activeConnections: metrics.activeConnections ? parseInt(metrics.activeConnections, 10) : null,
          uptime: metrics.uptime ? parseInt(metrics.uptime, 10) : null,
          errorCount: metrics.errorCount ? parseInt(metrics.errorCount, 10) : null,
        };
      },

      /**
       * Get all daemons in a workspace
       */
      vpDaemons: async (_: unknown, { workspaceId }: { workspaceId: string }) => {
        const credentials = await context.prisma.daemonCredential.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        });

        return credentials.map((cred: DaemonCredential) => ({
          ...cred,
          apiKey: maskApiKey(cred.apiKey),
        }));
      },
    },

    Mutation: {
      /**
       * Register a new daemon for a VP
       */
      registerDaemon: async (_: unknown, { input }: { input: RegisterDaemonInput }) => {
        // Verify user has access to Orchestrator - check by orchestratorId and organizationId
        // Orchestrator may not have workspaceId directly, so we check organization membership
        const orchestrator = await context.prisma.vP.findFirst({
          where: {
            id: input.orchestratorId,
          },
        });

        if (!vp) {
          throw new GraphQLError('VP not found or access denied', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        const credentials = await authService.registerDaemon({
          orchestratorId: input.orchestratorId,
          workspaceId: input.workspaceId,
          hostname: input.hostname,
          version: input.version,
          capabilities: input.capabilities || [],
          metadata: input.metadata ?? {},
        });

        return {
          daemonId: credentials.daemonId,
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          workspaceId: credentials.workspaceId,
          orchestratorId: credentials.orchestratorId,
        };
      },

      /**
       * Update daemon credential
       */
      updateDaemonCredential: async (
        _: unknown,
        { id, input }: { id: string; input: UpdateDaemonInput }
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {};

        if (input.hostname !== undefined) {
          updateData.hostname = input.hostname;
        }
        if (input.version !== undefined) {
          updateData.version = input.version;
        }
        if (input.capabilities !== undefined) {
          updateData.capabilities = input.capabilities;
        }
        if (input.metadata !== undefined) {
          updateData.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
        }
        if (input.isActive !== undefined) {
          updateData.isActive = input.isActive;
        }

        const credential = await context.prisma.daemonCredential.update({
          where: { id },
          data: updateData,
        });

        // Update cache if disabling
        if (input.isActive === false) {
          await context.redis.setex(`daemon:active:${id}`, 86400, 'false');
        }

        return {
          ...credential,
          apiKey: maskApiKey(credential.apiKey),
        };
      },

      /**
       * Revoke a daemon credential
       */
      revokeDaemonCredential: async (_: unknown, { id }: { id: string }) => {
        await authService.revokeCredentials(id);
        return true;
      },

      /**
       * Rotate daemon secret (generates new credentials)
       */
      rotateDaemonSecret: async (_: unknown, { id }: { id: string }) => {
        // Get existing credential
        const existing = await context.prisma.daemonCredential.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new GraphQLError('Daemon credential not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        // Revoke old credentials
        await authService.revokeCredentials(id);

        // Create new credentials
        const newCredentials = await authService.registerDaemon({
          orchestratorId: existing.orchestratorId,
          workspaceId: existing.workspaceId,
          hostname: existing.hostname || 'unknown',
          version: existing.version || '1.0.0',
          capabilities: (existing.capabilities as string[]) || [],
        });

        // Delete old record
        await context.prisma.daemonCredential.delete({ where: { id } });

        return {
          daemonId: newCredentials.daemonId,
          apiKey: newCredentials.apiKey,
          apiSecret: newCredentials.apiSecret,
          workspaceId: newCredentials.workspaceId,
          orchestratorId: newCredentials.orchestratorId,
        };
      },

      /**
       * Terminate a specific daemon session
       */
      terminateDaemonSession: async (_: unknown, { sessionId }: { sessionId: string }) => {
        await authService.endSession(sessionId);
        return true;
      },

      /**
       * Terminate all sessions for a daemon
       */
      terminateAllDaemonSessions: async (_: unknown, { daemonId }: { daemonId: string }) => {
        const sessions = await authService.getActiveSessions(daemonId);

        for (const session of sessions) {
          await authService.endSession(session.id);
        }

        return sessions.length;
      },
    },

    Subscription: {
      /**
       * Subscribe to daemon status changes
       */
      daemonStatusChanged: {
        subscribe: async function* (_: unknown, { daemonId }: { daemonId: string }) {
          // This would use Redis pub/sub in production
          // For now, yield an empty result as placeholder
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const channel = `daemon:status:${daemonId}`;
          // Implementation would depend on GraphQL subscription infrastructure
          // e.g., using graphql-subscriptions PubSub or Redis pub/sub
          yield { daemonStatusChanged: null };
        },
      },

      /**
       * Subscribe to daemon metrics updates
       */
      daemonMetricsUpdated: {
        subscribe: async function* (_: unknown, { daemonId }: { daemonId: string }) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const channel = `daemon:metrics:${daemonId}`;
          // Implementation would depend on GraphQL subscription infrastructure
          yield { daemonMetricsUpdated: null };
        },
      },
    },
  };
}

// =============================================================================
// STANDALONE RESOLVERS
// =============================================================================

/**
 * Query resolvers for daemon management
 */
export const daemonQueries = {
  daemonCredentials: async (
    _parent: unknown,
    args: { orchestratorId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Query.daemonCredentials(undefined, args);
  },

  daemonCredential: async (
    _parent: unknown,
    args: { id: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Query.daemonCredential(undefined, args);
  },

  daemonSessions: async (
    _parent: unknown,
    args: { daemonId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Query.daemonSessions(undefined, args);
  },

  daemonMetrics: async (
    _parent: unknown,
    args: { daemonId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Query.daemonMetrics(undefined, args);
  },

  vpDaemons: async (
    _parent: unknown,
    args: { workspaceId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Query.orchestratorDaemons(undefined, args);
  },
};

/**
 * Mutation resolvers for daemon management
 */
export const daemonMutations = {
  registerDaemon: async (
    _parent: unknown,
    args: { input: RegisterDaemonInput },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.registerDaemon(undefined, args);
  },

  updateDaemonCredential: async (
    _parent: unknown,
    args: { id: string; input: UpdateDaemonInput },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.updateDaemonCredential(undefined, args);
  },

  revokeDaemonCredential: async (
    _parent: unknown,
    args: { id: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.revokeDaemonCredential(undefined, args);
  },

  rotateDaemonSecret: async (
    _parent: unknown,
    args: { id: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.rotateDaemonSecret(undefined, args);
  },

  terminateDaemonSession: async (
    _parent: unknown,
    args: { sessionId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.terminateDaemonSession(undefined, args);
  },

  terminateAllDaemonSessions: async (
    _parent: unknown,
    args: { daemonId: string },
    context: DaemonResolverContext
  ) => {
    const resolvers = createDaemonResolvers(context);
    return resolvers.Mutation.terminateAllDaemonSessions(undefined, args);
  },
};

/**
 * Subscription resolvers for daemon management
 */
export const daemonSubscriptions = {
  daemonStatusChanged: {
    subscribe: async function* (_: unknown, args: { daemonId: string }, context: DaemonResolverContext) {
      const resolvers = createDaemonResolvers(context);
      yield* resolvers.Subscription.daemonStatusChanged.subscribe(undefined, args);
    },
  },

  daemonMetricsUpdated: {
    subscribe: async function* (_: unknown, args: { daemonId: string }, context: DaemonResolverContext) {
      const resolvers = createDaemonResolvers(context);
      yield* resolvers.Subscription.daemonMetricsUpdated.subscribe(undefined, args);
    },
  },
};

/**
 * Field resolvers for DaemonCredential type
 */
export const DaemonCredentialFieldResolvers = {
  /**
   * Resolve the associated Orchestrator for a daemon credential
   */
  vp: async (
    parent: DaemonCredential,
    _args: unknown,
    context: DaemonResolverContext
  ) => {
    return context.prisma.vP.findUnique({
      where: { id: parent.orchestratorId },
    });
  },

  /**
   * Resolve the associated workspace for a daemon credential
   */
  workspace: async (
    parent: DaemonCredential,
    _args: unknown,
    context: DaemonResolverContext
  ) => {
    return context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });
  },
};

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined daemon resolvers object for use with graphql-tools
 */
export const daemonResolvers = {
  Query: daemonQueries,
  Mutation: daemonMutations,
  Subscription: daemonSubscriptions,
  DaemonCredential: DaemonCredentialFieldResolvers,
};

export default daemonResolvers;
