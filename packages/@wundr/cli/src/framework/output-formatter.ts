/**
 * Output Formatter - Consistent output formatting for all CLI commands.
 *
 * Provides:
 * - Table rendering with column alignment and truncation
 * - JSON output (pretty or compact)
 * - Key-value pair formatting
 * - List formatting (ordered/unordered)
 * - Tree rendering for hierarchical data
 * - Progress bars
 * - Status indicators with consistent color coding
 * - Diff formatting
 * - Smart output that respects --json, --quiet, --no-color flags
 *
 * @module framework/output-formatter
 */

import chalk from 'chalk';

import type {
  CommandContext,
  OutputFormatterInterface,
} from './command-interface';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for table rendering.
 */
export interface TableOptions {
  /** Column headers. If not provided, inferred from data keys. */
  columns?: ColumnDefinition[];

  /** Maximum width for the entire table. Defaults to terminal width. */
  maxWidth?: number;

  /** Whether to show row numbers. */
  rowNumbers?: boolean;

  /** Whether to show borders. */
  borders?: boolean;

  /** Header style. */
  headerStyle?: 'bold' | 'underline' | 'dim' | 'none';

  /** Empty table message. */
  emptyMessage?: string;

  /** Maximum number of rows to display. */
  maxRows?: number;
}

/**
 * Column definition for table rendering.
 */
export interface ColumnDefinition {
  /** Column header label */
  header: string;

  /** Property key in the data object */
  key: string;

  /** Fixed width for the column. If not set, auto-calculated. */
  width?: number;

  /** Minimum width. */
  minWidth?: number;

  /** Maximum width. */
  maxWidth?: number;

  /** Text alignment. */
  align?: 'left' | 'right' | 'center';

  /** Custom formatter for cell values. */
  format?: (value: unknown) => string;

  /** Color function for cell values. */
  color?: (value: unknown) => string;
}

/**
 * Options for JSON output.
 */
export interface JsonOptions {
  /** Pretty print with indentation. Defaults to true. */
  pretty?: boolean;

  /** Indentation spaces. Defaults to 2. */
  indent?: number;

  /** Sort object keys. */
  sortKeys?: boolean;
}

/**
 * Options for key-value pair formatting.
 */
export interface KeyValueOptions {
  /** Separator between key and value. Defaults to ': '. */
  separator?: string;

  /** Padding for key column alignment. */
  keyWidth?: number;

  /** Color for keys. */
  keyColor?: (s: string) => string;

  /** Color for values. */
  valueColor?: (s: string) => string;

  /** Indentation level. */
  indent?: number;
}

/**
 * Options for list formatting.
 */
export interface ListOptions {
  /** Ordered (numbered) list. */
  ordered?: boolean;

  /** Bullet character for unordered lists. */
  bullet?: string;

  /** Indentation level. */
  indent?: number;
}

/**
 * Node in a tree structure.
 */
export interface TreeNode {
  /** Display label */
  label: string;

  /** Optional icon/prefix */
  prefix?: string;

  /** Child nodes */
  children?: TreeNode[];
}

/**
 * Options for tree rendering.
 */
export interface TreeOptions {
  /** Whether to use Unicode box-drawing characters. Defaults to true. */
  unicode?: boolean;

  /** Indentation per level. */
  indent?: number;

  /** Maximum depth to render. */
  maxDepth?: number;
}

/**
 * Options for progress bar.
 */
export interface ProgressOptions {
  /** Total width of the progress bar. Defaults to 30. */
  width?: number;

  /** Filled character. Defaults to '='. */
  filled?: string;

  /** Empty character. Defaults to '-'. */
  empty?: string;

  /** Show percentage. */
  showPercentage?: boolean;

  /** Show count (current/total). */
  showCount?: boolean;

  /** Label to show after the bar. */
  label?: string;
}

/**
 * Status states with associated colors and icons.
 */
export type StatusState =
  | 'running'
  | 'stopped'
  | 'error'
  | 'pending'
  | 'done'
  | 'skipped'
  | 'warning'
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'active'
  | 'paused'
  | 'terminated';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  StatusState,
  { icon: string; color: (s: string) => string }
> = {
  running: { icon: '[RUNNING]', color: chalk.green },
  active: { icon: '[ACTIVE]', color: chalk.green },
  healthy: { icon: '[HEALTHY]', color: chalk.green },
  done: { icon: '[DONE]', color: chalk.blue },
  stopped: { icon: '[STOPPED]', color: chalk.yellow },
  paused: { icon: '[PAUSED]', color: chalk.yellow },
  warning: { icon: '[WARNING]', color: chalk.yellow },
  degraded: { icon: '[DEGRADED]', color: chalk.yellow },
  pending: { icon: '[PENDING]', color: chalk.cyan },
  error: { icon: '[ERROR]', color: chalk.red },
  unhealthy: { icon: '[UNHEALTHY]', color: chalk.red },
  terminated: { icon: '[TERMINATED]', color: chalk.gray },
  skipped: { icon: '[SKIPPED]', color: chalk.gray },
};

