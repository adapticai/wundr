/**
 * Webhook Test API Route
 *
 * Sends a test payload to a webhook endpoint.
 *
 * @module app/api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]/test/route
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  sendTestWebhook,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * POST /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]/test
 *
 * Send a test webhook payload.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; webhookId: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId, webhookId } = await params;

    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access?.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required',
          INTEGRATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const result = await sendTestWebhook(workspaceId, webhookId, {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook' },
    });

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.success
        ? 'Test webhook sent successfully'
        : `Test failed: ${result.errorMessage}`,
    });
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]/test] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
