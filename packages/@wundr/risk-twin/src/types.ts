/**
 * Risk Twin Type Definitions
 *
 * Core interfaces for the Risk Twin simulation engine that validates
 * governance changes through accelerated digital twin simulations.
 */

/**
 * Configuration for the Risk Twin simulation engine
 */
export interface RiskTwinConfig {
  /** Factor by which time is accelerated in simulation (e.g., 100x means 1 real hour = 100 simulated hours) */
  accelerationFactor: number;
  /** Number of days to simulate in the digital twin environment */
  simulatedDays: number;
  /** Delay in milliseconds before deploying to production after successful validation */
  productionDelay: number;
  /** Thresholds for determining divergence severity levels */
  divergenceThresholds: DivergenceThresholds;
}

/**
 * Thresholds for categorizing divergence severity
 */
export interface DivergenceThresholds {
  /** Maximum divergence percentage for green (safe) status */
  green: number;
  /** Maximum divergence percentage for yellow (caution) status */
  yellow: number;
  /** Any divergence above yellow threshold is considered red (danger) */
}

/**
 * Represents a governance change to be validated
 */
export interface GovernanceChange {
  /** Type of governance change (e.g., 'policy', 'rule', 'threshold', 'workflow') */
  type: GovernanceChangeType;
  /** Human-readable description of the change */
  description: string;
  /** The actual change payload containing configuration or rule data */
  payload: Record<string, unknown>;
  /** Author or system that initiated the change */
  author: string;
  /** ISO timestamp of when the change was created */
  timestamp: string;
}

/**
 * Types of governance changes supported by the system
 */
export type GovernanceChangeType =
  | 'policy'
  | 'rule'
  | 'threshold'
  | 'workflow'
  | 'permission'
  | 'configuration';

/**
 * Possible validation result statuses
 */
export type ValidationResult = 'green' | 'yellow' | 'red';

/**
 * Complete validation report from a Risk Twin simulation run
 */
export interface ValidationReport {
  /** Overall validation result status */
  result: ValidationResult;
  /** Detailed divergence metrics from the simulation */
  divergenceMetrics: DivergenceMetrics;
  /** Results from novelty detection analysis */
  noveltyDetection: NoveltyDetection;
  /** List of recommendations based on simulation results */
  recommendations: string[];
  /** Duration of the simulation in milliseconds */
  duration: number;
}

/**
 * Results from a complete simulation run
 */
export interface SimulationResult {
  /** Number of simulated days completed */
  days: number;
  /** Metrics collected during simulation */
  metrics: SimulationMetrics;
  /** Notable events that occurred during simulation */
  events: SimulationEvent[];
  /** Anomalies detected during simulation */
  anomalies: SimulationAnomaly[];
}

/**
 * Metrics collected during simulation
 */
export interface SimulationMetrics {
  /** Total number of transactions processed */
  totalTransactions: number;
  /** Number of successful operations */
  successfulOperations: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Peak resource utilization percentage */
  peakUtilization: number;
  /** Custom metrics collected during simulation */
  custom: Record<string, number>;
}

/**
 * An event that occurred during simulation
 */
