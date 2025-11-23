/**
 * @wundr.io/mcp-registry - Dynamic Server Discovery
 *
 * Provides capability-based server discovery, query building,
 * and intelligent server selection algorithms.
 *
 * @packageDocumentation
 */

import { CapabilityQuerySchema } from './types';

import type { MCPServerRegistry } from './registry';
import type {
  MCPServerRegistration,
  CapabilityQuery,
  DiscoveryResult,
  HealthLevel,
  CapabilityCategory,
} from './types';

// =============================================================================
// Discovery Error Types
// =============================================================================

/**
 * Error thrown when no servers match a discovery query
 */
export class NoServersFoundError extends Error {
  constructor(
    public readonly query: CapabilityQuery,
    message?: string
  ) {
    super(message ?? 'No servers found matching the query');
    this.name = 'NoServersFoundError';
  }
}

/**
 * Error thrown when a discovery query is invalid
 */
export class InvalidQueryError extends Error {
  constructor(
    public readonly validationErrors: readonly string[],
    message?: string
  ) {
    super(message ?? `Invalid query: ${validationErrors.join(', ')}`);
    this.name = 'InvalidQueryError';
  }
}

// =============================================================================
// Query Builder
// =============================================================================

/**
 * Fluent builder for creating capability queries
 *
 * @example
 * ```typescript
 * const query = new CapabilityQueryBuilder()
 *   .withCategory('tools')
 *   .withTools(['drift_detection', 'governance_report'])
 *   .withMinPriority(5)
 *   .withHealthStatus('healthy')
 *   .build();
 * ```
 */
export class CapabilityQueryBuilder {
  private category?: CapabilityCategory;
  private capabilities: string[] = [];
  private tools: string[] = [];
  private tags: string[] = [];
  private minPriority?: number;
  private healthStatus?: HealthLevel | readonly HealthLevel[];

  /**
   * Set the capability category filter
   *
   * @param category - Capability category
   * @returns This builder for chaining
   */
  withCategory(category: CapabilityCategory): this {
    this.category = category;
    return this;
  }

  /**
   * Add required capabilities
   *
   * @param capabilities - Capability names
   * @returns This builder for chaining
   */
  withCapabilities(capabilities: readonly string[]): this {
    this.capabilities.push(...capabilities);
    return this;
  }

  /**
   * Add a single required capability
   *
   * @param capability - Capability name
   * @returns This builder for chaining
   */
  withCapability(capability: string): this {
    this.capabilities.push(capability);
    return this;
  }

  /**
   * Add required tools
   *
   * @param tools - Tool names
   * @returns This builder for chaining
   */
  withTools(tools: readonly string[]): this {
    this.tools.push(...tools);
    return this;
  }

  /**
   * Add a single required tool
   *
   * @param tool - Tool name
   * @returns This builder for chaining
   */
  withTool(tool: string): this {
    this.tools.push(tool);
    return this;
  }

  /**
   * Add required tags
   *
   * @param tags - Tag names
   * @returns This builder for chaining
   */
  withTags(tags: readonly string[]): this {
    this.tags.push(...tags);
    return this;
  }

  /**
   * Add a single required tag
   *
   * @param tag - Tag name
   * @returns This builder for chaining
   */
  withTag(tag: string): this {
    this.tags.push(tag);
    return this;
  }

  /**
   * Set minimum priority filter
   *
   * @param priority - Minimum priority value
   * @returns This builder for chaining
   */
  withMinPriority(priority: number): this {
    this.minPriority = priority;
    return this;
  }

  /**
   * Set health status filter
   *
   * @param status - Required health status(es)
   * @returns This builder for chaining
   */
  withHealthStatus(status: HealthLevel | readonly HealthLevel[]): this {
    this.healthStatus = status;
    return this;
  }

  /**
   * Build the query
   *
   * @returns The constructed capability query
   * @throws {InvalidQueryError} If the query is invalid
   */
  build(): CapabilityQuery {
    const query: CapabilityQuery = {
      category: this.category,
      capabilities:
        this.capabilities.length > 0 ? this.capabilities : undefined,
      tools: this.tools.length > 0 ? this.tools : undefined,
      tags: this.tags.length > 0 ? this.tags : undefined,
      minPriority: this.minPriority,
      healthStatus: this.healthStatus,
    };

    // Validate the query
    const validation = CapabilityQuerySchema.safeParse(query);
    if (!validation.success) {
      const errors = validation.error.errors.map(
        e => `${e.path.join('.')}: ${e.message}`
      );
      throw new InvalidQueryError(errors);
    }

    return query;
  }

