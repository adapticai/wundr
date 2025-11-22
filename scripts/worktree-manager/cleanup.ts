/**
 * Worktree Cleanup Manager
 *
 * Implements automatic worktree cleanup functionality for the three-tier
 * architecture. Handles stale, merged, orphaned, and age-based cleanup
 * with safety checks and memory bank archival.
 *
 * @module scripts/worktree-manager/cleanup
 */

import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import * as fs from 'fs-extra';

const execAsync = promisify(exec);

/**
 * Configuration for worktree cleanup operations
 */
export interface CleanupConfig {
  /** Base path where worktrees are stored */
  worktreeBasePath: string;
  /** Threshold in milliseconds for stale worktrees (default: 7 days) */
  staleThresholdMs?: number;
  /** Whether to check for orphaned worktrees */
  orphanCheckEnabled?: boolean;
  /** Path to archive memory banks before cleanup */
  memoryBankArchivePath?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Git repository root path */
  repoRoot?: string;
}

/**
 * Information about a single worktree
 */
export interface WorktreeInfo {
  /** Absolute path to the worktree */
  path: string;
  /** Branch name associated with the worktree */
  branch: string;
  /** Commit SHA the worktree is currently at */
  commit: string;
  /** Whether the worktree is the main working tree */
  isMain: boolean;
  /** Whether the worktree is locked */
  isLocked: boolean;
  /** Last modified timestamp */
  lastModified?: Date;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges?: boolean;
  /** Associated worktree ID for memory bank */
  worktreeId?: string;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Whether the cleanup operation succeeded */
  success: boolean;
  /** Number of worktrees removed */
  removedCount: number;
  /** Paths of removed worktrees */
  removedPaths: string[];
  /** Worktrees that were skipped (e.g., due to uncommitted changes) */
  skippedPaths: string[];
  /** Reasons for skipping */
  skipReasons: Map<string, string>;
  /** Errors encountered during cleanup */
  errors: CleanupError[];
  /** Whether memory banks were archived */
  memoryBanksArchived: boolean;
  /** Total disk space freed in bytes */
  freedBytes?: number;
}

/**
 * Error encountered during cleanup
 */
export interface CleanupError {
  /** Path of the worktree that caused the error */
  path: string;
  /** Error message */
  message: string;
  /** Original error */
  cause?: Error;
}

/**
 * Plan for cleanup operations (used in dry run)
 */
export interface CleanupPlan {
  /** Worktrees that would be removed */
  toRemove: WorktreeInfo[];
  /** Worktrees that would be skipped */
  toSkip: WorktreeInfo[];
  /** Reasons for removal */
  removalReasons: Map<string, string>;
  /** Reasons for skipping */
  skipReasons: Map<string, string>;
  /** Estimated disk space to be freed in bytes */
  estimatedFreedBytes: number;
  /** Memory banks that would be archived */
  memoryBanksToArchive: string[];
}

/**
 * Default stale threshold: 7 days in milliseconds
 */
const DEFAULT_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Manages automatic worktree cleanup for the three-tier architecture.
 *
 * This class provides methods for cleaning up worktrees based on various
 * criteria including staleness, merge status, orphan detection, and age.
 * It includes safety checks to prevent data loss and archives memory banks
 * before cleanup.
 *
 * @example
 * ```typescript
 * const cleanup = new WorktreeCleanup({
 *   worktreeBasePath: '/path/to/worktrees',
 *   staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
 *   orphanCheckEnabled: true,
 * });
 *
 * // Dry run to see what would be cleaned up
 * const plan = await cleanup.dryRun();
 * console.log(`Would remove ${plan.toRemove.length} worktrees`);
 *
 * // Perform actual cleanup
 * const result = await cleanup.cleanupStale();
 * console.log(`Removed ${result.removedCount} stale worktrees`);
 * ```
 */
export class WorktreeCleanup {
  private readonly config: Required<CleanupConfig>;
  private readonly staleThresholdMs: number;
  private readonly orphanCheckEnabled: boolean;

