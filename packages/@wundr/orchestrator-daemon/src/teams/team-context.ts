/**
 * Team Context - Shared memory, progress reporting, and result aggregation
 *
 * Provides:
 * - Shared key-value context accessible by all team members
 * - Team progress tracking and reporting
 * - Team result aggregation after all tasks complete
 * - Team configuration from settings (TeamSettingsConfig)
 * - Max team size enforcement
 * - Session cleanup tracking
 *
 * This module is the central data store for cross-teammate shared state.
 * Unlike the SharedTaskList (which tracks tasks) and Mailbox (which tracks
 * messages), TeamContext tracks arbitrary shared data, progress summaries,
 * and aggregated outcomes.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedContextEntry {
  readonly key: string;
  value: unknown;
  readonly setBy: string;
  readonly setAt: Date;
  updatedBy: string;
  updatedAt: Date;
  /** Access log: memberId -> last accessed timestamp. */
  readonly accessLog: Map<string, Date>;
}

export interface TeamProgress {
  readonly teamId: string;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly inProgressTasks: number;
  readonly blockedTasks: number;
  readonly pendingTasks: number;
  readonly percentComplete: number;
  readonly activeTeammates: number;
  readonly totalTeammates: number;
  readonly startedAt: Date;
  readonly estimatedCompletion: Date | null;
  readonly elapsedMs: number;
  readonly avgTaskDurationMs: number;
}

export interface TeamResult {
  readonly teamId: string;
  readonly teamName: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly cancelledTasks: number;
  readonly results: TaskResult[];
  readonly sharedContext: Record<string, unknown>;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly totalDurationMs: number;
  readonly memberContributions: MemberContribution[];
}

export interface TaskResult {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly completedBy: string | null;
  readonly durationMs: number;
  readonly output: unknown;
}

export interface MemberContribution {
  readonly memberId: string;
  readonly memberName: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly totalDurationMs: number;
  readonly avgTaskDurationMs: number;
}

export interface TeamSettingsConfig {
  /** Maximum number of teammates (excluding lead). */
  readonly maxTeamSize: number;
  /** Default teammate mode. */
  readonly defaultTeammateMode: 'in-process' | 'tmux' | 'auto';
  /** Default max concurrent tasks per teammate. */
  readonly defaultMaxConcurrentTasks: number;
  /** Default task assignment strategy. */
  readonly defaultAssignmentStrategy: 'round-robin' | 'capability-based' | 'load-balanced';
  /** Auto-assign pending tasks when a teammate becomes idle. */
  readonly autoAssignOnIdle: boolean;
  /** Auto-cleanup team when all tasks are completed. */
  readonly autoCleanupOnComplete: boolean;
  /** Session monitor interval in ms. */
  readonly monitorIntervalMs: number;
  /** Stale session threshold in ms. */
  readonly staleThresholdMs: number;
  /** Max shared context entries per team. */
  readonly maxContextEntries: number;
  /** Max message history per mailbox member. */
  readonly maxMessageHistory: number;
  /** Enable delegate mode by default. */
  readonly defaultDelegateMode: boolean;
  /** Team session cleanup timeout in ms (grace period after shutdown). */
  readonly cleanupTimeoutMs: number;
}

export interface TeamContextEvents {
  'context:set': (teamId: string, key: string, value: unknown, setBy: string) => void;
  'context:updated': (teamId: string, key: string, value: unknown, updatedBy: string) => void;
  'context:deleted': (teamId: string, key: string) => void;
  'context:cleared': (teamId: string) => void;
  'progress:updated': (progress: TeamProgress) => void;
  'result:aggregated': (result: TeamResult) => void;
  'cleanup:started': (teamId: string) => void;
  'cleanup:completed': (teamId: string, durationMs: number) => void;
  'cleanup:timeout': (teamId: string) => void;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TeamContextError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TeamContextError';
  }
}

