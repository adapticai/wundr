/**
 * Wizard Extract API Route
 *
 * Analyzes conversation history and extracts final structured entity data.
 * Uses LLM to parse the entire conversation and generate complete entity specification.
 *
 * Routes:
 * - POST /api/wizard/extract - Extract entity data from conversation history
 *
 * @module app/api/wizard/extract/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Supported entity types for extraction
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
 * Request body structure
 */
interface ExtractRequest {
  entityType: EntityType;
  conversationHistory: ChatMessage[];
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
  actions: Array<{
    action: string;
    description: string;
  }>;
}

type ExtractedData =
  | WorkspaceData
  | OrchestratorData
  | SessionManagerData
  | WorkflowData;

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
  actions: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
    })
  ),
});

/**
 * Build extraction prompt for entity type
 */
function buildExtractionPrompt(entityType: EntityType): string {
  const basePrompt = `You are analyzing a conversation about creating a ${entityType}. Extract all relevant information from the conversation history and return a complete, structured specification.

IMPORTANT: Return ONLY valid JSON matching the schema. Do not include any explanatory text before or after the JSON.`;

  const entityPrompts: Record<EntityType, string> = {
    workspace: `
Extract workspace data with these fields:
- name (required): Organization name
- description (required): Brief description
- purpose (optional): Mission or primary goal
- teamSize (optional): Team size (small/medium/large)
- departments (optional): Array of department names
- organizationType (optional): Industry or domain

Return JSON matching this schema:
{
  "name": "string",
  "description": "string",
  "purpose": "string",
  "teamSize": "small" | "medium" | "large",
  "departments": ["string"],
  "organizationType": "string"
}
`,
    orchestrator: `
Extract orchestrator data with these fields:
- name (required): Agent name
- role (required): Primary role or discipline
- description (required): What this orchestrator does
- capabilities (optional): Array of key capabilities
- goals (optional): Array of primary objectives
- channels (optional): Array of channels to monitor
- communicationStyle (optional): Communication style

Return JSON matching this schema:
{
  "name": "string",
  "role": "string",
  "description": "string",
  "capabilities": ["string"],
  "goals": ["string"],
  "channels": ["string"],
  "communicationStyle": "string"
}
`,
    'session-manager': `
Extract session manager data with these fields:
- name (required): Session manager name
- responsibilities (required): What they are responsible for
- parentOrchestrator (optional): Parent orchestrator name
- context (optional): Context or channel they manage
- escalationCriteria (optional): Array of escalation conditions

Return JSON matching this schema:
{
  "name": "string",
  "responsibilities": "string",
  "parentOrchestrator": "string",
  "context": "string",
  "escalationCriteria": ["string"]
}
`,
    workflow: `
Extract workflow data with these fields:
- name (required): Workflow name
- description (required): What the workflow does
- trigger (required): Trigger configuration
  - type (required): Trigger type (schedule/event/manual/webhook)
  - config (optional): Additional trigger configuration
- actions (required): Array of workflow actions
  - action (required): Action type
  - description (required): What this action does

Return JSON matching this schema:
{
  "name": "string",
  "description": "string",
  "trigger": {
    "type": "schedule" | "event" | "manual" | "webhook",
    "config": {}
  },
  "actions": [
    {
      "action": "string",
      "description": "string"
    }
  ]
}
`,
  };

  return basePrompt + '\n' + entityPrompts[entityType];
}

/**
 * Call Anthropic Claude API for extraction
 */
