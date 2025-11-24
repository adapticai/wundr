/**
 * @genesis/core - Services
 *
 * Central export for all service layer implementations.
 *
 * @packageDocumentation
 */

// =============================================================================
// VP Service
// =============================================================================

export {
  // Service implementation
  VPServiceImpl,
  createVPService,
  vpService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
} from './vp-service';

// =============================================================================
// Message Service
// =============================================================================

export {
  // Service implementation
  MessageServiceImpl,
  createMessageService,
  messageService,

  // Interfaces
  type MessageService,
  type ThreadService,
  type ReactionService,
  type MessageEvents,

  // Errors (legacy export from message-service)
  MessageNotFoundError,
  ChannelNotFoundError as MessageChannelNotFoundError,
  MessageValidationError,
  ReactionError,
} from './message-service';

// =============================================================================
// Channel Service
// =============================================================================

export {
  // Service implementation
  ChannelServiceImpl,
  createChannelService,
  channelService,

  // Interfaces
  type ChannelService,

  // Errors
  ChannelNotFoundError,
  ChannelAlreadyExistsError,
  ChannelValidationError,
  ChannelMemberNotFoundError,
  WorkspaceNotFoundError as ChannelWorkspaceNotFoundError,
  UserNotFoundError as ChannelUserNotFoundError,
} from './channel-service';

// =============================================================================
// Organization Service
// =============================================================================

export {
  // Service implementation
  OrganizationServiceImpl,
  createOrganizationService,
  organizationService,

  // Interfaces
  type OrganizationService,

  // Errors
  OrganizationAlreadyExistsError,
  OrganizationValidationError,
  OrganizationMemberNotFoundError,
  UserNotFoundError as OrgUserNotFoundError,
} from './organization-service';

// =============================================================================
// Workspace Service
// =============================================================================

export {
  // Service implementation
  WorkspaceServiceImpl,
  createWorkspaceService,
  workspaceService,

  // Interfaces
  type WorkspaceService,

  // Errors
  WorkspaceNotFoundError,
  WorkspaceAlreadyExistsError,
  WorkspaceValidationError,
  WorkspaceMemberNotFoundError,
  UserNotFoundError as WorkspaceUserNotFoundError,
} from './workspace-service';

// =============================================================================
// Discipline Service
// =============================================================================

export {
  // Service implementation
  DisciplineServiceImpl,
  createDisciplineService,
  disciplineService,

  // Interfaces
  type DisciplineService,

  // Errors
  DisciplineNotFoundError,
  DisciplineAlreadyExistsError,
  DisciplineValidationError,
  VPNotFoundError as DisciplineVPNotFoundError,
} from './discipline-service';

// =============================================================================
// Presence Service
// =============================================================================

export {
  // Service implementation
  PresenceServiceImpl,
  createPresenceService,
  getPresenceService,
  presenceService,

  // Interfaces
  type PresenceService,
  type PresenceStats,

  // Errors
  PresenceError,
  RedisUnavailableError,
} from './presence-service';

// =============================================================================
// Heartbeat Service
// =============================================================================

export {
  // Service implementation
  HeartbeatServiceImpl,
  createHeartbeatService,

  // Interfaces
  type HeartbeatService,
  type RedisClient,

  // Errors
  HeartbeatError,
  DaemonNotRegisteredError,
  DaemonAlreadyRegisteredError,
  HeartbeatValidationError,
} from './heartbeat-service';

// =============================================================================
// Heartbeat Monitor
// =============================================================================

export {
  // Monitor implementation
  HeartbeatMonitor,
  createHeartbeatMonitor,

  // Interfaces
  type HeartbeatMonitorService,
  type MonitorStats,
} from './heartbeat-monitor';
