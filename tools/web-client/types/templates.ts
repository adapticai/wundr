/**
 * Template System Type Definitions
 *
 * Comprehensive type definitions for template customization, code generation,
 * and service template management to replace all 'any' types in template components.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

// =============================================================================
// SERVICE TEMPLATE TYPES
// =============================================================================

/**
 * Service template definition
 */
export interface ServiceTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template version */
  version: string;
  /** Template category */
  category:
    | 'api'
    | 'frontend'
    | 'backend'
    | 'database'
    | 'integration'
    | 'microservice'
    | 'monolith'
    | 'Serverless'
    | 'Real-time';
  /** Template type */
  type:
    | 'rest-api'
    | 'graphql'
    | 'react-app'
    | 'node-service'
    | 'express-api'
    | 'next-app'
    | 'custom';
  /** Template language */
  language: string;
  /** Template framework */
  framework: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Template files */
  files: TemplateFile[];
  /** Template dependencies */
  dependencies: (string | TemplateDependency)[];
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Template configuration */
  configuration: TemplateConfiguration;
  /** Template author */
  author?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Template tags */
  tags: string[];
  /** Template preview */
  preview?: TemplatePreview;
  /** Template difficulty */
  difficulty?: string;
  /** Template code preview */
  codePreview?: string;
  /** Template usage statistics */
  usageStats?: {
    downloads: number;
    stars: number;
    lastUpdated: Date;
    monthly?: number;
    total?: number;
    trending?: boolean;
  };
  /** Template rating */
  rating?: number;
  /** Template downloads count */
  downloads?: number;
  /** Last updated timestamp */
  lastUpdated?: Date;
  /** Template features */
  features?: string[];
  /** Template documentation */
  documentation?: string;
}

/**
 * Template variable definition with validation
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Display label */
  label: string;
  /** Variable description */
  description?: string;
  /** Variable type */
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'object'
    | 'array';
  /** Default value */
  defaultValue?: TemplateVariableValue;
  /** Whether variable is required */
  required: boolean;
  /** Variable validation rules */
  validation?: TemplateVariableValidation;
  /** Variable options for select types */
  options?: TemplateVariableOption[];
  /** Variable group for organization */
  group?: string;
  /** Variable dependencies */
  dependencies?: TemplateVariableDependency[];
  /** Variable formatting */
  format?: TemplateVariableFormat;
}

/**
 * Template variable value types
 */
export type TemplateVariableValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

/**
 * Template variable validation rules
 */
export interface TemplateVariableValidation {
  /** Minimum value/length */
  min?: number;
  /** Maximum value/length */
  max?: number;
  /** Regular expression pattern */
  pattern?: string;
  /** Custom validation function */
  custom?: (value: TemplateVariableValue) => boolean | string;
  /** Required when conditions */
  requiredWhen?: Array<{
    variable: string;
    value: TemplateVariableValue;
    operator:
      | 'equals'
      | 'not-equals'
      | 'contains'
      | 'greater-than'
      | 'less-than';
  }>;
}

/**
 * Template variable option for select types
 */
export interface TemplateVariableOption {
  /** Option value */
  value: TemplateVariableValue;
  /** Option label */
  label: string;
  /** Option description */
  description?: string;
  /** Option disabled state */
  disabled?: boolean;
  /** Option group */
  group?: string;
}

/**
 * Template variable dependency
 */
export interface TemplateVariableDependency {
  /** Dependent variable name */
  variable: string;
  /** Dependency condition */
  condition: {
    /** Comparison operator */
    operator:
      | 'equals'
      | 'not-equals'
      | 'contains'
      | 'greater-than'
      | 'less-than';
    /** Comparison value */
    value: TemplateVariableValue;
  };
  /** Action when condition is met */
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional';
}

/**
 * Template variable formatting options
 */
export interface TemplateVariableFormat {
  /** Input placeholder */
  placeholder?: string;
  /** Input mask */
  mask?: string;
  /** Display format */
  display?: 'text' | 'password' | 'email' | 'url' | 'tel' | 'color' | 'file';
  /** Number formatting */
  number?: {
    /** Decimal places */
    decimals?: number;
    /** Thousands separator */
    thousands?: string;
    /** Decimal separator */
    decimal?: string;
    /** Currency symbol */
    currency?: string;
  };
}

/**
 * Template file definition
 */
export interface TemplateFile {
  /** File path relative to template root */
  path: string;
  /** File content template */
  content: string;
  /** File type */
  type: 'template' | 'static' | 'binary';
  /** File encoding */
  encoding?: 'utf8' | 'base64' | 'binary';
  /** File permissions */
  permissions?: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  /** File conditions for inclusion */
  conditions?: Array<{
    variable: string;
    value: TemplateVariableValue;
    operator: 'equals' | 'not-equals' | 'contains';
  }>;
  /** File metadata */
  metadata?: {
    /** File description */
    description?: string;
    /** File category */
    category?: string;
    /** File tags */
    tags?: string[];
  };
}

