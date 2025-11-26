/**
 * VP Coordination Service
 *
 * Handles cross-VP coordination including task delegation, collaboration,
 * handoffs, and conflict resolution.
 *
 * @module lib/services/vp-coordination-service
 */

import { prisma } from '@neolith/database';

import type { TaskPriority, Prisma } from '@prisma/client';

/**
 * Task delegation result
 */
export interface DelegationResult {
  success: boolean;
  taskId: string;
  fromVpId: string;
  toVpId: string;
  delegatedAt: Date;
  message?: string;
  error?: string;
}

/**
 * Collaboration request result
 */
export interface CollaborationResult {
  success: boolean;
  taskId: string;
  primaryVpId: string;
  collaboratorVpIds: string[];
  createdAt: Date;
  message?: string;
  error?: string;
}

/**
 * Task handoff result
 */
export interface HandoffResult {
  success: boolean;
  taskId: string;
  fromVpId: string;
  toVpId: string;
  context: Record<string, unknown>;
  handoffAt: Date;
  message?: string;
  error?: string;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  success: boolean;
  conflictType: string;
  involvedVpIds: string[];
  resolution: Record<string, unknown>;
  resolvedAt: Date;
  message?: string;
  error?: string;
}

/**
 * VP coordination metadata stored in task metadata
 */
export interface VPCoordinationMetadata {
  delegations?: Array<{
    fromVpId: string;
    toVpId: string;
    delegatedAt: string;
    note?: string;
  }>;
  collaborators?: Array<{
    vpId: string;
    role: string;
    addedAt: string;
  }>;
  handoffs?: Array<{
    fromVpId: string;
    toVpId: string;
    context: Record<string, unknown>;
    handoffAt: string;
  }>;
  conflicts?: Array<{
    type: string;
    vpIds: string[];
    resolution: Record<string, unknown>;
    resolvedAt: string;
  }>;
}

/**
 * Delegate a task from one VP to another
 *
 * @param fromVpId - ID of the VP delegating the task
 * @param toVpId - ID of the VP receiving the task
 * @param taskId - ID of the task to delegate
 * @param options - Optional delegation parameters
 * @returns Delegation result
 */
