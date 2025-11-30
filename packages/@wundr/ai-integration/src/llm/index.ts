/**
 * LLM Integration Module
 *
 * Provider-agnostic LLM client interfaces and utilities.
 */

// Core client interfaces and types
export * from './client';

export type {
  MessageRole,
  ToolCall,
  Message,
  ToolDefinition,
  TokenUsage,
  FinishReason,
  ChatResponse,
  ChatChunk,
  ChatParams,
  LLMClient,
  LLMClientConfig,
} from './client';

export {
  LLMError,
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMQuotaExceededError,
  LLMInvalidRequestError,
  LLMNetworkError,
} from './client';

// Configuration and model definitions
export type {
  LLMProvider,
  ModelCapabilities,
  ModelPricing,
  ModelConfig,
  LLMProviderConfig,
} from './config';

export {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  MODEL_CONFIGS,
  ENV_VARS,
  getApiKeyFromEnv,
  getOrgIdFromEnv,
  getBaseUrlFromEnv,
  detectProvider,
  getModelConfig,
  validateModel,
  getDefaultProviderConfig,
} from './config';

// Factory functions
export type {
  CreateLLMClientConfig,
} from './factory';

export {
  createLLMClient,
  createSimpleLLMClient,
  isValidLLMConfig,
} from './factory';

// Provider implementations
export * from './providers';
