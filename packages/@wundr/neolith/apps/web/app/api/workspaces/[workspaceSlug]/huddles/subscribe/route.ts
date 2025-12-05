/**
 * Huddles Subscribe API - Server-Sent Events (SSE)
 *
 * Provides real-time updates for huddle events via SSE.
 * Clients can subscribe to receive live updates about:
 * - Huddle creation and ending
 * - Participant join/leave
 * - Mute/unmute status changes
 * - Speaking status updates
 *
 * @module app/api/workspaces/[workspaceSlug]/huddles/subscribe/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  addSubscriber,
  removeSubscriber,
  getWorkspaceHuddles,
} from '@/lib/huddles/store';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/huddles/subscribe
 *
 * Subscribe to real-time huddle events via Server-Sent Events.
 * The connection will stay open and stream events as they occur.
 *
 * Events are sent in the format:
 * data: { "type": "huddle:created", "huddle": {...}, "timestamp": "..." }
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
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

    const { workspaceSlug } = await context.params;

    // Lookup workspace by ID or slug
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
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

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const workspaceId = workspace.id;

    const encoder = new TextEncoder();

    // Create a ReadableStream controller for the subscriber
    let controllerRef: ReadableStreamDefaultController | null = null;

    const readable = new ReadableStream({
      start(controller) {
        controllerRef = controller;

        // Add subscriber to store
        addSubscriber(workspaceId, userId);

        // Send initial state with current huddles
        const huddles = getWorkspaceHuddles(workspaceId);
        const initialData = encoder.encode(
          `data: ${JSON.stringify({
            type: 'init',
            huddles,
            timestamp: new Date().toISOString(),
          })}\n\n`
        );

        try {
          controller.enqueue(initialData);
        } catch {
          // Connection may have closed
        }
      },
      cancel() {
        // Clean up subscriber when connection closes
        removeSubscriber(workspaceId, userId);
      },
    });

    // Handle request abort
    request.signal.addEventListener('abort', () => {
      removeSubscriber(workspaceId, userId);
      if (controllerRef) {
        try {
          controllerRef.close();
        } catch {
          // Controller may already be closed
        }
      }
    });

    // Return SSE response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/huddles/subscribe] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
