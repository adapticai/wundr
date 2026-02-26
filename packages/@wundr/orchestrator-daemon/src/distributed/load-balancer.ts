/**
 * Load Balancer - Distributes sessions across nodes using multiple strategies
 */

import { EventEmitter } from 'eventemitter3';

import { Logger } from '../utils/logger';

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy =
  | 'round-robin'
  | 'least-connections'
  | 'weighted'
  | 'capability-aware';

/**
 * Node in the load balancer pool
 */
export interface LoadBalancerNode {
  id: string;
  endpoint: string;
  region: string;
  capabilities: string[];
  capacity: number; // 0-1, where 1 is full capacity
  weight?: number; // Optional weight for weighted strategy
  metadata?: Record<string, unknown>;
}

/**
 * Current load state of a node
 */
export interface NodeLoad {
  nodeId: string;
  activeConnections: number;
  currentLoad: number; // 0-1
  lastUpdated: Date;
  healthy: boolean;
}

/**
 * Health metrics for a node
 */
export interface NodeHealth {
  nodeId: string;
  healthy: boolean;
  responseTime: number; // ms
  errorRate: number; // 0-1
  uptime: number; // ms
  lastCheck: Date;
  issues?: string[];
}

/**
 * Selection options for node selection
 */
export interface NodeSelectionOptions {
  requiredCapabilities?: string[];
  preferredRegion?: string;
  loadThreshold?: number; // 0-1, default 0.8
  excludeNodes?: string[];
  sessionAffinity?: string; // prefer same node as related session
}

/**
 * Node score for weighted selection
 */
export interface NodeScore {
  nodeId: string;
  score: number;
  reasons: string[];
}

/**
 * Load balancer events
 */
interface LoadBalancerEvents {
  'node:added': (node: LoadBalancerNode) => void;
  'node:removed': (nodeId: string) => void;
  'node:load_updated': (load: NodeLoad) => void;
  'node:health_changed': (health: NodeHealth) => void;
  'node:overloaded': (nodeId: string, load: number) => void;
  'strategy:changed': (
    oldStrategy: LoadBalancingStrategy,
    newStrategy: LoadBalancingStrategy
  ) => void;
  'selection:failed': (options: NodeSelectionOptions, reason: string) => void;
}

/**
 * LoadBalancer - Manages node selection and load distribution
 */
export class LoadBalancer extends EventEmitter<LoadBalancerEvents> {
  private logger: Logger;
  private nodes: Map<string, LoadBalancerNode>;
  private nodeLoads: Map<string, NodeLoad>;
  private nodeHealth: Map<string, NodeHealth>;
  private strategy: LoadBalancingStrategy;
  private roundRobinIndex: number;
  private sessionAffinityMap: Map<string, string>; // sessionId -> nodeId

  constructor(strategy: LoadBalancingStrategy = 'round-robin') {
    super();
    this.logger = new Logger('LoadBalancer');
    this.nodes = new Map();
    this.nodeLoads = new Map();
    this.nodeHealth = new Map();
    this.strategy = strategy;
    this.roundRobinIndex = 0;
    this.sessionAffinityMap = new Map();

    this.logger.info(`LoadBalancer initialized with strategy: ${strategy}`);
  }

  /**
   * Add a node to the load balancer pool
   */
  addNode(node: LoadBalancerNode): void {
    this.logger.info(`Adding node to pool: ${node.id} (${node.endpoint})`);

    this.nodes.set(node.id, node);

    // Initialize load state
    this.nodeLoads.set(node.id, {
      nodeId: node.id,
      activeConnections: 0,
      currentLoad: 0,
      lastUpdated: new Date(),
      healthy: true,
    });

    // Initialize health state
    this.nodeHealth.set(node.id, {
      nodeId: node.id,
      healthy: true,
      responseTime: 0,
      errorRate: 0,
      uptime: 0,
      lastCheck: new Date(),
    });

    this.emit('node:added', node);
  }

