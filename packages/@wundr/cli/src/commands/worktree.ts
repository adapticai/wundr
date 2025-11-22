/**
 * Worktree Management CLI Commands
 *
 * Manages git worktrees for multi-agent development including
 * listing, creating, switching, cleanup, and synchronization.
 *
 * @module commands/worktree
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';

const execAsync = promisify(exec);

// Constants
const WORKTREE_STATE_DIR = path.join(os.homedir(), '.wundr', 'worktrees');
const WORKTREE_STATE_FILE = path.join(WORKTREE_STATE_DIR, 'state.json');

// Types
export type WorktreeStatus =
  | 'pending'
  | 'creating'
  | 'active'
  | 'paused'
  | 'syncing'
  | 'cleanup'
  | 'error'
  | 'destroyed';

export interface WorktreeEntry {
  taskId: string;
  branchName: string;
  worktreePath: string;
  sessionId: string;
  status: WorktreeStatus;
  createdAt: string;
  lastAccessedAt?: string;
  parentWorktreePath?: string;
  metadata?: Record<string, unknown>;
}

export interface WorktreeState {
  version: string;
  lastUpdated: string;
  repoPath: string;
  worktrees: WorktreeEntry[];
}

export interface GitWorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  isLocked: boolean;
  lastModified?: Date;
}

export interface CleanupResult {
  success: boolean;
  removedCount: number;
  removedPaths: string[];
  skippedPaths: string[];
  skipReasons: Map<string, string>;
  errors: Array<{ path: string; message: string }>;
  freedBytes?: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  worktreePath: string;
  branchName?: string;
  stashedChanges?: boolean;
  commitsUpdated?: number;
  error?: Error;
  timestamp: Date;
}

// Utility functions
function getTimestamp(): string {
  return new Date().toISOString();
}

function padRight(str: string, length: number): string {
  return str.length >= length
    ? str.substring(0, length)
    : str + ' '.repeat(length - str.length);
}

function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return str.substring(0, length - 3) + '...';
}

function formatAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`;
  }
  return 'just now';
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}

function generateBranchName(taskId: string): string {
  const sanitized = taskId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `task/${sanitized}`;
}

async function ensureStateDir(): Promise<void> {
  await fs.mkdir(WORKTREE_STATE_DIR, { recursive: true });
}

async function loadWorktreeState(): Promise<WorktreeState> {
  try {
    await ensureStateDir();
    const content = await fs.readFile(WORKTREE_STATE_FILE, 'utf-8');
    return JSON.parse(content) as WorktreeState;
  } catch {
    // Return empty state if file doesn't exist
    return {
      version: '1.0.0',
      lastUpdated: getTimestamp(),
      repoPath: process.cwd(),
      worktrees: [],
    };
  }
}

async function saveWorktreeState(state: WorktreeState): Promise<void> {
  await ensureStateDir();
  state.lastUpdated = getTimestamp();
  await fs.writeFile(WORKTREE_STATE_FILE, JSON.stringify(state, null, 2));
}

async function getGitRepoRoot(): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', {
      timeout: 10000,
    });
    return stdout.trim();
  } catch {
    return process.cwd();
  }
}

async function executeGitCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const fullCommand = `git ${command} ${args.join(' ')}`;
  try {
    const { stdout } = await execAsync(fullCommand, { cwd, timeout: 60000 });
    return stdout.trim();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed: ${fullCommand}\n${errorMessage}`);
  }
}

async function listGitWorktrees(repoPath: string): Promise<GitWorktreeInfo[]> {
  const worktrees: GitWorktreeInfo[] = [];

  try {
    const output = await executeGitCommand(
      'worktree',
      ['list', '--porcelain'],
      repoPath,
    );
    const entries = output.split('\n\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.split('\n');
      const info: Partial<GitWorktreeInfo> = {
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
        // Check if this is the main worktree
        if (info.path === repoPath) {
          info.isMain = true;
        }

        // Get last modified time
        try {
          const stats = await fs.stat(info.path);
          info.lastModified = stats.mtime;
        } catch {
          // Path might not exist for orphaned worktrees
        }

        worktrees.push(info as GitWorktreeInfo);
      }
    }
  } catch {
    // Return empty list if git command fails
  }

  return worktrees;
}

async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: worktreePath,
      timeout: 10000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function getStatusColor(status: WorktreeStatus): (str: string) => string {
  switch (status) {
    case 'active':
      return chalk.green;
    case 'paused':
      return chalk.yellow;
    case 'syncing':
      return chalk.blue;
    case 'creating':
      return chalk.cyan;
    case 'cleanup':
      return chalk.magenta;
    case 'error':
      return chalk.red;
    case 'destroyed':
      return chalk.gray;
    case 'pending':
      return chalk.white;
    default:
      return chalk.white;
  }
}

function getStatusIcon(status: WorktreeStatus): string {
  switch (status) {
    case 'active':
      return '[ACTIVE]';
    case 'paused':
      return '[PAUSED]';
    case 'syncing':
      return '[SYNCING]';
    case 'creating':
      return '[CREATING]';
    case 'cleanup':
      return '[CLEANUP]';
    case 'error':
      return '[ERROR]';
    case 'destroyed':
      return '[DESTROYED]';
    case 'pending':
      return '[PENDING]';
    default:
      return '[UNKNOWN]';
  }
}

/**
 * Create the worktree command with all subcommands
 */
