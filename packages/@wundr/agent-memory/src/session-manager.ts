/**
 * @wundr.io/agent-memory - Session Manager
 *
 * Manages session state persistence, restoration, and compaction handling.
 * Provides session lifecycle management for the memory system.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  SessionState,
  Memory,
  MemoryEvent,
  MemoryEventHandler,
} from './types';

/**
 * Session persistence options
 */
export interface SessionPersistenceOptions {
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
  /** Maximum sessions to keep in memory */
  maxCachedSessions?: number;
  /** Compress session data */
  compression?: boolean;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /** Custom session ID (auto-generated if not provided) */
  sessionId?: string;
  /** Initial agent IDs */
  agentIds?: string[];
  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  /** Session ID */
  sessionId: string;
  /** Start time */
  startedAt: Date;
  /** Last activity */
  lastActiveAt: Date;
  /** Turn count */
  turnCount: number;
  /** Active agents count */
  agentCount: number;
  /** Scratchpad memory count */
  memoryCount: number;
  /** Active status */
  isActive: boolean;
}

/**
 * SessionManager - Session lifecycle management
 *
 * Handles session creation, persistence, restoration, and cleanup.
 * Integrates with the memory system for session-scoped memory management.
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager({
 *   autoSaveIntervalMs: 60000,
 *   maxCachedSessions: 10,
 * });
 *
 * // Create a new session
 * const session = sessionManager.createSession({
 *   agentIds: ['agent-1', 'agent-2'],
 * });
 *
 * // Increment turn
 * sessionManager.incrementTurn(session.sessionId);
 *
 * // Save session
 * await sessionManager.saveSession(session.sessionId);
 * ```
 */
