# Wave 2 / Feature 12: Model Routing with Failover

## Status: Design Complete
## Date: 2026-02-09

---

## 1. Overview

This document describes the design for Wundr's model routing system with automatic
failover, inspired by OpenClaw's production-hardened patterns. The system manages
multi-provider LLM access (Anthropic, OpenAI, Google, local/custom) with auth profile
rotation, rate-limit-aware backoff, thinking-mode budgets, cost tracking, streaming
delivery, and context window management.

### Key Design Principles

1. **Fail forward, never fail silent** -- every provider error is classified
   (auth, rate_limit, billing, timeout, format, network) and the router
   automatically advances to the next candidate. Only user-initiated aborts
   are re-thrown without failover.
2. **Round-robin by default, explicit order when configured** -- auth profiles
   are rotated oldest-first to distribute load. Cooldown/disabled profiles sink
   to the bottom. Explicit ordering is honoured when provided.
3. **Budget-aware routing** -- thinking modes (off/low/medium/high/xhigh) map
   to concrete token budgets. The router selects models that satisfy the
   requested thinking level and validates that the context window can
   accommodate the request.
4. **Cost transparency** -- every completion records input/output tokens with
   model pricing, accumulated per session and globally.
5. **Streaming first** -- all LLM calls flow through async iterators. Non-streaming
   calls are a convenience wrapper over the streaming path.

---

## 2. OpenClaw Architecture Analysis

### 2.1 Model Fallback (`model-fallback.ts`)

OpenClaw's `runWithModelFallback` is the central retry loop:

```
candidates = resolveFallbackCandidates(cfg, provider, model, fallbacksOverride)
for each candidate:
  if all auth profiles are in cooldown -> skip (record "rate_limit")
  try:
    result = run(candidate.provider, candidate.model)
    return { result, provider, model, attempts }
  catch:
    if AbortError (not timeout) -> rethrow immediately
    coerce to FailoverError -> if not failover-class, rethrow
    record attempt, call onError callback
if only 1 attempt failed -> rethrow original
else -> throw aggregated "All models failed" error
```

Key patterns we adopt:
- Candidate list built from config primary + fallbacks + allowlist enforcement
- Auth profile cooldown check *before* attempting the call (avoids wasted round-trips)
- AbortError vs TimeoutError distinction (timeouts trigger failover, user aborts do not)
- FailoverError classification via HTTP status codes and message pattern matching

### 2.2 Auth Profile System (`auth-profiles/`)

OpenClaw supports three credential types:
- `api_key` -- traditional API key
- `token` -- bearer/PAT token with optional expiry
- `oauth` -- OAuth2 with refresh capability

Profile ordering algorithm:
1. Explicit order from store or config takes precedence
2. Within explicit order, cooldown profiles sink to end
3. Without explicit order, round-robin by `lastUsed` (oldest first)
4. Type preference: oauth > token > api_key
5. Preferred profile (user override) always goes first

Cooldown mechanics:
- Exponential backoff: 1min -> 5min -> 25min -> 1hr max
- Billing failures use separate longer backoff: 5hr base, doubling, 24hr max
- Failure window (24h default): error counts reset after window expires
- `markAuthProfileUsed` resets all cooldown state on success

### 2.3 Failover Error Classification (`failover-error.ts`)

Status-code based classification:
- 401/403 -> auth
- 402 -> billing
- 429 -> rate_limit
- 408 -> timeout
- 400 -> format

Network code classification:
- ETIMEDOUT, ESOCKETTIMEDOUT, ECONNRESET, ECONNABORTED -> timeout

Message pattern classification via `classifyFailoverReason()`:
- Rate limit keywords, auth keywords, billing keywords, timeout keywords

### 2.4 Model Selection (`model-selection.ts`)

- `ModelRef` = `{ provider, model }` -- the canonical way to address a model
- Provider IDs are normalized (e.g. "z.ai" -> "zai", "opencode-zen" -> "opencode")
- Model aliases allow short names (e.g. "opus-4.6" -> "claude-opus-4-6")
- Allowlist enforcement: if `agents.defaults.models` is configured, only listed
  models are allowed as fallback candidates
