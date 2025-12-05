/**
 * User Sessions API Route
 *
 * Handles fetching active user sessions.
 *
 * Routes:
 * - GET /api/user/sessions - Get all active sessions
 *
 * @module app/api/user/sessions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { parseUserAgent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface Session {
  id: string;
  browser: string;
  os: string;
  device: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  current: boolean;
}

/**
 * GET /api/user/sessions
 *
 * Get all active sessions for the current user.
 *
 * @param request - Next.js request
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

    // Get current session token from cookie
    const currentSessionToken =
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    // Fetch all active sessions for the user
    const userSessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
        expires: {
          gt: new Date(),
        },
      },
      orderBy: {
        expires: 'desc',
      },
    });

    // Transform sessions to include parsed data
    const sessions: Session[] = userSessions.map(s => {
      const userAgent = (s as { userAgent?: string }).userAgent || '';
      const ipAddress = (s as { ipAddress?: string }).ipAddress || 'Unknown';
      const agentInfo = parseUserAgent(userAgent);

      return {
        id: s.sessionToken,
        browser: agentInfo.browser,
        os: agentInfo.os,
        device: agentInfo.device,
        location: 'Unknown', // Would need geolocation service
        ipAddress,
        lastActive: s.expires.toISOString(),
        current: s.sessionToken === currentSessionToken,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        sessions,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/sessions] Error:', error);
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
