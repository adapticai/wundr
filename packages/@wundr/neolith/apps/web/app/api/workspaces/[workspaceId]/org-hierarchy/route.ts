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
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { ORG_HIERARCHY_ERROR_CODES } from '@/lib/validations/org-hierarchy';
import { createErrorResponse, ORG_ERROR_CODES } from '@/lib/validations/organization';

import type {
  OrgHierarchyNode,
  OrgHierarchyResponse,
  OrgHierarchyStats,
  VPNodeData,
  WorkspaceNodeData,
} from '@/lib/validations/org-hierarchy';
import type { NextRequest } from 'next/server';

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
 * Returns workspaces with VPs grouped by discipline.
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

    // Fetch all VPs for the organization (both workspace-specific and org-wide)
    const vps = await prisma.vP.findMany({
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

    // Fetch current tasks for all VPs in parallel
    const vpTasksPromises = vps.map(async (vp) => {
      const currentTask = await prisma.task.findFirst({
        where: {
          vpId: vp.id,
          status: { in: ['IN_PROGRESS', 'TODO'] },
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }],
        select: {
          id: true,
          title: true,
        },
      });
      return { vpId: vp.id, currentTask };
    });

    const vpTasksResults = await Promise.all(vpTasksPromises);
    const vpTasksMap = new Map(vpTasksResults.map((r) => [r.vpId, r.currentTask]));

    // Build hierarchy tree
    const hierarchy: OrgHierarchyNode[] = [];

    // Group VPs by workspace and discipline
    const workspaceVPsMap = new Map<string, typeof vps>();
    const orgWideVPs: typeof vps = [];

    for (const vp of vps) {
      if (vp.workspaceId) {
        const existing = workspaceVPsMap.get(vp.workspaceId) || [];
        existing.push(vp);
        workspaceVPsMap.set(vp.workspaceId, existing);
      } else {
        orgWideVPs.push(vp);
      }
    }

    // Process each workspace
    for (const ws of organization.workspaces) {
      const workspaceVPs = workspaceVPsMap.get(ws.id) || [];

      // Group VPs by discipline
      const disciplineMap = new Map<string, typeof vps>();
      const noDisciplineVPs: typeof vps = [];

      for (const vp of workspaceVPs) {
        if (vp.disciplineRef) {
          const disciplineKey = vp.disciplineRef.id;
          const existing = disciplineMap.get(disciplineKey) || [];
          existing.push(vp);
          disciplineMap.set(disciplineKey, existing);
        } else {
          noDisciplineVPs.push(vp);
        }
      }

      // Build discipline nodes
      const disciplineNodes: OrgHierarchyNode[] = [];

      for (const [disciplineId, disciplineVPs] of disciplineMap.entries()) {
        const firstVP = disciplineVPs[0];
        const disciplineName = firstVP?.disciplineRef?.name || 'Unknown';

        // Build VP nodes for this discipline
        const vpNodes: OrgHierarchyNode[] = disciplineVPs.map((vp) => {
          const currentTask = vpTasksMap.get(vp.id);
          const vpData: VPNodeData = {
            avatarUrl: vp.user.avatarUrl,
            status: vp.status,
            discipline: vp.disciplineRef?.name || null,
            role: vp.role,
            currentTask: currentTask || null,
            email: vp.user.email,
          };

          return {
            id: vp.id,
            type: 'vp' as const,
            name: vp.user.displayName || vp.user.name || vp.user.email || 'Unknown VP',
            data: vpData,
          };
        });

        disciplineNodes.push({
          id: disciplineId,
          type: 'discipline' as const,
          name: disciplineName,
          children: vpNodes,
        });
      }

      // Add VPs without discipline directly to workspace
      const noDisciplineVPNodes: OrgHierarchyNode[] = noDisciplineVPs.map((vp) => {
        const currentTask = vpTasksMap.get(vp.id);
        const vpData: VPNodeData = {
          avatarUrl: vp.user.avatarUrl,
          status: vp.status,
          discipline: null,
          role: vp.role,
          currentTask: currentTask || null,
          email: vp.user.email,
        };

        return {
          id: vp.id,
          type: 'vp' as const,
          name: vp.user.displayName || vp.user.name || vp.user.email || 'Unknown VP',
          data: vpData,
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
        children: [...disciplineNodes, ...noDisciplineVPNodes],
        data: workspaceData,
      };

      hierarchy.push(workspaceNode);
    }

    // Calculate statistics
    const totalVPs = vps.length;
    const onlineVPs = vps.filter((vp) => vp.status === 'ONLINE').length;
    const totalWorkspaces = organization.workspaces.length;
    const totalChannels = organization.workspaces.reduce(
      (sum, ws) => sum + ws._count.channels,
      0,
    );

    const stats: OrgHierarchyStats = {
      totalVPs,
      onlineVPs,
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
