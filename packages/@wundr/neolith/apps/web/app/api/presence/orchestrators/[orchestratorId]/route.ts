/**
 * OrchestratorPresence API Route
 *
 * Get presence and health status for a specific Orchestrator.
 *
 * Routes:
 * - GET /api/presence/orchestrators/:orchestratorId - Get Orchestrator presence
 *
 * @module app/api/presence/orchestrators/[orchestratorId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { OrchestratorPresenceResponse } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

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
 * GET /api/presence/orchestrators/:orchestratorId
 *
 * Get presence and health status for a specific Orchestrator.
 * Requires authentication.
 *
 * @param request - Next.js request object
 * @param context - Route context with orchestratorId parameter
 * @returns Orchestrator presence and health status
 *
 * @example
 * ```
 * GET /api/presence/orchestrators/orch_123
 *
 * Response:
 * {
 *   "data": {
 *     "orchestratorId": "vp_123",
 *     "userId": "user_456",
 *     "status": "ONLINE",
 *     "lastActivity": "2024-01-15T10:30:00Z",
 *     "isHealthy": true,
 *     "messageCount": 1523
 *   }
 * }
 * ```
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
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid OrchestratorID format', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with user info
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: params.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            lastActiveAt: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createPresenceErrorResponse('Orchestrator not found', PRESENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND),
        { status: 404 },
      );
    }

    // Get message count for Orchestrator
    const messageCount = await prisma.message.count({
      where: { authorId: orchestrator.userId },
    });

    // Determine if Orchestrator is healthy (online and recent activity)
    const isHealthy = orchestrator.status === 'ONLINE' && isUserOnline(orchestrator.user.lastActiveAt);

    const response: OrchestratorPresenceResponse = {
      orchestratorId: orchestrator.id,
      userId: orchestrator.userId,
      status: orchestrator.status as OrchestratorPresenceResponse['status'],
      lastActivity: orchestrator.user.lastActiveAt?.toISOString() ?? null,
      isHealthy,
      messageCount,
    };

    return NextResponse.json({
      data: response,
    });
  } catch (error) {
    console.error('[GET /api/presence/orchestrators/:orchestratorId] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
