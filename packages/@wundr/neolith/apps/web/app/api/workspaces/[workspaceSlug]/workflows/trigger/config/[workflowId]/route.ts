/**
 * Workflow Trigger Configuration API
 *
 * Manage trigger configuration for workflows including:
 * - Webhook URLs and secrets
 * - API keys
 * - Schedule settings
 * - Rate limits
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId - Get config
 * - PUT /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId - Update config
 * - POST /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId/regenerate - Regenerate credentials
 *
 * @module app/api/workspaces/[workspaceId]/workflows/trigger/config/[workflowId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';
import {
  createTriggerConfigSchema,
  updateTriggerConfigSchema,
} from '@/lib/validations/trigger';
import {
  generateWebhookToken,
  generateWebhookSecret,
  generateApiKey,
  hashApiKey,
} from '@/lib/workflow/trigger-auth';
import { validateCronExpression } from '@/lib/workflow/cron-validator';
import { getRateLimitStatus, resetRateLimit } from '@/lib/workflow/rate-limiter';

import type {
  CreateTriggerConfigInput,
  UpdateTriggerConfigInput,
} from '@/lib/validations/trigger';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * Check workspace access
 */
async function checkWorkspaceAccess(
  workspaceId: string,
  workflowId: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return { error: 'workspace_not_found' };
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
    return { error: 'workspace_not_found' };
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  const workflow = await prisma.workflow.findUnique({
    where: {
      id: workflowId,
      workspaceId,
    },
  });

  if (!workflow) {
    return { error: 'workflow_not_found' };
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
    workflow,
  };
}

