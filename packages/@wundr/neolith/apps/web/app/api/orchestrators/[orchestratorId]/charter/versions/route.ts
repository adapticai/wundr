/**
 * Orchestrator Charter Versions API Route
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/charter/versions - List all charter versions
 *
 * @module app/api/orchestrators/[orchestratorId]/charter/versions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

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
 * GET /api/orchestrators/:orchestratorId/charter/versions
 *
 * List all charter versions for an orchestrator, ordered by version desc.
 *
 * Query params:
 * - skip (default 0)
 * - take (default 20)
 * - charterId (optional filter)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
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

    const { searchParams } = new URL(request.url);
    const skip = Math.max(
      0,
      parseInt(searchParams.get('skip') ?? '0', 10) || 0
    );
    const take = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20)
    );
    const charterId = searchParams.get('charterId') ?? undefined;

    const where = {
      orchestratorId,
      ...(charterId ? { charterId } : {}),
    };

    const [versions, total] = await Promise.all([
      prisma.charterVersion.findMany({
        where,
        orderBy: { version: 'desc' },
        skip,
        take,
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

    return NextResponse.json({
      data: versions,
      pagination: {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/charter/versions] Error:',
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
