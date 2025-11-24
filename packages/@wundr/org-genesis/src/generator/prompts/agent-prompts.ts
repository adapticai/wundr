/**
 * @packageDocumentation
 * Agent-level prompt templates for organizational generation.
 *
 * This module provides prompt templates and builder functions for generating
 * Sub-Agent (Tier 3) definitions using LLM-powered generation. Sub-agents are
 * specialized worker units that perform actual tasks within the organizational
 * hierarchy.
 *
 * @module @wundr/org-genesis/generator/prompts/agent-prompts
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   buildAgentGenerationPrompt,
 *   parseAgentGenerationResponse,
 *   AgentGenerationContext,
 * } from '@wundr/org-genesis/generator/prompts/agent-prompts';
 *
 * const context: AgentGenerationContext = {
 *   disciplineName: 'Software Engineering',
 *   disciplineSlug: 'software-engineering',
 *   disciplineCategory: 'engineering',
 *   disciplineDescription: 'Full-stack software development discipline',
 * };
 *
 * const prompt = buildAgentGenerationPrompt(context);
 * // Use prompt with LLM, then parse response:
 * const agents = parseAgentGenerationResponse(llmResponse);
 * ```
 */

import type {
  AgentDefinition,
  AgentCapabilities,
  AgentTool,
  AgentScope,
  ModelAssignment,
  DisciplineCategory,
} from '../../types/index.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context information for agent generation.
 *
 * Provides the discipline-level context needed to generate appropriate
 * sub-agents that align with the discipline's purpose and workflows.
 *
 * @example
 * ```typescript
 * const context: AgentGenerationContext = {
 *   disciplineName: 'Contract Law',
 *   disciplineSlug: 'contract-law',
 *   disciplineCategory: 'legal',
 *   disciplineDescription: 'Handles contract drafting, review, and negotiation',
 *   existingAgents: [existingReviewerAgent],
 *   universalAgentTemplates: universalAgents,
 * };
 * ```
 */
export interface AgentGenerationContext {
  /**
   * Human-readable name of the parent discipline.
   */
  disciplineName: string;

  /**
   * URL-safe slug of the parent discipline.
   */
  disciplineSlug: string;

  /**
   * Category of the parent discipline.
   */
  disciplineCategory: DisciplineCategory | string;

  /**
   * Description of the parent discipline's purpose and scope.
   */
  disciplineDescription: string;

  /**
   * Optional existing agents already defined for this discipline.
   * Used to avoid generating duplicates.
   */
  existingAgents?: AgentDefinition[];

  /**
   * Optional universal agent templates to recommend.
   * These are agents available across all disciplines.
   */
  universalAgentTemplates?: AgentDefinition[];

  /**
   * Optional list of required workflows the agents should support.
   */
  requiredWorkflows?: string[];

  /**
   * Optional list of MCP tools available in the discipline.
   */
  availableMcpTools?: string[];

  /**
   * Optional maximum number of agents to generate.
   * @default 5
   */
  maxAgents?: number;
}

/**
 * Partial agent definition used during generation.
 *
 * Represents the agent fields that the LLM should generate, excluding
 * system-generated fields like id, createdAt, and updatedAt.
 */
export interface GeneratedAgentPartial {
  /**
   * Human-readable name for the agent.
   */
  name: string;

  /**
   * URL-safe slug for the agent.
   */
  slug: string;

  /**
   * Brief description of the agent's purpose.
   */
  description: string;

  /**
   * The agent's charter/system prompt.
   */
  charter: string;

  /**
   * Agent availability scope.
   */
  scope: AgentScope;

  /**
   * Model assignment for the agent.
   */
  model: ModelAssignment;

  /**
   * Tools available to the agent.
   */
  tools: AgentTool[];

  /**
   * Capability permissions for the agent.
   */
  capabilities: AgentCapabilities;

  /**
   * Tags for categorization.
   */
  tags: string[];

  /**
   * Whether this is a recommended universal agent.
   */
  isUniversal?: boolean;
}

/**
 * Refinement feedback for improving an agent definition.
 */
export interface AgentRefinementFeedback {
  /**
   * The type of refinement needed.
   */
  type: 'charter' | 'tools' | 'capabilities' | 'model' | 'general';

