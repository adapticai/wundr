/**
 * API Routes for Global Session Managers
 *
 * GET /api/session-managers/global - List all global session managers
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Error codes for session manager operations
 */
const SESSION_MANAGER_ERROR_CODES = {
  UNAUTHORIZED: 'SESSION_MANAGER_UNAUTHORIZED',
  VALIDATION_ERROR: 'SESSION_MANAGER_VALIDATION_ERROR',
  INTERNAL_ERROR: 'SESSION_MANAGER_INTERNAL_ERROR',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof SESSION_MANAGER_ERROR_CODES)[keyof typeof SESSION_MANAGER_ERROR_CODES],
  details?: Record<string, unknown>
) {
  return {
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * GET /api/session-managers/global
 *
 * List global session managers available to any orchestrator.
 * Filters by isGlobal=true.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of global session managers
 *
 * @example
 * ```
 * GET /api/session-managers/global?status=ACTIVE&skip=0&take=50
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');
    const search = searchParams.get('search');

    // Build where clause - only global session managers
    const where: Prisma.sessionManagerWhereInput = {
      isGlobal: true,
      ...(status && { status: status as Prisma.EnumAgentStatusFilter }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Fetch global session managers and total count in parallel
    const [data, total] = await Promise.all([
      prisma.sessionManager.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          orchestrator: {
            select: {
              id: true,
              userId: true,
              disciplineId: true,
              role: true,
            },
          },
          subagents: {
            select: {
              id: true,
              name: true,
              status: true,
              scope: true,
            },
          },
        },
      }),
      prisma.sessionManager.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/session-managers/global] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
