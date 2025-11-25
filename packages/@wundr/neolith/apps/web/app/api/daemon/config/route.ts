/**
 * Daemon Configuration API Route
 *
 * Handles configuration retrieval for VP daemon services.
 *
 * Routes:
 * - GET /api/daemon/config - Get VP configuration
 *
 * @module app/api/daemon/config/route
 */

import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for config operations
 */
const CONFIG_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  vpId: string;
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
 * GET /api/daemon/config - Get VP configuration
 *
 * Retrieves the full configuration for the VP daemon including
 * charter, capabilities, and operational settings.
 *
 * @param request - Next.js request with authentication
 * @returns VP configuration object
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
        { status: 401 },
      );
    }

    // Get VP with full details
    const vp = await prisma.vP.findUnique({
      where: { id: token.vpId },
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

    if (!vp) {
      return NextResponse.json(
        { error: 'VP not found', code: CONFIG_ERROR_CODES.VP_NOT_FOUND },
        { status: 404 },
      );
    }

    // Parse capabilities (remove sensitive data like API key hash)
    const capabilities = (vp.capabilities as Record<string, unknown>) || {};
    const { apiKeyHash: _removed, ...safeCapabilities } = capabilities;

    // Build configuration response
    const config = {
      vp: {
        id: vp.id,
        discipline: vp.discipline,
        role: vp.role,
        status: vp.status,
        daemonEndpoint: vp.daemonEndpoint,
        createdAt: vp.createdAt,
        updatedAt: vp.updatedAt,
      },
      user: vp.user,
      organization: {
        id: vp.organization.id,
        name: vp.organization.name,
        slug: vp.organization.slug,
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
      { error: 'Failed to get config', code: CONFIG_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
