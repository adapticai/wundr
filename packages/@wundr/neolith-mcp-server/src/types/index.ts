/**
 * Neolith MCP Server Type Definitions
 *
 * Central type definitions for the Neolith MCP Server package.
 * This module exports all types needed for MCP protocol, tools, server configuration,
 * and Neolith-specific domain types.
 *
 * @module @wundr.io/neolith-mcp-server/types
 */

// =============================================================================
// MCP Server Types
// =============================================================================

export type {
  NeolithMCPServerOptions,
  NeolithMCPServerConfig,
  NeolithAPIClient,
  NeolithMCPServerStatus,
} from '../server/neolith-mcp-server';

// =============================================================================
// Base MCP Protocol Types (from @wundr.io/mcp-server)
// =============================================================================

export type {
  Logger,
  LogLevel,
  McpToolType as Tool,
  ToolHandler,
  ToolRegistration,
  ToolContext,
  ToolCallResult,
  ToolContent,
  TextContent,
  ImageContent,
  ServerCapabilities,
  MCPServerConfig,
} from '@wundr.io/mcp-server';

// =============================================================================
// MCP Tool Registry Types
// =============================================================================

export type {
  McpTool,
  McpToolResult,
  ToolRegistrationOptions,
  ToolExecutionContext,
} from '../tools/registry';

export {
  NeolithToolRegistry,
  createNeolithToolRegistry,
  createToolFromSchema,
  globalNeolithRegistry,
  successResult,
  errorResult,
  wrapHandler,
  paginatedResult,
  validateContext,
} from '../tools/registry';

// =============================================================================
// Common Tool Types
// =============================================================================

export type {
  McpToolResult as ToolResult,
} from './common';

export type {
  NeolithApiClient,
  ToolExecutionContext as ExecutionContext,
} from '../tools/types';

export {
  successResult as createSuccessResult,
  errorResult as createErrorResult,
} from './common';

// =============================================================================
// Neolith Domain Types
// =============================================================================

/**
 * Neolith Workspace
 */
