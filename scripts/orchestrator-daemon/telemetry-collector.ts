#!/usr/bin/env tsx

/**
 * TelemetryCollector - Decision logging to observability system
 *
 * Collects and batches decision telemetry data, supporting multiple
 * backends: console, file, and HTTP endpoint.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for policy checks performed during decision making
 */
export interface PolicyCheck {
  policyId: string;
  policyName: string;
  passed: boolean;
  details?: string;
  timestamp: number;
}

/**
 * Configuration for escalation triggers
 */
export interface EscalationTrigger {
  triggerId: string;
  triggerType: 'threshold' | 'policy_violation' | 'anomaly' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  escalatedTo?: string;
  timestamp: number;
}

/**
 * Reward scores for reinforcement learning feedback
 */
export interface RewardScores {
  predicted: number;
  actual?: number;
  confidence: number;
  factors?: Record<string, number>;
}

/**
 * Core telemetry data structure for decision logging
 */
export interface DecisionTelemetry {
  timestamp: number;
  sessionId: string;
  agentId: string;
  action: string;
  rationale: string;
  rewardScores: RewardScores;
  policyChecks: PolicyCheck[];
  escalationTriggers: EscalationTrigger[];
  metadata?: Record<string, unknown>;
}

/**
 * Supported backend types for telemetry output
 */
export type BackendType = 'console' | 'file' | 'http';

/**
 * Configuration for HTTP backend
 */
export interface HttpBackendConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Configuration for file backend
 */
export interface FileBackendConfig {
  directory: string;
  filePrefix?: string;
  rotationSize?: number; // bytes
  maxFiles?: number;
}

/**
 * Configuration for console backend
 */
export interface ConsoleBackendConfig {
  pretty?: boolean;
  colorize?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Backend configuration union
 */
export interface BackendConfig {
  type: BackendType;
  enabled: boolean;
  console?: ConsoleBackendConfig;
  file?: FileBackendConfig;
  http?: HttpBackendConfig;
}

/**
 * Main observability configuration
 */
export interface ObservabilityConfig {
  backends: BackendConfig[];
  flushInterval?: number; // milliseconds
  maxBufferSize?: number;
  enableMetrics?: boolean;
  serviceName?: string;
  environment?: string;
}

/**
 * Telemetry metrics for monitoring collector health
 */
export interface TelemetryMetrics {
  totalLogged: number;
  totalFlushed: number;
  totalFailed: number;
  bufferSize: number;
  lastFlushTime: number | null;
  lastFlushDuration: number | null;
  averageFlushDuration: number;
  flushCount: number;
  backendStatuses: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

/**
 * Result of a flush operation
 */
interface FlushResult {
  success: boolean;
  backend: BackendType;
  itemsFlushed: number;
  error?: Error;
  duration: number;
}

// ============================================================================
// TelemetryCollector Implementation
// ============================================================================

/**
 * TelemetryCollector class for decision logging to observability systems.
 *
 * Buffers telemetry data and periodically flushes to configured backends.
 * Supports console, file, and HTTP backends with configurable flush intervals.
 */
export class TelemetryCollector {
  private buffer: DecisionTelemetry[] = [];
  private flushInterval: number;
  private timer: NodeJS.Timeout | null = null;
  private config: ObservabilityConfig;
  private isRunning: boolean = false;
  private isFlushing: boolean = false;

  // Metrics tracking
  private metrics: TelemetryMetrics = {
    totalLogged: 0,
    totalFlushed: 0,
    totalFailed: 0,
    bufferSize: 0,
    lastFlushTime: null,
    lastFlushDuration: null,
    averageFlushDuration: 0,
    flushCount: 0,
    backendStatuses: {},
  };

  /**
   * Creates a new TelemetryCollector instance
   *
   * @param config - Observability configuration
   */
  constructor(config: ObservabilityConfig) {
    this.config = config;
    this.flushInterval = config.flushInterval ?? 60000; // Default 60 seconds

    // Initialize backend statuses
    for (const backend of config.backends) {
      if (backend.enabled) {
        this.metrics.backendStatuses[backend.type] = 'healthy';
      }
    }
  }

