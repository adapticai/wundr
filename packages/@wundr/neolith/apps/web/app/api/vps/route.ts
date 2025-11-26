/**
 * VP CRUD API Routes
 *
 * Handles listing and creating Virtual Person (VP) entities.
 *
 * Routes:
 * - GET /api/vps - List VPs with optional filters
 * - POST /api/vps - Create a new VP
 *
 * @module app/api/vps/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createVPSchema,
  vpFiltersSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { CreateVPInput, VPFiltersInput } from '@/lib/validations/vp';
import type { NextRequest} from 'next/server';

/**
 * GET /api/vps
 *
 * List VPs with optional filtering, pagination, and sorting.
 * Requires authentication. Users can only see VPs from organizations they belong to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of VPs
 *
 * @example
 * ```
 * GET /api/vps?organizationId=org_123&status=ONLINE&page=1&limit=20
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = vpFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: VPFiltersInput = parseResult.data;

    // Get organizations the user has access to
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

    // Check authorization for specific organization filter
    if (filters.organizationId && !accessibleOrgIds.includes(filters.organizationId)) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this organization',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Build where clause
    const where: Prisma.vPWhereInput = {
      organizationId: filters.organizationId
        ? filters.organizationId
        : { in: accessibleOrgIds },
      ...(filters.discipline && { discipline: filters.discipline }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { user: { name: { contains: filters.search, mode: 'insensitive' } } },
          { user: { email: { contains: filters.search, mode: 'insensitive' } } },
          { role: { contains: filters.search, mode: 'insensitive' } },
          { discipline: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy
    const orderBy: Prisma.vPOrderByWithRelationInput =
      filters.sortBy === 'createdAt' || filters.sortBy === 'updatedAt'
        ? { [filters.sortBy]: filters.sortOrder }
        : { [filters.sortBy]: filters.sortOrder };

    // Fetch VPs and total count in parallel
    const [vps, totalCount] = await Promise.all([
      prisma.vP.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.vP.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    return NextResponse.json({
      data: vps,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/vps] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/vps
 *
 * Create a new VP. Requires authentication and admin/owner role in the organization.
 *
 * @param request - Next.js request with VP creation data
 * @returns Created VP object
 *
 * @example
 * ```
 * POST /api/vps
 * Content-Type: application/json
 *
 * {
 *   "discipline": "Engineering",
 *   "role": "Senior Backend Engineer",
 *   "organizationId": "org_123",
 *   "user": {
 *     "name": "Backend Bot",
 *     "email": "backend-bot@neolith.ai"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createVPSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateVPInput = parseResult.data;

    // Check organization exists and user has admin/owner access
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or insufficient permissions',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for duplicate email if user data provided
    if (input.user?.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: input.user.email },
      });

      if (existingUser) {
        return NextResponse.json(
          createErrorResponse(
            'A user with this email already exists',
            VP_ERROR_CODES.DUPLICATE_EMAIL,
          ),
          { status: 409 },
        );
      }
    }

    // Create VP with associated user in a transaction
    const vp = await prisma.$transaction(async (tx) => {
      // Create user for the VP
      const user = await tx.user.create({
        data: {
          email: input.user?.email ?? `vp-${Date.now()}@neolith.local`,
          name: input.user?.name ?? `${input.role} VP`,
          displayName: input.user?.displayName,
          avatarUrl: input.user?.avatarUrl,
          bio: input.user?.bio,
          isVP: true,
          status: 'ACTIVE',
        },
      });

      // Create the VP
      const newVP = await tx.vP.create({
        data: {
          discipline: input.discipline,
          role: input.role,
          capabilities: input.capabilities as unknown as Prisma.InputJsonValue,
          daemonEndpoint: input.daemonEndpoint,
          status: input.status,
          userId: user.id,
          organizationId: input.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return newVP;
    });

    return NextResponse.json(
      { data: vp, message: 'VP created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/vps] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'A VP with these details already exists',
          VP_ERROR_CODES.DUPLICATE_EMAIL,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
