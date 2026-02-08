/**
 * Enhanced Project Options
 *
 * Extended configuration options for project initialization with support for
 * context engineering, memory architectures, orchestration frameworks, and
 * advanced Claude Code integration features.
 *
 * @module project-init/enhanced-options
 */

import type { DeveloperProfile } from '../types/index.js';

/**
 * Memory architecture types supported by the project initialization
 */
export type MemoryArchitecture = 'basic' | 'tiered' | 'memgpt';

/**
 * Orchestration framework types for agent coordination
 */
export type OrchestrationFramework =
  | 'claude-flow'
  | 'sparc'
  | 'custom'
  | 'standalone';

/**
 * Session manager archetype for three-tier architecture
 */
export type SessionManagerArchetype =
  | 'engineering'
  | 'legal'
  | 'hr'
  | 'marketing'
  | 'custom';

/**
 * Sub-agent workforce size configuration
 */
export type SubAgentWorkforceSize = 'small' | 'medium' | 'large';

/**
 * Project type supported by the initializer
 */
export type ProjectType =
  | 'node'
  | 'react'
  | 'vue'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'monorepo';

/**
 * Mapping of workforce sizes to actual agent counts
 */
export const WORKFORCE_SIZE_MAP: Record<SubAgentWorkforceSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};

/**
 * Context engineering configuration for optimizing Claude Code prompts
 */
export interface ContextEngineeringConfig {
  /**
   * Enable dynamic context compilation for CLAUDE.md
   */
  dynamicContext: boolean;

  /**
   * Include hierarchical organization in generated files
   */
  hierarchicalOrganization: boolean;

  /**
   * Maximum token budget for context (affects compression strategies)
   */
  maxContextTokens?: number;

  /**
   * Enable smart context pruning based on relevance
   */
  smartPruning: boolean;

  /**
   * Include code examples in agent definitions
   */
  includeExamples: boolean;

  /**
   * Custom system prompt additions
   */
  customSystemPrompt?: string;
}

/**
 * Memory configuration for session and agent state management
 */
export interface MemoryConfig {
  /**
   * Memory architecture type
   * - basic: Simple file-based memory
   * - tiered: Multi-level memory with working, episodic, and semantic layers
   * - memgpt: Full MemGPT-style memory management with context compression
   */
  architecture: MemoryArchitecture;

  /**
   * Enable cross-session memory persistence
   */
  persistentMemory: boolean;

  /**
   * Memory bank path (relative to .claude directory)
   */
  memoryBankPath?: string;

  /**
   * Enable shared memory across agents
   */
  sharedMemory: boolean;

  /**
   * Memory retention period in days (0 = indefinite)
   */
  retentionDays: number;

  /**
   * Enable memory compression for long sessions
   */
  enableCompression: boolean;

  /**
   * Maximum memory entries before pruning
   */
  maxEntries?: number;
}

/**
 * Orchestration configuration for agent coordination
 */
export interface OrchestrationConfig {
  /**
   * Orchestration framework to use
   */
  framework: OrchestrationFramework;

  /**
   * Enable swarm-based agent coordination
   */
  enableSwarm: boolean;

  /**
   * Swarm topology type
   */
  swarmTopology?: 'mesh' | 'hierarchical' | 'adaptive';

  /**
   * Maximum concurrent agents
   */
  maxConcurrentAgents: number;

  /**
   * Enable agent specialization based on task type
   */
  agentSpecialization: boolean;

  /**
   * Enable automatic agent spawning based on workload
   */
  autoSpawning: boolean;

  /**
   * Custom MCP tools to integrate
   */
  mcpTools?: string[];
}

/**
 * Prompt configuration for agent behavior customization
 */
export interface PromptConfig {
  /**
   * Default tone for agent responses
   */
  tone: 'professional' | 'casual' | 'technical' | 'friendly';

  /**
   * Include verification protocol in prompts
   */
  verificationProtocol: boolean;

  /**
   * Enable chain-of-thought reasoning output
   */
  chainOfThought: boolean;

  /**
   * Maximum response length guidance
   */
  maxResponseLength?: 'concise' | 'standard' | 'detailed';

  /**
   * Custom prompt prefix for all agents
   */
  customPrefix?: string;

  /**
   * Custom prompt suffix for all agents
   */
  customSuffix?: string;

  /**
   * Enable structured output format
   */
  structuredOutput: boolean;
}

/**
 * Security configuration for project initialization
 */
