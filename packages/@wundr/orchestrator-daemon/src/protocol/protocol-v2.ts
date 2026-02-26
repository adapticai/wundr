/**
 * WebSocket Protocol v2 -- Message Types and Zod Schemas
 *
 * Defines the complete wire protocol for the orchestrator daemon's WebSocket
 * interface.  Inspired by OpenClaw's gateway protocol (req/res/event frame
 * model with protocol negotiation, scope-based auth, and server-push events)
 * but adapted for Wundr's agent orchestration, tool approval, team
 * coordination, and memory subsystems.
 *
 * Every JSON text frame is one of three discriminated types:
 *   - Request  { type: "req",   id, method, params? }
 *   - Response { type: "res",   id, ok, payload?, error? }
 *   - Event    { type: "event", event, payload?, seq?, subscriptionId? }
 *
 * Binary frames use a compact header for file transfers (see BinaryHeader).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

/** Current server protocol version. */
export const PROTOCOL_VERSION = 2;

/** Maximum payload size in bytes (10 MiB). */
export const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

/** Default heartbeat interval sent by the server (ms). */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

/** If no frame is received within this window the connection is dropped. */
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 90_000;

/** Maximum buffered bytes per connection before back-pressure kicks in. */
export const MAX_BUFFERED_BYTES = 16 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  UNAVAILABLE: 'UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ErrorShapeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  retryable: z.boolean().optional(),
  retryAfterMs: z.number().int().nonnegative().optional(),
});

export type ErrorShape = z.infer<typeof ErrorShapeSchema>;

/** Helper to construct an ErrorShape value. */
export function errorShape(
  code: ErrorCode,
  message: string,
  opts?: { details?: unknown; retryable?: boolean; retryAfterMs?: number }
): ErrorShape {
  return {
    code,
    message,
    details: opts?.details,
    retryable: opts?.retryable,
    retryAfterMs: opts?.retryAfterMs,
  };
}

// ---------------------------------------------------------------------------
// Authorization scopes
// ---------------------------------------------------------------------------

