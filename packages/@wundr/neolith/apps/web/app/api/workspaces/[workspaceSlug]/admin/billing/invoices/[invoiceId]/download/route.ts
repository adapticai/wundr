/**
 * Invoice Download API Route
 *
 * Handles invoice PDF downloads.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/billing/invoices/:invoiceId/download - Download invoice PDF
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/invoices/[invoiceId]/download/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

/**
 * Route context with workspace slug and invoice ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; invoiceId: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/billing/invoices/:invoiceId/download
 *
 * Download invoice PDF. Requires admin role.
 */
export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug: workspaceId, invoiceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // In production, this would fetch the PDF from Stripe or generate one
    // For now, return a mock PDF response
    const pdfContent = `Invoice ${invoiceId} for workspace ${workspaceId}`;
    const blob = new Blob([pdfContent], { type: 'application/pdf' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/billing/invoices/:invoiceId/download] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to download invoice',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