  /**
   * Reset the builder
   *
   * @returns This builder for chaining
   */
  reset(): this {
    this.category = undefined;
    this.capabilities = [];
    this.tools = [];
    this.tags = [];
    this.minPriority = undefined;
    this.healthStatus = undefined;
    return this;
  }
}

// =============================================================================
// Server Discovery Service
// =============================================================================

/**
 * Options for server discovery
 */
export interface DiscoveryOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Sort results by this field */
  sortBy?: 'priority' | 'name' | 'registeredAt' | 'latency';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Include servers with unknown health status */
  includeUnknownHealth?: boolean;
}

/**
 * Server Discovery Service
 *
 * Provides dynamic server discovery based on capabilities,
 * tools, tags, and health status.
 *
 * @example
 * ```typescript
 * const discovery = new ServerDiscoveryService(registry);
 *
 * // Find servers with specific tools
 * const result = await discovery.discover({
 *   tools: ['drift_detection'],
 *   healthStatus: 'healthy',
 * });
 *
 * // Use query builder
 * const query = discovery.queryBuilder()
 *   .withCategory('tools')
 *   .withMinPriority(5)
 *   .build();
 *
 * const servers = await discovery.discover(query);
 * ```
 */
export class ServerDiscoveryService {
  /**
   * Creates a new ServerDiscoveryService
   *
   * @param registry - The server registry to search
   */
  constructor(private readonly registry: MCPServerRegistry) {}

  /**
   * Create a new query builder
   *
   * @returns A new CapabilityQueryBuilder instance
   */
  queryBuilder(): CapabilityQueryBuilder {
    return new CapabilityQueryBuilder();
  }

  /**
   * Discover servers matching a query
   *
   * @param query - The capability query
   * @param options - Discovery options
   * @returns Discovery result with matching servers
   */
  async discover(
    query: CapabilityQuery,
    options: DiscoveryOptions = {}
  ): Promise<DiscoveryResult> {
    const allServers = this.registry.getAll();
    let matchingServers = this.filterServers(allServers, query, options);

    // Sort results
    matchingServers = this.sortServers(matchingServers, options);

    // Apply limit
    if (options.limit !== undefined && options.limit > 0) {
      matchingServers = matchingServers.slice(0, options.limit);
    }

    return {
      servers: matchingServers,
      query,
      timestamp: new Date(),
      totalSearched: allServers.length,
      matchCount: matchingServers.length,
    };
  }

  /**
   * Find the best server for a specific tool
   *
   * @param toolName - The tool name to find
   * @returns The best server for the tool, or undefined
   */
  async findBestServerForTool(
    toolName: string
  ): Promise<MCPServerRegistration | undefined> {
    const servers = this.registry.findByTool(toolName);

    if (servers.length === 0) {
      return undefined;
    }

    // Filter to healthy servers first
    let candidates = servers.filter(server => {
      const health = this.registry.getHealthStatus(server.id);
      return health?.status === 'healthy';
    });

    // Fall back to degraded servers if no healthy ones
    if (candidates.length === 0) {
      candidates = servers.filter(server => {
        const health = this.registry.getHealthStatus(server.id);
        return health?.status === 'degraded';
      });
    }

    // Fall back to all servers if none healthy/degraded
    if (candidates.length === 0) {
      candidates = [...servers];
    }

    // Sort by priority (descending) then by latency (ascending)
    return this.sortServers(candidates, {
      sortBy: 'priority',
      sortOrder: 'desc',
    })[0];
  }

