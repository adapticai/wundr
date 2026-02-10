/**
 * Orchestrator Daemon - Orchestrator Daemon for agent orchestration
 *
 * Main entry point for the Orchestrator Daemon package
 */

/* eslint-disable import/export -- barrel file intentionally re-exports with disambiguation */

// Core Components
export { OrchestratorDaemon } from './core/orchestrator-daemon';
export { OrchestratorWebSocketServer } from './core/websocket-server';

// Session Management
export { SessionManager } from './session/session-manager';
export { SessionExecutor } from './session/session-executor';
export { ToolExecutor } from './session/tool-executor';

// Memory Management
export { MemoryManager } from './memory/memory-manager';
export {
  ContextCompactor,
  createContextCompactor,
  estimateMessageTokens,
  estimateMessagesTokens,
  resolveContextWindowTokens,
  classifyMessageImportance,
  splitMessagesByTokenShare,
  chunkMessagesByMaxTokens,
  computeAdaptiveChunkRatio,
  isOversizedForSummary,
  pruneToolResults,
  pruneHistoryForContextShare,
  DEFAULT_CONTEXT_COMPACTOR_CONFIG,
} from './memory/context-compactor';
export type {
  ConversationMessage,
  ContentBlock,
  MessageRole,
  MessageImportance,
  ModelCompactionThreshold,
  ContextCompactorConfig,
  ContextPruningConfig,
  MemoryFlushConfig,
  SummarizeFn,
  CompactionResult,
  CompactionMetadata,
  ToolFailureInfo,
  PreCompactHookResult,
  PreCompactListener,
  PruneHistoryResult,
} from './memory/context-compactor';

// LLM Clients
export { OpenAIClient, createOpenAIClient } from './llm';
export type { OpenAIClientConfig } from './llm';

// MCP Integration
export {
  McpToolRegistry,
  McpToolDefinition,
  ToolResult,
  McpToolRegistryImpl,
  createMcpToolRegistry,
} from './mcp';

// Neolith API Client
export { NeolithApiClient } from './neolith';
export type {
  AuthResponse,
  RefreshResponse,
  HeartbeatMetrics,
  HeartbeatOptions,
  HeartbeatResponse,
  MessageAuthor,
  MessageAttachment,
  Message,
  GetMessagesOptions,
  MessagesResponse,
  SendMessageOptions,
  SendMessageResponse,
  OrchestratorStatus,
  UpdateStatusOptions,
  OrchestratorConfig,
  ApiError,
  NeolithApiConfig,
  RequestOptions,
} from './neolith';

// Configuration
export {
  loadConfig,
  validateRequiredEnv,
  getConfig,
  resetConfig,
  ConfigSchema,
} from './config';
export type { Config } from './config';

// Utilities
export { Logger, LogLevel } from './utils/logger';

// Export all types (except DaemonMetrics which is re-exported from monitoring)
export type {
  DaemonConfig,
  OrchestratorCharter,
  Task,
  Session,
  MemoryContext,
  MemoryEntry,
  SessionMetrics,
  DaemonStatus,
  SubsystemStatus,
  WSMessage,
  SpawnSessionPayload,
  WSResponse,
  MemoryTier,
  MemoryConfig,
  TierConfig,
} from './types';

// Re-export types from session executors
export type {
  SessionExecutionOptions,
  SessionExecutionResult,
} from './session/session-executor';

export type {
  ToolExecutionResult,
} from './session/tool-executor';

// Export federation module
export * from './federation';

// Export distributed module
export * from './distributed';

// Export monitoring module
export {
  daemonMetrics,
  MetricsRegistry,
  metricsRegistry,
  recordSessionActive,
  recordTokensUsed,
  recordMessageLatency,
  recordToolInvocation,
  recordFederationDelegation,
  recordNodeLoad,
  recordError,
  recordBudgetUtilization,
  MetricsCollector,
  createMetricsCollector,
  MetricsServer,
  createMetricsServer,
} from './monitoring';

export type {
  CollectorConfig,
  AggregatedStats,
  TimerFunction,
  HealthStatus,
  HealthResponse,
  ReadinessResponse,
  HealthCheckFunction,
  HealthChecks,
  MetricsServerConfig,
  IMetricsRegistry,
  SessionLabels,
  TokenLabels,
  LatencyLabels,
  ToolLabels,
  FederationLabels,
  NodeLabels,
  ErrorLabels,
  BudgetLabels,
  MetricConfig,
  CollectedMetrics,
} from './monitoring';

