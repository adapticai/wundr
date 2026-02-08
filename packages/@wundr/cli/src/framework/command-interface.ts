/**
 * Command Interface - Core types and contracts for the Wundr CLI framework.
 *
 * Every CLI command implements CommandDefinition. This provides:
 * - Consistent argument/option typing via generics
 * - Built-in validation before execution
 * - Structured output via CommandResult
 * - Optional rollback on failure
 * - Metadata for auto-generated help text and shell completions
 *
 * @module framework/command-interface
 */

import type { Command as CommanderCommand } from 'commander';

// ---------------------------------------------------------------------------
// Command Categories
// ---------------------------------------------------------------------------

/**
 * Grouping categories for commands. Used in help text and completion scripts.
 */
export type CommandCategory =
  | 'daemon'
  | 'agent'
  | 'memory'
  | 'config'
  | 'setup'
  | 'batch'
  | 'plugin'
  | 'governance'
  | 'analysis'
  | 'development'
  | 'monitoring';

/**
 * Human-readable labels for each category.
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  daemon: 'Daemon Management',
  agent: 'Agent Management',
  memory: 'Memory & RAG',
  config: 'Configuration',
  setup: 'Machine Setup',
  batch: 'Batch Operations',
  plugin: 'Plugin Management',
  governance: 'Governance & Compliance',
  analysis: 'Code Analysis',
  development: 'Development Tools',
  monitoring: 'Monitoring & Dashboard',
};

// ---------------------------------------------------------------------------
// Argument & Option Definitions
// ---------------------------------------------------------------------------

/**
 * Positional argument definition for a command.
 */
export interface ArgumentDefinition {
  /** Argument name (used in help text and as the key in parsed args) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Whether this argument is required */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: string;

  /**
   * Optional function that returns valid completions for this argument.
   * Used by shell completion generation.
   */
  completions?: () => Promise<string[]>;

  /** Variadic argument (collects remaining args into array) */
  variadic?: boolean;
}

/**
 * Option (flag) definition for a command.
 */
export interface OptionDefinition {
  /** Flag specification in Commander.js format, e.g. '-p, --port <number>' */
  flags: string;

  /** Human-readable description */
  description: string;

  /** Default value */
  defaultValue?: unknown;

  /**
   * Whether this option is required.
   * Commander marks it required; missing value causes an error before execute().
   */
  required?: boolean;

  /**
   * Allowed values. If set, Commander validates the value is in this set.
   */
  choices?: string[];

  /**
   * Environment variable that can provide this option's value.
   * Checked if the option is not passed on the command line.
   */
  envVar?: string;

  /**
   * Optional function that returns valid completions for this option.
   * Used by shell completion generation.
   */
  completions?: () => Promise<string[]>;

  /**
   * Whether this option conflicts with another option.
   * Validated before execute().
   */
  conflicts?: string[];
}

/**
 * Example usage shown in help text.
 */
export interface CommandExample {
  /** The command invocation */
  command: string;

  /** What this example demonstrates */
  description: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Result of command argument/option validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation error messages (empty when valid) */
  errors: ValidationError[];
}

/**
 * A single validation error with field context.
 */
export interface ValidationError {
  /** Which field (argument or option name) failed validation */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Suggestion for how to fix the error */
  suggestion?: string;
}

/**
 * Helper to create a passing validation result.
 */
