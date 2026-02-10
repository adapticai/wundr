/**
 * Progress Manager - Progress bars and spinners for long-running operations.
 *
 * Provides:
 * - Single and multi-bar progress tracking
 * - Spinner for indeterminate operations
 * - ETA calculation
 * - Step-based progress for sequential operations
 * - Pipe-safe (no-op when stdout is not a TTY)
 *
 * @module framework/progress-manager
 */

import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a progress bar.
 */
export interface ProgressBarOptions {
  /** Total number of units. */
  total: number;

  /** Bar width in characters. Defaults to 30. */
  width?: number;

  /** Label displayed before the bar. */
  label?: string;

  /** Filled character. Defaults to '='. */
  filledChar?: string;

  /** Empty character. Defaults to '-'. */
  emptyChar?: string;

  /** Show percentage. Defaults to true. */
  showPercentage?: boolean;

  /** Show ETA. Defaults to true. */
  showETA?: boolean;

  /** Show count (current/total). Defaults to true. */
  showCount?: boolean;

  /** Custom format function. */
  format?: (state: ProgressState) => string;
}

/**
 * Current state of a progress bar.
 */
export interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  elapsed: number;
  eta: number;
  rate: number;
  label: string;
}

/**
 * A step in a multi-step operation.
 */
export interface ProgressStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  message?: string;
  duration?: number;
}

/**
 * Configuration for a multi-step tracker.
 */
export interface StepTrackerOptions {
  /** Whether to show step numbers. Defaults to true. */
  showNumbers?: boolean;

  /** Whether to show elapsed time per step. Defaults to true. */
  showDuration?: boolean;
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

export class ProgressBar {
  private current: number = 0;
  private startTime: number;
  private options: Required<
    Pick<ProgressBarOptions, 'total' | 'width' | 'label' | 'filledChar' | 'emptyChar' | 'showPercentage' | 'showETA' | 'showCount'>
  > & Pick<ProgressBarOptions, 'format'>;
  private isTTY: boolean;
  private lastRender: string = '';

  constructor(options: ProgressBarOptions) {
    this.startTime = Date.now();
    this.isTTY = process.stderr.isTTY === true;
    this.options = {
      total: options.total,
      width: options.width ?? 30,
      label: options.label ?? '',
      filledChar: options.filledChar ?? '=',
      emptyChar: options.emptyChar ?? '-',
      showPercentage: options.showPercentage ?? true,
      showETA: options.showETA ?? true,
      showCount: options.showCount ?? true,
      format: options.format,
    };
  }

  /**
   * Update progress to a specific value.
   */
  update(value: number): void {
    this.current = Math.min(value, this.options.total);
    this.render();
  }

  /**
   * Increment progress by a given amount.
   */
  increment(amount: number = 1): void {
    this.update(this.current + amount);
  }

  /**
   * Get the current state.
   */
  getState(): ProgressState {
    const elapsed = Date.now() - this.startTime;
    const percentage = this.options.total > 0
      ? this.current / this.options.total
      : 0;
    const rate = elapsed > 0 ? (this.current / elapsed) * 1000 : 0;
    const remaining = this.options.total - this.current;
    const eta = rate > 0 ? (remaining / rate) * 1000 : 0;

    return {
      current: this.current,
      total: this.options.total,
      percentage,
      elapsed,
      eta,
      rate,
      label: this.options.label,
    };
  }

  /**
   * Render the progress bar to stderr.
   */
  render(): void {
    if (!this.isTTY) return;

    const state = this.getState();
    let line: string;

    if (this.options.format) {
      line = this.options.format(state);
    } else {
      line = this.defaultFormat(state);
    }

    // Only rewrite if changed
    if (line !== this.lastRender) {
      process.stderr.clearLine(0);
      process.stderr.cursorTo(0);
      process.stderr.write(line);
      this.lastRender = line;
    }
  }

  /**
   * Finish the progress bar (add newline).
   */
  finish(message?: string): void {
    if (!this.isTTY) return;

    this.current = this.options.total;
    this.render();
    process.stderr.write('\n');

    if (message) {
      process.stderr.write(message + '\n');
    }
  }

