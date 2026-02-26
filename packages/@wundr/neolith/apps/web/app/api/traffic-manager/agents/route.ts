/**
 * Traffic Manager Agents API
 *
 * Routes:
 * - GET /api/traffic-manager/agents - List all orchestrator agents with status
 *
 * @module app/api/traffic-manager/agents/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  TRAFFIC_MANAGER_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/traffic-manager';

import type { AgentStatusResponse } from '@/lib/validations/traffic-manager';

/** Map OrchestratorStatus enum values to agentStatusEnum values */
function mapOrchestratorStatus(
  status: string
): 'available' | 'busy' | 'offline' | 'maintenance' {
  switch (status) {
    case 'ONLINE':
      return 'available';
    case 'BUSY':
      return 'busy';
    case 'AWAY':
      return 'maintenance';
    case 'OFFLINE':
    default:
      return 'offline';
  }
}

/**
 * GET /api/traffic-manager/agents
 *
 * Lists all orchestrator agents in the authenticated user's organization
 * with their current status and basic metrics.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TRAFFIC_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const orgMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Organization not found', TRAFFIC_MANAGER_ERROR_CODES.CONFIG_NOT_FOUND),
        { status: 404 }
      );
    }

    const orchestrators = await prisma.orchestrator.findMany({
      where: { organizationId: orgMembership.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastActiveAt: true,
          },
        },
        tasks: {
          where: { status: { in: ['IN_PROGRESS', 'TODO', 'BLOCKED'] } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const agents: AgentStatusResponse[] = orchestrators.map(o => {
      const activeTaskCount = o.tasks.length;
      const maxTasks = 10;
      const currentLoad = Math.min(activeTaskCount / maxTasks, 1);

      return {
        id: o.userId,
        name: o.user?.name ?? o.role,
        discipline: o.discipline,
        seniority: 'ic' as const,
        status: mapOrchestratorStatus(o.status),
        currentLoad,
        messagesHandled: 0,
        lastActiveAt: o.user?.lastActiveAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      data: agents,
      total: agents.length,
    });
  } catch (error) {
    console.error('[GET /api/traffic-manager/agents] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TRAFFIC_MANAGER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
