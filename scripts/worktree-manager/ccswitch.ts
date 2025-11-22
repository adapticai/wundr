/**
 * ccswitch-style Worktree Lifecycle Manager
 *
 * Implements automated worktree creation, switching, and cleanup
 * inspired by the ccswitch tool for managing parallel development contexts.
 *
 * This manager handles:
 * - Creating worktrees for new tasks/sessions
 * - Switching between active worktrees
 * - Pausing and resuming work contexts
 * - Cleaning up after PR merges
 * - Session memory persistence and restoration
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
 * Status of a worktree lifecycle
 */
export type WorktreeStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'merged'
  | 'error';

/**
 * Represents a worktree's lifecycle state
 */
export interface WorktreeLifecycle {
  /** Unique identifier for the task/session */
  taskId: string;
  /** Git branch name associated with the worktree */
  branchName: string;
  /** Absolute path to the worktree directory */
  worktreePath: string;
  /** Session ID that owns this worktree */
  sessionId: string;
  /** Timestamp when the worktree was created */
  createdAt: Date;
  /** Current status of the worktree */
  status: WorktreeStatus;
  /** Timestamp of last activity */
  lastActivityAt?: Date;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Metadata for the worktree */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the WorktreeLifecycleManager
 */
export interface WorktreeManagerConfig {
  /** Root directory for worktrees (default: .git-worktrees) */
  worktreeRoot?: string;
  /** Path to the main git repository */
  repoPath: string;
  /** Path to memory bank for session state */
  memoryBankPath?: string;
  /** Maximum number of concurrent worktrees */
  maxWorktrees?: number;
  /** Default base branch for new worktrees */
  defaultBaseBranch?: string;
  /** Whether to auto-cleanup merged branches */
  autoCleanupMerged?: boolean;
  /** Session ID for this manager instance */
  sessionId?: string;
}

/**
 * Result of a worktree operation
 */
export interface WorktreeOperationResult {
  success: boolean;
  message: string;
  worktree?: WorktreeLifecycle;
  error?: Error;
}

/**
 * Session memory structure for persistence
 */
interface SessionMemory {
  taskId: string;
  activeContext: string;
  progress: string;
  lastCheckpoint: Date;
  worktreePath: string;
  branchName: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown for worktree-related operations
 */
export class WorktreeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly taskId?: string
  ) {
    super(message);
    this.name = 'WorktreeError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ============================================================================
// WorktreeLifecycleManager Class
// ============================================================================

/**
 * Manages worktree lifecycle operations following ccswitch patterns.
 *
 * Provides automated worktree creation, switching, and cleanup with
 * session memory persistence for seamless context restoration.
 */
export class WorktreeLifecycleManager {
  private activeWorktrees: Map<string, WorktreeLifecycle> = new Map();
  private worktreeRoot: string;
  private currentSessionId: string;
  private readonly config: Required<WorktreeManagerConfig>;
  private initialized: boolean = false;

  constructor(config: WorktreeManagerConfig) {
    this.config = {
      worktreeRoot:
        config.worktreeRoot || path.join(config.repoPath, '.git-worktrees'),
      repoPath: config.repoPath,
      memoryBankPath:
        config.memoryBankPath ||
        path.join(config.repoPath, '.claude', 'memory'),
      maxWorktrees: config.maxWorktrees || 20,
      defaultBaseBranch: config.defaultBaseBranch || 'main',
      autoCleanupMerged: config.autoCleanupMerged ?? true,
      sessionId: config.sessionId || this.generateSessionId(),
    };

    this.worktreeRoot = this.config.worktreeRoot;
    this.currentSessionId = this.config.sessionId;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Initialize the manager and load existing worktrees
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure worktree root exists
    await this.ensureDirectory(this.worktreeRoot);

    // Ensure memory bank exists
    await this.ensureDirectory(this.config.memoryBankPath);
    await this.ensureDirectory(
      path.join(this.config.memoryBankPath, 'sessions')
    );

    // Load existing worktrees from git
    await this.loadExistingWorktrees();

    this.initialized = true;
  }

  /**
   * Create a new worktree for a task (ccswitch create)
   *
   * @param taskId - Unique identifier for the task
   * @param baseBranch - Base branch to create from (default: main)
   * @returns The created WorktreeLifecycle
   */
  async createForTask(
    taskId: string,
    baseBranch?: string
  ): Promise<WorktreeLifecycle> {
    await this.ensureInitialized();

    // Validate task ID
    if (!taskId || taskId.trim() === '') {
      throw new WorktreeError('Task ID cannot be empty', 'INVALID_TASK_ID');
    }

    // Check if worktree already exists for this task
    if (this.activeWorktrees.has(taskId)) {
      throw new WorktreeError(
        `Worktree already exists for task ${taskId}`,
        'WORKTREE_EXISTS',
        taskId
      );
    }

    // Check worktree limit
    if (this.activeWorktrees.size >= this.config.maxWorktrees) {
      throw new WorktreeError(
        `Maximum worktree limit (${this.config.maxWorktrees}) reached`,
        'WORKTREE_LIMIT_REACHED'
      );
    }

    const effectiveBaseBranch = baseBranch || this.config.defaultBaseBranch;
    const branchName = this.generateBranchName(taskId);
    const worktreePath = path.join(this.worktreeRoot, 'sessions', taskId);

    try {
      // Ensure sessions directory exists
      await this.ensureDirectory(path.join(this.worktreeRoot, 'sessions'));

      // Fetch latest from remote to ensure base branch is up to date
      await this.executeGitCommand(
        'fetch',
        ['origin', effectiveBaseBranch],
        this.config.repoPath
      );

      // Create the worktree with a new branch
      await this.executeGitCommand(
        'worktree',
        [
          'add',
          '-b',
          branchName,
          worktreePath,
          `origin/${effectiveBaseBranch}`,
        ],
        this.config.repoPath
      );

      const lifecycle: WorktreeLifecycle = {
        taskId,
        branchName,
        worktreePath,
        sessionId: this.currentSessionId,
        createdAt: new Date(),
        status: 'active',
        lastActivityAt: new Date(),
      };

      this.activeWorktrees.set(taskId, lifecycle);

      // Initialize session memory
      await this.initializeSessionMemory(taskId, lifecycle);

      return lifecycle;
    } catch (error) {
      // Clean up on failure
      await this.cleanupFailedWorktree(worktreePath, branchName);
      throw new WorktreeError(
        `Failed to create worktree for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_FAILED',
        taskId
      );
    }
  }

  /**
   * Switch context to an existing worktree (ccswitch switch)
   *
   * @param taskId - Task ID of the worktree to switch to
   */
  async switchTo(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }

    if (lifecycle.status === 'merged' || lifecycle.status === 'completed') {
      throw new WorktreeError(
        `Cannot switch to ${lifecycle.status} worktree`,
        'INVALID_STATUS',
        taskId
      );
    }

    // Verify worktree still exists
    const exists = await this.directoryExists(lifecycle.worktreePath);
    if (!exists) {
      lifecycle.status = 'error';
      lifecycle.errorMessage = 'Worktree directory no longer exists';
      throw new WorktreeError(
        'Worktree directory no longer exists',
        'WORKTREE_MISSING',
        taskId
      );
    }

    // Update status and activity
    lifecycle.status = 'active';
    lifecycle.lastActivityAt = new Date();

    // Load session memory for context restoration
    await this.loadSessionMemory(taskId);

    // Change to worktree directory
    process.chdir(lifecycle.worktreePath);
  }

  /**
   * Pause a worktree context (preserves state for later resumption)
   *
   * @param taskId - Task ID to pause
   */
  async pause(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }

    if (lifecycle.status !== 'active') {
      throw new WorktreeError(
        `Cannot pause worktree with status: ${lifecycle.status}`,
        'INVALID_STATUS',
        taskId
      );
    }

    // Save current session state before pausing
    await this.saveSessionMemory(taskId);

    lifecycle.status = 'paused';
    lifecycle.lastActivityAt = new Date();
  }

  /**
   * Resume a paused worktree
   *
   * @param taskId - Task ID to resume
   */
  async resume(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }

    if (lifecycle.status !== 'paused') {
      throw new WorktreeError(
        `Cannot resume worktree with status: ${lifecycle.status}`,
        'INVALID_STATUS',
        taskId
      );
    }

    // Restore session memory
    await this.loadSessionMemory(taskId);

    lifecycle.status = 'active';
    lifecycle.lastActivityAt = new Date();

    // Switch to the worktree
    process.chdir(lifecycle.worktreePath);
  }

  /**
   * Get the status of a specific worktree
   *
   * @param taskId - Task ID to check
   * @returns Current WorktreeStatus
   */
  getStatus(taskId: string): WorktreeStatus {
    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }
    return lifecycle.status;
  }

  /**
   * Clean up worktree after PR is merged (ccswitch cleanup)
   *
   * @param taskId - Task ID to clean up
   */
  async cleanupAfterMerge(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }

    try {
      // Archive session memory before cleanup
      await this.archiveSessionMemory(taskId);

      // Remove the worktree
      await this.executeGitCommand(
        'worktree',
        ['remove', lifecycle.worktreePath, '--force'],
        this.config.repoPath
      );

      // Try to delete the branch (may fail if already deleted)
      try {
        await this.executeGitCommand(
          'branch',
          ['-d', lifecycle.branchName],
          this.config.repoPath
        );
      } catch {
        // Branch might already be deleted or force required
        try {
          await this.executeGitCommand(
            'branch',
            ['-D', lifecycle.branchName],
            this.config.repoPath
          );
        } catch {
          // Ignore branch deletion errors
        }
      }

      lifecycle.status = 'merged';
      this.activeWorktrees.delete(taskId);
    } catch (error) {
      throw new WorktreeError(
        `Failed to cleanup worktree for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
        'CLEANUP_FAILED',
        taskId
      );
    }
  }

  /**
   * List active worktrees for current session
   *
   * @returns Array of WorktreeLifecycle for current session
   */
  async list(): Promise<WorktreeLifecycle[]> {
    await this.ensureInitialized();

    return Array.from(this.activeWorktrees.values()).filter(
      wt => wt.sessionId === this.currentSessionId
    );
  }

  /**
   * List all worktrees across all sessions
   *
   * @returns Array of all WorktreeLifecycle entries
   */
  async listAll(): Promise<WorktreeLifecycle[]> {
    await this.ensureInitialized();
    return Array.from(this.activeWorktrees.values());
  }

  /**
   * Get a specific worktree by task ID
   *
   * @param taskId - Task ID to look up
   * @returns WorktreeLifecycle or undefined
   */
  get(taskId: string): WorktreeLifecycle | undefined {
    return this.activeWorktrees.get(taskId);
  }

  /**
   * Mark a worktree as completed (work done, awaiting merge)
   *
   * @param taskId - Task ID to mark completed
   */
  async markCompleted(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      throw new WorktreeError(
        `No worktree found for task ${taskId}`,
        'WORKTREE_NOT_FOUND',
        taskId
      );
    }

    // Save final state
    await this.saveSessionMemory(taskId);

    lifecycle.status = 'completed';
    lifecycle.lastActivityAt = new Date();
  }

  /**
   * Prune stale worktrees that no longer have valid directories
   */
  async pruneStale(): Promise<string[]> {
    await this.ensureInitialized();

    const prunedTasks: string[] = [];

    const entries = Array.from(this.activeWorktrees.entries());
    for (const entry of entries) {
      const [taskId, lifecycle] = entry;
      const exists = await this.directoryExists(lifecycle.worktreePath);
      if (!exists) {
        prunedTasks.push(taskId);
        this.activeWorktrees.delete(taskId);
      }
    }

    // Also run git worktree prune
    try {
      await this.executeGitCommand('worktree', ['prune'], this.config.repoPath);
    } catch {
      // Ignore prune errors
    }

    return prunedTasks;
  }

  // ==========================================================================
  // Private Methods - Session Memory Management
  // ==========================================================================

  /**
   * Initialize session memory for a new worktree
   */
  private async initializeSessionMemory(
    taskId: string,
    lifecycle: WorktreeLifecycle
  ): Promise<void> {
    const sessionDir = path.join(
      this.config.memoryBankPath,
      'sessions',
      taskId
    );
    await this.ensureDirectory(sessionDir);

    const memory: SessionMemory = {
      taskId,
      activeContext: `# Active Context - Task ${taskId}\n\n## Current Focus\nNewly created worktree.\n\n## Working Memory\n- Last action: Worktree created\n- Next planned step: Begin implementation\n- Blockers: None`,
      progress: `# Progress - Task ${taskId}\n\n## Milestones\n- [ ] Implementation started\n- [ ] Tests written\n- [ ] Code reviewed\n- [ ] Merged to main`,
      lastCheckpoint: new Date(),
      worktreePath: lifecycle.worktreePath,
      branchName: lifecycle.branchName,
    };

    await this.writeSessionMemory(taskId, memory);
  }

  /**
   * Load session memory for context restoration
   */
  private async loadSessionMemory(taskId: string): Promise<void> {
    const memoryPath = path.join(
      this.config.memoryBankPath,
      'sessions',
      taskId,
      'session.json'
    );

    try {
      const exists = await this.fileExists(memoryPath);
      if (!exists) {
        return;
      }

      const content = await fsPromises.readFile(memoryPath, 'utf-8');
      const memory: SessionMemory = JSON.parse(content);

      // Update lifecycle with restored metadata
      const lifecycle = this.activeWorktrees.get(taskId);
      if (lifecycle) {
        lifecycle.metadata = memory.metadata;
      }
    } catch {
      // Session memory is optional, don't fail if missing
    }
  }

  /**
   * Save current session memory
   */
  private async saveSessionMemory(taskId: string): Promise<void> {
    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) {
      return;
    }

    const memory: SessionMemory = {
      taskId,
      activeContext: `# Active Context - Task ${taskId}\n\nLast saved: ${new Date().toISOString()}`,
      progress: `# Progress - Task ${taskId}\n\nStatus: ${lifecycle.status}`,
      lastCheckpoint: new Date(),
      worktreePath: lifecycle.worktreePath,
      branchName: lifecycle.branchName,
      metadata: lifecycle.metadata,
    };

    await this.writeSessionMemory(taskId, memory);
  }

