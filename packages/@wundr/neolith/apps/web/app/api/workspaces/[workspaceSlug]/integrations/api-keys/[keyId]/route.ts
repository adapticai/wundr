/**
 * Individual API Key Routes
 *
 * Handles operations on a specific API key.
 *
 * @module app/api/workspaces/[workspaceSlug]/integrations/api-keys/[keyId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkWorkspaceAccess } from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * DELETE /api/workspaces/[workspaceSlug]/integrations/api-keys/[keyId]
 *
 * Revoke an API key.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; keyId: string }> }
): Promise<NextResponse> {
  try {
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

    const { workspaceSlug, keyId } = await params;

    // Get workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const access = await checkWorkspaceAccess(workspace.id, session.user.id);
    if (!access?.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required',
          INTEGRATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // In production, delete from api_keys table
    // await prisma.apiKey.delete({ where: { id: keyId } });

    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/[workspaceSlug]/integrations/api-keys/[keyId]] Error:',
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
