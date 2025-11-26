/**
 * Daemon Session Management API Route
 *
 * Manages VP daemon session lifecycle including creation, updates, and termination.
 * Sessions track daemon connection state and activity.
 *
 * Routes:
 * - GET /api/daemon/sessions - List all sessions for authenticated daemon/VP
 * - POST /api/daemon/sessions - Create a new session
 * - PATCH /api/daemon/sessions - Update session status and metadata
 * - DELETE /api/daemon/sessions - Terminate session
 *
 * @module app/api/daemon/sessions/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type {
  Session,
  SessionCreate,
  SessionUpdate,
  SessionCreateResponse,
  SessionUpdateResponse,
  SessionDeleteResponse,
  SessionListResponse,
  DaemonErrorResponse,
} from '@/types/daemon';
import type { NextRequest } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// =============================================================================
// Validation Schemas
// =============================================================================

const sessionCreateSchema = z.object({
  vpId: z.string().min(1, 'VP ID is required'),
  type: z.enum(['daemon', 'user', 'system']),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      location: z.string().optional(),
      deviceType: z.string().optional(),
    })
    .passthrough()
    .optional(),
  timeoutSeconds: z.number().int().positive().optional(),
});

const sessionUpdateSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  status: z.enum(['active', 'idle', 'expired', 'terminated']).optional(),
  metadata: z.record(z.unknown()).optional(),
  extendTTL: z.boolean().optional(),
  lastActivityAt: z.string().datetime().optional(),
});

// =============================================================================
// Error Codes
// =============================================================================

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
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
  vpId: string;
  daemonId: string;
  scopes: string[];
}> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as {
    vpId: string;
    daemonId: string;
    scopes: string[];
    type: string;
  };

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return {
    vpId: decoded.vpId,
    daemonId: decoded.daemonId,
    scopes: decoded.scopes,
  };
}

/**
 * Generate unique session ID
 */
