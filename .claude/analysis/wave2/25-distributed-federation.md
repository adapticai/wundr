# 25 - Distributed Federation Architecture

## Status: Design Complete

## Priority: High

## Complexity: Very High

---

## 1. Executive Summary

This document defines the distributed federation architecture for Wundr's orchestrator daemon,
extending the existing `federation/` and `distributed/` modules with production-grade infrastructure
for multi-node orchestration. The design introduces five new core subsystems -- node registry,
leader election, task distribution, state synchronization, and health monitoring -- that together
enable a cluster of orchestrator daemons to operate as a cohesive, fault-tolerant distributed
system.

---

## 2. Current State Analysis

### 2.1 Existing Federation Module (`src/federation/`)

| Component                | File                            | Status        | Gaps                                                      |
| ------------------------ | ------------------------------- | ------------- | --------------------------------------------------------- |
| `OrchestratorFederation` | `coordinator.ts`                | Functional    | No leader election; single-coordinator model              |
| `FederationRegistry`     | `registry.ts`                   | Functional    | Redis-only; no gossip protocol for partition resilience   |
| `OrchestratorConnection` | `connection.ts`                 | Functional    | Per-peer WebSocket; no connection pooling or multiplexing |
| `TaskDelegator`          | `task-delegator.ts`             | Functional    | In-memory tracking only; simulated dispatch               |
| Types                    | `types.ts`, `registry-types.ts` | Comprehensive | Missing leader election and gossip types                  |

### 2.2 Existing Distributed Module (`src/distributed/`)

| Component                   | File                     | Status     | Gaps                                                  |
| --------------------------- | ------------------------ | ---------- | ----------------------------------------------------- |
| `DaemonNode`                | `daemon-node.ts`         | Functional | Reconnect logic exists but no cluster-aware discovery |
| `LoadBalancer`              | `load-balancer.ts`       | Functional | Four strategies; no consistent hashing                |
| `DistributedSessionManager` | `session-distributor.ts` | Functional | Redis-backed; no cross-node memory sharing            |
| `SessionSerializer`         | `session-serializer.ts`  | Functional | zlib compression, checkpointing; no CRDTs             |

### 2.3 Existing Monitoring Integration

- Prometheus metrics already defined: `orchestrator_federation_delegations_total`,
  `orchestrator_node_load`
- Health endpoint already checks `federationRegistry`
- Docker Compose already references `ENABLE_FEDERATION` and `FEDERATION_PORT`
- `package.json` already exports `./federation` and `./distributed` subpaths

### 2.4 Key Insight: SwarmIntelligence Integration Point

The `@wundr/ai-integration` SwarmIntelligence system provides:

- Topology selection (mesh, hierarchical, adaptive, ring, star)
- Consensus engine for decision aggregation
- Communication matrix for agent connectivity
- Collective memory for pattern learning

The distributed federation layer must bridge SwarmIntelligence's intra-task agent topology with the
inter-node daemon topology, enabling agents within a swarm to be distributed across physical nodes.

---

## 3. Architecture Overview

```
                    +--------------------+
                    |   Client (CLI/UI)  |
                    +---------+----------+
                              |
                              | WebSocket
                              v
               +------------------------------+
               |        Gateway / Router       |
               |   (any node in the cluster)   |
               +-----+-------------+----------+
                     |             |
          +----------v--+    +----v-----------+
          | Node A       |    | Node B          |
          | (Leader)     |    | (Follower)      |
          |              |    |                 |
          | +---------+  |    | +---------+    |
          | | Sessions|  |    | | Sessions|    |
          | +---------+  |    | +---------+    |
          | | Memory  |  |    | | Memory  |    |
          | +---------+  |    | +---------+    |
          | | Agents  |  |    | | Agents  |    |
          | +---------+  |    | +---------+    |
          +------+-------+    +-------+--------+
                 |                    |
                 +--------+-----------+
                          |
                 +--------v---------+
                 |      Redis       |
                 | (State Store)    |
                 +------------------+
```

### 3.1 Design Principles

1. **Leader-Follower with Graceful Degradation**: A single leader coordinates cluster-wide decisions
   (rebalancing, schema changes) while followers handle their own sessions autonomously. If the
   leader fails, the cluster continues operating in degraded mode until re-election completes.

2. **Consistent Hashing for Deterministic Routing**: Tasks are routed to nodes based on a consistent
   hash ring, minimizing redistribution when nodes join or leave.

