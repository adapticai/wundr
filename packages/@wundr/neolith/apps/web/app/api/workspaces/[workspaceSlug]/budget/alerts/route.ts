/**
 * Workspace Budget Alerts API Route
 *
 * Lists and acknowledges BudgetAlert records for orchestrators in a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/budget/alerts
 * - PUT /api/workspaces/:workspaceSlug/budget/alerts
 *
 * @module app/api/workspaces/[workspaceSlug]/budget/alerts/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  BUDGET_ERROR_CODES,
} from '@/lib/validations/token-budget';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const acknowledgeAlertsSchema = z.object({
  alertIds: z.array(z.string()).min(1).max(100),
  dismiss: z.boolean().default(false),
});

const listAlertsQuerySchema = z.object({
  orchestratorId: z.string().optional(),
  acknowledged: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

async function checkWorkspaceAccess(workspaceIdOrSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }] },
    include: { organization: { select: { id: true } } },
  });

  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) return null;

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceSlug/budget/alerts
 *
 * List budget alerts for orchestrators in this workspace.
 *
 * Query Parameters:
 * - orchestratorId: Filter to a specific orchestrator
 * - acknowledged: Filter by acknowledged status (true | false)
 * - limit: Max records (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
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

    const { workspaceSlug } = await context.params;

    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = listAlertsQuerySchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { orchestratorId, acknowledged, limit, offset } = parseResult.data;

    // Resolve orchestrator IDs in workspace's org
    let orchestratorIds: string[];
    if (orchestratorId) {
      const orch = await prisma.orchestrator.findFirst({
        where: {
          id: orchestratorId,
          organizationId: access.workspace.organizationId,
        },
        select: { id: true },
      });
      if (!orch) {
        return NextResponse.json({
          alerts: [],
          total: 0,
          unacknowledgedCount: 0,
        });
      }
      orchestratorIds = [orch.id];
    } else {
      const orchs = await prisma.orchestrator.findMany({
        where: { organizationId: access.workspace.organizationId },
        select: { id: true },
      });
      orchestratorIds = orchs.map(o => o.id);
    }

    const where = {
      orchestratorId: { in: orchestratorIds },
      ...(acknowledged !== undefined && { acknowledged }),
    };

    const [alerts, total, unacknowledgedCount] = await Promise.all([
      prisma.budgetAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          orchestrator: {
            select: {
              id: true,
              role: true,
              discipline: true,
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.budgetAlert.count({ where }),
      prisma.budgetAlert.count({
        where: {
          orchestratorId: { in: orchestratorIds },
          acknowledged: false,
        },
      }),
    ]);

    return NextResponse.json({
      alerts,
      total,
      unacknowledgedCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + alerts.length < total,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/budget/alerts] Error:',
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
 * PUT /api/workspaces/:workspaceSlug/budget/alerts
 *
 * Acknowledge or dismiss budget alerts by ID.
 * Requires org ADMIN or OWNER.
 *
 * Body: { alertIds: string[], dismiss?: boolean }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
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

    const { workspaceSlug } = await context.params;

    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin or owner required.',
          BUDGET_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

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

    const parseResult = acknowledgeAlertsSchema.safeParse(body);
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

    const { alertIds, dismiss } = parseResult.data;

    // Verify alerts belong to orchestrators in this workspace's org
    const orgOrchestrators = await prisma.orchestrator.findMany({
      where: { organizationId: access.workspace.organizationId },
      select: { id: true },
    });
    const orgOrchestratorIds = new Set(orgOrchestrators.map(o => o.id));

    const alerts = await prisma.budgetAlert.findMany({
      where: { id: { in: alertIds } },
      select: { id: true, orchestratorId: true },
    });

    const validAlertIds = alerts
      .filter(a => orgOrchestratorIds.has(a.orchestratorId))
      .map(a => a.id);

    if (validAlertIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'No valid alerts found for this workspace',
          BUDGET_ERROR_CODES.ALERT_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const now = new Date();
    const updated = await prisma.budgetAlert.updateMany({
      where: { id: { in: validAlertIds } },
      data: {
        acknowledged: true,
        acknowledgedBy: dismiss
          ? `dismissed:${session.user.id}`
          : session.user.id,
        acknowledgedAt: now,
      },
    });

    return NextResponse.json({
      updatedCount: updated.count,
      message: dismiss
        ? `${updated.count} alert(s) dismissed`
        : `${updated.count} alert(s) acknowledged`,
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/budget/alerts] Error:',
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
