/**
 * @packageDocumentation
 * Discipline Generator - Generates Discipline Packs (Tier 2) from VP specifications.
 *
 * This module provides the DisciplineGenerator class for creating discipline-level
 * configurations in the organizational hierarchy. Disciplines represent domains of
 * expertise that Session Managers embody, such as Engineering, Legal, HR, Marketing,
 * Finance, Operations, etc.
 *
 * The generator uses LLM prompts to create contextually appropriate discipline
 * configurations based on the parent VP's charter, industry context, and
 * organizational requirements.
 *
 * @module @wundr/org-genesis/generator/discipline-generator
 *
 * @example
 * ```typescript
 * import {
 *   DisciplineGenerator,
 *   createDisciplineGenerator,
 * } from '@wundr/org-genesis/generator/discipline-generator';
 *
 * // Create generator with configuration
 * const generator = createDisciplineGenerator({
 *   maxDisciplinesPerVP: 5,
 *   useDefaults: true,
 * });
 *
 * // Generate disciplines for a VP
 * const context: DisciplineGenerationContext = {
 *   orgName: 'TechCorp',
 *   vpName: 'VP of Engineering',
 *   vpSlug: 'vp-engineering',
 *   industry: 'SaaS Technology',
 *   vpResponsibilities: ['Software Development', 'Infrastructure', 'DevOps'],
 * };
 *
 * const result = await generator.generate(context);
 * console.log(`Generated ${result.disciplines.length} disciplines`);
 * ```
 */

import {
  buildDisciplineGenerationPrompt,
  buildDisciplineRefinementPrompt,
  parseDisciplineGenerationResponse,
  parseDisciplineRefinementResponse,
  convertToDisciplinePack,
  generateDisciplineSlug,
  DISCIPLINE_GENERATION_SYSTEM_PROMPT,
  DISCIPLINE_REFINEMENT_SYSTEM_PROMPT,
} from './prompts/discipline-prompts.js';
import { generateDisciplineId, generateSlug } from '../utils/slug.js';

import type { DisciplineGenerationContext } from './prompts/discipline-prompts.js';
import type {
  DisciplinePack,
  DisciplineCategory,
  DisciplineValidationError,
  DisciplineValidationWarning,
  ClaudeMdConfig,
  MCPServerConfig,
  HookConfig,
  VPCharter,
} from '../types/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the DisciplineGenerator.
 *
 * @description
 * Controls the behavior of the discipline generation process, including
 * limits on output and default value handling.
 *
 * @example
 * ```typescript
 * const config: DisciplineGeneratorConfig = {
 *   maxDisciplinesPerVP: 8,
 *   useDefaults: true,
 * };
 * ```
 */
export interface DisciplineGeneratorConfig {
  /**
   * Maximum number of disciplines to generate per VP.
   * The generator will produce at most this many disciplines in a single call.
   *
   * @default 10
   */
  maxDisciplinesPerVP?: number;

  /**
   * Whether to use default values for missing fields.
   * When true, the generator will fill in sensible defaults for optional
   * fields that are not provided by the LLM response.
   *
   * @default true
   */
  useDefaults?: boolean;

  /**
   * Optional callback for LLM interaction.
   * If not provided, the generator will return prompts that can be
   * passed to an external LLM.
   */
  llmCallback?: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

/**
 * Result of discipline generation operation.
 *
 * @description
 * Contains the generated disciplines along with any warnings encountered
 * during the generation process and optional token usage information.
 *
 * @example
 * ```typescript
 * const result: GenerateDisciplinesResult = {
 *   disciplines: [...],
 *   warnings: ['MCP server config may need adjustment for your environment'],
 *   tokensUsed: 2500,
 * };
 * ```
 */
export interface GenerateDisciplinesResult {
  /**
   * Array of generated discipline packs.
   * Each discipline is fully configured and ready for use.
   */
  disciplines: DisciplinePack[];

  /**
   * Warnings encountered during generation.
   * These are non-blocking issues that should be reviewed.
   */
  warnings: string[];

  /**
   * Optional count of tokens used in LLM interaction.
   * Only populated when using the llmCallback option.
   */
  tokensUsed?: number;
}

/**
 * Result of discipline refinement operation.
 *
 * @description
 * Contains the refined discipline along with notes about changes made.
 */
export interface RefineDisciplineResult {
  /**
   * The refined discipline pack with improvements applied.
   */
  discipline: DisciplinePack;

