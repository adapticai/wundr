/**
 * Wizard Extract API Route
 *
 * Analyzes conversation history and extracts final structured entity data.
 * Uses Vercel AI SDK with structured output (generateObject) for guaranteed JSON schema compliance.
 *
 * Routes:
 * - POST /api/wizard/extract - Extract entity data from conversation history
 *
 * @module app/api/wizard/extract/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
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
 * Enhanced validation schemas for each entity type with better descriptions
 */
const workspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .describe('The name of the workspace'),
  description: z
    .string()
    .min(1, 'Description is required')
    .describe('A brief description of the workspace purpose'),
  purpose: z
    .string()
    .optional()
    .describe('The mission or primary goal of the workspace'),
  teamSize: z
    .enum(['small', 'medium', 'large'])
    .optional()
    .describe(
      'Team size category: small (1-10), medium (10-50), large (50+)',
    ),
  departments: z
    .array(z.string())
    .optional()
    .describe('List of departments or functional areas'),
  organizationType: z
    .string()
    .optional()
    .describe('Industry or domain (e.g., technology, finance, healthcare)'),
});

const orchestratorSchema = z.object({
  name: z
    .string()
    .min(1, 'Orchestrator name is required')
    .describe('The name of the orchestrator (can be friendly, e.g., "Sarah")'),
  role: z
    .string()
    .min(1, 'Role is required')
    .describe(
      'Primary role or discipline (e.g., Customer Support, Research Analyst)',
    ),
  description: z
    .string()
    .min(1, 'Description is required')
    .describe('What this orchestrator does - their responsibilities'),
  capabilities: z
    .array(z.string())
    .optional()
    .describe('List of key capabilities or skills'),
  goals: z
    .array(z.string())
    .optional()
    .describe('Primary objectives or goals'),
  channels: z
    .array(z.string())
    .optional()
    .describe('Channels this orchestrator should monitor'),
  communicationStyle: z
    .enum(['formal', 'friendly', 'technical'])
    .optional()
    .describe('Preferred communication style'),
});

const sessionManagerSchema = z.object({
  name: z
    .string()
    .min(1, 'Session manager name is required')
    .describe('The name of the session manager'),
  responsibilities: z
    .string()
    .min(1, 'Responsibilities are required')
    .describe('What this session manager is responsible for handling'),
  parentOrchestrator: z
    .string()
    .optional()
    .describe('The parent orchestrator this session manager reports to'),
  context: z
    .string()
    .optional()
    .describe('The specific context or channel they manage'),
  escalationCriteria: z
    .array(z.string())
    .optional()
    .describe('Conditions that trigger escalation to parent orchestrator'),
});

const workflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .describe('The name of the workflow'),
  description: z
    .string()
    .min(1, 'Description is required')
    .describe('What this workflow accomplishes'),
  trigger: z
    .object({
      type: z
        .enum(['schedule', 'event', 'manual', 'webhook'])
        .describe('How the workflow is triggered'),
      config: z
        .record(z.unknown())
        .optional()
        .describe('Additional trigger configuration'),
    })
    .describe('Workflow trigger configuration'),
  actions: z
    .array(
      z.object({
        action: z.string().describe('The action type or name'),
        description: z.string().describe('What this action does'),
      }),
    )
    .min(1, 'At least one action is required')
    .describe('List of workflow actions to perform'),
});

/**
 * Build enhanced extraction prompt for entity type with better guidance
 */
