/**
 * Type definitions for AutoGen-style multi-agent orchestration
 *
 * Implements conversational patterns for agent coordination including
 * group chat, speaker selection, and termination handling.
 */

import { z } from 'zod';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Role of the message sender in the conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Status of a message in the conversation flow
 */
export type MessageStatus = 'pending' | 'delivered' | 'processed' | 'failed';

/**
 * Content type within a message
 */
export type ContentType =
  | 'text'
  | 'code'
  | 'image'
  | 'function_call'
  | 'function_result';

/**
 * Represents a single message in the conversation
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
  /** Name of the sender (participant name) */
  name: string;
  /** Timestamp when message was created */
  timestamp: Date;
  /** Optional metadata attached to the message */
  metadata?: MessageMetadata;
  /** Content type */
  contentType?: ContentType;
  /** Function call details if applicable */
  functionCall?: FunctionCall;
  /** Status of the message */
  status?: MessageStatus;
}

/**
 * Metadata attached to a message
 */
export interface MessageMetadata {
  /** Token count for the message */
  tokenCount?: number;
  /** Processing latency in milliseconds */
  latencyMs?: number;
  /** Model used to generate the message */
  model?: string;
  /** Associated task ID */
  taskId?: string;
  /** Parent message ID for threading */
  parentId?: string;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Function call embedded in a message
 */
export interface FunctionCall {
  /** Name of the function to call */
  name: string;
  /** Arguments for the function */
  arguments: Record<string, unknown>;
  /** Result of the function call */
  result?: unknown;
}

// ============================================================================
// Chat Participant Types
// ============================================================================

/**
 * Type of chat participant
 */
export type ParticipantType = 'human' | 'assistant' | 'agent' | 'tool';

/**
 * Status of a chat participant
 */
export type ParticipantStatus =
  | 'active'
  | 'idle'
  | 'busy'
  | 'offline'
  | 'error';

/**
 * Represents a participant in the group chat
 */
export interface ChatParticipant {
  /** Unique identifier for the participant */
  id: string;
  /** Display name of the participant */
  name: string;
  /** Type of participant */
  type: ParticipantType;
  /** System prompt defining participant's behavior */
  systemPrompt: string;
  /** Current status of the participant */
  status: ParticipantStatus;
  /** Capabilities of this participant */
  capabilities: string[];
  /** Model configuration for AI participants */
  modelConfig?: ModelConfig;
  /** Function definitions available to this participant */
  functions?: FunctionDefinition[];
  /** Maximum number of consecutive replies allowed */
  maxConsecutiveReplies?: number;
  /** Description of the participant's role */
  description?: string;
  /** Metadata for the participant */
  metadata?: ParticipantMetadata;
}

/**
 * Model configuration for AI participants
 */
export interface ModelConfig {
  /** Model identifier */
  model: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * Function definition for participants
 */
export interface FunctionDefinition {
  /** Function name */
  name: string;
  /** Function description */
  description: string;
  /** Parameter schema */
  parameters: Record<string, unknown>;
  /** Whether function is required */
  required?: boolean;
}

/**
 * Metadata for participants
 */
export interface ParticipantMetadata {
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt?: Date;
  /** Total messages sent */
  messageCount?: number;
  /** Success rate */
  successRate?: number;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

// ============================================================================
// Group Chat Configuration Types
// ============================================================================

/**
 * Speaker selection method for group chat
 */
export type SpeakerSelectionMethod =
  | 'round_robin'
  | 'random'
  | 'llm_selected'
  | 'priority'
  | 'manual'
  | 'auto';

/**
 * Configuration for the group chat
 */
export interface GroupChatConfig {
  /** Unique identifier for the chat */
  id?: string;
  /** Name of the group chat */
  name: string;
  /** Description of the chat's purpose */
  description?: string;
  /** Participants in the chat */
  participants: ChatParticipant[];
  /** Speaker selection method */
  speakerSelectionMethod: SpeakerSelectionMethod;
  /** Configuration for speaker selection */
  speakerSelectionConfig?: SpeakerSelectionConfig;
  /** Maximum number of conversation rounds */
  maxRounds?: number;
  /** Maximum total messages allowed */
  maxMessages?: number;
  /** Termination conditions */
  terminationConditions?: TerminationCondition[];
  /** Whether to allow nested chats */
  allowNestedChats?: boolean;
  /** Nested chat configurations */
  nestedChatConfigs?: NestedChatConfig[];
  /** Admin participant name */
  adminName?: string;
  /** Enable message history */
  enableHistory?: boolean;
  /** Maximum history length to maintain */
  maxHistoryLength?: number;
  /** Timeout for the entire chat in milliseconds */
  timeoutMs?: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for speaker selection
 */
export interface SpeakerSelectionConfig {
  /** Model for LLM-based selection */
  selectorModel?: string;
  /** Prompt template for LLM selection */
  selectorPrompt?: string;
  /** Priority order for priority-based selection */
  priorityOrder?: string[];
  /** Weights for weighted selection */
  weights?: Record<string, number>;
  /** Maximum retries for selection */
  maxRetries?: number;
  /** Transition rules between speakers */
  transitionRules?: TransitionRule[];
  /** Allowed speaker transitions */
  allowedTransitions?: Record<string, string[]>;
}

/**
 * Rule for speaker transitions
 */
export interface TransitionRule {
  /** From participant name */
  from: string;
  /** To participant names */
  to: string[];
  /** Condition for the transition */
  condition?: string;
  /** Weight for this transition */
  weight?: number;
}

// ============================================================================
// Termination Types
// ============================================================================

/**
 * Type of termination condition
 */
export type TerminationConditionType =
  | 'max_rounds'
  | 'max_messages'
  | 'keyword'
  | 'timeout'
  | 'function'
  | 'consensus'
  | 'custom';

/**
 * Configuration for termination conditions
 */
export interface TerminationCondition {
  /** Type of termination condition */
  type: TerminationConditionType;
  /** Value for the condition */
  value: unknown;
  /** Description of the condition */
  description?: string;
  /** Custom function for evaluation (for 'function' type) */
  evaluator?: TerminationEvaluator;
}

/**
 * Function type for custom termination evaluation
 */
export type TerminationEvaluator = (
  messages: Message[],
  participants: ChatParticipant[],
  context: ChatContext
) => Promise<TerminationResult>;

/**
 * Result of termination evaluation
 */
export interface TerminationResult {
  /** Whether to terminate */
  shouldTerminate: boolean;
  /** Reason for termination */
  reason?: string;
  /** Final summary */
  summary?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Nested Chat Types
// ============================================================================

/**
 * Configuration for nested chat sessions
 */
export interface NestedChatConfig {
  /** Unique identifier for nested chat config */
  id: string;
  /** Name of the nested chat */
  name: string;
  /** Trigger condition for starting nested chat */
  trigger: NestedChatTrigger;
  /** Participants in the nested chat */
  participants: string[];
  /** Maximum rounds for nested chat */
  maxRounds?: number;
  /** Summary method after nested chat completes */
  summaryMethod?: SummaryMethod;
  /** Custom prompt for the nested chat */
  prompt?: string;
  /** Whether to share context with parent chat */
  shareContext?: boolean;
}

/**
 * Trigger for starting a nested chat
 */
export interface NestedChatTrigger {
  /** Type of trigger */
  type: 'keyword' | 'participant' | 'condition' | 'manual';
  /** Value for the trigger */
  value: unknown;
  /** Description of the trigger */
  description?: string;
}

/**
 * Method for summarizing nested chat results
 */
export type SummaryMethod = 'last' | 'llm' | 'reflection' | 'custom';

// ============================================================================
// Chat Result Types
// ============================================================================

/**
 * Status of the chat session
 */
export type ChatStatus =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'completed'
  | 'terminated'
  | 'error';

/**
 * Result of a group chat session
 */
export interface ChatResult {
  /** Chat session ID */
  chatId: string;
  /** Final status of the chat */
  status: ChatStatus;
  /** All messages in the conversation */
  messages: Message[];
  /** Summary of the conversation */
  summary?: string;
  /** Termination reason */
  terminationReason?: string;
  /** Total rounds completed */
  totalRounds: number;
  /** Total messages exchanged */
  totalMessages: number;
  /** Participants involved */
  participants: string[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Metrics for the chat session */
  metrics?: ChatMetrics;
  /** Nested chat results if any */
  nestedResults?: NestedChatResult[];
  /** Error information if failed */
  error?: ChatError;
  /** Timestamp when chat started */
  startedAt: Date;
  /** Timestamp when chat ended */
  endedAt: Date;
}

/**
 * Metrics for a chat session
 */
export interface ChatMetrics {
  /** Total tokens used */
  totalTokens: number;
  /** Average response time in milliseconds */
  avgResponseTimeMs: number;
  /** Messages per participant */
  messagesPerParticipant: Record<string, number>;
  /** Token usage per participant */
  tokensPerParticipant: Record<string, number>;
  /** Successful responses count */
  successfulResponses: number;
  /** Failed responses count */
  failedResponses: number;
}

/**
 * Result from a nested chat session
 */
export interface NestedChatResult {
  /** Nested chat ID */
  nestedChatId: string;
  /** Config ID that triggered this nested chat */
  configId: string;
  /** Result of the nested chat */
  result: ChatResult;
  /** Summary from the nested chat */
  summary?: string;
  /** Parent message ID that triggered the nested chat */
  parentMessageId: string;
}

/**
 * Error information for chat failures
 */
export interface ChatError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace if available */
  stack?: string;
  /** Context of the error */
  context?: Record<string, unknown>;
  /** Whether the error is recoverable */
  recoverable: boolean;
}

// ============================================================================
// Chat Context Types
// ============================================================================

/**
 * Context available during chat execution
 */
export interface ChatContext {
  /** Current chat ID */
  chatId: string;
  /** Current round number */
  currentRound: number;
  /** Total messages so far */
  messageCount: number;
  /** Active participants */
  activeParticipants: string[];
  /** Current speaker */
  currentSpeaker?: string;
  /** Previous speaker */
  previousSpeaker?: string;
  /** Start time */
  startTime: Date;
  /** Shared state */
  state: Record<string, unknown>;
  /** Parent context if nested */
  parentContext?: ChatContext;
}

// ============================================================================
// Speaker Selection Types
// ============================================================================

/**
 * Result of speaker selection
 */
export interface SpeakerSelectionResult {
  /** Selected speaker name */
  speaker: string;
  /** Reason for selection */
  reason?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Alternative speakers considered */
  alternatives?: string[];
}

/**
 * Interface for speaker selection strategies
 */
export interface SpeakerSelectionStrategy {
  /** Select the next speaker */
  selectSpeaker(
    participants: ChatParticipant[],
    messages: Message[],
    context: ChatContext,
    config?: SpeakerSelectionConfig
  ): Promise<SpeakerSelectionResult>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Types of events emitted during chat
 */
export type ChatEventType =
  | 'chat_started'
  | 'chat_ended'
  | 'message_sent'
  | 'message_received'
  | 'speaker_selected'
  | 'round_started'
  | 'round_ended'
  | 'nested_chat_started'
  | 'nested_chat_ended'
  | 'termination_triggered'
  | 'error';

/**
 * Event emitted during chat execution
 */
export interface ChatEvent {
  /** Event type */
  type: ChatEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Chat ID */
  chatId: string;
  /** Event data */
  data: unknown;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Zod schema for Message validation
 */
export const MessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string(),
  name: z.string().min(1),
  timestamp: z.date(),
  metadata: z
    .object({
      tokenCount: z.number().optional(),
      latencyMs: z.number().optional(),
      model: z.string().optional(),
      taskId: z.string().optional(),
      parentId: z.string().optional(),
      properties: z.record(z.unknown()).optional(),
    })
    .optional(),
  contentType: z
    .enum(['text', 'code', 'image', 'function_call', 'function_result'])
    .optional(),
  functionCall: z
    .object({
      name: z.string(),
      arguments: z.record(z.unknown()),
      result: z.unknown().optional(),
    })
    .optional(),
  status: z.enum(['pending', 'delivered', 'processed', 'failed']).optional(),
});

/**
 * Zod schema for ChatParticipant validation
 */
export const ChatParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['human', 'assistant', 'agent', 'tool']),
  systemPrompt: z.string(),
  status: z.enum(['active', 'idle', 'busy', 'offline', 'error']),
  capabilities: z.array(z.string()),
  modelConfig: z
    .object({
      model: z.string(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
      frequencyPenalty: z.number().min(-2).max(2).optional(),
      presencePenalty: z.number().min(-2).max(2).optional(),
      stopSequences: z.array(z.string()).optional(),
    })
    .optional(),
  functions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.unknown()),
        required: z.boolean().optional(),
      })
    )
    .optional(),
  maxConsecutiveReplies: z.number().positive().optional(),
  description: z.string().optional(),
});