export interface SimulationEvent {
  /** ISO timestamp of the event */
  timestamp: string;
  /** Type of event */
  type: string;
  /** Event description */
  description: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * An anomaly detected during simulation
 */
export interface SimulationAnomaly {
  /** ISO timestamp when anomaly was detected */
  timestamp: string;
  /** Type of anomaly */
  type: string;
  /** Anomaly description */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Affected components or systems */
  affectedComponents: string[];
}

/**
 * Metrics measuring divergence between twin and production
 */
export interface DivergenceMetrics {
  /** Overall confidence score (0-1) that results are reliable */
  confidence: number;
  /** Early deviation indicators detected in initial simulation phase */
  earlyDeviation: EarlyDeviationIndicator[];
  /** Statistical drift analysis results */
  statisticalDrift: StatisticalDrift;
}

/**
 * Early deviation indicator from simulation
 */
export interface EarlyDeviationIndicator {
  /** Name of the metric showing deviation */
  metric: string;
  /** Baseline value before change */
  baseline: number;
  /** Current value after change */
  current: number;
  /** Deviation percentage */
  deviationPercent: number;
  /** Whether this deviation is concerning */
  isConcerning: boolean;
}

/**
 * Statistical drift analysis
 */
export interface StatisticalDrift {
  /** Kolmogorov-Smirnov test statistic */
  ksStatistic: number;
  /** P-value from statistical test */
  pValue: number;
  /** Whether drift is statistically significant */
  isSignificant: boolean;
  /** Distribution comparison details */
  distributionComparison: DistributionComparison;
}

/**
 * Comparison between two distributions
 */
export interface DistributionComparison {
  /** Mean of baseline distribution */
  baselineMean: number;
  /** Mean of current distribution */
  currentMean: number;
  /** Standard deviation of baseline */
  baselineStdDev: number;
  /** Standard deviation of current */
  currentStdDev: number;
  /** Percentage change in mean */
  meanChange: number;
}

/**
 * Results from novelty detection analysis
 */
export interface NoveltyDetection {
  /** Whether novelty was detected */
  detected: boolean;
  /** Novelty score (0-1, higher = more novel) */
  score: number;
  /** Distribution analysis of detected patterns */
  distribution: NoveltyDistribution;
  /** Specific flags raised during detection */
  flags: NoveltyFlag[];
}

/**
 * Distribution of novelty across different dimensions
 */
export interface NoveltyDistribution {
  /** Percentage of normal/expected behavior */
  normal: number;
  /** Percentage of mildly novel behavior */
  mildlyNovel: number;
  /** Percentage of highly novel behavior */
  highlyNovel: number;
  /** Percentage of unprecedented behavior */
  unprecedented: number;
}

/**
 * A flag raised during novelty detection
 */
export interface NoveltyFlag {
  /** Name of the flag */
  name: string;
  /** Description of what triggered the flag */
  description: string;
  /** Severity level of the flag */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Related metrics or data points */
  relatedMetrics: string[];
}

/**
 * Plan for mitigating risks during deployment
 */
export interface MitigationPlan {
  /** Scope of the deployment (e.g., 'canary', 'staged', 'full') */
  deploymentScope: DeploymentScope;
  /** Requirements for human oversight during deployment */
  humanOversight: HumanOversightConfig;
  /** Configuration for rollback capabilities */
  rollbackCapability: RollbackCapability;
}

/**
 * Deployment scope configuration
 */
export interface DeploymentScope {
  /** Type of deployment strategy */
  type: 'canary' | 'staged' | 'blue-green' | 'full';
  /** Initial percentage of traffic or users */
  initialPercentage: number;
  /** Stages for gradual rollout */
  stages?: DeploymentStage[];
  /** Criteria for advancing between stages */
  advancementCriteria?: AdvancementCriteria;
}

/**
 * A stage in a staged deployment
 */
export interface DeploymentStage {
  /** Name of the stage */
  name: string;
  /** Percentage of traffic/users in this stage */
  percentage: number;
  /** Minimum duration in this stage (milliseconds) */
  minimumDuration: number;
  /** Success criteria for this stage */
  successCriteria: StageCriteria;
}

/**
 * Criteria for a deployment stage
 */
export interface StageCriteria {
  /** Maximum error rate allowed */
  maxErrorRate: number;
  /** Maximum latency increase allowed (percentage) */
  maxLatencyIncrease: number;
  /** Minimum success rate required */
  minSuccessRate: number;
}

/**
 * Criteria for advancing deployment stages
 */
export interface AdvancementCriteria {
  /** Required success rate to advance */
  successRate: number;
  /** Maximum allowed error rate to advance */
  errorRate: number;
  /** Minimum observation period before advancing (milliseconds) */
  observationPeriod: number;
}

/**
 * Configuration for human oversight during deployment
 */
export interface HumanOversightConfig {
  /** Whether human approval is required */
  required: boolean;
  /** Level of oversight required */
  level: 'none' | 'notification' | 'approval' | 'active-monitoring';
  /** Approvers who can authorize deployment */
  approvers?: string[];
  /** Whether automatic escalation is enabled */
  autoEscalation: boolean;
  /** Escalation timeout in milliseconds */
  escalationTimeout?: number;
}

/**
 * Configuration for rollback capabilities
 */
export interface RollbackCapability {
  /** Whether automatic rollback is enabled */
  automatic: boolean;
  /** Triggers that initiate automatic rollback */
  triggers: RollbackTrigger[];
  /** Maximum time window for rollback (milliseconds) */
  maxRollbackWindow: number;
  /** Whether state preservation is enabled during rollback */
  statePreservation: boolean;
}

/**
 * A trigger for automatic rollback
 */
export interface RollbackTrigger {
  /** Type of trigger */
  type: 'error-rate' | 'latency' | 'anomaly' | 'manual';
  /** Threshold value that triggers rollback */
  threshold: number;
  /** Duration the threshold must be exceeded (milliseconds) */
  duration: number;
  /** Whether this trigger is enabled */
  enabled: boolean;
}
