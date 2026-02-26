/**
 * Workspace Utility Functions
 *
 * Helper functions for workspace access validation and queries.
 *
 * @module lib/workspace
 */

import { prisma } from '@neolith/database';

/**
 * Workspace access result type
 */
export interface WorkspaceAccess {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
}

/**
 * Get workspace by slug and verify user has access
 *
 * @param workspaceSlug - The workspace slug to look up
 * @param userId - The user ID to check access for
 * @returns Workspace with access info, or null if not found/no access
 */
export async function getWorkspaceWithAccess(
  workspaceSlug: string,
  userId: string,
  organizationId?: string
): Promise<WorkspaceAccess | null> {
  try {
    // Find workspace by slug - need to filter by organizationId if provided
    // Otherwise find first matching slug
    const workspace = organizationId
      ? await prisma.workspace.findUnique({
          where: {
            organizationId_slug: {
              organizationId,
              slug: workspaceSlug,
            },
          },
          include: {
            workspaceMembers: {
              where: { userId },
              select: { role: true },
            },
          },
        })
      : await prisma.workspace.findFirst({
          where: { slug: workspaceSlug },
          include: {
            workspaceMembers: {
              where: { userId },
              select: { role: true },
            },
          },
        });

    if (!workspace) {
      return null;
    }

    // Check if user is a member
    const membership = workspace.workspaceMembers[0];
    if (!membership) {
      return null;
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      role: membership.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
    };
  } catch (error) {
    console.error('Error getting workspace with access:', error);
    return null;
  }
}

/**
 * Resolve workspace by ID or slug and verify user access via organization membership.
 * This is used by API routes that receive `workspaceSlug` from URL params.
 *
 * @param workspaceIdOrSlug - The workspace ID (CUID) or slug
 * @param userId - The user ID to check access for
 * @returns Workspace with organization membership, or null if not found/no access
 */
export async function resolveWorkspaceAccess(
  workspaceIdOrSlug: string,
  userId: string
) {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
      },
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

    return { workspace, orgMembership };
  } catch (error) {
    console.error('Error resolving workspace access:', error);
    return null;
  }
}

/**
 * Check if user has access to a workspace
 *
 * @param workspaceId - The workspace ID to check
 * @param userId - The user ID to check access for
 * @returns True if user has access, false otherwise
 */
export async function hasWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  try {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    return membership !== null;
  } catch (error) {
    console.error('Error checking workspace access:', error);
    return false;
  }
}

/**
 * Get user's role in a workspace
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user ID
 * @returns User's role or null if not a member
 */
export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' | null> {
  try {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });
    return membership?.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' | null;
  } catch (error) {
    console.error('Error getting workspace role:', error);
    return null;
  }
}
