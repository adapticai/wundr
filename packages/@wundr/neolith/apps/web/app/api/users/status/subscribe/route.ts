/**
 * Status Subscription API Route
 *
 * Subscribe to real-time status updates for multiple users.
 * This is a convenience endpoint that redirects to the SSE stream.
 *
 * Routes:
 * - POST /api/users/status/subscribe - Subscribe to status updates
 *
 * @module app/api/users/status/subscribe/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  batchPresenceSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { NextRequest } from 'next/server';

/**
 * POST /api/users/status/subscribe
 *
 * Subscribe to real-time status updates for multiple users.
 * Returns the SSE stream URL with appropriate query parameters.
 *
 * @param request - Request with user IDs
 * @returns SSE stream URL
 *
 * @example
 * ```
 * POST /api/users/status/subscribe
 * Content-Type: application/json
 *
 * {
 *   "userIds": ["user_123", "user_456"]
 * }
 *
 * Response:
 * {
 *   "streamUrl": "/api/presence/stream?userIds=user_123,user_456",
 *   "message": "Connect to this URL using EventSource for real-time updates"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid JSON body', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = batchPresenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Validation failed',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { userIds } = parseResult.data;

    // Build SSE stream URL
    const streamUrl = `/api/presence/stream?userIds=${userIds.join(',')}`;

    return NextResponse.json({
      streamUrl,
      message: 'Connect to this URL using EventSource for real-time updates',
      userIds,
    });
  } catch (error) {
    console.error('[POST /api/users/status/subscribe] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
