/**
 * Enterprise Contact API Route
 *
 * Handles enterprise sales contact requests.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/billing/contact-enterprise - Send enterprise inquiry
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/contact-enterprise/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/billing/contact-enterprise
 *
 * Send enterprise contact request. Requires authentication.
 */
export async function POST(
  request: NextRequest,
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

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json(
        createAdminErrorResponse('Access denied', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      name: string;
      email: string;
      company: string;
      employees: string;
      message: string;
    };

    // In production, this would:
    // 1. Send email to sales team
    // 2. Create CRM entry
    // 3. Send confirmation email to user
    // 4. Log the inquiry

    // For now, we'll just log it
    console.log('Enterprise inquiry received:', {
      workspaceId,
      userId: session.user.id,
      ...body,
    });

    // Store inquiry in workspace settings for tracking
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const inquiries = (settings.enterpriseInquiries as unknown[]) || [];

    inquiries.push({
      id: `inq_${Date.now()}`,
      ...body,
      userId: session.user.id,
      createdAt: new Date().toISOString(),
    });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          enterpriseInquiries: inquiries,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Enterprise inquiry submitted successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/admin/billing/contact-enterprise] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to send inquiry',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