  /**
   * Remove a node from the pool
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.logger.warn(`Cannot remove node: ${nodeId} not found`);
      return;
    }

    this.logger.info(`Removing node from pool: ${nodeId}`);

    this.nodes.delete(nodeId);
    this.nodeLoads.delete(nodeId);
    this.nodeHealth.delete(nodeId);

    // Clear session affinity mappings
    const affinityEntries = Array.from(this.sessionAffinityMap.entries());
    for (const [sessionId, mappedNodeId] of affinityEntries) {
      if (mappedNodeId === nodeId) {
        this.sessionAffinityMap.delete(sessionId);
      }
    }

    this.emit('node:removed', nodeId);
  }

  /**
   * Update node load
   */
  updateNodeLoad(nodeId: string, load: number): void {
    const nodeLoad = this.nodeLoads.get(nodeId);
    if (!nodeLoad) {
      this.logger.warn(`Cannot update load for unknown node: ${nodeId}`);
      return;
    }

    nodeLoad.currentLoad = Math.max(0, Math.min(1, load));
    nodeLoad.lastUpdated = new Date();

    this.emit('node:load_updated', nodeLoad);

    // Check for overload condition
    if (nodeLoad.currentLoad > 0.9) {
      this.logger.warn(
        `Node ${nodeId} is overloaded: ${(load * 100).toFixed(1)}%`
      );
      this.emit('node:overloaded', nodeId, nodeLoad.currentLoad);
    }
  }

  /**
   * Update active connections for a node
   */
  updateActiveConnections(nodeId: string, connections: number): void {
    const nodeLoad = this.nodeLoads.get(nodeId);
    if (!nodeLoad) {
      this.logger.warn(`Cannot update connections for unknown node: ${nodeId}`);
      return;
    }

    nodeLoad.activeConnections = Math.max(0, connections);
    nodeLoad.lastUpdated = new Date();

    this.emit('node:load_updated', nodeLoad);
  }

  /**
   * Get node health metrics
   */
  getNodeHealth(nodeId: string): NodeHealth | undefined {
    return this.nodeHealth.get(nodeId);
  }

  /**
   * Update node health
   */
  updateNodeHealth(nodeId: string, health: Partial<NodeHealth>): void {
    const existing = this.nodeHealth.get(nodeId);
    if (!existing) {
      this.logger.warn(`Cannot update health for unknown node: ${nodeId}`);
      return;
    }

    const updated: NodeHealth = {
      ...existing,
      ...health,
      nodeId,
      lastCheck: new Date(),
    };

    this.nodeHealth.set(nodeId, updated);

    // Update load healthy state
    const load = this.nodeLoads.get(nodeId);
    if (load) {
      load.healthy = updated.healthy;
    }

    this.emit('node:health_changed', updated);
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    if (this.strategy === strategy) {
      return;
    }

    const oldStrategy = this.strategy;
    this.logger.info(
      `Changing load balancing strategy: ${oldStrategy} -> ${strategy}`
    );

    this.strategy = strategy;
    this.roundRobinIndex = 0; // Reset round-robin counter

    this.emit('strategy:changed', oldStrategy, strategy);
  }

