/**
 * Organization Hierarchy API Route
 *
 * Handles fetching organization hierarchy data in tree structure.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/org-hierarchy - Get organization hierarchy tree
 *
 * @module app/api/workspaces/[workspaceId]/org-hierarchy/route
 */

import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type {
  OrgHierarchyNode,
  OrgHierarchyResponse,
  OrgHierarchyStats,
  OrchestratorNodeData,
  WorkspaceNodeData,
} from '@/lib/validations/org-hierarchy';
import { ORG_HIERARCHY_ERROR_CODES } from '@/lib/validations/org-hierarchy';
import { createErrorResponse, ORG_ERROR_CODES } from '@/lib/validations/organization';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Helper to check workspace access via organization membership
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: true,
    },
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

  return {
    workspace,
    orgMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/org-hierarchy
 *
 * Get organization hierarchy tree for visualization.
 * Returns workspaces with Orchestrators grouped by discipline.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns Organization hierarchy tree with stats
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<{ data: OrgHierarchyResponse } | { error: string; code: string }>> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_HIERARCHY_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID format (basic check)
    if (!workspaceId || workspaceId.trim().length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_HIERARCHY_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access to workspace
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_HIERARCHY_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const { workspace } = access;
    const organizationId = workspace.organizationId;

    // Fetch organization with all workspaces
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        workspaces: {
          include: {
            _count: {
              select: {
                workspaceMembers: true,
                channels: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found',
          ORG_HIERARCHY_ERROR_CODES.ORGANIZATION_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch all Orchestrators for the organization (both workspace-specific and org-wide)
    const orchestrators = await prisma.orchestrator.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            displayName: true,
            status: true,
          },
        },
        disciplineRef: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    // Fetch current tasks for all Orchestrators in parallel
    const orchestratorTasksPromises = orchestrators.map(async (orchestrator) => {
      const currentTask = await prisma.task.findFirst({
        where: {
          orchestratorId: orchestrator.id,
          status: { in: ['IN_PROGRESS', 'TODO'] },
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }],
        select: {
          id: true,
          title: true,
        },
      });
      return { orchestratorId: orchestrator.id, currentTask };
    });

    const orchestratorTasksResults = await Promise.all(orchestratorTasksPromises);
    const orchestratorTasksMap = new Map(orchestratorTasksResults.map((r) => [r.orchestratorId, r.currentTask]));

    // Build hierarchy tree
    const hierarchy: OrgHierarchyNode[] = [];

    // Group Orchestrators by workspace and discipline
    const workspaceOrchestratorsMap = new Map<string, typeof orchestrators>();
    const orgWideOrchestrators: typeof orchestrators = [];

    for (const orchestrator of orchestrators) {
      if (orchestrator.workspaceId) {
        const existing = workspaceOrchestratorsMap.get(orchestrator.workspaceId) || [];
        existing.push(orchestrator);
        workspaceOrchestratorsMap.set(orchestrator.workspaceId, existing);
      } else {
        orgWideOrchestrators.push(orchestrator);
      }
    }

    // Process each workspace
    for (const ws of organization.workspaces) {
      const workspaceOrchestrators = workspaceOrchestratorsMap.get(ws.id) || [];

      // Group Orchestrators by discipline
      const disciplineMap = new Map<string, typeof orchestrators>();
      const noDisciplineOrchestrators: typeof orchestrators = [];

      for (const orchestrator of workspaceOrchestrators) {
        if (orchestrator.disciplineRef) {
          const disciplineKey = orchestrator.disciplineRef.id;
          const existing = disciplineMap.get(disciplineKey) || [];
          existing.push(orchestrator);
          disciplineMap.set(disciplineKey, existing);
        } else {
          noDisciplineOrchestrators.push(orchestrator);
        }
      }

      // Build discipline nodes
      const disciplineNodes: OrgHierarchyNode[] = [];

      for (const [disciplineId, disciplineOrchestrators] of disciplineMap.entries()) {
        const firstOrchestrator = disciplineOrchestrators[0];
        const disciplineName = firstOrchestrator?.disciplineRef?.name || 'Unknown';

        // Build Orchestrator nodes for this discipline
        const orchestratorNodes: OrgHierarchyNode[] = disciplineOrchestrators.map((orchestrator) => {
          const currentTask = orchestratorTasksMap.get(orchestrator.id);
          const orchestratorData: OrchestratorNodeData = {
            avatarUrl: orchestrator.user.avatarUrl,
            status: orchestrator.status,
            discipline: orchestrator.disciplineRef?.name || null,
            role: orchestrator.role,
            currentTask: currentTask || null,
            email: orchestrator.user.email,
          };

          return {
            id: orchestrator.id,
            type: 'orchestrator' as const,
            name: orchestrator.user.displayName || orchestrator.user.name || orchestrator.user.email || 'Unknown Orchestrator',
            data: orchestratorData,
          };
        });

        disciplineNodes.push({
          id: disciplineId,
          type: 'discipline' as const,
          name: disciplineName,
          children: orchestratorNodes,
        });
      }

      // Add Orchestrators without discipline directly to workspace
      const noDisciplineOrchestratorNodes: OrgHierarchyNode[] = noDisciplineOrchestrators.map((orchestrator) => {
        const currentTask = orchestratorTasksMap.get(orchestrator.id);
        const orchestratorData: OrchestratorNodeData = {
          avatarUrl: orchestrator.user.avatarUrl,
          status: orchestrator.status,
          discipline: null,
          role: orchestrator.role,
          currentTask: currentTask || null,
          email: orchestrator.user.email,
        };

        return {
          id: orchestrator.id,
          type: 'orchestrator' as const,
          name: orchestrator.user.displayName || orchestrator.user.name || orchestrator.user.email || 'Unknown Orchestrator',
          data: orchestratorData,
        };
      });

      // Build workspace node
      const workspaceData: WorkspaceNodeData = {
        description: ws.description,
        visibility: ws.visibility,
        memberCount: ws._count.workspaceMembers,
      };

      const workspaceNode: OrgHierarchyNode = {
        id: ws.id,
        type: 'workspace' as const,
        name: ws.name,
        children: [...disciplineNodes, ...noDisciplineOrchestratorNodes],
        data: workspaceData,
      };

      hierarchy.push(workspaceNode);
    }

    // Calculate statistics
    const totalOrchestrators = orchestrators.length;
    const onlineOrchestrators = orchestrators.filter((orchestrator) => orchestrator.status === 'ONLINE').length;
    const totalWorkspaces = organization.workspaces.length;
    const totalChannels = organization.workspaces.reduce(
      (sum, ws) => sum + ws._count.channels,
      0,
    );

    const stats: OrgHierarchyStats = {
      totalOrchestrators,
      onlineOrchestrators,
      totalWorkspaces,
      totalChannels,
    };

    // Build response
    const response: OrgHierarchyResponse = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      hierarchy,
      stats,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/org-hierarchy] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
