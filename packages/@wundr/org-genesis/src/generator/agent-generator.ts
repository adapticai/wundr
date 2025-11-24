/**
 * @packageDocumentation
 * Agent Generator - Generates Sub-Agent (Tier 3) definitions for disciplines.
 *
 * This module provides the AgentGenerator class which creates specialized sub-agents
 * for disciplines within the organizational hierarchy. Sub-agents are worker units
 * that perform specific tasks under the direction of Session Managers (Tier 2).
 *
 * @module @wundr/org-genesis/generator/agent-generator
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { AgentGenerator, createAgentGenerator } from '@wundr/org-genesis';
 *
 * // Create generator with custom configuration
 * const generator = createAgentGenerator({
 *   maxAgentsPerDiscipline: 10,
 *   includeUniversal: true,
 * });
 *
 * // Generate agents for a discipline
 * const result = await generator.generate({
 *   disciplineName: 'Software Engineering',
 *   disciplineSlug: 'software-engineering',
 *   disciplineCategory: 'engineering',
 *   disciplineDescription: 'Full-stack software development discipline',
 * });
 *
 * console.log(`Generated ${result.agents.length} agents`);
 * ```
 */

import type {
  AgentDefinition,
  AgentCapabilities,
  AgentTool,
  AgentScope,
  ModelAssignment,
  DisciplinePack,
} from '../types/index.js';

import {
  AgentGenerationContext,
  GeneratedAgentPartial,
  AgentRefinementFeedback,
  buildAgentGenerationPrompt,
  buildAgentRefinementPrompt,
  parseAgentGenerationResponse,
  convertToAgentDefinition,
  AGENT_GENERATION_SYSTEM_PROMPT,
  AGENT_REFINEMENT_SYSTEM_PROMPT,
} from './prompts/agent-prompts.js';

import {
  DEFAULT_AGENT_CAPABILITIES,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_MODEL_ASSIGNMENT,
  DEFAULT_AGENT_SCOPE,
} from '../types/agent.js';

import { generateAgentId, generateSlug } from '../utils/slug.js';
import { validateAgentDefinition } from '../utils/validation.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the AgentGenerator.
 *
 * Controls the behavior of agent generation including limits, defaults, and
 * which types of agents to include.
 *
 * @example
 * ```typescript
 * const config: AgentGeneratorConfig = {
 *   maxAgentsPerDiscipline: 15,
 *   includeUniversal: true,
 *   useDefaults: true,
 * };
 * ```
 */
export interface AgentGeneratorConfig {
  /**
   * Maximum number of agents to generate per discipline.
   * Includes both discipline-specific and universal agents.
   * @default 20
   */
  maxAgentsPerDiscipline?: number;

  /**
   * Whether to include universal agents in generation results.
   * Universal agents are available across all disciplines.
   * @default true
   */
  includeUniversal?: boolean;

  /**
   * Whether to apply default values to incomplete agent definitions.
   * @default true
   */
  useDefaults?: boolean;

  /**
   * Default model to assign to generated agents.
   * @default 'sonnet'
   */
  defaultModel?: ModelAssignment;

  /**
   * Default scope to assign to generated agents.
   * @default 'discipline-specific'
   */
  defaultScope?: AgentScope;

  /**
   * Default capabilities to assign to generated agents.
   * Individual capabilities can be overridden per agent.
   */
  defaultCapabilities?: Partial<AgentCapabilities>;

  /**
   * Default tools to assign to generated agents.
   * Merged with any agent-specific tools.
   */
  defaultTools?: AgentTool[];

  /**
   * Optional LLM provider function for AI-powered generation.
   * If not provided, only template-based generation is available.
   */
  llmProvider?: LLMProvider;
}

/**
 * LLM provider interface for AI-powered agent generation.
 *
 * Implement this interface to integrate with your preferred LLM service.
 */
export interface LLMProvider {
  /**
   * Generate a completion from the LLM.
   *
   * @param messages - Array of messages for the conversation
   * @returns The LLM response with content and token usage
   */
  complete(messages: LLMMessage[]): Promise<LLMResponse>;
}

/**
 * Message format for LLM conversations.
 */
export interface LLMMessage {
  /** The role of the message sender */
  role: 'system' | 'user' | 'assistant';
  /** The content of the message */
  content: string;
}

/**
 * Response format from LLM completions.
 */
export interface LLMResponse {
  /** The generated content */
  content: string;
  /** Optional token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of an agent generation operation.
 *
 * Contains the generated agents along with any warnings and metadata.
 *
 * @example
 * ```typescript
 * const result: GenerateAgentsResult = {
 *   agents: [codeReviewer, testEngineer, architect],
 *   warnings: ['Agent "researcher" already exists, skipped'],
 *   tokensUsed: 1500,
 * };
 * ```
 */
export interface GenerateAgentsResult {
  /**
   * Array of generated agent definitions.
   */
  agents: AgentDefinition[];

