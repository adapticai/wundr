/**
 * Conversational Wizard Chat API Route
 *
 * LLM-powered chat interface for guiding users through entity creation.
 * Uses structured tool calling to extract entity fields when sufficient information is gathered.
 *
 * Routes:
 * - POST /api/wizard/chat - Chat with LLM for entity creation guidance
 *
 * Supported Entity Types:
 * - workspace: Full organization with name, description, purpose, team structure
 * - orchestrator: Top-level autonomous agent with role, capabilities, goals
 * - session-manager: Context-specific agent with responsibilities, escalation rules
 * - workflow: Automated process with steps, triggers, actions
 *
 * @module app/api/wizard/chat/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Supported entity types for wizard creation
 */
type EntityType = 'workspace' | 'orchestrator' | 'session-manager' | 'workflow';

/**
 * Chat message structure
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Current context for ongoing creation
 */
interface CurrentContext {
  [key: string]: unknown;
}

/**
 * Request body structure
 */
interface WizardChatRequest {
  entityType: EntityType;
  messages: ChatMessage[];
  currentContext?: CurrentContext;
}

/**
 * Extracted entity data structures
 */
interface WorkspaceData {
  name: string;
  description: string;
  purpose?: string;
  teamSize?: string;
  departments?: string[];
  organizationType?: string;
}

interface OrchestratorData {
  name: string;
  role: string;
  description: string;
  capabilities?: string[];
  goals?: string[];
  channels?: string[];
  communicationStyle?: string;
}

interface SessionManagerData {
  name: string;
  responsibilities: string;
  parentOrchestrator?: string;
  context?: string;
  escalationCriteria?: string[];
}

interface WorkflowData {
  name: string;
  description: string;
  trigger: {
    type: string;
    config?: Record<string, unknown>;
  };
  steps: Array<{
    action: string;
    description: string;
  }>;
}

type ExtractedData = WorkspaceData | OrchestratorData | SessionManagerData | WorkflowData;

/**
 * Response structure
 */
interface WizardChatResponse {
  message: string;
  extractedData?: ExtractedData;
  isComplete: boolean;
  suggestedNextQuestion?: string;
}

/**
 * Validation schemas for each entity type
 */
const workspaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  purpose: z.string().optional(),
  teamSize: z.string().optional(),
  departments: z.array(z.string()).optional(),
  organizationType: z.string().optional(),
});

const orchestratorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  description: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  communicationStyle: z.string().optional(),
});

const sessionManagerSchema = z.object({
  name: z.string().min(1),
  responsibilities: z.string().min(1),
  parentOrchestrator: z.string().optional(),
  context: z.string().optional(),
  escalationCriteria: z.array(z.string()).optional(),
});

const workflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  trigger: z.object({
    type: z.string(),
    config: z.record(z.unknown()).optional(),
  }),
  steps: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
    }),
  ),
});

/**
 * Build system prompt for entity type with tool use instructions
 */
