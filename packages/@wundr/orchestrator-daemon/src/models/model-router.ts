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
 *
 * Enhanced with:
 * - Thinking modes (off, low, medium, high, xhigh) with automatic selection
 *   based on task complexity, inspired by OpenClaw's ThinkLevel system
 * - Model failover chain with auth profile rotation on rate limit
 * - Provider health tracking with three-state circuit breaker
 * - Cost-aware routing (prefer cheaper models for simple tasks)
 * - Latency-aware routing (track response times per provider)
 * - Token budget management per session
 * - Model capability matching (vision, tool-use, long-context, streaming)
 * - Retry with exponential backoff for transient errors per candidate
 * - Concurrent request limiting per provider
 */

import { EventEmitter } from 'eventemitter3';

import {
  type AuthProfile,
  type FailureReason,
  type AuthProfileManagerConfig,
  AuthProfileManager,
} from './auth-profiles';
import {
  type ProviderHealthConfig,
  type ProviderHealthSnapshot,
  ProviderHealthTracker,
} from './provider-health';
import {
  type ModelRef,
  type ProviderRegistryConfig,
  ProviderRegistry,
  modelKey,
} from './provider-registry';
import { type RetryConfig, withRetry } from './retry';
import { type StreamEvent, StreamingAdapter } from './streaming';
import {
  type SessionBudget,
  type BudgetCheck,
  type TokenBudgetConfig,
  TokenBudgetManager,
} from './token-budget';
import {
  type ContextValidation,
  type TokenCounterConfig,
  TokenCounter,
} from './token-counter';

import type {
  LLMClient,
  ChatParams,
  ChatResponse,
  Message,
  ToolDefinition,
  TokenUsage,
} from '../types/llm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThinkingMode = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export type TaskComplexity = 'trivial' | 'standard' | 'complex' | 'expert';

/** Required capabilities a model must have for a given request. */
export interface RequiredCapabilities {
  vision?: boolean;
  toolCalling?: boolean;
  streaming?: boolean;
  reasoning?: boolean;
  jsonMode?: boolean;
  /** Minimum context window in tokens */
  minContextWindow?: number;
}

/** Routing strategy for candidate ordering. */
export type RoutingStrategy =
  | 'failover' // Default: try primary, then fallbacks in order
  | 'cost_optimized' // Prefer cheapest model that meets requirements
  | 'latency_optimized' // Prefer lowest-latency provider
  | 'balanced'; // Score-based blend of cost, latency, and health

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
  /** Session ID for cost tracking and budget enforcement */
  sessionId?: string;
  /** Task complexity hint for automatic model selection */
  taskComplexity?: TaskComplexity;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Required model capabilities for this request */
  requiredCapabilities?: RequiredCapabilities;
  /** Routing strategy override */
  routingStrategy?: RoutingStrategy;
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
  /** Latency of the failed attempt in milliseconds */
  latencyMs?: number;
  /** Number of retries attempted before failing over */
  retries?: number;
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
  /** Response latency in milliseconds */
  latencyMs?: number;
}

export interface RoutingResult {
  response: ChatResponse;
  provider: string;
  model: string;
  profileId?: string;
  attempts: FailoverAttempt[];
  cost: CostRecord;
  contextValidation: ContextValidation;
  /** Budget status after this request (null if no session ID) */
  budgetCheck: BudgetCheck | null;
  /** Provider health after this request */
  providerHealth: ProviderHealthSnapshot;
  /** Resolved thinking mode used for this request */
  thinkingMode: ThinkingMode;
  /** Total latency including retries in milliseconds */
  totalLatencyMs: number;
}

