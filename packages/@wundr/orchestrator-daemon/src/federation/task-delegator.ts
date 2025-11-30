/**
 * TaskDelegator - Handles task delegation between orchestrators
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from '../types';
import type {
  DelegationRecord,
  DelegationStatus,
  DelegationResult,
  DelegationCallback,
  DelegationContext,
  OrchestratorInfo,
  CapabilityScore,
} from './types';

/**
 * Delegation tracker interface
 */
export interface DelegationTracker {
  track(delegation: DelegationRecord): Promise<void>;
  update(delegationId: string, updates: Partial<DelegationRecord>): Promise<void>;
  get(delegationId: string): Promise<DelegationRecord | null>;
  getByOrchestrator(orchestratorId: string): Promise<DelegationRecord[]>;
  getByStatus(status: DelegationStatus): Promise<DelegationRecord[]>;
  delete(delegationId: string): Promise<void>;
}

/**
 * In-memory delegation tracker
 */
export class InMemoryDelegationTracker implements DelegationTracker {
  private delegations = new Map<string, DelegationRecord>();

  async track(delegation: DelegationRecord): Promise<void> {
    this.delegations.set(delegation.delegationId, delegation);
  }

  async update(delegationId: string, updates: Partial<DelegationRecord>): Promise<void> {
    const delegation = this.delegations.get(delegationId);
    if (delegation) {
      this.delegations.set(delegationId, { ...delegation, ...updates });
    }
  }

  async get(delegationId: string): Promise<DelegationRecord | null> {
    return this.delegations.get(delegationId) || null;
  }

  async getByOrchestrator(orchestratorId: string): Promise<DelegationRecord[]> {
    return Array.from(this.delegations.values()).filter(
      (d) => d.fromOrchestrator === orchestratorId || d.toOrchestrator === orchestratorId
    );
  }

  async getByStatus(status: DelegationStatus): Promise<DelegationRecord[]> {
    return Array.from(this.delegations.values()).filter((d) => d.status === status);
  }

  async delete(delegationId: string): Promise<void> {
    this.delegations.delete(delegationId);
  }
}

/**
 * TaskDelegator configuration
 */
export interface TaskDelegatorConfig {
  defaultTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  callbackTimeout?: number;
}

/**
 * TaskDelegator - Manages task delegation between orchestrators
 */
