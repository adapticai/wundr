/* eslint-disable no-console */
/**
 * @fileoverview Main CLI Entry Point for Genesis
 * @module @wundr/org-genesis/cli/genesis-cli
 *
 * This module provides the main command-line interface entry point for
 * the Org Genesis system. It handles argument parsing, command routing,
 * and provides help and version information.
 *
 * @example
 * ```typescript
 * import { runCLI } from '@wundr/org-genesis/cli';
 *
 * // Run the CLI with process arguments
 * await runCLI(process.argv.slice(2));
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parsed CLI options containing command, arguments, and flags.
 *
 * @property command - The primary command to execute
 * @property args - Positional arguments after the command
 * @property flags - Named flags with their values (boolean for flags without values)
 */
export interface CLIOptions {
  /**
   * The primary command to execute (e.g., 'create', 'add-vp', 'list').
   */
  command: string;

  /**
   * Positional arguments following the command.
   */
  args: string[];

  /**
   * Named flags and their values.
   * Boolean flags (e.g., --verbose) will have value `true`.
   */
  flags: Record<string, string | boolean>;
}

/**
 * Result of executing a CLI command.
 */
export interface CLIResult {
  /**
   * Whether the command executed successfully.
   */
  success: boolean;

  /**
   * Exit code for the process.
   */
  exitCode: number;

  /**
   * Optional error message if command failed.
   */
  error?: string;

  /**
   * Optional output data from the command.
   */
  data?: unknown;
}

/**
 * Command handler function type.
 */
export type CommandHandler = (
  args: string[],
  flags: Record<string, string | boolean>
) => Promise<CLIResult>;

/**
 * Command definition for registration.
 */
export interface CommandDefinition {
  /**
   * Command name (e.g., 'create', 'add-vp').
   */
  name: string;

  /**
   * Short description for help text.
   */
  description: string;

  /**
   * Usage pattern showing arguments and options.
   */
  usage: string;

  /**
   * Command handler function.
   */
  handler: CommandHandler;

