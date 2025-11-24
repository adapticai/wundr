/* eslint-disable no-console */
/**
 * @fileoverview Genesis Engine - Main orchestrator for organizational generation
 *
 * The GenesisEngine is the central orchestration component for the org-genesis system.
 * It coordinates the generation of complete organizational structures from high-level
 * prompts or configuration objects, implementing the recursive generation protocol
 * defined in the architectural framework.
 *
 * The generation process follows a three-phase approach:
 * 1. **Phase 1 - VP Generation**: Generate Virtual Persona (Tier 1) charters
 * 2. **Phase 2 - Discipline Generation**: Generate discipline packs for each VP
 * 3. **Phase 3 - Agent Generation**: Generate specialized agents for each discipline
 *
 * Key Features:
 * - Natural language prompt-based organization generation
 * - Configuration-driven organization creation
 * - Phased generation with progress callbacks
 * - Registry integration for persistence
 * - File system export capabilities
 *
 * @module @wundr/org-genesis/generator/genesis-engine
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { createGenesisEngine, GenesisEngine } from '@wundr/org-genesis';
 *
 * // Create the engine
 * const engine = createGenesisEngine();
 *
 * // Generate from a natural language prompt
 * const result = await engine.generate(
 *   'Create a fintech startup with engineering, compliance, and product teams',
 *   {
 *     industry: 'finance',
 *     size: 'small',
 *     onProgress: (phase, progress) => {
 *       console.log(`${phase}: ${progress}%`);
 *     },
 *   }
 * );
 *
 * // Export to filesystem
 * await engine.exportToDirectory(result, './generated-org');
 * ```
 */

import { AgentGenerator } from './agent-generator.js';
import { DisciplineGenerator } from './discipline-generator.js';
import { ManifestGenerator } from './manifest-generator.js';
import { VPGenerator } from './vp-generator.js';
import { createRegistryManager } from '../registry/index.js';

import type { VPGenerationContext } from './prompts/vp-prompts.js';
import type {
  RegistryManager,
  RegistryManagerConfig,
} from '../registry/index.js';
import type {
  OrganizationManifest,
  OrgSize,
  OrgIndustry,
  CreateOrgConfig,
  VPCharter,
  DisciplinePack,
  AgentDefinition,
} from '../types/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for the organizational generation process.
 *
 * @description
 * Controls various aspects of the generation process including the target
 * industry, organization size, and progress tracking callbacks.
 *
 * @example
 * ```typescript
 * const options: GenesisOptions = {
 *   industry: 'technology',
 *   size: 'medium',
 *   nodeCount: 10,
 *   saveToRegistry: true,
 *   onProgress: (phase, progress) => {
 *     console.log(`Generating ${phase}: ${progress}%`);
 *   },
 * };
 * ```
 */
export interface GenesisOptions {
  /**
   * Target industry for the organization.
   *
   * Influences the default disciplines, agent specializations,
   * and compliance requirements generated.
   *
   * @default 'technology'
   */
  industry?: OrgIndustry;

  /**
   * Size tier for the organization.
   *
   * Determines the number of VPs, disciplines, and agents generated:
   * - `small`: 1-3 VPs, 2-4 disciplines per VP
   * - `medium`: 3-5 VPs, 3-6 disciplines per VP
   * - `large`: 5-10 VPs, 4-8 disciplines per VP
   * - `enterprise`: 10+ VPs, 6-12 disciplines per VP
   *
   * @default 'medium'
   */
  size?: OrgSize;

  /**
   * Target number of compute nodes for the organization.
   *
   * Used for resource allocation and infrastructure planning.
   * If not specified, defaults based on organization size.
   *
   * @optional
   */
  nodeCount?: number;

  /**
   * Whether to automatically save generated artifacts to the registry.
   *
   * When enabled, all generated VPs, disciplines, and agents will be
   * persisted to the configured registry storage.
   *
   * @default false
   */
  saveToRegistry?: boolean;

  /**
   * Progress callback invoked during generation phases.
   *
   * Use this to update UI progress indicators or logging.
   *
   * @param phase - Current generation phase name
   * @param progress - Progress percentage (0-100)
   *
   * @example
   * ```typescript
   * onProgress: (phase, progress) => {
   *   progressBar.update(phase, progress);
   * }
   * ```
   */
  onProgress?: (phase: string, progress: number) => void;

  /**
   * Custom prompt context to enhance generation.
   *
   * Additional context that will be included in LLM prompts
   * to guide the generation process.
   *
   * @optional
   */
  customContext?: string;

