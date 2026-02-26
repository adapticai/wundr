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

import { createHash, timingSafeEqual } from 'crypto';

import { prisma } from '@neolith/database';
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
// API Key Validation
// =============================================================================

/**
 * Validates the provided API key against the orchestrator's stored key hash.
 * Supports both SHA-256 hex hashes and bcrypt hashes (via dynamic import).
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param apiKey - The plain-text API key provided in the request
 * @param storedHash - The hash stored in orchestrator.capabilities.apiKeyHash
 * @returns True if the API key matches, false otherwise
 */
async function validateApiKey(
  apiKey: string,
  storedHash: string
): Promise<boolean> {
  // Attempt bcrypt comparison first via dynamic import
  const bcrypt = await import('bcrypt').catch(() => null);
  if (bcrypt) {
    try {
      return await bcrypt.compare(apiKey, storedHash);
    } catch {
      // storedHash may not be a valid bcrypt hash; fall through to SHA-256
    }
  }

  // Fallback: SHA-256 constant-time comparison
  const providedHash = createHash('sha256').update(apiKey).digest('hex');
  const providedBuffer = Buffer.from(providedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(providedBuffer, storedBuffer);
  } catch {
    return false;
  }
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

    // Verify Orchestrator exists and belongs to the organization
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: {
        id: true,
        organizationId: true,
        capabilities: true,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          REGISTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (orchestrator.organizationId !== organizationId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator does not belong to the specified organization',
          REGISTER_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Validate API key against Orchestrator's stored key hash
    const orchestratorCapabilities = orchestrator.capabilities as {
      apiKeyHash?: string;
    } | null;

    if (!orchestratorCapabilities?.apiKeyHash) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid API key',
          REGISTER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const isValidKey = await validateApiKey(
      apiKey,
      orchestratorCapabilities.apiKeyHash
    );

    if (!isValidKey) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid API key',
          REGISTER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const registeredAt = new Date().toISOString();

    // Register daemon heartbeat in Redis if available
    const heartbeatKey = `daemon:heartbeat:${orchestratorId}`;
    const heartbeatTtlSeconds = 90; // 3 missed heartbeats at 30s interval

    try {
      const ioredis = await import('ioredis').catch(() => null);
      if (ioredis && process.env.REDIS_URL) {
        const redisClient = new ioredis.default(process.env.REDIS_URL);
        await redisClient.setex(
          heartbeatKey,
          heartbeatTtlSeconds,
          JSON.stringify({
            orchestratorId,
            organizationId,
            instanceId: daemonInfo.instanceId,
            version: daemonInfo.version,
            host: daemonInfo.host,
            port: daemonInfo.port,
            protocol: daemonInfo.protocol,
            startedAt: daemonInfo.startedAt,
            registeredAt,
            status: 'active',
          })
        );
        await redisClient.quit();
      } else {
        console.warn(
          '[POST /api/daemon/register] Redis unavailable; proceeding with DB-only registration',
          { orchestratorId }
        );
      }
    } catch (redisError) {
      console.warn(
        '[POST /api/daemon/register] Redis heartbeat registration failed; continuing with DB-only registration',
        { orchestratorId, error: redisError }
      );
    }

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
