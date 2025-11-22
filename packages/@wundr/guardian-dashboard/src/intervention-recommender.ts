/**
 * Intervention Recommender for Guardian Dashboard
 *
 * Analyzes drift data and generates intervention recommendations
 * to maintain AI governance and alignment standards.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Severity levels for intervention recommendations
 */
export type InterventionSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents a single intervention recommendation
 */
export interface InterventionRecommendation {
  /** The dimension or area requiring intervention */
  readonly dimension: string;
  /** Severity level of the issue */
  readonly severity: InterventionSeverity;
  /** Recommended action to take */
  readonly action: string;
  /** Explanation for why this intervention is needed */
  readonly rationale: string;
  /** Hours within which to address this issue */
  readonly urgency: number;
}

/**
 * Configuration thresholds for triggering interventions
 */
export interface InterventionThresholds {
  /** Maximum acceptable policy violation rate (0-1) */
  readonly policyViolationRate: number;
  /** Maximum acceptable intent-outcome gap (0-1) */
  readonly intentOutcomeGap: number;
  /** Maximum acceptable evaluator disagreement rate (0-1) */
  readonly evaluatorDisagreementRate: number;
  /** Maximum acceptable escalation suppression drop rate (0-1) */
  readonly escalationSuppressionDropRate: number;
  /** Maximum acceptable reward hacking instances */
  readonly rewardHackingInstances: number;
}

/**
 * Configuration for the InterventionRecommender
 */
export interface RecommenderConfig {
  /** Custom thresholds for interventions */
  readonly thresholds?: Partial<InterventionThresholds>;
  /** Enable debug logging */
  readonly debug?: boolean;
  /** Organization name for reporting */
  readonly organizationName?: string;
  /** Maximum recommendations per evaluation */
  readonly maxRecommendations?: number;
}

/**
 * Drift data input for analysis
 */
export interface DriftData {
  /** Policy violation rate (0-1) */
  readonly policyViolationRate?: number;
  /** Gap between intended and actual outcomes (0-1) */
  readonly intentOutcomeGap?: number;
  /** Rate of disagreement between evaluators (0-1) */
  readonly evaluatorDisagreementRate?: number;
  /** Drop rate in escalation handling (0-1) */
  readonly escalationSuppressionDropRate?: number;
  /** Number of detected reward hacking instances */
  readonly rewardHackingInstances?: number;
  /** Timestamp of the data collection */
  readonly timestamp?: Date;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Action item within an action plan
 */
export interface ActionItem {
  /** Priority order (1 = highest) */
  readonly priority: number;
  /** Title of the action item */
  readonly title: string;
  /** Detailed description of what to do */
  readonly description: string;
  /** Deadline in hours from now */
  readonly deadline: number;
  /** Team or role responsible */
  readonly assignee: string;
  /** Related recommendations */
  readonly relatedRecommendations: InterventionRecommendation[];
}

/**
 * Complete action plan with prioritized items
 */
export interface ActionPlan {
  /** Unique plan identifier */
  readonly id: string;
  /** Plan creation timestamp */
  readonly createdAt: Date;
  /** Overall urgency level */
  readonly overallUrgency: InterventionSeverity;
  /** Prioritized list of action items */
  readonly actionItems: ActionItem[];
  /** Summary of the plan */
  readonly summary: string;
  /** Estimated time to complete all actions (hours) */
  readonly estimatedCompletionTime: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_THRESHOLDS: InterventionThresholds = {
  policyViolationRate: 0.05,
  intentOutcomeGap: 0.15,
  evaluatorDisagreementRate: 0.2,
  escalationSuppressionDropRate: 0.1,
  rewardHackingInstances: 3,
};

// ============================================================================
// InterventionRecommender Class
// ============================================================================

/**
 * Analyzes drift data and generates intervention recommendations
 * for maintaining AI governance standards
 */
export class InterventionRecommender {
  private readonly thresholds: InterventionThresholds;
  private readonly config: RecommenderConfig;

  constructor(config: RecommenderConfig = {}) {
    this.config = config;
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...config.thresholds,
    };
  }

