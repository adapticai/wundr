/**
 * User Resolvers
 *
 * GraphQL resolvers for User-related queries and mutations.
 * Handles user retrieval, profile updates, and user listing.
 *
 * @module api/graphql/resolvers/user
 */

import { GraphQLError } from 'graphql';

import { isAuthenticated, isAdmin } from '../context';

import type { GraphQLContext, ContextUser } from '../context';

/**
 * User resolver input types
 */
interface UpdateUserInput {
  name?: string | null;
  avatarUrl?: string | null;
}

interface UsersQueryArgs {
  limit?: number | null;
  offset?: number | null;
}

interface UserQueryArgs {
  id: string;
}

interface UpdateProfileArgs {
  input: UpdateUserInput;
}

/**
 * User query and mutation resolvers
 */
export const userResolvers = {
  Query: {
    /**
     * Get the currently authenticated user
     *
     * @param _parent - Parent resolver result (unused)
     * @param _args - Query arguments (unused)
     * @param context - GraphQL context with user and prisma
     * @returns The authenticated user or null
     *
     * @example
     * ```graphql
     * query {
     *   me {
     *     id
     *     email
     *     name
     *   }
     * }
     * ```
     */
    me: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ): Promise<ContextUser | null> => {
      if (!isAuthenticated(context)) {
        return null;
      }

      // Fetch fresh user data from database
      const user = await context.prisma.user.findUnique({
        where: { id: context.user.id },
      });

      if (!user) {
        return null;
      }

      // Map to ContextUser type - role is from context, not database
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: context.user.role,
      };
    },

    /**
     * Get a user by their ID
     *
     * Requires authentication. Returns the user if found.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Query arguments containing user ID
     * @param context - GraphQL context
     * @returns The user or null if not found
     * @throws GraphQLError if not authenticated
     *
     * @example
     * ```graphql
     * query {
     *   user(id: "user_123") {
     *     id
     *     email
     *     name
     *   }
     * }
     * ```
     */
    user: async (
      _parent: unknown,
      args: UserQueryArgs,
      context: GraphQLContext,
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const user = await context.prisma.user.findUnique({
        where: { id: args.id },
      });

      return user;
    },

    /**
     * Get all users with pagination
     *
     * Requires admin role. Returns a list of users.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Query arguments with pagination options
     * @param context - GraphQL context
     * @returns Array of users
     * @throws GraphQLError if not authenticated or not admin
     *
     * @example
     * ```graphql
     * query {
     *   users(limit: 10, offset: 0) {
     *     id
     *     email
     *     name
     *   }
     * }
     * ```
     */
    users: async (
      _parent: unknown,
      args: UsersQueryArgs,
      context: GraphQLContext,
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!isAdmin(context)) {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
      const offset = Math.max(args.offset ?? 0, 0);

      const users = await context.prisma.user.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return users;
    },
  },

  Mutation: {
    /**
     * Update the current user's profile
     *
     * Requires authentication. Updates allowed fields on the user profile.
     *
     * @param _parent - Parent resolver result (unused)
     * @param args - Mutation arguments with update input
     * @param context - GraphQL context
     * @returns The updated user
     * @throws GraphQLError if not authenticated
     *
     * @example
     * ```graphql
     * mutation {
     *   updateProfile(input: { name: "New Name" }) {
     *     id
     *     name
     *   }
     * }
     * ```
     */
    updateProfile: async (
      _parent: unknown,
      args: UpdateProfileArgs,
      context: GraphQLContext,
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { input } = args;

      // Build update data, only including provided fields
      const updateData: { name?: string; avatarUrl?: string | null } = {};

      if (input.name !== undefined) {
        updateData.name = input.name ?? undefined;
      }

      if (input.avatarUrl !== undefined) {
        updateData.avatarUrl = input.avatarUrl;
      }

      const updatedUser = await context.prisma.user.update({
        where: { id: context.user.id },
        data: updateData,
      });

      return updatedUser;
    },
  },

  /**
   * User field resolvers
   *
   * These resolve specific fields on the User type that may
   * require additional computation or formatting.
   */
  User: {
    /**
     * Resolve avatarUrl field
     * Maps from database column name if different
     */
    avatarUrl: (parent: {
      avatarUrl?: string | null;
      avatar_url?: string | null;
    }) => {
      return parent.avatarUrl ?? parent.avatar_url ?? null;
    },
  },
};
