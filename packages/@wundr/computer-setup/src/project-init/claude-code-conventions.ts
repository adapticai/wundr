/**
 * Claude Code Conventions Generator
 *
 * Generates the .claude/ directory structure with all necessary files
 * for Claude Code integration, including agents, skills, commands,
 * and settings.
 *
 * @module project-init/claude-code-conventions
 */

import * as path from 'path';

import * as fs from 'fs-extra';

import type {
  AgentConfig,
  CommandConfig,
  EnhancedProjectOptions,
  MemoryArchitecture,
  OrchestrationFramework,
  SkillConfig,
} from './enhanced-options.js';

/**
 * Claude Code directory structure definition
 */
export interface ClaudeCodeStructure {
  /** Root .claude directory path */
  rootPath: string;
  /** Subdirectory paths */
  directories: {
    agents: string;
    skills: string;
    commands: string;
    hooks: string;
    memory: string;
    workflows: string;
    conventions: string;
    governance?: string;
  };
  /** Generated file paths */
  files: {
    settings: string;
    agentIndex: string;
    skillsIndex?: string;
    commandsIndex?: string;
  };
}

/**
 * Settings.json schema for Claude Code
 */
export interface ClaudeSettings {
  version: string;
  project: {
    name: string;
    type: string;
    description?: string;
  };
  hooks: {
    enabled: boolean;
    preTask?: string;
    postTask?: string;
    preEdit?: string;
    postEdit?: string;
    sessionStart?: string;
    sessionEnd?: string;
  };
  memory?: {
    architecture: MemoryArchitecture;
    persistentMemory: boolean;
    memoryBankPath?: string;
  };
  orchestration?: {
    framework: OrchestrationFramework;
    enableSwarm: boolean;
    maxConcurrentAgents: number;
  };
  agents?: {
    defaultAgents: string[];
    customAgents: string[];
  };
  security?: {
    secretScanning: boolean;
    sandboxMode: boolean;
  };
}

/**
 * Default agent definitions by category
 */
const DEFAULT_AGENTS: Record<string, AgentConfig[]> = {
  core: [
    {
      id: 'coder',
      name: 'Code Implementation Agent',
      description:
        'Implements features, writes production-quality code, handles refactoring',
      category: 'core',
      requiredTools: ['Read', 'Write', 'Edit', 'Bash'],
    },
    {
      id: 'reviewer',
      name: 'Code Review Agent',
      description: 'Reviews code for quality, security, and best practices',
      category: 'core',
      requiredTools: ['Read', 'Grep', 'Glob'],
    },
    {
      id: 'tester',
      name: 'Test Implementation Agent',
      description: 'Creates and maintains test suites, ensures code coverage',
      category: 'core',
      requiredTools: ['Read', 'Write', 'Edit', 'Bash'],
    },
    {
      id: 'planner',
      name: 'Planning Agent',
      description:
        'Breaks down tasks, creates implementation plans, coordinates work',
      category: 'core',
      requiredTools: ['Read', 'Glob', 'TodoWrite'],
    },
    {
      id: 'researcher',
      name: 'Research Agent',
      description:
        'Investigates solutions, gathers context, analyzes codebases',
      category: 'core',
      requiredTools: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    },
  ],
  github: [
    {
      id: 'pr-manager',
      name: 'Pull Request Manager',
      description: 'Creates, reviews, and manages pull requests',
      category: 'github',
      requiredTools: ['Bash', 'Read'],
      mcpAccess: true,
    },
    {
      id: 'issue-tracker',
      name: 'Issue Tracker',
      description: 'Triages, labels, and manages GitHub issues',
      category: 'github',
      requiredTools: ['Bash', 'Read'],
      mcpAccess: true,
    },
  ],
  testing: [
    {
      id: 'tdd-coordinator',
      name: 'TDD Coordinator',
      description: 'Orchestrates test-driven development workflow',
      category: 'testing',
      requiredTools: ['Read', 'Write', 'Bash'],
    },
  ],
  devops: [
    {
      id: 'deployment-monitor',
      name: 'Deployment Monitor',
      description: 'Monitors deployment status and health',
      category: 'devops',
      requiredTools: ['Bash', 'Read'],
      mcpAccess: true,
    },
    {
      id: 'log-analyzer',
      name: 'Log Analyzer',
      description: 'Analyzes logs to identify issues and root causes',
      category: 'devops',
      requiredTools: ['Read', 'Grep', 'Bash'],
    },
  ],
};