export async function delegateTask(
  fromVpId: string,
  toVpId: string,
  taskId: string,
  options?: {
    note?: string;
    priority?: TaskPriority;
    dueDate?: Date;
  },
): Promise<DelegationResult> {
  try {
    // Validate VPs exist and are in the same organization
    const [fromVP, toVP, task] = await Promise.all([
      prisma.vP.findUnique({
        where: { id: fromVpId },
        select: { id: true, organizationId: true, role: true },
      }),
      prisma.vP.findUnique({
        where: { id: toVpId },
        select: { id: true, organizationId: true, role: true },
      }),
      prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          vpId: true,
          workspaceId: true,
          status: true,
          metadata: true,
        },
      }),
    ]);

    if (!fromVP) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        delegatedAt: new Date(),
        error: 'Source VP not found',
      };
    }

    if (!toVP) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        delegatedAt: new Date(),
        error: 'Target VP not found',
      };
    }

    if (!task) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        delegatedAt: new Date(),
        error: 'Task not found',
      };
    }

    // Verify same organization
    if (fromVP.organizationId !== toVP.organizationId) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        delegatedAt: new Date(),
        error: 'VPs must be in the same organization',
      };
    }

    // Verify task belongs to source VP
    if (task.vpId !== fromVpId) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        delegatedAt: new Date(),
        error: 'Task does not belong to source VP',
      };
    }

    // Prepare delegation metadata
    const currentMetadata = (task.metadata as VPCoordinationMetadata) || {};
    const delegations = currentMetadata.delegations || [];

    delegations.push({
      fromVpId,
      toVpId,
      delegatedAt: new Date().toISOString(),
      note: options?.note,
    });

    const updatedMetadata: VPCoordinationMetadata = {
      ...currentMetadata,
      delegations,
    };

    // Update task with new VP and metadata
    await prisma.task.update({
      where: { id: taskId },
      data: {
        vpId: toVpId,
        ...(options?.priority && { priority: options.priority }),
        ...(options?.dueDate && { dueDate: options.dueDate }),
        metadata: updatedMetadata as Prisma.InputJsonValue,
      },
    });

    const delegatedAt = new Date();
    return {
      success: true,
      taskId,
      fromVpId,
      toVpId,
      delegatedAt,
      message: `Task successfully delegated from ${fromVP.role} to ${toVP.role}`,
    };
  } catch (error) {
    console.error('[delegateTask] Error:', error);
    return {
      success: false,
      taskId,
      fromVpId,
      toVpId,
      delegatedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Request collaboration on a task from multiple VPs
 *
 * @param vpId - Primary VP requesting collaboration
 * @param taskId - Task requiring collaboration
 * @param requiredVpIds - VPs needed for collaboration
 * @param options - Optional collaboration parameters
 * @returns Collaboration result
 */
export async function requestCollaboration(
  vpId: string,
  taskId: string,
  requiredVpIds: string[],
  options?: {
    roles?: Record<string, string>; // Map of vpId to role in collaboration
    note?: string;
  },
): Promise<CollaborationResult> {
  try {
    // Validate primary VP and task
    const [primaryVP, task, collaboratorVPs] = await Promise.all([
      prisma.vP.findUnique({
        where: { id: vpId },
        select: { id: true, organizationId: true, role: true },
      }),
      prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          vpId: true,
          workspaceId: true,
          metadata: true,
        },
      }),
      prisma.vP.findMany({
        where: { id: { in: requiredVpIds } },
        select: { id: true, organizationId: true, role: true },
      }),
    ]);

    if (!primaryVP) {
      return {
        success: false,
        taskId,
        primaryVpId: vpId,
        collaboratorVpIds: requiredVpIds,
        createdAt: new Date(),
        error: 'Primary VP not found',
      };
    }

    if (!task) {
      return {
        success: false,
        taskId,
        primaryVpId: vpId,
        collaboratorVpIds: requiredVpIds,
        createdAt: new Date(),
        error: 'Task not found',
      };
    }

    // Verify task belongs to primary VP
    if (task.vpId !== vpId) {
      return {
        success: false,
        taskId,
        primaryVpId: vpId,
        collaboratorVpIds: requiredVpIds,
        createdAt: new Date(),
        error: 'Task does not belong to requesting VP',
      };
    }

    // Verify all collaborators exist and are in same organization
    if (collaboratorVPs.length !== requiredVpIds.length) {
      return {
        success: false,
        taskId,
        primaryVpId: vpId,
        collaboratorVpIds: requiredVpIds,
        createdAt: new Date(),
        error: 'Some required VPs not found',
      };
    }

    const differentOrg = collaboratorVPs.some(
      (vp) => vp.organizationId !== primaryVP.organizationId,
    );
    if (differentOrg) {
      return {
        success: false,
        taskId,
        primaryVpId: vpId,
        collaboratorVpIds: requiredVpIds,
        createdAt: new Date(),
        error: 'All VPs must be in the same organization',
      };
    }

    // Update task metadata with collaborators
    const currentMetadata = (task.metadata as VPCoordinationMetadata) || {};
    const collaborators = currentMetadata.collaborators || [];

    // Add new collaborators
    const addedAt = new Date().toISOString();
    requiredVpIds.forEach((collaboratorVpId) => {
      collaborators.push({
        vpId: collaboratorVpId,
        role: options?.roles?.[collaboratorVpId] || 'collaborator',
        addedAt,
      });
    });

    const updatedMetadata: VPCoordinationMetadata = {
      ...currentMetadata,
      collaborators,
    };

    await prisma.task.update({
      where: { id: taskId },
      data: { metadata: updatedMetadata as Prisma.InputJsonValue },
    });

    const createdAt = new Date();
    return {
      success: true,
      taskId,
      primaryVpId: vpId,
      collaboratorVpIds: requiredVpIds,
      createdAt,
      message: `Collaboration request sent to ${requiredVpIds.length} VP(s)`,
    };
  } catch (error) {
    console.error('[requestCollaboration] Error:', error);
    return {
      success: false,
      taskId,
      primaryVpId: vpId,
      collaboratorVpIds: requiredVpIds,
      createdAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Handoff a task from one VP to another with context
 *
 * @param fromVpId - VP handing off the task
 * @param toVpId - VP receiving the task
 * @param taskId - Task to handoff
 * @param context - Context and state to transfer
 * @returns Handoff result
 */
export async function handoffTask(
  fromVpId: string,
  toVpId: string,
  taskId: string,
  context: Record<string, unknown>,
): Promise<HandoffResult> {
  try {
    // Validate VPs and task
    const [fromVP, toVP, task] = await Promise.all([
      prisma.vP.findUnique({
        where: { id: fromVpId },
        select: { id: true, organizationId: true, role: true },
      }),
      prisma.vP.findUnique({
        where: { id: toVpId },
        select: { id: true, organizationId: true, role: true },
      }),
      prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          vpId: true,
          status: true,
          metadata: true,
        },
      }),
    ]);

    if (!fromVP || !toVP) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        context,
        handoffAt: new Date(),
        error: 'One or both VPs not found',
      };
    }

    if (!task) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        context,
        handoffAt: new Date(),
        error: 'Task not found',
      };
    }

    // Verify same organization
    if (fromVP.organizationId !== toVP.organizationId) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        context,
        handoffAt: new Date(),
        error: 'VPs must be in the same organization',
      };
    }

    // Verify task ownership
    if (task.vpId !== fromVpId) {
      return {
        success: false,
        taskId,
        fromVpId,
        toVpId,
        context,
        handoffAt: new Date(),
        error: 'Task does not belong to source VP',
      };
    }

    // Store handoff in metadata
    const currentMetadata = (task.metadata as VPCoordinationMetadata) || {};
    const handoffs = currentMetadata.handoffs || [];

    handoffs.push({
      fromVpId,
      toVpId,
      context,
      handoffAt: new Date().toISOString(),
    });

    const updatedMetadata: VPCoordinationMetadata = {
      ...currentMetadata,
      handoffs,
    };

    // Transfer task ownership
    await prisma.task.update({
      where: { id: taskId },
      data: {
        vpId: toVpId,
        metadata: updatedMetadata as Prisma.InputJsonValue,
      },
    });

    const handoffAt = new Date();
    return {
      success: true,
      taskId,
      fromVpId,
      toVpId,
      context,
      handoffAt,
      message: `Task handed off from ${fromVP.role} to ${toVP.role}`,
    };
  } catch (error) {
    console.error('[handoffTask] Error:', error);
    return {
      success: false,
      taskId,
      fromVpId,
      toVpId,
      context,
      handoffAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Resolve a conflict between VPs
 *
 * @param vpIds - VPs involved in the conflict
 * @param conflictType - Type of conflict
 * @param resolution - Resolution details
 * @param options - Optional parameters
 * @returns Conflict resolution result
 */
export async function resolveConflict(
  vpIds: string[],
  conflictType: string,
  resolution: Record<string, unknown>,
  options?: {
    taskId?: string;
    workspaceId?: string;
    note?: string;
  },
): Promise<ConflictResolutionResult> {
  try {
    // Validate all VPs exist and are in same organization
    const vps = await prisma.vP.findMany({
      where: { id: { in: vpIds } },
      select: { id: true, organizationId: true, role: true },
    });

    if (vps.length !== vpIds.length) {
      return {
        success: false,
        conflictType,
        involvedVpIds: vpIds,
        resolution,
        resolvedAt: new Date(),
        error: 'Some VPs not found',
      };
    }

    // Verify same organization
    const orgIds = new Set(vps.map((vp) => vp.organizationId));
    if (orgIds.size > 1) {
      return {
        success: false,
        conflictType,
        involvedVpIds: vpIds,
        resolution,
        resolvedAt: new Date(),
        error: 'All VPs must be in the same organization',
      };
    }

    // If task-specific conflict, update task metadata
    if (options?.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: options.taskId },
        select: { id: true, metadata: true },
      });

      if (task) {
        const currentMetadata = (task.metadata as VPCoordinationMetadata) || {};
        const conflicts = currentMetadata.conflicts || [];

        conflicts.push({
          type: conflictType,
          vpIds,
          resolution,
          resolvedAt: new Date().toISOString(),
        });

        const updatedMetadata: VPCoordinationMetadata = {
          ...currentMetadata,
          conflicts,
        };

        await prisma.task.update({
          where: { id: options.taskId },
          data: { metadata: updatedMetadata as Prisma.InputJsonValue },
        });
      }
    }

    // TODO: Store conflict resolution in a dedicated table if needed
    // For now, we're storing it in task metadata or just returning the result

    const resolvedAt = new Date();
    return {
      success: true,
      conflictType,
      involvedVpIds: vpIds,
      resolution,
      resolvedAt,
      message: `Conflict of type '${conflictType}' resolved for ${vpIds.length} VP(s)`,
    };
  } catch (error) {
    console.error('[resolveConflict] Error:', error);
    return {
      success: false,
      conflictType,
      involvedVpIds: vpIds,
      resolution,
      resolvedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get coordination history for a task
 *
 * @param taskId - Task ID
 * @returns Coordination metadata
 */
export async function getTaskCoordinationHistory(
  taskId: string,
): Promise<VPCoordinationMetadata | null> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { metadata: true },
    });

    if (!task) {
      return null;
    }

    return (task.metadata as VPCoordinationMetadata) || null;
  } catch (error) {
    console.error('[getTaskCoordinationHistory] Error:', error);
    return null;
  }
}

