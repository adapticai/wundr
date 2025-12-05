/**
 * Daemon Authentication API Route
 *
 * Handles authentication for Orchestrator daemon services.
 *
 * Routes:
 * - POST /api/daemon/auth - Authenticate daemon with API credentials
 *
 * @module app/api/daemon/auth/route
 */

import { redis, hashAPIKey } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

/**
 * Schema for daemon authentication request body
 */
const daemonAuthSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  scopes: z.array(z.string()).optional().default([]),
});

/**
 * JWT configuration
 */
const JWT_SECRET =
  process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Error codes for daemon authentication
 */
const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  DAEMON_DISABLED: 'DAEMON_DISABLED',
  CREDENTIALS_EXPIRED: 'CREDENTIALS_EXPIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Generate JWT tokens for authenticated daemon
 */
function generateTokens(
  orchestratorId: string,
  daemonId: string,
  scopes: string[],
): {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const accessToken = jwt.sign(
    {
      orchestratorId,
      daemonId,
      scopes,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

  const refreshToken = jwt.sign(
    {
      orchestratorId,
      daemonId,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  return { accessToken, refreshToken, expiresAt };
}

/**
 * POST /api/daemon/auth - Authenticate daemon
 *
 * Authenticates a Orchestrator daemon using API key and secret.
 *
 * @param request - Next.js request with authentication credentials
 * @returns JWT tokens for authenticated session
 *
 * @example
 * ```
 * POST /api/daemon/auth
 * Content-Type: application/json
 *
 * {
 *   "apiKey": "vp_abc123...",
 *   "apiSecret": "secret_xyz789...",
 *   "scopes": ["messages:read", "messages:write"]
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
        { error: 'Invalid JSON body', code: AUTH_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = daemonAuthSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'API key and secret required',
          code: AUTH_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 },
      );
    }

    const { apiKey, apiSecret: _apiSecret, scopes } = parseResult.data;

    // Extract OrchestratorID from API key prefix (format: vp_<orchestratorId>_<random>)
    const keyParts = apiKey.split('_');
    if (keyParts.length < 3 || keyParts[0] !== 'vp') {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        },
        { status: 401 },
      );
    }

    const orchestratorId = keyParts[1];

    // Look up Orchestrator and verify API key
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        },
        { status: 401 },
      );
    }

    // Check if Orchestrator is active
    if (orchestrator.status === 'OFFLINE') {
      return NextResponse.json(
        { error: 'Daemon is disabled', code: AUTH_ERROR_CODES.DAEMON_DISABLED },
        { status: 403 },
      );
    }

    // Verify API key hash
    const orchestratorCapabilities = orchestrator.capabilities as {
      apiKeyHash?: string;
    } | null;
    if (orchestratorCapabilities?.apiKeyHash) {
      const providedHash = await hashAPIKey(apiKey);
      if (providedHash !== orchestratorCapabilities.apiKeyHash) {
        return NextResponse.json(
          {
            error: 'Invalid credentials',
            code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          },
          { status: 401 },
        );
      }
    }

    // Generate session ID and tokens
    const sessionId = `daemon_session_${orchestratorId}_${Date.now()}`;
    const { accessToken, refreshToken, expiresAt } = generateTokens(
      orchestratorId,
      sessionId,
      scopes,
    );

    // Store session in Redis
    try {
      await redis.setex(
        `daemon:session:${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          orchestratorId,
          scopes,
          refreshToken: await hashAPIKey(refreshToken),
          createdAt: new Date().toISOString(),
          lastHeartbeat: new Date().toISOString(),
        }),
      );
    } catch (redisError) {
      console.error('Redis session storage error:', redisError);
      // Continue without session storage - tokens are still valid
    }

    // Update Orchestrator status
    await prisma.orchestrator.update({
      where: { id: orchestratorId },
      data: {
        status: 'ONLINE',
      },
    });

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      sessionId,
      orchestrator: {
        id: orchestrator.id,
        discipline: orchestrator.discipline,
        role: orchestrator.role,
        status: orchestrator.status,
        user: orchestrator.user,
        organization: orchestrator.organization,
      },
    });
  } catch (error) {
    console.error('[POST /api/daemon/auth] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
