import { z } from 'zod';

/**
 * Severity levels for security events and findings
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Trust levels for content sources
 */
export type TrustLevel = 'untrusted' | 'semi-trusted' | 'trusted' | 'system';

/**
 * Action types that can be intercepted
 */
export type ActionType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'network_request'
  | 'code_execution'
  | 'database_query'
  | 'system_command'
  | 'api_call'
  | 'custom';

/**
 * Specific parameter types for each action type.
 * These provide type-safe parameters for security-critical actions.
 */
export interface FileReadParameters {
  path: string;
  encoding?: BufferEncoding;
}

export interface FileWriteParameters {
  path: string;
  content: string | Buffer;
  encoding?: BufferEncoding;
  mode?: number;
}

export interface FileDeleteParameters {
  path: string;
  recursive?: boolean;
}

export interface NetworkRequestParameters {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string | Record<string, string | number | boolean | null>;
  timeout?: number;
}

export interface CodeExecutionParameters {
  code: string;
  language: string;
  timeout?: number;
  sandbox?: boolean;
}

export interface DatabaseQueryParameters {
  query: string;
  params?: Array<string | number | boolean | null>;
  database?: string;
}

export interface SystemCommandParameters {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ApiCallParameters {
  endpoint: string;
  method: string;
  payload?: Record<string, string | number | boolean | null | undefined>;
}

export interface CustomActionParameters {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | string[]
    | number[];
}

/**
 * Map of action types to their specific parameter types
 */
export interface ActionParameterMap {
  file_read: FileReadParameters;
  file_write: FileWriteParameters;
  file_delete: FileDeleteParameters;
  network_request: NetworkRequestParameters;
  code_execution: CodeExecutionParameters;
  database_query: DatabaseQueryParameters;
  system_command: SystemCommandParameters;
  api_call: ApiCallParameters;
  custom: CustomActionParameters;
}

/**
 * Generic action parameters type - union of all specific parameter types
 */
export type ActionParameters = ActionParameterMap[ActionType];

/**
 * Decision made by the action interceptor
 */
export type ActionDecision =
  | 'allow'
  | 'deny'
  | 'require_confirmation'
  | 'sandbox';

/**
 * Configuration for the security system
 */
export interface SecurityConfig {
  /**
   * Enable or disable the security system
   */
  enabled: boolean;

  /**
   * Strict mode enables more aggressive filtering
   */
  strictMode: boolean;

  /**
   * Maximum input length allowed (in characters)
   */
  maxInputLength: number;

  /**
   * Maximum output length allowed (in characters)
   */
  maxOutputLength: number;

  /**
   * Patterns to detect prompt injection attempts
   */
  injectionPatterns: string[];

  /**
   * Sensitive data patterns for redaction
   */
  sensitivePatterns: SensitiveDataPattern[];

  /**
   * Action interception rules
   */
  actionRules: ActionRule[];

  /**
   * Context minimization settings
   */
  contextSettings: ContextSettings;

  /**
   * Audit logging configuration
   */
  auditConfig: AuditConfig;
}

/**
 * Pattern definition for sensitive data detection
 */
export interface SensitiveDataPattern {
  /**
   * Unique identifier for the pattern
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Regular expression pattern
   */
  pattern: string;

  /**
   * Replacement string for redaction
   */
  replacement: string;

  /**
   * Whether this pattern is enabled
   */
  enabled: boolean;

  /**
   * Severity level if this pattern is matched
   */
  severity: Severity;
}

/**
 * Rule for action interception
 */
export interface ActionRule {
  /**
   * Unique identifier for the rule
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Action types this rule applies to
   */
  actionTypes: ActionType[];

  /**
   * Condition expression (evaluated at runtime)
   */
  condition?: string;

  /**
   * Decision to make when rule matches
   */
  decision: ActionDecision;

  /**
   * Priority (higher priority rules evaluated first)
   */
  priority: number;

  /**
   * Whether this rule is enabled
   */
  enabled: boolean;

  /**
   * Optional reason for the decision
   */
  reason?: string;
}

/**
 * Settings for context minimization
 */
export interface ContextSettings {
  /**
   * Enable context separation
   */
  enableSeparation: boolean;

  /**
   * Maximum context size in tokens (approximate)
   */
  maxContextTokens: number;

  /**
   * Separator string for context boundaries
   */
  contextSeparator: string;

  /**
   * Tags to identify trusted content
   */
  trustedTags: string[];

  /**
   * Tags to identify untrusted content
   */
  untrustedTags: string[];
}

/**
 * Configuration for audit logging
 */
export interface AuditConfig {
  /**
   * Enable audit logging
   */
  enabled: boolean;

  /**
   * Log security events
   */
  logSecurityEvents: boolean;

  /**
   * Log action interceptions
   */
  logActionInterceptions: boolean;

  /**
   * Log sanitization events
   */
  logSanitization: boolean;

