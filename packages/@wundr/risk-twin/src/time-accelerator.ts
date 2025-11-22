/**
 * @wundr/risk-twin - Time Accelerator for 10x Speed Simulation
 *
 * Enables accelerated time simulation for Risk Twin validation.
 * Default: 30 simulated days = 3 real hours at 10x acceleration.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Configuration for the TimeAccelerator
 */
export interface AcceleratorConfig {
  /** Acceleration factor (default: 10 for 10x speed) */
  accelerationFactor?: number;
  /** Starting simulated time (default: current time) */
  startTime?: Date;
  /** Callback for time events */
  onTimeEvent?: TimeEventCallback;
  /** Enable automatic time progression */
  autoProgress?: boolean;
  /** Interval for auto-progress in real milliseconds */
  autoProgressInterval?: number;
}

/**
 * Time event types emitted during simulation
 */
export type TimeEventType =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'day_advanced'
  | 'hour_advanced'
  | 'acceleration_changed';

/**
 * Time event payload
 */
export interface TimeEvent {
  type: TimeEventType;
  simulatedTime: Date;
  realTime: Date;
  accelerationFactor: number;
  metadata?: Record<string, unknown>;
}

/**
 * Callback for time events
 */
export type TimeEventCallback = (event: TimeEvent) => void;

/**
 * Report generated when simulation stops
 */
export interface SimulationTimeReport {
  /** Real wall-clock duration in milliseconds */
  realDurationMs: number;
  /** Simulated duration in milliseconds */
  simulatedDurationMs: number;
  /** Acceleration factor used */
  accelerationFactor: number;
  /** Number of time events processed */
  eventsProcessed: number;
  /** Start time of simulation */
  startTime: Date;
  /** End time of simulation (real time) */
  endTime: Date;
  /** Simulated start time */
  simulatedStartTime: Date;
  /** Simulated end time */
  simulatedEndTime: Date;
  /** Days simulated */
  simulatedDays: number;
  /** Hours simulated */
  simulatedHours: number;
}

/**
 * Internal state for the accelerator
 */
interface AcceleratorState {
  isRunning: boolean;
  isPaused: boolean;
  eventsProcessed: number;
  pausedAt: Date | null;
  totalPausedMs: number;
  autoProgressTimer: ReturnType<typeof setInterval> | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default acceleration factor (10x) */
const DEFAULT_ACCELERATION_FACTOR = 10;

/** Milliseconds in one day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds in one hour */
const MS_PER_HOUR = 60 * 60 * 1000;

/** Default auto-progress interval (100ms real time) */
const DEFAULT_AUTO_PROGRESS_INTERVAL = 100;

// ============================================================================
// TimeAccelerator Class
// ============================================================================

/**
 * TimeAccelerator enables 10x (or custom) speed simulation for Risk Twin.
 *
 * @example
 * ```typescript
 * const accelerator = new TimeAccelerator({ accelerationFactor: 10 });
 *
 * accelerator.start();
 *
 * // Advance 30 simulated days
 * accelerator.advanceDays(30);
 *
 * const report = accelerator.stop();
 * console.log(`Simulated ${report.simulatedDays} days in ${report.realDurationMs}ms`);
 * ```
 */
export class TimeAccelerator {
  private accelerationFactor: number;
  private simulatedTime: Date;
  private realTimeStart: Date;
  private simulatedTimeStart: Date;
  private state: AcceleratorState;
  private onTimeEvent: TimeEventCallback | null;
  private autoProgressInterval: number;

  /**
   * Creates a new TimeAccelerator instance
   * @param config - Configuration options
   */
  constructor(config: AcceleratorConfig = {}) {
    this.accelerationFactor =
      config.accelerationFactor ?? DEFAULT_ACCELERATION_FACTOR;
    this.simulatedTime = config.startTime
      ? new Date(config.startTime)
      : new Date();
    this.simulatedTimeStart = new Date(this.simulatedTime);
    this.realTimeStart = new Date();
    this.onTimeEvent = config.onTimeEvent ?? null;
    this.autoProgressInterval =
      config.autoProgressInterval ?? DEFAULT_AUTO_PROGRESS_INTERVAL;

    this.state = {
      isRunning: false,
      isPaused: false,
      eventsProcessed: 0,
      pausedAt: null,
      totalPausedMs: 0,
      autoProgressTimer: null,
    };

    // Start auto-progress if enabled
    if (config.autoProgress) {
      this.startAutoProgress();
    }
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Begins accelerated simulation
   */
  start(): void {
    if (this.state.isRunning) {
      return; // Already running
    }

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.realTimeStart = new Date();
    this.simulatedTimeStart = new Date(this.simulatedTime);
    this.state.totalPausedMs = 0;

    this.emitEvent('start');
  }

  /**
   * Stops simulation and returns time metrics
   * @returns SimulationTimeReport with timing details
   */
  stop(): SimulationTimeReport {
    this.stopAutoProgress();

    const endTime = new Date();
    const report = this.generateReport(endTime);

    this.state.isRunning = false;
    this.state.isPaused = false;

    this.emitEvent('stop');

    return report;
  }

  /**
   * Pauses the simulation without resetting
   */
  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.state.pausedAt = new Date();
    this.stopAutoProgress();

    this.emitEvent('pause');
  }

