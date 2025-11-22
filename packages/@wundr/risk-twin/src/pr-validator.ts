/* eslint-disable no-console */
/**
 * @wundr/risk-twin - PR Validator for Governance Change Validation
 *
 * Provides CI/CD integration for validating governance changes in pull requests
 * using the Risk Twin simulation environment.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for the PR Validator
 */
export interface PRValidatorConfig {
  /** Path to the Risk Twin configuration */
  readonly configPath?: string;
  /** Patterns that identify governance files */
  readonly governancePatterns?: readonly GovernancePattern[];
  /** Whether to enable verbose logging */
  readonly verbose?: boolean;
  /** Timeout for validation in milliseconds */
  readonly validationTimeoutMs?: number;
  /** Custom validation rules */
  readonly customRules?: readonly ValidationRule[];
}

/**
 * Pattern definition for identifying governance files
 */
export interface GovernancePattern {
  /** Name of the pattern category */
  readonly name: string;
  /** File glob patterns to match */
  readonly patterns: readonly string[];
  /** Severity when changed */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether changes require Guardian review */
  readonly requiresGuardianReview: boolean;
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Unique identifier for the rule */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what the rule validates */
  readonly description: string;
  /** Whether this rule blocks merge on failure */
  readonly blocking: boolean;
  /** File patterns this rule applies to */
  readonly appliesTo: readonly string[];
}

/**
 * Information about a Pull Request
 */
export interface PRInfo {
  /** Pull request number */
  readonly prNumber: number;
  /** Base branch (target) */
  readonly baseBranch: string;
  /** Head branch (source) */
  readonly headBranch: string;
  /** Files changed in the PR */
  readonly files: readonly FileChange[];
  /** PR author username */
  readonly author: string;
  /** PR title */
  readonly title: string;
  /** PR description/body */
  readonly description: string;
  /** Repository name */
  readonly repository?: string;
  /** Labels on the PR */
  readonly labels?: readonly string[];
  /** Timestamp when PR was created */
  readonly createdAt?: Date;
  /** Timestamp when PR was last updated */
  readonly updatedAt?: Date;
}

/**
 * Information about a file change in a PR
 */
export interface FileChange {
  /** File path relative to repository root */
  readonly path: string;
  /** Type of change */
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Number of additions */
  readonly additions: number;
  /** Number of deletions */
  readonly deletions: number;
  /** Previous path for renamed files */
  readonly previousPath?: string;
  /** File content (if available) */
  readonly content?: string;
  /** Previous content (for comparison) */
  readonly previousContent?: string;
}

/**
 * A governance change detected in a PR
 */
