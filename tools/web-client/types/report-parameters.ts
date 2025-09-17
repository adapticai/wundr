/**
 * Report Parameter Type Definitions
 *
 * Specific type definitions for report parameters, form values,
 * and wizard configurations to replace 'any' types in report components.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

import type { ExportFormat, ReportTemplate, ReportParameter } from './reports';

// =============================================================================
// PARAMETER VALUE TYPES
// =============================================================================

/**
 * Supported parameter value types
 */
export type ParameterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Date
  | { start: Date; end: Date }
  | File
  | File[]
  | { [key: string]: unknown };

/**
 * Report parameters dictionary with proper typing
 */
export interface ReportParameters {
  [key: string]: ParameterValue;
}

/**
 * Parameter validation result
 */
export interface ParameterValidationResult {
  /** Whether the parameter value is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning message */
  warning?: string;
  /** Sanitized value */
  sanitizedValue?: ParameterValue;
}

/**
 * Parameter configuration with extended validation
 */
export interface ExtendedReportParameter extends ReportParameter {
  /** Parameter group for organization */
  group?: string;
  /** Parameter dependencies */
  dependencies?: {
    /** Parameters that must be set */
    requires?: string[];
    /** Parameters that conflict */
    conflicts?: string[];
    /** Conditional visibility */
    showWhen?: {
      parameter: string;
      value: ParameterValue;
      operator?: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
    };
  };
  /** Custom validation function */
  customValidation?: (value: ParameterValue, allParams: ReportParameters) => ParameterValidationResult;
  /** Parameter formatting options */
  formatting?: {
    /** Display format for numbers */
    numberFormat?: 'integer' | 'decimal' | 'percentage' | 'currency';
    /** Date format string */
    dateFormat?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Input mask */
    mask?: string;
  };
}

// =============================================================================
// WIZARD STATE TYPES
// =============================================================================

/**
 * Report generation wizard step
 */
export interface WizardStep {
  /** Step identifier */
  id: string;
  /** Step display label */
  label: string;
  /** Step icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Whether step is completed */
  completed?: boolean;
  /** Whether step is current */
  current?: boolean;
  /** Whether step is accessible */
  enabled?: boolean;
  /** Step validation */
  validation?: () => boolean;
}

/**
 * Report wizard configuration state
 */
export interface ReportWizardState {
  /** Current step index */
  currentStep: number;
  /** Selected template */
  selectedTemplate: ReportTemplate | null;
  /** Report name */
  reportName: string;
  /** Report description */
  reportDescription: string;
  /** Report parameters */
  parameters: ReportParameters;
  /** Output formats */
  outputFormats: ExportFormat[];
  /** Report tags */
  tags: string[];
  /** Schedule configuration */
  schedule: ReportScheduleConfig;
  /** Validation errors */
  errors: Record<string, string>;
  /** Form touched fields */
  touched: Record<string, boolean>;
  /** Loading states */
  loading: {
    templates: boolean;
    validation: boolean;
    generation: boolean;
  };
}

/**
 * Report schedule configuration
 */
export interface ReportScheduleConfig {
  /** Whether to schedule the report */
  enabled: boolean;
  /** Schedule type */
  type: 'once' | 'recurring';
  /** Execution date/time for one-time reports */
  executeAt?: Date;
  /** Recurring schedule configuration */
  recurring?: {
    /** Frequency type */
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /** Interval (every X days/weeks/months) */
    interval: number;
    /** Days of week for weekly schedules */
    daysOfWeek?: number[];
    /** Day of month for monthly schedules */
    dayOfMonth?: number;
    /** Time of day */
    timeOfDay: string;
    /** Start date */
    startDate: Date;
    /** End date (optional) */
    endDate?: Date;
    /** Timezone */
    timezone: string;
  };
  /** Notification settings */
  notifications?: {
    /** Email recipients */
    email?: string[];
    /** Webhook URL */
    webhook?: string;
    /** Notification on success */
    onSuccess: boolean;
    /** Notification on failure */
    onFailure: boolean;
  };
}

// =============================================================================
// FORM HANDLING TYPES
// =============================================================================

/**
 * Form field configuration for parameters
 */
export interface ParameterFormField {
  /** Field key */
  key: string;
  /** Field label */
  label: string;
  /** Field type */
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'daterange' | 'file' | 'textarea' | 'color';
  /** Field value */
  value: ParameterValue;
  /** Field options for select types */
  options?: Array<{ value: ParameterValue; label: string; description?: string }>;
  /** Field validation */
  validation: {
    /** Required field */
    required: boolean;
    /** Minimum value/length */
    min?: number;
    /** Maximum value/length */
    max?: number;
    /** Pattern validation */
    pattern?: RegExp;
    /** Custom validation message */
    message?: string;
  };
  /** Field state */
  state: {
    /** Whether field has been touched */
    touched: boolean;
    /** Validation error */
    error?: string;
    /** Field disabled state */
    disabled: boolean;
    /** Field loading state */
    loading: boolean;
  };
  /** Field appearance */
  appearance?: {
    /** Field size */
    size?: 'sm' | 'md' | 'lg';
    /** Field variant */
    variant?: 'default' | 'outlined' | 'filled';
    /** Help text */
    helpText?: string;
    /** Placeholder text */
    placeholder?: string;
  };
}

