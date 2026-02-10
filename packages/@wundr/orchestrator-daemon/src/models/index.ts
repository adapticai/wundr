/**
 * Model Routing Module
 *
 * Public API for the model routing system with failover, auth profile
 * rotation, streaming, token counting, cost tracking, provider health
 * monitoring, token budget management, and retry utilities.
 */

// -- Model Router (primary entry point) --
export {
  ModelRouter,
  RoutingError,
  FailoverError,
  RoutingExhaustedError,
  ContextOverflowError,
  BudgetExceededError,
} from './model-router';

export type {
  ThinkingMode,
  TaskComplexity,
  RequiredCapabilities,
  RoutingStrategy,
  RoutingRequest,
  RoutingResult,
  FailoverAttempt,
  CostRecord,
  ModelRouterConfig,
} from './model-router';

// -- Provider Registry --
export {
  ProviderRegistry,
  normalizeProviderId,
  parseModelRef,
  modelKey,
} from './provider-registry';

export type {
  ProviderKind,
  ModelEntry,
  ModelRef,
  ModelPricing,
  ModelCapabilities,
  ProviderConfig,
  ProviderRegistryConfig,
} from './provider-registry';

// -- Auth Profiles --
export {
  AuthProfileManager,
  calculateCooldownMs,
  calculateBillingDisableMs,
} from './auth-profiles';

export type {
  AuthProfile,
  CredentialType,
  FailureReason,
  ProfileUsageStats,
  AuthProfileStoreData,
  AuthProfileManagerConfig,
} from './auth-profiles';

// -- Streaming --
export {
  StreamingAdapter,
  formatSSE,
  formatWSMessage,
} from './streaming';

export type {
  StreamEvent,
  StreamEventType,
  StreamStartEvent,
  ContentDeltaEvent,
  ThinkingDeltaEvent,
  ToolCallStartEvent,
  ToolCallDeltaEvent,
  ToolCallEndEvent,
  UsageUpdateEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamResult,
} from './streaming';

// -- Token Counter --
export {
  TokenCounter,
  CONTEXT_WINDOW_HARD_MIN_TOKENS,
  CONTEXT_WINDOW_WARN_BELOW_TOKENS,
} from './token-counter';

export type {
  ContextWindowSource,
  ContextWindowInfo,
  ContextValidation,
  TokenEstimate,
  TokenCounterConfig,
} from './token-counter';

// -- Provider Health (circuit breaker, latency tracking, concurrency) --
export {
  ProviderHealthTracker,
} from './provider-health';

export type {
  CircuitState,
  ProviderHealthConfig,
  ProviderHealthSnapshot,
} from './provider-health';

// -- Token Budget (per-session budget enforcement) --
export {
  TokenBudgetManager,
} from './token-budget';

export type {
  BudgetWindowKind,
  SessionBudget,
  SessionUsage,
  BudgetCheck,
  TokenBudgetConfig,
} from './token-budget';

// -- Retry (exponential backoff with jitter) --
export {
  withRetry,
  calculateBackoffMs,
  isTransientError,
  DEFAULT_RETRY_CONFIG,
} from './retry';

export type {
  RetryConfig,
  RetryResult,
} from './retry';
