/**
 * AI Constants
 * Centralized constants for AI functionality
 */

import type { AIProvider, AIErrorCode, AIModelConfig } from '../../types/ai';

/**
 * Default AI configuration
 */
export const AI_DEFAULTS = {
  /** Default provider */
  PROVIDER: 'openai' as AIProvider,
  /** Default model */
  MODEL: 'gpt-4o-mini',
  /** Default temperature */
  TEMPERATURE: 0.7,
  /** Default max tokens */
  MAX_TOKENS: 4096,
  /** Default top-p */
  TOP_P: 1.0,
  /** Default timeout (30 seconds) */
  TIMEOUT: 30000,
  /** Default max retries */
  MAX_RETRIES: 3,
  /** Default initial retry delay (1 second) */
  INITIAL_RETRY_DELAY: 1000,
  /** Default retry backoff multiplier */
  RETRY_BACKOFF_MULTIPLIER: 2,
  /** Default max retry delay (30 seconds) */
  MAX_RETRY_DELAY: 30000,
} as const;

/**
 * Model-specific defaults
 */
export const MODEL_DEFAULTS: Record<string, Partial<AIModelConfig>> = {
  // OpenAI
  'gpt-4o': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
  'gpt-4o-mini': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
  'gpt-4-turbo': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
  'gpt-3.5-turbo': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },

  // Anthropic
  'claude-opus-4-5-20251101': {
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
  },
  'claude-sonnet-4-5-20250929': {
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
  },
  'claude-sonnet-4-20250514': {
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
  },
  'claude-haiku-4-20250116': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },

  // DeepSeek
  'deepseek-chat': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
  'deepseek-reasoner': {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
} as const;

/**
 * Provider display names
 */
export const PROVIDER_NAMES: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
} as const;

/**
 * Provider color schemes (Tailwind CSS classes)
 */
export const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: 'bg-green-500',
  anthropic: 'bg-orange-500',
  deepseek: 'bg-blue-500',
} as const;

/**
 * Provider logos/icons
 */
export const PROVIDER_ICONS: Record<AIProvider, string> = {
  openai: '🤖',
  anthropic: '🧠',
  deepseek: '🔍',
} as const;

/**
 * Retryable error codes
 */
export const RETRYABLE_ERROR_CODES: readonly AIErrorCode[] = [
  'rate_limit_exceeded',
  'model_overloaded',
  'server_error',
  'timeout',
  'network_error',
] as const;

/**
 * Non-retryable error codes
 */
export const NON_RETRYABLE_ERROR_CODES: readonly AIErrorCode[] = [
  'invalid_request',
  'authentication_error',
  'permission_denied',
  'not_found',
  'quota_exceeded',
  'token_limit_exceeded',
  'context_length_exceeded',
  'invalid_model',
  'invalid_response',
  'content_filter',
] as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES: Record<AIErrorCode, string> = {
  invalid_request: 'The request was invalid or malformed',
  authentication_error: 'Authentication failed. Please check your API key',
  permission_denied: 'You do not have permission to perform this action',
  not_found: 'The requested resource was not found',
  rate_limit_exceeded: 'Rate limit exceeded. Please try again later',
  quota_exceeded: 'Your quota has been exceeded',
  token_limit_exceeded: 'Token limit exceeded for this request',
  context_length_exceeded:
    'Context length exceeded. Please reduce message history',
  invalid_model: 'The specified model is invalid or not available',
  model_overloaded: 'The model is currently overloaded. Please try again',
  server_error: 'An internal server error occurred',
  timeout: 'Request timed out. Please try again',
  network_error: 'A network error occurred. Please check your connection',
  invalid_response: 'Received an invalid response from the provider',
  content_filter: 'Content was filtered by the provider',
  unknown_error: 'An unknown error occurred',
} as const;

/**
 * Token limits per model (context window)
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,

  // Anthropic
  'claude-opus-4-5-20251101': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'claude-sonnet-4-20250514': 200000,
  'claude-haiku-4-20250116': 200000,

  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,
} as const;

/**
 * Output token limits per model
 */
export const MODEL_OUTPUT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4-turbo': 4096,
  'gpt-3.5-turbo': 4096,

  // Anthropic
  'claude-opus-4-5-20251101': 16384,
  'claude-sonnet-4-5-20250929': 16384,
  'claude-sonnet-4-20250514': 8192,
  'claude-haiku-4-20250116': 8192,

  // DeepSeek
  'deepseek-chat': 8192,
  'deepseek-reasoner': 8192,
} as const;

/**
 * Recommended models per use case
 */
export const RECOMMENDED_MODELS = {
  /** Fast, cost-effective for general chat */
  GENERAL_CHAT: ['gpt-4o-mini', 'claude-haiku-4-20250116', 'deepseek-chat'],
  /** High-quality, multimodal capabilities */
  ADVANCED_TASKS: [
    'gpt-4o',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-5-20251101',
  ],
  /** Reasoning and complex problem solving */
  REASONING: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'deepseek-reasoner',
  ],
  /** Vision and image understanding */
  VISION: ['gpt-4o', 'claude-opus-4-5-20251101', 'claude-sonnet-4-20250514'],
  /** Code generation and analysis */
  CODE: ['gpt-4o', 'claude-sonnet-4-5-20250929', 'deepseek-chat'],
  /** Budget-conscious options */
  BUDGET: ['gpt-4o-mini', 'deepseek-chat', 'gpt-3.5-turbo'],
} as const;