// Re-export DaemonMetrics from monitoring to avoid conflict with types/index.ts
export type { DaemonMetrics } from './monitoring/types';

// Export budget module
export * from './budget';

// Export task management module
export * from './tasks';

// ===========================================================================
// Wave 3 Modules
// ===========================================================================

// ---------------------------------------------------------------------------
// Auth (JWT, authenticator, middleware, rate-limiter)
// ---------------------------------------------------------------------------
export * from './auth';

// ---------------------------------------------------------------------------
// Security (exec-approvals, redact, tool-policy, audit, validation, skill-scanner)
// Note: Also exports SkillScanSeverity/Finding/Summary and PluginManifestSchema
//       which take precedence over duplicates in ./skills and ./plugins.
// ---------------------------------------------------------------------------
export * from './security';

// ---------------------------------------------------------------------------
// Hooks (hook-engine, hook-registry, hook-types, built-in-hooks)
// Note: Exports HookType which takes precedence over ./teams' HookType.
// ---------------------------------------------------------------------------
export * from './hooks';

// ---------------------------------------------------------------------------
// Streaming (anthropic-stream, openai-stream, block-parser, stream-handler, ws-relay)
// Note: Exports StreamEvent/StreamStartEvent/ThinkingDeltaEvent/StreamEndEvent/
//       StreamErrorEvent which take precedence over ./models' identically-named types.
// ---------------------------------------------------------------------------
export * from './streaming';

// ---------------------------------------------------------------------------
// Channels (types, registry, router, media-pipeline, adapters)
// ---------------------------------------------------------------------------
export * from './channels';

// ---------------------------------------------------------------------------
// Agents (agent-types, agent-loader, agent-registry, agent-lifecycle)
// ---------------------------------------------------------------------------
export * from './agents';

// ---------------------------------------------------------------------------
// Protocol (protocol-v2, rpc-handler, subscription-manager, message-router)
// Named re-exports: AuthResult renamed to ProtocolAuthResult to avoid
// collision with ./auth's AuthResult.
// ---------------------------------------------------------------------------
export {
  // Constants
  PROTOCOL_VERSION,
  MAX_PAYLOAD_BYTES,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  MAX_BUFFERED_BYTES,
  BINARY_HEADER_VERSION,
  BINARY_HEADER_FIXED_SIZE,
  BinaryFlags,

  // Error codes
  ErrorCodes,
  ErrorShapeSchema,
  errorShape,

  // Scopes
  Scopes,
  ScopeSchema,
  expandScopes,
  hasRequiredScopes,

  // Frame schemas
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
  ProtocolFrameSchema,

  // Binary metadata
  BinaryMetadataSchema,

  // Auth domain
  AuthTypeSchema,
  ClientInfoSchema,
  AuthConnectParamsSchema,
  HelloPayloadSchema,
  AuthRefreshParamsSchema,
  AuthLogoutParamsSchema,

  // Session domain
  SessionTypeSchema,
  SessionCreateParamsSchema,
  SessionResumeParamsSchema,
  SessionStopParamsSchema,
  SessionListParamsSchema,
  SessionStatusParamsSchema,

  // Prompt domain
  PromptSubmitParamsSchema,
  PromptCancelParamsSchema,

  // Stream events
  StreamChunkTypeSchema,
  StreamStartPayloadSchema,
  StreamChunkPayloadSchema,
  StreamEndPayloadSchema,
  StreamErrorPayloadSchema,

  // Tool domain
  ToolRequestPayloadSchema,
  ToolApproveParamsSchema,
  ToolDenyParamsSchema,
  ToolResultPayloadSchema,
  ToolStatusPayloadSchema,

  // Agent domain
  AgentSpawnParamsSchema,
  AgentStatusParamsSchema,
  AgentStatusPayloadSchema,
  AgentStopParamsSchema,

  // Team domain
  TeamCreateParamsSchema,
  TeamStatusParamsSchema,
  TeamStatusPayloadSchema,
  TeamMessageParamsSchema,
  TeamDissolveParamsSchema,

  // Memory domain
  MemoryQueryParamsSchema,
  MemoryStoreParamsSchema,
  MemoryDeleteParamsSchema,

  // Config domain
  ConfigGetParamsSchema,
  ConfigSetParamsSchema,

  // Health domain
  HealthPingParamsSchema,
  HealthPongPayloadSchema,
  HealthStatusPayloadSchema,
  HeartbeatPayloadSchema,

  // Subscription domain
  SubscribeParamsSchema,
  SubscribeResultSchema,
  UnsubscribeParamsSchema,

  // Catalogs
  PROTOCOL_V2_METHODS,
  PROTOCOL_V2_EVENTS,
  METHOD_SCOPE_MAP,
  METHOD_PARAM_SCHEMAS,

  // RPC handler
  RpcHandler,
  createSubscriptionHandlers,
  createHealthPingHandler,

  // Subscription manager
  SubscriptionManager,
  compileGlob,

  // Message router
  MessageRouter,
} from './protocol';

