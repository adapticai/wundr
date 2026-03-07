/**
 * Daemon Node Health Proxy Route
 *
 * Proxies a health check request to the daemon's own /health HTTP endpoint
 * and returns the result to the caller.
 *
 * Route:
 * - GET /api/workspaces/:workspaceSlug/daemons/:daemonId/health
 *
 * @module app/api/workspaces/[workspaceSlug]/daemons/[daemonId]/health/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; daemonId: string }>;
}

/** Timeout for the outbound health-check request in milliseconds. */
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

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
 * GET /api/workspaces/:workspaceSlug/daemons/:daemonId/health
 *
 * Fetches the /health endpoint of the target daemon and returns the result.
 * When the daemon is unreachable a structured error response is returned with
 * status 502 so the UI can display an "offline" indicator without crashing.
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

    const daemonHealthUrl = `http://${node.host}:${node.port}/health`;

    let healthData: unknown;
    let reachable = false;
    let latencyMs: number | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        HEALTH_CHECK_TIMEOUT_MS
      );

      const start = Date.now();
      const response = await fetch(daemonHealthUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      latencyMs = Date.now() - start;
      clearTimeout(timeoutId);

      reachable = response.ok;
      try {
        healthData = await response.json();
      } catch {
        healthData = { statusCode: response.status };
      }
    } catch (fetchError) {
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return NextResponse.json(
        {
          reachable: false,
          daemonId: node.id,
          hostname: node.host,
          port: node.port,
          error: `Daemon unreachable: ${errorMessage}`,
          checkedAt: new Date().toISOString(),
        },
        { status: 502 }
      );
    }

    // Update lastHeartbeat in our DB when the node responds
    if (reachable) {
      await prisma.daemonNode.update({
        where: { id: daemonId },
        data: { lastHeartbeat: new Date(), status: 'ONLINE' },
      });
    }

    return NextResponse.json({
      reachable,
      daemonId: node.id,
      hostname: node.host,
      port: node.port,
      latencyMs,
      health: healthData,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:slug/daemons/:id/health]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
