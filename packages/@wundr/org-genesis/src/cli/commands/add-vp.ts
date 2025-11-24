/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Add VP Command - Adds a Vice President (Tier 1) to an existing organization.
 *
 * This command creates a new VP charter and registers it within an organization.
 * VPs serve as top-level supervisory agents responsible for context compilation,
 * resource management, and session spawning.
 *
 * @module cli/commands/add-vp
 */

import {
  createRegistryManager,
  type RegistryManager,
} from '../../registry/index.js';
import {
  DEFAULT_VP_RESOURCE_LIMITS,
  DEFAULT_VP_OBJECTIVES,
  DEFAULT_HARD_CONSTRAINTS,
} from '../../types/charter.js';

import type {
  VPCharter,
  VPCapability,
  ResourceLimits,
  AgentIdentity,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Options for the add VP command.
 *
 * @example
 * ```typescript
 * const options: AddVPOptions = {
 *   name: 'Engineering VP',
 *   persona: 'A methodical technical leader focused on code quality',
 *   capabilities: ['context_compilation', 'session_spawning'],
 *   disciplineIds: ['engineering', 'devops'],
 * };
 * ```
 */
export interface AddVPOptions {
  /**
   * Human-readable name for the VP.
   * @required
   */
  name: string;

  /**
   * Description of the VP's personality and communication style.
   * @default Generated from name
   */
  persona?: string;

  /**
   * Optional Slack handle for workspace integration.
   */
  slackHandle?: string;

  /**
   * Capabilities granted to this VP.
   * @default All capabilities
   */
  capabilities?: VPCapability[];

  /**
   * IDs of disciplines this VP will oversee.
   * @default []
   */
  disciplineIds?: string[];

  /**
   * Maximum concurrent sessions this VP can spawn.
   * @default 10
   */
  maxConcurrentSessions?: number;

  /**
   * Token budget per hour for LLM operations.
   * @default 500000
   */
  tokenBudgetPerHour?: number;

  /**
   * Whether to use LLM for generating VP configuration.
   * @default false
   */
  useLLM?: boolean;

  /**
   * LLM callback for generating VP configuration.
   */
  llmCallback?: (
    messages: Array<{ role: 'system' | 'user'; content: string }>
  ) => Promise<string>;

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
 * Result returned from the add VP operation.
 */
export interface AddVPResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * The created VP charter, if successful.
   */
  vp?: VPCharter;

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
 * All available VP capabilities.
 */
const ALL_VP_CAPABILITIES: VPCapability[] = [
  'context_compilation',
  'resource_management',
  'slack_operations',
  'session_spawning',
  'task_triage',
  'memory_management',
];

/**
 * Default MCP tools for VP agents.
 */
const DEFAULT_VP_MCP_TOOLS: string[] = [
  'github_swarm',
  'code_review',
  'agent_spawn',
  'task_orchestrate',
  'memory_usage',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generates a URL-safe slug from a name.
 *
 * @param name - The name to convert to a slug
 * @returns URL-safe slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates a unique identifier for a VP.
 *
 * @param slug - The VP slug
 * @returns Unique VP ID
 */
function generateVPId(slug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `vp-${slug}-${timestamp}${random}`;
}

/**
 * Creates a default persona from the VP name.
 *
 * @param name - The VP name
 * @returns Generated persona description
 */
function generateDefaultPersona(name: string): string {
  return `A strategic and detail-oriented ${name} focused on delivering excellence and coordinating cross-functional initiatives.`;
}

/**
 * Validates the add VP options.
 *
 * @param options - The options to validate
 * @returns Array of validation errors
 */
function validateOptions(options: AddVPOptions): string[] {
  const errors: string[] = [];

  if (!options.name || options.name.trim().length === 0) {
    errors.push('VP name is required');
  }

  if (options.name && options.name.length > 100) {
    errors.push('VP name must be 100 characters or less');
  }

  if (options.capabilities) {
    const invalidCapabilities = options.capabilities.filter(
      cap => !ALL_VP_CAPABILITIES.includes(cap)
    );
    if (invalidCapabilities.length > 0) {
      errors.push(`Invalid capabilities: ${invalidCapabilities.join(', ')}`);
    }
  }

  if (options.maxConcurrentSessions !== undefined) {
    if (
      options.maxConcurrentSessions < 1 ||
      options.maxConcurrentSessions > 100
    ) {
      errors.push('maxConcurrentSessions must be between 1 and 100');
    }
  }

  if (options.tokenBudgetPerHour !== undefined) {
    if (
      options.tokenBudgetPerHour < 1000 ||
      options.tokenBudgetPerHour > 10000000
    ) {
      errors.push('tokenBudgetPerHour must be between 1,000 and 10,000,000');
    }
  }

  return errors;
}

/**
 * Formats the result as text output.
 *
 * @param result - The add VP result
 */
function formatTextOutput(result: AddVPResult): void {
  if (result.success && result.vp) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  VP Created Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  VP Details');
    console.log('  ' + '-'.repeat(40));
    console.log(`  ID:       ${result.vp.id}`);
    console.log(`  Name:     ${result.vp.identity.name}`);
    console.log(`  Slug:     ${result.vp.identity.slug}`);
    console.log(`  Tier:     ${result.vp.tier}`);
    console.log('');
    console.log('  Capabilities');
    console.log('  ' + '-'.repeat(40));
    result.vp.capabilities.forEach(cap => {
      console.log(`  - ${cap}`);
    });
    console.log('');
    console.log('  Resource Limits');
    console.log('  ' + '-'.repeat(40));
    console.log(
      `  Max Concurrent Sessions: ${result.vp.resourceLimits.maxConcurrentSessions}`
    );
    console.log(
      `  Token Budget/Hour:       ${result.vp.resourceLimits.tokenBudgetPerHour.toLocaleString()}`
    );
    console.log(
      `  Max Memory (MB):         ${result.vp.resourceLimits.maxMemoryMB}`
    );
    console.log(
      `  Max CPU (%):             ${result.vp.resourceLimits.maxCpuPercent}`
    );
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
    console.error('\n  Error creating VP:');
    console.error(`  ${result.error}`);
    console.error('');
  }
}

/**
 * Formats the result as JSON output.
 *
 * @param result - The add VP result
 */
function formatJsonOutput(result: AddVPResult): void {
  const output = {
    ...result,
    vp: result.vp
      ? {
          ...result.vp,
          createdAt: result.vp.createdAt.toISOString(),
          updatedAt: result.vp.updatedAt.toISOString(),
        }
      : undefined,
  };
  console.log(JSON.stringify(output, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Adds a Vice President (Tier 1) to an existing organization.
 *
 * Validates the provided options, generates a VP charter, and optionally
 * persists it to the registry. Supports dry-run mode for validation without
 * side effects.
 *
 * @param orgId - The organization ID to add the VP to
 * @param options - Configuration options for the new VP
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * // Basic VP creation
 * const result = await addVPCommand('org-acme-corp', {
 *   name: 'Engineering VP',
 *   persona: 'Technical leader focused on code quality',
 * });
 *
 * // VP with custom capabilities
 * const result = await addVPCommand('org-acme-corp', {
 *   name: 'Product VP',
 *   capabilities: ['context_compilation', 'task_triage'],
 *   disciplineIds: ['product', 'design'],
 * });
 *
 * // Dry-run mode
 * const result = await addVPCommand('org-acme-corp', {
 *   name: 'Legal VP',
 *   dryRun: true,
 * });
 * ```
 */
export async function addVPCommand(
  orgId: string,
  options: AddVPOptions
): Promise<AddVPResult> {
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

      // Verify organization exists
      const orgs = await registryManager.query({
        type: 'organization',
        ids: [orgId],
      });
      if (orgs.total === 0) {
        return {
          success: false,
          error: `Organization not found: ${orgId}`,
          warnings,
        };
      }
    }

    // Generate VP identity
    const slug = generateSlug(options.name);
    const identity: AgentIdentity = {
      name: options.name,
      slug,
      persona: options.persona ?? generateDefaultPersona(options.name),
      slackHandle: options.slackHandle,
    };

    // Build resource limits
    const resourceLimits: ResourceLimits = {
      ...DEFAULT_VP_RESOURCE_LIMITS,
      maxConcurrentSessions:
        options.maxConcurrentSessions ??
        DEFAULT_VP_RESOURCE_LIMITS.maxConcurrentSessions,
      tokenBudgetPerHour:
        options.tokenBudgetPerHour ??
        DEFAULT_VP_RESOURCE_LIMITS.tokenBudgetPerHour,
    };

    // Build VP charter
    const now = new Date();
    const vpCharter: VPCharter = {
      id: generateVPId(slug),
      tier: 1,
      identity,
      coreDirective: `Lead and coordinate ${options.name.replace(/\s*VP$/i, '')} initiatives with excellence and strategic vision.`,
      capabilities: options.capabilities ?? ALL_VP_CAPABILITIES,
      mcpTools: DEFAULT_VP_MCP_TOOLS,
      resourceLimits,
      objectives: DEFAULT_VP_OBJECTIVES,
      constraints: DEFAULT_HARD_CONSTRAINTS,
      disciplineIds: options.disciplineIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    // Persist to registry if not dry-run
    if (!options.dryRun && registryManager) {
      await registryManager.charters.registerVP(vpCharter);

      // Note: In a real implementation, we would also update the organization
      // to include this VP in its vpRegistry
    } else if (options.dryRun) {
      warnings.push('Dry-run mode: VP was not persisted to registry');
    }

    return {
      success: true,
      vp: vpCharter,
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
 * CLI entry point for the add VP command.
 *
 * Parses command-line arguments and invokes the addVPCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # Basic usage
 * wundr vp add org-acme-corp --name "Engineering VP"
 *
 * # With all options
 * wundr vp add org-acme-corp \
 *   --name "Engineering VP" \
 *   --persona "Technical leader" \
 *   --capabilities context_compilation,session_spawning \
 *   --disciplines engineering,devops \
 *   --max-sessions 15 \
 *   --token-budget 750000 \
 *   --format json
 * ```
 */
export async function runAddVPCommand(args: string[]): Promise<void> {
  // Parse arguments
  const orgId = args[0];
  if (!orgId) {
    console.error('Error: Organization ID is required');
    console.error('Usage: wundr vp add <org-id> --name <name> [options]');
    process.exitCode = 1;
    return;
  }

  const options: AddVPOptions = {
    name: '',
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
      case '--persona':
      case '-p':
        options.persona = nextArg;
        i++;
        break;
      case '--slack':
        options.slackHandle = nextArg;
        i++;
        break;
      case '--capabilities':
      case '-c':
        options.capabilities = (nextArg ?? '').split(',') as VPCapability[];
        i++;
        break;
      case '--disciplines':
      case '-d':
        options.disciplineIds = (nextArg ?? '').split(',');
        i++;
        break;
      case '--max-sessions':
        options.maxConcurrentSessions = parseInt(nextArg ?? '10', 10);
        i++;
        break;
      case '--token-budget':
        options.tokenBudgetPerHour = parseInt(nextArg ?? '500000', 10);
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
    console.error('Error: VP name is required (--name)');
    process.exitCode = 1;
    return;
  }

  // Execute command
  const result = await addVPCommand(orgId, options);

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

export { ALL_VP_CAPABILITIES, DEFAULT_VP_MCP_TOOLS };