/**
 * Zod schema for GroupChatConfig validation
 */
export const GroupChatConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  participants: z.array(ChatParticipantSchema).min(2),
  speakerSelectionMethod: z.enum([
    'round_robin',
    'random',
    'llm_selected',
    'priority',
    'manual',
    'auto',
  ]),
  speakerSelectionConfig: z
    .object({
      selectorModel: z.string().optional(),
      selectorPrompt: z.string().optional(),
      priorityOrder: z.array(z.string()).optional(),
      weights: z.record(z.number()).optional(),
      maxRetries: z.number().positive().optional(),
      transitionRules: z
        .array(
          z.object({
            from: z.string(),
            to: z.array(z.string()),
            condition: z.string().optional(),
            weight: z.number().optional(),
          })
        )
        .optional(),
      allowedTransitions: z.record(z.array(z.string())).optional(),
    })
    .optional(),
  maxRounds: z.number().positive().optional(),
  maxMessages: z.number().positive().optional(),
  terminationConditions: z
    .array(
      z.object({
        type: z.enum([
          'max_rounds',
          'max_messages',
          'keyword',
          'timeout',
          'function',
          'consensus',
          'custom',
        ]),
        value: z.unknown(),
        description: z.string().optional(),
      })
    )
    .optional(),
  allowNestedChats: z.boolean().optional(),
  nestedChatConfigs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        trigger: z.object({
          type: z.enum(['keyword', 'participant', 'condition', 'manual']),
          value: z.unknown(),
          description: z.string().optional(),
        }),
        participants: z.array(z.string()),
        maxRounds: z.number().positive().optional(),
        summaryMethod: z
          .enum(['last', 'llm', 'reflection', 'custom'])
          .optional(),
        prompt: z.string().optional(),
        shareContext: z.boolean().optional(),
      })
    )
    .optional(),
  adminName: z.string().optional(),
  enableHistory: z.boolean().optional(),
  maxHistoryLength: z.number().positive().optional(),
  timeoutMs: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for TerminationCondition validation
 */
export const TerminationConditionSchema = z.object({
  type: z.enum([
    'max_rounds',
    'max_messages',
    'keyword',
    'timeout',
    'function',
    'consensus',
    'custom',
  ]),
  value: z.unknown(),
  description: z.string().optional(),
});

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for creating a new message
 */
export interface CreateMessageOptions {
  role: MessageRole;
  content: string;
  name: string;
  contentType?: ContentType;
  functionCall?: FunctionCall;
  metadata?: Partial<MessageMetadata>;
}

/**
 * Options for adding a participant
 */
export interface AddParticipantOptions {
  name: string;
  type: ParticipantType;
  systemPrompt: string;
  capabilities?: string[];
  modelConfig?: ModelConfig;
  functions?: FunctionDefinition[];
  maxConsecutiveReplies?: number;
  description?: string;
}

/**
 * Options for starting a chat
 */
export interface StartChatOptions {
  /** Initial message to start the chat */
  initialMessage?: string;
  /** Initial sender name */
  initialSender?: string;
  /** Initial context state */
  initialState?: Record<string, unknown>;
  /** Skip first speaker selection */
  skipInitialSelection?: boolean;
}
