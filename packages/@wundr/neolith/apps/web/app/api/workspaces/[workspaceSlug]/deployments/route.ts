/**
 * Deployments API Routes
 *
 * Handles listing and creating deployments for a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/deployments - List deployments
 * - POST /api/workspaces/:workspaceId/deployments - Create a new deployment
 *
 * @module app/api/workspaces/[workspaceId]/deployments/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';
import type {
  CreateDeploymentInput,
  DeploymentFilters,
} from '@/types/deployment';

/**
 * Route context with workspaceId parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/deployments
 *
 * List deployments in a workspace with optional filtering.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId
 * @returns List of deployments
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/deployments?status=running&environment=production
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters: DeploymentFilters = {
      status: searchParams.get('status') as
        | DeploymentFilters['status']
        | undefined,
      environment: searchParams.get('environment') as
        | DeploymentFilters['environment']
        | undefined,
      type: searchParams.get('type') as DeploymentFilters['type'] | undefined,
      search: searchParams.get('search') ?? undefined,
    };

    // Build Prisma where clause
    const where: Record<string, unknown> = {
      workspaceId,
    };

    if (filters.status) {
      // Map frontend status to database enum
      const statusMap: Record<string, string> = {
        deploying: 'DEPLOYING',
        running: 'ACTIVE',
        stopped: 'STOPPED',
        failed: 'FAILED',
        updating: 'BUILDING',
      };
      where.status = statusMap[filters.status] || filters.status.toUpperCase();
    }

    if (filters.environment) {
      where.environment = filters.environment.toUpperCase();
    }

    if (filters.type) {
      where.type = filters.type.toUpperCase();
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Query deployments from database
    const deployments = await prisma.deployment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Transform to frontend format
    const transformedDeployments = deployments.map(d => ({
      id: d.id,
      workspaceId: d.workspaceId,
      name: d.name,
      description: d.description,
      type: d.type.toLowerCase() as
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
        return (statusMap[d.status] || d.status.toLowerCase()) as
          | 'deploying'
          | 'running'
          | 'stopped'
          | 'failed'
          | 'updating';
      })(),
      environment: d.environment.toLowerCase() as
        | 'production'
        | 'staging'
        | 'development',
      version: d.version || 'v1.0.0',
      url: d.url,
      config: d.config as {
        region: string;
        replicas: number;
        resources: { cpu: string; memory: string };
        env: Record<string, string>;
      },
      health: ((d.health as unknown) || {
        status: 'unknown',
        lastCheck: null,
        uptime: 0,
      }) as {
        status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
        lastCheck: Date | null;
        uptime: number;
      },
      stats: ((d.stats as unknown) || {
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
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      deployedAt: d.deployedAt,
    }));

    return NextResponse.json({
      deployments: transformedDeployments,
      total: transformedDeployments.length,
    });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/deployments
 *
 * Create a new deployment in a workspace.
 *
 * @param request - Next.js request with deployment data
 * @param context - Route context with workspaceId
 * @returns Created deployment object
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/deployments
 * Content-Type: application/json
 *
 * {
 *   "name": "New Service",
 *   "type": "service",
 *   "environment": "production",
 *   "config": { "region": "us-east-1", "replicas": 2, ... }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Parse request body
    let body: CreateDeploymentInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate required fields
    if (!body.name || !body.type || !body.environment || !body.config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create deployment in database
    const deployment = await prisma.deployment.create({
      data: {
        workspaceId,
        name: body.name,
        description: body.description ?? null,
        type: body.type.toUpperCase() as
          | 'SERVICE'
          | 'AGENT'
          | 'WORKFLOW'
          | 'INTEGRATION',
        status: 'DEPLOYING',
        environment: body.environment.toUpperCase() as
          | 'DEVELOPMENT'
          | 'STAGING'
          | 'PRODUCTION',
        version: 'v1.0.0',
        config: JSON.parse(JSON.stringify(body.config ?? {})),
        health: JSON.parse(
          JSON.stringify({
            status: 'unknown',
            lastCheck: null,
            uptime: 0,
          })
        ),
        stats: JSON.parse(
          JSON.stringify({
            requests: 0,
            errors: 0,
            latencyP50: 0,
            latencyP99: 0,
          })
        ),
        createdById: session.user.id,
      },
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
      status: 'deploying' as const,
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

    return NextResponse.json(
      {
        deployment: transformedDeployment,
        message: 'Deployment created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating deployment:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
