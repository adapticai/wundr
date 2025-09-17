/**
 * Compliance and Policy Enforcement Types
 * Enterprise-grade compliance management for regulatory frameworks and policy enforcement
 *
 * @fileoverview Complete compliance type definitions for regulatory adherence and policy management
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
  SecurityAttributeValue,
  ComplianceFramework
} from './index';

/**
 * Compliance status levels
 */
export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  IN_PROGRESS = 'in_progress',
  NOT_ASSESSED = 'not_assessed',
  NOT_APPLICABLE = 'not_applicable',
  REQUIRES_REVIEW = 'requires_review',
  PENDING_APPROVAL = 'pending_approval'
}

/**
 * Compliance assessment types
 */
export enum AssessmentType {
  SELF_ASSESSMENT = 'self_assessment',
  INTERNAL_AUDIT = 'internal_audit',
  EXTERNAL_AUDIT = 'external_audit',
  PENETRATION_TEST = 'penetration_test',
  VULNERABILITY_ASSESSMENT = 'vulnerability_assessment',
  COMPLIANCE_SCAN = 'compliance_scan',
  MANUAL_REVIEW = 'manual_review',
  AUTOMATED_CHECK = 'automated_check',
  THIRD_PARTY_ASSESSMENT = 'third_party_assessment'
}

/**
 * Evidence types for compliance
 */
export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG_FILE = 'log_file',
  CONFIGURATION = 'configuration',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  TRAINING_RECORD = 'training_record',
  CERTIFICATE = 'certificate',
  ATTESTATION = 'attestation',
  TEST_RESULT = 'test_result',
  INTERVIEW_NOTES = 'interview_notes',
  CUSTOM = 'custom'
}

/**
 * Control types for compliance frameworks
 */
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
  ADMINISTRATIVE = 'administrative',
  TECHNICAL = 'technical',
  PHYSICAL = 'physical',
  PROCESS = 'process'
}

/**
 * Control maturity levels
 */
export enum ControlMaturity {
  INITIAL = 'initial',        // Ad-hoc, chaotic
  MANAGED = 'managed',        // Reactive, basic processes
  DEFINED = 'defined',        // Proactive, documented processes
  QUANTITATIVE = 'quantitative', // Measured, controlled
  OPTIMIZED = 'optimized'     // Focus on continuous improvement
}

/**
 * Risk levels for compliance
 */
export enum ComplianceRisk {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

/**
 * Compliance framework definition
 */
export interface ComplianceFrameworkDefinition {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: ComplianceFramework;
  readonly version: string;
  readonly description: string;
  readonly authority: string; // Regulatory body or organization
  readonly jurisdiction: readonly string[]; // Countries/regions where applicable
  readonly industry: readonly string[]; // Applicable industries
  readonly scope: FrameworkScope;
  readonly domains: readonly ComplianceDomain[];
  readonly controls: readonly ComplianceControl[];
  readonly requirements: readonly ComplianceRequirement[];
  readonly assessment: AssessmentRequirements;
  readonly reporting: ReportingRequirements;
  readonly certification: CertificationRequirements;
  readonly metadata: FrameworkMetadata;
}

/**
 * Framework scope definition
 */
export interface FrameworkScope {
  readonly dataTypes: readonly DataType[];
  readonly systemTypes: readonly SystemType[];
  readonly businessProcesses: readonly string[];
  readonly geographicScope: readonly string[];
  readonly organizationalScope: readonly string[];
  readonly exclusions?: readonly string[];
  readonly inclusions?: readonly string[];
}

/**
 * Data types for compliance scope
 */
export enum DataType {
  PERSONAL_DATA = 'personal_data',
  SENSITIVE_DATA = 'sensitive_data',
  FINANCIAL_DATA = 'financial_data',
  HEALTH_DATA = 'health_data',
  PAYMENT_DATA = 'payment_data',
  INTELLECTUAL_PROPERTY = 'intellectual_property',
  CONFIDENTIAL_DATA = 'confidential_data',
  PUBLIC_DATA = 'public_data'
}

/**
 * System types for compliance scope
 */
export enum SystemType {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  STAGING = 'staging',
  BACKUP = 'backup',
  ARCHIVE = 'archive',
  CLOUD = 'cloud',
  ON_PREMISE = 'on_premise',
  HYBRID = 'hybrid',
  MOBILE = 'mobile',
  WEB = 'web',
  DATABASE = 'database',
  NETWORK = 'network'
}

/**
 * Compliance domain (high-level categories)
 */
export interface ComplianceDomain {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly weight: number; // Importance weight for scoring
  readonly controls: readonly SecurityId[];
  readonly requirements: readonly SecurityId[];
  readonly dependencies: readonly SecurityId[]; // Other domains this depends on
  readonly maturity: DomainMaturity;
}

/**
 * Domain maturity assessment
 */
export interface DomainMaturity {
  readonly current: ControlMaturity;
  readonly target: ControlMaturity;
  readonly gap: MaturityGap;
  readonly roadmap: MaturityRoadmap;
}

/**
 * Maturity gap analysis
 */
export interface MaturityGap {
  readonly areas: readonly string[];
  readonly impact: SecuritySeverity;
  readonly effort: ImplementationEffort;
  readonly timeline: string;
  readonly dependencies: readonly string[];
}

/**
 * Implementation effort levels
 */
export enum ImplementationEffort {
  MINIMAL = 'minimal',     // < 1 week
  LOW = 'low',            // 1-4 weeks
  MEDIUM = 'medium',      // 1-3 months
  HIGH = 'high',          // 3-6 months
  VERY_HIGH = 'very_high' // > 6 months
}

/**
 * Maturity roadmap
 */
export interface MaturityRoadmap {
  readonly phases: readonly MaturityPhase[];
  readonly timeline: string;
  readonly resources: readonly RequiredResource[];
  readonly risks: readonly ImplementationRisk[];
  readonly success: SuccessCriteria;
}

/**
 * Maturity phase
 */
export interface MaturityPhase {
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly duration: string;
  readonly deliverables: readonly string[];
  readonly validation: readonly string[];
  readonly dependencies: readonly string[];
}

/**
 * Required resource for implementation
 */
export interface RequiredResource {
  readonly type: ResourceType;
  readonly role: string;
  readonly skillLevel: SkillLevel;
  readonly timeCommitment: string;
  readonly cost?: string;
  readonly external?: boolean;
}

/**
 * Resource types
 */
export enum ResourceType {
  HUMAN = 'human',
  TECHNOLOGY = 'technology',
  TRAINING = 'training',
  CONSULTING = 'consulting',
  TOOLS = 'tools',
  INFRASTRUCTURE = 'infrastructure',
  BUDGET = 'budget'
}

/**
 * Skill levels
 */
export enum SkillLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
  SPECIALIST = 'specialist'
}

