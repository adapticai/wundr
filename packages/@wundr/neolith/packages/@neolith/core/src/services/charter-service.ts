/**
 * @neolith/core - Charter Service
 *
 * Service layer for organizational charter management. Provides CRUD operations
 * for charters including versioning, active charter management, history tracking,
 * and validation.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError } from '../errors';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Charter Model Type
// =============================================================================

/**
 * Charter record type matching the Prisma schema charter model.
 * Defined locally until the @neolith/database package re-exports this type
 * after prisma generate reflects the charter model.
 */
export interface Charter {
  id: string;
  name: string;
  mission: string;
  vision: string | null;
  values: string[];
  principles: string[];
  governance: Record<string, unknown>;
  security: Record<string, unknown>;
  communication: Record<string, unknown>;
  isActive: boolean;
  version: number;
  parentCharterId: string | null;
  organizationId: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a charter is not found.
 */
export class CharterNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Charter not found: ${id}`, 'CHARTER_NOT_FOUND', 404, { id });
    this.name = 'CharterNotFoundError';
  }
}

/**
 * Error thrown when charter validation fails.
 */
export class CharterValidationError extends GenesisError {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
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
// Input Types
// =============================================================================

export interface CreateCharterInput {
  name: string;
  mission: string;
  vision?: string;
  values: string[];
  principles?: string[];
  governance?: Record<string, unknown>;
  security?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  organizationId: string;
  parentCharterId?: string;
  createdById?: string;
}

export interface UpdateCharterInput {
  name?: string;
  mission?: string;
  vision?: string;
  values?: string[];
  principles?: string[];
  governance?: Record<string, unknown>;
  security?: Record<string, unknown>;
  communication?: Record<string, unknown>;
}

export interface CharterValidationResult {
  valid: boolean;
  errors: string[];
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for charter management operations.
 */
export interface CharterService {
  /**
   * Creates a new charter for an organization, deactivating any existing active charter.
   *
   * @param data - Charter creation input
   * @returns The created charter
   */
  createCharter(data: CreateCharterInput): Promise<Charter>;

  /**
   * Updates a charter by creating a new versioned copy and deactivating the current version.
   *
   * @param id - The charter ID
   * @param data - Update data
   * @returns The new charter version
   * @throws {CharterNotFoundError} If the charter doesn't exist
   */
  updateCharter(id: string, data: UpdateCharterInput): Promise<Charter>;

  /**
   * Gets a charter by ID.
   *
   * @param id - The charter ID
   * @returns The charter with organization info, or null if not found
   */
  getCharter(id: string): Promise<Charter | null>;

  /**
   * Gets the currently active charter for an organization.
   *
   * @param organizationId - The organization ID
   * @returns The active charter, or null if none active
   */
  getActiveCharter(organizationId: string): Promise<Charter | null>;

  /**
   * Gets the full version history of charters for an organization.
   *
   * @param organizationId - The organization ID
   * @returns Array of charters ordered by version descending
   */
  getCharterHistory(organizationId: string): Promise<Charter[]>;

  /**
   * Deletes a charter.
   *
   * @param id - The charter ID
   * @throws {CharterNotFoundError} If the charter doesn't exist
   */
  deleteCharter(id: string): Promise<void>;

  /**
   * Validates charter data for completeness and correctness.
   *
   * @param data - Partial charter data to validate
   * @returns Validation result with errors if any
   */
  validateCharter(data: {
    mission?: string;
    values?: string[];
  }): CharterValidationResult;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Charter service implementation.
 *
 * Manages organizational charters with CRUD operations, version tracking,
 * and active charter management.
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

  // Accessor for the charter model delegate.
  // Uses 'as any' because the @neolith/database dist types predate the
  // charter model addition to the Prisma schema. Remove once prisma generate
  // is run and the database package is rebuilt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get charterDelegate(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.db as any).charter;
  }

  // ===========================================================================
  // Charter CRUD Operations
  // ===========================================================================

  /**
   * Creates a new charter for an organization.
   * Deactivates any existing active charter before creating the new one.
   */
  async createCharter(data: CreateCharterInput): Promise<Charter> {
    // Deactivate any existing active charter for this org
    await this.charterDelegate.updateMany({
      where: { organizationId: data.organizationId, isActive: true },
      data: { isActive: false },
    });

    return this.charterDelegate.create({
      data: {
        name: data.name,
        mission: data.mission,
        vision: data.vision,
        values: data.values,
        principles: data.principles ?? [],
        governance: data.governance ?? {},
        security: data.security ?? {},
        communication: data.communication ?? {},
        organizationId: data.organizationId,
        parentCharterId: data.parentCharterId,
        createdById: data.createdById,
        isActive: true,
        version: 1,
      },
    });
  }

  /**
   * Updates a charter by creating a new versioned copy.
   * Deactivates the current version and creates a new one with incremented version number.
   */
  async updateCharter(id: string, data: UpdateCharterInput): Promise<Charter> {
    const existing = await this.charterDelegate.findUnique({ where: { id } });
    if (!existing) {
      throw new CharterNotFoundError(id);
    }

    // Deactivate current version
    await this.charterDelegate.update({
      where: { id },
      data: { isActive: false },
    });

    // Create new version
    return this.charterDelegate.create({
      data: {
        name: data.name ?? existing.name,
        mission: data.mission ?? existing.mission,
        vision: data.vision ?? existing.vision,
        values: data.values ?? existing.values,
        principles: data.principles ?? existing.principles,
        governance:
          data.governance ?? (existing.governance as Record<string, unknown>),
        security:
          data.security ?? (existing.security as Record<string, unknown>),
        communication:
          data.communication ??
          (existing.communication as Record<string, unknown>),
        organizationId: existing.organizationId,
        parentCharterId: existing.parentCharterId,
        createdById: existing.createdById,
        isActive: true,
        version: existing.version + 1,
      },
    });
  }

  /**
   * Gets a charter by ID with organization info.
   */
  async getCharter(id: string): Promise<Charter | null> {
    return this.charterDelegate.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Gets the currently active charter for an organization.
   */
  async getActiveCharter(organizationId: string): Promise<Charter | null> {
    return this.charterDelegate.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Gets the full version history of charters for an organization.
   */
  async getCharterHistory(organizationId: string): Promise<Charter[]> {
    return this.charterDelegate.findMany({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Deletes a charter.
   */
  async deleteCharter(id: string): Promise<void> {
    const existing = await this.charterDelegate.findUnique({ where: { id } });
    if (!existing) {
      throw new CharterNotFoundError(id);
    }

    await this.charterDelegate.delete({ where: { id } });
  }

  /**
   * Validates charter data for completeness and correctness.
   */
  validateCharter(data: {
    mission?: string;
    values?: string[];
  }): CharterValidationResult {
    const errors: string[] = [];

    if (!data.mission || data.mission.length < 10) {
      errors.push('Mission must be at least 10 characters');
    }

    if (!data.values || data.values.length < 1) {
      errors.push('At least one value is required');
    }

    return { valid: errors.length === 0, errors };
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
 * // Create a new charter
 * const charter = await charterService.createCharter({
 *   name: 'Engineering Charter',
 *   mission: 'Build reliable, scalable systems that power the platform.',
 *   values: ['quality', 'collaboration', 'ownership'],
 *   organizationId: 'org_123',
 * });
 *
 * // Get active charter
 * const active = await charterService.getActiveCharter('org_123');
 *
 * // View history
 * const history = await charterService.getCharterHistory('org_123');
 * ```
 */
export function createCharterService(
  database?: PrismaClient
): CharterServiceImpl {
  return new CharterServiceImpl(database);
}

/**
 * Default charter service instance using the singleton Prisma client.
 */
export const charterService = createCharterService();
