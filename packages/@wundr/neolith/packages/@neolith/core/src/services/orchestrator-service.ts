/**
 * @genesis/core - OrchestratorService
 *
 * Service layer for Orchestrator management including CRUD operations,
 * service account management, and configuration.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import {
  APIKeyGenerationError,
  OrchestratorAlreadyExistsError,
  OrchestratorNotFoundError,
  OrchestratorValidationError,
  OrganizationNotFoundError,
  TransactionError,
} from '../errors';
import { DEFAULT_ORCHESTRATOR_CHARTER, isOrchestratorServiceAccountConfig } from '../types/orchestrator';
import {
  deepMerge,
  extractKeyPrefix,
  generateAPIKey,
  generateOrchestratorEmail,
  hashAPIKey,
  isExpired,
  isValidAPIKeyFormat,
  isValidEmail,
  verifyAPIKey,
} from '../utils';

import type {
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  CreateOrchestratorInput,
  ListOrchestratorsOptions,
  OrchestratorCharter,
  OrchestratorServiceAccountConfig,
  OrchestratorWithUser,
  PaginatedOrchestratorResult,
  UpdateOrchestratorInput,
} from '../types/orchestrator';
import type { Prisma, PrismaClient } from '@neolith/database';

// =============================================================================
// OrchestratorService Interface
// =============================================================================

/**
 * Interface for OrchestratorCRUD operations.
 */
export interface OrchestratorService {
  /**
   * Creates a new Orchestrator with associated User record.
   *
   * @param data - Orchestrator creation input
   * @returns The created Orchestrator with user data
   * @throws {VPAlreadyExistsError} If a Orchestrator with the same email already exists
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {VPValidationError} If validation fails
   */
  createVP(data: CreateOrchestratorInput): Promise<OrchestratorWithUser>;

  /**
   * Gets a Orchestrator by ID.
   *
   * @param id - The OrchestratorID
   * @returns The Orchestrator with user data, or null if not found
   */
  getVP(id: string): Promise<OrchestratorWithUser | null>;

  /**
   * Gets a Orchestrator by slug.
   *
   * @param slug - The Orchestrator's slug
   * @param organizationId - The organization ID for scoping
   * @returns The Orchestrator with user data, or null if not found
   */
  getVPBySlug(slug: string, organizationId: string): Promise<OrchestratorWithUser | null>;

  /**
   * Lists Orchestrators by organization.
   *
   * @param orgId - The organization ID
   * @param options - Listing options
   * @returns Paginated Orchestrator results
   */
  listVPsByOrganization(orgId: string, options?: ListOrchestratorsOptions): Promise<PaginatedOrchestratorResult>;

  /**
   * Lists Orchestrators by discipline.
   *
   * @param discipline - The discipline name
   * @param organizationId - Optional organization ID for scoping
   * @returns List of Orchestrators in the discipline
   */
  listVPsByDiscipline(discipline: string, organizationId?: string): Promise<OrchestratorWithUser[]>;

  /**
   * Updates a Orchestrator.
   *
   * @param id - The OrchestratorID
   * @param data - Update data
   * @returns The updated Orchestrator
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  updateVP(id: string, data: UpdateOrchestratorInput): Promise<OrchestratorWithUser>;

  /**
   * Deletes a Orchestrator and associated User record.
   *
   * @param id - The OrchestratorID
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  deleteVP(id: string): Promise<void>;

  /**
   * Activates a Orchestrator (sets status to ONLINE).
   *
   * @param id - The OrchestratorID
   * @returns The activated Orchestrator
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  activateVP(id: string): Promise<OrchestratorWithUser>;

  /**
   * Deactivates a Orchestrator (sets status to OFFLINE).
   *
   * @param id - The OrchestratorID
   * @returns The deactivated Orchestrator
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  deactivateVP(id: string): Promise<OrchestratorWithUser>;
}

/**
 * Interface for service account operations.
 */
export interface ServiceAccountService {
  /**
   * Generates a new API key for a Orchestrator.
   *
   * @param vpId - The OrchestratorID
   * @returns The generated API key (only returned once)
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   * @throws {APIKeyGenerationError} If generation fails
   */
  generateAPIKey(vpId: string): Promise<APIKeyGenerationResult>;

