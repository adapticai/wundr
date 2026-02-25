/**
 * Claude Code Conventions Generator v2
 *
 * Generates the .claude/ directory structure aligned with Claude Code v2.1.37.
 * Produces proper subagent frontmatter, SKILL.md format, settings.json hooks
 * (all 14 lifecycle events), auto-memory templates, rules directory, and
 * agent teams configuration.
 *
 * @module project-init/claude-code-conventions
 */

import * as path from 'path';

import * as fs from 'fs-extra';

import type {
  AgentConfig,
  AgentConfigV2,
  ClaudeSettingsV2,
  CommandConfig,
  EnhancedProjectOptions,
  EnhancedProjectOptionsV2,
  HookMatcherGroup,
  HooksConfig,
  MemoryArchitecture,
  OrchestrationFramework,
  RuleConfig,
  SkillConfig,
  SkillConfigV2,
} from './enhanced-options.js';

// =============================================================================
// Public Types
// =============================================================================

/**
 * Claude Code v2 directory structure definition
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
    rules: string;
    memory: string;
    workflows: string;
    conventions: string;
    governance?: string;
  };
  /** Generated file paths */
  files: {
    settings: string;
    settingsLocal: string;
    agentIndex: string;
    projectMemory: string;
    localMemory: string;
    skillsIndex?: string;
    commandsIndex?: string;
  };
}

/**
 * Settings.json schema for Claude Code v1 (backward compatibility)
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

// =============================================================================
// Default Agent Definitions (v2 format)
// =============================================================================

const DEFAULT_AGENTS_V2: AgentConfigV2[] = [
  {
    name: 'code-reviewer',
    description:
      'Expert code review specialist. Reviews code for quality, security, and maintainability. Use proactively after writing or modifying code.',
    category: 'core',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    model: 'inherit',
    permissionMode: 'default',
    memory: 'project',
    systemPrompt: `You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.`,
  },
  {
    name: 'debugger',
    description:
      'Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.',
    category: 'core',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
    model: 'inherit',
    permissionMode: 'default',
    memory: 'project',
    systemPrompt: `You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.`,
  },
  {
    name: 'test-writer',
    description:
      'Test implementation specialist. Creates comprehensive test suites with high coverage. Use when implementing new features or fixing bugs.',
    category: 'core',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    memory: 'local',
    systemPrompt: `You are a test engineering expert focused on comprehensive test coverage.

When invoked:
1. Analyze the code to be tested
2. Identify all code paths and edge cases
3. Write tests following TDD principles
4. Run tests and verify they pass
5. Report coverage

Test strategy:
- Unit tests for all public functions
- Edge cases: null, empty, boundary values
- Error cases: invalid inputs, network failures
- Integration tests for module interactions
- Mock external dependencies appropriately

Follow these conventions:
- Use describe/it blocks for clear organization
- One assertion per test when practical
- Descriptive test names that explain the expected behavior
- Setup and teardown for shared state
- Avoid testing implementation details`,
  },
  {
    name: 'researcher',
    description:
      'Research agent for investigating solutions, gathering context, and analyzing codebases. Use for exploration tasks that do not require code changes.',
    category: 'core',
    tools: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    disallowedTools: ['Write', 'Edit'],
    model: 'haiku',
    permissionMode: 'plan',
    memory: 'user',
    systemPrompt: `You are a research specialist focused on gathering and synthesizing information.

When invoked:
1. Understand the research question
2. Search the codebase for relevant patterns
3. Check documentation and external resources
4. Synthesize findings into actionable insights

Research approach:
- Start with broad search, then narrow down
- Cross-reference multiple sources
- Note confidence level for each finding
- Identify gaps in understanding
- Provide specific file references

Deliver findings as:
- Summary of key discoveries
- Relevant code locations with line numbers
- Recommendations for next steps
- Open questions that need further investigation`,
  },
  {
    name: 'deploy-monitor',
    description:
      'Deployment monitoring agent. Checks deployment status, analyzes logs, and identifies issues. Use after pushing to main or when deployments fail.',
    category: 'devops',
    tools: ['Bash', 'Read', 'Grep'],
    model: 'inherit',
    permissionMode: 'default',
    systemPrompt: `You are a deployment monitoring specialist focused on ensuring successful deployments.

When invoked:
1. Check deployment platform status
2. Fetch and analyze recent logs
3. Identify errors, warnings, or performance issues
4. Report status with actionable next steps

Monitoring checklist:
- Build status (success/failure)
- Runtime errors in logs
- Performance metrics
- Health check endpoints
- Resource utilization

For failures:
- Identify the root cause from logs
- Suggest specific code fixes
- Provide rollback instructions if needed
- Track resolution progress`,
  },
];

// =============================================================================
// Default Skill Definitions (v2 format)
// =============================================================================

const DEFAULT_SKILLS_V2: SkillConfigV2[] = [
  {
    name: 'code-review',
    description:
      'Perform a structured code review with prioritized feedback. Use when reviewing PRs, assessing code quality, or after making changes.',
    instructions: `Perform a comprehensive code review:

1. **Identify scope**: Determine which files changed (run \`git diff --name-only\` if needed)
2. **Read the changes**: Analyze each modified file for issues
3. **Categorize findings**:
   - Critical (must fix before merge)
   - Warning (should fix, potential issues)
   - Suggestion (nice to have improvements)
4. **Provide examples**: Show the current code and suggested improvement
5. **Summarize**: Give an overall assessment and readiness-to-merge score

Check for:
- Security vulnerabilities (injection, secrets, auth)
- Error handling gaps
- Performance concerns
- Code duplication
- Missing tests
- Documentation gaps`,
  },
  {
    name: 'deploy',
    description: 'Deploy the application to the target environment',
    disableModelInvocation: true,
    context: 'fork',
    allowedTools: ['Bash', 'Read'],
    instructions: `Deploy $ARGUMENTS to production:

1. Run the test suite and verify all tests pass
2. Build the application
3. Check for any uncommitted changes
4. Push to the deployment target
5. Monitor deployment progress
6. Verify the deployment succeeded with a health check
7. Report final status`,
  },
  {
    name: 'fix-issue',
    description: 'Fix a GitHub issue by number',
    disableModelInvocation: true,
    argumentHint: '[issue-number]',
    instructions: `Fix GitHub issue $ARGUMENTS following project coding standards.

1. Read the issue description: \`gh issue view $0\`
2. Understand the requirements and acceptance criteria
3. Explore relevant code paths
4. Implement the fix with minimal changes
5. Write or update tests to cover the fix
6. Verify tests pass
7. Create a descriptive commit
8. Report what was changed and why`,
  },
  {
    name: 'test-gen',
    description:
      'Generate comprehensive test suites for specified files or modules. Use when adding test coverage to existing code.',
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    instructions: `Generate comprehensive tests for $ARGUMENTS:

1. Analyze the target code to understand:
   - Public API surface
   - Input/output types
   - Error conditions
   - Dependencies to mock

2. Generate tests covering:
   - Happy path for each public function
   - Edge cases (null, undefined, empty, boundary)
   - Error handling paths
   - Integration between related functions

3. Follow project test conventions:
   - Match existing test file naming patterns
   - Use the project's test framework
   - Follow existing mock patterns

4. Run the tests and fix any failures
5. Report coverage for the target files`,
  },
  {
    name: 'api-conventions',
    description:
      'API design patterns and conventions for this codebase. Loaded automatically when working on API endpoints.',
    userInvocable: false,
    instructions: `When writing API endpoints, follow these conventions:

- Use RESTful naming: plural nouns for collections, singular for resources
- Return consistent error formats with status code, message, and error code
- Include request validation at the handler level
- Use proper HTTP status codes (201 for creation, 204 for deletion)
- Add OpenAPI documentation comments
- Implement rate limiting for public endpoints
- Use pagination for list endpoints (cursor-based preferred)
- Include request/response logging middleware
- Handle authentication before authorization
- Return appropriate cache headers`,
  },
];

// =============================================================================
// Default Hook Definitions
// =============================================================================

/**
 * Generate default hooks configuration based on project options
 */
