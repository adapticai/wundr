/**
 * CLAUDE.md Generator
 *
 * Generates per-session CLAUDE.md configuration files from charter data,
 * discipline packs, and agent definitions. The generated file serves as
 * the primary instruction set for a Claude Code session operating within
 * a specific discipline and Orchestrator hierarchy.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler/claude-md-generator
 */

import type {
  OrchestratorCharter,
  SessionManagerCharter,
  DisciplinePack,
  AgentDefinition,
  MCPServerConfig,
  MemoryBank,
} from '../types/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Task context provided at session compilation time.
 *
 * Contains the immediate task description and any warm-start context
 * carried over from a previous session.
 */
export interface TaskContext {
  /**
   * Human-readable description of the task to be performed.
   */
  description: string;

  /**
   * Optional context from a previous session for warm-starting.
   */
  warmStartContext?: string;

  /**
   * Optional priority level for the task.
   */
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Configuration for CLAUDE.md generation.
 *
 * Provides all the data needed to produce a complete per-session CLAUDE.md
 * file including identity, directives, constraints, agent definitions,
 * memory bank paths, resource limits, and communication protocols.
 *
 * @example
 * ```typescript
 * const config: ClaudeMdGenerationConfig = {
 *   orchestratorCharter: engineeringVP,
 *   sessionManagerCharter: frontendSM,
 *   disciplinePack: frontendDiscipline,
 *   agents: [coderAgent, reviewerAgent],
 *   taskContext: {
 *     description: 'Implement OAuth2 authentication flow',
 *     priority: 'high',
 *   },
 *   memoryBank: {
 *     activeContextPath: '.memory/session-123/active-context.json',
 *     progressPath: '.memory/session-123/progress.json',
 *     productContextPath: '.memory/session-123/product-context.json',
 *     decisionLogPath: '.memory/session-123/decision-log.json',
 *   },
 * };
 * ```
 */
export interface ClaudeMdGenerationConfig {
  /**
   * The Tier 1 Orchestrator charter that owns this session.
   * Provides the core directive, hard constraints, resource limits,
   * and approval requirements for the session.
   */
  orchestratorCharter: OrchestratorCharter;

  /**
   * Optional Tier 2 Session Manager charter coordinating this session.
   * When provided, Session Manager directives and memory bank paths
   * are included in the generated file.
   */
  sessionManagerCharter?: SessionManagerCharter;

  /**
   * The discipline pack defining the session's operational domain.
   * Provides role, context, rules, objectives, constraints, and MCP tools.
   */
  disciplinePack: DisciplinePack;

  /**
   * List of agent definitions available to the session.
   * Each agent will be documented in the Available Agents section.
   */
  agents: AgentDefinition[];

  /**
   * The task context for this specific session.
   */
  taskContext: TaskContext;

  /**
   * Optional memory bank configuration for persistent state.
   * When provided, a Memory Bank section is included with path information.
   */
  memoryBank?: MemoryBank;

  /**
   * Optional additional MCP servers beyond the discipline defaults.
   */
  additionalMcpServers?: MCPServerConfig[];

