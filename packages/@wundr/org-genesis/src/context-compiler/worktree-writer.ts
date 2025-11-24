/**
 * Worktree Writer
 *
 * Writes compiled configurations to Git worktrees, managing file permissions
 * and ensuring atomic updates with rollback support. This module is responsible
 * for materializing the compiled discipline context into the filesystem.
 *
 * @module @wundr/org-genesis/context-compiler/worktree-writer
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { createWorktreeWriter, WorktreeWriter } from '@wundr/org-genesis/context-compiler';
 *
 * const writer = createWorktreeWriter({ basePath: '/tmp/sessions' });
 *
 * const result = await writer.writeSession({
 *   repoPath: '/path/to/repo',
 *   sessionId: 'session-123',
 *   discipline: engineeringDiscipline,
 *   agents: [codeReviewerAgent],
 *   vpCharter: vpEngineering,
 *   memoryBank: {
 *     productContext: '# Product Context\n...',
 *     activeContext: '# Active Context\n...',
 *   },
 * });
 *
 * console.log(`Worktree created at: ${result.worktreePath}`);
 * console.log(`Files written: ${result.filesWritten.join(', ')}`);
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createWorktree,
  initializeContextDirectory,
} from '../utils/git-worktree.js';

import type { AgentDefinition } from '../types/agent.js';
import type { VPCharter } from '../types/charter.js';
import type { DisciplinePack } from '../types/discipline.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for writing a session to a worktree.
 *
 * @description
 * Configuration options that define what should be written to the worktree
 * when creating a new session environment.
 *
 * @example
 * ```typescript
 * const options: WriteSessionOptions = {
 *   repoPath: '/home/user/project',
 *   sessionId: 'feature-auth-2024',
 *   discipline: backendEngineeringDiscipline,
 *   agents: [apiDesignerAgent, securityReviewerAgent],
 *   vpCharter: engineeringVP,
 *   memoryBank: {
 *     productContext: '# Product Context\n\nBuilding auth system...',
 *     activeContext: '# Active Context\n\nWorking on OAuth2 integration...',
 *     progress: '## Milestones\n\n- [x] Design API schema',
 *   },
 * };
 * ```
 */
export interface WriteSessionOptions {
  /**
   * Path to the main git repository.
   * The worktree will be created as a child of this repository.
   */
  repoPath: string;

  /**
   * Unique identifier for the session.
   * Used as the worktree directory name and branch name prefix.
   *
   * @example 'session-abc123', 'feature-auth-2024'
   */
  sessionId: string;

  /**
   * The discipline pack to write configurations for.
   * Contains CLAUDE.md settings, MCP servers, hooks, etc.
   */
  discipline: DisciplinePack;

  /**
   * Optional array of agent definitions to write to the worktree.
   * Agents will be written to .claude/agents/ directory.
   */
  agents?: AgentDefinition[];

  /**
   * Optional VP charter to include in the session context.
   * Used for generating VP-specific configurations and constraints.
   */
  vpCharter?: VPCharter;

  /**
   * Optional memory bank initialization content.
   * Pre-populates the memory bank files with context.
   */
  memoryBank?: MemoryBankInit;
}

/**
 * Result of a worktree write operation.
 *
 * @description
 * Contains information about the created worktree, including its path,
 * branch name, and list of files that were written.
 *
 * @example
 * ```typescript
 * const result: WorktreeResult = {
 *   worktreePath: '/tmp/sessions/session-123',
 *   branch: 'session/session-123',
 *   filesWritten: [
 *     '/tmp/sessions/session-123/CLAUDE.md',
 *     '/tmp/sessions/session-123/.claude/settings.json',
 *     '/tmp/sessions/session-123/.context/activeContext.md',
 *   ],
 *   memoryBankPath: '/tmp/sessions/session-123/.context',
 * };
 * ```
 */
export interface WorktreeResult {
  /**
   * The absolute path to the created worktree directory.
   */
  worktreePath: string;

  /**
   * The name of the git branch for this worktree.
   * Format: 'session/{sessionId}' or '{branchPrefix}/{sessionId}'
   */
  branch: string;

  /**
   * List of absolute paths to all files written during the operation.
   * Useful for tracking and cleanup.
   */
  filesWritten: string[];

  /**
   * Path to the memory bank directory within the worktree.
   * Present only if memory bank was initialized.
   */
  memoryBankPath?: string;
}

