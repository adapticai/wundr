#!/usr/bin/env node
/* eslint-disable import/order */
/**
 * VP Daemon - Main Entry Point
 *
 * The Virtual Principal Daemon orchestrates identity management, session handling,
 * triage operations, PTY control, resource allocation, telemetry collection, and
 * intervention workflows for distributed agent coordination.
 *
 * @module vp-daemon
 */

import { EventEmitter } from 'events';

import chalk from 'chalk';
import { Command } from 'commander';

// Subsystem imports (ES modules with .js extensions)
import { IdentityManager } from './identity-manager.js';
import { InterventionEngine } from './intervention-engine.js';
import { PTYController } from './pty-controller.js';
import { ResourceAllocator } from './resource-allocator.js';
import { SessionSlotManager } from './session-manager.js';
import { TelemetryCollector } from './telemetry-collector.js';
import { TriageEngine } from './triage-engine.js';

import type { IdentityManagerConfig, VPIdentity } from './identity-manager.js';
import type { InterventionConfig } from './intervention-engine.js';
import type { PTYControllerConfig } from './pty-controller.js';
import type { ResourceAllocatorConfig } from './resource-allocator.js';
import type { SessionSlotManagerConfig } from './session-manager.js';
import type { ObservabilityConfig } from './telemetry-collector.js';
import type { TriageEngineConfig } from './triage-engine.js';

/**
 * Configuration for the VP Daemon
 */
export interface VPDaemonConfig {
  /** Unique identifier for this daemon instance */
  id?: string;
  /** Human-readable name for the daemon */
  name?: string;
  /** Port number for daemon communication */
  port?: number;
  /** Host address to bind to */
  host?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum number of concurrent sessions */
  maxSessions?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Graceful shutdown timeout in milliseconds */
  shutdownTimeout?: number;
  /** Subsystem configurations */
  subsystems?: {
    identity?: Partial<IdentityManagerConfig>;
    session?: Partial<SessionSlotManagerConfig>;
    triage?: Partial<TriageEngineConfig>;
    pty?: Partial<PTYControllerConfig>;
    resource?: Partial<ResourceAllocatorConfig>;
    telemetry?: Partial<ObservabilityConfig>;
    intervention?: Partial<InterventionConfig>;
  };
}

/**
 * Health status for daemon components
 */
export interface DaemonHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  startTime: Date;
  subsystems: {
    identity: SubsystemHealth;
    session: SubsystemHealth;
    triage: SubsystemHealth;
    pty: SubsystemHealth;
    resource: SubsystemHealth;
    telemetry: SubsystemHealth;
    intervention: SubsystemHealth;
  };
  metrics: {
    activeSessions: number;
    totalRequests: number;
    errorRate: number;
    avgLatency: number;
  };
}

interface SubsystemHealth {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastHealthCheck: Date;
  errorCount: number;
}

/**
 * Default safety heuristics for PTY controller
 */
const DEFAULT_SAFETY_HEURISTICS: PTYControllerConfig['safetyHeuristics'] = {
  autoApprovePatterns: [
    {
      name: 'read-operations',
      pattern: /read|cat|ls|grep|find/i,
      description: 'Safe read operations',
    },
    {
      name: 'test-commands',
      pattern: /npm test|yarn test|jest/i,
      description: 'Test commands',
    },
  ],
  alwaysRejectPatterns: [
    {
      name: 'rm-rf',
      pattern: /rm\s+-rf\s+\//i,
      description: 'Dangerous recursive delete',
    },
    {
      name: 'force-push',
      pattern: /git\s+push.*--force/i,
      description: 'Force push',
    },
  ],
  escalationPatterns: [
    {
      name: 'production-deploy',
      pattern: /deploy.*prod/i,
      description: 'Production deployments',
    },
    {
      name: 'secrets',
      pattern: /password|secret|token|api.?key/i,
      description: 'Secret-related operations',
    },
  ],
};

/**
 * Default token budget configuration
 */
const DEFAULT_TOKEN_BUDGET = {
  dailyLimit: 1000000,
  monthlyLimit: 20000000,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
  currentDailyUsage: 0,
  currentMonthlyUsage: 0,
  lastResetDate: new Date(),
  lastMonthlyResetDate: new Date(),
};

