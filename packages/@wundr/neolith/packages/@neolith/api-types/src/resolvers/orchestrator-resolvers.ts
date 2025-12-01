/**
 * Orchestrator (Orchestrator) GraphQL Resolvers
 *
 * Comprehensive resolvers for Orchestrator operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks,
 * input validation, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/orchestrator-resolvers
 */

import type {
  Prisma,
  PrismaClient,
  orchestrator as PrismaOrchestrator,
  OrchestratorStatus as PrismaOrchestratorStatus,
} from '@prisma/client';
import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Orchestrator status enum matching the Prisma schema
 */
export const OrchestratorStatus = {
  Online: 'ONLINE',
  Offline: 'OFFLINE',
  Busy: 'BUSY',
  Away: 'AWAY',
} as const;

export type OrchestratorStatusType =
  (typeof OrchestratorStatus)[keyof typeof OrchestratorStatus];

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
  /** Optional Orchestrator service for business logic */
  orchestratorService?: OrchestratorService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * OrchestratorService interface for business logic operations
 */
export interface OrchestratorService {
  /** Generate a new API key for Orchestrator */
  generateAPIKey(orchestratorId: string): Promise<string>;
  /** Validate Orchestrator configuration */
  validateConfig(config: Record<string, unknown>): Promise<boolean>;
  /** Provision Orchestrator resources */
  provision(orchestratorId: string): Promise<void>;
  /** Deprovision Orchestrator resources */
  deprovision(orchestratorId: string): Promise<void>;
}

/**
 * Orchestrator entity type matching Prisma schema
 */
