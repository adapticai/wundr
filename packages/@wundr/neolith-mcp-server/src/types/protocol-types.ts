/**
 * Neolith MCP Server Protocol Type Definitions
 *
 * Implements the Model Context Protocol (MCP) specification types
 * for Claude Code integration via stdio transport.
 *
 * @see https://spec.modelcontextprotocol.io/specification/
 */

import { z } from 'zod';

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

/**
 * JSON-RPC 2.0 request ID - can be string, number, or null
 */
export type JsonRpcId = string | number | null;

/**
 * JSON-RPC 2.0 version constant
 */
export const JSONRPC_VERSION = '2.0' as const;

/**
 * Base JSON-RPC 2.0 message structure
 */
export interface JsonRpcMessage {
  readonly jsonrpc: typeof JSONRPC_VERSION;
}

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest extends JsonRpcMessage {
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: Record<string, unknown> | unknown[];
}

/**
 * JSON-RPC 2.0 Notification (request without id)
 */
export interface JsonRpcNotification extends JsonRpcMessage {
  readonly method: string;
  readonly params?: Record<string, unknown> | unknown[];
}

/**
 * JSON-RPC 2.0 Success Response
 */
export interface JsonRpcSuccessResponse extends JsonRpcMessage {
  readonly id: JsonRpcId;
  readonly result: unknown;
}

/**
 * JSON-RPC 2.0 Error Response
 */