  /**
   * Whether to generate in dry-run mode.
   *
   * When enabled, the engine will validate inputs and simulate
   * generation without actually creating artifacts.
   *
   * @default false
   */
  dryRun?: boolean;
}

/**
 * Complete result of the organizational generation process.
 *
 * @description
 * Contains all generated artifacts including the organization manifest,
 * VP charters, discipline packs, and agent definitions, along with
 * statistics about the generation.
 *
 * @example
 * ```typescript
 * const result: GenesisResult = await engine.generate(prompt);
 *
 * console.log(`Generated organization: ${result.manifest.name}`);
 * console.log(`VPs: ${result.stats.vpCount}`);
 * console.log(`Disciplines: ${result.stats.disciplineCount}`);
 * console.log(`Agents: ${result.stats.agentCount}`);
 * ```
 */
export interface GenesisResult {
  /**
   * The generated organization manifest.
   *
   * Contains the root configuration document defining the organization's
   * identity, structure, and operational parameters.
   */
  manifest: OrganizationManifest;

  /**
   * Generated VP (Tier 1) charters.
   *
   * Array of Virtual Persona charters representing the top-level
   * supervisory agents in the organization hierarchy.
   */
  vps: VPCharter[];

  /**
   * Generated discipline packs.
   *
   * Array of discipline configurations representing functional areas
   * within the organization, each containing CLAUDE.md settings,
   * MCP configurations, and agent mappings.
   */
  disciplines: DisciplinePack[];

  /**
   * Generated agent definitions.
   *
   * Array of Tier 3 agent definitions representing specialized
   * worker agents within the organization.
   */
  agents: AgentDefinition[];

  /**
   * Generation statistics.
   *
   * Summary metrics about the generation process and results.
   */
  stats: GenesisStats;
}

/**
 * Statistics about the generation process.
 *
 * @description
 * Provides summary metrics about what was generated and resource usage.
 */
export interface GenesisStats {
  /**
   * Total number of VP charters generated.
   */
  vpCount: number;

  /**
   * Total number of discipline packs generated.
   */
  disciplineCount: number;

  /**
   * Total number of agent definitions generated.
   */
  agentCount: number;

  /**
   * Total LLM tokens consumed during generation.
   *
   * @optional - Only populated when LLM-based generation is used
   */
  totalTokensUsed?: number;

  /**
   * Total generation time in milliseconds.
   */
  generationTimeMs: number;

  /**
   * Timestamp when generation started.
   */
  startedAt: Date;

  /**
   * Timestamp when generation completed.
   */
  completedAt: Date;
}

/**
 * Configuration for the GenesisEngine.
 *
 * @description
 * Controls the engine's behavior including registry configuration
 * and generation limits.
 *
 * @example
 * ```typescript
 * const config: GenesisEngineConfig = {
 *   registry: existingRegistry,
 *   maxVPs: 10,
 *   maxDisciplinesPerVP: 8,
 *   maxAgentsPerDiscipline: 20,
 * };
 *
 * const engine = new GenesisEngine(config);
 * ```
 */
export interface GenesisEngineConfig {
  /**
   * Pre-configured registry manager for persistence.
   *
   * If not provided, a new in-memory registry will be created.
   *
   * @optional
   */
  registry?: RegistryManager;

  /**
   * Registry manager configuration.
   *
   * Used to create a new registry if `registry` is not provided.
   *
   * @optional
   */
  registryConfig?: RegistryManagerConfig;

  /**
   * Maximum number of VPs to generate.
   *
   * Acts as a hard limit regardless of organization size.
   *
   * @default 20
   */
  maxVPs?: number;

  /**
   * Maximum number of disciplines per VP.
   *
   * Limits the discipline count generated for each VP.
   *
   * @default 12
   */
  maxDisciplinesPerVP?: number;

  /**
   * Maximum number of agents per discipline.
   *
   * Limits the agent count generated for each discipline.
   *
   * @default 25
   */
  maxAgentsPerDiscipline?: number;

