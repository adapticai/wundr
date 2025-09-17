/**
 * Security Scanning Types and Interfaces
 * Enterprise-grade security scanning system for vulnerability detection, static analysis, and code security
 *
 * @fileoverview Complete scanning type definitions for comprehensive security assessment
 * @author Security Types Specialist
 * @version 1.0.0
 */

import {
  SecurityId,
  SecurityTimestamp,
  SecurityContext,
  SecurityResult,
  SecurityError,
  SecuritySeverity,
  SecurityOperationStatus,
  SecurityHash,
  ComplianceFramework
} from './index';

/**
 * Scan types for different security assessments
 */
export enum ScanType {
  VULNERABILITY = 'vulnerability',
  STATIC_ANALYSIS = 'static_analysis',
  DYNAMIC_ANALYSIS = 'dynamic_analysis',
  DEPENDENCY = 'dependency',
  SECRET = 'secret',
  LICENSE = 'license',
  CONTAINER = 'container',
  INFRASTRUCTURE = 'infrastructure',
  WEB_APPLICATION = 'web_application',
  API_SECURITY = 'api_security',
  COMPLIANCE = 'compliance',
  PENETRATION_TEST = 'penetration_test',
  MALWARE = 'malware',
  CUSTOM = 'custom'
}

/**
 * Vulnerability severity levels (CVSS-based)
 */
export enum VulnerabilitySeverity {
  CRITICAL = 'critical', // CVSS 9.0-10.0
  HIGH = 'high',         // CVSS 7.0-8.9
  MEDIUM = 'medium',     // CVSS 4.0-6.9
  LOW = 'low',          // CVSS 0.1-3.9
  INFO = 'info'         // CVSS 0.0
}

/**
 * Vulnerability status
 */
export enum VulnerabilityStatus {
  OPEN = 'open',
  CONFIRMED = 'confirmed',
  FALSE_POSITIVE = 'false_positive',
  MITIGATED = 'mitigated',
  FIXED = 'fixed',
  ACCEPTED_RISK = 'accepted_risk',
  WONT_FIX = 'wont_fix',
  DUPLICATE = 'duplicate'
}

/**
 * Scan execution status
 */
export enum ScanExecutionStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  PARTIAL = 'partial'
}

/**
 * Base scan configuration interface
 */
export interface ScanConfiguration {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: ScanType;
  readonly enabled: boolean;
  readonly schedule?: ScanSchedule;
  readonly targets: readonly ScanTarget[];
  readonly rules: ScanRules;
  readonly reporting: ScanReporting;
  readonly integration: ScanIntegration;
  readonly metadata?: ScanConfigurationMetadata;
}

/**
 * Scan schedule configuration
 */
export interface ScanSchedule {
  readonly type: ScheduleType;
  readonly expression: string; // Cron expression or interval
  readonly timezone?: string;
  readonly enabled: boolean;
  readonly startDate?: SecurityTimestamp;
  readonly endDate?: SecurityTimestamp;
  readonly maxDuration?: number; // Maximum scan duration in milliseconds
}

/**
 * Schedule types
 */
export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  MANUAL = 'manual',
  TRIGGER_BASED = 'trigger_based'
}

/**
 * Scan target specification
 */
