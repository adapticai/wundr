/**
 * @fileoverview Orchestrator-level prompt templates for organizational generation
 *
 * This module provides prompt templates and builder functions for generating
 * Orchestrator (Orchestrator / Orchestrator) agents in the organizational hierarchy.
 * VPs are Tier 1 supervisory agents responsible for node orchestration,
 * context compilation, task triage, and resource management.
 *
 * @module @wundr/org-genesis/generator/prompts/orchestrator-prompts
 * @version 1.0.0
 */

import type {
  HardConstraints,
  MeasurableObjectives,
  OrchestratorCapability,
  OrchestratorCharter,
  ResourceLimits,
} from '../../types/index.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context required for Orchestrator generation prompts.
 *
 * Provides all the organizational context needed to generate
 * appropriate Orchestrator agents for the organization.
 *
 * @example
 * ```typescript
 * const context: OrchestratorGenerationContext = {
 *   orgName: 'Acme Corporation',
 *   industry: 'technology',
 *   mission: 'Innovate solutions for a better tomorrow',
 *   size: 'medium',
 *   nodeCount: 5,
 *   orchestratorCount: 3,
 * };
 * ```
 */
export interface OrchestratorGenerationContext {
  /** Human-readable name of the organization */
  orgName: string;

  /** Industry classification of the organization */
  industry: string;

  /** Organization's mission statement */
  mission: string;

  /** Size tier of the organization (small, medium, large, enterprise) */
  size: string;

  /** Number of compute nodes available for Orchestrator assignment */
  nodeCount: number;

  /** Number of VPs to generate */
  orchestratorCount: number;

  /** Optional list of existing VPs to avoid duplication */
  existingOrchestrators?: OrchestratorCharter[];

  /** Optional description for additional context */
  description?: string;

  /** Optional list of discipline names to inform Orchestrator generation */
  disciplineNames?: string[];

  /** Optional custom directives to include in generation */
  customDirectives?: string[];
}

/**
 * Parsed Orchestrator data from LLM response.
 *
 * Represents the raw Orchestrator data extracted from the LLM response
 * before full OrchestratorCharter construction.
 */
export interface ParsedOrchestratorData {
  /** Display name for the Orchestrator */
  name: string;

  /** URL-safe slug identifier */
  slug: string;

  /** Personality and communication style description */
  persona: string;

  /** Optional Slack handle */
  slackHandle?: string;

  /** Core mission directive */
  coreDirective: string;

  /** List of granted capabilities */
  capabilities: OrchestratorCapability[];

  /** List of authorized MCP tools */
  mcpTools: string[];

  /** Optional discipline IDs this Orchestrator oversees */
  disciplineIds?: string[];

  /** Optional custom resource limits */
  resourceLimits?: Partial<ResourceLimits>;

  /** Optional custom objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Optional custom constraints */
  constraints?: Partial<HardConstraints>;
}

/**
 * Result of parsing Orchestrator generation response.
 */
export interface OrchestratorParseResult {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed Orchestrator data (if successful) */
  orchestrators: ParsedOrchestratorData[];

  /** Any parsing errors encountered */
  errors: string[];

  /** Raw response for debugging */
  rawResponse?: string;
}

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for Orchestrator generation.
 *
 * Establishes the LLM's role as an organizational architect
 * specialized in defining Tier 1 Orchestrator agents.
 */
