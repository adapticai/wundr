/**
 * Entity Modification API Route
 *
 * LLM-powered conversational interface for modifying existing entities.
 * Analyzes user's modification requests and suggests structured changes as diffs.
 *
 * Routes:
 * - POST /api/wizard/modify - Process modification request and return suggested changes
 *
 * Supported Entity Types:
 * - orchestrator: Modify autonomous agent configuration
 * - workflow: Modify workflow triggers and actions
 * - channel: Modify channel settings
 * - workspace: Modify workspace settings
 *
 * @module app/api/wizard/modify/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Supported entity types for modification
 */
type EntityType = 'workspace' | 'orchestrator' | 'session-manager' | 'subagent' | 'workflow' | 'channel';

/**
 * Chat message structure
 */
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Entity data structure (generic)
 */
interface EntityData {
  id: string;
  name: string;
  description: string;
  [key: string]: unknown;
}

/**
 * Suggested modification with diff
 */
interface Modification {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

/**
 * Suggested changes from AI
 */
interface SuggestedChanges {
  modifications: Modification[];
  summary: string;
  reasoning: string;
}

/**
 * Request body structure
 */
interface ModifyRequest {
  entityType: EntityType;
  entityId: string;
  currentData: EntityData;
  messages: ChatMessage[];
  conversationHistory?: ChatMessage[];
}

/**
 * Response structure
 */
interface ModifyResponse {
  message: string;
  suggestedChanges?: SuggestedChanges;
  needsMoreInfo: boolean;
  clarifyingQuestions?: string[];
}

/**
 * Build system prompt for entity modification
 */
function buildSystemPrompt(entityType: EntityType, currentData: EntityData): string {
  return `You are an AI assistant helping users modify an existing ${entityType} in a collaborative AI platform.

CURRENT ENTITY DATA:
${JSON.stringify(currentData, null, 2)}

Your role is to:
1. Understand the user's modification request
2. Suggest specific changes as a structured diff
3. Explain your reasoning for each change
4. Ask clarifying questions if the request is ambiguous

When you have a clear understanding of what to modify, use the suggest_modifications tool to propose changes.

IMPORTANT GUIDELINES:
- Only suggest changes that the user explicitly requested or that are logically necessary
- Preserve existing data unless modification is requested
- Provide clear reasoning for each modification
- If the request is unclear, ask specific clarifying questions
- Consider the entity type and its constraints when suggesting changes

For example:
- If user says "change the name to X", modify only the name field
- If user says "make it more professional", suggest changes to tone-related fields
- If user says "add capability Y", add to the capabilities array

Be conversational and helpful. Always confirm your understanding before suggesting changes.`;
}

/**
 * Build tool definitions for Claude API
 */
function buildTools(entityType: EntityType) {
  return [
    {
      name: 'suggest_modifications',
      description: `Suggest structured modifications to the ${entityType} based on user's request`,
      input_schema: {
        type: 'object',
        properties: {
          modifications: {
            type: 'array',
            description: 'List of specific field modifications',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Name of the field to modify',
                },
                oldValue: {
                  description: 'Current value of the field',
                },
                newValue: {
                  description: 'Proposed new value for the field',
                },
                reason: {
                  type: 'string',
                  description: 'Explanation for why this change is being suggested',
                },
              },
              required: ['field', 'oldValue', 'newValue', 'reason'],
            },
          },
          summary: {
            type: 'string',
            description: 'Brief summary of all changes',
          },
          reasoning: {
            type: 'string',
            description: 'Overall explanation of why these changes address the user request',
          },
        },
        required: ['modifications', 'summary', 'reasoning'],
      },
    },
  ];
}

/**
 * Call Anthropic Claude API with tool use
 */
async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: unknown[],
): Promise<ModifyResponse> {
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
      tools,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const result = await response.json();

  // Parse the response
  let message = '';
  let suggestedChanges: SuggestedChanges | undefined;
  let needsMoreInfo = true;
  const clarifyingQuestions: string[] = [];

  // Handle content blocks
  for (const block of result.content || []) {
    if (block.type === 'text') {
      message += block.text;

      // Extract questions from text
      const questions = extractQuestions(block.text);
      clarifyingQuestions.push(...questions);
    } else if (block.type === 'tool_use' && block.name === 'suggest_modifications') {
      suggestedChanges = block.input as SuggestedChanges;
      needsMoreInfo = false;
    }
  }

  return {
    message: message.trim(),
    suggestedChanges,
    needsMoreInfo,
    clarifyingQuestions: clarifyingQuestions.length > 0 ? clarifyingQuestions : undefined,
  };
}

/**
 * Extract questions from text
 */
function extractQuestions(text: string): string[] {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  return sentences.filter((s) => s.endsWith('?')).map((s) => s + '?');
}

/**
 * Call OpenAI API with function calling (fallback)
 */
