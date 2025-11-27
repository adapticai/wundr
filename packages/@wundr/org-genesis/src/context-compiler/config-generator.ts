/**
 * Config Generator
 *
 * Generates configuration files (CLAUDE.md, claude_config.json, settings.json) for sessions.
 * This module provides a unified interface for creating all necessary configuration files
 * that define Claude Code's behavior within a specific discipline context.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler/config-generator
 */

import type {
  DisciplinePack,
  OrchestratorCharter,
  MCPServerConfig,
  HookConfig,
} from '../types/index.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Context for generating CLAUDE.md content.
 *
 * @description
 * Contains all the information needed to generate a discipline-specific
 * CLAUDE.md file, including the discipline pack, optional Orchestrator charter,
 * custom instructions, and memory bank configuration.
 *
 * @example
 * ```typescript
 * const context: GenerateClaudeMdContext = {
 *   discipline: myDisciplinePack,
 *   vpCharter: engineeringVP,
 *   customInstructions: ['Always use TypeScript strict mode'],
 *   memoryBankEnabled: true,
 * };
 * ```
 */
export interface GenerateClaudeMdContext {
  /**
   * The discipline pack containing CLAUDE.md configuration.
   */
  discipline: DisciplinePack;

  /**
   * Optional Orchestrator charter for additional context and constraints.
   * When provided, Orchestrator-level directives will be included in the generated file.
   */
  vpCharter?: OrchestratorCharter;

  /**
   * Optional custom instructions to append to the generated CLAUDE.md.
   * These instructions are added after the discipline-specific content.
   */
  customInstructions?: string[];

  /**
   * Whether to include memory bank integration instructions.
   * When enabled, adds memory bank paths and usage guidelines.
   * @default false
   */
  memoryBankEnabled?: boolean;
}

/**
 * Claude configuration JSON structure for MCP servers.
 *
 * @description
 * Represents the structure of a claude_config.json file that defines
 * which MCP servers should be available for a session.
 *
 * @example
 * ```typescript
 * const config: ClaudeConfigJson = {
 *   mcpServers: {
 *     'github': {
 *       command: 'npx',
 *       args: ['@modelcontextprotocol/server-github'],
 *       env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
 *     },
 *   },
 * };
 * ```
 */
export interface ClaudeConfigJson {
  /**
   * Map of MCP server names to their definitions.
   */
  mcpServers: Record<string, MCPServerDefinition>;
}

/**
 * Definition for a single MCP server in the claude_config.json.
 *
 * @description
 * Specifies how to start and configure an MCP server, including
 * the command to execute, arguments, and environment variables.
 */
export interface MCPServerDefinition {
  /**
   * The command to execute to start the MCP server.
   * @example 'npx', 'node', '/usr/local/bin/mcp-server'
   */
  command: string;

  /**
   * Optional arguments to pass to the command.
   * @example ['@modelcontextprotocol/server-github']
   */
  args?: string[];

  /**
   * Optional environment variables for the server process.
   * Supports ${VAR_NAME} syntax for referencing system environment variables.
   * @example { GITHUB_TOKEN: '${GITHUB_TOKEN}' }
   */
  env?: Record<string, string>;
}

/**
 * Settings JSON structure for hook configurations.
 *
 * @description
 * Represents the structure of a settings.json file that defines
 * hooks to be executed at various points in the Claude Code lifecycle.
 *
 * @example
 * ```typescript
 * const settings: SettingsJson = {
 *   hooks: {
 *     preToolUse: [
 *       { command: 'npm run lint', conditions: { toolName: 'Write' } },
 *     ],
 *     postToolUse: [
 *       { command: 'npm run format' },
 *     ],
 *   },
 * };
 * ```
 */
export interface SettingsJson {
  /**
   * Hook configurations organized by event type.
   */
  hooks?: {
    /**
     * Hooks executed before a tool is used.
     */
    preToolUse?: HookDefinition[];

    /**
     * Hooks executed after a tool completes.
     */
    postToolUse?: HookDefinition[];

    /**
     * Hooks executed before a git commit.
     */
    preCommit?: HookDefinition[];

    /**
     * Hooks executed after a git commit.
     */
    postCommit?: HookDefinition[];
  };
}

