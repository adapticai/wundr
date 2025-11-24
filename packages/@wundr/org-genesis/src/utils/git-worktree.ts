/**
 * Git Worktree Management Utilities
 *
 * @module @wundr/org-genesis/utils/git-worktree
 * @description
 * Provides functions for creating, managing, and cleaning up git worktrees
 * for session isolation as described in the architectural framework.
 *
 * Git worktrees allow multiple working directories to be attached to a single
 * repository, enabling isolated development sessions without the overhead of
 * full repository clones. This is particularly useful for:
 *
 * - Parallel development sessions with different agents
 * - Isolated testing environments
 * - Safe experimentation without affecting the main working directory
 * - Context preservation across multiple concurrent tasks
 *
 * @see https://git-scm.com/docs/git-worktree
 *
 * @example
 * ```typescript
 * import {
 *   createWorktree,
 *   removeWorktree,
 *   listWorktrees,
 *   initializeContextDirectory
 * } from '@wundr/org-genesis/utils/git-worktree';
 *
 * // Create an isolated worktree for a session
 * const worktreePath = await createWorktree('/path/to/repo', {
 *   basePath: '/tmp/sessions',
 *   sessionId: 'session-123',
 *   createBranch: true
 * });
 *
 * // Initialize context directory structure
 * await initializeContextDirectory(worktreePath);
 *
 * // List all worktrees
 * const worktrees = await listWorktrees('/path/to/repo');
 *
 * // Clean up when done
 * await removeWorktree('/path/to/repo', worktreePath);
 * ```
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Information about a git worktree.
 *
 * @interface WorktreeInfo
 * @description
 * Represents the state and metadata of a git worktree as returned by
 * `git worktree list --porcelain`. This interface captures all relevant
 * information needed for worktree management operations.
 *
 * @example
 * ```typescript
 * const worktree: WorktreeInfo = {
 *   path: '/tmp/sessions/session-123',
 *   branch: 'refs/heads/session/session-123',
 *   commitHash: 'abc123def456...',
 *   isLocked: false,
 *   isPrunable: false
 * };
 * ```
 */
export interface WorktreeInfo {
  /**
   * The absolute filesystem path to the worktree directory.
   * This is where the working directory files are checked out.
   */
  path: string;

  /**
   * The full ref name of the branch checked out in this worktree.
   * Format: 'refs/heads/branch-name' for local branches.
   * May be undefined for detached HEAD states.
   */
  branch: string;

  /**
   * The SHA-1 hash of the commit currently checked out (HEAD).
   * This is always a 40-character hexadecimal string.
   */
  commitHash: string;

  /**
   * Whether the worktree is locked against removal.
   * Locked worktrees cannot be removed without using --force.
   * Useful for protecting active sessions from accidental cleanup.
   */
  isLocked: boolean;

  /**
   * Whether the worktree is considered prunable.
   * A worktree becomes prunable when its directory no longer exists
   * or when the .git file is missing/corrupt.
   */
  isPrunable: boolean;
}

/**
 * Options for creating a new git worktree.
 *
 * @interface CreateWorktreeOptions
 * @description
 * Configuration options for the {@link createWorktree} function.
 * These options control where the worktree is created, what branch
 * it checks out, and how conflicts are handled.
 *
 * @example
 * ```typescript
 * // Create with a new branch
 * const options: CreateWorktreeOptions = {
 *   basePath: '/tmp/worktrees',
 *   sessionId: 'feature-work',
 *   branch: 'feature/new-feature',
 *   createBranch: true,
 *   force: false
 * };
 *
 * // Create from existing branch
 * const options2: CreateWorktreeOptions = {
 *   basePath: '/tmp/worktrees',
 *   sessionId: 'hotfix',
 *   branch: 'main',
 *   createBranch: false
 * };
 * ```
 */
export interface CreateWorktreeOptions {
  /**
   * The base directory where the worktree will be created.
   * The final worktree path will be `${basePath}/${sessionId}`.
   *
   * @example '/tmp/sessions' or '/var/worktrees'
   */
  basePath: string;

  /**
   * A unique identifier for this session/worktree.
   * Used as the directory name and optionally as part of the branch name.
   * Should be filesystem-safe (no special characters).
   *
   * @example 'session-abc123' or 'agent-task-001'
   */
  sessionId: string;

