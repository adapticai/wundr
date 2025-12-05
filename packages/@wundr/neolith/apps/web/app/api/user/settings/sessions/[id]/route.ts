/**
 * Session Revocation API Route
 *
 * Handles revoking specific user sessions.
 *
 * Routes:
 * - DELETE /api/user/settings/sessions/[id] - Revoke a specific session
 *
 * @module app/api/user/settings/sessions/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * DELETE /api/user/settings/sessions/[id]
 *
 * Revoke a specific session by ID. Users cannot revoke their current session.
 *
 * @param request - Next.js request object
 * @param params - Route parameters with session ID (async in Next.js 15)
 * @returns Success message or error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const { id: sessionId } = await params;

    // Get the session to revoke
    const sessionToRevoke = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionToRevoke) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found',
          code: SECURITY_ERROR_CODES.SESSION_NOT_FOUND,
        },
        { status: 404 }
      );
    }

    // Verify the session belongs to the current user
    if (sessionToRevoke.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authorized to revoke this session',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 403 }
      );
    }

    // Get current session token to prevent revoking current session
    const currentSessionToken = request.cookies.get(
      'authjs.session-token'
    )?.value;

    if (sessionToRevoke.sessionToken === currentSessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot revoke current session',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    // Delete the session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'session_revoked',
      severity: 'info',
      description: 'Session manually revoked by user',
      metadata: {
        sessionId,
        revokedAt: new Date().toISOString(),
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/user/settings/sessions/[id]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
}