/**
 * Definition for a single hook in the settings.json.
 *
 * @description
 * Specifies a command to execute when a hook is triggered,
 * with optional conditions for when the hook should fire.
 */
export interface HookDefinition {
  /**
   * The command to execute when the hook is triggered.
   * @example 'npm run lint', 'bash scripts/validate.sh'
   */
  command: string;

  /**
   * Optional conditions that must be met for the hook to execute.
   * Keys are condition names, values are the expected values.
   * @example { toolName: 'Write', fileExtension: '.ts' }
   */
  conditions?: Record<string, unknown>;
}

/**
 * Context for generating all configuration files.
 *
 * @description
 * Comprehensive context object containing everything needed to
 * generate all configuration files for a session.
 *
 * @example
 * ```typescript
 * const context: GenerateAllContext = {
 *   discipline: myDisciplinePack,
 *   vpCharter: engineeringVP,
 *   customInstructions: ['Use TDD approach'],
 *   memoryBankEnabled: true,
 *   additionalServers: [customMCPServer],
 *   additionalHooks: [customHook],
 * };
 * ```
 */
export interface GenerateAllContext {
  /**
   * The discipline pack containing base configurations.
   */
  discipline: DisciplinePack;

  /**
   * Optional Orchestrator charter for additional context.
   */
  vpCharter?: OrchestratorCharter;

  /**
   * Optional custom instructions for CLAUDE.md.
   */
  customInstructions?: string[];

  /**
   * Whether to enable memory bank integration.
   * @default false
   */
  memoryBankEnabled?: boolean;

  /**
   * Additional MCP servers to include beyond discipline defaults.
   */
  additionalServers?: MCPServerConfig[];

  /**
   * Additional hooks to include beyond discipline defaults.
   */
  additionalHooks?: HookConfig[];
}

/**
 * Collection of all generated configuration files.
 *
 * @description
 * Contains the output of generating all configuration files,
 * ready to be written to the file system.
 */
export interface GeneratedConfigs {
  /**
   * The generated CLAUDE.md content as a string.
   */
  claudeMd: string;

  /**
   * The generated claude_config.json as a parsed object.
   */
  claudeConfig: ClaudeConfigJson;

  /**
   * The generated settings.json as a parsed object.
   */
  settings: SettingsJson;
}

// ============================================================================
// Default Templates
// ============================================================================

/**
 * Default CLAUDE.md template structure.
 */
const DEFAULT_CLAUDE_MD_TEMPLATE = `# Claude Code Configuration

## Role
{{role}}

## Context
{{context}}

## Objectives
{{objectives}}

## Rules
{{rules}}

## Constraints
{{constraints}}

{{#if vpDirective}}
## Orchestrator Directive
{{vpDirective}}

{{/if}}
{{#if customInstructions}}
## Custom Instructions
{{customInstructions}}

{{/if}}
{{#if memoryBank}}
## Memory Bank Integration
This session uses a memory bank for persistent context. Memory files are located at:
- Active Context: \`.memory/active-context.json\`
- Progress: \`.memory/progress.json\`
- Product Context: \`.memory/product-context.json\`
- Decision Log: \`.memory/decision-log.json\`

Always update the memory bank when:
- Starting a new task (update active context)
- Completing a task (update progress)
- Making significant decisions (update decision log)
- Learning new domain knowledge (update product context)

{{/if}}
## Available MCP Tools
{{mcpTools}}
`;

// ============================================================================
// ConfigGenerator Class
// ============================================================================

