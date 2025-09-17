/**
 * Security Package Type Index
 * Main export file for all security types
 *
 * @fileoverview Exports all security types from base and modules
 * @author Security Types Specialist
 * @version 1.0.0
 */

// Re-export base types and shared enums first
export * from './base';
export * from './shared-enums';

// Re-export only the core scanning types that exist
export type {
  ScanConfiguration,
  ScanExecution,
  ScanResults,
  Vulnerability,
  SecurityFinding,
  ScanTarget,
  ScanSchedule,
  ScanProgress,
  ScanMetrics
} from './scanning';

// Re-export enums with explicit names to avoid conflicts
export {
  ScanType,
  VulnerabilitySeverity,
  VulnerabilityStatus,
  ScanExecutionStatus,
  TargetType,
  CredentialType,
  DestinationType,
  GroupingMethod,
  SortingMethod,
  CicdPlatform,
  TicketingPlatform,
  MonitoringPlatform,
  NotificationTrigger,
  TriggerType,
  FindingType,
  RiskFactorType,
  MitigationPriority,
  ReferenceType,
  RelevanceLevel,
  RecommendationCategory,
  RecommendationPriority,
  TrendDirection,
  ComplianceStatus,
  LogLevel
} from './scanning';

// Authentication and Authorization enums removed to avoid export errors
// Use type imports from the specific modules instead