3. **Gossip Protocol for Partition Resilience**: In addition to Redis-backed state, a lightweight
   gossip protocol propagates cluster state changes, ensuring nodes can operate during Redis
   outages.

4. **CRDT-Inspired State Synchronization**: Shared state (collective memory, pattern databases) uses
   conflict-free merge strategies to avoid coordination bottlenecks.

5. **Agent Mobility**: Agents within a swarm can be migrated between nodes using the existing
   `SessionSerializer` infrastructure, extended with agent-level checkpointing.

---

## 4. Component Design

### 4.1 Node Registry (`node-registry.ts`)

**Purpose**: Manages the lifecycle of nodes in the cluster -- discovery, registration,
deregistration, and identity.

**Design Rationale**: The existing `FederationRegistry` in `registry.ts` is Redis-only and operates
at the orchestrator abstraction level. The new `NodeRegistry` operates at the daemon-node level and
combines Redis-backed persistence with in-memory gossip state for partition tolerance.

```typescript
interface ClusterNode {
  id: string; // Unique node identifier (UUID)
  host: string; // Network hostname or IP
  port: number; // WebSocket port
  federationPort: number; // Dedicated federation port
  region: string; // Deployment region
  zone: string; // Availability zone
  capabilities: NodeCapability[];
  status: NodeStatus;
  role: 'leader' | 'follower' | 'candidate' | 'observer';
  generation: number; // Monotonic generation counter
  joinedAt: Date;
  lastSeen: Date;
  metadata: Record<string, unknown>;
}

type NodeCapability =
  | 'sessions' // Can host sessions
  | 'gpu' // Has GPU access
  | 'high-memory' // Has high-memory configuration
  | 'gateway' // Can serve as client gateway
  | 'storage'; // Has persistent storage

type NodeStatus = 'joining' | 'active' | 'draining' | 'leaving' | 'suspect' | 'dead';
```

**Key Behaviors**:

- **Self-Registration**: On startup, each node registers itself with Redis and announces via gossip.
  Idempotent; handles restart scenarios.
- **Peer Discovery**: Nodes discover peers via Redis set membership and gossip protocol
  announcements.
- **Graceful Drain**: Before leaving, a node enters `draining` status. The cluster migrates its
  sessions to other nodes before removing it.
- **Consistent Identity**: Node ID is persisted to disk (`~/.wundr/node-id`) to survive restarts.
  Generation counter increments on each startup.

**Integration with Existing Code**:

- Wraps `FederationRegistry` for Redis operations
- Extends `DaemonNode` connection model from `distributed/daemon-node.ts`
- Emits events compatible with `FederationRegistryEvents`

### 4.2 Leader Election (`leader-election.ts`)

**Purpose**: Elects a single leader node responsible for cluster-wide coordination decisions.

**Algorithm**: Simplified Raft-inspired election using Redis as the consensus medium, with the
gossip protocol as a secondary channel.

**Why Not Full Raft**: The orchestrator daemon's consistency requirements are modest -- the leader
coordinates rebalancing and schema changes, not transaction ordering. A Redis-lease-based approach
provides sufficient guarantees with far less implementation complexity.

```typescript
interface ElectionState {
  currentTerm: number; // Election term counter
  leaderId: string | null; // Current leader node ID
  leaderLease: Date | null; // Lease expiration
  votedFor: string | null; // Who this node voted for in current term
  state: 'follower' | 'candidate' | 'leader';
  lastHeartbeatFromLeader: Date | null;
}

interface ElectionConfig {
  leaseTimeout: number; // Leader lease duration (default: 15s)
  electionTimeout: number; // Time before starting election (default: 10-15s randomized)
  heartbeatInterval: number; // Leader heartbeat frequency (default: 5s)
  maxCandidacyDuration: number; // Max time in candidate state (default: 30s)
}
```

**Election Flow**:

1. **Startup**: Node starts as `follower`. Reads current leader from Redis.
2. **Leader Heartbeat**: Leader refreshes its Redis lease every `heartbeatInterval`. Broadcasts
   heartbeat via gossip.
3. **Election Trigger**: If a follower does not receive a leader heartbeat within `electionTimeout`
   (randomized to avoid split elections), it becomes a `candidate`.
4. **Candidacy**: Candidate increments term, votes for itself, and atomically attempts to acquire
   the Redis leader lease using `SET key value NX PX timeout`.