  /**
   * Include input/output in logs (may contain sensitive data)
   */
  includeContent: boolean;
}

/**
 * Allowed metadata value types for security auditing
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | Date
  | string[]
  | number[];

/**
 * Strongly-typed metadata for action auditing
 */
export interface ActionMetadata {
  /**
   * Request ID for tracing
   */
  requestId?: string;
  /**
   * User agent string if from HTTP request
   */
  userAgent?: string;
  /**
   * IP address of the requester
   */
  ipAddress?: string;
  /**
   * Correlation ID for distributed tracing
   */
  correlationId?: string;
  /**
   * Tags for categorization
   */
  tags?: string[];
  /**
   * Additional custom metadata (restricted types for security)
   */
  [key: string]: MetadataValue | undefined;
}

/**
 * An action to be executed (before interception)
 */
export interface Action<T extends ActionType = ActionType> {
  /**
   * Unique identifier for this action instance
   */
  id: string;

  /**
   * Type of action
   */
  type: T;

  /**
   * Target resource (file path, URL, etc.)
   */
  target: string;

  /**
   * Action parameters - type-safe based on action type
   */
  parameters: T extends keyof ActionParameterMap
    ? ActionParameterMap[T]
    : ActionParameters;

  /**
   * Source of the action request
   */
  source: ActionSource;

  /**
   * Timestamp when action was requested
   */
  timestamp: Date;

  /**
   * Additional metadata with restricted types for security
   */
  metadata?: ActionMetadata;
}

/**
 * Source information for an action
 */
export interface ActionSource {
  /**
   * Origin of the request (user, llm, system, etc.)
   */
  origin: 'user' | 'llm' | 'system' | 'plugin';

  /**
   * Trust level of the source
   */
  trustLevel: TrustLevel;

  /**
   * Session or context identifier
   */
  sessionId?: string;

  /**
   * User identifier if applicable
   */
  userId?: string;
}

/**
 * Result of secure action execution
 */
export interface SecureActionResult<T = unknown> {
  /**
   * Whether the action was allowed to execute
   */
  allowed: boolean;

  /**
   * Decision made by the interceptor
   */
  decision: ActionDecision;

  /**
   * Result of the action if executed
   */
  result?: T;

  /**
   * Error if action failed
   */
  error?: Error;

  /**
   * Reason for the decision
   */
  reason?: string;

  /**
   * Rules that matched this action
   */
  matchedRules: string[];

  /**
   * Audit trail for this action
   */
  auditTrail: AuditEntry[];
}

/**
 * Allowed audit detail value types for security logging
 */
export type AuditDetailValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | ActionDecision;

/**
 * Strongly-typed audit details
 */
export interface AuditDetails {
  /**
   * Action ID being audited
   */
  actionId?: string;
  /**
   * Action type
   */
  actionType?: ActionType;
  /**
   * Target resource
   */
  target?: string;
  /**
   * Rule ID that was matched
   */
  ruleId?: string;
  /**
   * Decision made
   */
  decision?: ActionDecision;
  /**
   * Reason for the decision
   */
  reason?: string;
  /**
   * Rules that matched
   */
  matchedRules?: string[];
  /**
   * Duration in milliseconds
   */
  duration?: number;
  /**
   * Whether action was allowed
   */
  allowed?: boolean;
  /**
   * Additional custom details (restricted types)
   */
  [key: string]: AuditDetailValue | undefined;
}

/**
 * Entry in the audit trail
 */
export interface AuditEntry {
  /**
   * Timestamp of the entry
   */
  timestamp: Date;

  /**
   * Event type
   */
  event: string;

  /**
   * Description of what happened
   */
  description: string;

  /**
   * Additional details with restricted types for security
   */
  details?: AuditDetails;
}

/**
 * Separated context containing trusted and untrusted content
 */
export interface SeparatedContext {
  /**
   * Trusted content (system prompts, verified instructions)
   */
  trusted: ContextSection[];

  /**
   * Untrusted content (user input, external data)
   */
  untrusted: ContextSection[];

  /**
   * Metadata about the separation
   */
  metadata: ContextMetadata;
}

/**
 * A section of context content
 */
export interface ContextSection {
  /**
   * Unique identifier for this section
   */
  id: string;

  /**
   * Content of this section
   */
  content: string;

  /**
   * Trust level of this section
   */
  trustLevel: TrustLevel;

  /**
   * Source of this content
   */
  source: string;

  /**
   * Tags associated with this section
   */
  tags: string[];

  /**
   * Whether this section has been sanitized
   */
  sanitized: boolean;
}

/**
 * Metadata about context separation
 */
export interface ContextMetadata {
  /**
   * Total number of sections
   */
  totalSections: number;

  /**
   * Number of trusted sections
   */
  trustedSections: number;

  /**
   * Number of untrusted sections
   */
  untrustedSections: number;

  /**
   * Approximate token count
   */
  approximateTokens: number;

  /**
   * Timestamp of separation
   */
  separatedAt: Date;

  /**
   * Warnings generated during separation
   */
  warnings: string[];
}

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  /**
   * Sanitized content
   */
  sanitized: string;

  /**
   * Original content
   */
  original: string;

  /**
   * Whether any modifications were made
   */
  modified: boolean;

  /**
   * Findings from sanitization
   */
  findings: SanitizationFinding[];

