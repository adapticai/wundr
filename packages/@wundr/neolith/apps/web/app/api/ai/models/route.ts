/**
 * AI Models API Route
 *
 * List available AI models with metadata, capabilities, and pricing.
 * Helps clients discover supported models and their features.
 *
 * Routes:
 * - GET /api/ai/models - List all available models
 * - GET /api/ai/models?provider=openai - List models for specific provider
 *
 * @module app/api/ai/models/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  AVAILABLE_MODELS,
  getDefaultProvider,
  getProviderModels,
  type AIProvider,
  type ModelMetadata,
} from '@/lib/ai/providers';

/**
 * Model response format
 */
interface ModelResponse extends ModelMetadata {
  id: string;
  available: boolean;
  isDefault: boolean;
}

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
        code: code || `AI_MODELS_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Check if provider is configured
 */
function isProviderConfigured(provider: AIProvider): boolean {
  const keys: Record<AIProvider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };
  return !!keys[provider];
}

/**
 * GET /api/ai/models
 *
 * List available AI models with metadata
 *
 * @param request - Next.js request with optional provider query param
 * @returns List of available models
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // 2. Parse query parameters
    const url = new URL(request.url);
    const providerParam = url.searchParams.get('provider');
    const includeUnavailable =
      url.searchParams.get('includeUnavailable') === 'true';

    // Validate provider if specified
    let filterProvider: AIProvider | null = null;
    if (providerParam) {
      if (
        providerParam !== 'openai' &&
        providerParam !== 'anthropic' &&
        providerParam !== 'deepseek'
      ) {
        return errorResponse(
          `Invalid provider: ${providerParam}. Must be one of: openai, anthropic, deepseek`,
          400,
          'INVALID_PROVIDER'
        );
      }
      filterProvider = providerParam;
    }

    // 3. Get default provider
    const defaultProvider = getDefaultProvider();

    // 4. Build models list
    const models: ModelResponse[] = [];

    for (const [modelId, metadata] of Object.entries(AVAILABLE_MODELS)) {
      const typedMetadata = metadata as ModelMetadata;

      // Filter by provider if specified
      if (filterProvider && typedMetadata.provider !== filterProvider) {
        continue;
      }

      // Check if provider is configured
      const available = isProviderConfigured(typedMetadata.provider);

      // Skip unavailable models unless requested
      if (!available && !includeUnavailable) {
        continue;
      }

      // Check if this is the default model for its provider
      const isDefault =
        typedMetadata.provider === defaultProvider &&
        getProviderModels(typedMetadata.provider)[0]?.name ===
          typedMetadata.name;

      models.push({
        id: modelId,
        ...typedMetadata,
        available,
        isDefault,
      });
    }

    // 5. Sort models by provider and name
    models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.name.localeCompare(b.name);
    });

    // 6. Group by provider
    const groupedByProvider: Record<string, ModelResponse[]> = {};
    for (const model of models) {
      if (!groupedByProvider[model.provider]) {
        groupedByProvider[model.provider] = [];
      }
      groupedByProvider[model.provider].push(model);
    }

    console.log(
      `[GET /api/ai/models] Listed ${models.length} models${filterProvider ? ` for ${filterProvider}` : ''}`
    );

    return NextResponse.json({
      object: 'list',
      data: models,
      byProvider: groupedByProvider,
      meta: {
        totalCount: models.length,
        defaultProvider,
        providers: {
          openai: {
            configured: isProviderConfigured('openai'),
            modelCount: groupedByProvider.openai?.length || 0,
          },
          anthropic: {
            configured: isProviderConfigured('anthropic'),
            modelCount: groupedByProvider.anthropic?.length || 0,
          },
          deepseek: {
            configured: isProviderConfigured('deepseek'),
            modelCount: groupedByProvider.deepseek?.length || 0,
          },
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/models] Error:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
