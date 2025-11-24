/* eslint-disable no-console */
/**
 * @packageDocumentation
 * Create Organization Command
 *
 * Implements the `wundr org create` command for generating new organizational
 * structures using the Genesis Engine. Supports both interactive and
 * non-interactive modes for flexible organization creation.
 *
 * @module cli/commands/create-org
 */

import type {
  CreateOrgConfig,
  OrgSize,
  OrgIndustry,
  OrganizationManifest,
} from '../../types/index.js';

// Note: GenesisEngine will be imported once fully implemented
// import { GenesisEngine } from '../../generator/index.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Options for the create organization command.
 *
 * These options can be provided via CLI flags or collected
 * through interactive prompts.
 *
 * @example
 * ```typescript
 * const options: CreateOrgOptions = {
 *   name: 'ACME Corp',
 *   industry: 'technology',
 *   size: 'medium',
 *   nodeCount: 5,
 *   interactive: false,
 *   output: './output',
 *   saveToRegistry: true,
 * };
 * ```
 */
export interface CreateOrgOptions {
  /**
   * Name of the organization to create.
   * If not provided in non-interactive mode, prompts will be shown.
   */
  name?: string;

  /**
   * Industry classification for the organization.
   * Influences default discipline configurations.
   */
  industry?: OrgIndustry;

  /**
   * Size tier of the organization.
   * Determines default VP count and resource allocations.
   */
  size?: OrgSize;

  /**
   * Number of VP nodes to provision.
   * Overrides the size-based default if provided.
   */
  nodeCount?: number;

  /**
   * Whether to run in interactive mode.
   * When true, prompts for missing options.
   * @default true
   */
  interactive?: boolean;

  /**
   * Output directory for generated manifests.
   * @default './.wundr/orgs'
   */
  output?: string;

  /**
   * Whether to save the organization to the global registry.
   * @default true
   */
  saveToRegistry?: boolean;

  /**
   * Mission statement for the organization.
   * Guides agent decision-making and priorities.
   */
  mission?: string;

  /**
   * Whether to generate disciplines automatically.
   * @default true
   */
  generateDisciplines?: boolean;

  /**
   * Whether to generate agents for each discipline.
   * @default true
   */
  generateAgents?: boolean;

  /**
   * Run in dry-run mode without persisting changes.
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Result returned from the organization genesis process.
 *
 * Contains the generated organization manifest along with
 * statistics and file paths.
 */
export interface GenesisResult {
  /**
   * The generated organization manifest.
   */
  manifest: OrganizationManifest;

  /**
   * Statistics about the generated organization.
   */
  stats: GenesisStats;

  /**
   * Path where the manifest was saved.
   * Undefined if dryRun was true.
   */
  outputPath?: string;

  /**
   * Whether the organization was saved to the registry.
   */
  savedToRegistry: boolean;

  /**
   * Duration of the generation process in milliseconds.
   */
  durationMs: number;
}

/**
 * Statistics about the generated organizational structure.
 */
export interface GenesisStats {
  /**
   * Total number of VPs generated.
   */
  vpCount: number;

  /**
   * Total number of disciplines generated.
   */
  disciplineCount: number;

  /**
   * Total number of agents generated.
   */
  agentCount: number;

  /**
   * Total number of tools configured.
   */
  toolCount: number;

  /**
   * Total number of hooks configured.
   */
  hookCount: number;
}

/**
 * Generation progress phase identifiers.
 */
export type GenerationPhase =
  | 'initializing'
  | 'generating-vps'
  | 'generating-disciplines'
  | 'generating-agents'
  | 'configuring-tools'
  | 'configuring-hooks'
  | 'validating'
  | 'saving'
  | 'complete';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default VP count by organization size.
 */
const DEFAULT_VP_COUNTS: Record<OrgSize, number> = {
  small: 2,
  medium: 5,
  large: 15,
  enterprise: 50,
};

/**
 * Available industry options for selection.
 */
const INDUSTRY_OPTIONS: { value: OrgIndustry; label: string }[] = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'media', label: 'Media' },
  { value: 'custom', label: 'Custom / Other' },
];

/**
 * Available size options for selection.
 */
