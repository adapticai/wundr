/**
 * MCP Tool Wrappers for Wundr CLI Commands
 * Maps CLI commands to MCP tool handlers
 *
 * @module @wundr/mcp-server/tools/cli-commands
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  createToolFromSchema,
  successResult,
  errorResult,
  globalRegistry,
} from './registry';

import { registerRagTools, initializeRagTools as initRagTools } from './rag';

import type {
  ToolRegistry,
  McpToolResult} from './registry';
import type {
  ComputerSetupInput,
  ClaudeConfigInput,
  BackupInput,
  RollbackInput,
  ProjectInitInput,
  ClaudeSetupInput,
  DriftDetectionInput,
  PatternStandardizeInput,
  MonorepoManageInput,
  GovernanceReportInput,
  DependencyAnalyzeInput,
  TestBaselineInput,
} from './schemas';

// ============================================================================
// Command Executor Utility
// ============================================================================

/**
 * Options for command execution
 */
interface ExecuteCommandOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Capture and return output */
  captureOutput?: boolean;
  /** Stream output to console */
  streamOutput?: boolean;
}

/**
 * Result of command execution
 */
interface CommandResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Combined output */
  output: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Execute a CLI command and return the result
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Promise resolving to command result
 */
async function executeCommand(
  command: string,
  args: string[],
  options: ExecuteCommandOptions = {},
): Promise<CommandResult> {
  const {
    cwd = process.cwd(),
    env = process.env as Record<string, string>,
    timeout = 300000, // 5 minutes default
    captureOutput = true,
  } = options;

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd,
      env: { ...env, FORCE_COLOR: '0' }, // Disable colors for clean output
      shell: true,
      stdio: captureOutput ? 'pipe' : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    const timeoutId = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    childProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        output: (stdout + '\n' + stderr).trim(),
        duration: Date.now() - startTime,
      });
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Execute wundr CLI command
 */
async function executeWundrCommand(
  subcommand: string,
  args: string[] = [],
  options: ExecuteCommandOptions = {},
): Promise<CommandResult> {
  // Try to find wundr CLI
  const wundrPaths = [
    path.resolve(__dirname, '../../../../cli/bin/wundr.js'),
    'wundr',
    'npx wundr',
  ];

  let wundrCmd = 'npx wundr';
  for (const p of wundrPaths) {
    if (p.startsWith('npx') || p === 'wundr') {
      try {
        execSync('which wundr', { stdio: 'ignore' });
        wundrCmd = 'wundr';
        break;
      } catch {
        continue;
      }
    } else if (fs.existsSync(p)) {
      wundrCmd = `node ${p}`;
      break;
    }
  }

  return executeCommand(wundrCmd, [subcommand, ...args], options);
}

// ============================================================================
// Computer Setup Tool Handlers
// ============================================================================

/**
 * Handler for computer-setup MCP tool
 * Sets up a new developer machine with all required tools and configurations
 *
 * @param input - ComputerSetupInput parameters
 * @returns McpToolResult with setup result
 */
