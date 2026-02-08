/**
 * TaskDistributor - Consistent-hash task routing with capability awareness
 *
 * Routes incoming tasks to the optimal cluster node using a consistent
 * hash ring for deterministic placement, capability pre-filtering for
 * correctness, and load awareness for performance. Supports agent
 * migration between nodes when swarm topology requires colocation.
 *
 * Design:
 *   - Each physical node is represented by `virtualNodes` positions
 *     on the hash ring.
 *   - The routing key is derived from task properties.
 *   - Capability constraints are applied as a pre-filter before
 *     consulting the hash ring.
 *   - If the hash-selected node is overloaded, a fallback strategy
 *     is used (least-loaded or round-robin).
 */

import { EventEmitter } from 'eventemitter3';
import * as crypto from 'crypto';

import { Logger, LogLevel } from '../utils/logger';
import type { Task } from '../types';
import type { ClusterNode, NodeCapability } from './node-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HashFunction = 'sha256' | 'md5';
export type RoutingStrategy = 'hash-primary' | 'capability-first' | 'load-aware';
export type FallbackStrategy = 'least-loaded' | 'round-robin';

export interface TaskDistributorConfig {
  hashRing: {
    /** Virtual nodes per physical node (default: 150) */
    virtualNodes: number;
    /** Hash function for the ring (default: 'sha256') */
    hashFunction: HashFunction;
  };
  routing: {
    /** Primary routing strategy (default: 'hash-primary') */
    strategy: RoutingStrategy;
    /** Fallback when primary fails (default: 'least-loaded') */
    fallbackStrategy: FallbackStrategy;
    /** Max times a task can be redirected (default: 3) */
    maxRedirects: number;
    /** Load threshold above which a node is considered overloaded (0-1) */
    overloadThreshold: number;
  };
  agentMigration: {
    /** Whether agent migration is enabled */
    enabled: boolean;
    /** Load imbalance threshold to trigger migration (0-1) */
    migrationThreshold: number;
    /** Min time between migrations for same agent (ms) */
    cooldownPeriod: number;
  };
  /** Verbose logging */
  verbose: boolean;
}

export interface TaskRoutingResult {
  /** The selected node */
  nodeId: string;
  /** How the node was selected */
  strategy: RoutingStrategy | FallbackStrategy;
  /** The hash position on the ring (if hash-based) */
  hashPosition?: number;
  /** Reasons for the selection */
  reasons: string[];
  /** Number of redirects before this selection */
  redirectCount: number;
}

export interface AgentMigrationPlan {
  agentId: string;
  fromNodeId: string;
  toNodeId: string;
  reason: 'colocation' | 'rebalance' | 'failure';
  priority: number;
  estimatedSize: number;
}

export interface TaskDistributorEvents {
  'task:routed': (taskId: string, result: TaskRoutingResult) => void;
  'task:redirect': (taskId: string, fromNode: string, toNode: string, reason: string) => void;
  'ring:updated': (nodeCount: number, virtualNodeCount: number) => void;
  'migration:planned': (plan: AgentMigrationPlan) => void;
  'migration:completed': (plan: AgentMigrationPlan, durationMs: number) => void;
  'migration:failed': (plan: AgentMigrationPlan, error: string) => void;
  'error': (error: Error, context: string) => void;
}

/** Internal representation of a point on the hash ring */
interface RingEntry {
  position: number;
  nodeId: string;
  virtualIndex: number;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: TaskDistributorConfig = {
  hashRing: {
    virtualNodes: 150,
    hashFunction: 'sha256',
  },
  routing: {
    strategy: 'hash-primary',
    fallbackStrategy: 'least-loaded',
    maxRedirects: 3,
    overloadThreshold: 0.85,
  },
  agentMigration: {
    enabled: true,
    migrationThreshold: 0.3,
    cooldownPeriod: 60_000,
  },
  verbose: false,
};

// ---------------------------------------------------------------------------
// TaskDistributor
// ---------------------------------------------------------------------------

export class TaskDistributor extends EventEmitter<TaskDistributorEvents> {
  private logger: Logger;
  private config: TaskDistributorConfig;

  /** Sorted array of ring entries */
  private ring: RingEntry[] = [];

  /** Active cluster nodes, keyed by ID */
  private nodes: Map<string, ClusterNode> = new Map();

  /** Round-robin index for fallback */
  private roundRobinIndex = 0;

  /** Migration cooldown tracker: agentId -> last migration timestamp */
  private migrationCooldowns: Map<string, number> = new Map();

