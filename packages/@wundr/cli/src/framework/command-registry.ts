/**
 * Command Registry - Auto-discovery, registration, and Commander.js integration.
 *
 * The registry is the central hub that:
 * 1. Discovers CommandDefinition files from the commands/ directory
 * 2. Validates definitions at registration time
 * 3. Builds a Commander.js program from registered definitions
 * 4. Provides lookup for shell completion generation
 * 5. Supports legacy command wrapping for incremental migration
 *
 * @module framework/command-registry
 */

import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';

import type {
  CommandDefinition,
  CommandModule,
  CommandHook,
  CommandCategory,
  CommandContext,
  CommandResult,
  ValidationResult,
  GlobalOptions,
} from './command-interface';
import { validationOk } from './command-interface';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for the command registry.
 */
export interface RegistryOptions {
  /**
   * Whether to enable strict mode.
   * In strict mode, duplicate command names cause an error.
   * In non-strict mode, the later registration wins with a warning.
   */
  strict?: boolean;

  /**
   * Base directory for auto-discovery.
   * Defaults to the `commands/` directory relative to the framework.
   */
  commandsDir?: string;

  /**
   * File pattern for auto-discovery.
   * Defaults to files ending in `.command.ts` or `.command.js`.
   * Set to `*` to discover all .ts/.js files.
   */
  filePattern?: RegExp;
}

/**
 * Metadata about a registered command for introspection.
 */
export interface RegisteredCommand {
  definition: CommandDefinition;
  hooks: CommandHook[];
  registeredAt: Date;
}

// ---------------------------------------------------------------------------
// Command Registry
// ---------------------------------------------------------------------------

