/**
 * @wundr/agent-memory - Local Embedding Provider
 *
 * Implements the EmbeddingProvider interface using locally-running models.
 * Supports two backends:
 *
 * 1. **transformers.js** (default) - Runs ONNX models in-process via
 *    @huggingface/transformers. No native compilation required.
 *
 * 2. **node-llama-cpp** (GGUF) - Runs GGUF-quantized models via llama.cpp
 *    bindings. Better for larger models but requires native compilation.
 *
 * The local provider has no rate limiting, no cost tracking, and no network
 * dependency. It trades latency (slower than remote APIs on CPU) for privacy
 * and zero API cost.
 *
 * Both backends use lazy initialization -- the model is loaded on the first
 * embed call, not at provider creation time. This keeps process startup fast.
 */

import {
  type CostTracker,
  type EmbedOptions,
  type EmbeddingProvider,
  type EmbeddingProviderConfig,
  type EmbeddingResult,
  createCostTracker,
  estimateTokens,
  normalizeEmbedding,
} from './provider';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default transformers.js model. A small, fast model suitable for development
 * and lightweight use cases.
 */
export const DEFAULT_TRANSFORMERS_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Default GGUF model for node-llama-cpp backend.
 */
export const DEFAULT_GGUF_MODEL =
  'hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf';

const MODEL_DIMENSIONS: Record<string, number> = {
  'Xenova/all-MiniLM-L6-v2': 384,
  'Xenova/bge-small-en-v1.5': 384,
  'Xenova/bge-base-en-v1.5': 768,
  'nomic-ai/nomic-embed-text-v1.5': 768,
};

const DEFAULT_DIMENSIONS = 384;
const MAX_INPUT_TOKENS = 512;

// ============================================================================
// Backend Abstraction
// ============================================================================

/**
 * Internal backend interface that the LocalEmbeddingProvider delegates to.
 * This lets us swap between transformers.js and node-llama-cpp without
 * changing the public API.
 */
interface LocalBackend {
  embed(text: string): Promise<number[]>;
  dispose(): Promise<void>;
  dimensions: number;
}

// ============================================================================
// transformers.js Backend
// ============================================================================

/**
 * Create a transformers.js backend that lazy-loads the model on first use.
 */
