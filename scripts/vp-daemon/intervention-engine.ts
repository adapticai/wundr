/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Intervention Engine - Automatic interventions for drift detection
 *
 * Implements threshold-based intervention system that monitors alignment scores
 * and policy violations, applying appropriate interventions automatically.
 */
import { EventEmitter } from 'events';

/**
 * Intervention type definitions
 */
export type InterventionType =
  | 'reduce_autonomy'
  | 'trigger_audit'
  | 'pause_execution'
  | 'notify_guardian'
  | 'rollback';

/**
 * Configuration for the intervention engine
 */
export interface InterventionConfig {
  /** Enable automatic interventions */
  enabled: boolean;
  /** Enable auto-rollback on critical policy violations */
  autoRollbackOnCritical: boolean;
  /** Custom thresholds (optional) */
  thresholds?: {
    reduceAutonomy?: number;
    triggerAudit?: number;
    pauseExecution?: number;
  };
  /** Critical policy violation patterns that trigger immediate rollback */
  criticalPolicies?: string[];
  /** Guardian notification webhook URL */
  guardianWebhookUrl?: string;
  /** Maximum intervention history entries to keep */
  maxHistoryEntries?: number;
}

/**
 * Record of an intervention event
 */
export interface InterventionRecord {
  id: string;
  sessionId: string;
  timestamp: Date;
  interventionType: InterventionType;
  trigger: {
    alignmentScore: number;
    policyViolations: string[];
    threshold?: number;
  };
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
  details?: string;
}

/**
 * Session state for tracking intervention effects
 */
interface SessionState {
  sessionId: string;
  autonomyLevel: number;
  isPaused: boolean;
  pendingAudits: string[];
  interventionCount: number;
  lastInterventionTime?: Date;
  rollbackPoint?: {
    timestamp: Date;
    stateSnapshot: Record<string, unknown>;
  };
}

/**
 * Default intervention thresholds
 */
const DEFAULT_THRESHOLDS = {
  reduceAutonomy: 35,
  triggerAudit: 45,
  pauseExecution: 60,
} as const;

/**
 * InterventionEngine class - Manages automatic interventions for drift
 *
 * Monitors alignment scores and policy violations, automatically applying
 * interventions when thresholds are exceeded.
 */
export class InterventionEngine extends EventEmitter {
  private readonly config: InterventionConfig;
  private readonly thresholds: {
    reduceAutonomy: number;
    triggerAudit: number;
    pauseExecution: number;
  };
  private readonly interventionHistory: Map<string, InterventionRecord[]>;
  private readonly sessionStates: Map<string, SessionState>;
  private readonly maxHistoryEntries: number;

  constructor(config: InterventionConfig) {
    super();
    this.config = config;
    this.thresholds = {
      reduceAutonomy:
        config.thresholds?.reduceAutonomy ?? DEFAULT_THRESHOLDS.reduceAutonomy,
      triggerAudit:
        config.thresholds?.triggerAudit ?? DEFAULT_THRESHOLDS.triggerAudit,
      pauseExecution:
        config.thresholds?.pauseExecution ?? DEFAULT_THRESHOLDS.pauseExecution,
    };
    this.interventionHistory = new Map();
    this.sessionStates = new Map();
    this.maxHistoryEntries = config.maxHistoryEntries ?? 1000;
  }

