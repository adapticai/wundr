/**
 * LeaderElection - Redis-lease-based leader election
 *
 * Implements a simplified Raft-inspired election using Redis as the
 * consensus medium. A single leader coordinates cluster-wide decisions
 * (rebalancing, schema changes, node approval) while followers operate
 * autonomously for their local sessions.
 *
 * Algorithm:
 *   1. Each node starts as a follower.
 *   2. The leader refreshes a Redis lease every heartbeatInterval.
 *   3. If a follower does not see a leader heartbeat within electionTimeout
 *      (randomized), it becomes a candidate and attempts SET NX on the lease.
 *   4. If SET NX succeeds, the candidate becomes leader.
 *   5. If another node holds the lease, the candidate reverts to follower.
 *   6. The leader steps down if it cannot refresh the lease.
 */

import { EventEmitter } from 'eventemitter3';

import { Logger, LogLevel } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ElectionRole = 'follower' | 'candidate' | 'leader';

export interface ElectionState {
  /** Monotonically increasing election term */
  currentTerm: number;
  /** ID of the current leader (null if unknown) */
  leaderId: string | null;
  /** When the current leader lease expires */
  leaderLeaseExpiry: Date | null;
  /** Who this node voted for in the current term */
  votedFor: string | null;
  /** This node's current role */
  role: ElectionRole;
  /** When we last heard from the leader */
  lastLeaderHeartbeat: Date | null;
}

export interface ElectionConfig {
  /** Duration of the leader lease in ms (default: 15000) */
  leaseTimeout: number;
  /** Base election timeout in ms (randomized +/- 50%, default: 10000) */
  electionTimeoutBase: number;
  /** Leader heartbeat interval in ms (default: 5000) */
  heartbeatInterval: number;
  /** Max time to spend in candidate state in ms (default: 30000) */
  maxCandidacyDuration: number;
  /** Cluster name for Redis key namespacing */
  clusterName: string;
  /** Verbose logging */
  verbose: boolean;
}

export interface ElectionEvents {
  'leader:elected': (leaderId: string, term: number) => void;
  'leader:lost': (oldLeaderId: string, term: number) => void;
  'leader:heartbeat': (leaderId: string, term: number) => void;
  'role:changed': (oldRole: ElectionRole, newRole: ElectionRole) => void;
  'term:advanced': (oldTerm: number, newTerm: number) => void;
  'election:started': (term: number) => void;
  'election:won': (term: number) => void;
  'election:lost': (term: number, winnerId: string) => void;
  error: (error: Error, context: string) => void;
}

/**
 * Minimal store interface for the election mechanism.
 * Supports atomic SET NX PX for lease acquisition.
 */
export interface ElectionStore {
  /**
   * Atomically set a key only if it does not exist, with a TTL.
   * Returns true if the key was set (lease acquired).
   */
  setNX(key: string, value: string, ttlMs: number): Promise<boolean>;

  /**
   * Set a key with a TTL (overwrite). Used by the leader to refresh.
   * Returns true only if the current value matches expectedValue.
   */
  setIfMatch(
    key: string,
    value: string,
    ttlMs: number,
    expectedValue: string
  ): Promise<boolean>;

  /**
   * Get the current value of a key.
   */
  get(key: string): Promise<string | null>;

  /**
   * Delete a key only if the current value matches.
   */
  deleteIfMatch(key: string, expectedValue: string): Promise<boolean>;

  /** Whether the store is reachable */
  isConnected(): boolean;
}

// ---------------------------------------------------------------------------
// In-memory election store (for testing)
// ---------------------------------------------------------------------------

export class InMemoryElectionStore implements ElectionStore {
  private data = new Map<string, { value: string; expiresAt: number }>();
  private connected = true;

  async setNX(key: string, value: string, ttlMs: number): Promise<boolean> {
    this.cleanup();
    if (this.data.has(key)) {
      return false;
    }
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
    return true;
  }