/**
 * Default skill definitions
 */
const DEFAULT_SKILLS: SkillConfig[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Performs thorough code review with best practices',
    category: 'development',
    fileTypes: ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'],
    instructions: `Perform a comprehensive code review:
1. Check for code quality and readability
2. Verify error handling
3. Look for security vulnerabilities
4. Assess performance implications
5. Suggest improvements with examples`,
  },
  {
    id: 'refactor',
    name: 'Refactoring',
    description: 'Intelligent code refactoring with pattern detection',
    category: 'development',
    fileTypes: ['ts', 'tsx', 'js', 'jsx'],
    instructions: `Refactor the code following these principles:
1. Maintain existing functionality (no behavioral changes)
2. Improve readability and maintainability
3. Apply DRY, SOLID, and KISS principles
4. Add/update documentation as needed
5. Ensure all tests still pass`,
  },
  {
    id: 'test-generation',
    name: 'Test Generation',
    description: 'Generates comprehensive test suites',
    category: 'testing',
    fileTypes: ['ts', 'tsx', 'js', 'jsx'],
    instructions: `Generate comprehensive tests:
1. Unit tests for all public functions
2. Edge case coverage
3. Mock external dependencies
4. Follow TDD principles
5. Aim for >80% coverage`,
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Generates and updates documentation',
    category: 'documentation',
    instructions: `Generate/update documentation:
1. Add JSDoc/TSDoc comments to public APIs
2. Update README if needed
3. Create usage examples
4. Document edge cases and errors
5. Keep documentation concise but complete`,
  },
];

/**
 * Default command definitions
 */
const DEFAULT_COMMANDS: CommandConfig[] = [
  {
    name: 'review',
    description: 'Run a code review on specified files',
    category: 'development',
    arguments: [
      {
        name: 'path',
        description: 'File or directory to review',
        required: false,
        type: 'string',
      },
    ],
    content: `# Code Review Command

Review the specified file(s) for:
- Code quality and best practices
- Potential bugs or issues
- Performance concerns
- Security vulnerabilities
- Documentation completeness

Provide actionable feedback with specific line references.`,
  },
  {
    name: 'test',
    description: 'Run tests or generate new tests',
    category: 'testing',
    arguments: [
      {
        name: 'scope',
        description: 'Test scope (unit, integration, e2e)',
        required: false,
        type: 'string',
      },
    ],
    content: `# Test Command

Run or generate tests based on the scope:
- unit: Unit tests for individual functions
- integration: Integration tests for modules
- e2e: End-to-end tests for workflows

Report coverage and failing tests clearly.`,
  },
  {
    name: 'fix',
    description: 'Fix lint errors and common issues',
    category: 'development',
    content: `# Fix Command

Automatically fix:
1. Lint errors (run lint --fix)
2. Formatting issues (run prettier)
3. Type errors where possible
4. Common code smells

Report what was fixed and what requires manual intervention.`,
  },
  {
    name: 'deploy-monitor',
    description: 'Monitor deployment status',
    category: 'devops',
    arguments: [
      {
        name: 'platform',
        description: 'Platform (railway, netlify)',
        required: false,
        type: 'string',
      },
    ],
    content: `# Deployment Monitor Command

Monitor deployment on the specified platform:
1. Check deployment status
2. Fetch recent logs
3. Identify errors or warnings
4. Suggest fixes for failures
5. Report final status`,
  },
];

/**
 * Generate Claude Code directory structure
 *
 * Creates the complete .claude/ directory with all necessary subdirectories
 * and configuration files for Claude Code integration.
 *
 * @param options - Enhanced project options
 * @returns Generated structure information
 */
