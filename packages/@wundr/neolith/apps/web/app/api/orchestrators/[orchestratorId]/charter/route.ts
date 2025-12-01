/**
 * Orchestrator Charter API Routes
 *
 * Handles getting and managing charters for orchestrators.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/charter - Get active charter for orchestrator
 * - POST /api/orchestrators/:orchestratorId/charter - Create/update charter
 *
 * @module app/api/orchestrators/[orchestratorId]/charter/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  charterVersionCreateSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { CharterVersionCreateInput } from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
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
      role: true,
      discipline: true,
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
 * GET /api/orchestrators/:orchestratorId/charter
 *
 * Get the active charter for an orchestrator. If no active charter exists,
 * returns 404. Requires authentication and organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestratorId
 * @returns Active charter version
 *
 * @example
 * ```
 * GET /api/orchestrators/orch_123/charter
 * ```
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
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Get and validate orchestratorId
    const params = await context.params;
    const orchestratorId = params.orchestratorId;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Orchestrator ID is required'
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkOrchestratorAccess(
      orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found or access denied'
        ),
        { status: 404 }
      );
    }

    // Find active charter version
    const activeCharter = await prisma.charterVersion.findFirst({
      where: {
        orchestratorId,
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
      orderBy: { version: 'desc' },
    });

    if (!activeCharter) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.NO_ACTIVE_VERSION,
          'No active charter found for this orchestrator'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: activeCharter });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/charter] Error:',
      error
    );
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
 * POST /api/orchestrators/:orchestratorId/charter
 *
 * Create or update a charter for an orchestrator. This creates a new version
 * of the charter and marks it as active. Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with charter data
 * @param context - Route context containing orchestratorId
 * @returns Created charter version
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/charter
 * Content-Type: application/json
 *
 * {
 *   "charterId": "backend-engineer-v1",
 *   "charterData": {
 *     "version": "1.0.0",
 *     "identity": {
 *       "name": "Backend Engineer",
 *       "role": "Senior Backend Engineer",
 *       "discipline": "Engineering",
 *       "mission": "Build scalable backend systems"
 *     },
 *     "capabilities": {
 *       "capabilities": ["API Design", "Database Optimization"],
 *       "skills": ["Node.js", "PostgreSQL"],
 *       "tools": ["Docker", "Kubernetes"]
 *     }
 *   },
 *   "changeLog": "Initial charter creation"
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

    // Get and validate orchestratorId
    const params = await context.params;
    const orchestratorId = params.orchestratorId;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Orchestrator ID is required'
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

    // Add orchestratorId to body for validation
    const inputWithOrchestrator = {
      ...(typeof body === 'object' && body !== null ? body : {}),
      orchestratorId,
    };

    // Validate input
    const parseResult = charterVersionCreateSchema.safeParse(
      inputWithOrchestrator
    );
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

    const input: CharterVersionCreateInput = parseResult.data;

    // Check access and permissions
    const access = await checkOrchestratorAccess(
      orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found or access denied'
        ),
        { status: 404 }
      );
    }

    // Check for admin/owner role
    if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions to create/update charter'
        ),
        { status: 403 }
      );
    }

    // Create new charter version in transaction
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate current active versions for this charter
      await tx.charterVersion.updateMany({
        where: {
          orchestratorId,
          charterId: input.charterId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Get next version number if not provided
      const maxVersion = await tx.charterVersion.findFirst({
        where: {
          orchestratorId,
          charterId: input.charterId,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion =
        input.version ?? (maxVersion ? maxVersion.version + 1 : 1);

      // Create new version
      return tx.charterVersion.create({
        data: {
          charterId: input.charterId,
          orchestratorId,
          version: nextVersion,
          charterData: input.charterData as unknown as Prisma.InputJsonValue,
          changeLog: input.changeLog ?? 'Charter created/updated',
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
      { data: newVersion, message: 'Charter created/updated successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/orchestrators/:orchestratorId/charter] Error:',
      error
    );

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
