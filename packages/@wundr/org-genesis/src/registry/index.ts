/**
 * @packageDocumentation
 * Global Agent Registry for centralized storage of Charters, Agents, Tools, and Hooks.
 *
 * The registry provides a unified interface for managing all organizational assets
 * that make up an AI-powered organizational structure. It serves as the central
 * repository for:
 *
 * - **VP and Session Manager Charters**: High-level organizational leadership definitions
 * - **Discipline Packs**: Domain-specific agent configurations and behaviors
 * - **Sub-agent Definitions**: Individual agent specifications and capabilities
 * - **MCP Tool Configurations**: Tool definitions and access policies
 * - **Hook Configurations**: Lifecycle hooks and event handlers
 *
 * @remarks
 * The registry supports multiple storage backends through the storage abstraction layer,
 * allowing for both persistent (file-based) and ephemeral (in-memory) storage strategies.
 *
 * Key features:
 * - Hierarchical charter management (VP -> Session Manager -> Sub-agents)
 * - Discipline pack versioning and composition
 * - Universal vs. discipline-specific agent registration
 * - Tool capability indexing and discovery
 * - Hook lifecycle management
 *
 * @example
 * ```typescript
 * import { createRegistryManager } from '@wundr/org-genesis/registry';
 *
 * // Initialize the registry with file-based storage
 * const registry = createRegistryManager({
 *   storageType: 'file',
 *   basePath: '~/.wundr/registry'
 * });
 *
 * // Register a discipline pack
 * await registry.disciplines.register(myDiscipline);
 *
 * // List all universal agents
 * const agents = await registry.agents.listUniversal();
 *
 * // Get VP charter
 * const vpCharter = await registry.charters.getVP('engineering-vp');
 *
 * // Register MCP tools
 * await registry.tools.register(myToolDefinitions);
 *
 * // Configure lifecycle hooks
 * await registry.hooks.register('onAgentSpawn', mySpawnHandler);
 * ```
 *
 * @example
 * ```typescript
 * // Using in-memory storage for testing
 * import { createRegistryManager, MemoryStorage } from '@wundr/org-genesis/registry';
 *
 * const testRegistry = createRegistryManager({
 *   storageType: 'memory',
 *   storage: new MemoryStorage()
 * });
 * ```
 *
 * @module registry
 */

// Re-export storage types with explicit names to avoid conflicts
export {
  IRegistryStorage as StorageInterface,
  StorageConfig,
  StorageError,
} from './storage/storage-interface.js';
export {
  FileStorage,
  type FileStorageConfig,
} from './storage/file-storage.js';
export { MemoryStorage } from './storage/memory-storage.js';

// Re-export charter-registry without conflicting storage implementations
export {
  CharterRegistry,
  type CharterRegistryConfig,
  createCharterRegistry,
  type IRegistryStorage as CharterStorageInterface,
} from './charter-registry.js';

// Re-export other registries
export {
  DisciplineRegistry,
  type DisciplineRegistryConfig,
  createDisciplineRegistry,
} from './discipline-registry.js';

export {
  AgentRegistry,
  type AgentRegistryConfig,
  createAgentRegistry,
} from './agent-registry.js';

export {
  ToolsRegistry,
  type ToolRegistryEntry,
  type ToolsRegistryConfig,
  createToolsRegistry,
} from './tools-registry.js';

export {
  HooksRegistry,
  type HookRegistryEntry,
  type HooksRegistryConfig,
  type HookEventType,
  createHooksRegistry,
} from './hooks-registry.js';

export {
  RegistryManager,
  type RegistryManagerConfig,
  type RegistryExport,
  type RegistryStats,
  createRegistryManager,
} from './registry-manager.js';
