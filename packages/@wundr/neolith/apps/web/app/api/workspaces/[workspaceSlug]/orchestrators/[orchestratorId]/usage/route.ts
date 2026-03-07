/**
 * Orchestrator Token Usage API Route
 *
 * Retrieves and records token usage for a specific orchestrator within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage
 * - POST /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage
 *
 * @module app/api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/usage/route
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
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
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

const recordUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  model: z.string().min(1),
  sessionId: z.string().optional(),
  taskType: z.string().optional(),
});

const usageQuerySchema = z.object({
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).default(90),
});

async function checkWorkspaceAndOrchestratorAccess(
  workspaceIdOrSlug: string,
  orchestratorIdOrSlug: string,
  userId: string
) {
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

  // Resolve orchestrator – accept ID or slug-style lookup via user email/name
  const orchestrator = await prisma.orchestrator.findFirst({
    where: {
      id: orchestratorIdOrSlug,
      organizationId: workspace.organizationId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      budgetConfig: true,
    },
  });

  if (!orchestrator) return null;

  return { workspace, orgMembership, orchestrator };
}

/**
 * GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage
 *
 * Get usage history for a specific orchestrator.
 *
 * Query Parameters:
 * - period: Aggregation period (hourly | daily | weekly | monthly)
 * - startDate: ISO8601 start date
 * - endDate: ISO8601 end date
 * - limit: Max data points (default 90)
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

    const { workspaceSlug, orchestratorId } = await context.params;

    const access = await checkWorkspaceAndOrchestratorAccess(
      workspaceSlug,
      orchestratorId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = usageQuerySchema.safeParse(searchParams);
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

    const { period, startDate, endDate, limit } = parseResult.data;

    const now = new Date();
    const end: Date = endDate ? new Date(endDate) : now;
    let start: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      start = new Date(now);
      switch (period) {
        case 'hourly':
          start.setHours(start.getHours() - 48);
          break;
        case 'daily':
          start.setDate(start.getDate() - 30);
          break;
        case 'weekly':
          start.setDate(start.getDate() - 84);
          break;
        case 'monthly':
          start.setMonth(start.getMonth() - 12);
          break;
      }
    }

    const usageRecords = await prisma.tokenUsage.findMany({
      where: {
        orchestratorId: access.orchestrator.id,
        createdAt: { gte: start, lte: end },
      },
      select: {
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cost: true,
        sessionId: true,
        taskType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit * 1000, // fetch raw records for aggregation
    });

    // Aggregate by period bucket
    const bucketMap = new Map<
      string,
      {
        date: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
        requestCount: number;
      }
    >();

    for (const record of usageRecords) {
      const date = record.createdAt;
      let bucketKey: string;

      switch (period) {
        case 'hourly':
          bucketKey = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours()
          ).toISOString();
          break;
        case 'weekly': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          bucketKey = weekStart.toISOString();
          break;
        }
        case 'monthly':
          bucketKey = new Date(
            date.getFullYear(),
            date.getMonth(),
            1
          ).toISOString();
          break;
        default: // daily
          bucketKey = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          ).toISOString();
          break;
      }

      const existing = bucketMap.get(bucketKey) ?? {
        date: bucketKey,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        requestCount: 0,
      };

      const recordCost =
        record.cost !== null
          ? Number(record.cost)
          : calculateCost(
              record.model,
              record.inputTokens,
              record.outputTokens
            );

      bucketMap.set(bucketKey, {
        date: bucketKey,
        inputTokens: existing.inputTokens + record.inputTokens,
        outputTokens: existing.outputTokens + record.outputTokens,
        totalTokens: existing.totalTokens + record.totalTokens,
        cost: existing.cost + recordCost,
        requestCount: existing.requestCount + 1,
      });
    }

    const breakdown = Array.from(bucketMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-limit);

    const totalTokens = usageRecords.reduce((s, r) => s + r.totalTokens, 0);
    const totalCost = breakdown.reduce((s, b) => s + b.cost, 0);
    const config = access.orchestrator.budgetConfig;

    return NextResponse.json({
      orchestrator: {
        id: access.orchestrator.id,
        name: access.orchestrator.user.name,
        role: access.orchestrator.role,
        discipline: access.orchestrator.discipline,
      },
      summary: {
        totalTokens,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        requestCount: usageRecords.length,
        periodStart: start,
        periodEnd: end,
      },
      budgetConfig: config
        ? {
            hourlyLimit: config.hourlyLimit,
            dailyLimit: config.dailyLimit,
            monthlyLimit: config.monthlyLimit,
            autoPause: config.autoPause,
            alertThresholds: config.alertThresholds,
          }
        : null,
      breakdown: breakdown.map(b => ({
        ...b,
        cost: Math.round(b.cost * 1000000) / 1000000,
      })),
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage] Error:',
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
 * POST /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage
 *
 * Record token usage for an orchestrator session.
 * Typically called by the daemon after each session completes.
 *
 * Body: { inputTokens, outputTokens, model, sessionId?, taskType? }
 *
 * Also checks budget thresholds and creates BudgetAlert records if exceeded.
 */
