/**
 * Charter Rollback API Routes
 *
 * Handles rolling back to a previous charter version.
 *
 * Routes:
 * - POST /api/charters/:charterId/rollback - Rollback to specific version
 *
 * @module app/api/charters/[charterId]/rollback/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  rollbackCharterSchema,
  charterIdParamSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { RollbackCharterInput } from '@/lib/validations/charter';
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
 * POST /api/charters/:charterId/rollback
 *
 * Rollback to a previous charter version by creating a new version with the target version's data.
 * Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with rollback data
 * @param context - Route context containing charterId
 * @returns New charter version with rolled-back data
 *
 * @example
 * ```
 * POST /api/charters/charter_123/rollback
 * Content-Type: application/json
 *
 * {
 *   "targetVersion": 5,
 *   "changeLog": "Rollback to version 5 due to configuration issues"
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
    const paramResult = charterIdParamSchema.safeParse(params);
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
    const parseResult = rollbackCharterSchema.safeParse(body);
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

    const input: RollbackCharterInput = parseResult.data;

    // Find the target version to rollback to
    const targetVersionNumber = parseInt(input.targetVersion, 10);
    const targetVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId: params.charterId,
        version: targetVersionNumber,
      },
      select: {
        id: true,
        orchestratorId: true,
        version: true,
        charterData: true,
      },
    });

    if (!targetVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          `Target version ${input.targetVersion} not found`
        ),
        { status: 404 }
      );
    }

    // Check access and permissions
    const access = await checkOrchestratorAccess(
      targetVersion.orchestratorId,
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
          'Insufficient permissions to rollback charter version'
        ),
        { status: 403 }
      );
    }

    // Create new version with rollback data in transaction
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate current active version
      await tx.charterVersion.updateMany({
        where: {
          orchestratorId: targetVersion.orchestratorId,
          charterId: params.charterId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Get next version number
      const maxVersion = await tx.charterVersion.findFirst({
        where: {
          orchestratorId: targetVersion.orchestratorId,
          charterId: params.charterId,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = maxVersion ? maxVersion.version + 1 : 1;

      // Create new version with rolled-back data
      const changeLog =
        input.changeLog ?? `Rolled back to version ${input.targetVersion}`;

      return tx.charterVersion.create({
        data: {
          charterId: params.charterId,
          orchestratorId: targetVersion.orchestratorId,
          version: nextVersion,
          charterData: JSON.parse(
            JSON.stringify(targetVersion.charterData)
          ) as Prisma.InputJsonValue,
          changeLog,
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
      {
        data: newVersion,
        message: `Successfully rolled back to version ${input.targetVersion}`,
        rolledBackFrom: input.targetVersion,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/charters/:charterId/rollback] Error:', error);

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
