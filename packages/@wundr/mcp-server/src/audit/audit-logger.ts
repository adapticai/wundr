/**
 * Audit Logger for MCP Server
 *
 * Provides comprehensive audit logging for tool invocations,
 * security events, and server operations.
 *
 * @packageDocumentation
 */

import type { Logger, ToolCallResult, ToolContext } from '../types';

// =============================================================================
// Audit Log Types
// =============================================================================

/**
 * Audit event severity levels
 */
export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit event categories
 */
export type AuditCategory =
  | 'tool_invocation'
  | 'resource_access'
  | 'prompt_usage'
  | 'authentication'
  | 'authorization'
  | 'configuration'
  | 'lifecycle'
  | 'error';

/**
 * Audit event outcome
 */
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'unknown';

/**
 * Base audit event structure
 */
export interface AuditEvent {
  /** Unique event identifier */
  readonly id: string;
  /** Event timestamp */
  readonly timestamp: Date;
  /** Event category */
  readonly category: AuditCategory;
  /** Event severity */
  readonly severity: AuditSeverity;
  /** Human-readable event description */
  readonly message: string;
  /** Event outcome */
  readonly outcome: AuditOutcome;
  /** Associated request ID */
  readonly requestId?: string;
  /** Principal who triggered the event */
  readonly principal?: AuditPrincipal;
  /** Resource involved in the event */
  readonly resource?: AuditResource;
  /** Event duration in milliseconds */
  readonly duration?: number;
  /** Additional event metadata */
  readonly metadata?: Record<string, unknown>;
  /** Error details if applicable */
  readonly error?: AuditError;
}

/**
 * Principal information for audit events
 */
export interface AuditPrincipal {
  /** Principal type */
  readonly type: 'user' | 'service' | 'anonymous' | 'system';
  /** Principal identifier */
  readonly id: string;
  /** Principal display name */
  readonly name?: string;
  /** Client IP address */
  readonly ipAddress?: string;
  /** User agent or client identifier */
  readonly userAgent?: string;
}

/**
 * Resource information for audit events
 */
export interface AuditResource {
  /** Resource type */
  readonly type: 'tool' | 'resource' | 'prompt' | 'server' | 'configuration';
  /** Resource name or identifier */
  readonly name: string;
  /** Resource URI if applicable */
  readonly uri?: string;
}

/**
 * Error information for audit events
 */
export interface AuditError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Stack trace (sanitized) */
  readonly stack?: string;
  /** Original error details */
  readonly details?: Record<string, unknown>;
}

/**
 * Tool invocation specific audit data
 */
export interface ToolInvocationAudit extends AuditEvent {
  readonly category: 'tool_invocation';
  /** Tool name */
  readonly toolName: string;
  /** Tool arguments (sanitized) */
  readonly arguments?: Record<string, unknown>;
  /** Tool result summary */
  readonly result?: ToolResultSummary;
}

/**
 * Tool result summary for audit logging
 */
export interface ToolResultSummary {
  /** Content type returned */
  readonly contentType: 'text' | 'image' | 'resource' | 'mixed';
  /** Content length or count */
  readonly contentLength: number;
  /** Whether the result was an error */
  readonly isError: boolean;
  /** Error message if applicable */
  readonly errorMessage?: string;
}

// =============================================================================
// Audit Logger Configuration
// =============================================================================

/**
 * Fields to exclude from audit logs (sensitive data)
 */
export interface SanitizationConfig {
  /** Fields to completely redact */
  readonly redactFields?: readonly string[];
  /** Fields to mask (show partial value) */
  readonly maskFields?: readonly string[];
  /** Maximum string length before truncation */
  readonly maxStringLength?: number;
  /** Maximum object depth for logging */
  readonly maxDepth?: number;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Logger instance for output */
  readonly logger?: Logger;
  /** Minimum severity to log */
  readonly minSeverity?: AuditSeverity;
  /** Whether to include arguments in tool invocation logs */
  readonly logArguments?: boolean;
  /** Whether to include results in tool invocation logs */
  readonly logResults?: boolean;
  /** Sanitization configuration */
  readonly sanitization?: SanitizationConfig;
  /** Custom event handler */
  readonly onEvent?: (event: AuditEvent) => void;
  /** Whether to emit events to stdout as JSON */
  readonly emitJson?: boolean;
  /** Server identifier for multi-instance deployments */
  readonly serverId?: string;
}

/**
 * Default sensitive fields to redact
 */
const DEFAULT_REDACT_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'credential',
  'private',
  'privateKey',
  'private_key',
];

