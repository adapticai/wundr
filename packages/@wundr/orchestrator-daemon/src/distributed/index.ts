/**
 * Distributed session management exports
 */

export { SessionSerializer } from './session-serializer';
export type {
  Message,
  ToolResult,
  SessionState,
  SerializedSession as SerializerSession,
  SessionCheckpoint,
} from './session-serializer';

export { DaemonNode } from './daemon-node';
export type {
  NodeCapabilities,
  NodeHealth as DaemonNodeHealth,
  SessionSpawnRequest,
  SerializedSession,
} from './daemon-node';

export {
  LoadBalancer,
} from './load-balancer';
export type {
  LoadBalancerNode,
  NodeLoad,
  NodeHealth,
  NodeSelectionOptions,
  NodeScore,
  LoadBalancingStrategy,
} from './load-balancer';

export { DistributedSessionManager } from './session-distributor';
export type {
  DaemonNode as DaemonNodeType,
  NodeStatus,
  SpawnSessionRequest as DistributedSpawnRequest,
  SessionConstraints,
  SessionMigrationResult,
  ClusterStatus,
  NodeHealth as DistributedNodeHealth,
  SessionLocation,
  SessionMigration,
  LoadBalancingStrategy as DistributedLoadBalancingStrategy,
  SessionMigrationPlan,
  DistributedSessionConfig,
  SessionSpawnResult,
} from './types';