export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private options: Required<SessionPersistenceOptions>;
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private persistenceCallback?: (state: SessionState) => Promise<void>;
  private loadCallback?: (sessionId: string) => Promise<SessionState | null>;

  /**
   * Creates a new SessionManager instance
   *
   * @param options - Persistence options
   */
  constructor(options: SessionPersistenceOptions = {}) {
    this.options = {
      autoSaveIntervalMs: options.autoSaveIntervalMs ?? 60000, // 1 minute
      maxCachedSessions: options.maxCachedSessions ?? 10,
      compression: options.compression ?? false,
    };
  }

  /**
   * Initialize the session manager
   *
   * @param persistenceCallback - Callback for persisting session state
   * @param loadCallback - Callback for loading session state
   */
  initialize(
    persistenceCallback?: (state: SessionState) => Promise<void>,
    loadCallback?: (sessionId: string) => Promise<SessionState | null>
  ): void {
    this.persistenceCallback = persistenceCallback;
    this.loadCallback = loadCallback;

    // Start auto-save if callback provided
    if (this.persistenceCallback && this.options.autoSaveIntervalMs > 0) {
      this.startAutoSave();
    }
  }

  /**
   * Create a new session
   *
   * @param options - Session creation options
   * @returns Created session state
   */
  createSession(options: CreateSessionOptions = {}): SessionState {
    const now = new Date();
    const sessionId = options.sessionId || `session-${uuidv4()}`;

    const session: SessionState = {
      sessionId,
      startedAt: now,
      lastActiveAt: now,
      turnNumber: 0,
      activeAgents: options.agentIds || [],
      scratchpadState: [],
      metadata: options.metadata || {},
      isActive: true,
      pendingCompaction: false,
    };

    this.sessions.set(sessionId, session);

    // Enforce cache limit
    this.enforceCacheLimit();

    this.emit('session:created', {
      sessionId,
      details: { agentCount: session.activeAgents.length },
    });

    return session;
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - Session ID
   * @returns Session state or null
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    // Check cache first
    const cached = this.sessions.get(sessionId);
    if (cached) {
      return cached;
    }

    // Try to load from persistence
    if (this.loadCallback) {
      const loaded = await this.loadCallback(sessionId);
      if (loaded) {
        // Restore dates
        loaded.startedAt = new Date(loaded.startedAt);
        loaded.lastActiveAt = new Date(loaded.lastActiveAt);

        this.sessions.set(sessionId, loaded);
        this.enforceCacheLimit();

        this.emit('session:restored', {
          sessionId,
        });

        return loaded;
      }
    }

    return null;
  }

  /**
   * Update session activity timestamp
   *
   * @param sessionId - Session ID
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Increment the turn number for a session
   *
   * @param sessionId - Session ID
   * @returns New turn number
   */
  incrementTurn(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.turnNumber++;
    session.lastActiveAt = new Date();

    return session.turnNumber;
  }

  /**
   * Add an agent to a session
   *
   * @param sessionId - Session ID
   * @param agentId - Agent ID to add
   */
  addAgent(sessionId: string, agentId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.activeAgents.includes(agentId)) {
      session.activeAgents.push(agentId);
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Remove an agent from a session
   *
   * @param sessionId - Session ID
   * @param agentId - Agent ID to remove
   */
  removeAgent(sessionId: string, agentId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const index = session.activeAgents.indexOf(agentId);
    if (index > -1) {
      session.activeAgents.splice(index, 1);
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Update scratchpad state for a session
   *
   * @param sessionId - Session ID
   * @param memories - New scratchpad memories
   */
  updateScratchpad(sessionId: string, memories: Memory[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.scratchpadState = memories;
    session.lastActiveAt = new Date();
  }

  /**
   * Update session metadata
   *
   * @param sessionId - Session ID
   * @param metadata - Metadata updates
   */
  updateMetadata(sessionId: string, metadata: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session.metadata, metadata);
    session.lastActiveAt = new Date();
  }

  /**
   * Mark a session as needing compaction
   *
   * @param sessionId - Session ID
   */
  markPendingCompaction(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingCompaction = true;
    }
  }

  /**
   * Clear pending compaction flag
   *
   * @param sessionId - Session ID
   */
  clearPendingCompaction(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingCompaction = false;
    }
  }

  /**
   * Save a session to persistent storage
   *
   * @param sessionId - Session ID to save
   */
  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (this.persistenceCallback) {
      await this.persistenceCallback(session);
    }
  }

  /**
   * Save all active sessions
   */
  async saveAllSessions(): Promise<void> {
    if (!this.persistenceCallback) {
      return;
    }

    const savePromises: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        savePromises.push(this.persistenceCallback(session));
      }
    }

    await Promise.all(savePromises);
  }

  /**
   * End a session
   *
   * @param sessionId - Session ID to end
   * @param persist - Whether to persist before ending
   */
  async endSession(sessionId: string, persist: boolean = true): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.isActive = false;
    session.lastActiveAt = new Date();

    if (persist) {
      await this.saveSession(sessionId);
    }

    this.emit('session:ended', {
      sessionId,
      details: {
        turnCount: session.turnNumber,
        duration: Date.now() - session.startedAt.getTime(),
      },
    });
  }

  /**
   * Delete a session
   *
   * @param sessionId - Session ID to delete
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   *
   * @returns Active session summaries
   */
  getActiveSessions(): SessionSummary[] {
    const summaries: SessionSummary[] = [];

    for (const session of this.sessions.values()) {
      if (session.isActive) {
        summaries.push(this.createSummary(session));
      }
    }

    return summaries.sort(
      (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
    );
  }

  /**
   * Get all cached sessions
   *
   * @returns All session summaries
   */
  getAllSessions(): SessionSummary[] {
    const summaries: SessionSummary[] = [];

    for (const session of this.sessions.values()) {
      summaries.push(this.createSummary(session));
    }

    return summaries.sort(
      (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
    );
  }

  /**
   * Get sessions needing compaction
   *
   * @returns Sessions with pending compaction
   */
  getSessionsNeedingCompaction(): SessionState[] {
    return Array.from(this.sessions.values()).filter(
      s => s.pendingCompaction && s.isActive
    );
  }

  /**
   * Clean up inactive sessions
   *
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Number of sessions cleaned up
   */
  cleanupInactiveSessions(maxAgeMs: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActiveAt.getTime();
      if (!session.isActive && age > maxAgeMs) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Register an event handler
   *
   * @param event - Event type
   * @param handler - Handler function
   */
  on(event: string, handler: MemoryEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param event - Event type
   * @param handler - Handler to remove
   */
  off(event: string, handler: MemoryEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Shutdown the session manager
   */
  async shutdown(): Promise<void> {
    // Stop auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Save all active sessions
    await this.saveAllSessions();
  }

  /**
   * Serialize all sessions for export
   *
   * @returns Serialized session data
   */
  serialize(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Restore sessions from serialized data
   *
   * @param sessions - Sessions to restore
   */
  restore(sessions: SessionState[]): void {
    this.sessions.clear();

    for (const session of sessions) {
      session.startedAt = new Date(session.startedAt);
      session.lastActiveAt = new Date(session.lastActiveAt);

      // Restore memory dates
      for (const memory of session.scratchpadState) {
        memory.metadata.createdAt = new Date(memory.metadata.createdAt);
        memory.metadata.lastAccessedAt = new Date(
          memory.metadata.lastAccessedAt
        );
      }

      this.sessions.set(session.sessionId, session);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveAllSessions();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.options.autoSaveIntervalMs);
  }

  private enforceCacheLimit(): void {
    if (this.sessions.size <= this.options.maxCachedSessions) {
      return;
    }

    // Sort by last activity (oldest first)
    const sortedSessions = Array.from(this.sessions.entries())
      .filter(([, session]) => !session.isActive) // Only evict inactive sessions
      .sort(
        ([, a], [, b]) => a.lastActiveAt.getTime() - b.lastActiveAt.getTime()
      );

    // Remove oldest sessions until within limit
    const toRemove = this.sessions.size - this.options.maxCachedSessions;
    for (let i = 0; i < toRemove && i < sortedSessions.length; i++) {
      this.sessions.delete(sortedSessions[i][0]);
    }
  }

  private createSummary(session: SessionState): SessionSummary {
    return {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      lastActiveAt: session.lastActiveAt,
      turnCount: session.turnNumber,
      agentCount: session.activeAgents.length,
      memoryCount: session.scratchpadState.length,
      isActive: session.isActive,
    };
  }

  private emit(type: string, payload: MemoryEvent['payload']): void {
    const event: MemoryEvent = {
      type: type as MemoryEvent['type'],
      timestamp: new Date(),
      payload,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${type}:`, error);
        }
      }
    }
  }
}
