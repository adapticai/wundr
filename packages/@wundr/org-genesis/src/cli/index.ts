/**
 * @packageDocumentation
 * Genesis CLI for organizational generation.
 *
 * This module provides the complete command-line interface for the Org Genesis
 * system, including interactive prompts, command routing, and output formatting.
 *
 * @module @wundr/org-genesis/cli
 *
 * @example
 * ```typescript
 * // Import and run the CLI
 * import { runCLI } from '@wundr/org-genesis/cli';
 *
 * await runCLI(process.argv.slice(2));
 * ```
 *
 * @example
 * ```typescript
 * // Use interactive prompts directly
 * import {
 *   promptOrgConfig,
 *   promptOrchestratorConfig,
 *   promptConfirm,
 * } from '@wundr/org-genesis/cli';
 *
 * const orgConfig = await promptOrgConfig();
 * const proceed = await promptConfirm('Create organization?');
 * ```
 *
 * @example
 * ```typescript
 * // Use formatters for output
 * import {
 *   formatTree,
 *   formatTable,
 * } from '@wundr/org-genesis/cli';
 *
 * console.log(formatTree(organization));
 * console.log(formatTable(vpList, ['name', 'status', 'disciplines']));
 * ```
 */

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Command implementations for CLI operations.
 */

// Note: These exports will be enabled as the command implementations are completed.
// For now, they export placeholder stubs.

export * from './commands/create-org.js';
export * from './commands/add-orchestrator.js';
export * from './commands/add-discipline.js';
export * from './commands/add-agent.js';
export * from './commands/list.js';
export * from './commands/compile.js';
export * from './commands/export.js';

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Output formatters for displaying data.
 */

export * from './formatters/tree-formatter.js';
export * from './formatters/table-formatter.js';

// =============================================================================
// INTERACTIVE PROMPTS
// =============================================================================

/**
 * Interactive prompt utilities for gathering user input.
 */

export * from './interactive-prompts.js';

// =============================================================================
// MAIN CLI
// =============================================================================

/**
 * Main CLI entry point and utilities.
 */

export * from './genesis-cli.js';

// =============================================================================
// CLI VERSION
// =============================================================================

/**
 * CLI version string exported for programmatic access.
 */
export const CLI_MODULE_VERSION = '1.0.0';

// Note: Types are already re-exported via export * above
// No need for explicit re-exports which cause duplicate export errors
