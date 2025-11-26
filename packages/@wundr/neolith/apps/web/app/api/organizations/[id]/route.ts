/**
 * Organization Detail API Routes
 *
 * Handles single organization operations.
 *
 * Routes:
 * - GET /api/organizations/:id - Get organization details
 * - PATCH /api/organizations/:id - Update organization
 * - DELETE /api/organizations/:id - Delete organization
 *
 * @module app/api/organizations/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  organizationIdParamSchema,
  updateOrganizationSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateOrganizationInput } from '@/lib/validations/organization';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with organization ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper to check organization membership and role
 */
async function checkOrganizationAccess(orgId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId,
      },
    },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              organizationMembers: true,
              workspaces: true,
            },
          },
        },
      },
    },
  });

  return membership;
}

/**
 * GET /api/organizations/:id
 *
 * Get organization details. Requires membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing organization ID
 * @returns Organization details
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

    // Validate organization ID parameter
    const params = await context.params;
    const paramResult = organizationIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid organization ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check membership
    const membership = await checkOrganizationAccess(params.id, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: membership.organization,
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/organizations/:id] Error:', error);
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
 * PATCH /api/organizations/:id
 *
 * Update organization. Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing organization ID
 * @returns Updated organization
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

    // Validate organization ID parameter
    const params = await context.params;
    const paramResult = organizationIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid organization ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check membership and permission
    const membership = await checkOrganizationAccess(params.id, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
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
    const parseResult = updateOrganizationSchema.safeParse(body);
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

    const input: UpdateOrganizationInput = parseResult.data;

    // Update organization
    const organization = await prisma.organization.update({
      where: { id: params.id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.settings && { settings: input.settings as Prisma.InputJsonValue }),
      },
      include: {
        _count: {
          select: {
            organizationMembers: true,
            workspaces: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: organization,
      message: 'Organization updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/organizations/:id] Error:', error);
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
 * DELETE /api/organizations/:id
 *
 * Delete organization. Requires OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing organization ID
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

    // Validate organization ID parameter
    const params = await context.params;
    const paramResult = organizationIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid organization ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check membership and permission
    const membership = await checkOrganizationAccess(params.id, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (membership.role !== 'OWNER') {
      return NextResponse.json(
        createErrorResponse(
          'Only the organization owner can delete the organization',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete organization (cascades to members, workspaces, etc.)
    await prisma.organization.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/organizations/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
