/**
 * Active Sessions API Route
 *
 * Manages user sessions including viewing active sessions and revoking them.
 *
 * Routes:
 * - GET /api/user/settings/sessions - List active sessions
 *
 * @module app/api/user/settings/sessions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { parseUserAgent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * Session information
 */
interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  location: string;
  lastActive: Date;
  isCurrent: boolean;
}

/**
 * GET /api/user/settings/sessions
 *
 * List all active sessions for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns List of active sessions
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Get all active sessions for user
    const sessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
      orderBy: {
        expires: 'desc',
      },
    });

    // Get current session token from request
    const currentSessionToken = request.cookies.get(
      'authjs.session-token'
    )?.value;

    // Parse and format session information
    const sessionsInfo: SessionInfo[] = sessions.map(sess => {
      const userAgent = 'Unknown';
      const agentInfo = parseUserAgent(userAgent);

      return {
        id: sess.id,
        device: agentInfo.device,
        browser: agentInfo.browser,
        os: agentInfo.os,
        ipAddress: null,
        location: 'Unknown',
        lastActive: sess.expires,
        isCurrent: sess.sessionToken === currentSessionToken,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessionsInfo,
        totalCount: sessionsInfo.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/settings/sessions] Error:', error);
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
