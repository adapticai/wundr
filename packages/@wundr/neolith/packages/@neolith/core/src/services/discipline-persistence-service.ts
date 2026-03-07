/**
 * @neolith/core - Discipline Persistence Service
 *
 * Persistence layer for the discipline table. Provides create, list, and
 * rich "with agents" query operations for disciplines in the database
 * (as opposed to the org-settings-backed DisciplineService).
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError } from '../errors';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a discipline database record is not found.
 */
export class DisciplinePersistenceNotFoundError extends GenesisError {
  constructor(id: string) {
    super(
      `Discipline not found: ${id}`,
      'DISCIPLINE_PERSISTENCE_NOT_FOUND',
      404,
      { id }
    );
    this.name = 'DisciplinePersistenceNotFoundError';
  }
}

/**
 * Error thrown when discipline persistence validation fails.
 */
export class DisciplinePersistenceValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'DISCIPLINE_PERSISTENCE_VALIDATION_ERROR', 400, { errors });
    this.name = 'DisciplinePersistenceValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a discipline already exists for the given organization.
 */
export class DisciplinePersistenceAlreadyExistsError extends GenesisError {
  constructor(name: string, organizationId: string) {
    super(
      `Discipline '${name}' already exists in organization: ${organizationId}`,
      'DISCIPLINE_PERSISTENCE_ALREADY_EXISTS',
      409,
      { name, organizationId }
    );
    this.name = 'DisciplinePersistenceAlreadyExistsError';
  }
}

/**
 * Error thrown when a discipline persistence operation fails.
 */
