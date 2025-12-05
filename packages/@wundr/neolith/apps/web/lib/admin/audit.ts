/**
 * Audit logging utilities for admin operations
 * @module lib/admin/audit
 */

import type { AuditActionType, AuditLog } from '@/types/admin';

// =============================================================================
// Audit Types & Constants
// =============================================================================

/**
 * Severity levels for audit events
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Action categories for filtering and reporting
 */
export enum AuditCategory {
  USER_MANAGEMENT = 'user_management',
  ROLE_MANAGEMENT = 'role_management',
  SETTINGS = 'settings',
  BILLING = 'billing',
  SECURITY = 'security',
  CONTENT = 'content',
  SYSTEM = 'system',
}

/**
 * Map actions to categories
 */
export const ACTION_CATEGORIES: Record<string, AuditCategory> = {
  'user.created': AuditCategory.USER_MANAGEMENT,
  'user.updated': AuditCategory.USER_MANAGEMENT,
  'user.deleted': AuditCategory.USER_MANAGEMENT,
  'user.suspended': AuditCategory.SECURITY,
  'user.unsuspended': AuditCategory.SECURITY,
  'user.login': AuditCategory.SECURITY,
  'user.logout': AuditCategory.SECURITY,
  'user.password_changed': AuditCategory.SECURITY,
  'member.invited': AuditCategory.USER_MANAGEMENT,
  'member.accepted': AuditCategory.USER_MANAGEMENT,
  'member.removed': AuditCategory.USER_MANAGEMENT,
  'member.role_changed': AuditCategory.ROLE_MANAGEMENT,
  'role.created': AuditCategory.ROLE_MANAGEMENT,
  'role.updated': AuditCategory.ROLE_MANAGEMENT,
  'role.deleted': AuditCategory.ROLE_MANAGEMENT,
  'settings.updated': AuditCategory.SETTINGS,
  'billing.updated': AuditCategory.BILLING,
  'billing.upgraded': AuditCategory.BILLING,
  'billing.downgraded': AuditCategory.BILLING,
  'channel.created': AuditCategory.CONTENT,
  'channel.deleted': AuditCategory.CONTENT,
  'workspace.created': AuditCategory.SYSTEM,
  'workspace.deleted': AuditCategory.SYSTEM,
};

/**
 * Map actions to severity levels
 */
export const ACTION_SEVERITY: Record<string, AuditSeverity> = {
  'user.deleted': AuditSeverity.WARNING,
  'user.suspended': AuditSeverity.WARNING,
  'user.password_changed': AuditSeverity.INFO,
  'member.removed': AuditSeverity.WARNING,
  'role.deleted': AuditSeverity.WARNING,
  'settings.updated': AuditSeverity.INFO,
  'billing.downgraded': AuditSeverity.WARNING,
  'workspace.deleted': AuditSeverity.CRITICAL,
};

// =============================================================================
// Audit Log Creation
// =============================================================================

/**
 * Parameters for creating an audit log entry
 */
