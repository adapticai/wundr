/**
 * @wundr/orchestrator-daemon - Agent Registry
 *
 * Central registry that maps agent IDs to their loaded definitions and provides
 * lookup APIs for type-based, tier-based, and capability-based agent discovery.
 * Supports agent groups, team composition derived from session managers, and
 * type restriction validation for Task(agent_type) syntax.
 *
 * Replaces the hardcoded AGENT_REGISTRY in ClaudeFlowOrchestrator with a
 * dynamic, file-driven registry.
 */

import { AgentLoader, createAgentLoader } from './agent-loader';
import type {
  AgentDefinition,
  AgentGroup,
  AgentMetadata,
  AgentPriority,
  AgentRequirements,
  AgentTier,
  AgentType,
  ModelPreference,
  RegistryStats,
} from './agent-types';

// =============================================================================
// Types
// =============================================================================

export interface AgentRegistryOptions {
  /** Optional pre-configured loader. If not provided, one will be created. */
  readonly loader?: AgentLoader;
  /** Project root for creating a default loader. */
  readonly projectRoot?: string;
  /** Logger for warnings and errors. */
  readonly logger?: (message: string) => void;
}

// =============================================================================
// Agent Registry
// =============================================================================

export class AgentRegistry {
  private readonly definitions: Map<string, AgentDefinition> = new Map();
  private readonly groups: Map<string, AgentGroup> = new Map();
  private readonly loader: AgentLoader | null;
  private readonly logger: (message: string) => void;