  /**
   * The branch to checkout in the worktree.
   * If not specified, defaults to `session/${sessionId}`.
   *
   * When {@link createBranch} is true, this is the name of the new branch.
   * When false, this must be an existing branch name.
   *
   * @default `session/${sessionId}`
   */
  branch?: string;

  /**
   * Whether to create a new branch for this worktree.
   * If true, uses `git worktree add -b` to create the branch.
   * If false, the branch must already exist.
   *
   * @default false
   */
  createBranch?: boolean;

  /**
   * Whether to force creation even if the branch is already checked out elsewhere.
   * Use with caution as this can lead to conflicting work.
   *
   * @default false
   */
  force?: boolean;
}

/**
 * Creates a new git worktree for an isolated session.
 *
 * @async
 * @function createWorktree
 * @description
 * Creates a new git worktree at the specified location, optionally creating
 * a new branch. This enables isolated development environments where changes
 * can be made without affecting other worktrees or the main working directory.
 *
 * The worktree is created at `${options.basePath}/${options.sessionId}` and
 * checks out the specified branch. If no branch is specified, it defaults
 * to `session/${options.sessionId}`.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 * @param {CreateWorktreeOptions} options - Configuration options for worktree creation.
 *
 * @returns {Promise<string>} The absolute path to the created worktree directory.
 *
 * @throws {Error} If the git command fails (e.g., branch already checked out,
 *   permission denied, invalid repository path).
 *
 * @example
 * ```typescript
 * // Create a worktree with a new branch
 * const worktreePath = await createWorktree('/home/user/repo', {
 *   basePath: '/tmp/sessions',
 *   sessionId: 'agent-session-001',
 *   createBranch: true
 * });
 * // Creates worktree at /tmp/sessions/agent-session-001
 * // with branch 'session/agent-session-001'
 *
 * // Create a worktree from an existing branch
 * const worktreePath2 = await createWorktree('/home/user/repo', {
 *   basePath: '/tmp/sessions',
 *   sessionId: 'review-session',
 *   branch: 'feature/existing-feature',
 *   createBranch: false
 * });
 * ```
 *
 * @see {@link removeWorktree} for cleaning up worktrees
 * @see {@link initializeContextDirectory} for setting up context structure
 */
export async function createWorktree(
  repoPath: string,
  options: CreateWorktreeOptions,
): Promise<string> {
  const worktreePath = path.join(options.basePath, options.sessionId);
  const branch = options.branch ?? `session/${options.sessionId}`;

  const branchFlag = options.createBranch ? '-b' : '';
  const forceFlag = options.force ? '--force' : '';

  const cmd = `git worktree add ${forceFlag} ${branchFlag} "${worktreePath}" ${branch}`.trim();

  await execAsync(cmd, { cwd: repoPath });

  return worktreePath;
}

