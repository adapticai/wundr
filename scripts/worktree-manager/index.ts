#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Worktree Manager - Main Entry Point
 *
 * Provides git worktree lifecycle management, fractional access patterns (ccswitch),
 * resource monitoring, and synchronization for distributed agent coordination.
 *
 * @module worktree-manager
 */

import { exec } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Import defaults
import { DEFAULT_WORKTREE_CONFIG } from './types.js';

import type {
  WorktreeLifecycle,
  WorktreeStatus,
  WorktreeConfig,
  FractionalWorktreePattern,
  AgentIdentifier,
  AgentAccessLevel,
  ResourceLimits,
  ResourceUsage,
  ResourceMonitorConfig,
  ResourceAlert,
  ResourceAlertSeverity,
  WorktreeSyncConfig,
  SyncResult,
  CleanupOptions,
  CleanupResult,
} from './types.js';

// Re-export all types
export * from './types.js';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// ============================================================================
// WorktreeLifecycleManager (ccswitch)
// ============================================================================

/**
 * Configuration for WorktreeLifecycleManager
 */
export interface WorktreeLifecycleManagerConfig {
  /** Base configuration for worktrees */
  worktreeConfig: Partial<WorktreeConfig>;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Git repository root path */
  repoRoot?: string;
}

/**
 * Manages git worktree lifecycle for agent sessions
 *
 * The WorktreeLifecycleManager (ccswitch) handles creation, tracking,
 * and cleanup of git worktrees used by agent sessions and sub-agents.
 */
export class WorktreeLifecycleManager extends EventEmitter {
  private readonly config: WorktreeConfig;
  private readonly worktrees: Map<string, WorktreeLifecycle> = new Map();
  private readonly repoRoot: string;
  private readonly verbose: boolean;

  constructor(config: WorktreeLifecycleManagerConfig = { worktreeConfig: {} }) {
    super();
    this.verbose = config.verbose ?? false;
    this.repoRoot = config.repoRoot ?? process.cwd();

    // Merge with defaults
    this.config = {
      ...DEFAULT_WORKTREE_CONFIG,
      ...config.worktreeConfig,
      hierarchicalStrategy: {
        ...DEFAULT_WORKTREE_CONFIG.hierarchicalStrategy,
        ...config.worktreeConfig.hierarchicalStrategy,
        sessionWorktrees: {
          ...DEFAULT_WORKTREE_CONFIG.hierarchicalStrategy.sessionWorktrees,
          ...config.worktreeConfig.hierarchicalStrategy?.sessionWorktrees,
        },
        subAgentWorktrees: {
          ...DEFAULT_WORKTREE_CONFIG.hierarchicalStrategy.subAgentWorktrees,
          ...config.worktreeConfig.hierarchicalStrategy?.subAgentWorktrees,
        },
      },
    };

    this.log('info', 'WorktreeLifecycleManager initialized');
  }

