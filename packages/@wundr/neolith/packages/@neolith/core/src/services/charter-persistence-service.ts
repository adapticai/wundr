/**
 * @neolith/core - Charter Persistence Service
 *
 * Persistence layer for Orchestrator charter versioning. Saves generated charters
 * to the charterVersion table, supports rollback, and tracks full history.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError } from '../errors';

import type { Prisma, PrismaClient } from '@neolith/database';

// =============================================================================
// Local Inline Types (mirrors @wundr/org-genesis charter types)
// =============================================================================

/**
 * Minimal representation of an Orchestrator Charter (Tier 1).
 * Mirrors OrchestratorCharter from @wundr/org-genesis without requiring
 * a direct package dependency.
 */
export interface OrchestratorCharterInput {
  id: string;
  tier: 1;
  [key: string]: unknown;
}

/**
 * Minimal representation of a Session Manager Charter (Tier 2).
 * Mirrors SessionManagerCharter from @wundr/org-genesis without requiring
 * a direct package dependency.
 */
export interface SessionManagerCharterInput {
  id: string;
  tier: 2;
  [key: string]: unknown;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a charter version record is not found.
 */
export class CharterVersionNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'version' = 'id') {
    super(
      `Charter version not found with ${identifierType}: ${identifier}`,
      'CHARTER_VERSION_NOT_FOUND',
      404,
      { identifier, identifierType }
    );
    this.name = 'CharterVersionNotFoundError';
  }
}

/**
 * Error thrown when charter persistence validation fails.
 */
export class CharterPersistenceValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'CHARTER_PERSISTENCE_VALIDATION_ERROR', 400, { errors });
    this.name = 'CharterPersistenceValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when charter persistence operation fails.
 */
