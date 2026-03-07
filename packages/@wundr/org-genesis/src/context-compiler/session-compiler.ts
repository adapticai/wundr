/**
 * Session Compiler
 *
 * Orchestrates the full compilation of a session configuration from charter data,
 * discipline packs, and agent definitions. Produces the complete set of files
 * needed to configure a Claude Code session: CLAUDE.md, .claude/settings.json,
 * and individual agent definition files under .claude/agents/.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler/session-compiler
 */

import type {
  OrchestratorCharter,
  SessionManagerCharter,
  DisciplinePack,
  AgentDefinition,
  MCPServerConfig,
  HookConfig,
  MemoryBank,
} from '../types/index.js';

import { generateClaudeMd } from './claude-md-generator.js';
import type {
  TaskContext,
  ClaudeMdGenerationConfig,
} from './claude-md-generator.js';

import { generateAgentMd } from './agent-md-generator.js';

import { generateSettingsJson } from './settings-json-generator.js';
import type {
  ClaudeSettingsJson,
  SettingsJsonGenerationConfig,
} from './settings-json-generator.js';

// ============================================================================
// Request and Response Types
// ============================================================================

/**
 * Request to compile a complete session configuration.
 *
 * Contains all data needed to produce CLAUDE.md, settings.json, and
 * individual agent markdown files for a Claude Code session.
 *
 * Note: Named `SessionCompileRequest` to avoid collision with the
 * `CompileSessionRequest` in `types/session.ts` which has a different shape
 * oriented toward the ContextCompiler class.
 *
 * @example
 * ```typescript
 * const request: SessionCompileRequest = {
 *   orchestratorCharter: engineeringVP,
 *   sessionManagerCharter: frontendSM,
 *   disciplinePack: frontendDiscipline,
 *   agents: [coderAgent, reviewerAgent, testerAgent],
 *   taskContext: {
 *     description: 'Implement the new dashboard component with real-time updates',
 *     priority: 'high',
 *     warmStartContext: 'Previous session completed API integration layer.',
 *   },
 *   memoryBank: {
 *     activeContextPath: '.memory/sess-abc/active-context.json',
 *     progressPath: '.memory/sess-abc/progress.json',
 *     productContextPath: '.memory/sess-abc/product-context.json',
 *     decisionLogPath: '.memory/sess-abc/decision-log.json',
 *   },
 * };
 * ```
 */
export interface SessionCompileRequest {
  /**
   * The Tier 1 Orchestrator charter for this session.
   * Provides core directive, constraints, resource limits, and approval rules.
   */
  orchestratorCharter: OrchestratorCharter;

  /**
   * Optional Tier 2 Session Manager charter.
   * When present, its directive and memory bank path are included in CLAUDE.md.
   */
  sessionManagerCharter?: SessionManagerCharter;

  /**
   * The discipline pack defining the session's operational domain.
   */
  disciplinePack: DisciplinePack;

  /**
   * All agent definitions available to this session.
   * Generates one .claude/agents/NAME.md file per agent.
   */
  agents: AgentDefinition[];

  /**
   * The immediate task context for this session.
   */
  taskContext: TaskContext;

  /**
   * Optional memory bank configuration for persistent state.
   */
  memoryBank?: MemoryBank;

  /**
   * Additional MCP servers beyond the discipline pack defaults.
   */
  additionalMcpServers?: MCPServerConfig[];

  /**
   * Additional hooks beyond the discipline pack defaults.
   */
  additionalHooks?: HookConfig[];

  /**
   * Additional tools to explicitly allow beyond the computed defaults.
   */
  additionalAllowedTools?: string[];

  /**
   * Additional tools to explicitly deny beyond those derived from constraints.
   */
  additionalDeniedTools?: string[];

  /**
   * Custom instructions to append to the generated CLAUDE.md.
   */
  customInstructions?: string[];
}

/**
 * The fully compiled session configuration, ready to be written to a worktree.
 *
 * Contains:
 * - `claudeMd`: The CLAUDE.md content string
 * - `settingsJson`: The parsed settings.json object
 * - `agentFiles`: A map from file path (e.g. `.claude/agents/reviewer.md`)
 *   to the file content string
 *
 * Note: Named `SessionCompiledConfig` to avoid collision with the
 * `CompiledSessionConfig` in `types/session.ts` which has a different shape.
 *
 * @example
 * ```typescript
 * const compiled = compileSession(request);
 *
 * // Write CLAUDE.md
 * await fs.writeFile(
 *   path.join(worktreePath, 'CLAUDE.md'),
 *   compiled.claudeMd,
 *   'utf8'
 * );
 *
 * // Write settings.json
 * await fs.mkdir(path.join(worktreePath, '.claude'), { recursive: true });
 * await fs.writeFile(
 *   path.join(worktreePath, '.claude', 'settings.json'),
 *   JSON.stringify(compiled.settingsJson, null, 2),
 *   'utf8'
 * );
 *
 * // Write agent files
 * await fs.mkdir(path.join(worktreePath, '.claude', 'agents'), { recursive: true });
 * for (const [agentPath, agentContent] of compiled.agentFiles) {
 *   await fs.writeFile(
 *     path.join(worktreePath, agentPath),
 *     agentContent,
 *     'utf8'
 *   );
 * }
 * ```
 */
export interface SessionCompiledConfig {
  /**
   * The fully compiled CLAUDE.md content.
   * Write this to `CLAUDE.md` at the root of the worktree.
   */
  claudeMd: string;

  /**
   * The compiled settings.json as a parsed object.
   * Serialize to JSON and write to `.claude/settings.json`.
   */
  settingsJson: ClaudeSettingsJson;