export interface ScanTarget {
  readonly id: SecurityId;
  readonly type: TargetType;
  readonly location: string; // URL, file path, container image, etc.
  readonly credentials?: TargetCredentials;
  readonly scope?: TargetScope;
  readonly excludes?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Target types for scanning
 */
export enum TargetType {
  CODEBASE = 'codebase',
  REPOSITORY = 'repository',
  CONTAINER_IMAGE = 'container_image',
  CONTAINER_REGISTRY = 'container_registry',
  WEB_APPLICATION = 'web_application',
  API_ENDPOINT = 'api_endpoint',
  NETWORK_RANGE = 'network_range',
  CLOUD_RESOURCE = 'cloud_resource',
  BINARY = 'binary',
  PACKAGE = 'package',
  CUSTOM = 'custom'
}

/**
 * Target credentials for authenticated scanning
 */
export interface TargetCredentials {
  readonly type: CredentialType;
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly apiKey?: string;
  readonly certificate?: string;
  readonly privateKey?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Credential types
 */
export enum CredentialType {
  BASIC_AUTH = 'basic_auth',
  TOKEN_AUTH = 'token_auth',
  API_KEY = 'api_key',
  OAUTH = 'oauth',
  JWT = 'jwt',
  CERTIFICATE = 'certificate',
  SSH_KEY = 'ssh_key',
  CLOUD_IAM = 'cloud_iam',
  CUSTOM = 'custom'
}

/**
 * Target scope definition
 */
export interface TargetScope {
  readonly depth?: number; // Scanning depth
  readonly followRedirects?: boolean;
  readonly includeSubdomains?: boolean;
  readonly fileTypes?: readonly string[];
  readonly pathPatterns?: readonly string[];
  readonly excludePatterns?: readonly string[];
  readonly maxSize?: number; // Maximum file/response size to scan
  readonly timeout?: number; // Timeout per target
}

/**
 * Scan rules configuration
 */
export interface ScanRules {
  readonly rulesets: readonly string[]; // Predefined rule sets
  readonly customRules?: readonly CustomScanRule[];
  readonly excludeRules?: readonly string[];
  readonly severity: VulnerabilitySeverity; // Minimum severity to report
  readonly compliance?: readonly ComplianceFramework[];
  readonly thresholds?: ScanThresholds;
}

/**
 * Custom scan rule definition
 */
export interface CustomScanRule {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly pattern: string; // Regex or other pattern
  readonly severity: VulnerabilitySeverity;
  readonly category: string;
  readonly cwe?: string; // CWE ID if applicable
  readonly enabled: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Scan thresholds for pass/fail criteria
 */
export interface ScanThresholds {
  readonly critical?: number;
  readonly high?: number;
  readonly medium?: number;
  readonly low?: number;
  readonly total?: number;
  readonly coverage?: number; // Percentage
  readonly quality?: number; // Quality score
}

/**
 * Scan reporting configuration
 */
export interface ScanReporting {
  readonly formats: readonly ReportFormat[];
  readonly destinations: readonly ReportDestination[];
  readonly template?: string;
  readonly includeSourceCode: boolean;
  readonly includeEvidence: boolean;
  readonly groupBy: GroupingMethod;
  readonly sortBy: SortingMethod;
  readonly filtering?: ReportFiltering;
}

/**
 * Report formats
 */
export enum ReportFormat {
  JSON = 'json',
  XML = 'xml',
  HTML = 'html',
  PDF = 'pdf',
  CSV = 'csv',
  SARIF = 'sarif', // Static Analysis Results Interchange Format
  JUNIT = 'junit',
  SONARQUBE = 'sonarqube',
  CUSTOM = 'custom'
}

/**
 * Report destinations
 */
export interface ReportDestination {
  readonly type: DestinationType;
  readonly location: string;
  readonly credentials?: TargetCredentials;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Destination types
 */
export enum DestinationType {
  FILE_SYSTEM = 'file_system',
  S3_BUCKET = 's3_bucket',
  HTTP_ENDPOINT = 'http_endpoint',
  EMAIL = 'email',
  SLACK = 'slack',
  JIRA = 'jira',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JENKINS = 'jenkins',
  CUSTOM = 'custom'
}

/**
 * Grouping methods for reports
 */
export enum GroupingMethod {
  SEVERITY = 'severity',
  CATEGORY = 'category',
  FILE = 'file',
  RULE = 'rule',
  CWE = 'cwe',
  OWASP = 'owasp',
  CUSTOM = 'custom'
}

/**
 * Sorting methods for reports
 */
export enum SortingMethod {
  SEVERITY_DESC = 'severity_desc',
  SEVERITY_ASC = 'severity_asc',
  FILE_ASC = 'file_asc',
  RULE_ASC = 'rule_asc',
  DATE_DESC = 'date_desc',
  CUSTOM = 'custom'
}

/**
 * Report filtering options
 */
export interface ReportFiltering {
  readonly severities?: readonly VulnerabilitySeverity[];
  readonly categories?: readonly string[];
  readonly statuses?: readonly VulnerabilityStatus[];
  readonly files?: readonly string[];
  readonly rules?: readonly string[];
  readonly customFilters?: Record<string, unknown>;
}

/**
 * Scan integration settings
 */
export interface ScanIntegration {
  readonly cicd?: CicdIntegration;
  readonly ide?: IdeIntegration;
  readonly ticketing?: TicketingIntegration;
  readonly monitoring?: MonitoringIntegration;
  readonly notifications?: NotificationIntegration;
}

/**
 * CI/CD integration configuration
 */
export interface CicdIntegration {
  readonly enabled: boolean;
  readonly breakBuild: boolean;
  readonly thresholds?: ScanThresholds;
  readonly commentOnPR: boolean;
  readonly blockMerge: boolean;
  readonly platforms: readonly CicdPlatform[];
}

/**
 * CI/CD platforms
 */
export enum CicdPlatform {
  GITHUB_ACTIONS = 'github_actions',
  GITLAB_CI = 'gitlab_ci',
  JENKINS = 'jenkins',
  AZURE_DEVOPS = 'azure_devops',
  CIRCLECI = 'circleci',
  TRAVIS_CI = 'travis_ci',
  BAMBOO = 'bamboo',
  CUSTOM = 'custom'
}

/**
 * IDE integration configuration
 */
export interface IdeIntegration {
  readonly enabled: boolean;
  readonly realTime: boolean;
  readonly onSave: boolean;
  readonly showInline: boolean;
  readonly supportedIdes: readonly string[];
}

/**
 * Ticketing integration configuration
 */
export interface TicketingIntegration {
  readonly enabled: boolean;
  readonly autoCreate: boolean;
  readonly autoAssign: boolean;
  readonly template: string;
  readonly severityMapping: Record<VulnerabilitySeverity, string>;
  readonly platforms: readonly TicketingPlatform[];
}

/**
 * Ticketing platforms
 */
export enum TicketingPlatform {
  JIRA = 'jira',
  GITHUB_ISSUES = 'github_issues',
  GITLAB_ISSUES = 'gitlab_issues',
  AZURE_BOARDS = 'azure_boards',
  SERVICENOW = 'servicenow',
  CUSTOM = 'custom'
}

/**
 * Monitoring integration configuration
 */
export interface MonitoringIntegration {
  readonly enabled: boolean;
  readonly metrics: boolean;
  readonly alerts: boolean;
  readonly platforms: readonly MonitoringPlatform[];
}

/**
 * Monitoring platforms
 */
export enum MonitoringPlatform {
  PROMETHEUS = 'prometheus',
  GRAFANA = 'grafana',
  DATADOG = 'datadog',
  NEW_RELIC = 'new_relic',
  SPLUNK = 'splunk',
  ELASTIC_STACK = 'elastic_stack',
  CUSTOM = 'custom'
}

/**
 * Notification integration configuration
 */
export interface NotificationIntegration {
  readonly enabled: boolean;
  readonly channels: readonly NotificationChannel[];
  readonly triggers: readonly NotificationTrigger[];
  readonly throttling?: NotificationThrottling;
}

/**
 * Notification channels
 */
export interface NotificationChannel {
  readonly type: NotificationChannelType;
  readonly destination: string;
  readonly template?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Notification channel types
 */
export enum NotificationChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  CUSTOM = 'custom'
}

/**
 * Notification triggers
 */
export enum NotificationTrigger {
  SCAN_STARTED = 'scan_started',
  SCAN_COMPLETED = 'scan_completed',
  SCAN_FAILED = 'scan_failed',
  CRITICAL_FOUND = 'critical_found',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  NEW_VULNERABILITY = 'new_vulnerability',
  CUSTOM = 'custom'
}

/**
 * Notification throttling configuration
 */
export interface NotificationThrottling {
  readonly enabled: boolean;
  readonly maxPerHour?: number;
  readonly maxPerDay?: number;
  readonly deduplicate: boolean;
  readonly cooldownMinutes?: number;
}

/**
 * Scan configuration metadata
 */
export interface ScanConfigurationMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly version: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly owner?: SecurityId;
  readonly approval?: ApprovalInfo;
}

/**
 * Approval information for scan configurations
 */
export interface ApprovalInfo {
  readonly required: boolean;
  readonly approvedBy?: SecurityId;
  readonly approvedAt?: SecurityTimestamp;
  readonly approvalNotes?: string;
  readonly expiresAt?: SecurityTimestamp;
}

/**
 * Scan execution interface
 */
export interface ScanExecution {
  readonly id: SecurityId;
  readonly configurationId: SecurityId;
  readonly status: ScanExecutionStatus;
  readonly trigger: ScanTrigger;
  readonly startTime: SecurityTimestamp;
  readonly endTime?: SecurityTimestamp;
  readonly duration?: number; // milliseconds
  readonly progress: ScanProgress;
  readonly results?: ScanResults;
  readonly metrics: ScanMetrics;
  readonly logs: readonly ScanLogEntry[];
  readonly metadata?: ScanExecutionMetadata;
}

/**
 * Scan trigger information
 */
export interface ScanTrigger {
  readonly type: TriggerType;
  readonly source: string;
  readonly reason?: string;
  readonly triggeredBy?: SecurityId;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Trigger types
 */
export enum TriggerType {
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  API = 'api',
  WEBHOOK = 'webhook',
  CI_CD = 'ci_cd',
  FILE_CHANGE = 'file_change',
  THRESHOLD = 'threshold',
  CUSTOM = 'custom'
}

/**
 * Scan progress tracking
 */
export interface ScanProgress {
  readonly percentage: number; // 0-100
  readonly currentPhase: string;
  readonly phasesCompleted: number;
  readonly totalPhases: number;
  readonly targetsScanned: number;
  readonly totalTargets: number;
  readonly estimatedTimeRemaining?: number; // milliseconds
  readonly details?: ProgressDetails;
}

/**
 * Detailed progress information
 */
export interface ProgressDetails {
  readonly currentTarget?: string;
  readonly currentRule?: string;
  readonly itemsProcessed: number;
  readonly totalItems: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly customMetrics?: Record<string, number>;
}

/**
 * Scan results interface
 */
export interface ScanResults {
  readonly summary: ScanSummary;
  readonly vulnerabilities: readonly Vulnerability[];
  readonly findings: readonly SecurityFinding[];
  readonly metrics: ResultMetrics;
  readonly coverage: CoverageMetrics;
  readonly recommendations: readonly SecurityRecommendation[];
  readonly baseline?: BaselineComparison;
  readonly compliance?: ComplianceResults;
}

/**
 * Scan summary statistics
 */
export interface ScanSummary {
  readonly totalFindings: number;
  readonly bySeverity: Record<VulnerabilitySeverity, number>;
  readonly byCategory: Record<string, number>;
  readonly byStatus: Record<VulnerabilityStatus, number>;
  readonly newFindings: number;
  readonly fixedFindings: number;
  readonly falsePositives: number;
  readonly riskScore: number; // 0-100
  readonly qualityGate: QualityGateResult;
}

/**
 * Quality gate result
 */
export interface QualityGateResult {
  readonly passed: boolean;
  readonly conditions: readonly QualityCondition[];
  readonly score: number;
  readonly threshold: number;
}

/**
 * Quality gate condition
 */
export interface QualityCondition {
  readonly name: string;
  readonly operator: ComparisonOperator;
  readonly threshold: number;
  readonly actualValue: number;
  readonly passed: boolean;
  readonly severity: VulnerabilitySeverity;
}

/**
 * Comparison operators for quality gates
 */
export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal'
}

/**
 * Vulnerability interface
 */
export interface Vulnerability {
  readonly id: SecurityId;
  readonly title: string;
  readonly description: string;
  readonly severity: VulnerabilitySeverity;
  readonly status: VulnerabilityStatus;
  readonly category: string;
  readonly cwe?: string;
  readonly owasp?: string;
  readonly cvss?: CvssVector;
  readonly location: VulnerabilityLocation;
  readonly evidence: VulnerabilityEvidence;
  readonly impact: ImpactAssessment;
  readonly remediation: RemediationGuidance;
  readonly references: readonly Reference[];
  readonly timeline: VulnerabilityTimeline;
  readonly metadata?: VulnerabilityMetadata;
}

/**
 * CVSS vector information
 */
export interface CvssVector {
  readonly version: '3.1' | '3.0' | '2.0';
  readonly vector: string;
  readonly baseScore: number;
  readonly temporalScore?: number;
  readonly environmentalScore?: number;
  readonly exploitabilityScore: number;
  readonly impactScore: number;
  readonly metrics: CvssMetrics;
}

/**
 * CVSS metrics breakdown
 */
export interface CvssMetrics {
  readonly attackVector: string;
  readonly attackComplexity: string;
  readonly privilegesRequired: string;
  readonly userInteraction: string;
  readonly scope: string;
  readonly confidentialityImpact: string;
  readonly integrityImpact: string;
  readonly availabilityImpact: string;
  readonly exploitCodeMaturity?: string;
  readonly remediationLevel?: string;
  readonly reportConfidence?: string;
}

/**
 * Vulnerability location information
 */
export interface VulnerabilityLocation {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly function?: string;
  readonly component?: string;
  readonly url?: string;
  readonly parameter?: string;
  readonly method?: string;
  readonly xpath?: string;
  readonly snippet?: CodeSnippet;
}

/**
 * Code snippet for context
 */
export interface CodeSnippet {
  readonly startLine: number;
  readonly endLine: number;
  readonly code: string;
  readonly language: string;
}

/**
 * Vulnerability evidence
 */
export interface VulnerabilityEvidence {
  readonly request?: HttpRequest;
  readonly response?: HttpResponse;
  readonly proof?: ProofOfConcept;
  readonly screenshots?: readonly string[]; // Base64 encoded images
  readonly logs?: readonly string[];
  readonly payloads?: readonly string[];
  readonly customEvidence?: Record<string, unknown>;
}

/**
 * HTTP request information
 */
export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly parameters?: Record<string, string>;
}

/**
 * HTTP response information
 */
export interface HttpResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly size: number;
  readonly time: number; // milliseconds
}

/**
 * Proof of concept information
 */
export interface ProofOfConcept {
  readonly steps: readonly string[];
  readonly payload: string;
  readonly expectedResult: string;
  readonly actualResult: string;
  readonly reproducible: boolean;
  readonly automation?: AutomationInfo;
}

/**
 * Automation information for PoC
 */
export interface AutomationInfo {
  readonly possible: boolean;
  readonly script?: string;
  readonly language?: string;
  readonly requirements?: readonly string[];
}

/**
 * Impact assessment
 */
export interface ImpactAssessment {
  readonly confidentiality: ImpactLevel;
  readonly integrity: ImpactLevel;
  readonly availability: ImpactLevel;
  readonly overall: ImpactLevel;
  readonly businessImpact: BusinessImpact;
  readonly technicalImpact: TechnicalImpact;
  readonly likelihood: LikelihoodLevel;
  readonly riskRating: RiskRating;
}

/**
 * Impact levels
 */
export enum ImpactLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Business impact assessment
 */
export interface BusinessImpact {
  readonly revenue: ImpactLevel;
  readonly reputation: ImpactLevel;
  readonly compliance: ImpactLevel;
  readonly operations: ImpactLevel;
  readonly customerTrust: ImpactLevel;
  readonly competitiveAdvantage: ImpactLevel;
}

/**
 * Technical impact assessment
 */
export interface TechnicalImpact {
  readonly dataLoss: ImpactLevel;
  readonly systemAvailability: ImpactLevel;
  readonly performanceDegradation: ImpactLevel;
  readonly escalationPotential: ImpactLevel;
  readonly networkCompromise: ImpactLevel;
  readonly dataCorruption: ImpactLevel;
}

/**
 * Likelihood levels
 */
export enum LikelihoodLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Risk rating
 */
export interface RiskRating {
  readonly level: RiskLevel;
  readonly score: number; // 0-100
  readonly factors: readonly RiskFactor[];
  readonly mitigation: MitigationStrategy;
}

/**
 * Risk levels
 */
export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

/**
 * Risk factors
 */
export interface RiskFactor {
  readonly type: RiskFactorType;
  readonly weight: number; // 0-1
  readonly description: string;
  readonly evidence?: string;
}

/**
 * Risk factor types
 */
export enum RiskFactorType {
  EXPLOIT_AVAILABLE = 'exploit_available',
  PUBLIC_DISCLOSURE = 'public_disclosure',
  NETWORK_ACCESSIBLE = 'network_accessible',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXPOSURE = 'data_exposure',
  AUTHENTICATION_BYPASS = 'authentication_bypass',
  AUTOMATED_EXPLOITATION = 'automated_exploitation',
  WIDESPREAD_IMPACT = 'widespread_impact'
}

/**
 * Mitigation strategy
 */
export interface MitigationStrategy {
  readonly primary: readonly string[];
  readonly alternative: readonly string[];
  readonly compensating: readonly string[];
  readonly priority: MitigationPriority;
  readonly timeline: MitigationTimeline;
}

/**
 * Mitigation priorities
 */
export enum MitigationPriority {
  IMMEDIATE = 'immediate',
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Mitigation timeline
 */
export interface MitigationTimeline {
  readonly immediate: readonly string[]; // 0-24 hours
  readonly shortTerm: readonly string[]; // 1-7 days
  readonly mediumTerm: readonly string[]; // 1-4 weeks
  readonly longTerm: readonly string[]; // 1+ months
}

/**
 * Remediation guidance
 */
export interface RemediationGuidance {
  readonly summary: string;
  readonly steps: readonly RemediationStep[];
  readonly codeExamples?: readonly CodeExample[];
  readonly tools?: readonly RecommendedTool[];
  readonly effort: EffortEstimate;
  readonly validation: ValidationGuidance;
  readonly resources: readonly Reference[];
}

/**
 * Remediation step
 */
export interface RemediationStep {
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly code?: string;
  readonly language?: string;
  readonly automation?: boolean;
  readonly verification: string;
}

/**
 * Code example for remediation
 */
export interface CodeExample {
  readonly title: string;
  readonly language: string;
  readonly before: string;
  readonly after: string;
  readonly explanation: string;
}

/**
 * Recommended tool
 */
export interface RecommendedTool {
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly url?: string;
  readonly commercial: boolean;
  readonly integration?: boolean;
}

/**
 * Effort estimate for remediation
 */
export interface EffortEstimate {
  readonly developer: EffortLevel;
  readonly testing: EffortLevel;
  readonly deployment: EffortLevel;
  readonly overall: EffortLevel;
  readonly complexity: ComplexityLevel;
  readonly skillLevel: SkillLevel;
}

/**
 * Effort levels
 */
export enum EffortLevel {
  MINIMAL = 'minimal',   // < 1 hour
  LOW = 'low',          // 1-4 hours
  MEDIUM = 'medium',    // 1-2 days
  HIGH = 'high',        // 3-5 days
  VERY_HIGH = 'very_high' // > 1 week
}

/**
 * Complexity levels
 */
export enum ComplexityLevel {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

/**
 * Skill levels required
 */
export enum SkillLevel {
  JUNIOR = 'junior',
  INTERMEDIATE = 'intermediate',
  SENIOR = 'senior',
  EXPERT = 'expert',
  SPECIALIST = 'specialist'
}

/**
 * Validation guidance
 */
export interface ValidationGuidance {
  readonly manual: readonly string[];
  readonly automated: readonly string[];
  readonly testCases: readonly TestCase[];
  readonly tools: readonly string[];
}

/**
 * Test case for validation
 */
export interface TestCase {
  readonly name: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly expected: string;
  readonly automation?: string;
}

/**
 * Reference information
 */
export interface Reference {
  readonly title: string;
  readonly url: string;
  readonly type: ReferenceType;
  readonly description?: string;
  readonly relevance: RelevanceLevel;
}

/**
 * Reference types
 */
export enum ReferenceType {
  CVE = 'cve',
  CWE = 'cwe',
  OWASP = 'owasp',
  NIST = 'nist',
  ADVISORY = 'advisory',
  BLOG_POST = 'blog_post',
  DOCUMENTATION = 'documentation',
  TOOL = 'tool',
  PAPER = 'paper',
  EXPLOIT = 'exploit',
  CUSTOM = 'custom'
}

/**
 * Relevance levels
 */
export enum RelevanceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  REFERENCE_ONLY = 'reference_only'
}

/**
 * Vulnerability timeline
 */
export interface VulnerabilityTimeline {
  readonly discovered: SecurityTimestamp;
  readonly reported?: SecurityTimestamp;
  readonly acknowledged?: SecurityTimestamp;
  readonly fixed?: SecurityTimestamp;
  readonly verified?: SecurityTimestamp;
  readonly closed?: SecurityTimestamp;
  readonly milestones: readonly TimelineMilestone[];
}

/**
 * Timeline milestone
 */
export interface TimelineMilestone {
  readonly timestamp: SecurityTimestamp;
  readonly event: string;
  readonly actor: SecurityId;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Vulnerability metadata
 */
export interface VulnerabilityMetadata {
  readonly discoveredBy: SecurityId;
  readonly assignedTo?: SecurityId;
  readonly tags: readonly string[];
  readonly customFields?: Record<string, unknown>;
  readonly externalId?: string;
  readonly parentId?: SecurityId;
  readonly children?: readonly SecurityId[];
  readonly duplicates?: readonly SecurityId[];
}

/**
 * Type guards for scanning types
 */
export const isScanConfiguration = (value: unknown): value is ScanConfiguration => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'targets' in value &&
    Object.values(ScanType).includes((value as ScanConfiguration).type)
  );
};

export const isScanExecution = (value: unknown): value is ScanExecution => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'configurationId' in value &&
    'status' in value &&
    'startTime' in value &&
    Object.values(ScanExecutionStatus).includes((value as ScanExecution).status)
  );
};