function buildSystemPrompt(entityType: EntityType): string {
  const basePrompt = `You are an AI assistant helping users create organizational entities in a collaborative AI platform. Your role is to guide users through providing necessary details for creating a ${entityType}.

Be conversational, friendly, and helpful. Ask clarifying questions to gather required information. When you have sufficient details, use the extract_entity tool to structure the data.

IMPORTANT: You are gathering information through conversation. When you have enough details, call the extract_entity tool with the structured data.`;

  const entityPrompts: Record<EntityType, string> = {
    workspace: `
You are helping create a new WORKSPACE (organization).

Required fields:
- name: Organization name
- description: Brief description of the organization

Optional but recommended:
- purpose: Mission or primary goal
- teamSize: Approximate team size (small/medium/large)
- departments: List of key departments or functions
- organizationType: Industry or domain (e.g., technology, finance, healthcare)

When you have at least the name and description, call extract_entity with the data.
`,
    orchestrator: `
You are helping create a new ORCHESTRATOR (autonomous agent).

Required fields:
- name: Agent name (friendly, e.g., "Sarah the Support Lead")
- role: Primary role/discipline
- description: What this orchestrator does

Optional but recommended:
- capabilities: List of key capabilities
- goals: Primary objectives
- channels: Communication channels to monitor
- communicationStyle: How the agent communicates (formal/friendly/technical)

When you have at least name, role, and description, call extract_entity with the data.
`,
    'session-manager': `
You are helping create a new SESSION MANAGER (contextual agent).

Required fields:
- name: Session manager name
- responsibilities: What they are responsible for

Optional but recommended:
- parentOrchestrator: Which orchestrator they report to
- context: Specific context or channel they manage
- escalationCriteria: When to escalate to orchestrator

When you have at least name and responsibilities, call extract_entity with the data.
`,
    workflow: `
You are helping create a new WORKFLOW (automated process).

Required fields:
- name: Workflow name
- description: What the workflow does
- trigger: How the workflow is triggered
  - type: Trigger type (schedule/event/manual/webhook)
  - config: Optional trigger configuration
- steps: Array of workflow steps
  - action: Action type
  - description: What this step does

When you have at least name, description, trigger, and steps, call extract_entity with the data.
`,
  };

  return basePrompt + '\n' + entityPrompts[entityType];
}

/**
 * Build tool definitions for Claude API
 */
function buildTools(entityType: EntityType) {
  const toolSchemas: Record<EntityType, object> = {
    workspace: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Organization name' },
        description: { type: 'string', description: 'Brief description' },
        purpose: { type: 'string', description: 'Mission or primary goal' },
        teamSize: { type: 'string', enum: ['small', 'medium', 'large'], description: 'Team size' },
        departments: { type: 'array', items: { type: 'string' }, description: 'Key departments' },
        organizationType: { type: 'string', description: 'Industry or domain' },
      },
      required: ['name', 'description'],
    },
    orchestrator: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name' },
        role: { type: 'string', description: 'Primary role or discipline' },
        description: { type: 'string', description: 'What this orchestrator does' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'Key capabilities' },
        goals: { type: 'array', items: { type: 'string' }, description: 'Primary objectives' },
        channels: { type: 'array', items: { type: 'string' }, description: 'Channels to monitor' },
        communicationStyle: { type: 'string', description: 'Communication style' },
      },
      required: ['name', 'role', 'description'],
    },
    'session-manager': {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Session manager name' },
        responsibilities: { type: 'string', description: 'What they are responsible for' },
        parentOrchestrator: { type: 'string', description: 'Parent orchestrator' },
        context: { type: 'string', description: 'Context or channel they manage' },
        escalationCriteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'When to escalate',
        },
      },
      required: ['name', 'responsibilities'],
    },
    workflow: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'What the workflow does' },
        trigger: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['schedule', 'event', 'manual', 'webhook'],
              description: 'Trigger type',
            },
            config: { type: 'object', description: 'Trigger configuration' },
          },
          required: ['type'],
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action type' },
              description: { type: 'string', description: 'What this step does' },
            },
            required: ['action', 'description'],
          },
          description: 'Workflow steps',
        },
      },
      required: ['name', 'description', 'trigger', 'steps'],
    },
  };

  return [
    {
      name: 'extract_entity',
      description: `Extract structured ${entityType} data from the conversation when sufficient information is available`,
      input_schema: toolSchemas[entityType],
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
): Promise<WizardChatResponse> {
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
  let extractedData: ExtractedData | undefined;
  let isComplete = false;
  let suggestedNextQuestion: string | undefined;

  // Handle content blocks
  for (const block of result.content || []) {
    if (block.type === 'text') {
      message += block.text;
    } else if (block.type === 'tool_use' && block.name === 'extract_entity') {
      extractedData = block.input as ExtractedData;
      isComplete = true;
    }
  }

  // If not complete, suggest next question
  if (!isComplete && result.stop_reason !== 'tool_use') {
    // Extract last question from message
    const sentences = message.split(/[.!?]+/).filter((s) => s.trim());
    const lastSentence = sentences[sentences.length - 1]?.trim();
    if (lastSentence && lastSentence.endsWith('?')) {
      suggestedNextQuestion = lastSentence + '?';
    }
  }

  return {
    message: message.trim(),
    extractedData,
    isComplete,
    suggestedNextQuestion,
  };
}

/**
 * Call OpenAI API with function calling (fallback)
 */
async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  entityType: EntityType,
): Promise<WizardChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Convert tools to OpenAI function format
  const tools = buildTools(entityType);
  const functions = tools.map((tool: { name: string; description: string; input_schema: object }) => ({
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
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
  let extractedData: ExtractedData | undefined;
  let isComplete = false;

  // Check for function call
  if (choice?.message?.function_call?.name === 'extract_entity') {
    try {
      extractedData = JSON.parse(choice.message.function_call.arguments) as ExtractedData;
      isComplete = true;
    } catch {
      // Invalid JSON in function call
    }
  }

  return {
    message: message.trim(),
    extractedData,
    isComplete,
    suggestedNextQuestion: !isComplete ? undefined : undefined,
  };
}

/**
 * Validate extracted data against schema
 */
function validateExtractedData(
  entityType: EntityType,
  data: unknown,
): { valid: boolean; data?: ExtractedData; errors?: unknown } {
  const schemas: Record<EntityType, z.ZodSchema> = {
    workspace: workspaceSchema,
    orchestrator: orchestratorSchema,
    'session-manager': sessionManagerSchema,
    workflow: workflowSchema,
  };

  const schema = schemas[entityType];
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data as ExtractedData };
  } else {
    return { valid: false, errors: result.error.flatten() };
  }
}

