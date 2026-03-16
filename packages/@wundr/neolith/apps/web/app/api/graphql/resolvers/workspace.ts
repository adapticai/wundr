/**
 * Workspace Resolvers
 *
 * GraphQL resolvers for Workspace-related queries and mutations.
 * All resolvers use real Prisma queries against the database.
 *
 * @module api/graphql/resolvers/workspace
 */

import { GraphQLError } from 'graphql';

import { Prisma } from '@neolith/database';

import { isAuthenticated } from '../context';

import type { GraphQLContext } from '../context';

/**
 * Workspace resolver input types
 */
interface CreateWorkspaceInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  organizationId: string;
}

interface UpdateWorkspaceInput {
  name?: string | null;
  description?: string | null;
  logoUrl?: string | null;
}

interface UpdateWorkspaceSettingsInput {
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM' | null;
  emailNotifications?: boolean | null;
  inAppNotifications?: boolean | null;
  timezone?: string | null;
  locale?: string | null;
}

interface WorkspaceQueryArgs {
  id: string;
}

interface WorkspaceBySlugArgs {
  slug: string;
}

interface MyWorkspacesArgs {
  limit?: number | null;
  offset?: number | null;
}

interface UpdateWorkspaceArgs {
  id: string;
  input: UpdateWorkspaceInput;
}

interface UpdateWorkspaceSettingsArgs {
  id: string;
  input: UpdateWorkspaceSettingsInput;
}

interface DeleteWorkspaceArgs {
  id: string;
}

/**
 * Shape of the workspace database record as returned by Prisma includes
 */
interface WorkspaceParent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  settings: Record<string, unknown> | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default workspace settings applied when the settings JSON field is absent
 * or missing individual keys.
 */
const DEFAULT_SETTINGS = {
  theme: 'SYSTEM' as const,
  emailNotifications: true,
  inAppNotifications: true,
  timezone: 'UTC',
  locale: 'en-US',
};

/**
 * Workspace query and mutation resolvers
 */
