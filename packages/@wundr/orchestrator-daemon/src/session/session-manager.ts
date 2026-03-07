/**
 * Session Manager - Spawns and manages Claude Code/Flow sessions
 *
 * Extended to use ClaudeSessionSpawner for real process management.
 * The spawner handles:
 *   - Writing CLAUDE.md / settings.json / agent files via SessionConfigWriter
 *   - Launching `claude` CLI processes via child_process.spawn
 *   - Capturing stdout/stderr and tracking PIDs
 *   - Automatic restarts on unexpected crashes
 *   - Graceful shutdown via SIGTERM then SIGKILL
 *
 * The logical session lifecycle (initializing → running → completed/failed)
 * is maintained by this manager; the physical process lifecycle is managed
 * by ClaudeSessionSpawner.
 */

import * as os from 'os';
import * as path from 'path';

import { EventEmitter } from 'eventemitter3';

import { SessionExecutor } from './session-executor';
import { ClaudeSessionSpawner } from './claude-session-spawner';
import { Logger } from '../utils/logger';

import type { SessionExecutionOptions } from './session-executor';
import type { MemoryManager } from '../memory/memory-manager';
import type { Session, Task, SessionMetrics } from '../types';
import type { McpToolRegistry } from './tool-executor';
import type { LLMClient } from '../types/llm';
import type { OrchestratorCharter } from '../types';
import type { AgentDefinition } from '../agents/agent-types';
import type { ClaudeSessionConfig } from './claude-session-spawner';

// =============================================================================
// Extended spawn options
// =============================================================================

export interface SpawnSessionOptions {
  /** Use a git worktree for the session's working directory */
  useWorktree?: boolean;
  /** Base git repository path when using worktrees */
  repoPath?: string;
  /** Charter to use when writing CLAUDE.md */
  charter?: OrchestratorCharter | null;
  /** Agent definitions to write as .claude/agents/*.md */
  agents?: AgentDefinition[];
  /** Session-specific discipline / role description */
  discipline?: string;
  /** Whether to pass --dangerously-skip-permissions to the claude CLI */
  dangerouslySkipPermissions?: boolean;
  /** Extra environment variables for the Claude process */
  env?: Record<string, string>;
  /** Override the working directory (defaults to a temp dir under os.tmpdir) */
  workDir?: string;
  /** Initial prompt to pipe to the process once it is ready */
  initialPrompt?: string;
  /** Maximum automatic restarts on crash. Default: 2 */
  maxRestarts?: number;
}

// =============================================================================
// Session Manager
// =============================================================================

export class SessionManager extends EventEmitter {
  private logger: Logger;
  private sessions: Map<string, Session>;
  private memoryManager: MemoryManager;
  private maxSessions: number;
  private llmClient: LLMClient;
  private mcpRegistry: McpToolRegistry;
  private sessionExecutor: SessionExecutor;
  private spawner: ClaudeSessionSpawner;

  constructor(
    memoryManager: MemoryManager,
    maxSessions: number,
    llmClient: LLMClient,
    mcpRegistry: McpToolRegistry
  ) {
    super();
    this.logger = new Logger('SessionManager');
    this.sessions = new Map();
    this.memoryManager = memoryManager;
    this.maxSessions = maxSessions;
    this.llmClient = llmClient;
    this.mcpRegistry = mcpRegistry;
    this.sessionExecutor = new SessionExecutor(llmClient, mcpRegistry);
    this.spawner = new ClaudeSessionSpawner();
  }

  // ===========================================================================
  // Session Lifecycle
  // ===========================================================================