/**
 * Template dependency definition
 */
export interface TemplateDependency {
  /** Dependency name */
  name: string;
  /** Dependency version */
  version: string;
  /** Dependency type */
  type:
    | 'npm'
    | 'pip'
    | 'gem'
    | 'maven'
    | 'nuget'
    | 'cargo'
    | 'go-mod'
    | 'composer';
  /** Whether dependency is dev-only */
  devDependency?: boolean;
  /** Dependency description */
  description?: string;
  /** Dependency conditions */
  conditions?: Array<{
    variable: string;
    value: TemplateVariableValue;
    operator: 'equals' | 'not-equals' | 'contains';
  }>;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  /** Template author information */
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Template license */
  license?: string;
  /** Template documentation URL */
  documentation?: string;
  /** Template repository URL */
  repository?: string;
  /** Template homepage URL */
  homepage?: string;
  /** Template keywords */
  keywords: string[];
  /** Template complexity rating */
  complexity: 'simple' | 'medium' | 'complex';
  /** Estimated setup time in minutes */
  estimatedSetupTime: number;
  /** Template maturity level */
  maturity: 'experimental' | 'beta' | 'stable' | 'deprecated';
}

/**
 * Template configuration
 */
export interface TemplateConfiguration {
  /** Output directory structure */
  outputStructure: {
    /** Base directory name */
    baseDirectory: string;
    /** Whether to create subdirectories */
    createSubdirectories: boolean;
    /** Directory naming convention */
    namingConvention: 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';
  };
  /** Code generation settings */
  codeGeneration: {
    /** Indentation type */
    indentation: 'spaces' | 'tabs';
    /** Indentation size */
    indentationSize: number;
    /** Line ending type */
    lineEndings: 'lf' | 'crlf' | 'cr';
    /** Maximum line length */
    maxLineLength: number;
    /** Code formatting enabled */
    formatting: boolean;
  };
  /** Build system configuration */
  buildSystem?: {
    /** Build tool */
    tool:
      | 'webpack'
      | 'vite'
      | 'rollup'
      | 'parcel'
      | 'esbuild'
      | 'tsc'
      | 'babel';
    /** Build configuration */
    configuration: Record<string, unknown>;
  };
  /** Testing configuration */
  testing?: {
    /** Testing framework */
    framework:
      | 'jest'
      | 'vitest'
      | 'mocha'
      | 'jasmine'
      | 'cypress'
      | 'playwright';
    /** Test configuration */
    configuration: Record<string, unknown>;
  };
}

/**
 * Template preview information
 */
export interface TemplatePreview {
  /** Preview images */
  images: string[];
  /** Preview description */
  description: string;
  /** Live demo URL */
  demoUrl?: string;
  /** Preview code snippets */
  codeSnippets: Array<{
    /** Snippet title */
    title: string;
    /** Snippet code */
    code: string;
    /** Programming language */
    language: string;
  }>;
}

// =============================================================================
// CUSTOMIZATION TYPES
// =============================================================================

/**
 * Template customization data
 */
export interface TemplateCustomizations {
  /** Project name */
  projectName?: string;
  /** Package name */
  packageName?: string;
  /** Package version */
  version?: string;
  /** Package description */
  description?: string;
  /** Package author */
  author?: string;
  /** Template variables values */
  variables: Record<string, TemplateVariableValue>;
  /** Selected options */
  options: {
    /** Output format */
    outputFormat: 'zip' | 'tar' | 'directory';
    /** Include documentation */
    includeDocumentation: boolean;
    /** Include tests */
    includeTests: boolean;
    /** Include examples */
    includeExamples: boolean;
    /** Code formatting */
    formatCode: boolean;
  };
  /** Feature configurations */
  features?: {
    authentication?: boolean;
    database?: boolean;
    validation?: boolean;
    logging?: boolean;
    testing?: boolean;
    docker?: boolean;
    kubernetes?: boolean;
    monitoring?: boolean;
    caching?: boolean;
    ratelimiting?: boolean;
  };
  /** Database configuration */
  database?: {
    type?: string;
    host?: string;
    port?: string;
    name?: string;
  };
  /** Authentication configuration */
  authentication?: {
    strategy?: string;
    provider?: string;
    tokenExpiry?: string;
  };
  /** API configuration */
  api?: {
    version?: string;
    prefix?: string;
    cors?: boolean;
    helmet?: boolean;
  };
  /** Deployment configuration */
  deployment?: {
    platform?: string;
    environment?: string;
    replicas?: number;
    registry?: string;
  };
  /** Custom files to include */
  customFiles?: Array<{
    /** File path */
    path: string;
    /** File content */
    content: string;
    /** File type */
    type: 'text' | 'binary';
  }>;
  /** Override settings */
  overrides?: {
    /** Dependency versions */
    dependencies?: Record<string, string>;
    /** Configuration overrides */
    configuration?: Record<string, unknown>;
  };
}

/**
 * Code generation context
 */