  /**
   * Creates a new WorktreeCleanup instance
   *
   * @param config - Configuration for cleanup operations
   */
  constructor(config: CleanupConfig) {
    this.staleThresholdMs =
      config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
    this.orphanCheckEnabled = config.orphanCheckEnabled ?? true;

    this.config = {
      worktreeBasePath: config.worktreeBasePath,
      staleThresholdMs: this.staleThresholdMs,
      orphanCheckEnabled: this.orphanCheckEnabled,
      memoryBankArchivePath:
        config.memoryBankArchivePath ??
        path.join(config.worktreeBasePath, '.archived-memory-banks'),
      verbose: config.verbose ?? false,
      repoRoot: config.repoRoot ?? process.cwd(),
    };
  }

  /**
   * Cleans up stale worktrees that haven't been modified within the threshold.
   *
   * A worktree is considered stale if its last modification time exceeds
   * the configured stale threshold (default: 7 days).
   *
   * @returns Result of the cleanup operation
   */
  async cleanupStale(): Promise<CleanupResult> {
    this.log('Starting stale worktree cleanup');

    const staleWorktrees = await this.getStaleWorktrees();
    return this.performCleanup(staleWorktrees, 'stale');
  }

  /**
   * Cleans up worktrees whose branches have been merged into the remote branch.
   *
   * @param remoteBranch - The remote branch to check against (default: 'origin/main')
   * @returns Result of the cleanup operation
   */
  async cleanupMerged(
    remoteBranch: string = 'origin/main'
  ): Promise<CleanupResult> {
    this.log(
      `Starting merged worktree cleanup (checking against ${remoteBranch})`
    );

    const mergedWorktrees = await this.getMergedWorktrees(remoteBranch);
    return this.performCleanup(mergedWorktrees, 'merged');
  }

  /**
   * Cleans up orphaned worktrees (worktrees without a valid branch reference).
   *
   * @returns Result of the cleanup operation
   */
  async cleanupOrphaned(): Promise<CleanupResult> {
    if (!this.orphanCheckEnabled) {
      this.log('Orphan check is disabled, skipping');
      return this.createEmptyResult();
    }

    this.log('Starting orphaned worktree cleanup');

    const orphanedWorktrees = await this.getOrphanedWorktrees();
    return this.performCleanup(orphanedWorktrees, 'orphaned');
  }

  /**
   * Cleans up worktrees older than the specified age.
   *
   * @param maxAgeDays - Maximum age in days for worktrees to keep
   * @returns Result of the cleanup operation
   */
  async cleanupByAge(maxAgeDays: number): Promise<CleanupResult> {
    this.log(
      `Starting age-based worktree cleanup (max age: ${maxAgeDays} days)`
    );

    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - maxAgeMs);

    const allWorktrees = await this.listWorktrees();
    const oldWorktrees = allWorktrees.filter(wt => {
      if (!wt.lastModified || wt.isMain) {
        return false;
      }
      return wt.lastModified < cutoffDate;
    });

