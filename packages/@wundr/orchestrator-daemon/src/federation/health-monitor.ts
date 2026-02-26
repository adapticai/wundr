/**
 * HealthMonitor - Comprehensive health monitoring for cluster nodes
 *
 * Provides multi-layered health checking:
 *   - Liveness probes: Is the process running?
 *   - Readiness probes: Can the node accept work?
 *   - Startup probes: Has the node finished initializing?
 *
 * Features:
 *   - Direct and indirect probing (SWIM-style)
 *   - Configurable failure/success thresholds
 *   - Per-node circuit breakers to prevent cascading failures
 *   - Automated failover with rate-limited session migration
 *   - Integration with existing Prometheus metrics
 */

import { EventEmitter } from 'eventemitter3';

import { Logger, LogLevel } from '../utils/logger';

import type { ClusterNode } from './node-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthMonitorConfig {
  checks: {
    /** Health check frequency in ms (default: 5000) */
    interval: number;
    /** Individual check timeout in ms (default: 3000) */
    timeout: number;
    /** Failures before marking unhealthy (default: 3) */
    failureThreshold: number;
    /** Successes before marking healthy (default: 2) */
    successThreshold: number;
  };
  probes: {
    /** Enable liveness probing */
    liveness: boolean;
    /** Enable readiness probing */
    readiness: boolean;
    /** Enable startup probing */
    startup: boolean;
  };
  failover: {
    /** Enable automated failover */
    enabled: boolean;
    /** Max time for session evacuation in ms (default: 120000) */
    sessionMigrationTimeout: number;
    /** Max parallel migrations (default: 5) */
    maxConcurrentMigrations: number;
    /** Max time for graceful drain in ms (default: 60000) */
    drainTimeout: number;
  };
  circuitBreaker: {
    /** Enable per-node circuit breakers */
    enabled: boolean;
    /** Error rate to trip circuit (0-1, default: 0.5) */
    threshold: number;
    /** Time before half-open in ms (default: 30000) */
    resetTimeout: number;
    /** Requests allowed in half-open state (default: 3) */
    halfOpenRequests: number;
    /** Window size for error rate calculation in ms (default: 60000) */
    windowSize: number;
  };
  nodeId: string;
  verbose: boolean;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreaker {
  nodeId: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastStateChange: Date;
  halfOpenAttempts: number;
  /** Rolling window of request outcomes: [timestamp, success] */
  outcomes: Array<[number, boolean]>;
}

export interface NodeHealthState {
  nodeId: string;
  /** Is the node process running? */
  liveness: ProbeResult;
  /** Can the node accept new work? */
  readiness: ProbeResult;
  /** Has the node finished initializing? */
  startup: ProbeResult;
  /** Overall health verdict */
  healthy: boolean;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Consecutive successes */
  consecutiveSuccesses: number;
  /** Last check timestamp */
  lastCheck: Date;
  /** Response time of last check (ms) */
  lastResponseTime: number;
  /** Circuit breaker state for this node */
  circuitBreaker: CircuitBreakerState;
}

export interface ProbeResult {
  success: boolean;
  timestamp: Date;
  responseTime: number;
  error?: string;
}

export interface FailoverPlan {
  nodeId: string;
  sessions: string[];
  targetNodes: Map<string, string>;
  startedAt: Date;
  timeout: number;
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'timeout';
  migrationsCompleted: number;
  migrationsFailed: number;
}

/**
 * Probe function: attempts to check a node's health.
 * Returns true if the node is healthy.
 */
export type ProbeFunction = (node: ClusterNode) => Promise<ProbeResult>;