function generateDefaultHooks(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): HooksConfig {
  const hooks: HooksConfig = {};

  // PreToolUse: validate bash commands for safety
  hooks.PreToolUse = [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/validate-bash.sh',
          timeout: 10,
          statusMessage: 'Validating command safety...',
        },
      ],
    },
  ];

  // PostToolUse: run linting after file edits
  hooks.PostToolUse = [
    {
      matcher: 'Write|Edit',
      hooks: [
        {
          type: 'command',
          command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/post-edit.sh',
          timeout: 30,
          statusMessage: 'Running post-edit checks...',
        },
      ],
    },
  ];

  // Stop: verify task completion with a prompt hook
  hooks.Stop = [
    {
      hooks: [
        {
          type: 'prompt',
          prompt:
            'Evaluate if Claude should stop: $ARGUMENTS. Check if all requested tasks are complete, all tests pass if applicable, and no obvious issues remain.',
          timeout: 30,
        },
      ],
    },
  ];

  // PreCompact: provide guidance before compaction
  hooks.PreCompact = [
    {
      matcher: 'auto',
      hooks: [
        {
          type: 'command',
          command: `/bin/bash -c 'echo "Before compacting, review CLAUDE.md for project context and conventions."'`,
        },
      ],
    },
    {
      matcher: 'manual',
      hooks: [
        {
          type: 'command',
          command: `/bin/bash -c 'echo "Manual compact: preserving critical project context."'`,
        },
      ],
    },
  ];

  // SessionEnd: persist state
  hooks.SessionEnd = [
    {
      hooks: [
        {
          type: 'command',
          command: `/bin/bash -c 'echo "Session ended at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$CLAUDE_PROJECT_DIR"/.claude/session-log.txt'`,
          async: true,
        },
      ],
    },
  ];

  return hooks;
}

// =============================================================================
// Default Rule Definitions
// =============================================================================