  /**
   * Evaluate a session and determine required interventions
   *
   * @param sessionId - The session identifier
   * @param alignmentScore - Current alignment score (0-100, higher = more drift)
   * @param policyViolations - List of policy violation identifiers
   * @returns Array of interventions to apply
   */
  async evaluate(
    sessionId: string,
    alignmentScore: number,
    policyViolations: string[]
  ): Promise<InterventionType[]> {
    if (!this.config.enabled) {
      return [];
    }

    const interventions: InterventionType[] = [];

    // Initialize session state if needed
    this.ensureSessionState(sessionId);

    // Check for critical policy violations requiring immediate rollback
    if (this.hasCriticalPolicyViolation(policyViolations)) {
      interventions.push('notify_guardian');
      if (this.config.autoRollbackOnCritical) {
        interventions.push('rollback');
        interventions.push('pause_execution');
      }
      return interventions;
    }

    // Evaluate thresholds from most severe to least
    if (alignmentScore >= this.thresholds.pauseExecution) {
      interventions.push('pause_execution');
      interventions.push('notify_guardian');
      interventions.push('trigger_audit');
    } else if (alignmentScore >= this.thresholds.triggerAudit) {
      interventions.push('trigger_audit');
      interventions.push('reduce_autonomy');
    } else if (alignmentScore >= this.thresholds.reduceAutonomy) {
      interventions.push('reduce_autonomy');
    }

    // Add guardian notification for any policy violations
    if (
      policyViolations.length > 0 &&
      !interventions.includes('notify_guardian')
    ) {
      interventions.push('notify_guardian');
    }

    this.emit('evaluation_complete', {
      sessionId,
      alignmentScore,
      policyViolations,
      interventions,
    });

    return interventions;
  }

  /**
   * Apply a set of interventions to a session
   *
   * @param sessionId - The session identifier
   * @param interventions - Array of interventions to apply
   */
  async applyInterventions(
    sessionId: string,
    interventions: InterventionType[]
  ): Promise<void> {
    if (interventions.length === 0) {
      return;
    }

    this.ensureSessionState(sessionId);
    const state = this.sessionStates.get(sessionId)!;

    for (const intervention of interventions) {
      const record = this.createInterventionRecord(
        sessionId,
        intervention,
        state
      );

      try {
        switch (intervention) {
          case 'reduce_autonomy':
            await this.reduceSessionAutonomy(sessionId);
            break;
          case 'trigger_audit':
            await this.scheduleAudit(sessionId);
            break;
          case 'pause_execution':
            await this.pauseSession(sessionId);
            break;
          case 'notify_guardian':
            await this.notifyGuardian(sessionId);
            break;
          case 'rollback':
            await this.rollbackSession(sessionId);
            break;
        }

        record.status = 'applied';
        this.emit('intervention_applied', record);
      } catch (error) {
        record.status = 'failed';
        record.details =
          error instanceof Error ? error.message : 'Unknown error';
        this.emit('intervention_failed', record);
      }

      this.addToHistory(sessionId, record);
    }

    // Update session intervention tracking
    state.interventionCount += interventions.length;
    state.lastInterventionTime = new Date();
  }

  /**
   * Reduce the autonomy level of a session
   * Limits what operations the session can perform independently
   */
  private async reduceSessionAutonomy(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Reduce autonomy by 25% each time, minimum 10%
    state.autonomyLevel = Math.max(10, state.autonomyLevel - 25);

    this.emit('autonomy_reduced', {
      sessionId,
      newLevel: state.autonomyLevel,
      timestamp: new Date(),
    });
  }

  /**
   * Schedule an audit for a session
   * Queues the session for detailed review
   */
  private async scheduleAudit(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const auditId = `audit-${sessionId}-${Date.now()}`;
    state.pendingAudits.push(auditId);

    this.emit('audit_scheduled', {
      sessionId,
      auditId,
      timestamp: new Date(),
    });
  }

