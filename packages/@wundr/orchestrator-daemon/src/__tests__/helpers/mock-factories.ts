/**
 * Mock factory functions for creating type-safe test objects.
 *
 * Every factory returns valid defaults that pass Zod validation.
 * Overrides are shallow-merged so callers can customize individual fields
 * without rebuilding the entire object.
 *
 * Usage:
 *   import { createMockSession, createMockTask } from '../helpers/mock-factories';
 *   const session = createMockSession({ status: 'paused' });
 */

import { EventEmitter } from 'events';

import type {
  DaemonConfig,
  DaemonStatus,
  ExecuteTaskPayload,
  MemoryConfig,
  MemoryContext,
  MemoryEntry,
  Session,
  SessionMetrics,
  SpawnSessionPayload,
  Task,
  WSMessage,
} from '../../types';
import type { AuthConfig, ClientIdentity, JwtPayload } from '../../auth/types';

// ---------------------------------------------------------------------------
// ID generator (deterministic in tests -- counter-based)
// ---------------------------------------------------------------------------

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

function nextId(prefix: string): string {
  idCounter++;
  return `${prefix}_${idCounter.toString().padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Core domain objects
// ---------------------------------------------------------------------------

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: nextId('task'),
    type: 'code',
    description: 'Test task',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockSessionMetrics(
  overrides?: Partial<SessionMetrics>,
): SessionMetrics {
  return {
    tokensUsed: 0,
    duration: 0,
    tasksCompleted: 0,
    errorsEncountered: 0,
    averageResponseTime: 0,
    ...overrides,
  };
}

export function createMockMemoryEntry(
  overrides?: Partial<MemoryEntry>,
): MemoryEntry {
  return {
    id: nextId('mem'),
    content: 'Test memory entry content',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    type: 'interaction',
    ...overrides,
  };
}

export function createMockMemoryContext(
  overrides?: Partial<MemoryContext>,
): MemoryContext {
  return {
    scratchpad: {},
    episodic: [],
    semantic: [],
    ...overrides,
  };
}

export function createMockSession(overrides?: Partial<Session>): Session {
  const task = createMockTask();
  return {
    id: nextId('session'),
    orchestratorId: nextId('orch'),
    task,
    type: 'claude-code',
    status: 'running',
    startedAt: new Date('2025-01-01T00:00:00Z'),
    memoryContext: createMockMemoryContext(),
    metrics: createMockSessionMetrics(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Configuration objects
// ---------------------------------------------------------------------------

export function createMockDaemonConfig(
  overrides?: Partial<DaemonConfig>,
): DaemonConfig {
  return {
    name: 'test-daemon',
    port: 8787,
    host: '127.0.0.1',
    maxSessions: 100,
    heartbeatInterval: 30000,
    shutdownTimeout: 10000,
    verbose: false,
    logLevel: 'info',
    ...overrides,
  };
}

export function createMockMemoryConfig(
  overrides?: Partial<MemoryConfig>,
): MemoryConfig {
  return {
    version: '1.0',
    tiers: {
      scratchpad: {
        description: 'Working memory',
        maxSize: '1MB',
        ttl: 'session',
        persistence: 'session',
      },
      episodic: {
        description: 'Recent interactions',
        maxSize: '10MB',
        ttl: '24h',
        persistence: 'local',
      },
      semantic: {
        description: 'Long-term knowledge',
        maxSize: '100MB',
        ttl: 'permanent',
        persistence: 'permanent',
      },
    },
    compaction: {
      enabled: true,
      threshold: 0.8,
      strategy: 'summarize',
    },
    retrieval: {
      strategy: 'keyword',
      maxResults: 10,
      similarityThreshold: 0.7,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Auth objects
// ---------------------------------------------------------------------------

/** A JWT secret that meets the 32-character minimum. */
export const TEST_JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars!';

/** An API key that meets the 32-character minimum. */
export const TEST_API_KEY = 'test-api-key-that-is-at-least-32-characters!';

export function createMockAuthConfig(
  overrides?: Partial<AuthConfig>,
): AuthConfig {
  return {
    mode: 'both',
    jwtSecret: TEST_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [
      {
        key: TEST_API_KEY,
        clientId: 'test-client',
        scopes: [],
      },
    ],
    allowLoopback: false,
    rateLimitMaxMessages: 100,
    rateLimitWindowMs: 60_000,
    maxConnectionsPerClient: 10,
    ...overrides,
  };
}

export function createMockClientIdentity(
  overrides?: Partial<ClientIdentity>,
): ClientIdentity {
  return {
    clientId: 'test-client',
    method: 'jwt',
    scopes: [],
    authenticatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockJwtPayload(
  overrides?: Partial<JwtPayload>,
): JwtPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'test-subject',
    iss: 'wundr-orchestrator',
    aud: 'wundr-daemon',
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WebSocket message payloads
// ---------------------------------------------------------------------------

export function createMockSpawnPayload(
  overrides?: Partial<SpawnSessionPayload>,
): SpawnSessionPayload {
  return {
    orchestratorId: 'orch-1',
    task: {
      type: 'code',
      description: 'Test task',
      priority: 'medium',
      status: 'pending',
    },
    sessionType: 'claude-code',
    ...overrides,
  };
}

export function createMockExecutePayload(
  overrides?: Partial<ExecuteTaskPayload>,
): ExecuteTaskPayload {
  return {
    sessionId: 'session-1',
    task: 'Write a test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock WebSocket (for unit tests that do not need a real server)
// ---------------------------------------------------------------------------

export class MockWebSocket extends EventEmitter {
  public readyState: number = 1; // WebSocket.OPEN
  public sentMessages: string[] = [];
  public closeCode: number | undefined;
  public closeReason: string | undefined;

  /** Identity attached by auth middleware. */
  public __identity?: ClientIdentity;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  // Instance-level constants (match ws library)
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  send(data: string, callback?: (error?: Error) => void): void {
    this.sentMessages.push(data);
    if (callback) callback();
  }

  ping(): void {
    // no-op
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', code ?? 1000, Buffer.from(reason ?? ''));
  }

  /** Parse the last sent message as JSON. */
  lastSentJson<T = unknown>(): T {
    const last = this.sentMessages[this.sentMessages.length - 1];
    if (!last) throw new Error('No messages sent');
    return JSON.parse(last) as T;
  }

  /** Parse all sent messages as JSON. */
  allSentJson<T = unknown>(): T[] {
    return this.sentMessages.map((m) => JSON.parse(m) as T);
  }
}

// ---------------------------------------------------------------------------
// Mock HTTP IncomingMessage (for authenticator tests)
// ---------------------------------------------------------------------------

export interface MockIncomingMessageOptions {
  url?: string;
  headers?: Record<string, string | string[]>;
  remoteAddress?: string;
}

export function createMockIncomingMessage(
  options: MockIncomingMessageOptions = {},
): any {
  const { url = '/', headers = {}, remoteAddress = '192.168.1.1' } = options;
  return {
    url,
    headers,
    socket: {
      remoteAddress,
    },
  };
}

// ---------------------------------------------------------------------------
// Daemon status
// ---------------------------------------------------------------------------

export function createMockDaemonStatus(
  overrides?: Partial<DaemonStatus>,
): DaemonStatus {
  return {
    status: 'running',
    uptime: 1000,
    activeSessions: 0,
    queuedTasks: 0,
    metrics: {
      totalSessionsSpawned: 0,
      totalTasksProcessed: 0,
      totalTokensUsed: 0,
      averageSessionDuration: 0,
      activeSessions: 0,
      successRate: 1.0,
    },
    subsystems: {},
    ...overrides,
  };
}