export const isVulnerability = (value: unknown): value is Vulnerability => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'severity' in value &&
    'status' in value &&
    Object.values(VulnerabilitySeverity).includes((value as Vulnerability).severity) &&
    Object.values(VulnerabilityStatus).includes((value as Vulnerability).status)
  );
};

export const isScanResults = (value: unknown): value is ScanResults => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'summary' in value &&
    'vulnerabilities' in value &&
    'findings' in value &&
    Array.isArray((value as ScanResults).vulnerabilities)
  );
};

/**
 * Additional scanning-specific interfaces
 */
export interface SecurityFinding {
  readonly id: SecurityId;
  readonly type: FindingType;
  readonly title: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
  readonly confidence: ConfidenceLevel;
  readonly location: VulnerabilityLocation;
  readonly evidence?: VulnerabilityEvidence;
  readonly recommendation?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Finding types
 */
export enum FindingType {
  VULNERABILITY = 'vulnerability',
  CODE_QUALITY = 'code_quality',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability',
  SECURITY_HOTSPOT = 'security_hotspot',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  CONFIGURATION_ISSUE = 'configuration_issue',
  DEPENDENCY_ISSUE = 'dependency_issue',
  CUSTOM = 'custom'
}

/**
 * Confidence levels
 */
export enum ConfidenceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

/**
 * Result metrics
 */
export interface ResultMetrics {
  readonly executionTime: number; // milliseconds
  readonly targetsScanned: number;
  readonly filesScanned: number;
  readonly linesScanned: number;
  readonly rulesExecuted: number;
  readonly cacheHitRate: number; // 0-1
  readonly errorRate: number; // 0-1
  readonly throughput: ThroughputMetrics;
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
  readonly filesPerSecond: number;
  readonly linesPerSecond: number;
  readonly rulesPerSecond: number;
  readonly vulnerabilitiesPerSecond: number;
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  readonly codeExecution: number; // 0-100 percentage
  readonly pathCoverage: number; // 0-100 percentage
  readonly ruleCoverage: number; // 0-100 percentage
  readonly apiCoverage?: number; // 0-100 percentage
  readonly functionalCoverage?: number; // 0-100 percentage
  readonly details?: CoverageDetails;
}

/**
 * Coverage details
 */
export interface CoverageDetails {
  readonly uncoveredFiles: readonly string[];
  readonly uncoveredFunctions: readonly string[];
  readonly uncoveredBranches: readonly string[];
  readonly recommendations: readonly string[];
}

/**
 * Security recommendation
 */
export interface SecurityRecommendation {
  readonly id: SecurityId;
  readonly category: RecommendationCategory;
  readonly priority: RecommendationPriority;
  readonly title: string;
  readonly description: string;
  readonly impact: ImpactLevel;
  readonly effort: EffortLevel;
  readonly implementation: ImplementationGuidance;
  readonly benefits: readonly string[];
  readonly risks: readonly string[];
}

/**
 * Recommendation categories
 */
export enum RecommendationCategory {
  ARCHITECTURE = 'architecture',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_PROTECTION = 'data_protection',
  INPUT_VALIDATION = 'input_validation',
  OUTPUT_ENCODING = 'output_encoding',
  ERROR_HANDLING = 'error_handling',
  LOGGING = 'logging',
  MONITORING = 'monitoring',
  CONFIGURATION = 'configuration',
  DEPENDENCIES = 'dependencies',
  CUSTOM = 'custom'
}

/**
 * Recommendation priorities
 */
export enum RecommendationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFORMATIONAL = 'informational'
}

