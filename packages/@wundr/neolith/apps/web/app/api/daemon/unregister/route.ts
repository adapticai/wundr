/**
 * Daemon Unregistration API Route
 *
 * Handles daemon unregistration for VP presence.
 *
 * Routes:
 * - POST /api/daemon/unregister - Unregister a daemon
 *
 * @module app/api/daemon/unregister/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Schema for unregistration request body.
 */
const unregisterRequestSchema = z.object({
  vpId: z.string().min(1, 'VP ID is required'),
  apiKey: z.string().min(1, 'API key is required'),
  reason: z.enum(['shutdown', 'error', 'maintenance', 'unknown']).optional(),
});

// =============================================================================
// Error Codes
// =============================================================================

const UNREGISTER_ERROR_CODES = {
  VALIDATION_ERROR: 'UNREGISTER_VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  DAEMON_NOT_REGISTERED: 'DAEMON_NOT_REGISTERED',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Creates a standardized error response.
 */
function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return {
    error: {
      message,
      code,
      ...(details && { details }),
    },
  };
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/daemon/unregister
 *
 * Unregisters a daemon for a VP.
 * Requires daemon API key authentication.
 *
 * @param request - Next.js request with unregistration data
 * @returns Success confirmation or error
 *
 * @example
 * ```
 * POST /api/daemon/unregister
 * Content-Type: application/json
 *
 * {
 *   "vpId": "vp_123",
 *   "apiKey": "gns_abc123...",
 *   "reason": "shutdown"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', UNREGISTER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = unregisterRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UNREGISTER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { vpId, apiKey, reason } = parseResult.data;

    // TODO: Validate API key against VP's stored key hash
    if (!apiKey.startsWith('gns_')) {
      return NextResponse.json(
        createErrorResponse('Invalid API key', UNREGISTER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // TODO: Get Redis client and heartbeat service
    // const redis = getRedisClient();
    // const heartbeatService = createHeartbeatService(redis);
    // await heartbeatService.unregisterDaemon(vpId);

    const unregisteredAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        vpId,
        unregisteredAt,
        reason: reason ?? 'unknown',
      },
      message: 'Daemon unregistered successfully',
    });
  } catch (error) {
    console.error('[POST /api/daemon/unregister] Error:', error);

    // Handle known errors
    if (error instanceof Error) {
      if (error.message.includes('not registered')) {
        return NextResponse.json(
          createErrorResponse(
            'Daemon not registered',
            UNREGISTER_ERROR_CODES.DAEMON_NOT_REGISTERED,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UNREGISTER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
