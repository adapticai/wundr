/**
 * @wundr/orchestrator-daemon - Agent Registry
 *
 * Central registry that maps agent IDs to their loaded definitions and provides
 * lookup APIs for type-based, tier-based, and capability-based agent discovery.
 * Supports agent groups, team composition derived from session managers, and
 * type restriction validation for Task(agent_type) syntax.
 *
 * Enhanced with:
 * - Subagent spawning with Task(agent_type) restriction syntax
 * - Tool restriction validation (allowed/denied tools lists)
 * - Permission inheritance from parent agents
 * - Memory scope resolution
 * - Per-agent instance limit enforcement
 * - Agent definition enrichment from frontmatter config
 *
 * Replaces the hardcoded AGENT_REGISTRY in ClaudeFlowOrchestrator with a
 * dynamic, file-driven registry.
 */

import { createAgentLoader } from './agent-loader';
import { DEFAULT_MAX_TURNS_BY_TYPE } from './agent-types';

import type { AgentLoader } from './agent-loader';
import type {
  AgentDefinition,
  AgentGroup,
  AgentMetadata,
  AgentPermissions,
  AgentPriority,
  AgentRequirements,
  AgentTier,
  AgentType,
  MemoryScope,
  ModelPreference,
  RegistryStats,
  ToolRestrictions,
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
    this.loader =
      options.loader ??
      (options.projectRoot ? createAgentLoader(options.projectRoot) : null);
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
      def =>
        def.metadata.capabilities?.some(c => c.toLowerCase() === cap) ?? false
    );
  }

  /**
   * Gets all agent definitions in a given category (directory-based).
   */
  getByCategory(category: string): AgentDefinition[] {
    const cat = category.toLowerCase().trim();
    return this.filterDefinitions(def => def.category.toLowerCase() === cat);
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
   * Gets all agent definitions that support a given memory scope.
   */
  getByMemoryScope(scope: MemoryScope): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.memoryScope === scope);
  }

  /**
   * Gets all agent definitions that persist state across sessions.
   */
  getStateful(): AgentDefinition[] {
    return this.filterDefinitions(def => def.metadata.persistState === true);
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
  defineGroup(groupId: string, agentIds: string[], description?: string): void {
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
  // Type Restrictions (Task(agent_type) syntax)
  // ===========================================================================

  /**
   * Validates that an agent matches a required type restriction.
   * Used for Task(agent_type) syntax validation.
   *
   * Example: Task(developer) will only match agents with type === 'developer'.
   */
  validateTypeRestriction(agentId: string, requiredType: AgentType): boolean {
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
  validateTierRestriction(agentId: string, maxTier: AgentTier): boolean {
    const definition = this.get(agentId);
    if (!definition || definition.metadata.tier === undefined) {
      return false;
    }

    return definition.metadata.tier <= maxTier;
  }

  /**
   * Finds agents eligible for a Task(agent_type) spawn.
   * Returns all registered agents matching the required type that also
   * satisfy the optional tier ceiling and capability constraints.
   */
  findSpawnCandidates(
    requiredType: AgentType,
    options?: {
      readonly maxTier?: AgentTier;
      readonly requiredCapabilities?: readonly string[];
    }
  ): AgentDefinition[] {
    const typed = this.getByType(requiredType);

    return typed.filter(def => {
      // Tier ceiling check
      if (
        options?.maxTier !== undefined &&
        def.metadata.tier !== undefined &&
        def.metadata.tier > options.maxTier
      ) {
        return false;
      }

      // Capability check
      if (
        options?.requiredCapabilities &&
        options.requiredCapabilities.length > 0
      ) {
        const agentCaps = new Set(
          (def.metadata.capabilities ?? []).map(c => c.toLowerCase())
        );
        for (const reqCap of options.requiredCapabilities) {
          if (!agentCaps.has(reqCap.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }

  // ===========================================================================
  // Tool Restrictions
  // ===========================================================================

  /**
   * Resolves the effective tool set for an agent given its definition
   * and any parent restrictions.
   *
   * The resolution order is:
   * 1. If the agent has an explicit `allowed` list, use that.
   * 2. If the agent has a `denied` list, start from `availableTools` and subtract.
   * 3. If no restrictions, inherit from parent restrictions.
   * 4. If no parent, use `availableTools` as-is.
   */
  resolveEffectiveTools(
    agentId: string,
    availableTools: readonly string[],
    parentRestrictions?: ToolRestrictions
  ): string[] {
    const definition = this.get(agentId);
    const agentRestrictions = definition?.metadata.toolRestrictions;

    // Start with the agent's own restrictions
    const restrictions = agentRestrictions ?? parentRestrictions;

    if (!restrictions) {
      return [...availableTools];
    }

    // Allowed list: only these tools
    if (restrictions.allowed && restrictions.allowed.length > 0) {
      const allowSet = new Set(
        restrictions.allowed.map(t => t.toLowerCase().trim())
      );

      // If parent also has an allowed list, intersect
      let effective = availableTools.filter(t =>
        allowSet.has(t.toLowerCase().trim())
      );

      if (
        parentRestrictions?.allowed &&
        parentRestrictions.allowed.length > 0
      ) {
        const parentAllowSet = new Set(
          parentRestrictions.allowed.map(t => t.toLowerCase().trim())
        );
        effective = effective.filter(t =>
          parentAllowSet.has(t.toLowerCase().trim())
        );
      }

      return effective;
    }

    // Denied list: remove these tools
    if (restrictions.denied && restrictions.denied.length > 0) {
      const denySet = new Set(
        restrictions.denied.map(t => t.toLowerCase().trim())
      );

      // Also apply parent denied list
      if (parentRestrictions?.denied) {
        for (const t of parentRestrictions.denied) {
          denySet.add(t.toLowerCase().trim());
        }
      }

      return availableTools.filter(t => !denySet.has(t.toLowerCase().trim()));
    }

    // Fall through to parent restrictions
    if (parentRestrictions) {
      return this.applyToolRestrictions(availableTools, parentRestrictions);
    }

    return [...availableTools];
  }

  /**
   * Validates that a specific tool is allowed for an agent.
   */
  isToolAllowed(
    agentId: string,
    toolName: string,
    parentRestrictions?: ToolRestrictions
  ): boolean {
    const effective = this.resolveEffectiveTools(
      agentId,
      [toolName],
      parentRestrictions
    );
    return effective.length > 0;
  }

  // ===========================================================================
  // Permission Inheritance
  // ===========================================================================

  /**
   * Resolves effective permissions for an agent, inheriting from its parent
   * chain. Child permissions are always the intersection (most restrictive)
   * of the child's own declarations and the parent's grants.
   *
   * Mirrors OpenClaw's pattern where sub-agent sessions inherit
   * sandbox/tool constraints from their spawning agent.
   */
  resolvePermissions(
    agentId: string,
    parentPermissions?: AgentPermissions
  ): AgentPermissions {
    const definition = this.get(agentId);
    if (!definition) {
      return this.buildDefaultPermissions();
    }

    const meta = definition.metadata;
    const agentMaxTurns =
      meta.maxTurns ??
      (meta.type ? DEFAULT_MAX_TURNS_BY_TYPE[meta.type] : undefined) ??
      30;

    // Build agent's own declared permissions
    const selfPermissions: AgentPermissions = {
      permissionMode: meta.permissionMode ?? 'ask',
      toolRestrictions: meta.toolRestrictions ?? undefined,
      maxTurns: agentMaxTurns,
      maxTimeoutMs: 3_600_000,
      canSpawnSubagents: meta.canSpawnSubagents ?? true,
      memoryScopes: this.resolveMemoryScopes(meta),
      maxTier: (meta.tier ?? 3) as AgentTier,
    };

    if (!parentPermissions) {
      return selfPermissions;
    }

    // Intersect: child cannot exceed parent's grants
    return this.intersectPermissions(selfPermissions, parentPermissions);
  }

  /**
   * Builds the full permission chain from a child agent up through
   * its parent hierarchy. Returns an array of agent IDs from root to leaf.
   */
  resolvePermissionChain(agentId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = agentId;

    while (currentId) {
      const normalized = currentId.toLowerCase().trim();
      if (visited.has(normalized)) {
        break; // Circular reference protection
      }

      visited.add(normalized);
      chain.unshift(normalized);

      const definition = this.get(normalized);
      currentId = definition?.metadata.parentAgentId;
    }

    return chain;
  }

  /**
   * Resolves the effective max turns for an agent, considering its
   * definition, type defaults, and parent constraints.
   */
  resolveMaxTurns(agentId: string, parentMaxTurns?: number): number {
    const definition = this.get(agentId);
    if (!definition) {
      return parentMaxTurns ?? 30;
    }

    const meta = definition.metadata;
    const agentMaxTurns =
      meta.maxTurns ??
      (meta.type ? DEFAULT_MAX_TURNS_BY_TYPE[meta.type] : undefined) ??
      30;

    if (parentMaxTurns !== undefined) {
      return Math.min(agentMaxTurns, parentMaxTurns);
    }

    return agentMaxTurns;
  }

  // ===========================================================================
  // Memory Scope Resolution
  // ===========================================================================

  /**
   * Resolves the effective memory scope for an agent.
   * Falls back through: agent config -> parent scope -> 'local'.
   */
  resolveMemoryScope(agentId: string, parentScope?: MemoryScope): MemoryScope {
    const definition = this.get(agentId);
    if (!definition) {
      return parentScope ?? 'local';
    }

    return definition.metadata.memoryScope ?? parentScope ?? 'local';
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
  private scoreAgent(def: AgentDefinition, req: AgentRequirements): number {
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

  /**
   * Applies tool restrictions to a list of available tools.
   */
  private applyToolRestrictions(
    tools: readonly string[],
    restrictions: ToolRestrictions
  ): string[] {
    if (restrictions.allowed && restrictions.allowed.length > 0) {
      const allowSet = new Set(
        restrictions.allowed.map(t => t.toLowerCase().trim())
      );
      return tools.filter(t => allowSet.has(t.toLowerCase().trim()));
    }

    if (restrictions.denied && restrictions.denied.length > 0) {
      const denySet = new Set(
        restrictions.denied.map(t => t.toLowerCase().trim())
      );
      return tools.filter(t => !denySet.has(t.toLowerCase().trim()));
    }

    return [...tools];
  }

  /**
   * Builds default permissions for an unknown agent.
   */
  private buildDefaultPermissions(): AgentPermissions {
    return {
      permissionMode: 'ask',
      maxTurns: 30,
      maxTimeoutMs: 3_600_000,
      canSpawnSubagents: false,
      memoryScopes: ['local'],
      maxTier: 3 as AgentTier,
    };
  }

  /**
   * Intersects two permission sets, yielding the most restrictive combination.
   */
  private intersectPermissions(
    child: AgentPermissions,
    parent: AgentPermissions
  ): AgentPermissions {
    // Permission mode: most restrictive wins
    const permModeOrder: Record<string, number> = {
      deny: 0,
      ask: 1,
      acceptEdits: 2,
    };
    const childOrder = permModeOrder[child.permissionMode] ?? 1;
    const parentOrder = permModeOrder[parent.permissionMode] ?? 1;
    const effectivePermMode =
      childOrder <= parentOrder ? child.permissionMode : parent.permissionMode;

    // Tool restrictions: intersect allowed, union denied
    const effectiveToolRestrictions = this.intersectToolRestrictions(
      child.toolRestrictions,
      parent.toolRestrictions
    );

    // Memory scopes: intersection
    const parentScopeSet = new Set(parent.memoryScopes);
    const effectiveScopes = child.memoryScopes.filter(s =>
      parentScopeSet.has(s)
    );

    return {
      permissionMode: effectivePermMode,
      toolRestrictions: effectiveToolRestrictions,
      maxTurns: Math.min(child.maxTurns, parent.maxTurns),
      maxTimeoutMs: Math.min(child.maxTimeoutMs, parent.maxTimeoutMs),
      canSpawnSubagents: child.canSpawnSubagents && parent.canSpawnSubagents,
      memoryScopes: effectiveScopes.length > 0 ? effectiveScopes : ['local'],
      maxTier: Math.min(child.maxTier, parent.maxTier) as AgentTier,
    };
  }

  /**
   * Intersects two tool restriction sets.
   */
  private intersectToolRestrictions(
    child?: ToolRestrictions,
    parent?: ToolRestrictions
  ): ToolRestrictions | undefined {
    if (!child && !parent) {
      return undefined;
    }

    if (!child) {
      return parent;
    }

    if (!parent) {
      return child;
    }

    // If both have allowed lists, intersect them
    if (child.allowed && parent.allowed) {
      const parentSet = new Set(
        parent.allowed.map(t => t.toLowerCase().trim())
      );
      const intersected = child.allowed.filter(t =>
        parentSet.has(t.toLowerCase().trim())
      );
      return { allowed: intersected };
    }

    // If child has allowed but parent has denied, apply deny to allowed
    if (child.allowed && parent.denied) {
      const denySet = new Set(parent.denied.map(t => t.toLowerCase().trim()));
      const filtered = child.allowed.filter(
        t => !denySet.has(t.toLowerCase().trim())
      );
      return { allowed: filtered };
    }

    // If child has denied but parent has allowed, parent allowed wins
    if (child.denied && parent.allowed) {
      const denySet = new Set(child.denied.map(t => t.toLowerCase().trim()));
      const filtered = parent.allowed.filter(
        t => !denySet.has(t.toLowerCase().trim())
      );
      return { allowed: filtered };
    }

    // Both have denied lists: union them
    if (child.denied && parent.denied) {
      const combined = new Set([
        ...child.denied.map(t => t.toLowerCase().trim()),
        ...parent.denied.map(t => t.toLowerCase().trim()),
      ]);
      return { denied: Array.from(combined) };
    }

    return child ?? parent;
  }

  /**
   * Resolves allowed memory scopes from agent metadata.
   */
  private resolveMemoryScopes(meta: AgentMetadata): MemoryScope[] {
    const declared = meta.memoryScope;
    if (!declared) {
      return ['local'];
    }

    // A declared scope implies that scope and all more-restricted scopes
    const scopeHierarchy: MemoryScope[] = [
      'global',
      'user',
      'project',
      'local',
    ];
    const idx = scopeHierarchy.indexOf(declared);
    if (idx === -1) {
      return ['local'];
    }

    return scopeHierarchy.slice(idx);
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