export enum TeamContextErrorCode {
  CONTEXT_KEY_NOT_FOUND = 'CONTEXT_KEY_NOT_FOUND',
  MAX_ENTRIES_REACHED = 'MAX_ENTRIES_REACHED',
  TEAM_NOT_REGISTERED = 'TEAM_NOT_REGISTERED',
  INVALID_SETTINGS = 'INVALID_SETTINGS',
  CLEANUP_IN_PROGRESS = 'CLEANUP_IN_PROGRESS',
}

// ---------------------------------------------------------------------------
// Default Settings
// ---------------------------------------------------------------------------

export const DEFAULT_TEAM_SETTINGS: TeamSettingsConfig = {
  maxTeamSize: 10,
  defaultTeammateMode: 'auto',
  defaultMaxConcurrentTasks: 3,
  defaultAssignmentStrategy: 'load-balanced',
  autoAssignOnIdle: true,
  autoCleanupOnComplete: false,
  monitorIntervalMs: 30_000,
  staleThresholdMs: 120_000,
  maxContextEntries: 500,
  maxMessageHistory: 1000,
  defaultDelegateMode: false,
  cleanupTimeoutMs: 60_000,
};

// ---------------------------------------------------------------------------
// Team Context
// ---------------------------------------------------------------------------

export class TeamContext extends EventEmitter<TeamContextEvents> {
  /**
   * Shared context store per team: teamId -> key -> entry.
   */
  private readonly stores: Map<string, Map<string, SharedContextEntry>> = new Map();

  /**
   * Task results per team: teamId -> taskId -> result.
   */
  private readonly taskResults: Map<string, Map<string, TaskResult>> = new Map();

  /**
   * Team start times for progress calculation.
   */
  private readonly teamStartTimes: Map<string, Date> = new Map();

  /**
   * Completed task durations per team for ETA estimation.
   */
  private readonly taskDurations: Map<string, number[]> = new Map();

  /**
   * Cleanup tracking: teamId -> { startedAt, timeoutHandle }.
   */
  private readonly cleanupTracking: Map<string, {
    startedAt: Date;
    timeoutHandle: ReturnType<typeof setTimeout>;
  }> = new Map();

  /**
   * Settings per team (or global defaults).
   */
  private readonly teamSettings: Map<string, TeamSettingsConfig> = new Map();

  /**
   * Global default settings.
   */
  private globalSettings: TeamSettingsConfig;

  constructor(settings?: Partial<TeamSettingsConfig>) {
    super();
    this.globalSettings = { ...DEFAULT_TEAM_SETTINGS, ...settings };
  }

  // -------------------------------------------------------------------------
  // Settings Management
  // -------------------------------------------------------------------------

  /**
   * Get the effective settings for a team (team-specific or global defaults).
   */
  getSettings(teamId?: string): TeamSettingsConfig {
    if (teamId) {
      const teamSpecific = this.teamSettings.get(teamId);
      if (teamSpecific) {
return teamSpecific;
}
    }
    return this.globalSettings;
  }

  /**
   * Set team-specific settings (merged with global defaults).
   */
  setTeamSettings(teamId: string, settings: Partial<TeamSettingsConfig>): TeamSettingsConfig {
    const merged: TeamSettingsConfig = {
      ...this.globalSettings,
      ...settings,
    };
    this.teamSettings.set(teamId, merged);
    return merged;
  }

  /**
   * Update global default settings.
   */
  setGlobalSettings(settings: Partial<TeamSettingsConfig>): TeamSettingsConfig {
    this.globalSettings = { ...this.globalSettings, ...settings };
    return this.globalSettings;
  }

  /**
   * Validate that a new teammate can be added to the team.
   * Enforces maxTeamSize from settings.
   */
  validateTeamSize(teamId: string, currentSize: number): boolean {
    const settings = this.getSettings(teamId);
    return currentSize < settings.maxTeamSize;
  }