function generateDefaultRules(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): RuleConfig[] {
  const rules: RuleConfig[] = [
    {
      name: 'code-style',
      content: `# Code Style Guidelines

- Use consistent naming: camelCase for variables/functions, PascalCase for classes/types
- Keep functions under 30 lines; extract helper functions for complex logic
- Prefer early returns over deep nesting
- Add JSDoc/TSDoc for all public API functions
- Use meaningful variable names; avoid single-letter names except in loops
- Prefer const over let; never use var
- Group related imports: external libraries first, then internal modules
`,
    },
    {
      name: 'testing',
      content: `# Testing Conventions

- Write tests alongside implementation (same directory or adjacent __tests__ directory)
- Use descriptive test names: "should [expected behavior] when [condition]"
- Follow Arrange-Act-Assert pattern
- Mock external dependencies; never make real network calls in unit tests
- Aim for >80% branch coverage on new code
- Run the full test suite before committing: \`npm test\`
`,
    },
    {
      name: 'security',
      content: `# Security Requirements

- Never hardcode secrets, API keys, or credentials in source code
- Validate all user inputs at the boundary (API handlers, form processors)
- Use parameterized queries for database operations
- Sanitize output to prevent XSS
- Check for path traversal in file operations
- Review dependencies for known vulnerabilities before adding
- Use HTTPS for all external API calls
`,
    },
    {
      name: 'git-workflow',
      content: `# Git Workflow

- Write clear commit messages: imperative mood, under 72 characters
- Create feature branches from main: feature/description or fix/description
- Keep PRs focused: one logical change per PR
- Include tests for all new functionality
- Update documentation when changing public APIs
- Never force push to main/master
- Resolve all review comments before merging
`,
    },
  ];

  // Add TypeScript-specific rules for applicable project types
  if (['node', 'react', 'vue', 'monorepo'].includes(options.projectType)) {
    rules.push({
      name: 'typescript',
      paths: ['**/*.ts', '**/*.tsx'],
      content: `# TypeScript Conventions

- Enable strict mode in tsconfig.json
- Prefer interfaces over type aliases for object shapes
- Use union types instead of enums where possible
- Avoid \`any\`; use \`unknown\` and narrow with type guards
- Export types alongside their implementations
- Use branded types for domain identifiers (UserId, OrderId)
- Prefer readonly properties and ReadonlyArray for immutable data
`,
    });
  }

  return rules;
}

// =============================================================================
// Default Agents (v1 format, preserved for backward compatibility)
// =============================================================================

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
 * Default skill definitions (v1 format, preserved for backward compatibility)
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
 * Default command definitions (v1 format, preserved for backward compatibility)
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

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Generate Claude Code directory structure
 *
 * Creates the complete .claude/ directory with all necessary subdirectories
 * and configuration files for Claude Code v2.1.37 integration.
 *
 * Supports both v1 (EnhancedProjectOptions) and v2 (EnhancedProjectOptionsV2)
 * options. When v2-specific fields are present, the generator produces files
 * aligned with the official Claude Code schema.
 *
 * @param options - Enhanced project options (v1 or v2)
 * @returns Generated structure information
 */
export async function generateClaudeCodeStructure(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): Promise<ClaudeCodeStructure> {
  const claudeDir = path.join(options.projectPath, '.claude');

  const structure: ClaudeCodeStructure = {
    rootPath: claudeDir,
    directories: {
      agents: path.join(claudeDir, 'agents'),
      skills: path.join(claudeDir, 'skills'),
      commands: path.join(claudeDir, 'commands'),
      hooks: path.join(claudeDir, 'hooks'),
      rules: path.join(claudeDir, 'rules'),
      memory: path.join(claudeDir, 'memory'),
      workflows: path.join(claudeDir, 'workflows'),
      conventions: path.join(claudeDir, 'conventions'),
    },
    files: {
      settings: path.join(claudeDir, 'settings.json'),
      settingsLocal: path.join(claudeDir, 'settings.local.json'),
      agentIndex: path.join(claudeDir, 'agents', 'README.md'),
      projectMemory: path.join(claudeDir, 'CLAUDE.md'),
      localMemory: path.join(options.projectPath, 'CLAUDE.local.md'),
    },
  };

  if (options.enableFleetArchitecture || options.enableIPREGovernance) {
    structure.directories.governance = path.join(claudeDir, 'governance');
  }

  // Detect whether we have v2-specific options
  const isV2 = hasV2Options(options);

  // Create directories
  await createDirectories(structure, options);

  // Generate content based on version
  if (isV2) {
    const v2Options = options as EnhancedProjectOptionsV2;
    await generateAgentsV2(structure, v2Options);
    await generateSkillsV2(structure, v2Options);
    await generateSettingsV2(structure, v2Options);
    await generateRulesDirectory(structure, v2Options);
    await generateMemoryTemplates(structure, v2Options);
    await generateHookScripts(structure, v2Options);
  } else {
    // v1 fallback path
    await generateAgents(structure, options);
    if (options.skills && options.skills.length > 0) {
      structure.files.skillsIndex = path.join(
        structure.directories.skills,
        'README.md'
      );
      await generateSkills(structure, options);
    } else {
      await generateDefaultSkills(structure);
    }
    if (options.commands && options.commands.length > 0) {
      structure.files.commandsIndex = path.join(
        structure.directories.commands,
        'README.md'
      );
      await generateCommands(structure, options);
    } else {
      await generateDefaultCommands(structure);
    }
    await generateSettings(structure, options);
    await generateMemoryStructure(structure, options);
  }

  return structure;
}

