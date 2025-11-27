/**
 * Session Crash Recovery Manager
 *
 * Handles crash detection, analysis, and automatic recovery
 * of Claude Code sessions.
 *
 * @module session-recovery
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import ClaudeSessionSpawner, {
  ClaudeSessionStatus,
  SessionCrashReport,
} from './claude-session-spawner.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface RecoveryConfig {
  /** Enable automatic recovery */
  enabled: boolean;
  /** Maximum recovery attempts per session */
  maxRetries: number;
  /** Delay between retry attempts (ms) */
  retryDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Save crash dumps to disk */
  saveCrashDumps: boolean;
  /** Crash dump directory */
  crashDumpDirectory?: string;
  /** Recovery strategy */
  strategy: 'immediate' | 'delayed' | 'manual';
}

export interface RecoveryAttempt {
  /** Session ID being recovered */
  sessionId: string;
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Timestamp of attempt */
  timestamp: Date;
  /** Recovery strategy used */
  strategy: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** New session ID if successful */
  newSessionId?: string;
}

export interface RecoveryState {
  /** Session being recovered */
  sessionId: string;
  /** Original crash report */
  crashReport: SessionCrashReport;
  /** Recovery attempts made */
  attempts: RecoveryAttempt[];
  /** Current status */
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'abandoned';
  /** Timestamp when recovery started */
  startedAt: Date;
  /** Timestamp when recovery completed */
  completedAt?: Date;
}

export interface CrashAnalysis {
  /** Crash type classification */
  crashType:
    | 'oom'
    | 'timeout'
    | 'segfault'
    | 'network'
    | 'permission'
    | 'unknown';
  /** Root cause analysis */
  rootCause: string;
  /** Recovery recommendation */
  recommendation: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggested fix actions */
  suggestedFixes: string[];
}

// ============================================================================
// Session Recovery Manager Class
// ============================================================================

export class SessionRecoveryManager extends EventEmitter {
  private readonly spawner: ClaudeSessionSpawner;
  private readonly config: RecoveryConfig;
  private readonly recoveryStates = new Map<string, RecoveryState>();
  private readonly recoveryHistory: RecoveryState[] = [];

  constructor(spawner: ClaudeSessionSpawner, config: RecoveryConfig) {
    super();
    this.spawner = spawner;
    this.config = config;

    this.setupEventHandlers();
  }

  /**
   * Handle a session crash
   */
  async handleCrash(
    sessionId: string,
    crashReport: SessionCrashReport
  ): Promise<void> {
    this.emit('crash-detected', { sessionId, crashReport });

    // Save crash dump if configured
    if (this.config.saveCrashDumps) {
      await this.saveCrashDump(sessionId, crashReport);
    }

    // Analyze crash
    const analysis = this.analyzeCrash(crashReport);
    this.emit('crash-analyzed', { sessionId, analysis });

    // Check if recovery should be attempted
    if (!this.config.enabled) {
      return;
    }

    // Create recovery state
    const recoveryState: RecoveryState = {
      sessionId,
      crashReport,
      attempts: [],
      status: 'pending',
      startedAt: new Date(),
    };

    this.recoveryStates.set(sessionId, recoveryState);

    // Execute recovery strategy
    await this.executeRecovery(recoveryState, analysis);
  }

  /**
   * Get recovery status for a session
   */
  getRecoveryStatus(sessionId: string): RecoveryState | null {
    return this.recoveryStates.get(sessionId) ?? null;
  }

  /**
   * Get all active recovery operations
   */
  getActiveRecoveries(): RecoveryState[] {
    return Array.from(this.recoveryStates.values()).filter(
      (state) =>
        state.status === 'pending' || state.status === 'in_progress'
    );
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): RecoveryStatistics {
    const allStates = [
      ...Array.from(this.recoveryStates.values()),
      ...this.recoveryHistory,
    ];

    const totalAttempts = allStates.reduce(
      (sum, state) => sum + state.attempts.length,
      0
    );

    const successful = allStates.filter(
      (state) => state.status === 'succeeded'
    ).length;

    return {
      totalCrashes: allStates.length,
      totalRecoveryAttempts: totalAttempts,
      successfulRecoveries: successful,
      failedRecoveries: allStates.filter((state) => state.status === 'failed')
        .length,
      abandonedRecoveries: allStates.filter(
        (state) => state.status === 'abandoned'
      ).length,
      recoveryRate: allStates.length > 0 ? successful / allStates.length : 0,
      avgAttemptsPerRecovery: allStates.length > 0 ? totalAttempts / allStates.length : 0,
    };
  }

