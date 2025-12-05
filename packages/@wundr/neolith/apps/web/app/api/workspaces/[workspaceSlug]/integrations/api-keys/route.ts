/**
 * API Keys Management Routes
 *
 * Handles creating and listing workspace API keys.
 *
 * @module app/api/workspaces/[workspaceSlug]/integrations/api-keys/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkWorkspaceAccess } from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string; hash: string } {
  const key = `nlt_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}

/**
 * GET /api/workspaces/[workspaceSlug]/integrations/api-keys
 *
 * List all API keys for a workspace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> }
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

    const { workspaceSlug } = await params;

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
    if (!access) {
      return NextResponse.json(
        createErrorResponse('Access denied', INTEGRATION_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Fetch API keys from workspace settings or dedicated table
    // For now, return mock data structure
    const apiKeys = [
      {
        id: `key_${Date.now()}`,
        name: 'Production API Key',
        prefix: 'nlt_prod',
        lastUsed: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/integrations/api-keys] Error:',
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
 * POST /api/workspaces/[workspaceSlug]/integrations/api-keys
 *
 * Generate a new API key for the workspace.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> }
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

    const { workspaceSlug } = await params;

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

    let body: { name: string; expiresInDays?: number };
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

    if (!body.name) {
      return NextResponse.json(
        createErrorResponse(
          'API key name is required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { key, hash } = generateApiKey();
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // In production, store this in a dedicated api_keys table
    // For now, return the generated key
    const apiKey = {
      id: `key_${Date.now()}`,
      name: body.name,
      prefix: key.substring(0, 12),
      hash,
      expiresAt: expiresAt?.toISOString() || null,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        key, // Only show the full key once on creation
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
        message:
          'API key generated successfully. Store this key securely, it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceSlug]/integrations/api-keys] Error:',
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
