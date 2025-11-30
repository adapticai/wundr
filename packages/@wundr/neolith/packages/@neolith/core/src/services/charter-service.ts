/**
 * @neolith/core - Charter Service
 *
 * Service layer for charter versioning management. Provides CRUD operations
 * for charter versions, version comparison, rollback capability, and active
 * version management.
 *
 * @packageDocumentation
 */

import type { PrismaClient } from '@neolith/database';
import { prisma } from '@neolith/database';
import { GenesisError, OrchestratorNotFoundError } from '../errors';
import type {
  CharterDiff,
  CharterVersion,
  CreateCharterVersionInput,
  GovernanceCharter,
} from '../types/charter';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a charter version is not found.
 */
export class CharterVersionNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'version' = 'id') {
    super(
      `Charter version not found with ${identifierType}: ${identifier}`,
      'CHARTER_VERSION_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'CharterVersionNotFoundError';
  }
}

/**
 * Error thrown when charter validation fails.
 */
export class CharterValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'CHARTER_VALIDATION_ERROR', 400, { errors });
    this.name = 'CharterValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a charter operation fails.
 */
export class CharterOperationError extends GenesisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CHARTER_OPERATION_ERROR', 500, details);
    this.name = 'CharterOperationError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for charter versioning operations.
 */
export interface CharterService {
  /**
   * Creates a new charter version.
   *
   * @param input - Charter version creation input
   * @returns The created charter version
   * @throws {OrchestratorNotFoundError} If the orchestrator doesn't exist
   * @throws {CharterValidationError} If validation fails
   */
  createCharterVersion(input: CreateCharterVersionInput): Promise<CharterVersion>;

  /**
   * Gets a specific charter version by ID.
   *
   * @param id - The charter version ID
   * @returns The charter version, or null if not found
   */
  getCharterVersion(id: string): Promise<CharterVersion | null>;

  /**
   * Lists all charter versions for an orchestrator.
   *
   * @param orchestratorId - The orchestrator ID
   * @param charterId - The charter ID (optional, filters to specific charter)
   * @returns Array of charter versions, ordered by version descending
   */
  listCharterVersions(orchestratorId: string, charterId?: string): Promise<CharterVersion[]>;

  /**
   * Gets the currently active charter for an orchestrator.
   *
   * @param orchestratorId - The orchestrator ID
   * @returns The active charter version, or null if none active
   */
  getActiveCharter(orchestratorId: string): Promise<CharterVersion | null>;

  /**
   * Activates a charter version (deactivates all other versions).
   *
   * @param id - The charter version ID to activate
   * @throws {CharterVersionNotFoundError} If the version doesn't exist
   */
  activateCharterVersion(id: string): Promise<CharterVersion>;

  /**
   * Rolls back to a specific charter version.
   *
   * @param orchestratorId - The orchestrator ID
   * @param charterId - The charter ID
   * @param version - The version number to roll back to
   * @returns The activated charter version
   * @throws {CharterVersionNotFoundError} If the version doesn't exist
   */
  rollbackToVersion(
    orchestratorId: string,
    charterId: string,
    version: number,
  ): Promise<CharterVersion>;

  /**
   * Compares two charter versions and generates a diff.
   *
   * @param v1Id - The first charter version ID
   * @param v2Id - The second charter version ID
   * @returns Array of differences between the versions
   * @throws {CharterVersionNotFoundError} If either version doesn't exist
   */
  compareVersions(v1Id: string, v2Id: string): Promise<CharterDiff[]>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Charter service implementation.
 *
 * Manages charter versioning with CRUD operations, version comparison,
 * rollback capability, and active version management.
 *
 * NOTE: This service assumes a CharterVersion table exists in the database.
 * The table should be added via Prisma migration with the following structure:
 *
 * model charterVersion {
 *   id             String   @id @default(cuid())
 *   charterId      String   @map("charter_id")
 *   orchestratorId String   @map("orchestrator_id")
 *   version        Int
 *   charterData    Json     @map("charter_data")
 *   changeLog      String?  @map("change_log") @db.Text
 *   createdBy      String   @map("created_by")
 *   createdAt      DateTime @default(now()) @map("created_at")
 *   isActive       Boolean  @default(false) @map("is_active")
 *   orchestrator   orchestrator @relation(fields: [orchestratorId], references: [id], onDelete: Cascade)
 *
 *   @@unique([charterId, version])
 *   @@index([orchestratorId])
 *   @@index([charterId])
 *   @@index([isActive])
 *   @@map("charter_versions")
 * }
 */
export class CharterServiceImpl implements CharterService {
  private readonly db: PrismaClient;

