/**
 * Channel Members API Routes
 *
 * Handles listing and adding members to a channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/members - List channel members
 * - POST /api/channels/:channelId/members - Add member to channel
 *
 * @module app/api/channels/[channelId]/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  addChannelMemberSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { AddChannelMemberInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Helper to check channel access
 */
async function checkChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channels.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel) {
return null;
}

  const orgMembership = await prisma.organization_members.findUnique({
    where: {
      organizationId_userId: {
        organizationId: channel.workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
return null;
}

  const channelMembership = await prisma.channel_members.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  return {
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * GET /api/channels/:channelId/members
 *
 * List all members of a channel. Requires channel membership for private channels.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns List of channel members
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkChannelAccess(params.channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // For private channels, user must be a member
    if (access.channel.type === 'PRIVATE' && !access.channelMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to private channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Fetch all members
    const members = await prisma.channel_members.findMany({
      where: { channelId: params.channelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
            status: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({
      data: members,
      count: members.length,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/channels/:channelId/members
 *
 * Add a member to the channel. Requires channel ADMIN role.
 * User must be a workspace member.
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing channel ID
 * @returns Created membership object
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkChannelAccess(params.channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Channel Admin required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = addChannelMemberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: AddChannelMemberInput = parseResult.data;

    // Check if user is a workspace member
    const workspaceMembership = await prisma.workspace_members.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: access.channel.workspaceId,
          userId: input.userId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User must be a workspace member to join the channel',
          ORG_ERROR_CODES.USER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if user is already a channel member
    const existingMembership = await prisma.channel_members.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: input.userId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User is already a member of this channel',
          ORG_ERROR_CODES.ALREADY_MEMBER,
        ),
        { status: 409 },
      );
    }

    // Add member
    const newMembership = await prisma.channel_members.create({
      data: {
        channelId: params.channelId,
        userId: input.userId,
        role: input.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: newMembership, message: 'Member added to channel successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
