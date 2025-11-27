/**
 * Discipline GraphQL Resolvers
 *
 * Resolvers for Discipline operations including queries and mutations.
 * Disciplines represent functional categories for Virtual Persons (VPs) within
 * an organization (e.g., Engineering, Product, Design, Data Science).
 *
 * Note: Disciplines are stored as denormalized strings in the Orchestrator model's
 * discipline field. This resolver provides a virtual aggregation layer
 * for discipline management and Orchestrator assignment.
 *
 * @module @genesis/api-types/resolvers/discipline-resolvers
 */


import type { PrismaClient, vP as PrismaOrchestrator } from '@prisma/client';
import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

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
 * Discipline entity type for resolvers
 *
 * Since disciplines are stored as strings in the Orchestrator model,
 * this represents an aggregated view of disciplines.
 */
interface Discipline {
  /** Unique identifier (derived from name) */
  id: string;
  /** Discipline name */
  name: string;
  /** Optional description */
  description: string | null;
  /** Organization ID this discipline belongs to */
  organizationId: string;
  /** Count of VPs in this discipline */
  vpCount: number;
  /** ISO timestamp of when this discipline was first created (earliest VP) */
  createdAt: Date;
}

/**
 * Orchestrator entity type
 */
interface Orchestrator {
  id: string;
  userId: string;
  organizationId: string;
  discipline: string;
  role: string;
  capabilities: unknown;
  daemonEndpoint: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new discipline
 */
interface CreateDisciplineInput {
  name: string;
  description?: string | null;
  organizationId: string;
}

/**
 * Input for updating an existing discipline
 */
interface UpdateDisciplineInput {
  name?: string | null;
  description?: string | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface DisciplineQueryArgs {
  id: string;
}

interface DisciplinesQueryArgs {
  organizationId: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateDisciplineArgs {
  input: CreateDisciplineInput;
}

interface UpdateDisciplineArgs {
  id: string;
  input: UpdateDisciplineInput;
}

interface DeleteDisciplineArgs {
  id: string;
}

interface AssignVPToDisciplineArgs {
  orchestratorId: string;
  disciplineId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface DisciplinePayload {
  discipline: Discipline | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface VPPayload {
  vp: Orchestrator | null;
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
 * Check if user is a member of an organization
 *
 * @param context - The GraphQL context
 * @param orgId - The organization ID to check
 * @returns True if user is a member
 */
async function isOrganizationMember(
  context: GraphQLContext,
  orgId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isSystemAdmin(context)) {
    return true;
  }

  const membership = await context.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: context.user.id,
      },
    },
  });

  return !!membership;
}

/**
 * Check if user can modify an organization (is org admin/owner or system admin)
 *
 * @param context - The GraphQL context
 * @param orgId - The organization ID to check
 * @returns True if user can modify the organization
 */
async function canModifyOrganization(
  context: GraphQLContext,
  orgId: string
): Promise<boolean> {
  if (isSystemAdmin(context)) {
    return true;
  }

  if (!isAuthenticated(context)) {
    return false;
  }

  const membership = await context.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  return membership?.role === 'OWNER' || membership?.role === 'ADMIN';
}

/**
 * Generate discipline ID from organization ID and discipline name
 *
 * @param orgId - Organization ID
 * @param name - Discipline name
 * @returns Discipline ID
 */
function generateDisciplineId(orgId: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `disc_${orgId}_${slug}`;
}

/**
 * Parse discipline ID to extract organization ID and discipline name
 *
 * @param id - Discipline ID
 * @returns Organization ID and discipline slug, or null if invalid
 */
function parseDisciplineId(id: string): { orgId: string; slug: string } | null {
  const match = /^disc_(.+)_([a-z0-9-]+)$/.exec(id);
  if (!match) {
    return null;
  }
  // The orgId might contain underscores, so we need to be careful
  // Format: disc_<orgId>_<slug>
  // We'll take everything between first and last underscore as potential orgId
  const withoutPrefix = id.slice(5); // Remove 'disc_'
  const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) {
    return null;
  }
  return {
    orgId: withoutPrefix.slice(0, lastUnderscoreIndex),
    slug: withoutPrefix.slice(lastUnderscoreIndex + 1),
  };
}

