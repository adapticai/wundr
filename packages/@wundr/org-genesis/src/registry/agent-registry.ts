/**
 * @packageDocumentation
 * Agent Registry - Manages sub-agent definitions and configurations.
 *
 * This module provides a centralized registry for managing Tier 3 sub-agent
 * definitions within the org-genesis system. Sub-agents are specialized worker
 * agents that perform specific tasks under the direction of disciplines (Tier 2)
 * and VPs (Tier 1).
 *
 * @module @wundr/org-genesis/registry/agent-registry
 *
 * @example
 * ```typescript
 * import { createAgentRegistry, AgentRegistry } from '@wundr/org-genesis';
 *
 * // Create with file storage (persistent)
 * const registry = createAgentRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/agents',
 * });
 *
 * // Create with memory storage (for testing)
 * const testRegistry = createAgentRegistry({
 *   storageType: 'memory',
 * });
 *
 * // Register a new agent
 * await registry.register(myAgentDefinition);
 *
 * // Query agents
 * const universalAgents = await registry.listUniversal();
 * const engineeringAgents = await registry.listByDiscipline('engineering');
 * ```
 */

import { FileStorage } from './storage/file-storage.js';
import { MemoryStorage } from './storage/memory-storage.js';

import type { IRegistryStorage } from './storage/storage-interface.js';
import type { AgentDefinition, AgentScope } from '../types/index.js';

/**
 * Configuration options for creating an AgentRegistry instance.
 *
 * @description
 * Defines how the registry should persist its data. Choose between file-based
 * storage for persistent data across restarts, or memory storage for testing
 * and ephemeral use cases.
 *
 * @example
 * ```typescript
 * // File storage configuration (persistent)
 * const fileConfig: AgentRegistryConfig = {
 *   storageType: 'file',
 *   basePath: './.wundr/registry/agents',
 * };
 *
 * // Memory storage configuration (for testing)
 * const memoryConfig: AgentRegistryConfig = {
 *   storageType: 'memory',
 * };
 * ```
 */
export interface AgentRegistryConfig {
  /**
   * The type of storage backend to use.
   *
   * - `file`: Persists data to the filesystem as JSON files. Data survives
   *   process restarts. Suitable for production and development.
   * - `memory`: Stores data in-memory only. Data is lost on process exit.
   *   Suitable for testing and temporary operations.
   *
   * @default 'memory'
   */
  storageType: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   *
   * Only applicable when `storageType` is `'file'`. The registry will create
   * this directory if it doesn't exist and store agent data as JSON files.
   *
   * @default './.wundr/registry/agents'
   *
   * @example
   * ```typescript
   * // Relative path
   * basePath: './.wundr/agents'
   *
   * // Absolute path
   * basePath: '/var/lib/wundr/agents'
   * ```
   */
  basePath?: string;
}

/**
 * Default configuration values for the AgentRegistry.
 *
 * @internal
 */
const DEFAULT_CONFIG: AgentRegistryConfig = {
  storageType: 'memory',
  basePath: './.wundr/registry/agents',
};

/**
 * Centralized registry for managing Tier 3 sub-agent definitions.
 *
 * @description
 * The AgentRegistry provides a unified interface for storing, retrieving,
 * and querying sub-agent definitions within the org-genesis system. It supports
 * multiple storage backends (file, memory) and provides efficient lookup
 * operations by ID, slug, scope, and discipline association.
 *
 * Key features:
 * - CRUD operations for agent definitions
 * - Query by ID, slug, scope, or discipline
 * - Filter universal vs discipline-specific agents
 * - Pluggable storage backends
 * - Full type safety with AgentDefinition type
 *
 * @example
 * ```typescript
 * import { AgentRegistry, createAgentRegistry } from '@wundr/org-genesis';
 *
 * // Using the factory function (recommended)
 * const registry = createAgentRegistry({ storageType: 'memory' });
 *
 * // Register an agent
 * await registry.register({
 *   id: 'agent-code-reviewer-001',
 *   name: 'Code Reviewer',
 *   slug: 'code-reviewer',
 *   tier: 3,
 *   scope: 'discipline-specific',
 *   description: 'Reviews code for quality and best practices',
 *   charter: 'You are a meticulous code reviewer...',
 *   model: 'sonnet',
 *   tools: [{ name: 'read', type: 'builtin' }],
 *   capabilities: {
 *     canReadFiles: true,
 *     canWriteFiles: false,
 *     canExecuteCommands: false,
 *     canAccessNetwork: false,
 *     canSpawnSubAgents: false,
 *   },
 *   usedByDisciplines: ['engineering'],
 *   tags: ['code-quality', 'review'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Retrieve by ID
 * const agent = await registry.get('agent-code-reviewer-001');
 *
 * // List agents by scope
 * const universalAgents = await registry.listUniversal();
 * const disciplineAgents = await registry.listByScope('discipline-specific');
 *
 * // List agents by discipline
 * const engineeringAgents = await registry.listByDiscipline('engineering');
 * ```
 */