export interface CodeGenerationContext {
  /** Template being used */
  template: ServiceTemplate;
  /** Customization data */
  customizations: TemplateCustomizations;
  /** Generation metadata */
  metadata: {
    /** Generation timestamp */
    timestamp: Date;
    /** Generator version */
    generatorVersion: string;
    /** User information */
    user?: UserInfo;
    /** Project information */
    project?: ProjectInfo;
  };
  /** Generation options */
  options: {
    /** Output directory */
    outputDirectory: string;
    /** Overwrite existing files */
    overwriteExisting: boolean;
    /** Create backup */
    createBackup: boolean;
    /** Validate output */
    validateOutput: boolean;
  };
}

/**
 * User information for code generation
 */
export interface UserInfo {
  /** User identifier */
  id: string;
  /** User name */
  name: string;
  /** User email */
  email: string;
  /** User preferences */
  preferences?: {
    /** Preferred language */
    language?: string;
    /** Preferred framework */
    framework?: string;
    /** Code style preferences */
    codeStyle?: Record<string, unknown>;
  };
}

/**
 * Project information for code generation
 */
export interface ProjectInfo {
  /** Project name */
  name: string;
  /** Project description */
  description?: string;
  /** Project version */
  version?: string;
  /** Project license */
  license?: string;
  /** Project repository */
  repository?: string;
  /** Project homepage */
  homepage?: string;
}

// =============================================================================
// GENERATION RESULT TYPES
// =============================================================================

/**
 * Code generation result
 */
export interface CodeGenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated files */
  files: GeneratedFile[];
  /** Generation metadata */
  metadata: {
    /** Generation duration in milliseconds */
    duration: number;
    /** Template used */
    templateId: string;
    /** Template version */
    templateVersion: string;
    /** Generated at timestamp */
    generatedAt: Date;
  };
  /** Generation errors */
  errors: CodeGenerationError[];
  /** Generation warnings */
  warnings: CodeGenerationWarning[];
  /** Output summary */
  summary: {
    /** Total files generated */
    totalFiles: number;
    /** Total lines of code */
    totalLines: number;
    /** File types generated */
    fileTypes: Record<string, number>;
    /** Dependencies added */
    dependencies: string[];
  };
}

/**
 * Generated file information
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** File size in bytes */
  size: number;
  /** File type */
  type: string;
  /** File checksum */
  checksum: string;
  /** File metadata */
  metadata: {
    /** Template file that generated this */
    sourceTemplate?: string;
    /** Variable values used */
    variables?: Record<string, TemplateVariableValue>;
    /** Generation timestamp */
    generatedAt: Date;
  };
}

/**
 * Code generation error
 */
export interface CodeGenerationError {
  /** Error type */
  type: 'template' | 'variable' | 'file' | 'dependency' | 'validation';
  /** Error message */
  message: string;
  /** File path where error occurred */
  filePath?: string;
  /** Line number where error occurred */
  line?: number;
  /** Column number where error occurred */
  column?: number;
  /** Error details */
  details?: Record<string, unknown>;
  /** Error stack trace */
  stack?: string;
}

/**
 * Code generation warning
 */
export interface CodeGenerationWarning {
  /** Warning type */
  type: 'deprecated' | 'performance' | 'compatibility' | 'style';
  /** Warning message */
  message: string;
  /** File path where warning occurred */
  filePath?: string;
  /** Warning details */
  details?: Record<string, unknown>;
}

// =============================================================================
// ACCESS TOKEN TYPES
// =============================================================================

/**
 * Access token generation data
 */
export interface AccessTokenData {
  /** Token value */
  token: string;
  /** Token type */
  type: 'bearer' | 'basic' | 'api-key';
  /** Token expiration timestamp */
  expiresAt: Date;
  /** Token scope */
  scope: string[];
  /** Token issuer */
  issuer: string;
  /** Token subject (user ID) */
  subject: string;
  /** Token claims */
  claims?: Record<string, unknown>;
}

/**
 * Token generation options
 */
export interface TokenGenerationOptions {
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token scope */
  scope: string[];
  /** Additional claims */
  claims?: Record<string, unknown>;
  /** Token algorithm */
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  /** Token issuer */
  issuer?: string;
}

// =============================================================================
// EVENT HANDLER TYPES
// =============================================================================

/**
 * Template generation event handler
 */
export type TemplateGenerationHandler = (
  template: ServiceTemplate,
  customizations: TemplateCustomizations
) => void | Promise<void>;

/**
 * Variable change event handler
 */
export type VariableChangeHandler = (
  variableName: string,
  value: TemplateVariableValue,
  context: TemplateCustomizations
) => void;

/**
 * Template selection event handler
 */
export type TemplateSelectionHandler = (template: ServiceTemplate) => void;

/**
 * Generation progress event handler
 */
export type GenerationProgressHandler = (progress: {
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current step description */
  step: string;
  /** Total steps */
  totalSteps: number;
  /** Current step number */
  currentStep: number;
}) => void;

// Types are already exported as interfaces above