export const ORCHESTRATOR_GENERATION_SYSTEM_PROMPT = `
You are an organizational architect specializing in AI-managed autonomous systems.
Your task is to define the Tier 1 Orchestrator (Orchestrator / Orchestrator) layer for
an AI-managed organization. Each Orchestrator is a supervisor agent responsible for:

1. **Node Orchestration** - Managing a physical or virtual compute node within the cluster
2. **Context Compilation** - Assembling runtime environments and context for sessions
3. **Task Triage** - Analyzing, prioritizing, and routing incoming requests to appropriate Session Managers
4. **Resource Management** - Monitoring and allocating CPU, RAM, tokens, and other computational resources
5. **Memory Coordination** - Managing persistent and episodic memory stores across the organization

VPs do NOT code or perform atomic tasks directly. They coordinate, delegate, and supervise.

Key Principles:
- Each Orchestrator should have a distinct personality and communication style
- Orchestrator names should be professional and reflect their supervisory role
- Capabilities should be appropriate for their oversight responsibilities
- MCP tools should enable coordination, monitoring, and delegation
- Core directives should align with the organization's mission

Response Format:
Always return Orchestrator definitions as a valid JSON array. Each Orchestrator object must include:
- name: Human-readable display name
- slug: URL-safe identifier (lowercase, hyphenated)
- persona: Description of personality and communication style (2-3 sentences)
- slackHandle: Slack username for notifications (without @)
- coreDirective: Primary mission statement (1-2 sentences)
- capabilities: Array of Orchestrator capability strings
- mcpTools: Array of MCP tool names for coordination

Valid capabilities: context_compilation, resource_management, slack_operations,
session_spawning, task_triage, memory_management
`.trim();

/**
 * User prompt template for generating VPs.
 *
 * Contains placeholders for organizational context:
 * - {{orgName}} - Organization name
 * - {{industry}} - Industry classification
 * - {{mission}} - Mission statement
 * - {{size}} - Organization size tier
 * - {{nodeCount}} - Number of compute nodes
 * - {{orchestratorCount}} - Number of VPs to generate
 * - {{existingOrchestrators}} - Optional existing Orchestrator information
 * - {{disciplines}} - Optional discipline information
 */
export const ORCHESTRATOR_GENERATION_USER_PROMPT = `
Organization: {{orgName}}
Industry: {{industry}}
Mission: {{mission}}
Size: {{size}}
Node Count: {{nodeCount}}
{{#if description}}
Description: {{description}}
{{/if}}
{{#if existingOrchestrators}}

Existing VPs (avoid duplicating these):
{{existingOrchestrators}}
{{/if}}
{{#if disciplines}}

Disciplines to oversee:
{{disciplines}}
{{/if}}
{{#if customDirectives}}

Additional Requirements:
{{customDirectives}}
{{/if}}

Generate {{orchestratorCount}} Orchestrator agents for this organization. Each Orchestrator should:
1. Have a unique name that reflects their supervisory role
2. Have a distinct persona with professional communication style
3. Have a Slack handle for workspace integration
4. Have a clear core directive aligned with the mission
5. Have appropriate capabilities for their responsibilities
6. Have MCP tools suited for coordination and oversight

Return the Orchestrators as a JSON array with the following structure for each VP:
{
  "name": "string",
  "slug": "string (lowercase, hyphenated)",
  "persona": "string (2-3 sentences describing personality)",
  "slackHandle": "string (without @)",
  "coreDirective": "string (1-2 sentences)",
  "capabilities": ["string"],
  "mcpTools": ["string"],
  "disciplineIds": ["string"] // optional
}
`.trim();

/**
 * System prompt for Orchestrator refinement.
 *
 * Used when iterating on an existing Orchestrator based on feedback.
 */
export const ORCHESTRATOR_REFINEMENT_SYSTEM_PROMPT = `
You are refining a Orchestrator (Orchestrator / Orchestrator) agent definition based on feedback.
Your task is to adjust the Orchestrator's characteristics while maintaining consistency with the
organizational context and Tier 1 supervisor responsibilities.

Maintain these invariants:
- VPs are supervisors, not workers - they delegate, don't execute
- Capabilities should be appropriate for coordination and oversight
- MCP tools should enable monitoring, delegation, and resource management
- The Orchestrator's persona should remain professional and distinct

Apply the feedback while preserving:
- The Orchestrator's core identity and role
- Alignment with organizational mission
- Appropriate capability scope
- Professional communication standards
`.trim();

/**
 * User prompt template for Orchestrator refinement.
 *
 * Contains placeholders for:
 * - {{vpJson}} - Current Orchestrator definition as JSON
 * - {{feedback}} - Feedback to incorporate
 */