/**
 * GET /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId
 *
 * Get trigger configuration for a workflow.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    const result = await checkWorkspaceAccess(
      workspaceId,
      workflowId,
      session.user.id,
    );

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workflow not found',
            WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    if (!result.workflow) {
      return NextResponse.json(
        createErrorResponse(
          'Workflow not found',
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const { workflow } = result;
    const metadata = workflow.metadata as any || {};
    const trigger = workflow.trigger as any || {};

    // Get rate limit status
    const rateLimitStatus = await getRateLimitStatus(
      workflowId,
      trigger.type || 'webhook',
    );

    // Build webhook URL if webhook token exists
    const webhookUrl = metadata.webhookToken
      ? `${request.nextUrl.origin}/api/workspaces/${workspaceId}/workflows/trigger/webhook/${metadata.webhookToken}`
      : undefined;

    const config = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerType: trigger.type || 'manual',
      enabled: workflow.status === 'ACTIVE',

      // Webhook configuration
      webhook: metadata.webhookToken ? {
        url: webhookUrl,
        token: metadata.webhookToken,
        secret: metadata.webhookSecret ? '***' : undefined, // Hide actual secret
        requireSignature: metadata.requireSignature ?? true,
        hasSecret: !!metadata.webhookSecret,
      } : undefined,

      // API key configuration
      apiKey: metadata.apiKeyHash ? {
        hasKey: true,
        // Never return the actual API key
      } : undefined,

      // Schedule configuration
      schedule: trigger.type === 'schedule' ? {
        cron: trigger.config?.cron,
        timezone: trigger.config?.timezone || 'UTC',
        enabled: trigger.config?.enabled ?? true,
        nextRun: trigger.config?.nextRun,
        lastRun: trigger.config?.lastRun,
      } : undefined,

      // Event configuration
      event: trigger.type === 'event' ? {
        eventType: trigger.eventType || trigger.event,
        conditions: trigger.conditions,
        filters: trigger.filters,
      } : undefined,

      // Rate limiting
      rateLimit: {
        current: rateLimitStatus,
        config: metadata.rateLimit,
      },

      // Statistics
      statistics: {
        totalTriggers: metadata.triggerHistory?.length || 0,
        successfulTriggers: metadata.triggerHistory?.filter((t: any) => t.status === 'success').length || 0,
        failedTriggers: metadata.triggerHistory?.filter((t: any) => t.status === 'failure').length || 0,
        rateLimitedTriggers: metadata.triggerHistory?.filter((t: any) => t.status === 'rate_limited').length || 0,
      },
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[GET /workflows/trigger/config/:workflowId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId
 *
 * Update trigger configuration for a workflow.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    const result = await checkWorkspaceAccess(
      workspaceId,
      workflowId,
      session.user.id,
    );

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workflow not found',
            WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    if (!result.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to update trigger configuration',
          WORKFLOW_ERROR_CODES.FORBIDDEN,
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
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateTriggerConfigSchema.safeParse(body);
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

    const input: UpdateTriggerConfigInput = parseResult.data;
    const { workflow } = result;

    // Validate schedule cron if provided
    if (input.type === 'schedule' && input.config) {
      const scheduleConfig = input.config as any;
      if (scheduleConfig.cron) {
        const validation = validateCronExpression(scheduleConfig.cron);
        if (!validation.valid) {
          return NextResponse.json(
            createErrorResponse(
              `Invalid cron expression: ${validation.error}`,
              WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
            ),
            { status: 400 },
          );
        }
      }
    }

    const currentMetadata = workflow.metadata as any || {};
    const currentTrigger = workflow.trigger as any || {};

    // Update trigger configuration
    const updatedTrigger = {
      ...currentTrigger,
      ...(input.type && { type: input.type }),
      ...(input.config && { config: input.config }),
    };

    // Update metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...(input.rateLimit && { rateLimit: input.rateLimit }),
    };

    // Update workflow
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        trigger: updatedTrigger,
        metadata: updatedMetadata,
        ...(input.enabled !== undefined && {
          status: input.enabled ? 'ACTIVE' : 'INACTIVE',
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Trigger configuration updated successfully',
    });
  } catch (error) {
    console.error('[PUT /workflows/trigger/config/:workflowId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/workflows/trigger/config/:workflowId/regenerate
 *
 * Regenerate webhook token, secret, or API key.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    const result = await checkWorkspaceAccess(
      workspaceId,
      workflowId,
      session.user.id,
    );

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workflow not found',
            WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    if (!result.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to regenerate credentials',
          WORKFLOW_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: { type?: 'webhook_token' | 'webhook_secret' | 'api_key' } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Use default
    }

    const regenerateType = body.type || 'webhook_token';
    const { workflow } = result;
    const currentMetadata = workflow.metadata as any || {};

    let newCredentials: Record<string, string> = {};

    // Regenerate based on type
    switch (regenerateType) {
      case 'webhook_token':
        newCredentials.webhookToken = generateWebhookToken();
        break;
      case 'webhook_secret':
        newCredentials.webhookSecret = generateWebhookSecret();
        break;
      case 'api_key':
        const apiKey = generateApiKey();
        newCredentials.apiKey = apiKey; // Return only once
        newCredentials.apiKeyHash = hashApiKey(apiKey);
        break;
    }

    // Update metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...(regenerateType === 'webhook_token' && { webhookToken: newCredentials.webhookToken }),
      ...(regenerateType === 'webhook_secret' && { webhookSecret: newCredentials.webhookSecret }),
      ...(regenerateType === 'api_key' && { apiKeyHash: newCredentials.apiKeyHash }),
    };

    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        metadata: updatedMetadata,
      },
    });

    // Reset rate limit when regenerating credentials
    await resetRateLimit(workflowId);

    // Build response
    const response: Record<string, any> = {
      success: true,
      message: `${regenerateType.replace('_', ' ')} regenerated successfully`,
      regenerated: regenerateType,
    };

    // Include new credentials (only returned once!)
    if (regenerateType === 'webhook_token') {
      response.webhookToken = newCredentials.webhookToken;
      response.webhookUrl = `${request.nextUrl.origin}/api/workspaces/${workspaceId}/workflows/trigger/webhook/${newCredentials.webhookToken}`;
    } else if (regenerateType === 'webhook_secret') {
      response.webhookSecret = newCredentials.webhookSecret;
    } else if (regenerateType === 'api_key') {
      response.apiKey = newCredentials.apiKey;
      response.warning = 'Save this API key securely - it will not be shown again';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /workflows/trigger/config/:workflowId/regenerate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
