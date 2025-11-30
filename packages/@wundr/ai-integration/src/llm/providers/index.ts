/**
 * LLM Provider Implementations
 *
 * Export all available LLM provider clients.
 */

export { AnthropicClient, ANTHROPIC_MODELS } from './anthropic';
export type { AnthropicClientConfig } from './anthropic';

export { OpenAIClient } from './openai';

// Re-export the base client types for convenience
export type {
  LLMClient,
  LLMClientConfig,
  ChatParams,
  ChatResponse,
  ChatChunk,
  Message,
  MessageRole,
  ToolDefinition,
  ToolCall,
  TokenUsage,
  FinishReason,
} from '../client';

export {
  LLMError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError,
  LLMInvalidRequestError,
  LLMNetworkError,
} from '../client';
