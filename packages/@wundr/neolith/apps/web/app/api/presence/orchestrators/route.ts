/**
 * OrchestratorPresence List API Route
 *
 * Get presence status for all VPs in an organization.
 *
 * Routes:
 * - GET /api/presence/orchestrators?organizationId= - Get Orchestrator presence list
 *
 * @module app/api/presence/orchestrators/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  organizationIdQuerySchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { VPPresenceResponse } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Check if user is online based on last activity
 */
function isUserOnline(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) {
return false;
}
  return Date.now() - lastActiveAt.getTime() < OFFLINE_THRESHOLD_MS;
}

/**
 * GET /api/presence/orchestrators?organizationId=
 *
 * Get presence status for all VPs in an organization.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request with organizationId query parameter
 * @returns Array of Orchestrator presence statuses
 *
 * @example
 * ```
 * GET /api/presence/orchestrators?organizationId=org_123
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "orchestratorId": "vp_123",
 *       "userId": "user_456",
 *       "status": "ONLINE",
 *       "lastActivity": "2024-01-15T10:30:00Z",
 *       "isHealthy": true,
 *       "messageCount": 1523
 *     },
 *     {
 *       "orchestratorId": "vp_456",
 *       "userId": "user_789",
 *       "status": "BUSY",
 *       "lastActivity": "2024-01-15T10:25:00Z",
 *       "isHealthy": true,
 *       "messageCount": 892
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = organizationIdQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'organizationId query parameter is required',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { organizationId } = parseResult.data;

    // Check if user has access to the organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Access denied to this organization',
          PRESENCE_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get all VPs in the organization
    const orchestrators = await prisma.vP.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            lastActiveAt: true,
          },
        },
      },
    });

    // Get message counts for all VPs
    const vpUserIds = orchestrators.map((orchestrator) => orchestrator.userId);
    const messageCounts = await prisma.message.groupBy({
      by: ['authorId'],
      where: { authorId: { in: vpUserIds } },
      _count: { id: true },
    });

    const messageCountMap = new Map(
      messageCounts.map((mc) => [mc.authorId, mc._count?.id ?? 0]),
    );

    // Build Orchestrator presence responses
    const responses: VPPresenceResponse[] = orchestrators.map((orchestrator) => ({
      vpId: orchestrator.id,
      userId: orchestrator.userId,
      status: orchestrator.status as VPPresenceResponse['status'],
      lastActivity: orchestrator.user.lastActiveAt?.toISOString() ?? null,
      isHealthy: orchestrator.status === 'ONLINE' && isUserOnline(orchestrator.user.lastActiveAt),
      messageCount: messageCountMap.get(orchestrator.userId) ?? 0,
    }));

    return NextResponse.json({
      data: responses,
    });
  } catch (error) {
    console.error('[GET /api/orchestrators] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
