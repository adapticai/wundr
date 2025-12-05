/**
 * AI Library - Main Export
 *
 * Centralized exports for AI functionality including types, validation,
 * configuration, prompts, greetings, providers, and token tracking.
 *
 * @module lib/ai
 */

// Core types
export type {
  AIMessage,
  ToolCall,
  EntityType,
  ExtractedEntityData,
  ChatConfig,
  StreamingState,
} from './types';

export { getEntityDisplayName } from './types';

// Configuration
export {
  AI_CONFIG,
  getSystemPrompt,
  getDefaultChatConfig,
  type SystemPromptKey,
} from './config';

// Validation
export {
  ENTITY_SCHEMAS,
  validateEntityData,
  getRequiredFields,
  getOptionalFields,
} from './validation';

// Prompts
export { ENTITY_PROMPTS, getEntityPrompt } from './prompts';

// Greetings
export { ENTITY_GREETINGS, getGreeting } from './greetings';

// Providers
export {
  AVAILABLE_MODELS,
  getDefaultModel,
  validateProviderKey,
  getLanguageModel,
  getDefaultProvider,
  getModelMetadata,
  getProviderModels,
  estimateCost,
  supportsFeature,
  type AIProvider,
  type ModelName,
  type ProviderConfig,
  type ModelMetadata,
} from './providers';

// Token tracking
export {
  logTokenUsage,
  calculateCost,
  checkWorkspaceQuota,
  getWorkspaceUsageStats,
  estimateTokens,
  wouldExceedTokenLimit,
  type TokenUsage,
  type UsageLogEntry,
} from './token-tracking';

// Model Management
export {
  AI_MODELS,
  getModelsByProvider,
  getRecommendedModels,
  getModelById,
  calculateModelCost,
  formatCost,
  getProviderName,
  getProviderColor,
  getDefaultModelConfig,
  DEFAULT_MODEL_CONFIGS,
  type AIModel,
  type AIProvider as AIProviderModel,
  type ModelConfig,
  type ModelCapabilities,
  type ModelPricing,
} from './models';

// Message formatting utilities
export * from './format-message';

// Context building and injection
export {
  buildContext,
  formatContextForPrompt,
  getAvailableContextSources,
  estimateTokens as estimateContextTokens,
  type ContextSource,
  type ContextItem,
  type ContextBuildOptions,
  type BuiltContext,
} from './context-builder';

// RAG retrieval
export {
  retrieveRelevantContext,
  suggestContextSources,
  expandContext,
  type RAGQuery,
  type RAGResult,
} from './rag-retrieval';

// Context injection utilities
export {
  injectContext,
  autoSuggestContext,
  validateSources,
  createContextCacheKey,
  mergeSources,
  splitSourcesByType,
  calculateTokenDistribution,
  injectContextForStream,
  type InjectContextOptions,
  type InjectedPrompt,
  type InjectionStrategy,
} from './context-injection';

// =============================================================================
// Constants & Defaults
// =============================================================================

export {
  AI_DEFAULTS,
  MODEL_DEFAULTS,
  ERROR_MESSAGES,
  RETRYABLE_ERROR_CODES,
  NON_RETRYABLE_ERROR_CODES,
  MODEL_CONTEXT_LIMITS,
  MODEL_OUTPUT_LIMITS,
  RECOMMENDED_MODELS,
  SYSTEM_PROMPTS,
  MESSAGE_TEMPLATES,
  AI_FEATURES,
  PERFORMANCE_THRESHOLDS,
  CACHE_CONFIG,
  MONITORING_CONFIG,
  AI_CONSTANTS,
  PROVIDER_NAMES,
  PROVIDER_COLORS,
  PROVIDER_ICONS,
} from './constants';

// =============================================================================
// Prompt Templates
// =============================================================================

export {
  PROMPT_CATEGORIES,
  SYSTEM_TEMPLATES,
  interpolatePrompt,
  extractVariables,
  validateVariables,
  getDefaultValues,
  searchTemplates,
  filterByCategory,
  sortTemplates,
  type PromptTemplate,
  type PromptVariable,
  type PromptCategory,
} from './prompt-templates';

// =============================================================================
// Rate Limiting
// =============================================================================

export {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitEntry,
} from './rate-limiter';

// =============================================================================
// Speech Recognition & Synthesis
// =============================================================================

export {
  checkMicrophonePermission,
  isSpeechRecognitionSupported,
  getSpeechRecognition,
  requestMicrophonePermission,
  createAudioContext,
  getAudioLevel,
  formatDuration,
  saveVoiceSettings,
  loadVoiceSettings,
  speak,
  stopSpeaking,
  SUPPORTED_LANGUAGES,
  DEFAULT_VOICE_SETTINGS,
  type SpeechRecognitionResult,
  type SpeechRecognitionOptions,
  type VoiceSettings,
} from './speech';

// =============================================================================
// AI Tools Registry
// =============================================================================

export {
  toolRegistry,
  registerTool,
  type ToolDefinition,
  type ToolParameter,
  type ToolContext,
  type ToolResult,
} from './tools';

// Re-export specific tool sets
export * from './tools/workflow-tools';
export * from './tools/search-tools';
export * from './tools/data-tools';

// =============================================================================
// Hooks (AI-specific utilities for hooks)
// =============================================================================

export { useToolExecution } from './hooks/use-tool-execution';
export type {
  UseToolExecutionOptions,
  UseToolExecutionReturn,
} from './hooks/use-tool-execution';