export interface NeolithWorkspace {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Neolith Channel
 */
export interface NeolithChannel {
  readonly id: string;
  readonly workspaceId: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly type: 'public' | 'private' | 'direct';
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Neolith Message
 */
export interface NeolithMessage {
  readonly id: string;
  readonly channelId: string;
  readonly userId: string;
  readonly content: string;
  readonly type: 'text' | 'file' | 'system';
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

/**
 * Neolith File
 */
export interface NeolithFile {
  readonly id: string;
  readonly workspaceId: string;
  readonly channelId?: string;
  readonly messageId?: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

/**
 * Neolith User
 */
export interface NeolithUser {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly avatarUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Neolith Search Result
 */
export interface NeolithSearchResult {
  readonly type: 'workspace' | 'channel' | 'message' | 'file' | 'user';
  readonly id: string;
  readonly title: string;
  readonly snippet?: string;
  readonly metadata?: Record<string, unknown>;
  readonly score?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
  readonly cursor?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly total?: number;
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

/**
 * Neolith API Error
 */
export interface NeolithAPIError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// =============================================================================
// Workspace Types
// =============================================================================

export type {
  WorkspaceRole,
  WorkspaceMember,
  Workspace,
  WorkspaceSettings,
  WorkspaceInvite,
} from './common';

// =============================================================================
// Zod Schemas (Re-exported for validation)
// =============================================================================

export {
  // Common schemas
  CommonOptionsSchema,

  // Workspace schemas
  WorkspaceListSchema,
  WorkspaceCreateSchema,
  WorkspaceDetailsSchema,
  WorkspaceUpdateSchema,
  WorkspaceMembersSchema,
  WorkspaceToolSchemas,

  // Channel schemas
  ChannelListSchema,
  ChannelCreateSchema,
  ChannelDetailsSchema,
  ChannelUpdateSchema,
  ChannelMembersSchema,
  ChannelArchiveSchema,
  ChannelToolSchemas,

  // Messaging schemas
  MessageSendSchema,
  MessageListSchema,
  MessageUpdateSchema,
  MessageDeleteSchema,
  MessageReactionSchema,
  MessagePinSchema,
  ThreadCreateSchema,
  ThreadListSchema,
  MessagingToolSchemas,

  // File schemas
  FileUploadSchema,
  FileListSchema,
  FileDetailsSchema,
  FileDownloadSchema,
  FileDeleteSchema,
  FileToolSchemas,

  // User schemas
  UserListSchema,
  UserDetailsSchema,
  UserPresenceSchema,
  UserProfileSchema,
  UserToolSchemas,

  // Search schemas
  GlobalSearchSchema,
  CommandPaletteSchema,
  SearchToolSchemas,

  // Orchestrator schemas
  OrchestratorHandoffSchema,
  OrchestratorDelegateSchema,
  OrchestratorCollaborateSchema,
  OrchestratorAnalyticsSchema,
  OrchestratorConflictsSchema,
  OrchestratorToolSchemas,

  // Registry and helpers
  NeolithToolSchemas,
  zodToJsonSchema,
  getNeolithToolJsonSchema,
  getAllNeolithToolJsonSchemas,
} from '../tools/schemas';

// Zod schema input types
export type {
  WorkspaceListInput,
  WorkspaceCreateInput,
  WorkspaceDetailsInput,
  WorkspaceUpdateInput,
  WorkspaceMembersInput,
  ChannelListInput,
  ChannelCreateInput,
  ChannelDetailsInput,
  ChannelUpdateInput,
  ChannelMembersInput,
  ChannelArchiveInput,
  MessageSendInput,
  MessageListInput,
  MessageUpdateInput,
  MessageDeleteInput,
  MessageReactionInput,
  MessagePinInput,
  ThreadCreateInput,
  ThreadListInput,
  FileUploadInput,
  FileListInput,
  FileDetailsInput,
  FileDownloadInput,
  FileDeleteInput,
  UserListInput,
  UserDetailsInput,
  UserPresenceInput,
  UserProfileInput,
  GlobalSearchInput,
  CommandPaletteInput,
  OrchestratorHandoffInput,
  OrchestratorDelegateInput,
  OrchestratorCollaborateInput,
  OrchestratorAnalyticsInput,
  OrchestratorConflictsInput,
  NeolithToolName,
} from '../tools/schemas';

// =============================================================================
// Tool Category Types
// =============================================================================

// Workspace tool types
export type { ListWorkspacesInput } from '../tools/workspace/list-workspaces';
export type { GetWorkspaceInput } from '../tools/workspace/get-workspace';
export type { GetWorkspaceMembersInput } from '../tools/workspace/get-workspace-members';
export type { GetWorkspaceSettingsInput } from '../tools/workspace/get-workspace-settings';
export type { UpdateWorkspaceInput } from '../tools/workspace/update-workspace';
export type { CreateInviteInput } from '../tools/workspace/create-invite';
export type { SearchWorkspaceInput } from '../tools/workspace/search-workspace';

// Channel tool types
export type { ListChannelsInput } from '../tools/channels/list-channels';
export type { GetChannelInput } from '../tools/channels/get-channel';
export type { CreateChannelInput } from '../tools/channels/create-channel';
export type { UpdateChannelInput } from '../tools/channels/update-channel';
export type { ArchiveChannelInput } from '../tools/channels/archive-channel';
export type { JoinChannelInput } from '../tools/channels/join-channel';
export type { LeaveChannelInput } from '../tools/channels/leave-channel';
export type { GetChannelMembersInput } from '../tools/channels/get-channel-members';

// Messaging tool types
export type {
  SendMessageInput,
  GetMessagesInput,
  GetThreadInput,
  ReplyToThreadInput,
  EditMessageInput,
  DeleteMessageInput,
  AddReactionInput,
  RemoveReactionInput,
  GetDMChannelsInput,
  CreateDMInput,
  MessagingToolName,
} from '../tools/messaging';

// File tool types
export type {
  ListFilesInput,
  UploadFileInput,
  DownloadFileInput,
  ShareFileInput,
  DeleteFileInput,
  GetFileInfoInput,
} from '../tools/files';

// User tool types
export type {
  GetCurrentUserInput,
  GetUserInput,
  SearchUsersInput,
  UpdateProfileInput,
  SetPresenceInput,
  UserToolName,
  CurrentUserProfile,
  UserProfile,
  UserSearchResult,
  SearchUsersResponse,
  PresenceStatus,
  UserPresenceResponse,
} from '../tools/users';

// Search tool types
export type {
  GlobalSearchInput as SearchGlobalInput,
  GlobalSearchResponse,
  GlobalSearchResult,
  SearchResultItem,
  MessageSearchInput,
  MessageSearchResponse,
  MessageSearchResult,
  MessageResultItem,
  FileSearchInput,
  FileSearchResponse,
  FileSearchResult,
  FileResultItem,
} from '../tools/search';

// Orchestrator tool types
export type {
  ListOrchestratorsInput,
  Orchestrator,
  ListOrchestratorsResponse,
  OrchestratorStatistics,
  GetOrchestratorInput,
  GetOrchestratorResponse,
  GetOrchestratorConfigInput,
  OrchestratorConfig,
  GetOrchestratorConfigResponse,
  UpdateOrchestratorConfigInput,
  UpdateOrchestratorConfigResponse,
  GetOrchestratorMemoryInput,
  OrchestratorMemory,
  GetOrchestratorMemoryResponse,
  StoreOrchestratorMemoryInput,
  StoreOrchestratorMemoryResponse,
  GetOrchestratorTasksInput,
  Task,
  GetOrchestratorTasksResponse,
  CreateTaskInput,
  CreateTaskResponse,
} from '../tools/orchestrators';

// =============================================================================
// Type Guards and Utilities
// =============================================================================

import type { McpToolResult } from '../tools/registry';

/**
 * Type guard to check if a result is successful
 */
export function isSuccessResult<T>(result: McpToolResult<T>): result is McpToolResult<T> & { success: true; data: T } {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if a result is an error
 */
export function isErrorResult<T>(result: McpToolResult<T>): result is McpToolResult<T> & { success: false; error: string } {
  return result.success === false && result.error !== undefined;
}

/**
 * Extract data from a successful result or throw
 */
export function unwrapResult<T>(result: McpToolResult<T>): T {
  if (isSuccessResult(result)) {
    return result.data;
  }
  throw new Error(result.error || 'Operation failed');
}
