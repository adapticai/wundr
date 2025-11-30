/**
 * @neolith/core - Subagent Service
 *
 * CRUD operations for Subagents (specialized workers under Session Manager coordination).
 * Per THREE-TIER-ARCHITECTURE: up to 20 subagents per session, ~3,200 total across fleet.
 *
 * @packageDocumentation
 */

import type { PrismaClient } from '@neolith/database';
import { prisma } from '@neolith/database';
import type {
  SubagentWithRelations,
  CreateSubagentInput,
  UpdateSubagentInput,
  ListSubagentsOptions,
  PaginatedSubagentResult,
} from '../types/subagent';
import type { AgentStatus } from '../types/agent-enums';
import { TransactionError } from '../errors';

// =============================================================================
// Error Classes
// =============================================================================

export class SubagentNotFoundError extends Error {
  constructor(id: string) {
    super(`Subagent not found: ${id}`);
    this.name = 'SubagentNotFoundError';
  }
}

export class SubagentValidationError extends Error {
  constructor(message: string, public readonly errors?: Record<string, string[]>) {
    super(message);
    this.name = 'SubagentValidationError';
  }
}

export class SessionManagerNotFoundError extends Error {
  constructor(id: string) {
    super(`Session Manager not found: ${id}`);
    this.name = 'SessionManagerNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for Subagent CRUD operations.
 */
export interface SubagentService {
  /**
   * Creates a new Subagent.
   *
   * @param data - Subagent creation input
   * @returns The created Subagent with relations
   * @throws {SubagentValidationError} If validation fails
   * @throws {SessionManagerNotFoundError} If session manager doesn't exist
   */
  create(data: CreateSubagentInput): Promise<SubagentWithRelations>;

  /**
   * Gets a Subagent by ID.
   *
   * @param id - The Subagent ID
   * @returns The Subagent with relations, or null if not found
   */
  getById(id: string): Promise<SubagentWithRelations | null>;

  /**
   * Lists Subagents by Session Manager.
   *
   * @param sessionManagerId - The Session Manager ID
   * @param options - Listing options
   * @returns Paginated Subagent results
   */
  listBySessionManager(
    sessionManagerId: string,
    options?: ListSubagentsOptions
  ): Promise<PaginatedSubagentResult>;

  /**
   * Lists global Subagents.
   *
   * @param options - Listing options
   * @returns Paginated Subagent results
   */
  listGlobal(options?: ListSubagentsOptions): Promise<PaginatedSubagentResult>;

  /**
   * Lists universal Subagents (UNIVERSAL scope, ACTIVE status).
   *
   * @returns List of universal Subagents
   */
  listUniversal(): Promise<SubagentWithRelations[]>;

  /**
   * Updates a Subagent.
   *
   * @param id - The Subagent ID
   * @param data - Update data
   * @returns The updated Subagent
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   */
  update(id: string, data: UpdateSubagentInput): Promise<SubagentWithRelations>;

  /**
   * Deletes a Subagent.
   *
   * @param id - The Subagent ID
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Activates a Subagent (sets status to ACTIVE).
   *
   * @param id - The Subagent ID
   * @returns The activated Subagent
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   */
  activate(id: string): Promise<SubagentWithRelations>;

  /**
   * Deactivates a Subagent (sets status to INACTIVE).
   *
   * @param id - The Subagent ID
   * @returns The deactivated Subagent
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   */
  deactivate(id: string): Promise<SubagentWithRelations>;

  /**
   * Assigns a Subagent to a Session Manager.
   *
   * @param subagentId - The Subagent ID
   * @param sessionManagerId - The Session Manager ID
   * @returns The updated Subagent
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   * @throws {SessionManagerNotFoundError} If the Session Manager doesn't exist
   */
  assignToSessionManager(subagentId: string, sessionManagerId: string): Promise<SubagentWithRelations>;

  /**
   * Unassigns a Subagent from its Session Manager.
   *
   * @param subagentId - The Subagent ID
   * @returns The updated Subagent
   * @throws {SubagentNotFoundError} If the Subagent doesn't exist
   */
  unassignFromSessionManager(subagentId: string): Promise<SubagentWithRelations>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * SubagentService implementation providing CRUD operations.
 */
export class SubagentServiceImpl implements SubagentService {
  private readonly db: PrismaClient;

  /**
   * Creates a new SubagentServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Creates a new Subagent.
   */
  async create(data: CreateSubagentInput): Promise<SubagentWithRelations> {
    // Validate input
    this.validateCreateInput(data);

    // Validate session manager if provided
    if (data.sessionManagerId) {
      const sm = await this.db.sessionManager.findUnique({
        where: { id: data.sessionManagerId },
      });
      if (!sm) {
        throw new SessionManagerNotFoundError(data.sessionManagerId);
      }
    }

    try {
      const result = await this.db.subagent.create({
        data: {
          name: data.name,
          description: data.description,
          charterId: data.charterId,
          charterData: data.charterData as any,
          sessionManagerId: data.sessionManagerId,
          isGlobal: data.isGlobal ?? false,
          scope: data.scope ?? 'DISCIPLINE',
          tier: data.tier ?? 3,
          capabilities: (data.capabilities ?? []) as any,
          mcpTools: data.mcpTools ?? [],
          maxTokensPerTask: data.maxTokensPerTask ?? 50000,
          status: 'INACTIVE',
        },
        include: {
          sessionManager: { select: { id: true, name: true, orchestratorId: true } },
        },
      });

      return this.mapToType(result);
    } catch (error) {
      throw new TransactionError('createSubagent', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets a Subagent by ID with relations.
   */
  async getById(id: string): Promise<SubagentWithRelations | null> {
    const result = await this.db.subagent.findUnique({
      where: { id },
      include: {
        sessionManager: { select: { id: true, name: true, orchestratorId: true } },
      },
    });

    return result ? this.mapToType(result) : null;
  }

  /**
   * Lists Subagents by Session Manager with pagination.
   */
  async listBySessionManager(
    sessionManagerId: string,
    options: ListSubagentsOptions = {}
  ): Promise<PaginatedSubagentResult> {
    const {
      status,
      scope,
      tier,
      includeInactive = false,
      skip = 0,
      take = 50,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = options;

    const where: any = {
      sessionManagerId,
      ...(status && { status }),
      ...(scope && { scope }),
      ...(tier !== undefined && { tier }),
      ...(!includeInactive && { status: { not: 'INACTIVE' as AgentStatus } }),
    };

    const [data, total] = await Promise.all([
      this.db.subagent.findMany({
        where,
        include: {
          sessionManager: { select: { id: true, name: true, orchestratorId: true } },
        },
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
      this.db.subagent.count({ where }),
    ]);

    const lastItem = data[data.length - 1];
    return {
      data: data.map((item) => this.mapToType(item)),
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Lists global Subagents with pagination.
   */
  async listGlobal(options: ListSubagentsOptions = {}): Promise<PaginatedSubagentResult> {
    const {
      status,
      scope,
      includeInactive = false,
      skip = 0,
      take = 50,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = options;

    const where: any = {
      isGlobal: true,
      ...(status && { status }),
      ...(scope && { scope }),
      ...(!includeInactive && { status: { not: 'INACTIVE' as AgentStatus } }),
    };

    const [data, total] = await Promise.all([
      this.db.subagent.findMany({
        where,
        include: {
          sessionManager: { select: { id: true, name: true, orchestratorId: true } },
        },
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
      this.db.subagent.count({ where }),
    ]);

    const lastItem = data[data.length - 1];
    return {
      data: data.map((item) => this.mapToType(item)),
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Lists universal Subagents (UNIVERSAL scope, ACTIVE status).
   */
  async listUniversal(): Promise<SubagentWithRelations[]> {
    const results = await this.db.subagent.findMany({
      where: {
        scope: 'UNIVERSAL',
        status: 'ACTIVE',
      },
      include: {
        sessionManager: { select: { id: true, name: true, orchestratorId: true } },
      },
      orderBy: { name: 'asc' },
    });

    return results.map((item) => this.mapToType(item));
  }

  /**
   * Updates a Subagent.
   */
  async update(id: string, data: UpdateSubagentInput): Promise<SubagentWithRelations> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new SubagentNotFoundError(id);
    }

    // Validate session manager if being updated
    if (data.sessionManagerId !== undefined && data.sessionManagerId !== null) {
      const sm = await this.db.sessionManager.findUnique({
        where: { id: data.sessionManagerId },
      });
      if (!sm) {
        throw new SessionManagerNotFoundError(data.sessionManagerId);
      }
    }

    try {
      // Build update data with proper type casting
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.charterData !== undefined) updateData.charterData = data.charterData;
      if (data.sessionManagerId !== undefined) updateData.sessionManagerId = data.sessionManagerId;
      if (data.isGlobal !== undefined) updateData.isGlobal = data.isGlobal;
      if (data.scope !== undefined) updateData.scope = data.scope;
      if (data.capabilities !== undefined) updateData.capabilities = data.capabilities;
      if (data.mcpTools !== undefined) updateData.mcpTools = data.mcpTools;
      if (data.maxTokensPerTask !== undefined) updateData.maxTokensPerTask = data.maxTokensPerTask;
      if (data.status !== undefined) updateData.status = data.status;

      const result = await this.db.subagent.update({
        where: { id },
        data: updateData,
        include: {
          sessionManager: { select: { id: true, name: true, orchestratorId: true } },
        },
      });

      return this.mapToType(result);
    } catch (error) {
      throw new TransactionError('updateSubagent', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Deletes a Subagent.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new SubagentNotFoundError(id);
    }

    try {
      await this.db.subagent.delete({ where: { id } });
    } catch (error) {
      throw new TransactionError('deleteSubagent', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Activates a Subagent.
   */
  async activate(id: string): Promise<SubagentWithRelations> {
    return this.update(id, { status: 'ACTIVE' });
  }

  /**
   * Deactivates a Subagent.
   */
  async deactivate(id: string): Promise<SubagentWithRelations> {
    return this.update(id, { status: 'INACTIVE' });
  }

  /**
   * Assigns a Subagent to a Session Manager.
   */
  async assignToSessionManager(subagentId: string, sessionManagerId: string): Promise<SubagentWithRelations> {
    // Validate session manager exists
    const sm = await this.db.sessionManager.findUnique({
      where: { id: sessionManagerId },
    });
    if (!sm) {
      throw new SessionManagerNotFoundError(sessionManagerId);
    }

    return this.update(subagentId, { sessionManagerId });
  }

  /**
   * Unassigns a Subagent from its Session Manager.
   */
  async unassignFromSessionManager(subagentId: string): Promise<SubagentWithRelations> {
    return this.update(subagentId, { sessionManagerId: null });
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates create Subagent input.
   */
  private validateCreateInput(data: CreateSubagentInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (data.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (!data.charterId || data.charterId.trim().length === 0) {
      errors.charterId = ['Charter ID is required'];
    }

    if (!data.charterData || typeof data.charterData !== 'object') {
      errors.charterData = ['Charter data must be a valid object'];
    }

    if (data.tier !== undefined && (data.tier < 1 || data.tier > 3)) {
      errors.tier = ['Tier must be 1, 2, or 3'];
    }

    if (data.maxTokensPerTask !== undefined && data.maxTokensPerTask <= 0) {
      errors.maxTokensPerTask = ['Max tokens per task must be greater than 0'];
    }

    if (Object.keys(errors).length > 0) {
      throw new SubagentValidationError('Subagent validation failed', errors);
    }
  }

  /**
   * Maps raw database result to typed Subagent with relations.
   */
  private mapToType(data: any): SubagentWithRelations {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      charterId: data.charterId,
      charterData: data.charterData as Record<string, unknown>,
      sessionManagerId: data.sessionManagerId,
      isGlobal: data.isGlobal,
      scope: data.scope,
      tier: data.tier,
      capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
      mcpTools: data.mcpTools as string[],
      maxTokensPerTask: data.maxTokensPerTask,
      worktreeRequirement: data.worktreeRequirement ?? 'none',
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      sessionManager: data.sessionManager,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new Subagent service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Subagent service instance implementing SubagentService
 *
 * @example
 * ```typescript
 * const subagentService = createSubagentService();
 *
 * // Create a new Subagent
 * const subagent = await subagentService.create({
 *   name: 'Code Reviewer',
 *   charterId: 'charter_reviewer_001',
 *   charterData: { specialization: 'typescript' },
 *   capabilities: ['code_review', 'style_check'],
 *   mcpTools: ['file_read', 'git_diff'],
 * });
 *
 * // Activate subagent
 * await subagentService.activate(subagent.id);
 * ```
 */
export function createSubagentService(database?: PrismaClient): SubagentServiceImpl {
  return new SubagentServiceImpl(database);
}

/**
 * Default Subagent service instance using the singleton Prisma client.
 */
export const subagentService = createSubagentService();
