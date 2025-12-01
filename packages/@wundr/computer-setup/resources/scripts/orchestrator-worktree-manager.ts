#!/usr/bin/env npx ts-node
/**
 * orchestrator-worktree-manager.ts
 *
 * Orchestrator-based worktree management for Claude Code subagents.
 * This runs as part of the orchestrator daemon and provides:
 *
 * 1. Centralized worktree management across all sessions
 * 2. Spawn subagents with automatic worktree isolation
 * 3. Monitor worktree health and cleanup stale worktrees
 * 4. Manage merge workflows with conflict detection
 * 5. Queue and prioritize merge operations
 *
 * Usage:
 *   npx ts-node orchestrator-worktree-manager.ts spawn <agent-type> <task> [options]
 *   npx ts-node orchestrator-worktree-manager.ts merge <worktree-id> [--strategy <auto|squash|pr>]
 *   npx ts-node orchestrator-worktree-manager.ts list [--status <active|completed|merged>]
 *   npx ts-node orchestrator-worktree-manager.ts cleanup [--force]
 *   npx ts-node orchestrator-worktree-manager.ts daemon
 *
 * Install location: ~/.wundr/scripts/orchestrator-worktree-manager.ts
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

interface WorktreeEntry {
  id: string;
  path: string;
  branch: string;
  agentType: string;
  taskDescription: string;
  parentSession: string;
  baseBranch: string;
  repoRoot: string;
  created: string;
  updated: string;
  status:
    | 'active'
    | 'completed'
    | 'merging'
    | 'merged'
    | 'conflict'
    | 'abandoned';
  commits: string[];
  mergeStrategy?: 'auto' | 'squash' | 'pr' | 'manual';
  mergeResult?: {
    success: boolean;
    message: string;
    prUrl?: string;
    conflictFiles?: string[];
  };
  process?: {
    pid: number;
    startedAt: string;
  };
}

interface MergeQueueEntry {
  worktreeId: string;
  priority: number;
  strategy: 'auto' | 'squash' | 'pr' | 'manual';
  requestedAt: string;
  attempts: number;
}

interface OrchestratorState {
  worktrees: WorktreeEntry[];
  mergeQueue: MergeQueueEntry[];
  lastCleanup: string;
  version: string;
}

interface SpawnOptions {
  agentType: string;
  task: string;
  baseBranch?: string;
  priority?: number;
  autoMerge?: boolean;
  mergeStrategy?: 'auto' | 'squash' | 'pr' | 'manual';
  claudeArgs?: string[];
  timeout?: number;
}

interface MergeOptions {
  strategy: 'auto' | 'squash' | 'pr' | 'manual';
  force?: boolean;
  createPr?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const HOME = os.homedir();
const WUNDR_DIR = path.join(HOME, '.wundr');
const STATE_DIR = path.join(WUNDR_DIR, 'resource-manager', 'worktrees');
const STATE_FILE = path.join(STATE_DIR, 'orchestrator-state.json');
const LOCK_FILE = path.join(STATE_DIR, '.orchestrator.lock');
const LOG_DIR = path.join(WUNDR_DIR, 'resource-manager', 'logs');

const DEFAULT_CONFIG = {
  maxWorktrees: 200,
  maxConcurrentMerges: 3,
  cleanupIntervalMs: 300000, // 5 minutes
  worktreeTimeoutMs: 3600000, // 1 hour
  mergeRetryDelayMs: 60000, // 1 minute
  maxMergeRetries: 3,
};

// ============================================================================
// State Management
// ============================================================================

function ensureDirectories(): void {
  [STATE_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function loadState(): OrchestratorState {
  ensureDirectories();
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      return createEmptyState();
    }
  }
  return createEmptyState();
}

function saveState(state: OrchestratorState): void {
  ensureDirectories();
  state.version = '2.0.0';
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function createEmptyState(): OrchestratorState {
  return {
    worktrees: [],
    mergeQueue: [],
    lastCleanup: new Date().toISOString(),
    version: '2.0.0',
  };
}

function acquireLock(): boolean {
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    // Check if lock is stale
    if (fs.existsSync(LOCK_FILE)) {
      try {
        const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8'));
        try {
          process.kill(pid, 0);
          return false; // Process exists, lock is valid
        } catch {
          // Process doesn't exist, remove stale lock
          fs.unlinkSync(LOCK_FILE);
          return acquireLock();
        }
      } catch {
        return false;
      }
    }
    return false;
  }
}

function releaseLock(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Git Operations
// ============================================================================

function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getRepoRoot(dir: string): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return dir;
  }
}

function getCurrentBranch(dir: string): string {
  try {
    return execSync('git branch --show-current', {
      cwd: dir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'main';
  }
}

function getCommitsBetween(
  dir: string,
  base: string,
  head: string = 'HEAD'
): string[] {
  try {
    const output = execSync(`git log ${base}..${head} --oneline`, {
      cwd: dir,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function hasConflicts(worktreePath: string, baseBranch: string): boolean {
  try {
    execSync(`git merge --no-commit --no-ff ${baseBranch}`, {
      cwd: worktreePath,
      stdio: 'pipe',
    });
    execSync('git merge --abort', { cwd: worktreePath, stdio: 'pipe' });
    return false;
  } catch {
    try {
      execSync('git merge --abort', { cwd: worktreePath, stdio: 'pipe' });
    } catch {
      // Ignore
    }
    return true;
  }
}

function getConflictFiles(worktreePath: string): string[] {
  try {
    const output = execSync('git diff --name-only --diff-filter=U', {
      cwd: worktreePath,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// Worktree Operations
// ============================================================================

function generateWorktreeId(agentType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${agentType}-${timestamp}-${random}`;
}

function createWorktree(
  options: SpawnOptions,
  workingDir: string
): WorktreeEntry | null {
  const state = loadState();

  // Check limits
  const activeCount = state.worktrees.filter(w => w.status === 'active').length;
  if (activeCount >= DEFAULT_CONFIG.maxWorktrees) {
    console.error(`Max worktrees (${DEFAULT_CONFIG.maxWorktrees}) reached`);
    return null;
  }

  if (!isGitRepo(workingDir)) {
    console.error('Not in a git repository');
    return null;
  }

  const repoRoot = getRepoRoot(workingDir);
  const baseBranch = options.baseBranch || getCurrentBranch(workingDir);
  const worktreeId = generateWorktreeId(options.agentType);
  const branchName = `agents/${options.agentType}/${worktreeId}`;
  const worktreePath = path.join(repoRoot, '.worktrees', worktreeId);

  try {
    // Create worktrees directory
    const worktreesBase = path.join(repoRoot, '.worktrees');
    if (!fs.existsSync(worktreesBase)) {
      fs.mkdirSync(worktreesBase, { recursive: true });
    }

    // Create the worktree with a new branch
    execSync(
      `git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`,
      {
        cwd: repoRoot,
        stdio: 'pipe',
      }
    );

    // Create metadata file in worktree
    const metadata = {
      id: worktreeId,
      agentType: options.agentType,
      taskDescription: options.task,
      baseBranch,
      created: new Date().toISOString(),
      mergeStrategy: options.mergeStrategy || 'auto',
    };
    fs.writeFileSync(
      path.join(worktreePath, '.agent-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    const entry: WorktreeEntry = {
      id: worktreeId,
      path: worktreePath,
      branch: branchName,
      agentType: options.agentType,
      taskDescription: options.task.substring(0, 500),
      parentSession: process.env.CLAUDE_SESSION_ID || 'unknown',
      baseBranch,
      repoRoot,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      status: 'active',
      commits: [],
      mergeStrategy: options.mergeStrategy || 'auto',
    };

    state.worktrees.push(entry);
    saveState(state);

    console.log(`Created worktree: ${worktreePath}`);
    console.log(`Branch: ${branchName}`);

    return entry;
  } catch (error) {
    console.error('Failed to create worktree:', error);
    return null;
  }
}

function markWorktreeCompleted(worktreeId: string): void {
  const state = loadState();
  const entry = state.worktrees.find(w => w.id === worktreeId);

  if (entry) {
    entry.status = 'completed';
    entry.updated = new Date().toISOString();
    entry.commits = getCommitsBetween(entry.path, entry.baseBranch);
    saveState(state);
    console.log(`Marked worktree ${worktreeId} as completed`);
  }
}

function updateWorktreeStatus(
  worktreeId: string,
  status: WorktreeEntry['status'],
  mergeResult?: WorktreeEntry['mergeResult']
): void {
  const state = loadState();
  const entry = state.worktrees.find(w => w.id === worktreeId);

  if (entry) {
    entry.status = status;
    entry.updated = new Date().toISOString();
    if (mergeResult) {
      entry.mergeResult = mergeResult;
    }
    saveState(state);
  }
}

// ============================================================================
// Spawn Agent with Worktree
// ============================================================================

async function spawnAgentWithWorktree(options: SpawnOptions): Promise<{
  success: boolean;
  worktree?: WorktreeEntry;
  process?: ChildProcess;
  error?: string;
}> {
  const workingDir = process.cwd();
  const worktree = createWorktree(options, workingDir);

  if (!worktree) {
    return { success: false, error: 'Failed to create worktree' };
  }

  // Build the claude command
  const claudeArgs = [
    ...(options.claudeArgs || []),
    '-p',
    `[WORKTREE ISOLATED AGENT]
Working directory: ${worktree.path}
Branch: ${worktree.branch}
Base branch: ${worktree.baseBranch}

INSTRUCTIONS:
- All file operations are in: ${worktree.path}
- Commit changes with descriptive messages
- When done, changes will be reviewed for merge

TASK:
${options.task}`,
  ];

  console.log(`Spawning agent in worktree: ${worktree.path}`);

  // Spawn claude process
  const claudeProcess = spawn('claude', claudeArgs, {
    cwd: worktree.path,
    stdio: 'inherit',
    env: {
      ...process.env,
      CLAUDE_WORKTREE_ID: worktree.id,
      CLAUDE_WORKTREE_PATH: worktree.path,
      CLAUDE_WORKTREE_BRANCH: worktree.branch,
    },
  });

  // Update state with process info
  const state = loadState();
  const entry = state.worktrees.find(w => w.id === worktree.id);
  if (entry) {
    entry.process = {
      pid: claudeProcess.pid!,
      startedAt: new Date().toISOString(),
    };
    saveState(state);
  }

  // Handle process completion
  claudeProcess.on('exit', code => {
    console.log(`Agent process exited with code ${code}`);
    markWorktreeCompleted(worktree.id);

    // Queue for merge if auto-merge enabled
    if (options.autoMerge) {
      queueForMerge(
        worktree.id,
        options.mergeStrategy || 'auto',
        options.priority || 1
      );
    }
  });

  return { success: true, worktree, process: claudeProcess };
}

// ============================================================================
// Merge Operations
// ============================================================================

function queueForMerge(
  worktreeId: string,
  strategy: 'auto' | 'squash' | 'pr' | 'manual',
  priority: number = 1
): void {
  const state = loadState();

  // Check if already queued
  if (state.mergeQueue.some(q => q.worktreeId === worktreeId)) {
    console.log(`Worktree ${worktreeId} already in merge queue`);
    return;
  }

  state.mergeQueue.push({
    worktreeId,
    priority,
    strategy,
    requestedAt: new Date().toISOString(),
    attempts: 0,
  });

  // Sort by priority (higher first)
  state.mergeQueue.sort((a, b) => b.priority - a.priority);

  saveState(state);
  console.log(
    `Queued ${worktreeId} for merge (strategy: ${strategy}, priority: ${priority})`
  );
}

async function performMerge(
  worktreeId: string,
  options: MergeOptions
): Promise<{
  success: boolean;
  message: string;
  prUrl?: string;
}> {
  const state = loadState();
  const entry = state.worktrees.find(w => w.id === worktreeId);

  if (!entry) {
    return { success: false, message: 'Worktree not found' };
  }

  if (!fs.existsSync(entry.path)) {
    updateWorktreeStatus(worktreeId, 'abandoned');
    return { success: false, message: 'Worktree directory not found' };
  }

  // Check for conflicts
  if (hasConflicts(entry.path, entry.baseBranch)) {
    if (!options.force) {
      const conflictFiles = getConflictFiles(entry.path);
      updateWorktreeStatus(worktreeId, 'conflict', {
        success: false,
        message: 'Merge conflicts detected',
        conflictFiles,
      });
      return {
        success: false,
        message: `Conflicts in: ${conflictFiles.join(', ')}`,
      };
    }
  }

  updateWorktreeStatus(worktreeId, 'merging');

  try {
    switch (options.strategy) {
      case 'auto':
        return await doAutoMerge(entry);
      case 'squash':
        return await doSquashMerge(entry);
      case 'pr':
        return await doPrMerge(entry);
      default:
        return {
          success: false,
          message: `Unknown strategy: ${options.strategy}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateWorktreeStatus(worktreeId, 'conflict', { success: false, message });
    return { success: false, message };
  }
}

async function doAutoMerge(
  entry: WorktreeEntry
): Promise<{ success: boolean; message: string }> {
  try {
    // Checkout base branch in repo root
    execSync(`git checkout ${entry.baseBranch}`, {
      cwd: entry.repoRoot,
      stdio: 'pipe',
    });

    // Try fast-forward first
    try {
      execSync(`git merge --ff-only ${entry.branch}`, {
        cwd: entry.repoRoot,
        stdio: 'pipe',
      });
      updateWorktreeStatus(entry.id, 'merged', {
        success: true,
        message: 'Fast-forward merge',
      });
      return { success: true, message: 'Fast-forward merge successful' };
    } catch {
      // Fall back to regular merge
      execSync(
        `git merge ${entry.branch} -m "Merge ${entry.branch} (agent worktree ${entry.id})"`,
        {
          cwd: entry.repoRoot,
          stdio: 'pipe',
        }
      );
      updateWorktreeStatus(entry.id, 'merged', {
        success: true,
        message: 'Merge commit created',
      });
      return { success: true, message: 'Merge successful' };
    }
  } catch (error) {
    throw error;
  }
}

async function doSquashMerge(
  entry: WorktreeEntry
): Promise<{ success: boolean; message: string }> {
  execSync(`git checkout ${entry.baseBranch}`, {
    cwd: entry.repoRoot,
    stdio: 'pipe',
  });
  execSync(`git merge --squash ${entry.branch}`, {
    cwd: entry.repoRoot,
    stdio: 'pipe',
  });

  const commitCount = entry.commits.length;
  const commitMsg = `feat(${entry.agentType}): merge agent worktree ${entry.id}

Squashed ${commitCount} commits from ${entry.branch}

Task: ${entry.taskDescription.substring(0, 100)}
`;

  execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
    cwd: entry.repoRoot,
    stdio: 'pipe',
  });

  updateWorktreeStatus(entry.id, 'merged', {
    success: true,
    message: `Squash merged ${commitCount} commits`,
  });

  return { success: true, message: `Squash merged ${commitCount} commits` };
}

async function doPrMerge(
  entry: WorktreeEntry
): Promise<{ success: boolean; message: string; prUrl?: string }> {
  // Push branch
  execSync(`git push -u origin ${entry.branch}`, {
    cwd: entry.path,
    stdio: 'pipe',
  });

  // Create PR using gh CLI
  const prTitle = `[${entry.agentType}] Agent worktree ${entry.id}`;
  const prBody = `## Agent Worktree Merge

**Agent Type:** ${entry.agentType}
**Task:** ${entry.taskDescription}
**Commits:** ${entry.commits.length}

🤖 Created by Claude Code Resource Manager`;

  try {
    const prUrl = execSync(
      `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}" --base ${entry.baseBranch}`,
      { cwd: entry.path, encoding: 'utf-8' }
    ).trim();

    updateWorktreeStatus(entry.id, 'merged', {
      success: true,
      message: 'PR created',
      prUrl,
    });
    return { success: true, message: 'Pull request created', prUrl };
  } catch (error) {
    throw new Error(`Failed to create PR: ${error}`);
  }
}

// ============================================================================
// Cleanup Operations
// ============================================================================

function cleanupMergedWorktrees(): { cleaned: number; errors: string[] } {
  const state = loadState();
  const errors: string[] = [];
  let cleaned = 0;

  const mergedEntries = state.worktrees.filter(w => w.status === 'merged');

  for (const entry of mergedEntries) {
    try {
      // Remove worktree
      if (fs.existsSync(entry.path)) {
        execSync(`git worktree remove "${entry.path}" --force`, {
          cwd: entry.repoRoot,
          stdio: 'pipe',
        });
      }

      // Delete branch
      try {
        execSync(`git branch -D "${entry.branch}"`, {
          cwd: entry.repoRoot,
          stdio: 'pipe',
        });
      } catch {
        // Branch might already be deleted
      }

      cleaned++;
    } catch (error) {
      errors.push(`Failed to cleanup ${entry.id}: ${error}`);
    }
  }

  // Remove merged entries from state
  state.worktrees = state.worktrees.filter(w => w.status !== 'merged');
  state.lastCleanup = new Date().toISOString();
  saveState(state);

  // Run git worktree prune
  try {
    const repoRoot = state.worktrees[0]?.repoRoot || process.cwd();
    execSync('git worktree prune', { cwd: repoRoot, stdio: 'pipe' });
  } catch {
    // Ignore
  }

  return { cleaned, errors };
}

function cleanupStaleWorktrees(
  timeoutMs: number = DEFAULT_CONFIG.worktreeTimeoutMs
): {
  cleaned: number;
  errors: string[];
} {
  const state = loadState();
  const now = Date.now();
  const errors: string[] = [];
  let cleaned = 0;

  for (const entry of state.worktrees) {
    if (entry.status === 'active') {
      const age = now - new Date(entry.updated).getTime();
      if (age > timeoutMs) {
        // Check if process is still running
        if (entry.process) {
          try {
            process.kill(entry.process.pid, 0);
            continue; // Process still running, skip
          } catch {
            // Process not running, mark as abandoned
          }
        }

        console.log(`Marking stale worktree as abandoned: ${entry.id}`);
        updateWorktreeStatus(entry.id, 'abandoned');
        cleaned++;
      }
    }
  }

  return { cleaned, errors };
}

// ============================================================================
// Daemon Mode
// ============================================================================

class WorktreeOrchestrator extends EventEmitter {
  private running = false;
  private cleanupTimer?: NodeJS.Timeout;
  private mergeTimer?: NodeJS.Timeout;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log('Starting Worktree Orchestrator daemon...');

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.runCleanup();
    }, DEFAULT_CONFIG.cleanupIntervalMs);

    // Start merge queue processor
    this.mergeTimer = setInterval(() => {
      this.processMergeQueue();
    }, 10000); // Check every 10 seconds

    console.log('Worktree Orchestrator daemon started');
  }

  stop(): void {
    this.running = false;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.mergeTimer) clearInterval(this.mergeTimer);
    console.log('Worktree Orchestrator daemon stopped');
  }

  private runCleanup(): void {
    console.log('[daemon] Running cleanup...');
    const staleResult = cleanupStaleWorktrees();
    const mergedResult = cleanupMergedWorktrees();
    console.log(
      `[daemon] Cleanup: ${staleResult.cleaned} stale, ${mergedResult.cleaned} merged`
    );
  }

  private async processMergeQueue(): Promise<void> {
    const state = loadState();
    if (state.mergeQueue.length === 0) return;

    // Get next item from queue
    const item = state.mergeQueue[0];

    // Check if worktree is ready
    const entry = state.worktrees.find(w => w.id === item.worktreeId);
    if (!entry || entry.status !== 'completed') {
      return;
    }

    console.log(`[daemon] Processing merge: ${item.worktreeId}`);

    // Remove from queue
    state.mergeQueue.shift();
    saveState(state);

    // Perform merge
    const result = await performMerge(item.worktreeId, {
      strategy: item.strategy,
    });

    if (!result.success && item.attempts < DEFAULT_CONFIG.maxMergeRetries) {
      // Re-queue with increased attempts
      setTimeout(() => {
        const state = loadState();
        state.mergeQueue.push({
          ...item,
          attempts: item.attempts + 1,
        });
        saveState(state);
      }, DEFAULT_CONFIG.mergeRetryDelayMs);
    }
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'spawn': {
      const agentType = args[1];
      const task = args.slice(2).join(' ');

      if (!agentType || !task) {
        console.error('Usage: spawn <agent-type> <task>');
        process.exit(1);
      }

      const result = await spawnAgentWithWorktree({
        agentType,
        task,
        autoMerge: args.includes('--auto-merge'),
        mergeStrategy:
          (args.find(a => a.startsWith('--strategy='))?.split('=')[1] as any) ||
          'auto',
      });

      if (!result.success) {
        console.error(result.error);
        process.exit(1);
      }

      // Wait for process to complete
      await new Promise<void>(resolve => {
        result.process?.on('exit', () => resolve());
      });
      break;
    }

    case 'merge': {
      const worktreeId = args[1];
      const strategy = (args
        .find(a => a.startsWith('--strategy='))
        ?.split('=')[1] || 'auto') as any;

      if (!worktreeId) {
        console.error(
          'Usage: merge <worktree-id> [--strategy=<auto|squash|pr>]'
        );
        process.exit(1);
      }

      const result = await performMerge(worktreeId, { strategy });
      console.log(result.message);
      if (result.prUrl) console.log(`PR: ${result.prUrl}`);
      process.exit(result.success ? 0 : 1);
      break;
    }

    case 'list': {
      const statusFilter = args
        .find(a => a.startsWith('--status='))
        ?.split('=')[1];
      const state = loadState();

      let worktrees = state.worktrees;
      if (statusFilter) {
        worktrees = worktrees.filter(w => w.status === statusFilter);
      }

      console.log(JSON.stringify(worktrees, null, 2));
      break;
    }

    case 'cleanup': {
      const force = args.includes('--force');
      if (force) {
        cleanupStaleWorktrees(0); // Cleanup all stale regardless of age
      }
      const result = cleanupMergedWorktrees();
      console.log(`Cleaned: ${result.cleaned}`);
      if (result.errors.length > 0) {
        console.log('Errors:', result.errors);
      }
      break;
    }

    case 'daemon': {
      const orchestrator = new WorktreeOrchestrator();
      await orchestrator.start();

      // Handle shutdown
      process.on('SIGINT', () => {
        orchestrator.stop();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        orchestrator.stop();
        process.exit(0);
      });

      // Keep running
      await new Promise(() => {});
      break;
    }

    case 'queue': {
      const worktreeId = args[1];
      const strategy = (args[2] || 'auto') as any;
      const priority = parseInt(args[3] || '1', 10);

      if (!worktreeId) {
        console.error('Usage: queue <worktree-id> [strategy] [priority]');
        process.exit(1);
      }

      queueForMerge(worktreeId, strategy, priority);
      break;
    }

    default:
      console.log(`
Worktree Orchestrator Manager v2.0.0

Usage:
  spawn <agent-type> <task> [--auto-merge] [--strategy=<auto|squash|pr>]
  merge <worktree-id> [--strategy=<auto|squash|pr>]
  list [--status=<active|completed|merged>]
  cleanup [--force]
  queue <worktree-id> [strategy] [priority]
  daemon

Commands:
  spawn      Create worktree and spawn agent
  merge      Merge a completed worktree
  list       List worktrees
  cleanup    Cleanup merged/stale worktrees
  queue      Add worktree to merge queue
  daemon     Run as background daemon
`);
  }
}

main().catch(console.error);

export {
  spawnAgentWithWorktree,
  performMerge,
  queueForMerge,
  cleanupMergedWorktrees,
  cleanupStaleWorktrees,
  loadState,
  WorktreeOrchestrator,
};