export async function generateClaudeCodeStructure(
  options: EnhancedProjectOptions,
): Promise<ClaudeCodeStructure> {
  const claudeDir = path.join(options.projectPath, '.claude');

  // Define directory structure
  const structure: ClaudeCodeStructure = {
    rootPath: claudeDir,
    directories: {
      agents: path.join(claudeDir, 'agents'),
      skills: path.join(claudeDir, 'skills'),
      commands: path.join(claudeDir, 'commands'),
      hooks: path.join(claudeDir, 'hooks'),
      memory: path.join(claudeDir, 'memory'),
      workflows: path.join(claudeDir, 'workflows'),
      conventions: path.join(claudeDir, 'conventions'),
    },
    files: {
      settings: path.join(claudeDir, 'settings.json'),
      agentIndex: path.join(claudeDir, 'agents', 'README.md'),
    },
  };

  // Add governance directory for fleet architecture
  if (options.enableFleetArchitecture || options.enableIPREGovernance) {
    structure.directories.governance = path.join(claudeDir, 'governance');
  }

  // Create all directories
  await createDirectories(structure, options);

  // Generate agents
  await generateAgents(structure, options);

  // Generate skills
  if (options.skills && options.skills.length > 0) {
    structure.files.skillsIndex = path.join(
      structure.directories.skills,
      'README.md',
    );
    await generateSkills(structure, options);
  } else {
    await generateDefaultSkills(structure);
  }

  // Generate commands
  if (options.commands && options.commands.length > 0) {
    structure.files.commandsIndex = path.join(
      structure.directories.commands,
      'README.md',
    );
    await generateCommands(structure, options);
  } else {
    await generateDefaultCommands(structure);
  }

  // Generate settings.json
  await generateSettings(structure, options);

  // Generate memory structure based on architecture
  await generateMemoryStructure(structure, options);

  return structure;
}

/**
 * Create all directories in the structure
 */
async function createDirectories(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  // Create main directories
  for (const dir of Object.values(structure.directories)) {
    if (dir) {
      await fs.ensureDir(dir);
    }
  }

  // Create agent subdirectories
  const agentCategories = [
    'core',
    'specialized',
    'github',
    'testing',
    'devops',
  ];
  for (const category of agentCategories) {
    await fs.ensureDir(path.join(structure.directories.agents, category));
  }

  // Create command subdirectories
  const commandCategories = [
    'development',
    'testing',
    'devops',
    'documentation',
  ];
  for (const category of commandCategories) {
    await fs.ensureDir(path.join(structure.directories.commands, category));
  }

  // Create memory subdirectories based on architecture
  if (
    options.memoryConfig?.architecture === 'tiered' ||
    options.memoryConfig?.architecture === 'memgpt'
  ) {
    await fs.ensureDir(path.join(structure.directories.memory, 'sessions'));
    await fs.ensureDir(path.join(structure.directories.memory, 'shared'));
    await fs.ensureDir(
      path.join(structure.directories.memory, 'session-template'),
    );
  }

  // Create governance subdirectories if enabled
  if (structure.directories.governance) {
    await fs.ensureDir(path.join(structure.directories.governance, 'policies'));
    await fs.ensureDir(
      path.join(structure.directories.governance, 'evaluators'),
    );
  }
}

/**
 * Generate agent definition files
 */
async function generateAgents(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  const agentsToGenerate: AgentConfig[] = [];

  // Add default core agents
  agentsToGenerate.push(...DEFAULT_AGENTS.core);

  // Add GitHub agents if hooks are enabled
  if (options.includeHooks) {
    agentsToGenerate.push(...DEFAULT_AGENTS.github);
  }

  // Add testing agents
  agentsToGenerate.push(...DEFAULT_AGENTS.testing);

  // Add devops agents
  agentsToGenerate.push(...DEFAULT_AGENTS.devops);

  // Add custom agents from options
  if (options.agents) {
    agentsToGenerate.push(...options.agents);
  }

  // Generate agent files
  for (const agent of agentsToGenerate) {
    const agentContent = generateAgentMarkdown(agent, options);
    const agentPath = path.join(
      structure.directories.agents,
      agent.category,
      `${agent.id}.md`,
    );
    await fs.writeFile(agentPath, agentContent);
  }

  // Generate agent index
  const indexContent = generateAgentIndex(agentsToGenerate, options);
  await fs.writeFile(structure.files.agentIndex, indexContent);
}

