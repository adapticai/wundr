/**
 * Federation - Multi-Orchestrator Coordination
 *
 * Exports all federation-related classes and types for distributed
 * orchestrator coordination and task delegation.
 *
 * New in Wave 2:
 *   - NodeRegistry: Cluster node lifecycle management
 *   - LeaderElection: Redis-lease-based leader election
 *   - TaskDistributor: Consistent-hash task routing
 *   - StateSync: Gossip protocol + CRDT state synchronization
 *   - HealthMonitor: Health probing + circuit breaker + failover
 */

// -- Existing modules --
export { OrchestratorFederation } from './coordinator';
export { OrchestratorConnection } from './connection';
export type { OrchestratorConnectionConfig, OrchestratorConnectionEvents } from './connection';

export { FederationRegistry } from './registry';
export type {
  RegistryOrchestratorMetadata,
  RegistryOrchestratorMetrics,
  RegistryOrchestratorStatus,
  FederationRegistryConfig,
  FederationRegistryEvents,
  OrchestratorQuery,
} from './registry-types';

export { TaskDelegator, InMemoryDelegationTracker } from './task-delegator';
export type { DelegationTracker, TaskDelegatorConfig } from './task-delegator';

// -- Wave 2: Distributed Federation --
export { NodeRegistry, InMemoryRegistryStore } from './node-registry';
export type {
  ClusterNode,
  NodeCapability,
  NodeStatus as ClusterNodeStatus,
  NodeRole,
  NodeLoadSnapshot,
  NodeRegistryConfig,
  NodeRegistryEvents,
  RegistryStore,
} from './node-registry';

export { LeaderElection, InMemoryElectionStore } from './leader-election';
export type {
  ElectionRole,
  ElectionState,
  ElectionConfig,
  ElectionEvents,
  ElectionStore,
} from './leader-election';

export { TaskDistributor } from './task-distributor';
export type {
  TaskDistributorConfig,
  TaskRoutingResult,
  AgentMigrationPlan,
  TaskDistributorEvents,
  HashFunction,
  RoutingStrategy,
  FallbackStrategy,
} from './task-distributor';

export {
  StateSync,
  GCounter,
  PNCounter,
  LWWRegister,
  ORSet,
  mergeVectorClocks,
  incrementVectorClock,
  compareVectorClocks,
} from './state-sync';
export type {
  StateSyncConfig,
  GossipMessage,
  GossipMessageType,
  GossipPayload,
  GossipDigest,
  GossipDelta,
  GossipAck,
  GossipProbe,
  GossipProbeAck,
  GossipProbeRequest,
  GossipStateEntry,
  GossipTransport,
  CRDTValue,
  CRDTType,
  VectorClock,
  StateSyncEvents,
} from './state-sync';

export { HealthMonitor } from './health-monitor';
export type {
  HealthMonitorConfig,
  CircuitBreakerState,
  CircuitBreaker,
  NodeHealthState,
  ProbeResult,
  FailoverPlan,
  ProbeFunction,
  HealthMonitorEvents,
} from './health-monitor';

// -- Existing types --
export type {
  OrchestratorCapabilities,
  OrchestratorStatus,
  OrchestratorConnection as OrchestratorConnectionInfo,
  DelegationRequest,
  DelegationResult,
  DelegationResponse,
  SharedContext,
  FederationConfig,
  FederationEvent,
  FederationBroadcast,
  FederationMetrics,
  FederationMessage,
  FederationMessageType,
  ConnectionStatus,
  ConnectionHealth,
  OrchestratorCapability,
  TaskCallback,
  BroadcastPayload,
  HeartbeatPayload,
  SerializedMessage,
  DelegationRecord,
  DelegationStatus,
  DelegationCallback,
  DelegationContext,
  OrchestratorInfo,
  CapabilityScore,
} from './types';