export type {
  // Error codes
  ErrorCode,
  ErrorShape,

  // Scopes
  Scope,

  // Frames
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ProtocolFrame,

  // Binary metadata
  BinaryMetadata,

  // Auth domain
  ClientInfo,
  AuthConnectParams,
  HelloPayload,
  AuthRefreshParams,
  AuthLogoutParams,

  // Session domain
  SessionCreateParams,
  SessionResumeParams,
  SessionStopParams,
  SessionListParams,
  SessionStatusParams,

  // Prompt domain
  PromptSubmitParams,
  PromptCancelParams,

  // Stream events
  StreamStartPayload,
  StreamChunkPayload,
  StreamEndPayload,
  StreamErrorPayload,

  // Tool domain
  ToolRequestPayload,
  ToolApproveParams,
  ToolDenyParams,
  ToolResultPayload,
  ToolStatusPayload,

  // Agent domain
  AgentSpawnParams,
  AgentStatusParams,
  AgentStatusPayload,
  AgentStopParams,

  // Team domain
  TeamCreateParams,
  TeamStatusParams,
  TeamStatusPayload,
  TeamMessageParams,
  TeamDissolveParams,

  // Memory domain
  MemoryQueryParams,
  MemoryStoreParams,
  MemoryDeleteParams,

  // Config domain
  ConfigGetParams,
  ConfigSetParams,

  // Health domain
  HealthPingParams,
  HealthPongPayload,
  HealthStatusPayload,
  HeartbeatPayload,

  // Subscription domain
  SubscribeParams,
  SubscribeResult,
  UnsubscribeParams,

  // Catalogs
  ProtocolMethod,
  ProtocolEvent,

  // RPC handler
  HandlerContext,
  MethodHandler,
  MethodHandlerMap,

  // Subscription manager
  Subscription,
  EventSink,

  // Message router -- AuthResult renamed to avoid collision with ./auth
  AuthenticateFunc,
  AuthResult as ProtocolAuthResult,
  TransportCallbacks,
  MessageRouterConfig,
  RouterLogger,
  BinaryFrameHandler,
} from './protocol';

// ---------------------------------------------------------------------------
// Teams (team-coordinator, mailbox, shared-task-list, team-hooks)
// Named re-exports: HookType renamed to TeamHookType to avoid collision
// with ./hooks' HookType.
// ---------------------------------------------------------------------------
export {
  // Team Coordinator
  TeamCoordinator,
  TeamError,
  TeamErrorCode,

  // Shared Task List
  SharedTaskList,
  TaskListError,
  TaskListErrorCode,

  // Mailbox
  Mailbox,
  MailboxError,
  MailboxErrorCode,

  // Team Hooks
  TeamHooks,
} from './teams';

export type {
  // Team Coordinator
  TeammateMode,
  BackendType,
  TeamStatus,
  TeammateStatus,
  TeamConfig,
  TeamMember,
  CreateTeamInput,
  SpawnTeammateOptions,
  TeamSessionManager,
  TeamCoordinatorEvents,

  // Shared Task List
  SharedTaskStatus,
  SharedTaskPriority,
  SharedTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilter,
  SharedTaskListEvents,
  TaskCompletedHookFn,

  // Mailbox
  MessagePriority,
  MessageType,
  TeamMessage,
  SendMessageInput,
  BroadcastOptions,
  MessageFilter,
  MailboxEvents,
  TeammateIdleHookFn,

  // Team Hooks -- HookType renamed to avoid collision with ./hooks
  HookType as TeamHookType,
  HookExitCode,
  HookExecutionMode,
  HookConfig,
  HookResult,
  TeammateIdleHookContext,
  TaskCompletedHookContext,
  HookHandlerFn,
  TeamHooksEvents,
} from './teams';