function createTransformersBackend(modelName: string): LocalBackend {
  let pipeline: ((text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }>) | null = null;
  let resolvedDimensions = MODEL_DIMENSIONS[modelName] ?? DEFAULT_DIMENSIONS;

  const ensurePipeline = async () => {
    if (pipeline) {
      return pipeline;
    }

    try {
      // Dynamic import to avoid bundling transformers.js when not used
      // @ts-expect-error -- optional peer dependency
      // eslint-disable-next-line import/no-unresolved
      const { pipeline: createPipeline } = await import('@huggingface/transformers');
      pipeline = (await createPipeline('feature-extraction', modelName, {
        quantized: true,
      })) as (text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }>;
      return pipeline;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load transformers.js model "${modelName}": ${message}. ` +
          'Install @huggingface/transformers: npm install @huggingface/transformers',
      );
    }
  };

  return {
    get dimensions() {
      return resolvedDimensions;
    },
    async embed(text: string): Promise<number[]> {
      const pipe = await ensurePipeline();
      const result = await pipe(text, { pooling: 'mean', normalize: true });
      const vec = Array.from(result.data);
      if (vec.length !== resolvedDimensions) {
        resolvedDimensions = vec.length;
      }
      return vec;
    },
    async dispose(): Promise<void> {
      pipeline = null;
    },
  };
}

// ============================================================================
// node-llama-cpp Backend
// ============================================================================

/**
 * Create a node-llama-cpp backend for GGUF model files.
 * Lazy-loads the model on first use.
 */
function createLlamaCppBackend(modelPath: string, modelCacheDir?: string): LocalBackend {
  let context: { getEmbeddingFor: (text: string) => Promise<{ vector: Float32Array }> } | null = null;
  let _model: { close?: () => void } | null = null;
  let _llamaInstance: { close?: () => void } | null = null;
  let resolvedDimensions = DEFAULT_DIMENSIONS;

  const ensureContext = async () => {
    if (context) {
      return context;
    }

    try {
      // @ts-expect-error -- optional peer dependency
      // eslint-disable-next-line import/no-unresolved
      const { getLlama, resolveModelFile, LlamaLogLevel } = await import('node-llama-cpp');
      const llama = await getLlama({ logLevel: LlamaLogLevel.error });
      _llamaInstance = llama as unknown as { close?: () => void };
      const resolved = await resolveModelFile(modelPath, modelCacheDir || undefined);
      const loadedModel = await llama.loadModel({ modelPath: resolved });
      _model = loadedModel as unknown as { close?: () => void };
      context = await loadedModel.createEmbeddingContext();
      return context;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load node-llama-cpp model "${modelPath}": ${message}. ` +
          'Ensure node-llama-cpp is installed and the model file exists.',
      );
    }
  };

  return {
    get dimensions() {
      return resolvedDimensions;
    },
    async embed(text: string): Promise<number[]> {
      const ctx = await ensureContext();
      const result = await ctx.getEmbeddingFor(text);
      const vec = Array.from(result.vector);
      if (vec.length !== resolvedDimensions) {
        resolvedDimensions = vec.length;
      }
      return vec;
    },
    async dispose(): Promise<void> {
      context = null;
      _model = null;
      _llamaInstance = null;
    },
  };
}

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * Local embedding provider.
 *
 * Runs models locally without any network calls. Supports two backends:
 * - transformers.js for ONNX models (default, no native deps)
 * - node-llama-cpp for GGUF models (requires native compilation)
 *
 * Since everything runs locally, there is no rate limiting, no cost,
 * and no API key required.
 *
 * The underlying model is lazy-loaded on first embed call.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local' as const;
  readonly model: string;
  readonly maxBatchSize = 32; // Process sequentially but in logical groups
  readonly maxInputTokens = MAX_INPUT_TOKENS;

  private readonly backend: LocalBackend;
  readonly costTracker: CostTracker;

  constructor(config: {
    model: string;
    backend: LocalBackend;
  }) {
    this.model = config.model;
    this.backend = config.backend;
    this.costTracker = createCostTracker();
  }

  get dimensions(): number {
    return this.backend.dimensions;
  }

  async embedText(text: string, _options?: EmbedOptions): Promise<EmbeddingResult> {
    const vec = await this.backend.embed(text);
    return {
      embedding: normalizeEmbedding(vec),
      tokenCount: estimateTokens(text),
    };
  }

  async embedBatch(texts: string[], _options?: EmbedOptions): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // Local models typically process one at a time; parallelize up to a limit
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      const vec = await this.backend.embed(text);
      results.push({
        embedding: normalizeEmbedding(vec),
        tokenCount: estimateTokens(text),
      });
    }

    return results;
  }

  async dispose(): Promise<void> {
    await this.backend.dispose();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Detect which local backend to use based on the model path.
 *
 * - Paths starting with `hf:` or ending in `.gguf` use node-llama-cpp
 * - Everything else uses transformers.js
 */
function isGgufModel(modelPath: string): boolean {
  return /^hf:/i.test(modelPath) || /\.gguf$/i.test(modelPath);
}

/**
 * Create a local embedding provider from the standard config.
 *
 * Automatically selects the appropriate backend based on the model path:
 * - GGUF models -> node-llama-cpp
 * - All others -> transformers.js (ONNX)
 *
 * The model itself is not loaded until the first embed call (lazy initialization).
 */
export function createLocalProvider(
  config: EmbeddingProviderConfig,
): LocalEmbeddingProvider {
  const modelPath =
    config.model?.trim() ||
    config.local?.modelPath?.trim() ||
    DEFAULT_TRANSFORMERS_MODEL;

  let backend: LocalBackend;

  if (isGgufModel(modelPath)) {
    backend = createLlamaCppBackend(modelPath, config.local?.modelCacheDir);
  } else {
    backend = createTransformersBackend(modelPath);
  }

  return new LocalEmbeddingProvider({
    model: modelPath,
    backend,
  });
}