  /**
   * Logs a decision telemetry entry to the buffer
   *
   * @param telemetry - The decision telemetry data to log
   */
  log(telemetry: DecisionTelemetry): void {
    // Validate required fields
    if (!telemetry.timestamp) {
      telemetry.timestamp = Date.now();
    }

    this.buffer.push(telemetry);
    this.metrics.totalLogged++;
    this.metrics.bufferSize = this.buffer.length;

    // Check if buffer exceeds max size and flush if needed
    const maxSize = this.config.maxBufferSize ?? 1000;
    if (this.buffer.length >= maxSize) {
      this.flush().catch(error => {
        console.error(
          '[TelemetryCollector] Buffer overflow flush failed:',
          error
        );
      });
    }
  }

  /**
   * Flushes the buffer to all configured backends
   */
  private async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    // Take current buffer and reset
    const batch = [...this.buffer];
    this.buffer = [];
    this.metrics.bufferSize = 0;

    try {
      await this.sendToBackend(batch);
      this.metrics.totalFlushed += batch.length;
    } catch (error) {
      // On failure, restore items to buffer (with size limit)
      const maxSize = this.config.maxBufferSize ?? 1000;
      const itemsToRestore = batch.slice(0, maxSize - this.buffer.length);
      this.buffer = [...itemsToRestore, ...this.buffer];
      this.metrics.bufferSize = this.buffer.length;
      this.metrics.totalFailed += batch.length - itemsToRestore.length;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.lastFlushTime = Date.now();
      this.metrics.lastFlushDuration = duration;
      this.metrics.flushCount++;

      // Update average flush duration
      this.metrics.averageFlushDuration =
        (this.metrics.averageFlushDuration * (this.metrics.flushCount - 1) +
          duration) /
        this.metrics.flushCount;

      this.isFlushing = false;
    }
  }

