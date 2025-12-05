/**
 * Single Session API Route
 *
 * Handles revoking a specific session.
 *
 * Routes:
 * - DELETE /api/user/sessions/:sessionId - Revoke a session
 *
 * @module app/api/user/sessions/[sessionId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * DELETE /api/user/sessions/:sessionId
 *
 * Revoke a specific session.
 *
 * @param request - Next.js request
 * @param context - Route context with session ID
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
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

    const params = await context.params;
    const { sessionId } = params;

    // Get current session token
    const currentSessionToken =
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    // Don't allow revoking current session
    if (sessionId === currentSessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot revoke current session',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    // Verify session belongs to user and delete it
    const result = await prisma.session.deleteMany({
      where: {
        sessionToken: sessionId,
        userId: session.user.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found',
          code: SECURITY_ERROR_CODES.SESSION_NOT_FOUND,
        },
        { status: 404 }
      );
    }

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'session_revoked',
      severity: 'info',
      description: 'User session revoked',
      metadata: { sessionId },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/user/sessions/:sessionId] Error:', error);
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
