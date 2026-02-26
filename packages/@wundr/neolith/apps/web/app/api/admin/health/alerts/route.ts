/**
 * Health Dashboard - Alerts API
 *
 * GET /api/admin/health/alerts - List active health alerts
 * POST /api/admin/health/alerts - Acknowledge alerts
 *
 * Query Parameters (GET):
 * - severity: Filter by severity (info, warning, critical)
 * - type: Filter by alert type
 * - acknowledged: Filter by acknowledged status (true, false)
 * - limit: Max alerts to return (default: 50, max: 200)
 *
 * Body (POST):
 * - alertIds: Array of alert IDs to acknowledge
 *
 * @module app/api/admin/health/alerts/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

type HealthAlertType =
  | 'budget_exhaustion'
  | 'high_error_rate'
  | 'session_failure'
  | 'latency_spike'
  | 'node_unhealthy';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface HealthAlert {
  id: string;
  type: HealthAlertType;
  severity: AlertSeverity;
  message: string;
  orchestratorId?: string;
  timestamp: string;
  acknowledged: boolean;
}

/**
 * Map budget alert level to health alert severity
 */
function mapAlertSeverity(level: string): AlertSeverity {
  switch (level) {
    case 'critical':
    case 'emergency':
      return 'critical';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * GET /api/admin/health/alerts
 *
 * Returns list of active health alerts with optional filtering.
 * Includes budget alerts and system health alerts.
 *
 * Requires admin authentication.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user and check admin role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin in any organization
    const adminMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const severityFilter = searchParams.get('severity') as AlertSeverity | null;
    const typeFilter = searchParams.get('type') as HealthAlertType | null;
    const acknowledgedFilter = searchParams.get('acknowledged');
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );

    // Build where clause for budget alerts
    const budgetWhere: any = {};
    if (acknowledgedFilter !== null) {
      budgetWhere.acknowledged = acknowledgedFilter === 'true';
    }

    // Fetch budget alerts
    const budgetAlerts = await prisma.budgetAlert.findMany({
      where: budgetWhere,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        orchestrator: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Transform budget alerts to health alerts
    let healthAlerts: HealthAlert[] = budgetAlerts.map(alert => ({
      id: alert.id,
      type: 'budget_exhaustion' as HealthAlertType,
      severity: mapAlertSeverity(alert.level),
      message: alert.message,
      orchestratorId: alert.orchestratorId,
      timestamp: alert.createdAt.toISOString(),
      acknowledged: alert.acknowledged,
    }));

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Alert 1: High error rate from audit logs (count > 10 in last hour)
    try {
      const errorLogCount = await (prisma as any).auditLog.count({
        where: {
          createdAt: { gte: oneHourAgo },
          OR: [
            { severity: 'critical' },
            { action: { contains: 'error', mode: 'insensitive' } },
            { action: { contains: 'fail', mode: 'insensitive' } },
          ],
        },
      });

      if (errorLogCount > 10) {
        healthAlerts.push({
          id: crypto.randomUUID(),
          type: 'high_error_rate',
          severity: errorLogCount > 50 ? 'critical' : 'warning',
          message: `High error rate detected: ${errorLogCount} error/failure audit log entries in the last hour`,
          orchestratorId: undefined,
          timestamp: now.toISOString(),
          acknowledged: false,
        });
      }
    } catch (err) {
      console.error(
        '[GET /api/admin/health/alerts] Failed to query audit logs for error rate:',
        err
      );
    }

    // Alert 2: Token budget exhaustion (>90% used)
    try {
      const tokenUsageRecords = await (prisma as any).tokenUsage.findMany({
        where: {
          budgetLimit: { gt: 0 },
        },
        select: {
          orchestratorId: true,
          tokensUsed: true,
          budgetLimit: true,
        },
      });

      for (const record of tokenUsageRecords) {
        const usagePercent = (record.tokensUsed / record.budgetLimit) * 100;
        if (usagePercent > 90) {
          healthAlerts.push({
            id: crypto.randomUUID(),
            type: 'budget_exhaustion',
            severity: usagePercent >= 100 ? 'critical' : 'warning',
            message: `Orchestrator token budget at ${usagePercent.toFixed(1)}% capacity (${record.tokensUsed}/${record.budgetLimit} tokens used)`,
            orchestratorId: record.orchestratorId ?? null,
            timestamp: now.toISOString(),
            acknowledged: false,
          });
        }
      }
    } catch (err) {
      console.error(
        '[GET /api/admin/health/alerts] Failed to query tokenUsage for budget exhaustion:',
        err
      );
    }

    // Alert 3: Orchestrators with no recent audit log activity in last 30 minutes
    try {
      const activeOrchestrators = await (prisma as any).orchestrator.findMany({
        where: {
          status: { notIn: ['OFFLINE', 'DELETED'] },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          user: {
            select: {
              name: true,
              displayName: true,
            },
          },
        },
      });

      for (const orchestrator of activeOrchestrators) {
        try {
          const recentActivityCount = await (prisma as any).auditLog.count({
            where: {
              orchestratorId: orchestrator.id,
              createdAt: { gte: thirtyMinutesAgo },
            },
          });

          if (recentActivityCount === 0) {
            const displayName =
              orchestrator.user?.displayName ||
              orchestrator.user?.name ||
              orchestrator.id;
            healthAlerts.push({
              id: crypto.randomUUID(),
              type: 'node_unhealthy',
              severity: 'warning',
              message: `Orchestrator ${displayName} has no activity in the last 30 minutes`,
              orchestratorId: orchestrator.id,
              timestamp: now.toISOString(),
              acknowledged: false,
            });
          }
        } catch (innerErr) {
          console.error(
            `[GET /api/admin/health/alerts] Failed to check activity for orchestrator ${orchestrator.id}:`,
            innerErr
          );
        }
      }
    } catch (err) {
      console.error(
        '[GET /api/admin/health/alerts] Failed to query orchestrators for node health:',
        err
      );
    }

    // Alert 4: Latency spike (avg response time > 5000ms from recent metrics)
    try {
      const recentMetrics = await (prisma as any).auditLog.findMany({
        where: {
          createdAt: { gte: oneHourAgo },
          metadata: { not: null },
        },
        select: {
          metadata: true,
        },
        take: 500,
      });

      const responseTimes: number[] = recentMetrics
        .map((m: any) => {
          try {
            const meta =
              typeof m.metadata === 'string'
                ? JSON.parse(m.metadata)
                : m.metadata;
            return typeof meta?.responseTime === 'number'
              ? meta.responseTime
              : null;
          } catch {
            return null;
          }
        })
        .filter((t: number | null): t is number => t !== null);

      if (responseTimes.length > 0) {
        const avgResponseTime =
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;

        if (avgResponseTime > 5000) {
          healthAlerts.push({
            id: crypto.randomUUID(),
            type: 'latency_spike',
            severity: avgResponseTime > 10000 ? 'critical' : 'warning',
            message: `Average response time is ${avgResponseTime.toFixed(0)}ms, exceeding the 5000ms threshold`,
            orchestratorId: undefined,
            timestamp: now.toISOString(),
            acknowledged: false,
          });
        }
      }
    } catch (err) {
      console.error(
        '[GET /api/admin/health/alerts] Failed to query audit logs for latency metrics:',
        err
      );
    }

    // Apply filters
    if (severityFilter) {
      healthAlerts = healthAlerts.filter(
        alert => alert.severity === severityFilter
      );
    }

    if (typeFilter) {
      healthAlerts = healthAlerts.filter(alert => alert.type === typeFilter);
    }

    // Sort by timestamp (newest first)
    healthAlerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Limit results
    healthAlerts = healthAlerts.slice(0, limit);

    return NextResponse.json({ data: healthAlerts });
  } catch (error) {
    console.error('[GET /api/admin/health/alerts] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/health/alerts
 *
 * Acknowledge one or more health alerts.
 * Only budget alerts can be acknowledged (system alerts are auto-generated).
 *
 * Requires admin authentication.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user and check admin role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin in any organization
    const adminMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate alertIds
    const { alertIds } = body;
    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: 'alertIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Filter for budget alert IDs (system alerts can't be acknowledged)
    // Budget alerts start with cuid format, system alerts have prefixes
    const budgetAlertIds = alertIds.filter(
      id =>
        typeof id === 'string' &&
        !id.includes('-') === false &&
        !id.startsWith('error-') &&
        !id.startsWith('node-')
    );

    if (budgetAlertIds.length === 0) {
      return NextResponse.json(
        {
          error:
            'No acknowledgeable alerts found. System alerts are auto-generated and cannot be acknowledged.',
        },
        { status: 400 }
      );
    }

    // Acknowledge budget alerts
    const result = await prisma.budgetAlert.updateMany({
      where: {
        id: { in: budgetAlertIds },
        acknowledged: false,
      },
      data: {
        acknowledged: true,
        acknowledgedBy: session.user.id,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `${result.count} alert(s) acknowledged successfully`,
      acknowledgedCount: result.count,
    });
  } catch (error) {
    console.error('[POST /api/admin/health/alerts] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
