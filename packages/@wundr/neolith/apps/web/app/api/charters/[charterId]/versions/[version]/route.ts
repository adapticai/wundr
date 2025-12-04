/**
 * Specific Charter Version API Routes
 *
 * Handles operations on individual charter versions.
 *
 * Routes:
 * - GET /api/charters/:charterId/versions/:version - Get specific version
 * - PATCH /api/charters/:charterId/versions/:version - Update version metadata
 *
 * @module app/api/charters/[charterId]/versions/[version]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateCharterVersionSchema,
  charterIdParamSchema,
  versionParamSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { UpdateCharterVersionInput } from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Route context with charterId and version parameters
 */
interface RouteContext {
  params: Promise<{ charterId: string; version: string }>;
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
 * GET /api/charters/:charterId/versions/:version
 *
 * Get details for a specific charter version.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing charterId and version
 * @returns Charter version details
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

    // Validate parameters
    const params = await context.params;
    const charterIdResult = charterIdParamSchema.safeParse({
      charterId: params.charterId,
    });
    const versionResult = versionParamSchema.safeParse({
      version: params.version,
    });

    if (!charterIdResult.success || !versionResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID or version format'
        ),
        { status: 400 }
      );
    }

    const version = parseInt(params.version, 10);

    // Fetch charter version
    const charterVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId: params.charterId,
        version,
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

    if (!charterVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    // Check access
    const access = await checkOrchestratorAccess(
      charterVersion.orchestratorId,
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

    return NextResponse.json({ data: charterVersion });
  } catch (error) {
    console.error(
      '[GET /api/charters/:charterId/versions/:version] Error:',
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
 * PATCH /api/charters/:charterId/versions/:version
 *
 * Update charter version metadata (changeLog only).
 * Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing charterId and version
 * @returns Updated charter version object
 */
export async function PATCH(
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

    // Validate parameters
    const params = await context.params;
    const charterIdResult = charterIdParamSchema.safeParse({
      charterId: params.charterId,
    });
    const versionResult = versionParamSchema.safeParse({
      version: params.version,
    });

    if (!charterIdResult.success || !versionResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID or version format'
        ),
        { status: 400 }
      );
    }

    const version = parseInt(params.version, 10);

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
    const parseResult = updateCharterVersionSchema.safeParse(body);
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

    const input: UpdateCharterVersionInput = parseResult.data;

    // Fetch charter version
    const charterVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId: params.charterId,
        version,
      },
      select: {
        id: true,
        orchestratorId: true,
      },
    });

    if (!charterVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    // Check access and permissions
    const access = await checkOrchestratorAccess(
      charterVersion.orchestratorId,
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
          'Insufficient permissions to update charter version'
        ),
        { status: 403 }
      );
    }

    // Update charter version
    const updatedVersion = await prisma.charterVersion.update({
      where: { id: charterVersion.id },
      data: {
        ...(input.changeLog !== undefined && { changeLog: input.changeLog }),
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

    return NextResponse.json({
      data: updatedVersion,
      message: 'Charter version updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/charters/:charterId/versions/:version] Error:',
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
