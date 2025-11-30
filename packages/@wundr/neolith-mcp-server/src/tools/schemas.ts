/**
 * Zod Schema definitions for all Neolith MCP tools
 * Organized by functional category
 *
 * @module @wundr/neolith-mcp-server/tools/schemas
 */

import { z } from 'zod';

// ============================================================================
// Common Schema Types
// ============================================================================

/**
 * Common options shared across multiple tools
 */
export const CommonOptionsSchema = z.object({
  verbose: z.boolean().optional().describe('Enable verbose output'),
  format: z.enum(['json', 'table', 'text']).optional().describe('Output format'),
});

// ============================================================================
// Workspace Tool Schemas
// ============================================================================

/**
 * Schema for workspace-list tool
 */
export const WorkspaceListSchema = z.object({
  userId: z.string().optional().describe('Filter by user ID'),
  includeArchived: z.boolean().optional().default(false).describe('Include archived workspaces'),
  format: z.enum(['json', 'table']).optional().default('table').describe('Output format'),
});

export type WorkspaceListInput = z.infer<typeof WorkspaceListSchema>;

/**
 * Schema for workspace-create tool
 */
export const WorkspaceCreateSchema = z.object({
  name: z.string().min(1).describe('Workspace name'),
  slug: z.string().min(1).describe('Workspace slug (URL-friendly identifier)'),
  description: z.string().optional().describe('Workspace description'),
  isPrivate: z.boolean().optional().default(false).describe('Whether workspace is private'),
  ownerId: z.string().optional().describe('Owner user ID (defaults to current user)'),
});

export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateSchema>;

/**
 * Schema for workspace-details tool
 */
export const WorkspaceDetailsSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  includeMembers: z.boolean().optional().default(true).describe('Include member list'),
  includeChannels: z.boolean().optional().default(true).describe('Include channel list'),
  includeStats: z.boolean().optional().default(true).describe('Include statistics'),
});

export type WorkspaceDetailsInput = z.infer<typeof WorkspaceDetailsSchema>;

/**
 * Schema for workspace-update tool
 */
export const WorkspaceUpdateSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  name: z.string().optional().describe('New workspace name'),
  description: z.string().optional().describe('New workspace description'),
  isPrivate: z.boolean().optional().describe('Update privacy setting'),
});

export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateSchema>;

/**
 * Schema for workspace-members tool
 */
export const WorkspaceMembersSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  action: z.enum(['list', 'add', 'remove', 'update-role']).describe('Action to perform'),
  userId: z.string().optional().describe('User ID for add/remove/update actions'),
  role: z.enum(['owner', 'admin', 'member', 'guest']).optional().describe('User role for add/update actions'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive members'),
});

export type WorkspaceMembersInput = z.infer<typeof WorkspaceMembersSchema>;

// ============================================================================
// Channel Tool Schemas
// ============================================================================

/**
 * Schema for channel-list tool
 */
export const ChannelListSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  type: z.enum(['public', 'private', 'dm', 'all']).optional().default('all').describe('Channel type filter'),
  includeArchived: z.boolean().optional().default(false).describe('Include archived channels'),
  userId: z.string().optional().describe('Filter by user membership'),
});

export type ChannelListInput = z.infer<typeof ChannelListSchema>;

/**
 * Schema for channel-create tool
 */
export const ChannelCreateSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  name: z.string().min(1).describe('Channel name'),
  description: z.string().optional().describe('Channel description'),
  isPrivate: z.boolean().optional().default(false).describe('Whether channel is private'),
  memberIds: z.array(z.string()).optional().describe('Initial member user IDs'),
});

export type ChannelCreateInput = z.infer<typeof ChannelCreateSchema>;

/**
 * Schema for channel-details tool
 */
export const ChannelDetailsSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  includeMembers: z.boolean().optional().default(true).describe('Include member list'),
  includeStats: z.boolean().optional().default(true).describe('Include statistics'),
  includePins: z.boolean().optional().default(false).describe('Include pinned messages'),
});

export type ChannelDetailsInput = z.infer<typeof ChannelDetailsSchema>;

/**
 * Schema for channel-update tool
 */
