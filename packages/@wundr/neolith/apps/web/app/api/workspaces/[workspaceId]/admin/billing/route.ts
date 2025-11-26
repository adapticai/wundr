/**
 * Billing API Routes
 *
 * Handles workspace billing information.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/billing - Get billing info
 *
 * @module app/api/workspaces/[workspaceId]/admin/billing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type BillingInfo,
  type PlanType,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Plan limits configuration
 */
const PLAN_LIMITS: Record<PlanType, {
  name: string;
  members: number;
  storage: number; // in GB
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
    members: -1, // unlimited
    storage: -1, // unlimited
    channels: -1, // unlimited
    features: ['Unlimited everything', 'SSO/SAML', 'Compliance tools', 'Dedicated support', 'Custom integrations'],
  },
};

/**
 * GET /api/workspaces/:workspaceId/admin/billing
 *
 * Get billing information. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID
 * @returns Billing information
 */
export async function GET(
  _request: Request,
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

    // Verify admin access
    const membership = await prisma.workspace_members.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get workspace settings for billing info
    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};

    // Default to FREE plan
    const plan = (billingSettings.plan as PlanType) || 'FREE';
    const planConfig = PLAN_LIMITS[plan];

    // Calculate usage
    const [memberCount, channelCount, storageUsage] = await Promise.all([
      prisma.workspace_members.count({ where: { workspaceId } }),
      prisma.channel.count({ where: { workspaceId } }),
      prisma.file.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      }),
    ]);

    const storageGB = Number(storageUsage._sum.size || 0) / (1024 * 1024 * 1024);

    // Calculate period dates (monthly billing)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const billing: BillingInfo = {
      plan,
      planName: planConfig.name,
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: (billingSettings.cancelAtPeriodEnd as boolean) || false,
      usage: {
        members: memberCount,
        membersLimit: planConfig.members,
        storage: Math.round(storageGB * 100) / 100, // Round to 2 decimal places
        storageLimit: planConfig.storage,
        channels: channelCount,
        channelsLimit: planConfig.channels,
      },
      features: planConfig.features,
    };

    return NextResponse.json({ billing });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/billing] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch billing info', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
