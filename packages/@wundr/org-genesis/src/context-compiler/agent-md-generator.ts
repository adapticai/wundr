/**
 * Agent Markdown Generator
 *
 * Generates individual Claude Code agent definition files (.claude/agents/NAME.md)
 * from AgentDefinition objects. These files follow the Claude Code agent file format
 * with YAML frontmatter and a markdown body containing the agent's charter.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler/agent-md-generator
 */

import type { AgentDefinition, AgentTool } from '../types/index.js';

// ============================================================================
// Agent Markdown Generator
// ============================================================================

/**
 * Generates the content of a single `.claude/agents/NAME.md` file for a given
 * agent definition.
 *
 * The output follows the Claude Code agent file format:
 * - YAML frontmatter with `name`, `description`, `model`, and `tools` fields
 * - Markdown body containing the agent's full charter (system prompt)
 *
 * The generated file is intended to be written to:
 * `.claude/agents/{agent.slug}.md`
 *
 * @param agent - The agent definition to generate the file for
 * @returns The complete `.md` file content as a string
 *
 * @example
 * ```typescript
 * const agentMd = generateAgentMd(REVIEWER_AGENT);
 *
 * // Write to the appropriate path
 * await fs.writeFile(
 *   path.join(worktreePath, '.claude', 'agents', `${REVIEWER_AGENT.slug}.md`),
 *   agentMd,
 *   'utf8'
 * );
 * ```
 *
 * @example
 * Generated output for a reviewer agent:
 * ```markdown
 * ---
 * name: Reviewer
 * description: Code review and quality assessment specialist
 * model: claude-sonnet-4-5
 * tools: Read, Glob, Grep
 * ---
 *
 * You are a meticulous code reviewer...
 * ```
 */
export function generateAgentMd(agent: AgentDefinition): string {
  const sections: string[] = [];

  // -------------------------------------------------------------------------
  // YAML Frontmatter
  // -------------------------------------------------------------------------

  // Resolve the full model identifier from the ModelAssignment shorthand
  const modelId = resolveModelId(agent.model);

  // Build the tools list from the agent's tool definitions
  const toolsList = buildToolsList(agent.tools);

  sections.push('---');
  sections.push(`name: ${agent.name}`);
  sections.push(`description: ${agent.description}`);
  sections.push(`model: ${modelId}`);

  if (toolsList.length > 0) {
    sections.push(`tools: ${toolsList.join(', ')}`);
  }

  sections.push('---');
  sections.push('');

  // -------------------------------------------------------------------------
  // Agent Charter (System Prompt Body)
  // -------------------------------------------------------------------------
  sections.push(agent.charter);
  sections.push('');

  // -------------------------------------------------------------------------
  // Capabilities Section
  // -------------------------------------------------------------------------
  const capabilityLines = buildCapabilityLines(agent);
  if (capabilityLines.length > 0) {
    sections.push('## Operational Boundaries');
    sections.push('');
    for (const line of capabilityLines) {
      sections.push(line);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Metadata Footer
  // -------------------------------------------------------------------------
  sections.push('---');
  sections.push('');
  sections.push(
    `*Agent ID: ${agent.id} | Tier: ${agent.tier} | Scope: ${agent.scope} | Tags: ${agent.tags.join(', ')}*`
  );

  return sections.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves a ModelAssignment shorthand to the full Claude model identifier.
 *
 * @param model - The model shorthand ('opus' | 'sonnet' | 'haiku')
 * @returns The full Claude model ID string
 *
 * @internal
 */
function resolveModelId(model: AgentDefinition['model']): string {
  const modelMap: Record<string, string> = {
    opus: 'claude-opus-4-5',
    sonnet: 'claude-sonnet-4-5',
    haiku: 'claude-haiku-4-5',
  };
  return modelMap[model] ?? `claude-${model}`;
}

/**
 * Builds the tools list for the frontmatter from the agent's tool definitions.
 *
 * Only builtin tools are listed in the frontmatter `tools` field, as MCP tools
 * are configured separately via claude_config.json. Tool names are normalized to
 * their Claude Code canonical forms (PascalCase for built-ins).
 *
 * @param tools - The agent's tool definitions
 * @returns Array of tool name strings for the frontmatter
 *
 * @internal
 */
function buildToolsList(tools: AgentTool[]): string[] {
  const builtinToolMap: Record<string, string> = {
    read: 'Read',
    write: 'Write',
    edit: 'Edit',
    multiedit: 'MultiEdit',
    bash: 'Bash',
    glob: 'Glob',
    grep: 'Grep',
    git: 'Bash',
    task: 'Task',
    todoread: 'TodoRead',
    todowrite: 'TodoWrite',
  };

  const toolNames = new Set<string>();

  for (const tool of tools) {
    if (tool.type === 'builtin') {
      const normalized = builtinToolMap[tool.name.toLowerCase()] ?? tool.name;
      toolNames.add(normalized);
    }
    // MCP tools are not listed in the frontmatter; they are in claude_config.json
  }

  return Array.from(toolNames);
}

/**
 * Builds capability description lines from the agent's capability configuration.
 *
 * @param agent - The agent definition
 * @returns Array of markdown list item strings describing operational permissions
 *
 * @internal
 */
function buildCapabilityLines(agent: AgentDefinition): string[] {
  const lines: string[] = [];
  const { capabilities } = agent;

  lines.push(
    `- **Read Files**: ${capabilities.canReadFiles ? 'Allowed' : 'Not Allowed'}`
  );
  lines.push(
    `- **Write Files**: ${capabilities.canWriteFiles ? 'Allowed' : 'Not Allowed'}`
  );
  lines.push(
    `- **Execute Commands**: ${capabilities.canExecuteCommands ? 'Allowed' : 'Not Allowed'}`
  );
  lines.push(
    `- **Network Access**: ${capabilities.canAccessNetwork ? 'Allowed' : 'Not Allowed'}`
  );
  lines.push(
    `- **Spawn Sub-Agents**: ${capabilities.canSpawnSubAgents ? 'Allowed' : 'Not Allowed'}`
  );

  if (
    capabilities.customCapabilities &&
    capabilities.customCapabilities.length > 0
  ) {
    const formatted = capabilities.customCapabilities
      .map(c => c.replace(/-/g, ' '))
      .join(', ');
    lines.push(`- **Custom Capabilities**: ${formatted}`);
  }

  return lines;
}
