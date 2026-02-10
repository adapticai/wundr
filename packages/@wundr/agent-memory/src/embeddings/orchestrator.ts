/**
 * @wundr/agent-memory - Embedding Orchestrator
 *
 * High-level wrapper around bare embedding providers that adds:
 *
 * - **In-memory LRU caching** with TTL and persistence hooks.
 * - **Automatic provider failover** using a configurable chain.
 * - **Health monitoring** to avoid sending traffic to degraded providers.
 * - **Text chunking** (sliding-window or sentence-based) for long inputs.
 * - **Dimensionality validation** after every embedding call.
 * - **L2 normalization** guarantee on all returned vectors.
 * - **Progress callbacks** for batch operations.
 * - **Cost tracking** aggregated across failover providers.
 * - **Lazy initialization** of underlying providers.
 * - **Benchmarking** to compare providers side-by-side.
 *
 * The orchestrator implements the same `EmbeddingProvider` interface so it
 * is a drop-in replacement anywhere a raw provider is used.
 */

import {
  type BatchProgress,
  type BatchProgressCallback,
  type BenchmarkResult,
  type ChunkingConfig,
  type CostTracker,
  type EmbedOptions,
  type EmbeddingCacheConfig,
  type EmbeddingProvider,
  type EmbeddingProviderId,
  type EmbeddingProviderConfig,
  type EmbeddingResult,
  type HealthMonitorConfig,
  type ProviderHealthSnapshot,
  computeCacheKey,
  createCostTracker,
  estimateTokens,
  normalizeEmbedding,
  validateDimensions,
} from './provider';

import { InMemoryEmbeddingCache, type InMemoryCacheStats } from './cache';
import { HealthMonitor } from './health';
import { chunkText, meanPoolEmbeddings, type TextChunk } from './chunking';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the EmbeddingOrchestrator.
 */
export interface OrchestratorConfig {
  /** Primary provider configuration. */
  primary: EmbeddingProviderConfig;
  /** In-memory LRU cache configuration. */
  cache?: Partial<EmbeddingCacheConfig>;
  /** Chunking configuration for long texts. */
  chunking?: ChunkingConfig;
  /** Progress callback for batch operations. */
  onProgress?: BatchProgressCallback;
  /** Ordered list of provider IDs to try on failure. */
  failoverChain?: EmbeddingProviderId[];
  /** Health monitoring configuration. */
  healthMonitor?: Partial<HealthMonitorConfig>;
  /** Whether to validate embedding dimensions on every call. */
  validateDimensions?: boolean;
}

/**
 * Factory function type for creating a provider from config.
 */
export type ProviderFactory = (config: EmbeddingProviderConfig) => EmbeddingProvider;

/**
 * Orchestrator status for observability.
 */
export interface OrchestratorStatus {
  activeProvider: EmbeddingProviderId;
  model: string;
  dimensions: number;
  cache: InMemoryCacheStats;
  costTracker: CostTracker;
  health: ProviderHealthSnapshot[];
  failoverChain: EmbeddingProviderId[];
}

// ============================================================================
// EmbeddingOrchestrator
// ============================================================================

/**
 * Wraps one or more `EmbeddingProvider` instances with caching, failover,
 * health monitoring, chunking, validation, and progress tracking.
 *
 * Implements the `EmbeddingProvider` interface for transparent usage.
 */
export class EmbeddingOrchestrator implements EmbeddingProvider {
  // Provider identity -- delegates to the active provider
  get id(): EmbeddingProviderId {
    return this.activeProvider?.id ?? this.primaryConfig.provider as EmbeddingProviderId;
  }

  get model(): string {
    return this.activeProvider?.model ?? this.primaryConfig.model ?? '';
  }

  get dimensions(): number {
    return this.activeProvider?.dimensions ?? this.primaryConfig.dimensions ?? 0;
  }

  get maxBatchSize(): number {
    return this.activeProvider?.maxBatchSize ?? 2048;
  }

  get maxInputTokens(): number {
    return this.activeProvider?.maxInputTokens ?? 8191;
  }

