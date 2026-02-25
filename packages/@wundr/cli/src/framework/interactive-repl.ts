/**
 * Interactive REPL - Read-Eval-Print Loop for the CLI.
 *
 * Provides:
 * - Interactive command entry with readline
 * - Command history with persistence
 * - Tab completion for commands and options
 * - Command aliases and shortcuts
 * - Session context preservation
 * - Graceful exit handling
 *
 * @module framework/interactive-repl
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

import chalk from 'chalk';

import type {
  CommandContext,
  CommandDefinition,
  GlobalOptions,
} from './command-interface';
import type { CommandRegistry } from './command-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the REPL.
 */
export interface ReplOptions {
  /** Prompt string. Defaults to 'wundr> '. */
  prompt?: string;

  /** Path for persisting command history. */
  historyFile?: string;

  /** Maximum number of history entries. Defaults to 500. */
  maxHistory?: number;

  /** Whether to enable tab completion. Defaults to true. */
  tabCompletion?: boolean;

  /** Custom aliases mapping short forms to full commands. */
  aliases?: Record<string, string>;

  /** Welcome message shown on start. */
  welcomeMessage?: string;

  /** Factory to create a CommandContext for each command invocation. */
  contextFactory?: (globalOpts: GlobalOptions) => CommandContext;
}

/**
 * Command history entry.
 */
export interface HistoryEntry {
  command: string;
  timestamp: Date;
  success: boolean;
  duration?: number;
}

// ---------------------------------------------------------------------------
// Default Aliases
// ---------------------------------------------------------------------------

const DEFAULT_ALIASES: Record<string, string> = {
  s: 'status',
  q: 'quit',
  h: 'help',
  '?': 'help',
  ls: 'list',
  ll: 'list --verbose',
  cls: 'clear',
};

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

export class InteractiveRepl {
  private rl: readline.Interface | null = null;
  private running: boolean = false;
  private history: HistoryEntry[] = [];
  private prompt: string;
  private historyFile: string;
  private maxHistory: number;
  private aliases: Record<string, string>;
  private tabCompletion: boolean;
  private contextFactory?: (globalOpts: GlobalOptions) => CommandContext;

