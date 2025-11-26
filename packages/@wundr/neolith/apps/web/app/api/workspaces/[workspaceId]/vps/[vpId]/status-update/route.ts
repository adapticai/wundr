/**
 * VP Status Update API Route
 *
 * Allows VPs to post status updates to their assigned channels.
 * Includes task progress, milestones, announcements, etc.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/status-update
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/status-update/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  statusUpdateSchema,
  createErrorResponse,
  VP_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/vp-conversation';

import type { StatusUpdateInput } from '@/lib/validations/vp-conversation';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/status-update
 *
 * VP posts a status update to assigned channels.
 * - Auto-targets VP's assigned channels if not specified
 * - Creates messages in all target channels
 * - Can include task references and metadata
 *
 * @param request - Next.js request with status update data
 * @param context - Route context containing workspace and VP IDs
 * @returns Created messages and channel details
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (VP service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          VP_CONVERSATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceId, vpId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = statusUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: StatusUpdateInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          VP_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify VP exists and belongs to this workspace/organization
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: workspace.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          VP_CONVERSATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the authenticated user is the VP's user account
    if (vp.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Unauthorized: You can only post status updates as your own VP',
          VP_CONVERSATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // If task ID is provided, verify it exists and belongs to this VP
    if (input.taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: input.taskId,
          vpId,
        },
      });

      if (!task) {
        return NextResponse.json(
          createErrorResponse(
            'Task not found or not assigned to this VP',
            VP_CONVERSATION_ERROR_CODES.TASK_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    // Determine target channels
    let targetChannelIds: string[] = [];

    if (input.channelIds && input.channelIds.length > 0) {
      // Use provided channel IDs, but verify they exist and VP has access
      const channels = await prisma.channel.findMany({
        where: {
          id: { in: input.channelIds },
          workspaceId,
        },
        select: { id: true },
      });

      if (channels.length !== input.channelIds.length) {
        return NextResponse.json(
          createErrorResponse(
            'One or more channels not found',
            VP_CONVERSATION_ERROR_CODES.CHANNEL_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      targetChannelIds = channels.map((c) => c.id);
    } else {
      // Auto-target VP's assigned channels (channels where VP is a member)
      const vpChannels = await prisma.channelMember.findMany({
        where: {
          userId: vp.user.id,
          channel: {
            workspaceId,
            type: { not: 'DM' }, // Exclude DM channels from status updates
          },
        },
        select: {
          channelId: true,
        },
      });

      if (vpChannels.length === 0) {
        return NextResponse.json(
          createErrorResponse(
            'No assigned channels found for this VP',
            VP_CONVERSATION_ERROR_CODES.NO_ASSIGNED_CHANNELS,
          ),
          { status: 400 },
        );
      }

      targetChannelIds = vpChannels.map((c) => c.channelId);
    }

    // Create messages in all target channels
    const messages = await Promise.all(
      targetChannelIds.map((channelId) =>
        prisma.message.create({
          data: {
            content: input.message,
            type: 'SYSTEM',
            channelId,
            authorId: vp.user.id,
            metadata: {
              statusType: input.statusType,
              taskId: input.taskId,
              ...input.metadata,
            } as unknown as Prisma.InputJsonValue,
          },
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
      ),
    );

    // Get all unique channel member IDs (excluding the VP)
    const channelMembers = await prisma.channelMember.findMany({
      where: {
        channelId: { in: targetChannelIds },
        userId: { not: vp.user.id },
      },
      select: {
        userId: true,
        channelId: true,
      },
      distinct: ['userId', 'channelId'],
    });

    // Create notifications for channel members
    if (channelMembers.length > 0) {
      await prisma.notification.createMany({
        data: channelMembers.map((member) => ({
          userId: member.userId,
          type: 'SYSTEM' as const,
          title: `Status update from ${vp.user.name}`,
          body: input.message.substring(0, 200),
          resourceId: messages.find((m) => m.channelId === member.channelId)?.id,
          resourceType: 'message',
          metadata: {
            statusType: input.statusType,
            vpId,
            taskId: input.taskId,
          } as unknown as Prisma.InputJsonValue,
        })),
      });
    }

    return NextResponse.json(
      {
        data: {
          messages,
          channelsPosted: messages.map((m) => ({
            id: m.channel.id,
            name: m.channel.name,
            slug: m.channel.slug,
          })),
          notificationsSent: channelMembers.length,
        },
        message: `Status update posted to ${messages.length} channel(s)`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/vps/:vpId/status-update] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