const SIZE_OPTIONS: { value: OrgSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '1-5 VPs, 2-4 disciplines' },
  {
    value: 'medium',
    label: 'Medium',
    description: '5-15 VPs, 4-8 disciplines',
  },
  {
    value: 'large',
    label: 'Large',
    description: '15-50 VPs, 8-15 disciplines',
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    description: '50+ VPs, 15+ disciplines',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Prompts the user for organization configuration interactively.
 *
 * Uses console prompts to collect missing configuration values.
 * This is a placeholder implementation that can be replaced with
 * inquirer or similar libraries for production use.
 *
 * @param existingOptions - Options already provided via CLI flags
 * @returns Complete organization configuration
 *
 * @example
 * ```typescript
 * const config = await promptForOrgConfig({ name: 'ACME' });
 * // Prompts for industry, size, mission, etc.
 * ```
 */
export async function promptForOrgConfig(
  existingOptions: CreateOrgOptions
): Promise<CreateOrgConfig> {
  // Placeholder implementation for interactive prompts
  // In production, this would use inquirer or similar

  const name = existingOptions.name ?? 'New Organization';
  const industry = existingOptions.industry ?? 'technology';
  const size = existingOptions.size ?? 'medium';
  const mission =
    existingOptions.mission ?? `${name} - An AI-powered organization`;

  // Log prompt activity for development
  console.log('\n[Interactive Mode]');
  console.log('The following prompts would be shown in production:\n');

  if (!existingOptions.name) {
    console.log('  ? Organization name: (using default: "New Organization")');
  }
  if (!existingOptions.industry) {
    console.log('  ? Industry: (using default: "technology")');
    console.log(
      '    Available options:',
      INDUSTRY_OPTIONS.map(o => o.label).join(', ')
    );
  }
  if (!existingOptions.size) {
    console.log('  ? Organization size: (using default: "medium")');
    SIZE_OPTIONS.forEach(opt => {
      console.log(`    - ${opt.label}: ${opt.description}`);
    });
  }
  if (!existingOptions.mission) {
    console.log('  ? Mission statement: (using default)');
  }
  console.log('');

  return {
    name,
    industry,
    size,
    mission,
    vpCount: existingOptions.nodeCount ?? DEFAULT_VP_COUNTS[size],
    generateDisciplines: existingOptions.generateDisciplines ?? true,
    generateAgents: existingOptions.generateAgents ?? true,
    dryRun: existingOptions.dryRun ?? false,
  };
}

/**
 * Displays generation progress to the console.
 *
 * Shows the current phase and progress percentage with
 * appropriate formatting.
 *
 * @param phase - Current generation phase
 * @param progress - Progress percentage (0-100)
 *
 * @example
 * ```typescript
 * displayProgress('generating-vps', 25);
 * // Output: [====      ] 25% - Generating VPs...
 * ```
 */
export function displayProgress(
  phase: GenerationPhase,
  progress: number
): void {
  const phaseLabels: Record<GenerationPhase, string> = {
    initializing: 'Initializing',
    'generating-vps': 'Generating VPs',
    'generating-disciplines': 'Generating Disciplines',
    'generating-agents': 'Generating Agents',
    'configuring-tools': 'Configuring Tools',
    'configuring-hooks': 'Configuring Hooks',
    validating: 'Validating',
    saving: 'Saving',
    complete: 'Complete',
  };

  const label = phaseLabels[phase];
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const filled = Math.floor(clampedProgress / 10);
  const empty = 10 - filled;
  const bar = '='.repeat(filled) + ' '.repeat(empty);

  // Use carriage return to update in place
  process.stdout.write(
    `\r  [${bar}] ${clampedProgress.toString().padStart(3)}% - ${label}...`
  );

  if (phase === 'complete') {
    console.log(''); // New line after completion
  }
}

/**
 * Displays the genesis result summary to the console.
 *
 * Shows a formatted summary of the generated organization
 * including statistics and output locations.
 *
 * @param result - The genesis result to display
 *
 * @example
 * ```typescript
 * displayResult(result);
 * // Output:
 * // Organization Created Successfully!
 * // Name: ACME Corp
 * // ID: org-acme-corp
 * // ...
 * ```
 */
export function displayResult(result: GenesisResult): void {
  const { manifest, stats, outputPath, savedToRegistry, durationMs } = result;

  console.log('\n');
  console.log('='.repeat(60));
  console.log('  Organization Created Successfully!');
  console.log('='.repeat(60));
  console.log('');

  // Organization details
  console.log('  Organization Details');
  console.log('  ' + '-'.repeat(40));
  console.log(`  Name:     ${manifest.name}`);
  console.log(`  ID:       ${manifest.id}`);
  console.log(`  Slug:     ${manifest.slug}`);
  console.log(`  Industry: ${manifest.industry}`);
  console.log(`  Size:     ${manifest.size}`);
  console.log(`  State:    ${manifest.lifecycleState}`);
  console.log('');

  // Statistics
  console.log('  Generation Statistics');
  console.log('  ' + '-'.repeat(40));
  console.log(`  VPs:         ${stats.vpCount}`);
  console.log(`  Disciplines: ${stats.disciplineCount}`);
  console.log(`  Agents:      ${stats.agentCount}`);
  console.log(`  Tools:       ${stats.toolCount}`);
  console.log(`  Hooks:       ${stats.hookCount}`);
  console.log('');

  // Output information
  console.log('  Output');
  console.log('  ' + '-'.repeat(40));
  if (outputPath) {
    console.log(`  Manifest saved to: ${outputPath}`);
  } else {
    console.log('  Manifest: [dry-run mode - not saved]');
  }
  console.log(`  Registry: ${savedToRegistry ? 'Saved' : 'Not saved'}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(2)}s`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
}

/**
 * Saves the genesis result to disk.
 *
 * Writes the organization manifest and related files to the
 * specified output directory.
 *
 * @param result - The genesis result containing the manifest
 * @param outputPath - Directory path to save the files
 * @returns The full path to the saved manifest file
 *
 * @example
 * ```typescript
 * const savedPath = await saveResult(result, './output');
 * console.log(`Saved to: ${savedPath}`);
 * ```
 */
export async function saveResult(
  result: GenesisResult,
  outputPath: string
): Promise<string> {
  const { manifest } = result;
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // Ensure output directory exists
  await fs.mkdir(outputPath, { recursive: true });

  // Generate manifest filename
  const filename = `${manifest.slug}-manifest.json`;
  const fullPath = path.join(outputPath, filename);

  // Serialize manifest (convert dates to ISO strings)
  const serialized = {
    ...manifest,
    createdAt: manifest.createdAt.toISOString(),
    updatedAt: manifest.updatedAt.toISOString(),
  };

  // Write manifest file
  await fs.writeFile(fullPath, JSON.stringify(serialized, null, 2), 'utf-8');

  return fullPath;
}

/**
 * Generates a URL-safe slug from a name.
 *
 * @param name - The name to convert to a slug
 * @returns URL-safe slug
 *
 * @example
 * ```typescript
 * generateSlug('ACME Corp'); // 'acme-corp'
 * ```
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates a unique identifier.
 *
 * @param prefix - Prefix for the ID
 * @returns Unique identifier string
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

// =============================================================================
// MAIN COMMAND HANDLER
// =============================================================================

/**
 * Handles the `wundr org create` command.
 *
 * Creates a new organizational structure based on provided options
 * or interactive prompts. Supports both interactive and non-interactive
 * modes for flexible usage in different contexts.
 *
 * @param options - Command options from CLI flags
 * @returns Promise resolving when organization creation is complete
 *
 * @example
 * ```typescript
 * // Non-interactive mode with all options
 * await createOrgCommand({
 *   name: 'ACME Corp',
 *   industry: 'technology',
 *   size: 'medium',
 *   interactive: false,
 *   output: './output',
 * });
 *
 * // Interactive mode
 * await createOrgCommand({ interactive: true });
 * ```
 */
export async function createOrgCommand(
  options: CreateOrgOptions
): Promise<void> {
  const startTime = Date.now();

  console.log('\n  Wundr Org Genesis - Create Organization\n');

  try {
    // Determine configuration source
    let config: CreateOrgConfig;

    if (options.interactive !== false) {
      // Interactive mode: prompt for missing options
      config = await promptForOrgConfig(options);
    } else {
      // Non-interactive mode: use provided options with defaults
      if (!options.name) {
        throw new Error(
          'Organization name is required in non-interactive mode'
        );
      }

      config = {
        name: options.name,
        industry: options.industry ?? 'technology',
        size: options.size ?? 'medium',
        mission:
          options.mission ?? `${options.name} - An AI-powered organization`,
        vpCount:
          options.nodeCount ?? DEFAULT_VP_COUNTS[options.size ?? 'medium'],
        generateDisciplines: options.generateDisciplines ?? true,
        generateAgents: options.generateAgents ?? true,
        dryRun: options.dryRun ?? false,
      };
    }

    console.log(`  Creating organization: ${config.name}\n`);

    // Initialize progress tracking
    displayProgress('initializing', 0);

    // Generate organization manifest
    // Note: In production, this would use the GenesisEngine
    // const engine = new GenesisEngine();
    // const result = await engine.generate(config);

    // Placeholder: Generate mock organization structure
    const manifest = await generateMockOrganization(
      config,
      (phase, progress) => {
        displayProgress(phase, progress);
      }
    );

    // Calculate statistics
    const stats: GenesisStats = {
      vpCount: manifest.vpRegistry.length,
      disciplineCount: manifest.disciplineIds.length,
      agentCount: manifest.disciplineIds.length * 5, // Estimate: ~5 agents per discipline
      toolCount: manifest.disciplineIds.length * 3, // Estimate: ~3 tools per discipline
      hookCount: manifest.disciplineIds.length * 2, // Estimate: ~2 hooks per discipline
    };

    // Determine output path
    const outputDir = options.output ?? './.wundr/orgs';
    let outputPath: string | undefined;

    // Save to disk if not dry-run
    if (!config.dryRun) {
      displayProgress('saving', 90);
      outputPath = await saveResult(
        { manifest, stats, savedToRegistry: false, durationMs: 0 },
        outputDir
      );
    }

    // Save to registry if requested
    const savedToRegistry = (options.saveToRegistry ?? true) && !config.dryRun;
    if (savedToRegistry) {
      // Placeholder: In production, this would save to the registry
      // await registryManager.save(manifest);
    }

    displayProgress('complete', 100);

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Create result object
    const result: GenesisResult = {
      manifest,
      stats,
      outputPath,
      savedToRegistry,
      durationMs,
    };

    // Display result summary
    displayResult(result);
  } catch (error) {
    console.error('\n  Error creating organization:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${String(error)}`);
    }
    process.exitCode = 1;
  }
}

// =============================================================================
// MOCK GENERATION (Placeholder for GenesisEngine)
// =============================================================================

/**
 * Generates a mock organization structure.
 *
 * This is a placeholder implementation that will be replaced
 * by the GenesisEngine in production.
 *
 * @param config - Organization configuration
 * @param onProgress - Progress callback
 * @returns Generated organization manifest
 */
async function generateMockOrganization(
  config: CreateOrgConfig,
  onProgress: (phase: GenerationPhase, progress: number) => void
): Promise<OrganizationManifest> {
  const slug = config.slug ?? generateSlug(config.name);
  const id = generateId('org');

  // Simulate generation phases with delays
  onProgress('initializing', 5);
  await delay(200);

  // Generate VPs
  onProgress('generating-vps', 15);
  const vpCount = config.vpCount ?? DEFAULT_VP_COUNTS[config.size];
  const vpRegistry = generateMockVPs(vpCount, id);
  await delay(300);
  onProgress('generating-vps', 30);

  // Generate disciplines
  onProgress('generating-disciplines', 40);
  const disciplineIds = generateMockDisciplineIds(config.industry, config.size);
  await delay(300);
  onProgress('generating-disciplines', 55);

  // Generate agents (simulated)
  if (config.generateAgents) {
    onProgress('generating-agents', 60);
    await delay(200);
    onProgress('generating-agents', 70);
  }

  // Configure tools
  onProgress('configuring-tools', 75);
  await delay(100);

  // Configure hooks
  onProgress('configuring-hooks', 80);
  await delay(100);

  // Validation
  onProgress('validating', 85);
  await delay(100);

  const now = new Date();

  return {
    id,
    name: config.name,
    slug,
    mission: config.mission,
    description: config.description,
    industry: config.industry,
    size: config.size,
    lifecycleState: 'draft',
    vpRegistry,
    disciplineIds,
    governance: config.governance
      ? {
          requireHumanApproval: config.governance.requireHumanApproval ?? true,
          approvalThresholdUsd: config.governance.approvalThresholdUsd ?? 10000,
          escalationTimeoutMinutes:
            config.governance.escalationTimeoutMinutes ?? 60,
          executiveVpIds: config.governance.executiveVpIds ?? [],
          auditLoggingEnabled: config.governance.auditLoggingEnabled ?? true,
        }
      : undefined,
    security: config.security
      ? {
          encryptionAtRest: config.security.encryptionAtRest ?? 'AES-256',
          encryptionInTransit: config.security.encryptionInTransit ?? 'TLS-1.3',
          mfaRequired: config.security.mfaRequired ?? true,
          sessionTimeoutMinutes: config.security.sessionTimeoutMinutes ?? 480,
          complianceFrameworks: config.security.complianceFrameworks ?? [],
          ipAllowlist: config.security.ipAllowlist ?? [],
        }
      : undefined,
    communication: config.communication
      ? {
          protocol: config.communication.protocol ?? 'grpc',
          messageQueue: config.communication.messageQueue ?? 'redis',
          maxMessageSizeKb: config.communication.maxMessageSizeKb ?? 1024,
          compressionEnabled: config.communication.compressionEnabled ?? true,
          retryPolicy: config.communication.retryPolicy ?? {
            maxRetries: 3,
            initialDelayMs: 100,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
          },
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
    schemaVersion: '1.0.0',
    metadata: config.metadata ?? {},
  };
}

/**
 * Generates mock VP node mappings.
 *
 * @param count - Number of VPs to generate
 * @param orgId - Organization ID
 * @returns Array of VP node mappings
 */
function generateMockVPs(
  count: number,
  orgId: string
): OrganizationManifest['vpRegistry'] {
  const vpRoles = [
    'engineering',
    'product',
    'operations',
    'finance',
    'legal',
    'hr',
    'marketing',
    'sales',
    'security',
    'data',
  ];

  return Array.from({ length: count }, (_, i) => {
    const role = vpRoles[i % vpRoles.length];
    return {
      vpId: `vp-${role}-${String(i + 1).padStart(3, '0')}`,
      nodeId: `node-${orgId}-${String(i + 1).padStart(3, '0')}`,
      hostname: `vp-${role}.cluster.internal`,
      status: 'provisioning' as const,
      assignedDisciplineId: `disc-${role}`,
      port: 8080 + i,
      tags: [role, 'tier-1'],
      provisionedAt: new Date(),
    };
  });
}

/**
 * Generates mock discipline IDs based on industry and size.
 *
 * @param industry - Organization industry
 * @param size - Organization size
 * @returns Array of discipline IDs
 */
function generateMockDisciplineIds(
  industry: OrgIndustry,
  size: OrgSize
): string[] {
  const baseDisciplines = ['engineering', 'product', 'operations'];

  const industryDisciplines: Record<OrgIndustry, string[]> = {
    technology: ['devops', 'security', 'data-engineering', 'ml-ai'],
    finance: ['compliance', 'risk', 'trading', 'treasury'],
    healthcare: ['clinical', 'compliance', 'research', 'patient-care'],
    legal: ['contracts', 'litigation', 'compliance', 'ip'],
    marketing: ['content', 'analytics', 'brand', 'growth'],
    manufacturing: ['quality', 'supply-chain', 'logistics', 'maintenance'],
    retail: ['inventory', 'customer-service', 'logistics', 'merchandising'],
    gaming: ['game-design', 'qa', 'community', 'monetization'],
    media: ['content', 'distribution', 'audience', 'production'],
    custom: ['general', 'support', 'administration'],
  };

  const sizeMultiplier: Record<OrgSize, number> = {
    small: 1,
    medium: 1.5,
    large: 2,
    enterprise: 3,
  };

  const allDisciplines = [...baseDisciplines, ...industryDisciplines[industry]];
  const count = Math.min(
    allDisciplines.length,
    Math.floor(baseDisciplines.length * sizeMultiplier[size])
  );

  return allDisciplines.slice(0, Math.max(count, 2)).map(d => `disc-${d}`);
}

/**
 * Utility function to create a delay.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// ADDITIONAL EXPORTS
// =============================================================================

export { INDUSTRY_OPTIONS, SIZE_OPTIONS, DEFAULT_VP_COUNTS };
