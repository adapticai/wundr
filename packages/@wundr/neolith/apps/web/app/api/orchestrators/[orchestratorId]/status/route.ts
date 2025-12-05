/**
 * Orchestrator Status Update API Route
 *
 * Allows Orchestrators to post status updates to channels.
 *
 * Routes:
 * - POST /api/orchestrators/:id/status - Post a status update
 *
 * @module app/api/orchestrators/[id]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorStatusUpdateSchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { OrchestratorStatusUpdateInput } from '@/lib/validations/orchestrator';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * POST /api/orchestrators/:id/status
 *
 * Post a status update from a Orchestrator to a channel.
 * Requires authentication as the Orchestrator or admin/owner in the Orchestrator's organization.
 *
 * @param request - Next.js request with status update data
 * @param context - Route context containing OrchestratorID
 * @returns Created status message
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/status
 * Content-Type: application/json
 *
 * {
 *   "message": "Completed quarterly analysis. Results ready for review.",
 *   "channelId": "channel_456",
 *   "statusType": "update"
 * }
 * ```
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
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = orchestratorStatusUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: OrchestratorStatusUpdateInput = parseResult.data;

    // Get Orchestrator and verify access
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: params.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if authenticated user is the Orchestrator or has admin/owner role
    const isOrchestratorUser = session.user.id === orchestrator.user.id;
    let hasAdminAccess = false;

    if (!isOrchestratorUser) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orchestrator.organizationId,
            userId: session.user.id,
          },
        },
      });

      hasAdminAccess =
        membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    }

    if (!isOrchestratorUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to post status for this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify channel exists and is accessible
    const channel = await prisma.channel.findUnique({
      where: { id: input.channelId },
      include: {
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORCHESTRATOR_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify channel belongs to Orchestrator's organization
    if (channel.workspace.organizationId !== orchestrator.organizationId) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not accessible',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get the channelId (we've already validated channel exists above)
    const validChannelId = channel.id;

    // Ensure Orchestrator is a member of the channel (or add them)
    const channelMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: validChannelId,
          userId: orchestrator.user.id,
        },
      },
    });

    if (!channelMembership) {
      // Add Orchestrator to channel as a member
      await prisma.channelMember.create({
        data: {
          channelId: validChannelId,
          userId: orchestrator.user.id,
          role: 'MEMBER',
        },
      });
    }

    // Create metadata for status message
    const metadata = {
      statusType: input.statusType,
      isStatusUpdate: true,
      orchestratorId: orchestrator.id,
      ...(input.metadata ?? {}),
    };

    // Create the status message
    const statusMessage = await prisma.message.create({
      data: {
        content: input.message ?? '',
        type: 'SYSTEM',
        channelId: validChannelId,
        authorId: orchestrator.user.id,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: statusMessage,
      message: 'Status update posted successfully',
    });
  } catch (error) {
    console.error('[POST /api/orchestrators/:id/status] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
