/**
 * Workspace GraphQL Resolvers
 *
 * Comprehensive resolvers for Workspace operations including queries, mutations,
 * and field resolvers. Implements authorization checks (workspace membership/role),
 * input validation, cursor-based pagination, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/workspace-resolvers
 */

import { GraphQLError } from 'graphql';

import type { PrismaClient } from '@prisma/client';

// Define Prisma model types directly since client generation has issues
type PrismaWorkspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: string;
  settings: any;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};
type PrismaWorkspaceRole = string; // 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'
type PrismaWorkspaceVisibility = string; // 'PUBLIC' | 'PRIVATE' | 'INTERNAL'

// Define Prisma input types
type WorkspaceWhereInput = {
  id?: string | { lt?: string };
  organizationId?: string;
  slug?: string;
  OR?: WorkspaceWhereInput[];
  AND?: WorkspaceWhereInput | WorkspaceWhereInput[];
  workspaceMembers?: { some: { userId: string } };
  visibility?: { in: string[] };
  createdAt?: { lt?: Date; gt?: Date } | Date;
};

type WorkspaceMemberWhereInput = {
  workspaceId?: string;
  userId?: string;
  id?: { lt?: string };
  joinedAt?: { lt?: Date } | Date;
  OR?: WorkspaceMemberWhereInput[];
};

type WorkspaceUpdateInput = {
  name?: string;
  description?: string | null;
  avatarUrl?: string | null;
  visibility?: string;
  settings?: any;
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Workspace role enum matching the Prisma schema
 */
export const WorkspaceRole = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Member: 'MEMBER',
  Guest: 'GUEST',
} as const;