// ---------------------------------------------------------------------------
// Skills (skill-loader, skill-registry, skill-executor, skill-scanner)
// Named re-exports: SkillScanSeverity, SkillScanFinding, SkillScanSummary
// are already exported by ./security. formatScanReport renamed to
// formatSkillScanReport to avoid collision with ./plugins.
// ---------------------------------------------------------------------------
export {
  // Loader
  parseFrontmatter,
  resolveWundrMetadata,
  resolveInvocationPolicy,
  resolveSkillFrontmatter,
  loadSkillsFromDir,
  loadAllSkillEntries,
  resolveBundledSkillsDir,
  formatSkillsForPrompt,

  // Scanner
  isScannable,
  scanSource,
  scanSkillBody,
  scanDirectory,
  scanDirectoryWithSummary,
  scanSkillComplete,
  hasCriticalFindings,
  formatScanReport as formatSkillScanReport,

  // Registry
  SkillRegistry,

  // Executor
  SkillExecutor,
  parseSkillCommand,
  findMatchingSkill,
} from './skills';

export type {
  // Core types
  Skill,
  SkillEntry,
  SkillSource,
  SkillFrontmatter,
  ParsedSkillFrontmatter,

  // Metadata
  WundrSkillMetadata,
  SkillInstallSpec,
  SkillInvocationPolicy,

  // Registry
  SkillSnapshot,
  SkillCommandSpec,
  SkillEligibilityContext,
  SkillRegistryEvents,

  // Execution
  SkillExecutionOptions,
  SkillExecutionResult,

  // Scanner (SkillScanSeverity, SkillScanFinding, SkillScanSummary
  // already exported via ./security)
  SkillScanOptions,

  // Configuration
  SkillConfigEntry,
  SkillsConfig,
  SkillsChangeEvent,

  // Search
  SkillSearchQuery,
  SkillSearchResult,

  // Command Execution
  CommandExecutionResult,
  CommandExecutionOptions,
} from './skills';

// ---------------------------------------------------------------------------
// Models (model-router, auth-profiles, provider-registry, token-counter)
// Named re-exports: Stream types renamed with Model* prefix to avoid
// collision with ./streaming's identically-named types.
// ---------------------------------------------------------------------------
export {
  // Model Router
  ModelRouter,
  RoutingError,
  FailoverError,
  RoutingExhaustedError,
  ContextOverflowError,

  // Provider Registry
  ProviderRegistry,
  normalizeProviderId,
  parseModelRef,
  modelKey,

  // Auth Profiles
  AuthProfileManager,
  calculateCooldownMs,
  calculateBillingDisableMs,

  // Streaming
  StreamingAdapter,
  formatSSE,
  formatWSMessage,

  // Token Counter
  TokenCounter,
  CONTEXT_WINDOW_HARD_MIN_TOKENS,
  CONTEXT_WINDOW_WARN_BELOW_TOKENS,
} from './models';

export type {
  // Model Router
  ThinkingMode,
  TaskComplexity,
  RoutingRequest,
  RoutingResult,
  FailoverAttempt,
  CostRecord,
  ModelRouterConfig,

  // Provider Registry
  ProviderKind,
  ModelEntry,
  ModelRef,
  ModelPricing,
  ModelCapabilities,
  ProviderConfig,
  ProviderRegistryConfig,

  // Auth Profiles
  AuthProfile,
  CredentialType,
  FailureReason,
  ProfileUsageStats,
  AuthProfileStoreData,
  AuthProfileManagerConfig,

  // Streaming -- renamed to avoid collision with ./streaming types
  StreamEvent as ModelStreamEvent,
  StreamEventType as ModelStreamEventType,
  StreamStartEvent as ModelStreamStartEvent,
  ContentDeltaEvent,
  ThinkingDeltaEvent as ModelThinkingDeltaEvent,
  ToolCallStartEvent,
  ToolCallDeltaEvent,
  ToolCallEndEvent,
  UsageUpdateEvent,
  StreamEndEvent as ModelStreamEndEvent,
  StreamErrorEvent as ModelStreamErrorEvent,
  StreamResult,

  // Token Counter
  ContextWindowSource,
  ContextWindowInfo,
  ContextValidation,
  TokenEstimate,
  TokenCounterConfig,
} from './models';