  async setIfMatch(
    key: string,
    value: string,
    ttlMs: number,
    expectedValue: string
  ): Promise<boolean> {
    this.cleanup();
    const entry = this.data.get(key);
    if (!entry || entry.value !== expectedValue) {
      return false;
    }
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
    return true;
  }

  async get(key: string): Promise<string | null> {
    this.cleanup();
    return this.data.get(key)?.value ?? null;
  }

  async deleteIfMatch(key: string, expectedValue: string): Promise<boolean> {
    this.cleanup();
    const entry = this.data.get(key);
    if (!entry || entry.value !== expectedValue) {
      return false;
    }
    this.data.delete(key);
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.data.entries()) {
      if (entry.expiresAt <= now) {
        this.data.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ElectionConfig = {
  leaseTimeout: 15_000,
  electionTimeoutBase: 10_000,
  heartbeatInterval: 5_000,
  maxCandidacyDuration: 30_000,
  clusterName: 'orchestrator-cluster',
  verbose: false,
};

// ---------------------------------------------------------------------------
// LeaderElection
// ---------------------------------------------------------------------------

export class LeaderElection extends EventEmitter<ElectionEvents> {
  private logger: Logger;
  private config: ElectionConfig;
  private store: ElectionStore;
  private nodeId: string;

  private state: ElectionState;

  /** Timer for leader heartbeat (when this node is leader) */
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** Timer for election timeout (when this node is follower) */
  private electionTimer: NodeJS.Timeout | null = null;
  /** Timer for candidacy timeout */
  private candidacyTimer: NodeJS.Timeout | null = null;

  private running = false;

  constructor(
    nodeId: string,
    config: Partial<ElectionConfig> = {},
    store?: ElectionStore
  ) {
    super();
    this.nodeId = nodeId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store ?? new InMemoryElectionStore();
    this.logger = new Logger(
      'LeaderElection',
      this.config.verbose ? LogLevel.DEBUG : LogLevel.INFO
    );

    this.state = {
      currentTerm: 0,
      leaderId: null,
      leaderLeaseExpiry: null,
      votedFor: null,
      role: 'follower',
      lastLeaderHeartbeat: null,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the election process. The node begins as a follower and
   * attempts to discover the current leader.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    this.logger.info(`Starting leader election for node ${this.nodeId}`);

    // Check for existing leader
    const currentLeader = await this.discoverLeader();

    if (currentLeader) {
      this.state.leaderId = currentLeader.leaderId;
      this.state.currentTerm = currentLeader.term;
      this.state.lastLeaderHeartbeat = new Date();

      if (currentLeader.leaderId === this.nodeId) {
        // We are the leader from a previous run; try to re-acquire
        await this.tryBecomeLeader();
      } else {
        this.transitionTo('follower');
        this.startElectionTimer();
      }
    } else {
      // No leader found; start election
      this.transitionTo('follower');
      this.startElectionTimer();
    }
  }

  /**
   * Stop the election process. If this node is the leader, it
   * releases the lease.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;

    this.logger.info('Stopping leader election');

    this.clearAllTimers();

    // Release leadership if we hold it
    if (this.state.role === 'leader') {
      await this.stepDown();
    }
  }

  // -----------------------------------------------------------------------
  // State queries
  // -----------------------------------------------------------------------

  getState(): Readonly<ElectionState> {
    return { ...this.state };
  }

  isLeader(): boolean {
    return this.state.role === 'leader';
  }

  getLeaderId(): string | null {
    return this.state.leaderId;
  }

  getCurrentTerm(): number {
    return this.state.currentTerm;
  }

  // -----------------------------------------------------------------------
  // Leader heartbeat (incoming)
  // -----------------------------------------------------------------------

  /**
   * Process a leader heartbeat received via gossip or direct message.
   * Followers use this to reset their election timeout.
   */
  receiveLeaderHeartbeat(leaderId: string, term: number): void {
    if (term < this.state.currentTerm) {
      // Stale heartbeat from old term; ignore
      return;
    }

    if (term > this.state.currentTerm) {
      this.advanceTerm(term);
    }

    this.state.leaderId = leaderId;
    this.state.lastLeaderHeartbeat = new Date();

    // If we are a candidate and a valid leader exists, step down
    if (this.state.role === 'candidate') {
      this.transitionTo('follower');
    }

    // Reset election timer
    if (this.state.role === 'follower') {
      this.resetElectionTimer();
    }

    this.emit('leader:heartbeat', leaderId, term);
  }

  // -----------------------------------------------------------------------
  // Election logic
  // -----------------------------------------------------------------------

  private async discoverLeader(): Promise<{
    leaderId: string;
    term: number;
  } | null> {
    if (!this.store.isConnected()) {
      return null;
    }

    try {
      const leaseValue = await this.store.get(this.leaseKey());
      if (!leaseValue) {
        return null;
      }

      const parsed = JSON.parse(leaseValue);
      return { leaderId: parsed.leaderId, term: parsed.term };
    } catch {
      return null;
    }
  }

  private async tryBecomeLeader(): Promise<void> {
    if (!this.store.isConnected()) {
      this.logger.warn('Store not connected; cannot run election');
      this.transitionTo('follower');
      this.startElectionTimer();
      return;
    }

    const newTerm = this.state.currentTerm + 1;
    this.advanceTerm(newTerm);
    this.state.votedFor = this.nodeId;
    this.transitionTo('candidate');
    this.emit('election:started', newTerm);

    this.logger.info(`Starting election for term ${newTerm}`);

    // Start candidacy timeout
    this.startCandidacyTimer();

    // Attempt to acquire the lease
    const leaseValue = JSON.stringify({
      leaderId: this.nodeId,
      term: newTerm,
      acquiredAt: new Date().toISOString(),
    });

    const acquired = await this.store.setNX(
      this.leaseKey(),
      leaseValue,
      this.config.leaseTimeout
    );

    if (acquired) {
      // We won the election
      this.clearCandidacyTimer();
      this.state.leaderId = this.nodeId;
      this.transitionTo('leader');
      this.startHeartbeat();

      this.logger.info(`Won election for term ${newTerm}`);
      this.emit('election:won', newTerm);
      this.emit('leader:elected', this.nodeId, newTerm);
    } else {
      // Someone else holds the lease
      const existing = await this.discoverLeader();
      if (existing) {
        this.state.leaderId = existing.leaderId;
        this.state.currentTerm = Math.max(
          this.state.currentTerm,
          existing.term
        );
        this.logger.info(
          `Lost election for term ${newTerm}; leader is ${existing.leaderId}`
        );
        this.emit('election:lost', newTerm, existing.leaderId);
      }

      this.clearCandidacyTimer();
      this.transitionTo('follower');
      this.startElectionTimer();
    }
  }

  private async stepDown(): Promise<void> {
    const oldTerm = this.state.currentTerm;
    const oldLeader = this.state.leaderId;

    this.logger.info(`Stepping down from leadership (term ${oldTerm})`);

    this.clearHeartbeatTimer();

    // Release the lease
    if (this.store.isConnected()) {
      try {
        // We need to check that we still own the lease
        const currentLease = await this.store.get(this.leaseKey());
        if (currentLease) {
          const parsed = JSON.parse(currentLease);
          if (parsed.leaderId === this.nodeId) {
            await this.store.deleteIfMatch(this.leaseKey(), currentLease);
          }
        }
      } catch (error) {
        this.logger.warn('Failed to release lease during step-down:', error);
      }
    }

    this.state.leaderId = null;
    this.transitionTo('follower');

    if (oldLeader) {
      this.emit('leader:lost', oldLeader, oldTerm);
    }
  }

  // -----------------------------------------------------------------------
  // Heartbeat (outgoing, when leader)
  // -----------------------------------------------------------------------

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();

    this.heartbeatTimer = setInterval(async () => {
      if (this.state.role !== 'leader') {
        this.clearHeartbeatTimer();
        return;
      }

      await this.refreshLease();
    }, this.config.heartbeatInterval);
  }

  private async refreshLease(): Promise<void> {
    if (!this.store.isConnected()) {
      this.logger.warn('Cannot refresh lease: store disconnected');
      await this.stepDown();
      return;
    }

    const currentLease = await this.store.get(this.leaseKey());
    if (!currentLease) {
      // Lease expired; try to re-acquire
      const leaseValue = JSON.stringify({
        leaderId: this.nodeId,
        term: this.state.currentTerm,
        acquiredAt: new Date().toISOString(),
      });

      const acquired = await this.store.setNX(
        this.leaseKey(),
        leaseValue,
        this.config.leaseTimeout
      );

      if (!acquired) {
        this.logger.warn('Failed to re-acquire expired lease');
        await this.stepDown();
        this.startElectionTimer();
      }
      return;
    }

    try {
      const parsed = JSON.parse(currentLease);
      if (parsed.leaderId !== this.nodeId) {
        // Someone else took the lease
        this.logger.warn(`Lease taken by ${parsed.leaderId}; stepping down`);
        await this.stepDown();
        this.startElectionTimer();
        return;
      }

      // Refresh the lease
      const newLeaseValue = JSON.stringify({
        leaderId: this.nodeId,
        term: this.state.currentTerm,
        acquiredAt: new Date().toISOString(),
      });

      const refreshed = await this.store.setIfMatch(
        this.leaseKey(),
        newLeaseValue,
        this.config.leaseTimeout,
        currentLease
      );

      if (!refreshed) {
        this.logger.warn('Failed to refresh lease (value changed)');
        await this.stepDown();
        this.startElectionTimer();
      }
    } catch (error) {
      this.logger.error('Error refreshing lease:', error);
      this.emit('error', error as Error, 'refreshLease');
    }
  }

  // -----------------------------------------------------------------------
  // Election timer (follower)
  // -----------------------------------------------------------------------

  private startElectionTimer(): void {
    this.clearElectionTimer();

    const jitter = this.config.electionTimeoutBase * 0.5;
    const timeout =
      this.config.electionTimeoutBase +
      Math.floor(Math.random() * jitter) -
      jitter / 2;

    this.electionTimer = setTimeout(async () => {
      if (!this.running) {
        return;
      }

      if (this.state.role === 'follower') {
        this.logger.info(`Election timeout (${timeout}ms); starting election`);
        await this.tryBecomeLeader();
      }
    }, timeout);
  }

  private resetElectionTimer(): void {
    this.startElectionTimer();
  }

  private clearElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Candidacy timer
  // -----------------------------------------------------------------------

  private startCandidacyTimer(): void {
    this.clearCandidacyTimer();

    this.candidacyTimer = setTimeout(async () => {
      if (this.state.role === 'candidate') {
        this.logger.warn('Candidacy timeout; reverting to follower');
        this.transitionTo('follower');
        this.startElectionTimer();
      }
    }, this.config.maxCandidacyDuration);
  }

  private clearCandidacyTimer(): void {
    if (this.candidacyTimer) {
      clearTimeout(this.candidacyTimer);
      this.candidacyTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Timer cleanup
  // -----------------------------------------------------------------------

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearHeartbeatTimer();
    this.clearElectionTimer();
    this.clearCandidacyTimer();
  }

  // -----------------------------------------------------------------------
  // State transitions
  // -----------------------------------------------------------------------

  private transitionTo(newRole: ElectionRole): void {
    const oldRole = this.state.role;
    if (oldRole === newRole) {
      return;
    }

    this.state.role = newRole;
    this.logger.info(`Role transition: ${oldRole} -> ${newRole}`);
    this.emit('role:changed', oldRole, newRole);
  }

  private advanceTerm(newTerm: number): void {
    if (newTerm <= this.state.currentTerm) {
      return;
    }

    const oldTerm = this.state.currentTerm;
    this.state.currentTerm = newTerm;
    this.state.votedFor = null;

    this.emit('term:advanced', oldTerm, newTerm);
  }

  // -----------------------------------------------------------------------
  // Key helpers
  // -----------------------------------------------------------------------

  private leaseKey(): string {
    return `wundr:${this.config.clusterName}:leader-lease`;
  }
}
