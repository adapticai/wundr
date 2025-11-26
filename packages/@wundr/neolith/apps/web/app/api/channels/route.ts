/**
 * Channel API Routes
 *
 * Handles listing and creating channels.
 *
 * Routes:
 * - GET /api/channels - List channels by workspace
 * - POST /api/channels - Create a new channel
 *
 * @module app/api/channels/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createChannelSchema,
  channelFiltersSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { CreateChannelInput, ChannelFiltersInput } from '@/lib/validations/organization';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
return null;
}

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
return null;
}

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * GET /api/channels
 *
 * List channels the authenticated user has access to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of channels
 *
 * @example
 * ```
 * GET /api/channels?workspaceId=ws_123&type=PUBLIC&page=1&limit=50
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = channelFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: ChannelFiltersInput = parseResult.data;

    // Workspace ID is required for listing channels
    if (!filters.workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'workspaceId is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(filters.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Build where clause
    // User sees: public channels + private channels they are a member of
    const channelMemberships = await prisma.channelMember.findMany({
      where: {
        userId: session.user.id,
        channel: { workspaceId: filters.workspaceId },
      },
      select: { channelId: true },
    });

    const memberChannelIds = channelMemberships.map((m) => m.channelId);

    const where: Prisma.channelWhereInput = {
      workspaceId: filters.workspaceId,
      OR: [
        { type: 'PUBLIC' },
        { id: { in: memberChannelIds } },
      ],
      ...(!filters.includeArchived && { isArchived: false }),
      ...(filters.type && { type: filters.type }),
      ...(filters.search && {
        name: { contains: filters.search, mode: 'insensitive' },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy
    const orderBy: Prisma.channelOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch channels and total count in parallel
    const [channels, totalCount] = await Promise.all([
      prisma.channel.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: {
              channelMembers: true,
              messages: true,
            },
          },
        },
      }),
      prisma.channel.count({ where }),
    ]);

    // Add membership status to each channel
    const channelsWithMembership = channels.map((channel) => ({
      ...channel,
      isMember: memberChannelIds.includes(channel.id),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    return NextResponse.json({
      data: channelsWithMembership,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/channels] Error:', error);
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
 * POST /api/channels
 *
 * Create a new channel. Requires workspace membership.
 *
 * @param request - Next.js request with channel data
 * @returns Created channel object
 *
 * @example
 * ```
 * POST /api/channels
 * Content-Type: application/json
 *
 * {
 *   "name": "engineering",
 *   "type": "PUBLIC",
 *   "workspaceId": "ws_123",
 *   "description": "Engineering team discussions",
 *   "memberIds": ["user_1", "user_2"]
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
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
    const parseResult = createChannelSchema.safeParse(body);
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

    const input: CreateChannelInput = parseResult.data;

    // Check workspace access
    const access = await checkWorkspaceAccess(input.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Must be workspace member to create channels
    if (!access.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to create channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Generate slug from name
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create channel with creator as admin and initial members
    const channel = await prisma.$transaction(async (tx) => {
      // Create the channel
      const newChannel = await tx.channel.create({
        data: {
          name: input.name,
          slug,
          type: input.type,
          description: input.description,
          topic: input.topic,
          workspaceId: input.workspaceId,
          createdById: session.user.id,
        },
      });

      // Add creator as channel admin
      await tx.channelMember.create({
        data: {
          channelId: newChannel.id,
          userId: session.user.id,
          role: 'ADMIN',
        },
      });

      // Add initial members (if provided and not the creator)
      const memberIdsToAdd = input.memberIds.filter((id) => id !== session.user.id);
      if (memberIdsToAdd.length > 0) {
        // Verify all members are workspace members
        const workspaceMembers = await tx.workspaceMember.findMany({
          where: {
            workspaceId: input.workspaceId,
            userId: { in: memberIdsToAdd },
          },
          select: { userId: true },
        });

        const validMemberIds = workspaceMembers.map((m) => m.userId);

        // Add valid members
        if (validMemberIds.length > 0) {
          await tx.channelMember.createMany({
            data: validMemberIds.map((userId) => ({
              channelId: newChannel.id,
              userId,
              role: 'MEMBER' as const,
            })),
          });
        }
      }

      // Return channel with counts
      return tx.channel.findUnique({
        where: { id: newChannel.id },
        include: {
          _count: {
            select: {
              channelMembers: true,
              messages: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      { data: channel, message: 'Channel created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