5. **Election Win**: If the `SET NX` succeeds, the candidate becomes leader. It broadcasts
   leadership via gossip.
6. **Election Loss**: If another node acquired the lease, the candidate reverts to follower.
7. **Leader Step-Down**: The leader steps down if it cannot refresh its lease (Redis outage, network
   partition).

**Partition Handling**:

- During a Redis partition, the existing leader continues operating with its current lease.
- Nodes that cannot reach Redis operate in `degraded` mode -- they handle their existing sessions
  but do not accept new cluster-wide tasks.
- When Redis connectivity is restored, the leader re-acquires the lease or a new election occurs.

**Leader Responsibilities**:

- Initiate cluster rebalancing
- Approve node joins and leaves
- Coordinate cross-node memory compaction
- Manage global task queue ordering

### 4.3 Task Distributor (`task-distributor.ts`)

**Purpose**: Routes incoming tasks to the optimal node using consistent hashing, capability
matching, and load awareness.

**Design**: Extends the existing `TaskDelegator` and `LoadBalancer` with a consistent hash ring for
deterministic routing.

```typescript
interface TaskDistributorConfig {
  hashRing: {
    virtualNodes: number; // Virtual nodes per physical node (default: 150)
    hashFunction: 'xxhash' | 'murmur3' | 'sha256';
  };
  routing: {
    strategy: 'hash-primary' | 'capability-first' | 'load-aware';
    fallbackStrategy: 'least-loaded' | 'round-robin';
    maxRedirects: number; // Max times a task can be redirected (default: 3)
  };
  agentMigration: {
    enabled: boolean;
    migrationThreshold: number; // Load imbalance threshold to trigger migration
    cooldownPeriod: number; // Min time between migrations for same agent
  };
}
```

**Consistent Hash Ring**:

- Each physical node is represented by `virtualNodes` positions on the ring.
- Task routing key is derived from: `hash(taskType + orchestratorId + priority)`.
- When a node joins or leaves, only `K/N` tasks are redistributed (where K = total tasks, N = total
  nodes).
- Capability constraints are applied as a pre-filter: only nodes with matching capabilities are
  included in the hash ring for a given task type.

**Agent Migration**:

- When the SwarmIntelligence system creates a swarm spanning multiple agents, the task distributor
  can migrate specific agents to colocate them on the same node for reduced latency.
- Migration uses the existing `SessionSerializer` for state transfer.
- Anti-affinity rules prevent placing competing agents on the same node.

**Integration with Existing Code**:

- Wraps `LoadBalancer.selectNode()` with hash-ring awareness
- Extends `TaskDelegator.delegate()` with cross-node dispatch
- Uses `SessionSerializer` for agent state migration

### 4.4 State Synchronization (`state-sync.ts`)

**Purpose**: Synchronizes shared state across cluster nodes, including collective memory, pattern
databases, and session metadata.

**Design**: Three-tier synchronization strategy:

```
Tier 1: Redis (Strongly Consistent)
  - Session locations
  - Node registry
  - Leader election state
  - Task assignments

Tier 2: Gossip Protocol (Eventually Consistent)
  - Node health status
  - Load metrics
  - Cluster topology changes
  - Leader heartbeats

Tier 3: CRDT Merge (Conflict-Free)
  - Collective memory patterns
  - Performance metrics history
  - Agent capability scores
  - Optimization history
```

```typescript
interface StateSyncConfig {
  gossip: {
    interval: number; // Gossip round interval (default: 1s)
    fanout: number; // Number of peers to gossip with per round (default: 3)
    maxPayloadSize: number; // Max gossip message size in bytes
    suspicionMultiplier: number; // SWIM-style suspicion timeout multiplier
  };
  crdt: {
    mergeInterval: number; // Background merge interval (default: 5s)
    gcInterval: number; // Tombstone garbage collection interval (default: 60s)
    maxTombstoneAge: number; // Max age before tombstone removal (default: 300s)
  };
  redis: {
    syncInterval: number; // Redis state refresh interval (default: 10s)
    keyPrefix: string; // Redis key prefix for this cluster
  };
}
```

**Gossip Protocol Details**:

- Based on SWIM (Scalable Weakly-consistent Infection-style process group Membership).
- Each gossip round, a node selects `fanout` random peers and exchanges state digests.
- State includes: node status, load metrics, generation counters, leader term.
- Infection-style propagation: new information spreads exponentially through the cluster.
- Suspicion mechanism: before declaring a node dead, probe through intermediary nodes.

