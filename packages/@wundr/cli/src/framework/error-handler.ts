/**
 * CLI Error Handler - Centralized error handling with recovery suggestions.
 *
 * Provides:
 * - Typed error codes with hierarchical naming
 * - Contextual recovery suggestions for every error
 * - Consistent formatting across all commands
 * - Verbose mode stack traces
 * - Error wrapping for async operations
 * - Custom error handler registration for extensions
 *
 * @module framework/error-handler
 */

import chalk from 'chalk';

import type { CommandContext, CommandDefinition } from './command-interface';

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/**
 * Hierarchical error code type.
 *
 * Format: WUNDR_{DOMAIN}_{NUMBER}
 * Domain groups: CLI, DAEMON, CONFIG, AGENT, MEMORY, PLUGIN, BATCH, SETUP, AUDIT
 */
export type ErrorCode =
  // CLI errors
  | 'WUNDR_CLI_001' // Command not found
  | 'WUNDR_CLI_002' // Invalid arguments
  | 'WUNDR_CLI_003' // Missing required option
  | 'WUNDR_CLI_004' // Operation cancelled by user
  | 'WUNDR_CLI_005' // Not in a Wundr project directory
  // Daemon errors
  | 'WUNDR_DAEMON_001' // Daemon not running
  | 'WUNDR_DAEMON_002' // Daemon already running
  | 'WUNDR_DAEMON_003' // Port already in use
  | 'WUNDR_DAEMON_004' // Failed to start daemon
  | 'WUNDR_DAEMON_005' // Failed to stop daemon
  | 'WUNDR_DAEMON_006' // Daemon health check failed
  // Config errors
  | 'WUNDR_CONFIG_001' // Config file not found
  | 'WUNDR_CONFIG_002' // Config validation failed
  | 'WUNDR_CONFIG_003' // Config write failed
  | 'WUNDR_CONFIG_004' // Invalid config key path
  // Agent errors
  | 'WUNDR_AGENT_001' // Agent spawn failed
  | 'WUNDR_AGENT_002' // Agent not found
  | 'WUNDR_AGENT_003' // Agent already exists
  | 'WUNDR_AGENT_004' // Maximum agents exceeded
  | 'WUNDR_AGENT_005' // Agent communication failed
  // Memory errors
  | 'WUNDR_MEMORY_001' // Memory store not initialized
  | 'WUNDR_MEMORY_002' // Memory query failed
  | 'WUNDR_MEMORY_003' // Memory sync failed
  | 'WUNDR_MEMORY_004' // Embedding generation failed
  // Plugin errors
  | 'WUNDR_PLUGIN_001' // Plugin not found
  | 'WUNDR_PLUGIN_002' // Plugin install failed
  | 'WUNDR_PLUGIN_003' // Plugin incompatible
  | 'WUNDR_PLUGIN_004' // Plugin activation failed
  // Batch errors
  | 'WUNDR_BATCH_001' // Batch file not found
  | 'WUNDR_BATCH_002' // Batch validation failed
  | 'WUNDR_BATCH_003' // Batch execution failed
  | 'WUNDR_BATCH_004' // Batch timeout
  // Setup errors
  | 'WUNDR_SETUP_001' // Tool installation failed
  | 'WUNDR_SETUP_002' // Profile not found
  | 'WUNDR_SETUP_003' // Platform not supported
  | 'WUNDR_SETUP_004' // Insufficient permissions
  // Audit errors
  | 'WUNDR_AUDIT_001' // Audit scan failed
  | 'WUNDR_AUDIT_002' // Critical vulnerability found
  // System errors
  | 'WUNDR_SYS_001' // File not found
  | 'WUNDR_SYS_002' // Permission denied
  | 'WUNDR_SYS_003' // Network error
  | 'WUNDR_SYS_004' // Disk space insufficient
  // Generic fallback
  | string;

// ---------------------------------------------------------------------------
// Error Details
// ---------------------------------------------------------------------------

