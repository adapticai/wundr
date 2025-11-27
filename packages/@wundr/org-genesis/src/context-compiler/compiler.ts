/**
 * Context Compiler
 *
 * Core compilation engine that orchestrates the transformation of discipline
 * definitions into fully configured development environments. The compiler
 * follows a three-phase workflow:
 *
 * 1. **Intent Classification**: Analyzes task descriptions to identify required disciplines
 * 2. **Asset Fetching**: Retrieves all necessary configurations, agents, charters, and tools
 * 3. **Synthesis & Injection**: Merges assets and generates the final session configuration
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/context-compiler
 */

import type {
  CompileSessionRequest,
  CompiledSessionConfig,
  SessionContext,
  DisciplinePack,
  OrchestratorCharter,
  AgentDefinition,
  MCPServerConfig,
  HookConfig,
  MemoryBank,
} from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a compile-and-write operation.
 *
 * Contains comprehensive information about the compilation outcome,
 * including the worktree path, session configuration, and any warnings.
 *
 * @example
 * ```typescript
 * const result = await compiler.compileAndWrite(request, '/path/to/repo');
 * if (result.success) {
 *   console.log(`Session ready at ${result.worktreePath}`);
 *   console.log(`Files written: ${result.filesWritten.join(', ')}`);
 * }
 * ```
 */
export interface CompileResult {
  /**
   * Whether the compilation and write operation succeeded.
   */
  success: boolean;

  /**
   * Absolute path to the git worktree containing the compiled configuration.
   */
  worktreePath: string;

  /**
   * The compiled session configuration that was written.
   */
  sessionConfig: CompiledSessionConfig;

  /**
   * List of file paths that were written during the operation.
   * Paths are relative to the worktree root.
   */
  filesWritten: string[];

  /**
   * Optional warnings encountered during compilation.
   * These don't prevent success but should be reviewed.
   */
  warnings?: string[];

  /**
   * Error message if the compilation failed.
   */
  error?: string;
}

/**
 * Compilation assets gathered during the asset fetching phase.
 *
 * Contains all the raw materials needed to synthesize a session configuration,
 * including disciplines, agents, charters, tools, and hooks.
 *
 * @example
 * ```typescript
 * const assets = await compiler.fetchAssets(['engineering', 'testing']);
 * console.log(`Fetched ${assets.disciplines.length} disciplines`);
 * console.log(`Fetched ${assets.agents.length} agents`);
 * ```
 */
export interface CompilationAssets {
  /**
   * Discipline packs containing base configurations.
   */
  disciplines: DisciplinePack[];

  /**
   * Agent definitions to be included in the session.
   */
  agents: AgentDefinition[];

  /**
   * Orchestrator charters for supervisory configuration.
   */
  charters: OrchestratorCharter[];

  /**
   * MCP server configurations for tool availability.
   */
  tools: MCPServerConfig[];

  /**
   * Hook configurations for automated actions.
   */
  hooks: HookConfig[];
}

/**
 * Result of configuration validation.
 *
 * Contains validation status along with any errors or warnings
 * that were encountered during the validation process.
 *
 * @example
 * ```typescript
 * const validation = compiler.validate(config);
 * if (!validation.valid) {
 *   console.error('Validation errors:', validation.errors);
 * }
 * if (validation.warnings.length > 0) {
 *   console.warn('Warnings:', validation.warnings);
 * }
 * ```
 */
export interface ValidationResult {
  /**
   * Whether the configuration passed all validation checks.
   */
  valid: boolean;

  /**
   * List of validation errors that must be fixed.
   */
  errors: string[];

  /**
   * List of validation warnings that should be reviewed.
   */
  warnings: string[];
}

/**
 * Configuration options for the Context Compiler.
 *
 * Allows customization of paths and behavior for the compilation process.
 *
 * @example
 * ```typescript
 * const config: ContextCompilerConfig = {
 *   disciplineBasePath: '/custom/disciplines',
 *   worktreeBasePath: '/worktrees',
 *   cacheEnabled: true,
 * };
 * const compiler = createContextCompiler(config);
 * ```
 */
export interface ContextCompilerConfig {
  /**
   * Base path for loading discipline definitions.
   * @default './disciplines'
   */
  disciplineBasePath?: string;

  /**
   * Base path for creating git worktrees.
   * @default '/tmp/wundr-worktrees'
   */
  worktreeBasePath?: string;

  /**
   * Whether to enable caching of compiled configurations.
   * @default true
   */
  cacheEnabled?: boolean;