  /**
   * Statistics about the sanitization
   */
  stats: SanitizationStats;
}

/**
 * A finding from sanitization
 */
export interface SanitizationFinding {
  /**
   * Type of finding
   */
  type:
    | 'injection_attempt'
    | 'sensitive_data'
    | 'dangerous_pattern'
    | 'encoding_issue';

  /**
   * Pattern that matched
   */
  pattern: string;

  /**
   * Position in the original content
   */
  position: number;

  /**
   * Length of the match
   */
  length: number;

  /**
   * Severity of the finding
   */
  severity: Severity;

  /**
   * Description of the finding
   */
  description: string;
}

/**
 * Statistics from sanitization
 */
export interface SanitizationStats {
  /**
   * Number of patterns checked
   */
  patternsChecked: number;

  /**
   * Number of matches found
   */
  matchesFound: number;

  /**
   * Number of replacements made
   */
  replacementsMade: number;

  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
}

/**
 * Result of output filtering
 */
export interface FilteredOutput {
  /**
   * Filtered content
   */
  content: string;

  /**
   * Original content
   */
  original: string;

  /**
   * Whether any content was filtered
   */
  filtered: boolean;

  /**
   * Redactions made
   */
  redactions: Redaction[];

  /**
   * Statistics about filtering
   */
  stats: FilterStats;
}

/**
 * A redaction made during filtering
 */
export interface Redaction {
  /**
   * Type of data redacted
   */
  type: string;

  /**
   * Position in original content
   */
  position: number;

  /**
   * Length of original content
   */
  originalLength: number;

  /**
   * Replacement used
   */
  replacement: string;

  /**
   * Severity of the redaction
   */
  severity: Severity;
}

/**
 * Statistics from output filtering
 */
export interface FilterStats {
  /**
   * Number of patterns checked
   */
  patternsChecked: number;

  /**
   * Number of redactions made
   */
  redactionsMade: number;

  /**
   * Characters removed
   */
  charactersRemoved: number;

  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  /**
   * Overall risk level
   */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';

  /**
   * Individual findings
   */
  findings: SanitizationFinding[];

  /**
   * Recommended action
   */
  recommendation: string;
}

// Zod schemas for runtime validation

/**
 * Zod schema for SecurityConfig validation
 */
export const SecurityConfigSchema = z.object({
  enabled: z.boolean(),
  strictMode: z.boolean(),
  maxInputLength: z.number().min(0),
  maxOutputLength: z.number().min(0),
  injectionPatterns: z.array(z.string()),
  sensitivePatterns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      pattern: z.string(),
      replacement: z.string(),
      enabled: z.boolean(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
    }),
  ),
  actionRules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      actionTypes: z.array(
        z.enum([
          'file_read',
          'file_write',
          'file_delete',
          'network_request',
          'code_execution',
          'database_query',
          'system_command',
          'api_call',
          'custom',
        ]),
      ),
      condition: z.string().optional(),
      decision: z.enum(['allow', 'deny', 'require_confirmation', 'sandbox']),
      priority: z.number(),
      enabled: z.boolean(),
      reason: z.string().optional(),
    }),
  ),
  contextSettings: z.object({
    enableSeparation: z.boolean(),
    maxContextTokens: z.number().min(0),
    contextSeparator: z.string(),
    trustedTags: z.array(z.string()),
    untrustedTags: z.array(z.string()),
  }),
  auditConfig: z.object({
    enabled: z.boolean(),
    logSecurityEvents: z.boolean(),
    logActionInterceptions: z.boolean(),
    logSanitization: z.boolean(),
    includeContent: z.boolean(),
  }),
});

/**
 * Zod schema for allowed parameter value types
 */
const ParameterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.array(z.number()),
  z.instanceof(Buffer),
]);

/**
 * Zod schema for action parameters with restricted types
 */
const ActionParametersSchema = z.record(
  z.string(),
  ParameterValueSchema.optional(),
);

/**
 * Zod schema for metadata value types
 */
const MetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.date(),
  z.array(z.string()),
  z.array(z.number()),
]);

/**
 * Zod schema for action metadata with restricted types
 */
const ActionMetadataSchema = z.record(
  z.string(),
  MetadataValueSchema.optional(),
);

/**
 * Zod schema for Action validation
 */
export const ActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'file_read',
    'file_write',
    'file_delete',
    'network_request',
    'code_execution',
    'database_query',
    'system_command',
    'api_call',
    'custom',
  ]),
  target: z.string(),
  parameters: ActionParametersSchema,
  source: z.object({
    origin: z.enum(['user', 'llm', 'system', 'plugin']),
    trustLevel: z.enum(['untrusted', 'semi-trusted', 'trusted', 'system']),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
  }),
  timestamp: z.date(),
  metadata: ActionMetadataSchema.optional(),
});

/**
 * Type for validated SecurityConfig
 */
export type ValidatedSecurityConfig = z.infer<typeof SecurityConfigSchema>;

/**
 * Type for validated Action
 */
export type ValidatedAction = z.infer<typeof ActionSchema>;
