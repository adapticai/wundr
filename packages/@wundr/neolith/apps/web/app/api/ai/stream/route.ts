/**
 * AI Streaming API Route (Server-Sent Events)
 *
 * Dedicated streaming endpoint with proper SSE headers and event formatting.
 * Provides real-time token-by-token streaming with progress tracking.
 *
 * Routes:
 * - POST /api/ai/stream - Stream AI responses via SSE
 *
 * @module app/api/ai/stream/route
 */

import { convertToModelMessages, streamText } from 'ai';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  getDefaultProvider,
  getLanguageModel,
  getModelMetadata,
  supportsFeature,
  validateProviderKey,
  type AIProvider,
} from '@/lib/ai/providers';
import {
  calculateCost,
  checkWorkspaceQuota,
  estimateTokens,
  logTokenUsage,
  type TokenUsage,
} from '@/lib/ai/token-tracking';
import { checkRateLimit } from '@/lib/workflow/rate-limiter';

import type { UIMessage } from '@ai-sdk/react';

/**
 * Request validation schema
 */
const streamRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      content: z.string().min(1),
      toolCallId: z.string().optional(),
      toolInvocations: z.array(z.any()).optional(),
    })
  ),
  workspaceId: z.string().min(1),
  model: z.string().optional(),
  provider: z.enum(['openai', 'anthropic', 'deepseek']).optional(),
  maxTokens: z.number().positive().max(16384).default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().optional(),
  onFinish: z.boolean().default(true), // Send finish event with usage
});

type StreamRequest = z.infer<typeof streamRequestSchema>;

/**
 * POST /api/ai/stream
 *
 * Stream AI responses via Server-Sent Events
 *
 * @param request - Next.js request with stream configuration
 * @returns SSE stream response
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  let workspaceId: string | undefined;
  let userId: string | undefined;

  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({
          error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    userId = session.user.id;

    // 2. Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: { message: 'Invalid JSON body', code: 'INVALID_JSON' },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const validation = streamRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
            code: 'VALIDATION_ERROR',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const streamRequest: StreamRequest = validation.data;
    workspaceId = streamRequest.workspaceId;
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    console.log(
      `[POST /api/ai/stream] Request ${requestId} for workspace ${workspaceId}`
    );

    // 3. Verify workspace access
    const { prisma } = await import('@neolith/database');
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: streamRequest.workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Workspace not found or access denied',
            code: 'FORBIDDEN',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Rate limiting
    const rateLimit = await checkRateLimit(
      `workspace:${workspaceId}:ai-stream`,
      'api'
    );
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            resetAt: new Date(rateLimit.reset).toISOString(),
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        }
      );
    }

    // 5. Determine provider and model
    const provider: AIProvider = streamRequest.provider || getDefaultProvider();
    const modelName =
      streamRequest.model || getModelMetadata(provider)?.name || 'gpt-4o-mini';

    // Validate provider
    const keyValidation = validateProviderKey(provider);
    if (!keyValidation.valid) {
      return new Response(
        JSON.stringify({
          error: {
            message: keyValidation.error,
            code: 'PROVIDER_NOT_CONFIGURED',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate streaming support
    const metadata = getModelMetadata(modelName);
    if (!metadata || !supportsFeature(modelName, 'streaming')) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Model ${modelName} does not support streaming`,
            code: 'STREAMING_NOT_SUPPORTED',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Check token quota
    const messagesText = streamRequest.messages.map(m => m.content).join('\n');
    const estimatedInputTokens = estimateTokens(messagesText);

    const quotaCheck = await checkWorkspaceQuota(
      workspaceId,
      estimatedInputTokens + streamRequest.maxTokens
    );
    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Workspace token quota exceeded',
            code: 'QUOTA_EXCEEDED',
            quota: {
              limit: quotaCheck.limit,
              remaining: quotaCheck.remaining,
            },
          },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. Prepare streaming
    const uiMessages = streamRequest.messages as unknown as UIMessage[];
    const modelMessages = convertToModelMessages(uiMessages);
    const model = getLanguageModel(provider, modelName);

    // 8. Create stream with usage tracking
    let totalTokensUsed = 0;
    let finishReason: string | undefined;

    const result = streamText({
      model,
      messages: modelMessages,
      temperature: streamRequest.temperature,
      ...(streamRequest.systemPrompt && {
        system: streamRequest.systemPrompt,
      }),
      onFinish: async event => {
        finishReason = event.finishReason;
        const eventUsage = event.usage as any;
        const usage: TokenUsage = {
          promptTokens: eventUsage?.promptTokens || 0,
          completionTokens: eventUsage?.completionTokens || 0,
          totalTokens: eventUsage?.totalTokens || 0,
        };
        totalTokensUsed = usage.totalTokens;

        const costCalculation = calculateCost(modelName, usage);

        // Log usage
        await logTokenUsage({
          workspaceId: workspaceId!,
          userId: userId!,
          model: modelName,
          provider,
          endpoint: '/api/ai/stream',
          usage,
          cost: costCalculation.cost,
          requestId,
          metadata: {
            duration: Date.now() - startTime,
            messageCount: streamRequest.messages.length,
            finishReason,
          },
        });

        console.log(
          `[POST /api/ai/stream] Request ${requestId} completed: ${usage.totalTokens} tokens, $${costCalculation.cost.toFixed(6)}`
        );
      },
    });

    // 9. Return streaming response with proper headers
    const response = result.toTextStreamResponse();

    // Set SSE headers
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('Connection', 'keep-alive');
    response.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Provider', provider);
    response.headers.set('X-Model', modelName);
    response.headers.set(
      'X-RateLimit-Remaining',
      rateLimit.remaining.toString()
    );

    return response;
  } catch (error) {
    console.error('[POST /api/ai/stream] Error:', error);

    return new Response(
      JSON.stringify({
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'An internal error occurred',
          code: 'INTERNAL_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
