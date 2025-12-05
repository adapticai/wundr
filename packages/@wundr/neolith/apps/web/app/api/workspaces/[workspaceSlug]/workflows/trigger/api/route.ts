/**
 * API Key Trigger Endpoint
 *
 * Trigger workflows using API key authentication.
 *
 * Route:
 * - POST /api/workspaces/:workspaceId/workflows/trigger/api - Trigger with API key
 *
 * @module app/api/workspaces/[workspaceId]/workflows/trigger/api/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { triggerWithApiKeySchema } from '@/lib/validations/trigger';
import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';
import { checkRateLimit } from '@/lib/workflow/rate-limiter';
import { extractBearerToken, verifyApiKey } from '@/lib/workflow/trigger-auth';

import type { TriggerWithApiKeyInput } from '@/lib/validations/trigger';
import type { WorkflowAction, WorkflowStepResult } from '@/lib/validations/workflow';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Log API key trigger attempt
 */
async function logApiTrigger(
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
              id: `api_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              triggerType: 'api',
              status,
              data,
              error,
              executionId,
              ipAddress,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error('Failed to log API trigger:', error);
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
 * POST /api/workspaces/:workspaceId/workflows/trigger/api
 *
 * Trigger a workflow using API key authentication.
 *
 * @example
 * ```bash
 * curl -X POST https://api.example.com/api/workspaces/ws_123/workflows/trigger/api \
 *   -H "Authorization: Bearer wf_abc123..." \
 *   -H "Content-Type: application/json" \
 *   -d '{"workflowId": "wf_456", "data": {"key": "value"}}'
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Extract and verify API key
    const authHeader = request.headers.get('authorization');
    const apiKey = extractBearerToken(authHeader);

    if (!apiKey) {
      return NextResponse.json(
        createErrorResponse(
          'API key required in Authorization header',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Find workflow by API key
    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    });

    let workflow: typeof workflows[0] | undefined;
    for (const wf of workflows) {
      const metadata = wf.metadata as any;
      const apiKeyHash = metadata?.apiKeyHash;

      if (apiKeyHash && verifyApiKey(apiKey, apiKeyHash)) {
        workflow = wf;
        break;
      }
    }

    if (!workflow) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid API key',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
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
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = triggerWithApiKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: TriggerWithApiKeyInput = parseResult.data;

    // Verify workflow ID matches
    if (input.workflowId !== workflow.id) {
      await logApiTrigger(
        workspaceId,
        workflow.id,
        'unauthorized',
        input.data ?? {},
        'Workflow ID mismatch',
        undefined,
        request,
      );

      return NextResponse.json(
        createErrorResponse(
          'Workflow ID does not match API key',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(workflow.id, 'api');
    if (!rateLimit.allowed) {
      await logApiTrigger(
        workspaceId,
        workflow.id,
        'rate_limited',
        input.data ?? {},
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

    // Execute workflow
    const startedAt = new Date();
    const actions = workflow.actions as unknown as WorkflowAction[];

    const { steps, success, error } = await executeWorkflowActions(
      actions,
      {
        ...input.data,
        _api: {
          triggeredAt: startedAt.toISOString(),
          workflowId: workflow.id,
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
        triggeredBy: 'api_key',
        triggerType: 'api',
        triggerData: (input.data ?? {}) as Prisma.InputJsonValue,
        steps: steps as unknown as Prisma.InputJsonValue,
        error,
        startedAt,
        completedAt,
        durationMs,
        isSimulation: input.dryRun ?? false,
      },
    });

    // Update workflow stats (only for non-dry-run)
    if (!input.dryRun) {
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
    }

    // Log trigger
    await logApiTrigger(
      workspaceId,
      workflow.id,
      'success',
      input.data ?? {},
      undefined,
      execution.id,
      request,
    );

    return NextResponse.json(
      {
        success: true,
        executionId: execution.id,
        status: execution.status,
        message: input.dryRun
          ? 'Workflow dry-run completed successfully'
          : 'Workflow triggered successfully',
        duration: Date.now() - startTime,
        dryRun: input.dryRun ?? false,
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
    console.error('[POST /workflows/trigger/api] Error:', error);

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