/**
 * Additional context attached to a CLI error.
 */
export interface ErrorDetails {
  /** The command that was running when the error occurred */
  command?: string;

  /** Relevant file path */
  file?: string;

  /** Relevant port number */
  port?: number;

  /** Process ID */
  pid?: number;

  /** Agent or session ID */
  entityId?: string;

  /** Plugin name */
  plugin?: string;

  /** Original error that caused this one */
  cause?: Error;

  /** Arbitrary additional context */
  [key: string]: unknown;
}

/**
 * Recovery suggestion displayed to the user.
 */
export interface RecoverySuggestion {
  /** Human-readable description of what to do */
  description: string;

  /** Optional command the user can run */
  command?: string;

  /** Optional documentation link */
  docLink?: string;
}

// ---------------------------------------------------------------------------
// CLI Error
// ---------------------------------------------------------------------------

/**
 * Typed CLI error with error code, details, and recovery suggestions.
 *
 * All framework-level errors should use this type. Commands create them
 * via `CliErrorHandler.createError()` and throw them; the handler
 * formats them for display.
 */
export class CliError extends Error {
  public readonly code: ErrorCode;
  public readonly details: ErrorDetails;
  public readonly suggestions: RecoverySuggestion[];
  public readonly recoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    details: ErrorDetails = {},
    suggestions: RecoverySuggestion[] = [],
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
    this.recoverable = recoverable;
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CliError);
    }
  }
}

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

/**
 * High-level error classification for routing error handling behavior.
 */
export type ErrorClassification =
  | 'user'
  | 'system'
  | 'network'
  | 'config'
  | 'plugin'
  | 'unknown';

/**
 * Classified error with category and recommended action.
 */
export interface ClassifiedError {
  classification: ErrorClassification;
  retryable: boolean;
  userFacing: boolean;
  exitCode: number;
}

/**
 * Classify an error code into a high-level category.
 *
 * User errors: bad input, missing args, invalid config values
 * System errors: file not found, permission denied, disk full
 * Network errors: connection refused, timeout, DNS failure
 * Config errors: missing config, validation failure
 * Plugin errors: plugin not found, incompatible, activation failure
 */
export function classifyError(code: ErrorCode): ClassifiedError {
  if (code.includes('_CLI_')) {
    return {
      classification: 'user',
      retryable: false,
      userFacing: true,
      exitCode: 1,
    };
  }
  if (code.includes('_CONFIG_')) {
    return {
      classification: 'config',
      retryable: false,
      userFacing: true,
      exitCode: 1,
    };
  }
  if (code.includes('_PLUGIN_')) {
    return {
      classification: 'plugin',
      retryable: true,
      userFacing: true,
      exitCode: 1,
    };
  }
  if (
    code === 'WUNDR_SYS_003' ||
    code.includes('ECONNREFUSED') ||
    code.includes('ETIMEDOUT') ||
    code.includes('ENOTFOUND')
  ) {
    return {
      classification: 'network',
      retryable: true,
      userFacing: true,
      exitCode: 2,
    };
  }
  if (code.startsWith('WUNDR_SYS_')) {
    return {
      classification: 'system',
      retryable: false,
      userFacing: true,
      exitCode: 3,
    };
  }
  if (code.includes('_DAEMON_003')) {
    return {
      classification: 'system',
      retryable: false,
      userFacing: true,
      exitCode: 3,
    };
  }
  return {
    classification: 'unknown',
    retryable: false,
    userFacing: true,
    exitCode: 1,
  };
}

/**
 * Classify any Error (including non-CliError) into a high-level category.
 */