  /**
   * Specific feedback or instruction for refinement.
   */
  feedback: string;

  /**
   * Optional specific fields to focus on.
   */
  focusFields?: string[];
}

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for agent generation.
 *
 * Provides the LLM with comprehensive instructions for generating
 * well-structured sub-agent definitions that fit the organizational hierarchy.
 */
export const AGENT_GENERATION_SYSTEM_PROMPT = `
You are an agent architect specializing in organizational AI swarm design. Your task is to define specialized sub-agents (Tier 3) for Session Managers within a hierarchical organization.

## Understanding the Hierarchy

The organization follows a three-tier structure:
- **Tier 1: Virtual Principals (VPs)** - Executive coordinators overseeing multiple disciplines
- **Tier 2: Session Managers (Disciplines)** - Domain-specific coordinators managing workflows
- **Tier 3: Sub-Agents** - Specialized worker units that perform actual tasks

## Sub-Agent Categories

Sub-agents fall into two categories:
1. **Universal Agents**: Available to all disciplines regardless of domain
   - Examples: researcher, scribe, project-manager, reviewer, tester
   - These provide common functionality needed across all organizational units

2. **Discipline-Specific Agents**: Specialized for certain domains
   - Examples: code-reviewer (engineering), contract-analyst (legal), data-scientist (research)
   - These have deep expertise in their domain and may require specialized tools

## Agent Definition Requirements

Each agent definition must include:

### 1. Identity
- **name**: Human-readable display name (Title Case)
- **slug**: URL-safe identifier (kebab-case)
- **description**: 1-2 sentence summary of the agent's purpose

### 2. Charter
The charter is the agent's system prompt. It must include:
- Role definition and expertise area
- Key responsibilities (3-5 items)
- Decision-making guidelines
- Communication style expectations
- Constraints and limitations
- Escalation procedures

### 3. Model Assignment
Choose based on task complexity and latency requirements:
- **haiku**: Fast, low-cost tasks (simple queries, formatting, basic analysis)
- **sonnet**: Balanced reasoning tasks (code review, document analysis, moderate complexity)
- **opus**: Complex reasoning tasks (architecture decisions, complex analysis, critical judgments)

### 4. Tools
Specify the tools the agent needs:
- **builtin**: Native Claude Code tools (read, write, edit, bash, glob, grep)
- **mcp**: Model Context Protocol servers (github, database, browser, etc.)
- **custom**: Organization-specific tools

### 5. Capabilities
Define permissions following least-privilege principle:
- canReadFiles: Access to read filesystem
- canWriteFiles: Permission to create/modify files
- canExecuteCommands: Shell command execution
- canAccessNetwork: HTTP requests and API calls
- canSpawnSubAgents: Ability to delegate to other agents
- customCapabilities: Domain-specific permissions

## Output Format

Return a JSON array of agent definitions matching this schema:
\`\`\`json
[
  {
    "name": "Agent Name",
    "slug": "agent-name",
    "description": "Brief description",
    "charter": "Full charter text...",
    "scope": "discipline-specific" | "universal",
    "model": "haiku" | "sonnet" | "opus",
    "tools": [
      { "name": "tool-name", "type": "builtin" | "mcp" | "custom", "config": {} }
    ],
    "capabilities": {
      "canReadFiles": true,
      "canWriteFiles": false,
      "canExecuteCommands": false,
      "canAccessNetwork": false,
      "canSpawnSubAgents": false,
      "customCapabilities": []
    },
    "tags": ["tag1", "tag2"],
    "isUniversal": false
  }
]
\`\`\`

## Best Practices

1. **Specialization**: Each agent should have a clear, focused purpose
2. **Minimal Permissions**: Only grant capabilities necessary for the agent's tasks
3. **Clear Charters**: Write detailed, actionable charters that guide behavior
4. **Appropriate Models**: Match model capability to task complexity
5. **Tool Selection**: Include only tools the agent actually needs
6. **Complementary Roles**: Ensure agents work well together without overlap
`.trim();

/**
 * User prompt template for generating agents.
 *
 * Uses Handlebars-style placeholders for context injection.
 * The template guides the LLM to generate appropriate agents for a discipline.
 */
