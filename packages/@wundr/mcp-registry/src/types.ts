/**
 * @wundr.io/mcp-registry - Type Definitions
 *
 * TypeScript interfaces for MCP server registration, health status,
 * tool results, and the Super MCP aggregator pattern.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// =============================================================================
// Server Registration Types
// =============================================================================

/**
 * Supported MCP transport types
 */
export type TransportType = 'stdio' | 'http' | 'websocket' | 'ipc';

/**
 * Server capability categories
 */
export type CapabilityCategory =
  | 'tools'
  | 'resources'
  | 'prompts'
  | 'logging'
  | 'sampling'
  | 'experimental';

/**
 * MCP Server capability definition
 */
export interface MCPCapability {
  /** Capability category */
  readonly category: CapabilityCategory;
  /** Capability name */
  readonly name: string;
  /** Human-readable description */
  readonly description?: string;
  /** Whether the capability is enabled */
  readonly enabled: boolean;
  /** Additional capability metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool definition within a server registration
 */
export interface ToolDefinition {
  /** Tool name (unique within server) */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** JSON Schema for tool input */
  readonly inputSchema: ToolInputSchema;
  /** Tool category for organization */
  readonly category?: string;
  /** Tags for discovery */
  readonly tags?: readonly string[];
}

/**
 * JSON Schema for tool input parameters
 */
export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
}

/**
 * Resource definition within a server registration
 */
export interface ResourceDefinition {
  /** Resource URI pattern */
  readonly uri: string;
  /** Human-readable name */
  readonly name: string;
  /** Resource description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
  /** Whether resource supports subscriptions */
  readonly subscribable?: boolean;
}

/**
 * Prompt definition within a server registration
 */
export interface PromptDefinition {
  /** Prompt name */
  readonly name: string;
  /** Prompt description */
  readonly description?: string;
  /** Prompt arguments */
  readonly arguments?: readonly PromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  /** Argument name */
  readonly name: string;
  /** Argument description */
  readonly description?: string;
  /** Whether argument is required */
  readonly required?: boolean;
}

/**
 * Transport configuration for connecting to an MCP server
 */
export interface TransportConfig {
  /** Transport type */
  readonly type: TransportType;
  /** Command to start the server (for stdio) */
  readonly command?: string;
  /** Command arguments */
  readonly args?: readonly string[];
  /** Environment variables */
  readonly env?: Record<string, string>;
  /** Working directory */
  readonly cwd?: string;
  /** HTTP/WebSocket endpoint URL */
  readonly url?: string;
  /** Connection timeout in milliseconds */
  readonly timeout?: number;
  /** Whether to auto-reconnect on failure */
  readonly autoReconnect?: boolean;
  /** Reconnection delay in milliseconds */
  readonly reconnectDelay?: number;
  /** Maximum reconnection attempts */
  readonly maxReconnectAttempts?: number;
}

/**
 * Complete MCP server registration
 */