  /**
   * Rotates the API key for a Orchestrator.
   *
   * @param vpId - The OrchestratorID
   * @returns The new API key
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  rotateAPIKey(vpId: string): Promise<APIKeyRotationResult>;

  /**
   * Revokes the API key for a Orchestrator.
   *
   * @param vpId - The OrchestratorID
   * @throws {VPNotFoundError} If the Orchestrator doesn't exist
   */
  revokeAPIKey(vpId: string): Promise<void>;

  /**
   * Validates an API key and returns the associated Orchestrator.
   *
   * @param key - The API key to validate
   * @returns Validation result with Orchestrator if valid
   */
  validateAPIKey(key: string): Promise<APIKeyValidationResult>;
}

// =============================================================================
// OrchestratorService Implementation
// =============================================================================

/**
 * OrchestratorService implementation providing CRUD operations and service account management.
 */
export class OrchestratorServiceImpl implements OrchestratorService, ServiceAccountService {
  private readonly db: PrismaClient;

  /**
   * Creates a new OrchestratorServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // OrchestratorCRUD Operations
  // ===========================================================================

  /**
   * Creates a new Orchestrator with associated User record.
   */
  async createVP(data: CreateOrchestratorInput): Promise<OrchestratorWithUser> {
    // Validate input
    this.validateCreateInput(data);

    // Check organization exists
    const organization = await this.db.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(data.organizationId);
    }

    // Generate email if not provided
    const email = data.email || generateOrchestratorEmail(data.name, organization.slug);

    // Check if email is already taken
    const existingUser = await this.db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new OrchestratorAlreadyExistsError(email, 'email');
    }

    // Build Orchestrator config with charter
    const orchestratorConfig = this.buildVPConfig(data.charter);

    try {
      // Create Orchestrator and User in a transaction
      const result = await this.db.$transaction(async (tx) => {
        // Create User first
        const user = await tx.user.create({
          data: {
            email,
            name: data.name,
            displayName: data.name,
            status: 'ACTIVE',
            isOrchestrator: true,
            orchestratorConfig: orchestratorConfig as Prisma.InputJsonValue,
            bio: data.bio,
            avatarUrl: data.avatarUrl,
          },
        });

        // Create Orchestrator linked to User
        const orchestrator = await tx.orchestrator.create({
          data: {
            discipline: data.discipline,
            role: data.role,
            capabilities: (data.capabilities ?? []) as Prisma.InputJsonValue,
            daemonEndpoint: data.daemonEndpoint,
            status: data.status ?? 'OFFLINE',
            userId: user.id,
            organizationId: data.organizationId,
          },
          include: {
            user: true,
          },
        });

        return orchestrator;
      });

      return result as OrchestratorWithUser;
    } catch (error) {
      throw new TransactionError('createOrchestrator', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets a Orchestrator by ID with user data.
   */
  async getVP(id: string): Promise<OrchestratorWithUser | null> {
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id },
      include: { user: true },
    });

