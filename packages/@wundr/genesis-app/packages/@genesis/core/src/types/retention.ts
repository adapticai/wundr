/**
 * @fileoverview Data retention types for enterprise compliance
 *
 * Provides type definitions for retention policies, legal holds,
 * and data export functionality to support enterprise compliance requirements.
 *
 * @packageDocumentation
 */

// =============================================================================
// Retention Policy Types
// =============================================================================

/**
 * Retention policy configuration for a workspace.
 */
export interface RetentionPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isEnabled: boolean;
  rules: RetentionRule[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Individual retention rule within a policy.
 */
export interface RetentionRule {
  id: string;
  resourceType: RetentionResourceType;
  action: RetentionAction;
  retentionDays: number;
  conditions?: RetentionCondition[];
  priority: number;
}

/**
 * Types of resources that can be subject to retention policies.
 */
export type RetentionResourceType =
  | 'message'
  | 'file'
  | 'channel'
  | 'thread'
  | 'reaction'
  | 'call_recording'
  | 'audit_log'
  | 'vp_conversation';

/**
 * Actions that can be applied to retained data.
 */
export type RetentionAction = 'delete' | 'archive' | 'anonymize';

/**
 * Condition for filtering which resources are subject to a rule.
 */
export interface RetentionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

// =============================================================================
// Retention Job Types
// =============================================================================

/**
 * Retention job execution record.
 */
export interface RetentionJob {
  id: string;
  workspaceId: string;
  policyId: string;
  status: RetentionJobStatus;
  resourceType: RetentionResourceType;
  action: RetentionAction;
  itemsProcessed: number;
  itemsTotal: number;
  itemsFailed: number;
  errors: RetentionError[];
  startedAt: Date;
  completedAt?: Date;
  scheduledAt?: Date;
}

/**
 * Possible states for a retention job.
 */
export type RetentionJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Error record from retention job processing.
 */
export interface RetentionError {
  resourceId: string;
  resourceType: string;
  error: string;
  timestamp: Date;
}

// =============================================================================
// Retention Statistics Types
// =============================================================================

/**
 * Retention statistics for a workspace.
 */
export interface RetentionStats {
  workspaceId: string;
  totalStorageBytes: number;
  storageByType: Record<RetentionResourceType, number>;
  itemCounts: Record<RetentionResourceType, number>;
  oldestItem: Record<RetentionResourceType, Date | null>;
  pendingDeletions: number;
  lastJobRun?: Date;
  nextScheduledRun?: Date;
}

// =============================================================================
// Retention Schedule Types
// =============================================================================

/**
 * Schedule for automated retention policy execution.
 */
export interface RetentionSchedule {
  id: string;
  workspaceId: string;
  policyId: string;
  schedule: string; // cron expression
  isEnabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  timezone: string;
}

// =============================================================================
// Legal Hold Types
// =============================================================================

/**
 * Legal hold to preserve data from retention actions.
 */
export interface LegalHold {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  scope: LegalHoldScope;
  createdBy: string;
  createdAt: Date;
  releasedAt?: Date;
  releasedBy?: string;
}

/**
 * Scope definition for a legal hold.
 */
export interface LegalHoldScope {
  userIds?: string[];
  channelIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  keywords?: string[];
}

// =============================================================================
// Data Export Types
// =============================================================================

/**
 * Data export request record.
 */
export interface DataExport {
  id: string;
  workspaceId: string;
  requestedBy: string;
  type: 'full' | 'partial' | 'user_data';
  scope: DataExportScope;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'zip';
  fileUrl?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  error?: string;
}

/**
 * Scope definition for data export.
 */
export interface DataExportScope {
  userIds?: string[];
  channelIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeMessages?: boolean;
  includeFiles?: boolean;
  includeProfiles?: boolean;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating a retention policy.
 */
export interface CreateRetentionPolicyInput {
  workspaceId: string;
  name: string;
  description?: string;
  rules: Omit<RetentionRule, 'id'>[];
  isEnabled?: boolean;
}

/**
 * Input for updating a retention policy.
 */
export interface UpdateRetentionPolicyInput {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  rules?: RetentionRule[];
}

/**
 * Input for creating a legal hold.
 */
export interface CreateLegalHoldInput {
  workspaceId: string;
  name: string;
  description?: string;
  scope: LegalHoldScope;
}

/**
 * Input for requesting a data export.
 */
export interface RequestDataExportInput {
  workspaceId: string;
  type: DataExport['type'];
  scope: DataExportScope;
  format: 'json' | 'zip';
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid RetentionResourceType.
 */
export function isRetentionResourceType(value: unknown): value is RetentionResourceType {
  return typeof value === 'string' && [
    'message',
    'file',
    'channel',
    'thread',
    'reaction',
    'call_recording',
    'audit_log',
    'vp_conversation',
  ].includes(value);
}

/**
 * Type guard to check if a value is a valid RetentionAction.
 */
export function isRetentionAction(value: unknown): value is RetentionAction {
  return typeof value === 'string' && ['delete', 'archive', 'anonymize'].includes(value);
}

/**
 * Type guard to check if a value is a valid RetentionJobStatus.
 */
export function isRetentionJobStatus(value: unknown): value is RetentionJobStatus {
  return typeof value === 'string' && [
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
  ].includes(value);
}

/**
 * Type guard to check if a value is a valid RetentionPolicy.
 */
export function isRetentionPolicy(value: unknown): value is RetentionPolicy {
  if (typeof value !== 'object' || value === null) return false;
  const policy = value as Record<string, unknown>;
  return (
    typeof policy.id === 'string' &&
    typeof policy.workspaceId === 'string' &&
    typeof policy.name === 'string' &&
    typeof policy.isDefault === 'boolean' &&
    typeof policy.isEnabled === 'boolean' &&
    Array.isArray(policy.rules)
  );
}

/**
 * Type guard to check if a value is a valid LegalHold.
 */
export function isLegalHold(value: unknown): value is LegalHold {
  if (typeof value !== 'object' || value === null) return false;
  const hold = value as Record<string, unknown>;
  return (
    typeof hold.id === 'string' &&
    typeof hold.workspaceId === 'string' &&
    typeof hold.name === 'string' &&
    typeof hold.isActive === 'boolean' &&
    typeof hold.scope === 'object' &&
    typeof hold.createdBy === 'string'
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default retention configuration values.
 */
export const DEFAULT_RETENTION_CONFIG = {
  defaultRetentionDays: 365,
  batchSize: 1000,
  maxConcurrentJobs: 3,
  jobTimeoutMinutes: 60,
} as const;

/**
 * Retention resource type display names.
 */
export const RETENTION_RESOURCE_NAMES: Record<RetentionResourceType, string> = {
  message: 'Messages',
  file: 'Files',
  channel: 'Channels',
  thread: 'Threads',
  reaction: 'Reactions',
  call_recording: 'Call Recordings',
  audit_log: 'Audit Logs',
  vp_conversation: 'VP Conversations',
};

/**
 * Retention action display names.
 */
export const RETENTION_ACTION_NAMES: Record<RetentionAction, string> = {
  delete: 'Delete',
  archive: 'Archive',
  anonymize: 'Anonymize',
};
