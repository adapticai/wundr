/**
 * Workspace Budget Report API Route
 *
 * Generates aggregated budget reports for a workspace, including:
 * - Usage by orchestrator, discipline, and model
 * - Cost projections based on current run rate
 * - Budget utilization percentages
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/budget/report
 *
 * @module app/api/workspaces/[workspaceSlug]/budget/report/route
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

/**
 * Model pricing in USD per 1,000 tokens (input / output)
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 0.015, output: 0.075 },
  'claude-opus-4-5': { input: 0.015, output: 0.075 },
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const normalizedModel = model.toLowerCase();
  let pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(
      k => normalizedModel.startsWith(k) || k.startsWith(normalizedModel)
    );
    pricing = key ? MODEL_PRICING[key] : { input: 0.003, output: 0.015 };
  }

  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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
 * GET /api/workspaces/:workspaceSlug/budget/report
 *
 * Generate a comprehensive budget report for the workspace.
 *
 * Query Parameters:
 * - startDate: ISO8601 start date (default: start of current month)
 * - endDate: ISO8601 end date (default: now)
 *
 * Returns:
 * - summary: totals and projections
 * - byOrchestrator: usage breakdown per orchestrator
 * - byDiscipline: aggregated by discipline
 * - byModel: aggregated by AI model
 * - budgetUtilization: per-orchestrator utilization percentages
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
    const parseResult = reportQuerySchema.safeParse(searchParams);
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

    const { startDate, endDate } = parseResult.data;

    const now = new Date();
    const end: Date = endDate ? new Date(endDate) : now;
    const start: Date = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Fetch all orchestrators in the workspace's organization
    const orchestrators = await prisma.orchestrator.findMany({
      where: { organizationId: access.workspace.organizationId },
      select: {
        id: true,
        role: true,
        discipline: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        budgetConfig: true,
      },
    });

    if (orchestrators.length === 0) {
      return NextResponse.json({
        summary: {
          totalTokens: 0,
          totalCost: 0,
          projectedMonthlyCost: 0,
          periodStart: start,
          periodEnd: end,
        },
        byOrchestrator: [],
        byDiscipline: [],
        byModel: [],
        budgetUtilization: [],
      });
    }

    const orchestratorIds = orchestrators.map(o => o.id);
    const orchestratorMap = new Map(orchestrators.map(o => [o.id, o]));

    // Fetch usage records for the period
    const usageRecords = await prisma.tokenUsage.findMany({
      where: {
        orchestratorId: { in: orchestratorIds },
        createdAt: { gte: start, lte: end },
      },
      select: {
        orchestratorId: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cost: true,
        createdAt: true,
      },
    });

    // ---- Aggregation by orchestrator ----
    const byOrchestratorMap = new Map<
      string,
      {
        orchestratorId: string;
        name: string;
        role: string;
        discipline: string;
        avatarUrl: string | null;
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
        sessionCount: number;
      }
    >();

    // ---- Aggregation by model ----
    const byModelMap = new Map<
      string,
      {
        model: string;
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
        requestCount: number;
      }
    >();

    for (const record of usageRecords) {
      const orch = orchestratorMap.get(record.orchestratorId);
      if (!orch) continue;

      const recordCost =
        record.cost !== null
          ? Number(record.cost)
          : calculateCost(
              record.model,
              record.inputTokens,
              record.outputTokens
            );

      // Orchestrator aggregation
      const existing = byOrchestratorMap.get(record.orchestratorId) ?? {
        orchestratorId: record.orchestratorId,
        name: orch.user.name ?? 'Unknown',
        role: orch.role,
        discipline: orch.discipline,
        avatarUrl: orch.user.avatarUrl,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        sessionCount: 0,
      };

      byOrchestratorMap.set(record.orchestratorId, {
        ...existing,
        totalTokens: existing.totalTokens + record.totalTokens,
        inputTokens: existing.inputTokens + record.inputTokens,
        outputTokens: existing.outputTokens + record.outputTokens,
        totalCost: existing.totalCost + recordCost,
        sessionCount: existing.sessionCount + 1,
      });

      // Model aggregation
      const modelKey = record.model.toLowerCase();
      const existingModel = byModelMap.get(modelKey) ?? {
        model: record.model,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        requestCount: 0,
      };

      byModelMap.set(modelKey, {
        ...existingModel,
        totalTokens: existingModel.totalTokens + record.totalTokens,
        inputTokens: existingModel.inputTokens + record.inputTokens,
        outputTokens: existingModel.outputTokens + record.outputTokens,
        totalCost: existingModel.totalCost + recordCost,
        requestCount: existingModel.requestCount + 1,
      });
    }

    // ---- Aggregation by discipline ----
    const byDisciplineMap = new Map<
      string,
      {
        discipline: string;
        orchestratorCount: number;
        totalTokens: number;
        totalCost: number;
      }
    >();

    for (const [, orchStats] of byOrchestratorMap) {
      const existing = byDisciplineMap.get(orchStats.discipline) ?? {
        discipline: orchStats.discipline,
        orchestratorCount: 0,
        totalTokens: 0,
        totalCost: 0,
      };

      byDisciplineMap.set(orchStats.discipline, {
        ...existing,
        orchestratorCount: existing.orchestratorCount + 1,
        totalTokens: existing.totalTokens + orchStats.totalTokens,
        totalCost: existing.totalCost + orchStats.totalCost,
      });
    }

    // Also include disciplines with zero usage
    for (const orch of orchestrators) {
      if (!byDisciplineMap.has(orch.discipline)) {
        byDisciplineMap.set(orch.discipline, {
          discipline: orch.discipline,
          orchestratorCount: 0,
          totalTokens: 0,
          totalCost: 0,
        });
      }
    }

    // ---- Cost projection ----
    const totalCost = Array.from(byOrchestratorMap.values()).reduce(
      (s, o) => s + o.totalCost,
      0
    );
    const totalTokens = Array.from(byOrchestratorMap.values()).reduce(
      (s, o) => s + o.totalTokens,
      0
    );

    const periodMs = end.getTime() - start.getTime();
    const elapsedMs = Math.min(now.getTime() - start.getTime(), periodMs);
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const projectedMonthlyCost =
      elapsedMs > 0 ? (totalCost / elapsedMs) * monthMs : 0;

    // ---- Budget utilization ----
    const budgetUtilization = orchestrators.map(orch => {
      const orchStats = byOrchestratorMap.get(orch.id);
      const config = orch.budgetConfig;
      const usedTokens = orchStats?.totalTokens ?? 0;

      const monthlyLimit = config?.monthlyLimit ?? 10000000;
      const dailyLimit = config?.dailyLimit ?? 1000000;

      // Monthly utilization based on period usage
      const periodDays = periodMs / (24 * 60 * 60 * 1000);
      const monthlyEquivalentTokens =
        periodDays > 0 ? (usedTokens / periodDays) * 30 : 0;

      return {
        orchestratorId: orch.id,
        orchestratorName: orch.user.name ?? 'Unknown',
        role: orch.role,
        discipline: orch.discipline,
        usedTokens,
        monthlyLimit,
        dailyLimit,
        monthlyUtilizationPercent: Math.min(
          (monthlyEquivalentTokens / monthlyLimit) * 100,
          100
        ),
        alertThresholds: config?.alertThresholds ?? [50, 75, 90],
        autoPause: config?.autoPause ?? true,
      };
    });

    return NextResponse.json({
      summary: {
        totalTokens,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        projectedMonthlyCost:
          Math.round(projectedMonthlyCost * 1000000) / 1000000,
        periodStart: start,
        periodEnd: end,
        orchestratorCount: orchestrators.length,
        activeOrchestratorCount: byOrchestratorMap.size,
      },
      byOrchestrator: Array.from(byOrchestratorMap.values())
        .sort((a, b) => b.totalCost - a.totalCost)
        .map(o => ({
          ...o,
          totalCost: Math.round(o.totalCost * 1000000) / 1000000,
        })),
      byDiscipline: Array.from(byDisciplineMap.values())
        .sort((a, b) => b.totalCost - a.totalCost)
        .map(d => ({
          ...d,
          totalCost: Math.round(d.totalCost * 1000000) / 1000000,
        })),
      byModel: Array.from(byModelMap.values())
        .sort((a, b) => b.totalCost - a.totalCost)
        .map(m => ({
          ...m,
          totalCost: Math.round(m.totalCost * 1000000) / 1000000,
        })),
      budgetUtilization: budgetUtilization.sort(
        (a, b) => b.monthlyUtilizationPercent - a.monthlyUtilizationPercent
      ),
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/budget/report] Error:',
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
