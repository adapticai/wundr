/**
 * Team Coordinator - Central orchestration for Agent Teams
 *
 * Manages the full lifecycle of an agent team: creation, teammate spawning,
 * backend detection (tmux/iTerm2/in-process), display mode management,
 * delegate mode, shutdown, and cleanup.
 *
 * Modeled after Claude Code Agent Teams:
 * - One team per lead session
 * - Lead spawns and coordinates teammates
 * - Teammates are independent sessions with their own context windows
 * - Shared task list + mailbox for coordination
 * - TeammateIdle and TaskCompleted hooks for quality gates
 *
 * Comprehensive coordination features:
 * - TaskAssigner: round-robin, capability-based, and load-balanced assignment
 * - DependencyTracker: DAG-based dependency tracking with deadlock detection
 * - TeamContext: shared memory, progress reporting, and result aggregation
 * - Team configuration from settings (TeamSettingsConfig)
 * - Max team size enforcement via settings
 * - Session cleanup tracking with timeout
 *
 * Integration points:
 * - SessionManager: spawns teammate sessions
 * - SharedTaskList: cross-session task coordination
 * - Mailbox: inter-teammate messaging
 * - TeamHooks: quality gate enforcement
 * - TaskAssigner: automatic task distribution
 * - DependencyTracker: dependency graph and deadlock detection
 * - TeamContext: shared context, progress, and results
 */

import { execFileSync } from 'child_process';

import { EventEmitter } from 'eventemitter3';

import { DependencyTracker } from './dependency-tracker';
import { Mailbox } from './mailbox';
import { SharedTaskList, type CreateTaskInput } from './shared-task-list';
import { TaskAssigner, type AssignmentCandidate, type AssignmentStrategy, type TeammateCapabilities } from './task-assignment';
import { TeamContext, type TeamSettingsConfig, type TeamProgress, type TeamResult } from './team-context';
import { TeamHooks, type HookConfig } from './team-hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeammateMode = 'in-process' | 'tmux' | 'auto';

export type BackendType = 'tmux' | 'iterm2' | 'in-process';

export type TeamStatus = 'creating' | 'active' | 'shutting-down' | 'cleaned-up';

export type TeammateStatus = 'spawning' | 'active' | 'idle' | 'shutting-down' | 'stopped';

export interface TeamConfig {
  readonly id: string;
  readonly name: string;
  readonly leadSessionId: string;
  readonly teammateMode: TeammateMode;
  readonly resolvedBackend: BackendType;
  readonly maxTeammates: number;
  delegateMode: boolean;
  readonly createdAt: Date;
  status: TeamStatus;
  members: TeamMember[];
  metadata: Record<string, unknown>;
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly sessionId: string;
  readonly role: string;
  readonly agentType: string;
  status: TeammateStatus;
  assignedTasks: string[];
  readonly spawnPrompt: string;
  readonly planApprovalRequired: boolean;
  readonly model: string | null;
  readonly joinedAt: Date;
}

export interface CreateTeamInput {
  readonly name: string;
  readonly teammateMode?: TeammateMode;
  readonly maxTeammates?: number;
  readonly delegateMode?: boolean;
  readonly metadata?: Record<string, unknown>;
  /** Team-specific settings (merged with global defaults). */
  readonly settings?: Partial<TeamSettingsConfig>;
  /** Initial task assignment strategy. */
  readonly assignmentStrategy?: AssignmentStrategy;
}

export interface SpawnTeammateOptions {
  readonly name: string;
  readonly role: string;
  readonly prompt: string;
  readonly model?: string;
  readonly planApprovalRequired?: boolean;
  readonly agentType?: string;
  /** Capabilities for capability-based task assignment. */
  readonly capabilities?: string[];
  /** Max concurrent tasks this teammate can handle. */
  readonly maxConcurrentTasks?: number;
}

/**
 * Minimal interface for the session manager dependency.
 * The TeamCoordinator does not import SessionManager directly to keep coupling loose.
 */
