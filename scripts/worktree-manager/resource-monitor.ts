/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Resource Monitor for Worktree Scaling
 *
 * Monitors system resources to enable safe scaling of git worktrees.
 * Supports up to 200 worktrees per machine with proper resource management.
 *
 * Key responsibilities:
 * - Monitor file descriptor usage
 * - Track available disk space
 * - Count active worktrees
 * - Configure system limits
 * - Provide health reporting
 */

import { exec } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Resource limits configuration for worktree scaling
 */
export interface ResourceLimits {
  /** Maximum number of file descriptors (ulimit -n), default: 65000 */
  fileDescriptors: number;
  /** Minimum required free disk space in GB, default: 10 */
  diskSpaceMinGB: number;
  /** Maximum number of worktrees per machine, default: 200 */
  maxWorktreesPerMachine: number;
}

/**
 * Current resource usage status
 */
export interface ResourceStatus {
  /** Current file descriptor usage */
  fileDescriptors: {
    current: number;
    limit: number;
    usagePercent: number;
  };
  /** Disk space information */
  diskSpace: {
    freeGB: number;
    totalGB: number;
    usagePercent: number;
  };
  /** Worktree count information */
  worktrees: {
    count: number;
    limit: number;
    usagePercent: number;
  };
  /** Overall status */
  healthy: boolean;
  /** Timestamp of the status check */
  timestamp: Date;
}

/**
 * Health check report with detailed diagnostics
 */
export interface HealthReport {
  /** Overall health status */
  status: 'healthy' | 'warning' | 'critical';
  /** Individual check results */
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    value?: number;
    threshold?: number;
  }[];
  /** Recommendations for improving health */
  recommendations: string[];
  /** Timestamp of the health check */
  timestamp: Date;
}

/**
 * Resource metrics for monitoring
 */
export interface ResourceMetrics {
  /** File descriptor metrics */
  fileDescriptorUsage: number;
  fileDescriptorLimit: number;
  fileDescriptorPercent: number;
  /** Disk space metrics (GB) */
  diskSpaceFreeGB: number;
  diskSpaceTotalGB: number;
  diskSpaceUsedPercent: number;
  /** Worktree metrics */
  worktreeCount: number;
  worktreeLimit: number;
  worktreePercent: number;
  /** Memory metrics */
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  /** CPU load average */
  cpuLoadAverage: number;
  /** Platform info */
  platform: NodeJS.Platform;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Result of canCreateWorktree check
 */
export interface WorktreeCreationCheck {
  /** Whether worktree creation is allowed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Detailed checks that were performed */
  checks: {
    fileDescriptors: boolean;
    diskSpace: boolean;
    worktreeCount: boolean;
  };
}

/**
 * Configuration options for ResourceMonitor
 */
export interface ResourceMonitorConfig {
  /** Resource limits */
  limits: Partial<ResourceLimits>;
  /** Git repository root path */
  gitRoot?: string;
  /** Warning threshold percentage (0-100) */
  warningThreshold?: number;
  /** Critical threshold percentage (0-100) */
  criticalThreshold?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_LIMITS: ResourceLimits = {
  fileDescriptors: 65000,
  diskSpaceMinGB: 10,
  maxWorktreesPerMachine: 200,
};

const DEFAULT_WARNING_THRESHOLD = 80; // 80%
const DEFAULT_CRITICAL_THRESHOLD = 90; // 90%

// ============================================================================
// ResourceMonitor Class
// ============================================================================

/**
 * ResourceMonitor - System resource monitoring for worktree scaling
 *
 * Provides comprehensive monitoring of system resources to ensure
 * safe scaling of git worktrees up to 200 per machine.
 *
 * @example
 * ```typescript
 * const monitor = new ResourceMonitor({
 *   fileDescriptors: 65000,
 *   diskSpaceMinGB: 10,
 *   maxWorktreesPerMachine: 200
 * });
 *
 * const canCreate = await monitor.canCreateWorktree();
 * if (canCreate.allowed) {
 *   // Safe to create worktree
 * }
 * ```
 */
export class ResourceMonitor extends EventEmitter {
  private limits: ResourceLimits;
  private gitRoot: string;
  private warningThreshold: number;
  private criticalThreshold: number;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: ResourceMetrics | null = null;

  constructor(limits: Partial<ResourceLimits> = {}) {
    super();
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.gitRoot = process.cwd();
    this.warningThreshold = DEFAULT_WARNING_THRESHOLD;
    this.criticalThreshold = DEFAULT_CRITICAL_THRESHOLD;
  }

