/**
 * Agent Teams - Multi-session coordination for the Orchestrator Daemon
 *
 * Provides the ability to coordinate multiple Claude Code sessions working
 * together as a team, with shared tasks, inter-agent messaging, and
 * centralized lifecycle management.
 *
 * Modeled after Claude Code's experimental Agent Teams feature.
 *
 * @example
 * ```typescript
 * import { TeamCoordinator } from './teams';
 *
 * const coordinator = new TeamCoordinator(sessionManager, {
 *   assignmentStrategy: 'load-balanced',
 *   settings: { maxTeamSize: 8, autoAssignOnIdle: true },
 * });
 *
 * // Create a team
 * const team = coordinator.createTeam('lead-session-id', {
 *   name: 'code-review-team',
 *   teammateMode: 'auto',
 *   maxTeammates: 5,
 *   assignmentStrategy: 'capability-based',
 * });
 *
 * // Spawn teammates with capabilities
 * const reviewer = await coordinator.spawnTeammate(team.id, {
 *   name: 'Security Reviewer',
 *   role: 'security-review',
 *   prompt: 'Review the auth module for security vulnerabilities.',
 *   capabilities: ['security', 'auth', 'jwt'],
 *   maxConcurrentTasks: 2,
 * });
 *
 * // Create shared tasks with dependencies
 * const taskList = coordinator.getTaskList(team.id)!;
 * const task1 = taskList.createTask(team.members[0].id, {
 *   title: 'Review JWT handling',
 *   description: 'Check for token expiry, refresh, and storage.',
 *   priority: 'high',
 *   metadata: { requiredCapabilities: ['security', 'jwt'] },
 * });
 * const task2 = taskList.createTask(team.members[0].id, {
 *   title: 'Write security report',
 *   description: 'Summarize all findings.',
 *   dependencies: [task1.id],
 * });
 *
 * // Auto-assign pending tasks
 * await coordinator.autoAssignPendingTasks(team.id);
 *
 * // Track dependencies and detect deadlocks
 * coordinator.addTaskDependency(team.id, task2.id, task1.id);
 * coordinator.detectDeadlocks(team.id);
 *
 * // Shared context between teammates
 * coordinator.setSharedContext(team.id, 'findings', [], reviewer.id);
 *
 * // Send messages between teammates
 * const mailbox = coordinator.getMailbox(team.id)!;
 * mailbox.send(reviewer.id, {
 *   toId: team.members[0].id,
 *   content: 'Found a potential issue with token storage.',
 * });
 *
 * // Get team progress
 * const progress = coordinator.getTeamProgress(team.id);
 *
 * // Register quality gate hooks
 * coordinator.registerHook(team.id, {
 *   type: 'TaskCompleted',
 *   mode: 'function',
 *   handler: async (ctx) => ({ exitCode: 0 }),
 *   timeout: 30000,
 *   enabled: true,
 * });
 *
 * // Aggregate results and clean up
 * const results = coordinator.aggregateResults(team.id);
 * await coordinator.requestShutdown(team.id, reviewer.id);
 * coordinator.cleanupTeam(team.id);
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Team Coordinator (main entry point)
// ---------------------------------------------------------------------------

export { TeamCoordinator, TeamError, TeamErrorCode } from './team-coordinator';

export type {
  TeammateMode,
  BackendType,
  TeamStatus,
  TeammateStatus,
  TeamConfig,
  TeamMember,
  CreateTeamInput,
  SpawnTeammateOptions,
  TeamSessionManager,
  TeamCoordinatorEvents,
  TeamCoordinatorOptions,
} from './team-coordinator';

// ---------------------------------------------------------------------------
// Shared Task List
// ---------------------------------------------------------------------------

export {
  SharedTaskList,
  TaskListError,
  TaskListErrorCode,
} from './shared-task-list';

export type {
  SharedTaskStatus,
  SharedTaskPriority,
  SharedTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilter,
  SharedTaskListEvents,
  TaskCompletedHookFn,
} from './shared-task-list';

// ---------------------------------------------------------------------------
// Mailbox
// ---------------------------------------------------------------------------

export { Mailbox, MailboxError, MailboxErrorCode } from './mailbox';

export type {
  MessagePriority,
  MessageType,
  TeamMessage,
  SendMessageInput,
  BroadcastOptions,
  MessageFilter,
  MailboxEvents,
  TeammateIdleHookFn,
} from './mailbox';

// ---------------------------------------------------------------------------
// Team Hooks
// ---------------------------------------------------------------------------

export { TeamHooks } from './team-hooks';

export type {
  HookType,
  HookExitCode,
  HookExecutionMode,
  HookConfig,
  HookResult,
  TeammateIdleHookContext,
  TaskCompletedHookContext,
  HookHandlerFn,
  TeamHooksEvents,
} from './team-hooks';

// ---------------------------------------------------------------------------
// Task Assignment
// ---------------------------------------------------------------------------

export {
  TaskAssigner,
  AssignmentError,
  AssignmentErrorCode,
} from './task-assignment';

export type {
  AssignmentStrategy,
  TeammateCapabilities,
  AssignmentCandidate,
  AssignmentDecision,
  TaskAssignmentEvents,
  AssignableTask,
} from './task-assignment';

// ---------------------------------------------------------------------------
// Dependency Tracker
// ---------------------------------------------------------------------------

export {
  DependencyTracker,
  DependencyError,
  DependencyErrorCode,
} from './dependency-tracker';

export type {
  DependencyEdge,
  DependencyInfo,
  CycleDetectionResult,
  TopologicalOrder,
  DependencyTrackerEvents,
} from './dependency-tracker';

// ---------------------------------------------------------------------------
// Team Context (shared memory, progress, results, settings)
// ---------------------------------------------------------------------------

export {
  TeamContext,
  TeamContextError,
  TeamContextErrorCode,
  DEFAULT_TEAM_SETTINGS,
} from './team-context';

export type {
  SharedContextEntry,
  TeamProgress,
  TeamResult,
  TaskResult,
  MemberContribution,
  TeamSettingsConfig,
  TeamContextEvents,
} from './team-context';