// =============================================================================
// Version Detection
// =============================================================================

/**
 * Detect whether options contain v2-specific fields
 */
function hasV2Options(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): options is EnhancedProjectOptionsV2 {
  const v2 = options as EnhancedProjectOptionsV2;
  return !!(
    v2.agentsV2 ||
    v2.skillsV2 ||
    v2.hooksConfig ||
    v2.rules ||
    v2.enableAgentTeams !== undefined ||
    v2.permissionAllow ||
    v2.permissionDeny
  );
}

// =============================================================================
// Directory Creation
// =============================================================================

async function createDirectories(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): Promise<void> {
  for (const dir of Object.values(structure.directories)) {
    if (dir) {
      await fs.ensureDir(dir);
    }
  }

  // Create governance subdirectories if enabled
  if (structure.directories.governance) {
    await fs.ensureDir(path.join(structure.directories.governance, 'policies'));
    await fs.ensureDir(
      path.join(structure.directories.governance, 'evaluators')
    );
  }
}

// =============================================================================
// v2 Generators: Agents
// =============================================================================

/**
 * Generate subagent files in Claude Code v2.1.37 format
 */
async function generateAgentsV2(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptionsV2
): Promise<void> {
  const agents =
    options.agentsV2 && options.agentsV2.length > 0
      ? options.agentsV2
      : DEFAULT_AGENTS_V2;

  for (const agent of agents) {
    const content = generateAgentMarkdownV2(agent);
    const agentDir = agent.category
      ? path.join(structure.directories.agents, agent.category)
      : structure.directories.agents;
    await fs.ensureDir(agentDir);
    const agentPath = path.join(agentDir, `${agent.name}.md`);
    await fs.writeFile(agentPath, content);
  }

  // Generate agent index
  const indexContent = generateAgentIndexV2(agents);
  await fs.writeFile(structure.files.agentIndex, indexContent);
}

/**
 * Generate markdown content for a v2 subagent with proper YAML frontmatter
 */
function generateAgentMarkdownV2(agent: AgentConfigV2): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  };

  if (agent.tools && agent.tools.length > 0) {
    frontmatter.tools = agent.tools.join(', ');
  }

  if (agent.disallowedTools && agent.disallowedTools.length > 0) {
    frontmatter.disallowedTools = agent.disallowedTools.join(', ');
  }

  if (agent.model) {
    frontmatter.model = agent.model;
  }

  if (agent.permissionMode && agent.permissionMode !== 'default') {
    frontmatter.permissionMode = agent.permissionMode;
  }

  if (agent.maxTurns) {
    frontmatter.maxTurns = agent.maxTurns;
  }

  if (agent.skills && agent.skills.length > 0) {
    frontmatter.skills = agent.skills;
  }

  if (agent.mcpServers) {
    frontmatter.mcpServers = agent.mcpServers;
  }

  if (agent.hooks) {
    frontmatter.hooks = agent.hooks;
  }

  if (agent.memory) {
    frontmatter.memory = agent.memory;
  }

  let content = '---\n';
  content += serializeYamlFrontmatter(frontmatter);
  content += '---\n\n';
  content += agent.systemPrompt;
  content += '\n';

  return content;
}

/**
 * Serialize an object to YAML frontmatter format
 *
 * Handles simple values, arrays, and nested objects properly.
 */