  /**
   * Write session memory to disk
   */
  private async writeSessionMemory(
    taskId: string,
    memory: SessionMemory
  ): Promise<void> {
    const sessionDir = path.join(
      this.config.memoryBankPath,
      'sessions',
      taskId
    );
    await this.ensureDirectory(sessionDir);

    const memoryPath = path.join(sessionDir, 'session.json');
    await fsPromises.writeFile(
      memoryPath,
      JSON.stringify(memory, null, 2),
      'utf-8'
    );

    // Also write human-readable markdown files
    const contextPath = path.join(sessionDir, 'activeContext.md');
    await fsPromises.writeFile(contextPath, memory.activeContext, 'utf-8');

    const progressPath = path.join(sessionDir, 'progress.md');
    await fsPromises.writeFile(progressPath, memory.progress, 'utf-8');
  }

  /**
   * Archive session memory before cleanup
   */
  private async archiveSessionMemory(taskId: string): Promise<void> {
    const sessionDir = path.join(
      this.config.memoryBankPath,
      'sessions',
      taskId
    );
    const archiveDir = path.join(this.config.memoryBankPath, 'archive', taskId);

    const sessionExists = await this.directoryExists(sessionDir);
    if (!sessionExists) {
      return;
    }

    try {
      await this.ensureDirectory(
        path.join(this.config.memoryBankPath, 'archive')
      );

      // Copy session directory to archive
      await fsPromises.cp(sessionDir, archiveDir, { recursive: true });

      // Add archive metadata
      const archiveMetadata = {
        archivedAt: new Date().toISOString(),
        taskId,
        reason: 'merged',
      };

      await fsPromises.writeFile(
        path.join(archiveDir, 'archive-metadata.json'),
        JSON.stringify(archiveMetadata, null, 2),
        'utf-8'
      );

      // Remove original session directory
      await fsPromises.rm(sessionDir, { recursive: true, force: true });
    } catch {
      // Archive is best-effort, don't fail cleanup
    }
  }

