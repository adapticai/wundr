/**
 * Claude Session Spawner
 *
 * Manages the actual spawning and lifecycle of Claude Code CLI child processes.
 * Each spawned session is an OS process running `claude` with the appropriate
 * flags, working directory, and configuration written by SessionConfigWriter.
 *
 * Responsibilities:
 * - Spawn `claude` CLI processes via child_process.spawn
 * - Set up working directories (including git worktrees when requested)
 * - Capture and accumulate stdout/stderr streams per session
 * - Pipe stdin messages to running sessions
 * - Monitor process health and handle unexpected exits
 * - Graceful termination: SIGTERM first, then SIGKILL after timeout
 * - Automatic restart on crash (up to configuredMaxRestarts)
 * - Cleanup of working directories and config files on teardown
 */

import { type ChildProcess, spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Logger } from '../utils/logger';
import {
  writeSessionConfig,
  cleanupSessionConfig,
} from './session-config-writer';

import type { SessionConfigOptions } from './session-config-writer';
import type { OrchestratorCharter } from '../types';
import type { AgentDefinition } from '../agents/agent-types';

// =============================================================================
// Types
// =============================================================================

export interface ClaudeSessionConfig {
  /** Unique session identifier */
  readonly sessionId: string;
  /** Working directory for the Claude process. Created if absent. */
  readonly workDir: string;
  /** Whether to use a git worktree instead of a plain directory */
  readonly useWorktree?: boolean;
  /** Base git repository path (required when useWorktree is true) */
  readonly repoPath?: string;
  /** Branch name for the worktree (defaults to sessionId) */
  readonly worktreeBranch?: string;
  /** Orchestrator charter to write into CLAUDE.md */
  readonly charter?: OrchestratorCharter | null;
  /** Session discipline / role description */
  readonly discipline?: string;
  /** Agent definitions to write as .claude/agents/*.md */
  readonly agents?: AgentDefinition[];
  /** Whether to pass --dangerously-skip-permissions to the claude CLI */
  readonly dangerouslySkipPermissions?: boolean;
  /** Extra environment variables for the child process */
  readonly env?: Record<string, string>;
  /** Maximum number of automatic restarts after unexpected exit. Default: 2 */
  readonly maxRestarts?: number;
  /** Milliseconds to wait for SIGTERM before sending SIGKILL. Default: 5000 */
  readonly killTimeoutMs?: number;
  /** Additional CLI flags to pass to `claude` */
  readonly extraFlags?: string[];
  /** Initial prompt/message to send once the process is ready */
  readonly initialPrompt?: string;
}

export interface ActiveSession {
  readonly sessionId: string;
  readonly config: ClaudeSessionConfig;
  process: ChildProcess;
  pid: number;
  stdoutBuffer: string;
  stderrBuffer: string;
  startedAt: Date;
  restartCount: number;
  worktreeCreated: boolean;
  agentIdsWritten: string[];
  /** Resolves when the process exits (whether naturally or via kill) */
  exitPromise: Promise<number | null>;
}

export interface SessionListEntry {
  sessionId: string;
  pid: number;
  startedAt: Date;
  restartCount: number;
  workDir: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RESTARTS = 2;
const DEFAULT_KILL_TIMEOUT_MS = 5_000;
const SIGTERM_GRACE_PERIOD_MS = 5_000;

// =============================================================================
// Claude Session Spawner
// =============================================================================

export class ClaudeSessionSpawner {
  private readonly logger: Logger;
  private readonly sessions: Map<string, ActiveSession> = new Map();

