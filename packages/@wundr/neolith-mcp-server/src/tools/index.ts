/**
 * Neolith MCP Tools - Central Export Module
 *
 * Consolidates all Neolith MCP tools organized by category.
 * Provides convenient access to all tool definitions, handlers, and schemas.
 *
 * @module @wundr.io/neolith-mcp-server/tools
 */

// =============================================================================
// Tool Registry and Base Types
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
} from './registry';

export type {
  McpTool,
  McpToolResult,
  ToolRegistrationOptions,
  ToolExecutionContext,
} from './registry';

export type {
  NeolithApiClient,
  ToolExecutionContext as ExecutionContext,
} from './types';

// =============================================================================
// Zod Schemas
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
} from './schemas';

export type {
  NeolithToolName,
} from './schemas';

// =============================================================================
// Workspace Tools
// =============================================================================

export {
  listWorkspacesTool,
  getWorkspaceTool,
  getWorkspaceMembersTool,
  getWorkspaceSettingsTool,
  updateWorkspaceTool,
  createInviteTool,
  searchWorkspaceTool,
  workspaceTools,
  workspaceToolsMap,
} from './workspace';

export type {
  ListWorkspacesInput,
  GetWorkspaceInput,
  GetWorkspaceMembersInput,
  GetWorkspaceSettingsInput,
  UpdateWorkspaceInput,
  CreateInviteInput,
  SearchWorkspaceInput,
} from './workspace';

// =============================================================================
// Channel Tools
// =============================================================================

export {
  listChannelsTool,
  getChannelTool,
  createChannelTool,
  updateChannelTool,
  archiveChannelTool,
  joinChannelTool,
  leaveChannelTool,
  getChannelMembersTool,
  channelTools,
  CHANNEL_TOOL_NAMES,
  CHANNEL_TOOL_DESCRIPTIONS,
} from './channels';

export type {
  ListChannelsInput,
  GetChannelInput,
  CreateChannelInput,
  UpdateChannelInput,
  ArchiveChannelInput,
  JoinChannelInput,
  LeaveChannelInput,
  GetChannelMembersInput,
} from './channels';

// =============================================================================
// Messaging Tools
// =============================================================================

export {
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
} from './messaging';

export {
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
} from './messaging';

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
} from './messaging';

// =============================================================================
// File Tools
// =============================================================================

export {
  listFilesHandler,
  listFilesTool,
  ListFilesInputSchema,
  uploadFileHandler,
  uploadFileTool,
  UploadFileInputSchema,
  downloadFileHandler,
  downloadFileTool,
  DownloadFileInputSchema,
  shareFileHandler,
  shareFileTool,
  ShareFileInputSchema,
  deleteFileHandler,
  deleteFileTool,
  DeleteFileInputSchema,
  getFileInfoHandler,
  getFileInfoTool,
  GetFileInfoInputSchema,
  fileTools,
  fileHandlers,
} from './files';

export type {
  ListFilesInput,
  UploadFileInput,
  DownloadFileInput,
  ShareFileInput,
  DeleteFileInput,
  GetFileInfoInput,
} from './files';

// =============================================================================
// User Tools
// =============================================================================

export {
  getCurrentUser,
  getCurrentUserTool,
  GetCurrentUserInputSchema,
  getUser,
  getUserTool,
  GetUserInputSchema,
  searchUsers,
  searchUsersTool,
  SearchUsersInputSchema,
  updateProfile,
  updateProfileTool,
  UpdateProfileInputSchema,
  setPresence,
  setPresenceTool,
  SetPresenceInputSchema,
  PresenceStatusSchema,
  USER_TOOLS,
} from './users';

export type {
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
} from './users';

// =============================================================================
// Search Tools
// =============================================================================

export {
  globalSearchHandler,
  globalSearchTool,
  messageSearchHandler,
  messageSearchTool,
  fileSearchHandler,
  fileSearchTool,
  searchTools,
  searchHandlers,
  searchSchemas,
} from './search';

