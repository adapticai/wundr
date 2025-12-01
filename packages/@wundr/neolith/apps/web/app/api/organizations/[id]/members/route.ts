/**
 * Organization Members API Routes
 *
 * Handles listing and adding members to an organization.
 *
 * Routes:
 * - GET /api/organizations/:id/members - List organization members
 * - POST /api/organizations/:id/members - Add member to organization
 *
 * @module app/api/organizations/[id]/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  organizationIdParamSchema,
  addOrganizationMemberSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { AddOrganizationMemberInput } from '@/lib/validations/organization';
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
 * GET /api/organizations/:id/members
 *
 * List all members of an organization. Requires membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing organization ID
 * @returns List of organization members
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate organization ID parameter
    const params = await context.params;
    const paramResult = organizationIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid organization ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check membership
    const membership = await checkOrganizationAccess(
      params.id,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Fetch all members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return NextResponse.json({
      data: members,
      count: members.length,
    });
  } catch (error) {
    console.error('[GET /api/organizations/:id/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/:id/members
 *
 * Add a member to the organization. Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing organization ID
 * @returns Created membership object
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate organization ID parameter
    const params = await context.params;
    const paramResult = organizationIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid organization ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check membership and permission
    const membership = await checkOrganizationAccess(
      params.id,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = addOrganizationMemberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: AddOrganizationMemberInput = parseResult.data;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ORG_ERROR_CODES.USER_NOT_FOUND),
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: params.id,
          userId: input.userId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User is already a member of this organization',
          ORG_ERROR_CODES.ALREADY_MEMBER
        ),
        { status: 409 }
      );
    }

    // Cannot assign OWNER role when adding members
    const roleToAssign = input.role === 'OWNER' ? 'ADMIN' : input.role;

    // Add member
    const newMembership = await prisma.organizationMember.create({
      data: {
        organizationId: params.id,
        userId: input.userId,
        role: roleToAssign,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: newMembership, message: 'Member added successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/organizations/:id/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
