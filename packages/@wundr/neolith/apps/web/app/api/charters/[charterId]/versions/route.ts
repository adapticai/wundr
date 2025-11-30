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

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createCharterVersionSchema,
  charterIdParamSchema,
  charterFiltersSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { CreateCharterVersionInput, CharterFiltersInput } from '@/lib/validations/charter';
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

  const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!orchestrator || !accessibleOrgIds.includes(orchestrator.organizationId)) {
    return null;
  }

  const membership = userOrganizations.find((m) => m.organizationId === orchestrator.organizationId);

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
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CHARTER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid charter ID format', CHARTER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = charterFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid query parameters', CHARTER_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const filters: CharterFiltersInput = parseResult.data;

    // Build where clause
    const where: Prisma.charterVersionWhereInput = {
      charterId: params.charterId,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Fetch charter versions and check access to the first one's orchestrator
    const [versions, totalCount] = await Promise.all([
      prisma.charterVersion.findMany({
        where,
        skip,
        take,
        orderBy: { version: 'desc' },
        include: {
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
      const access = await checkOrchestratorAccess(versions[0].orchestratorId, session.user.id);
      if (!access) {
        return NextResponse.json(
          createErrorResponse(
            'Orchestrator not found or access denied',
            CHARTER_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    return NextResponse.json({
      data: versions,
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
    console.error('[GET /api/charters/:charterId/versions] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CHARTER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
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
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CHARTER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid charter ID format', CHARTER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', CHARTER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createCharterVersionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', CHARTER_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const input: CreateCharterVersionInput = parseResult.data;

    // Ensure charterId matches the route parameter
    if (input.charterId !== params.charterId) {
      return NextResponse.json(
        createErrorResponse(
          'Charter ID mismatch between route and body',
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
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
          'No existing charter found. Use orchestrator charter API to create first version.',
          CHARTER_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check access and permissions
    const access = await checkOrchestratorAccess(existingVersion.orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          CHARTER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for admin/owner role
    if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to create charter version',
          CHARTER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Create new version in transaction
    const newVersion = await prisma.$transaction(async (tx) => {
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

      const nextVersion = input.version ?? (maxVersion ? maxVersion.version + 1 : 1);

      // Create new version
      return tx.charterVersion.create({
        data: {
          charterId: params.charterId,
          orchestratorId: existingVersion.orchestratorId,
          version: nextVersion,
          charterData: input.charterData as unknown as Prisma.InputJsonValue,
          changeLog: input.changeLog,
          createdBy: session.user.id,
          isActive: true,
        },
        include: {
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
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/charters/:charterId/versions] Error:', error);

    // Handle unique constraint errors
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse(
          'A charter version with this number already exists',
          CHARTER_ERROR_CODES.DUPLICATE_VERSION,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', CHARTER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