  /**
   * Enable verbose logging during generation.
   *
   * @default false
   */
  verbose?: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values for the GenesisEngine.
 * @internal
 */
const DEFAULT_ENGINE_CONFIG: Required<
  Omit<GenesisEngineConfig, 'registry' | 'registryConfig'>
> = {
  maxVPs: 20,
  maxDisciplinesPerVP: 12,
  maxAgentsPerDiscipline: 25,
  verbose: false,
};

/**
 * Default VP counts by organization size.
 * @internal
 */
const VP_COUNT_BY_SIZE: Record<OrgSize, { min: number; max: number }> = {
  small: { min: 1, max: 3 },
  medium: { min: 3, max: 5 },
  large: { min: 5, max: 10 },
  enterprise: { min: 10, max: 20 },
};

// ============================================================================
// GenesisEngine Class
// ============================================================================

/**
 * GenesisEngine - Main orchestrator for organizational generation.
 *
 * @description
 * The GenesisEngine coordinates the complete generation of organizational
 * structures from high-level prompts or configuration objects. It implements
 * the recursive generation protocol:
 *
 * 1. **Phase 1**: Generate VP charters based on organization requirements
 * 2. **Phase 2**: Generate discipline packs for each VP
 * 3. **Phase 3**: Generate specialized agents for each discipline
 *
 * The engine can operate in various modes:
 * - **Prompt-based**: Natural language description generates full org
 * - **Config-based**: Structured configuration for precise control
 * - **Phased**: Run individual phases for incremental generation
 *
 * @example
 * ```typescript
 * // Create engine with file-based registry
 * const engine = new GenesisEngine({
 *   registryConfig: {
 *     storageType: 'file',
 *     basePath: './.wundr/registry',
 *   },
 * });
 *
 * // Generate from prompt
 * const result = await engine.generate(
 *   'Create a healthcare AI company with clinical and engineering teams',
 *   { industry: 'healthcare', size: 'medium' }
 * );
 *
 * // Save to registry
 * await engine.saveToRegistry(result);
 *
 * // Export to directory
 * await engine.exportToDirectory(result, './org-output');
 * ```
 */
export class GenesisEngine {
  /**
   * VP generator for Phase 1 generation.
   * @internal
   */
  private readonly vpGenerator: VPGenerator;

  /**
   * Discipline generator for Phase 2 generation.
   * @internal
   */
  private readonly disciplineGenerator: DisciplineGenerator;

  /**
   * Agent generator for Phase 3 generation.
   * @internal
   */
  private readonly agentGenerator: AgentGenerator;

  /**
   * Manifest generator for creating organization manifests.
   * @internal
   */
  private readonly manifestGenerator: ManifestGenerator;

  /**
   * Registry manager for persistence operations.
   * @internal
   */
  private readonly registry: RegistryManager;

  /**
   * Engine configuration.
   * @internal
   */
  private readonly config: Required<
    Omit<GenesisEngineConfig, 'registry' | 'registryConfig'>
  >;

  /**
   * Create a new GenesisEngine instance.
   *
   * @description
   * Initializes the engine with all required sub-generators and
   * configures the registry for persistence operations.
   *
   * @param config - Optional configuration for the engine
   *
   * @example
   * ```typescript
   * // Create with defaults (in-memory registry)
   * const engine = new GenesisEngine();
   *
   * // Create with custom registry
   * const customEngine = new GenesisEngine({
   *   registry: existingRegistry,
   *   maxVPs: 10,
   *   verbose: true,
   * });
   *
   * // Create with file-based persistence
   * const persistentEngine = new GenesisEngine({
   *   registryConfig: {
   *     storageType: 'file',
   *     basePath: './my-registry',
   *   },
   * });
   * ```
   */
  constructor(config?: GenesisEngineConfig) {
    // Merge configuration with defaults
    this.config = {
      ...DEFAULT_ENGINE_CONFIG,
      ...config,
    };

    // Initialize or create registry
    this.registry =
      config?.registry ?? createRegistryManager(config?.registryConfig);

    // Initialize sub-generators
    this.vpGenerator = new VPGenerator();
    this.disciplineGenerator = new DisciplineGenerator();
    this.agentGenerator = new AgentGenerator();
    this.manifestGenerator = new ManifestGenerator();
  }