**CRDT Types Used**:

- **G-Counter**: For aggregate metrics (total tasks processed, total tokens used)
- **LWW-Register**: For node status and configuration
- **OR-Set**: For pattern databases (add/remove patterns without conflicts)
- **PN-Counter**: For session counts that can increment and decrement

**Cross-Node Memory Sharing**:

- The SwarmIntelligence `collectiveMemory` is replicated across nodes using OR-Set CRDTs.
- Successful patterns, failure patterns, and optimization history are shared.
- Each node merges incoming pattern data with its local copy during gossip rounds.
- Memory compaction is coordinated by the leader to prevent concurrent compaction conflicts.

### 4.5 Health Monitor (`health-monitor.ts`)

**Purpose**: Comprehensive health monitoring for all cluster nodes, with automated failure detection
and recovery.

```typescript
interface HealthMonitorConfig {
  checks: {
    interval: number; // Health check frequency (default: 5s)
    timeout: number; // Individual check timeout (default: 3s)
    failureThreshold: number; // Failures before marking unhealthy (default: 3)
    successThreshold: number; // Successes before marking healthy (default: 2)
  };
  probes: {
    liveness: boolean; // Is the process running
    readiness: boolean; // Can the node accept work
    startup: boolean; // Has the node finished initializing
  };
  failover: {
    enabled: boolean;
    sessionMigrationTimeout: number; // Max time for session evacuation
    maxConcurrentMigrations: number; // Parallel migration limit
    drainTimeout: number; // Max time for graceful drain
  };
  circuitBreaker: {
    enabled: boolean;
    threshold: number; // Error rate to trip circuit (default: 0.5)
    resetTimeout: number; // Time before half-open (default: 30s)
    halfOpenRequests: number; // Requests in half-open state (default: 3)
  };
}
```

**Failure Detection**:

- **Direct Probing**: TCP health checks to each node's federation port.
- **Indirect Probing**: If direct probe fails, request `fanout` other nodes to probe the suspect
  node (SWIM protocol).
- **Suspicion State**: A node enters `suspect` before `dead`. During suspicion, the node can refute
  by responding to any probe.
- **Failure Threshold**: A node is declared `dead` only after `failureThreshold` consecutive
  failures from multiple independent probers.

**Automated Failover**:

1. When a node is declared `dead`, the leader initiates session evacuation.
2. Sessions are migrated to healthy nodes using the task distributor's load-aware selection.
3. Migrations are rate-limited (`maxConcurrentMigrations`) to prevent thundering herd.
4. If the leader itself fails, the election system triggers a new election before failover can
   proceed.

**Circuit Breaker**:

- Protects inter-node communication from cascading failures.
- States: `closed` (normal) -> `open` (blocking) -> `half-open` (testing).
- Applied per-node: if a node's error rate exceeds threshold, the circuit opens and requests are
  routed elsewhere.
- In half-open state, a limited number of probe requests are sent. If they succeed, the circuit
  closes.

**Integration with Existing Monitoring**:

- Updates Prometheus gauges: `orchestrator_node_load`, `orchestrator_federation_delegations_total`
- Feeds health endpoint at `/health` with per-node status
- Emits events compatible with the existing `monitoring/endpoint.ts` health check system

---

## 5. Network Partition Handling

### 5.1 Split-Brain Prevention

```
Partition Scenario:
  [Node A, Node B] <--X--> [Node C, Node D, Node E]

  Minority partition (A, B):
    - Leader lease expires (cannot refresh via Redis)
    - Nodes enter degraded mode
    - Continue serving existing sessions read-only
    - Do NOT accept new session spawns
    - Do NOT initiate rebalancing

  Majority partition (C, D, E):
    - If leader was in minority, new election occurs
    - New leader coordinates failover for sessions on A, B
    - Normal operation continues

  Healing:
    - Minority nodes detect connectivity restoration
    - Re-register with Redis
    - Leader integrates returning nodes
    - Incremental state sync via gossip
    - Session locations reconciled
```

### 5.2 Consistency Guarantees

