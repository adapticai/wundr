/**
 * Pre-built test fixtures for common test scenarios.
 *
 * Unlike mock factories (which generate new objects each call), fixtures
 * are frozen constants suitable for snapshot comparisons and data-driven
 * tests.
 *
 * Usage:
 *   import { FIXTURES } from '../helpers/test-fixtures';
 *   const config = FIXTURES.config.minimal;
 */

import type { MemoryConfig } from '../../types';
import type { AuthConfig } from '../../auth/types';

// ---------------------------------------------------------------------------
// Auth fixtures
// ---------------------------------------------------------------------------

const AUTH_JWT_SECRET = 'this-is-a-test-jwt-secret-at-least-32-chars!';
const AUTH_API_KEY_1 = 'api-key-alpha-at-least-32-characters-long!';
const AUTH_API_KEY_2 = 'api-key-bravo-at-least-32-characters-long!';

const authFixtures = {
  /** A valid JWT secret meeting the 32-character minimum. */
  validJwtSecret: AUTH_JWT_SECRET,

  /** A valid API key meeting the 32-character minimum. */
  validApiKey: AUTH_API_KEY_1,

  /** A second valid API key for multi-key tests. */
  validApiKey2: AUTH_API_KEY_2,

  /** Minimal auth config (JWT-only mode). */
  jwtOnly: Object.freeze<AuthConfig>({
    mode: 'jwt',
    jwtSecret: AUTH_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [],
    allowLoopback: false,
    rateLimitMaxMessages: 100,
    rateLimitWindowMs: 60_000,
    maxConnectionsPerClient: 10,
  }),

  /** API-key-only auth config. */
  apiKeyOnly: Object.freeze<AuthConfig>({
    mode: 'api-key',
    jwtSecret: AUTH_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [
      { key: AUTH_API_KEY_1, clientId: 'alpha', scopes: [] },
      { key: AUTH_API_KEY_2, clientId: 'bravo', scopes: ['read'] },
    ],
    allowLoopback: false,
    rateLimitMaxMessages: 100,
    rateLimitWindowMs: 60_000,
    maxConnectionsPerClient: 10,
  }),

  /** Both JWT and API key auth. */
  bothModes: Object.freeze<AuthConfig>({
    mode: 'both',
    jwtSecret: AUTH_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [
      { key: AUTH_API_KEY_1, clientId: 'alpha', scopes: [] },
    ],
    allowLoopback: false,
    rateLimitMaxMessages: 100,
    rateLimitWindowMs: 60_000,
    maxConnectionsPerClient: 10,
  }),

  /** Auth config with loopback bypass enabled. */
  withLoopback: Object.freeze<AuthConfig>({
    mode: 'both',
    jwtSecret: AUTH_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [],
    allowLoopback: true,
    rateLimitMaxMessages: 100,
    rateLimitWindowMs: 60_000,
    maxConnectionsPerClient: 10,
  }),

  /** Strict rate limiting for testing throttle behavior. */
  strictRateLimit: Object.freeze<AuthConfig>({
    mode: 'both',
    jwtSecret: AUTH_JWT_SECRET,
    jwtIssuer: 'wundr-orchestrator',
    jwtAudience: 'wundr-daemon',
    jwtExpiresInSeconds: 3600,
    apiKeys: [
      { key: AUTH_API_KEY_1, clientId: 'alpha', scopes: [] },
    ],
    allowLoopback: false,
    rateLimitMaxMessages: 5,       // very low for testing
    rateLimitWindowMs: 10_000,     // 10s window
    maxConnectionsPerClient: 2,    // low concurrency
  }),
} as const;

// ---------------------------------------------------------------------------
// Memory fixtures
// ---------------------------------------------------------------------------