  /**
   * Generate intervention recommendations based on drift data
   */
  recommendInterventions(driftData: DriftData): InterventionRecommendation[] {
    const recommendations: InterventionRecommendation[] = [];

    // Evaluate each dimension and collect recommendations
    if (driftData.policyViolationRate !== undefined) {
      const rec = this.evaluatePolicyViolations(driftData.policyViolationRate);
      if (rec) {
        recommendations.push(rec);
      }
    }

    if (driftData.intentOutcomeGap !== undefined) {
      const rec = this.evaluateIntentOutcomeGap(driftData.intentOutcomeGap);
      if (rec) {
        recommendations.push(rec);
      }
    }

    if (driftData.evaluatorDisagreementRate !== undefined) {
      const rec = this.evaluateEvaluatorDisagreement(
        driftData.evaluatorDisagreementRate,
      );
      if (rec) {
        recommendations.push(rec);
      }
    }

    if (driftData.escalationSuppressionDropRate !== undefined) {
      const rec = this.evaluateEscalationSuppression(
        driftData.escalationSuppressionDropRate,
      );
      if (rec) {
        recommendations.push(rec);
      }
    }

    if (driftData.rewardHackingInstances !== undefined) {
      const rec = this.evaluateRewardHacking(driftData.rewardHackingInstances);
      if (rec) {
        recommendations.push(rec);
      }
    }

    // Apply max recommendations limit if configured
    const maxRecs = this.config.maxRecommendations;
    if (maxRecs && recommendations.length > maxRecs) {
      return this.prioritizeRecommendations(recommendations).slice(0, maxRecs);
    }

    return recommendations;
  }

  /**
   * Sort recommendations by severity and urgency
   */
  prioritizeRecommendations(
    recommendations: InterventionRecommendation[],
  ): InterventionRecommendation[] {
    const severityOrder: Record<InterventionSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...recommendations].sort((a, b) => {
      // First sort by severity
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // Then by urgency (lower urgency hours = more urgent)
      return a.urgency - b.urgency;
    });
  }

  /**
   * Generate a complete action plan from recommendations
   */
  generateActionPlan(
    recommendations: InterventionRecommendation[],
  ): ActionPlan {
    const prioritized = this.prioritizeRecommendations(recommendations);
    const overallUrgency = this.determineOverallUrgency(prioritized);

    const actionItems = this.groupIntoActionItems(prioritized);
    const estimatedCompletionTime = this.calculateCompletionTime(actionItems);

    return {
      id: this.generatePlanId(),
      createdAt: new Date(),
      overallUrgency,
      actionItems,
      summary: this.generatePlanSummary(prioritized, overallUrgency),
      estimatedCompletionTime,
    };
  }

  // ============================================================================
  // Private Evaluation Methods
  // ============================================================================

  /**
   * Evaluate policy violation rate and generate recommendation
   */
  private evaluatePolicyViolations(
    rate: number,
  ): InterventionRecommendation | null {
    const threshold = this.thresholds.policyViolationRate;

    if (rate <= threshold) {
      return null;
    }

    const severity = this.calculateSeverity(rate, threshold);
    const urgency = this.calculateUrgency(severity);

    return {
      dimension: 'Policy Violations',
      severity,
      action: this.getPolicyViolationAction(severity),
      rationale:
        `Policy violation rate of ${(rate * 100).toFixed(1)}% exceeds threshold of ${(threshold * 100).toFixed(1)}%. ` +
        'This indicates potential misalignment between AI behavior and established governance policies.',
      urgency,
    };
  }

  /**
   * Evaluate intent-outcome gap and generate recommendation
   */
  private evaluateIntentOutcomeGap(
    gap: number,
  ): InterventionRecommendation | null {
    const threshold = this.thresholds.intentOutcomeGap;

    if (gap <= threshold) {
      return null;
    }

    const severity = this.calculateSeverity(gap, threshold);
    const urgency = this.calculateUrgency(severity);

    return {
      dimension: 'Intent-Outcome Alignment',
      severity,
      action: this.getIntentOutcomeAction(severity),
      rationale:
        `Intent-outcome gap of ${(gap * 100).toFixed(1)}% exceeds threshold of ${(threshold * 100).toFixed(1)}%. ` +
        'AI outputs are not consistently matching intended goals, requiring alignment review.',
      urgency,
    };
  }

  /**
   * Evaluate evaluator disagreement rate and generate recommendation
   */
  private evaluateEvaluatorDisagreement(
    rate: number,
  ): InterventionRecommendation | null {
    const threshold = this.thresholds.evaluatorDisagreementRate;

    if (rate <= threshold) {
      return null;
    }

    const severity = this.calculateSeverity(rate, threshold);
    const urgency = this.calculateUrgency(severity);

    return {
      dimension: 'Evaluator Consistency',
      severity,
      action: this.getEvaluatorDisagreementAction(severity),
      rationale:
        `Evaluator disagreement rate of ${(rate * 100).toFixed(1)}% exceeds threshold of ${(threshold * 100).toFixed(1)}%. ` +
        'Inconsistent evaluation criteria may lead to unreliable quality assessments.',
      urgency,
    };
  }