// ---------------------------------------------------------------------------
// Plugins (plugin-manifest, plugin-scanner, permission-system, sandbox, lifecycle)
// Named re-exports: PluginManifestSchema renamed to PluginManifestSchemaV2
// to avoid collision with ./security's PluginManifestSchema.
// formatScanReport renamed to formatPluginScanReport to avoid collision
// with ./skills.
// ---------------------------------------------------------------------------
export {
  // Lifecycle Manager
  PluginLifecycleManager,

  // Manifest
  loadManifest,
  verifyPluginIntegrity,
  DEFAULT_SYSTEM_POLICY,

  // Scanner -- formatScanReport renamed to avoid collision with ./skills
  scanPluginDirectory,
  formatScanReport as formatPluginScanReport,

  // Sandbox
  createSandboxedPlugin,
  destroyAllHandles,

  // Permission System
  PermissionGuard,
  PermissionDeniedError,
  createPermissionGuard,
} from './plugins';

export type {
  // Lifecycle Manager
  PluginState,
  PluginEntry,
  LifecycleEvent,
  LifecycleEventListener,
  PluginLifecycleConfig,

  // Manifest
  PluginManifest,
  SystemPluginPolicy,

  // Scanner
  ScanSummary,

  // Sandbox
  PluginHandle,
  SandboxConfig,

  // Permission System
  PermissionDomain,
  PermissionDecision,
  PermissionCheckResult,
  AuditEntry,
  AuditListener,
} from './plugins';

// ===========================================================================
// Wave 3+ Missing Exports (production-readiness audit)
// ===========================================================================

// ---------------------------------------------------------------------------
// Memory: auto-memories, memory-search, session-summary, memory-linker,
//         memory-file-manager, learning-detector
// ---------------------------------------------------------------------------

export { AutoMemories } from './memory/auto-memories';
export type {
  MergedMemories,
  DecayResult,
  PruneResult,
  MemoryStats,
  AutoMemoriesConfig,
} from './memory/auto-memories';

export { MemoryFileManager } from './memory/memory-file-manager';
export type {
  EntryMetadata,
  MemoryEntry as MemoryFileEntry,
  MemorySection as MemoryFileSection,
  ParsedMemoryFile,
  ConsolidationResult,
  MemoryVersion,
  MemoryFileManagerConfig,
} from './memory/memory-file-manager';

export { LearningDetector } from './memory/learning-detector';
export type {
  ConversationTurn,
  ToolCallRecord,
  MemorySectionType,
  DetectionCategory,
  DetectedMemory,
  LearningDetectorConfig,
  // MemoryScope intentionally omitted -- conflicts with agents/agent-types
} from './memory/learning-detector';

export { MemorySearch } from './memory/memory-search';
export type {
  MemorySearchResult,
  MemorySearchOptions,
  RelevanceContext,
} from './memory/memory-search';

export { SessionSummaryGenerator } from './memory/session-summary';
export type {
  SessionSummaryResult,
  SessionSummaryConfig,
} from './memory/session-summary';

export { MemoryLinker } from './memory/memory-linker';
export type {
  MemoryLink,
  LinkingResult,
  MemoryLinkerConfig,
} from './memory/memory-linker';

// ---------------------------------------------------------------------------
// Models: provider-health, token-budget, retry, BudgetExceededError
// ---------------------------------------------------------------------------

export {
  ProviderHealthTracker,
} from './models/provider-health';

export type {
  CircuitState,
  ProviderHealthConfig,
  ProviderHealthSnapshot,
} from './models/provider-health';

export {
  TokenBudgetManager,
} from './models/token-budget';

export type {
  BudgetWindowKind,
  SessionBudget,
  SessionUsage,
  BudgetCheck,
  TokenBudgetConfig,
} from './models/token-budget';

export {
  BudgetExceededError,
} from './models/model-router';

export type {
  RequiredCapabilities,
  RoutingStrategy,
} from './models/model-router';

export {
  withRetry,
  calculateBackoffMs,
  isTransientError,
  DEFAULT_RETRY_CONFIG,
} from './models/retry';

export type {
  RetryConfig,
  RetryResult,
} from './models/retry';

// ---------------------------------------------------------------------------
// Protocol: rate-limiter, message-codec, streaming-response,
//           method-registry, jsonrpc-compat, protocol-upgrade
// ---------------------------------------------------------------------------

