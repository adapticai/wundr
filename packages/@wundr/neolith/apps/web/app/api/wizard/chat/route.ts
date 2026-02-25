/**
 * Conversational Wizard Chat API Route (Streaming)
 *
 * LLM-powered streaming chat interface for guiding users through entity creation.
 * Uses Vercel AI SDK with structured tool calling to extract entity fields when sufficient information is gathered.
 *
 * Routes:
 * - POST /api/wizard/chat - Stream chat with LLM for entity creation guidance
 *
 * Supported Entity Types:
 * - workspace: Full organization with name, description, purpose, team structure
 * - orchestrator: Top-level autonomous agent with role, capabilities, goals
 * - session-manager: Context-specific agent with responsibilities, escalation rules
 * - workflow: Automated process with triggers and actions
 *
 * @module app/api/wizard/chat/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';

import { getEntityPrompt, type EntityType } from '@/lib/ai';
import { auth } from '@/lib/auth';

import type { UIMessage } from '@ai-sdk/react';

/**
 * Tool definitions for each entity type
 */
const workspaceExtractTool = tool({
  description: 'Extract workspace data when sufficient information is gathered',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Workspace name'),
      description: z.string().describe('Brief description'),
      organizationType: z.string().optional().describe('Industry or domain'),
      teamSize: z
        .enum(['small', 'medium', 'large'])
        .optional()
        .describe('Team size category'),
      purpose: z.string().optional().describe('Mission or primary goal'),
    })
  ),
});

const orchestratorExtractTool = tool({
  description:
    'Extract orchestrator data when sufficient information is gathered',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Agent name'),
      role: z.string().describe('Primary role'),
      description: z.string().describe('What this agent does'),
      capabilities: z
        .array(z.string())
        .optional()
        .describe('List of capabilities'),
      communicationStyle: z.string().optional().describe('Communication style'),
    })
  ),
});

const sessionManagerExtractTool = tool({
  description:
    'Extract session manager data when sufficient information is gathered',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Session manager name'),
      responsibilities: z.string().describe('What they handle'),
      parentOrchestrator: z.string().optional().describe('Parent orchestrator'),
      context: z.string().optional().describe('Context or channel they manage'),
      escalationCriteria: z
        .array(z.string())
        .optional()
        .describe('When to escalate'),
    })
  ),
});

const workflowExtractTool = tool({
  description: 'Extract workflow data when sufficient information is gathered',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Workflow name'),
      description: z.string().describe('What this workflow does'),
      trigger: z
        .object({
          type: z
            .enum(['schedule', 'event', 'manual', 'webhook'])
            .describe('Trigger type'),
          config: z
            .record(z.unknown())
            .optional()
            .describe('Trigger configuration'),
        })
        .describe('How the workflow is triggered'),
      actions: z
        .array(
          z.object({
            action: z.string().describe('Action type'),
            description: z.string().describe('What this action does'),
          })
        )
        .describe('Workflow actions'),
    })
  ),
});

/**
 * Get tools for entity type
 */
function getToolsForEntity(entityType: EntityType) {
  const toolMap: Partial<Record<EntityType, Record<string, any>>> = {
    workspace: { extract_workspace: workspaceExtractTool },
    orchestrator: { extract_orchestrator: orchestratorExtractTool },
    'session-manager': { extract_session_manager: sessionManagerExtractTool },
    workflow: { extract_workflow: workflowExtractTool },
  };

  return toolMap[entityType] || {};
}

/**
 * POST /api/wizard/chat
 *
 * Stream chat with LLM for entity creation guidance.
 * Returns streaming AI response with optional tool calls for data extraction.
 *
 * @param req - Next.js request with chat data
 * @returns Streaming AI response
 *
 * @example
 * ```
 * POST /api/wizard/chat
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "messages": [
 *     { "role": "user", "content": "I need a customer support agent" }
 *   ]
 * }
 *
 * Response: Streaming text with tool calls
 * ```
 */
export async function POST(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse request body
    const { messages: uiMessages, entityType } = (await req.json()) as {
      messages: UIMessage[];
      entityType: EntityType;
    };

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'workspace',
      'orchestrator',
      'session-manager',
      'workflow',
    ];
    if (!entityType || !validEntityTypes.includes(entityType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate messages
    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'messages array is required and must not be empty',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert UIMessage[] to ModelMessage[] for AI SDK
    const modelMessages = convertToModelMessages(uiMessages);

    // Get system prompt and tools for entity type
    const systemPrompt = getEntityPrompt(entityType);
    const tools = getToolsForEntity(entityType);

    // Determine which model to use based on environment
    // IMPORTANT: Tool calling requires Anthropic or OpenAI - DeepSeek does NOT support tools
    // Supported providers: 'openai' (default), 'anthropic'
    // DeepSeek is NOT supported for this endpoint due to no tool support
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
    console.log(`[POST /api/wizard/chat] Using provider: ${provider}`);

    // Validate API key for selected provider
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error('[POST /api/wizard/chat] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error('[POST /api/wizard/chat] ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Select model - only Anthropic and OpenAI support tool calling
    const model =
      provider === 'openai'
        ? openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')
        : anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');

    // Stream the response
    // Note: temperature omitted as AI SDK shows false warning for gpt-4o-mini
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
    });

    // Return streaming response compatible with useChat hook
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[POST /api/wizard/chat] Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An internal error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