  constructor() {
    this.logger = new Logger('ClaudeSessionSpawner');
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Spawns a new Claude Code CLI process for the given session configuration.
   *
   * Steps:
   * 1. Prepare working directory (plain mkdir or git worktree)
   * 2. Write CLAUDE.md, .claude/settings.json, .claude/agents/*.md
   * 3. Launch the `claude` CLI process with appropriate flags
   * 4. Attach stdout/stderr listeners and start output accumulation
   * 5. Set up exit handler for crash detection and optional restart
   *
   * @throws Error if `claude` binary is not found or the working directory
   *         cannot be created.
   */
  async spawnClaudeSession(
    config: ClaudeSessionConfig
  ): Promise<ActiveSession> {
    if (this.sessions.has(config.sessionId)) {
      throw new Error(
        `Session "${config.sessionId}" is already active. Stop it first before re-spawning.`
      );
    }

    this.logger.info(`Spawning Claude session: ${config.sessionId}`);

    // -------------------------------------------------------------------------
    // Step 1: Prepare working directory
    // -------------------------------------------------------------------------
    let worktreeCreated = false;

    if (config.useWorktree && config.repoPath) {
      worktreeCreated = await this.createWorktree(config);
    } else {
      fs.mkdirSync(config.workDir, { recursive: true });
    }

    // -------------------------------------------------------------------------
    // Step 2: Write session configuration files
    // -------------------------------------------------------------------------
    const configOptions: SessionConfigOptions = {
      charter: config.charter ?? null,
      discipline: config.discipline,
      agents: config.agents,
      allowDangerousPermissions: config.dangerouslySkipPermissions ?? false,
      environment: config.env,
    };

    await writeSessionConfig(config.workDir, configOptions);

    const agentIdsWritten = (config.agents ?? []).map(a => a.id);

    // -------------------------------------------------------------------------
    // Step 3: Build CLI command
    // -------------------------------------------------------------------------
    const claudeBin = this.resolveClaudeBin();
    const args = this.buildCliArgs(config);

    this.logger.debug(
      `Claude command: ${claudeBin} ${args.join(' ')} (cwd: ${config.workDir})`
    );

    // -------------------------------------------------------------------------
    // Step 4: Launch process
    // -------------------------------------------------------------------------
    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(config.env ?? {}),
    };

    const child = spawn(claudeBin, args, {
      cwd: config.workDir,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!child.pid) {
      throw new Error(
        `Failed to spawn Claude process for session "${config.sessionId}". ` +
          `Ensure the 'claude' CLI is installed and on your PATH.`
      );
    }

    this.logger.info(
      `Claude process spawned for session ${config.sessionId} (PID: ${child.pid})`
    );

    // -------------------------------------------------------------------------
    // Step 5: Wire up stream listeners
    // -------------------------------------------------------------------------
    const exitPromise = new Promise<number | null>(resolve => {
      child.on('exit', (code, signal) => {
        this.logger.info(
          `Session ${config.sessionId} process exited (code: ${code}, signal: ${signal})`
        );
        resolve(code);
      });
    });

    const session: ActiveSession = {
      sessionId: config.sessionId,
      config,
      process: child,
      pid: child.pid,
      stdoutBuffer: '',
      stderrBuffer: '',
      startedAt: new Date(),
      restartCount: 0,
      worktreeCreated,
      agentIdsWritten,
      exitPromise,
    };

    this.attachStreamListeners(session);

    this.sessions.set(config.sessionId, session);

    // Attach exit/crash handler after storing the session so the handler can
    // reference it.
    this.attachExitHandler(session);

    // -------------------------------------------------------------------------
    // Step 6: Send initial prompt if provided
    // -------------------------------------------------------------------------
    if (config.initialPrompt) {
      // Small delay to allow the process to initialise before receiving input
      await delay(200);
      this.sendToSession(config.sessionId, config.initialPrompt);
    }

    return session;
  }

  /**
   * Pipes a text message to the stdin of a running Claude session.
   *
   * @throws Error if the session is not found or the process stdin is not writable.
   */
  sendToSession(sessionId: string, message: string): void {
    const session = this.requireSession(sessionId);

    if (!session.process.stdin || session.process.stdin.destroyed) {
      throw new Error(
        `Session "${sessionId}" stdin is not writable. The process may have exited.`
      );
    }

    const payload = message.endsWith('\n') ? message : `${message}\n`;
    session.process.stdin.write(payload, 'utf-8');

    this.logger.debug(`Sent ${payload.length} bytes to session ${sessionId}`);
  }

  /**
   * Returns the accumulated stdout output for a session.
   * The buffer grows as the process writes to stdout; it is never cleared
   * automatically so callers can read it at any point.
   */
  getSessionOutput(sessionId: string): string {
    const session = this.requireSession(sessionId);
    return session.stdoutBuffer;
  }

  /**
   * Returns the accumulated stderr output for a session.
   */
  getSessionErrors(sessionId: string): string {
    const session = this.requireSession(sessionId);
    return session.stderrBuffer;
  }

  /**
   * Terminates a session's Claude process gracefully.
   *
   * Sequence:
   * 1. Send SIGTERM and wait up to killTimeoutMs for the process to exit
   * 2. If still alive, send SIGKILL
   * 3. Remove working directory config files
   * 4. Remove the git worktree if one was created
   * 5. Delete the session record
   *
   * Safe to call on already-exited sessions; will still clean up resources.
   */
  async killSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(
        `killSession: session "${sessionId}" not found; nothing to kill.`
      );
      return;
    }

    this.logger.info(`Killing session: ${sessionId} (PID: ${session.pid})`);

    const killTimeoutMs =
      session.config.killTimeoutMs ?? DEFAULT_KILL_TIMEOUT_MS;

    const processAlive =
      !session.process.killed && session.process.exitCode === null;

    if (processAlive) {
      // Graceful termination
      session.process.kill('SIGTERM');

      const terminated = await Promise.race([
        session.exitPromise.then(() => true),
        delay(killTimeoutMs).then(() => false),
      ]);

      if (!terminated) {
        this.logger.warn(
          `Session ${sessionId} did not exit after SIGTERM; sending SIGKILL`
        );
        session.process.kill('SIGKILL');
        // Wait briefly for SIGKILL to take effect
        await delay(500);
      }
    }

