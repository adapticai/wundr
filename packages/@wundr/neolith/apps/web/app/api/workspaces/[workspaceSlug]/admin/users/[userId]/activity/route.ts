/**
 * Admin User Activity API Routes
 *
 * Handles fetching user activity history.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/users/:userId/activity - Get user activity
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/[userId]/activity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/users/:userId/activity
 *
 * Get user activity history. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns User activity list
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceSlug, userId } = await context.params;

    // Find workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id
      },
    });

    if (!adminMembership || !['ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
      );
    }

    // Fetch user's recent activities
    // This is a placeholder - you can expand this based on your audit log implementation
    const [messages, tasks] = await Promise.all([
      // Recent messages
      prisma.message.findMany({
        where: {
          authorId: userId,
          channel: {
            workspaceId: workspace.id,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          content: true,
          createdAt: true,
          channel: {
            select: {
              name: true,
            },
          },
        },
      }),
      // Recent tasks
      prisma.task.findMany({
        where: {
          assignedToId: userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Combine and format activities
    const activities = [
      ...messages.map(msg => ({
        date: msg.createdAt.toISOString(),
        action: 'Posted message',
        resource: `#${msg.channel.name}`,
        details: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
      })),
      ...tasks.map(task => ({
        date: task.createdAt.toISOString(),
        action: 'Created task',
        resource: task.title,
        details: `Status: ${task.status}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return NextResponse.json({
      activities,
      total: activities.length,
    });
  } catch (error) {
    console.error('Failed to fetch user activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user activity' },
      { status: 500 },
    );
  }
}
