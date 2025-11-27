/**
 * @packageDocumentation
 * Discipline-level prompt templates for organizational generation.
 *
 * This module provides prompt templates and builder functions for generating
 * Discipline Packs (Tier 2) in the organizational hierarchy. Disciplines
 * represent domains of expertise that Session Managers embody, such as
 * Engineering, Legal, HR, Marketing, Finance, Operations, etc.
 *
 * @module @wundr/org-genesis/generator/prompts/discipline-prompts
 *
 * @example
 * ```typescript
 * import {
 *   buildDisciplineGenerationPrompt,
 *   parseDisciplineGenerationResponse,
 *   DISCIPLINE_GENERATION_SYSTEM_PROMPT,
 * } from '@wundr/org-genesis/generator/prompts/discipline-prompts';
 *
 * const context: DisciplineGenerationContext = {
 *   orgName: 'Acme Corp',
 *   vpName: 'Orchestrator of Engineering',
 *   vpSlug: 'orchestrator-engineering',
 *   industry: 'SaaS Technology',
 *   vpResponsibilities: ['Software Development', 'Infrastructure', 'DevOps'],
 * };
 *
 * const userPrompt = buildDisciplineGenerationPrompt(context);
 * // Send to LLM with DISCIPLINE_GENERATION_SYSTEM_PROMPT
 * const disciplines = parseDisciplineGenerationResponse(llmResponse);
 * ```
 */

import type {
  ClaudeMdConfig,
  DisciplineCategory,
  DisciplinePack,
  HookConfig,
  MCPServerConfig,
} from '../../types/index.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Context required for generating disciplines under a Orchestrator.
 *
 * @description
 * This interface defines the contextual information needed to generate
 * appropriate disciplines for a Virtual Principal. The context helps the
 * LLM understand the organizational structure and generate relevant disciplines.
 *
 * @example
 * ```typescript
 * const context: DisciplineGenerationContext = {
 *   orgName: 'TechCorp',
 *   vpName: 'Orchestrator of Engineering',
 *   vpSlug: 'orchestrator-engineering',
 *   industry: 'Financial Technology',
 *   vpResponsibilities: [
 *     'Software development and architecture',
 *     'Infrastructure and DevOps',
 *     'Quality assurance and testing',
 *   ],
 *   existingDisciplines: [], // No existing disciplines yet
 * };
 * ```
 */
export interface DisciplineGenerationContext {
  /**
   * Name of the organization this discipline belongs to.
   * Provides organizational context for role definition.
   *
   * @example 'Acme Corporation', 'TechStartup Inc.'
   */
  orgName: string;

  /**
   * Name of the parent Virtual Principal (VP).
   * The Orchestrator oversees this discipline in the hierarchy.
   *
   * @example 'Orchestrator of Engineering', 'Chief Legal Officer'
   */
  vpName: string;

  /**
   * URL-safe slug of the parent Orchestrator.
   * Used for path generation and references.
   *
   * @example 'orchestrator-engineering', 'chief-legal-officer'
   */
  vpSlug: string;

  /**
   * Industry or domain the organization operates in.
   * Helps tailor discipline configurations to industry norms.
   *
   * @example 'Healthcare Technology', 'Financial Services', 'E-commerce'
   */
  industry: string;

  /**
   * Optional list of responsibilities assigned to the parent Orchestrator.
   * Helps identify what disciplines should be created under this Orchestrator.
   */
  vpResponsibilities?: string[];

  /**
   * Optional list of existing disciplines already defined.
   * Prevents generation of duplicate disciplines.
   */
  existingDisciplines?: DisciplinePack[];

  /**
   * Optional organizational culture or values to incorporate.
   * Influences the tone and rules in generated CLAUDE.md content.
   */
  organizationalValues?: string[];

  /**
   * Optional technology stack information.
   * Helps determine relevant MCP servers and tools.
   */
  techStack?: string[];
}