/**
 * Removes a git worktree.
 *
 * @async
 * @function removeWorktree
 * @description
 * Removes a worktree from the repository. This deletes the worktree's
 * administrative files from `.git/worktrees` and optionally removes
 * the working directory.
 *
 * If the worktree is locked, you must either unlock it first or use
 * the `force` parameter. Forcing removal should be used with caution
 * as it may result in loss of uncommitted changes.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 * @param {string} worktreePath - The path to the worktree to remove.
 * @param {boolean} [force=false] - Whether to force removal of locked worktrees.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If the worktree is locked and force is false,
 *   if the path is not a valid worktree, or if permission denied.
 *
 * @example
 * ```typescript
 * // Normal removal
 * await removeWorktree('/home/user/repo', '/tmp/sessions/session-001');
 *
 * // Force removal of a locked worktree
 * await removeWorktree('/home/user/repo', '/tmp/sessions/session-002', true);
 * ```
 *
 * @see {@link lockWorktree} for protecting worktrees from removal
 * @see {@link unlockWorktree} for unlocking before removal
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false,
): Promise<void> {
  const forceFlag = force ? '--force' : '';
  await execAsync(`git worktree remove ${forceFlag} "${worktreePath}"`, { cwd: repoPath });
}

/**
 * Lists all worktrees for a repository.
 *
 * @async
 * @function listWorktrees
 * @description
 * Retrieves information about all worktrees associated with a repository,
 * including the main working directory. Uses the porcelain format for
 * reliable parsing.
 *
 * The returned list includes the main worktree (the original repository)
 * as well as all linked worktrees created with `git worktree add`.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 *
 * @returns {Promise<WorktreeInfo[]>} An array of worktree information objects.
 *
 * @throws {Error} If the path is not inside a git repository.
 *
 * @example
 * ```typescript
 * const worktrees = await listWorktrees('/home/user/repo');
 *
 * for (const wt of worktrees) {
 *   console.log(`Path: ${wt.path}`);
 *   console.log(`Branch: ${wt.branch}`);
 *   console.log(`Locked: ${wt.isLocked}`);
 * }
 *
 * // Filter to find session worktrees
 * const sessionWorktrees = worktrees.filter(wt =>
 *   wt.branch?.includes('session/')
 * );
 * ```
 *
 * @see {@link WorktreeInfo} for the structure of returned objects
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const { stdout } = await execAsync('git worktree list --porcelain', { cwd: repoPath });

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = { path: line.substring(9), isLocked: false, isPrunable: false };
    } else if (line.startsWith('HEAD ')) {
      current.commitHash = line.substring(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7);
    } else if (line === 'locked') {
      current.isLocked = true;
    } else if (line === 'prunable') {
      current.isPrunable = true;
    }
  }

  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return worktrees;
}

/**
 * Prunes stale worktree administrative data.
 *
 * @async
 * @function pruneWorktrees
 * @description
 * Removes worktree information for worktrees whose directories have been
 * deleted without using `git worktree remove`. This cleans up the
 * `.git/worktrees` directory.
 *
 * This is a maintenance operation that should be run periodically,
 * especially after manual cleanup of worktree directories.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If the path is not inside a git repository.
 *
 * @example
 * ```typescript
 * // Run as part of periodic cleanup
 * await pruneWorktrees('/home/user/repo');
 *
 * // Or after manually deleting a worktree directory
 * await fs.rm('/tmp/sessions/old-session', { recursive: true });
 * await pruneWorktrees('/home/user/repo');
 * ```
 */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  await execAsync('git worktree prune', { cwd: repoPath });
}

/**
 * Locks a worktree to prevent removal.
 *
 * @async
 * @function lockWorktree
 * @description
 * Marks a worktree as locked, preventing it from being removed by
 * `git worktree remove` (unless --force is used). This is useful for
 * protecting active sessions from accidental cleanup.
 *
 * Optionally, a reason can be provided which will be displayed when
 * attempting to remove the locked worktree.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 * @param {string} worktreePath - The path to the worktree to lock.
 * @param {string} [reason] - Optional reason for locking (displayed on removal attempts).
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If the worktree is already locked or path is invalid.
 *
 * @example
 * ```typescript
 * // Lock a worktree without a reason
 * await lockWorktree('/home/user/repo', '/tmp/sessions/active-session');
 *
 * // Lock with a descriptive reason
 * await lockWorktree(
 *   '/home/user/repo',
 *   '/tmp/sessions/important-work',
 *   'Agent task in progress - do not remove'
 * );
 * ```
 *
 * @see {@link unlockWorktree} for unlocking
 */
export async function lockWorktree(
  repoPath: string,
  worktreePath: string,
  reason?: string,
): Promise<void> {
  const reasonFlag = reason ? `--reason "${reason}"` : '';
  await execAsync(`git worktree lock ${reasonFlag} "${worktreePath}"`, { cwd: repoPath });
}

/**
 * Unlocks a previously locked worktree.
 *
 * @async
 * @function unlockWorktree
 * @description
 * Removes the lock from a worktree, allowing it to be removed by
 * `git worktree remove`. This should be called when a session is
 * complete and the worktree is ready for cleanup.
 *
 * @param {string} repoPath - The path to the main git repository (or any worktree of it).
 * @param {string} worktreePath - The path to the worktree to unlock.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If the worktree is not locked or path is invalid.
 *
 * @example
 * ```typescript
 * // Unlock before removal
 * await unlockWorktree('/home/user/repo', '/tmp/sessions/completed-session');
 * await removeWorktree('/home/user/repo', '/tmp/sessions/completed-session');
 * ```
 *
 * @see {@link lockWorktree} for locking worktrees
 */
