/**
 * Config Export: Multi-Format Serialization and Default Generation
 *
 * Supports exporting config in JSON, JSON5 (comments), YAML, and TOML formats.
 * Provides default config generation with documentation comments.
 *
 * @module @wundr/orchestrator-daemon/config/config-export
 */

import { generateDefaultConfig } from './schemas';

import type { WundrConfig } from './schemas';

// =============================================================================
// Types
// =============================================================================

export type ConfigExportFormat = 'json' | 'json5' | 'yaml' | 'toml';

export interface ConfigExportOptions {
  /** Output format */
  format: ConfigExportFormat;
  /** Include default values that match schema defaults */
  includeDefaults?: boolean;
  /** Include documentation comments (where supported) */
  includeComments?: boolean;
  /** Indent size (spaces) */
  indent?: number;
  /** Sections to include (omit for all) */
  sections?: string[];
}

export interface ConfigExportResult {
  /** Serialized config string */
  content: string;
  /** Format that was used */
  format: ConfigExportFormat;
  /** Suggested file extension */
  extension: string;
  /** MIME type for HTTP responses */
  mimeType: string;
}

// =============================================================================
// Format Metadata
// =============================================================================

const FORMAT_META: Record<ConfigExportFormat, { extension: string; mimeType: string }> = {
  json: { extension: '.json', mimeType: 'application/json' },
  json5: { extension: '.json5', mimeType: 'application/json5' },
  yaml: { extension: '.yaml', mimeType: 'application/x-yaml' },
  toml: { extension: '.toml', mimeType: 'application/toml' },
};

// =============================================================================
// Schema Documentation
// =============================================================================

/**
 * Section-level documentation for config comments.
 */
const SECTION_DOCS: Record<string, string> = {
  meta: 'Configuration metadata and versioning',
  daemon: 'Daemon server settings (port, host, sessions, reload strategy)',
  openai: 'OpenAI API credentials and model defaults',
  anthropic: 'Anthropic API credentials and model defaults',
  agents: 'Agent definitions and shared defaults',
  memory: 'Memory backend, compaction, and context window settings',
  security: 'JWT, CORS, rate limiting, audit logging, mTLS',
  channels: 'Messaging channel configurations (Slack, Discord, Telegram, webhook)',
  models: 'Multi-provider model routing and fallback configuration',
  plugins: 'Plugin loading, allow/deny lists, and per-plugin settings',
  hooks: 'Lifecycle hook registrations and execution settings',
  monitoring: 'Prometheus metrics, health checks, and distributed tracing',
  logging: 'Log level, format, rotation, and structured output',
  distributed: 'Cluster name, load balancing, and session migration',
  redis: 'Redis connection for distributed state and pub/sub',
  database: 'Database connection for persistent storage',
  tokenBudget: 'Daily/weekly/monthly token usage limits and alerts',
  neolith: 'Neolith platform integration settings',
  env: 'Environment variable injection and shell env settings',
};

// =============================================================================
// Section Filtering
// =============================================================================