export interface CreateAuditLogParams {
  action: AuditActionType;
  actorId: string;
  workspaceId: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 *
 * This is a client-side helper that prepares audit log data.
 * The actual database write should happen server-side.
 *
 * @param params - Audit log parameters
 * @returns Formatted audit log data
 *
 * @example
 * ```ts
 * const auditData = createAuditLog({
 *   action: 'user.suspended',
 *   actorId: 'user-123',
 *   workspaceId: 'workspace-456',
 *   targetType: 'user',
 *   targetId: 'user-789',
 *   targetName: 'john@example.com',
 *   metadata: { reason: 'Violation of terms' },
 * });
 *
 * await fetch('/api/audit', {
 *   method: 'POST',
 *   body: JSON.stringify(auditData),
 * });
 * ```
 */
export function createAuditLog(params: CreateAuditLogParams): Omit<AuditLog, 'id' | 'createdAt'> {
  return {
    action: params.action,
    actorId: params.actorId,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    targetName: params.targetName ?? null,
    metadata: params.metadata,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  };
}

// =============================================================================
// Audit Log Formatting & Presentation
// =============================================================================

/**
 * Get human-readable description of an audit action
 *
 * @param log - Audit log entry
 * @returns Human-readable description
 */
export function formatAuditAction(log: AuditLog): string {
  const actorName = log.actor?.name || log.actor?.email || 'Unknown user';
  const targetName = log.targetName || 'unknown target';

  const actionDescriptions: Record<string, string> = {
    'user.created': `${actorName} created user ${targetName}`,
    'user.updated': `${actorName} updated user ${targetName}`,
    'user.deleted': `${actorName} deleted user ${targetName}`,
    'user.suspended': `${actorName} suspended user ${targetName}`,
    'user.unsuspended': `${actorName} unsuspended user ${targetName}`,
    'user.login': `${actorName} logged in`,
    'user.logout': `${actorName} logged out`,
    'user.password_changed': `${actorName} changed their password`,
    'member.invited': `${actorName} invited ${targetName}`,
    'member.accepted': `${actorName} accepted invitation`,
    'member.removed': `${actorName} removed ${targetName}`,
    'member.role_changed': `${actorName} changed role for ${targetName}`,
    'role.created': `${actorName} created role ${targetName}`,
    'role.updated': `${actorName} updated role ${targetName}`,
    'role.deleted': `${actorName} deleted role ${targetName}`,
    'settings.updated': `${actorName} updated workspace settings`,
    'billing.updated': `${actorName} updated billing information`,
    'billing.upgraded': `${actorName} upgraded subscription plan`,
    'billing.downgraded': `${actorName} downgraded subscription plan`,
    'channel.created': `${actorName} created channel ${targetName}`,
    'channel.deleted': `${actorName} deleted channel ${targetName}`,
    'workspace.created': `${actorName} created workspace ${targetName}`,
    'workspace.deleted': `${actorName} deleted workspace ${targetName}`,
  };

  return actionDescriptions[log.action] || `${actorName} performed ${log.action}`;
}

/**
 * Get severity of an audit log entry
 *
 * @param action - Audit action type
 * @returns Severity level
 */
export function getAuditSeverity(action: AuditActionType): AuditSeverity {
  return ACTION_SEVERITY[action] || AuditSeverity.INFO;
}

/**
 * Get category of an audit log entry
 *
 * @param action - Audit action type
 * @returns Category
 */
export function getAuditCategory(action: AuditActionType): AuditCategory {
  return ACTION_CATEGORIES[action] || AuditCategory.SYSTEM;
}

/**
 * Format timestamp for display
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatAuditTimestamp(
  date: Date,
  options: {
    includeTime?: boolean;
    relative?: boolean;
  } = {}
): string {
  const { includeTime = true, relative = false } = options;

  if (relative) {
    return formatRelativeTime(date);
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', dateOptions);
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

// =============================================================================
// Audit Log Filtering & Analysis
// =============================================================================

/**
 * Group audit logs by date
 *
 * @param logs - Audit logs to group
 * @returns Logs grouped by date
 */
export function groupLogsByDate(logs: AuditLog[]): Record<string, AuditLog[]> {
  const grouped: Record<string, AuditLog[]> = {};

  for (const log of logs) {
    const dateKey = log.createdAt.toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(log);
  }

  return grouped;
}

/**
 * Group audit logs by actor
 *
 * @param logs - Audit logs to group
 * @returns Logs grouped by actor
 */
export function groupLogsByActor(logs: AuditLog[]): Record<string, AuditLog[]> {
  const grouped: Record<string, AuditLog[]> = {};

  for (const log of logs) {
    if (!grouped[log.actorId]) {
      grouped[log.actorId] = [];
    }
    grouped[log.actorId].push(log);
  }

  return grouped;
}

/**
 * Group audit logs by category
 *
 * @param logs - Audit logs to group
 * @returns Logs grouped by category
 */
export function groupLogsByCategory(logs: AuditLog[]): Record<AuditCategory, AuditLog[]> {
  const grouped = Object.values(AuditCategory).reduce(
    (acc, category) => {
      acc[category] = [];
      return acc;
    },
    {} as Record<AuditCategory, AuditLog[]>
  );

  for (const log of logs) {
    const category = getAuditCategory(log.action);
    grouped[category].push(log);
  }

  return grouped;
}

/**
 * Filter logs by date range
 *
 * @param logs - Audit logs to filter
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Filtered logs
 */
export function filterLogsByDateRange(
  logs: AuditLog[],
  startDate: Date,
  endDate: Date
): AuditLog[] {
  return logs.filter(
    log => log.createdAt >= startDate && log.createdAt <= endDate
  );
}

/**
 * Get audit statistics
 *
 * @param logs - Audit logs to analyze
 * @returns Statistics about the logs
 */
export function getAuditStats(logs: AuditLog[]): {
  total: number;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<AuditSeverity, number>;
  topActors: Array<{ actorId: string; count: number; actor?: AuditLog['actor'] }>;
  recentActions: AuditLog[];
} {
  const byCategory = Object.values(AuditCategory).reduce(
    (acc, category) => {
      acc[category] = 0;
      return acc;
    },
    {} as Record<AuditCategory, number>
  );

  const bySeverity = Object.values(AuditSeverity).reduce(
    (acc, severity) => {
      acc[severity] = 0;
      return acc;
    },
    {} as Record<AuditSeverity, number>
  );

  const actorCounts = new Map<string, { count: number; actor?: AuditLog['actor'] }>();

  for (const log of logs) {
    // Count by category
    const category = getAuditCategory(log.action);
    byCategory[category]++;

    // Count by severity
    const severity = getAuditSeverity(log.action);
    bySeverity[severity]++;

    // Count by actor
    const existing = actorCounts.get(log.actorId);
    if (existing) {
      existing.count++;
    } else {
      actorCounts.set(log.actorId, { count: 1, actor: log.actor });
    }
  }

  // Get top actors
  const topActors = Array.from(actorCounts.entries())
    .map(([actorId, data]) => ({ actorId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get recent actions (last 10)
  const recentActions = logs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return {
    total: logs.length,
    byCategory,
    bySeverity,
    topActors,
    recentActions,
  };
}
