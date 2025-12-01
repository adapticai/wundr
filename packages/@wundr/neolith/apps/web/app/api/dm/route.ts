/**
 * Direct Message API Route
 *
 * Handles creating/getting DM channels between users.
 *
 * Routes:
 * - POST /api/dm - Create or get existing DM channel
 *
 * @module app/api/dm/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createDMSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { CreateDMInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * POST /api/dm
 *
 * Create a new DM channel or return existing one between two users.
 *
 * @param request - Next.js request with DM data
 * @returns DM channel object
 *
 * @example
 * ```
 * POST /api/dm
 * Content-Type: application/json
 *
 * {
 *   "userId": "user_456",
 *   "workspaceId": "ws_123"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
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
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = createDMSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: CreateDMInput = parseResult.data;

    // Cannot DM yourself
    if (input.userId === session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot create DM with yourself',
          ORG_ERROR_CODES.DM_SELF_NOT_ALLOWED
        ),
        { status: 400 }
      );
    }

    // Check if workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if both users are workspace members
    const [requesterMembership, targetMembership] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: session.user.id,
          },
        },
      }),
      prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: input.userId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    if (!requesterMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Target user is not a member of this workspace',
          ORG_ERROR_CODES.USER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Generate a consistent DM name for the pair (alphabetically sorted user IDs)
    const sortedIds = [session.user.id, input.userId].sort();
    const dmIdentifier = `dm:${sortedIds[0]}:${sortedIds[1]}`;

    // Check if DM channel already exists
    const existingDM = await prisma.channel.findFirst({
      where: {
        workspaceId: input.workspaceId,
        type: 'DM',
        name: dmIdentifier,
      },
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (existingDM) {
      // Filter out the current user to get the "other" participant
      const otherParticipant = existingDM.channelMembers.find(
        (m: { userId: string }) => m.userId !== session.user.id
      );

      return NextResponse.json({
        data: {
          ...existingDM,
          displayName:
            otherParticipant?.user.displayName || otherParticipant?.user.name,
          participant: otherParticipant?.user,
        },
        isNew: false,
      });
    }

    // Create new DM channel
    const dmChannel = await prisma.$transaction(async tx => {
      // Create the DM channel
      const newChannel = await tx.channel.create({
        data: {
          name: dmIdentifier,
          slug: dmIdentifier.replace(/:/g, '-'), // Convert dm:id1:id2 to dm-id1-id2
          type: 'DM',
          workspaceId: input.workspaceId,
        },
      });

      // Add both users as members
      await tx.channelMember.createMany({
        data: [
          {
            channelId: newChannel.id,
            userId: session.user.id,
            role: 'MEMBER',
          },
          {
            channelId: newChannel.id,
            userId: input.userId,
            role: 'MEMBER',
          },
        ],
      });

      // Return channel with members
      return tx.channel.findUnique({
        where: { id: newChannel.id },
        include: {
          channelMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    // Get the other participant
    const otherParticipant = dmChannel?.channelMembers.find(
      (m: { userId: string }) => m.userId !== session.user.id
    );

    return NextResponse.json(
      {
        data: {
          ...dmChannel,
          displayName:
            otherParticipant?.user.displayName || otherParticipant?.user.name,
          participant: otherParticipant?.user,
        },
        isNew: true,
        message: 'DM channel created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/dm] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
