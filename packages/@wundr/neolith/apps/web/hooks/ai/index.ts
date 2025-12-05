/**
 * AI Hooks - Central Export
 *
 * Consolidated exports for all AI-related React hooks.
 * These hooks are already re-exported in the main hooks/index.ts file,
 * but this provides a dedicated namespace for AI-specific imports.
 *
 * @module hooks/ai
 */

// =============================================================================
// AI Chat Hooks
// =============================================================================

export { useAIChat } from '../use-ai-chat';
export type {
  AIError,
  AIProvider,
  MessageStatus,
  LocalAIMessage,
  TokenUsage,
  ChatSession,
  UseAIChatOptions,
  UseAIChatReturn,
} from '../use-ai-chat';

// =============================================================================
// AI Stream Hooks
// =============================================================================

export { useAIStream } from '../use-ai-stream';
export type {
  StreamStatus,
  StreamEventType,
  StreamEvent,
  StreamChunk,
  StreamError,
  UseAIStreamOptions,
  UseAIStreamReturn,
} from '../use-ai-stream';

// =============================================================================
// AI Suggestions Hooks
// =============================================================================

export { useAISuggestions } from '../use-ai-suggestions';
export type {
  SuggestionSource,
  SuggestionPriority,
  Suggestion,
  SuggestionCategory,
  SuggestionContext,
  UseAISuggestionsOptions,
  UseAISuggestionsReturn,
} from '../use-ai-suggestions';

// =============================================================================
// AI History Hooks
// =============================================================================

export { useAIHistory } from '../use-ai-history';
export type {
  Conversation,
  HistoryFilters,
  PaginationOptions,
  ExportFormat,
  ExportedConversation,
  UseAIHistoryOptions,
  UseAIHistoryReturn,
} from '../use-ai-history';

// =============================================================================
// AI Context Hooks
// =============================================================================

export { useAIContext } from '../use-ai-context';
export type {
  ContextSource,
  ContextPriority,
  ContextItem,
  InjectionStrategy,
  ContextConfig,
  WorkspaceContext,
  UserContext,
  SessionContext,
  UseAIContextOptions,
  UseAIContextReturn,
} from '../use-ai-context';

// =============================================================================
// AI Wizard Chat Hooks
// =============================================================================

export { useAIWizardChat } from '../use-ai-wizard-chat';

// =============================================================================
// Voice Input Hooks
// =============================================================================

export { useVoiceInput } from '../use-voice-input';
export type {
  UseVoiceInputOptions,
  UseVoiceInputReturn,
} from '../use-voice-input';
