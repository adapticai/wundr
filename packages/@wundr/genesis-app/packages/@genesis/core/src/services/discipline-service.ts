/**
 * @genesis/core - Discipline Service
 *
 * Service layer for discipline management. Disciplines are functional areas
 * derived from VP discipline fields. This service provides virtual discipline
 * entities for organizational structure.
 *
 * @packageDocumentation
 */

import type { PrismaClient, Prisma } from '@genesis/database';
import { prisma } from '@genesis/database';

import {
  GenesisError,
  OrganizationNotFoundError,
} from '../errors';
import { generateSlug } from '../utils';

import type {
  Discipline,
  DisciplineWithVPs,
  VPBasic,
  CreateDisciplineInput,
  UpdateDisciplineInput,
  ListDisciplinesOptions,
  PaginatedDisciplineResult,
} from '../types/organization';
import type { VP } from '@genesis/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a discipline is not found.
 */
export class DisciplineNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'name' = 'id') {
    super(
      `Discipline not found with ${identifierType}: ${identifier}`,
      'DISCIPLINE_NOT_FOUND',
      404,
      { identifier, identifierType }
    );
    this.name = 'DisciplineNotFoundError';
  }
}

/**
 * Error thrown when a discipline already exists.
 */
export class DisciplineAlreadyExistsError extends GenesisError {
  constructor(name: string, organizationId: string) {
    super(
      `Discipline '${name}' already exists in organization`,
      'DISCIPLINE_ALREADY_EXISTS',
      409,
      { name, organizationId }
    );
    this.name = 'DisciplineAlreadyExistsError';
  }
}

/**
 * Error thrown when discipline validation fails.
 */
export class DisciplineValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'DISCIPLINE_VALIDATION_ERROR', 400, { errors });
    this.name = 'DisciplineValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a VP is not found.
 */