export interface JsonRpcErrorResponse extends JsonRpcMessage {
  readonly id: JsonRpcId;
  readonly error: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Error object
 */
export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

/**
 * Union type for all JSON-RPC responses
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

// =============================================================================
// Standard JSON-RPC Error Codes
// =============================================================================

export const JsonRpcErrorCodes = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Server errors (reserved range: -32099 to -32000)
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
  // MCP-specific errors
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_ERROR: -32002,
  RESOURCE_NOT_FOUND: -32003,
  PROMPT_NOT_FOUND: -32004,
  CAPABILITY_NOT_SUPPORTED: -32005,
} as const;

export type JsonRpcErrorCode = typeof JsonRpcErrorCodes[keyof typeof JsonRpcErrorCodes];

// =============================================================================
// MCP Protocol Types
// =============================================================================

/**
 * MCP Protocol Version
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05' as const;

/**
 * MCP Server Information
 */
export interface ServerInfo {
  readonly name: string;
  readonly version: string;
  readonly protocolVersion?: string;
}

/**
 * MCP Client Information
 */
export interface ClientInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * MCP Server Capabilities
 */
export interface ServerCapabilities {
  readonly tools?: ToolsCapability;
  readonly resources?: ResourcesCapability;
  readonly prompts?: PromptsCapability;
  readonly logging?: LoggingCapability;
  readonly experimental?: Record<string, unknown>;
}

export interface ToolsCapability {
  readonly listChanged?: boolean;
}

export interface ResourcesCapability {
  readonly subscribe?: boolean;
  readonly listChanged?: boolean;
}

export interface PromptsCapability {
  readonly listChanged?: boolean;
}

export interface LoggingCapability {
  readonly levels?: readonly LogLevel[];
}

/**
 * MCP Client Capabilities
 */
export interface ClientCapabilities {
  readonly roots?: RootsCapability;
  readonly sampling?: SamplingCapability;
  readonly experimental?: Record<string, unknown>;
}

export interface RootsCapability {
  readonly listChanged?: boolean;
}

export interface SamplingCapability {
  // Sampling-specific capabilities
}

// =============================================================================
// MCP Tool Types
// =============================================================================

/**
 * MCP Tool Definition
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
}

/**
 * JSON Schema for tool input
 */
export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * JSON Schema type definition (simplified)
 */
export interface JsonSchema {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly default?: unknown;
  readonly properties?: Record<string, JsonSchema>;
  readonly items?: JsonSchema;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchema;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly oneOf?: readonly JsonSchema[];
  readonly anyOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  readonly not?: JsonSchema;
}

/**
 * Tool Call Request Parameters
 */
export interface ToolCallParams {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

/**
 * Tool Call Result
 */
export interface ToolCallResult {
  readonly content: readonly ToolContent[];
  readonly isError?: boolean;
}

/**
 * Tool Content Types
 */
export type ToolContent = TextContent | ImageContent | EmbeddedResource;

export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface ImageContent {
  readonly type: 'image';
  readonly data: string; // base64 encoded
  readonly mimeType: string;
}

export interface EmbeddedResource {
  readonly type: 'resource';
  readonly resource: ResourceContents;
}

// =============================================================================
// MCP Resource Types
// =============================================================================

/**
 * MCP Resource Definition
 */
export interface Resource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/**
 * Resource Contents
 */
export interface ResourceContents {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string; // base64 encoded
}

/**
 * Resource Template for dynamic resources
 */
export interface ResourceTemplate {
  readonly uriTemplate: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

// =============================================================================
// MCP Prompt Types
// =============================================================================

/**
 * MCP Prompt Definition
 */
export interface Prompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: readonly PromptArgument[];
}

/**
 * Prompt Argument Definition
 */
export interface PromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

/**
 * Prompt Message
 */
export interface PromptMessage {
  readonly role: 'user' | 'assistant';
  readonly content: TextContent | ImageContent | EmbeddedResource;
}

/**
 * Get Prompt Result
 */
export interface GetPromptResult {
  readonly description?: string;
  readonly messages: readonly PromptMessage[];
}

// =============================================================================
// MCP Logging Types
// =============================================================================

/**
 * Log Levels
 */
export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Log Message
 */
export interface LogMessage {
  readonly level: LogLevel;
  readonly logger?: string;
  readonly data?: unknown;
}

// =============================================================================
// MCP Request/Response Types
// =============================================================================

/**
 * Initialize Request Parameters
 */
export interface InitializeParams {
  readonly protocolVersion: string;
  readonly capabilities: ClientCapabilities;
  readonly clientInfo: ClientInfo;
}

/**
 * Initialize Response Result
 */
export interface InitializeResult {
  readonly protocolVersion: string;
  readonly capabilities: ServerCapabilities;
  readonly serverInfo: ServerInfo;
  readonly instructions?: string;
}

/**
 * List Tools Request (no parameters)
 */
export interface ListToolsParams {
  readonly cursor?: string;
}

/**
 * List Tools Response
 */
export interface ListToolsResult {
  readonly tools: readonly Tool[];
  readonly nextCursor?: string;
}

/**
 * Call Tool Request
 */
export interface CallToolParams {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

/**
 * Call Tool Response
 */
export interface CallToolResult {
  readonly content: readonly ToolContent[];
  readonly isError?: boolean;
}

/**
 * List Resources Request
 */
export interface ListResourcesParams {
  readonly cursor?: string;
}

/**
 * List Resources Response
 */
export interface ListResourcesResult {
  readonly resources: readonly Resource[];
  readonly nextCursor?: string;
}

/**
 * Read Resource Request
 */
export interface ReadResourceParams {
  readonly uri: string;
}

/**
 * Read Resource Response
 */
export interface ReadResourceResult {
  readonly contents: readonly ResourceContents[];
}

/**
 * List Prompts Request
 */
export interface ListPromptsParams {
  readonly cursor?: string;
}

/**
 * List Prompts Response
 */
export interface ListPromptsResult {
  readonly prompts: readonly Prompt[];
  readonly nextCursor?: string;
}

/**
 * Get Prompt Request
 */
export interface GetPromptParams {
  readonly name: string;
  readonly arguments?: Record<string, string>;
}

// =============================================================================
// MCP Notification Types
// =============================================================================

/**
 * Progress Notification
 */
export interface ProgressNotification {
  readonly progressToken: string | number;
  readonly progress: number;
  readonly total?: number;
}

/**
 * Resource Updated Notification
 */
export interface ResourceUpdatedNotification {
  readonly uri: string;
}

/**
 * Tool List Changed Notification
 */
export interface ToolListChangedNotification {
  // No additional fields required
}

// =============================================================================
// MCP Method Names
// =============================================================================

export const MCPMethods = {
  // Lifecycle
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  SHUTDOWN: 'shutdown',

  // Tools
  LIST_TOOLS: 'tools/list',
  CALL_TOOL: 'tools/call',
  TOOLS_LIST_CHANGED: 'notifications/tools/list_changed',

  // Resources
  LIST_RESOURCES: 'resources/list',
  READ_RESOURCE: 'resources/read',
  SUBSCRIBE_RESOURCE: 'resources/subscribe',
  UNSUBSCRIBE_RESOURCE: 'resources/unsubscribe',
  RESOURCES_LIST_CHANGED: 'notifications/resources/list_changed',
  RESOURCE_UPDATED: 'notifications/resources/updated',

  // Prompts
  LIST_PROMPTS: 'prompts/list',
  GET_PROMPT: 'prompts/get',
  PROMPTS_LIST_CHANGED: 'notifications/prompts/list_changed',

  // Logging
  SET_LOG_LEVEL: 'logging/setLevel',
  LOG_MESSAGE: 'notifications/message',

  // Progress
  PROGRESS: 'notifications/progress',

  // Cancellation
  CANCEL: 'notifications/cancelled',

  // Ping
  PING: 'ping',
} as const;

export type MCPMethod = typeof MCPMethods[keyof typeof MCPMethods];

// =============================================================================
// Transport Types
// =============================================================================

/**
 * Transport interface for MCP communication
 */
export interface MCPTransport {
  /**
   * Start the transport
   */
  start(): Promise<void>;

