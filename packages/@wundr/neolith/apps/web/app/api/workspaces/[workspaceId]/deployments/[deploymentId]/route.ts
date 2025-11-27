/**
 * Single Deployment API Routes
 *
 * Handles operations on a specific deployment.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/deployments/:deploymentId - Get deployment
 * - PATCH /api/workspaces/:workspaceId/deployments/:deploymentId - Update deployment
 * - DELETE /api/workspaces/:workspaceId/deployments/:deploymentId - Delete deployment
 *
 * @module app/api/workspaces/[workspaceId]/deployments/[deploymentId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';
import type { UpdateDeploymentInput } from '@/types/deployment';

/**
 * Route context with workspaceId and deploymentId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; deploymentId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/deployments/:deploymentId
 *
 * Get a single deployment by ID.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, deploymentId } = params;

    // Get deployment from database
    const deployment = await prisma.deployment.findUnique({
      where: {
        id: deploymentId,
      },
    });

    if (!deployment || deployment.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Transform to frontend format
    const transformedDeployment = {
      id: deployment.id,
      workspaceId: deployment.workspaceId,
      name: deployment.name,
      description: deployment.description,
      type: deployment.type.toLowerCase() as
        | 'service'
        | 'agent'
        | 'workflow'
        | 'integration',
      status: (() => {
        const statusMap: Record<string, string> = {
          PENDING: 'deploying',
          BUILDING: 'updating',
          DEPLOYING: 'deploying',
          ACTIVE: 'running',
          FAILED: 'failed',
          STOPPED: 'stopped',
        };
        return (
          statusMap[deployment.status] || deployment.status.toLowerCase()
        ) as 'deploying' | 'running' | 'stopped' | 'failed' | 'updating';
      })(),
      environment: deployment.environment.toLowerCase() as
        | 'production'
        | 'staging'
        | 'development',
      version: deployment.version || 'v1.0.0',
      url: deployment.url,
      config: deployment.config as {
        region: string;
        replicas: number;
        resources: { cpu: string; memory: string };
        env: Record<string, string>;
      },
      health: ((deployment.health as unknown) || {
        status: 'unknown',
        lastCheck: null,
        uptime: 0,
      }) as {
        status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
        lastCheck: Date | null;
        uptime: number;
      },
      stats: ((deployment.stats as unknown) || {
        requests: 0,
        errors: 0,
        latencyP50: 0,
        latencyP99: 0,
      }) as {
        requests: number;
        errors: number;
        latencyP50: number;
        latencyP99: number;
      },
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      deployedAt: deployment.deployedAt,
    };

    return NextResponse.json({ deployment: transformedDeployment });
  } catch (error) {
    console.error('Error fetching deployment:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/deployments/:deploymentId
 *
 * Update a deployment.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, deploymentId } = params;

    let body: UpdateDeploymentInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    // Check if deployment exists and belongs to workspace
    const existingDeployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!existingDeployment || existingDeployment.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.config) {
      // Merge config with existing config
      const existingConfig =
        (existingDeployment.config as Record<string, unknown>) || {};
      updateData.config = {
        ...existingConfig,
        ...body.config,
      };
    }

    // Set status to BUILDING when updating
    updateData.status = 'BUILDING';

    // Update deployment in database
    const deployment = await prisma.deployment.update({
      where: { id: deploymentId },
      data: updateData,
    });

    // Transform to frontend format
    const transformedDeployment = {
      id: deployment.id,
      workspaceId: deployment.workspaceId,
      name: deployment.name,
      description: deployment.description,
      type: deployment.type.toLowerCase() as
        | 'service'
        | 'agent'
        | 'workflow'
        | 'integration',
      status: 'updating' as const,
      environment: deployment.environment.toLowerCase() as
        | 'production'
        | 'staging'
        | 'development',
      version: deployment.version || 'v1.0.0',
      url: deployment.url,
      config: deployment.config as {
        region: string;
        replicas: number;
        resources: { cpu: string; memory: string };
        env: Record<string, string>;
      },
      health: ((deployment.health as unknown) || {
        status: 'unknown',
        lastCheck: null,
        uptime: 0,
      }) as {
        status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
        lastCheck: Date | null;
        uptime: number;
      },
      stats: ((deployment.stats as unknown) || {
        requests: 0,
        errors: 0,
        latencyP50: 0,
        latencyP99: 0,
      }) as {
        requests: number;
        errors: number;
        latencyP50: number;
        latencyP99: number;
      },
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      deployedAt: deployment.deployedAt,
    };

    return NextResponse.json({
      deployment: transformedDeployment,
      message: 'Deployment updated successfully',
    });
  } catch (error) {
    console.error('Error updating deployment:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/deployments/:deploymentId
 *
 * Delete a deployment.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, deploymentId } = params;

    // Check if deployment exists and belongs to workspace
    const existingDeployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!existingDeployment || existingDeployment.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Delete deployment from database (logs will be cascade deleted)
    await prisma.deployment.delete({
      where: { id: deploymentId },
    });

    return NextResponse.json({
      message: 'Deployment deleted successfully',
      deploymentId,
    });
  } catch (error) {
    console.error('Error deleting deployment:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}