export {
  RateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  METHOD_COST_MAP,
} from './protocol/rate-limiter';

export type {
  RateLimitConfig,
  RateLimitResult,
} from './protocol/rate-limiter';

export {
  MessageCodec,
} from './protocol/message-codec';

export type {
  CompressionAlgorithm,
  CodecConfig,
  EncodeResult,
  DecodeTextResult,
  DecodeBinaryResult,
} from './protocol/message-codec';

export {
  StreamingResponse,
  StreamGuard,
  createStreamingResponse,
} from './protocol/streaming-response';

export type {
  StreamSink,
  StreamProgress,
  StreamState,
} from './protocol/streaming-response';

export {
  MethodRegistry,
  RpcDiscoverParamsSchema,
  RpcDescribeParamsSchema,
} from './protocol/method-registry';

export type {
  MethodDescriptor,
  EventDescriptor,
  DiscoveryResult,
  RpcDiscoverParams,
  RpcDescribeParams,
} from './protocol/method-registry';

export {
  isJsonRpcMessage,
  isJsonRpcBatch,
  jsonRpcToNative,
  nativeResponseToJsonRpc,
  nativeEventToJsonRpc,
  jsonRpcErrorResponse,
  wundrErrorToJsonRpcCode,
  jsonRpcCodeToWundrError,
} from './protocol/jsonrpc-compat';

export type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcMessage,
  InboundResult,
} from './protocol/jsonrpc-compat';

export {
  isV1Message,
  isJsonRpc2,
  isNativeV2,
  detectFormat,
  v1RequestToV2,
  v2ResponseToV1,
  v2EventToV1,
  V1Adapter,
} from './protocol/protocol-upgrade';

export type {
  V1Request,
  V1Response,
  V1Event,
  DetectedFormat,
} from './protocol/protocol-upgrade';

// ---------------------------------------------------------------------------
// Plugins: plugin-ipc, plugin-signature, sandbox-metrics
// ---------------------------------------------------------------------------

export {
  PluginIpcBus,
} from './plugins/plugin-ipc';

export type {
  IpcMessage,
  IpcMessageKind,
  IpcHandler,
  IpcSubscription,
  IpcBusConfig,
} from './plugins/plugin-ipc';

export {
  verifyPluginSignature,
  TrustedKeyStore,
} from './plugins/plugin-signature';

export type {
  SignatureFile,
  SignatureVerificationResult,
  TrustedPublicKey,
} from './plugins/plugin-signature';

export {
  PluginMetrics as PluginSandboxMetrics,
  PluginMetricsRegistry,
} from './plugins/sandbox-metrics';

export type {
  PluginMetricsSnapshot,
  MetricsUpdatePayload,
} from './plugins/sandbox-metrics';

export {
  getMetricsRegistry as getPluginMetricsRegistry,
  buildSandboxedFsProxy,
  buildSandboxedEnvProxy,
} from './plugins';

export type {
  SandboxTier,
} from './plugins';

// ---------------------------------------------------------------------------
// Config: config-watcher, config-merger, config-template, config-export,
//         config-modules, config-cli, config-redactor, env-overrides, schemas
// ---------------------------------------------------------------------------

export {
  // Schemas
  WundrConfigSchema,
  validateConfig,
  generateDefaultConfig,
  CURRENT_CONFIG_VERSION,
  DaemonSchema,
  AgentsSchema,
  AgentDefaultsSchema,
  SingleAgentSchema,
  MemorySchema,
  SecuritySchema,
  ChannelsSchema,
  ModelConfigSchema,
  PluginsSchema,
  HooksSchema,
  MonitoringSchema,
  LoggingSchema,
  TokenBudgetSchema,
} from './config/schemas';

export type {
  WundrConfig,
  ConfigValidationIssue,
  ConfigValidationResult,
} from './config/schemas';

export {
  createConfigIO,
  readConfigSnapshot,
  writeConfig,
  resolveConfigSnapshotHash,
  registerMigration,
  applyMigrations,
} from './config/config-loader';

// Note: loadConfig, getConfig, resetConfig, validateRequiredEnv from config-loader
// have name conflicts with the legacy config/index.ts versions. They are
// aliased as loadWundrConfig, getWundrConfig, resetWundrConfig,
// validateWundrRequiredEnv in config/index.ts.
export {
  loadConfig as loadWundrConfig,
  getConfig as getWundrConfig,
  resetConfig as resetWundrConfig,
  validateRequiredEnv as validateWundrRequiredEnv,
} from './config/config-loader';