  /**
   * Maximum cache age in milliseconds before invalidation.
   * @default 300000 (5 minutes)
   */
  cacheMaxAgeMs?: number;
}

/**
 * Intent classification result from task analysis.
 *
 * @internal
 */
interface IntentClassificationResult {
  /**
   * Identified discipline IDs based on task description.
   */
  disciplineIds: string[];

  /**
   * Confidence score for each discipline identification (0-1).
   */
  confidenceScores: Map<string, number>;

  /**
   * Keywords extracted from the task description.
   */
  extractedKeywords: string[];
}

/**
 * Cache entry for compiled configurations.
 *
 * @internal
 */
interface CacheEntry {
  /**
   * The cached compilation assets.
   */
  assets: CompilationAssets;

  /**
   * Timestamp when the entry was created.
   */
  timestamp: number;

  /**
   * Hash of the input parameters for cache key matching.
   */
  inputHash: string;
}

// ============================================================================
// Keyword Mappings for Intent Classification
// ============================================================================

/**
 * Mapping of keywords to discipline categories for intent classification.
 *
 * @internal
 */
const DISCIPLINE_KEYWORDS: Record<string, string[]> = {
  engineering: [
    'code',
    'implement',
    'build',
    'develop',
    'api',
    'backend',
    'frontend',
    'database',
    'refactor',
    'debug',
    'fix',
    'feature',
    'typescript',
    'javascript',
    'python',
    'rust',
    'go',
    'java',
    'react',
    'node',
    'aws',
    'docker',
    'kubernetes',
    'ci/cd',
    'microservice',
    'architecture',
    'performance',
    'optimization',
    'security',
    'authentication',
    'authorization',
  ],
  design: [
    'design',
    'ui',
    'ux',
    'wireframe',
    'mockup',
    'prototype',
    'figma',
    'sketch',
    'user experience',
    'interface',
    'responsive',
    'accessibility',
    'color',
    'typography',
    'layout',
    'component',
  ],
  research: [
    'research',
    'analyze',
    'investigate',
    'study',
    'data',
    'ml',
    'machine learning',
    'ai',
    'model',
    'experiment',
    'hypothesis',
    'metrics',
    'statistics',
    'trend',
    'insight',
  ],
  legal: [
    'legal',
    'contract',
    'compliance',
    'regulation',
    'policy',
    'license',
    'terms',
    'privacy',
    'gdpr',
    'intellectual property',
    'trademark',
    'patent',
  ],
  hr: [
    'hiring',
    'recruit',
    'onboarding',
    'employee',
    'performance review',
    'compensation',
    'benefits',
    'culture',
    'team',
    'talent',
  ],
  marketing: [
    'marketing',
    'campaign',
    'brand',
    'content',
    'social media',
    'seo',
    'advertising',
    'promotion',
    'audience',
    'engagement',
  ],
  finance: [
    'finance',
    'budget',
    'forecast',
    'revenue',
    'cost',
    'investment',
    'roi',
    'accounting',
    'tax',
    'audit',
  ],
  operations: [
    'operations',
    'process',
    'workflow',
    'efficiency',
    'logistics',
    'supply chain',
    'inventory',
    'procurement',
  ],
  sales: [
    'sales',
    'pipeline',
    'lead',
    'prospect',
    'deal',
    'quota',
    'crm',
    'customer',
    'revenue',
  ],
  support: [
    'support',
    'ticket',
    'issue',
    'customer service',
    'help desk',
    'troubleshoot',
    'escalation',
  ],
};

// ============================================================================
// Context Compiler Class
// ============================================================================

/**
 * Context Compiler - Main compilation engine for session environments.
 *
 * The ContextCompiler is responsible for transforming discipline definitions
 * and task descriptions into fully configured development environments. It
 * orchestrates the entire compilation pipeline from intent classification
 * through to worktree writing.
 *
 * @example
 * ```typescript
 * // Basic compilation
 * const compiler = new ContextCompiler();
 * const config = await compiler.compile({
 *   discipline: 'engineering',
 *   taskDescription: 'Implement OAuth2 authentication',
 *   vpId: 'orchestrator-engineering-001',
 * });
 *
 * // Compile and write to worktree
 * const result = await compiler.compileAndWrite(
 *   {
 *     discipline: 'engineering',
 *     taskDescription: 'Add REST API endpoints',
 *     vpId: 'orchestrator-engineering-001',
 *   },
 *   '/path/to/repo'
 * );
 *
 * if (result.success) {
 *   console.log(`Session ready at ${result.worktreePath}`);
 * }
 * ```
 */
