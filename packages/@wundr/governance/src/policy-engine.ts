/**
 * Policy Engine for Hard Constraint Enforcement
 *
 * Implements the IPRE governance layer's hard constraint enforcement,
 * ensuring AI agents operate within defined security, compliance, and
 * operational boundaries.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Policy categories for classification
 */
export type PolicyCategory = 'security' | 'compliance' | 'operational';

/**
 * Severity level for policy violations
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents a single policy definition
 */
export interface Policy {
  /** Unique policy identifier */
  readonly id: string;
  /** Policy category */
  readonly category: PolicyCategory;
  /** Human-readable name */
  readonly name: string;
  /** Detailed description */
  readonly description: string;
  /** Pattern or rule to check against */
  readonly pattern?: RegExp | string;
  /** Custom validation function */
  readonly validator?: (action: AgentAction) => boolean;
  /** Custom validator function name (for extensibility) */
  readonly validatorName?: string;
  /** Severity when violated */
  readonly severity: ViolationSeverity;
  /** Whether violation blocks the action */
  readonly blocking: boolean;
  /** Whether policy is currently active */
  readonly enabled: boolean;
}

/**
 * Collection of policies organized by category (immutable for external use)
 */
export interface PolicySet {
  readonly security: readonly Policy[];
  readonly compliance: readonly Policy[];
  readonly operational: readonly Policy[];
}

/**
 * Mutable policy set for internal engine use
 */
interface MutablePolicySet {
  security: Policy[];
  compliance: Policy[];
  operational: Policy[];
}

/**
 * Represents an action taken by an AI agent
 */