export class TaskDelegator extends EventEmitter {
  private tracker: DelegationTracker;
  private config: Required<TaskDelegatorConfig>;
  private callbackHandlers = new Map<string, (callback: DelegationCallback) => void>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    tracker?: DelegationTracker,
    config: TaskDelegatorConfig = {}
  ) {
    super();

    this.tracker = tracker || new InMemoryDelegationTracker();
    this.config = {
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      backoffMultiplier: config.backoffMultiplier || 2,
      callbackTimeout: config.callbackTimeout || 60000, // 1 minute
    };
  }

  /**
   * Select the best orchestrator for a task
   */
  selectBestOrchestrator(
    task: Task,
    availableOrchestrators: OrchestratorInfo[],
    context?: DelegationContext
  ): OrchestratorInfo | null {
    // Filter out unavailable orchestrators
    let candidates = availableOrchestrators.filter((o) => o.available);

    // Apply exclusions
    if (context?.excludedOrchestrators?.length) {
      candidates = candidates.filter(
        (o) => !context.excludedOrchestrators!.includes(o.id)
      );
    }

    // Apply preferred orchestrators first
    if (context?.preferredOrchestrators?.length) {
      const preferred = candidates.filter((o) =>
        context.preferredOrchestrators!.includes(o.id)
      );
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Score each candidate
    const scores = candidates.map((orchestrator) =>
      this.scoreOrchestrator(orchestrator, task, context)
    );

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Return the orchestrator with the highest score
    const bestScore = scores[0];
    return candidates.find((o) => o.id === bestScore.orchestratorId) || null;
  }

  /**
   * Score an orchestrator for a task
   */
  private scoreOrchestrator(
    orchestrator: OrchestratorInfo,
    task: Task,
    context?: DelegationContext
  ): CapabilityScore {
    const breakdown = {
      capabilityMatch: 0,
      loadFactor: 0,
      availabilityFactor: 0,
      priorityBonus: 0,
    };
    const reasons: string[] = [];

    // 1. Capability matching (0-50 points)
    const capabilityScore = this.calculateCapabilityMatch(
      orchestrator.capabilities,
      task,
      context?.requiredCapabilities
    );
    breakdown.capabilityMatch = capabilityScore;

    if (capabilityScore > 40) {
      reasons.push('Excellent capability match');
    } else if (capabilityScore > 30) {
      reasons.push('Good capability match');
    } else if (capabilityScore > 20) {
      reasons.push('Moderate capability match');
    } else {
      reasons.push('Weak capability match');
    }

    // 2. Load factor (0-30 points)
    const loadPercentage = orchestrator.currentLoad / orchestrator.maxLoad;
    const loadScore = Math.max(0, 30 * (1 - loadPercentage));
    breakdown.loadFactor = loadScore;

    if (loadPercentage < 0.3) {
      reasons.push('Low current load');
    } else if (loadPercentage < 0.6) {
      reasons.push('Moderate current load');
    } else {
      reasons.push('High current load');
    }

    // 3. Availability factor (0-10 points)
    breakdown.availabilityFactor = orchestrator.available ? 10 : 0;

    // 4. Priority bonus (0-10 points)
    if (context?.priority) {
      const priorityMap = {
        critical: 10,
        high: 7,
        medium: 4,
        low: 0,
      };
      breakdown.priorityBonus = priorityMap[context.priority];
    }

    // 5. Tier-based bonus (higher tier = bonus)
    const tierBonus = orchestrator.tier * 2;
    breakdown.capabilityMatch += tierBonus;

    if (orchestrator.tier > 2) {
      reasons.push('High-tier orchestrator');
    }

    const totalScore =
      breakdown.capabilityMatch +
      breakdown.loadFactor +
      breakdown.availabilityFactor +
      breakdown.priorityBonus;

    return {
      orchestratorId: orchestrator.id,
      score: totalScore,
      breakdown,
      reasons,
    };
  }

  /**
   * Calculate capability match score
   */
  private calculateCapabilityMatch(
    capabilities: string[],
    task: Task,
    requiredCapabilities?: string[]
  ): number {
    let score = 0;

    // Task type matching - check if capabilities include the task type
    const taskTypeStr = task.type;
    if (capabilities.includes(taskTypeStr)) {
      score += 20;
    }

    // Required capabilities matching
    if (requiredCapabilities?.length) {
      const matchedCapabilities = capabilities.filter((c) =>
        requiredCapabilities.includes(c)
      );
      const matchPercentage = matchedCapabilities.length / requiredCapabilities.length;
      score += matchPercentage * 20;
    }

    // General capability breadth
    score += Math.min(capabilities.length * 2, 10);

    return Math.min(score, 50);
  }

  /**
   * Delegate a task to a target orchestrator
   */
  async delegate(
    task: Task,
    targetOrchestrator: OrchestratorInfo,
    context: DelegationContext = {},
    fromOrchestrator: string = 'local'
  ): Promise<string> {
    const delegationId = uuidv4();

    const delegation: DelegationRecord = {
      delegationId,
      status: 'pending',
      fromOrchestrator,
      toOrchestrator: targetOrchestrator.id,
      task,
      startedAt: new Date(),
      retryCount: 0,
      metadata: context.metadata,
    };

    await this.tracker.track(delegation);

    // Set timeout if specified
    const timeout = context.timeout || this.config.defaultTimeout;
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(delegationId);
    }, timeout);
    this.timeouts.set(delegationId, timeoutHandle);

    // Update status to in_progress
    await this.tracker.update(delegationId, { status: 'in_progress' });

    // Emit delegation event
    this.emit('delegation:started', {
      delegationId,
      task,
      targetOrchestrator: targetOrchestrator.id,
    });

    // In a real implementation, this would send the task to the target orchestrator
    // For now, we'll simulate the delegation
    this.simulateDelegation(delegationId, targetOrchestrator, task);

    return delegationId;
  }

  /**
   * Simulate delegation (replace with actual orchestrator communication)
   */
  private simulateDelegation(
    delegationId: string,
    targetOrchestrator: OrchestratorInfo,
    task: Task
  ): void {
    // This is a placeholder - in real implementation, this would:
    // 1. Establish connection with target orchestrator
    // 2. Send task data
    // 3. Set up callback mechanism
    // 4. Monitor progress

    // For now, just emit an event
    this.emit('delegation:dispatched', {
      delegationId,
      targetOrchestrator: targetOrchestrator.id,
      task,
    });
  }

  /**
   * Wait for delegation result
   */
  async waitForResult(
    delegationId: string,
    timeout?: number
  ): Promise<DelegationResult> {
    const waitTimeout = timeout || this.config.callbackTimeout;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout waiting for delegation result: ${delegationId}`));
      }, waitTimeout);

      const checkResult = async () => {
        const delegation = await this.tracker.get(delegationId);

        if (!delegation) {
          clearTimeout(timeoutHandle);
          reject(new Error(`Delegation not found: ${delegationId}`));
          return;
        }

        if (delegation.status === 'completed') {
          clearTimeout(timeoutHandle);
          resolve(delegation.result || { success: false, error: 'No result provided', timestamp: new Date() });
        } else if (delegation.status === 'failed' || delegation.status === 'cancelled') {
          clearTimeout(timeoutHandle);
          reject(new Error(delegation.error || `Delegation ${delegation.status}`));
        } else {
          // Still in progress, check again
          setTimeout(checkResult, 1000);
        }
      };

      checkResult();
    });
  }

  /**
   * Handle delegation callback
   */
  async handleCallback(callbackData: DelegationCallback): Promise<void> {
    const { delegationId, status, result, timestamp } = callbackData;

    const delegation = await this.tracker.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }

    // Clear timeout
    const timeoutHandle = this.timeouts.get(delegationId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(delegationId);
    }

    // Update delegation record
    const updates: Partial<DelegationRecord> = {
      status,
      result,
    };

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = timestamp;
    }

    await this.tracker.update(delegationId, updates);

    // Emit callback event
    this.emit('delegation:callback', callbackData);

    // Call registered handler if exists
    const handler = this.callbackHandlers.get(delegationId);
    if (handler) {
      handler(callbackData);
      this.callbackHandlers.delete(delegationId);
    }

    // Handle retry if needed
    if (status === 'failed' && this.shouldRetry(delegation)) {
      await this.retryDelegation(delegationId);
    }
  }

  /**
   * Check if delegation should be retried
   */
  private shouldRetry(delegation: DelegationRecord): boolean {
    return delegation.retryCount < this.config.maxRetries;
  }

  /**
   * Retry a failed delegation
   */
  async retryDelegation(delegationId: string): Promise<string> {
    const delegation = await this.tracker.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }

    if (delegation.retryCount >= this.config.maxRetries) {
      throw new Error(`Max retries exceeded for delegation: ${delegationId}`);
    }

    // Calculate retry delay with exponential backoff
    const retryDelay =
      this.config.retryDelay * Math.pow(this.config.backoffMultiplier, delegation.retryCount);

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, retryDelay));

    // Create new delegation
    const newDelegationId = uuidv4();
    const newDelegation: DelegationRecord = {
      ...delegation,
      delegationId: newDelegationId,
      status: 'pending',
      startedAt: new Date(),
      completedAt: undefined,
      result: undefined,
      error: undefined,
      retryCount: delegation.retryCount + 1,
    };

    await this.tracker.track(newDelegation);

    // Mark original as cancelled
    await this.tracker.update(delegationId, {
      status: 'cancelled',
      completedAt: new Date(),
      error: `Retried as ${newDelegationId}`,
    });

    // Emit retry event
    this.emit('delegation:retried', {
      originalDelegationId: delegationId,
      newDelegationId,
      retryCount: newDelegation.retryCount,
    });

    // Note: In real implementation, would need to get orchestrator info again
    // For now, just update status to in_progress
    await this.tracker.update(newDelegationId, { status: 'in_progress' });

    return newDelegationId;
  }

  /**
   * Cancel a delegation
   */
  async cancelDelegation(delegationId: string): Promise<void> {
    const delegation = await this.tracker.get(delegationId);
    if (!delegation) {
      throw new Error(`Delegation not found: ${delegationId}`);
    }

    if (delegation.status === 'completed' || delegation.status === 'cancelled') {
      throw new Error(`Cannot cancel delegation in status: ${delegation.status}`);
    }

    // Clear timeout
    const timeoutHandle = this.timeouts.get(delegationId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(delegationId);
    }

    // Update delegation status
    await this.tracker.update(delegationId, {
      status: 'cancelled',
      completedAt: new Date(),
      error: 'Cancelled by user',
    });

    // Emit cancellation event
    this.emit('delegation:cancelled', { delegationId });

    // In real implementation, would notify target orchestrator to stop processing
  }

  /**
   * Handle delegation timeout
   */
  private async handleTimeout(delegationId: string): Promise<void> {
    const delegation = await this.tracker.get(delegationId);
    if (!delegation) {
      return;
    }

    // Only handle timeout if still in progress
    if (delegation.status === 'in_progress' || delegation.status === 'pending') {
      await this.tracker.update(delegationId, {
        status: 'failed',
        completedAt: new Date(),
        error: 'Delegation timeout',
      });

      this.emit('delegation:timeout', { delegationId });

      // Attempt retry if configured
      if (this.shouldRetry(delegation)) {
        await this.retryDelegation(delegationId);
      }
    }

    this.timeouts.delete(delegationId);
  }

  /**
   * Get delegation status
   */
  async getDelegationStatus(delegationId: string): Promise<DelegationRecord | null> {
    return this.tracker.get(delegationId);
  }

  /**
   * Get all delegations for an orchestrator
   */
  async getOrchestratorDelegations(orchestratorId: string): Promise<DelegationRecord[]> {
    return this.tracker.getByOrchestrator(orchestratorId);
  }

  /**
   * Get delegations by status
   */
  async getDelegationsByStatus(status: DelegationStatus): Promise<DelegationRecord[]> {
    return this.tracker.getByStatus(status);
  }

  /**
   * Clean up completed delegations
   */
  async cleanup(olderThan?: Date): Promise<number> {
    const cutoff = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const completedDelegations = await this.tracker.getByStatus('completed');
    const failedDelegations = await this.tracker.getByStatus('failed');
    const cancelledDelegations = await this.tracker.getByStatus('cancelled');

    const toDelete = [...completedDelegations, ...failedDelegations, ...cancelledDelegations]
      .filter((d) => d.completedAt && d.completedAt < cutoff);

    for (const delegation of toDelete) {
      await this.tracker.delete(delegation.delegationId);
    }

    return toDelete.length;
  }

  /**
   * Shutdown the delegator
   */
  async shutdown(): Promise<void> {
    // Clear all timeouts
    this.timeouts.forEach((timeoutHandle) => {
      clearTimeout(timeoutHandle);
    });
    this.timeouts.clear();

    // Clear callback handlers
    this.callbackHandlers.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }
}
