/**
 * Orchestrator Coordination Validation Schemas
 * @module lib/validations/orchestrator-coordination
 */

import { z } from 'zod';

export const ORCHESTRATOR_COORDINATION_ERROR_CODES = {
  INVALID_TOPOLOGY: 'COORDINATION_INVALID_TOPOLOGY',
  AGENT_UNAVAILABLE: 'COORDINATION_AGENT_UNAVAILABLE',
  DEADLOCK_DETECTED: 'COORDINATION_DEADLOCK_DETECTED',
  SYNC_FAILED: 'COORDINATION_SYNC_FAILED',
  CONFLICT_DETECTED: 'COORDINATION_CONFLICT_DETECTED',
  UNAUTHORIZED: 'COORDINATION_UNAUTHORIZED',
  FORBIDDEN: 'COORDINATION_FORBIDDEN',
  VALIDATION_ERROR: 'COORDINATION_VALIDATION_ERROR',
  INTERNAL_ERROR: 'COORDINATION_INTERNAL_ERROR',
  NOT_FOUND: 'COORDINATION_NOT_FOUND',
  ORCHESTRATOR_NOT_FOUND: 'COORDINATION_ORCHESTRATOR_NOT_FOUND',
  TASK_NOT_FOUND: 'COORDINATION_TASK_NOT_FOUND',
  DIFFERENT_ORGANIZATION: 'COORDINATION_DIFFERENT_ORGANIZATION',
  INVALID_OWNERSHIP: 'COORDINATION_INVALID_OWNERSHIP',
} as const;

export type OrchestratorCoordinationErrorCode =
  (typeof ORCHESTRATOR_COORDINATION_ERROR_CODES)[keyof typeof ORCHESTRATOR_COORDINATION_ERROR_CODES];

export const coordinationStrategySchema = z.enum([
  'broadcast',
  'round_robin',
  'priority',
  'load_balanced',
  'consensus',
]);

export const coordinationMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'response', 'broadcast', 'sync', 'heartbeat']),
  senderId: z.string(),
  recipientId: z.string().optional(),
  payload: z.record(z.unknown()),
  priority: z.number().min(0).max(10),
  timestamp: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export const agentRegistrationSchema = z.object({
  agentId: z.string(),
  type: z.string(),
  capabilities: z.array(z.string()),
  status: z.enum(['available', 'busy', 'offline']),
  metadata: z.record(z.unknown()).optional(),
});

