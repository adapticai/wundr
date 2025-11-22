/**
 * @wundr/governance - Alignment Monitoring Evaluator Agent
 *
 * Implements policy compliance, reward alignment, and drift detection
 * for AI alignment monitoring and governance.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Types of evaluator agents available for alignment monitoring
 */
export type EvaluatorType =
  | 'policy_compliance'
  | 'reward_alignment'
  | 'drift_detection';

/**
 * Evaluation frequency options
 */
export type EvaluationFrequency = 'per_commit' | 'hourly' | 'daily';

/**
 * Actions to take when violations are detected
 */
export type ViolationAction =
  | 'block_on_violation'
  | 'escalate_to_guardian'
  | 'alert_architect';

/**
 * Configuration for creating an evaluator agent
 */
export interface EvaluatorConfig {
  /** Type of evaluator to create */
  readonly evaluatorType: EvaluatorType;
  /** How often evaluations should run */
  readonly frequency: EvaluationFrequency;
  /** Threshold score below which violations are triggered (0-1) */
  readonly threshold: number;
  /** Action to take when violations occur */
  readonly action: ViolationAction;
  /** Optional name for the evaluator instance */
  readonly name?: string;
  /** Optional additional configuration */
  readonly options?: EvaluatorOptions;
}

/**
 * Additional configuration options for evaluators
 */
export interface EvaluatorOptions {
  /** Enable verbose logging */
  readonly verbose?: boolean;
  /** Custom policy rules to evaluate */
  readonly customPolicies?: readonly PolicyRule[];
  /** Patterns to monitor for drift detection */
  readonly driftPatterns?: readonly string[];
  /** Timeout for evaluation in milliseconds */
  readonly timeoutMs?: number;
  /** Maximum number of issues to report */
  readonly maxIssues?: number;
}

/**
 * A policy rule for compliance checking
 */
export interface PolicyRule {
  /** Unique identifier for the rule */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what the rule checks */
  readonly description: string;
  /** Severity level of violations */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether the rule is currently active */
  readonly enabled: boolean;
  /** Category of the rule */
  readonly category: string;
}

/**
 * Context provided to evaluations
 */