export interface GovernanceChange {
  /** Type of governance change */
  readonly type: GovernanceChangeType;
  /** The file change that triggered this */
  readonly fileChange: FileChange;
  /** Severity of the change */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether this change requires Guardian review */
  readonly requiresGuardianReview: boolean;
  /** Human-readable description of the change */
  readonly description: string;
  /** Category for grouping */
  readonly category: string;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Types of governance changes
 */
export type GovernanceChangeType =
  | 'agent_charter'
  | 'ipre_policy'
  | 'reward_function'
  | 'evaluator_config'
  | 'governance_rule'
  | 'alignment_config'
  | 'security_policy'
  | 'operational_policy'
  | 'unknown';

/**
 * Result of validating a PR
 */
export interface PRValidationResult {
  /** Overall validation status */
  readonly status: 'approved' | 'needs_review' | 'blocked';
  /** List of validation reports */
  readonly validations: readonly ValidationReport[];
  /** Issues that block merge */
  readonly blockers: readonly string[];
  /** Warnings that don't block but should be reviewed */
  readonly warnings: readonly string[];
  /** Governance changes detected */
  readonly governanceChanges: readonly GovernanceChange[];
  /** Summary statistics */
  readonly summary: ValidationSummary;
  /** Timestamp of validation */
  readonly timestamp: Date;
  /** PR number validated */
  readonly prNumber: number;
}

/**
 * Report from a single validation check
 */
export interface ValidationReport {
  /** Unique identifier for the validation */
  readonly id: string;
  /** Name of the validation */
  readonly name: string;
  /** Whether the validation passed */
  readonly passed: boolean;
  /** Score from 0-1 */
  readonly score: number;
  /** Issues found */
  readonly issues: readonly string[];
  /** Recommendations */
  readonly recommendations: readonly string[];
  /** Duration of validation in milliseconds */
  readonly durationMs: number;
  /** Timestamp when validation ran */
  readonly timestamp: Date;
  /** Category of validation */
  readonly category: string;
  /** Whether this validation can block merge */
  readonly blocking: boolean;
}

/**
 * Summary statistics for a validation result
 */
export interface ValidationSummary {
  /** Total number of governance changes */
  readonly totalChanges: number;
  /** Number of changes by severity */
  readonly bySeverity: Record<string, number>;
  /** Number of changes by type */
  readonly byType: Record<string, number>;
  /** Whether any changes require Guardian review */
  readonly requiresGuardianReview: boolean;
  /** Overall risk score (0-1, where 1 is highest risk) */
  readonly riskScore: number;
}

// ============================================================================
// RiskTwinOrchestrator Interface (dependency)
// ============================================================================

/**
 * Interface for the Risk Twin Orchestrator
 * This is injected as a dependency for simulation-based validation
 */
export interface RiskTwinOrchestrator {
  /** Validate a governance change in the Risk Twin environment */
  validateChange(
    change: GovernanceChangeForValidation
  ): Promise<RiskTwinValidationResult>;
  /** Check if the orchestrator is ready */
  isReady(): Promise<boolean>;
  /** Get current configuration */
  getConfig(): RiskTwinConfig;
}

/**
 * Governance change format for Risk Twin validation
 */
export interface GovernanceChangeForValidation {
  /** Type of change */
  readonly type: GovernanceChangeType;
  /** Path to the changed file */
  readonly path: string;
  /** Change content */
  readonly content?: string;
  /** Previous content for comparison */
  readonly previousContent?: string;
  /** Additional context */
  readonly context?: Record<string, unknown>;
}

/**
 * Result from Risk Twin validation
 */
export interface RiskTwinValidationResult {
  /** Validation result color */
  readonly result: 'green' | 'yellow' | 'red';
  /** Detailed report */
  readonly report: {
    readonly divergenceScore: number;
    readonly noveltyScore: number;
    readonly confidenceLevel: number;
    readonly simulatedDays: number;
    readonly issues: readonly string[];
  };
  /** Recommendations */
  readonly recommendations: readonly string[];
}

/**
 * Risk Twin configuration
 */
export interface RiskTwinConfig {
  readonly accelerationFactor: number;
  readonly simulatedDays: number;
  readonly productionDelay: number;
  readonly divergenceThresholds: {
    readonly confidence: number;
    readonly earlyDeviation: number;
  };
}

// ============================================================================
// Default Governance Patterns
// ============================================================================

/**
 * Default patterns for identifying governance files
 */
const DEFAULT_GOVERNANCE_PATTERNS: readonly GovernancePattern[] = [
  {
    name: 'Agent Charters',
    patterns: [
      '.claude/agents/**/*.md',
      '.claude/agents/**/*.yaml',
      '.claude/agents/**/*.yml',
    ],
    severity: 'high',
    requiresGuardianReview: true,
  },
  {
    name: 'IPRE Policies',
    patterns: [
      '.claude/governance/**/*.yaml',
      '.claude/governance/**/*.yml',
      '.claude/governance/**/*.json',
    ],
    severity: 'critical',
    requiresGuardianReview: true,
  },
  {
    name: 'Reward Functions',
    patterns: [
      '**/reward*.ts',
      '**/reward*.js',
      '.claude/governance/**/reward*.yaml',
      '.claude/governance/**/reward*.yml',
    ],
    severity: 'critical',
    requiresGuardianReview: true,
  },
  {
    name: 'Evaluator Configurations',
    patterns: [
      '**/evaluator*.ts',
      '**/evaluator*.js',
      '.claude/governance/**/evaluator*.yaml',
      '.claude/governance/**/evaluator*.yml',
    ],
    severity: 'high',
    requiresGuardianReview: true,
  },
  {
    name: 'Security Policies',
    patterns: [
      '.claude/security/**/*',
      '.claude/governance/**/security*.yaml',
      '.claude/governance/**/security*.yml',
    ],
    severity: 'critical',
    requiresGuardianReview: true,
  },
  {
    name: 'Alignment Configuration',
    patterns: [
      '.claude/governance/**/alignment*.yaml',
      '.claude/governance/**/alignment*.yml',
    ],
    severity: 'high',
    requiresGuardianReview: true,
  },
  {
    name: 'Hooks Configuration',
    patterns: ['.claude/hooks/**/*'],
    severity: 'medium',
    requiresGuardianReview: false,
  },
] as const;

// ============================================================================
// PRValidator Class
// ============================================================================

/**
 * PRValidator - CI/CD integration for governance PR validation
 *
 * Validates pull requests that contain governance changes by:
 * 1. Detecting governance-related file changes
 * 2. Running validation checks on the changes
 * 3. Optionally using Risk Twin simulation for deeper validation
 * 4. Generating appropriate PR comments and merge decisions
 *
 * @example
 * ```typescript
 * const validator = new PRValidator({
 *   verbose: true,
 *   validationTimeoutMs: 300000, // 5 minutes
 * });
 *
 * const result = await validator.validatePR(prInfo);
 * if (validator.shouldBlockMerge(result)) {
 *   console.log('PR blocked:', result.blockers);
 * }
 *
 * const comment = validator.generatePRComment(result);
 * // Post comment to PR...
 * ```
 */
export class PRValidator {
  private readonly config: PRValidatorConfig;
  private readonly governancePatterns: readonly GovernancePattern[];
  private orchestrator: RiskTwinOrchestrator | null = null;

