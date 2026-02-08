/**
 * Model Routing Module
 *
 * Public API for the model routing system with failover, auth profile
 * rotation, streaming, token counting, and cost tracking.
 */

// -- Model Router (primary entry point) --
export {
  ModelRouter,
  RoutingError,
  FailoverError,
  RoutingExhaustedError,
  ContextOverflowError,
} from './model-router';

export type {
  ThinkingMode,
  TaskComplexity,
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