- `ThinkLevel` = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

### 2.5 Context Window Guard (`context-window-guard.ts`)

- Hard minimum: 16,000 tokens
- Warning threshold: 32,000 tokens
- Resolution priority: modelsConfig override > model catalog > default
- Cap from `agents.defaults.contextTokens` applies when smaller

---

## 3. Wundr Architecture Design

### 3.1 Module Structure

```
packages/@wundr/orchestrator-daemon/src/models/
  index.ts                 -- Public API re-exports
  model-router.ts          -- Central routing + failover loop
  provider-registry.ts     -- Model catalog + provider configurations
  auth-profiles.ts         -- Multi-key credential management
  streaming.ts             -- Streaming adapter (SSE/WebSocket delivery)
  token-counter.ts         -- Token estimation + context window management
```

### 3.2 Integration Points

The model router replaces the direct `this.llmClient.chat()` call in
`SessionExecutor.executeSession()`. Instead of the session executor owning
a single `LLMClient`, it receives a `ModelRouter` which internally manages
provider selection, failover, and streaming.

```
SessionExecutor
  -> ModelRouter.chat(params)
       -> ProviderRegistry.resolve(modelRef)
       -> AuthProfileManager.getCredentials(provider)
       -> TokenCounter.validateContextWindow(params)
       -> LLMClient.chat(params)  // with failover loop
       -> CostTracker.record(usage)
```

### 3.3 Data Flow

```
User request (task + options)
  |
  v
SessionExecutor: build messages, choose thinking mode
  |
  v
ModelRouter.route(routingRequest)
  |
  +-> resolveModelCandidates(primary, fallbacks, allowlist)
  |
  +-> for each candidate:
  |     +-> AuthProfileManager.getNextProfile(candidate.provider)
  |     |     -> skip if all profiles in cooldown
  |     +-> TokenCounter.validate(messages, candidate.contextWindow)
  |     |     -> skip if context too large
  |     +-> ProviderRegistry.getClient(candidate, profile)
  |     +-> try: client.chatStream(params)
  |     |     -> on success: mark profile used, record cost, return
  |     +-> catch: classify error, mark profile failure, continue
  |
  +-> if all candidates exhausted: throw RoutingExhaustedError
```

---

## 4. Detailed Component Design

### 4.1 ModelRouter (`model-router.ts`)

The router is the public-facing entry point for all LLM interactions.

```typescript
interface RoutingRequest {
  messages: Message[];
  model?: string;            // explicit model override "provider/model"
  thinkingMode?: ThinkingMode;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  sessionId?: string;
  taskComplexity?: TaskComplexity;
  signal?: AbortSignal;
}

interface RoutingResult {
  response: ChatResponse;
  provider: string;
  model: string;
  profileId: string;
  attempts: FailoverAttempt[];
  cost: CostRecord;
}

class ModelRouter {
  route(request: RoutingRequest): Promise<RoutingResult>;
  routeStream(request: RoutingRequest): AsyncIterableIterator<StreamEvent>;
}
```

**Thinking Modes** map to concrete token budgets and model preferences:

| Mode   | Budget Tokens | Preferred Models                           |
|--------|--------------|-------------------------------------------|
| off    | 0            | Any non-reasoning model                   |
| low    | 1,024        | claude-sonnet-4-5, gpt-4o                 |
| medium | 8,192        | claude-sonnet-4-5, gpt-4-turbo            |
| high   | 32,768       | claude-opus-4-6, o3                        |
| xhigh  | 131,072      | claude-opus-4-6, o3-pro                   |

**Task Complexity** routing:

| Complexity | Description        | Default Thinking | Preferred Tier |
|------------|-------------------|-----------------|----------------|
| trivial    | Simple lookups    | off             | fast/cheap     |
| standard   | Normal coding     | low             | balanced       |
| complex    | Architecture      | medium          | capable        |
| expert     | Novel research    | high            | frontier       |