/**
 * Implementation guidance
 */
export interface ImplementationGuidance {
  readonly phases: readonly ImplementationPhase[];
  readonly timeline: string;
  readonly resources: readonly RequiredResource[];
  readonly dependencies: readonly string[];
  readonly risks: readonly ImplementationRisk[];
}

/**
 * Implementation phase
 */
export interface ImplementationPhase {
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly duration: string;
  readonly deliverables: readonly string[];
  readonly validation: readonly string[];
}

/**
 * Required resource
 */
export interface RequiredResource {
  readonly type: ResourceType;
  readonly description: string;
  readonly skillLevel: SkillLevel;
  readonly timeCommitment: string;
  readonly cost?: string;
}

/**
 * Implementation risk
 */
export interface ImplementationRisk {
  readonly description: string;
  readonly probability: LikelihoodLevel;
  readonly impact: ImpactLevel;
  readonly mitigation: string;
}

/**
 * Baseline comparison for tracking improvements/regressions
 */
export interface BaselineComparison {
  readonly baselineId: SecurityId;
  readonly baselineDate: SecurityTimestamp;
  readonly changes: BaselineChanges;
  readonly trends: BaselineTrends;
  readonly recommendations: readonly string[];
}

/**
 * Baseline changes
 */
export interface BaselineChanges {
  readonly newVulnerabilities: number;
  readonly fixedVulnerabilities: number;
  readonly regressions: number;
  readonly improvements: number;
  readonly severityChanges: Record<VulnerabilitySeverity, number>;
  readonly categoryChanges: Record<string, number>;
}