export const Scopes = {
  ADMIN: 'daemon.admin',
  READ: 'daemon.read',
  WRITE: 'daemon.write',
  APPROVE: 'daemon.approve',
  TEAMS: 'daemon.teams',
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

export const ScopeSchema = z.enum([
  Scopes.ADMIN,
  Scopes.READ,
  Scopes.WRITE,
  Scopes.APPROVE,
  Scopes.TEAMS,
]);

// ---------------------------------------------------------------------------
// Frame schemas -- top-level wire format
// ---------------------------------------------------------------------------

export const RequestFrameSchema = z.object({
  type: z.literal('req'),
  id: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export type RequestFrame = z.infer<typeof RequestFrameSchema>;

export const ResponseFrameSchema = z.object({
  type: z.literal('res'),
  id: z.string().min(1),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: ErrorShapeSchema.optional(),
});

export type ResponseFrame = z.infer<typeof ResponseFrameSchema>;

export const EventFrameSchema = z.object({
  type: z.literal('event'),
  event: z.string().min(1),
  payload: z.unknown().optional(),
  seq: z.number().int().nonnegative().optional(),
  subscriptionId: z.string().optional(),
});

export type EventFrame = z.infer<typeof EventFrameSchema>;

export const ProtocolFrameSchema = z.discriminatedUnion('type', [
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
]);

export type ProtocolFrame = z.infer<typeof ProtocolFrameSchema>;

// ---------------------------------------------------------------------------
// Binary frame header
// ---------------------------------------------------------------------------

/**
 * Binary frames use the following byte layout:
 *
 *   [1 byte version] [1 byte flags] [16 bytes correlationId (UUID)]
 *   [4 bytes metaLen (uint32 BE)] [metaLen bytes JSON metadata]
 *   [remaining bytes = binary payload]
 *
 * Flag bits:
 *   bit 0 -- compressed (zlib)
 *   bit 1 -- chunked (more fragments follow)
 *   bit 2 -- final fragment
 */

export const BinaryFlags = {
  COMPRESSED: 0x01,
  CHUNKED: 0x02,
  FINAL: 0x04,
} as const;

export const BinaryMetadataSchema = z.object({
  /** The RPC method this binary payload relates to (e.g. "file.upload"). */
  method: z.string().min(1).optional(),
  /** MIME type of the payload. */
  contentType: z.string().optional(),
  /** Original filename. */
  filename: z.string().optional(),
  /** Total size across all chunks (-1 if unknown). */
  totalSize: z.number().int().optional(),
  /** 0-based chunk index for chunked transfers. */
  chunkIndex: z.number().int().nonnegative().optional(),
  /** Arbitrary extra metadata. */
  extra: z.record(z.unknown()).optional(),
});

export type BinaryMetadata = z.infer<typeof BinaryMetadataSchema>;

export const BINARY_HEADER_VERSION = 1;
export const BINARY_HEADER_FIXED_SIZE = 1 + 1 + 16 + 4; // 22 bytes

// ---------------------------------------------------------------------------
// Auth domain
// ---------------------------------------------------------------------------

export const AuthTypeSchema = z.enum(['jwt', 'api-key']);

export const ClientInfoSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  platform: z.string().min(1),
  displayName: z.string().optional(),
  instanceId: z.string().optional(),
});

export type ClientInfo = z.infer<typeof ClientInfoSchema>;

export const AuthConnectParamsSchema = z.object({
  minProtocol: z.number().int().min(1),
  maxProtocol: z.number().int().min(1),
  auth: z.object({
    type: AuthTypeSchema,
    token: z.string().min(1),
  }),
  client: ClientInfoSchema,
  capabilities: z.array(z.string()).optional(),
  scopes: z.array(ScopeSchema).optional(),
});

export type AuthConnectParams = z.infer<typeof AuthConnectParamsSchema>;

export const HelloPayloadSchema = z.object({
  type: z.literal('hello'),
  protocol: z.number().int().min(1),
  connectionId: z.string().min(1),
  server: z.object({
    version: z.string().min(1),
    capabilities: z.array(z.string()),
  }),
  methods: z.array(z.string()),
  events: z.array(z.string()),
  policy: z.object({
    maxPayloadBytes: z.number().int().positive(),
    heartbeatIntervalMs: z.number().int().positive(),
    heartbeatTimeoutMs: z.number().int().positive(),
    maxBufferedBytes: z.number().int().positive(),
  }),
  auth: z
    .object({
      scopes: z.array(ScopeSchema),
      expiresAtMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type HelloPayload = z.infer<typeof HelloPayloadSchema>;

export const AuthRefreshParamsSchema = z.object({
  token: z.string().min(1),
});

export type AuthRefreshParams = z.infer<typeof AuthRefreshParamsSchema>;

export const AuthLogoutParamsSchema = z.object({
  reason: z.string().optional(),
});

export type AuthLogoutParams = z.infer<typeof AuthLogoutParamsSchema>;

// ---------------------------------------------------------------------------
// Session domain
// ---------------------------------------------------------------------------

export const SessionTypeSchema = z.enum(['claude-code', 'claude-flow']);

export const SessionCreateParamsSchema = z.object({
  orchestratorId: z.string().min(1),
  sessionType: SessionTypeSchema,
  task: z.object({
    type: z.enum(['code', 'research', 'analysis', 'custom', 'general']),
    description: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    metadata: z.record(z.unknown()).optional(),
  }),
  memoryProfile: z.string().optional(),
  /** If true, auto-subscribe the caller to session events. */
  subscribe: z.boolean().default(true),
});

export type SessionCreateParams = z.infer<typeof SessionCreateParamsSchema>;

export const SessionResumeParamsSchema = z.object({
  sessionId: z.string().min(1),
  subscribe: z.boolean().default(true),
});

export type SessionResumeParams = z.infer<typeof SessionResumeParamsSchema>;

export const SessionStopParamsSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().optional(),
  force: z.boolean().default(false),
});

export type SessionStopParams = z.infer<typeof SessionStopParamsSchema>;

export const SessionListParamsSchema = z.object({
  status: z
    .enum([
      'initializing',
      'running',
      'paused',
      'completed',
      'failed',
      'terminated',
    ])
    .optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export type SessionListParams = z.infer<typeof SessionListParamsSchema>;

export const SessionStatusParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export type SessionStatusParams = z.infer<typeof SessionStatusParamsSchema>;

// ---------------------------------------------------------------------------
// Prompt domain
// ---------------------------------------------------------------------------

export const PromptSubmitParamsSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  /** Whether to stream the response back. Defaults to true. */
  stream: z.boolean().default(true),
  /** Model override for this prompt only. */
  model: z.string().optional(),
  /** Maximum tokens budget for the response. */
  maxTokens: z.number().int().positive().optional(),
});

export type PromptSubmitParams = z.infer<typeof PromptSubmitParamsSchema>;

export const PromptCancelParamsSchema = z.object({
  sessionId: z.string().min(1),
  /** Optional prompt ID to cancel a specific in-flight prompt. */
  promptId: z.string().optional(),
});

export type PromptCancelParams = z.infer<typeof PromptCancelParamsSchema>;

// ---------------------------------------------------------------------------
// Stream events (server -> client)
// ---------------------------------------------------------------------------

export const StreamChunkTypeSchema = z.enum([
  'text',
  'thinking',
  'tool_use',
  'code',
  'error',
]);

export const StreamStartPayloadSchema = z.object({
  sessionId: z.string().min(1),
  promptId: z.string().min(1),
  model: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type StreamStartPayload = z.infer<typeof StreamStartPayloadSchema>;

export const StreamChunkPayloadSchema = z.object({
  sessionId: z.string().min(1),
  promptId: z.string().min(1),
  chunkType: StreamChunkTypeSchema.default('text'),
  content: z.string(),
  index: z.number().int().nonnegative().optional(),
});

export type StreamChunkPayload = z.infer<typeof StreamChunkPayloadSchema>;

export const StreamEndPayloadSchema = z.object({
  sessionId: z.string().min(1),
  promptId: z.string().min(1),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type StreamEndPayload = z.infer<typeof StreamEndPayloadSchema>;

export const StreamErrorPayloadSchema = z.object({
  sessionId: z.string().min(1),
  promptId: z.string().min(1),
  error: ErrorShapeSchema,
});

export type StreamErrorPayload = z.infer<typeof StreamErrorPayloadSchema>;

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const ToolRequestPayloadSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  toolName: z.string().min(1),
  toolInput: z.record(z.unknown()).optional(),
  /** Whether this tool requires explicit user approval. */
  requiresApproval: z.boolean().default(false),
  /** Timeout in ms before auto-deny if no approval. */
  approvalTimeoutMs: z.number().int().positive().optional(),
});

export type ToolRequestPayload = z.infer<typeof ToolRequestPayloadSchema>;

export const ToolApproveParamsSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  /** Optional modified input to pass to the tool. */
  modifiedInput: z.record(z.unknown()).optional(),
});

export type ToolApproveParams = z.infer<typeof ToolApproveParamsSchema>;

export const ToolDenyParamsSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export type ToolDenyParams = z.infer<typeof ToolDenyParamsSchema>;

export const ToolResultPayloadSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(['completed', 'failed', 'denied', 'timeout']),
  result: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type ToolResultPayload = z.infer<typeof ToolResultPayloadSchema>;

export const ToolStatusPayloadSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(['started', 'running', 'completed', 'failed']),
  progress: z.number().min(0).max(1).optional(),
  message: z.string().optional(),
});

export type ToolStatusPayload = z.infer<typeof ToolStatusPayloadSchema>;

// ---------------------------------------------------------------------------
// Agent domain
// ---------------------------------------------------------------------------

export const AgentSpawnParamsSchema = z.object({
  parentSessionId: z.string().min(1).optional(),
  agentType: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  task: z.object({
    description: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  }),
});

export type AgentSpawnParams = z.infer<typeof AgentSpawnParamsSchema>;

export const AgentStatusParamsSchema = z.object({
  agentId: z.string().min(1),
});

export type AgentStatusParams = z.infer<typeof AgentStatusParamsSchema>;

export const AgentStatusPayloadSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum([
    'initializing',
    'running',
    'paused',
    'completed',
    'failed',
    'stopped',
  ]),
  sessionId: z.string().optional(),
  task: z.string().optional(),
  metrics: z
    .object({
      tokensUsed: z.number().int().nonnegative(),
      durationMs: z.number().int().nonnegative(),
      tasksCompleted: z.number().int().nonnegative(),
    })
    .optional(),
  updatedAt: z.string().datetime().optional(),
});

