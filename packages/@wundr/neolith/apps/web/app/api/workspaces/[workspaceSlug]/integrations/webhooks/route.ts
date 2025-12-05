/**
 * Webhooks API Routes
 *
 * Handles creating and listing workspace webhooks.
 *
 * @module app/api/workspaces/[workspaceSlug]/integrations/webhooks/route
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  listWebhooks,
  createWebhook,
} from '@/lib/services/integration-service';
import {
  webhookFiltersSchema,
  createWebhookSchema,
  INTEGRATION_ERROR_CODES,
} from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * GET /api/workspaces/[workspaceSlug]/integrations/webhooks
 *
 * List all webhooks for a workspace with optional filtering.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
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

    const { workspaceSlug: workspaceId } = await params;
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

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

    const searchParams = request.nextUrl.searchParams;
    const filterInput = {
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    };

    const parseResult = webhookFiltersSchema.safeParse(filterInput);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { webhooks, total } = await listWebhooks(
      workspaceId,
      parseResult.data,
    );

    return NextResponse.json({
      webhooks,
      pagination: {
        total,
        page: parseResult.data.page,
        limit: parseResult.data.limit,
        totalPages: Math.ceil(total / parseResult.data.limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceSlug]/integrations/webhooks] Error:', error);
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
 * POST /api/workspaces/[workspaceSlug]/integrations/webhooks
 *
 * Create a new webhook for the workspace.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
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

    const { workspaceSlug: workspaceId } = await params;
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

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
          'Admin permission required to create webhooks',
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

    const parseResult = createWebhookSchema.safeParse(body);
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

    const { webhook, secret } = await createWebhook(
      workspaceId,
      parseResult.data,
      session.user.id,
    );

    return NextResponse.json(
      {
        webhook,
        secret,
        message: 'Webhook created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceSlug]/integrations/webhooks] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
