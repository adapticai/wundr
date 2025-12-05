/**
 * AI Message Types
 * Comprehensive type definitions for AI messages and conversations
 */

import type {
  AIMessageRole,
  AIMessageStatus,
  AIToolCall,
  AIReasoningStep,
  AIContentBlock,
  AIMessageAttachment,
  AITokenUsage,
} from './ai';

/**
 * Core AI message structure
 */
export interface AIMessage {
  /** Unique message ID */
  readonly id: string;
  /** Message role */
  readonly role: AIMessageRole;
  /** Message content (text) */
  readonly content: string;
  /** Structured content blocks */
  readonly contentBlocks?: readonly AIContentBlock[];
  /** Message creation timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Message update timestamp (ISO 8601) */
  readonly updatedAt?: string;
  /** Message status */
  readonly status: AIMessageStatus;
  /** Model used for this message */
  readonly model?: string;
  /** Token usage for this message */
  readonly tokens?: AITokenUsage;
  /** Tool calls in this message */
  readonly toolCalls?: readonly AIToolCall[];
  /** Reasoning steps (for reasoning models) */
  readonly reasoningSteps?: readonly AIReasoningStep[];
  /** Message attachments */
  readonly attachments?: readonly AIMessageAttachment[];
  /** Parent message ID (for threaded conversations) */
  readonly parentId?: string;
  /** Whether message is streaming */
  readonly isStreaming?: boolean;
  /** Error information if status is error */
  readonly error?: string;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Message create input
 */
export interface CreateAIMessageInput {
  /** Message role */
  role: AIMessageRole;
  /** Message content */
  content: string;
  /** Structured content blocks */
  contentBlocks?: readonly AIContentBlock[];
  /** Parent message ID */
  parentId?: string;
  /** Attachments */
  attachmentIds?: readonly string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message update input
 */
export interface UpdateAIMessageInput {
  /** Updated content */
  content?: string;
  /** Updated status */
  status?: AIMessageStatus;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message filter options
 */
export interface AIMessageFilters {
  /** Filter by role */
  role?: AIMessageRole;
  /** Filter by status */
  status?: AIMessageStatus;
  /** Search in content */
  search?: string;
  /** Filter by date range */
  dateFrom?: string;
  /** Filter by date range */
  dateTo?: string;
  /** Filter by model */
  model?: string;
  /** Include tool calls */
  includeToolCalls?: boolean;
  /** Include reasoning steps */
  includeReasoningSteps?: boolean;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Message with user information
 */
export interface AIMessageWithUser extends AIMessage {
  /** User who created the message */
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image?: string;
  };
}

/**
 * Message thread structure
 */
export interface AIMessageThread {
  /** Root message */
  readonly rootMessage: AIMessage;
  /** Thread messages */
  readonly messages: readonly AIMessage[];
  /** Total message count */
  readonly totalMessages: number;
  /** Thread creation timestamp */
  readonly createdAt: string;
  /** Thread update timestamp */
  readonly updatedAt: string;
}

/**
 * Message search result
 */
export interface AIMessageSearchResult {
  /** Matched message */
  readonly message: AIMessage;
  /** Match score */
  readonly score: number;
  /** Matched excerpts */
  readonly highlights: readonly string[];
  /** Context messages (before/after) */
  readonly context?: readonly AIMessage[];
}

/**
 * Message statistics
 */
export interface AIMessageStatistics {
  /** Total messages */
  readonly totalMessages: number;
  /** Messages by role */
  readonly messagesByRole: Record<AIMessageRole, number>;
  /** Messages by status */
  readonly messagesByStatus: Record<AIMessageStatus, number>;
  /** Total tokens used */
  readonly totalTokens: number;
  /** Average message length */
  readonly averageLength: number;
  /** Messages with tool calls */
  readonly messagesWithToolCalls: number;
  /** Messages with reasoning */
  readonly messagesWithReasoning: number;
  /** Time period statistics */
  readonly timePeriod?: {
    readonly start: string;
    readonly end: string;
  };
}

/**
 * Message export format
 */
export type AIMessageExportFormat = 'json' | 'markdown' | 'text' | 'csv';

/**
 * Message export options
 */
export interface AIMessageExportOptions {
  /** Export format */
  format: AIMessageExportFormat;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include tool calls */
  includeToolCalls?: boolean;
  /** Include reasoning steps */
  includeReasoningSteps?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Include token usage */
  includeTokenUsage?: boolean;
}

/**
 * Message template
 */
export interface AIMessageTemplate {
  /** Template ID */
  readonly id: string;
  /** Template name */
  readonly name: string;
  /** Template description */
  readonly description: string;
  /** Template content */
  readonly content: string;
  /** Template variables */
  readonly variables: readonly {
    readonly name: string;
    readonly description: string;
    readonly required: boolean;
    readonly defaultValue?: string;
  }[];
  /** Template category */
  readonly category?: string;
  /** Template tags */
  readonly tags?: readonly string[];
}

/**
 * Message suggestion
 */
export interface AIMessageSuggestion {
  /** Suggestion ID */
  readonly id: string;
  /** Suggested content */
  readonly content: string;
  /** Suggestion type */
  readonly type: 'completion' | 'correction' | 'rephrasing' | 'translation';
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Reason for suggestion */
  readonly reason?: string;
}

/**
 * Message annotation
 */
export interface AIMessageAnnotation {
  /** Annotation ID */
  readonly id: string;
  /** Annotation type */
  readonly type: 'highlight' | 'comment' | 'correction' | 'reference';
  /** Annotated text */
  readonly text: string;
  /** Start position in content */
  readonly startPosition: number;
  /** End position in content */
  readonly endPosition: number;
  /** Annotation content */
  readonly content?: string;
  /** User who created annotation */
  readonly userId: string;
  /** Creation timestamp */
  readonly createdAt: string;
}

/**
 * Message reaction
 */
export interface AIMessageReaction {
  /** Reaction emoji */
  readonly emoji: string;
  /** User ID who reacted */
  readonly userId: string;
  /** Reaction timestamp */
  readonly createdAt: string;
}

/**
 * Message reactions summary
 */
export interface AIMessageReactionsSummary {
  /** Total reactions */
  readonly totalReactions: number;
  /** Reactions by emoji */
  readonly reactionsByEmoji: Record<string, number>;
  /** Current user's reactions */
  readonly currentUserReactions: readonly string[];
}

/**
 * Message reference
 */
export interface AIMessageReference {
  /** Referenced message ID */
  readonly messageId: string;
  /** Reference type */
  readonly type: 'reply' | 'quote' | 'mention' | 'related';
  /** Excerpt from referenced message */
  readonly excerpt?: string;
}

/**
 * Message edit history
 */
export interface AIMessageEdit {
  /** Edit ID */
  readonly id: string;
  /** Previous content */
  readonly previousContent: string;
  /** New content */
  readonly newContent: string;
  /** Edit timestamp */
  readonly editedAt: string;
  /** User who edited */
  readonly editedBy: string;
  /** Edit reason */
  readonly reason?: string;
}

/**
 * Type guard to check if a value is an AIMessageExportFormat
 */
export function isAIMessageExportFormat(
  value: unknown
): value is AIMessageExportFormat {
  return (
    typeof value === 'string' &&
    ['json', 'markdown', 'text', 'csv'].includes(value)
  );
}