function serializeYamlFrontmatter(
  obj: Record<string, unknown>,
  indent: number = 0
): string {
  let result = '';
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string') {
      // Multi-line strings use >-
      if (value.includes('\n')) {
        result += `${prefix}${key}: >-\n`;
        for (const line of value.split('\n')) {
          result += `${prefix}  ${line}\n`;
        }
      } else {
        result += `${prefix}${key}: ${value}\n`;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result += `${prefix}${key}: ${value}\n`;
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        result += `${prefix}${key}: []\n`;
      } else if (typeof value[0] === 'string') {
        // Simple string array - inline format
        result += `${prefix}${key}:\n`;
        for (const item of value) {
          result += `${prefix}  - ${item}\n`;
        }
      } else {
        // Complex array
        result += `${prefix}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item as Record<string, unknown>);
            if (entries.length > 0) {
              const [firstKey, firstVal] = entries[0];
              result += `${prefix}  - ${firstKey}: ${formatYamlValue(firstVal)}\n`;
              for (let i = 1; i < entries.length; i++) {
                const [k, v] = entries[i];
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                  result += `${prefix}    ${k}:\n`;
                  result += serializeYamlFrontmatter(
                    v as Record<string, unknown>,
                    indent + 3
                  );
                } else if (Array.isArray(v)) {
                  result += `${prefix}    ${k}:\n`;
                  for (const subItem of v) {
                    if (typeof subItem === 'object' && subItem !== null) {
                      const subEntries = Object.entries(
                        subItem as Record<string, unknown>
                      );
                      if (subEntries.length > 0) {
                        const [sk, sv] = subEntries[0];
                        result += `${prefix}      - ${sk}: ${formatYamlValue(sv)}\n`;
                        for (let j = 1; j < subEntries.length; j++) {
                          const [ssk, ssv] = subEntries[j];
                          result += `${prefix}        ${ssk}: ${formatYamlValue(ssv)}\n`;
                        }
                      }
                    } else {
                      result += `${prefix}      - ${formatYamlValue(subItem)}\n`;
                    }
                  }
                } else {
                  result += `${prefix}    ${k}: ${formatYamlValue(v)}\n`;
                }
              }
            }
          }
        }
      }
    } else if (typeof value === 'object') {
      result += `${prefix}${key}:\n`;
      result += serializeYamlFrontmatter(
        value as Record<string, unknown>,
        indent + 1
      );
    }
  }

  return result;
}

function formatYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    if (
      value.includes(':') ||
      value.includes('#') ||
      value.includes('"') ||
      value.includes("'") ||
      value.startsWith(' ') ||
      value.endsWith(' ')
    ) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Generate agent index README for v2 agents
 */
function generateAgentIndexV2(agents: AgentConfigV2[]): string {
  const byCategory = new Map<string, AgentConfigV2[]>();
  for (const agent of agents) {
    const cat = agent.category || 'general';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(agent);
  }

  let content = `# Available Subagents

## Overview

These subagents are defined using Claude Code v2.1.37 frontmatter format.
Claude automatically delegates tasks based on each agent's description.
You can also request a specific subagent explicitly.

## Agents by Category

`;

  for (const [category, categoryAgents] of byCategory) {
    content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}

| Agent | Model | Tools | Memory | Description |
|-------|-------|-------|--------|-------------|
`;
    for (const a of categoryAgents) {
      const tools = a.tools ? a.tools.join(', ') : 'inherited';
      content += `| \`${a.name}\` | ${a.model || 'inherit'} | ${tools} | ${a.memory || '-'} | ${a.description.split('.')[0]} |\n`;
    }
    content += '\n';
  }

  content += `## Usage

Request delegation explicitly:

\`\`\`
Use the code-reviewer subagent to review my recent changes
Have the debugger subagent investigate this error
\`\`\`

Or let Claude decide based on the task description.

## Configuration

Agent definitions use YAML frontmatter with these fields:
- \`name\` (required): Unique identifier
- \`description\` (required): When to delegate
- \`tools\`: Allowed tools (inherits all if omitted)
- \`model\`: sonnet, opus, haiku, or inherit
- \`permissionMode\`: default, acceptEdits, plan, etc.
- \`maxTurns\`: Maximum agentic turns
- \`skills\`: Skills to preload
- \`memory\`: Persistent memory scope (user, project, local)
- \`hooks\`: Lifecycle hooks scoped to this agent
`;

  return content;
}

// =============================================================================
// v2 Generators: Skills
// =============================================================================

/**
 * Generate skills in Claude Code v2.1.37 SKILL.md format
 */
async function generateSkillsV2(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptionsV2
): Promise<void> {
  const skills =
    options.skillsV2 && options.skillsV2.length > 0
      ? options.skillsV2
      : DEFAULT_SKILLS_V2;

  for (const skill of skills) {
    await generateSkillDirectoryV2(structure.directories.skills, skill);
  }

  // Generate skills index
  structure.files.skillsIndex = path.join(
    structure.directories.skills,
    'README.md'
  );
  const indexContent = generateSkillsIndexV2(skills);
  await fs.writeFile(structure.files.skillsIndex, indexContent);
}

/**
 * Generate a single skill directory with SKILL.md and supporting files
 */
async function generateSkillDirectoryV2(
  skillsRoot: string,
  skill: SkillConfigV2
): Promise<void> {
  const skillDir = path.join(skillsRoot, skill.name);
  await fs.ensureDir(skillDir);

  // Generate SKILL.md
  const skillContent = generateSkillMarkdownV2(skill);
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

  // Generate supporting files
  if (skill.supportingFiles) {
    for (const [filePath, fileContent] of Object.entries(
      skill.supportingFiles
    )) {
      const fullPath = path.join(skillDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, fileContent);
    }
  }
}

/**
 * Generate SKILL.md content with proper frontmatter
 */
function generateSkillMarkdownV2(skill: SkillConfigV2): string {
  const frontmatter: Record<string, unknown> = {};

  if (skill.name) {
    frontmatter.name = skill.name;
  }

  if (skill.description) {
    frontmatter.description = skill.description;
  }

  if (skill.argumentHint) {
    frontmatter['argument-hint'] = skill.argumentHint;
  }

  if (skill.disableModelInvocation) {
    frontmatter['disable-model-invocation'] = true;
  }

  if (skill.userInvocable === false) {
    frontmatter['user-invocable'] = false;
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter['allowed-tools'] = skill.allowedTools.join(', ');
  }

  if (skill.model) {
    frontmatter.model = skill.model;
  }

  if (skill.context) {
    frontmatter.context = skill.context;
  }

  if (skill.agent) {
    frontmatter.agent = skill.agent;
  }

  if (skill.hooks) {
    frontmatter.hooks = skill.hooks;
  }

  let content = '---\n';
  content += serializeYamlFrontmatter(frontmatter);
  content += '---\n\n';
  content += skill.instructions;
  content += '\n';

  return content;
}

/**
 * Generate skills index README for v2 skills
 */
