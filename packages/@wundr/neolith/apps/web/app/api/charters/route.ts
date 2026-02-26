/**
 * Charter API Routes
 *
 * Handles listing and creating organization charters.
 *
 * Routes:
 * - GET /api/charters - List charters for an organization
 * - POST /api/charters - Create a new charter
 *
 * @module app/api/charters/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createCharterInputSchema,
  charterFiltersSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type {
  CreateCharterInputFull,
  CharterFiltersInput,
} from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Helper to check organization membership
 */
async function checkOrgAccess(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  return membership;
}

/**
 * GET /api/charters
 *
 * List charters for an organization. Requires authentication and org membership.
 *
 * @param request - Next.js request object with query parameters
 * @returns List of charters with pagination
 *
 * @example
 * ```
 * GET /api/charters?organizationId=org_123&limit=20&offset=0
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // organizationId is required
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'organizationId is required'
        ),
        { status: 400 }
      );
    }

    // Check org membership
    const membership = await checkOrgAccess(organizationId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Organization not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = charterFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid query parameters',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: CharterFiltersInput = parseResult.data;
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    // Build where clause
    const where: Prisma.charterWhereInput = {
      organizationId,
      ...(filters.search && {
        name: { contains: filters.search, mode: 'insensitive' },
      }),
    };

    // Build orderBy
    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    const orderBy: Prisma.charterOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch charters and total count in parallel
    const [charters, totalCount] = await Promise.all([
      prisma.charter.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy,
      }),
      prisma.charter.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: charters,
      pagination: {
        offset,
        limit,
        totalCount,
        totalPages,
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
      },
    });
  } catch (error) {
    console.error('[GET /api/charters] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/charters
 *
 * Create a new charter for an organization. Requires admin or owner role.
 *
 * @param request - Next.js request with charter data
 * @returns Created charter object
 *
 * @example
 * ```
 * POST /api/charters
 * Content-Type: application/json
 *
 * {
 *   "name": "Engineering Charter",
 *   "mission": "Build reliable and scalable systems",
 *   "values": ["Excellence", "Collaboration"],
 *   "organizationId": "org_123"
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
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
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
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON body'
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = createCharterInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: CreateCharterInputFull = parseResult.data;

    // Check org membership and require admin/owner to create charters
    const membership = await checkOrgAccess(
      input.organizationId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Organization not found or access denied'
        ),
        { status: 403 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Admin or Owner role required to create charters.'
        ),
        { status: 403 }
      );
    }

    // Determine the next version number for this org
    const latestCharter = await prisma.charter.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = latestCharter ? latestCharter.version + 1 : 1;

    // Create the charter
    const charter = await prisma.charter.create({
      data: {
        name: input.name,
        mission: input.mission,
        vision: input.vision,
        values: input.values,
        principles: input.principles ?? [],
        governance: (input.governance ?? {}) as Prisma.InputJsonValue,
        security: (input.security ?? {}) as Prisma.InputJsonValue,
        communication: (input.communication ?? {}) as Prisma.InputJsonValue,
        version: nextVersion,
        isActive: true,
        organizationId: input.organizationId,
        parentCharterId: input.parentCharterId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      { data: charter, message: 'Charter created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/charters] Error:', error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Organization not found'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}
