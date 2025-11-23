/**
 * @wundr/autogen-orchestrator - AutoGen-style Multi-Agent Orchestration
 *
 * Implements conversational patterns for coordinating multiple AI agents in a
 * group chat setting with configurable speaker selection, termination conditions,
 * and nested chat support.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Group Chat
// ============================================================================

export {
  GroupChatManager,
  GroupChatBuilder,
  GroupChatEvents,
  ResponseGenerator,
  createParticipant,
} from './group-chat';

// ============================================================================
// Speaker Selection
// ============================================================================

export {
  createSpeakerSelector,
  SpeakerSelectionManager,
  RoundRobinSelector,
  RandomSelector,
  LLMSelector,
  PrioritySelector,
  ManualSelector,
  AutoSelector,
} from './speaker-selection';

// ============================================================================
// Termination Handling
// ============================================================================

export {
  TerminationHandler,
  createTerminationHandler,
  TerminationManager,
  TerminationPresets,
  MaxRoundsHandler,
  MaxMessagesHandler,
  KeywordHandler,
  TimeoutHandler,
  FunctionHandler,
  ConsensusHandler,
  CustomHandler,
  ConsensusConfig,
} from './termination';

// ============================================================================
// Nested Chat
// ============================================================================

export {
  NestedChatManager,
  NestedChatConfigBuilder,
  NestedChatEvents,
} from './nested-chat';

// ============================================================================
// Types and Schemas
// ============================================================================

export {
  // Message Types
  Message,
  MessageRole,
  MessageStatus,
  ContentType,
  MessageMetadata,
  FunctionCall,

  // Participant Types
  ChatParticipant,
  ParticipantType,
  ParticipantStatus,
  ParticipantMetadata,
  ModelConfig,
  FunctionDefinition,

  // Configuration Types
  GroupChatConfig,
  SpeakerSelectionConfig,
  SpeakerSelectionMethod,
  TransitionRule,

  // Termination Types
  TerminationCondition,
  TerminationConditionType,
  TerminationResult,
  TerminationEvaluator,

  // Nested Chat Types
  NestedChatConfig,
  NestedChatTrigger,
  NestedChatResult,
  SummaryMethod,

  // Result Types
  ChatResult,
  ChatStatus,
  ChatMetrics,
  ChatError,
  ChatContext,

  // Speaker Selection Types
  SpeakerSelectionResult,
  SpeakerSelectionStrategy,

  // Event Types
  ChatEvent,
  ChatEventType,

  // Option Types
  CreateMessageOptions,
  AddParticipantOptions,
  StartChatOptions,

  // Zod Schemas
  MessageSchema,
  ChatParticipantSchema,
  GroupChatConfigSchema,
  TerminationConditionSchema,
} from './types';

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export validation library for type guards
export { z } from 'zod';
