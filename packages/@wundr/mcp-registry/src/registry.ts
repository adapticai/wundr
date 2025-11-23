/**
 * @wundr.io/mcp-registry - MCP Server Registry
 *
 * Core registry class for managing MCP server registrations,
 * capability tracking, and server lifecycle management.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { ServerRegistrationOptionsSchema } from './types';

import type {
  MCPServerRegistration,
  ServerRegistrationOptions,
  MCPCapability,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  HealthStatus,
  HealthLevel,
  RegistryEvent,
  RegistryEventType,
  CapabilityCategory,
} from './types';

// =============================================================================
// Registry Error Types
// =============================================================================

/**
 * Error thrown when a server is not found in the registry
 */
export class ServerNotFoundError extends Error {
  constructor(
    public readonly serverId: string,
    message?: string
  ) {
    super(message ?? `Server not found: ${serverId}`);
    this.name = 'ServerNotFoundError';
  }
}

/**
 * Error thrown when a server is already registered
 */
export class ServerAlreadyExistsError extends Error {
  constructor(
    public readonly serverName: string,
    message?: string
  ) {
    super(message ?? `Server already registered: ${serverName}`);
    this.name = 'ServerAlreadyExistsError';
  }
}

/**
 * Error thrown when registration validation fails
 */
export class RegistrationValidationError extends Error {
  constructor(
    public readonly validationErrors: readonly string[],
    message?: string
  ) {
    super(
      message ??
        `Registration validation failed: ${validationErrors.join(', ')}`
    );
    this.name = 'RegistrationValidationError';
  }
}

// =============================================================================
// Registry Events Interface
// =============================================================================

/**
 * Event map for registry events
 */
export interface RegistryEvents {
  'server:registered': (event: RegistryEvent) => void;
  'server:unregistered': (event: RegistryEvent) => void;
  'server:updated': (event: RegistryEvent) => void;
  'server:connected': (event: RegistryEvent) => void;
  'server:disconnected': (event: RegistryEvent) => void;
  'server:health-changed': (event: RegistryEvent) => void;
  'tool:added': (event: RegistryEvent) => void;
  'tool:removed': (event: RegistryEvent) => void;
  'capability:changed': (event: RegistryEvent) => void;
}

// =============================================================================
// MCPServerRegistry Class
// =============================================================================

/**
 * MCP Server Registry
 *
 * Manages registration, discovery, and lifecycle of MCP servers.
 * Provides event-driven notifications for registry changes.
 *
 * @example
 * ```typescript
 * const registry = new MCPServerRegistry();
 *
 * // Register a server
 * const server = await registry.register({
 *   name: 'my-mcp-server',
 *   version: '1.0.0',
 *   transport: { type: 'stdio', command: 'node', args: ['server.js'] },
 * });
 *
 * // Listen for events
 * registry.on('server:registered', (event) => {
 *   console.log('Server registered:', event.serverId);
 * });
 *
 * // Find servers by capability
 * const servers = registry.findByCapability('tools');
 * ```
 */
export class MCPServerRegistry extends EventEmitter<RegistryEvents> {
  /** Registered servers by ID */
  private readonly servers: Map<string, MCPServerRegistration>;

  /** Server name to ID mapping for uniqueness */
  private readonly nameToId: Map<string, string>;

  /** Tool name to server IDs mapping */
  private readonly toolIndex: Map<string, Set<string>>;

  /** Tag to server IDs mapping */
  private readonly tagIndex: Map<string, Set<string>>;

  /** Health status by server ID */
  private readonly healthStatuses: Map<string, HealthStatus>;

  /**
   * Creates a new MCPServerRegistry instance
   */
  constructor() {
    super();
    this.servers = new Map();
    this.nameToId = new Map();
    this.toolIndex = new Map();
    this.tagIndex = new Map();
    this.healthStatuses = new Map();
  }

  // ===========================================================================
  // Server Registration Methods
  // ===========================================================================