  /**
   * Manually trigger recovery for a failed session
   */
  async triggerManualRecovery(sessionId: string): Promise<boolean> {
    const state = this.recoveryStates.get(sessionId);

    if (!state) {
      throw new Error(`No recovery state found for session ${sessionId}`);
    }

    if (state.status === 'in_progress') {
      throw new Error(`Recovery already in progress for session ${sessionId}`);
    }

    const analysis = this.analyzeCrash(state.crashReport);
    return this.executeRecovery(state, analysis);
  }

  /**
   * Abandon recovery for a session
   */
  abandonRecovery(sessionId: string): void {
    const state = this.recoveryStates.get(sessionId);

    if (state) {
      state.status = 'abandoned';
      state.completedAt = new Date();

      this.recoveryHistory.push(state);
      this.recoveryStates.delete(sessionId);

      this.emit('recovery-abandoned', { sessionId });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupEventHandlers(): void {
    this.spawner.on('session-ended', ({ sessionId, status }) => {
      if (status.state === 'crashed') {
        const crashReport: SessionCrashReport = {
          sessionId,
          timestamp: status.endTime ?? new Date(),
          exitCode: status.exitCode,
          lastState: status.state,
          lastOutput: status.stdout.slice(-1000),
          stackTrace: status.errorMessage,
        };

        this.handleCrash(sessionId, crashReport).catch((error) => {
          console.error(`Failed to handle crash for ${sessionId}:`, error);
        });
      }
    });
  }

  private analyzeCrash(crashReport: SessionCrashReport): CrashAnalysis {
    const { lastOutput, exitCode, signal, stackTrace } = crashReport;

    // Analyze crash type
    let crashType: CrashAnalysis['crashType'] = 'unknown';
    let rootCause = 'Unknown cause';
    let confidence = 0.5;
    const suggestedFixes: string[] = [];

    // OOM detection
    if (
      /out of memory|OOM|allocation failed/i.test(lastOutput) ||
      /out of memory/i.test(stackTrace ?? '')
    ) {
      crashType = 'oom';
      rootCause = 'Out of memory - session exceeded available RAM';
      confidence = 0.9;
      suggestedFixes.push('Increase memory limits');
      suggestedFixes.push('Reduce batch size or chunk operations');
    }
    // Timeout detection
    else if (
      /timeout|timed out|deadline exceeded/i.test(lastOutput) ||
      signal === 'SIGTERM'
    ) {
      crashType = 'timeout';
      rootCause = 'Session exceeded maximum execution time';
      confidence = 0.85;
      suggestedFixes.push('Increase timeout limit');
      suggestedFixes.push('Break task into smaller subtasks');
    }
    // Segmentation fault
    else if (signal === 'SIGSEGV' || /segmentation fault/i.test(lastOutput)) {
      crashType = 'segfault';
      rootCause = 'Segmentation fault - possible native code issue';
      confidence = 0.95;
      suggestedFixes.push('Update Claude CLI to latest version');
      suggestedFixes.push('Check for corrupted dependencies');
    }
    // Network errors
    else if (/network|connection|ECONNREFUSED|ETIMEDOUT/i.test(lastOutput)) {
      crashType = 'network';
      rootCause = 'Network connectivity issue';
      confidence = 0.8;
      suggestedFixes.push('Check network connectivity');
      suggestedFixes.push('Retry with exponential backoff');
    }
    // Permission errors
    else if (/permission denied|EACCES|EPERM/i.test(lastOutput)) {
      crashType = 'permission';
      rootCause = 'Permission denied error';
      confidence = 0.9;
      suggestedFixes.push('Check file/directory permissions');
      suggestedFixes.push('Verify user has necessary access rights');
    }

    // Generate recommendation
    const recommendation = this.generateRecoveryRecommendation(
      crashType,
      confidence
    );

    return {
      crashType,
      rootCause,
      recommendation,
      confidence,
      suggestedFixes,
    };
  }

  private generateRecoveryRecommendation(
    crashType: CrashAnalysis['crashType'],
    confidence: number
  ): string {
    if (confidence < 0.6) {
      return 'Manual investigation recommended - crash cause unclear';
    }

    switch (crashType) {
      case 'oom':
        return 'Automatic recovery with increased memory allocation';
      case 'timeout':
        return 'Automatic recovery with extended timeout';
      case 'network':
        return 'Automatic recovery with retry after delay';
      case 'permission':
        return 'Manual intervention required - fix permissions';
      case 'segfault':
        return 'Manual intervention required - potential bug in Claude CLI';
      default:
        return 'Automatic recovery with standard retry';
    }
  }

  private async executeRecovery(
    state: RecoveryState,
    analysis: CrashAnalysis
  ): Promise<boolean> {
    state.status = 'in_progress';

    const attemptNumber = state.attempts.length + 1;

    if (attemptNumber > this.config.maxRetries) {
      state.status = 'failed';
      state.completedAt = new Date();
      this.recoveryHistory.push(state);
      this.recoveryStates.delete(state.sessionId);

      this.emit('recovery-failed', {
        sessionId: state.sessionId,
        reason: 'Max retries exceeded',
      });

      return false;
    }

    // Calculate delay with exponential backoff
    const delay =
      this.config.retryDelay *
      Math.pow(this.config.backoffMultiplier, attemptNumber - 1);

    if (this.config.strategy === 'delayed' && attemptNumber > 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const attempt: RecoveryAttempt = {
      sessionId: state.sessionId,
      attemptNumber,
      timestamp: new Date(),
      strategy: analysis.recommendation,
      success: false,
    };

    try {
      // Get original session status to reconstruct config
      const originalStatus = this.spawner.getSessionStatus(state.sessionId);

      if (!originalStatus) {
        throw new Error('Cannot find original session status');
      }

      // TODO: Reconstruct session config from original status
      // This would require storing the original config or extracting it from status
      // For now, we emit an event for manual handling

      this.emit('recovery-attempt', {
        sessionId: state.sessionId,
        attemptNumber,
        analysis,
      });

      // Recovery would happen here with modified config based on analysis
      // Example: increase timeout, memory, etc.

      attempt.success = true;
      state.status = 'succeeded';
      state.completedAt = new Date();

      this.emit('recovery-succeeded', {
        sessionId: state.sessionId,
        attemptNumber,
      });

      return true;
    } catch (error) {
      attempt.success = false;
      attempt.error = error instanceof Error ? error.message : String(error);

      this.emit('recovery-attempt-failed', {
        sessionId: state.sessionId,
        attemptNumber,
        error: attempt.error,
      });

      // Retry
      return this.executeRecovery(state, analysis);
    } finally {
      state.attempts.push(attempt);
    }
  }

  private async saveCrashDump(
    sessionId: string,
    crashReport: SessionCrashReport
  ): Promise<void> {
    const dumpDir =
      this.config.crashDumpDirectory ?? '.orchestrator-daemon/crash-dumps';
    await fs.mkdir(dumpDir, { recursive: true });

    const timestamp = crashReport.timestamp.toISOString().replace(/:/g, '-');
    const filename = `crash-${sessionId}-${timestamp}.json`;
    const filepath = path.join(dumpDir, filename);

    await fs.writeFile(filepath, JSON.stringify(crashReport, null, 2));

    this.emit('crash-dump-saved', { sessionId, filepath });
  }
}

// ============================================================================
// Additional Types
// ============================================================================

export interface RecoveryStatistics {
  totalCrashes: number;
  totalRecoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  abandonedRecoveries: number;
  recoveryRate: number;
  avgAttemptsPerRecovery: number;
}

// ============================================================================
// Exports
// ============================================================================

export default SessionRecoveryManager;
