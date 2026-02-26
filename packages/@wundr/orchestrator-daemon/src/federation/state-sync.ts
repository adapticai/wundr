/**
 * StateSync - Gossip protocol and CRDT-based state synchronization
 *
 * Implements three-tier state synchronization across cluster nodes:
 *
 *   Tier 1: Redis (Strongly Consistent)
 *     - Session locations, node registry, leader election, task assignments
 *
 *   Tier 2: Gossip Protocol (Eventually Consistent)
 *     - Node health, load metrics, topology changes, leader heartbeats
 *     - Based on SWIM (Scalable Weakly-consistent Infection-style Membership)
 *
 *   Tier 3: CRDT Merge (Conflict-Free)
 *     - Collective memory patterns, performance metrics, agent capability scores
 *     - Uses G-Counter, LWW-Register, OR-Set, PN-Counter
 *
 * The gossip protocol spreads state changes through the cluster using
 * infection-style propagation. Each gossip round, a node selects a
 * configurable number of random peers and exchanges state digests.
 */

import { EventEmitter } from 'eventemitter3';

import { Logger, LogLevel } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateSyncConfig {
  gossip: {
    /** Gossip round interval in ms (default: 1000) */
    interval: number;
    /** Number of peers to gossip with per round (default: 3) */
    fanout: number;
    /** Max gossip message payload size in bytes (default: 65536) */
    maxPayloadSize: number;
    /** SWIM suspicion timeout multiplier (default: 3) */
    suspicionMultiplier: number;
  };
  crdt: {
    /** Background merge interval in ms (default: 5000) */
    mergeInterval: number;
    /** Tombstone GC interval in ms (default: 60000) */
    gcInterval: number;
    /** Max tombstone age before removal in ms (default: 300000) */
    maxTombstoneAge: number;
  };
  nodeId: string;
  clusterName: string;
  verbose: boolean;
}

/** A gossip message exchanged between nodes */
export interface GossipMessage {
  /** Sender node ID */
  senderId: string;
  /** Monotonic sequence number per sender */
  sequence: number;
  /** Timestamp of the message */
  timestamp: number;
  /** Message type */
  type: GossipMessageType;
  /** Payload */
  payload: GossipPayload;
}

export type GossipMessageType =
  | 'digest'
  | 'delta'
  | 'ack'
  | 'probe'
  | 'probe-ack'
  | 'probe-request';

export type GossipPayload =
  | GossipDigest
  | GossipDelta
  | GossipAck
  | GossipProbe
  | GossipProbeAck
  | GossipProbeRequest;

export interface GossipDigest {
  kind: 'digest';
  /** Per-node state versions: nodeId -> { generation, sequence } */
  versions: Record<string, { generation: number; sequence: number }>;
}

export interface GossipDelta {
  kind: 'delta';
  /** State entries that the receiver is missing */
  entries: GossipStateEntry[];
}

export interface GossipAck {
  kind: 'ack';
  /** Entries requested from the sender */
  requestedEntries: string[];
}

export interface GossipProbe {
  kind: 'probe';
  targetNodeId: string;
}

export interface GossipProbeAck {
  kind: 'probe-ack';
  targetNodeId: string;
  alive: boolean;
}

export interface GossipProbeRequest {
  kind: 'probe-request';
  targetNodeId: string;
  requesterNodeId: string;
}

/** A single state entry propagated through gossip */
export interface GossipStateEntry {
  key: string;
  value: unknown;
  nodeId: string;
  generation: number;
  sequence: number;
  timestamp: number;
  ttl?: number;
}

/** Transport interface for sending gossip messages between nodes */
export interface GossipTransport {
  /** Send a gossip message to a specific node */
  send(targetNodeId: string, message: GossipMessage): Promise<void>;
  /** Get list of known peer node IDs */
  getPeerNodeIds(): string[];
}

/** Interface for a CRDT value */
export interface CRDTValue<T = unknown> {
  type: CRDTType;
  value: T;
  clock: VectorClock;
  tombstone?: boolean;
  tombstoneAt?: number;
}