### 4.2 ProviderRegistry (`provider-registry.ts`)

Maintains the catalog of available models and their configurations.

```typescript
interface ProviderConfig {
  id: string;                    // "anthropic", "openai", "google", "local"
  name: string;
  baseUrl?: string;
  defaultModel: string;
  models: ModelEntry[];
  capabilities: ProviderCapabilities;
}

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  reasoning: boolean;
  vision: boolean;
  streaming: boolean;
  toolCalling: boolean;
  pricing: { input: number; output: number };  // per 1M tokens
}
```

The registry is initialized from a hardcoded catalog (covering current Anthropic,
OpenAI, Google, and common local models) merged with user configuration. Unknown
models from configured providers are accepted with sensible defaults.

### 4.3 AuthProfileManager (`auth-profiles.ts`)

Manages API credentials with rotation and cooldown.

```typescript
interface AuthProfile {
  id: string;
  provider: string;
  type: 'api_key' | 'token' | 'oauth';
  credential: string;
  metadata?: Record<string, string>;
  expiresAt?: number;
}

interface ProfileUsageStats {
  lastUsed?: number;
  cooldownUntil?: number;
  disabledUntil?: number;
  disabledReason?: FailureReason;
  errorCount: number;
  lastFailureAt?: number;
}
```

Cooldown algorithm (matching OpenClaw):
- General failures: `min(60min, 1min * 5^(errorCount-1))` capped at 3 steps
  - 1 error: 1 min
  - 2 errors: 5 min
  - 3 errors: 25 min
  - 4+ errors: 60 min
- Billing failures: `min(24h, 5h * 2^(billingErrorCount-1))`
  - 1 error: 5h
  - 2 errors: 10h
  - 3 errors: 20h
  - 4+ errors: 24h
- Failure window: 24h (error counts reset after 24h of no failures)

### 4.4 StreamingAdapter (`streaming.ts`)

Converts provider-specific streaming into a unified event protocol for both
SSE and WebSocket delivery.

```typescript
type StreamEvent =
  | { type: 'stream_start'; model: string; provider: string }
  | { type: 'content_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_call_start'; toolCall: Partial<ToolCall> }
  | { type: 'tool_call_delta'; index: number; argumentsDelta: string }
  | { type: 'tool_call_end'; toolCall: ToolCall }
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'stream_end'; finishReason: FinishReason; usage: TokenUsage }
  | { type: 'error'; error: string; recoverable: boolean };
```

The adapter handles:
- Anthropic streaming events (message_start, content_block_start/delta/stop,
  message_delta, message_stop)
- OpenAI streaming chunks (delta.content, delta.tool_calls, finish_reason)
- Google/Gemini streaming (candidate deltas)
- Backpressure via async iteration (consumer pull model)

### 4.5 TokenCounter (`token-counter.ts`)

Provides token estimation and context window validation.

```typescript
interface ContextValidation {
  totalEstimatedTokens: number;
  contextWindow: number;
  remainingCapacity: number;
  canFit: boolean;
  shouldWarn: boolean;      // < 32K remaining
  shouldBlock: boolean;     // < 16K remaining
  recommendation?: string;  // e.g. "compact history" or "use larger model"
}
```

Token estimation strategy:
1. If `tiktoken` is available (OpenAI models), use exact counts
2. For Anthropic, use Anthropic's token counting API if available
3. Fallback: 4 characters per token (conservative English estimate)
4. Add overhead for tool schemas, system prompt, and message framing

---

## 5. Error Classification

Following OpenClaw's proven classification hierarchy:

```
RoutingError (base)
  +-- FailoverError
  |     reason: auth | billing | rate_limit | timeout | format | network | unknown
  |     provider, model, profileId, status, code
  +-- RoutingExhaustedError
  |     attempts: FailoverAttempt[]
  |     summary: string
  +-- ContextOverflowError
  |     estimatedTokens, contextWindow, model
  +-- AbortError
        (user-initiated, never triggers failover)
```

