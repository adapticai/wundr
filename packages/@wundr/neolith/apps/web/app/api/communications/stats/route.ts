/**
 * Communication Statistics API Route
 *
 * Routes:
 * - GET /api/communications/stats - Aggregate communication log statistics
 *
 * @module app/api/communications/stats/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  communicationStatsFilterSchema,
  COMMUNICATION_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/communication';

import type { NextRequest } from 'next/server';

/**
 * GET /api/communications/stats
 *
 * Return aggregated communication statistics: counts by channel, direction,
 * status, and the overall delivery rate.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          COMMUNICATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = communicationStatsFilterSchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          COMMUNICATION_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const { orchestratorId, dateFrom, dateTo } = parseResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (orchestratorId) where.orchestratorId = orchestratorId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;

    // Run all group-by aggregations in parallel
    const [byChannelRaw, byDirectionRaw, byStatusRaw] = await Promise.all([
      db.communicationLog.groupBy({
        by: ['channel'],
        where,
        _count: { _all: true },
      }),
      db.communicationLog.groupBy({
        by: ['direction'],
        where,
        _count: { _all: true },
      }),
      db.communicationLog.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    // Collapse grouped results into plain objects
    const byChannel: Record<string, number> = {};
    for (const row of byChannelRaw) {
      byChannel[row.channel] = row._count._all;
    }

    const byDirection: Record<string, number> = {};
    for (const row of byDirectionRaw) {
      byDirection[row.direction] = row._count._all;
    }

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count._all;
    }

    const totalMessages = Object.values(byStatus).reduce(
      (sum, n) => sum + n,
      0
    );

    // Delivery rate = delivered / (sent + delivered + failed + bounced)
    const delivered = byStatus['delivered'] ?? 0;
    const denominator =
      (byStatus['sent'] ?? 0) +
      delivered +
      (byStatus['failed'] ?? 0) +
      (byStatus['bounced'] ?? 0);
    const deliveryRate = denominator > 0 ? delivered / denominator : 0;

    return NextResponse.json({
      data: {
        totalMessages,
        byChannel,
        byDirection,
        byStatus,
        deliveryRate,
        averageDeliveryTimeMs: null, // Requires sentAt/deliveredAt timestamps — not aggregated here
      },
    });
  } catch (error) {
    console.error('[GET /api/communications/stats] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        COMMUNICATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
