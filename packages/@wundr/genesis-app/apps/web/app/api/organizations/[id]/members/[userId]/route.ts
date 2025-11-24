/**
 * Organization Member Detail API Routes
 *
 * Handles single member operations within an organization.
 *
 * Routes:
 * - PATCH /api/organizations/:id/members/:userId - Update member role
 * - DELETE /api/organizations/:id/members/:userId - Remove member
 *
 * @module app/api/organizations/[id]/members/[userId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  organizationIdParamSchema,
  userIdParamSchema,
  updateMemberRoleSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateMemberRoleInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with organization and user ID parameters
 */
interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * Helper to check organization membership and role
 */
async function checkOrganizationAccess(orgId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId,
      },
    },
  });
}

/**
 * PATCH /api/organizations/:id/members/:userId
 *
 * Update a member's role. Requires ADMIN or OWNER role.
 * Cannot modify OWNER role.
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing organization and user IDs
 * @returns Updated membership object
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

    // Validate parameters
    const params = await context.params;
    const orgParamResult = organizationIdParamSchema.safeParse({ id: params.id });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!orgParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's membership and permission
    const requesterMembership = await checkOrganizationAccess(params.id, session.user.id);
    if (!requesterMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(requesterMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get target member
    const targetMembership = await checkOrganizationAccess(params.id, params.userId);
    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this organization',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Cannot modify owner
    if (targetMembership.role === 'OWNER') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot modify the organization owner',
          ORG_ERROR_CODES.CANNOT_MODIFY_OWNER,
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
    const parseResult = updateMemberRoleSchema.safeParse(body);
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

    const input: UpdateMemberRoleInput = parseResult.data;

    // Cannot assign OWNER role via this endpoint
    if (input.role === 'OWNER') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot assign OWNER role. Use transfer ownership instead.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update member role
    const updatedMembership = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: params.id,
          userId: params.userId,
        },
      },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedMembership,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/organizations/:id/members/:userId] Error:', error);
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
 * DELETE /api/organizations/:id/members/:userId
 *
 * Remove a member from the organization. Requires ADMIN or OWNER role.
 * Cannot remove the organization owner.
 *
 * @param request - Next.js request object
 * @param context - Route context containing organization and user IDs
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

    // Validate parameters
    const params = await context.params;
    const orgParamResult = organizationIdParamSchema.safeParse({ id: params.id });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!orgParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's membership and permission
    const requesterMembership = await checkOrganizationAccess(params.id, session.user.id);
    if (!requesterMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Users can remove themselves, or admins/owners can remove others
    const isSelf = session.user.id === params.userId;
    const isAdmin = ['OWNER', 'ADMIN'].includes(requesterMembership.role);

    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get target member
    const targetMembership = await checkOrganizationAccess(params.id, params.userId);
    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this organization',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Cannot remove owner
    if (targetMembership.role === 'OWNER') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot remove the organization owner. Transfer ownership first.',
          ORG_ERROR_CODES.CANNOT_REMOVE_SELF,
        ),
        { status: 403 },
      );
    }

    // Remove member
    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: params.id,
          userId: params.userId,
        },
      },
    });

    return NextResponse.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/organizations/:id/members/:userId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