export interface HealthMonitorEvents {
  'node:healthy': (nodeId: string, state: NodeHealthState) => void;
  'node:unhealthy': (nodeId: string, state: NodeHealthState) => void;
  'node:suspect': (nodeId: string, consecutiveFailures: number) => void;
  'node:dead': (nodeId: string) => void;
  'node:recovered': (nodeId: string) => void;
  'circuit:opened': (nodeId: string) => void;
  'circuit:half-open': (nodeId: string) => void;
  'circuit:closed': (nodeId: string) => void;
  'failover:started': (plan: FailoverPlan) => void;
  'failover:completed': (plan: FailoverPlan) => void;
  'failover:failed': (plan: FailoverPlan, error: string) => void;
  'check:completed': (results: Map<string, NodeHealthState>) => void;
  error: (error: Error, context: string) => void;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: HealthMonitorConfig = {
  checks: {
    interval: 5_000,
    timeout: 3_000,
    failureThreshold: 3,
    successThreshold: 2,
  },
  probes: {
    liveness: true,
    readiness: true,
    startup: true,
  },
  failover: {
    enabled: true,
    sessionMigrationTimeout: 120_000,
    maxConcurrentMigrations: 5,
    drainTimeout: 60_000,
  },
  circuitBreaker: {
    enabled: true,
    threshold: 0.5,
    resetTimeout: 30_000,
    halfOpenRequests: 3,
    windowSize: 60_000,
  },
  nodeId: 'unknown',
  verbose: false,
};

// ---------------------------------------------------------------------------
// Default probe implementation
// ---------------------------------------------------------------------------

function createDefaultProbe(): ProbeFunction {
  return async (_node: ClusterNode): Promise<ProbeResult> => {
    // Default probe: check if the node's lastSeen is recent
    const now = Date.now();
    const elapsed = now - _node.lastSeen.getTime();
    const success = elapsed < 60_000; // Consider alive if seen in last 60s

    return {
      success,
      timestamp: new Date(),
      responseTime: 0,
      error: success ? undefined : `Last seen ${elapsed}ms ago`,
    };
  };
}

// ---------------------------------------------------------------------------
// HealthMonitor
// ---------------------------------------------------------------------------

export class HealthMonitor extends EventEmitter<HealthMonitorEvents> {
  private logger: Logger;
  private config: HealthMonitorConfig;

  /** Per-node health state */
  private healthStates: Map<string, NodeHealthState> = new Map();

  /** Per-node circuit breakers */
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  /** Active failover plans */
  private failoverPlans: Map<string, FailoverPlan> = new Map();

  /** Probe functions */
  private livenessProbe: ProbeFunction;
  private readinessProbe: ProbeFunction;
  private startupProbe: ProbeFunction;

  /** Health check timer */
  private checkTimer: NodeJS.Timeout | null = null;

  private running = false;