  // -------------------------------------------------------------------------
  // Team Registration
  // -------------------------------------------------------------------------

  /**
   * Register a team for context tracking.
   */
  registerTeam(teamId: string, settings?: Partial<TeamSettingsConfig>): void {
    if (!this.stores.has(teamId)) {
      this.stores.set(teamId, new Map());
    }
    if (!this.taskResults.has(teamId)) {
      this.taskResults.set(teamId, new Map());
    }
    if (!this.taskDurations.has(teamId)) {
      this.taskDurations.set(teamId, []);
    }
    this.teamStartTimes.set(teamId, new Date());

    if (settings) {
      this.setTeamSettings(teamId, settings);
    }
  }

  /**
   * Unregister a team and clean up all its context.
   */
  unregisterTeam(teamId: string): void {
    this.stores.delete(teamId);
    this.taskResults.delete(teamId);
    this.taskDurations.delete(teamId);
    this.teamStartTimes.delete(teamId);
    this.teamSettings.delete(teamId);

    const cleanup = this.cleanupTracking.get(teamId);
    if (cleanup) {
      clearTimeout(cleanup.timeoutHandle);
      this.cleanupTracking.delete(teamId);
    }

    this.emit('context:cleared', teamId);
  }

  // -------------------------------------------------------------------------
  // Shared Context (Key-Value Store)
  // -------------------------------------------------------------------------

  /**
   * Set a value in the shared context.
   */
  set(teamId: string, key: string, value: unknown, memberId: string): void {
    const store = this.getStoreOrThrow(teamId);
    const settings = this.getSettings(teamId);

    const existing = store.get(key);
    if (existing) {
      existing.value = value;
      existing.updatedBy = memberId;
      existing.updatedAt = new Date();
      this.emit('context:updated', teamId, key, value, memberId);
    } else {
      // Check max entries
      if (store.size >= settings.maxContextEntries) {
        throw new TeamContextError(
          TeamContextErrorCode.MAX_ENTRIES_REACHED,
          `Shared context for team ${teamId} has reached maximum ${settings.maxContextEntries} entries`,
        );
      }

      const now = new Date();
      const entry: SharedContextEntry = {
        key,
        value,
        setBy: memberId,
        setAt: now,
        updatedBy: memberId,
        updatedAt: now,
        accessLog: new Map(),
      };
      store.set(key, entry);
      this.emit('context:set', teamId, key, value, memberId);
    }
  }

  /**
   * Get a value from the shared context.
   * Records the access in the entry's access log.
   */
  get<T = unknown>(teamId: string, key: string, memberId?: string): T | undefined {
    const store = this.stores.get(teamId);
    if (!store) {
return undefined;
}

    const entry = store.get(key);
    if (!entry) {
return undefined;
}

    if (memberId) {
      entry.accessLog.set(memberId, new Date());
    }

    return entry.value as T;
  }

  /**
   * Check if a key exists in the shared context.
   */
  has(teamId: string, key: string): boolean {
    const store = this.stores.get(teamId);
    return store?.has(key) ?? false;
  }

  /**
   * Delete a key from the shared context.
   */
  delete(teamId: string, key: string): boolean {
    const store = this.stores.get(teamId);
    if (!store) {
return false;
}

    const deleted = store.delete(key);
    if (deleted) {
      this.emit('context:deleted', teamId, key);
    }
    return deleted;
  }

  /**
   * Get all shared context keys for a team.
   */
  keys(teamId: string): string[] {
    const store = this.stores.get(teamId);
    if (!store) {
return [];
}
    return Array.from(store.keys());
  }