  constructor(options: AgentRegistryOptions = {}) {
    this.loader = options.loader ?? (
      options.projectRoot
        ? createAgentLoader(options.projectRoot)
        : null
    );
    this.logger = options.logger ?? console.warn;
  }

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Registers a single agent definition.
   * If an agent with the same ID already exists, it is replaced.
   */
  register(definition: AgentDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Loads and registers all agent definitions from the agents directory.
   * Returns the number of successfully loaded definitions.
   */
  async loadFromDirectory(): Promise<number> {
    if (!this.loader) {
      throw new Error(
        'AgentRegistry: No loader configured. Provide a loader or projectRoot in options.'
      );
    }

    const result = await this.loader.loadAll();

    for (const definition of result.definitions) {
      this.definitions.set(definition.id, definition);
    }

    for (const error of result.errors) {
      this.logger(
        `[AgentRegistry] Failed to load ${error.filePath}: ${error.error}`
      );
    }

    // Auto-derive groups from session manager keySubAgents
    this.deriveTeamGroups();

    return result.definitions.length;
  }

  /**
   * Removes an agent definition from the registry.
   * Returns true if the agent was found and removed.
   */
  unregister(agentId: string): boolean {
    return this.definitions.delete(agentId);
  }

  // ===========================================================================
  // Lookup
  // ===========================================================================

  /**
   * Gets an agent definition by its ID.
   */
  get(agentId: string): AgentDefinition | undefined {
    return this.definitions.get(agentId.toLowerCase().trim());
  }

  /**
   * Gets all agent definitions matching a given type.
   */
  getByType(type: AgentType): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.type === type);
  }

  /**
   * Gets all agent definitions at a given tier.
   */
  getByTier(tier: AgentTier): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.tier === tier);
  }

  /**
   * Gets all agent definitions that have a specific capability.
   */
  getByCapability(capability: string): AgentDefinition[] {
    const cap = capability.toLowerCase().trim();
    return this.filterDefinitions(
      def => def.metadata.capabilities?.some(
        c => c.toLowerCase() === cap
      ) ?? false
    );
  }

  /**
   * Gets all agent definitions in a given category (directory-based).
   */
  getByCategory(category: string): AgentDefinition[] {
    const cat = category.toLowerCase().trim();
    return this.filterDefinitions(
      def => def.category.toLowerCase() === cat
    );
  }

  /**
   * Gets all agent definitions matching a given priority level.
   */
  getByPriority(priority: AgentPriority): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.priority === priority);
  }

  /**
   * Gets all agent definitions that use a specific model.
   */
  getByModel(model: ModelPreference): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.model === model);
  }

  /**
   * Finds the best-matching agent for given requirements.
   * Scoring is based on capability match, type preference, and tier preference.
   */
  findBestMatch(requirements: AgentRequirements): AgentDefinition | undefined {
    const candidates = this.listAll();
    if (candidates.length === 0) {
      return undefined;
    }

    const scored = candidates.map(def => ({
      definition: def,
      score: this.scoreAgent(def, requirements),
    }));

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    return best && best.score > 0 ? best.definition : undefined;
  }

  /**
   * Searches agent definitions by a text query against name, description,
   * and capabilities.
   */
  search(query: string): AgentDefinition[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }

    return this.filterDefinitions(def => {
      const name = def.metadata.name.toLowerCase();
      const desc = (def.metadata.description ?? '').toLowerCase();
      const caps = (def.metadata.capabilities ?? []).join(' ').toLowerCase();

      return name.includes(q) || desc.includes(q) || caps.includes(q);
    });
  }

  // ===========================================================================
  // Groups & Teams
  // ===========================================================================

  /**
   * Defines a named group of agents.
   */
  defineGroup(
    groupId: string,
    agentIds: string[],
    description?: string
  ): void {
    this.groups.set(groupId, {
      groupId,
      agentIds: [...agentIds],
      description,
    });
  }

  /**
   * Gets the agent definitions in a named group.
   */
  getGroup(groupId: string): AgentDefinition[] {
    const group = this.groups.get(groupId);
    if (!group) {
      return [];
    }

    return group.agentIds
      .map(id => this.get(id))
      .filter((def): def is AgentDefinition => def !== undefined);
  }

  /**
   * Gets the team of sub-agents associated with a session manager.
   * Derived from the manager's `keySubAgents` metadata field.
   */
  getTeamForManager(managerId: string): AgentDefinition[] {
    const manager = this.get(managerId);
    if (!manager) {
      return [];
    }

    const subAgentIds = manager.metadata.keySubAgents ?? [];
    return subAgentIds
      .map(id => this.get(id))
      .filter((def): def is AgentDefinition => def !== undefined);
  }

  /**
   * Lists all defined groups.
   */
  listGroups(): AgentGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Removes a group definition.
   */
  removeGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  // ===========================================================================
  // Type Restrictions
  // ===========================================================================

  /**
   * Validates that an agent matches a required type restriction.
   * Used for Task(agent_type) syntax validation.
   */
  validateTypeRestriction(
    agentId: string,
    requiredType: AgentType
  ): boolean {
    const definition = this.get(agentId);
    if (!definition) {
      return false;
    }

    return definition.metadata.type === requiredType;
  }

  /**
   * Validates that an agent meets minimum tier requirements.
   * Lower tier numbers indicate higher authority.
   */
  validateTierRestriction(
    agentId: string,
    maxTier: AgentTier
  ): boolean {
    const definition = this.get(agentId);
    if (!definition || definition.metadata.tier === undefined) {
      return false;
    }

    return definition.metadata.tier <= maxTier;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Reloads all agent definitions from disk.
   * Clears the current registry and reloads from the agents directory.
   */
  async reload(): Promise<void> {
    this.definitions.clear();
    this.groups.clear();

    if (this.loader) {
      this.loader.clearCache();
      await this.loadFromDirectory();
    }
  }

  /**
   * Returns all registered agent definitions.
   */
  listAll(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Returns the total number of registered agents.
   */
  get size(): number {
    return this.definitions.size;
  }

  /**
   * Returns summary statistics about the registry.
   */
  getStats(): RegistryStats {
    const byType: Record<string, number> = {};
    const byTier: Record<number, number> = {};
    const byCategory: Record<string, number> = {};

    for (const def of this.definitions.values()) {
      const type = def.metadata.type ?? 'unspecified';
      byType[type] = (byType[type] ?? 0) + 1;

      if (def.metadata.tier !== undefined) {
        byTier[def.metadata.tier] = (byTier[def.metadata.tier] ?? 0) + 1;
      }

      byCategory[def.category] = (byCategory[def.category] ?? 0) + 1;
    }

    return {
      totalDefinitions: this.definitions.size,
      byType,
      byTier,
      byCategory,
      totalGroups: this.groups.size,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Filters definitions by a predicate.
   */
  private filterDefinitions(
    predicate: (def: AgentDefinition) => boolean
  ): AgentDefinition[] {
    const results: AgentDefinition[] = [];
    for (const def of this.definitions.values()) {
      if (predicate(def)) {
        results.push(def);
      }
    }
    return results;
  }

  /**
   * Scores an agent definition against requirements.
   */
  private scoreAgent(
    def: AgentDefinition,
    req: AgentRequirements
  ): number {
    let score = 0;
    const meta = def.metadata;

    // Capability match (most important)
    if (req.requiredCapabilities && req.requiredCapabilities.length > 0) {
      const agentCaps = new Set(
        (meta.capabilities ?? []).map(c => c.toLowerCase())
      );
      let matchCount = 0;
      for (const reqCap of req.requiredCapabilities) {
        if (agentCaps.has(reqCap.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount === 0) {
        return 0; // No capability match at all
      }

      score += (matchCount / req.requiredCapabilities.length) * 50;
    } else {
      score += 25; // No requirements = partial baseline
    }

    // Type preference
    if (req.preferredType && meta.type === req.preferredType) {
      score += 20;
    }

    // Tier preference
    if (req.preferredTier !== undefined && meta.tier === req.preferredTier) {
      score += 15;
    }

    // Model preference
    if (req.preferredModel && meta.model === req.preferredModel) {
      score += 10;
    }

    // Priority bonus
    const priorityScores: Record<string, number> = {
      critical: 5,
      high: 3,
      medium: 1,
      low: 0,
    };
    if (meta.priority) {
      score += priorityScores[meta.priority] ?? 0;
    }

    return score;
  }

  /**
   * Automatically creates groups from session manager keySubAgents fields.
   */
  private deriveTeamGroups(): void {
    for (const def of this.definitions.values()) {
      if (
        def.metadata.type === 'session-manager' &&
        def.metadata.keySubAgents &&
        def.metadata.keySubAgents.length > 0
      ) {
        const groupId = `team:${def.id}`;
        this.defineGroup(
          groupId,
          def.metadata.keySubAgents as string[],
          `Team managed by ${def.metadata.name}`
        );
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AgentRegistry and loads definitions from the standard directory.
 */
export async function createAgentRegistry(
  projectRoot: string
): Promise<AgentRegistry> {
  const registry = new AgentRegistry({ projectRoot });
  await registry.loadFromDirectory();
  return registry;
}

/**
 * Creates an empty AgentRegistry for manual registration.
 */
export function createEmptyRegistry(): AgentRegistry {
  return new AgentRegistry();
}