/**
 * Initial content for memory bank files.
 *
 * @description
 * Allows pre-populating the memory bank with context from previous sessions
 * or pre-configured content. All fields are optional and will use defaults
 * if not provided.
 *
 * @example
 * ```typescript
 * const memoryBankInit: MemoryBankInit = {
 *   productContext: '# Product Context\n\nBuilding a SaaS platform for...',
 *   activeContext: '# Active Context\n\nCurrently working on...',
 *   progress: '## Milestones\n\n- [x] Phase 1: Design\n- [ ] Phase 2: Implement',
 * };
 * ```
 */
export interface MemoryBankInit {
  /**
   * Initial content for productContext.md file.
   * Contains domain knowledge, requirements, and business context.
   */
  productContext?: string;

  /**
   * Initial content for activeContext.md file.
   * Contains current working state and immediate goals.
   */
  activeContext?: string;

  /**
   * Initial content for progress.md file.
   * Contains milestone tracking and progress updates.
   */
  progress?: string;
}

/**
 * Configuration options for the WorktreeWriter.
 *
 * @description
 * Configures the behavior of the WorktreeWriter instance, including
 * default paths, branch naming conventions, and creation options.
 *
 * @example
 * ```typescript
 * const config: WorktreeWriterConfig = {
 *   basePath: '/var/wundr/sessions',
 *   createBranch: true,
 *   branchPrefix: 'agent-session',
 * };
 * ```
 */
export interface WorktreeWriterConfig {
  /**
   * Base directory where worktrees will be created.
   * If not specified, uses a temp directory.
   *
   * @default '/tmp/wundr-worktrees'
   */
  basePath?: string;

  /**
   * Whether to create a new branch for each worktree.
   * If false, must checkout an existing branch.
   *
   * @default true
   */
  createBranch?: boolean;

  /**
   * Prefix for generated branch names.
   * Branch format: '{branchPrefix}/{sessionId}'
   *
   * @default 'session'
   */
  branchPrefix?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default base path for worktrees if not specified.
 */
const DEFAULT_BASE_PATH = '/tmp/wundr-worktrees';

/**
 * Default branch prefix for session branches.
 */
const DEFAULT_BRANCH_PREFIX = 'session';

/**
 * Directory name for Claude configuration files.
 */
const CLAUDE_DIR = '.claude';

/**
 * Directory name for context/memory bank files.
 */
const CONTEXT_DIR = '.context';

/**
 * Directory name for agent definitions.
 */
const AGENTS_DIR = 'agents';

// ============================================================================
// WorktreeWriter Class
// ============================================================================

/**
 * Writes compiled configurations to Git worktrees.
 *
 * @description
 * The WorktreeWriter class is responsible for creating isolated git worktrees
 * and populating them with all necessary configuration files for a session.
 * This includes CLAUDE.md, settings, agent definitions, and memory bank files.
 *
 * The class ensures atomic writes where possible and provides cleanup methods
 * for removing worktrees when sessions complete.
 *
 * @example
 * ```typescript
 * const writer = new WorktreeWriter({ basePath: '/tmp/sessions' });
 *
 * // Write a complete session
 * const result = await writer.writeSession({
 *   repoPath: '/home/user/repo',
 *   sessionId: 'feature-auth',
 *   discipline: engineeringDiscipline,
 *   agents: [reviewerAgent],
 * });
 *
 * // Later, clean up the worktree
 * await writer.cleanup(result.worktreePath);
 * ```
 */
export class WorktreeWriter {
  /**
   * Base path where worktrees are created.
   */
  private readonly basePath: string;

  /**
   * Whether to create new branches for worktrees.
   */
  private readonly createBranch: boolean;

  /**
   * Prefix for branch names.
   */
  private readonly branchPrefix: string;

  /**
   * Creates a new WorktreeWriter instance.
   *
   * @param config - Configuration options for the writer.
   *
   * @example
   * ```typescript
   * const writer = new WorktreeWriter({
   *   basePath: '/var/sessions',
   *   createBranch: true,
   *   branchPrefix: 'agent',
   * });
   * ```
   */
  constructor(config: WorktreeWriterConfig = {}) {
    this.basePath = config.basePath ?? DEFAULT_BASE_PATH;
    this.createBranch = config.createBranch ?? true;
    this.branchPrefix = config.branchPrefix ?? DEFAULT_BRANCH_PREFIX;
  }