export interface TeamSessionManager {
  spawnSession(orchestratorId: string, task: {
    id: string;
    type: 'code' | 'research' | 'analysis' | 'custom' | 'general';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;

  stopSession(sessionId: string): Promise<void>;

  getSession(sessionId: string): { id: string; status: string } | undefined;
}

export interface TeamCoordinatorEvents {
  'team:created': (team: TeamConfig) => void;
  'team:active': (team: TeamConfig) => void;
  'team:shutting-down': (teamId: string) => void;
  'team:cleaned-up': (teamId: string) => void;
  'team:all-tasks-complete': (teamId: string, result: TeamResult) => void;
  'teammate:spawned': (teamId: string, member: TeamMember) => void;
  'teammate:active': (teamId: string, memberId: string) => void;
  'teammate:idle': (teamId: string, memberId: string) => void;
  'teammate:stopped': (teamId: string, memberId: string) => void;
  'teammate:shutdown-requested': (teamId: string, memberId: string) => void;
  'teammate:crash-recovered': (teamId: string, memberId: string, releasedTasks: string[]) => void;
  'teammate:work-redistributed': (teamId: string, memberId: string, assignedTaskIds: string[]) => void;
  'delegate-mode:changed': (teamId: string, enabled: boolean) => void;
  'monitor:heartbeat': (teamId: string, activeCount: number, staleCount: number) => void;
  'monitor:stale-detected': (teamId: string, memberId: string) => void;
  'task:auto-assigned': (teamId: string, taskId: string, assigneeId: string, strategy: string) => void;
  'dependency:deadlock-detected': (teamId: string, cyclePath: string[]) => void;
  'progress:updated': (teamId: string, progress: TeamProgress) => void;
}

export interface TeamCoordinatorOptions {
  /** Interval in ms between session health checks. Default: 30000 */
  readonly monitorIntervalMs?: number;
  /** Max time in ms a teammate session can be unresponsive before considered stale. Default: 120000 */
  readonly staleThresholdMs?: number;
  /** Whether to auto-start session monitoring. Default: false */
  readonly autoMonitor?: boolean;
  /** Global team settings (applied as defaults for all teams). */
  readonly settings?: Partial<TeamSettingsConfig>;
  /** Default task assignment strategy. */
  readonly assignmentStrategy?: AssignmentStrategy;
  /** Default max concurrent tasks per teammate. */
  readonly defaultMaxConcurrentTasks?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TeamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TeamError';
  }
}

export enum TeamErrorCode {
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  TEAM_ALREADY_EXISTS = 'TEAM_ALREADY_EXISTS',
  TEAM_NOT_ACTIVE = 'TEAM_NOT_ACTIVE',
  TEAM_HAS_ACTIVE_MEMBERS = 'TEAM_HAS_ACTIVE_MEMBERS',
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  MAX_TEAMMATES_REACHED = 'MAX_TEAMMATES_REACHED',
  SESSION_SPAWN_FAILED = 'SESSION_SPAWN_FAILED',
  NESTED_TEAMS_NOT_ALLOWED = 'NESTED_TEAMS_NOT_ALLOWED',
  ONE_TEAM_PER_SESSION = 'ONE_TEAM_PER_SESSION',
}

// ---------------------------------------------------------------------------
// Team Coordinator
// ---------------------------------------------------------------------------

export class TeamCoordinator extends EventEmitter<TeamCoordinatorEvents> {
  /**
   * Active teams keyed by team ID.
   */
  private readonly teams: Map<string, TeamConfig> = new Map();

  /**
   * Map from lead session ID to team ID (enforces one team per session).
   */
  private readonly sessionToTeam: Map<string, string> = new Map();

  /**
   * Map from teammate session ID to team ID (for reverse lookup on session events).
   */
  private readonly teammateSessionToTeam: Map<string, string> = new Map();

  /**
   * Shared task lists per team.
   */
  private readonly taskLists: Map<string, SharedTaskList> = new Map();

  /**
   * Mailboxes per team.
   */
  private readonly mailboxes: Map<string, Mailbox> = new Map();

  /**
   * Hooks manager (shared across all teams).
   */
  private readonly hooks: TeamHooks = new TeamHooks();

  /**
   * Task assigners per team.
   */
  private readonly assigners: Map<string, TaskAssigner> = new Map();

  /**
   * Dependency trackers per team.
   */
  private readonly dependencyTrackers: Map<string, DependencyTracker> = new Map();

  /**
   * Team context (shared memory, progress, results) - global instance.
   */
  private readonly teamContext: TeamContext;

  /**
   * Session health monitoring interval handle.
   */
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Last heartbeat timestamp per teammate session (sessionId -> timestamp).
   */
  private readonly lastHeartbeat: Map<string, number> = new Map();

  private readonly monitorIntervalMs: number;
  private readonly staleThresholdMs: number;
  private readonly defaultMaxConcurrentTasks: number;

  private nextTeamNumber = 1;
  private nextMemberNumber = 1;

  constructor(
    private readonly sessionManager: TeamSessionManager,
    private readonly options: TeamCoordinatorOptions = {},
  ) {
    super();
    this.monitorIntervalMs = options.monitorIntervalMs ?? 30_000;
    this.staleThresholdMs = options.staleThresholdMs ?? 120_000;
    this.defaultMaxConcurrentTasks = options.defaultMaxConcurrentTasks ?? 3;
    this.teamContext = new TeamContext(options.settings);

    if (options.autoMonitor) {
      this.startMonitoring();
    }
  }