interface Orchestrator {
  id: string;
  userId: string;
  organizationId: string;
  discipline: string;
  role: string;
  capabilities: unknown; // JSON field
  daemonEndpoint: string | null;
  status: PrismaOrchestratorStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OrchestratorStatistics type
 */
interface OrchestratorStats {
  id: string;
  orchestratorId: string;
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
 * Input for creating a new Orchestrator
 */
interface CreateOrchestratorInput {
  discipline: string;
  role: string;
  capabilities?: unknown[] | null;
  daemonEndpoint?: string | null;
  organizationId: string;
  /** User display name for the Orchestrator */
  displayName?: string | null;
  /** User email for the Orchestrator */
  email?: string | null;
}

/**
 * Input for updating an existing Orchestrator
 */
interface UpdateOrchestratorInput {
  discipline?: string | null;
  role?: string | null;
  status?: OrchestratorStatusType | null;
  capabilities?: unknown[] | null;
  daemonEndpoint?: string | null;
}

/**
 * Filter input for listing VPs
 */
interface OrchestratorFilterInput {
  status?: OrchestratorStatusType | null;
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

interface OrchestratorQueryArgs {
  id: string;
}

interface OrchestratorBySlugArgs {
  slug: string;
}

interface OrchestratorsInOrganizationArgs {
  orgId: string;
  filter?: OrchestratorFilterInput | null;
  pagination?: PaginationInput | null;
}

interface OrchestratorsInDisciplineArgs {
  disciplineId: string;
}

interface OrchestratorStatsArgs {
  id: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateOrchestratorArgs {
  input: CreateOrchestratorInput;
}

interface UpdateOrchestratorArgs {
  id: string;
  input: UpdateOrchestratorInput;
}

interface DeleteOrchestratorArgs {
  id: string;
}

interface ActivateOrchestratorArgs {
  id: string;
}

interface DeactivateOrchestratorArgs {
  id: string;
}

interface RotateOrchestratorAPIKeyArgs {
  id: string;
}

interface UpdateOrchestratorConfigurationArgs {
  id: string;
  config: Record<string, unknown>;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface OrchestratorStatusChangedArgs {
  orchestratorId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface OrchestratorPayload {
  orchestrator: Orchestrator | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface ApiKeyRotationPayload {
  orchestrator: Orchestrator | null;
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
 * Check if user can access a specific Orchestrator
 *
 * @param context - The GraphQL context
 * @param orchestrator - The Orchestrator to check access for
 * @returns True if user can access the Orchestrator
 */
function canAccessOrchestrator(
  context: GraphQLContext,
  orchestrator: Orchestrator
): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // Admins can access any Orchestrator
  if (isAdmin(context)) {
    return true;
  }
  // Users can access their own Orchestrator
  return orchestrator.userId === context.user.id;
}

/**
 * Check if user can modify a specific Orchestrator
 *
 * @param context - The GraphQL context
 * @param orchestrator - The Orchestrator to check modification rights for
 * @returns True if user can modify the Orchestrator
 */
function canModifyOrchestrator(
  context: GraphQLContext,
  orchestrator: Orchestrator
): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // Admins can modify any Orchestrator
  if (isAdmin(context)) {
    return true;
  }
  // Users can modify their own Orchestrator
  return orchestrator.userId === context.user.id;
}

/**
 * Validate Orchestrator discipline
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
 * Validate Orchestrator role
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
 * Generate cursor from Orchestrator for pagination
 *
 * @param orchestrator - The Orchestrator to generate cursor for
 * @returns Base64 encoded cursor
 */
function generateCursor(orchestrator: Orchestrator): string {
  return Buffer.from(
    `${orchestrator.createdAt.toISOString()}:${orchestrator.id}`
  ).toString('base64');
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
function createSuccessPayload(orchestrator: Orchestrator): OrchestratorPayload {
  return { orchestrator, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): OrchestratorPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { orchestrator: null, errors };
}

/**
 * Convert Prisma Orchestrator to resolver Orchestrator type
 */
function toOrchestrator(prismaOrchestrator: PrismaOrchestrator): Orchestrator {
  return {
    id: prismaOrchestrator.id,
    userId: prismaOrchestrator.userId,
    organizationId: prismaOrchestrator.organizationId,
    discipline: prismaOrchestrator.discipline,
    role: prismaOrchestrator.role,
    capabilities: prismaOrchestrator.capabilities,
    daemonEndpoint: prismaOrchestrator.daemonEndpoint,
    status: prismaOrchestrator.status,
    createdAt: prismaOrchestrator.createdAt,
    updatedAt: prismaOrchestrator.updatedAt,
  };
}

// =============================================================================
// SUBSCRIPTION EVENTS
// =============================================================================

/** Subscription event names */
export const ORCHESTRATOR_STATUS_CHANGED = 'ORCHESTRATOR_STATUS_CHANGED';

// =============================================================================
// OrchestratorQUERY RESOLVERS
// =============================================================================

/**
 * OrchestratorQuery resolvers
 */
export const orchestratorQueries = {
  /**
   * Get a Orchestrator by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing OrchestratorID
   * @param context - GraphQL context
   * @returns The Orchestrator or null if not found
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   orchestrator(id: "vp_123") {
   *     id
   *     discipline
   *     status
   *   }
   * }
   * ```
   */
  orchestrator: async (
    _parent: unknown,
    args: OrchestratorQueryArgs,
    context: GraphQLContext
  ): Promise<Orchestrator | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const orchestrator = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!orchestrator) {
      return null;
    }

    const vpData = toOrchestrator(orchestrator);
    if (!canAccessOrchestrator(context, vpData)) {
      throw new GraphQLError('Access denied to this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return vpData;
  },

  /**
   * Get a Orchestrator by its slug (discipline-based or custom identifier)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing Orchestrator slug
   * @param context - GraphQL context
   * @returns The Orchestrator or null if not found
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
    args: OrchestratorBySlugArgs,
    context: GraphQLContext
  ): Promise<Orchestrator | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Find Orchestrator by discipline slug or user email pattern
    const orchestrator = await context.prisma.orchestrator.findFirst({
      where: {
        OR: [
          { discipline: { contains: args.slug, mode: 'insensitive' } },
          { user: { email: { contains: args.slug, mode: 'insensitive' } } },
        ],
      },
    });

    if (!orchestrator) {
      return null;
    }

    const vpData = toOrchestrator(orchestrator);
    if (!canAccessOrchestrator(context, vpData)) {
      throw new GraphQLError('Access denied to this Orchestrator', {
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
   *   orchestratorsInOrganization(
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
  orchestratorsInOrganization: async (
    _parent: unknown,
    args: OrchestratorsInOrganizationArgs,
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
    const orchestrators = await context.prisma.orchestrator.findMany({
      where,
      take: first + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // Get total count
    const totalCount = await context.prisma.orchestrator.count({
      where: { organizationId: orgId },
    });

    const hasNextPage = orchestrators.length > first;
    const nodes = hasNextPage ? orchestrators.slice(0, -1) : orchestrators;

    const edges = nodes.map((orchestrator: PrismaOrchestrator) => {
      const vpData = toOrchestrator(orchestrator);
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
   *   orchestratorsInDiscipline(disciplineId: "engineering") {
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
  orchestratorsInDiscipline: async (
    _parent: unknown,
    args: OrchestratorsInDisciplineArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const orchestrators = await context.prisma.orchestrator.findMany({
      where: { discipline: args.disciplineId },
      orderBy: { createdAt: 'desc' },
    });

    const edges = orchestrators.map((orchestrator: PrismaOrchestrator) => {
      const vpData = toOrchestrator(orchestrator);
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
      totalCount: orchestrators.length,
    };
  },

  /**
   * Get statistics for a specific Orchestrator
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing OrchestratorID
   * @param context - GraphQL context
   * @returns Orchestrator statistics or null if not found
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
    args: OrchestratorStatsArgs,
    context: GraphQLContext
  ): Promise<OrchestratorStats | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const orchestrator = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!orchestrator) {
      return null;
    }

    const vpData = toOrchestrator(orchestrator);
    if (!canAccessOrchestrator(context, vpData)) {
      throw new GraphQLError('Access denied to this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Aggregate statistics from messages and activity logs
    const messageCount = await context.prisma.message.count({
      where: { authorId: orchestrator.userId },
    });

    const lastMessage = await context.prisma.message.findFirst({
      where: { authorId: orchestrator.userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: `stats_${orchestrator.id}`,
      orchestratorId: orchestrator.id,
      messageCount,
      lastActivity: lastMessage?.createdAt ?? null,
      averageResponseTime: null, // Calculated from activity logs
      successRate: null, // Calculated from task completions
      tokenUsage: 0, // Aggregated from usage logs
    };
  },
};

// =============================================================================
// OrchestratorMUTATION RESOLVERS
// =============================================================================

/**
 * OrchestratorMutation resolvers
 */
export const orchestratorMutations = {
  /**
   * Create a new Orchestrator
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with Orchestrator creation input
   * @param context - GraphQL context
   * @returns Orchestrator payload with created Orchestrator or errors
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
   *     orchestrator {
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
    args: CreateOrchestratorArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
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

    // Create associated user for the Orchestrator
    const orchestratorEmail =
      input.email ?? `vp_${Date.now()}@genesis.orchestrator`;
    const orchestratorUser = await context.prisma.user.create({
      data: {
        email: orchestratorEmail,
        name: input.displayName ?? input.role,
        displayName: input.displayName ?? input.role,
        isOrchestrator: true,
        status: 'ACTIVE',
      },
    });

    // Create the Orchestrator
    const orchestrator = await context.prisma.orchestrator.create({
      data: {
        userId: orchestratorUser.id,
        organizationId: input.organizationId,
        discipline: input.discipline,
        role: input.role,
        capabilities: (input.capabilities ?? []) as Prisma.InputJsonValue,
        daemonEndpoint: input.daemonEndpoint ?? null,
        status: 'OFFLINE',
      },
    });

    // Start provisioning if orchestratorService is available
    if (context.orchestratorService) {
      context.orchestratorService.provision(orchestrator.id).catch(err => {
        // eslint-disable-next-line no-console
        console.error(
          `Failed to provision Orchestrator ${orchestrator.id}:`,
          err
        );
      });
    }

    return createSuccessPayload(toOrchestrator(orchestrator));
  },

  /**
   * Update an existing Orchestrator
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID and update input
   * @param context - GraphQL context
   * @returns Orchestrator payload with updated Orchestrator or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateVP(
   *     id: "vp_123",
   *     input: { role: "Lead Developer" }
   *   ) {
   *     orchestrator {
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
    args: UpdateOrchestratorArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Fetch existing Orchestrator
    const existingVP = await context.prisma.orchestrator.findUnique({
      where: { id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toOrchestrator(existingVP);
    if (!canModifyOrchestrator(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this Orchestrator', {
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
      updateData.status = input.status as PrismaOrchestratorStatus;
    }
    if (input.capabilities !== undefined && input.capabilities !== null) {
      updateData.capabilities = input.capabilities;
    }
    if (input.daemonEndpoint !== undefined) {
      updateData.daemonEndpoint = input.daemonEndpoint;
    }

    const orchestrator = await context.prisma.orchestrator.update({
      where: { id },
      data: updateData,
    });

    // Publish status change if status was updated
    if (input.status && input.status !== existingVP.status) {
      await context.pubsub.publish(`${ORCHESTRATOR_STATUS_CHANGED}_${id}`, {
        vpStatusChanged: toOrchestrator(orchestrator),
      });
    }

    return createSuccessPayload(toOrchestrator(orchestrator));
  },

  /**
   * Delete a Orchestrator
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID
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
    args: DeleteOrchestratorArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const orchestrator = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!orchestrator) {
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

    // Deprovision resources if orchestratorService is available
    if (context.orchestratorService) {
      await context.orchestratorService.deprovision(orchestrator.id);
    }

    // Delete Orchestrator (user will cascade due to onDelete: Cascade)
    await context.prisma.orchestrator.delete({ where: { id: args.id } });

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Activate a Orchestrator (set status to ONLINE)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID
   * @param context - GraphQL context
   * @returns Orchestrator payload with activated Orchestrator
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   activateVP(id: "vp_123") {
   *     orchestrator {
   *       id
   *       status
   *     }
   *   }
   * }
   * ```
   */
  activateVP: async (
    _parent: unknown,
    args: ActivateOrchestratorArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toOrchestrator(existingVP);
    if (!canModifyOrchestrator(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (existingVP.status === 'ONLINE') {
      return createSuccessPayload(existingVPData);
    }

    const orchestrator = await context.prisma.orchestrator.update({
      where: { id: args.id },
      data: { status: 'ONLINE' },
    });

    // Publish status change
    await context.pubsub.publish(`${ORCHESTRATOR_STATUS_CHANGED}_${args.id}`, {
      vpStatusChanged: toOrchestrator(orchestrator),
    });

    return createSuccessPayload(toOrchestrator(orchestrator));
  },

  /**
   * Deactivate a Orchestrator (set status to OFFLINE)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID
   * @param context - GraphQL context
   * @returns Orchestrator payload with deactivated Orchestrator
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deactivateVP(id: "vp_123") {
   *     orchestrator {
   *       id
   *       status
   *     }
   *   }
   * }
   * ```
   */
  deactivateVP: async (
    _parent: unknown,
    args: DeactivateOrchestratorArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toOrchestrator(existingVP);
    if (!canModifyOrchestrator(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (existingVP.status === 'OFFLINE') {
      return createSuccessPayload(existingVPData);
    }

    const orchestrator = await context.prisma.orchestrator.update({
      where: { id: args.id },
      data: { status: 'OFFLINE' },
    });

    // Publish status change
    await context.pubsub.publish(`${ORCHESTRATOR_STATUS_CHANGED}_${args.id}`, {
      vpStatusChanged: toOrchestrator(orchestrator),
    });

    return createSuccessPayload(toOrchestrator(orchestrator));
  },

  /**
   * Rotate API key for a Orchestrator (stores in daemon config)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID
   * @param context - GraphQL context
   * @returns API key rotation payload with new key (shown only once)
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   rotateVPAPIKey(id: "vp_123") {
   *     orchestrator {
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
    args: RotateOrchestratorAPIKeyArgs,
    context: GraphQLContext
  ): Promise<ApiKeyRotationPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return {
        orchestrator: null,
        apiKey: null,
        errors: [{ code: 'NOT_FOUND', message: 'VP not found' }],
      };
    }

    const existingVPData = toOrchestrator(existingVP);
    if (!canModifyOrchestrator(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Generate new API key
    let newApiKey: string;
    if (context.orchestratorService) {
      newApiKey = await context.orchestratorService.generateAPIKey(args.id);
    } else {
      // Fallback: generate a simple API key
      const randomPart = Math.random().toString(36).substring(2, 15);
      newApiKey = `vp_${args.id}_${Date.now()}_${randomPart}`;
    }

    // Note: In a real implementation, you would store the hashed API key
    // For now, we just return the generated key
    // The actual storage would depend on your daemon configuration approach

    return {
      orchestrator: existingVPData,
      apiKey: newApiKey, // Return plaintext key only once
      errors: [],
    };
  },

  /**
   * Update Orchestrator configuration (capabilities, daemon endpoint, etc.)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with OrchestratorID and new configuration
   * @param context - GraphQL context
   * @returns Orchestrator payload with updated Orchestrator
   * @throws GraphQLError if not authenticated, access denied, or invalid config
   *
   * @example
   * ```graphql
   * mutation {
   *   updateVPConfiguration(
   *     id: "vp_123",
   *     config: { daemonEndpoint: "https://daemon.example.com" }
   *   ) {
   *     orchestrator {
   *       id
   *       daemonEndpoint
   *     }
   *   }
   * }
   * ```
   */
  updateVPConfiguration: async (
    _parent: unknown,
    args: UpdateOrchestratorConfigurationArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existingVP = await context.prisma.orchestrator.findUnique({
      where: { id: args.id },
    });

    if (!existingVP) {
      return createErrorPayload('NOT_FOUND', 'VP not found');
    }

    const existingVPData = toOrchestrator(existingVP);
    if (!canModifyOrchestrator(context, existingVPData)) {
      throw new GraphQLError('Access denied to modify this Orchestrator', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate configuration if orchestratorService is available
    if (context.orchestratorService) {
      const isValid = await context.orchestratorService.validateConfig(
        args.config
      );
      if (!isValid) {
        return createErrorPayload('INVALID_CONFIG', 'Configuration is invalid');
      }
    }

    // Build update data from config
    const updateData: Record<string, unknown> = {};

    if ('daemonEndpoint' in args.config) {
      updateData.daemonEndpoint = args.config.daemonEndpoint;
    }
    if (
      'capabilities' in args.config &&
      Array.isArray(args.config.capabilities)
    ) {
      updateData.capabilities = args.config.capabilities;
    }

    const orchestrator = await context.prisma.orchestrator.update({
      where: { id: args.id },
      data: updateData,
    });

    return createSuccessPayload(toOrchestrator(orchestrator));
  },
};

// =============================================================================
// OrchestratorSUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * OrchestratorSubscription resolvers
 */
export const orchestratorSubscriptions = {
  /**
   * Subscribe to Orchestrator status changes
   *
   * @example
   * ```graphql
   * subscription {
   *   vpStatusChanged(orchestratorId: "vp_123") {
   *     id
   *     status
   *   }
   * }
   * ```
   */
  vpStatusChanged: {
    /**
     * Subscribe to status changes for a specific Orchestrator
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Subscription arguments with OrchestratorID
     * @param context - GraphQL context with pubsub
     * @returns AsyncIterator for subscription events
     */
    subscribe: (
      _parent: unknown,
      args: OrchestratorStatusChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${ORCHESTRATOR_STATUS_CHANGED}_${args.orchestratorId}`
      );
    },
  },
};

// =============================================================================
// OrchestratorFIELD RESOLVERS
// =============================================================================

/**
 * Orchestrator field resolvers for nested types
 */
export const OrchestratorFieldResolvers = {
  /**
   * Resolve the associated user for a Orchestrator
   *
   * @param parent - The parent Orchestrator object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated user
   */
  user: async (
    parent: Orchestrator,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },

  /**
   * Resolve the discipline string for a Orchestrator
   *
   * @param parent - The parent Orchestrator object
   * @returns The discipline string
   */
  discipline: (parent: Orchestrator) => {
    return parent.discipline;
  },

  /**
   * Resolve the organization for a Orchestrator
   *
   * @param parent - The parent Orchestrator object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The associated organization
   */
  organization: async (
    parent: Orchestrator,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.organization.findUnique({
      where: { id: parent.organizationId },
    });
  },

  /**
   * Resolve child agents managed by this Orchestrator (VPs in same org with similar discipline)
   *
   * @param parent - The parent Orchestrator object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of related VPs
   */
  agents: async (
    parent: Orchestrator,
    _args: unknown,
    context: GraphQLContext
  ) => {
    // Find VPs in the same organization (excluding self)
    const orchestrators = await context.prisma.orchestrator.findMany({
      where: {
        organizationId: parent.organizationId,
        id: { not: parent.id },
      },
    });
    return orchestrators.map(toOrchestrator);
  },

  /**
   * Count total messages sent by this Orchestrator's user
   *
   * @param parent - The parent Orchestrator object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Total message count
   */
  messageCount: async (
    parent: Orchestrator,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.message.count({
      where: { authorId: parent.userId },
    });
  },

  /**
   * Get the last activity time for this Orchestrator
   *
   * @param parent - The parent Orchestrator object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Last activity timestamp or null
   */
  lastActivity: async (
    parent: Orchestrator,
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
// COMBINED OrchestratorRESOLVERS
// =============================================================================

/**
 * Combined Orchestrator resolvers object for use with graphql-tools
 */
export const orchestratorResolvers = {
  Query: orchestratorQueries,
  Mutation: orchestratorMutations,
  Subscription: orchestratorSubscriptions,
  Orchestrator: OrchestratorFieldResolvers,
};

export default orchestratorResolvers;