export function validationOk(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Helper to create a failing validation result.
 */
export function validationFail(...errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Command Context
// ---------------------------------------------------------------------------

/**
 * Runtime context passed to every command's execute() method.
 *
 * The context is constructed by the CLI runner and contains references
 * to shared services. Commands should NOT import singletons directly;
 * instead they receive everything through context for testability.
 */
export interface CommandContext {
  /** Parsed global options (--verbose, --quiet, --json, etc.) */
  globalOptions: GlobalOptions;

  /** Logger instance respecting current verbosity */
  logger: ContextLogger;

  /** Output formatter for consistent display */
  formatter: OutputFormatterInterface;

  /** Configuration manager */
  config: ConfigManagerInterface;

  /** Current working directory */
  cwd: string;

  /** Whether running in a CI environment */
  ci: boolean;

  /** Whether stdout is a TTY (affects interactive features) */
  isTTY: boolean;

  /** Abort signal for graceful cancellation */
  signal?: AbortSignal;
}

/**
 * Global CLI options inherited by all commands.
 */
export interface GlobalOptions {
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  noColor: boolean;
  dryRun: boolean;
  config?: string;
}

/**
 * Minimal logger interface for command context.
 */
export interface ContextLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}

/**
 * Minimal output formatter interface for command context.
 * Full implementation is in output-formatter.ts.
 */
export interface OutputFormatterInterface {
  table(data: Record<string, unknown>[], options?: unknown): string;
  json(data: unknown, pretty?: boolean): string;
  keyValue(data: Record<string, unknown>): string;
  list(items: string[], ordered?: boolean): string;
  status(state: string, label: string): string;
  progressBar(current: number, total: number, width?: number): string;
}

/**
 * Minimal config manager interface for command context.
 */
export interface ConfigManagerInterface {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  loadConfig(path?: string): Promise<void>;
  saveConfig(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Command Result
// ---------------------------------------------------------------------------

/**
 * Structured result returned by every command's execute() method.
 *
 * Commands return data, not formatted strings. The CLI runner uses
 * the result + global options to determine final output format.
 */
export interface CommandResult<T = unknown> {
  /** Exit code. 0 = success, non-zero = failure. */
  exitCode: number;

  /**
   * Structured data payload. When --json is passed, this is serialized
   * directly. Otherwise the CLI runner uses the formatter.
   */
  data?: T;

  /** Human-readable message for non-JSON output */
  message?: string;

  /**
   * Warnings that should be displayed but don't constitute failure.
   */
  warnings?: string[];
}

/**
 * Helper to create a success result.
 */
export function commandSuccess<T>(data?: T, message?: string): CommandResult<T> {
  return { exitCode: 0, data, message };
}

/**
 * Helper to create a failure result.
 */
export function commandFailure(message: string, exitCode: number = 1): CommandResult {
  return { exitCode, message };
}

// ---------------------------------------------------------------------------
// Command Definition
// ---------------------------------------------------------------------------

/**
 * The core interface that every CLI command must implement.
 *
 * @typeParam TArgs - Shape of parsed positional arguments
 * @typeParam TOpts - Shape of parsed options
 * @typeParam TResult - Shape of the data payload in CommandResult
 *
 * @example
 * ```typescript
 * const statusCommand: CommandDefinition<{}, { json?: boolean }, DaemonStatus> = {
 *   name: 'status',
 *   description: 'Show orchestrator daemon status',
 *   category: 'daemon',
 *   options: [
 *     { flags: '--json', description: 'Output as JSON' },
 *   ],
 *   examples: [
 *     { command: 'wundr status', description: 'Show daemon status' },
 *     { command: 'wundr status --json', description: 'Get status as JSON' },
 *   ],
 *   async execute(_args, options, context) {
 *     const status = await getDaemonStatus();
 *     return commandSuccess(status, status.running ? 'Daemon is running' : 'Daemon is stopped');
 *   },
 * };
 * ```
 */
export interface CommandDefinition<
  TArgs = Record<string, unknown>,
  TOpts = Record<string, unknown>,
  TResult = unknown,
> {
  /** Unique command name. Use colon-separated for subcommands: 'agent:list' */
  name: string;

  /** Human-readable description shown in help text */
  description: string;

  /** Category for grouping in help output */
  category?: CommandCategory;

  /** Alternative names for this command */
  aliases?: string[];

  /**
   * Whether this command is hidden from help text.
   * Useful for deprecated or internal commands.
   */
  hidden?: boolean;

  /** Positional argument definitions */
  arguments?: ArgumentDefinition[];

  /** Option/flag definitions */
  options?: OptionDefinition[];

  /** Example invocations shown in help text */
  examples?: CommandExample[];

  /**
   * Subcommands nested under this command.
   * For example, 'agent' has subcommands 'list', 'spawn', 'stop'.
   */
  subcommands?: CommandDefinition[];

  /**
   * Validate parsed arguments and options before execution.
   *
   * Return `validationOk()` to proceed, or `validationFail(...)` to abort
   * with a helpful error message. If not provided, validation always passes.
   *
   * @param args - Parsed positional arguments
   * @param options - Parsed options
   * @param context - Command execution context
   */
  validate?(args: TArgs, options: TOpts, context: CommandContext): ValidationResult | Promise<ValidationResult>;

  /**
   * Execute the command.
   *
   * @param args - Parsed positional arguments
   * @param options - Parsed options
   * @param context - Command execution context
   * @returns Structured result with exit code and optional data
   */
  execute(args: TArgs, options: TOpts, context: CommandContext): Promise<CommandResult<TResult>>;

  /**
   * Optional cleanup when execute() throws or returns a non-zero exit code.
   * Use this to undo partial changes (e.g., remove a PID file on start failure).
   *
   * @param error - The error that caused the rollback
   * @param context - Command execution context
   */
  rollback?(error: Error, context: CommandContext): Promise<void>;
}

// ---------------------------------------------------------------------------
// Command Lifecycle Hooks
// ---------------------------------------------------------------------------

/**
 * Hook that runs before or after command execution.
 */
export interface CommandHook {
  /** When to run this hook */
  phase: 'preValidate' | 'postValidate' | 'preExecute' | 'postExecute';

  /**
   * Optional filter: only run this hook for specific commands.
   * If not provided, the hook runs for all commands.
   */
  commands?: string[];

  /**
   * The hook handler. Return false to abort the pipeline (preValidate/preExecute only).
   */
  handler(
    command: CommandDefinition,
    context: CommandContext,
    result?: CommandResult,
  ): Promise<void | boolean>;
}

// ---------------------------------------------------------------------------
// Command Module
// ---------------------------------------------------------------------------

/**
 * A command module is the unit of auto-discovery.
 *
 * Each file in the commands/ directory can export a `CommandModule` to be
 * automatically registered by the `CommandRegistry`.
 *
 * @example
 * ```typescript
 * // commands/status.ts
 * export const module: CommandModule = {
 *   command: statusCommand,
 *   hooks: [telemetryHook],
 * };
 * ```
 */
export interface CommandModule {
  /** The primary command definition */
  command: CommandDefinition;

  /** Optional lifecycle hooks specific to this command */
  hooks?: CommandHook[];
}

// ---------------------------------------------------------------------------
// Legacy Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter for wrapping existing Commander.js command functions into the
 * CommandDefinition interface. This enables incremental migration.
 *
 * @param name - Command name
 * @param description - Command description
 * @param factory - Existing factory function that returns a Commander.Command
 * @param category - Optional category
 *
 * @example
 * ```typescript
 * const wrapped = wrapLegacyCommand(
 *   'orchestrator',
 *   'Manage the Orchestrator Daemon',
 *   createOrchestratorCommand,
 *   'daemon'
 * );
 * registry.register(wrapped);
 * ```
 */
export function wrapLegacyCommand(
  name: string,
  description: string,
  factory: () => CommanderCommand,
  category?: CommandCategory,
): CommandDefinition {
  return {
    name,
    description,
    category,
    hidden: false,
    async execute(_args, _options, context) {
      // Legacy commands handle their own output.
      // The wrapper just ensures they integrate with the registry.
      context.logger.debug(`Delegating to legacy command: ${name}`);
      return { exitCode: 0, message: `Legacy command ${name} executed` };
    },
    // The actual Commander.Command is attached by the registry during buildProgram()
    // via the _legacyFactory property.
    _legacyFactory: factory,
  } as CommandDefinition & { _legacyFactory: () => CommanderCommand };
}
