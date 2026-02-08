/**
 * Wundr CLI Framework - Public API
 *
 * This module provides the core framework for building CLI commands:
 *
 * - **CommandDefinition**: The interface every command implements
 * - **CommandRegistry**: Auto-discovery and Commander.js integration
 * - **OutputFormatter**: Consistent table, JSON, status, progress output
 * - **CliErrorHandler**: Typed errors with recovery suggestions
 *
 * @example
 * ```typescript
 * import {
 *   CommandDefinition,
 *   CommandRegistry,
 *   OutputFormatter,
 *   CliErrorHandler,
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
} from './error-handler';
