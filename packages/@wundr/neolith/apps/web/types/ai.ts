/**
 * Core AI Types for Neolith
 * Comprehensive type definitions for AI functionality across the platform
 */

/**
 * AI provider enumeration
 */
export type AIProvider = 'openai' | 'anthropic' | 'deepseek';

/**
 * AI message role types
 */
export type AIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * AI message status types
 */
export type AIMessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'timeout';

/**
 * AI conversation status
 */
export type AIConversationStatus = 'active' | 'archived' | 'deleted' | 'error';

/**
 * AI model capability flags
 */
export interface AIModelCapabilities {
  /** Supports vision/image understanding */
  readonly vision: boolean;
  /** Supports function/tool calling */
  readonly functionCalling: boolean;
  /** Supports streaming responses */
  readonly streaming: boolean;
  /** Supports chain-of-thought reasoning */
  readonly reasoning: boolean;
  /** Supports structured JSON output */
  readonly json: boolean;
  /** Supports web search */
  readonly webSearch: boolean;
  /** Supports code execution */
  readonly codeExecution: boolean;
  /** Supports multimodal input */
  readonly multimodal: boolean;
}

/**
 * AI model pricing information
 */
export interface AIModelPricing {
  /** Input cost per 1M tokens in USD */
  readonly input: number;
  /** Output cost per 1M tokens in USD */
  readonly output: number;
  /** Cached input cost per 1M tokens (if applicable) */
  readonly cachedInput?: number;
  /** Currency code */
  readonly currency: 'USD';
}

/**
 * AI model limits
 */
export interface AIModelLimits {
  /** Maximum context length in tokens */
  readonly contextLength: number;
  /** Maximum output tokens */
  readonly maxOutputTokens: number;
  /** Rate limit - requests per minute */
  readonly requestsPerMinute?: number;
  /** Rate limit - tokens per minute */
  readonly tokensPerMinute?: number;
  /** Rate limit - tokens per day */
  readonly tokensPerDay?: number;
}

/**
 * Comprehensive AI model definition
 */
export interface AIModel {
  /** Unique model identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Provider of the model */
  readonly provider: AIProvider;
  /** Model version */
  readonly version?: string;
  /** Release date (ISO 8601) */
  readonly releaseDate?: string;
  /** Model description */
  readonly description: string;
  /** Model capabilities */
  readonly capabilities: AIModelCapabilities;
  /** Pricing information */
  readonly pricing: AIModelPricing;
  /** Model limits */
  readonly limits: AIModelLimits;
  /** Whether model is recommended for general use */
  readonly isRecommended?: boolean;
  /** Whether model is deprecated */
  readonly isDeprecated?: boolean;
  /** Alternative model if deprecated */
  readonly deprecatedInFavorOf?: string;
  /** Model tags for categorization */
  readonly tags?: readonly string[];
}

/**
 * AI model configuration
 */
export interface AIModelConfig {
  /** Model identifier */
  readonly model: string;
  /** Sampling temperature (0-2) */
  readonly temperature: number;
  /** Maximum tokens to generate */
  readonly maxTokens: number;
  /** Top-p sampling (0-1) */
  readonly topP: number;
  /** System prompt/instructions */
  readonly systemPrompt?: string;
  /** Frequency penalty (-2 to 2) */
  readonly frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) */
  readonly presencePenalty?: number;
  /** Stop sequences */
  readonly stopSequences?: readonly string[];
  /** Top-k sampling */
  readonly topK?: number;
  /** Enable streaming */
  readonly stream?: boolean;
}

/**
 * Token usage tracking
 */
export interface AITokenUsage {
  /** Input/prompt tokens */
  readonly inputTokens: number;
  /** Output/completion tokens */
  readonly outputTokens: number;
  /** Total tokens used */
  readonly totalTokens: number;
  /** Cached tokens (if applicable) */
  readonly cachedTokens?: number;
  /** Reasoning tokens (for reasoning models) */
  readonly reasoningTokens?: number;
  /** Estimated cost in USD */
  readonly estimatedCost?: number;
}

/**
 * AI request metadata
 */
