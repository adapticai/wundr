/* eslint-disable no-console */
/**
 * @wundr/risk-twin - PR Validator for Governance Change Validation
 *
 * Provides CI/CD integration for validating governance changes in pull requests
 * using the Risk Twin simulation environment.
 */

import { z } from 'zod';

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
 * Condition types for custom validation rules
 */
export type RuleConditionType =
  | 'file_pattern'
  | 'size_limit'
  | 'label_required'
  | 'label_forbidden';

/**
 * A single condition within a custom rule.
 *
 * Rules support four condition types:
 * - `file_pattern`    – triggers when a changed file matches one of the supplied globs
 * - `size_limit`      – triggers when the total line delta (additions + deletions) exceeds a threshold
 * - `label_required`  – triggers when the PR is missing one or more required labels
 * - `label_forbidden` – triggers when the PR carries one or more forbidden labels
 */
export type RuleCondition =
  | {
      /** Match files whose path matches any of the given glob patterns */
      readonly type: 'file_pattern';
      /** Glob patterns to match against changed file paths */
      readonly patterns: readonly string[];
    }
  | {
      /** Fail when the total lines changed (additions + deletions) exceeds the limit */
      readonly type: 'size_limit';
      /** Maximum number of total lines changed (additions + deletions) across applicable files */
      readonly maxLines: number;
    }
  | {
      /** Fail when the PR is missing any of the required labels */
      readonly type: 'label_required';
      /** Labels that must all be present on the PR */
      readonly labels: readonly string[];
    }
  | {
      /** Fail when the PR carries any of the forbidden labels */
      readonly type: 'label_forbidden';
      /** Labels that must not appear on the PR */
      readonly labels: readonly string[];
    };

/**
 * Action emitted when a rule condition is violated.
 *
 * - `fail` – adds an issue that contributes to a failed validation (blocks merge when the rule is blocking)
 * - `warn` – adds a recommendation that surfaces as an advisory
 */
export type RuleAction =
  | {
      /** Emit a human-readable failure message */
      readonly type: 'fail';
      /** The message to surface as an issue */
      readonly message: string;
    }
  | {
      /** Emit a human-readable advisory message */
      readonly type: 'warn';
      /** The message to surface as a recommendation */
      readonly message: string;
    };

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
  /**
   * Conditions evaluated against the applicable changes and PR metadata.
   * Each condition is checked independently; any violation triggers the rule's actions.
   * When omitted the rule is considered satisfied (no violations raised).
   */
  readonly conditions?: readonly RuleCondition[];
  /**
   * Actions executed for each condition violation.
   * When omitted a default `fail` message is generated automatically.
   */
  readonly actions?: readonly RuleAction[];
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
// Zod Schemas for PR Data Validation
// ============================================================================

/**
 * Zod schema for FileChange — validates field presence, types, and enum values.
 */
const FileChangeSchema = z.object({
  path: z.string().min(1, 'path must be a non-empty string'),
  status: z.enum(['added', 'modified', 'deleted', 'renamed'], {
    errorMap: () => ({
      message:
        "status must be one of 'added', 'modified', 'deleted', 'renamed'",
    }),
  }),
  additions: z
    .number({ invalid_type_error: 'additions must be a number' })
    .int('additions must be an integer')
    .min(0, 'additions must be >= 0'),
  deletions: z
    .number({ invalid_type_error: 'deletions must be a number' })
    .int('deletions must be an integer')
    .min(0, 'deletions must be >= 0'),
  previousPath: z.string().optional(),
  content: z.string().optional(),
  previousContent: z.string().optional(),
});

/**
 * Zod schema for PRInfo — validates required PR fields and their types.
 * Exported for use in higher-level validation pipelines that receive raw
 * untrusted PR payloads (e.g. from webhook handlers).
 */