export const ChannelUpdateSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  name: z.string().optional().describe('New channel name'),
  description: z.string().optional().describe('New channel description'),
  topic: z.string().optional().describe('Channel topic'),
  isPrivate: z.boolean().optional().describe('Update privacy setting'),
});

export type ChannelUpdateInput = z.infer<typeof ChannelUpdateSchema>;

/**
 * Schema for channel-members tool
 */
export const ChannelMembersSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  action: z.enum(['list', 'add', 'remove']).describe('Action to perform'),
  userIds: z.array(z.string()).optional().describe('User IDs for add/remove actions'),
});

export type ChannelMembersInput = z.infer<typeof ChannelMembersSchema>;

/**
 * Schema for channel-archive tool
 */
export const ChannelArchiveSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  archive: z.boolean().describe('True to archive, false to unarchive'),
});

export type ChannelArchiveInput = z.infer<typeof ChannelArchiveSchema>;

// ============================================================================
// Messaging Tool Schemas
// ============================================================================

/**
 * Schema for message-send tool
 */
export const MessageSendSchema = z.object({
  channelId: z.string().describe('Channel ID to send message to'),
  content: z.string().min(1).describe('Message content'),
  threadId: z.string().optional().describe('Thread ID for threaded messages'),
  fileIds: z.array(z.string()).optional().describe('Attached file IDs'),
  mentions: z.array(z.string()).optional().describe('User IDs to mention'),
});

export type MessageSendInput = z.infer<typeof MessageSendSchema>;

/**
 * Schema for message-list tool
 */
export const MessageListSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of messages'),
  before: z.string().optional().describe('Message ID to fetch messages before'),
  after: z.string().optional().describe('Message ID to fetch messages after'),
  threadId: z.string().optional().describe('Filter by thread ID'),
  search: z.string().optional().describe('Search query'),
});

export type MessageListInput = z.infer<typeof MessageListSchema>;

/**
 * Schema for message-update tool
 */
export const MessageUpdateSchema = z.object({
  messageId: z.string().describe('Message ID'),
  content: z.string().optional().describe('New message content'),
});

export type MessageUpdateInput = z.infer<typeof MessageUpdateSchema>;

/**
 * Schema for message-delete tool
 */
export const MessageDeleteSchema = z.object({
  messageId: z.string().describe('Message ID'),
});

export type MessageDeleteInput = z.infer<typeof MessageDeleteSchema>;

/**
 * Schema for message-reaction tool
 */
export const MessageReactionSchema = z.object({
  messageId: z.string().describe('Message ID'),
  action: z.enum(['add', 'remove', 'list']).describe('Reaction action'),
  emoji: z.string().optional().describe('Emoji for add/remove actions'),
  userId: z.string().optional().describe('User ID for remove action'),
});

export type MessageReactionInput = z.infer<typeof MessageReactionSchema>;

/**
 * Schema for message-pin tool
 */
export const MessagePinSchema = z.object({
  messageId: z.string().describe('Message ID'),
  pin: z.boolean().describe('True to pin, false to unpin'),
});

export type MessagePinInput = z.infer<typeof MessagePinSchema>;

/**
 * Schema for thread-create tool
 */
export const ThreadCreateSchema = z.object({
  messageId: z.string().describe('Parent message ID'),
  content: z.string().min(1).describe('First thread message content'),
});

export type ThreadCreateInput = z.infer<typeof ThreadCreateSchema>;

/**
 * Schema for thread-list tool
 */
export const ThreadListSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  limit: z.number().int().positive().optional().default(20).describe('Maximum number of threads'),
  includeResolved: z.boolean().optional().default(false).describe('Include resolved threads'),
});

export type ThreadListInput = z.infer<typeof ThreadListSchema>;

// ============================================================================
// File Tool Schemas
// ============================================================================

/**
 * Schema for file-upload tool
 */
export const FileUploadSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  channelId: z.string().optional().describe('Channel ID (for channel-specific files)'),
  filePath: z.string().describe('Local file path to upload'),
  fileName: z.string().optional().describe('Override file name'),
  description: z.string().optional().describe('File description'),
});