export type CRDTType = 'g-counter' | 'pn-counter' | 'lww-register' | 'or-set';

/** Vector clock for causal ordering */
export type VectorClock = Record<string, number>;

export interface StateSyncEvents {
  'gossip:sent': (targetNodeId: string, messageType: GossipMessageType) => void;
  'gossip:received': (
    fromNodeId: string,
    messageType: GossipMessageType
  ) => void;
  'gossip:state_updated': (key: string, value: unknown) => void;
  'crdt:merged': (key: string, type: CRDTType) => void;
  'crdt:gc': (removedCount: number) => void;
  'probe:suspect': (nodeId: string) => void;
  'probe:alive': (nodeId: string) => void;
  error: (error: Error, context: string) => void;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: StateSyncConfig = {
  gossip: {
    interval: 1_000,
    fanout: 3,
    maxPayloadSize: 65_536,
    suspicionMultiplier: 3,
  },
  crdt: {
    mergeInterval: 5_000,
    gcInterval: 60_000,
    maxTombstoneAge: 300_000,
  },
  nodeId: 'unknown',
  clusterName: 'orchestrator-cluster',
  verbose: false,
};

// ---------------------------------------------------------------------------
// CRDT Implementations
// ---------------------------------------------------------------------------

/**
 * G-Counter: Grow-only counter (non-negative increments only).
 * Each node maintains its own count; total is the sum of all nodes.
 */
export class GCounter {
  private counts: Record<string, number> = {};

  increment(nodeId: string, amount: number = 1): void {
    if (amount < 0) {
      throw new Error('G-Counter only supports non-negative increments');
    }
    this.counts[nodeId] = (this.counts[nodeId] ?? 0) + amount;
  }

  value(): number {
    return Object.values(this.counts).reduce((sum, c) => sum + c, 0);
  }

  merge(other: GCounter): void {
    for (const [nodeId, count] of Object.entries(other.counts)) {
      this.counts[nodeId] = Math.max(this.counts[nodeId] ?? 0, count);
    }
  }

  toJSON(): Record<string, number> {
    return { ...this.counts };
  }

  static fromJSON(data: Record<string, number>): GCounter {
    const counter = new GCounter();
    counter.counts = { ...data };
    return counter;
  }
}

/**
 * PN-Counter: Counter supporting both increments and decrements.
 * Implemented as two G-Counters: one for increments, one for decrements.
 */
export class PNCounter {
  private increments: GCounter;
  private decrements: GCounter;

  constructor() {
    this.increments = new GCounter();
    this.decrements = new GCounter();
  }

  increment(nodeId: string, amount: number = 1): void {
    this.increments.increment(nodeId, amount);
  }

  decrement(nodeId: string, amount: number = 1): void {
    this.decrements.increment(nodeId, amount);
  }

  value(): number {
    return this.increments.value() - this.decrements.value();
  }

  merge(other: PNCounter): void {
    this.increments.merge(other.increments);
    this.decrements.merge(other.decrements);
  }

  toJSON(): {
    increments: Record<string, number>;
    decrements: Record<string, number>;
  } {
    return {
      increments: this.increments.toJSON(),
      decrements: this.decrements.toJSON(),
    };
  }

  static fromJSON(data: {
    increments: Record<string, number>;
    decrements: Record<string, number>;
  }): PNCounter {
    const counter = new PNCounter();
    counter.increments = GCounter.fromJSON(data.increments);
    counter.decrements = GCounter.fromJSON(data.decrements);
    return counter;
  }
}

/**
 * LWW-Register: Last-Writer-Wins Register.
 * The value with the highest timestamp wins during merge.
 */
export class LWWRegister<T = unknown> {
  private _value: T;
  private _timestamp: number;
  private _nodeId: string;

  constructor(value: T, timestamp: number, nodeId: string) {
    this._value = value;
    this._timestamp = timestamp;
    this._nodeId = nodeId;
  }