    return this.performCleanup(oldWorktrees, `older than ${maxAgeDays} days`);
  }

  /**
   * Performs a dry run to show what would be cleaned up without making changes.
   *
   * This method analyzes all worktrees and categorizes them based on various
   * cleanup criteria without actually removing anything.
   *
   * @returns A plan showing what would be cleaned up
   */
  async dryRun(): Promise<CleanupPlan> {
    this.log('Performing dry run...');

    const [stale, merged, orphaned] = await Promise.all([
      this.getStaleWorktrees(),
      this.getMergedWorktrees(),
      this.orphanCheckEnabled ? this.getOrphanedWorktrees() : [],
    ]);

    const toRemoveMap = new Map<string, WorktreeInfo>();
    const removalReasons = new Map<string, string>();

    // Deduplicate and track reasons
    for (const wt of stale) {
      toRemoveMap.set(wt.path, wt);
      removalReasons.set(wt.path, 'stale (not modified within threshold)');
    }

    for (const wt of merged) {
      if (!toRemoveMap.has(wt.path)) {
        toRemoveMap.set(wt.path, wt);
        removalReasons.set(wt.path, 'merged into remote branch');
      } else {
        const existing = removalReasons.get(wt.path);
        removalReasons.set(wt.path, `${existing}, merged into remote branch`);
      }
    }

    for (const wt of orphaned) {
      if (!toRemoveMap.has(wt.path)) {
        toRemoveMap.set(wt.path, wt);
        removalReasons.set(wt.path, 'orphaned (no valid branch reference)');
      } else {
        const existing = removalReasons.get(wt.path);
        removalReasons.set(wt.path, `${existing}, orphaned`);
      }
    }

    // Check safety and categorize
    const toRemove: WorktreeInfo[] = [];
    const toSkip: WorktreeInfo[] = [];
    const skipReasons = new Map<string, string>();

    for (const wt of Array.from(toRemoveMap.values())) {
      const hasChanges = await this.checkUncommittedChanges(wt.path);

      if (hasChanges) {
        toSkip.push(wt);
        skipReasons.set(wt.path, 'has uncommitted changes');
      } else if (wt.isLocked) {
        toSkip.push(wt);
        skipReasons.set(wt.path, 'worktree is locked');
      } else if (wt.isMain) {
        toSkip.push(wt);
        skipReasons.set(wt.path, 'main worktree cannot be removed');
      } else {
        toRemove.push(wt);
      }
    }

    // Calculate estimated freed bytes
    let estimatedFreedBytes = 0;
    for (const wt of toRemove) {
      try {
        const size = await this.getDirectorySize(wt.path);
        estimatedFreedBytes += size;
      } catch {
        // Ignore size calculation errors
      }
    }

    // Get memory banks to archive
    const memoryBanksToArchive: string[] = [];
    for (const wt of toRemove) {
      if (wt.worktreeId) {
        const memoryBankPath = path.join(wt.path, '.memory-bank');
        if (await fs.pathExists(memoryBankPath)) {
          memoryBanksToArchive.push(wt.worktreeId);
        }
      }
    }

    return {
      toRemove,
      toSkip,
      removalReasons,
      skipReasons,
      estimatedFreedBytes,
      memoryBanksToArchive,
    };
  }

  /**
   * Forcefully removes a specific worktree.
   *
   * WARNING: This bypasses safety checks. Use with caution.
   *
   * @param worktreePath - Path to the worktree to remove
   * @throws Error if removal fails
   */
  async forceCleanup(worktreePath: string): Promise<void> {
    this.log(`Force cleaning up worktree: ${worktreePath}`);

    // Archive memory bank before force cleanup
    const worktreeId = this.extractWorktreeId(worktreePath);
    if (worktreeId) {
      await this.archiveMemoryBank(worktreeId);
    }

    await this.removeWorktree(worktreePath, true);
    this.log(`Successfully force removed worktree: ${worktreePath}`);
  }

  // ==================== Private Helper Methods ====================

  /**
   * Gets all worktrees that are considered stale.
   */
  private async getStaleWorktrees(): Promise<WorktreeInfo[]> {
    const allWorktrees = await this.listWorktrees();
    const now = Date.now();

    return allWorktrees.filter(wt => {
      if (wt.isMain || !wt.lastModified) {
        return false;
      }
      const age = now - wt.lastModified.getTime();
      return age > this.staleThresholdMs;
    });
  }

  /**
   * Gets all worktrees whose branches have been merged.
   */
  private async getMergedWorktrees(
    remoteBranch: string = 'origin/main'
  ): Promise<WorktreeInfo[]> {
    const allWorktrees = await this.listWorktrees();
    const mergedWorktrees: WorktreeInfo[] = [];

    for (const wt of allWorktrees) {
      if (wt.isMain) {
        continue;
      }

      try {
        // Check if the branch has been merged into the remote branch
        const { stdout } = await execAsync(
          `git branch --merged ${remoteBranch} | grep -E "^\\s*${wt.branch}$"`,
          { cwd: this.config.repoRoot }
        );

        if (stdout.trim()) {
          mergedWorktrees.push(wt);
        }
      } catch {
        // Branch not merged or doesn't exist, skip
      }
    }

    return mergedWorktrees;
  }

  /**
   * Gets all orphaned worktrees (worktrees without valid branch references).
   */
  private async getOrphanedWorktrees(): Promise<WorktreeInfo[]> {
    const allWorktrees = await this.listWorktrees();
    const orphanedWorktrees: WorktreeInfo[] = [];

    for (const wt of allWorktrees) {
      if (wt.isMain) {
        continue;
      }

      // Check if worktree directory exists but is broken
      const exists = await fs.pathExists(wt.path);
      if (!exists) {
        orphanedWorktrees.push(wt);
        continue;
      }

      // Check if branch still exists
      try {
        await execAsync(`git rev-parse --verify ${wt.branch}`, {
          cwd: this.config.repoRoot,
        });
      } catch {
        // Branch doesn't exist, worktree is orphaned
        orphanedWorktrees.push(wt);
      }
    }

    return orphanedWorktrees;
  }

  /**
   * Removes a worktree using git worktree remove.
   */
  private async removeWorktree(
    worktreePath: string,
    force: boolean
  ): Promise<void> {
    const forceFlag = force ? '--force' : '';

    try {
      await execAsync(`git worktree remove ${forceFlag} "${worktreePath}"`, {
        cwd: this.config.repoRoot,
      });
    } catch (error) {
      // If git worktree remove fails, try manual cleanup
      if (force) {
        await fs.remove(worktreePath);
        await execAsync('git worktree prune', { cwd: this.config.repoRoot });
      } else {
        throw error;
      }
    }
  }

  /**
   * Archives the memory bank for a worktree before cleanup.
   */
  private async archiveMemoryBank(worktreeId: string): Promise<void> {
    const memoryBankPath = path.join(
      this.config.worktreeBasePath,
      worktreeId,
      '.memory-bank'
    );

    if (!(await fs.pathExists(memoryBankPath))) {
      this.log(`No memory bank found for worktree: ${worktreeId}`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(
      this.config.memoryBankArchivePath,
      `${worktreeId}-${timestamp}`
    );

    await fs.ensureDir(this.config.memoryBankArchivePath);
    await fs.copy(memoryBankPath, archivePath);

    this.log(`Archived memory bank: ${worktreeId} -> ${archivePath}`);
  }

  /**
   * Lists all worktrees in the repository.
   */
  private async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.config.repoRoot,
      });

      const worktrees: WorktreeInfo[] = [];
      const entries = stdout.split('\n\n').filter(Boolean);

      for (const entry of entries) {
        const lines = entry.split('\n');
        const info: Partial<WorktreeInfo> = {
          isMain: false,
          isLocked: false,
        };

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            info.path = line.substring('worktree '.length).trim();
          } else if (line.startsWith('HEAD ')) {
            info.commit = line.substring('HEAD '.length).trim();
          } else if (line.startsWith('branch ')) {
            info.branch = line
              .substring('branch '.length)
              .trim()
              .replace('refs/heads/', '');
          } else if (line === 'bare') {
            info.isMain = true;
          } else if (line === 'locked') {
            info.isLocked = true;
          }
        }

        if (info.path) {
          // Get last modified time
          try {
            const stats = await fs.stat(info.path);
            info.lastModified = stats.mtime;
          } catch {
            // Path might not exist for orphaned worktrees
          }

          // Check if this is the main worktree
          if (info.path === this.config.repoRoot) {
            info.isMain = true;
          }

          // Extract worktree ID
          info.worktreeId = this.extractWorktreeId(info.path!);

          worktrees.push(info as WorktreeInfo);
        }
      }

      return worktrees;
    } catch (error) {
      this.log(
        `Error listing worktrees: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Checks if a worktree has uncommitted changes.
   */
  private async checkUncommittedChanges(
    worktreePath: string
  ): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
      });
      return stdout.trim().length > 0;
    } catch {
      // If we can't check, assume there are changes for safety
      return true;
    }
  }

  /**
   * Gets the size of a directory in bytes.
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        totalSize += await this.getDirectorySize(itemPath);
      } else {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  /**
   * Extracts worktree ID from path.
   */
  private extractWorktreeId(worktreePath: string): string | undefined {
    const basename = path.basename(worktreePath);
    // Pattern: agentType-timestamp
    const match = basename.match(/^(.+-\d+)$/);
    return match ? match[1] : basename;
  }

  /**
   * Performs cleanup on a list of worktrees.
   */
  private async performCleanup(
    worktrees: WorktreeInfo[],
    reason: string
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      removedCount: 0,
      removedPaths: [],
      skippedPaths: [],
      skipReasons: new Map(),
      errors: [],
      memoryBanksArchived: false,
    };

    let freedBytes = 0;

    for (const wt of worktrees) {
      // Safety check: Never remove main worktree
      if (wt.isMain) {
        result.skippedPaths.push(wt.path);
        result.skipReasons.set(wt.path, 'main worktree cannot be removed');
        continue;
      }

      // Safety check: Never remove locked worktrees
      if (wt.isLocked) {
        result.skippedPaths.push(wt.path);
        result.skipReasons.set(wt.path, 'worktree is locked');
        continue;
      }

      // Safety check: Never remove worktrees with uncommitted changes
      const hasChanges = await this.checkUncommittedChanges(wt.path);
      if (hasChanges) {
        result.skippedPaths.push(wt.path);
        result.skipReasons.set(wt.path, 'has uncommitted changes');
        continue;
      }

      try {
        // Get size before removal for stats
        let size = 0;
        try {
          size = await this.getDirectorySize(wt.path);
        } catch {
          // Ignore size errors
        }

        // Archive memory bank before cleanup
        if (wt.worktreeId) {
          await this.archiveMemoryBank(wt.worktreeId);
          result.memoryBanksArchived = true;
        }

        // Remove the worktree
        await this.removeWorktree(wt.path, false);

        result.removedCount++;
        result.removedPaths.push(wt.path);
        freedBytes += size;

        this.log(`Removed ${reason} worktree: ${wt.path}`);
      } catch (error) {
        result.success = false;
        result.errors.push({
          path: wt.path,
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    result.freedBytes = freedBytes;

    this.log(
      `Cleanup complete: removed ${result.removedCount}, ` +
        `skipped ${result.skippedPaths.length}, ` +
        `errors ${result.errors.length}`
    );

    return result;
  }

  /**
   * Creates an empty cleanup result.
   */
  private createEmptyResult(): CleanupResult {
    return {
      success: true,
      removedCount: 0,
      removedPaths: [],
      skippedPaths: [],
      skipReasons: new Map(),
      errors: [],
      memoryBanksArchived: false,
    };
  }

  /**
   * Logs a message if verbose mode is enabled.
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[WorktreeCleanup] ${new Date().toISOString()} - ${message}`);
    }
  }
}

