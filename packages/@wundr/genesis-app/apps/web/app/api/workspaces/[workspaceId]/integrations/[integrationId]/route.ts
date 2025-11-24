/**
 * Integration Detail API Routes
 *
 * Handles single integration operations.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/integrations/:integrationId - Get integration
 * - PATCH /api/workspaces/:workspaceId/integrations/:integrationId - Update integration
 * - DELETE /api/workspaces/:workspaceId/integrations/:integrationId - Delete integration
 *
 * @module app/api/workspaces/[workspaceId]/integrations/[integrationId]/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  getIntegration,
  updateIntegration,
  deleteIntegration,
} from '@/lib/services/integration-service';
import {
  updateIntegrationSchema,
  INTEGRATION_ERROR_CODES,
} from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and integration ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; integrationId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/integrations/:integrationId
 *
 * Get a specific integration by ID.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and integration IDs
 * @returns Integration details
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
        createErrorResponse('Authentication required', INTEGRATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceId, integrationId } = params;

    if (!workspaceId || !integrationId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Integration ID are required',
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

    // Get integration
    const integration = await getIntegration(workspaceId, integrationId);
    if (!integration) {
      return NextResponse.json(
        createErrorResponse(
          'Integration not found',
          INTEGRATION_ERROR_CODES.INTEGRATION_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Remove sensitive fields from response
    const safeIntegration = {
      ...integration,
      accessToken: undefined,
      refreshToken: undefined,
    };

    return NextResponse.json({ integration: safeIntegration });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/integrations/:integrationId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/integrations/:integrationId
 *
 * Update an existing integration.
 *
 * Request body (all optional):
 * - name: Updated display name
 * - description: Updated description
 * - status: Updated status
 * - providerConfig: Updated provider configuration
 * - syncEnabled: Updated sync setting
 * - metadata: Updated metadata
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and integration IDs
 * @returns Updated integration
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
        createErrorResponse('Authentication required', INTEGRATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceId, integrationId } = params;

    if (!workspaceId || !integrationId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Integration ID are required',
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
          'Admin permission required to update integrations',
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
        createErrorResponse('Invalid JSON body', INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateIntegrationSchema.safeParse(body);
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

    // Update integration
    const integration = await updateIntegration(
      workspaceId,
      integrationId,
      parseResult.data
    );

    if (!integration) {
      return NextResponse.json(
        createErrorResponse(
          'Integration not found',
          INTEGRATION_ERROR_CODES.INTEGRATION_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Remove sensitive fields from response
    const safeIntegration = {
      ...integration,
      accessToken: undefined,
      refreshToken: undefined,
    };

    return NextResponse.json({
      integration: safeIntegration,
      message: 'Integration updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/integrations/:integrationId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/integrations/:integrationId
 *
 * Delete an integration.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and integration IDs
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
        createErrorResponse('Authentication required', INTEGRATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceId, integrationId } = params;

    if (!workspaceId || !integrationId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Integration ID are required',
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
          'Admin permission required to delete integrations',
          INTEGRATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Delete integration
    const deleted = await deleteIntegration(workspaceId, integrationId);

    if (!deleted) {
      return NextResponse.json(
        createErrorResponse(
          'Integration not found',
          INTEGRATION_ERROR_CODES.INTEGRATION_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/integrations/:integrationId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
