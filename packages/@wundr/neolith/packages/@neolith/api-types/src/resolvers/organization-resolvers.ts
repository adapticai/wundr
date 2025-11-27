/**
 * Organization GraphQL Resolvers
 *
 * Comprehensive resolvers for Organization operations including queries, mutations,
 * and field resolvers. Implements authorization checks (organization membership/role),
 * input validation, cursor-based pagination, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/organization-resolvers
 */


import type {
  Prisma,
  PrismaClient,
  organization as PrismaOrganization,
  OrganizationRole as PrismaOrgRole,
} from '@prisma/client';
import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Organization role enum matching the Prisma schema
 */
export const OrganizationRole = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Member: 'MEMBER',
} as const;

export type OrganizationRoleType = (typeof OrganizationRole)[keyof typeof OrganizationRole];

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
 * Organization entity type for resolvers
 */
interface Organization {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description: string | null;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization member info
 */
interface OrganizationMemberInfo {
  isMember: boolean;
  role: PrismaOrgRole | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new organization
 */
interface CreateOrganizationInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
}

/**
 * Input for updating an existing organization
 */
interface UpdateOrganizationInput {
  name?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  settings?: Record<string, unknown> | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface OrganizationQueryArgs {
  id: string;
}

interface OrganizationBySlugArgs {
  slug: string;
}

interface OrganizationMembersArgs {
  orgId: string;
  role?: OrganizationRoleType | null;
  first?: number | null;
  after?: string | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateOrganizationArgs {
  input: CreateOrganizationInput;
}

interface UpdateOrganizationArgs {
  id: string;
  input: UpdateOrganizationInput;
}

interface DeleteOrganizationArgs {
  id: string;
}

interface AddOrganizationMemberArgs {
  orgId: string;
  userId: string;
  role: OrganizationRoleType;
}

interface RemoveOrganizationMemberArgs {
  orgId: string;
  userId: string;
}

interface UpdateOrganizationMemberRoleArgs {
  orgId: string;
  userId: string;
  role: OrganizationRoleType;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface OrganizationPayload {
  organization: Organization | null;
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
    role: PrismaOrgRole;
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
 * Check if user is a member of an organization and get their role
 *
 * @param context - The GraphQL context
 * @param orgId - The organization ID to check
 * @returns Organization member info
 */
async function getOrganizationMemberInfo(
  context: GraphQLContext,
  orgId: string
): Promise<OrganizationMemberInfo> {
  if (!isAuthenticated(context)) {
    return { isMember: false, role: null };
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

  if (!membership) {
    // System admins can access any org
    if (isSystemAdmin(context)) {
      return { isMember: true, role: 'ADMIN' };
    }
    return { isMember: false, role: null };
  }

  return { isMember: true, role: membership.role };
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

  const memberInfo = await getOrganizationMemberInfo(context, orgId);
  return memberInfo.role === 'OWNER' || memberInfo.role === 'ADMIN';
}

/**
 * Validate organization name
 *
 * @param name - The name to validate
 * @throws GraphQLError if name is invalid
 */
function validateOrganizationName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new GraphQLError('Organization name is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
  if (name.length > 255) {
    throw new GraphQLError('Organization name must be 255 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
}

/**
 * Validate organization slug
 *
 * @param slug - The slug to validate
 * @throws GraphQLError if slug is invalid
 */
function validateSlug(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new GraphQLError('Organization slug is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'slug' },
    });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new GraphQLError(
      'Organization slug must contain only lowercase letters, numbers, and hyphens',
      { extensions: { code: 'BAD_USER_INPUT', field: 'slug' } }
    );
  }
  if (slug.length > 100) {
    throw new GraphQLError('Organization slug must be 100 characters or less', {
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
  return Buffer.from(`${item.createdAt.toISOString()}:${item.id}`).toString('base64');
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
function createSuccessPayload(organization: Organization): OrganizationPayload {
  return { organization, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): OrganizationPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { organization: null, errors };
}

/**
 * Convert Prisma organization to resolver organization type
 */
function toOrganization(prismaOrg: PrismaOrganization): Organization {
  return {
    id: prismaOrg.id,
    name: prismaOrg.name,
    slug: prismaOrg.slug,
    avatarUrl: prismaOrg.avatarUrl,
    description: prismaOrg.description,
    settings: prismaOrg.settings,
    createdAt: prismaOrg.createdAt,
    updatedAt: prismaOrg.updatedAt,
  };
}

// =============================================================================
// ORGANIZATION QUERY RESOLVERS
// =============================================================================

/**
 * Organization Query resolvers
 */
export const organizationQueries = {
  /**
   * Get an organization by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing organization ID
   * @param context - GraphQL context
   * @returns The organization or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   organization(id: "org_123") {
   *     id
   *     name
   *     slug
   *   }
   * }
   * ```
   */
  organization: async (
    _parent: unknown,
    args: OrganizationQueryArgs,
    context: GraphQLContext
  ): Promise<Organization | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const org = await context.prisma.organization.findUnique({
      where: { id: args.id },
    });

    if (!org) {
      return null;
    }

    // Check access - user must be a member or system admin
    const memberInfo = await getOrganizationMemberInfo(context, org.id);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return toOrganization(org);
  },

  /**
   * Get an organization by its slug
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing organization slug
   * @param context - GraphQL context
   * @returns The organization or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   organizationBySlug(slug: "my-org") {
   *     id
   *     name
   *   }
   * }
   * ```
   */
  organizationBySlug: async (
    _parent: unknown,
    args: OrganizationBySlugArgs,
    context: GraphQLContext
  ): Promise<Organization | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const org = await context.prisma.organization.findUnique({
      where: { slug: args.slug },
    });

    if (!org) {
      return null;
    }

    // Check access - user must be a member or system admin
    const memberInfo = await getOrganizationMemberInfo(context, org.id);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return toOrganization(org);
  },

  /**
   * List all organizations the current user belongs to
   *
   * @param _parent - Parent resolver result (unused)
   * @param _args - Query arguments (unused)
   * @param context - GraphQL context
   * @returns Array of organizations
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   organizations {
   *     id
   *     name
   *     slug
   *   }
   * }
   * ```
   */
  organizations: async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // System admins can see all organizations
    if (isSystemAdmin(context)) {
      const orgs = await context.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return orgs.map(toOrganization);
    }

    // Regular users see only their organizations
    const memberships = await context.prisma.organizationMember.findMany({
      where: { userId: context.user.id },
      include: { organization: true },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => toOrganization(m.organization));
  },

  /**
   * List members of an organization with optional role filter
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with orgId, role filter, and pagination
   * @param context - GraphQL context
   * @returns Paginated list of organization members
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   organizationMembers(orgId: "org_123", role: ADMIN) {
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
  organizationMembers: async (
    _parent: unknown,
    args: OrganizationMembersArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orgId, role } = args;
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);

    // Check access
    const memberInfo = await getOrganizationMemberInfo(context, orgId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: Prisma.organizationMemberWhereInput = {
      organizationId: orgId,
    };

    if (role) {
      where.role = role as PrismaOrgRole;
    }

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

    const members = await context.prisma.organizationMember.findMany({
      where,
      take: first + 1,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: { id: true, email: true, name: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const totalCount = await context.prisma.organizationMember.count({
      where: { organizationId: orgId, ...(role ? { role: role as PrismaOrgRole } : {}) },
    });

    const hasNextPage = members.length > first;
    const nodes = hasNextPage ? members.slice(0, -1) : members;

    const edges = nodes.map((member) => ({
      node: {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
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
};

// =============================================================================
// ORGANIZATION MUTATION RESOLVERS
// =============================================================================

/**
 * Organization Mutation resolvers
 */
export const organizationMutations = {
  /**
   * Create a new organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with organization input
   * @param context - GraphQL context
   * @returns Organization payload with created organization or errors
   * @throws GraphQLError if not authenticated or validation fails
   *
   * @example
   * ```graphql
   * mutation {
   *   createOrganization(input: { name: "My Org", slug: "my-org" }) {
   *     organization {
   *       id
   *       name
   *       slug
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  createOrganization: async (
    _parent: unknown,
    args: CreateOrganizationArgs,
    context: GraphQLContext
  ): Promise<OrganizationPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate input
    try {
      validateOrganizationName(input.name);
      const slug = input.slug ?? generateSlug(input.name);
      validateSlug(slug);

      // Check if slug is already taken
      const existingOrg = await context.prisma.organization.findUnique({
        where: { slug },
      });

      if (existingOrg) {
        return createErrorPayload(
          'CONFLICT',
          'An organization with this slug already exists'
        );
      }

      // Create organization and add creator as owner
      const org = await context.prisma.organization.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          avatarUrl: input.avatarUrl ?? null,
          settings: {},
          organizationMembers: {
            create: {
              userId: context.user.id,
              role: 'OWNER',
            },
          },
        },
      });

      return createSuccessPayload(toOrganization(org));
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
   * Update an existing organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with organization ID and update input
   * @param context - GraphQL context
   * @returns Organization payload with updated organization or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateOrganization(id: "org_123", input: { name: "New Name" }) {
   *     organization {
   *       id
   *       name
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateOrganization: async (
    _parent: unknown,
    args: UpdateOrganizationArgs,
    context: GraphQLContext
  ): Promise<OrganizationPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Check if organization exists
    const existingOrg = await context.prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      return createErrorPayload('NOT_FOUND', 'Organization not found');
    }

    // Check modification permission
    const canModify = await canModifyOrganization(context, id);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to modify this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    try {
      if (input.name) {
        validateOrganizationName(input.name);
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
    const updateData: Prisma.organizationUpdateInput = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.avatarUrl !== undefined) {
      updateData.avatarUrl = input.avatarUrl;
    }
    if (input.settings !== undefined && input.settings !== null) {
      updateData.settings = input.settings as Prisma.InputJsonValue;
    }

    const org = await context.prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return createSuccessPayload(toOrganization(org));
  },

  /**
   * Delete an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with organization ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteOrganization(id: "org_123") {
   *     success
   *     deletedId
   *     errors { code message }
   *   }
   * }
   * ```
   */
  deleteOrganization: async (
    _parent: unknown,
    args: DeleteOrganizationArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const org = await context.prisma.organization.findUnique({
      where: { id: args.id },
    });

    if (!org) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Organization not found' }],
      };
    }

    // Only owner or system admin can delete organization
    const memberInfo = await getOrganizationMemberInfo(context, args.id);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only organization owner can delete the organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Delete organization (cascades to workspaces, members, etc.)
    await context.prisma.organization.delete({ where: { id: args.id } });

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Add a member to an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with orgId, userId, and role
   * @param context - GraphQL context
   * @returns Member payload with added member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   addOrganizationMember(orgId: "org_123", userId: "user_456", role: MEMBER) {
   *     member {
   *       user { id email }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  addOrganizationMember: async (
    _parent: unknown,
    args: AddOrganizationMemberArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orgId, userId, role } = args;

    // Check if organization exists
    const org = await context.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'Organization not found' }],
      };
    }

    // Check if requester can modify organization
    const canModify = await canModifyOrganization(context, orgId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to add members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if user exists
    const user = await context.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'User not found' }],
      };
    }

