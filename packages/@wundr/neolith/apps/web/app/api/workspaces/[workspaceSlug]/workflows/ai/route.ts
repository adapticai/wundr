/**
 * Workflow AI Assistant API Route
 *
 * AI-powered workflow assistance with natural language processing.
 * Supports:
 * - Natural language workflow creation
 * - Workflow optimization suggestions
 * - Error diagnosis
 * - Step recommendations
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/workflows/ai - Stream AI assistance
 *
 * @module app/api/workspaces/[workspaceSlug]/workflows/ai/route
 */

import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

import type { UIMessage } from '@ai-sdk/react';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Workflow creation tool - extracts workflow structure from natural language
 */
const createWorkflowTool = tool({
  description: 'Create a workflow from natural language description. Extract trigger and actions.',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Clear, concise workflow name'),
      description: z.string().describe('What the workflow does'),
      trigger: z.object({
        type: z.enum([
          'schedule',
          'message',
          'keyword',
          'channel_join',
          'channel_leave',
          'user_join',
          'reaction',
          'mention',
          'webhook',
        ]).describe('Trigger type'),
        config: z.record(z.unknown()).describe('Trigger configuration based on type'),
      }),
      actions: z.array(
        z.object({
          type: z.enum([
            'send_message',
            'send_dm',
            'create_channel',
            'invite_to_channel',
            'assign_role',
            'add_reaction',
            'http_request',
            'wait',
            'condition',
            'notify_orchestrator',
          ]).describe('Action type'),
          config: z.record(z.unknown()).describe('Action configuration'),
          order: z.number().describe('Execution order (0-indexed)'),
        })
      ).describe('Ordered list of actions to execute'),
    }),
  ),
});

/**
 * Workflow optimization tool - suggests improvements
 */
const suggestOptimizationsTool = tool({
  description: 'Analyze workflow and suggest optimizations for performance, reliability, and best practices.',
  inputSchema: zodSchema(
    z.object({
      suggestions: z.array(
        z.object({
          type: z.enum(['performance', 'reliability', 'best-practice']).describe('Optimization category'),
          title: z.string().describe('Short title'),
          description: z.string().describe('Detailed explanation'),
          impact: z.enum(['high', 'medium', 'low']).describe('Expected impact'),
        })
      ),
    }),
  ),
});

/**
 * Error diagnosis tool - analyzes workflow execution errors
 */
const diagnoseErrorTool = tool({
  description: 'Diagnose workflow execution errors and provide solutions.',
  inputSchema: zodSchema(
    z.object({
      cause: z.string().describe('Root cause of the error'),
      solution: z.string().describe('How to fix it'),
      preventionTips: z.array(z.string()).describe('Tips to prevent similar errors'),
    }),
  ),
});

/**
 * Step recommendation tool - suggests additional workflow steps
 */
const recommendStepsTool = tool({
  description: 'Recommend additional steps that would enhance the workflow.',
  inputSchema: zodSchema(
    z.object({
      recommendations: z.array(
        z.object({
          stepType: z.string().describe('Type of step (action/condition/etc)'),
          reason: z.string().describe('Why this step would be beneficial'),
          configuration: z.record(z.unknown()).optional().describe('Suggested configuration'),
        })
      ),
    }),
  ),
});

/**
 * Get system prompt based on context
 */
function getWorkflowAIPrompt(workflowContext?: string, executionContext?: string): string {
  let prompt = `You are an expert workflow automation assistant. You help users create, optimize, and troubleshoot workflows.

Your capabilities:
1. Parse natural language descriptions into workflow triggers and actions
2. Suggest optimizations for existing workflows
3. Diagnose errors and provide solutions
4. Recommend additional steps to enhance workflows

Available triggers:
- schedule: Cron-based timing (config: { cron, timezone? })
- message: New message posted (config: { channelIds?, userIds?, pattern? })
- keyword: Specific keywords detected (config: { keywords[], matchType })
- channel_join/channel_leave: Channel membership changes (config: { channelIds? })
- user_join: New user joins workspace
- reaction: Reaction added (config: { emoji?, channelIds? })
- mention: User/agent mentioned (config: { userIds?, orchestratorIds? })
- webhook: External webhook (config: { secret? })

Available actions:
- send_message: Send to channel (config: { channelId, message })
- send_dm: Direct message user (config: { userId, message })
- create_channel: Create new channel (config: { channelName, channelType })
- invite_to_channel: Add user to channel (config: { channelId, userId })
- assign_role: Assign role to user (config: { roleId, userId })
- add_reaction: Add emoji reaction (config: { emoji })
- http_request: External API call (config: { url, method, headers?, body? })
- wait: Delay execution (config: { duration, unit })
- condition: Conditional branching (config: { condition, thenActions?, elseActions? })
- notify_orchestrator: Alert an orchestrator agent (config: { orchestratorId, message })

Variables: Use {{trigger.field}} or {{action_N.field}} syntax for dynamic values.

When creating workflows:
1. Ask clarifying questions if needed
2. Provide clear, actionable configurations
3. Suggest best practices and error handling
4. Use realistic, helpful examples`;

  if (workflowContext) {
    prompt += `\n\nCurrent workflow context:\n${workflowContext}`;
  }

  if (executionContext) {
    prompt += `\n\nLatest execution context:\n${executionContext}`;
  }

  return prompt;
}