export const ORCHESTRATOR_REFINEMENT_USER_PROMPT = `
Current Orchestrator Definition:
{{vpJson}}

Feedback to incorporate:
{{feedback}}

Please refine this Orchestrator definition based on the feedback. Return the updated Orchestrator as a single JSON object with the same structure:
{
  "name": "string",
  "slug": "string",
  "persona": "string",
  "slackHandle": "string",
  "coreDirective": "string",
  "capabilities": ["string"],
  "mcpTools": ["string"],
  "disciplineIds": ["string"]
}
`.trim();

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default MCP tools for Orchestrator agents.
 *
 * These tools provide the baseline coordination capabilities
 * that all VPs should have access to.
 */
export const DEFAULT_ORCHESTRATOR_MCP_TOOLS: string[] = [
  'agent_spawn',
  'task_orchestrate',
  'swarm_status',
  'agent_list',
  'agent_metrics',
  'memory_usage',
  'task_status',
  'task_results',
  'swarm_monitor',
];

/**
 * Default capabilities for Orchestrator agents.
 *
 * All Orchestrator capabilities are enabled by default, as VPs
 * require full coordination authority.
 */
export const DEFAULT_VP_CAPABILITIES: OrchestratorCapability[] = [
  'context_compilation',
  'resource_management',
  'slack_operations',
  'session_spawning',
  'task_triage',
  'memory_management',
];

/**
 * Industry-specific recommended MCP tools.
 *
 * Maps industry types to additional MCP tools that may be
 * useful for VPs in that domain.
 */
export const INDUSTRY_SPECIFIC_TOOLS: Record<string, string[]> = {
  technology: ['github_swarm', 'code_review', 'repo_analyze'],
  finance: ['audit_logger', 'compliance_check', 'risk_monitor'],
  healthcare: ['hipaa_validator', 'phi_redactor', 'audit_trail'],
  legal: ['document_review', 'compliance_audit', 'case_manager'],
  marketing: ['analytics_tracker', 'campaign_monitor', 'content_scheduler'],
  manufacturing: ['inventory_tracker', 'quality_monitor', 'supply_chain'],
  retail: ['inventory_manager', 'order_tracker', 'customer_insights'],
  gaming: ['player_analytics', 'match_coordinator', 'leaderboard_manager'],
  media: ['content_moderator', 'asset_manager', 'distribution_tracker'],
};

// ============================================================================
// Prompt Builder Functions
// ============================================================================

/**
 * Builds the Orchestrator generation prompt from context.
 *
 * Replaces template placeholders with actual values from the
 * OrchestratorGenerationContext. Handles optional fields and arrays.
 *
 * @param context - The Orchestrator generation context
 * @returns The formatted user prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildOrchestratorGenerationPrompt({
 *   orgName: 'Acme Corp',
 *   industry: 'technology',
 *   mission: 'Innovate for tomorrow',
 *   size: 'medium',
 *   nodeCount: 5,
 *   orchestratorCount: 3,
 * });
 * ```
 */