  get value(): T {
    return this._value;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  set(value: T, timestamp: number, nodeId: string): void {
    if (
      timestamp > this._timestamp ||
      (timestamp === this._timestamp && nodeId > this._nodeId)
    ) {
      this._value = value;
      this._timestamp = timestamp;
      this._nodeId = nodeId;
    }
  }

  merge(other: LWWRegister<T>): void {
    this.set(other._value, other._timestamp, other._nodeId);
  }

  toJSON(): { value: T; timestamp: number; nodeId: string } {
    return {
      value: this._value,
      timestamp: this._timestamp,
      nodeId: this._nodeId,
    };
  }

  static fromJSON<T>(data: {
    value: T;
    timestamp: number;
    nodeId: string;
  }): LWWRegister<T> {
    return new LWWRegister(data.value, data.timestamp, data.nodeId);
  }
}

/**
 * OR-Set: Observed-Remove Set.
 * Supports add and remove operations without conflicts. Each element
 * is tagged with a unique identifier; remove only removes observed tags.
 */
export class ORSet<T = unknown> {
  /** Map of element -> Set of unique tags */
  private elements: Map<string, Set<string>> = new Map();
  /** Removed tags (tombstones) */
  private tombstones: Set<string> = new Set();
  /** Map tag -> element value for reconstruction */
  private tagValues: Map<string, T> = new Map();

  private tagCounter = 0;

  add(element: T, nodeId: string): string {
    const key = this.elementKey(element);
    const tag = `${nodeId}:${Date.now()}:${this.tagCounter++}`;

    if (!this.elements.has(key)) {
      this.elements.set(key, new Set());
    }
    this.elements.get(key)!.add(tag);
    this.tagValues.set(tag, element);

    return tag;
  }

  remove(element: T): void {
    const key = this.elementKey(element);
    const tags = this.elements.get(key);
    if (!tags) {
      return;
    }

    for (const tag of tags) {
      this.tombstones.add(tag);
      this.tagValues.delete(tag);
    }
    this.elements.delete(key);
  }

  has(element: T): boolean {
    const key = this.elementKey(element);
    const tags = this.elements.get(key);
    if (!tags) {
      return false;
    }

    for (const tag of tags) {
      if (!this.tombstones.has(tag)) {
        return true;
      }
    }
    return false;
  }

  values(): T[] {
    const result: T[] = [];
    for (const [, tags] of this.elements.entries()) {
      for (const tag of tags) {
        if (!this.tombstones.has(tag)) {
          const value = this.tagValues.get(tag);
          if (value !== undefined) {
            result.push(value);
            break; // One value per element key
          }
        }
      }
    }
    return result;
  }

  size(): number {
    return this.values().length;
  }

  merge(other: ORSet<T>): void {
    // Merge elements
    for (const [key, tags] of other.elements.entries()) {
      if (!this.elements.has(key)) {
        this.elements.set(key, new Set());
      }
      const localTags = this.elements.get(key)!;
      for (const tag of tags) {
        localTags.add(tag);
      }
    }

    // Merge tag values
    for (const [tag, value] of other.tagValues.entries()) {
      if (!this.tagValues.has(tag)) {
        this.tagValues.set(tag, value);
      }
    }

    // Merge tombstones
    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }

    // Clean up: remove tombstoned tags from elements
    for (const [key, tags] of this.elements.entries()) {
      for (const tag of tags) {
        if (this.tombstones.has(tag)) {
          tags.delete(tag);
          this.tagValues.delete(tag);
        }
      }
      if (tags.size === 0) {
        this.elements.delete(key);
      }
    }
  }

  private elementKey(element: T): string {
    return JSON.stringify(element);
  }

  toJSON(): {
    elements: Record<string, string[]>;
    tombstones: string[];
    tagValues: Record<string, T>;
  } {
    const elements: Record<string, string[]> = {};
    for (const [key, tags] of this.elements.entries()) {
      elements[key] = Array.from(tags);
    }
    const tagValues: Record<string, T> = {};
    for (const [tag, value] of this.tagValues.entries()) {
      tagValues[tag] = value;
    }
    return {
      elements,
      tombstones: Array.from(this.tombstones),
      tagValues,
    };
  }