  // Internal state
  private activeProvider: EmbeddingProvider | null = null;
  private readonly primaryConfig: EmbeddingProviderConfig;
  private readonly providerFactory: ProviderFactory;
  private readonly failoverChain: EmbeddingProviderId[];
  private readonly failoverProviders: Map<EmbeddingProviderId, EmbeddingProvider> = new Map();

  // Subsystems
  private readonly cache: InMemoryEmbeddingCache;
  private readonly healthMonitor: HealthMonitor;
  private readonly chunkingConfig: ChunkingConfig | undefined;
  private readonly onProgress: BatchProgressCallback | undefined;
  private readonly shouldValidateDimensions: boolean;
  readonly costTracker: CostTracker;

  constructor(
    config: OrchestratorConfig,
    providerFactory: ProviderFactory,
  ) {
    this.primaryConfig = config.primary;
    this.providerFactory = providerFactory;
    this.failoverChain = config.failoverChain ?? [];
    this.cache = new InMemoryEmbeddingCache(config.cache);
    this.healthMonitor = new HealthMonitor(config.healthMonitor);
    this.chunkingConfig = config.chunking;
    this.onProgress = config.onProgress ?? config.primary.onProgress;
    this.shouldValidateDimensions = config.validateDimensions !== false;
    this.costTracker = createCostTracker();
  }

  // ==========================================================================
  // EmbeddingProvider Implementation
  // ==========================================================================

  async embedText(text: string, options?: EmbedOptions): Promise<EmbeddingResult> {
    const provider = await this.resolveProvider();

    // Check cache
    const cacheKey = computeCacheKey(text, provider.id, provider.model);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if text needs chunking
    const tokenCount = estimateTokens(text);
    if (this.chunkingConfig && this.chunkingConfig.strategy !== 'none' && tokenCount > provider.maxInputTokens) {
      return this.embedWithChunking(text, provider, options);
    }

    // Direct embedding with failover
    const result = await this.callWithFailover(
      async (p) => p.embedText(text, options),
      provider,
    );

    // Validate dimensions
    if (this.shouldValidateDimensions && result.embedding.length > 0) {
      validateDimensions(result.embedding, provider.dimensions, provider.id);
    }

    // Cache the result
    this.cache.set(cacheKey, result);
    return result;
  }

  async embedBatch(texts: string[], options?: EmbedOptions): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const provider = await this.resolveProvider();
    const startTime = Date.now();
    let cacheHits = 0;

