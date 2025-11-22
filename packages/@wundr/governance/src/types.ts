/**
 * IPRE Governance Types
 * Intent, Policies, Rewards, Evaluators
 */

// ============================================================================
// Intent Types
// ============================================================================

/**
 * Core values that guide the organization's mission
 */
export interface Intent {
  /** The organization's primary purpose or goal */
  mission: string;
  /** Core principles that guide decision-making */
  values: string[];
  /** Optional description providing context */
  description?: string;
  /** Timestamp when intent was last updated */
  updatedAt?: string;
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Security policy configuration
 */
export interface SecurityPolicy {
  /** Unique identifier for the policy */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the policy */
  description: string;
  /** Whether the policy is currently active */
  enabled: boolean;
  /** Severity level of violations */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Rules that define the policy */
  rules: PolicyRule[];
  /** Actions to take on violation */
  actions: PolicyAction[];
}

/**
 * Compliance policy configuration
 */
export interface CompliancePolicy {
  /** Unique identifier for the policy */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the policy */
  description: string;
  /** Whether the policy is currently active */
  enabled: boolean;
  /** Compliance framework reference (e.g., SOC2, GDPR) */
  framework: string;
  /** Specific control identifier within the framework */
  controlId?: string;
  /** Rules that define the policy */
  rules: PolicyRule[];
  /** Actions to take on violation */
  actions: PolicyAction[];
}

/**
 * Operational policy configuration
 */
export interface OperationalPolicy {
  /** Unique identifier for the policy */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the policy */
  description: string;
  /** Whether the policy is currently active */
  enabled: boolean;
  /** Category of operational concern */
  category: 'performance' | 'reliability' | 'cost' | 'quality' | 'process';
  /** Rules that define the policy */
  rules: PolicyRule[];
  /** Actions to take on violation */
  actions: PolicyAction[];
}

/**
 * Individual rule within a policy
 */
export interface PolicyRule {
  /** Unique identifier for the rule */
  id: string;
  /** Condition that triggers the rule (expression or pattern) */
  condition: string;
  /** Type of condition evaluation */
  type: 'regex' | 'threshold' | 'expression' | 'pattern';
  /** Target resource or scope for the rule */
  target?: string;
  /** Additional metadata for the rule */
  metadata?: Record<string, unknown>;
}

/**
 * Action to take when a policy is violated
 */
export interface PolicyAction {
  /** Type of action */
  type: 'notify' | 'block' | 'warn' | 'log' | 'remediate' | 'escalate';
  /** Target for the action (e.g., email, webhook URL) */
  target?: string;
  /** Message template for the action */
  message?: string;
  /** Additional configuration for the action */
  config?: Record<string, unknown>;
}

/**
 * Aggregated policy container
 */
export interface Policy {
  /** Security-related policies */
  security: SecurityPolicy[];
  /** Compliance-related policies */
  compliance: CompliancePolicy[];
  /** Operational policies */
  operational: OperationalPolicy[];
}

// ============================================================================
// Reward Types
// ============================================================================

/**
 * Weights for different reward dimensions
 */
export interface RewardWeights {
  /** Weight for customer value metrics (0-1) */
  customer_value: number;
  /** Weight for code quality metrics (0-1) */
  code_quality: number;
  /** Weight for security posture metrics (0-1) */
  security_posture: number;
  /** Weight for operational excellence metrics (0-1) */
  operational_excellence: number;
  /** Weight for innovation metrics (0-1) */
  innovation: number;
  /** Weight for compliance adherence metrics (0-1) */
  compliance: number;
}

/**
 * Individual reward score for a dimension
 */
export interface RewardScore {
  /** Dimension being scored */
  dimension: keyof RewardWeights;
  /** Raw score value (0-100) */
  score: number;
  /** Weighted score based on configuration */
  weightedScore: number;
  /** Factors contributing to the score */
  factors: RewardFactor[];
  /** Timestamp of the evaluation */
  timestamp: string;
}

/**
 * Factor contributing to a reward score
 */
export interface RewardFactor {
  /** Name of the factor */
  name: string;
  /** Value of the factor */
  value: number;
  /** Weight of this factor within its dimension */
  weight: number;
  /** Source of the data */
  source?: string;
}

/**
 * Complete rewards configuration
 */
export interface Rewards {
  /** Weight configuration for reward dimensions */
  weights: RewardWeights;
  /** Minimum acceptable total score */
  threshold: number;
  /** How often to calculate rewards */
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

// ============================================================================
// Evaluator Types
// ============================================================================

/**
 * Configuration for an evaluator
 */
export interface EvaluatorConfig {
  /** Unique identifier for the evaluator */
  id: string;
  /** Human-readable name */
  name: string;
  /** Type of evaluation to perform */
  type: 'static' | 'dynamic' | 'ai' | 'composite' | 'threshold' | 'trend';
  /** How often to run the evaluator */
  frequency:
    | 'realtime'
    | 'on-commit'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'manual';
  /** Threshold value that triggers action */
  threshold: number;
  /** Action to take when threshold is breached */
  action: 'notify' | 'block' | 'warn' | 'log' | 'remediate' | 'escalate';
  /** Target scope for evaluation */
  scope?: string;
  /** Additional configuration options */
  options?: EvaluatorOptions;
  /** Whether the evaluator is enabled */
  enabled: boolean;
}

/**
 * Additional options for evaluator configuration
 */
export interface EvaluatorOptions {
  /** Comparison operator for threshold evaluation */
  comparison?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  /** Aggregation method for multiple values */
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  /** Time window for trend analysis (in seconds) */
  timeWindow?: number;
  /** Custom evaluation expression */
  expression?: string;
  /** Tags for categorization */
  tags?: string[];
}

// ============================================================================
// Violation and Result Types
// ============================================================================

/**
 * Record of a policy violation
 */
export interface PolicyViolation {
  /** Unique identifier for the violation */
  id: string;
  /** Reference to the violated policy */
  policyId: string;
  /** Reference to the specific rule violated */
  ruleId: string;
  /** Severity of the violation */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description of the violation */
  message: string;
  /** Location or resource where violation occurred */
  location?: ViolationLocation;
  /** Timestamp when violation was detected */
  timestamp: string;
  /** Current status of the violation */
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  /** Who or what detected the violation */
  detectedBy: string;
  /** Additional context about the violation */
  context?: Record<string, unknown>;
  /** Suggested remediation steps */
  remediation?: string[];
}

/**
 * Location information for a violation
 */
export interface ViolationLocation {
  /** File path where violation occurred */
  file?: string;
  /** Line number in the file */
  line?: number;
  /** Column number in the file */
  column?: number;
  /** Resource identifier (e.g., service name, endpoint) */
  resource?: string;
  /** Environment where violation occurred */
  environment?: string;
}

/**
 * Result of an evaluation run
 */
export interface EvaluationResult {
  /** Unique identifier for the evaluation run */
  id: string;
  /** Reference to the evaluator that produced this result */
  evaluatorId: string;
  /** Whether the evaluation passed or failed */
  passed: boolean;
  /** Numeric score from the evaluation (0-100) */
  score: number;
  /** Threshold that was used for comparison */
  threshold: number;
  /** Detailed breakdown of the evaluation */
  details: EvaluationDetail[];
  /** List of violations found during evaluation */
  violations: PolicyViolation[];
  /** Timestamp when evaluation was performed */
  timestamp: string;
  /** Duration of evaluation in milliseconds */
  duration: number;
  /** Additional metadata about the evaluation */
  metadata?: Record<string, unknown>;
}

/**
 * Detailed breakdown item within an evaluation result
 */
export interface EvaluationDetail {
  /** Name of the check or metric */
  name: string;
  /** Whether this specific check passed */
  passed: boolean;
  /** Value that was evaluated */
  value: unknown;
  /** Expected or threshold value */
  expected?: unknown;
  /** Human-readable message about the result */
  message: string;
}

// ============================================================================
// IPRE Configuration (Root Type)
// ============================================================================

/**
 * Complete IPRE Governance Configuration
 * Intent, Policies, Rewards, Evaluators
 */
export interface IPREConfig {
  /** Version of the IPRE configuration schema */
  version: string;
  /** Intent configuration - the "why" */
  intent: Intent;
  /** Policies configuration - the "what" */
  policies: Policy;
  /** Rewards configuration - the "how well" */
  rewards: Rewards;
  /** Evaluators configuration - the "how to measure" */
  evaluators: EvaluatorConfig[];
  /** Global metadata */
  metadata?: IPREMetadata;
}

/**
 * Metadata for the IPRE configuration
 */
export interface IPREMetadata {
  /** When the configuration was created */
  createdAt: string;
  /** When the configuration was last updated */
  updatedAt: string;
  /** Who created or last modified the configuration */
  author?: string;
  /** Description of the configuration */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
}