export class VPNotFoundError extends GenesisError {
  constructor(vpId: string) {
    super(
      `VP not found: ${vpId}`,
      'VP_NOT_FOUND',
      404,
      { vpId }
    );
    this.name = 'VPNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for discipline operations.
 *
 * Note: Disciplines are not stored as separate database entities.
 * They are derived from the VP.discipline field and managed virtually.
 * Discipline metadata (description, etc.) is stored in organization settings.
 */
export interface DisciplineService {
  /**
   * Creates a new discipline (stores metadata in organization settings).
   *
   * @param data - Discipline creation input
   * @returns The created discipline
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {DisciplineAlreadyExistsError} If a discipline with the name already exists
   * @throws {DisciplineValidationError} If validation fails
   */
  createDiscipline(data: CreateDisciplineInput): Promise<Discipline>;

  /**
   * Gets a discipline by ID.
   *
   * @param id - The discipline ID (normalized name)
   * @returns The discipline, or null if not found
   */
  getDiscipline(id: string): Promise<Discipline | null>;

  /**
   * Lists all disciplines in an organization.
   *
   * @param orgId - The organization ID
   * @returns Array of disciplines
   */
  listDisciplines(orgId: string): Promise<Discipline[]>;

  /**
   * Updates a discipline.
   *
   * @param id - The discipline ID
   * @param data - Update data
   * @returns The updated discipline
   * @throws {DisciplineNotFoundError} If the discipline doesn't exist
   */
  updateDiscipline(id: string, data: UpdateDisciplineInput): Promise<Discipline>;

  /**
   * Deletes a discipline (removes metadata, does not delete VPs).
   *
   * @param id - The discipline ID
   * @throws {DisciplineNotFoundError} If the discipline doesn't exist
   */
  deleteDiscipline(id: string): Promise<void>;

  // VP mapping

  /**
   * Assigns a VP to a discipline.
   *
   * @param vpId - The VP ID
   * @param disciplineId - The discipline ID (name)
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  assignVPToDiscipline(vpId: string, disciplineId: string): Promise<void>;

  /**
   * Removes a VP from its discipline (sets discipline to empty).
   *
   * @param vpId - The VP ID
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  removeVPFromDiscipline(vpId: string): Promise<void>;

  /**
   * Gets all VPs in a discipline.
   *
   * @param disciplineId - The discipline ID (name)
   * @returns Array of VPs
   */
  getVPsInDiscipline(disciplineId: string): Promise<VP[]>;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Discipline metadata stored in organization settings.
 */
interface DisciplineMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Organization settings structure for disciplines.
 */
interface OrganizationDisciplineSettings {
  disciplines?: Record<string, DisciplineMetadata>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Discipline service implementation.
 *
 * Disciplines are derived from VP.discipline fields and managed through
 * organization settings for metadata storage.
 */
export class DisciplineServiceImpl implements DisciplineService {
  private readonly db: PrismaClient;

  /**
   * Creates a new DisciplineServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Discipline CRUD Operations
  // ===========================================================================

  /**
   * Creates a new discipline.
   */
  async createDiscipline(data: CreateDisciplineInput): Promise<Discipline> {
    // Validate input
    this.validateCreateInput(data);

    // Verify organization exists
    const organization = await this.db.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(data.organizationId);
    }

    // Generate discipline ID from name
    const disciplineId = generateSlug(data.name);

    // Get current settings
    const settings = (organization.settings as OrganizationDisciplineSettings) || {};
    const disciplines = settings.disciplines || {};

    // Check if discipline already exists
    if (disciplines[disciplineId]) {
      throw new DisciplineAlreadyExistsError(data.name, data.organizationId);
    }

    // Create discipline metadata
    const now = new Date().toISOString();
    const metadata: DisciplineMetadata = {
      id: disciplineId,
      name: data.name,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };

    // Update organization settings
    disciplines[disciplineId] = metadata;
    await this.db.organization.update({
      where: { id: data.organizationId },
      data: {
        settings: {
          ...settings,
          disciplines,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Get VP count for this discipline
    const vpCount = await this.db.vP.count({
      where: {
        organizationId: data.organizationId,
        discipline: data.name,
      },
    });

    return {
      id: disciplineId,
      name: data.name,
      description: data.description,
      organizationId: data.organizationId,
      vpCount,
      createdAt: new Date(metadata.createdAt),
    };
  }

  /**
   * Gets a discipline by ID.
   */
  async getDiscipline(id: string): Promise<Discipline | null> {
    // Parse discipline ID to extract organization context
    // For now, we need to search all organizations
    // In a real implementation, you might pass organizationId as a parameter

    const organizations = await this.db.organization.findMany({
      select: {
        id: true,
        settings: true,
      },
    });

    for (const org of organizations) {
      const settings = (org.settings as OrganizationDisciplineSettings) || {};
      const disciplines = settings.disciplines || {};

      if (disciplines[id]) {
        const metadata = disciplines[id];
        const vpCount = await this.db.vP.count({
          where: {
            organizationId: org.id,
            discipline: metadata.name,
          },
        });

        return {
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          organizationId: org.id,
          vpCount,
          createdAt: new Date(metadata.createdAt),
        };
      }
    }

    return null;
  }

  /**
   * Gets a discipline by ID within a specific organization.
   *
   * @param id - The discipline ID
   * @param organizationId - The organization ID
   * @returns The discipline, or null if not found
   */
  async getDisciplineInOrg(id: string, organizationId: string): Promise<Discipline | null> {
    const organization = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return null;
    }

    const settings = (organization.settings as OrganizationDisciplineSettings) || {};
    const disciplines = settings.disciplines || {};

    if (!disciplines[id]) {
      return null;
    }

    const metadata = disciplines[id];
    const vpCount = await this.db.vP.count({
      where: {
        organizationId,
        discipline: metadata.name,
      },
    });

    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      organizationId,
      vpCount,
      createdAt: new Date(metadata.createdAt),
    };
  }

  /**
   * Lists all disciplines in an organization.
   */
  async listDisciplines(orgId: string): Promise<Discipline[]> {
    const organization = await this.db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(orgId);
    }

    const settings = (organization.settings as OrganizationDisciplineSettings) || {};
    const disciplineMetadata = settings.disciplines || {};

    // Also get disciplines from VPs that may not have metadata
    const vpDisciplines = await this.db.vP.findMany({
      where: { organizationId: orgId },
      select: {
        discipline: true,
        createdAt: true,
      },
      distinct: ['discipline'],
    });

    // Create a map of all disciplines
    const disciplineMap = new Map<string, Discipline>();

    // Add disciplines from metadata
    for (const [id, metadata] of Object.entries(disciplineMetadata)) {
      const vpCount = await this.db.vP.count({
        where: {
          organizationId: orgId,
          discipline: metadata.name,
        },
      });

      disciplineMap.set(metadata.name, {
        id,
        name: metadata.name,
        description: metadata.description,
        organizationId: orgId,
        vpCount,
        createdAt: new Date(metadata.createdAt),
      });
    }

    // Add disciplines from VPs that don't have metadata
    for (const vp of vpDisciplines) {
      if (!disciplineMap.has(vp.discipline)) {
        const id = generateSlug(vp.discipline);
        const vpCount = await this.db.vP.count({
          where: {
            organizationId: orgId,
            discipline: vp.discipline,
          },
        });

        disciplineMap.set(vp.discipline, {
          id,
          name: vp.discipline,
          organizationId: orgId,
          vpCount,
          createdAt: vp.createdAt,
        });
      }
    }

    // Sort by name
    return Array.from(disciplineMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Lists disciplines with pagination.
   *
   * @param orgId - The organization ID
   * @param options - Query options
   * @returns Paginated discipline results
   */
  async listDisciplinesWithPagination(
    orgId: string,
    options: ListDisciplinesOptions = {}
  ): Promise<PaginatedDisciplineResult> {
    const {
      includeEmpty = true,
      skip = 0,
      take = 20,
      orderBy = 'name',
      orderDirection = 'asc',
    } = options;

    let disciplines = await this.listDisciplines(orgId);

    // Filter empty disciplines if needed
    if (!includeEmpty) {
      disciplines = disciplines.filter((d) => d.vpCount > 0);
    }

    // Sort
    disciplines.sort((a, b) => {
      let comparison = 0;
      switch (orderBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'vpCount':
          comparison = a.vpCount - b.vpCount;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      return orderDirection === 'asc' ? comparison : -comparison;
    });

    const total = disciplines.length;
    const data = disciplines.slice(skip, skip + take);
    const lastItem = data[data.length - 1];

    return {
      data,
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Updates a discipline.
   */
  async updateDiscipline(id: string, data: UpdateDisciplineInput): Promise<Discipline> {
    // Validate input
    this.validateUpdateInput(data);

    // Find the discipline
    const discipline = await this.getDiscipline(id);
    if (!discipline) {
      throw new DisciplineNotFoundError(id);
    }

    const organization = await this.db.organization.findUnique({
      where: { id: discipline.organizationId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(discipline.organizationId);
    }

    const settings = (organization.settings as OrganizationDisciplineSettings) || {};
    const disciplines = settings.disciplines || {};

    if (!disciplines[id]) {
      // Create metadata if it doesn't exist
      disciplines[id] = {
        id,
        name: discipline.name,
        createdAt: discipline.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Update metadata
    const oldName = disciplines[id].name;
    if (data.name !== undefined) {
      disciplines[id].name = data.name;
    }
    if (data.description !== undefined) {
      disciplines[id].description = data.description;
    }
    disciplines[id].updatedAt = new Date().toISOString();

    // Update organization settings
    await this.db.organization.update({
      where: { id: discipline.organizationId },
      data: {
        settings: {
          ...settings,
          disciplines,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // If name changed, update all VPs with this discipline
    if (data.name && data.name !== oldName) {
      await this.db.vP.updateMany({
        where: {
          organizationId: discipline.organizationId,
          discipline: oldName,
        },
        data: {
          discipline: data.name,
        },
      });
    }

    // Get updated VP count
    const vpCount = await this.db.vP.count({
      where: {
        organizationId: discipline.organizationId,
        discipline: data.name || oldName,
      },
    });

    return {
      id,
      name: disciplines[id].name,
      description: disciplines[id].description,
      organizationId: discipline.organizationId,
      vpCount,
      createdAt: new Date(disciplines[id].createdAt),
    };
  }

  /**
   * Deletes a discipline (removes metadata only).
   */
  async deleteDiscipline(id: string): Promise<void> {
    const discipline = await this.getDiscipline(id);
    if (!discipline) {
      throw new DisciplineNotFoundError(id);
    }

    const organization = await this.db.organization.findUnique({
      where: { id: discipline.organizationId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(discipline.organizationId);
    }

    const settings = (organization.settings as OrganizationDisciplineSettings) || {};
    const disciplines = settings.disciplines || {};

    // Remove discipline metadata
    delete disciplines[id];

    // Update organization settings
    await this.db.organization.update({
      where: { id: discipline.organizationId },
      data: {
        settings: {
          ...settings,
          disciplines,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ===========================================================================
  // VP Mapping Operations
  // ===========================================================================

  /**
   * Assigns a VP to a discipline.
   */
  async assignVPToDiscipline(vpId: string, disciplineId: string): Promise<void> {
    // Verify VP exists
    const vp = await this.db.vP.findUnique({
      where: { id: vpId },
    });

    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Get discipline name from ID or use ID as name
    const discipline = await this.getDisciplineInOrg(disciplineId, vp.organizationId);
    const disciplineName = discipline?.name || disciplineId;

    // Update VP discipline
    await this.db.vP.update({
      where: { id: vpId },
      data: { discipline: disciplineName },
    });
  }

  /**
   * Removes a VP from its discipline.
   */
  async removeVPFromDiscipline(vpId: string): Promise<void> {
    // Verify VP exists
    const vp = await this.db.vP.findUnique({
      where: { id: vpId },
    });

    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Set discipline to empty string (unassigned)
    await this.db.vP.update({
      where: { id: vpId },
      data: { discipline: 'Unassigned' },
    });
  }

  /**
   * Gets all VPs in a discipline.
   */
  async getVPsInDiscipline(disciplineId: string): Promise<VP[]> {
    // First try to find discipline metadata to get the name
    const discipline = await this.getDiscipline(disciplineId);
    const disciplineName = discipline?.name || disciplineId;

    const vps = await this.db.vP.findMany({
      where: { discipline: disciplineName },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return vps;
  }

  /**
   * Gets all VPs in a discipline within a specific organization.
   *
   * @param disciplineId - The discipline ID
   * @param organizationId - The organization ID
   * @returns Array of VPs with user data
   */
  async getVPsInDisciplineInOrg(disciplineId: string, organizationId: string): Promise<VP[]> {
    const discipline = await this.getDisciplineInOrg(disciplineId, organizationId);
    const disciplineName = discipline?.name || disciplineId;

    const vps = await this.db.vP.findMany({
      where: {
        discipline: disciplineName,
        organizationId,
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return vps;
  }

  /**
   * Gets a discipline with its VPs.
   *
   * @param id - The discipline ID
   * @param organizationId - The organization ID
   * @returns Discipline with VPs, or null if not found
   */
  async getDisciplineWithVPs(id: string, organizationId: string): Promise<DisciplineWithVPs | null> {
    const discipline = await this.getDisciplineInOrg(id, organizationId);
    if (!discipline) {
      return null;
    }

    const vps = await this.getVPsInDisciplineInOrg(id, organizationId);

    const vpBasics: VPBasic[] = vps.map((vp) => ({
      id: vp.id,
      role: vp.role,
      status: vp.status,
      user: {
        id: (vp as VP & { user: { id: string; name: string | null; email: string; avatarUrl: string | null } }).user.id,
        name: (vp as VP & { user: { id: string; name: string | null; email: string; avatarUrl: string | null } }).user.name,
        email: (vp as VP & { user: { id: string; name: string | null; email: string; avatarUrl: string | null } }).user.email,
        avatarUrl: (vp as VP & { user: { id: string; name: string | null; email: string; avatarUrl: string | null } }).user.avatarUrl,
      },
    }));

    return {
      ...discipline,
      vps: vpBasics,
    };
  }

  // ===========================================================================
  // Private Validation Methods
  // ===========================================================================

  /**
   * Validates create discipline input.
   */
  private validateCreateInput(data: CreateDisciplineInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (data.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (!data.organizationId) {
      errors.organizationId = ['Organization ID is required'];
    }

    if (data.description && data.description.length > 1000) {
      errors.description = ['Description must be 1000 characters or less'];
    }

    if (Object.keys(errors).length > 0) {
      throw new DisciplineValidationError('Discipline validation failed', errors);
    }
  }

  /**
   * Validates update discipline input.
   */
  private validateUpdateInput(data: UpdateDisciplineInput): void {
    const errors: Record<string, string[]> = {};

    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        errors.name = ['Name cannot be empty'];
      } else if (data.name.length > 100) {
        errors.name = ['Name must be 100 characters or less'];
      }
    }

    if (data.description && data.description.length > 1000) {
      errors.description = ['Description must be 1000 characters or less'];
    }

    if (Object.keys(errors).length > 0) {
      throw new DisciplineValidationError('Discipline validation failed', errors);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new discipline service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Discipline service instance
 *
 * @example
 * ```typescript
 * const disciplineService = createDisciplineService();
 *
 * // Create a new discipline
 * const discipline = await disciplineService.createDiscipline({
 *   name: 'Engineering',
 *   description: 'Software engineering discipline',
 *   organizationId: 'org_123',
 * });
 *
 * // Assign a VP to the discipline
 * await disciplineService.assignVPToDiscipline('vp_456', discipline.id);
 *
 * // List VPs in the discipline
 * const vps = await disciplineService.getVPsInDiscipline(discipline.id);
 * ```
 */
export function createDisciplineService(database?: PrismaClient): DisciplineServiceImpl {
  return new DisciplineServiceImpl(database);
}

/**
 * Default discipline service instance using the singleton Prisma client.
 */
export const disciplineService = createDisciplineService();
