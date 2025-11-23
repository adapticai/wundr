/**
 * @wundr.io/mcp-registry - MCP Server Registry and Discovery
 *
 * Implements MCP server registry, discovery, and the Super MCP aggregator
 * pattern for unified tool routing across multiple MCP servers.
 *
 * Features:
 * - Server registration and lifecycle management
 * - Capability-based server discovery
 * - Health monitoring and automatic recovery
 * - Circuit breaker pattern for fault tolerance
 * - Multiple routing strategies (priority, round-robin, least-latency, etc.)
 *
 * @example
 * ```typescript
 * import {
 *   MCPServerRegistry,
 *   MCPAggregator,
 *   ServerHealthMonitor,
 *   createServerDiscoveryService,
 * } from '@wundr.io/mcp-registry';
 *
 * // Create registry
 * const registry = new MCPServerRegistry();
 *
 * // Register servers
 * await registry.register({
 *   name: 'wundr-mcp',
 *   version: '1.0.0',
 *   transport: { type: 'stdio', command: 'npx', args: ['@wundr.io/mcp-server'] },
 * });
 *
 * // Create aggregator
 * const aggregator = new MCPAggregator(registry, {
 *   defaultStrategy: 'health-aware',
 *   enableRetries: true,
 * });
 *
 * // Start health monitoring
 * const monitor = new ServerHealthMonitor(registry);
 * await monitor.start();
 *
 * // Invoke tools
 * const response = await aggregator.invoke({
 *   name: 'drift_detection',
 *   arguments: { action: 'detect' },
 * });
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Imports for Interfaces
// =============================================================================

import type { MCPAggregator } from './aggregator';
import type { ServerDiscoveryService } from './discovery';
import type { ServerHealthMonitor } from './health-monitor';
import type { MCPServerRegistry } from './registry';
import type { AggregatorConfig, HealthMonitorConfig } from './types';

// =============================================================================
// Type Exports
// =============================================================================

export {
  // Transport and capability types
  TransportType,
  CapabilityCategory,
  MCPCapability,
  ToolDefinition,
  ToolInputSchema,
  JsonSchemaProperty,
  ResourceDefinition,
  PromptDefinition,
  PromptArgument,
  TransportConfig,
  MCPServerRegistration,
  ServerRegistrationOptions,

  // Health status types
  HealthLevel,
  HealthCheckResult,
  HealthStatus,
  HealthMonitorConfig,

  // Tool result types
  TextContent,
  ImageContent,
  EmbeddedResourceContent,
  ToolContentItem,
  ToolResult,
  ToolInvocationRequest,
  ToolInvocationResponse,

  // Discovery types
  CapabilityQuery,
  DiscoveryResult,

  // Aggregator types
  RoutingStrategy,
  AggregatorConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,

  // Event types
  RegistryEventType,
  RegistryEvent,

  // Zod schemas for runtime validation
  TransportTypeSchema,
  TransportConfigSchema,
  ServerRegistrationOptionsSchema,
  ToolInvocationRequestSchema,
  CapabilityQuerySchema,
  AggregatorConfigSchema,
  HealthMonitorConfigSchema,
} from './types';

// =============================================================================
// Registry Exports
// =============================================================================

export {
  MCPServerRegistry,
  createMCPServerRegistry,
  RegistryStats,
  RegistryExport,
  RegistryEvents,
  ServerNotFoundError,
  ServerAlreadyExistsError,
  RegistrationValidationError,
} from './registry';

// =============================================================================
// Discovery Exports
// =============================================================================

export {
  ServerDiscoveryService,
  createServerDiscoveryService,
  CapabilityQueryBuilder,
  DiscoveryOptions,
  RecommendationContext,
  UsageHistoryEntry,
  ServerRecommendation,
  NoServersFoundError,
  InvalidQueryError,
} from './discovery';

// =============================================================================
// Aggregator Exports
// =============================================================================

export {
  MCPAggregator,
  createMCPAggregator,
  AggregatorEvents,
  AggregatorStats,
  RequestEvent,
  CircuitEvent,
  ToolHandler,
  NoServerAvailableError,
  ToolInvocationTimeoutError,
  CircuitBreakerOpenError,
  RetryExhaustedError,
} from './aggregator';

// =============================================================================
// Health Monitor Exports
// =============================================================================

export {
  ServerHealthMonitor,
  createServerHealthMonitor,
  HealthMonitorEvents,
  HealthMonitorStats,
  HealthCheckEvent,
  HealthChangeEvent,
  ConnectionEvent,
  HealthCheckFn,
  RegisteredHealthCheck,
  HealthCheckError,
} from './health-monitor';

// =============================================================================
// Convenience Factory Functions
// =============================================================================

/**
 * Create a complete MCP registry system with all components
 *
 * @param config - Optional configuration for all components
 * @returns Object containing all registry components
 *
 * @example
 * ```typescript
 * const { registry, discovery, aggregator, monitor } = createMCPRegistrySystem({
 *   aggregator: { defaultStrategy: 'health-aware' },
 *   monitor: { checkInterval: 10000 },
 * });
 *
 * await monitor.start();
 * ```
 */
export async function createMCPRegistrySystem(
  config?: MCPRegistrySystemConfig
): Promise<MCPRegistrySystem> {
  const { MCPServerRegistry } = await import('./registry');
  const { ServerDiscoveryService } = await import('./discovery');
  const { MCPAggregator } = await import('./aggregator');
  const { ServerHealthMonitor } = await import('./health-monitor');

  const registry = new MCPServerRegistry();
  const discovery = new ServerDiscoveryService(registry);
  const aggregator = new MCPAggregator(registry, config?.aggregator);
  const monitor = new ServerHealthMonitor(registry, config?.monitor);

  return {
    registry,
    discovery,
    aggregator,
    monitor,
  };
}

/**
 * Configuration for the complete MCP registry system
 */
export interface MCPRegistrySystemConfig {
  /** Aggregator configuration */
  aggregator?: AggregatorConfig;
  /** Health monitor configuration */
  monitor?: HealthMonitorConfig;
}

/**
 * Complete MCP registry system with all components
 */
export interface MCPRegistrySystem {
  /** Server registry */
  registry: MCPServerRegistry;
  /** Discovery service */
  discovery: ServerDiscoveryService;
  /** Request aggregator */
  aggregator: MCPAggregator;
  /** Health monitor */
  monitor: ServerHealthMonitor;
}

// =============================================================================
// Version Export
// =============================================================================

/**
 * Package version
 */
export const VERSION = '1.0.3';

// =============================================================================
// Default Export
// =============================================================================

/**
 * Default export - the createMCPRegistrySystem function
 */
export default createMCPRegistrySystem;