export interface SecurityConfig {
  /**
   * Enable secret scanning in generated hooks
   */
  secretScanning: boolean;

  /**
   * Enable dependency vulnerability checks
   */
  dependencyAudit: boolean;

  /**
   * Enable code signing for commits
   */
  codeSigningRequired: boolean;

  /**
   * Allowed domains for MCP tool access
   */
  allowedDomains?: string[];

  /**
   * Enable sandbox mode for agent execution
   */
  sandboxMode: boolean;

  /**
   * Security policy level
   */
  policyLevel: 'permissive' | 'standard' | 'strict';
}

/**
 * Agent configuration for custom agent definitions
 */
export interface AgentConfig {
  /**
   * Agent identifier
   */
  id: string;

  /**
   * Display name for the agent
   */
  name: string;

  /**
   * Agent purpose and capabilities
   */
  description: string;

  /**
   * Agent category for organization
   */
  category: 'core' | 'specialized' | 'github' | 'testing' | 'devops' | 'custom';

  /**
   * Required tools/permissions for the agent
   */
  requiredTools?: string[];

  /**
   * Custom system prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Enable MCP tool access
   */
  mcpAccess?: boolean;
}

/**
 * Skill configuration for Claude Code skills
 */
export interface SkillConfig {
  /**
   * Skill identifier
   */
  id: string;

  /**
   * Skill name
   */
  name: string;

  /**
   * Skill description
   */
  description: string;

  /**
   * Skill category
   */
  category: string;

  /**
   * File types this skill applies to
   */
  fileTypes?: string[];

  /**
   * Custom instructions for the skill
   */
  instructions: string;
}

/**
 * Command configuration for slash commands
 */
export interface CommandConfig {
  /**
   * Command name (without leading slash)
   */
  name: string;

  /**
   * Command description
   */
  description: string;

  /**
   * Command category
   */
  category: string;

  /**
   * Command arguments
   */
  arguments?: {
    name: string;
    description: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean';
  }[];

  /**
   * Command implementation (markdown content)
   */
  content: string;
}

/**
 * Enhanced project initialization options
 *
 * Extends the base ProjectInitOptions with advanced configuration
 * for context engineering, memory management, orchestration, and security.
 */
export interface EnhancedProjectOptions {
  // Base options
  projectPath: string;
  projectName: string;
  projectType: ProjectType;
  profile?: DeveloperProfile;

  // Feature flags
  includeClaudeSetup: boolean;
  includeAgents: boolean;
  includeHooks: boolean;
  includeGitWorktree: boolean;
  includeTemplates: boolean;
  customAgents?: string[];
  interactive?: boolean;
  force?: boolean;

  // Three-tier architecture options
  enableFleetArchitecture?: boolean;
  sessionManagerArchetype?: SessionManagerArchetype;
  subAgentWorkforceSize?: SubAgentWorkforceSize;
  enableIPREGovernance?: boolean;
  enableAlignmentMonitoring?: boolean;

  // Enhanced configuration sections
  /**
   * Context engineering configuration for optimized prompts
   */
  contextEngineering?: ContextEngineeringConfig;

  /**
   * Memory configuration for state management
   */
  memoryConfig?: MemoryConfig;

  /**
   * Orchestration configuration for agent coordination
   */
  orchestration?: OrchestrationConfig;

  /**
   * Prompt configuration for agent behavior
   */
  promptConfig?: PromptConfig;

  /**
   * Security configuration
   */
  security?: SecurityConfig;

  /**
   * Custom agents to generate
   */
  agents?: AgentConfig[];

  /**
   * Custom skills to generate
   */
  skills?: SkillConfig[];

  /**
   * Custom commands to generate
   */
  commands?: CommandConfig[];
}

/**
 * Default context engineering configuration
 */
export const DEFAULT_CONTEXT_ENGINEERING: ContextEngineeringConfig = {
  dynamicContext: true,
  hierarchicalOrganization: true,
  maxContextTokens: 200000,
  smartPruning: true,
  includeExamples: true,
};

/**
 * Default memory configuration by architecture type
 */