export class CharterPersistenceError extends GenesisError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Charter persistence operation '${operation}' failed: ${originalError?.message ?? 'Unknown error'}`,
      'CHARTER_PERSISTENCE_ERROR',
      500,
      { operation, originalError: originalError?.message }
    );
    this.name = 'CharterPersistenceError';
  }
}

// =============================================================================
// Input / Output Types
// =============================================================================

/**
 * Union type for the charter JSON payload accepted by save methods.
 * Accepts either an Orchestrator charter (tier 1) or Session Manager charter (tier 2).
 */
export type CharterPayload =
  | OrchestratorCharterInput
  | SessionManagerCharterInput;

/**
 * Saved charter version record returned from the database.
 */
export interface CharterVersionRecord {
  id: string;
  charterId: string;
  orchestratorId: string;
  version: number;
  charterData: Record<string, unknown>;
  changeLog: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for charter persistence operations.
 */
export interface CharterPersistenceService {
  /**
   * Saves a generated charter as a new version in the charterVersion table.
   * Deactivates the previous active version and marks the new one as active.
   *
   * @param orchestratorId - ID of the orchestrator that owns the charter
   * @param charter - The charter payload to persist
   * @param options - Optional save configuration
   * @returns The newly created charter version record
   * @throws {CharterPersistenceValidationError} If input validation fails
   * @throws {CharterPersistenceError} If the database operation fails
   */
  saveOrchestratorCharter(
    orchestratorId: string,
    charter: CharterPayload,
    options?: SaveCharterOptions
  ): Promise<CharterVersionRecord>;

  /**
   * Gets the most recent active charter version for an orchestrator.
   *
   * @param orchestratorId - ID of the orchestrator
   * @returns The most recent active charter version, or null if none exists
   */
  getLatestCharter(
    orchestratorId: string
  ): Promise<CharterVersionRecord | null>;

  /**
   * Lists all charter versions for an orchestrator in descending version order.
   *
   * @param orchestratorId - ID of the orchestrator
   * @returns Array of charter version records ordered newest first
   */
  getCharterHistory(orchestratorId: string): Promise<CharterVersionRecord[]>;

  /**
   * Sets a previous charter version as the active one.
   * Deactivates the currently active version in a transaction.
   *
   * @param orchestratorId - ID of the orchestrator
   * @param versionId - ID of the charter version record to restore
   * @returns The newly activated charter version record
   * @throws {CharterVersionNotFoundError} If the version record does not exist or does not belong to the orchestrator
   * @throws {CharterPersistenceError} If the transaction fails
   */
  rollbackCharter(
    orchestratorId: string,
    versionId: string
  ): Promise<CharterVersionRecord>;
}

/**
 * Options available when saving a charter.
 */
export interface SaveCharterOptions {
  /** Human-readable description of what changed in this version */
  changeLog?: string;
  /** User ID of the actor saving this charter. Defaults to 'system' */
  createdBy?: string;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Implementation of the CharterPersistenceService.
 */
export class CharterPersistenceServiceImpl implements CharterPersistenceService {
  private readonly db: PrismaClient;

  /**
   * Creates a new CharterPersistenceServiceImpl instance.
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
   * Saves a charter as a new version, marking it as the active version.
   */
  async saveOrchestratorCharter(
    orchestratorId: string,
    charter: CharterPayload,
    options: SaveCharterOptions = {}
  ): Promise<CharterVersionRecord> {
    this.validateSaveInput(orchestratorId, charter);

    const { changeLog, createdBy = 'system' } = options;
    const charterId = charter.id;

    try {
      const result = await this.db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Determine the next version number for this charter within this orchestrator
          const latestVersion = await tx.charterVersion.findFirst({
            where: { orchestratorId, charterId },
            orderBy: { version: 'desc' },
            select: { version: true },
          });

          const nextVersion = (latestVersion?.version ?? 0) + 1;

          // Deactivate all existing active versions for this orchestrator + charterId
          await tx.charterVersion.updateMany({
            where: { orchestratorId, charterId, isActive: true },
            data: { isActive: false },
          });

          // Create the new version as active
          const newVersion = await tx.charterVersion.create({
            data: {
              charterId,
              orchestratorId,
              version: nextVersion,
              charterData: charter as unknown as Prisma.InputJsonValue,
              changeLog: changeLog ?? null,
              createdBy,
              isActive: true,
            },
          });

          return newVersion;
        }
      );

      return this.mapToRecord(result);
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new CharterPersistenceError(
        'saveOrchestratorCharter',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Returns the most recent active charter version for an orchestrator.
   */
  async getLatestCharter(
    orchestratorId: string
  ): Promise<CharterVersionRecord | null> {
    // First attempt: active version
    const active = await this.db.charterVersion.findFirst({
      where: { orchestratorId, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (active) {
      return this.mapToRecord(active);
    }

    // Fallback: highest version number regardless of active flag
    const latest = await this.db.charterVersion.findFirst({
      where: { orchestratorId },
      orderBy: { version: 'desc' },
    });

    return latest ? this.mapToRecord(latest) : null;
  }

  /**
   * Returns the full version history for an orchestrator, newest first.
   */
  async getCharterHistory(
    orchestratorId: string
  ): Promise<CharterVersionRecord[]> {
    const versions = await this.db.charterVersion.findMany({
      where: { orchestratorId },
      orderBy: { version: 'desc' },
    });

    return versions.map(v => this.mapToRecord(v));
  }

  /**
   * Restores a previous charter version as the active one.
   */
  async rollbackCharter(
    orchestratorId: string,
    versionId: string
  ): Promise<CharterVersionRecord> {
    // Verify the target version exists and belongs to this orchestrator
    const target = await this.db.charterVersion.findFirst({
      where: { id: versionId, orchestratorId },
    });

    if (!target) {
      throw new CharterVersionNotFoundError(versionId);
    }

    // Already active - no-op but return the record
    if (target.isActive) {
      return this.mapToRecord(target);
    }

    try {
      const result = await this.db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Deactivate all currently active versions for this orchestrator
          await tx.charterVersion.updateMany({
            where: { orchestratorId, isActive: true },
            data: { isActive: false },
          });

          // Activate the target version
          const activated = await tx.charterVersion.update({
            where: { id: versionId },
            data: { isActive: true },
          });

          return activated;
        }
      );

      return this.mapToRecord(result);
    } catch (error) {
      if (error instanceof GenesisError) {
        throw error;
      }
      throw new CharterPersistenceError(
        'rollbackCharter',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Validates the inputs for saveOrchestratorCharter.
   */
  private validateSaveInput(
    orchestratorId: string,
    charter: CharterPayload
  ): void {
    const errors: Record<string, string[]> = {};

    if (!orchestratorId || orchestratorId.trim().length === 0) {
      errors.orchestratorId = ['Orchestrator ID is required'];
    }

    if (!charter) {
      errors.charter = ['Charter payload is required'];
    } else {
      if (!charter.id || charter.id.trim().length === 0) {
        errors['charter.id'] = ['Charter ID is required'];
      }
      if (charter.tier !== 1 && charter.tier !== 2) {
        errors['charter.tier'] = ['Charter tier must be 1 or 2'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new CharterPersistenceValidationError(
        'Charter save validation failed',
        errors
      );
    }
  }

  /**
   * Maps a raw Prisma charterVersion record to the typed CharterVersionRecord.
   */
  private mapToRecord(row: {
    id: string;
    charterId: string;
    orchestratorId: string;
    version: number;
    charterData: Prisma.JsonValue;
    changeLog: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
  }): CharterVersionRecord {
    return {
      id: row.id,
      charterId: row.charterId,
      orchestratorId: row.orchestratorId,
      version: row.version,
      charterData: row.charterData as Record<string, unknown>,
      changeLog: row.changeLog,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isActive: row.isActive,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new CharterPersistenceService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Charter persistence service instance
 *
 * @example
 * ```typescript
 * const charterPersistence = createCharterPersistenceService();
 *
 * // Save a generated charter
 * const version = await charterPersistence.saveOrchestratorCharter(orchestratorId, charter, {
 *   changeLog: 'Initial charter generation',
 *   createdBy: userId,
 * });
 *
 * // Get the latest charter
 * const latest = await charterPersistence.getLatestCharter(orchestratorId);
 *
 * // Roll back to an older version
 * await charterPersistence.rollbackCharter(orchestratorId, previousVersionId);
 * ```
 */
export function createCharterPersistenceService(
  database?: PrismaClient
): CharterPersistenceServiceImpl {
  return new CharterPersistenceServiceImpl(database);
}

/**
 * Default charter persistence service instance using the singleton Prisma client.
 */
export const charterPersistenceService = createCharterPersistenceService();