function filterSections(
  config: Record<string, unknown>,
  sections: string[] | undefined,
): Record<string, unknown> {
  if (!sections || sections.length === 0) {
    return config;
  }

  const sectionSet = new Set(sections);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (sectionSet.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

// =============================================================================
// JSON Export
// =============================================================================

function exportJson(
  config: Record<string, unknown>,
  indent: number,
): string {
  return JSON.stringify(config, null, indent).trimEnd().concat('\n');
}

// =============================================================================
// JSON5 Export (with comments)
// =============================================================================

function escapeJson5String(value: string): string {
  return JSON.stringify(value);
}

function toJson5Value(value: unknown, indent: number, depth: number): string {
  const pad = ' '.repeat(indent * depth);
  const childPad = ' '.repeat(indent * (depth + 1));

  if (value === null) {
return 'null';
}
  if (value === undefined) {
return 'undefined';
}
  if (typeof value === 'boolean') {
return String(value);
}
  if (typeof value === 'number') {
return String(value);
}
  if (typeof value === 'string') {
return escapeJson5String(value);
}

  if (Array.isArray(value)) {
    if (value.length === 0) {
return '[]';
}
    const items = value.map(
      (item) => `${childPad}${toJson5Value(item, indent, depth + 1)}`,
    );
    return `[\n${items.join(',\n')},\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
return '{}';
}

    const lines: string[] = [];
    for (const [key, val] of entries) {
      if (val === undefined) {
continue;
}

      // Use unquoted keys when possible
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? key
        : JSON.stringify(key);

      lines.push(
        `${childPad}${safeKey}: ${toJson5Value(val, indent, depth + 1)}`,
      );
    }

    return `{\n${lines.join(',\n')},\n${pad}}`;
  }

  return String(value);
}

function exportJson5(
  config: Record<string, unknown>,
  indent: number,
  includeComments: boolean,
): string {
  if (!includeComments) {
    return toJson5Value(config, indent, 0).trimEnd().concat('\n');
  }

  // Build with section comments
  const lines: string[] = ['// Wundr Orchestrator Daemon Configuration', '// See docs at https://wundr.io/docs/config', '{'];
  const pad = ' '.repeat(indent);
  const entries = Object.entries(config);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    if (value === undefined) {
continue;
}

    const doc = SECTION_DOCS[key];
    if (doc) {
      if (i > 0) {
lines.push('');
}
      lines.push(`${pad}// ${doc}`);
    }

    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
      ? key
      : JSON.stringify(key);

    const trailing = i < entries.length - 1 ? ',' : ',';
    lines.push(`${pad}${safeKey}: ${toJson5Value(value, indent, 1)}${trailing}`);
  }

  lines.push('}');
  return lines.join('\n').trimEnd().concat('\n');
}

// =============================================================================
// YAML Export
// =============================================================================

function escapeYamlString(value: string): string {
  // Check if the string needs quoting
  if (
    value === '' ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    value === 'yes' ||
    value === 'no' ||
    value === 'on' ||
    value === 'off' ||
    /^[0-9]/.test(value) ||
    /[:{}[\],&*?|>!%#@`]/.test(value) ||
    value.includes('\n')
  ) {
    return JSON.stringify(value);
  }
  return value;
}

function toYamlValue(
  value: unknown,
  indent: number,
  depth: number,
  includeComments: boolean,
  _key?: string,
): string {
  const pad = ' '.repeat(indent * depth);

  if (value === null || value === undefined) {
return 'null';
}
  if (typeof value === 'boolean') {
return String(value);
}
  if (typeof value === 'number') {
return String(value);
}
  if (typeof value === 'string') {
return escapeYamlString(value);
}

  if (Array.isArray(value)) {
    if (value.length === 0) {
return '[]';
}
    const items = value.map((item) => {
      const rendered = toYamlValue(item, indent, depth + 1, includeComments);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Object in array: indent the object body under the dash
        const objLines = rendered.split('\n');
        return `${pad}- ${objLines[0]}\n${objLines.slice(1).map((l) => `${pad}  ${l}`).join('\n')}`;
      }
      return `${pad}- ${rendered}`;
    });
    return '\n' + items.join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
return '{}';
}

    const lines: string[] = [];
    for (const [k, v] of entries) {
      if (v === undefined) {
continue;
}

      // Add section comment at top level
      if (depth === 0 && includeComments) {
        const doc = SECTION_DOCS[k];
        if (doc && lines.length > 0) {
          lines.push('');
          lines.push(`${pad}# ${doc}`);
        } else if (doc) {
          lines.push(`${pad}# ${doc}`);
        }
      }

      const rendered = toYamlValue(v, indent, depth + 1, includeComments, k);
      if (
        typeof v === 'object' &&
        v !== null &&
        ((Array.isArray(v) && v.length > 0) ||
          (!Array.isArray(v) && Object.keys(v).length > 0))
      ) {
        lines.push(`${pad}${k}:${rendered.startsWith('\n') ? rendered : '\n' + ' '.repeat(indent * (depth + 1)) + rendered}`);
      } else {
        lines.push(`${pad}${k}: ${rendered}`);
      }
    }

    const joined = lines.join('\n');
    return depth === 0 ? joined : '\n' + joined;
  }

  return String(value);
}

function exportYaml(
  config: Record<string, unknown>,
  indent: number,
  includeComments: boolean,
): string {
  const header = includeComments
    ? '# Wundr Orchestrator Daemon Configuration\n# See docs at https://wundr.io/docs/config\n\n'
    : '';
  const body = toYamlValue(config, indent, 0, includeComments);
  return header + body + '\n';
}

// =============================================================================
// TOML Export
// =============================================================================

function escapeTomlString(value: string): string {
  return JSON.stringify(value);
}

function toTomlValue(value: unknown): string {
  if (value === null || value === undefined) {
return '""';
}
  if (typeof value === 'boolean') {
return String(value);
}
  if (typeof value === 'number') {
return String(value);
}
  if (typeof value === 'string') {
return escapeTomlString(value);
}

  if (Array.isArray(value)) {
    if (value.length === 0) {
return '[]';
}
    // Check if it's an array of primitives
    const allPrimitive = value.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean',
    );
    if (allPrimitive) {
      const items = value.map(toTomlValue);
      return `[${items.join(', ')}]`;
    }
    // Array of objects: handled at table level
    return '[]';
  }

  return '""';
}