/**
 * Parsed discipline data from LLM response before full validation.
 *
 * @description
 * This interface represents the raw discipline data as parsed from the LLM
 * response. It may have optional fields that require defaults before becoming
 * a full DisciplinePack.
 */
export interface ParsedDisciplineData {
  /**
   * Name of the discipline.
   */
  name: string;

  /**
   * Description of the discipline's purpose and scope.
   */
  description: string;

  /**
   * Category classification for the discipline.
   */
  category: DisciplineCategory;

  /**
   * CLAUDE.md configuration for the discipline.
   */
  claudeMd: ClaudeMdConfig;

  /**
   * MCP server configurations (may be empty).
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Hook configurations (may be empty).
   */
  hooks?: HookConfig[];

  /**
   * Suggested agent types for this discipline.
   */
  suggestedAgentTypes?: string[];
}

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for discipline generation.
 *
 * @description
 * This prompt establishes the context and role for the LLM when generating
 * Discipline Packs. It explains the three-tier hierarchy, what a discipline
 * represents, and what components make up a complete discipline pack.
 *
 * The prompt is designed to:
 * - Establish the LLM as an organizational architect
 * - Explain the discipline concept clearly
 * - Define expected output structure
 * - Provide guidelines for quality output
 */
export const DISCIPLINE_GENERATION_SYSTEM_PROMPT = `
You are an organizational architect specializing in work discipline design for AI agent hierarchies.
Your task is to define Session Manager archetypes (disciplines) for AI agents within a three-tier organizational structure.

## Three-Tier Hierarchy

1. **Tier 1 - Virtual Principals (VPs)**: Executive-level AI personas that oversee departments
2. **Tier 2 - Session Managers (Disciplines)**: Domain experts that handle specific functional areas
3. **Tier 3 - Agents**: Task-specific workers that execute within discipline contexts

## What is a Discipline?

A discipline represents a domain of expertise that a Session Manager embodies. Examples include:
- **Engineering**: Software development, infrastructure, DevOps
- **Legal**: Compliance, contracts, regulatory affairs
- **HR**: Recruiting, employee relations, training
- **Marketing**: Brand, content, demand generation
- **Finance**: Accounting, FP&A, treasury
- **Operations**: Process optimization, vendor management

## Discipline Pack Components

Each discipline pack includes:

1. **CLAUDE.md Configuration**
   - Role: The professional persona (e.g., "Senior Software Engineer")
   - Context: The working environment and domain
   - Rules: Imperative behavioral guidelines
   - Objectives: Goals the discipline should work towards
   - Constraints: Limitations and boundaries

2. **MCP Servers**
   - Tools and integrations relevant to the discipline
   - Each server has: name, command, args, env, description

3. **Hooks**
   - Automated actions triggered by events
   - Events: PreToolUse, PostToolUse, PreCommit, PostCommit
   - Can be blocking or non-blocking

4. **Agent Types**
   - Specialized sub-agents within this discipline
   - Each handles specific tasks within the domain

## Output Requirements

- Return valid JSON that can be parsed
- Each discipline should be practical and implementable
- MCP servers should use real, available tools where possible
- Hooks should address common workflow needs
- Agent types should cover key tasks within the discipline

## Quality Guidelines

- Be specific rather than generic
- Consider industry best practices
- Think about practical tool needs
- Define clear boundaries between disciplines
- Ensure disciplines don't overlap significantly
`;

/**
 * User prompt template for generating disciplines.
 *
 * @description
 * This template provides the specific context for generating disciplines
 * under a particular Orchestrator. It uses Handlebars-style placeholders that are
 * replaced with actual values at runtime.
 *
 * Placeholders:
 * - {{orgName}}: Organization name
 * - {{vpName}}: Orchestrator name
 * - {{vpSlug}}: Orchestrator slug for references
 * - {{industry}}: Industry/domain
 * - {{vpResponsibilities}}: List of Orchestrator responsibilities
 * - {{existingDisciplines}}: Already defined disciplines to avoid duplicates
 * - {{techStack}}: Technology stack information
 */