/**
 * System prompts for different use cases
 */
export const SYSTEM_PROMPTS = {
  GENERAL:
    'You are a helpful AI assistant. Provide clear, accurate, and concise responses.',

  WORKSPACE: `You are an AI assistant helping users create and manage workspaces.
Your role is to extract workspace information from natural language and guide users through the setup process.
Be concise, helpful, and ask clarifying questions when needed.`,

  ORCHESTRATOR: `You are an AI assistant helping users configure orchestrators.
Your role is to understand orchestration requirements and help design effective automation flows.
Focus on extracting key configuration parameters and suggesting best practices.`,

  SESSION_MANAGER: `You are an AI assistant helping users manage sessions.
Your role is to understand session requirements and help configure session management settings.
Be clear about data retention, timeout policies, and security considerations.`,

  CODE_ASSISTANT: `You are an expert programming assistant. Help users write clean, efficient, and well-documented code.
Provide explanations for your suggestions and follow best practices.`,

  DATA_ANALYST: `You are a data analysis assistant. Help users understand and analyze their data.
Provide insights, visualizations suggestions, and statistical interpretations.`,

  CREATIVE_WRITING: `You are a creative writing assistant. Help users with storytelling, content creation, and editing.
Be imaginative while maintaining clarity and coherence.`,
} as const;

/**
 * Message templates
 */
export const MESSAGE_TEMPLATES = {
  GREETING: 'Hello! How can I help you today?',
  ERROR_GENERIC: 'I encountered an error. Please try again.',
  ERROR_RATE_LIMIT:
    "I'm currently rate limited. Please wait a moment and try again.",
  ERROR_CONTEXT_LENGTH:
    'The conversation is too long. Please start a new conversation.',
  THINKING: 'Let me think about that...',
  PROCESSING: 'Processing your request...',
  COMPLETE: 'Done! Is there anything else I can help with?',
} as const;

/**
 * Feature flags
 */
export const AI_FEATURES = {
  /** Enable streaming responses */
  ENABLE_STREAMING: true,
  /** Enable tool calling */
  ENABLE_TOOL_CALLING: true,
  /** Enable vision capabilities */
  ENABLE_VISION: true,
  /** Enable reasoning mode */
  ENABLE_REASONING: true,
  /** Enable automatic retries */
  ENABLE_AUTO_RETRY: true,
  /** Enable rate limiting */
  ENABLE_RATE_LIMITING: true,
  /** Enable cost tracking */
  ENABLE_COST_TRACKING: true,
  /** Enable usage analytics */
  ENABLE_ANALYTICS: true,
  /** Enable caching */
  ENABLE_CACHING: false,
} as const;

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Warning threshold for response time (ms) */
  SLOW_RESPONSE_WARNING: 5000,
  /** Critical threshold for response time (ms) */
  SLOW_RESPONSE_CRITICAL: 10000,
  /** Context utilization warning threshold (%) */
  CONTEXT_UTILIZATION_WARNING: 80,
  /** Context utilization critical threshold (%) */
  CONTEXT_UTILIZATION_CRITICAL: 95,
  /** Token cost warning threshold (USD) */
  COST_WARNING_THRESHOLD: 1.0,
  /** Token cost critical threshold (USD) */
  COST_CRITICAL_THRESHOLD: 10.0,
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Cache TTL for model metadata (1 hour) */
  MODEL_METADATA_TTL: 3600,
  /** Cache TTL for provider status (5 minutes) */
  PROVIDER_STATUS_TTL: 300,
  /** Cache TTL for rate limit info (1 minute) */
  RATE_LIMIT_TTL: 60,
  /** Cache TTL for completions (disabled by default) */
  COMPLETION_TTL: 0,
} as const;

/**
 * Monitoring configuration
 */
export const MONITORING_CONFIG = {
  /** Enable request logging */
  LOG_REQUESTS: true,
  /** Enable error logging */
  LOG_ERRORS: true,
  /** Enable performance logging */
  LOG_PERFORMANCE: true,
  /** Sample rate for detailed logging (0-1) */
  DETAILED_LOG_SAMPLE_RATE: 0.1,
  /** Metrics retention period (days) */
  METRICS_RETENTION_DAYS: 30,
} as const;

/**
 * Export all constants as a single object
 */
export const AI_CONSTANTS = {
  DEFAULTS: AI_DEFAULTS,
  MODEL_DEFAULTS,
  PROVIDER_NAMES,
  PROVIDER_COLORS,
  PROVIDER_ICONS,
  RETRYABLE_ERROR_CODES,
  NON_RETRYABLE_ERROR_CODES,
  ERROR_MESSAGES,
  MODEL_CONTEXT_LIMITS,
  MODEL_OUTPUT_LIMITS,
  RECOMMENDED_MODELS,
  SYSTEM_PROMPTS,
  MESSAGE_TEMPLATES,
  FEATURES: AI_FEATURES,
  PERFORMANCE_THRESHOLDS,
  CACHE_CONFIG,
  MONITORING_CONFIG,
} as const;
