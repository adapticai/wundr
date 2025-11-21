/**
 * Git-Worktree MCP Tool Handlers
 *
 * Exposes git-worktree management functionality as MCP tools for
 * Claude Code Agent coordination and parallel development workflows.
 *
 * Tools provided:
 * - create_agent_worktree: Create isolated worktree for an agent
 * - merge_agent_work: Merge completed agent work back to target branch
 * - cleanup_worktree: Clean up a specific worktree and its branch
 * - worktree_status: Get comprehensive status of all worktrees
 * - cleanup_all_merged: Bulk cleanup of all merged agent worktrees
 */

import * as path from 'path';

import {
  // Types
  GitRepositoryInfo,
  WorktreeInfo,
  BranchInfo,

  // Core functions
  execGit,
  getRepositoryInfo,
  getWorktreeBasePath,
  generateWorktreeName,
  generateBranchName,

  // Branch operations
  branchExists,
  isBranchMerged,
  getBranchInfo,
  isBranchInWorktree,
  deleteBranch,
  getMergedAgentBranches,

  // Worktree operations
  listWorktrees,
  worktreeExists,
  worktreeDirectoryExists,
  createWorktree,
  removeWorktree,
  pruneWorktrees,
  getUncommittedChanges,

  // Registry operations
  initializeRegistry,
  readRegistry,
  addRegistryEntry,
  updateRegistryStatus,
  getRegistryStats,

  // Metadata operations
  createAgentMetadata,
  readAgentMetadata,

  // Disk space
  checkDiskSpace,
  getDirectorySize,

  // Validation
  validateGitRepository,
  validateWorktreeParams,
  validateMergeStrategy,
} from './git-helpers.js';

import type {
  WorktreeMetadata,
  RegistryEntry} from './git-helpers.js';

// ============================================================================
// MCP Tool Argument Types
// ============================================================================

export interface CreateAgentWorktreeArgs {
  agentType: string;
  taskId: string;
  baseBranch?: string;
}

export interface MergeAgentWorkArgs {
  worktreeName: string;
  targetBranch?: string;
  mergeStrategy?: 'no-ff' | 'squash' | 'rebase';
  autoCommit?: boolean;
}

export interface CleanupWorktreeArgs {
  worktreeName: string;
  force?: boolean;
}

export interface WorktreeStatusArgs {
  detailed?: boolean;
  format?: 'json' | 'text';
}

export interface CleanupAllMergedArgs {
  targetBranch?: string;
  dryRun?: boolean;
}

// ============================================================================
// MCP Tool Result Types
// ============================================================================

