/**
 * Distributed Session Manager - Manages sessions across multiple daemon nodes
 * Phase 5.2: Distributed session orchestration with load balancing and migration
 */

import { EventEmitter } from 'eventemitter3';
import { createClient } from 'redis';

import { Logger } from '../utils/logger';

import type { LoadBalancer, LoadBalancerNode, NodeSelectionOptions } from './load-balancer';
import type { Session, Task } from '../types';
import type {
  DaemonNode,
  SpawnSessionRequest,
  SessionMigrationResult,
  ClusterStatus,
  NodeHealth,
  SessionLocation,
  SessionMigrationPlan,
  NodeStatus,
  DistributedSessionConfig,
  SessionSpawnResult,
} from './types';
import type { RedisClientType } from 'redis';

/**
 * Distributed Session Manager Events
 */
interface DistributedSessionEvents {
  'session:spawned': (session: Session, nodeId: string) => void;
  'session:migrated': (result: SessionMigrationResult) => void;
  'session:terminated': (sessionId: string, nodeId: string) => void;
  'node:added': (nodeId: string) => void;
  'node:removed': (nodeId: string) => void;
  'node:health_changed': (nodeId: string, health: NodeHealth) => void;
  'rebalance:started': () => void;
  'rebalance:completed': (migrations: SessionMigrationResult[]) => void;
  'error': (error: Error, context?: string) => void;
}

/**
 * DistributedSessionManager - Orchestrates sessions across multiple daemon nodes
 */
export class DistributedSessionManager extends EventEmitter<DistributedSessionEvents> {
  private logger: Logger;
  private config: DistributedSessionConfig;
  private nodes: Map<string, DaemonNode>;
  private loadBalancer: LoadBalancer;
  private redis: RedisClientType;
  private sessionLocations: Map<string, SessionLocation>;
  private rebalanceInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRebalancing: boolean = false;
  private isConnected: boolean = false;

  constructor(
    nodes: DaemonNode[],
    loadBalancer: LoadBalancer,
    config?: Partial<DistributedSessionConfig>,
  ) {
    super();
    this.logger = new Logger('DistributedSessionManager');
    this.nodes = new Map(nodes.map((node) => [node.id, node]));
    this.loadBalancer = loadBalancer;
    this.sessionLocations = new Map();

    // Default configuration
    this.config = {
      clusterName: config?.clusterName || 'orchestrator-cluster',
      redisUrl: config?.redisUrl || 'redis://localhost:6379',
      heartbeatInterval: config?.heartbeatInterval || 30000,
      healthCheckTimeout: config?.healthCheckTimeout || 5000,
      migrationTimeout: config?.migrationTimeout || 60000,
      rebalanceInterval: config?.rebalanceInterval || 300000, // 5 minutes
      loadBalancingStrategy: config?.loadBalancingStrategy || 'least-loaded',
    };

    // Initialize Redis client
    this.redis = createClient({ url: this.config.redisUrl }) as RedisClientType;
    this.setupRedisListeners();

    // Register nodes with LoadBalancer
    this.registerNodesWithLoadBalancer(nodes);
  }

  /**
   * Register daemon nodes with the load balancer
   */
  private registerNodesWithLoadBalancer(nodes: DaemonNode[]): void {
    for (const node of nodes) {
      const lbNode: LoadBalancerNode = {
        id: node.id,
        endpoint: `${node.host}:${node.port}`,
        region: 'default',
        capabilities: [],
        capacity: 1.0,
      };
      this.loadBalancer.addNode(lbNode);
      this.loadBalancer.updateNodeLoad(node.id, node.load.activeSessions / 100);
    }
  }

