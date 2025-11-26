/**
 * Conversational Entity Creation API Route (Streaming)
 *
 * LLM-powered conversational interface for creating organizational entities.
 * Uses Claude/OpenAI to guide users through entity creation with natural conversation.
 *
 * Routes:
 * - POST /api/creation/conversation - Stream LLM conversation for entity creation
 *
 * Supported Entity Types:
 * - workspace: Full organization hierarchy
 * - orchestrator: Top-level autonomous agent (formerly VP)
 * - session-manager: Mid-level context-specific agent
 * - subagent: Task-specific worker agent
 * - workflow: Automated process with triggers/actions
 * - channel: Communication channel
 *
 * @module app/api/creation/conversation/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse, ORG_ERROR_CODES } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Supported entity types for creation
 */
type EntityType = 'workspace' | 'orchestrator' | 'session-manager' | 'subagent' | 'workflow' | 'channel';

/**
 * Chat message structure
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Workspace context for LLM prompts
 */
interface WorkspaceContext {
  workspaceId?: string;
  existingOrchestrators?: string[];
  existingChannels?: string[];
  existingWorkflows?: string[];
  sessionManagers?: string[];
  subagents?: string[];
}

/**
 * Request body structure
 */
interface ConversationRequest {
  entityType: EntityType;
  messages: ChatMessage[];
  workspaceContext?: WorkspaceContext;
}

/**
 * Build system prompt for entity type
 */
function buildSystemPrompt(entityType: EntityType, context?: WorkspaceContext): string {
  const basePrompt = `You are an AI assistant helping users create organizational entities in a collaborative AI platform. Your role is to guide users through providing necessary details for creating a ${entityType}.

Be conversational, friendly, and helpful. Ask clarifying questions to gather required information. When you have sufficient details, indicate you're ready to generate a specification.

IMPORTANT: You are ONLY gathering information. Do NOT actually create entities or execute commands. Your job is to help build a complete specification that the user can review before creation.`;

  const entityPrompts: Record<EntityType, string> = {
    workspace: `
You are helping create a new WORKSPACE (organization).

Required information:
- Organization name
- Description/purpose
- Industry or domain
- Team size (approximate)
- Key departments/functions needed

Ask about:
- What orchestrators (autonomous agents) should be created?
- What communication channels are needed?
- What initial workflows should be set up?
- Team structure and roles

${context?.existingOrchestrators?.length ? `Note: User already has orchestrators: ${context.existingOrchestrators.join(', ')}` : ''}
`,
    orchestrator: `
You are helping create a new ORCHESTRATOR (top-level autonomous agent).

Orchestrators are senior agents with:
- A clear charter/mission statement
- Discipline/role (e.g., Engineering, Product, Support)
- Communication capabilities (which channels to monitor)
- Decision-making authority
- Optional session managers for specific contexts
- Optional subagents for specific tasks

Required information:
- Name (friendly, like "Sarah the Support Lead")
- Role/discipline
- Charter (what is their mission?)
- Communication style (formal/friendly/technical)

Ask about:
- Which channels should they monitor?
- What session managers do they need (if any)?
- What subagents should assist them (if any)?
- Escalation rules or thresholds
- Response patterns

${context?.existingChannels?.length ? `Available channels: ${context.existingChannels.join(', ')}` : 'No channels created yet.'}
${context?.sessionManagers?.length ? `Existing session managers: ${context.sessionManagers.join(', ')}` : ''}
`,
    'session-manager': `
You are helping create a new SESSION MANAGER (mid-level contextual agent).

Session Managers:
- Operate within specific contexts/channels
- Report to an Orchestrator
- Manage conversations and coordinate subagents
- Handle specific types of requests

Required information:
- Name
- Parent orchestrator
- Context/channel they manage
- Responsibilities
- Escalation criteria

Ask about:
- What channel/context do they manage?
- What types of requests do they handle?
- When should they escalate to the Orchestrator?
- What subagents assist them?

${context?.existingOrchestrators?.length ? `Available orchestrators: ${context.existingOrchestrators.join(', ')}` : 'Create an orchestrator first.'}
${context?.existingChannels?.length ? `Available channels: ${context.existingChannels.join(', ')}` : ''}
`,
    subagent: `
You are helping create a new SUBAGENT (task-specific worker).

Subagents:
- Perform specific, well-defined tasks
- Report to a Session Manager or Orchestrator
- No autonomous decision-making
- Specialized capabilities

Required information:
- Name
- Parent (Session Manager or Orchestrator)
- Specific task/capability
- Input/output format
- Error handling

Ask about:
- What specific task does it perform?
- What data does it need?
- What does it return?
- How should errors be handled?

${context?.sessionManagers?.length ? `Available session managers: ${context.sessionManagers.join(', ')}` : ''}
${context?.existingOrchestrators?.length ? `Available orchestrators: ${context.existingOrchestrators.join(', ')}` : ''}
`,
    workflow: `
You are helping create a new WORKFLOW (automated process).

Workflows:
- Triggered by events or schedules
- Execute a series of steps
- Can involve orchestrators, session managers, or subagents
- Have success/failure outcomes

Required information:
- Workflow name
- Description/purpose
- Trigger (event, schedule, manual)
- Steps in the workflow
- Expected outcome

Ask about:
- What triggers this workflow?
- What are the steps?
- Which agents are involved?
- What happens on success/failure?
- Are there any conditions or branches?

${context?.existingOrchestrators?.length ? `Available orchestrators: ${context.existingOrchestrators.join(', ')}` : ''}
${context?.existingWorkflows?.length ? `Existing workflows: ${context.existingWorkflows.join(', ')}` : 'This will be the first workflow.'}
`,
    channel: `
You are helping create a new CHANNEL (communication space).

Channels:
- Can be public or private
- Have specific purposes
- Monitored by orchestrators/session managers
- Support threaded conversations

Required information:
- Channel name (e.g., #support, #engineering)
- Type (PUBLIC or PRIVATE)
- Description/purpose
- Initial members (for private channels)

Ask about:
- What is the channel for?
- Should it be public or private?
- Who should have access?
- Which orchestrators should monitor it?
- Any special rules or guidelines?

${context?.existingOrchestrators?.length ? `Available orchestrators: ${context.existingOrchestrators.join(', ')}` : ''}
${context?.existingChannels?.length ? `Existing channels: ${context.existingChannels.join(', ')}` : 'This will be the first channel.'}
`,
  };

  return basePrompt + '\n' + entityPrompts[entityType];
}