export type FileUploadInput = z.infer<typeof FileUploadSchema>;

/**
 * Schema for file-list tool
 */
export const FileListSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  channelId: z.string().optional().describe('Filter by channel ID'),
  userId: z.string().optional().describe('Filter by uploader user ID'),
  fileType: z.enum(['image', 'video', 'audio', 'document', 'all']).optional().default('all').describe('File type filter'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of files'),
  search: z.string().optional().describe('Search query'),
});

export type FileListInput = z.infer<typeof FileListSchema>;

/**
 * Schema for file-details tool
 */
export const FileDetailsSchema = z.object({
  fileId: z.string().describe('File ID'),
  includeMetadata: z.boolean().optional().default(true).describe('Include file metadata'),
  includeUsage: z.boolean().optional().default(true).describe('Include usage information'),
});

export type FileDetailsInput = z.infer<typeof FileDetailsSchema>;

/**
 * Schema for file-download tool
 */
export const FileDownloadSchema = z.object({
  fileId: z.string().describe('File ID'),
  outputPath: z.string().describe('Local path to save file'),
});

export type FileDownloadInput = z.infer<typeof FileDownloadSchema>;

/**
 * Schema for file-delete tool
 */
export const FileDeleteSchema = z.object({
  fileId: z.string().describe('File ID'),
});

export type FileDeleteInput = z.infer<typeof FileDeleteSchema>;

// ============================================================================
// User Tool Schemas
// ============================================================================

/**
 * Schema for user-list tool
 */
export const UserListSchema = z.object({
  workspaceSlug: z.string().optional().describe('Filter by workspace slug'),
  status: z.enum(['active', 'away', 'busy', 'offline', 'all']).optional().default('all').describe('User status filter'),
  search: z.string().optional().describe('Search query'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of users'),
});

export type UserListInput = z.infer<typeof UserListSchema>;

/**
 * Schema for user-details tool
 */
export const UserDetailsSchema = z.object({
  userId: z.string().describe('User ID'),
  includePresence: z.boolean().optional().default(true).describe('Include presence information'),
  includeWorkspaces: z.boolean().optional().default(true).describe('Include workspace memberships'),
});

export type UserDetailsInput = z.infer<typeof UserDetailsSchema>;

/**
 * Schema for user-presence tool
 */
export const UserPresenceSchema = z.object({
  userId: z.string().describe('User ID'),
  status: z.enum(['active', 'away', 'busy', 'offline']).optional().describe('Set user status'),
  customMessage: z.string().optional().describe('Custom status message'),
});

export type UserPresenceInput = z.infer<typeof UserPresenceSchema>;

/**
 * Schema for user-profile tool
 */
export const UserProfileSchema = z.object({
  userId: z.string().describe('User ID'),
  displayName: z.string().optional().describe('Update display name'),
  bio: z.string().optional().describe('Update bio'),
  avatarUrl: z.string().optional().describe('Update avatar URL'),
});

export type UserProfileInput = z.infer<typeof UserProfileSchema>;

// ============================================================================
// Search Tool Schemas
// ============================================================================

/**
 * Schema for global-search tool
 */
export const GlobalSearchSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug to search in'),
  query: z.string().min(1).describe('Search query'),
  type: z.enum(['messages', 'files', 'users', 'channels', 'all']).optional().default('all').describe('Search type filter'),
  channelId: z.string().optional().describe('Filter by channel ID'),
  userId: z.string().optional().describe('Filter by user ID'),
  dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
  dateTo: z.string().optional().describe('End date (ISO 8601)'),
  limit: z.number().int().positive().optional().default(20).describe('Maximum number of results'),
});

export type GlobalSearchInput = z.infer<typeof GlobalSearchSchema>;

/**
 * Schema for command-palette tool
 */
export const CommandPaletteSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug'),
  query: z.string().optional().describe('Filter commands by query'),
  category: z.enum(['navigation', 'actions', 'settings', 'all']).optional().default('all').describe('Command category'),
});

export type CommandPaletteInput = z.infer<typeof CommandPaletteSchema>;

// ============================================================================
// Orchestrator Tool Schemas
// ============================================================================