export function classifyAnyError(error: Error): ClassifiedError {
  if (error instanceof CliError) {
    return classifyError(error.code);
  }

  // Check for system error codes
  const systemError = error as Error & { code?: string };
  if (systemError.code) {
    const mapping = SYSTEM_ERROR_MAP[systemError.code];
    if (mapping) {
      return classifyError(mapping.code);
    }
  }

  // Check message heuristics
  const msg = error.message.toLowerCase();
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('connection')
  ) {
    return {
      classification: 'network',
      retryable: true,
      userFacing: true,
      exitCode: 2,
    };
  }
  if (msg.includes('permission') || msg.includes('access denied')) {
    return {
      classification: 'system',
      retryable: false,
      userFacing: true,
      exitCode: 3,
    };
  }

  return {
    classification: 'unknown',
    retryable: false,
    userFacing: true,
    exitCode: 1,
  };
}

// ---------------------------------------------------------------------------
// Error Recovery Handler
// ---------------------------------------------------------------------------

/**
 * Custom error recovery handler for extending error handling.
 */
export interface ErrorRecoveryHandler {
  /** Whether this handler can handle the given error code */
  canHandle(code: ErrorCode): boolean;

  /**
   * Attempt to recover from the error.
   * Returns true if recovery succeeded, false otherwise.
   */
  recover(error: CliError, context: CommandContext): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Built-in Recovery Suggestions
// ---------------------------------------------------------------------------

const BUILT_IN_SUGGESTIONS: Record<string, RecoverySuggestion[]> = {
  WUNDR_CLI_001: [
    { description: 'Check available commands', command: 'wundr --help' },
    {
      description: 'Search for similar commands',
      command: 'wundr --help | grep <term>',
    },
  ],
  WUNDR_CLI_002: [
    { description: 'Check command syntax', command: 'wundr <command> --help' },
  ],
  WUNDR_CLI_005: [
    {
      description: 'Initialize a Wundr project',
      command: 'wundr init project',
    },
    { description: 'Navigate to your project directory first' },
  ],
  WUNDR_DAEMON_001: [
    { description: 'Start the orchestrator daemon', command: 'wundr start' },
    {
      description: 'Check daemon logs for errors',
      command: 'wundr orchestrator logs',
    },
  ],
  WUNDR_DAEMON_002: [
    { description: 'Check current daemon status', command: 'wundr status' },
    { description: 'Stop the running daemon first', command: 'wundr stop' },
  ],
  WUNDR_DAEMON_003: [
    { description: 'Use a different port', command: 'wundr start --port 9000' },
    { description: 'Check what is using the port', command: 'lsof -i :<port>' },
  ],
  WUNDR_DAEMON_004: [
    {
      description: 'Check if the orchestrator daemon module is installed',
      command: 'npm ls @wundr/orchestrator-daemon',
    },
    { description: 'View daemon logs', command: 'wundr orchestrator logs' },
  ],
  WUNDR_CONFIG_001: [
    { description: 'Create a default config', command: 'wundr config reset' },
    {
      description: 'Initialize a project with config',
      command: 'wundr init config',
    },
  ],
  WUNDR_CONFIG_002: [
    {
      description: 'Validate your configuration',
      command: 'wundr config validate',
    },
    {
      description: 'Reset to default configuration',
      command: 'wundr config reset --force',
    },
  ],
  WUNDR_CONFIG_004: [
    {
      description: 'View current config to find valid keys',
      command: 'wundr config show',
    },
  ],
  WUNDR_AGENT_001: [
    {
      description: 'Check that the daemon is running',
      command: 'wundr status',
    },
    {
      description: 'View agent limits in config',
      command: 'wundr config show',
    },
  ],
  WUNDR_AGENT_002: [
    { description: 'List active agents', command: 'wundr agent list' },
  ],
  WUNDR_AGENT_004: [
    {
      description: 'Stop idle agents to free slots',
      command: 'wundr agent list',
    },
    {
      description: 'Increase maxSessions in config',
      command: 'wundr orchestrator config set daemon.maxSessions=200',
    },
  ],
  WUNDR_MEMORY_001: [
    {
      description: 'Initialize the memory/RAG store',
      command: 'wundr init rag',
    },
    { description: 'Check RAG store status', command: 'wundr rag status' },
  ],
  WUNDR_MEMORY_003: [
    { description: 'Retry the sync operation', command: 'wundr rag sync' },
    {
      description: 'Prune and rebuild the store',
      command: 'wundr rag prune && wundr rag sync',
    },
  ],
  WUNDR_PLUGIN_001: [
    {
      description: 'Search available plugins',
      command: 'wundr plugin search <name>',
    },
    { description: 'List installed plugins', command: 'wundr plugin list' },
  ],
  WUNDR_PLUGIN_002: [
    { description: 'Check your network connection' },
    {
      description: 'Try installing with --force',
      command: 'wundr plugin install <name> --force',
    },
  ],
  WUNDR_BATCH_001: [
    { description: 'List available batch jobs', command: 'wundr batch list' },
    {
      description: 'Create a new batch job',
      command: 'wundr batch create <name>',
    },
  ],
  WUNDR_BATCH_002: [
    {
      description: 'Validate the batch file',
      command: 'wundr batch validate <file>',
    },
  ],
  WUNDR_SETUP_002: [
    {
      description: 'List available profiles',
      command: 'wundr setup --interactive',
    },
  ],
  WUNDR_SETUP_004: [
    { description: 'Run with elevated permissions if needed' },
    { description: 'Check file/directory permissions' },
  ],
  WUNDR_SYS_001: [
    { description: 'Check the file path and try again' },
    { description: 'Ensure you are in the correct directory' },
  ],
  WUNDR_SYS_002: [
    { description: 'Check file and directory permissions' },
    { description: 'Run with appropriate user privileges' },
  ],
  WUNDR_SYS_003: [
    { description: 'Check your internet connection' },
    { description: 'Check if a proxy is configured correctly' },
    { description: 'Retry the operation' },
  ],
};

// ---------------------------------------------------------------------------
// System Error Mappings
// ---------------------------------------------------------------------------

const SYSTEM_ERROR_MAP: Record<string, { code: ErrorCode; message: string }> = {
  ENOENT: { code: 'WUNDR_SYS_001', message: 'File or directory not found' },
  EACCES: { code: 'WUNDR_SYS_002', message: 'Permission denied' },
  EPERM: { code: 'WUNDR_SYS_002', message: 'Operation not permitted' },
  ECONNREFUSED: { code: 'WUNDR_SYS_003', message: 'Connection refused' },
  ENOTFOUND: { code: 'WUNDR_SYS_003', message: 'Host not found' },
  ETIMEDOUT: { code: 'WUNDR_SYS_003', message: 'Connection timed out' },
  ENOSPC: { code: 'WUNDR_SYS_004', message: 'Insufficient disk space' },
  EADDRINUSE: { code: 'WUNDR_DAEMON_003', message: 'Port already in use' },
};

// ---------------------------------------------------------------------------
// CLI Error Handler
// ---------------------------------------------------------------------------

export class CliErrorHandler {
  private customHandlers: ErrorRecoveryHandler[] = [];
  private customSuggestions: Map<string, RecoverySuggestion[]> = new Map();