export interface MCPServerRegistration {
  /** Unique server identifier */
  readonly id: string;
  /** Server name */
  readonly name: string;
  /** Server version */
  readonly version: string;
  /** Server description */
  readonly description?: string;
  /** Transport configuration */
  readonly transport: TransportConfig;
  /** Server capabilities */
  readonly capabilities: readonly MCPCapability[];
  /** Available tools */
  readonly tools: readonly ToolDefinition[];
  /** Available resources */
  readonly resources: readonly ResourceDefinition[];
  /** Available prompts */
  readonly prompts: readonly PromptDefinition[];
  /** Server priority (higher = preferred) */
  readonly priority?: number;
  /** Server tags for discovery */
  readonly tags?: readonly string[];
  /** Registration timestamp */
  readonly registeredAt: Date;
  /** Last updated timestamp */
  readonly updatedAt: Date;
  /** Server metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Options for registering a new server
 */
export interface ServerRegistrationOptions {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server description */
  description?: string;
  /** Transport configuration */
  transport: TransportConfig;
  /** Server priority */
  priority?: number;
  /** Server tags */
  tags?: string[];
  /** Server metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Health Status Types
// =============================================================================

/**
 * Health status levels
 */
export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check result for a single check
 */
export interface HealthCheckResult {
  /** Check name */
  readonly name: string;
  /** Health level */
  readonly status: HealthLevel;
  /** Human-readable message */
  readonly message?: string;
  /** Check duration in milliseconds */
  readonly durationMs: number;
  /** Check timestamp */
  readonly timestamp: Date;
  /** Additional check data */
  readonly data?: Record<string, unknown>;
}

/**
 * Comprehensive health status for an MCP server
 */
export interface HealthStatus {
  /** Server ID */
  readonly serverId: string;
  /** Overall health level */
  readonly status: HealthLevel;
  /** Connection status */
  readonly connected: boolean;
  /** Last successful ping timestamp */
  readonly lastPing?: Date;
  /** Current latency in milliseconds */
  readonly latencyMs?: number;
  /** Average latency over monitoring window */
  readonly avgLatencyMs?: number;
  /** Number of consecutive failures */
  readonly consecutiveFailures: number;
  /** Total request count */
  readonly totalRequests: number;
  /** Successful request count */
  readonly successfulRequests: number;
  /** Error rate (0-1) */
  readonly errorRate: number;
  /** Individual health check results */
  readonly checks: readonly HealthCheckResult[];
  /** Last status update timestamp */
  readonly updatedAt: Date;
  /** Health status metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Health monitoring configuration
 */
export interface HealthMonitorConfig {
  /** Health check interval in milliseconds */
  checkInterval?: number;
  /** Ping timeout in milliseconds */
  pingTimeout?: number;
  /** Number of failures before marking unhealthy */
  failureThreshold?: number;
  /** Number of successes to recover from unhealthy */
  recoveryThreshold?: number;
  /** Latency threshold for degraded status (ms) */
  degradedLatencyThreshold?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
}

// =============================================================================
// Tool Result Types
// =============================================================================

/**
 * Text content in tool results
 */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Image content in tool results
 */
export interface ImageContent {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

/**
 * Embedded resource content in tool results
 */
export interface EmbeddedResourceContent {
  readonly type: 'resource';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly text?: string;
    readonly blob?: string;
  };
}

/**
 * Union type for all tool content types
 */
export type ToolContentItem =
  | TextContent
  | ImageContent
  | EmbeddedResourceContent;

/**
 * Result from a tool invocation
 */
export interface ToolResult {
  /** Result content items */
  readonly content: readonly ToolContentItem[];
  /** Whether the result represents an error */
  readonly isError?: boolean;
  /** Execution duration in milliseconds */
  readonly durationMs?: number;
  /** Server that executed the tool */
  readonly serverId?: string;
  /** Tool name that was executed */
  readonly toolName?: string;
  /** Result metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool invocation request
 */
export interface ToolInvocationRequest {
  /** Tool name */
  readonly name: string;
  /** Tool arguments */
  readonly arguments?: Record<string, unknown>;
  /** Optional timeout override (ms) */
  readonly timeout?: number;
  /** Optional server preference */
  readonly preferredServer?: string;
  /** Request metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool invocation response with routing info
 */
export interface ToolInvocationResponse {
  /** Tool result */
  readonly result: ToolResult;
  /** Server that handled the request */
  readonly serverId: string;
  /** Request latency in milliseconds */
  readonly latencyMs: number;
  /** Whether request was retried */
  readonly retried: boolean;
  /** Number of retry attempts */
  readonly retryAttempts: number;
}

// =============================================================================
// Discovery Types
// =============================================================================

/**
 * Capability query for server discovery
 */
export interface CapabilityQuery {
  /** Required capability category */
  readonly category?: CapabilityCategory;
  /** Required capability names */
  readonly capabilities?: readonly string[];
  /** Required tool names */
  readonly tools?: readonly string[];
  /** Required tags */
  readonly tags?: readonly string[];
  /** Minimum priority */
  readonly minPriority?: number;
  /** Health status requirement */
  readonly healthStatus?: HealthLevel | readonly HealthLevel[];
}

/**
 * Server discovery result
 */
export interface DiscoveryResult {
  /** Matching servers */
  readonly servers: readonly MCPServerRegistration[];
  /** Query that produced this result */
  readonly query: CapabilityQuery;
  /** Discovery timestamp */
  readonly timestamp: Date;
  /** Total servers searched */
  readonly totalSearched: number;
  /** Number of matches found */
  readonly matchCount: number;
}

// =============================================================================
// Aggregator Types
// =============================================================================

/**
 * Routing strategy for the aggregator
 */
export type RoutingStrategy =
  | 'priority'
  | 'round-robin'
  | 'least-latency'
  | 'random'
  | 'health-aware';

/**
 * Aggregator configuration
 */
export interface AggregatorConfig {
  /** Default routing strategy */
  defaultStrategy?: RoutingStrategy;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Enable request retries */
  enableRetries?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Enable circuit breaker */
  enableCircuitBreaker?: boolean;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout (ms) */
  circuitBreakerResetTimeout?: number;
  /** Health monitoring configuration */
  healthMonitor?: HealthMonitorConfig;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker status for a server
 */
export interface CircuitBreakerStatus {
  /** Server ID */
  readonly serverId: string;
  /** Current state */
  readonly state: CircuitBreakerState;
  /** Failure count in current window */
  readonly failureCount: number;
  /** Last failure timestamp */
  readonly lastFailure?: Date;
  /** Time until circuit closes (ms) */
  readonly timeUntilClose?: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Registry event types
 */
export type RegistryEventType =
  | 'server:registered'
  | 'server:unregistered'
  | 'server:updated'
  | 'server:connected'
  | 'server:disconnected'
  | 'server:health-changed'
  | 'tool:added'
  | 'tool:removed'
  | 'capability:changed';

/**
 * Registry event payload
 */
export interface RegistryEvent {
  /** Event type */
  readonly type: RegistryEventType;
  /** Server ID (if applicable) */
  readonly serverId?: string;
  /** Event data */
  readonly data?: Record<string, unknown>;
  /** Event timestamp */
  readonly timestamp: Date;
}

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

/**
 * Transport type schema
 */
export const TransportTypeSchema = z.enum([
  'stdio',
  'http',
  'websocket',
  'ipc',
]);

/**
 * Transport configuration schema
 */
export const TransportConfigSchema = z.object({
  type: TransportTypeSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().url().optional(),
  timeout: z.number().positive().optional(),
  autoReconnect: z.boolean().optional(),
  reconnectDelay: z.number().positive().optional(),
  maxReconnectAttempts: z.number().positive().optional(),
});

/**
 * Server registration options schema
 */
export const ServerRegistrationOptionsSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  transport: TransportConfigSchema,
  priority: z.number().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Tool invocation request schema
 */
export const ToolInvocationRequestSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()).optional(),
  timeout: z.number().positive().optional(),
  preferredServer: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Capability query schema
 */
export const CapabilityQuerySchema = z.object({
  category: z
    .enum([
      'tools',
      'resources',
      'prompts',
      'logging',
      'sampling',
      'experimental',
    ])
    .optional(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  minPriority: z.number().optional(),
  healthStatus: z
    .union([
      z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
      z.array(z.enum(['healthy', 'degraded', 'unhealthy', 'unknown'])),
    ])
    .optional(),
});

/**
 * Aggregator configuration schema
 */
export const AggregatorConfigSchema = z.object({
  defaultStrategy: z
    .enum([
      'priority',
      'round-robin',
      'least-latency',
      'random',
      'health-aware',
    ])
    .optional(),
  requestTimeout: z.number().positive().optional(),
  enableRetries: z.boolean().optional(),
  maxRetries: z.number().positive().optional(),
  retryDelay: z.number().positive().optional(),
  enableCircuitBreaker: z.boolean().optional(),
  circuitBreakerThreshold: z.number().positive().optional(),
  circuitBreakerResetTimeout: z.number().positive().optional(),
});

/**
 * Health monitor configuration schema
 */
export const HealthMonitorConfigSchema = z.object({
  checkInterval: z.number().positive().optional(),
  pingTimeout: z.number().positive().optional(),
  failureThreshold: z.number().positive().optional(),
  recoveryThreshold: z.number().positive().optional(),
  degradedLatencyThreshold: z.number().positive().optional(),
  autoReconnect: z.boolean().optional(),
  maxReconnectAttempts: z.number().positive().optional(),
});
