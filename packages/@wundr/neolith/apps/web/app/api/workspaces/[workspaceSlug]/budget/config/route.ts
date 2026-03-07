/**
 * Workspace Budget Configuration API Route
 *
 * Manages BudgetConfig records for orchestrators within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/budget/config
 * - PUT /api/workspaces/:workspaceSlug/budget/config
 *
 * @module app/api/workspaces/[workspaceSlug]/budget/config/route
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

const updateBudgetConfigSchema = z.object({
  orchestratorId: z.string(),
  hourlyLimit: z.number().int().positive().optional(),
  dailyLimit: z.number().int().positive().optional(),
  monthlyLimit: z.number().int().positive().optional(),
  autoPause: z.boolean().optional(),
  alertThresholds: z.array(z.number().min(0).max(100)).max(10).optional(),
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
 * GET /api/workspaces/:workspaceSlug/budget/config
 *
 * Returns budget configurations for all orchestrators in the workspace.
 * Each orchestrator record includes current BudgetConfig or default values.
 */
export async function GET(
  _request: NextRequest,
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

    // Fetch all orchestrators in organization with their budget configs
    const orchestrators = await prisma.orchestrator.findMany({
      where: { organizationId: access.workspace.organizationId },
      select: {
        id: true,
        role: true,
        discipline: true,
        status: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        budgetConfig: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const configs = orchestrators.map(orch => ({
      orchestratorId: orch.id,
      orchestratorName: orch.user.name,
      orchestratorEmail: orch.user.email,
      orchestratorAvatarUrl: orch.user.avatarUrl,
      role: orch.role,
      discipline: orch.discipline,
      status: orch.status,
      config: orch.budgetConfig
        ? {
            id: orch.budgetConfig.id,
            hourlyLimit: orch.budgetConfig.hourlyLimit,
            dailyLimit: orch.budgetConfig.dailyLimit,
            monthlyLimit: orch.budgetConfig.monthlyLimit,
            autoPause: orch.budgetConfig.autoPause,
            alertThresholds: orch.budgetConfig.alertThresholds,
            updatedAt: orch.budgetConfig.updatedAt,
          }
        : {
            id: null,
            hourlyLimit: 100000,
            dailyLimit: 1000000,
            monthlyLimit: 10000000,
            autoPause: true,
            alertThresholds: [50, 75, 90],
            updatedAt: null,
          },
    }));

    return NextResponse.json({ configs });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/budget/config] Error:',
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
 * PUT /api/workspaces/:workspaceSlug/budget/config
 *
 * Create or update BudgetConfig for a specific orchestrator.
 * Requires org ADMIN or OWNER.
 *
 * Body: { orchestratorId, hourlyLimit?, dailyLimit?, monthlyLimit?, autoPause?, alertThresholds? }
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

    const parseResult = updateBudgetConfigSchema.safeParse(body);
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

    const input = parseResult.data;

    // Verify orchestrator belongs to workspace's organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: input.orchestratorId,
        organizationId: access.workspace.organizationId,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found in this workspace',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Upsert the BudgetConfig
    const config = await prisma.budgetConfig.upsert({
      where: { orchestratorId: input.orchestratorId },
      create: {
        orchestratorId: input.orchestratorId,
        hourlyLimit: input.hourlyLimit ?? 100000,
        dailyLimit: input.dailyLimit ?? 1000000,
        monthlyLimit: input.monthlyLimit ?? 10000000,
        autoPause: input.autoPause ?? true,
        alertThresholds: input.alertThresholds ?? [50, 75, 90],
      },
      update: {
        ...(input.hourlyLimit !== undefined && {
          hourlyLimit: input.hourlyLimit,
        }),
        ...(input.dailyLimit !== undefined && { dailyLimit: input.dailyLimit }),
        ...(input.monthlyLimit !== undefined && {
          monthlyLimit: input.monthlyLimit,
        }),
        ...(input.autoPause !== undefined && { autoPause: input.autoPause }),
        ...(input.alertThresholds !== undefined && {
          alertThresholds: input.alertThresholds,
        }),
      },
    });

    return NextResponse.json({
      config,
      message: 'Budget configuration updated successfully',
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/budget/config] Error:',
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