  // -------------------------------------------------------------------------
  // Team Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Create a new agent team.
   *
   * Validates:
   * - No existing team for this lead session (one team per session)
   * - Detects the backend (tmux/iterm2/in-process)
   * - Initializes shared task list and mailbox
   */
  createTeam(leadSessionId: string, input: CreateTeamInput): TeamConfig {
    // Enforce one team per session
    if (this.sessionToTeam.has(leadSessionId)) {
      throw new TeamError(
        TeamErrorCode.ONE_TEAM_PER_SESSION,
        `Session ${leadSessionId} already has an active team`,
        { existingTeamId: this.sessionToTeam.get(leadSessionId) },
      );
    }

    // Resolve effective settings
    const settings = this.teamContext.getSettings();
    const maxTeammates = input.maxTeammates ?? settings.maxTeamSize;

    const teamId = `team_${this.nextTeamNumber++}_${Date.now()}`;
    const teammateMode = input.teammateMode ?? settings.defaultTeammateMode;
    const resolvedBackend = this.detectBackend(teammateMode);

    const team: TeamConfig = {
      id: teamId,
      name: input.name,
      leadSessionId,
      teammateMode,
      resolvedBackend,
      maxTeammates,
      delegateMode: input.delegateMode ?? settings.defaultDelegateMode,
      createdAt: new Date(),
      status: 'creating',
      members: [],
      metadata: input.metadata ?? {},
    };

    // Register lead as the first member
    const leadMember: TeamMember = {
      id: `member_${this.nextMemberNumber++}`,
      name: 'Lead',
      sessionId: leadSessionId,
      role: 'lead',
      agentType: 'coordinator',
      status: 'active',
      assignedTasks: [],
      spawnPrompt: '',
      planApprovalRequired: false,
      model: null,
      joinedAt: new Date(),
    };
    team.members.push(leadMember);

    // Store team
    this.teams.set(teamId, team);
    this.sessionToTeam.set(leadSessionId, teamId);

    // Initialize shared task list
    const taskList = new SharedTaskList(teamId);
    this.taskLists.set(teamId, taskList);

    // Initialize mailbox
    const mailbox = new Mailbox(teamId);
    mailbox.registerMember(leadMember.id, leadMember.name, true);
    this.mailboxes.set(teamId, mailbox);

    // Initialize task assigner
    const assignmentStrategy = input.assignmentStrategy
      ?? this.options.assignmentStrategy
      ?? settings.defaultAssignmentStrategy;
    const assigner = new TaskAssigner({
      strategy: assignmentStrategy,
      defaultMaxConcurrent: settings.defaultMaxConcurrentTasks,
    });
    this.assigners.set(teamId, assigner);

    // Initialize dependency tracker
    const depTracker = new DependencyTracker();
    this.dependencyTrackers.set(teamId, depTracker);

    // Register team in context
    this.teamContext.registerTeam(teamId, input.settings);

    // Wire hooks into task list and mailbox
    taskList.setTaskCompletedHook(
      this.hooks.createTaskCompletedCallback(memberId => this.getMemberName(teamId, memberId)),
    );
    mailbox.setTeammateIdleHook(this.hooks.createTeammateIdleCallback());

    // Wire task completion event to track results and check for team completion
    taskList.on('task:completed', (task, teammateId) => {
      this.teamContext.recordTaskResult(teamId, {
        taskId: task.id,
        taskTitle: task.title,
        status: 'completed',
        completedBy: teammateId,
        durationMs: task.completedAt
          ? task.completedAt.getTime() - task.createdAt.getTime()
          : 0,
        output: task.metadata['output'] ?? null,
      });

      // Mark completed in dependency tracker and auto-unblock
      depTracker.markCompleted(task.id);

      // Check if all tasks are now complete
      const stats = taskList.getStats();
      if (stats.total > 0 && stats.completed === stats.total) {
        this.onAllTasksComplete(teamId);
      }
    });

    // Wire dependency cycle detection
    depTracker.on('dependency:cycle-detected', (cyclePath) => {
      this.emit('dependency:deadlock-detected', teamId, cyclePath);
    });

    // Transition to active
    team.status = 'active';

    this.emit('team:created', team);
    this.emit('team:active', team);

    return team;
  }

  /**
   * Spawn a new teammate in an existing team.
   */
  async spawnTeammate(teamId: string, options: SpawnTeammateOptions): Promise<TeamMember> {
    const team = this.getTeamOrThrow(teamId);

    if (team.status !== 'active') {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_ACTIVE,
        `Team ${teamId} is not active (status: ${team.status})`,
      );
    }

    // Count non-lead active members
    const activeTeammates = team.members.filter(
      m => m.role !== 'lead' && m.status !== 'stopped',
    );

    // Enforce both team config limit and settings limit
    if (activeTeammates.length >= team.maxTeammates) {
      throw new TeamError(
        TeamErrorCode.MAX_TEAMMATES_REACHED,
        `Team ${teamId} has reached the maximum of ${team.maxTeammates} teammates`,
      );
    }

    if (!this.teamContext.validateTeamSize(teamId, activeTeammates.length)) {
      throw new TeamError(
        TeamErrorCode.MAX_TEAMMATES_REACHED,
        `Team ${teamId} has reached the settings limit`,
      );
    }

    const memberId = `member_${this.nextMemberNumber++}`;

    // Spawn a session for the teammate via SessionManager
    let session: { id: string };
    try {
      const now = new Date();
      session = await this.sessionManager.spawnSession('orchestrator', {
        id: `task_team_${teamId}_${memberId}`,
        type: 'code',
        description: options.prompt,
        priority: 'medium',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        metadata: {
          teamId,
          memberId,
          role: options.role,
          agentType: options.agentType ?? 'teammate',
          planApprovalRequired: options.planApprovalRequired ?? false,
          capabilities: options.capabilities ?? [],
        },
      });
    } catch (error) {
      throw new TeamError(
        TeamErrorCode.SESSION_SPAWN_FAILED,
        `Failed to spawn session for teammate: ${error instanceof Error ? error.message : String(error)}`,
        { teamId, name: options.name },
      );
    }

    const member: TeamMember = {
      id: memberId,
      name: options.name,
      sessionId: session.id,
      role: options.role,
      agentType: options.agentType ?? 'teammate',
      status: 'spawning',
      assignedTasks: [],
      spawnPrompt: options.prompt,
      planApprovalRequired: options.planApprovalRequired ?? false,
      model: options.model ?? null,
      joinedAt: new Date(),
    };

    team.members.push(member);
    this.teammateSessionToTeam.set(session.id, teamId);
    this.lastHeartbeat.set(session.id, Date.now());

    // Register capabilities in task assigner
    const assigner = this.assigners.get(teamId);
    if (assigner) {
      assigner.registerCapabilities({
        memberId,
        capabilities: options.capabilities ?? [],
        maxConcurrent: options.maxConcurrentTasks ?? this.defaultMaxConcurrentTasks,
      });
    }