export class AgentRegistry {
  /**
   * The underlying storage backend for agent data.
   * @internal
   */
  private readonly storage: IRegistryStorage<AgentDefinition>;

  /**
   * Creates a new AgentRegistry instance.
   *
   * @param storage - The storage backend implementation to use
   *
   * @example
   * ```typescript
   * // Using MemoryStorage
   * const memoryStorage = new MemoryStorage<AgentDefinition>();
   * const registry = new AgentRegistry(memoryStorage);
   *
   * // Using FileStorage
   * const fileStorage = new FileStorage<AgentDefinition>('./.wundr/agents');
   * const registry = new AgentRegistry(fileStorage);
   * ```
   */
  constructor(storage: IRegistryStorage<AgentDefinition>) {
    this.storage = storage;
  }

  /**
   * Registers a new agent definition in the registry.
   *
   * @description
   * Adds an agent definition to the registry. If an agent with the same ID
   * already exists, it will be overwritten. The agent's `updatedAt`
   * timestamp will be set to the current time.
   *
   * @param agent - The agent definition to register
   * @throws {Error} If the agent definition fails validation
   *
   * @example
   * ```typescript
   * await registry.register({
   *   id: 'agent-researcher-001',
   *   name: 'Researcher',
   *   slug: 'researcher',
   *   tier: 3,
   *   scope: 'universal',
   *   description: 'Gathers information and performs analysis',
   *   charter: 'You are a thorough researcher...',
   *   model: 'sonnet',
   *   tools: [{ name: 'read', type: 'builtin' }, { name: 'grep', type: 'builtin' }],
   *   capabilities: {
   *     canReadFiles: true,
   *     canWriteFiles: false,
   *     canExecuteCommands: false,
   *     canAccessNetwork: true,
   *     canSpawnSubAgents: false,
   *   },
   *   usedByDisciplines: [],
   *   tags: ['research', 'analysis'],
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async register(agent: AgentDefinition): Promise<void> {
    // Ensure the updatedAt timestamp is current
    const agentToStore: AgentDefinition = {
      ...agent,
      updatedAt: new Date(),
    };

    await this.storage.set(agent.id, agentToStore);
  }

  /**
   * Retrieves an agent definition by its unique identifier.
   *
   * @param id - The unique identifier of the agent
   * @returns The agent definition if found, or null if not present
   *
   * @example
   * ```typescript
   * const agent = await registry.get('agent-code-reviewer-001');
   * if (agent) {
   *   console.log(`Found: ${agent.name}`);
   *   console.log(`Scope: ${agent.scope}`);
   *   console.log(`Model: ${agent.model}`);
   * } else {
   *   console.log('Agent not found');
   * }
   * ```
   */
  async get(id: string): Promise<AgentDefinition | null> {
    return this.storage.get(id);
  }

