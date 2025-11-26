/**
 * Workspace Integrations API Routes
 *
 * Handles listing and creating workspace integrations.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/integrations - List integrations for a workspace
 * - POST /api/workspaces/[workspaceId]/integrations - Create/connect a new integration
 *
 * @module app/api/workspaces/[workspaceId]/integrations/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  listIntegrations,
  createIntegration,
} from '@/lib/services/integration-service';
import {
  integrationFiltersSchema,
  createIntegrationSchema,
  INTEGRATION_ERROR_CODES,
} from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * GET /api/workspaces/[workspaceId]/integrations
 *
 * List all integrations for a workspace with optional filtering.
 *
 * Query parameters:
 * - provider: Filter by provider (SLACK, GITHUB, etc.)
 * - status: Filter by status (ACTIVE, INACTIVE, etc.)
 * - search: Search by name or description
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sortBy: Sort field (default: createdAt)
 * - sortOrder: Sort order (asc/desc, default: desc)
 *
 * @param request - Next.js request object with query parameters
 * @param params - Route parameters with workspaceId
 * @returns List of integrations with pagination metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
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

    // Get workspace ID from params
    const { workspaceId } = await params;
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const filterInput = {
      provider: searchParams.get('provider'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    };

    const parseResult = integrationFiltersSchema.safeParse(filterInput);
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

    // Fetch integrations
    const { integrations, total } = await listIntegrations(workspaceId, parseResult.data);

    // Calculate metadata
    const activeCount = integrations.filter((i) => i.status === 'ACTIVE').length;
    const inactiveCount = integrations.filter((i) => i.status === 'INACTIVE').length;
    const errorCount = integrations.filter((i) => i.status === 'ERROR').length;

    return NextResponse.json({
      integrations,
      pagination: {
        total,
        page: parseResult.data.page,
        limit: parseResult.data.limit,
        totalPages: Math.ceil(total / parseResult.data.limit),
      },
      meta: {
        active: activeCount,
        inactive: inactiveCount,
        error: errorCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceId]/integrations] Error:', error);
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
 * POST /api/workspaces/[workspaceId]/integrations
 *
 * Create a new integration for the workspace.
 *
 * Request body:
 * - provider: Integration provider (SLACK, GITHUB, etc.)
 * - name: Display name for the integration
 * - description: Optional description
 * - providerConfig: Provider-specific configuration
 * - syncEnabled: Enable automatic syncing (default: false)
 * - metadata: Additional metadata
 *
 * @param request - Next.js request with integration data
 * @param params - Route parameters with workspaceId
 * @returns Created integration object
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
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

    // Get workspace ID from params
    const { workspaceId } = await params;
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
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
          'Admin permission required to create integrations',
          INTEGRATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createIntegrationSchema.safeParse(body);
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

    // Create integration
    const integration = await createIntegration(
      workspaceId,
      parseResult.data,
      session.user.id,
    );

    // Remove sensitive fields from response
    const safeIntegration = {
      ...integration,
      accessToken: undefined,
      refreshToken: undefined,
    };

    return NextResponse.json(
      {
        integration: safeIntegration,
        message: 'Integration created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceId]/integrations] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
