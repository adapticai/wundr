/**
 * Help Generator - Generates structured help text from command metadata.
 *
 * Produces:
 * - Categorized command listings
 * - Per-command detailed help with examples
 * - Man-page style output for documentation
 * - Markdown help for README generation
 * - Search across all commands
 *
 * @module framework/help-generator
 */

import chalk from 'chalk';

import type {
  CommandDefinition,
  CommandCategory,
} from './command-interface';
import { CATEGORY_LABELS } from './command-interface';
import type { CommandRegistry } from './command-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for help text generation.
 */
export interface HelpGeneratorOptions {
  /** Program name. Defaults to 'wundr'. */
  programName?: string;

  /** Maximum line width. Defaults to terminal width or 80. */
  maxWidth?: number;

  /** Whether to use colors. Defaults to TTY detection. */
  color?: boolean;

  /** Output format. */
  format?: 'terminal' | 'markdown' | 'plain';
}

/**
 * Result of a command search.
 */
export interface SearchResult {
  command: CommandDefinition;
  matchType: 'name' | 'alias' | 'description' | 'category';
  score: number;
}

// ---------------------------------------------------------------------------
// Help Generator
// ---------------------------------------------------------------------------

export class HelpGenerator {
  private programName: string;
  private maxWidth: number;
  private useColor: boolean;
  private format: 'terminal' | 'markdown' | 'plain';

  constructor(
    private registry: CommandRegistry,
    options: HelpGeneratorOptions = {},
  ) {
    this.programName = options.programName ?? 'wundr';
    this.maxWidth = options.maxWidth ?? (process.stdout.columns ?? 80);
    this.useColor = options.color ?? (process.stdout.isTTY === true);
    this.format = options.format ?? 'terminal';
  }

  // -------------------------------------------------------------------------
  // Main Help
  // -------------------------------------------------------------------------

