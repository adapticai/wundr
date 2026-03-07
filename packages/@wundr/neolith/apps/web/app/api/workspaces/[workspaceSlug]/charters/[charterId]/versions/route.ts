/**
 * Workspace-Scoped Charter Versions API Routes
 *
 * Handles listing all versions of a charter within a workspace context.
 * Versions are ordered by version number descending (newest first).
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/charters/:charterId/versions - List all versions
 *
 * @module app/api/workspaces/[workspaceSlug]/charters/[charterId]/versions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug, charter ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; charterId: string }>;
}

/**
 * Query parameters schema for version listing
 */
const versionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  isActive: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  includeDiff: z
    .string()
    .transform(v => v === 'true')
    .optional()
    .default('false'),
});

/**
 * Helper to resolve workspace from slug and verify user membership
 */
async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    include: { organization: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * Compute a lightweight diff summary between two charter data objects.
 * Identifies top-level keys that were added, removed, or modified.
 */
function computeDiffSummary(
  fromData: Record<string, unknown>,
  toData: Record<string, unknown>
): { added: string[]; removed: string[]; modified: string[] } {
  const fromKeys = new Set(Object.keys(fromData));
  const toKeys = new Set(Object.keys(toData));

  const added = [...toKeys].filter(k => !fromKeys.has(k));
  const removed = [...fromKeys].filter(k => !toKeys.has(k));
  const modified = [...fromKeys].filter(
    k =>
      toKeys.has(k) && JSON.stringify(fromData[k]) !== JSON.stringify(toData[k])
  );

  return { added, removed, modified };
}

/**
 * GET /api/workspaces/:workspaceSlug/charters/:charterId/versions
 *
 * List all versions of a charter, ordered by version number descending.
 * Optionally includes a diff summary between each consecutive version pair.
 *
 * Query Parameters:
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 * - isActive: Filter by active status
 * - includeDiff: Whether to include diff summary between consecutive versions (default false)
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

    const { workspaceSlug, charterId } = await context.params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Workspace not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const rawParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = versionsQuerySchema.safeParse(rawParams);
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

    const filters = parseResult.data;
    const skip = (filters.page - 1) * filters.limit;

    // Verify the charter exists within this org
    const charterExists = await prisma.charterVersion.findFirst({
      where: {
        charterId,
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      select: { orchestratorId: true },
    });

    if (!charterExists) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found'
        ),
        { status: 404 }
      );
    }

    const where = {
      charterId,
      orchestratorId: charterExists.orchestratorId,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const [versions, totalCount] = await Promise.all([
      prisma.charterVersion.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { version: 'desc' },
        select: {
          id: true,
          charterId: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          changeLog: true,
          isActive: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.charterVersion.count({ where }),
    ]);

    // Optionally attach diff summaries between consecutive versions
    let versionsWithDiff: Array<
      (typeof versions)[0] & {
        diffSummary: {
          added: string[];
          removed: string[];
          modified: string[];
        } | null;
      }
    > = versions.map(v => ({ ...v, diffSummary: null }));

    if (filters.includeDiff && versions.length > 1) {
      versionsWithDiff = versions.map((version, index) => {
        if (index === versions.length - 1) {
          // Oldest version in the page: no previous to compare against
          return { ...version, diffSummary: null };
        }
        const newerVersion = versions[index];
        const olderVersion = versions[index + 1];
        const diffSummary = computeDiffSummary(
          olderVersion.charterData as Record<string, unknown>,
          newerVersion.charterData as Record<string, unknown>
        );
        return { ...version, diffSummary };
      });
    }

    const totalPages = Math.ceil(totalCount / filters.limit);

    return NextResponse.json({
      data: versionsWithDiff,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      },
      charterId,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/charters/:charterId/versions] Error:',
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
