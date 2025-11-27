/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Export Command - Exports organization to a directory in various formats.
 *
 * This command exports an organization manifest along with its VPs, disciplines,
 * and agents to a directory. Supports multiple output formats including JSON,
 * YAML, and Markdown.
 *
 * @module cli/commands/export
 */

import { createRegistryManager } from '../../registry/index.js';

import type {
  AgentDefinition,
  DisciplinePack,
  OrchestratorCharter,
  OrganizationManifest,
} from '../../types/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Export file formats.
 */
export type ExportFormat = 'json' | 'yaml' | 'markdown';

/**
 * Export directory structure options.
 */
export type ExportStructure = 'single-file' | 'directory';

/**
 * Options for the export command.
 *
 * @example
 * ```typescript
 * const options: ExportOptions = {
 *   format: 'json',
 *   includeVPs: true,
 *   includeDisciplines: true,
 *   includeAgents: true,
 *   structure: 'directory',
 *   prettyPrint: true,
 * };
 * ```
 */
export interface ExportOptions {
  /**
   * Output format for exported files.
   * @default 'json'
   */
  format?: ExportFormat;

  /**
   * Whether to include Orchestrator charters in the export.
   * @default true
   */
  includeVPs?: boolean;

  /**
   * Whether to include discipline packs in the export.
   * @default true
   */
  includeDisciplines?: boolean;

  /**
   * Whether to include agent definitions in the export.
   * @default true
   */
  includeAgents?: boolean;

  /**
   * Whether to include tools and hooks configuration.
   * @default true
   */
  includeToolsAndHooks?: boolean;

  /**
   * Export structure: single file or directory tree.
   * @default 'directory'
   */
  structure?: ExportStructure;

  /**
   * Whether to pretty-print JSON output.
   * @default true
   */
  prettyPrint?: boolean;

  /**
   * Whether to overwrite existing files.
   * @default false
   */
  overwrite?: boolean;

  /**
   * Run in dry-run mode without writing files.
   * @default false
   */
  dryRun?: boolean;

  /**
   * Output format for command result display.
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
 * Result returned from the export operation.
 */
export interface ExportResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * Base output path.
   */
  outputPath?: string;

  /**
   * List of files that were exported.
   */
  filesExported: string[];

  /**
   * Export statistics.
   */
  stats: {
    organizationCount: number;
    orchestratorCount: number;
    disciplineCount: number;
    agentCount: number;
    totalFiles: number;
    totalSizeBytes: number;
  };

  /**
   * Error message if the operation failed.
   */
  error?: string;

  /**
   * Warnings encountered during export.
   */
  warnings: string[];
}

/**
 * Exported organization data structure.
 */
interface ExportedOrganization {
  manifest: OrganizationManifest;
  orchestrators: OrchestratorCharter[];
  disciplines: DisciplinePack[];
  agents: AgentDefinition[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Serializes a date to ISO string.
 *
 * @param obj - Object containing dates
 * @returns Object with dates as strings
 */
function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key as keyof T];
    if (value instanceof Date) {
      (result as Record<string, unknown>)[key] = value.toISOString();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      (result as Record<string, unknown>)[key] = serializeDates(
        value as Record<string, unknown>
      );
    }
  }
  return result;
}

/**
 * Converts an organization to JSON format.
 *
 * @param data - Export data
 * @param prettyPrint - Whether to pretty-print
 * @returns JSON string
 */
function toJson(data: ExportedOrganization, prettyPrint: boolean): string {
  const serialized = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    organization: serializeDates(
      data.manifest as unknown as Record<string, unknown>
    ),
    orchestrators: data.orchestrators.map(vp =>
      serializeDates(vp as unknown as Record<string, unknown>)
    ),
    disciplines: data.disciplines.map(d =>
      serializeDates(d as unknown as Record<string, unknown>)
    ),
    agents: data.agents.map(a =>
      serializeDates(a as unknown as Record<string, unknown>)
    ),
  };
  return prettyPrint
    ? JSON.stringify(serialized, null, 2)
    : JSON.stringify(serialized);
}

/**
 * Converts an organization to YAML format.
 *
 * @param data - Export data
 * @returns YAML string
 */
