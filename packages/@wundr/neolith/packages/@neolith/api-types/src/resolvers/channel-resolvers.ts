/**
 * Channel GraphQL Resolvers
 *
 * Comprehensive resolvers for Channel operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks (channel membership/role),
 * input validation, cursor-based pagination, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/channel-resolvers
 */

import { GraphQLError } from 'graphql';

import type {
  PrismaClient,
  channel as PrismaChannel,
  ChannelType as PrismaChannelType,
  ChannelRole as PrismaChannelRole,
  Prisma,
} from '@prisma/client';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Channel type enum matching the Prisma schema
 */
export const ChannelType = {
  Public: 'PUBLIC',
  Private: 'PRIVATE',
  DM: 'DM',
  Huddle: 'HUDDLE',
} as const;

export type ChannelTypeValue = (typeof ChannelType)[keyof typeof ChannelType];

/**
 * Channel role enum matching the Prisma schema
 */
export const ChannelRole = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Member: 'MEMBER',
} as const;

export type ChannelRoleType = (typeof ChannelRole)[keyof typeof ChannelRole];

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
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Channel entity type for resolvers
 */
interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: PrismaChannelType;
  isArchived: boolean;
  settings: unknown;
  workspaceId: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Channel member info
 */
interface ChannelMemberInfo {
  isMember: boolean;
  role: PrismaChannelRole | null;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for channel created */
export const CHANNEL_CREATED = 'CHANNEL_CREATED';

/** Event name for channel updated */
export const CHANNEL_UPDATED = 'CHANNEL_UPDATED';

/** Event name for channel deleted/archived */
export const CHANNEL_DELETED = 'CHANNEL_DELETED';

/** Event name for member joined */
export const MEMBER_JOINED = 'MEMBER_JOINED';

/** Event name for member left */
export const MEMBER_LEFT = 'MEMBER_LEFT';

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new channel
 */
interface CreateChannelInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  type?: ChannelTypeValue | null;
  workspaceId: string;
}

/**
 * Input for updating an existing channel
 */
interface UpdateChannelInput {
  name?: string | null;
  description?: string | null;
  settings?: Record<string, unknown> | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface ChannelQueryArgs {
  id: string;
}

interface ChannelsArgs {
  workspaceId: string;
  type?: ChannelTypeValue | null;
  first?: number | null;
  after?: string | null;
}

interface ChannelMembersArgs {
  channelId: string;
  first?: number | null;
  after?: string | null;
}

interface DirectMessageChannelArgs {
  userIds: string[];
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateChannelArgs {
  input: CreateChannelInput;
}

interface UpdateChannelArgs {
  id: string;
  input: UpdateChannelInput;
}

interface ArchiveChannelArgs {
  id: string;
}

interface DeleteChannelArgs {
  id: string;
}

interface JoinChannelArgs {
  channelId: string;
}

interface LeaveChannelArgs {
  channelId: string;
}

interface AddChannelMemberArgs {
  channelId: string;
  userId: string;
  role?: ChannelRoleType | null;
}

interface RemoveChannelMemberArgs {
  channelId: string;
  userId: string;
}

interface UpdateChannelMemberRoleArgs {
  channelId: string;
  userId: string;
  role: ChannelRoleType;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface ChannelCreatedArgs {
  workspaceId: string;
}

interface ChannelUpdatedArgs {
  channelId: string;
}

interface ChannelDeletedArgs {
  workspaceId: string;
}

interface MemberJoinedArgs {
  channelId: string;
}

interface MemberLeftArgs {
  channelId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface ChannelPayload {
  channel: Channel | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface MemberPayload {
  member: {
    id: string;
    role: PrismaChannelRole;
    joinedAt: Date;
    user: { id: string; email: string; name: string | null };
  } | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

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
 * Type guard to check if user has system admin role
 *
 * @param context - The GraphQL context
 * @returns True if user is a system admin
 */
function isSystemAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user is a member of a workspace
 *
 * @param context - The GraphQL context
 * @param workspaceId - The workspace ID to check
 * @returns True if user is a member
 */
async function isWorkspaceMember(
  context: GraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isSystemAdmin(context)) {
    return true;
  }

  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
  });

