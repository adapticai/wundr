/**
 * Charter Generation API Route
 *
 * Uses AI to generate a charter from a conversational user prompt.
 * The generated charter is returned for client review and is NOT persisted.
 * Clients should POST to /api/charters to persist after review.
 *
 * Routes:
 * - POST /api/charters/generate - Generate a charter from a user description
 *
 * @module app/api/charters/generate/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  conversationalCharterInputSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { ConversationalCharterInput } from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Schema for the AI-generated charter output
 */
const generatedCharterSchema = z.object({
  name: z.string().describe('A concise name for the charter'),
  mission: z
    .string()
    .describe(
      'The mission statement defining why the organization exists and what it aims to achieve'
    ),
  vision: z
    .string()
    .describe(
      'The long-term vision describing where the organization wants to be'
    ),
  values: z
    .array(z.string())
    .min(3)
    .max(10)
    .describe('Core values that guide behaviour and decision-making'),
  principles: z
    .array(z.string())
    .max(10)
    .describe('Operational principles that translate values into practice'),
  governance: z
    .object({
      style: z
        .enum([
          'democratic',
          'hierarchical',
          'consensus',
          'delegated',
          'hybrid',
        ])
        .describe('Decision-making governance style'),
      decisionMaking: z
        .string()
        .describe('How decisions are made within the organization'),
      escalationPolicy: z
        .string()
        .describe('How and when issues are escalated'),
      reviewCadence: z
        .string()
        .describe('How often the charter is reviewed and updated'),
    })
    .describe('Governance structure and decision-making approach'),
  security: z
    .object({
      dataClassification: z
        .string()
        .describe('How data is classified and handled'),
      accessControl: z.string().describe('Access control policies'),
      complianceRequirements: z
        .array(z.string())
        .describe('Regulatory or compliance requirements to meet'),
    })
    .describe('Security and compliance framework'),
  communication: z
    .object({
      style: z
        .enum(['formal', 'casual', 'balanced', 'technical', 'creative'])
        .describe('Primary communication style'),
      preferredChannels: z
        .array(z.string())
        .describe('Preferred communication channels'),
      responseTimeExpectation: z
        .string()
        .describe('Expected response times for communications'),
      escalationThreshold: z
        .string()
        .describe('When to escalate communication issues'),
    })
    .describe('Communication standards and preferences'),
});

/**
 * POST /api/charters/generate
 *
 * Generate a charter from a conversational user prompt using AI.
 * The result is NOT persisted; the client should review and POST to /api/charters.
 *
 * @param request - Next.js request with user prompt and optional context
 * @returns Generated charter data for review
 *
 * @example
 * ```
 * POST /api/charters/generate
 * Content-Type: application/json
 *
 * {
 *   "userPrompt": "We are a fintech startup building AI-powered portfolio management...",
 *   "industry": "fintech",
 *   "organizationSize": "small"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON body'
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = conversationalCharterInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: ConversationalCharterInput = parseResult.data;

    // Determine which AI provider to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[POST /api/charters/generate] OPENAI_API_KEY not configured'
      );
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.INTERNAL_ERROR,
          'AI provider not configured'
        ),
        { status: 500 }
      );
    }

    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[POST /api/charters/generate] ANTHROPIC_API_KEY not configured'
      );
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.INTERNAL_ERROR,
          'AI provider not configured'
        ),
        { status: 500 }
      );
    }

    const model =
      provider === 'openai'
        ? openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')
        : anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');

    // Build system prompt
    const systemPrompt = `You are an expert organizational strategist who specializes in creating
comprehensive organizational charters. Your task is to generate a well-structured, professional
charter based on the user's description of their organization.

The charter should be specific, actionable, and tailored to the organization's unique context.
- Write in clear, professional language
- Make values and principles concrete and specific (not generic platitudes)
- Align governance style with the organization's size and culture
- Ensure communication standards fit the described work environment
- Keep compliance requirements realistic for the described industry`;

    // Build user message with context
    const contextParts: string[] = [input.userPrompt];
    if (input.industry) {
      contextParts.push(`Industry: ${input.industry}`);
    }
    if (input.organizationSize) {
      contextParts.push(`Organization size: ${input.organizationSize}`);
    }
    if (input.context && Object.keys(input.context).length > 0) {
      contextParts.push(`Additional context: ${JSON.stringify(input.context)}`);
    }

    const userMessage = contextParts.join('\n\n');

    // Generate the charter using AI
    const { object: generatedCharter } = await generateObject({
      model,
      schema: generatedCharterSchema,
      system: systemPrompt,
      prompt: userMessage,
    });

    return NextResponse.json(
      {
        data: generatedCharter,
        message:
          'Charter generated successfully. Review and POST to /api/charters to save.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/charters/generate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}