  static fromJSON<T>(data: {
    elements: Record<string, string[]>;
    tombstones: string[];
    tagValues: Record<string, T>;
  }): ORSet<T> {
    const set = new ORSet<T>();
    for (const [key, tags] of Object.entries(data.elements)) {
      set.elements.set(key, new Set(tags));
    }
    set.tombstones = new Set(data.tombstones);
    for (const [tag, value] of Object.entries(data.tagValues)) {
      set.tagValues.set(tag, value as T);
    }
    return set;
  }
}

// ---------------------------------------------------------------------------
// Vector Clock utilities
// ---------------------------------------------------------------------------

export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [nodeId, timestamp] of Object.entries(b)) {
    result[nodeId] = Math.max(result[nodeId] ?? 0, timestamp);
  }
  return result;
}

export function incrementVectorClock(
  clock: VectorClock,
  nodeId: string
): VectorClock {
  return {
    ...clock,
    [nodeId]: (clock[nodeId] ?? 0) + 1,
  };
}

export function compareVectorClocks(
  a: VectorClock,
  b: VectorClock
): 'before' | 'after' | 'concurrent' | 'equal' {
  let aBeforeB = false;
  let bBeforeA = false;

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const aVal = a[key] ?? 0;
    const bVal = b[key] ?? 0;

    if (aVal < bVal) {
      aBeforeB = true;
    }
    if (aVal > bVal) {
      bBeforeA = true;
    }
  }

  if (aBeforeB && !bBeforeA) {
    return 'before';
  }
  if (bBeforeA && !aBeforeB) {
    return 'after';
  }
  if (!aBeforeB && !bBeforeA) {
    return 'equal';
  }
  return 'concurrent';
}

// ---------------------------------------------------------------------------
// StateSync
// ---------------------------------------------------------------------------

export class StateSync extends EventEmitter<StateSyncEvents> {
  private logger: Logger;
  private config: StateSyncConfig;
  private transport: GossipTransport | null = null;

  /** Local gossip state: key -> GossipStateEntry */
  private localState: Map<string, GossipStateEntry> = new Map();

  /** CRDT store: key -> CRDTValue */
  private crdtStore: Map<string, CRDTValue> = new Map();

  /** Per-node state versions for efficient digest exchange */
  private stateVersions: Map<string, { generation: number; sequence: number }> =
    new Map();

  /** Monotonic sequence counter for this node's state entries */
  private localSequence = 0;

  /** Gossip round timer */
  private gossipTimer: NodeJS.Timeout | null = null;
  /** CRDT merge timer */
  private mergeTimer: NodeJS.Timeout | null = null;
  /** Tombstone GC timer */
  private gcTimer: NodeJS.Timeout | null = null;

  private running = false;

