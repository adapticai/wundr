/**
 * Webhook Detail API Routes
 *
 * Handles single webhook operations.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/webhooks/:webhookId - Get webhook
 * - PATCH /api/workspaces/:workspaceId/webhooks/:webhookId - Update webhook
 * - DELETE /api/workspaces/:workspaceId/webhooks/:webhookId - Delete webhook
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/[webhookId]/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  getWebhook,
  updateWebhook,
  deleteWebhook,
} from '@/lib/services/integration-service';
import {
  updateWebhookSchema,
  INTEGRATION_ERROR_CODES,
} from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and webhook ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; webhookId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/webhooks/:webhookId
 *
 * Get a specific webhook by ID.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and webhook IDs
 * @returns Webhook configuration (without secret)
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, webhookId } = params;

    if (!workspaceId || !webhookId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Webhook ID are required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get webhook
    const webhook = await getWebhook(workspaceId, webhookId);
    if (!webhook) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Remove secret hash from response
    const safeWebhook = {
      ...webhook,
      secretHash: undefined,
    };

    return NextResponse.json({ webhook: safeWebhook });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/webhooks/:webhookId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/webhooks/:webhookId
 *
 * Update an existing webhook.
 * Note: Secret cannot be updated through this endpoint, use rotate-secret instead.
 *
 * Request body (all optional):
 * - name: Updated display name
 * - description: Updated description
 * - url: Updated webhook URL
 * - status: Updated status
 * - events: Updated event subscriptions
 * - retryCount: Updated retry count
 * - timeoutMs: Updated timeout
 * - headers: Updated custom headers
 * - metadata: Updated metadata
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and webhook IDs
 * @returns Updated webhook configuration
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, webhookId } = params;

    if (!workspaceId || !webhookId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Webhook ID are required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access and admin permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required to update webhooks',
          INTEGRATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Update webhook
    const webhook = await updateWebhook(
      workspaceId,
      webhookId,
      parseResult.data
    );

    if (!webhook) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Remove secret hash from response
    const safeWebhook = {
      ...webhook,
      secretHash: undefined,
    };

    return NextResponse.json({
      webhook: safeWebhook,
      message: 'Webhook updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceId/webhooks/:webhookId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/webhooks/:webhookId
 *
 * Delete a webhook.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and webhook IDs
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, webhookId } = params;

    if (!workspaceId || !webhookId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Webhook ID are required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access and admin permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required to delete webhooks',
          INTEGRATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Delete webhook
    const deleted = await deleteWebhook(workspaceId, webhookId);

    if (!deleted) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/webhooks/:webhookId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