  /**
   * Generate a complete organization from a natural language prompt.
   *
   * @description
   * Main entry point for organization generation. Takes a natural language
   * description of the desired organization and generates a complete
   * hierarchical structure including VPs, disciplines, and agents.
   *
   * The generation process:
   * 1. Parses the prompt to extract organization requirements
   * 2. Generates VP charters based on inferred structure
   * 3. Generates discipline packs for each VP
   * 4. Generates specialized agents for each discipline
   * 5. Creates the organization manifest
   *
   * @param prompt - Natural language description of the organization
   * @param options - Optional generation options
   * @returns Promise resolving to the complete generation result
   *
   * @example
   * ```typescript
   * const result = await engine.generate(
   *   'Create a legal tech startup with product, engineering, and legal teams',
   *   {
   *     industry: 'legal',
   *     size: 'small',
   *     saveToRegistry: true,
   *     onProgress: (phase, progress) => console.log(`${phase}: ${progress}%`),
   *   }
   * );
   *
   * console.log(`Generated org: ${result.manifest.name}`);
   * console.log(`Total agents: ${result.stats.agentCount}`);
   * ```
   */
  async generate(
    prompt: string,
    options?: GenesisOptions
  ): Promise<GenesisResult> {
    const startedAt = new Date();
    const industry = options?.industry ?? 'technology';
    const size = options?.size ?? 'medium';

    // Report progress
    this.reportProgress(options?.onProgress, 'Parsing prompt', 0);

    // Build configuration from prompt
    const config = this.buildConfigFromPrompt(prompt, industry, size, options);

    // Report progress
    this.reportProgress(options?.onProgress, 'Configuration built', 10);

    // Generate from config
    const result = await this.generateFromConfig(config, options);

    // Update timestamps
    result.stats.startedAt = startedAt;
    result.stats.completedAt = new Date();
    result.stats.generationTimeMs =
      result.stats.completedAt.getTime() - startedAt.getTime();

    // Save to registry if requested
    if (options?.saveToRegistry && !options?.dryRun) {
      await this.saveToRegistry(result);
    }

    return result;
  }

  /**
   * Generate a complete organization from a configuration object.
   *
   * @description
   * Generates a complete organizational structure from a structured
   * configuration object. This method provides precise control over
   * the generation process compared to prompt-based generation.
   *
   * @param config - Organization creation configuration
   * @param options - Optional generation options
   * @returns Promise resolving to the complete generation result
   *
   * @example
   * ```typescript
   * const config: CreateOrgConfig = {
   *   name: 'Acme AI Labs',
   *   mission: 'Democratizing AI for everyone',
   *   industry: 'technology',
   *   size: 'medium',
   *   initialDisciplines: ['engineering', 'product', 'research'],
   * };
   *
   * const result = await engine.generateFromConfig(config);
   * ```
   */
  async generateFromConfig(
    config: CreateOrgConfig,
    options?: GenesisOptions
  ): Promise<GenesisResult> {
    const startedAt = new Date();
    const totalTokensUsed = 0;

    // Dry run validation
    if (options?.dryRun) {
      this.log('Running in dry-run mode - no artifacts will be created');
    }

    // Phase 1: Generate VPs
    this.reportProgress(options?.onProgress, 'Phase 1: Generating VPs', 15);
    const vps = await this.generatePhase1(config, options);
    this.reportProgress(options?.onProgress, 'Phase 1: VPs generated', 35);

    // Phase 2: Generate disciplines
    this.reportProgress(
      options?.onProgress,
      'Phase 2: Generating disciplines',
      40
    );
    const disciplines = await this.generatePhase2(
      vps,
      config.industry,
      options
    );
    this.reportProgress(
      options?.onProgress,
      'Phase 2: Disciplines generated',
      65
    );

    // Phase 3: Generate agents
    this.reportProgress(options?.onProgress, 'Phase 3: Generating agents', 70);
    const agents = await this.generatePhase3(disciplines, options);
    this.reportProgress(options?.onProgress, 'Phase 3: Agents generated', 90);

    // Generate manifest
    this.reportProgress(
      options?.onProgress,
      'Creating organization manifest',
      95
    );
    const manifest = await this.createManifest(config, vps, disciplines);

    const completedAt = new Date();

    // Build result
    const result: GenesisResult = {
      manifest,
      vps,
      disciplines,
      agents,
      stats: {
        vpCount: vps.length,
        disciplineCount: disciplines.length,
        agentCount: agents.length,
        totalTokensUsed: totalTokensUsed > 0 ? totalTokensUsed : undefined,
        generationTimeMs: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      },
    };

    this.reportProgress(options?.onProgress, 'Generation complete', 100);

    return result;
  }