/**
 * Call Anthropic Claude API (streaming)
 */
async function callClaudeStreaming(
  systemPrompt: string,
  messages: ChatMessage[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body from Anthropic API');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6); // Remove 'data: ' prefix
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          // Handle different event types
          if (parsed.type === 'content_block_delta') {
            if (parsed.delta?.type === 'text_delta') {
              // Send text chunk to client
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
            }
          } else if (parsed.type === 'message_stop') {
            // Message complete
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error?.message || 'Unknown error from Claude');
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Call OpenAI API (streaming) - fallback
 */
async function callOpenAIStreaming(
  systemPrompt: string,
  messages: ChatMessage[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      max_tokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body from OpenAI API');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;

          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * POST /api/creation/conversation
 *
 * Stream LLM conversation for entity creation guidance.
 * Requires authentication.
 *
 * @param request - Next.js request with conversation data
 * @returns Streaming response with LLM guidance
 *
 * @example
 * ```
 * POST /api/creation/conversation
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "messages": [
 *     { "role": "user", "content": "I need a customer support agent" }
 *   ],
 *   "workspaceContext": {
 *     "workspaceId": "ws_123",
 *     "existingChannels": ["#support", "#escalations"]
 *   }
 * }
 *
 * Response: Server-Sent Events stream
 * data: {"text":"Great! Let's create a customer support orchestrator."}
 * data: {"text":" What name would you like for this agent?"}
 * data: {"done":true}
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate request structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        createErrorResponse('Invalid request body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const conversationReq = body as ConversationRequest;

    // Validate entity type
    const validEntityTypes: EntityType[] = ['workspace', 'orchestrator', 'session-manager', 'subagent', 'workflow', 'channel'];
    if (!conversationReq.entityType || !validEntityTypes.includes(conversationReq.entityType)) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate messages
    if (!Array.isArray(conversationReq.messages) || conversationReq.messages.length === 0) {
      return NextResponse.json(
        createErrorResponse('messages array is required and must not be empty', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate message structure
    for (const msg of conversationReq.messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          createErrorResponse('Each message must have role and content', ORG_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json(
          createErrorResponse('Message role must be "user" or "assistant"', ORG_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(conversationReq.entityType, conversationReq.workspaceContext);

    // Determine which LLM provider to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'anthropic';

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Send initial connection confirmation
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                connected: true,
                entityType: conversationReq.entityType,
                provider,
                timestamp: new Date().toISOString(),
              })}\n\n`,
            ),
          );

          // Call appropriate LLM API
          if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
            await callClaudeStreaming(systemPrompt, conversationReq.messages, controller, encoder);
          } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
            await callOpenAIStreaming(systemPrompt, conversationReq.messages, controller, encoder);
          } else {
            // Fallback: try both
            if (process.env.ANTHROPIC_API_KEY) {
              await callClaudeStreaming(systemPrompt, conversationReq.messages, controller, encoder);
            } else if (process.env.OPENAI_API_KEY) {
              await callOpenAIStreaming(systemPrompt, conversationReq.messages, controller, encoder);
            } else {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    error: 'No LLM API key configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
                  })}\n\n`,
                ),
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error('[POST /api/creation/conversation] Streaming error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown streaming error',
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[POST /api/creation/conversation] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORG_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