/**
 * Schema for orchestrator-handoff tool
 */
export const OrchestratorHandoffSchema = z.object({
  orchestratorId: z.string().describe('Source orchestrator ID'),
  targetOrchestrator: z.string().describe('Target orchestrator identifier'),
  context: z.record(z.unknown()).describe('Context data to pass'),
  taskId: z.string().optional().describe('Specific task to handoff'),
  reason: z.string().optional().describe('Reason for handoff'),
});

export type OrchestratorHandoffInput = z.infer<typeof OrchestratorHandoffSchema>;

/**
 * Schema for orchestrator-delegate tool
 */
export const OrchestratorDelegateSchema = z.object({
  orchestratorId: z.string().describe('Orchestrator ID'),
  taskType: z.string().describe('Type of task to delegate'),
  taskData: z.record(z.unknown()).describe('Task data payload'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium').describe('Task priority'),
  deadline: z.string().optional().describe('Task deadline (ISO 8601)'),
});

export type OrchestratorDelegateInput = z.infer<typeof OrchestratorDelegateSchema>;

/**
 * Schema for orchestrator-collaborate tool
 */
export const OrchestratorCollaborateSchema = z.object({
  orchestratorId: z.string().describe('Primary orchestrator ID'),
  collaboratorIds: z.array(z.string()).min(1).describe('Collaborating orchestrator IDs'),
  collaborationType: z.enum(['parallel', 'sequential', 'consensus']).describe('Type of collaboration'),
  taskData: z.record(z.unknown()).describe('Shared task data'),
  timeout: z.number().int().positive().optional().describe('Collaboration timeout in seconds'),
});

export type OrchestratorCollaborateInput = z.infer<typeof OrchestratorCollaborateSchema>;

/**
 * Schema for orchestrator-analytics tool
 */
export const OrchestratorAnalyticsSchema = z.object({
  orchestratorId: z.string().optional().describe('Orchestrator ID (omit for all)'),
  metricType: z.enum(['performance', 'errors', 'tasks', 'handoffs', 'all']).optional().default('all').describe('Metric type'),
  timeRange: z.enum(['1h', '24h', '7d', '30d', 'all']).optional().default('24h').describe('Time range'),
  includeBreakdown: z.boolean().optional().default(false).describe('Include detailed breakdown'),
});

export type OrchestratorAnalyticsInput = z.infer<typeof OrchestratorAnalyticsSchema>;

/**
 * Schema for orchestrator-conflicts tool
 */
export const OrchestratorConflictsSchema = z.object({
  status: z.enum(['pending', 'resolved', 'all']).optional().default('pending').describe('Conflict status filter'),
  orchestratorId: z.string().optional().describe('Filter by orchestrator ID'),
  limit: z.number().int().positive().optional().default(20).describe('Maximum number of conflicts'),
});

export type OrchestratorConflictsInput = z.infer<typeof OrchestratorConflictsSchema>;

// ============================================================================
// Session Manager Tool Schemas
// ============================================================================

/**
 * Schema for session-manager-list tool
 */
export const SessionManagerListSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug to list session managers from'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().describe('Filter by session manager status'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type SessionManagerListInput = z.infer<typeof SessionManagerListSchema>;

/**
 * Schema for session-manager-get tool
 */
export const SessionManagerGetSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to fetch'),
});

export type SessionManagerGetInput = z.infer<typeof SessionManagerGetSchema>;

/**
 * Schema for session-manager-create tool
 */
export const SessionManagerCreateSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug to create session manager in'),
  name: z.string().min(1).describe('Session manager name'),
  description: z.string().optional().describe('Session manager description'),
  configuration: z.record(z.unknown()).optional().describe('Session manager configuration'),
  orchestratorId: z.string().optional().describe('Associated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().default('ACTIVE').describe('Initial status'),
});

export type SessionManagerCreateInput = z.infer<typeof SessionManagerCreateSchema>;

/**
 * Schema for session-manager-update tool
 */