  /**
   * Optional custom instructions to append at the end of the file.
   */
  customInstructions?: string[];
}

// ============================================================================
// Generator Function
// ============================================================================

/**
 * Generates a complete CLAUDE.md configuration file for a session.
 *
 * Produces a structured markdown file that serves as the primary instruction
 * set for a Claude Code session. The generated content includes:
 *
 * - **Session Identity**: Who this session is and what discipline it operates under
 * - **Core Directive**: The Orchestrator's primary directive for this session
 * - **Current Task**: The specific task and any warm-start context
 * - **Rules and Objectives**: Discipline-specific operational rules
 * - **Hard Constraints**: Forbidden commands, paths, and actions
 * - **Approval Requirements**: Actions that require human approval
 * - **Available Agents**: Sub-agents accessible during this session
 * - **MCP Tools**: Available Model Context Protocol servers
 * - **Memory Bank**: Persistent state file paths and usage guidelines
 * - **Resource Limits**: Computational boundaries for the session
 * - **Communication Protocol**: How to report status and escalate issues
 *
 * @param config - The generation configuration containing all session data
 * @returns The complete CLAUDE.md content as a string
 *
 * @example
 * ```typescript
 * const claudeMd = generateClaudeMd({
 *   orchestratorCharter: engineeringVP,
 *   disciplinePack: backendDiscipline,
 *   agents: [coderAgent, testerAgent],
 *   taskContext: {
 *     description: 'Add pagination to the users API endpoint',
 *     priority: 'medium',
 *   },
 * });
 *
 * // Write to the worktree
 * await fs.writeFile('/path/to/worktree/CLAUDE.md', claudeMd, 'utf8');
 * ```
 */
export function generateClaudeMd(config: ClaudeMdGenerationConfig): string {
  const {
    orchestratorCharter,
    sessionManagerCharter,
    disciplinePack,
    agents,
    taskContext,
    memoryBank,
    additionalMcpServers = [],
    customInstructions = [],
  } = config;

  const sections: string[] = [];
  const generatedAt = new Date().toISOString();

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------
  sections.push('# Claude Code Configuration');
  sections.push('');
  sections.push(
    `> Auto-generated session configuration for **${disciplinePack.name}** discipline`
  );
  sections.push(`> Generated: ${generatedAt}`);
  sections.push('');

  // -------------------------------------------------------------------------
  // Session Identity
  // -------------------------------------------------------------------------
  sections.push('## Session Identity');
  sections.push('');
  sections.push(`**Orchestrator**: ${orchestratorCharter.identity.name}`);
  sections.push(
    `**Discipline**: ${disciplinePack.name} (${disciplinePack.category})`
  );
  if (sessionManagerCharter) {
    sections.push(
      `**Session Manager**: ${sessionManagerCharter.identity.name}`
    );
    sections.push(
      `**Discipline Domain**: ${sessionManagerCharter.disciplineId}`
    );
  }
  sections.push(`**Role**: ${disciplinePack.claudeMd.role}`);
  sections.push('');
  sections.push(disciplinePack.claudeMd.context);
  sections.push('');

  // -------------------------------------------------------------------------
  // Core Directive
  // -------------------------------------------------------------------------
  sections.push('## Core Directive');
  sections.push('');
  sections.push(orchestratorCharter.coreDirective);
  sections.push('');

  // Include Session Manager directive when available
  if (sessionManagerCharter) {
    sections.push('### Session Manager Directive');
    sections.push('');
    sections.push(sessionManagerCharter.coreDirective);
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Current Task
  // -------------------------------------------------------------------------
  sections.push('## Current Task');
  sections.push('');
  if (taskContext.priority) {
    sections.push(`**Priority**: ${taskContext.priority.toUpperCase()}`);
    sections.push('');
  }
  sections.push(taskContext.description);
  sections.push('');

  if (taskContext.warmStartContext) {
    sections.push('### Previous Session Context');
    sections.push('');
    sections.push(taskContext.warmStartContext);
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Rules
  // -------------------------------------------------------------------------
  if (disciplinePack.claudeMd.rules.length > 0) {
    sections.push('## Rules');
    sections.push('');
    for (const rule of disciplinePack.claudeMd.rules) {
      sections.push(`- ${rule}`);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Objectives
  // -------------------------------------------------------------------------
  if (disciplinePack.claudeMd.objectives.length > 0) {
    sections.push('## Objectives');
    sections.push('');
    for (const objective of disciplinePack.claudeMd.objectives) {
      sections.push(`- ${objective}`);
    }
    sections.push('');
  }

  // Performance objectives from the Orchestrator charter
  const { objectives } = orchestratorCharter;
  sections.push('### Measurable Objectives');
  sections.push('');
  sections.push(
    `- **Response Time Target**: ${objectives.responseTimeTarget} seconds`
  );
  sections.push(
    `- **Task Completion Rate**: ${objectives.taskCompletionRate}%`
  );
  sections.push(`- **Quality Score Target**: ${objectives.qualityScore}/100`);
  if (
    objectives.customMetrics &&
    Object.keys(objectives.customMetrics).length > 0
  ) {
    for (const [metric, value] of Object.entries(objectives.customMetrics)) {
      const formattedMetric = metric
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      sections.push(`- **${formattedMetric}**: ${value}`);
    }
  }
  sections.push('');

  // -------------------------------------------------------------------------
  // Hard Constraints
  // -------------------------------------------------------------------------
  const { constraints } = orchestratorCharter;

  sections.push('## Hard Constraints');
  sections.push('');
  sections.push(
    'These constraints are non-negotiable. Violations will terminate the session.'
  );
  sections.push('');

  if (constraints.forbiddenCommands.length > 0) {
    sections.push('### Forbidden Commands');
    sections.push('');
    sections.push('Never execute these commands under any circumstances:');
    sections.push('');
    for (const cmd of constraints.forbiddenCommands) {
      sections.push(`- \`${cmd}\``);
    }
    sections.push('');
  }

  if (constraints.forbiddenPaths.length > 0) {
    sections.push('### Forbidden Paths');
    sections.push('');
    sections.push('Never read, write, or access these file paths:');
    sections.push('');
    for (const path of constraints.forbiddenPaths) {
      sections.push(`- \`${path}\``);
    }
    sections.push('');
  }

  if (constraints.forbiddenActions.length > 0) {
    sections.push('### Forbidden Actions');
    sections.push('');
    sections.push('These high-level actions are strictly prohibited:');
    sections.push('');
    for (const action of constraints.forbiddenActions) {
      sections.push(`- ${action}`);
    }
    sections.push('');
  }

  // Also include discipline-level constraints
  if (disciplinePack.claudeMd.constraints.length > 0) {
    sections.push('### Discipline Constraints');
    sections.push('');
    for (const constraint of disciplinePack.claudeMd.constraints) {
      sections.push(`- ${constraint}`);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Approval Requirements
  // -------------------------------------------------------------------------
  if (constraints.requireApprovalFor.length > 0) {
    sections.push('## Approval Requirements');
    sections.push('');
    sections.push(
      'The following actions require explicit human approval before execution. ' +
        'Stop and request approval; do not proceed without confirmation.'
    );
    sections.push('');
    for (const action of constraints.requireApprovalFor) {
      sections.push(`- ${action}`);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Available Agents
  // -------------------------------------------------------------------------
  if (agents.length > 0) {
    sections.push('## Available Agents');
    sections.push('');
    sections.push(
      'The following sub-agents are available for delegation. ' +
        'Invoke them using `@agent-name` syntax in Claude Code.'
    );
    sections.push('');

    for (const agent of agents) {
      sections.push(`### ${agent.name} (\`${agent.slug}\`)`);
      sections.push('');
      sections.push(
        `**Model**: ${agent.model} | **Scope**: ${agent.scope} | **Tier**: ${agent.tier}`
      );
      sections.push('');
      sections.push(agent.description);
      sections.push('');

      // Capabilities summary
      const caps: string[] = [];
      if (agent.capabilities.canReadFiles) caps.push('Read Files');
      if (agent.capabilities.canWriteFiles) caps.push('Write Files');
      if (agent.capabilities.canExecuteCommands) caps.push('Execute Commands');
      if (agent.capabilities.canAccessNetwork) caps.push('Network Access');
      if (agent.capabilities.canSpawnSubAgents) caps.push('Spawn Sub-Agents');
      if (
        agent.capabilities.customCapabilities &&
        agent.capabilities.customCapabilities.length > 0
      ) {
        caps.push(
          ...agent.capabilities.customCapabilities.map(c =>
            c.replace(/-/g, ' ')
          )
        );
      }

      if (caps.length > 0) {
        sections.push(`**Capabilities**: ${caps.join(', ')}`);
        sections.push('');
      }

      if (agent.tags.length > 0) {
        sections.push(`**Tags**: ${agent.tags.join(', ')}`);
        sections.push('');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Available MCP Tools
  // -------------------------------------------------------------------------
  const allMcpServers = [...disciplinePack.mcpServers, ...additionalMcpServers];

  if (allMcpServers.length > 0) {
    sections.push('## Available MCP Tools');
    sections.push('');

    for (const server of allMcpServers) {
      sections.push(`### ${server.name}`);
      sections.push('');
      sections.push(server.description);

      if (server.args && server.args.length > 0) {
        sections.push('');
        sections.push(
          `**Command**: \`${server.command} ${server.args.join(' ')}\``
        );
      }

      if (server.env && Object.keys(server.env).length > 0) {
        sections.push('');
        sections.push('**Environment Variables**:');
        for (const [key] of Object.entries(server.env)) {
          sections.push(`- \`${key}\``);
        }
      }

      sections.push('');
    }
  }

  // Orchestrator-level MCP tools
  if (orchestratorCharter.mcpTools.length > 0) {
    sections.push('### Orchestrator MCP Tools');
    sections.push('');
    sections.push(
      'Additional tools authorized by the Orchestrator for coordination:'
    );
    sections.push('');
    for (const tool of orchestratorCharter.mcpTools) {
      sections.push(`- \`${tool}\``);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Memory Bank
  // -------------------------------------------------------------------------
  if (memoryBank) {
    sections.push('## Memory Bank');
    sections.push('');
    sections.push(
      'This session uses a persistent memory bank. ' +
        'Always read and update these files to maintain continuity.'
    );
    sections.push('');
    sections.push(`- **Active Context**: \`${memoryBank.activeContextPath}\``);
    sections.push(`- **Progress**: \`${memoryBank.progressPath}\``);
    sections.push(
      `- **Product Context**: \`${memoryBank.productContextPath}\``
    );
    sections.push(`- **Decision Log**: \`${memoryBank.decisionLogPath}\``);
    sections.push('');
    sections.push('**Memory Bank Update Protocol**:');
    sections.push(
      '- On task start: Read active context, update with current goal'
    );
    sections.push('- On task completion: Update progress with results');
    sections.push('- On key decision: Append to decision log with rationale');
    sections.push(
      '- On domain discovery: Update product context with new knowledge'
    );
    sections.push('');
  }

  // Session Manager memory bank path
  if (sessionManagerCharter?.memoryBankPath) {
    sections.push('### Session Manager Memory Bank');
    sections.push('');
    sections.push(
      `**Memory Bank Path**: \`${sessionManagerCharter.memoryBankPath}\``
    );
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Resource Limits
  // -------------------------------------------------------------------------
  const { resourceLimits } = orchestratorCharter;

  sections.push('## Resource Limits');
  sections.push('');
  sections.push('Operate within these computational boundaries:');
  sections.push('');
  sections.push(
    `- **Max Concurrent Sessions**: ${resourceLimits.maxConcurrentSessions}`
  );
  sections.push(
    `- **Token Budget Per Hour**: ${resourceLimits.tokenBudgetPerHour.toLocaleString()}`
  );
  sections.push(`- **Max Memory**: ${resourceLimits.maxMemoryMB} MB`);
  sections.push(`- **Max CPU Usage**: ${resourceLimits.maxCpuPercent}%`);
  sections.push('');

  // -------------------------------------------------------------------------
  // Communication Protocol
  // -------------------------------------------------------------------------
  sections.push('## Communication Protocol');
  sections.push('');
  sections.push(
    'Follow these protocols for reporting status and escalating issues:'
  );
  sections.push('');
  sections.push('### Status Reporting');
  sections.push('');
  sections.push('Use consistent status terminology:');
  sections.push('- **In Progress**: Task is actively being worked on');
  sections.push('- **Blocked**: Task cannot proceed without external input');
  sections.push('- **Complete**: Task has been finished and verified');
  sections.push('- **Failed**: Task encountered an unrecoverable error');
  sections.push('');
  sections.push('### Escalation Protocol');
  sections.push('');
  sections.push('Escalate to the Orchestrator when:');
  sections.push('- A forbidden action or command is required to proceed');
  sections.push('- An action on the approval-required list is needed');
  sections.push('- Resource limits are being approached');
  sections.push('- A blocker cannot be resolved within the session');
  sections.push('- The task scope expands beyond the original description');
  sections.push('');

  if (orchestratorCharter.identity.slackHandle) {
    sections.push(
      `**Orchestrator Slack Handle**: @${orchestratorCharter.identity.slackHandle}`
    );
    sections.push('');
  }

  if (sessionManagerCharter?.identity.slackHandle) {
    sections.push(
      `**Session Manager Slack Handle**: @${sessionManagerCharter.identity.slackHandle}`
    );
    sections.push('');
  }

  sections.push('### Output Format');
  sections.push('');
  sections.push('When reporting task completion, include:');
  sections.push('1. Summary of what was accomplished');
  sections.push('2. List of files created or modified');
  sections.push('3. Tests written and their results');
  sections.push('4. Any open issues or follow-up tasks');
  sections.push('5. Token usage estimate for this session');
  sections.push('');

  // -------------------------------------------------------------------------
  // Custom Instructions
  // -------------------------------------------------------------------------
  if (customInstructions.length > 0) {
    sections.push('## Custom Instructions');
    sections.push('');
    for (const instruction of customInstructions) {
      sections.push(`- ${instruction}`);
    }
    sections.push('');
  }

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------
  sections.push('---');
  sections.push('');
  sections.push(
    `*Orchestrator: ${orchestratorCharter.identity.name} | ` +
      `Discipline: ${disciplinePack.name} | ` +
      `Generated: ${generatedAt}*`
  );

  return sections.join('\n');
}