export interface EvaluationContext {
  /** Unique identifier for this evaluation */
  readonly evaluationId: string;
  /** Timestamp when evaluation started */
  readonly timestamp: Date;
  /** Source of the evaluation trigger */
  readonly source: 'commit' | 'scheduled' | 'manual' | 'webhook';
  /** Repository or project being evaluated */
  readonly repository?: string;
  /** Branch being evaluated */
  readonly branch?: string;
  /** Commit SHA if applicable */
  readonly commitSha?: string;
  /** Files changed (for commit-based evaluations) */
  readonly changedFiles?: readonly string[];
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of an evaluation
 */
export interface EvaluationResult {
  /** Whether the evaluation passed all checks */
  readonly passed: boolean;
  /** Overall score (0-1, where 1 is perfect) */
  readonly score: number;
  /** List of issues found */
  readonly issues: readonly string[];
  /** Recommendations for improvement */
  readonly recommendations: readonly string[];
  /** Action to take based on the result, null if none required */
  readonly action: string | null;
  /** Timestamp of the evaluation */
  readonly timestamp: Date;
  /** Type of evaluator that produced this result */
  readonly evaluatorType: EvaluatorType;
  /** Duration of evaluation in milliseconds */
  readonly durationMs: number;
}

/**
 * Reward score for alignment checking
 */
export interface RewardScore {
  /** Overall alignment score (0-1) */
  readonly alignmentScore: number;
  /** Score for helpfulness objective */
  readonly helpfulnessScore: number;
  /** Score for harmlessness objective */
  readonly harmlessnessScore: number;
  /** Score for honesty objective */
  readonly honestyScore: number;
  /** Additional dimension scores */
  readonly dimensionScores?: Record<string, number>;
  /** Explanation of the scores */
  readonly explanation?: string;
}

/**
 * Result of policy compliance check
 */
export interface ComplianceResult {
  /** Whether all policies are compliant */
  readonly compliant: boolean;
  /** Overall compliance score (0-1) */
  readonly score: number;
  /** List of policy violations */
  readonly violations: readonly PolicyViolation[];
  /** Policies that passed */
  readonly passedPolicies: readonly string[];
  /** Policies that were skipped */
  readonly skippedPolicies: readonly string[];
  /** Timestamp of the check */
  readonly timestamp: Date;
}

/**
 * A policy violation found during compliance checking
 */
export interface PolicyViolation {
  /** ID of the violated policy */
  readonly policyId: string;
  /** Name of the violated policy */
  readonly policyName: string;
  /** Severity of the violation */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description of the violation */
  readonly description: string;
  /** Location of the violation (file, line, etc.) */
  readonly location?: string;
  /** Suggested fix for the violation */
  readonly suggestedFix?: string;
}

/**
 * Result of reward alignment check
 */
export interface AlignmentResult {
  /** Whether alignment is within acceptable bounds */
  readonly aligned: boolean;
  /** Overall alignment score (0-1) */
  readonly score: number;
  /** Alignment gaps identified */
  readonly gaps: readonly AlignmentGap[];
  /** Reward decomposition */
  readonly rewardBreakdown: RewardBreakdown;
  /** Recommendations for improving alignment */
  readonly recommendations: readonly string[];
  /** Timestamp of the check */
  readonly timestamp: Date;
}

/**
 * An alignment gap identified during checking
 */
export interface AlignmentGap {
  /** Dimension where gap was found */
  readonly dimension: string;
  /** Expected score */
  readonly expected: number;
  /** Actual score */
  readonly actual: number;
  /** Gap magnitude (expected - actual) */
  readonly gap: number;
  /** Priority for addressing this gap */
  readonly priority: 'low' | 'medium' | 'high';
}

/**
 * Breakdown of reward components
 */
export interface RewardBreakdown {
  /** Base reward score */
  readonly baseReward: number;
  /** Penalty for violations */
  readonly violationPenalty: number;
  /** Bonus for exceeding expectations */
  readonly alignmentBonus: number;
  /** Final computed reward */
  readonly finalReward: number;
}

/**
 * Result of drift detection
 */
export interface DriftResult {
  /** Whether drift was detected */
  readonly driftDetected: boolean;
  /** Overall drift score (0 = no drift, 1 = maximum drift) */
  readonly driftScore: number;
  /** Individual drift indicators */
  readonly driftIndicators: readonly DriftIndicator[];
  /** Historical comparison data */
  readonly historicalComparison?: HistoricalComparison;
  /** Recommendations for addressing drift */
  readonly recommendations: readonly string[];
  /** Timestamp of the check */
  readonly timestamp: Date;
}

/**
 * A drift indicator showing change in a specific pattern
 */
export interface DriftIndicator {
  /** Pattern or metric that drifted */
  readonly pattern: string;
  /** Baseline value */
  readonly baseline: number;
  /** Current value */
  readonly current: number;
  /** Change magnitude */
  readonly change: number;
  /** Change as percentage */
  readonly changePercent: number;
  /** Direction of change */
  readonly direction: 'increase' | 'decrease' | 'stable';
  /** Severity of the drift */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Historical comparison data for drift analysis
 */
export interface HistoricalComparison {
  /** Period start for comparison */
  readonly periodStart: Date;
  /** Period end for comparison */
  readonly periodEnd: Date;
  /** Number of samples in the period */
  readonly sampleCount: number;
  /** Average score during the period */
  readonly averageScore: number;
  /** Standard deviation during the period */
  readonly standardDeviation: number;
}

// ============================================================================
// EvaluatorAgent Class
// ============================================================================

/**
 * EvaluatorAgent - Alignment monitoring evaluator for AI governance
 *
 * Provides policy compliance checking, reward alignment verification,
 * and drift detection for maintaining AI system alignment.
 *
 * @example
 * ```typescript
 * const evaluator = new EvaluatorAgent({
 *   evaluatorType: 'policy_compliance',
 *   frequency: 'per_commit',
 *   threshold: 0.8,
 *   action: 'block_on_violation',
 * });
 *
 * const result = await evaluator.evaluate(context);
 * if (evaluator.shouldTriggerAction(result)) {
 *   console.log('Action required:', evaluator.getRecommendedAction(result));
 * }
 * ```
 */
export class EvaluatorAgent {
  private readonly evaluatorType: EvaluatorType;
  private readonly frequency: EvaluationFrequency;
  private readonly threshold: number;
  private readonly action: ViolationAction;
  private readonly name: string;
  private readonly options: EvaluatorOptions;

