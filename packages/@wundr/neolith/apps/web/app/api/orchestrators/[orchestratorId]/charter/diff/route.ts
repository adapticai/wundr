/**
 * Orchestrator Charter Diff API Route
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/charter/diff - Compare two charter versions
 *
 * @module app/api/orchestrators/[orchestratorId]/charter/diff/route
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

function diffCharterData(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      changes.push({ field: key, oldValue: a[key], newValue: b[key] });
    }
  }
  return changes;
}

/**
 * GET /api/orchestrators/:orchestratorId/charter/diff
 *
 * Compare two charter versions by their version numbers.
 *
 * Query params:
 * - versionA (number, required)
 * - versionB (number, required)
 * - charterId (required)
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
    const versionAParam = searchParams.get('versionA');
    const versionBParam = searchParams.get('versionB');
    const charterId = searchParams.get('charterId');

    if (!versionAParam || !versionBParam || !charterId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'versionA, versionB, and charterId are required'
        ),
        { status: 400 }
      );
    }

    const versionANum = parseInt(versionAParam, 10);
    const versionBNum = parseInt(versionBParam, 10);

    if (isNaN(versionANum) || isNaN(versionBNum)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'versionA and versionB must be valid integers'
        ),
        { status: 400 }
      );
    }

    const [versionA, versionB] = await Promise.all([
      prisma.charterVersion.findFirst({
        where: { orchestratorId, charterId, version: versionANum },
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
      prisma.charterVersion.findFirst({
        where: { orchestratorId, charterId, version: versionBNum },
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
    ]);

    if (!versionA) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          `Charter version ${versionANum} not found`
        ),
        { status: 404 }
      );
    }

    if (!versionB) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          `Charter version ${versionBNum} not found`
        ),
        { status: 404 }
      );
    }

    const dataA =
      versionA.charterData && typeof versionA.charterData === 'object'
        ? (versionA.charterData as Record<string, unknown>)
        : {};
    const dataB =
      versionB.charterData && typeof versionB.charterData === 'object'
        ? (versionB.charterData as Record<string, unknown>)
        : {};

    const changes = diffCharterData(dataA, dataB);

    return NextResponse.json({
      data: {
        versionA,
        versionB,
        changes,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/charter/diff] Error:',
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