export async function unlockWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await execAsync(`git worktree unlock "${worktreePath}"`, { cwd: repoPath });
}

/**
 * Checks if a path is inside a git repository.
 *
 * @async
 * @function isGitRepo
 * @description
 * Determines whether the given directory path is inside a git repository
 * (either the main repository or a worktree). This is useful for validation
 * before attempting git operations.
 *
 * @param {string} dirPath - The directory path to check.
 *
 * @returns {Promise<boolean>} True if the path is inside a git repository.
 *
 * @example
 * ```typescript
 * if (await isGitRepo('/some/path')) {
 *   const root = await getRepoRoot('/some/path');
 *   console.log(`Repository root: ${root}`);
 * } else {
 *   console.log('Not a git repository');
 * }
 * ```
 *
 * @see {@link getRepoRoot} for getting the repository root path
 */
export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: dirPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the root directory of a git repository.
 *
 * @async
 * @function getRepoRoot
 * @description
 * Returns the absolute path to the root of the git repository containing
 * the given path. Works with both the main repository and worktrees.
 *
 * @param {string} dirPath - A path inside the git repository.
 *
 * @returns {Promise<string>} The absolute path to the repository root.
 *
 * @throws {Error} If the path is not inside a git repository.
 *
 * @example
 * ```typescript
 * // Get root from a subdirectory
 * const root = await getRepoRoot('/home/user/repo/src/components');
 * // Returns: '/home/user/repo'
 *
 * // Get root from a worktree
 * const worktreeRoot = await getRepoRoot('/tmp/sessions/session-001/src');
 * // Returns: '/tmp/sessions/session-001'
 * ```
 */
export async function getRepoRoot(dirPath: string): Promise<string> {
  const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: dirPath });
  return stdout.trim();
}

/**
 * Initializes the .context directory structure in a worktree.
 *
 * @async
 * @function initializeContextDirectory
 * @description
 * Creates the standard `.context` directory structure used by Org Genesis
 * for session context management. This includes:
 *
 * - `activeContext.md` - Currently active context compiled for the session
 * - `progress.md` - Milestone tracking and progress updates
 * - `productContext.md` - Product-specific context injected during compilation
 * - `decisionLog.md` - Record of decisions made during the session
 *
 * This structure follows the Memory Bank architecture pattern, providing
 * a consistent location for context files across all sessions.
 *
 * @param {string} worktreePath - The path to the worktree where context should be initialized.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If directory creation or file writing fails.
 *
 * @example
 * ```typescript
 * // Create worktree and initialize context
 * const worktreePath = await createWorktree('/home/user/repo', {
 *   basePath: '/tmp/sessions',
 *   sessionId: 'new-session',
 *   createBranch: true
 * });
 *
 * await initializeContextDirectory(worktreePath);
 *
 * // Context files are now available at:
 * // /tmp/sessions/new-session/.context/activeContext.md
 * // /tmp/sessions/new-session/.context/progress.md
 * // /tmp/sessions/new-session/.context/productContext.md
 * // /tmp/sessions/new-session/.context/decisionLog.md
 * ```
 *
 * @see https://github.com/org-genesis/architecture for context structure details
 */
export async function initializeContextDirectory(worktreePath: string): Promise<void> {
  const contextPath = path.join(worktreePath, '.context');

  await fs.mkdir(contextPath, { recursive: true });

  // Create initial context files with placeholder content
  await fs.writeFile(
    path.join(contextPath, 'activeContext.md'),
    '# Active Context\n\n_Compiled by Org Genesis_\n',
  );

  await fs.writeFile(
    path.join(contextPath, 'progress.md'),
    '# Progress\n\n## Milestones\n\n_No milestones yet_\n',
  );

  await fs.writeFile(
    path.join(contextPath, 'productContext.md'),
    '# Product Context\n\n_Injected during compilation_\n',
  );

  await fs.writeFile(
    path.join(contextPath, 'decisionLog.md'),
    '# Decision Log\n\n_Decisions will be logged here_\n',
  );
}