Classification logic:
1. Check if already a FailoverError -> use its reason
2. HTTP status code: 401/403->auth, 402->billing, 429->rate_limit, 408->timeout, 400->format
3. Error code: ETIMEDOUT/ECONNRESET/ECONNABORTED -> timeout
4. Error name: TimeoutError -> timeout, AbortError -> check if timeout-caused
5. Message pattern matching: rate limit keywords, auth keywords, billing keywords

---

## 6. Cost Tracking Integration

The model router integrates with the existing `CostCalculator` from
`orchestrator-daemon/src/budget/cost-calculator.ts`:

```typescript
interface CostRecord {
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  timestamp: Date;
}
```

After each successful LLM call:
1. Extract usage from response
2. Look up pricing from `ProviderRegistry.getModelEntry()`
3. Create `CostRecord` and emit `router:cost` event
4. Feed into `TokenBudgetTracker` for budget enforcement

---

## 7. Configuration Schema

```typescript
interface ModelRoutingConfig {
  primary: string;                    // "anthropic/claude-sonnet-4-5"
  fallbacks?: string[];               // ["openai/gpt-4-turbo", "google/gemini-pro"]
  allowlist?: Record<string, { alias?: string }>;

  thinking?: {
    default: ThinkingMode;            // "low"
    maxBudget?: number;               // token cap for thinking
  };

  auth?: {
    profiles: Record<string, {
      provider: string;
      type: 'api_key' | 'token';
      envVar?: string;                // e.g. "ANTHROPIC_API_KEY"
    }>;
    order?: Record<string, string[]>; // per-provider profile ordering
    cooldowns?: {
      billingBackoffHours?: number;
      billingMaxHours?: number;
      failureWindowHours?: number;
    };
  };

  providers?: Record<string, {
    baseUrl?: string;
    defaultModel?: string;
    models?: Array<{
      id: string;
      contextWindow?: number;
      maxOutputTokens?: number;
    }>;
  }>;

  contextWindow?: {
    hardMinTokens?: number;           // default 16,000
    warnBelowTokens?: number;         // default 32,000
    capTokens?: number;               // optional global cap
  };
}
```

---

## 8. Migration Path

### Phase 1: Drop-in replacement (this implementation)
- `ModelRouter` wraps existing `LLMClient` interface
- `SessionExecutor` calls `router.route()` instead of `llmClient.chat()`
- Existing provider implementations (OpenAI, Anthropic) are reused

### Phase 2: Enhanced providers
- Add Google/Gemini provider
- Add local model support (Ollama, llama.cpp)
- Add OpenAI Responses API support

### Phase 3: Advanced routing
- Automatic task complexity detection
- Cost-optimal routing (cheapest model that meets requirements)
- A/B testing support for model comparison
- Latency-based routing (prefer fastest healthy provider)

---

## 9. Testing Strategy

### Unit Tests
- `model-router.test.ts`: Failover loop, candidate resolution, abort handling
- `provider-registry.test.ts`: Model catalog lookup, allowlist enforcement
- `auth-profiles.test.ts`: Cooldown calculation, round-robin ordering, profile rotation
- `token-counter.test.ts`: Estimation accuracy, context window validation
- `streaming.test.ts`: Event normalization, backpressure handling

### Integration Tests
- End-to-end routing with mock providers
- Failover across 3 providers with mixed errors
- Streaming delivery through WebSocket
- Cost tracking accumulation across sessions

### Load Tests
- Rate limit simulation with profile rotation
- Concurrent session routing
- Context window pressure with large conversation histories

---

## 10. File Inventory

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `model-router.ts` | ~350 | Central routing + failover loop |
| `provider-registry.ts` | ~250 | Model catalog + provider configs |
| `auth-profiles.ts` | ~280 | Credential management + cooldown |
| `streaming.ts` | ~200 | Unified streaming event adapter |
| `token-counter.ts` | ~180 | Token estimation + context validation |
| `index.ts` | ~30 | Public API re-exports |

Total estimated: ~1,290 lines of production TypeScript.
