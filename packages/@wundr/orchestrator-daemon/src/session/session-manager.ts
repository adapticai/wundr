/**
 * Session Manager - Spawns and manages Claude Code/Flow sessions
 */

import { EventEmitter } from 'eventemitter3';

import { MemoryContext } from '../types';
import { Logger } from '../utils/logger';

import type { MemoryManager } from '../memory/memory-manager';
import type { Session, Task, SessionMetrics} from '../types';

export class SessionManager extends EventEmitter {
  private logger: Logger;
  private sessions: Map<string, Session>;
  private memoryManager: MemoryManager;
  private maxSessions: number;

  constructor(memoryManager: MemoryManager, maxSessions: number = 100) {
    super();
    this.logger = new Logger('SessionManager');
    this.sessions = new Map();
    this.memoryManager = memoryManager;
    this.maxSessions = maxSessions;
  }

  /**
   * Spawn a new session
   */
  async spawnSession(
    orchestratorId: string,
    task: Task,
    sessionType: 'claude-code' | 'claude-flow' = 'claude-code',
  ): Promise<Session> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit reached (${this.maxSessions}). Cannot spawn new session.`,
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

    // Simulate session initialization
    await this.initializeSession(session);

    this.emit('session:spawned', session);
    return session;
  }

  /**
   * Initialize session (placeholder for actual implementation)
   */
  private async initializeSession(session: Session): Promise<void> {
    this.logger.debug(`Initializing session: ${session.id}`);

    // Simulate async initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    session.status = 'running';
    this.logger.info(`Session running: ${session.id}`);
    this.emit('session:running', session);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Session[] {
    return this.getAllSessions().filter(
      (s) => s.status === 'running' || s.status === 'initializing',
    );
  }

  /**
   * Stop a session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.info(`Stopping session: ${sessionId}`);

    session.status = 'terminated';
    session.endedAt = new Date();
    session.metrics.duration =
      session.endedAt.getTime() - session.startedAt.getTime();

    this.emit('session:stopped', session);
  }

  /**
   * Complete a session successfully
   */
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

  /**
   * Mark session as failed
   */
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

  /**
   * Update session metrics
   */
  updateMetrics(sessionId: string, metrics: Partial<SessionMetrics>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metrics = { ...session.metrics, ...metrics };
    this.emit('session:metrics_updated', session);
  }

  /**
   * Cleanup old sessions
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
        const endTime = session.endedAt?.getTime() ?? session.startedAt.getTime();
        if (now - endTime > oneHour) {
          this.logger.debug(`Cleaning up old session: ${sessionId}`);
          this.sessions.delete(sessionId);
        }
      }
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }
}