  /**
   * Notes explaining what was changed during refinement.
   */
  refinementNotes?: string;

  /**
   * Warnings about the refinement process.
   */
  warnings: string[];
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default MCP servers by discipline category.
 *
 * @description
 * Provides sensible default MCP server configurations for each discipline
 * category. These can be used when the LLM doesn't provide specific servers.
 */
const DEFAULT_MCP_SERVERS_BY_CATEGORY: Record<
  DisciplineCategory,
  MCPServerConfig[]
> = {
  engineering: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'File system operations for code and configuration',
    },
    {
      name: 'github',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
      description: 'GitHub integration for repository management',
    },
  ],
  legal: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Document management and storage',
    },
  ],
  hr: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'HR document and policy management',
    },
  ],
  marketing: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Content and asset management',
    },
  ],
  finance: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Financial document management',
    },
  ],
  operations: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Process documentation and workflows',
    },
  ],
  design: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Design asset and documentation management',
    },
  ],
  research: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Research data and document management',
    },
    {
      name: 'fetch',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      description: 'Web content retrieval for research',
    },
  ],
  sales: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Sales collateral and document management',
    },
  ],
  support: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'Support documentation and knowledge base',
    },
  ],
  custom: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'General file system operations',
    },
  ],
};

/**
 * Default hooks by discipline category.
 */
const DEFAULT_HOOKS_BY_CATEGORY: Record<DisciplineCategory, HookConfig[]> = {
  engineering: [
    {
      event: 'PreCommit',
      command: 'npm run lint && npm run typecheck',
      description: 'Run linting and type checking before commits',
      blocking: true,
    },
  ],
  legal: [],
  hr: [],
  marketing: [],
  finance: [],
  operations: [],
  design: [],
  research: [],
  sales: [],
  support: [],
  custom: [],
};

/**
 * Default CLAUDE.md configuration by category.
 */
const DEFAULT_CLAUDE_MD_BY_CATEGORY: Record<
  DisciplineCategory,
  ClaudeMdConfig
