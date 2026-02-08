/**
 * Model Router - Central routing and failover loop for LLM interactions
 *
 * The router is the public entry point for all LLM calls within Wundr's
 * orchestrator. It resolves model candidates, rotates auth profiles,
 * validates context windows, handles streaming, tracks costs, and provides
 * automatic failover across providers on transient errors.
 *
 * Directly inspired by OpenClaw's runWithModelFallback() pattern:
 * - Candidate list from primary + configured fallbacks
 * - Auth profile cooldown check before attempting each candidate
 * - FailoverError classification (auth, billing, rate_limit, timeout, format, network)
 * - AbortError vs TimeoutError distinction (user aborts never trigger failover)
 * - Aggregated error summary when all candidates are exhausted
 */

import { EventEmitter } from 'eventemitter3';

import type {
  LLMClient,
  ChatParams,
  ChatResponse,
  ChatChunk,
  Message,
  ToolDefinition,
  TokenUsage,
  FinishReason,
} from '@wundr.io/ai-integration';

import {
  type ModelRef,
  type ModelEntry,
  type ProviderRegistryConfig,
  ProviderRegistry,
  parseModelRef,
  modelKey,
} from './provider-registry';

import {
  type AuthProfile,
  type FailureReason,
  type AuthProfileManagerConfig,
  AuthProfileManager,
} from './auth-profiles';

import {
  type ContextValidation,
  type TokenCounterConfig,
  TokenCounter,
} from './token-counter';

import {
  type StreamEvent,
  type StreamResult,
  StreamingAdapter,
} from './streaming';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThinkingMode = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export type TaskComplexity = 'trivial' | 'standard' | 'complex' | 'expert';

export interface RoutingRequest {
  messages: Message[];
  /** Explicit model override in "provider/model" or alias format */
  model?: string;
  /** Thinking mode budget */
  thinkingMode?: ThinkingMode;
  /** Tool definitions for function calling */
  tools?: ToolDefinition[];
  /** Sampling temperature */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** System prompt (prepended as first message) */
  systemPrompt?: string;
  /** Session ID for cost tracking */
  sessionId?: string;
  /** Task complexity hint for automatic model selection */
  taskComplexity?: TaskComplexity;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Additional provider-specific parameters */
  providerParams?: Record<string, unknown>;
}

export interface FailoverAttempt {
  provider: string;
  model: string;
  profileId?: string;
  error: string;
  reason?: FailureReason;
  status?: number;
  code?: string;
}

export interface CostRecord {
  sessionId?: string;
  provider: string;
  model: string;
  profileId?: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  timestamp: Date;
}

export interface RoutingResult {
  response: ChatResponse;
  provider: string;
  model: string;
  profileId?: string;
  attempts: FailoverAttempt[];
  cost: CostRecord;
  contextValidation: ContextValidation;
}

export interface ModelRouterConfig {
  /** Primary model in "provider/model" format */
  primary?: string;
  /** Fallback models tried in order when primary fails */
  fallbacks?: string[];
  /** Default thinking mode */
  defaultThinkingMode?: ThinkingMode;
  /** LLM client factory: given provider + config, returns an LLM client */
  clientFactory: (provider: string, config: { apiKey: string; baseUrl?: string }) => LLMClient;
  /** Provider registry configuration */
  registry?: ProviderRegistryConfig;
  /** Auth profile configuration */
  auth?: AuthProfileManagerConfig;
  /** Token counter configuration */
  tokenCounter?: TokenCounterConfig;
}

// ---------------------------------------------------------------------------
// Thinking mode configuration
// ---------------------------------------------------------------------------

interface ThinkingBudget {
  budgetTokens: number;
  preferredModels: string[];
}

const THINKING_BUDGETS: Record<ThinkingMode, ThinkingBudget> = {
  off: {
    budgetTokens: 0,
    preferredModels: ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.0-flash'],
  },
  low: {
    budgetTokens: 1_024,
    preferredModels: ['claude-sonnet-4-5', 'gpt-4o'],
  },
  medium: {
    budgetTokens: 8_192,
    preferredModels: ['claude-sonnet-4-5', 'gpt-4-turbo'],
  },
  high: {
    budgetTokens: 32_768,
    preferredModels: ['claude-opus-4-6', 'o3'],
  },
  xhigh: {
    budgetTokens: 131_072,
    preferredModels: ['claude-opus-4-6', 'o3'],
  },
};