/**
 * Configuration file generator for Claude Code sessions.
 *
 * @description
 * The ConfigGenerator class provides methods to generate all configuration
 * files needed for a Claude Code session within a specific discipline context.
 * It handles CLAUDE.md, claude_config.json, and settings.json generation.
 *
 * @example
 * ```typescript
 * const generator = new ConfigGenerator();
 *
 * // Generate individual files
 * const claudeMd = generator.generateClaudeMd({
 *   discipline: myDiscipline,
 *   vpCharter: vpCharter,
 * });
 *
 * const claudeConfig = generator.generateClaudeConfig(myDiscipline.mcpServers);
 * const settings = generator.generateSettingsJson(myDiscipline.hooks);
 *
 * // Or generate all at once
 * const allConfigs = generator.generateAll({
 *   discipline: myDiscipline,
 *   vpCharter: vpCharter,
 *   memoryBankEnabled: true,
 * });
 * ```
 */
export class ConfigGenerator {
  /**
   * Default templates for configuration file generation.
   * @private
   */
  private defaultTemplates: Record<string, string>;

  /**
   * Creates a new ConfigGenerator instance.
   *
   * @param customTemplates - Optional custom templates to override defaults.
   */
  constructor(customTemplates?: Record<string, string>) {
    this.defaultTemplates = {
      claudeMd: DEFAULT_CLAUDE_MD_TEMPLATE,
      ...customTemplates,
    };
  }

  /**
   * Generates CLAUDE.md content from the provided context.
   *
   * @description
   * Creates a CLAUDE.md file content string by combining discipline configuration,
   * Orchestrator charter directives, custom instructions, and memory bank settings.
   *
   * @param context - The context containing discipline and optional VP/custom settings.
   * @returns The generated CLAUDE.md content as a string.
   *
   * @example
   * ```typescript
   * const generator = new ConfigGenerator();
   * const claudeMd = generator.generateClaudeMd({
   *   discipline: engineeringDiscipline,
   *   vpCharter: engineeringVP,
   *   customInstructions: ['Use TypeScript strict mode'],
   *   memoryBankEnabled: true,
   * });
   * console.log(claudeMd);
   * ```
   */
  generateClaudeMd(context: GenerateClaudeMdContext): string {
    const { discipline, vpCharter, customInstructions, memoryBankEnabled } = context;
    const { claudeMd } = discipline;

    const sections: string[] = [];

    // Header
    sections.push('# Claude Code Configuration');
    sections.push('');

    // Role Section
    sections.push('## Role');
    sections.push(claudeMd.role);
    sections.push('');

    // Context Section
    sections.push('## Context');
    sections.push(claudeMd.context);
    sections.push('');

    // Objectives Section
    sections.push('## Objectives');
    sections.push(this.formatList(claudeMd.objectives));
    sections.push('');

    // Rules Section
    sections.push('## Rules');
    sections.push(this.formatList(claudeMd.rules));
    sections.push('');

    // Constraints Section
    sections.push('## Constraints');
    sections.push(this.formatList(claudeMd.constraints));
    sections.push('');

    // Orchestrator Directive Section (if Orchestrator charter provided)
    if (vpCharter) {
      sections.push('## Orchestrator Directive');
      sections.push(vpCharter.coreDirective);
      sections.push('');

      // Orchestrator Constraints
      if (vpCharter.constraints) {
        sections.push('### Orchestrator-Level Constraints');
        sections.push('');
        sections.push('**Forbidden Commands:**');
        sections.push(this.formatList(vpCharter.constraints.forbiddenCommands));
        sections.push('');
        sections.push('**Forbidden Paths:**');
        sections.push(this.formatList(vpCharter.constraints.forbiddenPaths));
        sections.push('');
        sections.push('**Actions Requiring Approval:**');
        sections.push(this.formatList(vpCharter.constraints.requireApprovalFor));
        sections.push('');
      }
    }

    // Custom Instructions Section
    if (customInstructions && customInstructions.length > 0) {
      sections.push('## Custom Instructions');
      sections.push(this.formatList(customInstructions));
      sections.push('');
    }

    // Memory Bank Section
    if (memoryBankEnabled) {
      sections.push('## Memory Bank Integration');
      sections.push('');
      sections.push('This session uses a memory bank for persistent context. Memory files are located at:');
      sections.push('- **Active Context**: `.memory/active-context.json`');
      sections.push('- **Progress**: `.memory/progress.json`');
      sections.push('- **Product Context**: `.memory/product-context.json`');
      sections.push('- **Decision Log**: `.memory/decision-log.json`');
      sections.push('');
      sections.push('Always update the memory bank when:');
      sections.push('- Starting a new task (update active context)');
      sections.push('- Completing a task (update progress)');
      sections.push('- Making significant decisions (update decision log)');
      sections.push('- Learning new domain knowledge (update product context)');
      sections.push('');
    }

    // MCP Tools Section
    if (discipline.mcpServers.length > 0) {
      sections.push('## Available MCP Tools');
      sections.push('');
      for (const server of discipline.mcpServers) {
        sections.push(`### ${server.name}`);
        sections.push(server.description);
        sections.push('');
      }
    }

    // Discipline Metadata Footer
    sections.push('---');
    sections.push('');
    sections.push(`*Discipline: ${discipline.name} (${discipline.category})*`);
    sections.push(`*Generated: ${new Date().toISOString()}*`);

    return sections.join('\n');
  }

