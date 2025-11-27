/**
 * Organization Hierarchy Validation Schemas
 *
 * Zod validation schemas for organization hierarchy API operations.
 * These schemas ensure type safety and input validation for hierarchy endpoints.
 *
 * @module lib/validations/org-hierarchy
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Organization hierarchy node type enum
 */
export const orgHierarchyNodeTypeEnum = z.enum(['workspace', 'discipline', 'vp']);
export type OrgHierarchyNodeType = z.infer<typeof orgHierarchyNodeTypeEnum>;

/**
 * Orchestrator status enum (matches Prisma VPStatus)
 */
export const vpStatusEnum = z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']);
export type VPStatusType = z.infer<typeof vpStatusEnum>;

// =============================================================================
// ORGANIZATION HIERARCHY SCHEMAS
// =============================================================================

/**
 * Schema for Orchestrator node data within the hierarchy
 */
export const vpNodeDataSchema = z.object({
  /** Orchestrator avatar URL */
  avatarUrl: z.string().url().optional().nullable(),

  /** Orchestrator current status */
  status: vpStatusEnum,

  /** Orchestrator discipline name */
  discipline: z.string().optional().nullable(),

  /** Orchestrator role */
  role: z.string().optional().nullable(),

  /** Orchestrator current task (if any) */
  currentTask: z
    .object({
      id: z.string(),
      title: z.string(),
    })
    .nullable()
    .optional(),

  /** Orchestrator email */
  email: z.string().email().optional().nullable(),
});

export type VPNodeData = z.infer<typeof vpNodeDataSchema>;

/**
 * Schema for workspace node data within the hierarchy
 */
export const workspaceNodeDataSchema = z.object({
  /** Workspace description */
  description: z.string().optional().nullable(),

  /** Workspace visibility */
  visibility: z.string().optional().nullable(),

  /** Number of members in workspace */
  memberCount: z.number().int().nonnegative().optional(),
});

export type WorkspaceNodeData = z.infer<typeof workspaceNodeDataSchema>;

/**
 * Schema for organization hierarchy node (recursive structure)
 */
export const orgHierarchyNodeSchema: z.ZodType<{
  id: string;
  type: 'workspace' | 'discipline' | 'vp';
  name: string;
  children?: Array<{
    id: string;
    type: 'workspace' | 'discipline' | 'vp';
    name: string;
    children?: unknown[];
    data?: VPNodeData | WorkspaceNodeData;
  }>;
  data?: VPNodeData | WorkspaceNodeData;
}> = z.lazy(() =>
  z.object({
    /** Unique identifier for the node */
    id: z.string(),

    /** Node type */
    type: orgHierarchyNodeTypeEnum,

    /** Node display name */
    name: z.string(),

    /** Child nodes */
    children: z.array(orgHierarchyNodeSchema).optional(),

    /** Additional node-specific data */
    data: z.union([vpNodeDataSchema, workspaceNodeDataSchema]).optional(),
  }),
);

export type OrgHierarchyNode = z.infer<typeof orgHierarchyNodeSchema>;

/**
 * Schema for organization hierarchy statistics
 */
export const orgHierarchyStatsSchema = z.object({
  /** Total number of VPs in organization */
  totalVPs: z.number().int().nonnegative(),

  /** Number of online VPs */
  onlineVPs: z.number().int().nonnegative(),

  /** Total number of workspaces */
  totalWorkspaces: z.number().int().nonnegative(),

  /** Total number of channels */
  totalChannels: z.number().int().nonnegative(),
});

export type OrgHierarchyStats = z.infer<typeof orgHierarchyStatsSchema>;

/**
 * Schema for organization basic info
 */
export const organizationInfoSchema = z.object({
  /** Organization ID */
  id: z.string(),

  /** Organization name */
  name: z.string(),

  /** Organization slug */
  slug: z.string(),
});

export type OrganizationInfo = z.infer<typeof organizationInfoSchema>;

/**
 * Schema for full organization hierarchy response
 */
export const orgHierarchyResponseSchema = z.object({
  /** Organization basic info */
  organization: organizationInfoSchema,

  /** Hierarchical tree of organization structure */
  hierarchy: z.array(orgHierarchyNodeSchema),

  /** Organization statistics */
  stats: orgHierarchyStatsSchema,
});

export type OrgHierarchyResponse = z.infer<typeof orgHierarchyResponseSchema>;

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Error codes specific to organization hierarchy API
 */
export const ORG_HIERARCHY_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type OrgHierarchyErrorCode =
  (typeof ORG_HIERARCHY_ERROR_CODES)[keyof typeof ORG_HIERARCHY_ERROR_CODES];
