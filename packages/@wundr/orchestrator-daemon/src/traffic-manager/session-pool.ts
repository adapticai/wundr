/**
 * Session Pool - Traffic Manager
 *
 * Manages a pool of active daemon sessions per session manager.  Each session
 * manager (identified by its ID) has a bounded set of sessions that can be
 * idle (available for task reuse) or busy (actively processing a task).
 *
 * The pool enforces the `maxSessionsPerManager` limit drawn from the
 * OrchestratorCharter's ResourceLimits and surfaces per-manager load metrics
 * for use by the TaskRouter.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle states for a pooled session. */
export type PooledSessionStatus = 'idle' | 'busy' | 'terminated';

/** A single managed session entry inside the pool. */
export interface PooledSession {
  /** Opaque session identifier. */
  sessionId: string;
  /** The session manager that owns this session. */
  sessionManagerId: string;
  /** Current lifecycle state. */
  status: PooledSessionStatus;
  /** When the session was first created. */
  createdAt: Date;
  /** When the session was last acquired or released. */
  lastUsedAt: Date;
  /** Number of tasks that have been routed through this session. */
  tasksHandled: number;
}

/**
 * Per-session-manager load snapshot used by the TaskRouter to make routing
 * decisions.
 */
export interface SessionLoad {
  /** Session manager identifier. */
  sessionManagerId: string;
  /** Total sessions currently in the pool for this manager. */
  activeSessions: number;
  /** Sessions currently processing a task. */
  busySessions: number;
  /** Sessions available for immediate reuse. */
  idleSessions: number;
  /**
   * Fractional load: busySessions / maxSessionsPerManager.
   * 0.0 = completely idle, 1.0 = at capacity.
   */
  load: number;
}

/** Configuration for the SessionPool. */
export interface SessionPoolConfig {
  /**
   * Maximum number of concurrent sessions allowed per session manager.
   * Mirrors OrchestratorCharter.resourceLimits.maxSessions.
   */
  maxSessionsPerManager: number;
  /**
   * How long (ms) an idle session may sit unused before being eligible for
   * eviction.  Defaults to 10 minutes.
   */
  idleTimeoutMs: number;
  /**
   * Interval (ms) at which the pool scans for and evicts stale idle sessions.
   * Defaults to 60 seconds.
   */
  evictionIntervalMs: number;
}

