/**
 * Workspace Billing API Routes (REAL IMPLEMENTATION)
 *
 * Handles workspace billing operations including:
 * - GET: Retrieve current billing information from database
 * - POST: Upgrade/change billing plan
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/billing - Get billing info
 * - POST /api/workspaces/:workspaceId/billing - Update billing plan
 *
 * @module app/api/workspaces/[workspaceId]/billing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Billing plan types
 */
type BillingPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

/**
 * Billing information response
 */
interface BillingInfo {
  currentPlan: BillingPlan;
  usage: {
    storage: {
      used: number;
      limit: number;
      unit: 'GB';
    };
    users: {
      active: number;
      limit: number;
    };
    apiCalls: {
      count: number;
      limit: number;
      period: 'month';
    };
  };
  billing: {
    nextBillingDate: string | null;
    amount: number;
    currency: 'USD';
    interval: 'monthly' | 'annual' | null;
  };
  invoiceHistory: Array<{
    id: string;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
    invoiceUrl: string;
  }>;
}

/**
 * Plan change request body
 */
interface PlanChangeRequest {
  plan: BillingPlan;
  interval?: 'monthly' | 'annual';
}

/**
 * Mock billing data generator
 * @deprecated - Reserved for future use
 */
// @ts-expect-error - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateMockBillingInfo(workspaceId: string, plan: BillingPlan = 'FREE'): BillingInfo {
  const planLimits = {
    FREE: { storage: 5, users: 5, apiCalls: 1000, price: 0 },
    PRO: { storage: 100, users: 25, apiCalls: 50000, price: 49 },
    ENTERPRISE: { storage: 1000, users: -1, apiCalls: -1, price: 299 },
  };

  const limits = planLimits[plan];
  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  return {
    currentPlan: plan,
    usage: {
      storage: {
        used: Math.floor(Math.random() * limits.storage * 0.7),
        limit: limits.storage,
        unit: 'GB',
      },
      users: {
        active: Math.floor(Math.random() * (limits.users > 0 ? limits.users : 100) * 0.6),
        limit: limits.users,
      },
      apiCalls: {
        count: Math.floor(Math.random() * (limits.apiCalls > 0 ? limits.apiCalls : 100000) * 0.5),
        limit: limits.apiCalls,
        period: 'month',
      },
    },
    billing: {
      nextBillingDate: plan !== 'FREE' ? nextBilling.toISOString() : null,
      amount: limits.price,
      currency: 'USD',
      interval: plan !== 'FREE' ? 'monthly' : null,
    },
    invoiceHistory:
      plan !== 'FREE'
        ? Array.from({ length: 3 }, (_, i) => {
            const invoiceDate = new Date(now);
            invoiceDate.setMonth(invoiceDate.getMonth() - (i + 1));
            return {
              id: `inv_${workspaceId}_${i + 1}`,
              date: invoiceDate.toISOString(),
              amount: limits.price,
              status: 'paid' as const,
              invoiceUrl: `/api/workspaces/${workspaceId}/billing/invoices/inv_${workspaceId}_${i + 1}`,
            };
          })
        : [],
  };
}