  /**
   * Warning messages generated during the operation.
   * Includes skipped duplicates, validation issues, etc.
   */
  warnings: string[];

  /**
   * Total tokens used for LLM generation, if applicable.
   */
  tokensUsed?: number;
}

/**
 * Result of validating an agent definition.
 */
export interface AgentValidationResult {
  /**
   * Whether the agent definition is valid.
   */
  valid: boolean;

  /**
   * Array of error messages if validation failed.
   */
  errors: string[];

  /**
   * Array of warning messages for non-critical issues.
   */
  warnings: string[];
}

// ============================================================================
// Universal Agent Templates
// ============================================================================

/**
 * Universal agent template definitions.
 *
 * These templates define the core universal agents that are available
 * across all disciplines in the organization.
 */
const UNIVERSAL_AGENT_TEMPLATES: GeneratedAgentPartial[] = [
  {
    name: 'Researcher',
    slug: 'researcher',
    description: 'Gathers information, analyzes data, and synthesizes findings to support decision-making',
    charter: `You are a meticulous Research Agent responsible for gathering and analyzing information.

## Core Responsibilities
1. Conduct thorough research on assigned topics
2. Gather information from multiple sources
3. Analyze data and identify patterns
4. Synthesize findings into actionable insights
5. Document research methodology and sources

## Decision-Making Guidelines
- Prioritize authoritative and recent sources
- Cross-reference information from multiple sources
- Flag conflicting information for human review
- Cite sources and provide confidence levels

## Communication Style
- Present findings clearly and concisely
- Use structured formats (lists, tables) for complex data
- Distinguish between facts and interpretations
- Provide executive summaries for long reports

## Constraints
- Never fabricate or assume information
- Always cite sources for claims
- Escalate when information is ambiguous or sensitive
- Stay within the assigned research scope`,
    scope: 'universal',
    model: 'sonnet',
    tools: [
      { name: 'read', type: 'builtin' },
      { name: 'glob', type: 'builtin' },
      { name: 'grep', type: 'builtin' },
    ],
    capabilities: {
      canReadFiles: true,
      canWriteFiles: false,
      canExecuteCommands: false,
      canAccessNetwork: true,
      canSpawnSubAgents: false,
    },
    tags: ['research', 'analysis', 'universal'],
    isUniversal: true,
  },
  {
    name: 'Scribe',
    slug: 'scribe',
    description: 'Documents decisions, meetings, and processes with clear and organized records',
    charter: `You are a dedicated Scribe Agent responsible for documentation and record-keeping.

## Core Responsibilities
1. Document decisions and their rationale
2. Record meeting notes and action items
3. Maintain clear and organized documentation
4. Create standardized templates for common documents
5. Ensure documentation is up-to-date and accessible

## Decision-Making Guidelines
- Capture key points without excessive detail
- Use consistent formatting and structure
- Include timestamps and attributions
- Flag items requiring follow-up

## Communication Style
- Write clearly and concisely
- Use bullet points and headers for readability
- Maintain a professional, neutral tone
- Organize information logically

## Constraints
- Accurately record what was said, not interpretations
- Maintain confidentiality of sensitive discussions
- Never modify historical records without audit trail
- Escalate ambiguous or conflicting information`,
    scope: 'universal',
    model: 'haiku',
    tools: [
      { name: 'read', type: 'builtin' },
      { name: 'write', type: 'builtin' },
      { name: 'edit', type: 'builtin' },
    ],
    capabilities: {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: false,
      canAccessNetwork: false,
      canSpawnSubAgents: false,
    },
    tags: ['documentation', 'records', 'universal'],
    isUniversal: true,
  },
  {
    name: 'Project Manager',
    slug: 'project-manager',
    description: 'Tracks tasks, timelines, and dependencies to ensure projects stay on track',
    charter: `You are a Project Manager Agent responsible for project coordination and tracking.

## Core Responsibilities
1. Track tasks, milestones, and deadlines
2. Monitor project progress and dependencies
3. Identify risks and blockers early
4. Coordinate between team members and disciplines
5. Report status and escalate issues promptly

## Decision-Making Guidelines
- Prioritize tasks based on dependencies and deadlines
- Balance workload across team members
- Escalate blockers that impact critical path
- Adjust plans proactively when risks materialize

## Communication Style
- Provide clear, actionable status updates
- Use standard project management terminology
- Highlight key decisions and their impact
- Maintain transparency about challenges

## Constraints
- Never commit resources without authorization
- Respect team capacity and working hours
- Escalate scope changes for approval
- Maintain accurate records of all changes`,
    scope: 'universal',
    model: 'sonnet',
    tools: [
      { name: 'read', type: 'builtin' },
      { name: 'write', type: 'builtin' },
      { name: 'glob', type: 'builtin' },
    ],
    capabilities: {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: false,
      canAccessNetwork: false,
      canSpawnSubAgents: false,
    },
    tags: ['project-management', 'coordination', 'universal'],
    isUniversal: true,
  },
  {
    name: 'Reviewer',
    slug: 'reviewer',
    description: 'Reviews work output for quality, correctness, and adherence to standards',
    charter: `You are a Quality Reviewer Agent responsible for ensuring work meets standards.

## Core Responsibilities
1. Review work output for quality and correctness
2. Apply domain-specific standards and best practices
3. Provide constructive, actionable feedback
4. Track and verify issue resolution
5. Document review decisions and rationale

## Decision-Making Guidelines
- Apply consistent review criteria
- Prioritize critical issues over minor ones
- Balance thoroughness with timeliness
- Consider context and constraints when evaluating

## Communication Style
- Be specific and constructive in feedback
- Explain the 'why' behind recommendations
- Acknowledge good work alongside improvements
- Use a respectful and supportive tone

## Constraints
- Never approve work that doesn't meet minimum standards
- Avoid blocking on purely stylistic preferences
- Escalate security and compliance issues immediately
- Document all rejection reasons clearly`,
    scope: 'universal',
    model: 'sonnet',
    tools: [
      { name: 'read', type: 'builtin' },
      { name: 'grep', type: 'builtin' },
      { name: 'glob', type: 'builtin' },
    ],
    capabilities: {
      canReadFiles: true,
      canWriteFiles: false,
      canExecuteCommands: false,
      canAccessNetwork: false,
      canSpawnSubAgents: false,
    },
    tags: ['review', 'quality', 'universal'],
    isUniversal: true,
  },
  {
    name: 'Tester',
    slug: 'tester',
    description: 'Creates and executes tests to validate functionality and identify issues',
    charter: `You are a Testing Agent responsible for quality assurance through testing.

## Core Responsibilities
1. Create comprehensive test plans and cases
2. Execute tests and document results
3. Report issues with clear reproduction steps
4. Track test coverage and identify gaps
5. Validate fixes and regression testing

## Decision-Making Guidelines
- Prioritize tests based on risk and impact
- Focus on edge cases and error conditions
- Balance test coverage with execution time
- Automate repetitive test scenarios

## Communication Style
- Write clear, reproducible bug reports
- Use consistent test case formatting
- Provide expected vs. actual results
- Categorize issues by severity

## Constraints
- Never mark tests as passed without execution
- Document all test environment dependencies
- Escalate blocking issues immediately
- Maintain test data integrity`,
    scope: 'universal',
    model: 'sonnet',
    tools: [
      { name: 'read', type: 'builtin' },
      { name: 'write', type: 'builtin' },
      { name: 'bash', type: 'builtin' },
      { name: 'glob', type: 'builtin' },
    ],
    capabilities: {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: true,
      canAccessNetwork: false,
      canSpawnSubAgents: false,
    },
    tags: ['testing', 'qa', 'universal'],
    isUniversal: true,
  },
];

// ============================================================================
// AgentGenerator Class
// ============================================================================

/**
 * Generator for Sub-Agent (Tier 3) definitions.
 *
 * The AgentGenerator creates specialized agents for disciplines in the
 * organizational hierarchy. It supports both template-based generation
 * for universal agents and LLM-powered generation for discipline-specific agents.
 *
 * @example
 * ```typescript
 * const generator = new AgentGenerator({
 *   maxAgentsPerDiscipline: 10,
 *   includeUniversal: true,
 * });
 *
 * // Generate agents for engineering discipline
 * const result = await generator.generate({
 *   disciplineName: 'Backend Engineering',
 *   disciplineSlug: 'backend-engineering',
 *   disciplineCategory: 'engineering',
 *   disciplineDescription: 'Server-side application development',
 * });
 *
 * // Refine an existing agent based on feedback
 * const refined = await generator.refine(
 *   result.agents[0],
 *   'Add more specific guidelines for API design',
 * );
 * ```
 */
export class AgentGenerator {
  private readonly config: Required<
    Pick<AgentGeneratorConfig, 'maxAgentsPerDiscipline' | 'includeUniversal' | 'useDefaults'>
  > &
    Omit<AgentGeneratorConfig, 'maxAgentsPerDiscipline' | 'includeUniversal' | 'useDefaults'>;