/**
 * VP Daemon - Main orchestrator class
 *
 * Manages all subsystems and provides lifecycle control for the daemon.
 */
export class VPDaemon extends EventEmitter {
  private readonly config: Required<VPDaemonConfig>;
  private readonly startTime: Date;

  // Subsystems
  private identityManager: IdentityManager | null = null;
  private sessionManager: SessionSlotManager | null = null;
  private triageEngine: TriageEngine | null = null;
  private ptyController: PTYController | null = null;
  private resourceAllocator: ResourceAllocator | null = null;
  private telemetryCollector: TelemetryCollector | null = null;
  private interventionEngine: InterventionEngine | null = null;

  // State
  private isRunning = false;
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private vpIdentity: VPIdentity | null = null;
  private metrics = {
    activeSessions: 0,
    totalRequests: 0,
    errorCount: 0,
    totalLatency: 0,
  };

  constructor(config: VPDaemonConfig = {}) {
    super();
    this.startTime = new Date();

    // Apply defaults
    this.config = {
      id: config.id ?? this.generateId(),
      name: config.name ?? 'vp-daemon',
      port: config.port ?? 8787,
      host: config.host ?? '127.0.0.1',
      verbose: config.verbose ?? false,
      maxSessions: config.maxSessions ?? 100,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      shutdownTimeout: config.shutdownTimeout ?? 10000,
      subsystems: config.subsystems ?? {},
    };

    this.log('info', `VP Daemon initialized with ID: ${this.config.id}`);
  }

