/**
 * @neolith/core - Orchestrator Daemon Manager
 *
 * Manages orchestrator daemon lifecycle, including auto-start on login,
 * health monitoring, and graceful shutdown.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';

import { createOrchestratorDaemon, type OrchestratorDaemon, type DaemonConfig } from './daemon';

import type { OrchestratorWithUser } from '../types/orchestrator';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Daemon manager configuration
 */
export interface DaemonManagerConfig {
  /** Auto-start daemon on orchestrator login */
  autoStart?: boolean;

  /** Heartbeat check interval in milliseconds */
  healthCheckInterval?: number;

  /** Auto-restart on failure */
  autoRestart?: boolean;

  /** Maximum restart attempts */
  maxRestartAttempts?: number;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Managed daemon instance
 */
interface ManagedDaemon {
  daemon: OrchestratorDaemon;
  orchestrator: OrchestratorWithUser;
  startedAt: Date;
  restartCount: number;
  lastError?: Error;
}

// =============================================================================
// OrchestratorDaemonManager Class
// =============================================================================

/**
 * Manages multiple orchestrator daemons and their lifecycle.
 * Singleton instance per Neolith app instance.
 */
export class OrchestratorDaemonManager extends EventEmitter {
  private static instance: OrchestratorDaemonManager | null = null;

  private config: Required<DaemonManagerConfig>;
  private daemons: Map<string, ManagedDaemon> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor(config: DaemonManagerConfig = {}) {
    super();
    this.config = {
      autoStart: true,
      healthCheckInterval: 60000, // 1 minute
      autoRestart: true,
      maxRestartAttempts: 3,
      verbose: false,
      ...config,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: DaemonManagerConfig): OrchestratorDaemonManager {
    if (!OrchestratorDaemonManager.instance) {
      OrchestratorDaemonManager.instance = new OrchestratorDaemonManager(config);
    }
    return OrchestratorDaemonManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    OrchestratorDaemonManager.instance = null;
  }

  // ===========================================================================
  // Daemon Lifecycle
  // ===========================================================================

  /**
   * Start daemon for an orchestrator user
   */
  async startDaemon(orchestrator: OrchestratorWithUser): Promise<OrchestratorDaemon> {
    const orchestratorId = orchestrator.id;

    // Check if daemon already running
    if (this.daemons.has(orchestratorId)) {
      this.log(`Daemon already running for orchestrator: ${orchestrator.user.name}`);
      return this.daemons.get(orchestratorId)!.daemon;
    }

    this.log(`Starting daemon for orchestrator: ${orchestrator.user.name}`);

    // Create daemon config
    const daemonConfig: DaemonConfig = {
      orchestratorId,
      orchestrator,
      verbose: this.config.verbose,
    };

    // Create and start daemon
    const daemon = createOrchestratorDaemon(daemonConfig);

    // Set up event listeners
    this.setupDaemonListeners(daemon, orchestratorId);

    try {
      await daemon.start();

      // Track managed daemon
      this.daemons.set(orchestratorId, {
        daemon,
        orchestrator,
        startedAt: new Date(),
        restartCount: 0,
      });

      this.emit('daemon:started', { orchestratorId, orchestrator });
      this.log(`Daemon started successfully for: ${orchestrator.user.name}`);

      // Start health check if first daemon
      if (this.daemons.size === 1 && !this.healthCheckTimer) {
        this.startHealthCheck();
      }

      return daemon;
    } catch (error) {
      this.emit('daemon:start-error', { orchestratorId, error });
      throw error;
    }
  }

  /**
   * Stop daemon for an orchestrator user
   */
  async stopDaemon(orchestratorId: string): Promise<void> {
    const managed = this.daemons.get(orchestratorId);
    if (!managed) {
      this.log(`No daemon running for orchestrator: ${orchestratorId}`);
      return;
    }

    this.log(`Stopping daemon for orchestrator: ${managed.orchestrator.user.name}`);

    try {
      await managed.daemon.stop();
      this.daemons.delete(orchestratorId);

      this.emit('daemon:stopped', { orchestratorId });
      this.log(`Daemon stopped successfully for: ${managed.orchestrator.user.name}`);

      // Stop health check if no more daemons
      if (this.daemons.size === 0 && this.healthCheckTimer) {
        this.stopHealthCheck();
      }
    } catch (error) {
      this.emit('daemon:stop-error', { orchestratorId, error });
      throw error;
    }
  }

  /**
   * Restart daemon for an orchestrator user
   */
  async restartDaemon(orchestratorId: string): Promise<void> {
    const managed = this.daemons.get(orchestratorId);
    if (!managed) {
      throw new Error(`No daemon running for orchestrator: ${orchestratorId}`);
    }

    this.log(`Restarting daemon for orchestrator: ${managed.orchestrator.user.name}`);

    try {
      // Check restart attempt limit
      if (managed.restartCount >= this.config.maxRestartAttempts) {
        throw new Error(
          `Max restart attempts (${this.config.maxRestartAttempts}) reached for orchestrator: ${orchestratorId}`,
        );
      }

      await managed.daemon.restart();
      managed.restartCount++;
      managed.startedAt = new Date();

      this.emit('daemon:restarted', { orchestratorId, restartCount: managed.restartCount });
      this.log(`Daemon restarted successfully for: ${managed.orchestrator.user.name}`);
    } catch (error) {
      managed.lastError = error instanceof Error ? error : new Error(String(error));
      this.emit('daemon:restart-error', { orchestratorId, error });
      throw error;
    }
  }

  /**
   * Stop all running daemons
   */
  async stopAllDaemons(): Promise<void> {
    this.log(`Stopping all ${this.daemons.size} daemons...`);

    const stopPromises = Array.from(this.daemons.keys()).map((orchestratorId) =>
      this.stopDaemon(orchestratorId).catch((error) => {
        this.log(`Error stopping daemon ${orchestratorId}: ${error}`);
      }),
    );

    await Promise.all(stopPromises);
    this.log('All daemons stopped');
  }

  // ===========================================================================
  // Auto-start on Login
  // ===========================================================================

  /**
   * Handle user login - auto-start daemon if orchestrator
   */
  async onUserLogin(orchestrator: OrchestratorWithUser): Promise<void> {
    if (!orchestrator.user.isOrchestrator || !this.config.autoStart) {
      return;
    }

    this.log(`Orchestrator login detected: ${orchestrator.user.name}`);

    try {
      await this.startDaemon(orchestrator);
    } catch (error) {
      this.emit('auto-start-error', { userId: orchestrator.id, error });
      this.log(`Auto-start failed for ${orchestrator.user.name}: ${error}`);
    }
  }

  /**
   * Handle user logout - stop daemon if running
   */
  async onUserLogout(userId: string): Promise<void> {
    if (!this.daemons.has(userId)) {
      return;
    }

    this.log(`Orchestrator logout detected: ${userId}`);

    try {
      await this.stopDaemon(userId);
    } catch (error) {
      this.log(`Error stopping daemon on logout for ${userId}: ${error}`);
    }
  }

  // ===========================================================================
  // Health Monitoring
  // ===========================================================================

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.log('Starting health check monitoring');

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health check
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.log('Health check monitoring stopped');
    }
  }

