/**
 * GraphQL Resolvers for Data Retention
 *
 * Provides data retention policy management for enterprise compliance.
 * Includes policy CRUD, statistics, and legal hold functionality.
 *
 * @module @genesis/api-types/resolvers/retention-resolvers
 */

/**
 * RetentionService interface for retention resolver operations
 * Defined locally to avoid coupling to internal @genesis/core exports
 */
export interface RetentionService {
  getPolicies(workspaceId: string): Promise<unknown[]>;
  getPolicy(id: string): Promise<unknown | null>;
  getStats(workspaceId: string): Promise<{
    workspaceId: string;
    totalStorageBytes: number;
    storageByType: Record<string, number>;
    itemCounts: Record<string, number>;
    oldestItem?: Record<string, unknown> | undefined;
    pendingDeletions: number;
    lastJobRun?: Date | undefined;
  }>;
  getLegalHolds(workspaceId: string): Promise<unknown[]>;
  createPolicy(
    workspaceId: string,
    name: string,
    rules: Array<{
      resourceType: string;
      action: string;
      retentionDays: number;
      priority: number;
      conditions?: Record<string, unknown> | undefined;
    }>,
    userId: string,
    description?: string | undefined
  ): Promise<unknown>;
  updatePolicy(
    id: string,
    updates: {
      name?: string | undefined;
      description?: string | undefined;
      isEnabled?: boolean | undefined;
      rules?: Array<{
        id: string;
        resourceType: string;
        action: string;
        retentionDays: number;
        priority: number;
        conditions?: Record<string, unknown> | undefined;
      }> | undefined;
    }
  ): Promise<unknown>;
  deletePolicy(id: string): Promise<void>;
  runRetentionJob(policyId: string): Promise<unknown>;
  createLegalHold(
    workspaceId: string,
    name: string,
    scope: {
      userIds?: string[] | undefined;
      channelIds?: string[] | undefined;
      dateRange?: { start: Date; end: Date } | undefined;
    },
    userId: string,
    description?: string | undefined
  ): Promise<unknown>;
  releaseLegalHold(id: string, userId: string): Promise<unknown>;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * GraphQL context for retention resolvers
 */
export interface RetentionGraphQLContext {
  services: {
    retention: RetentionService;
  };
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

/**
 * Retention resource type enum values
 */
export const RetentionResourceType = {
  MESSAGE: 'message',
  FILE: 'file',
  CHANNEL: 'channel',
  THREAD: 'thread',
  REACTION: 'reaction',
  CALL_RECORDING: 'call_recording',
  AUDIT_LOG: 'audit_log',
  VP_CONVERSATION: 'vp_conversation',
} as const;

export type RetentionResourceTypeValue = (typeof RetentionResourceType)[keyof typeof RetentionResourceType];

/**
 * Retention action enum values
 */
export const RetentionAction = {
  DELETE: 'delete',
  ARCHIVE: 'archive',
  ANONYMIZE: 'anonymize',
} as const;

export type RetentionActionValue = (typeof RetentionAction)[keyof typeof RetentionAction];

/**
 * Retention job status enum values
 */
export const RetentionJobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type RetentionJobStatusValue = (typeof RetentionJobStatus)[keyof typeof RetentionJobStatus];

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for retention
 */
export const retentionTypeDefs = `#graphql
  type RetentionPolicy {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    isDefault: Boolean!
    isEnabled: Boolean!
    rules: [RetentionRule!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: String!
  }

  type RetentionRule {
    id: ID!
    resourceType: RetentionResourceType!
    action: RetentionAction!
    retentionDays: Int!
    priority: Int!
    conditions: JSON
  }

  enum RetentionResourceType {
    message
    file
    channel
    thread
    reaction
    call_recording
    audit_log
    vp_conversation
  }

  enum RetentionAction {
    delete
    archive
    anonymize
  }

  type RetentionJob {
    id: ID!
    workspaceId: ID!
    policyId: ID!
    status: RetentionJobStatus!
    resourceType: RetentionResourceType!
    action: RetentionAction!
    itemsProcessed: Int!
    itemsTotal: Int!
    itemsFailed: Int!
    errors: [RetentionError!]
    startedAt: DateTime!
    completedAt: DateTime
    scheduledAt: DateTime
  }

  enum RetentionJobStatus {
    pending
    running
    completed
    failed
    cancelled
  }

  type RetentionError {
    resourceId: String!
    resourceType: RetentionResourceType!
    error: String!
    timestamp: DateTime!
  }

  type RetentionStats {
    workspaceId: ID!
    totalStorageBytes: Float!
    storageByType: JSON!
    itemCounts: JSON!
    oldestItem: JSON
    pendingDeletions: Int!
    lastJobRun: DateTime
  }

  type LegalHold {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    isActive: Boolean!
    scope: LegalHoldScope!
    createdBy: String!
    createdAt: DateTime!
    releasedAt: DateTime
    releasedBy: String
  }

  type LegalHoldScope {
    userIds: [String!]
    channelIds: [String!]
    dateRange: DateRange
  }

  type DateRange {
    start: DateTime!
    end: DateTime!
  }

  input RetentionRuleInput {
    resourceType: RetentionResourceType!
    action: RetentionAction!
    retentionDays: Int!
    priority: Int
    conditions: JSON
  }

  input CreateRetentionPolicyInput {
    workspaceId: ID!
    name: String!
    description: String
    rules: [RetentionRuleInput!]!
  }

  input UpdateRetentionPolicyInput {
    name: String
    description: String
    isEnabled: Boolean
    rules: [RetentionRuleInput!]
  }

  input LegalHoldScopeInput {
    userIds: [String!]
    channelIds: [String!]
    dateStart: DateTime
    dateEnd: DateTime
  }

  input CreateLegalHoldInput {
    workspaceId: ID!
    name: String!
    description: String
    scope: LegalHoldScopeInput!
  }

  extend type Query {
    """
    Get retention policies for a workspace
    """
    retentionPolicies(workspaceId: ID!): [RetentionPolicy!]!

    """
    Get a specific retention policy
    """
    retentionPolicy(id: ID!): RetentionPolicy

    """
    Get retention statistics for a workspace
    """
    retentionStats(workspaceId: ID!): RetentionStats!

    """
    Get legal holds for a workspace
    """
    legalHolds(workspaceId: ID!): [LegalHold!]!
  }

  extend type Mutation {
    """
    Create a retention policy
    """
    createRetentionPolicy(input: CreateRetentionPolicyInput!): RetentionPolicy!

    """
    Update a retention policy
    """
    updateRetentionPolicy(id: ID!, input: UpdateRetentionPolicyInput!): RetentionPolicy!

    """
    Delete a retention policy
    """
    deleteRetentionPolicy(id: ID!): Boolean!

    """
    Run a retention job manually
    """
    runRetentionJob(policyId: ID!): RetentionJob!

    """
    Create a legal hold
    """
    createLegalHold(input: CreateLegalHoldInput!): LegalHold!

    """
    Release a legal hold
    """
    releaseLegalHold(id: ID!): LegalHold!
  }
`;

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Retention query resolvers
 */
export const retentionQueries = {
  /**
   * Get retention policies for a workspace
   */
  retentionPolicies: async (
    _parent: unknown,
    { workspaceId }: { workspaceId: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.getPolicies(workspaceId);
  },

  /**
   * Get a specific retention policy
   */
  retentionPolicy: async (
    _parent: unknown,
    { id }: { id: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.getPolicy(id);
  },

  /**
   * Get retention statistics for a workspace
   */
  retentionStats: async (
    _parent: unknown,
    { workspaceId }: { workspaceId: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.getStats(workspaceId);
  },

  /**
   * Get legal holds for a workspace
   */
  legalHolds: async (
    _parent: unknown,
    { workspaceId }: { workspaceId: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.getLegalHolds(workspaceId);
  },
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Retention mutation resolvers
 */
export const retentionMutations = {
  /**
   * Create a retention policy
   */
  createRetentionPolicy: async (
    _parent: unknown,
    { input }: {
      input: {
        workspaceId: string;
        name: string;
        description?: string;
        rules: Array<{
          resourceType: string;
          action: string;
          retentionDays: number;
          priority?: number;
          conditions?: Record<string, unknown>;
        }>;
      };
    },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.createPolicy(
      input.workspaceId,
      input.name,
      input.rules.map(r => ({
        resourceType: r.resourceType as RetentionResourceTypeValue,
        action: r.action as RetentionActionValue,
        retentionDays: r.retentionDays,
        priority: r.priority ?? 1,
        conditions: r.conditions,
      })),
      context.user.id,
      input.description
    );
  },

  /**
   * Update a retention policy
   */
  updateRetentionPolicy: async (
    _parent: unknown,
    { id, input }: {
      id: string;
      input: {
        name?: string;
        description?: string;
        isEnabled?: boolean;
        rules?: Array<{
          resourceType: string;
          action: string;
          retentionDays: number;
          priority?: number;
          conditions?: Record<string, unknown>;
        }>;
      };
    },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.updatePolicy(id, {
      name: input.name,
      description: input.description,
      isEnabled: input.isEnabled,
      rules: input.rules?.map((r, i) => ({
        id: `rule-${Date.now()}-${i}`,
        resourceType: r.resourceType as RetentionResourceTypeValue,
        action: r.action as RetentionActionValue,
        retentionDays: r.retentionDays,
        priority: r.priority ?? 1,
        conditions: r.conditions,
      })),
    });
  },

  /**
   * Delete a retention policy
   */
  deleteRetentionPolicy: async (
    _parent: unknown,
    { id }: { id: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    await context.services.retention.deletePolicy(id);
    return true;
  },

  /**
   * Run a retention job manually
   */
  runRetentionJob: async (
    _parent: unknown,
    { policyId }: { policyId: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.runRetentionJob(policyId);
  },

  /**
   * Create a legal hold
   */
  createLegalHold: async (
    _parent: unknown,
    { input }: {
      input: {
        workspaceId: string;
        name: string;
        description?: string;
        scope: {
          userIds?: string[];
          channelIds?: string[];
          dateStart?: Date;
          dateEnd?: Date;
        };
      };
    },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.createLegalHold(
      input.workspaceId,
      input.name,
      {
        userIds: input.scope.userIds,
        channelIds: input.scope.channelIds,
        dateRange: input.scope.dateStart && input.scope.dateEnd ? {
          start: input.scope.dateStart,
          end: input.scope.dateEnd,
        } : undefined,
      },
      context.user.id,
      input.description
    );
  },

  /**
   * Release a legal hold
   */
  releaseLegalHold: async (
    _parent: unknown,
    { id }: { id: string },
    context: RetentionGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.retention.releaseLegalHold(id, context.user.id);
  },
};

// =============================================================================
// FIELD RESOLVERS
// =============================================================================

/**
 * Field resolvers for RetentionPolicy type
 */
export const RetentionPolicyFieldResolvers = {
  /**
   * Parse rules from JSON string if needed
   */
  rules: (parent: { rules?: unknown[] | string }) => {
    if (typeof parent.rules === 'string') {
      return JSON.parse(parent.rules);
    }
    return parent.rules;
  },
};

/**
 * Field resolvers for LegalHold type
 */
export const LegalHoldFieldResolvers = {
  /**
   * Parse scope from JSON string if needed
   */
  scope: (parent: { scope?: Record<string, unknown> | string }) => {
    if (typeof parent.scope === 'string') {
      return JSON.parse(parent.scope);
    }
    return parent.scope;
  },
};

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined retention resolvers for schema stitching
 */
export const retentionResolvers = {
  Query: retentionQueries,
  Mutation: retentionMutations,
  RetentionPolicy: RetentionPolicyFieldResolvers,
  LegalHold: LegalHoldFieldResolvers,
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default retentionResolvers;
