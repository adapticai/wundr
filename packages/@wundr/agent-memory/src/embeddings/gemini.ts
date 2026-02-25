/**
 * @wundr/agent-memory - Google Gemini Embedding Provider
 *
 * Implements the EmbeddingProvider interface for Google's Gemini embedding models.
 * Supports gemini-embedding-001 with native batch embedding via `batchEmbedContents`.
 *
 * Gemini uses task-type hints (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT) to optimize
 * embeddings for different use cases.
 *
 * Enhanced with lazy initialization -- the provider validates its configuration
 * eagerly but defers no resources until the first embed call.
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

export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';

const MODEL_DIMENSIONS: Record<string, number> = {
  'gemini-embedding-001': 768,
  'text-embedding-004': 768,
};

const MODEL_MAX_TOKENS: Record<string, number> = {
  'gemini-embedding-001': 2048,
  'text-embedding-004': 2048,
};

/** Cost per 1M tokens in USD. */
const MODEL_COST_PER_MILLION: Record<string, number> = {
  'gemini-embedding-001': 0.0, // Free tier available
  'text-embedding-004': 0.0,
};

/**
 * Gemini's batchEmbedContents supports up to 100 requests per call.
 */
const MAX_BATCH_SIZE = 100;

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * Google Gemini embedding provider.
 *
 * Uses the REST API for embeddings:
 * - Single: `POST /v1beta/models/{model}:embedContent`
 * - Batch:  `POST /v1beta/models/{model}:batchEmbedContents`
 *
 * Created synchronously; first API call is deferred until embedText/embedBatch.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'gemini' as const;
  readonly model: string;
  readonly dimensions: number;
  readonly maxBatchSize = MAX_BATCH_SIZE;
  readonly maxInputTokens: number;

  private readonly baseUrl: string;
  private readonly modelPath: string;
  private readonly headers: Record<string, string>;
  private readonly rateLimiter: RateLimiter;
  readonly costTracker: CostTracker;

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
    this.modelPath = buildModelPath(this.model);
    this.dimensions = config.dimensions ?? MODEL_DIMENSIONS[this.model] ?? 768;
    this.maxInputTokens = MODEL_MAX_TOKENS[this.model] ?? 2048;
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_GEMINI_BASE_URL);
    this.headers = {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
      ...config.headers,
    };
    this.rateLimiter = new RateLimiter({
      ...PROVIDER_RATE_LIMITS.gemini,
      ...config.rateLimit,
    });
    this.costTracker = createCostTracker();
  }

  async embedText(
    text: string,
    options?: EmbedOptions
  ): Promise<EmbeddingResult> {
    const taskType =
      options?.taskType === 'document'
        ? 'RETRIEVAL_DOCUMENT'
        : 'RETRIEVAL_QUERY';
    return this.callSingleApi(text, taskType);
  }

  async embedBatch(
    texts: string[],
    options?: EmbedOptions
  ): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const taskType =
      options?.taskType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const batchResults = await this.callBatchApi(batch, taskType);
      results.push(...batchResults);
    }

    return results;
  }

  async dispose(): Promise<void> {
    // No persistent resources to clean up.
    this.initialized = false;
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private async callSingleApi(
    text: string,
    taskType: string
  ): Promise<EmbeddingResult> {
    const tokenCount = estimateTokens(text);
    const maxRetries = PROVIDER_RATE_LIMITS.gemini.maxRetries;
    let attempt = 0;
    let retrying = true;

    while (retrying) {
      const delay = this.rateLimiter.check(tokenCount);
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        const url = `${this.baseUrl}/${this.modelPath}:embedContent`;
        const body = {
          content: { parts: [{ text }] },
          taskType,
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
              PROVIDER_RATE_LIMITS.gemini.baseRetryDelayMs,
              PROVIDER_RATE_LIMITS.gemini.maxRetryDelayMs
            );
            await sleep(retryDelay);
            continue;
          }

          throw new Error(
            `Gemini embeddings failed: ${res.status} ${errorText}`
          );
        }

        const payload = (await res.json()) as {
          embedding?: { values?: number[] };
        };

        this.rateLimiter.record(tokenCount);
        this.costTracker.totalTokens += tokenCount;
        this.costTracker.totalRequests += 1;
        const costPerMillion = MODEL_COST_PER_MILLION[this.model] ?? 0;
        this.costTracker.estimatedCostUsd +=
          (tokenCount / 1_000_000) * costPerMillion;

        this.initialized = true;
        retrying = false;

        return {
          embedding: normalizeEmbedding(payload.embedding?.values ?? []),
          tokenCount,
        };
      } catch (err) {
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          const retryDelay = backoffDelay(
            attempt,
            PROVIDER_RATE_LIMITS.gemini.baseRetryDelayMs,
            PROVIDER_RATE_LIMITS.gemini.maxRetryDelayMs
          );
          await sleep(retryDelay);
          continue;
        }
        throw err;
      }
    }

    // Unreachable, but satisfies TypeScript return type
    throw new Error('Gemini embeddings: unexpected loop exit');
  }

  private async callBatchApi(
    texts: string[],
    taskType: string
  ): Promise<EmbeddingResult[]> {
    const totalTokens = texts.reduce(
      (sum, text) => sum + estimateTokens(text),
      0
    );
    const maxRetries = PROVIDER_RATE_LIMITS.gemini.maxRetries;
    let attempt = 0;
    let retrying = true;

    while (retrying) {
      const delay = this.rateLimiter.check(totalTokens);
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        const url = `${this.baseUrl}/${this.modelPath}:batchEmbedContents`;
        const requests = texts.map(text => ({
          model: this.modelPath,
          content: { parts: [{ text }] },
          taskType,
        }));

        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ requests }),
        });

        if (!res.ok) {
          const errorText = await res.text();

          if (isRateLimitError(res.status, errorText) && attempt < maxRetries) {
            attempt++;
            const retryDelay = backoffDelay(
              attempt,
              PROVIDER_RATE_LIMITS.gemini.baseRetryDelayMs,
              PROVIDER_RATE_LIMITS.gemini.maxRetryDelayMs
            );
            await sleep(retryDelay);
            continue;
          }

          throw new Error(
            `Gemini batch embeddings failed: ${res.status} ${errorText}`
          );
        }

        const payload = (await res.json()) as {
          embeddings?: Array<{ values?: number[] }>;
        };

        const embeddings = Array.isArray(payload.embeddings)
          ? payload.embeddings
          : [];

        this.rateLimiter.record(totalTokens);
        this.costTracker.totalTokens += totalTokens;
        this.costTracker.totalRequests += 1;
        const costPerMillion = MODEL_COST_PER_MILLION[this.model] ?? 0;
        this.costTracker.estimatedCostUsd +=
          (totalTokens / 1_000_000) * costPerMillion;

        this.initialized = true;
        retrying = false;

        return texts.map((text, idx) => ({
          embedding: normalizeEmbedding(embeddings[idx]?.values ?? []),
          tokenCount: estimateTokens(text),
        }));
      } catch (err) {
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          const retryDelay = backoffDelay(
            attempt,
            PROVIDER_RATE_LIMITS.gemini.baseRetryDelayMs,
            PROVIDER_RATE_LIMITS.gemini.maxRetryDelayMs
          );
          await sleep(retryDelay);
          continue;
        }
        throw err;
      }
    }

    // Unreachable, but satisfies TypeScript return type
    throw new Error('Gemini batch embeddings: unexpected loop exit');
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a Gemini embedding provider from the standard config.
 *
 * Resolves the API key from config or environment variables:
 * 1. `config.apiKey`
 * 2. `GOOGLE_API_KEY` environment variable
 * 3. `GEMINI_API_KEY` environment variable
 */
