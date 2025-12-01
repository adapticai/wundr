/**
 * @fileoverview Audit log types for enterprise compliance
 */

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.password_changed'
  | 'user.mfa_enabled'
  | 'user.mfa_disabled'
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'workspace.member_added'
  | 'workspace.member_removed'
  | 'workspace.member_role_changed'
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'channel.archived'
  | 'channel.member_added'
  | 'channel.member_removed'
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'file.uploaded'
  | 'file.downloaded'
  | 'file.deleted'
  | 'vp.created'
  | 'vp.updated'
  | 'vp.deleted'
  | 'vp.started'
  | 'vp.stopped'
  | 'vp.message_sent'
  | 'permission.granted'
  | 'permission.revoked'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'export.requested'
  | 'export.completed'
  | 'settings.updated'
  | 'integration.connected'
  | 'integration.disconnected';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'system_configuration'
  | 'security'
  | 'compliance';

/**
 * Typed value that can be stored in audit change records.
 * Supports primitive types and simple structured data.
 */
export type AuditChangeValue =
  | string
  | number
  | boolean
  | null
  | Date
  | string[]
  | number[]
  | { [key: string]: string | number | boolean | null };

/**
 * Audit log entry metadata with typed properties.
 */
export interface AuditEntryMetadata {
  /** HTTP request ID for tracing */
  requestId?: string;
  /** API version used */
  apiVersion?: string;
  /** OAuth client ID if applicable */
  clientId?: string;
  /** Geographic location derived from IP */
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  /** Integration provider name */
  integrationProvider?: string;
  /** Additional context as key-value pairs */
  context?: { [key: string]: string | number | boolean };
}

/**
 * A single audit log entry representing an auditable action.
 */
export interface AuditLogEntry {
  /** Unique identifier for this audit entry */
  id: string;
  /** When the action occurred */
  timestamp: Date;
  /** The action that was performed */
  action: AuditAction;
  /** Category of the action */
  category: AuditCategory;
  /** Severity level of the action */
  severity: AuditSeverity;
  /** ID of the actor who performed the action */
  actorId: string;
  /** Type of actor */
  actorType: 'user' | 'vp' | 'system' | 'api';
  /** Display name of the actor */
  actorName: string;
  /** Email of the actor (if user) */
  actorEmail?: string;
  /** Type of resource affected */
  resourceType: string;
  /** ID of the resource affected */
  resourceId: string;
  /** Display name of the resource */
  resourceName?: string;
  /** Workspace where the action occurred */
  workspaceId: string;
  /** IP address of the request origin */
  ipAddress?: string;
  /** User agent string from the request */
  userAgent?: string;
  /** Session ID if applicable */
  sessionId?: string;
  /** List of field changes */
  changes?: AuditChange[];
  /** Additional typed metadata */
  metadata?: AuditEntryMetadata;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if the action failed */
  errorMessage?: string;
}

/**
 * Represents a single field change in an audit log entry.
 */
export interface AuditChange {
  /** Name of the field that changed */
  field: string;
  /** Previous value (before the change) */
  oldValue?: AuditChangeValue;
  /** New value (after the change) */
  newValue?: AuditChangeValue;
}

export interface AuditLogFilter {
  workspaceId: string;
  actions?: AuditAction[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  actorIds?: string[];
  actorTypes?: Array<'user' | 'vp' | 'system' | 'api'>;
  resourceTypes?: string[];
  resourceIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  success?: boolean;
  search?: string;
}

export interface AuditLogPagination {
  limit: number;
  offset: number;
  cursor?: string;
}

export interface AuditLogSort {
  field: 'timestamp' | 'action' | 'severity' | 'actor';
  direction: 'asc' | 'desc';
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface AuditLogExport {
  id: string;
  workspaceId: string;
  requestedBy: string;
  filter: AuditLogFilter;
  format: 'json' | 'csv' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  entryCount?: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  error?: string;
}

export interface AuditLogStats {
  totalEntries: number;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<AuditSeverity, number>;
  byAction: Record<string, number>;
  byActor: Array<{ actorId: string; actorName: string; count: number }>;
  timeline: Array<{ date: string; count: number }>;
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

const AUDIT_ACTIONS: AuditAction[] = [
  'user.login',
  'user.logout',
  'user.created',
  'user.updated',
  'user.deleted',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'workspace.created',
  'workspace.updated',
  'workspace.deleted',
  'workspace.member_added',
  'workspace.member_removed',
  'workspace.member_role_changed',
  'channel.created',
  'channel.updated',
  'channel.deleted',
  'channel.archived',
  'channel.member_added',
  'channel.member_removed',
  'message.created',
  'message.updated',
  'message.deleted',
  'file.uploaded',
  'file.downloaded',
  'file.deleted',
  'vp.created',
  'vp.updated',
  'vp.deleted',
  'vp.started',
  'vp.stopped',
  'vp.message_sent',
  'permission.granted',
  'permission.revoked',
  'api_key.created',
  'api_key.revoked',
  'export.requested',
  'export.completed',
  'settings.updated',
  'integration.connected',
  'integration.disconnected',
];

const AUDIT_SEVERITIES: AuditSeverity[] = ['info', 'warning', 'critical'];

const AUDIT_CATEGORIES: AuditCategory[] = [
  'authentication',
  'authorization',
  'data_access',
  'data_modification',
  'system_configuration',
  'security',
  'compliance',
];

export function isAuditAction(value: unknown): value is AuditAction {
  return (
    typeof value === 'string' && AUDIT_ACTIONS.includes(value as AuditAction)
  );
}

export function isAuditSeverity(value: unknown): value is AuditSeverity {
  return (
    typeof value === 'string' &&
    AUDIT_SEVERITIES.includes(value as AuditSeverity)
  );
}

export function isAuditCategory(value: unknown): value is AuditCategory {
  return (
    typeof value === 'string' &&
    AUDIT_CATEGORIES.includes(value as AuditCategory)
  );
}

export function isAuditLogEntry(value: unknown): value is AuditLogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.timestamp instanceof Date &&
    isAuditAction(entry.action) &&
    isAuditCategory(entry.category) &&
    isAuditSeverity(entry.severity) &&
    typeof entry.actorId === 'string' &&
    ['user', 'vp', 'system', 'api'].includes(entry.actorType as string) &&
    typeof entry.actorName === 'string' &&
    typeof entry.resourceType === 'string' &&
    typeof entry.resourceId === 'string' &&
    typeof entry.workspaceId === 'string' &&
    typeof entry.success === 'boolean'
  );
}

// =============================================================================
// Constants
// =============================================================================

export const CRITICAL_ACTIONS: AuditAction[] = [
  'user.deleted',
  'workspace.deleted',
  'permission.granted',
  'permission.revoked',
  'api_key.created',
  'api_key.revoked',
  'user.mfa_disabled',
  'export.requested',
];

export const WARNING_ACTIONS: AuditAction[] = [
  'user.password_changed',
  'workspace.member_removed',
  'channel.deleted',
  'message.deleted',
  'file.deleted',
  'vp.deleted',
  'settings.updated',
];

export const DEFAULT_AUDIT_RETENTION_DAYS = 365;
export const DEFAULT_AUDIT_BATCH_SIZE = 100;
export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_PAGE_SIZE = 1000;
