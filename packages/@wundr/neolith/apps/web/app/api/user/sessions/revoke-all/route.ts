/**
 * Revoke All Sessions API Route
 *
 * Handles revoking all sessions except the current one.
 *
 * Routes:
 * - POST /api/user/sessions/revoke-all - Revoke all other sessions
 *
 * @module app/api/user/sessions/revoke-all/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/sessions/revoke-all
 *
 * Revoke all sessions except the current one.
 *
 * @param request - Next.js request
 * @returns Success message with count of revoked sessions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Get current session token
    const currentSessionToken =
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!currentSessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active session found',
          code: SECURITY_ERROR_CODES.SESSION_NOT_FOUND,
        },
        { status: 400 }
      );
    }

    // Delete all sessions except current
    const result = await prisma.session.deleteMany({
      where: {
        userId: session.user.id,
        sessionToken: {
          not: currentSessionToken,
        },
      },
    });

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'all_sessions_revoked',
      severity: 'warning',
      description: `Revoked ${result.count} sessions`,
      metadata: { count: result.count },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'All other sessions revoked successfully',
      data: {
        revokedCount: result.count,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/sessions/revoke-all] Error:', error);
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