const TREE_CHARS = {
  unicode: {
    branch: '\u251c\u2500\u2500 ',
    last: '\u2514\u2500\u2500 ',
    pipe: '\u2502   ',
    empty: '    ',
  },
  ascii: { branch: '|-- ', last: '`-- ', pipe: '|   ', empty: '    ' },
};

// ---------------------------------------------------------------------------
// Output Formatter
// ---------------------------------------------------------------------------

export class OutputFormatter implements OutputFormatterInterface {
  private noColor: boolean;

  constructor(options: { noColor?: boolean } = {}) {
    this.noColor = options.noColor ?? process.env['NO_COLOR'] === '1';
  }

  // -------------------------------------------------------------------------
  // Table
  // -------------------------------------------------------------------------

  /**
   * Render a data array as an aligned table.
   *
   * @param data - Array of row objects
   * @param options - Table rendering options
   * @returns Formatted table string
   */
  table(data: Record<string, unknown>[], options: TableOptions = {}): string {
    if (data.length === 0) {
      return options.emptyMessage ?? chalk.gray('No data to display.');
    }

    // Determine columns
    const columns = options.columns ?? this.inferColumns(data);
    const rows = options.maxRows ? data.slice(0, options.maxRows) : data;

    // Calculate column widths
    const widths = this.calculateColumnWidths(columns, rows, options.maxWidth);

    // Render header
    const lines: string[] = [];

    const headerLine = columns
      .map((col, i) => {
        const text = this.padCell(
          col.header,
          widths[i] ?? 10,
          col.align ?? 'left'
        );
        return this.applyHeaderStyle(text, options.headerStyle ?? 'bold');
      })
      .join('  ');

    lines.push(headerLine);

    // Separator
    const separator = columns
      .map((_, i) => chalk.gray('-'.repeat(widths[i] ?? 10)))
      .join('  ');
    lines.push(separator);

    // Render rows
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;

      const prefix = options.rowNumbers ? chalk.gray(`${rowIndex + 1}. `) : '';
      const cells = columns
        .map((col, i) => {
          const rawValue = row[col.key];
          const formatted = col.format
            ? col.format(rawValue)
            : String(rawValue ?? '');
          const truncated = this.truncate(formatted, widths[i] ?? 10);
          const padded = this.padCell(
            truncated,
            widths[i] ?? 10,
            col.align ?? 'left'
          );
          return col.color ? col.color(rawValue) : padded;
        })
        .join('  ');

      lines.push(prefix + cells);
    }

