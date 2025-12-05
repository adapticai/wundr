/**
 * Budget Alerts API Routes
 *
 * Handles budget alert management for cost monitoring.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/billing/budget-alerts - List alerts
 * - POST /api/workspaces/:workspaceSlug/admin/billing/budget-alerts - Create alert
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/budget-alerts/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createAdminErrorResponse, ADMIN_ERROR_CODES } from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface BudgetAlert {
  id: string;
  threshold: number;
  enabled: boolean;
  notifyEmail: boolean;
  notifySlack: boolean;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/billing/budget-alerts
 *
 * Get budget alerts for workspace. Requires admin role.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get budget alerts from workspace settings
    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const alerts = (billingSettings.budgetAlerts as BudgetAlert[]) || [];

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/admin/billing/budget-alerts] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch budget alerts', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/billing/budget-alerts
 *
 * Create a budget alert. Requires admin role.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    const body = await request.json() as {
      threshold: number;
      notifyEmail: boolean;
      notifySlack: boolean;
    };

    const newAlert: BudgetAlert = {
      id: `alert_${Date.now()}`,
      threshold: body.threshold,
      enabled: true,
      notifyEmail: body.notifyEmail,
      notifySlack: body.notifySlack,
    };

    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const alerts = (billingSettings.budgetAlerts as BudgetAlert[]) || [];

    alerts.push(newAlert);

    // Update workspace settings
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          billing: {
            ...billingSettings,
            budgetAlerts: alerts,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ alert: newAlert });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/admin/billing/budget-alerts] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to create budget alert', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