export function createWorktreeCommand(): Command {
  const command = new Command('worktree')
    .alias('wt')
    .description('Manage git worktrees for multi-agent development')
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr worktree list')}                 List all worktrees
  ${chalk.green('wundr wt list --session <id>')}       List worktrees for a session
  ${chalk.green('wundr worktree create <taskId>')}     Create new worktree for a task
  ${chalk.green('wundr worktree switch <taskId>')}     Switch to an existing worktree
  ${chalk.green('wundr worktree cleanup --dry-run')}   Preview what would be cleaned up
  ${chalk.green('wundr worktree sync')}                Sync all worktrees from remote
  ${chalk.green('wundr worktree sync <taskId>')}       Sync specific worktree
      `),
    );

  // List command (default)
  command
    .command('list', { isDefault: true })
    .description('List all worktrees')
    .option('-s, --session <id>', 'Filter by session ID')
    .option(
      '--status <status>',
      'Filter by status (active, paused, syncing, error, etc.)',
    )
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .action(async options => {
      await listWorktrees(options);
    });

  // Create command (ccswitch create)
  command
    .command('create <taskId>')
    .description('Create a new worktree for a task')
    .option('-b, --base <branch>', 'Base branch to create from', 'main')
    .action(async (taskId, options) => {
      await createWorktree(taskId, options);
    });

  // Switch command (ccswitch switch)
  command
    .command('switch <taskId>')
    .description('Switch to an existing worktree')
    .action(async taskId => {
      await switchWorktree(taskId);
    });

  // Cleanup command
  command
    .command('cleanup')
    .description('Clean up stale worktrees')
    .option(
      '--dry-run',
      'Preview what would be cleaned up without making changes',
    )
    .option('--force', 'Force cleanup even with uncommitted changes')
    .option('--age <days>', 'Clean up worktrees older than specified days', '7')
    .action(async options => {
      await cleanupWorktrees(options);
    });

  // Sync command
  command
    .command('sync [taskId]')
    .description('Sync worktree(s) from remote')
    .option('--all', 'Sync all worktrees')
    .action(async (taskId, options) => {
      await syncWorktrees(taskId, options);
    });

  return command;
}

// Command implementations

async function listWorktrees(options: {
  session?: string;
  status?: string;
  format?: 'table' | 'json';
}): Promise<void> {
  const spinner = ora('Loading worktrees...').start();

  try {
    const state = await loadWorktreeState();
    let worktrees = state.worktrees;

    // Filter by session ID if provided
    if (options.session) {
      worktrees = worktrees.filter(wt => wt.sessionId === options.session);
    }

    // Filter by status if provided
    if (options.status) {
      worktrees = worktrees.filter(wt => wt.status === options.status);
    }

    spinner.stop();

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            timestamp: getTimestamp(),
            count: worktrees.length,
            worktrees: worktrees,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(chalk.cyan('\nWorktree List'));
    console.log(chalk.gray('='.repeat(110)));

    if (worktrees.length === 0) {
      console.log(chalk.yellow('\nNo worktrees found.'));
      if (options.session) {
        console.log(chalk.gray(`No worktrees for session: ${options.session}`));
      }
      console.log('');
      return;
    }

    // Table header
    console.log(
      chalk.cyan(
        padRight('Task ID', 20) +
          padRight('Branch', 25) +
          padRight('Status', 12) +
          padRight('Created', 12) +
          padRight('Path', 40),
      ),
    );
    console.log(chalk.gray('-'.repeat(110)));

    // Table rows
    for (const wt of worktrees) {
      const statusColor = getStatusColor(wt.status);
      const createdAge = formatAge(wt.createdAt);
      const worktreePath = truncate(wt.worktreePath, 38);
      const branchName = truncate(wt.branchName, 23);

      console.log(
        padRight(wt.taskId, 20) +
          chalk.blue(padRight(branchName, 25)) +
          statusColor(padRight(getStatusIcon(wt.status), 12)) +
          padRight(createdAge, 12) +
          chalk.gray(padRight(worktreePath, 40)),
      );
    }

    console.log(chalk.gray('-'.repeat(110)));
    console.log(chalk.gray(`Total: ${worktrees.length} worktree(s)`));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load worktrees');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function createWorktree(
  taskId: string,
  options: { base?: string },
): Promise<void> {
  const spinner = ora(`Creating worktree for task: ${taskId}...`).start();

  try {
    const state = await loadWorktreeState();
    const repoPath = await getGitRepoRoot();
    state.repoPath = repoPath;

    // Check if worktree already exists
    const existing = state.worktrees.find(wt => wt.taskId === taskId);
    if (existing) {
      spinner.fail(`Worktree already exists for task: ${taskId}`);
      console.log(
        chalk.yellow(`Use "wundr worktree switch ${taskId}" to switch to it.`),
      );
      return;
    }

    const baseBranch = options.base || 'main';
    const branchName = generateBranchName(taskId);
    const sessionId = generateSessionId();
    const worktreeRoot = path.join(repoPath, '.git-worktrees', 'sessions');
    const worktreePath = path.join(worktreeRoot, taskId);

    // Ensure worktree root exists
    await fs.mkdir(worktreeRoot, { recursive: true });

    // Fetch latest from remote
    try {
      await executeGitCommand('fetch', ['origin', baseBranch], repoPath);
    } catch {
      // Continue even if fetch fails (might be offline)
    }

    // Create the worktree with a new branch
    await executeGitCommand(
      'worktree',
      ['add', '-b', branchName, worktreePath, `origin/${baseBranch}`],
      repoPath,
    );

    // Save to state
    const entry: WorktreeEntry = {
      taskId,
      branchName,
      worktreePath,
      sessionId,
      status: 'active',
      createdAt: getTimestamp(),
      lastAccessedAt: getTimestamp(),
    };

    state.worktrees.push(entry);
    await saveWorktreeState(state);

    spinner.succeed(`Worktree created for task: ${taskId}`);
    console.log('');
    console.log(chalk.white('  Task ID:    ') + chalk.green(taskId));
    console.log(chalk.white('  Branch:     ') + chalk.blue(branchName));
    console.log(chalk.white('  Path:       ') + chalk.gray(worktreePath));
    console.log('');
    console.log(
      chalk.gray(`Use "wundr worktree switch ${taskId}" to start working.`),
    );
    console.log('');
  } catch (error) {
    spinner.fail('Failed to create worktree');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function switchWorktree(taskId: string): Promise<void> {
  const spinner = ora(`Switching to worktree: ${taskId}...`).start();

  try {
    const state = await loadWorktreeState();

    // Find the worktree
    const worktree = state.worktrees.find(wt => wt.taskId === taskId);
    if (!worktree) {
      spinner.fail(`Worktree not found: ${taskId}`);
      console.log(
        chalk.yellow(`Use "wundr worktree create ${taskId}" to create it.`),
      );
      return;
    }

    // Check if worktree path exists
    try {
      await fs.access(worktree.worktreePath);
    } catch {
      spinner.fail(`Worktree directory not found: ${worktree.worktreePath}`);
      console.log(
        chalk.yellow(
          'The worktree may have been deleted. Consider running cleanup.',
        ),
      );
      return;
    }

    // Update status
    worktree.status = 'active';
    worktree.lastAccessedAt = getTimestamp();
    await saveWorktreeState(state);

    spinner.succeed(`Switched to worktree: ${taskId}`);
    console.log('');
    console.log(chalk.white('  Task ID:    ') + chalk.green(taskId));
    console.log(
      chalk.white('  Branch:     ') + chalk.blue(worktree.branchName),
    );
    console.log(
      chalk.white('  Path:       ') + chalk.gray(worktree.worktreePath),
    );
    console.log('');
    console.log(chalk.cyan('To navigate to this worktree, run:'));
    console.log(chalk.white(`  cd ${worktree.worktreePath}`));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to switch worktree');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function cleanupWorktrees(options: {
  dryRun?: boolean;
  force?: boolean;
  age?: string;
}): Promise<void> {
  const maxAgeDays = parseInt(options.age || '7', 10);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const spinner = ora(
    options.dryRun ? 'Analyzing worktrees...' : 'Cleaning up worktrees...',
  ).start();

  try {
    const state = await loadWorktreeState();
    const repoPath = state.repoPath || (await getGitRepoRoot());
    const now = Date.now();

    // Get actual git worktrees
    const gitWorktrees = await listGitWorktrees(repoPath);

    // Categorize worktrees for cleanup
    const toRemove: Array<{
      entry?: WorktreeEntry;
      gitInfo?: GitWorktreeInfo;
      reason: string;
    }> = [];
    const toSkip: Array<{
      entry?: WorktreeEntry;
      gitInfo?: GitWorktreeInfo;
      reason: string;
    }> = [];

    // Check state entries
    for (const entry of state.worktrees) {
      const createdAt = new Date(entry.createdAt).getTime();
      const age = now - createdAt;
      const gitInfo = gitWorktrees.find(g => g.path === entry.worktreePath);

      // Check if worktree still exists
      try {
        await fs.access(entry.worktreePath);
      } catch {
        toRemove.push({ entry, reason: 'Directory no longer exists' });
        continue;
      }

      // Check if too old
      if (age > maxAgeMs) {
        // Check for uncommitted changes
        const hasChanges = await hasUncommittedChanges(entry.worktreePath);
        if (hasChanges && !options.force) {
          toSkip.push({ entry, gitInfo, reason: 'Has uncommitted changes' });
        } else if (gitInfo?.isLocked && !options.force) {
          toSkip.push({ entry, gitInfo, reason: 'Worktree is locked' });
        } else {
          toRemove.push({
            entry,
            gitInfo,
            reason: `Older than ${maxAgeDays} days`,
          });
        }
      }

      // Check error status
      if (entry.status === 'error' && !options.force) {
        toRemove.push({ entry, gitInfo, reason: 'In error state' });
      }
    }

    spinner.stop();

    if (options.dryRun) {
      // Show preview
      console.log(chalk.cyan('\nCleanup Preview (Dry Run)'));
      console.log(chalk.gray('='.repeat(80)));

      if (toRemove.length === 0) {
        console.log(chalk.green('\nNo worktrees need to be cleaned up.'));
        console.log('');
        return;
      }

      console.log(
        chalk.yellow(`\nWorktrees to be removed: ${toRemove.length}`),
      );
      console.log(chalk.gray('-'.repeat(80)));

      for (const { entry, reason } of toRemove) {
        if (entry) {
          console.log(chalk.white('  Task ID: ') + chalk.green(entry.taskId));
          console.log(
            chalk.white('  Path:    ') + chalk.gray(entry.worktreePath),
          );
          console.log(
            chalk.white('  Branch:  ') + chalk.blue(entry.branchName),
          );
          console.log(chalk.white('  Reason:  ') + chalk.yellow(reason));
          console.log('');
        }
      }

      if (toSkip.length > 0) {
        console.log(
          chalk.yellow(`\nWorktrees to be skipped: ${toSkip.length}`),
        );
        console.log(chalk.gray('-'.repeat(80)));

        for (const { entry, reason } of toSkip) {
          if (entry) {
            console.log(chalk.white('  Task ID: ') + chalk.green(entry.taskId));
            console.log(
              chalk.white('  Path:    ') + chalk.gray(entry.worktreePath),
            );
            console.log(chalk.white('  Reason:  ') + chalk.gray(reason));
            console.log('');
          }
        }
      }

      console.log(chalk.gray('-'.repeat(80)));
      console.log(
        chalk.gray('Run without --dry-run to perform actual cleanup.'),
      );
      console.log('');
    } else {
      // Perform actual cleanup
      const result: CleanupResult = {
        success: true,
        removedCount: 0,
        removedPaths: [],
        skippedPaths: [],
        skipReasons: new Map(),
        errors: [],
      };

      for (const { entry, reason } of toRemove) {
        if (!entry) {
          continue;
        }

        try {
          // Remove the git worktree
          const forceFlag = options.force ? '--force' : '';
          await executeGitCommand(
            'worktree',
            ['remove', forceFlag, entry.worktreePath].filter(Boolean),
            repoPath,
          );

          result.removedCount++;
          result.removedPaths.push(entry.worktreePath);
        } catch (error) {
          // Try manual removal if git worktree remove fails
          if (options.force) {
            try {
              await fs.rm(entry.worktreePath, { recursive: true, force: true });
              await executeGitCommand('worktree', ['prune'], repoPath);
              result.removedCount++;
              result.removedPaths.push(entry.worktreePath);
            } catch (rmError) {
              result.errors.push({
                path: entry.worktreePath,
                message:
                  rmError instanceof Error ? rmError.message : String(rmError),
              });
            }
          } else {
            result.errors.push({
              path: entry.worktreePath,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      for (const { entry, reason } of toSkip) {
        if (entry) {
          result.skippedPaths.push(entry.worktreePath);
          result.skipReasons.set(entry.worktreePath, reason);
        }
      }

      // Update state file to remove cleaned worktrees
      const removedPaths = new Set(result.removedPaths);
      state.worktrees = state.worktrees.filter(
        wt => !removedPaths.has(wt.worktreePath),
      );
      await saveWorktreeState(state);

      // Show results
      console.log(chalk.cyan('\nCleanup Results'));
      console.log(chalk.gray('='.repeat(80)));

      if (result.removedCount === 0 && result.errors.length === 0) {
        console.log(chalk.green('\nNo worktrees needed to be cleaned up.'));
        console.log('');
        return;
      }

      if (result.removedCount > 0) {
        console.log(
          chalk.green(`\nRemoved ${result.removedCount} worktree(s):`),
        );
        for (const removedPath of result.removedPaths) {
          console.log(chalk.gray(`  - ${removedPath}`));
        }
      }

      if (result.skippedPaths.length > 0) {
        console.log(
          chalk.yellow(`\nSkipped ${result.skippedPaths.length} worktree(s):`),
        );
        for (const skippedPath of result.skippedPaths) {
          const reason = result.skipReasons.get(skippedPath) || 'unknown';
          console.log(chalk.gray(`  - ${skippedPath}: ${reason}`));
        }
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`\nErrors (${result.errors.length}):`));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.path}: ${error.message}`));
        }
      }

      console.log('');
    }
  } catch (error) {
    spinner.fail('Failed to cleanup worktrees');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function syncWorktrees(
  taskId: string | undefined,
  options: { all?: boolean },
): Promise<void> {
  const spinner = ora(
    taskId ? `Syncing worktree: ${taskId}...` : 'Syncing worktrees...',
  ).start();

  try {
    const state = await loadWorktreeState();
    const repoPath = state.repoPath || (await getGitRepoRoot());

    const syncSingleWorktree = async (
      worktree: WorktreeEntry,
    ): Promise<SyncResult> => {
      const timestamp = new Date();
      let stashedChanges = false;

      try {
        // Check for uncommitted changes
        const hasChanges = await hasUncommittedChanges(worktree.worktreePath);

        if (hasChanges) {
          // Stash changes
          await executeGitCommand(
            'stash',
            ['push', '-m', 'auto-stash before sync'],
            worktree.worktreePath,
          );
          stashedChanges = true;
        }

        // Fetch from remote
        await executeGitCommand('fetch', ['origin'], worktree.worktreePath);

        // Get current branch
        const branchName = await executeGitCommand(
          'rev-parse',
          ['--abbrev-ref', 'HEAD'],
          worktree.worktreePath,
        );

        // Try fast-forward pull
        try {
          await executeGitCommand(
            'pull',
            ['--ff-only', 'origin', branchName],
            worktree.worktreePath,
          );
        } catch {
          // Fast-forward not possible, try rebase
          await executeGitCommand(
            'rebase',
            [`origin/${branchName}`],
            worktree.worktreePath,
          );
        }

        // Count commits updated (approximate)
        let commitsUpdated = 0;
        try {
          const { stdout } = await execAsync(
            `git rev-list --count origin/${branchName}..HEAD`,
            { cwd: worktree.worktreePath, timeout: 10000 },
          );
          commitsUpdated = parseInt(stdout.trim(), 10) || 0;
        } catch {
          // Ignore count errors
        }

        // Restore stashed changes
        if (stashedChanges) {
          try {
            await executeGitCommand('stash', ['pop'], worktree.worktreePath);
          } catch {
            // Stash pop might have conflicts
          }
        }

        return {
          success: true,
          message: 'Successfully synced',
          worktreePath: worktree.worktreePath,
          branchName,
          stashedChanges,
          commitsUpdated,
          timestamp,
        };
      } catch (error) {
        // Try to restore stash on failure
        if (stashedChanges) {
          try {
            await executeGitCommand('stash', ['pop'], worktree.worktreePath);
          } catch {
            // Ignore
          }
        }

        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
          worktreePath: worktree.worktreePath,
          stashedChanges,
          timestamp,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    };

    if (taskId) {
      // Sync specific worktree
      const worktree = state.worktrees.find(wt => wt.taskId === taskId);
      if (!worktree) {
        spinner.fail(`Worktree not found: ${taskId}`);
        return;
      }

      // Update status to syncing
      worktree.status = 'syncing';
      await saveWorktreeState(state);

      const result = await syncSingleWorktree(worktree);

      // Update status based on result
      worktree.status = result.success ? 'active' : 'error';
      worktree.lastAccessedAt = getTimestamp();
      await saveWorktreeState(state);

      spinner.stop();

      if (result.success) {
        console.log(chalk.green(`\nSuccessfully synced worktree: ${taskId}`));
        console.log(
          chalk.white('  Branch:  ') +
            chalk.blue(result.branchName || 'unknown'),
        );
        console.log(
          chalk.white('  Commits: ') +
            chalk.cyan(`${result.commitsUpdated || 0} updated`),
        );
        if (result.stashedChanges) {
          console.log(
            chalk.yellow('  Note: Local changes were stashed and restored.'),
          );
        }
      } else {
        console.log(chalk.red(`\nFailed to sync worktree: ${taskId}`));
        console.log(chalk.red(`  Error: ${result.message}`));
      }
      console.log('');
    } else if (options.all || !taskId) {
      // Sync all active worktrees
      const activeWorktrees = state.worktrees.filter(
        wt => wt.status === 'active' || wt.status === 'paused',
      );

      if (activeWorktrees.length === 0) {
        spinner.stop();
        console.log(chalk.yellow('\nNo active worktrees to sync.'));
        console.log('');
        return;
      }

      spinner.text = `Syncing ${activeWorktrees.length} worktree(s)...`;

      const results: Array<{ taskId: string; result: SyncResult }> = [];

      for (const wt of activeWorktrees) {
        wt.status = 'syncing';
        await saveWorktreeState(state);

        const result = await syncSingleWorktree(wt);
        wt.status = result.success ? 'active' : 'error';
        wt.lastAccessedAt = getTimestamp();
        results.push({ taskId: wt.taskId, result });
      }

      await saveWorktreeState(state);
      spinner.stop();

      console.log(chalk.cyan('\nSync Results'));
      console.log(chalk.gray('='.repeat(80)));

      const successful = results.filter(r => r.result.success);
      const failed = results.filter(r => !r.result.success);

      if (successful.length > 0) {
        console.log(chalk.green(`\nSuccessfully synced: ${successful.length}`));
        for (const { taskId: tid, result } of successful) {
          console.log(
            chalk.gray(
              `  - ${tid}: ${result.commitsUpdated || 0} commit(s) updated`,
            ),
          );
        }
      }

      if (failed.length > 0) {
        console.log(chalk.red(`\nFailed to sync: ${failed.length}`));
        for (const { taskId: tid, result } of failed) {
          console.log(chalk.red(`  - ${tid}: ${result.message}`));
        }
      }

      console.log('');
    }
  } catch (error) {
    spinner.fail('Failed to sync worktrees');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error)),
    );
  }
}

// Export for registration
export default createWorktreeCommand;