export interface ModelRouterConfig {
  /** Primary model in "provider/model" format */
  primary?: string;
  /** Fallback models tried in order when primary fails */
  fallbacks?: string[];
  /** Default thinking mode */
  defaultThinkingMode?: ThinkingMode;
  /** Default routing strategy */
  defaultRoutingStrategy?: RoutingStrategy;
  /** LLM client factory: given provider + config, returns an LLM client */
  clientFactory: (
    provider: string,
    config: { apiKey: string; baseUrl?: string }
  ) => LLMClient;
  /** Provider registry configuration */
  registry?: ProviderRegistryConfig;
  /** Auth profile configuration */
  auth?: AuthProfileManagerConfig;
  /** Token counter configuration */
  tokenCounter?: TokenCounterConfig;
  /** Provider health / circuit breaker configuration */
  providerHealth?: ProviderHealthConfig;
  /** Token budget configuration */
  tokenBudget?: TokenBudgetConfig;
  /** Per-candidate retry configuration (retries before failing over) */
  retry?: Partial<RetryConfig>;
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
  readonly routingCause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RoutingError';
    if (options?.cause !== undefined) {
      this.routingCause = options.cause;
    }
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
    }
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
      .map(
        a =>
          `${a.provider}/${a.model}: ${a.error}${a.reason ? ` (${a.reason})` : ''}`
      )
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
        `exceeds context window of ${contextWindow.toLocaleString()} tokens`
    );
    this.name = 'ContextOverflowError';
    this.estimatedTokens = estimatedTokens;
    this.contextWindow = contextWindow;
    this.model = model;
  }
}

export class BudgetExceededError extends RoutingError {
  readonly sessionId: string;
  readonly budgetCheck: BudgetCheck;

  constructor(sessionId: string, budgetCheck: BudgetCheck) {
    super(
      budgetCheck.message ?? `Token budget exceeded for session ${sessionId}`
    );
    this.name = 'BudgetExceededError';
    this.sessionId = sessionId;
    this.budgetCheck = budgetCheck;
  }
}

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

const TIMEOUT_PATTERNS =
  /timeout|timed out|deadline exceeded|context deadline exceeded/i;
const ABORT_TIMEOUT_PATTERNS = /request was aborted|request aborted/i;
const RATE_LIMIT_PATTERNS = /rate.?limit|too many requests|throttl/i;
const AUTH_PATTERNS =
  /auth|unauthorized|forbidden|invalid.?key|invalid.?api|invalid.?token/i;
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
    (err as { status?: unknown }).status ??
    (err as { statusCode?: unknown }).statusCode;
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
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 402) {
    return 'billing';
  }
  if (status === 429) {
    return 'rate_limit';
  }
  if (status === 408) {
    return 'timeout';
  }
  if (status === 400) {
    return 'format';
  }

  const code = (getErrorCode(err) ?? '').toUpperCase();
  if (
    ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNRESET', 'ECONNABORTED'].includes(
      code
    )
  ) {
    return 'timeout';
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return 'network';
  }
  if (isTimeoutError(err)) {
    return 'timeout';
  }

  const message = err instanceof Error ? err.message : String(err);
  if (RATE_LIMIT_PATTERNS.test(message)) {
    return 'rate_limit';
  }
  if (AUTH_PATTERNS.test(message)) {
    return 'auth';
  }
  if (BILLING_PATTERNS.test(message)) {
    return 'billing';
  }
  if (TIMEOUT_PATTERNS.test(message)) {
    return 'timeout';
  }

  return null;
}

function shouldRethrowAbort(err: unknown): boolean {
  return isAbortError(err) && !isTimeoutError(err);
}

