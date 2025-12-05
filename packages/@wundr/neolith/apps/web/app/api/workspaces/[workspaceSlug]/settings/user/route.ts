/**
 * Workspace-specific User Settings API Routes
 *
 * Handles per-workspace user preferences and settings.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/settings/user - Get workspace-specific user settings
 * - PATCH /api/workspaces/:workspaceSlug/settings/user - Update workspace-specific user settings
 *
 * @module app/api/workspaces/[workspaceSlug]/settings/user/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Workspace user settings schema
 */
interface WorkspaceUserSettings {
  displayNameOverride?: string | null;
  defaultChannelId?: string | null;
  mutedUntil?: string | null;
  sidebarCollapsed?: {
    channels?: boolean;
    dms?: boolean;
    starred?: boolean;
  };
  channelOrder?: string[];
  statusMessage?: string | null;
  autoJoinChannels?: string[];
  defaultTaskView?: 'list' | 'board' | 'calendar';
  calendarSyncEnabled?: boolean;
  mutedChannelSchedules?: Array<{
    channelId: string;
    schedule: {
      days: number[];
      startTime: string;
      endTime: string;
    };
  }>;
}

const workspaceUserSettingsSchema = z.object({
  displayNameOverride: z.string().max(32).nullable().optional(),
  defaultChannelId: z.string().nullable().optional(),
  mutedUntil: z.string().datetime().nullable().optional(),
  sidebarCollapsed: z
    .object({
      channels: z.boolean().optional(),
      dms: z.boolean().optional(),
      starred: z.boolean().optional(),
    })
    .optional(),
  channelOrder: z.array(z.string()).optional(),
  statusMessage: z.string().max(100).nullable().optional(),
  autoJoinChannels: z.array(z.string()).optional(),
  defaultTaskView: z.enum(['list', 'board', 'calendar']).optional(),
  calendarSyncEnabled: z.boolean().optional(),
  mutedChannelSchedules: z
    .array(
      z.object({
        channelId: z.string(),
        schedule: z.object({
          days: z.array(z.number().min(0).max(6)),
          startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
          endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        }),
      }),
    )
    .optional(),
});

interface RouteParams {
  params: Promise<{
    workspaceSlug: string;
  }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/settings/user
 *
 * Get workspace-specific user settings for the current user.
 *
 * @example
 * ```
 * GET /api/workspaces/my-workspace/settings/user
 *
 * Response:
 * {
 *   "data": {
 *     "displayNameOverride": "Engineering Johnny",
 *     "defaultChannelId": "channel123",
 *     "mutedUntil": null,
 *     "sidebarCollapsed": { "channels": false, "dms": true },
 *     "channelOrder": ["channel1", "channel2"],
 *     "statusMessage": "Deep in code",
 *     "autoJoinChannels": ["general", "engineering"],
 *     "defaultTaskView": "board",
 *     "calendarSyncEnabled": true
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Get workspace member settings
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 },
      );
    }

    const settings = (member.settings as WorkspaceUserSettings) || {};

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('[GET /api/workspaces/:slug/settings/user] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceSlug/settings/user
 *
 * Update workspace-specific user settings.
 * Settings are merged with existing settings.
 *
 * @example
 * ```
 * PATCH /api/workspaces/my-workspace/settings/user
 * Content-Type: application/json
 *
 * {
 *   "displayNameOverride": "Engineering Johnny",
 *   "defaultTaskView": "board",
 *   "sidebarCollapsed": { "channels": false }
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "displayNameOverride": "Engineering Johnny",
 *     "defaultChannelId": "channel123",
 *     "mutedUntil": null,
 *     "sidebarCollapsed": { "channels": false, "dms": true },
 *     "defaultTaskView": "board"
 *   },
 *   "message": "Settings updated successfully"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = workspaceUserSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updates = parseResult.data;

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Get current workspace member
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 },
      );
    }

    // Merge settings
    const currentSettings =
      (member.settings as WorkspaceUserSettings | null) || {};
    const newSettings: WorkspaceUserSettings = {
      ...currentSettings,
      ...updates,
    };

    // Deep merge for nested objects
    if (updates.sidebarCollapsed) {
      newSettings.sidebarCollapsed = {
        ...(currentSettings.sidebarCollapsed || {}),
        ...updates.sidebarCollapsed,
      };
    }

    // Update workspace member settings
    const updatedMember = await prisma.workspaceMember.update({
      where: {
        id: member.id,
      },
      data: {
        settings: newSettings as unknown as Prisma.InputJsonValue,
      },
      select: {
        settings: true,
      },
    });

    return NextResponse.json({
      data: updatedMember.settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:slug/settings/user] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
