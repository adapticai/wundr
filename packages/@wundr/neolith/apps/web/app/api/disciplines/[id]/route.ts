/**
 * Discipline Detail API Routes
 *
 * Handles single discipline operations.
 *
 * Routes:
 * - GET /api/disciplines/:id - Get discipline details
 * - PATCH /api/disciplines/:id - Update discipline
 * - DELETE /api/disciplines/:id - Delete discipline
 *
 * @module app/api/disciplines/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  disciplineIdParamSchema,
  updateDisciplineSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateDisciplineInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with discipline ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper to check discipline access
 */
async function checkDisciplineAccess(disciplineId: string, userId: string) {
  const discipline = await prisma.disciplines.findUnique({
    where: { id: disciplineId },
  });

  if (!discipline) {
return null;
}

  const orgMembership = await prisma.organization_members.findUnique({
    where: {
      organizationId_userId: {
        organizationId: discipline.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
return null;
}

  return {
    discipline,
    orgMembership,
  };
}

/**
 * GET /api/disciplines/:id
 *
 * Get discipline details. Requires organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing discipline ID
 * @returns Discipline details
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

    // Check access
    const access = await checkDisciplineAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          ORG_ERROR_CODES.DISCIPLINE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch discipline with details
    const discipline = await prisma.disciplines.findUnique({
      where: { id: params.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            vps: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: discipline,
    });
  } catch (error) {
    console.error('[GET /api/disciplines/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/disciplines/:id
 *
 * Update discipline. Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing discipline ID
 * @returns Updated discipline
 */
export async function PATCH(
  request: NextRequest,
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

    // Check access and permission
    const access = await checkDisciplineAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          ORG_ERROR_CODES.DISCIPLINE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateDisciplineSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateDisciplineInput = parseResult.data;

    // If updating name, check for duplicates
    if (input.name) {
      const existingDiscipline = await prisma.disciplines.findFirst({
        where: {
          organizationId: access.discipline.organizationId,
          name: { equals: input.name, mode: 'insensitive' },
          id: { not: params.id },
        },
      });

      if (existingDiscipline) {
        return NextResponse.json(
          createErrorResponse(
            'A discipline with this name already exists in the organization',
            ORG_ERROR_CODES.DISCIPLINE_NAME_EXISTS,
          ),
          { status: 409 },
        );
      }
    }

    // Update discipline
    const discipline = await prisma.disciplines.update({
      where: { id: params.id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            vps: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: discipline,
      message: 'Discipline updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/disciplines/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/disciplines/:id
 *
 * Delete discipline. Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing discipline ID
 * @returns Success message
 */
export async function DELETE(
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

    // Check access and permission
    const access = await checkDisciplineAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          ORG_ERROR_CODES.DISCIPLINE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete discipline
    await prisma.disciplines.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Discipline deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/disciplines/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
