/**
 * Session Config Writer
 *
 * Writes CLAUDE.md, .claude/settings.json, and agent definition files to a
 * session's working directory so that the spawned Claude Code CLI process
 * picks up the correct charter, permissions, and agent definitions.
 *
 * Responsibilities:
 * - Generate CLAUDE.md from charter + discipline + agent context
 * - Write .claude/settings.json with permissions and enabled tools
 * - Write .claude/agents/*.md files from agent definitions
 * - Clean up session-specific config files on teardown
 */

import * as fs from 'fs';
import * as path from 'path';

import type { OrchestratorCharter } from '../types';
import type { AgentDefinition } from '../agents/agent-types';

// =============================================================================
// Types
// =============================================================================

export interface SessionConfigOptions {
  /** The orchestrator charter describing the overall mission */
  readonly charter?: OrchestratorCharter | null;
  /** Discipline/role description for this specific session */
  readonly discipline?: string;
  /** Agent definitions to write as .claude/agents/*.md files */
  readonly agents?: AgentDefinition[];
  /** Whether to allow dangerous permissions (--dangerously-skip-permissions) */
  readonly allowDangerousPermissions?: boolean;
  /** Additional environment variables for the session */
  readonly environment?: Record<string, string>;
  /** Custom system prompt additions */
  readonly systemPromptAddition?: string;
}

export interface ClaudeSettingsJson {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  [key: string]: unknown;
}

// =============================================================================
// Config Writer
// =============================================================================

/**
 * Writes all Claude Code configuration files to the given working directory.
 * Creates .claude/ subdirectory if it does not exist.
 *
 * Files written:
 *   <workDir>/CLAUDE.md              - session system prompt
 *   <workDir>/.claude/settings.json  - permissions and tool settings
 *   <workDir>/.claude/agents/*.md    - agent definition files
 */
export async function writeSessionConfig(
  workDir: string,
  options: SessionConfigOptions
): Promise<void> {
  const claudeDir = path.join(workDir, '.claude');
  const agentsDir = path.join(claudeDir, 'agents');

  // Ensure directories exist
  fs.mkdirSync(agentsDir, { recursive: true });

  // Write CLAUDE.md
  const claudeMdContent = generateClaudeMd(
    options.charter ?? null,
    options.discipline,
    options.agents,
    options.systemPromptAddition
  );
  fs.writeFileSync(path.join(workDir, 'CLAUDE.md'), claudeMdContent, 'utf-8');

  // Write .claude/settings.json
  const settingsContent = generateSettingsJson(
    options.allowDangerousPermissions ?? false,
    options.environment
  );
  fs.writeFileSync(
    path.join(claudeDir, 'settings.json'),
    JSON.stringify(settingsContent, null, 2) + '\n',
    'utf-8'
  );

  // Write agent definition files
  if (options.agents && options.agents.length > 0) {
    generateAgentFiles(agentsDir, options.agents);
  }
}

/**
 * Generates CLAUDE.md content from charter, discipline, and agent definitions.
 *
 * The generated file provides the session's system-level context including:
 * - Mission and responsibilities from the charter
 * - Session-specific discipline
 * - Available agents summary
 * - Hard constraints and safety heuristics
 */
