/**
 * API Keys Usage Statistics Route
 *
 * Returns aggregate usage statistics for workspace API keys.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/api-keys/usage
 *
 * @module app/api/workspaces/[workspaceSlug]/api-keys/usage/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      include: {
        workspaceMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    const membership = workspace.workspaceMembers[0];

    // Only ADMIN and OWNER can view API key usage
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can view API usage' },
        { status: 403 }
      );
    }

    // Get API keys from workspace settings and aggregate usage
    const settings = workspace.settings as Record<string, unknown> | null;
    const apiKeysData =
      settings && typeof settings === 'object' && 'apiKeys' in settings
        ? (settings.apiKeys as Array<{
            usageStats?: {
              totalRequests?: number;
              last24Hours?: number;
              last7Days?: number;
              last30Days?: number;
            };
          }>)
        : [];

    // Aggregate usage across all keys
    let totalDailyUsed = 0;
    let totalMonthlyUsed = 0;
    for (const key of apiKeysData) {
      totalDailyUsed += key.usageStats?.last24Hours ?? 0;
      totalMonthlyUsed += key.usageStats?.last30Days ?? 0;
    }

    // Return usage statistics matching the ApiUsage interface
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return NextResponse.json({
      dailyLimit: 10000,
      dailyUsed: totalDailyUsed,
      monthlyLimit: 100000,
      monthlyUsed: totalMonthlyUsed,
      resetDate: resetDate.toISOString(),
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/api-keys/usage] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