> = {
  engineering: {
    role: 'Software Engineer',
    context:
      'Building and maintaining software systems with focus on quality and best practices',
    rules: [
      'Follow established coding standards and conventions',
      'Write comprehensive tests for all changes',
      'Document significant architectural decisions',
      'Review code changes before committing',
    ],
    objectives: [
      'Deliver high-quality, maintainable code',
      'Improve system reliability and performance',
      'Reduce technical debt over time',
    ],
    constraints: [
      'Do not commit directly to main/master branch',
      'Do not modify production configurations without review',
      'Do not expose sensitive credentials in code',
    ],
  },
  legal: {
    role: 'Legal Analyst',
    context:
      'Supporting legal operations with document review, compliance, and research',
    rules: [
      'Always cite relevant regulations and precedents',
      'Maintain confidentiality of sensitive information',
      'Flag potential compliance issues immediately',
    ],
    objectives: [
      'Ensure regulatory compliance',
      'Support contract review and analysis',
      'Provide accurate legal research',
    ],
    constraints: [
      'Do not provide final legal advice without human review',
      'Do not access privileged communications without authorization',
    ],
  },
  hr: {
    role: 'HR Specialist',
    context: 'Supporting human resources operations and employee relations',
    rules: [
      'Maintain employee confidentiality',
      'Follow established HR policies and procedures',
      'Ensure compliance with employment laws',
    ],
    objectives: [
      'Support employee onboarding and offboarding',
      'Maintain accurate personnel records',
      'Facilitate performance management processes',
    ],
    constraints: [
      'Do not disclose personal employee information without authorization',
      'Do not make final hiring or termination decisions without human review',
    ],
  },
  marketing: {
    role: 'Marketing Specialist',
    context: 'Creating and managing marketing content and campaigns',
    rules: [
      'Follow brand guidelines consistently',
      'Ensure content accuracy and compliance',
      'Track campaign performance metrics',
    ],
    objectives: [
      'Create engaging marketing content',
      'Support campaign execution and optimization',
      'Maintain brand consistency across channels',
    ],
    constraints: [
      'Do not publish content without review approval',
      'Do not make claims that cannot be substantiated',
    ],
  },
  finance: {
    role: 'Financial Analyst',
    context: 'Supporting financial planning, analysis, and reporting',
    rules: [
      'Ensure accuracy in all financial calculations',
      'Follow accounting standards and regulations',
      'Maintain audit trail for all changes',
    ],
    objectives: [
      'Provide accurate financial analysis and reporting',
      'Support budgeting and forecasting processes',
      'Identify cost optimization opportunities',
    ],
    constraints: [
      'Do not process financial transactions without authorization',
      'Do not disclose confidential financial information',
    ],
  },
  operations: {
    role: 'Operations Analyst',
    context: 'Optimizing business processes and operational efficiency',
    rules: [
      'Document all process changes thoroughly',
      'Follow change management procedures',
      'Monitor operational metrics continuously',
    ],
    objectives: [
      'Improve operational efficiency',
      'Reduce process bottlenecks',
      'Enhance service delivery quality',
    ],
    constraints: [
      'Do not modify critical systems without approval',
      'Do not bypass established workflows',
    ],
  },
  design: {
    role: 'Design Specialist',
    context: 'Creating user-centered designs and maintaining design systems',
    rules: [
      'Follow design system guidelines',
      'Ensure accessibility compliance (WCAG)',
      'Document design decisions and rationale',
    ],
    objectives: [
      'Create intuitive and accessible designs',
      'Maintain design system consistency',
      'Support user research and testing',
    ],
    constraints: [
      'Do not deviate from brand guidelines without approval',
      'Do not implement designs without user validation',
    ],
  },
  research: {
    role: 'Research Analyst',
    context: 'Conducting research and analysis to support decision-making',
    rules: [
      'Use credible and verifiable sources',
      'Document research methodology',
      'Present findings objectively',
    ],
    objectives: [
      'Deliver actionable research insights',
      'Support data-driven decision making',
      'Identify emerging trends and opportunities',
    ],
    constraints: [
      'Do not misrepresent research findings',
      'Do not share proprietary research without authorization',
    ],
  },
  sales: {
    role: 'Sales Analyst',
    context: 'Supporting sales operations and customer engagement',
    rules: [
      'Maintain accurate CRM records',
      'Follow sales process guidelines',
      'Provide accurate product information',
    ],
    objectives: [
      'Support pipeline management and forecasting',
      'Enable effective customer communications',
      'Optimize sales process efficiency',
    ],
    constraints: [
      'Do not make unauthorized commitments to customers',
      'Do not access customer data without legitimate purpose',
    ],
  },
  support: {
    role: 'Support Specialist',
    context: 'Providing customer support and issue resolution',
    rules: [
      'Follow support escalation procedures',
      'Document all customer interactions',
      'Maintain professional communication',
    ],
    objectives: [
      'Resolve customer issues efficiently',
      'Maintain high customer satisfaction',
      'Contribute to knowledge base improvements',
    ],
    constraints: [
      'Do not share customer data inappropriately',
      'Do not make unauthorized refunds or credits',
    ],
  },
  custom: {
    role: 'Specialist',
    context: 'Performing specialized tasks within defined scope',
    rules: [
      'Follow established procedures',
      'Document all significant actions',
      'Escalate issues when appropriate',
    ],
    objectives: [
      'Complete assigned tasks accurately',
      'Support team objectives',
      'Maintain quality standards',
    ],
    constraints: [
      'Do not exceed defined scope without approval',
      'Do not bypass security controls',
    ],
  },
};

// ============================================================================
// Validation Result Type
// ============================================================================

/**
 * Validation result for discipline pack validation.
 *
 * @description
 * Provides detailed information about validation errors and warnings
 * for a discipline pack configuration.
 */
export interface DisciplinePackValidationResult {
  /**
   * Whether the discipline pack is valid.
   */
  valid: boolean;

  /**
   * Array of validation errors that must be fixed.
   */
  errors: DisciplineValidationError[];

  /**
   * Array of warnings that should be reviewed but don't block creation.
   */
  warnings: DisciplineValidationWarning[];
}

// ============================================================================
// DisciplineGenerator Class
// ============================================================================

