# Wave 2 Analysis: Embedding Provider Abstraction Layer

## Status: Implementation Ready

## 1. Overview

The embedding provider abstraction layer decouples Wundr's memory system from any single embedding
backend. It draws heavily from OpenClaw's proven architecture (four providers -- OpenAI, Gemini,
Voyage, Local -- with fallback chains, batch APIs, and caching), while adapting the design to
Wundr's tiered MemGPT-inspired memory model.

### Key Design Goals

1. **Provider agnosticism**: The memory manager never calls a provider directly. It works through a
   uniform `EmbeddingProvider` interface.
2. **Graceful degradation**: If the primary provider fails, the system transparently falls back to
   alternatives.
3. **Batch efficiency**: Large indexing operations use provider-specific batch endpoints to reduce
   cost and improve throughput.
4. **Rate limiting**: Per-provider token-bucket rate limiters prevent 429 errors.
5. **Cost visibility**: Every embedding call accumulates tracked token/cost data.
6. **Dimension flexibility**: Providers expose their native dimensions and optionally support
   Matryoshka-style truncation.

## 2. Architecture

```
                  +---------------------+
                  |   MemoryManager     |
                  |  (compileContext,    |
                  |   store, search)    |
                  +--------+------------+
                           |
                           v
                  +---------------------+
                  | EmbeddingProvider    |  <-- uniform interface
                  | (embedText,         |
                  |  embedBatch)        |
                  +--------+------------+
                           |
          +-------+--------+--------+--------+
          |       |                  |        |
          v       v                  v        v
      +------+ +------+         +------+ +------+
      |OpenAI| |Voyage|         |Gemini| |Local |
      +------+ +------+         +------+ +------+
```

### 2.1 Provider Interface

```typescript
interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimensions: number;
  readonly maxBatchSize: number;
  readonly maxInputTokens: number;

  embedText(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
  dispose(): Promise<void>;
}

interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}
```

### 2.2 Supported Providers

| Provider | Default Model              | Dimensions | Batch API | Rate Limit Default |
| -------- | -------------------------- | ---------- | --------- | ------------------ |
| OpenAI   | text-embedding-3-small     | 1536       | /batches  | 3000 RPM           |
| Voyage   | voyage-3-large             | 1024       | /batches  | 300 RPM            |
| Gemini   | gemini-embedding-001       | 768        | native    | 1500 RPM           |
| Local    | embeddinggemma-300M (GGUF) | varies     | N/A       | none               |

### 2.3 Factory Pattern

```typescript
function createEmbeddingProvider(config: EmbeddingProviderConfig): Promise<EmbeddingProvider>;
```

The factory resolves credentials, validates connectivity, and returns the appropriate
implementation. When `provider: "auto"` is specified, it tries providers in priority order: local
(if model file exists) -> openai -> gemini -> voyage.

## 3. Detailed Design

### 3.1 Rate Limiting

Each provider wraps calls in a token-bucket rate limiter:

```typescript
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  retryOnRateLimit: boolean;
  maxRetries: number;
  baseRetryDelayMs: number;
}
```

Rate limiters are per-provider-instance, not global, so multiple agents can each have their own
limits if configured separately.

### 3.2 Cost Tracking

```typescript
interface CostTracker {
  totalTokens: number;
  totalRequests: number;
  estimatedCostUsd: number;
  byModel: Map<string, { tokens: number; requests: number; costUsd: number }>;
}
```

Each provider maintains a `CostTracker` that the memory manager can query for observability
dashboards and budget enforcement.

### 3.3 Failover Strategy

OpenClaw's two-level failover is preserved:

1. **Init-time fallback**: If the primary provider fails to initialize (missing API key, model not
   found), the factory tries the configured `fallback` provider.
2. **Runtime fallback**: If embedding calls fail with retryable errors more than `maxRetries` times,
   the manager can swap to the fallback mid-session.

### 3.4 Embedding Normalization

All providers normalize output embeddings to unit vectors using L2 normalization. This is critical
for consistent cosine similarity across providers.

### 3.5 Local Provider

The local provider uses transformers.js (or node-llama-cpp for GGUF models). It has no rate limiting
and no cost tracking. The trade-off is slower inference on CPU but zero network latency and no API
costs.

### 3.6 Dimension Configuration

OpenAI's `text-embedding-3-*` models support Matryoshka representations, where you can truncate to
fewer dimensions without retraining. The provider config accepts an optional `dimensions` override:

```typescript
interface EmbeddingProviderConfig {
  provider: 'openai' | 'voyage' | 'gemini' | 'local' | 'auto';
  model?: string;
  dimensions?: number; // override native dims
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  rateLimit?: Partial<RateLimitConfig>;
  fallback?: 'openai' | 'voyage' | 'gemini' | 'local' | 'none';
}
```

## 4. Comparison with OpenClaw

| Feature                 | OpenClaw                                | Wundr (this design)                                      |
| ----------------------- | --------------------------------------- | -------------------------------------------------------- |
| Provider interface      | `{ id, model, embedQuery, embedBatch }` | `EmbeddingProvider` class with dispose, dimensions, cost |
| Rate limiting           | Retry loop with exponential backoff     | Token-bucket + retry with jitter                         |
| Cost tracking           | None                                    | Built-in per-provider tracker                            |
| Batch API               | Separate `batch-*.ts` modules           | Integrated into provider classes                         |
| Dimension config        | Implicit from model                     | Explicit `dimensions` option                             |
| Local embeddings        | node-llama-cpp only                     | transformers.js (primary) + node-llama-cpp               |
| Fallback strategy       | Two-level (init + runtime)              | Same, with configurable chain                            |
| Embedding normalization | `sanitizeAndNormalizeEmbedding`         | Same L2 normalization                                    |
| Caching                 | SQLite embedding_cache table            | Delegated to memory store layer                          |

## 5. Implementation Plan

### Files to Create

```
packages/@wundr/agent-memory/src/embeddings/
  provider.ts    -- EmbeddingProvider interface and shared types
  openai.ts      -- OpenAI provider (text-embedding-3-small/large)
  voyage.ts      -- Voyage AI provider (voyage-3-large, voyage-code-3)
  gemini.ts      -- Google Gemini provider (gemini-embedding-001)
  local.ts       -- Local provider (transformers.js / GGUF)
  index.ts       -- Factory, re-exports, auto-detection
```

### Integration Points

1. `SemanticStore` will accept an `EmbeddingProvider` in its constructor and use it for
   `findSimilar` and `semanticSearch`.
2. `AgentMemoryManager` will hold the provider instance and pass it to tiers.
3. `compileContext` will call `provider.embedText(query)` when building query embeddings for
   retrieval.

## 6. Migration Path

Wundr's current `SemanticStore` uses pre-computed embeddings passed via
`StoreMemoryOptions.embedding`. The new layer preserves this path (callers can still pass their own
vectors), but adds automatic embedding when content is stored without one:

```typescript
// Before: caller must embed
await semantic.store(content, { source: 'user', embedding: myVector });

// After: auto-embed if no vector provided
await semantic.store(content, { source: 'user' });
// -> internally calls provider.embedText(content)
```

## 7. Testing Strategy

- Unit tests per provider with mocked HTTP / mocked transformers.js
- Integration test with a tiny local model for the local provider
- Factory tests for auto-detection, fallback chains
- Rate limiter tests with simulated time
- Cost tracker accumulation tests