  /**
   * Optional aliases for the command.
   */
  aliases?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * CLI version number.
 */
export const CLI_VERSION = '1.0.0';

/**
 * CLI name for display.
 */
export const CLI_NAME = 'genesis';

/**
 * CLI description.
 */
export const CLI_DESCRIPTION =
  'Organizational Genesis - Dynamic context compilation and fleet generation';

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

/**
 * Parses command line arguments into structured options.
 *
 * Handles:
 * - Positional arguments
 * - Long flags (--flag, --flag=value, --flag value)
 * - Short flags (-f, -f value)
 * - Boolean flags (--verbose becomes { verbose: true })
 *
 * @param args - Raw command line arguments (typically process.argv.slice(2))
 * @returns Parsed CLI options with command, args, and flags
 *
 * @example
 * ```typescript
 * const options = parseArgs(['create', '--name', 'MyOrg', '--verbose']);
 * // Result:
 * // {
 * //   command: 'create',
 * //   args: [],
 * //   flags: { name: 'MyOrg', verbose: true }
 * // }
 * ```
 */
export function parseArgs(args: string[]): CLIOptions {
  const result: CLIOptions = {
    command: '',
    args: [],
    flags: {},
  };

  let i = 0;
  let commandFound = false;

  while (i < args.length) {
    const arg = args[i];

    // Handle long flags (--flag)
    if (arg.startsWith('--')) {
      const flagPart = arg.slice(2);

      // Handle --flag=value format
      if (flagPart.includes('=')) {
        const [key, ...valueParts] = flagPart.split('=');
        result.flags[key] = valueParts.join('=');
      } else {
        // Handle --flag value format or boolean --flag
        const nextArg = args[i + 1];
        // Check if next arg is a value (not another flag)
        if (nextArg && !nextArg.startsWith('-')) {
          result.flags[flagPart] = nextArg;
          i++; // Skip the value
        } else {
          // Boolean flag
          result.flags[flagPart] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Handle short flags (-f)
      const flagChar = arg.slice(1);

      // Expand common short flags
      const expandedFlag = expandShortFlag(flagChar);
      const nextArg = args[i + 1];

      // Check if next arg is a value
      if (nextArg && !nextArg.startsWith('-')) {
        result.flags[expandedFlag] = nextArg;
        i++;
      } else {
        result.flags[expandedFlag] = true;
      }
    } else {
      // Handle command and positional args
      if (!commandFound) {
        result.command = arg;
        commandFound = true;
      } else {
        result.args.push(arg);
      }
    }

    i++;
  }

  return result;
}

/**
 * Expands short flag characters to their full names.
 *
 * @param char - The short flag character(s)
 * @returns The expanded flag name
 * @internal
 */
function expandShortFlag(char: string): string {
  const shortFlags: Record<string, string> = {
    v: 'verbose',
    h: 'help',
    V: 'version',
    n: 'name',
    d: 'dry-run',
    o: 'output',
    f: 'format',
    i: 'interactive',
    q: 'quiet',
  };

  return shortFlags[char] || char;
}

// =============================================================================
// HELP AND VERSION
// =============================================================================

/**
 * Displays the help text for the CLI.
 *
 * Shows available commands, options, and usage examples.
 *
 * @example
 * ```typescript
 * displayHelp();
 * // Outputs formatted help text to console
 * ```
 */
export function displayHelp(): void {
  console.log(`
${CLI_NAME} - ${CLI_DESCRIPTION}

USAGE:
  ${CLI_NAME} <command> [options]

COMMANDS:
  create              Create a new organization
  add-vp              Add a VP (Virtual Persona) to an organization
  add-discipline      Add a discipline pack to a VP
  add-agent           Add an agent to a discipline
  list                List organizations, VPs, disciplines, or agents
  compile             Compile context for an organization or VP
  export              Export organization configuration

OPTIONS:
  -h, --help          Show this help message
  -V, --version       Show version number
  -v, --verbose       Enable verbose output
  -d, --dry-run       Preview changes without applying
  -o, --output <path> Output path for generated files
  -f, --format <fmt>  Output format (json, yaml, tree, table)
  -i, --interactive   Enable interactive mode with prompts
  -q, --quiet         Suppress non-essential output

EXAMPLES:
  # Create a new organization interactively
  ${CLI_NAME} create -i

  # Create an organization with options
  ${CLI_NAME} create --name "MyOrg" --industry technology --size medium

  # Add a VP to an organization
  ${CLI_NAME} add-vp org-123 --name "Engineering VP" --persona "Technical leader"

  # List all organizations
  ${CLI_NAME} list orgs

  # List VPs in an organization
  ${CLI_NAME} list vps org-123

  # Compile context for a VP
  ${CLI_NAME} compile vp-456 --output ./context

  # Export organization as JSON
  ${CLI_NAME} export org-123 --format json --output ./org-config.json

For more information, visit: https://github.com/wundr/org-genesis
`);
}

/**
 * Displays the version information.
 *
 * @example
 * ```typescript
 * displayVersion();
 * // Outputs: genesis v1.0.0
 * ```
 */
export function displayVersion(): void {
  console.log(`${CLI_NAME} v${CLI_VERSION}`);
}

// =============================================================================
// COMMAND REGISTRY
// =============================================================================

/**
 * Registry of available commands.
 * @internal
 */
const commandRegistry = new Map<string, CommandDefinition>();

/**
 * Registers a command with the CLI.
 *
 * @param definition - The command definition to register
 *
 * @example
 * ```typescript
 * registerCommand({
 *   name: 'create',
 *   description: 'Create a new organization',
 *   usage: 'genesis create [options]',
 *   handler: createOrgHandler,
 *   aliases: ['new', 'init'],
 * });
 * ```
 */
export function registerCommand(definition: CommandDefinition): void {
  commandRegistry.set(definition.name, definition);

  // Register aliases
  if (definition.aliases) {
    for (const alias of definition.aliases) {
      commandRegistry.set(alias, definition);
    }
  }
}

/**
 * Gets a registered command by name or alias.
 *
 * @param name - The command name or alias
 * @returns The command definition or undefined if not found
 */
export function getCommand(name: string): CommandDefinition | undefined {
  return commandRegistry.get(name);
}

/**
 * Gets all registered commands (unique, no duplicates from aliases).
 *
 * @returns Array of unique command definitions
 */
export function getCommands(): CommandDefinition[] {
  const unique = new Map<string, CommandDefinition>();
  commandRegistry.forEach(def => {
    unique.set(def.name, def);
  });
  return Array.from(unique.values());
}

// =============================================================================
// DEFAULT COMMAND HANDLERS
// =============================================================================

/**
 * Default handler for unknown commands.
 *
 * @param command - The unknown command name
 * @returns CLI result with error
 * @internal
 */
async function handleUnknownCommand(command: string): Promise<CLIResult> {
  console.error(`Unknown command: ${command}`);
  console.error(`Run '${CLI_NAME} --help' for usage information.`);
  return {
    success: false,
    exitCode: 1,
    error: `Unknown command: ${command}`,
  };
}

/**
 * Placeholder handler for commands not yet implemented.
 *
 * @param commandName - The name of the unimplemented command
 * @returns CLI result with error
 * @internal
 */
function createPlaceholderHandler(commandName: string): CommandHandler {
  return async (): Promise<CLIResult> => {
    console.log(`Command '${commandName}' is not yet implemented.`);
    console.log('This is a placeholder for future functionality.');
    return {
      success: true,
      exitCode: 0,
    };
  };
}

// =============================================================================
// COMMAND INITIALIZATION
// =============================================================================

/**
 * Initializes default commands.
 * @internal
 */
function initializeDefaultCommands(): void {
  // Only register if not already registered
  if (commandRegistry.size > 0) {
    return;
  }

  registerCommand({
    name: 'create',
    description: 'Create a new organization',
    usage: `${CLI_NAME} create [options]`,
    handler: createPlaceholderHandler('create'),
    aliases: ['new', 'init'],
  });

  registerCommand({
    name: 'add-vp',
    description: 'Add a VP to an organization',
    usage: `${CLI_NAME} add-vp <org-id> [options]`,
    handler: createPlaceholderHandler('add-vp'),
  });

  registerCommand({
    name: 'add-discipline',
    description: 'Add a discipline pack to a VP',
    usage: `${CLI_NAME} add-discipline <vp-id> [options]`,
    handler: createPlaceholderHandler('add-discipline'),
  });

  registerCommand({
    name: 'add-agent',
    description: 'Add an agent to a discipline',
    usage: `${CLI_NAME} add-agent <discipline-id> [options]`,
    handler: createPlaceholderHandler('add-agent'),
  });

  registerCommand({
    name: 'list',
    description: 'List resources (orgs, vps, disciplines, agents)',
    usage: `${CLI_NAME} list <resource> [parent-id]`,
    handler: createPlaceholderHandler('list'),
    aliases: ['ls'],
  });

  registerCommand({
    name: 'compile',
    description: 'Compile context for an organization or VP',
    usage: `${CLI_NAME} compile <id> [options]`,
    handler: createPlaceholderHandler('compile'),
  });

  registerCommand({
    name: 'export',
    description: 'Export organization configuration',
    usage: `${CLI_NAME} export <org-id> [options]`,
    handler: createPlaceholderHandler('export'),
  });
}

// =============================================================================
// MAIN CLI ENTRY POINT
// =============================================================================

/**
 * Main CLI entry point.
 *
 * Parses arguments, routes to appropriate command handler, and manages
 * the execution lifecycle. Handles help and version flags automatically.
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns Promise resolving when the CLI completes
 *
 * @example
 * ```typescript
 * // In your bin/genesis.js file:
 * import { runCLI } from '@wundr/org-genesis/cli';
 *
 * runCLI(process.argv.slice(2))
 *   .then(() => process.exit(0))
 *   .catch((err) => {
 *     console.error(err);
 *     process.exit(1);
 *   });
 * ```
 */
export async function runCLI(args: string[]): Promise<void> {
  // Initialize default commands
  initializeDefaultCommands();

  // Parse arguments
  const options = parseArgs(args);

  // Handle global flags first
  if (options.flags.help || options.flags.h) {
    displayHelp();
    return;
  }

  if (options.flags.version || options.flags.V) {
    displayVersion();
    return;
  }

  // If no command, show help
  if (!options.command) {
    displayHelp();
    return;
  }

  // Look up command
  const command = getCommand(options.command);

  let result: CLIResult;

  if (command) {
    // Set verbose mode if flag is present
    if (options.flags.verbose) {
      console.log(`Executing command: ${command.name}`);
      console.log(`Arguments: ${JSON.stringify(options.args)}`);
      console.log(`Flags: ${JSON.stringify(options.flags)}`);
    }

    try {
      result = await command.handler(options.args, options.flags);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error executing command '${command.name}': ${errorMessage}`,
      );

      if (options.flags.verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }

      result = {
        success: false,
        exitCode: 1,
        error: errorMessage,
      };
    }
  } else {
    result = await handleUnknownCommand(options.command);
  }

  // Exit with appropriate code
  if (!result.success) {
    process.exitCode = result.exitCode;
  }
}

/**
 * Creates a CLI runner with custom command handlers.
 *
 * This factory function allows you to create a customized CLI instance
 * with your own command implementations.
 *
 * @param customCommands - Array of custom command definitions
 * @returns A function that runs the CLI with the custom commands
 *
 * @example
 * ```typescript
 * const myCLI = createCLI([
 *   {
 *     name: 'custom',
 *     description: 'My custom command',
 *     usage: 'genesis custom [options]',
 *     handler: async (args, flags) => {
 *       console.log('Custom command executed!');
 *       return { success: true, exitCode: 0 };
 *     },
 *   },
 * ]);
 *
 * await myCLI(process.argv.slice(2));
 * ```
 */
export function createCLI(
  customCommands: CommandDefinition[],
): (args: string[]) => Promise<void> {
  // Register custom commands
  for (const command of customCommands) {
    registerCommand(command);
  }

  return runCLI;
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Creates a standardized error result.
 *
 * @param message - Error message
 * @param exitCode - Exit code (default: 1)
 * @returns CLI result object representing the error
 */
export function createErrorResult(message: string, exitCode = 1): CLIResult {
  return {
    success: false,
    exitCode,
    error: message,
  };
}

/**
 * Creates a standardized success result.
 *
 * @param data - Optional data to include in the result
 * @returns CLI result object representing success
 */
export function createSuccessResult(data?: unknown): CLIResult {
  return {
    success: true,
    exitCode: 0,
    data,
  };
}

/**
 * Validates that required flags are present.
 *
 * @param flags - The flags object to validate
 * @param required - Array of required flag names
 * @returns Error message if validation fails, undefined if valid
 *
 * @example
 * ```typescript
 * const error = validateRequiredFlags(flags, ['name', 'industry']);
 * if (error) {
 *   return createErrorResult(error);
 * }
 * ```
 */
export function validateRequiredFlags(
  flags: Record<string, string | boolean>,
  required: string[],
): string | undefined {
  const missing: string[] = [];

  for (const flag of required) {
    if (flags[flag] === undefined) {
      missing.push(flag);
    }
  }

  if (missing.length > 0) {
    return `Missing required flags: ${missing.map(f => `--${f}`).join(', ')}`;
  }

  return undefined;
}

/**
 * Gets a flag value as a string.
 *
 * @param flags - The flags object
 * @param name - The flag name
 * @param defaultValue - Optional default value
 * @returns The flag value as a string, or the default
 */
export function getFlagString(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue?: string,
): string | undefined {
  const value = flags[name];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return defaultValue;
  }
  return value;
}

/**
 * Gets a flag value as a boolean.
 *
 * @param flags - The flags object
 * @param name - The flag name
 * @param defaultValue - Default value if flag is not present
 * @returns The flag value as a boolean
 */
export function getFlagBoolean(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue = false,
): boolean {
  const value = flags[name];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value.toLowerCase() === 'true' || value === '1';
}