  /**
   * Select best node based on current strategy and options
   */
  selectNode(options: NodeSelectionOptions = {}): LoadBalancerNode | null {
    const {
      requiredCapabilities = [],
      preferredRegion,
      loadThreshold = 0.8,
      excludeNodes = [],
      sessionAffinity,
    } = options;

    // Check session affinity first
    if (sessionAffinity) {
      const affinityNodeId = this.sessionAffinityMap.get(sessionAffinity);
      if (affinityNodeId) {
        const node = this.nodes.get(affinityNodeId);
        const load = this.nodeLoads.get(affinityNodeId);
        if (
          node &&
          load?.healthy &&
          load.currentLoad < loadThreshold &&
          !excludeNodes.includes(affinityNodeId)
        ) {
          this.logger.debug(
            `Using session affinity for ${sessionAffinity} -> ${affinityNodeId}`
          );
          return node;
        }
      }
    }

    // Filter eligible nodes
    const eligibleNodes = this.getEligibleNodes(
      requiredCapabilities,
      loadThreshold,
      excludeNodes
    );

    if (eligibleNodes.length === 0) {
      this.logger.warn('No eligible nodes available for selection');
      this.emit(
        'selection:failed',
        options,
        'No eligible nodes meet the selection criteria'
      );
      return null;
    }

    // Apply region preference
    let candidateNodes = eligibleNodes;
    if (preferredRegion) {
      const regionalNodes = eligibleNodes.filter(
        n => n.region === preferredRegion
      );
      if (regionalNodes.length > 0) {
        candidateNodes = regionalNodes;
      }
    }

    // Select node based on strategy
    let selectedNode: LoadBalancerNode | null = null;

    switch (this.strategy) {
      case 'round-robin':
        selectedNode = this.selectRoundRobin(candidateNodes);
        break;
      case 'least-connections':
        selectedNode = this.selectLeastConnections(candidateNodes);
        break;
      case 'weighted':
        selectedNode = this.selectWeighted(candidateNodes);
        break;
      case 'capability-aware':
        selectedNode = this.selectCapabilityAware(
          candidateNodes,
          requiredCapabilities
        );
        break;
      default:
        this.logger.error(`Unknown strategy: ${this.strategy}`);
        selectedNode = this.selectRoundRobin(candidateNodes);
    }

    if (selectedNode && sessionAffinity) {
      this.sessionAffinityMap.set(sessionAffinity, selectedNode.id);
    }

    if (selectedNode) {
      this.logger.debug(
        `Selected node ${selectedNode.id} using ${this.strategy} strategy`
      );
    }

    return selectedNode;
  }

