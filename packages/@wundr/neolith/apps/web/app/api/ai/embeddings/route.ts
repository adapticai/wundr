/**
 * AI Embeddings API Route
 *
 * Generate vector embeddings for text using OpenAI embedding models.
 * Useful for semantic search, clustering, and similarity comparisons.
 *
 * Routes:
 * - POST /api/ai/embeddings - Generate embeddings
 *
 * @module app/api/ai/embeddings/route
 */

import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  checkWorkspaceQuota,
  estimateTokens,
  logTokenUsage,
  type TokenUsage,
} from '@/lib/ai/token-tracking';
import { checkRateLimit } from '@/lib/workflow/rate-limiter';

/**
 * Embedding models with metadata
 */
const EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.00002,
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    maxTokens: 8191,
    costPer1kTokens: 0.00013,
  },
  'text-embedding-ada-002': {
    dimensions: 1536,
    maxTokens: 8191,
    costPer1kTokens: 0.0001,
  },
} as const;

type EmbeddingModelName = keyof typeof EMBEDDING_MODELS;

/**
 * Request validation schema
 */
const embeddingRequestSchema = z.object({
  input: z.union([z.string(), z.array(z.string())]),
  workspaceId: z.string().min(1),
  model: z
    .enum([
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ])
    .default('text-embedding-3-small'),
  dimensions: z.number().positive().optional(),
  encodingFormat: z.enum(['float', 'base64']).default('float'),
  metadata: z.record(z.unknown()).optional(),
});

type EmbeddingRequest = z.infer<typeof embeddingRequestSchema>;

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
        code: code || `AI_EMBEDDING_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * POST /api/ai/embeddings
 *
 * Generate vector embeddings for text input
 *
 * @param request - Next.js request with embedding data
 * @returns Vector embeddings
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

    const validation = embeddingRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    const embeddingRequest: EmbeddingRequest = validation.data;
    workspaceId = embeddingRequest.workspaceId;
    requestId = `embedding-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    console.log(
      `[POST /api/ai/embeddings] Request ${requestId} for workspace ${workspaceId}`
    );

    // 3. Verify API key
    if (!process.env.OPENAI_API_KEY) {
      return errorResponse(
        'OpenAI API key not configured',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    // 4. Verify workspace access
    const { prisma } = await import('@neolith/database');
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: embeddingRequest.workspaceId,
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

    // 5. Rate limiting
    const rateLimit = await checkRateLimit(
      `workspace:${workspaceId}:ai-embeddings`,
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

    // 6. Get model metadata
    const modelMetadata = EMBEDDING_MODELS[embeddingRequest.model];
    const inputTexts = Array.isArray(embeddingRequest.input)
      ? embeddingRequest.input
      : [embeddingRequest.input];

    // Estimate tokens
    const estimatedTokens = inputTexts.reduce(
      (sum, text) => sum + estimateTokens(text),
      0
    );

    // Check token limits
    for (const text of inputTexts) {
      const tokens = estimateTokens(text);
      if (tokens > modelMetadata.maxTokens) {
        return errorResponse(
          `Input exceeds maximum token limit (${modelMetadata.maxTokens})`,
          400,
          'INPUT_TOO_LONG'
        );
      }
    }

    // 7. Check quota
    const quotaCheck = await checkWorkspaceQuota(workspaceId, estimatedTokens);
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

    // 8. Generate embeddings
    const embeddingModel = openai.embedding(embeddingRequest.model);

    let result;
    let embeddings: number[][];

    if (inputTexts.length === 1) {
      // Single embedding
      const singleResult = await embed({
        model: embeddingModel,
        value: inputTexts[0],
      });
      embeddings = [singleResult.embedding];
      result = singleResult;
    } else {
      // Multiple embeddings
      const multiResult = await embedMany({
        model: embeddingModel,
        values: inputTexts,
      });
      embeddings = multiResult.embeddings;
      result = multiResult;
    }

    // 9. Calculate usage and cost
    const resultUsage = (result as any).usage;
    const usage: TokenUsage = {
      promptTokens: resultUsage?.tokens || estimatedTokens,
      completionTokens: 0,
      totalTokens: resultUsage?.tokens || estimatedTokens,
    };

    const cost = (usage.totalTokens / 1000) * modelMetadata.costPer1kTokens;

    // 10. Log usage
    await logTokenUsage({
      workspaceId,
      userId: session.user.id,
      model: embeddingRequest.model,
      provider: 'openai',
      endpoint: '/api/ai/embeddings',
      usage,
      cost,
      requestId,
      metadata: {
        ...embeddingRequest.metadata,
        duration: Date.now() - startTime,
        inputCount: inputTexts.length,
        dimensions: modelMetadata.dimensions,
      },
    });

    console.log(
      `[POST /api/ai/embeddings] Request ${requestId} completed in ${Date.now() - startTime}ms`
    );

    // 11. Format response
    return NextResponse.json({
      object: 'list',
      data: embeddings.map((embedding, index) => ({
        object: 'embedding',
        embedding:
          embeddingRequest.encodingFormat === 'base64'
            ? Buffer.from(new Float32Array(embedding).buffer).toString('base64')
            : embedding,
        index,
      })),
      model: embeddingRequest.model,
      usage,
      cost: {
        total: cost,
        per1kTokens: modelMetadata.costPer1kTokens,
      },
      metadata: {
        duration: Date.now() - startTime,
        dimensions: modelMetadata.dimensions,
      },
    });
  } catch (error) {
    console.error('[POST /api/ai/embeddings] Error:', error);

    // Log error
    if (workspaceId && requestId) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          await logTokenUsage({
            workspaceId,
            userId: session.user.id,
            model: 'unknown',
            provider: 'openai',
            endpoint: '/api/ai/embeddings',
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
          '[POST /api/ai/embeddings] Error logging failed:',
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