  /**
   * Stop the transport
   */
  stop(): Promise<void>;

  /**
   * Send a message through the transport
   */
  send(message: JsonRpcMessage): Promise<void>;

  /**
   * Event handler for received messages
   */
  onMessage: ((message: JsonRpcRequest | JsonRpcNotification) => void) | null;

  /**
   * Event handler for transport errors
   */
  onError: ((error: Error) => void) | null;

  /**
   * Event handler for transport close
   */
  onClose: (() => void) | null;
}

/**
 * Transport options
 */
export interface StdioTransportOptions {
  readonly debug?: boolean;
  readonly inputStream?: NodeJS.ReadableStream;
  readonly outputStream?: NodeJS.WritableStream;
}

// =============================================================================
// Server Configuration Types
// =============================================================================

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly capabilities?: Partial<ServerCapabilities>;
  readonly transport?: StdioTransportOptions;
  readonly logging?: LoggingConfig;
  readonly tools?: ToolRegistration[];
  readonly resources?: ResourceRegistration[];
  readonly prompts?: PromptRegistration[];
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  readonly level: LogLevel;
  readonly format?: 'json' | 'text';
  readonly destination?: 'stderr' | 'file';
  readonly filePath?: string;
}

/**
 * Tool registration
 */
export interface ToolRegistration {
  readonly tool: Tool;
  readonly handler: ToolHandler;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolCallResult>;

/**
 * Tool execution context
 */
export interface ToolContext {
  readonly requestId: JsonRpcId;
  readonly signal?: AbortSignal;
  readonly logger: Logger;
  readonly progress: (progress: number, total?: number) => void;
}

/**
 * Resource registration
 */
export interface ResourceRegistration {
  readonly resource: Resource;
  readonly handler: ResourceHandler;
}

/**
 * Resource handler function type
 */
export type ResourceHandler = (
  uri: string,
  context: ResourceContext
) => Promise<ResourceContents>;

/**
 * Resource context
 */
export interface ResourceContext {
  readonly requestId: JsonRpcId;
  readonly logger: Logger;
}

/**
 * Prompt registration
 */
export interface PromptRegistration {
  readonly prompt: Prompt;
  readonly handler: PromptHandler;
}

/**
 * Prompt handler function type
 */
export type PromptHandler = (
  args: Record<string, string>,
  context: PromptContext
) => Promise<GetPromptResult>;

/**
 * Prompt context
 */
export interface PromptContext {
  readonly requestId: JsonRpcId;
  readonly logger: Logger;
}

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Logger interface for MCP server
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  notice(message: string, data?: unknown): void;
  warning(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  critical(message: string, data?: unknown): void;
  alert(message: string, data?: unknown): void;
  emergency(message: string, data?: unknown): void;
}

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
});

export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
});

export const InitializeParamsSchema = z.object({
  protocolVersion: z.string(),
  capabilities: z.object({
    roots: z.object({ listChanged: z.boolean().optional() }).optional(),
    sampling: z.object({}).optional(),
    experimental: z.record(z.unknown()).optional(),
  }),
  clientInfo: z.object({
    name: z.string(),
    version: z.string(),
  }),
});

export const CallToolParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).optional(),
});

export const ReadResourceParamsSchema = z.object({
  uri: z.string(),
});

export const GetPromptParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string()).optional(),
});

export const ListParamsSchema = z.object({
  cursor: z.string().optional(),
});