  constructor(config: Partial<TaskDistributorConfig> = {}) {
    super();
    this.config = {
      hashRing: { ...DEFAULT_CONFIG.hashRing, ...config.hashRing },
      routing: { ...DEFAULT_CONFIG.routing, ...config.routing },
      agentMigration: { ...DEFAULT_CONFIG.agentMigration, ...config.agentMigration },
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
    };
    this.logger = new Logger(
      'TaskDistributor',
      this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO,
    );
  }

  // -----------------------------------------------------------------------
  // Ring management
  // -----------------------------------------------------------------------

  /**
   * Rebuild the hash ring from the current set of active nodes.
   */
  rebuildRing(nodes: ClusterNode[]): void {
    this.nodes.clear();
    this.ring = [];

    for (const node of nodes) {
      if (node.status !== 'active' && node.status !== 'joining') {
        continue;
      }
      this.nodes.set(node.id, node);
      this.addNodeToRing(node.id);
    }

    this.ring.sort((a, b) => a.position - b.position);

    this.logger.info(
      `Hash ring rebuilt: ${this.nodes.size} nodes, ${this.ring.length} virtual nodes`,
    );
    this.emit('ring:updated', this.nodes.size, this.ring.length);
  }

  /**
   * Add a single node to the ring (incremental).
   */
  addNode(node: ClusterNode): void {
    this.nodes.set(node.id, node);
    this.addNodeToRing(node.id);
    this.ring.sort((a, b) => a.position - b.position);

    this.emit('ring:updated', this.nodes.size, this.ring.length);
  }

  /**
   * Remove a single node from the ring (incremental).
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.ring = this.ring.filter((e) => e.nodeId !== nodeId);

    this.emit('ring:updated', this.nodes.size, this.ring.length);
  }

  /**
   * Update a node's state (load, status).
   */
  updateNode(node: ClusterNode): void {
    this.nodes.set(node.id, node);
  }

  // -----------------------------------------------------------------------
  // Task routing
  // -----------------------------------------------------------------------

  /**
   * Route a task to the optimal node.
   *
   * @param task - The task to route
   * @param requiredCapabilities - Capabilities the target node must have
   * @param excludeNodes - Node IDs to exclude from selection
   */
  routeTask(
    task: Task,
    requiredCapabilities: NodeCapability[] = [],
    excludeNodes: string[] = [],
  ): TaskRoutingResult | null {
    if (this.nodes.size === 0) {
      this.logger.warn('No nodes available for task routing');
      return null;
    }

    // Filter nodes by capability
    const eligibleNodeIds = this.getEligibleNodes(requiredCapabilities, excludeNodes);

    if (eligibleNodeIds.length === 0) {
      this.logger.warn('No eligible nodes match required capabilities');
      return null;
    }

    let result: TaskRoutingResult | null = null;

    switch (this.config.routing.strategy) {
      case 'hash-primary':
        result = this.routeByHash(task, eligibleNodeIds);
        break;
      case 'capability-first':
        result = this.routeByCapability(task, eligibleNodeIds);
        break;
      case 'load-aware':
        result = this.routeByLoad(eligibleNodeIds);
        break;
    }

    // If the primary strategy selected an overloaded node, fall back
    if (result && this.isNodeOverloaded(result.nodeId)) {
      this.logger.debug(
        `Primary selection ${result.nodeId} is overloaded; using fallback`,
      );
      const fallback = this.applyFallback(eligibleNodeIds, [result.nodeId]);
      if (fallback) {
        this.emit('task:redirect', task.id, result.nodeId, fallback.nodeId, 'overloaded');
        result = fallback;
      }
    }

    if (result) {
      this.emit('task:routed', task.id, result);
    }

    return result;
  }

  /**
   * Get the node that owns a given hash key. Useful for session affinity.
   */
  getOwner(key: string): string | null {
    if (this.ring.length === 0) return null;

    const hash = this.hash(key);
    const entry = this.findRingEntry(hash);
    return entry?.nodeId ?? null;
  }

  // -----------------------------------------------------------------------
  // Agent migration
  // -----------------------------------------------------------------------