  /**
   * Create a new worktree for a task
   */
  async createWorktree(options: {
    taskId: string;
    branchName: string;
    sessionId: string;
    parentWorktreePath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WorktreeLifecycle> {
    const { taskId, branchName, sessionId, parentWorktreePath, metadata } =
      options;

    // Generate worktree path based on hierarchy
    const worktreePath = this.generateWorktreePath(
      taskId,
      sessionId,
      !!parentWorktreePath
    );

    // Create lifecycle entry
    const lifecycle: WorktreeLifecycle = {
      taskId,
      branchName,
      worktreePath,
      sessionId,
      createdAt: new Date(),
      status: 'creating',
      parentWorktreePath,
      metadata,
    };

    this.worktrees.set(taskId, lifecycle);

    try {
      // Ensure parent directory exists
      await fsPromises.mkdir(path.dirname(worktreePath), { recursive: true });

      // Create the git worktree
      await this.executeGitCommand(
        `worktree add -b ${branchName} ${worktreePath}`
      );

      // Update status
      lifecycle.status = 'active';
      lifecycle.lastAccessedAt = new Date();

      this.emit('worktree:created', lifecycle);
      this.log('info', `Created worktree: ${worktreePath} for task ${taskId}`);

      return lifecycle;
    } catch (error) {
      lifecycle.status = 'error';
      lifecycle.errorMessage =
        error instanceof Error ? error.message : String(error);

      this.emit('error', {
        operation: 'createWorktree',
        error: error instanceof Error ? error : new Error(String(error)),
        context: { taskId, branchName, sessionId },
      });

      throw error;
    }
  }

  /**
   * Get a worktree by task ID
   */
  getWorktree(taskId: string): WorktreeLifecycle | undefined {
    return this.worktrees.get(taskId);
  }

  /**
   * Get all worktrees for a session
   */
  getSessionWorktrees(sessionId: string): WorktreeLifecycle[] {
    return Array.from(this.worktrees.values()).filter(
      wt => wt.sessionId === sessionId
    );
  }

  /**
   * Get all active worktrees
   */
  getActiveWorktrees(): WorktreeLifecycle[] {
    return Array.from(this.worktrees.values()).filter(
      wt => wt.status === 'active'
    );
  }

  /**
   * Update worktree status
   */
  updateStatus(
    taskId: string,
    status: WorktreeStatus,
    errorMessage?: string
  ): void {
    const worktree = this.worktrees.get(taskId);
    if (!worktree) {
      throw new Error(`Worktree not found for task: ${taskId}`);
    }

    const previousStatus = worktree.status;
    worktree.status = status;
    worktree.lastAccessedAt = new Date();

    if (errorMessage) {
      worktree.errorMessage = errorMessage;
    }

    this.emit('worktree:status-changed', { worktree, previousStatus });
    this.log(
      'debug',
      `Worktree ${taskId} status: ${previousStatus} -> ${status}`
    );
  }

  /**
   * Destroy a worktree
   */
  async destroyWorktree(
    taskId: string,
    options: Partial<CleanupOptions> = {}
  ): Promise<void> {
    const worktree = this.worktrees.get(taskId);
    if (!worktree) {
      throw new Error(`Worktree not found for task: ${taskId}`);
    }

    const cleanupOptions: CleanupOptions = {
      force: options.force ?? false,
      deleteBranch: options.deleteBranch ?? false,
      archive: options.archive ?? false,
      archivePath: options.archivePath,
      trigger: options.trigger ?? 'manual',
      dryRun: options.dryRun ?? false,
    };

    try {
      this.updateStatus(taskId, 'cleanup');

      if (!cleanupOptions.dryRun) {
        // Archive if requested
        if (cleanupOptions.archive && cleanupOptions.archivePath) {
          await this.archiveWorktree(worktree, cleanupOptions.archivePath);
        }

        // Remove the git worktree
        const forceFlag = cleanupOptions.force ? ' --force' : '';
        await this.executeGitCommand(
          `worktree remove${forceFlag} ${worktree.worktreePath}`
        );

        // Delete branch if requested
        if (cleanupOptions.deleteBranch) {
          await this.executeGitCommand(
            `branch -D ${worktree.branchName}`
          ).catch(() => {
            // Branch may not exist or may be checked out elsewhere
            this.log('warn', `Could not delete branch: ${worktree.branchName}`);
          });
        }
      }

      worktree.status = 'destroyed';
      this.emit('worktree:destroyed', worktree);
      this.worktrees.delete(taskId);

      this.log('info', `Destroyed worktree: ${worktree.worktreePath}`);
    } catch (error) {
      this.updateStatus(
        taskId,
        'error',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * List all tracked worktrees
   */
  listWorktrees(): WorktreeLifecycle[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * Get worktree count
   */
  getWorktreeCount(): number {
    return this.worktrees.size;
  }

  private generateWorktreePath(
    taskId: string,
    sessionId: string,
    isSubAgent: boolean
  ): string {
    const strategy = isSubAgent
      ? this.config.hierarchicalStrategy.subAgentWorktrees
      : this.config.hierarchicalStrategy.sessionWorktrees;

    const template = strategy.pathTemplate
      .replace('{basePath}', strategy.basePath)
      .replace('{sessionId}', sessionId)
      .replace('{taskId}', taskId)
      .replace('{agentId}', taskId);

    return path.resolve(this.repoRoot, template);
  }

  private async executeGitCommand(command: string): Promise<string> {
    const fullCommand = `git -C ${this.repoRoot} ${command}`;
    this.log('debug', `Executing: ${fullCommand}`);

    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: this.config.operationTimeoutMs,
    });

    if (stderr && this.verbose) {
      this.log('debug', `Git stderr: ${stderr}`);
    }

    return stdout.trim();
  }

  private async archiveWorktree(
    worktree: WorktreeLifecycle,
    archivePath: string
  ): Promise<void> {
    const archiveName = `${worktree.taskId}-${Date.now()}.tar.gz`;
    const fullArchivePath = path.join(archivePath, archiveName);

    await fsPromises.mkdir(archivePath, { recursive: true });
    await execAsync(
      `tar -czf ${fullArchivePath} -C ${path.dirname(worktree.worktreePath)} ${path.basename(worktree.worktreePath)}`
    );

    this.log('info', `Archived worktree to: ${fullArchivePath}`);
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [worktree-manager] [${level.toUpperCase()}] ${message}`
    );
  }
}

// ============================================================================
// FractionalWorktreeManager
// ============================================================================

/**
 * Configuration for FractionalWorktreeManager
 */
export interface FractionalWorktreeManagerConfig {
  /** Fractional access pattern configuration */
  pattern: Partial<FractionalWorktreePattern>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Manages fractional access to worktrees (ccswitch)
 *
 * Implements the fractional worktree pattern where some agents have
 * read-only access while others have write access.
 */
export class FractionalWorktreeManager extends EventEmitter {
  private readonly pattern: FractionalWorktreePattern;
  private readonly verbose: boolean;

  constructor(config: FractionalWorktreeManagerConfig = { pattern: {} }) {
    super();
    this.verbose = config.verbose ?? false;

    // Default pattern
    this.pattern = {
      enabled: config.pattern.enabled ?? true,
      readOnlyAgents: config.pattern.readOnlyAgents ?? [],
      writeAccessAgents: config.pattern.writeAccessAgents ?? [],
      defaultAccessLevel: config.pattern.defaultAccessLevel ?? 'read',
      enforceAccess: config.pattern.enforceAccess ?? true,
      globalReadOnlyPatterns: config.pattern.globalReadOnlyPatterns ?? [
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
      ],
      adminOnlyPatterns: config.pattern.adminOnlyPatterns ?? [
        '.env*',
        '*.key',
        '*.pem',
        'secrets/*',
      ],
    };

    this.log('info', 'FractionalWorktreeManager initialized');
  }

  /**
   * Check if an agent has access to perform an operation
   */
  checkAccess(
    agent: AgentIdentifier,
    operation: 'read' | 'write',
    filePath?: string
  ): boolean {
    if (!this.pattern.enabled) {
      return true;
    }

    // Check global read-only patterns
    if (operation === 'write' && filePath) {
      const isGlobalReadOnly = this.pattern.globalReadOnlyPatterns.some(
        pattern => this.matchPattern(filePath, pattern)
      );
      if (isGlobalReadOnly) {
        this.log('debug', `File ${filePath} is globally read-only`);
        return false;
      }

      // Check admin-only patterns
      const isAdminOnly = this.pattern.adminOnlyPatterns.some(pattern =>
        this.matchPattern(filePath, pattern)
      );
      if (isAdminOnly) {
        const hasAdminAccess = this.getAgentAccessLevel(agent) === 'admin';
        if (!hasAdminAccess) {
          this.log(
            'warn',
            `Agent ${agent.agentId} denied admin-only access to ${filePath}`
          );
          return false;
        }
      }
    }

    const accessLevel = this.getAgentAccessLevel(agent);

    if (operation === 'read') {
      return true; // All agents can read
    }

    // Write operation
    if (accessLevel === 'read') {
      if (this.pattern.enforceAccess) {
        this.log(
          'warn',
          `Agent ${agent.agentId} denied write access (read-only)`
        );
        return false;
      }
      this.log(
        'info',
        `Agent ${agent.agentId} write access would be denied (enforcement disabled)`
      );
    }

    return accessLevel === 'write' || accessLevel === 'admin';
  }

  /**
   * Get the access level for an agent
   */
  getAgentAccessLevel(agent: AgentIdentifier): AgentAccessLevel {
    // Check write access list first
    const hasWriteAccess = this.pattern.writeAccessAgents.some(
      a => a.agentId === agent.agentId && a.sessionId === agent.sessionId
    );
    if (hasWriteAccess) {
      return 'write';
    }

    // Check read-only list
    const isReadOnly = this.pattern.readOnlyAgents.some(
      a => a.agentId === agent.agentId && a.sessionId === agent.sessionId
    );
    if (isReadOnly) {
      return 'read';
    }

    return this.pattern.defaultAccessLevel;
  }

  /**
   * Grant write access to an agent
   */
  grantWriteAccess(agent: AgentIdentifier): void {
    // Remove from read-only if present
    this.pattern.readOnlyAgents = this.pattern.readOnlyAgents.filter(
      a => !(a.agentId === agent.agentId && a.sessionId === agent.sessionId)
    );

    // Add to write access if not already present
    if (
      !this.pattern.writeAccessAgents.some(
        a => a.agentId === agent.agentId && a.sessionId === agent.sessionId
      )
    ) {
      this.pattern.writeAccessAgents.push(agent);
    }

    this.log('info', `Granted write access to agent: ${agent.agentId}`);
  }

  /**
   * Revoke write access from an agent (set to read-only)
   */
  revokeWriteAccess(agent: AgentIdentifier): void {
    // Remove from write access
    this.pattern.writeAccessAgents = this.pattern.writeAccessAgents.filter(
      a => !(a.agentId === agent.agentId && a.sessionId === agent.sessionId)
    );

    // Add to read-only if not already present
    if (
      !this.pattern.readOnlyAgents.some(
        a => a.agentId === agent.agentId && a.sessionId === agent.sessionId
      )
    ) {
      this.pattern.readOnlyAgents.push(agent);
    }

    this.log('info', `Revoked write access from agent: ${agent.agentId}`);
  }

  /**
   * Get the current pattern configuration
   */
  getPattern(): Readonly<FractionalWorktreePattern> {
    return Object.freeze({ ...this.pattern });
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    // Simple glob matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return (
      new RegExp(`^${regexPattern}$`).test(filePath) ||
      new RegExp(`/${regexPattern}$`).test(filePath)
    );
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [fractional-worktree] [${level.toUpperCase()}] ${message}`
    );
  }
}

// ============================================================================
// ResourceMonitor
// ============================================================================

/**
 * Monitors system resources for worktree operations
 */
export class ResourceMonitor extends EventEmitter {
  private readonly config: ResourceMonitorConfig;
  private readonly verbose: boolean;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastUsage: ResourceUsage | null = null;

  constructor(config: Partial<ResourceMonitorConfig> = {}) {
    super();
    this.verbose = config.limits !== undefined;

    // Import defaults
    const defaultLimits: ResourceLimits = {
      fileDescriptors: 1024,
      diskSpaceMinGB: 5,
      maxWorktreesPerMachine: 20,
      maxMemoryMB: 2048,
      maxCpuPercent: 50,
    };

    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 30000,
      limits: { ...defaultLimits, ...config.limits },
      warningThreshold: config.warningThreshold ?? 0.8,
      criticalThreshold: config.criticalThreshold ?? 0.95,
      autoReclaim: config.autoReclaim ?? false,
    };

    this.log('info', 'ResourceMonitor initialized');
  }

  /**
   * Start resource monitoring
   */
  start(): void {
    if (this.pollInterval) {
      return;
    }

    this.log('info', 'Starting resource monitor');
    this.checkResources();

    this.pollInterval = setInterval(() => {
      this.checkResources();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop resource monitoring
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.log('info', 'Resource monitor stopped');
    }
  }

  /**
   * Get current resource usage
   */
  async getCurrentUsage(): Promise<ResourceUsage> {
    const usage: ResourceUsage = {
      fileDescriptorsUsed: await this.getFileDescriptorCount(),
      diskSpaceAvailableGB: await this.getDiskSpaceGB(),
      activeWorktrees: await this.getWorktreeCount(),
      memoryUsedMB: this.getMemoryUsageMB(),
      cpuUsagePercent: await this.getCpuUsage(),
      timestamp: new Date(),
    };

    this.lastUsage = usage;
    return usage;
  }

  /**
   * Check if resources are within limits
   */
  async checkResourceLimits(): Promise<ResourceAlert[]> {
    const usage = await this.getCurrentUsage();
    const alerts: ResourceAlert[] = [];

    // Check disk space
    if (usage.diskSpaceAvailableGB < this.config.limits.diskSpaceMinGB) {
      alerts.push(
        this.createAlert(
          'disk',
          usage.diskSpaceAvailableGB,
          this.config.limits.diskSpaceMinGB
        )
      );
    }

    // Check worktree count
    const worktreeRatio =
      usage.activeWorktrees / this.config.limits.maxWorktreesPerMachine;
    if (worktreeRatio >= this.config.criticalThreshold) {
      alerts.push(
        this.createAlert(
          'worktreeCount',
          usage.activeWorktrees,
          this.config.limits.maxWorktreesPerMachine
        )
      );
    } else if (worktreeRatio >= this.config.warningThreshold) {
      alerts.push(
        this.createAlert(
          'worktreeCount',
          usage.activeWorktrees,
          this.config.limits.maxWorktreesPerMachine,
          'warning'
        )
      );
    }

    // Check file descriptors
    const fdRatio =
      usage.fileDescriptorsUsed / this.config.limits.fileDescriptors;
    if (fdRatio >= this.config.criticalThreshold) {
      alerts.push(
        this.createAlert(
          'fileDescriptors',
          usage.fileDescriptorsUsed,
          this.config.limits.fileDescriptors
        )
      );
    } else if (fdRatio >= this.config.warningThreshold) {
      alerts.push(
        this.createAlert(
          'fileDescriptors',
          usage.fileDescriptorsUsed,
          this.config.limits.fileDescriptors,
          'warning'
        )
      );
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emit('resource:alert', alert);
    }

    return alerts;
  }

  /**
   * Get the last recorded usage
   */
  getLastUsage(): ResourceUsage | null {
    return this.lastUsage;
  }

  /**
   * Get resource limits configuration
   */
  getLimits(): Readonly<ResourceLimits> {
    return Object.freeze({ ...this.config.limits });
  }

  private async checkResources(): Promise<void> {
    try {
      await this.checkResourceLimits();
    } catch (error) {
      this.log('error', `Resource check failed: ${error}`);
    }
  }

  private createAlert(
    resourceType: ResourceAlert['resourceType'],
    currentValue: number,
    limitValue: number,
    severity: ResourceAlertSeverity = 'critical'
  ): ResourceAlert {
    const messages: Record<ResourceAlert['resourceType'], string> = {
      disk: `Low disk space: ${currentValue.toFixed(2)} GB available (min: ${limitValue} GB)`,
      memory: `High memory usage: ${currentValue} MB (limit: ${limitValue} MB)`,
      cpu: `High CPU usage: ${currentValue}% (limit: ${limitValue}%)`,
      fileDescriptors: `File descriptor usage: ${currentValue} (limit: ${limitValue})`,
      worktreeCount: `Worktree count: ${currentValue} (max: ${limitValue})`,
    };

    return {
      resourceType,
      severity,
      currentValue,
      limitValue,
      message: messages[resourceType],
      timestamp: new Date(),
    };
  }

  private async getFileDescriptorCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('lsof -p $$ 2>/dev/null | wc -l');
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private async getDiskSpaceGB(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        "df -k . | tail -1 | awk '{print $4}'"
      );
      const kbAvailable = parseInt(stdout.trim(), 10);
      return kbAvailable / (1024 * 1024); // Convert KB to GB
    } catch {
      return 0;
    }
  }

  private async getWorktreeCount(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'git worktree list 2>/dev/null | wc -l'
      );
      return Math.max(0, parseInt(stdout.trim(), 10) - 1); // Subtract 1 for main worktree
    } catch {
      return 0;
    }
  }

  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / (1024 * 1024));
  }

  private async getCpuUsage(): Promise<number> {
    // Simple approximation - in production, use os-utils or similar
    return 0;
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [resource-monitor] [${level.toUpperCase()}] ${message}`
    );
  }
}

// ============================================================================
// WorktreeCleanup
// ============================================================================

/**
 * Handles cleanup of stale and unused worktrees
 */
export class WorktreeCleanup {
  private readonly lifecycleManager: WorktreeLifecycleManager;
  private readonly verbose: boolean;

  constructor(lifecycleManager: WorktreeLifecycleManager, verbose = false) {
    this.lifecycleManager = lifecycleManager;
    this.verbose = verbose;
  }

  /**
   * Clean up worktrees based on options
   */
  async cleanup(options: Partial<CleanupOptions> = {}): Promise<CleanupResult> {
    const startTime = Date.now();
    const cleanupOptions: CleanupOptions = {
      force: options.force ?? false,
      deleteBranch: options.deleteBranch ?? false,
      archive: options.archive ?? false,
      archivePath: options.archivePath,
      staleThresholdMs: options.staleThresholdMs,
      statusFilter: options.statusFilter,
      trigger: options.trigger ?? 'manual',
      dryRun: options.dryRun ?? false,
    };

    const result: CleanupResult = {
      cleaned: [],
      failed: [],
      skipped: [],
      diskReclaimedBytes: 0,
      durationMs: 0,
      timestamp: new Date(),
    };

    const worktrees = this.lifecycleManager.listWorktrees();

    for (const worktree of worktrees) {
      // Check status filter
      if (
        cleanupOptions.statusFilter &&
        !cleanupOptions.statusFilter.includes(worktree.status)
      ) {
        result.skipped.push({ worktree, reason: 'Status not in filter' });
        continue;
      }

      // Check staleness
      if (cleanupOptions.staleThresholdMs) {
        const age = Date.now() - worktree.createdAt.getTime();
        if (age < cleanupOptions.staleThresholdMs) {
          result.skipped.push({ worktree, reason: 'Not stale' });
          continue;
        }
      }

      // Skip active worktrees unless force is set
      if (worktree.status === 'active' && !cleanupOptions.force) {
        result.skipped.push({
          worktree,
          reason: 'Active worktree (use force to cleanup)',
        });
        continue;
      }

      try {
        if (!cleanupOptions.dryRun) {
          await this.lifecycleManager.destroyWorktree(
            worktree.taskId,
            cleanupOptions
          );
        }
        result.cleaned.push(worktree);
        this.log('info', `Cleaned up worktree: ${worktree.worktreePath}`);
      } catch (error) {
        result.failed.push({
          worktree,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.durationMs = Date.now() - startTime;
    result.timestamp = new Date();

    this.log(
      'info',
      `Cleanup complete: ${result.cleaned.length} cleaned, ${result.failed.length} failed, ${result.skipped.length} skipped`
    );

    return result;
  }

  /**
   * Clean up stale worktrees (convenience method)
   */
  async cleanupStale(staleThresholdMs: number): Promise<CleanupResult> {
    return this.cleanup({
      staleThresholdMs,
      trigger: 'stale',
    });
  }

  /**
   * Clean up error worktrees (convenience method)
   */
  async cleanupErrors(): Promise<CleanupResult> {
    return this.cleanup({
      statusFilter: ['error'],
      trigger: 'error',
      force: true,
    });
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [worktree-cleanup] [${level.toUpperCase()}] ${message}`
    );
  }
}