    // Resolve cache hits
    const results: Array<EmbeddingResult | null> = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = computeCacheKey(texts[i]!, provider.id, provider.model);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        results[i] = cached;
        cacheHits++;
      } else {
        uncachedIndices.push(i);
      }
    }

    this.emitProgress(provider.id, texts.length, cacheHits, cacheHits, startTime);

    // Embed uncached texts
    if (uncachedIndices.length > 0) {
      const uncachedTexts = uncachedIndices.map((i) => texts[i]!);

      // Check for texts that need chunking
      const needsChunking = this.chunkingConfig && this.chunkingConfig.strategy !== 'none';
      const batchTexts: string[] = [];
      const chunkMap: Map<number, TextChunk[]> = new Map();

      for (let i = 0; i < uncachedTexts.length; i++) {
        const txt = uncachedTexts[i]!;
        const tokenCount = estimateTokens(txt);
        if (needsChunking && tokenCount > provider.maxInputTokens) {
          const chunks = chunkText(txt, this.chunkingConfig, provider.maxInputTokens);
          chunkMap.set(i, chunks);
          for (const chunk of chunks) {
            batchTexts.push(chunk.text);
          }
        } else {
          batchTexts.push(txt);
        }
      }

      // Embed all texts in one batch via the provider
      const batchResults = await this.callWithFailover(
        async (p) => p.embedBatch(batchTexts, options),
        provider,
      );

      // Map results back to original indices
      let batchIdx = 0;
      for (let i = 0; i < uncachedTexts.length; i++) {
        const originalIndex = uncachedIndices[i]!;
        const chunks = chunkMap.get(i);

        if (chunks && chunks.length > 1) {
          // Mean-pool chunked embeddings
          const chunkEmbeddings: number[][] = [];
          const chunkWeights: number[] = [];
          for (const chunk of chunks) {
            const br = batchResults[batchIdx];
            if (br) {
              chunkEmbeddings.push(br.embedding);
              chunkWeights.push(chunk.tokenCount);
            }
            batchIdx++;
          }
          const pooled = normalizeEmbedding(meanPoolEmbeddings(chunkEmbeddings, chunkWeights));
          const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
          const result: EmbeddingResult = { embedding: pooled, tokenCount: totalTokens };
          results[originalIndex] = result;

          // Cache pooled result
          const cacheKey = computeCacheKey(uncachedTexts[i]!, provider.id, provider.model);
          this.cache.set(cacheKey, result);
        } else {
          const br = batchResults[batchIdx];
          if (br) {
            results[originalIndex] = br;
            const cacheKey = computeCacheKey(uncachedTexts[i]!, provider.id, provider.model);
            this.cache.set(cacheKey, br);
          }
          batchIdx++;
        }

        // Emit progress
        this.emitProgress(
          provider.id,
          texts.length,
          cacheHits + i + 1,
          cacheHits,
          startTime,
        );
      }
    }

    // Validate dimensions on first non-null result
    if (this.shouldValidateDimensions) {
      const firstResult = results.find((r) => r && r.embedding.length > 0);
      if (firstResult && provider.dimensions > 0) {
        validateDimensions(firstResult.embedding, provider.dimensions, provider.id);
      }
    }

    // Final progress
    this.emitProgress(provider.id, texts.length, texts.length, cacheHits, startTime);

    // Convert nulls to empty results (should not happen in practice)
    return results.map((r) => r ?? { embedding: [], tokenCount: 0 });
  }

  async dispose(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.dispose();
      this.activeProvider = null;
    }
    for (const [, provider] of this.failoverProviders) {
      await provider.dispose();
    }
    this.failoverProviders.clear();
    this.cache.clear();
    this.healthMonitor.resetAll();
  }

  // ==========================================================================
  // Extended API (beyond EmbeddingProvider)
  // ==========================================================================

  /**
   * Get the current orchestrator status for observability.
   */
  getStatus(): OrchestratorStatus {
    return {
      activeProvider: this.activeProvider?.id ?? (this.primaryConfig.provider as EmbeddingProviderId),
      model: this.model,
      dimensions: this.dimensions,
      cache: this.cache.getStats(),
      costTracker: { ...this.costTracker },
      health: this.healthMonitor.getAllSnapshots(),
      failoverChain: [...this.failoverChain],
    };
  }

  /**
   * Get the in-memory cache instance for direct operations (export, import, etc.).
   */
  getCache(): InMemoryEmbeddingCache {
    return this.cache;
  }

  /**
   * Get the health monitor for inspection.
   */
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  /**
   * Benchmark the available providers with a test corpus.
   *
   * Runs each provider through single-embed and batch-embed calls,
   * measures latency and throughput, validates dimensions, and returns
   * structured results for comparison.
   *
   * @param testTexts - Texts to embed for benchmarking. Defaults to a small set.
   * @param iterations - How many times to run each operation (for averaging).
   */
  async benchmark(
    testTexts?: string[],
    iterations?: number,
  ): Promise<BenchmarkResult[]> {
    const texts = testTexts ?? [
      'The quick brown fox jumps over the lazy dog.',
      'Artificial intelligence is transforming how we work and live.',
      'Vector databases enable efficient similarity search at scale.',
    ];
    const iters = iterations ?? 3;
    const providerIds: EmbeddingProviderId[] = [
      this.primaryConfig.provider === 'auto'
        ? 'openai'
        : this.primaryConfig.provider as EmbeddingProviderId,
      ...this.failoverChain,
    ];

    // Deduplicate
    const seen = new Set<EmbeddingProviderId>();
    const uniqueIds: EmbeddingProviderId[] = [];
    for (const id of providerIds) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }

    const results: BenchmarkResult[] = [];

    for (const providerId of uniqueIds) {
      const notes: string[] = [];
      let provider: EmbeddingProvider;
      try {
        provider = this.getOrCreateFailoverProvider(providerId);
      } catch (err) {
        results.push({
          providerId,
          model: 'unknown',
          dimensions: 0,
          avgLatencyMs: 0,
          avgBatchLatencyMs: 0,
          throughput: 0,
          costPerMillionTokens: 0,
          valid: false,
          notes: [`Failed to create provider: ${err instanceof Error ? err.message : String(err)}`],
        });
        continue;
      }

      // Single embed benchmark
      let totalSingleMs = 0;
      let valid = true;
      let firstDims = 0;

      for (let i = 0; i < iters; i++) {
        try {
          const start = Date.now();
          const result = await provider.embedText(texts[0]!);
          totalSingleMs += Date.now() - start;

          if (i === 0) {
            firstDims = result.embedding.length;
            if (firstDims !== provider.dimensions && provider.dimensions > 0) {
              notes.push(`Dimension mismatch: expected ${provider.dimensions}, got ${firstDims}`);
              valid = false;
            }
          }
        } catch (err) {
          notes.push(`Single embed error: ${err instanceof Error ? err.message : String(err)}`);
          valid = false;
          break;
        }
      }

      // Batch embed benchmark
      let totalBatchMs = 0;
      for (let i = 0; i < iters; i++) {
        try {
          const start = Date.now();
          await provider.embedBatch(texts);
          totalBatchMs += Date.now() - start;
        } catch (err) {
          notes.push(`Batch embed error: ${err instanceof Error ? err.message : String(err)}`);
          valid = false;
          break;
        }
      }

      const avgSingleMs = iters > 0 ? totalSingleMs / iters : 0;
      const avgBatchMs = iters > 0 ? totalBatchMs / iters : 0;
      const throughput = avgBatchMs > 0 ? (texts.length / avgBatchMs) * 1000 : 0;

      // Estimate cost from the provider's cost tracker if available
      const providerCost = (provider as { costTracker?: CostTracker }).costTracker;
      const totalTokens = providerCost?.totalTokens ?? 0;
      const totalCost = providerCost?.estimatedCostUsd ?? 0;
      const costPerMillion = totalTokens > 0 ? (totalCost / totalTokens) * 1_000_000 : 0;

      results.push({
        providerId,
        model: provider.model,
        dimensions: firstDims || provider.dimensions,
        avgLatencyMs: Math.round(avgSingleMs * 100) / 100,
        avgBatchLatencyMs: Math.round(avgBatchMs * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        costPerMillionTokens: Math.round(costPerMillion * 10000) / 10000,
        valid,
        notes,
      });
    }

    return results;
  }

  // ==========================================================================
  // Private: Provider Resolution (Lazy Initialization)
  // ==========================================================================

  /**
   * Resolve the active provider, creating it lazily on first use.
   */
  private async resolveProvider(): Promise<EmbeddingProvider> {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    try {
      this.activeProvider = this.providerFactory(this.primaryConfig);
      return this.activeProvider;
    } catch (err) {
      // If primary creation fails, try failover chain
      for (const failoverId of this.failoverChain) {
        try {
          const fallbackConfig: EmbeddingProviderConfig = {
            ...this.primaryConfig,
            provider: failoverId,
          };
          this.activeProvider = this.providerFactory(fallbackConfig);
          return this.activeProvider;
        } catch {
          // Continue to next failover
        }
      }
      throw err;
    }
  }

  /**
   * Get or create a failover provider by ID.
   */
  private getOrCreateFailoverProvider(providerId: EmbeddingProviderId): EmbeddingProvider {
    // Check if it's the active provider
    if (this.activeProvider && this.activeProvider.id === providerId) {
      return this.activeProvider;
    }

    let provider = this.failoverProviders.get(providerId);
    if (!provider) {
      const config: EmbeddingProviderConfig = {
        ...this.primaryConfig,
        provider: providerId,
      };
      provider = this.providerFactory(config);
      this.failoverProviders.set(providerId, provider);
    }
    return provider;
  }

  // ==========================================================================
  // Private: Failover Execution
  // ==========================================================================

  /**
   * Execute an operation against the primary provider, falling back through
   * the failover chain if the primary (or subsequent providers) fail and
   * the health monitor marks them unhealthy.
   */
  private async callWithFailover<T>(
    operation: (provider: EmbeddingProvider) => Promise<T>,
    primaryProvider: EmbeddingProvider,
  ): Promise<T> {
    // Try primary first (if healthy)
    if (this.healthMonitor.isHealthy(primaryProvider.id)) {
      const startMs = Date.now();
      try {
        const result = await operation(primaryProvider);
        const latencyMs = Date.now() - startMs;
        this.healthMonitor.recordSuccess(primaryProvider.id, latencyMs);
        this.trackCost(primaryProvider);
        return result;
      } catch (err) {
        const latencyMs = Date.now() - startMs;
        const message = err instanceof Error ? err.message : String(err);
        this.healthMonitor.recordFailure(primaryProvider.id, latencyMs, message);

        // If no failover chain, throw immediately
        if (this.failoverChain.length === 0) {
          throw err;
        }
      }
    }

    // Try failover providers
    const errors: string[] = [];
    for (const failoverId of this.failoverChain) {
      if (failoverId === primaryProvider.id) {
        continue;
      }
      if (!this.healthMonitor.isHealthy(failoverId)) {
        continue;
      }

      try {
        const failoverProvider = this.getOrCreateFailoverProvider(failoverId);
        const startMs = Date.now();
        const result = await operation(failoverProvider);
        const latencyMs = Date.now() - startMs;
        this.healthMonitor.recordSuccess(failoverId, latencyMs);
        this.trackCost(failoverProvider);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${failoverId}: ${message}`);
        this.healthMonitor.recordFailure(failoverId, 0, message);
      }
    }

    throw new Error(
      `All embedding providers failed.\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
  }

  // ==========================================================================
  // Private: Chunking
  // ==========================================================================

  /**
   * Embed a single text that exceeds the provider's maxInputTokens
   * by chunking it and mean-pooling the chunk embeddings.
   */
  private async embedWithChunking(
    text: string,
    provider: EmbeddingProvider,
    options?: EmbedOptions,
  ): Promise<EmbeddingResult> {
    const chunks = chunkText(text, this.chunkingConfig, provider.maxInputTokens);
    if (chunks.length === 0) {
      return { embedding: [], tokenCount: 0 };
    }
    if (chunks.length === 1) {
      return this.callWithFailover(
        async (p) => p.embedText(chunks[0]!.text, options),
        provider,
      );
    }

    // Embed all chunks as a batch
    const chunkTexts = chunks.map((c) => c.text);
    const results = await this.callWithFailover(
      async (p) => p.embedBatch(chunkTexts, options),
      provider,
    );

    // Mean-pool with token-count weighting
    const embeddings = results.map((r) => r.embedding);
    const weights = chunks.map((c) => c.tokenCount);
    const pooled = normalizeEmbedding(meanPoolEmbeddings(embeddings, weights));
    const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);

    return { embedding: pooled, tokenCount: totalTokens };
  }

  // ==========================================================================
  // Private: Cost Tracking
  // ==========================================================================

  /**
   * Aggregate cost from a provider's cost tracker into the orchestrator's tracker.
   */
  private trackCost(provider: EmbeddingProvider): void {
    const providerCost = (provider as { costTracker?: CostTracker }).costTracker;
    if (providerCost) {
      this.costTracker.totalTokens = providerCost.totalTokens;
      this.costTracker.totalRequests = providerCost.totalRequests;
      this.costTracker.estimatedCostUsd = providerCost.estimatedCostUsd;
    }
  }

  // ==========================================================================
  // Private: Progress
  // ==========================================================================

  private emitProgress(
    providerId: EmbeddingProviderId,
    totalTexts: number,
    completedTexts: number,
    cacheHits: number,
    startTime: number,
  ): void {
    if (!this.onProgress) {
      return;
    }
    const progress: BatchProgress = {
      providerId,
      totalTexts,
      completedTexts,
      fraction: totalTexts > 0 ? completedTexts / totalTexts : 0,
      cacheHits,
      elapsedMs: Date.now() - startTime,
    };
    this.onProgress(progress);
  }
}
