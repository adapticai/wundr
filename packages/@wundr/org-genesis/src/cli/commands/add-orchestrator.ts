/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Add Orchestrator Command - Adds a Orchestrator (Tier 1) to an existing organization.
 *
 * This command creates a new Orchestrator charter and registers it within an organization.
 * VPs serve as top-level supervisory agents responsible for context compilation,
 * resource management, and session spawning.
 *
 * @module cli/commands/add-orchestrator
 */

import {
  createRegistryManager,
  type RegistryManager,
} from '../../registry/index.js';
import {
  DEFAULT_HARD_CONSTRAINTS,
  DEFAULT_VP_OBJECTIVES,
  DEFAULT_VP_RESOURCE_LIMITS,
} from '../../types/charter.js';

import type {
  AgentIdentity,
  OrchestratorCapability,
  OrchestratorCharter,
  ResourceLimits,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Options for the add Orchestrator command.
 *
 * @example
 * ```typescript
 * const options: AddOrchestratorOptions = {
 *   name: 'Engineering VP',
 *   persona: 'A methodical technical leader focused on code quality',
 *   capabilities: ['context_compilation', 'session_spawning'],
 *   disciplineIds: ['engineering', 'devops'],
 * };
 * ```
 */
export interface AddOrchestratorOptions {
  /**
   * Human-readable name for the Orchestrator.
   * @required
   */
  name: string;

  /**
   * Description of the Orchestrator's personality and communication style.
   * @default Generated from name
   */
  persona?: string;

  /**
   * Optional Slack handle for workspace integration.
   */
  slackHandle?: string;

  /**
   * Capabilities granted to this Orchestrator.
   * @default All capabilities
   */
  capabilities?: OrchestratorCapability[];

  /**
   * IDs of disciplines this Orchestrator will oversee.
   * @default []
   */
  disciplineIds?: string[];

  /**
   * Maximum concurrent sessions this Orchestrator can spawn.
   * @default 10
   */
  maxConcurrentSessions?: number;

  /**
   * Token budget per hour for LLM operations.
   * @default 500000
   */
  tokenBudgetPerHour?: number;

  /**
   * Whether to use LLM for generating Orchestrator configuration.
   * @default false
   */
  useLLM?: boolean;

  /**
   * LLM callback for generating Orchestrator configuration.
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
 * Result returned from the add Orchestrator operation.
 */
export interface AddOrchestratorResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * The created Orchestrator charter, if successful.
   */
  vp?: OrchestratorCharter;

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
 * All available Orchestrator capabilities.
 */
const ALL_ORCHESTRATOR_CAPABILITIES: OrchestratorCapability[] = [
  'context_compilation',
  'resource_management',
  'slack_operations',
  'session_spawning',
  'task_triage',
  'memory_management',
];

/**
 * Default MCP tools for Orchestrator agents.
 */
const DEFAULT_ORCHESTRATOR_MCP_TOOLS: string[] = [
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
 * Generates a unique identifier for a Orchestrator.
 *
 * @param slug - The Orchestrator slug
 * @returns Unique Orchestrator ID
 */
function generateVPId(slug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `orchestrator-${slug}-${timestamp}${random}`;
}

/**
 * Creates a default persona from the Orchestrator name.
 *
 * @param name - The Orchestrator name
 * @returns Generated persona description
 */
function generateDefaultPersona(name: string): string {
  return `A strategic and detail-oriented ${name} focused on delivering excellence and coordinating cross-functional initiatives.`;
}

/**
 * Validates the add Orchestrator options.
 *
 * @param options - The options to validate
 * @returns Array of validation errors
 */
function validateOptions(options: AddOrchestratorOptions): string[] {
  const errors: string[] = [];

  if (!options.name || options.name.trim().length === 0) {
    errors.push('Orchestrator name is required');
  }

  if (options.name && options.name.length > 100) {
    errors.push('Orchestrator name must be 100 characters or less');
  }

  if (options.capabilities) {
    const invalidCapabilities = options.capabilities.filter(
      cap => !ALL_ORCHESTRATOR_CAPABILITIES.includes(cap)
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
 * @param result - The add Orchestrator result
 */
function formatTextOutput(result: AddOrchestratorResult): void {
  if (result.success && result.orchestrator) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  Orchestrator Created Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Orchestrator Details');
    console.log('  ' + '-'.repeat(40));
    console.log(`  ID:       ${result.orchestrator.id}`);
    console.log(`  Name:     ${result.orchestrator.identity.name}`);
    console.log(`  Slug:     ${result.orchestrator.identity.slug}`);
    console.log(`  Tier:     ${result.orchestrator.tier}`);
    console.log('');
    console.log('  Capabilities');
    console.log('  ' + '-'.repeat(40));
    result.orchestrator.capabilities.forEach(cap => {
      console.log(`  - ${cap}`);
    });
    console.log('');
    console.log('  Resource Limits');
    console.log('  ' + '-'.repeat(40));
    console.log(
      `  Max Concurrent Sessions: ${result.orchestrator.resourceLimits.maxConcurrentSessions}`
    );
    console.log(
      `  Token Budget/Hour:       ${result.orchestrator.resourceLimits.tokenBudgetPerHour.toLocaleString()}`
    );
    console.log(
      `  Max Memory (MB):         ${result.orchestrator.resourceLimits.maxMemoryMB}`
    );
    console.log(
      `  Max CPU (%):             ${result.orchestrator.resourceLimits.maxCpuPercent}`
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
 * @param result - The add Orchestrator result
 */
function formatJsonOutput(result: AddOrchestratorResult): void {
  const output = {
    ...result,
    vp: result.orchestrator
      ? {
          ...result.orchestrator,
          createdAt: result.orchestrator.createdAt.toISOString(),
          updatedAt: result.orchestrator.updatedAt.toISOString(),
        }
      : undefined,
  };
  console.log(JSON.stringify(output, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Adds a Orchestrator (Tier 1) to an existing organization.
 *
 * Validates the provided options, generates a Orchestrator charter, and optionally
 * persists it to the registry. Supports dry-run mode for validation without
 * side effects.
 *
 * @param orgId - The organization ID to add the Orchestrator to
 * @param options - Configuration options for the new Orchestrator
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * // Basic Orchestrator creation
 * const result = await addOrchestratorCommand('org-acme-corp', {
 *   name: 'Engineering VP',
 *   persona: 'Technical leader focused on code quality',
 * });
 *
 * // Orchestrator with custom capabilities
 * const result = await addOrchestratorCommand('org-acme-corp', {
 *   name: 'Product VP',
 *   capabilities: ['context_compilation', 'task_triage'],
 *   disciplineIds: ['product', 'design'],
 * });
 *
 * // Dry-run mode
 * const result = await addOrchestratorCommand('org-acme-corp', {
 *   name: 'Legal VP',
 *   dryRun: true,
 * });
 * ```
 */
export async function addOrchestratorCommand(
  orgId: string,
  options: AddOrchestratorOptions
): Promise<AddOrchestratorResult> {
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

    // Generate Orchestrator identity
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

    // Build Orchestrator charter
    const now = new Date();
    const vpCharter: OrchestratorCharter = {
      id: generateVPId(slug),
      tier: 1,
      identity,
      coreDirective: `Lead and coordinate ${options.name.replace(/\s*VP$/i, '')} initiatives with excellence and strategic vision.`,
      capabilities: options.capabilities ?? ALL_ORCHESTRATOR_CAPABILITIES,
      mcpTools: DEFAULT_ORCHESTRATOR_MCP_TOOLS,
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
      // to include this Orchestrator in its vpRegistry
    } else if (options.dryRun) {
      warnings.push('Dry-run mode: Orchestrator was not persisted to registry');
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
 * CLI entry point for the add Orchestrator command.
 *
 * Parses command-line arguments and invokes the addOrchestratorCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # Basic usage
 * wundr orchestrator add org-acme-corp --name "Engineering VP"
 *
 * # With all options
 * wundr orchestrator add org-acme-corp \
 *   --name "Engineering VP" \
 *   --persona "Technical leader" \
 *   --capabilities context_compilation,session_spawning \
 *   --disciplines engineering,devops \
 *   --max-sessions 15 \
 *   --token-budget 750000 \
 *   --format json
 * ```
 */
export async function runAddOrchestratorCommand(args: string[]): Promise<void> {
  // Parse arguments
  const orgId = args[0];
  if (!orgId) {
    console.error('Error: Organization ID is required');
    console.error('Usage: wundr orchestrator add <org-id> --name <name> [options]');
    process.exitCode = 1;
    return;
  }

  const options: AddOrchestratorOptions = {
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
        options.capabilities = (nextArg ?? '').split(',') as OrchestratorCapability[];
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
    console.error('Error: Orchestrator name is required (--name)');
    process.exitCode = 1;
    return;
  }

  // Execute command
  const result = await addOrchestratorCommand(orgId, options);

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

export { ALL_ORCHESTRATOR_CAPABILITIES, DEFAULT_ORCHESTRATOR_MCP_TOOLS };