export const DISCIPLINE_GENERATION_USER_PROMPT = `
Organization: {{orgName}}
VP: {{vpName}} ({{vpSlug}})
Industry: {{industry}}
{{#if vpResponsibilities}}
Orchestrator Responsibilities:
{{#each vpResponsibilities}}
- {{this}}
{{/each}}
{{/if}}
{{#if techStack}}
Technology Stack:
{{#each techStack}}
- {{this}}
{{/each}}
{{/if}}
{{#if existingDisciplines}}
Existing Disciplines (avoid duplicates):
{{#each existingDisciplines}}
- {{this.name}} ({{this.category}})
{{/each}}
{{/if}}

Generate disciplines for this Orchestrator. Consider:
1. The Orchestrator's responsibilities and domain coverage
2. The industry context and specific requirements
3. Common workflows and tasks in this domain
4. Tools and integrations typically needed

For each discipline, provide:
- name: Human-readable discipline name
- description: Detailed purpose and scope
- category: One of engineering, legal, hr, marketing, finance, operations, design, research, sales, support, custom
- claudeMd: Complete CLAUDE.md configuration with role, context, rules, objectives, constraints
- mcpServers: Array of MCP server configurations (can be empty)
- hooks: Array of hook configurations (can be empty)
- suggestedAgentTypes: Array of agent type names that should exist within this discipline

Return as a JSON array of discipline objects. Example format:
\`\`\`json
[
  {
    "name": "Frontend Development",
    "description": "React and TypeScript frontend application development",
    "category": "engineering",
    "claudeMd": {
      "role": "Senior Frontend Developer",
      "context": "Building modern web applications with React, TypeScript, and modern tooling",
      "rules": [
        "Follow React best practices and hooks patterns",
        "Ensure accessibility compliance (WCAG 2.1 AA)",
        "Write unit tests for all components"
      ],
      "objectives": [
        "Create responsive, performant user interfaces",
        "Maintain consistent design system usage",
        "Optimize bundle size and load times"
      ],
      "constraints": [
        "No direct backend modifications without review",
        "No storing sensitive data in localStorage",
        "No inline styles - use CSS modules or styled-components"
      ]
    },
    "mcpServers": [
      {
        "name": "browser-tools",
        "command": "npx",
        "args": ["@anthropic/browser-tools"],
        "description": "Browser automation and testing tools"
      }
    ],
    "hooks": [
      {
        "event": "PreCommit",
        "command": "npm run lint:fix && npm run test:unit",
        "description": "Run linting and unit tests before committing",
        "blocking": true
      }
    ],
    "suggestedAgentTypes": ["react-developer", "css-specialist", "accessibility-auditor"]
  }
]
\`\`\`
`;

/**
 * System prompt for discipline refinement.
 *
 * @description
 * This prompt is used when refining an existing discipline based on feedback.
 * It maintains the discipline's core identity while incorporating improvements.
 */
export const DISCIPLINE_REFINEMENT_SYSTEM_PROMPT = `
You are an organizational architect refining an existing discipline configuration.
Your task is to improve the discipline based on provided feedback while maintaining its core purpose.

## Refinement Guidelines

1. **Preserve Core Identity**: Keep the discipline's essential purpose intact
2. **Address Feedback**: Directly address each point in the feedback
3. **Maintain Consistency**: Ensure changes don't conflict with existing configurations
4. **Be Specific**: Provide concrete improvements, not vague enhancements
5. **Explain Changes**: Briefly note what was changed and why

## Output Format

Return the refined discipline as a single JSON object with the same structure as the input.
Include a "_refinementNotes" field explaining the key changes made.
`;

/**
 * User prompt template for refining a discipline.
 */