export interface AgentAction {
  /** Unique action identifier */
  readonly id: string;
  /** Session ID where action occurred */
  readonly sessionId: string;
  /** Agent ID that performed the action */
  readonly agentId: string;
  /** Type of action (e.g., 'commit', 'deploy', 'file_write') */
  readonly type: string;
  /** Action description */
  readonly description: string;
  /** Timestamp of action */
  readonly timestamp: Date;
  /** File paths affected (if applicable) */
  readonly affectedFiles?: string[];
  /** Code content (if applicable) */
  readonly codeContent?: string;
  /** Additional action metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Represents a policy violation
 */
export interface PolicyViolation {
  /** Unique violation identifier */
  readonly id: string;
  /** The violated policy */
  readonly policy: Policy;
  /** The action that caused the violation */
  readonly action: AgentAction;
  /** Violation timestamp */
  readonly timestamp: Date;
  /** Detailed violation message */
  readonly message: string;
  /** Severity of the violation */
  readonly severity: ViolationSeverity;
  /** Whether this violation blocks the action */
  readonly blocking: boolean;
}

/**
 * Result of a policy check
 */
export interface PolicyCheckResult {
  /** Whether the action is allowed */
  readonly allowed: boolean;
  /** List of violations found */
  readonly violations: PolicyViolation[];
  /** Non-blocking warnings */
  readonly warnings: string[];
}

/**
 * Policy configuration for loading
 */
export interface PolicyConfig {
  /** Security policies */
  readonly security?: PolicyDefinition[];
  /** Compliance policies */
  readonly compliance?: PolicyDefinition[];
  /** Operational policies */
  readonly operational?: PolicyDefinition[];
}

/**
 * Policy definition for configuration
 */
export interface PolicyDefinition {
  /** Unique policy identifier */
  readonly id?: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of the policy */
  readonly description?: string;
  /** Regex pattern to match against code content */
  readonly pattern?: string;
  /** Custom validator function name (for extensibility) */
  readonly validatorName?: string;
  /** Severity level */
  readonly severity?: ViolationSeverity;
  /** Whether violation blocks the action */
  readonly blocking?: boolean;
  /** Whether policy is enabled */
  readonly enabled?: boolean;
}

/**
 * Logger interface for policy engine
 */
export interface PolicyEngineLogger {
  log: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

/**
 * Configuration for the PolicyEngine
 */
export interface PolicyEngineConfig {
  /** Enable debug logging */
  readonly debug?: boolean;
  /** Maximum violations to track in history */
  readonly maxHistorySize?: number;
  /** Default severity for policies without explicit severity */
  readonly defaultSeverity?: ViolationSeverity;
  /** Default blocking behavior for policies */
  readonly defaultBlocking?: boolean;
  /** Custom validators registry */
  readonly customValidators?: Record<string, (action: AgentAction) => boolean>;
  /** Custom logger for debug output */
  readonly logger?: PolicyEngineLogger;
}

// ============================================================================
// Default Policies
// ============================================================================

/**
 * Default security policies from the implementation plan
 */
const DEFAULT_SECURITY_POLICIES: Policy[] = [
  {
    id: 'sec-001',
    category: 'security',
    name: 'No secrets in code',
    description:
      'Prevents hardcoded secrets, API keys, passwords, and tokens in code',
    pattern:
      /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'critical',
    blocking: true,
    enabled: true,
  },
  {
    id: 'sec-002',
    category: 'security',
    name: 'No SQL injection',
    description: 'Prevents potential SQL injection vulnerabilities',
    pattern:
      /(?:execute|exec|query)\s*\(\s*[`"']?\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP).*\$\{/gi,
    severity: 'critical',
    blocking: true,
    enabled: true,
  },
  {
    id: 'sec-003',
    category: 'security',
    name: 'No XSS',
    description: 'Prevents potential cross-site scripting vulnerabilities',
    pattern: /(?:innerHTML|outerHTML|document\.write)\s*[+=]\s*(?!['"`])/gi,
    severity: 'high',
    blocking: true,
    enabled: true,
  },
  {
    id: 'sec-004',
    category: 'security',
    name: 'No command injection',
    description: 'Prevents potential command injection vulnerabilities',
    pattern: /(?:exec|spawn|execSync|spawnSync)\s*\(\s*(?:[^)]*\$\{|[^)]*\+)/gi,
    severity: 'critical',
    blocking: true,
    enabled: true,
  },
];

/**
 * Default compliance policies from the implementation plan
 */
const DEFAULT_COMPLIANCE_POLICIES: Policy[] = [
  {
    id: 'comp-001',
    category: 'compliance',
    name: 'All changes require PR review',
    description:
      'Ensures all code changes go through pull request review process',
    validator: (action: AgentAction) => {
      if (action.type === 'direct_push' && action.metadata?.branch === 'main') {
        return false;
      }
      return true;
    },
    severity: 'high',
    blocking: true,
    enabled: true,
  },
  {
    id: 'comp-002',
    category: 'compliance',
    name: 'No force pushes',
    description: 'Prevents force pushes to protected branches',
    validator: (action: AgentAction) => {
      if (action.type === 'git_push' && action.metadata?.force === true) {
        return false;
      }
      return true;
    },
    severity: 'critical',
    blocking: true,
    enabled: true,
  },
  {
    id: 'comp-003',
    category: 'compliance',
    name: 'Test coverage minimum 80%',
    description: 'Ensures test coverage remains above 80%',
    validator: (action: AgentAction) => {
      if (action.type === 'test_report') {
        const coverage = action.metadata?.coverage as number | undefined;
        if (coverage !== undefined && coverage < 80) {
          return false;
        }
      }
      return true;
    },
    severity: 'medium',
    blocking: false,
    enabled: true,
  },
];

/**
 * Default operational policies from the implementation plan
 */
const DEFAULT_OPERATIONAL_POLICIES: Policy[] = [
  {
    id: 'ops-001',
    category: 'operational',
    name: 'No Friday deployments after 2pm',
    description: 'Prevents deployments on Fridays after 2pm local time',
    validator: (action: AgentAction) => {
      if (action.type === 'deploy') {
        const actionDate = new Date(action.timestamp);
        const dayOfWeek = actionDate.getDay();
        const hour = actionDate.getHours();
        // Friday is day 5, check if after 2pm (14:00)
        if (dayOfWeek === 5 && hour >= 14) {
          return false;
        }
      }
      return true;
    },
    severity: 'high',
    blocking: true,
    enabled: true,
  },
  {
    id: 'ops-002',
    category: 'operational',
    name: 'Rollback plan required',
    description: 'Requires rollback plan for production changes',
    validator: (action: AgentAction) => {
      if (
        action.type === 'deploy' &&
        action.metadata?.environment === 'production'
      ) {
        const hasRollbackPlan = action.metadata?.rollbackPlan !== undefined;
        return hasRollbackPlan;
      }
      return true;
    },
    severity: 'high',
    blocking: true,
    enabled: true,
  },
];

// ============================================================================
// PolicyEngine Class
// ============================================================================

/**
 * Policy Engine for enforcing hard constraints on AI agent actions
 *
 * Implements the IPRE governance layer's policy enforcement mechanism,
 * checking agent actions against security, compliance, and operational
 * policies and recording violations for monitoring and intervention.
 *
 * @example
 * ```typescript
 * const engine = new PolicyEngine({ debug: true });
 *
 * // Check an action
 * const result = engine.checkAction({
 *   id: 'action-1',
 *   sessionId: 'session-1',
 *   agentId: 'coder-1',
 *   type: 'commit',
 *   description: 'Add new feature',
 *   timestamp: new Date(),
 *   codeContent: 'const apiKey = "sk-secret123"'
 * });
 *
 * if (!result.allowed) {
 *   console.log('Action blocked:', result.violations);
 * }
 * ```
 */
export class PolicyEngine {
  private policies: MutablePolicySet;
  private violationHistory: PolicyViolation[];
  private readonly config: PolicyEngineConfig;
  private readonly customValidators: Record<
    string,
    (action: AgentAction) => boolean
  >;