export async function POST(
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

    const { workspaceSlug, orchestratorId } = await context.params;

    const access = await checkWorkspaceAndOrchestratorAccess(
      workspaceSlug,
      orchestratorId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
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

    const parseResult = recordUsageSchema.safeParse(body);
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
    const totalTokens = input.inputTokens + input.outputTokens;
    const cost = calculateCost(
      input.model,
      input.inputTokens,
      input.outputTokens
    );

    // Record the usage
    const usageRecord = await prisma.tokenUsage.create({
      data: {
        orchestratorId: access.orchestrator.id,
        sessionId: input.sessionId,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        cost,
        taskType: input.taskType,
      },
    });

    // Check budget thresholds and create alerts if needed
    const config = access.orchestrator.budgetConfig;
    if (config) {
      const now = new Date();

      // Check hourly usage
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      const hourlyUsage = await prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: access.orchestrator.id,
          createdAt: { gte: hourStart },
        },
        _sum: { totalTokens: true },
      });
      const hourlyTotal = hourlyUsage._sum.totalTokens ?? 0;
      const hourlyPercent = (hourlyTotal / config.hourlyLimit) * 100;

      // Check daily usage
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dailyUsage = await prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: access.orchestrator.id,
          createdAt: { gte: dayStart },
        },
        _sum: { totalTokens: true },
      });
      const dailyTotal = dailyUsage._sum.totalTokens ?? 0;
      const dailyPercent = (dailyTotal / config.dailyLimit) * 100;

      // Check monthly usage
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      const monthlyUsage = await prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: access.orchestrator.id,
          createdAt: { gte: monthStart },
        },
        _sum: { totalTokens: true },
      });
      const monthlyTotal = monthlyUsage._sum.totalTokens ?? 0;
      const monthlyPercent = (monthlyTotal / config.monthlyLimit) * 100;

      const thresholds = (config.alertThresholds as number[]) ?? [50, 75, 90];

      // Create alerts for threshold crossings (dedup: only one unacknowledged per threshold level)
      const alertChecks = [
        { period: 'hourly', percent: hourlyPercent, current: hourlyTotal },
        { period: 'daily', percent: dailyPercent, current: dailyTotal },
        { period: 'monthly', percent: monthlyPercent, current: monthlyTotal },
      ];

      for (const check of alertChecks) {
        for (const threshold of thresholds) {
          if (check.percent >= threshold) {
            const level =
              threshold >= 90
                ? 'critical'
                : threshold >= 75
                  ? 'warning'
                  : 'info';

            // Check for existing unacknowledged alert for same period+threshold
            const existingAlert = await prisma.budgetAlert.findFirst({
              where: {
                orchestratorId: access.orchestrator.id,
                threshold,
                level,
                acknowledged: false,
                message: { contains: check.period },
              },
            });

            if (!existingAlert) {
              await prisma.budgetAlert.create({
                data: {
                  orchestratorId: access.orchestrator.id,
                  level,
                  threshold,
                  currentUsage: check.current,
                  message: `${check.period} token usage at ${Math.round(check.percent)}% of budget limit (${check.current.toLocaleString()} / ${check.period === 'hourly' ? config.hourlyLimit : check.period === 'daily' ? config.dailyLimit : config.monthlyLimit})`,
                  acknowledged: false,
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        usageRecord: {
          id: usageRecord.id,
          orchestratorId: usageRecord.orchestratorId,
          model: usageRecord.model,
          inputTokens: usageRecord.inputTokens,
          outputTokens: usageRecord.outputTokens,
          totalTokens: usageRecord.totalTokens,
          cost: Number(usageRecord.cost),
          sessionId: usageRecord.sessionId,
          createdAt: usageRecord.createdAt,
        },
        message: 'Token usage recorded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/usage] Error:',
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