export const coordinationLockSchema = z.object({
  resourceId: z.string(),
  ownerId: z.string(),
  expiresAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const consensusRequestSchema = z.object({
  proposalId: z.string(),
  proposerId: z.string(),
  proposal: z.record(z.unknown()),
  voters: z.array(z.string()),
  quorum: z.number().min(0).max(1),
  timeout: z.number().positive(),
});

export const consensusVoteSchema = z.object({
  proposalId: z.string(),
  voterId: z.string(),
  vote: z.enum(['approve', 'reject', 'abstain']),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const collaborationRequestSchema = z.object({
  requestId: z.string().optional(),
  requesterId: z.string().optional(),
  targetAgentId: z.string().optional(),
  taskId: z.string(),
  requiredOrchestratorIds: z.array(z.string()).min(1),
  roles: z.record(z.string()).optional(),
  collaborationType: z
    .enum(['delegate', 'handoff', 'assist', 'consult'])
    .optional(),
  payload: z.record(z.unknown()).optional(),
  priority: z.number().min(0).max(10).optional(),
  note: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export const conflictResolutionSchema = z.object({
  conflictId: z.string().optional(),
  orchestratorIds: z.array(z.string()).min(2),
  conflictType: z.enum([
    'resource',
    'state',
    'priority',
    'dependency',
    'priority_conflict',
  ]),
  involvedAgents: z.array(z.string()).min(2).optional(),
  resolutionStrategy: z
    .enum(['merge', 'override', 'arbitrate', 'manual'])
    .optional(),
  resolution: z.record(z.unknown()).optional(),
  resolvedBy: z.string().optional(),
  taskId: z.string().optional(),
  workspaceId: z.string().optional(),
  note: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export const delegateTaskSchema = z.object({
  taskId: z.string(),
  fromAgentId: z.string().optional(),
  toOrchestratorId: z.string(),
  toAgentId: z.string().optional(),
  task: z.record(z.unknown()).optional(),
  note: z.string().optional(),
  reason: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
  deadline: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
});

export const handoffTaskSchema = z.object({
  taskId: z.string(),
  fromAgentId: z.string().optional(),
  toOrchestratorId: z.string(),
  toAgentId: z.string().optional(),
  task: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
  priority: z.number().min(0).max(10).optional(),
  timestamp: z.string().datetime().optional(),
});

export const delegationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  delegatedAt: z.union([z.string().datetime(), z.date()]),
  taskId: z.string(),
  fromOrchestratorId: z.string(),
  toOrchestratorId: z.string(),
  message: z.string().optional(),
});

export const collaboratorMemberSchema = z.object({
  orchestratorId: z.string(),
  role: z.string().optional(),
  addedAt: z.union([z.string().datetime(), z.date()]),
  status: z
    .enum(['pending', 'accepted', 'active', 'completed', 'rejected'])
    .optional(),
});

export const collaborationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  requestId: z.string().optional(),
  taskId: z.string().optional(),
  collaborators: z.array(collaboratorMemberSchema).optional(),
  createdAt: z.union([z.string().datetime(), z.date()]),
  status: z
    .enum(['pending', 'accepted', 'rejected', 'active', 'completed'])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const handoffResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  taskId: z.string().optional(),
  fromOrchestratorId: z.string().optional(),
  toOrchestratorId: z.string().optional(),
  newOwner: z.string().optional(),
  handoffAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  context: z.record(z.unknown()).optional(),
  message: z.string().optional(),
});

export const conflictResolutionResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  conflictId: z.string().optional(),
  resolved: z.boolean(),
  resolution: z.string().optional(),
  winner: z.string().optional(),
  resolvedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  resolvedBy: z.string().optional(),
});

// Type aliases inferred from schemas for API route usage
export type CollaborationRequestInput = z.infer<
  typeof collaborationRequestSchema
>;
export type ConflictResolutionInput = z.infer<typeof conflictResolutionSchema>;
export type DelegateTaskInput = z.infer<typeof delegateTaskSchema>;
export type HandoffTaskInput = z.infer<typeof handoffTaskSchema>;
export type DelegationResponse = z.infer<typeof delegationResponseSchema>;
export type CollaboratorMember = z.infer<typeof collaboratorMemberSchema>;
export type CollaborationResponse = z.infer<typeof collaborationResponseSchema>;
export type HandoffResponse = z.infer<typeof handoffResponseSchema>;
export type ConflictResolutionResponse = z.infer<
  typeof conflictResolutionResponseSchema
>;
export type CoordinationMessage = z.infer<typeof coordinationMessageSchema>;
export type AgentRegistration = z.infer<typeof agentRegistrationSchema>;
export type CoordinationLock = z.infer<typeof coordinationLockSchema>;
export type ConsensusRequest = z.infer<typeof consensusRequestSchema>;
export type ConsensusVote = z.infer<typeof consensusVoteSchema>;

export const COORDINATION_ERROR_CODES = {
  INVALID_COORDINATION_MESSAGE: 'COORDINATION_INVALID_MESSAGE',
  AGENT_NOT_REGISTERED: 'COORDINATION_AGENT_NOT_REGISTERED',
  LOCK_ACQUISITION_FAILED: 'COORDINATION_LOCK_FAILED',
  CONSENSUS_TIMEOUT: 'COORDINATION_CONSENSUS_TIMEOUT',
  COLLABORATION_FAILED: 'COORDINATION_COLLABORATION_FAILED',
  CONFLICT_UNRESOLVED: 'COORDINATION_CONFLICT_UNRESOLVED',
  DELEGATION_FAILED: 'COORDINATION_DELEGATION_FAILED',
  HANDOFF_FAILED: 'COORDINATION_HANDOFF_FAILED',
  ...ORCHESTRATOR_COORDINATION_ERROR_CODES,
} as const;

export type CoordinationErrorCode =
  (typeof COORDINATION_ERROR_CODES)[keyof typeof COORDINATION_ERROR_CODES];

export function createCoordinationErrorResponse(
  message: string,
  code: CoordinationErrorCode,
  details?: Record<string, unknown>
) {
  return {
    success: false,
    error: {
      code,
      message,
      details: details || {},
      timestamp: new Date().toISOString(),
    },
  };
}