  constructor(config: Partial<StateSyncConfig> = {}) {
    super();
    this.config = {
      gossip: { ...DEFAULT_CONFIG.gossip, ...config.gossip },
      crdt: { ...DEFAULT_CONFIG.crdt, ...config.crdt },
      nodeId: config.nodeId ?? DEFAULT_CONFIG.nodeId,
      clusterName: config.clusterName ?? DEFAULT_CONFIG.clusterName,
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
    };
    this.logger = new Logger(
      'StateSync',
      this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO
    );
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the gossip protocol and CRDT merge timers.
   *
   * @param transport - Transport layer for sending gossip messages
   */
  start(transport: GossipTransport): void {
    if (this.running) {
      return;
    }

    this.transport = transport;
    this.running = true;

    this.gossipTimer = setInterval(() => {
      this.gossipRound().catch(error => {
        this.emit('error', error as Error, 'gossipRound');
      });
    }, this.config.gossip.interval);

    this.gcTimer = setInterval(() => {
      this.garbageCollectTombstones();
    }, this.config.crdt.gcInterval);

    this.logger.info('StateSync started');
  }

  /**
   * Stop all timers and clear state.
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;

    if (this.gossipTimer) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = null;
    }
    if (this.mergeTimer) {
      clearInterval(this.mergeTimer);
      this.mergeTimer = null;
    }
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    this.transport = null;
    this.logger.info('StateSync stopped');
  }

  // -----------------------------------------------------------------------
  // Gossip state operations
  // -----------------------------------------------------------------------

  /**
   * Set a value in the gossip state. This will be propagated to peers.
   */
  set(key: string, value: unknown, ttl?: number): void {
    this.localSequence++;

    const entry: GossipStateEntry = {
      key,
      value,
      nodeId: this.config.nodeId,
      generation: 1,
      sequence: this.localSequence,
      timestamp: Date.now(),
      ttl,
    };

    this.localState.set(key, entry);
    this.updateVersion(this.config.nodeId, entry.generation, entry.sequence);
    this.emit('gossip:state_updated', key, value);
  }

  /**
   * Get a value from the gossip state.
   */
  get(key: string): unknown | undefined {
    const entry = this.localState.get(key);
    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.localState.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Delete a key from the gossip state.
   */
  delete(key: string): void {
    this.localState.delete(key);
  }

  /**
   * Get all keys in the gossip state.
   */
  keys(): string[] {
    return Array.from(this.localState.keys());
  }

  // -----------------------------------------------------------------------
  // CRDT operations
  // -----------------------------------------------------------------------

  /**
   * Get or create a G-Counter.
   */
  getGCounter(key: string): GCounter {
    const existing = this.crdtStore.get(key);
    if (existing && existing.type === 'g-counter') {
      return existing.value as GCounter;
    }

    const counter = new GCounter();
    this.crdtStore.set(key, {
      type: 'g-counter',
      value: counter,
      clock: {},
    });
    return counter;
  }

  /**
   * Get or create a PN-Counter.
   */
  getPNCounter(key: string): PNCounter {
    const existing = this.crdtStore.get(key);
    if (existing && existing.type === 'pn-counter') {
      return existing.value as PNCounter;
    }

    const counter = new PNCounter();
    this.crdtStore.set(key, {
      type: 'pn-counter',
      value: counter,
      clock: {},
    });
    return counter;
  }

  /**
   * Get or create an LWW-Register.
   */
  getLWWRegister<T>(key: string, defaultValue: T): LWWRegister<T> {
    const existing = this.crdtStore.get(key);
    if (existing && existing.type === 'lww-register') {
      return existing.value as LWWRegister<T>;
    }

    const register = new LWWRegister<T>(defaultValue, 0, this.config.nodeId);
    this.crdtStore.set(key, {
      type: 'lww-register',
      value: register,
      clock: {},
    });
    return register;
  }

  /**
   * Get or create an OR-Set.
   */
  getORSet<T>(key: string): ORSet<T> {
    const existing = this.crdtStore.get(key);
    if (existing && existing.type === 'or-set') {
      return existing.value as ORSet<T>;
    }

    const set = new ORSet<T>();
    this.crdtStore.set(key, {
      type: 'or-set',
      value: set,
      clock: {},
    });
    return set;
  }

  // -----------------------------------------------------------------------
  // Gossip protocol
  // -----------------------------------------------------------------------

  /**
   * Execute one gossip round: select random peers and exchange digests.
   */
  private async gossipRound(): Promise<void> {
    if (!this.transport) {
      return;
    }

    const peerIds = this.transport.getPeerNodeIds();
    if (peerIds.length === 0) {
      return;
    }

    // Select random peers (fanout)
    const selected = this.selectRandomPeers(
      peerIds,
      Math.min(this.config.gossip.fanout, peerIds.length)
    );

    const digest = this.buildDigest();
    const message: GossipMessage = {
      senderId: this.config.nodeId,
      sequence: ++this.localSequence,
      timestamp: Date.now(),
      type: 'digest',
      payload: digest,
    };

    for (const peerId of selected) {
      try {
        await this.transport.send(peerId, message);
        this.emit('gossip:sent', peerId, 'digest');
      } catch (error) {
        this.logger.debug(`Failed to gossip with ${peerId}:`, error);
      }
    }
  }

  /**
   * Handle an incoming gossip message from a peer.
   */
  async handleGossipMessage(message: GossipMessage): Promise<void> {
    this.emit('gossip:received', message.senderId, message.type);

    switch (message.type) {
      case 'digest':
        await this.handleDigest(
          message.senderId,
          message.payload as GossipDigest
        );
        break;
      case 'delta':
        this.handleDelta(message.payload as GossipDelta);
        break;
      case 'ack':
        await this.handleAck(message.senderId, message.payload as GossipAck);
        break;
      case 'probe':
        await this.handleProbe(
          message.senderId,
          message.payload as GossipProbe
        );
        break;
      case 'probe-ack':
        this.handleProbeAck(message.payload as GossipProbeAck);
        break;
      case 'probe-request':
        await this.handleProbeRequest(message.payload as GossipProbeRequest);
        break;
    }
  }

  private async handleDigest(
    senderId: string,
    digest: GossipDigest
  ): Promise<void> {
    if (!this.transport) {
      return;
    }

    // Compare digest with local state to find what the peer is missing
    const entriesToSend: GossipStateEntry[] = [];
    const entriesToRequest: string[] = [];

    for (const [nodeId, localVersion] of this.stateVersions.entries()) {
      const remoteVersion = digest.versions[nodeId];

      if (
        !remoteVersion ||
        remoteVersion.sequence < localVersion.sequence ||
        remoteVersion.generation < localVersion.generation
      ) {
        // We have newer state; include delta entries from this node
        for (const entry of this.localState.values()) {
          if (entry.nodeId === nodeId) {
            entriesToSend.push(entry);
          }
        }
      }
    }

    // Check what the peer has that we are missing
    for (const [nodeId, remoteVersion] of Object.entries(digest.versions)) {
      const localVersion = this.stateVersions.get(nodeId);

      if (
        !localVersion ||
        localVersion.sequence < remoteVersion.sequence ||
        localVersion.generation < remoteVersion.generation
      ) {
        entriesToRequest.push(nodeId);
      }
    }

    // Send delta if we have entries the peer is missing
    if (entriesToSend.length > 0) {
      const deltaMessage: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'delta',
        payload: { kind: 'delta', entries: entriesToSend },
      };

      await this.transport.send(senderId, deltaMessage);
      this.emit('gossip:sent', senderId, 'delta');
    }

    // Request entries we are missing
    if (entriesToRequest.length > 0) {
      const ackMessage: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'ack',
        payload: { kind: 'ack', requestedEntries: entriesToRequest },
      };

      await this.transport.send(senderId, ackMessage);
      this.emit('gossip:sent', senderId, 'ack');
    }
  }