const DEFAULT_CONFIG: SessionPoolConfig = {
  maxSessionsPerManager: 10,
  idleTimeoutMs: 10 * 60 * 1000, // 10 minutes
  evictionIntervalMs: 60 * 1000, // 1 minute
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface SessionPoolEvents {
  'session:created': (session: PooledSession) => void;
  'session:acquired': (session: PooledSession) => void;
  'session:released': (session: PooledSession) => void;
  'session:terminated': (session: PooledSession) => void;
  'session:evicted': (session: PooledSession) => void;
  'pool:capacity_reached': (sessionManagerId: string) => void;
}

// ---------------------------------------------------------------------------
// SessionPool
// ---------------------------------------------------------------------------

/**
 * Manages a bounded pool of sessions per session manager.
 *
 * Usage pattern:
 * ```
 * const pool = new SessionPool({ maxSessionsPerManager: 5 });
 * pool.start();
 *
 * // Acquire (creates if needed):
 * const session = await pool.getOrCreateSession('sm_abc');
 *
 * // … task executes …
 *
 * pool.releaseSession(session.sessionId);
 * pool.stop();
 * ```
 */
export class SessionPool extends EventEmitter<SessionPoolEvents> {
  /** sessions[sessionManagerId][sessionId] = PooledSession */
  private readonly sessions: Map<string, Map<string, PooledSession>> =
    new Map();
  private readonly config: SessionPoolConfig;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SessionPoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Start the background eviction timer. */
  start(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(
      () => this.evictStaleSessions(),
      this.config.evictionIntervalMs
    );
  }

  /** Stop the background eviction timer and terminate all pooled sessions. */
  stop(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    for (const [managerId, managerSessions] of this.sessions) {
      for (const session of managerSessions.values()) {
        this.terminateSession(managerId, session.sessionId, 'pool stopped');
      }
    }
    this.sessions.clear();
  }

  // -------------------------------------------------------------------------
  // Core pool operations
  // -------------------------------------------------------------------------

  /**
   * Return an existing idle session for `sessionManagerId`, or create a new
   * one if capacity permits.
   *
   * Throws when the manager is at capacity and has no idle sessions to offer.
   */
  getOrCreateSession(sessionManagerId: string): PooledSession {
    const managerSessions = this.getOrInitManager(sessionManagerId);

    // Prefer an existing idle session
    const idle = this.findIdleSession(managerSessions);
    if (idle) {
      idle.status = 'busy';
      idle.lastUsedAt = new Date();
      this.emit('session:acquired', idle);
      return idle;
    }

    // Create a new session if under the cap
    if (managerSessions.size >= this.config.maxSessionsPerManager) {
      this.emit('pool:capacity_reached', sessionManagerId);
      throw new SessionPoolCapacityError(
        sessionManagerId,
        this.config.maxSessionsPerManager
      );
    }

    const session = this.createSession(sessionManagerId);
    managerSessions.set(session.sessionId, session);
    this.emit('session:created', session);
    this.emit('session:acquired', session);
    return session;
  }

  /**
   * Return the best idle session for `sessionManagerId` without acquiring it.
   * Returns undefined when none is available.
   */
  getIdleSession(sessionManagerId: string): PooledSession | undefined {
    const managerSessions = this.sessions.get(sessionManagerId);
    if (!managerSessions) return undefined;
    return this.findIdleSession(managerSessions) ?? undefined;
  }

  /**
   * Mark a session as idle (available) after it has finished processing a task.
   * Returns false when the session is not found in the pool.
   */
  releaseSession(sessionId: string): boolean {
    const { session } = this.findSessionById(sessionId);
    if (!session) return false;

    if (session.status === 'terminated') return false;

    session.status = 'idle';
    session.lastUsedAt = new Date();
    session.tasksHandled += 1;
    this.emit('session:released', session);
    return true;
  }

  /**
   * Permanently remove a session from the pool (e.g. after an error).
   * Returns false when the session is not found.
   */
  terminateSession(
    sessionManagerId: string,
    sessionId: string,
    _reason?: string
  ): boolean {
    const managerSessions = this.sessions.get(sessionManagerId);
    if (!managerSessions) return false;

    const session = managerSessions.get(sessionId);
    if (!session) return false;

    session.status = 'terminated';
    managerSessions.delete(sessionId);
    this.emit('session:terminated', session);
    return true;
  }

  // -------------------------------------------------------------------------
  // Load metrics
  // -------------------------------------------------------------------------

  /**
   * Return a load snapshot for every session manager currently tracked by the
   * pool.  The TaskRouter uses this to make routing decisions.
   */
  getSessionLoad(): Record<string, SessionLoad> {
    const result: Record<string, SessionLoad> = {};

    for (const [managerId, managerSessions] of this.sessions) {
      const all = Array.from(managerSessions.values());
      const busyCount = all.filter(s => s.status === 'busy').length;
      const idleCount = all.filter(s => s.status === 'idle').length;
      const active = busyCount + idleCount;

      result[managerId] = {
        sessionManagerId: managerId,
        activeSessions: active,
        busySessions: busyCount,
        idleSessions: idleCount,
        load: active > 0 ? busyCount / this.config.maxSessionsPerManager : 0,
      };
    }

    return result;
  }

  /**
   * Return the load entry for a single session manager, or null if it is
   * unknown to the pool.
   */
  getManagerLoad(sessionManagerId: string): SessionLoad | null {
    const loads = this.getSessionLoad();
    return loads[sessionManagerId] ?? null;
  }

  /**
   * Enumerate all pooled sessions across all managers. Useful for diagnostics.
   */
  listSessions(sessionManagerId?: string): PooledSession[] {
    if (sessionManagerId) {
      const managerSessions = this.sessions.get(sessionManagerId);
      if (!managerSessions) return [];
      return Array.from(managerSessions.values());
    }

    const all: PooledSession[] = [];
    for (const managerSessions of this.sessions.values()) {
      all.push(...managerSessions.values());
    }
    return all;
  }

  /**
   * Register an externally-created session so the pool can track its load.
   * Useful when sessions are spawned outside the pool (e.g. pre-warmed by the
   * daemon at startup).
   */
  registerExternalSession(
    sessionManagerId: string,
    sessionId: string,
    status: PooledSessionStatus = 'idle'
  ): PooledSession {
    const managerSessions = this.getOrInitManager(sessionManagerId);
    const existing = managerSessions.get(sessionId);
    if (existing) return existing;

    const session: PooledSession = {
      sessionId,
      sessionManagerId,
      status,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      tasksHandled: 0,
    };

    managerSessions.set(sessionId, session);
    this.emit('session:created', session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getOrInitManager(
    sessionManagerId: string
  ): Map<string, PooledSession> {
    let managerSessions = this.sessions.get(sessionManagerId);
    if (!managerSessions) {
      managerSessions = new Map();
      this.sessions.set(sessionManagerId, managerSessions);
    }
    return managerSessions;
  }

  private findIdleSession(
    managerSessions: Map<string, PooledSession>
  ): PooledSession | null {
    let oldest: PooledSession | null = null;
    for (const session of managerSessions.values()) {
      if (session.status !== 'idle') continue;
      // Prefer the session that has been idle the shortest (most recently used)
      if (!oldest || session.lastUsedAt > oldest.lastUsedAt) {
        oldest = session;
      }
    }
    return oldest;
  }

  private findSessionById(sessionId: string): {
    session: PooledSession | null;
    sessionManagerId: string | null;
  } {
    for (const [managerId, managerSessions] of this.sessions) {
      const session = managerSessions.get(sessionId);
      if (session) return { session, sessionManagerId: managerId };
    }
    return { session: null, sessionManagerId: null };
  }

  private createSession(sessionManagerId: string): PooledSession {
    const sessionId = `pool_${sessionManagerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      sessionId,
      sessionManagerId,
      status: 'busy', // Created and immediately acquired
      createdAt: new Date(),
      lastUsedAt: new Date(),
      tasksHandled: 0,
    };
  }

  /**
   * Remove sessions that have been idle longer than `idleTimeoutMs`.
   */
  private evictStaleSessions(): void {
    const cutoff = new Date(Date.now() - this.config.idleTimeoutMs);

    for (const [managerId, managerSessions] of this.sessions) {
      for (const [sessionId, session] of managerSessions) {
        if (session.status === 'idle' && session.lastUsedAt < cutoff) {
          session.status = 'terminated';
          managerSessions.delete(sessionId);
          this.emit('session:evicted', session);
        }
      }

      // Clean up empty manager maps
      if (managerSessions.size === 0) {
        this.sessions.delete(managerId);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SessionPoolCapacityError extends Error {
  constructor(sessionManagerId: string, maxSessions: number) {
    super(
      `Session pool for manager "${sessionManagerId}" is at capacity (${maxSessions} sessions). ` +
        'Wait for a session to be released or increase maxSessionsPerManager.'
    );
    this.name = 'SessionPoolCapacityError';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSessionPool(
  config?: Partial<SessionPoolConfig>
): SessionPool {
  return new SessionPool(config);
}
