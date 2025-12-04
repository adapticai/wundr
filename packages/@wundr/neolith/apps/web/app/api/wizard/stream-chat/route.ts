/**
 * Streaming Chat API Route for Wizard
 *
 * Supports Vercel AI SDK streaming format for conversational entity creation.
 * Uses tool calling to extract structured data progressively.
 *
 * Routes:
 * - POST /api/wizard/stream-chat - Stream chat responses with tool extraction
 *
 * @module app/api/wizard/stream-chat/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { streamText, tool, zodSchema } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Workspace extraction tool definition
 */
const workspaceExtractTool = tool({
  description:
    'Extract structured workspace data from the conversation when sufficient information is gathered',
  inputSchema: zodSchema(
    z.object({
      name: z.string().describe('Workspace name'),
      description: z.string().describe('Brief description of the workspace'),
      organizationType: z.string().optional().describe('Type of organization'),
      teamSize: z
        .enum(['small', 'medium', 'large'])
        .optional()
        .describe('Expected team size'),
      purpose: z.string().optional().describe('Primary purpose or mission'),
    })
  ),
});

/**
 * Build system prompt for workspace creation
 */
function buildWorkspaceSystemPrompt(): string {
  return `You are a helpful AI assistant guiding users through creating a new workspace.

Your role is to:
1. Have a friendly, conversational tone
2. Ask clarifying questions to gather necessary information
3. Extract structured data when you have enough details
4. Guide users toward completing their workspace setup

Required information:
- name: Workspace name (required)
- description: What the workspace is for (required)

Optional but helpful:
- organizationType: Type of organization (e.g., technology, finance, healthcare)
- teamSize: Expected team size (small/medium/large)
- purpose: Primary goal or mission

When you have at least a name and description, use the extract_workspace tool to capture the data.
Continue the conversation naturally and ask follow-up questions if needed.`;
}

/**
 * POST /api/wizard/stream-chat
 *
 * Stream AI responses for workspace creation wizard.
 * Returns streaming AI response with optional tool calls for data extraction.
 *
 * @param req - Next.js request with chat data
 * @returns Streaming AI response
 *
 * @example
 * ```
 * POST /api/wizard/stream-chat
 * Content-Type: application/json
 *
 * {
 *   "entityType": "workspace",
 *   "messages": [
 *     { "role": "user", "content": "I want to create a workspace for my team" }
 *   ]
 * }
 *
 * Response: Streaming text with tool calls
 * ```
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse request body
    const { messages, entityType = 'workspace' } = await req.json();

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'messages array is required and must not be empty',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only support workspace for now
    if (entityType !== 'workspace') {
      return new Response(
        JSON.stringify({
          error: 'Only workspace entity type is supported currently',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine which model to use based on environment
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'anthropic';
    const model =
      provider === 'openai'
        ? openai(process.env.OPENAI_MODEL || 'gpt-4o')
        : anthropic(
            process.env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514'
          );

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model,
      system: buildWorkspaceSystemPrompt(),
      messages,
      tools: {
        extract_workspace: workspaceExtractTool,
      },
      temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    });

    // Return streaming response compatible with useChat hook
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/wizard/stream-chat] Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An internal error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