  constructor(config: PolicyEngineConfig = {}) {
    this.config = {
      maxHistorySize: 10000,
      defaultSeverity: 'medium',
      defaultBlocking: true,
      ...config,
    };

    this.policies = {
      security: [...DEFAULT_SECURITY_POLICIES],
      compliance: [...DEFAULT_COMPLIANCE_POLICIES],
      operational: [...DEFAULT_OPERATIONAL_POLICIES],
    };

    this.violationHistory = [];
    this.customValidators = config.customValidators || {};

    if (this.config.debug) {
      this.log('PolicyEngine initialized with default policies');
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Load policies from configuration
   *
   * @param config - Policy configuration to load
   */
  loadPolicies(config: PolicyConfig): void {
    if (config.security) {
      const securityPolicies = config.security.map((def, index) =>
        this.createPolicyFromDefinition(def, 'security', index),
      );
      this.policies.security = [...this.policies.security, ...securityPolicies];
    }

    if (config.compliance) {
      const compliancePolicies = config.compliance.map((def, index) =>
        this.createPolicyFromDefinition(def, 'compliance', index),
      );
      this.policies.compliance = [
        ...this.policies.compliance,
        ...compliancePolicies,
      ];
    }

    if (config.operational) {
      const operationalPolicies = config.operational.map((def, index) =>
        this.createPolicyFromDefinition(def, 'operational', index),
      );
      this.policies.operational = [
        ...this.policies.operational,
        ...operationalPolicies,
      ];
    }

    if (this.config.debug) {
      this.log(
        `Loaded policies: security=${this.policies.security.length}, ` +
          `compliance=${this.policies.compliance.length}, ` +
          `operational=${this.policies.operational.length}`,
      );
    }
  }

  /**
   * Check an agent action against all policies
   *
   * @param action - The action to check
   * @returns Policy check result with allowed status, violations, and warnings
   */
  checkAction(action: AgentAction): PolicyCheckResult {
    const violations: PolicyViolation[] = [];
    const warnings: string[] = [];

    // Check all policy categories
    const allPolicies = [
      ...this.policies.security,
      ...this.policies.compliance,
      ...this.policies.operational,
    ];

    for (const policy of allPolicies) {
      if (!policy.enabled) {
        continue;
      }

      const isViolated = this.checkPolicyViolation(policy, action);

      if (isViolated) {
        const violation = this.createViolation(policy, action);
        violations.push(violation);

        if (!policy.blocking) {
          warnings.push(
            `[${policy.category.toUpperCase()}] ${policy.name}: ${policy.description}`,
          );
        }
      }
    }

    // Record all violations
    for (const violation of violations) {
      this.recordViolation(violation);
    }

    // Determine if action is allowed (any blocking violation blocks the action)
    const blockingViolations = violations.filter(v => v.blocking);
    const allowed = blockingViolations.length === 0;

    if (this.config.debug) {
      this.log(
        `Action ${action.id} check: allowed=${allowed}, violations=${violations.length}`,
      );
    }

    return {
      allowed,
      violations,
      warnings,
    };
  }

  /**
   * Check if an action is blocked by any policy
   *
   * @param action - The action to check
   * @returns true if the action is blocked
   */
  isBlocked(action: AgentAction): boolean {
    const result = this.checkAction(action);
    return !result.allowed;
  }

  /**
   * Get all violations for an action without recording them
   *
   * @param action - The action to check
   * @returns Array of policy violations
   */
  getViolations(action: AgentAction): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    const allPolicies = [
      ...this.policies.security,
      ...this.policies.compliance,
      ...this.policies.operational,
    ];

    for (const policy of allPolicies) {
      if (!policy.enabled) {
        continue;
      }

      const isViolated = this.checkPolicyViolation(policy, action);

      if (isViolated) {
        violations.push(this.createViolation(policy, action));
      }
    }

    return violations;
  }

  /**
   * Record a policy violation
   *
   * @param violation - The violation to record
   */
  recordViolation(violation: PolicyViolation): void {
    this.violationHistory.push(violation);

    // Trim history if it exceeds max size
    const maxSize = this.config.maxHistorySize || 10000;
    if (this.violationHistory.length > maxSize) {
      this.violationHistory = this.violationHistory.slice(-maxSize);
    }

    if (this.config.debug) {
      this.log(
        `Recorded violation: ${violation.policy.name} for action ${violation.action.id}`,
      );
    }
  }

  /**
   * Get violation history, optionally filtered by session ID
   *
   * @param sessionId - Optional session ID to filter by
   * @returns Array of policy violations
   */
  getViolationHistory(sessionId?: string): PolicyViolation[] {
    if (sessionId) {
      return this.violationHistory.filter(
        v => v.action.sessionId === sessionId,
      );
    }
    return [...this.violationHistory];
  }

  /**
   * Calculate the violation rate over a time window
   *
   * @param timeWindowMs - Time window in milliseconds (default: 24 hours)
   * @returns Violation rate (violations per hour)
   */
  getViolationRate(timeWindowMs?: number): number {
    const windowMs = timeWindowMs || 24 * 60 * 60 * 1000; // Default 24 hours
    const cutoff = new Date(Date.now() - windowMs);

    const recentViolations = this.violationHistory.filter(
      v => v.timestamp >= cutoff,
    );

    const hoursInWindow = windowMs / (60 * 60 * 1000);
    return recentViolations.length / hoursInWindow;
  }

  // ============================================================================
  // Additional Public Methods
  // ============================================================================

  /**
   * Get all policies organized by category
   */
  getPolicies(): PolicySet {
    return {
      security: [...this.policies.security],
      compliance: [...this.policies.compliance],
      operational: [...this.policies.operational],
    };
  }

  /**
   * Enable or disable a specific policy
   *
   * @param policyId - The policy ID to modify
   * @param enabled - Whether to enable or disable
   */
  setPolicyEnabled(policyId: string, enabled: boolean): void {
    for (const category of [
      'security',
      'compliance',
      'operational',
    ] as PolicyCategory[]) {
      const policyIndex = this.policies[category].findIndex(
        p => p.id === policyId,
      );
      if (policyIndex !== -1) {
        const policy = this.policies[category][policyIndex];
        if (!policy) {
          continue;
        }
        // Create new policy with updated enabled status, preserving all required fields
        const updatedPolicy: Policy = {
          id: policy.id,
          category: policy.category,
          name: policy.name,
          description: policy.description,
          severity: policy.severity,
          blocking: policy.blocking,
          enabled,
          ...(policy.pattern !== undefined ? { pattern: policy.pattern } : {}),
          ...(policy.validator !== undefined
            ? { validator: policy.validator }
            : {}),
          ...(policy.validatorName !== undefined
            ? { validatorName: policy.validatorName }
            : {}),
        };
        this.policies[category][policyIndex] = updatedPolicy;
        if (this.config.debug) {
          this.log(`Policy ${policyId} ${enabled ? 'enabled' : 'disabled'}`);
        }
        return;
      }
    }

    if (this.config.debug) {
      this.log(`Policy ${policyId} not found`);
    }
  }

  /**
   * Clear violation history
   *
   * @param sessionId - Optional session ID to clear only specific session violations
   */
  clearViolationHistory(sessionId?: string): void {
    if (sessionId) {
      this.violationHistory = this.violationHistory.filter(
        v => v.action.sessionId !== sessionId,
      );
    } else {
      this.violationHistory = [];
    }

    if (this.config.debug) {
      this.log(
        `Violation history cleared${sessionId ? ` for session ${sessionId}` : ''}`,
      );
    }
  }

  /**
   * Get violation statistics
   */
  getViolationStats(): {
    total: number;
    byCategory: Record<PolicyCategory, number>;
    bySeverity: Record<ViolationSeverity, number>;
    blockingCount: number;
  } {
    const stats = {
      total: this.violationHistory.length,
      byCategory: {
        security: 0,
        compliance: 0,
        operational: 0,
      } as Record<PolicyCategory, number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<ViolationSeverity, number>,
      blockingCount: 0,
    };

    for (const violation of this.violationHistory) {
      stats.byCategory[violation.policy.category]++;
      stats.bySeverity[violation.severity]++;
      if (violation.blocking) {
        stats.blockingCount++;
      }
    }

    return stats;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if a policy is violated by an action
   */
  private checkPolicyViolation(policy: Policy, action: AgentAction): boolean {
    // Check pattern-based validation
    if (policy.pattern && action.codeContent) {
      const regex =
        typeof policy.pattern === 'string'
          ? new RegExp(policy.pattern, 'gi')
          : policy.pattern;

      if (regex.test(action.codeContent)) {
        return true;
      }
    }

    // Check custom validator
    if (policy.validator) {
      const isValid = policy.validator(action);
      if (!isValid) {
        return true;
      }
    }

    // Check registered custom validator by name
    if (policy.validatorName !== undefined) {
      const customValidator = this.customValidators[policy.validatorName];
      if (customValidator !== undefined) {
        const isValid = customValidator(action);
        if (!isValid) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Create a policy violation record
   */
  private createViolation(
    policy: Policy,
    action: AgentAction,
  ): PolicyViolation {
    return {
      id: this.generateViolationId(),
      policy,
      action,
      timestamp: new Date(),
      message: `Policy "${policy.name}" violated: ${policy.description}`,
      severity: policy.severity,
      blocking: policy.blocking,
    };
  }

  /**
   * Create a policy from definition
   */
  private createPolicyFromDefinition(
    def: PolicyDefinition,
    category: PolicyCategory,
    index: number,
  ): Policy {
    const id = def.id || `${category.substring(0, 4)}-custom-${index + 1}`;

    let validator: ((action: AgentAction) => boolean) | undefined;
    if (def.validatorName !== undefined) {
      const customValidator = this.customValidators[def.validatorName];
      if (customValidator !== undefined) {
        validator = customValidator;
      }
    }

    // Build policy object with all fields inline to avoid readonly mutation issues
    const policy: Policy = {
      id,
      category,
      name: def.name,
      description: def.description || def.name,
      severity: def.severity || this.config.defaultSeverity || 'medium',
      blocking:
        def.blocking !== undefined
          ? def.blocking
          : this.config.defaultBlocking !== false,
      enabled: def.enabled !== false,
      // Optional fields - only set if defined
      ...(def.pattern !== undefined && {
        pattern: new RegExp(def.pattern, 'gi'),
      }),
      ...(validator !== undefined && { validator }),
      ...(def.validatorName !== undefined && {
        validatorName: def.validatorName,
      }),
    };

    return policy;
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `VIO-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.config.debug && this.config.logger) {
      this.config.logger.log(`[PolicyEngine] ${message}`);
    }
  }
}

// Note: All exports are inline with their declarations above