export const DISCIPLINE_REFINEMENT_USER_PROMPT = `
Current Discipline Configuration:
\`\`\`json
{{disciplineJson}}
\`\`\`

Feedback to Address:
{{feedback}}

Please refine this discipline configuration based on the feedback.
Return the updated discipline as a JSON object with all required fields.
`;

// ============================================================================
// Prompt Builder Functions
// ============================================================================

/**
 * Builds the user prompt for discipline generation.
 *
 * @description
 * This function takes a DisciplineGenerationContext and produces a formatted
 * prompt string by replacing template placeholders with actual values.
 *
 * @param context - The context containing organization, VP, and industry information
 * @returns Formatted prompt string ready for LLM submission
 *
 * @example
 * ```typescript
 * const context: DisciplineGenerationContext = {
 *   orgName: 'TechCorp',
 *   vpName: 'Orchestrator of Engineering',
 *   vpSlug: 'orchestrator-engineering',
 *   industry: 'SaaS Technology',
 *   vpResponsibilities: ['Software Development', 'Infrastructure'],
 * };
 *
 * const prompt = buildDisciplineGenerationPrompt(context);
 * // Prompt now contains formatted text with context values
 * ```
 */
export function buildDisciplineGenerationPrompt(
  context: DisciplineGenerationContext,
): string {
  let prompt = DISCIPLINE_GENERATION_USER_PROMPT;

  // Replace simple placeholders
  prompt = prompt.replace(/\{\{orgName\}\}/g, context.orgName);
  prompt = prompt.replace(/\{\{vpName\}\}/g, context.vpName);
  prompt = prompt.replace(/\{\{vpSlug\}\}/g, context.vpSlug);
  prompt = prompt.replace(/\{\{industry\}\}/g, context.industry);

  // Handle vpResponsibilities conditional block
  if (context.vpResponsibilities && context.vpResponsibilities.length > 0) {
    const responsibilitiesBlock =
      'Orchestrator Responsibilities:\n' +
      context.vpResponsibilities.map((r) => `- ${r}`).join('\n');
    prompt = prompt.replace(
      /\{\{#if vpResponsibilities\}\}[\s\S]*?\{\{\/if\}\}/,
      responsibilitiesBlock,
    );
  } else {
    prompt = prompt.replace(
      /\{\{#if vpResponsibilities\}\}[\s\S]*?\{\{\/if\}\}/,
      '',
    );
  }

  // Handle techStack conditional block
  if (context.techStack && context.techStack.length > 0) {
    const techStackBlock =
      'Technology Stack:\n' + context.techStack.map((t) => `- ${t}`).join('\n');
    prompt = prompt.replace(
      /\{\{#if techStack\}\}[\s\S]*?\{\{\/if\}\}/,
      techStackBlock,
    );
  } else {
    prompt = prompt.replace(/\{\{#if techStack\}\}[\s\S]*?\{\{\/if\}\}/, '');
  }

  // Handle existingDisciplines conditional block
  if (context.existingDisciplines && context.existingDisciplines.length > 0) {
    const disciplinesBlock =
      'Existing Disciplines (avoid duplicates):\n' +
      context.existingDisciplines
        .map((d) => `- ${d.name} (${d.category})`)
        .join('\n');
    prompt = prompt.replace(
      /\{\{#if existingDisciplines\}\}[\s\S]*?\{\{\/if\}\}/,
      disciplinesBlock,
    );
  } else {
    prompt = prompt.replace(
      /\{\{#if existingDisciplines\}\}[\s\S]*?\{\{\/if\}\}/,
      '',
    );
  }

  // Clean up any extra whitespace from removed blocks
  prompt = prompt.replace(/\n{3,}/g, '\n\n');

  return prompt.trim();
}

/**
 * Builds the prompt for refining an existing discipline.
 *
 * @description
 * This function creates a prompt for refining a discipline based on feedback.
 * The prompt includes the current discipline configuration and the feedback
 * to be addressed.
 *
 * @param discipline - The existing discipline pack to refine
 * @param feedback - Feedback describing desired improvements
 * @returns Formatted prompt string for discipline refinement
 *
 * @example
 * ```typescript
 * const discipline: DisciplinePack = {
 *   id: 'disc_eng_001',
 *   name: 'Frontend Development',
 *   // ... other fields
 * };
 *
 * const prompt = buildDisciplineRefinementPrompt(
 *   discipline,
 *   'Add more specific rules around state management and add Redux DevTools MCP server',
 * );
 * ```
 */
export function buildDisciplineRefinementPrompt(
  discipline: DisciplinePack,
  feedback: string,
): string {
  let prompt = DISCIPLINE_REFINEMENT_USER_PROMPT;

  // Serialize discipline to JSON (excluding internal fields)
  const disciplineForPrompt = {
    name: discipline.name,
    description: discipline.description,
    category: discipline.category,
    claudeMd: discipline.claudeMd,
    mcpServers: discipline.mcpServers,
    hooks: discipline.hooks,
    agentIds: discipline.agentIds,
  };

  prompt = prompt.replace(
    /\{\{disciplineJson\}\}/g,
    JSON.stringify(disciplineForPrompt, null, 2),
  );
  prompt = prompt.replace(/\{\{feedback\}\}/g, feedback);

  return prompt.trim();
}

/**
 * Builds a prompt for generating a single discipline with specific focus.
 *
 * @description
 * This function creates a targeted prompt for generating a single discipline
 * with a specific category and focus area. Useful when the user knows what
 * type of discipline they want.
 *
 * @param context - Base generation context
 * @param targetCategory - The specific category to generate
 * @param focusArea - Optional focus area within the category
 * @returns Formatted prompt string for targeted discipline generation
 *
 * @example
 * ```typescript
 * const prompt = buildTargetedDisciplinePrompt(
 *   context,
 *   'engineering',
 *   'Backend API Development',
 * );
 * ```
 */
export function buildTargetedDisciplinePrompt(
  context: DisciplineGenerationContext,
  targetCategory: DisciplineCategory,
  focusArea?: string,
): string {
  const basePrompt = buildDisciplineGenerationPrompt(context);

  const targetingAddendum = `
IMPORTANT: Generate exactly ONE discipline with the following requirements:
- Category: ${targetCategory}
${focusArea ? `- Focus Area: ${focusArea}` : ''}

Return a JSON array containing exactly one discipline object.
`;

  return basePrompt + '\n' + targetingAddendum.trim();
}

// ============================================================================
// Response Parsing Functions
// ============================================================================

/**
 * Parses the LLM response into discipline data objects.
 *
 * @description
 * This function extracts and parses JSON from the LLM response, handling
 * common formatting issues like markdown code blocks. It returns an array
 * of parsed discipline data that can be validated and converted to full
 * DisciplinePack objects.
 *
 * @param response - Raw response string from the LLM
 * @returns Array of parsed discipline data objects
 * @throws Error if response cannot be parsed as valid JSON
 *
 * @example
 * ```typescript
 * const llmResponse = `
 * Here are the disciplines:
 * \`\`\`json
 * [{"name": "Frontend Development", ...}]
 * \`\`\`
 * `;
 *
 * try {
 *   const disciplines = parseDisciplineGenerationResponse(llmResponse);
 *   console.log(`Parsed ${disciplines.length} disciplines`);
 * } catch (error) {
 *   console.error('Failed to parse response:', error);
 * }
 * ```
 */
export function parseDisciplineGenerationResponse(
  response: string,
): ParsedDisciplineData[] {
  // Extract JSON from response (handle markdown code blocks)
  let jsonString = response;

  // Try to extract from markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }

  // Try to find array brackets if not in code block
  if (!jsonString.startsWith('[')) {
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonString = arrayMatch[0];
    }
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    throw new Error(
      `Failed to parse discipline generation response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
    );
  }

  // Validate it's an array
  if (!Array.isArray(parsed)) {
    throw new Error('Discipline generation response must be a JSON array');
  }

  // Validate and extract each discipline
  const disciplines: ParsedDisciplineData[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];

    // Validate required fields
    if (!item || typeof item !== 'object') {
      throw new Error(`Discipline at index ${i} is not an object`);
    }

    if (typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error(`Discipline at index ${i} missing required 'name' field`);
    }

    if (typeof item.description !== 'string' || !item.description.trim()) {
      throw new Error(
        `Discipline at index ${i} missing required 'description' field`,
      );
    }

    if (!isValidDisciplineCategory(item.category)) {
      throw new Error(
        `Discipline at index ${i} has invalid category: ${item.category}`,
      );
    }

    if (!item.claudeMd || typeof item.claudeMd !== 'object') {
      throw new Error(
        `Discipline at index ${i} missing required 'claudeMd' configuration`,
      );
    }

    // Validate claudeMd structure
    const claudeMd = validateClaudeMdConfig(item.claudeMd, i);

    // Build parsed discipline
    const discipline: ParsedDisciplineData = {
      name: item.name.trim(),
      description: item.description.trim(),
      category: item.category as DisciplineCategory,
      claudeMd,
      mcpServers: validateMcpServers(item.mcpServers, i),
      hooks: validateHooks(item.hooks, i),
      suggestedAgentTypes: validateAgentTypes(item.suggestedAgentTypes, i),
    };

    disciplines.push(discipline);
  }

  return disciplines;
}

/**
 * Parses a refinement response into a single discipline.
 *
 * @description
 * Specialized parser for refinement responses which return a single discipline
 * object rather than an array.
 *
 * @param response - Raw response string from the LLM
 * @returns Parsed discipline data object
 * @throws Error if response cannot be parsed
 *
 * @example
 * ```typescript
 * const refinedDiscipline = parseDisciplineRefinementResponse(llmResponse);
 * console.log('Refinement notes:', refinedDiscipline._refinementNotes);
 * ```
 */
export function parseDisciplineRefinementResponse(response: string): ParsedDisciplineData & { _refinementNotes?: string } {
  // Extract JSON from response
  let jsonString = response;

  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }

  // Try to find object braces if not in code block
  if (!jsonString.startsWith('{')) {
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonString = objectMatch[0];
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    throw new Error(
      `Failed to parse discipline refinement response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Discipline refinement response must be a JSON object');
  }

  const item = parsed as Record<string, unknown>;

  // Validate and parse as discipline
  if (typeof item.name !== 'string' || !item.name.trim()) {
    throw new Error("Refined discipline missing required 'name' field");
  }

  if (typeof item.description !== 'string' || !item.description.trim()) {
    throw new Error("Refined discipline missing required 'description' field");
  }

  if (!isValidDisciplineCategory(item.category)) {
    throw new Error(`Refined discipline has invalid category: ${item.category}`);
  }

  if (!item.claudeMd || typeof item.claudeMd !== 'object') {
    throw new Error("Refined discipline missing required 'claudeMd' configuration");
  }

  const claudeMd = validateClaudeMdConfig(item.claudeMd, 0);

  return {
    name: item.name.trim(),
    description: item.description.trim(),
    category: item.category as DisciplineCategory,
    claudeMd,
    mcpServers: validateMcpServers(item.mcpServers, 0),
    hooks: validateHooks(item.hooks, 0),
    suggestedAgentTypes: validateAgentTypes(item.suggestedAgentTypes, 0),
    _refinementNotes: typeof item._refinementNotes === 'string' ? item._refinementNotes : undefined,
  };
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Valid discipline categories for validation.
 */
const VALID_DISCIPLINE_CATEGORIES: DisciplineCategory[] = [
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
 * Validates if a value is a valid discipline category.
 *
 * @param value - Value to check
 * @returns True if the value is a valid DisciplineCategory
 */
function isValidDisciplineCategory(value: unknown): value is DisciplineCategory {
  return (
    typeof value === 'string' &&
    VALID_DISCIPLINE_CATEGORIES.includes(value as DisciplineCategory)
  );
}

/**
 * Validates and extracts ClaudeMdConfig from parsed data.
 *
 * @param config - Raw config object from parsed JSON
 * @param index - Index of the discipline (for error messages)
 * @returns Validated ClaudeMdConfig
 * @throws Error if configuration is invalid
 */
function validateClaudeMdConfig(
  config: unknown,
  index: number,
): ClaudeMdConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(`Discipline at index ${index}: claudeMd must be an object`);
  }

  const c = config as Record<string, unknown>;

  // Role is required
  if (typeof c.role !== 'string' || !c.role.trim()) {
    throw new Error(
      `Discipline at index ${index}: claudeMd.role is required and must be a non-empty string`,
    );
  }

  // Context is required
  if (typeof c.context !== 'string' || !c.context.trim()) {
    throw new Error(
      `Discipline at index ${index}: claudeMd.context is required and must be a non-empty string`,
    );
  }

  // Rules must be an array of strings
  const rules = validateStringArray(c.rules, 'claudeMd.rules', index);

  // Objectives must be an array of strings
  const objectives = validateStringArray(
    c.objectives,
    'claudeMd.objectives',
    index,
  );

  // Constraints must be an array of strings
  const constraints = validateStringArray(
    c.constraints,
    'claudeMd.constraints',
    index,
  );

  return {
    role: c.role.trim(),
    context: c.context.trim(),
    rules,
    objectives,
    constraints,
  };
}

/**
 * Validates and extracts string array from parsed data.
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field (for error messages)
 * @param index - Index of the discipline (for error messages)
 * @returns Array of strings (empty if not provided)
 */
function validateStringArray(
  value: unknown,
  fieldName: string,
  index: number,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `Discipline at index ${index}: ${fieldName} must be an array`,
    );
  }

  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => (item as string).trim());
}

/**
 * Validates MCP server configurations from parsed data.
 *
 * @param servers - Raw servers array from parsed JSON
 * @param index - Index of the discipline (for error messages)
 * @returns Array of validated MCPServerConfig objects
 */
function validateMcpServers(
  servers: unknown,
  index: number,
): MCPServerConfig[] {
  if (servers === undefined || servers === null) {
    return [];
  }

  if (!Array.isArray(servers)) {
    throw new Error(
      `Discipline at index ${index}: mcpServers must be an array`,
    );
  }

  return servers
    .filter((s) => s && typeof s === 'object')
    .map((s, serverIndex) => {
      const server = s as Record<string, unknown>;

      if (typeof server.name !== 'string' || !server.name.trim()) {
        throw new Error(
          `Discipline at index ${index}, mcpServer ${serverIndex}: name is required`,
        );
      }

      if (typeof server.command !== 'string' || !server.command.trim()) {
        throw new Error(
          `Discipline at index ${index}, mcpServer ${serverIndex}: command is required`,
        );
      }

      const config: MCPServerConfig = {
        name: server.name.trim(),
        command: server.command.trim(),
        description:
          typeof server.description === 'string'
            ? server.description.trim()
            : `MCP server: ${server.name}`,
      };

      // Add optional args
      if (Array.isArray(server.args)) {
        config.args = server.args.filter((a) => typeof a === 'string');
      }

      // Add optional env
      if (server.env && typeof server.env === 'object' && !Array.isArray(server.env)) {
        config.env = {};
        for (const [key, value] of Object.entries(server.env)) {
          if (typeof value === 'string') {
            config.env[key] = value;
          }
        }
      }

      return config;
    });
}

/**
 * Validates hook configurations from parsed data.
 *
 * @param hooks - Raw hooks array from parsed JSON
 * @param index - Index of the discipline (for error messages)
 * @returns Array of validated HookConfig objects
 */
function validateHooks(hooks: unknown, index: number): HookConfig[] {
  if (hooks === undefined || hooks === null) {
    return [];
  }

  if (!Array.isArray(hooks)) {
    throw new Error(`Discipline at index ${index}: hooks must be an array`);
  }

  const validEvents = ['PreToolUse', 'PostToolUse', 'PreCommit', 'PostCommit'];

  return hooks
    .filter((h) => h && typeof h === 'object')
    .map((h, hookIndex) => {
      const hook = h as Record<string, unknown>;

      if (typeof hook.event !== 'string' || !validEvents.includes(hook.event)) {
        throw new Error(
          `Discipline at index ${index}, hook ${hookIndex}: event must be one of ${validEvents.join(', ')}`,
        );
      }

      if (typeof hook.command !== 'string' || !hook.command.trim()) {
        throw new Error(
          `Discipline at index ${index}, hook ${hookIndex}: command is required`,
        );
      }

      return {
        event: hook.event as HookConfig['event'],
        command: hook.command.trim(),
        description:
          typeof hook.description === 'string'
            ? hook.description.trim()
            : `Hook for ${hook.event}`,
        blocking: typeof hook.blocking === 'boolean' ? hook.blocking : false,
      };
    });
}

/**
 * Validates agent type suggestions from parsed data.
 *
 * @param agentTypes - Raw agent types array from parsed JSON
 * @param index - Index of the discipline (for error messages)
 * @returns Array of agent type strings
 */
function validateAgentTypes(agentTypes: unknown, index: number): string[] {
  if (agentTypes === undefined || agentTypes === null) {
    return [];
  }

  if (!Array.isArray(agentTypes)) {
    throw new Error(
      `Discipline at index ${index}: suggestedAgentTypes must be an array`,
    );
  }

  return agentTypes
    .filter((t) => typeof t === 'string' && t.trim())
    .map((t) => (t as string).trim());
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts parsed discipline data to a partial DisciplinePack.
 *
 * @description
 * This utility function converts ParsedDisciplineData to a partial DisciplinePack
 * that can be used with the discipline registry. The registry will add IDs,
 * timestamps, and other system-managed fields.
 *
 * @param parsed - Parsed discipline data from LLM response
 * @param parentVpId - Optional parent Orchestrator ID to associate with the discipline
 * @returns Partial DisciplinePack ready for registry creation
 *
 * @example
 * ```typescript
 * const parsed = parseDisciplineGenerationResponse(response);
 * const partialPacks = parsed.map(p => convertToDisciplinePack(p, 'vp_eng_001'));
 * // Pass to discipline registry for creation
 * ```
 */
export function convertToDisciplinePack(
  parsed: ParsedDisciplineData,
  parentVpId?: string,
): Omit<DisciplinePack, 'id' | 'slug' | 'createdAt' | 'updatedAt'> {
  return {
    name: parsed.name,
    description: parsed.description,
    category: parsed.category,
    claudeMd: parsed.claudeMd,
    mcpServers: parsed.mcpServers ?? [],
    hooks: parsed.hooks ?? [],
    agentIds: [], // Agents will be added after discipline creation
    parentVpId,
  };
}

/**
 * Generates a slug-safe string from a discipline name.
 *
 * @description
 * Creates a URL-safe slug from a discipline name by converting to lowercase,
 * replacing spaces with hyphens, and removing special characters.
 *
 * @param name - The discipline name to convert
 * @returns URL-safe slug string
 *
 * @example
 * ```typescript
 * generateDisciplineSlug('Frontend Development'); // 'frontend-development'
 * generateDisciplineSlug('Legal & Compliance'); // 'legal-compliance'
 * ```
 */
export function generateDisciplineSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type { DisciplinePack, DisciplineCategory, MCPServerConfig, HookConfig, ClaudeMdConfig };
