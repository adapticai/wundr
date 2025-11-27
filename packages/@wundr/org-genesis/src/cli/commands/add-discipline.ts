/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Add Discipline Command - Adds a discipline pack under a Orchestrator.
 *
 * This command creates a new discipline pack and associates it with
 * a Orchestrator. Disciplines define domain-specific configurations
 * including CLAUDE.md settings, MCP servers, hooks, and agent mappings.
 *
 * @module cli/commands/add-discipline
 */

import {
  createRegistryManager,
  type RegistryManager,
} from '../../registry/index.js';

import type {
  ClaudeMdConfig,
  DisciplineCategory,
  DisciplinePack,
  HookConfig,
  MCPServerConfig,
  OrchestratorCharter,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Options for the add discipline command.
 *
 * @example
 * ```typescript
 * const options: AddDisciplineOptions = {
 *   name: 'Frontend Development',
 *   category: 'engineering',
 *   description: 'React and TypeScript frontend development',
 *   claudeMd: {
 *     role: 'Frontend Developer',
 *     context: 'Building modern web applications',
 *   },
 * };
 * ```
 */
export interface AddDisciplineOptions {
  /**
   * Human-readable name for the discipline.
   * @required
   */
  name: string;

  /**
   * Category classification for the discipline.
   * @required
   */
  category: DisciplineCategory;

  /**
   * Detailed description of the discipline's purpose.
   */
  description?: string;

  /**
   * CLAUDE.md configuration for AI behavior.
   */
  claudeMd?: Partial<ClaudeMdConfig>;

  /**
   * MCP server configurations for tools.
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Hook configurations for automated actions.
   */
  hooks?: HookConfig[];

  /**
   * IDs of agents to associate with this discipline.
   */
  agentIds?: string[];

  /**
   * Whether to use LLM for generating discipline configuration.
   * @default false
   */
  useLLM?: boolean;

  /**
   * LLM callback for generating configuration.
   */
  llmCallback?: (systemPrompt: string, userPrompt: string) => Promise<string>;

  /**
   * Run in dry-run mode without persisting changes.
   * @default false
   */
  dryRun?: boolean;

  /**
   * Output format for the command result.
   * @default 'text'
   */
  outputFormat?: 'text' | 'json';

  /**
   * Path to the registry storage.
   * @default './.wundr/registry'
   */
  registryPath?: string;
}

/**
 * Result returned from the add discipline operation.
 */
export interface AddDisciplineResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * The created discipline pack, if successful.
   */
  discipline?: DisciplinePack;

  /**
   * Error message if the operation failed.
   */
  error?: string;

  /**
   * Warnings encountered during the operation.
   */
  warnings: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Valid discipline categories.
 */
const VALID_CATEGORIES: DisciplineCategory[] = [
  'engineering',
  'legal',
  'hr',
  'marketing',
  'finance',
  'operations',
  'design',
  'research',
  'sales',
  'support',
  'custom',
];

/**
 * Default MCP servers by category.
 */
const DEFAULT_MCP_SERVERS: Record<DisciplineCategory, MCPServerConfig[]> = {
  engineering: [
    {
      name: 'github',
      command: 'npx',
      args: ['@modelcontextprotocol/server-github'],
      description: 'GitHub integration',
    },
    {
      name: 'filesystem',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      description: 'File operations',
    },
  ],
  legal: [
    {
      name: 'document-search',
      command: 'npx',
      args: ['@wundr/mcp-document-search'],
      description: 'Legal document search',
    },
  ],
  hr: [
    {
      name: 'calendar',
      command: 'npx',
      args: ['@wundr/mcp-calendar'],
      description: 'Calendar integration',
    },
  ],
  marketing: [
    {
      name: 'analytics',
      command: 'npx',
      args: ['@wundr/mcp-analytics'],
      description: 'Marketing analytics',
    },
  ],
  finance: [
    {
      name: 'spreadsheet',
      command: 'npx',
      args: ['@wundr/mcp-spreadsheet'],
      description: 'Financial spreadsheet tools',
    },
  ],
  operations: [
    {
      name: 'monitoring',
      command: 'npx',
      args: ['@wundr/mcp-monitoring'],
      description: 'Operations monitoring',
    },
  ],
  design: [
    {
      name: 'figma',
      command: 'npx',
      args: ['@wundr/mcp-figma'],
      description: 'Figma integration',
    },
  ],
  research: [
    {
      name: 'web-search',
      command: 'npx',
      args: ['@modelcontextprotocol/server-brave-search'],
      description: 'Web research',
    },
  ],
  sales: [
    {
      name: 'crm',
      command: 'npx',
      args: ['@wundr/mcp-crm'],
      description: 'CRM integration',
    },
  ],
  support: [
    {
      name: 'ticketing',
      command: 'npx',
      args: ['@wundr/mcp-ticketing'],
      description: 'Support ticket system',
    },
  ],
  custom: [],
};

/**
 * Default CLAUDE.md configurations by category.
 */
const DEFAULT_CLAUDE_MD: Record<DisciplineCategory, ClaudeMdConfig> = {
  engineering: {
    role: 'Software Engineer',
    context: 'Building and maintaining high-quality software systems',
    rules: [
      'Follow coding standards',
      'Write tests for all changes',
      'Review code before committing',
    ],
    objectives: [
      'Deliver reliable features',
      'Maintain code quality',
      'Support team collaboration',
    ],
    constraints: [
      'No direct production access',
      'Require PR approval for merges',
    ],
  },
  legal: {
    role: 'Legal Assistant',
    context: 'Supporting legal operations and compliance',
    rules: [
      'Maintain confidentiality',
      'Cite sources accurately',
      'Flag compliance risks',
    ],
    objectives: ['Support contract review', 'Ensure regulatory compliance'],
    constraints: [
      'Never provide final legal advice',
      'Escalate complex matters',
    ],
  },
  hr: {
    role: 'HR Specialist',
    context: 'Supporting human resources and people operations',
    rules: ['Maintain employee privacy', 'Follow labor regulations'],
    objectives: ['Support talent management', 'Improve employee experience'],
    constraints: ['Protect PII', 'Escalate sensitive matters'],
  },
  marketing: {
    role: 'Marketing Specialist',
    context: 'Creating and executing marketing campaigns',
    rules: ['Follow brand guidelines', 'Track campaign metrics'],
    objectives: ['Drive engagement', 'Support brand awareness'],
    constraints: ['Respect advertising regulations', 'Protect customer data'],
  },
  finance: {
    role: 'Financial Analyst',
    context: 'Supporting financial analysis and reporting',
    rules: ['Ensure calculation accuracy', 'Follow accounting standards'],
    objectives: ['Provide accurate reports', 'Support financial decisions'],
    constraints: [
      'Protect financial data',
      'Require approval for transactions',
    ],
  },
  operations: {
    role: 'Operations Specialist',
    context: 'Managing business operations and processes',
    rules: ['Follow operational procedures', 'Document all changes'],
    objectives: ['Optimize processes', 'Ensure operational continuity'],
    constraints: ['Require approval for system changes'],
  },
  design: {
    role: 'Product Designer',
    context: 'Creating user-centered design solutions',
    rules: ['Follow design system', 'Prioritize accessibility'],
    objectives: ['Improve user experience', 'Maintain design consistency'],
    constraints: ['Validate with user research'],
  },
  research: {
    role: 'Research Analyst',
    context: 'Conducting research and analysis',
    rules: ['Verify sources', 'Document methodology'],
    objectives: ['Provide accurate insights', 'Support decision-making'],
    constraints: ['Cite all sources', 'Acknowledge limitations'],
  },
  sales: {
    role: 'Sales Specialist',
    context: 'Supporting sales operations and customer engagement',
    rules: ['Maintain CRM accuracy', 'Follow sales process'],
    objectives: ['Support revenue growth', 'Improve customer relationships'],
    constraints: ['Protect customer data', 'Follow pricing guidelines'],
  },
  support: {
    role: 'Customer Support Specialist',
    context: 'Providing excellent customer support',
    rules: ['Follow support protocols', 'Document all interactions'],
    objectives: ['Resolve issues quickly', 'Improve customer satisfaction'],
    constraints: ['Escalate complex issues', 'Protect customer privacy'],
  },
  custom: {
    role: 'Specialist',
    context: 'Supporting organizational objectives',
    rules: ['Follow established procedures'],
    objectives: ['Deliver quality results'],
    constraints: ['Escalate when uncertain'],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generates a URL-safe slug from a name.
 *
 * @param name - The name to convert
 * @returns URL-safe slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates a unique discipline ID.
 *
 * @param slug - The discipline slug
 * @returns Unique discipline ID
 */
function generateDisciplineId(slug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `disc-${slug}-${timestamp}${random}`;
}

/**
 * Validates the add discipline options.
 *
 * @param options - The options to validate
 * @returns Array of validation errors
 */
function validateOptions(options: AddDisciplineOptions): string[] {
  const errors: string[] = [];

  if (!options.name || options.name.trim().length === 0) {
    errors.push('Discipline name is required');
  }

  if (options.name && options.name.length > 100) {
    errors.push('Discipline name must be 100 characters or less');
  }

  if (!options.category) {
    errors.push('Discipline category is required');
  } else if (!VALID_CATEGORIES.includes(options.category)) {
    errors.push(
      `Invalid category: ${options.category}. Valid categories: ${VALID_CATEGORIES.join(', ')}`
    );
  }

  return errors;
}

/**
 * Merges user-provided CLAUDE.md config with defaults.
 *
 * @param category - The discipline category
 * @param userConfig - User-provided configuration
 * @returns Merged configuration
 */
function mergeClaudeMdConfig(
  category: DisciplineCategory,
  userConfig?: Partial<ClaudeMdConfig>
): ClaudeMdConfig {
  const defaults = DEFAULT_CLAUDE_MD[category];
  return {
    role: userConfig?.role ?? defaults.role,
    context: userConfig?.context ?? defaults.context,
    rules: userConfig?.rules ?? defaults.rules,
    objectives: userConfig?.objectives ?? defaults.objectives,
    constraints: userConfig?.constraints ?? defaults.constraints,
  };
}

/**
 * Formats the result as text output.
 *
 * @param result - The add discipline result
 */
function formatTextOutput(result: AddDisciplineResult): void {
  if (result.success && result.discipline) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  Discipline Created Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Discipline Details');
    console.log('  ' + '-'.repeat(40));
    console.log(`  ID:          ${result.discipline.id}`);
    console.log(`  Name:        ${result.discipline.name}`);
    console.log(`  Slug:        ${result.discipline.slug}`);
    console.log(`  Category:    ${result.discipline.category}`);
    console.log(`  Description: ${result.discipline.description || '(none)'}`);
    console.log('');
    console.log('  CLAUDE.md Configuration');
    console.log('  ' + '-'.repeat(40));
    console.log(`  Role:    ${result.discipline.claudeMd.role}`);
    console.log(`  Context: ${result.discipline.claudeMd.context}`);
    console.log('');
    console.log('  MCP Servers');
    console.log('  ' + '-'.repeat(40));
    if (result.discipline.mcpServers.length > 0) {
      result.discipline.mcpServers.forEach(server => {
        console.log(`  - ${server.name}: ${server.description}`);
      });
    } else {
      console.log('  (none configured)');
    }
    console.log('');

    if (result.warnings.length > 0) {
      console.log('  Warnings');
      console.log('  ' + '-'.repeat(40));
      result.warnings.forEach(warning => {
        console.log(`  ! ${warning}`);
      });
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('');
  } else {
    console.error('\n  Error creating discipline:');
    console.error(`  ${result.error}`);
    console.error('');
  }
}

/**
 * Formats the result as JSON output.
 *
 * @param result - The add discipline result
 */
function formatJsonOutput(result: AddDisciplineResult): void {
  const output = {
    ...result,
    discipline: result.discipline
      ? {
          ...result.discipline,
          createdAt: result.discipline.createdAt.toISOString(),
          updatedAt: result.discipline.updatedAt.toISOString(),
        }
      : undefined,
  };
  console.log(JSON.stringify(output, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Adds a discipline pack under a Orchestrator.
 *
 * Creates a new discipline with CLAUDE.md configuration, MCP servers,
 * and hooks. The discipline is associated with the specified Orchestrator and
 * optionally persisted to the registry.
 *
 * @param orchestratorId - The Orchestrator ID to add the discipline under
 * @param options - Configuration options for the new discipline
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * // Basic discipline creation
 * const result = await addDisciplineCommand('orchestrator-engineering', {
 *   name: 'Frontend Development',
 *   category: 'engineering',
 * });
 *
 * // With custom configuration
 * const result = await addDisciplineCommand('orchestrator-engineering', {
 *   name: 'Backend Services',
 *   category: 'engineering',
 *   description: 'API and microservices development',
 *   claudeMd: {
 *     role: 'Backend Engineer',
 *     context: 'Building scalable APIs and services',
 *   },
 *   mcpServers: [
 *     { name: 'database', command: 'npx', args: ['@wundr/mcp-postgres'], description: 'Database tools' },
 *   ],
 * });
 * ```
 */
export async function addDisciplineCommand(
  orchestratorId: string,
  options: AddDisciplineOptions
): Promise<AddDisciplineResult> {
  const warnings: string[] = [];

  // Validate options
  const validationErrors = validateOptions(options);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: `Validation failed: ${validationErrors.join('; ')}`,
      warnings,
    };
  }

  try {
    // Initialize registry manager
    let registryManager: RegistryManager | undefined;
    if (!options.dryRun) {
      registryManager = createRegistryManager({
        storageType: 'file',
        basePath: options.registryPath ?? './.wundr/registry',
      });
      await registryManager.initialize();

      // Verify Orchestrator exists
      const orchestrator = await registryManager.charters.getVP(orchestratorId);
      if (!vp) {
        return {
          success: false,
          error: `Orchestrator not found: ${orchestratorId}`,
          warnings,
        };
      }
    }

    // Generate discipline identifiers
    const slug = generateSlug(options.name);
    const id = generateDisciplineId(slug);

    // Build CLAUDE.md configuration
    const claudeMd = mergeClaudeMdConfig(options.category, options.claudeMd);

    // Build MCP servers
    const mcpServers =
      options.mcpServers ?? DEFAULT_MCP_SERVERS[options.category] ?? [];

    // Build hooks
    const hooks = options.hooks ?? [];

    // Create discipline pack
    const now = new Date();
    const discipline: DisciplinePack = {
      id,
      name: options.name,
      slug,
      category: options.category,
      description:
        options.description ??
        `${options.name} discipline for ${options.category} operations`,
      claudeMd,
      mcpServers,
      hooks,
      agentIds: options.agentIds ?? [],
      parentVpId: orchestratorId,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to registry if not dry-run
    if (!options.dryRun && registryManager) {
      await registryManager.disciplines.register(discipline);

      // Update Orchestrator to include this discipline
      const orchestrator = await registryManager.charters.getVP(orchestratorId);
      if (vp && !vp.disciplineIds.includes(id)) {
        // Update VP's discipline list and re-register
        const updatedVp: OrchestratorCharter = {
          ...orchestrator,
          disciplineIds: [...orchestrator.disciplineIds, id],
          updatedAt: new Date(),
        };
        await registryManager.charters.registerVP(updatedVp);
      }
    } else if (options.dryRun) {
      warnings.push('Dry-run mode: Discipline was not persisted to registry');
    }

    return {
      success: true,
      discipline,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

/**
 * CLI entry point for the add discipline command.
 *
 * Parses command-line arguments and invokes the addDisciplineCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # Basic usage
 * wundr discipline add orchestrator-engineering --name "Frontend" --category engineering
 *
 * # With all options
 * wundr discipline add orchestrator-engineering \
 *   --name "Backend Services" \
 *   --category engineering \
 *   --description "API development" \
 *   --format json
 * ```
 */
export async function runAddDisciplineCommand(args: string[]): Promise<void> {
  // Parse arguments
  const orchestratorId = args[0];
  if (!orchestratorId) {
    console.error('Error: Orchestrator ID is required');
    console.error(
      'Usage: wundr discipline add <orchestrator-id> --name <name> --category <category> [options]'
    );
    process.exitCode = 1;
    return;
  }

  const options: AddDisciplineOptions = {
    name: '',
    category: 'custom',
    outputFormat: 'text',
  };

  // Parse flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--name':
      case '-n':
        options.name = nextArg ?? '';
        i++;
        break;
      case '--category':
      case '-c':
        options.category = (nextArg ?? 'custom') as DisciplineCategory;
        i++;
        break;
      case '--description':
      case '-d':
        options.description = nextArg;
        i++;
        break;
      case '--agents':
        options.agentIds = (nextArg ?? '').split(',');
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--format':
      case '-f':
        options.outputFormat = (nextArg ?? 'text') as 'text' | 'json';
        i++;
        break;
      case '--registry-path':
        options.registryPath = nextArg;
        i++;
        break;
    }
  }

  if (!options.name) {
    console.error('Error: Discipline name is required (--name)');
    process.exitCode = 1;
    return;
  }

  // Execute command
  const result = await addDisciplineCommand(orchestratorId, options);

  // Output result
  if (options.outputFormat === 'json') {
    formatJsonOutput(result);
  } else {
    formatTextOutput(result);
  }

  if (!result.success) {
    process.exitCode = 1;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { VALID_CATEGORIES, DEFAULT_MCP_SERVERS, DEFAULT_CLAUDE_MD };
