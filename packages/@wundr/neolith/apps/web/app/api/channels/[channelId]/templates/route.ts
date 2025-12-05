/**
 * Channel Templates API Routes
 *
 * Handles listing and creating message templates for a channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/templates - List all templates for a channel
 * - POST /api/channels/:channelId/templates - Create a new template (admin only)
 *
 * @module app/api/channels/[channelId]/templates/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Validation schema for creating a template
 */
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(2000),
  icon: z.string().max(4).nullable().optional(),
});

/**
 * Error response helper
 */
function createErrorResponse(message: string, code?: string) {
  return {
    error: message,
    code: code || 'UNKNOWN_ERROR',
  };
}

/**
 * Check if user is an admin/creator of the channel
 */
async function checkChannelAdmin(channelId: string, userId: string): Promise<boolean> {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    select: {
      role: true,
      channel: {
        select: {
          createdById: true,
        },
      },
    },
  });

  if (!membership) {
    return false;
  }

  // User is admin if they are the creator or have ADMIN role
  return (
    membership.channel.createdById === userId ||
    membership.role === 'ADMIN' ||
    membership.role === 'OWNER'
  );
}

/**
 * Check if user is a member of the channel
 */
async function checkChannelMembership(channelId: string, userId: string) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  return membership;
}

/**
 * GET /api/channels/:channelId/templates
 *
 * List all templates for a channel (both system and custom)
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns List of templates
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
        createErrorResponse('Authentication required', 'UNAUTHORIZED'),
        { status: 401 },
      );
    }

    // Validate channel ID
    const params = await context.params;
    if (!params.channelId) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Not a member of this channel', 'FORBIDDEN'),
        { status: 403 },
      );
    }

    // Fetch templates for the channel
    const templates = await prisma.channelTemplate.findMany({
      where: {
        channelId: params.channelId,
      },
      orderBy: [
        { isSystem: 'desc' }, // System templates first
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        icon: true,
        isSystem: true,
        channelId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/templates] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', 'INTERNAL_ERROR'),
      { status: 500 },
    );
  }
}

/**
 * POST /api/channels/:channelId/templates
 *
 * Create a new message template for the channel
 * Requires authentication and admin permissions.
 *
 * @param request - Next.js request with template data
 * @param context - Route context containing channel ID
 * @returns Created template object
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
        createErrorResponse('Authentication required', 'UNAUTHORIZED'),
        { status: 401 },
      );
    }

    // Validate channel ID
    const params = await context.params;
    if (!params.channelId) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }

    // Check if user is admin of the channel
    const isAdmin = await checkChannelAdmin(params.channelId, session.user.id);
    if (!isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only channel admins can create templates',
          'FORBIDDEN',
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
        createErrorResponse('Invalid JSON body', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }

    const input = parseResult.data;

    // Check if template with same name already exists in this channel
    const existingTemplate = await prisma.channelTemplate.findUnique({
      where: {
        channelId_name: {
          channelId: params.channelId,
          name: input.name,
        },
      },
    });

    if (existingTemplate) {
      return NextResponse.json(
        createErrorResponse(
          'A template with this name already exists',
          'DUPLICATE_NAME',
        ),
        { status: 409 },
      );
    }

    // Create the template
    const template = await prisma.channelTemplate.create({
      data: {
        name: input.name,
        description: input.description || null,
        content: input.content,
        icon: input.icon || null,
        isSystem: false,
        channelId: params.channelId,
        createdById: session.user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        icon: true,
        isSystem: true,
        channelId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        data: template,
        message: 'Template created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/templates] Error:', error);

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string };

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          createErrorResponse(
            'A template with this name already exists',
            'DUPLICATE_NAME',
          ),
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', 'INTERNAL_ERROR'),
      { status: 500 },
    );
  }
}
