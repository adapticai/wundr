/**
 * GraphQL API Route Handler
 *
 * Next.js App Router API route that serves the GraphQL endpoint.
 * Uses Apollo Server 4 with the standalone server integration
 * adapted for Next.js edge/serverless runtime.
 *
 * @module api/graphql/route
 */

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';

import { createContext } from './context';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';

import type { GraphQLContext } from './context';
import type { IResolvers } from '@graphql-tools/utils';
import type { NextRequest } from 'next/server';

/**
 * Apollo Server instance
 *
 * Configured with type definitions and resolvers for the Genesis API.
 * Uses introspection in development for GraphQL Playground support.
 */
const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers: resolvers as IResolvers<unknown, GraphQLContext>,
  introspection: process.env.NODE_ENV !== 'production',
  formatError: (formattedError, _error) => {
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[GraphQL Error]', {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
      });
    }

    // In production, hide internal error details
    if (
      process.env.NODE_ENV === 'production' &&
      formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR'
    ) {
      return {
        ...formattedError,
        message: 'An internal error occurred',
      };
    }

    return formattedError;
  },
});

/**
 * Next.js handler created from Apollo Server
 *
 * This handler processes incoming GraphQL requests and routes them
 * through Apollo Server with the appropriate context.
 */
const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(
  server,
  {
    context: async req => createContext({ req }),
  }
);

/**
 * GET handler for GraphQL requests
 *
 * Handles GraphQL queries sent via GET request (for caching).
 * Also serves the Apollo Sandbox in development.
 *
 * @param request - The incoming Next.js request
 * @returns The GraphQL response
 *
 * @example
 * ```
 * GET /api/graphql?query={me{id,email}}
 * ```
 */
export async function GET(request: NextRequest): Promise<Response> {
  return handler(request);
}

/**
 * POST handler for GraphQL requests
 *
 * Handles GraphQL queries and mutations sent via POST request.
 * This is the primary method for GraphQL operations.
 *
 * @param request - The incoming Next.js request
 * @returns The GraphQL response
 *
 * @example
 * ```
 * POST /api/graphql
 * Content-Type: application/json
 *
 * {
 *   "query": "query { me { id email } }",
 *   "variables": {}
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handler(request);
}

/**
 * OPTIONS handler for CORS preflight requests
 *
 * Handles CORS preflight requests for cross-origin GraphQL calls.
 *
 * @param request - The incoming Next.js request
 * @returns CORS headers response
 */
export async function OPTIONS(request: NextRequest): Promise<Response> {
  const origin = request.headers.get('origin') ?? '*';

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
