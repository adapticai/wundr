/**
 * Workspace Token Usage Summary API Route
 *
 * Returns aggregated token usage and cost breakdown across all orchestrators
 * in a workspace for a given time period.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/budget/usage
 *
 * @module app/api/workspaces/[workspaceSlug]/budget/usage/route
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
 * Model pricing in USD per 1,000 tokens
 * Based on Anthropic published rates (input / output)
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
  // Normalize model string - strip version suffixes for lookup
  const normalizedModel = model.toLowerCase();
  let pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    // Fallback: match by prefix
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

const usageQuerySchema = z.object({
  orchestratorId: z.string().optional(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

async function checkWorkspaceAccess(workspaceIdOrSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }] },
    include: {
      organization: { select: { id: true } },
    },
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
 * GET /api/workspaces/:workspaceSlug/budget/usage
 *
 * Get token usage summary for a workspace, optionally filtered by orchestrator.
 *
 * Query Parameters:
 * - orchestratorId: Filter to a specific orchestrator
 * - period: Aggregation period (hourly | daily | weekly | monthly) - default: daily
 * - startDate: ISO8601 start date (default: start of current period)
 * - endDate: ISO8601 end date (default: now)
 *
 * @returns { totalTokens, totalCost, breakdown: [{ date, inputTokens, outputTokens, cost }] }
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

    // Parse and validate query params
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

    const { orchestratorId, period, startDate, endDate } = parseResult.data;

    // Build date range
    const now = new Date();
    let start: Date;
    const end: Date = endDate ? new Date(endDate) : now;

    if (startDate) {
      start = new Date(startDate);
    } else {
      start = new Date(now);
      switch (period) {
        case 'hourly':
          start.setHours(start.getHours() - 24);
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

    // Get orchestrators in this workspace's organization
    const orchestratorWhere = orchestratorId
      ? { id: orchestratorId, organizationId: access.workspace.organizationId }
      : { organizationId: access.workspace.organizationId };

    const orchestrators = await prisma.orchestrator.findMany({
      where: orchestratorWhere,
      select: { id: true },
    });

    const orchestratorIds = orchestrators.map(o => o.id);

    if (orchestratorIds.length === 0) {
      return NextResponse.json({
        totalTokens: 0,
        totalCost: 0,
        breakdown: [],
      });
    }

    // Fetch raw usage records
    const usageRecords = await prisma.tokenUsage.findMany({
      where: {
        orchestratorId: { in: orchestratorIds },
        createdAt: { gte: start, lte: end },
      },
      select: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cost: true,
        model: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by period
    const bucketMap = new Map<
      string,
      { date: string; inputTokens: number; outputTokens: number; cost: number }
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
        cost: 0,
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
        cost: existing.cost + recordCost,
      });
    }

    const breakdown = Array.from(bucketMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalTokens = usageRecords.reduce((s, r) => s + r.totalTokens, 0);
    const totalCost = breakdown.reduce((s, b) => s + b.cost, 0);

    return NextResponse.json({
      totalTokens,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      breakdown: breakdown.map(b => ({
        ...b,
        cost: Math.round(b.cost * 1000000) / 1000000,
      })),
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/budget/usage] Error:',
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