/**
 * Generate markdown content for an agent
 */
function generateAgentMarkdown(
  agent: AgentConfig,
  options: EnhancedProjectOptions,
): string {
  const promptTone = options.promptConfig?.tone || 'professional';
  const verificationProtocol =
    options.promptConfig?.verificationProtocol ?? true;

  let content = `---
id: ${agent.id}
name: ${agent.name}
category: ${agent.category}
project: ${options.projectName}
projectType: ${options.projectType}
---

# ${agent.name}

${agent.description}

## Purpose

This agent specializes in ${agent.description.toLowerCase()}.

## Capabilities

`;

  if (agent.requiredTools) {
    content += `### Required Tools
${agent.requiredTools.map(tool => `- ${tool}`).join('\n')}

`;
  }

  if (agent.mcpAccess) {
    content += `### MCP Integration
This agent has access to MCP tools for enhanced functionality.

`;
  }

  content += `## Guidelines

### Tone
Maintain a ${promptTone} tone in all interactions.

`;

  if (verificationProtocol) {
    content += `### Verification Protocol
- ALWAYS verify changes with actual commands
- Show real terminal output, not fictional results
- Report failures immediately with "FAILURE:" prefix
- Only claim completion after verification

`;
  }

  if (agent.systemPrompt) {
    content += `## Custom Instructions

${agent.systemPrompt}

`;
  }

  content += `## Usage

Invoke this agent for tasks related to ${agent.description.toLowerCase()}.

\`\`\`
@${agent.id} [your task description]
\`\`\`
`;

  return content;
}

/**
 * Generate agent index README
 */
function generateAgentIndex(
  agents: AgentConfig[],
  options: EnhancedProjectOptions,
): string {
  const byCategory = agents.reduce(
    (acc, agent) => {
      if (!acc[agent.category]) {
        acc[agent.category] = [];
      }
      acc[agent.category].push(agent);
      return acc;
    },
    {} as Record<string, AgentConfig[]>,
  );

  let content = `# Available Agents

Project: ${options.projectName}
Type: ${options.projectType}

## Agent Categories

`;

  for (const [category, categoryAgents] of Object.entries(byCategory)) {
    content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}

| Agent | Description |
|-------|-------------|
${categoryAgents.map(a => `| \`${a.id}\` | ${a.description} |`).join('\n')}

`;
  }

  content += `## Usage

Agents can be invoked using the @ syntax:

\`\`\`
@coder Implement the user authentication feature
@reviewer Review the changes in src/auth/
@tester Create tests for the new API endpoints
\`\`\`

## Customization

Agent definitions can be customized by editing the markdown files in each category directory.
`;

  return content;
}

/**
 * Generate default skills
 */
async function generateDefaultSkills(
  structure: ClaudeCodeStructure,
): Promise<void> {
  for (const skill of DEFAULT_SKILLS) {
    const skillPath = path.join(structure.directories.skills, `${skill.id}.md`);
    const content = generateSkillMarkdown(skill);
    await fs.writeFile(skillPath, content);
  }

  // Generate skills index
  const indexContent = generateSkillsIndex(DEFAULT_SKILLS);
  await fs.writeFile(
    path.join(structure.directories.skills, 'README.md'),
    indexContent,
  );
}

/**
 * Generate custom skills from options
 */
async function generateSkills(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  const skills = [...DEFAULT_SKILLS, ...(options.skills || [])];

  for (const skill of skills) {
    const skillPath = path.join(structure.directories.skills, `${skill.id}.md`);
    const content = generateSkillMarkdown(skill);
    await fs.writeFile(skillPath, content);
  }

  // Generate skills index
  const indexContent = generateSkillsIndex(skills);
  await fs.writeFile(structure.files.skillsIndex!, indexContent);
}

