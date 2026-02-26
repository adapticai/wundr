/**
 * Daemon Unregistration API Route
 *
 * Handles daemon unregistration for Orchestrator presence.
 *
 * Routes:
 * - POST /api/daemon/unregister - Unregister a daemon
 *
 * @module app/api/daemon/unregister/route
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
 * Schema for unregistration request body.
 */
const unregisterRequestSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
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
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
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
 * POST /api/daemon/unregister
 *
 * Unregisters a daemon for an Orchestrator.
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
 *   "orchestratorId": "vp_123",
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
        createErrorResponse(
          'Invalid JSON body',
          UNREGISTER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = unregisterRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UNREGISTER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { orchestratorId, apiKey, reason } = parseResult.data;

    // Verify Orchestrator exists
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
          UNREGISTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
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
          UNREGISTER_ERROR_CODES.UNAUTHORIZED
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
          UNREGISTER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const unregisteredAt = new Date().toISOString();

    // Clean up heartbeat key from Redis if available
    const heartbeatKey = `daemon:heartbeat:${orchestratorId}`;

    try {
      const ioredis = await import('ioredis').catch(() => null);
      if (ioredis && process.env.REDIS_URL) {
        const redisClient = new ioredis.default(process.env.REDIS_URL);
        await redisClient.del(heartbeatKey);
        await redisClient.quit();
      } else {
        console.warn(
          '[POST /api/daemon/unregister] Redis unavailable; skipping heartbeat key cleanup',
          { orchestratorId }
        );
      }
    } catch (redisError) {
      console.warn(
        '[POST /api/daemon/unregister] Redis heartbeat cleanup failed; continuing',
        { orchestratorId, error: redisError }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orchestratorId,
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
            UNREGISTER_ERROR_CODES.DAEMON_NOT_REGISTERED
          ),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UNREGISTER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
