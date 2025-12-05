/**
 * AI Conversation Types
 *
 * Type definitions for AI-powered chat conversations with persistence,
 * search, sharing, and export capabilities.
 */

/**
 * AI conversation metadata stored in JSON
 */
export interface AIConversationMetadata {
  /** Conversation title (auto-generated or user-set) */
  title?: string;
  /** AI model used */
  model?: string;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Custom tags for organization */
  tags?: string[];
  /** Whether conversation is pinned */
  isPinned?: boolean;
  /** Whether conversation is archived */
  isArchived?: boolean;
  /** Share settings */
  shareSettings?: {
    isPublic: boolean;
    shareToken?: string;
    allowedUserIds?: string[];
  };
  /** Token usage statistics */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  /** Message count */
  messageCount?: number;
  /** Last message preview */
  lastMessagePreview?: string;
}

/**
 * AI message role types
 */
export type AIMessageRole = 'user' | 'assistant' | 'system';

/**
 * AI message with metadata
 */
export interface AIMessage {
  /** Unique message ID */
  readonly id: string;
  /** Message role */
  role: AIMessageRole;
  /** Message content */
  content: string;
  /** Message creation timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Token usage for this message */
  tokens?: {
    input?: number;
    output?: number;
  };
  /** Model used for this message */
  model?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI conversation with messages and metadata
 */
export interface AIConversation {
  /** Unique conversation ID (channel ID) */
  readonly id: string;
  /** Conversation title */
  title: string;
  /** Workspace this conversation belongs to */
  readonly workspaceId: string;
  /** User who created the conversation */
  readonly createdById: string;
  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Conversation metadata */
  metadata: AIConversationMetadata;
  /** Messages in conversation */
  messages?: AIMessage[];
  /** Whether user has access */
  hasAccess?: boolean;
  /** Whether conversation is pinned */
  isPinned?: boolean;
  /** Whether conversation is archived */
  isArchived?: boolean;
}

/**
 * Create AI conversation input
 */
export interface CreateAIConversationInput {
  /** Workspace ID */
  workspaceId: string;
  /** Optional title */
  title?: string;
  /** Initial system prompt */
  systemPrompt?: string;
  /** Initial user message */
  initialMessage?: string;
  /** AI model to use */
  model?: string;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Tags */
  tags?: string[];
}

/**
 * Update AI conversation input
 */
export interface UpdateAIConversationInput {
  /** Updated title */
  title?: string;
  /** Updated system prompt */
  systemPrompt?: string;
  /** Updated tags */
  tags?: string[];
  /** Pin status */
  isPinned?: boolean;
  /** Archive status */
  isArchived?: boolean;
}

/**
 * Add message to conversation input
 */
export interface AddAIMessageInput {
  /** Conversation ID */
  conversationId: string;
  /** Message role */
  role: AIMessageRole;
  /** Message content */
  content: string;
  /** Model used */
  model?: string;
  /** Token usage */
  tokens?: {
    input?: number;
    output?: number;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI conversation filters for listing
 */
export interface AIConversationFilters {
  /** Workspace ID (required) */
  workspaceId: string;
  /** Search query */
  search?: string;
  /** Filter by tags */
  tags?: string[];
  /** Show only pinned */
  pinnedOnly?: boolean;
  /** Show only archived */
  archivedOnly?: boolean;
  /** Include archived in results */
  includeArchived?: boolean;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'markdown' | 'text';

/**
 * Export conversation options
 */
export interface ExportConversationOptions {
  /** Export format */
  format: ExportFormat;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include system messages */
  includeSystemMessages?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
}

/**
 * Share conversation input
 */
export interface ShareConversationInput {
  /** Conversation ID */
  conversationId: string;
  /** Make public */
  isPublic?: boolean;
  /** Specific user IDs to share with */
  userIds?: string[];
}

/**
 * Conversation statistics
 */
export interface ConversationStats {
  /** Total conversations */
  totalConversations: number;
  /** Pinned conversations */
  pinnedConversations: number;
  /** Archived conversations */
  archivedConversations: number;
  /** Total messages */
  totalMessages: number;
  /** Total tokens used */
  totalTokens: number;
  /** Most used model */
  mostUsedModel?: string;
  /** Most used tags */
  topTags?: Array<{ tag: string; count: number }>;
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Total item count */
  totalCount: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNextPage: boolean;
  /** Has previous page */
  hasPreviousPage: boolean;
}

/**
 * API response wrapper
 */
export interface AIConversationResponse<T> {
  /** Response data */
  data: T;
  /** Success message */
  message?: string;
  /** Pagination metadata (for list responses) */
  pagination?: PaginationMetadata;
}

/**
 * Type guard to check if a value is an AIMessageRole
 */
export function isAIMessageRole(value: unknown): value is AIMessageRole {
  return (
    typeof value === 'string' && ['user', 'assistant', 'system'].includes(value)
  );
}

/**
 * Type guard to check if a value is an ExportFormat
 */
export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === 'string' && ['json', 'markdown', 'text'].includes(value)
  );
}
