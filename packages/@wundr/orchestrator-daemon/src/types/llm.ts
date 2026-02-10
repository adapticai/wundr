/**
 * LLM Type Definitions
 *
 * Local type stubs for LLM client interfaces. These mirror the types exported
 * by @wundr.io/ai-integration's llm module but are defined locally to avoid
 * build-order dependency issues when the ai-integration package's dist/ has
 * not been compiled yet.
 *
 * Keep these in sync with:
 *   packages/@wundr/ai-integration/src/llm/client.ts
 *   packages/@wundr/ai-integration/src/llm/config.ts
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface Message {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Token usage & finish reason
// ---------------------------------------------------------------------------

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error';

// ---------------------------------------------------------------------------
// Chat completion types
// ---------------------------------------------------------------------------

export interface ChatResponse {
  id: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  finishReason: FinishReason;
  raw?: unknown;
}

export interface ChatChunk {
  id: string;
  delta: string;
  toolCallDeltas?: Partial<ToolCall>[];
  finishReason?: FinishReason;
  usage?: TokenUsage;
}

export interface ChatParams {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  providerParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

export interface LLMClient {
  readonly provider: string;
  chat(params: ChatParams): Promise<ChatResponse>;
  chatStream(params: ChatParams): AsyncIterableIterator<ChatChunk>;
  countTokens(input: string | Message[], model: string): Promise<number>;
  listModels?(): Promise<string[]>;
  validateCredentials?(): Promise<boolean>;
}

export interface LLMClientConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Provider types (from config.ts)
// ---------------------------------------------------------------------------

export type LLMProvider = 'openai' | 'anthropic' | 'azure' | 'custom';