  /**
   * Render the bar as a string (for non-interactive use).
   */
  toString(): string {
    const state = this.getState();
    if (this.options.format) {
      return this.options.format(state);
    }
    return this.defaultFormat(state);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private defaultFormat(state: ProgressState): string {
    const parts: string[] = [];

    // Label
    if (this.options.label) {
      parts.push(chalk.cyan(this.options.label));
    }

    // Bar
    const filled = Math.round(state.percentage * this.options.width);
    const empty = this.options.width - filled;
    const bar =
      chalk.cyan('[') +
      chalk.green(this.options.filledChar.repeat(filled)) +
      chalk.gray(this.options.emptyChar.repeat(empty)) +
      chalk.cyan(']');
    parts.push(bar);

    // Percentage
    if (this.options.showPercentage) {
      parts.push(`${(state.percentage * 100).toFixed(0)}%`);
    }

    // Count
    if (this.options.showCount) {
      parts.push(chalk.gray(`${state.current}/${state.total}`));
    }

    // ETA
    if (this.options.showETA && state.current > 0 && state.current < state.total) {
      parts.push(chalk.gray(`ETA: ${this.formatTime(state.eta)}`));
    }

    return parts.join(' ');
  }

  private formatTime(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds}s`;
  }
}

// ---------------------------------------------------------------------------
// Multi-Progress Manager
// ---------------------------------------------------------------------------

export class MultiProgressManager {
  private bars: Map<string, ProgressBar> = new Map();

  /**
   * Create and register a new progress bar.
   */
  create(id: string, options: ProgressBarOptions): ProgressBar {
    const bar = new ProgressBar(options);
    this.bars.set(id, bar);
    return bar;
  }

  /**
   * Get a progress bar by ID.
   */
  get(id: string): ProgressBar | undefined {
    return this.bars.get(id);
  }

  /**
   * Update a progress bar by ID.
   */
  update(id: string, value: number): void {
    this.bars.get(id)?.update(value);
  }

  /**
   * Finish and remove a progress bar.
   */
  finish(id: string, message?: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.finish(message);
      this.bars.delete(id);
    }
  }

  /**
   * Finish all progress bars.
   */
  finishAll(): void {
    for (const [id, bar] of this.bars) {
      bar.finish();
      this.bars.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Step Tracker
// ---------------------------------------------------------------------------

/**
 * Track progress through a series of named steps.
 *
 * @example
 * ```typescript
 * const tracker = new StepTracker([
 *   'Installing dependencies',
 *   'Running migrations',
 *   'Building assets',
 *   'Verifying deployment',
 * ]);
 *
 * tracker.start(0);
 * await installDeps();
 * tracker.complete(0);
 *
 * tracker.start(1);
 * await runMigrations();
 * tracker.complete(1);
 * ```
 */
export class StepTracker {
  private steps: ProgressStep[];
  private startTimes: Map<number, number> = new Map();
  private options: Required<StepTrackerOptions>;
  private isTTY: boolean;

  constructor(
    stepNames: string[],
    options: StepTrackerOptions = {},
  ) {
    this.steps = stepNames.map(name => ({
      name,
      status: 'pending',
    }));
    this.options = {
      showNumbers: options.showNumbers ?? true,
      showDuration: options.showDuration ?? true,
    };
    this.isTTY = process.stderr.isTTY === true;
  }

  /**
   * Mark a step as running.
   */
  start(index: number): void {
    const step = this.steps[index];
    if (!step) return;

    step.status = 'running';
    this.startTimes.set(index, Date.now());
    this.render();
  }

  /**
   * Mark a step as completed.
   */
  complete(index: number, message?: string): void {
    const step = this.steps[index];
    if (!step) return;

    step.status = 'done';
    step.message = message;
    this.setDuration(index);
    this.render();
  }

  /**
   * Mark a step as failed.
   */
  fail(index: number, message?: string): void {
    const step = this.steps[index];
    if (!step) return;

    step.status = 'failed';
    step.message = message;
    this.setDuration(index);
    this.render();
  }

  /**
   * Mark a step as skipped.
   */
  skip(index: number, reason?: string): void {
    const step = this.steps[index];
    if (!step) return;

    step.status = 'skipped';
    step.message = reason;
    this.render();
  }

  /**
   * Get all steps with their current status.
   */
  getSteps(): readonly ProgressStep[] {
    return this.steps;
  }

  /**
   * Get the overall progress as a fraction.
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.steps.filter(
      s => s.status === 'done' || s.status === 'skipped',
    ).length;
    return {
      completed,
      total: this.steps.length,
      percentage: this.steps.length > 0 ? completed / this.steps.length : 0,
    };
  }

  /**
   * Render step status to stderr.
   */
  render(): void {
    if (!this.isTTY) return;

    const lines = this.steps.map((step, index) => {
      const prefix = this.options.showNumbers ? `${index + 1}. ` : '';
      const icon = this.statusIcon(step.status);
      const name = this.statusColor(step.status, step.name);
      const suffix = this.stepSuffix(step);

      return `  ${prefix}${icon} ${name}${suffix}`;
    });

    // Move cursor up to overwrite previous render
    const moveUp = this.steps.length;
    if (moveUp > 0) {
      process.stderr.write(`\x1b[${moveUp}A`);
    }

    for (const line of lines) {
      process.stderr.clearLine(0);
      process.stderr.write(line + '\n');
    }
  }

  /**
   * Render the final summary.
   */
  summary(): string {
    const { completed, total } = this.getProgress();
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const skipped = this.steps.filter(s => s.status === 'skipped').length;

    const parts: string[] = [
      `${completed}/${total} steps completed`,
    ];

    if (failed > 0) parts.push(chalk.red(`${failed} failed`));
    if (skipped > 0) parts.push(chalk.yellow(`${skipped} skipped`));

    return parts.join(', ');
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private setDuration(index: number): void {
    const start = this.startTimes.get(index);
    if (start !== undefined) {
      const step = this.steps[index];
      if (step) {
        step.duration = Date.now() - start;
      }
      this.startTimes.delete(index);
    }
  }

  private statusIcon(status: ProgressStep['status']): string {
    switch (status) {
      case 'pending': return chalk.gray('[ ]');
      case 'running': return chalk.cyan('[~]');
      case 'done': return chalk.green('[+]');
      case 'failed': return chalk.red('[x]');
      case 'skipped': return chalk.yellow('[-]');
    }
  }

  private statusColor(status: ProgressStep['status'], text: string): string {
    switch (status) {
      case 'pending': return chalk.gray(text);
      case 'running': return chalk.cyan(text);
      case 'done': return chalk.green(text);
      case 'failed': return chalk.red(text);
      case 'skipped': return chalk.yellow(text);
    }
  }

  private stepSuffix(step: ProgressStep): string {
    const parts: string[] = [];

    if (step.message) {
      parts.push(chalk.gray(` - ${step.message}`));
    }

    if (this.options.showDuration && step.duration !== undefined) {
      parts.push(chalk.gray(` (${this.formatDuration(step.duration)})`));
    }

    return parts.join('');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}