    // Close stdin to prevent write-after-destroy errors
    if (session.process.stdin && !session.process.stdin.destroyed) {
      session.process.stdin.destroy();
    }

    // Clean up config files
    try {
      cleanupSessionConfig(session.config.workDir, session.agentIdsWritten);
    } catch (err) {
      this.logger.warn(
        `Error cleaning session config for ${sessionId}: ${String(err)}`
      );
    }

    // Remove worktree if we created one
    if (session.worktreeCreated && session.config.repoPath) {
      try {
        this.removeWorktree(session.config);
      } catch (err) {
        this.logger.warn(
          `Error removing worktree for ${sessionId}: ${String(err)}`
        );
      }
    }

    this.sessions.delete(sessionId);
    this.logger.info(`Session ${sessionId} terminated and cleaned up`);
  }

  /**
   * Returns a snapshot of all currently tracked sessions with basic metadata.
   */
  listActiveSessions(): SessionListEntry[] {
    const result: SessionListEntry[] = [];
    for (const session of this.sessions.values()) {
      result.push({
        sessionId: session.sessionId,
        pid: session.pid,
        startedAt: session.startedAt,
        restartCount: session.restartCount,
        workDir: session.config.workDir,
      });
    }
    return result;
  }

  /**
   * Returns the raw ActiveSession record for a given session ID, or undefined.
   */
  getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Returns true if the given session has an alive process.
   */
  isSessionAlive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    return !session.process.killed && session.process.exitCode === null;
  }

  /**
   * Kills all active sessions. Intended for daemon shutdown.
   */
  async killAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    this.logger.info(
      `Killing all ${sessionIds.length} active Claude session(s)...`
    );

    await Promise.allSettled(sessionIds.map(id => this.killSession(id)));
  }

  // ===========================================================================
  // Private: Process Management
  // ===========================================================================

  private attachStreamListeners(session: ActiveSession): void {
    const { sessionId } = session;

    session.process.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      session.stdoutBuffer += text;
      this.logger.debug(`[${sessionId}] stdout: ${text.slice(0, 200)}`);
    });

    session.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      session.stderrBuffer += text;
      this.logger.debug(`[${sessionId}] stderr: ${text.slice(0, 200)}`);
    });

    session.process.stdout?.on('error', (err: Error) => {
      this.logger.warn(`[${sessionId}] stdout stream error: ${err.message}`);
    });

    session.process.stderr?.on('error', (err: Error) => {
      this.logger.warn(`[${sessionId}] stderr stream error: ${err.message}`);
    });
  }

  /**
   * Attaches an exit handler to handle crashes and automatic restarts.
   *
   * On unexpected exit (non-zero code or signal kill) the handler will
   * attempt to restart the session up to maxRestarts times. Each restart
   * increments `session.restartCount`.
   */
  private attachExitHandler(session: ActiveSession): void {
    const { sessionId } = session;

    session.process.on('exit', async (code, signal) => {
      // If we killed it ourselves, it will have already been removed from the
      // sessions map; skip restart logic.
      const current = this.sessions.get(sessionId);
      if (!current) {
        return;
      }

      const maxRestarts = current.config.maxRestarts ?? DEFAULT_MAX_RESTARTS;
      const isUnexpected = code !== 0 || signal !== null;

      if (isUnexpected && current.restartCount < maxRestarts) {
        const nextRestart = current.restartCount + 1;
        this.logger.warn(
          `Session ${sessionId} exited unexpectedly (code: ${code}, signal: ${signal}). ` +
            `Attempting restart ${nextRestart}/${maxRestarts}...`
        );

        try {
          await this.restartSession(current);
        } catch (err) {
          this.logger.error(
            `Failed to restart session ${sessionId}: ${String(err)}`
          );
          this.sessions.delete(sessionId);
        }
      } else {
        if (isUnexpected) {
          this.logger.error(
            `Session ${sessionId} exited unexpectedly and has exhausted restart attempts ` +
              `(${current.restartCount}/${maxRestarts}). Session will not be restarted.`
          );
        } else {
          this.logger.info(`Session ${sessionId} exited cleanly.`);
        }
        this.sessions.delete(sessionId);
      }
    });

    session.process.on('error', (err: Error) => {
      this.logger.error(`Session ${sessionId} process error: ${err.message}`);
    });
  }

  /**
   * Restarts a session by spawning a fresh process in the same working
   * directory without rewriting config files (they already exist).
   */
  private async restartSession(session: ActiveSession): Promise<void> {
    const { sessionId, config } = session;
    const prevRestartCount = session.restartCount;

    this.logger.info(`Restarting session ${sessionId}...`);

    const claudeBin = this.resolveClaudeBin();
    const args = this.buildCliArgs(config);

    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(config.env ?? {}),
    };

    const child = spawn(claudeBin, args, {
      cwd: config.workDir,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!child.pid) {
      throw new Error(
        `Failed to restart Claude process for session "${sessionId}".`
      );
    }

    this.logger.info(
      `Session ${sessionId} restarted (PID: ${child.pid}, restart #${prevRestartCount + 1})`
    );

    const exitPromise = new Promise<number | null>(resolve => {
      child.on('exit', code => resolve(code));
    });

    const newSession: ActiveSession = {
      ...session,
      process: child,
      pid: child.pid,
      stdoutBuffer: session.stdoutBuffer, // preserve accumulated output
      stderrBuffer: session.stderrBuffer,
      startedAt: new Date(),
      restartCount: prevRestartCount + 1,
      exitPromise,
    };

    this.attachStreamListeners(newSession);
    this.sessions.set(sessionId, newSession);
    this.attachExitHandler(newSession);
  }

  // ===========================================================================
  // Private: CLI Construction
  // ===========================================================================

  /**
   * Resolves the `claude` binary path. Checks $PATH; throws if not found.
   */
  private resolveClaudeBin(): string {
    // Allow override via env var for testing or custom installations
    const envOverride = process.env['CLAUDE_BIN'];
    if (envOverride) {
      return envOverride;
    }

    try {
      const result = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (result) {
        return result;
      }
    } catch {
      // which failed; try common locations
    }

    // Common npm global install locations
    const candidates = [
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      path.join(process.env['HOME'] ?? '', '.npm-global', 'bin', 'claude'),
      path.join(
        process.env['HOME'] ?? '',
        '.local',
        'share',
        'npm',
        'bin',
        'claude'
      ),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'
    );
  }

  /**
   * Builds the argument list for the `claude` CLI invocation.
   */
  private buildCliArgs(config: ClaudeSessionConfig): string[] {
    const args: string[] = [];

    // Non-interactive mode: print result to stdout and exit
    args.push('--print');

    // Skip confirmation prompts for permissions when configured
    if (config.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Any additional flags passed by the caller
    if (config.extraFlags && config.extraFlags.length > 0) {
      args.push(...config.extraFlags);
    }

    return args;
  }

  // ===========================================================================
  // Private: Git Worktree Management
  // ===========================================================================

  /**
   * Creates a git worktree at config.workDir branched from config.repoPath.
   * The worktree branch name defaults to the sessionId.
   *
   * @returns true if the worktree was created, false if workDir already exists.
   */
  private async createWorktree(config: ClaudeSessionConfig): Promise<boolean> {
    const repoPath = config.repoPath!;
    const worktreePath = config.workDir;
    const branch = config.worktreeBranch ?? `session/${config.sessionId}`;

    // Don't create if the worktree path already exists
    if (fs.existsSync(worktreePath)) {
      this.logger.debug(
        `Worktree path already exists: ${worktreePath}; skipping creation`
      );
      return false;
    }

    this.logger.info(
      `Creating git worktree at ${worktreePath} (branch: ${branch})`
    );

    try {
      // Create an orphan worktree on a new branch derived from HEAD
      execSync(
        `git -C "${repoPath}" worktree add -b "${branch}" "${worktreePath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (err: unknown) {
      // If the branch already exists try without -b
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already exists')) {
        execSync(
          `git -C "${repoPath}" worktree add "${worktreePath}" "${branch}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } else {
        throw err;
      }
    }

    this.logger.info(`Git worktree created successfully at ${worktreePath}`);
    return true;
  }

  /**
   * Removes the git worktree that was created for a session.
   */
  private removeWorktree(config: ClaudeSessionConfig): void {
    const repoPath = config.repoPath!;
    const worktreePath = config.workDir;

    if (!fs.existsSync(worktreePath)) {
      return;
    }

    this.logger.info(`Removing git worktree: ${worktreePath}`);

    try {
      execSync(
        `git -C "${repoPath}" worktree remove --force "${worktreePath}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (err) {
      this.logger.warn(
        `Failed to remove worktree via git: ${String(err)}. ` +
          `Falling back to rmdir.`
      );
      // Best-effort: remove the directory
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  }

  // ===========================================================================
  // Private: Helpers
  // ===========================================================================

  private requireSession(sessionId: string): ActiveSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }
    return session;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _spawnerInstance: ClaudeSessionSpawner | null = null;

/**
 * Returns a process-level singleton spawner instance.
 * Useful for the daemon which only needs one spawner.
 */
export function getClaudeSessionSpawner(): ClaudeSessionSpawner {
  if (!_spawnerInstance) {
    _spawnerInstance = new ClaudeSessionSpawner();
  }
  return _spawnerInstance;
}