export const DEFAULT_MEMORY_CONFIGS: Record<MemoryArchitecture, MemoryConfig> =
  {
    basic: {
      architecture: 'basic',
      persistentMemory: false,
      sharedMemory: false,
      retentionDays: 7,
      enableCompression: false,
    },
    tiered: {
      architecture: 'tiered',
      persistentMemory: true,
      sharedMemory: true,
      retentionDays: 30,
      enableCompression: true,
      memoryBankPath: 'memory',
    },
    memgpt: {
      architecture: 'memgpt',
      persistentMemory: true,
      sharedMemory: true,
      retentionDays: 0, // indefinite
      enableCompression: true,
      memoryBankPath: 'memory',
      maxEntries: 10000,
    },
  };

/**
 * Default orchestration configuration by framework
 */
export const DEFAULT_ORCHESTRATION_CONFIGS: Record<
  OrchestrationFramework,
  OrchestrationConfig
> = {
  'claude-flow': {
    framework: 'claude-flow',
    enableSwarm: true,
    swarmTopology: 'adaptive',
    maxConcurrentAgents: 10,
    agentSpecialization: true,
    autoSpawning: true,
  },
  sparc: {
    framework: 'sparc',
    enableSwarm: true,
    swarmTopology: 'hierarchical',
    maxConcurrentAgents: 6,
    agentSpecialization: true,
    autoSpawning: false,
  },
  custom: {
    framework: 'custom',
    enableSwarm: false,
    maxConcurrentAgents: 3,
    agentSpecialization: false,
    autoSpawning: false,
  },
  standalone: {
    framework: 'standalone',
    enableSwarm: false,
    maxConcurrentAgents: 1,
    agentSpecialization: false,
    autoSpawning: false,
  },
};

/**
 * Default security configuration by policy level
 */
export const DEFAULT_SECURITY_CONFIGS: Record<
  SecurityConfig['policyLevel'],
  SecurityConfig
> = {
  permissive: {
    secretScanning: false,
    dependencyAudit: false,
    codeSigningRequired: false,
    sandboxMode: false,
    policyLevel: 'permissive',
  },
  standard: {
    secretScanning: true,
    dependencyAudit: true,
    codeSigningRequired: false,
    sandboxMode: true,
    policyLevel: 'standard',
  },
  strict: {
    secretScanning: true,
    dependencyAudit: true,
    codeSigningRequired: true,
    sandboxMode: true,
    policyLevel: 'strict',
  },
};

/**
 * Default prompt configuration
 */
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  tone: 'professional',
  verificationProtocol: true,
  chainOfThought: false,
  maxResponseLength: 'standard',
  structuredOutput: false,
};

/**
 * Create enhanced options with defaults applied
 *
 * @param options - Partial enhanced options
 * @returns Full enhanced options with defaults
 */
export function createEnhancedOptions(
  options: Partial<EnhancedProjectOptions> & {
    projectPath: string;
    projectName: string;
    projectType: ProjectType;
  }
): EnhancedProjectOptions {
  const memoryArchitecture = options.memoryConfig?.architecture || 'basic';
  const orchestrationFramework =
    options.orchestration?.framework || 'claude-flow';
  const securityLevel = options.security?.policyLevel || 'standard';

  return {
    // Base options
    projectPath: options.projectPath,
    projectName: options.projectName,
    projectType: options.projectType,
    profile: options.profile,

    // Feature flags with defaults
    includeClaudeSetup: options.includeClaudeSetup ?? true,
    includeAgents: options.includeAgents ?? true,
    includeHooks: options.includeHooks ?? true,
    includeGitWorktree: options.includeGitWorktree ?? false,
    includeTemplates: options.includeTemplates ?? true,
    customAgents: options.customAgents,
    interactive: options.interactive ?? false,
    force: options.force ?? false,

    // Three-tier architecture options
    enableFleetArchitecture: options.enableFleetArchitecture ?? false,
    sessionManagerArchetype: options.sessionManagerArchetype,
    subAgentWorkforceSize: options.subAgentWorkforceSize ?? 'medium',
    enableIPREGovernance: options.enableIPREGovernance ?? false,
    enableAlignmentMonitoring: options.enableAlignmentMonitoring ?? false,

    // Enhanced configuration with defaults
    contextEngineering: {
      ...DEFAULT_CONTEXT_ENGINEERING,
      ...options.contextEngineering,
    },
    memoryConfig: {
      ...DEFAULT_MEMORY_CONFIGS[memoryArchitecture],
      ...options.memoryConfig,
    },
    orchestration: {
      ...DEFAULT_ORCHESTRATION_CONFIGS[orchestrationFramework],
      ...options.orchestration,
    },
    promptConfig: {
      ...DEFAULT_PROMPT_CONFIG,
      ...options.promptConfig,
    },
    security: {
      ...DEFAULT_SECURITY_CONFIGS[securityLevel],
      ...options.security,
    },

    // Custom definitions
    agents: options.agents,
    skills: options.skills,
    commands: options.commands,
  };
}

