/**
 * Session Pool Manager for Concurrent VP Sessions
 *
 * Manages a pool of Claude Code sessions with resource limits,
 * queuing, and automatic scaling.
 *
 * @module session-pool
 */

import { EventEmitter } from 'events';
import ClaudeSessionSpawner, {
  ClaudeSessionConfig,
  ClaudeSessionStatus,
  SpawnResult,
} from './claude-session-spawner.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SessionPoolConfig {
  /** Maximum number of concurrent sessions */
  maxConcurrentSessions: number;
  /** Minimum number of idle sessions to maintain */
  minIdleSessions?: number;
  /** Session timeout in milliseconds */
  defaultSessionTimeout: number;
  /** Maximum queue size for pending requests */
  maxQueueSize: number;
  /** Enable automatic session recovery on crash */
  autoRecovery?: boolean;
  /** Session priority weights */
  priorityWeights?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface PooledSessionRequest {
  /** Unique request identifier */
  requestId: string;
  /** Session configuration */
  config: ClaudeSessionConfig;
  /** Request priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Timestamp when request was created */
  queuedAt: Date;
  /** Callback for session allocation */
  onAllocated?: (sessionId: string) => void;
  /** Callback for session completion */
  onCompleted?: (status: ClaudeSessionStatus) => void;
  /** Callback for session failure */
  onFailed?: (error: Error) => void;
}

export interface PoolStatus {
  /** Total pool capacity */
  capacity: number;
  /** Number of active sessions */
  activeCount: number;
  /** Number of idle sessions */
  idleCount: number;
  /** Number of requests in queue */
  queuedCount: number;
  /** Pool utilization percentage */
  utilization: number;
  /** Active sessions */
  activeSessions: ClaudeSessionStatus[];
  /** Queued requests */
  queuedRequests: QueuedRequestInfo[];
}

export interface QueuedRequestInfo {
  requestId: string;
  priority: string;
  queuedAt: Date;
  estimatedWaitTime: number;
}

// ============================================================================
// Session Pool Class
// ============================================================================

export class SessionPool extends EventEmitter {
  private readonly spawner: ClaudeSessionSpawner;
  private readonly config: Required<SessionPoolConfig>;
  private readonly requestQueue: PooledSessionRequest[] = [];
  private readonly activeRequests = new Map<
    string,
    PooledSessionRequest
  >();
  private processingQueue = false;

  constructor(
    spawner: ClaudeSessionSpawner,
    config: SessionPoolConfig
  ) {
    super();
    this.spawner = spawner;
    this.config = {
      minIdleSessions: 0,
      autoRecovery: true,
      priorityWeights: {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      },
      ...config,
    };

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Request a session from the pool
   */
  async requestSession(
    request: PooledSessionRequest
  ): Promise<SpawnResult> {
    // Check if we can spawn immediately
    const activeCount = this.spawner.getActiveSessions().length;

    if (activeCount < this.config.maxConcurrentSessions) {
      return this.allocateSession(request);
    }

    // Queue the request
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      throw new Error('Session pool queue is full');
    }

    return new Promise((resolve, reject) => {
      // Add completion handlers
      const originalOnCompleted = request.onCompleted;
      const originalOnFailed = request.onFailed;

      request.onCompleted = (status) => {
        originalOnCompleted?.(status);
        resolve({
          sessionId: status.sessionId,
          status,
          completion: Promise.resolve(status),
        });
      };

      request.onFailed = (error) => {
        originalOnFailed?.(error);
        reject(error);
      };

      this.enqueueRequest(request);
    });
  }

  /**
   * Get current pool status
   */
  getPoolStatus(): PoolStatus {
    const activeSessions = this.spawner.getActiveSessions();
    const activeCount = activeSessions.length;
    const idleCount = activeSessions.filter(
      (s) => s.state === 'waiting_input'
    ).length;

    return {
      capacity: this.config.maxConcurrentSessions,
      activeCount,
      idleCount,
      queuedCount: this.requestQueue.length,
      utilization: (activeCount / this.config.maxConcurrentSessions) * 100,
      activeSessions,
      queuedRequests: this.requestQueue.map((req) => ({
        requestId: req.requestId,
        priority: req.priority,
        queuedAt: req.queuedAt,
        estimatedWaitTime: this.estimateWaitTime(req),
      })),
    };
  }

  /**
   * Cancel a queued request
   */
  cancelRequest(requestId: string): boolean {
    const index = this.requestQueue.findIndex(
      (r) => r.requestId === requestId
    );

    if (index !== -1) {
      const request = this.requestQueue.splice(index, 1)[0];
      request.onFailed?.(new Error('Request cancelled'));
      this.emit('request-cancelled', { requestId });
      return true;
    }

    return false;
  }

