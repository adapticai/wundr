/**
 * @fileoverview VP Generator - Generates VP (Tier 1) agents for organizations
 *
 * This module provides the VPGenerator class responsible for generating, refining,
 * and validating Virtual Persona (VP) agents. VPs are Tier 1 supervisory agents
 * that manage node orchestration, context compilation, task triage, and resource
 * management within the organizational hierarchy.
 *
 * @module @wundr/org-genesis/generator/vp-generator
 * @version 1.0.0
 */

import {
  type VPGenerationContext,
  type ParsedVPData,
  buildVPGenerationMessages,
  buildVPRefinementMessages,
  parseVPGenerationResponse,
  parseVPRefinementResponse,
  validateVPGenerationContext,
  DEFAULT_VP_MCP_TOOLS,
  DEFAULT_VP_CAPABILITIES,
  getIndustryMCPTools,
} from './prompts/vp-prompts.js';
import { generateVpId, generateSlug, ensureUniqueSlug } from '../utils/slug.js';

import type {
  VPCharter,
  VPCapability,
  ResourceLimits,
  MeasurableObjectives,
  HardConstraints,
  CharterValidationError,
  CharterValidationWarning,
} from '../types/index.js';

// Note: VPGenerationContext is exported via prompts/index.js

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the VP Generator.
 *
 * Controls the behavior and limits of VP generation, including maximum
 * counts, default settings, and LLM integration options.
 *
 * @example
 * ```typescript
 * const config: VPGeneratorConfig = {
 *   maxVPs: 10,
 *   useDefaults: true,
 *   modelId: 'claude-3-opus-20240229',
 *   maxRetries: 3,
 * };
 * ```
 */
export interface VPGeneratorConfig {
  /**
   * Maximum number of VPs that can be generated in a single operation.
   * @default 16
   */
  maxVPs?: number;

  /**
   * Whether to fill in default values for omitted charter properties.
   * @default true
   */
  useDefaults?: boolean;

  /**
   * Model ID for LLM generation (for future Anthropic SDK integration).
   * @default 'claude-3-sonnet-20240229'
   */
  modelId?: string;

  /**
   * Maximum number of retries for LLM calls.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Temperature for LLM generation (0-1).
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens for LLM response.
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Enable mock mode for testing without LLM calls.
   * @default false
   */
  mockMode?: boolean;

  /**
   * Optional callback for custom LLM integration.
   */
  llmCallback?: LLMCallbackFn;
}

/**
 * Type definition for LLM callback function.
 *
 * Allows custom LLM integration for VP generation.
 */
export type LLMCallbackFn = (
  messages: Array<{ role: 'system' | 'user'; content: string }>
) => Promise<string>;

/**
 * Result of a VP generation operation.
 *
 * Contains the generated VPs along with any warnings and usage metadata.
 *
 * @example
 * ```typescript
 * const result: GenerateVPsResult = await generator.generate(context);
 * if (result.vps.length > 0) {
 *   console.log(`Generated ${result.vps.length} VPs`);
 *   if (result.warnings.length > 0) {
 *     console.warn('Warnings:', result.warnings);
 *   }
 * }
 * ```
 */
export interface GenerateVPsResult {
  /** Array of generated VP charters */
  vps: VPCharter[];

  /** Warnings generated during the process (non-blocking issues) */
  warnings: string[];

  /** Number of tokens used in generation (if available) */
  tokensUsed?: number;

  /** Duration of generation in milliseconds */
  durationMs?: number;

  /** Whether mock data was used instead of LLM */
  usedMock?: boolean;

  /** Raw LLM response for debugging */
  rawResponse?: string;
}

/**
 * Result of a VP refinement operation.
 *
 * Contains the refined VP charter along with metadata.
 */
export interface RefineVPResult {
  /** The refined VP charter */
  vp: VPCharter;

  /** Warnings generated during refinement */
  warnings: string[];

  /** Number of tokens used in refinement (if available) */
  tokensUsed?: number;

  /** Duration of refinement in milliseconds */
  durationMs?: number;
}

/**
 * Validation result for VP charters.
 *
 * Extends the base CharterValidationResult with VP-specific fields.
 */
export interface VPValidationResult {
  /** Whether the charter is valid */
  valid: boolean;

  /** List of validation errors (blocking) */
  errors: CharterValidationError[];

  /** List of validation warnings (non-blocking) */
  warnings: CharterValidationWarning[];

