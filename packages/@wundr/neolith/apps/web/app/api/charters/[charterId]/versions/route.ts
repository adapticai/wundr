/**
 * Charter Versions API Routes
 *
 * Handles listing and creating charter versions.
 *
 * Routes:
 * - GET /api/charters/:charterId/versions - List all versions for a charter
 * - POST /api/charters/:charterId/versions - Create new version
 *
 * @module app/api/charters/[charterId]/versions/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createCharterVersionSchema,
  charterIdParamSchema,
  charterFiltersSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type {
  CreateCharterVersionInput,
  CharterFiltersInput,
} from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Route context with charterId parameter
 */
interface RouteContext {
  params: Promise<{ charterId: string }>;
}

/**
 * Helper function to check if user has access to an orchestrator
 */
async function checkOrchestratorAccess(orchestratorId: string, userId: string) {
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * GET /api/charters/:charterId/versions
 *
 * List all versions for a charter. Requires authentication and organization membership.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing charterId
 * @returns List of charter versions
 *
 * @example
 * ```
 * GET /api/charters/charter_123/versions?isActive=true&page=1&limit=20
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse({
      id: params.charterId,
    });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID format'
        ),
        { status: 400 }
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
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const filters: CharterFiltersInput = parseResult.data;
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    // Build where clause
    const where: Prisma.charterVersionWhereInput = {
      charterId: params.charterId,
      ...(filters.status && { status: filters.status }),
    };

    // Calculate pagination
    const skip = offset;
    const take = limit;

    // Fetch charter versions and check access to the first one's orchestrator
    const [versions, totalCount] = await Promise.all([
      prisma.charterVersion.findMany({
        where,
        skip,
        take,
        orderBy: { version: 'desc' },
        select: {
          id: true,
          charterId: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          changeLog: true,
          createdBy: true,
          isActive: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          orchestrator: {
            select: {
              id: true,
              organizationId: true,
              role: true,
              discipline: true,
            },
          },
        },
      }),
      prisma.charterVersion.count({ where }),
    ]);

    // Check access using first version's orchestrator (all versions belong to same orchestrator)
    if (versions.length > 0) {
      const access = await checkOrchestratorAccess(
        versions[0].orchestratorId,
        session.user.id
      );
      if (!access) {
        return NextResponse.json(
          createErrorResponse(
            CHARTER_ERROR_CODES.FORBIDDEN,
            'Orchestrator not found or access denied'
          ),
          { status: 403 }
        );
      }
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = offset + limit < totalCount;
    const hasPreviousPage = offset > 0;

    return NextResponse.json({
      data: versions,
      pagination: {
        offset,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/charters/:charterId/versions] Error:', error);
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
 * POST /api/charters/:charterId/versions
 *
 * Create a new charter version. Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with charter version data
 * @param context - Route context containing charterId
 * @returns Created charter version object
 *
 * @example
 * ```
 * POST /api/charters/charter_123/versions
 * Content-Type: application/json
 *
 * {
 *   "charterId": "charter_123",
 *   "charterData": { "role": "Backend Engineer", "capabilities": [...] },
 *   "changeLog": "Updated capabilities and added new tools"
 * }
 * ```
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
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse({
      id: params.charterId,
    });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID format'
        ),
        { status: 400 }
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
    const parseResult = createCharterVersionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const input: CreateCharterVersionInput = parseResult.data;

    // Ensure charterId matches the route parameter
    if (input.charterId !== params.charterId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Charter ID mismatch between route and body'
        ),
        { status: 400 }
      );
    }

    // Find an existing version to get the orchestratorId
    const existingVersion = await prisma.charterVersion.findFirst({
      where: { charterId: params.charterId },
      select: { orchestratorId: true },
    });

    if (!existingVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'No existing charter found. Use orchestrator charter API to create first version.'
        ),
        { status: 404 }
      );
    }

    // Check access and permissions
    const access = await checkOrchestratorAccess(
      existingVersion.orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Orchestrator not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Check for admin/owner role
    if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions to create charter version'
        ),
        { status: 403 }
      );
    }

    // Create new version in transaction
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate current active version
      await tx.charterVersion.updateMany({
        where: {
          orchestratorId: existingVersion.orchestratorId,
          charterId: params.charterId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Get next version number if not provided
      const maxVersion = await tx.charterVersion.findFirst({
        where: {
          orchestratorId: existingVersion.orchestratorId,
          charterId: params.charterId,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = maxVersion ? maxVersion.version + 1 : 1;

      // Create charter data from input
      const charterData = {
        name: input.name,
        description: input.description,
        objectives: input.objectives,
        constraints: input.constraints,
        metadata: input.metadata,
      };

      // Create new version
      return tx.charterVersion.create({
        data: {
          charterId: params.charterId,
          orchestratorId: existingVersion.orchestratorId,
          version: nextVersion,
          charterData: charterData as unknown as Prisma.InputJsonValue,
          changeLog: `Version ${nextVersion}: ${input.description}`,
          createdBy: session.user.id,
          isActive: true,
        },
        select: {
          id: true,
          charterId: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          changeLog: true,
          createdBy: true,
          isActive: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          orchestrator: {
            select: {
              id: true,
              organizationId: true,
              role: true,
              discipline: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      { data: newVersion, message: 'Charter version created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/charters/:charterId/versions] Error:', error);

    // Handle unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.DUPLICATE_VERSION,
          'A charter version with this number already exists'
        ),
        { status: 409 }
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
