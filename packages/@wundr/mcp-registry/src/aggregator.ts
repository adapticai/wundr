/**
 * @wundr.io/mcp-registry - MCP Aggregator (Super MCP)
 *
 * Implements the Super MCP pattern for routing requests to appropriate
 * servers based on capabilities, health, and configured routing strategies.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';

import { createServerDiscoveryService } from './discovery';
import { AggregatorConfigSchema } from './types';

import type { ServerDiscoveryService } from './discovery';
import type { MCPServerRegistry } from './registry';
import type {
  ToolInvocationRequest,
  ToolInvocationResponse,
  ToolResult,
  AggregatorConfig,
  RoutingStrategy,
  CircuitBreakerState,
  CircuitBreakerStatus,
  MCPServerRegistration,
} from './types';

// =============================================================================
// Aggregator Error Types
// =============================================================================

/**
 * Error thrown when no server can handle a tool invocation
 */
export class NoServerAvailableError extends Error {
  constructor(
    public readonly toolName: string,
    message?: string,
  ) {
    super(message ?? `No server available for tool: ${toolName}`);
    this.name = 'NoServerAvailableError';
  }
}

/**
 * Error thrown when a tool invocation times out
 */
export class ToolInvocationTimeoutError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly timeoutMs: number,
    message?: string,
  ) {
    super(
      message ?? `Tool invocation timed out after ${timeoutMs}ms: ${toolName}`,
    );
    this.name = 'ToolInvocationTimeoutError';
  }
}

/**
 * Error thrown when circuit breaker is open for a server
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly serverId: string,
    message?: string,
  ) {
    super(message ?? `Circuit breaker open for server: ${serverId}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Error thrown when all retry attempts are exhausted
 */
export class RetryExhaustedError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly attempts: number,
    public readonly lastError: Error,
    message?: string,
  ) {
    super(
      message ??
        `All ${attempts} retry attempts exhausted for tool: ${toolName}`,
    );
    this.name = 'RetryExhaustedError';
  }
}

// =============================================================================
// Aggregator Event Types
// =============================================================================

/**
 * Event map for aggregator events
 */
export interface AggregatorEvents {
  'request:started': (event: RequestEvent) => void;
  'request:completed': (event: RequestEvent) => void;
  'request:failed': (event: RequestEvent) => void;
  'request:retried': (event: RequestEvent) => void;
  'circuit:opened': (event: CircuitEvent) => void;
  'circuit:closed': (event: CircuitEvent) => void;
  'circuit:half-open': (event: CircuitEvent) => void;
}

/**
 * Request event data
 */
export interface RequestEvent {
  readonly requestId: string;
  readonly toolName: string;
  readonly serverId?: string;
  readonly durationMs?: number;
  readonly error?: Error;
  readonly retryAttempt?: number;
  readonly timestamp: Date;
}

/**
 * Circuit breaker event data
 */
export interface CircuitEvent {
  readonly serverId: string;
  readonly previousState: CircuitBreakerState;
  readonly newState: CircuitBreakerState;
  readonly timestamp: Date;
}

// =============================================================================
// Circuit Breaker Implementation
// =============================================================================

/**
 * Internal circuit breaker state
 */
interface CircuitBreakerInternalState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
}

// =============================================================================
// MCPAggregator Class
// =============================================================================

/**
 * MCP Aggregator (Super MCP Pattern)
 *
 * Routes tool invocation requests to appropriate servers based on
 * capabilities, health status, and configured routing strategies.
 * Implements circuit breaker pattern for fault tolerance.
 *
 * @example
 * ```typescript
 * const aggregator = new MCPAggregator(registry, {
 *   defaultStrategy: 'health-aware',
 *   enableRetries: true,
 *   maxRetries: 3,
 *   enableCircuitBreaker: true,
 * });
 *
 * // Invoke a tool
 * const response = await aggregator.invoke({
 *   name: 'drift_detection',
 *   arguments: { action: 'detect' },
 * });
 *
 * // Use specific routing strategy
 * const response = await aggregator.invokeWithStrategy(
 *   { name: 'my-tool' },
 *   'least-latency',
 * );
 * ```
 */
export class MCPAggregator extends EventEmitter<AggregatorEvents> {
  /** Configuration */
  private readonly config: Required<AggregatorConfig>;

  /** Discovery service */
  private readonly discovery: ServerDiscoveryService;

  /** Circuit breaker states by server ID */
  private readonly circuitBreakers: Map<string, CircuitBreakerInternalState>;