function generateSessionId(vpId: string, type: string): string {
  return `session_${type}_${vpId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse session from Redis data
 */
function parseSession(sessionId: string, data: string): Session {
  const parsed = JSON.parse(data);
  return {
    id: sessionId,
    vpId: parsed.vpId,
    type: parsed.type || 'daemon',
    status: parsed.status || 'active',
    createdAt: parsed.createdAt,
    lastActivityAt: parsed.lastActivityAt || parsed.createdAt,
    expiresAt: parsed.expiresAt,
    metadata: parsed.metadata,
    lastHeartbeat: parsed.lastHeartbeat,
    lastStatus: parsed.lastStatus,
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/daemon/sessions
 *
 * List all sessions for the authenticated daemon/VP.
 * Returns active and recent sessions with metadata.
 *
 * @param request - Next.js request with authentication header
 * @returns List of sessions
 *
 * @example
 * ```
 * GET /api/daemon/sessions
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { vpId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get all sessions for this VP from Redis
    const sessions: Session[] = [];

    try {
      const pattern = `daemon:session:*${token.vpId}*`;
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const sessionId = key.replace('daemon:session:', '');
          sessions.push(parseSession(sessionId, data));
        }
      }
    } catch (redisError) {
      console.error('Redis session listing error:', redisError);
      // Return empty list on Redis error
    }

    // Sort by creation date (newest first)
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const response: SessionListResponse = {
      sessions,
      total: sessions.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/daemon/sessions] Error:', error);
    return NextResponse.json(
      createErrorResponse('Failed to list sessions', ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/daemon/sessions
 *
 * Create a new daemon session.
 * Sessions track connection state and enable session-based features.
 *
 * @param request - Next.js request with session creation data
 * @returns Created session information
 *
 * @example
 * ```
 * POST /api/daemon/sessions
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "vpId": "vp_123",
 *   "type": "daemon",
 *   "metadata": {
 *     "userAgent": "VP-Daemon/1.0.0",
 *     "ipAddress": "192.168.1.100"
 *   },
 *   "timeoutSeconds": 604800
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { vpId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

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

    const parseResult = sessionCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const sessionData: SessionCreate = parseResult.data;

    // Verify VP ownership
    if (sessionData.vpId !== token.vpId) {
      return NextResponse.json(
        createErrorResponse('Cannot create session for different VP', ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Verify VP exists
    const vp = await prisma.vps.findUnique({
      where: { id: sessionData.vpId },
      select: { id: true, status: true },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Generate session ID and timestamps
    const sessionId = generateSessionId(sessionData.vpId, sessionData.type);
    const now = new Date();
    const ttl = sessionData.timeoutSeconds || DEFAULT_SESSION_TTL_SECONDS;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const session: Session = {
      id: sessionId,
      vpId: sessionData.vpId,
      type: sessionData.type,
      status: 'active',
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: sessionData.metadata,
    };

    // Store session in Redis
    try {
      const sessionKey = `daemon:session:${sessionId}`;
      await redis.setex(sessionKey, ttl, JSON.stringify(session));
    } catch (redisError) {
      console.error('Redis session storage error:', redisError);
      return NextResponse.json(
        createErrorResponse('Failed to create session', ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    const response: SessionCreateResponse = {
      success: true,
      session,
      message: 'Session created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[POST /api/daemon/sessions] Error:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create session', ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/daemon/sessions
 *
 * Update session status, metadata, or extend TTL.
 * Allows updating session state and refreshing expiration.
 *
 * @param request - Next.js request with session update data
 * @returns Updated session information
 *
 * @example
 * ```
 * PATCH /api/daemon/sessions
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "sessionId": "session_daemon_vp123_1234567890_abc",
 *   "status": "idle",
 *   "extendTTL": true,
 *   "lastActivityAt": "2024-01-01T12:00:00Z"
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { vpId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

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

    const parseResult = sessionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const updateData: SessionUpdate = parseResult.data;

    // Get existing session from Redis
    const sessionKey = `daemon:session:${updateData.sessionId}`;
    let sessionData: string | null = null;

    try {
      sessionData = await redis.get(sessionKey);
    } catch (redisError) {
      console.error('Redis session retrieval error:', redisError);
      return NextResponse.json(
        createErrorResponse('Failed to retrieve session', ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    if (!sessionData) {
      return NextResponse.json(
        createErrorResponse('Session not found or expired', ERROR_CODES.SESSION_NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse and update session
    const session = parseSession(updateData.sessionId, sessionData);

    // Verify session ownership
    if (session.vpId !== token.vpId) {
      return NextResponse.json(
        createErrorResponse('Cannot update session for different VP', ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Apply updates
    if (updateData.status) {
      session.status = updateData.status;
    }
    if (updateData.metadata) {
      session.metadata = {
        ...session.metadata,
        ...updateData.metadata,
      };
    }
    if (updateData.lastActivityAt) {
      session.lastActivityAt = updateData.lastActivityAt;
    } else {
      session.lastActivityAt = new Date().toISOString();
    }

    // Calculate TTL
    let ttl = DEFAULT_SESSION_TTL_SECONDS;
    if (updateData.extendTTL) {
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + DEFAULT_SESSION_TTL_SECONDS * 1000);
      session.expiresAt = newExpiresAt.toISOString();
    } else {
      // Calculate remaining TTL
      const expiresAt = new Date(session.expiresAt);
      const now = new Date();
      ttl = Math.max(60, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    }

    // Update session in Redis
    try {
      await redis.setex(sessionKey, ttl, JSON.stringify(session));
    } catch (redisError) {
      console.error('Redis session update error:', redisError);
      return NextResponse.json(
        createErrorResponse('Failed to update session', ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    const response: SessionUpdateResponse = {
      success: true,
      session,
      message: 'Session updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[PATCH /api/daemon/sessions] Error:', error);
    return NextResponse.json(
      createErrorResponse('Failed to update session', ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/daemon/sessions
 *
 * Terminate a session and clean up resources.
 * Requires session ID in query parameters.
 *
 * @param request - Next.js request with sessionId query parameter
 * @returns Deletion confirmation
 *
 * @example
 * ```
 * DELETE /api/daemon/sessions?sessionId=session_daemon_vp123_1234567890_abc
 * Authorization: Bearer <access_token>
 * ```
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: { vpId: string; daemonId: string; scopes: string[] };
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get session ID from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        createErrorResponse('Session ID is required', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get session to verify ownership
    const sessionKey = `daemon:session:${sessionId}`;
    let sessionData: string | null = null;

    try {
      sessionData = await redis.get(sessionKey);
    } catch (redisError) {
      console.error('Redis session retrieval error:', redisError);
      return NextResponse.json(
        createErrorResponse('Failed to retrieve session', ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    if (!sessionData) {
      return NextResponse.json(
        createErrorResponse('Session not found or expired', ERROR_CODES.SESSION_NOT_FOUND),
        { status: 404 },
      );
    }

    const session = parseSession(sessionId, sessionData);

    // Verify session ownership
    if (session.vpId !== token.vpId) {
      return NextResponse.json(
        createErrorResponse('Cannot delete session for different VP', ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Delete session from Redis
    try {
      await redis.del(sessionKey);
    } catch (redisError) {
      console.error('Redis session deletion error:', redisError);
      return NextResponse.json(
        createErrorResponse('Failed to delete session', ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    const response: SessionDeleteResponse = {
      success: true,
      message: 'Session terminated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[DELETE /api/daemon/sessions] Error:', error);
    return NextResponse.json(
      createErrorResponse('Failed to delete session', ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