function buildExtractionPrompt(entityType: EntityType): string {
  const basePrompt = `You are an expert at analyzing conversations and extracting structured data. Your task is to carefully review the entire conversation history and extract complete, accurate information about a ${entityType}.

IMPORTANT INSTRUCTIONS:
1. Read the ENTIRE conversation carefully - information may be spread across multiple messages
2. Extract ALL mentioned information, even if implicit or indirect
3. Infer reasonable defaults when appropriate based on context
4. If information is clearly not provided, omit optional fields rather than guessing
5. Ensure all required fields are present and non-empty
6. For arrays, extract all mentioned items
7. Be precise and faithful to the user's intent`;

  const entityPrompts: Record<EntityType, string> = {
    workspace: `
WORKSPACE EXTRACTION GUIDELINES:

Required Fields:
- name: The organization or workspace name mentioned by the user
- description: A clear description of what the workspace is for

Optional Fields (extract if mentioned):
- purpose: The mission, vision, or primary goal
- teamSize: Classify as "small" (1-10), "medium" (10-50), or "large" (50+)
- departments: List all mentioned departments, teams, or functional areas
- organizationType: The industry, domain, or type of organization

EXTRACTION STRATEGY:
- Look for organization names, team descriptions, company info
- Infer teamSize from mentions of "small team", "large organization", specific numbers
- Extract departments from mentions of "marketing", "engineering", "sales", etc.
- Identify industry from context clues
`,
    orchestrator: `
ORCHESTRATOR EXTRACTION GUIDELINES:

Required Fields:
- name: The agent's name (can be friendly like "Sarah" or formal like "Support Agent")
- role: Their primary role, title, or discipline
- description: What they do, their responsibilities, and purpose

Optional Fields (extract if mentioned):
- capabilities: Specific skills, abilities, or what they can do
- goals: Their objectives, targets, or what they aim to achieve
- channels: Specific channels they should monitor or participate in
- communicationStyle: Must be "formal", "friendly", or "technical" if mentioned

EXTRACTION STRATEGY:
- Name can be inferred from "call them X", "named Y", or role descriptions
- Role should capture their primary function or discipline
- Capabilities should be specific tasks or skills mentioned
- Goals should reflect intended outcomes or success criteria
- Only set communicationStyle if explicitly or strongly implied
`,
    'session-manager': `
SESSION MANAGER EXTRACTION GUIDELINES:

Required Fields:
- name: The session manager's name or identifier
- responsibilities: What they are responsible for handling or managing

Optional Fields (extract if mentioned):
- parentOrchestrator: The orchestrator they report to or work under
- context: The specific channel, situation, or context they manage
- escalationCriteria: Conditions that trigger escalation (e.g., "urgent", "complex")

EXTRACTION STRATEGY:
- Look for hierarchical relationships to identify parentOrchestrator
- Context often relates to specific channels or types of interactions
- Escalation criteria are conditions like complexity, urgency, or specific keywords
- Responsibilities should be comprehensive and capture the full scope
`,
    workflow: `
WORKFLOW EXTRACTION GUIDELINES:

Required Fields:
- name: The workflow's name or title
- description: What the workflow accomplishes or automates
- trigger: How the workflow starts
  - type: Must be "schedule", "event", "manual", or "webhook"
  - config: Optional configuration (e.g., cron for schedule, event name)
- actions: The steps or actions performed (at least one required)
  - action: The action type or name
  - description: What this specific action does

EXTRACTION STRATEGY:
- Identify trigger type from phrases like "every day" (schedule), "when X happens" (event)
- For schedule triggers, extract cron patterns if mentioned
- For event triggers, extract event type in config
- Actions should be in logical order if sequence is mentioned
- Each action should have clear description of what it does
`,
  };

  return basePrompt + '\n\n' + entityPrompts[entityType];
}

/**
 * Get schema for entity type
 */
function getSchemaForEntityType(entityType: EntityType): z.ZodSchema {
  const schemas: Record<EntityType, z.ZodSchema> = {
    workspace: workspaceSchema,
    orchestrator: orchestratorSchema,
    'session-manager': sessionManagerSchema,
    workflow: workflowSchema,
  };

  return schemas[entityType];
}

/**
 * Extract entity data using AI SDK structured output
 * Uses generateObject for guaranteed schema compliance
 */
