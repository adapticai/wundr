/**
 * @wundr.io/agent-memory - Forgetting Curve
 *
 * Human-like forgetting curve implementation based on Ebbinghaus's research.
 * Implements memory decay, consolidation triggers, and spaced repetition benefits.
 *
 * The forgetting curve models how memories decay over time unless reinforced,
 * enabling realistic memory management for AI agents.
 */

import type {
  Memory,
  ForgettingCurveConfig,
  MemoryTier,
  MemoryEvent,
  MemoryEventHandler,
} from './types';

/**
 * Forgetting curve calculation result
 */
export interface ForgettingResult {
  /** Memory ID */
  memoryId: string;
  /** Previous retention strength */
  previousStrength: number;
  /** New retention strength after decay */
  newStrength: number;
  /** Whether memory should be forgotten */
  shouldForget: boolean;
  /** Whether memory is ready for consolidation */
  readyForConsolidation: boolean;
  /** Time since last access in milliseconds */
  timeSinceAccess: number;
}

/**
 * Batch forgetting result
 */
export interface BatchForgettingResult {
  /** Individual results */
  results: ForgettingResult[];
  /** Memories to forget */
  toForget: Memory[];
  /** Memories ready for consolidation */
  toConsolidate: Memory[];
  /** Total memories processed */
  processed: number;
  /** Processing time in milliseconds */
  durationMs: number;
}

/**
 * Spaced repetition schedule
 */
export interface RepetitionSchedule {
  /** Memory ID */
  memoryId: string;
  /** Optimal next review time */
  nextReviewAt: Date;
  /** Current interval in milliseconds */
  intervalMs: number;
  /** Review count */
  reviewCount: number;
  /** Ease factor for scheduling */
  easeFactor: number;
}

/**
 * ForgettingCurve - Memory decay and consolidation manager
 *
 * Implements the Ebbinghaus forgetting curve to model realistic memory decay.
 * Supports spaced repetition scheduling and consolidation triggers.
 *
 * @example
 * ```typescript
 * const curve = new ForgettingCurve({
 *   initialStrength: 1.0,
 *   decayRate: 0.1,
 *   minimumThreshold: 0.1,
 *   accessBoost: 0.2,
 *   consolidationThreshold: 0.7,
 * });
 *
 * // Apply decay to a memory
 * const result = curve.applyDecay(memory, 3600000); // 1 hour
 *
 * // Boost memory on access
 * curve.applyAccessBoost(memory);
 * ```
 */
export class ForgettingCurve {
  private config: ForgettingCurveConfig;
  private repetitionSchedules: Map<string, RepetitionSchedule> = new Map();
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();

  /**
   * Creates a new ForgettingCurve instance
   *
   * @param config - Forgetting curve configuration
   */
  constructor(config: ForgettingCurveConfig) {
    this.config = config;
  }

  /**
   * Calculate the retention strength after time has passed
   * Uses the Ebbinghaus forgetting curve: R = e^(-t/S)
   *
   * @param initialStrength - Starting retention strength
   * @param elapsedMs - Time elapsed in milliseconds
   * @param accessCount - Number of times memory was accessed (boosts stability)
   * @returns New retention strength (0-1)
   */
  calculateRetention(
    initialStrength: number,
    elapsedMs: number,
    accessCount: number = 0
  ): number {
    // Stability increases with access count (spaced repetition effect)
    const stability = 1 + accessCount * 0.5;

    // Convert elapsed time to hours for the formula
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Ebbinghaus forgetting curve: R = S * e^(-t/(k*stability))
    // Where k is the decay rate modifier
    const decayModifier = 1 / this.config.decayRate;
    const retention =
      initialStrength * Math.exp(-elapsedHours / (decayModifier * stability));

    return Math.max(0, Math.min(1, retention));
  }

  /**
   * Apply decay to a memory based on time since last access
   *
   * @param memory - Memory to apply decay to
   * @param currentTime - Current timestamp (defaults to now)
   * @returns Forgetting result with updated strength
   */
  applyDecay(
    memory: Memory,
    currentTime: number = Date.now()
  ): ForgettingResult {
    const timeSinceAccess =
      currentTime - memory.metadata.lastAccessedAt.getTime();
    const previousStrength = memory.metadata.retentionStrength;

    // Pinned memories don't decay
    if (memory.metadata.pinned) {
      return {
        memoryId: memory.id,
        previousStrength,
        newStrength: previousStrength,
        shouldForget: false,
        readyForConsolidation: false,
        timeSinceAccess,
      };
    }

    const newStrength = this.calculateRetention(
      this.config.initialStrength,
      timeSinceAccess,
      memory.metadata.accessCount
    );

    // Apply the new strength to the memory
    memory.metadata.retentionStrength = newStrength;

    const shouldForget = newStrength < this.config.minimumThreshold;
    const readyForConsolidation =
      !shouldForget &&
      newStrength >= this.config.consolidationThreshold &&
      memory.metadata.accessCount >= 2;

    if (shouldForget) {
      this.emit('memory:forgotten', {
        memoryId: memory.id,
        tier: memory.type as MemoryTier,
        details: { previousStrength, newStrength },
      });
    }

    return {
      memoryId: memory.id,
      previousStrength,
      newStrength,
      shouldForget,
      readyForConsolidation,
      timeSinceAccess,
    };
  }

