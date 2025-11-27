/**
 * OrchestratorCRUD API Routes
 *
 * Handles listing and creating Orchestrator entities.
 *
 * Routes:
 * - GET /api/orchestrators - List Orchestrators with optional filters
 * - POST /api/orchestrators - Create a new Orchestrator
 *
 * @module app/api/orchestrators/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createOrchestratorSchema,
  orchestratorFiltersSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { CreateOrchestratorInput, OrchestratorFiltersInput } from '@/lib/validations/orchestrator';
import type { NextRequest} from 'next/server';

/**
 * GET /api/orchestrators
 *
 * List Orchestrators with optional filtering, pagination, and sorting.
 * Requires authentication. Users can only see Orchestrators from organizations they belong to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of Orchestrators
 *
 * @example
 * ```
 * GET /api/orchestrators?organizationId=org_123&status=ONLINE&page=1&limit=20
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = orchestratorFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: OrchestratorFiltersInput = parseResult.data;

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
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Build where clause
    const where: Prisma.orchestratorWhereInput = {
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
    const orderBy: Prisma.orchestratorOrderByWithRelationInput =
      filters.sortBy === 'createdAt' || filters.sortBy === 'updatedAt'
        ? { [filters.sortBy]: filters.sortOrder }
        : { [filters.sortBy]: filters.sortOrder };

    // Fetch Orchestrators and total count in parallel
    const [orchestrators, totalCount] = await Promise.all([
      prisma.orchestrator.findMany({
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
      prisma.orchestrator.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    return NextResponse.json({
      data: orchestrators,
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
    console.error('[GET /api/orchestrators] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/orchestrators
 *
 * Create a new Orchestrator. Requires authentication and admin/owner role in the organization.
 *
 * @param request - Next.js request with Orchestrator creation data
 * @returns Created Orchestrator object
 *
 * @example
 * ```
 * POST /api/orchestrators
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createOrchestratorSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateOrchestratorInput = parseResult.data;

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
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
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
            ORCHESTRATOR_ERROR_CODES.DUPLICATE_EMAIL,
          ),
          { status: 409 },
        );
      }
    }

    // Create Orchestrator with associated user in a transaction
    const orchestrator = await prisma.$transaction(async (tx) => {
      // Create user for the Orchestrator
      const user = await tx.user.create({
        data: {
          email: input.user?.email ?? `orchestrator-${Date.now()}@neolith.local`,
          name: input.user?.name ?? `${input.role} Orchestrator`,
          displayName: input.user?.displayName,
          avatarUrl: input.user?.avatarUrl,
          bio: input.user?.bio,
          isOrchestrator: true,
          status: 'ACTIVE',
        },
      });

      // Create the Orchestrator
      const newOrchestrator = await tx.orchestrator.create({
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

      return newOrchestrator;
    });

    return NextResponse.json(
      { data: orchestrator, message: 'Orchestrator created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/orchestrators] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'An Orchestrator with these details already exists',
          ORCHESTRATOR_ERROR_CODES.DUPLICATE_EMAIL,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