function generateSkillsIndexV2(skills: SkillConfigV2[]): string {
  let content = `# Available Skills

Skills extend what Claude can do. They follow the Agent Skills open standard
with Claude Code extensions for invocation control and subagent execution.

## Skills

| Skill | Invocation | Context | Description |
|-------|-----------|---------|-------------|
`;

  for (const skill of skills) {
    const invocation = skill.disableModelInvocation
      ? 'User only'
      : skill.userInvocable === false
        ? 'Claude only'
        : 'Both';
    const context = skill.context === 'fork' ? 'fork' : 'inline';
    content += `| \`${skill.name}\` | ${invocation} | ${context} | ${skill.description.split('.')[0]} |\n`;
  }

  content += `
## Usage

Invoke a skill directly:

\`\`\`
/code-review
/fix-issue 123
/deploy production
\`\`\`

Or let Claude invoke them automatically based on their descriptions.

## Skill Structure

Each skill is a directory with SKILL.md as the entry point:

\`\`\`
skill-name/
  SKILL.md           # Required - instructions and frontmatter
  reference.md       # Optional - detailed reference
  examples/          # Optional - example outputs
  scripts/           # Optional - helper scripts
\`\`\`

## Frontmatter Fields

- \`name\`: Skill identifier (becomes /slash-command)
- \`description\`: When to use this skill
- \`argument-hint\`: Autocomplete hint, e.g. "[issue-number]"
- \`disable-model-invocation\`: Prevent auto-triggering
- \`user-invocable\`: Hide from / menu
- \`allowed-tools\`: Tools allowed without permission
- \`model\`: Override model
- \`context\`: "fork" to run in a subagent
- \`agent\`: Subagent type for context: fork
`;

  return content;
}

// =============================================================================
// v2 Generators: Settings
// =============================================================================

/**
 * Generate settings.json in Claude Code v2.1.37 format
 */
async function generateSettingsV2(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptionsV2
): Promise<void> {
  const settings: ClaudeSettingsV2 = {};

  // Environment variables
  const env: Record<string, string> = { ...options.settingsEnv };
  if (options.enableAgentTeams) {
    env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
  }
  if (Object.keys(env).length > 0) {
    settings.env = env;
  }

  // Permissions
  const allow = options.permissionAllow || generateDefaultPermissions(options);
  const deny = options.permissionDeny || [
    'Bash(rm -rf /)',
    'Bash(curl * | bash)',
    'Bash(wget * | sh)',
  ];
  settings.permissions = { allow, deny };

  // Hooks
  settings.hooks = options.hooksConfig || generateDefaultHooks(options);

  // Co-authored-by
  settings.includeCoAuthoredBy = true;

  // MCP servers
  if (options.mcpServers && options.mcpServers.length > 0) {
    settings.enabledMcpjsonServers = options.mcpServers;
  }

  // Teammate mode
  if (options.teammateMode) {
    settings.teammateMode = options.teammateMode;
  }

  await fs.writeJson(structure.files.settings, settings, { spaces: 2 });
}

/**
 * Generate default permission allow rules based on project type
 */
function generateDefaultPermissions(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): string[] {
  const permissions = [
    'Bash(npm run lint)',
    'Bash(npm run test *)',
    'Bash(npm test *)',
    'Bash(git status)',
    'Bash(git diff *)',
    'Bash(git log *)',
    'Bash(git add *)',
    'Bash(git commit *)',
    'Bash(git push)',
    'Bash(git branch *)',
    'Bash(git checkout *)',
    'Bash(git stash *)',
    'Bash(ls *)',
    'Bash(pwd)',
    'Bash(which *)',
    'Bash(node *)',
    'Bash(jq *)',
  ];

  // Add project-type-specific permissions
  switch (options.projectType) {
    case 'python':
      permissions.push(
        'Bash(python *)',
        'Bash(pip *)',
        'Bash(pytest *)',
        'Bash(ruff *)'
      );
      break;
    case 'go':
      permissions.push(
        'Bash(go build *)',
        'Bash(go test *)',
        'Bash(go run *)',
        'Bash(go mod *)'
      );
      break;
    case 'rust':
      permissions.push(
        'Bash(cargo build *)',
        'Bash(cargo test *)',
        'Bash(cargo run *)',
        'Bash(cargo clippy *)'
      );
      break;
    case 'java':
      permissions.push('Bash(mvn *)', 'Bash(gradle *)', 'Bash(java *)');
      break;
    default:
      // node/react/vue/monorepo
      permissions.push('Bash(npx *)', 'Bash(npm run build *)', 'Bash(tsc *)');
      break;
  }

  return permissions;
}

// =============================================================================
// v2 Generators: Rules
// =============================================================================

/**
 * Generate .claude/rules/ directory with modular, path-scoped rules
 */
async function generateRulesDirectory(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptionsV2
): Promise<void> {
  const rules =
    options.rules && options.rules.length > 0
      ? options.rules
      : generateDefaultRules(options);

  for (const rule of rules) {
    const ruleDir = rule.subdirectory
      ? path.join(structure.directories.rules, rule.subdirectory)
      : structure.directories.rules;
    await fs.ensureDir(ruleDir);

    let content = '';
    if (rule.paths && rule.paths.length > 0) {
      content += '---\npaths:\n';
      for (const p of rule.paths) {
        content += `  - "${p}"\n`;
      }
      content += '---\n\n';
    }
    content += rule.content;

    await fs.writeFile(path.join(ruleDir, `${rule.name}.md`), content);
  }
}

