/**
 * Skill Analytics
 *
 * Tracks skill usage patterns including execution counts, success rates,
 * durations, and error frequencies. Provides aggregated summaries for
 * each skill and overall system health metrics.
 *
 * Data is kept in-memory with a configurable maximum entry limit.
 * Oldest entries are evicted when the limit is reached.
 *
 * @module skills/skill-analytics
 */

import type {
  SkillAnalyticsSummary,
  SkillExecutionResult,
  SkillsConfig,
  SkillUsageEntry,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ENTRIES = 10_000;

// ---------------------------------------------------------------------------
// Analytics Tracker
// ---------------------------------------------------------------------------

/**
 * Tracks skill usage and provides analytics summaries.
 *
 * Usage:
 * ```typescript
 * const analytics = new SkillAnalytics({ maxEntries: 5000 });
 *
 * // Record an execution
 * analytics.record({
 *   skillName: 'review-pr',
 *   timestamp: Date.now(),
 *   durationMs: 1200,
 *   success: true,
 *   executionContext: 'inline',
 * });
 *
 * // Get summary for a specific skill
 * const summary = analytics.getSummary('review-pr');
 *
 * // Get top skills by usage
 * const top = analytics.getTopSkills(10);
 * ```
 */
export class SkillAnalytics {
  private entries: SkillUsageEntry[] = [];
  private maxEntries: number;
  private enabled: boolean;

  constructor(config?: SkillsConfig) {
    this.maxEntries = config?.analytics?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.enabled = config?.analytics?.enabled !== false;
  }

  /**
   * Record a skill execution.
   */
  record(entry: SkillUsageEntry): void {
    if (!this.enabled) {
return;
}

    this.entries.push(entry);

    // Evict oldest entries if limit is exceeded
    if (this.entries.length > this.maxEntries) {
      const excess = this.entries.length - this.maxEntries;
      this.entries.splice(0, excess);
    }
  }

  /**
   * Record a skill execution from a SkillExecutionResult.
   */
  recordResult(result: SkillExecutionResult, sessionId?: string): void {
    this.record({
      skillName: result.skillName,
      timestamp: Date.now(),
      durationMs: result.durationMs ?? 0,
      success: result.success,
      executionContext: result.executionContext,
      sessionId,
      error: result.error,
    });
  }

  /**
   * Get the analytics summary for a specific skill.
   */
  getSummary(skillName: string): SkillAnalyticsSummary | undefined {
    const skillEntries = this.entries.filter(e => e.skillName === skillName);
    if (skillEntries.length === 0) {
return undefined;
}

    return buildSummary(skillName, skillEntries);
  }

  /**
   * Get analytics summaries for all tracked skills.
   */
  getAllSummaries(): SkillAnalyticsSummary[] {
    const bySkill = new Map<string, SkillUsageEntry[]>();

    for (const entry of this.entries) {
      const existing = bySkill.get(entry.skillName);
      if (existing) {
        existing.push(entry);
      } else {
        bySkill.set(entry.skillName, [entry]);
      }
    }

    return Array.from(bySkill.entries())
      .map(([name, entries]) => buildSummary(name, entries))
      .sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Get the top N skills by total execution count.
   */
  getTopSkills(limit: number = 10): SkillAnalyticsSummary[] {
    return this.getAllSummaries().slice(0, limit);
  }

  /**
   * Get skills sorted by failure rate (highest first).
   */
  getMostFailingSkills(limit: number = 10): SkillAnalyticsSummary[] {
    return this.getAllSummaries()
      .filter(s => s.totalExecutions > 0)
      .sort((a, b) => {
        const rateA = a.failureCount / a.totalExecutions;
        const rateB = b.failureCount / b.totalExecutions;
        return rateB - rateA;
      })
      .slice(0, limit);
  }

  /**
   * Get overall system metrics.
   */
  getSystemMetrics(): {
    totalExecutions: number;
    totalSuccess: number;
    totalFailures: number;
    avgDurationMs: number;
    uniqueSkills: number;
    uniqueSessions: number;
  } {
    const uniqueSkills = new Set<string>();
    const uniqueSessions = new Set<string>();
    let totalDuration = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const entry of this.entries) {
      uniqueSkills.add(entry.skillName);
      if (entry.sessionId) {
uniqueSessions.add(entry.sessionId);
}
      totalDuration += entry.durationMs;
      if (entry.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      totalExecutions: this.entries.length,
      totalSuccess: successCount,
      totalFailures: failureCount,
      avgDurationMs: this.entries.length > 0
        ? Math.round(totalDuration / this.entries.length)
        : 0,
      uniqueSkills: uniqueSkills.size,
      uniqueSessions: uniqueSessions.size,
    };
  }

  /**
   * Get entries for a specific time range.
   */
  getEntriesInRange(startMs: number, endMs: number): SkillUsageEntry[] {
    return this.entries.filter(
      e => e.timestamp >= startMs && e.timestamp <= endMs,
    );
  }

  /**
   * Get the total number of tracked entries.
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all analytics data.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export all entries (for persistence or transfer).
   */
  exportEntries(): SkillUsageEntry[] {
    return [...this.entries];
  }

  /**
   * Import entries (for restoring from persistence).
   */
  importEntries(entries: SkillUsageEntry[]): void {
    this.entries.push(...entries);

    // Enforce max entries
    if (this.entries.length > this.maxEntries) {
      const excess = this.entries.length - this.maxEntries;
      this.entries.splice(0, excess);
    }
  }

  /**
   * Update configuration.
   */
  updateConfig(config: SkillsConfig): void {
    this.maxEntries = config.analytics?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.enabled = config.analytics?.enabled !== false;

    // Enforce new max
    if (this.entries.length > this.maxEntries) {
      const excess = this.entries.length - this.maxEntries;
      this.entries.splice(0, excess);
    }
  }

  /**
   * Format a human-readable analytics report.
   */
  formatReport(): string {
    const metrics = this.getSystemMetrics();
    const top = this.getTopSkills(5);

    const lines: string[] = [
      'Skill Usage Analytics',
      '=====================',
      '',
      `Total Executions: ${metrics.totalExecutions}`,
      `Success Rate: ${metrics.totalExecutions > 0
        ? Math.round((metrics.totalSuccess / metrics.totalExecutions) * 100)
        : 0}%`,
      `Average Duration: ${metrics.avgDurationMs}ms`,
      `Unique Skills Used: ${metrics.uniqueSkills}`,
      `Unique Sessions: ${metrics.uniqueSessions}`,
    ];

    if (top.length > 0) {
      lines.push('', 'Top Skills:');
      for (const summary of top) {
        const rate = summary.totalExecutions > 0
          ? Math.round((summary.successCount / summary.totalExecutions) * 100)
          : 0;
        lines.push(
          `  ${summary.skillName}: ${summary.totalExecutions} executions` +
          ` (${rate}% success, avg ${summary.avgDurationMs}ms)`,
        );
      }
    }

    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(
  skillName: string,
  entries: SkillUsageEntry[],
): SkillAnalyticsSummary {
  let totalDuration = 0;
  let successCount = 0;
  let failureCount = 0;
  let firstAt = Infinity;
  let lastAt = 0;

  for (const entry of entries) {
    totalDuration += entry.durationMs;
    if (entry.success) {
      successCount++;
    } else {
      failureCount++;
    }
    if (entry.timestamp < firstAt) {
firstAt = entry.timestamp;
}
    if (entry.timestamp > lastAt) {
lastAt = entry.timestamp;
}
  }

  return {
    skillName,
    totalExecutions: entries.length,
    successCount,
    failureCount,
    avgDurationMs: entries.length > 0 ? Math.round(totalDuration / entries.length) : 0,
    lastExecutedAt: lastAt,
    firstExecutedAt: firstAt === Infinity ? 0 : firstAt,
  };
}