  /**
   * Map from relative file path to file content for each agent definition.
   *
   * Keys are relative paths such as `.claude/agents/reviewer.md`.
   * Values are the complete markdown file contents.
   */
  agentFiles: Map<string, string>;
}

// ============================================================================
// Compiler Metadata
// ============================================================================

/**
 * Metadata attached to a compilation run for observability and debugging.
 */
export interface CompilationMetadata {
  /**
   * ISO 8601 timestamp of when compilation was performed.
   */
  compiledAt: string;

  /**
   * Number of agents compiled into the session.
   */
  agentCount: number;

  /**
   * Number of MCP servers included in the session.
   */
  mcpServerCount: number;

  /**
   * Number of hooks included in the session.
   */
  hookCount: number;

  /**
   * Discipline ID of the primary discipline pack.
   */
  disciplineId: string;

  /**
   * Orchestrator charter ID overseeing this session.
   */
  orchestratorId: string;
}

// ============================================================================
// Core Compiler Function
// ============================================================================

/**
 * Compiles a complete session configuration from charter data, discipline
 * packs, and agent definitions.
 *
 * This function orchestrates the three constituent generators:
 * 1. `generateClaudeMd` - Produces the CLAUDE.md instruction file
 * 2. `generateSettingsJson` - Produces the `.claude/settings.json` config
 * 3. `generateAgentMd` (per agent) - Produces each `.claude/agents/NAME.md` file
 *
 * The result is a `CompiledSessionConfig` containing all file contents,
 * ready to be written to disk by a `WorktreeWriter` or similar mechanism.
 *
 * @param request - The compile session request with all necessary data
 * @returns The fully compiled session configuration
 *
 * @example
 * ```typescript
 * const compiled = compileSession({
 *   orchestratorCharter: engineeringVP,
 *   disciplinePack: backendDiscipline,
 *   agents: [TESTER_AGENT, REVIEWER_AGENT],
 *   taskContext: {
 *     description: 'Add unit tests for the payment processing module',
 *     priority: 'high',
 *   },
 * });
 *
 * console.log(`CLAUDE.md length: ${compiled.claudeMd.length}`);
 * console.log(`Agent files: ${[...compiled.agentFiles.keys()].join(', ')}`);
 * ```
 */
export function compileSession(
  request: SessionCompileRequest
): SessionCompiledConfig {
  const {
    orchestratorCharter,
    sessionManagerCharter,
    disciplinePack,
    agents,
    taskContext,
    memoryBank,
    additionalMcpServers = [],
    additionalHooks = [],
    additionalAllowedTools = [],
    additionalDeniedTools = [],
    customInstructions = [],
  } = request;

  // -------------------------------------------------------------------------
  // Step 1: Generate CLAUDE.md
  // -------------------------------------------------------------------------

  const claudeMdConfig: ClaudeMdGenerationConfig = {
    orchestratorCharter,
    sessionManagerCharter,
    disciplinePack,
    agents,
    taskContext,
    memoryBank,
    additionalMcpServers,
    customInstructions,
  };

  const claudeMd = generateClaudeMd(claudeMdConfig);

  // -------------------------------------------------------------------------
  // Step 2: Generate settings.json
  // -------------------------------------------------------------------------

  const settingsConfig: SettingsJsonGenerationConfig = {
    orchestratorCharter,
    sessionManagerCharter,
    disciplinePack,
    additionalMcpServers,
    additionalHooks,
    additionalAllowedTools,
    additionalDeniedTools,
  };

  const settingsJson = generateSettingsJson(settingsConfig);

  // -------------------------------------------------------------------------
  // Step 3: Generate agent definition files
  // -------------------------------------------------------------------------

  const agentFiles = new Map<string, string>();

  for (const agent of agents) {
    const agentMd = generateAgentMd(agent);
    const agentFilePath = `.claude/agents/${agent.slug}.md`;
    agentFiles.set(agentFilePath, agentMd);
  }

  // -------------------------------------------------------------------------
  // Return compiled configuration
  // -------------------------------------------------------------------------

  return {
    claudeMd,
    settingsJson,
    agentFiles,
  };
}

// ============================================================================
// Metadata Helper
// ============================================================================

/**
 * Produces compilation metadata for a given request without performing
 * the full compilation. Useful for logging, monitoring, and pre-flight checks.
 *
 * @param request - The compile session request
 * @returns Metadata about the compilation
 *
 * @example
 * ```typescript
 * const meta = getCompilationMetadata(request);
 * console.log(`Compiling ${meta.agentCount} agents for ${meta.disciplineId}`);
 * ```
 */
export function getCompilationMetadata(
  request: SessionCompileRequest
): CompilationMetadata {
  const allMcpServers = [
    ...request.disciplinePack.mcpServers,
    ...(request.additionalMcpServers ?? []),
  ];
  const allHooks = [
    ...request.disciplinePack.hooks,
    ...(request.additionalHooks ?? []),
  ];

  return {
    compiledAt: new Date().toISOString(),
    agentCount: request.agents.length,
    mcpServerCount: allMcpServers.length,
    hookCount: allHooks.length,
    disciplineId: request.disciplinePack.id,
    orchestratorId: request.orchestratorCharter.id,
  };
}

// ============================================================================
// Convenience Re-exports
// ============================================================================
// Note: ClaudeMdGenerationConfig, TaskContext, ClaudeSettingsJson, and
// SettingsJsonGenerationConfig are already exported from their own modules
// and will be picked up by the context-compiler index.ts via those modules.
// We do not re-export them here to avoid name collisions.
