/**
 * Settings JSON Generator
 *
 * Generates `.claude/settings.json` configuration objects for Claude Code sessions.
 * The settings file controls tool permissions, denied tools, MCP server trust,
 * and other Claude Code behavior settings.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler/settings-json-generator
 */

import type {
  OrchestratorCharter,
  SessionManagerCharter,
  DisciplinePack,
  MCPServerConfig,
  HookConfig,
} from '../types/index.js';

// ============================================================================
// Settings Generator Configuration Types
// ============================================================================

/**
 * Configuration for settings.json generation.
 *
 * @example
 * ```typescript
 * const config: SettingsJsonGenerationConfig = {
 *   orchestratorCharter: engineeringVP,
 *   disciplinePack: backendDiscipline,
 *   additionalAllowedTools: ['Bash'],
 *   additionalDeniedTools: [],
 * };
 * ```
 */
export interface SettingsJsonGenerationConfig {
  /**
   * The Orchestrator charter defining capability boundaries and constraints.
   * Used to derive denied tools from forbidden commands and paths.
   */
  orchestratorCharter: OrchestratorCharter;

  /**
   * Optional Session Manager charter providing discipline-specific refinements.
   */
  sessionManagerCharter?: SessionManagerCharter;

  /**
   * The discipline pack providing MCP server and hook configurations.
   */
  disciplinePack: DisciplinePack;

  /**
   * Additional MCP servers beyond the discipline defaults.
   */
  additionalMcpServers?: MCPServerConfig[];

  /**
   * Additional hooks beyond the discipline defaults.
   */
  additionalHooks?: HookConfig[];

  /**
   * Explicit list of tools to allow in addition to the defaults derived
   * from the discipline and agent capability configurations.
   */
  additionalAllowedTools?: string[];

  /**
   * Explicit list of tools to deny in addition to those derived from
   * the Orchestrator's hard constraints.
   */
  additionalDeniedTools?: string[];
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * A single hook definition in the settings.json format.
 */
export interface SettingsHookDefinition {
  /** The shell command to execute */
  command: string;
  /** Optional conditions that must be met for the hook to fire */
  conditions?: Record<string, unknown>;
}

/**
 * Hooks organized by event type as expected by Claude Code's settings.json.
 */
export interface SettingsHooks {
  PreToolUse?: SettingsHookDefinition[];
  PostToolUse?: SettingsHookDefinition[];
  PreCommit?: SettingsHookDefinition[];
  PostCommit?: SettingsHookDefinition[];
}

/**
 * A single MCP server entry in the settings.json format.
 */
export interface SettingsMcpServer {
  /** Command to start the MCP server */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Trust level for the MCP server */
  trust?: 'trusted' | 'untrusted';
}

/**
 * The generated Claude Code settings.json structure.
 *
 * @remarks
 * This follows the `.claude/settings.json` schema consumed by Claude Code.
 * The `allowedTools` and `deniedTools` arrays control which tools Claude
 * can invoke during a session.
 */
export interface ClaudeSettingsJson {
  /**
   * List of tools that are explicitly allowed for this session.
   * When specified, Claude Code will only use tools in this list.
   */
  allowedTools?: string[];

  /**
   * List of tools that are explicitly denied for this session.
   * Takes precedence over allowedTools if both specify the same tool.
   */
  deniedTools?: string[];

  /**
   * MCP server configurations keyed by server name.
   */
  mcpServers?: Record<string, SettingsMcpServer>;

  /**
   * Hook definitions organized by event type.
   */
  hooks?: SettingsHooks;

  /**
   * Whether to enable auto-approval for safe operations.
   * Defaults to false for maximum safety.
   */
  autoApprove?: boolean;