    // Check if already a member
    const existingMember = await context.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
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

    // Prevent adding OWNER role - there can only be one owner
    if (role === 'OWNER') {
      return {
        member: null,
        errors: [{ code: 'BAD_USER_INPUT', message: 'Cannot assign OWNER role directly' }],
      };
    }

    // Add member
    const member = await context.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role: role as PrismaOrgRole,
      },
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

  /**
   * Remove a member from an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with orgId and userId
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   removeOrganizationMember(orgId: "org_123", userId: "user_456") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  removeOrganizationMember: async (
    _parent: unknown,
    args: RemoveOrganizationMemberArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orgId, userId } = args;

    // Check if member exists
    const member = await context.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
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
        errors: [{ code: 'FORBIDDEN', message: 'Cannot remove organization owner' }],
      };
    }

    // Check permission - must be admin/owner or removing self
    const memberInfo = await getOrganizationMemberInfo(context, orgId);
    const isSelfRemoval = userId === context.user?.id;
    const canRemove =
      memberInfo.role === 'OWNER' ||
      memberInfo.role === 'ADMIN' ||
      isSystemAdmin(context) ||
      isSelfRemoval;

    if (!canRemove) {
      throw new GraphQLError('You do not have permission to remove this member', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Remove member
    await context.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    return {
      success: true,
      deletedId: member.id,
      errors: [],
    };
  },

  /**
   * Update a member's role in an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with orgId, userId, and new role
   * @param context - GraphQL context
   * @returns Member payload with updated member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateOrganizationMemberRole(orgId: "org_123", userId: "user_456", role: ADMIN) {
   *     member {
   *       user { id }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateOrganizationMemberRole: async (
    _parent: unknown,
    args: UpdateOrganizationMemberRoleArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { orgId, userId, role } = args;

    // Check if member exists
    const existingMember = await context.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
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
    const memberInfo = await getOrganizationMemberInfo(context, orgId);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only organization owner can change member roles', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Prevent assigning OWNER role
    if (role === 'OWNER') {
      return {
        member: null,
        errors: [{ code: 'BAD_USER_INPUT', message: 'Cannot assign OWNER role' }],
      };
    }

    // Update role
    const member = await context.prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      data: { role: role as PrismaOrgRole },
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
// ORGANIZATION FIELD RESOLVERS
// =============================================================================

/**
 * Organization field resolvers for nested types
 */
export const OrganizationFieldResolvers = {
  /**
   * Resolve workspaces for an organization
   *
   * @param parent - The parent Organization object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of workspaces in the organization
   */
  workspaces: async (
    parent: Organization,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.workspace.findMany({
      where: { organizationId: parent.id },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Resolve members for an organization
   *
   * @param parent - The parent Organization object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of organization members
   */
  members: async (
    parent: Organization,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.organizationMember.findMany({
      where: { organizationId: parent.id },
      include: {
        user: {
          select: { id: true, email: true, name: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  },

  /**
   * Resolve member count for an organization
   *
   * @param parent - The parent Organization object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of members in the organization
   */
  memberCount: async (
    parent: Organization,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    return context.prisma.organizationMember.count({
      where: { organizationId: parent.id },
    });
  },

  /**
   * Resolve VPs for an organization
   *
   * @param parent - The parent Organization object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of VPs in the organization
   */
  orchestrators: async (
    parent: Organization,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.orchestrator.findMany({
      where: { organizationId: parent.id },
      orderBy: { createdAt: 'desc' },
    });
  },
};

// =============================================================================
// COMBINED ORGANIZATION RESOLVERS
// =============================================================================

/**
 * Combined organization resolvers object for use with graphql-tools
 */
export const organizationResolvers = {
  Query: organizationQueries,
  Mutation: organizationMutations,
  Organization: OrganizationFieldResolvers,
};

export default organizationResolvers;
