/**
 * @neolith/core - Session Manager Persistence Service
 *
 * Persistence layer for creating and managing Session Manager records and
 * their agent assignments. Complements the existing SessionManagerService
 * with charter-generation-oriented helpers.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError } from '../errors';

import type { AgentStatus } from '../types/agent-enums';
import type { Prisma, PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a session manager record is not found.
 */
export class SessionManagerPersistenceNotFoundError extends GenesisError {
  constructor(id: string) {
    super(
      `Session manager not found: ${id}`,
      'SESSION_MANAGER_PERSISTENCE_NOT_FOUND',
      404,
      { id }
    );
    this.name = 'SessionManagerPersistenceNotFoundError';
  }
}

/**
 * Error thrown when session manager persistence validation fails.
 */
export class SessionManagerPersistenceValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'SESSION_MANAGER_PERSISTENCE_VALIDATION_ERROR', 400, {
      errors,
    });
    this.name = 'SessionManagerPersistenceValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a session manager persistence operation fails.
 */
export class SessionManagerPersistenceError extends GenesisError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Session manager persistence operation '${operation}' failed: ${originalError?.message ?? 'Unknown error'}`,
      'SESSION_MANAGER_PERSISTENCE_ERROR',
      500,
      { operation, originalError: originalError?.message }
    );
    this.name = 'SessionManagerPersistenceError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration object when creating a new session manager via the persistence layer.
 */
export interface CreateSessionManagerConfig {
  /** Human-readable name for the session manager */
  name: string;
  /** Optional description */
  description?: string;
  /** Charter document ID this session manager is associated with */
  charterId: string;
  /** Full charter JSON data */
  charterData: Record<string, unknown>;
  /** Optional discipline ID this session manager coordinates */
  disciplineId?: string;
  /** Whether this session manager can be invoked globally */
  isGlobal?: boolean;
  /** Global invocation configuration */
  globalConfig?: Record<string, unknown>;
  /** Maximum concurrent subagents allowed */
  maxConcurrentSubagents?: number;
  /** Token budget per hour */
  tokenBudgetPerHour?: number;
  /** Git worktree settings */
  worktreeConfig?: Record<string, unknown>;
  /** Plugin configurations */
  pluginConfigs?: Record<string, unknown>[];
  /** Skill definitions */
  skillDefinitions?: Record<string, unknown>[];
  /** Context configuration */
  contextConfig?: Record<string, unknown>;
  /** MCP tool names available to this session manager */
  mcpTools?: string[];
  /** Additional key/value config */
  config?: Record<string, unknown>;
}

/**
 * Configuration object for updating an existing session manager.
 */
export interface UpdateSessionManagerConfig {
  name?: string;
  description?: string;
  charterData?: Record<string, unknown>;
  disciplineId?: string;
  isGlobal?: boolean;
  globalConfig?: Record<string, unknown>;
  maxConcurrentSubagents?: number;
  tokenBudgetPerHour?: number;
  worktreeConfig?: Record<string, unknown>;
  pluginConfigs?: Record<string, unknown>[];
  skillDefinitions?: Record<string, unknown>[];
  contextConfig?: Record<string, unknown>;
  mcpTools?: string[];
  config?: Record<string, unknown>;
  status?: AgentStatus;
}

/**
 * Session manager record returned from the database.
 */
export interface PersistedSessionManager {
  id: string;
  name: string;
  description: string | null;
  charterId: string;
  charterData: Record<string, unknown>;
  disciplineId: string | null;
  orchestratorId: string;
  isGlobal: boolean;
  globalConfig: Record<string, unknown> | null;
  status: AgentStatus;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  worktreeConfig: Record<string, unknown> | null;
  pluginConfigs: unknown;
  skillDefinitions: unknown;
  contextConfig: Record<string, unknown>;
  mcpTools: string[];
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of assigning agents to a session manager.
 */
export interface AssignAgentsResult {
  /** Total agents now assigned */
  assigned: number;
  /** Agent IDs that were successfully updated */
  agentIds: string[];
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for session manager persistence operations.
 */
export interface SessionManagerPersistenceService {
  /**
   * Creates a session manager record for a given orchestrator.
   *
   * @param orchestratorId - ID of the orchestrator that owns this session manager
   * @param config - Session manager creation configuration
   * @returns The created session manager record
   * @throws {SessionManagerPersistenceValidationError} If validation fails
   * @throws {SessionManagerPersistenceError} If the database operation fails
   */
  createSessionManager(
    orchestratorId: string,
    config: CreateSessionManagerConfig
  ): Promise<PersistedSessionManager>;

  /**
   * Lists all session managers for a given orchestrator.
   *
   * @param orchestratorId - ID of the orchestrator
   * @returns Array of session manager records
   */
  listSessionManagers(
    orchestratorId: string
  ): Promise<PersistedSessionManager[]>;

  /**
   * Updates configuration fields on an existing session manager.
   *
   * @param id - Database ID of the session manager
   * @param config - Fields to update
   * @returns The updated session manager record
   * @throws {SessionManagerPersistenceNotFoundError} If the session manager does not exist
   * @throws {SessionManagerPersistenceError} If the update fails
   */
  updateSessionManager(
    id: string,
    config: UpdateSessionManagerConfig
  ): Promise<PersistedSessionManager>;

  /**
   * Assigns a list of subagent IDs to a session manager.
   * Updates each subagent's sessionManagerId in a single transaction.
   *
   * @param sessionManagerId - ID of the session manager to assign agents to
   * @param agentIds - Array of subagent database IDs to assign
   * @returns Summary of the assignment operation
   * @throws {SessionManagerPersistenceNotFoundError} If the session manager does not exist
   * @throws {SessionManagerPersistenceError} If the transaction fails
   */
  assignAgents(
    sessionManagerId: string,
    agentIds: string[]
  ): Promise<AssignAgentsResult>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Implementation of SessionManagerPersistenceService.
 */
export class SessionManagerPersistenceServiceImpl implements SessionManagerPersistenceService {
  private readonly db: PrismaClient;

  /**
   * Creates a new SessionManagerPersistenceServiceImpl instance.
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
   * Creates a new session manager record.
   */
  async createSessionManager(
    orchestratorId: string,
    config: CreateSessionManagerConfig
  ): Promise<PersistedSessionManager> {
    this.validateCreateInput(orchestratorId, config);

    // Verify orchestrator exists
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true },
    });

    if (!orchestrator) {
      throw new SessionManagerPersistenceValidationError(
        'Session manager creation validation failed',
        { orchestratorId: [`Orchestrator not found: ${orchestratorId}`] }
      );
    }

    try {
      const record = await this.db.sessionManager.create({
        data: {
          name: config.name,
          description: config.description ?? null,
          charterId: config.charterId,
          charterData: config.charterData as unknown as Prisma.InputJsonValue,
          disciplineId: config.disciplineId ?? null,
          orchestratorId,
          isGlobal: config.isGlobal ?? false,
          globalConfig: config.globalConfig
            ? (config.globalConfig as unknown as Prisma.InputJsonValue)
            : undefined,
          maxConcurrentSubagents: config.maxConcurrentSubagents ?? 20,
          tokenBudgetPerHour: config.tokenBudgetPerHour ?? 100000,
          worktreeConfig: config.worktreeConfig
            ? (config.worktreeConfig as unknown as Prisma.InputJsonValue)
            : undefined,
          pluginConfigs: config.pluginConfigs
            ? (config.pluginConfigs as unknown as Prisma.InputJsonValue)
            : [],
          skillDefinitions: config.skillDefinitions
            ? (config.skillDefinitions as unknown as Prisma.InputJsonValue)
            : [],
          contextConfig: config.contextConfig
            ? (config.contextConfig as unknown as Prisma.InputJsonValue)
            : {},
          mcpTools: config.mcpTools ?? [],
          config: config.config
            ? (config.config as unknown as Prisma.InputJsonValue)
            : {},
          status: 'INACTIVE',
        },
      });

      return this.mapToRecord(record);
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new SessionManagerPersistenceError(
        'createSessionManager',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Lists all session managers for an orchestrator.
   */
  async listSessionManagers(
    orchestratorId: string
  ): Promise<PersistedSessionManager[]> {
    const records = await this.db.sessionManager.findMany({
      where: { orchestratorId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => this.mapToRecord(r));
  }

  /**
   * Updates an existing session manager's configuration.
   */
  async updateSessionManager(
    id: string,
    config: UpdateSessionManagerConfig
  ): Promise<PersistedSessionManager> {
    const existing = await this.db.sessionManager.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new SessionManagerPersistenceNotFoundError(id);
    }

    try {
      const record = await this.db.sessionManager.update({
        where: { id },
        data: {
          ...(config.name !== undefined && { name: config.name }),
          ...(config.description !== undefined && {
            description: config.description,
          }),
          ...(config.charterData !== undefined && {
            charterData: config.charterData as unknown as Prisma.InputJsonValue,
          }),
          ...(config.disciplineId !== undefined && {
            disciplineId: config.disciplineId,
          }),
          ...(config.isGlobal !== undefined && { isGlobal: config.isGlobal }),
          ...(config.globalConfig !== undefined && {
            globalConfig:
              config.globalConfig as unknown as Prisma.InputJsonValue,
          }),
          ...(config.maxConcurrentSubagents !== undefined && {
            maxConcurrentSubagents: config.maxConcurrentSubagents,
          }),
          ...(config.tokenBudgetPerHour !== undefined && {
            tokenBudgetPerHour: config.tokenBudgetPerHour,
          }),
          ...(config.worktreeConfig !== undefined && {
            worktreeConfig:
              config.worktreeConfig as unknown as Prisma.InputJsonValue,
          }),
          ...(config.pluginConfigs !== undefined && {
            pluginConfigs:
              config.pluginConfigs as unknown as Prisma.InputJsonValue,
          }),
          ...(config.skillDefinitions !== undefined && {
            skillDefinitions:
              config.skillDefinitions as unknown as Prisma.InputJsonValue,
          }),
          ...(config.contextConfig !== undefined && {
            contextConfig:
              config.contextConfig as unknown as Prisma.InputJsonValue,
          }),
          ...(config.mcpTools !== undefined && { mcpTools: config.mcpTools }),
          ...(config.config !== undefined && {
            config: config.config as unknown as Prisma.InputJsonValue,
          }),
          ...(config.status !== undefined && { status: config.status }),
        },
      });

      return this.mapToRecord(record);
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new SessionManagerPersistenceError(
        'updateSessionManager',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Assigns subagents to a session manager using a transaction.
   */
  async assignAgents(
    sessionManagerId: string,
    agentIds: string[]
  ): Promise<AssignAgentsResult> {
    // Verify session manager exists
    const sm = await this.db.sessionManager.findUnique({
      where: { id: sessionManagerId },
      select: { id: true },
    });

    if (!sm) {
      throw new SessionManagerPersistenceNotFoundError(sessionManagerId);
    }

    if (agentIds.length === 0) {
      return { assigned: 0, agentIds: [] };
    }

    try {
      await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.subagent.updateMany({
          where: { id: { in: agentIds } },
          data: { sessionManagerId },
        });
      });

      return { assigned: agentIds.length, agentIds };
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new SessionManagerPersistenceError(
        'assignAgents',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Validates create session manager inputs.
   */
  private validateCreateInput(
    orchestratorId: string,
    config: CreateSessionManagerConfig
  ): void {
    const errors: Record<string, string[]> = {};

    if (!orchestratorId || orchestratorId.trim().length === 0) {
      errors.orchestratorId = ['Orchestrator ID is required'];
    }

    if (!config.name || config.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (config.name.length > 200) {
      errors.name = ['Name must be 200 characters or less'];
    }

    if (!config.charterId || config.charterId.trim().length === 0) {
      errors.charterId = ['Charter ID is required'];
    }

    if (!config.charterData || typeof config.charterData !== 'object') {
      errors.charterData = ['Charter data must be a valid object'];
    }

    if (
      config.maxConcurrentSubagents !== undefined &&
      config.maxConcurrentSubagents < 1
    ) {
      errors.maxConcurrentSubagents = [
        'Max concurrent subagents must be at least 1',
      ];
    }

    if (
      config.tokenBudgetPerHour !== undefined &&
      config.tokenBudgetPerHour < 0
    ) {
      errors.tokenBudgetPerHour = ['Token budget per hour cannot be negative'];
    }

    if (Object.keys(errors).length > 0) {
      throw new SessionManagerPersistenceValidationError(
        'Session manager creation validation failed',
        errors
      );
    }
  }

  /**
   * Maps a raw Prisma sessionManager row to PersistedSessionManager.
   */
  private mapToRecord(row: {
    id: string;
    name: string;
    description: string | null;
    charterId: string;
    charterData: Prisma.JsonValue;
    disciplineId: string | null;
    orchestratorId: string;
    isGlobal: boolean;
    globalConfig: Prisma.JsonValue | null;
    status: AgentStatus;
    maxConcurrentSubagents: number;
    tokenBudgetPerHour: number;
    worktreeConfig: Prisma.JsonValue | null;
    pluginConfigs: Prisma.JsonValue;
    skillDefinitions: Prisma.JsonValue;
    contextConfig: Prisma.JsonValue;
    mcpTools: string[];
    config: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): PersistedSessionManager {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      charterId: row.charterId,
      charterData: row.charterData as Record<string, unknown>,
      disciplineId: row.disciplineId,
      orchestratorId: row.orchestratorId,
      isGlobal: row.isGlobal,
      globalConfig: row.globalConfig as Record<string, unknown> | null,
      status: row.status,
      maxConcurrentSubagents: row.maxConcurrentSubagents,
      tokenBudgetPerHour: row.tokenBudgetPerHour,
      worktreeConfig: row.worktreeConfig as Record<string, unknown> | null,
      pluginConfigs: row.pluginConfigs,
      skillDefinitions: row.skillDefinitions,
      contextConfig: row.contextConfig as Record<string, unknown>,
      mcpTools: row.mcpTools,
      config: row.config as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new SessionManagerPersistenceService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Session manager persistence service instance
 *
 * @example
 * ```typescript
 * const smPersistence = createSessionManagerPersistenceService();
 *
 * // Create a session manager for an orchestrator
 * const sm = await smPersistence.createSessionManager(orchestratorId, {
 *   name: 'Frontend Session Manager',
 *   charterId: 'sm-frontend-001',
 *   charterData: sessionManagerCharter,
 *   disciplineId: 'frontend',
 * });
 *
 * // Assign generated agents to it
 * await smPersistence.assignAgents(sm.id, agentIds);
 *
 * // List all session managers for an orchestrator
 * const managers = await smPersistence.listSessionManagers(orchestratorId);
 * ```
 */
export function createSessionManagerPersistenceService(
  database?: PrismaClient
): SessionManagerPersistenceServiceImpl {
  return new SessionManagerPersistenceServiceImpl(database);
}

/**
 * Default session manager persistence service instance using the singleton Prisma client.
 */
export const sessionManagerPersistenceService =
  createSessionManagerPersistenceService();
