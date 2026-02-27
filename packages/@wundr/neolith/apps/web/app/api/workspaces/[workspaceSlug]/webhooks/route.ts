/**
 * Workspace Webhooks API Routes - REAL IMPLEMENTATION
 *
 * Handles listing and creating webhooks for a workspace.
 * Uses Prisma database models for persistence.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/webhooks - List webhooks
 * - POST /api/workspaces/:workspaceId/webhooks - Create webhook
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkWorkspaceAccess } from '@/lib/services/integration-service';
import { listWebhooks, createWebhook } from '@/lib/services/webhook-service';
import {
  createWebhookSchema,
  webhookFiltersSchema,
  INTEGRATION_ERROR_CODES,
} from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/webhooks
 *
 * List webhooks for a workspace with filters.
 *
 * Query parameters:
 * - status: Filter by status (ACTIVE, PAUSED, FAILED)
 * - event: Filter by subscribed event type
 * - search: Search by name, description, or URL
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sortBy: Sort field (default: createdAt)
 * - sortOrder: Sort direction (default: desc)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of webhooks with pagination
 */
export async function GET(
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

    // Get workspace ID
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
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

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filterResult = webhookFiltersSchema.safeParse(searchParams);

    if (!filterResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: filterResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Fetch webhooks using resolved workspace ID
    const resolvedWorkspaceId = access.workspaceId;
    const { webhooks, total } = await listWebhooks(
      resolvedWorkspaceId,
      filterResult.data
    );

    // Calculate pagination metadata
    const { page, limit } = filterResult.data;
    const totalPages = Math.ceil(total / limit);

    // Remove secret hash from response
    const safeWebhooks = webhooks.map((w: any) => {
      const { secretHash: _secret, ...webhook } = w;
      return webhook;
    });

    return NextResponse.json({
      webhooks: safeWebhooks,
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
    console.error('[GET /api/workspaces/:workspaceId/webhooks] Error:', error);
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
 * POST /api/workspaces/:workspaceId/webhooks
 *
 * Create a new webhook for the workspace.
 * Returns the webhook configuration and secret (shown only once).
 *
 * Request body:
 * - name: Display name for the webhook (required)
 * - description: Optional description
 * - url: Webhook endpoint URL (required)
 * - events: Array of event types to subscribe to (required)
 * - retryCount: Number of retry attempts (default: 3)
 * - timeoutMs: Request timeout in milliseconds (default: 10000)
 * - headers: Custom headers to include
 * - metadata: Additional metadata
 *
 * @param request - Next.js request with webhook data
 * @param context - Route context containing workspace ID
 * @returns Created webhook and secret (shown only once)
 */
export async function POST(
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

    // Get workspace ID
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
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
          'Admin permission required to create webhooks',
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
    const parseResult = createWebhookSchema.safeParse(body);
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

    // Create webhook using resolved workspace ID
    const resolvedWorkspaceId = access.workspaceId;
    const { webhook, secret } = await createWebhook(
      resolvedWorkspaceId,
      parseResult.data,
      session.user.id
    );

    // Remove secret hash from webhook object (it's returned separately)
    const { secretHash: _omitSecret, ...safeWebhook } = webhook;

    return NextResponse.json(
      {
        webhook: safeWebhook,
        secret, // Only shown once on creation
        message:
          'Webhook created successfully. Store the secret securely - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/webhooks] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
