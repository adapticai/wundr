/**
 * Workspace Channel Members API Routes
 *
 * Handles listing, adding, and removing members from a channel within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId/members - List channel members
 * - POST /api/workspaces/:workspaceId/channels/:channelId/members - Add members to channel
 * - DELETE /api/workspaces/:workspaceId/channels/:channelId/members - Remove member from channel
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  workspaceIdParamSchema,
  channelRoleEnum,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and channel ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; channelId: string }>;
}

/**
 * Schema for adding members to a channel (supports array of user IDs)
 */
const addChannelMembersSchema = z.object({
  /** Array of user IDs to add as members */
  userIds: z
    .array(z.string().min(1, 'User ID is required'))
    .min(1, 'At least one user ID is required'),

  /** Role to assign to the members */
  role: channelRoleEnum.optional().default('MEMBER'),
});

type AddChannelMembersInput = z.infer<typeof addChannelMembersSchema>;

/**
 * Schema for removing a member from a channel
 */
const removeChannelMemberSchema = z.object({
  /** User ID to remove from channel */
  userId: z.string().min(1, 'User ID is required'),
});

type RemoveChannelMemberInput = z.infer<typeof removeChannelMemberSchema>;

/**
 * Helper to check channel access and permissions
 */
async function checkChannelManagementAccess(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  // Get channel with workspace information
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel || channel.workspaceId !== workspaceId) {
    return null;
  }

  // Check organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
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

  // Check workspace membership
  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  // Check channel membership
  const channelMembership = await prisma.channelMember.findUnique({
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
    workspaceMembership,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/members
 *
 * List all members of a channel. Requires channel membership for private channels.
 * Supports pagination via limit/offset query parameters.
 *
 * Query Parameters:
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Number of items to skip (default: 0)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace and channel IDs
 * @returns List of channel members with pagination metadata
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceParamResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelParamResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceParamResult.success || !channelParamResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameter format',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkChannelManagementAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

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

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10)),
      100,
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // Get total count for pagination metadata
    const totalCount = await prisma.channelMember.count({
      where: { channelId: params.channelId },
    });

    // Fetch paginated members
    const members = await prisma.channelMember.findMany({
      where: { channelId: params.channelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
            status: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      skip: offset,
      take: limit,
    });

    return NextResponse.json({
      data: members,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId/members] Error:',
      error,
    );
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
 * POST /api/workspaces/:workspaceId/channels/:channelId/members
 *
 * Add members to the channel. Requires channel ADMIN role or org ADMIN/OWNER.
 * Users must be workspace members to be added to the channel.
 * Supports adding multiple users at once.
 *
 * @param request - Next.js request with member data (array of user IDs)
 * @param context - Route context containing workspace and channel IDs
 * @returns Created membership objects
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
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceParamResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelParamResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceParamResult.success || !channelParamResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameter format',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkChannelManagementAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if user has permission to manage members
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isWorkspaceAdmin = access.workspaceMembership.role === 'ADMIN';
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isWorkspaceAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Channel Admin required to manage members.',
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
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = addChannelMembersSchema.safeParse(body);
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

    const input: AddChannelMembersInput = parseResult.data;

    // Validate all users are workspace members and not already in channel
    const validationResults = await Promise.all(
      input.userIds.map(async userId => {
        // Check if user is a workspace member
        const workspaceMembership = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: workspaceId,
              userId,
            },
          },
          include: {
            user: true,
          },
        });

        if (!workspaceMembership) {
          return {
            userId,
            valid: false,
            reason: 'User must be a workspace member to join the channel',
          };
        }

        // Check if user is already a channel member
        const existingMembership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: params.channelId,
              userId,
            },
          },
        });

        if (existingMembership) {
          return {
            userId,
            valid: false,
            reason: 'User is already a member of this channel',
          };
        }

        return {
          userId,
          valid: true,
          user: workspaceMembership.user,
        };
      }),
    );

    // Check if any validations failed
    const failures = validationResults.filter(r => !r.valid);
    if (failures.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          'Some users could not be added',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          {
            failures: failures.map(f => ({
              userId: f.userId,
              reason: f.reason,
            })),
          },
        ),
        { status: 400 },
      );
    }

    // Add all valid members
    const newMemberships = await Promise.all(
      validationResults
        .filter(r => r.valid)
        .map(async result => {
          return await prisma.channelMember.create({
            data: {
              channelId: params.channelId,
              userId: result.userId,
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
                  isOrchestrator: true,
                  status: true,
                },
              },
            },
          });
        }),
    );

    return NextResponse.json(
      {
        data: newMemberships,
        message: `${newMemberships.length} member(s) added to channel successfully`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/channels/:channelId/members] Error:',
      error,
    );
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
 * DELETE /api/workspaces/:workspaceId/channels/:channelId/members
 *
 * Remove a member from the channel. Requires channel ADMIN role or org ADMIN/OWNER.
 * Users can remove themselves (leave). Cannot remove the last admin.
 *
 * @param request - Next.js request with userId in body
 * @param context - Route context containing workspace and channel IDs
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceParamResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelParamResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceParamResult.success || !channelParamResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameter format',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check requester's access
    const access = await checkChannelManagementAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
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
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = removeChannelMemberSchema.safeParse(body);
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

    const input: RemoveChannelMemberInput = parseResult.data;

    // Users can remove themselves, or admins can remove others
    const isSelf = session.user.id === input.userId;
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isWorkspaceAdmin = access.workspaceMembership.role === 'ADMIN';
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isSelf && !isOrgAdmin && !isWorkspaceAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get target member
    const targetMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: input.userId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this channel',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if this is the last admin
    if (targetMembership.role === 'ADMIN') {
      const adminCount = await prisma.channelMember.count({
        where: {
          channelId: params.channelId,
          role: 'ADMIN',
        },
      });

      if (adminCount === 1) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot remove the last channel admin. Promote another member first.',
            ORG_ERROR_CODES.CANNOT_LEAVE_LAST_ADMIN,
          ),
          { status: 400 },
        );
      }
    }

    // Remove member
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: input.userId,
        },
      },
    });

    return NextResponse.json({
      message: 'Member removed from channel successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/channels/:channelId/members] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
