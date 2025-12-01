/**
 * Organization API Routes
 *
 * Handles listing and creating organizations.
 *
 * Routes:
 * - GET /api/organizations - List organizations the user belongs to
 * - POST /api/organizations - Create a new organization
 *
 * @module app/api/organizations/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createOrganizationSchema,
  organizationFiltersSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  CreateOrganizationInput,
  OrganizationFiltersInput,
} from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * GET /api/organizations
 *
 * List organizations the authenticated user belongs to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of organizations
 *
 * @example
 * ```
 * GET /api/organizations?page=1&limit=20&search=acme
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
    const parseResult = organizationFiltersSchema.safeParse(searchParams);

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

    const filters: OrganizationFiltersInput = parseResult.data;

    // Get organizations the user is a member of
    const userMemberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    const accessibleOrgIds = userMemberships.map(m => m.organizationId);

    // Build where clause
    const where: Prisma.organizationWhereInput = {
      id: { in: accessibleOrgIds },
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Calculate pagination
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const take = limit;

    // Build orderBy
    const orderBy: Prisma.organizationOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch organizations and total count in parallel
    const [organizations, totalCount] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: {
              organizationMembers: true,
              workspaces: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      data: organizations,
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
    console.error('[GET /api/organizations] Error:', error);
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
 * POST /api/organizations
 *
 * Create a new organization. The creator becomes the owner.
 *
 * @param request - Next.js request with organization data
 * @returns Created organization object
 *
 * @example
 * ```
 * POST /api/organizations
 * Content-Type: application/json
 *
 * {
 *   "name": "Acme Corp",
 *   "slug": "acme-corp",
 *   "description": "Building the future"
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
    const parseResult = createOrganizationSchema.safeParse(body);
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

    const input: CreateOrganizationInput = parseResult.data;

    // Check if slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: input.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        createErrorResponse(
          'An organization with this slug already exists',
          ORG_ERROR_CODES.ORG_SLUG_EXISTS
        ),
        { status: 409 }
      );
    }

    // Create organization with the creator as owner
    const organization = await prisma.$transaction(async tx => {
      // Create the organization
      const newOrg = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          avatarUrl: input.logoUrl,
          settings: input.settings as Prisma.InputJsonValue,
        },
      });

      // Add creator as owner
      await tx.organizationMember.create({
        data: {
          organizationId: newOrg.id,
          userId: session.user.id,
          role: 'OWNER',
        },
      });

      // Return org with member count
      return tx.organization.findUnique({
        where: { id: newOrg.id },
        include: {
          _count: {
            select: {
              organizationMembers: true,
              workspaces: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      { data: organization, message: 'Organization created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/organizations] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'An organization with this slug already exists',
          ORG_ERROR_CODES.ORG_SLUG_EXISTS
        ),
        { status: 409 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