  /**
   * Creates a new AgentGenerator instance.
   *
   * @param config - Configuration options for the generator
   */
  constructor(config: AgentGeneratorConfig = {}) {
    this.config = {
      maxAgentsPerDiscipline: config.maxAgentsPerDiscipline ?? 20,
      includeUniversal: config.includeUniversal ?? true,
      useDefaults: config.useDefaults ?? true,
      defaultModel: config.defaultModel ?? DEFAULT_MODEL_ASSIGNMENT,
      defaultScope: config.defaultScope ?? DEFAULT_AGENT_SCOPE,
      defaultCapabilities: config.defaultCapabilities,
      defaultTools: config.defaultTools,
      llmProvider: config.llmProvider,
    };
  }

  /**
   * Generates agents for a discipline based on the provided context.
   *
   * This method generates both discipline-specific agents and (optionally)
   * includes universal agents. If an LLM provider is configured, it uses
   * AI-powered generation for discipline-specific agents.
   *
   * @param context - The context for agent generation
   * @returns Promise resolving to the generation result
   *
   * @example
   * ```typescript
   * const result = await generator.generate({
   *   disciplineName: 'Data Science',
   *   disciplineSlug: 'data-science',
   *   disciplineCategory: 'research',
   *   disciplineDescription: 'Machine learning and analytics',
   *   maxAgents: 8,
   * });
   *
   * console.log(`Generated ${result.agents.length} agents`);
   * result.warnings.forEach(w => console.warn(w));
   * ```
   */
  async generate(context: AgentGenerationContext): Promise<GenerateAgentsResult> {
    const warnings: string[] = [];
    const agents: AgentDefinition[] = [];
    let tokensUsed = 0;

    const maxAgents = context.maxAgents ?? this.config.maxAgentsPerDiscipline;
    const existingSlugs = new Set(
      (context.existingAgents ?? []).map((a) => a.slug),
    );

    // Add universal agents if configured and room allows
    if (this.config.includeUniversal) {
      const universalAgents = await this.generateUniversalAgents();
      for (const agent of universalAgents) {
        if (agents.length >= maxAgents) {
          warnings.push(`Max agent limit (${maxAgents}) reached, stopping generation`);
          break;
        }
        if (existingSlugs.has(agent.slug)) {
          warnings.push(`Universal agent "${agent.slug}" already exists, skipped`);
          continue;
        }
        // Add discipline to universal agent's usedByDisciplines
        if (!agent.usedByDisciplines.includes(context.disciplineSlug)) {
          agent.usedByDisciplines.push(context.disciplineSlug);
        }
        agents.push(agent);
        existingSlugs.add(agent.slug);
      }
    }

    // Generate discipline-specific agents
    if (agents.length < maxAgents) {
      const disciplineResult = await this.generateDisciplineSpecificAgents(
        context,
        maxAgents - agents.length,
        existingSlugs,
      );

      agents.push(...disciplineResult.agents);
      warnings.push(...disciplineResult.warnings);
      tokensUsed += disciplineResult.tokensUsed ?? 0;
    }

    return {
      agents,
      warnings,
      tokensUsed: tokensUsed > 0 ? tokensUsed : undefined,
    };
  }

