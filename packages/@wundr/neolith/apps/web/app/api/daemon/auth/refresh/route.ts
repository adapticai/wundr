/**
 * Daemon Token Refresh API Route
 *
 * Handles refreshing access tokens for VP daemon services.
 *
 * Routes:
 * - POST /api/daemon/auth/refresh - Refresh access token
 *
 * @module app/api/daemon/auth/refresh/route
 */

import { redis, hashAPIKey } from '@neolith/core';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

/**
 * Schema for token refresh request body
 */
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h';

/**
 * Error codes for token refresh
 */
const REFRESH_ERROR_CODES = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded refresh token payload
 */
interface RefreshTokenPayload {
  vpId: string;
  daemonId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

/**
 * POST /api/daemon/auth/refresh - Refresh access token
 *
 * Exchanges a valid refresh token for a new access token.
 *
 * @param request - Next.js request with refresh token
 * @returns New access token
 *
 * @example
 * ```
 * POST /api/daemon/auth/refresh
 * Content-Type: application/json
 *
 * {
 *   "refreshToken": "eyJhbG..."
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
        { error: 'Invalid JSON body', code: REFRESH_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = refreshTokenSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Refresh token required', code: REFRESH_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    const { refreshToken } = parseResult.data;

    // Verify and decode refresh token
    let decoded: RefreshTokenPayload;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET) as RefreshTokenPayload;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: 'Token expired', code: REFRESH_ERROR_CODES.TOKEN_EXPIRED },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: 'Invalid or revoked token', code: REFRESH_ERROR_CODES.INVALID_TOKEN },
        { status: 401 },
      );
    }

    // Validate token type
    if (decoded.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid token type', code: REFRESH_ERROR_CODES.INVALID_TOKEN },
        { status: 401 },
      );
    }

    const { vpId, daemonId } = decoded;

    // Verify session exists in Redis
    let sessionData: { scopes?: string[]; refreshToken?: string } | null = null;
    try {
      const sessionStr = await redis.get(`daemon:session:${daemonId}`);
      if (sessionStr) {
        sessionData = JSON.parse(sessionStr);
      }
    } catch (redisError) {
      console.error('Redis session lookup error:', redisError);
      // Continue without session verification in case of Redis issues
    }

    // If session exists, verify refresh token hash matches
    if (sessionData?.refreshToken) {
      const providedHash = await hashAPIKey(refreshToken);
      if (providedHash !== sessionData.refreshToken) {
        return NextResponse.json(
          { error: 'Token has been revoked', code: REFRESH_ERROR_CODES.TOKEN_REVOKED },
          { status: 401 },
        );
      }
    }

    // Generate new access token
    const scopes = sessionData?.scopes || [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    const accessToken = jwt.sign(
      {
        vpId,
        daemonId,
        scopes,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    // Update session last activity
    if (sessionData) {
      try {
        await redis.setex(
          `daemon:session:${daemonId}`,
          7 * 24 * 60 * 60, // 7 days
          JSON.stringify({
            ...sessionData,
            lastRefresh: new Date().toISOString(),
          }),
        );
      } catch (redisError) {
        console.error('Redis session update error:', redisError);
      }
    }

    return NextResponse.json({
      accessToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/daemon/auth/refresh] Error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed', code: REFRESH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
