/**
 * Daemon OrchestratorStatus API Route
 *
 * Handles Orchestrator operational status updates for daemon services.
 *
 * Routes:
 * - PUT /api/daemon/status - Update Orchestrator operational status
 *
 * @module app/api/daemon/status/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Schema for status update request body
 */
const statusUpdateSchema = z.object({
  status: z.enum(['active', 'paused', 'error']),
  message: z.string().optional(),
});

// Type alias exported for potential external use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

/**
 * Error codes for status operations
 */
const STATUS_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  orchestratorId: string;
  daemonId: string;
  scopes: string[];
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Verify daemon token from Authorization header
 */
async function verifyDaemonToken(request: NextRequest): Promise<AccessTokenPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

/**
 * PUT /api/daemon/status - Update Orchestrator operational status
 *
 * Updates the operational status of the Orchestrator (active, paused, error).
 * This is different from presence - it indicates the Orchestrator's operational state.
 *
 * @param request - Next.js request with status data
 * @returns Success status
 *
 * @example
 * ```
 * PUT /api/daemon/status
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "status": "active",
 *   "message": "Processing incoming requests"
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: STATUS_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: STATUS_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = statusUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid status. Must be one of: active, paused, error',
          code: STATUS_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 },
      );
    }

    const { status, message } = parseResult.data;

    // Get Orchestrator info
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: {
        id: true,
        organizationId: true,
        capabilities: true,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Unauthorized', code: STATUS_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Map operational status to Orchestrator status enum (ERROR maps to OFFLINE as ERROR is not in enum)
    const orchestratorDbStatus = status === 'error' ? 'OFFLINE' : status === 'paused' ? 'BUSY' : 'ONLINE';

    // Update Orchestrator with operational status
    const currentCapabilities = (orchestrator.capabilities as Record<string, unknown>) || {};
    await prisma.orchestrator.update({
      where: { id: token.orchestratorId },
      data: {
        status: orchestratorDbStatus,
        capabilities: {
          ...currentCapabilities,
          operationalStatus: status,
          operationalMessage: message || null,
          lastStatusUpdate: new Date().toISOString(),
        },
      },
    });

    // Store operational status in Redis for real-time monitoring
    const statusKey = `daemon:status:${token.orchestratorId}`;
    const statusData = {
      status,
      message: message || null,
      updatedAt: new Date().toISOString(),
      daemonId: token.daemonId,
    };

    try {
      await redis.setex(
        statusKey,
        10 * 60, // 10 minutes TTL
        JSON.stringify(statusData),
      );

      // Publish status update for monitoring dashboards
      await redis.publish(
        `daemon:status:updates:${orchestrator.organizationId}`,
        JSON.stringify({
          type: 'orchestrator_status_update',
          orchestratorId: token.orchestratorId,
          ...statusData,
        }),
      );
    } catch (redisError) {
      console.error('Redis status update error:', redisError);
      // Continue without Redis - database is updated
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/daemon/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update status', code: STATUS_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
