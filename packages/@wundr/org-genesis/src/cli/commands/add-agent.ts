/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Add Agent Command - Adds a sub-agent (Tier 3) to a discipline.
 *
 * This command creates a new agent definition and associates it with
 * a discipline. Agents are specialized worker entities that perform
 * specific tasks within the organizational hierarchy.
 *
 * @module cli/commands/add-agent
 */

import {
  createRegistryManager,
  type RegistryManager,
} from '../../registry/index.js';
import {
  DEFAULT_AGENT_CAPABILITIES,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_MODEL_ASSIGNMENT,
  DEFAULT_AGENT_SCOPE,
} from '../../types/agent.js';

import type {
  AgentDefinition,
  AgentScope,
  ModelAssignment,
  AgentTool,
  AgentCapabilities,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Options for the add agent command.
 *
 * @example
 * ```typescript
 * const options: AddAgentOptions = {
 *   name: 'Code Reviewer',
 *   description: 'Reviews code for quality and security',
 *   charter: 'You are a meticulous code reviewer...',
 *   model: 'sonnet',
 *   capabilities: { canReadFiles: true, canWriteFiles: false },
 * };
 * ```
 */
export interface AddAgentOptions {
  /**
   * Human-readable name for the agent.
   * @required
   */
  name: string;

  /**
   * Brief description of the agent's purpose.
   * @required
   */
  description: string;

  /**
   * The agent's core instruction/persona charter.
   */
  charter?: string;

  /**
   * Availability scope of the agent.
   * @default 'discipline-specific'
   */
  scope?: AgentScope;

  /**
   * Model assignment for the agent.
   * @default 'sonnet'
   */
  model?: ModelAssignment;

  /**
   * Tools available to the agent.
   */
  tools?: AgentTool[];

  /**
   * Capability permissions for the agent.
   */
  capabilities?: Partial<AgentCapabilities>;

  /**
   * Searchable tags for categorization.
   */
  tags?: string[];

  /**
   * Whether to use LLM for generating agent configuration.
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
 * Result returned from the add agent operation.
 */
export interface AddAgentResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * The created agent definition, if successful.
   */
  agent?: AgentDefinition;

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
 * Valid model assignments.
 */
const VALID_MODELS: ModelAssignment[] = ['opus', 'sonnet', 'haiku'];

/**
 * Valid agent scopes.
 */
const VALID_SCOPES: AgentScope[] = ['universal', 'discipline-specific'];

/**
 * Default charter template.
 */
const DEFAULT_CHARTER_TEMPLATE = `You are a specialized {name} agent. Your primary responsibilities include:

1. {description}
2. Following established procedures and best practices
3. Collaborating effectively with other agents
4. Reporting progress and blockers clearly

Key Guidelines:
- Focus on delivering high-quality results
- Ask for clarification when requirements are unclear
- Document your decisions and rationale
- Escalate issues beyond your scope promptly`;

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
 * Generates a unique agent ID.
 *
 * @param slug - The agent slug
 * @returns Unique agent ID
 */
function generateAgentId(slug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `agent-${slug}-${timestamp}${random}`;
}

/**
 * Generates a default charter from name and description.
 *
 * @param name - The agent name
 * @param description - The agent description
 * @returns Generated charter
 */
function generateDefaultCharter(name: string, description: string): string {
  return DEFAULT_CHARTER_TEMPLATE.replace('{name}', name).replace(
    '{description}',
    description
  );
}

/**
 * Validates the add agent options.
 *
 * @param options - The options to validate
 * @returns Array of validation errors
 */
function validateOptions(options: AddAgentOptions): string[] {
  const errors: string[] = [];

  if (!options.name || options.name.trim().length === 0) {
    errors.push('Agent name is required');
  }

  if (options.name && options.name.length > 100) {
    errors.push('Agent name must be 100 characters or less');
  }

  if (!options.description || options.description.trim().length === 0) {
    errors.push('Agent description is required');
  }

  if (options.description && options.description.length > 500) {
    errors.push('Agent description must be 500 characters or less');
  }

  if (options.model && !VALID_MODELS.includes(options.model)) {
    errors.push(
      `Invalid model: ${options.model}. Valid models: ${VALID_MODELS.join(', ')}`
    );
  }

  if (options.scope && !VALID_SCOPES.includes(options.scope)) {
    errors.push(
      `Invalid scope: ${options.scope}. Valid scopes: ${VALID_SCOPES.join(', ')}`
    );
  }

  return errors;
}

/**
 * Merges user-provided capabilities with defaults.
 *
 * @param userCapabilities - User-provided capabilities
 * @returns Complete capabilities object
 */
function mergeCapabilities(
  userCapabilities?: Partial<AgentCapabilities>
): AgentCapabilities {
  return {
    ...DEFAULT_AGENT_CAPABILITIES,
    ...userCapabilities,
  };
}

/**
 * Formats the result as text output.
 *
 * @param result - The add agent result
 */
function formatTextOutput(result: AddAgentResult): void {
  if (result.success && result.agent) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  Agent Created Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Agent Details');
    console.log('  ' + '-'.repeat(40));
    console.log(`  ID:          ${result.agent.id}`);
    console.log(`  Name:        ${result.agent.name}`);
    console.log(`  Slug:        ${result.agent.slug}`);
    console.log(`  Tier:        ${result.agent.tier}`);
    console.log(`  Scope:       ${result.agent.scope}`);
    console.log(`  Model:       ${result.agent.model}`);
    console.log(`  Description: ${result.agent.description}`);
    console.log('');
    console.log('  Capabilities');
    console.log('  ' + '-'.repeat(40));
    console.log(
      `  Read Files:       ${result.agent.capabilities.canReadFiles ? 'Yes' : 'No'}`
    );
    console.log(
      `  Write Files:      ${result.agent.capabilities.canWriteFiles ? 'Yes' : 'No'}`
    );
    console.log(
      `  Execute Commands: ${result.agent.capabilities.canExecuteCommands ? 'Yes' : 'No'}`
    );
    console.log(
      `  Access Network:   ${result.agent.capabilities.canAccessNetwork ? 'Yes' : 'No'}`
    );
    console.log(
      `  Spawn Sub-agents: ${result.agent.capabilities.canSpawnSubAgents ? 'Yes' : 'No'}`
    );
    console.log('');
    console.log('  Tools');
    console.log('  ' + '-'.repeat(40));
    if (result.agent.tools.length > 0) {
      result.agent.tools.forEach(tool => {
        console.log(`  - ${tool.name} (${tool.type})`);
      });
    } else {
      console.log('  (none configured)');
    }
    console.log('');

    if (result.agent.tags.length > 0) {
      console.log('  Tags');
      console.log('  ' + '-'.repeat(40));
      console.log(`  ${result.agent.tags.join(', ')}`);
      console.log('');
    }

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
    console.error('\n  Error creating agent:');
    console.error(`  ${result.error}`);
    console.error('');
  }
}

/**
 * Formats the result as JSON output.
 *
 * @param result - The add agent result
 */
function formatJsonOutput(result: AddAgentResult): void {
  const output = {
    ...result,
    agent: result.agent
      ? {
          ...result.agent,
          createdAt: result.agent.createdAt.toISOString(),
          updatedAt: result.agent.updatedAt.toISOString(),
        }
      : undefined,
  };
  console.log(JSON.stringify(output, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Adds a sub-agent (Tier 3) to a discipline.
 *
 * Creates a new agent definition with the specified capabilities,
 * tools, and charter. The agent is associated with the specified
 * discipline and optionally persisted to the registry.
 *
 * @param disciplineId - The discipline ID to add the agent to
 * @param options - Configuration options for the new agent
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * // Basic agent creation
 * const result = await addAgentCommand('disc-frontend', {
 *   name: 'React Developer',
 *   description: 'Builds React components and UI features',
 * });
 *
 * // With custom configuration
 * const result = await addAgentCommand('disc-backend', {
 *   name: 'API Developer',
 *   description: 'Designs and implements REST APIs',
 *   model: 'opus',
 *   scope: 'discipline-specific',
 *   capabilities: {
 *     canReadFiles: true,
 *     canWriteFiles: true,
 *     canExecuteCommands: true,
 *   },
 *   tags: ['api', 'backend', 'rest'],
 * });
 * ```
 */
export async function addAgentCommand(
  disciplineId: string,
  options: AddAgentOptions
): Promise<AddAgentResult> {
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

      // Verify discipline exists
      const discipline = await registryManager.disciplines.get(disciplineId);
      if (!discipline) {
        return {
          success: false,
          error: `Discipline not found: ${disciplineId}`,
          warnings,
        };
      }
    }

    // Generate agent identifiers
    const slug = generateSlug(options.name);
    const id = generateAgentId(slug);

    // Build charter
    const charter =
      options.charter ??
      generateDefaultCharter(options.name, options.description);

    // Build capabilities
    const capabilities = mergeCapabilities(options.capabilities);

    // Build tools
    const tools = options.tools ?? [...DEFAULT_AGENT_TOOLS];

    // Create agent definition
    const now = new Date();
    const agent: AgentDefinition = {
      id,
      name: options.name,
      slug,
      tier: 3,
      scope: options.scope ?? DEFAULT_AGENT_SCOPE,
      description: options.description,
      charter,
      model: options.model ?? DEFAULT_MODEL_ASSIGNMENT,
      tools,
      capabilities,
      usedByDisciplines: [disciplineId],
      tags: options.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    // Persist to registry if not dry-run
    if (!options.dryRun && registryManager) {
      await registryManager.agents.register(agent);

      // Update discipline to include this agent
      const discipline = await registryManager.disciplines.get(disciplineId);
      if (discipline && !discipline.agentIds.includes(id)) {
        const updatedAgentIds = [...discipline.agentIds, id];
        await registryManager.disciplines.update(disciplineId, {
          agentIds: updatedAgentIds,
        });
      }
    } else if (options.dryRun) {
      warnings.push('Dry-run mode: Agent was not persisted to registry');
    }

    return {
      success: true,
      agent,
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
 * CLI entry point for the add agent command.
 *
 * Parses command-line arguments and invokes the addAgentCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # Basic usage
 * wundr agent add disc-frontend --name "React Dev" --description "React developer"
 *
 * # With all options
 * wundr agent add disc-backend \
 *   --name "API Developer" \
 *   --description "Builds REST APIs" \
 *   --model opus \
 *   --scope discipline-specific \
 *   --tags api,backend,rest \
 *   --format json
 * ```
 */
export async function runAddAgentCommand(args: string[]): Promise<void> {
  // Parse arguments
  const disciplineId = args[0];
  if (!disciplineId) {
    console.error('Error: Discipline ID is required');
    console.error(
      'Usage: wundr agent add <discipline-id> --name <name> --description <desc> [options]'
    );
    process.exitCode = 1;
    return;
  }

  const options: AddAgentOptions = {
    name: '',
    description: '',
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
      case '--description':
      case '-d':
        options.description = nextArg ?? '';
        i++;
        break;
      case '--charter':
        options.charter = nextArg;
        i++;
        break;
      case '--model':
      case '-m':
        options.model = (nextArg ?? 'sonnet') as ModelAssignment;
        i++;
        break;
      case '--scope':
      case '-s':
        options.scope = (nextArg ?? 'discipline-specific') as AgentScope;
        i++;
        break;
      case '--tags':
      case '-t':
        options.tags = (nextArg ?? '').split(',');
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
    console.error('Error: Agent name is required (--name)');
    process.exitCode = 1;
    return;
  }

  if (!options.description) {
    console.error('Error: Agent description is required (--description)');
    process.exitCode = 1;
    return;
  }

  // Execute command
  const result = await addAgentCommand(disciplineId, options);

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

export { VALID_MODELS, VALID_SCOPES, DEFAULT_CHARTER_TEMPLATE };
