/**
 * @fileoverview VP-level prompt templates for organizational generation
 *
 * This module provides prompt templates and builder functions for generating
 * VP (Vice President / Virtual Persona) agents in the organizational hierarchy.
 * VPs are Tier 1 supervisory agents responsible for node orchestration,
 * context compilation, task triage, and resource management.
 *
 * @module @wundr/org-genesis/generator/prompts/vp-prompts
 * @version 1.0.0
 */

import type {
  VPCharter,
  VPCapability,
  ResourceLimits,
  MeasurableObjectives,
  HardConstraints,
} from '../../types/index.js';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context required for VP generation prompts.
 *
 * Provides all the organizational context needed to generate
 * appropriate VP agents for the organization.
 *
 * @example
 * ```typescript
 * const context: VPGenerationContext = {
 *   orgName: 'Acme Corporation',
 *   industry: 'technology',
 *   mission: 'Innovate solutions for a better tomorrow',
 *   size: 'medium',
 *   nodeCount: 5,
 *   vpCount: 3,
 * };
 * ```
 */
export interface VPGenerationContext {
  /** Human-readable name of the organization */
  orgName: string;

  /** Industry classification of the organization */
  industry: string;

  /** Organization's mission statement */
  mission: string;

  /** Size tier of the organization (small, medium, large, enterprise) */
  size: string;

  /** Number of compute nodes available for VP assignment */
  nodeCount: number;

  /** Number of VPs to generate */
  vpCount: number;

  /** Optional list of existing VPs to avoid duplication */
  existingVPs?: VPCharter[];

  /** Optional description for additional context */
  description?: string;

  /** Optional list of discipline names to inform VP generation */
  disciplineNames?: string[];

  /** Optional custom directives to include in generation */
  customDirectives?: string[];
}

/**
 * Parsed VP data from LLM response.
 *
 * Represents the raw VP data extracted from the LLM response
 * before full VPCharter construction.
 */
export interface ParsedVPData {
  /** Display name for the VP */
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
  capabilities: VPCapability[];

  /** List of authorized MCP tools */
  mcpTools: string[];

  /** Optional discipline IDs this VP oversees */
  disciplineIds?: string[];

  /** Optional custom resource limits */
  resourceLimits?: Partial<ResourceLimits>;

  /** Optional custom objectives */
  objectives?: Partial<MeasurableObjectives>;

  /** Optional custom constraints */
  constraints?: Partial<HardConstraints>;
}

/**
 * Result of parsing VP generation response.
 */
export interface VPParseResult {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed VP data (if successful) */
  vps: ParsedVPData[];

  /** Any parsing errors encountered */
  errors: string[];

  /** Raw response for debugging */
  rawResponse?: string;
}

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for VP generation.
 *
 * Establishes the LLM's role as an organizational architect
 * specialized in defining Tier 1 VP agents.
 */