  /**
   * Refines an existing agent definition based on feedback.
   *
   * Uses the LLM provider (if available) to improve the agent based on
   * specific feedback. If no LLM provider is configured, returns the
   * original agent unchanged.
   *
   * @param agent - The agent definition to refine
   * @param feedback - Human-readable feedback for improvement
   * @param feedbackType - The type of refinement needed
   * @returns Promise resolving to the refined agent definition
   *
   * @example
   * ```typescript
   * const refined = await generator.refine(
   *   existingAgent,
   *   'Add more specific error handling guidelines',
   *   'charter',
   * );
   * ```
   */
  async refine(
    agent: AgentDefinition,
    feedback: string,
    feedbackType: AgentRefinementFeedback['type'] = 'general',
  ): Promise<AgentDefinition> {
    if (!this.config.llmProvider) {
      // Without LLM, return the agent unchanged
      return {
        ...agent,
        updatedAt: new Date(),
      };
    }

    const refinementFeedback: AgentRefinementFeedback = {
      type: feedbackType,
      feedback,
    };

    const messages: LLMMessage[] = [
      { role: 'system', content: AGENT_REFINEMENT_SYSTEM_PROMPT },
      { role: 'user', content: buildAgentRefinementPrompt(agent, refinementFeedback) },
    ];

    try {
      const response = await this.config.llmProvider.complete(messages);
      const parsed = parseAgentGenerationResponse(response.content);

      if (parsed.length === 0) {
        return agent;
      }

      // Merge the refined fields with the original agent
      const refined = parsed[0];
      return {
        ...agent,
        name: refined.name || agent.name,
        description: refined.description || agent.description,
        charter: refined.charter || agent.charter,
        model: refined.model || agent.model,
        tools: refined.tools.length > 0 ? refined.tools : agent.tools,
        capabilities: {
          ...agent.capabilities,
          ...refined.capabilities,
        },
        tags: refined.tags.length > 0 ? refined.tags : agent.tags,
        updatedAt: new Date(),
      };
    } catch (error) {
      // On error, return the original agent
      return agent;
    }
  }

