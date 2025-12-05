/**
 * Data Export Status API Routes
 *
 * Handles checking the status of data export requests.
 *
 * Routes:
 * - GET /api/user/privacy/export/status - Get export status
 *
 * @module app/api/user/privacy/export/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET /api/user/privacy/export/status
 *
 * Get the current status of a data export request.
 *
 * @param request - Next.js request object
 * @returns Export status
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get user preferences with export status
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const exportStatus =
      (prefs.dataExportStatus as Record<string, unknown>) || null;

    if (!exportStatus) {
      return NextResponse.json({
        status: 'idle',
        progress: 0,
      });
    }

    return NextResponse.json(exportStatus);
  } catch (error) {
    console.error('[GET /api/user/privacy/export/status] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
