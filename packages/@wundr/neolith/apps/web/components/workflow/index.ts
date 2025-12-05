/**
 * Workflow components for variable management and template gallery
 *
 * This module provides comprehensive components for managing workflow variables,
 * templates, and workflow creation, including:
 * - Variable definition and management
 * - Variable picker for step configurations
 * - Variable input with reference support
 * - Validation utilities
 * - Template gallery and preview
 * - Template configurator
 */

// Variable Management Components
export { VariableManager } from './variable-manager';
export type {
  VariableManagerProps,
  ScopedWorkflowVariable,
  VariableScope,
} from './variable-manager';

export { VariablePicker } from './variable-picker';
export type { VariablePickerProps } from './variable-picker';

export { VariableInput } from './variable-input';
export type { VariableInputProps } from './variable-input';

export {
  isValidVariableName,
  isReservedKeyword,
  validateVariableName,
  validateDefaultValue,
  validateVariable,
  validateVariableReferences,
  validateWorkflowVariables,
  extractVariableReferences,
  hasVariableReferences,
  replaceVariableReferences,
  isValueOfType,
  coerceToType,
} from './variable-validation';

export type {
  ValidationError,
  VariableValidationResult,
} from './variable-validation';

// Template Components
export { TemplateGallery } from './template-gallery';
export { TemplatePreview } from './template-preview';
export { TemplateConfigurator } from './template-configurator';

// Version Control Components
export { VersionHistory } from './version-history';
export type {
  VersionHistoryProps,
  WorkflowVersion,
  VersionBranch,
  VersionState,
  ChangeType,
} from './version-history';

export { WorkflowDiff } from './workflow-diff';
export type {
  WorkflowDiffProps,
  WorkflowDiffResult,
  DiffItem,
  DiffOperation,
} from './workflow-diff';

// Workflow permissions and sharing
export { WorkflowPermissions } from './workflow-permissions';
export type {
  WorkflowPermissionLevel,
  PermissionSubjectType,
  WorkflowVisibility,
  WorkflowPermission,
  WorkflowAccessLog,
  WorkflowSharingConfig,
} from './workflow-permissions';

export { ShareDialog, QuickShareButton } from './share-dialog';
export type { ShareableEntity, ShareRecipient } from './share-dialog';

// Workflow Scheduling Components
export { ScheduleConfig } from './schedule-config';

// Integration Components
export { IntegrationSelector } from './integration-selector';

// Error Handling Components
export { ErrorHandlingConfig } from './error-handling-config';
export type {
  ErrorHandlingConfigProps,
  ErrorStrategy,
  ErrorType,
  BackoffStrategy,
  NotificationChannel,
  ErrorPriority,
  RetryConfig,
  FallbackConfig,
  NotificationConfig,
  CircuitBreakerConfig,
  StepErrorConfig,
  DLQEntry,
  RecoveryAction,
} from './error-handling-config';
export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  calculateBackoff,
  formatDuration,
  getErrorTypeIcon,
  getErrorTypeBadgeVariant,
  getPriorityBadgeVariant,
} from './error-handling-config';

// Condition Builder Components
export { ConditionBuilder } from './condition-builder';
export type {
  ConditionBuilderProps,
  Condition,
  ConditionGroup,
  ComparisonOperator,
  LogicalOperator,
} from './condition-builder';
export {
  OPERATOR_CONFIG,
  CONDITION_TEMPLATES,
  validateCondition,
  validateConditionGroup,
  explainCondition,
  explainConditionGroup,
  isConditionGroup,
  getOperatorsForType,
} from './condition-builder';

// Import/Export Components
export { WorkflowExport } from './workflow-export';
export type {
  ExportFormat,
  ExportOptions,
  ExportedWorkflow,
  ExportResult,
} from './workflow-export';

export { WorkflowImport } from './workflow-import';
export type {
  ImportResult,
  ValidationError as ImportValidationError,
  ParsedWorkflow,
  ConflictResolution,
} from './workflow-import';
