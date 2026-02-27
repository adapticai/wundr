/**
 * Orchestrator Coordination Service
 * Manages coordination between multiple orchestrators and workflows
 * @module lib/services/orchestrator-coordination-service
 */

import { prisma } from '@neolith/database';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Metadata for orchestrator coordination tasks
 */
export interface OrchestratorCoordinationMetadata {
  collaborators?: Array<{
    orchestratorId: string;
    role?: string;
    status?: 'pending' | 'accepted' | 'active' | 'completed' | 'rejected';
    addedAt: string; // Changed from joinedAt to match schema
  }>;
  delegations?: Array<{
    fromOrchestratorId: string;
    toOrchestratorId: string;
    delegatedAt: string;
    status?: 'pending' | 'accepted' | 'completed' | 'rejected';
    priority?: string;
    note?: string;
  }>;
  handoffs?: Array<{
    fromOrchestratorId: string;
    toOrchestratorId: string;
    handedOffAt: string;
    context?: Record<string, unknown>;
    notes?: string;
  }>;
  coordinationType?:
    | 'collaboration'
    | 'delegation'
    | 'handoff'
    | 'multi-orchestrator';
  [key: string]: unknown;
}

/**
 * Metadata for VP (Virtual Person) coordination tasks
 * Alias for OrchestratorCoordinationMetadata for backward compatibility
 */
export type VPCoordinationMetadata = OrchestratorCoordinationMetadata;

// ============================================================================
// COORDINATION FUNCTIONS
// ============================================================================

/**
 * Coordinate orchestrator execution
 * Queries available orchestrators and assigns task to the least-loaded one.
 */