  /**
   * Creates a new PRValidator instance
   *
   * @param config - Configuration for the validator
   */
  constructor(config: PRValidatorConfig = {}) {
    this.config = config;
    this.governancePatterns =
      config.governancePatterns ?? DEFAULT_GOVERNANCE_PATTERNS;
  }

  /**
   * Sets the Risk Twin Orchestrator for simulation-based validation
   *
   * @param orchestrator - The Risk Twin Orchestrator instance
   */
  setOrchestrator(orchestrator: RiskTwinOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Validates a Pull Request for governance changes
   *
   * @param prInfo - Information about the PR to validate
   * @returns Promise resolving to the validation result
   */
  async validatePR(prInfo: PRInfo): Promise<PRValidationResult> {
    const startTime = Date.now();

    // Extract governance changes from the PR
    const governanceChanges = await this.extractGovernanceChanges(prInfo);

    // If no governance changes, return approved
    if (governanceChanges.length === 0) {
      return this.createApprovedResult(prInfo, governanceChanges);
    }

    // Run validation on the changes
    const validations = await this.runValidation(governanceChanges);

    // Analyze results and determine status
    const blockers = this.extractBlockers(validations, governanceChanges);
    const warnings = this.extractWarnings(validations, governanceChanges);
    const summary = this.calculateSummary(governanceChanges);

    // Determine overall status
    let status: 'approved' | 'needs_review' | 'blocked';
    if (blockers.length > 0) {
      status = 'blocked';
    } else if (summary.requiresGuardianReview || warnings.length > 0) {
      status = 'needs_review';
    } else {
      status = 'approved';
    }

    if (this.config.verbose) {
      const duration = Date.now() - startTime;
      console.log(
        `PR #${prInfo.prNumber} validation completed in ${duration}ms: ${status}`
      );
    }

    return {
      status,
      validations,
      blockers,
      warnings,
      governanceChanges,
      summary,
      timestamp: new Date(),
      prNumber: prInfo.prNumber,
    };
  }

  /**
   * Extracts governance changes from a PR
   *
   * @param prInfo - Information about the PR
   * @returns Promise resolving to array of governance changes
   */
  async extractGovernanceChanges(prInfo: PRInfo): Promise<GovernanceChange[]> {
    const changes: GovernanceChange[] = [];

    for (const file of prInfo.files) {
      if (this.isGovernanceChange(file)) {
        const change = this.categorizeGovernanceChange(file);
        changes.push(change);
      }
    }

    return changes;
  }

  /**
   * Checks if a file change is a governance-related change
   *
   * @param file - The file change to check
   * @returns True if this is a governance change
   */
  isGovernanceChange(file: FileChange): boolean {
    const filePath = file.path.toLowerCase();

    for (const pattern of this.governancePatterns) {
      for (const glob of pattern.patterns) {
        if (this.matchesPattern(filePath, glob)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Runs validation checks on governance changes
   *
   * @param changes - The governance changes to validate
   * @returns Promise resolving to array of validation reports
   */
  async runValidation(
    changes: GovernanceChange[]
  ): Promise<ValidationReport[]> {
    const reports: ValidationReport[] = [];

    // Run built-in validations
    reports.push(await this.validateSchemaCompliance(changes));
    reports.push(await this.validateNamingConventions(changes));
    reports.push(await this.validateSecurityConstraints(changes));
    reports.push(await this.validatePolicyConsistency(changes));

    // Run Risk Twin validation if available
    if (this.orchestrator) {
      const isReady = await this.orchestrator.isReady();
      if (isReady) {
        reports.push(await this.validateWithRiskTwin(changes));
      }
    }

    // Run custom validations if configured
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        reports.push(await this.runCustomValidation(rule, changes));
      }
    }

    return reports;
  }

  /**
   * Generates a PR comment summarizing the validation result
   *
   * @param result - The validation result
   * @returns The formatted PR comment
   */
  generatePRComment(result: PRValidationResult): string {
    const lines: string[] = [];

    // Header
    lines.push('## Governance Validation Report');
    lines.push('');

    // Status badge
    const statusEmoji = {
      approved: '***',
      needs_review: '**!**',
      blocked: '**X**',
    }[result.status];
    const statusText = {
      approved: 'Approved',
      needs_review: 'Needs Review',
      blocked: 'Blocked',
    }[result.status];
    lines.push(`**Status**: ${statusEmoji} ${statusText}`);
    lines.push('');

    // Summary
    lines.push('### Summary');
    lines.push(`- **Governance Changes**: ${result.summary.totalChanges}`);
    lines.push(
      `- **Risk Score**: ${(result.summary.riskScore * 100).toFixed(1)}%`
    );
    lines.push(
      `- **Guardian Review Required**: ${result.summary.requiresGuardianReview ? 'Yes' : 'No'}`
    );
    lines.push('');

    // Changes by type
    if (Object.keys(result.summary.byType).length > 0) {
      lines.push('### Changes by Type');
      for (const [type, count] of Object.entries(result.summary.byType)) {
        lines.push(`- ${this.formatChangeType(type)}: ${count}`);
      }
      lines.push('');
    }

    // Blockers
    if (result.blockers.length > 0) {
      lines.push('### Blockers');
      lines.push('');
      lines.push('The following issues must be resolved before merge:');
      lines.push('');
      for (const blocker of result.blockers) {
        lines.push(`- ${blocker}`);
      }
      lines.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      lines.push('The following items should be reviewed:');
      lines.push('');
      for (const warning of result.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }

    // Validation details
    lines.push('### Validation Details');
    lines.push('');
    lines.push('| Validation | Status | Score | Duration |');
    lines.push('|------------|--------|-------|----------|');
    for (const validation of result.validations) {
      const status = validation.passed ? 'Passed' : 'Failed';
      const score = `${(validation.score * 100).toFixed(0)}%`;
      const duration = `${validation.durationMs}ms`;
      lines.push(`| ${validation.name} | ${status} | ${score} | ${duration} |`);
    }
    lines.push('');

    // Governance changes details
    if (result.governanceChanges.length > 0) {
      lines.push('### Governance Changes');
      lines.push('');
      lines.push('| File | Type | Severity | Guardian Review |');
      lines.push('|------|------|----------|-----------------|');
      for (const change of result.governanceChanges) {
        const guardianReview = change.requiresGuardianReview
          ? 'Required'
          : 'Not Required';
        lines.push(
          `| \`${change.fileChange.path}\` | ${this.formatChangeType(change.type)} | ${change.severity} | ${guardianReview} |`
        );
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push(
      `*Validated at ${result.timestamp.toISOString()} by @wundr/risk-twin*`
    );

    return lines.join('\n');
  }

  /**
   * Determines if the validation result should block merge
   *
   * @param result - The validation result
   * @returns True if merge should be blocked
   */
  shouldBlockMerge(result: PRValidationResult): boolean {
    return result.status === 'blocked';
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Matches a file path against a glob pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*/g, '<<GLOBSTAR>>') // Placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/<<GLOBSTAR>>/g, '.*'); // ** matches anything including /

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath);
  }

  /**
   * Categorizes a file change into a governance change type
   */
  private categorizeGovernanceChange(file: FileChange): GovernanceChange {
    const filePath = file.path.toLowerCase();
    let type: GovernanceChangeType = 'unknown';
    let category = 'unknown';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let requiresGuardianReview = false;

    // Check against patterns to determine type and properties
    for (const pattern of this.governancePatterns) {
      for (const glob of pattern.patterns) {
        if (this.matchesPattern(filePath, glob)) {
          type = this.determineChangeType(pattern.name, filePath);
          category = pattern.name;
          severity = pattern.severity;
          requiresGuardianReview = pattern.requiresGuardianReview;
          break;
        }
      }
      if (type !== 'unknown') {
        break;
      }
    }

    return {
      type,
      fileChange: file,
      severity,
      requiresGuardianReview,
      description: this.generateChangeDescription(type, file),
      category,
    };
  }

  /**
   * Determines the governance change type from pattern name and file path
   */
  private determineChangeType(
    patternName: string,
    filePath: string
  ): GovernanceChangeType {
    const patternLower = patternName.toLowerCase();
    const pathLower = filePath.toLowerCase();

    if (patternLower.includes('agent') || pathLower.includes('agents')) {
      return 'agent_charter';
    }
    if (patternLower.includes('ipre') || pathLower.includes('governance')) {
      if (pathLower.includes('security')) {
        return 'security_policy';
      }
      if (pathLower.includes('alignment')) {
        return 'alignment_config';
      }
      return 'ipre_policy';
    }
    if (patternLower.includes('reward') || pathLower.includes('reward')) {
      return 'reward_function';
    }
    if (patternLower.includes('evaluator') || pathLower.includes('evaluator')) {
      return 'evaluator_config';
    }
    if (patternLower.includes('security')) {
      return 'security_policy';
    }

    return 'governance_rule';
  }

  /**
   * Generates a human-readable description for a governance change
   */
  private generateChangeDescription(
    type: GovernanceChangeType,
    file: FileChange
  ): string {
    const action = {
      added: 'Added new',
      modified: 'Modified',
      deleted: 'Deleted',
      renamed: 'Renamed',
    }[file.status];

    const typeDescription = {
      agent_charter: 'agent charter',
      ipre_policy: 'IPRE policy',
      reward_function: 'reward function',
      evaluator_config: 'evaluator configuration',
      governance_rule: 'governance rule',
      alignment_config: 'alignment configuration',
      security_policy: 'security policy',
      operational_policy: 'operational policy',
      unknown: 'governance file',
    }[type];

    return `${action} ${typeDescription}: ${file.path}`;
  }

  /**
   * Creates an approved result for PRs with no governance changes
   */
  private createApprovedResult(
    prInfo: PRInfo,
    changes: GovernanceChange[]
  ): PRValidationResult {
    return {
      status: 'approved',
      validations: [],
      blockers: [],
      warnings: [],
      governanceChanges: changes,
      summary: {
        totalChanges: 0,
        bySeverity: {},
        byType: {},
        requiresGuardianReview: false,
        riskScore: 0,
      },
      timestamp: new Date(),
      prNumber: prInfo.prNumber,
    };
  }

  /**
   * Extracts blocking issues from validations and changes
   */
  private extractBlockers(
    validations: readonly ValidationReport[],
    changes: readonly GovernanceChange[]
  ): string[] {
    const blockers: string[] = [];

    // Check for failed blocking validations
    for (const validation of validations) {
      if (!validation.passed && validation.blocking) {
        for (const issue of validation.issues) {
          blockers.push(`[${validation.name}] ${issue}`);
        }
      }
    }

    // Check for critical changes without proper review
    const criticalChanges = changes.filter(c => c.severity === 'critical');
    if (criticalChanges.length > 0) {
      // This would typically check against PR labels/approvals
      // For now, we add it as a blocker requiring manual approval
      blockers.push(
        `${criticalChanges.length} critical governance change(s) require Guardian approval`
      );
    }

    return blockers;
  }

  /**
   * Extracts warnings from validations and changes
   */
  private extractWarnings(
    validations: readonly ValidationReport[],
    changes: readonly GovernanceChange[]
  ): string[] {
    const warnings: string[] = [];

    // Check for failed non-blocking validations
    for (const validation of validations) {
      if (!validation.passed && !validation.blocking) {
        for (const issue of validation.issues) {
          warnings.push(`[${validation.name}] ${issue}`);
        }
      }
    }

    // Add recommendations as warnings
    for (const validation of validations) {
      for (const rec of validation.recommendations) {
        warnings.push(`[Recommendation] ${rec}`);
      }
    }

    // Check for high-severity changes
    const highSeverityChanges = changes.filter(c => c.severity === 'high');
    if (highSeverityChanges.length > 0) {
      warnings.push(
        `${highSeverityChanges.length} high-severity change(s) should be carefully reviewed`
      );
    }

    return warnings;
  }

  /**
   * Calculates summary statistics for governance changes
   */
  private calculateSummary(
    changes: readonly GovernanceChange[]
  ): ValidationSummary {
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let requiresGuardianReview = false;

    for (const change of changes) {
      bySeverity[change.severity] = (bySeverity[change.severity] ?? 0) + 1;
      byType[change.type] = (byType[change.type] ?? 0) + 1;
      if (change.requiresGuardianReview) {
        requiresGuardianReview = true;
      }
    }

    // Calculate risk score based on severity distribution
    const severityWeights = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
    let totalWeight = 0;
    for (const [severity, count] of Object.entries(bySeverity)) {
      totalWeight +=
        (severityWeights[severity as keyof typeof severityWeights] ?? 0.5) *
        count;
    }
    const riskScore =
      changes.length > 0 ? Math.min(1, totalWeight / changes.length) : 0;

    return {
      totalChanges: changes.length,
      bySeverity,
      byType,
      requiresGuardianReview,
      riskScore,
    };
  }

  /**
   * Formats a change type for display
   */
  private formatChangeType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validates schema compliance for governance changes
   */
  private async validateSchemaCompliance(
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let passedCount = 0;

    for (const change of changes) {
      // Check for YAML/JSON files that should have valid schema
      const isConfigFile =
        change.fileChange.path.endsWith('.yaml') ||
        change.fileChange.path.endsWith('.yml') ||
        change.fileChange.path.endsWith('.json');

      if (isConfigFile && change.fileChange.content) {
        // In a real implementation, this would validate against JSON Schema
        // For now, we do basic validation
        try {
          if (change.fileChange.path.endsWith('.json')) {
            JSON.parse(change.fileChange.content);
          }
          passedCount++;
        } catch {
          issues.push(`Invalid JSON in ${change.fileChange.path}`);
        }
      } else {
        passedCount++;
      }
    }

    if (issues.length > 0) {
      recommendations.push(
        'Ensure all configuration files follow the expected schema'
      );
    }

    const score = changes.length > 0 ? passedCount / changes.length : 1;

    return {
      id: 'schema-compliance',
      name: 'Schema Compliance',
      passed: issues.length === 0,
      score,
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'validation',
      blocking: true,
    };
  }

  /**
   * Validates naming conventions for governance files
   */
  private async validateNamingConventions(
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    for (const change of changes) {
      const fileName = change.fileChange.path.split('/').pop() ?? '';

      // Check for proper naming conventions
      if (change.type === 'agent_charter') {
        // Agent charters should be kebab-case
        if (!/^[a-z0-9-]+\.(md|yaml|yml)$/i.test(fileName)) {
          issues.push(
            `Agent charter "${fileName}" should use kebab-case naming (e.g., "my-agent.md")`
          );
        }
      }

      // Check for descriptive names
      if (fileName.length < 5) {
        recommendations.push(
          `Consider using a more descriptive name for "${fileName}"`
        );
      }
    }

    const score = changes.length > 0 ? 1 - issues.length / changes.length : 1;

    return {
      id: 'naming-conventions',
      name: 'Naming Conventions',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'style',
      blocking: false,
    };
  }

  /**
   * Validates security constraints for governance changes
   */
  private async validateSecurityConstraints(
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    for (const change of changes) {
      const content = change.fileChange.content ?? '';

      // Check for potential secrets in content
      if (this.containsPotentialSecret(content)) {
        issues.push(
          `Potential secret detected in ${change.fileChange.path}. Never commit secrets to governance files.`
        );
      }

      // Check for dangerous patterns
      if (this.containsDangerousPattern(content)) {
        issues.push(
          `Potentially dangerous pattern detected in ${change.fileChange.path}. Review carefully.`
        );
      }

      // Recommend review for security policy changes
      if (change.type === 'security_policy') {
        recommendations.push(
          `Security policy change in ${change.fileChange.path} should be reviewed by security team`
        );
      }
    }

    const score = changes.length > 0 ? 1 - issues.length / changes.length : 1;

    return {
      id: 'security-constraints',
      name: 'Security Constraints',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'security',
      blocking: true,
    };
  }

  /**
   * Validates policy consistency across governance changes
   */
  private async validatePolicyConsistency(
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for conflicting changes
    const policyChanges = changes.filter(
      c => c.type === 'ipre_policy' || c.type === 'security_policy'
    );

    // In a real implementation, this would check for conflicting policies
    // For now, we recommend review when multiple policies change
    if (policyChanges.length > 1) {
      recommendations.push(
        `${policyChanges.length} policy files changed - verify policies don't conflict`
      );
    }

    // Check for deleted policies that might be referenced elsewhere
    const deletedPolicies = changes.filter(
      c =>
        c.fileChange.status === 'deleted' &&
        (c.type === 'ipre_policy' || c.type === 'security_policy')
    );

    if (deletedPolicies.length > 0) {
      issues.push(
        `${deletedPolicies.length} policy file(s) deleted - ensure no other files reference them`
      );
    }

    const score = changes.length > 0 ? 1 - issues.length / changes.length : 1;

    return {
      id: 'policy-consistency',
      name: 'Policy Consistency',
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'consistency',
      blocking: true,
    };
  }

  /**
   * Validates changes using the Risk Twin orchestrator
   */
  private async validateWithRiskTwin(
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!this.orchestrator) {
      return {
        id: 'risk-twin-validation',
        name: 'Risk Twin Validation',
        passed: true,
        score: 1,
        issues: [],
        recommendations: [
          'Risk Twin orchestrator not available - skipped simulation',
        ],
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
        category: 'simulation',
        blocking: false,
      };
    }

    let passedCount = 0;
    const totalChanges = changes.length;

    for (const change of changes) {
      try {
        const result = await this.orchestrator.validateChange({
          type: change.type,
          path: change.fileChange.path,
          content: change.fileChange.content,
          previousContent: change.fileChange.previousContent,
        });

        if (result.result === 'green') {
          passedCount++;
        } else if (result.result === 'yellow') {
          recommendations.push(...result.recommendations);
        } else {
          issues.push(
            `Risk Twin rejected change to ${change.fileChange.path}: ${result.report.issues.join(', ')}`
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        issues.push(
          `Risk Twin validation failed for ${change.fileChange.path}: ${errorMessage}`
        );
      }
    }

    const score = totalChanges > 0 ? passedCount / totalChanges : 1;

    return {
      id: 'risk-twin-validation',
      name: 'Risk Twin Validation',
      passed: issues.length === 0,
      score,
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'simulation',
      blocking: issues.length > 0,
    };
  }

  /**
   * Runs a custom validation rule
   */
  private async runCustomValidation(
    rule: ValidationRule,
    changes: readonly GovernanceChange[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Filter changes that this rule applies to
    const applicableChanges = changes.filter(change =>
      rule.appliesTo.some(pattern =>
        this.matchesPattern(change.fileChange.path, pattern)
      )
    );

    // In a real implementation, this would run the custom rule logic
    // For now, we just note that the rule was applied
    if (applicableChanges.length > 0) {
      recommendations.push(
        `Custom rule "${rule.name}" applied to ${applicableChanges.length} file(s)`
      );
    }

    return {
      id: `custom-${rule.id}`,
      name: rule.name,
      passed: issues.length === 0,
      score: 1,
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'custom',
      blocking: rule.blocking,
    };
  }

  // ============================================================================
  // Security Helper Methods
  // ============================================================================

  /**
   * Checks if content contains potential secrets
   */
  private containsPotentialSecret(content: string): boolean {
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]{20,}/i,
      /secret[_-]?key\s*[:=]\s*['"][^'"]{20,}/i,
      /password\s*[:=]\s*['"][^'"]{8,}/i,
      /token\s*[:=]\s*['"][^'"]{20,}/i,
      /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
      /aws[_-]?secret[_-]?access[_-]?key/i,
    ];

    return secretPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Checks if content contains dangerous patterns
   */
  private containsDangerousPattern(content: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /shell_exec/i,
      /<script[^>]*>.*<\/script>/i,
      /rm\s+-rf\s+\//i,
    ];

    return dangerousPatterns.some(pattern => pattern.test(content));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a PRValidator with default configuration
 *
 * @param options - Optional configuration overrides
 * @returns A new PRValidator instance
 *
 * @example
 * ```typescript
 * const validator = createPRValidator({ verbose: true });
 * const result = await validator.validatePR(prInfo);
 * ```
 */
export function createPRValidator(
  options?: Partial<PRValidatorConfig>
): PRValidator {
  return new PRValidator(options);
}

/**
 * Creates a PRValidator with strict validation settings
 *
 * @returns A PRValidator configured for strict governance validation
 */
export function createStrictPRValidator(): PRValidator {
  return new PRValidator({
    verbose: true,
    validationTimeoutMs: 600000, // 10 minutes
    customRules: [
      {
        id: 'require-description',
        name: 'Require Change Description',
        description: 'All governance changes must include descriptive comments',
        blocking: true,
        appliesTo: ['.claude/governance/**/*', '.claude/agents/**/*'],
      },
      {
        id: 'require-version-bump',
        name: 'Require Version Bump',
        description: 'Policy changes should include version updates',
        blocking: false,
        appliesTo: [
          '.claude/governance/**/*.yaml',
          '.claude/governance/**/*.yml',
        ],
      },
    ],
  });
}
