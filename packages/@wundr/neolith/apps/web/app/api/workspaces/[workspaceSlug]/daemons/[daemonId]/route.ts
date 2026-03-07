/**
 * Individual Daemon Node API Routes
 *
 * Operations on a single daemon node identified by its ID.
 *
 * Routes:
 * - GET    /api/workspaces/:workspaceSlug/daemons/:daemonId - Node details + health
 * - PUT    /api/workspaces/:workspaceSlug/daemons/:daemonId - Update configuration
 * - DELETE /api/workspaces/:workspaceSlug/daemons/:daemonId - Deregister node
 *
 * @module app/api/workspaces/[workspaceSlug]/daemons/[daemonId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; daemonId: string }>;
}

async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    select: { id: true, organizationId: true },
  });
  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });
  if (!orgMembership) return null;

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceSlug/daemons/:daemonId
 *
 * Returns detailed information and health metrics for a single daemon node.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug, daemonId } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    const node = await prisma.daemonNode.findUnique({
      where: { id: daemonId },
    });
    if (!node) {
      return NextResponse.json(
        { error: 'Daemon node not found' },
        { status: 404 }
      );
    }

    // Derive uptime heuristic from lastHeartbeat
    const uptimeMs = node.lastHeartbeat
      ? Date.now() - node.lastHeartbeat.getTime()
      : null;

    return NextResponse.json({
      data: {
        id: node.id,
        name: node.name,
        hostname: node.host,
        port: node.port,
        status: node.status,
        capabilities: node.capabilities,
        region: node.region,
        health: {
          cpuUsage: node.cpuUsage,
          memoryUsage: node.memoryUsage,
          activeSessions: node.activeSessions,
          uptimeMs,
        },
        lastHeartbeat: node.lastHeartbeat,
        createdAt: node.createdAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:slug/daemons/:id]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/daemons/:daemonId
 *
 * Update daemon node configuration.  Requires ADMIN or OWNER role.
 *
 * Accepted fields: name, hostname (host), port, capabilities, region, status
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug, daemonId } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Organisation admin or owner required.',
        },
        { status: 403 }
      );
    }

    const existing = await prisma.daemonNode.findUnique({
      where: { id: daemonId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Daemon node not found' },
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const VALID_STATUSES = ['ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE'];

    const updated = await prisma.daemonNode.update({
      where: { id: daemonId },
      data: {
        ...(typeof body.name === 'string' && { name: body.name }),
        ...(typeof body.hostname === 'string' && { host: body.hostname }),
        ...(typeof body.port === 'number' && { port: body.port }),
        ...(Array.isArray(body.capabilities) && {
          capabilities: body.capabilities as string[],
        }),
        ...(typeof body.region === 'string' && { region: body.region }),
        ...(typeof body.status === 'string' &&
          VALID_STATUSES.includes(body.status) && {
            status: body.status as
              | 'ONLINE'
              | 'OFFLINE'
              | 'DEGRADED'
              | 'MAINTENANCE',
          }),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        hostname: updated.host,
        port: updated.port,
        status: updated.status,
        capabilities: updated.capabilities,
        region: updated.region,
        health: {
          cpuUsage: updated.cpuUsage,
          memoryUsage: updated.memoryUsage,
          activeSessions: updated.activeSessions,
        },
        lastHeartbeat: updated.lastHeartbeat,
        createdAt: updated.createdAt,
      },
      message: 'Daemon node updated',
    });
  } catch (error) {
    console.error('[PUT /api/workspaces/:slug/daemons/:id]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/daemons/:daemonId
 *
 * Deregister (permanently delete) a daemon node.  Requires ADMIN or OWNER role.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug, daemonId } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Organisation admin or owner required.',
        },
        { status: 403 }
      );
    }

    const existing = await prisma.daemonNode.findUnique({
      where: { id: daemonId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Daemon node not found' },
        { status: 404 }
      );
    }

    await prisma.daemonNode.delete({ where: { id: daemonId } });

    return NextResponse.json({ message: 'Daemon node deregistered' });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:slug/daemons/:id]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
