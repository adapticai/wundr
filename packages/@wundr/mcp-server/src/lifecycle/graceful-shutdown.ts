/**
 * Graceful Shutdown Handler for MCP Server
 *
 * Provides controlled shutdown capabilities with proper cleanup
 * of resources, in-flight requests, and signal handling.
 *
 * @packageDocumentation
 */

import type { Logger } from '../types';

// =============================================================================
// Shutdown Types
// =============================================================================

/**
 * Shutdown state values
 */
export type ShutdownState =
  | 'running'
  | 'shutdown_requested'
  | 'draining'
  | 'cleaning_up'
  | 'stopped';

/**
 * Shutdown reason enumeration
 */
export type ShutdownReason =
  | 'signal'
  | 'manual'
  | 'error'
  | 'timeout'
  | 'health_check_failed';

/**
 * Cleanup task function type
 */
export type CleanupTask = () => Promise<void>;

/**
 * Cleanup task registration
 */
export interface CleanupTaskRegistration {
  /** Task name for identification */
  readonly name: string;
  /** Cleanup function */
  readonly task: CleanupTask;
  /** Task priority (higher = runs first) */
  readonly priority?: number;
  /** Timeout for this specific task (ms) */
  readonly timeout?: number;
  /** Whether failure should be fatal */
  readonly critical?: boolean;
}

/**
 * Graceful shutdown configuration
 */
export interface GracefulShutdownConfig {
  /** Timeout for entire shutdown process (ms) */
  readonly shutdownTimeout?: number;
  /** Default timeout for individual tasks (ms) */
  readonly taskTimeout?: number;
  /** Signals to handle */
  readonly signals?: readonly NodeJS.Signals[];
  /** Whether to force exit on timeout */
  readonly forceExitOnTimeout?: boolean;
  /** Drain timeout for in-flight requests (ms) */
  readonly drainTimeout?: number;
  /** Logger instance */
  readonly logger?: Logger;
  /** Callback before shutdown starts */
  readonly onShutdownStart?: (reason: ShutdownReason) => void;
  /** Callback after shutdown completes */
  readonly onShutdownComplete?: (success: boolean, error?: Error) => void;
}

/**
 * Shutdown result
 */
export interface ShutdownResult {
  /** Whether shutdown was successful */
  readonly success: boolean;
  /** Shutdown reason */
  readonly reason: ShutdownReason;
  /** Total shutdown duration (ms) */
  readonly duration: number;
  /** Individual task results */
  readonly taskResults: readonly TaskResult[];
  /** Error if shutdown failed */
  readonly error?: Error;
}

/**
 * Individual task result
 */
export interface TaskResult {
  /** Task name */
  readonly name: string;
  /** Whether task succeeded */
  readonly success: boolean;
  /** Task duration (ms) */
  readonly duration: number;
  /** Error if task failed */
  readonly error?: string;
}

// =============================================================================
// In-Flight Request Tracker
// =============================================================================

/**
 * Tracks in-flight requests for graceful draining
 */
export class InFlightRequestTracker {
  private readonly requests: Map<
    string,
    { startTime: number; metadata?: unknown }
  > = new Map();
  private draining = false;

  /**
   * Register a new in-flight request
   *
   * @param requestId - Unique request identifier
   * @param metadata - Optional request metadata
   * @returns Whether the request was registered (false if draining)
   */
  public register(requestId: string, metadata?: unknown): boolean {
    if (this.draining) {
      return false;
    }

    this.requests.set(requestId, {
      startTime: Date.now(),
      metadata,
    });

    return true;
  }

  /**
   * Complete an in-flight request
   *
   * @param requestId - Request identifier to complete
   */
  public complete(requestId: string): void {
    this.requests.delete(requestId);
  }

  /**
   * Get the count of in-flight requests
   */
  public getCount(): number {
    return this.requests.size;
  }

  /**
   * Check if there are any in-flight requests
   */
  public hasInFlight(): boolean {
    return this.requests.size > 0;
  }

  /**
   * Start draining (reject new requests)
   */
  public startDraining(): void {
    this.draining = true;
  }

  /**
   * Check if currently draining
   */
  public isDraining(): boolean {
    return this.draining;
  }

