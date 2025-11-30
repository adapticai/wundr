/**
 * Charter Version Diff API Routes
 *
 * Handles comparing two charter versions.
 *
 * Routes:
 * - GET /api/charters/:charterId/diff?v1=1&v2=2 - Compare two versions
 *
 * @module app/api/charters/[charterId]/diff/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  charterIdParamSchema,
  diffQuerySchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { DiffQueryInput } from '@/lib/validations/charter';
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
 * Deep diff two objects, returning changed, added, and removed paths
 */
function deepDiff(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
  path = '',
): {
  changed: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  added: Array<{ path: string; value: unknown }>;
  removed: Array<{ path: string; value: unknown }>;
} {
  const result = {
    changed: [] as Array<{ path: string; oldValue: unknown; newValue: unknown }>,
    added: [] as Array<{ path: string; value: unknown }>,
    removed: [] as Array<{ path: string; value: unknown }>,
  };

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  allKeys.forEach((key) => {
    const currentPath = path ? `${path}.${key}` : key;
    const val1 = obj1[key];
    const val2 = obj2[key];

    // Key exists in obj2 but not in obj1
    if (!(key in obj1) && key in obj2) {
      result.added.push({ path: currentPath, value: val2 });
      return;
    }

    // Key exists in obj1 but not in obj2
    if (key in obj1 && !(key in obj2)) {
      result.removed.push({ path: currentPath, value: val1 });
      return;
    }

    // Both exist - check if values are different
    if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
      // Recursively diff nested objects
      if (!Array.isArray(val1) && !Array.isArray(val2)) {
        const nestedDiff = deepDiff(
          val1 as Record<string, unknown>,
          val2 as Record<string, unknown>,
          currentPath,
        );
        result.changed.push(...nestedDiff.changed);
        result.added.push(...nestedDiff.added);
        result.removed.push(...nestedDiff.removed);
        return;
      }
    }

    // Primitive comparison or array comparison (treat arrays as primitives)
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      result.changed.push({ path: currentPath, oldValue: val1, newValue: val2 });
    }
  });

  return result;
}

/**
 * GET /api/charters/:charterId/diff
 *
 * Compare two charter versions and return differences.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request object with query parameters v1 and v2
 * @param context - Route context containing charterId
 * @returns Diff object showing changes, additions, and removals
 *
 * @example
 * ```
 * GET /api/charters/charter_123/diff?v1=1&v2=2
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
    const parseResult = diffQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid query parameters', CHARTER_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const query: DiffQueryInput = parseResult.data;
    const version1 = parseInt(query.v1, 10);
    const version2 = parseInt(query.v2, 10);

    // Fetch both versions
    const [charterVersion1, charterVersion2] = await Promise.all([
      prisma.charterVersion.findFirst({
        where: {
          charterId: params.charterId,
          version: version1,
        },
        select: {
          id: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          createdAt: true,
          createdBy: true,
        },
      }),
      prisma.charterVersion.findFirst({
        where: {
          charterId: params.charterId,
          version: version2,
        },
        select: {
          id: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          createdAt: true,
          createdBy: true,
        },
      }),
    ]);

    // Check if both versions exist
    if (!charterVersion1) {
      return NextResponse.json(
        createErrorResponse(
          `Version ${version1} not found`,
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!charterVersion2) {
      return NextResponse.json(
        createErrorResponse(
          `Version ${version2} not found`,
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify both versions belong to same orchestrator
    if (charterVersion1.orchestratorId !== charterVersion2.orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Versions belong to different orchestrators',
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkOrchestratorAccess(charterVersion1.orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          CHARTER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Compute diff
    const diff = deepDiff(
      charterVersion1.charterData as Record<string, unknown>,
      charterVersion2.charterData as Record<string, unknown>,
    );

    return NextResponse.json({
      data: {
        version1: {
          version: charterVersion1.version,
          createdAt: charterVersion1.createdAt,
          createdBy: charterVersion1.createdBy,
        },
        version2: {
          version: charterVersion2.version,
          createdAt: charterVersion2.createdAt,
          createdBy: charterVersion2.createdBy,
        },
        diff: {
          changed: diff.changed,
          added: diff.added,
          removed: diff.removed,
          totalChanges: diff.changed.length + diff.added.length + diff.removed.length,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/charters/:charterId/diff] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CHARTER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