/**
 * Schedule configuration for automatic cleanup
 */
export interface ScheduleConfig {
  /** Interval in milliseconds between cleanup runs */
  intervalMs: number;
  /** Whether to run stale cleanup */
  cleanStale?: boolean;
  /** Whether to run merged cleanup */
  cleanMerged?: boolean;
  /** Whether to run orphaned cleanup */
  cleanOrphaned?: boolean;
  /** Maximum age in days for age-based cleanup */
  maxAgeDays?: number;
  /** Remote branch for merged check */
  remoteBranch?: string;
}

/**
 * Scheduled cleanup handle
 */
export interface ScheduledCleanup {
  /** Stop the scheduled cleanup */
  stop: () => void;
  /** Run cleanup immediately */
  runNow: () => Promise<CleanupResult[]>;
  /** Get the last run results */
  getLastResults: () => CleanupResult[];
}

/**
 * Schedules automatic worktree cleanup at regular intervals.
 *
 * @param cleanupConfig - Configuration for the WorktreeCleanup instance
 * @param scheduleConfig - Configuration for scheduling
 * @returns Handle to control the scheduled cleanup
 *
 * @example
 * ```typescript
 * const scheduled = scheduleCleanup(
 *   { worktreeBasePath: '/path/to/worktrees' },
 *   {
 *     intervalMs: 24 * 60 * 60 * 1000, // Daily
 *     cleanStale: true,
 *     cleanMerged: true,
 *   }
 * );
 *
 * // Stop when done
 * scheduled.stop();
 * ```
 */
export function scheduleCleanup(
  cleanupConfig: CleanupConfig,
  scheduleConfig: ScheduleConfig
): ScheduledCleanup {
  const cleanup = new WorktreeCleanup(cleanupConfig);
  let lastResults: CleanupResult[] = [];
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const runCleanup = async (): Promise<CleanupResult[]> => {
    const results: CleanupResult[] = [];

    if (scheduleConfig.cleanStale !== false) {
      results.push(await cleanup.cleanupStale());
    }

    if (scheduleConfig.cleanMerged) {
      results.push(await cleanup.cleanupMerged(scheduleConfig.remoteBranch));
    }

    if (scheduleConfig.cleanOrphaned) {
      results.push(await cleanup.cleanupOrphaned());
    }

    if (scheduleConfig.maxAgeDays !== undefined) {
      results.push(await cleanup.cleanupByAge(scheduleConfig.maxAgeDays));
    }

    lastResults = results;
    return results;
  };

  // Start the interval
  intervalHandle = setInterval(runCleanup, scheduleConfig.intervalMs);

  return {
    stop: () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },
    runNow: runCleanup,
    getLastResults: () => [...lastResults],
  };
}

export { DEFAULT_STALE_THRESHOLD_MS };
