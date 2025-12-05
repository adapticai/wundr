/**
 * Invoices API Routes
 *
 * Handles invoice retrieval for workspace billing.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/billing/invoices - List invoices
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/invoices/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createAdminErrorResponse, ADMIN_ERROR_CODES } from '@/lib/validations/admin';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl?: string;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/billing/invoices
 *
 * Get billing invoices for workspace. Requires admin role.
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

    // Get invoices from workspace settings
    const settings = (membership.workspace.settings as Record<string, unknown>) || {};
    const billingSettings = (settings.billing as Record<string, unknown>) || {};
    const invoices = (billingSettings.invoices as Invoice[]) || [];

    // If no invoices, generate some mock data for demonstration
    if (invoices.length === 0) {
      const now = new Date();
      const mockInvoices: Invoice[] = [
        {
          id: 'inv_001',
          number: 'INV-2024-001',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          date: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
          periodStart: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
          periodEnd: new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString(),
          pdfUrl: '#',
        },
        {
          id: 'inv_002',
          number: 'INV-2024-002',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          periodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
          periodEnd: new Date(now.getFullYear(), now.getMonth(), 0).toISOString(),
          pdfUrl: '#',
        },
      ];

      return NextResponse.json({ invoices: mockInvoices });
    }

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/admin/billing/invoices] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch invoices', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
