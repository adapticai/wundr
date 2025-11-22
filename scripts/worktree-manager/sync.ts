/**
 * Worktree Branch Synchronization Manager
 *
 * Implements branch synchronization for git worktrees in the three-tier
 * architecture. This module handles:
 * - Syncing worktrees from remote (Session Manager only)
 * - Rebasing branches onto base branch
 * - Checking sync status (behind/ahead counts)
 * - Resolving merge conflicts with configurable strategies
 *
 * Key design principle: Only the Session Manager syncs with remote to
 * prevent Git index lock contention among sub-agents.
 *
 * @module scripts/worktree-manager/sync
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for the WorktreeSync manager
 */
export interface SyncConfig {
  /** Path to the main git repository */
  repoPath: string;
  /** Root directory containing worktrees */
  worktreeRoot?: string;
  /** Remote origin name (default: 'origin') */
  remoteOrigin?: string;
  /** Default base branch for rebasing (default: 'main') */
  defaultBaseBranch?: string;
  /** Timeout for git operations in milliseconds (default: 30000) */
  operationTimeout?: number;
  /** Whether to automatically stash uncommitted changes before sync (default: true) */
  autoStash?: boolean;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Path to the worktree that was synced */
  worktreePath: string;
  /** Branch name that was synced */
  branchName?: string;
  /** Whether uncommitted changes were stashed/unstashed */
  stashedChanges?: boolean;
  /** Number of commits pulled/rebased */
  commitsUpdated?: number;
  /** Error details if operation failed */
  error?: Error;
  /** Timestamp of the operation */
  timestamp: Date;
}

/**
 * Status of a worktree's synchronization with remote
 */
export interface SyncStatus {
  /** Path to the worktree */
  worktreePath: string;
  /** Branch name */
  branchName: string;
  /** Number of commits behind the remote */
  behindCount: number;
  /** Number of commits ahead of the remote */
  aheadCount: number;
  /** Whether there are uncommitted changes in the working directory */
  hasUncommittedChanges: boolean;
  /** Whether there are staged changes */
  hasStagedChanges: boolean;
  /** Timestamp of the last successful sync */
  lastSyncTimestamp: Date | null;
  /** List of files with conflicts (if any) */
  conflicts: ConflictInfo[];
  /** Whether the branch is tracking a remote branch */
  hasRemoteTracking: boolean;
  /** Name of the tracked remote branch (if any) */
  trackedRemoteBranch?: string;
}

/**
 * Information about a conflicted file
 */