export type AgentStatusPayload = z.infer<typeof AgentStatusPayloadSchema>;

export const AgentStopParamsSchema = z.object({
  agentId: z.string().min(1),
  reason: z.string().optional(),
  force: z.boolean().default(false),
});

export type AgentStopParams = z.infer<typeof AgentStopParamsSchema>;

// ---------------------------------------------------------------------------
// Team domain
// ---------------------------------------------------------------------------

export const TeamCreateParamsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  agents: z
    .array(
      z.object({
        agentType: z.string().min(1),
        role: z.string().min(1),
        config: z.record(z.unknown()).optional(),
      })
    )
    .min(1),
  coordinationStrategy: z
    .enum(['sequential', 'parallel', 'round-robin', 'custom'])
    .default('parallel'),
  task: z.object({
    description: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  }),
});

export type TeamCreateParams = z.infer<typeof TeamCreateParamsSchema>;

export const TeamStatusParamsSchema = z.object({
  teamId: z.string().min(1),
});

export type TeamStatusParams = z.infer<typeof TeamStatusParamsSchema>;

export const TeamStatusPayloadSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum([
    'forming',
    'active',
    'paused',
    'completed',
    'failed',
    'dissolved',
  ]),
  agents: z.array(AgentStatusPayloadSchema),
  progress: z.number().min(0).max(1).optional(),
  updatedAt: z.string().datetime().optional(),
});