/**
 * Generator class for creating Discipline Packs (Tier 2).
 *
 * @description
 * The DisciplineGenerator creates discipline-level configurations in the
 * organizational hierarchy. It uses LLM prompts to generate contextually
 * appropriate disciplines based on VP specifications and industry context.
 *
 * Disciplines represent domains of expertise that Session Managers embody.
 * Each discipline includes:
 * - CLAUDE.md configuration for AI behavior
 * - MCP server configurations for tool access
 * - Hook configurations for automated actions
 * - Suggested agent types for the discipline
 *
 * @example
 * ```typescript
 * const generator = new DisciplineGenerator({
 *   maxDisciplinesPerVP: 5,
 *   useDefaults: true,
 * });
 *
 * // Generate disciplines using the prompts
 * const prompt = generator.buildPrompt(context);
 * const llmResponse = await myLLM.generate(prompt);
 * const disciplines = generator.parseResponse(llmResponse);
 *
 * // Or use with LLM callback
 * const generatorWithCallback = new DisciplineGenerator({
 *   llmCallback: async (system, user) => myLLM.chat(system, user),
 * });
 * const result = await generatorWithCallback.generate(context);
 * ```
 */
export class DisciplineGenerator {
  private readonly config: Required<
    Omit<DisciplineGeneratorConfig, 'llmCallback'>
  > & {
    llmCallback?: (systemPrompt: string, userPrompt: string) => Promise<string>;
  };

  /**
   * Creates a new DisciplineGenerator instance.
   *
   * @param config - Configuration options for the generator
   *
   * @example
   * ```typescript
   * const generator = new DisciplineGenerator({
   *   maxDisciplinesPerVP: 8,
   *   useDefaults: true,
   * });
   * ```
   */
  constructor(config: DisciplineGeneratorConfig = {}) {
    this.config = {
      maxDisciplinesPerVP: config.maxDisciplinesPerVP ?? 10,
      useDefaults: config.useDefaults ?? true,
      llmCallback: config.llmCallback,
    };
  }