/**
 * Form submission data
 */
export interface ReportFormData {
  /** Template selection */
  template: {
    /** Selected template ID */
    templateId: string;
    /** Template name */
    templateName: string;
    /** Template version */
    templateVersion?: string;
  };
  /** Report metadata */
  metadata: {
    /** Report name */
    name: string;
    /** Report description */
    description: string;
    /** Report tags */
    tags: string[];
    /** Creator ID */
    createdBy?: string;
  };
  /** Report parameters */
  parameters: ReportParameters;
  /** Output configuration */
  output: {
    /** Export formats */
    formats: ExportFormat[];
    /** Output path */
    path?: string;
    /** Compression enabled */
    compression?: boolean;
    /** Password protection */
    password?: string;
  };
  /** Schedule configuration */
  schedule?: ReportScheduleConfig;
  /** Additional options */
  options?: {
    /** Priority level */
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    /** Retry attempts */
    retryAttempts?: number;
    /** Timeout in minutes */
    timeout?: number;
    /** Email on completion */
    emailOnCompletion?: boolean;
  };
}

// =============================================================================
// SELECTION AND FILTERING TYPES
// =============================================================================

/**
 * Template selection criteria
 */
export interface TemplateSelectionCriteria {
  /** Category filter */
  category?: string;
  /** Type filter */
  type?: string;
  /** Tag filters */
  tags?: string[];
  /** Search query */
  search?: string;
  /** Complexity filter */
  complexity?: 'simple' | 'medium' | 'complex';
  /** Sort configuration */
  sort?: {
    /** Sort field */
    field: 'name' | 'createdAt' | 'updatedAt' | 'popularity' | 'type';
    /** Sort direction */
    direction: 'asc' | 'desc';
  };
}

/**
 * Parameter filter configuration
 */
export interface ParameterFilter {
  /** Show only required parameters */
  requiredOnly?: boolean;
  /** Group by category */
  groupByCategory?: boolean;
  /** Show advanced parameters */
  showAdvanced?: boolean;
  /** Search in parameter names/descriptions */
  search?: string;
}

/**
 * Multi-select option with metadata
 */
export interface SelectOption {
  /** Option value */
  value: ParameterValue;
  /** Option label */
  label: string;
  /** Option description */
  description?: string;
  /** Option disabled state */
  disabled?: boolean;
  /** Option group */
  group?: string;
  /** Option icon */
  icon?: React.ComponentType<{ className?: string }>;
  /** Option metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// VALIDATION AND ERROR TYPES
// =============================================================================

/**
 * Comprehensive validation errors
 */
export interface ValidationErrors {
  /** Template validation errors */
  template?: string;
  /** Name validation errors */
  name?: string;
  /** Description validation errors */
  description?: string;
  /** Parameter validation errors */
  parameters?: Record<string, string>;
  /** Output format validation errors */
  outputFormats?: string;
  /** Schedule validation errors */
  schedule?: {
    /** General schedule errors */
    general?: string;
    /** Recurring schedule errors */
    recurring?: Record<string, string>;
    /** Notification errors */
    notifications?: Record<string, string>;
  };
  /** Tag validation errors */
  tags?: string;
  /** Global form errors */
  global?: string[];
}

/**
 * Form validation result
 */
export interface FormValidationResult {
  /** Whether form is valid */
  isValid: boolean;
  /** Validation errors */
  errors: ValidationErrors;
  /** Validation warnings */
  warnings?: ValidationErrors;
  /** Fields that passed validation */
  validFields: string[];
  /** Fields that failed validation */
  invalidFields: string[];
}

// =============================================================================
// EVENT HANDLER TYPES
// =============================================================================

/**
 * Parameter change event handler
 */
export type ParameterChangeHandler = (key: string, value: ParameterValue) => void;

/**
 * Step navigation event handler
 */
export type StepNavigationHandler = (step: number, direction: 'next' | 'previous' | 'jump') => void;

/**
 * Template selection event handler
 */
export type TemplateSelectionHandler = (template: ReportTemplate) => void;

/**
 * Form submission event handler
 */
export type FormSubmissionHandler = (data: ReportFormData) => Promise<void>;

/**
 * Validation event handler
 */
export type ValidationHandler = (field?: string) => FormValidationResult;

// Types are already exported as interfaces above