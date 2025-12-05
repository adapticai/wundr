/**
 * Workflow Execution Streaming API Route
 *
 * Provides real-time execution progress updates via Server-Sent Events (SSE).
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/executions/:executionId/stream - Stream execution progress
 *
 * @module app/api/workspaces/[workspaceId]/workflows/executions/[executionId]/stream/route
 */

import { prisma } from '@neolith/database';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { WorkflowStepResult } from '@/lib/validations/workflow';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and executionId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; executionId: string }>;
}

/**
 * Send SSE event
 */
function sendSSE(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

/**
 * GET /api/workspaces/:workspaceId/workflows/executions/:executionId/stream
 *
 * Stream execution progress updates in real-time using Server-Sent Events.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and executionId
 * @returns SSE stream of execution updates
 *
 * @example
 * ```typescript
 * const eventSource = new EventSource(
 *   '/api/workspaces/ws_123/workflows/executions/exec_456/stream'
 * );
 *
 * eventSource.addEventListener('progress', (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('Progress:', data.percentage);
 * });
 *
 * eventSource.addEventListener('step', (event) => {
 *   const step = JSON.parse(event.data);
 *   console.log('Step completed:', step.actionType, step.status);
 * });
 *
 * eventSource.addEventListener('complete', (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('Execution complete:', data.status);
 *   eventSource.close();
 * });
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify(
          createErrorResponse(
            'Authentication required',
            WORKFLOW_ERROR_CODES.UNAUTHORIZED,
          ),
        ),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, executionId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return new Response(
        JSON.stringify(
          createErrorResponse(
            'Workspace not found',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
        ),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return new Response(
        JSON.stringify(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
        ),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Verify execution exists
    const execution = await prisma.workflowExecution.findUnique({
      where: {
        id: executionId,
        workspaceId,
      },
    });

    if (!execution) {
      return new Response(
        JSON.stringify(
          createErrorResponse(
            'Execution not found',
            WORKFLOW_ERROR_CODES.EXECUTION_NOT_FOUND,
          ),
        ),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection event
        sendSSE(controller, 'connected', {
          executionId,
          timestamp: new Date().toISOString(),
        });

        let lastStepCount = 0;
        let isComplete = false;

        // Poll for updates
        const pollInterval = setInterval(async () => {
          try {
            const currentExecution = await prisma.workflowExecution.findUnique({
              where: { id: executionId },
            });

            if (!currentExecution) {
              clearInterval(pollInterval);
              sendSSE(controller, 'error', {
                message: 'Execution not found',
              });
              controller.close();
              return;
            }

            const steps =
              (currentExecution.steps as unknown as WorkflowStepResult[]) || [];
            const totalSteps = steps.length;

            // Send new step events
            if (steps.length > lastStepCount) {
              const newSteps = steps.slice(lastStepCount);
              for (const step of newSteps) {
                sendSSE(controller, 'step', step);
              }
              lastStepCount = steps.length;
            }

            // Calculate and send progress
            const completedSteps = steps.filter(
              s => s.status === 'success' || s.status === 'failed',
            ).length;
            const successfulSteps = steps.filter(
              s => s.status === 'success',
            ).length;
            const failedSteps = steps.filter(s => s.status === 'failed').length;

            sendSSE(controller, 'progress', {
              totalSteps,
              completedSteps,
              successfulSteps,
              failedSteps,
              percentage:
                totalSteps > 0
                  ? Math.round((completedSteps / totalSteps) * 100)
                  : 0,
              status: currentExecution.status,
            });

            // Check if execution is complete
            if (
              !isComplete &&
              ['COMPLETED', 'FAILED', 'CANCELLED'].includes(
                currentExecution.status,
              )
            ) {
              isComplete = true;
              sendSSE(controller, 'complete', {
                status: currentExecution.status,
                error: currentExecution.error,
                durationMs: currentExecution.durationMs,
                completedAt: currentExecution.completedAt?.toISOString(),
              });

              // Close stream after a short delay
              setTimeout(() => {
                clearInterval(pollInterval);
                controller.close();
              }, 1000);
            }
          } catch (error) {
            console.error('[Execution Stream] Poll error:', error);
            clearInterval(pollInterval);
            sendSSE(controller, 'error', {
              message:
                error instanceof Error ? error.message : 'Unknown error',
            });
            controller.close();
          }
        }, 500); // Poll every 500ms

        // Handle client disconnect
        _request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/workflows/executions/:executionId/stream] Error:',
      error,
    );
    return new Response(
      JSON.stringify(
        createErrorResponse(
          'An internal error occurred',
          WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
        ),
      ),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