/**
 * Implementation risk
 */
export interface ImplementationRisk {
  readonly id: SecurityId;
  readonly description: string;
  readonly category: RiskCategory;
  readonly probability: Probability;
  readonly impact: ImpactLevel;
  readonly risk: ComplianceRisk;
  readonly mitigation: RiskMitigation;
  readonly owner: SecurityId;
}

/**
 * Risk categories
 */
export enum RiskCategory {
  TECHNICAL = 'technical',
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  REGULATORY = 'regulatory',
  REPUTATIONAL = 'reputational',
  STRATEGIC = 'strategic',
  COMPLIANCE = 'compliance'
}

/**
 * Probability levels
 */
export enum Probability {
  VERY_LOW = 'very_low',   // < 10%
  LOW = 'low',            // 10-30%
  MEDIUM = 'medium',      // 30-70%
  HIGH = 'high',          // 70-90%
  VERY_HIGH = 'very_high' // > 90%
}

/**
 * Impact levels
 */
export enum ImpactLevel {
  NEGLIGIBLE = 'negligible',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  SEVERE = 'severe',
  CATASTROPHIC = 'catastrophic'
}

/**
 * Risk mitigation strategy
 */
export interface RiskMitigation {
  readonly strategy: MitigationStrategy;
  readonly actions: readonly MitigationAction[];
  readonly timeline: string;
  readonly cost?: string;
  readonly effectiveness: number; // 0-100 percentage
  readonly residualRisk: ComplianceRisk;
}

/**
 * Mitigation strategies
 */
export enum MitigationStrategy {
  AVOID = 'avoid',       // Eliminate the risk
  MITIGATE = 'mitigate', // Reduce probability or impact
  TRANSFER = 'transfer',  // Insurance or third-party
  ACCEPT = 'accept',     // Accept the risk
  MONITOR = 'monitor'    // Watch and respond
}

/**
 * Mitigation action
 */
export interface MitigationAction {
  readonly id: SecurityId;
  readonly description: string;
  readonly type: ActionType;
  readonly owner: SecurityId;
  readonly dueDate: SecurityTimestamp;
  readonly status: ActionStatus;
  readonly progress: number; // 0-100 percentage
}

/**
 * Action types
 */
export enum ActionType {
  POLICY = 'policy',
  PROCESS = 'process',
  TECHNOLOGY = 'technology',
  TRAINING = 'training',
  ASSESSMENT = 'assessment',
  MONITORING = 'monitoring',
  DOCUMENTATION = 'documentation',
  COMMUNICATION = 'communication'
}

/**
 * Action status
 */
export enum ActionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold'
}

/**
 * Success criteria
 */
export interface SuccessCriteria {
  readonly metrics: readonly SuccessMetric[];
  readonly targets: readonly SuccessTarget[];
  readonly validation: ValidationMethod;
  readonly timeline: string;
}

/**
 * Success metric
 */
export interface SuccessMetric {
  readonly name: string;
  readonly description: string;
  readonly measurement: MeasurementMethod;
  readonly frequency: MeasurementFrequency;
  readonly baseline?: number;
  readonly target: number;
  readonly threshold: number;
}

/**
 * Measurement methods
 */
export enum MeasurementMethod {
  QUANTITATIVE = 'quantitative',
  QUALITATIVE = 'qualitative',
  BINARY = 'binary',
  PERCENTAGE = 'percentage',
  COUNT = 'count',
  RATING = 'rating',
  CUSTOM = 'custom'
}

/**
 * Measurement frequency
 */
export enum MeasurementFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  ON_DEMAND = 'on_demand'
}

/**
 * Success target
 */
export interface SuccessTarget {
  readonly metric: string;
  readonly target: number;
  readonly timeframe: string;
  readonly criticality: TargetCriticality;
}

/**
 * Target criticality levels
 */
export enum TargetCriticality {
  MUST_HAVE = 'must_have',
  SHOULD_HAVE = 'should_have',
  NICE_TO_HAVE = 'nice_to_have',
  OPTIONAL = 'optional'
}

/**
 * Validation methods
 */
export enum ValidationMethod {
  AUTOMATED_TEST = 'automated_test',
  MANUAL_REVIEW = 'manual_review',
  AUDIT = 'audit',
  ASSESSMENT = 'assessment',
  CERTIFICATION = 'certification',
  ATTESTATION = 'attestation',
  THIRD_PARTY = 'third_party'
}

/**
 * Compliance control definition
 */
export interface ComplianceControl {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly type: ControlType;
  readonly category: string;
  readonly domain: SecurityId;
  readonly framework: ComplianceFramework;
  readonly version: string;
  readonly mandatory: boolean;
  readonly automated: boolean;
  readonly frequency: AssessmentFrequency;
  readonly maturity: ControlMaturity;
  readonly implementation: ControlImplementation;
  readonly testing: ControlTesting;
  readonly monitoring: ControlMonitoring;
  readonly dependencies: readonly SecurityId[];
  readonly references: readonly ControlReference[];
  readonly metadata: ControlMetadata;
}

