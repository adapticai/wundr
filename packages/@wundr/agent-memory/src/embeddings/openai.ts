/**
 * @wundr/agent-memory - OpenAI Embedding Provider
 *
 * Implements the EmbeddingProvider interface for OpenAI's text-embedding-3 family.
 * Supports text-embedding-3-small (1536 dims) and text-embedding-3-large (3072 dims),
 * including Matryoshka dimension reduction.
 *
 * Enhanced with lazy initialization -- the provider validates its configuration
 * eagerly but defers no resources until the first embed call. This keeps
 * process startup lightweight when the provider is created but not immediately used.
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

export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

const MODEL_MAX_TOKENS: Record<string, number> = {
  'text-embedding-3-small': 8191,
  'text-embedding-3-large': 8191,
  'text-embedding-ada-002': 8191,
};

/** Cost per 1M tokens in USD. */
const MODEL_COST_PER_MILLION: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.10,
};

const MAX_BATCH_SIZE = 2048;

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * OpenAI embedding provider.
 *
 * Uses the `/v1/embeddings` endpoint. Supports dimension reduction for
 * text-embedding-3-* models via the `dimensions` parameter.
 *
 * The provider is created synchronously but defers its first API call
 * until `embedText` or `embedBatch` is invoked (lazy initialization).
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai' as const;
  readonly model: string;
  readonly dimensions: number;
  readonly maxBatchSize = MAX_BATCH_SIZE;
  readonly maxInputTokens: number;

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly rateLimiter: RateLimiter;
  private readonly requestedDimensions: number | undefined;
  readonly costTracker: CostTracker;

  /** Whether the first successful call has been made (for lazy-init validation). */
  private initialized = false;

  constructor(config: {
    model: string;
    dimensions?: number;
    apiKey: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    rateLimit?: Partial<RateLimitConfig>;
  }) {
    this.model = normalizeModel(config.model);
    this.requestedDimensions = config.dimensions;
    this.dimensions = config.dimensions ?? MODEL_DIMENSIONS[this.model] ?? 1536;
    this.maxInputTokens = MODEL_MAX_TOKENS[this.model] ?? 8191;
    this.baseUrl = (config.baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...config.headers,
    };
    this.rateLimiter = new RateLimiter({
      ...PROVIDER_RATE_LIMITS.openai,
      ...config.rateLimit,
    });
    this.costTracker = createCostTracker();
  }

  async embedText(text: string, _options?: EmbedOptions): Promise<EmbeddingResult> {
    const results = await this.callApi([text]);
    return results[0]!;
  }

  async embedBatch(texts: string[], _options?: EmbedOptions): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // Split into sub-batches if needed
    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const batchResults = await this.callApi(batch);
      results.push(...batchResults);
    }

    return results;
  }

  async dispose(): Promise<void> {
    // No persistent resources to clean up for HTTP-based provider.
    this.initialized = false;
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private async callApi(input: string[]): Promise<EmbeddingResult[]> {
    const totalTokens = input.reduce((sum, text) => sum + estimateTokens(text), 0);

    // Rate limit check with retry
    const maxRetries = PROVIDER_RATE_LIMITS.openai.maxRetries;
    let attempt = 0;
    let retrying = true;

    while (retrying) {
      const delay = this.rateLimiter.check(totalTokens);
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        const url = `${this.baseUrl}/embeddings`;
        const body: Record<string, unknown> = {
          model: this.model,
          input,
        };

        // Only send dimensions if explicitly configured and model supports it
        if (this.requestedDimensions !== undefined) {
          body['dimensions'] = this.requestedDimensions;
        }

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
              PROVIDER_RATE_LIMITS.openai.baseRetryDelayMs,
              PROVIDER_RATE_LIMITS.openai.maxRetryDelayMs,
            );
            await sleep(retryDelay);
            continue;
          }

          throw new Error(`OpenAI embeddings failed: ${res.status} ${errorText}`);
        }

        const payload = (await res.json()) as {
          data?: Array<{ embedding?: number[]; index?: number }>;
          usage?: { prompt_tokens?: number; total_tokens?: number };
        };

        const data = payload.data ?? [];
        const usageTokens = payload.usage?.total_tokens ?? totalTokens;

        // Track cost
        this.rateLimiter.record(usageTokens);
        this.costTracker.totalTokens += usageTokens;
        this.costTracker.totalRequests += 1;
        const costPerMillion = MODEL_COST_PER_MILLION[this.model] ?? 0.02;
        this.costTracker.estimatedCostUsd += (usageTokens / 1_000_000) * costPerMillion;

        // Map results back in input order (API may return out of order)
        const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        this.initialized = true;
        retrying = false;

        return sorted.map((entry, idx) => ({
          embedding: normalizeEmbedding(entry.embedding ?? []),
          tokenCount: estimateTokens(input[idx] ?? ''),
        }));
      } catch (err) {
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          const retryDelay = backoffDelay(
            attempt,
            PROVIDER_RATE_LIMITS.openai.baseRetryDelayMs,
            PROVIDER_RATE_LIMITS.openai.maxRetryDelayMs,
          );
          await sleep(retryDelay);
          continue;
        }
        throw err;
      }
    }

    // Unreachable, but satisfies TypeScript return type
    throw new Error('OpenAI embeddings: unexpected loop exit');
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an OpenAI embedding provider from the standard config.
 *
 * Resolves the API key from config or environment variables in this order:
 * 1. `config.apiKey`
 * 2. `OPENAI_API_KEY` environment variable
 */
export function createOpenAIProvider(
  config: EmbeddingProviderConfig,
): OpenAIEmbeddingProvider {
  const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'No API key found for OpenAI embeddings. ' +
        'Set the OPENAI_API_KEY environment variable or pass apiKey in config.',
    );
  }

  return new OpenAIEmbeddingProvider({
    model: config.model ?? DEFAULT_OPENAI_EMBEDDING_MODEL,
    dimensions: config.dimensions,
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
    return DEFAULT_OPENAI_EMBEDDING_MODEL;
  }
  if (trimmed.startsWith('openai/')) {
    return trimmed.slice('openai/'.length);
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