    return orchestrator as OrchestratorWithUser | null;
  }

  /**
   * Gets a Orchestrator by slug within an organization.
   */
  async getVPBySlug(slug: string, organizationId: string): Promise<OrchestratorWithUser | null> {
    // We need to find by user email slug pattern since Orchestrator doesn't have a slug field
    const orchestrators = await this.db.orchestrator.findMany({
      where: {
        organizationId,
        user: {
          email: {
            contains: slug,
          },
        },
      },
      include: { user: true },
    });

    // Return the first match or null
    return (orchestrators[0] as OrchestratorWithUser) ?? null;
  }

  /**
   * Lists Orchestrators by organization with pagination.
   */
  async listVPsByOrganization(
    orgId: string,
    options: ListOrchestratorsOptions = {},
  ): Promise<PaginatedOrchestratorResult> {
    const {
      status,
      discipline,
      includeInactive = false,
      skip = 0,
      take = 20,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = options;

    // Build where clause
    const where: Prisma.orchestratorWhereInput = {
      organizationId: orgId,
      ...(status && { status }),
      ...(discipline && { discipline }),
      ...(!includeInactive && { status: { not: 'OFFLINE' as const } }),
    };

    // Get total count and data in parallel
    const [total, data] = await Promise.all([
      this.db.orchestrator.count({ where }),
      this.db.orchestrator.findMany({
        where,
        include: { user: true },
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
    ]);

    const lastItem = data[data.length - 1];
    return {
      data: data as OrchestratorWithUser[],
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Lists Orchestrators by discipline.
   */
  async listVPsByDiscipline(discipline: string, organizationId?: string): Promise<OrchestratorWithUser[]> {
    const where: Prisma.orchestratorWhereInput = {
      discipline,
      ...(organizationId && { organizationId }),
    };

    const orchestrators = await this.db.orchestrator.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return orchestrators as OrchestratorWithUser[];
  }

  /**
   * Updates a Orchestrator.
   */
  async updateVP(id: string, data: UpdateOrchestratorInput): Promise<OrchestratorWithUser> {
    // Check Orchestrator exists
    const existing = await this.getVP(id);
    if (!existing) {
      throw new OrchestratorNotFoundError(id);
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        // Update User if name or bio changed
        if (data.name || data.bio || data.avatarUrl || data.charter) {
          const userUpdate: Prisma.userUpdateInput = {};

          if (data.name) {
            userUpdate.name = data.name;
            userUpdate.displayName = data.name;
          }

          if (data.bio !== undefined) {
            userUpdate.bio = data.bio;
          }

          if (data.avatarUrl !== undefined) {
            userUpdate.avatarUrl = data.avatarUrl;
          }

          if (data.charter) {
            // Merge with existing charter
            const existingConfig = this.parseOrchestratorConfig(existing.user.orchestratorConfig);
            const mergedCharter = deepMerge(
              existingConfig.charter ?? DEFAULT_ORCHESTRATOR_CHARTER,
              data.charter,
            );
            userUpdate.orchestratorConfig = {
              ...existingConfig,
              charter: mergedCharter,
            } as unknown as Prisma.InputJsonValue;
          }

          if (Object.keys(userUpdate).length > 0) {
            await tx.user.update({
              where: { id: existing.userId },
              data: userUpdate,
            });
          }
        }

        // Update Orchestrator
        const orchestratorUpdate: Prisma.orchestratorUpdateInput = {};

        if (data.discipline !== undefined) {
          orchestratorUpdate.discipline = data.discipline;
        }

        if (data.role !== undefined) {
          orchestratorUpdate.role = data.role;
        }

        if (data.capabilities !== undefined) {
          orchestratorUpdate.capabilities = data.capabilities as Prisma.InputJsonValue;
        }

        if (data.daemonEndpoint !== undefined) {
          orchestratorUpdate.daemonEndpoint = data.daemonEndpoint;
        }

        const orchestrator = await tx.orchestrator.update({
          where: { id },
          data: orchestratorUpdate,
          include: { user: true },
        });

        return orchestrator;
      });

      return result as OrchestratorWithUser;
    } catch (error) {
      if (error instanceof OrchestratorNotFoundError) {
        throw error;
      }
      throw new TransactionError('updateOrchestrator', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Deletes a Orchestrator and associated User.
   */
  async deleteVP(id: string): Promise<void> {
    const orchestrator = await this.getVP(id);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Delete Orchestrator first (due to foreign key constraint)
        await tx.orchestrator.delete({
          where: { id },
        });

        // Delete associated User
        await tx.user.delete({
          where: { id: orchestrator.userId },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteOrchestrator', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Activates a Orchestrator.
   */
  async activateVP(id: string): Promise<OrchestratorWithUser> {
    const orchestrator = await this.getVP(id);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(id);
    }

    const updated = await this.db.orchestrator.update({
      where: { id },
      data: { status: 'ONLINE' },
      include: { user: true },
    });

    // Also update user status
    await this.db.user.update({
      where: { id: orchestrator.userId },
      data: { status: 'ACTIVE' },
    });

    return updated as OrchestratorWithUser;
  }

  /**
   * Deactivates a Orchestrator.
   */
  async deactivateVP(id: string): Promise<OrchestratorWithUser> {
    const orchestrator = await this.getVP(id);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(id);
    }

    const updated = await this.db.orchestrator.update({
      where: { id },
      data: { status: 'OFFLINE' },
      include: { user: true },
    });

    return updated as OrchestratorWithUser;
  }

  // ===========================================================================
  // Service Account Operations
  // ===========================================================================

  /**
   * Generates a new API key for a Orchestrator.
   */
  async generateAPIKey(vpId: string): Promise<APIKeyGenerationResult> {
    const orchestrator = await this.getVP(vpId);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(vpId);
    }

    // Check if there's already an active key
    const existingConfig = this.parseOrchestratorConfig(orchestrator.user.orchestratorConfig);
    if (existingConfig.apiKeyHash && !existingConfig.apiKeyRevoked) {
      throw new APIKeyGenerationError(
        vpId,
        'Orchestrator already has an active API key. Use rotateAPIKey to replace it.',
      );
    }

    // Generate new key
    const key = generateAPIKey('gns_');
    const keyHash = hashAPIKey(key);
    const keyPrefix = extractKeyPrefix(key);

    // Update Orchestrator config with new key hash
    const newConfig: OrchestratorServiceAccountConfig = {
      ...existingConfig,
      apiKeyHash: keyHash,
      apiKeyPrefix: keyPrefix,
      apiKeyCreatedAt: new Date().toISOString(),
      apiKeyRevoked: false,
    };

    await this.db.user.update({
      where: { id: orchestrator.userId },
      data: {
        orchestratorConfig: newConfig as Prisma.InputJsonValue,
      },
    });

    return {
      key,
      keyHash,
      keyPrefix,
    };
  }

  /**
   * Rotates the API key for a Orchestrator.
   */
  async rotateAPIKey(vpId: string): Promise<APIKeyRotationResult> {
    const orchestrator = await this.getVP(vpId);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(vpId);
    }

    // Generate new key
    const key = generateAPIKey('gns_');
    const keyHash = hashAPIKey(key);
    const keyPrefix = extractKeyPrefix(key);
    const previousKeyRevokedAt = new Date();

    // Update Orchestrator config with new key hash
    const existingConfig = this.parseOrchestratorConfig(orchestrator.user.orchestratorConfig);
    const newConfig: OrchestratorServiceAccountConfig = {
      ...existingConfig,
      apiKeyHash: keyHash,
      apiKeyPrefix: keyPrefix,
      apiKeyCreatedAt: new Date().toISOString(),
      apiKeyRevoked: false,
    };

    await this.db.user.update({
      where: { id: orchestrator.userId },
      data: {
        orchestratorConfig: newConfig as Prisma.InputJsonValue,
      },
    });

    return {
      key,
      keyHash,
      keyPrefix,
      previousKeyRevokedAt,
    };
  }

  /**
   * Revokes the API key for a Orchestrator.
   */
  async revokeAPIKey(vpId: string): Promise<void> {
    const orchestrator = await this.getVP(vpId);
    if (!orchestrator) {
      throw new OrchestratorNotFoundError(vpId);
    }

    const existingConfig = this.parseOrchestratorConfig(orchestrator.user.orchestratorConfig);

    if (!existingConfig.apiKeyHash) {
      return; // No key to revoke
    }

    const newConfig: OrchestratorServiceAccountConfig = {
      ...existingConfig,
      apiKeyRevoked: true,
    };

    await this.db.user.update({
      where: { id: orchestrator.userId },
      data: {
        orchestratorConfig: newConfig as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Validates an API key and returns the associated Orchestrator.
   */
  async validateAPIKey(key: string): Promise<APIKeyValidationResult> {
    // Check format
    if (!isValidAPIKeyFormat(key)) {
      return { valid: false, reason: 'invalid' };
    }

    // Find users with Orchestrator config containing a matching key hash
    // We need to search through all Orchestrator users
    const orchestratorUsers = await this.db.user.findMany({
      where: {
        isOrchestrator: true,
      },
      include: {
        orchestrator: true,
      },
    });

    // Check each Orchestrator's config for a matching key
    for (const user of orchestratorUsers) {
      const config = this.parseOrchestratorConfig(user.orchestratorConfig);

      if (config.apiKeyHash && verifyAPIKey(key, config.apiKeyHash)) {
        // Check if revoked
        if (config.apiKeyRevoked) {
          return { valid: false, reason: 'revoked' };
        }

        // Check if expired
        if (config.apiKeyExpiresAt && isExpired(config.apiKeyExpiresAt)) {
          return { valid: false, reason: 'expired' };
        }

        // Valid key - return Orchestrator
        if (user.orchestrator) {
          return {
            valid: true,
            orchestrator: {
              ...user.orchestrator,
              user,
            } as OrchestratorWithUser,
          };
        }
      }
    }

    return { valid: false, reason: 'not_found' };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates create Orchestrator input.
   */
  private validateCreateInput(data: CreateOrchestratorInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (data.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (!data.discipline || data.discipline.trim().length === 0) {
      errors.discipline = ['Discipline is required'];
    }

    if (!data.role || data.role.trim().length === 0) {
      errors.role = ['Role is required'];
    }

    if (!data.organizationId) {
      errors.organizationId = ['Organization ID is required'];
    }

    if (data.email && !isValidEmail(data.email)) {
      errors.email = ['Invalid email format'];
    }

    if (Object.keys(errors).length > 0) {
      throw new OrchestratorValidationError('Orchestrator validation failed', errors);
    }
  }

  /**
   * Builds Orchestrator config with charter.
   */
  private buildVPConfig(charter?: Partial<OrchestratorCharter>): OrchestratorServiceAccountConfig {
    const config: OrchestratorServiceAccountConfig = {};

    if (charter) {
      config.charter = deepMerge(DEFAULT_ORCHESTRATOR_CHARTER, charter);
    } else {
      config.charter = { ...DEFAULT_ORCHESTRATOR_CHARTER };
    }

    return config;
  }

  /**
   * Parses Orchestrator config from JSON stored in the database.
   *
   * Orchestrator config is stored as a JSON blob in the User.orchestratorConfig field and
   * contains service account configuration including API key hashes
   * and charter settings.
   *
   * @param orchestratorConfig - Raw config from database (Prisma JSON field)
   * @returns Typed Orchestrator service account config, or empty object if invalid
   */
  private parseOrchestratorConfig(orchestratorConfig: Prisma.JsonValue | null | undefined): OrchestratorServiceAccountConfig {
    if (orchestratorConfig !== null && orchestratorConfig !== undefined && isOrchestratorServiceAccountConfig(orchestratorConfig)) {
      return orchestratorConfig;
    }
    return {};
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new Orchestrator service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Orchestrator service instance implementing both OrchestratorService and ServiceAccountService
 *
 * @example
 * ```typescript
 * const orchestratorService = createOrchestratorService();
 *
 * // Create a new Orchestrator
 * const orchestrator = await orchestratorService.createVP({
 *   name: 'Alex Chen',
 *   discipline: 'Engineering',
 *   role: 'Orchestrator of Engineering',
 *   organizationId: 'org_123',
 * });
 *
 * // Generate API key
 * const { key } = await orchestratorService.generateAPIKey(vp.id);
 * ```
 */
export function createOrchestratorService(database?: PrismaClient): OrchestratorServiceImpl {
  return new OrchestratorServiceImpl(database);
}

/**
 * Default Orchestrator service instance using the singleton Prisma client.
 */
export const orchestratorService = createOrchestratorService();