const memoryFixtures = {
  /** Default memory configuration. */
  default: Object.freeze<MemoryConfig>({
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
  }),

  /** Aggressive compaction thresholds for testing compaction triggers. */
  aggressiveCompaction: Object.freeze<MemoryConfig>({
    version: '1.0',
    tiers: {
      scratchpad: {
        description: 'Working memory',
        maxSize: '512KB',
        ttl: 'session',
        persistence: 'session',
      },
      episodic: {
        description: 'Recent interactions',
        maxSize: '1MB',
        ttl: '1h',
        persistence: 'local',
      },
      semantic: {
        description: 'Long-term knowledge',
        maxSize: '5MB',
        ttl: 'permanent',
        persistence: 'permanent',
      },
    },
    compaction: {
      enabled: true,
      threshold: 0.5, // triggers sooner
      strategy: 'summarize',
    },
    retrieval: {
      strategy: 'keyword',
      maxResults: 3, // small result set
      similarityThreshold: 0.5,
    },
  }),

  /** Compaction disabled. */
  noCompaction: Object.freeze<MemoryConfig>({
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
      enabled: false,
      threshold: 0.8,
      strategy: 'summarize',
    },
    retrieval: {
      strategy: 'keyword',
      maxResults: 10,
      similarityThreshold: 0.7,
    },
  }),
} as const;

// ---------------------------------------------------------------------------
// Config fixtures (environment variable sets)
// ---------------------------------------------------------------------------

const configFixtures = {
  /** Minimum env vars to load a valid config. */
  minimalEnv: Object.freeze({
    OPENAI_API_KEY: 'sk-test-key-for-fixtures-only',
  }),

  /** Full environment variable set. */
  fullEnv: Object.freeze({
    OPENAI_API_KEY: 'sk-test-key-for-fixtures-only',
    DAEMON_NAME: 'fixture-daemon',
    DAEMON_PORT: '9000',
    DAEMON_HOST: '0.0.0.0',
    DAEMON_MAX_SESSIONS: '50',
    DAEMON_VERBOSE: 'true',
    DAEMON_JWT_SECRET: AUTH_JWT_SECRET,
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  }),

  /** Distributed cluster config. */
  distributedEnv: Object.freeze({
    OPENAI_API_KEY: 'sk-test-key-for-fixtures-only',
    CLUSTER_NAME: 'test-cluster',
    LOAD_BALANCING_STRATEGY: 'round-robin',
  }),
} as const;

// ---------------------------------------------------------------------------
// Charter fixtures
// ---------------------------------------------------------------------------

const charterFixtures = {
  /** A minimal valid charter. */
  basic: Object.freeze({
    name: 'test-orchestrator',
    role: 'assistant',
    tier: 1,
    identity: {
      name: 'Test Bot',
      email: 'test@example.com',
    },
    responsibilities: ['code review', 'testing'],
    resourceLimits: {
      maxSessions: 10,
      tokenBudget: {
        subscription: 'pro',
        api: 'standard',
      },
      memory: {
        maxHeapMB: 2048,
        maxContextTokens: 100000,
      },
    },
    measurableObjectives: {
      codeQuality: '> 90%',
      testCoverage: '> 80%',
    },
    hardConstraints: [
      'Never execute rm -rf /',
      'Never expose API keys in output',
    ],
    safetyHeuristics: {
      autoApprove: ['read_file', 'list_files'],
      alwaysReject: ['rm -rf', 'format disk'],
      escalate: ['deploy', 'database migration'],
    },
  }),
} as const;

// ---------------------------------------------------------------------------
// WebSocket protocol fixtures
// ---------------------------------------------------------------------------

const protocolFixtures = {
  /** All valid WSMessage types. */
  messages: Object.freeze({
    ping: { type: 'ping' as const },
    pong: { type: 'pong' as const },
    healthCheck: { type: 'health_check' as const },
    listSessions: { type: 'list_sessions' as const },
    daemonStatus: { type: 'daemon_status' as const },
    spawnSession: {
      type: 'spawn_session' as const,
      payload: {
        orchestratorId: 'orch-1',
        task: {
          type: 'code' as const,
          description: 'Test task',
          priority: 'medium' as const,
          status: 'pending' as const,
        },
        sessionType: 'claude-code' as const,
      },
    },
    executeTask: {
      type: 'execute_task' as const,
      payload: {
        sessionId: 'session-1',
        task: 'Write unit tests',
      },
    },
    stopSession: {
      type: 'stop_session' as const,
      payload: { sessionId: 'session-1' },
    },
    sessionStatus: {
      type: 'session_status' as const,
      payload: { sessionId: 'session-1' },
    },
  }),
} as const;

// ---------------------------------------------------------------------------
// Barrel export
// ---------------------------------------------------------------------------

export const FIXTURES = {
  auth: authFixtures,
  memory: memoryFixtures,
  config: configFixtures,
  charter: charterFixtures,
  protocol: protocolFixtures,
} as const;