/**
 * Get all tasks delegated to a VP
 *
 * @param vpId - VP ID
 * @returns List of delegated tasks
 */
export async function getDelegatedTasks(vpId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        vpId,
        metadata: {
          path: ['delegations'],
          not: { equals: null },
        },
      },
      include: {
        vp: {
          select: { id: true, role: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks;
  } catch (error) {
    console.error('[getDelegatedTasks] Error:', error);
    return [];
  }
}

/**
 * Get all tasks where a VP is a collaborator
 *
 * @param vpId - VP ID
 * @returns List of collaborative tasks
 */
export async function getCollaborativeTasks(vpId: string) {
  try {
    // Find tasks where VP is listed as collaborator in metadata
    const allTasks = await prisma.task.findMany({
      where: {
        metadata: {
          path: ['collaborators'],
          not: { equals: null },
        },
      },
      include: {
        vp: {
          select: { id: true, role: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
      },
    });

    // Filter tasks where this VP is a collaborator
    const collaborativeTasks = allTasks.filter((task) => {
      const metadata = task.metadata as VPCoordinationMetadata;
      return metadata.collaborators?.some((c) => c.vpId === vpId);
    });

    return collaborativeTasks;
  } catch (error) {
    console.error('[getCollaborativeTasks] Error:', error);
    return [];
  }
}

/**
 * Consensus vote result
 */
export interface ConsensusVoteResult {
  success: boolean;
  consensusId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  votes: Array<{
    vpId: string;
    vote: string;
    votedAt: string;
  }>;
  message?: string;
  error?: string;
}

/**
 * Initiate a VP consensus vote
 *
 * @param vps - Array of VP IDs participating in consensus
 * @param proposal - Proposal details
 * @param votingRules - Voting rules and thresholds
 * @returns Consensus initialization result
 */
export async function initiateConsensus(
  vps: string[],
  _proposal: {
    title: string;
    description?: string;
    type: string;
    taskId?: string;
  },
  votingRules: {
    threshold: number;
    deadline?: Date;
  },
): Promise<{ success: boolean; consensusId: string; message?: string; error?: string }> {
  try {
    // Validate VPs exist
    const vpRecords = await prisma.vP.findMany({
      where: { id: { in: vps } },
      select: { id: true, organizationId: true },
    });

    if (vpRecords.length !== vps.length) {
      return {
        success: false,
        consensusId: '',
        error: 'Some VPs not found',
      };
    }

    // Verify all VPs are in same organization
    const orgIds = new Set(vpRecords.map((vp) => vp.organizationId));
    if (orgIds.size > 1) {
      return {
        success: false,
        consensusId: '',
        error: 'All VPs must be in the same organization',
      };
    }

    // Generate consensus ID
    const consensusId = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Consensus tracking would be stored in workspace metadata or dedicated table
    // For now, returning successful initialization
    return {
      success: true,
      consensusId,
      message: `Consensus initiated for ${vps.length} VPs with ${votingRules.threshold}% threshold`,
    };
  } catch (error) {
    console.error('[initiateConsensus] Error:', error);
    return {
      success: false,
      consensusId: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Process a VP vote on a consensus item
 *
 * @param consensusId - Consensus ID
 * @param vpId - VP ID casting the vote
 * @param vote - Vote decision ('APPROVE', 'REJECT', 'ABSTAIN')
 * @returns Vote processing result
 */
export async function processVote(
  consensusId: string,
  vpId: string,
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN',
): Promise<ConsensusVoteResult> {
  try {
    // Verify VP exists
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      select: { id: true },
    });

    if (!vp) {
      return {
        success: false,
        consensusId,
        status: 'PENDING',
        votes: [],
        error: 'VP not found',
      };
    }

    // In production, this would update the consensus record
    // and calculate if threshold is met
    const votedAt = new Date().toISOString();

    return {
      success: true,
      consensusId,
      status: 'PENDING',
      votes: [{ vpId, vote, votedAt }],
      message: `Vote '${vote}' recorded for VP ${vpId}`,
    };
  } catch (error) {
    console.error('[processVote] Error:', error);
    return {
      success: false,
      consensusId,
      status: 'PENDING',
      votes: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Execute a task handoff (wrapper for handoffTask)
 *
 * @param fromVpId - Source VP ID
 * @param toVpId - Target VP ID
 * @param taskId - Task ID to handoff
 * @returns Handoff result
 */
export async function executeHandoff(
  fromVpId: string,
  toVpId: string,
  taskId: string,
): Promise<HandoffResult> {
  return handoffTask(fromVpId, toVpId, taskId, {});
}

/**
 * Create a delegation (wrapper for delegateTask)
 *
 * @param fromVp - Source VP ID
 * @param toVp - Target VP ID
 * @param task - Task ID to delegate
 * @returns Delegation result
 */
export async function createDelegation(
  fromVp: string,
  toVp: string,
  task: string,
): Promise<DelegationResult> {
  return delegateTask(fromVp, toVp, task);
}

/**
 * Request collaboration (wrapper for requestCollaboration)
 *
 * @param initiator - Initiating VP ID
 * @param partner - Partner VP IDs
 * @param context - Collaboration context including taskId
 * @returns Collaboration result
 */
export async function requestCollaborationWrapper(
  initiator: string,
  partner: string[],
  context: { taskId: string; note?: string },
): Promise<CollaborationResult> {
  return requestCollaboration(initiator, context.taskId, partner, {
    note: context.note,
  });
}
