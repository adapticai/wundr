/**
 * API Keys Management Routes
 *
 * Handles CRUD operations for workspace API keys with:
 * - List all API keys for a workspace
 * - Create new API key with permissions and configuration
 * - Rate limiting, IP restrictions, and expiry settings
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/api-keys - List all API keys
 * - POST /api/workspaces/:workspaceSlug/api-keys - Create new API key
 *
 * @module app/api/workspaces/[workspaceSlug]/api-keys/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Hash an API key using PBKDF2 for secure storage
 */
function hashApiKey(key: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(key, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Calculate expiration date based on duration string
 */
function calculateExpiryDate(duration: string | null): Date | null {
  if (!duration || duration === 'never') {
    return null;
  }

  const now = new Date();
  const durationMap: Record<string, number> = {
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '1y': 365,
  };

  const days = durationMap[duration];
  if (!days) {
    return null;
  }

  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Validation schema for creating API keys
 */
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  rateLimit: z.object({
    requestsPerMinute: z.number().min(1).max(10000),
    requestsPerHour: z.number().min(1).max(100000),
    requestsPerDay: z.number().min(1).max(1000000),
  }),
  ipRestrictions: z.array(z.string()).default([]),
  expiresIn: z.string().nullable().default(null),
});

/**
 * GET /api/workspaces/:workspaceSlug/api-keys
 *
 * List all API keys for a workspace with usage statistics
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

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

    // Only ADMIN and OWNER can view API keys
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can view API keys' },
        { status: 403 }
      );
    }

    // Fetch API keys from workspace settings
    const settings = workspace.settings as Record<string, unknown> | null;
    const apiKeysData =
      settings && typeof settings === 'object' && 'apiKeys' in settings
        ? (settings.apiKeys as Array<{
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

    // Map to response format (exclude keyHash, include masked key)
    const apiKeys = apiKeysData.map(key => ({
      id: key.id,
      name: key.name,
      key: `${'•'.repeat(44)}${key.lastFourChars}`, // Masked key for display
      lastFourChars: key.lastFourChars,
      permissions: key.permissions,
      rateLimit: key.rateLimit,
      ipRestrictions: key.ipRestrictions,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      usageStats: key.usageStats,
    }));

    return NextResponse.json({ data: apiKeys });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/api-keys] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/api-keys
 *
 * Create a new API key with permissions and configuration
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

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

    // Only ADMIN and OWNER can create API keys
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can create API keys' },
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

    const validatedData = createApiKeySchema.parse(body);

    // Generate new API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const lastFourChars = apiKey.slice(-4);
    const expiresAt = calculateExpiryDate(validatedData.expiresIn);

    // Create new key object
    const newKey = {
      id: crypto.randomUUID(),
      name: validatedData.name,
      keyHash,
      lastFourChars,
      permissions: validatedData.permissions,
      rateLimit: validatedData.rateLimit,
      ipRestrictions: validatedData.ipRestrictions,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      usageStats: {
        totalRequests: 0,
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0,
      },
    };

    // Update workspace settings with new key
    const currentSettings = workspace.settings as Record<
      string,
      unknown
    > | null;
    const existingKeys =
      currentSettings &&
      typeof currentSettings === 'object' &&
      'apiKeys' in currentSettings
        ? (currentSettings.apiKeys as Array<unknown>)
        : [];

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: {
          ...(currentSettings || {}),
          apiKeys: [...existingKeys, newKey],
        } as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Return the plain API key (only shown once)
    return NextResponse.json({
      data: {
        id: newKey.id,
        key: apiKey, // Plain key returned only once
        name: newKey.name,
        permissions: newKey.permissions,
        rateLimit: newKey.rateLimit,
        createdAt: newKey.createdAt,
      },
      message: 'API key created successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/api-keys] Error:',
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
