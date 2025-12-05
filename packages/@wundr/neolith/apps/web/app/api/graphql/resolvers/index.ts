/**
 * GraphQL Resolvers Index
 *
 * Merges all resolver modules into a single resolvers object
 * for use with Apollo Server.
 *
 * @module api/graphql/resolvers
 */

import { GraphQLScalarType, Kind } from 'graphql';

import { userResolvers } from './user';
import { workspaceResolvers } from './workspace';

/**
 * DateTime scalar type
 *
 * Handles serialization and parsing of Date objects
 * to/from ISO 8601 formatted strings.
 */
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type representing ISO 8601 date-time',

  /**
   * Serialize Date to ISO string for client
   */
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('DateTime cannot serialize non-Date value');
  },

  /**
   * Parse ISO string from client to Date
   */
  parseValue(value: unknown): Date {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('DateTime cannot parse invalid date string');
      }
      return date;
    }
    throw new Error('DateTime must be a string');
  },

  /**
   * Parse literal value in query to Date
   */
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        throw new Error('DateTime cannot parse invalid date string');
      }
      return date;
    }
    throw new Error('DateTime must be a string');
  },
});

/**
 * JSON scalar type
 *
 * Handles arbitrary JSON objects for flexible data storage.
 */
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type for arbitrary JSON data',

  /**
   * Serialize JSON value for client
   */
  serialize(value: unknown): unknown {
    return value;
  },

  /**
   * Parse JSON from client
   */
  parseValue(value: unknown): unknown {
    return value;
  },

  /**
   * Parse literal JSON value in query
   */
  parseLiteral(ast): unknown {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value;
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.NULL:
        return null;
      case Kind.LIST:
        return ast.values.map(v => JSONScalar.parseLiteral(v, {}));
      case Kind.OBJECT: {
        const obj: Record<string, unknown> = {};
        for (const field of ast.fields) {
          obj[field.name.value] = JSONScalar.parseLiteral(field.value, {});
        }
        return obj;
      }
      default:
        return null;
    }
  },
});

/**
 * Base resolvers for root types and scalars
 */
const baseResolvers = {
  /**
   * Custom scalar resolvers
   */
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  /**
   * Root Query resolvers
   */
  Query: {
    /**
     * Health check query
     *
     * Returns basic API health information for monitoring.
     *
     * @returns Health check response
     *
     * @example
     * ```graphql
     * query {
     *   _health {
     *     status
     *     timestamp
     *     version
     *   }
     * }
     * ```
     */
    _health: () => ({
      status: 'ok',
      timestamp: new Date(),
      version: '0.1.0',
    }),
  },

  /**
   * Root Mutation resolvers
   */
  Mutation: {
    /**
     * No-op mutation placeholder
     *
     * Required to ensure Mutation type is not empty.
     *
     * @returns null
     */
    _noop: () => null,
  },
};

/**
 * Deep merge resolver objects
 *
 * Combines multiple resolver objects, properly handling nested
 * Query and Mutation types.
 *
 * @param resolvers - Array of resolver objects to merge
 * @returns Merged resolver object
 */
function mergeResolvers(
  ...resolvers: Array<Record<string, unknown>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const resolver of resolvers) {
    for (const [key, value] of Object.entries(resolver)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !('serialize' in value) // Don't merge scalar types
      ) {
        merged[key] = {
          ...(merged[key] as Record<string, unknown> | undefined),
          ...value,
        };
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Combined resolvers object
 *
 * Merges all domain resolvers with base resolvers.
 * Order matters - later resolvers override earlier ones.
 */
export const resolvers = mergeResolvers(
  baseResolvers,
  userResolvers,
  workspaceResolvers
);

/**
 * Re-export individual resolver modules for testing
 */
export { userResolvers, workspaceResolvers };