  /**
   * Plan agent migrations to colocate agents that are part of the same swarm.
   *
   * @param agentLocations - Map of agentId to current nodeId
   * @param swarmAgentIds - Agent IDs that should be colocated
   * @param preferredNodeId - Optional preferred target node
   */
  planColocationMigrations(
    agentLocations: Map<string, string>,
    swarmAgentIds: string[],
    preferredNodeId?: string,
  ): AgentMigrationPlan[] {
    if (!this.config.agentMigration.enabled) return [];
    if (swarmAgentIds.length <= 1) return [];

    const plans: AgentMigrationPlan[] = [];

    // Count agents per node
    const nodeAgentCounts = new Map<string, number>();
    for (const agentId of swarmAgentIds) {
      const nodeId = agentLocations.get(agentId);
      if (nodeId) {
        nodeAgentCounts.set(nodeId, (nodeAgentCounts.get(nodeId) ?? 0) + 1);
      }
    }

    // Find the best target node (most agents already there, or preferred)
    let targetNodeId: string | null = preferredNodeId ?? null;
    let maxAgents = 0;

    for (const [nodeId, count] of nodeAgentCounts.entries()) {
      const node = this.nodes.get(nodeId);
      if (!node || this.isNodeOverloaded(nodeId)) continue;

      if (count > maxAgents) {
        maxAgents = count;
        targetNodeId = nodeId;
      }
    }

    if (!targetNodeId) return [];

    // Plan migrations for agents not on the target node
    for (const agentId of swarmAgentIds) {
      const currentNodeId = agentLocations.get(agentId);
      if (!currentNodeId || currentNodeId === targetNodeId) continue;

      // Check cooldown
      const lastMigration = this.migrationCooldowns.get(agentId);
      if (
        lastMigration &&
        Date.now() - lastMigration < this.config.agentMigration.cooldownPeriod
      ) {
        continue;
      }

      const plan: AgentMigrationPlan = {
        agentId,
        fromNodeId: currentNodeId,
        toNodeId: targetNodeId,
        reason: 'colocation',
        priority: swarmAgentIds.length,
        estimatedSize: 0,
      };

      plans.push(plan);
      this.emit('migration:planned', plan);
    }

    return plans;
  }

  /**
   * Record that an agent migration has completed.
   */
  recordMigrationComplete(agentId: string): void {
    this.migrationCooldowns.set(agentId, Date.now());
  }

  /**
   * Plan rebalance migrations when load is imbalanced across nodes.
   */
  planRebalanceMigrations(
    sessionLocations: Map<string, string>,
  ): AgentMigrationPlan[] {
    if (!this.config.agentMigration.enabled) return [];

    const plans: AgentMigrationPlan[] = [];
    const activeNodes = Array.from(this.nodes.values()).filter(
      (n) => n.status === 'active',
    );

    if (activeNodes.length < 2) return [];

    // Calculate average load
    const loads = activeNodes.map((n) => n.load.activeSessions);
    const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);

    // Check if imbalance exceeds threshold
    const imbalance = avgLoad > 0 ? (maxLoad - minLoad) / avgLoad : 0;
    if (imbalance < this.config.agentMigration.migrationThreshold) {
      return [];
    }

    // Sort nodes by load (descending)
    const sortedNodes = [...activeNodes].sort(
      (a, b) => b.load.activeSessions - a.load.activeSessions,
    );

    // Move sessions from overloaded to underloaded
    for (const overloaded of sortedNodes) {
      if (overloaded.load.activeSessions <= avgLoad) break;

      const underloaded = sortedNodes.filter(
        (n) => n.load.activeSessions < avgLoad,
      );
      if (underloaded.length === 0) break;

      const sessionsToMove = Math.ceil(overloaded.load.activeSessions - avgLoad);

      // Find sessions on the overloaded node
      const sessionsOnNode: string[] = [];
      for (const [sessionId, nodeId] of sessionLocations.entries()) {
        if (nodeId === overloaded.id) {
          sessionsOnNode.push(sessionId);
        }
      }

      let targetIdx = 0;
      for (let i = 0; i < Math.min(sessionsToMove, sessionsOnNode.length); i++) {
        const target = underloaded[targetIdx % underloaded.length];
        plans.push({
          agentId: sessionsOnNode[i],
          fromNodeId: overloaded.id,
          toNodeId: target.id,
          reason: 'rebalance',
          priority: 50,
          estimatedSize: 0,
        });
        targetIdx++;
      }
    }

    return plans;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getNodeCount(): number {
    return this.nodes.size;
  }

  getRingSize(): number {
    return this.ring.length;
  }

  getNodes(): ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  // -----------------------------------------------------------------------
  // Hash ring internals
  // -----------------------------------------------------------------------

  private addNodeToRing(nodeId: string): void {
    for (let i = 0; i < this.config.hashRing.virtualNodes; i++) {
      const key = `${nodeId}:vn${i}`;
      const position = this.hash(key);
      this.ring.push({ position, nodeId, virtualIndex: i });
    }
  }

  private hash(key: string): number {
    const hashBuffer = crypto
      .createHash(this.config.hashRing.hashFunction)
      .update(key)
      .digest();

    // Use first 4 bytes as a 32-bit unsigned integer
    return hashBuffer.readUInt32BE(0);
  }

  /**
   * Find the first ring entry at or after the given hash position
   * (clockwise search on the ring).
   */
  private findRingEntry(hash: number): RingEntry | null {
    if (this.ring.length === 0) return null;

    // Binary search for the first entry >= hash
    let lo = 0;
    let hi = this.ring.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].position < hash) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Wrap around if we went past the end
    if (lo >= this.ring.length) {
      lo = 0;
    }

