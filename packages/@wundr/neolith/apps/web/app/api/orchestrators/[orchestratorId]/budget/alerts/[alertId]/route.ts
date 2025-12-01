/**
 * Individual Alert API Routes
 *
 * Handles operations on specific budget alerts including
 * acknowledging, resolving, and dismissing alerts.
 *
 * Routes:
 * - PATCH /api/orchestrators/:orchestratorId/budget/alerts/:alertId - Acknowledge/update alert
 *
 * @module app/api/orchestrators/[orchestratorId]/budget/alerts/[alertId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  alertIdParamSchema,
  acknowledgeAlertSchema,
  createErrorResponse,
  BUDGET_ERROR_CODES,
} from '@/lib/validations/token-budget';
import type { AcknowledgeAlertInput } from '@/lib/validations/token-budget';

/**
 * Route context with orchestrator ID and alert ID parameters
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string; alertId: string }>;
}

/**
 * Helper function to check if user has access to an orchestrator
 */
async function getOrchestratorWithAccessCheck(
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
 * PATCH /api/orchestrators/:orchestratorId/budget/alerts/:alertId
 *
 * Acknowledge or update the status of a specific budget alert.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request with acknowledgement data
 * @param context - Route context containing orchestrator ID and alert ID
 * @returns Updated alert object
 */
export async function PATCH(
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

    // Validate parameters
    const params = await context.params;
    const orchestratorParamResult = orchestratorIdParamSchema.safeParse({
      orchestratorId: params.orchestratorId,
    });
    const alertParamResult = alertIdParamSchema.safeParse({
      alertId: params.alertId,
    });

    if (!orchestratorParamResult.success || !alertParamResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameter format',
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
    const parseResult = acknowledgeAlertSchema.safeParse(body);
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

    const input: AcknowledgeAlertInput = parseResult.data;

    // Get orchestrator with access check
    const result = await getOrchestratorWithAccessCheck(
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

    // Get the alert
    // This assumes there's a budget_alerts table
    const alert = await prisma.$queryRaw<
      Array<{
        id: string;
        orchestrator_id: string;
        status: string;
        triggered_at: Date;
        acknowledged_at: Date | null;
      }>
    >`
      SELECT *
      FROM budget_alerts
      WHERE id = ${params.alertId}
        AND orchestrator_id = ${orchestrator.id}
      LIMIT 1
    `;

    if (!alert || alert.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Alert not found',
          BUDGET_ERROR_CODES.ALERT_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const alertData = alert[0];

    // Check if alert is already acknowledged
    if (
      alertData.status === 'ACKNOWLEDGED' ||
      alertData.status === 'RESOLVED'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Alert has already been acknowledged or resolved',
          BUDGET_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Update alert status
    const now = new Date();
    const metadata = input.note
      ? {
          acknowledgedNote: input.note,
          ...(input.suppressSimilar && {
            suppressSimilar: true,
            suppressionDurationMinutes: input.suppressionDurationMinutes,
            suppressUntil: new Date(
              now.getTime() +
                (input.suppressionDurationMinutes ?? 60) * 60 * 1000
            ).toISOString(),
          }),
        }
      : {};

    await prisma.$executeRaw`
      UPDATE budget_alerts
      SET
        status = 'ACKNOWLEDGED',
        acknowledged_at = ${now},
        acknowledged_by = ${session.user.id},
        metadata = ${JSON.stringify(metadata)}
      WHERE id = ${params.alertId}
    `;

    // Fetch updated alert
    const updatedAlert = await prisma.$queryRaw<
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
      WHERE id = ${params.alertId}
      LIMIT 1
    `;

    const updated = updatedAlert[0];

    return NextResponse.json({
      data: {
        id: updated.id,
        orchestratorId: updated.orchestrator_id,
        timeWindow: updated.time_window,
        usagePercentage: updated.usage_percentage,
        threshold: updated.threshold,
        severity: updated.severity,
        status: updated.status,
        triggeredAt: updated.triggered_at,
        acknowledgedAt: updated.acknowledged_at,
        acknowledgedBy: updated.acknowledged_by,
        resolvedAt: updated.resolved_at,
        metadata: updated.metadata,
      },
      message: 'Alert acknowledged successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/orchestrators/:orchestratorId/budget/alerts/:alertId] Error:',
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