/**
 * POST /api/workspaces/:workspaceSlug/workflows/ai
 *
 * Stream AI-powered workflow assistance.
 *
 * @param req - Next.js request with chat data
 * @param context - Route context with workspaceSlug
 * @returns Streaming AI response with tool calls
 *
 * @example
 * ```
 * POST /api/workspaces/my-workspace/workflows/ai
 * Content-Type: application/json
 *
 * {
 *   "action": "chat",
 *   "messages": [
 *     { "role": "user", "content": "When a message is received in #support, assign to on-call engineer" }
 *   ],
 *   "workflowId": "wf_123",
 *   "executionId": "exec_456"
 * }
 * ```
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get workspace slug
    const { workspaceSlug } = await context.params;

    // Find workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return new Response('Workspace not found', { status: 404 });
    }

    // Verify user has access via organization membership
    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return new Response('Access denied', { status: 403 });
    }

    // Parse request body
    const {
      messages: uiMessages,
      action = 'chat',
      workflowId,
      executionId,
    } = (await req.json()) as {
      messages: UIMessage[];
      action?: 'chat' | 'create' | 'optimize' | 'diagnose' | 'recommend';
      workflowId?: string;
      executionId?: string;
    };

    // Validate messages
    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'messages array is required and must not be empty',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Load workflow context if provided
    let workflowContext = '';
    if (workflowId) {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (workflow) {
        const trigger = workflow.trigger as any;
        const actions = workflow.actions as any;
        workflowContext = `Workflow: ${workflow.name}
Description: ${workflow.description || 'None'}
Status: ${workflow.status}
Trigger: ${trigger?.type || 'unknown'}
Actions: ${Array.isArray(actions) ? actions.length : 0} steps
Execution count: ${workflow.executionCount}`;
      }
    }

    // Load execution context if provided
    let executionContext = '';
    if (executionId) {
      const execution = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
      });

      if (execution) {
        const steps = execution.steps as any;
        const failedSteps = Array.isArray(steps)
          ? steps.filter((s: any) => s.status === 'FAILED')
          : [];
        executionContext = `Execution: ${execution.id}
Status: ${execution.status}
Started: ${execution.startedAt}
Duration: ${execution.durationMs || 'N/A'}ms
Failed steps: ${failedSteps.length}
${failedSteps.map((s: any) => `- ${s.type}: ${s.error || 'Unknown error'}`).join('\n')}
Error: ${execution.error || 'None'}`;
      }
    }

    // Convert UIMessage[] to ModelMessage[] for AI SDK
    const modelMessages = convertToModelMessages(uiMessages);

    // Get system prompt with context
    const systemPrompt = getWorkflowAIPrompt(workflowContext, executionContext);

    // Define tools based on action
    const tools = {
      create_workflow: createWorkflowTool,
      suggest_optimizations: suggestOptimizationsTool,
      diagnose_error: diagnoseErrorTool,
      recommend_steps: recommendStepsTool,
    };

    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('[POST /api/workspaces/[workspaceSlug]/workflows/ai] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Use OpenAI for workflow AI (gpt-4o-mini is cost-effective and supports tools)
    const model = openai(process.env.OPENAI_MODEL || 'gpt-4o-mini');

    // Stream the response with tools
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
    });

    // Return streaming response compatible with useChat hook
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceSlug]/workflows/ai] Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An internal error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