    return this.ring[lo];
  }

  /**
   * Find the ring entry for the given hash, restricted to eligible nodes.
   */
  private findEligibleRingEntry(
    hash: number,
    eligibleNodeIds: Set<string>,
  ): RingEntry | null {
    if (this.ring.length === 0) return null;

    // Binary search for starting position
    let lo = 0;
    let hi = this.ring.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].position < hash) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Walk clockwise to find first eligible node
    for (let i = 0; i < this.ring.length; i++) {
      const idx = (lo + i) % this.ring.length;
      const entry = this.ring[idx];
      if (eligibleNodeIds.has(entry.nodeId)) {
        return entry;
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Routing strategies
  // -----------------------------------------------------------------------

  private routeByHash(
    task: Task,
    eligibleNodeIds: string[],
  ): TaskRoutingResult | null {
    const routingKey = this.buildRoutingKey(task);
    const hash = this.hash(routingKey);
    const eligibleSet = new Set(eligibleNodeIds);

    const entry = this.findEligibleRingEntry(hash, eligibleSet);
    if (!entry) return null;

    return {
      nodeId: entry.nodeId,
      strategy: 'hash-primary',
      hashPosition: entry.position,
      reasons: [`hash(${routingKey}) = ${hash}`, `ring position: ${entry.position}`],
      redirectCount: 0,
    };
  }

  private routeByCapability(
    task: Task,
    eligibleNodeIds: string[],
  ): TaskRoutingResult | null {
    // Score each eligible node by capability breadth and load
    let bestNodeId: string | null = null;
    let bestScore = -1;
    const reasons: string[] = [];

    for (const nodeId of eligibleNodeIds) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      let score = node.capabilities.length * 10;
      score += (1 - this.getNodeLoadFraction(nodeId)) * 50;

      if (score > bestScore) {
        bestScore = score;
        bestNodeId = nodeId;
      }
    }

    if (!bestNodeId) return null;

    reasons.push(`best capability score: ${bestScore.toFixed(1)}`);

    return {
      nodeId: bestNodeId,
      strategy: 'capability-first',
      reasons,
      redirectCount: 0,
    };
  }

  private routeByLoad(
    eligibleNodeIds: string[],
  ): TaskRoutingResult | null {
    let leastLoaded: string | null = null;
    let lowestLoad = Infinity;

    for (const nodeId of eligibleNodeIds) {
      const load = this.getNodeLoadFraction(nodeId);
      if (load < lowestLoad) {
        lowestLoad = load;
        leastLoaded = nodeId;
      }
    }

    if (!leastLoaded) return null;

    return {
      nodeId: leastLoaded,
      strategy: 'load-aware',
      reasons: [`lowest load: ${(lowestLoad * 100).toFixed(1)}%`],
      redirectCount: 0,
    };
  }

  private applyFallback(
    eligibleNodeIds: string[],
    excludeNodes: string[],
  ): TaskRoutingResult | null {
    const candidates = eligibleNodeIds.filter(
      (id) => !excludeNodes.includes(id),
    );

    if (candidates.length === 0) return null;

    switch (this.config.routing.fallbackStrategy) {
      case 'least-loaded':
        return this.routeByLoad(candidates);

      case 'round-robin': {
        const idx = this.roundRobinIndex % candidates.length;
        this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length;
        return {
          nodeId: candidates[idx],
          strategy: 'round-robin',
          reasons: ['round-robin fallback'],
          redirectCount: 1,
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private buildRoutingKey(task: Task): string {
    return `${task.type}:${task.priority}:${task.id}`;
  }

  private getEligibleNodes(
    requiredCapabilities: NodeCapability[],
    excludeNodes: string[],
  ): string[] {
    const excludeSet = new Set(excludeNodes);

    return Array.from(this.nodes.entries())
      .filter(([id, node]) => {
        if (excludeSet.has(id)) return false;
        if (node.status !== 'active') return false;

        if (requiredCapabilities.length > 0) {
          return requiredCapabilities.every((cap) =>
            node.capabilities.includes(cap),
          );
        }

        return true;
      })
      .map(([id]) => id);
  }

  private getNodeLoadFraction(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    if (!node) return 1;

    // Composite load: weighted average of CPU, memory, and session ratio
    const sessionLoad = node.load.activeSessions / 100; // Assume 100 max
    return (node.load.cpuUsage / 100 + node.load.memoryUsage / 100 + sessionLoad) / 3;
  }

  private isNodeOverloaded(nodeId: string): boolean {
    return this.getNodeLoadFraction(nodeId) >= this.config.routing.overloadThreshold;
  }
}
