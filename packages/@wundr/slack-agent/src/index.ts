/**
 * @wundr/slack-agent - Slack Agent Capabilities
 *
 * Provides comprehensive Slack integration capabilities for Orchestrator (Virtual Principal)
 * agents operating as full users in Slack workspaces.
 *
 * @packageDocumentation
 */

// =============================================================================
// Unified Slack User Agent (Primary Interface)
// =============================================================================

// Default export for convenience
export {
  // Factory functions
  createSlackUserAgent,
  createSlackUserAgentFromEnv,default, 
  type EventHandler,
  type HealthCheckResult,
  type SlackEvent,
  type SlackEventType,
  // Main class
  SlackUserAgent,
  type SlackUserAgentConfig,
  // Types
  type VPIdentity
} from './slack-user-agent.js';

// =============================================================================
// Individual Capability Modules
// =============================================================================


// Canvas Capabilities
export {
  type Canvas,
  type CanvasAccessLevel,
  type CanvasCapabilityConfig,
  type CanvasChange,
  type CanvasContent,
  CanvasError,
  // Errors
  CanvasNotSupportedError,
  // Types
  type CanvasOperation,
  type CanvasSection,
  type CanvasSectionType,
  createCanvasCapability,
  createCanvasCapabilityFromClient,
  type DocumentContent,
  type SectionLookupCriteria,
  SlackCanvasCapability,
} from './capabilities/canvas.js';
// Channel Membership Operations
export {
  // Types
  type Channel,
  type ChannelMember,
  ChannelMembershipManager,
  ChannelNotFoundError,
  type InviteResult,
  type ListChannelsOptions,
  type PaginatedChannelResponse,
  // Errors
  SlackPermissionError,
  UserNotFoundError,
} from './capabilities/channel-membership.js';
// DND (Do Not Disturb) Controls
export {
  createDndControlsManager,
  createDndControlsManagerFromToken,
  type DndControlsConfig,
  DndControlsManager,
  // Errors
  DndError,
  // Types
  type DndInfo,
  DndUserNotFoundError,
  type SnoozeDuration,
  SnoozeNotActiveError,
} from './capabilities/dnd-controls.js';
// File Operations
export {
  createFileOperations,
  type FileComment,
  type FileOperationsConfig,
  type FileReaction,
  type FileResult,
  type FileShares,
  type FileSource,
  type FileType,
  type ListFilesOptions,
  type SlackFile,
  SlackFileOperations,
  type UploadOptions,
} from './capabilities/file-operations.js';
// Proactive Messaging
export {
  type BlockKit as ProactiveBlockKit,
  type BlockKitElement as ProactiveBlockKitElement,
  createProactiveMessenger,
  createProactiveMessengerFromEnv,
  type MessageResult as ProactiveMessageResult,
  type PostOptions,
  ProactiveMessagingError,
  ProactiveMessagingErrorCode,
  ProactiveMessenger,
  type ProactiveMessengerConfig,
  type ScheduledMessage,
  type ScheduledMessageResult,
  type TokenType,
} from './capabilities/proactive-messaging.js';
// Profile Management
export {
  type CustomField,
  createProfileManager,
  ProfileError,
  type ProfileFieldValue,
  ProfileManager,
  type ProfileManagerConfig,
  type ProfileUpdate,
  type UserProfile,
} from './capabilities/profile-management.js';
// Reminders Capability
export {
  createReminderManager,
  createReminderManagerFromToken,
  InvalidReminderTimeError,
  // Types
  type Reminder,
  ReminderChannelNotFoundError,
  type ReminderDuration,
  // Errors
  ReminderError,
  ReminderManager,
  type ReminderManagerConfig,
  ReminderNotFoundError,
  ReminderUserNotFoundError,
} from './capabilities/reminders.js';
// Scheduled Messages
export {
  type BatchScheduleResult,
  // Types
  type Block as ScheduledMessageBlock,
  createScheduledMessagesManager,
  createScheduledMessagesManagerFromEnv,
  InvalidScheduleTimeError,
  type ListScheduledMessagesOptions,
  type PaginatedScheduledMessages,
  type ScheduledMessage as VPScheduledMessage,
  // Errors
  ScheduledMessageError,
  ScheduledMessageNotFoundError,
  type ScheduledMessagesConfig,
  ScheduledMessagesManager,
  type ScheduleMessageOptions,
  type TimeSpec,
} from './capabilities/scheduled-messages.js';
// Search Capabilities
export {
  type CombinedSearchResult,
  createSlackSearchCapability,
  type File,
  type FileSortField,
  type Message,
  type MessageAttachment,
  type MessageBlock,
  type MessageChannel,
  type MessageSortField,
  type PaginationInfo,
  type Reaction,
  type SearchModifiers,
  type SearchOptions,
  SearchRateLimitError,
  type SearchResult,
  SearchResultParseError,
  SlackSearchCapability,
  // Errors
  SlackSearchError,
  // Types
  type SortDirection,
  type ThreadInfo as SearchThreadInfo,
  type User,
  type UserProfile as SearchUserProfile,
} from './capabilities/search.js';
// Threading Capabilities
export {
  type BlockKit,
  type BlockKitElement,
  createThreadingCapability,
  type GetThreadRepliesOptions,
  type MessageResult,
  type PostMessageOptions,
  type SlackMessage,
  SlackThreadingCapability,
  type ThreadInfo,
} from './capabilities/threading.js';
// Usergroups Management
export {
  type CreateUsergroupOptions,
  createUsergroupManager,
  isNameConflictError,
  isNotFoundError as isUsergroupNotFoundError,
  isPermissionError as isUsergroupPermissionError,
  isRateLimitError as isUsergroupRateLimitError,
  isUsergroupManagementError,
  type ListUsergroupsOptions,
  // Types
  type Usergroup,
  UsergroupErrorCode,
  UsergroupManagementError,
  UsergroupManager,
  type UsergroupManagerConfig,
  type UsergroupUpdate,
} from './capabilities/usergroups.js';

// Workflow Capabilities
export {
  createWorkflowCapability,
  createWorkflowCapabilityFromEnv,
  SlackWorkflowCapability,
  type WebhookTriggerConfig,
  type WebhookTriggerResponse,
  type WorkflowCapabilityConfig,
  // Errors
  WorkflowError,
  WorkflowErrorCode,
  // Types
  type WorkflowPayload,
  type WorkflowStepConfig,
  type WorkflowStepInput,
  type WorkflowStepOutput,
  type WorkflowStepPayload,
  type WorkflowStepResult,
  type WorkflowVariables,
} from './capabilities/workflows.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/slack-agent';
