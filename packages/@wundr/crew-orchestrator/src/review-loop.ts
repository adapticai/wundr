/**
 * @wundr/crew-orchestrator - Review Loop Manager
 *
 * Implements manager review and refinement loop for hierarchical process execution.
 * Enables quality gates, iterative improvement, and approval workflows.
 */

import { EventEmitter } from 'eventemitter3';

import { CrewError, CrewErrorCode } from './types';

import type {
  Task,
  TaskResult,
  CrewMember,
  ReviewRequest,
  ReviewFeedback,
  ReviewDecision,
  ReviewStrategy,
  ExecutionContext,
  CrewEvent,
} from './types';

/**
 * Options for review loop manager configuration
 */
export interface ReviewLoopOptions {
  readonly maxReviewIterations?: number;
  readonly reviewTimeout?: number;
  readonly autoApproveThreshold?: number;
  readonly requireManagerApproval?: boolean;
  readonly strategy?: ReviewStrategy;
}

/**
 * Review cycle tracking
 */
interface ReviewCycle {
  readonly taskId: string;
  readonly iteration: number;
  readonly request: ReviewRequest;
  feedback?: ReviewFeedback;
  readonly startedAt: Date;
  completedAt?: Date;
  readonly status:
    | 'pending'
    | 'in_review'
    | 'approved'
    | 'needs_revision'
    | 'rejected';
}

/**
 * ReviewLoopManager - Manages the manager review and refinement process
 *
 * @example
 * ```typescript
 * const reviewManager = new ReviewLoopManager({
 *   maxReviewIterations: 3,
 *   autoApproveThreshold: 0.9,
 * });
 *
 * const feedback = await reviewManager.submitForReview(
 *   task,
 *   result,
 *   manager,
 *   context
 * );
 *
 * if (feedback.decision === 'needs_revision') {
 *   // Handle revision request
 * }
 * ```
 */
export class ReviewLoopManager extends EventEmitter {
  private reviewCycles: Map<string, ReviewCycle[]> = new Map();
  private pendingReviews: Map<string, ReviewRequest> = new Map();
  private reviewHistory: Map<string, ReviewFeedback[]> = new Map();
  private readonly options: Required<ReviewLoopOptions>;

  /**
   * Creates a new ReviewLoopManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: ReviewLoopOptions = {}) {
    super();
    this.options = {
      maxReviewIterations: options.maxReviewIterations ?? 3,
      reviewTimeout: options.reviewTimeout ?? 60000,
      autoApproveThreshold: options.autoApproveThreshold ?? 0.95,
      requireManagerApproval: options.requireManagerApproval ?? true,
      strategy: options.strategy ?? this.defaultReviewStrategy.bind(this),
    };
  }

  /**
   * Initializes the review loop manager
   */
  async initialize(): Promise<void> {
    this.reviewCycles.clear();
    this.pendingReviews.clear();
    this.reviewHistory.clear();
    this.emit('initialized');
  }

  /**
   * Submits a task result for manager review
   *
   * @param task - The completed task
   * @param result - The task execution result
   * @param reviewer - The manager/reviewer member
   * @param context - Execution context
   * @returns Review feedback
   * @throws {CrewError} If max review iterations exceeded
   */
  async submitForReview(
    task: Task,
    result: TaskResult,
    reviewer: CrewMember,
    context: ExecutionContext,
  ): Promise<ReviewFeedback> {
    // Check iteration limit
    const currentCycles = this.reviewCycles.get(task.id) ?? [];
    const iteration = currentCycles.length + 1;

    if (iteration > this.options.maxReviewIterations) {
      throw new CrewError(
        CrewErrorCode.MAX_ITERATIONS_EXCEEDED,
        `Maximum review iterations (${this.options.maxReviewIterations}) exceeded for task ${task.id}`,
        { taskId: task.id, iterations: iteration },
      );
    }

    // Get previous feedback for context
    const previousFeedback = currentCycles
      .filter(c => c.feedback)
      .map(c => c.feedback!.feedback);

    // Create review request
    const request: ReviewRequest = {
      taskId: task.id,
      taskResult: result,
      reviewerId: reviewer.id,
      iteration,
      previousFeedback:
        previousFeedback.length > 0 ? previousFeedback : undefined,
      timestamp: new Date(),
    };

    this.pendingReviews.set(task.id, request);

    // Create review cycle entry
    const cycle: ReviewCycle = {
      taskId: task.id,
      iteration,
      request,
      startedAt: new Date(),
      status: 'in_review',
    };
    currentCycles.push(cycle);
    this.reviewCycles.set(task.id, currentCycles);

    this.emitEvent('review:requested', {
      taskId: task.id,
      reviewerId: reviewer.id,
      iteration,
    });

    // Execute review strategy
    const feedback = await this.options.strategy(
      result,
      task,
      reviewer,
      context,
    );

    // Update cycle with feedback
    this.updateCycle(task.id, iteration, feedback);
    this.pendingReviews.delete(task.id);

    // Store in history
    const history = this.reviewHistory.get(task.id) ?? [];
    history.push(feedback);
    this.reviewHistory.set(task.id, history);

    this.emitEvent('review:completed', {
      taskId: task.id,
      reviewerId: reviewer.id,
      decision: feedback.decision,
      iteration,
    });

    return feedback;
  }

