/**
 * CronScheduler - setInterval-based cron scheduling for the orchestrator daemon
 *
 * Parses a subset of standard cron expressions and fires scheduled tasks via
 * EventEmitter events. Supports common patterns used by the daemon's built-in
 * schedules as well as arbitrary user-defined tasks.
 *
 * Supported cron syntax:
 *   * * * * *  (minute, hour, dayOfMonth, month, dayOfWeek)
 *   - Wildcard:   *
 *   - Fixed:      0, 15, 30, etc.
 *   - Step:       *\/15  (every N units)
 *   - List:       1,15,30
 *
 * The scheduler polls every minute and evaluates whether each task's cron
 * expression matches the current wall-clock time.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduledTaskType =
  | 'BACKLOG_REVIEW'
  | 'STATUS_REPORT'
  | 'PROACTIVE_SCAN'
  | 'MAINTENANCE'
  | 'CHARTER_SYNC'
  | 'MEMORY_CLEANUP'
  | 'HEALTH_CHECK'
  | 'CUSTOM';

export interface ScheduledTask {
  id: string;
  name: string;
  /** Standard cron expression: 'minute hour dayOfMonth month dayOfWeek' */
  cronExpression: string;
  taskType: ScheduledTaskType;
  config: Record<string, unknown>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  /** Stop firing after this many executions. Omit for unlimited. */
  maxRuns?: number;
}

export interface SchedulerEventMap {
  'task:triggered': (event: { task: ScheduledTask; firedAt: Date }) => void;
  'task:completed': (event: {
    taskId: string;
    firedAt: Date;
    durationMs: number;
  }) => void;
  'task:failed': (event: {
    taskId: string;
    firedAt: Date;
    error: unknown;
  }) => void;
  'scheduler:started': () => void;
  'scheduler:stopped': () => void;
}

export interface ScheduledRunInfo {
  taskId: string;
  taskName: string;
  firedAt: Date;
}

// ---------------------------------------------------------------------------
// Cron expression parser
// ---------------------------------------------------------------------------

interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

type CronField =
  | { type: 'wildcard' }
  | { type: 'fixed'; values: number[] }
  | { type: 'step'; step: number }
  | { type: 'list'; values: number[] };

function parseField(raw: string, min: number, max: number): CronField {
  if (raw === '*') {
    return { type: 'wildcard' };
  }

  // Step: */N
  const stepMatch = raw.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    if (step < 1) {
      throw new Error(`Invalid cron step value: ${raw}`);
    }
    return { type: 'step', step };
  }

  // List: 1,2,3 or single value 5
  const parts = raw.split(',').map(p => {
    const n = parseInt(p.trim(), 10);
    if (isNaN(n) || n < min || n > max) {
      throw new Error(`Cron field value ${p} out of range [${min},${max}]`);
    }
    return n;
  });

  if (parts.length === 1) {
    return { type: 'fixed', values: parts };
  }

  return { type: 'list', values: parts };
}