export default EnhancedProjectOptions;

// =============================================================================
// Claude Code v2.1.37 Type Definitions
// =============================================================================

/**
 * Claude Code model alias for subagents and skills
 */
export type ClaudeModelAlias = 'sonnet' | 'opus' | 'haiku' | 'inherit';

/**
 * Claude Code permission mode for subagents
 */
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'delegate'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'plan';

/**
 * Claude Code persistent memory scope for subagents
 */
export type MemoryScope = 'user' | 'project' | 'local';

/**
 * Agent teams display mode
 */
export type TeammateMode = 'auto' | 'in-process' | 'tmux';

/**
 * MCP server configuration for inline definitions
 */
export interface McpServerConfig {
  /** Command to start the MCP server */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables for the server */
  env?: Record<string, string>;
  /** Server description */
  description?: string;
}

/**
 * Hook handler definition for Claude Code v2.1.37
 *
 * Supports three types: command (shell), prompt (LLM single-turn), agent (LLM multi-turn)
 */
export interface HookHandler {
  /** Hook type: command runs a shell script, prompt sends to LLM, agent spawns a subagent */
  type: 'command' | 'prompt' | 'agent';
  /** Shell command to execute (for type: command) */
  command?: string;
  /** Prompt text with $ARGUMENTS placeholder (for type: prompt or agent) */
  prompt?: string;
  /** Model override for prompt/agent hooks */
  model?: string;
  /** Timeout in seconds. Defaults: 600 command, 30 prompt, 60 agent */
  timeout?: number;
  /** Custom spinner message while hook runs */
  statusMessage?: string;
  /** Run in background without blocking (command hooks only) */
  async?: boolean;
  /** Run only once per session (skills/agents only) */
  once?: boolean;
}

/**
 * Hook matcher group: a regex matcher and its associated handlers
 */
export interface HookMatcherGroup {
  /** Regex matcher to filter when hooks fire. Omit or use "*" for all */
  matcher?: string;
  /** Hook handlers to run when matched */
  hooks: HookHandler[];
}

/**
 * All 14 Claude Code v2.1.37 lifecycle hook events
 */
export interface HooksConfig {
  /** Fires when a session begins or resumes */
  SessionStart?: HookMatcherGroup[];
  /** Fires when user submits a prompt, before Claude processes it */
  UserPromptSubmit?: HookMatcherGroup[];
  /** Fires before a tool call executes. Can block it */
  PreToolUse?: HookMatcherGroup[];
  /** Fires when a permission dialog appears */
  PermissionRequest?: HookMatcherGroup[];
  /** Fires after a tool call succeeds */
  PostToolUse?: HookMatcherGroup[];
  /** Fires after a tool call fails */
  PostToolUseFailure?: HookMatcherGroup[];
  /** Fires when Claude Code sends a notification */
  Notification?: HookMatcherGroup[];
  /** Fires when a subagent is spawned */
  SubagentStart?: HookMatcherGroup[];
  /** Fires when a subagent finishes */
  SubagentStop?: HookMatcherGroup[];
  /** Fires when Claude finishes responding */
  Stop?: HookMatcherGroup[];
  /** Fires when an agent team teammate is about to go idle */
  TeammateIdle?: HookMatcherGroup[];
  /** Fires when a task is being marked as completed */
  TaskCompleted?: HookMatcherGroup[];
  /** Fires before context compaction */
  PreCompact?: HookMatcherGroup[];
  /** Fires when a session terminates */
  SessionEnd?: HookMatcherGroup[];
}

/**
 * Claude Code v2.1.37 subagent configuration
 *
 * Maps directly to the YAML frontmatter fields supported by Claude Code.
 * See: https://code.claude.com/docs/en/sub-agents
 */
