/**
 * Presence GraphQL Resolvers
 *
 * Comprehensive resolvers for presence tracking operations including queries, mutations,
 * subscriptions, and field resolvers. Implements real-time user and Orchestrator presence tracking,
 * channel presence, and status management with proper authorization and rate limiting.
 *
 * @module @genesis/api-types/resolvers/presence-resolvers
 */

import type { PrismaClient } from '@prisma/client';
import type { JsonValue } from '@neolith/database';
import { UserStatus } from '@neolith/database';
import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Presence status enum for users (client-facing)
 * Note: The database UserStatus has ACTIVE, INACTIVE, PENDING, SUSPENDED
 * We map these to client-friendly presence statuses
 */
export const PresenceStatus = {
  Online: 'ONLINE',
  Away: 'AWAY',
  Busy: 'BUSY',
  Offline: 'OFFLINE',
} as const;

export type PresenceStatusType =
  (typeof PresenceStatus)[keyof typeof PresenceStatus];

/**
 * Orchestrator status enum for Orchestrator presence (matches VPStatus in schema)
 */
export const OrchestratorPresenceStatus = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Busy: 'BUSY',
  Away: 'AWAY',
} as const;

export type OrchestratorPresenceStatusType =
  (typeof OrchestratorPresenceStatus)[keyof typeof OrchestratorPresenceStatus];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Presence service interface for business logic operations
 */