  /**
   * Register a new MCP server
   *
   * @param options - Server registration options
   * @returns The registered server
   * @throws {ServerAlreadyExistsError} If server name is already registered
   * @throws {RegistrationValidationError} If options are invalid
   */
  async register(
    options: ServerRegistrationOptions
  ): Promise<MCPServerRegistration> {
    // Validate options
    const validation = ServerRegistrationOptionsSchema.safeParse(options);
    if (!validation.success) {
      const errors = validation.error.errors.map(
        e => `${e.path.join('.')}: ${e.message}`
      );
      throw new RegistrationValidationError(errors);
    }

    // Check for existing server with same name
    if (this.nameToId.has(options.name)) {
      throw new ServerAlreadyExistsError(options.name);
    }

    // Create registration
    const id = uuidv4();
    const now = new Date();
    const registration: MCPServerRegistration = {
      id,
      name: options.name,
      version: options.version,
      description: options.description,
      transport: options.transport,
      capabilities: [],
      tools: [],
      resources: [],
      prompts: [],
      priority: options.priority ?? 0,
      tags: options.tags ?? [],
      registeredAt: now,
      updatedAt: now,
      metadata: options.metadata,
    };

    // Store registration
    this.servers.set(id, registration);
    this.nameToId.set(options.name, id);

    // Index tags
    if (registration.tags) {
      for (const tag of registration.tags) {
        this.indexTag(tag, id);
      }
    }

    // Initialize health status
    this.healthStatuses.set(id, this.createInitialHealthStatus(id));

    // Emit event
    this.emitEvent('server:registered', id, { name: options.name });

    return registration;
  }

  /**
   * Unregister an MCP server
   *
   * @param serverId - Server ID to unregister
   * @throws {ServerNotFoundError} If server is not found
   */
  async unregister(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    // Remove from indexes
    this.nameToId.delete(server.name);

    // Remove tool indexes
    for (const tool of server.tools) {
      const serverIds = this.toolIndex.get(tool.name);
      if (serverIds) {
        serverIds.delete(serverId);
        if (serverIds.size === 0) {
          this.toolIndex.delete(tool.name);
        }
      }
    }

    // Remove tag indexes
    if (server.tags) {
      for (const tag of server.tags) {
        const serverIds = this.tagIndex.get(tag);
        if (serverIds) {
          serverIds.delete(serverId);
          if (serverIds.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }

    // Remove health status
    this.healthStatuses.delete(serverId);

    // Remove server
    this.servers.delete(serverId);

    // Emit event
    this.emitEvent('server:unregistered', serverId, { name: server.name });
  }

  /**
   * Get a server by ID
   *
   * @param serverId - Server ID
   * @returns The server registration or undefined
   */
  get(serverId: string): MCPServerRegistration | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get a server by name
   *
   * @param name - Server name
   * @returns The server registration or undefined
   */
  getByName(name: string): MCPServerRegistration | undefined {
    const id = this.nameToId.get(name);
    return id ? this.servers.get(id) : undefined;
  }

  /**
   * Check if a server is registered
   *
   * @param serverId - Server ID
   * @returns True if server is registered
   */
  has(serverId: string): boolean {
    return this.servers.has(serverId);
  }

  /**
   * Check if a server name is registered
   *
   * @param name - Server name
   * @returns True if server name is registered
   */
  hasName(name: string): boolean {
    return this.nameToId.has(name);
  }

  /**
   * Get all registered servers
   *
   * @returns Array of all registered servers
   */
  getAll(): readonly MCPServerRegistration[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get the number of registered servers
   *
   * @returns Server count
   */
  get size(): number {
    return this.servers.size;
  }

  // ===========================================================================
  // Capability Management Methods
  // ===========================================================================

  /**
   * Update server capabilities
   *
   * @param serverId - Server ID
   * @param capabilities - New capabilities
   * @throws {ServerNotFoundError} If server is not found
   */
  async updateCapabilities(
    serverId: string,
    capabilities: readonly MCPCapability[]
  ): Promise<MCPServerRegistration> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    const updated: MCPServerRegistration = {
      ...server,
      capabilities,
      updatedAt: new Date(),
    };

    this.servers.set(serverId, updated);
    this.emitEvent('capability:changed', serverId, { capabilities });

    return updated;
  }

  /**
   * Update server tools
   *
   * @param serverId - Server ID
   * @param tools - New tools
   * @throws {ServerNotFoundError} If server is not found
   */
  async updateTools(
    serverId: string,
    tools: readonly ToolDefinition[]
  ): Promise<MCPServerRegistration> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    // Remove old tool indexes
    for (const tool of server.tools) {
      const serverIds = this.toolIndex.get(tool.name);
      if (serverIds) {
        serverIds.delete(serverId);
        if (serverIds.size === 0) {
          this.toolIndex.delete(tool.name);
        }
      }
    }

    // Add new tool indexes
    for (const tool of tools) {
      this.indexTool(tool.name, serverId);
    }

    const updated: MCPServerRegistration = {
      ...server,
      tools,
      updatedAt: new Date(),
    };

    this.servers.set(serverId, updated);

    // Emit events for added/removed tools
    const oldToolNames = new Set(server.tools.map(t => t.name));
    const newToolNames = new Set(tools.map(t => t.name));

    for (const toolName of newToolNames) {
      if (!oldToolNames.has(toolName)) {
        this.emitEvent('tool:added', serverId, { toolName });
      }
    }

    for (const toolName of oldToolNames) {
      if (!newToolNames.has(toolName)) {
        this.emitEvent('tool:removed', serverId, { toolName });
      }
    }

    return updated;
  }

  /**
   * Update server resources
   *
   * @param serverId - Server ID
   * @param resources - New resources
   * @throws {ServerNotFoundError} If server is not found
   */
  async updateResources(
    serverId: string,
    resources: readonly ResourceDefinition[]
  ): Promise<MCPServerRegistration> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    const updated: MCPServerRegistration = {
      ...server,
      resources,
      updatedAt: new Date(),
    };

    this.servers.set(serverId, updated);
    this.emitEvent('server:updated', serverId, { resources });

    return updated;
  }

  /**
   * Update server prompts
   *
   * @param serverId - Server ID
   * @param prompts - New prompts
   * @throws {ServerNotFoundError} If server is not found
   */
  async updatePrompts(
    serverId: string,
    prompts: readonly PromptDefinition[]
  ): Promise<MCPServerRegistration> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    const updated: MCPServerRegistration = {
      ...server,
      prompts,
      updatedAt: new Date(),
    };

    this.servers.set(serverId, updated);
    this.emitEvent('server:updated', serverId, { prompts });

    return updated;
  }

