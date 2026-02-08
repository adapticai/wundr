/**
 * NodeRegistry - Cluster node lifecycle management
 *
 * Manages discovery, registration, and deregistration of daemon nodes
 * in the distributed cluster. Combines Redis-backed persistence with
 * in-memory gossip state for partition tolerance.
 */

import { EventEmitter } from 'eventemitter3';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { Logger, LogLevel } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeCapability =
  | 'sessions'
  | 'gpu'
  | 'high-memory'
  | 'gateway'
  | 'storage';

export type NodeStatus =
  | 'joining'
  | 'active'
  | 'draining'
  | 'leaving'
  | 'suspect'
  | 'dead';

export type NodeRole =
  | 'leader'
  | 'follower'
  | 'candidate'
  | 'observer';

export interface ClusterNode {
  id: string;
  host: string;
  port: number;
  federationPort: number;
  region: string;
  zone: string;
  capabilities: NodeCapability[];
  status: NodeStatus;
  role: NodeRole;
  generation: number;
  joinedAt: Date;
  lastSeen: Date;
  load: NodeLoadSnapshot;
  metadata: Record<string, unknown>;
}

export interface NodeLoadSnapshot {
  activeSessions: number;
  cpuUsage: number;
  memoryUsage: number;
  tokenRate: number;
  errorRate: number;
  timestamp: Date;
}

export interface NodeRegistryConfig {
  /** Unique identifier for this cluster */
  clusterName: string;
  /** This node's network host */
  host: string;
  /** This node's WebSocket port */
  port: number;
  /** Dedicated federation port for inter-node communication */
  federationPort: number;
  /** Deployment region */
  region: string;
  /** Availability zone within region */
  zone: string;
  /** Capabilities of this node */
  capabilities: NodeCapability[];
  /** Time after which a node is considered suspect (ms) */
  suspectTimeout: number;
  /** Time after which a suspect node is declared dead (ms) */
  deadTimeout: number;
  /** How often to check for stale nodes (ms) */
  reapInterval: number;
  /** Directory to persist node identity */
  dataDir: string;
  /** Whether this node starts as an observer (no sessions) */
  observer: boolean;
  /** Verbose logging */
  verbose: boolean;
}

export interface NodeRegistryEvents {
  'node:registered': (node: ClusterNode) => void;
  'node:updated': (node: ClusterNode) => void;
  'node:suspect': (nodeId: string, lastSeen: Date) => void;
  'node:dead': (nodeId: string, lastSeen: Date) => void;
  'node:recovered': (nodeId: string) => void;
  'node:draining': (nodeId: string) => void;
  'node:left': (nodeId: string) => void;
  'self:registered': (node: ClusterNode) => void;
  'topology:changed': (nodes: ClusterNode[]) => void;
}

/**
 * Interface for the storage backend. Allows swapping Redis for
 * in-memory storage in tests.
 */
export interface RegistryStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  sAdd(key: string, member: string): Promise<void>;
  sRem(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;
  isConnected(): boolean;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: NodeRegistryConfig = {
  clusterName: 'orchestrator-cluster',
  host: '127.0.0.1',
  port: 8787,
  federationPort: 8788,
  region: 'default',
  zone: 'default',
  capabilities: ['sessions', 'gateway'],
  suspectTimeout: 30_000,
  deadTimeout: 90_000,
  reapInterval: 10_000,
  dataDir: path.join(os.homedir(), '.wundr'),
  observer: false,
  verbose: false,
};

// ---------------------------------------------------------------------------
// In-memory store for testing / fallback
// ---------------------------------------------------------------------------

export class InMemoryRegistryStore implements RegistryStore {
  private data = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private connected = true;

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  async sAdd(key: string, member: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(member);
  }

  async sRem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
  }

  async sMembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }

  isConnected(): boolean {
    return this.connected;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }
}

// ---------------------------------------------------------------------------
// NodeRegistry
// ---------------------------------------------------------------------------