  constructor(
    private registry: CommandRegistry,
    options: ReplOptions = {}
  ) {
    this.prompt = options.prompt ?? chalk.cyan('wundr') + chalk.gray('> ');
    this.historyFile =
      options.historyFile ?? path.join(os.homedir(), '.wundr_history');
    this.maxHistory = options.maxHistory ?? 500;
    this.tabCompletion = options.tabCompletion ?? true;
    this.aliases = { ...DEFAULT_ALIASES, ...(options.aliases ?? {}) };
    this.contextFactory = options.contextFactory;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the REPL loop.
   */
  async start(welcomeMessage?: string): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Load history
    this.loadHistory();

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr, // Use stderr so stdout stays clean for piping
      prompt: this.prompt,
      terminal: process.stdin.isTTY === true,
      completer: this.tabCompletion ? this.completer.bind(this) : undefined,
      history: this.history.map(h => h.command),
      historySize: this.maxHistory,
    });

    // Welcome message
    if (welcomeMessage) {
      process.stderr.write(welcomeMessage + '\n\n');
    } else {
      process.stderr.write(
        chalk.cyan(
          'Interactive mode. Type "help" for commands, "quit" to exit.\n\n'
        )
      );
    }

    // Handle lines
    this.rl.on('line', async (line: string) => {
      const trimmed = line.trim();

      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      await this.handleLine(trimmed);
      this.rl?.prompt();
    });

    // Handle close
    this.rl.on('close', () => {
      this.stop();
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      process.stderr.write('\n(To exit, type "quit" or press Ctrl+D)\n');
      this.rl?.prompt();
    });

    this.rl.prompt();

    // Keep the process alive
    return new Promise<void>(resolve => {
      this.rl?.on('close', () => {
        resolve();
      });
    });
  }

  /**
   * Stop the REPL.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.saveHistory();

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    process.stderr.write(chalk.gray('\nGoodbye.\n'));
  }

  // -------------------------------------------------------------------------
  // Command Handling
  // -------------------------------------------------------------------------

  /**
   * Process a single input line.
   */
  private async handleLine(input: string): Promise<void> {
    const startTime = Date.now();
    let success = true;

    try {
      // Check built-in commands
      if (this.handleBuiltinCommand(input)) {
        this.recordHistory(input, true, Date.now() - startTime);
        return;
      }

      // Resolve aliases
      const resolved = this.resolveAlias(input);

      // Parse into command + args
      const parts = this.parseInput(resolved);
      if (parts.length === 0) return;

      const commandName = parts[0]!;
      const args = parts.slice(1);

      // Look up command
      const command = this.findCommand(commandName);
      if (!command) {
        process.stderr.write(chalk.red(`Unknown command: ${commandName}\n`));
        const suggestions = this.suggestCommands(commandName);
        if (suggestions.length > 0) {
          process.stderr.write(
            chalk.yellow(`Did you mean: ${suggestions.join(', ')}?\n`)
          );
        }
        success = false;
        this.recordHistory(input, false, Date.now() - startTime);
        return;
      }

      // Execute
      await this.executeCommand(command, args);
    } catch (error) {
      success = false;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(chalk.red(`Error: ${message}\n`));
    }

    this.recordHistory(input, success, Date.now() - startTime);
  }

  /**
   * Handle built-in REPL commands.
   * Returns true if the input was a built-in command.
   */
  private handleBuiltinCommand(input: string): boolean {
    const lower = input.toLowerCase();

    switch (lower) {
      case 'quit':
      case 'exit':
        this.stop();
        return true;

      case 'clear':
      case 'cls':
        process.stderr.write('\x1b[2J\x1b[H');
        return true;

      case 'help':
      case '?':
        this.showHelp();
        return true;

      case 'history':
        this.showHistory();
        return true;

      case 'aliases':
        this.showAliases();
        return true;

      default:
        return false;
    }
  }

  /**
   * Execute a resolved command.
   */
  private async executeCommand(
    command: CommandDefinition,
    rawArgs: string[]
  ): Promise<void> {
    // Build args and options from raw input
    const args: Record<string, unknown> = {};
    const options: Record<string, unknown> = {};

    let argIndex = 0;
    for (let i = 0; i < rawArgs.length; i++) {
      const token = rawArgs[i]!;

      if (token.startsWith('--')) {
        // Long option
        const eqPos = token.indexOf('=');
        if (eqPos !== -1) {
          const key = this.camelCase(token.substring(2, eqPos));
          options[key] = token.substring(eqPos + 1);
        } else {
          const key = this.camelCase(token.substring(2));
          const next = rawArgs[i + 1];
          if (next && !next.startsWith('-')) {
            options[key] = next;
            i++;
          } else {
            options[key] = true;
          }
        }
      } else if (token.startsWith('-') && token.length === 2) {
        // Short option
        const key = token.substring(1);
        const next = rawArgs[i + 1];
        if (next && !next.startsWith('-')) {
          options[key] = next;
          i++;
        } else {
          options[key] = true;
        }
      } else {
        // Positional arg
        if (command.arguments && command.arguments[argIndex]) {
          args[command.arguments[argIndex]!.name] = token;
          argIndex++;
        }
      }
    }

    // Create context
    const globalOpts: GlobalOptions = {
      verbose: !!options['verbose'],
      quiet: !!options['quiet'],
      json: !!options['json'],
      noColor: false,
      dryRun: !!options['dryRun'],
    };

    if (this.contextFactory) {
      const context = this.contextFactory(globalOpts);
      const result = await command.execute(args, options, context);

      if (result.message) {
        process.stdout.write(result.message + '\n');
      }

      if (result.exitCode !== 0) {
        process.stderr.write(
          chalk.red(`Command exited with code ${result.exitCode}\n`)
        );
      }
    } else {
      process.stderr.write(
        chalk.yellow('No context factory configured. Command not executed.\n')
      );
    }
  }

  // -------------------------------------------------------------------------
  // Tab Completion
  // -------------------------------------------------------------------------

  /**
   * Readline completer function.
   */
  private completer(line: string): [string[], string] {
    const parts = line.split(/\s+/);
    const current = parts[parts.length - 1] ?? '';

    let completions: string[];

    if (parts.length <= 1) {
      // Complete command names
      const allNames = [
        ...this.registry.getCompletionWords(),
        ...Object.keys(this.aliases),
        'help',
        'quit',
        'exit',
        'clear',
        'history',
        'aliases',
      ];
      completions = allNames.filter(name => name.startsWith(current));
    } else {
      // Complete options for the current command
      const commandName = parts[0]!;
      const command = this.findCommand(commandName);

      if (command && current.startsWith('-')) {
        const optFlags: string[] = [];
        if (command.options) {
          for (const opt of command.options) {
            const match = opt.flags.match(/--([a-z-]+)/);
            if (match) optFlags.push(`--${match[1]}`);
          }
        }
        // Add global options
        optFlags.push('--verbose', '--quiet', '--json', '--dry-run', '--help');
        completions = optFlags.filter(f => f.startsWith(current));
      } else if (command?.subcommands && !current.startsWith('-')) {
        completions = command.subcommands
          .map(s => s.name)
          .filter(n => n.startsWith(current));
      } else {
        completions = [];
      }
    }

    return [completions, current];
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  /**
   * Record a command in history.
   */
  private recordHistory(
    command: string,
    success: boolean,
    duration: number
  ): void {
    this.history.push({
      command,
      timestamp: new Date(),
      success,
      duration,
    });

    // Trim to max
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Load history from file.
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        this.history = lines.map(line => ({
          command: line,
          timestamp: new Date(),
          success: true,
        }));
      }
    } catch {
      // Silently ignore history load errors
    }
  }

  /**
   * Save history to file.
   */
  private saveHistory(): void {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = this.history
        .slice(-this.maxHistory)
        .map(h => h.command)
        .join('\n');
      fs.writeFileSync(this.historyFile, content + '\n');
    } catch {
      // Silently ignore history save errors
    }
  }

  /**
   * Show command history.
   */
  private showHistory(): void {
    const recent = this.history.slice(-20);
    if (recent.length === 0) {
      process.stderr.write(chalk.gray('No command history.\n'));
      return;
    }

    process.stderr.write(chalk.white.bold('Recent commands:\n'));
    for (let i = 0; i < recent.length; i++) {
      const entry = recent[i]!;
      const icon = entry.success ? chalk.green('+') : chalk.red('x');
      const duration = entry.duration
        ? chalk.gray(` (${entry.duration}ms)`)
        : '';
      process.stderr.write(`  ${icon} ${entry.command}${duration}\n`);
    }
  }

  // -------------------------------------------------------------------------
  // Aliases
  // -------------------------------------------------------------------------

  /**
   * Resolve an alias to the full command.
   */
  private resolveAlias(input: string): string {
    const parts = input.split(/\s+/);
    const first = parts[0]!;

    if (this.aliases[first]) {
      const expanded = this.aliases[first]!;
      return [expanded, ...parts.slice(1)].join(' ');
    }

    return input;
  }

  /**
   * Register a new alias.
   */
  addAlias(alias: string, command: string): void {
    this.aliases[alias] = command;
  }

  /**
   * Get all registered aliases.
   */
  getAliases(): Readonly<Record<string, string>> {
    return this.aliases;
  }

  /**
   * Show registered aliases.
   */
  private showAliases(): void {
    process.stderr.write(chalk.white.bold('Aliases:\n'));
    for (const [alias, command] of Object.entries(this.aliases)) {
      process.stderr.write(
        `  ${chalk.green(alias.padEnd(10))} -> ${command}\n`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Help
  // -------------------------------------------------------------------------

  /**
   * Show REPL help.
   */
  private showHelp(): void {
    process.stderr.write('\n');
    process.stderr.write(chalk.white.bold('Built-in commands:\n'));
    process.stderr.write(
      `  ${chalk.green('help')}        Show this help message\n`
    );
    process.stderr.write(
      `  ${chalk.green('history')}     Show command history\n`
    );
    process.stderr.write(
      `  ${chalk.green('aliases')}     Show command aliases\n`
    );
    process.stderr.write(`  ${chalk.green('clear')}       Clear the screen\n`);
    process.stderr.write(
      `  ${chalk.green('quit')}        Exit interactive mode\n`
    );
    process.stderr.write('\n');

    process.stderr.write(chalk.white.bold('Available commands:\n'));
    const commands = this.registry
      .list()
      .filter(c => !c.hidden && !c.name.includes(':'));
    for (const cmd of commands.slice(0, 15)) {
      const aliases = cmd.aliases
        ? chalk.gray(` (${cmd.aliases.join(', ')})`)
        : '';
      process.stderr.write(
        `  ${chalk.green(cmd.name.padEnd(20))} ${cmd.description}${aliases}\n`
      );
    }

    if (commands.length > 15) {
      process.stderr.write(
        chalk.gray(`  ... and ${commands.length - 15} more commands\n`)
      );
    }
    process.stderr.write('\n');
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Find a command by name or alias.
   */
  private findCommand(name: string): CommandDefinition | undefined {
    // Direct lookup
    const direct = this.registry.get(name);
    if (direct) return direct;

    // Search by alias
    for (const cmd of this.registry.list()) {
      if (cmd.aliases && cmd.aliases.includes(name)) {
        return cmd;
      }
    }

    return undefined;
  }

  /**
   * Suggest similar command names.
   */
  private suggestCommands(input: string): string[] {
    const allNames = this.registry.names();
    return allNames
      .filter(name => {
        // Simple edit-distance-like check
        if (name.startsWith(input.substring(0, 2))) return true;
        if (input.startsWith(name.substring(0, 2))) return true;
        return this.levenshtein(input, name) <= 2;
      })
      .slice(0, 3);
  }

  /**
   * Parse input respecting quoted strings.
   */
  private parseInput(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const char = input[i]!;

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) tokens.push(current);
    return tokens;
  }

  /**
   * Convert kebab-case to camelCase.
   */
  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  /**
   * Simple Levenshtein distance.
   */
  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost
        );
      }
    }

    return matrix[b.length]![a.length]!;
  }
}
