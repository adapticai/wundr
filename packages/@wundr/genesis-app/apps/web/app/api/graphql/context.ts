/**
 * GraphQL Context Module
 *
 * Provides context creation and type definitions for the GraphQL API.
 * The context is created for each request and contains shared resources
 * like the Prisma client and authenticated user information.
 *
 * @module api/graphql/context
 */

import { prisma } from '@genesis/database';

import type { PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Authenticated user information available in GraphQL context
 */
export interface ContextUser {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string | null;
  /** User's role in the system */
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

/**
 * GraphQL context type available to all resolvers
 *
 * @property prisma - Prisma client instance for database operations
 * @property user - Authenticated user information (null if unauthenticated)
 * @property requestId - Unique identifier for request tracing
 */
export interface GraphQLContext {
  /** Prisma client for database access */
  prisma: PrismaClient;
  /** Authenticated user or null if not authenticated */
  user: ContextUser | null;
  /** Unique request identifier for tracing and logging */
  requestId: string;
}

/**
 * Options for creating the GraphQL context
 */
export interface CreateContextOptions {
  /** The incoming Next.js request */
  req: NextRequest;
}

/**
 * Generates a unique request ID for tracing
 *
 * @returns A unique request identifier string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extracts user information from the request
 *
 * This function handles authentication by extracting user information
 * from the request headers or session. In Phase 0, this returns null
 * as authentication is not yet implemented.
 *
 * @param req - The incoming Next.js request
 * @returns The authenticated user or null
 */
async function extractUser(req: NextRequest): Promise<ContextUser | null> {
  // Phase 0: Authentication stub
  // In Phase 1, this will integrate with NextAuth.js to extract
  // the authenticated user from the session
  //
  // Example future implementation:
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.id) return null;
  // return {
  //   id: session.user.id,
  //   email: session.user.email!,
  //   name: session.user.name ?? null,
  //   role: session.user.role ?? "MEMBER",
  // };

  // Check for development bypass header
  const devUserId = req.headers.get('x-dev-user-id');
  if (process.env.NODE_ENV === 'development' && devUserId) {
    // In development, allow bypassing auth for testing
    return {
      id: devUserId,
      email: 'dev@genesis.local',
      name: 'Development User',
      role: 'ADMIN',
    };
  }

  return null;
}

/**
 * Creates the GraphQL context for each request
 *
 * This factory function is called by Apollo Server for each incoming
 * GraphQL request. It provides access to the Prisma client and
 * authenticated user information.
 *
 * @param options - Context creation options containing the request
 * @returns The GraphQL context object
 *
 * @example
 * ```typescript
 * // In Apollo Server setup
 * const server = new ApolloServer({
 *   typeDefs,
 *   resolvers,
 * });
 *
 * // In route handler
 * const context = await createContext({ req: request });
 * ```
 */
export async function createContext(
  options: CreateContextOptions
): Promise<GraphQLContext> {
  const { req } = options;

  const [user, requestId] = await Promise.all([
    extractUser(req),
    Promise.resolve(generateRequestId()),
  ]);

  return {
    prisma,
    user,
    requestId,
  };
}

/**
 * Type guard to check if user is authenticated
 *
 * @param context - The GraphQL context
 * @returns True if the user is authenticated
 *
 * @example
 * ```typescript
 * const resolvers = {
 *   Query: {
 *     me: (_, __, context) => {
 *       if (!isAuthenticated(context)) {
 *         throw new GraphQLError("Not authenticated");
 *       }
 *       return context.user;
 *     },
 *   },
 * };
 * ```
 */
export function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Type guard to check if user has admin role
 *
 * @param context - The GraphQL context
 * @returns True if the user is an authenticated admin
 */
export function isAdmin(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null && context.user.role === 'ADMIN';
}