export class NodeRegistry extends EventEmitter<NodeRegistryEvents> {
  private logger: Logger;
  private config: NodeRegistryConfig;
  private store: RegistryStore;

  /** In-memory view of all known nodes */
  private nodes: Map<string, ClusterNode> = new Map();

  /** This node's identity */
  private selfId: string | null = null;
  private selfGeneration = 0;

  /** Periodic reap timer */
  private reapTimer: NodeJS.Timeout | null = null;

  /** Whether the registry has been initialized */
  private initialized = false;

  constructor(
    config: Partial<NodeRegistryConfig> = {},
    store?: RegistryStore,
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store ?? new InMemoryRegistryStore();
    this.logger = new Logger(
      'NodeRegistry',
      this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO,
    );
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the registry: load or create node identity, register self,
   * discover peers, and start the reap timer.
   */
  async initialize(): Promise<ClusterNode> {
    this.logger.info('Initializing NodeRegistry...');

    // Load or generate persistent node ID
    this.selfId = await this.loadOrCreateNodeId();
    this.selfGeneration = await this.incrementGeneration();

    // Build self descriptor
    const self = this.buildSelfNode();

    // Register with store
    await this.registerNode(self);

    // Discover existing peers
    await this.discoverPeers();

    // Start periodic reap
    this.startReapTimer();

    this.initialized = true;
    this.emit('self:registered', self);
    this.logger.info(`NodeRegistry initialized. Self: ${this.selfId} (gen ${this.selfGeneration})`);

    return self;
  }

  /**
   * Gracefully leave the cluster. Marks self as `leaving`, gives peers
   * time to migrate sessions, then deregisters.
   */
  async shutdown(): Promise<void> {
    this.logger.info('NodeRegistry shutting down...');

    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = null;
    }

    if (this.selfId) {
      const self = this.nodes.get(this.selfId);
      if (self) {
        self.status = 'leaving';
        await this.persistNode(self);
        this.emit('node:left', this.selfId);
      }

      await this.deregisterNode(this.selfId);
    }

    this.nodes.clear();
    this.initialized = false;
    this.logger.info('NodeRegistry shut down');
  }

  // -----------------------------------------------------------------------
  // Node management
  // -----------------------------------------------------------------------

  /**
   * Register a node in the cluster. Idempotent.
   */
  async registerNode(node: ClusterNode): Promise<void> {
    this.nodes.set(node.id, node);
    await this.persistNode(node);
    await this.store.sAdd(this.clusterMembersKey(), node.id);

    this.emit('node:registered', node);
    this.emit('topology:changed', this.getActiveNodes());
  }

  /**
   * Remove a node from the cluster.
   */
  async deregisterNode(nodeId: string): Promise<void> {
    this.nodes.delete(nodeId);
    await this.store.del(this.nodeKey(nodeId));
    await this.store.sRem(this.clusterMembersKey(), nodeId);

    this.emit('topology:changed', this.getActiveNodes());
  }

  /**
   * Update this node's health/load snapshot.
   */
  async updateSelfLoad(load: Partial<NodeLoadSnapshot>): Promise<void> {
    if (!this.selfId) return;

    const self = this.nodes.get(this.selfId);
    if (!self) return;

    self.load = {
      ...self.load,
      ...load,
      timestamp: new Date(),
    };
    self.lastSeen = new Date();

    await this.persistNode(self);
    this.emit('node:updated', self);
  }

  /**
   * Record that we have received a heartbeat or gossip from a peer.
   */
  async touchNode(nodeId: string, load?: Partial<NodeLoadSnapshot>): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const wasSuspect = node.status === 'suspect';

    node.lastSeen = new Date();
    if (load) {
      node.load = { ...node.load, ...load, timestamp: new Date() };
    }