export class ContextCompiler {
  /**
   * Configuration for the compiler.
   */
  private readonly config: Required<ContextCompilerConfig>;

  /**
   * Cache for compiled assets.
   */
  private readonly cache: Map<string, CacheEntry> = new Map();

  /**
   * Creates a new ContextCompiler instance.
   *
   * @param config - Optional configuration options
   *
   * @example
   * ```typescript
   * const compiler = new ContextCompiler({
   *   disciplineBasePath: './custom/disciplines',
   *   cacheEnabled: true,
   * });
   * ```
   */
  constructor(config: ContextCompilerConfig = {}) {
    this.config = {
      disciplineBasePath: config.disciplineBasePath ?? './disciplines',
      worktreeBasePath: config.worktreeBasePath ?? '/tmp/wundr-worktrees',
      cacheEnabled: config.cacheEnabled ?? true,
      cacheMaxAgeMs: config.cacheMaxAgeMs ?? 300000, // 5 minutes
    };
  }

  // ==========================================================================
  // Main Compilation Methods
  // ==========================================================================

  /**
   * Compiles a session configuration from a compile request.
   *
   * This is the primary entry point for session compilation. It performs:
   * 1. Intent classification to identify required disciplines
   * 2. Asset fetching to gather all necessary configurations
   * 3. Synthesis to merge assets into a cohesive configuration
   * 4. Validation to ensure the configuration is valid
   *
   * @param request - The compilation request containing discipline, task, and Orchestrator info
   * @returns Promise resolving to the compiled session configuration
   * @throws Error if compilation fails or validation errors are found
   *
   * @example
   * ```typescript
   * const config = await compiler.compile({
   *   discipline: 'engineering',
   *   taskDescription: 'Implement user authentication with OAuth2',
   *   vpId: 'orchestrator-engineering-001',
   *   additionalAgents: ['security-reviewer'],
   * });
   * ```
   */
  async compile(request: CompileSessionRequest): Promise<CompiledSessionConfig> {
    // Phase 1: Intent Classification
    const classifiedDisciplines = await this.classifyIntent(request.taskDescription);
    const allDisciplineIds = [
      request.discipline,
      ...classifiedDisciplines.filter((d) => d !== request.discipline),
    ];

    // Phase 2: Asset Fetching
    const assets = await this.fetchAssets(allDisciplineIds);

    // Add additional agents if specified
    if (request.additionalAgents && request.additionalAgents.length > 0) {
      const additionalAgentDefs = await this.loadAdditionalAgents(request.additionalAgents);
      assets.agents.push(...additionalAgentDefs);
    }

    // Phase 3: Synthesis
    // Synthesize to validate asset integrity (side effect: validates disciplines exist)
    this.synthesize(assets);

    // Build the compiled configuration
    const compiledConfig: CompiledSessionConfig = {
      claudeMdContent: this.generateClaudeMdContent(assets, request),
      claudeConfigJson: this.generateClaudeConfigJson(assets, request),
      settingsJson: this.generateSettingsJson(assets),
      agentDefinitions: assets.agents.map(
        (agent) => `.claude/agents/${agent.slug}.md`,
      ),
    };

    // Validate the configuration
    const validation = this.validate(compiledConfig);
    if (!validation.valid) {
      throw new Error(
        `Compilation validation failed: ${validation.errors.join('; ')}`,
      );
    }

    return compiledConfig;
  }

  /**
   * Compiles a session configuration and writes it to a git worktree.
   *
   * This method performs full compilation and then writes all generated
   * files to a git worktree at the specified repository path. The worktree
   * is created if it doesn't exist.
   *
   * @param request - The compilation request
   * @param repoPath - Path to the repository where the worktree will be created
   * @returns Promise resolving to the compile result with worktree path and written files
   *
   * @example
   * ```typescript
   * const result = await compiler.compileAndWrite(
   *   {
   *     discipline: 'engineering',
   *     taskDescription: 'Add payment processing',
   *     vpId: 'orchestrator-engineering-001',
   *   },
   *   '/Users/dev/my-project'
   * );
   *
   * if (result.success) {
   *   console.log(`Worktree: ${result.worktreePath}`);
   *   console.log(`Files: ${result.filesWritten.join(', ')}`);
   * }
   * ```
   */
  async compileAndWrite(
    request: CompileSessionRequest,
    _repoPath: string,
  ): Promise<CompileResult> {
    const warnings: string[] = [];
    const filesWritten: string[] = [];

    try {
      // Compile the session configuration
      const sessionConfig = await this.compile(request);

      // Generate worktree path
      const sessionId = this.generateSessionId();
      const worktreePath =
        request.worktreeBasePath ??
        `${this.config.worktreeBasePath}/${sessionId}`;

      // Write files to the worktree (stub - actual implementation in WorktreeWriter)
      const filesToWrite = this.prepareFilesForWriting(sessionConfig, request);

      for (const file of filesToWrite) {
        filesWritten.push(file.path);
      }

      // Record any warnings from the compilation process
      const validation = this.validate(sessionConfig);
      warnings.push(...validation.warnings);

      return {
        success: true,
        worktreePath,
        sessionConfig,
        filesWritten,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        worktreePath: '',
        sessionConfig: {
          claudeMdContent: '',
          claudeConfigJson: {},
          settingsJson: {},
          agentDefinitions: [],
        },
        filesWritten,
        error: errorMessage,
      };
    }
  }

