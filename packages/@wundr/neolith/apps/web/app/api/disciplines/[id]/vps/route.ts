/**
 * Discipline VPs API Route
 *
 * Lists VPs belonging to a discipline.
 *
 * Routes:
 * - GET /api/disciplines/:id/vps - Get VPs in a discipline
 *
 * @module app/api/disciplines/[id]/vps/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  disciplineIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with discipline ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/disciplines/:id/vps
 *
 * List all VPs in a discipline. Requires organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing discipline ID
 * @returns List of VPs
 *
 * @example
 * ```
 * GET /api/disciplines/disc_123/vps
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate discipline ID parameter
    const params = await context.params;
    const paramResult = disciplineIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid discipline ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get discipline
    const discipline = await prisma.disciplines.findUnique({
      where: { id: params.id },
    });

    if (!discipline) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found',
          ORG_ERROR_CODES.DISCIPLINE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check organization membership
    const membership = await prisma.organization_members.findUnique({
      where: {
        organizationId_userId: {
          organizationId: discipline.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this organization',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Fetch VPs in this discipline
    const vps = await prisma.vps.findMany({
      where: { disciplineId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            isVP: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      data: vps,
      count: vps.length,
    });
  } catch (error) {
    console.error('[GET /api/disciplines/:id/vps] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