/**
 * Generate markdown content for a skill
 */
function generateSkillMarkdown(skill: SkillConfig): string {
  let content = `---
id: ${skill.id}
name: ${skill.name}
category: ${skill.category}
`;

  if (skill.fileTypes) {
    content += `fileTypes: [${skill.fileTypes.map(t => `"${t}"`).join(', ')}]
`;
  }

  content += `---

# ${skill.name}

${skill.description}

## Instructions

${skill.instructions}

## Usage

Invoke this skill using the skill command:

\`\`\`
/skill ${skill.id}
\`\`\`
`;

  return content;
}

/**
 * Generate skills index README
 */
function generateSkillsIndex(skills: SkillConfig[]): string {
  const byCategory = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, SkillConfig[]>,
  );

  let content = `# Available Skills

## Skill Categories

`;

  for (const [category, categorySkills] of Object.entries(byCategory)) {
    content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}

| Skill | Description |
|-------|-------------|
${categorySkills.map(s => `| \`${s.id}\` | ${s.description} |`).join('\n')}

`;
  }

  content += `## Usage

Skills can be invoked using the /skill command:

\`\`\`
/skill code-review
/skill refactor
/skill test-generation
\`\`\`
`;

  return content;
}

/**
 * Generate default commands
 */
async function generateDefaultCommands(
  structure: ClaudeCodeStructure,
): Promise<void> {
  for (const command of DEFAULT_COMMANDS) {
    const commandPath = path.join(
      structure.directories.commands,
      command.category,
      `${command.name}.md`,
    );
    await fs.writeFile(commandPath, command.content);
  }

  // Generate commands index
  const indexContent = generateCommandsIndex(DEFAULT_COMMANDS);
  await fs.writeFile(
    path.join(structure.directories.commands, 'README.md'),
    indexContent,
  );
}

/**
 * Generate custom commands from options
 */
async function generateCommands(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  const commands = [...DEFAULT_COMMANDS, ...(options.commands || [])];

  for (const command of commands) {
    const commandPath = path.join(
      structure.directories.commands,
      command.category,
      `${command.name}.md`,
    );
    await fs.ensureDir(path.dirname(commandPath));
    await fs.writeFile(commandPath, command.content);
  }

  // Generate commands index
  const indexContent = generateCommandsIndex(commands);
  await fs.writeFile(structure.files.commandsIndex!, indexContent);
}

/**
 * Generate commands index README
 */
function generateCommandsIndex(commands: CommandConfig[]): string {
  const byCategory = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandConfig[]>,
  );

  let content = `# Available Commands

## Command Categories

`;

  for (const [category, categoryCommands] of Object.entries(byCategory)) {
    content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}

| Command | Description |
|---------|-------------|
${categoryCommands.map(c => `| \`/${c.name}\` | ${c.description} |`).join('\n')}

`;
  }

  content += `## Usage

Commands can be invoked using the / prefix:

\`\`\`
/review src/components/
/test unit
/fix
/deploy-monitor railway
\`\`\`
`;

  return content;
}

/**
 * Generate settings.json file
 */
