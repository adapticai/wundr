/**
 * Federation Tools Module
 *
 * MCP tools for federation and distributed session management.
 * Enables orchestrators to coordinate across a distributed cluster.
 *
 * @module tools/federation
 */

// ============================================================================
// List Federated Orchestrators
// ============================================================================

export {
  listFederatedOrchestrators,
  listFederatedOrchestratorsInputSchema,
} from './list-orchestrators';

export type {
  ListFederatedOrchestratorsInput,
  FederatedOrchestrator,
  FederatedOrchestratorCapabilities,
  FederatedOrchestratorMetrics,
  ListFederatedOrchestratorsResponse,
} from './list-orchestrators';

// ============================================================================
// Delegate Task
// ============================================================================

export {
  delegateTask,
  delegateTaskInputSchema,
} from './delegate-task';

export type {
  DelegateTaskInput,
  DelegateTaskResponse,
  DelegationStatus,
} from './delegate-task';

// ============================================================================
// Get Delegation Status
// ============================================================================

export {
  getDelegationStatus,
  getDelegationStatusInputSchema,
} from './get-delegation-status';

export type {
  GetDelegationStatusInput,
  GetDelegationStatusResponse,
  DelegationStatusDetails,
  TaskResult,
  TaskExecutionLog,
} from './get-delegation-status';

// ============================================================================
// Get Cluster Status
// ============================================================================

export {
  getClusterStatus,
  getClusterStatusInputSchema,
} from './get-cluster-status';

export type {
  GetClusterStatusInput,
  GetClusterStatusResponse,
  ClusterNodeStatus,
  SessionInfo,
  ClusterMetrics,
} from './get-cluster-status';

// ============================================================================
// Migrate Session
// ============================================================================

export {
  migrateSession,
  migrateSessionInputSchema,
} from './migrate-session';

export type {
  MigrateSessionInput,
  MigrateSessionResponse,
  MigrationDetails,
  MigrationPhase,
  SessionState,
} from './migrate-session';

// ============================================================================
// Tool Collections
// ============================================================================

import { listFederatedOrchestrators, listFederatedOrchestratorsInputSchema } from './list-orchestrators';
import { delegateTask, delegateTaskInputSchema } from './delegate-task';
import { getDelegationStatus, getDelegationStatusInputSchema } from './get-delegation-status';
import { getClusterStatus, getClusterStatusInputSchema } from './get-cluster-status';
import { migrateSession, migrateSessionInputSchema } from './migrate-session';

/**
 * All federation tool handlers
 */
export const federationHandlers = {
  listFederatedOrchestrators,
  delegateTask,
  getDelegationStatus,
  getClusterStatus,
  migrateSession,
} as const;

/**
 * All federation input schemas
 */
export const federationSchemas = {
  listFederatedOrchestratorsInputSchema,
  delegateTaskInputSchema,
  getDelegationStatusInputSchema,
  getClusterStatusInputSchema,
  migrateSessionInputSchema,
} as const;

/**
 * Federation tool names for type safety
 */
export const FEDERATION_TOOL_NAMES = {
  LIST_FEDERATED_ORCHESTRATORS: 'list-federated-orchestrators',
  DELEGATE_TASK: 'delegate-task',
  GET_DELEGATION_STATUS: 'get-delegation-status',
  GET_CLUSTER_STATUS: 'get-cluster-status',
  MIGRATE_SESSION: 'migrate-session',
} as const;

/**
 * Federation tool descriptions for MCP registration
 */
export const FEDERATION_TOOL_DESCRIPTIONS = {
  [FEDERATION_TOOL_NAMES.LIST_FEDERATED_ORCHESTRATORS]:
    'List all federated orchestrators across the distributed cluster with filtering by region, capability, and status',
  [FEDERATION_TOOL_NAMES.DELEGATE_TASK]:
    'Delegate a task to another federated orchestrator for load balancing and capability-based routing',
  [FEDERATION_TOOL_NAMES.GET_DELEGATION_STATUS]:
    'Check the status of a delegated task across the federation with real-time progress updates',
  [FEDERATION_TOOL_NAMES.GET_CLUSTER_STATUS]:
    'Get distributed cluster health and status including nodes, sessions, and performance metrics',
  [FEDERATION_TOOL_NAMES.MIGRATE_SESSION]:
    'Migrate an active session to another node for load balancing or failure recovery',
} as const;
