/**
 * Token Budget API Routes
 *
 * Handles token budget management for orchestrators including
 * retrieving current budget status and updating budget limits.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/budget - Get budget status
 * - PATCH /api/orchestrators/:orchestratorId/budget - Update budget limits
 *
 * @module app/api/orchestrators/[orchestratorId]/budget/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  updateBudgetLimitsSchema,
  createErrorResponse,
  BUDGET_ERROR_CODES,
  timeWindowEnum,
} from '@/lib/validations/token-budget';

import type {
  UpdateBudgetLimitsInput,
  BudgetStatus,
  TimeWindow,
} from '@/lib/validations/token-budget';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestrator ID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has admin access to an orchestrator
 * Returns the orchestrator if accessible, null otherwise
 */
async function getOrchestratorWithAdminCheck(
  orchestratorId: string,
  userId: string,
) {
  // Get user's organization memberships
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  // Fetch orchestrator and verify organization access
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
          email: true,
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

  // Find user's role in the orchestrator's organization
  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId,
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * Calculate time window boundaries
 */
function getTimeWindowBounds(window: TimeWindow): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (window) {
    case 'HOURLY':
      start.setMinutes(0, 0, 0);
      end.setHours(start.getHours() + 1);
      break;
    case 'DAILY':
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 1);
      break;
    case 'WEEKLY':
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 7);
      break;
    case 'MONTHLY':
      start.setHours(0, 0, 0, 0);
      start.setDate(1);
      end.setMonth(start.getMonth() + 1);
      break;
    case 'YEARLY':
      start.setHours(0, 0, 0, 0);
      start.setMonth(0, 1);
      end.setFullYear(start.getFullYear() + 1);
      break;
  }

  return { start, end };
}

/**
 * Calculate usage statistics for a time window
 */
async function calculateWindowUsage(
  orchestratorId: string,
  window: TimeWindow,
  limit: number | null,
): Promise<BudgetStatus | null> {
  if (!limit) {
    return null;
  }

  const { start, end } = getTimeWindowBounds(window);

  // Query token usage from database
  // This assumes there's a TokenUsage table/model tracking usage
  // If not available, this would need to be implemented
  const usage = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COALESCE(SUM(tokens_used), 0) as total
    FROM token_usage
    WHERE orchestrator_id = ${orchestratorId}
    AND created_at >= ${start}
    AND created_at < ${end}
  `;

  const currentUsage = Number(usage[0]?.total ?? 0);
  const remaining = Math.max(0, limit - currentUsage);
  const usagePercentage =
    limit > 0 ? Math.min(100, (currentUsage / limit) * 100) : 0;

  // Calculate projection based on elapsed time in window
  const windowDuration = end.getTime() - start.getTime();
  const elapsed = Date.now() - start.getTime();
  const projectedUsage =
    elapsed > 0
      ? Math.round((currentUsage / elapsed) * windowDuration)
      : currentUsage;
  const willExceedBudget = projectedUsage > limit;

  return {
    currentUsage,
    limit,
    remaining,
    usagePercentage: Math.round(usagePercentage * 100) / 100,
    timeWindow: window,
    windowStart: start,
    windowEnd: end,
    projectedUsage,
    willExceedBudget,
  };
}

/**
 * GET /api/orchestrators/:orchestratorId/budget
 *
 * Get current budget status for an orchestrator including usage,
 * remaining budget, and projections across all time windows.
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestrator ID
 * @returns Budget status for all configured time windows
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BUDGET_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate orchestrator ID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get orchestrator with access check (any member can view budget)
    const result = await getOrchestratorWithAdminCheck(
      params.orchestratorId,
      session.user.id,
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const { orchestrator } = result;

    // Get budget configuration from orchestrator's charter
    // Assuming budget limits are stored in the charter's resourceLimits
    const charter = await prisma.charterVersion.findFirst({
      where: {
        orchestratorId: orchestrator.id,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    // Extract budget limits from charter data
    const charterData = charter?.charterData as Record<string, unknown> | null;
    const resourceLimits =
      (charterData?.resourceLimits as Record<string, unknown>) ?? {};
    const budgetLimits =
      (resourceLimits.tokenBudget as Record<string, number | null>) ?? {};

    // Calculate usage for each time window
    const budgetStatuses: Partial<Record<TimeWindow, BudgetStatus>> = {};

    for (const window of timeWindowEnum.options) {
      const limitKey = `${window.toLowerCase()}Limit` as const;
      const limit = budgetLimits[limitKey] as number | null;

      if (limit) {
        const status = await calculateWindowUsage(
          orchestrator.id,
          window,
          limit,
        );
        if (status) {
          budgetStatuses[window] = status;
        }
      }
    }

    return NextResponse.json({
      data: {
        orchestratorId: orchestrator.id,
        orchestratorName: orchestrator.user.name,
        budgetStatuses,
        limits: budgetLimits,
        lastUpdated: charter?.updatedAt ?? charter?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/budget] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BUDGET_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/orchestrators/:orchestratorId/budget
 *
 * Update budget limits for an orchestrator.
 * Requires authentication and admin/owner role in the orchestrator's organization.
 *
 * @param request - Next.js request with budget limit updates
 * @param context - Route context containing orchestrator ID
 * @returns Updated budget configuration
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BUDGET_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate orchestrator ID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
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
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateBudgetLimitsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateBudgetLimitsInput = parseResult.data;

    // Get orchestrator with admin access check
    const result = await getOrchestratorWithAdminCheck(
      params.orchestratorId,
      session.user.id,
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const { orchestrator, role } = result;

    // Check for admin/owner role
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update budget limits',
          BUDGET_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get or create active charter version
    const charter = await prisma.charterVersion.findFirst({
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
    const tokenBudget =
      (resourceLimits.tokenBudget as Record<string, unknown>) ?? {};

    // Update budget limits
    const updatedTokenBudget = {
      ...tokenBudget,
      ...(input.hourlyLimit !== undefined && {
        hourlyLimit: input.hourlyLimit,
      }),
      ...(input.dailyLimit !== undefined && { dailyLimit: input.dailyLimit }),
      ...(input.weeklyLimit !== undefined && {
        weeklyLimit: input.weeklyLimit,
      }),
      ...(input.monthlyLimit !== undefined && {
        monthlyLimit: input.monthlyLimit,
      }),
      ...(input.yearlyLimit !== undefined && {
        yearlyLimit: input.yearlyLimit,
      }),
    };

    const updatedCharterData = {
      ...charterData,
      resourceLimits: {
        ...resourceLimits,
        tokenBudget: updatedTokenBudget,
      },
    };

    // Create new charter version with updated budget
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
          charterData: updatedCharterData as Prisma.InputJsonValue,
          changeLog: 'Updated token budget limits',
          isActive: true,
          createdBy: session.user.id,
        },
      });
    });

    return NextResponse.json({
      data: {
        orchestratorId: orchestrator.id,
        limits: updatedTokenBudget,
        version: updatedCharter.version,
        updatedAt: updatedCharter.updatedAt,
      },
      message: 'Budget limits updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/orchestrators/:orchestratorId/budget] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BUDGET_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