export type TeamStatusPayload = z.infer<typeof TeamStatusPayloadSchema>;

export const TeamMessageParamsSchema = z.object({
  teamId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1).optional(), // Broadcast if omitted
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type TeamMessageParams = z.infer<typeof TeamMessageParamsSchema>;

export const TeamDissolveParamsSchema = z.object({
  teamId: z.string().min(1),
  reason: z.string().optional(),
});

export type TeamDissolveParams = z.infer<typeof TeamDissolveParamsSchema>;

// ---------------------------------------------------------------------------
// Memory domain
// ---------------------------------------------------------------------------

export const MemoryQueryParamsSchema = z.object({
  query: z.string().min(1),
  tier: z.enum(['scratchpad', 'episodic', 'semantic']).optional(),
  sessionId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(10),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
});

export type MemoryQueryParams = z.infer<typeof MemoryQueryParamsSchema>;

export const MemoryStoreParamsSchema = z.object({
  content: z.string().min(1),
  tier: z.enum(['scratchpad', 'episodic', 'semantic']),
  sessionId: z.string().optional(),
  type: z
    .enum(['interaction', 'observation', 'decision', 'knowledge'])
    .default('observation'),
  metadata: z.record(z.unknown()).optional(),
});

export type MemoryStoreParams = z.infer<typeof MemoryStoreParamsSchema>;

export const MemoryDeleteParamsSchema = z.object({
  memoryId: z.string().min(1),
});

export type MemoryDeleteParams = z.infer<typeof MemoryDeleteParamsSchema>;

// ---------------------------------------------------------------------------
// Config domain
// ---------------------------------------------------------------------------

export const ConfigGetParamsSchema = z.object({
  keys: z.array(z.string().min(1)).optional(),
  /** If true, return the full configuration tree. */
  all: z.boolean().default(false),
});

export type ConfigGetParams = z.infer<typeof ConfigGetParamsSchema>;

export const ConfigSetParamsSchema = z.object({
  values: z.record(z.unknown()),
  /** If true, merge with existing config; otherwise replace at key level. */
  merge: z.boolean().default(true),
});

export type ConfigSetParams = z.infer<typeof ConfigSetParamsSchema>;

// ---------------------------------------------------------------------------
// Health domain
// ---------------------------------------------------------------------------

export const HealthPingParamsSchema = z.object({
  clientTimestamp: z.number().int().nonnegative().optional(),
});

export type HealthPingParams = z.infer<typeof HealthPingParamsSchema>;

export const HealthPongPayloadSchema = z.object({
  serverTimestamp: z.number().int().nonnegative(),
  clientTimestamp: z.number().int().nonnegative().optional(),
});

export type HealthPongPayload = z.infer<typeof HealthPongPayloadSchema>;

export const HealthStatusPayloadSchema = z.object({
  status: z.enum(['initializing', 'running', 'degraded', 'stopped']),
  uptime: z.number().int().nonnegative(),
  activeSessions: z.number().int().nonnegative(),
  connectedClients: z.number().int().nonnegative(),
  subsystems: z.record(
    z.object({
      status: z.enum(['running', 'degraded', 'error', 'stopped']),
      lastCheckAt: z.string().datetime().optional(),
      errors: z.array(z.string()).optional(),
    })
  ),
  metrics: z
    .object({
      totalSessionsSpawned: z.number().int().nonnegative(),
      totalTokensUsed: z.number().int().nonnegative(),
      averageResponseTimeMs: z.number().nonnegative(),
      successRate: z.number().min(0).max(1),
    })
    .optional(),
});

export type HealthStatusPayload = z.infer<typeof HealthStatusPayloadSchema>;

export const HeartbeatPayloadSchema = z.object({
  serverTimestamp: z.number().int().nonnegative(),
  seq: z.number().int().nonnegative(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

// ---------------------------------------------------------------------------
// Subscription domain
// ---------------------------------------------------------------------------

export const SubscribeParamsSchema = z.object({
  /** Event names or glob patterns (e.g. "stream.*", "tool.*", "*"). */
  events: z.array(z.string().min(1)).min(1),
  /** Optional filter applied to event payloads. */
  filter: z.record(z.unknown()).optional(),
});

export type SubscribeParams = z.infer<typeof SubscribeParamsSchema>;

export const SubscribeResultSchema = z.object({
  subscriptionId: z.string().min(1),
  events: z.array(z.string()),
});

export type SubscribeResult = z.infer<typeof SubscribeResultSchema>;

export const UnsubscribeParamsSchema = z.object({
  subscriptionId: z.string().min(1),
});

export type UnsubscribeParams = z.infer<typeof UnsubscribeParamsSchema>;

// ---------------------------------------------------------------------------
// Method and event catalogs
// ---------------------------------------------------------------------------

/** All RPC methods the server recognizes. */
export const PROTOCOL_V2_METHODS = [
  // Auth
  'auth.connect',
  'auth.refresh',
  'auth.logout',
  // Session
  'session.create',
  'session.resume',
  'session.stop',
  'session.list',
  'session.status',
  // Prompt
  'prompt.submit',
  'prompt.cancel',
  // Tool
  'tool.approve',
  'tool.deny',
  // Agent
  'agent.spawn',
  'agent.status',
  'agent.stop',
  // Team
  'team.create',
  'team.status',
  'team.message',
  'team.dissolve',
  // Memory
  'memory.query',
  'memory.store',
  'memory.delete',
  // Config
  'config.get',
  'config.set',
  // Health
  'health.ping',
  'health.status',
  // Subscription
  'subscribe',
  'unsubscribe',
  // Discovery
  'rpc.discover',
  'rpc.describe',
] as const;

export type ProtocolMethod = (typeof PROTOCOL_V2_METHODS)[number];

/** All event names the server may push. */
export const PROTOCOL_V2_EVENTS = [
  // Stream
  'stream.start',
  'stream.chunk',
  'stream.end',
  'stream.error',
  'stream.progress',
  // Tool
  'tool.request',
  'tool.result',
  'tool.status',
  // Agent
  'agent.status',
  'agent.spawned',
  'agent.stopped',
  // Team
  'team.status',
  'team.message',
  'team.dissolved',
  // Health
  'health.heartbeat',
  // Session
  'session.status',
  'session.created',
  'session.stopped',
] as const;

export type ProtocolEvent = (typeof PROTOCOL_V2_EVENTS)[number];

// ---------------------------------------------------------------------------
// Scope requirements per method
// ---------------------------------------------------------------------------

/** Maps each method to the minimum scope(s) required. */
export const METHOD_SCOPE_MAP: Record<string, Scope[]> = {
  // Auth -- no scope required (pre-auth)
  'auth.connect': [],
  'auth.refresh': [],
  'auth.logout': [],

  // Read-only methods
  'session.list': [Scopes.READ],
  'session.status': [Scopes.READ],
  'health.ping': [Scopes.READ],
  'health.status': [Scopes.READ],
  'config.get': [Scopes.READ],
  'memory.query': [Scopes.READ],

  // Write methods
  'session.create': [Scopes.WRITE],
  'session.resume': [Scopes.WRITE],
  'session.stop': [Scopes.WRITE],
  'prompt.submit': [Scopes.WRITE],
  'prompt.cancel': [Scopes.WRITE],
  'memory.store': [Scopes.WRITE],
  'memory.delete': [Scopes.WRITE],
  'config.set': [Scopes.ADMIN],

  // Approval methods
  'tool.approve': [Scopes.APPROVE],
  'tool.deny': [Scopes.APPROVE],

  // Agent methods
  'agent.spawn': [Scopes.WRITE],
  'agent.status': [Scopes.READ],
  'agent.stop': [Scopes.WRITE],

  // Team methods
  'team.create': [Scopes.TEAMS],
  'team.status': [Scopes.TEAMS],
  'team.message': [Scopes.TEAMS],
  'team.dissolve': [Scopes.TEAMS],

  // Subscriptions
  subscribe: [Scopes.READ],
  unsubscribe: [Scopes.READ],

  // Discovery (no scope required -- publicly available)
  'rpc.discover': [],
  'rpc.describe': [],
};

// ---------------------------------------------------------------------------
// Read-scope includes write; write includes approve; admin includes all.
// ---------------------------------------------------------------------------

const SCOPE_HIERARCHY: Record<Scope, Scope[]> = {
  [Scopes.ADMIN]: [
    Scopes.ADMIN,
    Scopes.WRITE,
    Scopes.READ,
    Scopes.APPROVE,
    Scopes.TEAMS,
  ],
  [Scopes.WRITE]: [Scopes.WRITE, Scopes.READ],
  [Scopes.READ]: [Scopes.READ],
  [Scopes.APPROVE]: [Scopes.APPROVE],
  [Scopes.TEAMS]: [Scopes.TEAMS],
};

/** Expand a set of granted scopes into the effective set via hierarchy. */
export function expandScopes(granted: Scope[]): Set<Scope> {
  const effective = new Set<Scope>();
  for (const scope of granted) {
    const expanded = SCOPE_HIERARCHY[scope];
    if (expanded) {
      for (const s of expanded) {
        effective.add(s);
      }
    } else {
      effective.add(scope);
    }
  }
  return effective;
}

/** Check whether a set of granted scopes satisfies the required scopes for a method. */
export function hasRequiredScopes(
  granted: Scope[],
  required: Scope[]
): boolean {
  if (required.length === 0) {
    return true;
  }
  const effective = expandScopes(granted);
  return required.some(scope => effective.has(scope));
}

// ---------------------------------------------------------------------------
// Param schema registry -- maps method names to their Zod param schemas
// ---------------------------------------------------------------------------

export const METHOD_PARAM_SCHEMAS: Partial<Record<string, z.ZodType>> = {
  'auth.connect': AuthConnectParamsSchema,
  'auth.refresh': AuthRefreshParamsSchema,
  'auth.logout': AuthLogoutParamsSchema,
  'session.create': SessionCreateParamsSchema,
  'session.resume': SessionResumeParamsSchema,
  'session.stop': SessionStopParamsSchema,
  'session.list': SessionListParamsSchema,
  'session.status': SessionStatusParamsSchema,
  'prompt.submit': PromptSubmitParamsSchema,
  'prompt.cancel': PromptCancelParamsSchema,
  'tool.approve': ToolApproveParamsSchema,
  'tool.deny': ToolDenyParamsSchema,
  'agent.spawn': AgentSpawnParamsSchema,
  'agent.status': AgentStatusParamsSchema,
  'agent.stop': AgentStopParamsSchema,
  'team.create': TeamCreateParamsSchema,
  'team.status': TeamStatusParamsSchema,
  'team.message': TeamMessageParamsSchema,
  'team.dissolve': TeamDissolveParamsSchema,
  'memory.query': MemoryQueryParamsSchema,
  'memory.store': MemoryStoreParamsSchema,
  'memory.delete': MemoryDeleteParamsSchema,
  'config.get': ConfigGetParamsSchema,
  'config.set': ConfigSetParamsSchema,
  'health.ping': HealthPingParamsSchema,
  subscribe: SubscribeParamsSchema,
  unsubscribe: UnsubscribeParamsSchema,
};

// ---------------------------------------------------------------------------
// Event payload schema registry -- maps event names to their Zod payload schemas
// ---------------------------------------------------------------------------

export const EVENT_PAYLOAD_SCHEMAS: Partial<Record<string, z.ZodType>> = {
  'stream.start': StreamStartPayloadSchema,
  'stream.chunk': StreamChunkPayloadSchema,
  'stream.end': StreamEndPayloadSchema,
  'stream.error': StreamErrorPayloadSchema,
  'stream.progress': z.object({
    streamId: z.string().min(1),
    requestId: z.string().min(1),
    index: z.number().int().nonnegative(),
    data: z.unknown(),
    progress: z.number().min(0).max(1).optional(),
    message: z.string().optional(),
  }),
  'tool.request': ToolRequestPayloadSchema,
  'tool.result': ToolResultPayloadSchema,
  'tool.status': ToolStatusPayloadSchema,
  'agent.status': AgentStatusPayloadSchema,
  'agent.spawned': AgentStatusPayloadSchema,
  'agent.stopped': AgentStatusPayloadSchema,
  'team.status': TeamStatusPayloadSchema,
  'team.message': TeamMessageParamsSchema,
  'team.dissolved': TeamDissolveParamsSchema,
  'health.heartbeat': HeartbeatPayloadSchema,
  'session.status': z.object({
    sessionId: z.string().min(1),
    status: z.enum([
      'initializing',
      'running',
      'paused',
      'completed',
      'failed',
      'terminated',
    ]),
    metadata: z.record(z.unknown()).optional(),
  }),
  'session.created': z.object({
    sessionId: z.string().min(1),
    sessionType: SessionTypeSchema,
    metadata: z.record(z.unknown()).optional(),
  }),
  'session.stopped': z.object({
    sessionId: z.string().min(1),
    reason: z.string().optional(),
  }),
};

// ---------------------------------------------------------------------------
// Frame parsing utility
// ---------------------------------------------------------------------------

export type ParseFrameResult =
  | { ok: true; frame: ProtocolFrame }
  | { ok: false; error: string; requestId?: string };

/**
 * Parse a raw JSON string into a validated ProtocolFrame.
 *
 * Returns a discriminated result so the caller can extract the request ID
 * for error responses even when the frame is malformed.
 */
export function parseFrame(data: string): ParseFrameResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { ok: false, error: 'malformed JSON' };
  }

  // Extract id for error correlation even on parse failure
  const maybeId =
    parsed && typeof parsed === 'object' && 'id' in parsed
      ? String((parsed as Record<string, unknown>).id)
      : undefined;

  const result = ProtocolFrameSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `invalid frame: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      requestId: maybeId,
    };
  }

  return { ok: true, frame: result.data };
}

// ---------------------------------------------------------------------------
// Response construction helpers
// ---------------------------------------------------------------------------

/** Build a success ResponseFrame. */
export function successResponse(id: string, payload?: unknown): ResponseFrame {
  return { type: 'res', id, ok: true, payload };
}

/** Build an error ResponseFrame. */
export function errorResponse(
  id: string,
  code: ErrorCode,
  message: string,
  opts?: { details?: unknown; retryable?: boolean; retryAfterMs?: number }
): ResponseFrame {
  return {
    type: 'res',
    id,
    ok: false,
    error: errorShape(code, message, opts),
  };
}

/** Build an EventFrame. */
export function eventFrame(
  event: string,
  payload?: unknown,
  opts?: { seq?: number; subscriptionId?: string }
): EventFrame {
  return {
    type: 'event',
    event,
    payload,
    seq: opts?.seq,
    subscriptionId: opts?.subscriptionId,
  };
}