async function generateSettings(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  const settings: ClaudeSettings = {
    version: '1.0.0',
    project: {
      name: options.projectName,
      type: options.projectType,
    },
    hooks: {
      enabled: options.includeHooks,
    },
  };

  if (options.includeHooks) {
    settings.hooks = {
      ...settings.hooks,
      preTask: 'hooks/pre-task.sh',
      postTask: 'hooks/post-task.sh',
      preEdit: 'hooks/pre-edit.sh',
      postEdit: 'hooks/post-edit.sh',
      sessionStart: 'hooks/session-start.sh',
      sessionEnd: 'hooks/session-end.sh',
    };
  }

  if (options.memoryConfig) {
    settings.memory = {
      architecture: options.memoryConfig.architecture,
      persistentMemory: options.memoryConfig.persistentMemory,
      memoryBankPath: options.memoryConfig.memoryBankPath,
    };
  }

  if (options.orchestration) {
    settings.orchestration = {
      framework: options.orchestration.framework,
      enableSwarm: options.orchestration.enableSwarm,
      maxConcurrentAgents: options.orchestration.maxConcurrentAgents,
    };
  }

  if (options.security) {
    settings.security = {
      secretScanning: options.security.secretScanning,
      sandboxMode: options.security.sandboxMode,
    };
  }

  // Add agent references
  const defaultAgentIds = DEFAULT_AGENTS.core.map(a => a.id);
  const customAgentIds = options.agents?.map(a => a.id) || [];
  settings.agents = {
    defaultAgents: defaultAgentIds,
    customAgents: customAgentIds,
  };

  await fs.writeJson(structure.files.settings, settings, { spaces: 2 });
}

/**
 * Generate memory structure based on architecture type
 */
async function generateMemoryStructure(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions,
): Promise<void> {
  const memoryDir = structure.directories.memory;
  const architecture = options.memoryConfig?.architecture || 'basic';

  if (architecture === 'basic') {
    // Basic memory - simple context file
    const contextFile = path.join(memoryDir, 'context.md');
    await fs.writeFile(
      contextFile,
      `# Session Context

## Current Focus
<!-- Updated during session -->

## Recent Actions
<!-- Log of recent actions -->

## Notes
<!-- Important notes to remember -->
`,
    );
  } else if (architecture === 'tiered' || architecture === 'memgpt') {
    // Tiered/MemGPT - full memory bank structure
    const sessionTemplateDir = path.join(memoryDir, 'session-template');

    // Active context template
    await fs.writeFile(
      path.join(sessionTemplateDir, 'activeContext.md'),
      `# Active Context - Session {{SESSION_ID}}

## Current Focus
<!-- Updated by session manager -->

## Working Memory
- Last action:
- Next planned step:
- Blockers:

## Context Window State
- Tokens used: X / 200,000
- Compression needed: Yes/No

## Handoff Notes
<!-- For session resumption -->
`,
    );

    // Progress template
    await fs.writeFile(
      path.join(sessionTemplateDir, 'progress.md'),
      `# Progress Tracker - Session {{SESSION_ID}}

## High-Level Milestones
| Milestone | Status | Started | Completed |
|-----------|--------|---------|-----------|

## Current Sprint
- Goal:
- Progress: 0%
- ETA:

## Completed Tasks
<!-- Archive of completed work -->

## Blockers & Dependencies
<!-- Items waiting on external input -->
`,
    );

    // Shared memory files
    const sharedDir = path.join(memoryDir, 'shared');
    await fs.writeFile(
      path.join(sharedDir, 'architecture.md'),
      `# Shared Architecture Decisions

## Cross-Session Architectural Patterns
<!-- Decisions that apply across all sessions -->

## Technology Stack
<!-- Canonical technology choices -->

## Integration Points
<!-- How systems connect -->
`,
    );

    await fs.writeFile(
      path.join(sharedDir, 'patterns.md'),
      `# Learned Patterns

## Successful Patterns
<!-- Patterns that have worked well -->

## Anti-Patterns to Avoid
<!-- Patterns that have caused issues -->

## Optimization Opportunities
<!-- Areas identified for improvement -->
`,
    );
  }

  // Memory README
  await fs.writeFile(
    path.join(memoryDir, 'README.md'),
    `# Memory Bank

Architecture: ${architecture}

## Structure

${
  architecture === 'basic'
    ? '- `context.md` - Session context and notes'
    : `- \`session-template/\` - Templates for new sessions
- \`sessions/\` - Active and archived sessions
- \`shared/\` - Cross-session knowledge`
}

## Usage

${architecture === 'basic' ? 'The context file is automatically updated during sessions to track progress and important information.' : 'New sessions are created from the template directory. Session memory is persisted and can be resumed across Claude Code sessions.'}
`,
  );
}

export default generateClaudeCodeStructure;