// =============================================================================
// v2 Generators: Memory Templates
// =============================================================================

/**
 * Generate CLAUDE.md project memory and MEMORY.md auto-memory template
 */
async function generateMemoryTemplates(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptionsV2
): Promise<void> {
  // Generate .claude/CLAUDE.md (project memory)
  const projectMemory =
    options.projectMemory || generateDefaultProjectMemory(options);
  await fs.writeFile(structure.files.projectMemory, projectMemory);

  // Generate CLAUDE.local.md template
  const localMemory = `# Personal Project Preferences

<!-- This file is for your personal project-specific preferences. -->
<!-- It is automatically gitignored. -->

## Local Environment
<!-- Your sandbox URLs, preferred test data, local tool paths, etc. -->

## Personal Workflow
<!-- Your preferred development workflow and shortcuts -->
`;
  await fs.writeFile(structure.files.localMemory, localMemory);

  // Generate MEMORY.md template in the memory directory
  const memoryMd = `# Project Memory

<!-- Auto-maintained by Claude. Keep under 200 lines. -->
<!-- Move detailed notes to separate files in this directory. -->

## Project Patterns
<!-- Build commands, test conventions, code style preferences -->

## Key Commands
<!-- Frequently used build/test/deploy commands -->

## Architecture Notes
<!-- Key files, module relationships, important abstractions -->

## Debugging Insights
<!-- Solutions to tricky problems, common error causes -->
`;
  await fs.writeFile(
    path.join(structure.directories.memory, 'MEMORY.md'),
    memoryMd
  );
}

/**
 * Generate default CLAUDE.md content
 */
function generateDefaultProjectMemory(
  options: EnhancedProjectOptions | EnhancedProjectOptionsV2
): string {
  return `# ${options.projectName}

## Project Overview

Type: ${options.projectType}

## Key Commands

- Build: \`npm run build\`
- Test: \`npm test\`
- Lint: \`npm run lint\`
- Type check: \`npm run typecheck\`

## Architecture

<!-- Document key architectural decisions here -->

## Conventions

- See \`.claude/rules/\` for detailed coding standards
- See \`.claude/agents/\` for available subagents
- See \`.claude/skills/\` for available skills

## Important Notes

- Always verify changes with actual commands before claiming completion
- Run tests after making changes
- Follow the project's established patterns
`;
}

// =============================================================================
// v2 Generators: Hook Scripts
// =============================================================================

/**
 * Generate shell scripts referenced by hook configuration
 */
async function generateHookScripts(
  structure: ClaudeCodeStructure,
  _options: EnhancedProjectOptionsV2
): Promise<void> {
  // validate-bash.sh: blocks dangerous shell commands
  const validateBash = `#!/bin/bash
# validate-bash.sh - Validates Bash commands for safety
# Called by PreToolUse hook. Reads JSON from stdin.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block destructive commands
if echo "$COMMAND" | grep -qE '\\brm\\s+-rf\\s+/'; then
  echo "Blocked: Destructive command targeting root filesystem" >&2
  exit 2
fi

# Block pipe-to-shell patterns
if echo "$COMMAND" | grep -qE 'curl.*\\|.*bash|wget.*\\|.*sh'; then
  echo "Blocked: Pipe-to-shell pattern detected" >&2
  exit 2
fi

# Block eval of untrusted input
if echo "$COMMAND" | grep -qE '\\beval\\b'; then
  echo "Blocked: eval usage detected" >&2
  exit 2
fi

exit 0
`;
  const validateBashPath = path.join(
    structure.directories.hooks,
    'validate-bash.sh'
  );
  await fs.writeFile(validateBashPath, validateBash);
  await fs.chmod(validateBashPath, 0o755);

  // post-edit.sh: runs linting after file edits
  const postEdit = `#!/bin/bash
# post-edit.sh - Runs checks after file edits
# Called by PostToolUse hook for Write|Edit events. Reads JSON from stdin.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only run checks on source files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    # Run linter if available (non-blocking)
    if command -v npx &> /dev/null && [ -f "package.json" ]; then
      npx eslint --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
  *.py)
    if command -v ruff &> /dev/null; then
      ruff check --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
`;
  const postEditPath = path.join(structure.directories.hooks, 'post-edit.sh');
  await fs.writeFile(postEditPath, postEdit);
  await fs.chmod(postEditPath, 0o755);
}

// =============================================================================
// v1 Generators (backward compatibility)
// =============================================================================

/**
 * Generate agent definition files (v1 format)
 */
