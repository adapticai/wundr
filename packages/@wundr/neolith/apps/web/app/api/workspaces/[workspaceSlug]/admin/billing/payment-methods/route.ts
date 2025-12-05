/**
 * Payment Methods API Routes
 *
 * Handles payment method management for workspace billing.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/billing/payment-methods - List payment methods
 * - POST /api/workspaces/:workspaceSlug/admin/billing/payment-methods - Add payment method
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/payment-methods/route
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

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/billing/payment-methods
 *
 * Get payment methods for workspace. Requires admin role.
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

    // Get payment methods from workspace settings
    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const paymentMethods = (billingSettings.paymentMethods as PaymentMethod[]) || [];

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/admin/billing/payment-methods] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch payment methods', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/billing/payment-methods
 *
 * Add a payment method. Requires owner role.
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

    // Verify owner access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['owner', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Only workspace owner can manage payment methods', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    const body = await request.json() as { cardNumber: string; expiry: string; cvc: string };

    // In production, this would integrate with Stripe/PayPal
    // For now, we'll store a mock payment method
    const newMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      brand: 'Visa', // Would be detected from card number
      last4: body.cardNumber.slice(-4),
      expiryMonth: parseInt(body.expiry.split('/')[0] || '12'),
      expiryYear: parseInt(`20${body.expiry.split('/')[1] || '99'}`),
      isDefault: true,
    };

    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const paymentMethods = (billingSettings.paymentMethods as PaymentMethod[]) || [];

    // Set all existing methods to non-default
    paymentMethods.forEach(method => {
      method.isDefault = false;
    });

    // Add new method
    paymentMethods.push(newMethod);

    // Update workspace settings
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          billing: {
            ...billingSettings,
            paymentMethods,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ paymentMethod: newMethod });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/admin/billing/payment-methods] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to add payment method', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
