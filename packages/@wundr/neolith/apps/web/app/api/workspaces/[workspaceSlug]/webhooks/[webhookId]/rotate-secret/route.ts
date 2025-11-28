/**
 * Webhook Secret Rotation API Route
 *
 * Rotates the webhook secret for enhanced security.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/webhooks/:webhookId/rotate-secret - Rotate secret
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/[webhookId]/rotate-secret/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  rotateWebhookSecret,
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
 * POST /api/workspaces/:workspaceId/webhooks/:webhookId/rotate-secret
 *
 * Rotate the webhook secret.
 * The old secret is immediately invalidated and a new one is generated.
 * The new secret is only shown once in the response.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and webhook IDs
 * @returns Updated webhook config and new secret
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

    // Check workspace access and admin permission
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

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required to rotate webhook secrets',
          INTEGRATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Rotate secret
    const result = await rotateWebhookSecret(workspaceId, webhookId);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Remove secret hash from response, include new plain secret
    const safeWebhook = {
      ...result.webhook,
      secretHash: undefined,
    };

    return NextResponse.json({
      webhook: safeWebhook,
      newSecret: result.newSecret,
      message: 'Webhook secret rotated successfully. Store the new secret securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/webhooks/:webhookId/rotate-secret] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
