/**
 * Current Workspace API Route
 *
 * Manages the user's current/last-visited workspace preference.
 *
 * Routes:
 * - PUT /api/users/me/current-workspace - Update user's current workspace
 * - GET /api/users/me/current-workspace - Get user's current workspace
 *
 * @module app/api/users/me/current-workspace/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET /api/users/me/current-workspace
 *
 * Get the user's current workspace slug.
 *
 * @returns Current workspace slug or null
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentWorkspaceSlug: true },
    });

    return NextResponse.json({
      currentWorkspaceSlug: user?.currentWorkspaceSlug || null,
    });
  } catch (error) {
    console.error('[GET /api/users/me/current-workspace] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get current workspace' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/users/me/current-workspace
 *
 * Update the user's current workspace slug.
 * Called when user switches workspaces via WorkspaceSwitcher.
 *
 * @param request - Next.js request with { workspaceSlug: string }
 * @returns Updated workspace slug
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceSlug } = body;

    if (!workspaceSlug || typeof workspaceSlug !== 'string') {
      return NextResponse.json(
        { error: 'workspaceSlug is required' },
        { status: 400 },
      );
    }

    // Verify user has access to this workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspace: { slug: workspaceSlug },
      },
      include: {
        workspace: { select: { slug: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 },
      );
    }

    // Update user's current workspace
    await prisma.user.update({
      where: { id: session.user.id },
      data: { currentWorkspaceSlug: workspaceSlug },
    });

    return NextResponse.json({
      currentWorkspaceSlug: workspaceSlug,
      message: 'Current workspace updated',
    });
  } catch (error) {
    console.error('[PUT /api/users/me/current-workspace] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update current workspace' },
      { status: 500 },
    );
  }
}