  /** Suggested fixes for common issues */
  suggestions?: string[];
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default configuration for VP Generator.
 */
const DEFAULT_CONFIG: Required<VPGeneratorConfig> = {
  maxVPs: 16,
  useDefaults: true,
  modelId: 'claude-3-sonnet-20240229',
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 4096,
  mockMode: false,
  llmCallback: async () => '',
};

/**
 * Default VP resource limits.
 */
const VP_RESOURCE_DEFAULTS: ResourceLimits = {
  maxConcurrentSessions: 10,
  tokenBudgetPerHour: 500000,
  maxMemoryMB: 1024,
  maxCpuPercent: 50,
};

/**
 * Default VP measurable objectives.
 */
const VP_OBJECTIVES_DEFAULTS: MeasurableObjectives = {
  responseTimeTarget: 10,
  taskCompletionRate: 90,
  qualityScore: 85,
};

/**
 * Default hard constraints for VP agents.
 */
const VP_CONSTRAINTS_DEFAULTS: HardConstraints = {
  forbiddenCommands: [
    'rm -rf /',
    'rm -rf /*',
    'sudo rm',
    'chmod 777',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:',
  ],
  forbiddenPaths: [
    '/etc/passwd',
    '/etc/shadow',
    '/root',
    '~/.ssh',
    '.env',
    '.env.local',
    '.env.production',
    'credentials.json',
    'secrets.yaml',
  ],
  forbiddenActions: [
    'delete_production_database',
    'modify_authentication_config',
    'disable_security_features',
    'expose_secrets',
  ],
  requireApprovalFor: [
    'deploy_to_production',
    'merge_to_main',
    'modify_infrastructure',
    'change_billing',
    'delete_user_data',
  ],
};

// ============================================================================
// VPGenerator Class
// ============================================================================

/**
 * VP Generator - Generates VP (Tier 1) agents for organizations.
 *
 * The VPGenerator is responsible for creating, refining, and validating
 * VP charters based on organizational context. It supports both LLM-powered
 * generation and mock mode for testing.
 *
 * @example
 * ```typescript
 * // Create generator with default config
 * const generator = new VPGenerator();
 *
 * // Generate VPs for an organization
 * const result = await generator.generate({
 *   orgName: 'Acme Corporation',
 *   industry: 'technology',
 *   mission: 'Innovate solutions for a better tomorrow',
 *   size: 'medium',
 *   nodeCount: 5,
 *   vpCount: 3,
 * });
 *
 * console.log(`Generated ${result.vps.length} VPs`);
 * ```
 *
 * @example
 * ```typescript
 * // Create generator with custom LLM callback
 * const generator = new VPGenerator({
 *   llmCallback: async (messages) => {
 *     const response = await anthropic.messages.create({
 *       model: 'claude-3-sonnet-20240229',
 *       messages: messages,
 *     });
 *     return response.content[0].text;
 *   },
 * });
 * ```
 */
export class VPGenerator {
  /** Generator configuration */
  private readonly config: Required<VPGeneratorConfig>;

  /** Optional registry reference for storing generated VPs */
  private registry: Map<string, VPCharter> | null = null;

  /** Cache of generated VPs for deduplication */
  private generatedSlugs: Set<string> = new Set();