function flattenToToml(
  obj: Record<string, unknown>,
  prefix: string,
  lines: string[],
  includeComments: boolean,
): void {
  // First pass: inline values (primitives and primitive arrays)
  const inlineEntries: [string, unknown][] = [];
  const tableEntries: [string, unknown][] = [];
  const arrayTableEntries: [string, unknown[]][] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
continue;
}

    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      inlineEntries.push([key, value]);
    } else if (Array.isArray(value)) {
      const allPrimitive = value.every(
        (item) =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean',
      );
      if (allPrimitive) {
        inlineEntries.push([key, value]);
      } else {
        // Array of tables
        const allObjects = value.every(
          (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
        );
        if (allObjects) {
          arrayTableEntries.push([key, value]);
        } else {
          inlineEntries.push([key, value]);
        }
      }
    } else if (typeof value === 'object') {
      tableEntries.push([key, value]);
    }
  }

  // Write inline values
  for (const [key, value] of inlineEntries) {
    lines.push(`${key} = ${toTomlValue(value)}`);
  }

  // Write sub-tables
  for (const [key, value] of tableEntries) {
    const tablePath = prefix ? `${prefix}.${key}` : key;
    lines.push('');

    if (includeComments && !prefix) {
      const doc = SECTION_DOCS[key];
      if (doc) {
        lines.push(`# ${doc}`);
      }
    }

    lines.push(`[${tablePath}]`);
    flattenToToml(
      value as Record<string, unknown>,
      tablePath,
      lines,
      includeComments,
    );
  }

  // Write array tables
  for (const [key, items] of arrayTableEntries) {
    const tablePath = prefix ? `${prefix}.${key}` : key;
    for (const item of items) {
      lines.push('');
      lines.push(`[[${tablePath}]]`);
      flattenToToml(
        item as Record<string, unknown>,
        tablePath,
        lines,
        includeComments,
      );
    }
  }
}

function exportToml(
  config: Record<string, unknown>,
  includeComments: boolean,
): string {
  const lines: string[] = [];

  if (includeComments) {
    lines.push('# Wundr Orchestrator Daemon Configuration');
    lines.push('# See docs at https://wundr.io/docs/config');
    lines.push('');
  }

  // Write top-level primitives first
  const topPrimitives: [string, unknown][] = [];
  const topTables: [string, unknown][] = [];

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
continue;
}
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      topPrimitives.push([key, value]);
    } else {
      topTables.push([key, value]);
    }
  }

  for (const [key, value] of topPrimitives) {
    lines.push(`${key} = ${toTomlValue(value)}`);
  }

  for (const [key, value] of topTables) {
    lines.push('');

    if (includeComments) {
      const doc = SECTION_DOCS[key];
      if (doc) {
        lines.push(`# ${doc}`);
      }
    }

    if (Array.isArray(value)) {
      // Array of tables at top level
      for (const item of value) {
        lines.push(`[[${key}]]`);
        if (typeof item === 'object' && item !== null) {
          flattenToToml(item as Record<string, unknown>, key, lines, false);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`[${key}]`);
      flattenToToml(value as Record<string, unknown>, key, lines, false);
    }
  }

  return lines.join('\n').trimEnd().concat('\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Export a config object to the specified format.
 */
export function exportConfig(
  config: WundrConfig,
  options: ConfigExportOptions = { format: 'json' },
): ConfigExportResult {
  const indent = options.indent ?? 2;
  const includeComments = options.includeComments ?? true;
  const format = options.format;
  const meta = FORMAT_META[format];

  // Filter sections if requested
  let configObj = config as unknown as Record<string, unknown>;
  if (options.sections && options.sections.length > 0) {
    configObj = filterSections(configObj, options.sections);
  }

  // Remove $include from exports (it's a build-time directive)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $include: _include, ...exportable } = configObj as Record<string, unknown> & { $include?: unknown };
  const clean = exportable;

  let content: string;

  switch (format) {
    case 'json':
      content = exportJson(clean, indent);
      break;
    case 'json5':
      content = exportJson5(clean, indent, includeComments);
      break;
    case 'yaml':
      content = exportYaml(clean, indent, includeComments);
      break;
    case 'toml':
      content = exportToml(clean, includeComments);
      break;
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }

  return {
    content,
    format,
    extension: meta.extension,
    mimeType: meta.mimeType,
  };
}

/**
 * Generate a default config file in the specified format.
 *
 * Produces a fully-documented config file with all defaults explicitly set,
 * suitable as a starting template for new installations.
 */
export function generateDefaultConfigFile(
  format: ConfigExportFormat = 'json5',
  options: Partial<ConfigExportOptions> = {},
): ConfigExportResult {
  const config = generateDefaultConfig();

  return exportConfig(config, {
    format,
    includeDefaults: true,
    includeComments: true,
    indent: 2,
    ...options,
  });
}

/**
 * Get available export formats with metadata.
 */
export function getExportFormats(): Array<{
  format: ConfigExportFormat;
  extension: string;
  mimeType: string;
  description: string;
}> {
  return [
    {
      format: 'json',
      ...FORMAT_META.json,
      description: 'Standard JSON (no comments)',
    },
    {
      format: 'json5',
      ...FORMAT_META.json5,
      description: 'JSON5 with trailing commas and comments',
    },
    {
      format: 'yaml',
      ...FORMAT_META.yaml,
      description: 'YAML with comments',
    },
    {
      format: 'toml',
      ...FORMAT_META.toml,
      description: 'TOML with section headers and comments',
    },
  ];
}