  /**
   * Create a ResourceMonitor with full configuration
   */
  static fromConfig(config: ResourceMonitorConfig): ResourceMonitor {
    const monitor = new ResourceMonitor(config.limits);
    if (config.gitRoot) {
      monitor.gitRoot = config.gitRoot;
    }
    if (config.warningThreshold !== undefined) {
      monitor.warningThreshold = config.warningThreshold;
    }
    if (config.criticalThreshold !== undefined) {
      monitor.criticalThreshold = config.criticalThreshold;
    }
    return monitor;
  }

  // ==========================================================================
  // Public Methods - Core API
  // ==========================================================================

  /**
   * Check if resources allow creating a new worktree
   *
   * Performs comprehensive resource checks:
   * - File descriptor usage (< 90% of limit)
   * - Available disk space (>= minimum required)
   * - Current worktree count (< maximum allowed)
   *
   * @returns Promise resolving to creation check result
   */
  async canCreateWorktree(): Promise<WorktreeCreationCheck> {
    const checks = {
      fileDescriptors: true,
      diskSpace: true,
      worktreeCount: true,
    };

    // Check file descriptors
    const fdUsage = await this.getFileDescriptorUsage();
    const fdThreshold = this.limits.fileDescriptors * 0.9;
    if (fdUsage > fdThreshold) {
      checks.fileDescriptors = false;
      return {
        allowed: false,
        reason: `File descriptor limit near exhaustion (${fdUsage}/${this.limits.fileDescriptors}, ${((fdUsage / this.limits.fileDescriptors) * 100).toFixed(1)}% used)`,
        checks,
      };
    }

    // Check disk space
    const diskFreeGB = await this.getDiskSpaceFreeGB();
    if (diskFreeGB < this.limits.diskSpaceMinGB) {
      checks.diskSpace = false;
      return {
        allowed: false,
        reason: `Disk space below ${this.limits.diskSpaceMinGB}GB buffer (${diskFreeGB.toFixed(2)}GB free)`,
        checks,
      };
    }

    // Check worktree count
    const worktreeCount = await this.getWorktreeCount();
    if (worktreeCount >= this.limits.maxWorktreesPerMachine) {
      checks.worktreeCount = false;
      return {
        allowed: false,
        reason: `Maximum worktrees reached (${worktreeCount}/${this.limits.maxWorktreesPerMachine})`,
        checks,
      };
    }

    return { allowed: true, checks };
  }

  /**
   * Configure system limits for worktree scaling
   *
   * Note: This may require elevated privileges on some systems.
   * On macOS/Linux, adjusts ulimit settings.
   */
  async configureSystemLimits(): Promise<void> {
    const platform = os.platform();

    if (platform === 'darwin' || platform === 'linux') {
      try {
        // Get current soft limit
        const { stdout: currentLimit } = await execAsync('ulimit -n');
        const current = parseInt(currentLimit.trim(), 10);

        if (current < this.limits.fileDescriptors) {
          // Note: ulimit -n only affects the current shell session
          // For persistent changes, users need to modify system configuration
          console.log(
            `[ResourceMonitor] Current file descriptor limit: ${current}`
          );
          console.log(
            `[ResourceMonitor] Recommended limit: ${this.limits.fileDescriptors}`
          );
          console.log(
            '[ResourceMonitor] To set permanently, add to shell profile:'
          );
          console.log(`  ulimit -n ${this.limits.fileDescriptors}`);

          if (platform === 'darwin') {
            console.log('\n[ResourceMonitor] For macOS, you may also need:');
            console.log(
              `  sudo launchctl limit maxfiles ${this.limits.fileDescriptors} unlimited`
            );
          } else if (platform === 'linux') {
            console.log(
              '\n[ResourceMonitor] For Linux, add to /etc/security/limits.conf:'
            );
            console.log(`  * soft nofile ${this.limits.fileDescriptors}`);
            console.log(`  * hard nofile ${this.limits.fileDescriptors}`);
          }
        } else {
          console.log(
            `[ResourceMonitor] File descriptor limit already sufficient: ${current}`
          );
        }
      } catch (error) {
        console.error(
          '[ResourceMonitor] Failed to check/configure system limits:',
          error
        );
        throw error;
      }
    } else {
      console.log(
        `[ResourceMonitor] System limit configuration not supported on platform: ${platform}`
      );
    }
  }