  // -------------------------------------------------------------------------
  // Error Creation
  // -------------------------------------------------------------------------

  /**
   * Create a typed CLI error.
   *
   * @param code - Error code from the registry
   * @param message - Human-readable error message
   * @param details - Additional context
   * @param recoverable - Whether the error is potentially recoverable
   * @returns A CliError instance
   */
  createError(
    code: ErrorCode,
    message: string,
    details: ErrorDetails = {},
    recoverable: boolean = false
  ): CliError {
    const suggestions = this.getSuggestions(code);
    return new CliError(code, message, details, suggestions, recoverable);
  }

  /**
   * Wrap a system error (ENOENT, EACCES, etc.) into a CliError.
   *
   * @param error - The original system error
   * @param context - Additional context about what operation was being performed
   * @returns A CliError with appropriate code and suggestions
   */
  wrapSystemError(
    error: Error & { code?: string },
    context: string = ''
  ): CliError {
    const systemCode = error.code ?? '';
    const mapping = SYSTEM_ERROR_MAP[systemCode];

    if (mapping) {
      return this.createError(
        mapping.code,
        context ? `${context}: ${mapping.message}` : mapping.message,
        { cause: error },
        true
      );
    }

    // Unknown system error
    return this.createError(
      'WUNDR_CLI_002',
      context ? `${context}: ${error.message}` : error.message,
      { cause: error },
      false
    );
  }

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  /**
   * Handle a command execution error.
   *
   * Formats the error for display, including:
   * - Error code and message
   * - Context details
   * - Recovery suggestions
   * - Stack trace (in verbose mode)
   *
   * @param error - The error to handle
   * @param command - The command that was executing
   * @param context - The command context
   */
  handleCommandError(
    error: Error,
    command: CommandDefinition | undefined,
    context: CommandContext
  ): void {
    const verbose = context.globalOptions.verbose;
    const json = context.globalOptions.json;

    // JSON mode: output structured error
    if (json) {
      const errorData = this.toJson(error, command);
      console.error(JSON.stringify(errorData, null, 2));
      return;
    }

    // CLI error with full metadata
    if (error instanceof CliError) {
      this.formatCliError(error, verbose, command?.name);
      return;
    }

    // Plain error
    this.formatPlainError(error, verbose, command?.name);
  }