  /**
   * Start the VP Daemon and all subsystems
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Daemon is already running');
      return;
    }

    if (this.isShuttingDown) {
      throw new Error('Cannot start daemon while shutdown is in progress');
    }

    this.log('info', 'Starting VP Daemon...');

    try {
      // Initialize subsystems in dependency order
      await this.initializeSubsystems();

      // Start health check loop
      this.startHealthChecks();

      // Set up signal handlers
      this.setupSignalHandlers();

      this.isRunning = true;
      this.emit('started', { id: this.config.id, timestamp: new Date() });

      this.log(
        'success',
        `VP Daemon started successfully on ${this.config.host}:${this.config.port}`
      );
      this.log('info', 'Press Ctrl+C to stop the daemon');
    } catch (error) {
      this.log('error', 'Failed to start daemon', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the VP Daemon gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.log('warn', 'Daemon is not running');
      return;
    }

    if (this.isShuttingDown) {
      this.log('warn', 'Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.log('info', 'Initiating graceful shutdown...');

    const shutdownPromise = this.performShutdown();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Shutdown timeout exceeded'));
      }, this.config.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.log('success', 'VP Daemon stopped gracefully');
    } catch (error) {
      this.log('error', 'Shutdown error, forcing stop', error);
      await this.forceStop();
    } finally {
      this.isRunning = false;
      this.isShuttingDown = false;
      this.emit('stopped', { id: this.config.id, timestamp: new Date() });
    }
  }

  /**
   * Get the current health status of the daemon
   */
  getStatus(): DaemonHealth {
    const subsystemStatuses = {
      identity: this.getSubsystemHealth('identity', this.identityManager),
      session: this.getSubsystemHealth('session', this.sessionManager),
      triage: this.getSubsystemHealth('triage', this.triageEngine),
      pty: this.getSubsystemHealth('pty', this.ptyController),
      resource: this.getSubsystemHealth('resource', this.resourceAllocator),
      telemetry: this.getSubsystemHealth('telemetry', this.telemetryCollector),
      intervention: this.getSubsystemHealth(
        'intervention',
        this.interventionEngine
      ),
    };

    const overallStatus = this.calculateOverallStatus(subsystemStatuses);
    const avgLatency =
      this.metrics.totalRequests > 0
        ? this.metrics.totalLatency / this.metrics.totalRequests
        : 0;
    const errorRate =
      this.metrics.totalRequests > 0
        ? this.metrics.errorCount / this.metrics.totalRequests
        : 0;

    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime.getTime(),
      startTime: this.startTime,
      subsystems: subsystemStatuses,
      metrics: {
        activeSessions: this.metrics.activeSessions,
        totalRequests: this.metrics.totalRequests,
        errorRate,
        avgLatency,
      },
    };
  }

  /**
   * Get the daemon configuration
   */
  getConfig(): Readonly<Required<VPDaemonConfig>> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Check if the daemon is currently running
   */
  isActive(): boolean {
    return this.isRunning && !this.isShuttingDown;
  }

  /**
   * Get the VP Identity
   */
  getIdentity(): VPIdentity | null {
    return this.vpIdentity;
  }

  /**
   * Get access to subsystem managers (for advanced use cases)
   */
  getSubsystems() {
    return {
      identity: this.identityManager,
      session: this.sessionManager,
      triage: this.triageEngine,
      pty: this.ptyController,
      resource: this.resourceAllocator,
      telemetry: this.telemetryCollector,
      intervention: this.interventionEngine,
    };
  }

  // Private methods

  private async initializeSubsystems(): Promise<void> {
    this.log('info', 'Initializing subsystems...');

    // Identity Manager - must be first for authentication
    this.log('debug', 'Starting Identity Manager...');
    this.identityManager = new IdentityManager({
      enableLogging: this.config.verbose,
      ...this.config.subsystems.identity,
    });
    this.vpIdentity = await this.identityManager.loadIdentity();
    this.log('info', `VP Identity loaded: ${this.vpIdentity.name}`);

    // Resource Allocator - needed for session resource management
    this.log('debug', 'Starting Resource Allocator...');
    this.resourceAllocator = new ResourceAllocator({
      budget: {
        ...DEFAULT_TOKEN_BUDGET,
        ...this.config.subsystems.resource?.budget,
      },
      ...this.config.subsystems.resource,
    });

    // Session Manager - depends on identity and resources
    this.log('debug', 'Starting Session Manager...');
    this.sessionManager = new SessionSlotManager({
      maxSlots: this.config.maxSessions,
      defaultTimeout: 300000, // 5 minutes
      queueCapacity: 1000,
      preemptionEnabled: true,
      estimatedProcessingTime: 60000, // 1 minute
      ...this.config.subsystems.session,
    });

    // Telemetry Collector - for monitoring
    this.log('debug', 'Starting Telemetry Collector...');
    this.telemetryCollector = new TelemetryCollector({
      backends: [
        {
          type: 'console',
          enabled: this.config.verbose,
          console: { pretty: true, colorize: true },
        },
      ],
      flushInterval: 10000,
      maxBufferSize: 1000,
      serviceName: this.config.name,
      environment: process.env['NODE_ENV'] ?? 'development',
      ...this.config.subsystems.telemetry,
    });
    this.telemetryCollector.start();

    // Triage Engine - for request prioritization
    this.log('debug', 'Starting Triage Engine...');
    this.triageEngine = new TriageEngine({
      memoryBankPath:
        process.env['VP_MEMORY_BANK_PATH'] ?? './.vp-daemon/memory-bank',
      enableRAG: false,
      ...this.config.subsystems.triage,
    });

    // PTY Controller - for terminal session management
    this.log('debug', 'Starting PTY Controller...');
    this.ptyController = new PTYController({
      safetyHeuristics: {
        ...DEFAULT_SAFETY_HEURISTICS,
        ...this.config.subsystems.pty?.safetyHeuristics,
      },
      verbose: this.config.verbose,
      ...this.config.subsystems.pty,
    });

    // Intervention Engine - for automated issue resolution
    this.log('debug', 'Starting Intervention Engine...');
    this.interventionEngine = new InterventionEngine({
      enabled: true,
      autoRollbackOnCritical: false,
      ...this.config.subsystems.intervention,
    });

    this.log('success', 'All subsystems initialized successfully');
  }

  private async performShutdown(): Promise<void> {
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown subsystems in reverse order
    this.log('debug', 'Stopping Intervention Engine...');
    this.interventionEngine = null;

    this.log('debug', 'Stopping PTY Controller...');
    if (this.ptyController) {
      await this.ptyController.killSession();
    }
    this.ptyController = null;

    this.log('debug', 'Stopping Triage Engine...');
    this.triageEngine = null;

    this.log('debug', 'Stopping Telemetry Collector...');
    if (this.telemetryCollector) {
      await this.telemetryCollector.stop();
    }
    this.telemetryCollector = null;

    this.log('debug', 'Stopping Session Manager...');
    this.sessionManager = null;

    this.log('debug', 'Stopping Resource Allocator...');
    this.resourceAllocator = null;

    this.log('debug', 'Stopping Identity Manager...');
    this.identityManager = null;

    await this.cleanup();
  }

  private async forceStop(): Promise<void> {
    this.log('warn', 'Forcing immediate stop...');

    // Forcefully terminate PTY sessions
    if (this.ptyController) {
      try {
        await this.ptyController.killSession();
      } catch {
        // Ignore errors during force stop
      }
    }

    // Clear all references
    this.identityManager = null;
    this.sessionManager = null;
    this.triageEngine = null;
    this.ptyController = null;
    this.resourceAllocator = null;
    this.telemetryCollector = null;
    this.interventionEngine = null;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.log('debug', 'Cleanup completed');
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const status = this.getStatus();
      this.emit('healthCheck', status);

      if (status.status === 'unhealthy') {
        this.log('warn', 'Daemon health check failed - status: unhealthy');
      }
    }, this.config.heartbeatInterval);
  }

  private setupSignalHandlers(): void {
    const handleSignal = async (signal: string): Promise<void> => {
      this.log('info', `Received ${signal} signal`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => {
      handleSignal('SIGINT').catch(error => {
        this.log('error', 'Error handling SIGINT', error);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      handleSignal('SIGTERM').catch(error => {
        this.log('error', 'Error handling SIGTERM', error);
        process.exit(1);
      });
    });

    process.on('uncaughtException', error => {
      this.log('error', 'Uncaught exception', error);
      this.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', reason => {
      this.log('error', 'Unhandled rejection', reason);
    });
  }

  private getSubsystemHealth(name: string, instance: unknown): SubsystemHealth {
    if (!instance) {
      return {
        name,
        status: 'stopped',
        lastHealthCheck: new Date(),
        errorCount: 0,
      };
    }

    try {
      // Different subsystems have different health check methods
      // Use duck typing to check for available methods
      const subsystem = instance as Record<string, unknown>;

      // Try to get metrics from telemetry collector
      if (typeof subsystem['getMetrics'] === 'function') {
        const metrics = (
          subsystem['getMetrics'] as () => { totalFailed?: number }
        )();
        const errorCount = metrics?.totalFailed ?? 0;
        return {
          name,
          status: errorCount > 10 ? 'error' : 'running',
          lastHealthCheck: new Date(),
          errorCount,
        };
      }

      // Try to get slot status from session manager
      if (typeof subsystem['getSlotStatus'] === 'function') {
        (subsystem['getSlotStatus'] as () => unknown)();
        return {
          name,
          status: 'running',
          lastHealthCheck: new Date(),
          errorCount: 0,
        };
      }

      // Subsystem exists but has no metrics - assume running
      return {
        name,
        status: 'running',
        lastHealthCheck: new Date(),
        errorCount: 0,
      };
    } catch {
      return {
        name,
        status: 'error',
        lastHealthCheck: new Date(),
        errorCount: 1,
      };
    }
  }

  private calculateOverallStatus(
    subsystems: Record<string, SubsystemHealth>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(subsystems);
    const errorCount = statuses.filter(s => s.status === 'error').length;
    const stoppedCount = statuses.filter(s => s.status === 'stopped').length;

    if (errorCount >= 3 || stoppedCount >= 4) {
      return 'unhealthy';
    }
    if (errorCount > 0 || stoppedCount > 0) {
      return 'degraded';
    }
    return 'healthy';
  }

  private generateId(): string {
    return `vp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error' | 'success',
    message: string,
    error?: unknown
  ): void {
    if (level === 'debug' && !this.config.verbose) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.config.name}]`;

    const colorFn = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green,
    }[level];

    const levelStr = colorFn(`[${level.toUpperCase()}]`);
    const formattedMessage = `${prefix} ${levelStr} ${message}`;

    if (level === 'error') {
      console.error(formattedMessage);
      if (error) {
        console.error(
          chalk.red(error instanceof Error ? error.stack : String(error))
        );
      }
    } else {
      console.log(formattedMessage);
    }

    this.emit('log', { level, message, error, timestamp });
  }
}

/**
 * Factory function to create a VP Daemon instance
 */
export function createVPDaemon(config?: VPDaemonConfig): VPDaemon {
  return new VPDaemon(config);
}

interface CLIOptions {
  port: number;
  host: string;
  name: string;
  maxSessions: number;
  heartbeat: number;
  shutdownTimeout: number;
  verbose: boolean;
  config?: string;
}

/**
 * CLI entry point for running the daemon standalone
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('vp-daemon')
    .description('VP Daemon - Virtual Principal orchestration daemon')
    .version('1.0.0');

  program
    .command('start', { isDefault: true })
    .description('Start the VP Daemon')
    .option('-p, --port <number>', 'Port to listen on', '8787')
    .option('-H, --host <string>', 'Host address to bind to', '127.0.0.1')
    .option('-n, --name <string>', 'Daemon instance name', 'vp-daemon')
    .option('-m, --max-sessions <number>', 'Maximum concurrent sessions', '100')
    .option(
      '--heartbeat <number>',
      'Heartbeat interval in milliseconds',
      '30000'
    )
    .option(
      '--shutdown-timeout <number>',
      'Graceful shutdown timeout in milliseconds',
      '10000'
    )
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const cliOptions: CLIOptions = {
        port: parseInt(options['port'] as string, 10),
        host: options['host'] as string,
        name: options['name'] as string,
        maxSessions: parseInt(options['maxSessions'] as string, 10),
        heartbeat: parseInt(options['heartbeat'] as string, 10),
        shutdownTimeout: parseInt(options['shutdownTimeout'] as string, 10),
        verbose: options['verbose'] as boolean,
        config: options['config'] as string | undefined,
      };
      await runDaemon(cliOptions);
    });

  program
    .command('status')
    .description('Check daemon status')
    .action(() => {
      console.log(
        chalk.blue('Status check not implemented for standalone mode')
      );
      console.log(chalk.gray('Use the daemon API for runtime status checks'));
    });

  program
    .command('stop')
    .description('Stop the daemon')
    .action(() => {
      console.log(chalk.blue('Send SIGTERM to the daemon process to stop it'));
    });

  await program.parseAsync(process.argv);
}

async function runDaemon(options: CLIOptions): Promise<void> {
  console.log(chalk.cyan('================================================'));
  console.log(chalk.cyan('           VP Daemon - Virtual Principal'));
  console.log(chalk.cyan('================================================'));
  console.log();

  const config: VPDaemonConfig = {
    name: options.name,
    port: options.port,
    host: options.host,
    maxSessions: options.maxSessions,
    heartbeatInterval: options.heartbeat,
    shutdownTimeout: options.shutdownTimeout,
    verbose: options.verbose,
  };

  // Load config file if specified
  if (options.config) {
    try {
      const { readFileSync } = await import('fs');
      const fileConfig = JSON.parse(
        readFileSync(options.config, 'utf-8')
      ) as VPDaemonConfig;
      Object.assign(config, fileConfig);
      console.log(chalk.green(`Loaded configuration from ${options.config}`));
    } catch (error) {
      console.error(chalk.red(`Failed to load config file: ${error}`));
      process.exit(1);
    }
  }

  const daemon = createVPDaemon(config);

  // Set up event listeners
  daemon.on('started', data => {
    console.log(chalk.green(`Daemon started: ${JSON.stringify(data)}`));
  });

  daemon.on('stopped', data => {
    console.log(chalk.yellow(`Daemon stopped: ${JSON.stringify(data)}`));
  });

  daemon.on('healthCheck', (status: DaemonHealth) => {
    if (config.verbose) {
      console.log(chalk.gray(`Health check: ${status.status}`));
    }
  });

  try {
    await daemon.start();

    // Keep the process running
    await new Promise<void>(resolve => {
      daemon.on('stopped', resolve);
    });
  } catch (error) {
    console.error(chalk.red('Failed to start daemon:'), error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

// Re-export subsystem types for external consumption
export type { VPIdentity, IdentityManagerConfig } from './identity-manager.js';
export type { SessionSlotManagerConfig } from './session-manager.js';
export type { TriageEngineConfig } from './triage-engine.js';
export type { PTYControllerConfig } from './pty-controller.js';
export type { ResourceAllocatorConfig } from './resource-allocator.js';
export type { ObservabilityConfig } from './telemetry-collector.js';
export type { InterventionConfig } from './intervention-engine.js';
