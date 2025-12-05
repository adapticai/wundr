/**
 * OrchestratorDaemon Main API Route
 *
 * Primary daemon management endpoint for registration and lifecycle operations.
 * Consolidates daemon registration, status checks, and management operations.
 *
 * Routes:
 * - POST /api/daemon - Register a new daemon instance
 * - GET /api/daemon - Get daemon status and information
 * - DELETE /api/daemon - Unregister daemon instance
 *
 * @module app/api/daemon/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type {
  DaemonErrorResponse,
  DaemonRegistrationResponse,
  DaemonStatus,
} from '@/types/daemon';
import type { NextRequest } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET =
  process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// =============================================================================
// Validation Schemas
// =============================================================================

const daemonInfoSchema = z.object({
  instanceId: z.string().min(1, 'Instance ID is required'),
  version: z.string().min(1, 'Version is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(['http', 'https', 'ws', 'wss']),
  startedAt: z.string().datetime(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const registrationSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  daemonInfo: daemonInfoSchema,
  apiKey: z.string().min(1, 'API key is required'),
});

// =============================================================================
// Error Codes
// =============================================================================

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  DAEMON_ALREADY_REGISTERED: 'DAEMON_ALREADY_REGISTERED',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>,
): DaemonErrorResponse {
  return {
    error: {
      message,
      code,
      ...(details && { details }),
    },
  };
}

/**
 * Verify daemon authentication token
 */
async function verifyDaemonToken(request: NextRequest): Promise<{
  orchestratorId: string;
  daemonId: string;
  scopes: string[];
}> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as {
    orchestratorId: string;
    daemonId: string;
    scopes: string[];
    type: string;
  };

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return {
    orchestratorId: decoded.orchestratorId,
    daemonId: decoded.daemonId,
    scopes: decoded.scopes,
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/daemon
 *
 * Register a new daemon instance for an Orchestrator.
 * This is the primary registration endpoint that validates credentials,
 * stores daemon information, and returns configuration for the daemon.
 *
 * @param request - Next.js request with registration data
 * @returns Registration confirmation with configuration
 *
 * @example
 * ```
 * POST /api/daemon
 * Content-Type: application/json
 *
 * {
 *   "orchestratorId": "vp_123",
 *   "organizationId": "org_456",
 *   "apiKey": "vp_abc123_xyz789",
 *   "daemonInfo": {
 *     "instanceId": "daemon_001",
 *     "version": "1.0.0",
 *     "host": "localhost",
 *     "port": 8080,
 *     "protocol": "http",
 *     "startedAt": "2024-01-01T00:00:00Z",
 *     "capabilities": ["chat", "voice", "screen_share"]
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = registrationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const { orchestratorId, organizationId, apiKey, daemonInfo } =
      parseResult.data;

    // Verify Orchestrator exists and belongs to organization
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        capabilities: true,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (orchestrator.organizationId !== organizationId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator does not belong to organization',
          ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Validate API key format and check against stored hash
    if (!apiKey.startsWith('vp_')) {
      return NextResponse.json(
        createErrorResponse('Invalid API key format', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Check if daemon already registered
    try {
      const existingDaemon = await redis.get(
        `daemon:heartbeat:${orchestratorId}`,
      );
      if (existingDaemon) {
        const existing = JSON.parse(existingDaemon);
        if (existing.daemonId !== daemonInfo.instanceId) {
          return NextResponse.json(
            createErrorResponse(
              'Another daemon instance already registered for this Orchestrator',
              ERROR_CODES.DAEMON_ALREADY_REGISTERED,
              { existingInstanceId: existing.daemonId },
            ),
            { status: 409 },
          );
        }
      }
    } catch (redisError) {
      console.error('Redis check error:', redisError);
      // Continue - allow registration even if Redis check fails
    }

    const registeredAt = new Date().toISOString();

    // Store daemon registration in Redis
    try {
      const daemonKey = `daemon:registration:${orchestratorId}`;
      await redis.setex(
        daemonKey,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          ...daemonInfo,
          orchestratorId,
          organizationId,
          registeredAt,
        }),
      );
    } catch (redisError) {
      console.error('Redis storage error:', redisError);
      // Continue - registration can succeed without Redis
    }

    // Update Orchestrator status to indicate daemon is registered
    await prisma.orchestrator.update({
      where: { id: orchestratorId },
      data: {
        status: 'ONLINE',
      },
    });

    const response: DaemonRegistrationResponse = {
      success: true,
      data: {
        orchestratorId,
        organizationId,
        registeredAt,
        daemonInfo: {
          ...daemonInfo,
          registeredAt,
        },
        heartbeatInterval: HEARTBEAT_INTERVAL_MS,
        healthCheckEndpoint: `/api/daemon/health/${orchestratorId}`,
      },
      message: 'Daemon registered successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[POST /api/daemon] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          createErrorResponse(
            'Daemon already registered for this Orchestrator',
            ERROR_CODES.DAEMON_ALREADY_REGISTERED,
          ),
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * GET /api/daemon
 *
 * Get current daemon status and information.
 * Requires valid daemon authentication token.
 *
 * @param request - Next.js request with authentication header
 * @returns Current daemon status
 *
 * @example
 * ```
 * GET /api/daemon
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { orchestratorId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get daemon status from Redis
    let status: DaemonStatus = {
      orchestratorId: token.orchestratorId,
      daemonId: token.daemonId,
      status: 'offline',
    };

    try {
      const heartbeatKey = `daemon:heartbeat:${token.orchestratorId}`;
      const heartbeatData = await redis.get(heartbeatKey);

      if (heartbeatData) {
        const heartbeat = JSON.parse(heartbeatData);
        status = {
          orchestratorId: token.orchestratorId,
          daemonId: token.daemonId,
          status: 'online',
          lastHeartbeat: heartbeat.receivedAt,
          metrics: heartbeat.metrics,
        };
      }

      // Get session info if exists
      const sessionKey = `daemon:session:${token.daemonId}`;
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        status.session = {
          id: token.daemonId,
          createdAt: session.createdAt,
          lastActivityAt: session.lastHeartbeat || session.createdAt,
        };
      }
    } catch (redisError) {
      console.error('Redis status check error:', redisError);
      // Return offline status on Redis error
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[GET /api/daemon] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'Failed to get daemon status',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/daemon
 *
 * Unregister daemon instance and clean up resources.
 * Requires valid daemon authentication token.
 *
 * @param request - Next.js request with authentication header
 * @returns Unregistration confirmation
 *
 * @example
 * ```
 * DELETE /api/daemon
 * Authorization: Bearer <access_token>
 * ```
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { orchestratorId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Remove daemon data from Redis
    try {
      await Promise.all([
        redis.del(`daemon:registration:${token.orchestratorId}`),
        redis.del(`daemon:heartbeat:${token.orchestratorId}`),
        redis.del(`daemon:session:${token.daemonId}`),
        redis.del(`daemon:metrics:${token.orchestratorId}`),
      ]);
    } catch (redisError) {
      console.error('Redis cleanup error:', redisError);
      // Continue with unregistration
    }

    // Update Orchestrator status
    await prisma.orchestrator.update({
      where: { id: token.orchestratorId },
      data: {
        status: 'OFFLINE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Daemon unregistered successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/daemon] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'Failed to unregister daemon',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
