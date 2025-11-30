/**
 * Orchestrator Daemon - Orchestrator Daemon for agent orchestration
 *
 * Main entry point for the Orchestrator Daemon package
 */

// Core Components
export { OrchestratorDaemon } from './core/orchestrator-daemon';
export { OrchestratorWebSocketServer } from './core/websocket-server';

// Session Management
export { SessionManager } from './session/session-manager';
export { SessionExecutor } from './session/session-executor';
export { ToolExecutor } from './session/tool-executor';

// Memory Management
export { MemoryManager } from './memory/memory-manager';

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
