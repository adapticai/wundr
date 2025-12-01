/**
 * Token Budget Alerts API Routes
 *
 * Handles alert configuration and history for token budget monitoring.
 * Supports configuring thresholds and viewing triggered alerts.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/budget/alerts - Get alerts configuration and history
 * - POST /api/orchestrators/:orchestratorId/budget/alerts - Configure alert thresholds
 *
 * @module app/api/orchestrators/[orchestratorId]/budget/alerts/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  configureAlertsSchema,
  createErrorResponse,
  BUDGET_ERROR_CODES,
  alertStatusEnum,
} from '@/lib/validations/token-budget';
import type {
  ConfigureAlertsInput,
  Alert,
  AlertStatus,
} from '@/lib/validations/token-budget';

/**
 * Route context with orchestrator ID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has admin access to an orchestrator
 */
async function getOrchestratorWithAdminCheck(
  orchestratorId: string,
  userId: string
) {
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * Query alert history from database
 */
async function getAlertHistory(
  orchestratorId: string,
  limit: number = 50,
  status?: AlertStatus
): Promise<Alert[]> {
  // This assumes there's a budget_alerts table
  // If not available, this would return empty array or mock data
  const whereClause: Record<string, unknown> = {
    orchestrator_id: orchestratorId,
  };
  if (status) {
    whereClause.status = status;
  }

  const alerts = await prisma.$queryRaw<
    Array<{
      id: string;
      orchestrator_id: string;
      time_window: string;
      usage_percentage: number;
      threshold: number;
      severity: string;
      status: string;
      triggered_at: Date;
      acknowledged_at: Date | null;
      acknowledged_by: string | null;
      resolved_at: Date | null;
      metadata: Record<string, unknown> | null;
    }>
  >`
    SELECT *
    FROM budget_alerts
    WHERE orchestrator_id = ${orchestratorId}
    ${status ? prisma.$queryRaw`AND status = ${status}` : prisma.$queryRaw``}
    ORDER BY triggered_at DESC
    LIMIT ${limit}
  `;

  return alerts.map(alert => ({
    id: alert.id,
    orchestratorId: alert.orchestrator_id,
    timeWindow: alert.time_window as Alert['timeWindow'],
    usagePercentage: alert.usage_percentage,
    threshold: alert.threshold,
    severity: alert.severity as Alert['severity'],
    status: alert.status as AlertStatus,
    triggeredAt: alert.triggered_at,
    acknowledgedAt: alert.acknowledged_at,
    acknowledgedBy: alert.acknowledged_by,
    resolvedAt: alert.resolved_at,
    metadata: alert.metadata ?? undefined,
  }));
}

/**
 * GET /api/orchestrators/:orchestratorId/budget/alerts
 *
 * Get alert configuration and recent alert history for an orchestrator.
 *
 * Query Parameters:
 * - status: Filter alerts by status (ACTIVE, ACKNOWLEDGED, RESOLVED, DISMISSED)
 * - limit: Maximum number of alerts to return (default: 50)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing orchestrator ID
 * @returns Alert configuration and history
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BUDGET_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate orchestrator ID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          BUDGET_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get orchestrator with access check (any member can view alerts)
    const result = await getOrchestratorWithAdminCheck(
      params.orchestratorId,
      session.user.id
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const { orchestrator } = result;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');

    // Validate status if provided
    let status: AlertStatus | undefined;
    if (statusParam) {
      const statusResult = alertStatusEnum.safeParse(statusParam);
      if (!statusResult.success) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid status value',
            BUDGET_ERROR_CODES.VALIDATION_ERROR
          ),
          { status: 400 }
        );
      }
      status = statusResult.data;
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

    // Get alert configuration from charter
    const charter = await prisma.charterVersion.findFirst({
      where: {
        orchestratorId: orchestrator.id,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    const charterData = charter?.charterData as Record<string, unknown> | null;
    const resourceLimits =
      (charterData?.resourceLimits as Record<string, unknown>) ?? {};
    const alertConfig =
      (resourceLimits.budgetAlerts as Record<string, unknown>) ?? {};

    // Get alert history
    const alerts = await getAlertHistory(orchestrator.id, limit, status);

    // Calculate summary statistics
    const activeAlerts = alerts.filter(a => a.status === 'ACTIVE').length;
    const acknowledgedAlerts = alerts.filter(
      a => a.status === 'ACKNOWLEDGED'
    ).length;
    const resolvedAlerts = alerts.filter(a => a.status === 'RESOLVED').length;

    return NextResponse.json({
      data: {
        orchestratorId: orchestrator.id,
        orchestratorName: orchestrator.user.name,
        configuration: {
          thresholds: alertConfig.thresholds ?? [],
          globalSettings: alertConfig.globalSettings ?? {},
        },
        summary: {
          total: alerts.length,
          active: activeAlerts,
          acknowledged: acknowledgedAlerts,
          resolved: resolvedAlerts,
        },
        alerts,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/budget/alerts] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BUDGET_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrators/:orchestratorId/budget/alerts
 *
 * Configure alert thresholds and notification settings for an orchestrator.
 * Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with alert configuration
 * @param context - Route context containing orchestrator ID
 * @returns Updated alert configuration
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BUDGET_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate orchestrator ID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          BUDGET_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          BUDGET_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = configureAlertsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: ConfigureAlertsInput = parseResult.data;

    // Get orchestrator with admin access check
    const result = await getOrchestratorWithAdminCheck(
      params.orchestratorId,
      session.user.id
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const { orchestrator, role } = result;

    // Check for admin/owner role
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to configure alerts',
          BUDGET_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get or create active charter version
    let charter = await prisma.charterVersion.findFirst({
      where: {
        orchestratorId: orchestrator.id,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    // Prepare updated charter data
    const charterData = (charter?.charterData as Record<string, unknown>) ?? {};
    const resourceLimits =
      (charterData.resourceLimits as Record<string, unknown>) ?? {};

    const updatedAlertConfig = {
      thresholds: input.thresholds,
      globalSettings: input.globalSettings ?? {},
      updatedAt: new Date().toISOString(),
    };

    const updatedCharterData = {
      ...charterData,
      resourceLimits: {
        ...resourceLimits,
        budgetAlerts: updatedAlertConfig,
      },
    };

    // Create new charter version with updated alert configuration
    const updatedCharter = await prisma.$transaction(async tx => {
      // Deactivate current active version
      if (charter) {
        await tx.charterVersion.update({
          where: { id: charter.id },
          data: { isActive: false },
        });
      }

      // Create new version
      const nextVersion = (charter?.version ?? 0) + 1;
      return tx.charterVersion.create({
        data: {
          orchestratorId: orchestrator.id,
          charterId: charter?.charterId ?? 'default',
          version: nextVersion,
          charterData: updatedCharterData as Record<string, unknown>,
          changeLog: 'Updated budget alert configuration',
          isActive: true,
        },
      });
    });

    return NextResponse.json({
      data: {
        orchestratorId: orchestrator.id,
        configuration: updatedAlertConfig,
        version: updatedCharter.version,
        updatedAt: updatedCharter.updatedAt,
      },
      message: 'Alert configuration updated successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/orchestrators/:orchestratorId/budget/alerts] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BUDGET_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
