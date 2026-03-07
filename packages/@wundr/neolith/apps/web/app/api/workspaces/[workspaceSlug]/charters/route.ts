/**
 * Workspace-Scoped Charter API Routes
 *
 * Handles listing and creating charters within a workspace context.
 * Charters define the identity, capabilities, and operational parameters
 * for Orchestrator (Tier 1) and Session Manager (Tier 2) agents.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/charters - List all charters in the workspace
 * - POST /api/workspaces/:workspaceSlug/charters - Create a new charter
 *
 * @module app/api/workspaces/[workspaceSlug]/charters/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Query filter schema for listing charters
 */
const charterListFiltersSchema = z.object({
  type: z.enum(['orchestrator', 'session-manager']).optional(),
  discipline: z.string().optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'name', 'version'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Schema for creating an orchestrator charter (Tier 1)
 */
const createOrchestratorCharterSchema = z.object({
  type: z.literal('orchestrator'),
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  charterId: z.string().optional(),
  charterData: z
    .object({
      id: z.string().optional(),
      tier: z.literal(1),
      identity: z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100),
        persona: z.string().min(1).max(2000),
        slackHandle: z.string().optional(),
        email: z.string().email().optional(),
        avatarUrl: z.string().url().optional(),
      }),
      coreDirective: z.string().min(10).max(2000),
      capabilities: z
        .array(
          z.enum([
            'context_compilation',
            'resource_management',
            'slack_operations',
            'session_spawning',
            'task_triage',
            'memory_management',
          ])
        )
        .min(1),
      mcpTools: z.array(z.string()).default([]),
      resourceLimits: z.object({
        maxConcurrentSessions: z.number().int().positive(),
        tokenBudgetPerHour: z.number().int().positive(),
        maxMemoryMB: z.number().int().positive(),
        maxCpuPercent: z.number().min(0).max(100),
      }),
      objectives: z.object({
        responseTimeTarget: z.number().positive(),
        taskCompletionRate: z.number().min(0).max(100),
        qualityScore: z.number().min(0).max(100),
        customMetrics: z.record(z.number()).optional(),
      }),
      constraints: z.object({
        forbiddenCommands: z.array(z.string()),
        forbiddenPaths: z.array(z.string()),
        forbiddenActions: z.array(z.string()),
        requireApprovalFor: z.array(z.string()),
      }),
      disciplineIds: z.array(z.string()),
      nodeId: z.string().optional(),
    })
    .passthrough(),
  changeLog: z.string().optional(),
});

/**
 * Schema for creating a session manager charter (Tier 2)
 */
const createSessionManagerCharterSchema = z.object({
  type: z.literal('session-manager'),
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
  charterId: z.string().optional(),
  charterData: z
    .object({
      id: z.string().optional(),
      tier: z.literal(2),
      identity: z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100),
        persona: z.string().min(1).max(2000),
        slackHandle: z.string().optional(),
        email: z.string().email().optional(),
        avatarUrl: z.string().url().optional(),
      }),
      coreDirective: z.string().min(10).max(2000),
      disciplineId: z.string().min(1),
      parentVpId: z.string().min(1),
      mcpTools: z.array(z.string()).default([]),
      agentIds: z.array(z.string()).default([]),
      objectives: z.object({
        responseTimeTarget: z.number().positive(),
        taskCompletionRate: z.number().min(0).max(100),
        qualityScore: z.number().min(0).max(100),
        customMetrics: z.record(z.number()).optional(),
      }),
      constraints: z.object({
        forbiddenCommands: z.array(z.string()),
        forbiddenPaths: z.array(z.string()),
        forbiddenActions: z.array(z.string()),
        requireApprovalFor: z.array(z.string()),
      }),
      memoryBankPath: z.string(),
    })
    .passthrough(),
  changeLog: z.string().optional(),
});

/**
 * Union schema accepting either orchestrator or session-manager charter types
 */
