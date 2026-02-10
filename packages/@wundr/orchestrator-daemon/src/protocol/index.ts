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

  // Scope map and param registries
  METHOD_SCOPE_MAP,
  METHOD_PARAM_SCHEMAS,
  EVENT_PAYLOAD_SCHEMAS,

  // Frame utilities
  parseFrame,
  type ParseFrameResult,
  successResponse,
  errorResponse,
  eventFrame,
} from './protocol-v2';

// RPC handler
export {
  type HandlerContext,
  type MethodHandler,
  type MethodHandlerMap,
  type RequestMetrics,
  type RpcHandlerOptions,
  RpcHandler,
  createSubscriptionHandlers,
  createHealthPingHandler,
  createDiscoveryHandlers,
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

// Rate limiter
export {
  type RateLimitConfig,
  type RateLimitResult,
  RateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  METHOD_COST_MAP,
} from './rate-limiter';

// Message codec (compression, batching, binary encoding)
export {
  type CompressionAlgorithm,
  type CodecConfig,
  type EncodeResult,
  type DecodeTextResult,
  type DecodeBinaryResult,
  MessageCodec,
} from './message-codec';

// Streaming response
export {
  type StreamSink,
  type StreamProgress,
  type StreamState,
  StreamingResponse,
  StreamGuard,
  createStreamingResponse,
} from './streaming-response';

// Method registry (discovery)
export {
  type MethodDescriptor,
  type EventDescriptor,
  type DiscoveryResult,
  type RpcDiscoverParams,
  type RpcDescribeParams,
  MethodRegistry,
  RpcDiscoverParamsSchema,
  RpcDescribeParamsSchema,
} from './method-registry';

// JSON-RPC 2.0 compatibility
export {
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type JsonRpcMessage,
  type InboundResult,
  isJsonRpcMessage,
  isJsonRpcBatch,
  jsonRpcToNative,
  nativeResponseToJsonRpc,
  nativeEventToJsonRpc,
  jsonRpcErrorResponse,
  wundrErrorToJsonRpcCode,
  jsonRpcCodeToWundrError,
} from './jsonrpc-compat';

// Protocol upgrade (v1 -> v2)
export {
  type V1Request,
  type V1Response,
  type V1Event,
  type DetectedFormat,
  isV1Message,
  isJsonRpc2,
  isNativeV2,
  detectFormat,
  v1RequestToV2,
  v2ResponseToV1,
  v2EventToV1,
  V1Adapter,
} from './protocol-upgrade';