  /**
   * Get current resource status snapshot
   */
  async getResourceStatus(): Promise<ResourceStatus> {
    const [fdUsage, diskFreeGB, worktreeCount, diskInfo] = await Promise.all([
      this.getFileDescriptorUsage(),
      this.getDiskSpaceFreeGB(),
      this.getWorktreeCount(),
      this.getDiskInfo(),
    ]);

    const fdPercent = (fdUsage / this.limits.fileDescriptors) * 100;
    const diskPercent = diskInfo.usedPercent;
    const worktreePercent =
      (worktreeCount / this.limits.maxWorktreesPerMachine) * 100;

    const healthy =
      fdPercent < this.criticalThreshold &&
      diskFreeGB >= this.limits.diskSpaceMinGB &&
      worktreeCount < this.limits.maxWorktreesPerMachine;

    return {
      fileDescriptors: {
        current: fdUsage,
        limit: this.limits.fileDescriptors,
        usagePercent: fdPercent,
      },
      diskSpace: {
        freeGB: diskFreeGB,
        totalGB: diskInfo.totalGB,
        usagePercent: diskPercent,
      },
      worktrees: {
        count: worktreeCount,
        limit: this.limits.maxWorktreesPerMachine,
        usagePercent: worktreePercent,
      },
      healthy,
      timestamp: new Date(),
    };
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthReport> {
    const status = await this.getResourceStatus();
    const checks: HealthReport['checks'] = [];
    const recommendations: string[] = [];
    let overallStatus: HealthReport['status'] = 'healthy';

    // File descriptor check
    const fdCheck = this.evaluateMetric(
      status.fileDescriptors.usagePercent,
      'File Descriptors',
      status.fileDescriptors.current,
      this.limits.fileDescriptors
    );
    checks.push(fdCheck);
    if (fdCheck.status === 'fail') {
      overallStatus = 'critical';
      recommendations.push(
        `Increase file descriptor limit with: ulimit -n ${this.limits.fileDescriptors}`
      );
    } else if (fdCheck.status === 'warn') {
      overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      recommendations.push(
        'Consider closing unused file handles or increasing ulimit'
      );
    }

    // Disk space check
    const diskCheck = this.evaluateDiskSpace(
      status.diskSpace.freeGB,
      this.limits.diskSpaceMinGB
    );
    checks.push(diskCheck);
    if (diskCheck.status === 'fail') {
      overallStatus = 'critical';
      recommendations.push(
        `Free up disk space. Minimum required: ${this.limits.diskSpaceMinGB}GB`
      );
    } else if (diskCheck.status === 'warn') {
      overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      recommendations.push('Disk space running low. Consider cleanup.');
    }

    // Worktree count check
    const worktreeCheck = this.evaluateMetric(
      status.worktrees.usagePercent,
      'Worktree Count',
      status.worktrees.count,
      this.limits.maxWorktreesPerMachine
    );
    checks.push(worktreeCheck);
    if (worktreeCheck.status === 'fail') {
      overallStatus = 'critical';
      recommendations.push(
        'Maximum worktree limit reached. Clean up unused worktrees.'
      );
    } else if (worktreeCheck.status === 'warn') {
      overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      recommendations.push('Approaching worktree limit. Consider cleanup.');
    }

    // Memory check
    const memInfo = this.getMemoryInfo();
    const memCheck = this.evaluateMetric(
      memInfo.usedPercent,
      'Memory Usage',
      Math.round(memInfo.usedMB),
      Math.round(memInfo.totalMB)
    );
    checks.push(memCheck);
    if (memCheck.status === 'warn' || memCheck.status === 'fail') {
      overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      recommendations.push(
        'High memory usage detected. Consider reducing concurrent operations.'
      );
    }

    return {
      status: overallStatus,
      checks,
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Get detailed resource metrics
   */
  async getMetrics(): Promise<ResourceMetrics> {
    const [fdUsage, fdLimit, diskInfo, worktreeCount] = await Promise.all([
      this.getFileDescriptorUsage(),
      this.getFileDescriptorLimit(),
      this.getDiskInfo(),
      this.getWorktreeCount(),
    ]);

    const memInfo = this.getMemoryInfo();
    const loadAvg = os.loadavg()[0]; // 1-minute load average

    const metrics: ResourceMetrics = {
      fileDescriptorUsage: fdUsage,
      fileDescriptorLimit: fdLimit,
      fileDescriptorPercent: (fdUsage / fdLimit) * 100,
      diskSpaceFreeGB: diskInfo.freeGB,
      diskSpaceTotalGB: diskInfo.totalGB,
      diskSpaceUsedPercent: diskInfo.usedPercent,
      worktreeCount,
      worktreeLimit: this.limits.maxWorktreesPerMachine,
      worktreePercent:
        (worktreeCount / this.limits.maxWorktreesPerMachine) * 100,
      memoryUsedMB: memInfo.usedMB,
      memoryTotalMB: memInfo.totalMB,
      memoryPercent: memInfo.usedPercent,
      cpuLoadAverage: loadAvg,
      platform: os.platform(),
      timestamp: new Date(),
    };

    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * Start continuous monitoring
   *
   * @param intervalMs Monitoring interval in milliseconds (default: 30000)
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      console.log('[ResourceMonitor] Monitoring already active');
      return;
    }

    console.log(
      `[ResourceMonitor] Starting monitoring with ${intervalMs}ms interval`
    );

    const runCheck = async () => {
      try {
        const metrics = await this.getMetrics();
        const health = await this.checkHealth();

        this.emit('metrics', metrics);
        this.emit('health', health);

        if (health.status === 'critical') {
          this.emit('critical', health);
        } else if (health.status === 'warning') {
          this.emit('warning', health);
        }
      } catch (error) {
        this.emit('error', error);
      }
    };

    // Run immediately
    runCheck();

    // Then run on interval
    this.monitoringInterval = setInterval(runCheck, intervalMs);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[ResourceMonitor] Monitoring stopped');
    }
  }

  /**
   * Get last cached metrics (from monitoring)
   */
  getLastMetrics(): ResourceMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Set git repository root path
   */
  setGitRoot(gitRoot: string): void {
    this.gitRoot = gitRoot;
  }

  /**
   * Get current limits configuration
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }

  /**
   * Update limits configuration
   */
  updateLimits(limits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  // ==========================================================================
  // Private Helper Methods - Platform-Specific Implementations
  // ==========================================================================

  /**
   * Get current file descriptor usage
   * Platform-specific implementation for darwin/linux
   */
  private async getFileDescriptorUsage(): Promise<number> {
    const platform = os.platform();

    try {
      if (platform === 'darwin') {
        // macOS: Use lsof to count open files for current process
        const { stdout } = await execAsync('lsof -p $$ 2>/dev/null | wc -l');
        return parseInt(stdout.trim(), 10) || 0;
      } else if (platform === 'linux') {
        // Linux: Read from /proc
        const pid = process.pid;
        try {
          const { stdout } = await execAsync(
            `ls /proc/${pid}/fd 2>/dev/null | wc -l`
          );
          return parseInt(stdout.trim(), 10) || 0;
        } catch {
          // Fallback: Use lsof
          const { stdout } = await execAsync(
            `lsof -p ${pid} 2>/dev/null | wc -l`
          );
          return parseInt(stdout.trim(), 10) || 0;
        }
      } else {
        // Unsupported platform - return estimate
        return 100;
      }
    } catch (error) {
      console.error('[ResourceMonitor] Error getting FD usage:', error);
      return 0;
    }
  }

  /**
   * Get current file descriptor limit
   */
  private async getFileDescriptorLimit(): Promise<number> {
    const platform = os.platform();

    try {
      if (platform === 'darwin' || platform === 'linux') {
        const { stdout } = await execAsync('ulimit -n');
        const limit = parseInt(stdout.trim(), 10);
        return isNaN(limit) ? this.limits.fileDescriptors : limit;
      }
      return this.limits.fileDescriptors;
    } catch {
      return this.limits.fileDescriptors;
    }
  }

  /**
   * Get available disk space in GB
   * Platform-specific implementation for darwin/linux
   */
  private async getDiskSpaceFreeGB(): Promise<number> {
    const platform = os.platform();

    try {
      if (platform === 'darwin' || platform === 'linux') {
        // Use df command to get disk space
        // -P for POSIX output format (consistent across systems)
        const { stdout } = await execAsync(`df -P "${this.gitRoot}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        // df -P output: Filesystem 1024-blocks Used Available Capacity Mounted
        // Index:        0          1           2    3         4        5
        if (parts.length >= 4) {
          // Available is in 1K blocks, convert to GB
          const availableKB = parseInt(parts[3], 10);
          return availableKB / (1024 * 1024);
        }
      }
      // Fallback for unsupported platforms
      return 100;
    } catch (error) {
      console.error('[ResourceMonitor] Error getting disk space:', error);
      return 0;
    }
  }

  /**
   * Get detailed disk information
   */
  private async getDiskInfo(): Promise<{
    freeGB: number;
    totalGB: number;
    usedPercent: number;
  }> {
    const platform = os.platform();

    try {
      if (platform === 'darwin' || platform === 'linux') {
        const { stdout } = await execAsync(`df -P "${this.gitRoot}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);

        if (parts.length >= 5) {
          const totalKB = parseInt(parts[1], 10);
          const usedKB = parseInt(parts[2], 10);
          const availableKB = parseInt(parts[3], 10);

          const totalGB = totalKB / (1024 * 1024);
          const freeGB = availableKB / (1024 * 1024);
          const usedPercent = (usedKB / totalKB) * 100;

          return { freeGB, totalGB, usedPercent };
        }
      }
      return { freeGB: 100, totalGB: 500, usedPercent: 80 };
    } catch (error) {
      console.error('[ResourceMonitor] Error getting disk info:', error);
      return { freeGB: 0, totalGB: 0, usedPercent: 100 };
    }
  }

  /**
   * Get current worktree count
   * Uses git worktree list command
   */
  private async getWorktreeCount(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `git -C "${this.gitRoot}" worktree list --porcelain 2>/dev/null | grep -c "^worktree" || echo 0`
      );
      const count = parseInt(stdout.trim(), 10);
      return isNaN(count) ? 0 : count;
    } catch (error) {
      // Not a git repository or git not available
      console.error('[ResourceMonitor] Error counting worktrees:', error);
      return 0;
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo(): {
    usedMB: number;
    totalMB: number;
    usedPercent: number;
  } {
    const totalMB = os.totalmem() / (1024 * 1024);
    const freeMB = os.freemem() / (1024 * 1024);
    const usedMB = totalMB - freeMB;
    const usedPercent = (usedMB / totalMB) * 100;

    return { usedMB, totalMB, usedPercent };
  }

  /**
   * Evaluate a metric against thresholds
   */
  private evaluateMetric(
    percent: number,
    name: string,
    value: number,
    limit: number
  ): HealthReport['checks'][0] {
    if (percent >= this.criticalThreshold) {
      return {
        name,
        status: 'fail',
        message: `${name} critical: ${value}/${limit} (${percent.toFixed(1)}%)`,
        value,
        threshold: limit,
      };
    } else if (percent >= this.warningThreshold) {
      return {
        name,
        status: 'warn',
        message: `${name} warning: ${value}/${limit} (${percent.toFixed(1)}%)`,
        value,
        threshold: limit,
      };
    }
    return {
      name,
      status: 'pass',
      message: `${name} healthy: ${value}/${limit} (${percent.toFixed(1)}%)`,
      value,
      threshold: limit,
    };
  }

  /**
   * Evaluate disk space against minimum threshold
   */
  private evaluateDiskSpace(
    freeGB: number,
    minGB: number
  ): HealthReport['checks'][0] {
    const bufferMultiple = freeGB / minGB;

    if (freeGB < minGB) {
      return {
        name: 'Disk Space',
        status: 'fail',
        message: `Disk space critical: ${freeGB.toFixed(2)}GB free (min: ${minGB}GB)`,
        value: freeGB,
        threshold: minGB,
      };
    } else if (bufferMultiple < 2) {
      return {
        name: 'Disk Space',
        status: 'warn',
        message: `Disk space low: ${freeGB.toFixed(2)}GB free (min: ${minGB}GB)`,
        value: freeGB,
        threshold: minGB,
      };
    }
    return {
      name: 'Disk Space',
      status: 'pass',
      message: `Disk space healthy: ${freeGB.toFixed(2)}GB free (min: ${minGB}GB)`,
      value: freeGB,
      threshold: minGB,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ResourceMonitor instance with optional configuration
 *
 * @param config Optional configuration for the monitor
 * @returns Configured ResourceMonitor instance
 *
 * @example
 * ```typescript
 * // With defaults
 * const monitor = createResourceMonitor();
 *
 * // With custom limits
 * const monitor = createResourceMonitor({
 *   limits: {
 *     fileDescriptors: 100000,
 *     diskSpaceMinGB: 20,
 *     maxWorktreesPerMachine: 300
 *   },
 *   gitRoot: '/path/to/repo',
 *   warningThreshold: 75,
 *   criticalThreshold: 85
 * });
 *
 * // Start monitoring
 * monitor.startMonitoring(60000); // Every minute
 *
 * // Listen for events
 * monitor.on('critical', (health) => {
 *   console.error('Critical resource state!', health);
 * });
 *
 * monitor.on('metrics', (metrics) => {
 *   console.log('Current metrics:', metrics);
 * });
 * ```
 */
export function createResourceMonitor(
  config?: ResourceMonitorConfig
): ResourceMonitor {
  if (config) {
    return ResourceMonitor.fromConfig(config);
  }
  return new ResourceMonitor();
}

// ============================================================================
// Export
// ============================================================================

export default ResourceMonitor;