export class DisciplinePersistenceError extends GenesisError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Discipline persistence operation '${operation}' failed: ${originalError?.message ?? 'Unknown error'}`,
      'DISCIPLINE_PERSISTENCE_ERROR',
      500,
      { operation, originalError: originalError?.message }
    );
    this.name = 'DisciplinePersistenceError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Input for creating a new discipline record.
 */
export interface CreateDisciplineInput {
  /** Human-readable name of the discipline */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional UI colour token */
  color?: string;
  /** Optional icon identifier */
  icon?: string;
}

/**
 * A persisted discipline record from the database.
 */
export interface PersistedDiscipline {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A persisted discipline record augmented with its associated subagents.
 */
export interface PersistedDisciplineWithAgents extends PersistedDiscipline {
  agents: DisciplineAgent[];
}

/**
 * Minimal agent information included in the discipline-with-agents response.
 */
export interface DisciplineAgent {
  id: string;
  name: string;
  status: string;
  tier: number;
  sessionManagerId: string | null;
  isGlobal: boolean;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for discipline persistence operations.
 */
export interface DisciplinePersistenceService {
  /**
   * Creates a new discipline database record for an organization.
   *
   * @param orgId - ID of the organization that owns this discipline
   * @param discipline - Discipline creation input
   * @returns The created discipline record
   * @throws {DisciplinePersistenceValidationError} If validation fails
   * @throws {DisciplinePersistenceAlreadyExistsError} If a discipline with the same name exists in the org
   * @throws {DisciplinePersistenceError} If the database operation fails
   */
  createDiscipline(
    orgId: string,
    discipline: CreateDisciplineInput
  ): Promise<PersistedDiscipline>;

  /**
   * Lists all discipline records for an organization, ordered by name.
   *
   * @param orgId - ID of the organization
   * @returns Array of persisted discipline records
   */
  listDisciplines(orgId: string): Promise<PersistedDiscipline[]>;

  /**
   * Gets a single discipline with its associated subagents.
   * Agents are retrieved from the subagent table by matching charterData.usedByDisciplines.
   *
   * @param disciplineId - Database ID of the discipline
   * @returns Discipline record with agents, or null if not found
   */
  getDisciplineWithAgents(
    disciplineId: string
  ): Promise<PersistedDisciplineWithAgents | null>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Implementation of DisciplinePersistenceService.
 */
export class DisciplinePersistenceServiceImpl implements DisciplinePersistenceService {
  private readonly db: PrismaClient;

  /**
   * Creates a new DisciplinePersistenceServiceImpl instance.
   *
   * @param database - Optional Prisma client (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Creates a discipline record in the database.
   */
  async createDiscipline(
    orgId: string,
    discipline: CreateDisciplineInput
  ): Promise<PersistedDiscipline> {
    this.validateCreateInput(orgId, discipline);

    // Verify organization exists
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      throw new DisciplinePersistenceValidationError(
        'Discipline creation validation failed',
        { organizationId: [`Organization not found: ${orgId}`] }
      );
    }

    // Check uniqueness within the organization
    const existing = await this.db.discipline.findFirst({
      where: { organizationId: orgId, name: discipline.name },
      select: { id: true },
    });

    if (existing) {
      throw new DisciplinePersistenceAlreadyExistsError(discipline.name, orgId);
    }

    try {
      const record = await this.db.discipline.create({
        data: {
          name: discipline.name,
          description: discipline.description ?? null,
          color: discipline.color ?? null,
          icon: discipline.icon ?? null,
          organizationId: orgId,
        },
      });

      return this.mapToRecord(record);
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new DisciplinePersistenceError(
        'createDiscipline',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Lists all disciplines for an organization.
   */
  async listDisciplines(orgId: string): Promise<PersistedDiscipline[]> {
    const records = await this.db.discipline.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });

    return records.map(r => this.mapToRecord(r));
  }

  /**
   * Gets a discipline with its associated subagents.
   *
   * Subagents are linked by their charterData JSON containing the discipline
   * name or ID in the usedByDisciplines array. We also include subagents that
   * are assigned to session managers whose disciplineId matches.
   */
  async getDisciplineWithAgents(
    disciplineId: string
  ): Promise<PersistedDisciplineWithAgents | null> {
    const discipline = await this.db.discipline.findUnique({
      where: { id: disciplineId },
    });

    if (!discipline) {
      return null;
    }

    // Fetch agents in two ways:
    // 1. Subagents whose session manager has this disciplineId
    // 2. Subagents whose charterData.usedByDisciplines contains this discipline's name or id
    const [agentsBySessionManager, agentsByCharterData] = await Promise.all([
      this.db.subagent.findMany({
        where: {
          sessionManager: {
            disciplineId,
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          tier: true,
          sessionManagerId: true,
          isGlobal: true,
        },
      }),
      this.db.subagent.findMany({
        where: {
          charterData: {
            path: ['usedByDisciplines'],
            array_contains: discipline.name,
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          tier: true,
          sessionManagerId: true,
          isGlobal: true,
        },
      }),
    ]);

    // Merge and deduplicate by agent ID
    const agentMap = new Map<string, DisciplineAgent>();
    for (const agent of [...agentsBySessionManager, ...agentsByCharterData]) {
      agentMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        tier: agent.tier,
        sessionManagerId: agent.sessionManagerId,
        isGlobal: agent.isGlobal,
      });
    }

    const agents = Array.from(agentMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return {
      ...this.mapToRecord(discipline),
      agents,
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Validates create discipline inputs.
   */
  private validateCreateInput(
    orgId: string,
    discipline: CreateDisciplineInput
  ): void {
    const errors: Record<string, string[]> = {};

    if (!orgId || orgId.trim().length === 0) {
      errors.organizationId = ['Organization ID is required'];
    }

    if (!discipline.name || discipline.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (discipline.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (discipline.description && discipline.description.length > 1000) {
      errors.description = ['Description must be 1000 characters or less'];
    }

    if (Object.keys(errors).length > 0) {
      throw new DisciplinePersistenceValidationError(
        'Discipline creation validation failed',
        errors
      );
    }
  }

  /**
   * Maps a raw Prisma discipline row to PersistedDiscipline.
   */
  private mapToRecord(row: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): PersistedDiscipline {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      icon: row.icon,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new DisciplinePersistenceService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Discipline persistence service instance
 *
 * @example
 * ```typescript
 * const disciplinePersistence = createDisciplinePersistenceService();
 *
 * // Create a discipline for an organization
 * const discipline = await disciplinePersistence.createDiscipline(orgId, {
 *   name: 'Engineering',
 *   description: 'Software engineering discipline',
 *   color: '#0057FF',
 *   icon: 'code',
 * });
 *
 * // List all disciplines in an org
 * const disciplines = await disciplinePersistence.listDisciplines(orgId);
 *
 * // Get a discipline with its agents
 * const withAgents = await disciplinePersistence.getDisciplineWithAgents(discipline.id);
 * console.log(`${withAgents?.agents.length} agents in Engineering`);
 * ```
 */
export function createDisciplinePersistenceService(
  database?: PrismaClient
): DisciplinePersistenceServiceImpl {
  return new DisciplinePersistenceServiceImpl(database);
}

/**
 * Default discipline persistence service instance using the singleton Prisma client.
 */
export const disciplinePersistenceService =
  createDisciplinePersistenceService();