/**
 * Assessment frequency
 */
export enum AssessmentFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually',
  ON_CHANGE = 'on_change',
  ON_DEMAND = 'on_demand'
}

/**
 * Control implementation details
 */
export interface ControlImplementation {
  readonly status: ImplementationStatus;
  readonly owner: SecurityId;
  readonly responsible: readonly SecurityId[];
  readonly accountable: SecurityId;
  readonly consulted: readonly SecurityId[];
  readonly informed: readonly SecurityId[];
  readonly procedures: readonly SecurityId[];
  readonly technologies: readonly Technology[];
  readonly documentation: readonly Document[];
  readonly timeline: ImplementationTimeline;
}

/**
 * Implementation status
 */
export enum ImplementationStatus {
  NOT_IMPLEMENTED = 'not_implemented',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  PARTIALLY_IMPLEMENTED = 'partially_implemented',
  NEEDS_IMPROVEMENT = 'needs_improvement',
  UNDER_REVIEW = 'under_review'
}

/**
 * Technology for control implementation
 */
export interface Technology {
  readonly name: string;
  readonly type: TechnologyType;
  readonly version: string;
  readonly configuration: Record<string, SecurityAttributeValue>;
  readonly purpose: string;
  readonly critical: boolean;
}

/**
 * Technology types
 */
export enum TechnologyType {
  SOFTWARE = 'software',
  HARDWARE = 'hardware',
  CLOUD_SERVICE = 'cloud_service',
  SECURITY_TOOL = 'security_tool',
  MONITORING_TOOL = 'monitoring_tool',
  AUTOMATION_TOOL = 'automation_tool',
  CUSTOM = 'custom'
}

/**
 * Document for compliance
 */
export interface Document {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: DocumentType;
  readonly version: string;
  readonly location: string;
  readonly classification: DataClassification;
  readonly owner: SecurityId;
  readonly lastReview: SecurityTimestamp;
  readonly nextReview: SecurityTimestamp;
  readonly approved: boolean;
  readonly approver?: SecurityId;
}

/**
 * Document types
 */
export enum DocumentType {
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  STANDARD = 'standard',
  GUIDELINE = 'guideline',
  MANUAL = 'manual',
  TRAINING = 'training',
  TEMPLATE = 'template',
  CHECKLIST = 'checklist',
  REPORT = 'report',
  CERTIFICATE = 'certificate',
  CUSTOM = 'custom'
}

/**
 * Data classification levels
 */
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

/**
 * Implementation timeline
 */
export interface ImplementationTimeline {
  readonly planned: PlannedTimeline;
  readonly actual?: ActualTimeline;
  readonly milestones: readonly Milestone[];
  readonly dependencies: readonly Dependency[];
}

/**
 * Planned timeline
 */
export interface PlannedTimeline {
  readonly startDate: SecurityTimestamp;
  readonly endDate: SecurityTimestamp;
  readonly duration: number; // milliseconds
  readonly phases: readonly TimelinePhase[];
}

/**
 * Actual timeline
 */
export interface ActualTimeline {
  readonly startDate: SecurityTimestamp;
  readonly endDate?: SecurityTimestamp;
  readonly duration?: number; // milliseconds
  readonly variance: number; // percentage from plan
  readonly delays: readonly Delay[];
}

/**
 * Timeline phase
 */
export interface TimelinePhase {
  readonly name: string;
  readonly startDate: SecurityTimestamp;
  readonly endDate: SecurityTimestamp;
  readonly deliverables: readonly string[];
  readonly resources: readonly string[];
  readonly status: PhaseStatus;
}

/**
 * Phase status
 */
export enum PhaseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled'
}

/**
 * Milestone definition
 */
export interface Milestone {
  readonly name: string;
  readonly description: string;
  readonly targetDate: SecurityTimestamp;
  readonly actualDate?: SecurityTimestamp;
  readonly status: MilestoneStatus;
  readonly criteria: readonly string[];
  readonly dependencies: readonly string[];
}

/**
 * Milestone status
 */
export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  ACHIEVED = 'achieved',
  MISSED = 'missed',
  CANCELLED = 'cancelled'
}

/**
 * Dependency definition
 */
export interface Dependency {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: DependencyType;
  readonly criticality: DependencyCriticality;
  readonly status: DependencyStatus;
  readonly owner: SecurityId;
  readonly targetDate: SecurityTimestamp;
}

/**
 * Dependency types
 */
export enum DependencyType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  TECHNOLOGY = 'technology',
  RESOURCE = 'resource',
  APPROVAL = 'approval',
  BUDGET = 'budget',
  TRAINING = 'training'
}

/**
 * Dependency criticality
 */
export enum DependencyCriticality {
  BLOCKING = 'blocking',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NICE_TO_HAVE = 'nice_to_have'
}

/**
 * Dependency status
 */
export enum DependencyStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SATISFIED = 'satisfied',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

/**
 * Delay information
 */
export interface Delay {
  readonly reason: string;
  readonly duration: number; // milliseconds
  readonly impact: DelayImpact;
  readonly mitigation?: string;
  readonly responsible?: SecurityId;
}

/**
 * Delay impact levels
 */
export enum DelayImpact {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Control testing configuration
 */
export interface ControlTesting {
  readonly required: boolean;
  readonly frequency: TestingFrequency;
  readonly methods: readonly TestingMethod[];
  readonly criteria: TestingCriteria;
  readonly automation: TestingAutomation;
  readonly reporting: TestingReporting;
  readonly remediation: TestingRemediation;
}

/**
 * Testing frequency
 */
export enum TestingFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  AFTER_CHANGES = 'after_changes',
  ON_DEMAND = 'on_demand'
}