export const workspaceResolvers = {
  Query: {
    /**
     * Get a workspace by ID
     *
     * Fetches the workspace from the database and verifies that the
     * requesting user is a member before returning.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Query arguments containing workspace ID
     * @param context - GraphQL context
     * @returns The workspace or null if not found / not a member
     * @throws GraphQLError if not authenticated
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
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const workspace = await context.prisma.workspace.findUnique({
        where: { id: args.id },
        include: {
          organization: true,
          _count: { select: { workspaceMembers: true } },
        },
      });

      if (!workspace) {
        return null;
      }

      // Verify the requesting user is a member of this workspace
      const membership = await context.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: args.id,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        return null;
      }

      return workspace;
    },

    /**
     * Get a workspace by its slug
     *
     * Fetches the workspace from the database and verifies that the
     * requesting user is a member before returning.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Query arguments containing workspace slug
     * @param context - GraphQL context
     * @returns The workspace or null if not found / not a member
     * @throws GraphQLError if not authenticated
     *
     * @example
     * ```graphql
     * query {
     *   workspaceBySlug(slug: "my-workspace") {
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
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const workspace = await context.prisma.workspace.findFirst({
        where: { slug: args.slug },
        include: {
          organization: true,
          _count: { select: { workspaceMembers: true } },
        },
      });

      if (!workspace) {
        return null;
      }

      // Verify the requesting user is a member of this workspace
      const membership = await context.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        return null;
      }

      return workspace;
    },

    /**
     * Get all workspaces the current user has access to
     *
     * Returns workspaces the authenticated user is a member of,
     * ordered by workspace creation date descending.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Query arguments with pagination options
     * @param context - GraphQL context
     * @returns Array of workspaces
     * @throws GraphQLError if not authenticated
     *
     * @example
     * ```graphql
     * query {
     *   myWorkspaces(limit: 10) {
     *     id
     *     name
     *   }
     * }
     * ```
     */
    myWorkspaces: async (
      _parent: unknown,
      args: MyWorkspacesArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const offset = Math.max(args.offset ?? 0, 0);

      const memberships = await context.prisma.workspaceMember.findMany({
        where: { userId: context.user.id },
        include: {
          workspace: {
            include: {
              organization: true,
              _count: { select: { workspaceMembers: true } },
            },
          },
        },
        take: limit,
        skip: offset,
      });

      return memberships.map(m => m.workspace);
    },
  },

  Mutation: {
    /**
     * Create a new workspace
     *
     * Validates the name, generates a slug from the name if not provided,
     * then uses a transaction to: create the workspace, add the creator as
     * OWNER, create a #general channel, and add the creator to that channel.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Mutation arguments with workspace input
     * @param context - GraphQL context
     * @returns The created workspace with includes
     * @throws GraphQLError if not authenticated or input is invalid
     *
     * @example
     * ```graphql
     * mutation {
     *   createWorkspace(input: { name: "My Workspace" }) {
     *     id
     *     name
     *     slug
     *   }
     * }
     * ```
     */
    createWorkspace: async (
      _parent: unknown,
      args: { input: CreateWorkspaceInput },
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { input } = args;

      if (!input.name || input.name.trim().length === 0) {
        throw new GraphQLError('Workspace name is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const slug =
        input.slug ??
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      const workspace = await context.prisma.$transaction(async tx => {
        const newWorkspace = await tx.workspace.create({
          data: {
            name: input.name,
            slug,
            description: input.description ?? null,
            avatarUrl: input.logoUrl ?? null,
            organizationId: input.organizationId,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: context.user.id,
            role: 'OWNER',
          },
        });

        const generalChannel = await tx.channel.create({
          data: {
            name: 'general',
            slug: 'general',
            type: 'PUBLIC',
            description: 'General discussion for the workspace',
            workspaceId: newWorkspace.id,
          },
        });

        await tx.channelMember.create({
          data: {
            channelId: generalChannel.id,
            userId: context.user.id,
            role: 'ADMIN',
          },
        });

        return tx.workspace.findUnique({
          where: { id: newWorkspace.id },
          include: {
            organization: true,
            _count: { select: { workspaceMembers: true } },
          },
        });
      });

      return workspace;
    },

    /**
     * Update workspace details
     *
     * Requires ADMIN or OWNER membership in the workspace.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Mutation arguments with workspace ID and update input
     * @param context - GraphQL context
     * @returns The updated workspace
     * @throws GraphQLError if not authenticated, not found, or insufficient role
     *
     * @example
     * ```graphql
     * mutation {
     *   updateWorkspace(id: "ws_123", input: { name: "New Name" }) {
     *     id
     *     name
     *   }
     * }
     * ```
     */
    updateWorkspace: async (
      _parent: unknown,
      args: UpdateWorkspaceArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const membership = await context.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: args.id,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        throw new GraphQLError('Workspace not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new GraphQLError(
          'Insufficient permissions. Admin or Owner role required.',
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const updateData: {
        name?: string;
        description?: string | null;
        avatarUrl?: string | null;
      } = {};

      if (args.input.name != null) {
        updateData.name = args.input.name;
      }

      if (args.input.description !== undefined) {
        updateData.description = args.input.description;
      }

      if (args.input.logoUrl !== undefined) {
        updateData.avatarUrl = args.input.logoUrl;
      }

      return context.prisma.workspace.update({
        where: { id: args.id },
        data: updateData,
        include: {
          organization: true,
          _count: { select: { workspaceMembers: true } },
        },
      });
    },

    /**
     * Update workspace settings
     *
     * Reads the existing settings JSON, merges with the provided input,
     * and persists the result. Requires ADMIN or OWNER membership.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Mutation arguments with workspace ID and settings input
     * @param context - GraphQL context
     * @returns The workspace with updated settings
     * @throws GraphQLError if not authenticated, not found, or insufficient role
     *
     * @example
     * ```graphql
     * mutation {
     *   updateWorkspaceSettings(
     *     id: "ws_123",
     *     input: { theme: DARK }
     *   ) {
     *     id
     *     settings {
     *       theme
     *     }
     *   }
     * }
     * ```
     */
    updateWorkspaceSettings: async (
      _parent: unknown,
      args: UpdateWorkspaceSettingsArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const membership = await context.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: args.id,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        throw new GraphQLError('Workspace not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new GraphQLError(
          'Insufficient permissions. Admin or Owner role required.',
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const existing = await context.prisma.workspace.findUnique({
        where: { id: args.id },
        select: { settings: true },
      });

      const existingSettings =
        (existing?.settings as Record<string, unknown> | null) ?? {};

      const { input } = args;

      const mergedSettings: Record<string, unknown> = {
        ...DEFAULT_SETTINGS,
        ...existingSettings,
        ...(input.theme != null && { theme: input.theme }),
        ...(input.emailNotifications != null && {
          emailNotifications: input.emailNotifications,
        }),
        ...(input.inAppNotifications != null && {
          inAppNotifications: input.inAppNotifications,
        }),
        ...(input.timezone != null && { timezone: input.timezone }),
        ...(input.locale != null && { locale: input.locale }),
      };

      return context.prisma.workspace.update({
        where: { id: args.id },
        data: { settings: mergedSettings as Prisma.InputJsonValue },
        include: {
          organization: true,
          _count: { select: { workspaceMembers: true } },
        },
      });
    },

    /**
     * Delete a workspace
     *
     * Requires OWNER membership in the workspace.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Mutation arguments with workspace ID
     * @returns True if deletion was successful
     * @throws GraphQLError if not authenticated, not found, or insufficient role
     *
     * @example
     * ```graphql
     * mutation {
     *   deleteWorkspace(id: "ws_123")
     * }
     * ```
     */
    deleteWorkspace: async (
      _parent: unknown,
      args: DeleteWorkspaceArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const membership = await context.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: args.id,
            userId: context.user.id,
          },
        },
      });

      if (!membership) {
        throw new GraphQLError('Workspace not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (membership.role !== 'OWNER') {
        throw new GraphQLError(
          'Insufficient permissions. Owner role required to delete a workspace.',
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      await context.prisma.workspace.delete({ where: { id: args.id } });

      return true;
    },
  },

  /**
   * Workspace field resolvers
   */
  Workspace: {
    /**
     * Resolve owner field
     *
     * Finds the OWNER member record for this workspace and returns the
     * associated user.
     */
    owner: async (
      parent: WorkspaceParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      const ownerMembership = await context.prisma.workspaceMember.findFirst({
        where: { workspaceId: parent.id, role: 'OWNER' },
        include: { user: true },
      });

      return ownerMembership?.user ?? null;
    },

    /**
     * Resolve settings field
     *
     * Parses the settings JSON stored on the workspace row and fills in
     * any missing keys with their default values.
     */
    settings: (parent: WorkspaceParent) => {
      const stored = (parent.settings as Record<string, unknown> | null) ?? {};

      return {
        theme:
          (stored.theme as 'LIGHT' | 'DARK' | 'SYSTEM') ??
          DEFAULT_SETTINGS.theme,
        emailNotifications:
          typeof stored.emailNotifications === 'boolean'
            ? stored.emailNotifications
            : DEFAULT_SETTINGS.emailNotifications,
        inAppNotifications:
          typeof stored.inAppNotifications === 'boolean'
            ? stored.inAppNotifications
            : DEFAULT_SETTINGS.inAppNotifications,
        timezone:
          typeof stored.timezone === 'string'
            ? stored.timezone
            : DEFAULT_SETTINGS.timezone,
        locale:
          typeof stored.locale === 'string'
            ? stored.locale
            : DEFAULT_SETTINGS.locale,
      };
    },

    /**
     * Resolve memberCount field
     *
     * Counts the number of workspace members in the database.
     */
    memberCount: async (
      parent: WorkspaceParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.prisma.workspaceMember.count({
        where: { workspaceId: parent.id },
      });
    },
  },
};
