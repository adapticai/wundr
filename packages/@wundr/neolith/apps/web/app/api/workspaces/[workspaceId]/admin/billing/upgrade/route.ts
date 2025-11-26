/**
 * Billing Upgrade API Route
 *
 * Handles plan upgrades for workspaces.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/billing/upgrade - Upgrade plan
 *
 * @module app/api/workspaces/[workspaceId]/admin/billing/upgrade/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  upgradePlanSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type BillingInfo,
  type PlanType,
} from '@/lib/validations/admin';

import type { NextRequest} from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Plan order for upgrade validation
 */
const PLAN_ORDER: PlanType[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

/**
 * Plan limits configuration
 */
const PLAN_LIMITS: Record<PlanType, {
  name: string;
  members: number;
  storage: number;
  channels: number;
  features: string[];
}> = {
  FREE: {
    name: 'Free',
    members: 10,
    storage: 5,
    channels: 10,
    features: ['Basic messaging', 'Public channels', '5GB storage'],
  },
  STARTER: {
    name: 'Starter',
    members: 50,
    storage: 50,
    channels: 50,
    features: ['Unlimited messaging', 'Private channels', '50GB storage', 'Guest access'],
  },
  PROFESSIONAL: {
    name: 'Professional',
    members: 250,
    storage: 500,
    channels: 250,
    features: ['Unlimited messaging', 'Unlimited channels', '500GB storage', 'Advanced permissions', 'API access'],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    members: -1,
    storage: -1,
    channels: -1,
    features: ['Unlimited everything', 'SSO/SAML', 'Compliance tools', 'Dedicated support', 'Custom integrations'],
  },
};

/**
 * POST /api/workspaces/:workspaceId/admin/billing/upgrade
 *
 * Upgrade workspace plan. Requires admin role.
 *
 * @param request - Next.js request with plan to upgrade to
 * @param context - Route context containing workspace ID
 * @returns Updated billing info and optional checkout URL
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceId } = await context.params;

    // Verify admin access (only OWNER can change billing)
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['owner', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Only workspace owner can manage billing', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse('Invalid JSON body', ADMIN_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = upgradePlanSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { plan: targetPlan } = parseResult.data;

    // Get current plan
    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const currentPlan = (billingSettings.plan as PlanType) || 'FREE';

    // Check if this is an upgrade
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(targetPlan);

    if (targetIndex <= currentIndex) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Can only upgrade to a higher plan. Contact support for downgrades.',
          ADMIN_ERROR_CODES.PLAN_DOWNGRADE_NOT_ALLOWED,
        ),
        { status: 400 },
      );
    }

    // Update workspace billing settings
    const newBillingSettings = {
      ...billingSettings,
      plan: targetPlan,
      upgradedAt: new Date().toISOString(),
      previousPlan: currentPlan,
    };

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          billing: newBillingSettings,
        },
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'billing.upgraded', ${session.user.id}, ${JSON.stringify({ from: currentPlan, to: targetPlan })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    // Calculate usage
    const [memberCount, channelCount, storageUsage] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.channel.count({ where: { workspaceId } }),
      prisma.file.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      }),
    ]);

    const storageGB = Number(storageUsage._sum.size || 0) / (1024 * 1024 * 1024);
    const planConfig = PLAN_LIMITS[targetPlan];

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const billing: BillingInfo = {
      plan: targetPlan,
      planName: planConfig.name,
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      usage: {
        members: memberCount,
        membersLimit: planConfig.members,
        storage: Math.round(storageGB * 100) / 100,
        storageLimit: planConfig.storage,
        channels: channelCount,
        channelsLimit: planConfig.channels,
      },
      features: planConfig.features,
    };

    // In production, this would redirect to a payment provider
    // For now, we'll return a mock checkout URL for paid plans
    let checkoutUrl: string | undefined;
    if (targetPlan !== 'FREE') {
      checkoutUrl = `/checkout?workspace=${workspaceId}&plan=${targetPlan}`;
    }

    return NextResponse.json({ billing, checkoutUrl });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/admin/billing/upgrade] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to upgrade plan', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