  /**
   * Drain the pool gracefully
   */
  async drain(timeoutMs = 30000): Promise<void> {
    this.emit('pool-draining');

    const activeSessions = this.spawner.getActiveSessions();

    const drainPromises = activeSessions.map(async (session) => {
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, timeoutMs);
      });

      const sessionPromise = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const status = this.spawner.getSessionStatus(session.sessionId);
          if (
            !status ||
            status.state === 'completed' ||
            status.state === 'failed' ||
            status.state === 'crashed'
          ) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      await Promise.race([sessionPromise, timeoutPromise]);

      // Force terminate if still running
      const status = this.spawner.getSessionStatus(session.sessionId);
      if (status && status.state === 'running') {
        await this.spawner.terminateSession(session.sessionId, true);
      }
    });

    await Promise.all(drainPromises);

    this.emit('pool-drained');
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    const status = this.getPoolStatus();
    const summary = this.spawner.getMetricsSummary();

    return {
      ...summary,
      poolUtilization: status.utilization,
      queueLength: status.queuedCount,
      queueWaitTime: this.calculateAverageQueueWaitTime(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupEventHandlers(): void {
    this.spawner.on('session-ended', ({ sessionId, status }) => {
      // Remove from active requests
      this.activeRequests.delete(sessionId);

      // Process next queued request
      this.processQueue();

      this.emit('session-released', { sessionId, status });
    });

    this.spawner.on('session-timeout', ({ sessionId }) => {
      this.handleSessionFailure(sessionId, new Error('Session timeout'));
    });
  }

  private async allocateSession(
    request: PooledSessionRequest
  ): Promise<SpawnResult> {
    try {
      const result = await this.spawner.spawnSession(request.config);

      this.activeRequests.set(result.sessionId, request);

      // Notify allocation
      request.onAllocated?.(result.sessionId);

      // Set up completion handler
      result.completion.then(
        (status) => {
          request.onCompleted?.(status);
          this.activeRequests.delete(result.sessionId);
        },
        (error) => {
          request.onFailed?.(error);
          this.activeRequests.delete(result.sessionId);
        }
      );

      this.emit('session-allocated', {
        requestId: request.requestId,
        sessionId: result.sessionId,
      });

      return result;
    } catch (error) {
      request.onFailed?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  private enqueueRequest(request: PooledSessionRequest): void {
    // Insert based on priority
    const priority = this.config.priorityWeights[request.priority];
    let insertIndex = this.requestQueue.length;

    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedPriority =
        this.config.priorityWeights[this.requestQueue[i].priority];
      if (priority > queuedPriority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, request);

    this.emit('request-queued', {
      requestId: request.requestId,
      position: insertIndex,
      queueLength: this.requestQueue.length,
    });

    // Try to process queue
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const activeCount = this.spawner.getActiveSessions().length;

        if (activeCount >= this.config.maxConcurrentSessions) {
          break;
        }

        const request = this.requestQueue.shift();
        if (request) {
          await this.allocateSession(request);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private handleSessionFailure(sessionId: string, error: Error): void {
    const request = this.activeRequests.get(sessionId);

    if (request) {
      request.onFailed?.(error);
      this.activeRequests.delete(sessionId);

      // Retry with auto-recovery if enabled
      if (this.config.autoRecovery) {
        this.emit('session-recovering', { sessionId, requestId: request.requestId });
        this.enqueueRequest(request);
      }
    }
  }

  private estimateWaitTime(request: PooledSessionRequest): number {
    const position = this.requestQueue.indexOf(request);
    if (position === -1) return 0;

    // Estimate based on average execution time
    const summary = this.spawner.getMetricsSummary();
    const avgTime = summary.avgExecutionTime || 60000; // Default 1 minute

    return position * avgTime;
  }

  private calculateAverageQueueWaitTime(): number {
    if (this.requestQueue.length === 0) return 0;

    const now = Date.now();
    const totalWaitTime = this.requestQueue.reduce(
      (sum, req) => sum + (now - req.queuedAt.getTime()),
      0
    );

    return totalWaitTime / this.requestQueue.length;
  }
}

// ============================================================================
// Additional Types
// ============================================================================

export interface PoolMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  crashedSessions: number;
  avgExecutionTime: number;
  totalTokensUsed: number;
  poolUtilization: number;
  queueLength: number;
  queueWaitTime: number;
}

// ============================================================================
// Exports
// ============================================================================

export default SessionPool;
