/**
 * @wundr/agent-memory - Embedding Provider Interface
 *
 * Defines the uniform contract that all embedding providers must implement.
 * Includes shared types for configuration, results, rate limiting, and cost tracking.
 */

// ============================================================================
// Core Provider Interface
// ============================================================================

/**
 * Result of a single embedding operation.
 */
export interface EmbeddingResult {
  /** The embedding vector (L2-normalized). */
  embedding: number[];
  /** Estimated token count consumed by this input. */
  tokenCount: number;
}

/**
 * Uniform interface for all embedding providers.
 *
 * Every provider -- whether remote API or local model -- implements this
 * contract so the memory system never couples to a specific backend.
 */
export interface EmbeddingProvider {
  /** Provider identifier (e.g. "openai", "voyage", "gemini", "local"). */
  readonly id: EmbeddingProviderId;
  /** Model name used for embeddings. */
  readonly model: string;
  /** Output embedding dimensionality. */
  readonly dimensions: number;
  /** Maximum texts per single batch call. */
  readonly maxBatchSize: number;
  /** Maximum input tokens the model accepts per text. */
  readonly maxInputTokens: number;

  /**
   * Embed a single text string.
   *
   * Use this for query-time embedding where latency matters more than throughput.
   * Some providers (e.g. Voyage) use a different task type for queries vs documents.
   */
  embedText(text: string, options?: EmbedOptions): Promise<EmbeddingResult>;

  /**
   * Embed multiple texts in a single request.
   *
   * Use this for indexing/document embedding where throughput matters.
   * Implementations should handle chunking into sub-batches if `texts.length`
   * exceeds `maxBatchSize`.
   */
  embedBatch(texts: string[], options?: EmbedOptions): Promise<EmbeddingResult[]>;

  /**
   * Release any resources held by this provider (model files, connections, etc.).
   */
  dispose(): Promise<void>;
}

// ============================================================================
// Options and Configuration
// ============================================================================

/**
 * Supported provider identifiers.
 */
export type EmbeddingProviderId = 'openai' | 'voyage' | 'gemini' | 'local';

/**
 * Options passed to embed calls.
 */
export interface EmbedOptions {
  /**
   * Hint for query vs document embedding.
   * Providers that support task-type differentiation (Voyage, Gemini)
   * will use this to optimize the embedding.
   */
  taskType?: 'query' | 'document';
}

/**
 * Rate limiting configuration for a provider.
 */
export interface RateLimitConfig {
  /** Maximum requests per minute. 0 means unlimited. */
  maxRequestsPerMinute: number;
  /** Maximum tokens per minute. 0 means unlimited. */
  maxTokensPerMinute: number;
  /** Whether to automatically retry on rate limit responses (429). */
  retryOnRateLimit: boolean;
  /** Maximum retry attempts before throwing. */
  maxRetries: number;
  /** Base delay in ms for exponential backoff. */
  baseRetryDelayMs: number;
  /** Maximum delay in ms for backoff cap. */
  maxRetryDelayMs: number;
}

/**
 * Accumulated cost/usage data for observability.
 */
export interface CostTracker {
  /** Total tokens embedded across all calls. */
  totalTokens: number;
  /** Total API requests made. */
  totalRequests: number;
  /** Estimated cost in USD (provider-specific pricing). */
  estimatedCostUsd: number;
}

/**
 * Full configuration for creating an embedding provider.
 */
export interface EmbeddingProviderConfig {
  /** Which provider to use. "auto" tries them in priority order. */
  provider: EmbeddingProviderId | 'auto';
  /** Model name override. Each provider has a sensible default. */
  model?: string;
  /**
   * Override the output embedding dimensions.
   * Only supported by models with Matryoshka representations (e.g. OpenAI text-embedding-3-*).
   */
  dimensions?: number;
  /** API key. If omitted, the provider reads from environment variables. */
  apiKey?: string;
  /** Base URL override for the API endpoint. */
  baseUrl?: string;
  /** Additional HTTP headers to send with requests. */
  headers?: Record<string, string>;
  /** Rate limiting overrides. */
  rateLimit?: Partial<RateLimitConfig>;
  /** Fallback provider if the primary fails. "none" disables fallback. */
  fallback?: EmbeddingProviderId | 'none';
  /** Configuration specific to the local provider. */
  local?: {
    /** Path to a local GGUF model file. */
    modelPath?: string;
    /** Directory for caching downloaded models. */
    modelCacheDir?: string;
  };
}

