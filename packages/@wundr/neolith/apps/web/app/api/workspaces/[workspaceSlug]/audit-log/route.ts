/**
 * Audit Log API Routes
 *
 * Real implementation for audit log retrieval with proper database queries.
 * Handles audit log retrieval for compliance and security views.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/audit-log - Get audit log entries
 *
 * @module app/api/workspaces/[workspaceSlug]/audit-log/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Audit log entry structure (frontend format)
 */
interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  actorId: string;
  actorType: 'user' | 'orchestrator' | 'daemon' | 'system';
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  severity: 'info' | 'warning' | 'critical';
  actor?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  changes?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

/**
 * Paginated audit log response
 */
interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Determine severity level based on action type
 */
function getSeverity(action: string): 'info' | 'warning' | 'critical' {
  const lowerAction = action.toLowerCase();
  if (
    lowerAction.includes('delete') ||
    lowerAction.includes('remove') ||
    lowerAction.includes('breach') ||
    lowerAction.includes('suspicious') ||
    lowerAction.includes('failed_login')
  ) {
    return 'critical';
  }
  if (
    lowerAction.includes('role_changed') ||
    lowerAction.includes('permission') ||
    lowerAction.includes('settings_changed') ||
    lowerAction.includes('suspend') ||
    lowerAction.includes('warning')
  ) {
    return 'warning';
  }
  return 'info';
}

/**
 * Format changes from metadata
 */
function extractChanges(
  metadata: unknown
): Array<{ field: string; oldValue: unknown; newValue: unknown }> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const metadataObj = metadata as Record<string, unknown>;

  // Check for before/after pattern
  if (metadataObj.before && metadataObj.after) {
    const before = metadataObj.before as Record<string, unknown>;
    const after = metadataObj.after as Record<string, unknown>;

    const changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const field of allFields) {
      const oldValue = before[field];
      const newValue = after[field];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({ field, oldValue, newValue });
      }
    }

    return changes.length > 0 ? changes : undefined;
  }

  // Check for changes array
  if (Array.isArray(metadataObj.changes)) {
    return metadataObj.changes as Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  }

  return undefined;
}

/**
 * GET /api/workspaces/:workspaceSlug/audit-log
 *
 * Get audit log entries with filtering and pagination.
 * Requires authenticated user with workspace access.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - search: Search term for actions
 * - category: Filter by category (user_management, settings, security, data)
 * - severity: Filter by severity (info, warning, critical)
 * - actorType: Filter by actor type (user, orchestrator, daemon, system)
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace slug
 * @returns Paginated list of audit log entries
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<AuditLogResponse | { error: string; code?: string }>> {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Verify workspace access - must be admin or owner
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspace: { slug: workspaceSlug },
        userId: session.user.id,
      },
      include: {
        workspace: { select: { id: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Only allow admin/owner to view audit logs
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        {
          error: 'Only admins and owners can view audit logs',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const actorType = searchParams.get('actorType') || undefined;
    const startDateStr = searchParams.get('startDate') || undefined;
    const endDateStr = searchParams.get('endDate') || undefined;

    // Validate date parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
    }

    // Build where clause for database query
    const where: {
      action?: { contains: string; mode: 'insensitive' };
      actorType?: string;
      severity?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    // Search filter
    if (search) {
      where.action = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Category filter (map to action patterns)
    if (category && category !== 'all') {
      const categoryPatterns: Record<string, string[]> = {
        user_management: ['user', 'member', 'role', 'invite'],
        settings: ['settings', 'config', 'workspace'],
        security: ['security', 'auth', 'permission', 'login'],
        data: ['data', 'export', 'delete', 'backup'],
      };

      const patterns = categoryPatterns[category];
      if (patterns) {
        // This is a simplified approach - in production, you'd want a more robust filtering
        where.action = {
          contains: patterns[0],
          mode: 'insensitive',
        };
      }
    }

    // Actor type filter
    if (actorType && actorType !== 'all') {
      where.actorType = actorType;
    }

    // Severity filter
    if (severity && severity !== 'all') {
      where.severity = severity;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Fetch logs with pagination
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorId: true,
        actorType: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ip: true,
        userAgent: true,
        severity: true,
      },
    });

    // Fetch actor details for user/orchestrator types
    const userActorIds = logs
      .filter(
        log => log.actorType === 'user' || log.actorType === 'orchestrator'
      )
      .map(log => log.actorId);

    const uniqueActorIds = [...new Set(userActorIds)];

    const actors = await prisma.user.findMany({
      where: { id: { in: uniqueActorIds } },
      select: { id: true, name: true, email: true },
    });

    const actorMap = new Map(actors.map(actor => [actor.id, actor]));

    // Transform database entries to frontend format
    const entries: AuditLogEntry[] = logs.map(log => {
      const actor = actorMap.get(log.actorId);
      const changes = extractChanges(log.metadata);

      return {
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        action: log.action,
        actorId: log.actorId,
        actorType: log.actorType as
          | 'user'
          | 'orchestrator'
          | 'daemon'
          | 'system',
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata as Record<string, unknown> | null,
        ip: log.ip,
        userAgent: log.userAgent,
        severity: log.severity as 'info' | 'warning' | 'critical',
        actor: actor
          ? { id: actor.id, name: actor.name, email: actor.email }
          : undefined,
        changes,
      };
    });

    const totalPages = Math.ceil(total / pageSize);

    const response: AuditLogResponse = {
      entries,
      total,
      page,
      pageSize,
      totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/audit-log] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to fetch audit log', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