/**
 * Baseline trends
 */
export interface BaselineTrends {
  readonly riskScore: TrendDirection;
  readonly vulnerabilityCount: TrendDirection;
  readonly averageSeverity: TrendDirection;
  readonly coverage: TrendDirection;
  readonly qualityGate: TrendDirection;
}

/**
 * Trend directions
 */
export enum TrendDirection {
  IMPROVING = 'improving',
  STABLE = 'stable',
  DEGRADING = 'degrading',
  UNKNOWN = 'unknown'
}

/**
 * Compliance results
 */
export interface ComplianceResults {
  readonly frameworks: readonly ComplianceFrameworkResult[];
  readonly overallScore: number; // 0-100
  readonly status: ComplianceStatus;
  readonly violations: readonly ComplianceViolation[];
  readonly recommendations: readonly ComplianceRecommendation[];
}

/**
 * Compliance framework result
 */
export interface ComplianceFrameworkResult {
  readonly framework: ComplianceFramework;
  readonly version: string;
  readonly score: number; // 0-100
  readonly status: ComplianceStatus;
  readonly controls: readonly ControlResult[];
  readonly lastAssessment: SecurityTimestamp;
}

/**
 * Compliance status
 */
export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NOT_ASSESSED = 'not_assessed',
  NOT_APPLICABLE = 'not_applicable'
}