  /**
   * Wait for all in-flight requests to complete
   *
   * @param timeout - Maximum time to wait (ms)
   * @returns Whether all requests completed within timeout
   */
  public async waitForDrain(timeout: number): Promise<boolean> {
    const start = Date.now();
    const pollInterval = 100;

    while (this.hasInFlight()) {
      if (Date.now() - start > timeout) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return true;
  }

  /**
   * Get details of all in-flight requests
   */
  public getInFlightDetails(): Array<{
    requestId: string;
    duration: number;
    metadata?: unknown;
  }> {
    const now = Date.now();
    return Array.from(this.requests.entries()).map(([requestId, data]) => ({
      requestId,
      duration: now - data.startTime,
      metadata: data.metadata,
    }));
  }

  /**
   * Reset the tracker
   */
  public reset(): void {
    this.requests.clear();
    this.draining = false;
  }
}

// =============================================================================
// Graceful Shutdown Handler
// =============================================================================

/**
 * Graceful Shutdown Handler
 *
 * Manages controlled shutdown of the MCP server with proper
 * resource cleanup and signal handling.
 *
 * @example
 * ```typescript
 * const shutdown = new GracefulShutdownHandler({
 *   shutdownTimeout: 30000,
 *   signals: ['SIGINT', 'SIGTERM'],
 * });
 *
 * shutdown.registerCleanupTask({
 *   name: 'close-connections',
 *   task: async () => {
 *     await closeAllConnections();
 *   },
 *   priority: 100,
 * });
 *
 * shutdown.registerCleanupTask({
 *   name: 'flush-logs',
 *   task: async () => {
 *     await flushLogBuffers();
 *   },
 *   priority: 50,
 * });
 *
 * // Start handling signals
 * shutdown.start();
 *
 * // Or trigger manual shutdown
 * await shutdown.shutdown('manual');
 * ```
 */
export class GracefulShutdownHandler {
  private readonly config: Required<
    Omit<
      GracefulShutdownConfig,
      'logger' | 'onShutdownStart' | 'onShutdownComplete'
    >
  > &
    Pick<
      GracefulShutdownConfig,
      'logger' | 'onShutdownStart' | 'onShutdownComplete'
    >;

  private readonly cleanupTasks: Map<string, CleanupTaskRegistration> =
    new Map();
  private readonly requestTracker: InFlightRequestTracker;
  private readonly signalHandlers: Map<NodeJS.Signals, () => void> = new Map();

  private state: ShutdownState = 'running';
  private shutdownPromise: Promise<ShutdownResult> | null = null;

  /**
   * Create a new Graceful Shutdown Handler
   *
   * @param config - Shutdown configuration
   */
  constructor(config: GracefulShutdownConfig = {}) {
    this.config = {
      shutdownTimeout: config.shutdownTimeout ?? 30000,
      taskTimeout: config.taskTimeout ?? 10000,
      signals: config.signals ?? ['SIGINT', 'SIGTERM'],
      forceExitOnTimeout: config.forceExitOnTimeout ?? true,
      drainTimeout: config.drainTimeout ?? 10000,
      logger: config.logger,
      onShutdownStart: config.onShutdownStart,
      onShutdownComplete: config.onShutdownComplete,
    };

    this.requestTracker = new InFlightRequestTracker();
  }

  /**
   * Get the current shutdown state
   */
  public getState(): ShutdownState {
    return this.state;
  }

  /**
   * Get the in-flight request tracker
   */
  public getRequestTracker(): InFlightRequestTracker {
    return this.requestTracker;
  }

  /**
   * Check if shutdown has been initiated
   */
  public isShuttingDown(): boolean {
    return this.state !== 'running';
  }

  /**
   * Register a cleanup task
   *
   * @param registration - Task registration
   */
  public registerCleanupTask(registration: CleanupTaskRegistration): void {
    this.cleanupTasks.set(registration.name, registration);
    this.config.logger?.debug(`Registered cleanup task: ${registration.name}`);
  }

  /**
   * Unregister a cleanup task
   *
   * @param name - Task name to unregister
   * @returns Whether the task was unregistered
   */
  public unregisterCleanupTask(name: string): boolean {
    const removed = this.cleanupTasks.delete(name);
    if (removed) {
      this.config.logger?.debug(`Unregistered cleanup task: ${name}`);
    }
    return removed;
  }

  /**
   * Start handling shutdown signals
   */
  public start(): void {
    if (this.signalHandlers.size > 0) {
      this.config.logger?.warning('Signal handlers already registered');
      return;
    }

    for (const signal of this.config.signals) {
      const handler = (): void => {
        this.config.logger?.info(
          `Received ${signal} signal, initiating shutdown`
        );
        this.shutdown('signal').catch(error => {
          this.config.logger?.error(
            'Error during signal-triggered shutdown',
            error
          );
        });
      };

      this.signalHandlers.set(signal, handler);
      process.on(signal, handler);
      this.config.logger?.debug(`Registered handler for ${signal}`);
    }

    this.config.logger?.info('Graceful shutdown handler started');
  }

  /**
   * Stop handling shutdown signals
   */
  public stop(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.removeListener(signal, handler);
      this.config.logger?.debug(`Removed handler for ${signal}`);
    }
    this.signalHandlers.clear();
  }