export const SessionManagerUpdateSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to update'),
  name: z.string().min(1).optional().describe('Updated session manager name'),
  description: z.string().optional().describe('Updated session manager description'),
  configuration: z.record(z.unknown()).optional().describe('Updated session manager configuration'),
  orchestratorId: z.string().optional().describe('Updated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().describe('Updated status'),
});

export type SessionManagerUpdateInput = z.infer<typeof SessionManagerUpdateSchema>;

/**
 * Schema for session-manager-activate tool
 */
export const SessionManagerActivateSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to activate'),
  configuration: z.record(z.unknown()).optional().describe('Optional activation configuration'),
});

export type SessionManagerActivateInput = z.infer<typeof SessionManagerActivateSchema>;

/**
 * Schema for session-manager-deactivate tool
 */
export const SessionManagerDeactivateSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to deactivate'),
  reason: z.string().optional().describe('Optional reason for deactivation'),
});

export type SessionManagerDeactivateInput = z.infer<typeof SessionManagerDeactivateSchema>;

// ============================================================================
// Subagent Tool Schemas
// ============================================================================

/**
 * Schema for subagent-list tool
 */
export const SubagentListSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to list subagents from'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().describe('Filter by subagent status'),
  type: z.string().optional().describe('Filter by subagent type'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status', 'type']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type SubagentListInput = z.infer<typeof SubagentListSchema>;

/**
 * Schema for subagent-get tool
 */
export const SubagentGetSchema = z.object({
  subagentId: z.string().describe('The subagent ID to fetch'),
  includeStatistics: z.boolean().optional().default(true).describe('Include statistics'),
  includeTasks: z.boolean().optional().default(false).describe('Include recent tasks'),
});

export type SubagentGetInput = z.infer<typeof SubagentGetSchema>;

/**
 * Schema for subagent-create tool
 */
export const SubagentCreateSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to create subagent for'),
  name: z.string().min(1).describe('Subagent name'),
  description: z.string().optional().describe('Subagent description'),
  type: z.string().describe('Subagent type (e.g., "task-executor", "data-processor", "analyzer")'),
  configuration: z.record(z.unknown()).optional().describe('Subagent configuration'),
  capabilities: z.array(z.string()).optional().describe('List of subagent capabilities'),
  orchestratorId: z.string().optional().describe('Associated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().default('ACTIVE').describe('Initial status'),
});

export type SubagentCreateInput = z.infer<typeof SubagentCreateSchema>;

/**
 * Schema for subagent-update tool
 */
