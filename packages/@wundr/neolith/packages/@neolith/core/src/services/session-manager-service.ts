/**
 * @neolith/core - Session Manager Service
 *
 * CRUD operations for Session Managers (Claude Code/Flow sessions).
 * Handles lifecycle management for dynamically compiled AI sessions.
 */

import type { AgentStatus } from '../types/agent-enums';
import type {
  SessionManagerWithRelations,
  CreateSessionManagerInput,
  UpdateSessionManagerInput,
  ListSessionManagersOptions,
  PaginatedSessionManagerResult,
} from '../types/session-manager';
import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

export class SessionManagerNotFoundError extends Error {
  constructor(id: string) {
    super(`Session Manager not found: ${id}`);
    this.name = 'SessionManagerNotFoundError';
  }
}

export class SessionManagerValidationError extends Error {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'SessionManagerValidationError';
    this.errors = errors;
  }
}

export class OrchestratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Orchestrator not found: ${id}`);
    this.name = 'OrchestratorNotFoundError';
  }
}

// =============================================================================
// Service Configuration
// =============================================================================

export interface SessionManagerServiceConfig {
  prisma: PrismaClient;
}

// =============================================================================
// SessionManagerService Interface
// =============================================================================

export interface SessionManagerService {
  /**
   * Creates a new Session Manager.
   *
   * @param data - Session Manager creation input
   * @returns The created Session Manager with relations
   * @throws {SessionManagerValidationError} If validation fails
   * @throws {OrchestratorNotFoundError} If the orchestrator doesn't exist
   */
  create(data: CreateSessionManagerInput): Promise<SessionManagerWithRelations>;

  /**
   * Gets a Session Manager by ID.
   *
   * @param id - The Session Manager ID
   * @returns The Session Manager with relations, or null if not found
   */
  getById(id: string): Promise<SessionManagerWithRelations | null>;

  /**
   * Lists Session Managers by Orchestrator.
   *
   * @param orchestratorId - The Orchestrator ID
   * @param options - Listing options
   * @returns Paginated Session Manager results
   */
  listByOrchestrator(
    orchestratorId: string,
    options?: ListSessionManagersOptions,
  ): Promise<PaginatedSessionManagerResult>;

  /**
   * Lists global Session Managers.
   *
   * @param options - Listing options
   * @returns Paginated Session Manager results
   */
  listGlobal(options?: ListSessionManagersOptions): Promise<PaginatedSessionManagerResult>;

  /**
   * Updates a Session Manager.
   *
   * @param id - The Session Manager ID
   * @param data - Update data
   * @returns The updated Session Manager
   * @throws {SessionManagerNotFoundError} If the Session Manager doesn't exist
   */
  update(id: string, data: UpdateSessionManagerInput): Promise<SessionManagerWithRelations>;

  /**
   * Deletes a Session Manager.
   *
   * @param id - The Session Manager ID
   * @throws {SessionManagerNotFoundError} If the Session Manager doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Activates a Session Manager (sets status to ACTIVE).
   *
   * @param id - The Session Manager ID
   * @returns The activated Session Manager
   * @throws {SessionManagerNotFoundError} If the Session Manager doesn't exist
   */
  activate(id: string): Promise<SessionManagerWithRelations>;

  /**
   * Deactivates a Session Manager (sets status to INACTIVE).
   *
   * @param id - The Session Manager ID
   * @returns The deactivated Session Manager
   * @throws {SessionManagerNotFoundError} If the Session Manager doesn't exist
   */
  deactivate(id: string): Promise<SessionManagerWithRelations>;
}

// =============================================================================
// SessionManagerService Implementation
// =============================================================================

export class SessionManagerServiceImpl implements SessionManagerService {
  private readonly prisma: PrismaClient;

  constructor(config: SessionManagerServiceConfig) {
    this.prisma = config.prisma;
  }

  /**
   * Creates a new Session Manager with validation.
   */
  async create(data: CreateSessionManagerInput): Promise<SessionManagerWithRelations> {
    // Validate input
    this.validateCreateInput(data);

    // Validate orchestrator exists
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: data.orchestratorId },
    });
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(data.orchestratorId);
    }

    const result = await this.prisma.sessionManager.create({
      data: {
        name: data.name,
        description: data.description,
        charterId: data.charterId,
        charterData: data.charterData as any,
        disciplineId: data.disciplineId,
        orchestratorId: data.orchestratorId,
        isGlobal: data.isGlobal ?? false,
        globalConfig: data.globalConfig as any,
        maxConcurrentSubagents: data.maxConcurrentSubagents ?? 20,
        worktreeConfig: data.worktreeConfig as any,
        tokenBudgetPerHour: data.tokenBudgetPerHour ?? 100000,
        status: 'INACTIVE',
      },
      include: {
        orchestrator: { select: { id: true, userId: true } },
        subagents: { select: { id: true, name: true, status: true, tier: true } },
      },
    });

    return this.mapToType(result);
  }

  /**
   * Gets a Session Manager by ID with full relations.
   */
  async getById(id: string): Promise<SessionManagerWithRelations | null> {
    const result = await this.prisma.sessionManager.findUnique({
      where: { id },
      include: {
        orchestrator: { select: { id: true, userId: true } },
        subagents: { select: { id: true, name: true, status: true, tier: true } },
      },
    });

    return result ? this.mapToType(result) : null;
  }

  /**
   * Lists Session Managers by Orchestrator with pagination and filters.
   */
  async listByOrchestrator(
    orchestratorId: string,
    options: ListSessionManagersOptions = {},
  ): Promise<PaginatedSessionManagerResult> {
    const where: any = {
      orchestratorId,
      ...(options.status && { status: options.status }),
      ...(options.disciplineId && { disciplineId: options.disciplineId }),
      ...(options.isGlobal !== undefined && { isGlobal: options.isGlobal }),
      ...(!options.includeInactive && { status: { not: 'INACTIVE' as AgentStatus } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionManager.findMany({
        where,
        include: {
          orchestrator: { select: { id: true, userId: true } },
          subagents: { select: { id: true, name: true, status: true, tier: true } },
        },
        skip: options.skip,
        take: options.take ?? 50,
        orderBy: options.orderBy ? { [options.orderBy]: options.orderDirection ?? 'desc' } : { createdAt: 'desc' },
      }),
      this.prisma.sessionManager.count({ where }),
    ]);

    return {
      data: data.map(this.mapToType),
      total,
      hasMore: (options.skip ?? 0) + data.length < total,
    };
  }

  /**
   * Lists global Session Managers.
   */
  async listGlobal(options: ListSessionManagersOptions = {}): Promise<PaginatedSessionManagerResult> {
    const where: any = {
      isGlobal: true,
      ...(options.status && { status: options.status }),
      ...(options.disciplineId && { disciplineId: options.disciplineId }),
      ...(!options.includeInactive && { status: { not: 'INACTIVE' as AgentStatus } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionManager.findMany({
        where,
        include: {
          orchestrator: { select: { id: true, userId: true } },
          subagents: { select: { id: true, name: true, status: true, tier: true } },
        },
        skip: options.skip,
        take: options.take ?? 50,
        orderBy: options.orderBy ? { [options.orderBy]: options.orderDirection ?? 'desc' } : { createdAt: 'desc' },
      }),
      this.prisma.sessionManager.count({ where }),
    ]);

    return {
      data: data.map(this.mapToType),
      total,
      hasMore: (options.skip ?? 0) + data.length < total,
    };
  }

  /**
   * Updates a Session Manager.
   */
  async update(id: string, data: UpdateSessionManagerInput): Promise<SessionManagerWithRelations> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new SessionManagerNotFoundError(id);
    }

    const result = await this.prisma.sessionManager.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.charterData !== undefined && { charterData: data.charterData as any }),
        ...(data.globalConfig !== undefined && { globalConfig: data.globalConfig as any }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.maxConcurrentSubagents !== undefined && { maxConcurrentSubagents: data.maxConcurrentSubagents }),
        ...(data.tokenBudgetPerHour !== undefined && { tokenBudgetPerHour: data.tokenBudgetPerHour }),
        ...(data.worktreeConfig !== undefined && { worktreeConfig: data.worktreeConfig as any }),
      },
      include: {
        orchestrator: { select: { id: true, userId: true } },
        subagents: { select: { id: true, name: true, status: true, tier: true } },
      },
    });

    return this.mapToType(result);
  }

  /**
   * Deletes a Session Manager.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new SessionManagerNotFoundError(id);
    }

    await this.prisma.sessionManager.delete({ where: { id } });
  }

  /**
   * Activates a Session Manager.
   */
  async activate(id: string): Promise<SessionManagerWithRelations> {
    return this.update(id, { status: 'ACTIVE' });
  }

  /**
   * Deactivates a Session Manager.
   */
  async deactivate(id: string): Promise<SessionManagerWithRelations> {
    return this.update(id, { status: 'INACTIVE' });
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates create Session Manager input.
   */
  private validateCreateInput(data: CreateSessionManagerInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (data.name.length > 200) {
      errors.name = ['Name must be 200 characters or less'];
    }

    if (!data.orchestratorId) {
      errors.orchestratorId = ['Orchestrator ID is required'];
    }

    if (data.maxConcurrentSubagents !== undefined && data.maxConcurrentSubagents < 1) {
      errors.maxConcurrentSubagents = ['Max concurrent subagents must be at least 1'];
    }

    if (data.tokenBudgetPerHour !== undefined && data.tokenBudgetPerHour < 0) {
      errors.tokenBudgetPerHour = ['Token budget per hour cannot be negative'];
    }

    if (Object.keys(errors).length > 0) {
      throw new SessionManagerValidationError('Session Manager validation failed', errors);
    }
  }

  /**
   * Maps database result to typed SessionManagerWithRelations.
   */
  private mapToType(data: any): SessionManagerWithRelations {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      charterId: data.charterId,
      charterData: data.charterData as Record<string, unknown>,
      disciplineId: data.disciplineId,
      orchestratorId: data.orchestratorId,
      isGlobal: data.isGlobal,
      globalConfig: data.globalConfig,
      status: data.status,
      maxConcurrentSubagents: data.maxConcurrentSubagents,
      tokenBudgetPerHour: data.tokenBudgetPerHour,
      worktreeConfig: data.worktreeConfig,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      orchestrator: data.orchestrator,
      subagents: data.subagents,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new Session Manager service instance.
 *
 * @param prisma - Prisma client instance
 * @returns Session Manager service instance
 *
 * @example
 * ```typescript
 * const sessionManagerService = createSessionManagerService(prisma);
 *
 * // Create a new Session Manager
 * const sessionManager = await sessionManagerService.create({
 *   name: 'Frontend Dev Session',
 *   orchestratorId: 'orch_123',
 *   charterId: 'charter_456',
 *   charterData: { tier: 'production' },
 * });
 *
 * // Activate the session
 * await sessionManagerService.activate(sessionManager.id);
 * ```
 */
export function createSessionManagerService(prisma: PrismaClient): SessionManagerServiceImpl {
  return new SessionManagerServiceImpl({ prisma });
}