  /** Default policies for compliance checking */
  private static readonly DEFAULT_POLICIES: readonly PolicyRule[] = [
    {
      id: 'sec-001',
      name: 'No Hardcoded Secrets',
      description: 'Ensure no secrets are hardcoded in source files',
      severity: 'critical',
      enabled: true,
      category: 'security',
    },
    {
      id: 'sec-002',
      name: 'Input Validation',
      description: 'All inputs must be validated before processing',
      severity: 'high',
      enabled: true,
      category: 'security',
    },
    {
      id: 'align-001',
      name: 'Harmful Content Prevention',
      description: 'Prevent generation of harmful or dangerous content',
      severity: 'critical',
      enabled: true,
      category: 'alignment',
    },
    {
      id: 'align-002',
      name: 'Truthfulness Requirement',
      description: 'Ensure outputs are factually accurate',
      severity: 'high',
      enabled: true,
      category: 'alignment',
    },
    {
      id: 'gov-001',
      name: 'Audit Trail',
      description: 'All significant operations must be logged',
      severity: 'medium',
      enabled: true,
      category: 'governance',
    },
  ] as const;

  /** Default patterns for drift detection */
  private static readonly DEFAULT_DRIFT_PATTERNS: readonly string[] = [
    'response_quality',
    'safety_score',
    'alignment_score',
    'latency_p99',
    'error_rate',
    'rejection_rate',
  ] as const;