const TASK_COMPLEXITY_DEFAULTS: Record<TaskComplexity, ThinkingMode> = {
  trivial: 'off',
  standard: 'low',
  complex: 'medium',
  expert: 'high',
};

// ---------------------------------------------------------------------------
// Error classification (mirrors OpenClaw's failover-error.ts)
// ---------------------------------------------------------------------------

export class RoutingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RoutingError';
  }
}

export class FailoverError extends RoutingError {
  readonly reason: FailureReason;
  readonly provider?: string;
  readonly model?: string;
  readonly profileId?: string;
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    params: {
      reason: FailureReason;
      provider?: string;
      model?: string;
      profileId?: string;
      status?: number;
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: params.cause });
    this.name = 'FailoverError';
    this.reason = params.reason;
    this.provider = params.provider;
    this.model = params.model;
    this.profileId = params.profileId;
    this.status = params.status;
    this.code = params.code;
  }
}

export class RoutingExhaustedError extends RoutingError {
  readonly attempts: FailoverAttempt[];

  constructor(attempts: FailoverAttempt[]) {
    const summary = attempts
      .map((a) => `${a.provider}/${a.model}: ${a.error}${a.reason ? ` (${a.reason})` : ''}`)
      .join(' | ');
    super(`All models failed (${attempts.length}): ${summary}`);
    this.name = 'RoutingExhaustedError';
    this.attempts = attempts;
  }
}

export class ContextOverflowError extends RoutingError {
  readonly estimatedTokens: number;
  readonly contextWindow: number;
  readonly model: string;

  constructor(estimatedTokens: number, contextWindow: number, model: string) {
    super(
      `Context overflow for ${model}: estimated ${estimatedTokens.toLocaleString()} tokens ` +
      `exceeds context window of ${contextWindow.toLocaleString()} tokens`,
    );
    this.name = 'ContextOverflowError';
    this.estimatedTokens = estimatedTokens;
    this.contextWindow = contextWindow;
    this.model = model;
  }
}

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

const TIMEOUT_PATTERNS = /timeout|timed out|deadline exceeded|context deadline exceeded/i;
const ABORT_TIMEOUT_PATTERNS = /request was aborted|request aborted/i;
const RATE_LIMIT_PATTERNS = /rate.?limit|too many requests|throttl/i;
const AUTH_PATTERNS = /auth|unauthorized|forbidden|invalid.?key|invalid.?api|invalid.?token/i;
const BILLING_PATTERNS = /billing|payment|quota|insufficient.?fund|credit/i;

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  return name === 'AbortError';
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  if (name === 'TimeoutError') {
    return true;
  }
  const message = err instanceof Error ? err.message : '';
  if (TIMEOUT_PATTERNS.test(message)) {
    return true;
  }
  if (name === 'AbortError' && ABORT_TIMEOUT_PATTERNS.test(message)) {
    return true;
  }
  return false;
}

function getStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const candidate =
    (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  if (typeof candidate === 'number') {
    return candidate;
  }
  return undefined;
}

function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const candidate = (err as { code?: unknown }).code;
  return typeof candidate === 'string' ? candidate : undefined;
}

function classifyFailoverReason(err: unknown): FailureReason | null {
  if (err instanceof FailoverError) {
    return err.reason;
  }

  const status = getStatusCode(err);
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'billing';
  if (status === 429) return 'rate_limit';
  if (status === 408) return 'timeout';
  if (status === 400) return 'format';

  const code = (getErrorCode(err) ?? '').toUpperCase();
  if (['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNRESET', 'ECONNABORTED'].includes(code)) {
    return 'timeout';
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return 'network';
  }
  if (isTimeoutError(err)) {
    return 'timeout';
  }

  const message = err instanceof Error ? err.message : String(err);
  if (RATE_LIMIT_PATTERNS.test(message)) return 'rate_limit';
  if (AUTH_PATTERNS.test(message)) return 'auth';
  if (BILLING_PATTERNS.test(message)) return 'billing';
  if (TIMEOUT_PATTERNS.test(message)) return 'timeout';

  return null;
}

function shouldRethrowAbort(err: unknown): boolean {
  return isAbortError(err) && !isTimeoutError(err);
}