  private handleDelta(delta: GossipDelta): void {
    for (const entry of delta.entries) {
      const existing = this.localState.get(entry.key);

      if (
        !existing ||
        entry.sequence > existing.sequence ||
        entry.generation > existing.generation ||
        (entry.generation === existing.generation &&
          entry.timestamp > existing.timestamp)
      ) {
        this.localState.set(entry.key, entry);
        this.updateVersion(entry.nodeId, entry.generation, entry.sequence);
        this.emit('gossip:state_updated', entry.key, entry.value);
      }
    }
  }

  private async handleAck(senderId: string, ack: GossipAck): Promise<void> {
    if (!this.transport) {
      return;
    }

    // The peer is requesting entries for specific nodes
    const entries: GossipStateEntry[] = [];

    for (const nodeId of ack.requestedEntries) {
      for (const entry of this.localState.values()) {
        if (entry.nodeId === nodeId) {
          entries.push(entry);
        }
      }
    }

    if (entries.length > 0) {
      const deltaMessage: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'delta',
        payload: { kind: 'delta', entries },
      };

      await this.transport.send(senderId, deltaMessage);
    }
  }

  // -----------------------------------------------------------------------
  // SWIM-style failure detection probes
  // -----------------------------------------------------------------------

  private async handleProbe(
    senderId: string,
    probe: GossipProbe
  ): Promise<void> {
    if (!this.transport) {
      return;
    }

    // If the probe is for us, respond directly
    if (probe.targetNodeId === this.config.nodeId) {
      const response: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'probe-ack',
        payload: {
          kind: 'probe-ack',
          targetNodeId: this.config.nodeId,
          alive: true,
        },
      };
      await this.transport.send(senderId, response);
    }
  }

  private handleProbeAck(probeAck: GossipProbeAck): void {
    if (probeAck.alive) {
      this.emit('probe:alive', probeAck.targetNodeId);
    } else {
      this.emit('probe:suspect', probeAck.targetNodeId);
    }
  }

  private async handleProbeRequest(
    probeRequest: GossipProbeRequest
  ): Promise<void> {
    if (!this.transport) {
      return;
    }

    // Indirect probe: we are asked to probe a target on behalf of requester
    const probeMessage: GossipMessage = {
      senderId: this.config.nodeId,
      sequence: ++this.localSequence,
      timestamp: Date.now(),
      type: 'probe',
      payload: {
        kind: 'probe',
        targetNodeId: probeRequest.targetNodeId,
      },
    };

    try {
      await this.transport.send(probeRequest.targetNodeId, probeMessage);
    } catch {
      // Target unreachable; notify requester
      const nack: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'probe-ack',
        payload: {
          kind: 'probe-ack',
          targetNodeId: probeRequest.targetNodeId,
          alive: false,
        },
      };
      await this.transport.send(probeRequest.requesterNodeId, nack);
    }
  }

  /**
   * Request indirect probing of a suspect node through intermediaries.
   */
  async requestIndirectProbe(
    suspectNodeId: string,
    intermediaryNodeIds: string[]
  ): Promise<void> {
    if (!this.transport) {
      return;
    }

    for (const intermediary of intermediaryNodeIds) {
      const message: GossipMessage = {
        senderId: this.config.nodeId,
        sequence: ++this.localSequence,
        timestamp: Date.now(),
        type: 'probe-request',
        payload: {
          kind: 'probe-request',
          targetNodeId: suspectNodeId,
          requesterNodeId: this.config.nodeId,
        },
      };

      try {
        await this.transport.send(intermediary, message);
      } catch {
        // Intermediary also unreachable
      }
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private buildDigest(): GossipDigest {
    const versions: Record<string, { generation: number; sequence: number }> =
      {};
    for (const [nodeId, version] of this.stateVersions.entries()) {
      versions[nodeId] = { ...version };
    }
    return { kind: 'digest', versions };
  }

  private updateVersion(
    nodeId: string,
    generation: number,
    sequence: number
  ): void {
    const existing = this.stateVersions.get(nodeId);
    if (
      !existing ||
      generation > existing.generation ||
      (generation === existing.generation && sequence > existing.sequence)
    ) {
      this.stateVersions.set(nodeId, { generation, sequence });
    }
  }

  private selectRandomPeers(peerIds: string[], count: number): string[] {
    const shuffled = [...peerIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  private garbageCollectTombstones(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, crdtValue] of this.crdtStore.entries()) {
      if (
        crdtValue.tombstone &&
        crdtValue.tombstoneAt &&
        now - crdtValue.tombstoneAt > this.config.crdt.maxTombstoneAge
      ) {
        this.crdtStore.delete(key);
        removed++;
      }
    }

    // Also expire TTL gossip entries
    for (const [key, entry] of this.localState.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.localState.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.emit('crdt:gc', removed);
    }
  }

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  getStats(): {
    gossipEntries: number;
    crdtEntries: number;
    trackedNodes: number;
    localSequence: number;
  } {
    return {
      gossipEntries: this.localState.size,
      crdtEntries: this.crdtStore.size,
      trackedNodes: this.stateVersions.size,
      localSequence: this.localSequence,
    };
  }
}