/**
 * Default fields to mask
 */
const DEFAULT_MASK_FIELDS = [
  'email',
  'phone',
  'ssn',
  'creditCard',
  'credit_card',
];

// =============================================================================
// Audit Logger Implementation
// =============================================================================

/**
 * Audit Logger
 *
 * Provides comprehensive audit logging for MCP server operations.
 *
 * @example
 * ```typescript
 * const auditLogger = new AuditLogger({
 *   logger: serverLogger,
 *   logArguments: true,
 *   logResults: true,
 * });
 *
 * // Log tool invocation
 * auditLogger.logToolInvocation({
 *   requestId: 'req-123',
 *   toolName: 'drift_detection',
 *   arguments: { path: './src' },
 *   principal: { type: 'user', id: 'user-123' },
 *   outcome: 'success',
 *   duration: 150,
 * });
 * ```
 */
export class AuditLogger {
  private readonly config: Required<
    Omit<AuditLoggerConfig, 'logger' | 'onEvent'>
  > &
    Pick<AuditLoggerConfig, 'logger' | 'onEvent'>;

  private readonly severityOrder: Record<AuditSeverity, number> = {
    debug: 0,
    info: 1,
    warning: 2,
    error: 3,
    critical: 4,
  };

  /**
   * Create a new Audit Logger
   *
   * @param config - Logger configuration
   */
  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      minSeverity: config.minSeverity ?? 'info',
      logArguments: config.logArguments ?? false,
      logResults: config.logResults ?? false,
      sanitization: {
        redactFields:
          config.sanitization?.redactFields ?? DEFAULT_REDACT_FIELDS,
        maskFields: config.sanitization?.maskFields ?? DEFAULT_MASK_FIELDS,
        maxStringLength: config.sanitization?.maxStringLength ?? 1000,
        maxDepth: config.sanitization?.maxDepth ?? 5,
      },
      emitJson: config.emitJson ?? false,
      serverId: config.serverId ?? 'default',
      logger: config.logger,
      onEvent: config.onEvent,
    };
  }

  /**
   * Log a tool invocation event
   *
   * @param params - Tool invocation parameters
   */
  public logToolInvocation(params: {
    requestId?: string;
    toolName: string;
    arguments?: Record<string, unknown>;
    result?: ToolCallResult;
    principal?: AuditPrincipal;
    outcome: AuditOutcome;
    duration?: number;
    error?: Error;
  }): void {
    const event: ToolInvocationAudit = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'tool_invocation',
      severity: params.outcome === 'success' ? 'info' : 'error',
      message: `Tool invocation: ${params.toolName}`,
      outcome: params.outcome,
      requestId: params.requestId,
      principal: params.principal,
      toolName: params.toolName,
      duration: params.duration,
      resource: {
        type: 'tool',
        name: params.toolName,
      },
      arguments: this.config.logArguments
        ? (this.sanitize(params.arguments) as
            | Record<string, unknown>
            | undefined)
        : undefined,
      result: params.result
        ? this.summarizeToolResult(params.result)
        : undefined,
      error: params.error ? this.formatError(params.error) : undefined,
    };

    this.emitEvent(event);
  }

  /**
   * Log a resource access event
   *
   * @param params - Resource access parameters
   */
  public logResourceAccess(params: {
    requestId?: string;
    resourceUri: string;
    action: 'read' | 'subscribe' | 'unsubscribe';
    principal?: AuditPrincipal;
    outcome: AuditOutcome;
    duration?: number;
    error?: Error;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'resource_access',
      severity: params.outcome === 'success' ? 'info' : 'error',
      message: `Resource ${params.action}: ${params.resourceUri}`,
      outcome: params.outcome,
      requestId: params.requestId,
      principal: params.principal,
      resource: {
        type: 'resource',
        name: params.resourceUri,
        uri: params.resourceUri,
      },
      duration: params.duration,
      metadata: { action: params.action },
      error: params.error ? this.formatError(params.error) : undefined,
    };

    this.emitEvent(event);
  }

  /**
   * Log a prompt usage event
   *
   * @param params - Prompt usage parameters
   */
  public logPromptUsage(params: {
    requestId?: string;
    promptName: string;
    arguments?: Record<string, string>;
    principal?: AuditPrincipal;
    outcome: AuditOutcome;
    duration?: number;
    error?: Error;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'prompt_usage',
      severity: params.outcome === 'success' ? 'info' : 'error',
      message: `Prompt usage: ${params.promptName}`,
      outcome: params.outcome,
      requestId: params.requestId,
      principal: params.principal,
      resource: {
        type: 'prompt',
        name: params.promptName,
      },
      duration: params.duration,
      metadata: this.config.logArguments
        ? { arguments: params.arguments }
        : undefined,
      error: params.error ? this.formatError(params.error) : undefined,
    };

    this.emitEvent(event);
  }

  /**
   * Log an authorization event
   *
   * @param params - Authorization parameters
   */
  public logAuthorization(params: {
    requestId?: string;
    action: string;
    resource: AuditResource;
    principal?: AuditPrincipal;
    outcome: AuditOutcome;
    reason?: string;
    policy?: string;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'authorization',
      severity: params.outcome === 'success' ? 'info' : 'warning',
      message: `Authorization ${params.outcome}: ${params.action} on ${params.resource.name}`,
      outcome: params.outcome,
      requestId: params.requestId,
      principal: params.principal,
      resource: params.resource,
      metadata: {
        action: params.action,
        reason: params.reason,
        policy: params.policy,
      },
    };

    this.emitEvent(event);
  }

  /**
   * Log a lifecycle event
   *
   * @param params - Lifecycle event parameters
   */
  public logLifecycle(params: {
    action: 'start' | 'stop' | 'restart' | 'health_check' | 'shutdown';
    outcome: AuditOutcome;
    message?: string;
    metadata?: Record<string, unknown>;
    error?: Error;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'lifecycle',
      severity: params.outcome === 'success' ? 'info' : 'error',
      message: params.message ?? `Server ${params.action}`,
      outcome: params.outcome,
      principal: { type: 'system', id: this.config.serverId },
      resource: { type: 'server', name: this.config.serverId },
      metadata: params.metadata,
      error: params.error ? this.formatError(params.error) : undefined,
    };

    this.emitEvent(event);
  }

  /**
   * Log an error event
   *
   * @param params - Error parameters
   */
  public logError(params: {
    requestId?: string;
    error: Error;
    context?: string;
    principal?: AuditPrincipal;
    metadata?: Record<string, unknown>;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'error',
      severity: 'error',
      message: params.context
        ? `Error in ${params.context}: ${params.error.message}`
        : `Error: ${params.error.message}`,
      outcome: 'failure',
      requestId: params.requestId,
      principal: params.principal,
      metadata: params.metadata,
      error: this.formatError(params.error),
    };

    this.emitEvent(event);
  }

  /**
   * Log a custom audit event
   *
   * @param event - Custom event to log
   */
  public logCustomEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'> &
      Partial<Pick<AuditEvent, 'id' | 'timestamp'>>
  ): void {
    const fullEvent: AuditEvent = {
      ...event,
      id: event.id ?? this.generateEventId(),
      timestamp: event.timestamp ?? new Date(),
    };

    this.emitEvent(fullEvent);
  }

  /**
   * Create an audit context for tool invocation tracking
   *
   * @param toolName - Tool being invoked
   * @param context - Tool context from MCP
   * @param principal - Principal making the request
   * @returns Audit tracking object
   */
  public createToolInvocationTracker(
    toolName: string,
    context: ToolContext,
    principal?: AuditPrincipal
  ): ToolInvocationTracker {
    return new ToolInvocationTracker(this, toolName, context, principal);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `audit-${timestamp}-${random}`;
  }

  /**
   * Check if an event should be logged based on severity
   */
  private shouldLog(severity: AuditSeverity): boolean {
    return (
      this.severityOrder[severity] >=
      this.severityOrder[this.config.minSeverity]
    );
  }

  /**
   * Emit an audit event
   */
  private emitEvent(event: AuditEvent): void {
    if (!this.shouldLog(event.severity)) {
      return;
    }

    // Log to configured logger
    if (this.config.logger) {
      const logMethod = this.getLogMethod(event.severity);
      logMethod.call(this.config.logger, event.message, event);
    }

    // Emit JSON to stdout if configured
    if (this.config.emitJson) {
      const jsonEvent = {
        ...event,
        timestamp: event.timestamp.toISOString(),
        serverId: this.config.serverId,
      };
      console.log(JSON.stringify(jsonEvent));
    }

    // Call custom event handler
    this.config.onEvent?.(event);
  }

  /**
   * Get the appropriate log method for a severity level
   */
  private getLogMethod(
    severity: AuditSeverity
  ): (message: string, data?: unknown) => void {
    if (!this.config.logger) {
      return () => {};
    }

    switch (severity) {
      case 'debug':
        return this.config.logger.debug.bind(this.config.logger);
      case 'info':
        return this.config.logger.info.bind(this.config.logger);
      case 'warning':
        return this.config.logger.warning.bind(this.config.logger);
      case 'error':
        return this.config.logger.error.bind(this.config.logger);
      case 'critical':
        return this.config.logger.critical.bind(this.config.logger);
      default:
        return this.config.logger.info.bind(this.config.logger);
    }
  }

  /**
   * Sanitize an object for logging
   */
  private sanitize(obj: unknown, depth = 0): unknown {
    if (depth > (this.config.sanitization.maxDepth ?? 5)) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      const maxLen = this.config.sanitization.maxStringLength ?? 1000;
      return obj.length > maxLen
        ? obj.substring(0, maxLen) + '...[TRUNCATED]'
        : obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item, depth + 1));
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check redact fields
      if (
        this.config.sanitization.redactFields?.some(f =>
          lowerKey.includes(f.toLowerCase())
        )
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Check mask fields
      if (
        this.config.sanitization.maskFields?.some(f =>
          lowerKey.includes(f.toLowerCase())
        )
      ) {
        if (typeof value === 'string' && value.length > 4) {
          sanitized[key] =
            value.substring(0, 2) + '***' + value.substring(value.length - 2);
        } else {
          sanitized[key] = '[MASKED]';
        }
        continue;
      }

      // Recursively sanitize
      sanitized[key] = this.sanitize(value, depth + 1);
    }

    return sanitized;
  }

  /**
   * Summarize a tool result for audit logging
   */
  private summarizeToolResult(result: ToolCallResult): ToolResultSummary {
    const content = result.content;

    if (!content || content.length === 0) {
      return {
        contentType: 'text',
        contentLength: 0,
        isError: result.isError ?? false,
      };
    }

    // Determine content type
    const types = new Set(content.map(c => c.type));
    let contentType: 'text' | 'image' | 'resource' | 'mixed';

    if (types.size > 1) {
      contentType = 'mixed';
    } else if (types.has('text')) {
      contentType = 'text';
    } else if (types.has('image')) {
      contentType = 'image';
    } else {
      contentType = 'resource';
    }

    // Calculate content length
    let contentLength = 0;
    let errorMessage: string | undefined;

    for (const item of content) {
      if (item.type === 'text') {
        contentLength += item.text.length;
        if (result.isError) {
          errorMessage = item.text.substring(0, 200);
        }
      } else if (item.type === 'image') {
        contentLength += item.data.length;
      }
    }

    return {
      contentType,
      contentLength,
      isError: result.isError ?? false,
      errorMessage,
    };
  }

  /**
   * Format an error for audit logging
   */
  private formatError(error: Error): AuditError {
    return {
      code: (error as Error & { code?: string }).code ?? 'UNKNOWN_ERROR',
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }
}

