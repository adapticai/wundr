/**
 * Daemon Heartbeat API Route
 *
 * Handles heartbeat signals from VP daemons.
 *
 * Routes:
 * - POST /api/daemon/heartbeat - Send a heartbeat
 *
 * @module app/api/daemon/heartbeat/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Schema for heartbeat metrics.
 */
const heartbeatMetricsSchema = z.object({
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  activeConnections: z.number().int().min(0),
  messageQueueSize: z.number().int().min(0),
  lastMessageAt: z.string().datetime().optional(),
  avgResponseTimeMs: z.number().min(0).optional(),
  totalMessagesProcessed: z.number().int().min(0).optional(),
  errorCount: z.number().int().min(0).optional(),
  custom: z.record(z.union([z.number(), z.string()])).optional(),
});

/**
 * Schema for heartbeat request body.
 */
const heartbeatRequestSchema = z.object({
  vpId: z.string().min(1, 'VP ID is required'),
  metrics: heartbeatMetricsSchema.optional(),
  apiKey: z.string().min(1, 'API key is required'),
});

// =============================================================================
// Error Codes
// =============================================================================

const HEARTBEAT_ERROR_CODES = {
  VALIDATION_ERROR: 'HEARTBEAT_VALIDATION_ERROR',
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
  details?: Record<string, unknown>
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
 * POST /api/daemon/heartbeat
 *
 * Receives a heartbeat from a VP daemon.
 * Requires daemon API key authentication.
 *
 * @param request - Next.js request with heartbeat data
 * @returns Success response or error
 *
 * @example
 * ```
 * POST /api/daemon/heartbeat
 * Content-Type: application/json
 *
 * {
 *   "vpId": "vp_123",
 *   "apiKey": "gns_abc123...",
 *   "metrics": {
 *     "cpuUsage": 45,
 *     "memoryUsage": 60,
 *     "activeConnections": 10,
 *     "messageQueueSize": 5
 *   }
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
        createErrorResponse('Invalid JSON body', HEARTBEAT_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = heartbeatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          HEARTBEAT_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { vpId, apiKey, metrics } = parseResult.data;

    // TODO: Validate API key against VP's stored key hash
    // This would use vpService.validateAPIKey(apiKey)
    // For now, we'll just check if the key starts with the expected prefix
    if (!apiKey.startsWith('gns_')) {
      return NextResponse.json(
        createErrorResponse('Invalid API key', HEARTBEAT_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // TODO: Get Redis client and heartbeat service
    // const redis = getRedisClient();
    // const heartbeatService = createHeartbeatService(redis);
    // await heartbeatService.sendHeartbeat(vpId, metrics);

    // For now, return success with timestamp
    const timestamp = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        vpId,
        timestamp,
        received: true,
        nextExpectedAt: new Date(Date.now() + 30000).toISOString(), // 30 seconds
      },
    });
  } catch (error) {
    console.error('[POST /api/daemon/heartbeat] Error:', error);

    // Handle known errors
    if (error instanceof Error) {
      if (error.message.includes('not registered')) {
        return NextResponse.json(
          createErrorResponse(
            'Daemon not registered',
            HEARTBEAT_ERROR_CODES.DAEMON_NOT_REGISTERED
          ),
          { status: 404 }
        );
      }
      if (error.message.includes('VP not found')) {
        return NextResponse.json(
          createErrorResponse('VP not found', HEARTBEAT_ERROR_CODES.VP_NOT_FOUND),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        HEARTBEAT_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
