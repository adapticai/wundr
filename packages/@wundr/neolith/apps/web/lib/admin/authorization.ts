/**
 * Admin Authorization Utilities
 *
 * Provides reusable authorization checks for admin routes.
 *
 * @module lib/admin/authorization
 */

import { prisma } from '@neolith/database';

import { auth } from '@/lib/auth';
import { ADMIN_ERROR_CODES } from '@/lib/validations/admin';

import type { Session } from 'next-auth';

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Check if user is authenticated and has admin access to workspace
 *
 * @param workspaceSlug - Workspace slug to check access for
 * @returns Session and workspace membership
 * @throws AuthorizationError if not authorized
 */
export async function requireWorkspaceAdmin(workspaceSlug: string): Promise<{
  session: Session;
  workspace: { id: string; slug: string; name: string };
  membership: { id: string; role: string; userId: string; workspaceId: string };
}> {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError(
      'Unauthorized',
      ADMIN_ERROR_CODES.UNAUTHORIZED,
      401
    );
  }

  // Get workspace
  const workspace = await prisma.workspace.findFirst({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true, name: true },
  });

  if (!workspace) {
    throw new AuthorizationError(
      'Workspace not found',
      ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND,
      404
    );
  }

  // Verify admin access
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId: session.user.id },
    select: { id: true, role: true, userId: true, workspaceId: true },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    throw new AuthorizationError(
      'Admin access required',
      ADMIN_ERROR_CODES.FORBIDDEN,
      403
    );
  }

  return { session, workspace, membership };
}

/**
 * Check if user is workspace owner
 *
 * @param workspaceSlug - Workspace slug to check access for
 * @returns Session and workspace membership
 * @throws AuthorizationError if not authorized
 */
export async function requireWorkspaceOwner(workspaceSlug: string): Promise<{
  session: Session;
  workspace: { id: string; slug: string; name: string };
  membership: { id: string; role: string; userId: string; workspaceId: string };
}> {
  const { session, workspace, membership } =
    await requireWorkspaceAdmin(workspaceSlug);

  if (membership.role !== 'OWNER') {
    throw new AuthorizationError(
      'Owner access required',
      ADMIN_ERROR_CODES.FORBIDDEN,
      403
    );
  }

  return { session, workspace, membership };
}

/**
 * Check if user can modify another member
 *
 * @param actorRole - Role of the user performing the action
 * @param targetRole - Role of the user being modified
 * @returns True if allowed
 */
export function canModifyMember(
  actorRole: string,
  targetRole: string
): boolean {
  const roleHierarchy: Record<string, number> = {
    OWNER: 3,
    ADMIN: 2,
    MEMBER: 1,
    GUEST: 0,
  };

  const actorLevel = roleHierarchy[actorRole] || 0;
  const targetLevel = roleHierarchy[targetRole] || 0;

  // Can only modify members with lower role level
  return actorLevel > targetLevel;
}

/**
 * Check if user can perform action
 *
 * @param role - User's role
 * @param action - Action to perform
 * @returns True if allowed
 */
export function hasPermission(role: string, action: string): boolean {
  const permissions: Record<string, string[]> = {
    OWNER: [
      'workspace.delete',
      'workspace.transfer',
      'settings.modify',
      'billing.modify',
      'members.invite',
      'members.remove',
      'members.modify_role',
      'members.suspend',
      'channels.create',
      'channels.delete',
      'channels.archive',
      'admin.actions',
      'audit.export',
    ],
    ADMIN: [
      'settings.modify',
      'members.invite',
      'members.remove',
      'members.modify_role',
      'members.suspend',
      'channels.create',
      'channels.delete',
      'channels.archive',
      'admin.actions',
      'audit.view',
    ],
    MEMBER: ['channels.create', 'messages.send'],
    GUEST: ['messages.view'],
  };

  const allowedActions = permissions[role] || [];
  return allowedActions.includes(action);
}

/**
 * Validate that user is not trying to modify themselves inappropriately
 *
 * @param actorId - ID of user performing action
 * @param targetId - ID of user being modified
 * @param action - Action being performed
 * @throws AuthorizationError if self-modification not allowed
 */
export function validateSelfModification(
  actorId: string,
  targetId: string,
  action: 'suspend' | 'remove' | 'change_role'
): void {
  if (actorId === targetId) {
    const errorMessages: Record<string, string> = {
      suspend: 'Cannot suspend yourself',
      remove: 'Cannot remove yourself',
      change_role: 'Cannot change your own role',
    };

    throw new AuthorizationError(
      errorMessages[action],
      ADMIN_ERROR_CODES.CANNOT_SUSPEND_SELF,
      403
    );
  }
}