export interface MCPToolResult {
  success: boolean;
  message: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface CreateWorktreeResult extends MCPToolResult {
  data?: {
    worktreeName: string;
    worktreePath: string;
    branchName: string;
    agentType: string;
    taskId: string;
    baseBranch: string;
    created: string;
  };
}

export interface MergeResult extends MCPToolResult {
  data?: {
    worktreeName: string;
    branchName: string;
    targetBranch: string;
    mergeStrategy: string;
    commitsmerged: number;
    conflicted?: boolean;
    conflictFiles?: string[];
  };
}

export interface CleanupResult extends MCPToolResult {
  data?: {
    worktreeName: string;
    branchName: string;
    wasMerged: boolean;
    forceCleanup: boolean;
  };
}

export interface StatusResult extends MCPToolResult {
  data?: {
    repository: {
      root: string;
      currentBranch: string;
      hasUncommittedChanges: boolean;
    };
    registry: {
      total: number;
      active: number;
      merged: number;
      cleaned: number;
      byAgent: Record<string, number>;
    };
    worktrees: Array<{
      name: string;
      path: string;
      branch: string | null;
      isDetached: boolean;
      uncommittedChanges: number;
      isMerged: boolean;
      commitsAhead: number;
      metadata?: WorktreeMetadata;
      diskSize: string;
    }>;
    maintenance: {
      staleWorktrees: boolean;
      mergedBranchesToClean: number;
      gitRepoSize: string;
    };
  };
}

export interface CleanupAllResult extends MCPToolResult {
  data?: {
    dryRun: boolean;
    targetBranch: string;
    branchesFound: number;
    cleaned: number;
    failed: number;
    skipped: number;
    details: Array<{
      worktreeName: string;
      branch: string;
      status: 'cleaned' | 'failed' | 'skipped';
      reason?: string;
    }>;
  };
}

// ============================================================================
// Tool Handler Class
// ============================================================================

export class GitWorktreeHandler {
  /**
   * Create a new isolated worktree for a Claude Code agent
   */
  async createAgentWorktree(args: CreateAgentWorktreeArgs): Promise<string> {
    const { agentType, taskId, baseBranch = 'master' } = args;

    // Validate repository
    const repoValidation = validateGitRepository();
    if (!repoValidation.valid || !repoValidation.repoRoot) {
      return this.formatError('Repository validation failed', repoValidation.error);
    }

    const repoRoot = repoValidation.repoRoot;

    // Validate parameters
    const paramValidation = validateWorktreeParams(agentType, taskId);
    if (!paramValidation.valid) {
      return this.formatError('Parameter validation failed', paramValidation.error);
    }

    // Validate base branch exists
    if (!branchExists(baseBranch, repoRoot)) {
      return this.formatError(
        'Base branch not found',
        `Branch '${baseBranch}' does not exist in the repository`,
      );
    }

    // Generate names and paths
    const worktreeName = generateWorktreeName(agentType, taskId);
    const branchName = generateBranchName(agentType, taskId);
    const worktreePath = path.join(getWorktreeBasePath(repoRoot), worktreeName);

    // Check if worktree already exists
    if (worktreeDirectoryExists(worktreePath)) {
      if (worktreeExists(worktreePath, repoRoot)) {
        // Worktree exists and is valid
        const result: CreateWorktreeResult = {
          success: true,
          message: `Worktree '${worktreeName}' already exists`,
          data: {
            worktreeName,
            worktreePath,
            branchName,
            agentType,
            taskId,
            baseBranch,
            created: 'existing',
          },
        };
        return JSON.stringify(result, null, 2);
      }
      // Directory exists but not registered - clean it up
      try {
        const fs = await import('fs');
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        return this.formatError(
          'Cleanup failed',
          `Directory exists at ${worktreePath} but could not be cleaned`,
        );
      }
    }

    // Check if branch already exists
    if (branchExists(branchName, repoRoot)) {
      if (isBranchInWorktree(branchName, repoRoot)) {
        return this.formatError(
          'Branch in use',
          `Branch '${branchName}' is already in use by another worktree`,
        );
      }

      // Check if merged and can be deleted
      if (isBranchMerged(branchName, baseBranch, repoRoot)) {
        deleteBranch(branchName, repoRoot, true);
      } else {
        // Backup existing branch
        const timestamp = Date.now();
        const backupName = `${branchName}-backup-${timestamp}`;
        execGit(`branch -m "${branchName}" "${backupName}"`, repoRoot);
      }
    }

    // Check disk space
    const diskSpace = checkDiskSpace(repoRoot);
    if (!diskSpace.hasEnoughSpace) {
      return this.formatError(
        'Insufficient disk space',
        `Available: ${Math.round(diskSpace.availableKB / 1024)}MB, Required: ${Math.round(diskSpace.requiredKB / 1024)}MB`,
      );
    }

    // Initialize registry
    initializeRegistry(repoRoot);

    // Create the worktree
    const createResult = createWorktree(worktreePath, branchName, baseBranch, repoRoot);
    if (!createResult.success) {
      return this.formatError('Worktree creation failed', createResult.error);
    }

    // Verify creation
    if (!worktreeDirectoryExists(worktreePath)) {
      return this.formatError(
        'Verification failed',
        'Worktree directory not found after creation',
      );
    }

    // Create agent metadata
    const timestamp = new Date().toISOString();
    const metadata: WorktreeMetadata = {
      worktree_name: worktreeName,
      agent_type: agentType,
      task_id: taskId,
      branch: branchName,
      base_branch: baseBranch,
      created: timestamp,
      repo_root: repoRoot,
    };
    createAgentMetadata(worktreePath, metadata);

    // Add registry entry
    const registryEntry: RegistryEntry = {
      name: worktreeName,
      path: worktreePath,
      branch: branchName,
      agent: agentType,
      task: taskId,
      base: baseBranch,
      created: timestamp,
      status: 'active',
    };
    addRegistryEntry(repoRoot, registryEntry);

    const result: CreateWorktreeResult = {
      success: true,
      message: `Worktree '${worktreeName}' created successfully`,
      data: {
        worktreeName,
        worktreePath,
        branchName,
        agentType,
        taskId,
        baseBranch,
        created: timestamp,
      },
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Merge completed agent work back to target branch
   */
  async mergeAgentWork(args: MergeAgentWorkArgs): Promise<string> {
    const {
      worktreeName,
      targetBranch = 'master',
      mergeStrategy = 'no-ff',
      autoCommit = false,
    } = args;

    // Validate repository
    const repoValidation = validateGitRepository();
    if (!repoValidation.valid || !repoValidation.repoRoot) {
      return this.formatError('Repository validation failed', repoValidation.error);
    }

    const repoRoot = repoValidation.repoRoot;
    const worktreePath = path.join(getWorktreeBasePath(repoRoot), worktreeName);

    // Validate worktree exists
    if (!worktreeDirectoryExists(worktreePath)) {
      return this.formatError(
        'Worktree not found',
        `Worktree '${worktreeName}' not found at ${worktreePath}`,
      );
    }

    // Validate merge strategy
    const strategyValidation = validateMergeStrategy(mergeStrategy);
    if (!strategyValidation.valid) {
      return this.formatError('Invalid merge strategy', strategyValidation.error);
    }

    // Get agent branch name
    const branchResult = execGit('branch --show-current', worktreePath);
    if (!branchResult.success || !branchResult.output) {
      return this.formatError(
        'Branch detection failed',
        'Could not determine current branch in worktree (detached HEAD?)',
      );
    }

    const agentBranch = branchResult.output;

    // Check for uncommitted changes
    const uncommittedChanges = getUncommittedChanges(worktreePath);
    if (uncommittedChanges.length > 0) {
      if (autoCommit) {
        // Auto-commit changes
        execGit('add .', worktreePath);
        const timestamp = new Date().toISOString();
        execGit(
          `commit -m "chore: Auto-commit before merge\n\nWorktree: ${worktreeName}\nTimestamp: ${timestamp}"`,
          worktreePath,
        );
      } else {
        return this.formatError(
          'Uncommitted changes',
          `Worktree has ${uncommittedChanges.length} uncommitted changes. Set autoCommit: true to commit them automatically.`,
        );
      }
    }

    // Get commit count
    const countResult = execGit(`rev-list --count "${targetBranch}..HEAD"`, worktreePath);
    const commitCount = countResult.success ? parseInt(countResult.output, 10) : 0;

    if (commitCount === 0) {
      const result: MergeResult = {
        success: true,
        message: 'No new commits to merge',
        data: {
          worktreeName,
          branchName: agentBranch,
          targetBranch,
          mergeStrategy,
          commitsmerged: 0,
        },
      };
      return JSON.stringify(result, null, 2);
    }

    // Stash any uncommitted changes in main repo
    const repoInfo = getRepositoryInfo(repoRoot);
    let stashNeeded = false;
    if (repoInfo.hasUncommittedChanges) {
      execGit('stash push -m "Auto-stash before agent merge"', repoRoot);
      stashNeeded = true;
    }

    // Checkout target branch
    execGit(`checkout "${targetBranch}"`, repoRoot);

    // Pull latest (ignore errors for local-only repos)
    execGit(`pull origin "${targetBranch}"`, repoRoot);

    // Execute merge based on strategy
    let mergeResult;
    switch (mergeStrategy) {
      case 'no-ff':
        mergeResult = execGit(
          `merge --no-ff "${agentBranch}" -m "Merge agent work: ${worktreeName}\n\nCommits: ${commitCount}"`,
          repoRoot,
        );
        break;

      case 'squash':
        mergeResult = execGit(`merge --squash "${agentBranch}"`, repoRoot);
        if (mergeResult.success) {
          execGit(
            `commit -m "feat: ${worktreeName}\n\nSquashed ${commitCount} commits from ${agentBranch}"`,
            repoRoot,
          );
        }
        break;

      case 'rebase':
        // Rebase in worktree first
        const rebaseResult = execGit(`rebase "${targetBranch}"`, worktreePath);
        if (rebaseResult.success) {
          mergeResult = execGit(`merge --ff-only "${agentBranch}"`, repoRoot);
        } else {
          execGit('rebase --abort', worktreePath);
          mergeResult = { success: false, output: '', error: 'Rebase failed' };
        }
        break;
    }

    // Restore stash if needed
    if (stashNeeded) {
      execGit('stash pop', repoRoot);
    }

    if (!mergeResult || !mergeResult.success) {
      // Check for conflicts
      const conflictResult = execGit('diff --name-only --diff-filter=U', repoRoot);
      const conflictFiles = conflictResult.output
        ? conflictResult.output.split('\n').filter(Boolean)
        : [];

      const result: MergeResult = {
        success: false,
        message: 'Merge conflict detected - manual resolution required',
        error: mergeResult?.error || 'Merge failed',
        data: {
          worktreeName,
          branchName: agentBranch,
          targetBranch,
          mergeStrategy,
          commitsmerged: 0,
          conflicted: true,
          conflictFiles,
        },
      };
      return JSON.stringify(result, null, 2);
    }

    // Update registry
    updateRegistryStatus(repoRoot, worktreeName, 'merged');

    const result: MergeResult = {
      success: true,
      message: `Successfully merged ${commitCount} commits from '${worktreeName}' into '${targetBranch}'`,
      data: {
        worktreeName,
        branchName: agentBranch,
        targetBranch,
        mergeStrategy,
        commitsmerged: commitCount,
      },
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Clean up a specific worktree and its associated branch
   */
  async cleanupWorktree(args: CleanupWorktreeArgs): Promise<string> {
    const { worktreeName, force = false } = args;

    // Validate repository
    const repoValidation = validateGitRepository();
    if (!repoValidation.valid || !repoValidation.repoRoot) {
      return this.formatError('Repository validation failed', repoValidation.error);
    }

    const repoRoot = repoValidation.repoRoot;
    const worktreePath = path.join(getWorktreeBasePath(repoRoot), worktreeName);

    // Check if worktree exists
    if (!worktreeDirectoryExists(worktreePath)) {
      // Check if registered in git but directory missing
      if (worktreeExists(worktreePath, repoRoot)) {
        pruneWorktrees(repoRoot);
      }

      const result: CleanupResult = {
        success: true,
        message: `Worktree '${worktreeName}' not found - nothing to clean up`,
        data: {
          worktreeName,
          branchName: '',
          wasMerged: false,
          forceCleanup: force,
        },
      };
      return JSON.stringify(result, null, 2);
    }

    // Get branch name
    const branchResult = execGit('branch --show-current', worktreePath);
    const branchName = branchResult.success ? branchResult.output : '';

    // Check for uncommitted changes
    const uncommittedChanges = getUncommittedChanges(worktreePath);
    if (uncommittedChanges.length > 0 && !force) {
      return this.formatError(
        'Uncommitted changes',
        `Worktree has ${uncommittedChanges.length} uncommitted changes. Use force: true to discard them.`,
      );
    }

    // Check if branch is merged
    const isMerged = branchName ? isBranchMerged(branchName, 'master', repoRoot) : false;

    if (!isMerged && !force && branchName) {
      return this.formatError(
        'Branch not merged',
        `Branch '${branchName}' is not merged into master. Use force: true to delete unmerged work.`,
      );
    }

    // Remove worktree
    const removeResult = removeWorktree(worktreePath, repoRoot, true);
    if (!removeResult.success) {
      // Try manual cleanup
      try {
        const fs = await import('fs');
        fs.rmSync(worktreePath, { recursive: true, force: true });
        pruneWorktrees(repoRoot);
      } catch {
        return this.formatError('Worktree removal failed', removeResult.error);
      }
    }

    // Delete branch if appropriate
    if (branchName && (force || isMerged)) {
      deleteBranch(branchName, repoRoot, !isMerged);
    }

    // Update registry
    updateRegistryStatus(repoRoot, worktreeName, 'cleaned');

    const result: CleanupResult = {
      success: true,
      message: `Worktree '${worktreeName}' cleaned up successfully`,
      data: {
        worktreeName,
        branchName,
        wasMerged: isMerged,
        forceCleanup: force,
      },
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Get comprehensive status of all worktrees
   */
  async worktreeStatus(args: WorktreeStatusArgs): Promise<string> {
    const { detailed = true, format = 'json' } = args;

    // Validate repository
    const repoValidation = validateGitRepository();
    if (!repoValidation.valid || !repoValidation.repoRoot) {
      return this.formatError('Repository validation failed', repoValidation.error);
    }

    const repoRoot = repoValidation.repoRoot;
    const repoInfo = getRepositoryInfo(repoRoot);

    // Get registry stats
    const registryStats = getRegistryStats(repoRoot);

    // Get all worktrees (excluding main worktree)
    const allWorktrees = listWorktrees(repoRoot);
    const agentWorktrees = allWorktrees.slice(1); // Skip main worktree

    // Gather detailed worktree information
    const worktreeDetails = agentWorktrees.map(wt => {
      const name = path.basename(wt.path);
      const uncommittedChanges = getUncommittedChanges(wt.path);
      const branchInfo = wt.branch
        ? getBranchInfo(wt.branch, 'master', repoRoot)
        : null;
      const metadata = detailed ? readAgentMetadata(wt.path) : undefined;
      const diskSize = detailed ? getDirectorySize(wt.path) : 'N/A';

      return {
        name,
        path: wt.path,
        branch: wt.branch,
        isDetached: wt.isDetached,
        uncommittedChanges: uncommittedChanges.length,
        isMerged: branchInfo?.isMerged ?? false,
        commitsAhead: branchInfo?.commitsAhead ?? 0,
        metadata: metadata || undefined,
        diskSize,
      };
    });

    // Get maintenance info
    const staleResult = pruneWorktrees(repoRoot, true);
    const hasStaleWorktrees = staleResult.output.length > 0;
    const mergedBranches = getMergedAgentBranches('master', repoRoot);
    const gitSize = getDirectorySize(path.join(repoRoot, '.git'));

    const result: StatusResult = {
      success: true,
      message: `Found ${worktreeDetails.length} active worktree(s)`,
      data: {
        repository: {
          root: repoRoot,
          currentBranch: repoInfo.currentBranch || 'unknown',
          hasUncommittedChanges: repoInfo.hasUncommittedChanges,
        },
        registry: registryStats,
        worktrees: worktreeDetails,
        maintenance: {
          staleWorktrees: hasStaleWorktrees,
          mergedBranchesToClean: mergedBranches.length,
          gitRepoSize: gitSize,
        },
      },
    };

    if (format === 'text') {
      return this.formatStatusAsText(result);
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Bulk cleanup of all merged agent worktrees
   */
  async cleanupAllMerged(args: CleanupAllMergedArgs): Promise<string> {
    const { targetBranch = 'master', dryRun = false } = args;

    // Validate repository
    const repoValidation = validateGitRepository();
    if (!repoValidation.valid || !repoValidation.repoRoot) {
      return this.formatError('Repository validation failed', repoValidation.error);
    }

    const repoRoot = repoValidation.repoRoot;

    // Get merged agent branches
    const mergedBranches = getMergedAgentBranches(targetBranch, repoRoot);

    if (mergedBranches.length === 0) {
      const result: CleanupAllResult = {
        success: true,
        message: 'No merged agent branches found to clean up',
        data: {
          dryRun,
          targetBranch,
          branchesFound: 0,
          cleaned: 0,
          failed: 0,
          skipped: 0,
          details: [],
        },
      };
      return JSON.stringify(result, null, 2);
    }

    const details: Array<{
      worktreeName: string;
      branch: string;
      status: 'cleaned' | 'failed' | 'skipped';
      reason?: string;
    }> = [];

    let cleaned = 0;
    let failed = 0;
    let skipped = 0;

    for (const branch of mergedBranches) {
      // Extract worktree name from branch (agents/agent-type/task-id -> agent-type-task-id)
      const parts = branch.split('/');
      if (parts.length < 3) {
continue;
}

      const agentType = parts[1] || 'unknown';
      const taskId = parts.slice(2).join('-');
      const worktreeName = generateWorktreeName(agentType, taskId);
      const worktreePath = path.join(getWorktreeBasePath(repoRoot), worktreeName);

      if (dryRun) {
        details.push({
          worktreeName,
          branch,
          status: 'cleaned',
          reason: 'Would be cleaned (dry run)',
        });
        cleaned++;
        continue;
      }

      // Check if worktree has uncommitted changes
      if (worktreeDirectoryExists(worktreePath)) {
        const uncommitted = getUncommittedChanges(worktreePath);
        if (uncommitted.length > 0) {
          details.push({
            worktreeName,
            branch,
            status: 'skipped',
            reason: `Has ${uncommitted.length} uncommitted changes`,
          });
          skipped++;
          continue;
        }

        // Remove worktree
        const removeResult = removeWorktree(worktreePath, repoRoot, true);
        if (!removeResult.success) {
          details.push({
            worktreeName,
            branch,
            status: 'failed',
            reason: removeResult.error,
          });
          failed++;
          continue;
        }
      }

      // Delete branch
      const deleteResult = deleteBranch(branch, repoRoot, false);
      if (deleteResult.success) {
        details.push({
          worktreeName,
          branch,
          status: 'cleaned',
        });
        cleaned++;

        // Update registry
        updateRegistryStatus(repoRoot, worktreeName, 'cleaned');
      } else {
        details.push({
          worktreeName,
          branch,
          status: 'failed',
          reason: deleteResult.error,
        });
        failed++;
      }
    }

    // Prune stale worktree metadata
    if (!dryRun) {
      pruneWorktrees(repoRoot);
    }

    const result: CleanupAllResult = {
      success: true,
      message: dryRun
        ? `Dry run: Would clean ${cleaned} merged worktree(s)`
        : `Cleaned ${cleaned} merged worktree(s), ${failed} failed, ${skipped} skipped`,
      data: {
        dryRun,
        targetBranch,
        branchesFound: mergedBranches.length,
        cleaned,
        failed,
        skipped,
        details,
      },
    };

    return JSON.stringify(result, null, 2);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private formatError(title: string, message?: string): string {
    const result: MCPToolResult = {
      success: false,
      message: title,
      error: message || title,
    };
    return JSON.stringify(result, null, 2);
  }

  private formatStatusAsText(result: StatusResult): string {
    if (!result.data) {
return 'No data available';
}

    const lines: string[] = [];

    lines.push('========================================');
    lines.push('GIT WORKTREE STATUS REPORT');
    lines.push('========================================');
    lines.push('');

    lines.push('Repository Information:');
    lines.push(`  Root: ${result.data.repository.root}`);
    lines.push(`  Current Branch: ${result.data.repository.currentBranch}`);
    lines.push(`  Has Uncommitted Changes: ${result.data.repository.hasUncommittedChanges}`);
    lines.push('');

    lines.push('Registry Summary:');
    lines.push(`  Total Created: ${result.data.registry.total}`);
    lines.push(`  Active: ${result.data.registry.active}`);
    lines.push(`  Merged: ${result.data.registry.merged}`);
    lines.push(`  Cleaned: ${result.data.registry.cleaned}`);
    lines.push('');

    lines.push('Active Worktrees:');
    if (result.data.worktrees.length === 0) {
      lines.push('  No active worktrees');
    } else {
      for (const wt of result.data.worktrees) {
        lines.push(`  ${wt.name}:`);
        lines.push(`    Path: ${wt.path}`);
        lines.push(`    Branch: ${wt.branch || 'detached'}`);
        lines.push(`    Uncommitted: ${wt.uncommittedChanges}`);
        lines.push(`    Merged: ${wt.isMerged}`);
        lines.push(`    Commits Ahead: ${wt.commitsAhead}`);
        lines.push(`    Disk Size: ${wt.diskSize}`);
      }
    }
    lines.push('');

    lines.push('Maintenance:');
    lines.push(`  Stale Worktrees: ${result.data.maintenance.staleWorktrees}`);
    lines.push(`  Merged Branches to Clean: ${result.data.maintenance.mergedBranchesToClean}`);
    lines.push(`  Git Repo Size: ${result.data.maintenance.gitRepoSize}`);
    lines.push('');

    lines.push('========================================');

    return lines.join('\n');
  }
}

// ============================================================================
// MCP Tool Definitions for Registration
// ============================================================================

export const gitWorktreeToolDefinitions = [
  {
    name: 'create_agent_worktree',
    description:
      'Create an isolated git worktree for a Claude Code agent. Creates a new branch and working directory for parallel development.',
    inputSchema: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          description:
            'Type of agent (e.g., "coder", "tester", "reviewer"). Must start with a letter and contain only alphanumeric characters and hyphens.',
        },
        taskId: {
          type: 'string',
          description:
            'Unique task identifier (e.g., "auth-001", "refactor-models"). Must be alphanumeric with hyphens/underscores.',
        },
        baseBranch: {
          type: 'string',
          description: 'Base branch to create worktree from (default: "master")',
          default: 'master',
        },
      },
      required: ['agentType', 'taskId'],
    },
  },
  {
    name: 'merge_agent_work',
    description:
      'Merge completed agent work from a worktree back to the target branch. Supports multiple merge strategies.',
    inputSchema: {
      type: 'object',
      properties: {
        worktreeName: {
          type: 'string',
          description:
            'Name of the worktree to merge (format: "agentType-taskId", e.g., "coder-auth-001")',
        },
        targetBranch: {
          type: 'string',
          description: 'Target branch to merge into (default: "master")',
          default: 'master',
        },
        mergeStrategy: {
          type: 'string',
          enum: ['no-ff', 'squash', 'rebase'],
          description:
            'Merge strategy: "no-ff" preserves history, "squash" combines commits, "rebase" linear history',
          default: 'no-ff',
        },
        autoCommit: {
          type: 'boolean',
          description:
            'Automatically commit uncommitted changes before merging (default: false)',
          default: false,
        },
      },
      required: ['worktreeName'],
    },
  },
  {
    name: 'cleanup_worktree',
    description:
      'Clean up a specific worktree and its associated branch. Safely removes merged worktrees or forcefully removes unmerged ones.',
    inputSchema: {
      type: 'object',
      properties: {
        worktreeName: {
          type: 'string',
          description:
            'Name of the worktree to clean up (format: "agentType-taskId", e.g., "coder-auth-001")',
        },
        force: {
          type: 'boolean',
          description:
            'Force cleanup even if branch is not merged or has uncommitted changes (default: false)',
          default: false,
        },
      },
      required: ['worktreeName'],
    },
  },
  {
    name: 'worktree_status',
    description:
      'Get comprehensive status report of all git worktrees, including registry statistics, merge status, and maintenance recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description:
            'Include detailed information like agent metadata and disk usage (default: true)',
          default: true,
        },
        format: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Output format: "json" for structured data, "text" for human-readable',
          default: 'json',
        },
      },
      required: [],
    },
  },
  {
    name: 'cleanup_all_merged',
    description:
      'Bulk cleanup of all merged agent worktrees and their branches. Useful for maintenance after completing multiple agent tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        targetBranch: {
          type: 'string',
          description:
            'Target branch to check merge status against (default: "master")',
          default: 'master',
        },
        dryRun: {
          type: 'boolean',
          description:
            'Preview what would be cleaned without making changes (default: false)',
          default: false,
        },
      },
      required: [],
    },
  },
];

// ============================================================================
// Export Handler Instance
// ============================================================================

export const gitWorktreeHandler = new GitWorktreeHandler();