  // ==========================================================================
  // Private Methods - Git Operations
  // ==========================================================================

  /**
   * Execute a git command with proper error handling
   */
  private async executeGitCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<string> {
    const fullCommand = `git ${command} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, { cwd });
      if (stderr && !stderr.includes('warning')) {
        // Some git commands output to stderr even on success
      }
      return stdout.trim();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Git command failed: ${fullCommand}\n${errorMessage}`);
    }
  }

  /**
   * Load existing worktrees from git into internal state
   */
  private async loadExistingWorktrees(): Promise<void> {
    try {
      const output = await this.executeGitCommand(
        'worktree',
        ['list', '--porcelain'],
        this.config.repoPath
      );

      const worktrees = this.parseWorktreeList(output);

      for (const wt of worktrees) {
        // Skip the main worktree
        if (wt.worktreePath === this.config.repoPath) {
          continue;
        }

        // Extract task ID from path if it matches our pattern
        const taskId = this.extractTaskIdFromPath(wt.worktreePath);
        if (taskId && !this.activeWorktrees.has(taskId)) {
          const lifecycle: WorktreeLifecycle = {
            taskId,
            branchName: wt.branch || `task/${taskId}`,
            worktreePath: wt.worktreePath,
            sessionId: 'unknown', // Will be updated when claimed
            createdAt: new Date(), // Approximate
            status: 'paused', // Assume paused until resumed
          };
          this.activeWorktrees.set(taskId, lifecycle);
        }
      }
    } catch {
      // If git worktree list fails, start with empty state
    }
  }

  /**
   * Parse git worktree list --porcelain output
   */
  private parseWorktreeList(
    output: string
  ): Array<{ worktreePath: string; branch?: string }> {
    const worktrees: Array<{ worktreePath: string; branch?: string }> = [];
    const lines = output.split('\n');

    let current: { worktreePath: string; branch?: string } | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current) {
          worktrees.push(current);
        }
        current = { worktreePath: line.substring('worktree '.length) };
      } else if (line.startsWith('branch ') && current) {
        current.branch = line.substring('branch refs/heads/'.length);
      }
    }

    if (current) {
      worktrees.push(current);
    }

    return worktrees;
  }

  /**
   * Clean up a failed worktree creation
   */
  private async cleanupFailedWorktree(
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    try {
      // Try to remove the worktree
      await this.executeGitCommand(
        'worktree',
        ['remove', worktreePath, '--force'],
        this.config.repoPath
      );
    } catch {
      // Worktree might not exist
    }

    try {
      // Try to delete the branch
      await this.executeGitCommand(
        'branch',
        ['-D', branchName],
        this.config.repoPath
      );
    } catch {
      // Branch might not exist
    }

    // Clean up directory if it exists
    try {
      const exists = await this.directoryExists(worktreePath);
      if (exists) {
        await fsPromises.rm(worktreePath, { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist
    }
  }

  // ==========================================================================
  // Private Methods - Utility Functions
  // ==========================================================================

  /**
   * Ensure the manager is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Generate a branch name for a task
   */
  private generateBranchName(taskId: string): string {
    // Sanitize task ID for use in branch name
    const sanitized = taskId
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `task/${sanitized}`;
  }

  /**
   * Extract task ID from a worktree path
   */
  private extractTaskIdFromPath(worktreePath: string): string | null {
    // Expected pattern: .git-worktrees/sessions/{taskId}
    const sessionsDir = path.join(this.worktreeRoot, 'sessions');
    if (worktreePath.startsWith(sessionsDir)) {
      const relativePath = worktreePath.substring(sessionsDir.length + 1);
      const taskId = relativePath.split(path.sep)[0];
      return taskId || null;
    }
    return null;
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fsPromises.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fsPromises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WorktreeLifecycleManager instance
 *
 * @param config - Configuration options
 * @returns Initialized WorktreeLifecycleManager
 *
 * @example
 * ```typescript
 * const manager = await createWorktreeManager({
 *   repoPath: '/path/to/repo',
 *   maxWorktrees: 10,
 * });
 *
 * // Create a worktree for a new task
 * const worktree = await manager.createForTask('feature-123');
 *
 * // Switch to an existing worktree
 * await manager.switchTo('feature-123');
 *
 * // Clean up after merge
 * await manager.cleanupAfterMerge('feature-123');
 * ```
 */
export async function createWorktreeManager(
  config: WorktreeManagerConfig
): Promise<WorktreeLifecycleManager> {
  const manager = new WorktreeLifecycleManager(config);
  await manager.initialize();
  return manager;
}

// ============================================================================
// Exports
// ============================================================================

export default WorktreeLifecycleManager;