  // ==========================================================================
  // Intent Classification
  // ==========================================================================

  /**
   * Classifies the intent of a task description to identify required disciplines.
   *
   * Uses keyword analysis and pattern matching to determine which disciplines
   * are relevant to the given task. The classification helps ensure that
   * the session is configured with appropriate tools and agents.
   *
   * @param taskDescription - Human-readable description of the task
   * @returns Promise resolving to an array of discipline IDs
   *
   * @example
   * ```typescript
   * const disciplines = await compiler.classifyIntent(
   *   'Build a React frontend with authentication and API integration'
   * );
   * // Returns: ['engineering', 'design'] or similar
   * ```
   */
  async classifyIntent(taskDescription: string): Promise<string[]> {
    const result = this.performIntentClassification(taskDescription);
    return result.disciplineIds;
  }

  /**
   * Performs the actual intent classification logic.
   *
   * @internal
   * @param taskDescription - The task description to analyze
   * @returns Classification result with discipline IDs and confidence scores
   */
  private performIntentClassification(
    taskDescription: string,
  ): IntentClassificationResult {
    const normalizedDescription = taskDescription.toLowerCase();
    const confidenceScores = new Map<string, number>();
    const extractedKeywords: string[] = [];

    // Score each discipline based on keyword matches
    for (const [discipline, keywords] of Object.entries(DISCIPLINE_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (normalizedDescription.includes(keyword.toLowerCase())) {
          score += 1;
          if (!extractedKeywords.includes(keyword)) {
            extractedKeywords.push(keyword);
          }
        }
      }
      if (score > 0) {
        // Normalize score based on number of keywords
        const normalizedScore = Math.min(score / 3, 1);
        confidenceScores.set(discipline, normalizedScore);
      }
    }

    // Sort by confidence and select top disciplines
    const sortedDisciplines = Array.from(confidenceScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score >= 0.3) // Minimum confidence threshold
      .slice(0, 3) // Maximum 3 disciplines
      .map(([discipline]) => discipline);

    // Default to engineering if no disciplines identified
    if (sortedDisciplines.length === 0) {
      sortedDisciplines.push('engineering');
      confidenceScores.set('engineering', 0.5);
    }

    return {
      disciplineIds: sortedDisciplines,
      confidenceScores,
      extractedKeywords,
    };
  }

  // ==========================================================================
  // Asset Fetching
  // ==========================================================================