/**
 * Validate discipline name
 *
 * @param name - The name to validate
 * @throws GraphQLError if name is invalid
 */
function validateDisciplineName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new GraphQLError('Discipline name is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
  if (name.length > 100) {
    throw new GraphQLError('Discipline name must be 100 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
}

/**
 * Create success payload
 */
function createSuccessPayload(discipline: Discipline): DisciplinePayload {
  return { discipline, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): DisciplinePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { discipline: null, errors };
}

/**
 * Convert Prisma Orchestrator t Orchestrator solver Orchestrator type
 */
function toVP(prismaOrchestrator: PrismaOrchestrator): Orchestrator {
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

/**
 * Get or create discipline metadata from organization settings
 *
 * @param prisma - Prisma client
 * @param orgId - Organization ID
 * @param disciplineName - Discipline name
 * @returns Discipline metadata or null
 */
async function getDisciplineMetadata(
  prisma: PrismaClient,
  orgId: string,
  disciplineName: string
): Promise<{ description: string | null } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  if (!org) {
    return null;
  }

  const settings = org.settings as Record<string, unknown> | null;
  const disciplines = settings?.disciplines as Record<string, { description?: string }> | undefined;

  if (!disciplines) {
    return { description: null };
  }

  const normalizedName = disciplineName.toLowerCase();
  const metadata = disciplines[normalizedName];

  return { description: metadata?.description ?? null };
}

/**
 * Save discipline metadata to organization settings
 *
 * @param prisma - Prisma client
 * @param orgId - Organization ID
 * @param disciplineName - Discipline name
 * @param metadata - Discipline metadata
 */
async function saveDisciplineMetadata(
  prisma: PrismaClient,
  orgId: string,
  disciplineName: string,
  metadata: { description?: string | null }
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  if (!org) {
    throw new GraphQLError('Organization not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  const settings = (org.settings as Record<string, unknown>) ?? {};
  const disciplines = (settings.disciplines as Record<string, { description?: string }>) ?? {};

  const normalizedName = disciplineName.toLowerCase();
  const existingEntry = disciplines[normalizedName] ?? {};
  if (metadata.description !== undefined) {
    if (metadata.description === null) {
      delete existingEntry.description;
    } else {
      existingEntry.description = metadata.description;
    }
  }
  disciplines[normalizedName] = existingEntry;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: {
        ...settings,
        disciplines,
      },
    },
  });
}

// =============================================================================
// DISCIPLINE QUERY RESOLVERS
// =============================================================================

/**
 * Discipline Query resolvers
 */
export const disciplineQueries = {
  /**
   * Get a discipline by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing discipline ID
   * @param context - GraphQL context
   * @returns The discipline or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   discipline(id: "disc_org123_engineering") {
   *     id
   *     name
   *     description
   *     vpCount
   *   }
   * }
   * ```
   */
  discipline: async (
    _parent: unknown,
    args: DisciplineQueryArgs,
    context: GraphQLContext
  ): Promise<Discipline | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const parsed = parseDisciplineId(args.id);
    if (!parsed) {
      return null;
    }

    const { orgId, slug } = parsed;

    // Check organization access
    const isMember = await isOrganizationMember(context, orgId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Find VPs with this discipline (case-insensitive match on slug)
    const orchestrators = await context.prisma.vP.findMany({
      where: {
        organizationId: orgId,
        discipline: {
          contains: slug,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (vps.length === 0) {
      return null;
    }

    // Get discipline metadata
    const disciplineName = orchestrators[0]!.discipline;
    const metadata = await getDisciplineMetadata(context.prisma, orgId, disciplineName);

    return {
      id: args.id,
      name: disciplineName,
      description: metadata?.description ?? null,
      organizationId: orgId,
      vpCount: orchestrators.length,
      createdAt: orchestrators[0]!.createdAt,
    };
  },

  /**
   * List all disciplines in an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with organizationId
   * @param context - GraphQL context
   * @returns Array of disciplines
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   disciplines(organizationId: "org_123") {
   *     id
   *     name
   *     vpCount
   *   }
   * }
   * ```
   */
  disciplines: async (
    _parent: unknown,
    args: DisciplinesQueryArgs,
    context: GraphQLContext
  ): Promise<Discipline[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { organizationId } = args;

    // Check organization access
    const isMember = await isOrganizationMember(context, organizationId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get all VPs in the organization
    const orchestrators = await context.prisma.vP.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    // Group VPs by discipline (case-insensitive)
    const disciplineMap = new Map<
      string,
      { name: string; orchestrators: typeof orchestrators; earliest: Date }
    >();

    for (const vp of orchestrators) {
      const normalizedName = vp.discipline.toLowerCase();

      if (!disciplineMap.has(normalizedName)) {
        disciplineMap.set(normalizedName, {
          name: vp.discipline,
          orchestrators: [vp],
          earliest: vp.createdAt,
        });
      } else {
        const entry = disciplineMap.get(normalizedName)!;
        entry.orchestrators.push(vp);
        if (vp.createdAt < entry.earliest) {
          entry.earliest = vp.createdAt;
        }
      }
    }

    // Get organization settings for discipline metadata
    const org = await context.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    const settings = org?.settings as Record<string, unknown> | null;
    const disciplinesMeta = settings?.disciplines as
      | Record<string, { description?: string }>
      | undefined;

    // Convert to Discipline objects
    const disciplines: Discipline[] = [];

    disciplineMap.forEach((entry, normalizedName) => {
      const metadata = disciplinesMeta?.[normalizedName];

      disciplines.push({
        id: generateDisciplineId(organizationId, entry.name),
        name: entry.name,
        description: metadata?.description ?? null,
        organizationId,
        vpCount: entry.orchestrators.length,
        createdAt: entry.earliest,
      });
    });

    // Sort by name
    disciplines.sort((a, b) => a.name.localeCompare(b.name));

    return disciplines;
  },
};

// =============================================================================
// DISCIPLINE MUTATION RESOLVERS
// =============================================================================

/**
 * Discipline Mutation resolvers
 */
export const disciplineMutations = {
  /**
   * Create a new discipline
   *
   * Note: This creates a placeholder Orchestrator to establish the discipline,
   * or just stores metadata if a Orchestrator with this discipline already exists.
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with discipline input
   * @param context - GraphQL context
   * @returns Discipline payload with created discipline or errors
   * @throws GraphQLError if not authenticated or validation fails
   *
   * @example
   * ```graphql
   * mutation {
   *   createDiscipline(input: {
   *     name: "Engineering",
   *     description: "Software Engineering team",
   *     organizationId: "org_123"
   *   }) {
   *     discipline {
   *       id
   *       name
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  createDiscipline: async (
    _parent: unknown,
    args: CreateDisciplineArgs,
    context: GraphQLContext
  ): Promise<DisciplinePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Check organization modification permission
    const canModify = await canModifyOrganization(context, input.organizationId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to modify this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    try {
      validateDisciplineName(input.name);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    const normalizedName = input.name.toLowerCase();

    // Check if discipline already exists (has VPs)
    const existingVPs = await context.prisma.vP.findMany({
      where: {
        organizationId: input.organizationId,
        discipline: {
          equals: input.name,
          mode: 'insensitive',
        },
      },
      take: 1,
    });

    const disciplineId = generateDisciplineId(input.organizationId, input.name);

    // Save discipline metadata to organization settings
    const metadataToSave: { description?: string | null } = {};
    if (input.description !== undefined) {
      metadataToSave.description = input.description;
    }
    await saveDisciplineMetadata(context.prisma, input.organizationId, input.name, metadataToSave);

    // If discipline already has VPs, return existing discipline
    if (existingVPs.length > 0) {
      const vpCount = await context.prisma.vP.count({
        where: {
          organizationId: input.organizationId,
          discipline: {
            equals: input.name,
            mode: 'insensitive',
          },
        },
      });

      return createSuccessPayload({
        id: disciplineId,
        name: existingVPs[0]!.discipline,
        description: input.description ?? null,
        organizationId: input.organizationId,
        vpCount,
        createdAt: existingVPs[0]!.createdAt,
      });
    }

    // Discipline doesn't have VPs yet - store just the metadata
    // The discipline will be fully realized when a Orchestrator is assigned to it
    return createSuccessPayload({
      id: disciplineId,
      name: input.name,
      description: input.description ?? null,
      organizationId: input.organizationId,
      vpCount: 0,
      createdAt: new Date(),
    });
  },

  /**
   * Update an existing discipline
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with discipline ID and update input
   * @param context - GraphQL context
   * @returns Discipline payload with updated discipline or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateDiscipline(
   *     id: "disc_org123_engineering",
   *     input: { description: "Updated description" }
   *   ) {
   *     discipline {
   *       id
   *       description
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateDiscipline: async (
    _parent: unknown,
    args: UpdateDisciplineArgs,
    context: GraphQLContext
  ): Promise<DisciplinePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    const parsed = parseDisciplineId(id);
    if (!parsed) {
      return createErrorPayload('NOT_FOUND', 'Invalid discipline ID');
    }

    const { orgId, slug } = parsed;

    // Check organization modification permission
    const canModify = await canModifyOrganization(context, orgId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to modify this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Find VPs with this discipline
    const orchestrators = await context.prisma.vP.findMany({
      where: {
        organizationId: orgId,
        discipline: {
          contains: slug,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (vps.length === 0) {
      return createErrorPayload('NOT_FOUND', 'Discipline not found');
    }

    const currentName = orchestrators[0]!.discipline;
    let newName = currentName;

    // Validate and update name if provided
    if (input.name !== undefined && input.name !== null) {
      try {
        validateDisciplineName(input.name);
        newName = input.name;

        // Update all VPs with this discipline to use the new name
        await context.prisma.vP.updateMany({
          where: {
            organizationId: orgId,
            discipline: {
              equals: currentName,
              mode: 'insensitive',
            },
          },
          data: { discipline: newName },
        });
      } catch (error) {
        if (error instanceof GraphQLError) {
          return createErrorPayload(
            error.extensions?.code as string,
            error.message
          );
        }
        throw error;
      }
    }

    // Update discipline metadata
    const metadataToUpdate: { description?: string | null } = {};
    if (input.description !== undefined) {
      metadataToUpdate.description = input.description;
    }
    await saveDisciplineMetadata(context.prisma, orgId, newName, metadataToUpdate);

    const metadata = await getDisciplineMetadata(context.prisma, orgId, newName);

    return createSuccessPayload({
      id: generateDisciplineId(orgId, newName),
      name: newName,
      description: metadata?.description ?? null,
      organizationId: orgId,
      vpCount: orchestrators.length,
      createdAt: orchestrators[0]!.createdAt,
    });
  },

  /**
   * Delete a discipline
   *
   * Note: This only removes the discipline metadata. VPs with this discipline
   * will still exist but the discipline won't be recognized as a defined category.
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with discipline ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteDiscipline(id: "disc_org123_engineering") {
   *     success
   *     deletedId
   *     errors { code message }
   *   }
   * }
   * ```
   */
  deleteDiscipline: async (
    _parent: unknown,
    args: DeleteDisciplineArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const parsed = parseDisciplineId(args.id);
    if (!parsed) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Invalid discipline ID' }],
      };
    }

    const { orgId, slug } = parsed;

    // Check organization modification permission
    const canModify = await canModifyOrganization(context, orgId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to modify this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Find VPs with this discipline to get the actual name
    const orchestrators = await context.prisma.vP.findFirst({
      where: {
        organizationId: orgId,
        discipline: {
          contains: slug,
          mode: 'insensitive',
        },
      },
    });

    // Remove discipline metadata from organization settings
    const org = await context.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    if (org) {
      const settings = (org.settings as Record<string, unknown>) ?? {};
      const disciplines = (settings.disciplines as Record<string, unknown>) ?? {};

      // Remove the discipline entry
      const normalizedName = orchestrators?.discipline.toLowerCase() ?? slug;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [normalizedName]: _, ...remainingDisciplines } = disciplines;

      await context.prisma.organization.update({
        where: { id: orgId },
        data: {
          settings: {
            ...settings,
            disciplines: remainingDisciplines as Record<string, { description?: string }>,
          },
        },
      });
    }

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Assign a Orchestrator to a discipline
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with orchestratorId and disciplineId
   * @param context - GraphQL context
   * @returns Orchestrator payload wi Orchestrator pdated Orchestrator or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   assignVPToDiscipline(
   *     orchestratorId: "vp_123",
   *     disciplineId: "disc_org123_engineering"
   *   ) {
   *     vp {
   *       id
   *       discipline
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  assignVPToDiscipline: async (
    _parent: unknown,
    args: AssignVPToDisciplineArgs,
    context: GraphQLContext
  ): Promise<OrchestratorPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orchestratorId, disciplineId } = args;

    // Find the VP
    const vp = await context.prisma.vP.findUnique({
      where: { id: orchestratorId },
    });

    if (!vp) {
      return {
        vp: null,
        errors: [{ code: 'NOT_FOUND', message: 'VP not found' }],
      };
    }

    // Check organization modification permission
    const canModify = await canModifyOrganization(context, vp.organizationId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to modify VPs in this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Parse discipline ID
    const parsed = parseDisciplineId(disciplineId);
    if (!parsed) {
      return {
        vp: null,
        errors: [{ code: 'BAD_USER_INPUT', message: 'Invalid discipline ID' }],
      };
    }

    // Verify discipline is in the same organization
    if (parsed.orgId !== vp.organizationId) {
      return {
        vp: null,
        errors: [{ code: 'BAD_USER_INPUT', message: 'Discipline must be in the same organization as the VP' }],
      };
    }

    // Find an existing Orchestrator with this discipline to get the proper casing
    const existingVPWithDiscipline = await context.prisma.vP.findFirst({
      where: {
        organizationId: vp.organizationId,
        discipline: {
          contains: parsed.slug,
          mode: 'insensitive',
        },
      },
    });

    // Get discipline name from existing Orchestrator or from metadata
    let disciplineName: string;
    if (existingVPWithDiscipline) {
      disciplineName = existingVPWithDiscipline.discipline;
    } else {
      // Try to get from organization settings
      const org = await context.prisma.organization.findUnique({
        where: { id: vp.organizationId },
        select: { settings: true },
      });

      const settings = org?.settings as Record<string, unknown> | null;
      const disciplines = settings?.disciplines as Record<string, { description?: string }> | undefined;

      // Find matching discipline in metadata
      const matchingKey = disciplines ? Object.keys(disciplines).find(
        (key) => key.toLowerCase() === parsed.slug.toLowerCase()
      ) : null;

      if (matchingKey) {
        // Capitalize first letter
        disciplineName = matchingKey.charAt(0).toUpperCase() + matchingKey.slice(1);
      } else {
        // Just use the slug with first letter capitalized
        disciplineName = parsed.slug.charAt(0).toUpperCase() + parsed.slug.slice(1);
      }
    }

    // Update Orchestrator with new discipline
    const updatedVP = await context.prisma.vP.update({
      where: { id: orchestratorId },
      data: { discipline: disciplineName },
    });

    return {
      vp: toVP(updatedVP),
      errors: [],
    };
  },
};

// =============================================================================
// DISCIPLINE FIELD RESOLVERS
// =============================================================================

/**
 * Discipline field resolvers for nested types
 */
export const DisciplineFieldResolvers = {
  /**
   * Resolve organization for a discipline
   *
   * @param parent - The parent Discipline object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The organization
   */
  organization: async (
    parent: Discipline,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.organization.findUnique({
      where: { id: parent.organizationId },
    });
  },

  /**
   * Resolve VPs for a discipline
   *
   * @param parent - The parent Discipline object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of VPs in the discipline
   */
  orchestrators: async (
    parent: Discipline,
    _args: unknown,
    context: GraphQLContext
  ) => {
    const orchestrators = await context.prisma.vP.findMany({
      where: {
        organizationId: parent.organizationId,
        discipline: {
          equals: parent.name,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orchestrators.map(toVP);
  },
};

// =============================================================================
// COMBINED DISCIPLINE RESOLVERS
// =============================================================================

/**
 * Combined discipline resolvers object for use with graphql-tools
 */
export const disciplineResolvers = {
  Query: disciplineQueries,
  Mutation: disciplineMutations,
  Discipline: DisciplineFieldResolvers,
};

export default disciplineResolvers;