/**
 * Testing methods
 */
export enum TestingMethod {
  AUTOMATED_SCAN = 'automated_scan',
  MANUAL_TEST = 'manual_test',
  DOCUMENTATION_REVIEW = 'documentation_review',
  INTERVIEW = 'interview',
  OBSERVATION = 'observation',
  WALKTHROUGH = 'walkthrough',
  PENETRATION_TEST = 'penetration_test',
  VULNERABILITY_ASSESSMENT = 'vulnerability_assessment'
}

/**
 * Testing criteria
 */
export interface TestingCriteria {
  readonly passingScore: number; // 0-100 percentage
  readonly criticalIssues: number; // Maximum allowed
  readonly highIssues: number; // Maximum allowed
  readonly mediumIssues: number; // Maximum allowed
  readonly customCriteria?: readonly TestingCriterion[];
}

/**
 * Testing criterion
 */
export interface TestingCriterion {
  readonly name: string;
  readonly description: string;
  readonly measurement: MeasurementMethod;
  readonly target: number;
  readonly operator: CriterionOperator;
  readonly weight: number; // 0-1 for scoring
}

/**
 * Criterion operators
 */
export enum CriterionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains'
}

/**
 * Testing automation configuration
 */
export interface TestingAutomation {
  readonly enabled: boolean;
  readonly tools: readonly AutomationTool[];
  readonly schedule: AutomationSchedule;
  readonly notifications: AutomationNotifications;
  readonly integration: AutomationIntegration;
}

/**
 * Automation tool
 */
export interface AutomationTool {
  readonly name: string;
  readonly type: ToolType;
  readonly version: string;
  readonly configuration: Record<string, SecurityAttributeValue>;
  readonly purpose: readonly TestingMethod[];
}

/**
 * Tool types
 */
export enum ToolType {
  VULNERABILITY_SCANNER = 'vulnerability_scanner',
  COMPLIANCE_SCANNER = 'compliance_scanner',
  CONFIGURATION_SCANNER = 'configuration_scanner',
  PENETRATION_TESTING = 'penetration_testing',
  STATIC_ANALYSIS = 'static_analysis',
  DYNAMIC_ANALYSIS = 'dynamic_analysis',
  CUSTOM = 'custom'
}

/**
 * Automation schedule
 */
export interface AutomationSchedule {
  readonly type: ScheduleType;
  readonly expression: string; // Cron expression
  readonly timezone: string;
  readonly enabled: boolean;
  readonly exceptions?: readonly ScheduleException[];
}

/**
 * Schedule types
 */
export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  TRIGGERED = 'triggered',
  MANUAL = 'manual'
}

/**
 * Schedule exception
 */
export interface ScheduleException {
  readonly date: SecurityTimestamp;
  readonly reason: string;
  readonly alternative?: SecurityTimestamp;
}

/**
 * Automation notifications
 */
export interface AutomationNotifications {
  readonly enabled: boolean;
  readonly channels: readonly NotificationChannel[];
  readonly events: readonly NotificationEvent[];
  readonly escalation: NotificationEscalation;
}

/**
 * Notification channel
 */
export interface NotificationChannel {
  readonly name: string;
  readonly type: ChannelType;
  readonly destination: string;
  readonly enabled: boolean;
  readonly severity: readonly SecuritySeverity[];
}

/**
 * Channel types
 */
export enum ChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  JIRA = 'jira',
  CUSTOM = 'custom'
}

/**
 * Notification events
 */
export enum NotificationEvent {
  TEST_STARTED = 'test_started',
  TEST_COMPLETED = 'test_completed',
  TEST_FAILED = 'test_failed',
  CRITICAL_FINDING = 'critical_finding',
  HIGH_FINDING = 'high_finding',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  DEADLINE_APPROACHING = 'deadline_approaching',
  CUSTOM = 'custom'
}

/**
 * Notification escalation
 */
export interface NotificationEscalation {
  readonly enabled: boolean;
  readonly levels: readonly EscalationLevel[];
  readonly timeout: number; // milliseconds
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  readonly level: number;
  readonly delay: number; // milliseconds
  readonly recipients: readonly string[];
  readonly channels: readonly ChannelType[];
}

/**
 * Automation integration
 */
export interface AutomationIntegration {
  readonly ticketing: TicketingIntegration;
  readonly cicd: CicdIntegration;
  readonly monitoring: MonitoringIntegration;
  readonly workflow: WorkflowIntegration;
}

/**
 * Ticketing integration
 */
export interface TicketingIntegration {
  readonly enabled: boolean;
  readonly system: string;
  readonly autoCreate: boolean;
  readonly template: string;
  readonly assignment: TicketAssignment;
}

/**
 * Ticket assignment
 */
export interface TicketAssignment {
  readonly assignee?: SecurityId;
  readonly team?: string;
  readonly severity: Record<SecuritySeverity, SecurityId>;
  readonly escalation: boolean;
}

/**
 * CI/CD integration
 */
export interface CicdIntegration {
  readonly enabled: boolean;
  readonly systems: readonly string[];
  readonly breakBuild: boolean;
  readonly gating: QualityGating;
}

/**
 * Quality gating
 */
export interface QualityGating {
  readonly enabled: boolean;
  readonly thresholds: QualityThresholds;
  readonly approvals: ApprovalRequirements;
  readonly overrides: OverridePolicy;
}

/**
 * Quality thresholds
 */
export interface QualityThresholds {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly total: number;
  readonly score: number; // Minimum compliance score
}

/**
 * Approval requirements
 */
export interface ApprovalRequirements {
  readonly required: boolean;
  readonly approvers: readonly SecurityId[];
  readonly minApprovals: number;
  readonly timeout: number; // milliseconds
  readonly escalation: ApprovalEscalation;
}

/**
 * Approval escalation
 */