  /**
   * Sends a batch of telemetry to all enabled backends
   *
   * @param batch - Array of telemetry entries to send
   */
  private async sendToBackend(batch: DecisionTelemetry[]): Promise<void> {
    const enabledBackends = this.config.backends.filter(b => b.enabled);

    if (enabledBackends.length === 0) {
      console.warn('[TelemetryCollector] No backends enabled');
      return;
    }

    const results: FlushResult[] = await Promise.all(
      enabledBackends.map(async backend => {
        const startTime = Date.now();
        try {
          switch (backend.type) {
            case 'console':
              await this.sendToConsole(batch, backend.console);
              break;
            case 'file':
              await this.sendToFile(batch, backend.file);
              break;
            case 'http':
              await this.sendToHttp(batch, backend.http);
              break;
          }
          this.metrics.backendStatuses[backend.type] = 'healthy';
          return {
            success: true,
            backend: backend.type,
            itemsFlushed: batch.length,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          this.metrics.backendStatuses[backend.type] = 'unhealthy';
          return {
            success: false,
            backend: backend.type,
            itemsFlushed: 0,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - startTime,
          };
        }
      })
    );

    // Check if all backends failed
    const failures = results.filter(r => !r.success);
    if (failures.length === results.length) {
      const errorMessages = failures
        .map(f => `${f.backend}: ${f.error?.message}`)
        .join('; ');
      throw new Error(`All backends failed: ${errorMessages}`);
    }

    // Log partial failures
    if (failures.length > 0) {
      for (const failure of failures) {
        console.warn(
          `[TelemetryCollector] Backend '${failure.backend}' failed:`,
          failure.error?.message
        );
      }
    }
  }

  /**
   * Sends telemetry to console backend
   */
  private async sendToConsole(
    batch: DecisionTelemetry[],
    config?: ConsoleBackendConfig
  ): Promise<void> {
    const pretty = config?.pretty ?? true;

    for (const entry of batch) {
      const output = this.formatTelemetryForConsole(
        entry,
        pretty,
        config?.colorize ?? false
      );

      switch (config?.level ?? 'info') {
        case 'debug':
          console.debug(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        case 'error':
          console.error(output);
          break;
        default:
          console.log(output);
      }
    }
  }

  /**
   * Formats telemetry entry for console output
   */
  private formatTelemetryForConsole(
    entry: DecisionTelemetry,
    pretty: boolean,
    colorize: boolean
  ): string {
    if (!pretty) {
      return JSON.stringify(entry);
    }

    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = colorize ? '\x1b[36m[TELEMETRY]\x1b[0m' : '[TELEMETRY]';

    const lines = [
      `${prefix} ${timestamp}`,
      `  Session: ${entry.sessionId} | Agent: ${entry.agentId}`,
      `  Action: ${entry.action}`,
      `  Rationale: ${entry.rationale}`,
      `  Reward: predicted=${entry.rewardScores.predicted.toFixed(3)}, ` +
        `actual=${entry.rewardScores.actual?.toFixed(3) ?? 'N/A'}, ` +
        `confidence=${entry.rewardScores.confidence.toFixed(3)}`,
    ];

    if (entry.policyChecks.length > 0) {
      lines.push(`  Policy Checks (${entry.policyChecks.length}):`);
      for (const check of entry.policyChecks) {
        const status = check.passed
          ? colorize
            ? '\x1b[32mPASS\x1b[0m'
            : 'PASS'
          : colorize
            ? '\x1b[31mFAIL\x1b[0m'
            : 'FAIL';
        lines.push(`    - ${check.policyName}: ${status}`);
      }
    }

    if (entry.escalationTriggers.length > 0) {
      lines.push(`  Escalations (${entry.escalationTriggers.length}):`);
      for (const trigger of entry.escalationTriggers) {
        const severity = colorize
          ? this.colorSeverity(trigger.severity)
          : trigger.severity;
        lines.push(`    - [${severity}] ${trigger.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Colorizes severity level for console output
   */
  private colorSeverity(severity: string): string {
    const colors: Record<string, string> = {
      low: '\x1b[32m',
      medium: '\x1b[33m',
      high: '\x1b[91m',
      critical: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    return `${colors[severity] ?? ''}${severity.toUpperCase()}${reset}`;
  }

  /**
   * Sends telemetry to file backend
   */
  private async sendToFile(
    batch: DecisionTelemetry[],
    config?: FileBackendConfig
  ): Promise<void> {
    const directory = config?.directory ?? './telemetry';
    const prefix = config?.filePrefix ?? 'telemetry';

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Generate filename with timestamp
    const date = new Date().toISOString().split('T')[0];
    const filename = `${prefix}-${date}.jsonl`;
    const filepath = path.join(directory, filename);

    // Write as JSONL (one JSON object per line)
    const lines = batch.map(entry => JSON.stringify(entry)).join('\n') + '\n';

    await fs.appendFile(filepath, lines, 'utf-8');

    // Handle rotation if configured
    if (config?.rotationSize) {
      await this.handleFileRotation(filepath, config);
    }
  }

  /**
   * Handles file rotation based on size
   */
  private async handleFileRotation(
    filepath: string,
    config: FileBackendConfig
  ): Promise<void> {
    try {
      const stats = await fs.stat(filepath);

      if (stats.size >= (config.rotationSize ?? Infinity)) {
        const timestamp = Date.now();
        const rotatedPath = filepath.replace('.jsonl', `-${timestamp}.jsonl`);
        await fs.rename(filepath, rotatedPath);

        // Clean up old files if maxFiles is set
        if (config.maxFiles) {
          await this.cleanupOldFiles(path.dirname(filepath), config);
        }
      }
    } catch {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Cleans up old rotated files
   */
  private async cleanupOldFiles(
    directory: string,
    config: FileBackendConfig
  ): Promise<void> {
    const prefix = config.filePrefix ?? 'telemetry';
    const files = await fs.readdir(directory);

    const telemetryFiles = files
      .filter(f => f.startsWith(prefix) && f.endsWith('.jsonl'))
      .sort()
      .reverse();

    // Remove files beyond maxFiles limit
    const filesToDelete = telemetryFiles.slice(config.maxFiles ?? 10);
    for (const file of filesToDelete) {
      await fs.unlink(path.join(directory, file));
    }
  }

  /**
   * Sends telemetry to HTTP backend
   */
  private async sendToHttp(
    batch: DecisionTelemetry[],
    config?: HttpBackendConfig
  ): Promise<void> {
    if (!config?.url) {
      throw new Error('HTTP backend URL is required');
    }

    const payload = {
      serviceName: this.config.serviceName ?? 'orchestrator-daemon',
      environment: this.config.environment ?? 'development',
      timestamp: Date.now(),
      batch,
    };

    const retries = config.retries ?? 3;
    const retryDelay = config.retryDelay ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          config.timeout ?? 30000
        );

        const response = await fetch(config.url, {
          method: config.method ?? 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries - 1) {
          await this.sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError ?? new Error('HTTP request failed after retries');
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Starts the telemetry collector with periodic flushing
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[TelemetryCollector] Already running');
      return;
    }

    this.isRunning = true;
    this.timer = setInterval(() => {
      this.flush().catch(error => {
        console.error('[TelemetryCollector] Periodic flush failed:', error);
      });
    }, this.flushInterval);

    // Ensure timer doesn't prevent process exit
    if (this.timer.unref) {
      this.timer.unref();
    }

    console.log(
      `[TelemetryCollector] Started with ${this.flushInterval}ms flush interval`
    );
  }

  /**
   * Stops the telemetry collector, flushing remaining data
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Final flush
    if (this.buffer.length > 0) {
      console.log(
        `[TelemetryCollector] Stopping, flushing ${this.buffer.length} remaining entries...`
      );
      await this.flush();
    }

    console.log('[TelemetryCollector] Stopped');
  }

  /**
   * Returns the current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Returns current telemetry metrics
   */
  getMetrics(): TelemetryMetrics {
    return {
      ...this.metrics,
      bufferSize: this.buffer.length,
    };
  }

  /**
   * Forces an immediate flush (useful for testing or shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Clears the buffer without flushing
   */
  clearBuffer(): void {
    const droppedCount = this.buffer.length;
    this.buffer = [];
    this.metrics.bufferSize = 0;
    this.metrics.totalFailed += droppedCount;
  }

  /**
   * Checks if the collector is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Updates configuration at runtime
   */
  updateConfig(partialConfig: Partial<ObservabilityConfig>): void {
    this.config = { ...this.config, ...partialConfig };

    if (partialConfig.flushInterval !== undefined) {
      this.flushInterval = partialConfig.flushInterval;

      // Restart timer with new interval if running
      if (this.isRunning && this.timer) {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
          this.flush().catch(error => {
            console.error('[TelemetryCollector] Periodic flush failed:', error);
          });
        }, this.flushInterval);

        if (this.timer.unref) {
          this.timer.unref();
        }
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a TelemetryCollector with default configuration
 */
export function createTelemetryCollector(
  overrides?: Partial<ObservabilityConfig>
): TelemetryCollector {
  const defaultConfig: ObservabilityConfig = {
    backends: [
      {
        type: 'console',
        enabled: true,
        console: {
          pretty: true,
          colorize: true,
          level: 'info',
        },
      },
    ],
    flushInterval: 60000,
    maxBufferSize: 1000,
    enableMetrics: true,
    serviceName: 'orchestrator-daemon',
    environment: process.env.NODE_ENV ?? 'development',
  };

  const config: ObservabilityConfig = {
    ...defaultConfig,
    ...overrides,
    backends: overrides?.backends ?? defaultConfig.backends,
  };

  return new TelemetryCollector(config);
}

// ============================================================================
// Exports
// ============================================================================

export { TelemetryCollector as default };