    // Recover from suspect state
    if (wasSuspect) {
      node.status = 'active';
      await this.persistNode(node);
      this.emit('node:recovered', nodeId);
    }
  }

  /**
   * Initiate graceful drain for a node. The health monitor or leader
   * should call this before removing a node.
   */
  async drainNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = 'draining';
    await this.persistNode(node);
    this.emit('node:draining', nodeId);
    this.emit('topology:changed', this.getActiveNodes());
  }

  /**
   * Update a node's role (called by leader election).
   */
  async updateNodeRole(nodeId: string, role: NodeRole): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.role = role;
    await this.persistNode(node);
    this.emit('node:updated', node);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getSelfId(): string | null {
    return this.selfId;
  }

  getSelfNode(): ClusterNode | undefined {
    return this.selfId ? this.nodes.get(this.selfId) : undefined;
  }

  getNode(nodeId: string): ClusterNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  getActiveNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.status === 'active' || n.status === 'joining',
    );
  }

  getHealthyNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.status === 'active',
    );
  }

  getNodesByCapability(capability: NodeCapability): ClusterNode[] {
    return this.getActiveNodes().filter((n) =>
      n.capabilities.includes(capability),
    );
  }

  getNodesByRegion(region: string): ClusterNode[] {
    return this.getActiveNodes().filter((n) => n.region === region);
  }

  getLeader(): ClusterNode | undefined {
    return Array.from(this.nodes.values()).find((n) => n.role === 'leader');
  }

  getClusterSize(): number {
    return this.getActiveNodes().length;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // -----------------------------------------------------------------------
  // Peer Discovery
  // -----------------------------------------------------------------------

  /**
   * Discover peers from the store and populate the in-memory map.
   */
  async discoverPeers(): Promise<ClusterNode[]> {
    if (!this.store.isConnected()) {
      this.logger.warn('Store not connected; skipping peer discovery');
      return [];
    }

    const memberIds = await this.store.sMembers(this.clusterMembersKey());
    const discovered: ClusterNode[] = [];

    for (const memberId of memberIds) {
      if (memberId === this.selfId) continue;
      if (this.nodes.has(memberId)) continue;

      const raw = await this.store.get(this.nodeKey(memberId));
      if (!raw) continue;

      try {
        const node = this.deserializeNode(raw);
        this.nodes.set(node.id, node);
        discovered.push(node);
        this.logger.debug(`Discovered peer: ${node.id} (${node.host}:${node.port})`);
      } catch (error) {
        this.logger.warn(`Failed to deserialize node ${memberId}:`, error);
      }
    }

    if (discovered.length > 0) {
      this.emit('topology:changed', this.getActiveNodes());
    }

    return discovered;
  }

  /**
   * Merge gossip state from a peer. Returns true if any state changed.
   */
  mergeGossipState(peerNodes: ClusterNode[]): boolean {
    let changed = false;

    for (const peerNode of peerNodes) {
      if (peerNode.id === this.selfId) continue;

      const existing = this.nodes.get(peerNode.id);

      if (!existing) {
        // New node discovered via gossip
        this.nodes.set(peerNode.id, peerNode);
        this.emit('node:registered', peerNode);
        changed = true;
        continue;
      }

      // Merge: prefer higher generation, then more recent lastSeen
      if (
        peerNode.generation > existing.generation ||
        (peerNode.generation === existing.generation &&
          peerNode.lastSeen > existing.lastSeen)
      ) {
        this.nodes.set(peerNode.id, peerNode);
        this.emit('node:updated', peerNode);
        changed = true;
      }
    }

    if (changed) {
      this.emit('topology:changed', this.getActiveNodes());
    }

    return changed;
  }

  /**
   * Build a gossip digest: a compact representation of known nodes
   * for exchange during gossip rounds.
   */
  buildGossipDigest(): Array<{
    id: string;
    generation: number;
    status: NodeStatus;
    lastSeen: number;
  }> {
    return Array.from(this.nodes.values()).map((n) => ({
      id: n.id,
      generation: n.generation,
      status: n.status,
      lastSeen: n.lastSeen.getTime(),
    }));
  }

  // -----------------------------------------------------------------------
  // Reaping (stale node detection)
  // -----------------------------------------------------------------------

  private startReapTimer(): void {
    this.reapTimer = setInterval(() => {
      this.reapStaleNodes();
    }, this.config.reapInterval);
  }

  private reapStaleNodes(): void {
    const now = Date.now();

    for (const node of this.nodes.values()) {
      if (node.id === this.selfId) continue;

      const elapsed = now - node.lastSeen.getTime();

      if (elapsed > this.config.deadTimeout && node.status !== 'dead') {
        this.logger.warn(
          `Node ${node.id} declared dead (last seen ${elapsed}ms ago)`,
        );
        node.status = 'dead';
        this.emit('node:dead', node.id, node.lastSeen);
        this.emit('topology:changed', this.getActiveNodes());
      } else if (
        elapsed > this.config.suspectTimeout &&
        node.status === 'active'
      ) {
        this.logger.warn(
          `Node ${node.id} is suspect (last seen ${elapsed}ms ago)`,
        );
        node.status = 'suspect';
        this.emit('node:suspect', node.id, node.lastSeen);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Persistence helpers
  // -----------------------------------------------------------------------

  private async persistNode(node: ClusterNode): Promise<void> {
    if (!this.store.isConnected()) return;

    try {
      await this.store.set(this.nodeKey(node.id), this.serializeNode(node));
    } catch (error) {
      this.logger.warn(`Failed to persist node ${node.id}:`, error);
    }
  }

  private serializeNode(node: ClusterNode): string {
    return JSON.stringify({
      ...node,
      joinedAt: node.joinedAt.toISOString(),
      lastSeen: node.lastSeen.toISOString(),
      load: {
        ...node.load,
        timestamp: node.load.timestamp.toISOString(),
      },
    });
  }

  private deserializeNode(raw: string): ClusterNode {
    const data = JSON.parse(raw);
    return {
      ...data,
      joinedAt: new Date(data.joinedAt),
      lastSeen: new Date(data.lastSeen),
      load: {
        ...data.load,
        timestamp: new Date(data.load.timestamp),
      },
    };
  }

  // -----------------------------------------------------------------------
  // Identity management
  // -----------------------------------------------------------------------

  private async loadOrCreateNodeId(): Promise<string> {
    const idPath = path.join(this.config.dataDir, 'node-id');

    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
      const existing = await fs.readFile(idPath, 'utf-8');
      const id = existing.trim();
      if (id) {
        this.logger.info(`Loaded existing node ID: ${id}`);
        return id;
      }
    } catch {
      // File does not exist; generate new ID
    }

    const id = `node-${crypto.randomUUID()}`;
    await fs.writeFile(idPath, id, 'utf-8');
    this.logger.info(`Generated new node ID: ${id}`);
    return id;
  }

  private async incrementGeneration(): Promise<number> {
    const genPath = path.join(this.config.dataDir, 'node-generation');

    let generation = 0;
    try {
      const raw = await fs.readFile(genPath, 'utf-8');
      generation = parseInt(raw.trim(), 10) || 0;
    } catch {
      // First run
    }

    generation += 1;
    await fs.writeFile(genPath, String(generation), 'utf-8');
    return generation;
  }

  private buildSelfNode(): ClusterNode {
    const now = new Date();
    return {
      id: this.selfId!,
      host: this.config.host,
      port: this.config.port,
      federationPort: this.config.federationPort,
      region: this.config.region,
      zone: this.config.zone,
      capabilities: this.config.capabilities,
      status: 'active',
      role: this.config.observer ? 'observer' : 'follower',
      generation: this.selfGeneration,
      joinedAt: now,
      lastSeen: now,
      load: {
        activeSessions: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        tokenRate: 0,
        errorRate: 0,
        timestamp: now,
      },
      metadata: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        clusterName: this.config.clusterName,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Key helpers
  // -----------------------------------------------------------------------

  private nodeKey(nodeId: string): string {
    return `wundr:${this.config.clusterName}:node:${nodeId}`;
  }

  private clusterMembersKey(): string {
    return `wundr:${this.config.clusterName}:members`;
  }
}