export interface AIRequestMetadata {
  /** Request ID */
  readonly requestId: string;
  /** Model used */
  readonly model: string;
  /** Provider used */
  readonly provider: AIProvider;
  /** Request timestamp (ISO 8601) */
  readonly timestamp: string;
  /** Request duration in milliseconds */
  readonly duration?: number;
  /** Token usage */
  readonly usage?: AITokenUsage;
  /** Error information if failed */
  readonly error?: AIErrorInfo;
  /** User ID who made the request */
  readonly userId?: string;
  /** Workspace ID context */
  readonly workspaceId?: string;
  /** Custom metadata */
  readonly customMetadata?: Record<string, unknown>;
}

/**
 * AI error information
 */
export interface AIErrorInfo {
  /** Error code */
  readonly code: AIErrorCode;
  /** Human-readable error message */
  readonly message: string;
  /** Detailed error description */
  readonly details?: string;
  /** Whether error is retryable */
  readonly retryable: boolean;
  /** Suggested retry delay in milliseconds */
  readonly retryAfter?: number;
  /** Provider-specific error code */
  readonly providerErrorCode?: string;
  /** HTTP status code if applicable */
  readonly statusCode?: number;
}

/**
 * AI error codes
 */
export type AIErrorCode =
  | 'invalid_request'
  | 'authentication_error'
  | 'permission_denied'
  | 'not_found'
  | 'rate_limit_exceeded'
  | 'quota_exceeded'
  | 'token_limit_exceeded'
  | 'context_length_exceeded'
  | 'invalid_model'
  | 'model_overloaded'
  | 'server_error'
  | 'timeout'
  | 'network_error'
  | 'invalid_response'
  | 'content_filter'
  | 'unknown_error';

/**
 * AI streaming event types
 */
export type AIStreamEventType =
  | 'start'
  | 'chunk'
  | 'tool_call_start'
  | 'tool_call_chunk'
  | 'tool_call_end'
  | 'reasoning_start'
  | 'reasoning_chunk'
  | 'reasoning_end'
  | 'complete'
  | 'error'
  | 'abort';

/**
 * AI streaming event
 */
export interface AIStreamEvent {
  /** Event type */
  readonly type: AIStreamEventType;
  /** Event data */
  readonly data: unknown;
  /** Sequence number */
  readonly sequence?: number;
  /** Timestamp (ISO 8601) */
  readonly timestamp: string;
}

/**
 * AI tool/function call
 */
export interface AIToolCall {
  /** Unique tool call ID */
  readonly id: string;
  /** Tool/function name */
  readonly name: string;
  /** Tool arguments (JSON) */
  readonly arguments: Record<string, unknown>;
  /** Tool call result */
  readonly result?: unknown;
  /** Tool call status */
  readonly status: AIToolCallStatus;
  /** Error if tool call failed */
  readonly error?: string;
  /** Execution time in milliseconds */
  readonly executionTime?: number;
}

/**
 * AI tool call status
 */
export type AIToolCallStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled';

/**
 * AI tool definition
 */
export interface AITool {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** JSON Schema for parameters */
  readonly parameters: Record<string, unknown>;
  /** Whether tool requires confirmation */
  readonly requiresConfirmation?: boolean;
  /** Tool category */
  readonly category?: string;
}

/**
 * AI reasoning step
 */
export interface AIReasoningStep {
  /** Step ID */
  readonly id: string;
  /** Step type */
  readonly type: 'thought' | 'action' | 'observation';
  /** Step content */
  readonly content: string;
  /** Step timestamp */
  readonly timestamp: string;
  /** Tokens used in this step */
  readonly tokens?: number;
}

/**
 * AI completion options
 */
export interface AICompletionOptions {
  /** Model configuration */
  readonly config: AIModelConfig;
  /** Available tools */
  readonly tools?: readonly AITool[];
  /** Enable reasoning mode */
  readonly enableReasoning?: boolean;
  /** User context */
  readonly userContext?: Record<string, unknown>;
  /** Timeout in milliseconds */
  readonly timeout?: number;
  /** Retry options */
  readonly retry?: AIRetryOptions;
  /** Custom headers */
  readonly headers?: Record<string, string>;
}

/**
 * AI retry options
 */