  return !!membership;
}

/**
 * Check if user is a member of a channel and get their role
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to check
 * @returns Channel member info
 */
async function getChannelMemberInfo(
  context: GraphQLContext,
  channelId: string
): Promise<ChannelMemberInfo> {
  if (!isAuthenticated(context)) {
    return { isMember: false, role: null };
  }

  const membership = await context.prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    // System admins can access any channel
    if (isSystemAdmin(context)) {
      return { isMember: true, role: 'ADMIN' };
    }
    return { isMember: false, role: null };
  }

  return { isMember: true, role: membership.role };
}

/**
 * Check if user can access a channel (public channels in workspace, or member of private channel)
 *
 * @param context - The GraphQL context
 * @param channel - The channel to check access for
 * @returns True if user can access the channel
 */
async function canAccessChannel(
  context: GraphQLContext,
  channel: Channel
): Promise<boolean> {
  if (isSystemAdmin(context)) {
    return true;
  }

  // For public channels, workspace membership is sufficient
  if (channel.type === 'PUBLIC') {
    return isWorkspaceMember(context, channel.workspaceId);
  }

  // For private/DM channels, must be a channel member
  const memberInfo = await getChannelMemberInfo(context, channel.id);
  return memberInfo.isMember;
}

/**
 * Check if user can modify a channel (is channel admin/owner or system admin)
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to check
 * @returns True if user can modify the channel
 */
async function canModifyChannel(
  context: GraphQLContext,
  channelId: string
): Promise<boolean> {
  if (isSystemAdmin(context)) {
    return true;
  }

  const memberInfo = await getChannelMemberInfo(context, channelId);
  return memberInfo.role === 'OWNER' || memberInfo.role === 'ADMIN';
}

/**
 * Validate channel name
 *
 * @param name - The name to validate
 * @throws GraphQLError if name is invalid
 */
function validateChannelName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new GraphQLError('Channel name is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
  if (name.length > 80) {
    throw new GraphQLError('Channel name must be 80 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
}

/**
 * Validate channel slug
 *
 * @param slug - The slug to validate
 * @throws GraphQLError if slug is invalid
 */
function validateSlug(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new GraphQLError('Channel slug is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'slug' },
    });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new GraphQLError(
      'Channel slug must contain only lowercase letters, numbers, and hyphens',
      { extensions: { code: 'BAD_USER_INPUT', field: 'slug' } }
    );
  }
  if (slug.length > 80) {
    throw new GraphQLError('Channel slug must be 80 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'slug' },
    });
  }
}

/**
 * Generate slug from name
 *
 * @param name - The name to generate slug from
 * @returns Generated slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate cursor for pagination
 *
 * @param item - Item with createdAt and id
 * @returns Base64 encoded cursor
 */
function generateCursor(item: { createdAt: Date; id: string }): string {
  return Buffer.from(`${item.createdAt.toISOString()}:${item.id}`).toString(
    'base64'
  );
}

/**
 * Parse cursor to get timestamp and ID
 *
 * @param cursor - Base64 encoded cursor
 * @returns Parsed cursor data or null if invalid
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Create success payload
 */
function createSuccessPayload(channel: Channel): ChannelPayload {
  return { channel, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): ChannelPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { channel: null, errors };
}

/**
 * Convert Prisma channel to resolver channel type
 */
function toChannel(prismaChannel: PrismaChannel): Channel {
  return {
    id: prismaChannel.id,
    name: prismaChannel.name,
    slug: prismaChannel.slug,
    description: prismaChannel.description,
    type: prismaChannel.type,
    isArchived: prismaChannel.isArchived,
    settings: prismaChannel.settings,
    workspaceId: prismaChannel.workspaceId,
    createdById: prismaChannel.createdById,
    createdAt: prismaChannel.createdAt,
    updatedAt: prismaChannel.updatedAt,
  };
}

/**
 * Generate DM channel slug from sorted user IDs
 */
function generateDMSlug(userIds: string[]): string {
  return `dm-${[...userIds].sort().join('-')}`;
}

// =============================================================================
// CHANNEL QUERY RESOLVERS
// =============================================================================

/**
 * Channel Query resolvers
 */
export const channelQueries = {
  /**
   * Get a channel by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing channel ID
   * @param context - GraphQL context
   * @returns The channel or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   channel(id: "ch_123") {
   *     id
   *     name
   *     type
   *   }
   * }
   * ```
   */
  channel: async (
    _parent: unknown,
    args: ChannelQueryArgs,
    context: GraphQLContext
  ): Promise<Channel | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const channel = await context.prisma.channel.findUnique({
      where: { id: args.id },
    });

    if (!channel) {
      return null;
    }

    const channelData = toChannel(channel);

    // Check access
    const hasAccess = await canAccessChannel(context, channelData);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return channelData;
  },

