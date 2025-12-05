/**
 * Individual Webhook API Routes
 *
 * Handles operations on a specific webhook.
 *
 * @module app/api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]/route
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
 * GET /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]
 *
 * Get a specific webhook.
 */
export async function GET(
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
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const webhook = await getWebhook(workspaceId, webhookId);
    if (!webhook) {
      return NextResponse.json(
        createErrorResponse(
          'Webhook not found',
          INTEGRATION_ERROR_CODES.WEBHOOK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]
 *
 * Update a webhook.
 */
export async function PATCH(
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const parseResult = updateWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const webhook = await updateWebhook(
      workspaceId,
      webhookId,
      parseResult.data,
    );

    return NextResponse.json({
      webhook,
      message: 'Webhook updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]
 *
 * Delete a webhook.
 */
export async function DELETE(
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

    await deleteWebhook(workspaceId, webhookId);

    return NextResponse.json({
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/[workspaceSlug]/integrations/webhooks/[webhookId]] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
