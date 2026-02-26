/**
 * Call Invite API Route
 *
 * Handles inviting users to an active call.
 *
 * Routes:
 * - POST /api/calls/:callId/invite - Invite users to call
 *
 * @module app/api/calls/[callId]/invite/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  callIdParamSchema,
  inviteToCallSchema,
  CALL_ERROR_CODES,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with call ID parameter
 */
interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/invite
 *
 * Invite users to join an active call. Sends notifications to specified users.
 *
 * @param request - Next.js request with user IDs to invite
 * @param context - Route context containing call ID
 * @returns List of invited users
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CALL_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate call ID parameter
    const params = await context.params;
    const paramResult = callIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid call ID format',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = inviteToCallSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { userIds, message } = parseResult.data;

    // Get call info
    let call: {
      id: string;
      channelId: string;
      type: string;
      status: string;
      roomName: string;
    } | null = null;

    try {
      const calls = await prisma.$queryRaw<
        Array<{
          id: string;
          channel_id: string;
          type: string;
          status: string;
          room_name: string;
        }>
      >`
        SELECT id, channel_id, type, status, room_name
        FROM calls
        WHERE id = ${params.callId}
        LIMIT 1
      `;

      if (calls.length > 0) {
        call = {
          id: calls[0].id,
          channelId: calls[0].channel_id,
          type: calls[0].type,
          status: calls[0].status,
          roomName: calls[0].room_name,
        };
      }
    } catch {
      // Try channel settings
      const channels = await prisma.channel.findMany({
        where: {
          settings: {
            path: ['activeCall', 'id'],
            equals: params.callId,
          },
        },
      });

      if (channels.length > 0) {
        const settings = channels[0].settings as {
          activeCall?: {
            id: string;
            type: string;
            status: string;
            roomName: string;
          };
        };
        if (settings?.activeCall) {
          call = {
            id: settings.activeCall.id,
            channelId: channels[0].id,
            type: settings.activeCall.type,
            status: settings.activeCall.status,
            roomName: settings.activeCall.roomName,
          };
        }
      }
    }

    if (!call) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 }
      );
    }

    // Check if call is still active
    if (call.status === 'ended' || call.status === 'failed') {
      return NextResponse.json(
        createErrorResponse(
          'Call has already ended',
          CALL_ERROR_CODES.CALL_ALREADY_ENDED
        ),
        { status: 400 }
      );
    }

    // Verify inviter has access to the channel
    const channel = await prisma.channel.findUnique({
      where: { id: call.channelId },
      include: { workspace: true },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          CALL_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: channel.workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Access denied', CALL_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Validate that all invited users exist and have access
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const foundUserIds = new Set(users.map(u => u.id));
    const invalidUserIds = userIds.filter(id => !foundUserIds.has(id));

    if (invalidUserIds.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          'Some users were not found',
          CALL_ERROR_CODES.USER_NOT_FOUND,
          { invalidUserIds }
        ),
        { status: 400 }
      );
    }

    // Check which users have access to the channel
    const usersWithAccess: string[] = [];
    const usersWithoutAccess: string[] = [];

    for (const user of users) {
      // Check org membership
      const userOrgMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: channel.workspace.organizationId,
            userId: user.id,
          },
        },
      });

      if (!userOrgMembership) {
        usersWithoutAccess.push(user.id);
        continue;
      }

      // For private channels, check channel membership
      if (channel.type === 'PRIVATE') {
        const userChannelMembership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: channel.id,
              userId: user.id,
            },
          },
        });

        if (!userChannelMembership) {
          usersWithoutAccess.push(user.id);
          continue;
        }
      }

      usersWithAccess.push(user.id);
    }

    if (usersWithAccess.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'No invited users have access to this channel',
          CALL_ERROR_CODES.FORBIDDEN,
          { usersWithoutAccess }
        ),
        { status: 403 }
      );
    }

    // Log notifications for invited users (in_app + email)
    for (const userId of usersWithAccess) {
      const invitedUser = users.find(u => u.id === userId);
      if (!invitedUser) continue;

      try {
        // In-app notification log
        await (prisma as any).communicationLog.create({
          data: {
            channel: 'in_app',
            direction: 'outbound',
            recipientAddress: userId,
            senderAddress: 'system@wundr.io',
            content: `You have been invited to join a ${call.type} call in channel ${call.channelId}.${message ? ` Message: ${message}` : ''}`,
            status: 'pending',
            metadata: {
              type: 'call_invite',
              callId: params.callId,
              roomName: call.roomName,
              callType: call.type,
            },
            organizationId: channel.workspace.organizationId,
          },
        });

        // Email notification log
        if (invitedUser.email) {
          await (prisma as any).communicationLog.create({
            data: {
              channel: 'email',
              direction: 'outbound',
              recipientAddress: invitedUser.email,
              senderAddress: 'system@wundr.io',
              content: `Subject: You've been invited to a call\n\nHi ${invitedUser.name || 'there'},\n\nYou have been invited to join an active ${call.type} call.${message ? `\n\nMessage: ${message}` : ''}`,
              status: 'pending',
              metadata: {
                type: 'call_invite',
                callId: params.callId,
                roomName: call.roomName,
                callType: call.type,
              },
              organizationId: channel.workspace.organizationId,
            },
          });
        }
      } catch (err) {
        console.error(
          '[POST /api/calls/:callId/invite] Failed to log notification:',
          err
        );
        // Don't fail the main operation if notification logging fails
      }
    }

    // Record invitations (if table exists)
    const now = new Date();
    for (const userId of usersWithAccess) {
      try {
        await prisma.$executeRaw`
          INSERT INTO call_invitations (id, call_id, user_id, invited_by_id, message, created_at)
          VALUES (
            ${`inv_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`},
            ${params.callId},
            ${userId},
            ${session.user.id},
            ${message ?? null},
            ${now}
          )
          ON CONFLICT (call_id, user_id) DO UPDATE SET
            invited_by_id = ${session.user.id},
            message = ${message ?? null},
            created_at = ${now}
        `;
      } catch (invitationError) {
        console.error(
          '[POST /api/calls/:callId/invite] Invitation tracking not available:',
          invitationError
        );
        // Invitations table may not exist
      }
    }

    return NextResponse.json({
      data: {
        callId: params.callId,
        invitedUsers: usersWithAccess,
        skippedUsers: usersWithoutAccess,
      },
      message: `Invited ${usersWithAccess.length} user(s) to the call`,
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/invite] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