  /**
   * Resumes a paused simulation
   */
  resume(): void {
    if (!this.state.isRunning || !this.state.isPaused || !this.state.pausedAt) {
      return;
    }

    const pauseDuration = Date.now() - this.state.pausedAt.getTime();
    this.state.totalPausedMs += pauseDuration;
    this.state.isPaused = false;
    this.state.pausedAt = null;

    this.emitEvent('resume');
  }

  // ==========================================================================
  // Time Accessors
  // ==========================================================================

  /**
   * Returns current simulated time
   * @returns Current simulated Date
   */
  getSimulatedTime(): Date {
    if (this.state.isRunning && !this.state.isPaused) {
      // Calculate simulated time based on real elapsed time
      const realElapsed = this.getRealElapsed();
      const simulatedElapsed = realElapsed * this.accelerationFactor;
      return new Date(this.simulatedTimeStart.getTime() + simulatedElapsed);
    }
    return new Date(this.simulatedTime);
  }

  /**
   * Returns real milliseconds elapsed since start (excluding paused time)
   * @returns Real milliseconds elapsed
   */
  getRealElapsed(): number {
    if (!this.state.isRunning) {
      return 0;
    }

    const now =
      this.state.isPaused && this.state.pausedAt
        ? this.state.pausedAt.getTime()
        : Date.now();

    return now - this.realTimeStart.getTime() - this.state.totalPausedMs;
  }

  /**
   * Returns simulated milliseconds elapsed
   * @returns Simulated milliseconds elapsed
   */
  getSimulatedElapsed(): number {
    if (!this.state.isRunning) {
      return this.simulatedTime.getTime() - this.simulatedTimeStart.getTime();
    }
    return this.getRealElapsed() * this.accelerationFactor;
  }

  /**
   * Gets the current acceleration factor
   * @returns Current acceleration factor
   */
  getAccelerationFactor(): number {
    return this.accelerationFactor;
  }

  /**
   * Checks if the accelerator is currently running
   * @returns True if running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Checks if the accelerator is paused
   * @returns True if paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  // ==========================================================================
  // Time Advancement Methods
  // ==========================================================================

  /**
   * Advances simulated time by specified days
   * @param days - Number of days to advance
   */
  advanceDays(days: number): void {
    if (days <= 0) {
      return;
    }

    const msToAdvance = days * MS_PER_DAY;
    this.simulatedTime = new Date(this.simulatedTime.getTime() + msToAdvance);

    this.emitEvent('day_advanced', { daysAdvanced: days });
  }

  /**
   * Advances simulated time by specified hours
   * @param hours - Number of hours to advance
   */
  advanceHours(hours: number): void {
    if (hours <= 0) {
      return;
    }

    const msToAdvance = hours * MS_PER_HOUR;
    this.simulatedTime = new Date(this.simulatedTime.getTime() + msToAdvance);

    this.emitEvent('hour_advanced', { hoursAdvanced: hours });
  }

  /**
   * Advances simulated time by specified milliseconds
   * @param ms - Number of milliseconds to advance
   */
  advanceMs(ms: number): void {
    if (ms <= 0) {
      return;
    }

    this.simulatedTime = new Date(this.simulatedTime.getTime() + ms);
  }

  // ==========================================================================
  // Configuration Methods
  // ==========================================================================

  /**
   * Sets the acceleration factor
   * @param factor - New acceleration factor (must be positive)
   */
  setAccelerationFactor(factor: number): void {
    if (factor <= 0) {
      throw new Error('Acceleration factor must be positive');
    }

    // If running, sync the simulated time before changing factor
    if (this.state.isRunning && !this.state.isPaused) {
      this.simulatedTime = this.getSimulatedTime();
      this.simulatedTimeStart = new Date(this.simulatedTime);
      this.realTimeStart = new Date();
      this.state.totalPausedMs = 0;
    }

    this.accelerationFactor = factor;

    this.emitEvent('acceleration_changed', { newFactor: factor });
  }

  /**
   * Sets the callback for time events
   * @param callback - Time event callback function
   */
  setTimeEventCallback(callback: TimeEventCallback | null): void {
    this.onTimeEvent = callback;
  }

