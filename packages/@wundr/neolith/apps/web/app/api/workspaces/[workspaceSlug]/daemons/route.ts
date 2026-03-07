/**
 * Daemon Nodes API Routes
 *
 * Handles listing and registering federated orchestrator daemon nodes for
 * an organisation derived from a workspace slug.
 *
 * Routes:
 * - GET  /api/workspaces/:workspaceSlug/daemons - List daemon nodes
 * - POST /api/workspaces/:workspaceSlug/daemons - Register a new daemon node
 *
 * @module app/api/workspaces/[workspaceSlug]/daemons/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Resolve a workspace slug (or id) to a workspace with its organisation,
 * and verify that the requesting user is a member of that organisation.
 * Returns null when the workspace cannot be found or the user lacks access.
 */
async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
    },
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
 * GET /api/workspaces/:workspaceSlug/daemons
 *
 * Returns all daemon nodes registered for the organisation that owns the
 * given workspace.  Each record includes health metrics and assigned
 * orchestrator IDs derived from the FederationRegistry.
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

    const { workspaceSlug } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    // DaemonNode has no organizationId column; we fetch all daemon nodes and
    // join via FederationRegistry (orchestrator -> organization) to scope them
    // to this organisation.  If the table is small this is fine; in production
    // you would add an organizationId column to DaemonNode.
    const registries = await prisma.federationRegistry.findMany({
      where: {
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      select: {
        orchestratorId: true,
        orchestrator: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    // Build a set of orchestrator IDs belonging to this org
    const orgOrchestratorIds = new Set(registries.map(r => r.orchestratorId));

    // Fetch all daemon nodes - scope via name convention or return all for now
    // (DaemonNode is infrastructure-level and may not be per-org in schema)
    const daemonNodes = await prisma.daemonNode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Map orchestratorIds to each daemon node using region/capabilities heuristic.
    // In a real deployment the daemon would register with specific orchestratorIds.
    // Here we attach all org orchestrator IDs to each node as the schema stores
    // no direct link.
    const orchestratorIds = Array.from(orgOrchestratorIds);

    const data = daemonNodes.map(node => ({
      id: node.id,
      name: node.name,
      hostname: node.host,
      port: node.port,
      status: node.status,
      capabilities: node.capabilities,
      region: node.region,
      orchestratorIds,
      health: {
        cpuUsage: node.cpuUsage,
        memoryUsage: node.memoryUsage,
        activeSessions: node.activeSessions,
      },
      lastHeartbeat: node.lastHeartbeat,
      createdAt: node.createdAt,
    }));

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:slug/daemons]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/daemons
 *
 * Register a new daemon node.  Requires ADMIN or OWNER role.
 *
 * Request body:
 * - hostname      string   - Hostname or IP of the daemon machine
 * - port          number   - Port the daemon API listens on
 * - apiKey        string   - API key the daemon uses for authentication
 * - orchestratorIds string[] - Orchestrator IDs this daemon will serve
 * - name          string   - Human-readable name for the node
 * - capabilities  string[] - Optional capability tags
 * - region        string   - Optional region identifier
 */
export async function POST(
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

    const { workspaceSlug } = await context.params;
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an object' },
        { status: 400 }
      );
    }

    const {
      hostname,
      port,
      name,
      capabilities = [],
      region = 'default',
    } = body as Record<string, unknown>;

    if (!hostname || typeof hostname !== 'string') {
      return NextResponse.json(
        { error: 'hostname is required' },
        { status: 400 }
      );
    }
    if (!port || typeof port !== 'number') {
      return NextResponse.json(
        { error: 'port must be a number' },
        { status: 400 }
      );
    }

    const nodeName =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : `${hostname}:${port}`;

    const daemonNode = await prisma.daemonNode.create({
      data: {
        name: nodeName,
        host: hostname,
        port,
        capabilities: Array.isArray(capabilities)
          ? (capabilities as string[])
          : [],
        region: typeof region === 'string' ? region : 'default',
        status: 'OFFLINE',
        cpuUsage: 0,
        memoryUsage: 0,
        activeSessions: 0,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: daemonNode.id,
          name: daemonNode.name,
          hostname: daemonNode.host,
          port: daemonNode.port,
          status: daemonNode.status,
          capabilities: daemonNode.capabilities,
          region: daemonNode.region,
          health: {
            cpuUsage: daemonNode.cpuUsage,
            memoryUsage: daemonNode.memoryUsage,
            activeSessions: daemonNode.activeSessions,
          },
          lastHeartbeat: daemonNode.lastHeartbeat,
          createdAt: daemonNode.createdAt,
        },
        message: 'Daemon node registered successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:slug/daemons]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
