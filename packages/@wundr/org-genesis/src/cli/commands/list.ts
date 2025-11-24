/* eslint-disable no-console */
/**
 * @packageDocumentation
 * List Command - Lists organizations, VPs, disciplines, and agents.
 *
 * This command provides a unified interface for querying and displaying
 * all registry entities. Supports multiple output formats including
 * table, JSON, and tree views.
 *
 * @module cli/commands/list
 */

import { createRegistryManager } from '../../registry/index.js';

import type {
  RegistryQuery,
  OrganizationManifest,
  VPCharter,
  DisciplinePack,
  AgentDefinition,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Entity types that can be listed.
 */
export type ListEntityType = 'orgs' | 'vps' | 'disciplines' | 'agents' | 'all';

/**
 * Options for the list command.
 *
 * @example
 * ```typescript
 * const options: ListOptions = {
 *   parentId: 'vp-engineering',
 *   category: 'engineering',
 *   outputFormat: 'tree',
 *   verbose: true,
 * };
 * ```
 */
export interface ListOptions {
  /**
   * Filter by parent entity ID.
   * For VPs: organization ID
   * For disciplines: VP ID
   * For agents: discipline ID
   */
  parentId?: string;

  /**
   * Filter by category (for disciplines).
   */
  category?: string;

  /**
   * Filter by tags.
   */
  tags?: string[];

  /**
   * Search term to match against name and description.
   */
  search?: string;

  /**
   * Maximum number of results to return.
   * @default 50
   */
  limit?: number;

  /**
   * Number of results to skip for pagination.
   * @default 0
   */
  offset?: number;

  /**
   * Field to sort results by.
   * @default 'name'
   */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  /**
   * Sort direction.
   * @default 'asc'
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Output format for the results.
   * @default 'table'
   */
  outputFormat?: 'table' | 'json' | 'tree';

  /**
   * Show verbose output with more details.
   * @default false
   */
  verbose?: boolean;

  /**
   * Path to the registry storage.
   * @default './.wundr/registry'
   */
  registryPath?: string;
}

/**
 * Result returned from the list operation.
 */
export interface ListResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * List of organizations found.
   */
  organizations?: OrganizationManifest[];

  /**
   * List of VPs found.
   */
  vps?: VPCharter[];

  /**
   * List of disciplines found.
   */
  disciplines?: DisciplinePack[];

  /**
   * List of agents found.
   */
  agents?: AgentDefinition[];

  /**
   * Total count of matching entities.
   */
  total: number;

  /**
   * Error message if the operation failed.
   */
  error?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Truncates a string to a maximum length.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Formats a date for display.
 *
 * @param date - The date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Pads a string to a fixed width.
 *
 * @param str - The string to pad
 * @param width - Target width
 * @returns Padded string
 */
function pad(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Formats organizations as a table.
 *
 * @param orgs - Organizations to format
 * @param verbose - Whether to show verbose output
 */
function formatOrgsTable(orgs: OrganizationManifest[], verbose: boolean): void {
  if (orgs.length === 0) {
    console.log('  No organizations found.');
    return;
  }

  console.log('');
  console.log('  Organizations');
  console.log('  ' + '='.repeat(76));

  if (verbose) {
    console.log(
      `  ${pad('ID', 25)} ${pad('Name', 25)} ${pad('Industry', 12)} ${pad('Size', 10)} State`
    );
  } else {
    console.log(
      `  ${pad('Name', 30)} ${pad('Industry', 15)} ${pad('Size', 10)} ${pad('VPs', 5)} State`
    );
  }
  console.log('  ' + '-'.repeat(76));

  for (const org of orgs) {
    if (verbose) {
      console.log(
        `  ${pad(truncate(org.id, 24), 25)} ${pad(truncate(org.name, 24), 25)} ${pad(org.industry, 12)} ${pad(org.size, 10)} ${org.lifecycleState}`
      );
    } else {
      console.log(
        `  ${pad(truncate(org.name, 29), 30)} ${pad(org.industry, 15)} ${pad(org.size, 10)} ${pad(String(org.vpRegistry.length), 5)} ${org.lifecycleState}`
      );
    }
  }
  console.log('');
}

/**
 * Formats VPs as a table.
 *
 * @param vps - VPs to format
 * @param verbose - Whether to show verbose output
 */
function formatVPsTable(vps: VPCharter[], verbose: boolean): void {
  if (vps.length === 0) {
    console.log('  No VPs found.');
    return;
  }

  console.log('');
  console.log('  Vice Presidents (Tier 1)');
  console.log('  ' + '='.repeat(76));

  if (verbose) {
    console.log(
      `  ${pad('ID', 30)} ${pad('Name', 25)} ${pad('Disciplines', 12)} Created`
    );
  } else {
    console.log(
      `  ${pad('Name', 30)} ${pad('Slug', 25)} ${pad('Disciplines', 12)} Caps`
    );
  }
  console.log('  ' + '-'.repeat(76));

  for (const vp of vps) {
    if (verbose) {
      console.log(
        `  ${pad(truncate(vp.id, 29), 30)} ${pad(truncate(vp.identity.name, 24), 25)} ${pad(String(vp.disciplineIds.length), 12)} ${formatDate(vp.createdAt)}`
      );
    } else {
      console.log(
        `  ${pad(truncate(vp.identity.name, 29), 30)} ${pad(truncate(vp.identity.slug, 24), 25)} ${pad(String(vp.disciplineIds.length), 12)} ${vp.capabilities.length}`
      );
    }
  }
  console.log('');
}

/**
 * Formats disciplines as a table.
 *
 * @param disciplines - Disciplines to format
 * @param verbose - Whether to show verbose output
 */
function formatDisciplinesTable(
  disciplines: DisciplinePack[],
  verbose: boolean
): void {
  if (disciplines.length === 0) {
    console.log('  No disciplines found.');
    return;
  }

  console.log('');
  console.log('  Disciplines (Tier 2)');
  console.log('  ' + '='.repeat(76));

  if (verbose) {
    console.log(
      `  ${pad('ID', 30)} ${pad('Name', 20)} ${pad('Category', 12)} ${pad('Agents', 7)} VP`
    );
  } else {
    console.log(
      `  ${pad('Name', 25)} ${pad('Category', 12)} ${pad('Agents', 8)} ${pad('MCP', 5)} Hooks`
    );
  }
  console.log('  ' + '-'.repeat(76));

  for (const disc of disciplines) {
    if (verbose) {
      console.log(
        `  ${pad(truncate(disc.id, 29), 30)} ${pad(truncate(disc.name, 19), 20)} ${pad(disc.category, 12)} ${pad(String(disc.agentIds.length), 7)} ${truncate(disc.parentVpId ?? '-', 15)}`
      );
    } else {
      console.log(
        `  ${pad(truncate(disc.name, 24), 25)} ${pad(disc.category, 12)} ${pad(String(disc.agentIds.length), 8)} ${pad(String(disc.mcpServers.length), 5)} ${disc.hooks.length}`
      );
    }
  }
  console.log('');
}

/**
 * Formats agents as a table.
 *
 * @param agents - Agents to format
 * @param verbose - Whether to show verbose output
 */
function formatAgentsTable(agents: AgentDefinition[], verbose: boolean): void {
  if (agents.length === 0) {
    console.log('  No agents found.');
    return;
  }

  console.log('');
  console.log('  Agents (Tier 3)');
  console.log('  ' + '='.repeat(76));

  if (verbose) {
    console.log(
      `  ${pad('ID', 30)} ${pad('Name', 20)} ${pad('Model', 8)} ${pad('Scope', 18)} Tools`
    );
  } else {
    console.log(
      `  ${pad('Name', 25)} ${pad('Model', 8)} ${pad('Scope', 18)} ${pad('Tools', 6)} Tags`
    );
  }
  console.log('  ' + '-'.repeat(76));

  for (const agent of agents) {
    if (verbose) {
      console.log(
        `  ${pad(truncate(agent.id, 29), 30)} ${pad(truncate(agent.name, 19), 20)} ${pad(agent.model, 8)} ${pad(agent.scope, 18)} ${agent.tools.length}`
      );
    } else {
      console.log(
        `  ${pad(truncate(agent.name, 24), 25)} ${pad(agent.model, 8)} ${pad(agent.scope, 18)} ${pad(String(agent.tools.length), 6)} ${agent.tags.length}`
      );
    }
  }
  console.log('');
}

/**
 * Formats results as a tree view.
 *
 * @param result - The list result
 */
function formatTreeOutput(result: ListResult): void {
  console.log('');
  console.log('  Organization Hierarchy');
  console.log('  ' + '='.repeat(50));

  // For a full tree, we'd need orgs -> VPs -> disciplines -> agents
  // This is a simplified representation

  if (result.organizations && result.organizations.length > 0) {
    for (const org of result.organizations) {
      console.log(`  [ORG] ${org.name} (${org.id})`);

      if (result.vps) {
        const orgVps = result.vps.filter(vp =>
          org.vpRegistry.some(mapping => mapping.vpId === vp.id)
        );
        for (const vp of orgVps) {
          console.log(`    +-- [VP] ${vp.identity.name}`);

          if (result.disciplines) {
            const vpDiscs = result.disciplines.filter(
              d => d.parentVpId === vp.id
            );
            for (const disc of vpDiscs) {
              console.log(`    |   +-- [DISC] ${disc.name} (${disc.category})`);

              if (result.agents) {
                const discAgents = result.agents.filter(a =>
                  a.usedByDisciplines.includes(disc.id)
                );
                for (const agent of discAgents) {
                  console.log(
                    `    |   |   +-- [AGENT] ${agent.name} (${agent.model})`
                  );
                }
              }
            }
          }
        }
      }
    }
  } else if (result.vps && result.vps.length > 0) {
    for (const vp of result.vps) {
      console.log(`  [VP] ${vp.identity.name} (${vp.id})`);

      if (result.disciplines) {
        const vpDiscs = result.disciplines.filter(d => d.parentVpId === vp.id);
        for (const disc of vpDiscs) {
          console.log(`    +-- [DISC] ${disc.name} (${disc.category})`);

          if (result.agents) {
            const discAgents = result.agents.filter(a =>
              a.usedByDisciplines.includes(disc.id)
            );
            for (const agent of discAgents) {
              console.log(`    |   +-- [AGENT] ${agent.name} (${agent.model})`);
            }
          }
        }
      }
    }
  } else if (result.disciplines && result.disciplines.length > 0) {
    for (const disc of result.disciplines) {
      console.log(`  [DISC] ${disc.name} (${disc.category})`);

      if (result.agents) {
        const discAgents = result.agents.filter(a =>
          a.usedByDisciplines.includes(disc.id)
        );
        for (const agent of discAgents) {
          console.log(`    +-- [AGENT] ${agent.name} (${agent.model})`);
        }
      }
    }
  } else if (result.agents && result.agents.length > 0) {
    for (const agent of result.agents) {
      console.log(`  [AGENT] ${agent.name} (${agent.model})`);
    }
  }

  console.log('');
}

/**
 * Formats results as JSON.
 *
 * @param result - The list result
 */
function formatJsonOutput(result: ListResult): void {
  const output = {
    ...result,
    organizations: result.organizations?.map(org => ({
      ...org,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    })),
    vps: result.vps?.map(vp => ({
      ...vp,
      createdAt: vp.createdAt.toISOString(),
      updatedAt: vp.updatedAt.toISOString(),
    })),
    disciplines: result.disciplines?.map(disc => ({
      ...disc,
      createdAt: disc.createdAt.toISOString(),
      updatedAt: disc.updatedAt.toISOString(),
    })),
    agents: result.agents?.map(agent => ({
      ...agent,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Lists organizations, VPs, disciplines, and/or agents from the registry.
 *
 * Supports filtering, pagination, sorting, and multiple output formats.
 * Can list a single entity type or all types together.
 *
 * @param type - The entity type to list
 * @param options - Query and display options
 * @returns Promise resolving to the list result
 *
 * @example
 * ```typescript
 * // List all VPs
 * const result = await listCommand('vps', {});
 *
 * // List disciplines under a VP
 * const result = await listCommand('disciplines', {
 *   parentId: 'vp-engineering',
 * });
 *
 * // List all entities as tree
 * const result = await listCommand('all', {
 *   outputFormat: 'tree',
 * });
 *
 * // Search agents with pagination
 * const result = await listCommand('agents', {
 *   search: 'developer',
 *   limit: 10,
 *   offset: 20,
 * });
 * ```
 */
export async function listCommand(
  type: ListEntityType,
  options: ListOptions
): Promise<ListResult> {
  try {
    // Initialize registry manager
    const registryManager = createRegistryManager({
      storageType: 'file',
      basePath: options.registryPath ?? './.wundr/registry',
    });
    await registryManager.initialize();

    // Build query
    const query: RegistryQuery = {
      parentId: options.parentId,
      tags: options.tags,
      search: options.search,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      sortBy: options.sortBy ?? 'name',
      sortOrder: options.sortOrder ?? 'asc',
    };

    const result: ListResult = {
      success: true,
      total: 0,
    };

    // Fetch requested entities
    if (type === 'orgs' || type === 'all') {
      const orgs = await registryManager.query({
        ...query,
        type: 'organization',
      });
      result.organizations = orgs.items as unknown as OrganizationManifest[];
      result.total += orgs.total;
    }

    if (type === 'vps' || type === 'all') {
      const vps = await registryManager.charters.listVPs();
      result.vps = vps;
      result.total += vps.length;
    }

    if (type === 'disciplines' || type === 'all') {
      let disciplines: DisciplinePack[];
      // Note: listByVP is not yet implemented in DisciplineRegistry
      // For now, filter locally if parentId is provided
      if (options.category) {
        disciplines = await registryManager.disciplines.listByCategory(
          options.category as never
        );
      } else {
        disciplines = await registryManager.disciplines.list();
      }
      // Filter by VP if parentId is provided (local filtering)
      if (options.parentId) {
        disciplines = disciplines.filter(
          d => d.parentVpId === options.parentId
        );
      }
      result.disciplines = disciplines;
      result.total += disciplines.length;
    }

    if (type === 'agents' || type === 'all') {
      let agents: AgentDefinition[];
      if (options.parentId) {
        agents = await registryManager.agents.listByDiscipline(
          options.parentId
        );
      } else {
        agents = await registryManager.agents.list();
      }
      result.agents = agents;
      result.total += agents.length;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      total: 0,
    };
  }
}

/**
 * CLI entry point for the list command.
 *
 * Parses command-line arguments and invokes the listCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # List all VPs
 * wundr list vps
 *
 * # List disciplines under a VP
 * wundr list disciplines --parent vp-engineering
 *
 * # List all entities as tree
 * wundr list all --format tree
 *
 * # Search agents with JSON output
 * wundr list agents --search developer --format json
 * ```
 */
export async function runListCommand(args: string[]): Promise<void> {
  // Parse entity type
  const typeArg = args[0];
  const validTypes: ListEntityType[] = [
    'orgs',
    'vps',
    'disciplines',
    'agents',
    'all',
  ];

  if (!typeArg || !validTypes.includes(typeArg as ListEntityType)) {
    console.error('Error: Entity type is required');
    console.error(`Usage: wundr list <${validTypes.join('|')}> [options]`);
    process.exitCode = 1;
    return;
  }

  const type = typeArg as ListEntityType;
  const options: ListOptions = {
    outputFormat: 'table',
    verbose: false,
  };

  // Parse flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--parent':
      case '-p':
        options.parentId = nextArg;
        i++;
        break;
      case '--category':
      case '-c':
        options.category = nextArg;
        i++;
        break;
      case '--tags':
      case '-t':
        options.tags = (nextArg ?? '').split(',');
        i++;
        break;
      case '--search':
      case '-s':
        options.search = nextArg;
        i++;
        break;
      case '--limit':
      case '-l':
        options.limit = parseInt(nextArg ?? '50', 10);
        i++;
        break;
      case '--offset':
      case '-o':
        options.offset = parseInt(nextArg ?? '0', 10);
        i++;
        break;
      case '--sort':
        options.sortBy = nextArg as 'name' | 'createdAt' | 'updatedAt';
        i++;
        break;
      case '--order':
        options.sortOrder = nextArg as 'asc' | 'desc';
        i++;
        break;
      case '--format':
      case '-f':
        options.outputFormat = (nextArg ?? 'table') as
          | 'table'
          | 'json'
          | 'tree';
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--registry-path':
        options.registryPath = nextArg;
        i++;
        break;
    }
  }

  // Execute command
  const result = await listCommand(type, options);

  // Output result
  if (!result.success) {
    console.error('\n  Error listing entities:');
    console.error(`  ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (options.outputFormat === 'json') {
    formatJsonOutput(result);
  } else if (options.outputFormat === 'tree') {
    formatTreeOutput(result);
  } else {
    // Table format
    if (type === 'orgs' || type === 'all') {
      formatOrgsTable(result.organizations ?? [], options.verbose ?? false);
    }
    if (type === 'vps' || type === 'all') {
      formatVPsTable(result.vps ?? [], options.verbose ?? false);
    }
    if (type === 'disciplines' || type === 'all') {
      formatDisciplinesTable(
        result.disciplines ?? [],
        options.verbose ?? false
      );
    }
    if (type === 'agents' || type === 'all') {
      formatAgentsTable(result.agents ?? [], options.verbose ?? false);
    }

    console.log(`  Total: ${result.total} entities`);
    console.log('');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// ListEntityType is already exported at the top of the file