  /**
   * Spawn a new session, optionally backed by a real Claude Code CLI process.
   *
   * When `spawnOptions` is provided, a `claude` child process is started in
   * the session's working directory. Without options the session runs in the
   * logical (LLM-direct) mode using SessionExecutor.
   */
  async spawnSession(
    orchestratorId: string,
    task: Task,
    sessionType: 'claude-code' | 'claude-flow' = 'claude-code',
    spawnOptions?: SpawnSessionOptions
  ): Promise<Session> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit reached (${this.maxSessions}). Cannot spawn new session.`
      );
    }

    const sessionId = this.generateSessionId();
    this.logger.info(`Spawning ${sessionType} session: ${sessionId}`);

    // Initialize memory context for this session
    const memoryContext = this.memoryManager.initializeContext();

    const session: Session = {
      id: sessionId,
      orchestratorId,
      task,
      type: sessionType,
      status: 'initializing',
      startedAt: new Date(),
      memoryContext,
      metrics: {
        tokensUsed: 0,
        duration: 0,
        tasksCompleted: 0,
        errorsEncountered: 0,
        averageResponseTime: 0,
      },
    };

    this.sessions.set(sessionId, session);

    // Kick off initialization (which may include spawning a real process)
    await this.initializeSession(session, spawnOptions);

    this.emit('session:spawned', session);
    return session;
  }

  /**
   * Initialize session: optionally spawn a real Claude process, then execute
   * the logical task.
   */
  private async initializeSession(
    session: Session,
    spawnOptions?: SpawnSessionOptions
  ): Promise<void> {
    this.logger.debug(`Initializing session: ${session.id}`);

    session.status = 'running';
    this.logger.info(`Session running: ${session.id}`);
    this.emit('session:running', session);

    // Spawn real Claude CLI process if requested
    if (spawnOptions) {
      try {
        await this.spawnClaudeProcess(session, spawnOptions);
      } catch (err) {
        this.logger.error(
          `Failed to spawn Claude process for session ${session.id}:`,
          err
        );
        // Non-fatal: fall through to execute via SessionExecutor
      }
    }

    // Execute the task using SessionExecutor (logical/LLM layer)
    await this.executeTask(session.id);
  }

  /**
   * Spawns the actual Claude Code CLI process for a session.
   */
  private async spawnClaudeProcess(
    session: Session,
    opts: SpawnSessionOptions
  ): Promise<void> {
    const workDir =
      opts.workDir ?? path.join(os.tmpdir(), 'wundr-sessions', session.id);

    const claudeConfig: ClaudeSessionConfig = {
      sessionId: session.id,
      workDir,
      useWorktree: opts.useWorktree ?? false,
      repoPath: opts.repoPath,
      charter: opts.charter ?? null,
      discipline: opts.discipline ?? session.task.description,
      agents: opts.agents ?? [],
      dangerouslySkipPermissions: opts.dangerouslySkipPermissions ?? false,
      env: opts.env,
      maxRestarts: opts.maxRestarts ?? 2,
      initialPrompt: opts.initialPrompt ?? session.task.description,
    };

    await this.spawner.spawnClaudeSession(claudeConfig);

    this.logger.info(
      `Claude process spawned for session ${session.id} in ${workDir}`
    );
  }

  /**
   * Execute a task in the given session using SessionExecutor.
   */
  async executeTask(
    sessionId: string,
    options?: SessionExecutionOptions
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.info(`Executing task in session: ${sessionId}`);

    try {
      const result = await this.sessionExecutor.executeSession(
        session,
        session.task,
        options
      );

      this.sessionExecutor.updateSessionMetrics(session, result);
      this.sessionExecutor.addToSessionMemory(session, session.task, result);

      if (result.success) {
        await this.completeSession(sessionId);
      } else {
        await this.failSession(
          sessionId,
          new Error(result.error || 'Task execution failed')
        );
      }
    } catch (error) {
      this.logger.error(`Task execution error in session ${sessionId}`, error);
      await this.failSession(
        sessionId,
        error instanceof Error ? error : new Error('Unknown execution error')
      );
    }
  }

  // ===========================================================================
  // Session Queries
  // ===========================================================================

  /** Get session by ID */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /** Get all sessions */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** Get active sessions */
  getActiveSessions(): Session[] {
    return this.getAllSessions().filter(
      s => s.status === 'running' || s.status === 'initializing'
    );
  }

  /** Get session count */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /** Get active session count */
  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  // ===========================================================================
  // Process I/O Proxies
  // ===========================================================================

  /**
   * Send a message to an active session's Claude process stdin.
   * No-op (with a warning) if no real process is associated with the session.
   */
  sendToSession(sessionId: string, message: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!this.spawner.isSessionAlive(sessionId)) {
      this.logger.warn(
        `sendToSession: session ${sessionId} has no live Claude process; message dropped.`
      );
      return;
    }

    this.spawner.sendToSession(sessionId, message);
  }

  /**
   * Returns accumulated stdout output from the session's Claude process.
   */
  getSessionOutput(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const activeSession = this.spawner.getSession(sessionId);
    return activeSession?.stdoutBuffer ?? '';
  }

  /**
   * Returns a snapshot of all active Claude processes managed by the spawner.
   */
  listActiveClaudioSessions() {
    return this.spawner.listActiveSessions();
  }

  // ===========================================================================
  // Session State Transitions
  // ===========================================================================

  /** Stop a session (terminates the real process if any) */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.info(`Stopping session: ${sessionId}`);

    // Kill the Claude process if it is alive
    if (this.spawner.isSessionAlive(sessionId)) {
      await this.spawner.killSession(sessionId);
    }

    session.status = 'terminated';
    session.endedAt = new Date();
    session.metrics.duration =
      session.endedAt.getTime() - session.startedAt.getTime();

    this.emit('session:stopped', session);
  }

  /** Complete a session successfully */
  async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.info(`Completing session: ${sessionId}`);

    session.status = 'completed';
    session.endedAt = new Date();
    session.metrics.duration =
      session.endedAt.getTime() - session.startedAt.getTime();

    this.emit('session:completed', session);
  }

  /** Mark session as failed */
  async failSession(sessionId: string, error: Error): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.error(`Session failed: ${sessionId}`, error);

    session.status = 'failed';
    session.endedAt = new Date();
    session.metrics.duration =
      session.endedAt.getTime() - session.startedAt.getTime();
    session.metrics.errorsEncountered++;

    this.emit('session:failed', { session, error });
  }

  // ===========================================================================
  // Metrics
  // ===========================================================================

  /** Update session metrics */
  updateMetrics(sessionId: string, metrics: Partial<SessionMetrics>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metrics = { ...session.metrics, ...metrics };
    this.emit('session:metrics_updated', session);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Cleanup old completed/failed/terminated sessions older than one hour.
   * Does not affect the spawner (processes are already gone by this point).
   */
  cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (
        session.status === 'completed' ||
        session.status === 'failed' ||
        session.status === 'terminated'
      ) {
        const endTime =
          session.endedAt?.getTime() ?? session.startedAt.getTime();
        if (now - endTime > oneHour) {
          this.logger.debug(`Cleaning up old session: ${sessionId}`);
          this.sessions.delete(sessionId);
        }
      }
    }
  }

  /**
   * Graceful shutdown: kill all real Claude processes, then clear sessions.
   * Should be called when the daemon is stopping.
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SessionManager...');
    await this.spawner.killAllSessions();
    this.sessions.clear();
    this.logger.info('SessionManager shut down');
  }

  // ===========================================================================
  // Private: Helpers
  // ===========================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