  /**
   * Initialize the distributed session manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing DistributedSessionManager...');

    try {
      // Connect to Redis
      await this.redis.connect();
      this.isConnected = true;
      this.logger.info('Connected to Redis');

      // Load existing session mappings from Redis
      await this.loadSessionMappings();

      // Start periodic health checks
      this.startHealthChecks();

      // Start automatic rebalancing
      this.startAutoRebalance();

      this.logger.info(
        `DistributedSessionManager initialized with ${this.nodes.size} nodes`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize DistributedSessionManager', error);
      throw error;
    }
  }

  /**
   * Shutdown the distributed session manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down DistributedSessionManager...');

    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
      this.rebalanceInterval = null;
    }

    // Disconnect Redis
    if (this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
    }

    this.logger.info('DistributedSessionManager shut down');
  }

  /**
   * Spawn a new session on the optimal node
   */
  async spawnSession(request: SpawnSessionRequest): Promise<SessionSpawnResult> {
    this.logger.info(
      `Spawning ${request.sessionType} session for orchestrator ${request.orchestratorId}`,
    );

    try {
      // Convert request to include full task
      const task: Task = {
        id: this.generateTaskId(),
        ...request.task,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Select optimal node using load balancer
      const selectionOptions: NodeSelectionOptions = {
        requiredCapabilities: request.constraints?.requiresGpu ? ['gpu'] : [],
        preferredRegion: undefined,
        excludeNodes: [],
      };

      const selectedLBNode = this.loadBalancer.selectNode(selectionOptions);

      if (!selectedLBNode) {
        this.logger.warn('No available nodes to spawn session');
        return {
          success: false,
          error: 'No available nodes in cluster',
        };
      }

      // Get the corresponding DaemonNode
      const selectedNode = this.nodes.get(selectedLBNode.id);
      if (!selectedNode) {
        this.logger.error(`Selected node ${selectedLBNode.id} not found in daemon nodes`);
        return {
          success: false,
          error: 'Selected node not found',
        };
      }

      this.logger.info(`Selected node ${selectedNode.id} for session spawn`);

      // Create session (simplified - would normally call node API)
      const session: Session = {
        id: this.generateSessionId(),
        orchestratorId: request.orchestratorId,
        task,
        type: request.sessionType,
        status: 'initializing',
        startedAt: new Date(),
        memoryContext: {
          scratchpad: {},
          episodic: [],
          semantic: [],
        },
        metrics: {
          tokensUsed: 0,
          duration: 0,
          tasksCompleted: 0,
          errorsEncountered: 0,
          averageResponseTime: 0,
        },
      };

      // Store session location in Redis
      await this.storeSessionLocation(session.id, selectedNode.id);

      // Update local tracking
      selectedNode.sessions.add(session.id);
      selectedNode.load.activeSessions++;

      // Update load balancer
      this.loadBalancer.updateActiveConnections(selectedNode.id, selectedNode.sessions.size);
      this.loadBalancer.updateNodeLoad(selectedNode.id, selectedNode.load.activeSessions / 100);

      // Create session location record
      const location: SessionLocation = {
        sessionId: session.id,
        nodeId: selectedNode.id,
        assignedAt: new Date(),
        isPinned: false,
        migrationHistory: [],
      };
      this.sessionLocations.set(session.id, location);

      this.emit('session:spawned', session, selectedNode.id);

      return {
        success: true,
        session,
        nodeId: selectedNode.id,
      };
    } catch (error) {
      this.logger.error('Failed to spawn session', error);
      this.emit('error', error as Error, 'spawnSession');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Migrate a session from one node to another
   */
  async migrateSession(
    sessionId: string,
    toNodeId: string,
  ): Promise<SessionMigrationResult> {
    const startTime = Date.now();
    this.logger.info(`Migrating session ${sessionId} to node ${toNodeId}`);

    try {
      // Get current session location
      const location = await this.getSessionNode(sessionId);
      if (!location) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const fromNodeId = location;
      if (fromNodeId === toNodeId) {
        this.logger.warn(
          `Session ${sessionId} is already on node ${toNodeId}, skipping migration`,
        );
        return {
          success: true,
          sessionId,
          fromNode: fromNodeId,
          toNode: toNodeId,
          duration: 0,
        };
      }

      // Get nodes
      const fromNode = this.nodes.get(fromNodeId);
      const toNode = this.nodes.get(toNodeId);

      if (!fromNode || !toNode) {
        throw new Error(
          `Invalid nodes: from=${fromNodeId} (${!!fromNode}), to=${toNodeId} (${!!toNode})`,
        );
      }

      // In a real implementation, we would:
      // 1. Serialize session state from source node
      // 2. Transfer state to destination node
      // 3. Restore session on destination node
      // 4. Verify session integrity
      // 5. Terminate session on source node

      // For now, simulate migration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update node session tracking
      fromNode.sessions.delete(sessionId);
      fromNode.load.activeSessions--;
      toNode.sessions.add(sessionId);
      toNode.load.activeSessions++;

      // Update session location in Redis
      await this.storeSessionLocation(sessionId, toNodeId);

      // Update migration history
      const sessionLocation = this.sessionLocations.get(sessionId);
      if (sessionLocation) {
        sessionLocation.nodeId = toNodeId;
        if (!sessionLocation.migrationHistory) {
          sessionLocation.migrationHistory = [];
        }
        sessionLocation.migrationHistory.push({
          fromNode: fromNodeId,
          toNode: toNodeId,
          migratedAt: new Date(),
          reason: 'manual',
          duration: Date.now() - startTime,
        });
      }

      const result: SessionMigrationResult = {
        success: true,
        sessionId,
        fromNode: fromNodeId,
        toNode: toNodeId,
        duration: Date.now() - startTime,
        metadata: {
          memoryTransferred: 0,
          stateChecksum: 'checksum-placeholder',
          rollbackAvailable: true,
        },
      };

      this.emit('session:migrated', result);
      this.logger.info(
        `Successfully migrated session ${sessionId} from ${fromNodeId} to ${toNodeId} in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to migrate session ${sessionId}`, error);

      const result: SessionMigrationResult = {
        success: false,
        sessionId,
        fromNode: (await this.getSessionNode(sessionId)) || 'unknown',
        toNode: toNodeId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.emit('error', error as Error, 'migrateSession');
      return result;
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    this.logger.info(`Terminating session ${sessionId}`);

    try {
      const nodeId = await this.getSessionNode(sessionId);
      if (!nodeId) {
        this.logger.warn(`Session ${sessionId} not found, already terminated?`);
        return;
      }

      const node = this.nodes.get(nodeId);
      if (node) {
        node.sessions.delete(sessionId);
        node.load.activeSessions = Math.max(0, node.load.activeSessions - 1);
      }

      // Remove from Redis
      await this.removeSessionLocation(sessionId);

      // Remove from local tracking
      this.sessionLocations.delete(sessionId);

      this.emit('session:terminated', sessionId, nodeId);
      this.logger.info(`Session ${sessionId} terminated on node ${nodeId}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionId}`, error);
      this.emit('error', error as Error, 'terminateSession');
      throw error;
    }
  }

  /**
   * Get the node ID where a session is running
   */
  async getSessionNode(sessionId: string): Promise<string | null> {
    try {
      const nodeId = await this.redis.hGet('session:nodes', sessionId);
      return nodeId || null;
    } catch (error) {
      this.logger.error(`Failed to get session node for ${sessionId}`, error);
      return null;
    }
  }

  /**
   * Rebalance sessions across nodes
   */
  async rebalanceSessions(): Promise<SessionMigrationResult[]> {
    if (this.isRebalancing) {
      this.logger.warn('Rebalance already in progress, skipping');
      return [];
    }

    this.isRebalancing = true;
    this.emit('rebalance:started');
    this.logger.info('Starting session rebalancing...');

    const results: SessionMigrationResult[] = [];

    try {
      const nodes = Array.from(this.nodes.values());

      // Check if rebalancing is needed
      if (!this.shouldRebalance(nodes)) {
        this.logger.info('Cluster is balanced, no rebalancing needed');
        return results;
      }

      // Calculate migration plan
      const migrations = this.calculateMigrations(nodes);

      this.logger.info(`Executing ${migrations.length} session migrations`);

      // Execute migrations
      for (const plan of migrations) {
        try {
          const result = await this.migrateSession(plan.sessionId, plan.toNode);
          results.push(result);

          if (!result.success) {
            this.logger.warn(
              `Migration failed for session ${plan.sessionId}: ${result.error}`,
            );
          }
        } catch (error) {
          this.logger.error(`Error migrating session ${plan.sessionId}`, error);
        }
      }

      this.logger.info(
        `Rebalancing completed: ${results.filter((r) => r.success).length}/${results.length} successful`,
      );
      this.emit('rebalance:completed', results);

      return results;
    } catch (error) {
      this.logger.error('Rebalancing failed', error);
      this.emit('error', error as Error, 'rebalanceSessions');
      return results;
    } finally {
      this.isRebalancing = false;
    }
  }

  /**
   * Determine if rebalancing is needed
   */
  private shouldRebalance(nodes: DaemonNode[]): boolean {
    const healthyNodes = nodes.filter((n) => n.status === 'healthy');

    if (healthyNodes.length < 2) {
      return false;
    }

    // Calculate load distribution
    const loads = healthyNodes.map((n) => n.load.activeSessions);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);

    // Check for imbalance (30% threshold)
    const imbalance = (maxLoad - minLoad) / (avgLoad || 1);

    return imbalance > 0.3;
  }

  /**
   * Calculate migration plan
   */
  private calculateMigrations(nodes: DaemonNode[]): SessionMigrationPlan[] {
    const migrations: SessionMigrationPlan[] = [];
    const healthyNodes = nodes.filter((n) => n.status === 'healthy');

    if (healthyNodes.length < 2) {
      return migrations;
    }

    // Sort nodes by load
    const sortedNodes = [...healthyNodes].sort(
      (a, b) => b.load.activeSessions - a.load.activeSessions,
    );

    const avgLoad =
      sortedNodes.reduce((sum, n) => sum + n.load.activeSessions, 0) / sortedNodes.length;

    // Move sessions from overloaded to underloaded nodes
    for (const overloadedNode of sortedNodes) {
      if (overloadedNode.load.activeSessions <= avgLoad) {
        break;
      }

      const underloadedNodes = sortedNodes.filter((n) => n.load.activeSessions < avgLoad);
      if (underloadedNodes.length === 0) {
        break;
      }

      const sessionsToMigrate = Math.ceil(overloadedNode.load.activeSessions - avgLoad);
      const sessionIds = Array.from(overloadedNode.sessions).slice(0, sessionsToMigrate);

      let targetIndex = 0;
      for (const sessionId of sessionIds) {
        const targetNode = underloadedNodes[targetIndex % underloadedNodes.length];
        migrations.push({
          sessionId,
          fromNode: overloadedNode.id,
          toNode: targetNode.id,
          priority: 50,
          reason: 'rebalance',
        });
        targetIndex++;
      }
    }

    return migrations;
  }

  /**
   * Get cluster status
   */
  async getClusterStatus(): Promise<ClusterStatus> {
    const nodes = Array.from(this.nodes.values());

    const healthyNodes = nodes.filter((n) => n.status === 'healthy').length;
    const degradedNodes = nodes.filter((n) => n.status === 'degraded').length;
    const unreachableNodes = nodes.filter((n) => n.status === 'unreachable').length;
    const totalSessions = nodes.reduce((sum, n) => sum + n.sessions.size, 0);

    const nodeHealthList: NodeHealth[] = nodes.map((node) => ({
      nodeId: node.id,
      host: node.host,
      port: node.port,
      status: node.status,
      uptime: Date.now() - node.lastHeartbeat.getTime(),
      sessions: node.sessions.size,
      load: node.load,
      capacity: {
        maxSessions: 100, // This should come from node capabilities
        availableSessions: 100 - node.sessions.size,
        utilizationPercent: (node.sessions.size / 100) * 100,
      },
      lastHealthCheck: node.lastHeartbeat,
    }));

    return {
      totalNodes: nodes.length,
      healthyNodes,
      degradedNodes,
      unreachableNodes,
      totalSessions,
      nodes: nodeHealthList,
      loadBalancing: {
        strategy: this.config.loadBalancingStrategy,
        rebalanceInProgress: this.isRebalancing,
        lastRebalance: undefined, // Track this in future
      },
    };
  }

  /**
   * Add a node to the cluster
   */
  addNode(node: DaemonNode): void {
    this.logger.info(`Adding node ${node.id} to cluster`);
    this.nodes.set(node.id, node);

    // Register with load balancer
    const lbNode: LoadBalancerNode = {
      id: node.id,
      endpoint: `${node.host}:${node.port}`,
      region: 'default',
      capabilities: [],
      capacity: 1.0,
    };
    this.loadBalancer.addNode(lbNode);
    this.loadBalancer.updateNodeLoad(node.id, node.load.activeSessions / 100);

    this.emit('node:added', node.id);
  }

  /**
   * Remove a node from the cluster
   */
  async removeNode(nodeId: string): Promise<void> {
    this.logger.info(`Removing node ${nodeId} from cluster`);

    const node = this.nodes.get(nodeId);
    if (!node) {
      this.logger.warn(`Node ${nodeId} not found`);
      return;
    }

    // Migrate sessions away from this node
    if (node.sessions.size > 0) {
      this.logger.info(
        `Migrating ${node.sessions.size} sessions away from node ${nodeId}`,
      );

      const otherNodes = Array.from(this.nodes.values()).filter(
        (n) => n.id !== nodeId && n.status === 'healthy',
      );

      if (otherNodes.length === 0) {
        this.logger.error(
          'Cannot remove node: no other healthy nodes available for session migration',
        );
        throw new Error('No healthy nodes available for migration');
      }

      const sessionIds = Array.from(node.sessions);
      for (const sessionId of sessionIds) {
        // Select target node (round-robin for simplicity)
        const targetNode = otherNodes[sessionIds.indexOf(sessionId) % otherNodes.length];
        await this.migrateSession(sessionId, targetNode.id);
      }
    }

    this.nodes.delete(nodeId);
    this.loadBalancer.removeNode(nodeId);
    this.emit('node:removed', nodeId);
  }

  /**
   * Store session-to-node mapping in Redis
   */
  private async storeSessionLocation(sessionId: string, nodeId: string): Promise<void> {
    try {
      await this.redis.hSet('session:nodes', sessionId, nodeId);
      await this.redis.hSet(`session:${sessionId}:metadata`, {
        nodeId,
        assignedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to store session location in Redis', error);
      throw error;
    }
  }

  /**
   * Remove session location from Redis
   */
  private async removeSessionLocation(sessionId: string): Promise<void> {
    try {
      await this.redis.hDel('session:nodes', sessionId);
      await this.redis.del(`session:${sessionId}:metadata`);
    } catch (error) {
      this.logger.error('Failed to remove session location from Redis', error);
      throw error;
    }
  }

  /**
   * Load existing session mappings from Redis
   */
  private async loadSessionMappings(): Promise<void> {
    try {
      const mappings = await this.redis.hGetAll('session:nodes');

      for (const [sessionId, nodeId] of Object.entries(mappings)) {
        const node = this.nodes.get(nodeId);
        if (node) {
          node.sessions.add(sessionId);

          this.sessionLocations.set(sessionId, {
            sessionId,
            nodeId,
            assignedAt: new Date(),
            isPinned: false,
          });
        } else {
          this.logger.warn(
            `Session ${sessionId} mapped to unknown node ${nodeId}, removing`,
          );
          await this.removeSessionLocation(sessionId);
        }
      }

      this.logger.info(`Loaded ${Object.keys(mappings).length} session mappings from Redis`);
    } catch (error) {
      this.logger.error('Failed to load session mappings from Redis', error);
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const node of this.nodes.values()) {
        await this.checkNodeHealth(node);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Check health of a specific node
   */
  private async checkNodeHealth(node: DaemonNode): Promise<void> {
    const timeSinceLastHeartbeat = Date.now() - node.lastHeartbeat.getTime();

    let newStatus: NodeStatus = node.status;

    if (timeSinceLastHeartbeat > this.config.healthCheckTimeout * 3) {
      newStatus = 'unreachable';
    } else if (timeSinceLastHeartbeat > this.config.healthCheckTimeout * 2) {
      newStatus = 'degraded';
    } else if (node.load.errorRate > 0.1) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    if (newStatus !== node.status) {
      this.logger.info(`Node ${node.id} status changed: ${node.status} -> ${newStatus}`);
      node.status = newStatus;

      const health: NodeHealth = {
        nodeId: node.id,
        host: node.host,
        port: node.port,
        status: newStatus,
        uptime: Date.now() - node.lastHeartbeat.getTime(),
        sessions: node.sessions.size,
        load: node.load,
        capacity: {
          maxSessions: 100,
          availableSessions: 100 - node.sessions.size,
          utilizationPercent: (node.sessions.size / 100) * 100,
        },
        lastHealthCheck: new Date(),
      };

      this.emit('node:health_changed', node.id, health);
    }
  }

  /**
   * Start automatic rebalancing
   */
  private startAutoRebalance(): void {
    this.rebalanceInterval = setInterval(async () => {
      await this.rebalanceSessions();
    }, this.config.rebalanceInterval);
  }

  /**
   * Setup Redis event listeners
   */
  private setupRedisListeners(): void {
    this.redis.on('error', (error) => {
      this.logger.error('Redis error', error);
      this.emit('error', error, 'redis');
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('disconnect', () => {
      this.logger.warn('Redis disconnected');
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get all nodes
   */
  getNodes(): DaemonNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): DaemonNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all session locations
   */
  getSessionLocations(): SessionLocation[] {
    return Array.from(this.sessionLocations.values());
  }

  /**
   * Get session location by ID
   */
  getSessionLocation(sessionId: string): SessionLocation | undefined {
    return this.sessionLocations.get(sessionId);
  }
}