export const VP_GENERATION_SYSTEM_PROMPT = `
You are an organizational architect specializing in AI-managed autonomous systems.
Your task is to define the Tier 1 VP (Vice President / Virtual Persona) layer for
an AI-managed organization. Each VP is a supervisor agent responsible for:

1. **Node Orchestration** - Managing a physical or virtual compute node within the cluster
2. **Context Compilation** - Assembling runtime environments and context for sessions
3. **Task Triage** - Analyzing, prioritizing, and routing incoming requests to appropriate Session Managers
4. **Resource Management** - Monitoring and allocating CPU, RAM, tokens, and other computational resources
5. **Memory Coordination** - Managing persistent and episodic memory stores across the organization

VPs do NOT code or perform atomic tasks directly. They coordinate, delegate, and supervise.

Key Principles:
- Each VP should have a distinct personality and communication style
- VP names should be professional and reflect their supervisory role
- Capabilities should be appropriate for their oversight responsibilities
- MCP tools should enable coordination, monitoring, and delegation
- Core directives should align with the organization's mission

Response Format:
Always return VP definitions as a valid JSON array. Each VP object must include:
- name: Human-readable display name
- slug: URL-safe identifier (lowercase, hyphenated)
- persona: Description of personality and communication style (2-3 sentences)
- slackHandle: Slack username for notifications (without @)
- coreDirective: Primary mission statement (1-2 sentences)
- capabilities: Array of VP capability strings
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
 * - {{vpCount}} - Number of VPs to generate
 * - {{existingVPs}} - Optional existing VP information
 * - {{disciplines}} - Optional discipline information
 */
export const VP_GENERATION_USER_PROMPT = `
Organization: {{orgName}}
Industry: {{industry}}
Mission: {{mission}}
Size: {{size}}
Node Count: {{nodeCount}}
{{#if description}}
Description: {{description}}
{{/if}}
{{#if existingVPs}}

Existing VPs (avoid duplicating these):
{{existingVPs}}
{{/if}}
{{#if disciplines}}

Disciplines to oversee:
{{disciplines}}
{{/if}}
{{#if customDirectives}}

Additional Requirements:
{{customDirectives}}
{{/if}}

Generate {{vpCount}} VP agents for this organization. Each VP should:
1. Have a unique name that reflects their supervisory role
2. Have a distinct persona with professional communication style
3. Have a Slack handle for workspace integration
4. Have a clear core directive aligned with the mission
5. Have appropriate capabilities for their responsibilities
6. Have MCP tools suited for coordination and oversight

Return the VPs as a JSON array with the following structure for each VP:
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
 * System prompt for VP refinement.
 *
 * Used when iterating on an existing VP based on feedback.
 */
export const VP_REFINEMENT_SYSTEM_PROMPT = `
You are refining a VP (Vice President / Virtual Persona) agent definition based on feedback.
Your task is to adjust the VP's characteristics while maintaining consistency with the
organizational context and Tier 1 supervisor responsibilities.

Maintain these invariants:
- VPs are supervisors, not workers - they delegate, don't execute
- Capabilities should be appropriate for coordination and oversight
- MCP tools should enable monitoring, delegation, and resource management
- The VP's persona should remain professional and distinct

Apply the feedback while preserving:
- The VP's core identity and role
- Alignment with organizational mission
- Appropriate capability scope
- Professional communication standards
`.trim();

/**
 * User prompt template for VP refinement.
 *
 * Contains placeholders for:
 * - {{vpJson}} - Current VP definition as JSON
 * - {{feedback}} - Feedback to incorporate
 */
export const VP_REFINEMENT_USER_PROMPT = `
Current VP Definition:
{{vpJson}}

Feedback to incorporate:
{{feedback}}

Please refine this VP definition based on the feedback. Return the updated VP as a single JSON object with the same structure:
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
 * Default MCP tools for VP agents.
 *
 * These tools provide the baseline coordination capabilities
 * that all VPs should have access to.
 */
export const DEFAULT_VP_MCP_TOOLS: string[] = [
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
 * Default capabilities for VP agents.
 *
 * All VP capabilities are enabled by default, as VPs
 * require full coordination authority.
 */
export const DEFAULT_VP_CAPABILITIES: VPCapability[] = [
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
 * Builds the VP generation prompt from context.
 *
 * Replaces template placeholders with actual values from the
 * VPGenerationContext. Handles optional fields and arrays.
 *
 * @param context - The VP generation context
 * @returns The formatted user prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildVPGenerationPrompt({
 *   orgName: 'Acme Corp',
 *   industry: 'technology',
 *   mission: 'Innovate for tomorrow',
 *   size: 'medium',
 *   nodeCount: 5,
 *   vpCount: 3,
 * });
 * ```
 */
export function buildVPGenerationPrompt(context: VPGenerationContext): string {
  let prompt = VP_GENERATION_USER_PROMPT;

  // Replace required placeholders
  prompt = prompt.replace('{{orgName}}', context.orgName);
  prompt = prompt.replace('{{industry}}', context.industry);
  prompt = prompt.replace('{{mission}}', context.mission);
  prompt = prompt.replace('{{size}}', context.size);
  prompt = prompt.replace('{{nodeCount}}', String(context.nodeCount));
  prompt = prompt.replace('{{vpCount}}', String(context.vpCount));

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
  if (context.existingVPs && context.existingVPs.length > 0) {
    const existingVPSummary = context.existingVPs
      .map((vp) => `- ${vp.identity.name} (${vp.identity.slug}): ${vp.coreDirective}`)
      .join('\n');
    prompt = prompt.replace(
      '{{#if existingVPs}}\n\nExisting VPs (avoid duplicating these):\n{{existingVPs}}\n{{/if}}',
      `\nExisting VPs (avoid duplicating these):\n${existingVPSummary}`,
    );
  } else {
    prompt = prompt.replace(
      '{{#if existingVPs}}\n\nExisting VPs (avoid duplicating these):\n{{existingVPs}}\n{{/if}}',
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
 * Builds the VP refinement prompt from an existing VP and feedback.
 *
 * Creates a prompt for iterating on a VP definition based on
 * user or system feedback.
 *
 * @param vp - The current VP charter to refine
 * @param feedback - The feedback to incorporate
 * @returns The formatted refinement prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildVPRefinementPrompt(
 *   existingVP,
 *   'Make the persona more approachable and add memory_management capability',
 * );
 * ```
 */
export function buildVPRefinementPrompt(vp: VPCharter, feedback: string): string {
  // Convert VP to the parsed format for the prompt
  const vpData: ParsedVPData = {
    name: vp.identity.name,
    slug: vp.identity.slug,
    persona: vp.identity.persona,
    slackHandle: vp.identity.slackHandle,
    coreDirective: vp.coreDirective,
    capabilities: vp.capabilities,
    mcpTools: vp.mcpTools,
    disciplineIds: vp.disciplineIds,
  };

  let prompt = VP_REFINEMENT_USER_PROMPT;
  prompt = prompt.replace('{{vpJson}}', JSON.stringify(vpData, null, 2));
  prompt = prompt.replace('{{feedback}}', feedback);

  return prompt;
}

/**
 * Builds the complete prompt messages for VP generation.
 *
 * Returns an array of message objects suitable for chat completion APIs.
 *
 * @param context - The VP generation context
 * @returns Array of chat messages with system and user prompts
 *
 * @example
 * ```typescript
 * const messages = buildVPGenerationMessages(context);
 * const response = await llm.chat(messages);
 * ```
 */
export function buildVPGenerationMessages(
  context: VPGenerationContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: VP_GENERATION_SYSTEM_PROMPT },
    { role: 'user', content: buildVPGenerationPrompt(context) },
  ];
}

/**
 * Builds the complete prompt messages for VP refinement.
 *
 * Returns an array of message objects suitable for chat completion APIs.
 *
 * @param vp - The VP charter to refine
 * @param feedback - The feedback to incorporate
 * @returns Array of chat messages with system and user prompts
 */
export function buildVPRefinementMessages(
  vp: VPCharter,
  feedback: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: VP_REFINEMENT_SYSTEM_PROMPT },
    { role: 'user', content: buildVPRefinementPrompt(vp, feedback) },
  ];
}

// ============================================================================
// Response Parsing Functions
// ============================================================================

/**
 * Parses the VP generation response from an LLM.
 *
 * Extracts VP data from the response text, handling various
 * response formats (JSON array, JSON in code blocks, etc.).
 *
 * @param response - The raw LLM response text
 * @returns Parsed VP data result with success status and any errors
 *
 * @example
 * ```typescript
 * const result = parseVPGenerationResponse(llmResponse);
 * if (result.success) {
 *   const vps = result.vps;
 *   // Process VPs...
 * } else {
 *   console.error('Parse errors:', result.errors);
 * }
 * ```
 */
export function parseVPGenerationResponse(response: string): VPParseResult {
  const errors: string[] = [];

  try {
    // Try to extract JSON from the response
    const jsonContent = extractJsonFromResponse(response);

    if (!jsonContent) {
      return {
        success: false,
        vps: [],
        errors: ['No valid JSON found in response'],
        rawResponse: response,
      };
    }

    // Parse the JSON
    const parsed = JSON.parse(jsonContent);

    // Handle both array and single object responses
    const vpArray = Array.isArray(parsed) ? parsed : [parsed];

    // Validate and convert each VP
    const vps: ParsedVPData[] = [];

    for (let i = 0; i < vpArray.length; i++) {
      const vpData = vpArray[i];
      const validationResult = validateParsedVP(vpData, i);

      if (validationResult.valid) {
        vps.push(normalizeParsedVP(vpData));
      } else {
        errors.push(...validationResult.errors);
      }
    }

    return {
      success: vps.length > 0,
      vps,
      errors,
      rawResponse: response,
    };
  } catch (error) {
    return {
      success: false,
      vps: [],
      errors: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`],
      rawResponse: response,
    };
  }
}

/**
 * Parses the VP refinement response from an LLM.
 *
 * Extracts a single refined VP from the response.
 *
 * @param response - The raw LLM response text
 * @returns Parsed VP data result
 */
export function parseVPRefinementResponse(response: string): VPParseResult {
  const result = parseVPGenerationResponse(response);

  // For refinement, we expect exactly one VP
  if (result.success && result.vps.length > 1) {
    return {
      ...result,
      vps: [result.vps[0]],
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
 * Validates a parsed VP object.
 *
 * @param vpData - The raw parsed VP data
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
    return { valid: false, errors: [`${prefix}: Invalid VP object`] };
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
 * Normalizes parsed VP data with defaults.
 *
 * @param vpData - The raw parsed VP data
 * @returns Normalized ParsedVPData with all required fields
 */
function normalizeParsedVP(vpData: Record<string, unknown>): ParsedVPData {
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
      (cap): cap is VPCapability =>
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
      : DEFAULT_VP_MCP_TOOLS,
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
 * Combines default VP tools with industry-specific tools.
 *
 * @param industry - The industry type
 * @returns Array of recommended MCP tool names
 *
 * @example
 * ```typescript
 * const tools = getIndustryMCPTools('technology');
 * // Returns: [...DEFAULT_VP_MCP_TOOLS, 'github_swarm', 'code_review', 'repo_analyze']
 * ```
 */
export function getIndustryMCPTools(industry: string): string[] {
  const industryTools = INDUSTRY_SPECIFIC_TOOLS[industry] || [];
  return [...new Set([...DEFAULT_VP_MCP_TOOLS, ...industryTools])];
}

/**
 * Generates a VP count recommendation based on organization size and node count.
 *
 * @param size - The organization size tier
 * @param nodeCount - The number of available compute nodes
 * @returns Recommended number of VPs
 *
 * @example
 * ```typescript
 * const vpCount = getRecommendedVPCount('medium', 5);
 * // Returns: 5 (one VP per node for medium orgs)
 * ```
 */
export function getRecommendedVPCount(size: string, nodeCount: number): number {
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
 * Validates that a VP generation context has all required fields.
 *
 * @param context - The context to validate
 * @returns Validation result with any errors
 *
 * @example
 * ```typescript
 * const validation = validateVPGenerationContext(context);
 * if (!validation.valid) {
 *   throw new Error(validation.errors.join(', '));
 * }
 * ```
 */
export function validateVPGenerationContext(
  context: Partial<VPGenerationContext>,
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

  if (typeof context.vpCount !== 'number' || context.vpCount < 1) {
    errors.push('vpCount is required and must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Converts parsed VP data to a VPCharter array format.
 *
 * This is a utility for downstream processing; actual VPCharter
 * creation should use the VP generator module.
 *
 * @param parsedVPs - Array of parsed VP data
 * @param orgId - Organization ID for reference
 * @returns Array of partial VPCharter objects ready for completion
 */
export function convertParsedVPsToCharters(
  parsedVPs: ParsedVPData[],
  _orgId: string,
): Array<Omit<VPCharter, 'id' | 'createdAt' | 'updatedAt'>> {
  return parsedVPs.map((vp) => ({
    tier: 1 as const,
    identity: {
      name: vp.name,
      slug: vp.slug,
      persona: vp.persona,
      slackHandle: vp.slackHandle,
    },
    coreDirective: vp.coreDirective,
    capabilities: vp.capabilities.length > 0 ? vp.capabilities : DEFAULT_VP_CAPABILITIES,
    mcpTools: vp.mcpTools.length > 0 ? vp.mcpTools : DEFAULT_VP_MCP_TOOLS,
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