  /**
   * Evaluate escalation suppression drop rate and generate recommendation
   */
  private evaluateEscalationSuppression(
    dropRate: number,
  ): InterventionRecommendation | null {
    const threshold = this.thresholds.escalationSuppressionDropRate;

    if (dropRate <= threshold) {
      return null;
    }

    const severity = this.calculateSeverity(dropRate, threshold);
    const urgency = this.calculateUrgency(severity);

    return {
      dimension: 'Escalation Handling',
      severity,
      action: this.getEscalationSuppressionAction(severity),
      rationale:
        `Escalation suppression drop rate of ${(dropRate * 100).toFixed(1)}% exceeds threshold of ${(threshold * 100).toFixed(1)}%. ` +
        'Critical issues may not be reaching appropriate oversight levels.',
      urgency,
    };
  }

  /**
   * Evaluate reward hacking instances and generate recommendation
   */
  private evaluateRewardHacking(
    instances: number,
  ): InterventionRecommendation | null {
    const threshold = this.thresholds.rewardHackingInstances;

    if (instances <= threshold) {
      return null;
    }

    const severity = this.calculateInstanceSeverity(instances, threshold);
    const urgency = this.calculateUrgency(severity);

    return {
      dimension: 'Reward Hacking',
      severity,
      action: this.getRewardHackingAction(severity),
      rationale:
        `Detected ${instances} reward hacking instances, exceeding threshold of ${threshold}. ` +
        'AI may be optimizing for proxy metrics rather than true objectives.',
      urgency,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate severity based on how much value exceeds threshold
   */
  private calculateSeverity(
    value: number,
    threshold: number,
  ): InterventionSeverity {
    const ratio = value / threshold;

    if (ratio >= 3) {
      return 'critical';
    }
    if (ratio >= 2) {
      return 'high';
    }
    if (ratio >= 1.5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate severity for instance-based metrics
   */
  private calculateInstanceSeverity(
    instances: number,
    threshold: number,
  ): InterventionSeverity {
    const excess = instances - threshold;

    if (excess >= threshold * 3) {
      return 'critical';
    }
    if (excess >= threshold * 2) {
      return 'high';
    }
    if (excess >= threshold) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate urgency (hours to address) based on severity
   */
  private calculateUrgency(severity: InterventionSeverity): number {
    const urgencyMap: Record<InterventionSeverity, number> = {
      critical: 4,
      high: 24,
      medium: 72,
      low: 168, // 1 week
    };
    return urgencyMap[severity];
  }

  /**
   * Get action recommendation for policy violations
   */
  private getPolicyViolationAction(severity: InterventionSeverity): string {
    const actions: Record<InterventionSeverity, string> = {
      critical:
        'Immediately halt AI operations and conduct emergency policy compliance audit. Deploy corrective constraints.',
      high: 'Escalate to governance team and implement enhanced policy monitoring. Review recent outputs for violations.',
      medium:
        'Schedule policy alignment review and update training guidelines. Increase monitoring frequency.',
      low: 'Add policy violation tracking to next review cycle. Document patterns for future reference.',
    };
    return actions[severity];
  }

  /**
   * Get action recommendation for intent-outcome gap
   */
  private getIntentOutcomeAction(severity: InterventionSeverity): string {
    const actions: Record<InterventionSeverity, string> = {
      critical:
        'Emergency recalibration required. Suspend autonomous operations until alignment is verified.',
      high: 'Conduct comprehensive intent-outcome analysis. Implement additional verification checkpoints.',
      medium:
        'Review and refine prompts and instructions. Update output validation criteria.',
      low: 'Monitor trends and document edge cases. Consider prompt engineering improvements.',
    };
    return actions[severity];
  }

  /**
   * Get action recommendation for evaluator disagreement
   */
  private getEvaluatorDisagreementAction(
    severity: InterventionSeverity,
  ): string {
    const actions: Record<InterventionSeverity, string> = {
      critical:
        'Halt quality assessments and convene emergency evaluator calibration session.',
      high: 'Schedule urgent evaluator training and standardization workshop. Review evaluation rubrics.',
      medium:
        'Implement inter-rater reliability checks. Update evaluation guidelines with clarifications.',
      low: 'Add calibration exercises to regular evaluator meetings. Document disagreement patterns.',
    };
    return actions[severity];
  }

  /**
   * Get action recommendation for escalation suppression
   */
  private getEscalationSuppressionAction(
    severity: InterventionSeverity,
  ): string {
    const actions: Record<InterventionSeverity, string> = {
      critical:
        'Emergency review of all suppressed escalations. Implement mandatory escalation overrides.',
      high: 'Audit escalation pathways and reduce suppression thresholds. Notify oversight committee.',
      medium:
        'Review escalation criteria and adjust sensitivity. Implement escalation tracking dashboard.',
      low: 'Document suppression patterns. Consider adjusting escalation triggers.',
    };
    return actions[severity];
  }

  /**
   * Get action recommendation for reward hacking
   */
  private getRewardHackingAction(severity: InterventionSeverity): string {
    const actions: Record<InterventionSeverity, string> = {
      critical:
        'Immediately redesign reward structure. Implement diverse evaluation metrics and human oversight.',
      high: 'Conduct reward function audit. Add adversarial testing to detect exploitation patterns.',
      medium:
        'Review and diversify reward signals. Implement proxy metric validation.',
      low: 'Monitor for additional instances. Document patterns for reward function improvement.',
    };
    return actions[severity];
  }

  /**
   * Determine overall urgency from recommendations
   */
  private determineOverallUrgency(
    recommendations: InterventionRecommendation[],
  ): InterventionSeverity {
    if (recommendations.length === 0) {
      return 'low';
    }

    const hasCritical = recommendations.some(r => r.severity === 'critical');
    if (hasCritical) {
      return 'critical';
    }

    const hasHigh = recommendations.some(r => r.severity === 'high');
    if (hasHigh) {
      return 'high';
    }

    const hasMedium = recommendations.some(r => r.severity === 'medium');
    if (hasMedium) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Group recommendations into actionable items
   */
  private groupIntoActionItems(
    recommendations: InterventionRecommendation[],
  ): ActionItem[] {
    const groups = new Map<string, InterventionRecommendation[]>();

    // Group by dimension
    for (const rec of recommendations) {
      const existing = groups.get(rec.dimension) || [];
      existing.push(rec);
      groups.set(rec.dimension, existing);
    }

    // Create action items from groups
    const actionItems: ActionItem[] = [];
    let priority = 1;

    for (const [dimension, recs] of Array.from(groups.entries())) {
      const highestSeverity = recs.reduce((highest, rec) => {
        const order = ['low', 'medium', 'high', 'critical'];
        return order.indexOf(rec.severity) > order.indexOf(highest.severity)
          ? rec
          : highest;
      });

      actionItems.push({
        priority,
        title: `Address ${dimension} Issues`,
        description: highestSeverity.action,
        deadline: highestSeverity.urgency,
        assignee: this.determineAssignee(highestSeverity.severity),
        relatedRecommendations: recs,
      });

      priority++;
    }

    return actionItems;
  }

  /**
   * Determine appropriate assignee based on severity
   */
  private determineAssignee(severity: InterventionSeverity): string {
    const assigneeMap: Record<InterventionSeverity, string> = {
      critical: 'AI Governance Lead + Executive Sponsor',
      high: 'AI Governance Team',
      medium: 'AI Operations Team',
      low: 'AI Quality Assurance',
    };
    return assigneeMap[severity];
  }

  /**
   * Calculate estimated completion time for all action items
   */
  private calculateCompletionTime(actionItems: ActionItem[]): number {
    if (actionItems.length === 0) {
      return 0;
    }

    // Estimate based on severity and parallelization potential
    const baseTime = actionItems.reduce((total, item) => {
      const timeByPriority =
        item.priority <= 2 ? item.deadline : item.deadline * 0.5;
      return total + timeByPriority;
    }, 0);

    // Apply parallelization factor (assume 40% can be done in parallel)
    return Math.ceil(baseTime * 0.6);
  }

  /**
   * Generate unique plan identifier
   */
  private generatePlanId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `AP-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Generate human-readable plan summary
   */
  private generatePlanSummary(
    recommendations: InterventionRecommendation[],
    overallUrgency: InterventionSeverity,
  ): string {
    const count = recommendations.length;

    if (count === 0) {
      return 'No interventions required. All metrics within acceptable thresholds.';
    }

    const criticalCount = recommendations.filter(
      r => r.severity === 'critical',
    ).length;
    const highCount = recommendations.filter(r => r.severity === 'high').length;

    const urgencyText: Record<InterventionSeverity, string> = {
      critical: 'CRITICAL: Immediate action required.',
      high: 'HIGH PRIORITY: Prompt attention needed.',
      medium: 'MODERATE: Schedule intervention within 72 hours.',
      low: 'LOW: Include in regular review cycle.',
    };

    let summary = `${urgencyText[overallUrgency]} `;
    summary += `${count} intervention${count > 1 ? 's' : ''} recommended`;

    if (criticalCount > 0) {
      summary += ` (${criticalCount} critical)`;
    } else if (highCount > 0) {
      summary += ` (${highCount} high priority)`;
    }

    summary += '.';

    return summary;
  }
}
