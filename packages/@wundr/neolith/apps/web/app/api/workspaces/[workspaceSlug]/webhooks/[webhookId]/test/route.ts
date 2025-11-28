/**
 * Webhook Test API Route
 *
 * Sends a test delivery to a webhook endpoint.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/webhooks/:webhookId/test - Send test delivery
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/[webhookId]/test/route
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
 * Route context with workspace and webhook ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; webhookId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/webhooks/:webhookId/test
 *
 * Send a test delivery to the webhook endpoint.
 * Creates a test delivery record and attempts to deliver it.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and webhook IDs
 * @returns Test delivery result
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', INTEGRATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, webhookId } = params;

    if (!workspaceId || !webhookId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Webhook ID are required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Send test webhook
    const delivery = await sendTestWebhook(workspaceId, webhookId);

    if (!delivery) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({
      delivery,
      success: delivery.status === 'SUCCESS',
      message:
        delivery.status === 'SUCCESS'
          ? 'Test webhook delivered successfully'
          : `Test webhook failed: ${delivery.errorMessage ?? 'Unknown error'}`,
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/webhooks/:webhookId/test] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