export type WorkspaceRoleType =
  (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

/**
 * Workspace visibility enum matching the Prisma schema
 */
export const WorkspaceVisibility = {
  Public: 'PUBLIC',
  Private: 'PRIVATE',
  Internal: 'INTERNAL',
} as const;

export type WorkspaceVisibilityType =
  (typeof WorkspaceVisibility)[keyof typeof WorkspaceVisibility];

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
 * Workspace entity type for resolvers
 */
interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: PrismaWorkspaceVisibility;
  settings: unknown;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workspace member info
 */
interface WorkspaceMemberInfo {
  isMember: boolean;
  role: PrismaWorkspaceRole | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new workspace
 */
interface CreateWorkspaceInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  visibility?: WorkspaceVisibilityType | null;
  organizationId: string;
}

/**
 * Input for updating an existing workspace
 */
interface UpdateWorkspaceInput {
  name?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  visibility?: WorkspaceVisibilityType | null;
  settings?: Record<string, unknown> | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface WorkspaceQueryArgs {
  id: string;
}

interface WorkspaceBySlugArgs {
  organizationId: string;
  slug: string;
}

interface WorkspacesArgs {
  organizationId: string;
  first?: number | null;
  after?: string | null;
}

interface WorkspaceMembersArgs {
  workspaceId: string;
  first?: number | null;
  after?: string | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateWorkspaceArgs {
  input: CreateWorkspaceInput;
}

interface UpdateWorkspaceArgs {
  id: string;
  input: UpdateWorkspaceInput;
}

interface ArchiveWorkspaceArgs {
  id: string;
}

interface AddWorkspaceMemberArgs {
  workspaceId: string;
  userId: string;
  role: WorkspaceRoleType;
}

interface RemoveWorkspaceMemberArgs {
  workspaceId: string;
  userId: string;
}

interface UpdateWorkspaceMemberRoleArgs {
  workspaceId: string;
  userId: string;
  role: WorkspaceRoleType;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface WorkspacePayload {
  workspace: Workspace | null;
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
    role: PrismaWorkspaceRole;
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
 * Check if user is a member of a workspace and get their role
 *
 * @param context - The GraphQL context
 * @param workspaceId - The workspace ID to check
 * @returns Workspace member info
 */
async function getWorkspaceMemberInfo(
  context: GraphQLContext,
  workspaceId: string
): Promise<WorkspaceMemberInfo> {
  if (!isAuthenticated(context)) {
    return { isMember: false, role: null };
  }

  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    // System admins can access any workspace
    if (isSystemAdmin(context)) {
      return { isMember: true, role: 'ADMIN' };
    }
    return { isMember: false, role: null };
  }

  return { isMember: true, role: membership.role };
}

/**
 * Check if user can modify a workspace (is workspace admin/owner or system admin)
 *
 * @param context - The GraphQL context
 * @param workspaceId - The workspace ID to check
 * @returns True if user can modify the workspace
 */
async function canModifyWorkspace(
  context: GraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (isSystemAdmin(context)) {
    return true;
  }

  const memberInfo = await getWorkspaceMemberInfo(context, workspaceId);
  return memberInfo.role === 'OWNER' || memberInfo.role === 'ADMIN';
}

/**
 * Validate workspace name
 *
 * @param name - The name to validate
 * @throws GraphQLError if name is invalid
 */
function validateWorkspaceName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new GraphQLError('Workspace name is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
  if (name.length > 255) {
    throw new GraphQLError('Workspace name must be 255 characters or less', {
      extensions: { code: 'BAD_USER_INPUT', field: 'name' },
    });
  }
}

/**
 * Validate workspace slug
 *
 * @param slug - The slug to validate
 * @throws GraphQLError if slug is invalid
 */
function validateSlug(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new GraphQLError('Workspace slug is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'slug' },
    });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new GraphQLError(
      'Workspace slug must contain only lowercase letters, numbers, and hyphens',
      { extensions: { code: 'BAD_USER_INPUT', field: 'slug' } }
    );
  }
  if (slug.length > 100) {
    throw new GraphQLError('Workspace slug must be 100 characters or less', {
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
function createSuccessPayload(workspace: Workspace): WorkspacePayload {
  return { workspace, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): WorkspacePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { workspace: null, errors };
}

/**
 * Convert Prisma workspace to resolver workspace type
 */
function toWorkspace(prismaWs: PrismaWorkspace): Workspace {
  return {
    id: prismaWs.id,
    name: prismaWs.name,
    slug: prismaWs.slug,
    description: prismaWs.description,
    avatarUrl: prismaWs.avatarUrl,
    visibility: prismaWs.visibility,
    settings: prismaWs.settings,
    organizationId: prismaWs.organizationId,
    createdAt: prismaWs.createdAt,
    updatedAt: prismaWs.updatedAt,
  };
}

// =============================================================================
// WORKSPACE QUERY RESOLVERS
// =============================================================================

/**
 * Workspace Query resolvers
 */
export const workspaceQueries = {
  /**
   * Get a workspace by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing workspace ID
   * @param context - GraphQL context
   * @returns The workspace or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   workspace(id: "ws_123") {
   *     id
   *     name
   *     slug
   *   }
   * }
   * ```
   */
  workspace: async (
    _parent: unknown,
    args: WorkspaceQueryArgs,
    context: GraphQLContext
  ): Promise<Workspace | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const ws = await context.prisma.workspace.findUnique({
      where: { id: args.id },
    });

    if (!ws) {
      return null;
    }

    // Check access - user must be a workspace member or system admin
    const memberInfo = await getWorkspaceMemberInfo(context, ws.id);
    if (!memberInfo.isMember) {
      // For public/internal workspaces, check org membership
      if (ws.visibility === 'PUBLIC' || ws.visibility === 'INTERNAL') {
        const isOrgMember = await isOrganizationMember(
          context,
          ws.organizationId
        );
        if (!isOrgMember) {
          throw new GraphQLError('Access denied to this workspace', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      } else {
        throw new GraphQLError('Access denied to this workspace', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    return toWorkspace(ws);
  },

  /**
   * Get a workspace by its slug within an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing organizationId and workspace slug
   * @param context - GraphQL context
   * @returns The workspace or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   workspaceBySlug(organizationId: "org_123", slug: "engineering") {
   *     id
   *     name
   *   }
   * }
   * ```
   */
  workspaceBySlug: async (
    _parent: unknown,
    args: WorkspaceBySlugArgs,
    context: GraphQLContext
  ): Promise<Workspace | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const ws = await context.prisma.workspace.findUnique({
      where: {
        organizationId_slug: {
          organizationId: args.organizationId,
          slug: args.slug,
        },
      },
    });

    if (!ws) {
      return null;
    }

    // Check access
    const memberInfo = await getWorkspaceMemberInfo(context, ws.id);
    if (!memberInfo.isMember && ws.visibility === 'PRIVATE') {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return toWorkspace(ws);
  },

  /**
   * List workspaces in an organization
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with organizationId and pagination
   * @param context - GraphQL context
   * @returns Paginated list of workspaces
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   workspaces(organizationId: "org_123") {
   *     edges {
   *       node {
   *         id
   *         name
   *         slug
   *       }
   *     }
   *     totalCount
   *   }
   * }
   * ```
   */
  workspaces: async (
    _parent: unknown,
    args: WorkspacesArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { organizationId } = args;
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);

    // Check organization membership
    const isOrgMember = await isOrganizationMember(context, organizationId);
    if (!isOrgMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause - for non-admin users, filter by visibility
    const where: WorkspaceWhereInput = {
      organizationId,
    };

    // If not system admin, include user's workspace memberships or public/internal workspaces
    if (!isSystemAdmin(context)) {
      where.OR = [
        { workspaceMembers: { some: { userId: context.user.id } } },
        { visibility: { in: ['PUBLIC', 'INTERNAL'] } },
      ];
    }

    // Handle cursor pagination
    if (args.after) {
      const parsed = parseCursor(args.after);
      if (parsed) {
        const existingAnd = where.AND;
        const cursorCondition: WorkspaceWhereInput = {
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

    const workspaces = await context.prisma.workspace.findMany({
      where: where as any,
      take: first + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const totalCount = await context.prisma.workspace.count({
      where: { organizationId },
    });

    const hasNextPage = workspaces.length > first;
    const nodes = hasNextPage ? workspaces.slice(0, -1) : workspaces;

    const edges = nodes.map((ws: PrismaWorkspace) => {
      const wsData = toWorkspace(ws);
      return {
        node: wsData,
        cursor: generateCursor({ createdAt: ws.createdAt, id: ws.id }),
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
   * List members of a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with workspaceId and pagination
   * @param context - GraphQL context
   * @returns Paginated list of workspace members
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   workspaceMembers(workspaceId: "ws_123") {
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
  workspaceMembers: async (
    _parent: unknown,
    args: WorkspaceMembersArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId } = args;
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);

    // Check workspace access
    const memberInfo = await getWorkspaceMemberInfo(context, workspaceId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: WorkspaceMemberWhereInput = {
      workspaceId,
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

    const members = await context.prisma.workspaceMember.findMany({
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

    const totalCount = await context.prisma.workspaceMember.count({
      where: { workspaceId },
    });

    const hasNextPage = members.length > first;
    const nodes = hasNextPage ? members.slice(0, -1) : members;

    const edges = nodes.map((member: (typeof nodes)[number]) => ({
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
// WORKSPACE MUTATION RESOLVERS
// =============================================================================

/**
 * Workspace Mutation resolvers
 */
export const workspaceMutations = {
  /**
   * Create a new workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspace input
   * @param context - GraphQL context
   * @returns Workspace payload with created workspace or errors
   * @throws GraphQLError if not authenticated or validation fails
   *
   * @example
   * ```graphql
   * mutation {
   *   createWorkspace(input: {
   *     name: "Engineering",
   *     organizationId: "org_123"
   *   }) {
   *     workspace {
   *       id
   *       name
   *       slug
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  createWorkspace: async (
    _parent: unknown,
    args: CreateWorkspaceArgs,
    context: GraphQLContext
  ): Promise<WorkspacePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Check organization membership
    const isOrgMember = await isOrganizationMember(
      context,
      input.organizationId
    );
    if (!isOrgMember) {
      throw new GraphQLError('Access denied to this organization', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    try {
      validateWorkspaceName(input.name);
      const slug = input.slug ?? generateSlug(input.name);
      validateSlug(slug);

      // Check if slug is already taken in this organization
      const existingWs = await context.prisma.workspace.findUnique({
        where: {
          organizationId_slug: {
            organizationId: input.organizationId,
            slug,
          },
        },
      });

      if (existingWs) {
        return createErrorPayload(
          'CONFLICT',
          'A workspace with this slug already exists in this organization'
        );
      }

      // Create workspace and add creator as owner
      const ws = await context.prisma.workspace.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          avatarUrl: input.avatarUrl ?? null,
          visibility: (input.visibility as any) ?? 'PRIVATE',
          settings: {},
          organizationId: input.organizationId,
          workspaceMembers: {
            create: {
              userId: context.user.id,
              role: 'OWNER' as any,
            },
          },
        },
      });

      return createSuccessPayload(toWorkspace(ws));
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
   * Update an existing workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspace ID and update input
   * @param context - GraphQL context
   * @returns Workspace payload with updated workspace or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateWorkspace(id: "ws_123", input: { name: "New Name" }) {
   *     workspace {
   *       id
   *       name
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateWorkspace: async (
    _parent: unknown,
    args: UpdateWorkspaceArgs,
    context: GraphQLContext
  ): Promise<WorkspacePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Check if workspace exists
    const existingWs = await context.prisma.workspace.findUnique({
      where: { id },
    });

    if (!existingWs) {
      return createErrorPayload('NOT_FOUND', 'Workspace not found');
    }

    // Check modification permission
    const canModify = await canModifyWorkspace(context, id);
    if (!canModify) {
      throw new GraphQLError(
        'You do not have permission to modify this workspace',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Validate input
    try {
      if (input.name) {
        validateWorkspaceName(input.name);
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
    const updateData: WorkspaceUpdateInput = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.avatarUrl !== undefined) {
      updateData.avatarUrl = input.avatarUrl;
    }
    if (input.visibility !== undefined && input.visibility !== null) {
      updateData.visibility = input.visibility as PrismaWorkspaceVisibility;
    }
    if (input.settings !== undefined && input.settings !== null) {
      updateData.settings = input.settings;
    }

    const ws = await context.prisma.workspace.update({
      where: { id },
      data: updateData as any,
    });

    return createSuccessPayload(toWorkspace(ws));
  },

  /**
   * Archive a workspace (soft delete)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspace ID
   * @param context - GraphQL context
   * @returns Workspace payload with archived workspace
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   archiveWorkspace(id: "ws_123") {
   *     workspace {
   *       id
   *       settings
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  archiveWorkspace: async (
    _parent: unknown,
    args: ArchiveWorkspaceArgs,
    context: GraphQLContext
  ): Promise<WorkspacePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const ws = await context.prisma.workspace.findUnique({
      where: { id: args.id },
    });

    if (!ws) {
      return createErrorPayload('NOT_FOUND', 'Workspace not found');
    }

    // Only owner or system admin can archive workspace
    const memberInfo = await getWorkspaceMemberInfo(context, args.id);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only workspace owner can archive the workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Archive by setting isArchived in settings
    const existingSettings = (ws.settings as Record<string, unknown>) ?? {};
    const updatedWs = await context.prisma.workspace.update({
      where: { id: args.id },
      data: {
        settings: {
          ...existingSettings,
          isArchived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: context.user.id,
        },
      },
    });

    return createSuccessPayload(toWorkspace(updatedWs));
  },

  /**
   * Add a member to a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspaceId, userId, and role
   * @param context - GraphQL context
   * @returns Member payload with added member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   addWorkspaceMember(workspaceId: "ws_123", userId: "user_456", role: MEMBER) {
   *     member {
   *       user { id email }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  addWorkspaceMember: async (
    _parent: unknown,
    args: AddWorkspaceMemberArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, userId, role } = args;

    // Check if workspace exists
    const ws = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'Workspace not found' }],
      };
    }

    // Check if requester can modify workspace
    const canModify = await canModifyWorkspace(context, workspaceId);
    if (!canModify) {
      throw new GraphQLError('You do not have permission to add members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if user exists and is in the organization
    const user = await context.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        member: null,
        errors: [{ code: 'NOT_FOUND', message: 'User not found' }],
      };
    }

    // Check if user is in the same organization
    const orgMembership = await context.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: ws.organizationId,
          userId,
        },
      },
    });

    if (!orgMembership) {
      return {
        member: null,
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'User must be a member of the organization',
          },
        ],
      };
    }

    // Check if already a member
    const existingMember = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
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
    const member = await context.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: role as any,
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
        role: member.role as PrismaWorkspaceRole,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      errors: [],
    };
  },

  /**
   * Remove a member from a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspaceId and userId
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   removeWorkspaceMember(workspaceId: "ws_123", userId: "user_456") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  removeWorkspaceMember: async (
    _parent: unknown,
    args: RemoveWorkspaceMemberArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, userId } = args;

    // Check if member exists
    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
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
        errors: [
          { code: 'FORBIDDEN', message: 'Cannot remove workspace owner' },
        ],
      };
    }

    // Check permission - must be admin/owner or removing self
    const memberInfo = await getWorkspaceMemberInfo(context, workspaceId);
    const isSelfRemoval = userId === context.user?.id;
    const canRemove =
      memberInfo.role === 'OWNER' ||
      memberInfo.role === 'ADMIN' ||
      isSystemAdmin(context) ||
      isSelfRemoval;

    if (!canRemove) {
      throw new GraphQLError(
        'You do not have permission to remove this member',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Remove member
    await context.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
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
   * Update a member's role in a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with workspaceId, userId, and new role
   * @param context - GraphQL context
   * @returns Member payload with updated member or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   updateWorkspaceMemberRole(workspaceId: "ws_123", userId: "user_456", role: ADMIN) {
   *     member {
   *       user { id }
   *       role
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  updateWorkspaceMemberRole: async (
    _parent: unknown,
    args: UpdateWorkspaceMemberRoleArgs,
    context: GraphQLContext
  ): Promise<MemberPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, userId, role } = args;

    // Check if member exists
    const existingMember = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
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
    const memberInfo = await getWorkspaceMemberInfo(context, workspaceId);
    if (memberInfo.role !== 'OWNER' && !isSystemAdmin(context)) {
      throw new GraphQLError('Only workspace owner can change member roles', {
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
    const member = await context.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role: role as any },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return {
      member: {
        id: member.id,
        role: member.role as PrismaWorkspaceRole,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      errors: [],
    };
  },
};

// =============================================================================
// WORKSPACE FIELD RESOLVERS
// =============================================================================

/**
 * Workspace field resolvers for nested types
 */
export const WorkspaceFieldResolvers = {
  /**
   * Resolve organization for a workspace
   *
   * @param parent - The parent Workspace object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The organization
   */
  organization: async (
    parent: Workspace,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.organization.findUnique({
      where: { id: parent.organizationId },
    });
  },

  /**
   * Resolve channels for a workspace
   *
   * @param parent - The parent Workspace object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of channels in the workspace
   */
  channels: async (
    parent: Workspace,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.channel.findMany({
      where: {
        workspaceId: parent.id,
        isArchived: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Resolve members for a workspace
   *
   * @param parent - The parent Workspace object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of workspace members
   */
  members: async (
    parent: Workspace,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.workspaceMember.findMany({
      where: { workspaceId: parent.id },
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
   * Resolve member count for a workspace
   *
   * @param parent - The parent Workspace object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of members in the workspace
   */
  memberCount: async (
    parent: Workspace,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    return context.prisma.workspaceMember.count({
      where: { workspaceId: parent.id },
    });
  },

  /**
   * Check if workspace is archived
   *
   * @param parent - The parent Workspace object
   * @returns True if workspace is archived
   */
  isArchived: (parent: Workspace): boolean => {
    const settings = parent.settings as Record<string, unknown> | null;
    return settings?.isArchived === true;
  },
};

// =============================================================================
// COMBINED WORKSPACE RESOLVERS
// =============================================================================

/**
 * Combined workspace resolvers object for use with graphql-tools
 */
export const workspaceResolvers = {
  Query: workspaceQueries,
  Mutation: workspaceMutations,
  Workspace: WorkspaceFieldResolvers,
};

export default workspaceResolvers;
