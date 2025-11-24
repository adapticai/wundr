/**
 * VP Presence API Route
 *
 * Get presence and health status for a specific VP.
 *
 * Routes:
 * - GET /api/presence/vps/:vpId - Get VP presence
 *
 * @module app/api/presence/vps/[vpId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpIdParamSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { VPPresenceResponse } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Route context with vpId parameter
 */
interface RouteContext {
  params: Promise<{ vpId: string }>;
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
 * GET /api/presence/vps/:vpId
 *
 * Get presence and health status for a specific VP.
 * Requires authentication.
 *
 * @param request - Next.js request object
 * @param context - Route context with vpId parameter
 * @returns VP presence and health status
 *
 * @example
 * ```
 * GET /api/presence/vps/vp_123
 *
 * Response:
 * {
 *   "data": {
 *     "vpId": "vp_123",
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

    // Validate vpId parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid VP ID format', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get VP with user info
    const vp = await prisma.vP.findUnique({
      where: { id: params.vpId },
      include: {
        user: {
          select: {
            id: true,
            lastActiveAt: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createPresenceErrorResponse('VP not found', PRESENCE_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Get message count for VP
    const messageCount = await prisma.message.count({
      where: { userId: vp.userId },
    });

    // Determine if VP is healthy (online and recent activity)
    const isHealthy = vp.status === 'ONLINE' && isUserOnline(vp.user.lastActiveAt);

    const response: VPPresenceResponse = {
      vpId: vp.id,
      userId: vp.userId,
      status: vp.status as VPPresenceResponse['status'],
      lastActivity: vp.user.lastActiveAt?.toISOString() ?? null,
      isHealthy,
      messageCount,
    };

    return NextResponse.json({
      data: response,
    });
  } catch (error) {
    console.error('[GET /api/presence/vps/:vpId] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