export const SubagentUpdateSchema = z.object({
  subagentId: z.string().describe('The subagent ID to update'),
  name: z.string().min(1).optional().describe('Updated subagent name'),
  description: z.string().optional().describe('Updated subagent description'),
  type: z.string().optional().describe('Updated subagent type'),
  configuration: z.record(z.unknown()).optional().describe('Updated subagent configuration'),
  capabilities: z.array(z.string()).optional().describe('Updated list of capabilities'),
  orchestratorId: z.string().optional().describe('Updated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().describe('Updated status'),
});

export type SubagentUpdateInput = z.infer<typeof SubagentUpdateSchema>;

/**
 * Schema for universal-subagents-list tool
 */
export const UniversalSubagentListSchema = z.object({
  category: z.string().optional().describe('Filter by category'),
  type: z.string().optional().describe('Filter by subagent type'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['name', 'category', 'type', 'popularity']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
});

export type UniversalSubagentListInput = z.infer<typeof UniversalSubagentListSchema>;

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Workspace tool schemas
 */
export const WorkspaceToolSchemas = {
  'workspace-list': WorkspaceListSchema,
  'workspace-create': WorkspaceCreateSchema,
  'workspace-details': WorkspaceDetailsSchema,
  'workspace-update': WorkspaceUpdateSchema,
  'workspace-members': WorkspaceMembersSchema,
} as const;

/**
 * Channel tool schemas
 */
export const ChannelToolSchemas = {
  'channel-list': ChannelListSchema,
  'channel-create': ChannelCreateSchema,
  'channel-details': ChannelDetailsSchema,
  'channel-update': ChannelUpdateSchema,
  'channel-members': ChannelMembersSchema,
  'channel-archive': ChannelArchiveSchema,
} as const;

/**
 * Messaging tool schemas
 */
export const MessagingToolSchemas = {
  'message-send': MessageSendSchema,
  'message-list': MessageListSchema,
  'message-update': MessageUpdateSchema,
  'message-delete': MessageDeleteSchema,
  'message-reaction': MessageReactionSchema,
  'message-pin': MessagePinSchema,
  'thread-create': ThreadCreateSchema,
  'thread-list': ThreadListSchema,
} as const;

/**
 * File tool schemas
 */
export const FileToolSchemas = {
  'file-upload': FileUploadSchema,
  'file-list': FileListSchema,
  'file-details': FileDetailsSchema,
  'file-download': FileDownloadSchema,
  'file-delete': FileDeleteSchema,
} as const;

/**
 * User tool schemas
 */
export const UserToolSchemas = {
  'user-list': UserListSchema,
  'user-details': UserDetailsSchema,
  'user-presence': UserPresenceSchema,
  'user-profile': UserProfileSchema,
} as const;

/**
 * Search tool schemas
 */
export const SearchToolSchemas = {
  'global-search': GlobalSearchSchema,
  'command-palette': CommandPaletteSchema,
} as const;

/**
 * Orchestrator tool schemas
 */
export const OrchestratorToolSchemas = {
  'orchestrator-handoff': OrchestratorHandoffSchema,
  'orchestrator-delegate': OrchestratorDelegateSchema,
  'orchestrator-collaborate': OrchestratorCollaborateSchema,
  'orchestrator-analytics': OrchestratorAnalyticsSchema,
  'orchestrator-conflicts': OrchestratorConflictsSchema,
} as const;

/**
 * Session Manager tool schemas
 */
export const SessionManagerToolSchemas = {
  'session-manager-list': SessionManagerListSchema,
  'session-manager-get': SessionManagerGetSchema,
  'session-manager-create': SessionManagerCreateSchema,
  'session-manager-update': SessionManagerUpdateSchema,
  'session-manager-activate': SessionManagerActivateSchema,
  'session-manager-deactivate': SessionManagerDeactivateSchema,
} as const;

/**
 * Subagent tool schemas
 */
export const SubagentToolSchemas = {
  'subagent-list': SubagentListSchema,
  'subagent-get': SubagentGetSchema,
  'subagent-create': SubagentCreateSchema,
  'subagent-update': SubagentUpdateSchema,
  'universal-subagents-list': UniversalSubagentListSchema,
} as const;

/**
 * Registry of all Neolith tool schemas with metadata
 */
export const NeolithToolSchemas = {
  // Workspace tools
  'workspace-list': {
    schema: WorkspaceListSchema,
    description: 'List all workspaces accessible to the user',
    category: 'workspace',
  },
  'workspace-create': {
    schema: WorkspaceCreateSchema,
    description: 'Create a new workspace',
    category: 'workspace',
  },
  'workspace-details': {
    schema: WorkspaceDetailsSchema,
    description: 'Get detailed information about a workspace',
    category: 'workspace',
  },
  'workspace-update': {
    schema: WorkspaceUpdateSchema,
    description: 'Update workspace settings',
    category: 'workspace',
  },
  'workspace-members': {
    schema: WorkspaceMembersSchema,
    description: 'Manage workspace members',
    category: 'workspace',
  },

  // Channel tools
  'channel-list': {
    schema: ChannelListSchema,
    description: 'List channels in a workspace',
    category: 'channels',
  },
  'channel-create': {
    schema: ChannelCreateSchema,
    description: 'Create a new channel',
    category: 'channels',
  },
  'channel-details': {
    schema: ChannelDetailsSchema,
    description: 'Get detailed information about a channel',
    category: 'channels',
  },
  'channel-update': {
    schema: ChannelUpdateSchema,
    description: 'Update channel settings',
    category: 'channels',
  },
  'channel-members': {
    schema: ChannelMembersSchema,
    description: 'Manage channel members',
    category: 'channels',
  },
  'channel-archive': {
    schema: ChannelArchiveSchema,
    description: 'Archive or unarchive a channel',
    category: 'channels',
  },

  // Messaging tools
  'message-send': {
    schema: MessageSendSchema,
    description: 'Send a message to a channel',
    category: 'messaging',
  },
  'message-list': {
    schema: MessageListSchema,
    description: 'List messages in a channel or thread',
    category: 'messaging',
  },
  'message-update': {
    schema: MessageUpdateSchema,
    description: 'Update a message',
    category: 'messaging',
  },
  'message-delete': {
    schema: MessageDeleteSchema,
    description: 'Delete a message',
    category: 'messaging',
  },
  'message-reaction': {
    schema: MessageReactionSchema,
    description: 'Manage message reactions',
    category: 'messaging',
  },
  'message-pin': {
    schema: MessagePinSchema,
    description: 'Pin or unpin a message',
    category: 'messaging',
  },
  'thread-create': {
    schema: ThreadCreateSchema,
    description: 'Create a new thread from a message',
    category: 'messaging',
  },
  'thread-list': {
    schema: ThreadListSchema,
    description: 'List threads in a channel',
    category: 'messaging',
  },

  // File tools
  'file-upload': {
    schema: FileUploadSchema,
    description: 'Upload a file to a workspace or channel',
    category: 'files',
  },
  'file-list': {
    schema: FileListSchema,
    description: 'List files in a workspace or channel',
    category: 'files',
  },
  'file-details': {
    schema: FileDetailsSchema,
    description: 'Get detailed information about a file',
    category: 'files',
  },
  'file-download': {
    schema: FileDownloadSchema,
    description: 'Download a file',
    category: 'files',
  },
  'file-delete': {
    schema: FileDeleteSchema,
    description: 'Delete a file',
    category: 'files',
  },

  // User tools
  'user-list': {
    schema: UserListSchema,
    description: 'List users in a workspace',
    category: 'users',
  },
  'user-details': {
    schema: UserDetailsSchema,
    description: 'Get detailed information about a user',
    category: 'users',
  },
  'user-presence': {
    schema: UserPresenceSchema,
    description: 'Get or set user presence status',
    category: 'users',
  },
  'user-profile': {
    schema: UserProfileSchema,
    description: 'Update user profile',
    category: 'users',
  },

  // Search tools
  'global-search': {
    schema: GlobalSearchSchema,
    description: 'Search across messages, files, users, and channels',
    category: 'search',
  },
  'command-palette': {
    schema: CommandPaletteSchema,
    description: 'Access command palette commands',
    category: 'search',
  },

  // Orchestrator tools
  'orchestrator-handoff': {
    schema: OrchestratorHandoffSchema,
    description: 'Handoff task execution between orchestrators',
    category: 'orchestrators',
  },
  'orchestrator-delegate': {
    schema: OrchestratorDelegateSchema,
    description: 'Delegate a task to an orchestrator',
    category: 'orchestrators',
  },
  'orchestrator-collaborate': {
    schema: OrchestratorCollaborateSchema,
    description: 'Enable collaboration between orchestrators',
    category: 'orchestrators',
  },
  'orchestrator-analytics': {
    schema: OrchestratorAnalyticsSchema,
    description: 'Get orchestrator performance analytics',
    category: 'orchestrators',
  },
  'orchestrator-conflicts': {
    schema: OrchestratorConflictsSchema,
    description: 'List and manage orchestrator conflicts',
    category: 'orchestrators',
  },

  // Session Manager tools
  'session-manager-list': {
    schema: SessionManagerListSchema,
    description: 'List all session managers in a workspace',
    category: 'session-managers',
  },
  'session-manager-get': {
    schema: SessionManagerGetSchema,
    description: 'Get details for a specific session manager',
    category: 'session-managers',
  },
  'session-manager-create': {
    schema: SessionManagerCreateSchema,
    description: 'Create a new session manager',
    category: 'session-managers',
  },
  'session-manager-update': {
    schema: SessionManagerUpdateSchema,
    description: 'Update an existing session manager',
    category: 'session-managers',
  },
  'session-manager-activate': {
    schema: SessionManagerActivateSchema,
    description: 'Activate a session manager',
    category: 'session-managers',
  },
  'session-manager-deactivate': {
    schema: SessionManagerDeactivateSchema,
    description: 'Deactivate a session manager',
    category: 'session-managers',
  },

  // Subagent tools
  'subagent-list': {
    schema: SubagentListSchema,
    description: 'List all subagents for a session manager',
    category: 'subagents',
  },
  'subagent-get': {
    schema: SubagentGetSchema,
    description: 'Get details for a specific subagent',
    category: 'subagents',
  },
  'subagent-create': {
    schema: SubagentCreateSchema,
    description: 'Create a new subagent',
    category: 'subagents',
  },
  'subagent-update': {
    schema: SubagentUpdateSchema,
    description: 'Update an existing subagent',
    category: 'subagents',
  },
  'universal-subagents-list': {
    schema: UniversalSubagentListSchema,
    description: 'List all universal subagent templates',
    category: 'subagents',
  },
} as const;

export type NeolithToolName = keyof typeof NeolithToolSchemas;

/**
 * Convert Zod schema to JSON Schema for MCP tool registration
 */
export function zodToJsonSchema(zodSchema: z.ZodType<any>): Record<string, unknown> {
  const shape = (zodSchema as z.ZodObject<any>)._def.shape?.();
  if (!shape) {
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodType<any>;
    const def = zodValue._def as any;

    let propertySchema: Record<string, unknown> = {};

    // Handle optional wrapper
    const isOptional = def.typeName === 'ZodOptional';
    const innerDef = isOptional ? def.innerType._def : def;

    // Get type info
    switch (innerDef.typeName) {
      case 'ZodString':
        propertySchema = { type: 'string' };
        if (innerDef.checks) {
          for (const check of innerDef.checks) {
            if (check.kind === 'min') {
              propertySchema['minLength'] = check.value;
            }
          }
        }
        break;
      case 'ZodNumber':
        propertySchema = { type: 'number' };
        if (innerDef.checks) {
          for (const check of innerDef.checks) {
            if (check.kind === 'int') {
              propertySchema['type'] = 'integer';
            } else if (check.kind === 'min') {
              propertySchema['minimum'] = check.value;
            }
          }
        }
        break;
      case 'ZodBoolean':
        propertySchema = { type: 'boolean' };
        break;
      case 'ZodEnum':
        propertySchema = { type: 'string', enum: innerDef.values };
        break;
      case 'ZodArray': {
        const itemType = innerDef.type._def;
        propertySchema = {
          type: 'array',
          items: itemType.typeName === 'ZodString' ? { type: 'string' } : { type: 'object' },
        };
        if (innerDef.minLength) {
          propertySchema['minItems'] = innerDef.minLength.value;
        }
        break;
      }
      case 'ZodRecord':
        propertySchema = { type: 'object', additionalProperties: true };
        break;
      case 'ZodDefault': {
        const innerSchema = zodToJsonSchema(innerDef.innerType);
        propertySchema = { ...innerSchema, default: innerDef.defaultValue() };
        break;
      }
      default:
        propertySchema = { type: 'string' };
    }

    // Add description if available
    if (def['description']) {
      propertySchema['description'] = def['description'];
    } else if (isOptional && (value as any)._def.innerType?._def?.['description']) {
      propertySchema['description'] = (value as any)._def.innerType._def['description'];
    }

    properties[key] = propertySchema;

    // Track required fields
    if (!isOptional && innerDef.typeName !== 'ZodDefault') {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Get JSON Schema for a specific Neolith tool
 */
export function getNeolithToolJsonSchema(toolName: NeolithToolName): Record<string, unknown> {
  const tool = NeolithToolSchemas[toolName];
  return zodToJsonSchema(tool.schema);
}

/**
 * Get all Neolith tool JSON schemas
 */
export function getAllNeolithToolJsonSchemas(): Record<
  string,
  { schema: Record<string, unknown>; description: string; category: string }
> {
  const result: Record<
    string,
    { schema: Record<string, unknown>; description: string; category: string }
  > = {};

  for (const [name, tool] of Object.entries(NeolithToolSchemas)) {
    result[name] = {
      schema: zodToJsonSchema(tool.schema),
      description: tool.description,
      category: tool.category,
    };
  }

  return result;
}