export const PRInfoSchema = z.object({
  prNumber: z
    .number({ invalid_type_error: 'prNumber must be a number' })
    .int('prNumber must be an integer')
    .positive('prNumber must be a positive integer'),
  baseBranch: z.string().min(1, 'baseBranch must be a non-empty string'),
  headBranch: z.string().min(1, 'headBranch must be a non-empty string'),
  files: z.array(FileChangeSchema).min(0),
  author: z.string().min(1, 'author must be a non-empty string'),
  title: z.string().min(1, 'title must be a non-empty string'),
  description: z.string(),
  repository: z.string().optional(),
  labels: z.array(z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Shared severity enum used by governance schemas.
 */
const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Zod schema for agent charter YAML/JSON content.
 * Agent charters are expected to have at minimum a name and description.
 */
const AgentCharterContentSchema = z.object({
  name: z.string().min(1, 'Agent charter must have a non-empty name'),
  description: z
    .string()
    .min(1, 'Agent charter must have a non-empty description'),
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

/**
 * Zod schema for IPRE / governance policy YAML/JSON content.
 */
const PolicyContentSchema = z.object({
  id: z.string().min(1, 'Policy must have a non-empty id'),
  name: z.string().min(1, 'Policy must have a non-empty name'),
  version: z.string().optional(),
  severity: SeverityEnum.optional(),
  rules: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for reward function configuration.
 */
const RewardFunctionContentSchema = z.object({
  name: z.string().min(1, 'Reward function must have a non-empty name'),
  type: z.string().min(1, 'Reward function must specify a type'),
  parameters: z.record(z.unknown()).optional(),
  constraints: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for security policy content.
 */
const SecurityPolicyContentSchema = z.object({
  id: z.string().min(1, 'Security policy must have a non-empty id'),
  name: z.string().min(1, 'Security policy must have a non-empty name'),
  enforcement: z.enum(['strict', 'warn', 'off']).optional(),
  rules: z.array(z.unknown()).optional(),
});

/**
 * Generic fallback schema for unrecognised governance JSON/YAML files.
 * Requires at least a "name" field so configs are identifiable.
 */
const GenericGovernanceContentSchema = z.object({
  name: z.string().min(1, 'Governance file must have a non-empty name field'),
});

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

    // Validate the incoming PRInfo shape using Zod before any further processing.
    // This surfaces missing required fields, wrong types, and constraint violations
    // as a structured error rather than allowing them to propagate silently.
    const prInfoValidation = PRInfoSchema.safeParse(prInfo);
    if (!prInfoValidation.success) {
      const fieldErrors = prInfoValidation.error.issues
        .map(issue => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
          return `${path}: ${issue.message}`;
        })
        .join('; ');
      throw new Error(
        `Invalid PRInfo for PR #${String(prInfo?.prNumber ?? 'unknown')}: ${fieldErrors}`
      );
    }

    // Extract governance changes from the PR
    const governanceChanges = await this.extractGovernanceChanges(prInfo);

    // If no governance changes, return approved
    if (governanceChanges.length === 0) {
      return this.createApprovedResult(prInfo, governanceChanges);
    }

    // Run validation on the changes
    const validations = await this.runValidation(governanceChanges, prInfo);

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
   * @param prInfo - Optional PR context passed to custom rules (needed for label conditions)
   * @returns Promise resolving to array of validation reports
   */
  async runValidation(
    changes: GovernanceChange[],
    prInfo?: PRInfo
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
      } else {
        if (this.config.verbose) {
          console.warn(
            '[risk-twin] Orchestrator is present but reported not ready — Risk Twin simulation skipped'
          );
        }
      }
    }

    // Run custom validations if configured
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        reports.push(await this.runCustomValidation(rule, changes, prInfo));
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
      const filePath = change.fileChange.path;

      // ── Step 1: Validate the FileChange shape itself ─────────────────────
      const fileChangeResult = FileChangeSchema.safeParse(change.fileChange);
      if (!fileChangeResult.success) {
        for (const issue of fileChangeResult.error.issues) {
          const fieldPath =
            issue.path.length > 0 ? issue.path.join('.') : 'fileChange';
          issues.push(
            `Schema error in file change for "${filePath}" — ${fieldPath}: ${issue.message}`
          );
        }
        // Skip content validation when the envelope itself is invalid.
        continue;
      }

      // ── Step 2: Parse and validate structured content (JSON / YAML) ──────
      const isConfigFile =
        filePath.endsWith('.yaml') ||
        filePath.endsWith('.yml') ||
        filePath.endsWith('.json');

      if (isConfigFile && change.fileChange.content) {
        let parsed: unknown;

        // Parse the raw content
        if (filePath.endsWith('.json')) {
          try {
            parsed = JSON.parse(change.fileChange.content);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            issues.push(`Invalid JSON in "${filePath}": ${msg}`);
            continue;
          }
        } else {
          // YAML: attempt a lightweight key:value parse for basic field extraction.
          // Full YAML parsing would require a dedicated library; this covers the
          // common case of flat/simple governance YAML files.
          try {
            const lines = change.fileChange.content.split('\n');
            const obj: Record<string, unknown> = {};
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) continue;
              const colonIndex = trimmed.indexOf(':');
              if (colonIndex === -1) continue;
              const key = trimmed.slice(0, colonIndex).trim();
              const value = trimmed.slice(colonIndex + 1).trim();
              if (key) {
                // Remove surrounding quotes if present
                obj[key] = value.replace(/^['"]|['"]$/g, '') || undefined;
              }
            }
            parsed = obj;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            issues.push(
              `Could not parse YAML content in "${filePath}": ${msg}`
            );
            continue;
          }
        }

        // ── Step 3: Select and run the type-specific Zod schema ─────────────
        const schema = ((): z.ZodTypeAny => {
          switch (change.type) {
            case 'agent_charter':
              return AgentCharterContentSchema;
            case 'ipre_policy':
            case 'governance_rule':
            case 'operational_policy':
            case 'alignment_config':
              return PolicyContentSchema;
            case 'reward_function':
              return RewardFunctionContentSchema;
            case 'security_policy':
              return SecurityPolicyContentSchema;
            default:
              return GenericGovernanceContentSchema;
          }
        })();

        const contentResult = schema.safeParse(parsed);
        if (!contentResult.success) {
          for (const issue of contentResult.error.issues) {
            const fieldPath =
              issue.path.length > 0 ? issue.path.join('.') : 'root';
            issues.push(
              `Schema validation failed in "${filePath}" — ${fieldPath}: ${issue.message}`
            );
          }
          continue;
        }

        passedCount++;
      } else {
        // Non-config files (e.g. .ts, .md) only need the FileChange shape check,
        // which already passed in Step 1.
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

    // Gather all policy-bearing changes for conflict analysis.
    // We treat ipre_policy, security_policy, operational_policy, and
    // alignment_config as "policy" files because they each express
    // behavioural rules that can contradict one another.
    const policyChanges = changes.filter(
      c =>
        c.type === 'ipre_policy' ||
        c.type === 'security_policy' ||
        c.type === 'operational_policy' ||
        c.type === 'alignment_config'
    );

    if (policyChanges.length > 1) {
      // Build a directive map: policy ID (file path) → set of normalised
      // directives extracted from the file content.
      const policyDirectives = policyChanges.map(change =>
        this.extractPolicyDirectives(change)
      );

      // Run pairwise conflict checks across every combination of policies.
      for (let i = 0; i < policyDirectives.length; i++) {
        for (let j = i + 1; j < policyDirectives.length; j++) {
          const conflicts = this.detectDirectiveConflicts(
            policyDirectives[i],
            policyDirectives[j]
          );
          for (const conflict of conflicts) {
            issues.push(conflict);
          }
        }
      }

      // Surface a general review recommendation whenever multiple policies
      // change simultaneously, even if no machine-detectable conflicts exist.
      if (issues.length === 0) {
        recommendations.push(
          `${policyChanges.length} policy files changed simultaneously — verify no implicit conflicts exist`
        );
      }
    }

    // Check for deleted policies that might still be referenced elsewhere.
    const deletedPolicies = changes.filter(
      c =>
        c.fileChange.status === 'deleted' &&
        (c.type === 'ipre_policy' ||
          c.type === 'security_policy' ||
          c.type === 'operational_policy' ||
          c.type === 'alignment_config')
    );

    if (deletedPolicies.length > 0) {
      for (const deleted of deletedPolicies) {
        issues.push(
          `Policy file deleted: "${deleted.fileChange.path}" — ensure no other policies or agents reference it`
        );
      }
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
      // This branch should never be reached in normal operation because
      // runValidation() only calls validateWithRiskTwin() after confirming
      // the orchestrator is present and ready.  If it is reached, it means
      // the call-site contract was violated — surface that as a visible
      // warning rather than silently returning a passing result.
      console.warn(
        '[risk-twin] validateWithRiskTwin() called without an orchestrator — ' +
          'simulation was skipped.  This is a programming error; check the call site.'
      );
      return {
        id: 'risk-twin-validation',
        name: 'Risk Twin Validation',
        passed: false,
        score: 0,
        issues: [
          'Risk Twin simulation could not run: orchestrator is not configured',
        ],
        recommendations: [
          'Configure a RiskTwinOrchestrator via setOrchestrator() to enable simulation-based validation',
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
   * Runs a custom validation rule against the applicable governance changes.
   *
   * Execution model:
   * 1. Filter changes to those whose file paths match any pattern in `rule.appliesTo`.
   * 2. For each condition defined on the rule, evaluate it against the applicable
   *    changes (and the PR metadata when available).
   * 3. For every violated condition, execute the rule's actions.  When no actions
   *    are defined a default `fail` message is generated automatically.
   * 4. The report passes only when no conditions were violated.
   *
   * Supported condition types:
   * - `file_pattern`    – violation when a changed file path matches one of the supplied globs
   * - `size_limit`      – violation when total line delta across applicable files exceeds `maxLines`
   * - `label_required`  – violation when the PR is missing one or more required labels
   * - `label_forbidden` – violation when the PR carries one or more forbidden labels
   */
  private async runCustomValidation(
    rule: ValidationRule,
    changes: readonly GovernanceChange[],
    prInfo?: PRInfo
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Step 1: Narrow changes to those covered by this rule's appliesTo patterns.
    const applicableChanges = changes.filter(change =>
      rule.appliesTo.some(pattern =>
        this.matchesPattern(change.fileChange.path, pattern)
      )
    );

    // If no changes are in scope there is nothing to evaluate — pass trivially.
    if (applicableChanges.length === 0) {
      return {
        id: `custom-${rule.id}`,
        name: rule.name,
        passed: true,
        score: 1,
        issues: [],
        recommendations: [],
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
        category: 'custom',
        blocking: rule.blocking,
      };
    }

    // Steps 2 + 3: Evaluate each condition and dispatch actions on violation.
    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        const violationMessages = this.evaluateCondition(
          condition,
          applicableChanges,
          prInfo
        );

        for (const violationMsg of violationMessages) {
          this.dispatchRuleActions(rule, violationMsg, issues, recommendations);
        }
      }
    }
    // When no conditions are defined the rule is informational only — no
    // violations are raised and the report passes with a full score.

    // Step 4: Calculate score as the fraction of applicable files with no issues.
    // Cap the issue count at the number of files so the score stays in [0, 1].
    const fileIssueCount = Math.min(issues.length, applicableChanges.length);
    const score =
      applicableChanges.length > 0
        ? Math.max(
            0,
            (applicableChanges.length - fileIssueCount) /
              applicableChanges.length
          )
        : 1;

    return {
      id: `custom-${rule.id}`,
      name: rule.name,
      passed: issues.length === 0,
      score,
      issues,
      recommendations,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
      category: 'custom',
      blocking: rule.blocking,
    };
  }

  /**
   * Evaluates a single rule condition against the applicable changes and PR
   * metadata, returning a (possibly empty) list of human-readable violation
   * messages.  An empty list means the condition is satisfied.
   */
  private evaluateCondition(
    condition: RuleCondition,
    applicableChanges: readonly GovernanceChange[],
    prInfo?: PRInfo
  ): string[] {
    switch (condition.type) {
      case 'file_pattern': {
        // Violation: any applicable change whose path matches one of the
        // condition's patterns.  This is useful for flagging specific file
        // subtypes within the broader appliesTo scope (e.g. blocking changes
        // to a particular sub-directory).
        const matched = applicableChanges.filter(change =>
          condition.patterns.some(p =>
            this.matchesPattern(change.fileChange.path, p)
          )
        );
        return matched.map(
          change =>
            `File "${change.fileChange.path}" matches restricted pattern(s): ${condition.patterns.join(', ')}`
        );
      }

      case 'size_limit': {
        // Violation: the combined line delta (additions + deletions) across all
        // applicable files exceeds the configured maximum.
        const totalLines = applicableChanges.reduce(
          (sum, change) =>
            sum + change.fileChange.additions + change.fileChange.deletions,
          0
        );
        if (totalLines > condition.maxLines) {
          return [
            `Change size ${totalLines} line(s) exceeds the limit of ${condition.maxLines} line(s)` +
              ` across ${applicableChanges.length} applicable file(s)`,
          ];
        }
        return [];
      }

      case 'label_required': {
        // Violation: any required label is absent from the PR.
        // When no PR context is provided we cannot evaluate label conditions;
        // treat as satisfied to avoid false positives.
        const prLabels = prInfo?.labels ?? [];
        const missing = condition.labels.filter(
          required => !prLabels.includes(required)
        );
        if (missing.length > 0) {
          return [`PR is missing required label(s): ${missing.join(', ')}`];
        }
        return [];
      }

      case 'label_forbidden': {
        // Violation: any forbidden label is present on the PR.
        const prLabels = prInfo?.labels ?? [];
        const present = condition.labels.filter(forbidden =>
          prLabels.includes(forbidden)
        );
        if (present.length > 0) {
          return [`PR carries forbidden label(s): ${present.join(', ')}`];
        }
        return [];
      }
    }
  }

  /**
   * Dispatches a rule's configured actions for a single condition violation.
   *
   * When a rule has no actions defined, a default `fail` action is synthesised
   * using the violation message so the report always has actionable content.
   */
  private dispatchRuleActions(
    rule: ValidationRule,
    violationMessage: string,
    issues: string[],
    recommendations: string[]
  ): void {
    // Default to a `fail` action when the rule author did not configure any.
    const actions: readonly RuleAction[] =
      rule.actions && rule.actions.length > 0
        ? rule.actions
        : [{ type: 'fail', message: violationMessage }];

    for (const action of actions) {
      switch (action.type) {
        case 'fail':
          // Use the action's message when one is set; otherwise fall back to
          // the raw violation message so output is always human-readable.
          issues.push(action.message || violationMessage);
          break;
        case 'warn':
          recommendations.push(action.message || violationMessage);
          break;
      }
    }
  }

  // ============================================================================
  // Policy Conflict Detection Helpers
  // ============================================================================

  /**
   * Represents a single normalised directive extracted from a policy file.
   * Each directive has a key (the rule dimension, e.g. "require_tests") and a
   * value (the directive's setting, e.g. "true" / "false" / "strict").
   */
  private extractPolicyDirectives(change: GovernanceChange): {
    policyId: string;
    directives: Map<string, string>;
  } {
    const policyId = change.fileChange.path;
    const directives = new Map<string, string>();
    const content = change.fileChange.content ?? '';

    // Parse key: value pairs from the content.  We handle both JSON and the
    // lightweight YAML format that the schema validator already uses.
    if (policyId.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        this.flattenPolicyObject(parsed, '', directives);
      } catch {
        // Unparseable content — no directives to extract
      }
    } else {
      // YAML / Markdown: extract "key: value" lines
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;
        const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
        const value = trimmed
          .slice(colonIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '')
          .toLowerCase();
        if (key && value) {
          directives.set(key, value);
        }
      }
    }

    return { policyId, directives };
  }

  /**
   * Recursively flattens a parsed JSON object into dot-notation key/value
   * pairs, making it easier to compare directives across policy files.
   */
  private flattenPolicyObject(
    obj: Record<string, unknown>,
    prefix: string,
    out: Map<string, string>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        this.flattenPolicyObject(
          value as Record<string, unknown>,
          fullKey,
          out
        );
      } else {
        out.set(fullKey.toLowerCase(), String(value).toLowerCase());
      }
    }
  }

  /**
   * Pairs of directive keys where opposing values constitute a conflict.
   * Each entry describes:
   *  - keys  — canonical key names that represent the same policy dimension
   *  - conflict — a function that returns true when the two values conflict
   *  - description — template for the human-readable conflict message
   */
  private static readonly CONFLICT_RULES: ReadonlyArray<{
    readonly keys: readonly string[];
    readonly conflict: (a: string, b: string) => boolean;
    readonly description: string;
  }> = [
    {
      // One policy mandates tests; another policy explicitly allows skipping.
      keys: ['require_tests', 'requiretests', 'require-tests'],
      conflict: (a, b) =>
        (a === 'true' && (b === 'false' || b === 'skip' || b === 'off')) ||
        (b === 'true' && (a === 'false' || a === 'skip' || a === 'off')),
      description:
        'Conflicting test requirements: one policy requires tests while another allows skipping them',
    },
    {
      // One policy sets enforcement to "strict"; another sets it to "off"/"warn".
      keys: ['enforcement', 'enforce'],
      conflict: (a, b) =>
        (a === 'strict' && (b === 'off' || b === 'warn')) ||
        (b === 'strict' && (a === 'off' || a === 'warn')),
      description:
        'Conflicting enforcement levels: one policy enforces strictly while another disables or softens enforcement',
    },
    {
      // One policy allows a capability; another explicitly denies it.
      keys: [
        'allow_external_calls',
        'allowexternalcalls',
        'allow-external-calls',
      ],
      conflict: (a, b) =>
        (a === 'true' && b === 'false') || (b === 'true' && a === 'false'),
      description:
        'Conflicting external-call permissions: one policy allows external calls while another denies them',
    },
    {
      // One policy allows data export; another prohibits it.
      keys: ['allow_data_export', 'allowdataexport', 'allow-data-export'],
      conflict: (a, b) =>
        (a === 'true' && b === 'false') || (b === 'true' && a === 'false'),
      description:
        'Conflicting data-export permissions: one policy allows data export while another prohibits it',
    },
    {
      // One policy requires Guardian review; another marks it as not required.
      keys: [
        'requires_guardian_review',
        'requiresguardianreview',
        'requires-guardian-review',
      ],
      conflict: (a, b) =>
        (a === 'true' && b === 'false') || (b === 'true' && a === 'false'),
      description:
        'Conflicting Guardian review requirements: one policy mandates Guardian review while another does not',
    },
    {
      // Severity levels that are logically incompatible when set on the same scope.
      keys: ['severity'],
      conflict: (a, b) =>
        (a === 'critical' && (b === 'low' || b === 'medium')) ||
        (b === 'critical' && (a === 'low' || a === 'medium')),
      description:
        'Conflicting severity levels: one policy declares critical severity while another declares low/medium for the same governance dimension',
    },
  ] as const;

  /**
   * Compares the extracted directives of two policies and returns a list of
   * human-readable conflict descriptions, each identifying both affected
   * policy IDs.
   */
  private detectDirectiveConflicts(
    policyA: { policyId: string; directives: Map<string, string> },
    policyB: { policyId: string; directives: Map<string, string> }
  ): string[] {
    const conflicts: string[] = [];

    for (const rule of PRValidator.CONFLICT_RULES) {
      // Find the value in policyA for any of the rule's canonical key aliases.
      let valueA: string | undefined;
      let matchedKeyA: string | undefined;
      for (const key of rule.keys) {
        const v = policyA.directives.get(key);
        if (v !== undefined) {
          valueA = v;
          matchedKeyA = key;
          break;
        }
      }

      // Find the value in policyB for the same set of aliases.
      let valueB: string | undefined;
      for (const key of rule.keys) {
        const v = policyB.directives.get(key);
        if (v !== undefined) {
          valueB = v;
          break;
        }
      }

      // Only report a conflict when both policies define the directive and their
      // values are incompatible according to the rule's conflict predicate.
      if (
        valueA !== undefined &&
        valueB !== undefined &&
        matchedKeyA !== undefined &&
        rule.conflict(valueA, valueB)
      ) {
        conflicts.push(
          `Policy conflict on "${matchedKeyA}" between "${policyA.policyId}" (${valueA}) ` +
            `and "${policyB.policyId}" (${valueB}): ${rule.description}`
        );
      }
    }

    return conflicts;
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