    // Register in mailbox
    const mailbox = this.mailboxes.get(teamId)!;
    mailbox.registerMember(memberId, options.name);

    // Transition to active
    member.status = 'active';

    // Notify team
    mailbox.notifyTeammateJoined(memberId, options.name);

    this.emit('teammate:spawned', teamId, member);
    this.emit('teammate:active', teamId, memberId);

    return member;
  }

  /**
   * Request a teammate to shut down.
   * In Claude Code, the teammate can approve or reject the request.
   * Here we perform a graceful shutdown.
   */
  async requestShutdown(teamId: string, memberId: string): Promise<boolean> {
    const team = this.getTeamOrThrow(teamId);
    const member = this.getMemberOrThrow(team, memberId);

    if (member.role === 'lead') {
      throw new TeamError(
        TeamErrorCode.MEMBER_NOT_FOUND,
        'Cannot shut down the lead -- use cleanupTeam instead',
      );
    }

    if (member.status === 'stopped') {
      return true; // Already stopped
    }

    this.emit('teammate:shutdown-requested', teamId, memberId);

    member.status = 'shutting-down';

    // Release any in-progress tasks back to pending
    const taskList = this.taskLists.get(teamId);
    if (taskList) {
      const memberTasks = taskList.getTasksForTeammate(memberId);
      for (const task of memberTasks) {
        if (task.status === 'in_progress') {
          await taskList.releaseTask(task.id);
        }
      }
    }

    // Stop the session
    try {
      await this.sessionManager.stopSession(member.sessionId);
    } catch {
      // Session may already be stopped
    }

    member.status = 'stopped';
    this.teammateSessionToTeam.delete(member.sessionId);

    // Unregister from task assigner
    const assigner = this.assigners.get(teamId);
    if (assigner) {
      assigner.unregisterCapabilities(memberId);
    }

    // Notify mailbox
    const mailbox = this.mailboxes.get(teamId);
    if (mailbox) {
      mailbox.unregisterMember(memberId);
      mailbox.notifyTeammateShutdown(memberId, 'Shutdown requested');
    }

    this.emit('teammate:stopped', teamId, memberId);

    return true;
  }

  /**
   * Clean up a team. Requires all teammates to be stopped first.
   */
  cleanupTeam(teamId: string): void {
    const team = this.getTeamOrThrow(teamId);

    // Check for active teammates (non-lead)
    const activeMembers = team.members.filter(
      m => m.role !== 'lead' && m.status !== 'stopped',
    );

    if (activeMembers.length > 0) {
      throw new TeamError(
        TeamErrorCode.TEAM_HAS_ACTIVE_MEMBERS,
        `Cannot clean up team ${teamId}: ${activeMembers.length} teammates are still active`,
        { activeMembers: activeMembers.map(m => m.id) },
      );
    }

    // Start cleanup tracking
    if (!this.teamContext.isCleanupInProgress(teamId)) {
      this.teamContext.startCleanup(teamId);
    }

    team.status = 'shutting-down';
    this.emit('team:shutting-down', teamId);

    // Clean up task list
    const taskList = this.taskLists.get(teamId);
    if (taskList) {
      taskList.clear();
      taskList.removeAllListeners();
      this.taskLists.delete(teamId);
    }

    // Clean up mailbox
    const mailbox = this.mailboxes.get(teamId);
    if (mailbox) {
      mailbox.clear();
      mailbox.removeAllListeners();
      this.mailboxes.delete(teamId);
    }

    // Clean up task assigner
    const assigner = this.assigners.get(teamId);
    if (assigner) {
      assigner.clear();
      assigner.removeAllListeners();
      this.assigners.delete(teamId);
    }

    // Clean up dependency tracker
    const depTracker = this.dependencyTrackers.get(teamId);
    if (depTracker) {
      depTracker.clear();
      depTracker.removeAllListeners();
      this.dependencyTrackers.delete(teamId);
    }

    // Clean up hooks
    this.hooks.clearHooks(teamId);

    // Clean up session mappings and heartbeats
    this.sessionToTeam.delete(team.leadSessionId);
    for (const member of team.members) {
      this.teammateSessionToTeam.delete(member.sessionId);
      this.lastHeartbeat.delete(member.sessionId);
    }

    // Complete cleanup tracking and unregister context
    this.teamContext.completeCleanup(teamId);
    this.teamContext.unregisterTeam(teamId);

    team.status = 'cleaned-up';
    this.teams.delete(teamId);

    // Stop monitoring if no teams remain
    if (this.teams.size === 0) {
      this.stopMonitoring();
    }

    this.emit('team:cleaned-up', teamId);
  }

  // -------------------------------------------------------------------------
  // Delegate Mode
  // -------------------------------------------------------------------------

  /**
   * Toggle delegate mode for the team.
   * In delegate mode, the lead is restricted to coordination-only operations:
   * spawning teammates, messaging, managing tasks, and shutting down teammates.
   */
  setDelegateMode(teamId: string, enabled: boolean): void {
    const team = this.getTeamOrThrow(teamId);
    team.delegateMode = enabled;
    this.emit('delegate-mode:changed', teamId, enabled);
  }

  // -------------------------------------------------------------------------
  // Task Coordination (delegates to SharedTaskList)
  // -------------------------------------------------------------------------

