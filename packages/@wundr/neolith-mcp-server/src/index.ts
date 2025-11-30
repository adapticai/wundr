/**
 * Neolith MCP Server
 *
 * MCP server implementation for Neolith workspace management.
 * Provides tools for interacting with workspaces, channels, messages, and files.
 *
 * @module @wundr.io/neolith-mcp-server
 *
 * @example
 * ```typescript
 * import { createNeolithMCPServer, buildNeolithMCPServer } from '@wundr.io/neolith-mcp-server';
 *
 * // Using factory function
 * const server = createNeolithMCPServer({
 *   name: 'neolith-mcp-server',
 *   version: '1.0.0',
 *   neolithApiUrl: 'https://api.neolith.dev',
 *   authToken: process.env.NEOLITH_AUTH_TOKEN,
 * });
 *
 * await server.start();
 *
 * // Using builder pattern
 * const server = await buildNeolithMCPServer('neolith-mcp-server', '1.0.0')
 *   .apiUrl('https://api.neolith.dev')
 *   .authToken(process.env.NEOLITH_AUTH_TOKEN)
 *   .workspace('my-workspace')
 *   .logLevel('debug')
 *   .start();
 * ```
 */

// =============================================================================
// Server Exports
// =============================================================================

export {
  NeolithMCPServer,
  NeolithMCPServerBuilder,
  createNeolithMCPServer,
  buildNeolithMCPServer,
} from './server/neolith-mcp-server';

// =============================================================================
// Tool Registry Exports
// =============================================================================

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
} from './tools/registry';

// =============================================================================
// All Tools Export
// =============================================================================

export {
  // Combined tool collections
  allTools,
  toolsByCategory,
  getAllToolNames,
  getToolsByCategory,
  TOOL_STATS,

  // Workspace tools
  workspaceTools,
  workspaceToolsMap,
  listWorkspacesTool,
  getWorkspaceTool,
  getWorkspaceMembersTool,
  getWorkspaceSettingsTool,
  updateWorkspaceTool,
  createInviteTool,
  searchWorkspaceTool,

  // Channel tools
  channelTools,
  CHANNEL_TOOL_NAMES,
  CHANNEL_TOOL_DESCRIPTIONS,
  listChannelsTool,
  getChannelTool,
  createChannelTool,
  updateChannelTool,
  archiveChannelTool,
  joinChannelTool,
  leaveChannelTool,
  getChannelMembersTool,

  // Messaging tools
  sendMessageHandler,
  getMessagesHandler,
  getThreadHandler,
  replyToThreadHandler,
  editMessageHandler,
  deleteMessageHandler,
  addReactionHandler,
  removeReactionHandler,
  getDMChannelsHandler,
  createDMHandler,

  // File tools
  fileTools,
  fileHandlers,
  listFilesHandler,
  listFilesTool,
  uploadFileHandler,
  uploadFileTool,
  downloadFileHandler,
  downloadFileTool,
  shareFileHandler,
  shareFileTool,
  deleteFileHandler,
  deleteFileTool,
  getFileInfoHandler,
  getFileInfoTool,

  // User tools
  USER_TOOLS,
  getCurrentUser,
  getCurrentUserTool,
  getUser,
  getUserTool,
  searchUsers,
  searchUsersTool,
  updateProfile,
  updateProfileTool,
  setPresence,
  setPresenceTool,

  // Search tools
  searchTools,
  searchHandlers,
  searchSchemas,
  globalSearchHandler,
  globalSearchTool,
  messageSearchHandler,
  messageSearchTool,
  fileSearchHandler,
  fileSearchTool,

  // Orchestrator tools
  listOrchestrators,
  listOrchestratorsInputSchema,
  getOrchestrator,
  getOrchestratorInputSchema,
  getOrchestratorConfig,
  getOrchestratorConfigInputSchema,
  updateOrchestratorConfig,
  updateOrchestratorConfigInputSchema,
  getOrchestratorMemory,
  getOrchestratorMemoryInputSchema,
  storeOrchestratorMemory,
  storeOrchestratorMemoryInputSchema,
  getOrchestratorTasks,
  getOrchestratorTasksInputSchema,
  createTask,
  createTaskInputSchema,
} from './tools';