export function buildOrchestratorGenerationPrompt(context: OrchestratorGenerationContext): string {
  let prompt = ORCHESTRATOR_GENERATION_USER_PROMPT;

  // Replace required placeholders
  prompt = prompt.replace('{{orgName}}', context.orgName);
  prompt = prompt.replace('{{industry}}', context.industry);
  prompt = prompt.replace('{{mission}}', context.mission);
  prompt = prompt.replace('{{size}}', context.size);
  prompt = prompt.replace('{{nodeCount}}', String(context.nodeCount));
  prompt = prompt.replace('{{orchestratorCount}}', String(context.orchestratorCount));

  // Handle optional description
  if (context.description) {
    prompt = prompt.replace(
      '{{#if description}}\nDescription: {{description}}\n{{/if}}',
      `Description: ${context.description}`,
    );
  } else {
    prompt = prompt.replace('{{#if description}}\nDescription: {{description}}\n{{/if}}', '');
  }

  // Handle existing VPs
  if (context.existingOrchestrators && context.existingOrchestrators.length > 0) {
    const existingVPSummary = context.existingOrchestrators
      .map((vp) => `- ${vp.identity.name} (${vp.identity.slug}): ${vp.coreDirective}`)
      .join('\n');
    prompt = prompt.replace(
      '{{#if existingOrchestrators}}\n\nExisting VPs (avoid duplicating these):\n{{existingOrchestrators}}\n{{/if}}',
      `\nExisting VPs (avoid duplicating these):\n${existingVPSummary}`,
    );
  } else {
    prompt = prompt.replace(
      '{{#if existingOrchestrators}}\n\nExisting VPs (avoid duplicating these):\n{{existingOrchestrators}}\n{{/if}}',
      '',
    );
  }

  // Handle disciplines
  if (context.disciplineNames && context.disciplineNames.length > 0) {
    const disciplineList = context.disciplineNames.map((d) => `- ${d}`).join('\n');
    prompt = prompt.replace(
      '{{#if disciplines}}\n\nDisciplines to oversee:\n{{disciplines}}\n{{/if}}',
      `\nDisciplines to oversee:\n${disciplineList}`,
    );
  } else {
    prompt = prompt.replace(
      '{{#if disciplines}}\n\nDisciplines to oversee:\n{{disciplines}}\n{{/if}}',
      '',
    );
  }

  // Handle custom directives
  if (context.customDirectives && context.customDirectives.length > 0) {
    const directivesList = context.customDirectives.map((d) => `- ${d}`).join('\n');
    prompt = prompt.replace(
      '{{#if customDirectives}}\n\nAdditional Requirements:\n{{customDirectives}}\n{{/if}}',
      `\nAdditional Requirements:\n${directivesList}`,
    );
  } else {
    prompt = prompt.replace(
      '{{#if customDirectives}}\n\nAdditional Requirements:\n{{customDirectives}}\n{{/if}}',
      '',
    );
  }

  return prompt.trim();
}

/**
 * Builds the Orchestrator refinement prompt from an existing Orchestrator and feedback.
 *
 * Creates a prompt for iterating on a Orchestrator definition based on
 * user or system feedback.
 *
 * @param vp - The current Orchestrator charter to refine
 * @param feedback - The feedback to incorporate
 * @returns The formatted refinement prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildOrchestratorRefinementPrompt(
 *   existingVP,
 *   'Make the persona more approachable and add memory_management capability',
 * );
 * ```
 */
export function buildOrchestratorRefinementPrompt(vp: OrchestratorCharter, feedback: string): string {
  // Convert Orchestrator to the parsed format for the prompt
  const vpData: ParsedOrchestratorData = {
    name: vp.identity.name,
    slug: vp.identity.slug,
    persona: vp.identity.persona,
    slackHandle: vp.identity.slackHandle,
    coreDirective: vp.coreDirective,
    capabilities: vp.capabilities,
    mcpTools: vp.mcpTools,
    disciplineIds: vp.disciplineIds,
  };

  let prompt = ORCHESTRATOR_REFINEMENT_USER_PROMPT;
  prompt = prompt.replace('{{vpJson}}', JSON.stringify(vpData, null, 2));
  prompt = prompt.replace('{{feedback}}', feedback);

  return prompt;
}

/**
 * Builds the complete prompt messages for Orchestrator generation.
 *
 * Returns an array of message objects suitable for chat completion APIs.
 *
 * @param context - The Orchestrator generation context
 * @returns Array of chat messages with system and user prompts
 *
 * @example
 * ```typescript
 * const messages = buildOrchestratorGenerationMessages(context);
 * const response = await llm.chat(messages);
 * ```
 */
export function buildOrchestratorGenerationMessages(
  context: OrchestratorGenerationContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: ORCHESTRATOR_GENERATION_SYSTEM_PROMPT },
    { role: 'user', content: buildOrchestratorGenerationPrompt(context) },
  ];
}

/**
 * Builds the complete prompt messages for Orchestrator refinement.
 *
 * Returns an array of message objects suitable for chat completion APIs.
 *
 * @param vp - The Orchestrator charter to refine
 * @param feedback - The feedback to incorporate
 * @returns Array of chat messages with system and user prompts
 */