  /**
   * Wrap an async operation with consistent error handling.
   *
   * @param operation - The async operation to execute
   * @param errorContext - Context string for error messages
   * @param code - Error code to use if the operation fails
   * @returns The operation result
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorContext: string,
    code: ErrorCode = 'WUNDR_CLI_002'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }

      if (error instanceof Error) {
        const systemError = error as Error & { code?: string };
        if (systemError.code && SYSTEM_ERROR_MAP[systemError.code]) {
          throw this.wrapSystemError(systemError, errorContext);
        }
        throw this.createError(
          code,
          `${errorContext}: ${error.message}`,
          { cause: error },
          true
        );
      }

      throw this.createError(
        code,
        `${errorContext}: ${String(error)}`,
        {},
        false
      );
    }
  }

  // -------------------------------------------------------------------------
  // Custom Handlers
  // -------------------------------------------------------------------------

  /**
   * Register a custom error recovery handler.
   *
   * @param handler - The recovery handler
   */
  registerHandler(handler: ErrorRecoveryHandler): void {
    this.customHandlers.push(handler);
  }

  /**
   * Register custom recovery suggestions for an error code.
   *
   * @param code - Error code
   * @param suggestions - Recovery suggestions
   */
  registerSuggestions(code: string, suggestions: RecoverySuggestion[]): void {
    this.customSuggestions.set(code, suggestions);
  }