function coerceToFailoverError(
  err: unknown,
  context: { provider: string; model: string; profileId?: string },
): FailoverError | null {
  if (err instanceof FailoverError) {
    return err;
  }
  const reason = classifyFailoverReason(err);
  if (!reason) {
    return null;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new FailoverError(message, {
    reason,
    provider: context.provider,
    model: context.model,
    profileId: context.profileId,
    status: getStatusCode(err),
    code: getErrorCode(err),
    cause: err instanceof Error ? err : undefined,
  });
}

// ---------------------------------------------------------------------------
// ModelRouter class
// ---------------------------------------------------------------------------

interface ModelRouterEvents {
  'router:attempt': (attempt: { provider: string; model: string; attemptNumber: number }) => void;
  'router:success': (result: { provider: string; model: string; attempts: number }) => void;
  'router:failover': (attempt: FailoverAttempt) => void;
  'router:exhausted': (attempts: FailoverAttempt[]) => void;
  'router:cost': (cost: CostRecord) => void;
  'router:context_warning': (validation: ContextValidation) => void;
}

export class ModelRouter extends EventEmitter<ModelRouterEvents> {
  private readonly registry: ProviderRegistry;
  private readonly authManager: AuthProfileManager;
  private readonly tokenCounter: TokenCounter;
  private readonly streamingAdapter: StreamingAdapter;
  private readonly clientFactory: (provider: string, config: { apiKey: string; baseUrl?: string }) => LLMClient;
  private readonly clientCache: Map<string, LLMClient> = new Map();

  private readonly primaryRef: ModelRef;
  private readonly fallbacks: ModelRef[];
  private readonly defaultThinkingMode: ThinkingMode;

  constructor(config: ModelRouterConfig) {
    super();
    this.registry = new ProviderRegistry(config.registry);
    this.authManager = new AuthProfileManager(config.auth);
    this.tokenCounter = new TokenCounter(config.tokenCounter);
    this.streamingAdapter = new StreamingAdapter();
    this.clientFactory = config.clientFactory;
    this.defaultThinkingMode = config.defaultThinkingMode ?? 'off';

    // Resolve primary model
    const defaultRef = this.registry.getDefault();
    if (config.primary) {
      const resolved = this.registry.resolveModelRef(config.primary);
      this.primaryRef = resolved?.ref ?? defaultRef;
    } else {
      this.primaryRef = defaultRef;
    }

    // Resolve fallback models
    this.fallbacks = [];
    if (config.fallbacks) {
      for (const raw of config.fallbacks) {
        const resolved = this.registry.resolveModelRef(raw);
        if (resolved?.ref) {
          this.fallbacks.push(resolved.ref);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public routing API
  // -------------------------------------------------------------------------

  /**
   * Route a request to the best available model with automatic failover.
   * Returns the complete response after all content is received.
   */
  async route(request: RoutingRequest): Promise<RoutingResult> {
    const candidates = this.resolveCandidates(request);
    const thinkingMode = this.resolveThinkingMode(request);
    const attempts: FailoverAttempt[] = [];
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      // Check if provider has any available auth profiles
      if (!this.authManager.hasAvailableProfile(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `Provider ${candidate.provider} is in cooldown (all profiles unavailable)`,
          reason: 'rate_limit',
        });
        continue;
      }

      // Get next auth profile
      const profile = this.authManager.getNextProfile(candidate.provider);
      if (!profile) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `No auth profile available for ${candidate.provider}`,
          reason: 'auth',
        });
        continue;
      }

      // Validate context window
      const modelEntry = this.registry.findModel(candidate.provider, candidate.model);
      const contextWindow = this.registry.getContextWindow(candidate.provider, candidate.model);
      const contextValidation = this.tokenCounter.checkRequest({
        systemPrompt: request.systemPrompt,
        messages: request.messages,
        tools: request.tools,
        maxOutputTokens: request.maxTokens,
        contextWindow,
      });

      if (contextValidation.shouldBlock) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: contextValidation.recommendation ?? 'Context window overflow',
        });
        continue;
      }

      if (contextValidation.shouldWarn) {
        this.emit('router:context_warning', contextValidation);
      }

      this.emit('router:attempt', {
        provider: candidate.provider,
        model: candidate.model,
        attemptNumber: i + 1,
      });

      try {
        const client = this.getOrCreateClient(candidate.provider, profile);
        const chatParams = this.buildChatParams(request, candidate, thinkingMode);
        const response = await client.chat(chatParams);

        // Mark profile as successfully used
        this.authManager.markUsed(profile.id);

        // Calculate cost
        const cost = this.calculateCost(
          candidate,
          profile.id,
          response.usage,
          request.sessionId,
        );
        this.emit('router:cost', cost);
        this.emit('router:success', {
          provider: candidate.provider,
          model: candidate.model,
          attempts: i + 1,
        });

        return {
          response,
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          attempts,
          cost,
          contextValidation,
        };
      } catch (err) {
        // User-initiated aborts are never retried
        if (shouldRethrowAbort(err)) {
          throw err;
        }

        // Classify the error
        const failoverErr = coerceToFailoverError(err, {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
        });

        if (!failoverErr) {
          // Not a failover-class error: rethrow immediately
          throw err;
        }

        lastError = failoverErr;

        // Mark profile failure with appropriate reason
        this.authManager.markFailure(profile.id, failoverErr.reason);

        const attempt: FailoverAttempt = {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: failoverErr.message,
          reason: failoverErr.reason,
          status: failoverErr.status,
          code: failoverErr.code,
        };
        attempts.push(attempt);
        this.emit('router:failover', attempt);
      }
    }

    // All candidates exhausted
    this.emit('router:exhausted', attempts);

    if (attempts.length <= 1 && lastError) {
      throw lastError;
    }

    throw new RoutingExhaustedError(attempts);
  }

  /**
   * Route a streaming request with automatic failover.
   * Returns an async iterator of unified StreamEvents.
   */
  async *routeStream(request: RoutingRequest): AsyncIterableIterator<StreamEvent> {
    const candidates = this.resolveCandidates(request);
    const thinkingMode = this.resolveThinkingMode(request);
    const attempts: FailoverAttempt[] = [];
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      if (!this.authManager.hasAvailableProfile(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `Provider ${candidate.provider} is in cooldown`,
          reason: 'rate_limit',
        });
        continue;
      }

      const profile = this.authManager.getNextProfile(candidate.provider);
      if (!profile) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `No auth profile available for ${candidate.provider}`,
          reason: 'auth',
        });
        continue;
      }

      const contextWindow = this.registry.getContextWindow(candidate.provider, candidate.model);
      const contextValidation = this.tokenCounter.checkRequest({
        systemPrompt: request.systemPrompt,
        messages: request.messages,
        tools: request.tools,
        maxOutputTokens: request.maxTokens,
        contextWindow,
      });

      if (contextValidation.shouldBlock) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: contextValidation.recommendation ?? 'Context window overflow',
        });
        continue;
      }

      this.emit('router:attempt', {
        provider: candidate.provider,
        model: candidate.model,
        attemptNumber: i + 1,
      });

      try {
        const client = this.getOrCreateClient(candidate.provider, profile);
        const chatParams = this.buildChatParams(request, candidate, thinkingMode);
        const rawStream = client.chatStream(chatParams);

        const adaptedStream = this.streamingAdapter.adaptChunks(rawStream, {
          model: candidate.model,
          provider: candidate.provider,
          sessionId: request.sessionId,
        });

        // Yield all events from the adapted stream
        let streamUsage: TokenUsage | undefined;
        for await (const event of adaptedStream) {
          if (event.type === 'stream_end') {
            streamUsage = event.usage;
          }
          yield event;
        }

        // Mark profile as used on successful stream completion
        this.authManager.markUsed(profile.id);

        // Track cost
        if (streamUsage) {
          const cost = this.calculateCost(
            candidate,
            profile.id,
            streamUsage,
            request.sessionId,
          );
          this.emit('router:cost', cost);
        }

        this.emit('router:success', {
          provider: candidate.provider,
          model: candidate.model,
          attempts: i + 1,
        });

        return; // Stream completed successfully
      } catch (err) {
        if (shouldRethrowAbort(err)) {
          throw err;
        }

        const failoverErr = coerceToFailoverError(err, {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
        });

        if (!failoverErr) {
          throw err;
        }

        lastError = failoverErr;
        this.authManager.markFailure(profile.id, failoverErr.reason);

        const attempt: FailoverAttempt = {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: failoverErr.message,
          reason: failoverErr.reason,
          status: failoverErr.status,
          code: failoverErr.code,
        };
        attempts.push(attempt);
        this.emit('router:failover', attempt);
      }
    }

    this.emit('router:exhausted', attempts);

    if (attempts.length <= 1 && lastError) {
      throw lastError;
    }

    throw new RoutingExhaustedError(attempts);
  }

  // -------------------------------------------------------------------------
  // Accessors for sub-components
  // -------------------------------------------------------------------------

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  getAuthManager(): AuthProfileManager {
    return this.authManager;
  }

  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  // -------------------------------------------------------------------------
  // Candidate resolution
  // -------------------------------------------------------------------------

  private resolveCandidates(request: RoutingRequest): ModelRef[] {
    const seen = new Set<string>();
    const candidates: ModelRef[] = [];

    const addCandidate = (ref: ModelRef) => {
      const key = modelKey(ref.provider, ref.model);
      if (seen.has(key)) {
        return;
      }
      if (!this.registry.isAllowed(ref.provider, ref.model)) {
        return;
      }
      seen.add(key);
      candidates.push(ref);
    };

    // 1. Explicit model override from request
    if (request.model) {
      const resolved = this.registry.resolveModelRef(request.model);
      if (resolved?.ref) {
        addCandidate(resolved.ref);
      }
    }

    // 2. Task complexity -> preferred models for thinking mode
    const thinkingMode = this.resolveThinkingMode(request);
    if (thinkingMode !== 'off') {
      const budget = THINKING_BUDGETS[thinkingMode];
      for (const preferredId of budget.preferredModels) {
        const resolved = this.registry.resolveModelRef(preferredId);
        if (resolved?.ref) {
          addCandidate(resolved.ref);
        }
      }
    }

    // 3. Primary model
    addCandidate(this.primaryRef);

    // 4. Configured fallbacks
    for (const fallback of this.fallbacks) {
      addCandidate(fallback);
    }

    return candidates;
  }

  // -------------------------------------------------------------------------
  // Thinking mode resolution
  // -------------------------------------------------------------------------

  private resolveThinkingMode(request: RoutingRequest): ThinkingMode {
    if (request.thinkingMode) {
      return request.thinkingMode;
    }
    if (request.taskComplexity) {
      return TASK_COMPLEXITY_DEFAULTS[request.taskComplexity];
    }
    return this.defaultThinkingMode;
  }

  // -------------------------------------------------------------------------
  // LLM client management
  // -------------------------------------------------------------------------

  private getOrCreateClient(provider: string, profile: AuthProfile): LLMClient {
    const cacheKey = `${provider}:${profile.id}`;
    let client = this.clientCache.get(cacheKey);
    if (client) {
      return client;
    }

    const modelEntry = this.registry.listModels(provider)[0];
    client = this.clientFactory(provider, {
      apiKey: profile.credential,
      baseUrl: profile.metadata?.baseUrl,
    });
    this.clientCache.set(cacheKey, client);
    return client;
  }

  private buildChatParams(
    request: RoutingRequest,
    candidate: ModelRef,
    thinkingMode: ThinkingMode,
  ): ChatParams {
    const messages = [...request.messages];

    // Prepend system prompt as system message if provided
    if (request.systemPrompt) {
      const hasSystemMessage = messages.some((m) => m.role === 'system');
      if (!hasSystemMessage) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }
    }

    const thinkingBudget = THINKING_BUDGETS[thinkingMode];
    const providerParams: Record<string, unknown> = {
      ...request.providerParams,
    };

    // Add thinking budget as provider param if model supports reasoning
    if (thinkingBudget.budgetTokens > 0) {
      const supportsReasoning = this.registry.supportsReasoning(
        candidate.provider,
        candidate.model,
      );
      if (supportsReasoning) {
        providerParams.thinkingBudget = thinkingBudget.budgetTokens;
      }
    }

    return {
      model: candidate.model,
      messages,
      tools: request.tools,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      providerParams: Object.keys(providerParams).length > 0 ? providerParams : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Cost calculation
  // -------------------------------------------------------------------------

  private calculateCost(
    candidate: ModelRef,
    profileId: string,
    usage: TokenUsage,
    sessionId?: string,
  ): CostRecord {
    const pricing = this.registry.getModelPricing(candidate.provider, candidate.model);
    const inputCostUsd = pricing
      ? (usage.promptTokens / 1_000_000) * pricing.input
      : 0;
    const outputCostUsd = pricing
      ? (usage.completionTokens / 1_000_000) * pricing.output
      : 0;

    return {
      sessionId,
      provider: candidate.provider,
      model: candidate.model,
      profileId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      inputCostUsd,
      outputCostUsd,
      totalCostUsd: inputCostUsd + outputCostUsd,
      timestamp: new Date(),
    };
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    this.clientCache.clear();
    this.tokenCounter.destroy();
    this.removeAllListeners();
  }
}