  /**
   * Generate VP charters (Phase 1).
   *
   * @description
   * First phase of the recursive generation protocol. Generates
   * Virtual Persona (Tier 1) charters based on the organization
   * configuration.
   *
   * @param config - Organization creation configuration
   * @param options - Optional generation options
   * @returns Promise resolving to array of VP charters
   *
   * @example
   * ```typescript
   * const vps = await engine.generatePhase1(config);
   * console.log(`Generated ${vps.length} VP charters`);
   * ```
   */
  async generatePhase1(
    config: CreateOrgConfig,
    options?: GenesisOptions
  ): Promise<VPCharter[]> {
    const size = config.size;
    const vpRange = VP_COUNT_BY_SIZE[size];

    // Determine VP count based on config or size defaults
    const targetVpCount =
      config.vpCount ?? Math.floor((vpRange.min + vpRange.max) / 2);
    const vpCount = Math.min(targetVpCount, this.config.maxVPs);

    this.log(`Generating ${vpCount} VPs for ${size} organization`);

    // Build the VP generation context
    const vpContext: VPGenerationContext = {
      orgName: config.name,
      industry: config.industry,
      mission: config.mission,
      size: config.size,
      nodeCount: options?.nodeCount ?? this.getDefaultNodeCount(config.size),
      vpCount,
      disciplineNames: config.initialDisciplines,
    };

    // Generate all VPs at once using the VPGenerator
    const result = await this.vpGenerator.generate(vpContext);

    // Log any warnings from generation
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.log(`VP Generation Warning: ${warning}`);
      }
    }

    // Report incremental progress for each generated VP
    for (let i = 0; i < result.vps.length; i++) {
      const vp = result.vps[i];
      const progress = 15 + Math.floor(((i + 1) / result.vps.length) * 20);
      this.reportProgress(
        options?.onProgress,
        `Generated VP: ${vp.identity.name}`,
        progress
      );
    }

