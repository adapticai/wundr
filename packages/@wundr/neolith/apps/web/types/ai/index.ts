/**
 * AI Type Definitions - Central Export
 *
 * Consolidated exports for all AI-related TypeScript types.
 * Provides a single import point for AI types throughout the application.
 *
 * @module types/ai
 */

// =============================================================================
// Core AI Types
// =============================================================================

export type {
  AIProvider,
  AIMessageRole,
  AIMessageStatus,
  AIConversationStatus,
  AIModelCapabilities,
  AIModelPricing,
  AIModelLimits,
  AIModel,
  AIModelConfig,
  AIToolCall,
  AIToolCallStatus,
  AITool,
  AIReasoningStep,
  AIErrorCode,
  AIErrorInfo,
  AITokenUsage,
  AIRequestMetadata,
  AIStreamEventType,
  AIStreamEvent,
  AICompletionOptions,
  AIRetryOptions,
  AIContentType,
  AIContentBlock,
  AIMessageAttachment,
  AIContextWindow,
  AIRateLimitInfo,
  AIPerformanceMetrics,
} from '../ai';

// =============================================================================
// AI Provider Types
// =============================================================================

export type {
  AIProviderCredentials,
  AIProviderConfig,
  AIProviderStatus,
  AIProviderMetrics,
  AIProviderCapability,
  AIProviderModelListing,
  AIProviderPricingTier,
  AIProviderComparison,
  AIProviderFallbackConfig,
  AIProviderUsageQuota,
  AIProviderEventType,
  AIProviderEvent,
  AIProviderWebhookConfig,
  AIProviderAPIVersion,
  AIProviderIntegration,
} from '../ai-provider';

// =============================================================================
// AI Message Types
// =============================================================================

export type {
  AIMessage,
  CreateAIMessageInput,
  UpdateAIMessageInput,
  AIMessageFilters,
  AIMessageWithUser,
  AIMessageThread,
  AIMessageSearchResult,
  AIMessageStatistics,
  AIMessageExportFormat,
  AIMessageExportOptions,
  AIMessageTemplate,
  AIMessageSuggestion,
  AIMessageAnnotation,
  AIMessageReaction,
  AIMessageReactionsSummary,
  AIMessageReference,
  AIMessageEdit,
} from '../ai-message';

// =============================================================================
// AI Conversation Types
// =============================================================================

export type {
  AIConversationMetadata,
  AIConversation,
  CreateAIConversationInput,
  UpdateAIConversationInput,
  AddAIMessageInput,
  AIConversationFilters,
  ExportFormat,
  ExportConversationOptions,
  ShareConversationInput,
  ConversationStats,
  PaginationMetadata,
  AIConversationResponse,
} from '../ai-conversation';