  /**
   * Retrieves an agent definition by its URL-safe slug.
   *
   * @description
   * Looks up an agent by its slug, which is typically a URL-safe
   * lowercase version of the agent name (e.g., 'code-reviewer').
   * This is useful for REST API endpoints and human-readable URLs.
   *
   * @param slug - The URL-safe slug of the agent
   * @returns The agent definition if found, or null if not present
   *
   * @example
   * ```typescript
   * // Retrieve by slug (e.g., from a URL parameter)
   * const agent = await registry.getBySlug('code-reviewer');
   * if (agent) {
   *   console.log(`Found agent: ${agent.name}`);
   * }
   * ```
   */
  async getBySlug(slug: string): Promise<AgentDefinition | null> {
    const agents = await this.storage.query((agent) => agent.slug === slug);
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * Returns all agent definitions in the registry.
   *
   * @description
   * Retrieves all registered agent definitions. For large registries,
   * consider using `listByScope` or `listByDiscipline` to filter results.
   *
   * @returns Array of all registered agent definitions
   *
   * @example
   * ```typescript
   * const allAgents = await registry.list();
   * console.log(`Total agents: ${allAgents.length}`);
   *
   * // Group by scope
   * const grouped = allAgents.reduce((acc, agent) => {
   *   acc[agent.scope] = acc[agent.scope] || [];
   *   acc[agent.scope].push(agent);
   *   return acc;
   * }, {} as Record<string, AgentDefinition[]>);
   * ```
   */
  async list(): Promise<AgentDefinition[]> {
    return this.storage.list();
  }

  /**
   * Lists all agent definitions with a specific scope.
   *
   * @description
   * Filters agents by their scope, returning only those that match.
   * Use this to separate universal agents from discipline-specific ones.
   *
   * @param scope - The agent scope to filter by ('universal' or 'discipline-specific')
   * @returns Array of agent definitions with the specified scope
   *
   * @example
   * ```typescript
   * // Get all universal agents (available to all disciplines)
   * const universalAgents = await registry.listByScope('universal');
   * console.log(`Universal agents: ${universalAgents.length}`);
   *
   * // Get all discipline-specific agents
   * const specificAgents = await registry.listByScope('discipline-specific');
   * console.log(`Discipline-specific agents: ${specificAgents.length}`);
   *
   * // Display each universal agent
   * for (const agent of universalAgents) {
   *   console.log(`- ${agent.name}: ${agent.description}`);
   * }
   * ```
   */
  async listByScope(scope: AgentScope): Promise<AgentDefinition[]> {
    return this.storage.query((agent) => agent.scope === scope);
  }

  /**
   * Lists all agent definitions associated with a specific discipline.
   *
   * @description
   * Filters agents by their discipline association. Returns agents that have
   * the specified discipline ID in their `usedByDisciplines` array.
   *
   * Note: This also includes universal agents that are implicitly available
   * to all disciplines if you want complete discipline coverage.
   *
   * @param disciplineId - The discipline ID or slug to filter by
   * @returns Array of agent definitions used by the specified discipline
   *
   * @example
   * ```typescript
   * // Get all agents used by the engineering discipline
   * const engineeringAgents = await registry.listByDiscipline('engineering');
   * console.log(`Engineering agents: ${engineeringAgents.length}`);
   *
   * // Get agents for a specific discipline slug
   * const qaAgents = await registry.listByDiscipline('quality-assurance');
   *
   * // Display each agent
   * for (const agent of engineeringAgents) {
   *   console.log(`- ${agent.name} (${agent.model})`);
   * }
   * ```
   */
  async listByDiscipline(disciplineId: string): Promise<AgentDefinition[]> {
    return this.storage.query((agent) =>
      agent.usedByDisciplines.includes(disciplineId),
    );
  }

  /**
   * Lists all universal agent definitions.
   *
   * @description
   * Convenience method that returns all agents with `scope: 'universal'`.
   * Universal agents are available to all disciplines and VPs within
   * the organization hierarchy.
   *
   * @returns Array of universal agent definitions
   *
   * @example
   * ```typescript
   * // Get all universal agents
   * const universalAgents = await registry.listUniversal();
   *
   * console.log('Universal agents available to all disciplines:');
   * for (const agent of universalAgents) {
   *   console.log(`- ${agent.name}: ${agent.description}`);
   * }
   * ```
   */
  async listUniversal(): Promise<AgentDefinition[]> {
    return this.listByScope('universal');
  }

  /**
   * Removes an agent definition from the registry.
   *
   * @description
   * Deletes an agent definition by its ID. This operation is irreversible.
   * Returns true if an agent was removed, false if no agent existed with
   * the given ID.
   *
   * Note: This does not automatically update discipline references or clean up
   * any session assignments. Ensure proper cleanup is performed by the caller.
   *
   * @param id - The unique identifier of the agent to remove
   * @returns True if the agent was removed, false if not found
   *
   * @example
   * ```typescript
   * const wasRemoved = await registry.remove('agent-code-reviewer-001');
   * if (wasRemoved) {
   *   console.log('Agent removed successfully');
   * } else {
   *   console.log('Agent not found');
   * }
   * ```
   */
  async remove(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Updates an existing agent definition with partial changes.
   *
   * @description
   * Merges the provided updates into an existing agent definition.
   * Only the fields specified in `updates` will be modified; all other
   * fields retain their original values. The `updatedAt` timestamp is
   * automatically set to the current time.
   *
   * Protected fields that cannot be changed via update:
   * - `id`: Use remove() and register() to change an agent's ID
   * - `createdAt`: Original creation time is preserved
   * - `tier`: Always remains 3 for sub-agents
   *
   * @param id - The unique identifier of the agent to update
   * @param updates - Partial agent definition with fields to update
   * @returns The updated agent definition
   * @throws {Error} If no agent exists with the given ID
   *
   * @example
   * ```typescript
   * // Update the description
   * const updated = await registry.update('agent-code-reviewer-001', {
   *   description: 'Enhanced code review with security focus',
   * });
   *
   * // Update tools
   * const withTools = await registry.update('agent-code-reviewer-001', {
   *   tools: [
   *     { name: 'read', type: 'builtin' },
   *     { name: 'grep', type: 'builtin' },
   *     { name: 'security-scanner', type: 'mcp' },
   *   ],
   * });
   *
   * // Update capabilities
   * const withCaps = await registry.update('agent-code-reviewer-001', {
   *   capabilities: {
   *     canReadFiles: true,
   *     canWriteFiles: true,
   *     canExecuteCommands: false,
   *     canAccessNetwork: true,
   *     canSpawnSubAgents: false,
   *   },
   * });
   *
   * // Update discipline associations
   * const withDisciplines = await registry.update('agent-code-reviewer-001', {
   *   usedByDisciplines: ['engineering', 'quality-assurance', 'security'],
   * });
   * ```
   */
  async update(
    id: string,
    updates: Partial<AgentDefinition>,
  ): Promise<AgentDefinition> {
    const existing = await this.storage.get(id);

    if (!existing) {
      throw new Error(`Agent with id '${id}' not found`);
    }

    const updated: AgentDefinition = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      tier: existing.tier, // Prevent tier changes (always 3)
      createdAt: existing.createdAt, // Preserve original creation time
      updatedAt: new Date(), // Always update timestamp
    };

    await this.storage.set(id, updated);
    return updated;
  }

  /**
   * Checks if an agent definition exists in the registry.
   *
   * @description
   * Efficiently checks whether an agent with the given ID is registered,
   * without retrieving the full agent data. Useful for validation and
   * duplicate detection.
   *
   * @param id - The unique identifier to check
   * @returns True if an agent exists with the given ID, false otherwise
   *
   * @example
   * ```typescript
   * // Check before registration to avoid duplicates
   * if (await registry.exists('agent-code-reviewer-001')) {
   *   console.log('Agent already registered');
   * } else {
   *   await registry.register(newAgent);
   * }
   *
   * // Validate agent ID reference
   * const validateReference = async (agentId: string) => {
   *   if (!await registry.exists(agentId)) {
   *     throw new Error(`Invalid agent reference: ${agentId}`);
   *   }
   * };
   * ```
   */
  async exists(id: string): Promise<boolean> {
    return this.storage.exists(id);
  }

  /**
   * Removes all agent definitions from the registry.
   *
   * @description
   * Clears all registered agents from the storage backend.
   * This is a destructive operation that cannot be undone.
   * Use with caution in production environments.
   *
   * Primarily useful for:
   * - Testing and test cleanup
   * - Development environment resets
   * - Migration scenarios
   *
   * @example
   * ```typescript
   * // Clear registry (typically in tests)
   * await registry.clear();
   *
   * // Verify registry is empty
   * const agents = await registry.list();
   * console.log(agents.length); // 0
   * ```
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
}

/**
 * Factory function to create a configured AgentRegistry instance.
 *
 * @description
 * Creates a new AgentRegistry with the specified storage configuration.
 * This is the recommended way to instantiate a registry, as it handles
 * storage backend setup automatically.
 *
 * If no configuration is provided, defaults to in-memory storage.
 *
 * @param config - Optional configuration options
 * @returns A new AgentRegistry instance
 *
 * @example
 * ```typescript
 * // Create with default configuration (memory storage)
 * const registry = createAgentRegistry();
 *
 * // Create with file storage (persistent)
 * const persistentRegistry = createAgentRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/registry/agents',
 * });
 *
 * // Create with memory storage (explicit)
 * const testRegistry = createAgentRegistry({
 *   storageType: 'memory',
 * });
 *
 * // Use the registry
 * await registry.register(myAgent);
 * const agents = await registry.list();
 * const universalAgents = await registry.listUniversal();
 * ```
 */
export function createAgentRegistry(
  config?: Partial<AgentRegistryConfig>,
): AgentRegistry {
  const resolvedConfig: AgentRegistryConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let storage: IRegistryStorage<AgentDefinition>;

  if (resolvedConfig.storageType === 'file') {
    storage = new FileStorage<AgentDefinition>({
      basePath: resolvedConfig.basePath ?? DEFAULT_CONFIG.basePath!,
      namespace: 'agents',
    });
  } else {
    storage = new MemoryStorage<AgentDefinition>();
  }

  return new AgentRegistry(storage);
}