export type {
  GlobalSearchInput,
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
} from './search';

// =============================================================================
// Orchestrator Tools
// =============================================================================

export {
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
} from './orchestrators';

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
} from './orchestrators';

// =============================================================================
// Federation Tools
// =============================================================================

export {
  listFederatedOrchestrators,
  listFederatedOrchestratorsInputSchema,
  delegateTask,
  delegateTaskInputSchema,
  getDelegationStatus,
  getDelegationStatusInputSchema,
  getClusterStatus,
  getClusterStatusInputSchema,
  migrateSession,
  migrateSessionInputSchema,
  federationHandlers,
  federationSchemas,
  FEDERATION_TOOL_NAMES,
  FEDERATION_TOOL_DESCRIPTIONS,
} from './federation';

export type {
  ListFederatedOrchestratorsInput,
  FederatedOrchestrator,
  FederatedOrchestratorCapabilities,
  FederatedOrchestratorMetrics,
  ListFederatedOrchestratorsResponse,
  DelegateTaskInput,
  DelegateTaskResponse,
  DelegationStatus,
  GetDelegationStatusInput,
  GetDelegationStatusResponse,
  DelegationStatusDetails,
  TaskResult,
  TaskExecutionLog,
  GetClusterStatusInput,
  GetClusterStatusResponse,
  ClusterNodeStatus,
  SessionInfo,
  ClusterMetrics,
  MigrateSessionInput,
  MigrateSessionResponse,
  MigrationDetails,
  MigrationPhase,
  SessionState,
} from './federation';

// =============================================================================
// Observability Tools
// =============================================================================

export {
  getSystemHealthTool,
  getOrchestratorMetricsTool,
  getActiveAlertsTool,
  acknowledgeAlertTool,
  getNodeStatusTool,
  observabilityTools,
  OBSERVABILITY_TOOL_NAMES,
  OBSERVABILITY_TOOL_DESCRIPTIONS,
} from './observability';

export type {
  GetSystemHealthInput,
  SystemHealthData,
  GetSystemHealthResponse,
  GetOrchestratorMetricsInput,
  OrchestratorMetricsData,
  MetricDataPoint,
  GetOrchestratorMetricsResponse,
  GetActiveAlertsInput,
  Alert,
  GetActiveAlertsResponse,
  AcknowledgeAlertInput,
  AcknowledgeAlertData,
  AcknowledgeAlertResponse,
  GetNodeStatusInput,
  NodeStatus as ObservabilityNodeStatus,
  GetNodeStatusResponse,
} from './observability';

// =============================================================================
// Combined Tool Collections
// =============================================================================

import { workspaceTools } from './workspace';
import { channelTools } from './channels';
import { fileTools } from './files';
import { USER_TOOLS } from './users';
import { searchTools } from './search';
import { observabilityTools } from './observability';

/**
 * All Neolith MCP tools combined into a single array
 * Use this for bulk registration of all tools
 */
export const allTools = [
  ...workspaceTools,
  ...channelTools,
  ...fileTools,
  ...USER_TOOLS,
  ...searchTools,
  ...observabilityTools,
] as const;

/**
 * Tool collections organized by category
 */
export const toolsByCategory = {
  workspace: workspaceTools,
  channels: channelTools,
  files: fileTools,
  users: USER_TOOLS,
  search: searchTools,
  observability: observabilityTools,
} as const;

/**
 * Get all tool names as an array
 */
export function getAllToolNames(): string[] {
  return allTools.map(tool => tool.name);
}

/**
 * Get tools by category name
 */
export function getToolsByCategory(category: keyof typeof toolsByCategory) {
  return toolsByCategory[category];
}

/**
 * Tool count statistics
 */
export const TOOL_STATS = {
  workspace: workspaceTools.length,
  channels: channelTools.length,
  files: fileTools.length,
  users: USER_TOOLS.length,
  search: searchTools.length,
  observability: observabilityTools.length,
  total: allTools.length,
} as const;
