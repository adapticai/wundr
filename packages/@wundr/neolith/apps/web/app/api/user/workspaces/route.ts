/**
 * User Workspaces API Routes
 *
 * Handles fetching workspaces for the authenticated user.
 *
 * Routes:
 * - GET /api/user/workspaces - List all workspaces the user has access to
 *
 * @module app/api/user/workspaces/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Workspace with membership information
 */
interface WorkspaceWithMembership {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: string;
  settings: unknown;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  };
  membership: {
    id: string;
    role: string;
    joinedAt: Date;
  };
  _count: {
    workspaceMembers: number;
    channels: number;
  };
}

/**
 * Pending workspace invite
 */
interface PendingInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  organizationName: string;
  invitedBy: string | null;
  invitedAt: Date;
}

/**
 * GET /api/user/workspaces
 *
 * Fetch all workspaces the authenticated user has access to.
 * Includes workspace membership role, organization info, and counts.
 *
 * @param request - Next.js request object
 * @returns List of workspaces with membership information
 *
 * @example
 * ```
 * GET /api/user/workspaces
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "workspaces": [
 *       {
 *         "id": "ws_123",
 *         "name": "Engineering",
 *         "slug": "engineering",
 *         "description": "Engineering team workspace",
 *         "avatarUrl": "https://...",
 *         "visibility": "PRIVATE",
 *         "organization": {
 *           "id": "org_123",
 *           "name": "Acme Inc",
 *           "slug": "acme"
 *         },
 *         "membership": {
 *           "id": "mem_123",
 *           "role": "ADMIN",
 *           "joinedAt": "2024-01-01T00:00:00.000Z"
 *         },
 *         "_count": {
 *           "workspaceMembers": 15,
 *           "channels": 8
 *         }
 *       }
 *     ],
 *     "invites": []
 *   }
 * }
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get all workspace memberships for the user
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        workspace: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                avatarUrl: true,
              },
            },
            _count: {
              select: {
                workspaceMembers: true,
                channels: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    // Transform the data to include membership info at the workspace level
    const workspaces: WorkspaceWithMembership[] = memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      description: membership.workspace.description,
      avatarUrl: membership.workspace.avatarUrl,
      visibility: membership.workspace.visibility,
      settings: membership.workspace.settings,
      organizationId: membership.workspace.organizationId,
      createdAt: membership.workspace.createdAt,
      updatedAt: membership.workspace.updatedAt,
      organization: membership.workspace.organization,
      membership: {
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
      _count: membership.workspace._count,
    }));

    // Check for pending workspace invites via notifications
    // In the future, this could be replaced with a dedicated workspace invite model
    const pendingInviteNotifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: 'CHANNEL_INVITE', // Reusing channel invite type for now
        read: false,
        resourceType: 'workspace',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform notifications into pending invites
    const invites: PendingInvite[] = await Promise.all(
      pendingInviteNotifications.map(async (notification) => {
        const metadata = notification.metadata as {
          workspaceId?: string;
          workspaceName?: string;
          organizationName?: string;
          invitedBy?: string;
        };

        return {
          id: notification.id,
          workspaceId: metadata.workspaceId || notification.resourceId || '',
          workspaceName: metadata.workspaceName || 'Unknown Workspace',
          organizationName: metadata.organizationName || 'Unknown Organization',
          invitedBy: metadata.invitedBy || null,
          invitedAt: notification.createdAt,
        };
      }),
    );

    return NextResponse.json({
      data: {
        workspaces,
        invites,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/workspaces] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
