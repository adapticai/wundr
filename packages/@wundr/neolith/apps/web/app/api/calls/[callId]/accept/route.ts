/**
 * Call Accept API Route
 *
 * Handles accepting an incoming call.
 *
 * Route:
 * - POST /api/calls/:callId/accept - Accept the call
 *
 * @module app/api/calls/[callId]/accept/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { callIdParamSchema, CALL_ERROR_CODES } from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with call ID parameter
 */
interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/accept
 *
 * Accept an incoming call and update its status.
 *
 * @param request - Next.js request
 * @param context - Route context with call ID
 * @returns Success response
 */
export async function POST(
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
          CALL_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate call ID parameter
    const params = await context.params;
    const parseResult = callIdParamSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid call ID',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const { callId } = parseResult.data;

    // Get call details
    const calls = await prisma.$queryRaw<
      Array<{
        id: string;
        channel_id: string;
        status: string;
        type: string;
      }>
    >`
      SELECT id, channel_id, status, type FROM calls WHERE id = ${callId} LIMIT 1
    `;

    if (calls.length === 0) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    const call = calls[0];

    // Verify user is a participant in the channel
    const channelMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: call.channel_id,
          userId: session.user.id,
        },
      },
    });

    if (!channelMember) {
      return NextResponse.json(
        createErrorResponse(
          'Not authorized to join this call',
          CALL_ERROR_CODES.PERMISSION_DENIED,
        ),
        { status: 403 },
      );
    }

    // Check if call is in a valid state to accept
    if (!['pending', 'ringing', 'active'].includes(call.status)) {
      return NextResponse.json(
        createErrorResponse(
          'Call is no longer available',
          CALL_ERROR_CODES.CALL_ALREADY_ENDED,
        ),
        { status: 409 },
      );
    }

    // Update call status to active if it's still pending/ringing
    if (call.status === 'pending' || call.status === 'ringing') {
      await prisma.$executeRaw`
        UPDATE calls
        SET status = 'active',
            started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${callId}
          AND status IN ('pending', 'ringing')
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Call accepted',
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/accept] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
