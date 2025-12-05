/**
 * Workspace User Status API Routes
 *
 * Manages user status within a workspace context.
 * Status includes presence indicator and custom status message with optional expiration.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/status - Get current user's status
 * - PUT /api/workspaces/:workspaceSlug/status - Update current user's status
 * - DELETE /api/workspaces/:workspaceSlug/status - Clear custom status
 *
 * @module app/api/workspaces/[workspaceSlug]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { PresenceStatusType } from '@/lib/validations/presence';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Custom status structure
 */
interface CustomStatus {
  emoji: string;
  text: string;
  expiresAt?: string;
}

/**
 * Status response structure (for widget compatibility)
 * The widget expects 'status' to be the custom status object
 */
interface StatusResponse {
  presenceStatus?: PresenceStatusType; // online, away, busy, offline
  status?: CustomStatus | null; // Custom status for widget compatibility
  customStatus?: CustomStatus; // Alternative format
}

/**
 * User preferences with status fields
 */
interface UserPreferences {
  presenceStatus?: PresenceStatusType;
  customStatus?: CustomStatus | null;
  [key: string]: unknown;
}

/**
 * Validation schema for updating status
 */
const updateStatusSchema = z.object({
  status: z.enum(['online', 'away', 'busy', 'offline']).optional(),
  customStatus: z
    .object({
      emoji: z.string().min(1).max(10),
      text: z.string().min(1).max(100),
      expiresAt: z.string().datetime().optional(),
    })
    .optional(),
  emoji: z.string().min(1).max(10).optional(),
  message: z.string().min(1).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
  });

  if (!workspace) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  return { workspace, workspaceMembership };
}

/**
 * Parse user preferences safely
 */
function parseUserPreferences(preferences: unknown): UserPreferences {
  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    return preferences as UserPreferences;
  }
  return {};
}

/**
 * Check if custom status has expired
 */
function isCustomStatusExpired(customStatus: CustomStatus | null): boolean {
  if (!customStatus?.expiresAt) {
    return false;
  }
  return new Date(customStatus.expiresAt) < new Date();
}

/**
 * GET /api/workspaces/:workspaceSlug/status
 *
 * Get the current user's status in the workspace.
 * Returns presence status and custom status if set and not expired.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns User status response
 *
 * @example
 * ```
 * GET /api/workspaces/acme/status
 *
 * Response:
 * {
 *   "status": "online",
 *   "customStatus": {
 *     "emoji": "💬",
 *     "text": "In a meeting",
 *     "expiresAt": "2024-12-05T15:00:00Z"
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: { message: 'Workspace not found or access denied' } },
        { status: 404 }
      );
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    // Parse preferences
    const prefs = parseUserPreferences(user.preferences);

    // Determine presence status
    const isOnline = user.lastActiveAt
      ? Date.now() - user.lastActiveAt.getTime() < 5 * 60 * 1000
      : false;

    const presenceStatus: PresenceStatusType =
      prefs.presenceStatus ??
      (user.status === 'ACTIVE' && isOnline ? 'online' : 'offline');

    // Get custom status if set and not expired
    const customStatus = prefs.customStatus;
    const activeCustomStatus =
      customStatus && !isCustomStatusExpired(customStatus)
        ? customStatus
        : null;

    // Build response (widget expects 'status' to be the custom status object)
    const response: StatusResponse = {
      presenceStatus,
      status: activeCustomStatus, // Widget compatibility
      customStatus: activeCustomStatus ?? undefined, // Alternative format
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/status] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/status
 *
 * Update the current user's status in the workspace.
 * Can update presence status and/or custom status message.
 *
 * @param request - Next.js request with status data
 * @param context - Route context containing workspace slug
 * @returns Updated status response
 *
 * @example
 * ```
 * PUT /api/workspaces/acme/status
 * Content-Type: application/json
 *
 * {
 *   "status": "busy",
 *   "customStatus": {
 *     "emoji": "💬",
 *     "text": "In a meeting",
 *     "expiresAt": "2024-12-05T15:00:00Z"
 *   }
 * }
 *
 * OR (alternative format for widget compatibility):
 *
 * {
 *   "emoji": "💬",
 *   "message": "In a meeting",
 *   "expiresAt": "2024-12-05T15:00:00Z"
 * }
 * ```
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: { message: 'Workspace not found or access denied' } },
        { status: 404 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Validation failed',
            errors: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Get current user preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs = parseUserPreferences(currentUser?.preferences);

    // Build custom status object (support both formats)
    let customStatus: CustomStatus | null | undefined = input.customStatus;

    // Alternative format from widget: { emoji, message, expiresAt }
    if (!customStatus && (input.emoji || input.message)) {
      customStatus = {
        emoji: input.emoji ?? '💬',
        text: input.message ?? '',
        expiresAt: input.expiresAt,
      };
    }

    // Build updated preferences
    const newPrefs: Prisma.JsonObject = {
      ...currentPrefs,
      presenceStatus: input.status ?? currentPrefs.presenceStatus,
      customStatus: (customStatus !== undefined
        ? customStatus
        : currentPrefs.customStatus) as Prisma.JsonValue,
    };

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        status: input.status === 'offline' ? 'INACTIVE' : 'ACTIVE',
        lastActiveAt: new Date(),
        preferences: newPrefs,
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    // Parse updated preferences
    const prefs = parseUserPreferences(updatedUser.preferences);

    // Determine presence status
    const isOnline = updatedUser.lastActiveAt
      ? Date.now() - updatedUser.lastActiveAt.getTime() < 5 * 60 * 1000
      : false;

    const presenceStatus: PresenceStatusType =
      prefs.presenceStatus ??
      (updatedUser.status === 'ACTIVE' && isOnline ? 'online' : 'offline');

    // Get custom status if set and not expired
    const updatedCustomStatus = prefs.customStatus;
    const activeCustomStatus =
      updatedCustomStatus && !isCustomStatusExpired(updatedCustomStatus)
        ? updatedCustomStatus
        : null;

    // Build response (widget expects 'status' to be the custom status object)
    const response: StatusResponse = {
      presenceStatus,
      status: activeCustomStatus, // Widget compatibility
      customStatus: activeCustomStatus ?? undefined, // Alternative format
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[PUT /api/workspaces/:workspaceSlug/status] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/status
 *
 * Clear the current user's custom status.
 * Presence status is retained, only custom status message is removed.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns Updated status response (without custom status)
 *
 * @example
 * ```
 * DELETE /api/workspaces/acme/status
 *
 * Response:
 * {
 *   "status": "online"
 * }
 * ```
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: { message: 'Workspace not found or access denied' } },
        { status: 404 }
      );
    }

    // Get current user preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs = parseUserPreferences(currentUser?.preferences);

    // Build updated preferences (clear custom status)
    const newPrefs: Prisma.JsonObject = {
      ...currentPrefs,
      customStatus: null,
    };

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: new Date(),
        preferences: newPrefs,
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    // Parse updated preferences
    const prefs = parseUserPreferences(updatedUser.preferences);

    // Determine presence status
    const isOnline = updatedUser.lastActiveAt
      ? Date.now() - updatedUser.lastActiveAt.getTime() < 5 * 60 * 1000
      : false;

    const presenceStatus: PresenceStatusType =
      prefs.presenceStatus ??
      (updatedUser.status === 'ACTIVE' && isOnline ? 'online' : 'offline');

    // Build response (without custom status)
    const response: StatusResponse = {
      presenceStatus,
      status: null, // Widget compatibility - custom status is cleared
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceSlug/status] Error:',
      error
    );
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}
