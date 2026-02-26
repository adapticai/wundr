/**
 * Config CLI: Validation, Export, and Inspection Commands
 *
 * Provides programmatic CLI command handlers for config operations.
 * Designed to be wired into a Commander.js CLI or invoked directly
 * from daemon admin endpoints.
 *
 * @module @wundr/orchestrator-daemon/config/config-cli
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  exportConfig,
  generateDefaultConfigFile,
  type ConfigExportFormat,
} from './config-export';
import { createConfigIO } from './config-loader';
import { diffConfigPaths } from './config-merger';
import { redactConfig } from './config-redactor';
import { buildReloadPlan, describeReloadPlan } from './config-watcher';
import { getStaticMappings } from './env-overrides';
import {
  type WundrConfig,
  validateConfig,
  generateDefaultConfig,
} from './schemas';

// =============================================================================
// Types
// =============================================================================

export interface CliResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Output text (stdout) */
  output: string;
  /** Error text (stderr) */
  error?: string;
}

export interface ValidateOptions {
  /** Config file path (auto-detected if not provided) */
  configPath?: string;
  /** Output format */
  format?: 'text' | 'json';
  /** Show redacted config values */
  showValues?: boolean;
  /** Check specific sections only */
  sections?: string[];
}

export interface ExportOptions {
  /** Config file path (auto-detected if not provided) */
  configPath?: string;
  /** Output format */
  format?: ConfigExportFormat;
  /** Output file (stdout if not provided) */
  outputPath?: string;
  /** Include comments */
  comments?: boolean;
  /** Sections to export */
  sections?: string[];
  /** Redact sensitive values */
  redact?: boolean;
}

export interface DiffOptions {
  /** First config path */
  configPathA: string;
  /** Second config path */
  configPathB: string;
  /** Output format */
  format?: 'text' | 'json';
}

export interface InitOptions {
  /** Output file path */
  outputPath: string;
  /** Config format */
  format?: ConfigExportFormat;
  /** Overwrite existing file */
  force?: boolean;
}

// =============================================================================
// Validate Command
// =============================================================================

/**
 * Validate a config file and report issues.
 */