  /**
   * Generates claude_config.json from MCP server configurations.
   *
   * @description
   * Creates a ClaudeConfigJson object containing MCP server definitions
   * suitable for writing to claude_config.json.
   *
   * @param servers - Array of MCP server configurations from the discipline.
   * @returns The generated claude_config.json structure.
   *
   * @example
   * ```typescript
   * const generator = new ConfigGenerator();
   * const config = generator.generateClaudeConfig([
   *   {
   *     name: 'github',
   *     command: 'npx',
   *     args: ['@modelcontextprotocol/server-github'],
   *     description: 'GitHub integration',
   *   },
   * ]);
   * // Result: { mcpServers: { github: { command: 'npx', args: [...] } } }
   * ```
   */
  generateClaudeConfig(servers: MCPServerConfig[]): ClaudeConfigJson {
    const mcpServers: Record<string, MCPServerDefinition> = {};

    for (const server of servers) {
      const definition: MCPServerDefinition = {
        command: server.command,
      };

      if (server.args && server.args.length > 0) {
        definition.args = server.args;
      }

      if (server.env && Object.keys(server.env).length > 0) {
        definition.env = server.env;
      }

      mcpServers[server.name] = definition;
    }

    return { mcpServers };
  }

  /**
   * Generates settings.json from hook configurations.
   *
   * @description
   * Creates a SettingsJson object containing hook definitions organized
   * by event type, suitable for writing to settings.json.
   *
   * @param hooks - Array of hook configurations from the discipline.
   * @returns The generated settings.json structure.
   *
   * @example
   * ```typescript
   * const generator = new ConfigGenerator();
   * const settings = generator.generateSettingsJson([
   *   {
   *     event: 'PreCommit',
   *     command: 'npm run lint',
   *     description: 'Run linting before commit',
   *     blocking: true,
   *   },
   * ]);
   * // Result: { hooks: { preCommit: [{ command: 'npm run lint' }] } }
   * ```
   */
  generateSettingsJson(hooks: HookConfig[]): SettingsJson {
    if (hooks.length === 0) {
      return {};
    }

    const settings: SettingsJson = {
      hooks: {},
    };

    const hooksByEvent: Record<string, HookDefinition[]> = {
      preToolUse: [],
      postToolUse: [],
      preCommit: [],
      postCommit: [],
    };

    for (const hook of hooks) {
      const definition: HookDefinition = {
        command: hook.command,
      };

      // Add blocking condition if hook is blocking
      if (hook.blocking) {
        definition.conditions = { ...definition.conditions, blocking: true };
      }

      // Map event types to settings keys
      const eventKey = this.mapEventToKey(hook.event);
      if (eventKey && hooksByEvent[eventKey]) {
        hooksByEvent[eventKey].push(definition);
      }
    }

    // Only include non-empty hook arrays
    if (hooksByEvent.preToolUse.length > 0) {
      settings.hooks!.preToolUse = hooksByEvent.preToolUse;
    }
    if (hooksByEvent.postToolUse.length > 0) {
      settings.hooks!.postToolUse = hooksByEvent.postToolUse;
    }
    if (hooksByEvent.preCommit.length > 0) {
      settings.hooks!.preCommit = hooksByEvent.preCommit;
    }
    if (hooksByEvent.postCommit.length > 0) {
      settings.hooks!.postCommit = hooksByEvent.postCommit;
    }

    // Remove empty hooks object
    if (settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    return settings;
  }

  /**
   * Generates all configuration files from the provided context.
   *
   * @description
   * Convenience method that generates CLAUDE.md, claude_config.json,
   * and settings.json in a single call.
   *
   * @param context - The comprehensive context for generating all configs.
   * @returns Object containing all generated configuration files.
   *
   * @example
   * ```typescript
   * const generator = new ConfigGenerator();
   * const configs = generator.generateAll({
   *   discipline: engineeringDiscipline,
   *   vpCharter: engineeringVP,
   *   memoryBankEnabled: true,
   *   additionalServers: [customServer],
   *   additionalHooks: [customHook],
   * });
   *
   * console.log(configs.claudeMd);
   * console.log(JSON.stringify(configs.claudeConfig, null, 2));
   * console.log(JSON.stringify(configs.settings, null, 2));
   * ```
   */
  generateAll(context: GenerateAllContext): GeneratedConfigs {
    const {
      discipline,
      vpCharter,
      customInstructions,
      memoryBankEnabled,
      additionalServers = [],
      additionalHooks = [],
    } = context;

    // Combine discipline servers with additional servers
    const allServers = [...discipline.mcpServers, ...additionalServers];

    // Combine discipline hooks with additional hooks
    const allHooks = [...discipline.hooks, ...additionalHooks];

    // Generate CLAUDE.md
    const claudeMd = this.generateClaudeMd({
      discipline: {
        ...discipline,
        mcpServers: allServers, // Use combined servers for documentation
      },
      vpCharter,
      customInstructions,
      memoryBankEnabled,
    });

    // Generate claude_config.json
    const claudeConfig = this.generateClaudeConfig(allServers);

    // Generate settings.json
    const settings = this.generateSettingsJson(allHooks);

    return {
      claudeMd,
      claudeConfig,
      settings,
    };
  }

  /**
   * Formats an array of strings as a markdown list.
   *
   * @param items - Array of strings to format.
   * @returns Formatted markdown list string.
   * @private
   */
  private formatList(items: string[]): string {
    if (items.length === 0) {
      return '*None specified*';
    }
    return items.map((item) => `- ${item}`).join('\n');
  }

  /**
   * Maps hook event types to settings.json keys.
   *
   * @param event - The hook event type.
   * @returns The corresponding settings.json key.
   * @private
   */
  private mapEventToKey(event: HookConfig['event']): string | null {
    const eventMap: Record<HookConfig['event'], string> = {
      PreToolUse: 'preToolUse',
      PostToolUse: 'postToolUse',
      PreCommit: 'preCommit',
      PostCommit: 'postCommit',
    };
    return eventMap[event] || null;
  }

  /**
   * Gets the default template for a given config type.
   *
   * @param templateName - Name of the template to retrieve.
   * @returns The template string or undefined if not found.
   */
  getTemplate(templateName: string): string | undefined {
    return this.defaultTemplates[templateName];
  }

  /**
   * Sets a custom template for a given config type.
   *
   * @param templateName - Name of the template to set.
   * @param template - The template string.
   */
  setTemplate(templateName: string, template: string): void {
    this.defaultTemplates[templateName] = template;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a ConfigGenerator instance.
 *
 * @description
 * Creates and returns a new ConfigGenerator instance with optional
 * custom templates. Use this factory function for consistent instantiation
 * across the codebase.
 *
 * @param customTemplates - Optional custom templates to override defaults.
 * @returns A new ConfigGenerator instance.
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const generator = createConfigGenerator();
 *
 * // Create with custom templates
 * const customGenerator = createConfigGenerator({
 *   claudeMd: '# Custom Template\n{{role}}',
 * });
 * ```
 */
export function createConfigGenerator(
  customTemplates?: Record<string, string>,
): ConfigGenerator {
  return new ConfigGenerator(customTemplates);
}