export const AGENT_GENERATION_USER_PROMPT = `
## Discipline Information

**Name**: {{disciplineName}}
**Slug**: {{disciplineSlug}}
**Category**: {{disciplineCategory}}
**Description**: {{disciplineDescription}}

{{#if requiredWorkflows}}
## Required Workflows
The agents should support these workflows:
{{#each requiredWorkflows}}
- {{this}}
{{/each}}
{{/if}}

{{#if availableMcpTools}}
## Available MCP Tools
These MCP tools are available in this discipline:
{{#each availableMcpTools}}
- {{this}}
{{/each}}
{{/if}}

{{#if existingAgents}}
## Existing Agents
The following agents already exist - do not duplicate them:
{{#each existingAgents}}
- {{this.name}} ({{this.slug}}): {{this.description}}
{{/each}}
{{/if}}

{{#if universalAgentTemplates}}
## Universal Agent Templates
Consider recommending these universal agents if appropriate:
{{#each universalAgentTemplates}}
- {{this.name}} ({{this.slug}}): {{this.description}}
{{/each}}
{{/if}}

## Task

Generate sub-agents for the "{{disciplineName}}" discipline. Include:
1. **Discipline-specific agents** tailored to this domain's workflows
2. **Recommended universal agents** that would benefit this discipline

For each agent, provide:
- Complete identity (name, slug, description)
- Detailed charter (system prompt)
- Model assignment (haiku for fast tasks, sonnet for reasoning, opus for complex)
- Required tools
- Capability permissions
- Relevant tags

{{#if maxAgents}}
Generate up to {{maxAgents}} agents total (including universal recommendations).
{{else}}
Generate 3-5 discipline-specific agents plus universal agent recommendations.
{{/if}}

Return the agents as a JSON array matching the AgentDefinition schema.
`.trim();

/**
 * System prompt for agent refinement.
 *
 * Used when iteratively improving an existing agent definition based on feedback.
 */
export const AGENT_REFINEMENT_SYSTEM_PROMPT = `
You are an agent architect refining an existing sub-agent definition. Your task is to improve the agent based on specific feedback while maintaining its core purpose and identity.

## Refinement Guidelines

When refining an agent:
1. **Preserve Identity**: Keep the agent's core purpose intact
2. **Address Feedback**: Directly address all feedback points
3. **Maintain Consistency**: Ensure changes don't conflict with existing configuration
4. **Validate Changes**: Ensure the refined agent is still coherent and functional

## Areas of Refinement

- **Charter**: Improve clarity, add missing responsibilities, refine guidelines
- **Tools**: Add missing tools, remove unnecessary ones, adjust configurations
- **Capabilities**: Adjust permissions based on actual requirements
- **Model**: Upgrade or downgrade based on task complexity assessment
- **General**: Overall improvements to coherence and effectiveness

## Output Format

Return the refined agent definition as a complete JSON object with all fields.
`.trim();

/**
 * User prompt template for agent refinement.
 */
export const AGENT_REFINEMENT_USER_PROMPT = `
## Current Agent Definition

\`\`\`json
{{agentJson}}
\`\`\`

## Refinement Feedback

**Type**: {{feedbackType}}
**Feedback**: {{feedback}}
{{#if focusFields}}
**Focus Areas**: {{focusFields}}
{{/if}}

## Task

Refine the agent definition based on the feedback above. Return the complete, updated agent definition as JSON.
`.trim();

// ============================================================================
// Prompt Builder Functions
// ============================================================================

/**
 * Builds a complete agent generation prompt from context.
 *
 * Processes the context and fills in the template placeholders to create
 * a prompt ready for LLM consumption.
 *
 * @param context - The agent generation context
 * @returns The formatted user prompt string
 *
 * @example
 * ```typescript
 * const context: AgentGenerationContext = {
 *   disciplineName: 'DevOps',
 *   disciplineSlug: 'devops',
 *   disciplineCategory: 'engineering',
 *   disciplineDescription: 'Infrastructure and deployment automation',
 *   maxAgents: 4,
 * };
 *
 * const prompt = buildAgentGenerationPrompt(context);
 * ```
 */