const createCharterBodySchema = z.discriminatedUnion('type', [
  createOrchestratorCharterSchema,
  createSessionManagerCharterSchema,
]);

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
 * GET /api/workspaces/:workspaceSlug/charters
 *
 * List all charters in the workspace, scoped to the workspace's organization.
 * Supports filtering by type (orchestrator, session-manager) and discipline.
 * Includes the latest active version info for each charter.
 *
 * Query Parameters:
 * - type: Filter by charter type (orchestrator, session-manager)
 * - discipline: Filter by discipline
 * - search: Search by charter name/identity
 * - isActive: Filter by active status (true/false)
 * - sortBy: Sort field (createdAt, updatedAt, name, version)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
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

    const { workspaceSlug } = await context.params;

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
    const parseResult = charterListFiltersSchema.safeParse(rawParams);
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

    // Build where clause scoped to the org's orchestrators
    const where: Prisma.charterVersionWhereInput = {
      orchestrator: {
        organizationId: access.workspace.organizationId,
      },
      isActive: true,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.search && {
        charterData: {
          path: ['identity', 'name'],
          string_contains: filters.search,
        },
      }),
    };

    // Filter by type (tier) using charterData JSON field
    if (filters.type === 'orchestrator') {
      where.charterData = {
        ...(where.charterData as object | undefined),
        path: ['tier'],
        equals: 1,
      };
    } else if (filters.type === 'session-manager') {
      where.charterData = {
        ...(where.charterData as object | undefined),
        path: ['tier'],
        equals: 2,
      };
    }

    // Filter by discipline using charterData JSON field
    if (filters.discipline) {
      where.charterData = {
        ...(where.charterData as object | undefined),
        path: ['disciplineId'],
        string_contains: filters.discipline,
      };
    }

    const orderByField =
      filters.sortBy === 'name' || filters.sortBy === 'version'
        ? 'createdAt'
        : filters.sortBy;

    const [versions, totalCount] = await Promise.all([
      prisma.charterVersion.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [orderByField]: filters.sortOrder },
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
          orchestrator: {
            select: {
              id: true,
              discipline: true,
              role: true,
              organizationId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.charterVersion.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / filters.limit);

    return NextResponse.json({
      data: versions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      },
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/charters] Error:',
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
 * POST /api/workspaces/:workspaceSlug/charters
 *
 * Create a new charter for an orchestrator within this workspace.
 * Validates the charter JSON against the OrchestratorCharter or SessionManagerCharter schema.
 * Creates the initial version in the charterVersion table using a Prisma transaction.
 * Requires ADMIN or OWNER role in the workspace's organization.
 *
 * Request Body:
 * - type: Charter type ("orchestrator" | "session-manager")
 * - orchestratorId: ID of the orchestrator this charter belongs to
 * - charterId: Optional stable charter ID (generated if omitted)
 * - charterData: Full charter JSON matching the Tier 1 or Tier 2 schema
 * - changeLog: Optional description of changes for version history
 */
export async function POST(
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

    const { workspaceSlug } = await context.params;

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

    // Require ADMIN or OWNER to create charters
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Organization Admin or Owner role required to create charters.'
        ),
        { status: 403 }
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

    // Validate charter body
    const parseResult = createCharterBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Charter validation failed',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Verify the orchestrator belongs to this workspace's organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: input.orchestratorId,
        organizationId: access.workspace.organizationId,
      },
      select: { id: true, organizationId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found or does not belong to this workspace'
        ),
        { status: 404 }
      );
    }

    // Determine stable charterId: use provided or generate from orchestratorId + type
    const charterId =
      input.charterId ??
      `charter-${input.orchestratorId}-${input.type}-${Date.now()}`;

    // Check if a charter already exists for this charterId to determine version
    const existingLatestVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId,
        orchestratorId: input.orchestratorId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    if (existingLatestVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.DUPLICATE_VERSION,
          'A charter with this ID already exists. Use the charter update endpoint to create a new version.'
        ),
        { status: 409 }
      );
    }

    // Create the initial charter version in a transaction
    const newVersion = await prisma.$transaction(async tx => {
      return tx.charterVersion.create({
        data: {
          charterId,
          orchestratorId: input.orchestratorId,
          version: 1,
          charterData: input.charterData as unknown as Prisma.InputJsonValue,
          changeLog: input.changeLog ?? 'Initial version',
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
          orchestrator: {
            select: {
              id: true,
              discipline: true,
              role: true,
              organizationId: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        data: newVersion,
        message: 'Charter created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/charters] Error:',
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.DUPLICATE_VERSION,
          'A charter version with this combination already exists'
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