  /**
   * Get the full shared context as a plain object.
   */
  getAll(teamId: string): Record<string, unknown> {
    const store = this.stores.get(teamId);
    if (!store) {
return {};
}

    const result: Record<string, unknown> = {};
    for (const [key, entry] of store) {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Get metadata for a shared context entry (everything except the value).
   */
  getEntryMetadata(teamId: string, key: string): {
    key: string;
    setBy: string;
    setAt: Date;
    updatedBy: string;
    updatedAt: Date;
    accessLog: Map<string, Date>;
  } | undefined {
    const store = this.stores.get(teamId);
    if (!store) {
return undefined;
}

    const entry = store.get(key);
    if (!entry) {
return undefined;
}

    return {
      key: entry.key,
      setBy: entry.setBy,
      setAt: entry.setAt,
      updatedBy: entry.updatedBy,
      updatedAt: entry.updatedAt,
      accessLog: entry.accessLog,
    };
  }

  /**
   * Get the number of shared context entries for a team.
   */
  size(teamId: string): number {
    return this.stores.get(teamId)?.size ?? 0;
  }

  // -------------------------------------------------------------------------
  // Task Results
  // -------------------------------------------------------------------------

  /**
   * Record a task result for aggregation.
   */
  recordTaskResult(teamId: string, result: TaskResult): void {
    const results = this.taskResults.get(teamId);
    if (!results) {
return;
}

    results.set(result.taskId, result);

    // Track duration for ETA estimation
    if (result.status === 'completed' && result.durationMs > 0) {
      const durations = this.taskDurations.get(teamId);
      if (durations) {
        durations.push(result.durationMs);
      }
    }
  }

  /**
   * Get a specific task result.
   */
  getTaskResult(teamId: string, taskId: string): TaskResult | undefined {
    return this.taskResults.get(teamId)?.get(taskId);
  }

  /**
   * Get all task results for a team.
   */
  getTaskResults(teamId: string): TaskResult[] {
    const results = this.taskResults.get(teamId);
    if (!results) {
return [];
}
    return Array.from(results.values());
  }

  // -------------------------------------------------------------------------
  // Progress Reporting
  // -------------------------------------------------------------------------

  /**
   * Calculate and return the current team progress.
   *
   * @param teamId - The team ID
   * @param taskStats - Current task statistics from SharedTaskList
   * @param activeTeammates - Number of active teammates
   * @param totalTeammates - Total number of teammates (including stopped)
   */
  getProgress(
    teamId: string,
    taskStats: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      blocked: number;
    },
    activeTeammates: number,
    totalTeammates: number,
  ): TeamProgress {
    const startedAt = this.teamStartTimes.get(teamId) ?? new Date();
    const now = new Date();
    const elapsedMs = now.getTime() - startedAt.getTime();

    const percentComplete = taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

    // Estimate completion based on average task duration
    const durations = this.taskDurations.get(teamId) ?? [];
    const avgTaskDurationMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    let estimatedCompletion: Date | null = null;
    if (avgTaskDurationMs > 0 && activeTeammates > 0) {
      const remainingTasks = taskStats.pending + taskStats.inProgress + taskStats.blocked;
      const estimatedRemainingMs = (remainingTasks * avgTaskDurationMs) / activeTeammates;
      estimatedCompletion = new Date(now.getTime() + estimatedRemainingMs);
    }

    const progress: TeamProgress = {
      teamId,
      totalTasks: taskStats.total,
      completedTasks: taskStats.completed,
      inProgressTasks: taskStats.inProgress,
      blockedTasks: taskStats.blocked,
      pendingTasks: taskStats.pending,
      percentComplete,
      activeTeammates,
      totalTeammates,
      startedAt,
      estimatedCompletion,
      elapsedMs,
      avgTaskDurationMs,
    };

    this.emit('progress:updated', progress);
    return progress;
  }

  // -------------------------------------------------------------------------
  // Result Aggregation
  // -------------------------------------------------------------------------

  /**
   * Aggregate all task results into a final team result.
   *
   * @param teamId - The team ID
   * @param teamName - The team name
   * @param memberInfo - Map of memberId -> { name, tasksCompleted, tasksFailed }
   */
  aggregateResults(
    teamId: string,
    teamName: string,
    memberInfo: Map<string, { name: string; tasksCompleted: number; tasksFailed: number }>,
  ): TeamResult {
    const results = this.getTaskResults(teamId);
    const startedAt = this.teamStartTimes.get(teamId) ?? new Date();
    const completedAt = new Date();

    const completedTasks = results.filter(r => r.status === 'completed').length;
    const failedTasks = results.filter(r => r.status === 'failed').length;
    const cancelledTasks = results.filter(r => r.status === 'cancelled').length;

    let status: 'completed' | 'partial' | 'failed';
    if (failedTasks === results.length && results.length > 0) {
      status = 'failed';
    } else if (completedTasks === results.length) {
      status = 'completed';
    } else {
      status = 'partial';
    }

    // Calculate member contributions
    const memberContributions: MemberContribution[] = [];
    for (const [memberId, info] of memberInfo) {
      const memberResults = results.filter(r => r.completedBy === memberId);
      const totalDuration = memberResults.reduce((sum, r) => sum + r.durationMs, 0);
      const taskCount = memberResults.length;

      memberContributions.push({
        memberId,
        memberName: info.name,
        tasksCompleted: info.tasksCompleted,
        tasksFailed: info.tasksFailed,
        totalDurationMs: totalDuration,
        avgTaskDurationMs: taskCount > 0 ? totalDuration / taskCount : 0,
      });
    }

    const teamResult: TeamResult = {
      teamId,
      teamName,
      status,
      totalTasks: results.length,
      completedTasks,
      failedTasks,
      cancelledTasks,
      results,
      sharedContext: this.getAll(teamId),
      startedAt,
      completedAt,
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      memberContributions,
    };

    this.emit('result:aggregated', teamResult);
    return teamResult;
  }

  // -------------------------------------------------------------------------
  // Session Cleanup Tracking
  // -------------------------------------------------------------------------

  /**
   * Start tracking a team cleanup operation.
   * Sets a timeout to fire 'cleanup:timeout' if the cleanup takes too long.
   */
  startCleanup(teamId: string): void {
    if (this.cleanupTracking.has(teamId)) {
      throw new TeamContextError(
        TeamContextErrorCode.CLEANUP_IN_PROGRESS,
        `Cleanup already in progress for team ${teamId}`,
      );
    }

    const settings = this.getSettings(teamId);
    const startedAt = new Date();

    this.emit('cleanup:started', teamId);

    const timeoutHandle = setTimeout(() => {
      this.cleanupTracking.delete(teamId);
      this.emit('cleanup:timeout', teamId);
    }, settings.cleanupTimeoutMs);

    // Do not let the timeout prevent process exit
    if (timeoutHandle.unref) {
      timeoutHandle.unref();
    }

    this.cleanupTracking.set(teamId, { startedAt, timeoutHandle });
  }

  /**
   * Complete a tracked cleanup operation.
   */
  completeCleanup(teamId: string): void {
    const tracking = this.cleanupTracking.get(teamId);
    if (!tracking) {
return;
}

    clearTimeout(tracking.timeoutHandle);
    const durationMs = Date.now() - tracking.startedAt.getTime();
    this.cleanupTracking.delete(teamId);

    this.emit('cleanup:completed', teamId, durationMs);
  }

  /**
   * Check if a cleanup is in progress for a team.
   */
  isCleanupInProgress(teamId: string): boolean {
    return this.cleanupTracking.has(teamId);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Clear all data for all teams.
   */
  clearAll(): void {
    for (const teamId of Array.from(this.stores.keys())) {
      this.unregisterTeam(teamId);
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private getStoreOrThrow(teamId: string): Map<string, SharedContextEntry> {
    const store = this.stores.get(teamId);
    if (!store) {
      throw new TeamContextError(
        TeamContextErrorCode.TEAM_NOT_REGISTERED,
        `Team ${teamId} is not registered for context tracking`,
      );
    }
    return store;
  }
}
