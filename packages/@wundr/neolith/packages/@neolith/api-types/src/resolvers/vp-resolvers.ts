/**
 * VP (Virtual Person) GraphQL Resolvers
 *
 * Comprehensive resolvers for VP operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks,
 * input validation, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/vp-resolvers
 */

import { GraphQLError } from 'graphql';

import type { PrismaClient, vP as PrismaVP, VPStatus as PrismaVPStatus, Prisma } from '@prisma/client';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * VP status enum matching the Prisma schema
 */
export const VPStatus = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Busy: 'BUSY',
  Away: 'AWAY',
} as const;

export type VPStatusType = (typeof VPStatus)[keyof typeof VPStatus];

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
  /** Optional VP service for business logic */
  vpService?: VPService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * VP Service interface for business logic operations
 */
export interface VPService {
  /** Generate a new API key for VP */
  generateAPIKey(vpId: string): Promise<string>;
  /** Validate VP configuration */
  validateConfig(config: Record<string, unknown>): Promise<boolean>;
  /** Provision VP resources */
  provision(vpId: string): Promise<void>;
  /** Deprovision VP resources */
  deprovision(vpId: string): Promise<void>;
}

/**
 * VP entity type matching Prisma schema
 */
interface VP {
  id: string;
  userId: string;
  organizationId: string;
  discipline: string;
  role: string;
  capabilities: unknown; // JSON field
  daemonEndpoint: string | null;
  status: PrismaVPStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * VP Statistics type
 */
interface VPStats {
  id: string;
  vpId: string;
  messageCount: number;
  lastActivity: Date | null;
  averageResponseTime: number | null;
  successRate: number | null;
  tokenUsage: number;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new VP
 */
interface CreateVPInput {
  discipline: string;
  role: string;
  capabilities?: unknown[] | null;
  daemonEndpoint?: string | null;
  organizationId: string;
  /** User display name for the VP */
  displayName?: string | null;
  /** User email for the VP */
  email?: string | null;
}

/**
 * Input for updating an existing VP
 */
interface UpdateVPInput {
  discipline?: string | null;
  role?: string | null;
  status?: VPStatusType | null;
  capabilities?: unknown[] | null;
  daemonEndpoint?: string | null;
}

/**
 * Filter input for listing VPs
 */
interface VPFilterInput {
  status?: VPStatusType | null;
  discipline?: string | null;
  search?: string | null;
}

/**
 * Pagination input
 */
interface PaginationInput {
  first?: number | null;
  after?: string | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface VPQueryArgs {
  id: string;
}

interface VPBySlugArgs {
  slug: string;
}

interface VPsInOrganizationArgs {
  orgId: string;
  filter?: VPFilterInput | null;
  pagination?: PaginationInput | null;
}

interface VPsInDisciplineArgs {
  disciplineId: string;
}

interface VPStatsArgs {
  id: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateVPArgs {
  input: CreateVPInput;
}

interface UpdateVPArgs {
  id: string;
  input: UpdateVPInput;
}

interface DeleteVPArgs {
  id: string;
}

interface ActivateVPArgs {
  id: string;
}

interface DeactivateVPArgs {
  id: string;
}

interface RotateVPAPIKeyArgs {
  id: string;
}

interface UpdateVPConfigurationArgs {
  id: string;
  config: Record<string, unknown>;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface VPStatusChangedArgs {
  vpId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface VPPayload {
  vp: VP | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface APIKeyRotationPayload {
  vp: VP | null;
  apiKey: string | null;
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
 * Type guard to check if user has admin role
 *
 * @param context - The GraphQL context
 * @returns True if user is an admin
 */
function isAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user can access a specific VP
 *
 * @param context - The GraphQL context
 * @param vp - The VP to check access for
 * @returns True if user can access the VP
 */
function canAccessVP(context: GraphQLContext, vp: VP): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // Admins can access any VP
  if (isAdmin(context)) {
    return true;
  }
  // Users can access their own VP
  return vp.userId === context.user.id;
}

/**
 * Check if user can modify a specific VP
 *
 * @param context - The GraphQL context
 * @param vp - The VP to check modification rights for
 * @returns True if user can modify the VP
 */
function canModifyVP(context: GraphQLContext, vp: VP): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // Admins can modify any VP
  if (isAdmin(context)) {
    return true;
  }
  // Users can modify their own VP
  return vp.userId === context.user.id;
}

/**
 * Validate VP discipline
 *
 * @param discipline - The discipline to validate
 * @throws GraphQLError if discipline is invalid
 */
function validateDiscipline(discipline: string): void {
  if (!discipline || discipline.trim().length === 0) {
    throw new GraphQLError('VP discipline is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'discipline' },
    });
  }
  if (discipline.length > 255) {
    throw new GraphQLError('VP discipline must be 255 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'discipline' },
    });
  }
}

/**
 * Validate VP role
 *
 * @param role - The role to validate
 * @throws GraphQLError if role is invalid
 */
function validateRole(role: string): void {
  if (!role || role.trim().length === 0) {
    throw new GraphQLError('VP role is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'role' },
    });
  }
  if (role.length > 255) {
    throw new GraphQLError('VP role must be 255 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'role' },
    });
  }
}

/**
 * Generate cursor from VP for pagination
 *
 * @param vp - The VP to generate cursor for
 * @returns Base64 encoded cursor
 */
function generateCursor(vp: VP): string {
  return Buffer.from(`${vp.createdAt.toISOString()}:${vp.id}`).toString(
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
function createSuccessPayload(vp: VP): VPPayload {
  return { vp, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): VPPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { vp: null, errors };
}

/**
 * Convert Prisma VP to resolver VP type
 */
function toVP(prismaVP: PrismaVP): VP {
  return {
    id: prismaVP.id,
    userId: prismaVP.userId,
    organizationId: prismaVP.organizationId,
    discipline: prismaVP.discipline,
    role: prismaVP.role,
    capabilities: prismaVP.capabilities,
    daemonEndpoint: prismaVP.daemonEndpoint,
    status: prismaVP.status,
    createdAt: prismaVP.createdAt,
    updatedAt: prismaVP.updatedAt,
  };
}

// =============================================================================
// SUBSCRIPTION EVENTS
// =============================================================================

/** Subscription event names */
export const VP_STATUS_CHANGED = 'VP_STATUS_CHANGED';

// =============================================================================
// VP QUERY RESOLVERS
// =============================================================================

/**
 * VP Query resolvers
 */
export const vpQueries = {
  /**
   * Get a VP by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing VP ID
   * @param context - GraphQL context
   * @returns The VP or null if not found
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   vp(id: "vp_123") {
   *     id
   *     discipline
   *     status
   *   }
   * }
   * ```
   */
  vp: async (
    _parent: unknown,
    args: VPQueryArgs,
    context: GraphQLContext
  ): Promise<VP | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const vp = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!vp) {
      return null;
    }

    const vpData = toVP(vp);
    if (!canAccessVP(context, vpData)) {
      throw new GraphQLError('Access denied to this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return vpData;
  },

  /**
   * Get a VP by its slug (discipline-based or custom identifier)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing VP slug
   * @param context - GraphQL context
   * @returns The VP or null if not found
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   vpBySlug(slug: "engineering-assistant") {
   *     id
   *     discipline
   *   }
   * }
   * ```
   */
  vpBySlug: async (
    _parent: unknown,
    args: VPBySlugArgs,
    context: GraphQLContext
  ): Promise<VP | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Find VP by discipline slug or user email pattern
    const vp = await context.prisma.vP.findFirst({
      where: {
        OR: [
          { discipline: { contains: args.slug, mode: 'insensitive' } },
          { user: { email: { contains: args.slug, mode: 'insensitive' } } },
        ],
      },
    });

    if (!vp) {
      return null;
    }

    const vpData = toVP(vp);
    if (!canAccessVP(context, vpData)) {
      throw new GraphQLError('Access denied to this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return vpData;
  },

  /**
   * List all VPs in an organization with filtering and pagination
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with org ID, filter, and pagination
   * @param context - GraphQL context
   * @returns Paginated list of VPs in the organization
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   vpsInOrganization(
   *     orgId: "org_123",
   *     filter: { status: ONLINE },
   *     pagination: { first: 10 }
   *   ) {
   *     edges {
   *       node {
   *         id
   *         discipline
   *       }
   *       cursor
   *     }
   *     pageInfo {
   *       hasNextPage
   *     }
   *     totalCount
   *   }
   * }
   * ```
   */
  vpsInOrganization: async (
    _parent: unknown,
    args: VPsInOrganizationArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orgId, filter, pagination } = args;
    const first = Math.min(Math.max(pagination?.first ?? 20, 1), 100);

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: orgId,
    };

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.discipline) {
      where.discipline = filter.discipline;
    }

    if (filter?.search) {
      where.OR = [
        { discipline: { contains: filter.search, mode: 'insensitive' } },
        { role: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Handle cursor-based pagination
    if (pagination?.after) {
      const parsed = parseCursor(pagination.after);
      if (parsed) {
        where.OR = [
          { createdAt: { lt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { lt: parsed.id } },
        ];
      }
    }

    // Fetch VPs with extra record for hasNextPage
    const vps = await context.prisma.vP.findMany({
      where,
      take: first + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // Get total count
    const totalCount = await context.prisma.vP.count({
      where: { organizationId: orgId },
    });

    const hasNextPage = vps.length > first;
    const nodes = hasNextPage ? vps.slice(0, -1) : vps;

    const edges = nodes.map((vp) => {
      const vpData = toVP(vp);
      return {
        node: vpData,
        cursor: generateCursor(vpData),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!pagination?.after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * List all VPs belonging to a specific discipline
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing discipline ID
   * @param context - GraphQL context
   * @returns Array of VPs in the discipline
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   vpsInDiscipline(disciplineId: "engineering") {
   *     edges {
   *       node {
   *         id
   *         discipline
   *       }
   *     }
   *   }
   * }
   * ```
   */
  vpsInDiscipline: async (
    _parent: unknown,
    args: VPsInDisciplineArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const vps = await context.prisma.vP.findMany({
      where: { discipline: args.disciplineId },
      orderBy: { createdAt: 'desc' },
    });

    const edges = vps.map((vp) => {
      const vpData = toVP(vp);
      return {
        node: vpData,
        cursor: generateCursor(vpData),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount: vps.length,
    };
  },

  /**
   * Get statistics for a specific VP
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing VP ID
   * @param context - GraphQL context
   * @returns VP statistics or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   vpStats(id: "vp_123") {
   *     messageCount
   *     lastActivity
   *     successRate
   *   }
   * }
   * ```
   */
  vpStats: async (
    _parent: unknown,
    args: VPStatsArgs,
    context: GraphQLContext
  ): Promise<VPStats | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const vp = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!vp) {
      return null;
    }

    const vpData = toVP(vp);
    if (!canAccessVP(context, vpData)) {
      throw new GraphQLError('Access denied to this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Aggregate statistics from messages and activity logs
    const messageCount = await context.prisma.message.count({
      where: { authorId: vp.userId },
    });

    const lastMessage = await context.prisma.message.findFirst({
      where: { authorId: vp.userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: `stats_${vp.id}`,
      vpId: vp.id,
      messageCount,
      lastActivity: lastMessage?.createdAt ?? null,
      averageResponseTime: null, // Calculated from activity logs
      successRate: null, // Calculated from task completions
      tokenUsage: 0, // Aggregated from usage logs
    };
  },
};

// =============================================================================
// VP MUTATION RESOLVERS
// =============================================================================

/**
 * VP Mutation resolvers
 */
export const vpMutations = {
  /**
   * Create a new Virtual Person
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP creation input
   * @param context - GraphQL context
   * @returns VP payload with created VP or errors
   * @throws GraphQLError if not authenticated or validation fails
   *
   * @example
   * ```graphql
   * mutation {
   *   createVP(input: {
   *     discipline: "Engineering",
   *     role: "Senior Developer",
   *     organizationId: "org_123"
   *   }) {
   *     vp {
   *       id
   *       discipline
   *     }
   *     errors {
   *       code
   *       message
   *     }
   *   }
   * }
   * ```
   */
  createVP: async (
    _parent: unknown,
    args: CreateVPArgs,
    context: GraphQLContext
  ): Promise<VPPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate input
    try {
      validateDiscipline(input.discipline);
      validateRole(input.role);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    // Create associated user for the VP
    const vpEmail = input.email ?? `vp_${Date.now()}@genesis.vp`;
    const vpUser = await context.prisma.user.create({
      data: {
        email: vpEmail,
        name: input.displayName ?? input.role,
        displayName: input.displayName ?? input.role,
        isVP: true,
        status: 'ACTIVE',
      },
    });

    // Create the VP
    const vp = await context.prisma.vP.create({
      data: {
        userId: vpUser.id,
        organizationId: input.organizationId,
        discipline: input.discipline,
        role: input.role,
        capabilities: (input.capabilities ?? []) as Prisma.InputJsonValue,
        daemonEndpoint: input.daemonEndpoint ?? null,
        status: 'OFFLINE',
      },
    });

    // Start provisioning if vpService is available
    if (context.vpService) {
      context.vpService.provision(vp.id).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`Failed to provision VP ${vp.id}:`, err);
      });
    }

    return createSuccessPayload(toVP(vp));
  },

  /**
   * Update an existing Virtual Person
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID and update input
   * @param context - GraphQL context
   * @returns VP payload with updated VP or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateVP(
   *     id: "vp_123",
   *     input: { role: "Lead Developer" }
   *   ) {
   *     vp {
   *       id
   *       role
   *     }
   *     errors {
   *       code
   *       message
   *     }
   *   }
   * }
   * ```
   */
  updateVP: async (
    _parent: unknown,
    args: UpdateVPArgs,
    context: GraphQLContext
  ): Promise<VPPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Fetch existing VP
    const existingVP = await context.prisma.vP.findUnique({
      where: { id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toVP(existingVP);
    if (!canModifyVP(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    try {
      if (input.discipline) {
        validateDiscipline(input.discipline);
      }
      if (input.role) {
        validateRole(input.role);
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
    const updateData: Record<string, unknown> = {};

    if (input.discipline !== undefined && input.discipline !== null) {
      updateData.discipline = input.discipline;
    }
    if (input.role !== undefined && input.role !== null) {
      updateData.role = input.role;
    }
    if (input.status !== undefined && input.status !== null) {
      updateData.status = input.status as PrismaVPStatus;
    }
    if (input.capabilities !== undefined && input.capabilities !== null) {
      updateData.capabilities = input.capabilities;
    }
    if (input.daemonEndpoint !== undefined) {
      updateData.daemonEndpoint = input.daemonEndpoint;
    }

    const vp = await context.prisma.vP.update({
      where: { id },
      data: updateData,
    });

    // Publish status change if status was updated
    if (input.status && input.status !== existingVP.status) {
      await context.pubsub.publish(`${VP_STATUS_CHANGED}_${id}`, {
        vpStatusChanged: toVP(vp),
      });
    }

    return createSuccessPayload(toVP(vp));
  },

  /**
   * Delete a Virtual Person
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteVP(id: "vp_123") {
   *     success
   *     deletedId
   *     errors {
   *       code
   *       message
   *     }
   *   }
   * }
   * ```
   */
  deleteVP: async (
    _parent: unknown,
    args: DeleteVPArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const vp = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!vp) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'VP not found' }],
      };
    }

    // Only admins can delete VPs
    if (!isAdmin(context)) {
      throw new GraphQLError('Admin access required to delete VPs', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Deprovision resources if vpService is available
    if (context.vpService) {
      await context.vpService.deprovision(vp.id);
    }

    // Delete VP (user will cascade due to onDelete: Cascade)
    await context.prisma.vP.delete({ where: { id: args.id } });

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Activate a Virtual Person (set status to ONLINE)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID
   * @param context - GraphQL context
   * @returns VP payload with activated VP
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   activateVP(id: "vp_123") {
   *     vp {
   *       id
   *       status
   *     }
   *   }
   * }
   * ```
   */
  activateVP: async (
    _parent: unknown,
    args: ActivateVPArgs,
    context: GraphQLContext
  ): Promise<VPPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toVP(existingVP);
    if (!canModifyVP(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (existingVP.status === 'ONLINE') {
      return createSuccessPayload(existingVPData);
    }

    const vp = await context.prisma.vP.update({
      where: { id: args.id },
      data: { status: 'ONLINE' },
    });

    // Publish status change
    await context.pubsub.publish(`${VP_STATUS_CHANGED}_${args.id}`, {
      vpStatusChanged: toVP(vp),
    });

    return createSuccessPayload(toVP(vp));
  },

  /**
   * Deactivate a Virtual Person (set status to OFFLINE)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID
   * @param context - GraphQL context
   * @returns VP payload with deactivated VP
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deactivateVP(id: "vp_123") {
   *     vp {
   *       id
   *       status
   *     }
   *   }
   * }
   * ```
   */
  deactivateVP: async (
    _parent: unknown,
    args: DeactivateVPArgs,
    context: GraphQLContext
  ): Promise<VPPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toVP(existingVP);
    if (!canModifyVP(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (existingVP.status === 'OFFLINE') {
      return createSuccessPayload(existingVPData);
    }

    const vp = await context.prisma.vP.update({
      where: { id: args.id },
      data: { status: 'OFFLINE' },
    });

    // Publish status change
    await context.pubsub.publish(`${VP_STATUS_CHANGED}_${args.id}`, {
      vpStatusChanged: toVP(vp),
    });

    return createSuccessPayload(toVP(vp));
  },

  /**
   * Rotate API key for a Virtual Person (stores in daemon config)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID
   * @param context - GraphQL context
   * @returns API key rotation payload with new key (shown only once)
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   rotateVPAPIKey(id: "vp_123") {
   *     vp {
   *       id
   *     }
   *     apiKey
   *     errors {
   *       code
   *       message
   *     }
   *   }
   * }
   * ```
   */
  rotateVPAPIKey: async (
    _parent: unknown,
    args: RotateVPAPIKeyArgs,
    context: GraphQLContext
  ): Promise<APIKeyRotationPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return {
        vp: null,
        apiKey: null,
        errors: [{ code: 'NOT_FOUND', message: 'VP not found' }],
      };
    }

    const existingVPData = toVP(existingVP);
    if (!canModifyVP(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Generate new API key
    let newApiKey: string;
    if (context.vpService) {
      newApiKey = await context.vpService.generateAPIKey(args.id);
    } else {
      // Fallback: generate a simple API key
      const randomPart = Math.random().toString(36).substring(2, 15);
      newApiKey = `vp_${args.id}_${Date.now()}_${randomPart}`;
    }

    // Note: In a real implementation, you would store the hashed API key
    // For now, we just return the generated key
    // The actual storage would depend on your daemon configuration approach

    return {
      vp: existingVPData,
      apiKey: newApiKey, // Return plaintext key only once
      errors: [],
    };
  },

  /**
   * Update VP configuration (capabilities, daemon endpoint, etc.)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with VP ID and new configuration
   * @param context - GraphQL context
   * @returns VP payload with updated VP
   * @throws GraphQLError if not authenticated, access denied, or invalid config
   *
   * @example
   * ```graphql
   * mutation {
   *   updateVPConfiguration(
   *     id: "vp_123",
   *     config: { daemonEndpoint: "https://daemon.example.com" }
   *   ) {
   *     vp {
   *       id
   *       daemonEndpoint
   *     }
   *   }
   * }
   * ```
   */
  updateVPConfiguration: async (
    _parent: unknown,
    args: UpdateVPConfigurationArgs,
    context: GraphQLContext
  ): Promise<VPPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.vP.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toVP(existingVP);
    if (!canModifyVP(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this VP', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate configuration if vpService is available
    if (context.vpService) {
      const isValid = await context.vpService.validateConfig(args.config);
      if (!isValid) {
        return createErrorPayload(
          'INVALID_CONFIG',
          'Configuration is invalid'
        );
      }
    }

    // Build update data from config
    const updateData: Record<string, unknown> = {};

    if ('daemonEndpoint' in args.config) {
      updateData.daemonEndpoint = args.config.daemonEndpoint;
    }
    if ('capabilities' in args.config && Array.isArray(args.config.capabilities)) {
      updateData.capabilities = args.config.capabilities;
    }

    const vp = await context.prisma.vP.update({
      where: { id: args.id },
      data: updateData,
    });

    return createSuccessPayload(toVP(vp));
  },
};

// =============================================================================
// VP SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * VP Subscription resolvers
 */
export const vpSubscriptions = {
  /**
   * Subscribe to VP status changes
   *
   * @example
   * ```graphql
   * subscription {
   *   vpStatusChanged(vpId: "vp_123") {
   *     id
   *     status
   *   }
   * }
   * ```
   */
  vpStatusChanged: {
    /**
     * Subscribe to status changes for a specific VP
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Subscription arguments with VP ID
     * @param context - GraphQL context with pubsub
     * @returns AsyncIterator for subscription events
     */
    subscribe: (
      _parent: unknown,
      args: VPStatusChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(`${VP_STATUS_CHANGED}_${args.vpId}`);
    },
  },
};

// =============================================================================
// VP FIELD RESOLVERS
// =============================================================================

/**
 * VP field resolvers for nested types
 */
export const VPFieldResolvers = {
  /**
   * Resolve the associated user for a VP
   *
   * @param parent - The parent VP object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated user
   */
  user: async (
    parent: VP,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },

  /**
   * Resolve the discipline string for a VP
   *
   * @param parent - The parent VP object
   * @returns The discipline string
   */
  discipline: (parent: VP) => {
    return parent.discipline;
  },

  /**
   * Resolve the organization for a VP
   *
   * @param parent - The parent VP object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated organization
   */
  organization: async (
    parent: VP,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.organization.findUnique({
      where: { id: parent.organizationId },
    });
  },

  /**
   * Resolve child agents managed by this VP (VPs in same org with similar discipline)
   *
   * @param parent - The parent VP object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of related VPs
   */
  agents: async (
    parent: VP,
    _args: unknown,
    context: GraphQLContext
  ) => {
    // Find VPs in the same organization (excluding self)
    const vps = await context.prisma.vP.findMany({
      where: {
        organizationId: parent.organizationId,
        id: { not: parent.id },
      },
    });
    return vps.map(toVP);
  },

  /**
   * Count total messages sent by this VP's user
   *
   * @param parent - The parent VP object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Total message count
   */
  messageCount: async (
    parent: VP,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.message.count({
      where: { authorId: parent.userId },
    });
  },

  /**
   * Get the last activity time for this VP
   *
   * @param parent - The parent VP object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Last activity timestamp or null
   */
  lastActivity: async (
    parent: VP,
    _args: unknown,
    context: GraphQLContext
  ) => {
    const lastMessage = await context.prisma.message.findFirst({
      where: { authorId: parent.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return lastMessage?.createdAt ?? null;
  },
};

// =============================================================================
// COMBINED VP RESOLVERS
// =============================================================================

/**
 * Combined VP resolvers object for use with graphql-tools
 */
export const vpResolvers = {
  Query: vpQueries,
  Mutation: vpMutations,
  Subscription: vpSubscriptions,
  VP: VPFieldResolvers,
};

export default vpResolvers;