  /**
   * Initiate graceful shutdown
   *
   * @param reason - Reason for shutdown
   * @returns Shutdown result
   */
  public async shutdown(reason: ShutdownReason): Promise<ShutdownResult> {
    // Return existing shutdown promise if already shutting down
    if (this.shutdownPromise) {
      this.config.logger?.warning('Shutdown already in progress');
      return this.shutdownPromise;
    }

    this.config.logger?.info(
      `Initiating graceful shutdown (reason: ${reason})`
    );
    this.shutdownPromise = this.performShutdown(reason);

    return this.shutdownPromise;
  }

  /**
   * Force immediate shutdown
   *
   * @param exitCode - Process exit code
   */
  public forceShutdown(exitCode = 1): void {
    this.config.logger?.warning(
      `Forcing immediate shutdown with exit code ${exitCode}`
    );
    this.stop();
    process.exit(exitCode);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Perform the shutdown sequence
   */
  private async performShutdown(
    reason: ShutdownReason
  ): Promise<ShutdownResult> {
    const start = Date.now();
    const taskResults: TaskResult[] = [];
    let success = true;
    let shutdownError: Error | undefined;

    try {
      // Notify shutdown start
      this.state = 'shutdown_requested';
      this.config.onShutdownStart?.(reason);

      // Create overall timeout
      const timeoutPromise = this.createShutdownTimeout();

      // Race shutdown against timeout
      const shutdownSequence = this.runShutdownSequence(taskResults);

      await Promise.race([shutdownSequence, timeoutPromise]);

      this.state = 'stopped';
    } catch (error) {
      success = false;
      shutdownError = error instanceof Error ? error : new Error(String(error));
      this.config.logger?.error('Shutdown failed', error);

      if (this.config.forceExitOnTimeout) {
        this.config.logger?.warning('Forcing exit due to shutdown failure');
        this.forceShutdown(1);
      }
    } finally {
      // Stop signal handlers
      this.stop();

      // Notify completion
      this.config.onShutdownComplete?.(success, shutdownError);
    }

    return {
      success,
      reason,
      duration: Date.now() - start,
      taskResults,
      error: shutdownError,
    };
  }

  /**
   * Run the full shutdown sequence
   */
  private async runShutdownSequence(taskResults: TaskResult[]): Promise<void> {
    // Phase 1: Drain in-flight requests
    this.state = 'draining';
    this.config.logger?.info('Draining in-flight requests...');
    this.requestTracker.startDraining();

    const drainSuccess = await this.requestTracker.waitForDrain(
      this.config.drainTimeout
    );

    if (!drainSuccess) {
      const remaining = this.requestTracker.getInFlightDetails();
      this.config.logger?.warning(
        `Drain timeout reached with ${remaining.length} requests still in-flight`,
        { requests: remaining }
      );
    }

    // Phase 2: Run cleanup tasks
    this.state = 'cleaning_up';
    this.config.logger?.info('Running cleanup tasks...');

    // Sort tasks by priority (higher first)
    const sortedTasks = Array.from(this.cleanupTasks.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );

    for (const registration of sortedTasks) {
      const result = await this.runCleanupTask(registration);
      taskResults.push(result);

      if (!result.success && registration.critical) {
        throw new Error(`Critical cleanup task failed: ${registration.name}`);
      }
    }

    this.config.logger?.info('Shutdown sequence complete');
  }

  /**
   * Run a single cleanup task with timeout
   */
  private async runCleanupTask(
    registration: CleanupTaskRegistration
  ): Promise<TaskResult> {
    const start = Date.now();
    const timeout = registration.timeout ?? this.config.taskTimeout;

    this.config.logger?.debug(`Running cleanup task: ${registration.name}`);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Cleanup task '${registration.name}' timed out after ${timeout}ms`
            )
          );
        }, timeout);
      });

      // Race task against timeout
      await Promise.race([registration.task(), timeoutPromise]);

      this.config.logger?.debug(`Cleanup task completed: ${registration.name}`);

      return {
        name: registration.name,
        success: true,
        duration: Date.now() - start,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.config.logger?.error(
        `Cleanup task failed: ${registration.name}`,
        error
      );

      return {
        name: registration.name,
        success: false,
        duration: Date.now() - start,
        error: errorMessage,
      };
    }
  }

  /**
   * Create the overall shutdown timeout
   */
  private createShutdownTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Shutdown timed out after ${this.config.shutdownTimeout}ms`)
        );
      }, this.config.shutdownTimeout);
    });
  }
}

/**
 * Create a graceful shutdown handler with default configuration
 *
 * @param logger - Optional logger instance
 * @returns Configured shutdown handler
 */
export function createGracefulShutdownHandler(
  logger?: Logger
): GracefulShutdownHandler {
  return new GracefulShutdownHandler({ logger });
}
