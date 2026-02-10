/**
 * @wundr/agent-memory - Embedding Providers Index
 *
 * Factory module that creates the appropriate embedding provider based on
 * configuration. Implements auto-detection, fallback chains, orchestrated
 * caching, health monitoring, chunking, and benchmarking.
 *
 * @example
 * ```typescript
 * import { createEmbeddingProvider } from '@wundr/agent-memory/embeddings';
 *
 * // Auto-detect the best available provider
 * const result = await createEmbeddingProvider({ provider: 'auto' });
 * const embedding = await result.provider.embedText('Hello, world!');
 *
 * // Use a specific provider with fallback
 * const result2 = await createEmbeddingProvider({
 *   provider: 'openai',
 *   model: 'text-embedding-3-large',
 *   dimensions: 1024,
 *   fallback: 'gemini',
 * });
 *
 * // Create an orchestrated provider with caching, failover, chunking
 * const orchestrator = createEmbeddingOrchestrator({
 *   primary: { provider: 'openai' },
 *   cache: { enabled: true, maxEntries: 10000 },
 *   chunking: { strategy: 'sliding-window', chunkSize: 512, overlap: 64 },
 *   failoverChain: ['gemini', 'voyage'],
 *   onProgress: (p) => console.log(`${p.fraction * 100}% complete`),
 * });
 * ```
 */

// Re-export the interface and shared types
export {
  type EmbeddingProvider,
  type EmbeddingResult,
  type EmbedOptions,
  type EmbeddingProviderId,
  type EmbeddingProviderConfig,
  type EmbeddingProviderResult,
  type RateLimitConfig,
  type CostTracker,
  type BatchProgress,
  type BatchProgressCallback,
  type EmbeddingCacheConfig,
  type ChunkingConfig,
  type ChunkingStrategy,
  type HealthMonitorConfig,
  type ProviderHealthSnapshot,
  type BenchmarkResult,
  normalizeEmbedding,
  validateDimensions,
  cosineSimilarity,
  estimateTokens,
  computeCacheKey,
  createCostTracker,
  RateLimiter,
  DEFAULT_RATE_LIMIT,
  PROVIDER_RATE_LIMITS,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
  DEFAULT_HEALTH_MONITOR_CONFIG,
  DEFAULT_CHUNKING_CONFIG,
} from './provider';

// Re-export provider implementations
export { OpenAIEmbeddingProvider, createOpenAIProvider, DEFAULT_OPENAI_EMBEDDING_MODEL } from './openai';
export { VoyageEmbeddingProvider, createVoyageProvider, DEFAULT_VOYAGE_EMBEDDING_MODEL } from './voyage';
export { GeminiEmbeddingProvider, createGeminiProvider, DEFAULT_GEMINI_EMBEDDING_MODEL } from './gemini';
export { LocalEmbeddingProvider, createLocalProvider, DEFAULT_TRANSFORMERS_MODEL } from './local';

// Re-export cache module
export { InMemoryEmbeddingCache, type InMemoryCacheStats } from './cache';

// Re-export health monitor
export { HealthMonitor } from './health';

// Re-export chunking utilities
export { chunkText, meanPoolEmbeddings, type TextChunk } from './chunking';

// Re-export orchestrator
export {
  EmbeddingOrchestrator,
  type OrchestratorConfig,
  type OrchestratorStatus,
  type ProviderFactory,
} from './orchestrator';

// Internal imports for the factory
import type {
  EmbeddingProvider,
  EmbeddingProviderId,
  EmbeddingProviderConfig,
  EmbeddingProviderResult,
} from './provider';
import { createCostTracker } from './provider';
import { createOpenAIProvider } from './openai';
import { createVoyageProvider } from './voyage';
import { createGeminiProvider } from './gemini';
import { createLocalProvider } from './local';
import { EmbeddingOrchestrator, type OrchestratorConfig } from './orchestrator';

// ============================================================================
// Auto-detection Priority
// ============================================================================

/**
 * Order in which providers are tried during auto-detection.
 * Local is tried first (if a model file exists), then remote providers
 * in order of cost-effectiveness.
 */
const AUTO_DETECTION_ORDER: EmbeddingProviderId[] = [
  'local',
  'openai',
  'gemini',
  'voyage',
];

// ============================================================================
// Provider Factory (used by the orchestrator)
// ============================================================================

/**
 * Synchronous factory that creates a raw provider from config.
 * This is the function the orchestrator calls to create providers.
 */
function rawProviderFactory(config: EmbeddingProviderConfig): EmbeddingProvider {
  const id = config.provider === 'auto' ? detectBestProvider(config) : config.provider;
  switch (id) {
    case 'openai':
      return createOpenAIProvider(config);
    case 'voyage':
      return createVoyageProvider(config);
    case 'gemini':
      return createGeminiProvider(config);
    case 'local':
      return createLocalProvider(config);
  }
}

/**
 * Detect the best available provider based on environment.
 */
