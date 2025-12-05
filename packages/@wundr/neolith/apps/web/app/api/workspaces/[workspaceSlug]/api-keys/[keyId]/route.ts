/**
 * Individual API Key Management Routes
 *
 * Handles operations on specific API keys:
 * - Update API key configuration
 * - Delete/revoke API key
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceSlug/api-keys/:keyId - Update API key
 * - DELETE /api/workspaces/:workspaceSlug/api-keys/:keyId - Revoke API key
 *
 * @module app/api/workspaces/[workspaceSlug]/api-keys/[keyId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and key ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; keyId: string }>;
}

/**
 * Validation schema for updating API keys
 */
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().min(1).max(10000),
      requestsPerHour: z.number().min(1).max(100000),
      requestsPerDay: z.number().min(1).max(1000000),
    })
    .optional(),
  ipRestrictions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/workspaces/:workspaceSlug/api-keys/:keyId
 *
 * Update an existing API key's configuration
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, keyId } = await context.params;

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      include: {
        workspaceMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    const membership = workspace.workspaceMembers[0];

    // Only ADMIN and OWNER can update API keys
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can update API keys' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updates = updateApiKeySchema.parse(body);

    // Get current API keys
    const currentSettings = workspace.settings as Record<
      string,
      unknown
    > | null;
    const apiKeys =
      currentSettings &&
      typeof currentSettings === 'object' &&
      'apiKeys' in currentSettings
        ? (currentSettings.apiKeys as Array<{
            id: string;
            name: string;
            keyHash: string;
            lastFourChars: string;
            permissions: string[];
            rateLimit: {
              requestsPerMinute: number;
              requestsPerHour: number;
              requestsPerDay: number;
            };
            ipRestrictions: string[];
            expiresAt: string | null;
            isActive: boolean;
            createdAt: string;
            lastUsedAt: string | null;
            usageStats: {
              totalRequests: number;
              last24Hours: number;
              last7Days: number;
              last30Days: number;
            };
          }>)
        : [];

    // Find the key to update
    const keyIndex = apiKeys.findIndex(k => k.id === keyId);
    if (keyIndex === -1) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Update the key
    const updatedKey = {
      ...apiKeys[keyIndex],
      ...updates,
    };

    apiKeys[keyIndex] = updatedKey;

    // Save updated keys
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: {
          ...(currentSettings || {}),
          apiKeys,
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        permissions: updatedKey.permissions,
        rateLimit: updatedKey.rateLimit,
        ipRestrictions: updatedKey.ipRestrictions,
        isActive: updatedKey.isActive,
      },
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceSlug/api-keys/:keyId] Error:',
      error
    );

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/api-keys/:keyId
 *
 * Revoke an API key (permanently delete)
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, keyId } = await context.params;

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      include: {
        workspaceMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    const membership = workspace.workspaceMembers[0];

    // Only ADMIN and OWNER can delete API keys
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can delete API keys' },
        { status: 403 }
      );
    }

    // Get current API keys
    const currentSettings = workspace.settings as Record<
      string,
      unknown
    > | null;
    const apiKeys =
      currentSettings &&
      typeof currentSettings === 'object' &&
      'apiKeys' in currentSettings
        ? (currentSettings.apiKeys as Array<{ id: string }>)
        : [];

    // Filter out the key to delete
    const updatedKeys = apiKeys.filter(k => k.id !== keyId);

    if (updatedKeys.length === apiKeys.length) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Save updated keys
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: {
          ...(currentSettings || {}),
          apiKeys: updatedKeys,
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceSlug/api-keys/:keyId] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
