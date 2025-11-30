/**
 * Federation - Multi-Orchestrator Coordination
 *
 * Exports all federation-related classes and types for distributed
 * orchestrator coordination and task delegation.
 */

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