function coerceToFailoverError(
  err: unknown,
  context: { provider: string; model: string; profileId?: string }
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

/**
 * Determine if a failover reason is retryable against the SAME candidate.
 * Rate limit and timeout are retryable; auth/billing are not.
 */
function isRetryableReason(reason: FailureReason): boolean {
  return (
    reason === 'rate_limit' || reason === 'timeout' || reason === 'network'
  );
}

// ---------------------------------------------------------------------------
// ModelRouter class
// ---------------------------------------------------------------------------

interface ModelRouterEvents {
  'router:attempt': (attempt: {
    provider: string;
    model: string;
    attemptNumber: number;
  }) => void;
  'router:retry': (info: {
    provider: string;
    model: string;
    attempt: number;
    delayMs: number;
    error: string;
  }) => void;
  'router:success': (result: {
    provider: string;
    model: string;
    attempts: number;
    latencyMs: number;
  }) => void;
  'router:failover': (attempt: FailoverAttempt) => void;
  'router:exhausted': (attempts: FailoverAttempt[]) => void;
  'router:cost': (cost: CostRecord) => void;
  'router:context_warning': (validation: ContextValidation) => void;
  'router:budget_warning': (sessionId: string, check: BudgetCheck) => void;
  'router:budget_exceeded': (sessionId: string, check: BudgetCheck) => void;
  'router:circuit_opened': (provider: string) => void;
  'router:circuit_closed': (provider: string) => void;
}

export class ModelRouter extends EventEmitter<ModelRouterEvents> {
  private readonly registry: ProviderRegistry;
  private readonly authManager: AuthProfileManager;
  private readonly tokenCounter: TokenCounter;
  private readonly streamingAdapter: StreamingAdapter;
  private readonly healthTracker: ProviderHealthTracker;
  private readonly budgetManager: TokenBudgetManager;
  private readonly clientFactory: (
    provider: string,
    config: { apiKey: string; baseUrl?: string }
  ) => LLMClient;
  private readonly clientCache: Map<string, LLMClient> = new Map();

  private readonly primaryRef: ModelRef;
  private readonly fallbacks: ModelRef[];
  private readonly defaultThinkingMode: ThinkingMode;
  private readonly defaultRoutingStrategy: RoutingStrategy;
  private readonly retryConfig: Partial<RetryConfig>;

  constructor(config: ModelRouterConfig) {
    super();
    this.registry = new ProviderRegistry(config.registry);
    this.authManager = new AuthProfileManager(config.auth);
    this.tokenCounter = new TokenCounter(config.tokenCounter);
    this.streamingAdapter = new StreamingAdapter();
    this.healthTracker = new ProviderHealthTracker(config.providerHealth);
    this.budgetManager = new TokenBudgetManager(config.tokenBudget);
    this.clientFactory = config.clientFactory;
    this.defaultThinkingMode = config.defaultThinkingMode ?? 'off';
    this.defaultRoutingStrategy = config.defaultRoutingStrategy ?? 'failover';
    this.retryConfig = config.retry ?? {};

    // Wire up health tracker events to router events
    this.healthTracker.on('circuit:opened', provider => {
      this.emit('router:circuit_opened', provider);
    });
    this.healthTracker.on('circuit:closed', provider => {
      this.emit('router:circuit_closed', provider);
    });

    // Wire up budget events
    this.budgetManager.on('budget:warning', (sessionId, check) => {
      this.emit('router:budget_warning', sessionId, check);
    });
    this.budgetManager.on('budget:exceeded', (sessionId, check) => {
      this.emit('router:budget_exceeded', sessionId, check);
    });

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
    const routeStartTime = Date.now();

    // Check session budget before attempting any model
    if (request.sessionId) {
      const budgetCheck = this.budgetManager.checkBudget(request.sessionId);
      if (!budgetCheck.allowed) {
        throw new BudgetExceededError(request.sessionId, budgetCheck);
      }
    }

    const candidates = this.resolveCandidates(request);
    const thinkingMode = this.resolveThinkingMode(request);
    const attempts: FailoverAttempt[] = [];
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      // Circuit breaker check
      if (!this.healthTracker.isAvailable(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `Provider ${candidate.provider} circuit is open (health check failed)`,
          reason: 'network',
        });
        continue;
      }

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
      const contextWindow = this.registry.getContextWindow(
        candidate.provider,
        candidate.model
      );
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

      // Acquire concurrency slot
      if (!this.healthTracker.acquireSlot(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: `Provider ${candidate.provider} concurrency limit reached`,
          reason: 'rate_limit',
        });
        continue;
      }

      this.emit('router:attempt', {
        provider: candidate.provider,
        model: candidate.model,
        attemptNumber: i + 1,
      });

      const attemptStartTime = Date.now();
      let retryCount = 0;

      try {
        const client = this.getOrCreateClient(candidate.provider, profile);
        const chatParams = this.buildChatParams(
          request,
          candidate,
          thinkingMode
        );

        // Retry loop for transient errors within the same candidate
        const { result: response } = await withRetry(
          async () => {
            return client.chat(chatParams);
          },
          {
            ...this.retryConfig,
            signal: request.signal,
            isRetryable: err => {
              const reason = classifyFailoverReason(err);
              return reason !== null && isRetryableReason(reason);
            },
            onRetry: (err, attempt, delayMs) => {
              retryCount = attempt;
              const errorMsg = err instanceof Error ? err.message : String(err);
              this.emit('router:retry', {
                provider: candidate.provider,
                model: candidate.model,
                attempt,
                delayMs,
                error: errorMsg,
              });
            },
          }
        );

        const attemptLatencyMs = Date.now() - attemptStartTime;

        // Release concurrency slot and record health
        this.healthTracker.releaseSlot(candidate.provider);
        this.healthTracker.recordSuccess(candidate.provider, attemptLatencyMs);

        // Mark profile as successfully used
        this.authManager.markUsed(profile.id);

        // Calculate cost
        const cost = this.calculateCost(
          candidate,
          profile.id,
          response.usage,
          request.sessionId,
          attemptLatencyMs
        );
        this.emit('router:cost', cost);

        // Record usage in budget tracker
        if (request.sessionId) {
          this.budgetManager.recordUsage({
            sessionId: request.sessionId,
            inputTokens: response.usage.promptTokens,
            outputTokens: response.usage.completionTokens,
            costUsd: cost.totalCostUsd,
          });
        }

        const budgetCheck = request.sessionId
          ? this.budgetManager.checkBudget(request.sessionId)
          : null;

        this.emit('router:success', {
          provider: candidate.provider,
          model: candidate.model,
          attempts: i + 1,
          latencyMs: attemptLatencyMs,
        });

        return {
          response,
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          attempts,
          cost,
          contextValidation,
          budgetCheck,
          providerHealth: this.healthTracker.getSnapshot(candidate.provider),
          thinkingMode,
          totalLatencyMs: Date.now() - routeStartTime,
        };
      } catch (err) {
        const attemptLatencyMs = Date.now() - attemptStartTime;

        // Release concurrency slot
        this.healthTracker.releaseSlot(candidate.provider);

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

        // Record health failure
        this.healthTracker.recordFailure(candidate.provider, attemptLatencyMs);

        // Mark profile failure with appropriate reason
        this.authManager.markFailure(profile.id, failoverErr.reason);

        // On rate limit, try rotating to next auth profile for same provider
        if (failoverErr.reason === 'rate_limit') {
          const alternateProfile = this.authManager.getNextProfile(
            candidate.provider
          );
          if (alternateProfile && alternateProfile.id !== profile.id) {
            // Re-attempt with alternate profile (inline, not via main loop)
            const retryResult = await this.attemptWithProfile(
              request,
              candidate,
              alternateProfile,
              thinkingMode,
              routeStartTime
            );
            if (retryResult) {
              // Clear the attempt we're about to push since we recovered
              return retryResult;
            }
          }
        }

        const attempt: FailoverAttempt = {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: failoverErr.message,
          reason: failoverErr.reason,
          status: failoverErr.status,
          code: failoverErr.code,
          latencyMs: attemptLatencyMs,
          retries: retryCount,
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
  async *routeStream(
    request: RoutingRequest
  ): AsyncIterableIterator<StreamEvent> {
    // Check session budget before attempting any model
    if (request.sessionId) {
      const budgetCheck = this.budgetManager.checkBudget(request.sessionId);
      if (!budgetCheck.allowed) {
        throw new BudgetExceededError(request.sessionId, budgetCheck);
      }
    }

    const candidates = this.resolveCandidates(request);
    const thinkingMode = this.resolveThinkingMode(request);
    const attempts: FailoverAttempt[] = [];
    let lastError: unknown;

    // Filter to only streaming-capable candidates
    const streamCandidates = candidates.filter(c => {
      return this.registry.supportsCapability(c.provider, c.model, 'streaming');
    });

    const effectiveCandidates =
      streamCandidates.length > 0 ? streamCandidates : candidates;

    for (let i = 0; i < effectiveCandidates.length; i++) {
      const candidate = effectiveCandidates[i];

      // Circuit breaker check
      if (!this.healthTracker.isAvailable(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `Provider ${candidate.provider} circuit is open`,
          reason: 'network',
        });
        continue;
      }

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

      const contextWindow = this.registry.getContextWindow(
        candidate.provider,
        candidate.model
      );
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

      // Acquire concurrency slot
      if (!this.healthTracker.acquireSlot(candidate.provider)) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: `Provider ${candidate.provider} concurrency limit reached`,
          reason: 'rate_limit',
        });
        continue;
      }

      this.emit('router:attempt', {
        provider: candidate.provider,
        model: candidate.model,
        attemptNumber: i + 1,
      });

      const streamStartTime = Date.now();

      try {
        const client = this.getOrCreateClient(candidate.provider, profile);
        const chatParams = this.buildChatParams(
          request,
          candidate,
          thinkingMode
        );
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

        const streamLatencyMs = Date.now() - streamStartTime;

        // Release concurrency slot and record health
        this.healthTracker.releaseSlot(candidate.provider);
        this.healthTracker.recordSuccess(candidate.provider, streamLatencyMs);

        // Mark profile as used on successful stream completion
        this.authManager.markUsed(profile.id);

        // Track cost
        if (streamUsage) {
          const cost = this.calculateCost(
            candidate,
            profile.id,
            streamUsage,
            request.sessionId,
            streamLatencyMs
          );
          this.emit('router:cost', cost);

          // Record usage in budget tracker
          if (request.sessionId) {
            this.budgetManager.recordUsage({
              sessionId: request.sessionId,
              inputTokens: streamUsage.promptTokens,
              outputTokens: streamUsage.completionTokens,
              costUsd: cost.totalCostUsd,
            });
          }
        }

        this.emit('router:success', {
          provider: candidate.provider,
          model: candidate.model,
          attempts: i + 1,
          latencyMs: streamLatencyMs,
        });

        return; // Stream completed successfully
      } catch (err) {
        const streamLatencyMs = Date.now() - streamStartTime;

        // Release concurrency slot
        this.healthTracker.releaseSlot(candidate.provider);

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

        // Record health failure
        this.healthTracker.recordFailure(candidate.provider, streamLatencyMs);
        this.authManager.markFailure(profile.id, failoverErr.reason);

        const attempt: FailoverAttempt = {
          provider: candidate.provider,
          model: candidate.model,
          profileId: profile.id,
          error: failoverErr.message,
          reason: failoverErr.reason,
          status: failoverErr.status,
          code: failoverErr.code,
          latencyMs: streamLatencyMs,
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

  getHealthTracker(): ProviderHealthTracker {
    return this.healthTracker;
  }

  getBudgetManager(): TokenBudgetManager {
    return this.budgetManager;
  }

  // -------------------------------------------------------------------------
  // Session budget management (convenience delegates)
  // -------------------------------------------------------------------------

  /**
   * Set a token budget for a session.
   */
  setSessionBudget(sessionId: string, budget: Partial<SessionBudget>): void {
    this.budgetManager.setSessionBudget(sessionId, budget);
  }

  /**
   * Check budget status for a session.
   */
  checkSessionBudget(sessionId: string): BudgetCheck {
    return this.budgetManager.checkBudget(sessionId);
  }

  /**
   * Reset budget tracking for a session.
   */
  resetSessionBudget(sessionId: string): void {
    this.budgetManager.resetUsage(sessionId);
  }

  // -------------------------------------------------------------------------
  // Provider health management (convenience delegates)
  // -------------------------------------------------------------------------

  /**
   * Get health snapshot for a provider.
   */
  getProviderHealth(provider: string): ProviderHealthSnapshot {
    return this.healthTracker.getSnapshot(provider);
  }

  /**
   * Get health snapshots for all tracked providers.
   */
  getAllProviderHealth(): ProviderHealthSnapshot[] {
    return this.healthTracker.getAllSnapshots();
  }

  /**
   * Manually reset a provider's circuit breaker.
   */
  resetProviderCircuit(provider: string): void {
    this.healthTracker.resetCircuit(provider);
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
      // Check required capabilities
      if (
        request.requiredCapabilities &&
        !this.matchesCapabilities(ref, request.requiredCapabilities)
      ) {
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

    // 5. Apply routing strategy to reorder candidates
    const strategy = request.routingStrategy ?? this.defaultRoutingStrategy;
    return this.applySortingStrategy(candidates, strategy);
  }

  /**
   * Check whether a model reference meets the required capabilities.
   */
  private matchesCapabilities(
    ref: ModelRef,
    required: RequiredCapabilities
  ): boolean {
    const caps = this.registry.getModelCapabilities(ref.provider, ref.model);
    if (!caps) {
      // Unknown model -- allow by default (it may be a custom model)
      return true;
    }
    if (required.vision && !caps.vision) {
      return false;
    }
    if (required.toolCalling && !caps.toolCalling) {
      return false;
    }
    if (required.streaming && !caps.streaming) {
      return false;
    }
    if (required.reasoning && !caps.reasoning) {
      return false;
    }
    if (required.jsonMode && !caps.jsonMode) {
      return false;
    }
    if (required.minContextWindow) {
      const window = this.registry.getContextWindow(ref.provider, ref.model);
      if (window < required.minContextWindow) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reorder candidates based on the selected routing strategy.
   * The first candidate (explicit override or thinking-preferred) is always
   * kept at position 0 to respect user intent.
   */
  private applySortingStrategy(
    candidates: ModelRef[],
    strategy: RoutingStrategy
  ): ModelRef[] {
    if (candidates.length <= 1 || strategy === 'failover') {
      return candidates;
    }

    // Preserve the first candidate if it was an explicit override
    const first = candidates[0];
    const rest = candidates.slice(1);

    const scored = rest.map(ref => ({
      ref,
      score: this.scoreCandidateForStrategy(ref, strategy),
    }));

    // Sort by score descending (higher score = better candidate)
    scored.sort((a, b) => b.score - a.score);

    return [first, ...scored.map(s => s.ref)];
  }

  /**
   * Score a candidate model for a given routing strategy.
   * Higher scores indicate better candidates.
   */
  private scoreCandidateForStrategy(
    ref: ModelRef,
    strategy: RoutingStrategy
  ): number {
    const pricing = this.registry.getModelPricing(ref.provider, ref.model);
    const health = this.healthTracker.getSnapshot(ref.provider);
    const latencyP50 = health.latencyP50Ms ?? 5_000; // Default 5s if no data

    // Cost score: inverse of cost per million tokens (cheaper = higher score)
    const avgCostPerM = pricing ? (pricing.input + pricing.output) / 2 : 10; // Default moderate cost
    const costScore = 100 / Math.max(0.01, avgCostPerM);

    // Latency score: inverse of P50 latency (faster = higher score)
    const latencyScore = 10_000 / Math.max(100, latencyP50);

    // Health score: penalize providers with open circuits or high failure rates
    let healthScore = 100;
    if (health.state === 'open') {
      healthScore = 0;
    } else if (health.state === 'half_open') {
      healthScore = 30;
    } else if (health.totalRequests > 0) {
      const successRate = 1 - health.totalFailures / health.totalRequests;
      healthScore = successRate * 100;
    }

    switch (strategy) {
      case 'cost_optimized':
        return costScore * 10 + healthScore + latencyScore * 0.1;
      case 'latency_optimized':
        return latencyScore * 10 + healthScore + costScore * 0.1;
      case 'balanced':
        return costScore * 3 + latencyScore * 3 + healthScore * 4;
      default:
        return 0;
    }
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
  // Auth profile failover (rate limit recovery)
  // -------------------------------------------------------------------------

  /**
   * Attempt a request with a specific auth profile. Used for inline rate
   * limit recovery (rotate key within the same provider).
   */
  private async attemptWithProfile(
    request: RoutingRequest,
    candidate: ModelRef,
    profile: AuthProfile,
    thinkingMode: ThinkingMode,
    routeStartTime: number
  ): Promise<RoutingResult | null> {
    const attemptStartTime = Date.now();

    // Acquire concurrency slot
    if (!this.healthTracker.acquireSlot(candidate.provider)) {
      return null;
    }

    try {
      const client = this.getOrCreateClient(candidate.provider, profile);
      const chatParams = this.buildChatParams(request, candidate, thinkingMode);
      const response = await client.chat(chatParams);
      const attemptLatencyMs = Date.now() - attemptStartTime;

      this.healthTracker.releaseSlot(candidate.provider);
      this.healthTracker.recordSuccess(candidate.provider, attemptLatencyMs);
      this.authManager.markUsed(profile.id);

      const contextWindow = this.registry.getContextWindow(
        candidate.provider,
        candidate.model
      );
      const contextValidation = this.tokenCounter.checkRequest({
        systemPrompt: request.systemPrompt,
        messages: request.messages,
        tools: request.tools,
        maxOutputTokens: request.maxTokens,
        contextWindow,
      });

      const cost = this.calculateCost(
        candidate,
        profile.id,
        response.usage,
        request.sessionId,
        attemptLatencyMs
      );
      this.emit('router:cost', cost);

      if (request.sessionId) {
        this.budgetManager.recordUsage({
          sessionId: request.sessionId,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          costUsd: cost.totalCostUsd,
        });
      }

      const budgetCheck = request.sessionId
        ? this.budgetManager.checkBudget(request.sessionId)
        : null;

      return {
        response,
        provider: candidate.provider,
        model: candidate.model,
        profileId: profile.id,
        attempts: [],
        cost,
        contextValidation,
        budgetCheck,
        providerHealth: this.healthTracker.getSnapshot(candidate.provider),
        thinkingMode,
        totalLatencyMs: Date.now() - routeStartTime,
      };
    } catch {
      this.healthTracker.releaseSlot(candidate.provider);
      return null;
    }
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
    thinkingMode: ThinkingMode
  ): ChatParams {
    const messages = [...request.messages];

    // Prepend system prompt as system message if provided
    if (request.systemPrompt) {
      const hasSystemMessage = messages.some(m => m.role === 'system');
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
        candidate.model
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
      providerParams:
        Object.keys(providerParams).length > 0 ? providerParams : undefined,
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
    latencyMs?: number
  ): CostRecord {
    const pricing = this.registry.getModelPricing(
      candidate.provider,
      candidate.model
    );
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
      latencyMs,
    };
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    this.clientCache.clear();
    this.tokenCounter.destroy();
    this.healthTracker.clear();
    this.budgetManager.clear();
    this.removeAllListeners();
  }
}