/**
 * Control result
 */
export interface ControlResult {
  readonly id: string;
  readonly name: string;
  readonly status: ComplianceStatus;
  readonly score: number; // 0-100
  readonly findings: readonly string[];
  readonly evidence: readonly string[];
  readonly gaps: readonly string[];
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  readonly framework: ComplianceFramework;
  readonly control: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
  readonly findings: readonly SecurityId[];
  readonly remediation: string;
  readonly dueDate?: SecurityTimestamp;
}

/**
 * Compliance recommendation
 */
export interface ComplianceRecommendation {
  readonly framework: ComplianceFramework;
  readonly control?: string;
  readonly priority: RecommendationPriority;
  readonly description: string;
  readonly implementation: string;
  readonly timeline: string;
  readonly effort: EffortLevel;
  readonly benefits: readonly string[];
}

/**
 * Scan metrics
 */
export interface ScanMetrics {
  readonly performance: PerformanceMetrics;
  readonly quality: QualityMetrics;
  readonly resource: ResourceMetrics;
  readonly error: ErrorMetrics;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly executionTime: number;
  readonly throughput: ThroughputMetrics;
  readonly latency: LatencyMetrics;
  readonly efficiency: EfficiencyMetrics;
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  readonly average: number;
  readonly median: number;
  readonly p95: number;
  readonly p99: number;
  readonly maximum: number;
}