  /**
   * Pause execution of a session
   * Stops all ongoing operations
   */
  private async pauseSession(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.isPaused = true;

    this.emit('session_paused', {
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Notify the guardian about intervention events
   * Sends alerts through configured channels
   */
  private async notifyGuardian(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    const history = this.getInterventionHistory(sessionId);

    const notification = {
      sessionId,
      timestamp: new Date().toISOString(),
      currentState: state
        ? {
            autonomyLevel: state.autonomyLevel,
            isPaused: state.isPaused,
            pendingAudits: state.pendingAudits.length,
            interventionCount: state.interventionCount,
          }
        : null,
      recentInterventions: history.slice(-5),
    };

    // If webhook URL is configured, send notification
    if (this.config.guardianWebhookUrl) {
      await this.sendWebhookNotification(notification);
    }

    this.emit('guardian_notified', notification);
  }

  /**
   * Rollback a session to its last known good state
   * Reverts changes made since the last rollback point
   */
  private async rollbackSession(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!state.rollbackPoint) {
      this.emit('rollback_skipped', {
        sessionId,
        reason: 'No rollback point available',
        timestamp: new Date(),
      });
      return;
    }

    const rollbackData = {
      sessionId,
      rollbackPoint: state.rollbackPoint.timestamp,
      stateSnapshot: state.rollbackPoint.stateSnapshot,
      timestamp: new Date(),
    };

    // Reset session state to defaults after rollback
    state.autonomyLevel = 100;
    state.isPaused = true; // Keep paused after rollback for review
    state.rollbackPoint = undefined;

    // Mark any recent interventions as rolled back
    const history = this.interventionHistory.get(sessionId) || [];
    for (const record of history) {
      if (record.status === 'applied') {
        record.status = 'rolled_back';
      }
    }

    this.emit('session_rolled_back', rollbackData);
  }

  /**
   * Get the intervention history for a session
   *
   * @param sessionId - The session identifier
   * @returns Array of intervention records
   */
  getInterventionHistory(sessionId: string): InterventionRecord[] {
    return this.interventionHistory.get(sessionId) || [];
  }

  /**
   * Set a rollback point for a session
   *
   * @param sessionId - The session identifier
   * @param stateSnapshot - State data to restore on rollback
   */
  setRollbackPoint(
    sessionId: string,
    stateSnapshot: Record<string, unknown>
  ): void {
    this.ensureSessionState(sessionId);
    const state = this.sessionStates.get(sessionId)!;

    state.rollbackPoint = {
      timestamp: new Date(),
      stateSnapshot,
    };

    this.emit('rollback_point_set', {
      sessionId,
      timestamp: state.rollbackPoint.timestamp,
    });
  }

  /**
   * Resume a paused session
   *
   * @param sessionId - The session identifier
   */
  resumeSession(sessionId: string): void {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.isPaused = false;

    this.emit('session_resumed', {
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Get the current state of a session
   *
   * @param sessionId - The session identifier
   * @returns Session state or undefined if not found
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Clear intervention history for a session
   *
   * @param sessionId - The session identifier
   */
  clearHistory(sessionId: string): void {
    this.interventionHistory.delete(sessionId);
  }

  /**
   * Check if policy violations include any critical patterns
   */
  private hasCriticalPolicyViolation(policyViolations: string[]): boolean {
    if (
      !this.config.criticalPolicies ||
      this.config.criticalPolicies.length === 0
    ) {
      return false;
    }

    return policyViolations.some(violation =>
      this.config.criticalPolicies!.some(critical =>
        violation.toLowerCase().includes(critical.toLowerCase())
      )
    );
  }

  /**
   * Ensure session state exists, creating if needed
   */
  private ensureSessionState(sessionId: string): void {
    if (!this.sessionStates.has(sessionId)) {
      this.sessionStates.set(sessionId, {
        sessionId,
        autonomyLevel: 100,
        isPaused: false,
        pendingAudits: [],
        interventionCount: 0,
      });
    }
  }

  /**
   * Create an intervention record
   */
  private createInterventionRecord(
    sessionId: string,
    interventionType: InterventionType,
    state: SessionState
  ): InterventionRecord {
    return {
      id: `int-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      timestamp: new Date(),
      interventionType,
      trigger: {
        alignmentScore: 0, // Will be set by caller if needed
        policyViolations: [],
      },
      status: 'pending',
    };
  }

  /**
   * Add an intervention record to history
   */
  private addToHistory(sessionId: string, record: InterventionRecord): void {
    if (!this.interventionHistory.has(sessionId)) {
      this.interventionHistory.set(sessionId, []);
    }

    const history = this.interventionHistory.get(sessionId)!;
    history.push(record);

    // Trim history if it exceeds max entries
    if (history.length > this.maxHistoryEntries) {
      history.splice(0, history.length - this.maxHistoryEntries);
    }
  }

  /**
   * Send notification via webhook
   */
  private async sendWebhookNotification(
    notification: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.guardianWebhookUrl) {
      return;
    }

    try {
      // Use dynamic import for fetch in Node.js environments
      const response = await fetch(this.config.guardianWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook request failed with status ${response.status}`
        );
      }
    } catch (error) {
      this.emit('webhook_error', {
        url: this.config.guardianWebhookUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