  /**
   * Find all servers that can handle a set of tools
   *
   * @param toolNames - Tool names to find
   * @returns Servers that provide all specified tools
   */
  async findServersForTools(
    toolNames: readonly string[]
  ): Promise<readonly MCPServerRegistration[]> {
    if (toolNames.length === 0) {
      return [];
    }

    // Get servers for each tool
    const serverSets = toolNames.map(
      name => new Set(this.registry.findByTool(name).map(s => s.id))
    );

    // Find intersection of all sets
    const intersection = serverSets.reduce((acc, set) => {
      return new Set([...acc].filter(id => set.has(id)));
    });

    // Get server registrations
    return Array.from(intersection)
      .map(id => this.registry.get(id))
      .filter(
        (server): server is MCPServerRegistration => server !== undefined
      );
  }

  /**
   * Get server recommendations based on current usage patterns
   *
   * @param context - Usage context for recommendations
   * @returns Recommended servers sorted by relevance
   */
  async getRecommendations(
    context: RecommendationContext
  ): Promise<readonly ServerRecommendation[]> {
    const allServers = this.registry.getAll();
    const recommendations: ServerRecommendation[] = [];

    for (const server of allServers) {
      const score = this.calculateRecommendationScore(server, context);
      const health = this.registry.getHealthStatus(server.id);

      recommendations.push({
        server,
        score,
        reasons: this.getRecommendationReasons(server, context, score),
        healthStatus: health?.status ?? 'unknown',
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Filter servers based on query criteria
   */
  private filterServers(
    servers: readonly MCPServerRegistration[],
    query: CapabilityQuery,
    options: DiscoveryOptions
  ): MCPServerRegistration[] {
    return servers.filter(server => {
      // Filter by capability category
      if (query.category !== undefined) {
        const hasCategory = server.capabilities.some(
          cap => cap.category === query.category && cap.enabled
        );
        if (!hasCategory) {
          return false;
        }
      }

      // Filter by capability names
      if (query.capabilities !== undefined && query.capabilities.length > 0) {
        const serverCapNames = new Set(
          server.capabilities.filter(c => c.enabled).map(c => c.name)
        );
        const hasAllCaps = query.capabilities.every(cap =>
          serverCapNames.has(cap)
        );
        if (!hasAllCaps) {
          return false;
        }
      }

      // Filter by tools
      if (query.tools !== undefined && query.tools.length > 0) {
        const serverToolNames = new Set(server.tools.map(t => t.name));
        const hasAllTools = query.tools.every(tool =>
          serverToolNames.has(tool)
        );
        if (!hasAllTools) {
          return false;
        }
      }

      // Filter by tags
      if (query.tags !== undefined && query.tags.length > 0) {
        const serverTags = new Set(server.tags);
        const hasAllTags = query.tags.every(tag => serverTags.has(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // Filter by minimum priority
      if (query.minPriority !== undefined) {
        if ((server.priority ?? 0) < query.minPriority) {
          return false;
        }
      }

      // Filter by health status
      if (query.healthStatus !== undefined) {
        const health = this.registry.getHealthStatus(server.id);
        const serverHealth = health?.status ?? 'unknown';

        // Handle unknown health if option is set
        if (serverHealth === 'unknown' && !options.includeUnknownHealth) {
          return false;
        }

        const allowedStatuses = Array.isArray(query.healthStatus)
          ? query.healthStatus
          : [query.healthStatus];

        if (!allowedStatuses.includes(serverHealth)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort servers based on options
   */
  private sortServers(
    servers: readonly MCPServerRegistration[],
    options: DiscoveryOptions
  ): MCPServerRegistration[] {
    const sorted = [...servers];
    const sortBy = options.sortBy ?? 'priority';
    const sortOrder = options.sortOrder ?? 'desc';

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'priority':
          comparison = (a.priority ?? 0) - (b.priority ?? 0);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'registeredAt':
          comparison = a.registeredAt.getTime() - b.registeredAt.getTime();
          break;
        case 'latency': {
          const aHealth = this.registry.getHealthStatus(a.id);
          const bHealth = this.registry.getHealthStatus(b.id);
          const aLatency = aHealth?.latencyMs ?? Number.MAX_VALUE;
          const bLatency = bHealth?.latencyMs ?? Number.MAX_VALUE;
          comparison = aLatency - bLatency;
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Calculate recommendation score for a server
   */
  private calculateRecommendationScore(
    server: MCPServerRegistration,
    context: RecommendationContext
  ): number {
    let score = 0;

    // Base score from priority
    score += (server.priority ?? 0) * 10;

    // Health score
    const health = this.registry.getHealthStatus(server.id);
    switch (health?.status) {
      case 'healthy':
        score += 50;
        break;
      case 'degraded':
        score += 20;
        break;
      case 'unhealthy':
        score -= 50;
        break;
      default:
        score += 0;
    }

    // Latency score (lower is better)
    if (health?.avgLatencyMs !== undefined) {
      if (health.avgLatencyMs < 100) {
        score += 30;
      } else if (health.avgLatencyMs < 500) {
        score += 15;
      } else if (health.avgLatencyMs > 1000) {
        score -= 10;
      }
    }

    // Tool match score
    if (context.preferredTools !== undefined) {
      const serverToolNames = new Set(server.tools.map(t => t.name));
      const matchingTools = context.preferredTools.filter(t =>
        serverToolNames.has(t)
      );
      score += matchingTools.length * 15;
    }

    // Tag match score
    if (context.preferredTags !== undefined) {
      const serverTags = new Set(server.tags);
      const matchingTags = context.preferredTags.filter(t => serverTags.has(t));
      score += matchingTags.length * 10;
    }

    // Capability match score
    if (context.requiredCapabilities !== undefined) {
      const serverCapNames = new Set(
        server.capabilities.filter(c => c.enabled).map(c => c.name)
      );
      const matchingCaps = context.requiredCapabilities.filter(c =>
        serverCapNames.has(c)
      );
      score += matchingCaps.length * 20;
    }

    // Error rate penalty
    if (health?.errorRate !== undefined && health.errorRate > 0) {
      score -= health.errorRate * 100;
    }

    return Math.max(0, score);
  }

  /**
   * Get recommendation reasons for a server
   */
  private getRecommendationReasons(
    server: MCPServerRegistration,
    context: RecommendationContext,
    score: number
  ): readonly string[] {
    const reasons: string[] = [];
    const health = this.registry.getHealthStatus(server.id);

    if (health?.status === 'healthy') {
      reasons.push('Server is healthy');
    }

    if ((server.priority ?? 0) >= 5) {
      reasons.push('High priority server');
    }

    if (health?.avgLatencyMs !== undefined && health.avgLatencyMs < 100) {
      reasons.push('Low latency');
    }

    if (context.preferredTools !== undefined) {
      const serverToolNames = new Set(server.tools.map(t => t.name));
      const matchingTools = context.preferredTools.filter(t =>
        serverToolNames.has(t)
      );
      if (matchingTools.length > 0) {
        reasons.push(`Provides ${matchingTools.length} preferred tool(s)`);
      }
    }

    if (score >= 100) {
      reasons.push('Highly recommended');
    }

    return reasons;
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Context for generating server recommendations
 */
export interface RecommendationContext {
  /** Preferred tool names */
  preferredTools?: readonly string[];
  /** Preferred tags */
  preferredTags?: readonly string[];
  /** Required capability names */
  requiredCapabilities?: readonly string[];
  /** Usage history for pattern matching */
  usageHistory?: readonly UsageHistoryEntry[];
}

/**
 * Usage history entry for recommendation patterns
 */
export interface UsageHistoryEntry {
  /** Server ID */
  serverId: string;
  /** Tool name used */
  toolName: string;
  /** Timestamp of usage */
  timestamp: Date;
  /** Whether the call was successful */
  success: boolean;
  /** Latency in milliseconds */
  latencyMs?: number;
}

/**
 * Server recommendation with score and reasons
 */
export interface ServerRecommendation {
  /** The recommended server */
  server: MCPServerRegistration;
  /** Recommendation score (higher is better) */
  score: number;
  /** Reasons for the recommendation */
  reasons: readonly string[];
  /** Current health status */
  healthStatus: HealthLevel;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ServerDiscoveryService
 *
 * @param registry - The server registry to search
 * @returns New discovery service instance
 *
 * @example
 * ```typescript
 * const discovery = createServerDiscoveryService(registry);
 * const result = await discovery.discover({ tools: ['my-tool'] });
 * ```
 */
export function createServerDiscoveryService(
  registry: MCPServerRegistry
): ServerDiscoveryService {
  return new ServerDiscoveryService(registry);
}