  /**
   * Attempt to recover from an error using registered handlers.
   *
   * @param error - The error to recover from
   * @param context - Command context
   * @returns Whether recovery was successful
   */
  async attemptRecovery(
    error: CliError,
    context: CommandContext
  ): Promise<boolean> {
    for (const handler of this.customHandlers) {
      if (handler.canHandle(error.code)) {
        try {
          const recovered = await handler.recover(error, context);
          if (recovered) {
            context.logger.success('Error recovered successfully.');
            return true;
          }
        } catch {
          // Recovery handler itself failed; continue to next
        }
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Get recovery suggestions for an error code, merging built-in and custom.
   */
  private getSuggestions(code: ErrorCode): RecoverySuggestion[] {
    const builtIn = BUILT_IN_SUGGESTIONS[code] ?? [];
    const custom = this.customSuggestions.get(code) ?? [];
    return [...builtIn, ...custom];
  }

  /**
   * Format a CliError for terminal display.
   */
  private formatCliError(
    error: CliError,
    verbose: boolean,
    commandName?: string
  ): void {
    // Header
    console.error('');
    console.error(chalk.red.bold('Error'));
    console.error(chalk.red(`  Code:    ${error.code}`));
    console.error(chalk.red(`  Message: ${error.message}`));

    if (commandName) {
      console.error(chalk.gray(`  Command: ${commandName}`));
    }

    // Details
    if (verbose && Object.keys(error.details).length > 0) {
      console.error(chalk.gray('\n  Details:'));
      for (const [key, value] of Object.entries(error.details)) {
        if (key === 'cause') continue; // Show cause separately
        console.error(
          chalk.gray(`    ${key}: ${this.formatDetailValue(value)}`)
        );
      }
    }

    // Suggestions
    if (error.suggestions.length > 0) {
      console.error('');
      if (error.recoverable) {
        console.error(chalk.yellow('  This error may be recoverable. Try:'));
      } else {
        console.error(chalk.yellow('  Suggestions:'));
      }

      for (const suggestion of error.suggestions) {
        if (suggestion.command) {
          console.error(chalk.yellow(`    - ${suggestion.description}`));
          console.error(chalk.cyan(`      $ ${suggestion.command}`));
        } else {
          console.error(chalk.yellow(`    - ${suggestion.description}`));
        }

        if (suggestion.docLink) {
          console.error(chalk.gray(`      Docs: ${suggestion.docLink}`));
        }
      }
    }

    // Stack trace in verbose mode
    if (verbose) {
      if (error.details.cause instanceof Error && error.details.cause.stack) {
        console.error(chalk.gray('\n  Caused by:'));
        console.error(chalk.gray(`    ${error.details.cause.message}`));
        const causeStack = error.details.cause.stack.split('\n').slice(1, 5);
        for (const line of causeStack) {
          console.error(chalk.gray(`    ${line.trim()}`));
        }
      }

      if (error.stack) {
        console.error(chalk.gray('\n  Stack trace:'));
        const stackLines = error.stack.split('\n').slice(1, 8);
        for (const line of stackLines) {
          console.error(chalk.gray(`    ${line.trim()}`));
        }
      }
    } else {
      console.error(chalk.gray('\n  Run with --verbose for more details.'));
    }

    console.error('');
  }

  /**
   * Format a plain Error for terminal display.
   */
  private formatPlainError(
    error: Error,
    verbose: boolean,
    commandName?: string
  ): void {
    console.error('');
    console.error(chalk.red.bold('Error'));
    console.error(chalk.red(`  ${error.message}`));

    if (commandName) {
      console.error(chalk.gray(`  Command: ${commandName}`));
    }

    if (verbose && error.stack) {
      console.error(chalk.gray('\n  Stack trace:'));
      const stackLines = error.stack.split('\n').slice(1, 8);
      for (const line of stackLines) {
        console.error(chalk.gray(`    ${line.trim()}`));
      }
    } else if (!verbose) {
      console.error(chalk.gray('\n  Run with --verbose for more details.'));
    }

    console.error('');
  }

  /**
   * Convert an error to a JSON-serializable object.
   */
  private toJson(
    error: Error,
    command?: CommandDefinition
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      error: true,
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    if (command) {
      base['command'] = command.name;
    }

    if (error instanceof CliError) {
      base['code'] = error.code;
      base['recoverable'] = error.recoverable;
      base['suggestions'] = error.suggestions;

      // Include non-Error details
      const safeDetails: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(error.details)) {
        if (value instanceof Error) {
          safeDetails[key] = { message: value.message, name: value.name };
        } else {
          safeDetails[key] = value;
        }
      }
      base['details'] = safeDetails;
    }

    return base;
  }

  /**
   * Format a detail value for display.
   */
  private formatDetailValue(value: unknown): string {
    if (value === null || value === undefined) return '(none)';
    if (value instanceof Error) return value.message;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