  /**
   * Create a task in the team's shared task list.
   */
  createTask(teamId: string, createdBy: string, input: CreateTaskInput) {
    const taskList = this.getTaskListOrThrow(teamId);
    return taskList.createTask(createdBy, input);
  }

  /**
   * Get the shared task list for a team.
   */
  getTaskList(teamId: string): SharedTaskList | undefined {
    return this.taskLists.get(teamId);
  }

  // -------------------------------------------------------------------------
  // Messaging (delegates to Mailbox)
  // -------------------------------------------------------------------------

  /**
   * Get the mailbox for a team.
   */
  getMailbox(teamId: string): Mailbox | undefined {
    return this.mailboxes.get(teamId);
  }

  // -------------------------------------------------------------------------
  // Hooks (delegates to TeamHooks)
  // -------------------------------------------------------------------------

  /**
   * Register a hook for a team.
   */
  registerHook(teamId: string, config: HookConfig): void {
    this.getTeamOrThrow(teamId); // Validate team exists
    this.hooks.registerHook(teamId, config);
  }

  /**
   * Get the hooks manager.
   */
  getHooks(): TeamHooks {
    return this.hooks;
  }

  // -------------------------------------------------------------------------
  // Task Assignment
  // -------------------------------------------------------------------------

  /**
   * Get the task assigner for a team.
   */
  getAssigner(teamId: string): TaskAssigner | undefined {
    return this.assigners.get(teamId);
  }

  /**
   * Set the assignment strategy for a team.
   */
  setAssignmentStrategy(teamId: string, strategy: AssignmentStrategy): void {
    const assigner = this.assigners.get(teamId);
    if (!assigner) {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_FOUND,
        `Task assigner not found for team: ${teamId}`,
      );
    }
    assigner.setStrategy(strategy);
  }

  /**
   * Register capabilities for a team member.
   */
  registerMemberCapabilities(teamId: string, config: TeammateCapabilities): void {
    const assigner = this.assigners.get(teamId);
    if (!assigner) {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_FOUND,
        `Task assigner not found for team: ${teamId}`,
      );
    }
    assigner.registerCapabilities(config);
  }

  /**
   * Auto-assign all pending tasks to available teammates.
   * Uses the team's configured assignment strategy.
   *
   * @returns Array of task IDs that were assigned.
   */
  async autoAssignPendingTasks(teamId: string): Promise<string[]> {
    const team = this.getTeamOrThrow(teamId);
    const taskList = this.getTaskListOrThrow(teamId);
    const assigner = this.assigners.get(teamId);
    if (!assigner) {
return [];
}

    const pendingTasks = taskList.getClaimableTasks();
    if (pendingTasks.length === 0) {
return [];
}

    const candidates = this.buildAssignmentCandidates(team, taskList);
    if (candidates.length === 0) {
return [];
}

    const assignableTasks = pendingTasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      metadata: t.metadata,
    }));

    const decisions = assigner.selectAssignees(assignableTasks, candidates);
    const assignedTaskIds: string[] = [];

    for (const decision of decisions) {
      try {
        await taskList.claimTask(decision.taskId, decision.assigneeId);
        assignedTaskIds.push(decision.taskId);

        // Update member's assigned tasks
        const member = team.members.find(m => m.id === decision.assigneeId);
        if (member) {
          member.assignedTasks.push(decision.taskId);
        }

        this.emit('task:auto-assigned', teamId, decision.taskId, decision.assigneeId, decision.strategy);
      } catch {
        // Task may have been claimed by another teammate in the meantime -- skip
      }
    }

    return assignedTaskIds;
  }

  /**
   * Redistribute work when a teammate becomes idle.
   * Assigns pending tasks to the idle teammate.
   *
   * @returns Array of task IDs assigned to the idle teammate.
   */
  async redistributeWorkToIdle(teamId: string, idleMemberId: string): Promise<string[]> {
    const team = this.getTeamOrThrow(teamId);
    const taskList = this.getTaskListOrThrow(teamId);
    const assigner = this.assigners.get(teamId);
    if (!assigner) {
return [];
}

    const pendingTasks = taskList.getClaimableTasks(idleMemberId);
    if (pendingTasks.length === 0) {
return [];
}

    const assignedTaskIds: string[] = [];

    // Assign tasks directly to the idle member (bypass strategy for idle redistribution)
    const caps = assigner.getCapabilities(idleMemberId);
    const maxConcurrent = caps?.maxConcurrent ?? this.defaultMaxConcurrentTasks;
    const currentTasks = taskList.getTasksForTeammate(idleMemberId)
      .filter(t => t.status === 'in_progress');

    const availableSlots = maxConcurrent - currentTasks.length;
    const tasksToAssign = pendingTasks.slice(0, Math.max(0, availableSlots));

    for (const task of tasksToAssign) {
      try {
        await taskList.claimTask(task.id, idleMemberId);
        assignedTaskIds.push(task.id);

        const member = team.members.find(m => m.id === idleMemberId);
        if (member) {
          member.assignedTasks.push(task.id);
        }
      } catch {
        // Skip tasks that cannot be claimed
      }
    }

    if (assignedTaskIds.length > 0) {
      this.emit('teammate:work-redistributed', teamId, idleMemberId, assignedTaskIds);
    }

    return assignedTaskIds;
  }

  // -------------------------------------------------------------------------
  // Dependency Tracking
  // -------------------------------------------------------------------------

  /**
   * Get the dependency tracker for a team.
   */
  getDependencyTracker(teamId: string): DependencyTracker | undefined {
    return this.dependencyTrackers.get(teamId);
  }

  /**
   * Add a dependency between tasks: taskId depends on dependsOnId.
   * Validates against circular dependencies.
   */
  addTaskDependency(teamId: string, taskId: string, dependsOnId: string): void {
    const depTracker = this.dependencyTrackers.get(teamId);
    if (!depTracker) {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_FOUND,
        `Dependency tracker not found for team: ${teamId}`,
      );
    }
    depTracker.addDependency(taskId, dependsOnId);
  }

  /**
   * Run deadlock detection across all tasks in a team.
   * Emits 'dependency:deadlock-detected' if a cycle is found.
   *
   * @returns true if a deadlock was detected.
   */
  detectDeadlocks(teamId: string): boolean {
    const depTracker = this.dependencyTrackers.get(teamId);
    if (!depTracker) {
return false;
}

    const result = depTracker.detectCycles();
    if (result.hasCycle) {
      this.emit('dependency:deadlock-detected', teamId, result.cyclePath);
    }
    return result.hasCycle;
  }

  // -------------------------------------------------------------------------
  // Shared Context
  // -------------------------------------------------------------------------

  /**
   * Get the team context manager.
   */
  getTeamContext(): TeamContext {
    return this.teamContext;
  }

  /**
   * Set a shared context value for a team.
   */
  setSharedContext(teamId: string, key: string, value: unknown, memberId: string): void {
    this.getTeamOrThrow(teamId);
    this.teamContext.set(teamId, key, value, memberId);
  }

  /**
   * Get a shared context value for a team.
   */
  getSharedContext<T = unknown>(teamId: string, key: string, memberId?: string): T | undefined {
    return this.teamContext.get<T>(teamId, key, memberId);
  }

  /**
   * Get all shared context as a plain object.
   */
  getAllSharedContext(teamId: string): Record<string, unknown> {
    return this.teamContext.getAll(teamId);
  }

  // -------------------------------------------------------------------------
  // Progress Reporting
  // -------------------------------------------------------------------------

  /**
   * Get the current progress report for a team.
   */
  getTeamProgress(teamId: string): TeamProgress | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
