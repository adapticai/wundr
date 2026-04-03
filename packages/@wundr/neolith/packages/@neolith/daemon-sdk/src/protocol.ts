/**
 * Protocol v2 types for the daemon SDK client.
 *
 * Mirrors the wire format defined in the orchestrator daemon's protocol-v2.ts.
 * Kept self-contained here so the SDK has no compile-time dependency on the
 * daemon's internal packages.
 */

// ---------------------------------------------------------------------------
// Wire frame types
// ---------------------------------------------------------------------------

export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  subscriptionId?: string;
}

export type ProtocolFrame = RequestFrame | ResponseFrame | EventFrame;

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// Auth domain
// ---------------------------------------------------------------------------

export type AuthType = 'jwt' | 'api-key';

export interface ClientInfo {
  id: string;
  version: string;
  platform: string;
  displayName?: string;
  instanceId?: string;
}

export interface AuthConnectParams {
  minProtocol: number;
  maxProtocol: number;
  auth: {
    type: AuthType;
    token: string;
  };
  client: ClientInfo;
  capabilities?: string[];
  scopes?: string[];
}

export interface HelloPayload {
  type: 'hello';
  protocol: number;
  connectionId: string;
  server: {
    version: string;
    capabilities: string[];
  };
  methods: string[];
  events: string[];
  policy: {
    maxPayloadBytes: number;
    heartbeatIntervalMs: number;
    heartbeatTimeoutMs: number;
    maxBufferedBytes: number;
  };
  auth?: {
    scopes: string[];
    expiresAtMs?: number;
  };
}

// ---------------------------------------------------------------------------
// Session domain
// ---------------------------------------------------------------------------

export type SessionType = 'claude-code' | 'ruflo';
export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated';
export type TaskType = 'code' | 'research' | 'analysis' | 'custom' | 'general';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SessionCreateParams {
  orchestratorId: string;
  sessionType: SessionType;
  task: {
    type: TaskType;
    description: string;
    priority: TaskPriority;
    metadata?: Record<string, unknown>;
  };
  memoryProfile?: string;
  subscribe?: boolean;
}

export interface SessionResumeParams {
  sessionId: string;
  subscribe?: boolean;
}

export interface SessionStopParams {
  sessionId: string;
  reason?: string;
  force?: boolean;
}

export interface SessionListParams {
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

export interface SessionStatusParams {
  sessionId: string;
}

export interface SessionInfo {
  id: string;
  orchestratorId: string;
  sessionType: SessionType;
  status: SessionStatus;
  task: {
    type: TaskType;
    description: string;
    priority: TaskPriority;
  };
  startedAt: string;
  endedAt?: string;
  metrics?: {
    tokensUsed: number;
    durationMs: number;
    tasksCompleted: number;
  };
}

// ---------------------------------------------------------------------------
// Health domain
// ---------------------------------------------------------------------------

export interface HealthPingParams {
  clientTimestamp?: number;
}

export interface HealthPongPayload {
  serverTimestamp: number;
  clientTimestamp?: number;
}

export interface SubsystemHealth {
  status: 'running' | 'degraded' | 'error' | 'stopped';
  lastCheckAt?: string;
  errors?: string[];
}

export interface HealthMetrics {
  totalSessionsSpawned: number;
  totalTokensUsed: number;
  averageResponseTimeMs: number;
  successRate: number;
}

export interface HealthStatusPayload {
  status: 'initializing' | 'running' | 'degraded' | 'stopped';
  uptime: number;
  activeSessions: number;
  connectedClients: number;
  subsystems: Record<string, SubsystemHealth>;
  metrics?: HealthMetrics;
}

export interface HeartbeatPayload {
  serverTimestamp: number;
  seq: number;
}

// ---------------------------------------------------------------------------
// Subscription domain
// ---------------------------------------------------------------------------

export interface SubscribeParams {
  events: string[];
  filter?: Record<string, unknown>;
}

export interface SubscribeResult {
  subscriptionId: string;
  events: string[];
}

export interface UnsubscribeParams {
  subscriptionId: string;
}

// ---------------------------------------------------------------------------
// Stream events (server -> client)
// ---------------------------------------------------------------------------

export type StreamChunkType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'code'
  | 'error';

export interface StreamStartPayload {
  sessionId: string;
  promptId: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamChunkPayload {
  sessionId: string;
  promptId: string;
  chunkType: StreamChunkType;
  content: string;
  index?: number;
}

export interface StreamEndPayload {
  sessionId: string;
  promptId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface StreamErrorPayload {
  sessionId: string;
  promptId: string;
  error: ErrorShape;
}

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = 2;
export const CLIENT_VERSION = '0.1.1';
export const CLIENT_ID = '@neolith/daemon-sdk';
export const CLIENT_PLATFORM = 'neolith-web';
