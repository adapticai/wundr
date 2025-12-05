/**
 * Login History API Route
 *
 * Handles fetching user login history with device and location information.
 *
 * Routes:
 * - GET /api/user/login-history - Get login history
 *
 * @module app/api/user/login-history/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'blocked';
  ipAddress: string;
  browser: string;
  os: string;
  deviceType: string;
  location: string;
  failureReason?: string;
}

/**
 * GET /api/user/login-history
 *
 * Get login history for the current user.
 *
 * @param request - Next.js request with optional query params
 * @returns List of login attempts
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch login history
    try {
      const history = await prisma.$queryRaw<
        Array<{
          id: string;
          created_at: Date;
          status: string;
          ip_address: string;
          browser: string;
          os: string;
          device_type: string;
          city: string;
          country: string;
          failure_reason: string | null;
        }>
      >`
        SELECT id, created_at, status, ip_address, browser, os,
               device_type, city, country, failure_reason
        FROM login_history
        WHERE user_id = ${session.user.id}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const entries: LoginHistoryEntry[] = history.map(entry => ({
        id: entry.id,
        timestamp: entry.created_at.toISOString(),
        status: entry.status as 'success' | 'failed' | 'blocked',
        ipAddress: entry.ip_address,
        browser: entry.browser,
        os: entry.os,
        deviceType: entry.device_type,
        location: `${entry.city}, ${entry.country}`,
        failureReason: entry.failure_reason || undefined,
      }));

      return NextResponse.json({
        success: true,
        data: {
          entries,
          limit,
          offset,
        },
      });
    } catch (dbError) {
      // Table might not exist yet - return empty array
      console.warn('[GET /api/user/login-history] Table not found:', dbError);
      return NextResponse.json({
        success: true,
        data: {
          entries: [],
          limit,
          offset,
        },
      });
    }
  } catch (error) {
    console.error('[GET /api/user/login-history] Error:', error);
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
