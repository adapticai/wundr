/**
 * Daemon Configuration API Route
 *
 * Handles configuration retrieval for Orchestrator daemon services.
 *
 * Routes:
 * - GET /api/daemon/config - Get Orchestrator configuration
 *
 * @module app/api/daemon/config/route
 */

import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * JWT configuration
 */
const JWT_SECRET =
  process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for config operations
 */
const CONFIG_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
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
async function verifyDaemonToken(
  request: NextRequest
): Promise<AccessTokenPayload> {
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
 * GET /api/daemon/config - Get Orchestrator configuration
 *
 * Retrieves the full configuration for the Orchestrator daemon including
 * charter, capabilities, and operational settings.
 *
 * @param request - Next.js request with authentication
 * @returns Orchestrator configuration object
 *
 * @example
 * ```
 * GET /api/daemon/config
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: CONFIG_ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Get Orchestrator with full details
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            bio: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        {
          error: 'Orchestrator not found',
          code: CONFIG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        },
        { status: 404 }
      );
    }

    // Parse capabilities (remove sensitive data like API key hash)
    const capabilities =
      (orchestrator.capabilities as Record<string, unknown>) || {};
    const { apiKeyHash: _removed, ...safeCapabilities } = capabilities;

    // Build configuration response
    const config = {
      orchestrator: {
        id: orchestrator.id,
        discipline: orchestrator.discipline,
        role: orchestrator.role,
        status: orchestrator.status,
        daemonEndpoint: orchestrator.daemonEndpoint,
        createdAt: orchestrator.createdAt,
        updatedAt: orchestrator.updatedAt,
      },
      user: orchestrator.user,
      organization: {
        id: orchestrator.organization.id,
        name: orchestrator.organization.name,
        slug: orchestrator.organization.slug,
      },
      capabilities: safeCapabilities,
      charter: safeCapabilities.charter || null,
      operationalConfig: {
        heartbeatIntervalMs: 30000, // 30 seconds
        reconnectDelayMs: 5000, // 5 seconds
        maxReconnectAttempts: 10,
        messageRateLimitPerMinute: 60,
        idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
      },
      scopes: token.scopes,
      endpoints: {
        messages: '/api/daemon/messages',
        channels: '/api/daemon/channels',
        presence: '/api/daemon/presence',
        status: '/api/daemon/status',
        events: '/api/daemon/events',
        heartbeat: '/api/daemon/heartbeat',
      },
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('[GET /api/daemon/config] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get config',
        code: CONFIG_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
}