  /**
   * Creates a new VPGenerator instance.
   *
   * @param config - Optional configuration options
   *
   * @example
   * ```typescript
   * // Default configuration
   * const generator = new VPGenerator();
   *
   * // With custom configuration
   * const generator = new VPGenerator({
   *   maxVPs: 10,
   *   mockMode: true,
   * });
   * ```
   */
  constructor(config?: VPGeneratorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Generates VP charters based on the provided organizational context.
   *
   * This method either calls an LLM to generate VPs or returns mock data
   * depending on the configuration. Generated VPs are validated and
   * enriched with default values before being returned.
   *
   * @param context - The organizational context for VP generation
   * @returns Promise resolving to generated VPs with metadata
   * @throws Error if context validation fails
   *
   * @example
   * ```typescript
   * const result = await generator.generate({
   *   orgName: 'TechStartup Inc',
   *   industry: 'technology',
   *   mission: 'Build the future of AI',
   *   size: 'small',
   *   nodeCount: 3,
   *   vpCount: 2,
   * });
   *
   * for (const vp of result.vps) {
   *   console.log(`VP: ${vp.identity.name} - ${vp.coreDirective}`);
   * }
   * ```
   */
  async generate(context: VPGenerationContext): Promise<GenerateVPsResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Validate context
    const validation = validateVPGenerationContext(context);
    if (!validation.valid) {
      throw new Error(
        `Invalid generation context: ${validation.errors.join(', ')}`,
      );
    }

    // Enforce max VP limit
    const requestedCount = Math.min(context.vpCount, this.config.maxVPs);
    if (context.vpCount > this.config.maxVPs) {
      warnings.push(
        `Requested ${context.vpCount} VPs, but max is ${this.config.maxVPs}. Generating ${requestedCount}.`,
      );
    }

    // Update context with clamped count
    const adjustedContext = { ...context, vpCount: requestedCount };

    // Track existing VP slugs for deduplication
    if (context.existingVPs) {
      for (const vp of context.existingVPs) {
        this.generatedSlugs.add(vp.identity.slug);
      }
    }

    // Generate VPs via LLM or mock
    let rawResponse: string;
    let usedMock = false;

    if (this.config.mockMode || !this.config.llmCallback) {
      rawResponse = this.generateMockResponse(adjustedContext);
      usedMock = true;
    } else {
      const messages = buildVPGenerationMessages(adjustedContext);
      rawResponse = await this.callLLM(messages);
    }

    // Parse the response
    const parseResult = parseVPGenerationResponse(rawResponse);

    if (!parseResult.success) {
      return {
        vps: [],
        warnings: [...warnings, ...parseResult.errors],
        durationMs: Date.now() - startTime,
        usedMock,
        rawResponse,
      };
    }

    // Convert parsed data to full VPCharter objects
    const vps = this.buildVPCharters(parseResult.vps, context);

    // Validate each charter
    for (const vp of vps) {
      const charterValidation = this.validateCharter(vp);
      if (!charterValidation.valid) {
        warnings.push(
          `VP '${vp.identity.name}' has validation issues: ${charterValidation.errors.map(e => e.message).join(', ')}`,
        );
      }
      if (charterValidation.warnings.length > 0) {
        warnings.push(
          ...charterValidation.warnings.map(
            w => `VP '${vp.identity.name}': ${w.message}`,
          ),
        );
      }
    }

    // Store in registry if available
    if (this.registry) {
      for (const vp of vps) {
        this.registry.set(vp.id, vp);
      }
    }

    return {
      vps,
      warnings,
      durationMs: Date.now() - startTime,
      usedMock,
      rawResponse: this.config.mockMode ? undefined : rawResponse,
    };
  }

  /**
   * Refines an existing VP charter based on feedback.
   *
   * Takes an existing VP charter and feedback string, then generates
   * an updated version incorporating the requested changes.
   *
   * @param vp - The existing VP charter to refine
   * @param feedback - Feedback describing desired changes
   * @returns Promise resolving to the refined VP charter
   *
   * @example
   * ```typescript
   * const refined = await generator.refine(
   *   existingVP,
   *   'Make the persona more collaborative and add memory_management capability',
   * );
   *
   * console.log(`Updated VP: ${refined.vp.identity.name}`);
   * ```
   */
  async refine(vp: VPCharter, feedback: string): Promise<RefineVPResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (!feedback.trim()) {
      throw new Error('Feedback cannot be empty');
    }

    let rawResponse: string;

    if (this.config.mockMode || !this.config.llmCallback) {
      rawResponse = this.generateMockRefinementResponse(vp, feedback);
    } else {
      const messages = buildVPRefinementMessages(vp, feedback);
      rawResponse = await this.callLLM(messages);
    }

    // Parse the response
    const parseResult = parseVPRefinementResponse(rawResponse);

    if (!parseResult.success || parseResult.vps.length === 0) {
      // Return original with warnings if parsing failed
      return {
        vp,
        warnings: [
          'Refinement parsing failed, returning original VP',
          ...parseResult.errors,
        ],
        durationMs: Date.now() - startTime,
      };
    }

    // Build the refined VP, preserving the original ID
    const refinedVP = this.buildSingleVPCharter(parseResult.vps[0], vp.id);

    // Update timestamps
    refinedVP.updatedAt = new Date();