// =============================================================================
// Schema Exports
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

  // Channel schemas
  ChannelListSchema,
  ChannelCreateSchema,
  ChannelDetailsSchema,
  ChannelUpdateSchema,
  ChannelMembersSchema,
  ChannelArchiveSchema,

  // Messaging schemas
  MessageSendSchema,
  MessageListSchema,
  MessageUpdateSchema,
  MessageDeleteSchema,
  MessageReactionSchema,
  MessagePinSchema,
  ThreadCreateSchema,
  ThreadListSchema,
  SendMessageSchema,
  GetMessagesSchema,
  GetThreadSchema,
  ReplyToThreadSchema,
  EditMessageSchema,
  DeleteMessageSchema,
  AddReactionSchema,
  RemoveReactionSchema,
  GetDMChannelsSchema,
  CreateDMSchema,

  // File schemas
  FileUploadSchema,
  FileListSchema,
  FileDetailsSchema,
  FileDownloadSchema,
  FileDeleteSchema,

  // User schemas
  UserListSchema,
  UserDetailsSchema,
  UserPresenceSchema,
  UserProfileSchema,

  // Search schemas
  GlobalSearchSchema,
  CommandPaletteSchema,

  // Orchestrator schemas
  OrchestratorHandoffSchema,
  OrchestratorDelegateSchema,
  OrchestratorCollaborateSchema,
  OrchestratorAnalyticsSchema,
  OrchestratorConflictsSchema,

  // Registry and helpers
  NeolithToolSchemas,
  zodToJsonSchema,
  getNeolithToolJsonSchema,
  getAllNeolithToolJsonSchemas,
} from './tools';

// =============================================================================
// API Client Exports
// =============================================================================

export {
  NeolithApiClient,
  createNeolithApiClient,
} from './lib/api-client';

export type {
  NeolithApiClientConfig,
} from './lib/api-client';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Server types
  NeolithMCPServerOptions,
  NeolithMCPServerConfig,
  NeolithAPIClient,
  NeolithMCPServerStatus,

  // Base MCP types
  Logger,
  LogLevel,
  Tool,
  ToolHandler,
  ToolRegistration,
  ToolContext,
  ToolCallResult,
  ToolContent,
  TextContent,
  ImageContent,
  ServerCapabilities,
  MCPServerConfig,

  // Registry types
  McpTool,
  McpToolResult,
  ToolRegistrationOptions,
  ToolExecutionContext,

  // Domain types
  NeolithWorkspace,
  NeolithChannel,
  NeolithMessage,
  NeolithFile,
  NeolithUser,
  NeolithSearchResult,
  PaginationParams,
  PaginatedResponse,
  NeolithAPIError,

  // Workspace types
  WorkspaceRole,
  WorkspaceMember,
  Workspace,
  WorkspaceSettings,
  WorkspaceInvite,

  // Schema input types
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

  // Workspace tool types
  ListWorkspacesInput,
  GetWorkspaceInput,
  GetWorkspaceMembersInput,
  GetWorkspaceSettingsInput,
  UpdateWorkspaceInput,
  CreateInviteInput,
  SearchWorkspaceInput,

  // Channel tool types
  ListChannelsInput,
  GetChannelInput,
  CreateChannelInput,
  UpdateChannelInput,
  ArchiveChannelInput,
  JoinChannelInput,
  LeaveChannelInput,
  GetChannelMembersInput,

  // Messaging tool types
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

  // File tool types
  ListFilesInput,
  UploadFileInput,
  DownloadFileInput,
  ShareFileInput,
  DeleteFileInput,
  GetFileInfoInput,

  // User tool types
  GetCurrentUserInput,
  CurrentUserProfile,
  GetUserInput,
  UserProfile,
  SearchUsersInput,
  UserSearchResult,
  SearchUsersResponse,
  UpdateProfileInput,
  SetPresenceInput,
  PresenceStatus,
  UserPresenceResponse,
  UserToolName,

  // Search tool types
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

  // Orchestrator tool types
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
} from './types';

// Type guards and utilities
export {
  isSuccessResult,
  isErrorResult,
  unwrapResult,
} from './types';

// =============================================================================
// Package Metadata
// =============================================================================

/**
 * Package version
 */
export const VERSION = '1.0.0';

/**
 * Package name
 */
export const PACKAGE_NAME = '@wundr.io/neolith-mcp-server';

/**
 * MCP server capabilities
 */
export const MCP_CAPABILITIES = {
  tools: true,
  resources: true,
  prompts: false,
} as const;

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG = {
  timeout: 30000,
  debugApi: false,
} as const;