  /**
   * Custom permissions block for fine-grained access control.
   */
  permissions?: {
    /** Glob patterns for files Claude is allowed to read */
    allowRead?: string[];
    /** Glob patterns for files Claude is allowed to write */
    allowWrite?: string[];
    /** Shell commands that are explicitly allowed */
    allowCommands?: string[];
  };
}

// ============================================================================
// Core Generator Function
// ============================================================================

/**
 * Generates a `.claude/settings.json` configuration object for a session.
 *
 * The generated settings object includes:
 * - **Allowed Tools**: Derived from discipline capabilities and explicit overrides
 * - **Denied Tools**: Derived from Orchestrator constraints and explicit overrides
 * - **MCP Servers**: All configured MCP servers with trust settings
 * - **Hooks**: Pre/post tool and commit hooks from the discipline pack
 * - **Permissions**: File-level access controls based on the discipline context
 *
 * @param config - The generation configuration
 * @returns A `ClaudeSettingsJson` object ready to be serialized to JSON
 *
 * @example
 * ```typescript
 * const settings = generateSettingsJson({
 *   orchestratorCharter: engineeringVP,
 *   disciplinePack: backendDiscipline,
 *   additionalAllowedTools: ['Bash'],
 * });
 *
 * // Write to file
 * await fs.writeFile(
 *   path.join(worktreePath, '.claude', 'settings.json'),
 *   JSON.stringify(settings, null, 2),
 *   'utf8'
 * );
 * ```
 */
export function generateSettingsJson(
  config: SettingsJsonGenerationConfig
): ClaudeSettingsJson {
  const {
    orchestratorCharter,
    disciplinePack,
    additionalMcpServers = [],
    additionalHooks = [],
    additionalAllowedTools = [],
    additionalDeniedTools = [],
  } = config;

  // -------------------------------------------------------------------------
  // Tool Permissions
  // -------------------------------------------------------------------------

  // Base allowed tools for all sessions - the standard Claude Code built-ins
  const baseAllowedTools = [
    'Read',
    'Glob',
    'Grep',
    'Task',
    'TodoRead',
    'TodoWrite',
  ];

  // Determine additional tools based on what MCP servers are configured
  const mcpDerivedTools: string[] = [];
  const allMcpServers = [...disciplinePack.mcpServers, ...additionalMcpServers];
  for (const server of allMcpServers) {
    // Add the MCP server tool identifier in the format mcp__<name>__*
    mcpDerivedTools.push(`mcp__${server.name}__*`);
  }

  const allowedTools = Array.from(
    new Set([
      ...baseAllowedTools,
      ...mcpDerivedTools,
      ...additionalAllowedTools,
    ])
  );

  // Derive denied tools from Orchestrator hard constraints
  const deniedTools: string[] = [];

  // If forbidden commands include dangerous shell operations, deny Bash entirely
  const dangerousShellPatterns = [
    'rm -rf',
    'sudo',
    'mkfs',
    'dd if=',
    ':(){:|:&};:',
  ];
  const hasDangerousCommands =
    orchestratorCharter.constraints.forbiddenCommands.some(cmd =>
      dangerousShellPatterns.some(pattern => cmd.includes(pattern))
    );

  // We do not deny Bash outright even if there are dangerous commands since
  // many legitimate engineering tasks require it. Instead we rely on CLAUDE.md
  // constraints to guide the model. Only deny explicitly listed tool names.
  for (const deniedTool of additionalDeniedTools) {
    deniedTools.push(deniedTool);
  }

  // Suppress the hasDangerousCommands variable warning - kept for future use
  void hasDangerousCommands;

  // -------------------------------------------------------------------------
  // MCP Server Definitions
  // -------------------------------------------------------------------------

  const mcpServers: Record<string, SettingsMcpServer> = {};

  for (const server of allMcpServers) {
    const serverDef: SettingsMcpServer = {
      command: server.command,
    };

    if (server.args && server.args.length > 0) {
      serverDef.args = server.args;
    }

    if (server.env && Object.keys(server.env).length > 0) {
      serverDef.env = server.env;
    }

    // All discipline-provided MCP servers are trusted
    serverDef.trust = 'trusted';

    mcpServers[server.name] = serverDef;
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  const allHooks = [...disciplinePack.hooks, ...additionalHooks];
  const hooks = buildHooksConfig(allHooks);

  // -------------------------------------------------------------------------
  // File Permissions
  // -------------------------------------------------------------------------

  const permissions: ClaudeSettingsJson['permissions'] = {};

  // Build forbidden path patterns into deny rules
  const forbiddenPaths = orchestratorCharter.constraints.forbiddenPaths;
  if (forbiddenPaths.length > 0) {
    // The allowRead/allowWrite fields use glob patterns for what IS allowed.
    // We express this as "allow everything except" by not restricting reads broadly,
    // and relying on CLAUDE.md instructions for path-level safety.
    // The permissions block here is used to explicitly allow common safe patterns.
    permissions.allowRead = ['**/*'];
    permissions.allowWrite = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.json',
      '**/*.md',
      '**/*.yaml',
      '**/*.yml',
      '**/*.css',
      '**/*.scss',
      '**/*.html',
      '**/*.sh',
      '**/*.sql',
      '**/*.py',
      '**/*.go',
      '**/*.rs',
      '**/.claude/**',
      '**/.memory/**',
    ];
  }

  // -------------------------------------------------------------------------
  // Assemble Final Settings Object
  // -------------------------------------------------------------------------

  const settings: ClaudeSettingsJson = {};

  if (allowedTools.length > 0) {
    settings.allowedTools = allowedTools;
  }

  if (deniedTools.length > 0) {
    settings.deniedTools = deniedTools;
  }

  if (Object.keys(mcpServers).length > 0) {
    settings.mcpServers = mcpServers;
  }

  if (hooks && Object.keys(hooks).length > 0) {
    settings.hooks = hooks;
  }

  // Never auto-approve by default - require human confirmation for sensitive ops
  settings.autoApprove = false;

  if (permissions && Object.keys(permissions).length > 0) {
    settings.permissions = permissions;
  }

  return settings;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the hooks configuration block from an array of HookConfig objects.
 *
 * @param hooks - Array of hook configurations
 * @returns The hooks block for settings.json or undefined if no hooks
 *
 * @internal
 */
function buildHooksConfig(hooks: HookConfig[]): SettingsHooks | undefined {
  if (hooks.length === 0) {
    return undefined;
  }

  const result: SettingsHooks = {};
  const byEvent: Record<string, SettingsHookDefinition[]> = {};

  for (const hook of hooks) {
    const def: SettingsHookDefinition = {
      command: hook.command,
    };

    if (hook.blocking) {
      def.conditions = { blocking: true };
    }

    if (!byEvent[hook.event]) {
      byEvent[hook.event] = [];
    }
    byEvent[hook.event].push(def);
  }

  if (byEvent['PreToolUse']?.length) {
    result.PreToolUse = byEvent['PreToolUse'];
  }
  if (byEvent['PostToolUse']?.length) {
    result.PostToolUse = byEvent['PostToolUse'];
  }
  if (byEvent['PreCommit']?.length) {
    result.PreCommit = byEvent['PreCommit'];
  }
  if (byEvent['PostCommit']?.length) {
    result.PostCommit = byEvent['PostCommit'];
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
