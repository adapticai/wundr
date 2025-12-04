/**
 * AI Components
 * Export barrel file for all AI-related components
 */

// Conversation
export { Conversation, useConversation } from './conversation';

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