  /**
   * Perform health check on all daemons
   */
  private async performHealthCheck(): Promise<void> {
    this.log('Performing health check...', true);

    const entries = Array.from(this.daemons.entries());
    for (const [orchestratorId, managed] of entries) {
      try {
        const health = managed.daemon.getHealthStatus();

        // Check if daemon is in error state
        if (health.status === 'error' && this.config.autoRestart) {
          this.log(`Daemon in error state, attempting restart: ${orchestratorId}`);
          await this.restartDaemon(orchestratorId);
        }

        // Emit health status
        this.emit('daemon:health', { orchestratorId, health });
      } catch (error) {
        this.log(`Health check error for ${orchestratorId}: ${error}`);
        this.emit('daemon:health-error', { orchestratorId, error });
      }
    }
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get daemon for an orchestrator
   */
  getDaemon(orchestratorId: string): OrchestratorDaemon | null {
    return this.daemons.get(orchestratorId)?.daemon || null;
  }

  /**
   * Check if daemon is running for an orchestrator
   */
  isDaemonRunning(orchestratorId: string): boolean {
    const managed = this.daemons.get(orchestratorId);
    return managed ? managed.daemon.isRunning() : false;
  }

  /**
   * Get all running daemons
   */
  getRunningDaemons(): Map<string, OrchestratorDaemon> {
    const running = new Map<string, OrchestratorDaemon>();
    const entries = Array.from(this.daemons.entries());
    for (const [id, managed] of entries) {
      if (managed.daemon.isRunning()) {
        running.set(id, managed.daemon);
      }
    }
    return running;
  }

  /**
   * Get daemon status for an orchestrator
   */
  getDaemonStatus(orchestratorId: string) {
    const managed = this.daemons.get(orchestratorId);
    if (!managed) {
      return null;
    }

    return {
      ...managed.daemon.getHealthStatus(),
      orchestrator: managed.orchestrator,
      startedAt: managed.startedAt,
      restartCount: managed.restartCount,
      lastError: managed.lastError?.message,
    };
  }

  /**
   * Get all daemon statuses
   */
  getAllDaemonStatuses() {
    const statuses: Record<string, ReturnType<typeof this.getDaemonStatus>> = {};
    const keys = Array.from(this.daemons.keys());
    for (const orchestratorId of keys) {
      statuses[orchestratorId] = this.getDaemonStatus(orchestratorId);
    }
    return statuses;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Set up event listeners for a daemon
   */
  private setupDaemonListeners(daemon: OrchestratorDaemon, orchestratorId: string): void {
    daemon.on('error', (error) => {
      this.emit('daemon:error', { orchestratorId, error });
      this.log(`Daemon error for ${orchestratorId}: ${error}`);
    });

    daemon.on('message:processed', (message) => {
      this.emit('daemon:message-processed', { orchestratorId, message });
    });

    daemon.on('message:send', (message) => {
      this.emit('daemon:message-send', { orchestratorId, message });
    });

    daemon.on('action:execute', (action) => {
      this.emit('daemon:action', { orchestratorId, action });
    });

    daemon.on('status:changed', (status) => {
      this.emit('daemon:status-changed', { orchestratorId, status });
    });
  }

  /**
   * Log message
   */
  private log(message: string, debug = false): void {
    if (!debug || this.config.verbose) {
      console.log(`[OrchestratorDaemonManager] ${message}`);
    }
  }
}

// =============================================================================
// Factory & Helpers
// =============================================================================

/**
 * Get the daemon manager singleton instance
 */
export function getDaemonManager(config?: DaemonManagerConfig): OrchestratorDaemonManager {
  return OrchestratorDaemonManager.getInstance(config);
}

/**
 * Initialize daemon manager with config
 */
export function initializeDaemonManager(config?: DaemonManagerConfig): OrchestratorDaemonManager {
  return OrchestratorDaemonManager.getInstance(config);
}
