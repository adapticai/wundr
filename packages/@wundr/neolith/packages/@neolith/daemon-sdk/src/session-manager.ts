/**
 * DaemonSessionManager
 *
 * High-level helper that wraps DaemonClient to manage Claude Code / Claude Flow
 * sessions through the orchestrator daemon.
 */

import type { DaemonClient } from './daemon-client.js';
import type {
  SessionCreateParams,
  SessionInfo,
  SessionListParams,
  SessionResumeParams,
  SessionStatus,
  SessionStopParams,
  StreamChunkPayload,
  StreamEndPayload,
  StreamStartPayload,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  SessionCreateParams,
  SessionInfo,
  SessionListParams,
  SessionStopParams,
};

export interface SpawnSessionConfig {
  orchestratorId: string;
  sessionType: SessionCreateParams['sessionType'];
  task: SessionCreateParams['task'];
  memoryProfile?: string;
  /**
   * If true, the client will automatically subscribe to stream events for this
   * session via the server-side subscription mechanism.
   * @default true
   */
  subscribe?: boolean;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface StreamHandlers {
  onStart?: (payload: StreamStartPayload) => void;
  onChunk?: (payload: StreamChunkPayload) => void;
  onEnd?: (payload: StreamEndPayload) => void;
  onError?: (error: unknown) => void;
}

// ---------------------------------------------------------------------------
// DaemonSessionManager
// ---------------------------------------------------------------------------

export class DaemonSessionManager {
  private client: DaemonClient;

  /** Local cache of session info keyed by sessionId. */
  private sessionCache = new Map<string, SessionInfo>();

  /** Active stream unsubscribe functions keyed by sessionId. */
  private activeStreams = new Map<string, (() => void)[]>();

  constructor(client: DaemonClient) {
    this.client = client;
  }

  // -------------------------------------------------------------------------
  // Session CRUD
  // -------------------------------------------------------------------------

  /**
   * Request the daemon to spawn a new session.
   *
   * @returns  The created session's info object.
   */
  async spawnSession(config: SpawnSessionConfig): Promise<SessionInfo> {
    const params: SessionCreateParams = {
      orchestratorId: config.orchestratorId,
      sessionType: config.sessionType,
      task: config.task,
      memoryProfile: config.memoryProfile,
      subscribe: config.subscribe ?? true,
    };

    const result = await this.client.sendMessage<SessionInfo>(
      'session.create',
      params
    );
    this.sessionCache.set(result.id, result);
    return result;
  }

  /**
   * Resume an existing session that was previously stopped or paused.
   */
  async resumeSession(
    sessionId: string,
    subscribe = true
  ): Promise<SessionInfo> {
    const params: SessionResumeParams = { sessionId, subscribe };
    const result = await this.client.sendMessage<SessionInfo>(
      'session.resume',
      params
    );
    this.sessionCache.set(result.id, result);
    return result;
  }

  /**
   * List active (and optionally filtered) sessions.
   */
  async listSessions(
    params: SessionListParams = {}
  ): Promise<SessionListResult> {
    return this.client.sendMessage<SessionListResult>('session.list', {
      limit: 50,
      offset: 0,
      ...params,
    });
  }

  /**
   * Get the current status and info for a specific session.
   */
  async getSessionStatus(sessionId: string): Promise<SessionInfo> {
    const result = await this.client.sendMessage<SessionInfo>(
      'session.status',
      { sessionId }
    );
    this.sessionCache.set(sessionId, result);
    return result;
  }

  /**
   * Terminate a session.
   *
   * @param sessionId  The ID of the session to stop.
   * @param reason     Optional human-readable reason for stopping.
   * @param force      If true, forcefully kill the session without cleanup.
   */
  async stopSession(
    sessionId: string,
    reason?: string,
    force = false
  ): Promise<void> {
    const params: SessionStopParams = { sessionId, reason, force };
    await this.client.sendMessage('session.stop', params);
    this.sessionCache.delete(sessionId);
    this.teardownStreamListeners(sessionId);
  }

  // -------------------------------------------------------------------------
  // Stream helpers
  // -------------------------------------------------------------------------

  /**
   * Attach local event listeners for stream events on a given session.
   * This does NOT send a server-side subscription; it registers local
   * handlers against events already being pushed to this client.
   *
   * @returns  Unsubscribe function – call it to detach all handlers.
   */
  watchStream(sessionId: string, handlers: StreamHandlers): () => void {
    const unsubFns: (() => void)[] = [];

    if (handlers.onStart) {
      unsubFns.push(
        this.client.subscribe<StreamStartPayload>('stream.start', payload => {
          if (payload.sessionId === sessionId) {
            handlers.onStart!(payload);
          }
        })
      );
    }

    if (handlers.onChunk) {
      unsubFns.push(
        this.client.subscribe<StreamChunkPayload>('stream.chunk', payload => {
          if (payload.sessionId === sessionId) {
            handlers.onChunk!(payload);
          }
        })
      );
    }

    if (handlers.onEnd) {
      unsubFns.push(
        this.client.subscribe<StreamEndPayload>('stream.end', payload => {
          if (payload.sessionId === sessionId) {
            handlers.onEnd!(payload);
          }
        })
      );
    }

    if (handlers.onError) {
      unsubFns.push(
        this.client.subscribe('stream.error', payload => {
          const p = payload as { sessionId?: string };
          if (p.sessionId === sessionId) {
            handlers.onError!(payload);
          }
        })
      );
    }

    // Track so we can tear down when the session stops.
    const existing = this.activeStreams.get(sessionId) ?? [];
    this.activeStreams.set(sessionId, [...existing, ...unsubFns]);

    const unsubAll = () => {
      unsubFns.forEach(fn => fn());
      const current = this.activeStreams.get(sessionId) ?? [];
      this.activeStreams.set(
        sessionId,
        current.filter(fn => !unsubFns.includes(fn))
      );
    };

    return unsubAll;
  }

  // -------------------------------------------------------------------------
  // Cache access
  // -------------------------------------------------------------------------

  /**
   * Return cached session info (does not make a network request).
   * Returns null if the session is not in the local cache.
   */
  getCachedSession(sessionId: string): SessionInfo | null {
    return this.sessionCache.get(sessionId) ?? null;
  }

  /**
   * Return all locally cached sessions.
   */
  getAllCachedSessions(): SessionInfo[] {
    return Array.from(this.sessionCache.values());
  }

  /**
   * Invalidate the local session cache.
   */
  clearCache(): void {
    this.sessionCache.clear();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Listen for session lifecycle events pushed by the server and keep the
   * local cache in sync.  Call the returned function to stop listening.
   */
  startCacheSync(): () => void {
    const unsubs = [
      this.client.subscribe<SessionInfo>('session.created', payload => {
        this.sessionCache.set(payload.id, payload);
      }),
      this.client.subscribe<{ sessionId: string; status: SessionStatus }>(
        'session.status',
        payload => {
          const cached = this.sessionCache.get(payload.sessionId);
          if (cached) {
            this.sessionCache.set(payload.sessionId, {
              ...cached,
              status: payload.status,
            });
          }
        }
      ),
      this.client.subscribe<{ sessionId: string }>(
        'session.stopped',
        payload => {
          this.sessionCache.delete(payload.sessionId);
          this.teardownStreamListeners(payload.sessionId);
        }
      ),
    ];

    return () => unsubs.forEach(fn => fn());
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private teardownStreamListeners(sessionId: string): void {
    const fns = this.activeStreams.get(sessionId);
    if (fns) {
      fns.forEach(fn => fn());
      this.activeStreams.delete(sessionId);
    }
  }
}