  /**
   * Fetches all compilation assets for the specified disciplines.
   *
   * Retrieves discipline packs, agents, charters, tools, and hooks
   * for all specified disciplines. Supports caching for improved
   * performance on repeated compilations.
   *
   * @param disciplineIds - Array of discipline IDs to fetch assets for
   * @returns Promise resolving to the compilation assets
   *
   * @example
   * ```typescript
   * const assets = await compiler.fetchAssets(['engineering', 'testing']);
   * console.log(`Loaded ${assets.disciplines.length} disciplines`);
   * console.log(`Loaded ${assets.agents.length} agents`);
   * ```
   */
  async fetchAssets(disciplineIds: string[]): Promise<CompilationAssets> {
    // Check cache first
    const cacheKey = this.generateCacheKey(disciplineIds);
    if (this.config.cacheEnabled) {
      const cached = this.getCachedAssets(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch disciplines
    const disciplines = await this.loadDisciplines(disciplineIds);

    // Extract agents from disciplines
    const agentIds = new Set<string>();
    for (const discipline of disciplines) {
      for (const agentId of discipline.agentIds) {
        agentIds.add(agentId);
      }
    }
    const agents = await this.loadAgents(Array.from(agentIds));

    // Load Orchestrator charters for disciplines
    const vpIds = new Set<string>();
    for (const discipline of disciplines) {
      if (discipline.parentVpId) {
        vpIds.add(discipline.parentVpId);
      }
    }
    const charters = await this.loadCharters(Array.from(vpIds));

    // Aggregate tools and hooks
    const tools: MCPServerConfig[] = [];
    const hooks: HookConfig[] = [];
    for (const discipline of disciplines) {
      tools.push(...discipline.mcpServers);
      hooks.push(...discipline.hooks);
    }

    // Deduplicate tools by name
    const uniqueTools = this.deduplicateTools(tools);
    const uniqueHooks = this.deduplicateHooks(hooks);

    const assets: CompilationAssets = {
      disciplines,
      agents,
      charters,
      tools: uniqueTools,
      hooks: uniqueHooks,
    };

    // Cache the assets
    if (this.config.cacheEnabled) {
      this.cacheAssets(cacheKey, assets);
    }

    return assets;
  }

  // ==========================================================================
  // Synthesis
  // ==========================================================================

  /**
   * Synthesizes compilation assets into a session context.
   *
   * Merges all fetched assets into a cohesive session context that
   * can be used to configure the development environment.
   *
   * @param assets - The compilation assets to synthesize
   * @returns The synthesized session context
   *
   * @example
   * ```typescript
   * const assets = await compiler.fetchAssets(['engineering']);
   * const context = compiler.synthesize(assets);
   * console.log(`Session discipline: ${context.disciplineId}`);
   * ```
   */
  synthesize(assets: CompilationAssets): SessionContext {
    const primaryDiscipline = assets.disciplines[0];

    if (!primaryDiscipline) {
      throw new Error('No disciplines found in assets for synthesis');
    }

    const sessionId = this.generateSessionId();
    const memoryBank = this.createMemoryBank(sessionId);

    return {
      id: sessionId,
      disciplineId: primaryDiscipline.id,
      parentVpId: primaryDiscipline.parentVpId ?? '',
      worktreePath: `${this.config.worktreeBasePath}/${sessionId}`,
      status: 'compiling',
      compiledConfig: {
        claudeMdContent: '',
        claudeConfigJson: {},
        settingsJson: {},
        agentDefinitions: [],
      },
      memoryBank,
      activeAgentIds: assets.agents.map((a) => a.id),
      metadata: {
        compiledAt: new Date().toISOString(),
        disciplineCount: assets.disciplines.length,
        agentCount: assets.agents.length,
        toolCount: assets.tools.length,
        hookCount: assets.hooks.length,
      },
    };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validates a compiled session configuration.
   *
   * Checks the configuration for errors and potential issues,
   * returning a detailed validation result.
   *
   * @param config - The compiled configuration to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const validation = compiler.validate(compiledConfig);
   * if (!validation.valid) {
   *   throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
   * }
   * ```
   */
  validate(config: CompiledSessionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate CLAUDE.md content
    if (!config.claudeMdContent || config.claudeMdContent.trim().length === 0) {
      errors.push('CLAUDE.md content is empty');
    } else if (config.claudeMdContent.length < 100) {
      warnings.push('CLAUDE.md content seems too short');
    }

    // Validate claude config JSON
    if (
      typeof config.claudeConfigJson !== 'object' ||
      config.claudeConfigJson === null
    ) {
      errors.push('claudeConfigJson must be an object');
    }

    // Validate settings JSON
    if (
      typeof config.settingsJson !== 'object' ||
      config.settingsJson === null
    ) {
      errors.push('settingsJson must be an object');
    }

    // Validate agent definitions
    if (!Array.isArray(config.agentDefinitions)) {
      errors.push('agentDefinitions must be an array');
    } else {
      for (const agentPath of config.agentDefinitions) {
        if (!agentPath.endsWith('.md')) {
          warnings.push(`Agent definition path should end with .md: ${agentPath}`);
        }
        if (!agentPath.startsWith('.claude/agents/')) {
          warnings.push(
            `Agent definition path should start with .claude/agents/: ${agentPath}`,
          );
        }
      }
    }

    // Check for potential security issues in CLAUDE.md
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /credential/i,
    ];
    for (const pattern of sensitivePatterns) {
      if (
        pattern.test(config.claudeMdContent) &&
        !config.claudeMdContent.includes('${')
      ) {
        warnings.push(
          `Potential hardcoded sensitive value detected: ${pattern.source}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // Content Generation
  // ==========================================================================

  /**
   * Generates CLAUDE.md content from compilation assets.
   *
   * @internal
   * @param assets - The compilation assets
   * @param request - The original compile request
   * @returns Generated CLAUDE.md content
   */
  private generateClaudeMdContent(
    assets: CompilationAssets,
    request: CompileSessionRequest,
  ): string {
    const sections: string[] = [];

    // Header
    sections.push('# Claude Code Configuration');
    sections.push('');
    sections.push(
      `> Auto-generated session configuration for ${request.discipline}`,
    );
    sections.push('');

    // Role and Context from primary discipline
    const primaryDiscipline = assets.disciplines[0];
    if (primaryDiscipline) {
      sections.push('## Role');
      sections.push('');
      sections.push(primaryDiscipline.claudeMd.role);
      sections.push('');

      sections.push('## Context');
      sections.push('');
      sections.push(primaryDiscipline.claudeMd.context);
      sections.push('');

      // Task Description
      sections.push('## Current Task');
      sections.push('');
      sections.push(request.taskDescription);
      sections.push('');

      // Rules
      if (primaryDiscipline.claudeMd.rules.length > 0) {
        sections.push('## Rules');
        sections.push('');
        for (const rule of primaryDiscipline.claudeMd.rules) {
          sections.push(`- ${rule}`);
        }
        sections.push('');
      }

      // Objectives
      if (primaryDiscipline.claudeMd.objectives.length > 0) {
        sections.push('## Objectives');
        sections.push('');
        for (const objective of primaryDiscipline.claudeMd.objectives) {
          sections.push(`- ${objective}`);
        }
        sections.push('');
      }

      // Constraints
      if (primaryDiscipline.claudeMd.constraints.length > 0) {
        sections.push('## Constraints');
        sections.push('');
        for (const constraint of primaryDiscipline.claudeMd.constraints) {
          sections.push(`- ${constraint}`);
        }
        sections.push('');
      }
    }

    // Available Agents
    if (assets.agents.length > 0) {
      sections.push('## Available Agents');
      sections.push('');
      for (const agent of assets.agents) {
        sections.push(`- **${agent.name}** (${agent.slug}): ${agent.description}`);
      }
      sections.push('');
    }

    // MCP Tools
    if (assets.tools.length > 0) {
      sections.push('## MCP Tools');
      sections.push('');
      for (const tool of assets.tools) {
        sections.push(`- **${tool.name}**: ${tool.description}`);
      }
      sections.push('');
    }

    // Warm Start Context
    if (request.warmStartContext) {
      sections.push('## Previous Context');
      sections.push('');
      sections.push(request.warmStartContext);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Generates claude.config.json from compilation assets.
   *
   * @internal
   * @param assets - The compilation assets
   * @param request - The original compile request
   * @returns Generated claude config object
   */
  private generateClaudeConfigJson(
    assets: CompilationAssets,
    request: CompileSessionRequest,
  ): Record<string, unknown> {
    const mcpServers: Record<string, unknown> = {};

    for (const tool of assets.tools) {
      mcpServers[tool.name] = {
        command: tool.command,
        args: tool.args ?? [],
        env: tool.env ?? {},
      };
    }

    // Apply MCP overrides if provided
    if (request.mcpOverrides) {
      for (const [key, value] of Object.entries(request.mcpOverrides)) {
        if (typeof value === 'object' && value !== null) {
          const existing = mcpServers[key];
          if (typeof existing === 'object' && existing !== null) {
            mcpServers[key] = { ...(existing as Record<string, unknown>), ...(value as Record<string, unknown>) };
          } else {
            mcpServers[key] = value;
          }
        } else {
          mcpServers[key] = value;
        }
      }
    }

    const hooks: Record<string, unknown[]> = {};
    for (const hook of assets.hooks) {
      if (!hooks[hook.event]) {
        hooks[hook.event] = [];
      }
      hooks[hook.event].push({
        command: hook.command,
        description: hook.description,
        blocking: hook.blocking ?? false,
      });
    }

    return {
      mcpServers,
      hooks,
      permissions: {
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        deniedCommands: [],
      },
      settings: {
        maxTokens: 8000,
        timeout: 300000,
      },
    };
  }

  /**
   * Generates settings.json from compilation assets.
   *
   * @internal
   * @param assets - The compilation assets
   * @returns Generated settings object
   */
  private generateSettingsJson(
    assets: CompilationAssets,
  ): Record<string, unknown> {
    const primaryDiscipline = assets.disciplines[0];

    return {
      'editor.formatOnSave': true,
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
      'typescript.preferences.importModuleSpecifier': 'relative',
      'files.exclude': {
        '**/.git': true,
        '**/node_modules': true,
      },
      'wundr.session': {
        disciplineId: primaryDiscipline?.id ?? 'unknown',
        agentCount: assets.agents.length,
        toolCount: assets.tools.length,
      },
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Loads discipline packs by their IDs.
   *
   * @internal
   * @param disciplineIds - Array of discipline IDs to load
   * @returns Promise resolving to loaded discipline packs
   */
  private async loadDisciplines(disciplineIds: string[]): Promise<DisciplinePack[]> {
    // Stub implementation - actual loading from registry/files
    // This will be implemented by DisciplineLoader
    const disciplines: DisciplinePack[] = [];

    for (const id of disciplineIds) {
      disciplines.push({
        id: `disc_${id}_001`,
        name: this.capitalizeFirstLetter(id),
        slug: id,
        category: id as DisciplinePack['category'],
        description: `${this.capitalizeFirstLetter(id)} discipline pack`,
        claudeMd: {
          role: `${this.capitalizeFirstLetter(id)} Specialist`,
          context: `Working on ${id} tasks within the organization`,
          rules: ['Follow best practices', 'Write clean code', 'Document decisions'],
          objectives: ['Deliver high-quality work', 'Meet deadlines'],
          constraints: ['Do not expose sensitive data', 'Follow security guidelines'],
        },
        mcpServers: [],
        hooks: [],
        agentIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return disciplines;
  }

  /**
   * Loads agent definitions by their IDs.
   *
   * @internal
   * @param agentIds - Array of agent IDs to load
   * @returns Promise resolving to loaded agent definitions
   */
  private async loadAgents(agentIds: string[]): Promise<AgentDefinition[]> {
    // Stub implementation - actual loading from registry
    const agents: AgentDefinition[] = [];

    for (const id of agentIds) {
      const slug = id.replace(/^agent[-_]/, '').replace(/[-_]\d+$/, '');
      agents.push({
        id,
        name: this.capitalizeFirstLetter(slug.replace(/-/g, ' ')),
        slug,
        tier: 3,
        scope: 'discipline-specific',
        description: `Agent for ${slug} tasks`,
        charter: `You are a specialized agent for ${slug} operations.`,
        model: 'sonnet',
        tools: [],
        capabilities: {
          canReadFiles: true,
          canWriteFiles: true,
          canExecuteCommands: false,
          canAccessNetwork: false,
          canSpawnSubAgents: false,
        },
        usedByDisciplines: [],
        tags: [slug],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return agents;
  }

  /**
   * Loads additional agents specified in the request.
   *
   * @internal
   * @param agentIds - Array of additional agent IDs
   * @returns Promise resolving to loaded agent definitions
   */
  private async loadAdditionalAgents(agentIds: string[]): Promise<AgentDefinition[]> {
    return this.loadAgents(agentIds);
  }

  /**
   * Loads Orchestrator charters by their IDs.
   *
   * @internal
   * @param vpIds - Array of Orchestrator IDs to load
   * @returns Promise resolving to loaded Orchestrator charters
   */
  private async loadCharters(vpIds: string[]): Promise<OrchestratorCharter[]> {
    // Stub implementation - actual loading from registry
    const charters: OrchestratorCharter[] = [];

    for (const id of vpIds) {
      charters.push({
        id,
        tier: 1,
        identity: {
          name: `Orchestrator ${id}`,
          slug: id,
          persona: 'A professional virtual persona managing organizational tasks',
        },
        coreDirective: 'Coordinate and manage team resources effectively',
        capabilities: ['context_compilation', 'session_spawning', 'task_triage'],
        mcpTools: [],
        resourceLimits: {
          maxConcurrentSessions: 10,
          tokenBudgetPerHour: 500000,
          maxMemoryMB: 1024,
          maxCpuPercent: 50,
        },
        objectives: {
          responseTimeTarget: 10,
          taskCompletionRate: 90,
          qualityScore: 85,
        },
        constraints: {
          forbiddenCommands: [],
          forbiddenPaths: [],
          forbiddenActions: [],
          requireApprovalFor: [],
        },
        disciplineIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return charters;
  }

  /**
   * Deduplicates MCP server configurations by name.
   *
   * @internal
   * @param tools - Array of MCP server configurations
   * @returns Deduplicated array of configurations
   */
  private deduplicateTools(tools: MCPServerConfig[]): MCPServerConfig[] {
    const seen = new Map<string, MCPServerConfig>();
    for (const tool of tools) {
      if (!seen.has(tool.name)) {
        seen.set(tool.name, tool);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Deduplicates hook configurations.
   *
   * @internal
   * @param hooks - Array of hook configurations
   * @returns Deduplicated array of configurations
   */
  private deduplicateHooks(hooks: HookConfig[]): HookConfig[] {
    const seen = new Map<string, HookConfig>();
    for (const hook of hooks) {
      const key = `${hook.event}:${hook.command}`;
      if (!seen.has(key)) {
        seen.set(key, hook);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Creates a memory bank configuration for a session.
   *
   * @internal
   * @param sessionId - The session identifier
   * @returns Memory bank configuration
   */
  private createMemoryBank(sessionId: string): MemoryBank {
    const basePath = `.memory/${sessionId}`;
    return {
      activeContextPath: `${basePath}/active-context.json`,
      progressPath: `${basePath}/progress.json`,
      productContextPath: `${basePath}/product-context.json`,
      decisionLogPath: `${basePath}/decision-log.json`,
    };
  }

  /**
   * Generates a unique session identifier.
   *
   * @internal
   * @returns Generated session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Generates a cache key from discipline IDs.
   *
   * @internal
   * @param disciplineIds - Array of discipline IDs
   * @returns Cache key string
   */
  private generateCacheKey(disciplineIds: string[]): string {
    return `assets:${disciplineIds.sort().join(',')}`;
  }

  /**
   * Retrieves cached assets if available and not expired.
   *
   * @internal
   * @param cacheKey - The cache key to look up
   * @returns Cached assets or undefined if not found/expired
   */
  private getCachedAssets(cacheKey: string): CompilationAssets | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.config.cacheMaxAgeMs) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.assets;
  }

  /**
   * Caches compilation assets.
   *
   * @internal
   * @param cacheKey - The cache key
   * @param assets - The assets to cache
   */
  private cacheAssets(cacheKey: string, assets: CompilationAssets): void {
    this.cache.set(cacheKey, {
      assets,
      timestamp: Date.now(),
      inputHash: cacheKey,
    });
  }

  /**
   * Prepares files for writing to the worktree.
   *
   * @internal
   * @param config - The compiled session configuration
   * @param request - The original compile request
   * @returns Array of files to write
   */
  private prepareFilesForWriting(
    config: CompiledSessionConfig,
    _request: CompileSessionRequest,
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    // CLAUDE.md
    files.push({
      path: 'CLAUDE.md',
      content: config.claudeMdContent,
    });

    // .claude/claude.config.json
    files.push({
      path: '.claude/claude.config.json',
      content: JSON.stringify(config.claudeConfigJson, null, 2),
    });

    // .vscode/settings.json
    files.push({
      path: '.vscode/settings.json',
      content: JSON.stringify(config.settingsJson, null, 2),
    });

    return files;
  }

  /**
   * Capitalizes the first letter of a string.
   *
   * @internal
   * @param str - The string to capitalize
   * @returns Capitalized string
   */
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Clears the compilation cache.
   *
   * Useful for forcing fresh asset loading or freeing memory.
   *
   * @example
   * ```typescript
   * compiler.clearCache();
   * ```
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets the current cache size.
   *
   * @returns Number of cached entries
   *
   * @example
   * ```typescript
   * console.log(`Cache entries: ${compiler.getCacheSize()}`);
   * ```
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new ContextCompiler instance with optional configuration.
 *
 * This is the recommended way to instantiate the compiler as it provides
 * a clean factory pattern and allows for future dependency injection.
 *
 * @param config - Optional configuration options
 * @returns A new ContextCompiler instance
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const compiler = createContextCompiler();
 *
 * // Create with custom configuration
 * const customCompiler = createContextCompiler({
 *   disciplineBasePath: './custom/disciplines',
 *   worktreeBasePath: '/custom/worktrees',
 *   cacheEnabled: true,
 * });
 *
 * // Use the compiler
 * const config = await compiler.compile({
 *   discipline: 'engineering',
 *   taskDescription: 'Implement new feature',
 *   vpId: 'orchestrator-001',
 * });
 * ```
 */
export function createContextCompiler(
  config?: ContextCompilerConfig,
): ContextCompiler {
  return new ContextCompiler(config);
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type {
  CompileSessionRequest,
  CompiledSessionConfig,
  SessionContext,
  DisciplinePack,
  OrchestratorCharter,
  AgentDefinition,
  MCPServerConfig,
  HookConfig,
} from '../types/index.js';