return undefined;
}

    const taskList = this.taskLists.get(teamId);
    const taskStats = taskList?.getStats() ?? {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    };

    const activeTeammates = team.members.filter(
      m => m.role !== 'lead' && m.status === 'active',
    ).length;
    const totalTeammates = team.members.filter(
      m => m.role !== 'lead',
    ).length;

    const progress = this.teamContext.getProgress(
      teamId,
      taskStats,
      activeTeammates,
      totalTeammates,
    );

    this.emit('progress:updated', teamId, progress);
    return progress;
  }

  // -------------------------------------------------------------------------
  // Result Aggregation
  // -------------------------------------------------------------------------

  /**
   * Aggregate final results for a team.
   * Typically called when all tasks are complete or the team is being torn down.
   */
  aggregateResults(teamId: string): TeamResult | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
return undefined;
}

    const memberInfo = new Map<string, { name: string; tasksCompleted: number; tasksFailed: number }>();
    const taskList = this.taskLists.get(teamId);

    for (const member of team.members) {
      if (member.role === 'lead') {
continue;
}

      const memberTasks = taskList?.getTasksForTeammate(member.id) ?? [];
      const completed = memberTasks.filter(t => t.status === 'completed').length;

      memberInfo.set(member.id, {
        name: member.name,
        tasksCompleted: completed,
        tasksFailed: 0,
      });
    }

    return this.teamContext.aggregateResults(teamId, team.name, memberInfo);
  }

  // -------------------------------------------------------------------------
  // Session Monitoring
  // -------------------------------------------------------------------------

  /**
   * Start periodic session health monitoring.
   * Checks that teammate sessions are still alive and marks stale ones.
   */
  startMonitoring(): void {
    if (this.monitorInterval) {
return;
} // Already running

    this.monitorInterval = setInterval(() => {
      this.runHealthCheck();
    }, this.monitorIntervalMs);

    // Prevent the interval from keeping the process alive
    if (this.monitorInterval.unref) {
      this.monitorInterval.unref();
    }
  }

  /**
   * Stop session health monitoring.
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Record a heartbeat for a teammate session.
   * Called when a session sends a heartbeat or produces output.
   */
  recordHeartbeat(sessionId: string): void {
    this.lastHeartbeat.set(sessionId, Date.now());
  }

  /**
   * Run a single health check across all teams.
   * For each active teammate, checks if the underlying session is still alive.
   */
  runHealthCheck(): void {
    const now = Date.now();

    for (const team of this.teams.values()) {
      if (team.status !== 'active') {
continue;
}

      let activeCount = 0;
      let staleCount = 0;

      for (const member of team.members) {
        if (member.role === 'lead' || member.status === 'stopped') {
continue;
}
        if (member.status === 'shutting-down') {
continue;
}

        // Check if session still exists in session manager
        const session = this.sessionManager.getSession(member.sessionId);
        if (!session || session.status === 'stopped' || session.status === 'failed') {
          // Session is gone -- handle as crash
          void this.handleTeammateCrash(member.sessionId);
          staleCount++;
          continue;
        }

        // Check heartbeat staleness
        const lastBeat = this.lastHeartbeat.get(member.sessionId);
        if (lastBeat !== undefined && (now - lastBeat) > this.staleThresholdMs) {
          this.emit('monitor:stale-detected', team.id, member.id);
          staleCount++;

          // Mark as idle if currently active
          if (member.status === 'active') {
            member.status = 'idle';
            this.emit('teammate:idle', team.id, member.id);
          }
        } else {
          activeCount++;
        }
      }

      this.emit('monitor:heartbeat', team.id, activeCount, staleCount);
    }
  }

  // -------------------------------------------------------------------------
  // Force Shutdown
  // -------------------------------------------------------------------------

  /**
   * Force shutdown all teammates and clean up a team.
   * Used when graceful shutdown is not possible or the team needs to be
   * torn down immediately.
   */
  async forceShutdownTeam(teamId: string): Promise<void> {
    const team = this.getTeamOrThrow(teamId);

    team.status = 'shutting-down';
    this.emit('team:shutting-down', teamId);

    // Stop all non-lead members in parallel
    const shutdownPromises = team.members
      .filter(m => m.role !== 'lead' && m.status !== 'stopped')
      .map(async member => {
        member.status = 'shutting-down';
        try {
          await this.sessionManager.stopSession(member.sessionId);
        } catch {
          // Session may already be stopped -- ignore
        }
        member.status = 'stopped';
        this.teammateSessionToTeam.delete(member.sessionId);
        this.lastHeartbeat.delete(member.sessionId);
        this.emit('teammate:stopped', teamId, member.id);
      });

    await Promise.all(shutdownPromises);

    // Now clean up the team
    this.cleanupTeam(teamId);
  }

  // -------------------------------------------------------------------------
  // Crash Recovery
  // -------------------------------------------------------------------------

  /**
   * Handle a teammate session crash.
   * Called when SessionManager emits a session:failed event for a team session.
   *
   * - Marks the member as stopped
   * - Releases their in-progress tasks back to pending
   * - Notifies the lead via mailbox
   */
  async handleTeammateCrash(sessionId: string): Promise<void> {
    const teamId = this.teammateSessionToTeam.get(sessionId);
    if (!teamId) {
return;
} // Not a team session

    const team = this.teams.get(teamId);
    if (!team) {
return;
}

    const member = team.members.find(m => m.sessionId === sessionId);
    if (!member) {
return;
}

    member.status = 'stopped';
    this.teammateSessionToTeam.delete(sessionId);
    this.lastHeartbeat.delete(sessionId);

    // Release in-progress tasks
    const taskList = this.taskLists.get(teamId);
    const releasedTasks: string[] = [];
    if (taskList) {
      const memberTasks = taskList.getTasksForTeammate(member.id);
      for (const task of memberTasks) {
        if (task.status === 'in_progress') {
          await taskList.releaseTask(task.id);
          releasedTasks.push(task.id);
        }
      }
    }

    // Unregister from task assigner
    const assigner = this.assigners.get(teamId);
    if (assigner) {
      assigner.unregisterCapabilities(member.id);
    }

    // Notify lead
    const mailbox = this.mailboxes.get(teamId);
    if (mailbox) {
      mailbox.unregisterMember(member.id);
      mailbox.notifyTeammateShutdown(member.id, `Session crashed (${sessionId}). Released tasks: [${releasedTasks.join(', ')}]`);
    }

    this.emit('teammate:stopped', teamId, member.id);
    this.emit('teammate:crash-recovered', teamId, member.id, releasedTasks);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get a team by ID.
   */
  getTeam(teamId: string): TeamConfig | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get the team for a lead session.
   */
  getTeamForSession(sessionId: string): TeamConfig | undefined {
    const teamId = this.sessionToTeam.get(sessionId);
    if (teamId) {
return this.teams.get(teamId);
}

    // Check if it's a teammate session
    const teammateTeamId = this.teammateSessionToTeam.get(sessionId);
    if (teammateTeamId) {
return this.teams.get(teammateTeamId);
}

    return undefined;
  }

  /**
   * Get all active teams.
   */
  getActiveTeams(): TeamConfig[] {
    return Array.from(this.teams.values()).filter(t => t.status === 'active');
  }

  /**
   * Get a team member by ID.
   */
  getMember(teamId: string, memberId: string): TeamMember | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
return undefined;
}
    return team.members.find(m => m.id === memberId);
  }

  /**
   * Get active (non-stopped) teammates for a team (excludes lead).
   */
  getActiveTeammates(teamId: string): TeamMember[] {
    const team = this.teams.get(teamId);
    if (!team) {
return [];
}
    return team.members.filter(m => m.role !== 'lead' && m.status !== 'stopped');
  }

  /**
   * Get comprehensive team status.
   */
  getTeamStatus(teamId: string): {
    team: TeamConfig;
    taskStats: ReturnType<SharedTaskList['getStats']>;
    mailboxStats: ReturnType<Mailbox['getStats']>;
    hooks: HookConfig[];
    assignmentStrategy: AssignmentStrategy | null;
    dependencyStats: ReturnType<DependencyTracker['getStats']> | null;
    sharedContextSize: number;
    settings: TeamSettingsConfig;
  } | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