/**
 * Efficiency metrics
 */
export interface EfficiencyMetrics {
  readonly cpuUtilization: number; // 0-100 percentage
  readonly memoryUtilization: number; // 0-100 percentage
  readonly diskUtilization: number; // 0-100 percentage
  readonly networkUtilization: number; // 0-100 percentage
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  readonly accuracy: number; // 0-100 percentage
  readonly precision: number; // 0-100 percentage
  readonly recall: number; // 0-100 percentage
  readonly f1Score: number; // 0-1
  readonly falsePositiveRate: number; // 0-1
  readonly falseNegativeRate: number; // 0-1
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  readonly cpuTime: number; // milliseconds
  readonly memoryUsage: number; // bytes
  readonly diskUsage: number; // bytes
  readonly networkTraffic: number; // bytes
  readonly parallelism: number; // concurrent workers
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  readonly totalErrors: number;
  readonly errorRate: number; // 0-1
  readonly byCategory: Record<string, number>;
  readonly bySeverity: Record<SecuritySeverity, number>;
  readonly retryCount: number;
  readonly timeouts: number;
}

/**
 * Scan log entry
 */
export interface ScanLogEntry {
  readonly timestamp: SecurityTimestamp;
  readonly level: LogLevel;
  readonly message: string;
  readonly component?: string;
  readonly phase?: string;
  readonly target?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Scan execution metadata
 */
export interface ScanExecutionMetadata {
  readonly version: string;
  readonly environment: string;
  readonly configuration: Record<string, unknown>;
  readonly resources: ResourceAllocation;
  readonly dependencies: readonly string[];
  readonly customMetadata?: Record<string, unknown>;
}

/**
 * Resource allocation
 */
export interface ResourceAllocation {
  readonly cpu: number; // cores
  readonly memory: number; // bytes
  readonly disk: number; // bytes
  readonly network: number; // bandwidth in bytes/sec
  readonly timeout: number; // milliseconds
}