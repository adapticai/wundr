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
 * const coordinator = new TeamCoordinator(sessionManager);
 *
 * // Create a team
 * const team = coordinator.createTeam('lead-session-id', {
 *   name: 'code-review-team',
 *   teammateMode: 'auto',
 *   maxTeammates: 5,
 * });
 *
 * // Spawn teammates
 * const reviewer = await coordinator.spawnTeammate(team.id, {
 *   name: 'Security Reviewer',
 *   role: 'security-review',
 *   prompt: 'Review the auth module for security vulnerabilities.',
 * });
 *
 * // Create shared tasks
 * const taskList = coordinator.getTaskList(team.id)!;
 * taskList.createTask(team.members[0].id, {
 *   title: 'Review JWT handling',
 *   description: 'Check for token expiry, refresh, and storage vulnerabilities.',
 *   priority: 'high',
 * });
 *
 * // Send messages between teammates
 * const mailbox = coordinator.getMailbox(team.id)!;
 * mailbox.send(reviewer.id, {
 *   toId: team.members[0].id,
 *   content: 'Found a potential issue with token storage.',
 * });
 *
 * // Register quality gate hooks
 * coordinator.registerHook(team.id, {
 *   type: 'TaskCompleted',
 *   mode: 'function',
 *   handler: async (ctx) => {
 *     // Reject if no tests were written
 *     return { exitCode: 0 };
 *   },
 *   timeout: 30000,
 *   enabled: true,
 * });
 *
 * // Clean up when done
 * await coordinator.requestShutdown(team.id, reviewer.id);
 * coordinator.cleanupTeam(team.id);
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Team Coordinator (main entry point)
// ---------------------------------------------------------------------------

export {
  TeamCoordinator,
  TeamError,
  TeamErrorCode,
} from './team-coordinator';

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

export {
  Mailbox,
  MailboxError,
  MailboxErrorCode,
} from './mailbox';

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

export {
  TeamHooks,
} from './team-hooks';

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