function toYaml(data: ExportedOrganization): string {
  // Simple YAML serialization (a real implementation would use a YAML library)
  const lines: string[] = [];

  lines.push('# Organization Export');
  lines.push(`exportedAt: "${new Date().toISOString()}"`);
  lines.push('version: "1.0.0"');
  lines.push('');

  lines.push('organization:');
  lines.push(`  id: "${data.manifest.id}"`);
  lines.push(`  name: "${data.manifest.name}"`);
  lines.push(`  slug: "${data.manifest.slug}"`);
  lines.push(`  mission: "${data.manifest.mission}"`);
  lines.push(`  industry: "${data.manifest.industry}"`);
  lines.push(`  size: "${data.manifest.size}"`);
  lines.push(`  lifecycleState: "${data.manifest.lifecycleState}"`);
  lines.push('');

  if (data.orchestrators.length > 0) {
    lines.push('vps:');
    for (const orchestrator of data.orchestrators) {
      lines.push(`  - id: "${orchestrator.id}"`);
      lines.push(`    name: "${orchestrator.identity.name}"`);
      lines.push(`    tier: ${orchestrator.tier}`);
      lines.push('    capabilities:');
      for (const cap of orchestrator.capabilities) {
        lines.push(`      - "${cap}"`);
      }
    }
    lines.push('');
  }

  if (data.disciplines.length > 0) {
    lines.push('disciplines:');
    for (const disc of data.disciplines) {
      lines.push(`  - id: "${disc.id}"`);
      lines.push(`    name: "${disc.name}"`);
      lines.push(`    category: "${disc.category}"`);
      if (disc.parentVpId) {
        lines.push(`    parentVpId: "${disc.parentVpId}"`);
      }
    }
    lines.push('');
  }

  if (data.agents.length > 0) {
    lines.push('agents:');
    for (const agent of data.agents) {
      lines.push(`  - id: "${agent.id}"`);
      lines.push(`    name: "${agent.name}"`);
      lines.push(`    model: "${agent.model}"`);
      lines.push(`    scope: "${agent.scope}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Converts an organization to Markdown format.
 *
 * @param data - Export data
 * @returns Markdown string
 */
function toMarkdown(data: ExportedOrganization): string {
  const lines: string[] = [];

  lines.push(`# ${data.manifest.name}`);
  lines.push('');
  lines.push(`> ${data.manifest.mission}`);
  lines.push('');
  lines.push('## Organization Details');
  lines.push('');
  lines.push(`- **ID:** ${data.manifest.id}`);
  lines.push(`- **Industry:** ${data.manifest.industry}`);
  lines.push(`- **Size:** ${data.manifest.size}`);
  lines.push(`- **State:** ${data.manifest.lifecycleState}`);
  lines.push('');

  if (data.orchestrators.length > 0) {
    lines.push('## Orchestrators (Tier 1)');
    lines.push('');
    lines.push('| Name | ID | Disciplines | Capabilities |');
    lines.push('|------|-----|-------------|--------------|');
    for (const orchestrator of data.orchestrators) {
      lines.push(
        `| ${orchestrator.identity.name} | ${orchestrator.id} | ${orchestrator.disciplineIds.length} | ${orchestrator.capabilities.length} |`
      );
    }
    lines.push('');
  }

  if (data.disciplines.length > 0) {
    lines.push('## Disciplines (Tier 2)');
    lines.push('');
    lines.push('| Name | Category | Agents | Parent Orchestrator |');
    lines.push('|------|----------|--------|-----------|');
    for (const disc of data.disciplines) {
      lines.push(
        `| ${disc.name} | ${disc.category} | ${disc.agentIds.length} | ${disc.parentVpId ?? '-'} |`
      );
    }
    lines.push('');
  }

  if (data.agents.length > 0) {
    lines.push('## Agents (Tier 3)');
    lines.push('');
    lines.push('| Name | Model | Scope | Disciplines |');
    lines.push('|------|-------|-------|-------------|');
    for (const agent of data.agents) {
      lines.push(
        `| ${agent.name} | ${agent.model} | ${agent.scope} | ${agent.usedByDisciplines.length} |`
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Exported on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Gets the file extension for a format.
 *
 * @param format - Export format
 * @returns File extension
 */
function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return '.json';
    case 'yaml':
      return '.yaml';
    case 'markdown':
      return '.md';
  }
}

/**
 * Formats the result as text output.
 *
 * @param result - The export result
 */
function formatTextOutput(result: ExportResult): void {
  if (result.success) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  Organization Exported Successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Export Statistics');
    console.log('  ' + '-'.repeat(40));
    console.log(`  Organizations: ${result.stats.organizationCount}`);
    console.log(`  VPs:           ${result.stats.orchestratorCount}`);
    console.log(`  Disciplines:   ${result.stats.disciplineCount}`);
    console.log(`  Agents:        ${result.stats.agentCount}`);
    console.log('');
    console.log('  Output');
    console.log('  ' + '-'.repeat(40));
    console.log(`  Path:        ${result.outputPath}`);
    console.log(`  Total Files: ${result.stats.totalFiles}`);
    console.log(
      `  Total Size:  ${(result.stats.totalSizeBytes / 1024).toFixed(2)} KB`
    );
    console.log('');

    if (result.filesExported.length > 0 && result.filesExported.length <= 10) {
      console.log('  Files');
      console.log('  ' + '-'.repeat(40));
      for (const file of result.filesExported) {
        console.log(`  - ${file}`);
      }
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
    console.error('\n  Error exporting organization:');
    console.error(`  ${result.error}`);
    console.error('');
  }
}

/**
 * Formats the result as JSON output.
 *
 * @param result - The export result
 */
function formatJsonOutput(result: ExportResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Exports an organization to a directory.
 *
 * Retrieves the organization manifest, VPs, disciplines, and agents from
 * the registry and writes them to the specified output path in the
 * requested format.
 *
 * @param orgId - The organization ID to export
 * @param outputPath - Directory path for the export
 * @param options - Export configuration options
 * @returns Promise resolving to the export result
 *
 * @example
 * ```typescript
 * // Basic export to JSON
 * const result = await exportCommand('org-acme-corp', './exports/acme', {});
 *
 * // Export to YAML in single file
 * const result = await exportCommand('org-acme-corp', './exports/acme.yaml', {
 *   format: 'yaml',
 *   structure: 'single-file',
 * });
 *
 * // Export directory structure
 * const result = await exportCommand('org-acme-corp', './exports/acme', {
 *   format: 'json',
 *   structure: 'directory',
 *   includeVPs: true,
 *   includeDisciplines: true,
 *   includeAgents: true,
 * });
 *
 * // Export as Markdown documentation
 * const result = await exportCommand('org-acme-corp', './docs/org', {
 *   format: 'markdown',
 * });
 * ```
 */
export async function exportCommand(
  orgId: string,
  outputPath: string,
  options: ExportOptions
): Promise<ExportResult> {
  const warnings: string[] = [];
  const filesExported: string[] = [];
  let totalSizeBytes = 0;

  // Apply defaults
  const format = options.format ?? 'json';
  const structure = options.structure ?? 'directory';
  const prettyPrint = options.prettyPrint ?? true;
  const includeVPs = options.includeVPs ?? true;
  const includeDisciplines = options.includeDisciplines ?? true;
  const includeAgents = options.includeAgents ?? true;

  try {
    // Initialize registry manager
    const registryManager = createRegistryManager({
      storageType: 'file',
      basePath: options.registryPath ?? './.wundr/registry',
    });
    await registryManager.initialize();

    // Get organization
    const orgs = await registryManager.query({
      type: 'organization',
      ids: [orgId],
    });
    if (orgs.total === 0) {
      return {
        success: false,
        error: `Organization not found: ${orgId}`,
        filesExported: [],
        stats: {
          organizationCount: 0,
          orchestratorCount: 0,
          disciplineCount: 0,
          agentCount: 0,
          totalFiles: 0,
          totalSizeBytes: 0,
        },
        warnings,
      };
    }

    const manifest = orgs.items[0] as unknown as OrganizationManifest;

    // Get VPs
    let orchestrators: OrchestratorCharter[] = [];
    if (includeVPs) {
      orchestrators = await registryManager.charters.listVPs();
      // Filter to VPs belonging to this org
      orchestrators = orchestrators.filter(orchestrator =>
        manifest.vpRegistry.some(mapping => mapping.orchestratorId === orchestrator.id)
      );
    }

    // Get disciplines
    let disciplines: DisciplinePack[] = [];
    if (includeDisciplines) {
      disciplines = await registryManager.disciplines.list();
      // Filter to disciplines belonging to VPs in this org
      const vpIds = orchestrators.map(orchestrator => orchestrator.id);
      disciplines = disciplines.filter(
        d => d.parentVpId && vpIds.includes(d.parentVpId)
      );
    }

    // Get agents
    let agents: AgentDefinition[] = [];
    if (includeAgents) {
      agents = await registryManager.agents.list();
      // Filter to agents used by disciplines in this org
      const discIds = disciplines.map(d => d.id);
      agents = agents.filter(a =>
        a.usedByDisciplines.some(dId => discIds.includes(dId))
      );
    }

    // Build export data
    const exportData: ExportedOrganization = {
      manifest,
      orchestrators,
      disciplines,
      agents,
    };

    // Import fs for file operations
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    // Check if output path exists
    if (!options.overwrite && !options.dryRun) {
      try {
        await fs.access(outputPath);
        // Path exists, check if we should overwrite
        warnings.push(`Output path already exists: ${outputPath}`);
      } catch {
        // Path doesn't exist, that's fine
      }
    }

    if (options.dryRun) {
      warnings.push('Dry-run mode: Files were not written');
    } else {
      if (structure === 'single-file') {
        // Export as single file
        let content: string;
        switch (format) {
          case 'json':
            content = toJson(exportData, prettyPrint);
            break;
          case 'yaml':
            content = toYaml(exportData);
            break;
          case 'markdown':
            content = toMarkdown(exportData);
            break;
        }

        const finalPath = outputPath.endsWith(getExtension(format))
          ? outputPath
          : outputPath + getExtension(format);

        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.writeFile(finalPath, content, 'utf-8');

        filesExported.push(finalPath);
        totalSizeBytes = Buffer.byteLength(content, 'utf-8');
      } else {
        // Export as directory structure
        await fs.mkdir(outputPath, { recursive: true });

        // Write manifest
        const manifestContent =
          format === 'json'
            ? JSON.stringify(
                serializeDates(manifest as unknown as Record<string, unknown>),
                null,
                prettyPrint ? 2 : 0
              )
            : format === 'yaml'
              ? `# Organization Manifest\nid: "${manifest.id}"\nname: "${manifest.name}"\n`
              : `# ${manifest.name}\n\n${manifest.mission}\n`;
        const manifestPath = path.join(
          outputPath,
          `manifest${getExtension(format)}`
        );
        await fs.writeFile(manifestPath, manifestContent, 'utf-8');
        filesExported.push(manifestPath);
        totalSizeBytes += Buffer.byteLength(manifestContent, 'utf-8');

        // Write VPs
        if (orchestrators.length > 0) {
          const orchestratorsDir = path.join(outputPath, 'orchestrators');
          await fs.mkdir(orchestratorsDir, { recursive: true });

          for (const orchestrator of orchestrators) {
            const orchestratorContent =
              format === 'json'
                ? JSON.stringify(
                    serializeDates(orchestrator as unknown as Record<string, unknown>),
                    null,
                    prettyPrint ? 2 : 0
                  )
                : format === 'yaml'
                  ? `# Orchestrator: ${orchestrator.identity.name}\nid: "${orchestrator.id}"\n`
                  : `# ${orchestrator.identity.name}\n\n${orchestrator.coreDirective}\n`;
            const orchestratorPath = path.join(
              orchestratorsDir,
              `${orchestrator.identity.slug}${getExtension(format)}`
            );
            await fs.writeFile(orchestratorPath, orchestratorContent, 'utf-8');
            filesExported.push(orchestratorPath);
            totalSizeBytes += Buffer.byteLength(orchestratorContent, 'utf-8');
          }
        }

        // Write disciplines
        if (disciplines.length > 0) {
          const discDir = path.join(outputPath, 'disciplines');
          await fs.mkdir(discDir, { recursive: true });

          for (const disc of disciplines) {
            const discContent =
              format === 'json'
                ? JSON.stringify(
                    serializeDates(disc as unknown as Record<string, unknown>),
                    null,
                    prettyPrint ? 2 : 0
                  )
                : format === 'yaml'
                  ? `# Discipline: ${disc.name}\nid: "${disc.id}"\ncategory: "${disc.category}"\n`
                  : `# ${disc.name}\n\n${disc.description}\n`;
            const discPath = path.join(
              discDir,
              `${disc.slug}${getExtension(format)}`
            );
            await fs.writeFile(discPath, discContent, 'utf-8');
            filesExported.push(discPath);
            totalSizeBytes += Buffer.byteLength(discContent, 'utf-8');
          }
        }

        // Write agents
        if (agents.length > 0) {
          const agentsDir = path.join(outputPath, 'agents');
          await fs.mkdir(agentsDir, { recursive: true });

          for (const agent of agents) {
            const agentContent =
              format === 'json'
                ? JSON.stringify(
                    serializeDates(agent as unknown as Record<string, unknown>),
                    null,
                    prettyPrint ? 2 : 0
                  )
                : format === 'yaml'
                  ? `# Agent: ${agent.name}\nid: "${agent.id}"\nmodel: "${agent.model}"\n`
                  : `# ${agent.name}\n\n${agent.charter}\n`;
            const agentPath = path.join(
              agentsDir,
              `${agent.slug}${getExtension(format)}`
            );
            await fs.writeFile(agentPath, agentContent, 'utf-8');
            filesExported.push(agentPath);
            totalSizeBytes += Buffer.byteLength(agentContent, 'utf-8');
          }
        }
      }
    }

    return {
      success: true,
      outputPath,
      filesExported,
      stats: {
        organizationCount: 1,
        orchestratorCount: orchestrators.length,
        disciplineCount: disciplines.length,
        agentCount: agents.length,
        totalFiles: filesExported.length,
        totalSizeBytes,
      },
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      filesExported: [],
      stats: {
        organizationCount: 0,
        orchestratorCount: 0,
        disciplineCount: 0,
        agentCount: 0,
        totalFiles: 0,
        totalSizeBytes: 0,
      },
      warnings,
    };
  }
}

/**
 * CLI entry point for the export command.
 *
 * Parses command-line arguments and invokes the exportCommand function.
 *
 * @param args - Command-line arguments
 *
 * @example
 * ```bash
 * # Basic export
 * wundr export org-acme-corp ./exports/acme
 *
 * # Export as YAML single file
 * wundr export org-acme-corp ./exports/acme.yaml --format yaml --single-file
 *
 * # Export as Markdown documentation
 * wundr export org-acme-corp ./docs/org --format markdown
 *
 * # Export with specific components
 * wundr export org-acme-corp ./exports/acme \
 *   --no-agents \
 *   --format json \
 *   --overwrite
 * ```
 */
export async function runExportCommand(args: string[]): Promise<void> {
  // Parse arguments
  const orgId = args[0];
  const outputPath = args[1];

  if (!orgId || !outputPath) {
    console.error('Error: Organization ID and output path are required');
    console.error('Usage: wundr export <org-id> <output-path> [options]');
    process.exitCode = 1;
    return;
  }

  const options: ExportOptions = {
    format: 'json',
    structure: 'directory',
    includeVPs: true,
    includeDisciplines: true,
    includeAgents: true,
    includeToolsAndHooks: true,
    prettyPrint: true,
    overwrite: false,
    dryRun: false,
    outputFormat: 'text',
  };

  // Parse flags
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--format':
      case '-f':
        options.format = (nextArg ?? 'json') as ExportFormat;
        i++;
        break;
      case '--single-file':
        options.structure = 'single-file';
        break;
      case '--directory':
        options.structure = 'directory';
        break;
      case '--no-vps':
        options.includeVPs = false;
        break;
      case '--no-disciplines':
        options.includeDisciplines = false;
        break;
      case '--no-agents':
        options.includeAgents = false;
        break;
      case '--no-pretty':
        options.prettyPrint = false;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--output':
      case '-o':
        options.outputFormat = (nextArg ?? 'text') as 'text' | 'json';
        i++;
        break;
      case '--registry-path':
        options.registryPath = nextArg;
        i++;
        break;
    }
  }

  // Execute command
  const result = await exportCommand(orgId, outputPath, options);

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
// RE-EXPORTS (for convenience)
// =============================================================================

// Note: ExportOptions and ExportResult are already exported at their definitions above