export class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private globalHooks: CommandHook[] = [];
  private options: Required<RegistryOptions>;

  constructor(options: RegistryOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      commandsDir: options.commandsDir ?? path.join(__dirname, '..', 'commands'),
      filePattern: options.filePattern ?? /\.(command)\.(ts|js)$/,
    };
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a single command definition.
   *
   * @param definition - The command to register
   * @param hooks - Optional lifecycle hooks for this command
   * @throws Error in strict mode if command name is already registered
   */
  register(definition: CommandDefinition, hooks: CommandHook[] = []): void {
    const name = definition.name;

    if (this.commands.has(name)) {
      if (this.options.strict) {
        throw new Error(
          `Command "${name}" is already registered. ` +
          `Disable strict mode or use a different name.`
        );
      }
      // Non-strict: warn and overwrite
      console.warn(
        chalk.yellow(`[registry] Overwriting existing command: ${name}`)
      );
    }

    // Validate the definition at registration time
    this.validateDefinition(definition);

    this.commands.set(name, {
      definition,
      hooks,
      registeredAt: new Date(),
    });

    // Recursively register subcommands
    if (definition.subcommands) {
      for (const sub of definition.subcommands) {
        // Prefix subcommand names with parent for flat lookup
        const qualifiedName = `${name}:${sub.name}`;
        const qualifiedSub = { ...sub, name: qualifiedName };
        this.register(qualifiedSub, hooks);
      }
    }
  }

  /**
   * Register a command module (definition + hooks bundle).
   */
  registerModule(mod: CommandModule): void {
    this.register(mod.command, mod.hooks);
  }

  /**
   * Register a global hook that runs for all commands.
   */
  registerGlobalHook(hook: CommandHook): void {
    this.globalHooks.push(hook);
  }

  /**
   * Remove a registered command.
   */
  unregister(name: string): boolean {
    return this.commands.delete(name);
  }

  // -------------------------------------------------------------------------
  // Auto-Discovery
  // -------------------------------------------------------------------------

  /**
   * Discover and register commands from a directory.
   *
   * Scans the directory for files matching the configured pattern.
   * Each file should export either:
   * - A `module` property conforming to `CommandModule`
   * - A `command` property conforming to `CommandDefinition`
   * - A default export conforming to `CommandDefinition`
   *
   * @param directory - Directory to scan. Defaults to configured commandsDir.
   * @returns Number of commands discovered and registered.
   */
  async discoverCommands(directory?: string): Promise<number> {
    const dir = directory ?? this.options.commandsDir;
    let count = 0;

    if (!fs.existsSync(dir)) {
      console.warn(
        chalk.yellow(`[registry] Commands directory not found: ${dir}`)
      );
      return 0;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      // Check file pattern
      if (!this.options.filePattern.test(entry.name)) {
        continue;
      }

      const filePath = path.join(dir, entry.name);

      try {
        const exported = await this.loadModule(filePath);

        if (exported.module && typeof exported.module === 'object') {
          // CommandModule export
          const mod = exported.module as CommandModule;
          if (mod.command && mod.command.name && typeof mod.command.execute === 'function') {
            this.registerModule(mod);
            count++;
          }
        } else if (exported.command && typeof exported.command === 'object') {
          // Direct CommandDefinition export
          const def = exported.command as CommandDefinition;
          if (def.name && typeof def.execute === 'function') {
            this.register(def);
            count++;
          }
        } else if (exported.default && typeof exported.default === 'object') {
          // Default export
          const def = exported.default as CommandDefinition;
          if (def.name && typeof def.execute === 'function') {
            this.register(def);
            count++;
          }
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `[registry] Failed to load command from ${entry.name}: ` +
            `${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }

    return count;
  }

  // -------------------------------------------------------------------------
  // Multi-Directory Discovery
  // -------------------------------------------------------------------------

  /**
   * Discover commands from multiple directories.
   *
   * @param directories - Array of directory paths to scan
   * @returns Total number of commands discovered
   */
  async discoverFromDirectories(directories: string[]): Promise<number> {
    let total = 0;
    for (const dir of directories) {
      total += await this.discoverCommands(dir);
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  /**
   * Get a registered command by name.
   */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name)?.definition;
  }

  /**
   * Find a command by name or alias.
   * Searches direct name first, then aliases.
   */
  findByNameOrAlias(nameOrAlias: string): CommandDefinition | undefined {
    // Direct name lookup
    const direct = this.commands.get(nameOrAlias);
    if (direct) return direct.definition;

    // Search aliases
    for (const registered of Array.from(this.commands.values())) {
      const { definition } = registered;
      if (definition.aliases && definition.aliases.includes(nameOrAlias)) {
        return definition;
      }
    }

    return undefined;
  }

  /**
   * Check if a command is registered.
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * List all registered commands, optionally filtered by category.
   */
  list(category?: CommandCategory): CommandDefinition[] {
    const all = Array.from(this.commands.values()).map(r => r.definition);

    if (category) {
      return all.filter(cmd => cmd.category === category);
    }

    return all;
  }

  /**
   * List all registered command names.
   */
  names(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get commands grouped by category.
   */
  grouped(): Map<CommandCategory | 'uncategorized', CommandDefinition[]> {
    const groups = new Map<CommandCategory | 'uncategorized', CommandDefinition[]>();

    for (const registered of Array.from(this.commands.values())) {
      const cat = registered.definition.category ?? 'uncategorized';
      const existing = groups.get(cat) ?? [];
      existing.push(registered.definition);
      groups.set(cat, existing);
    }

    return groups;
  }

  /**
   * Get all command names for shell completion.
   */
  getCompletionWords(): string[] {
    const words: string[] = [];

    for (const registered of Array.from(this.commands.values())) {
      if (registered.definition.hidden) {
        continue;
      }

      words.push(registered.definition.name);

      if (registered.definition.aliases) {
        words.push(...registered.definition.aliases);
      }
    }

    return words.sort();
  }

  // -------------------------------------------------------------------------
  // Commander.js Integration
  // -------------------------------------------------------------------------

  /**
   * Build a Commander.js program from all registered commands.
   *
   * This is the bridge between the registry's CommandDefinition world
   * and Commander.js's imperative API. Call this once after all commands
   * are registered.
   *
   * @param program - The root Commander.js Command instance
   * @param contextFactory - Factory that creates a CommandContext for each invocation
   */
  buildProgram(
    program: Command,
    contextFactory: (globalOpts: GlobalOptions) => CommandContext,
  ): void {
    for (const registered of Array.from(this.commands.values())) {
      const { definition, hooks } = registered;

      // Skip qualified subcommand names (they are handled by their parent)
      if (definition.name.includes(':')) {
        continue;
      }

      // Check for legacy factory
      const legacyFactory = (definition as CommandDefinition & { _legacyFactory?: () => Command })._legacyFactory;

      if (legacyFactory) {
        // Legacy command: add the pre-built Commander.Command directly
        program.addCommand(legacyFactory());
        continue;
      }

      // Build a new Commander.Command from the definition
      const cmd = this.buildCommand(definition, hooks, contextFactory);
      program.addCommand(cmd);
    }
  }

  /**
   * Build a single Commander.Command from a CommandDefinition.
   */
  private buildCommand(
    definition: CommandDefinition,
    hooks: CommandHook[],
    contextFactory: (globalOpts: GlobalOptions) => CommandContext,
  ): Command {
    const cmd = new Command(definition.name);
    cmd.description(definition.description);

    // Aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        cmd.alias(alias);
      }
    }

    // Hidden - Commander.js doesn't expose hideHelp, so we use the internal approach
    if (definition.hidden) {
      (cmd as unknown as { _hidden: boolean })._hidden = true;
    }

    // Arguments
    if (definition.arguments) {
      for (const arg of definition.arguments) {
        const spec = arg.required
          ? arg.variadic ? `<${arg.name}...>` : `<${arg.name}>`
          : arg.variadic ? `[${arg.name}...]` : `[${arg.name}]`;
        cmd.argument(spec, arg.description, arg.defaultValue);
      }
    }

    // Options
    if (definition.options) {
      for (const opt of definition.options) {
        if (opt.required) {
          cmd.requiredOption(opt.flags, opt.description, opt.defaultValue as string | boolean | undefined);
        } else {
          cmd.option(opt.flags, opt.description, opt.defaultValue as string | boolean | undefined);
        }

        if (opt.choices) {
          // Commander.js doesn't have built-in choices on options;
          // we handle this in validation instead.
        }
      }
    }

    // Examples in help text
    if (definition.examples && definition.examples.length > 0) {
      const examplesText = definition.examples
        .map(ex => `  ${chalk.green(ex.command)}  ${chalk.gray(ex.description)}`)
        .join('\n');

      cmd.addHelpText('after', `\n${chalk.gray('Examples:')}\n${examplesText}\n`);
    }

    // Subcommands
    if (definition.subcommands) {
      for (const sub of definition.subcommands) {
        const subCmd = this.buildCommand(sub, hooks, contextFactory);
        cmd.addCommand(subCmd);
      }
    }

    // Action handler
    cmd.action(async (...actionArgs: unknown[]) => {
      // Commander passes positional args first, then options object, then the Command
      const commanderCmd = actionArgs[actionArgs.length - 1] as Command;
      const options = actionArgs[actionArgs.length - 2] as Record<string, unknown>;

      // Build positional args map
      const args: Record<string, unknown> = {};
      if (definition.arguments) {
        for (let i = 0; i < definition.arguments.length; i++) {
          const argDef = definition.arguments[i];
          if (argDef) {
            args[argDef.name] = actionArgs[i];
          }
        }
      }

      // Merge environment variable defaults into options
      if (definition.options) {
        for (const opt of definition.options) {
          if (opt.envVar) {
            const optName = this.flagsToOptionName(opt.flags);
            if (options[optName] === undefined && process.env[opt.envVar]) {
              options[optName] = process.env[opt.envVar];
            }
          }
        }
      }

      // Create execution context
      const rootOpts = commanderCmd.parent?.opts() ?? commanderCmd.opts();
      const globalOpts: GlobalOptions = {
        verbose: !!rootOpts['verbose'],
        quiet: !!rootOpts['quiet'],
        json: !!rootOpts['json'] || !!options['json'],
        noColor: !!rootOpts['noColor'],
        dryRun: !!rootOpts['dryRun'] || !!options['dryRun'],
        config: rootOpts['config'] as string | undefined,
      };

      const context = contextFactory(globalOpts);

      try {
        // Run pre-validate hooks
        const allHooks = [...this.globalHooks, ...hooks];
        await this.runHooks('preValidate', allHooks, definition, context);

        // Validate
        let validation: ValidationResult = validationOk();
        if (definition.validate) {
          validation = await definition.validate(args, options, context);
        }

        // Validate option choices
        if (definition.options) {
          for (const opt of definition.options) {
            if (opt.choices) {
              const optName = this.flagsToOptionName(opt.flags);
              const value = options[optName];
              if (value !== undefined && !opt.choices.includes(String(value))) {
                validation = {
                  valid: false,
                  errors: [
                    ...validation.errors,
                    {
                      field: optName,
                      message: `Invalid value "${value}" for --${optName}. Allowed: ${opt.choices.join(', ')}`,
                      suggestion: `Use one of: ${opt.choices.join(', ')}`,
                    },
                  ],
                };
              }
            }
          }
        }

        // Validate option conflicts
        if (definition.options) {
          for (const opt of definition.options) {
            if (opt.conflicts) {
              const optName = this.flagsToOptionName(opt.flags);
              if (options[optName] !== undefined) {
                for (const conflictName of opt.conflicts) {
                  if (options[conflictName] !== undefined) {
                    validation = {
                      valid: false,
                      errors: [
                        ...validation.errors,
                        {
                          field: optName,
                          message: `Option --${optName} conflicts with --${conflictName}`,
                          suggestion: `Use either --${optName} or --${conflictName}, not both`,
                        },
                      ],
                    };
                  }
                }
              }
            }
          }
        }

        // Run post-validate hooks
        await this.runHooks('postValidate', allHooks, definition, context);

        if (!validation.valid) {
          for (const err of validation.errors) {
            console.error(chalk.red(`Validation error [${err.field}]: ${err.message}`));
            if (err.suggestion) {
              console.error(chalk.yellow(`  Suggestion: ${err.suggestion}`));
            }
          }
          process.exitCode = 1;
          return;
        }

        // Run pre-execute hooks
        await this.runHooks('preExecute', allHooks, definition, context);

        // Execute
        const result = await definition.execute(args, options, context);

        // Run post-execute hooks
        await this.runHooks('postExecute', allHooks, definition, context, result);

        // Handle result
        this.handleResult(result, context);
      } catch (error) {
        // Attempt rollback
        if (definition.rollback && error instanceof Error) {
          try {
            await definition.rollback(error, context);
          } catch (rollbackError) {
            context.logger.error(
              `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
            );
          }
        }

        // Format error output
        if (error instanceof Error) {
          if (globalOpts.verbose) {
            console.error(chalk.red(`\nCommand "${definition.name}" failed:`));
            console.error(chalk.red(error.message));
            if (error.stack) {
              console.error(chalk.gray(error.stack));
            }
          } else {
            console.error(chalk.red(`Error: ${error.message}`));
            console.error(chalk.gray(`Run with --verbose for details`));
          }
        } else {
          console.error(chalk.red(`Error: ${String(error)}`));
        }

        process.exitCode = 1;
      }
    });

    return cmd;
  }

  // -------------------------------------------------------------------------
  // Shell Completion Generation
  // -------------------------------------------------------------------------

  /**
   * Generate a bash completion script.
   */
  generateBashCompletion(programName: string = 'wundr'): string {
    const commands = this.getCompletionWords();

    return `
# Bash completion for ${programName}
# Generated by @wundr/cli framework

_${programName}_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands.join(' ')}"
  local global_opts="--verbose --quiet --json --no-color --dry-run --config --help --version"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands} \${global_opts}" -- "\${cur}") )
  else
    local cmd="\${COMP_WORDS[1]}"
    case "\${cmd}" in
${this.generateBashCaseClauses()}
      *)
        COMPREPLY=( $(compgen -W "\${global_opts}" -- "\${cur}") )
        ;;
    esac
  fi
}

complete -F _${programName}_completions ${programName}
`.trim();
  }

  /**
   * Generate a zsh completion script.
   */
  generateZshCompletion(programName: string = 'wundr'): string {
    const commands = this.list()
      .filter(cmd => !cmd.hidden && !cmd.name.includes(':'))
      .map(cmd => `'${cmd.name}:${cmd.description.replace(/'/g, "")}'`)
      .join('\n    ');

    return `
#compdef ${programName}
# Zsh completion for ${programName}
# Generated by @wundr/cli framework

_${programName}() {
  local -a commands
  commands=(
    ${commands}
  )

  _arguments -C \\
    '--verbose[Enable verbose logging]' \\
    '--quiet[Suppress output]' \\
    '--json[Output as JSON]' \\
    '--no-color[Disable colored output]' \\
    '--dry-run[Show what would be done]' \\
    '--config[Specify config file]:file:_files' \\
    '-h[Show help]' \\
    '-v[Show version]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'command' commands
      ;;
    args)
      case $words[1] in
${this.generateZshCaseClauses()}
      esac
      ;;
  esac
}

_${programName}
`.trim();
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Load a module from a file path. Handles both ESM and CJS.
   */
  private async loadModule(filePath: string): Promise<Record<string, unknown>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(filePath);
    } catch {
      // Fall back to dynamic import for ESM
      return await import(filePath);
    }
  }

  /**
   * Validate a command definition at registration time.
   */
  private validateDefinition(definition: CommandDefinition): void {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Command definition must have a non-empty name');
    }

    if (!definition.description || typeof definition.description !== 'string') {
      throw new Error(`Command "${definition.name}" must have a description`);
    }

    if (typeof definition.execute !== 'function') {
      throw new Error(`Command "${definition.name}" must have an execute function`);
    }

    // Validate arguments don't have duplicates
    if (definition.arguments) {
      const names = new Set<string>();
      for (const arg of definition.arguments) {
        if (names.has(arg.name)) {
          throw new Error(
            `Command "${definition.name}" has duplicate argument name: ${arg.name}`
          );
        }
        names.add(arg.name);
      }
    }
  }

  /**
   * Run hooks for a specific phase.
   */
  private async runHooks(
    phase: CommandHook['phase'],
    hooks: CommandHook[],
    command: CommandDefinition,
    context: CommandContext,
    result?: CommandResult,
  ): Promise<void> {
    const matching = hooks.filter(h => {
      if (h.phase !== phase) return false;
      if (h.commands && !h.commands.includes(command.name)) return false;
      return true;
    });

    for (const hook of matching) {
      const shouldContinue = await hook.handler(command, context, result);
      if (shouldContinue === false && (phase === 'preValidate' || phase === 'preExecute')) {
        throw new Error(`Command "${command.name}" aborted by ${phase} hook`);
      }
    }
  }

  /**
   * Handle a CommandResult by formatting output appropriately.
   */
  private handleResult(result: CommandResult, context: CommandContext): void {
    if (result.exitCode !== 0) {
      if (result.message) {
        console.error(chalk.red(result.message));
      }
      process.exitCode = result.exitCode;
      return;
    }

    // Warnings
    if (result.warnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.error(chalk.yellow(`Warning: ${warning}`));
      }
    }

    // JSON mode: output data directly
    if (context.globalOptions.json && result.data !== undefined) {
      const output = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data, null, 2);
      console.log(output);
      return;
    }

    // Quiet mode: no message output
    if (context.globalOptions.quiet) {
      return;
    }

    // Normal mode: output message
    if (result.message) {
      console.log(result.message);
    }
  }

  /**
   * Convert Commander.js flag specification to a camelCase option name.
   * e.g., '-p, --port <number>' -> 'port'
   * e.g., '--dry-run' -> 'dryRun'
   */
  private flagsToOptionName(flags: string): string {
    const match = flags.match(/--([a-z-]+)/);
    if (!match || !match[1]) return flags;

    return match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  /**
   * Generate bash case clauses for subcommand completion.
   */
  private generateBashCaseClauses(): string {
    const clauses: string[] = [];

    for (const registered of Array.from(this.commands.values())) {
      const { definition } = registered;
      if (definition.hidden || definition.name.includes(':')) continue;

      const subNames: string[] = [];
      const optFlags: string[] = [];

      if (definition.subcommands) {
        for (const sub of definition.subcommands) {
          subNames.push(sub.name);
        }
      }

      if (definition.options) {
        for (const opt of definition.options) {
          const longMatch = opt.flags.match(/--[a-z-]+/);
          if (longMatch) optFlags.push(longMatch[0]);
        }
      }

      const words = [...subNames, ...optFlags].join(' ');
      if (words) {
        clauses.push(`      ${definition.name})\n        COMPREPLY=( $(compgen -W "${words}" -- "\${cur}") )\n        ;;`);
      }
    }

    return clauses.join('\n');
  }

  /**
   * Generate zsh case clauses for subcommand completion.
   */
  private generateZshCaseClauses(): string {
    const clauses: string[] = [];

    for (const registered of Array.from(this.commands.values())) {
      const { definition } = registered;
      if (definition.hidden || definition.name.includes(':')) continue;

      const args: string[] = [];

      if (definition.subcommands) {
        const subs = definition.subcommands
          .map(s => `'${s.name}:${s.description.replace(/'/g, "")}'`)
          .join(' ');
        args.push(`_values 'subcommand' ${subs}`);
      }

      if (definition.options) {
        for (const opt of definition.options) {
          const longMatch = opt.flags.match(/--([a-z-]+)/);
          if (longMatch) {
            args.push(`'--${longMatch[1]}[${opt.description.replace(/'/g, "")}]'`);
          }
        }
      }

      if (args.length > 0) {
        clauses.push(`        ${definition.name})\n          _arguments ${args.join(' \\\n            ')}\n          ;;`);
      }
    }

    return clauses.join('\n');
  }
}
