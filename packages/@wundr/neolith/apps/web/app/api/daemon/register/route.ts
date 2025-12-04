/**
 * Daemon Registration API Route
 *
 * Handles daemon registration for Orchestrator presence.
 *
 * Routes:
 * - POST /api/daemon/register - Register a daemon
 *
 * @module app/api/daemon/register/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Schema for daemon info.
 */
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

/**
 * Schema for registration request body.
 */
const registerRequestSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  daemonInfo: daemonInfoSchema,
  apiKey: z.string().min(1, 'API key is required'),
});

// =============================================================================
// Error Codes
// =============================================================================

const REGISTER_ERROR_CODES = {
  VALIDATION_ERROR: 'REGISTER_VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  DAEMON_ALREADY_REGISTERED: 'DAEMON_ALREADY_REGISTERED',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
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
 * POST /api/daemon/register
 *
 * Registers a daemon for an Orchestrator.
 * Requires daemon API key authentication.
 *
 * @param request - Next.js request with registration data
 * @returns Registration confirmation or error
 *
 * @example
 * ```
 * POST /api/daemon/register
 * Content-Type: application/json
 *
 * {
 *   "orchestratorId": "orch_123",
 *   "organizationId": "org_456",
 *   "apiKey": "gns_abc123...",
 *   "daemonInfo": {
 *     "instanceId": "daemon_xyz",
 *     "version": "1.0.0",
 *     "host": "localhost",
 *     "port": 8080,
 *     "protocol": "http",
 *     "startedAt": "2024-01-01T00:00:00Z",
 *     "capabilities": ["chat", "voice"]
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
        createErrorResponse(
          'Invalid JSON body',
          REGISTER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = registerRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          REGISTER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { orchestratorId, organizationId, apiKey, daemonInfo } =
      parseResult.data;

    // TODO: Validate API key against Orchestrator's stored key hash
    // This would use orchestratorService.validateAPIKey(apiKey)
    if (!apiKey.startsWith('gns_')) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid API key',
          REGISTER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // TODO: Verify Orchestrator exists and belongs to the organization
    // const orchestrator = await orchestratorService.getOrchestrator(orchestratorId);
    // if (!orchestrator || orchestrator.organizationId !== organizationId) {...}

    // TODO: Get Redis client and heartbeat service
    // const redis = getRedisClient();
    // const heartbeatService = createHeartbeatService(redis);
    // await heartbeatService.registerDaemon(orchestratorId, {
    //   ...daemonInfo,
    //   startedAt: new Date(daemonInfo.startedAt),
    // });

    const registeredAt = new Date().toISOString();

    return NextResponse.json(
      {
        success: true,
        data: {
          orchestratorId,
          organizationId,
          registeredAt,
          daemonInfo: {
            ...daemonInfo,
            registeredAt,
          },
          heartbeatInterval: 30000, // 30 seconds
          healthCheckEndpoint: `/api/daemon/health/${orchestratorId}`,
        },
        message: 'Daemon registered successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/daemon/register] Error:', error);

    // Handle known errors
    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          createErrorResponse(
            'Daemon already registered for this Orchestrator',
            REGISTER_ERROR_CODES.DAEMON_ALREADY_REGISTERED
          ),
          { status: 409 }
        );
      }
      if (error.message.includes('Orchestrator not found')) {
        return NextResponse.json(
          createErrorResponse(
            'Orchestrator not found',
            REGISTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
          ),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        REGISTER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
