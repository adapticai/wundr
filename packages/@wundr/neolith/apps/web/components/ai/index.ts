/**
 * AI Components
 * Export barrel file for all AI-related components
 */

// Chat Interface (Complete Solution)
export { ChatInterface } from './chat-interface';
export type { AIMessageRole, ChatInterfaceProps } from './chat-interface';

// Message Bubble
export { MessageBubble } from './message-bubble';
export type { MessageBubbleProps } from './message-bubble';

// Chat Input
export { ChatInput } from './chat-input';
export type { ChatInputProps } from './chat-input';

// Typing Indicator
export { TypingIndicator as AITypingIndicator } from './typing-indicator';
export type { TypingIndicatorProps as AITypingIndicatorProps } from './typing-indicator';

// Chat History
export { ChatHistory } from './chat-history';
export type { ChatHistoryProps } from './chat-history';

// Conversation
export { useConversation } from './conversation';

// Message
export { Message, MessageContent, MessageAvatar } from './message';

// Input
export {
  PromptInput,
  PromptInputForm,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
} from './prompt-input';

// Response
export {
  Response,
  ResponseSection,
  ResponseCode,
  ResponseList,
} from './response';

// Suggestions
export {
  Suggestions,
  SuggestionContainer,
  SuggestionItem,
  WORKSPACE_SUGGESTIONS,
  ORCHESTRATOR_SUGGESTIONS,
  SESSION_MANAGER_SUGGESTIONS,
  getEntitySuggestions,
} from './suggestion';

// Loading states
export {
  Loader,
  TypingIndicator,
  StreamingIndicator,
  FullPageLoader,
  AIThinkingLoader,
} from './loader';

// Actions
export {
  Actions,
  ActionsContainer,
  ActionButton,
  ActionCopy,
  ActionRegenerate,
  ActionFeedback,
  ActionMore,
  ActionMenuItem,
} from './actions';

// Reasoning
export {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  ReasoningBadge,
} from './reasoning';

// Tool display
export {
  Tool,
  ToolHeader,
  ToolStatusBadge,
  ToolInput,
  ToolOutput,
  ToolError,
  ToolList,
  ToolInline,
} from './tool';

// Message formatting
export { MarkdownRenderer } from './markdown-renderer';
export { CodeBlock } from './code-block';
export { MessageAttachments } from './message-attachments';
export { MessageActions } from './message-actions';

// Re-export types and utilities
export type {
  AIMessage,
  ToolCall,
  EntityType,
  ExtractedEntityData,
  ChatConfig,
  StreamingState,
} from '../../lib/ai/types';

export { getEntityDisplayName } from '../../lib/ai/types';

// Re-export config utilities
export {
  AI_CONFIG,
  getSystemPrompt,
  getDefaultChatConfig,
  type SystemPromptKey,
} from '../../lib/ai/config';

// Model Selection & Configuration
export { ModelSelector, ModelSelectorCompact } from './model-selector';
export { ModelConfigPanel, ModelConfigCompact } from './model-config';
export { ProviderBadge } from './provider-badge';
export { ModelComparison, ProviderComparison } from './model-comparison';

// Re-export model utilities
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
  type AIModel,
  type AIProvider,
  type ModelConfig,
  type ModelCapabilities,
  type ModelPricing,
} from '../../lib/ai/models';

// AI Suggestion Components (Phase 10 - Agent 5)
export {
  SmartSuggestions,
  GroupedSmartSuggestions,
  type SmartSuggestionsProps,
  type Suggestion,
} from './smart-suggestions';

export {
  AutocompleteInput,
  InlineAutocomplete,
  type AutocompleteInputProps,
  type AutocompleteOption,
} from './autocomplete-input';

export {
  QuickActions,
  CategorizedQuickActions,
  FloatingQuickActions,
  ContextualQuickActions,
  type QuickActionsProps,
  type QuickAction,
} from './quick-actions';

export {
  ContextMenuAI,
  SmartContextMenu,
  type ContextMenuAIProps,
  type AIContextAction,
} from './context-menu-ai';

export {
  InlineEdit,
  InlineEditWithDiff,
  type InlineEditProps,
} from './inline-edit';

// =============================================================================
// Context Management Components
// =============================================================================

// Context Manager
export { ContextManager } from './context-manager';

// Context Sources Selector
export { ContextSources } from './context-sources';

// Context Preview
export { ContextPreview } from './context-preview';

// =============================================================================
// Conversation Management
// =============================================================================

// Conversation Sidebar
export { ConversationSidebar } from './conversation-sidebar';

// New Chat Button
export { NewChatButton } from './new-chat-button';

// =============================================================================
// Feedback Components
// =============================================================================

// Feedback Buttons
export { FeedbackButtons } from './feedback-buttons';

// Feedback Dialog
export { FeedbackDialog } from './feedback-dialog';

// Feedback Summary
export { FeedbackSummary } from './feedback-summary';

// =============================================================================
// Voice Input Components
// =============================================================================

// Voice Input
export { VoiceInput } from './voice-input';

// Voice Settings
export { VoiceSettings } from './voice-settings';

// Voice Visualizer
export { VoiceVisualizer } from './voice-visualizer';

// =============================================================================
// Prompt Management
// =============================================================================

// Prompt Editor
export { PromptEditor } from './prompt-editor';

// Prompt Library
export { PromptLibrary } from './prompt-library';

// =============================================================================
// Tool Execution & Results
// =============================================================================

// Tool Result Display
export { ToolResult } from './tool-result';
export type { ToolResultProps } from './tool-result';

// =============================================================================
// AI Widget Components
// =============================================================================

// Widget Actions
export { WidgetActions } from './widget-actions';
export type { WidgetActionsProps } from './widget-actions';

// Widget Chat
export { WidgetChat } from './widget-chat';
export type { WidgetChatProps } from './widget-chat';

// Widget Trigger
export { WidgetTrigger } from './widget-trigger';
export type { WidgetTriggerProps } from './widget-trigger';

// Widget Store
export { useWidgetStore } from '@/lib/stores/widget-store';
export type { WidgetPosition } from '@/lib/stores/widget-store';

// =============================================================================
// Advanced AI Features
// =============================================================================

// AI Chat Interface (Integrated)
export { AIChatInterface } from './ai-chat-interface';

// AI Assistant Widget (Full Widget Solution)
export { AssistantWidget } from './assistant-widget';
export type { AssistantWidgetProps } from './assistant-widget';

// =============================================================================
// Rate Limiting & Quota Management (Phase 10 - Agent 19)
// =============================================================================

// Rate Limit Warning
export { RateLimitWarning, InlineRateLimitWarning } from './rate-limit-warning';
export type { RateLimitWarningProps } from './rate-limit-warning';

// Quota Display
export { QuotaDisplay } from './quota-display';
export type { QuotaDisplayProps, QuotaData } from './quota-display';

// NOTE: quota-manager, rate-limiter, and rate-limit-middleware are SERVER-ONLY
// Import directly from lib/ai/... in server components/routes
// Do NOT export them from this client-side barrel file