// ============================================================================
// WorktreeSync
// ============================================================================

/**
 * Handles synchronization of worktrees with upstream branches
 */
export class WorktreeSync {
  private readonly lifecycleManager: WorktreeLifecycleManager;
  private readonly config: WorktreeSyncConfig;
  private readonly verbose: boolean;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    lifecycleManager: WorktreeLifecycleManager,
    config: Partial<WorktreeSyncConfig> = {},
    verbose = false
  ) {
    this.lifecycleManager = lifecycleManager;
    this.verbose = verbose;

    // Default sync config
    this.config = {
      autoSync: config.autoSync ?? false,
      syncIntervalMs: config.syncIntervalMs ?? 300000,
      syncStrategy: config.syncStrategy ?? 'rebase',
      conflictResolution: config.conflictResolution ?? 'manual',
      syncFromBranches: config.syncFromBranches ?? ['main', 'master'],
      pushAfterSync: config.pushAfterSync ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 5000,
    };
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (!this.config.autoSync || this.syncInterval) {
      return;
    }

    this.log('info', 'Starting auto-sync');
    this.syncInterval = setInterval(async () => {
      await this.syncAll();
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.log('info', 'Auto-sync stopped');
    }
  }

  /**
   * Sync a specific worktree
   */
  async syncWorktree(taskId: string): Promise<SyncResult> {
    const worktree = this.lifecycleManager.getWorktree(taskId);
    if (!worktree) {
      throw new Error(`Worktree not found for task: ${taskId}`);
    }

    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      worktreePath: worktree.worktreePath,
      strategy: this.config.syncStrategy,
      appliedCommits: [],
      conflictedFiles: [],
      durationMs: 0,
      timestamp: new Date(),
    };

    try {
      this.lifecycleManager.updateStatus(taskId, 'syncing');

      // Fetch updates
      await this.executeGitCommand(worktree.worktreePath, 'fetch origin');

      // Find the first sync branch that exists
      let syncBranch: string | null = null;
      for (const branch of this.config.syncFromBranches) {
        try {
          await this.executeGitCommand(
            worktree.worktreePath,
            `rev-parse origin/${branch}`
          );
          syncBranch = branch;
          break;
        } catch {
          continue;
        }
      }

      if (!syncBranch) {
        throw new Error('No sync branch found');
      }

      // Apply sync strategy
      switch (this.config.syncStrategy) {
        case 'merge':
          await this.executeGitCommand(
            worktree.worktreePath,
            `merge origin/${syncBranch}`
          );
          break;
        case 'rebase':
          await this.executeGitCommand(
            worktree.worktreePath,
            `rebase origin/${syncBranch}`
          );
          break;
        case 'reset':
          await this.executeGitCommand(
            worktree.worktreePath,
            `reset --hard origin/${syncBranch}`
          );
          break;
      }

      // Push if configured
      if (this.config.pushAfterSync) {
        await this.executeGitCommand(worktree.worktreePath, 'push');
      }

      result.success = true;
      this.lifecycleManager.updateStatus(taskId, 'active');
    } catch (error) {
      result.success = false;
      result.errorMessage =
        error instanceof Error ? error.message : String(error);
      this.lifecycleManager.updateStatus(taskId, 'error', result.errorMessage);
    }

    result.durationMs = Date.now() - startTime;
    result.timestamp = new Date();

    return result;
  }

  /**
   * Sync all active worktrees
   */
  async syncAll(): Promise<SyncResult[]> {
    const worktrees = this.lifecycleManager.getActiveWorktrees();
    const results: SyncResult[] = [];

    for (const worktree of worktrees) {
      try {
        const result = await this.syncWorktree(worktree.taskId);
        results.push(result);
      } catch (error) {
        this.log(
          'error',
          `Failed to sync worktree ${worktree.taskId}: ${error}`
        );
      }
    }

    return results;
  }

  /**
   * Get sync configuration
   */
  getConfig(): Readonly<WorktreeSyncConfig> {
    return Object.freeze({ ...this.config });
  }

  private async executeGitCommand(
    worktreePath: string,
    command: string
  ): Promise<string> {
    const { stdout } = await execAsync(`git -C ${worktreePath} ${command}`);
    return stdout.trim();
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [worktree-sync] [${level.toUpperCase()}] ${message}`
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a configured WorktreeLifecycleManager instance
 */
export function createWorktreeManager(
  config?: WorktreeLifecycleManagerConfig
): WorktreeLifecycleManager {
  return new WorktreeLifecycleManager(config);
}

/**
 * Create a configured ResourceMonitor instance
 */
export function createResourceMonitor(
  config?: Partial<ResourceMonitorConfig>
): ResourceMonitor {
  return new ResourceMonitor(config);
}

/**
 * Create a complete worktree management system
 */
export function createWorktreeSystem(options: {
  worktreeConfig?: Partial<WorktreeConfig>;
  resourceConfig?: Partial<ResourceMonitorConfig>;
  syncConfig?: Partial<WorktreeSyncConfig>;
  fractionalConfig?: Partial<FractionalWorktreePattern>;
  verbose?: boolean;
}): {
  lifecycleManager: WorktreeLifecycleManager;
  resourceMonitor: ResourceMonitor;
  cleanup: WorktreeCleanup;
  sync: WorktreeSync;
  fractionalManager: FractionalWorktreeManager;
} {
  const verbose = options.verbose ?? false;

  const lifecycleManager = new WorktreeLifecycleManager({
    worktreeConfig: options.worktreeConfig ?? {},
    verbose,
  });

  const resourceMonitor = new ResourceMonitor({
    ...options.resourceConfig,
  });

  const cleanup = new WorktreeCleanup(lifecycleManager, verbose);
  const sync = new WorktreeSync(lifecycleManager, options.syncConfig, verbose);

  const fractionalManager = new FractionalWorktreeManager({
    pattern: options.fractionalConfig ?? {},
    verbose,
  });

  return {
    lifecycleManager,
    resourceMonitor,
    cleanup,
    sync,
    fractionalManager,
  };
}

// ============================================================================
// CLI Entry Point (if run directly)
// ============================================================================

if (require.main === module) {
  console.log('Worktree Manager Module');
  console.log('=======================');
  console.log('');
  console.log('This module provides:');
  console.log(
    '  - WorktreeLifecycleManager (ccswitch) - Git worktree lifecycle management'
  );
  console.log('  - FractionalWorktreeManager - Fractional access patterns');
  console.log('  - ResourceMonitor - System resource monitoring');
  console.log('  - WorktreeCleanup - Stale worktree cleanup');
  console.log('  - WorktreeSync - Worktree synchronization');
  console.log('');
  console.log('Factory functions:');
  console.log('  - createWorktreeManager()');
  console.log('  - createResourceMonitor()');
  console.log('  - createWorktreeSystem()');
  console.log('');
  console.log('Import this module to use programmatically.');
}
