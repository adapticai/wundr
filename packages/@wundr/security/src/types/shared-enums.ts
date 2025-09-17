/**
 * Shared Enums for Security Package
 * Consolidated enums to eliminate duplicates across security type files
 *
 * @fileoverview Single source of truth for all shared enums
 * @author Security Types Specialist
 * @version 1.0.0
 */

/**
 * Comparison operators used across authorization, audit, and scanning systems
 */
export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES = 'matches', // Regex
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists'
}

/**
 * Impact levels used across scanning and compliance systems
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
 * Action status used across compliance and audit systems
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
 * Effort levels used across scanning and compliance systems
 */
export enum EffortLevel {
  MINIMAL = 'minimal',   // < 1 hour
  LOW = 'low',          // 1-4 hours
  MEDIUM = 'medium',    // 1-2 days
  HIGH = 'high',        // 3-5 days
  VERY_HIGH = 'very_high' // > 1 week
}

/**
 * Skill levels required across compliance and scanning systems
 */
export enum SkillLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
  SPECIALIST = 'specialist'
}

/**
 * Risk levels used across scanning and compliance systems
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
 * Likelihood levels used across scanning and compliance systems
 */
export enum LikelihoodLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Data classification levels used across audit and compliance systems
 */
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

/**
 * Report formats used across scanning, audit, and compliance systems
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
  DASHBOARD = 'dashboard',
  CUSTOM = 'custom'
}

/**
 * Notification channel types used across scanning, audit, and compliance systems
 */
export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  JIRA = 'jira',
  PAGERDUTY = 'pagerduty',
  CUSTOM = 'custom'
}

/**
 * Measurement frequencies used across compliance and audit systems
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
 * Schedule types used across scanning and compliance systems
 */
export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  MANUAL = 'manual',
  TRIGGERED = 'triggered',
  TRIGGER_BASED = 'trigger_based'
}

/**
 * Phase status used across compliance systems
 */
export enum PhaseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled'
}

/**
 * Confidence levels used across scanning and compliance systems
 */
export enum ConfidenceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

/**
 * Evidence types used across scanning, audit, and compliance systems
 */
export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG_FILE = 'log_file',
  LOG_ENTRY = 'log_entry',
  NETWORK_PACKET = 'network_packet',
  FILE_CONTENT = 'file_content',
  DATABASE_RECORD = 'database_record',
  SYSTEM_STATE = 'system_state',
  USER_INPUT = 'user_input',
  API_RESPONSE = 'api_response',
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
 * Resource types used across authorization and compliance systems
 */
export enum ResourceType {
  FILE = 'file',
  DIRECTORY = 'directory',
  DATABASE = 'database',
  TABLE = 'table',
  RECORD = 'record',
  API_ENDPOINT = 'api_endpoint',
  SERVICE = 'service',
  APPLICATION = 'application',
  SYSTEM = 'system',
  NETWORK = 'network',
  HUMAN = 'human',
  TECHNOLOGY = 'technology',
  TRAINING = 'training',
  CONSULTING = 'consulting',
  TOOLS = 'tools',
  INFRASTRUCTURE = 'infrastructure',
  BUDGET = 'budget',
  CUSTOM = 'custom'
}

/**
 * Implementation status used across authorization and compliance systems
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
 * Validation methods used across authorization and compliance systems
 */
export enum ValidationMethod {
  AUTOMATED_TEST = 'automated_test',
  MANUAL_REVIEW = 'manual_review',
  AUDIT = 'audit',
  ASSESSMENT = 'assessment',
  CERTIFICATION = 'certification',
  ATTESTATION = 'attestation',
  THIRD_PARTY = 'third_party',
  SAMPLING = 'sampling',
  WALKTHROUGH = 'walkthrough'
}