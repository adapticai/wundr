/**
 * Admin Audit Logger
 *
 * Provides utilities for logging admin actions to the audit trail.
 *
 * @module lib/admin/audit-logger
 */

import {
  AuditServiceImpl,
  type AuditDatabaseClient,
  type AuditRedisClient,
} from '@neolith/core';
import { redis } from '@neolith/core/redis';
import { prisma } from '@neolith/database';

import type { AdminActionType } from '@/lib/validations/admin';

/**
 * Admin action log entry
 */
export interface AdminActionLog {
  action: AdminActionType | string;
  actorId: string;
  workspaceId: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create audit service instance
 */
function createAuditService() {
  return new AuditServiceImpl({
    prisma: prisma as unknown as AuditDatabaseClient,
    redis: redis as unknown as AuditRedisClient,
  });
}

/**
 * Log an admin action to the audit trail
 *
 * @param entry - Admin action log entry
 */
export async function logAdminAction(entry: AdminActionLog): Promise<void> {
  try {
    const auditService = createAuditService();

    await auditService.log({
      action: entry.action as never,
      actorId: entry.actorId,
      actorType: 'user',
      actorName: entry.actorId, // Will be resolved by audit service
      workspaceId: entry.workspaceId,
      resourceType: entry.targetType || 'admin',
      resourceId: entry.targetId || entry.workspaceId,
      resourceName: entry.targetName,
      metadata: {
        category: 'admin',
        severity: 'high',
        reason: entry.reason,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        ...entry.metadata,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging failure shouldn't break the action
    console.error('Failed to log admin action:', error);
  }
}

/**
 * Log member modification action
 */
export async function logMemberAction(
  action: 'suspended' | 'unsuspended' | 'role_changed' | 'removed' | 'invited',
  actorId: string,
  workspaceId: string,
  targetUserId: string,
  targetUserName: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: `member.${action}`,
    actorId,
    workspaceId,
    targetType: 'user',
    targetId: targetUserId,
    targetName: targetUserName || undefined,
    metadata,
  });
}

/**
 * Log role modification action
 */
export async function logRoleAction(
  action: 'created' | 'updated' | 'deleted',
  actorId: string,
  workspaceId: string,
  roleId: string,
  roleName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: `role.${action}`,
    actorId,
    workspaceId,
    targetType: 'role',
    targetId: roleId,
    targetName: roleName,
    metadata,
  });
}

/**
 * Log invite action
 */
export async function logInviteAction(
  action: 'created' | 'revoked' | 'accepted',
  actorId: string,
  workspaceId: string,
  inviteId: string,
  inviteEmail: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: `invite.${action}`,
    actorId,
    workspaceId,
    targetType: 'invite',
    targetId: inviteId,
    targetName: inviteEmail,
    metadata,
  });
}

/**
 * Log settings modification action
 */
export async function logSettingsAction(
  actorId: string,
  workspaceId: string,
  section: string,
  changes: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: 'settings.updated',
    actorId,
    workspaceId,
    targetType: 'settings',
    targetId: section,
    targetName: section,
    metadata: { changes },
  });
}

/**
 * Log billing action
 */
export async function logBillingAction(
  action: 'upgraded' | 'downgraded' | 'cancelled',
  actorId: string,
  workspaceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: `billing.${action}`,
    actorId,
    workspaceId,
    targetType: 'billing',
    metadata,
  });
}

/**
 * Log channel action
 */
export async function logChannelAction(
  action: 'archived' | 'unarchived' | 'deleted',
  actorId: string,
  workspaceId: string,
  channelId: string,
  channelName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAdminAction({
    action: `channel.${action}`,
    actorId,
    workspaceId,
    targetType: 'channel',
    targetId: channelId,
    targetName: channelName,
    metadata,
  });
}

/**
 * Get admin action history for a workspace
 *
 * @param workspaceId - Workspace ID
 * @param options - Query options
 * @returns List of admin actions
 */
export async function getAdminActionHistory(
  workspaceId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
  } = {}
): Promise<
  Array<{
    id: string;
    action: string;
    actorId: string;
    actorName: string | null;
    targetType: string | null;
    targetId: string | null;
    targetName: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }>
> {
  try {
    const auditService = createAuditService();

    const result = await auditService.query(
      {
        workspaceId,
        actions: options.action ? [options.action as never] : undefined,
        dateRange:
          options.from && options.to
            ? { start: options.from, end: options.to }
            : undefined,
      },
      {
        limit: options.limit || 50,
        offset: options.offset || 0,
      }
    );

    return result.entries.map(entry => ({
      id: entry.id,
      action: entry.action as string,
      actorId: entry.actorId,
      actorName: entry.actorName || null,
      targetType:
        ((entry.metadata as Record<string, unknown>)?.targetType as string) ||
        null,
      targetId:
        ((entry.metadata as Record<string, unknown>)?.targetId as string) ||
        null,
      targetName:
        ((entry.metadata as Record<string, unknown>)?.targetName as string) ||
        null,
      metadata: (entry.metadata as Record<string, unknown>) || {},
      createdAt: entry.timestamp,
    }));
  } catch (error) {
    console.error('Failed to fetch admin action history:', error);
    return [];
  }
}