| Data Type         | Consistency | Mechanism                              |
| ----------------- | ----------- | -------------------------------------- |
| Session location  | Strong      | Redis (single writer: owning node)     |
| Leader identity   | Strong      | Redis lease with NX                    |
| Node registry     | Strong      | Redis with generation counters         |
| Node health       | Eventual    | Gossip (convergence < 5s for 10 nodes) |
| Load metrics      | Eventual    | Gossip (convergence < 3s)              |
| Collective memory | Eventual    | CRDT merge (conflict-free)             |
| Task assignments  | Causal      | Hash ring + Redis confirmation         |

---

## 6. Service Mesh Integration Points

The federation layer is designed to operate both standalone and within a service mesh (Istio,
Linkerd).

**When running in a service mesh**:

- mTLS is handled by the sidecar proxy; federation connections use plaintext internally.
- Service discovery can delegate to the mesh's service registry instead of Redis-based discovery.
- Circuit breaking can defer to the mesh's circuit breaker, disabling the built-in one.
- Load balancing at the connection level is handled by the mesh; the federation layer handles
  application-level task routing.

**Configuration**:

```typescript
interface ServiceMeshConfig {
  enabled: boolean;
  provider: 'istio' | 'linkerd' | 'none';
  delegateDiscovery: boolean; // Use mesh service discovery
  delegateCircuitBreaker: boolean;
  delegateLoadBalancing: boolean; // Connection-level only
  mtlsEnabled: boolean; // If false, federation handles TLS
}
```

---

## 7. Implementation Plan

### Phase 1: Node Registry + Health Monitor (Week 1-2)

- `node-registry.ts`: Self-registration, peer discovery, graceful drain
- `health-monitor.ts`: Direct probing, failure detection, circuit breaker
- Integration with existing `FederationRegistry` and monitoring metrics

### Phase 2: Leader Election (Week 2-3)

- `leader-election.ts`: Redis-lease election, heartbeat, step-down
- Integration with gossip-based leader announcements
- Leader responsibility delegation

### Phase 3: State Synchronization (Week 3-4)

- `state-sync.ts`: Gossip protocol, CRDT merge engine
- Cross-node collective memory sharing
- Partition detection and healing

### Phase 4: Task Distributor (Week 4-5)

- `task-distributor.ts`: Consistent hash ring, capability-aware routing
- Agent migration support
- Integration with existing `TaskDelegator` and `LoadBalancer`

### Phase 5: Integration Testing + Hardening (Week 5-6)

- Multi-node integration tests
- Chaos testing (node failures, network partitions)
- Performance benchmarking
- Documentation

---

## 8. File Structure

```
src/federation/
  node-registry.ts       # [NEW] Cluster node lifecycle management
  leader-election.ts     # [NEW] Redis-lease leader election
  task-distributor.ts     # [NEW] Consistent-hash task routing
  state-sync.ts          # [NEW] Gossip + CRDT state synchronization
  health-monitor.ts      # [NEW] Health probing + circuit breaker + failover
  coordinator.ts         # [EXISTING] OrchestratorFederation
  connection.ts          # [EXISTING] OrchestratorConnection
  registry.ts            # [EXISTING] FederationRegistry (Redis)
  task-delegator.ts      # [EXISTING] TaskDelegator
  types.ts               # [EXISTING + EXTENDED] Federation types
  registry-types.ts      # [EXISTING] Registry types
  index.ts               # [EXISTING + EXTENDED] Module exports
```

---

## 9. Risk Assessment

| Risk                           | Likelihood | Impact   | Mitigation                                          |
| ------------------------------ | ---------- | -------- | --------------------------------------------------- |
| Redis single-point-of-failure  | Medium     | High     | Gossip protocol as fallback; Redis Sentinel/Cluster |
| Split-brain during partition   | Low        | Critical | Lease-based leader + majority rule                  |
| Gossip protocol message storms | Low        | Medium   | Fanout limiting, payload size caps                  |
| Session migration data loss    | Medium     | High     | Checkpointed serialization + rollback               |
| CRDT tombstone accumulation    | Low        | Low      | Periodic garbage collection                         |
| Leader election livelock       | Very Low   | High     | Randomized timeouts + max candidacy duration        |

---

## 10. Testing Strategy

1. **Unit Tests**: Each component in isolation with mocked Redis and WebSocket.
2. **Integration Tests**: Multi-instance tests using actual Redis (Docker).
3. **Chaos Tests**: Random node kills, network partitions (using `tc` or `toxiproxy`).
4. **Load Tests**: Measure task routing throughput and session migration latency.
5. **Convergence Tests**: Verify gossip convergence time as cluster size scales.
