/**
 * Webhook Deliveries API Route
 *
 * Lists delivery history for a specific webhook.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/webhooks/:webhookId/deliveries - List deliveries
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/[webhookId]/deliveries/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  getWebhook,
  listWebhookDeliveries,
} from '@/lib/services/integration-service';
import {
  webhookDeliveryFiltersSchema,
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
 * GET /api/workspaces/:workspaceId/webhooks/:webhookId/deliveries
 *
 * Get delivery history for a specific webhook.
 *
 * Query parameters:
 * - status: Filter by delivery status (SUCCESS, FAILED, etc.)
 * - event: Filter by event type
 * - from: Filter deliveries from this date
 * - to: Filter deliveries until this date
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and webhook IDs
 * @returns List of webhook deliveries with pagination
 */
export async function GET(
  request: NextRequest,
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

    // Verify webhook exists
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

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filterResult = webhookDeliveryFiltersSchema.safeParse(searchParams);

    if (!filterResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: filterResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    // Fetch deliveries
    const { deliveries, total } = await listWebhookDeliveries(
      workspaceId,
      webhookId,
      filterResult.data,
    );

    // Calculate pagination metadata
    const { page, limit } = filterResult.data;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      deliveries,
      total,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/webhooks/:webhookId/deliveries] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
