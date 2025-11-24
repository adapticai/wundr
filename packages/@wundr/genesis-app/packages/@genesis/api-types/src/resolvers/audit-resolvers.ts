/**
 * GraphQL Resolvers for Audit Logs
 *
 * Provides audit logging functionality for enterprise compliance tracking.
 * Includes querying, statistics, and export capabilities.
 *
 * @module @genesis/api-types/resolvers/audit-resolvers
 */

/**
 * AuditService interface for audit resolver operations
 * Defined locally to avoid coupling to internal @genesis/core exports
 */
export interface AuditService {
  query(
    filters: {
      workspaceId: string;
      actions?: unknown[] | undefined;
      categories?: string[] | undefined;
      severities?: string[] | undefined;
      actorIds?: string[] | undefined;
      actorTypes?: ('user' | 'vp' | 'system' | 'api')[] | undefined;
      resourceTypes?: string[] | undefined;
      resourceIds?: string[] | undefined;
      dateRange?: { start: Date; end: Date } | undefined;
      success?: boolean | undefined;
      search?: string | undefined;
    },
    pagination: { limit: number; offset: number },
    sort?: { field: string; direction: 'asc' | 'desc' } | undefined
  ): Promise<{
    entries: unknown[];
    total: number;
    pagination: { hasMore: boolean; nextCursor?: string | undefined };
  }>;
  getStats(
    workspaceId: string,
    dateRange?: { start: Date; end: Date } | undefined
  ): Promise<{
    totalEntries: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byAction: Record<string, number>;
    byActor: { actorId: string; actorName: string; count: number }[];
    timeline: { date: string; count: number }[];
  }>;
  getExport(id: string): Promise<{
    id: string;
    status: string;
    format: string;
    fileUrl?: string | undefined;
    fileSize?: number | undefined;
    entryCount?: number | undefined;
    createdAt: Date;
    completedAt?: Date | undefined;
    expiresAt?: Date | undefined;
    error?: string | undefined;
  } | null>;
  requestExport(
    workspaceId: string,
    userId: string,
    filter: { workspaceId: string },
    format: 'json' | 'csv' | 'pdf'
  ): Promise<{
    id: string;
    status: string;
    format: string;
    createdAt: Date;
  }>;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * GraphQL context for audit resolvers
 */
export interface AuditGraphQLContext {
  services: {
    audit: AuditService;
  };
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

/**
 * Audit category enum values
 */
export const AuditCategory = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  DATA_ACCESS: 'data_access',
  DATA_MODIFICATION: 'data_modification',
  SYSTEM_CONFIGURATION: 'system_configuration',
  SECURITY: 'security',
  COMPLIANCE: 'compliance',
} as const;

export type AuditCategoryValue = (typeof AuditCategory)[keyof typeof AuditCategory];

/**
 * Audit severity enum values
 */
export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type AuditSeverityValue = (typeof AuditSeverity)[keyof typeof AuditSeverity];

/**
 * Export status enum values
 */
export const ExportStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ExportStatusValue = (typeof ExportStatus)[keyof typeof ExportStatus];

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for audit logs
 */
export const auditTypeDefs = `#graphql
  type AuditLogEntry {
    id: ID!
    timestamp: DateTime!
    action: String!
    category: AuditCategory!
    severity: AuditSeverity!
    actorId: String!
    actorType: String!
    actorName: String!
    actorEmail: String
    resourceType: String!
    resourceId: String!
    resourceName: String
    workspaceId: ID!
    ipAddress: String
    userAgent: String
    sessionId: String
    changes: [AuditChange!]
    metadata: JSON
    success: Boolean!
    errorMessage: String
  }

  type AuditChange {
    field: String!
    oldValue: JSON
    newValue: JSON
  }

  enum AuditCategory {
    authentication
    authorization
    data_access
    data_modification
    system_configuration
    security
    compliance
  }

  enum AuditSeverity {
    info
    warning
    critical
  }

  type AuditLogResponse {
    entries: [AuditLogEntry!]!
    total: Int!
    pagination: AuditPagination!
  }

  type AuditPagination {
    hasMore: Boolean!
    nextCursor: String
  }

  type AuditStats {
    totalEntries: Int!
    byCategory: JSON!
    bySeverity: JSON!
    byAction: JSON!
    byActor: [ActorStats!]!
    timeline: [TimelineEntry!]!
  }

  type ActorStats {
    actorId: String!
    actorName: String!
    count: Int!
  }

  type TimelineEntry {
    date: String!
    count: Int!
  }

  type AuditExport {
    id: ID!
    status: ExportStatus!
    format: String!
    fileUrl: String
    fileSize: Int
    entryCount: Int
    createdAt: DateTime!
    completedAt: DateTime
    expiresAt: DateTime
    error: String
  }

  enum ExportStatus {
    pending
    processing
    completed
    failed
  }

  input AuditLogFilter {
    workspaceId: ID!
    actions: [String!]
    categories: [AuditCategory!]
    severities: [AuditSeverity!]
    actorIds: [String!]
    actorTypes: [String!]
    resourceTypes: [String!]
    resourceIds: [String!]
    dateFrom: DateTime
    dateTo: DateTime
    success: Boolean
    search: String
  }

  input AuditSortInput {
    field: AuditSortField!
    direction: SortDirection!
  }

  enum AuditSortField {
    timestamp
    severity
    actor
    action
  }

  extend type Query {
    """
    Query audit logs with filters
    """
    auditLogs(filter: AuditLogFilter!, limit: Int, offset: Int, sort: AuditSortInput): AuditLogResponse!

    """
    Get audit log statistics
    """
    auditStats(workspaceId: ID!, dateFrom: DateTime, dateTo: DateTime): AuditStats!

    """
    Get audit export status
    """
    auditExport(id: ID!): AuditExport
  }

  extend type Mutation {
    """
    Request an audit log export
    """
    requestAuditExport(workspaceId: ID!, filter: AuditLogFilter!, format: String!): AuditExport!
  }
`;

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Audit query resolvers
 */
export const auditQueries = {
  /**
   * Query audit logs with filters
   */
  auditLogs: async (
    _parent: unknown,
    { filter, limit, offset, sort }: {
      filter: {
        workspaceId: string;
        actions?: string[];
        categories?: string[];
        severities?: string[];
        actorIds?: string[];
        actorTypes?: string[];
        resourceTypes?: string[];
        resourceIds?: string[];
        dateFrom?: Date;
        dateTo?: Date;
        success?: boolean;
        search?: string;
      };
      limit?: number;
      offset?: number;
      sort?: {
        field: 'timestamp' | 'severity' | 'actor' | 'action';
        direction: 'asc' | 'desc';
      };
    },
    context: AuditGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.audit.query(
      {
        workspaceId: filter.workspaceId,
        actions: filter.actions as unknown[],
        categories: filter.categories as AuditCategoryValue[],
        severities: filter.severities as AuditSeverityValue[],
        actorIds: filter.actorIds,
        actorTypes: filter.actorTypes as ('user' | 'vp' | 'system' | 'api')[],
        resourceTypes: filter.resourceTypes,
        resourceIds: filter.resourceIds,
        dateRange: filter.dateFrom && filter.dateTo ? {
          start: filter.dateFrom,
          end: filter.dateTo,
        } : undefined,
        success: filter.success,
        search: filter.search,
      },
      { limit: limit ?? 50, offset: offset ?? 0 },
      sort ? { field: sort.field, direction: sort.direction } : undefined
    );
  },

  /**
   * Get audit log statistics
   */
  auditStats: async (
    _parent: unknown,
    { workspaceId, dateFrom, dateTo }: {
      workspaceId: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    context: AuditGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.audit.getStats(
      workspaceId,
      dateFrom && dateTo ? { start: dateFrom, end: dateTo } : undefined
    );
  },

  /**
   * Get audit export status
   */
  auditExport: async (
    _parent: unknown,
    { id }: { id: string },
    context: AuditGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.audit.getExport(id);
  },
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Audit mutation resolvers
 */
export const auditMutations = {
  /**
   * Request an audit log export
   */
  requestAuditExport: async (
    _parent: unknown,
    { workspaceId, filter, format }: {
      workspaceId: string;
      filter: { workspaceId: string };
      format: string;
    },
    context: AuditGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.audit.requestExport(
      workspaceId,
      context.user.id,
      filter,
      format as 'json' | 'csv' | 'pdf'
    );
  },
};

// =============================================================================
// FIELD RESOLVERS
// =============================================================================

/**
 * Field resolvers for AuditLogEntry type
 */
export const AuditLogEntryFieldResolvers = {
  /**
   * Parse changes from JSON string if needed
   */
  changes: (parent: { changes?: unknown[] | string }) => {
    if (typeof parent.changes === 'string') {
      return JSON.parse(parent.changes);
    }
    return parent.changes;
  },

  /**
   * Parse metadata from JSON string if needed
   */
  metadata: (parent: { metadata?: Record<string, unknown> | string }) => {
    if (typeof parent.metadata === 'string') {
      return JSON.parse(parent.metadata);
    }
    return parent.metadata;
  },
};

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined audit resolvers for schema stitching
 */
export const auditResolvers = {
  Query: auditQueries,
  Mutation: auditMutations,
  AuditLogEntry: AuditLogEntryFieldResolvers,
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default auditResolvers;