export interface ApprovalEscalation {
  readonly enabled: boolean;
  readonly levels: readonly ApprovalLevel[];
  readonly autoApprove: boolean;
}

/**
 * Approval level
 */
export interface ApprovalLevel {
  readonly level: number;
  readonly timeout: number; // milliseconds
  readonly approvers: readonly SecurityId[];
  readonly required: number; // Minimum approvals needed
}

/**
 * Override policy
 */
export interface OverridePolicy {
  readonly enabled: boolean;
  readonly roles: readonly string[];
  readonly justification: boolean;
  readonly approval: boolean;
  readonly auditing: boolean;
  readonly timeLimit?: number; // milliseconds
}

/**
 * Monitoring integration
 */
export interface MonitoringIntegration {
  readonly enabled: boolean;
  readonly systems: readonly string[];
  readonly metrics: readonly MonitoringMetric[];
  readonly alerting: MonitoringAlerting;
}

/**
 * Monitoring metric
 */
export interface MonitoringMetric {
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly aggregation: AggregationType;
  readonly frequency: MeasurementFrequency;
}

/**
 * Aggregation types
 */
export enum AggregationType {
  COUNT = 'count',
  SUM = 'sum',
  AVERAGE = 'average',
  MINIMUM = 'minimum',
  MAXIMUM = 'maximum',
  PERCENTILE = 'percentile'
}

/**
 * Monitoring alerting
 */
export interface MonitoringAlerting {
  readonly enabled: boolean;
  readonly rules: readonly AlertingRule[];
  readonly channels: readonly string[];
  readonly suppressions: readonly AlertSuppression[];
}

/**
 * Alerting rule
 */
export interface AlertingRule {
  readonly name: string;
  readonly condition: AlertCondition;
  readonly severity: SecuritySeverity;
  readonly enabled: boolean;
  readonly channels: readonly string[];
}

/**
 * Alert condition
 */
export interface AlertCondition {
  readonly metric: string;
  readonly operator: CriterionOperator;
  readonly threshold: number;
  readonly duration: number; // milliseconds
}

/**
 * Alert suppression
 */
export interface AlertSuppression {
  readonly name: string;
  readonly condition: SuppressionCondition;
  readonly duration: number; // milliseconds
  readonly reason: string;
}

/**
 * Suppression condition
 */
export interface SuppressionCondition {
  readonly field: string;
  readonly operator: CriterionOperator;
  readonly value: SecurityAttributeValue;
}

/**
 * Workflow integration
 */
export interface WorkflowIntegration {
  readonly enabled: boolean;
  readonly engine: string;
  readonly workflows: readonly WorkflowDefinition[];
  readonly triggers: readonly WorkflowTrigger[];
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly WorkflowStep[];
  readonly conditions: readonly WorkflowCondition[];
  readonly timeout: number; // milliseconds
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: StepType;
  readonly action: StepAction;
  readonly condition?: WorkflowCondition;
  readonly timeout: number; // milliseconds
}

/**
 * Step types
 */
export enum StepType {
  ACTION = 'action',
  DECISION = 'decision',
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  WAIT = 'wait',
  HUMAN = 'human'
}

/**
 * Step action
 */
export interface StepAction {
  readonly type: ActionType;
  readonly parameters: Record<string, SecurityAttributeValue>;
  readonly retry: RetryPolicy;
  readonly rollback?: RollbackAction;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  readonly enabled: boolean;
  readonly attempts: number;
  readonly delay: number; // milliseconds
  readonly backoff: BackoffType;
}

/**
 * Backoff types
 */
export enum BackoffType {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential'
}

/**
 * Rollback action
 */
export interface RollbackAction {
  readonly enabled: boolean;
  readonly action: ActionType;
  readonly parameters: Record<string, SecurityAttributeValue>;
  readonly automatic: boolean;
}

/**
 * Workflow condition
 */
export interface WorkflowCondition {
  readonly field: string;
  readonly operator: CriterionOperator;
  readonly value: SecurityAttributeValue;
  readonly type: ConditionType;
}

/**
 * Condition types
 */
export enum ConditionType {
  PRE_CONDITION = 'pre_condition',
  POST_CONDITION = 'post_condition',
  GUARD = 'guard',
  TRIGGER = 'trigger'
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  readonly id: SecurityId;
  readonly name: string;
  readonly event: TriggerEvent;
  readonly condition?: WorkflowCondition;
  readonly workflow: SecurityId;
  readonly enabled: boolean;
}

/**
 * Trigger events
 */
export enum TriggerEvent {
  TEST_COMPLETED = 'test_completed',
  FINDING_DISCOVERED = 'finding_discovered',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  DEADLINE_APPROACHING = 'deadline_approaching',
  STATUS_CHANGED = 'status_changed',
  APPROVAL_RECEIVED = 'approval_received',
  CUSTOM = 'custom'
}

/**
 * Type guards for compliance types
 */
export const isComplianceFrameworkDefinition = (value: unknown): value is ComplianceFrameworkDefinition => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'version' in value &&
    Object.values(ComplianceFramework).includes((value as ComplianceFrameworkDefinition).type)
  );
};

export const isComplianceControl = (value: unknown): value is ComplianceControl => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'framework' in value &&
    Object.values(ControlType).includes((value as ComplianceControl).type) &&
    Object.values(ComplianceFramework).includes((value as ComplianceControl).framework)
  );
};

export const isComplianceStatus = (value: unknown): value is ComplianceStatus => {
  return typeof value === 'string' && Object.values(ComplianceStatus).includes(value as ComplianceStatus);
};

/**
 * Utility functions for compliance operations
 */