async function computerSetupHandler(
  input: ComputerSetupInput,
): Promise<McpToolResult<{ message: string; steps: string[]; warnings: string[] }>> {
  const args: string[] = [];

  // Build command arguments based on input
  if (input.subcommand && input.subcommand !== 'run') {
    args.push(input.subcommand);
  }

  if (input.profile) {
    args.push('--profile', input.profile);
  }

  if (input.team) {
    args.push('--team', input.team);
  }

  if (input.mode) {
    args.push('--mode', input.mode);
  }

  if (input.skipExisting) {
    args.push('--skip-existing');
  }

  if (input.parallel) {
    args.push('--parallel');
  }

  if (input.report) {
    args.push('--report');
  }

  if (input.dryRun) {
    args.push('--dry-run');
  }

  try {
    const result = await executeWundrCommand('computer-setup', args);

    if (result.exitCode === 0) {
      return successResult({
        message: 'Computer setup completed successfully',
        steps: result.stdout.split('\n').filter(line => line.includes('[')),
        warnings: result.stderr ? [result.stderr] : [],
      });
    } else {
      return errorResult(
        `Computer setup failed with exit code ${result.exitCode}`,
        'SETUP_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

/**
 * Handler for claude-config MCP tool
 * Installs Claude Code configuration files
 */
async function claudeConfigHandler(
  input: ClaudeConfigInput,
): Promise<McpToolResult<{ installed: string[]; skipped: string[] }>> {
  const args: string[] = ['claude-config'];

  if (input.dryRun) {
    args.push('--dry-run');
  }

  if (input.skipBackup) {
    args.push('--skip-backup');
  }

  if (input.overwrite) {
    args.push('--overwrite');
  }

  if (input.verbose) {
    args.push('--verbose');
  }

  try {
    const result = await executeWundrCommand('computer-setup', args);

    if (result.exitCode === 0) {
      return successResult({
        installed: result.stdout.split('\n').filter(line => line.includes('Installed')),
        skipped: result.stdout.split('\n').filter(line => line.includes('Skipped')),
      });
    } else {
      return errorResult(
        'Claude config installation failed',
        'CONFIG_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

/**
 * Handler for backup MCP tool
 * Manages configuration backups
 */
async function backupHandler(
  input: BackupInput,
): Promise<McpToolResult<{ backups?: Array<{ id: string; date: string }>; message: string }>> {
  const args: string[] = ['backup'];

  switch (input.action) {
    case 'list':
      args.push('--list');
      break;
    case 'create':
      args.push('--create');
      break;
    case 'verify':
      args.push('--verify', input.backupId || '');
      break;
    case 'cleanup':
      args.push('--cleanup');
      break;
  }

  try {
    const result = await executeWundrCommand('computer-setup', args);

    if (result.exitCode === 0) {
      // Parse backup list from output if listing
      let backups: Array<{ id: string; date: string }> | undefined;
      if (input.action === 'list') {
        const lines = result.stdout.split('\n');
        backups = lines
          .filter(line => line.match(/backup-\d+/))
          .map(line => {
            const match = line.match(/(backup-\d+).*(\d{4}-\d{2}-\d{2})/);
            return match ? { id: match[1], date: match[2] } : null;
          })
          .filter((b): b is { id: string; date: string } => b !== null);
      }

      return successResult({
        backups,
        message: `Backup ${input.action} completed successfully`,
      });
    } else {
      return errorResult(
        `Backup ${input.action} failed`,
        'BACKUP_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

/**
 * Handler for rollback MCP tool
 * Rolls back to a previous configuration backup
 */
async function rollbackHandler(
  input: RollbackInput,
): Promise<McpToolResult<{ restored: string[]; message: string }>> {
  const args: string[] = ['rollback', input.backupId];

  if (input.component) {
    args.push('--component', input.component);
  }

  if (input.force) {
    args.push('--force');
  }

  try {
    const result = await executeWundrCommand('computer-setup', args);

    if (result.exitCode === 0) {
      return successResult({
        restored: result.stdout.split('\n').filter(line => line.includes('Restored')),
        message: `Rollback to ${input.backupId} completed successfully`,
      });
    } else {
      return errorResult(
        `Rollback to ${input.backupId} failed`,
        'ROLLBACK_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Project Init Tool Handler
// ============================================================================

/**
 * Handler for project-init MCP tool
 * Initializes a new Wundr project with template selection
 */
async function projectInitHandler(
  input: ProjectInitInput,
): Promise<McpToolResult<{ projectPath: string; template: string; message: string }>> {
  const args: string[] = ['project'];

  if (input.name) {
    args.push(input.name);
  }

  if (input.template) {
    args.push('--template', input.template);
  }

  if (input.skipGit) {
    args.push('--skip-git');
  }

  if (input.skipInstall) {
    args.push('--skip-install');
  }

  if (input.monorepo) {
    args.push('--monorepo');
  }

  try {
    const cwd = input.directory || process.cwd();
    const result = await executeWundrCommand('init', args, { cwd });

    if (result.exitCode === 0) {
      const projectPath = path.join(cwd, input.name || 'wundr-project');
      return successResult({
        projectPath,
        template: input.template || 'default',
        message: `Project initialized successfully at ${projectPath}`,
      });
    } else {
      return errorResult(
        'Project initialization failed',
        'INIT_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Claude Setup Tool Handler
// ============================================================================

/**
 * Handler for claude-setup MCP tool
 * Sets up Claude Code, Claude Flow, and MCP tools
 */
async function claudeSetupHandler(
  input: ClaudeSetupInput,
): Promise<McpToolResult<{ components: string[]; message: string }>> {
  const args: string[] = [];

  if (input.subcommand) {
    args.push(input.subcommand);
  }

  if (input.skipChrome) {
    args.push('--skip-chrome');
  }

  if (input.skipMcp) {
    args.push('--skip-mcp');
  }

  if (input.skipAgents) {
    args.push('--skip-agents');
  }

  if (input.tool) {
    args.push('--tool', input.tool);
  }

  if (input.profile) {
    args.push('--profile', input.profile);
  }

  if (input.agents) {
    args.push('--enable', input.agents);
  }

  if (input.fix) {
    args.push('--fix');
  }

  if (input.force) {
    args.push('--force');
  }

  try {
    const result = await executeWundrCommand('claude-setup', args);

    if (result.exitCode === 0) {
      return successResult({
        components: result.stdout.split('\n').filter(line => line.includes('[') || line.includes('Installed')),
        message: `Claude setup (${input.subcommand || 'install'}) completed successfully`,
      });
    } else {
      return errorResult(
        'Claude setup failed',
        'CLAUDE_SETUP_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Drift Detection Tool Handler
// ============================================================================

/**
 * Handler for drift-detection MCP tool
 * Monitors code quality drift and creates baselines
 */
async function driftDetectionHandler(
  input: DriftDetectionInput,
): Promise<McpToolResult<{ driftScore?: number; trends?: Array<{ category: string; change: number }>; message: string }>> {
  const args: string[] = ['check'];

  // Map action to governance command
  switch (input.action) {
    case 'check':
      args.push('--rules', 'drift');
      break;
    case 'baseline':
      args.push('--report');
      break;
    case 'trends':
      args.push('--report');
      break;
    case 'report':
      args.push('--report');
      break;
  }

  if (input.path) {
    args.push('--path', input.path);
  }

  if (input.threshold) {
    args.push('--threshold', input.threshold.toString());
  }

  if (input.categories && input.categories.length > 0) {
    args.push('--categories', input.categories.join(','));
  }

  if (input.format) {
    args.push('--format', input.format);
  }

  try {
    const result = await executeWundrCommand('govern', args);

    if (result.exitCode === 0) {
      // Parse drift metrics from output
      const driftMatch = result.stdout.match(/drift.*?(\d+(\.\d+)?)/i);
      const driftScore = driftMatch && driftMatch[1] ? parseFloat(driftMatch[1]) : undefined;

      return successResult({
        driftScore,
        trends: [], // Would be parsed from actual output
        message: `Drift detection (${input.action}) completed`,
      });
    } else {
      return errorResult(
        'Drift detection failed',
        'DRIFT_DETECTION_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Pattern Standardize Tool Handler
// ============================================================================

/**
 * Handler for pattern-standardize MCP tool
 * Auto-fixes code patterns to meet standards
 */
async function patternStandardizeHandler(
  input: PatternStandardizeInput,
): Promise<McpToolResult<{ fixed: number; issues: Array<{ file: string; pattern: string; message: string }> }>> {
  const args: string[] = ['check'];

  if (input.pattern && input.pattern !== 'all') {
    args.push('--rules', input.pattern);
  }

  if (input.autoFix) {
    args.push('--fix');
  }

  if (input.dryRun) {
    args.push('--dry-run');
  }

  if (input.severity) {
    args.push('--severity', input.severity);
  }

  try {
    const cwd = input.path || process.cwd();
    const result = await executeWundrCommand('govern', args, { cwd });

    if (result.exitCode === 0 || result.exitCode === 1) { // Exit 1 often means issues found
      // Parse fixed count and issues from output
      const fixedMatch = result.stdout.match(/Fixed\s+(\d+)/i);
      const fixed = fixedMatch && fixedMatch[1] ? parseInt(fixedMatch[1], 10) : 0;

      return successResult({
        fixed,
        issues: [], // Would be parsed from actual output
      });
    } else {
      return errorResult(
        'Pattern standardization failed',
        'PATTERN_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Monorepo Manage Tool Handler
// ============================================================================

/**
 * Handler for monorepo-manage MCP tool
 * Manages monorepo packages and dependencies
 */
async function monorepoManageHandler(
  input: MonorepoManageInput,
): Promise<McpToolResult<{ packages?: string[]; circularDeps?: string[][]; message: string }>> {
  const args: string[] = [];

  switch (input.action) {
    case 'init':
      args.push('workspace');
      break;
    case 'add-package':
      if (input.packageName) {
        args.push('create', 'package', input.packageName);
        if (input.packageType) {
          args.push('--type', input.packageType);
        }
        if (input.template) {
          args.push('--template', input.template);
        }
      }
      break;
    case 'check-circular':
      args.push('deps', '--circular');
      break;
    case 'sync-versions':
      args.push('deps', '--sync');
      break;
    case 'list-packages':
      args.push('deps', '--list');
      break;
    case 'graph':
      args.push('deps', '--graph');
      break;
  }

  if (input.scope) {
    args.push('--scope', input.scope);
  }

  if (input.format) {
    args.push('--format', input.format);
  }

  try {
    const command = input.action === 'check-circular' || input.action === 'list-packages' || input.action === 'graph' || input.action === 'sync-versions'
      ? 'analyze'
      : 'init';

    const result = await executeWundrCommand(command, args);

    if (result.exitCode === 0) {
      return successResult({
        packages: result.stdout.split('\n').filter(line => line.match(/^\s*-?\s*@?[\w-]+/)),
        circularDeps: [], // Would be parsed from actual output
        message: `Monorepo ${input.action} completed successfully`,
      });
    } else {
      return errorResult(
        `Monorepo ${input.action} failed`,
        'MONOREPO_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Governance Report Tool Handler
// ============================================================================

/**
 * Handler for governance-report MCP tool
 * Generates governance and compliance reports
 */
async function governanceReportHandler(
  input: GovernanceReportInput,
): Promise<McpToolResult<{ reportPath?: string; summary: Record<string, unknown> }>> {
  const args: string[] = ['report'];

  args.push('--type', input.reportType);

  if (input.period) {
    args.push('--period', input.period);
  }

  if (input.startDate) {
    args.push('--start-date', input.startDate);
  }

  if (input.endDate) {
    args.push('--end-date', input.endDate);
  }

  if (input.output) {
    args.push('--output', input.output);
  }

  if (input.format) {
    args.push('--format', input.format);
  }

  try {
    const result = await executeWundrCommand('govern', args);

    if (result.exitCode === 0) {
      return successResult({
        reportPath: input.output,
        summary: {
          type: input.reportType,
          period: input.period,
          generated: new Date().toISOString(),
        },
      });
    } else {
      return errorResult(
        'Governance report generation failed',
        'REPORT_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Dependency Analyze Tool Handler
// ============================================================================

/**
 * Handler for dependency-analyze MCP tool
 * Analyzes project dependencies for issues
 */
async function dependencyAnalyzeHandler(
  input: DependencyAnalyzeInput,
): Promise<McpToolResult<{
  circular?: string[][];
  unused?: string[];
  outdated?: Array<{ name: string; current: string; latest: string }>;
  security?: Array<{ name: string; severity: string; description: string }>;
}>> {
  const args: string[] = ['deps'];

  switch (input.action) {
    case 'circular':
      args.push('--circular');
      break;
    case 'unused':
      args.push('--unused');
      break;
    case 'outdated':
      args.push('--outdated');
      break;
    case 'security':
      args.push('--security');
      break;
    case 'graph':
      args.push('--graph');
      break;
    case 'all':
      // Run all checks
      break;
  }

  if (input.depth) {
    args.push('--depth', input.depth.toString());
  }

  if (input.includeDevDeps) {
    args.push('--include-dev');
  }

  if (input.format) {
    args.push('--format', input.format);
  }

  if (input.output) {
    args.push('--output', input.output);
  }

  try {
    const cwd = input.path || process.cwd();
    const result = await executeWundrCommand('analyze', args, { cwd });

    if (result.exitCode === 0 || result.exitCode === 1) {
      return successResult({
        circular: [],
        unused: [],
        outdated: [],
        security: [],
        // Would be parsed from actual output
      });
    } else {
      return errorResult(
        'Dependency analysis failed',
        'DEPENDENCY_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Test Baseline Tool Handler
// ============================================================================

/**
 * Handler for test-baseline MCP tool
 * Manages test coverage baselines
 */
async function testBaselineHandler(
  input: TestBaselineInput,
): Promise<McpToolResult<{
  baselineId?: string;
  coverage?: number;
  comparison?: { baseline: number; current: number; diff: number };
  message: string;
}>> {
  const args: string[] = [];

  switch (input.action) {
    case 'create':
      args.push('--coverage', '--save-baseline');
      break;
    case 'compare':
      args.push('--coverage', '--compare-baseline');
      if (input.baselineId) {
        args.push('--baseline-id', input.baselineId);
      }
      break;
    case 'update':
      args.push('--coverage', '--update-baseline');
      if (input.baselineId) {
        args.push('--baseline-id', input.baselineId);
      }
      break;
    case 'report':
      args.push('--coverage', '--report');
      break;
  }

  if (input.coverageThreshold) {
    args.push('--threshold', input.coverageThreshold.toString());
  }

  if (input.failOnDecrease) {
    args.push('--fail-on-decrease');
  }

  if (input.format) {
    args.push('--format', input.format);
  }

  if (input.output) {
    args.push('--output', input.output);
  }

  try {
    const cwd = input.path || process.cwd();
    const result = await executeWundrCommand('test', args, { cwd });

    if (result.exitCode === 0) {
      // Parse coverage from output
      const coverageMatch = result.stdout.match(/coverage.*?(\d+(\.\d+)?)/i);
      const coverage = coverageMatch && coverageMatch[1] ? parseFloat(coverageMatch[1]) : undefined;

      return successResult({
        baselineId: input.baselineId,
        coverage,
        comparison: undefined, // Would be parsed from actual output
        message: `Test baseline ${input.action} completed`,
      });
    } else {
      return errorResult(
        `Test baseline ${input.action} failed`,
        'TEST_BASELINE_FAILED',
        { output: result.output },
      );
    }
  } catch (error) {
    return errorResult(
      error instanceof Error ? error.message : String(error),
      'EXECUTION_ERROR',
    );
  }
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register all CLI command tools with a registry
 *
 * @param registry - ToolRegistry instance to register tools with
 */
export function registerCliCommandTools(registry: ToolRegistry): void {
  // Computer Setup Tools
  registry.register(
    createToolFromSchema('computer-setup', computerSetupHandler),
    { version: '1.0.0' },
  );

  registry.register(
    createToolFromSchema('claude-config', claudeConfigHandler),
    { version: '1.0.0' },
  );

  registry.register(
    createToolFromSchema('backup', backupHandler),
    { version: '1.0.0' },
  );

  registry.register(
    createToolFromSchema('rollback', rollbackHandler),
    { version: '1.0.0' },
  );

  // Project Init Tool
  registry.register(
    createToolFromSchema('project-init', projectInitHandler),
    { version: '1.0.0' },
  );

  // Claude Setup Tool
  registry.register(
    createToolFromSchema('claude-setup', claudeSetupHandler),
    { version: '1.0.0' },
  );

  // Governance Tools
  registry.register(
    createToolFromSchema('drift-detection', driftDetectionHandler),
    { version: '1.0.0' },
  );

  registry.register(
    createToolFromSchema('pattern-standardize', patternStandardizeHandler),
    { version: '1.0.0' },
  );

  registry.register(
    createToolFromSchema('governance-report', governanceReportHandler),
    { version: '1.0.0' },
  );

  // Monorepo Tools
  registry.register(
    createToolFromSchema('monorepo-manage', monorepoManageHandler),
    { version: '1.0.0' },
  );

  // Analysis Tools
  registry.register(
    createToolFromSchema('dependency-analyze', dependencyAnalyzeHandler),
    { version: '1.0.0' },
  );

  // Testing Tools
  registry.register(
    createToolFromSchema('test-baseline', testBaselineHandler),
    { version: '1.0.0' },
  );
}

/**
 * Initialize and register all CLI tools with the global registry
 */
export function initializeCliTools(): ToolRegistry {
  registerCliCommandTools(globalRegistry);
  return globalRegistry;
}

// ============================================================================
// Unified Initialization
// ============================================================================

/**
 * Initialize all tools (CLI + RAG) with the global registry
 *
 * @returns The global tool registry with all tools registered
 */
export function initializeAllTools(): ToolRegistry {
  registerCliCommandTools(globalRegistry);
  registerRagTools(globalRegistry);
  return globalRegistry;
}

/**
 * Re-export RAG tools initialization for convenience
 */
export { registerRagTools, initRagTools as initializeRagTools };

// ============================================================================
// Exports
// ============================================================================

export {
  computerSetupHandler,
  claudeConfigHandler,
  backupHandler,
  rollbackHandler,
  projectInitHandler,
  claudeSetupHandler,
  driftDetectionHandler,
  patternStandardizeHandler,
  monorepoManageHandler,
  governanceReportHandler,
  dependencyAnalyzeHandler,
  testBaselineHandler,
  executeCommand,
  executeWundrCommand,
};