/**
 * POST /api/wizard/chat
 *
 * Chat with LLM for entity creation guidance.
 * Returns AI response and optionally extracted structured data.
 *
 * @param request - Next.js request with chat data
 * @returns Chat response with optional extracted data
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
 * Response:
 * {
 *   "message": "Great! Let's create a customer support orchestrator. What would you like to name this agent?",
 *   "isComplete": false,
 *   "suggestedNextQuestion": "What would you like to name this agent?"
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

    const wizardReq = body as WizardChatRequest;

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'workspace',
      'orchestrator',
      'session-manager',
      'workflow',
    ];
    if (!wizardReq.entityType || !validEntityTypes.includes(wizardReq.entityType)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Validate messages
    if (!Array.isArray(wizardReq.messages) || wizardReq.messages.length === 0) {
      return NextResponse.json(
        { error: { message: 'messages array is required and must not be empty' } },
        { status: 400 },
      );
    }

    // Validate message structure
    for (const msg of wizardReq.messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: { message: 'Each message must have role and content' } },
          { status: 400 },
        );
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json(
          { error: { message: 'Message role must be "user" or "assistant"' } },
          { status: 400 },
        );
      }
    }

    // Build system prompt and tools
    const systemPrompt = buildSystemPrompt(wizardReq.entityType);
    const tools = buildTools(wizardReq.entityType);

    // Determine which LLM provider to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'anthropic';

    // Call appropriate LLM API
    let response: WizardChatResponse;
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      response = await callClaude(systemPrompt, wizardReq.messages, tools);
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      response = await callOpenAI(systemPrompt, wizardReq.messages, wizardReq.entityType);
    } else {
      // Fallback: try both
      if (process.env.ANTHROPIC_API_KEY) {
        response = await callClaude(systemPrompt, wizardReq.messages, tools);
      } else if (process.env.OPENAI_API_KEY) {
        response = await callOpenAI(systemPrompt, wizardReq.messages, wizardReq.entityType);
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

    // Validate extracted data if present
    if (response.extractedData) {
      const validation = validateExtractedData(wizardReq.entityType, response.extractedData);
      if (!validation.valid) {
        // Data extraction failed validation, mark as incomplete
        response.isComplete = false;
        response.extractedData = undefined;
        response.message +=
          '\n\nI need a bit more information to complete this. Let me ask a few more questions.';
      } else {
        response.extractedData = validation.data;
      }
    }

    return NextResponse.json({
      data: response,
      provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/wizard/chat] Error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'An internal error occurred' } },
      { status: 500 },
    );
  }
}