export function buildOrchestratorRefinementMessages(
  vp: OrchestratorCharter,
  feedback: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: ORCHESTRATOR_REFINEMENT_SYSTEM_PROMPT },
    { role: 'user', content: buildOrchestratorRefinementPrompt(vp, feedback) },
  ];
}

// ============================================================================
// Response Parsing Functions
// ============================================================================

/**
 * Parses the Orchestrator generation response from an LLM.
 *
 * Extracts Orchestrator data from the response text, handling various
 * response formats (JSON array, JSON in code blocks, etc.).
 *
 * @param response - The raw LLM response text
 * @returns Parsed Orchestrator data result with success status and any errors
 *
 * @example
 * ```typescript
 * const result = parseOrchestratorGenerationResponse(llmResponse);
 * if (result.success) {
 *   const orchestrators = result.vps;
 *   // Process VPs...
 * } else {
 *   console.error('Parse errors:', result.errors);
 * }
 * ```
 */
export function parseOrchestratorGenerationResponse(response: string): OrchestratorParseResult {
  const errors: string[] = [];

  try {
    // Try to extract JSON from the response
    const jsonContent = extractJsonFromResponse(response);

    if (!jsonContent) {
      return {
        success: false,
        orchestrators: [],
        errors: ['No valid JSON found in response'],
        rawResponse: response,
      };
    }

    // Parse the JSON
    const parsed = JSON.parse(jsonContent);

    // Handle both array and single object responses
    const vpArray = Array.isArray(parsed) ? parsed : [parsed];

    // Validate and convert each Orchestrator
    const orchestrators: ParsedOrchestratorData[] = [];

    for (let i = 0; i < vpArray.length; i++) {
      const vpData = vpArray[i];
      const validationResult = validateParsedVP(vpData, i);

      if (validationResult.valid) {
        orchestrators.push(normalizeParsedVP(vpData));
      } else {
        errors.push(...validationResult.errors);
      }
    }

    return {
      success: orchestrators.length > 0,
      orchestrators,
      errors,
      rawResponse: response,
    };
  } catch (error) {
    return {
      success: false,
      orchestrators: [],
      errors: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`],
      rawResponse: response,
    };
  }
}

/**
 * Parses the Orchestrator refinement response from an LLM.
 *
 * Extracts a single refined Orchestrator from the response.
 *
 * @param response - The raw LLM response text
 * @returns Parsed Orchestrator data result
 */
export function parseOrchestratorRefinementResponse(response: string): OrchestratorParseResult {
  const result = parseOrchestratorGenerationResponse(response);

  // For refinement, we expect exactly one Orchestrator
  if (result.success && result.vps.length > 1) {
    return {
      ...result,
      orchestrators: [result.vps[0]],
      errors: [...result.errors, 'Multiple VPs returned, using first one'],
    };
  }

  return result;
}

/**
 * Extracts JSON content from a response that may contain markdown code blocks.
 *
 * @param response - The raw response text
 * @returns The extracted JSON string, or null if not found
 */
function extractJsonFromResponse(response: string): string | null {
  // Try to find JSON in code blocks first
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
 * Validates a parsed Orchestrator object.
 *
 * @param vpData - The raw parsed Orchestrator data
 * @param index - The index in the array for error reporting
 * @returns Validation result with valid status and errors
 */
function validateParsedVP(
  vpData: unknown,
  index: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = `VP[${index}]`;

  if (typeof vpData !== 'object' || vpData === null) {
    return { valid: false, errors: [`${prefix}: Invalid Orchestrator object`] };
  }

  const vp = vpData as Record<string, unknown>;

  // Required fields
  if (typeof vp.name !== 'string' || !vp.name.trim()) {
    errors.push(`${prefix}: Missing or invalid 'name' field`);
  }

  if (typeof vp.persona !== 'string' || !vp.persona.trim()) {
    errors.push(`${prefix}: Missing or invalid 'persona' field`);
  }

  if (typeof vp.coreDirective !== 'string' || !vp.coreDirective.trim()) {
    errors.push(`${prefix}: Missing or invalid 'coreDirective' field`);
  }

  // Capabilities validation
  if (!Array.isArray(vp.capabilities)) {
    errors.push(`${prefix}: Missing or invalid 'capabilities' array`);
  } else {
    const validCapabilities = new Set<string>([
      'context_compilation',
      'resource_management',
      'slack_operations',
      'session_spawning',
      'task_triage',
      'memory_management',
    ]);

    for (const cap of vp.capabilities) {
      if (typeof cap !== 'string' || !validCapabilities.has(cap)) {
        errors.push(`${prefix}: Invalid capability '${cap}'`);
      }
    }
  }

  // MCP tools validation
  if (!Array.isArray(vp.mcpTools)) {
    errors.push(`${prefix}: Missing or invalid 'mcpTools' array`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalizes parsed Orchestrator data with defaults.
 *
 * @param vpData - The raw parsed Orchestrator data
 * @returns Normalized ParsedOrchestratorData with all required fields
 */
function normalizeParsedVP(vpData: Record<string, unknown>): ParsedOrchestratorData {
  const name = String(vpData.name).trim();

  return {
    name,
    slug:
      typeof vpData.slug === 'string' && vpData.slug.trim()
        ? vpData.slug.trim()
        : generateSlug(name),
    persona: String(vpData.persona).trim(),
    slackHandle:
      typeof vpData.slackHandle === 'string' && vpData.slackHandle.trim()
        ? vpData.slackHandle.trim().replace(/^@/, '')
        : undefined,
    coreDirective: String(vpData.coreDirective).trim(),
    capabilities: (vpData.capabilities as string[]).filter(
      (cap): cap is OrchestratorCapability =>
        typeof cap === 'string' &&
        [
          'context_compilation',
          'resource_management',
          'slack_operations',
          'session_spawning',
          'task_triage',
          'memory_management',
        ].includes(cap),
    ),
    mcpTools: Array.isArray(vpData.mcpTools)
      ? (vpData.mcpTools as unknown[]).filter((t): t is string => typeof t === 'string')
      : DEFAULT_ORCHESTRATOR_MCP_TOOLS,
    disciplineIds: Array.isArray(vpData.disciplineIds)
      ? (vpData.disciplineIds as unknown[]).filter((d): d is string => typeof d === 'string')
      : undefined,
    resourceLimits:
      typeof vpData.resourceLimits === 'object' && vpData.resourceLimits !== null
        ? (vpData.resourceLimits as Partial<ResourceLimits>)
        : undefined,
    objectives:
      typeof vpData.objectives === 'object' && vpData.objectives !== null
        ? (vpData.objectives as Partial<MeasurableObjectives>)
        : undefined,
    constraints:
      typeof vpData.constraints === 'object' && vpData.constraints !== null
        ? (vpData.constraints as Partial<HardConstraints>)
        : undefined,
  };
}

/**
 * Generates a URL-safe slug from a name.
 *
 * @param name - The name to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets recommended MCP tools for a specific industry.
 *
 * Combines default Orchestrator tools with industry-specific tools.
 *
 * @param industry - The industry type
 * @returns Array of recommended MCP tool names
 *
 * @example
 * ```typescript
 * const tools = getIndustryMCPTools('technology');
 * // Returns: [...DEFAULT_ORCHESTRATOR_MCP_TOOLS, 'github_swarm', 'code_review', 'repo_analyze']
 * ```
 */
export function getIndustryMCPTools(industry: string): string[] {
  const industryTools = INDUSTRY_SPECIFIC_TOOLS[industry] || [];
  return [...new Set([...DEFAULT_ORCHESTRATOR_MCP_TOOLS, ...industryTools])];
}

/**
 * Generates a Orchestrator count recommendation based on organization size and node count.
 *
 * @param size - The organization size tier
 * @param nodeCount - The number of available compute nodes
 * @returns Recommended number of VPs
 *
 * @example
 * ```typescript
 * const orchestratorCount = getRecommendedOrchestratorCount('medium', 5);
 * // Returns: 5 (one Orchestrator per node for medium orgs)
 * ```
 */
export function getRecommendedOrchestratorCount(size: string, nodeCount: number): number {
  const sizeFactor: Record<string, number> = {
    small: 1,
    medium: 1,
    large: 1.5,
    enterprise: 2,
  };

  const factor = sizeFactor[size] || 1;
  return Math.ceil(nodeCount * factor);
}

/**
 * Validates that a Orchestrator generation context has all required fields.
 *
 * @param context - The context to validate
 * @returns Validation result with any errors
 *
 * @example
 * ```typescript
 * const validation = validateOrchestratorGenerationContext(context);
 * if (!validation.valid) {
 *   throw new Error(validation.errors.join(', '));
 * }
 * ```
 */
export function validateOrchestratorGenerationContext(
  context: Partial<OrchestratorGenerationContext>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!context.orgName || typeof context.orgName !== 'string') {
    errors.push('orgName is required and must be a string');
  }

  if (!context.industry || typeof context.industry !== 'string') {
    errors.push('industry is required and must be a string');
  }

  if (!context.mission || typeof context.mission !== 'string') {
    errors.push('mission is required and must be a string');
  }

  if (!context.size || typeof context.size !== 'string') {
    errors.push('size is required and must be a string');
  }

  if (typeof context.nodeCount !== 'number' || context.nodeCount < 1) {
    errors.push('nodeCount is required and must be a positive number');
  }

  if (typeof context.orchestratorCount !== 'number' || context.orchestratorCount < 1) {
    errors.push('orchestratorCount is required and must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Converts parsed Orchestrator data to a OrchestratorCharter array format.
 *
 * This is a utility for downstream processing; actual OrchestratorCharter
 * creation should use the Orchestrator generator module.
 *
 * @param parsedOrchestrators - Array of parsed Orchestrator data
 * @param orgId - Organization ID for reference
 * @returns Array of partial OrchestratorCharter objects ready for completion
 */
export function convertParsedOrchestratorsToCharters(
  parsedOrchestrators: ParsedOrchestratorData[],
  _orgId: string,
): Array<Omit<OrchestratorCharter, 'id' | 'createdAt' | 'updatedAt'>> {
  return parsedOrchestrators.map((vp) => ({
    tier: 1 as const,
    identity: {
      name: vp.name,
      slug: vp.slug,
      persona: vp.persona,
      slackHandle: vp.slackHandle,
    },
    coreDirective: vp.coreDirective,
    capabilities: vp.capabilities.length > 0 ? vp.capabilities : DEFAULT_VP_CAPABILITIES,
    mcpTools: vp.mcpTools.length > 0 ? vp.mcpTools : DEFAULT_ORCHESTRATOR_MCP_TOOLS,
    resourceLimits: {
      maxConcurrentSessions: vp.resourceLimits?.maxConcurrentSessions ?? 10,
      tokenBudgetPerHour: vp.resourceLimits?.tokenBudgetPerHour ?? 500000,
      maxMemoryMB: vp.resourceLimits?.maxMemoryMB ?? 1024,
      maxCpuPercent: vp.resourceLimits?.maxCpuPercent ?? 50,
    },
    objectives: {
      responseTimeTarget: vp.objectives?.responseTimeTarget ?? 10,
      taskCompletionRate: vp.objectives?.taskCompletionRate ?? 90,
      qualityScore: vp.objectives?.qualityScore ?? 85,
      customMetrics: vp.objectives?.customMetrics,
    },
    constraints: {
      forbiddenCommands: vp.constraints?.forbiddenCommands ?? [
        'rm -rf /',
        'rm -rf /*',
        'sudo rm',
        'chmod 777',
      ],
      forbiddenPaths: vp.constraints?.forbiddenPaths ?? [
        '/etc/passwd',
        '/etc/shadow',
        '~/.ssh',
        '.env',
      ],
      forbiddenActions: vp.constraints?.forbiddenActions ?? [
        'delete_production_database',
        'disable_security_features',
      ],
      requireApprovalFor: vp.constraints?.requireApprovalFor ?? [
        'deploy_to_production',
        'merge_to_main',
      ],
    },
    disciplineIds: vp.disciplineIds ?? [],
  }));
}