async function extractWithClaude(
  conversationHistory: ChatMessage[],
  entityType: EntityType
): Promise<ExtractedData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const systemPrompt = buildExtractionPrompt(entityType);

  // Build extraction request message
  const conversationText = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

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
      temperature: 0, // Use deterministic extraction
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation history:\n\n${conversationText}\n\nExtract the structured data as JSON.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const result = await response.json();

  // Extract JSON from response
  let jsonText = '';
  for (const block of result.content || []) {
    if (block.type === 'text') {
      jsonText += block.text;
    }
  }

  // Try to parse JSON
  try {
    // Remove markdown code blocks if present
    const cleanedJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedJson) as ExtractedData;
  } catch (error) {
    throw new Error(
      `Failed to parse extracted JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Call OpenAI API for extraction (fallback)
 */
async function extractWithOpenAI(
  conversationHistory: ChatMessage[],
  entityType: EntityType
): Promise<ExtractedData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = buildExtractionPrompt(entityType);
  const conversationText = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),
      temperature: 0, // Use deterministic extraction
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here is the conversation history:\n\n${conversationText}\n\nExtract the structured data as JSON.`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  try {
    return JSON.parse(content) as ExtractedData;
  } catch (error) {
    throw new Error(
      `Failed to parse extracted JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate extracted data against schema
 */
function validateExtractedData(
  entityType: EntityType,
  data: unknown
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
 * POST /api/wizard/extract
 *
 * Extract final structured entity data from conversation history.
 * Analyzes the entire conversation and returns validated entity specification.
 *
 * @param request - Next.js request with conversation history
 * @returns Extracted and validated entity data
 *
 * @example
 * ```
 * POST /api/wizard/extract
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "conversationHistory": [
 *     { "role": "user", "content": "I need a customer support agent" },
 *     { "role": "assistant", "content": "Great! What would you like to name this agent?" },
 *     { "role": "user", "content": "Sarah the Support Lead" },
 *     { "role": "assistant", "content": "Perfect! What role will Sarah have?" },
 *     { "role": "user", "content": "She'll handle customer support and escalations" }
 *   ]
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "name": "Sarah the Support Lead",
 *     "role": "Customer Support",
 *     "description": "Handles customer support inquiries and manages escalations",
 *     "capabilities": ["customer support", "escalation management"],
 *     "communicationStyle": "friendly"
 *   },
 *   "valid": true,
 *   "provider": "anthropic",
 *   "timestamp": "2025-11-27T12:00:00.000Z"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate request structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: { message: 'Invalid request body' } },
        { status: 400 }
      );
    }

    const extractReq = body as ExtractRequest;

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'workspace',
      'orchestrator',
      'session-manager',
      'workflow',
    ];
    if (
      !extractReq.entityType ||
      !validEntityTypes.includes(extractReq.entityType)
    ) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate conversation history
    if (
      !Array.isArray(extractReq.conversationHistory) ||
      extractReq.conversationHistory.length === 0
    ) {
      return NextResponse.json(
        {
          error: {
            message:
              'conversationHistory array is required and must not be empty',
          },
        },
        { status: 400 }
      );
    }

    // Validate message structure
    for (const msg of extractReq.conversationHistory) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: { message: 'Each message must have role and content' } },
          { status: 400 }
        );
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json(
          { error: { message: 'Message role must be "user" or "assistant"' } },
          { status: 400 }
        );
      }
    }

    // Determine which LLM provider to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'anthropic';

    // Extract data using appropriate LLM
    let extractedData: ExtractedData;
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      extractedData = await extractWithClaude(
        extractReq.conversationHistory,
        extractReq.entityType
      );
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      extractedData = await extractWithOpenAI(
        extractReq.conversationHistory,
        extractReq.entityType
      );
    } else {
      // Fallback: try both
      if (process.env.ANTHROPIC_API_KEY) {
        extractedData = await extractWithClaude(
          extractReq.conversationHistory,
          extractReq.entityType
        );
      } else if (process.env.OPENAI_API_KEY) {
        extractedData = await extractWithOpenAI(
          extractReq.conversationHistory,
          extractReq.entityType
        );
      } else {
        return NextResponse.json(
          {
            error: {
              message:
                'No LLM API key configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
            },
          },
          { status: 500 }
        );
      }
    }

    // Validate extracted data
    const validation = validateExtractedData(
      extractReq.entityType,
      extractedData
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: {
            message: 'Extracted data failed validation',
            details: validation.errors,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: validation.data,
      valid: true,
      provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/wizard/extract] Error:', error);
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'An internal error occurred',
        },
      },
      { status: 500 }
    );
  }
}