  /**
   * Apply decay to multiple memories
   *
   * @param memories - Memories to process
   * @param currentTime - Current timestamp
   * @returns Batch result with all forgetting decisions
   */
  applyDecayBatch(
    memories: Memory[],
    currentTime: number = Date.now()
  ): BatchForgettingResult {
    const startTime = Date.now();
    const results: ForgettingResult[] = [];
    const toForget: Memory[] = [];
    const toConsolidate: Memory[] = [];

    for (const memory of memories) {
      const result = this.applyDecay(memory, currentTime);
      results.push(result);

      if (result.shouldForget) {
        toForget.push(memory);
      } else if (result.readyForConsolidation) {
        toConsolidate.push(memory);
      }
    }

    return {
      results,
      toForget,
      toConsolidate,
      processed: memories.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Apply access boost to a memory (strengthens retention)
   *
   * @param memory - Memory that was accessed
   * @returns New retention strength
   */
  applyAccessBoost(memory: Memory): number {
    if (memory.metadata.pinned) {
      return memory.metadata.retentionStrength;
    }

    const previousStrength = memory.metadata.retentionStrength;

    // Boost with diminishing returns
    const boost =
      this.config.accessBoost * (1 - memory.metadata.retentionStrength);
    const newStrength = Math.min(1.0, previousStrength + boost);

    memory.metadata.retentionStrength = newStrength;
    memory.metadata.lastAccessedAt = new Date();
    memory.metadata.accessCount++;

    // Update spaced repetition schedule
    this.updateRepetitionSchedule(memory.id);

    return newStrength;
  }

  /**
   * Check if a memory should be forgotten
   *
   * @param memory - Memory to check
   * @returns True if memory should be forgotten
   */
  shouldForget(memory: Memory): boolean {
    if (memory.metadata.pinned) {
      return false;
    }
    return memory.metadata.retentionStrength < this.config.minimumThreshold;
  }

  /**
   * Check if a memory is ready for consolidation
   *
   * @param memory - Memory to check
   * @returns True if ready for consolidation
   */
  isReadyForConsolidation(memory: Memory): boolean {
    if (memory.metadata.pinned) {
      return false;
    }
    return (
      memory.metadata.retentionStrength >= this.config.consolidationThreshold &&
      memory.metadata.accessCount >= 2
    );
  }

  /**
   * Get optimal next review time for a memory (spaced repetition)
   *
   * @param memory - Memory to schedule
   * @returns Optimal review time
   */
  getNextReviewTime(memory: Memory): Date {
    const schedule = this.getOrCreateSchedule(memory);
    return schedule.nextReviewAt;
  }

  /**
   * Get all memories due for review
   *
   * @param memories - Memories to check
   * @param currentTime - Current timestamp
   * @returns Memories that should be reviewed
   */
  getMemoriesDueForReview(
    memories: Memory[],
    currentTime: number = Date.now()
  ): Memory[] {
    return memories.filter(memory => {
      const schedule = this.repetitionSchedules.get(memory.id);
      if (!schedule) {
        return false;
      }
      return schedule.nextReviewAt.getTime() <= currentTime;
    });
  }

  /**
   * Update the spaced repetition schedule after a review
   *
   * @param memoryId - Memory ID
   * @param wasSuccessful - Whether the review was successful
   */
  updateRepetitionSchedule(
    memoryId: string,
    wasSuccessful: boolean = true
  ): void {
    let schedule = this.repetitionSchedules.get(memoryId);

    if (!schedule) {
      schedule = {
        memoryId,
        nextReviewAt: new Date(),
        intervalMs: 24 * 60 * 60 * 1000, // Start with 1 day
        reviewCount: 0,
        easeFactor: 2.5,
      };
      this.repetitionSchedules.set(memoryId, schedule);
    }

    schedule.reviewCount++;

    if (wasSuccessful) {
      // Increase interval (SM-2 algorithm inspired)
      schedule.easeFactor = Math.max(
        1.3,
        schedule.easeFactor + (0.1 - (5 - 4) * (0.08 + (5 - 4) * 0.02))
      );
      schedule.intervalMs = schedule.intervalMs * schedule.easeFactor;
    } else {
      // Reset interval on failure
      schedule.intervalMs = 24 * 60 * 60 * 1000; // Reset to 1 day
      schedule.easeFactor = Math.max(1.3, schedule.easeFactor - 0.2);
    }

    schedule.nextReviewAt = new Date(Date.now() + schedule.intervalMs);
  }

  /**
   * Calculate memory importance score
   * Combines retention strength, access count, and recency
   *
   * @param memory - Memory to score
   * @param currentTime - Current timestamp
   * @returns Importance score (0-1)
   */
  calculateImportance(
    memory: Memory,
    currentTime: number = Date.now()
  ): number {
    if (memory.metadata.pinned) {
      return 1.0;
    }

    const strengthWeight = 0.4;
    const accessWeight = 0.3;
    const recencyWeight = 0.2;
    const priorityWeight = 0.1;

    // Retention strength component
    const strengthScore = memory.metadata.retentionStrength;

    // Access count component (logarithmic scale)
    const accessScore = Math.min(
      1,
      Math.log(memory.metadata.accessCount + 1) / 3
    );

    // Recency component (decay over 7 days)
    const daysSinceAccess =
      (currentTime - memory.metadata.lastAccessedAt.getTime()) /
      (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceAccess / 7);

    // Priority component (normalized to 0-1)
    const priorityScore = memory.metadata.priority / 10;

    return (
      strengthWeight * strengthScore +
      accessWeight * accessScore +
      recencyWeight * recencyScore +
      priorityWeight * priorityScore
    );
  }

  /**
   * Get memories sorted by importance for context selection
   *
   * @param memories - Memories to sort
   * @param currentTime - Current timestamp
   * @returns Memories sorted by importance (highest first)
   */
  sortByImportance(
    memories: Memory[],
    currentTime: number = Date.now()
  ): Memory[] {
    return [...memories].sort((a, b) => {
      const importanceA = this.calculateImportance(a, currentTime);
      const importanceB = this.calculateImportance(b, currentTime);
      return importanceB - importanceA;
    });
  }

  /**
   * Simulate forgetting over a time period
   * Useful for testing and visualization
   *
   * @param initialStrength - Starting strength
   * @param durationHours - Duration to simulate
   * @param accessCount - Access count modifier
   * @param intervalHours - Sampling interval
   * @returns Array of [hour, strength] tuples
   */
  simulateForgetting(
    initialStrength: number = 1.0,
    durationHours: number = 168, // 1 week
    accessCount: number = 0,
    intervalHours: number = 1
  ): [number, number][] {
    const results: [number, number][] = [];

    for (let hour = 0; hour <= durationHours; hour += intervalHours) {
      const elapsedMs = hour * 60 * 60 * 1000;
      const strength = this.calculateRetention(
        initialStrength,
        elapsedMs,
        accessCount
      );
      results.push([hour, strength]);
    }

    return results;
  }

  /**
   * Get the forgetting curve configuration
   *
   * @returns Current configuration
   */
  getConfig(): ForgettingCurveConfig {
    return { ...this.config };
  }

  /**
   * Update forgetting curve configuration
   *
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<ForgettingCurveConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Register an event handler
   *
   * @param event - Event type
   * @param handler - Handler function
   */
  on(event: string, handler: MemoryEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param event - Event type
   * @param handler - Handler to remove
   */
  off(event: string, handler: MemoryEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Serialize state for persistence
   *
   * @returns Serializable state
   */
  serialize(): {
    config: ForgettingCurveConfig;
    schedules: [string, RepetitionSchedule][];
  } {
    return {
      config: this.config,
      schedules: Array.from(this.repetitionSchedules.entries()),
    };
  }

  /**
   * Restore state from serialized data
   *
   * @param state - State to restore
   */
  restore(state: {
    config: ForgettingCurveConfig;
    schedules: [string, RepetitionSchedule][];
  }): void {
    this.config = state.config;
    this.repetitionSchedules.clear();

    for (const [id, schedule] of state.schedules) {
      schedule.nextReviewAt = new Date(schedule.nextReviewAt);
      this.repetitionSchedules.set(id, schedule);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getOrCreateSchedule(memory: Memory): RepetitionSchedule {
    let schedule = this.repetitionSchedules.get(memory.id);

    if (!schedule) {
      schedule = {
        memoryId: memory.id,
        nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        intervalMs: 24 * 60 * 60 * 1000,
        reviewCount: 0,
        easeFactor: 2.5,
      };
      this.repetitionSchedules.set(memory.id, schedule);
    }

    return schedule;
  }

  private emit(type: string, payload: MemoryEvent['payload']): void {
    const event: MemoryEvent = {
      type: type as MemoryEvent['type'],
      timestamp: new Date(),
      payload,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${type}:`, error);
        }
      }
    }
  }
}