  /**
   * Get eligible nodes based on capabilities and load
   */
  private getEligibleNodes(
    requiredCapabilities: string[],
    loadThreshold: number,
    excludeNodes: string[]
  ): LoadBalancerNode[] {
    const eligible: LoadBalancerNode[] = [];
    const allNodes = Array.from(this.nodes.values());

    for (const node of allNodes) {
      // Check exclusion
      if (excludeNodes.includes(node.id)) {
        continue;
      }

      // Check health
      const load = this.nodeLoads.get(node.id);
      if (!load || !load.healthy) {
        continue;
      }

      // Check load threshold
      if (load.currentLoad >= loadThreshold) {
        continue;
      }

      // Check capabilities
      if (requiredCapabilities.length > 0) {
        const hasAllCapabilities = requiredCapabilities.every(cap =>
          node.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          continue;
        }
      }

      eligible.push(node);
    }

    return eligible;
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(nodes: LoadBalancerNode[]): LoadBalancerNode | null {
    if (nodes.length === 0) {
      return null;
    }

    const selected = nodes[this.roundRobinIndex % nodes.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % nodes.length;

    return selected;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(
    nodes: LoadBalancerNode[]
  ): LoadBalancerNode | null {
    if (nodes.length === 0) {
      return null;
    }

    let minConnections = Infinity;
    let selectedNode: LoadBalancerNode | null = null;

    for (const node of nodes) {
      const load = this.nodeLoads.get(node.id);
      if (!load) {
        continue;
      }

      if (load.activeConnections < minConnections) {
        minConnections = load.activeConnections;
        selectedNode = node;
      }
    }

    return selectedNode;
  }

  /**
   * Weighted selection based on capacity and current load
   */
  private selectWeighted(nodes: LoadBalancerNode[]): LoadBalancerNode | null {
    if (nodes.length === 0) {
      return null;
    }

    const scores: NodeScore[] = [];

    for (const node of nodes) {
      const load = this.nodeLoads.get(node.id);
      if (!load) {
        continue;
      }

      const reasons: string[] = [];
      let score = 0;

      // Factor 1: Available capacity (inverse of current load)
      const availableCapacity = 1 - load.currentLoad;
      score += availableCapacity * 40;
      reasons.push(`capacity: ${(availableCapacity * 100).toFixed(1)}%`);

      // Factor 2: Node weight (if specified)
      const weight = node.weight ?? 1;
      score += weight * 30;
      reasons.push(`weight: ${weight}`);

      // Factor 3: Health metrics
      const health = this.nodeHealth.get(node.id);
      if (health) {
        const healthScore = health.healthy ? 20 : 0;
        score += healthScore;
        reasons.push(`health: ${health.healthy ? 'good' : 'degraded'}`);

        // Penalize high error rates
        const errorPenalty = health.errorRate * 10;
        score -= errorPenalty;
        if (errorPenalty > 0) {
          reasons.push(`error_penalty: -${errorPenalty.toFixed(1)}`);
        }
      }

      // Factor 4: Connection count (prefer fewer connections)
      const connectionScore = Math.max(0, 10 - load.activeConnections);
      score += connectionScore;
      reasons.push(`connections: ${load.activeConnections}`);

      scores.push({ nodeId: node.id, score, reasons });
    }

    // Select node with highest score
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0) {
      const winner = scores[0];
      this.logger.debug(
        `Weighted selection: ${winner.nodeId} (score: ${winner.score.toFixed(1)}, ${winner.reasons.join(', ')})`
      );
      return this.nodes.get(winner.nodeId) || null;
    }

    return null;
  }

  /**
   * Capability-aware selection - scores nodes by capability match
   */
  private selectCapabilityAware(
    nodes: LoadBalancerNode[],
    requiredCapabilities: string[]
  ): LoadBalancerNode | null {
    if (nodes.length === 0) {
      return null;
    }

    const scores: NodeScore[] = [];

    for (const node of nodes) {
      const load = this.nodeLoads.get(node.id);
      if (!load) {
        continue;
      }

      const reasons: string[] = [];
      let score = 0;

      // Factor 1: Capability match (exact vs extras)
      const exactMatch = requiredCapabilities.every(cap =>
        node.capabilities.includes(cap)
      );
      if (exactMatch) {
        score += 50;
        reasons.push('exact_match: yes');
      }

      // Penalize nodes with many extra capabilities (more specialized = better)
      const extraCapabilities =
        node.capabilities.length - requiredCapabilities.length;
      const specialization = Math.max(0, 20 - extraCapabilities);
      score += specialization;
      reasons.push(`specialization: ${specialization}`);

      // Factor 2: Current load (prefer less loaded nodes)
      const loadScore = (1 - load.currentLoad) * 20;
      score += loadScore;
      reasons.push(`load: ${(load.currentLoad * 100).toFixed(1)}%`);

      // Factor 3: Node capacity
      score += node.capacity * 10;
      reasons.push(`capacity: ${node.capacity}`);

      scores.push({ nodeId: node.id, score, reasons });
    }

    // Select node with highest score
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0) {
      const winner = scores[0];
      this.logger.debug(
        `Capability-aware selection: ${winner.nodeId} (score: ${winner.score.toFixed(1)}, ${winner.reasons.join(', ')})`
      );
      return this.nodes.get(winner.nodeId) || null;
    }

    return null;
  }

  /**
   * Get all nodes
   */
  getAllNodes(): LoadBalancerNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): LoadBalancerNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get node load
   */
  getNodeLoad(nodeId: string): NodeLoad | undefined {
    return this.nodeLoads.get(nodeId);
  }

  /**
   * Get current strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this.strategy;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalNodes: number;
    healthyNodes: number;
    totalConnections: number;
    averageLoad: number;
    strategy: LoadBalancingStrategy;
  } {
    const nodes = Array.from(this.nodes.values());
    const loads = Array.from(this.nodeLoads.values());

    const healthyNodes = loads.filter(l => l.healthy).length;
    const totalConnections = loads.reduce(
      (sum, l) => sum + l.activeConnections,
      0
    );
    const averageLoad =
      loads.length > 0
        ? loads.reduce((sum, l) => sum + l.currentLoad, 0) / loads.length
        : 0;

    return {
      totalNodes: nodes.length,
      healthyNodes,
      totalConnections,
      averageLoad,
      strategy: this.strategy,
    };
  }

  /**
   * Clear session affinity for a session
   */
  clearSessionAffinity(sessionId: string): void {
    this.sessionAffinityMap.delete(sessionId);
  }

  /**
   * Get session affinity mapping
   */
  getSessionAffinity(sessionId: string): string | undefined {
    return this.sessionAffinityMap.get(sessionId);
  }

  /**
   * Reset round-robin counter
   */
  resetRoundRobin(): void {
    this.roundRobinIndex = 0;
  }
}