function parseCronExpression(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression "${expr}": expected 5 fields (minute hour dayOfMonth month dayOfWeek)`
    );
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

function fieldMatches(field: CronField, value: number): boolean {
  switch (field.type) {
    case 'wildcard':
      return true;
    case 'fixed':
      return field.values.includes(value);
    case 'list':
      return field.values.includes(value);
    case 'step':
      return value % field.step === 0;
  }
}

function cronMatchesDate(cron: ParsedCron, date: Date): boolean {
  return (
    fieldMatches(cron.minute, date.getMinutes()) &&
    fieldMatches(cron.hour, date.getHours()) &&
    fieldMatches(cron.dayOfMonth, date.getDate()) &&
    fieldMatches(cron.month, date.getMonth() + 1) && // getMonth() is 0-indexed
    fieldMatches(cron.dayOfWeek, date.getDay())
  );
}

/**
 * Compute the next Date at or after `from` when the cron expression fires.
 * Searches up to 366 days ahead to avoid infinite loops on edge cases.
 */
function computeNextRun(expr: string, from: Date): Date | null {
  let cron: ParsedCron;
  try {
    cron = parseCronExpression(expr);
  } catch {
    return null;
  }

  // Advance to the next full minute boundary
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000);

  while (candidate <= limit) {
    if (cronMatchesDate(cron, candidate)) {
      return new Date(candidate);
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
}

// ---------------------------------------------------------------------------
// CronScheduler
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000; // 1 minute

export class CronScheduler extends EventEmitter<SchedulerEventMap> {
  private tasks: Map<string, ScheduledTask> = new Map();
  private parsedCrons: Map<string, ParsedCron> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollMinute: number = -1;

  // -------------------------------------------------------------------------
  // Task registration
  // -------------------------------------------------------------------------

  /**
   * Register a new scheduled task. Replaces any existing task with the same id.
   * Throws if the cron expression is invalid.
   */
  registerTask(task: ScheduledTask): void {
    const parsed = parseCronExpression(task.cronExpression);
    this.parsedCrons.set(task.id, parsed);

    const withNextRun: ScheduledTask = {
      ...task,
      nextRun: computeNextRun(task.cronExpression, new Date()) ?? undefined,
    };

    this.tasks.set(task.id, withNextRun);
  }

  /**
   * Remove a scheduled task by id. No-op if not found.
   */
  unregisterTask(id: string): void {
    this.tasks.delete(id);
    this.parsedCrons.delete(id);
  }

  /**
   * Enable a previously disabled task.
   */
  enableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, enabled: true });
    }
  }

  /**
   * Disable a task without removing it.
   */
  disableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, enabled: false });
    }
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Return a copy of all registered tasks.
   */
  getSchedule(): ScheduledTask[] {
    return Array.from(this.tasks.values()).map(t => ({ ...t }));
  }

  /**
   * Return the next `count` scheduled runs across all enabled tasks,
   * ordered chronologically.
   */
  getNextRuns(count: number = 10): ScheduledRunInfo[] {
    const now = new Date();
    const runs: Array<{ firedAt: Date; task: ScheduledTask }> = [];

    for (const task of this.tasks.values()) {
      if (!task.enabled) {
        continue;
      }

      // Iterate to find the next `count` runs for this task
      let from = now;
      for (let i = 0; i < count; i++) {
        const next = computeNextRun(task.cronExpression, from);
        if (!next) {
          break;
        }
        runs.push({ firedAt: next, task });
        from = next;
      }
    }

    runs.sort((a, b) => a.firedAt.getTime() - b.firedAt.getTime());

    return runs.slice(0, count).map(r => ({
      taskId: r.task.id,
      taskName: r.task.name,
      firedAt: r.firedAt,
    }));
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the scheduler. Sets up a polling interval that fires every minute
   * and evaluates all registered tasks against the current time.
   */
  start(): void {
    if (this.pollTimer !== null) {
      return; // Already running
    }

    // Align to the next minute boundary for predictable firing
    const now = new Date();
    const msUntilNextMinute =
      POLL_INTERVAL_MS -
      ((now.getSeconds() * 1000 + now.getMilliseconds()) % POLL_INTERVAL_MS);

    const beginPolling = (): void => {
      this.lastPollMinute = -1;
      this.pollTimer = setInterval(() => {
        this.tick();
      }, POLL_INTERVAL_MS);
      this.tick(); // Evaluate immediately on start
    };

    // Wait until the next minute boundary, then begin regular polling
    setTimeout(beginPolling, msUntilNextMinute);

    this.emit('scheduler:started');
  }

  /**
   * Stop the scheduler and clear the polling interval.
   */
  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.emit('scheduler:stopped');
  }

  // -------------------------------------------------------------------------
  // Internal tick
  // -------------------------------------------------------------------------

  private tick(): void {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    // Deduplicate: only fire once per minute
    if (currentMinute === this.lastPollMinute) {
      return;
    }
    this.lastPollMinute = currentMinute;

    for (const [id, task] of this.tasks) {
      if (!task.enabled) {
        continue;
      }

      if (task.maxRuns !== undefined && task.runCount >= task.maxRuns) {
        continue;
      }

      const parsed = this.parsedCrons.get(id);
      if (!parsed) {
        continue;
      }

      if (!cronMatchesDate(parsed, now)) {
        continue;
      }

      this.fireTask(task, now);
    }
  }

  private fireTask(task: ScheduledTask, firedAt: Date): void {
    const firedAtCopy = new Date(firedAt);
    const startMs = Date.now();

    const updated: ScheduledTask = {
      ...task,
      lastRun: firedAtCopy,
      runCount: task.runCount + 1,
      nextRun: computeNextRun(task.cronExpression, firedAtCopy) ?? undefined,
    };
    this.tasks.set(task.id, updated);

    this.emit('task:triggered', { task: updated, firedAt: firedAtCopy });

    // Give downstream listeners a chance to handle the event, then emit
    // task:completed. Failures must be caught by listeners themselves and
    // re-emitted via task:failed if desired. For fire-and-forget tasks the
    // scheduler emits completed immediately after triggered.
    setImmediate(() => {
      try {
        const durationMs = Date.now() - startMs;
        this.emit('task:completed', {
          taskId: task.id,
          firedAt: firedAtCopy,
          durationMs,
        });
      } catch (error) {
        this.emit('task:failed', {
          taskId: task.id,
          firedAt: firedAtCopy,
          error,
        });
      }
    });
  }
}
