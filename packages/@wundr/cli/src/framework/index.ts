/**
 * Wundr CLI Framework - Public API
 *
 * This module provides the core framework for building CLI commands:
 *
 * - **CommandDefinition**: The interface every command implements
 * - **CommandRegistry**: Auto-discovery and Commander.js integration
 * - **OutputFormatter**: Consistent table, JSON, YAML, status, progress output
 * - **CliErrorHandler**: Typed errors with classification and recovery
 * - **InteractiveRepl**: REPL loop with history, aliases, and tab completion
 * - **HelpGenerator**: Structured help text from command metadata
 * - **CompletionExporter**: Shell completion script generation
 * - **DebugLogger**: Verbose/debug logging with TTY detection
 * - **ProgressBar / StepTracker**: Progress tracking for long operations
 *
 * @example
 * ```typescript
 * import {
 *   CommandDefinition,
 *   CommandRegistry,
 *   OutputFormatter,
 *   CliErrorHandler,
 *   InteractiveRepl,
 *   HelpGenerator,
 *   CompletionExporter,
 *   DebugLogger,
 *   ProgressBar,
 *   StepTracker,
 *   commandSuccess,
 *   commandFailure,
 *   validationOk,
 *   validationFail,
 * } from './framework';
 *
 * const myCommand: CommandDefinition = {
 *   name: 'status',
 *   description: 'Show system status',
 *   category: 'daemon',
 *   async execute(args, options, context) {
 *     const data = await getStatus();
 *     const formatter = new OutputFormatter();
 *     const message = formatter.keyValue(data);
 *     return commandSuccess(data, message);
 *   },
 * };
 *
 * const registry = new CommandRegistry();
 * registry.register(myCommand);
 * ```
 *
 * @module framework
 */

// Command Interface - Types and contracts
export {
  // Core interface
  type CommandDefinition,
  type CommandModule,
  type CommandHook,

  // Argument/option types
  type ArgumentDefinition,
  type OptionDefinition,
  type CommandExample,

  // Categories
  type CommandCategory,
  CATEGORY_LABELS,

  // Validation
  type ValidationResult,
  type ValidationError,
  validationOk,
  validationFail,

  // Context
  type CommandContext,
  type GlobalOptions,
  type ContextLogger,
  type OutputFormatterInterface,
  type ConfigManagerInterface,

  // Results
  type CommandResult,
  commandSuccess,
  commandFailure,

  // Legacy adapter
  wrapLegacyCommand,
} from './command-interface';

// Command Registry
export {
  CommandRegistry,
  type RegistryOptions,
  type RegisteredCommand,
} from './command-registry';

// Output Formatter
export {
  OutputFormatter,
  type TableOptions,
  type ColumnDefinition,
  type JsonOptions,
  type KeyValueOptions,
  type ListOptions,
  type TreeNode,
  type TreeOptions,
  type ProgressOptions,
  type StatusState,
} from './output-formatter';

// Error Handler
export {
  CliErrorHandler,
  CliError,
  type ErrorCode,
  type ErrorDetails,
  type RecoverySuggestion,
  type ErrorRecoveryHandler,
  type ErrorClassification,
  type ClassifiedError,
  classifyError,
  classifyAnyError,
} from './error-handler';

// Interactive REPL
export {
  InteractiveRepl,
  type ReplOptions,
  type HistoryEntry,
} from './interactive-repl';

// Help Generator
export {
  HelpGenerator,
  type HelpGeneratorOptions,
  type SearchResult,
} from './help-generator';

// Completion Exporter
export {
  CompletionExporter,
  type ShellType,
  type CompletionData,
  type CompletionCommand,
  type CompletionArgument,
  type CompletionOption,
} from './completion-exporter';

// Debug Logger
export {
  DebugLogger,
  TaggedLogger,
  type LogLevel,
  type LogEntry,
  type DebugLoggerOptions,
} from './debug-logger';

// Progress Manager
export {
  ProgressBar,
  MultiProgressManager,
  StepTracker,
  type ProgressBarOptions,
  type ProgressState,
  type ProgressStep,
  type StepTrackerOptions,
} from './progress-manager';