async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: unknown[],
): Promise<ModifyResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Convert tools to OpenAI function format
  const functions = (tools as Array<{ name: string; description: string; input_schema: object }>).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }));

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
      functions,
      function_call: 'auto',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const result = await response.json();
  const choice = result.choices?.[0];

  let message = choice?.message?.content || '';
  let suggestedChanges: SuggestedChanges | undefined;
  let needsMoreInfo = true;
  const clarifyingQuestions: string[] = [];

  // Check for function call
  if (choice?.message?.function_call?.name === 'suggest_modifications') {
    try {
      suggestedChanges = JSON.parse(choice.message.function_call.arguments) as SuggestedChanges;
      needsMoreInfo = false;
    } catch {
      // Invalid JSON in function call
    }
  } else {
    // Extract questions from message
    const questions = extractQuestions(message);
    clarifyingQuestions.push(...questions);
  }

  return {
    message: message.trim(),
    suggestedChanges,
    needsMoreInfo,
    clarifyingQuestions: clarifyingQuestions.length > 0 ? clarifyingQuestions : undefined,
  };
}

/**
 * Validate modifications against current data
 */
function validateModifications(
  modifications: Modification[],
  currentData: EntityData,
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  for (const mod of modifications) {
    // Check if field exists in current data
    if (!(mod.field in currentData)) {
      errors.push(`Field '${mod.field}' does not exist in current entity data`);
      continue;
    }

    // Check if old value matches current value
    if (JSON.stringify(currentData[mod.field]) !== JSON.stringify(mod.oldValue)) {
      errors.push(
        `Old value for '${mod.field}' does not match current value. Current: ${JSON.stringify(currentData[mod.field])}, Expected: ${JSON.stringify(mod.oldValue)}`
      );
    }

    // Validate new value type matches old value type
    if (typeof mod.newValue !== typeof mod.oldValue && mod.oldValue !== null) {
      errors.push(
        `Type mismatch for '${mod.field}'. Old type: ${typeof mod.oldValue}, New type: ${typeof mod.newValue}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * POST /api/wizard/modify
 *
 * Process modification request and return suggested changes.
 * Uses LLM to understand user intent and propose structured modifications.
 *
 * @param request - Next.js request with modification data
 * @returns Suggested modifications or clarifying questions
 *
 * @example
 * ```
 * POST /api/wizard/modify
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "entityId": "123",
 *   "currentData": {
 *     "id": "123",
 *     "name": "Support Bot",
 *     "description": "Handles customer support"
 *   },
 *   "messages": [
 *     { "role": "user", "content": "Change the name to Customer Success Agent" }
 *   ]
 * }
 *
 * Response:
 * {
 *   "message": "I'll help you rename the orchestrator to 'Customer Success Agent'.",
 *   "suggestedChanges": {
 *     "modifications": [
 *       {
 *         "field": "name",
 *         "oldValue": "Support Bot",
 *         "newValue": "Customer Success Agent",
 *         "reason": "User requested to change the name"
 *       }
 *     ],
 *     "summary": "Rename orchestrator",
 *     "reasoning": "The user requested to change the name to better reflect the agent's role."
 *   },
 *   "needsMoreInfo": false
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 });
    }

    // Validate request structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 });
    }

    const modifyReq = body as ModifyRequest;

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'workspace',
      'orchestrator',
      'session-manager',
      'subagent',
      'workflow',
      'channel',
    ];
    if (!modifyReq.entityType || !validEntityTypes.includes(modifyReq.entityType)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!modifyReq.entityId || typeof modifyReq.entityId !== 'string') {
      return NextResponse.json(
        { error: { message: 'entityId is required and must be a string' } },
        { status: 400 },
      );
    }

    if (!modifyReq.currentData || typeof modifyReq.currentData !== 'object') {
      return NextResponse.json(
        { error: { message: 'currentData is required and must be an object' } },
        { status: 400 },
      );
    }

    // Validate messages
    if (!Array.isArray(modifyReq.messages) || modifyReq.messages.length === 0) {
      return NextResponse.json(
        { error: { message: 'messages array is required and must not be empty' } },
        { status: 400 },
      );
    }

    // Build system prompt and tools
    const systemPrompt = buildSystemPrompt(modifyReq.entityType, modifyReq.currentData);
    const tools = buildTools(modifyReq.entityType);

    // Determine which LLM provider to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'anthropic';

    // Call appropriate LLM API
    let response: ModifyResponse;
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      response = await callClaude(systemPrompt, modifyReq.messages, tools);
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      response = await callOpenAI(systemPrompt, modifyReq.messages, tools);
    } else {
      // Fallback: try both
      if (process.env.ANTHROPIC_API_KEY) {
        response = await callClaude(systemPrompt, modifyReq.messages, tools);
      } else if (process.env.OPENAI_API_KEY) {
        response = await callOpenAI(systemPrompt, modifyReq.messages, tools);
      } else {
        return NextResponse.json(
          {
            error: {
              message: 'No LLM API key configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
            },
          },
          { status: 500 },
        );
      }
    }

    // Validate suggested modifications if present
    if (response.suggestedChanges) {
      const validation = validateModifications(
        response.suggestedChanges.modifications,
        modifyReq.currentData,
      );

      if (!validation.valid) {
        // Modifications failed validation
        return NextResponse.json(
          {
            error: {
              message: 'Generated modifications failed validation',
              details: validation.errors,
            },
          },
          { status: 422 },
        );
      }
    }

    return NextResponse.json({
      ...response,
      provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/wizard/modify] Error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'An internal error occurred' } },
      { status: 500 },
    );
  }
}
