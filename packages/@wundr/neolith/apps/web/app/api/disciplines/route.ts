/**
 * Discipline API Routes
 *
 * Handles listing and creating disciplines.
 *
 * Routes:
 * - GET /api/disciplines - List disciplines by organization
 * - POST /api/disciplines - Create a new discipline
 *
 * @module app/api/disciplines/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createDisciplineSchema,
  createErrorResponse,
  disciplineFiltersSchema,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  CreateDisciplineInput,
  DisciplineFiltersInput,
} from '@/lib/validations/organization';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/disciplines
 *
 * List disciplines the authenticated user has access to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of disciplines
 *
 * @example
 * ```
 * GET /api/disciplines?organizationId=org_123&page=1&limit=50
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = disciplineFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: DisciplineFiltersInput = parseResult.data;

    // Get organizations the user is a member of
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

    // Check authorization for specific organization filter
    if (
      filters.organizationId &&
      !accessibleOrgIds.includes(filters.organizationId)
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this organization',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Build where clause
    const where: Prisma.disciplineWhereInput = {
      organizationId: filters.organizationId
        ? filters.organizationId
        : { in: accessibleOrgIds },
      ...(filters.search && {
        name: { contains: filters.search, mode: 'insensitive' },
      }),
    };

    // Calculate pagination
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const take = limit;

    // Build orderBy
    const orderBy: Prisma.disciplineOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch disciplines and total count in parallel
    const [disciplines, totalCount] = await Promise.all([
      prisma.discipline.findMany({
        where,
        skip,
        take,
        orderBy,
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
              orchestrators: true,
            },
          },
        },
      }),
      prisma.discipline.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      data: disciplines,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/disciplines] Error:', error);
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
 * POST /api/disciplines
 *
 * Create a new discipline. Requires ADMIN or OWNER role in the organization.
 *
 * @param request - Next.js request with discipline data
 * @returns Created discipline object
 *
 * @example
 * ```
 * POST /api/disciplines
 * Content-Type: application/json
 *
 * {
 *   "name": "Engineering",
 *   "description": "Software engineering discipline",
 *   "organizationId": "org_123",
 *   "color": "#3B82F6"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const parseResult = createDisciplineSchema.safeParse(body);
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

    const input: CreateDisciplineInput = parseResult.data;

    // Check organization membership and permission
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: session.user.id,
        },
      },
    });

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

    // Check if discipline name already exists in the organization
    const existingDiscipline = await prisma.discipline.findFirst({
      where: {
        organizationId: input.organizationId,
        name: { equals: input.name, mode: 'insensitive' },
      },
    });

    if (existingDiscipline) {
      return NextResponse.json(
        createErrorResponse(
          'A discipline with this name already exists in the organization',
          ORG_ERROR_CODES.DISCIPLINE_NAME_EXISTS
        ),
        { status: 409 }
      );
    }

    // Create discipline
    const discipline = await prisma.discipline.create({
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        organizationId: input.organizationId,
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
            orchestrators: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: discipline, message: 'Discipline created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/disciplines] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
