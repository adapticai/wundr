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
import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

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
        { status: 401 },
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
        { status: 403 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const severityFilter = searchParams.get('severity') as AlertSeverity | null;
    const typeFilter = searchParams.get('type') as HealthAlertType | null;
    const acknowledgedFilter = searchParams.get('acknowledged');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

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

    // TODO: Add system health alerts from audit logs
    // Check for high error rates, session failures, latency spikes, etc.
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Detect high error rate (>10% in last hour)
    const [totalLogs, errorLogs] = await Promise.all([
      prisma.auditLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneHourAgo },
          severity: { in: ['error', 'critical'] },
        },
      }),
    ]);

    if (totalLogs > 0) {
      const errorRate = (errorLogs / totalLogs) * 100;
      if (errorRate > 10) {
        healthAlerts.push({
          id: `error-rate-${now.getTime()}`,
          type: 'high_error_rate',
          severity: errorRate > 25 ? 'critical' : 'warning',
          message: `High error rate detected: ${errorRate.toFixed(1)}% of requests failing`,
          timestamp: now.toISOString(),
          acknowledged: false,
        });
      }
    }

    // Detect unhealthy orchestrators (OFFLINE or AWAY status)
    const unhealthyOrchestrators = await prisma.orchestrator.findMany({
      where: {
        status: { in: ['OFFLINE', 'AWAY'] },
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

    // Only alert on orchestrators that have been offline for more than 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    unhealthyOrchestrators
      .filter(o => o.updatedAt < fiveMinutesAgo)
      .forEach(orchestrator => {
        healthAlerts.push({
          id: `node-${orchestrator.id}`,
          type: 'node_unhealthy',
          severity: orchestrator.status === 'OFFLINE' ? 'critical' : 'warning',
          message: `Orchestrator ${orchestrator.user?.displayName || orchestrator.user?.name} is ${orchestrator.status.toLowerCase()}`,
          orchestratorId: orchestrator.id,
          timestamp: now.toISOString(),
          acknowledged: false,
        });
      });

    // Apply filters
    if (severityFilter) {
      healthAlerts = healthAlerts.filter(alert => alert.severity === severityFilter);
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
      { status: 500 },
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
        { status: 401 },
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
        { status: 403 },
      );
    }

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    // Validate alertIds
    const { alertIds } = body;
    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: 'alertIds must be a non-empty array' },
        { status: 400 },
      );
    }

    // Filter for budget alert IDs (system alerts can't be acknowledged)
    // Budget alerts start with cuid format, system alerts have prefixes
    const budgetAlertIds = alertIds.filter(id =>
      typeof id === 'string' && !id.includes('-') === false && !id.startsWith('error-') && !id.startsWith('node-')
    );

    if (budgetAlertIds.length === 0) {
      return NextResponse.json(
        { error: 'No acknowledgeable alerts found. System alerts are auto-generated and cannot be acknowledged.' },
        { status: 400 },
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
      { status: 500 },
    );
  }
}