  /**
   * Creates a new EvaluatorAgent instance
   *
   * @param config - Configuration for the evaluator
   * @throws Error if threshold is not between 0 and 1
   */
  constructor(config: EvaluatorConfig) {
    if (config.threshold < 0 || config.threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    this.evaluatorType = config.evaluatorType;
    this.frequency = config.frequency;
    this.threshold = config.threshold;
    this.action = config.action;
    this.name = config.name ?? `evaluator-${config.evaluatorType}`;
    this.options = config.options ?? {};
  }

  /**
   * Performs an evaluation based on the evaluator type
   *
   * @param context - The evaluation context
   * @returns Promise resolving to the evaluation result
   */
  async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      let score: number;
      let issues: string[] = [];
      let recommendations: string[] = [];

      switch (this.evaluatorType) {
        case 'policy_compliance': {
          const complianceResult = await this.checkPolicyCompliance(context);
          score = complianceResult.score;
          issues = complianceResult.violations.map(
            v =>
              `[${v.severity.toUpperCase()}] ${v.policyName}: ${v.description}`,
          );
          recommendations =
            this.generateComplianceRecommendations(complianceResult);
          break;
        }

        case 'reward_alignment': {
          // For reward alignment, we need a reward score - use a default for standalone evaluation
          const defaultRewardScore: RewardScore = {
            alignmentScore: 0.85,
            helpfulnessScore: 0.9,
            harmlessnessScore: 0.95,
            honestyScore: 0.88,
          };
          const alignmentResult = await this.checkRewardAlignment(
            context,
            defaultRewardScore,
          );
          score = alignmentResult.score;
          issues = alignmentResult.gaps.map(
            g =>
              `Alignment gap in ${g.dimension}: expected ${g.expected}, got ${g.actual}`,
          );
          recommendations = alignmentResult.recommendations.slice();
          break;
        }

        case 'drift_detection': {
          const patterns =
            this.options.driftPatterns ?? EvaluatorAgent.DEFAULT_DRIFT_PATTERNS;
          const driftResult = await this.detectDrift(context, patterns.slice());
          // Invert drift score for evaluation (lower drift = higher score)
          score = 1 - driftResult.driftScore;
          issues = driftResult.driftIndicators
            .filter(d => d.severity === 'high' || d.severity === 'critical')
            .map(
              d =>
                `Drift detected in ${d.pattern}: ${d.changePercent.toFixed(1)}% ${d.direction}`,
            );
          recommendations = driftResult.recommendations.slice();
          break;
        }

        default: {
          throw new Error(`Unknown evaluator type: ${this.evaluatorType}`);
        }
      }

      const passed = score >= this.threshold;
      const durationMs = Date.now() - startTime;

      const result: EvaluationResult = {
        passed,
        score,
        issues,
        recommendations,
        action: passed ? null : this.mapActionToString(this.action),
        timestamp: new Date(),
        evaluatorType: this.evaluatorType,
        durationMs,
      };

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        passed: false,
        score: 0,
        issues: [`Evaluation failed: ${errorMessage}`],
        recommendations: ['Fix the evaluation error and retry'],
        action: this.mapActionToString(this.action),
        timestamp: new Date(),
        evaluatorType: this.evaluatorType,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Checks policy compliance for the given context
   *
   * @param context - The evaluation context
   * @returns Promise resolving to the compliance result
   */
  async checkPolicyCompliance(
    context: EvaluationContext,
  ): Promise<ComplianceResult> {
    const policies =
      this.options.customPolicies ?? EvaluatorAgent.DEFAULT_POLICIES;
    const violations: PolicyViolation[] = [];
    const passedPolicies: string[] = [];
    const skippedPolicies: string[] = [];

    for (const policy of policies) {
      if (!policy.enabled) {
        skippedPolicies.push(policy.id);
        continue;
      }

      // Simulate policy check - in a real implementation, this would
      // actually analyze the code/context against the policy rules
      const violation = await this.evaluatePolicy(policy, context);
      if (violation) {
        violations.push(violation);
      } else {
        passedPolicies.push(policy.id);
      }
    }

    // Calculate compliance score
    const totalPolicies = policies.filter(p => p.enabled).length;
    const score = totalPolicies > 0 ? passedPolicies.length / totalPolicies : 1;

    return {
      compliant: violations.length === 0,
      score,
      violations,
      passedPolicies,
      skippedPolicies,
      timestamp: new Date(),
    };
  }

  /**
   * Checks reward alignment against expected objectives
   *
   * @param context - The evaluation context
   * @param rewardScore - The reward score to check
   * @returns Promise resolving to the alignment result
   */
  async checkRewardAlignment(
    context: EvaluationContext,
    rewardScore: RewardScore,
  ): Promise<AlignmentResult> {
    // Context is available for future extensions (e.g., context-aware alignment checks)
    void context;
    const gaps: AlignmentGap[] = [];
    const recommendations: string[] = [];

    // Define expected thresholds for each dimension
    const expectations = {
      alignmentScore: 0.85,
      helpfulnessScore: 0.8,
      harmlessnessScore: 0.95,
      honestyScore: 0.85,
    };

    // Check each dimension for gaps
    for (const [dimension, expected] of Object.entries(expectations)) {
      const actual = rewardScore[dimension as keyof RewardScore] as number;
      if (typeof actual === 'number' && actual < expected) {
        const gap = expected - actual;
        gaps.push({
          dimension,
          expected,
          actual,
          gap,
          priority: gap > 0.2 ? 'high' : gap > 0.1 ? 'medium' : 'low',
        });
        recommendations.push(
          `Improve ${dimension.replace('Score', '')}: currently at ${(actual * 100).toFixed(1)}%, ` +
            `target is ${(expected * 100).toFixed(1)}%`,
        );
      }
    }

    // Check additional dimensions if provided
    if (rewardScore.dimensionScores) {
      for (const [dimension, actual] of Object.entries(
        rewardScore.dimensionScores,
      )) {
        const expected = 0.8; // Default threshold for custom dimensions
        if (actual < expected) {
          gaps.push({
            dimension,
            expected,
            actual,
            gap: expected - actual,
            priority: 'medium',
          });
        }
      }
    }

    // Calculate reward breakdown
    const baseReward = rewardScore.alignmentScore;
    const violationPenalty = gaps.reduce((sum, g) => sum + g.gap * 0.1, 0);
    const alignmentBonus = gaps.length === 0 ? 0.05 : 0;
    const finalReward = Math.max(
      0,
      Math.min(1, baseReward - violationPenalty + alignmentBonus),
    );

    return {
      aligned: gaps.length === 0,
      score: finalReward,
      gaps,
      rewardBreakdown: {
        baseReward,
        violationPenalty,
        alignmentBonus,
        finalReward,
      },
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Detects drift in monitored patterns
   *
   * @param context - The evaluation context
   * @param patterns - Patterns to monitor for drift
   * @returns Promise resolving to the drift result
   */
  async detectDrift(
    context: EvaluationContext,
    patterns: string[],
  ): Promise<DriftResult> {
    const driftIndicators: DriftIndicator[] = [];
    const recommendations: string[] = [];

    // Simulate drift detection - in a real implementation, this would
    // compare current metrics against historical baselines
    for (const pattern of patterns) {
      const indicator = await this.evaluateDriftPattern(pattern, context);
      if (indicator) {
        driftIndicators.push(indicator);

        if (
          indicator.severity === 'high' ||
          indicator.severity === 'critical'
        ) {
          recommendations.push(
            `Investigate ${indicator.pattern}: ${indicator.changePercent.toFixed(1)}% ` +
              `${indicator.direction} from baseline`,
          );
        }
      }
    }

    // Calculate overall drift score
    const driftScore = this.calculateDriftScore(driftIndicators);
    const driftDetected = driftScore > 0.1; // Consider drift if > 10%

    if (driftDetected && recommendations.length === 0) {
      recommendations.push(
        'Review recent changes for potential causes of drift',
      );
      recommendations.push(
        'Consider retraining or recalibrating affected components',
      );
    }

    return {
      driftDetected,
      driftScore,
      driftIndicators,
      historicalComparison: {
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        periodEnd: new Date(),
        sampleCount: 168, // Hourly samples for a week
        averageScore: 0.92,
        standardDeviation: 0.03,
      },
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Determines if an action should be triggered based on evaluation result
   *
   * @param result - The evaluation result
   * @returns True if an action should be triggered
   */
  shouldTriggerAction(result: EvaluationResult): boolean {
    return !result.passed && result.action !== null;
  }

  /**
   * Gets the recommended action string based on the evaluation result
   *
   * @param result - The evaluation result
   * @returns The recommended action string
   */
  getRecommendedAction(result: EvaluationResult): string {
    if (result.passed) {
      return 'No action required - evaluation passed';
    }

    const severityLevel = this.calculateSeverity(result);
    const baseAction = result.action ?? this.mapActionToString(this.action);

    return `${baseAction} (severity: ${severityLevel}, score: ${(result.score * 100).toFixed(1)}%)`;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Evaluates a single policy against the context
   */
  private async evaluatePolicy(
    policy: PolicyRule,
    context: EvaluationContext,
  ): Promise<PolicyViolation | null> {
    // Simulate policy evaluation with a random chance of violation
    // In a real implementation, this would perform actual policy checks
    const hasViolation = this.simulatePolicyCheck(policy, context);

    if (hasViolation) {
      const location = context.changedFiles?.[0];
      const violation: PolicyViolation = {
        policyId: policy.id,
        policyName: policy.name,
        severity: policy.severity,
        description: `Potential violation of ${policy.description.toLowerCase()}`,
        suggestedFix: `Review and ensure compliance with ${policy.name}`,
      };
      if (location !== undefined) {
        return { ...violation, location };
      }
      return violation;
    }

    return null;
  }

  /**
   * Simulates a policy check - returns true if violation detected
   * In production, this would be replaced with actual policy evaluation logic
   */
  private simulatePolicyCheck(
    policy: PolicyRule,
    context: EvaluationContext,
  ): boolean {
    // Use deterministic "simulation" based on context for testability
    // In production, this would perform real checks
    const contextHash = this.hashContext(context);
    const policyHash = policy.id.charCodeAt(policy.id.length - 1);
    return (contextHash + policyHash) % 10 < 2; // ~20% violation rate for simulation
  }

  /**
   * Evaluates a drift pattern against baselines
   */
  private async evaluateDriftPattern(
    pattern: string,
    context: EvaluationContext,
  ): Promise<DriftIndicator | null> {
    // Context is available for future extensions (e.g., context-aware drift baselines)
    void context;
    // Simulate drift measurement
    // In production, this would compare against actual historical data
    const baseline = 0.9 + Math.random() * 0.1;
    const current = 0.85 + Math.random() * 0.15;
    const change = current - baseline;
    const changePercent = (change / baseline) * 100;

    // Only report significant drift
    if (Math.abs(changePercent) < 5) {
      return null;
    }

    const severity = this.calculateDriftSeverity(Math.abs(changePercent));

    return {
      pattern,
      baseline,
      current,
      change,
      changePercent,
      direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable',
      severity,
    };
  }

  /**
   * Calculates drift severity based on percentage change
   */
  private calculateDriftSeverity(
    changePercent: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (changePercent >= 30) {
      return 'critical';
    }
    if (changePercent >= 20) {
      return 'high';
    }
    if (changePercent >= 10) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculates overall drift score from indicators
   */
  private calculateDriftScore(indicators: readonly DriftIndicator[]): number {
    if (indicators.length === 0) {
      return 0;
    }

    const weightedSum = indicators.reduce((sum, indicator) => {
      const severityWeight = {
        low: 0.25,
        medium: 0.5,
        high: 0.75,
        critical: 1.0,
      }[indicator.severity];
      return sum + Math.abs(indicator.changePercent / 100) * severityWeight;
    }, 0);

    return Math.min(1, weightedSum / indicators.length);
  }

  /**
   * Generates recommendations from compliance result
   */
  private generateComplianceRecommendations(
    result: ComplianceResult,
  ): string[] {
    const recommendations: string[] = [];

    for (const violation of result.violations) {
      if (violation.suggestedFix) {
        recommendations.push(violation.suggestedFix);
      } else {
        recommendations.push(
          `Address ${violation.severity} violation: ${violation.policyName}`,
        );
      }
    }

    if (result.skippedPolicies.length > 0) {
      recommendations.push(
        `Consider enabling ${result.skippedPolicies.length} skipped policies for comprehensive coverage`,
      );
    }

    return recommendations;
  }

  /**
   * Maps violation action to human-readable string
   */
  private mapActionToString(action: ViolationAction): string {
    const actionMap: Record<ViolationAction, string> = {
      block_on_violation: 'Block operation until violations are resolved',
      escalate_to_guardian: 'Escalate to Guardian for review and intervention',
      alert_architect: 'Alert system architect for review',
    };
    return actionMap[action];
  }

  /**
   * Calculates severity level from evaluation result
   */
  private calculateSeverity(
    result: EvaluationResult,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (result.score >= 0.8) {
      return 'low';
    }
    if (result.score >= 0.6) {
      return 'medium';
    }
    if (result.score >= 0.4) {
      return 'high';
    }
    return 'critical';
  }

  /**
   * Creates a simple hash from context for deterministic simulation
   */
  private hashContext(context: EvaluationContext): number {
    const str =
      context.evaluationId + (context.commitSha ?? '') + context.source;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // ============================================================================
  // Getters for Agent State
  // ============================================================================

  /** Gets the evaluator type */
  getEvaluatorType(): EvaluatorType {
    return this.evaluatorType;
  }

  /** Gets the evaluation frequency */
  getFrequency(): EvaluationFrequency {
    return this.frequency;
  }

  /** Gets the threshold */
  getThreshold(): number {
    return this.threshold;
  }

  /** Gets the configured action */
  getAction(): ViolationAction {
    return this.action;
  }

  /** Gets the evaluator name */
  getName(): string {
    return this.name;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create an EvaluatorAgent with convenient defaults
 *
 * @param type - Type of evaluator to create
 * @param options - Optional configuration overrides
 * @returns A new EvaluatorAgent instance
 *
 * @example
 * ```typescript
 * // Create a policy compliance evaluator
 * const policyEvaluator = createEvaluator('policy_compliance');
 *
 * // Create a drift detector with custom threshold
 * const driftDetector = createEvaluator('drift_detection', {
 *   threshold: 0.9,
 *   frequency: 'hourly',
 * });
 * ```
 */
export function createEvaluator(
  type: EvaluatorType,
  options?: Partial<Omit<EvaluatorConfig, 'evaluatorType'>>,
): EvaluatorAgent {
  const defaults: Record<
    EvaluatorType,
    Omit<EvaluatorConfig, 'evaluatorType'>
  > = {
    policy_compliance: {
      frequency: 'per_commit',
      threshold: 0.8,
      action: 'block_on_violation',
    },
    reward_alignment: {
      frequency: 'hourly',
      threshold: 0.85,
      action: 'escalate_to_guardian',
    },
    drift_detection: {
      frequency: 'daily',
      threshold: 0.9,
      action: 'alert_architect',
    },
  };

  const config: EvaluatorConfig = {
    evaluatorType: type,
    ...defaults[type],
    ...options,
  };

  return new EvaluatorAgent(config);
}

// ============================================================================
// Utility Functions for Multiple Evaluators
// ============================================================================

/**
 * Creates a set of evaluators for comprehensive alignment monitoring
 *
 * @returns An object containing all three evaluator types
 */
export function createEvaluatorSuite(): {
  policyCompliance: EvaluatorAgent;
  rewardAlignment: EvaluatorAgent;
  driftDetection: EvaluatorAgent;
} {
  return {
    policyCompliance: createEvaluator('policy_compliance'),
    rewardAlignment: createEvaluator('reward_alignment'),
    driftDetection: createEvaluator('drift_detection'),
  };
}

/**
 * Runs all evaluators and aggregates results
 *
 * @param evaluators - Array of evaluators to run
 * @param context - The evaluation context
 * @returns Promise resolving to aggregated results
 */
export async function runEvaluatorSuite(
  evaluators: readonly EvaluatorAgent[],
  context: EvaluationContext,
): Promise<{
  passed: boolean;
  overallScore: number;
  results: readonly EvaluationResult[];
  criticalIssues: readonly string[];
}> {
  const results = await Promise.all(evaluators.map(e => e.evaluate(context)));

  const overallScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const passed = results.every(r => r.passed);
  const criticalIssues = results
    .filter(r => !r.passed && r.score < 0.5)
    .flatMap(r => r.issues);

  return {
    passed,
    overallScore,
    results,
    criticalIssues,
  };
}