// =============================================================================
// Tool Invocation Tracker
// =============================================================================

/**
 * Helper class for tracking tool invocations
 */
export class ToolInvocationTracker {
  private readonly auditLogger: AuditLogger;
  private readonly toolName: string;
  private readonly context: ToolContext;
  private readonly principal?: AuditPrincipal;
  private readonly startTime: number;
  private arguments?: Record<string, unknown>;

  constructor(
    auditLogger: AuditLogger,
    toolName: string,
    context: ToolContext,
    principal?: AuditPrincipal
  ) {
    this.auditLogger = auditLogger;
    this.toolName = toolName;
    this.context = context;
    this.principal = principal;
    this.startTime = Date.now();
  }

  /**
   * Set the tool arguments
   */
  public setArguments(args: Record<string, unknown>): void {
    this.arguments = args;
  }

  /**
   * Log successful completion
   */
  public success(result: ToolCallResult): void {
    this.auditLogger.logToolInvocation({
      requestId: String(this.context.requestId),
      toolName: this.toolName,
      arguments: this.arguments,
      result,
      principal: this.principal,
      outcome: 'success',
      duration: Date.now() - this.startTime,
    });
  }

  /**
   * Log failure
   */
  public failure(error: Error, result?: ToolCallResult): void {
    this.auditLogger.logToolInvocation({
      requestId: String(this.context.requestId),
      toolName: this.toolName,
      arguments: this.arguments,
      result,
      principal: this.principal,
      outcome: 'failure',
      duration: Date.now() - this.startTime,
      error,
    });
  }
}

/**
 * Create an audit logger with default configuration
 *
 * @param logger - Optional logger instance
 * @returns Configured audit logger
 */
export function createAuditLogger(logger?: Logger): AuditLogger {
  return new AuditLogger({ logger });
}