async function extractWithStructuredOutput(
  conversationHistory: ChatMessage[],
  entityType: EntityType,
  provider: 'openai' | 'anthropic',
): Promise<ExtractedData> {
  // Get system prompt and schema
  const systemPrompt = buildExtractionPrompt(entityType);
  const schema = getSchemaForEntityType(entityType);

  // Format conversation for extraction
  const conversationText = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

  // Select model
  const model =
    provider === 'openai'
      ? openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')
      : anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');

  // Use generateObject for structured output with schema validation
  try {
    const result = await generateObject({
      model,
      schema,
      system: systemPrompt,
      prompt: `Analyze this conversation and extract the ${entityType} information:\n\n${conversationText}`,
    });

    return result.object as ExtractedData;
  } catch (error) {
    // Provide more detailed error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error(`${provider} API key is invalid or not configured`);
      }
      if (error.message.includes('rate limit')) {
        throw new Error(`${provider} API rate limit exceeded`);
      }
      if (error.message.includes('timeout')) {
        throw new Error(`${provider} API request timed out`);
      }
      throw new Error(
        `${provider} extraction failed: ${error.message}`,
      );
    }
    throw new Error(`${provider} extraction failed with unknown error`);
  }
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
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    // Validate request structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: { message: 'Invalid request body' } },
        { status: 400 },
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
        { status: 400 },
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
        { status: 400 },
      );
    }

    // Validate message structure
    for (const msg of extractReq.conversationHistory) {
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

    // Determine which LLM provider to use (OpenAI default)
    const providerConfig = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    // Validate API keys and select provider
    let selectedProvider: 'openai' | 'anthropic';
    if (providerConfig === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      selectedProvider = 'anthropic';
    } else if (providerConfig === 'openai' && process.env.OPENAI_API_KEY) {
      selectedProvider = 'openai';
    } else {
      // Fallback: try to find any available provider
      if (process.env.OPENAI_API_KEY) {
        selectedProvider = 'openai';
        console.log(
          '[POST /api/wizard/extract] Falling back to OpenAI (preferred provider not available)',
        );
      } else if (process.env.ANTHROPIC_API_KEY) {
        selectedProvider = 'anthropic';
        console.log(
          '[POST /api/wizard/extract] Falling back to Anthropic (OpenAI not available)',
        );
      } else {
        return NextResponse.json(
          {
            error: {
              message:
                'No LLM API key configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
              code: 'NO_API_KEY',
            },
          },
          { status: 500 },
        );
      }
    }

    console.log(
      `[POST /api/wizard/extract] Using ${selectedProvider} for ${extractReq.entityType} extraction`,
    );

    // Extract data using structured output (schema-validated by AI SDK)
    let extractedData: ExtractedData;
    try {
      extractedData = await extractWithStructuredOutput(
        extractReq.conversationHistory,
        extractReq.entityType,
        selectedProvider,
      );
    } catch (error) {
      console.error('[POST /api/wizard/extract] Extraction error:', error);
      return NextResponse.json(
        {
          error: {
            message:
              error instanceof Error
                ? error.message
                : 'Failed to extract entity data',
            code: 'EXTRACTION_FAILED',
          },
        },
        { status: 500 },
      );
    }

    // Additional validation (AI SDK already validates schema, but we double-check)
    const validation = validateExtractedData(
      extractReq.entityType,
      extractedData,
    );

    if (!validation.valid) {
      console.error(
        '[POST /api/wizard/extract] Schema validation failed:',
        validation.errors,
      );
      return NextResponse.json(
        {
          error: {
            message: 'Extracted data failed schema validation',
            details: validation.errors,
            code: 'VALIDATION_FAILED',
          },
        },
        { status: 422 },
      );
    }

    console.log(
      `[POST /api/wizard/extract] Successfully extracted ${extractReq.entityType} data`,
    );

    return NextResponse.json({
      data: validation.data,
      valid: true,
      provider: selectedProvider,
      entityType: extractReq.entityType,
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
      { status: 500 },
    );
  }
}