  /**
   * Generates discipline packs for a given VP context.
   *
   * @description
   * This method generates a set of disciplines appropriate for the given
   * organizational and VP context. If an LLM callback is configured, it
   * will use that to generate the disciplines. Otherwise, it returns
   * disciplines built from default templates.
   *
   * @param context - The context for discipline generation
   * @returns Promise resolving to the generation result
   * @throws Error if LLM callback fails or response cannot be parsed
   *
   * @example
   * ```typescript
   * const context: DisciplineGenerationContext = {
   *   orgName: 'TechCorp',
   *   vpName: 'VP of Engineering',
   *   vpSlug: 'vp-engineering',
   *   industry: 'SaaS Technology',
   *   vpResponsibilities: ['Software Development', 'Infrastructure'],
   * };
   *
   * const result = await generator.generate(context);
   * for (const discipline of result.disciplines) {
   *   console.log(`Created: ${discipline.name}`);
   * }
   * ```
   */
  async generate(
    context: DisciplineGenerationContext
  ): Promise<GenerateDisciplinesResult> {
    const warnings: string[] = [];

    if (this.config.llmCallback) {
      // Use LLM to generate disciplines
      const systemPrompt = DISCIPLINE_GENERATION_SYSTEM_PROMPT;
      const userPrompt = buildDisciplineGenerationPrompt(context);

      try {
        const response = await this.config.llmCallback(
          systemPrompt,
          userPrompt
        );
        const parsedData = parseDisciplineGenerationResponse(response);

        // Limit to max disciplines
        const limitedData = parsedData.slice(
          0,
          this.config.maxDisciplinesPerVP
        );
        if (parsedData.length > this.config.maxDisciplinesPerVP) {
          warnings.push(
            `Generated ${parsedData.length} disciplines, limited to ${this.config.maxDisciplinesPerVP}`
          );
        }

        // Convert to full discipline packs
        const disciplines = limitedData.map(parsed => {
          const partialPack = convertToDisciplinePack(parsed, context.vpSlug);
          return this.enrichWithDefaults({
            ...partialPack,
            id: generateDisciplineId(),
            slug: generateDisciplineSlug(parsed.name),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });

        return {
          disciplines,
          warnings,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to generate disciplines: ${errorMessage}`);
      }
    }

    // Without LLM callback, generate default disciplines based on VP responsibilities
    const disciplines = this.generateDefaultDisciplines(context);
    return {
      disciplines,
      warnings: ['Generated from default templates without LLM'],
    };
  }

  /**
   * Refines an existing discipline based on feedback.
   *
   * @description
   * This method takes an existing discipline and feedback about desired
   * improvements, then generates a refined version. Requires an LLM callback
   * to be configured.
   *
   * @param discipline - The existing discipline pack to refine
   * @param feedback - Feedback describing desired improvements
   * @returns Promise resolving to the refined discipline
   * @throws Error if LLM callback is not configured or refinement fails
   *
   * @example
   * ```typescript
   * const refined = await generator.refine(
   *   existingDiscipline,
   *   'Add more specific rules around state management and add Redux DevTools',
   * );
   * console.log('Refinement notes:', refined.refinementNotes);
   * ```
   */
  async refine(
    discipline: DisciplinePack,
    feedback: string
  ): Promise<RefineDisciplineResult> {
    if (!this.config.llmCallback) {
      throw new Error('LLM callback is required for discipline refinement');
    }

    const systemPrompt = DISCIPLINE_REFINEMENT_SYSTEM_PROMPT;
    const userPrompt = buildDisciplineRefinementPrompt(discipline, feedback);

    try {
      const response = await this.config.llmCallback(systemPrompt, userPrompt);
      const parsedData = parseDisciplineRefinementResponse(response);

      // Preserve original discipline metadata
      const refinedDiscipline = this.enrichWithDefaults({
        ...parsedData,
        id: discipline.id,
        slug: discipline.slug,
        parentVpId: discipline.parentVpId,
        agentIds: discipline.agentIds,
        createdAt: discipline.createdAt,
        updatedAt: new Date(),
      });

      return {
        discipline: refinedDiscipline,
        refinementNotes: parsedData._refinementNotes,
        warnings: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refine discipline: ${errorMessage}`);
    }
  }

  /**
   * Validates a discipline pack configuration.
   *
   * @description
   * Performs comprehensive validation of a discipline pack, checking for
   * required fields, valid values, and potential issues.
   *
   * @param pack - The discipline pack to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = generator.validatePack(discipline);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * if (result.warnings.length > 0) {
   *   console.warn('Validation warnings:', result.warnings);
   * }
   * ```
   */
  validatePack(pack: DisciplinePack): DisciplinePackValidationResult {
    const errors: DisciplineValidationError[] = [];
    const warnings: DisciplineValidationWarning[] = [];

    // Validate required fields
    if (!pack.id) {
      errors.push({
        field: 'id',
        message: 'Discipline ID is required',
        code: 'MISSING_ID',
      });
    }

    if (!pack.name || !pack.name.trim()) {
      errors.push({
        field: 'name',
        message: 'Discipline name is required',
        code: 'MISSING_NAME',
      });
    }

    if (!pack.slug || !pack.slug.trim()) {
      errors.push({
        field: 'slug',
        message: 'Discipline slug is required',
        code: 'MISSING_SLUG',
      });
    } else if (!/^[a-z0-9-]+$/.test(pack.slug)) {
      errors.push({
        field: 'slug',
        message:
          'Slug must contain only lowercase letters, numbers, and hyphens',
        code: 'INVALID_SLUG',
      });
    }

    if (!pack.description || !pack.description.trim()) {
      errors.push({
        field: 'description',
        message: 'Discipline description is required',
        code: 'MISSING_DESCRIPTION',
      });
    }

    // Validate category
    const validCategories: DisciplineCategory[] = [
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
    if (!validCategories.includes(pack.category)) {
      errors.push({
        field: 'category',
        message: `Invalid category: ${pack.category}`,
        code: 'INVALID_CATEGORY',
      });
    }

    // Validate CLAUDE.md config
    if (!pack.claudeMd) {
      errors.push({
        field: 'claudeMd',
        message: 'CLAUDE.md configuration is required',
        code: 'MISSING_CLAUDE_MD',
      });
    } else {
      if (!pack.claudeMd.role || !pack.claudeMd.role.trim()) {
        errors.push({
          field: 'claudeMd.role',
          message: 'CLAUDE.md role is required',
          code: 'MISSING_CLAUDE_MD_ROLE',
        });
      }
      if (!pack.claudeMd.context || !pack.claudeMd.context.trim()) {
        errors.push({
          field: 'claudeMd.context',
          message: 'CLAUDE.md context is required',
          code: 'MISSING_CLAUDE_MD_CONTEXT',
        });
      }
      if (!pack.claudeMd.rules || pack.claudeMd.rules.length === 0) {
        warnings.push({
          field: 'claudeMd.rules',
          message: 'No rules defined for this discipline',
          code: 'EMPTY_RULES',
        });
      }
      if (!pack.claudeMd.objectives || pack.claudeMd.objectives.length === 0) {
        warnings.push({
          field: 'claudeMd.objectives',
          message: 'No objectives defined for this discipline',
          code: 'EMPTY_OBJECTIVES',
        });
      }
    }

    // Validate MCP servers
    if (pack.mcpServers) {
      pack.mcpServers.forEach((server, index) => {
        if (!server.name || !server.name.trim()) {
          errors.push({
            field: `mcpServers[${index}].name`,
            message: 'MCP server name is required',
            code: 'MISSING_MCP_SERVER_NAME',
          });
        }
        if (!server.command || !server.command.trim()) {
          errors.push({
            field: `mcpServers[${index}].command`,
            message: 'MCP server command is required',
            code: 'MISSING_MCP_SERVER_COMMAND',
          });
        }
      });
    }

    // Validate hooks
    if (pack.hooks) {
      const validEvents = [
        'PreToolUse',
        'PostToolUse',
        'PreCommit',
        'PostCommit',
      ];
      pack.hooks.forEach((hook, index) => {
        if (!validEvents.includes(hook.event)) {
          errors.push({
            field: `hooks[${index}].event`,
            message: `Invalid hook event: ${hook.event}`,
            code: 'INVALID_HOOK_EVENT',
          });
        }
        if (!hook.command || !hook.command.trim()) {
          errors.push({
            field: `hooks[${index}].command`,
            message: 'Hook command is required',
            code: 'MISSING_HOOK_COMMAND',
          });
        }
      });
    }

    // Check for potential issues (warnings)
    if (!pack.mcpServers || pack.mcpServers.length === 0) {
      warnings.push({
        field: 'mcpServers',
        message: 'No MCP servers configured for this discipline',
        code: 'NO_MCP_SERVERS',
      });
    }

    if (!pack.agentIds || pack.agentIds.length === 0) {
      warnings.push({
        field: 'agentIds',
        message: 'No agents assigned to this discipline',
        code: 'NO_AGENTS',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Enriches a partial discipline pack with default values.
   *
   * @description
   * Fills in missing fields in a partial discipline pack with sensible
   * defaults based on the discipline category and configuration.
   *
   * @param pack - Partial discipline pack to enrich
   * @returns Complete discipline pack with all required fields
   *
   * @example
   * ```typescript
   * const complete = generator.enrichWithDefaults({
   *   name: 'Backend Development',
   *   category: 'engineering',
   *   description: 'Server-side development discipline',
   * });
   * // complete now has all required fields filled in
   * ```
   */
  enrichWithDefaults(pack: Partial<DisciplinePack>): DisciplinePack {
    const category = pack.category ?? 'custom';
    const now = new Date();

    // Get category-specific defaults
    const defaultClaudeMd = DEFAULT_CLAUDE_MD_BY_CATEGORY[category];
    const defaultMcpServers = this.config.useDefaults
      ? DEFAULT_MCP_SERVERS_BY_CATEGORY[category]
      : [];
    const defaultHooks = this.config.useDefaults
      ? DEFAULT_HOOKS_BY_CATEGORY[category]
      : [];

    // Merge CLAUDE.md config with defaults
    const claudeMd: ClaudeMdConfig = {
      role: pack.claudeMd?.role ?? defaultClaudeMd.role,
      context: pack.claudeMd?.context ?? defaultClaudeMd.context,
      rules: pack.claudeMd?.rules?.length
        ? pack.claudeMd.rules
        : defaultClaudeMd.rules,
      objectives: pack.claudeMd?.objectives?.length
        ? pack.claudeMd.objectives
        : defaultClaudeMd.objectives,
      constraints: pack.claudeMd?.constraints?.length
        ? pack.claudeMd.constraints
        : defaultClaudeMd.constraints,
    };

    return {
      id: pack.id ?? generateDisciplineId(),
      name: pack.name ?? 'Unnamed Discipline',
      slug: pack.slug ?? generateSlug(pack.name ?? 'unnamed-discipline'),
      category,
      description: pack.description ?? `${category} discipline`,
      claudeMd,
      mcpServers: pack.mcpServers?.length ? pack.mcpServers : defaultMcpServers,
      hooks: pack.hooks?.length ? pack.hooks : defaultHooks,
      agentIds: pack.agentIds ?? [],
      parentVpId: pack.parentVpId,
      createdAt: pack.createdAt ?? now,
      updatedAt: pack.updatedAt ?? now,
    };
  }

  /**
   * Convenience method to generate disciplines for a VP charter.
   *
   * @description
   * A simplified method that extracts the necessary context from a VP charter
   * and generates appropriate disciplines for that VP.
   *
   * @param vpCharter - The VP charter to generate disciplines for
   * @param industry - The industry/domain context
   * @returns Promise resolving to array of generated discipline packs
   *
   * @example
   * ```typescript
   * const disciplines = await generator.generateForVP(vpCharter, 'Financial Technology');
   * console.log(`Generated ${disciplines.length} disciplines for ${vpCharter.identity.name}`);
   * ```
   */
  async generateForVP(
    vpCharter: VPCharter,
    industry: string
  ): Promise<DisciplinePack[]> {
    const context: DisciplineGenerationContext = {
      orgName: 'Organization', // Could be passed in or extracted from vpCharter
      vpName: vpCharter.identity.name,
      vpSlug: vpCharter.identity.slug,
      industry,
      vpResponsibilities: [], // Could be derived from capabilities
      existingDisciplines: [], // Could be passed in to avoid duplicates
    };

    const result = await this.generate(context);
    return result.disciplines;
  }

  /**
   * Builds the LLM prompt for discipline generation.
   *
   * @description
   * Returns the system and user prompts that can be used with an external
   * LLM to generate disciplines. Useful when you want to handle the LLM
   * interaction yourself.
   *
   * @param context - The context for discipline generation
   * @returns Object containing system and user prompts
   *
   * @example
   * ```typescript
   * const prompts = generator.buildPrompt(context);
   * const response = await myLLM.chat(prompts.system, prompts.user);
   * const disciplines = generator.parseResponse(response);
   * ```
   */
  buildPrompt(context: DisciplineGenerationContext): {
    system: string;
    user: string;
  } {
    return {
      system: DISCIPLINE_GENERATION_SYSTEM_PROMPT,
      user: buildDisciplineGenerationPrompt(context),
    };
  }

  /**
   * Parses an LLM response into discipline packs.
   *
   * @description
   * Takes a raw LLM response string and parses it into an array of
   * discipline packs, enriching them with defaults as needed.
   *
   * @param response - Raw LLM response containing discipline JSON
   * @param parentVpId - Optional parent VP ID to associate with disciplines
   * @returns Array of parsed and enriched discipline packs
   * @throws Error if the response cannot be parsed
   *
   * @example
   * ```typescript
   * const prompts = generator.buildPrompt(context);
   * const response = await myLLM.chat(prompts.system, prompts.user);
   * const disciplines = generator.parseResponse(response, 'vp-engineering');
   * ```
   */
  parseResponse(response: string, parentVpId?: string): DisciplinePack[] {
    const parsedData = parseDisciplineGenerationResponse(response);

    return parsedData.map(parsed => {
      const partialPack = convertToDisciplinePack(parsed, parentVpId);
      return this.enrichWithDefaults({
        ...partialPack,
        id: generateDisciplineId(),
        slug: generateDisciplineSlug(parsed.name),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  /**
   * Generates default disciplines based on VP responsibilities.
   *
   * @description
   * Creates a set of default discipline packs based on common patterns
   * for the given VP context. Used when no LLM callback is configured.
   *
   * @param context - The generation context
   * @returns Array of default discipline packs
   */
  private generateDefaultDisciplines(
    context: DisciplineGenerationContext
  ): DisciplinePack[] {
    const disciplines: DisciplinePack[] = [];
    const now = new Date();

    // Determine category from VP name/slug
    const vpNameLower = context.vpName.toLowerCase();
    let primaryCategory: DisciplineCategory = 'custom';

    if (vpNameLower.includes('engineer') || vpNameLower.includes('tech')) {
      primaryCategory = 'engineering';
    } else if (
      vpNameLower.includes('legal') ||
      vpNameLower.includes('compliance')
    ) {
      primaryCategory = 'legal';
    } else if (vpNameLower.includes('hr') || vpNameLower.includes('human')) {
      primaryCategory = 'hr';
    } else if (
      vpNameLower.includes('marketing') ||
      vpNameLower.includes('brand')
    ) {
      primaryCategory = 'marketing';
    } else if (
      vpNameLower.includes('finance') ||
      vpNameLower.includes('accounting')
    ) {
      primaryCategory = 'finance';
    } else if (
      vpNameLower.includes('operation') ||
      vpNameLower.includes('ops')
    ) {
      primaryCategory = 'operations';
    } else if (vpNameLower.includes('design') || vpNameLower.includes('ux')) {
      primaryCategory = 'design';
    } else if (
      vpNameLower.includes('research') ||
      vpNameLower.includes('r&d')
    ) {
      primaryCategory = 'research';
    } else if (vpNameLower.includes('sales')) {
      primaryCategory = 'sales';
    } else if (
      vpNameLower.includes('support') ||
      vpNameLower.includes('customer')
    ) {
      primaryCategory = 'support';
    }

    // Generate a primary discipline
    const primaryName = this.getCategoryDisplayName(primaryCategory);
    disciplines.push(
      this.enrichWithDefaults({
        id: generateDisciplineId(),
        name: primaryName,
        slug: generateSlug(primaryName),
        category: primaryCategory,
        description: `${primaryName} discipline under ${context.vpName}`,
        parentVpId: context.vpSlug,
        agentIds: [],
        createdAt: now,
        updatedAt: now,
      })
    );

    // Add additional disciplines based on responsibilities
    if (context.vpResponsibilities) {
      for (const responsibility of context.vpResponsibilities.slice(0, 4)) {
        const disciplineName = responsibility;
        const slug = generateSlug(disciplineName);

        // Skip if already generated
        if (disciplines.some(d => d.slug === slug)) {
          continue;
        }

        disciplines.push(
          this.enrichWithDefaults({
            id: generateDisciplineId(),
            name: disciplineName,
            slug,
            category: primaryCategory,
            description: `${disciplineName} discipline focusing on ${responsibility.toLowerCase()}`,
            parentVpId: context.vpSlug,
            agentIds: [],
            createdAt: now,
            updatedAt: now,
          })
        );
      }
    }

    return disciplines.slice(0, this.config.maxDisciplinesPerVP);
  }

  /**
   * Gets a human-readable display name for a category.
   *
   * @param category - The discipline category
   * @returns Human-readable category name
   */
  private getCategoryDisplayName(category: DisciplineCategory): string {
    const displayNames: Record<DisciplineCategory, string> = {
      engineering: 'Software Engineering',
      legal: 'Legal & Compliance',
      hr: 'Human Resources',
      marketing: 'Marketing',
      finance: 'Finance',
      operations: 'Operations',
      design: 'Design',
      research: 'Research & Development',
      sales: 'Sales',
      support: 'Customer Support',
      custom: 'Custom Discipline',
    };

    return displayNames[category];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new DisciplineGenerator instance with the given configuration.
 *
 * @description
 * Factory function for creating DisciplineGenerator instances. Provides a
 * convenient way to create generators with specific configurations.
 *
 * @param config - Optional configuration options
 * @returns A new DisciplineGenerator instance
 *
 * @example
 * ```typescript
 * // Create with default configuration
 * const generator = createDisciplineGenerator();
 *
 * // Create with custom configuration
 * const customGenerator = createDisciplineGenerator({
 *   maxDisciplinesPerVP: 5,
 *   useDefaults: false,
 *   llmCallback: async (system, user) => anthropic.messages.create({...}),
 * });
 * ```
 */
export function createDisciplineGenerator(
  config?: DisciplineGeneratorConfig
): DisciplineGenerator {
  return new DisciplineGenerator(config);
}

// ============================================================================
// Note: DisciplineGenerationContext and ParsedDisciplineData are exported via prompts/index.js