async function generateAgents(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions
): Promise<void> {
  const agentsToGenerate: AgentConfig[] = [];

  agentsToGenerate.push(...DEFAULT_AGENTS.core);

  if (options.includeHooks) {
    agentsToGenerate.push(...DEFAULT_AGENTS.github);
  }

  agentsToGenerate.push(...DEFAULT_AGENTS.testing);
  agentsToGenerate.push(...DEFAULT_AGENTS.devops);

  if (options.agents) {
    agentsToGenerate.push(...options.agents);
  }

  // Create category directories
  const categories = new Set(agentsToGenerate.map(a => a.category));
  for (const category of categories) {
    await fs.ensureDir(path.join(structure.directories.agents, category));
  }

  for (const agent of agentsToGenerate) {
    const agentContent = generateAgentMarkdown(agent, options);
    const agentPath = path.join(
      structure.directories.agents,
      agent.category,
      `${agent.id}.md`
    );
    await fs.writeFile(agentPath, agentContent);
  }

  const indexContent = generateAgentIndex(agentsToGenerate, options);
  await fs.writeFile(structure.files.agentIndex, indexContent);
}

function generateAgentMarkdown(
  agent: AgentConfig,
  options: EnhancedProjectOptions
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

function generateAgentIndex(
  agents: AgentConfig[],
  options: EnhancedProjectOptions
): string {
  const byCategory = agents.reduce(
    (acc, agent) => {
      if (!acc[agent.category]) {
        acc[agent.category] = [];
      }
      acc[agent.category].push(agent);
      return acc;
    },
    {} as Record<string, AgentConfig[]>
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

// =============================================================================
// v1 Generators: Skills
// =============================================================================

async function generateDefaultSkills(
  structure: ClaudeCodeStructure
): Promise<void> {
  for (const skill of DEFAULT_SKILLS) {
    const skillPath = path.join(structure.directories.skills, `${skill.id}.md`);
    const content = generateSkillMarkdown(skill);
    await fs.writeFile(skillPath, content);
  }

  const indexContent = generateSkillsIndex(DEFAULT_SKILLS);
  await fs.writeFile(
    path.join(structure.directories.skills, 'README.md'),
    indexContent
  );
}

async function generateSkills(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions
): Promise<void> {
  const skills = [...DEFAULT_SKILLS, ...(options.skills || [])];

  for (const skill of skills) {
    const skillPath = path.join(structure.directories.skills, `${skill.id}.md`);
    const content = generateSkillMarkdown(skill);
    await fs.writeFile(skillPath, content);
  }

  const indexContent = generateSkillsIndex(skills);
  await fs.writeFile(structure.files.skillsIndex!, indexContent);
}

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

function generateSkillsIndex(skills: SkillConfig[]): string {
  const byCategory = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, SkillConfig[]>
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

// =============================================================================
// v1 Generators: Commands
// =============================================================================

async function generateDefaultCommands(
  structure: ClaudeCodeStructure
): Promise<void> {
  // Create command category directories
  const categories = new Set(DEFAULT_COMMANDS.map(c => c.category));
  for (const category of categories) {
    await fs.ensureDir(path.join(structure.directories.commands, category));
  }

  for (const command of DEFAULT_COMMANDS) {
    const commandPath = path.join(
      structure.directories.commands,
      command.category,
      `${command.name}.md`
    );
    await fs.writeFile(commandPath, command.content);
  }

  const indexContent = generateCommandsIndex(DEFAULT_COMMANDS);
  await fs.writeFile(
    path.join(structure.directories.commands, 'README.md'),
    indexContent
  );
}

async function generateCommands(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions
): Promise<void> {
  const commands = [...DEFAULT_COMMANDS, ...(options.commands || [])];

  for (const command of commands) {
    const commandPath = path.join(
      structure.directories.commands,
      command.category,
      `${command.name}.md`
    );
    await fs.ensureDir(path.dirname(commandPath));
    await fs.writeFile(commandPath, command.content);
  }

  const indexContent = generateCommandsIndex(commands);
  await fs.writeFile(structure.files.commandsIndex!, indexContent);
}

function generateCommandsIndex(commands: CommandConfig[]): string {
  const byCategory = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandConfig[]>
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

// =============================================================================
// v1 Generators: Settings
// =============================================================================

async function generateSettings(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions
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

  const defaultAgentIds = DEFAULT_AGENTS.core.map(a => a.id);
  const customAgentIds = options.agents?.map(a => a.id) || [];
  settings.agents = {
    defaultAgents: defaultAgentIds,
    customAgents: customAgentIds,
  };

  await fs.writeJson(structure.files.settings, settings, { spaces: 2 });
}

// =============================================================================
// v1 Generators: Memory
// =============================================================================

async function generateMemoryStructure(
  structure: ClaudeCodeStructure,
  options: EnhancedProjectOptions
): Promise<void> {
  const memoryDir = structure.directories.memory;
  const architecture = options.memoryConfig?.architecture || 'basic';

  if (architecture === 'basic') {
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
`
    );
  } else if (architecture === 'tiered' || architecture === 'memgpt') {
    await fs.ensureDir(path.join(memoryDir, 'sessions'));
    await fs.ensureDir(path.join(memoryDir, 'shared'));
    const sessionTemplateDir = path.join(memoryDir, 'session-template');
    await fs.ensureDir(sessionTemplateDir);

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
`
    );

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
`
    );

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
`
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
`
    );
  }

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
`
  );
}

// =============================================================================
// Exports
// =============================================================================

export default generateClaudeCodeStructure;