export function generateClaudeMd(
  charter: OrchestratorCharter | null,
  discipline?: string,
  agents?: AgentDefinition[],
  systemPromptAddition?: string
): string {
  const sections: string[] = [];

  // Header
  sections.push('# Wundr Orchestrator Session\n');

  // Charter section
  if (charter) {
    sections.push('## Identity\n');
    sections.push(`**Name**: ${charter.identity.name}`);
    sections.push(`**Role**: ${charter.role}`);
    if (charter.identity.email) {
      sections.push(`**Email**: ${charter.identity.email}`);
    }
    sections.push('');

    sections.push('## Responsibilities\n');
    for (const responsibility of charter.responsibilities) {
      sections.push(`- ${responsibility}`);
    }
    sections.push('');

    sections.push('## Resource Limits\n');
    sections.push(`- Max Sessions: ${charter.resourceLimits.maxSessions}`);
    sections.push(
      `- Token Budget (Subscription): ${charter.resourceLimits.tokenBudget.subscription}`
    );
    sections.push(
      `- Token Budget (API): ${charter.resourceLimits.tokenBudget.api}`
    );
    sections.push(`- Max Heap: ${charter.resourceLimits.memory.maxHeapMB}MB`);
    sections.push('');

    if (charter.hardConstraints && charter.hardConstraints.length > 0) {
      sections.push('## Hard Constraints\n');
      for (const constraint of charter.hardConstraints) {
        sections.push(`- ${constraint}`);
      }
      sections.push('');
    }

    if (charter.safetyHeuristics) {
      sections.push('## Safety Heuristics\n');

      if (
        charter.safetyHeuristics.autoApprove &&
        charter.safetyHeuristics.autoApprove.length > 0
      ) {
        sections.push('### Auto-Approve');
        for (const action of charter.safetyHeuristics.autoApprove) {
          sections.push(`- ${action}`);
        }
        sections.push('');
      }

      if (
        charter.safetyHeuristics.alwaysReject &&
        charter.safetyHeuristics.alwaysReject.length > 0
      ) {
        sections.push('### Always Reject');
        for (const action of charter.safetyHeuristics.alwaysReject) {
          sections.push(`- ${action}`);
        }
        sections.push('');
      }

      if (
        charter.safetyHeuristics.escalate &&
        charter.safetyHeuristics.escalate.length > 0
      ) {
        sections.push('### Escalate');
        for (const action of charter.safetyHeuristics.escalate) {
          sections.push(`- ${action}`);
        }
        sections.push('');
      }
    }
  }

  // Discipline / role for this specific session
  if (discipline) {
    sections.push('## Session Discipline\n');
    sections.push(discipline);
    sections.push('');
  }

  // Available agents summary
  if (agents && agents.length > 0) {
    sections.push('## Available Agents\n');
    for (const agent of agents) {
      const agentLine = [
        `- **${agent.metadata.name}**`,
        agent.metadata.type ? `(${agent.metadata.type})` : '',
        agent.metadata.description ? `: ${agent.metadata.description}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      sections.push(agentLine);
    }
    sections.push('');
  }

  // Custom system prompt addition
  if (systemPromptAddition) {
    sections.push('## Additional Instructions\n');
    sections.push(systemPromptAddition);
    sections.push('');
  }

  // Standard footer
  sections.push('## General Guidelines\n');
  sections.push(
    '- Follow all hard constraints defined in this session configuration'
  );
  sections.push('- Escalate when in doubt rather than proceeding autonomously');
  sections.push('- Prefer reversible actions over irreversible ones');
  sections.push(
    '- Track work using available tools; report progress regularly'
  );
  sections.push('');

  return sections.join('\n');
}

/**
 * Generates .claude/settings.json content.
 *
 * When allowDangerousPermissions is false the settings use a conservative
 * allowlist. When true, no tool restrictions are applied (equivalent to
 * --dangerously-skip-permissions mode).
 */
export function generateSettingsJson(
  allowDangerousPermissions: boolean,
  environment?: Record<string, string>
): ClaudeSettingsJson {
  const settings: ClaudeSettingsJson = {};

  if (!allowDangerousPermissions) {
    settings.permissions = {
      allow: [
        'Read',
        'Write',
        'Edit',
        'MultiEdit',
        'Glob',
        'Grep',
        'Bash(git *)',
        'Bash(npm *)',
        'Bash(npx *)',
        'Bash(node *)',
        'Bash(ls *)',
        'Bash(cat *)',
        'Bash(echo *)',
        'Bash(mkdir *)',
        'Bash(cp *)',
        'Bash(mv *)',
        'Bash(rm *)',
        'WebSearch',
        'WebFetch',
        'TodoWrite',
        'TodoRead',
      ],
      deny: [
        'Bash(curl * | sh)',
        'Bash(wget * | sh)',
        'Bash(sudo *)',
        'Bash(su *)',
      ],
    };
  }

  if (environment && Object.keys(environment).length > 0) {
    settings.env = { ...environment };
  }

  return settings;
}

/**
 * Writes agent definition files to the given agents directory.
 * Each agent definition becomes a <agentId>.md file in the directory.
 * The file format follows the .claude/agents/ convention: YAML frontmatter
 * followed by a markdown body.
 */
export function generateAgentFiles(
  agentsDir: string,
  agents: AgentDefinition[]
): void {
  for (const agent of agents) {
    const fileName = `${agent.id}.md`;
    const filePath = path.join(agentsDir, fileName);
    const content = buildAgentFileContent(agent);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * Builds the full .md file content for a single agent definition.
 */
function buildAgentFileContent(agent: AgentDefinition): string {
  const frontmatterLines: string[] = ['---'];

  frontmatterLines.push(`name: ${agent.metadata.name}`);

  if (agent.metadata.type) {
    frontmatterLines.push(`type: ${agent.metadata.type}`);
  }
  if (agent.metadata.description) {
    frontmatterLines.push(`description: ${agent.metadata.description}`);
  }
  if (agent.metadata.tier !== undefined) {
    frontmatterLines.push(`tier: ${agent.metadata.tier}`);
  }
  if (agent.metadata.model) {
    frontmatterLines.push(`model: ${agent.metadata.model}`);
  }
  if (agent.metadata.maxTurns !== undefined) {
    frontmatterLines.push(`maxTurns: ${agent.metadata.maxTurns}`);
  }
  if (agent.metadata.permissionMode) {
    frontmatterLines.push(`permissionMode: ${agent.metadata.permissionMode}`);
  }
  if (agent.metadata.priority) {
    frontmatterLines.push(`priority: ${agent.metadata.priority}`);
  }
  if (agent.metadata.memoryScope) {
    frontmatterLines.push(`memoryScope: ${agent.metadata.memoryScope}`);
  }
  if (agent.metadata.capabilities && agent.metadata.capabilities.length > 0) {
    frontmatterLines.push('capabilities:');
    for (const cap of agent.metadata.capabilities) {
      frontmatterLines.push(`  - ${cap}`);
    }
  }
  if (agent.metadata.tools && agent.metadata.tools.length > 0) {
    frontmatterLines.push('tools:');
    for (const tool of agent.metadata.tools) {
      frontmatterLines.push(`  - ${tool}`);
    }
  }

  frontmatterLines.push('---');

  const body = agent.systemPrompt || `# ${agent.metadata.name}\n`;

  return `${frontmatterLines.join('\n')}\n\n${body}\n`;
}

/**
 * Removes session-specific configuration files from the working directory.
 * Leaves all other files intact; only cleans up what writeSessionConfig wrote.
 *
 * Files removed:
 *   <workDir>/CLAUDE.md
 *   <workDir>/.claude/settings.json
 *   <workDir>/.claude/agents/*.md  (only files written by this session)
 */
export function cleanupSessionConfig(
  workDir: string,
  agentIds?: string[]
): void {
  // Remove CLAUDE.md
  const claudeMdPath = path.join(workDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    fs.rmSync(claudeMdPath, { force: true });
  }

  // Remove settings.json
  const settingsPath = path.join(workDir, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    fs.rmSync(settingsPath, { force: true });
  }

  // Remove agent files we wrote
  const agentsDir = path.join(workDir, '.claude', 'agents');
  if (fs.existsSync(agentsDir) && agentIds && agentIds.length > 0) {
    for (const agentId of agentIds) {
      const agentFilePath = path.join(agentsDir, `${agentId}.md`);
      if (fs.existsSync(agentFilePath)) {
        fs.rmSync(agentFilePath, { force: true });
      }
    }

    // Remove agents directory only if it is now empty
    try {
      const remaining = fs.readdirSync(agentsDir);
      if (remaining.length === 0) {
        fs.rmdirSync(agentsDir);
      }
    } catch {
      // Ignore; directory may not be empty due to pre-existing files
    }
  }

  // Remove .claude directory if completely empty
  const claudeDir = path.join(workDir, '.claude');
  if (fs.existsSync(claudeDir)) {
    try {
      const remaining = fs.readdirSync(claudeDir);
      if (remaining.length === 0) {
        fs.rmdirSync(claudeDir);
      }
    } catch {
      // Ignore
    }
  }
}