export function validateCommand(options: ValidateOptions = {}): CliResult {
  try {
    const io = createConfigIO({ configPath: options.configPath });

    // Check if file exists
    if (!fs.existsSync(io.configPath)) {
      return {
        exitCode: 1,
        output: '',
        error: `Config file not found: ${io.configPath}\nRun "wundr config init" to create one.`,
      };
    }

    // Read and parse
    const raw = fs.readFileSync(io.configPath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        exitCode: 1,
        output: '',
        error: `Failed to parse config file: ${io.configPath}\nEnsure it is valid JSON or JSON5.`,
      };
    }

    // Validate
    const result = validateConfig(parsed);

    if (options.format === 'json') {
      const output = JSON.stringify(
        {
          path: io.configPath,
          valid: result.ok,
          issues: result.issues,
          warnings: result.warnings,
        },
        null,
        2
      );
      return { exitCode: result.ok ? 0 : 1, output };
    }

    // Text format
    const lines: string[] = [];
    lines.push(`Config: ${io.configPath}`);
    lines.push('');

    if (result.ok) {
      lines.push('Status: VALID');
    } else {
      lines.push('Status: INVALID');
      lines.push('');
      lines.push('Errors:');
      for (const issue of result.issues) {
        lines.push(`  - ${issue.path}: ${issue.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const warning of result.warnings) {
        lines.push(`  - ${warning.path}: ${warning.message}`);
      }
    }

    if (options.showValues && result.ok) {
      lines.push('');
      lines.push('Resolved config (redacted):');
      const redacted = redactConfig(result.config);
      lines.push(JSON.stringify(redacted, null, 2));
    }

    return { exitCode: result.ok ? 0 : 1, output: lines.join('\n') };
  } catch (err) {
    return {
      exitCode: 2,
      output: '',
      error: `Validation failed: ${String(err)}`,
    };
  }
}

// =============================================================================
// Export Command
// =============================================================================

/**
 * Export the current config in the specified format.
 */
export function exportCommand(options: ExportOptions = {}): CliResult {
  try {
    const format = options.format ?? 'json5';
    let config: WundrConfig;

    if (options.configPath && fs.existsSync(options.configPath)) {
      const io = createConfigIO({ configPath: options.configPath });
      config = io.loadConfig();
    } else {
      // Try to load from default location
      try {
        const io = createConfigIO({ configPath: options.configPath });
        config = io.loadConfig();
      } catch {
        // Use defaults
        config = generateDefaultConfig();
      }
    }

    // Redact if requested
    if (options.redact) {
      config = redactConfig(config) as WundrConfig;
    }

    const result = exportConfig(config, {
      format,
      includeComments: options.comments ?? true,
      sections: options.sections,
    });

    // Write to file or stdout
    if (options.outputPath) {
      const dir = path.dirname(options.outputPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(options.outputPath, result.content, 'utf-8');
      return {
        exitCode: 0,
        output: `Config exported to ${options.outputPath} (${result.format})`,
      };
    }

    return { exitCode: 0, output: result.content };
  } catch (err) {
    return {
      exitCode: 1,
      output: '',
      error: `Export failed: ${String(err)}`,
    };
  }
}

// =============================================================================
// Diff Command
// =============================================================================

/**
 * Diff two config files and show what would change during a reload.
 */
export function diffCommand(options: DiffOptions): CliResult {
  try {
    // Load both configs
    const ioA = createConfigIO({ configPath: options.configPathA });
    const ioB = createConfigIO({ configPath: options.configPathB });

    const configA = ioA.loadConfig();
    const configB = ioB.loadConfig();

    const changedPaths = diffConfigPaths(configA, configB);

    if (options.format === 'json') {
      const plan = buildReloadPlan(changedPaths);
      const output = JSON.stringify(
        {
          configA: options.configPathA,
          configB: options.configPathB,
          changedPaths,
          reloadPlan: {
            restartDaemon: plan.restartDaemon,
            restartReasons: plan.restartReasons,
            hotReasons: plan.hotReasons,
            noopPaths: plan.noopPaths,
            reloadHooks: plan.reloadHooks,
            reloadAgents: plan.reloadAgents,
            reloadChannels: Array.from(plan.reloadChannels),
            reloadMemory: plan.reloadMemory,
            reloadSecurity: plan.reloadSecurity,
          },
        },
        null,
        2
      );
      return { exitCode: 0, output };
    }

    // Text format
    if (changedPaths.length === 0) {
      return {
        exitCode: 0,
        output: `Comparing:\n  A: ${options.configPathA}\n  B: ${options.configPathB}\n\nNo differences found.`,
      };
    }

    const plan = buildReloadPlan(changedPaths);
    const planDesc = describeReloadPlan(plan);

    const lines: string[] = [];
    lines.push('Comparing:');
    lines.push(`  A: ${options.configPathA}`);
    lines.push(`  B: ${options.configPathB}`);
    lines.push('');
    lines.push(`Changed paths (${changedPaths.length}):`);
    for (const p of changedPaths) {
      lines.push(`  - ${p}`);
    }
    lines.push('');
    lines.push('Reload plan:');
    lines.push(planDesc);

    return { exitCode: 0, output: lines.join('\n') };
  } catch (err) {
    return {
      exitCode: 1,
      output: '',
      error: `Diff failed: ${String(err)}`,
    };
  }
}

// =============================================================================
// Init Command
// =============================================================================

/**
 * Generate a default config file.
 */
export function initCommand(options: InitOptions): CliResult {
  try {
    // Check if file exists
    if (fs.existsSync(options.outputPath) && !options.force) {
      return {
        exitCode: 1,
        output: '',
        error: `File already exists: ${options.outputPath}\nUse --force to overwrite.`,
      };
    }

    const format = options.format ?? 'json5';
    const result = generateDefaultConfigFile(format);

    const dir = path.dirname(options.outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.outputPath, result.content, 'utf-8');

    return {
      exitCode: 0,
      output: `Created default config: ${options.outputPath}\nEdit this file to configure your Wundr daemon.`,
    };
  } catch (err) {
    return {
      exitCode: 1,
      output: '',
      error: `Init failed: ${String(err)}`,
    };
  }
}

// =============================================================================
// Env List Command
// =============================================================================

/**
 * List all supported WUNDR_* environment variable overrides.
 */
export function envListCommand(format: 'text' | 'json' = 'text'): CliResult {
  const mappings = getStaticMappings();

  if (format === 'json') {
    const output = JSON.stringify(
      mappings.map(m => ({
        envKey: m.envKey,
        configPath: m.configPath,
        type: m.type,
      })),
      null,
      2
    );
    return { exitCode: 0, output };
  }

  const lines: string[] = [];
  lines.push('WUNDR_* Environment Variable Overrides:');
  lines.push('');
  lines.push('Variable'.padEnd(48) + 'Config Path'.padEnd(36) + 'Type');
  lines.push('-'.repeat(48 + 36 + 10));

  for (const mapping of mappings) {
    lines.push(
      mapping.envKey.padEnd(48) + mapping.configPath.padEnd(36) + mapping.type
    );
  }

  lines.push('');
  lines.push(
    `Total: ${mappings.length} mappings. Additional WUNDR_* variables are mapped dynamically.`
  );

  return { exitCode: 0, output: lines.join('\n') };
}

// =============================================================================
// Sections Command
// =============================================================================

/**
 * List all config sections with their reload behavior.
 */
export function sectionsCommand(format: 'text' | 'json' = 'text'): CliResult {
  const sections = [
    { id: 'daemon', reload: 'restart', description: 'Daemon server settings' },
    { id: 'openai', reload: 'restart', description: 'OpenAI API credentials' },
    {
      id: 'anthropic',
      reload: 'restart',
      description: 'Anthropic API credentials',
    },
    {
      id: 'agents',
      reload: 'hot',
      description: 'Agent definitions and defaults',
    },
    {
      id: 'memory',
      reload: 'hot',
      description: 'Memory backend and compaction',
    },
    {
      id: 'security.jwt',
      reload: 'restart',
      description: 'JWT authentication',
    },
    { id: 'security.cors', reload: 'hot', description: 'CORS configuration' },
    { id: 'security.rateLimit', reload: 'hot', description: 'Rate limiting' },
    { id: 'security.audit', reload: 'hot', description: 'Audit logging' },
    { id: 'security.mtls', reload: 'restart', description: 'Mutual TLS' },
    { id: 'channels.slack', reload: 'hot', description: 'Slack channel' },
    { id: 'channels.discord', reload: 'hot', description: 'Discord channel' },
    { id: 'channels.telegram', reload: 'hot', description: 'Telegram channel' },
    { id: 'channels.webhook', reload: 'hot', description: 'Webhook channel' },
    {
      id: 'models',
      reload: 'noop',
      description: 'Model routing (read at use-site)',
    },
    { id: 'plugins', reload: 'restart', description: 'Plugin system' },
    { id: 'hooks', reload: 'hot', description: 'Lifecycle hooks' },
    {
      id: 'monitoring',
      reload: 'noop',
      description: 'Metrics and health checks',
    },
    { id: 'logging', reload: 'noop', description: 'Logging configuration' },
    { id: 'distributed', reload: 'restart', description: 'Cluster settings' },
    { id: 'redis', reload: 'restart', description: 'Redis connection' },
    { id: 'database', reload: 'restart', description: 'Database connection' },
    {
      id: 'tokenBudget',
      reload: 'hot',
      description: 'Token budget and alerts',
    },
    { id: 'neolith', reload: 'restart', description: 'Neolith integration' },
  ];

  if (format === 'json') {
    return { exitCode: 0, output: JSON.stringify(sections, null, 2) };
  }

  const lines: string[] = [];
  lines.push('Config Sections and Reload Behavior:');
  lines.push('');
  lines.push('Section'.padEnd(28) + 'Reload'.padEnd(12) + 'Description');
  lines.push('-'.repeat(28 + 12 + 40));

  for (const section of sections) {
    lines.push(
      section.id.padEnd(28) + section.reload.padEnd(12) + section.description
    );
  }

  lines.push('');
  lines.push(
    'Reload modes: hot = live reload, restart = daemon restart required, noop = read at use-site'
  );

  return { exitCode: 0, output: lines.join('\n') };
}
