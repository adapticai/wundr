/**
 * API Key Regeneration Route
 *
 * Handles regenerating an existing API key while preserving its configuration
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/api-keys/:keyId/regenerate - Regenerate API key
 *
 * @module app/api/workspaces/[workspaceSlug]/api-keys/[keyId]/regenerate/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and key ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; keyId: string }>;
}

/**
 * Hash an API key using PBKDF2 for secure storage
 */
function hashApiKey(key: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(key, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * POST /api/workspaces/:workspaceSlug/api-keys/:keyId/regenerate
 *
 * Regenerate an API key, creating a new key value while preserving configuration
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
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
        { status: 404 },
      );
    }

    const membership = workspace.workspaceMembers[0];

    // Only ADMIN and OWNER can regenerate API keys
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can regenerate API keys' },
        { status: 403 },
      );
    }

    // Get current API keys
    const currentSettings = workspace.settings as Record<string, unknown> | null;
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

    // Find the key to regenerate
    const keyIndex = apiKeys.findIndex((k) => k.id === keyId);
    if (keyIndex === -1) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const keyHash = hashApiKey(newApiKey);
    const lastFourChars = newApiKey.slice(-4);

    // Update the key with new hash and last four chars
    apiKeys[keyIndex] = {
      ...apiKeys[keyIndex],
      keyHash,
      lastFourChars,
      lastUsedAt: null, // Reset last used
    };

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

    // Return the new plain API key (only shown once)
    return NextResponse.json({
      data: {
        id: apiKeys[keyIndex].id,
        key: newApiKey, // Plain key returned only once
        name: apiKeys[keyIndex].name,
        permissions: apiKeys[keyIndex].permissions,
      },
      message: 'API key regenerated successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/api-keys/:keyId/regenerate] Error:',
      error,
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