/**
 * Result returned by the provider factory.
 */
export interface EmbeddingProviderResult {
  /** The resolved provider instance. */
  provider: EmbeddingProvider;
  /** What was originally requested. */
  requestedProvider: EmbeddingProviderId | 'auto';
  /** If a fallback was used, which provider was the original. */
  fallbackFrom?: EmbeddingProviderId;
  /** Human-readable reason the fallback was activated. */
  fallbackReason?: string;
  /** Cost tracker for the active provider. */
  costTracker: CostTracker;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequestsPerMinute: 3000,
  maxTokensPerMinute: 1_000_000,
  retryOnRateLimit: true,
  maxRetries: 3,
  baseRetryDelayMs: 500,
  maxRetryDelayMs: 8000,
};

/**
 * Provider-specific default rate limits.
 */
export const PROVIDER_RATE_LIMITS: Record<EmbeddingProviderId, RateLimitConfig> = {
  openai: {
    ...DEFAULT_RATE_LIMIT,
    maxRequestsPerMinute: 3000,
    maxTokensPerMinute: 1_000_000,
  },
  voyage: {
    ...DEFAULT_RATE_LIMIT,
    maxRequestsPerMinute: 300,
    maxTokensPerMinute: 1_000_000,
  },
  gemini: {
    ...DEFAULT_RATE_LIMIT,
    maxRequestsPerMinute: 1500,
    maxTokensPerMinute: 1_000_000,
  },
  local: {
    maxRequestsPerMinute: 0,
    maxTokensPerMinute: 0,
    retryOnRateLimit: false,
    maxRetries: 0,
    baseRetryDelayMs: 0,
    maxRetryDelayMs: 0,
  },
};

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * L2-normalize an embedding vector so cosine similarity can be computed
 * as a simple dot product.
 *
 * Replaces non-finite values with 0 before normalizing.
 */
export function normalizeEmbedding(vec: number[]): number[] {
  const sanitized = vec.map((v) => (Number.isFinite(v) ? v : 0));
  const magnitude = Math.sqrt(sanitized.reduce((sum, v) => sum + v * v, 0));
  if (magnitude < 1e-10) {
    return sanitized;
  }
  return sanitized.map((v) => v / magnitude);
}

/**
 * Estimate the token count for a text string.
 * Uses a rough heuristic of ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Create a fresh cost tracker.
 */
export function createCostTracker(): CostTracker {
  return {
    totalTokens: 0,
    totalRequests: 0,
    estimatedCostUsd: 0,
  };
}

/**
 * Simple token-bucket rate limiter.
 *
 * Tracks request and token consumption over a rolling 60-second window
 * and returns a delay (in ms) that the caller should wait before proceeding.
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private requestTimestamps: number[] = [];
  private tokenTimestamps: Array<{ ts: number; tokens: number }> = [];

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check whether a request with `tokenCount` tokens may proceed.
   * Returns the number of milliseconds to wait (0 means go ahead).
   */
  check(tokenCount: number): number {
    if (this.config.maxRequestsPerMinute <= 0 && this.config.maxTokensPerMinute <= 0) {
      return 0;
    }

    const now = Date.now();
    const windowStart = now - 60_000;

    // Prune old entries
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > windowStart);
    this.tokenTimestamps = this.tokenTimestamps.filter((entry) => entry.ts > windowStart);

    let delay = 0;

    // Request rate check
    if (this.config.maxRequestsPerMinute > 0) {
      if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
        const oldest = this.requestTimestamps[0]!;
        delay = Math.max(delay, oldest + 60_000 - now);
      }
    }

    // Token rate check
    if (this.config.maxTokensPerMinute > 0) {
      const tokensInWindow = this.tokenTimestamps.reduce((sum, entry) => sum + entry.tokens, 0);
      if (tokensInWindow + tokenCount > this.config.maxTokensPerMinute) {
        const oldest = this.tokenTimestamps[0];
        if (oldest) {
          delay = Math.max(delay, oldest.ts + 60_000 - now);
        }
      }
    }

    return delay;
  }

  /**
   * Record that a request was made, consuming `tokenCount` tokens.
   */
  record(tokenCount: number): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.tokenTimestamps.push({ ts: now, tokens: tokenCount });
  }
}

/**
 * Wait for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute exponential backoff delay with jitter.
 */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = 1 + Math.random() * 0.2;
  return Math.min(maxMs, Math.round(exponential * jitter));
}