return undefined;
}

    const taskList = this.taskLists.get(teamId);
    const mailbox = this.mailboxes.get(teamId);
    const assigner = this.assigners.get(teamId);
    const depTracker = this.dependencyTrackers.get(teamId);

    return {
      team,
      taskStats: taskList?.getStats() ?? { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 },
      mailboxStats: mailbox?.getStats() ?? { totalMessages: 0, memberCount: 0, unreadByMember: {} },
      hooks: this.hooks.getRegisteredHooks(teamId),
      assignmentStrategy: assigner?.getStrategy() ?? null,
      dependencyStats: depTracker?.getStats() ?? null,
      sharedContextSize: this.teamContext.size(teamId),
      settings: this.teamContext.getSettings(teamId),
    };
  }

  /**
   * Get metrics across all teams.
   */
  getMetrics(): {
    totalTeams: number;
    activeTeams: number;
    totalTeammates: number;
    activeTeammates: number;
    totalTasks: number;
    completedTasks: number;
    totalMessages: number;
  } {
    let totalTeammates = 0;
    let activeTeammates = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalMessages = 0;

    for (const team of this.teams.values()) {
      const nonLeadMembers = team.members.filter(m => m.role !== 'lead');
      totalTeammates += nonLeadMembers.length;
      activeTeammates += nonLeadMembers.filter(m => m.status !== 'stopped').length;

      const taskList = this.taskLists.get(team.id);
      if (taskList) {
        const stats = taskList.getStats();
        totalTasks += stats.total;
        completedTasks += stats.completed;
      }

      const mailbox = this.mailboxes.get(team.id);
      if (mailbox) {
        const stats = mailbox.getStats();
        totalMessages += stats.totalMessages;
      }
    }

    return {
      totalTeams: this.teams.size,
      activeTeams: this.getActiveTeams().length,
      totalTeammates,
      activeTeammates,
      totalTasks,
      completedTasks,
      totalMessages,
    };
  }

  // -------------------------------------------------------------------------
  // Backend Detection
  // -------------------------------------------------------------------------

  /**
   * Detect the display backend for teammate panes.
   *
   * Logic matches Claude Code:
   * - 'in-process': always returns in-process
   * - 'tmux': auto-detects tmux vs iTerm2
   * - 'auto': uses split panes if inside tmux, otherwise in-process
   */
  detectBackend(mode: TeammateMode): BackendType {
    if (mode === 'in-process') {
      return 'in-process';
    }

    if (mode === 'tmux') {
      if (this.isTmuxAvailable()) {
        return 'tmux';
      }
      if (this.isITerm2Available()) {
        return 'iterm2';
      }
      // Fallback to in-process if tmux/iTerm2 not available
      return 'in-process';
    }

    // 'auto' mode
    if (this.isInsideTmux()) {
      return 'tmux';
    }

    return 'in-process';
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private getTeamOrThrow(teamId: string): TeamConfig {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_FOUND,
        `Team not found: ${teamId}`,
      );
    }
    return team;
  }

  private getMemberOrThrow(team: TeamConfig, memberId: string): TeamMember {
    const member = team.members.find(m => m.id === memberId);
    if (!member) {
      throw new TeamError(
        TeamErrorCode.MEMBER_NOT_FOUND,
        `Member not found: ${memberId} in team ${team.id}`,
      );
    }
    return member;
  }

  private getTaskListOrThrow(teamId: string): SharedTaskList {
    const taskList = this.taskLists.get(teamId);
    if (!taskList) {
      throw new TeamError(
        TeamErrorCode.TEAM_NOT_FOUND,
        `Task list not found for team: ${teamId}`,
      );
    }
    return taskList;
  }

  private getMemberName(teamId: string, memberId: string): string {
    const team = this.teams.get(teamId);
    if (!team) {
return memberId;
}
    const member = team.members.find(m => m.id === memberId);
    return member?.name ?? memberId;
  }

  /**
   * Build assignment candidates from active teammates.
   */
  private buildAssignmentCandidates(team: TeamConfig, taskList: SharedTaskList): AssignmentCandidate[] {
    const assigner = this.assigners.get(team.id);

    return team.members
      .filter(m => m.role !== 'lead' && (m.status === 'active' || m.status === 'idle'))
      .map(m => {
        const caps = assigner?.getCapabilities(m.id);
        const activeTasks = taskList.getTasksForTeammate(m.id)
          .filter(t => t.status === 'in_progress');

        return {
          memberId: m.id,
          name: m.name,
          activeTaskCount: activeTasks.length,
          capabilities: caps?.capabilities ?? [],
          maxConcurrent: caps?.maxConcurrent ?? this.defaultMaxConcurrentTasks,
        };
      });
  }

  /**
   * Called when all tasks in a team's task list are completed.
   * Aggregates results and optionally auto-cleans up.
   */
  private onAllTasksComplete(teamId: string): void {
    const settings = this.teamContext.getSettings(teamId);
    const result = this.aggregateResults(teamId);
    if (result) {
      this.emit('team:all-tasks-complete', teamId, result);
    }

    if (settings.autoCleanupOnComplete) {
      void this.forceShutdownTeam(teamId);
    }
  }

  /**
   * Check if the current process is running inside a tmux session.
   */
  private isInsideTmux(): boolean {
    return process.env['TMUX'] !== undefined && process.env['TMUX'] !== '';
  }

  /**
   * Check if tmux is available on the system.
   * Uses execFileSync (not execSync) to avoid shell injection risks.
   */
  private isTmuxAvailable(): boolean {
    try {
      execFileSync('which', ['tmux'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if iTerm2 with the it2 CLI is available.
   * Uses execFileSync (not execSync) to avoid shell injection risks.
   */
  private isITerm2Available(): boolean {
    // Check for ITERM_SESSION_ID (set when running inside iTerm2)
    if (!process.env['ITERM_SESSION_ID']) {
      return false;
    }

    try {
      execFileSync('which', ['it2'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}