  /**
   * Generate the main help text showing all commands grouped by category.
   */
  generateMainHelp(): string {
    if (this.format === 'markdown') {
      return this.generateMarkdownMainHelp();
    }

    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(this.heading(`${this.programName} - CLI Tool`));
    lines.push('');

    // Usage
    lines.push(this.sectionTitle('Usage'));
    lines.push(`  ${this.programName} <command> [options]`);
    lines.push('');

    // Commands by category
    const grouped = this.registry.grouped();
    const categories = Array.from(grouped.keys()).sort();

    for (const category of categories) {
      const commands = grouped.get(category);
      if (!commands || commands.length === 0) continue;

      // Skip hidden commands
      const visible = commands.filter(cmd => !cmd.hidden && !cmd.name.includes(':'));
      if (visible.length === 0) continue;

      const label = category === 'uncategorized'
        ? 'Other Commands'
        : CATEGORY_LABELS[category as CommandCategory] ?? category;

      lines.push(this.sectionTitle(label));

      // Find max name width for alignment
      const maxNameWidth = Math.max(...visible.map(cmd => {
        const aliases = cmd.aliases ? `, ${cmd.aliases.join(', ')}` : '';
        return cmd.name.length + aliases.length;
      }));

      for (const cmd of visible) {
        const aliases = cmd.aliases ? `, ${cmd.aliases.join(', ')}` : '';
        const nameCol = (cmd.name + aliases).padEnd(maxNameWidth + 2);
        lines.push(`  ${this.highlight(nameCol)}  ${cmd.description}`);
      }

      lines.push('');
    }

    // Global options
    lines.push(this.sectionTitle('Global Options'));
    lines.push('  --verbose          Enable verbose logging');
    lines.push('  --quiet            Suppress output');
    lines.push('  --json             Output as JSON');
    lines.push('  --no-color         Disable colored output');
    lines.push('  --dry-run          Show what would be done');
    lines.push('  --config <path>    Specify config file');
    lines.push('  -h, --help         Show help');
    lines.push('  -v, --version      Show version');
    lines.push('');

    // Footer
    lines.push(this.dim(`Run '${this.programName} <command> --help' for detailed help on a command.`));
    lines.push('');

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Command Help
  // -------------------------------------------------------------------------

  /**
   * Generate detailed help for a specific command.
   */
  generateCommandHelp(command: CommandDefinition): string {
    if (this.format === 'markdown') {
      return this.generateMarkdownCommandHelp(command);
    }

    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(this.heading(command.name));
    lines.push(`  ${command.description}`);
    lines.push('');

    // Aliases
    if (command.aliases && command.aliases.length > 0) {
      lines.push(this.sectionTitle('Aliases'));
      lines.push(`  ${command.aliases.join(', ')}`);
      lines.push('');
    }

    // Usage
    lines.push(this.sectionTitle('Usage'));
    const usage = this.buildUsageLine(command);
    lines.push(`  ${usage}`);
    lines.push('');

    // Arguments
    if (command.arguments && command.arguments.length > 0) {
      lines.push(this.sectionTitle('Arguments'));
      const maxArgWidth = Math.max(...command.arguments.map(a => a.name.length));

      for (const arg of command.arguments) {
        const nameCol = arg.name.padEnd(maxArgWidth + 2);
        const required = arg.required ? this.warn('(required)') : this.dim('(optional)');
        const defaultVal = arg.defaultValue ? this.dim(` [default: ${arg.defaultValue}]`) : '';
        lines.push(`  ${this.highlight(nameCol)}  ${arg.description} ${required}${defaultVal}`);
      }
      lines.push('');
    }

    // Options
    if (command.options && command.options.length > 0) {
      lines.push(this.sectionTitle('Options'));
      const maxFlagWidth = Math.max(...command.options.map(o => o.flags.length));

      for (const opt of command.options) {
        const flagCol = opt.flags.padEnd(maxFlagWidth + 2);
        const required = opt.required ? this.warn('(required)') : '';
        const choices = opt.choices ? this.dim(` [${opt.choices.join('|')}]`) : '';
        const defaultVal = opt.defaultValue !== undefined ? this.dim(` [default: ${opt.defaultValue}]`) : '';
        const envVar = opt.envVar ? this.dim(` [env: ${opt.envVar}]`) : '';
        lines.push(`  ${this.highlight(flagCol)}  ${opt.description}${required}${choices}${defaultVal}${envVar}`);
      }
      lines.push('');
    }

    // Subcommands
    if (command.subcommands && command.subcommands.length > 0) {
      lines.push(this.sectionTitle('Subcommands'));
      const maxSubWidth = Math.max(...command.subcommands.map(s => s.name.length));

      for (const sub of command.subcommands) {
        const nameCol = sub.name.padEnd(maxSubWidth + 2);
        lines.push(`  ${this.highlight(nameCol)}  ${sub.description}`);
      }
      lines.push('');
    }

    // Examples
    if (command.examples && command.examples.length > 0) {
      lines.push(this.sectionTitle('Examples'));
      for (const ex of command.examples) {
        lines.push(`  ${this.highlight(`$ ${ex.command}`)}`);
        lines.push(`    ${this.dim(ex.description)}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Search for commands matching a query string.
   */
  search(query: string): SearchResult[] {
    const normalizedQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const command of this.registry.list()) {
      if (command.hidden) continue;

      let bestScore = 0;
      let matchType: SearchResult['matchType'] = 'name';

      // Name match
      const nameScore = this.fuzzyScore(normalizedQuery, command.name.toLowerCase());
      if (nameScore > bestScore) {
        bestScore = nameScore;
        matchType = 'name';
      }

      // Alias match
      if (command.aliases) {
        for (const alias of command.aliases) {
          const aliasScore = this.fuzzyScore(normalizedQuery, alias.toLowerCase());
          if (aliasScore > bestScore) {
            bestScore = aliasScore;
            matchType = 'alias';
          }
        }
      }

      // Description match
      const descScore = this.fuzzyScore(normalizedQuery, command.description.toLowerCase()) * 0.6;
      if (descScore > bestScore) {
        bestScore = descScore;
        matchType = 'description';
      }

      // Category match
      if (command.category) {
        const catLabel = CATEGORY_LABELS[command.category]?.toLowerCase() ?? '';
        const catScore = this.fuzzyScore(normalizedQuery, catLabel) * 0.4;
        if (catScore > bestScore) {
          bestScore = catScore;
          matchType = 'category';
        }
      }

      if (bestScore > 0.3) {
        results.push({ command, matchType, score: bestScore });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // -------------------------------------------------------------------------
  // Markdown Output
  // -------------------------------------------------------------------------

  /**
   * Generate the main help as Markdown.
   */
  private generateMarkdownMainHelp(): string {
    const lines: string[] = [];

    lines.push(`# ${this.programName} CLI`);
    lines.push('');
    lines.push('## Usage');
    lines.push('');
    lines.push('```');
    lines.push(`${this.programName} <command> [options]`);
    lines.push('```');
    lines.push('');

    const grouped = this.registry.grouped();
    const categories = Array.from(grouped.keys()).sort();

    for (const category of categories) {
      const commands = grouped.get(category);
      if (!commands || commands.length === 0) continue;

      const visible = commands.filter(cmd => !cmd.hidden && !cmd.name.includes(':'));
      if (visible.length === 0) continue;

      const label = category === 'uncategorized'
        ? 'Other Commands'
        : CATEGORY_LABELS[category as CommandCategory] ?? category;

      lines.push(`## ${label}`);
      lines.push('');
      lines.push('| Command | Description |');
      lines.push('|---------|-------------|');

      for (const cmd of visible) {
        const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
        lines.push(`| \`${cmd.name}\`${aliases} | ${cmd.description} |`);
      }
      lines.push('');
    }

    lines.push('## Global Options');
    lines.push('');
    lines.push('| Option | Description |');
    lines.push('|--------|-------------|');
    lines.push('| `--verbose` | Enable verbose logging |');
    lines.push('| `--quiet` | Suppress output |');
    lines.push('| `--json` | Output as JSON |');
    lines.push('| `--no-color` | Disable colored output |');
    lines.push('| `--dry-run` | Show what would be done |');
    lines.push('| `--config <path>` | Specify config file |');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate per-command help as Markdown.
   */
  private generateMarkdownCommandHelp(command: CommandDefinition): string {
    const lines: string[] = [];

    lines.push(`# ${command.name}`);
    lines.push('');
    lines.push(command.description);
    lines.push('');

    if (command.aliases && command.aliases.length > 0) {
      lines.push(`**Aliases:** ${command.aliases.join(', ')}`);
      lines.push('');
    }

    lines.push('## Usage');
    lines.push('');
    lines.push('```');
    lines.push(this.buildUsageLine(command));
    lines.push('```');
    lines.push('');

    if (command.arguments && command.arguments.length > 0) {
      lines.push('## Arguments');
      lines.push('');
      lines.push('| Name | Description | Required | Default |');
      lines.push('|------|-------------|----------|---------|');
      for (const arg of command.arguments) {
        lines.push(`| \`${arg.name}\` | ${arg.description} | ${arg.required ? 'Yes' : 'No'} | ${arg.defaultValue ?? '-'} |`);
      }
      lines.push('');
    }

    if (command.options && command.options.length > 0) {
      lines.push('## Options');
      lines.push('');
      lines.push('| Flag | Description | Required | Default |');
      lines.push('|------|-------------|----------|---------|');
      for (const opt of command.options) {
        const defaultVal = opt.defaultValue !== undefined ? String(opt.defaultValue) : '-';
        lines.push(`| \`${opt.flags}\` | ${opt.description} | ${opt.required ? 'Yes' : 'No'} | ${defaultVal} |`);
      }
      lines.push('');
    }

    if (command.examples && command.examples.length > 0) {
      lines.push('## Examples');
      lines.push('');
      for (const ex of command.examples) {
        lines.push(`**${ex.description}:**`);
        lines.push('```');
        lines.push(ex.command);
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Build a usage line from command definition.
   */
  private buildUsageLine(command: CommandDefinition): string {
    const parts = [this.programName, command.name];

    if (command.arguments) {
      for (const arg of command.arguments) {
        if (arg.required) {
          parts.push(arg.variadic ? `<${arg.name}...>` : `<${arg.name}>`);
        } else {
          parts.push(arg.variadic ? `[${arg.name}...]` : `[${arg.name}]`);
        }
      }
    }

    if (command.options && command.options.length > 0) {
      parts.push('[options]');
    }

    return parts.join(' ');
  }

  /**
   * Simple fuzzy matching score between query and target.
   * Returns 0-1 where 1 is an exact match.
   */
  private fuzzyScore(query: string, target: string): number {
    if (query === target) return 1;
    if (target.startsWith(query)) return 0.9;
    if (target.includes(query)) return 0.7;

    // Character-by-character fuzzy
    let qi = 0;
    let ti = 0;
    let matched = 0;

    while (qi < query.length && ti < target.length) {
      if (query[qi] === target[ti]) {
        matched++;
        qi++;
      }
      ti++;
    }

    if (qi < query.length) return 0;
    return matched / target.length;
  }

  // -------------------------------------------------------------------------
  // Text formatting helpers
  // -------------------------------------------------------------------------

  private heading(text: string): string {
    if (!this.useColor) return text;
    return chalk.cyan.bold(text);
  }

  private sectionTitle(text: string): string {
    if (!this.useColor) return `${text}:`;
    return chalk.white.bold(`${text}:`);
  }

  private highlight(text: string): string {
    if (!this.useColor) return text;
    return chalk.green(text);
  }

  private dim(text: string): string {
    if (!this.useColor) return text;
    return chalk.gray(text);
  }

  private warn(text: string): string {
    if (!this.useColor) return text;
    return chalk.yellow(text);
  }
}