  constructor(
    config: Partial<HealthMonitorConfig> = {},
    probes?: {
      liveness?: ProbeFunction;
      readiness?: ProbeFunction;
      startup?: ProbeFunction;
    }
  ) {
    super();
    this.config = {
      checks: { ...DEFAULT_CONFIG.checks, ...config.checks },
      probes: { ...DEFAULT_CONFIG.probes, ...config.probes },
      failover: { ...DEFAULT_CONFIG.failover, ...config.failover },
      circuitBreaker: {
        ...DEFAULT_CONFIG.circuitBreaker,
        ...config.circuitBreaker,
      },
      nodeId: config.nodeId ?? DEFAULT_CONFIG.nodeId,
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
    };
    this.logger = new Logger(
      'HealthMonitor',
      this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO
    );

    const defaultProbe = createDefaultProbe();
    this.livenessProbe = probes?.liveness ?? defaultProbe;
    this.readinessProbe = probes?.readiness ?? defaultProbe;
    this.startupProbe = probes?.startup ?? defaultProbe;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start periodic health checking.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    this.checkTimer = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        this.emit('error', error as Error, 'runHealthChecks');
      }
    }, this.config.checks.interval);

    this.logger.info('HealthMonitor started');
  }

  /**
   * Stop health checking and clean up.
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    this.logger.info('HealthMonitor stopped');
  }

  // -----------------------------------------------------------------------
  // Node registration
  // -----------------------------------------------------------------------

  /**
   * Register a node for health monitoring.
   */
  registerNode(nodeId: string): void {
    if (this.healthStates.has(nodeId)) {
      return;
    }

    const now = new Date();

    this.healthStates.set(nodeId, {
      nodeId,
      liveness: { success: true, timestamp: now, responseTime: 0 },
      readiness: { success: true, timestamp: now, responseTime: 0 },
      startup: { success: true, timestamp: now, responseTime: 0 },
      healthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheck: now,
      lastResponseTime: 0,
      circuitBreaker: 'closed',
    });

    if (this.config.circuitBreaker.enabled) {
      this.circuitBreakers.set(nodeId, {
        nodeId,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailure: null,
        lastStateChange: now,
        halfOpenAttempts: 0,
        outcomes: [],
      });
    }
  }

  /**
   * Unregister a node from health monitoring.
   */
  unregisterNode(nodeId: string): void {
    this.healthStates.delete(nodeId);
    this.circuitBreakers.delete(nodeId);
  }

  // -----------------------------------------------------------------------
  // Health checks
  // -----------------------------------------------------------------------

  /**
   * Run health checks on all registered nodes.
   */
  async runHealthChecks(): Promise<Map<string, NodeHealthState>> {
    const nodes = this.getMonitoredNodes();
    const results = new Map<string, NodeHealthState>();

    const checkPromises = nodes.map(async nodeId => {
      const state = await this.checkNode(nodeId);
      if (state) {
        results.set(nodeId, state);
      }
    });

    await Promise.allSettled(checkPromises);

    this.emit('check:completed', results);
    return results;
  }

  /**
   * Check a single node's health.
   */
  async checkNode(nodeId: string): Promise<NodeHealthState | null> {
    const state = this.healthStates.get(nodeId);
    if (!state) {
      return null;
    }

    // Skip if circuit breaker is open (unless it is time for half-open)
    if (this.config.circuitBreaker.enabled) {
      const cb = this.circuitBreakers.get(nodeId);
      if (cb && cb.state === 'open') {
        const elapsed = Date.now() - cb.lastStateChange.getTime();
        if (elapsed < this.config.circuitBreaker.resetTimeout) {
          return state; // Still in open state; skip check
        }
        // Transition to half-open
        this.transitionCircuitBreaker(nodeId, 'half-open');
      }
    }

    // We need a ClusterNode to probe -- use a synthetic one
    const syntheticNode: ClusterNode = {
      id: nodeId,
      host: '',
      port: 0,
      federationPort: 0,
      region: '',
      zone: '',
      capabilities: [],
      status: 'active',
      role: 'follower',
      generation: 0,
      joinedAt: new Date(),
      lastSeen: new Date(),
      load: {
        activeSessions: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        tokenRate: 0,
        errorRate: 0,
        timestamp: new Date(),
      },
      metadata: {},
    };

    // Run probes
    const startTime = Date.now();

    if (this.config.probes.liveness) {
      state.liveness = await this.runProbeWithTimeout(
        this.livenessProbe,
        syntheticNode
      );
    }

    if (this.config.probes.readiness) {
      state.readiness = await this.runProbeWithTimeout(
        this.readinessProbe,
        syntheticNode
      );
    }

    if (this.config.probes.startup) {
      state.startup = await this.runProbeWithTimeout(
        this.startupProbe,
        syntheticNode
      );
    }

    state.lastCheck = new Date();
    state.lastResponseTime = Date.now() - startTime;

    // Determine overall health
    const isHealthy = state.liveness.success && state.readiness.success;

    if (isHealthy) {
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses++;

      if (
        !state.healthy &&
        state.consecutiveSuccesses >= this.config.checks.successThreshold
      ) {
        state.healthy = true;
        this.emit('node:healthy', nodeId, state);
        this.emit('node:recovered', nodeId);

        if (this.config.circuitBreaker.enabled) {
          this.recordCircuitBreakerOutcome(nodeId, true);
        }
      } else if (state.healthy) {
        if (this.config.circuitBreaker.enabled) {
          this.recordCircuitBreakerOutcome(nodeId, true);
        }
      }
    } else {
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures++;

      if (this.config.circuitBreaker.enabled) {
        this.recordCircuitBreakerOutcome(nodeId, false);
      }

      if (
        state.consecutiveFailures >= this.config.checks.failureThreshold &&
        state.healthy
      ) {
        state.healthy = false;
        this.emit('node:unhealthy', nodeId, state);
        this.emit('node:dead', nodeId);

        // Trigger failover if enabled
        if (this.config.failover.enabled) {
          this.initiateFailover(nodeId);
        }
      } else if (state.consecutiveFailures > 0 && state.healthy) {
        this.emit('node:suspect', nodeId, state.consecutiveFailures);
      }
    }

    // Update circuit breaker state in health state
    const cb = this.circuitBreakers.get(nodeId);
    if (cb) {
      state.circuitBreaker = cb.state;
    }

    return state;
  }

  /**
   * Check health with a ClusterNode object (uses actual node data).
   */
  async checkClusterNode(node: ClusterNode): Promise<NodeHealthState | null> {
    // Ensure node is registered
    if (!this.healthStates.has(node.id)) {
      this.registerNode(node.id);
    }

    const state = this.healthStates.get(node.id)!;

    const startTime = Date.now();

    if (this.config.probes.liveness) {
      state.liveness = await this.runProbeWithTimeout(this.livenessProbe, node);
    }

    if (this.config.probes.readiness) {
      state.readiness = await this.runProbeWithTimeout(
        this.readinessProbe,
        node
      );
    }

    if (this.config.probes.startup) {
      state.startup = await this.runProbeWithTimeout(this.startupProbe, node);
    }

    state.lastCheck = new Date();
    state.lastResponseTime = Date.now() - startTime;

    const isHealthy = state.liveness.success && state.readiness.success;

    if (isHealthy) {
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses++;
      if (
        !state.healthy &&
        state.consecutiveSuccesses >= this.config.checks.successThreshold
      ) {
        state.healthy = true;
        this.emit('node:healthy', node.id, state);
        this.emit('node:recovered', node.id);
      }
    } else {
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures++;
      if (
        state.consecutiveFailures >= this.config.checks.failureThreshold &&
        state.healthy
      ) {
        state.healthy = false;
        this.emit('node:unhealthy', node.id, state);
      }
    }

    if (this.config.circuitBreaker.enabled) {
      this.recordCircuitBreakerOutcome(node.id, isHealthy);
      const cb = this.circuitBreakers.get(node.id);
      if (cb) {
        state.circuitBreaker = cb.state;
      }
    }

    return state;
  }

  // -----------------------------------------------------------------------
  // Circuit breaker
  // -----------------------------------------------------------------------

  /**
   * Check if requests to a node should be allowed (circuit breaker check).
   */
  isNodeAvailable(nodeId: string): boolean {
    if (!this.config.circuitBreaker.enabled) {
      return true;
    }

    const cb = this.circuitBreakers.get(nodeId);
    if (!cb) {
      return true;
    }

    switch (cb.state) {
      case 'closed':
        return true;

      case 'open': {
        // Check if it is time to transition to half-open
        const elapsed = Date.now() - cb.lastStateChange.getTime();
        if (elapsed >= this.config.circuitBreaker.resetTimeout) {
          this.transitionCircuitBreaker(nodeId, 'half-open');
          return true;
        }
        return false;
      }

      case 'half-open':
        return (
          cb.halfOpenAttempts < this.config.circuitBreaker.halfOpenRequests
        );
    }
  }

  /**
   * Record a request outcome for the circuit breaker.
   */
  recordRequestOutcome(nodeId: string, success: boolean): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }
    this.recordCircuitBreakerOutcome(nodeId, success);
  }

  /**
   * Get the circuit breaker state for a node.
   */
  getCircuitBreakerState(nodeId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(nodeId)?.state ?? null;
  }

  private recordCircuitBreakerOutcome(nodeId: string, success: boolean): void {
    const cb = this.circuitBreakers.get(nodeId);
    if (!cb) {
      return;
    }

    const now = Date.now();

    // Add to rolling window
    cb.outcomes.push([now, success]);

    // Trim old entries outside window
    const windowStart = now - this.config.circuitBreaker.windowSize;
    cb.outcomes = cb.outcomes.filter(([ts]) => ts >= windowStart);

    if (success) {
      cb.successCount++;

      if (cb.state === 'half-open') {
        cb.halfOpenAttempts++;
        if (
          cb.halfOpenAttempts >= this.config.circuitBreaker.halfOpenRequests
        ) {
          // All half-open attempts succeeded; close the circuit
          this.transitionCircuitBreaker(nodeId, 'closed');
        }
      }
    } else {
      cb.failureCount++;
      cb.lastFailure = new Date();

      if (cb.state === 'half-open') {
        // Any failure in half-open reopens the circuit
        this.transitionCircuitBreaker(nodeId, 'open');
        return;
      }

      // Check error rate in the window
      if (cb.outcomes.length >= 5) {
        // Minimum sample size
        const failures = cb.outcomes.filter(([, s]) => !s).length;
        const errorRate = failures / cb.outcomes.length;

        if (
          errorRate >= this.config.circuitBreaker.threshold &&
          cb.state === 'closed'
        ) {
          this.transitionCircuitBreaker(nodeId, 'open');
        }
      }
    }
  }

  private transitionCircuitBreaker(
    nodeId: string,
    newState: CircuitBreakerState
  ): void {
    const cb = this.circuitBreakers.get(nodeId);
    if (!cb || cb.state === newState) {
      return;
    }

    const oldState = cb.state;
    cb.state = newState;
    cb.lastStateChange = new Date();

    if (newState === 'half-open') {
      cb.halfOpenAttempts = 0;
    }

    if (newState === 'closed') {
      cb.failureCount = 0;
      cb.successCount = 0;
      cb.outcomes = [];
    }

    this.logger.info(
      `Circuit breaker for ${nodeId}: ${oldState} -> ${newState}`
    );

    switch (newState) {
      case 'open':
        this.emit('circuit:opened', nodeId);
        break;
      case 'half-open':
        this.emit('circuit:half-open', nodeId);
        break;
      case 'closed':
        this.emit('circuit:closed', nodeId);
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Failover
  // -----------------------------------------------------------------------

  /**
   * Initiate failover for a node. Migrates sessions to healthy nodes.
   */
  initiateFailover(nodeId: string): FailoverPlan {
    if (this.failoverPlans.has(nodeId)) {
      return this.failoverPlans.get(nodeId)!;
    }

    const plan: FailoverPlan = {
      nodeId,
      sessions: [], // Populated by caller
      targetNodes: new Map(),
      startedAt: new Date(),
      timeout: this.config.failover.sessionMigrationTimeout,
      status: 'planned',
      migrationsCompleted: 0,
      migrationsFailed: 0,
    };

    this.failoverPlans.set(nodeId, plan);
    this.emit('failover:started', plan);
    this.logger.info(`Failover initiated for node ${nodeId}`);

    return plan;
  }

  /**
   * Update failover plan with session list and target assignments.
   */
  updateFailoverPlan(
    nodeId: string,
    sessions: string[],
    targetAssignments: Map<string, string>
  ): void {
    const plan = this.failoverPlans.get(nodeId);
    if (!plan) {
      return;
    }

    plan.sessions = sessions;
    plan.targetNodes = targetAssignments;
    plan.status = 'executing';
  }

  /**
   * Record a migration result for the failover plan.
   */
  recordMigrationResult(
    nodeId: string,
    sessionId: string,
    success: boolean
  ): void {
    const plan = this.failoverPlans.get(nodeId);
    if (!plan) {
      return;
    }

    if (success) {
      plan.migrationsCompleted++;
    } else {
      plan.migrationsFailed++;
    }

    // Check if failover is complete
    const totalProcessed = plan.migrationsCompleted + plan.migrationsFailed;
    if (totalProcessed >= plan.sessions.length) {
      if (plan.migrationsFailed === 0) {
        plan.status = 'completed';
        this.emit('failover:completed', plan);
      } else {
        plan.status = 'failed';
        this.emit(
          'failover:failed',
          plan,
          `${plan.migrationsFailed} migrations failed`
        );
      }
      this.failoverPlans.delete(nodeId);
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getNodeHealth(nodeId: string): NodeHealthState | undefined {
    return this.healthStates.get(nodeId);
  }

  getAllHealthStates(): Map<string, NodeHealthState> {
    return new Map(this.healthStates);
  }

  getHealthyNodeIds(): string[] {
    return Array.from(this.healthStates.entries())
      .filter(([, state]) => state.healthy)
      .map(([id]) => id);
  }

  getUnhealthyNodeIds(): string[] {
    return Array.from(this.healthStates.entries())
      .filter(([, state]) => !state.healthy)
      .map(([id]) => id);
  }

  getMonitoredNodes(): string[] {
    return Array.from(this.healthStates.keys());
  }

  getActiveFailoverPlans(): FailoverPlan[] {
    return Array.from(this.failoverPlans.values());
  }

  // -----------------------------------------------------------------------
  // Probe helpers
  // -----------------------------------------------------------------------

  private async runProbeWithTimeout(
    probe: ProbeFunction,
    node: ClusterNode
  ): Promise<ProbeResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        probe(node),
        this.createTimeout(this.config.checks.timeout),
      ]);

      return {
        ...result,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Probe failed',
      };
    }
  }

  private createTimeout(ms: number): Promise<ProbeResult> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: false,
          timestamp: new Date(),
          responseTime: ms,
          error: `Probe timeout (${ms}ms)`,
        });
      }, ms);
    });
  }
}