export async function coordinateExecution(
  orchestratorIds: string[],
  coordinationStrategy: any
): Promise<any> {
  try {
    // Fetch the requested orchestrators with their current task counts
    const orchestrators = await prisma.orchestrator.findMany({
      where: { id: { in: orchestratorIds } },
      select: {
        id: true,
        status: true,
        role: true,
        discipline: true,
        _count: { select: { tasks: true } },
      },
    });

    if (orchestrators.length === 0) {
      return null;
    }

    // Sort by task count ascending to find least-loaded orchestrator
    const sorted = [...orchestrators].sort(
      (a, b) => a._count.tasks - b._count.tasks
    );
    const assigned = sorted[0];

    // Log the coordination assignment in the audit log
    await (prisma as any).auditLog.create({
      data: {
        actorId: assigned.id,
        actorType: 'orchestrator',
        action: 'coordinate_execution',
        resourceType: 'orchestrator',
        resourceId: assigned.id,
        severity: 'info',
        metadata: {
          orchestratorIds,
          strategy: coordinationStrategy,
          assignedTo: assigned.id,
          workloadAtAssignment: assigned._count.tasks,
        },
      },
    });

    return {
      assignedOrchestratorId: assigned.id,
      orchestratorIds,
      strategy: coordinationStrategy,
      workloads: orchestrators.map(o => ({
        orchestratorId: o.id,
        taskCount: o._count.tasks,
        status: o.status,
      })),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Synchronize orchestrator states
 * Stores a snapshot of each orchestrator's current state into memory records.
 */
export async function synchronizeStates(
  orchestratorIds: string[]
): Promise<void> {
  try {
    const orchestrators = await prisma.orchestrator.findMany({
      where: { id: { in: orchestratorIds } },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
    });

    // Write a synchronization memory entry for each orchestrator
    await Promise.all(
      orchestrators.map(orchestrator =>
        prisma.orchestratorMemory.create({
          data: {
            orchestratorId: orchestrator.id,
            memoryType: 'state_sync',
            content: JSON.stringify({
              status: orchestrator.status,
              taskCount: orchestrator._count.tasks,
              syncedAt: new Date().toISOString(),
            }),
            importance: 0.6,
            metadata: {
              syncGroup: orchestratorIds,
              syncedAt: new Date().toISOString(),
            },
          },
        })
      )
    );
  } catch {
    // Synchronization is best-effort; swallow errors to avoid disrupting callers
  }
}

/**
 * Manage orchestrator dependencies
 * Returns the dependency graph for tasks owned by the given orchestrator.
 */
export async function manageDependencies(
  orchestratorId: string,
  dependencies: any[]
): Promise<any> {
  try {
    // Fetch all tasks for this orchestrator that have declared dependencies
    const tasks = await prisma.task.findMany({
      where: {
        orchestratorId,
        NOT: { dependsOn: { equals: [] } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dependsOn: true,
        priority: true,
      },
    });

    // Build a map of task IDs referenced as dependencies
    const allDependencyIds = tasks.flatMap(t => t.dependsOn);
    const dependencyTasks =
      allDependencyIds.length > 0
        ? await prisma.task.findMany({
            where: { id: { in: allDependencyIds } },
            select: { id: true, title: true, status: true },
          })
        : [];

    const depMap = new Map(dependencyTasks.map(t => [t.id, t]));

    return {
      orchestratorId,
      externalDependencies: dependencies,
      taskDependencies: tasks.map(task => ({
        taskId: task.id,
        taskTitle: task.title,
        taskStatus: task.status,
        dependsOn: task.dependsOn.map(
          depId => depMap.get(depId) ?? { id: depId }
        ),
      })),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create orchestrator chain
 * Creates an execution chain record with ordered orchestrator references.
 */
export async function createOrchestratorChain(
  orchestratorIds: string[],
  chainConfig: any
): Promise<any> {
  try {
    const chainId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    // Verify all orchestrators exist
    const orchestrators = await prisma.orchestrator.findMany({
      where: { id: { in: orchestratorIds } },
      select: { id: true, role: true, discipline: true, status: true },
    });

    // Record the chain creation in the audit log
    await (prisma as any).auditLog.create({
      data: {
        actorId: orchestratorIds[0] ?? 'system',
        actorType: 'orchestrator',
        action: 'create_chain',
        resourceType: 'orchestrator_chain',
        resourceId: chainId,
        severity: 'info',
        metadata: {
          chainId,
          orchestratorIds,
          config: chainConfig,
          createdAt,
        },
      },
    });

    return {
      chainId,
      orchestratorIds,
      config: chainConfig,
      createdAt,
      steps: orchestrators.map((o, index) => ({
        order: index + 1,
        orchestratorId: o.id,
        role: o.role,
        discipline: o.discipline,
        status: o.status,
      })),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Handle orchestrator conflict
 * Logs the conflict and applies last-write-wins or priority-based resolution.
 */
export async function handleConflict(
  conflictData: any,
  resolutionStrategy: string
): Promise<any> {
  try {
    const conflictId = `conflict_${Date.now()}`;
    const resolvedAt = new Date().toISOString();

    // Determine winner based on strategy
    let winner: string | undefined;
    if (
      resolutionStrategy === 'priority' &&
      Array.isArray(conflictData?.orchestratorIds)
    ) {
      // Priority: first orchestrator in list wins
      winner = conflictData.orchestratorIds[0];
    } else if (Array.isArray(conflictData?.orchestratorIds)) {
      // Last-write-wins: last orchestrator in list wins
      winner =
        conflictData.orchestratorIds[conflictData.orchestratorIds.length - 1];
    }

    // Log conflict resolution in the audit trail
    await (prisma as any).auditLog.create({
      data: {
        actorId: winner ?? 'system',
        actorType: 'orchestrator',
        action: 'handle_conflict',
        resourceType: 'orchestrator_conflict',
        resourceId: conflictId,
        severity: 'warn',
        metadata: {
          conflictId,
          conflictData,
          resolutionStrategy,
          winner,
          resolvedAt,
        },
      },
    });

    return {
      conflictId,
      resolved: true,
      strategy: resolutionStrategy,
      winner,
      resolvedAt,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Balance orchestrator load
 * Queries orchestrator workloads and returns the balanced assignment ranking.
 */
export async function balanceLoad(
  orchestratorIds: string[],
  loadBalancingConfig: any
): Promise<any> {
  try {
    const orchestrators = await prisma.orchestrator.findMany({
      where: { id: { in: orchestratorIds } },
      select: {
        id: true,
        status: true,
        role: true,
        _count: { select: { tasks: true } },
      },
    });

    // Sort by task count ascending for round-robin fairness
    const ranked = [...orchestrators]
      .sort((a, b) => a._count.tasks - b._count.tasks)
      .map((o, index) => ({
        rank: index + 1,
        orchestratorId: o.id,
        role: o.role,
        status: o.status,
        activeTasks: o._count.tasks,
      }));

    return {
      config: loadBalancingConfig,
      balancedAssignment: ranked,
      recommendedOrchestratorId: ranked[0]?.orchestratorId ?? null,
    };
  } catch (error) {
    return null;
  }
}

// ============================================================================
// TASK COORDINATION
// ============================================================================

/**
 * Result type for task delegation operation
 */
export interface DelegateTaskResult {
  success: boolean;
  error?: string;
  delegatedAt: Date;
  taskId: string;
  fromOrchestratorId: string;
  toOrchestratorId: string;
  message?: string;
}

/**
 * Delegate a task to another orchestrator
 */
export async function delegateTask(
  sourceOrchestrator: string,
  targetOrchestrator: string,
  taskId: string,
  options?: {
    note?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate?: Date;
  }
): Promise<DelegateTaskResult> {
  const delegatedAt = new Date();

  try {
    // Fetch the task to check it exists and get its current metadata
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, metadata: true, orchestratorId: true },
    });

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
        delegatedAt,
        taskId,
        fromOrchestratorId: sourceOrchestrator,
        toOrchestratorId: targetOrchestrator,
      };
    }

    const existingMetadata =
      (task.metadata as OrchestratorCoordinationMetadata) ?? {};
    const delegations = existingMetadata.delegations ?? [];

    const updatedMetadata: OrchestratorCoordinationMetadata = {
      ...existingMetadata,
      coordinationType: 'delegation',
      delegations: [
        ...delegations,
        {
          fromOrchestratorId: sourceOrchestrator,
          toOrchestratorId: targetOrchestrator,
          delegatedAt: delegatedAt.toISOString(),
          status: 'pending' as const,
          priority: options?.priority,
          note: options?.note,
        },
      ],
    };

    // Update the task: reassign orchestrator and append delegation record
    await prisma.task.update({
      where: { id: taskId },
      data: {
        orchestratorId: targetOrchestrator,
        ...(options?.priority && { priority: options.priority }),
        ...(options?.dueDate && { dueDate: options.dueDate }),
        metadata: updatedMetadata as never,
      },
    });

    // Create a TaskDelegation record in the federation table
    await (prisma as any).taskDelegation.create({
      data: {
        fromOrchestratorId: sourceOrchestrator,
        toOrchestratorId: targetOrchestrator,
        taskType: 'task_delegation',
        taskPayload: {
          taskId,
          note: options?.note,
          priority: options?.priority,
        },
        context: { taskId },
        status: 'PENDING',
      },
    });

    return {
      success: true,
      delegatedAt,
      taskId,
      fromOrchestratorId: sourceOrchestrator,
      toOrchestratorId: targetOrchestrator,
      message: 'Task delegated successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delegation failed',
      delegatedAt,
      taskId,
      fromOrchestratorId: sourceOrchestrator,
      toOrchestratorId: targetOrchestrator,
    };
  }
}

/**
 * Result type for task handoff operation
 */
export interface HandoffTaskResult {
  success: boolean;
  newOwner: string;
  error?: string;
  taskId?: string;
  fromOrchestratorId?: string;
  toOrchestratorId?: string;
  context?: Record<string, unknown>;
  handoffAt?: Date;
  message?: string;
}

/**
 * Hand off a task to another orchestrator (transfer ownership)
 */
export async function handoffTask(
  sourceOrchestrator: string,
  targetOrchestrator: string,
  taskId: string,
  handoffContext?: Record<string, unknown>
): Promise<HandoffTaskResult> {
  const handoffAt = new Date();

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, metadata: true, orchestratorId: true },
    });

    if (!task) {
      return {
        success: false,
        newOwner: targetOrchestrator,
        error: 'Task not found',
        taskId,
        fromOrchestratorId: sourceOrchestrator,
        toOrchestratorId: targetOrchestrator,
        handoffAt,
      };
    }

    const existingMetadata =
      (task.metadata as OrchestratorCoordinationMetadata) ?? {};
    const handoffs = existingMetadata.handoffs ?? [];

    const updatedMetadata: OrchestratorCoordinationMetadata = {
      ...existingMetadata,
      coordinationType: 'handoff',
      handoffs: [
        ...handoffs,
        {
          fromOrchestratorId: sourceOrchestrator,
          toOrchestratorId: targetOrchestrator,
          handedOffAt: handoffAt.toISOString(),
          context: handoffContext,
        },
      ],
    };

    // Transfer ownership by updating the orchestratorId on the task
    await prisma.task.update({
      where: { id: taskId },
      data: {
        orchestratorId: targetOrchestrator,
        metadata: updatedMetadata as never,
      },
    });

    // Persist handoff state as an orchestrator memory on the target
    await prisma.orchestratorMemory.create({
      data: {
        orchestratorId: targetOrchestrator,
        memoryType: 'task_handoff',
        content: JSON.stringify({
          taskId,
          fromOrchestratorId: sourceOrchestrator,
          handedOffAt: handoffAt.toISOString(),
          context: handoffContext,
        }),
        importance: 0.7,
        metadata: {
          taskId,
          fromOrchestratorId: sourceOrchestrator,
          handoffContext: (handoffContext ?? null) as never,
        } as never,
      },
    });

    return {
      success: true,
      newOwner: targetOrchestrator,
      taskId,
      fromOrchestratorId: sourceOrchestrator,
      toOrchestratorId: targetOrchestrator,
      context: handoffContext,
      handoffAt,
      message: 'Task handed off successfully',
    };
  } catch (error) {
    return {
      success: false,
      newOwner: targetOrchestrator,
      error: error instanceof Error ? error.message : 'Handoff failed',
      taskId,
      fromOrchestratorId: sourceOrchestrator,
      toOrchestratorId: targetOrchestrator,
      handoffAt,
    };
  }
}

/**
 * Result type for collaboration request operation
 */
export interface CollaborationRequestResult {
  success: boolean;
  error?: string;
  requestId?: string;
  taskId?: string;
  collaborators?: Array<{
    orchestratorId: string;
    role?: string;
    addedAt: string;
    status?: 'pending' | 'accepted' | 'active' | 'completed' | 'rejected';
  }>;
  createdAt: Date;
  status?: 'pending' | 'accepted' | 'rejected' | 'active' | 'completed';
  metadata?: Record<string, unknown>;
}

/**
 * Request collaboration from another orchestrator
 * Signature 1: (requestingOrchestrator, targetOrchestrator, collaborationRequest)
 */
export async function requestCollaboration(
  requestingOrchestrator: string,
  targetOrchestrator: string,
  collaborationRequest: {
    taskId: string;
    type: 'review' | 'assist' | 'parallel';
    context?: Record<string, unknown>;
  }
): Promise<CollaborationRequestResult>;

/**
 * Request collaboration from multiple orchestrators
 * Signature 2: (requestingOrchestrator, taskId, requiredOrchestratorIds, options)
 */
export async function requestCollaboration(
  requestingOrchestrator: string,
  taskId: string,
  requiredOrchestratorIds: string[],
  options?: {
    roles?: Record<string, string>;
    note?: string;
  }
): Promise<CollaborationRequestResult>;

/**
 * Implementation
 */
export async function requestCollaboration(
  requestingOrchestrator: string,
  taskIdOrTargetOrchestrator: string,
  requiredOrchestratorIdsOrCollaborationRequest:
    | string[]
    | {
        taskId: string;
        type: 'review' | 'assist' | 'parallel';
        context?: Record<string, unknown>;
      },
  options?: {
    roles?: Record<string, string>;
    note?: string;
  }
): Promise<CollaborationRequestResult> {
  const createdAt = new Date();

  // Determine which signature was used
  if (Array.isArray(requiredOrchestratorIdsOrCollaborationRequest)) {
    // Signature 2: (requestingOrchestrator, taskId, requiredOrchestratorIds, options)
    const taskId = taskIdOrTargetOrchestrator;
    const requiredOrchestratorIds =
      requiredOrchestratorIdsOrCollaborationRequest;

    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, metadata: true },
      });

      const existingMetadata = task
        ? ((task.metadata as OrchestratorCoordinationMetadata) ?? {})
        : {};

      const collaborators = requiredOrchestratorIds.map(orchestratorId => ({
        orchestratorId,
        role: options?.roles?.[orchestratorId] ?? 'collaborator',
        addedAt: createdAt.toISOString(),
        status: 'pending' as const,
      }));

      if (task) {
        const updatedMetadata: OrchestratorCoordinationMetadata = {
          ...existingMetadata,
          coordinationType: 'collaboration',
          collaborators: [
            ...(existingMetadata.collaborators ?? []),
            ...collaborators,
          ],
        };

        await prisma.task.update({
          where: { id: taskId },
          data: { metadata: updatedMetadata as never },
        });
      }

      return {
        success: true,
        requestId: `collab_${Date.now()}`,
        taskId,
        status: 'pending',
        createdAt,
        collaborators,
        metadata: { note: options?.note },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Collaboration request failed',
        createdAt,
      };
    }
  } else {
    // Signature 1: (requestingOrchestrator, targetOrchestrator, collaborationRequest)
    const targetOrchestrator = taskIdOrTargetOrchestrator;
    const collaborationRequest = requiredOrchestratorIdsOrCollaborationRequest;

    try {
      const task = await prisma.task.findUnique({
        where: { id: collaborationRequest.taskId },
        select: { id: true, metadata: true },
      });

      const existingMetadata = task
        ? ((task.metadata as OrchestratorCoordinationMetadata) ?? {})
        : {};

      const newCollaborator = {
        orchestratorId: targetOrchestrator,
        role: collaborationRequest.type,
        addedAt: createdAt.toISOString(),
        status: 'pending' as const,
      };

      if (task) {
        const updatedMetadata: OrchestratorCoordinationMetadata = {
          ...existingMetadata,
          coordinationType: 'collaboration',
          collaborators: [
            ...(existingMetadata.collaborators ?? []),
            newCollaborator,
          ],
        };

        await prisma.task.update({
          where: { id: collaborationRequest.taskId },
          data: { metadata: updatedMetadata as never },
        });
      }

      return {
        success: true,
        requestId: `collab_${Date.now()}`,
        taskId: collaborationRequest.taskId,
        status: 'pending',
        createdAt,
        collaborators: [newCollaborator],
        metadata: {
          type: collaborationRequest.type,
          context: collaborationRequest.context,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Collaboration request failed',
        createdAt,
      };
    }
  }
}

/**
 * Resolve a conflict between orchestrators
 * Applies the given resolution strategy (merge, priority, or manual) and
 * records the outcome in the audit log.
 */
export async function resolveConflict(
  orchestratorIds: string[],
  conflictType: string,
  resolution?: Record<string, unknown>,
  options?: {
    taskId?: string;
    workspaceId?: string;
    note?: string;
  }
): Promise<{
  success: boolean;
  resolved: boolean;
  resolution?: string;
  winner?: string;
  error?: string;
}> {
  try {
    let winner: string | undefined;
    let resolutionDescription: string;

    switch (conflictType) {
      case 'priority': {
        // Higher-priority orchestrator (first in list) wins
        winner = orchestratorIds[0];
        resolutionDescription = `Priority resolution: ${winner} designated as primary`;
        break;
      }
      case 'merge': {
        // Merge - no single winner, both parties contribute
        resolutionDescription = `Merge resolution applied across ${orchestratorIds.join(', ')}`;
        break;
      }
      case 'manual': {
        // Manual resolution - use provided resolution data
        winner = resolution?.winnerId as string | undefined;
        resolutionDescription =
          (resolution?.description as string) ??
          `Manual resolution applied: ${JSON.stringify(resolution)}`;
        break;
      }
      default: {
        // Last-write-wins fallback
        winner = orchestratorIds[orchestratorIds.length - 1];
        resolutionDescription = `Last-write-wins: ${winner} accepted`;
      }
    }

    // Record the resolution in the audit log
    await (prisma as any).auditLog.create({
      data: {
        actorId: winner ?? orchestratorIds[0] ?? 'system',
        actorType: 'orchestrator',
        action: 'resolve_conflict',
        resourceType: options?.taskId ? 'task' : 'orchestrator',
        resourceId: options?.taskId ?? orchestratorIds[0],
        severity: 'warn',
        metadata: {
          orchestratorIds,
          conflictType,
          resolution,
          winner,
          resolutionDescription,
          note: options?.note,
          workspaceId: options?.workspaceId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      resolved: true,
      resolution: resolutionDescription,
      winner,
    };
  } catch (error) {
    return {
      success: false,
      resolved: false,
      error:
        error instanceof Error ? error.message : 'Conflict resolution failed',
    };
  }
}

/**
 * Get collaborative tasks between orchestrators
 * Queries tasks that involve the given orchestrator as either owner or collaborator.
 */
export async function getCollaborativeTasks(
  orchestratorId: string,
  filters?: { status?: string; type?: string }
): Promise<any[]> {
  try {
    // Build status filter for the task query
    const statusFilter = filters?.status
      ? { status: filters.status as any }
      : {};

    // Fetch all tasks owned by the orchestrator that have collaborators in metadata
    const ownedTasks = await prisma.task.findMany({
      where: {
        orchestratorId,
        ...statusFilter,
        metadata: { not: { equals: {} } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        metadata: true,
        orchestratorId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter to tasks that actually have coordination metadata
    const collaborativeTasks = ownedTasks.filter(task => {
      const meta = task.metadata as OrchestratorCoordinationMetadata;
      const hasCollaborators =
        Array.isArray(meta.collaborators) && meta.collaborators.length > 0;
      const hasDelegations =
        Array.isArray(meta.delegations) && meta.delegations.length > 0;
      const hasHandoffs =
        Array.isArray(meta.handoffs) && meta.handoffs.length > 0;

      if (!hasCollaborators && !hasDelegations && !hasHandoffs) {
        return false;
      }

      // Apply type filter if provided
      if (filters?.type && meta.coordinationType !== filters.type) {
        return false;
      }

      return true;
    });

    // Also find tasks where this orchestrator appears as a collaborator in metadata
    const allWorkspaceTasks = await prisma.task.findMany({
      where: {
        ...statusFilter,
        metadata: { not: { equals: {} } },
        NOT: { orchestratorId },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        metadata: true,
        orchestratorId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const participantTasks = allWorkspaceTasks.filter(task => {
      const meta = task.metadata as OrchestratorCoordinationMetadata;

      const isCollaborator = (meta.collaborators ?? []).some(
        c => c.orchestratorId === orchestratorId
      );
      const isDelegatee = (meta.delegations ?? []).some(
        d => d.toOrchestratorId === orchestratorId
      );
      const isHandoffTarget = (meta.handoffs ?? []).some(
        h => h.toOrchestratorId === orchestratorId
      );

      if (!isCollaborator && !isDelegatee && !isHandoffTarget) {
        return false;
      }

      if (filters?.type) {
        const meta2 = meta as OrchestratorCoordinationMetadata;
        if (meta2.coordinationType !== filters.type) return false;
      }

      return true;
    });

    // Merge, deduplicate by task ID, and return
    const seen = new Set<string>();
    const merged = [...collaborativeTasks, ...participantTasks].filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return merged;
  } catch (error) {
    return [];
  }
}