export interface AIRetryOptions {
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Initial retry delay in milliseconds */
  readonly initialDelay: number;
  /** Backoff multiplier */
  readonly backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  readonly maxDelay: number;
  /** Error codes to retry on */
  readonly retryableErrors?: readonly AIErrorCode[];
}

/**
 * AI content type
 */
export type AIContentType = 'text' | 'image' | 'file' | 'code' | 'tool_result';

/**
 * AI content block
 */
export interface AIContentBlock {
  /** Content type */
  readonly type: AIContentType;
  /** Content data */
  readonly content: string | Record<string, unknown>;
  /** MIME type for files/images */
  readonly mimeType?: string;
  /** Content metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * AI message attachment
 */
export interface AIMessageAttachment {
  /** Attachment ID */
  readonly id: string;
  /** File name */
  readonly name: string;
  /** File URL */
  readonly url: string;
  /** File size in bytes */
  readonly size: number;
  /** MIME type */
  readonly mimeType: string;
  /** Attachment type */
  readonly type: 'image' | 'document' | 'video' | 'audio' | 'other';
  /** Whether attachment was analyzed */
  readonly analyzed?: boolean;
  /** Analysis results */
  readonly analysis?: Record<string, unknown>;
}

/**
 * AI context window
 */
export interface AIContextWindow {
  /** Total tokens available */
  readonly totalTokens: number;
  /** Tokens used by messages */
  readonly messageTokens: number;
  /** Tokens reserved for response */
  readonly reservedTokens: number;
  /** Remaining available tokens */
  readonly availableTokens: number;
  /** Percentage utilization */
  readonly utilizationPercent: number;
}

/**
 * AI rate limit info
 */
export interface AIRateLimitInfo {
  /** Requests remaining */
  readonly requestsRemaining: number;
  /** Tokens remaining */
  readonly tokensRemaining: number;
  /** Reset timestamp (ISO 8601) */
  readonly resetsAt: string;
  /** Retry after in milliseconds */
  readonly retryAfter?: number;
}

/**
 * AI performance metrics
 */
export interface AIPerformanceMetrics {
  /** Time to first token in milliseconds */
  readonly timeToFirstToken?: number;
  /** Tokens per second */
  readonly tokensPerSecond?: number;
  /** Total latency in milliseconds */
  readonly totalLatency: number;
  /** Network latency in milliseconds */
  readonly networkLatency?: number;
  /** Processing time in milliseconds */
  readonly processingTime?: number;
}

/**
 * Type guard to check if a value is an AIProvider
 */
export function isAIProvider(value: unknown): value is AIProvider {
  return (
    typeof value === 'string' &&
    ['openai', 'anthropic', 'deepseek'].includes(value)
  );
}

/**
 * Type guard to check if a value is an AIMessageRole
 */
export function isAIMessageRole(value: unknown): value is AIMessageRole {
  return (
    typeof value === 'string' &&
    ['user', 'assistant', 'system', 'tool'].includes(value)
  );
}

/**
 * Type guard to check if a value is an AIErrorCode
 */
export function isAIErrorCode(value: unknown): value is AIErrorCode {
  const validCodes: AIErrorCode[] = [
    'invalid_request',
    'authentication_error',
    'permission_denied',
    'not_found',
    'rate_limit_exceeded',
    'quota_exceeded',
    'token_limit_exceeded',
    'context_length_exceeded',
    'invalid_model',
    'model_overloaded',
    'server_error',
    'timeout',
    'network_error',
    'invalid_response',
    'content_filter',
    'unknown_error',
  ];
  return typeof value === 'string' && validCodes.includes(value as AIErrorCode);
}

/**
 * Type guard to check if a value is an AIStreamEventType
 */
export function isAIStreamEventType(
  value: unknown
): value is AIStreamEventType {
  const validTypes: AIStreamEventType[] = [
    'start',
    'chunk',
    'tool_call_start',
    'tool_call_chunk',
    'tool_call_end',
    'reasoning_start',
    'reasoning_chunk',
    'reasoning_end',
    'complete',
    'error',
    'abort',
  ];
  return (
    typeof value === 'string' && validTypes.includes(value as AIStreamEventType)
  );
}