    // Validate the refined charter
    const validation = this.validateCharter(refinedVP);
    if (!validation.valid) {
      warnings.push(...validation.errors.map(e => e.message));
    }
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map(w => w.message));
    }

    // Update registry if available
    if (this.registry) {
      this.registry.set(refinedVP.id, refinedVP);
    }

    return {
      vp: refinedVP,
      warnings,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Validates a VP charter for completeness and correctness.
   *
   * Checks all required fields, validates field values, and ensures
   * constraints are properly defined. Returns errors for blocking issues
   * and warnings for non-blocking concerns.
   *
   * @param charter - The VP charter to validate
   * @returns Validation result with errors, warnings, and suggestions
   *
   * @example
   * ```typescript
   * const result = generator.validateCharter(vpCharter);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * if (result.warnings.length > 0) {
   *   console.warn('Warnings:', result.warnings);
   * }
   * ```
   */
  validateCharter(charter: VPCharter): VPValidationResult {
    const errors: CharterValidationError[] = [];
    const warnings: CharterValidationWarning[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!charter.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'Charter ID is required',
        field: 'id',
      });
    }

    if (charter.tier !== 1) {
      errors.push({
        code: 'INVALID_TIER',
        message: 'VP charter must have tier = 1',
        field: 'tier',
      });
    }

    // Identity validation
    if (!charter.identity) {
      errors.push({
        code: 'MISSING_IDENTITY',
        message: 'Identity configuration is required',
        field: 'identity',
      });
    } else {
      if (!charter.identity.name?.trim()) {
        errors.push({
          code: 'MISSING_NAME',
          message: 'VP name is required',
          field: 'identity.name',
        });
      }

      if (!charter.identity.slug?.trim()) {
        errors.push({
          code: 'MISSING_SLUG',
          message: 'VP slug is required',
          field: 'identity.slug',
        });
      } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(charter.identity.slug)) {
        errors.push({
          code: 'INVALID_SLUG',
          message: 'VP slug must be lowercase alphanumeric with hyphens',
          field: 'identity.slug',
        });
      }

      if (!charter.identity.persona?.trim()) {
        warnings.push({
          code: 'MISSING_PERSONA',
          message: 'VP persona is recommended for better agent behavior',
          field: 'identity.persona',
          suggestion: 'Add a 2-3 sentence description of the VP personality',
        });
      }
    }

    // Core directive validation
    if (!charter.coreDirective?.trim()) {
      errors.push({
        code: 'MISSING_DIRECTIVE',
        message: 'Core directive is required',
        field: 'coreDirective',
      });
    } else if (charter.coreDirective.length < 20) {
      warnings.push({
        code: 'SHORT_DIRECTIVE',
        message: 'Core directive is very short',
        field: 'coreDirective',
        suggestion: 'Consider expanding the directive to be more specific',
      });
    }

    // Capabilities validation
    if (!charter.capabilities || charter.capabilities.length === 0) {
      errors.push({
        code: 'MISSING_CAPABILITIES',
        message: 'At least one capability is required',
        field: 'capabilities',
      });
    } else {
      const validCapabilities = new Set<VPCapability>([
        'context_compilation',
        'resource_management',
        'slack_operations',
        'session_spawning',
        'task_triage',
        'memory_management',
      ]);

      for (const cap of charter.capabilities) {
        if (!validCapabilities.has(cap)) {
          errors.push({
            code: 'INVALID_CAPABILITY',
            message: `Invalid capability: ${cap}`,
            field: 'capabilities',
          });
        }
      }

      // Check for essential capabilities
      const essentialCaps: VPCapability[] = [
        'context_compilation',
        'session_spawning',
      ];
      for (const cap of essentialCaps) {
        if (!charter.capabilities.includes(cap)) {
          warnings.push({
            code: 'MISSING_ESSENTIAL_CAPABILITY',
            message: `Consider adding essential capability: ${cap}`,
            field: 'capabilities',
            suggestion: `${cap} is commonly needed for VP operations`,
          });
        }
      }
    }

    // MCP tools validation
    if (!charter.mcpTools || charter.mcpTools.length === 0) {
      warnings.push({
        code: 'NO_MCP_TOOLS',
        message: 'No MCP tools configured',
        field: 'mcpTools',
        suggestion:
          'Add tools like agent_spawn, task_orchestrate for coordination',
      });
    }

    // Resource limits validation
    if (charter.resourceLimits) {
      if (charter.resourceLimits.maxConcurrentSessions < 1) {
        errors.push({
          code: 'INVALID_SESSIONS',
          message: 'maxConcurrentSessions must be at least 1',
          field: 'resourceLimits.maxConcurrentSessions',
        });
      }

      if (charter.resourceLimits.tokenBudgetPerHour < 1000) {
        warnings.push({
          code: 'LOW_TOKEN_BUDGET',
          message: 'Token budget seems low for VP operations',
          field: 'resourceLimits.tokenBudgetPerHour',
          suggestion: 'Consider at least 100000 tokens/hour for VPs',
        });
      }

      if (
        charter.resourceLimits.maxCpuPercent < 0 ||
        charter.resourceLimits.maxCpuPercent > 100
      ) {
        errors.push({
          code: 'INVALID_CPU_PERCENT',
          message: 'maxCpuPercent must be between 0 and 100',
          field: 'resourceLimits.maxCpuPercent',
        });
      }
    }

    // Constraints validation
    if (charter.constraints) {
      if (
        !charter.constraints.forbiddenCommands ||
        charter.constraints.forbiddenCommands.length === 0
      ) {
        warnings.push({
          code: 'NO_FORBIDDEN_COMMANDS',
          message: 'No forbidden commands defined',
          field: 'constraints.forbiddenCommands',
          suggestion:
            'Add destructive commands to prevent accidental execution',
        });
      }

      if (
        !charter.constraints.requireApprovalFor ||
        charter.constraints.requireApprovalFor.length === 0
      ) {
        warnings.push({
          code: 'NO_APPROVAL_REQUIREMENTS',
          message: 'No actions require approval',
          field: 'constraints.requireApprovalFor',
          suggestion:
            'Add high-impact actions that should require human approval',
        });
      }
    }

    // Timestamps validation
    if (!charter.createdAt) {
      errors.push({
        code: 'MISSING_CREATED_AT',
        message: 'createdAt timestamp is required',
        field: 'createdAt',
      });
    }

    if (!charter.updatedAt) {
      errors.push({
        code: 'MISSING_UPDATED_AT',
        message: 'updatedAt timestamp is required',
        field: 'updatedAt',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Enriches a partial VP charter with default values.
   *
   * Fills in missing properties with sensible defaults, generates IDs
   * if not provided, and ensures all required fields are populated.
   *
   * @param charter - A partial VP charter to enrich
   * @returns A complete VPCharter with all fields populated
   *
   * @example
   * ```typescript
   * const partial = {
   *   identity: {
   *     name: 'Engineering VP',
   *     persona: 'A methodical technical leader',
   *   },
   *   coreDirective: 'Ensure high-quality software delivery',
   * };
   *
   * const complete = generator.enrichWithDefaults(partial);
   * // complete now has all required fields filled in
   * ```
   */
  enrichWithDefaults(charter: Partial<VPCharter>): VPCharter {
    const now = new Date();
    const name = charter.identity?.name || 'Unnamed VP';
    const slug = charter.identity?.slug || generateSlug(name);

    // Ensure unique slug
    const uniqueSlug = ensureUniqueSlug(slug, Array.from(this.generatedSlugs));
    this.generatedSlugs.add(uniqueSlug);

    return {
      id: charter.id || generateVpId(),
      tier: 1,
      identity: {
        name,
        slug: uniqueSlug,
        persona:
          charter.identity?.persona || 'A professional supervisory agent',
        slackHandle: charter.identity?.slackHandle,
        email: charter.identity?.email,
        avatarUrl: charter.identity?.avatarUrl,
      },
      coreDirective:
        charter.coreDirective ||
        'Coordinate and oversee organizational operations',
      capabilities: charter.capabilities?.length
        ? charter.capabilities
        : DEFAULT_VP_CAPABILITIES,
      mcpTools: charter.mcpTools?.length
        ? charter.mcpTools
        : DEFAULT_VP_MCP_TOOLS,
      resourceLimits: {
        ...VP_RESOURCE_DEFAULTS,
        ...charter.resourceLimits,
      },
      objectives: {
        ...VP_OBJECTIVES_DEFAULTS,
        ...charter.objectives,
      },
      constraints: {
        forbiddenCommands: [
          ...(VP_CONSTRAINTS_DEFAULTS.forbiddenCommands || []),
          ...(charter.constraints?.forbiddenCommands || []),
        ],
        forbiddenPaths: [
          ...(VP_CONSTRAINTS_DEFAULTS.forbiddenPaths || []),
          ...(charter.constraints?.forbiddenPaths || []),
        ],
        forbiddenActions: [
          ...(VP_CONSTRAINTS_DEFAULTS.forbiddenActions || []),
          ...(charter.constraints?.forbiddenActions || []),
        ],
        requireApprovalFor: [
          ...(VP_CONSTRAINTS_DEFAULTS.requireApprovalFor || []),
          ...(charter.constraints?.requireApprovalFor || []),
        ],
      },
      disciplineIds: charter.disciplineIds || [],
      nodeId: charter.nodeId,
      createdAt: charter.createdAt || now,
      updatedAt: charter.updatedAt || now,
    };
  }

  /**
   * Sets the registry reference for storing generated VPs.
   *
   * @param registry - A Map to use as the VP registry
   */
  setRegistry(registry: Map<string, VPCharter>): void {
    this.registry = registry;
  }

  /**
   * Clears the generated slugs cache.
   *
   * Call this when starting a new generation context to allow
   * previously used slugs to be reused.
   */
  clearSlugCache(): void {
    this.generatedSlugs.clear();
  }

  /**
   * Gets the current configuration.
   *
   * @returns The generator configuration
   */
  getConfig(): Readonly<Required<VPGeneratorConfig>> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calls the LLM with retry logic.
   *
   * @param messages - The messages to send to the LLM
   * @returns The LLM response text
   */
  private async callLLM(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (this.config.llmCallback) {
          return await this.config.llmCallback(messages);
        }
        throw new Error('No LLM callback configured');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (lastError.message.includes('No LLM callback configured')) {
          throw lastError;
        }

        // Wait before retrying with exponential backoff
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('LLM call failed after retries');
  }

  /**
   * Generates a mock LLM response for testing.
   *
   * @param context - The VP generation context
   * @returns Mock JSON response
   */
  private generateMockResponse(context: VPGenerationContext): string {
    const mockVPs: ParsedVPData[] = [];

    for (let i = 0; i < context.vpCount; i++) {
      const index = i + 1;
      const vpName = this.getMockVPName(context.industry, index);
      const slug = generateSlug(vpName);

      mockVPs.push({
        name: vpName,
        slug: ensureUniqueSlug(slug, Array.from(this.generatedSlugs)),
        persona: `A professional and detail-oriented ${context.industry} leader focused on ${this.getMockFocus(index)}. Communicates clearly and prioritizes team efficiency.`,
        slackHandle: `${slug.replace(/-/g, '')}`,
        coreDirective: `Oversee ${this.getMockFocus(index)} operations and ensure alignment with ${context.mission}.`,
        capabilities: DEFAULT_VP_CAPABILITIES,
        mcpTools: getIndustryMCPTools(context.industry),
        disciplineIds:
          context.disciplineNames?.slice(0, Math.min(3, i + 1)) || [],
      });
    }

    return JSON.stringify(mockVPs, null, 2);
  }

  /**
   * Generates a mock refinement response.
   *
   * @param vp - The VP to refine
   * @param feedback - The feedback to incorporate
   * @returns Mock JSON response
   */
  private generateMockRefinementResponse(
    vp: VPCharter,
    feedback: string,
  ): string {
    // Simple mock: append feedback summary to persona
    const refinedVP: ParsedVPData = {
      name: vp.identity.name,
      slug: vp.identity.slug,
      persona: `${vp.identity.persona} [Refined based on feedback: ${feedback.substring(0, 50)}...]`,
      slackHandle: vp.identity.slackHandle,
      coreDirective: vp.coreDirective,
      capabilities: vp.capabilities,
      mcpTools: vp.mcpTools,
      disciplineIds: vp.disciplineIds,
    };

    return JSON.stringify(refinedVP, null, 2);
  }

  /**
   * Builds full VPCharter objects from parsed data.
   *
   * @param parsedVPs - Array of parsed VP data
   * @param _context - Generation context for additional metadata (reserved for future use)
   * @returns Array of complete VPCharter objects
   */
  private buildVPCharters(
    parsedVPs: ParsedVPData[],
    _context: VPGenerationContext,
  ): VPCharter[] {
    return parsedVPs.map(parsed => {
      const partialCharter = this.parsedVPToPartialCharter(parsed);
      return this.enrichWithDefaults(partialCharter);
    });
  }

  /**
   * Builds a single VPCharter from parsed data with a specific ID.
   *
   * @param parsed - The parsed VP data
   * @param id - The ID to use for the charter
   * @returns A complete VPCharter object
   */
  private buildSingleVPCharter(parsed: ParsedVPData, id: string): VPCharter {
    const partialCharter = this.parsedVPToPartialCharter(parsed);
    partialCharter.id = id;
    return this.enrichWithDefaults(partialCharter);
  }

  /**
   * Converts ParsedVPData to a partial VPCharter.
   *
   * @param parsed - The parsed VP data
   * @returns Partial VPCharter object
   */
  private parsedVPToPartialCharter(parsed: ParsedVPData): Partial<VPCharter> {
    // Build constraints only if provided and has all required fields
    let constraints: HardConstraints | undefined;
    if (parsed.constraints) {
      constraints = {
        forbiddenCommands: parsed.constraints.forbiddenCommands ?? [],
        forbiddenPaths: parsed.constraints.forbiddenPaths ?? [],
        forbiddenActions: parsed.constraints.forbiddenActions ?? [],
        requireApprovalFor: parsed.constraints.requireApprovalFor ?? [],
      };
    }

    return {
      identity: {
        name: parsed.name,
        slug: parsed.slug,
        persona: parsed.persona,
        slackHandle: parsed.slackHandle,
      },
      coreDirective: parsed.coreDirective,
      capabilities: parsed.capabilities,
      mcpTools: parsed.mcpTools,
      disciplineIds: parsed.disciplineIds,
      resourceLimits: parsed.resourceLimits
        ? { ...VP_RESOURCE_DEFAULTS, ...parsed.resourceLimits }
        : undefined,
      objectives: parsed.objectives
        ? { ...VP_OBJECTIVES_DEFAULTS, ...parsed.objectives }
        : undefined,
      constraints,
    };
  }

  /**
   * Gets a mock VP name based on industry and index.
   *
   * @param industry - The industry type
   * @param index - The VP index
   * @returns A mock VP name
   */
  private getMockVPName(industry: string, index: number): string {
    const industryNames: Record<string, string[]> = {
      technology: [
        'Engineering VP',
        'Product VP',
        'Infrastructure VP',
        'Security VP',
      ],
      finance: ['Risk VP', 'Compliance VP', 'Trading VP', 'Operations VP'],
      healthcare: [
        'Clinical VP',
        'Operations VP',
        'Compliance VP',
        'Research VP',
      ],
      legal: ['Litigation VP', 'Contracts VP', 'Compliance VP', 'Research VP'],
      marketing: ['Brand VP', 'Growth VP', 'Content VP', 'Analytics VP'],
      default: [
        'Operations VP',
        'Strategy VP',
        'Coordination VP',
        'Integration VP',
      ],
    };

    const names = industryNames[industry] || industryNames.default;
    return names[(index - 1) % names.length];
  }

  /**
   * Gets a mock focus area based on VP index.
   *
   * @param index - The VP index
   * @returns A mock focus area description
   */
  private getMockFocus(index: number): string {
    const focuses = [
      'technical excellence and code quality',
      'product strategy and user experience',
      'infrastructure reliability and scalability',
      'security and compliance',
      'team efficiency and delivery',
    ];
    return focuses[(index - 1) % focuses.length];
  }

  /**
   * Sleep utility for retry backoff.
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new VPGenerator instance with optional configuration.
 *
 * This factory function provides a convenient way to create VPGenerator
 * instances without using the `new` keyword.
 *
 * @param config - Optional configuration options
 * @returns A new VPGenerator instance
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const generator = createVPGenerator();
 *
 * // Create with mock mode enabled
 * const mockGenerator = createVPGenerator({ mockMode: true });
 *
 * // Create with custom LLM callback
 * const customGenerator = createVPGenerator({
 *   llmCallback: async (messages) => {
 *     // Custom LLM integration
 *     return await myLLMClient.generate(messages);
 *   },
 * });
 * ```
 */
export function createVPGenerator(config?: VPGeneratorConfig): VPGenerator {
  return new VPGenerator(config);
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Default VP resource limits.
 * Exported for use in custom VP generation workflows.
 */
export const DEFAULT_VP_RESOURCE_LIMIT_VALUES = VP_RESOURCE_DEFAULTS;

/**
 * Default VP objectives.
 * Exported for use in custom VP generation workflows.
 */
export const DEFAULT_VP_OBJECTIVE_VALUES = VP_OBJECTIVES_DEFAULTS;

/**
 * Default VP constraints.
 * Exported for use in custom VP generation workflows.
 */
export const DEFAULT_VP_CONSTRAINT_VALUES = VP_CONSTRAINTS_DEFAULTS;