  // ===========================================================================
  // Search and Discovery Methods
  // ===========================================================================

  /**
   * Find servers by capability category
   *
   * @param category - Capability category
   * @returns Matching servers
   */
  findByCapability(
    category: CapabilityCategory
  ): readonly MCPServerRegistration[] {
    return Array.from(this.servers.values()).filter(server =>
      server.capabilities.some(cap => cap.category === category && cap.enabled)
    );
  }

  /**
   * Find servers that provide a specific tool
   *
   * @param toolName - Tool name
   * @returns Matching servers
   */
  findByTool(toolName: string): readonly MCPServerRegistration[] {
    const serverIds = this.toolIndex.get(toolName);
    if (!serverIds || serverIds.size === 0) {
      return [];
    }

    return Array.from(serverIds)
      .map(id => this.servers.get(id))
      .filter(
        (server): server is MCPServerRegistration => server !== undefined
      );
  }

  /**
   * Find servers by tag
   *
   * @param tag - Tag to search for
   * @returns Matching servers
   */
  findByTag(tag: string): readonly MCPServerRegistration[] {
    const serverIds = this.tagIndex.get(tag);
    if (!serverIds || serverIds.size === 0) {
      return [];
    }

    return Array.from(serverIds)
      .map(id => this.servers.get(id))
      .filter(
        (server): server is MCPServerRegistration => server !== undefined
      );
  }

  /**
   * Find servers by health status
   *
   * @param status - Health status level
   * @returns Matching servers
   */
  findByHealthStatus(status: HealthLevel): readonly MCPServerRegistration[] {
    return Array.from(this.servers.values()).filter(server => {
      const health = this.healthStatuses.get(server.id);
      return health?.status === status;
    });
  }

  /**
   * Get all available tool names across all servers
   *
   * @returns Set of tool names
   */
  getAllToolNames(): ReadonlySet<string> {
    return new Set(this.toolIndex.keys());
  }

  /**
   * Get all available tags across all servers
   *
   * @returns Set of tags
   */
  getAllTags(): ReadonlySet<string> {
    return new Set(this.tagIndex.keys());
  }

  // ===========================================================================
  // Health Status Methods
  // ===========================================================================

  /**
   * Get health status for a server
   *
   * @param serverId - Server ID
   * @returns Health status or undefined
   */
  getHealthStatus(serverId: string): HealthStatus | undefined {
    return this.healthStatuses.get(serverId);
  }

  /**
   * Update health status for a server
   *
   * @param serverId - Server ID
   * @param status - New health status
   * @throws {ServerNotFoundError} If server is not found
   */
  updateHealthStatus(serverId: string, status: Partial<HealthStatus>): void {
    if (!this.servers.has(serverId)) {
      throw new ServerNotFoundError(serverId);
    }

    const current = this.healthStatuses.get(serverId);
    const previousStatus = current?.status;

    const updated: HealthStatus = {
      ...this.createInitialHealthStatus(serverId),
      ...current,
      ...status,
      serverId,
      updatedAt: new Date(),
    };

    this.healthStatuses.set(serverId, updated);

    // Emit event if status changed
    if (previousStatus !== updated.status) {
      this.emitEvent('server:health-changed', serverId, {
        previousStatus,
        newStatus: updated.status,
      });
    }
  }