  // ==========================================================================
  // Calculation Methods
  // ==========================================================================

  /**
   * Calculates real duration needed to simulate given days
   * @param simulatedDays - Number of days to simulate
   * @returns Real milliseconds needed
   */
  calculateRealDuration(simulatedDays: number): number {
    const simulatedMs = simulatedDays * MS_PER_DAY;
    return simulatedMs / this.accelerationFactor;
  }

  /**
   * Calculates how many simulated days fit in given real duration
   * @param realMs - Real milliseconds available
   * @returns Number of simulated days
   */
  calculateSimulatedDays(realMs: number): number {
    const simulatedMs = realMs * this.accelerationFactor;
    return simulatedMs / MS_PER_DAY;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Emits a time event to the registered callback
   */
  private emitEvent(
    type: TimeEventType,
    metadata?: Record<string, unknown>,
  ): void {
    this.state.eventsProcessed++;

    if (this.onTimeEvent) {
      const event: TimeEvent = {
        type,
        simulatedTime: this.getSimulatedTime(),
        realTime: new Date(),
        accelerationFactor: this.accelerationFactor,
        ...(metadata !== undefined && { metadata }),
      };

      this.onTimeEvent(event);
    }
  }

  /**
   * Generates a simulation time report
   */
  private generateReport(endTime: Date): SimulationTimeReport {
    const realDurationMs =
      endTime.getTime() -
      this.realTimeStart.getTime() -
      this.state.totalPausedMs;
    const simulatedDurationMs = this.getSimulatedElapsed();
    const simulatedEndTime = this.getSimulatedTime();

    return {
      realDurationMs,
      simulatedDurationMs,
      accelerationFactor: this.accelerationFactor,
      eventsProcessed: this.state.eventsProcessed,
      startTime: new Date(this.realTimeStart),
      endTime: new Date(endTime),
      simulatedStartTime: new Date(this.simulatedTimeStart),
      simulatedEndTime,
      simulatedDays: simulatedDurationMs / MS_PER_DAY,
      simulatedHours: simulatedDurationMs / MS_PER_HOUR,
    };
  }

  /**
   * Starts automatic time progression
   */
  private startAutoProgress(): void {
    if (this.state.autoProgressTimer) {
      return;
    }

    this.state.autoProgressTimer = setInterval(() => {
      if (this.state.isRunning && !this.state.isPaused) {
        // Time progresses automatically via getSimulatedTime() calculations
        // This interval is mainly for triggering periodic updates if needed
      }
    }, this.autoProgressInterval);
  }

  /**
   * Stops automatic time progression
   */
  private stopAutoProgress(): void {
    if (this.state.autoProgressTimer) {
      clearInterval(this.state.autoProgressTimer);
      this.state.autoProgressTimer = null;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates simulation duration in real time
 *
 * @param simulatedDays - Number of days to simulate
 * @param accelerationFactor - Acceleration factor (default: 10)
 * @returns Object with duration in various units
 *
 * @example
 * ```typescript
 * const duration = calculateSimulationDuration(30, 10);
 * // duration.realHours === 3 (30 days at 10x = 3 hours)
 * ```
 */
export function calculateSimulationDuration(
  simulatedDays: number,
  accelerationFactor: number = DEFAULT_ACCELERATION_FACTOR,
): {
  realMs: number;
  realSeconds: number;
  realMinutes: number;
  realHours: number;
  realDays: number;
  simulatedMs: number;
  simulatedDays: number;
  accelerationFactor: number;
} {
  const simulatedMs = simulatedDays * MS_PER_DAY;
  const realMs = simulatedMs / accelerationFactor;

  return {
    realMs,
    realSeconds: realMs / 1000,
    realMinutes: realMs / (60 * 1000),
    realHours: realMs / MS_PER_HOUR,
    realDays: realMs / MS_PER_DAY,
    simulatedMs,
    simulatedDays,
    accelerationFactor,
  };
}

/**
 * Creates a pre-configured TimeAccelerator for Risk Twin validation
 * (30 days at 10x = 3 hours)
 *
 * @param onTimeEvent - Optional callback for time events
 * @returns Configured TimeAccelerator instance
 */
export function createRiskTwinAccelerator(
  onTimeEvent?: TimeEventCallback,
): TimeAccelerator {
  const config: AcceleratorConfig = {
    accelerationFactor: 10,
  };

  if (onTimeEvent !== undefined) {
    config.onTimeEvent = onTimeEvent;
  }

  return new TimeAccelerator(config);
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_ACCELERATION_FACTOR, MS_PER_DAY, MS_PER_HOUR };
