/**
 * @wundr/slack-agent - Slack Agent Capabilities
 *
 * Provides comprehensive Slack integration capabilities for VP (Virtual Principal)
 * agents operating as full users in Slack workspaces.
 *
 * @packageDocumentation
 */

// =============================================================================
// Unified Slack User Agent (Primary Interface)
// =============================================================================

export {
  // Main class
  SlackUserAgent,
  // Factory functions
  createSlackUserAgent,
  createSlackUserAgentFromEnv,
  // Types
  type VPIdentity,
  type SlackUserAgentConfig,
  type HealthCheckResult,
  type SlackEventType,
  type SlackEvent,
  type EventHandler,
} from './slack-user-agent.js';

// Default export for convenience
export { default } from './slack-user-agent.js';

// =============================================================================
// Individual Capability Modules
// =============================================================================

// Profile Management
export {
  ProfileManager,
  createProfileManager,
  ProfileError,
  type ProfileManagerConfig,
  type UserProfile,
  type ProfileUpdate,
  type ProfileFieldValue,
  type CustomField,
} from './capabilities/profile-management.js';

// Threading Capabilities
export {
  SlackThreadingCapability,
  createThreadingCapability,
  type BlockKitElement,
  type BlockKit,
  type MessageResult,
  type SlackMessage,
  type ThreadInfo,
  type GetThreadRepliesOptions,
  type PostMessageOptions,
} from './capabilities/threading.js';

// File Operations
export {
  SlackFileOperations,
  createFileOperations,
  type FileType,
  type FileSource,
  type UploadOptions,
  type FileResult,
  type ListFilesOptions,
  type SlackFile,
  type FileComment,
  type FileReaction,
  type FileShares,
  type FileOperationsConfig,
} from './capabilities/file-operations.js';

// Proactive Messaging
export {
  ProactiveMessenger,
  createProactiveMessenger,
  createProactiveMessengerFromEnv,
  ProactiveMessagingError,
  ProactiveMessagingErrorCode,
  type TokenType,
  type BlockKitElement as ProactiveBlockKitElement,
  type BlockKit as ProactiveBlockKit,
  type PostOptions,
  type MessageResult as ProactiveMessageResult,
  type ScheduledMessageResult,
  type ScheduledMessage,
  type ProactiveMessengerConfig,
} from './capabilities/proactive-messaging.js';

// Channel Membership Operations
export {
  ChannelMembershipManager,
  // Types
  type Channel,
  type InviteResult,
  type ChannelMember,
  type ListChannelsOptions,
  type PaginatedChannelResponse,
  // Errors
  SlackPermissionError,
  ChannelNotFoundError,
  UserNotFoundError,
} from './capabilities/channel-membership.js';

// Search Capabilities
export {
  SlackSearchCapability,
  createSlackSearchCapability,
  // Errors
  SlackSearchError,
  SearchResultParseError,
  SearchRateLimitError,
  // Types
  type SortDirection,
  type MessageSortField,
  type FileSortField,
  type SearchOptions,
  type PaginationInfo,
  type SearchResult,
  type Message,
  type MessageChannel,
  type MessageAttachment,
  type MessageBlock,
  type Reaction,
  type ThreadInfo as SearchThreadInfo,
  type File,
  type User,
  type UserProfile as SearchUserProfile,
  type CombinedSearchResult,
  type SearchModifiers,
} from './capabilities/search.js';

// DND (Do Not Disturb) Controls
export {
  DndControlsManager,
  createDndControlsManager,
  createDndControlsManagerFromToken,
  // Types
  type DndInfo,
  type SnoozeDuration,
  type DndControlsConfig,
  // Errors
  DndError,
  SnoozeNotActiveError,
  DndUserNotFoundError,
} from './capabilities/dnd-controls.js';

// Canvas Capabilities
export {
  SlackCanvasCapability,
  createCanvasCapability,
  createCanvasCapabilityFromClient,
  // Types
  type CanvasOperation,
  type CanvasSectionType,
  type CanvasAccessLevel,
  type DocumentContent,
  type CanvasContent,
  type Canvas,
  type CanvasSection,
  type SectionLookupCriteria,
  type CanvasChange,
  type CanvasCapabilityConfig,
  // Errors
  CanvasNotSupportedError,
  CanvasError,
} from './capabilities/canvas.js';

// Reminders Capability
export {
  ReminderManager,
  createReminderManager,
  createReminderManagerFromToken,
  // Types
  type Reminder,
  type ReminderDuration,
  type ReminderManagerConfig,
  // Errors
  ReminderError,
  ReminderNotFoundError,
  ReminderUserNotFoundError,
  ReminderChannelNotFoundError,
  InvalidReminderTimeError,
} from './capabilities/reminders.js';

// Usergroups Management
export {
  UsergroupManager,
  createUsergroupManager,
  UsergroupManagementError,
  UsergroupErrorCode,
  isUsergroupManagementError,
  isPermissionError as isUsergroupPermissionError,
  isRateLimitError as isUsergroupRateLimitError,
  isNotFoundError as isUsergroupNotFoundError,
  isNameConflictError,
  // Types
  type Usergroup,
  type CreateUsergroupOptions,
  type UsergroupUpdate,
  type ListUsergroupsOptions,
  type UsergroupManagerConfig,
} from './capabilities/usergroups.js';

// Scheduled Messages
export {
  ScheduledMessagesManager,
  createScheduledMessagesManager,
  createScheduledMessagesManagerFromEnv,
  // Types
  type Block as ScheduledMessageBlock,
  type ScheduledMessage as VPScheduledMessage,
  type ScheduleMessageOptions,
  type ListScheduledMessagesOptions,
  type PaginatedScheduledMessages,
  type BatchScheduleResult,
  type TimeSpec,
  type ScheduledMessagesConfig,
  // Errors
  ScheduledMessageError,
  InvalidScheduleTimeError,
  ScheduledMessageNotFoundError,
} from './capabilities/scheduled-messages.js';

// Workflow Capabilities
export {
  SlackWorkflowCapability,
  createWorkflowCapability,
  createWorkflowCapabilityFromEnv,
  // Errors
  WorkflowError,
  WorkflowErrorCode,
  // Types
  type WorkflowPayload,
  type WorkflowVariables,
  type WorkflowStepPayload,
  type WorkflowStepResult,
  type WorkflowStepConfig,
  type WorkflowStepInput,
  type WorkflowStepOutput,
  type WebhookTriggerConfig,
  type WebhookTriggerResponse,
  type WorkflowCapabilityConfig,
} from './capabilities/workflows.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/slack-agent';