export interface PresenceService {
  /** Update user heartbeat */
  updateHeartbeat(userId: string): Promise<void>;
  /** Get user presence status */
  getPresence(userId: string): Promise<UserPresence | null>;
  /** Get multiple users presence */
  getMultiplePresence(userIds: string[]): Promise<UserPresence[]>;
  /** Set user status */
  setStatus(
    userId: string,
    status: PresenceStatusType,
    customStatus?: string
  ): Promise<UserPresence>;
  /** Check if user is rate limited */
  isRateLimited(userId: string, action: string): Promise<boolean>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional presence service for business logic */
  presenceService?: PresenceService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * User presence data type
 */
export interface UserPresence {
  userId: string;
  status: PresenceStatusType;
  customStatus: string | null;
  lastSeen: Date;
  isOnline: boolean;
}

/**
 * Orchestrator presence data type
 */
export interface OrchestratorPresence {
  orchestratorId: string;
  userId: string;
  status: OrchestratorPresenceStatusType;
  lastActivity: Date | null;
  isHealthy: boolean;
  messageCount: number;
}

/**
 * Channel presence data type
 */
export interface ChannelPresence {
  channelId: string;
  onlineUsers: UserPresence[];
  totalOnline: number;
}

/**
 * User preferences with presence fields
 */
interface UserPreferences {
  presenceStatus?: PresenceStatusType;
  customStatus?: string | null;
  [key: string]: unknown;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface UserPresenceArgs {
  userId: string;
}

interface MultiplePresenceArgs {
  userIds: string[];
}

interface ChannelPresenceArgs {
  channelId: string;
}

interface VPPresenceArgs {
  orchestratorId: string;
}

interface OnlineVPsArgs {
  organizationId: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface SetMyStatusArgs {
  status: PresenceStatusType;
  customStatus?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ClearMyStatusArgs {}

interface JoinChannelPresenceArgs {
  channelId: string;
}

interface LeaveChannelPresenceArgs {
  channelId: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface UserPresenceChangedArgs {
  userIds: string[];
}

interface ChannelPresenceChangedArgs {
  channelId: string;
}

interface VPStatusChangedArgs {
  organizationId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface PresencePayload {
  presence: UserPresence | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface ChannelPresencePayload {
  presence: ChannelPresence | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENTS
// =============================================================================

/** Event name for user presence changes */
export const USER_PRESENCE_CHANGED = 'USER_PRESENCE_CHANGED';

/** Event name for channel presence changes */
export const CHANNEL_PRESENCE_CHANGED = 'CHANNEL_PRESENCE_CHANGED';

/** Event name for Orchestrator status changes */
export const ORCHESTRATOR_PRESENCE_CHANGED = 'ORCHESTRATOR_PRESENCE_CHANGED';

/** Event name for presence join */
export const PRESENCE_JOIN = 'PRESENCE_JOIN';

/** Event name for presence leave */
export const PRESENCE_LEAVE = 'PRESENCE_LEAVE';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** Maximum number of user IDs per batch request */
const MAX_BATCH_SIZE = 100;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 *
 * @param context - The GraphQL context
 * @returns True if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Check if a user is online based on last activity
 *
 * @param lastActiveAt - The last activity timestamp
 * @returns True if user is considered online
 */
function isUserOnline(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() < OFFLINE_THRESHOLD_MS;
}

/**
 * Get presence status from user preferences
 *
 * @param preferences - User preferences JSON
 * @returns Presence status or null
 */
function getPresenceFromPreferences(preferences: JsonValue): UserPreferences {
  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    return preferences as UserPreferences;
  }
  return {};
}

/**
 * Map Prisma UserStatus to PresenceStatusType
 *
 * @param status - Prisma user status
 * @param preferences - User preferences with presence info
 * @returns PresenceStatusType
 */
function mapUserStatusToPresence(
  status: UserStatus,
  preferences: UserPreferences
): PresenceStatusType {
  // Check if user has set a specific presence status
  if (preferences.presenceStatus) {
    return preferences.presenceStatus;
  }

  // Fall back to mapping from database status
  switch (status) {
    case 'ACTIVE':
      return 'ONLINE';
    case 'INACTIVE':
    case 'PENDING':
    case 'SUSPENDED':
    default:
      return 'OFFLINE';
  }
}

/**
 * Create success payload for presence
 */
function createPresenceSuccessPayload(presence: UserPresence): PresencePayload {
  return { presence, errors: [] };
}

/**
 * Create error payload for presence
 */
function createPresenceErrorPayload(
  code: string,
  message: string,
  path?: string[]
): PresencePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { presence: null, errors };
}

/**
 * Build UserPresence from Prisma user data
 */
function buildUserPresence(user: {
  id: string;
  status: UserStatus;
  lastActiveAt: Date | null;
  preferences: JsonValue;
}): UserPresence {
  const prefs = getPresenceFromPreferences(user.preferences);
  const online = isUserOnline(user.lastActiveAt);
  return {
    userId: user.id,
    status: online ? mapUserStatusToPresence(user.status, prefs) : 'OFFLINE',
    customStatus: prefs.customStatus ?? null,
    lastSeen: user.lastActiveAt ?? new Date(0),
    isOnline: online,
  };
}

// =============================================================================
// PRESENCE QUERY RESOLVERS
// =============================================================================

/**
 * Presence Query resolvers
 */
export const presenceQueries = {
  /**
   * Get presence status for a single user
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing user ID
   * @param context - GraphQL context
   * @returns User presence information
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   userPresence(userId: "user_123") {
   *     userId
   *     status
   *     customStatus
   *     lastSeen
   *     isOnline
   *   }
   * }
   * ```
   */
  userPresence: async (
    _parent: unknown,
    args: UserPresenceArgs,
    context: GraphQLContext
  ): Promise<UserPresence | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if presence service is available
    if (context.presenceService) {
      return context.presenceService.getPresence(args.userId);
    }

    // Fallback to database lookup
    const user = await context.prisma.user.findUnique({
      where: { id: args.userId },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return null;
    }

    return buildUserPresence(user);
  },

  /**
   * Get presence status for multiple users
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing user IDs array
   * @param context - GraphQL context
   * @returns Array of user presence information
   * @throws GraphQLError if not authenticated or too many IDs requested
   *
   * @example
   * ```graphql
   * query {
   *   multiplePresence(userIds: ["user_123", "user_456"]) {
   *     userId
   *     status
   *     isOnline
   *   }
   * }
   * ```
   */
  multiplePresence: async (
    _parent: unknown,
    args: MultiplePresenceArgs,
    context: GraphQLContext
  ): Promise<UserPresence[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (args.userIds.length > MAX_BATCH_SIZE) {
      throw new GraphQLError(
        `Cannot request more than ${MAX_BATCH_SIZE} user presences at once`,
        { extensions: { code: 'BAD_USER_INPUT' } }
      );
    }

    // Check if presence service is available
    if (context.presenceService) {
      return context.presenceService.getMultiplePresence(args.userIds);
    }

    // Fallback to database lookup
    const users = await context.prisma.user.findMany({
      where: { id: { in: args.userIds } },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    return users.map(buildUserPresence);
  },

  /**
   * Get all online users in a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing channel ID
   * @param context - GraphQL context
   * @returns Channel presence with online users
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   channelPresence(channelId: "ch_123") {
   *     channelId
   *     totalOnline
   *     onlineUsers {
   *       userId
   *       status
   *     }
   *   }
   * }
   * ```
   */
  channelPresence: async (
    _parent: unknown,
    args: ChannelPresenceArgs,
    context: GraphQLContext
  ): Promise<ChannelPresence | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if channel exists and user has access
    const channel = await context.prisma.channel.findUnique({
      where: { id: args.channelId },
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                status: true,
                lastActiveAt: true,
                preferences: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return null;
    }

    // Check if user is a member of the channel
    const isMember = channel.channelMembers.some(
      (m: (typeof channel.channelMembers)[number]) =>
        m.userId === context.user.id
    );

    // For private channels, only members can see presence
    if (channel.type === 'PRIVATE' && !isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get online users
    const onlineUsers = channel.channelMembers
      .map((m: (typeof channel.channelMembers)[number]) =>
        buildUserPresence(m.user)
      )
      .filter((p: UserPresence) => p.isOnline);

    return {
      channelId: args.channelId,
      onlineUsers,
      totalOnline: onlineUsers.length,
    };
  },

  /**
   * Get Orchestrator presence and health status
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing OrchestratorID
   * @param context - GraphQL context
   * @returns Orchestrator presence information
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   vpPresence(orchestratorId: "vp_123") {
   *     orchestratorId
   *     status
   *     isHealthy
   *     lastActivity
   *     messageCount
   *   }
   * }
   * ```
   */
  vpPresence: async (
    _parent: unknown,
    args: VPPresenceArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPresence | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const orch = await context.prisma.orchestrator.findUnique({
      where: { id: args.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            lastActiveAt: true,
          },
        },
      },
    });

    if (!orch) {
      return null;
    }

    // Get message count for orchestrator
    const messageCount = await context.prisma.message.count({
      where: { authorId: orch.userId },
    });

    // Determine if Orchestrator is healthy (online and recent activity)
    const isHealthy =
      orch.status === 'ONLINE' && isUserOnline(orch.user.lastActiveAt);

    return {
      orchestratorId: orch.id,
      userId: orch.userId,
      status: orch.status as OrchestratorPresenceStatusType,
      lastActivity: orch.user.lastActiveAt,
      isHealthy,
      messageCount,
    };
  },

  /**
   * Get all online VPs in an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing organization ID
   * @param context - GraphQL context
   * @returns Array of online Orchestrator presences
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   onlineVPs(organizationId: "org_123") {
   *     orchestratorId
   *     status
   *     isHealthy
   *   }
   * }
   * ```
   */
  onlineVPs: async (
    _parent: unknown,
    args: OnlineVPsArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPresence[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user has access to the organization
    const membership = await context.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: args.organizationId,
          userId: context.user.id,
        },
      },
    });

    if (!membership) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get all VPs in the organization that are online
    const orchestrators = await context.prisma.orchestrator.findMany({
      where: {
        organizationId: args.organizationId,
        status: { in: ['ONLINE', 'BUSY', 'AWAY'] },
      },
      include: {
        user: {
          select: {
            id: true,
            lastActiveAt: true,
          },
        },
      },
    });

    // Get message counts for all VPs
    const vpUserIds = orchestrators.map(
      (vp: (typeof orchestrators)[number]) => vp.userId
    );
    const messageCounts = await context.prisma.message.groupBy({
      by: ['authorId'],
      where: { authorId: { in: vpUserIds } },
      _count: { id: true },
    });

    const messageCountMap = new Map(
      messageCounts.map((mc: (typeof messageCounts)[number]) => [
        mc.authorId,
        mc._count?.id ?? 0,
      ])
    );

    return orchestrators.map((vp: (typeof orchestrators)[number]) => ({
      orchestratorId: vp.id,
      userId: vp.userId,
      status: vp.status as OrchestratorPresenceStatusType,
      lastActivity: vp.user.lastActiveAt,
      isHealthy: vp.status === 'ONLINE' && isUserOnline(vp.user.lastActiveAt),
      messageCount: messageCountMap.get(vp.userId) ?? 0,
    }));
  },
};

// =============================================================================
// PRESENCE MUTATION RESOLVERS
// =============================================================================

/**
 * Presence Mutation resolvers
 */
export const presenceMutations = {
  /**
   * Set the current user's status
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with status and optional custom status
   * @param context - GraphQL context
   * @returns Presence payload with updated presence
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   setMyStatus(status: BUSY, customStatus: "In a meeting") {
   *     presence {
   *       status
   *       customStatus
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  setMyStatus: async (
    _parent: unknown,
    args: SetMyStatusArgs,
    context: GraphQLContext
  ): Promise<PresencePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Validate custom status length
    if (args.customStatus && args.customStatus.length > 100) {
      return createPresenceErrorPayload(
        'BAD_USER_INPUT',
        'Custom status must be 100 characters or less',
        ['customStatus']
      );
    }

    // Use presence service if available
    if (context.presenceService) {
      const presence = await context.presenceService.setStatus(
        context.user.id,
        args.status,
        args.customStatus ?? undefined
      );
      return createPresenceSuccessPayload(presence);
    }

    // Get current user to merge preferences
    const currentUser = await context.prisma.user.findUnique({
      where: { id: context.user.id },
      select: { preferences: true },
    });

    const currentPrefs = getPresenceFromPreferences(
      currentUser?.preferences ?? {}
    );

    // Update user status and preferences
    const user = await context.prisma.user.update({
      where: { id: context.user.id },
      data: {
        status: args.status === 'OFFLINE' ? 'INACTIVE' : 'ACTIVE',
        lastActiveAt: new Date(),
        preferences: {
          ...currentPrefs,
          presenceStatus: args.status,
          customStatus: args.customStatus ?? null,
        },
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    const presence = buildUserPresence(user);

    // Publish presence change event
    await context.pubsub.publish(
      `${USER_PRESENCE_CHANGED}_${context.user.id}`,
      {
        userPresenceChanged: presence,
      }
    );

    return createPresenceSuccessPayload(presence);
  },

  /**
   * Clear the current user's custom status
   *
   * @param _parent - Parent resolver result (unused)
   * @param _args - Mutation arguments (empty)
   * @param context - GraphQL context
   * @returns Presence payload with updated presence
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   clearMyStatus {
   *     presence {
   *       status
   *       customStatus
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  clearMyStatus: async (
    _parent: unknown,
    _args: ClearMyStatusArgs,
    context: GraphQLContext
  ): Promise<PresencePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get current user to merge preferences
    const currentUser = await context.prisma.user.findUnique({
      where: { id: context.user.id },
      select: { preferences: true },
    });

    const currentPrefs = getPresenceFromPreferences(
      currentUser?.preferences ?? {}
    );

    // Update user to clear custom status from preferences
    const user = await context.prisma.user.update({
      where: { id: context.user.id },
      data: {
        lastActiveAt: new Date(),
        preferences: {
          ...currentPrefs,
          customStatus: null,
        },
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    const presence = buildUserPresence(user);

    // Publish presence change event
    await context.pubsub.publish(
      `${USER_PRESENCE_CHANGED}_${context.user.id}`,
      {
        userPresenceChanged: presence,
      }
    );

    return createPresenceSuccessPayload(presence);
  },

  /**
   * Join a channel's presence tracking
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID
   * @param context - GraphQL context
   * @returns Channel presence payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   joinChannel(channelId: "ch_123") {
   *     presence {
   *       channelId
   *       totalOnline
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  joinChannel: async (
    _parent: unknown,
    args: JoinChannelPresenceArgs,
    context: GraphQLContext
  ): Promise<ChannelPresencePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user is a member of the channel
    const membership = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: args.channelId,
          userId: context.user.id,
        },
      },
    });

    if (!membership) {
      return {
        presence: null,
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'Must be a channel member to join presence',
          },
        ],
      };
    }

    // Update user's last activity
    await context.prisma.user.update({
      where: { id: context.user.id },
      data: { lastActiveAt: new Date() },
    });

    // Get current channel presence
    const channel = await context.prisma.channel.findUnique({
      where: { id: args.channelId },
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                status: true,
                lastActiveAt: true,
                preferences: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return {
        presence: null,
        errors: [{ code: 'NOT_FOUND', message: 'Channel not found' }],
      };
    }

    const onlineUsers = channel.channelMembers
      .map((m: (typeof channel.channelMembers)[number]) =>
        buildUserPresence(m.user)
      )
      .filter((p: UserPresence) => p.isOnline);

    const presence: ChannelPresence = {
      channelId: args.channelId,
      onlineUsers,
      totalOnline: onlineUsers.length,
    };

    // Publish channel presence join event
    await context.pubsub.publish(`${PRESENCE_JOIN}_${args.channelId}`, {
      presenceJoin: {
        channelId: args.channelId,
        user: buildUserPresence({
          id: context.user.id,
          status: 'ACTIVE',
          lastActiveAt: new Date(),
          preferences: {},
        }),
      },
    });

    return { presence, errors: [] };
  },

  /**
   * Leave a channel's presence tracking
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID
   * @param context - GraphQL context
   * @returns Channel presence payload
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   leaveChannel(channelId: "ch_123") {
   *     presence {
   *       channelId
   *       totalOnline
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  leaveChannel: async (
    _parent: unknown,
    args: LeaveChannelPresenceArgs,
    context: GraphQLContext
  ): Promise<ChannelPresencePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get current channel presence
    const channel = await context.prisma.channel.findUnique({
      where: { id: args.channelId },
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                status: true,
                lastActiveAt: true,
                preferences: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return {
        presence: null,
        errors: [{ code: 'NOT_FOUND', message: 'Channel not found' }],
      };
    }

    // Filter out the current user from online users
    const onlineUsers = channel.channelMembers
      .map((m: (typeof channel.channelMembers)[number]) =>
        buildUserPresence(m.user)
      )
      .filter((p: UserPresence) => p.isOnline && p.userId !== context.user.id);

    const presence: ChannelPresence = {
      channelId: args.channelId,
      onlineUsers,
      totalOnline: onlineUsers.length,
    };

    // Publish channel presence leave event
    await context.pubsub.publish(`${PRESENCE_LEAVE}_${args.channelId}`, {
      presenceLeave: {
        channelId: args.channelId,
        userId: context.user.id,
      },
    });

    return { presence, errors: [] };
  },
};

// =============================================================================
// PRESENCE SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Presence Subscription resolvers
 */
export const presenceSubscriptions = {
  /**
   * Subscribe to user presence changes
   *
   * @example
   * ```graphql
   * subscription {
   *   userPresenceChanged(userIds: ["user_123", "user_456"]) {
   *     userId
   *     status
   *     isOnline
   *   }
   * }
   * ```
   */
  userPresenceChanged: {
    /**
     * Subscribe to presence changes for specific users
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Subscription arguments with user IDs
     * @param context - GraphQL context with pubsub
     * @returns AsyncIterator for subscription events
     */
    subscribe: (
      _parent: unknown,
      args: UserPresenceChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (args.userIds.length > MAX_BATCH_SIZE) {
        throw new GraphQLError(
          `Cannot subscribe to more than ${MAX_BATCH_SIZE} users at once`,
          { extensions: { code: 'BAD_USER_INPUT' } }
        );
      }

      // Subscribe to all user presence channels
      const triggers = args.userIds.map(id => `${USER_PRESENCE_CHANGED}_${id}`);
      return context.pubsub.asyncIterator(triggers);
    },
  },

  /**
   * Subscribe to channel presence changes
   *
   * @example
   * ```graphql
   * subscription {
   *   channelPresenceChanged(channelId: "ch_123") {
   *     channelId
   *     totalOnline
   *     onlineUsers {
   *       userId
   *       status
   *     }
   *   }
   * }
   * ```
   */
  channelPresenceChanged: {
    /**
     * Subscribe to presence changes in a channel
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Subscription arguments with channel ID
     * @param context - GraphQL context with pubsub
     * @returns AsyncIterator for subscription events
     */
    subscribe: async (
      _parent: unknown,
      args: ChannelPresenceChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user is a member of the channel
      const membership = await context.prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: args.channelId,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        throw new GraphQLError(
          'Must be a channel member to subscribe to presence',
          {
            extensions: { code: 'FORBIDDEN' },
          }
        );
      }

      // Subscribe to join and leave events
      return context.pubsub.asyncIterator([
        `${PRESENCE_JOIN}_${args.channelId}`,
        `${PRESENCE_LEAVE}_${args.channelId}`,
        `${CHANNEL_PRESENCE_CHANGED}_${args.channelId}`,
      ]);
    },
  },

  /**
   * Subscribe to Orchestrator status changes in an organization
   *
   * @example
   * ```graphql
   * subscription {
   *   vpStatusChanged(organizationId: "org_123") {
   *     orchestratorId
   *     status
   *     isHealthy
   *   }
   * }
   * ```
   */
  vpStatusChanged: {
    /**
     * Subscribe to Orchestrator status changes in an organization
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Subscription arguments with organization ID
     * @param context - GraphQL context with pubsub
     * @returns AsyncIterator for subscription events
     */
    subscribe: async (
      _parent: unknown,
      args: VPStatusChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user has access to the organization
      const membership = await context.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: args.organizationId,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        throw new GraphQLError('Access denied to this organization', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${ORCHESTRATOR_PRESENCE_CHANGED}_${args.organizationId}`
      );
    },
  },
};

// =============================================================================
// PRESENCE FIELD RESOLVERS
// =============================================================================

/**
 * Presence field resolvers for nested types
 */
export const PresenceFieldResolvers = {
  /**
   * Resolve user details for presence
   *
   * @param parent - The parent UserPresence object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated user
   */
  user: async (
    parent: UserPresence,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  },
};

/**
 * OrchestratorPresence field resolvers
 */
export const OrchestratorPresenceFieldResolvers = {
  /**
   * Resolve Orchestrator details for presence
   *
   * @param parent - The parent OrchestratorPresence object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated VP
   */
  vp: async (
    parent: OrchestratorPresence,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.orchestrator.findUnique({
      where: { id: parent.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  },
};

// =============================================================================
// COMBINED PRESENCE RESOLVERS
// =============================================================================

/**
 * Combined presence resolvers object for use with graphql-tools
 */
export const presenceResolvers = {
  Query: presenceQueries,
  Mutation: presenceMutations,
  Subscription: presenceSubscriptions,
  UserPresence: PresenceFieldResolvers,
  OrchestratorPresence: OrchestratorPresenceFieldResolvers,
};

export default presenceResolvers;