  /**
   * Writes a complete session to a new git worktree.
   *
   * @description
   * Creates a new git worktree, initializes the directory structure, and writes
   * all configuration files including CLAUDE.md, settings, agent definitions,
   * and memory bank files.
   *
   * @param options - Session write options including discipline and agents.
   * @returns A promise that resolves to the worktree result.
   * @throws {Error} If worktree creation fails or file writes fail.
   *
   * @example
   * ```typescript
   * const result = await writer.writeSession({
   *   repoPath: '/home/user/repo',
   *   sessionId: 'session-123',
   *   discipline: frontendDiscipline,
   *   agents: [reactDevAgent, cssSpecialistAgent],
   *   memoryBank: {
   *     productContext: '# Building a dashboard application...',
   *   },
   * });
   *
   * console.log(`Created worktree at ${result.worktreePath}`);
   * console.log(`Branch: ${result.branch}`);
   * ```
   */
  async writeSession(options: WriteSessionOptions): Promise<WorktreeResult> {
    const {
      repoPath,
      sessionId,
      discipline,
      agents = [],
      vpCharter,
      memoryBank,
    } = options;

    const branch = `${this.branchPrefix}/${sessionId}`;
    const filesWritten: string[] = [];

    // Ensure base path exists
    await fs.mkdir(this.basePath, { recursive: true });

    // Create the git worktree
    const worktreePath = await createWorktree(repoPath, {
      basePath: this.basePath,
      sessionId,
      branch,
      createBranch: this.createBranch,
    });

    try {
      // Create directory structure
      await this.createDirectoryStructure(worktreePath);

      // Generate and write CLAUDE.md
      const claudeMdContent = this.generateClaudeMdContent(discipline, vpCharter);
      const claudeMdPath = path.join(worktreePath, 'CLAUDE.md');
      await this.writeClaudeMd(worktreePath, claudeMdContent);
      filesWritten.push(claudeMdPath);

      // Generate and write claude.config.json
      const claudeConfig = this.generateClaudeConfig(discipline, vpCharter);
      const claudeConfigPath = path.join(worktreePath, CLAUDE_DIR, 'claude.config.json');
      await this.writeClaudeConfig(worktreePath, claudeConfig);
      filesWritten.push(claudeConfigPath);

      // Generate and write settings.json
      const settingsJson = this.generateSettingsJson(discipline);
      const settingsPath = path.join(worktreePath, CLAUDE_DIR, 'settings.json');
      await this.writeSettingsJson(worktreePath, settingsJson);
      filesWritten.push(settingsPath);

      // Write agent definitions
      if (agents.length > 0) {
        const agentPaths = await this.writeAgentDefinitions(worktreePath, agents);
        filesWritten.push(...agentPaths);
      }

      // Initialize memory bank with content
      let memoryBankPath: string | undefined;
      if (memoryBank) {
        memoryBankPath = path.join(worktreePath, CONTEXT_DIR);
        const memoryPaths = await this.initializeMemoryBank(worktreePath, memoryBank);
        filesWritten.push(...memoryPaths);
      } else {
        // Initialize with defaults
        await initializeContextDirectory(worktreePath);
        memoryBankPath = path.join(worktreePath, CONTEXT_DIR);
        filesWritten.push(
          path.join(memoryBankPath, 'activeContext.md'),
          path.join(memoryBankPath, 'progress.md'),
          path.join(memoryBankPath, 'productContext.md'),
          path.join(memoryBankPath, 'decisionLog.md'),
        );
      }

      return {
        worktreePath,
        branch,
        filesWritten,
        memoryBankPath,
      };
    } catch (error) {
      // Attempt cleanup on failure
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Writes the CLAUDE.md file to the worktree.
   *
   * @param worktreePath - Path to the worktree.
   * @param content - Content to write to CLAUDE.md.
   *
   * @example
   * ```typescript
   * await writer.writeClaudeMd('/tmp/session-123', '# My Session\n...');
   * ```
   */
  async writeClaudeMd(worktreePath: string, content: string): Promise<void> {
    const claudeMdPath = path.join(worktreePath, 'CLAUDE.md');
    await fs.writeFile(claudeMdPath, content, 'utf-8');
  }

  /**
   * Writes the claude.config.json file to the worktree.
   *
   * @param worktreePath - Path to the worktree.
   * @param config - Configuration object to write.
   *
   * @example
   * ```typescript
   * await writer.writeClaudeConfig('/tmp/session-123', {
   *   mcpServers: { github: { command: 'npx', args: ['@mcp/github'] } },
   * });
   * ```
   */
  async writeClaudeConfig(worktreePath: string, config: object): Promise<void> {
    const configPath = path.join(worktreePath, CLAUDE_DIR, 'claude.config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Writes the settings.json file to the worktree.
   *
   * @param worktreePath - Path to the worktree.
   * @param settings - Settings object to write.
   *
   * @example
   * ```typescript
   * await writer.writeSettingsJson('/tmp/session-123', {
   *   editor: { tabSize: 2 },
   *   linting: { enabled: true },
   * });
   * ```
   */
  async writeSettingsJson(worktreePath: string, settings: object): Promise<void> {
    const settingsPath = path.join(worktreePath, CLAUDE_DIR, 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /**
   * Writes agent definition files to the worktree.
   *
   * @description
   * Creates markdown files for each agent in the .claude/agents/ directory.
   * Each agent gets its own file named after its slug.
   *
   * @param worktreePath - Path to the worktree.
   * @param agents - Array of agent definitions to write.
   * @returns Array of paths to the written agent files.
   *
   * @example
   * ```typescript
   * const paths = await writer.writeAgentDefinitions('/tmp/session-123', [
   *   codeReviewerAgent,
   *   securityAnalystAgent,
   * ]);
   * // paths: ['/tmp/session-123/.claude/agents/code-reviewer.md', ...]
   * ```
   */
  async writeAgentDefinitions(
    worktreePath: string,
    agents: AgentDefinition[],
  ): Promise<string[]> {
    const agentsDir = path.join(worktreePath, CLAUDE_DIR, AGENTS_DIR);
    await fs.mkdir(agentsDir, { recursive: true });

    const writtenPaths: string[] = [];

    for (const agent of agents) {
      const agentContent = this.generateAgentMarkdown(agent);
      const agentPath = path.join(agentsDir, `${agent.slug}.md`);
      await fs.writeFile(agentPath, agentContent, 'utf-8');
      writtenPaths.push(agentPath);
    }

    // Write an index file for agent discovery
    const indexContent = this.generateAgentsIndex(agents);
    const indexPath = path.join(agentsDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(indexContent, null, 2), 'utf-8');
    writtenPaths.push(indexPath);

    return writtenPaths;
  }

  /**
   * Initializes the memory bank with custom content.
   *
   * @description
   * Creates the .context directory and populates it with the provided
   * memory bank content. Falls back to defaults for any missing fields.
   *
   * @param worktreePath - Path to the worktree.
   * @param context - Initial memory bank content.
   * @returns Array of paths to the written memory bank files.
   *
   * @example
   * ```typescript
   * const paths = await writer.initializeMemoryBank('/tmp/session-123', {
   *   productContext: '# Product\n\nBuilding a trading platform...',
   *   progress: '## Milestones\n\n- [x] Design complete',
   * });
   * ```
   */
  async initializeMemoryBank(
    worktreePath: string,
    context?: MemoryBankInit,
  ): Promise<string[]> {
    const contextDir = path.join(worktreePath, CONTEXT_DIR);
    await fs.mkdir(contextDir, { recursive: true });

    const writtenPaths: string[] = [];

    // Write activeContext.md
    const activeContextContent = context?.activeContext ??
      '# Active Context\n\n_Compiled by Org Genesis_\n';
    const activeContextPath = path.join(contextDir, 'activeContext.md');
    await fs.writeFile(activeContextPath, activeContextContent, 'utf-8');
    writtenPaths.push(activeContextPath);

    // Write progress.md
    const progressContent = context?.progress ??
      '# Progress\n\n## Milestones\n\n_No milestones yet_\n';
    const progressPath = path.join(contextDir, 'progress.md');
    await fs.writeFile(progressPath, progressContent, 'utf-8');
    writtenPaths.push(progressPath);

    // Write productContext.md
    const productContextContent = context?.productContext ??
      '# Product Context\n\n_Injected during compilation_\n';
    const productContextPath = path.join(contextDir, 'productContext.md');
    await fs.writeFile(productContextPath, productContextContent, 'utf-8');
    writtenPaths.push(productContextPath);

    // Write decisionLog.md (always with default)
    const decisionLogPath = path.join(contextDir, 'decisionLog.md');
    await fs.writeFile(
      decisionLogPath,
      '# Decision Log\n\n_Decisions will be logged here_\n',
      'utf-8',
    );
    writtenPaths.push(decisionLogPath);

    return writtenPaths;
  }

  /**
   * Cleans up a worktree by removing its directory.
   *
   * @description
   * Removes the worktree directory and all its contents. Note that this
   * does not remove the git worktree entry from the repository - use
   * `removeWorktree` from git-worktree utils for complete cleanup.
   *
   * @param worktreePath - Path to the worktree to clean up.
   *
   * @example
   * ```typescript
   * await writer.cleanup('/tmp/sessions/session-123');
   * ```
   */
  async cleanup(worktreePath: string): Promise<void> {
    await fs.rm(worktreePath, { recursive: true, force: true });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Creates the directory structure for a worktree.
   */
  private async createDirectoryStructure(worktreePath: string): Promise<void> {
    await fs.mkdir(path.join(worktreePath, CLAUDE_DIR), { recursive: true });
    await fs.mkdir(path.join(worktreePath, CLAUDE_DIR, AGENTS_DIR), { recursive: true });
    await fs.mkdir(path.join(worktreePath, CONTEXT_DIR), { recursive: true });
  }

  /**
   * Generates CLAUDE.md content from discipline and VP charter.
   */
  private generateClaudeMdContent(
    discipline: DisciplinePack,
    vpCharter?: VPCharter,
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`# ${discipline.claudeMd.role}`);
    sections.push('');

    // Context section
    sections.push('## Context');
    sections.push('');
    sections.push(discipline.claudeMd.context);
    sections.push('');

    // VP-specific context if provided
    if (vpCharter) {
      sections.push(`**Reporting to:** ${vpCharter.identity.name}`);
      sections.push('');
      sections.push(`**Core Directive:** ${vpCharter.coreDirective}`);
      sections.push('');
    }

    // Objectives section
    sections.push('## Objectives');
    sections.push('');
    for (const objective of discipline.claudeMd.objectives) {
      sections.push(`- ${objective}`);
    }
    sections.push('');

    // Rules section
    sections.push('## Rules');
    sections.push('');
    for (const rule of discipline.claudeMd.rules) {
      sections.push(`- ${rule}`);
    }
    sections.push('');

    // Constraints section
    sections.push('## Constraints');
    sections.push('');
    for (const constraint of discipline.claudeMd.constraints) {
      sections.push(`- ${constraint}`);
    }
    sections.push('');

    // VP constraints if provided
    if (vpCharter) {
      sections.push('### VP-Level Constraints');
      sections.push('');
      sections.push('**Forbidden Commands:**');
      for (const cmd of vpCharter.constraints.forbiddenCommands) {
        sections.push(`- \`${cmd}\``);
      }
      sections.push('');
      sections.push('**Forbidden Paths:**');
      for (const pathItem of vpCharter.constraints.forbiddenPaths) {
        sections.push(`- \`${pathItem}\``);
      }
      sections.push('');
      sections.push('**Requires Approval:**');
      for (const action of vpCharter.constraints.requireApprovalFor) {
        sections.push(`- ${action}`);
      }
      sections.push('');
    }

    // MCP Servers section
    if (discipline.mcpServers.length > 0) {
      sections.push('## Available MCP Servers');
      sections.push('');
      for (const server of discipline.mcpServers) {
        sections.push(`### ${server.name}`);
        sections.push('');
        sections.push(server.description);
        sections.push('');
      }
    }

    // Hooks section
    if (discipline.hooks.length > 0) {
      sections.push('## Active Hooks');
      sections.push('');
      for (const hook of discipline.hooks) {
        sections.push(`- **${hook.event}**: ${hook.description}`);
      }
      sections.push('');
    }

    // Footer
    sections.push('---');
    sections.push('');
    sections.push(`_Discipline: ${discipline.name} (${discipline.category})_`);
    sections.push('_Generated by Org Genesis_');

    return sections.join('\n');
  }

  /**
   * Generates claude.config.json content.
   */
  private generateClaudeConfig(
    discipline: DisciplinePack,
    vpCharter?: VPCharter,
  ): Record<string, unknown> {
    const mcpServers: Record<string, unknown> = {};

    for (const server of discipline.mcpServers) {
      mcpServers[server.name] = {
        command: server.command,
        args: server.args ?? [],
        env: server.env ?? {},
      };
    }

    const hooks: Record<string, unknown[]> = {};

    for (const hook of discipline.hooks) {
      if (!hooks[hook.event]) {
        hooks[hook.event] = [];
      }
      hooks[hook.event].push({
        command: hook.command,
        blocking: hook.blocking ?? false,
      });
    }

    const config: Record<string, unknown> = {
      $schema: 'https://claude.ai/schema/claude.config.json',
      mcpServers,
      hooks,
      permissions: {
        allowedPaths: ['**/*'],
        deniedPaths: vpCharter?.constraints.forbiddenPaths ?? [],
        allowNetworkAccess: true,
      },
      metadata: {
        discipline: {
          id: discipline.id,
          name: discipline.name,
          category: discipline.category,
        },
        vpId: vpCharter?.id,
        generatedAt: new Date().toISOString(),
      },
    };

    return config;
  }

  /**
   * Generates settings.json content.
   */
  private generateSettingsJson(discipline: DisciplinePack): Record<string, unknown> {
    return {
      $schema: 'https://claude.ai/schema/settings.json',
      formatting: {
        tabSize: 2,
        useTabs: false,
        printWidth: 100,
      },
      linting: {
        enabled: true,
        onSave: true,
      },
      testing: {
        runOnSave: false,
        framework: 'auto',
      },
      discipline: {
        id: discipline.id,
        name: discipline.name,
        slug: discipline.slug,
      },
      memory: {
        contextPath: '.context',
        autoSave: true,
        saveInterval: 300000, // 5 minutes
      },
    };
  }

  /**
   * Generates markdown content for an agent definition.
   */
  private generateAgentMarkdown(agent: AgentDefinition): string {
    const sections: string[] = [];

    // Header with metadata
    sections.push(`# ${agent.name}`);
    sections.push('');
    sections.push('---');
    sections.push(`id: ${agent.id}`);
    sections.push(`slug: ${agent.slug}`);
    sections.push(`tier: ${agent.tier}`);
    sections.push(`scope: ${agent.scope}`);
    sections.push(`model: ${agent.model}`);
    sections.push('---');
    sections.push('');

    // Description
    sections.push('## Description');
    sections.push('');
    sections.push(agent.description);
    sections.push('');

    // Charter (the main instruction)
    sections.push('## Charter');
    sections.push('');
    sections.push(agent.charter);
    sections.push('');

    // Capabilities
    sections.push('## Capabilities');
    sections.push('');
    sections.push(`- Read Files: ${agent.capabilities.canReadFiles ? 'Yes' : 'No'}`);
    sections.push(`- Write Files: ${agent.capabilities.canWriteFiles ? 'Yes' : 'No'}`);
    sections.push(`- Execute Commands: ${agent.capabilities.canExecuteCommands ? 'Yes' : 'No'}`);
    sections.push(`- Network Access: ${agent.capabilities.canAccessNetwork ? 'Yes' : 'No'}`);
    sections.push(`- Spawn Sub-Agents: ${agent.capabilities.canSpawnSubAgents ? 'Yes' : 'No'}`);
    if (agent.capabilities.customCapabilities && agent.capabilities.customCapabilities.length > 0) {
      sections.push(`- Custom: ${agent.capabilities.customCapabilities.join(', ')}`);
    }
    sections.push('');

    // Tools
    if (agent.tools.length > 0) {
      sections.push('## Available Tools');
      sections.push('');
      for (const tool of agent.tools) {
        sections.push(`- **${tool.name}** (${tool.type})`);
      }
      sections.push('');
    }

    // Tags
    if (agent.tags.length > 0) {
      sections.push('## Tags');
      sections.push('');
      sections.push(agent.tags.map((tag) => `\`${tag}\``).join(', '));
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Generates an index of all agents for discovery.
   */
  private generateAgentsIndex(agents: AgentDefinition[]): Record<string, unknown> {
    return {
      $schema: 'https://wundr.ai/schema/agents-index.json',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      count: agents.length,
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        file: `${agent.slug}.md`,
        model: agent.model,
        scope: agent.scope,
        tags: agent.tags,
      })),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new WorktreeWriter instance with the specified configuration.
 *
 * @description
 * Factory function for creating WorktreeWriter instances. Provides a convenient
 * way to instantiate the writer with optional configuration.
 *
 * @param config - Optional configuration for the writer.
 * @returns A new WorktreeWriter instance.
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const writer = createWorktreeWriter();
 *
 * // Create with custom configuration
 * const customWriter = createWorktreeWriter({
 *   basePath: '/var/wundr/sessions',
 *   branchPrefix: 'wundr-session',
 * });
 * ```
 */
export function createWorktreeWriter(config?: WorktreeWriterConfig): WorktreeWriter {
  return new WorktreeWriter(config);
}