export type {
  ConfigSnapshot,
  ConfigLoadOptions,
  ConfigMigration,
} from './config/config-loader';

export {
  startConfigWatcher,
  buildReloadPlan,
  resolveReloadSettings,
  describeReloadPlan,
} from './config/config-watcher';

export type {
  ConfigWatcher,
  ConfigWatcherOptions,
  ConfigWatcherLogger,
  ReloadPlan,
  ReloadSettings,
  ReloadMode,
} from './config/config-watcher';

export {
  deepMerge,
  mergeConfigSection,
  resolveConfigIncludes,
  resolveEnvVars,
  applyOverrides,
  setOverride,
  unsetOverride,
  resetOverrides,
  getOverrides,
  diffConfigPaths,
  ConfigIncludeError,
  CircularIncludeError,
  MissingEnvVarError,
  INCLUDE_KEY,
  MAX_INCLUDE_DEPTH,
} from './config/config-merger';

export type {
  ArrayMergeStrategy,
  DeepMergeOptions,
} from './config/config-merger';

export {
  resolveTemplates,
  resolveTemplatesWithCrossRefs,
  extractTemplateVars,
  TemplateResolutionError,
} from './config/config-template';

export type {
  TemplateContext,
  TemplateError,
  TemplateResult,
} from './config/config-template';

export {
  exportConfig,
  generateDefaultConfigFile,
  getExportFormats,
} from './config/config-export';

export type {
  ConfigExportFormat,
  ConfigExportOptions,
  ConfigExportResult,
} from './config/config-export';

export {
  createConfigModuleRegistry,
  registerBuiltinModules,
  BUILTIN_MODULE_DEFINITIONS,
} from './config/config-modules';

export type {
  ConfigModuleDefinition,
  ConfigModule,
  ConfigModuleRegistry,
} from './config/config-modules';

export {
  redactConfig,
  redactSnapshot,
  containsRedactedSentinel,
  listRedactedPaths,
  isSensitivePath,
} from './config/config-redactor';

// Note: restoreRedactedValues, isSensitiveKey, REDACTED_SENTINEL from
// config-redactor have name conflicts with security/redact. The config
// versions are available via the config barrel: import { ... } from './config'.

export {
  buildWundrEnvOverrides,
  getStaticMappings,
  SENSITIVE_CONFIG_PATHS,
} from './config/env-overrides';

export type {
  EnvOverrideMapping,
} from './config/env-overrides';

export {
  validateCommand,
  exportCommand,
  diffCommand,
  initCommand,
  envListCommand,
  sectionsCommand,
} from './config/config-cli';

export type {
  CliResult,
  ValidateOptions,
  ExportOptions,
  DiffOptions,
  InitOptions,
} from './config/config-cli';

// ---------------------------------------------------------------------------
// Monitoring: alerts, retention, tracing, health, structured logger,
//             enhanced metrics, system metrics collection
// ---------------------------------------------------------------------------

export {
  // Enhanced metric groups
  agentMetrics,
  sessionMetrics,
  memoryMetrics,
  toolMetrics,
  wsMetrics,
  modelMetrics,
  queueMetrics,
  systemMetrics,
  channelMetrics,
  pluginMetrics,
  requestSummaryMetrics,
  // Enhanced helper functions
  recordAgentSpawned,
  recordAgentCompleted,
  recordAgentFailed,
  recordModelRequest,
  recordWsConnection,
  recordWsDisconnection,
  recordWsMessageReceived,
  recordWsMessageSent,
  recordToolExecution,
  recordMemoryOperation,
  recordChannelMessageSent,
  recordChannelMessageReceived,
  recordChannelLatency,
  recordChannelError,
  recordPluginExecution,
  recordPluginError,
  recordRequestDuration,
  recordTokenUsageSummary,
  // System metrics collection
  startSystemMetricsCollection,
  stopSystemMetricsCollection,
} from './monitoring/metrics';

export type {
  AgentLifecycleMetrics,
  EnhancedSessionMetrics,
  MemorySystemMetrics,
  EnhancedToolMetrics,
  WebSocketMetrics,
  ModelRoutingMetrics,
  QueueMetrics,
  SystemResourceMetrics,
  ChannelMetrics as MonitoringChannelMetrics,
  PluginMetrics as MonitoringPluginMetrics,
  RequestSummaryMetrics,
} from './monitoring/metrics';