export function buildAgentGenerationPrompt(context: AgentGenerationContext): string {
  let prompt = AGENT_GENERATION_USER_PROMPT;

  // Replace simple placeholders
  prompt = prompt.replace(/\{\{disciplineName\}\}/g, context.disciplineName);
  prompt = prompt.replace(/\{\{disciplineSlug\}\}/g, context.disciplineSlug);
  prompt = prompt.replace(/\{\{disciplineCategory\}\}/g, String(context.disciplineCategory));
  prompt = prompt.replace(/\{\{disciplineDescription\}\}/g, context.disciplineDescription);

  // Handle maxAgents
  if (context.maxAgents !== undefined) {
    prompt = prompt.replace(/\{\{maxAgents\}\}/g, String(context.maxAgents));
    prompt = prompt.replace(
      /\{\{#if maxAgents\}\}([\s\S]*?)\{\{\/if\}\}/g,
      '$1',
    );
  } else {
    prompt = prompt.replace(/\{\{#if maxAgents\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Handle requiredWorkflows
  if (context.requiredWorkflows && context.requiredWorkflows.length > 0) {
    const workflowsList = context.requiredWorkflows.map((w) => `- ${w}`).join('\n');
    prompt = prompt.replace(
      /\{\{#if requiredWorkflows\}\}[\s\S]*?\{\{#each requiredWorkflows\}\}[\s\S]*?\{\{this\}\}[\s\S]*?\{\{\/each\}\}[\s\S]*?\{\{\/if\}\}/g,
      `## Required Workflows\nThe agents should support these workflows:\n${workflowsList}`,
    );
  } else {
    prompt = prompt.replace(/\{\{#if requiredWorkflows\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Handle availableMcpTools
  if (context.availableMcpTools && context.availableMcpTools.length > 0) {
    const toolsList = context.availableMcpTools.map((t) => `- ${t}`).join('\n');
    prompt = prompt.replace(
      /\{\{#if availableMcpTools\}\}[\s\S]*?\{\{#each availableMcpTools\}\}[\s\S]*?\{\{this\}\}[\s\S]*?\{\{\/each\}\}[\s\S]*?\{\{\/if\}\}/g,
      `## Available MCP Tools\nThese MCP tools are available in this discipline:\n${toolsList}`,
    );
  } else {
    prompt = prompt.replace(/\{\{#if availableMcpTools\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Handle existingAgents
  if (context.existingAgents && context.existingAgents.length > 0) {
    const agentsList = context.existingAgents
      .map((a) => `- ${a.name} (${a.slug}): ${a.description}`)
      .join('\n');
    prompt = prompt.replace(
      /\{\{#if existingAgents\}\}[\s\S]*?\{\{#each existingAgents\}\}[\s\S]*?\{\{\/each\}\}[\s\S]*?\{\{\/if\}\}/g,
      `## Existing Agents\nThe following agents already exist - do not duplicate them:\n${agentsList}`,
    );
  } else {
    prompt = prompt.replace(/\{\{#if existingAgents\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Handle universalAgentTemplates
  if (context.universalAgentTemplates && context.universalAgentTemplates.length > 0) {
    const templatesList = context.universalAgentTemplates
      .map((a) => `- ${a.name} (${a.slug}): ${a.description}`)
      .join('\n');
    prompt = prompt.replace(
      /\{\{#if universalAgentTemplates\}\}[\s\S]*?\{\{#each universalAgentTemplates\}\}[\s\S]*?\{\{\/each\}\}[\s\S]*?\{\{\/if\}\}/g,
      `## Universal Agent Templates\nConsider recommending these universal agents if appropriate:\n${templatesList}`,
    );
  } else {
    prompt = prompt.replace(/\{\{#if universalAgentTemplates\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Clean up any extra newlines
  prompt = prompt.replace(/\n{3,}/g, '\n\n');

  return prompt.trim();
}

/**
 * Builds a prompt for refining an existing agent definition.
 *
 * @param agent - The agent definition to refine
 * @param feedback - The refinement feedback
 * @returns The formatted refinement prompt string
 *
 * @example
 * ```typescript
 * const feedback: AgentRefinementFeedback = {
 *   type: 'charter',
 *   feedback: 'Add more specific guidelines for handling edge cases',
 *   focusFields: ['charter'],
 * };
 *
 * const prompt = buildAgentRefinementPrompt(existingAgent, feedback);
 * ```
 */
export function buildAgentRefinementPrompt(
  agent: AgentDefinition,
  feedback: AgentRefinementFeedback,
): string {
  let prompt = AGENT_REFINEMENT_USER_PROMPT;

  // Create a clean agent object for JSON serialization
  const agentForJson: GeneratedAgentPartial & { id?: string; tier?: number } = {
    name: agent.name,
    slug: agent.slug,
    description: agent.description,
    charter: agent.charter,
    scope: agent.scope,
    model: agent.model,
    tools: agent.tools,
    capabilities: agent.capabilities,
    tags: agent.tags,
  };

  // Replace placeholders
  prompt = prompt.replace(/\{\{agentJson\}\}/g, JSON.stringify(agentForJson, null, 2));
  prompt = prompt.replace(/\{\{feedbackType\}\}/g, feedback.type);
  prompt = prompt.replace(/\{\{feedback\}\}/g, feedback.feedback);

  // Handle focusFields
  if (feedback.focusFields && feedback.focusFields.length > 0) {
    prompt = prompt.replace(/\{\{focusFields\}\}/g, feedback.focusFields.join(', '));
    prompt = prompt.replace(
      /\{\{#if focusFields\}\}([\s\S]*?)\{\{\/if\}\}/g,
      '$1',
    );
  } else {
    prompt = prompt.replace(/\{\{#if focusFields\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  return prompt.trim();
}

/**
 * Builds a specialized prompt for generating agents of a specific type.
 *
 * @param context - The agent generation context
 * @param agentType - The specific type of agent to generate
 * @returns The formatted prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildSpecializedAgentPrompt(context, 'reviewer');
 * ```
 */
export function buildSpecializedAgentPrompt(
  context: AgentGenerationContext,
  agentType: 'researcher' | 'scribe' | 'reviewer' | 'tester' | 'custom',
): string {
  const typeDescriptions: Record<string, string> = {
    researcher: `
Generate a specialized RESEARCHER agent for the "${context.disciplineName}" discipline.

The researcher should:
- Gather information relevant to ${context.disciplineCategory} domain
- Analyze data and synthesize findings
- Support decision-making with evidence-based insights
- Document research methodology and sources

Focus on domain-specific research capabilities.`,

    scribe: `
Generate a specialized SCRIBE agent for the "${context.disciplineName}" discipline.

The scribe should:
- Document decisions, meetings, and processes
- Maintain clear and organized records
- Create standardized documentation templates
- Support knowledge management for ${context.disciplineCategory}

Focus on domain-specific documentation needs.`,

    reviewer: `
Generate a specialized REVIEWER agent for the "${context.disciplineName}" discipline.

The reviewer should:
- Review work output for quality and correctness
- Apply ${context.disciplineCategory}-specific standards
- Provide constructive feedback
- Track and verify issue resolution

Focus on domain-specific review criteria.`,

    tester: `
Generate a specialized TESTER agent for the "${context.disciplineName}" discipline.

The tester should:
- Create and execute tests relevant to ${context.disciplineCategory}
- Validate functionality and requirements
- Report issues with clear reproduction steps
- Track test coverage and results

Focus on domain-specific testing methodologies.`,

    custom: `
Generate a custom agent tailored to the "${context.disciplineName}" discipline.

The agent should:
- Address specific needs of the ${context.disciplineCategory} domain
- Complement existing agents without overlap
- Have clear responsibilities and constraints

Focus on unique discipline requirements.`,
  };

  const basePrompt = buildAgentGenerationPrompt(context);
  const specializationInstructions = typeDescriptions[agentType] || typeDescriptions.custom;

  return `${basePrompt}\n\n## Specialization Instructions\n${specializationInstructions.trim()}`;
}

// ============================================================================
// Response Parsing Functions
// ============================================================================

/**
 * Parses an LLM response into agent definitions.
 *
 * Extracts JSON from the response, validates the structure, and returns
 * properly typed agent definitions. Handles various response formats including
 * markdown code blocks.
 *
 * @param response - The raw LLM response string
 * @returns Array of parsed agent definitions (partial, without system fields)
 * @throws Error if the response cannot be parsed or validated
 *
 * @example
 * ```typescript
 * const llmResponse = `Here are the agents:
 * \`\`\`json
 * [{"name": "Code Reviewer", "slug": "code-reviewer", ...}]
 * \`\`\``;
 *
 * const agents = parseAgentGenerationResponse(llmResponse);
 * ```
 */
export function parseAgentGenerationResponse(response: string): GeneratedAgentPartial[] {
  // Extract JSON from the response
  const jsonContent = extractJsonFromResponse(response);

  if (!jsonContent) {
    throw new Error('No valid JSON found in response');
  }

  // Parse the JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate it's an array
  if (!Array.isArray(parsed)) {
    // If it's a single object, wrap it in an array
    if (typeof parsed === 'object' && parsed !== null) {
      parsed = [parsed];
    } else {
      throw new Error('Response must be an array of agent definitions');
    }
  }

  // Validate and transform each agent
  const agents: GeneratedAgentPartial[] = [];
  const parsedArray = parsed as unknown[];
  for (const item of parsedArray) {
    const validated = validateAgentPartial(item);
    if (validated) {
      agents.push(validated);
    }
  }

  if (agents.length === 0) {
    throw new Error('No valid agent definitions found in response');
  }

  return agents;
}

/**
 * Extracts JSON content from an LLM response.
 *
 * Handles various formats:
 * - Raw JSON arrays or objects
 * - JSON wrapped in markdown code blocks
 * - JSON embedded in explanatory text
 *
 * @param response - The raw response string
 * @returns The extracted JSON string or null if not found
 */
export function extractJsonFromResponse(response: string): string | null {
  // Try to find JSON in markdown code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find a JSON array
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Try to find a JSON object
  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return null;
}

/**
 * Validates and transforms a raw object into a GeneratedAgentPartial.
 *
 * @param item - The raw object to validate
 * @returns The validated agent partial or null if invalid
 */
export function validateAgentPartial(item: unknown): GeneratedAgentPartial | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const obj = item as Record<string, unknown>;

  // Required fields
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    return null;
  }
  if (typeof obj.slug !== 'string' || !obj.slug.trim()) {
    return null;
  }
  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    return null;
  }
  if (typeof obj.charter !== 'string' || !obj.charter.trim()) {
    return null;
  }

  // Validate scope
  const scope = validateScope(obj.scope);

  // Validate model
  const model = validateModel(obj.model);

  // Validate tools
  const tools = validateTools(obj.tools);

  // Validate capabilities
  const capabilities = validateCapabilities(obj.capabilities);

  // Validate tags
  const tags = validateTags(obj.tags);

  return {
    name: obj.name.trim(),
    slug: obj.slug.trim().toLowerCase(),
    description: obj.description.trim(),
    charter: obj.charter.trim(),
    scope,
    model,
    tools,
    capabilities,
    tags,
    isUniversal: obj.isUniversal === true || scope === 'universal',
  };
}

/**
 * Validates and normalizes a scope value.
 */
function validateScope(value: unknown): AgentScope {
  if (value === 'universal' || value === 'discipline-specific') {
    return value;
  }
  return 'discipline-specific';
}

/**
 * Validates and normalizes a model value.
 */
function validateModel(value: unknown): ModelAssignment {
  if (value === 'opus' || value === 'sonnet' || value === 'haiku') {
    return value;
  }
  return 'sonnet';
}

/**
 * Validates and normalizes tools array.
 */
function validateTools(value: unknown): AgentTool[] {
  if (!Array.isArray(value)) {
    return [
      { name: 'read', type: 'builtin' },
      { name: 'glob', type: 'builtin' },
      { name: 'grep', type: 'builtin' },
    ];
  }

  const tools: AgentTool[] = [];
  for (const tool of value) {
    if (typeof tool === 'object' && tool !== null) {
      const t = tool as Record<string, unknown>;
      if (typeof t.name === 'string' && t.name.trim()) {
        const toolType = t.type === 'mcp' || t.type === 'builtin' || t.type === 'custom'
          ? t.type
          : 'builtin';
        tools.push({
          name: t.name.trim(),
          type: toolType,
          config: typeof t.config === 'object' && t.config !== null
            ? t.config as Record<string, unknown>
            : undefined,
        });
      }
    }
  }

  return tools.length > 0 ? tools : [
    { name: 'read', type: 'builtin' },
    { name: 'glob', type: 'builtin' },
    { name: 'grep', type: 'builtin' },
  ];
}

/**
 * Validates and normalizes capabilities.
 */
function validateCapabilities(value: unknown): AgentCapabilities {
  const defaults: AgentCapabilities = {
    canReadFiles: true,
    canWriteFiles: false,
    canExecuteCommands: false,
    canAccessNetwork: false,
    canSpawnSubAgents: false,
  };

  if (typeof value !== 'object' || value === null) {
    return defaults;
  }

  const obj = value as Record<string, unknown>;

  return {
    canReadFiles: typeof obj.canReadFiles === 'boolean' ? obj.canReadFiles : defaults.canReadFiles,
    canWriteFiles: typeof obj.canWriteFiles === 'boolean' ? obj.canWriteFiles : defaults.canWriteFiles,
    canExecuteCommands: typeof obj.canExecuteCommands === 'boolean' ? obj.canExecuteCommands : defaults.canExecuteCommands,
    canAccessNetwork: typeof obj.canAccessNetwork === 'boolean' ? obj.canAccessNetwork : defaults.canAccessNetwork,
    canSpawnSubAgents: typeof obj.canSpawnSubAgents === 'boolean' ? obj.canSpawnSubAgents : defaults.canSpawnSubAgents,
    customCapabilities: Array.isArray(obj.customCapabilities)
      ? obj.customCapabilities.filter((c): c is string => typeof c === 'string')
      : undefined,
  };
}

/**
 * Validates and normalizes tags array.
 */
function validateTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a GeneratedAgentPartial to a full AgentDefinition.
 *
 * Adds system-generated fields like id, tier, timestamps, and discipline assignments.
 *
 * @param partial - The generated agent partial
 * @param disciplineSlug - The slug of the parent discipline
 * @param idSuffix - Optional suffix for the ID
 * @returns A complete AgentDefinition
 *
 * @example
 * ```typescript
 * const partial = parseAgentGenerationResponse(response)[0];
 * const agent = convertToAgentDefinition(partial, 'software-engineering', '001');
 * ```
 */
export function convertToAgentDefinition(
  partial: GeneratedAgentPartial,
  disciplineSlug: string,
  idSuffix?: string,
): AgentDefinition {
  const now = new Date();
  const suffix = idSuffix || String(Date.now()).slice(-6);

  return {
    id: `agent-${partial.slug}-${suffix}`,
    name: partial.name,
    slug: partial.slug,
    tier: 3,
    scope: partial.scope,
    description: partial.description,
    charter: partial.charter,
    model: partial.model,
    tools: partial.tools,
    capabilities: partial.capabilities,
    usedByDisciplines: partial.scope === 'universal' ? [] : [disciplineSlug],
    usedByVps: [],
    tags: partial.tags,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates a unique ID for an agent.
 *
 * @param slug - The agent's slug
 * @returns A unique agent ID
 */
export function generateAgentId(slug: string): string {
  const suffix = String(Date.now()).slice(-6);
  return `agent-${slug}-${suffix}`;
}

/**
 * Creates the messages array for LLM API calls.
 *
 * @param context - The agent generation context
 * @returns Array of messages for the LLM
 *
 * @example
 * ```typescript
 * const messages = createAgentGenerationMessages(context);
 * const response = await llm.complete({ messages });
 * ```
 */
export function createAgentGenerationMessages(
  context: AgentGenerationContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: AGENT_GENERATION_SYSTEM_PROMPT },
    { role: 'user', content: buildAgentGenerationPrompt(context) },
  ];
}

/**
 * Creates the messages array for agent refinement.
 *
 * @param agent - The agent to refine
 * @param feedback - The refinement feedback
 * @returns Array of messages for the LLM
 */
export function createAgentRefinementMessages(
  agent: AgentDefinition,
  feedback: AgentRefinementFeedback,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: AGENT_REFINEMENT_SYSTEM_PROMPT },
    { role: 'user', content: buildAgentRefinementPrompt(agent, feedback) },
  ];
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Types are exported above with their definitions
};