export const calculateComplianceScore = (
  controls: readonly ComplianceControl[],
  assessments: readonly ControlAssessment[]
): number => {
  if (controls.length === 0) return 0;

  const assessmentMap = new Map(assessments.map(a => [a.controlId, a]));
  let totalWeight = 0;
  let weightedScore = 0;

  for (const control of controls) {
    const weight = 1; // Could be derived from control.metadata if available
    const assessment = assessmentMap.get(control.id);
    const score = assessment?.score || 0;

    totalWeight += weight;
    weightedScore += score * weight;
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;
};

export const determineComplianceStatus = (score: number): ComplianceStatus => {
  if (score >= 95) return ComplianceStatus.COMPLIANT;
  if (score >= 80) return ComplianceStatus.PARTIALLY_COMPLIANT;
  if (score > 0) return ComplianceStatus.NON_COMPLIANT;
  return ComplianceStatus.NOT_ASSESSED;
};

export const calculateRiskScore = (probability: Probability, impact: ImpactLevel): ComplianceRisk => {
  const probValue = getProbabilityValue(probability);
  const impactValue = getImpactValue(impact);
  const riskValue = probValue * impactValue;

  if (riskValue >= 0.8) return ComplianceRisk.CRITICAL;
  if (riskValue >= 0.6) return ComplianceRisk.VERY_HIGH;
  if (riskValue >= 0.4) return ComplianceRisk.HIGH;
  if (riskValue >= 0.2) return ComplianceRisk.MEDIUM;
  if (riskValue >= 0.1) return ComplianceRisk.LOW;
  return ComplianceRisk.VERY_LOW;
};

const getProbabilityValue = (probability: Probability): number => {
  switch (probability) {
    case Probability.VERY_LOW: return 0.1;
    case Probability.LOW: return 0.3;
    case Probability.MEDIUM: return 0.5;
    case Probability.HIGH: return 0.7;
    case Probability.VERY_HIGH: return 0.9;
    default: return 0;
  }
};

const getImpactValue = (impact: ImpactLevel): number => {
  switch (impact) {
    case ImpactLevel.NEGLIGIBLE: return 0.1;
    case ImpactLevel.MINOR: return 0.3;
    case ImpactLevel.MODERATE: return 0.5;
    case ImpactLevel.MAJOR: return 0.7;
    case ImpactLevel.SEVERE: return 0.9;
    case ImpactLevel.CATASTROPHIC: return 1.0;
    default: return 0;
  }
};

/**
 * Additional compliance interfaces
 */
export interface ComplianceRequirement {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly framework: ComplianceFramework;
  readonly domain: SecurityId;
  readonly controls: readonly SecurityId[];
  readonly mandatory: boolean;
  readonly applicability: RequirementApplicability;
  readonly evidence: EvidenceRequirements;
  readonly assessment: RequirementAssessment;
  readonly metadata: RequirementMetadata;
}

export interface RequirementApplicability {
  readonly conditions: readonly ApplicabilityCondition[];
  readonly exceptions: readonly string[];
  readonly scope: FrameworkScope;
}

export interface ApplicabilityCondition {
  readonly field: string;
  readonly operator: CriterionOperator;
  readonly value: SecurityAttributeValue;
}

export interface EvidenceRequirements {
  readonly types: readonly EvidenceType[];
  readonly mandatory: boolean;
  readonly retention: number; // milliseconds
  readonly quality: EvidenceQuality;
}

export interface EvidenceQuality {
  readonly completeness: number; // 0-100 percentage
  readonly accuracy: number; // 0-100 percentage
  readonly timeliness: number; // 0-100 percentage
  readonly relevance: number; // 0-100 percentage
}

export interface RequirementAssessment {
  readonly frequency: AssessmentFrequency;
  readonly methods: readonly AssessmentType[];
  readonly criteria: AssessmentCriteria;
  readonly scoring: ScoringMethod;
}

export interface AssessmentCriteria {
  readonly passingScore: number; // 0-100 percentage
  readonly criticalIssues: number; // Maximum allowed
  readonly evidenceRequired: boolean;
  readonly independentValidation: boolean;
}

export enum ScoringMethod {
  BINARY = 'binary', // Pass/Fail
  PERCENTAGE = 'percentage', // 0-100
  MATURITY = 'maturity', // 1-5 scale
  WEIGHTED = 'weighted', // Weighted scoring
  CUSTOM = 'custom'
}

export interface RequirementMetadata {
  readonly version: string;
  readonly effectiveDate: SecurityTimestamp;
  readonly lastUpdate: SecurityTimestamp;
  readonly source: string;
  readonly authority: string;
  readonly tags: readonly string[];
}

export interface ControlAssessment {
  readonly id: SecurityId;
  readonly controlId: SecurityId;
  readonly assessmentType: AssessmentType;
  readonly assessor: SecurityId;
  readonly assessmentDate: SecurityTimestamp;
  readonly status: ComplianceStatus;
  readonly score: number; // 0-100
  readonly findings: readonly AssessmentFinding[];
  readonly evidence: readonly AssessmentEvidence[];
  readonly recommendations: readonly string[];
  readonly nextAssessment: SecurityTimestamp;
  readonly metadata: AssessmentMetadata;
}

export interface AssessmentFinding {
  readonly id: SecurityId;
  readonly title: string;
  readonly description: string;
  readonly severity: SecuritySeverity;
  readonly status: FindingStatus;
  readonly remediation: RemediationPlan;
  readonly evidence: readonly string[];
}

export enum FindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ACCEPTED = 'accepted',
  FALSE_POSITIVE = 'false_positive',
  DUPLICATE = 'duplicate'
}

export interface RemediationPlan {
  readonly actions: readonly RemediationAction[];
  readonly timeline: string;
  readonly resources: readonly string[];
  readonly cost?: string;
  readonly priority: RemediationPriority;
}

export interface RemediationAction {
  readonly id: SecurityId;
  readonly description: string;
  readonly owner: SecurityId;
  readonly dueDate: SecurityTimestamp;
  readonly status: ActionStatus;
  readonly effort: ImplementationEffort;
}