  /** Round-robin index by tool name */
  private readonly roundRobinIndex: Map<string, number>;

  /** Request counter for generating IDs */
  private requestCounter: number;

  /** Tool handler registry for direct invocation */
  private readonly toolHandlers: Map<string, ToolHandler>;

  /**
   * Creates a new MCPAggregator
   *
   * @param registry - The server registry
   * @param config - Aggregator configuration
   */
  constructor(
    private readonly registry: MCPServerRegistry,
    config: AggregatorConfig = {},
  ) {
    super();

    // Validate and merge config with defaults
    const validation = AggregatorConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new Error(`Invalid aggregator config: ${validation.error.message}`);
    }

    this.config = {
      defaultStrategy: config.defaultStrategy ?? 'health-aware',
      requestTimeout: config.requestTimeout ?? 30000,
      enableRetries: config.enableRetries ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerResetTimeout: config.circuitBreakerResetTimeout ?? 60000,
      healthMonitor: config.healthMonitor ?? {},
    };

    this.discovery = createServerDiscoveryService(registry);
    this.circuitBreakers = new Map();
    this.roundRobinIndex = new Map();
    this.requestCounter = 0;
    this.toolHandlers = new Map();
  }

  // ===========================================================================
  // Tool Invocation Methods
  // ===========================================================================

  /**
   * Invoke a tool using the default routing strategy
   *
   * @param request - Tool invocation request
   * @returns Tool invocation response
   * @throws {NoServerAvailableError} If no server can handle the tool
   * @throws {ToolInvocationTimeoutError} If the invocation times out
   * @throws {RetryExhaustedError} If all retries are exhausted
   */
  async invoke(
    request: ToolInvocationRequest,
  ): Promise<ToolInvocationResponse> {
    return this.invokeWithStrategy(request, this.config.defaultStrategy);
  }

  /**
   * Invoke a tool with a specific routing strategy
   *
   * @param request - Tool invocation request
   * @param strategy - Routing strategy to use
   * @returns Tool invocation response
   */
  async invokeWithStrategy(
    request: ToolInvocationRequest,
    strategy: RoutingStrategy,
  ): Promise<ToolInvocationResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    let retryAttempts = 0;
    let lastError: Error | undefined;

    // Emit request started event
    this.emitRequestEvent('request:started', requestId, request.name);

    while (
      retryAttempts <= (this.config.enableRetries ? this.config.maxRetries : 0)
    ) {
      try {
        // Select server based on strategy
        const server = await this.selectServer(
          request.name,
          strategy,
          request.preferredServer,
        );

        if (!server) {
          throw new NoServerAvailableError(request.name);
        }

        // Check circuit breaker
        if (this.config.enableCircuitBreaker && this.isCircuitOpen(server.id)) {
          // Try next server
          throw new CircuitBreakerOpenError(server.id);
        }

        // Execute the tool
        const result = await this.executeWithTimeout(
          request,
          server,
          request.timeout ?? this.config.requestTimeout,
        );

        const durationMs = Date.now() - startTime;

        // Record success
        this.recordSuccess(server.id);

        // Emit completion event
        this.emitRequestEvent(
          'request:completed',
          requestId,
          request.name,
          server.id,
          durationMs,
        );

        return {
          result,
          serverId: server.id,
          latencyMs: durationMs,
          retried: retryAttempts > 0,
          retryAttempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure for circuit breaker
        const failedServerId = this.getLastAttemptedServerId();
        if (failedServerId) {
          this.recordFailure(failedServerId);
        }

        // Check if we should retry
        if (
          this.config.enableRetries &&
          retryAttempts < this.config.maxRetries
        ) {
          retryAttempts++;

          // Emit retry event
          this.emitRequestEvent(
            'request:retried',
            requestId,
            request.name,
            undefined,
            undefined,
            lastError,
            retryAttempts,
          );

          // Wait before retry
          await this.delay(this.config.retryDelay * retryAttempts);
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime;
    this.emitRequestEvent(
      'request:failed',
      requestId,
      request.name,
      undefined,
      durationMs,
      lastError,
    );

    if (retryAttempts > 0) {
      throw new RetryExhaustedError(
        request.name,
        retryAttempts,
        lastError ?? new Error('Unknown error'),
      );
    }

    throw lastError ?? new NoServerAvailableError(request.name);
  }

  /**
   * Invoke multiple tools in parallel
   *
   * @param requests - Array of tool invocation requests
   * @returns Array of tool invocation responses
   */
  async invokeParallel(
    requests: readonly ToolInvocationRequest[],
  ): Promise<readonly ToolInvocationResponse[]> {
    return Promise.all(requests.map(req => this.invoke(req)));
  }

  /**
   * Invoke tools in sequence
   *
   * @param requests - Array of tool invocation requests
   * @returns Array of tool invocation responses
   */
  async invokeSequential(
    requests: readonly ToolInvocationRequest[],
  ): Promise<readonly ToolInvocationResponse[]> {
    const results: ToolInvocationResponse[] = [];

    for (const request of requests) {
      const response = await this.invoke(request);
      results.push(response);
    }

    return results;
  }

  // ===========================================================================
  // Tool Handler Registration
  // ===========================================================================

  /**
   * Register a direct tool handler (for local execution)
   *
   * @param toolName - Tool name
   * @param handler - Tool handler function
   */
  registerToolHandler(toolName: string, handler: ToolHandler): void {
    this.toolHandlers.set(toolName, handler);
  }

  /**
   * Unregister a tool handler
   *
   * @param toolName - Tool name
   */
  unregisterToolHandler(toolName: string): void {
    this.toolHandlers.delete(toolName);
  }

  // ===========================================================================
  // Server Selection Methods
  // ===========================================================================

  /**
   * Select a server for a tool using the specified strategy
   *
   * @param toolName - Tool name
   * @param strategy - Routing strategy
   * @param preferredServer - Optional preferred server ID
   * @returns Selected server or undefined
   */
  async selectServer(
    toolName: string,
    strategy: RoutingStrategy,
    preferredServer?: string,
  ): Promise<MCPServerRegistration | undefined> {
    // Check preferred server first
    if (preferredServer) {
      const server = this.registry.get(preferredServer);
      if (server && this.serverProvidesTool(server, toolName)) {
        const health = this.registry.getHealthStatus(server.id);
        if (health?.status !== 'unhealthy' && !this.isCircuitOpen(server.id)) {
          return server;
        }
      }
    }

    // Get all servers that provide the tool
    const candidates = this.registry.findByTool(toolName);

    if (candidates.length === 0) {
      return undefined;
    }

    // Filter out unhealthy servers and open circuits
    const availableServers = candidates.filter(server => {
      const health = this.registry.getHealthStatus(server.id);
      const isHealthy = health?.status !== 'unhealthy';
      const circuitClosed = !this.isCircuitOpen(server.id);
      return isHealthy && circuitClosed;
    });

    if (availableServers.length === 0) {
      // Fall back to any server if all are unhealthy
      return candidates[0];
    }

    // Apply routing strategy
    switch (strategy) {
      case 'priority':
        return this.selectByPriority(availableServers);
      case 'round-robin':
        return this.selectRoundRobin(toolName, availableServers);
      case 'least-latency':
        return this.selectByLeastLatency(availableServers);
      case 'random':
        return this.selectRandom(availableServers);
      case 'health-aware':
        return this.selectHealthAware(availableServers);
      default:
        return availableServers[0];
    }
  }

  /**
   * Select server by highest priority
   */
  private selectByPriority(
    servers: readonly MCPServerRegistration[],
  ): MCPServerRegistration {
    return [...servers].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    )[0]!;
  }

  /**
   * Select server using round-robin
   */
  private selectRoundRobin(
    toolName: string,
    servers: readonly MCPServerRegistration[],
  ): MCPServerRegistration {
    const currentIndex = this.roundRobinIndex.get(toolName) ?? 0;
    const server = servers[currentIndex % servers.length]!;
    this.roundRobinIndex.set(toolName, (currentIndex + 1) % servers.length);
    return server;
  }

  /**
   * Select server with lowest latency
   */
  private selectByLeastLatency(
    servers: readonly MCPServerRegistration[],
  ): MCPServerRegistration {
    return [...servers].sort((a, b) => {
      const aHealth = this.registry.getHealthStatus(a.id);
      const bHealth = this.registry.getHealthStatus(b.id);
      const aLatency = aHealth?.avgLatencyMs ?? Number.MAX_VALUE;
      const bLatency = bHealth?.avgLatencyMs ?? Number.MAX_VALUE;
      return aLatency - bLatency;
    })[0]!;
  }

  /**
   * Select random server
   */
  private selectRandom(
    servers: readonly MCPServerRegistration[],
  ): MCPServerRegistration {
    const index = Math.floor(Math.random() * servers.length);
    return servers[index]!;
  }

  /**
   * Select server using health-aware strategy
   */
  private selectHealthAware(
    servers: readonly MCPServerRegistration[],
  ): MCPServerRegistration {
    // Score each server based on health metrics
    const scored = servers.map(server => {
      const health = this.registry.getHealthStatus(server.id);
      let score = 0;

      // Health status score
      switch (health?.status) {
        case 'healthy':
          score += 100;
          break;
        case 'degraded':
          score += 50;
          break;
        case 'unhealthy':
          score += 0;
          break;
        default:
          score += 25;
      }

      // Latency score (lower is better)
      if (health?.avgLatencyMs !== undefined) {
        score += Math.max(0, 50 - health.avgLatencyMs / 20);
      }

      // Error rate penalty
      if (health?.errorRate !== undefined) {
        score -= health.errorRate * 100;
      }

      // Priority bonus
      score += (server.priority ?? 0) * 5;

      return { server, score };
    });

    // Sort by score descending and return best
    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.server;
  }

  // ===========================================================================
  // Circuit Breaker Methods
  // ===========================================================================

  /**
   * Check if circuit is open for a server
   *
   * @param serverId - Server ID
   * @returns True if circuit is open
   */
  isCircuitOpen(serverId: string): boolean {
    const state = this.circuitBreakers.get(serverId);
    if (!state) {
      return false;
    }

    if (state.state === 'open') {
      // Check if reset timeout has passed
      if (state.openedAt) {
        const elapsed = Date.now() - state.openedAt.getTime();
        if (elapsed >= this.config.circuitBreakerResetTimeout) {
          // Transition to half-open
          this.transitionCircuit(serverId, 'half-open');
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Get circuit breaker status for a server
   *
   * @param serverId - Server ID
   * @returns Circuit breaker status
   */
  getCircuitStatus(serverId: string): CircuitBreakerStatus {
    const state = this.circuitBreakers.get(serverId);

    if (!state) {
      return {
        serverId,
        state: 'closed',
        failureCount: 0,
      };
    }

    let timeUntilClose: number | undefined;
    if (state.state === 'open' && state.openedAt) {
      const elapsed = Date.now() - state.openedAt.getTime();
      timeUntilClose = Math.max(
        0,
        this.config.circuitBreakerResetTimeout - elapsed,
      );
    }

    return {
      serverId,
      state: state.state,
      failureCount: state.failureCount,
      lastFailure: state.lastFailure,
      timeUntilClose,
    };
  }

  /**
   * Get all circuit breaker statuses
   *
   * @returns Array of circuit breaker statuses
   */
  getAllCircuitStatuses(): readonly CircuitBreakerStatus[] {
    const statuses: CircuitBreakerStatus[] = [];

    for (const serverId of this.registry.getAll().map(s => s.id)) {
      statuses.push(this.getCircuitStatus(serverId));
    }

    return statuses;
  }

  /**
   * Manually reset a circuit breaker
   *
   * @param serverId - Server ID
   */
  resetCircuit(serverId: string): void {
    this.circuitBreakers.delete(serverId);
  }

  /**
   * Manually open a circuit breaker
   *
   * @param serverId - Server ID
   */
  openCircuit(serverId: string): void {
    this.transitionCircuit(serverId, 'open');
  }

  /**
   * Record a successful request
   */
  private recordSuccess(serverId: string): void {
    const state = this.getOrCreateCircuitState(serverId);
    state.successCount++;
    state.lastSuccess = new Date();

    if (state.state === 'half-open') {
      // Success in half-open state closes the circuit
      this.transitionCircuit(serverId, 'closed');
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(serverId: string): void {
    const state = this.getOrCreateCircuitState(serverId);
    state.failureCount++;
    state.lastFailure = new Date();

    if (state.state === 'half-open') {
      // Failure in half-open state re-opens the circuit
      this.transitionCircuit(serverId, 'open');
    } else if (state.failureCount >= this.config.circuitBreakerThreshold) {
      // Threshold exceeded, open the circuit
      this.transitionCircuit(serverId, 'open');
    }
  }

  /**
   * Transition circuit to a new state
   */
  private transitionCircuit(
    serverId: string,
    newState: CircuitBreakerState,
  ): void {
    const state = this.getOrCreateCircuitState(serverId);
    const previousState = state.state;

    state.state = newState;

    if (newState === 'open') {
      state.openedAt = new Date();
    } else if (newState === 'closed') {
      state.failureCount = 0;
      state.openedAt = undefined;
    }

    // Emit circuit event
    const event: CircuitEvent = {
      serverId,
      previousState,
      newState,
      timestamp: new Date(),
    };

    switch (newState) {
      case 'open':
        this.emit('circuit:opened', event);
        break;
      case 'closed':
        this.emit('circuit:closed', event);
        break;
      case 'half-open':
        this.emit('circuit:half-open', event);
        break;
    }
  }

  /**
   * Get or create circuit breaker state
   */
  private getOrCreateCircuitState(
    serverId: string,
  ): CircuitBreakerInternalState {
    let state = this.circuitBreakers.get(serverId);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      };
      this.circuitBreakers.set(serverId, state);
    }
    return state;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /** Track last attempted server for failure recording */
  private lastAttemptedServerId?: string;

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    request: ToolInvocationRequest,
    server: MCPServerRegistration,
    timeoutMs: number,
  ): Promise<ToolResult> {
    this.lastAttemptedServerId = server.id;

    // Check for local handler first
    const handler = this.toolHandlers.get(request.name);
    if (handler) {
      return this.executeWithTimeoutInternal(
        () => handler(request.arguments ?? {}),
        timeoutMs,
        request.name,
      );
    }

    // Default implementation returns a placeholder result
    // In real implementation, this would use transport to call the server
    return this.executeWithTimeoutInternal(
      async () => this.createPlaceholderResult(request, server),
      timeoutMs,
      request.name,
    );
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeoutInternal<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    toolName: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolInvocationTimeoutError(toolName, timeoutMs));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create a placeholder result for demonstration
   */
  private createPlaceholderResult(
    request: ToolInvocationRequest,
    server: MCPServerRegistration,
  ): ToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Tool "${request.name}" would be executed on server "${server.name}"`,
        },
      ],
      isError: false,
      serverId: server.id,
      toolName: request.name,
    };
  }

  /**
   * Get the last attempted server ID
   */
  private getLastAttemptedServerId(): string | undefined {
    return this.lastAttemptedServerId;
  }

  /**
   * Check if a server provides a tool
   */
  private serverProvidesTool(
    server: MCPServerRegistration,
    toolName: string,
  ): boolean {
    return server.tools.some(tool => tool.name === toolName);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit a request event
   */
  private emitRequestEvent(
    type:
      | 'request:started'
      | 'request:completed'
      | 'request:failed'
      | 'request:retried',
    requestId: string,
    toolName: string,
    serverId?: string,
    durationMs?: number,
    error?: Error,
    retryAttempt?: number,
  ): void {
    const event: RequestEvent = {
      requestId,
      toolName,
      serverId,
      durationMs,
      error,
      retryAttempt,
      timestamp: new Date(),
    };

    this.emit(type, event);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get aggregator statistics
   *
   * @returns Aggregator statistics
   */
  getStats(): AggregatorStats {
    const circuitStatuses = this.getAllCircuitStatuses();

    return {
      openCircuits: circuitStatuses.filter(s => s.state === 'open').length,
      halfOpenCircuits: circuitStatuses.filter(s => s.state === 'half-open')
        .length,
      closedCircuits: circuitStatuses.filter(s => s.state === 'closed').length,
      totalRequests: this.requestCounter,
      registeredHandlers: this.toolHandlers.size,
    };
  }

  /**
   * Get the current configuration
   *
   * @returns Current aggregator configuration
   */
  getConfig(): Readonly<Required<AggregatorConfig>> {
    return { ...this.config };
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Tool handler function type
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Aggregator statistics
 */
export interface AggregatorStats {
  /** Number of open circuit breakers */
  readonly openCircuits: number;
  /** Number of half-open circuit breakers */
  readonly halfOpenCircuits: number;
  /** Number of closed circuit breakers */
  readonly closedCircuits: number;
  /** Total requests processed */
  readonly totalRequests: number;
  /** Number of registered direct handlers */
  readonly registeredHandlers: number;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new MCPAggregator
 *
 * @param registry - The server registry
 * @param config - Optional aggregator configuration
 * @returns New aggregator instance
 *
 * @example
 * ```typescript
 * const aggregator = createMCPAggregator(registry, {
 *   defaultStrategy: 'health-aware',
 *   enableRetries: true,
 * });
 * ```
 */
export function createMCPAggregator(
  registry: MCPServerRegistry,
  config?: AggregatorConfig,
): MCPAggregator {
  return new MCPAggregator(registry, config);
}