export interface AgentConfigV2 {
  /** Unique identifier using lowercase letters and hyphens (required) */
  name: string;
  /** When Claude should delegate to this subagent (required) */
  description: string;
  /** Organizational category for file placement (not part of Claude Code schema) */
  category?: string;
  /** Tools the subagent can use. Inherits all tools if omitted */
  tools?: string[];
  /** Tools to deny, removed from inherited or specified list */
  disallowedTools?: string[];
  /** Model to use: sonnet, opus, haiku, or inherit. Defaults to inherit */
  model?: ClaudeModelAlias;
  /** Permission mode for the subagent */
  permissionMode?: PermissionMode;
  /** Maximum number of agentic turns before the subagent stops */
  maxTurns?: number;
  /** Skills to preload into context at startup */
  skills?: string[];
  /** MCP servers: named references or inline definitions */
  mcpServers?: Record<string, McpServerConfig | string>;
  /** Lifecycle hooks scoped to this subagent */
  hooks?: HooksConfig;
  /** Persistent memory scope: user, project, or local */
  memory?: MemoryScope;
  /** System prompt (the markdown body after frontmatter) */
  systemPrompt: string;
}

/**
 * Claude Code v2.1.37 skill configuration
 *
 * Maps directly to the SKILL.md frontmatter fields.
 * See: https://code.claude.com/docs/en/skills
 */
export interface SkillConfigV2 {
  /** Skill identifier, lowercase letters, numbers, hyphens (max 64 chars) */
  name: string;
  /** What the skill does and when to use it */
  description: string;
  /** Hint shown during autocomplete, e.g. "[issue-number]" */
  argumentHint?: string;
  /** Prevent Claude from auto-loading this skill. Default: false */
  disableModelInvocation?: boolean;
  /** Hide from the / menu. Default: true */
  userInvocable?: boolean;
  /** Tools Claude can use without permission when this skill is active */
  allowedTools?: string[];
  /** Model to use when this skill is active */
  model?: string;
  /** Run in a forked subagent context */
  context?: 'fork';
  /** Subagent type for context: fork. Built-in: Explore, Plan, general-purpose */
  agent?: string;
  /** Lifecycle hooks scoped to this skill */
  hooks?: HooksConfig;
  /** Skill instructions (the markdown body) */
  instructions: string;
  /** Supporting files to generate alongside SKILL.md */
  supportingFiles?: Record<string, string>;
}

/**
 * Path-scoped rule configuration for .claude/rules/
 */
export interface RuleConfig {
  /** Rule filename (without .md extension) */
  name: string;
  /** Subdirectory within .claude/rules/ (optional) */
  subdirectory?: string;
  /** Glob patterns this rule applies to. Omit for unconditional rules */
  paths?: string[];
  /** Rule content in markdown */
  content: string;
}

/**
 * Claude Code v2.1.37 settings.json schema
 *
 * See: https://code.claude.com/docs/en/settings
 */
export interface ClaudeSettingsV2 {
  /** Environment variables available to Claude Code */
  env?: Record<string, string>;
  /** Permission configuration */
  permissions?: {
    /** Allowed tool patterns, e.g. "Bash(npm run lint)" */
    allow?: string[];
    /** Denied tool patterns, e.g. "Bash(rm -rf /)" */
    deny?: string[];
  };
  /** Lifecycle hooks for all 14 events */
  hooks?: HooksConfig;
  /** Include Co-Authored-By in git commits */
  includeCoAuthoredBy?: boolean;
  /** Enabled MCP servers from .mcp.json */
  enabledMcpjsonServers?: string[];
  /** Agent teams display mode */
  teammateMode?: TeammateMode;
  /** Disable all hooks without removing them */
  disableAllHooks?: boolean;
}

/**
 * Enhanced project options extended with v2 Claude Code configuration
 */
export interface EnhancedProjectOptionsV2 extends EnhancedProjectOptions {
  /** Claude Code v2.1.37 subagent definitions */
  agentsV2?: AgentConfigV2[];
  /** Claude Code v2.1.37 skill definitions */
  skillsV2?: SkillConfigV2[];
  /** Claude Code v2.1.37 hooks configuration */
  hooksConfig?: HooksConfig;
  /** Modular rules for .claude/rules/ */
  rules?: RuleConfig[];
  /** CLAUDE.md project memory content */
  projectMemory?: string;
  /** Enable agent teams (experimental) */
  enableAgentTeams?: boolean;
  /** Permission allow rules */
  permissionAllow?: string[];
  /** Permission deny rules */
  permissionDeny?: string[];
  /** Environment variables for settings.json */
  settingsEnv?: Record<string, string>;
  /** MCP server names to enable */
  mcpServers?: string[];
  /** Agent teams display mode */
  teammateMode?: TeammateMode;
}
