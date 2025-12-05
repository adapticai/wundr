/**
 * AI Admin API Routes
 *
 * Handles AI management operations for workspace administrators:
 * - PATCH: Update AI settings (enabled models, rate limits, alerts)
 * - GET: Retrieve AI usage statistics and settings
 *
 * Authorization: Requires ADMIN or OWNER role
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/ai/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';
import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace admin access
 */
async function checkAdminAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    select: { id: true, slug: true },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId,
    },
    select: { role: true },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    return null;
  }

  return workspace;
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/ai
 *
 * Update AI settings for workspace
 *
 * @param request - Request with AI settings
 * @param context - Route context with workspace slug
 * @returns Success message
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // 2. Get workspace slug
    const { workspaceSlug } = await context.params;

    // 3. Check admin access
    const workspace = await checkAdminAccess(workspaceSlug, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // 4. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { enabledModels, rateLimits, alerts } = body;

    // 5. Validate input
    if (enabledModels && !Array.isArray(enabledModels)) {
      return NextResponse.json(
        createErrorResponse(
          'enabledModels must be an array',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // 6. Get current settings
    const currentWorkspace = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { settings: true },
    });

    const currentSettings = (currentWorkspace?.settings as any) || {};
    const aiSettings = currentSettings.ai || {};

    // 7. Update AI settings
    const updatedSettings = {
      ...currentSettings,
      ai: {
        ...aiSettings,
        ...(enabledModels && { enabledModels }),
        ...(rateLimits && { rateLimits }),
        ...(alerts && { alerts }),
        updatedAt: new Date().toISOString(),
      },
    };

    // 8. Save to database
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[PATCH /api/workspaces/${workspaceSlug}/admin/ai] Settings updated by ${session.user.id}`
    );

    return NextResponse.json({
      message: 'AI settings updated successfully',
      data: {
        enabledModels: updatedSettings.ai.enabledModels,
        rateLimits: updatedSettings.ai.rateLimits,
        alerts: updatedSettings.ai.alerts,
      },
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceSlug/admin/ai] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/ai
 *
 * Get AI settings and usage statistics
 *
 * @param request - Next.js request
 * @param context - Route context with workspace slug
 * @returns AI settings and statistics
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // 2. Get workspace slug
    const { workspaceSlug } = await context.params;

    // 3. Check admin access
    const workspace = await checkAdminAccess(workspaceSlug, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // 4. Get workspace settings
    const workspaceData = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { settings: true },
    });

    const settings = (workspaceData?.settings as any) || {};
    const aiSettings = settings.ai || {};

    // 5. Get usage statistics
    const orchestrators = await prisma.orchestrator.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true },
    });

    const orchestratorIds = orchestrators.map(o => o.id);

    const totalUsage = await prisma.tokenUsage.aggregate({
      where: { orchestratorId: { in: orchestratorIds } },
      _sum: { totalTokens: true, cost: true },
      _count: true,
    });

    console.log(
      `[GET /api/workspaces/${workspaceSlug}/admin/ai] Settings retrieved by ${session.user.id}`
    );

    return NextResponse.json({
      data: {
        settings: {
          enabledModels: aiSettings.enabledModels || [],
          rateLimits: aiSettings.rateLimits || {
            requestsPerMinute: 60,
            tokensPerMinute: 100000,
            costPerDay: 100,
          },
          alerts: aiSettings.alerts || {
            enabled: true,
            thresholds: [50, 75, 90],
            recipients: [],
          },
        },
        usage: {
          totalTokens: totalUsage._sum.totalTokens || 0,
          totalCost: Number(totalUsage._sum.cost || 0),
          totalRequests: totalUsage._count,
        },
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/ai] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