    // Truncation notice
    if (options.maxRows && data.length > options.maxRows) {
      lines.push(
        chalk.gray(`... and ${data.length - options.maxRows} more rows`)
      );
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // JSON
  // -------------------------------------------------------------------------

  /**
   * Format data as JSON.
   *
   * @param data - Any serializable data
   * @param pretty - Pretty print. Defaults to true.
   * @returns JSON string
   */
  json(data: unknown, pretty: boolean = true): string {
    if (pretty) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  // -------------------------------------------------------------------------
  // Key-Value
  // -------------------------------------------------------------------------

  /**
   * Format key-value pairs with aligned columns.
   *
   * @param data - Object with string keys
   * @param options - Formatting options
   * @returns Formatted key-value string
   */
  keyValue(
    data: Record<string, unknown>,
    options: KeyValueOptions = {}
  ): string {
    const separator = options.separator ?? ': ';
    const indent = ' '.repeat(options.indent ?? 0);
    const keyColor = options.keyColor ?? chalk.white;
    const valueColor = options.valueColor ?? ((s: string) => s);

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return chalk.gray('No data.');
    }

    // Calculate key width for alignment
    const keyWidth =
      options.keyWidth ?? Math.max(...entries.map(([k]) => k.length));

    return entries
      .map(([key, value]) => {
        const paddedKey = key.padEnd(keyWidth);
        const formattedValue = this.formatValue(value);
        return `${indent}${keyColor(paddedKey)}${separator}${valueColor(formattedValue)}`;
      })
      .join('\n');
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  /**
   * Format items as a list.
   *
   * @param items - List items
   * @param ordered - Use numbers instead of bullets
   * @returns Formatted list string
   */
  list(items: string[], ordered: boolean = false): string {
    if (items.length === 0) {
      return chalk.gray('Empty list.');
    }

    const indent = '  ';

    return items
      .map((item, index) => {
        const prefix = ordered ? chalk.gray(`${index + 1}.`) : chalk.gray('-');
        return `${indent}${prefix} ${item}`;
      })
      .join('\n');
  }

  // -------------------------------------------------------------------------
  // Tree
  // -------------------------------------------------------------------------

  /**
   * Render a tree structure.
   *
   * @param node - Root node
   * @param options - Rendering options
   * @returns Formatted tree string
   */
  tree(node: TreeNode, options: TreeOptions = {}): string {
    const chars =
      options.unicode !== false ? TREE_CHARS.unicode : TREE_CHARS.ascii;
    const maxDepth = options.maxDepth ?? Infinity;

    const lines: string[] = [];
    lines.push(`${node.prefix ?? ''}${node.label}`);

    if (node.children) {
      this.renderTreeChildren(node.children, '', chars, lines, 0, maxDepth);
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Progress Bar
  // -------------------------------------------------------------------------

  /**
   * Render a progress bar.
   *
   * @param current - Current progress value
   * @param total - Total/target value
   * @param width - Bar width in characters
   * @returns Formatted progress bar string
   */
  progressBar(current: number, total: number, width: number = 30): string {
    const percentage = total > 0 ? Math.min(current / total, 1) : 0;
    const filled = Math.round(percentage * width);
    const empty = width - filled;

    const bar =
      chalk.cyan('[') +
      chalk.green('='.repeat(filled)) +
      chalk.gray('-'.repeat(empty)) +
      chalk.cyan(']');

    const pct = `${(percentage * 100).toFixed(1)}%`;
    const count = `${current}/${total}`;

    return `${bar} ${pct} (${count})`;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /**
   * Format a status indicator with consistent color and icon.
   *
   * @param state - Status state
   * @param label - Label to display next to the status
   * @returns Formatted status string
   */
  status(state: string, label: string): string {
    const config = STATUS_CONFIG[state as StatusState];

    if (!config) {
      return `[${state.toUpperCase()}] ${label}`;
    }

    return `${config.color(config.icon)} ${label}`;
  }

  // -------------------------------------------------------------------------
  // Diff
  // -------------------------------------------------------------------------

  /**
   * Format a simple diff between two values.
   *
   * @param before - Original value
   * @param after - New value
   * @returns Formatted diff string
   */
  diff(before: string, after: string): string {
    return `${chalk.red('- ' + before)}\n${chalk.green('+ ' + after)}`;
  }

  // -------------------------------------------------------------------------
  // Section Headers
  // -------------------------------------------------------------------------

  /**
   * Format a section header with a separator line.
   *
   * @param title - Section title
   * @param width - Separator width. Defaults to 60.
   * @returns Formatted header string
   */
  header(title: string, width: number = 60): string {
    return `\n${chalk.cyan(title)}\n${chalk.gray('='.repeat(width))}`;
  }

  /**
   * Format a sub-section header.
   *
   * @param title - Sub-section title
   * @param width - Separator width. Defaults to 40.
   * @returns Formatted sub-header string
   */
  subHeader(title: string, width: number = 40): string {
    return `\n${chalk.white(title)}\n${chalk.gray('-'.repeat(width))}`;
  }

  // -------------------------------------------------------------------------
  // Duration & Size Formatting
  // -------------------------------------------------------------------------

  /**
   * Format a duration in milliseconds to a human-readable string.
   */
  duration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format bytes to a human-readable string.
   */
  bytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // -------------------------------------------------------------------------
  // YAML
  // -------------------------------------------------------------------------

  /**
   * Format data as YAML.
   * Uses a lightweight built-in serializer to avoid external dependencies.
   *
   * @param data - Any serializable data
   * @param indent - Indentation level (used for recursion). Defaults to 0.
   * @returns YAML-formatted string
   */
  yaml(data: unknown, indent: number = 0): string {
    return this.toYaml(data, indent);
  }

  // -------------------------------------------------------------------------
  // Multi-format output
  // -------------------------------------------------------------------------

  /**
   * Format data in the specified output format.
   *
   * @param data - Data to format
   * @param format - Output format
   * @returns Formatted string
   */
  formatAs(data: unknown, format: 'json' | 'yaml' | 'table' | 'plain'): string {
    switch (format) {
      case 'json':
        return this.json(data);
      case 'yaml':
        return this.yaml(data);
      case 'table':
        if (
          Array.isArray(data) &&
          data.length > 0 &&
          typeof data[0] === 'object'
        ) {
          return this.table(data as Record<string, unknown>[]);
        }
        if (typeof data === 'object' && data !== null) {
          return this.keyValue(data as Record<string, unknown>);
        }
        return String(data);
      case 'plain':
        if (typeof data === 'string') return data;
        if (typeof data === 'object') return JSON.stringify(data, null, 2);
        return String(data);
    }
  }

  // -------------------------------------------------------------------------
  // Smart Output
  // -------------------------------------------------------------------------

  /**
   * Smart output respecting context flags (--json, --quiet, --no-color).
   *
   * In JSON mode: outputs data as JSON to stdout.
   * In quiet mode: outputs nothing.
   * Otherwise: outputs message to stdout.
   *
   * @param data - Structured data for JSON mode
   * @param message - Human-readable message for normal mode
   * @param context - Command context with global flags
   */
  output(data: unknown, message: string, context: CommandContext): void {
    if (context.globalOptions.quiet) {
      return;
    }

    if (context.globalOptions.json) {
      console.log(this.json(data));
      return;
    }

    console.log(message);
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private inferColumns(data: Record<string, unknown>[]): ColumnDefinition[] {
    const firstRow = data[0];
    if (!firstRow) return [];

    return Object.keys(firstRow).map(key => ({
      header: this.humanize(key),
      key,
      align: 'left' as const,
    }));
  }

  private calculateColumnWidths(
    columns: ColumnDefinition[],
    data: Record<string, unknown>[],
    maxWidth?: number
  ): number[] {
    const termWidth = maxWidth ?? process.stdout.columns ?? 120;
    const gap = 2; // gap between columns

    return columns.map(col => {
      // Header width
      let width = col.header.length;

      // Data widths
      for (const row of data) {
        const val = row[col.key];
        const formatted = col.format ? col.format(val) : String(val ?? '');
        width = Math.max(width, formatted.length);
      }

      // Apply constraints
      if (col.minWidth) width = Math.max(width, col.minWidth);
      if (col.maxWidth) width = Math.min(width, col.maxWidth);
      if (col.width) width = col.width;

      return width;
    });
  }

  private padCell(
    text: string,
    width: number,
    align: 'left' | 'right' | 'center'
  ): string {
    if (text.length >= width) return text.substring(0, width);

    switch (align) {
      case 'right':
        return text.padStart(width);
      case 'center': {
        const leftPad = Math.floor((width - text.length) / 2);
        const rightPad = width - text.length - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      }
      default:
        return text.padEnd(width);
    }
  }

  private applyHeaderStyle(text: string, style: string): string {
    switch (style) {
      case 'bold':
        return chalk.bold(text);
      case 'underline':
        return chalk.underline(text);
      case 'dim':
        return chalk.dim(text);
      default:
        return text;
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return chalk.gray('(none)');
    if (typeof value === 'boolean')
      return value ? chalk.green('true') : chalk.red('false');
    if (typeof value === 'number') return chalk.cyan(String(value));
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private humanize(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\s/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Lightweight YAML serializer.
   */
  private toYaml(data: unknown, indent: number): string {
    const prefix = '  '.repeat(indent);

    if (data === null || data === undefined) {
      return 'null';
    }

    if (typeof data === 'string') {
      // Quote strings that need it
      if (
        data === '' ||
        data.includes('\n') ||
        data.includes(':') ||
        data.includes('#') ||
        data === 'true' ||
        data === 'false' ||
        data === 'null' ||
        /^\d+$/.test(data)
      ) {
        return `"${data.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      }
      return data;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return '[]';
      const items = data.map(item => {
        const val = this.toYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          // Object items: put first key on same line as dash
          const firstNewline = val.indexOf('\n');
          if (firstNewline === -1) {
            return `${prefix}- ${val}`;
          }
          return `${prefix}- ${val}`;
        }
        return `${prefix}- ${val}`;
      });
      return '\n' + items.join('\n');
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) return '{}';

      const lines = entries.map(([key, value]) => {
        const serialized = this.toYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null) {
          return `${prefix}${key}:${serialized.startsWith('\n') ? serialized : ' ' + serialized}`;
        }
        return `${prefix}${key}: ${serialized}`;
      });

      return (indent > 0 ? '\n' : '') + lines.join('\n');
    }

    return String(data);
  }

  private renderTreeChildren(
    children: TreeNode[],
    prefix: string,
    chars: typeof TREE_CHARS.unicode,
    lines: string[],
    depth: number,
    maxDepth: number
  ): void {
    if (depth >= maxDepth) return;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;

      const isLast = i === children.length - 1;
      const connector = isLast ? chars.last : chars.branch;
      const nodePrefix = child.prefix ? `${child.prefix} ` : '';

      lines.push(`${prefix}${connector}${nodePrefix}${child.label}`);

      if (child.children && child.children.length > 0) {
        const childPrefix = prefix + (isLast ? chars.empty : chars.pipe);
        this.renderTreeChildren(
          child.children,
          childPrefix,
          chars,
          lines,
          depth + 1,
          maxDepth
        );
      }
    }
  }
}