  /**
   * Validates an agent definition against the schema.
   *
   * Checks that all required fields are present and valid, and returns
   * any validation errors or warnings.
   *
   * @param agent - The agent definition to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = generator.validateDefinition(agentDef);
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  validateDefinition(agent: AgentDefinition): AgentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      validateAgentDefinition(agent);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push('Unknown validation error');
      }
    }

    // Additional semantic validations
    if (agent.charter.length < 100) {
      warnings.push('Charter is very short; consider adding more detail');
    }

    if (agent.tools.length === 0) {
      warnings.push('Agent has no tools assigned');
    }

    if (agent.tags.length === 0) {
      warnings.push('Agent has no tags for categorization');
    }

    if (
      agent.capabilities.canWriteFiles &&
      !agent.tools.some((t) => t.name === 'write' || t.name === 'edit')
    ) {
      warnings.push(
        'Agent has write capability but no write/edit tools; may need additional tools',
      );
    }

    if (
      agent.capabilities.canExecuteCommands &&
      !agent.tools.some((t) => t.name === 'bash')
    ) {
      warnings.push(
        'Agent has command execution capability but no bash tool',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Enriches a partial agent definition with default values.
   *
   * Takes an incomplete agent definition and fills in missing fields
   * with sensible defaults based on the generator configuration.
   *
   * @param partial - The partial agent definition
   * @returns A complete agent definition
   *
   * @example
   * ```typescript
   * const complete = generator.enrichWithDefaults({
   *   name: 'Code Analyzer',
   *   description: 'Analyzes code quality',
   *   charter: '...',
   * });
   * ```
   */
  enrichWithDefaults(partial: Partial<AgentDefinition>): AgentDefinition {
    const now = new Date();
    const name = partial.name ?? 'Unnamed Agent';
    const slug = partial.slug ?? generateSlug(name);

    const defaultCaps: AgentCapabilities = {
      ...DEFAULT_AGENT_CAPABILITIES,
      ...(this.config.defaultCapabilities ?? {}),
    };

    const tools: AgentTool[] = partial.tools?.length
      ? partial.tools
      : this.config.defaultTools ?? DEFAULT_AGENT_TOOLS;

    return {
      id: partial.id ?? generateAgentId(),
      name,
      slug,
      tier: 3,
      scope: partial.scope ?? this.config.defaultScope ?? DEFAULT_AGENT_SCOPE,
      description: partial.description ?? `Agent: ${name}`,
      charter: partial.charter ?? `You are the ${name} agent.`,
      model: partial.model ?? this.config.defaultModel ?? DEFAULT_MODEL_ASSIGNMENT,
      tools,
      capabilities: partial.capabilities
        ? { ...defaultCaps, ...partial.capabilities }
        : defaultCaps,
      usedByDisciplines: partial.usedByDisciplines ?? [],
      usedByVps: partial.usedByVps,
      tags: partial.tags ?? [],
      createdAt: partial.createdAt ?? now,
      updatedAt: partial.updatedAt ?? now,
    };
  }

