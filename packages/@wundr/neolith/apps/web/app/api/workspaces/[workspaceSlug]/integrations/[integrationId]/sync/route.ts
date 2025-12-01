/**
 * Integration Sync API Route
 *
 * Triggers a manual sync for a specific integration.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/integrations/:integrationId/sync - Trigger sync
 *
 * @module app/api/workspaces/[workspaceId]/integrations/[integrationId]/sync/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  syncIntegration,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and integration ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; integrationId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/integrations/:integrationId/sync
 *
 * Trigger a manual sync for a specific integration.
 * This initiates a data synchronization process with the external provider.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and integration IDs
 * @returns Sync result with success status and sync details
 */
export async function POST(
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
    const { workspaceSlug: workspaceId, integrationId } = params;

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
          'Admin permission required to trigger sync',
          INTEGRATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Trigger sync
    const result = await syncIntegration(workspaceId, integrationId);

    if (
      !result.success &&
      result.errors.some(e => e.error === 'Integration not found')
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Integration not found',
          INTEGRATION_ERROR_CODES.INTEGRATION_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/integrations/:integrationId/sync] Error:',
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
