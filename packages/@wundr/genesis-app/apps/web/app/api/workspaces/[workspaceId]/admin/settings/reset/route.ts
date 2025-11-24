/**
 * Reset Settings API Route
 *
 * Handles resetting workspace settings to defaults.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/settings/reset - Reset settings
 *
 * @module app/api/workspaces/[workspaceId]/admin/settings/reset/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@genesis/database';

import { auth } from '@/lib/auth';
import {
  resetSettingsSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type WorkspaceSettings,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Default settings for reset
 */
const DEFAULT_SETTINGS: WorkspaceSettings = {
  general: {
    timezone: 'UTC',
    language: 'en',
  },
  notifications: {
    emailNotifications: true,
    slackNotifications: false,
    dailyDigest: true,
    mentionAlerts: true,
  },
  security: {
    requireMfa: false,
    sessionTimeoutMinutes: 480,
    allowedDomains: [],
    ipWhitelist: [],
  },
  integrations: {
    slackEnabled: false,
    githubEnabled: false,
    webhooksEnabled: false,
  },
  customFields: {},
};

/**
 * POST /api/workspaces/:workspaceId/admin/settings/reset
 *
 * Reset workspace settings to defaults. Optionally reset only a specific section.
 * Requires admin role.
 *
 * @param request - Next.js request with optional section to reset
 * @param context - Route context containing workspace ID
 * @returns Reset workspace settings
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is valid
    }

    // Validate input
    const parseResult = resetSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { section } = parseResult.data;
    const currentSettings = (membership.workspace.settings as WorkspaceSettings) || DEFAULT_SETTINGS;

    let newSettings: WorkspaceSettings;

    if (section) {
      // Reset only the specified section
      newSettings = {
        ...currentSettings,
        [section]: DEFAULT_SETTINGS[section],
      };
    } else {
      // Reset all settings
      newSettings = DEFAULT_SETTINGS;
    }

    // Update workspace
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: newSettings },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'settings.updated', ${session.user.id}, ${JSON.stringify({ resetSection: section || 'all' })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ settings: updatedWorkspace.settings as WorkspaceSettings });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/admin/settings/reset] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to reset settings', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