  /**
   * Generates the standard universal agents.
   *
   * Returns agent definitions for the core universal agents that are
   * available across all disciplines: researcher, scribe, project-manager,
   * reviewer, and tester.
   *
   * @returns Promise resolving to array of universal agent definitions
   *
   * @example
   * ```typescript
   * const universalAgents = await generator.generateUniversalAgents();
   * console.log(universalAgents.map(a => a.name));
   * // ['Researcher', 'Scribe', 'Project Manager', 'Reviewer', 'Tester']
   * ```
   */
  async generateUniversalAgents(): Promise<AgentDefinition[]> {
    const now = new Date();

    return UNIVERSAL_AGENT_TEMPLATES.map((template) => ({
      id: generateAgentId(),
      name: template.name,
      slug: template.slug,
      tier: 3 as const,
      scope: 'universal' as const,
      description: template.description,
      charter: template.charter,
      model: template.model,
      tools: template.tools,
      capabilities: template.capabilities,
      usedByDisciplines: [],
      usedByVps: [],
      tags: template.tags,
      createdAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Generates agents specifically for a discipline pack.
   *
   * Convenience method that extracts context from a DisciplinePack and
   * calls the main generate method.
   *
   * @param discipline - The discipline pack to generate agents for
   * @returns Promise resolving to the generation result
   *
   * @example
   * ```typescript
   * const discipline: DisciplinePack = { ... };
   * const result = await generator.generateForDiscipline(discipline);
   * ```
   */
  async generateForDiscipline(discipline: DisciplinePack): Promise<GenerateAgentsResult> {
    const context: AgentGenerationContext = {
      disciplineName: discipline.name,
      disciplineSlug: discipline.slug,
      disciplineCategory: discipline.category,
      disciplineDescription: discipline.description,
      availableMcpTools: discipline.mcpServers.map((s) => s.name),
    };

    return this.generate(context);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generates discipline-specific agents using LLM or templates.
   */
  private async generateDisciplineSpecificAgents(
    context: AgentGenerationContext,
    maxAgents: number,
    existingSlugs: Set<string>,
  ): Promise<GenerateAgentsResult> {
    const warnings: string[] = [];
    const agents: AgentDefinition[] = [];
    let tokensUsed = 0;

    // If no LLM provider, use category-based templates
    if (!this.config.llmProvider) {
      const templateAgents = this.getTemplateAgentsForCategory(
        context.disciplineCategory,
        context.disciplineSlug,
      );

      for (const agent of templateAgents) {
        if (agents.length >= maxAgents) break;
        if (existingSlugs.has(agent.slug)) {
          warnings.push(`Template agent "${agent.slug}" already exists, skipped`);
          continue;
        }
        agents.push(agent);
        existingSlugs.add(agent.slug);
      }

      return { agents, warnings };
    }

    // Use LLM for generation
    const enrichedContext: AgentGenerationContext = {
      ...context,
      maxAgents,
      universalAgentTemplates: await this.generateUniversalAgents(),
    };

    const messages: LLMMessage[] = [
      { role: 'system', content: AGENT_GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: buildAgentGenerationPrompt(enrichedContext) },
    ];

    try {
      const response = await this.config.llmProvider.complete(messages);
      tokensUsed = response.usage?.totalTokens ?? 0;

      const parsed = parseAgentGenerationResponse(response.content);

      for (const partial of parsed) {
        if (agents.length >= maxAgents) {
          warnings.push(`Max agent limit (${maxAgents}) reached`);
          break;
        }

        // Skip universal agents (they're added separately)
        if (partial.isUniversal) {
          continue;
        }

        if (existingSlugs.has(partial.slug)) {
          warnings.push(`Generated agent "${partial.slug}" already exists, skipped`);
          continue;
        }

        const agent = convertToAgentDefinition(partial, context.disciplineSlug);

        // Validate the generated agent
        const validation = this.validateDefinition(agent);
        if (!validation.valid) {
          warnings.push(
            `Generated agent "${partial.slug}" failed validation: ${validation.errors.join(', ')}`,
          );
          continue;
        }
        warnings.push(...validation.warnings.map((w) => `${partial.slug}: ${w}`));

        agents.push(agent);
        existingSlugs.add(agent.slug);
      }
    } catch (error) {
      warnings.push(
        `LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Fall back to template agents
      const templateAgents = this.getTemplateAgentsForCategory(
        context.disciplineCategory,
        context.disciplineSlug,
      );
      for (const agent of templateAgents) {
        if (agents.length >= maxAgents) break;
        if (existingSlugs.has(agent.slug)) continue;
        agents.push(agent);
        existingSlugs.add(agent.slug);
      }
    }

    return { agents, warnings, tokensUsed };
  }

  /**
   * Gets template agents for a specific category.
   */
  private getTemplateAgentsForCategory(
    category: string,
    disciplineSlug: string,
  ): AgentDefinition[] {
    const now = new Date();
    const templates = CATEGORY_AGENT_TEMPLATES[category] ?? [];

    return templates.map((template) => ({
      id: generateAgentId(),
      name: template.name,
      slug: template.slug,
      tier: 3 as const,
      scope: 'discipline-specific' as const,
      description: template.description,
      charter: template.charter,
      model: template.model,
      tools: template.tools,
      capabilities: template.capabilities,
      usedByDisciplines: [disciplineSlug],
      usedByVps: [],
      tags: template.tags,
      createdAt: now,
      updatedAt: now,
    }));
  }
}

// ============================================================================
// Category-Specific Agent Templates
// ============================================================================

/**
 * Category-specific agent templates for fallback generation.
 */
const CATEGORY_AGENT_TEMPLATES: Record<string, GeneratedAgentPartial[]> = {
  engineering: [
    {
      name: 'Code Developer',
      slug: 'code-developer',
      description: 'Writes clean, efficient, and well-tested code',
      charter: `You are a skilled Code Developer agent responsible for implementing features.

## Core Responsibilities
1. Write clean, efficient, and maintainable code
2. Follow established coding standards and patterns
3. Implement unit tests for new functionality
4. Document code with clear comments and docs
5. Participate in code reviews

## Decision-Making Guidelines
- Prefer simple solutions over complex ones
- Follow SOLID principles and clean code practices
- Write tests before implementing (TDD when appropriate)
- Consider performance implications of design choices

## Constraints
- Never commit untested code to main branches
- Always run linting and type checks before commits
- Escalate architectural decisions to senior developers`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'edit', type: 'builtin' },
        { name: 'bash', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
        { name: 'grep', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: true,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['development', 'coding', 'implementation'],
    },
    {
      name: 'Code Reviewer',
      slug: 'code-reviewer',
      description: 'Reviews code changes for quality, security, and best practices',
      charter: `You are a meticulous Code Reviewer agent focused on code quality.

## Core Responsibilities
1. Review code for correctness and logic errors
2. Check adherence to coding standards
3. Identify security vulnerabilities
4. Assess performance implications
5. Provide constructive, actionable feedback

## Decision-Making Guidelines
- Prioritize blocking issues (bugs, security) over style
- Be specific about what needs to change and why
- Suggest improvements rather than just criticizing
- Consider the context and constraints of the change

## Constraints
- Never approve code with known security issues
- Block changes that break existing functionality
- Escalate architectural concerns to senior reviewers`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
        { name: 'grep', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: false,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['code-review', 'quality', 'security'],
    },
    {
      name: 'DevOps Engineer',
      slug: 'devops-engineer',
      description: 'Manages infrastructure, CI/CD pipelines, and deployment processes',
      charter: `You are a DevOps Engineer agent responsible for infrastructure and deployments.

## Core Responsibilities
1. Maintain CI/CD pipeline configurations
2. Manage infrastructure as code
3. Monitor system health and performance
4. Automate operational tasks
5. Support deployment and rollback processes

## Decision-Making Guidelines
- Prioritize system stability and reliability
- Automate repetitive operational tasks
- Implement proper monitoring and alerting
- Follow security best practices for infrastructure

## Constraints
- Never deploy to production without approval
- Always maintain rollback capabilities
- Escalate infrastructure security issues immediately`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'bash', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: true,
        canAccessNetwork: true,
        canSpawnSubAgents: false,
      },
      tags: ['devops', 'infrastructure', 'deployment'],
    },
  ],
  legal: [
    {
      name: 'Contract Analyst',
      slug: 'contract-analyst',
      description: 'Analyzes contracts for risks, obligations, and compliance issues',
      charter: `You are a Contract Analyst agent specializing in contract review.

## Core Responsibilities
1. Review contracts for key terms and obligations
2. Identify potential risks and liabilities
3. Check compliance with regulations and policies
4. Summarize contract terms for stakeholders
5. Track contract renewals and deadlines

## Decision-Making Guidelines
- Flag unusual or non-standard terms
- Prioritize high-risk clauses for review
- Consider regulatory implications
- Maintain confidentiality of contract contents

## Constraints
- Never provide final legal advice
- Escalate ambiguous terms to legal counsel
- Do not modify contracts without authorization`,
      scope: 'discipline-specific',
      model: 'opus',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
        { name: 'grep', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: false,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['legal', 'contracts', 'analysis'],
    },
    {
      name: 'Compliance Monitor',
      slug: 'compliance-monitor',
      description: 'Monitors regulatory compliance and tracks compliance obligations',
      charter: `You are a Compliance Monitor agent responsible for regulatory oversight.

## Core Responsibilities
1. Track regulatory requirements and changes
2. Monitor compliance status across the organization
3. Document compliance activities and evidence
4. Report compliance gaps and risks
5. Support audit preparation

## Decision-Making Guidelines
- Stay current on regulatory changes
- Prioritize compliance issues by risk level
- Maintain detailed compliance records
- Escalate violations immediately

## Constraints
- Never ignore or minimize compliance issues
- Do not advise on legal matters directly
- Escalate potential violations to compliance officer`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: true,
        canSpawnSubAgents: false,
      },
      tags: ['compliance', 'regulatory', 'monitoring'],
    },
  ],
  finance: [
    {
      name: 'Financial Analyst',
      slug: 'financial-analyst',
      description: 'Analyzes financial data and produces insights for decision-making',
      charter: `You are a Financial Analyst agent specializing in financial analysis.

## Core Responsibilities
1. Analyze financial statements and metrics
2. Create financial models and projections
3. Prepare reports for stakeholders
4. Monitor key financial indicators
5. Support budgeting and forecasting

## Decision-Making Guidelines
- Ensure accuracy in all calculations
- Use consistent methodologies
- Present findings objectively
- Consider market context in analysis

## Constraints
- Never make investment recommendations
- Verify data sources before analysis
- Escalate material discrepancies immediately`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['finance', 'analysis', 'reporting'],
    },
  ],
  marketing: [
    {
      name: 'Content Creator',
      slug: 'content-creator',
      description: 'Creates marketing content including copy, blogs, and social posts',
      charter: `You are a Content Creator agent specializing in marketing content.

## Core Responsibilities
1. Write engaging marketing copy
2. Create blog posts and articles
3. Draft social media content
4. Ensure brand voice consistency
5. Optimize content for SEO

## Decision-Making Guidelines
- Align content with brand guidelines
- Focus on audience needs and interests
- Use data to inform content strategy
- Balance creativity with clarity

## Constraints
- Never make unsubstantiated claims
- Ensure all claims are compliant
- Get approval for brand-sensitive content`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: true,
        canSpawnSubAgents: false,
      },
      tags: ['marketing', 'content', 'copywriting'],
    },
  ],
  hr: [
    {
      name: 'HR Coordinator',
      slug: 'hr-coordinator',
      description: 'Supports HR operations including onboarding and documentation',
      charter: `You are an HR Coordinator agent supporting human resources operations.

## Core Responsibilities
1. Manage onboarding documentation
2. Track employee records and updates
3. Support benefits administration
4. Coordinate training and development
5. Maintain HR policy documentation

## Decision-Making Guidelines
- Ensure confidentiality of employee data
- Follow established HR procedures
- Document all interactions and decisions
- Escalate sensitive matters to HR management

## Constraints
- Never share confidential employee information
- Do not make hiring/firing decisions
- Escalate legal and compliance issues`,
      scope: 'discipline-specific',
      model: 'haiku',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['hr', 'operations', 'coordination'],
    },
  ],
  operations: [
    {
      name: 'Process Optimizer',
      slug: 'process-optimizer',
      description: 'Analyzes and improves operational processes for efficiency',
      charter: `You are a Process Optimizer agent focused on operational efficiency.

## Core Responsibilities
1. Map and document business processes
2. Identify inefficiencies and bottlenecks
3. Recommend process improvements
4. Track process metrics and KPIs
5. Support change management

## Decision-Making Guidelines
- Base recommendations on data
- Consider stakeholder impact
- Prioritize high-impact improvements
- Document all process changes

## Constraints
- Never implement changes without approval
- Consider compliance implications
- Escalate cross-functional changes`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['operations', 'process', 'optimization'],
    },
  ],
  research: [
    {
      name: 'Data Scientist',
      slug: 'data-scientist',
      description: 'Analyzes data, builds models, and extracts insights',
      charter: `You are a Data Scientist agent specializing in data analysis and ML.

## Core Responsibilities
1. Analyze datasets and identify patterns
2. Build and validate predictive models
3. Create data visualizations
4. Document methodology and findings
5. Support data-driven decision making

## Decision-Making Guidelines
- Ensure statistical rigor
- Validate model assumptions
- Communicate uncertainty appropriately
- Consider ethical implications

## Constraints
- Never misrepresent findings
- Document all methodology
- Escalate data quality issues`,
      scope: 'discipline-specific',
      model: 'opus',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'bash', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: true,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['data-science', 'analytics', 'ml'],
    },
  ],
  design: [
    {
      name: 'UX Researcher',
      slug: 'ux-researcher',
      description: 'Conducts user research to inform design decisions',
      charter: `You are a UX Researcher agent focused on understanding user needs.

## Core Responsibilities
1. Plan and conduct user research
2. Analyze research findings
3. Create user personas and journey maps
4. Document insights and recommendations
5. Support design decisions with evidence

## Decision-Making Guidelines
- Focus on user needs and behaviors
- Use appropriate research methods
- Present findings objectively
- Consider diverse user perspectives

## Constraints
- Protect participant privacy
- Avoid leading questions
- Document research methodology`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: true,
        canSpawnSubAgents: false,
      },
      tags: ['ux', 'research', 'design'],
    },
  ],
  sales: [
    {
      name: 'Sales Analyst',
      slug: 'sales-analyst',
      description: 'Analyzes sales data and supports sales team performance',
      charter: `You are a Sales Analyst agent supporting sales operations.

## Core Responsibilities
1. Analyze sales pipeline and metrics
2. Create sales reports and forecasts
3. Identify trends and opportunities
4. Support territory and quota planning
5. Track competitor activity

## Decision-Making Guidelines
- Use data to drive insights
- Focus on actionable recommendations
- Consider market context
- Maintain forecast accuracy

## Constraints
- Protect competitive information
- Never guarantee sales outcomes
- Escalate pipeline risks`,
      scope: 'discipline-specific',
      model: 'sonnet',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: false,
        canSpawnSubAgents: false,
      },
      tags: ['sales', 'analytics', 'reporting'],
    },
  ],
  support: [
    {
      name: 'Support Specialist',
      slug: 'support-specialist',
      description: 'Handles customer inquiries and resolves support issues',
      charter: `You are a Support Specialist agent assisting customers.

## Core Responsibilities
1. Respond to customer inquiries
2. Troubleshoot and resolve issues
3. Document support cases
4. Escalate complex issues appropriately
5. Contribute to knowledge base

## Decision-Making Guidelines
- Prioritize customer satisfaction
- Use empathetic communication
- Follow established procedures
- Escalate when necessary

## Constraints
- Never share customer data
- Do not make policy exceptions
- Escalate security incidents`,
      scope: 'discipline-specific',
      model: 'haiku',
      tools: [
        { name: 'read', type: 'builtin' },
        { name: 'write', type: 'builtin' },
        { name: 'glob', type: 'builtin' },
      ],
      capabilities: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCommands: false,
        canAccessNetwork: true,
        canSpawnSubAgents: false,
      },
      tags: ['support', 'customer-service', 'help'],
    },
  ],
};

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new AgentGenerator instance with the provided configuration.
 *
 * Factory function for creating AgentGenerator instances with optional
 * configuration. This is the recommended way to instantiate the generator.
 *
 * @param config - Optional configuration options
 * @returns A new AgentGenerator instance
 *
 * @example
 * ```typescript
 * // Create with default configuration
 * const generator = createAgentGenerator();
 *
 * // Create with custom configuration
 * const customGenerator = createAgentGenerator({
 *   maxAgentsPerDiscipline: 15,
 *   includeUniversal: false,
 *   llmProvider: myLLMProvider,
 * });
 * ```
 */
export function createAgentGenerator(config?: AgentGeneratorConfig): AgentGenerator {
  return new AgentGenerator(config);
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  AgentGenerationContext,
  GeneratedAgentPartial,
  AgentRefinementFeedback,
} from './prompts/agent-prompts.js';
