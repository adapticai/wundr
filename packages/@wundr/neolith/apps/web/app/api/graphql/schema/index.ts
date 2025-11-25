/**
 * GraphQL Schema Module
 *
 * Merges type definitions and provides the complete GraphQL schema.
 * Uses file-based schema loading for maintainability and organization.
 *
 * @module api/graphql/schema
 */

/**
 * Base type definitions for the GraphQL schema
 *
 * Includes custom scalars and root type extensions that all
 * other type definitions can extend.
 */
const baseTypeDefs = /* GraphQL */ `
  """
  Custom scalar for date-time values in ISO 8601 format
  """
  scalar DateTime

  """
  Custom scalar for JSON objects
  """
  scalar JSON

  """
  Root Query type
  All queries extend this type
  """
  type Query {
    """
    Health check query to verify API is operational
    """
    _health: HealthCheck!
  }

  """
  Root Mutation type
  All mutations extend this type
  """
  type Mutation {
    """
    No-op mutation placeholder
    """
    _noop: Boolean
  }

  """
  Health check response type
  """
  type HealthCheck {
    """
    Whether the API is healthy
    """
    status: String!

    """
    Current server timestamp
    """
    timestamp: DateTime!

    """
    API version
    """
    version: String!
  }
`;

/**
 * User type definitions
 */
const userTypeDefs = /* GraphQL */ `
  enum UserRole {
    ADMIN
    MEMBER
    VIEWER
  }

  type User {
    id: ID!
    email: String!
    name: String
    avatarUrl: String
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input UpdateUserInput {
    name: String
    avatarUrl: String
  }

  extend type Query {
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
  }

  extend type Mutation {
    updateProfile(input: UpdateUserInput!): User!
  }
`;

/**
 * Workspace type definitions
 */
const workspaceTypeDefs = /* GraphQL */ `
  enum ThemePreference {
    LIGHT
    DARK
    SYSTEM
  }

  type WorkspaceSettings {
    theme: ThemePreference!
    emailNotifications: Boolean!
    inAppNotifications: Boolean!
    timezone: String!
    locale: String!
  }

  type Workspace {
    id: ID!
    name: String!
    slug: String!
    description: String
    logoUrl: String
    owner: User!
    settings: WorkspaceSettings!
    memberCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CreateWorkspaceInput {
    name: String!
    slug: String
    description: String
    logoUrl: String
  }

  input UpdateWorkspaceInput {
    name: String
    description: String
    logoUrl: String
  }

  input UpdateWorkspaceSettingsInput {
    theme: ThemePreference
    emailNotifications: Boolean
    inAppNotifications: Boolean
    timezone: String
    locale: String
  }

  extend type Query {
    workspace(id: ID!): Workspace
    workspaceBySlug(slug: String!): Workspace
    myWorkspaces(limit: Int, offset: Int): [Workspace!]!
  }

  extend type Mutation {
    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!
    updateWorkspaceSettings(
      id: ID!
      input: UpdateWorkspaceSettingsInput!
    ): Workspace!
    deleteWorkspace(id: ID!): Boolean!
  }
`;

/**
 * Combined type definitions array
 *
 * All schema type definitions are merged here in the correct order.
 * Base types must come first, followed by domain-specific types.
 */
export const typeDefs = [baseTypeDefs, userTypeDefs, workspaceTypeDefs];

/**
 * Retrieves all type definitions as a single string
 *
 * Useful for schema introspection or debugging.
 *
 * @returns Combined type definitions as a single string
 */
export function getTypeDefsString(): string {
  return typeDefs.join('\n\n');
}