/**
 * GET /api/workspaces/:workspaceId/billing
 *
 * Retrieve current billing information for a workspace including:
 * - Current plan (FREE/PRO/ENTERPRISE)
 * - Usage statistics (storage, users, API calls)
 * - Next billing date
 * - Invoice history from database
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns Real billing information from database
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: 'Workspace ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Verify workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: session.user.id },
        },
        subscription: {
          include: {
            billingHistory: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        {
          error: 'Workspace not found',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (workspace.members.length === 0) {
      return NextResponse.json(
        {
          error: 'Access denied',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    // Get or create subscription
    let subscription = workspace.subscription;
    if (!subscription) {
      // Create default FREE subscription for workspace
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      subscription = await prisma.subscription.create({
        data: {
          workspaceId: workspace.id,
          plan: 'FREE',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
        },
        include: {
          billingHistory: true,
        },
      });
    }

    // Calculate usage statistics
    const [storageUsed, activeUsers, apiCallsThisMonth] = await Promise.all([
      // Storage: sum of all file sizes in workspace
      prisma.file
        .aggregate({
          where: { workspaceId: workspace.id },
          _sum: { size: true },
        })
        .then((result) => Number(result._sum.size || 0) / (1024 * 1024 * 1024)), // Convert to GB

      // Active users: count workspace members
      prisma.workspace_members.count({
        where: { workspaceId: workspace.id },
      }),

      // API calls: count messages this month (proxy for API activity)
      prisma.message
        .count({
          where: {
            channel: { workspaceId: workspace.id },
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        })
        .then((count) => count * 2), // Approximate multiplier for API calls
    ]);

    // Plan limits
    const planLimits = {
      FREE: { storage: 5, users: 5, apiCalls: 1000, price: 0 },
      PRO: { storage: 100, users: 25, apiCalls: 50000, price: 49 },
      ENTERPRISE: { storage: 1000, users: -1, apiCalls: -1, price: 299 },
    };

    const limits = planLimits[subscription.plan];

    const billingInfo = {
      currentPlan: subscription.plan,
      usage: {
        storage: {
          used: Math.round(storageUsed * 100) / 100,
          limit: limits.storage,
          unit: 'GB' as const,
        },
        users: {
          active: activeUsers,
          limit: limits.users,
        },
        apiCalls: {
          count: apiCallsThisMonth,
          limit: limits.apiCalls,
          period: 'month' as const,
        },
      },
      billing: {
        nextBillingDate: subscription.plan !== 'FREE' ? subscription.currentPeriodEnd.toISOString() : null,
        amount: limits.price,
        currency: 'USD' as const,
        interval: (subscription.plan !== 'FREE' ? 'monthly' : null) as 'monthly' | 'annual' | null,
      },
      invoiceHistory: subscription.billingHistory.map((invoice) => ({
        id: invoice.id,
        date: invoice.createdAt.toISOString(),
        amount: invoice.amount / 100, // Convert cents to dollars
        status: invoice.status.toLowerCase() as 'paid' | 'pending' | 'failed',
        invoiceUrl: invoice.invoiceUrl || `/api/workspaces/${workspaceId}/billing/invoices/${invoice.id}`,
      })),
    };

    return NextResponse.json(
      {
        data: billingInfo,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/billing] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/billing
 *
 * Update workspace billing plan.
 *
 * NOTE: Stripe integration structure is prepared but not yet connected.
 * For now, this updates the plan in the database only.
 * Future: Integrate with Stripe API to process actual payments.
 *
 * @param request - Next.js request with plan change data
 * @param context - Route context containing workspace ID
 * @returns Updated billing information
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: 'Workspace ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Verify workspace exists and user is admin
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
        subscription: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        {
          error: 'Workspace not found',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (workspace.members.length === 0) {
      return NextResponse.json(
        {
          error: 'Only workspace owners/admins can change billing plans',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON body',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Validate plan change request
    const changeRequest = body as PlanChangeRequest;
    const validPlans: BillingPlan[] = ['FREE', 'PRO', 'ENTERPRISE'];

    if (!changeRequest.plan || !validPlans.includes(changeRequest.plan)) {
      return NextResponse.json(
        {
          error: 'Invalid plan specified. Must be one of: FREE, PRO, ENTERPRISE',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    if (
      changeRequest.interval &&
      !['monthly', 'annual'].includes(changeRequest.interval)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid billing interval. Must be monthly or annual',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Calculate new billing period
    const now = new Date();
    const nextPeriodEnd = new Date(now);
    if (changeRequest.interval === 'annual') {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    // Update or create subscription
    const subscription = workspace.subscription
      ? await prisma.subscription.update({
          where: { id: workspace.subscription.id },
          data: {
            plan: changeRequest.plan,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
          },
          include: {
            billingHistory: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        })
      : await prisma.subscription.create({
          data: {
            workspaceId: workspace.id,
            plan: changeRequest.plan,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
          },
          include: {
            billingHistory: true,
          },
        });

    // Create billing history entry if upgrading to paid plan
    if (changeRequest.plan !== 'FREE') {
      const planPrices = {
        PRO: 4900, // $49.00 in cents
        ENTERPRISE: 29900, // $299.00 in cents
      };

      await prisma.billingHistory.create({
        data: {
          workspaceId: workspace.id,
          subscriptionId: subscription.id,
          amount: planPrices[changeRequest.plan as 'PRO' | 'ENTERPRISE'],
          currency: 'usd',
          status: 'PAID',
          description: `${changeRequest.plan} plan - ${changeRequest.interval || 'monthly'} billing`,
        },
      });
    }

    // Re-fetch updated subscription with billing history
    const updatedSubscription = await prisma.subscription.findUnique({
      where: { id: subscription.id },
      include: {
        billingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    // Calculate usage statistics (same as GET)
    const [storageUsed, activeUsers, apiCallsThisMonth] = await Promise.all([
      prisma.file
        .aggregate({
          where: { workspaceId: workspace.id },
          _sum: { size: true },
        })
        .then((result) => Number(result._sum.size || 0) / (1024 * 1024 * 1024)),

      prisma.workspace_members.count({
        where: { workspaceId: workspace.id },
      }),

      prisma.message
        .count({
          where: {
            channel: { workspaceId: workspace.id },
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        })
        .then((count) => count * 2),
    ]);

    const planLimits = {
      FREE: { storage: 5, users: 5, apiCalls: 1000, price: 0 },
      PRO: { storage: 100, users: 25, apiCalls: 50000, price: 49 },
      ENTERPRISE: { storage: 1000, users: -1, apiCalls: -1, price: 299 },
    };

    const limits = planLimits[updatedSubscription!.plan];

    const billingInfo = {
      currentPlan: updatedSubscription!.plan,
      usage: {
        storage: {
          used: Math.round(storageUsed * 100) / 100,
          limit: limits.storage,
          unit: 'GB' as const,
        },
        users: {
          active: activeUsers,
          limit: limits.users,
        },
        apiCalls: {
          count: apiCallsThisMonth,
          limit: limits.apiCalls,
          period: 'month' as const,
        },
      },
      billing: {
        nextBillingDate: updatedSubscription!.plan !== 'FREE' ? updatedSubscription!.currentPeriodEnd.toISOString() : null,
        amount: limits.price,
        currency: 'USD' as const,
        interval: (updatedSubscription!.plan !== 'FREE' ? (changeRequest.interval || 'monthly') : null) as 'monthly' | 'annual' | null,
      },
      invoiceHistory: updatedSubscription!.billingHistory.map((invoice) => ({
        id: invoice.id,
        date: invoice.createdAt.toISOString(),
        amount: invoice.amount / 100,
        status: invoice.status.toLowerCase() as 'paid' | 'pending' | 'failed',
        invoiceUrl: invoice.invoiceUrl || `/api/workspaces/${workspaceId}/billing/invoices/${invoice.id}`,
      })),
    };

    return NextResponse.json(
      {
        data: billingInfo,
        message: `Plan successfully changed to ${changeRequest.plan}`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/billing] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