export enum RemediationPriority {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  DEFERRED = 'deferred'
}

export interface AssessmentEvidence {
  readonly id: SecurityId;
  readonly type: EvidenceType;
  readonly name: string;
  readonly description: string;
  readonly location: string;
  readonly classification: DataClassification;
  readonly quality: EvidenceQuality;
  readonly verification: EvidenceVerification;
}

export interface EvidenceVerification {
  readonly verified: boolean;
  readonly verifier?: SecurityId;
  readonly verificationDate?: SecurityTimestamp;
  readonly method: VerificationMethod;
  readonly confidence: ConfidenceLevel;
}

export enum VerificationMethod {
  MANUAL_REVIEW = 'manual_review',
  AUTOMATED_CHECK = 'automated_check',
  THIRD_PARTY = 'third_party',
  SAMPLING = 'sampling',
  WALKTHROUGH = 'walkthrough'
}

export enum ConfidenceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

export interface AssessmentMetadata {
  readonly methodology: string;
  readonly tools: readonly string[];
  readonly duration: number; // milliseconds
  readonly scope: string;
  readonly limitations: readonly string[];
  readonly assumptions: readonly string[];
}

export interface ControlReference {
  readonly type: ReferenceType;
  readonly identifier: string;
  readonly title: string;
  readonly url?: string;
  readonly description?: string;
}

export enum ReferenceType {
  STANDARD = 'standard',
  REGULATION = 'regulation',
  GUIDELINE = 'guideline',
  BEST_PRACTICE = 'best_practice',
  FRAMEWORK = 'framework',
  EXTERNAL = 'external'
}

export interface ControlMetadata {
  readonly version: string;
  readonly lastUpdate: SecurityTimestamp;
  readonly source: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

export interface ControlMonitoring {
  readonly enabled: boolean;
  readonly continuous: boolean;
  readonly metrics: readonly MonitoringMetric[];
  readonly thresholds: readonly MonitoringThreshold[];
  readonly alerting: ControlAlerting;
}

export interface MonitoringThreshold {
  readonly metric: string;
  readonly operator: CriterionOperator;
  readonly value: number;
  readonly severity: SecuritySeverity;
  readonly action: ThresholdAction;
}

export enum ThresholdAction {
  ALERT = 'alert',
  ESCALATE = 'escalate',
  AUTO_REMEDIATE = 'auto_remediate',
  NOTIFY = 'notify',
  LOG = 'log'
}

export interface ControlAlerting {
  readonly enabled: boolean;
  readonly channels: readonly string[];
  readonly escalation: boolean;
  readonly suppressions: readonly string[];
}

export interface TestingReporting {
  readonly format: readonly ReportFormat[];
  readonly distribution: readonly string[];
  readonly schedule: ReportingSchedule;
  readonly retention: number; // milliseconds
}

export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml'
}

export interface ReportingSchedule {
  readonly frequency: ReportingFrequency;
  readonly dayOfWeek?: number; // 0-6, Sunday = 0
  readonly dayOfMonth?: number; // 1-31
  readonly time?: string; // HH:mm
}

export enum ReportingFrequency {
  IMMEDIATE = 'immediate',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually'
}

export interface TestingRemediation {
  readonly automatic: boolean;
  readonly workflow: SecurityId;
  readonly notifications: readonly string[];
  readonly escalation: RemediationEscalation;
}

export interface RemediationEscalation {
  readonly enabled: boolean;
  readonly timeouts: readonly number[]; // milliseconds
  readonly recipients: readonly string[];
}

export interface AssessmentRequirements {
  readonly frequency: AssessmentFrequency;
  readonly scope: AssessmentScope;
  readonly methodology: AssessmentMethodology;
  readonly documentation: DocumentationRequirements;
  readonly independence: IndependenceRequirements;
}

export interface AssessmentScope {
  readonly systems: readonly string[];
  readonly processes: readonly string[];
  readonly locations: readonly string[];
  readonly exclusions?: readonly string[];
}

export interface AssessmentMethodology {
  readonly approaches: readonly AssessmentApproach[];
  readonly sampling: SamplingRequirements;
  readonly validation: ValidationRequirements;
  readonly quality: QualityRequirements;
}

export enum AssessmentApproach {
  RISK_BASED = 'risk_based',
  COMPREHENSIVE = 'comprehensive',
  FOCUSED = 'focused',
  CONTINUOUS = 'continuous',
  HYBRID = 'hybrid'
}

export interface SamplingRequirements {
  readonly required: boolean;
  readonly method: SamplingMethod;
  readonly size: number; // Percentage or absolute number
  readonly confidence: number; // Confidence level percentage
}

export enum SamplingMethod {
  RANDOM = 'random',
  SYSTEMATIC = 'systematic',
  STRATIFIED = 'stratified',
  CLUSTER = 'cluster',
  JUDGMENTAL = 'judgmental'
}

export interface ValidationRequirements {
  readonly independent: boolean;
  readonly methods: readonly ValidationMethod[];
  readonly evidence: EvidenceRequirements;
  readonly documentation: boolean;
}

export interface QualityRequirements {
  readonly standards: readonly string[];
  readonly review: ReviewRequirements;
  readonly supervision: SupervisionRequirements;
  readonly documentation: DocumentationStandards;
}

export interface ReviewRequirements {
  readonly required: boolean;
  readonly levels: number;
  readonly qualifications: readonly string[];
  readonly independence: boolean;
}

export interface SupervisionRequirements {
  readonly required: boolean;
  readonly ratio: number; // Supervisor to assessor ratio
  readonly qualifications: readonly string[];
  readonly oversight: OversightLevel;
}

export enum OversightLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
  COMPREHENSIVE = 'comprehensive'
}

