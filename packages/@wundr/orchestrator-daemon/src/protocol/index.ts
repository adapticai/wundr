/**
 * WebSocket Protocol v2 -- Public API
 *
 * Re-exports all protocol types, schemas, constants, and runtime classes
 * from a single entry point.
 */

// Protocol types, schemas, constants, error codes, scope utilities
export {
  // Constants
  PROTOCOL_VERSION,
  MAX_PAYLOAD_BYTES,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  MAX_BUFFERED_BYTES,
  BINARY_HEADER_VERSION,
  BINARY_HEADER_FIXED_SIZE,
  BinaryFlags,

  // Error codes
  ErrorCodes,
  type ErrorCode,
  ErrorShapeSchema,
  type ErrorShape,
  errorShape,

  // Scopes
  Scopes,
  type Scope,
  ScopeSchema,
  expandScopes,
  hasRequiredScopes,

  // Frame schemas
  RequestFrameSchema,
  type RequestFrame,
  ResponseFrameSchema,
  type ResponseFrame,
  EventFrameSchema,
  type EventFrame,
  ProtocolFrameSchema,
  type ProtocolFrame,

  // Binary metadata
  BinaryMetadataSchema,
  type BinaryMetadata,

  // Auth domain
  AuthTypeSchema,
  ClientInfoSchema,
  type ClientInfo,
  AuthConnectParamsSchema,
  type AuthConnectParams,
  HelloPayloadSchema,
  type HelloPayload,
  AuthRefreshParamsSchema,
  type AuthRefreshParams,
  AuthLogoutParamsSchema,
  type AuthLogoutParams,

  // Session domain
  SessionTypeSchema,
  SessionCreateParamsSchema,
  type SessionCreateParams,
  SessionResumeParamsSchema,
  type SessionResumeParams,
  SessionStopParamsSchema,
  type SessionStopParams,
  SessionListParamsSchema,
  type SessionListParams,
  SessionStatusParamsSchema,
  type SessionStatusParams,

  // Prompt domain
  PromptSubmitParamsSchema,
  type PromptSubmitParams,
  PromptCancelParamsSchema,
  type PromptCancelParams,

  // Stream events
  StreamChunkTypeSchema,
  StreamStartPayloadSchema,
  type StreamStartPayload,
  StreamChunkPayloadSchema,
  type StreamChunkPayload,
  StreamEndPayloadSchema,
  type StreamEndPayload,
  StreamErrorPayloadSchema,
  type StreamErrorPayload,

  // Tool domain
  ToolRequestPayloadSchema,
  type ToolRequestPayload,
  ToolApproveParamsSchema,
  type ToolApproveParams,
  ToolDenyParamsSchema,
  type ToolDenyParams,
  ToolResultPayloadSchema,
  type ToolResultPayload,
  ToolStatusPayloadSchema,
  type ToolStatusPayload,

  // Agent domain
  AgentSpawnParamsSchema,
  type AgentSpawnParams,
  AgentStatusParamsSchema,
  type AgentStatusParams,
  AgentStatusPayloadSchema,
  type AgentStatusPayload,
  AgentStopParamsSchema,
  type AgentStopParams,

  // Team domain
  TeamCreateParamsSchema,
  type TeamCreateParams,
  TeamStatusParamsSchema,
  type TeamStatusParams,
  TeamStatusPayloadSchema,
  type TeamStatusPayload,
  TeamMessageParamsSchema,
  type TeamMessageParams,
  TeamDissolveParamsSchema,
  type TeamDissolveParams,

  // Memory domain
  MemoryQueryParamsSchema,
  type MemoryQueryParams,
  MemoryStoreParamsSchema,
  type MemoryStoreParams,
  MemoryDeleteParamsSchema,
  type MemoryDeleteParams,

  // Config domain
  ConfigGetParamsSchema,
  type ConfigGetParams,
  ConfigSetParamsSchema,
  type ConfigSetParams,

  // Health domain
  HealthPingParamsSchema,
  type HealthPingParams,
  HealthPongPayloadSchema,
  type HealthPongPayload,
  HealthStatusPayloadSchema,
  type HealthStatusPayload,
  HeartbeatPayloadSchema,
  type HeartbeatPayload,

  // Subscription domain
  SubscribeParamsSchema,
  type SubscribeParams,
  SubscribeResultSchema,
  type SubscribeResult,
  UnsubscribeParamsSchema,
  type UnsubscribeParams,

  // Catalogs
  PROTOCOL_V2_METHODS,
  type ProtocolMethod,
  PROTOCOL_V2_EVENTS,
  type ProtocolEvent,

  // Scope map
  METHOD_SCOPE_MAP,
  METHOD_PARAM_SCHEMAS,
} from './protocol-v2';

// RPC handler
export {
  type HandlerContext,
  type MethodHandler,
  type MethodHandlerMap,
  RpcHandler,
  createSubscriptionHandlers,
  createHealthPingHandler,
} from './rpc-handler';

// Subscription manager
export {
  type Subscription,
  type EventSink,
  SubscriptionManager,
  compileGlob,
} from './subscription-manager';

// Message router
export {
  type AuthenticateFunc,
  type AuthResult,
  type TransportCallbacks,
  type MessageRouterConfig,
  type RouterLogger,
  type BinaryFrameHandler,
  MessageRouter,
} from './message-router';
