/**
 * LLM Client Interface
 *
 * Provider-agnostic interface for LLM interactions supporting chat, streaming, and token counting.
 * Designed to work with OpenAI, Anthropic, and other LLM providers.
 */

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Tool call structure
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool to invoke */
  name: string;
  /** JSON string of tool arguments */
  arguments: string;
}

/**
 * Message structure for chat interactions
 */
export interface Message {
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
  /** Optional tool call ID (for tool response messages) */
  toolCallId?: string;
  /** Optional tool calls (for assistant messages with tool invocations) */
  toolCalls?: ToolCall[];
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
  /** Name of the tool */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool input parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Number of tokens in the prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
}

/**
 * @deprecated Use TokenUsage instead
 * Alias for backward compatibility
 */
export type Usage = TokenUsage;

/**
 * Finish reason for chat completion
 */
export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error';

/**
 * Chat completion response
 */
export interface ChatResponse {
  /** Unique identifier for this response */
  id: string;
  /** Generated content */
  content: string;
  /** Tool calls requested by the model */
  toolCalls?: ToolCall[];
  /** Token usage statistics */
  usage: TokenUsage;
  /** Reason the generation finished */
  finishReason: FinishReason;
  /** Raw response from the provider (optional) */
  raw?: unknown;
}

/**
 * Streaming chat chunk
 */
export interface ChatChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** Incremental content delta */
  delta: string;
  /** Tool call deltas (if any) */
  toolCallDeltas?: Partial<ToolCall>[];
  /** Finish reason (only present in final chunk) */
  finishReason?: FinishReason;
  /** Cumulative usage (only present in final chunk) */
  usage?: TokenUsage;
}

/**
 * Parameters for chat completion
 */
export interface ChatParams {
  /** Model identifier (e.g., "gpt-4", "claude-3-opus-20240229") */
  model: string;
  /** Array of messages in the conversation */
  messages: Message[];
  /** Optional tools/functions the model can call */
  tools?: ToolDefinition[];
  /** Sampling temperature (0.0 - 2.0, lower = more deterministic) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p nucleus sampling (0.0 - 1.0) */
  topP?: number;
  /** Stop sequences to end generation */
  stop?: string[];
  /** Frequency penalty (-2.0 - 2.0) */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 - 2.0) */
  presencePenalty?: number;
  /** Additional provider-specific parameters */
  providerParams?: Record<string, unknown>;
}

/**
 * Core LLM Client Interface
 *
 * Implement this interface to integrate any LLM provider.
 */
export interface LLMClient {
  /**
   * Get the provider name
   */
  readonly provider: string;

  /**
   * Generate a chat completion
   *
   * @param params - Chat parameters
   * @returns Chat completion response
   */
  chat(params: ChatParams): Promise<ChatResponse>;

  /**
   * Generate a streaming chat completion
   *
   * @param params - Chat parameters
   * @returns Async iterator of chat chunks
   */
  chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk>;

  /**
   * Count tokens in a message or text
   *
   * @param input - Text to count tokens for, or array of messages
   * @param model - Model to use for tokenization
   * @returns Number of tokens
   */
  countTokens(input: string | Message[], model: string): Promise<number>;

  /**
   * List available models
   *
   * @returns Array of model identifiers
   */
  listModels?(): Promise<string[]>;

  /**
   * Validate API credentials
   *
   * @returns True if credentials are valid
   */
  validateCredentials?(): Promise<boolean>;
}

/**
 * LLM Client configuration
 */
export interface LLMClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API requests (optional) */
  baseUrl?: string;
  /** Organization ID (optional) */
  organization?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
}

/**
 * Error types for LLM operations
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, provider);
    this.name = 'LLMAuthenticationError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    provider?: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, provider);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMQuotaExceededError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 'QUOTA_EXCEEDED_ERROR', 429, provider);
    this.name = 'LLMQuotaExceededError';
  }
}

export class LLMInvalidRequestError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 'INVALID_REQUEST_ERROR', 400, provider);
    this.name = 'LLMInvalidRequestError';
  }
}

export class LLMNetworkError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 'NETWORK_ERROR', undefined, provider);
    this.name = 'LLMNetworkError';
  }
}