export interface DocumentationStandards {
  readonly templates: readonly string[];
  readonly completeness: number; // Percentage
  readonly accuracy: number; // Percentage
  readonly timeliness: number; // Hours after completion
  readonly retention: number; // Years
}

export interface DocumentationRequirements {
  readonly standards: DocumentationStandards;
  readonly templates: readonly string[];
  readonly approval: ApprovalRequirements;
  readonly retention: RetentionRequirements;
  readonly access: AccessRequirements;
}

export interface RetentionRequirements {
  readonly period: number; // Years
  readonly location: string;
  readonly format: readonly DocumentFormat[];
  readonly backup: boolean;
  readonly destruction: DestructionRequirements;
}

export enum DocumentFormat {
  PHYSICAL = 'physical',
  ELECTRONIC = 'electronic',
  BOTH = 'both'
}

export interface DestructionRequirements {
  readonly automatic: boolean;
  readonly method: DestructionMethod;
  readonly certification: boolean;
  readonly witness: boolean;
}

export enum DestructionMethod {
  SECURE_DELETE = 'secure_delete',
  PHYSICAL_DESTRUCTION = 'physical_destruction',
  CRYPTOGRAPHIC = 'cryptographic',
  OVERWRITE = 'overwrite'
}

export interface AccessRequirements {
  readonly roles: readonly string[];
  readonly approval: boolean;
  readonly logging: boolean;
  readonly encryption: boolean;
}

export interface IndependenceRequirements {
  readonly assessor: AssessorIndependence;
  readonly reviewer: ReviewerIndependence;
  readonly organization: OrganizationalIndependence;
}

export interface AssessorIndependence {
  readonly required: boolean;
  readonly restrictions: readonly string[];
  readonly cooling: CoolingOffPeriod;
  readonly disclosure: DisclosureRequirements;
}

export interface CoolingOffPeriod {
  readonly required: boolean;
  readonly duration: number; // Years
  readonly activities: readonly string[];
}

export interface DisclosureRequirements {
  readonly conflicts: boolean;
  readonly relationships: boolean;
  readonly financial: boolean;
  readonly previous: boolean;
}

export interface ReviewerIndependence {
  readonly required: boolean;
  readonly level: IndependenceLevel;
  readonly qualifications: readonly string[];
  readonly restrictions: readonly string[];
}

export enum IndependenceLevel {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  MIXED = 'mixed'
}

export interface OrganizationalIndependence {
  readonly required: boolean;
  readonly separation: SeparationRequirements;
  readonly reporting: ReportingRequirements;
  readonly oversight: OversightRequirements;
}

export interface SeparationRequirements {
  readonly functions: boolean;
  readonly reporting: boolean;
  readonly compensation: boolean;
  readonly performance: boolean;
}

export interface OversightRequirements {
  readonly board: boolean;
  readonly committee: boolean;
  readonly external: boolean;
  readonly frequency: OversightFrequency;
}

export enum OversightFrequency {
  CONTINUOUS = 'continuous',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  AS_NEEDED = 'as_needed'
}

export interface CertificationRequirements {
  readonly required: boolean;
  readonly body: string;
  readonly standard: string;
  readonly scope: CertificationScope;
  readonly duration: number; // Years
  readonly maintenance: MaintenanceRequirements;
  readonly surveillance: SurveillanceRequirements;
}

export interface CertificationScope {
  readonly systems: readonly string[];
  readonly processes: readonly string[];
  readonly locations: readonly string[];
  readonly products?: readonly string[];
  readonly services?: readonly string[];
}

export interface MaintenanceRequirements {
  readonly activities: readonly MaintenanceActivity[];
  readonly frequency: MaintenanceFrequency;
  readonly evidence: EvidenceRequirements;
  readonly reporting: MaintenanceReporting;
}

export enum MaintenanceActivity {
  TRAINING = 'training',
  ASSESSMENT = 'assessment',
  AUDIT = 'audit',
  REVIEW = 'review',
  UPDATE = 'update'
}

export enum MaintenanceFrequency {
  CONTINUOUS = 'continuous',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  BIANNUALLY = 'biannually'
}

export interface MaintenanceReporting {
  readonly required: boolean;
  readonly frequency: ReportingFrequency;
  readonly recipients: readonly string[];
  readonly format: readonly ReportFormat[];
}

export interface SurveillanceRequirements {
  readonly frequency: SurveillanceFrequency;
  readonly scope: SurveillanceScope;
  readonly methods: readonly SurveillanceMethod[];
  readonly reporting: SurveillanceReporting;
}

export enum SurveillanceFrequency {
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually'
}

export interface SurveillanceScope {
  readonly percentage: number; // 0-100
  readonly areas: readonly string[];
  readonly sampling: boolean;
}

export enum SurveillanceMethod {
  ON_SITE = 'on_site',
  REMOTE = 'remote',
  DOCUMENT_REVIEW = 'document_review',
  INTERVIEW = 'interview',
  OBSERVATION = 'observation'
}

export interface SurveillanceReporting {
  readonly timeline: number; // Days after surveillance
  readonly distribution: readonly string[];
  readonly corrective: CorrectiveActionRequirements;
}

export interface CorrectiveActionRequirements {
  readonly required: boolean;
  readonly timeline: number; // Days
  readonly approval: boolean;
  readonly verification: boolean;
}

export interface FrameworkMetadata {
  readonly publisher: string;
  readonly publishDate: SecurityTimestamp;
  readonly lastUpdate: SecurityTimestamp;
  readonly nextReview: SecurityTimestamp;
  readonly status: FrameworkStatus;
  readonly predecessor?: SecurityId;
  readonly successor?: SecurityId;
  readonly related: readonly SecurityId[];
  readonly tags: readonly string[];
}

export enum FrameworkStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  WITHDRAWN = 'withdrawn',
  SUPERSEDED = 'superseded'
}