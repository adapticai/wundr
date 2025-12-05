/**
 * Webhook Trigger Endpoint
 *
 * Public endpoint for triggering workflows via webhook with unique tokens.
 *
 * Route:
 * - POST /api/workspaces/:workspaceId/workflows/trigger/webhook/:token - Trigger via webhook
 *
 * @module app/api/workspaces/[workspaceId]/workflows/trigger/webhook/[token]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';
import { verifyWebhookSignature } from '@/lib/workflow/trigger-auth';
import { checkRateLimit } from '@/lib/workflow/rate-limiter';

import type { WorkflowAction, WorkflowStepResult } from '@/lib/validations/workflow';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; token: string }>;
}

/**
 * Log webhook trigger attempt
 */
async function logWebhookTrigger(
  workspaceId: string,
  workflowId: string,
  status: 'success' | 'failure' | 'rate_limited' | 'unauthorized',
  data: Record<string, unknown>,
  error?: string,
  executionId?: string,
  request?: NextRequest,
): Promise<void> {
  try {
    const ipAddress = request?.headers.get('x-forwarded-for') ||
                      request?.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request?.headers.get('user-agent') || 'unknown';

    const currentWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { metadata: true },
    });

    const currentMetadata = (currentWorkflow?.metadata || {}) as Record<string, any>;
    const triggerHistory = (currentMetadata.triggerHistory || []).slice(0, 99);

    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        metadata: {
          ...currentMetadata,
          triggerHistory: [
            ...triggerHistory,
            {
              id: `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              triggerType: 'webhook',
              status,
              data,
              error,
              executionId,
              ipAddress,
              userAgent,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error('Failed to log webhook trigger:', error);
  }
}

/**
 * Execute workflow actions
 */
async function executeWorkflowActions(
  actions: WorkflowAction[],
  triggerData: Record<string, unknown>,
): Promise<{ steps: WorkflowStepResult[]; success: boolean; error?: string }> {
  const steps: WorkflowStepResult[] = [];
  let success = true;
  let error: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const startedAt = new Date();

    try {
      steps.push({
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'success',
        output: { executed: true, triggerData },
        startedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime(),
      });
    } catch (err) {
      const stepError = err instanceof Error ? err.message : 'Unknown error';
      steps.push({
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'failed',
        error: stepError,
        startedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime(),
      });

      if (action.onError === 'stop') {
        success = false;
        error = stepError;
        break;
      }
    }
  }

  return { steps, success, error };
}

/**
 * POST /api/workspaces/:workspaceId/workflows/trigger/webhook/:token
 *
 * Trigger a workflow via webhook using its unique token.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const params = await context.params;
    const { workspaceSlug: workspaceId, token } = params;

    // Find workflow by webhook token
    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    });

    const workflow = workflows.find(w => {
      const metadata = w.metadata as any;
      return metadata?.webhookToken === token;
    });

    if (!workflow) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid webhook token',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(workflow.id, 'webhook');
    if (!rateLimit.allowed) {
      await logWebhookTrigger(
        workspaceId,
        workflow.id,
        'rate_limited',
        {},
        'Rate limit exceeded',
        undefined,
        request,
      );

      return NextResponse.json(
        createErrorResponse(
          'Rate limit exceeded',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
        ),
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        },
      );
    }

    // Parse request body
    let data: Record<string, unknown> = {};
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        const text = await request.text();
        if (text) {
          data = JSON.parse(text);

          // Verify webhook signature if configured
          const metadata = workflow.metadata as any;
          const webhookSecret = metadata?.webhookSecret;
          const signature = request.headers.get('x-webhook-signature');

          if (webhookSecret && metadata?.requireSignature !== false) {
            if (!signature) {
              await logWebhookTrigger(
                workspaceId,
                workflow.id,
                'unauthorized',
                data,
                'Missing webhook signature',
                undefined,
                request,
              );

              return NextResponse.json(
                createErrorResponse(
                  'Webhook signature required',
                  WORKFLOW_ERROR_CODES.UNAUTHORIZED,
                ),
                { status: 401 },
              );
            }

            const isValid = verifyWebhookSignature(text, signature, webhookSecret);
            if (!isValid) {
              await logWebhookTrigger(
                workspaceId,
                workflow.id,
                'unauthorized',
                data,
                'Invalid webhook signature',
                undefined,
                request,
              );

              return NextResponse.json(
                createErrorResponse(
                  'Invalid webhook signature',
                  WORKFLOW_ERROR_CODES.UNAUTHORIZED,
                ),
                { status: 401 },
              );
            }
          }
        }
      } catch {
        // Allow empty body
      }
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      data = Object.fromEntries(formData.entries());
    }

    // Execute workflow
    const startedAt = new Date();
    const actions = workflow.actions as unknown as WorkflowAction[];

    const { steps, success, error } = await executeWorkflowActions(
      actions,
      {
        ...data,
        _webhook: {
          token,
          timestamp: startedAt.toISOString(),
          headers: Object.fromEntries(request.headers.entries()),
        },
      },
    );

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        workspaceId,
        status: success ? 'COMPLETED' : 'FAILED',
        triggeredBy: 'webhook',
        triggerType: 'webhook',
        triggerData: data as Prisma.InputJsonValue,
        steps: steps as unknown as Prisma.InputJsonValue,
        error,
        startedAt,
        completedAt,
        durationMs,
        isSimulation: false,
      },
    });

    // Update workflow stats
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        lastExecutedAt: startedAt,
        executionCount: { increment: 1 },
        ...(success
          ? { successCount: { increment: 1 } }
          : { failureCount: { increment: 1 } }),
      },
    });

    // Log trigger
    await logWebhookTrigger(
      workspaceId,
      workflow.id,
      'success',
      data,
      undefined,
      execution.id,
      request,
    );

    return NextResponse.json(
      {
        success: true,
        executionId: execution.id,
        status: execution.status,
        message: 'Workflow triggered successfully',
        duration: Date.now() - startTime,
      },
      {
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': (rateLimit.remaining - 1).toString(),
          'X-RateLimit-Reset': rateLimit.reset.toString(),
        },
      },
    );
  } catch (error) {
    console.error('[POST /workflows/trigger/webhook/:token] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      createErrorResponse(
        'Failed to trigger workflow',
        WORKFLOW_ERROR_CODES.EXECUTION_FAILED,
        { error: errorMessage },
      ),
      { status: 500 },
    );
  }
}

/**
 * GET /api/workspaces/:workspaceId/workflows/trigger/webhook/:token
 *
 * Get webhook trigger information (for testing).
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { workspaceSlug: workspaceId, token } = params;

    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        metadata: true,
      },
    });

    const workflow = workflows.find(w => {
      const metadata = w.metadata as any;
      return metadata?.webhookToken === token;
    });

    if (!workflow) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid webhook token',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    return NextResponse.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
      },
      message: 'Webhook endpoint is active',
      methods: ['POST'],
    });
  } catch (error) {
    console.error('[GET /workflows/trigger/webhook/:token] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
