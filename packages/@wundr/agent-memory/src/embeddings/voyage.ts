/**
 * @wundr/agent-memory - Voyage AI Embedding Provider
 *
 * Implements the EmbeddingProvider interface for Voyage AI's embedding models.
 * Supports voyage-3-large, voyage-3-lite, voyage-code-3, and voyage-finance-2.
 *
 * Voyage distinguishes between query and document embeddings via the `input_type`
 * parameter, which improves retrieval quality.
 */

import {
  type CostTracker,
  type EmbedOptions,
  type EmbeddingProvider,
  type EmbeddingProviderConfig,
  type EmbeddingResult,
  type RateLimitConfig,
  PROVIDER_RATE_LIMITS,
  RateLimiter,
  backoffDelay,
  createCostTracker,
  estimateTokens,
  normalizeEmbedding,
  sleep,
} from './provider';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_VOYAGE_EMBEDDING_MODEL = 'voyage-3-large';
const DEFAULT_VOYAGE_BASE_URL = 'https://api.voyageai.com/v1';

const MODEL_DIMENSIONS: Record<string, number> = {
  'voyage-3-large': 1024,
  'voyage-3-lite': 512,
  'voyage-code-3': 1024,
  'voyage-finance-2': 1024,
  'voyage-4-large': 1024,
};

const MODEL_MAX_TOKENS: Record<string, number> = {
  'voyage-3-large': 32000,
  'voyage-3-lite': 32000,
  'voyage-code-3': 32000,
  'voyage-finance-2': 32000,
  'voyage-4-large': 32000,
};

/** Cost per 1M tokens in USD. */
const MODEL_COST_PER_MILLION: Record<string, number> = {
  'voyage-3-large': 0.06,
  'voyage-3-lite': 0.02,
  'voyage-code-3': 0.06,
  'voyage-finance-2': 0.12,
  'voyage-4-large': 0.06,
};

/** Voyage supports up to 128 texts per batch request. */
const MAX_BATCH_SIZE = 128;

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * Voyage AI embedding provider.
 *
 * Uses the `/v1/embeddings` endpoint with `input_type` differentiation
 * for queries vs documents, which improves retrieval accuracy.
 */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'voyage' as const;
  readonly model: string;
  readonly dimensions: number;
  readonly maxBatchSize = MAX_BATCH_SIZE;
  readonly maxInputTokens: number;

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly rateLimiter: RateLimiter;
  readonly costTracker: CostTracker;

  constructor(config: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    rateLimit?: Partial<RateLimitConfig>;
  }) {
    this.model = normalizeModel(config.model);
    this.dimensions = MODEL_DIMENSIONS[this.model] ?? 1024;
    this.maxInputTokens = MODEL_MAX_TOKENS[this.model] ?? 32000;
    this.baseUrl = (config.baseUrl ?? DEFAULT_VOYAGE_BASE_URL).replace(/\/+$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...config.headers,
    };
    this.rateLimiter = new RateLimiter({
      ...PROVIDER_RATE_LIMITS.voyage,
      ...config.rateLimit,
    });
    this.costTracker = createCostTracker();
  }

  async embedText(text: string, options?: EmbedOptions): Promise<EmbeddingResult> {
    const inputType = options?.taskType === 'document' ? 'document' : 'query';
    const results = await this.callApi([text], inputType);
    return results[0]!;
  }

  async embedBatch(texts: string[], options?: EmbedOptions): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const inputType = options?.taskType === 'query' ? 'query' : 'document';
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const batchResults = await this.callApi(batch, inputType);
      results.push(...batchResults);
    }

    return results;
  }

  async dispose(): Promise<void> {
    // No persistent resources to clean up.
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private async callApi(
    input: string[],
    inputType: 'query' | 'document',
  ): Promise<EmbeddingResult[]> {
    const totalTokens = input.reduce((sum, text) => sum + estimateTokens(text), 0);
    const maxRetries = PROVIDER_RATE_LIMITS.voyage.maxRetries;
    let attempt = 0;

    while (true) {
      const delay = this.rateLimiter.check(totalTokens);
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        const url = `${this.baseUrl}/embeddings`;
        const body: Record<string, unknown> = {
          model: this.model,
          input,
          input_type: inputType,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorText = await res.text();

          if (isRateLimitError(res.status, errorText) && attempt < maxRetries) {
            attempt++;
            const retryDelay = backoffDelay(
              attempt,
              PROVIDER_RATE_LIMITS.voyage.baseRetryDelayMs,
              PROVIDER_RATE_LIMITS.voyage.maxRetryDelayMs,
            );
            await sleep(retryDelay);
            continue;
          }

          throw new Error(`Voyage embeddings failed: ${res.status} ${errorText}`);
        }

        const payload = (await res.json()) as {
          data?: Array<{ embedding?: number[]; index?: number }>;
          usage?: { total_tokens?: number };
        };

        const data = payload.data ?? [];
        const usageTokens = payload.usage?.total_tokens ?? totalTokens;

        // Track cost and rate
        this.rateLimiter.record(usageTokens);
        this.costTracker.totalTokens += usageTokens;
        this.costTracker.totalRequests += 1;
        const costPerMillion = MODEL_COST_PER_MILLION[this.model] ?? 0.06;
        this.costTracker.estimatedCostUsd += (usageTokens / 1_000_000) * costPerMillion;

        // Sort by index to ensure correct order
        const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        return sorted.map((entry, idx) => ({
          embedding: normalizeEmbedding(entry.embedding ?? []),
          tokenCount: estimateTokens(input[idx] ?? ''),
        }));
      } catch (err) {
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          const retryDelay = backoffDelay(
            attempt,
            PROVIDER_RATE_LIMITS.voyage.baseRetryDelayMs,
            PROVIDER_RATE_LIMITS.voyage.maxRetryDelayMs,
          );
          await sleep(retryDelay);
          continue;
        }
        throw err;
      }
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a Voyage AI embedding provider from the standard config.
 *
 * Resolves the API key from config or environment variables:
 * 1. `config.apiKey`
 * 2. `VOYAGE_API_KEY` environment variable
 */
export function createVoyageProvider(
  config: EmbeddingProviderConfig,
): VoyageEmbeddingProvider {
  const apiKey = config.apiKey ?? process.env['VOYAGE_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'No API key found for Voyage embeddings. ' +
        'Set the VOYAGE_API_KEY environment variable or pass apiKey in config.',
    );
  }

  return new VoyageEmbeddingProvider({
    model: config.model ?? DEFAULT_VOYAGE_EMBEDDING_MODEL,
    apiKey,
    baseUrl: config.baseUrl,
    headers: config.headers,
    rateLimit: config.rateLimit,
  });
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_VOYAGE_EMBEDDING_MODEL;
  }
  if (trimmed.startsWith('voyage/')) {
    return trimmed.slice('voyage/'.length);
  }
  return trimmed;
}

function isRateLimitError(status: number, body: string): boolean {
  return status === 429 || /rate.?limit|too many requests/i.test(body);
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /(rate.?limit|too many requests|429|5\d\d|cloudflare|timeout|econnreset)/i.test(message);
}