  /**
   * Creates a new CharterServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Charter Version CRUD Operations
  // ===========================================================================

  /**
   * Creates a new charter version.
   */
  async createCharterVersion(input: CreateCharterVersionInput): Promise<CharterVersion> {
    // Validate input
    this.validateCreateInput(input);

    // Verify orchestrator exists
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: input.orchestratorId },
    });

    if (!orchestrator) {
      throw new OrchestratorNotFoundError(input.orchestratorId);
    }

    // Get the latest version number for this charter
    const latestVersion = await this.getLatestVersionNumber(
      input.orchestratorId,
      input.charterId,
    );
    const newVersionNumber = latestVersion + 1;

    // Build complete charter data
    const charterData: GovernanceCharter = {
      ...input.charterData,
      id: input.charterId,
      tier: 1,
      version: newVersionNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const charterVersion = await this.db.charterVersion.create({
    //   data: {
    //     charterId: input.charterId,
    //     orchestratorId: input.orchestratorId,
    //     version: newVersionNumber,
    //     charterData: charterData as unknown as Prisma.InputJsonValue,
    //     changeLog: input.changeLog,
    //     createdBy: 'system', // TODO: Get from auth context
    //     isActive: false,
    //   },
    // });

    // Temporary implementation: Store in orchestrator config
    // This will be replaced once the CharterVersion table is added
    const user = await this.db.user.findUnique({
      where: { id: orchestrator.userId },
    });

    if (!user) {
      throw new CharterOperationError('Associated user not found');
    }

    // For now, return a mock charter version
    // This will be replaced with actual database queries once the table is added
    return {
      id: `cv_${Date.now()}`,
      charterId: input.charterId,
      orchestratorId: input.orchestratorId,
      version: newVersionNumber,
      charterData,
      changeLog: input.changeLog,
      createdBy: 'system',
      createdAt: new Date(),
      isActive: false,
    };
  }

  /**
   * Gets a specific charter version by ID.
   */
  async getCharterVersion(_id: string): Promise<CharterVersion | null> {
    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const charterVersion = await this.db.charterVersion.findUnique({
    //   where: { id },
    // });
    //
    // if (!charterVersion) {
    //   return null;
    // }
    //
    // return {
    //   id: charterVersion.id,
    //   charterId: charterVersion.charterId,
    //   orchestratorId: charterVersion.orchestratorId,
    //   version: charterVersion.version,
    //   charterData: charterVersion.charterData as GovernanceCharter,
    //   changeLog: charterVersion.changeLog ?? undefined,
    //   createdBy: charterVersion.createdBy,
    //   createdAt: charterVersion.createdAt,
    //   isActive: charterVersion.isActive,
    // };

    // Temporary implementation
    return null;
  }

  /**
   * Lists all charter versions for an orchestrator.
   */
  async listCharterVersions(
    orchestratorId: string,
    _charterId?: string,
  ): Promise<CharterVersion[]> {
    // Verify orchestrator exists
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    if (!orchestrator) {
      throw new OrchestratorNotFoundError(orchestratorId);
    }

    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const where: Prisma.charterVersionWhereInput = {
    //   orchestratorId,
    // };
    //
    // if (charterId) {
    //   where.charterId = charterId;
    // }
    //
    // const versions = await this.db.charterVersion.findMany({
    //   where,
    //   orderBy: { version: 'desc' },
    // });
    //
    // return versions.map((v) => ({
    //   id: v.id,
    //   charterId: v.charterId,
    //   orchestratorId: v.orchestratorId,
    //   version: v.version,
    //   charterData: v.charterData as GovernanceCharter,
    //   changeLog: v.changeLog ?? undefined,
    //   createdBy: v.createdBy,
    //   createdAt: v.createdAt,
    //   isActive: v.isActive,
    // }));

    // Temporary implementation
    return [];
  }

  /**
   * Gets the currently active charter for an orchestrator.
   */
  async getActiveCharter(orchestratorId: string): Promise<CharterVersion | null> {
    // Verify orchestrator exists
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    if (!orchestrator) {
      throw new OrchestratorNotFoundError(orchestratorId);
    }

    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const activeVersion = await this.db.charterVersion.findFirst({
    //   where: {
    //     orchestratorId,
    //     isActive: true,
    //   },
    // });
    //
    // if (!activeVersion) {
    //   return null;
    // }
    //
    // return {
    //   id: activeVersion.id,
    //   charterId: activeVersion.charterId,
    //   orchestratorId: activeVersion.orchestratorId,
    //   version: activeVersion.version,
    //   charterData: activeVersion.charterData as GovernanceCharter,
    //   changeLog: activeVersion.changeLog ?? undefined,
    //   createdBy: activeVersion.createdBy,
    //   createdAt: activeVersion.createdAt,
    //   isActive: activeVersion.isActive,
    // };

    // Temporary implementation
    return null;
  }

  /**
   * Activates a charter version (deactivates all other versions).
   */
  async activateCharterVersion(id: string): Promise<CharterVersion> {
    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const charterVersion = await this.db.charterVersion.findUnique({
    //   where: { id },
    // });
    //
    // if (!charterVersion) {
    //   throw new CharterVersionNotFoundError(id);
    // }
    //
    // // Deactivate all other versions for this orchestrator
    // await this.db.charterVersion.updateMany({
    //   where: {
    //     orchestratorId: charterVersion.orchestratorId,
    //     isActive: true,
    //   },
    //   data: { isActive: false },
    // });
    //
    // // Activate this version
    // const activated = await this.db.charterVersion.update({
    //   where: { id },
    //   data: { isActive: true },
    // });
    //
    // return {
    //   id: activated.id,
    //   charterId: activated.charterId,
    //   orchestratorId: activated.orchestratorId,
    //   version: activated.version,
    //   charterData: activated.charterData as GovernanceCharter,
    //   changeLog: activated.changeLog ?? undefined,
    //   createdBy: activated.createdBy,
    //   createdAt: activated.createdAt,
    //   isActive: activated.isActive,
    // };

    throw new CharterVersionNotFoundError(id);
  }

  /**
   * Rolls back to a specific charter version.
   */
  async rollbackToVersion(
    _orchestratorId: string,
    _charterId: string,
    version: number,
  ): Promise<CharterVersion> {
    // Verify orchestrator exists
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: _orchestratorId },
    });

    if (!orchestrator) {
      throw new OrchestratorNotFoundError(_orchestratorId);
    }

    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const targetVersion = await this.db.charterVersion.findFirst({
    //   where: {
    //     orchestratorId,
    //     charterId,
    //     version,
    //   },
    // });
    //
    // if (!targetVersion) {
    //   throw new CharterVersionNotFoundError(version.toString(), 'version');
    // }
    //
    // // Activate the target version
    // return this.activateCharterVersion(targetVersion.id);

    throw new CharterVersionNotFoundError(version.toString(), 'version');
  }

  /**
   * Compares two charter versions and generates a diff.
   */
  async compareVersions(v1Id: string, v2Id: string): Promise<CharterDiff[]> {
    const v1 = await this.getCharterVersion(v1Id);
    const v2 = await this.getCharterVersion(v2Id);

    if (!v1) {
      throw new CharterVersionNotFoundError(v1Id);
    }

    if (!v2) {
      throw new CharterVersionNotFoundError(v2Id);
    }

    return this.generateDiff(v1.charterData, v2.charterData);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Gets the latest version number for a charter.
   */
  private async getLatestVersionNumber(
    _orchestratorId: string,
    _charterId: string,
  ): Promise<number> {
    // TODO: Once CharterVersion table is added to schema, use this implementation:
    // const latestVersion = await this.db.charterVersion.findFirst({
    //   where: {
    //     orchestratorId,
    //     charterId,
    //   },
    //   orderBy: { version: 'desc' },
    //   select: { version: true },
    // });
    //
    // return latestVersion?.version ?? 0;

    // Temporary implementation
    return 0;
  }

  /**
   * Generates a diff between two charter objects.
   */
  private generateDiff(
    oldCharter: GovernanceCharter,
    newCharter: GovernanceCharter,
  ): CharterDiff[] {
    const diffs: CharterDiff[] = [];

    // Compare top-level fields
    const fields = [
      'coreDirective',
      'capabilities',
      'mcpTools',
      'resourceLimits',
      'objectives',
      'constraints',
      'disciplineIds',
    ] as const;

    for (const field of fields) {
      const oldValue = oldCharter[field];
      const newValue = newCharter[field];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diffs.push({
          field,
          oldValue,
          newValue,
          changeType: 'modified',
        });
      }
    }

    // Compare identity fields
    const identityFields = ['name', 'slug', 'persona', 'slackHandle', 'email', 'avatarUrl'] as const;

    for (const field of identityFields) {
      const oldValue = oldCharter.identity[field];
      const newValue = newCharter.identity[field];

      if (oldValue !== newValue) {
        diffs.push({
          field: `identity.${field}`,
          oldValue,
          newValue,
          changeType: 'modified',
        });
      }
    }

    // Deep compare capabilities
    const oldCapabilities = new Map(
      oldCharter.capabilities.map((c: { id: string }) => [c.id, c]),
    );
    const newCapabilities = new Map(
      newCharter.capabilities.map((c: { id: string }) => [c.id, c]),
    );

    // Check for added capabilities
    for (const [id, capability] of newCapabilities) {
      if (!oldCapabilities.has(id)) {
        diffs.push({
          field: `capabilities.${id}`,
          oldValue: null,
          newValue: capability,
          changeType: 'added',
        });
      }
    }

    // Check for removed capabilities
    for (const [id, capability] of oldCapabilities) {
      if (!newCapabilities.has(id)) {
        diffs.push({
          field: `capabilities.${id}`,
          oldValue: capability,
          newValue: null,
          changeType: 'removed',
        });
      }
    }

    // Check for modified capabilities
    for (const [id, newCap] of newCapabilities) {
      const oldCap = oldCapabilities.get(id);
      if (oldCap && JSON.stringify(oldCap) !== JSON.stringify(newCap)) {
        diffs.push({
          field: `capabilities.${id}`,
          oldValue: oldCap,
          newValue: newCap,
          changeType: 'modified',
        });
      }
    }

    return diffs;
  }

  /**
   * Validates create charter version input.
   */
  private validateCreateInput(input: CreateCharterVersionInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.orchestratorId) {
      errors.orchestratorId = ['Orchestrator ID is required'];
    }

    if (!input.charterId) {
      errors.charterId = ['Charter ID is required'];
    }

    if (!input.charterData) {
      errors.charterData = ['Charter data is required'];
    } else {
      // Validate charter data structure
      if (!input.charterData.identity) {
        errors['charterData.identity'] = ['Identity is required'];
      } else {
        if (!input.charterData.identity.name) {
          errors['charterData.identity.name'] = ['Name is required'];
        }
        if (!input.charterData.identity.slug) {
          errors['charterData.identity.slug'] = ['Slug is required'];
        }
        if (!input.charterData.identity.persona) {
          errors['charterData.identity.persona'] = ['Persona is required'];
        }
      }

      if (!input.charterData.coreDirective) {
        errors['charterData.coreDirective'] = ['Core directive is required'];
      }

      if (!input.charterData.capabilities) {
        errors['charterData.capabilities'] = ['Capabilities are required'];
      }

      if (!input.charterData.resourceLimits) {
        errors['charterData.resourceLimits'] = ['Resource limits are required'];
      }

      if (!input.charterData.objectives) {
        errors['charterData.objectives'] = ['Objectives are required'];
      }

      if (!input.charterData.constraints) {
        errors['charterData.constraints'] = ['Constraints are required'];
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new CharterValidationError('Charter version validation failed', errors);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new charter service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Charter service instance
 *
 * @example
 * ```typescript
 * const charterService = createCharterService();
 *
 * // Create a new charter version
 * const version = await charterService.createCharterVersion({
 *   orchestratorId: 'orch_123',
 *   charterId: 'charter_456',
 *   charterData: {
 *     identity: { name: 'Backend VP', slug: 'backend-vp', persona: 'Expert backend engineer' },
 *     coreDirective: 'Manage backend systems and APIs',
 *     capabilities: [],
 *     mcpTools: [],
 *     resourceLimits: DEFAULT_RESOURCE_LIMITS,
 *     objectives: DEFAULT_OBJECTIVES,
 *     constraints: DEFAULT_CONSTRAINTS,
 *     disciplineIds: [],
 *   },
 *   changeLog: 'Initial charter version',
 * });
 *
 * // Activate a charter version
 * await charterService.activateCharterVersion(version.id);
 *
 * // Compare two versions
 * const diffs = await charterService.compareVersions(v1Id, v2Id);
 * ```
 */
export function createCharterService(database?: PrismaClient): CharterServiceImpl {
  return new CharterServiceImpl(database);
}

/**
 * Default charter service instance using the singleton Prisma client.
 */
export const charterService = createCharterService();