    return result.vps;
  }

  /**
   * Generate discipline packs (Phase 2).
   *
   * @description
   * Second phase of the recursive generation protocol. Generates
   * discipline packs for each VP based on their responsibilities
   * and the organization's industry.
   *
   * @param vps - Array of VP charters from Phase 1
   * @param industry - Organization industry
   * @param options - Optional generation options
   * @returns Promise resolving to array of discipline packs
   *
   * @example
   * ```typescript
   * const disciplines = await engine.generatePhase2(vps, 'technology');
   * console.log(`Generated ${disciplines.length} discipline packs`);
   * ```
   */
  async generatePhase2(
    vps: VPCharter[],
    industry: OrgIndustry,
    options?: GenesisOptions
  ): Promise<DisciplinePack[]> {
    const allDisciplines: DisciplinePack[] = [];
    const existingDisciplineSlugs: string[] = [];

    this.log(`Generating disciplines for ${vps.length} VPs`);

    for (let vpIndex = 0; vpIndex < vps.length; vpIndex++) {
      const vp = vps[vpIndex];

      // Use the convenience method to generate disciplines for this VP
      const disciplines = await this.disciplineGenerator.generateForVP(
        vp,
        industry
      );

      // Limit disciplines per VP
      const limitedDisciplines = disciplines.slice(
        0,
        this.config.maxDisciplinesPerVP
      );

      for (let i = 0; i < limitedDisciplines.length; i++) {
        const discipline = limitedDisciplines[i];

        // Skip duplicates
        if (existingDisciplineSlugs.includes(discipline.slug)) {
          this.log(`Skipping duplicate discipline: ${discipline.slug}`);
          continue;
        }

        existingDisciplineSlugs.push(discipline.slug);
        allDisciplines.push(discipline);

        // Update VP with discipline ID
        if (!vp.disciplineIds.includes(discipline.id)) {
          vp.disciplineIds.push(discipline.id);
        }

        // Report incremental progress
        const overallProgress =
          40 +
          Math.floor(
            ((vpIndex * limitedDisciplines.length + i) /
              (vps.length * limitedDisciplines.length)) *
              25
          );
        this.reportProgress(
          options?.onProgress,
          `Generated discipline: ${discipline.name}`,
          overallProgress
        );
      }
    }

    return allDisciplines;
  }

  /**
   * Generate agent definitions (Phase 3).
   *
   * @description
   * Third phase of the recursive generation protocol. Generates
   * specialized Tier 3 agent definitions for each discipline.
   *
   * @param disciplines - Array of discipline packs from Phase 2
   * @param options - Optional generation options
   * @returns Promise resolving to array of agent definitions
   *
   * @example
   * ```typescript
   * const agents = await engine.generatePhase3(disciplines);
   * console.log(`Generated ${agents.length} agent definitions`);
   * ```
   */
  async generatePhase3(
    disciplines: DisciplinePack[],
    options?: GenesisOptions
  ): Promise<AgentDefinition[]> {
    const allAgents: AgentDefinition[] = [];
    const existingAgentSlugs: string[] = [];

    this.log(`Generating agents for ${disciplines.length} disciplines`);

    for (let discIndex = 0; discIndex < disciplines.length; discIndex++) {
      const discipline = disciplines[discIndex];

      // Use the convenience method to generate agents for this discipline
      const result =
        await this.agentGenerator.generateForDiscipline(discipline);

      // Log any warnings from generation
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          this.log(`Agent Generation Warning (${discipline.name}): ${warning}`);
        }
      }

      // Limit agents per discipline
      const limitedAgents = result.agents.slice(
        0,
        this.config.maxAgentsPerDiscipline
      );

      for (let i = 0; i < limitedAgents.length; i++) {
        const agent = limitedAgents[i];

        // Skip duplicates (universal agents might appear multiple times)
        if (existingAgentSlugs.includes(agent.slug)) {
          this.log(`Skipping duplicate agent: ${agent.slug}`);
          // But still associate with this discipline
          if (!discipline.agentIds.includes(agent.id)) {
            discipline.agentIds.push(agent.id);
          }
          continue;
        }

        existingAgentSlugs.push(agent.slug);

        // Associate agent with discipline
        if (!discipline.agentIds.includes(agent.id)) {
          discipline.agentIds.push(agent.id);
        }
        if (!agent.usedByDisciplines.includes(discipline.slug)) {
          agent.usedByDisciplines.push(discipline.slug);
        }

        allAgents.push(agent);

        // Report incremental progress
        const overallProgress =
          70 +
          Math.floor(
            ((discIndex * limitedAgents.length + i) /
              (disciplines.length * limitedAgents.length)) *
              20
          );
        this.reportProgress(
          options?.onProgress,
          `Generated agent: ${agent.name}`,
          overallProgress
        );
      }
    }

    return allAgents;
  }

  /**
   * Save generated artifacts to the registry.
   *
   * @description
   * Persists all generated VPs, disciplines, and agents to the
   * configured registry storage. This enables retrieval and
   * management of generated organizations.
   *
   * @param result - Generation result to persist
   * @returns Promise that resolves when all artifacts are saved
   *
   * @example
   * ```typescript
   * const result = await engine.generate(prompt);
   * await engine.saveToRegistry(result);
   * console.log('Organization saved to registry');
   * ```
   */
  async saveToRegistry(result: GenesisResult): Promise<void> {
    this.log('Saving generation result to registry');

    // Initialize registry if needed
    await this.registry.initialize();

    // Save VPs
    for (const vp of result.vps) {
      await this.registry.charters.registerVP(vp);
    }
    this.log(`Saved ${result.vps.length} VP charters`);

    // Save disciplines
    for (const discipline of result.disciplines) {
      await this.registry.disciplines.register(discipline);
    }
    this.log(`Saved ${result.disciplines.length} discipline packs`);

    // Save agents
    for (const agent of result.agents) {
      await this.registry.agents.register(agent);
    }
    this.log(`Saved ${result.agents.length} agent definitions`);
  }

  /**
   * Export generated artifacts to a directory.
   *
   * @description
   * Writes all generated artifacts to the filesystem in a structured
   * directory layout. Creates separate directories for VPs, disciplines,
   * and agents, with JSON files for each entity.
   *
   * Directory structure:
   * ```
   * {path}/
   *   manifest.json
   *   vps/
   *     {vp-slug}.json
   *   disciplines/
   *     {discipline-slug}.json
   *   agents/
   *     {agent-slug}.json
   * ```
   *
   * @param result - Generation result to export
   * @param path - Target directory path
   * @returns Promise that resolves when export is complete
   *
   * @example
   * ```typescript
   * const result = await engine.generate(prompt);
   * await engine.exportToDirectory(result, './generated-org');
   * console.log('Organization exported to ./generated-org');
   * ```
   */
  async exportToDirectory(result: GenesisResult, path: string): Promise<void> {
    this.log(`Exporting generation result to: ${path}`);

    // Import fs dynamically for Node.js compatibility
    const fs = await import('fs/promises');
    const pathModule = await import('path');

    // Create base directory
    await fs.mkdir(path, { recursive: true });

    // Write manifest
    const manifestPath = pathModule.join(path, 'manifest.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(this.serializeManifest(result.manifest), null, 2)
    );
    this.log(`Wrote manifest to ${manifestPath}`);

    // Create and write VPs
    const vpsDir = pathModule.join(path, 'vps');
    await fs.mkdir(vpsDir, { recursive: true });
    for (const vp of result.vps) {
      const vpPath = pathModule.join(vpsDir, `${vp.identity.slug}.json`);
      await fs.writeFile(vpPath, JSON.stringify(this.serializeVP(vp), null, 2));
    }
    this.log(`Wrote ${result.vps.length} VP charters to ${vpsDir}`);

    // Create and write disciplines
    const disciplinesDir = pathModule.join(path, 'disciplines');
    await fs.mkdir(disciplinesDir, { recursive: true });
    for (const discipline of result.disciplines) {
      const disciplinePath = pathModule.join(
        disciplinesDir,
        `${discipline.slug}.json`
      );
      await fs.writeFile(
        disciplinePath,
        JSON.stringify(this.serializeDiscipline(discipline), null, 2)
      );
    }
    this.log(
      `Wrote ${result.disciplines.length} discipline packs to ${disciplinesDir}`
    );

    // Create and write agents
    const agentsDir = pathModule.join(path, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    for (const agent of result.agents) {
      const agentPath = pathModule.join(agentsDir, `${agent.slug}.json`);
      await fs.writeFile(
        agentPath,
        JSON.stringify(this.serializeAgent(agent), null, 2)
      );
    }
    this.log(`Wrote ${result.agents.length} agent definitions to ${agentsDir}`);
  }

  /**
   * Get the registry manager instance.
   *
   * @returns The registry manager used by this engine
   */
  getRegistry(): RegistryManager {
    return this.registry;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a CreateOrgConfig from a natural language prompt.
   * @internal
   */
  private buildConfigFromPrompt(
    prompt: string,
    industry: OrgIndustry,
    size: OrgSize,
    options?: GenesisOptions
  ): CreateOrgConfig {
    // Extract organization name from prompt or generate default
    const name =
      this.extractOrgName(prompt) ??
      `${industry.charAt(0).toUpperCase() + industry.slice(1)} Organization`;

    // Generate slug from name
    const slug = this.generateSlug(name);

    // Extract or infer mission
    const mission =
      this.extractMission(prompt) ?? `Delivering excellence in ${industry}`;

    // Extract or infer initial disciplines
    const initialDisciplines = this.extractDisciplines(prompt, industry);

    return {
      name,
      slug,
      mission,
      description: options?.customContext ?? prompt,
      industry,
      size,
      generateDisciplines: true,
      generateAgents: true,
      initialDisciplines,
      dryRun: options?.dryRun,
    };
  }

  /**
   * Extract organization name from prompt.
   * @internal
   */
  private extractOrgName(prompt: string): string | undefined {
    // Simple extraction - look for common patterns
    const patterns = [
      /create\s+(?:a\s+)?(?:new\s+)?(?:company|organization|org|startup|team)\s+(?:called|named)\s+['"]?([^'",.]+)['"]?/i,
      /(?:company|organization|org|startup)\s+['"]([^'"]+)['"]/i,
      /['"]([^'"]+)['"]\s+(?:company|organization|org|startup)/i,
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract mission statement from prompt.
   * @internal
   */
  private extractMission(prompt: string): string | undefined {
    const patterns = [
      /mission\s+(?:is\s+)?(?:to\s+)?['"]?([^'",.]+)['"]?/i,
      /focused\s+on\s+['"]?([^'",.]+)['"]?/i,
      /dedicated\s+to\s+['"]?([^'",.]+)['"]?/i,
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract discipline names from prompt.
   * @internal
   */
  private extractDisciplines(prompt: string, industry: OrgIndustry): string[] {
    const disciplines: string[] = [];

    // Common discipline keywords
    const disciplineKeywords = [
      'engineering',
      'product',
      'design',
      'marketing',
      'sales',
      'legal',
      'finance',
      'hr',
      'human resources',
      'operations',
      'research',
      'support',
      'customer success',
      'data',
      'analytics',
      'security',
      'compliance',
      'clinical',
      'medical',
    ];

    const lowerPrompt = prompt.toLowerCase();

    for (const keyword of disciplineKeywords) {
      if (lowerPrompt.includes(keyword)) {
        // Normalize to standard discipline names
        const normalized = keyword === 'human resources' ? 'hr' : keyword;
        if (!disciplines.includes(normalized)) {
          disciplines.push(normalized);
        }
      }
    }

    // If no disciplines found, use industry defaults
    if (disciplines.length === 0) {
      disciplines.push(...this.getDefaultDisciplinesForIndustry(industry));
    }

    return disciplines;
  }

  /**
   * Get default disciplines for an industry.
   * @internal
   */
  private getDefaultDisciplinesForIndustry(industry: OrgIndustry): string[] {
    const defaults: Record<OrgIndustry, string[]> = {
      technology: ['engineering', 'product', 'design', 'operations'],
      finance: ['engineering', 'compliance', 'risk', 'operations'],
      healthcare: ['clinical', 'engineering', 'compliance', 'operations'],
      legal: ['legal', 'compliance', 'research', 'operations'],
      marketing: ['creative', 'analytics', 'content', 'operations'],
      manufacturing: ['engineering', 'quality', 'supply chain', 'operations'],
      retail: ['merchandising', 'operations', 'marketing', 'logistics'],
      gaming: ['engineering', 'design', 'art', 'qa'],
      media: ['content', 'production', 'distribution', 'marketing'],
      custom: ['operations', 'strategy', 'execution'],
    };

    return defaults[industry] ?? defaults.custom;
  }

  /**
   * Generate a URL-safe slug from a name.
   * @internal
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create the organization manifest.
   * @internal
   */
  private async createManifest(
    config: CreateOrgConfig,
    vps: VPCharter[],
    disciplines: DisciplinePack[]
  ): Promise<OrganizationManifest> {
    // Generate the manifest
    const result = await this.manifestGenerator.generate({
      ...config,
      // Include VP count from actual generated VPs
      vpCount: vps.length,
      // Include discipline names from generated disciplines
      initialDisciplines: disciplines.map(d => d.slug),
    });

    // Log any warnings from manifest generation
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.log(`Manifest Generation Warning: ${warning}`);
      }
    }

    // Add VP registry entries (for now, just create mappings without node assignments)
    let manifest = result.manifest;
    for (const vp of vps) {
      manifest = this.manifestGenerator.addVP(manifest, {
        vpId: vp.id,
        nodeId: vp.nodeId ?? `node-${vp.identity.slug}`,
        hostname: `${vp.identity.slug}.cluster.internal`,
        status: 'provisioning',
      });
    }

    // Add discipline IDs to the manifest
    manifest = this.manifestGenerator.update(manifest, {
      disciplineIds: disciplines.map(d => d.id),
    });

    return manifest;
  }

  /**
   * Report progress to callback if provided.
   * @internal
   */
  private reportProgress(
    callback: ((phase: string, progress: number) => void) | undefined,
    phase: string,
    progress: number
  ): void {
    if (callback) {
      callback(phase, progress);
    }
  }

  /**
   * Log message if verbose mode is enabled.
   * @internal
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[GenesisEngine] ${message}`);
    }
  }

  /**
   * Get default node count based on organization size.
   * @internal
   */
  private getDefaultNodeCount(size: OrgSize): number {
    const nodeCountBySize: Record<OrgSize, number> = {
      small: 3,
      medium: 5,
      large: 10,
      enterprise: 20,
    };
    return nodeCountBySize[size];
  }

  /**
   * Serialize manifest for JSON export.
   * @internal
   */
  private serializeManifest(
    manifest: OrganizationManifest
  ): Record<string, unknown> {
    return {
      ...manifest,
      createdAt: manifest.createdAt.toISOString(),
      updatedAt: manifest.updatedAt.toISOString(),
    };
  }

  /**
   * Serialize VP charter for JSON export.
   * @internal
   */
  private serializeVP(vp: VPCharter): Record<string, unknown> {
    return {
      ...vp,
      createdAt: vp.createdAt.toISOString(),
      updatedAt: vp.updatedAt.toISOString(),
    };
  }

  /**
   * Serialize discipline for JSON export.
   * @internal
   */
  private serializeDiscipline(
    discipline: DisciplinePack
  ): Record<string, unknown> {
    return {
      ...discipline,
      createdAt: discipline.createdAt.toISOString(),
      updatedAt: discipline.updatedAt.toISOString(),
    };
  }

  /**
   * Serialize agent for JSON export.
   * @internal
   */
  private serializeAgent(agent: AgentDefinition): Record<string, unknown> {
    return {
      ...agent,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GenesisEngine instance with the specified configuration.
 *
 * @description
 * Factory function for creating configured GenesisEngine instances.
 * This is the recommended way to create engines, providing sensible
 * defaults when configuration is not specified.
 *
 * @param config - Optional configuration options
 * @returns A new GenesisEngine instance
 *
 * @example
 * ```typescript
 * // Create with defaults (in-memory registry)
 * const engine = createGenesisEngine();
 *
 * // Create with file-based persistence
 * const persistentEngine = createGenesisEngine({
 *   registryConfig: {
 *     storageType: 'file',
 *     basePath: './.wundr/registry',
 *   },
 *   verbose: true,
 * });
 *
 * // Generate organization
 * const result = await engine.generate('Create a fintech company');
 * ```
 */
export function createGenesisEngine(
  config?: GenesisEngineConfig
): GenesisEngine {
  return new GenesisEngine(config);
}
