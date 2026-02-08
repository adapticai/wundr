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
 * Integration points:
 * - SessionManager: spawns teammate sessions
 * - SharedTaskList: cross-session task coordination
 * - Mailbox: inter-teammate messaging
 * - TeamHooks: quality gate enforcement
 */

import { execFileSync } from 'child_process';

import { EventEmitter } from 'eventemitter3';

import { Mailbox } from './mailbox';
import { SharedTaskList, type CreateTaskInput } from './shared-task-list';
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
}

export interface SpawnTeammateOptions {
  readonly name: string;
  readonly role: string;
  readonly prompt: string;
  readonly model?: string;
  readonly planApprovalRequired?: boolean;
  readonly agentType?: string;
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
  'teammate:spawned': (teamId: string, member: TeamMember) => void;
  'teammate:active': (teamId: string, memberId: string) => void;
  'teammate:idle': (teamId: string, memberId: string) => void;
  'teammate:stopped': (teamId: string, memberId: string) => void;
  'teammate:shutdown-requested': (teamId: string, memberId: string) => void;
  'teammate:crash-recovered': (teamId: string, memberId: string, releasedTasks: string[]) => void;
  'delegate-mode:changed': (teamId: string, enabled: boolean) => void;
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

  private nextTeamNumber = 1;
  private nextMemberNumber = 1;

  constructor(private readonly sessionManager: TeamSessionManager) {
    super();
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

    const teamId = `team_${this.nextTeamNumber++}_${Date.now()}`;
    const teammateMode = input.teammateMode ?? 'auto';
    const resolvedBackend = this.detectBackend(teammateMode);

    const team: TeamConfig = {
      id: teamId,
      name: input.name,
      leadSessionId,
      teammateMode,
      resolvedBackend,
      maxTeammates: input.maxTeammates ?? 10,
      delegateMode: input.delegateMode ?? false,
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

    // Wire hooks into task list and mailbox
    taskList.setTaskCompletedHook(
      this.hooks.createTaskCompletedCallback(memberId => this.getMemberName(teamId, memberId)),
    );
    mailbox.setTeammateIdleHook(this.hooks.createTeammateIdleCallback());

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
    if (activeTeammates.length >= team.maxTeammates) {
      throw new TeamError(
        TeamErrorCode.MAX_TEAMMATES_REACHED,
        `Team ${teamId} has reached the maximum of ${team.maxTeammates} teammates`,
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

    // Clean up hooks
    this.hooks.clearHooks(teamId);

    // Clean up session mappings
    this.sessionToTeam.delete(team.leadSessionId);
    for (const member of team.members) {
      this.teammateSessionToTeam.delete(member.sessionId);
    }

    team.status = 'cleaned-up';
    this.teams.delete(teamId);

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
    if (!teamId) return; // Not a team session

    const team = this.teams.get(teamId);
    if (!team) return;

    const member = team.members.find(m => m.sessionId === sessionId);
    if (!member) return;

    member.status = 'stopped';
    this.teammateSessionToTeam.delete(sessionId);

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
    if (teamId) return this.teams.get(teamId);

    // Check if it's a teammate session
    const teammateTeamId = this.teammateSessionToTeam.get(sessionId);
    if (teammateTeamId) return this.teams.get(teammateTeamId);

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
    if (!team) return undefined;
    return team.members.find(m => m.id === memberId);
  }

  /**
   * Get active (non-stopped) teammates for a team (excludes lead).
   */
  getActiveTeammates(teamId: string): TeamMember[] {
    const team = this.teams.get(teamId);
    if (!team) return [];
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
  } | undefined {
    const team = this.teams.get(teamId);
    if (!team) return undefined;

    const taskList = this.taskLists.get(teamId);
    const mailbox = this.mailboxes.get(teamId);

    return {
      team,
      taskStats: taskList?.getStats() ?? { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0 },
      mailboxStats: mailbox?.getStats() ?? { totalMessages: 0, memberCount: 0, unreadByMember: {} },
      hooks: this.hooks.getRegisteredHooks(teamId),
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
    if (!team) return memberId;
    const member = team.members.find(m => m.id === memberId);
    return member?.name ?? memberId;
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