  /**
   * Get all healthy servers
   *
   * @returns Array of healthy servers
   */
  getHealthyServers(): readonly MCPServerRegistration[] {
    return this.findByHealthStatus('healthy');
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Index a tool name to a server ID
   */
  private indexTool(toolName: string, serverId: string): void {
    let serverIds = this.toolIndex.get(toolName);
    if (!serverIds) {
      serverIds = new Set();
      this.toolIndex.set(toolName, serverIds);
    }
    serverIds.add(serverId);
  }

  /**
   * Index a tag to a server ID
   */
  private indexTag(tag: string, serverId: string): void {
    let serverIds = this.tagIndex.get(tag);
    if (!serverIds) {
      serverIds = new Set();
      this.tagIndex.set(tag, serverIds);
    }
    serverIds.add(serverId);
  }

  /**
   * Create initial health status for a server
   */
  private createInitialHealthStatus(serverId: string): HealthStatus {
    return {
      serverId,
      status: 'unknown',
      connected: false,
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      errorRate: 0,
      checks: [],
      updatedAt: new Date(),
    };
  }

  /**
   * Emit a registry event
   */
  private emitEvent(
    type: RegistryEventType,
    serverId: string,
    data?: Record<string, unknown>
  ): void {
    const event: RegistryEvent = {
      type,
      serverId,
      data,
      timestamp: new Date(),
    };

    this.emit(type, event);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Clear all registered servers
   */
  clear(): void {
    this.servers.clear();
    this.nameToId.clear();
    this.toolIndex.clear();
    this.tagIndex.clear();
    this.healthStatuses.clear();
  }

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStats(): RegistryStats {
    const servers = Array.from(this.servers.values());
    const healthStatuses = Array.from(this.healthStatuses.values());

    return {
      totalServers: this.servers.size,
      totalTools: this.toolIndex.size,
      totalTags: this.tagIndex.size,
      healthyServers: healthStatuses.filter(h => h.status === 'healthy').length,
      degradedServers: healthStatuses.filter(h => h.status === 'degraded')
        .length,
      unhealthyServers: healthStatuses.filter(h => h.status === 'unhealthy')
        .length,
      unknownServers: healthStatuses.filter(h => h.status === 'unknown').length,
      serversByPriority: this.groupByPriority(servers),
    };
  }

  /**
   * Group servers by priority
   */
  private groupByPriority(
    servers: readonly MCPServerRegistration[]
  ): Record<number, number> {
    const grouped: Record<number, number> = {};
    for (const server of servers) {
      const priority = server.priority ?? 0;
      grouped[priority] = (grouped[priority] ?? 0) + 1;
    }
    return grouped;
  }

  /**
   * Export registry data for persistence
   *
   * @returns Exportable registry data
   */
  export(): RegistryExport {
    return {
      servers: Array.from(this.servers.values()),
      healthStatuses: Array.from(this.healthStatuses.values()),
      exportedAt: new Date(),
    };
  }

  /**
   * Import registry data from persistence
   *
   * @param data - Registry data to import
   */
  async import(data: RegistryExport): Promise<void> {
    this.clear();

    for (const server of data.servers) {
      this.servers.set(server.id, server);
      this.nameToId.set(server.name, server.id);

      // Index tools
      for (const tool of server.tools) {
        this.indexTool(tool.name, server.id);
      }

      // Index tags
      if (server.tags) {
        for (const tag of server.tags) {
          this.indexTag(tag, server.id);
        }
      }
    }

    // Import health statuses
    for (const status of data.healthStatuses) {
      if (this.servers.has(status.serverId)) {
        this.healthStatuses.set(status.serverId, status);
      }
    }
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total number of registered servers */
  readonly totalServers: number;
  /** Total number of unique tools */
  readonly totalTools: number;
  /** Total number of unique tags */
  readonly totalTags: number;
  /** Number of healthy servers */
  readonly healthyServers: number;
  /** Number of degraded servers */
  readonly degradedServers: number;
  /** Number of unhealthy servers */
  readonly unhealthyServers: number;
  /** Number of servers with unknown health */
  readonly unknownServers: number;
  /** Server count by priority */
  readonly serversByPriority: Record<number, number>;
}

/**
 * Registry export format
 */
export interface RegistryExport {
  /** All registered servers */
  readonly servers: readonly MCPServerRegistration[];
  /** All health statuses */
  readonly healthStatuses: readonly HealthStatus[];
  /** Export timestamp */
  readonly exportedAt: Date;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new MCPServerRegistry instance
 *
 * @returns New registry instance
 *
 * @example
 * ```typescript
 * const registry = createMCPServerRegistry();
 * await registry.register({ ... });
 * ```
 */
export function createMCPServerRegistry(): MCPServerRegistry {
  return new MCPServerRegistry();
}