export interface ConflictInfo {
  /** Path to the conflicted file relative to worktree root */
  filePath: string;
  /** Type of conflict */
  conflictType:
    | 'both-modified'
    | 'deleted-by-them'
    | 'deleted-by-us'
    | 'both-added';
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown for sync-related operations
 */
export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly worktreePath?: string
  ) {
    super(message);
    this.name = 'SyncError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ============================================================================
// WorktreeSync Class
// ============================================================================

/**
 * Manages branch synchronization for git worktrees.
 *
 * Implements safe sync patterns for the three-tier architecture:
 * - Only Session Manager should call syncFromRemote (prevents lock contention)
 * - Sub-agents can call checkSyncStatus (read-only operations)
 * - Automatic stash/unstash for uncommitted changes
 *
 * @example
 * ```typescript
 * const sync = new WorktreeSync({
 *   repoPath: '/path/to/repo',
 *   worktreeRoot: '/path/to/repo/.git-worktrees',
 * });
 *
 * // Check if a worktree needs syncing
 * const status = await sync.checkSyncStatus('/path/to/worktree');
 * if (status.behindCount > 0) {
 *   const result = await sync.syncFromRemote('/path/to/worktree');
 * }
 * ```
 */
export class WorktreeSync {
  private readonly config: Required<SyncConfig>;
  private remoteOrigin: string;
  private syncTimestamps: Map<string, Date> = new Map();

  constructor(config: SyncConfig) {
    this.config = {
      repoPath: config.repoPath,
      worktreeRoot:
        config.worktreeRoot || path.join(config.repoPath, '.git-worktrees'),
      remoteOrigin: config.remoteOrigin || 'origin',
      defaultBaseBranch: config.defaultBaseBranch || 'main',
      operationTimeout: config.operationTimeout || 30000,
      autoStash: config.autoStash ?? true,
    };
    this.remoteOrigin = this.config.remoteOrigin;
  }

  // ==========================================================================
  // Public Methods - Core API
  // ==========================================================================

  /**
   * Sync a worktree from the remote repository.
   *
   * This method:
   * 1. Stashes any uncommitted changes (if autoStash enabled)
   * 2. Fetches latest from remote
   * 3. Pulls/merges changes
   * 4. Restores stashed changes
   *
   * IMPORTANT: Only the Session Manager should call this method to prevent
   * Git index lock contention among parallel agents.
   *
   * @param worktreePath - Absolute path to the worktree
   * @returns SyncResult with operation details
   *
   * @example
   * ```typescript
   * const result = await sync.syncFromRemote('/path/to/worktree');
   * if (result.success) {
   *   console.log(`Synced ${result.commitsUpdated} commits`);
   * }
   * ```
   */
  async syncFromRemote(worktreePath: string): Promise<SyncResult> {
    const timestamp = new Date();
    let stashedChanges = false;
    let branchName: string | undefined;

    try {
      // Verify worktree exists
      await this.verifyWorktreePath(worktreePath);

      // Get current branch
      branchName = await this.getCurrentBranch(worktreePath);

      // Check for uncommitted changes
      const hasUncommitted = await this.hasUncommittedChanges(worktreePath);

      // Stash uncommitted changes if needed
      if (hasUncommitted && this.config.autoStash) {
        await this.stashChanges(worktreePath, 'auto-stash before sync');
        stashedChanges = true;
      } else if (hasUncommitted) {
        return {
          success: false,
          message: 'Uncommitted changes present and autoStash disabled',
          worktreePath,
          branchName,
          stashedChanges: false,
          timestamp,
          error: new SyncError(
            'Uncommitted changes would be overwritten',
            'UNCOMMITTED_CHANGES',
            worktreePath
          ),
        };
      }

      // Fetch from remote
      await this.executeGitCommand('fetch', [this.remoteOrigin], worktreePath);

      // Get ahead/behind count before pull
      const statusBefore = await this.checkSyncStatus(worktreePath);
      const commitsBefore = statusBefore.behindCount;

      // Pull changes (fast-forward only to be safe)
      try {
        await this.executeGitCommand(
          'pull',
          ['--ff-only', this.remoteOrigin, branchName],
          worktreePath
        );
      } catch (error) {
        // Fast-forward failed, might need rebase
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Not possible to fast-forward')) {
          return {
            success: false,
            message:
              'Fast-forward not possible. Consider using rebaseOntoBase.',
            worktreePath,
            branchName,
            stashedChanges,
            timestamp,
            error: new SyncError(
              'Fast-forward merge not possible',
              'FF_NOT_POSSIBLE',
              worktreePath
            ),
          };
        }
        throw error;
      }

      // Restore stashed changes
      if (stashedChanges) {
        try {
          await this.unstashChanges(worktreePath);
        } catch (error) {
          // Stash might have conflicts
          return {
            success: false,
            message:
              'Sync succeeded but stash could not be restored. Check for conflicts.',
            worktreePath,
            branchName,
            stashedChanges: true,
            commitsUpdated: commitsBefore,
            timestamp,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }

      // Record sync timestamp
      this.syncTimestamps.set(worktreePath, timestamp);

      return {
        success: true,
        message: `Successfully synced ${commitsBefore} commit(s) from ${this.remoteOrigin}/${branchName}`,
        worktreePath,
        branchName,
        stashedChanges,
        commitsUpdated: commitsBefore,
        timestamp,
      };
    } catch (error) {
      // Restore stash on failure
      if (stashedChanges) {
        try {
          await this.unstashChanges(worktreePath);
        } catch {
          // Ignore unstash errors during cleanup
        }
      }

      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        worktreePath,
        branchName,
        stashedChanges,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Sync all worktrees in the worktree root directory.
   *
   * Iterates through all worktrees and syncs them sequentially to avoid
   * overwhelming git with concurrent operations.
   *
   * @returns Array of SyncResult for each worktree
   *
   * @example
   * ```typescript
   * const results = await sync.syncAllWorktrees();
   * const failed = results.filter(r => !r.success);
   * if (failed.length > 0) {
   *   console.error(`${failed.length} worktrees failed to sync`);
   * }
   * ```
   */
  async syncAllWorktrees(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    // Get list of worktrees
    const worktrees = await this.listWorktrees();

    // Sync each worktree sequentially
    for (const worktree of worktrees) {
      // Skip main worktree (the main repo itself)
      if (worktree.path === this.config.repoPath) {
        continue;
      }

      const result = await this.syncFromRemote(worktree.path);
      results.push(result);
    }

    return results;
  }

  /**
   * Rebase a worktree's branch onto a base branch.
   *
   * This is useful when fast-forward merges aren't possible.
   * The method:
   * 1. Stashes uncommitted changes
   * 2. Fetches the base branch from remote
   * 3. Rebases onto the base branch
   * 4. Restores stashed changes
   *
   * @param worktreePath - Absolute path to the worktree
   * @param baseBranch - Branch to rebase onto (default: configured defaultBaseBranch)
   * @returns SyncResult with operation details
   *
   * @example
   * ```typescript
   * const result = await sync.rebaseOntoBase('/path/to/worktree', 'main');
   * if (!result.success && result.message.includes('conflict')) {
   *   await sync.resolveConflicts('/path/to/worktree', 'ours');
   * }
   * ```
   */
  async rebaseOntoBase(
    worktreePath: string,
    baseBranch?: string
  ): Promise<SyncResult> {
    const timestamp = new Date();
    const effectiveBaseBranch = baseBranch || this.config.defaultBaseBranch;
    let stashedChanges = false;
    let branchName: string | undefined;

    try {
      // Verify worktree exists
      await this.verifyWorktreePath(worktreePath);

      // Get current branch
      branchName = await this.getCurrentBranch(worktreePath);

      // Check for uncommitted changes
      const hasUncommitted = await this.hasUncommittedChanges(worktreePath);

      // Stash uncommitted changes if needed
      if (hasUncommitted && this.config.autoStash) {
        await this.stashChanges(worktreePath, 'auto-stash before rebase');
        stashedChanges = true;
      } else if (hasUncommitted) {
        return {
          success: false,
          message: 'Uncommitted changes present and autoStash disabled',
          worktreePath,
          branchName,
          stashedChanges: false,
          timestamp,
          error: new SyncError(
            'Cannot rebase with uncommitted changes',
            'UNCOMMITTED_CHANGES',
            worktreePath
          ),
        };
      }

      // Fetch the base branch from remote
      await this.executeGitCommand(
        'fetch',
        [this.remoteOrigin, effectiveBaseBranch],
        worktreePath
      );

      // Count commits that will be rebased
      const { stdout: commitCountOutput } = await execAsync(
        `git rev-list --count ${this.remoteOrigin}/${effectiveBaseBranch}..HEAD`,
        { cwd: worktreePath, timeout: this.config.operationTimeout }
      );
      const commitsToRebase = parseInt(commitCountOutput.trim(), 10) || 0;

      // Perform the rebase
      try {
        await this.executeGitCommand(
          'rebase',
          [`${this.remoteOrigin}/${effectiveBaseBranch}`],
          worktreePath
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check if there are conflicts
        if (
          errorMessage.includes('CONFLICT') ||
          errorMessage.includes('conflict')
        ) {
          return {
            success: false,
            message:
              'Rebase conflicts detected. Use resolveConflicts() to resolve.',
            worktreePath,
            branchName,
            stashedChanges,
            timestamp,
            error: new SyncError(
              'Rebase conflicts',
              'REBASE_CONFLICT',
              worktreePath
            ),
          };
        }
        throw error;
      }

      // Restore stashed changes
      if (stashedChanges) {
        try {
          await this.unstashChanges(worktreePath);
        } catch (error) {
          return {
            success: false,
            message:
              'Rebase succeeded but stash could not be restored. Check for conflicts.',
            worktreePath,
            branchName,
            stashedChanges: true,
            commitsUpdated: commitsToRebase,
            timestamp,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }

      // Record sync timestamp
      this.syncTimestamps.set(worktreePath, timestamp);

      return {
        success: true,
        message: `Successfully rebased ${commitsToRebase} commit(s) onto ${this.remoteOrigin}/${effectiveBaseBranch}`,
        worktreePath,
        branchName,
        stashedChanges,
        commitsUpdated: commitsToRebase,
        timestamp,
      };
    } catch (error) {
      // Abort rebase on failure
      try {
        await this.executeGitCommand('rebase', ['--abort'], worktreePath);
      } catch {
        // Ignore abort errors
      }

      // Restore stash on failure
      if (stashedChanges) {
        try {
          await this.unstashChanges(worktreePath);
        } catch {
          // Ignore unstash errors during cleanup
        }
      }

      return {
        success: false,
        message: `Rebase failed: ${error instanceof Error ? error.message : String(error)}`,
        worktreePath,
        branchName,
        stashedChanges,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check the synchronization status of a worktree.
   *
   * This is a read-only operation that can be safely called by any agent.
   * It checks:
   * - How many commits behind/ahead of remote
   * - Whether there are uncommitted changes
   * - Whether there are merge conflicts
   *
   * @param worktreePath - Absolute path to the worktree
   * @returns SyncStatus with detailed status information
   *
   * @example
   * ```typescript
   * const status = await sync.checkSyncStatus('/path/to/worktree');
   * if (status.behindCount > 0) {
   *   console.log(`Worktree is ${status.behindCount} commits behind`);
   * }
   * if (status.conflicts.length > 0) {
   *   console.log(`${status.conflicts.length} files have conflicts`);
   * }
   * ```
   */
  async checkSyncStatus(worktreePath: string): Promise<SyncStatus> {
    // Verify worktree exists
    await this.verifyWorktreePath(worktreePath);

    // Get current branch
    const branchName = await this.getCurrentBranch(worktreePath);

    // Check for remote tracking
    let hasRemoteTracking = false;
    let trackedRemoteBranch: string | undefined;
    let behindCount = 0;
    let aheadCount = 0;

    try {
      const { stdout: trackingBranch } = await execAsync(
        'git rev-parse --abbrev-ref --symbolic-full-name @{u}',
        { cwd: worktreePath, timeout: this.config.operationTimeout }
      );
      trackedRemoteBranch = trackingBranch.trim();
      hasRemoteTracking = !!trackedRemoteBranch;

      if (hasRemoteTracking) {
        // Get behind/ahead count
        const { stdout: countOutput } = await execAsync(
          `git rev-list --left-right --count ${trackedRemoteBranch}...HEAD`,
          { cwd: worktreePath, timeout: this.config.operationTimeout }
        );
        const counts = countOutput.trim().split(/\s+/);
        if (counts.length >= 2) {
          behindCount = parseInt(counts[0], 10) || 0;
          aheadCount = parseInt(counts[1], 10) || 0;
        }
      }
    } catch {
      // No remote tracking branch or other error
      hasRemoteTracking = false;
    }

    // Check for uncommitted changes
    const hasUncommittedChanges =
      await this.hasUncommittedChanges(worktreePath);

    // Check for staged changes
    const hasStagedChanges = await this.hasStagedChanges(worktreePath);

    // Check for conflicts
    const conflicts = await this.getConflicts(worktreePath);

    // Get last sync timestamp from our cache
    const lastSyncTimestamp = this.syncTimestamps.get(worktreePath) || null;

    return {
      worktreePath,
      branchName,
      behindCount,
      aheadCount,
      hasUncommittedChanges,
      hasStagedChanges,
      lastSyncTimestamp,
      conflicts,
      hasRemoteTracking,
      trackedRemoteBranch,
    };
  }

  /**
   * Resolve merge/rebase conflicts using a specified strategy.
   *
   * @param worktreePath - Absolute path to the worktree
   * @param strategy - Resolution strategy: 'ours' keeps our changes, 'theirs' accepts remote changes
   *
   * @example
   * ```typescript
   * // Accept all remote changes
   * await sync.resolveConflicts('/path/to/worktree', 'theirs');
   *
   * // Keep all our local changes
   * await sync.resolveConflicts('/path/to/worktree', 'ours');
   * ```
   */
  async resolveConflicts(
    worktreePath: string,
    strategy: 'ours' | 'theirs'
  ): Promise<void> {
    // Verify worktree exists
    await this.verifyWorktreePath(worktreePath);

    // Get list of conflicted files
    const conflicts = await this.getConflicts(worktreePath);

    if (conflicts.length === 0) {
      return; // No conflicts to resolve
    }

    // Check if we're in a rebase or merge state
    const isRebasing = await this.isRebasing(worktreePath);
    const isMerging = await this.isMerging(worktreePath);

    if (!isRebasing && !isMerging) {
      throw new SyncError(
        'No rebase or merge in progress',
        'NO_CONFLICT_STATE',
        worktreePath
      );
    }

    // Resolve each conflicted file
    for (const conflict of conflicts) {
      const checkoutOption = strategy === 'ours' ? '--ours' : '--theirs';

      await this.executeGitCommand(
        'checkout',
        [checkoutOption, '--', conflict.filePath],
        worktreePath
      );

      // Stage the resolved file
      await this.executeGitCommand('add', [conflict.filePath], worktreePath);
    }

    // Continue the rebase or conclude the merge
    if (isRebasing) {
      try {
        await this.executeGitCommand('rebase', ['--continue'], worktreePath);
      } catch (error) {
        // Rebase continue might need more resolution
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('CONFLICT')) {
          // Recursive call if more conflicts appear
          await this.resolveConflicts(worktreePath, strategy);
        } else {
          throw error;
        }
      }
    } else if (isMerging) {
      // For merge, we need to commit
      await this.executeGitCommand(
        'commit',
        ['-m', `Resolve conflicts using ${strategy} strategy`],
        worktreePath
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Verify that a worktree path exists and is valid
   */
  private async verifyWorktreePath(worktreePath: string): Promise<void> {
    try {
      const stat = await fsPromises.stat(worktreePath);
      if (!stat.isDirectory()) {
        throw new SyncError(
          'Path is not a directory',
          'NOT_A_DIRECTORY',
          worktreePath
        );
      }

      // Verify it's a git worktree
      const gitDir = path.join(worktreePath, '.git');
      await fsPromises.access(gitDir);
    } catch (error) {
      if (error instanceof SyncError) {
        throw error;
      }
      throw new SyncError(
        `Invalid worktree path: ${worktreePath}`,
        'INVALID_WORKTREE',
        worktreePath
      );
    }
  }

  /**
   * Execute a git command with proper error handling and timeout
   */
  private async executeGitCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<string> {
    const fullCommand = `git ${command} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd,
        timeout: this.config.operationTimeout,
      });

      if (
        stderr &&
        !stderr.includes('warning') &&
        !stderr.includes('Updating')
      ) {
        // Some git commands output progress to stderr
      }

      return stdout.trim();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Git command failed: ${fullCommand}\n${errorMessage}`);
    }
  }

  /**
   * Get the current branch name for a worktree
   */
  private async getCurrentBranch(worktreePath: string): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: worktreePath,
      timeout: this.config.operationTimeout,
    });
    return stdout.trim();
  }

  /**
   * Check if there are uncommitted changes (working directory)
   */
  private async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
        timeout: this.config.operationTimeout,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if there are staged changes
   */
  private async hasStagedChanges(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        'git diff --cached --quiet || echo "staged"',
        { cwd: worktreePath, timeout: this.config.operationTimeout }
      );
      return stdout.includes('staged');
    } catch {
      return true; // Assume staged if command fails
    }
  }

  /**
   * Get list of conflicted files
   */
  private async getConflicts(worktreePath: string): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      const { stdout } = await execAsync(
        'git diff --name-only --diff-filter=U',
        { cwd: worktreePath, timeout: this.config.operationTimeout }
      );

      const conflictedFiles = stdout.trim().split('\n').filter(Boolean);

      for (const filePath of conflictedFiles) {
        // Determine conflict type by checking git status
        const { stdout: statusOutput } = await execAsync(
          `git status --porcelain -- "${filePath}"`,
          { cwd: worktreePath, timeout: this.config.operationTimeout }
        );

        let conflictType: ConflictInfo['conflictType'] = 'both-modified';
        const status = statusOutput.substring(0, 2);

        if (status === 'DD') {
          conflictType = 'both-modified';
        } else if (status === 'AU' || status === 'UD') {
          conflictType = 'deleted-by-them';
        } else if (status === 'UA' || status === 'DU') {
          conflictType = 'deleted-by-us';
        } else if (status === 'AA') {
          conflictType = 'both-added';
        } else if (status === 'UU') {
          conflictType = 'both-modified';
        }

        conflicts.push({ filePath, conflictType });
      }
    } catch {
      // No conflicts or git command failed
    }

    return conflicts;
  }

  /**
   * Stash uncommitted changes
   */
  private async stashChanges(
    worktreePath: string,
    message: string
  ): Promise<void> {
    await this.executeGitCommand(
      'stash',
      ['push', '-m', `"${message}"`],
      worktreePath
    );
  }

  /**
   * Restore stashed changes
   */
  private async unstashChanges(worktreePath: string): Promise<void> {
    await this.executeGitCommand('stash', ['pop'], worktreePath);
  }

  /**
   * Check if a rebase is in progress
   */
  private async isRebasing(worktreePath: string): Promise<boolean> {
    const rebaseDir = path.join(worktreePath, '.git', 'rebase-merge');
    const rebaseApplyDir = path.join(worktreePath, '.git', 'rebase-apply');

    try {
      await fsPromises.access(rebaseDir);
      return true;
    } catch {
      try {
        await fsPromises.access(rebaseApplyDir);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if a merge is in progress
   */
  private async isMerging(worktreePath: string): Promise<boolean> {
    const mergeHead = path.join(worktreePath, '.git', 'MERGE_HEAD');

    try {
      await fsPromises.access(mergeHead);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all worktrees for the repository
   */
  private async listWorktrees(): Promise<{ path: string; branch: string }[]> {
    const worktrees: { path: string; branch: string }[] = [];

    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.config.repoPath,
        timeout: this.config.operationTimeout,
      });

      const lines = stdout.split('\n');
      let currentWorktree: { path: string; branch: string } | null = null;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = {
            path: line.substring('worktree '.length),
            branch: '',
          };
        } else if (line.startsWith('branch ') && currentWorktree) {
          currentWorktree.branch = line.substring('branch refs/heads/'.length);
        }
      }

      if (currentWorktree) {
        worktrees.push(currentWorktree);
      }
    } catch {
      // Return empty list if git command fails
    }

    return worktrees;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WorktreeSync instance
 *
 * @param config - Configuration options
 * @returns Configured WorktreeSync instance
 *
 * @example
 * ```typescript
 * const sync = createWorktreeSync({
 *   repoPath: '/path/to/repo',
 *   remoteOrigin: 'origin',
 *   defaultBaseBranch: 'main',
 *   autoStash: true,
 * });
 *
 * // Session Manager: Sync from remote
 * const result = await sync.syncFromRemote('/path/to/worktree');
 *
 * // Any agent: Check status (read-only)
 * const status = await sync.checkSyncStatus('/path/to/worktree');
 * ```
 */
export function createWorktreeSync(config: SyncConfig): WorktreeSync {
  return new WorktreeSync(config);
}

// ============================================================================
// Exports
// ============================================================================

export default WorktreeSync;