function detectBestProvider(config: EmbeddingProviderConfig): EmbeddingProviderId {
  // Local if explicitly configured
  if (config.local?.modelPath) {
    return 'local';
  }
  if (config.apiKey || process.env['OPENAI_API_KEY']) {
    return 'openai';
  }
  if (process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']) {
    return 'gemini';
  }
  if (process.env['VOYAGE_API_KEY']) {
    return 'voyage';
  }
  return 'local';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an embedding provider based on configuration.
 *
 * When `provider` is `"auto"`, the factory tries providers in this order:
 * 1. **local** - if a model file path is configured and exists
 * 2. **openai** - if OPENAI_API_KEY is available
 * 3. **gemini** - if GOOGLE_API_KEY or GEMINI_API_KEY is available
 * 4. **voyage** - if VOYAGE_API_KEY is available
 *
 * If the primary provider fails and a `fallback` is configured, the factory
 * will try the fallback provider before throwing.
 *
 * @param config - Provider configuration
 * @returns The resolved provider, metadata about fallback, and a cost tracker
 */
export async function createEmbeddingProvider(
  config: EmbeddingProviderConfig,
): Promise<EmbeddingProviderResult> {
  const requestedProvider = config.provider;
  const fallback = config.fallback ?? 'none';

  // Helper to create a specific provider
  const create = (id: EmbeddingProviderId): EmbeddingProvider => {
    switch (id) {
      case 'openai':
        return createOpenAIProvider(config);
      case 'voyage':
        return createVoyageProvider(config);
      case 'gemini':
        return createGeminiProvider(config);
      case 'local':
        return createLocalProvider(config);
    }
  };

  const getCostTracker = (provider: EmbeddingProvider) => {
    return (provider as { costTracker?: ReturnType<typeof createCostTracker> }).costTracker ?? createCostTracker();
  };

  // -- Auto-detection mode --------------------------------------------------

  if (requestedProvider === 'auto') {
    const errors: string[] = [];

    for (const providerId of AUTO_DETECTION_ORDER) {
      try {
        const provider = create(providerId);
        return {
          provider,
          requestedProvider,
          costTracker: getCostTracker(provider),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${providerId}: ${message}`);
        continue;
      }
    }

    throw new Error(
      'No embedding provider available.\n\n' +
        'Tried the following providers:\n' +
        errors.map((e) => `  - ${e}`).join('\n') +
        '\n\nTo fix this, either:\n' +
        '  1. Set an API key (OPENAI_API_KEY, GOOGLE_API_KEY, or VOYAGE_API_KEY)\n' +
        '  2. Install @huggingface/transformers for local embeddings\n' +
        '  3. Specify a provider explicitly in your config',
    );
  }

  // -- Explicit provider mode -----------------------------------------------

  try {
    const provider = create(requestedProvider);
    return {
      provider,
      requestedProvider,
      costTracker: getCostTracker(provider),
    };
  } catch (primaryErr) {
    const reason = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

    // Try fallback if configured
    if (fallback !== 'none' && fallback !== requestedProvider) {
      try {
        const fallbackProvider = create(fallback);
        return {
          provider: fallbackProvider,
          requestedProvider,
          fallbackFrom: requestedProvider,
          fallbackReason: reason,
          costTracker: getCostTracker(fallbackProvider),
        };
      } catch (fallbackErr) {
        const fallbackReason =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new Error(
          `Primary provider "${requestedProvider}" failed: ${reason}\n\n` +
            `Fallback to "${fallback}" also failed: ${fallbackReason}`,
        );
      }
    }

    throw new Error(`Embedding provider "${requestedProvider}" failed: ${reason}`);
  }
}

/**
 * Create an EmbeddingOrchestrator with full caching, failover, health
 * monitoring, chunking, and progress tracking.
 *
 * This is the recommended entry point for production use. The orchestrator
 * implements the `EmbeddingProvider` interface, so it can be used as a
 * drop-in replacement for any raw provider.
 *
 * @param config - Orchestrator configuration
 * @returns An EmbeddingOrchestrator instance
 *
 * @example
 * ```typescript
 * const orchestrator = createEmbeddingOrchestrator({
 *   primary: {
 *     provider: 'openai',
 *     model: 'text-embedding-3-small',
 *   },
 *   cache: { enabled: true, maxEntries: 10000 },
 *   chunking: { strategy: 'sentence', maxSentences: 5 },
 *   failoverChain: ['gemini', 'voyage'],
 *   healthMonitor: { enabled: true },
 *   onProgress: (p) => console.log(`${Math.round(p.fraction * 100)}%`),
 * });
 *
 * // Use like any EmbeddingProvider
 * const result = await orchestrator.embedText('Hello');
 * const batch = await orchestrator.embedBatch(['A', 'B', 'C']);
 *
 * // Orchestrator-specific features
 * const status = orchestrator.getStatus();
 * const benchmarks = await orchestrator.benchmark();
 *
 * // Cleanup
 * await orchestrator.dispose();
 * ```
 */
export function createEmbeddingOrchestrator(
  config: OrchestratorConfig,
): EmbeddingOrchestrator {
  return new EmbeddingOrchestrator(config, rawProviderFactory);
}