export {
  // Structured logging
  StructuredLogger,
  InMemoryLogWriter,
  LogLevelRegistry,
  createLogger,
  createChildLogger,
  getLogLevelRegistry,
} from './monitoring/logger';

export type {
  LogLevel as StructuredLogLevel,
  LogFormat,
  LogEntry,
  LogContext,
  StructuredLoggerConfig,
  LogWriter,
} from './monitoring/logger';

export {
  // Distributed tracing
  Tracer,
  getTracer,
  resetTracer,
  createTracer,
  generateTraceId,
  generateSpanId,
  SpanExporter,
  createSpanExporter,
} from './monitoring/tracing';

export type {
  TraceContext,
  Span,
  SpanStatus,
  SpanEvent,
  SpanOptions,
  TracingConfig,
  OTLPSpan,
  SpanExporterConfig,
} from './monitoring/tracing';

export {
  // Enhanced health checks
  HealthChecker,
  createHealthChecker,
  createProbe,
  createSubsystemProbe,
  healthStatusToHttpCode,
} from './monitoring/health';

export type {
  // Note: HealthStatus is aliased to avoid collision with endpoint.ts
  HealthStatus as MonitoringHealthStatus,
  ComponentHealth,
  EnhancedHealthResponse,
  HealthMetricsSnapshot,
  HealthCheckProbe,
  HealthCheckConfig,
  DaemonStatusProvider,
} from './monitoring/health';

export {
  // Alert thresholds
  AlertManager,
  createAlertManager,
} from './monitoring/alerts';

export type {
  AlertSeverity,
  AlertState,
  ComparisonOp,
  AlertThreshold,
  Alert,
  AlertManagerConfig,
} from './monitoring/alerts';

export {
  // Metric retention and rollup
  MetricRetentionStore,
  createRetentionStore,
} from './monitoring/retention';

export type {
  DataPoint,
  RollupPoint,
  RetentionConfig,
  MetricTimeSeries,
  DashboardExport,
} from './monitoring/retention';

// ---------------------------------------------------------------------------
// Skills: skill-validator, skill-dependencies, skill-search, skill-watcher,
//         skill-analytics
// ---------------------------------------------------------------------------

export {
  validateSkill,
  validateAllSkills,
  formatValidationReport,
} from './skills/skill-validator';

export {
  resolveDependencies,
  resolveDependenciesBatch,
  wouldCreateCycle,
} from './skills/skill-dependencies';

export { SkillSearchIndex } from './skills/skill-search';

export { SkillWatcher } from './skills/skill-watcher';
export type { SkillChangeCallback } from './skills/skill-watcher';

export { SkillAnalytics } from './skills/skill-analytics';

export type {
  // Validation
  SkillValidationSeverity,
  SkillValidationIssue,
  SkillValidationResult,

  // Caching
  SkillCacheEntry,

  // Versioning
  SkillVersionInfo,

  // Analytics
  SkillUsageEntry,
  SkillAnalyticsSummary,

  // Dependencies
  SkillDependencyResolution,

  // File watching
  SkillFileEvent,
} from './skills/types';

// ---------------------------------------------------------------------------
// Teams: task-assignment, dependency-tracker, team-context
// ---------------------------------------------------------------------------

export {
  TaskAssigner,
  AssignmentError,
  AssignmentErrorCode,
} from './teams/task-assignment';

export type {
  AssignmentStrategy,
  TeammateCapabilities,
  AssignmentCandidate,
  AssignmentDecision,
  TaskAssignmentEvents,
  AssignableTask,
} from './teams/task-assignment';

export {
  DependencyTracker,
  DependencyError,
  DependencyErrorCode,
} from './teams/dependency-tracker';

export type {
  DependencyEdge,
  DependencyInfo,
  CycleDetectionResult,
  TopologicalOrder,
  DependencyTrackerEvents,
} from './teams/dependency-tracker';

export {
  TeamContext,
  TeamContextError,
  TeamContextErrorCode,
  DEFAULT_TEAM_SETTINGS,
} from './teams/team-context';

export type {
  SharedContextEntry,
  TeamProgress,
  TeamResult,
  TaskResult as TeamTaskResult,
  MemberContribution,
  TeamSettingsConfig,
  TeamContextEvents,
} from './teams/team-context';