  /**
   * List channels in a workspace with optional type filter
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with workspaceId, type filter, and pagination
   * @param context - GraphQL context
   * @returns Paginated list of channels
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   channels(workspaceId: "ws_123", type: PUBLIC) {
   *     edges {
   *       node {
   *         id
   *         name
   *         type
   *       }
   *     }
   *     totalCount
   *   }
   * }
   * ```
   */
  channels: async (
    _parent: unknown,
    args: ChannelsArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, type } = args;
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);

    // Check workspace membership
    const isMember = await isWorkspaceMember(context, workspaceId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: Prisma.channelWhereInput = {
      workspaceId,
      isArchived: false,
    };

    if (type) {
      where.type = type as PrismaChannelType;
    }

    // For non-admin users, filter to accessible channels
    if (!isSystemAdmin(context)) {
      where.OR = [
        { type: 'PUBLIC' },
        { channelMembers: { some: { userId: context.user.id } } },
      ];
    }

    // Handle cursor pagination
    if (args.after) {
      const parsed = parseCursor(args.after);
      if (parsed) {
        const existingAnd = where.AND;
        const cursorCondition: Prisma.channelWhereInput = {
          OR: [
            { createdAt: { lt: parsed.timestamp } },
            { createdAt: parsed.timestamp, id: { lt: parsed.id } },
          ],
        };
        where.AND = existingAnd
          ? Array.isArray(existingAnd)
            ? [...existingAnd, cursorCondition]
            : [existingAnd, cursorCondition]
          : [cursorCondition];
      }
    }

    const channels = await context.prisma.channel.findMany({
      where,
      take: first + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const totalCount = await context.prisma.channel.count({
      where: {
        workspaceId,
        isArchived: false,
        ...(type ? { type: type as PrismaChannelType } : {}),
      },
    });

    const hasNextPage = channels.length > first;
    const nodes = hasNextPage ? channels.slice(0, -1) : channels;

    const edges = nodes.map((ch: PrismaChannel) => {
      const chData = toChannel(ch);
      return {
        node: chData,
        cursor: generateCursor({ createdAt: ch.createdAt, id: ch.id }),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!args.after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * List members of a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with channelId and pagination
   * @param context - GraphQL context
   * @returns Paginated list of channel members
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   channelMembers(channelId: "ch_123") {
   *     edges {
   *       node {
   *         user { id email name }
   *         role
   *         joinedAt
   *       }
   *     }
   *     totalCount
   *   }
   * }
   * ```
   */
  channelMembers: async (
    _parent: unknown,
    args: ChannelMembersArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId } = args;
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);

    // Fetch channel to check access
    const channel = await context.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new GraphQLError('Channel not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const channelData = toChannel(channel);
    const hasAccess = await canAccessChannel(context, channelData);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: Prisma.channelMemberWhereInput = {
      channelId,
    };

    // Handle cursor pagination
    if (args.after) {
      const parsed = parseCursor(args.after);
      if (parsed) {
        where.OR = [
          { joinedAt: { lt: parsed.timestamp } },
          { joinedAt: parsed.timestamp, id: { lt: parsed.id } },
        ];
      }
    }

    const members = await context.prisma.channelMember.findMany({
      where,
      take: first + 1,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const totalCount = await context.prisma.channelMember.count({
      where: { channelId },
    });

    const hasNextPage = members.length > first;
    const nodes = hasNextPage ? members.slice(0, -1) : members;

    const edges = nodes.map((member: (typeof members)[number]) => ({
      node: {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        lastReadAt: member.lastReadAt,
        user: member.user,
      },
      cursor: generateCursor({ createdAt: member.joinedAt, id: member.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!args.after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get or create a direct message channel between users
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with userIds array
   * @param context - GraphQL context
   * @returns The DM channel (created if doesn't exist)
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   directMessageChannel(userIds: ["user_123", "user_456"]) {
   *     id
   *     members { user { id } }
   *   }
   * }
   * ```
   */
  directMessageChannel: async (
    _parent: unknown,
    args: DirectMessageChannelArgs,
    context: GraphQLContext
  ): Promise<Channel | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { userIds } = args;

    // Ensure current user is included
    const allUserIds = Array.from(new Set([...userIds, context.user.id]));

    if (allUserIds.length < 2) {
      throw new GraphQLError('DM channel requires at least 2 users', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Find users and verify they exist
    const users = await context.prisma.user.findMany({
      where: { id: { in: allUserIds } },
    });

    if (users.length !== allUserIds.length) {
      throw new GraphQLError('One or more users not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Find users' common workspace for the DM channel
    // DMs are typically in the first common workspace
    const firstUserId = allUserIds[0]!;
    const secondUserId = allUserIds[1]!;

    const firstUserWorkspaces = await context.prisma.workspaceMember.findMany({
      where: { userId: firstUserId },
      select: { workspaceId: true },
    });

    const secondUserWorkspaces = await context.prisma.workspaceMember.findMany({
      where: { userId: secondUserId },
      select: { workspaceId: true },
    });

    const firstUserWsIds = new Set(
      firstUserWorkspaces.map((m: { workspaceId: string }) => m.workspaceId)
    );
    const commonWorkspaceId = secondUserWorkspaces.find(
      (m: { workspaceId: string }) => firstUserWsIds.has(m.workspaceId)
    )?.workspaceId;

    if (!commonWorkspaceId) {
      throw new GraphQLError('Users must share a common workspace for DM', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Generate DM slug for consistency
    const dmSlug = generateDMSlug(allUserIds);

    // Try to find existing DM channel
    const existingChannel = await context.prisma.channel.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: commonWorkspaceId,
          slug: dmSlug,
        },
      },
    });

    if (existingChannel) {
      return toChannel(existingChannel);
    }

    // Create new DM channel
    const channel = await context.prisma.channel.create({
      data: {
        name: `DM`,
        slug: dmSlug,
        type: 'DM',
        workspaceId: commonWorkspaceId,
        createdById: context.user.id,
        channelMembers: {
          create: allUserIds.map((userId, index) => ({
            userId,
            role: index === 0 ? 'OWNER' : 'MEMBER',
          })),
        },
      },
    });

    return toChannel(channel);
  },
};

// =============================================================================
// CHANNEL MUTATION RESOLVERS
// =============================================================================

/**
 * Channel Mutation resolvers
 */
export const channelMutations = {
  /**
   * Create a new channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel input
   * @param context - GraphQL context
   * @returns Channel payload with created channel or errors
   * @throws GraphQLError if not authenticated or validation fails
   *
   * @example
   * ```graphql
   * mutation {
   *   createChannel(input: {
   *     name: "general",
   *     workspaceId: "ws_123",
   *     type: PUBLIC
   *   }) {
   *     channel {
   *       id
   *       name
   *       slug
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  createChannel: async (
    _parent: unknown,
    args: CreateChannelArgs,
    context: GraphQLContext
  ): Promise<ChannelPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Check workspace membership
    const isMember = await isWorkspaceMember(context, input.workspaceId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    try {
      validateChannelName(input.name);
      const slug = input.slug ?? generateSlug(input.name);
      validateSlug(slug);

      // Check if slug is already taken in this workspace
      const existingChannel = await context.prisma.channel.findUnique({
        where: {
          workspaceId_slug: {
            workspaceId: input.workspaceId,
            slug,
          },
        },
      });

      if (existingChannel) {
        return createErrorPayload(
          'CONFLICT',
          'A channel with this slug already exists in this workspace'
        );
      }

      // Create channel and add creator as owner
      const channel = await context.prisma.channel.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          type: (input.type as PrismaChannelType) ?? 'PUBLIC',
          workspaceId: input.workspaceId,
          createdById: context.user.id,
          channelMembers: {
            create: {
              userId: context.user.id,
              role: 'OWNER',
            },
          },
        },
      });

      const channelData = toChannel(channel);

      // Publish channel created event
      await context.pubsub.publish(`${CHANNEL_CREATED}_${input.workspaceId}`, {
        channelCreated: channelData,
      });

      return createSuccessPayload(channelData);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }
  },

  /**
   * Update an existing channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID and update input
   * @param context - GraphQL context
   * @returns Channel payload with updated channel or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateChannel(id: "ch_123", input: { name: "New Name" }) {
   *     channel {
   *       id
   *       name
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateChannel: async (
    _parent: unknown,
    args: UpdateChannelArgs,
    context: GraphQLContext
  ): Promise<ChannelPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Check if channel exists
    const existingChannel = await context.prisma.channel.findUnique({
      where: { id },
    });

    if (!existingChannel) {
      return createErrorPayload('NOT_FOUND', 'Channel not found');
    }

    // Check modification permission
    const canModify = await canModifyChannel(context, id);
    if (!canModify) {
      throw new GraphQLError(
        'You do not have permission to modify this channel',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Validate input
    try {
      if (input.name) {
        validateChannelName(input.name);
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    // Build update data
    const updateData: Prisma.channelUpdateInput = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.settings !== undefined && input.settings !== null) {
      updateData.settings = input.settings as Prisma.InputJsonValue;
    }

    const channel = await context.prisma.channel.update({
      where: { id },
      data: updateData,
    });

    const channelData = toChannel(channel);

    // Publish channel updated event
    await context.pubsub.publish(`${CHANNEL_UPDATED}_${id}`, {
      channelUpdated: channelData,
    });

    return createSuccessPayload(channelData);
  },

  /**
   * Archive a channel (soft delete)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID
   * @param context - GraphQL context
   * @returns Channel payload with archived channel
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   archiveChannel(id: "ch_123") {
   *     channel {
   *       id
   *       isArchived
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  archiveChannel: async (
    _parent: unknown,
    args: ArchiveChannelArgs,
    context: GraphQLContext
  ): Promise<ChannelPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const channel = await context.prisma.channel.findUnique({
      where: { id: args.id },
    });

    if (!channel) {
      return createErrorPayload('NOT_FOUND', 'Channel not found');
    }

    // Only owner or system admin can archive
    const memberInfo = await getChannelMemberInfo(context, args.id);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only channel owner can archive the channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const updatedChannel = await context.prisma.channel.update({
      where: { id: args.id },
      data: { isArchived: true },
    });

    const channelData = toChannel(updatedChannel);

    // Publish channel deleted event
    await context.pubsub.publish(`${CHANNEL_DELETED}_${channel.workspaceId}`, {
      channelDeleted: args.id,
    });

    return createSuccessPayload(channelData);
  },

  /**
   * Delete a channel permanently
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteChannel(id: "ch_123") {
   *     success
   *     deletedId
   *     errors { code message }
   *   }
   * }
   * ```
   */
  deleteChannel: async (
    _parent: unknown,
    args: DeleteChannelArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const channel = await context.prisma.channel.findUnique({
      where: { id: args.id },
    });

    if (!channel) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Channel not found' }],
      };
    }

    // Only owner or system admin can delete
    const memberInfo = await getChannelMemberInfo(context, args.id);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only channel owner can delete the channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Delete channel (cascades to members, messages)
    await context.prisma.channel.delete({ where: { id: args.id } });

    // Publish channel deleted event
    await context.pubsub.publish(`${CHANNEL_DELETED}_${channel.workspaceId}`, {
      channelDeleted: args.id,
    });

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Join a public channel (self-join)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId
   * @param context - GraphQL context
   * @returns Member payload with added member
   * @throws GraphQLError if not authenticated or channel not public
   *
   * @example
   * ```graphql
   * mutation {
   *   joinChannel(channelId: "ch_123") {
   *     member {
   *       user { id }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  joinChannel: async (
    _parent: unknown,
    args: JoinChannelArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId } = args;

    // Check if channel exists and is public
    const channel = await context.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'Channel not found' }],
      };
    }

    if (channel.type !== 'PUBLIC') {
      return {
        member: null,
        errors: [
          { code: 'FORBIDDEN', message: 'Can only self-join public channels' },
        ],
      };
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(context, channel.workspaceId);
    if (!isMember) {
      return {
        member: null,
        errors: [{ code: 'FORBIDDEN', message: 'Must be a workspace member' }],
      };
    }

    // Check if already a member
    const existingMember = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: context.user.id,
        },
      },
    });

    if (existingMember) {
      return {
        member: null,
        errors: [
          { code: 'CONFLICT', message: 'Already a member of this channel' },
        ],
      };
    }

    // Join channel
    const member = await context.prisma.channelMember.create({
      data: {
        channelId,
        userId: context.user.id,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Publish member joined event
    await context.pubsub.publish(`${MEMBER_JOINED}_${channelId}`, {
      memberJoined: {
        channelId,
        member: {
          id: member.id,
          role: member.role,
          user: member.user,
        },
      },
    });

    return {
      member: {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      errors: [],
    };
  },

  /**
   * Leave a channel (self-remove)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   leaveChannel(channelId: "ch_123") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  leaveChannel: async (
    _parent: unknown,
    args: LeaveChannelArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId } = args;

    // Check if member exists
    const member = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: context.user.id,
        },
      },
    });

    if (!member) {
      return {
        success: false,
        deletedId: null,
        errors: [
          { code: 'NOT_FOUND', message: 'Not a member of this channel' },
        ],
      };
    }

    // Owners cannot leave - must transfer ownership first
    if (member.role === 'OWNER') {
      return {
        success: false,
        deletedId: null,
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'Channel owner cannot leave. Transfer ownership first.',
          },
        ],
      };
    }

    // Leave channel
    await context.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId: context.user.id,
        },
      },
    });

    // Publish member left event
    await context.pubsub.publish(`${MEMBER_LEFT}_${channelId}`, {
      memberLeft: {
        channelId,
        userId: context.user.id,
      },
    });

    return {
      success: true,
      deletedId: member.id,
      errors: [],
    };
  },

  /**
   * Add a member to a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId, userId, and role
   * @param context - GraphQL context
   * @returns Member payload with added member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   addChannelMember(channelId: "ch_123", userId: "user_456", role: MEMBER) {
   *     member {
   *       user { id email }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  addChannelMember: async (
    _parent: unknown,
    args: AddChannelMemberArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId, userId, role } = args;

    // Check if channel exists
    const channel = await context.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'Channel not found' }],
      };
    }

    // Check if requester can modify channel
    const canModify = await canModifyChannel(context, channelId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to add members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if user exists and is in the workspace
    const wsMembership = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!wsMembership) {
      return {
        member: null,
        errors: [
          { code: 'FORBIDDEN', message: 'User must be a workspace member' },
        ],
      };
    }

    // Check if already a member
    const existingMember = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (existingMember) {
      return {
        member: null,
        errors: [{ code: 'CONFLICT', message: 'User is already a member' }],
      };
    }

    // Prevent adding OWNER role
    if (role === 'OWNER') {
      return {
        member: null,
        errors: [
          {
            code: 'BAD_USER_INPUT',
            message: 'Cannot assign OWNER role directly',
          },
        ],
      };
    }

    // Add member
    const member = await context.prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role: (role as PrismaChannelRole) ?? 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Publish member joined event
    await context.pubsub.publish(`${MEMBER_JOINED}_${channelId}`, {
      memberJoined: {
        channelId,
        member: {
          id: member.id,
          role: member.role,
          user: member.user,
        },
      },
    });

    return {
      member: {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      errors: [],
    };
  },

  /**
   * Remove a member from a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId and userId
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   removeChannelMember(channelId: "ch_123", userId: "user_456") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  removeChannelMember: async (
    _parent: unknown,
    args: RemoveChannelMemberArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId, userId } = args;

    // Check if member exists
    const member = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Member not found' }],
      };
    }

    // Prevent removing the owner
    if (member.role === 'OWNER') {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'FORBIDDEN', message: 'Cannot remove channel owner' }],
      };
    }

    // Check permission
    const canModify = await canModifyChannel(context, channelId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to remove members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Remove member
    await context.prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    // Publish member left event
    await context.pubsub.publish(`${MEMBER_LEFT}_${channelId}`, {
      memberLeft: {
        channelId,
        userId,
      },
    });

    return {
      success: true,
      deletedId: member.id,
      errors: [],
    };
  },

  /**
   * Update a member's role in a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId, userId, and new role
   * @param context - GraphQL context
   * @returns Member payload with updated member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateChannelMemberRole(channelId: "ch_123", userId: "user_456", role: ADMIN) {
   *     member {
   *       user { id }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateChannelMemberRole: async (
    _parent: unknown,
    args: UpdateChannelMemberRoleArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId, userId, role } = args;

    // Check if member exists
    const existingMember = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!existingMember) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'Member not found' }],
      };
    }

    // Prevent changing owner's role
    if (existingMember.role === 'OWNER') {
      return {
        member: null,
        errors: [{ code: 'FORBIDDEN', message: 'Cannot change owner role' }],
      };
    }

    // Only owner or system admin can change roles
    const memberInfo = await getChannelMemberInfo(context, channelId);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only channel owner can change member roles', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Prevent assigning OWNER role
    if (role === 'OWNER') {
      return {
        member: null,
        errors: [
          { code: 'BAD_USER_INPUT', message: 'Cannot assign OWNER role' },
        ],
      };
    }

    // Update role
    const member = await context.prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      data: { role: role as PrismaChannelRole },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return {
      member: {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      errors: [],
    };
  },
};

// =============================================================================
// CHANNEL SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Channel Subscription resolvers
 */
export const channelSubscriptions = {
  /**
   * Subscribe to new channels in a workspace
   *
   * @example
   * ```graphql
   * subscription {
   *   channelCreated(workspaceId: "ws_123") {
   *     id
   *     name
   *     type
   *   }
   * }
   * ```
   */
  channelCreated: {
    subscribe: async (
      _parent: unknown,
      args: ChannelCreatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify workspace access
      const isMember = await isWorkspaceMember(context, args.workspaceId);
      if (!isMember) {
        throw new GraphQLError('Access denied to this workspace', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${CHANNEL_CREATED}_${args.workspaceId}`
      );
    },
  },

  /**
   * Subscribe to channel updates
   *
   * @example
   * ```graphql
   * subscription {
   *   channelUpdated(channelId: "ch_123") {
   *     id
   *     name
   *     description
   *   }
   * }
   * ```
   */
  channelUpdated: {
    subscribe: async (
      _parent: unknown,
      args: ChannelUpdatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify channel access
      const channel = await context.prisma.channel.findUnique({
        where: { id: args.channelId },
      });

      if (!channel) {
        throw new GraphQLError('Channel not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const channelData = toChannel(channel);
      const hasAccess = await canAccessChannel(context, channelData);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${CHANNEL_UPDATED}_${args.channelId}`
      );
    },
  },

  /**
   * Subscribe to channel deletions in a workspace
   *
   * @example
   * ```graphql
   * subscription {
   *   channelDeleted(workspaceId: "ws_123")
   * }
   * ```
   */
  channelDeleted: {
    subscribe: async (
      _parent: unknown,
      args: ChannelDeletedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isMember = await isWorkspaceMember(context, args.workspaceId);
      if (!isMember) {
        throw new GraphQLError('Access denied to this workspace', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${CHANNEL_DELETED}_${args.workspaceId}`
      );
    },
  },

  /**
   * Subscribe to members joining a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   memberJoined(channelId: "ch_123") {
   *     channelId
   *     member {
   *       user { id displayName }
   *       role
   *     }
   *   }
   * }
   * ```
   */
  memberJoined: {
    subscribe: async (
      _parent: unknown,
      args: MemberJoinedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const channel = await context.prisma.channel.findUnique({
        where: { id: args.channelId },
      });

      if (!channel) {
        throw new GraphQLError('Channel not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const channelData = toChannel(channel);
      const hasAccess = await canAccessChannel(context, channelData);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(`${MEMBER_JOINED}_${args.channelId}`);
    },
  },

  /**
   * Subscribe to members leaving a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   memberLeft(channelId: "ch_123") {
   *     channelId
   *     userId
   *   }
   * }
   * ```
   */
  memberLeft: {
    subscribe: async (
      _parent: unknown,
      args: MemberLeftArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const channel = await context.prisma.channel.findUnique({
        where: { id: args.channelId },
      });

      if (!channel) {
        throw new GraphQLError('Channel not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const channelData = toChannel(channel);
      const hasAccess = await canAccessChannel(context, channelData);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(`${MEMBER_LEFT}_${args.channelId}`);
    },
  },
};

// =============================================================================
// CHANNEL FIELD RESOLVERS
// =============================================================================

/**
 * Channel field resolvers for nested types
 */
export const ChannelFieldResolvers = {
  /**
   * Resolve workspace for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The workspace
   */
  workspace: async (
    parent: Channel,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });
  },

  /**
   * Resolve creator for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The creator user
   */
  creator: async (parent: Channel, _args: unknown, context: GraphQLContext) => {
    if (!parent.createdById) {
      return null;
    }
    return context.prisma.user.findUnique({
      where: { id: parent.createdById },
    });
  },

  /**
   * Resolve members for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of channel members
   */
  members: async (parent: Channel, _args: unknown, context: GraphQLContext) => {
    return context.prisma.channelMember.findMany({
      where: { channelId: parent.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  },

  /**
   * Resolve member count for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of members in the channel
   */
  memberCount: async (
    parent: Channel,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    return context.prisma.channelMember.count({
      where: { channelId: parent.id },
    });
  },

  /**
   * Resolve message count for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of messages in the channel
   */
  messageCount: async (
    parent: Channel,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    return context.prisma.message.count({
      where: {
        channelId: parent.id,
        isDeleted: false,
      },
    });
  },

  /**
   * Resolve last message for a channel
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The last message in the channel
   */
  lastMessage: async (
    parent: Channel,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.message.findFirst({
      where: {
        channelId: parent.id,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Resolve unread count for current user
   *
   * @param parent - The parent Channel object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of unread messages
   */
  unreadCount: async (
    parent: Channel,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    if (!isAuthenticated(context)) {
      return 0;
    }

    const membership = await context.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: parent.id,
          userId: context.user.id,
        },
      },
      select: { lastReadAt: true },
    });

    if (!membership || !membership.lastReadAt) {
      // Never read - count all messages
      return context.prisma.message.count({
        where: {
          channelId: parent.id,
          isDeleted: false,
        },
      });
    }

    // Count messages after last read
    return context.prisma.message.count({
      where: {
        channelId: parent.id,
        isDeleted: false,
        createdAt: { gt: membership.lastReadAt },
      },
    });
  },
};

// =============================================================================
// COMBINED CHANNEL RESOLVERS
// =============================================================================

/**
 * Combined channel resolvers object for use with graphql-tools
 */
export const channelResolvers = {
  Query: channelQueries,
  Mutation: channelMutations,
  Subscription: channelSubscriptions,
  Channel: ChannelFieldResolvers,
};

export default channelResolvers;
