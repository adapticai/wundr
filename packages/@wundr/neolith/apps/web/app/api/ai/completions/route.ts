/**
 * AI Text Completions API Route
 *
 * Simple text completion endpoint for non-conversational use cases.
 * Supports single prompt completions without chat context.
 *
 * Routes:
 * - POST /api/ai/completions - Generate text completion
 *
 * @module app/api/ai/completions/route
 */

import { generateText, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  getDefaultProvider,
  getLanguageModel,
  getModelMetadata,
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

/**
 * Request validation schema
 */
const completionRequestSchema = z.object({
  prompt: z.string().min(1).max(50000),
  workspaceId: z.string().min(1),
  model: z.string().optional(),
  provider: z.enum(['openai', 'anthropic', 'deepseek']).optional(),
  stream: z.boolean().default(false),
  maxTokens: z.number().positive().max(16384).default(1024),
  temperature: z.number().min(0).max(2).default(0.7),
  stopSequences: z.array(z.string()).max(4).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CompletionRequest = z.infer<typeof completionRequestSchema>;

/**
 * Error response helper
 */
function errorResponse(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code: code || `AI_COMPLETION_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * POST /api/ai/completions
 *
 * Generate text completion from prompt
 *
 * @param request - Next.js request with completion data
 * @returns Text completion
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  let workspaceId: string | undefined;
  let requestId: string | undefined;

  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // 2. Parse and validate
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, 'INVALID_JSON');
    }

    const validation = completionRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    const completionRequest: CompletionRequest = validation.data;
    workspaceId = completionRequest.workspaceId;
    requestId = `completion-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    console.log(
      `[POST /api/ai/completions] Request ${requestId} for workspace ${workspaceId}`
    );

    // 3. Verify workspace access
    const { prisma } = await import('@neolith/database');
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: completionRequest.workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return errorResponse(
        'Workspace not found or access denied',
        403,
        'FORBIDDEN'
      );
    }

    // 4. Rate limiting
    const rateLimit = await checkRateLimit(
      `workspace:${workspaceId}:ai-completions`,
      'api'
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            resetAt: new Date(rateLimit.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        }
      );
    }

    // 5. Determine provider and model
    const provider: AIProvider =
      completionRequest.provider || getDefaultProvider();
    const modelName =
      completionRequest.model ||
      getModelMetadata(provider)?.name ||
      'gpt-4o-mini';

    // Validate provider
    const keyValidation = validateProviderKey(provider);
    if (!keyValidation.valid) {
      return errorResponse(
        keyValidation.error!,
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    const metadata = getModelMetadata(modelName);
    if (!metadata) {
      return errorResponse(
        `Model ${modelName} not found`,
        400,
        'INVALID_MODEL'
      );
    }

    // 6. Check token quota
    const estimatedInputTokens = estimateTokens(completionRequest.prompt);
    const quotaCheck = await checkWorkspaceQuota(
      workspaceId,
      estimatedInputTokens + completionRequest.maxTokens
    );
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            message: 'Workspace token quota exceeded',
            code: 'QUOTA_EXCEEDED',
            quota: {
              limit: quotaCheck.limit,
              remaining: quotaCheck.remaining,
              resetDate: quotaCheck.resetDate?.toISOString(),
            },
          },
        },
        { status: 429 }
      );
    }

    // 7. Get language model
    const model = getLanguageModel(provider, modelName);

    // 8. Prepare request options
    const requestOptions = {
      model,
      prompt: completionRequest.prompt,
      maxTokens: completionRequest.maxTokens,
      temperature: completionRequest.temperature,
      ...(completionRequest.stopSequences && {
        stop: completionRequest.stopSequences,
      }),
      ...(completionRequest.topP && { topP: completionRequest.topP }),
      ...(completionRequest.frequencyPenalty && {
        frequencyPenalty: completionRequest.frequencyPenalty,
      }),
      ...(completionRequest.presencePenalty && {
        presencePenalty: completionRequest.presencePenalty,
      }),
    };

    // 9. Generate completion
    if (completionRequest.stream) {
      // Streaming response
      const result = streamText(requestOptions);

      const response = result.toTextStreamResponse();
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Provider', provider);
      response.headers.set('X-Model', modelName);

      return response;
    } else {
      // Non-streaming response
      const result = await generateText(requestOptions);

      const usage: TokenUsage = {
        promptTokens:
          (result.usage as any)?.promptTokens || estimatedInputTokens,
        completionTokens: (result.usage as any)?.completionTokens || 0,
        totalTokens: (result.usage as any)?.totalTokens || estimatedInputTokens,
      };

      const costCalculation = calculateCost(modelName, usage);

      // Log usage
      await logTokenUsage({
        workspaceId,
        userId: session.user.id,
        model: modelName,
        provider,
        endpoint: '/api/ai/completions',
        usage,
        cost: costCalculation.cost,
        requestId,
        metadata: {
          ...completionRequest.metadata,
          duration: Date.now() - startTime,
          promptLength: completionRequest.prompt.length,
        },
      });

      console.log(
        `[POST /api/ai/completions] Request ${requestId} completed in ${Date.now() - startTime}ms`
      );

      return NextResponse.json({
        id: requestId,
        object: 'text.completion',
        created: Math.floor(startTime / 1000),
        model: modelName,
        provider,
        choices: [
          {
            text: result.text,
            index: 0,
            finishReason: result.finishReason,
          },
        ],
        usage,
        cost: costCalculation,
        metadata: {
          duration: Date.now() - startTime,
        },
      });
    }
  } catch (error) {
    console.error('[POST /api/ai/completions] Error:', error);

    // Log error
    if (workspaceId && requestId) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          await logTokenUsage({
            workspaceId,
            userId: session.user.id,
            model: 'unknown',
            provider: 'unknown',
            endpoint: '/api/ai/completions',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            cost: 0,
            requestId,
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: Date.now() - startTime,
            },
          });
        }
      } catch (logError) {
        console.error(
          '[POST /api/ai/completions] Error logging failed:',
          logError
        );
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : 'An internal error occurred',
      500,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