  /**
   * Checks if auto-approval should be applied based on quality score
   *
   * @param result - The task result to evaluate
   * @returns True if result should be auto-approved
   */
  shouldAutoApprove(result: TaskResult): boolean {
    if (!this.options.autoApproveThreshold) {
      return false;
    }

    // If result has quality metrics in review history, check against threshold
    const lastReview = result.reviewHistory[result.reviewHistory.length - 1];
    if (lastReview) {
      // Auto-approve if previous review was approved
      if (lastReview.decision === 'approved') {
        return true;
      }
    }

    // Check for success and high confidence output
    if (result.success && result.iterationsUsed <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Gets the current review iteration for a task
   *
   * @param taskId - The task ID
   * @returns Current iteration number
   */
  getCurrentIteration(taskId: string): number {
    const cycles = this.reviewCycles.get(taskId) ?? [];
    return cycles.length;
  }

  /**
   * Gets remaining review iterations for a task
   *
   * @param taskId - The task ID
   * @returns Number of remaining iterations
   */
  getRemainingIterations(taskId: string): number {
    const current = this.getCurrentIteration(taskId);
    return Math.max(0, this.options.maxReviewIterations - current);
  }

  /**
   * Checks if more review iterations are allowed
   *
   * @param taskId - The task ID
   * @returns True if more iterations allowed
   */
  canReview(taskId: string): boolean {
    return this.getCurrentIteration(taskId) < this.options.maxReviewIterations;
  }

  /**
   * Gets the review history for a task
   *
   * @param taskId - The task ID
   * @returns Array of review feedback
   */
  getReviewHistory(taskId: string): ReviewFeedback[] {
    return [...(this.reviewHistory.get(taskId) ?? [])];
  }

  /**
   * Gets the latest review feedback for a task
   *
   * @param taskId - The task ID
   * @returns Latest feedback or undefined
   */
  getLatestFeedback(taskId: string): ReviewFeedback | undefined {
    const history = this.reviewHistory.get(taskId);
    return history?.[history.length - 1];
  }

  /**
   * Gets all review cycles for a task
   *
   * @param taskId - The task ID
   * @returns Array of review cycles
   */
  getReviewCycles(taskId: string): ReviewCycle[] {
    return [...(this.reviewCycles.get(taskId) ?? [])];
  }

  /**
   * Determines if a task has been approved
   *
   * @param taskId - The task ID
   * @returns True if task has been approved
   */
  isApproved(taskId: string): boolean {
    const latestFeedback = this.getLatestFeedback(taskId);
    return latestFeedback?.decision === 'approved';
  }

  /**
   * Determines if a task has been rejected
   *
   * @param taskId - The task ID
   * @returns True if task has been rejected
   */
  isRejected(taskId: string): boolean {
    const latestFeedback = this.getLatestFeedback(taskId);
    return latestFeedback?.decision === 'rejected';
  }

  /**
   * Creates revision instructions from feedback
   *
   * @param taskId - The task ID
   * @returns Revision instructions or undefined
   */
  getRevisionInstructions(taskId: string): string[] | undefined {
    const latestFeedback = this.getLatestFeedback(taskId);
    if (!latestFeedback || latestFeedback.decision !== 'needs_revision') {
      return undefined;
    }

    return latestFeedback.suggestedChanges ?? [latestFeedback.feedback];
  }

  /**
   * Aggregates quality scores across review cycles
   *
   * @param taskId - The task ID
   * @returns Average quality score or undefined
   */
  getAverageQualityScore(taskId: string): number | undefined {
    const history = this.reviewHistory.get(taskId);
    if (!history || history.length === 0) {
      return undefined;
    }

    const scores = history
      .filter(f => f.qualityScore !== undefined)
      .map(f => f.qualityScore!);

    if (scores.length === 0) {
      return undefined;
    }

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Gets metrics about review activity
   *
   * @returns Review metrics
   */
  getMetrics(): {
    totalReviews: number;
    approved: number;
    needsRevision: number;
    rejected: number;
    escalated: number;
    averageIterations: number;
    averageQualityScore: number;
  } {
    let totalReviews = 0;
    let approved = 0;
    let needsRevision = 0;
    let rejected = 0;
    let escalated = 0;
    let totalIterations = 0;
    const qualityScores: number[] = [];

    for (const history of this.reviewHistory.values()) {
      totalReviews += history.length;
      totalIterations += history.length;

      for (const feedback of history) {
        switch (feedback.decision) {
          case 'approved':
            approved++;
            break;
          case 'needs_revision':
            needsRevision++;
            break;
          case 'rejected':
            rejected++;
            break;
          case 'escalate':
            escalated++;
            break;
        }

        if (feedback.qualityScore !== undefined) {
          qualityScores.push(feedback.qualityScore);
        }
      }
    }

    const taskCount = this.reviewHistory.size;
    const averageIterations = taskCount > 0 ? totalIterations / taskCount : 0;
    const averageQualityScore =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    return {
      totalReviews,
      approved,
      needsRevision,
      rejected,
      escalated,
      averageIterations,
      averageQualityScore,
    };
  }

  /**
   * Resets review state for a task
   *
   * @param taskId - The task ID
   */
  resetReview(taskId: string): void {
    this.reviewCycles.delete(taskId);
    this.pendingReviews.delete(taskId);
    this.reviewHistory.delete(taskId);
  }

  /**
   * Shuts down the review loop manager
   */
  async shutdown(): Promise<void> {
    this.pendingReviews.clear();
    this.emit('shutdown');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Default review strategy - evaluates result quality
   */
  private async defaultReviewStrategy(
    result: TaskResult,
    task: Task,
    reviewer: CrewMember,
    _context: ExecutionContext,
  ): Promise<ReviewFeedback> {
    // Determine quality score based on various factors
    let qualityScore = 0.5;
    const suggestedChanges: string[] = [];

    // Success bonus
    if (result.success) {
      qualityScore += 0.3;
    } else {
      suggestedChanges.push('Fix the error and ensure successful execution');
    }

    // Iteration efficiency bonus
    if (result.iterationsUsed <= 2) {
      qualityScore += 0.1;
    } else if (result.iterationsUsed > 5) {
      qualityScore -= 0.1;
      suggestedChanges.push('Optimize approach to reduce iterations');
    }

    // Duration efficiency
    if (result.duration < 60000) {
      qualityScore += 0.05;
    } else if (result.duration > 300000) {
      qualityScore -= 0.05;
      suggestedChanges.push('Consider ways to improve execution time');
    }

    // Check if output exists
    if (result.output === undefined || result.output === null) {
      qualityScore -= 0.2;
      suggestedChanges.push('Ensure output is provided');
    }

    // Clamp quality score
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    // Determine decision based on quality score
    let decision: ReviewDecision;
    if (qualityScore >= this.options.autoApproveThreshold) {
      decision = 'approved';
    } else if (qualityScore >= 0.6) {
      decision = 'needs_revision';
    } else if (qualityScore >= 0.3) {
      decision = 'needs_revision';
      suggestedChanges.push('Major improvements needed');
    } else {
      decision = 'rejected';
    }

    // Build feedback message
    let feedbackMessage = '';
    if (decision === 'approved') {
      feedbackMessage =
        'Task completed successfully and meets quality standards.';
    } else if (decision === 'needs_revision') {
      feedbackMessage = `Task needs revision. Quality score: ${(qualityScore * 100).toFixed(1)}%`;
    } else {
      feedbackMessage =
        'Task does not meet minimum quality requirements and has been rejected.';
    }

    return {
      taskId: task.id,
      reviewerId: reviewer.id,
      decision,
      feedback: feedbackMessage,
      suggestedChanges:
        suggestedChanges.length > 0 ? suggestedChanges : undefined,
      qualityScore,
      timestamp: new Date(),
    };
  }

  /**
   * Updates a review cycle with feedback
   */
  private updateCycle(
    taskId: string,
    iteration: number,
    feedback: ReviewFeedback,
  ): void {
    const cycles = this.reviewCycles.get(taskId) ?? [];
    const cycleIndex = cycles.findIndex(c => c.iteration === iteration);

    if (cycleIndex >= 0) {
      const existingCycle = cycles[cycleIndex];
      if (existingCycle) {
        let status: ReviewCycle['status'];
        switch (feedback.decision) {
          case 'approved':
            status = 'approved';
            break;
          case 'rejected':
            status = 'rejected';
            break;
          default:
            status = 'needs_revision';
        }

        cycles[cycleIndex] = {
          ...existingCycle,
          feedback,
          completedAt: new Date(),
          status,
        };
        this.reviewCycles.set(taskId, cycles);
      }
    }
  }

  /**
   * Emits a crew event
   */
  private emitEvent(
    type: CrewEvent['type'],
    data: Record<string, unknown>,
  ): void {
    const event: CrewEvent = {
      type,
      crewId: '',
      timestamp: new Date(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);
  }
}
