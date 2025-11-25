/**
 * Integration Test API Route
 *
 * Tests the connection for a specific integration.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/integrations/:integrationId/test - Test connection
 *
 * @module app/api/workspaces/[workspaceId]/integrations/[integrationId]/test/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceAccess,
  testIntegration,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and integration ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; integrationId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/integrations/:integrationId/test
 *
 * Test the connection for a specific integration.
 * Verifies that the integration can successfully communicate with the provider.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and integration IDs
 * @returns Test result with success status, message, and latency
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
    const { workspaceId, integrationId } = params;

    if (!workspaceId || !integrationId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and Integration ID are required',
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

    // Test integration connection
    const result = await testIntegration(workspaceId, integrationId);

    if (!result.success && result.message === 'Integration not found') {
      return NextResponse.json(
        createErrorResponse(
          'Integration not found',
          INTEGRATION_ERROR_CODES.INTEGRATION_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/integrations/:integrationId/test] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