export function createGeminiProvider(
  config: EmbeddingProviderConfig
): GeminiEmbeddingProvider {
  const apiKey =
    config.apiKey ??
    process.env['GOOGLE_API_KEY'] ??
    process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'No API key found for Gemini embeddings. ' +
        'Set the GOOGLE_API_KEY or GEMINI_API_KEY environment variable or pass apiKey in config.'
    );
  }

  return new GeminiEmbeddingProvider({
    model: config.model ?? DEFAULT_GEMINI_EMBEDDING_MODEL,
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
    return DEFAULT_GEMINI_EMBEDDING_MODEL;
  }
  // Strip prefix variations
  const withoutModelsPrefix = trimmed.replace(/^models\//, '');
  if (withoutModelsPrefix.startsWith('gemini/')) {
    return withoutModelsPrefix.slice('gemini/'.length);
  }
  if (withoutModelsPrefix.startsWith('google/')) {
    return withoutModelsPrefix.slice('google/'.length);
  }
  return withoutModelsPrefix;
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  // Strip /openai suffix if present (some configs include it)
  const openAiIndex = trimmed.indexOf('/openai');
  if (openAiIndex > -1) {
    return trimmed.slice(0, openAiIndex);
  }
  return trimmed;
}

function buildModelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`;
}

function isRateLimitError(status: number, body: string): boolean {
  return (
    status === 429 ||
    /rate.?limit|too many requests|resource has been exhausted/i.test(body)
  );
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /(rate.?limit|too many requests|429|resource has been exhausted|5\d\d|cloudflare|timeout|econnreset)/i.test(
    message
  );
}
