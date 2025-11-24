/**
 * @genesis/core - VP Service
 *
 * Service layer for Virtual Person (VP) management including CRUD operations,
 * service account management, and configuration.
 *
 * @packageDocumentation
 */

import { prisma } from '@genesis/database';

import {
  VPNotFoundError,
  VPAlreadyExistsError,
  VPValidationError,
  APIKeyGenerationError,
  OrganizationNotFoundError,
  TransactionError,
} from '../errors';
import { DEFAULT_VP_CHARTER, isVPServiceAccountConfig } from '../types/vp';
import {
  generateVPEmail,
  generateAPIKey,
  hashAPIKey,
  extractKeyPrefix,
  isValidAPIKeyFormat,
  verifyAPIKey,
  isExpired,
  deepMerge,
  isValidEmail,
} from '../utils';

import type {
  VPWithUser,
  VPCharter,
  CreateVPInput,
  UpdateVPInput,
  ListVPsOptions,
  PaginatedVPResult,
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  VPServiceAccountConfig,
} from '../types/vp';
import type { PrismaClient, Prisma } from '@genesis/database';

// =============================================================================
// VP Service Interface
// =============================================================================

/**
 * Interface for VP CRUD operations.
 */
export interface VPService {
  /**
   * Creates a new VP with associated User record.
   *
   * @param data - VP creation input
   * @returns The created VP with user data
   * @throws {VPAlreadyExistsError} If a VP with the same email already exists
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {VPValidationError} If validation fails
   */
  createVP(data: CreateVPInput): Promise<VPWithUser>;

  /**
   * Gets a VP by ID.
   *
   * @param id - The VP ID
   * @returns The VP with user data, or null if not found
   */
  getVP(id: string): Promise<VPWithUser | null>;

  /**
   * Gets a VP by slug.
   *
   * @param slug - The VP's slug
   * @param organizationId - The organization ID for scoping
   * @returns The VP with user data, or null if not found
   */
  getVPBySlug(slug: string, organizationId: string): Promise<VPWithUser | null>;

  /**
   * Lists VPs by organization.
   *
   * @param orgId - The organization ID
   * @param options - Listing options
   * @returns Paginated VP results
   */
  listVPsByOrganization(orgId: string, options?: ListVPsOptions): Promise<PaginatedVPResult>;

  /**
   * Lists VPs by discipline.
   *
   * @param discipline - The discipline name
   * @param organizationId - Optional organization ID for scoping
   * @returns List of VPs in the discipline
   */
  listVPsByDiscipline(discipline: string, organizationId?: string): Promise<VPWithUser[]>;

  /**
   * Updates a VP.
   *
   * @param id - The VP ID
   * @param data - Update data
   * @returns The updated VP
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  updateVP(id: string, data: UpdateVPInput): Promise<VPWithUser>;

  /**
   * Deletes a VP and associated User record.
   *
   * @param id - The VP ID
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  deleteVP(id: string): Promise<void>;

  /**
   * Activates a VP (sets status to ONLINE).
   *
   * @param id - The VP ID
   * @returns The activated VP
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  activateVP(id: string): Promise<VPWithUser>;

  /**
   * Deactivates a VP (sets status to OFFLINE).
   *
   * @param id - The VP ID
   * @returns The deactivated VP
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  deactivateVP(id: string): Promise<VPWithUser>;
}

/**
 * Interface for service account operations.
 */
export interface ServiceAccountService {
  /**
   * Generates a new API key for a VP.
   *
   * @param vpId - The VP ID
   * @returns The generated API key (only returned once)
   * @throws {VPNotFoundError} If the VP doesn't exist
   * @throws {APIKeyGenerationError} If generation fails
   */
  generateAPIKey(vpId: string): Promise<APIKeyGenerationResult>;

  /**
   * Rotates the API key for a VP.
   *
   * @param vpId - The VP ID
   * @returns The new API key
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  rotateAPIKey(vpId: string): Promise<APIKeyRotationResult>;

  /**
   * Revokes the API key for a VP.
   *
   * @param vpId - The VP ID
   * @throws {VPNotFoundError} If the VP doesn't exist
   */
  revokeAPIKey(vpId: string): Promise<void>;

  /**
   * Validates an API key and returns the associated VP.
   *
   * @param key - The API key to validate
   * @returns Validation result with VP if valid
   */
  validateAPIKey(key: string): Promise<APIKeyValidationResult>;
}

// =============================================================================
// VP Service Implementation
// =============================================================================

/**
 * VP Service implementation providing CRUD operations and service account management.
 */
export class VPServiceImpl implements VPService, ServiceAccountService {
  private readonly db: PrismaClient;

  /**
   * Creates a new VPServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // VP CRUD Operations
  // ===========================================================================

  /**
   * Creates a new VP with associated User record.
   */
  async createVP(data: CreateVPInput): Promise<VPWithUser> {
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
    const email = data.email || generateVPEmail(data.name, organization.slug);

    // Check if email is already taken
    const existingUser = await this.db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new VPAlreadyExistsError(email, 'email');
    }

    // Build VP config with charter
    const vpConfig = this.buildVPConfig(data.charter);

    try {
      // Create VP and User in a transaction
      const result = await this.db.$transaction(async (tx) => {
        // Create User first
        const user = await tx.user.create({
          data: {
            email,
            name: data.name,
            displayName: data.name,
            status: 'ACTIVE',
            isVP: true,
            vpConfig: vpConfig as Prisma.InputJsonValue,
            bio: data.bio,
            avatarUrl: data.avatarUrl,
          },
        });

        // Create VP linked to User
        const vp = await tx.vP.create({
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

        return vp;
      });

      return result as VPWithUser;
    } catch (error) {
      throw new TransactionError('createVP', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets a VP by ID with user data.
   */
  async getVP(id: string): Promise<VPWithUser | null> {
    const vp = await this.db.vP.findUnique({
      where: { id },
      include: { user: true },
    });

    return vp as VPWithUser | null;
  }

  /**
   * Gets a VP by slug within an organization.
   */
  async getVPBySlug(slug: string, organizationId: string): Promise<VPWithUser | null> {
    // We need to find by user email slug pattern since VP doesn't have a slug field
    const vps = await this.db.vP.findMany({
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
    return (vps[0] as VPWithUser) ?? null;
  }

  /**
   * Lists VPs by organization with pagination.
   */
  async listVPsByOrganization(
    orgId: string,
    options: ListVPsOptions = {},
  ): Promise<PaginatedVPResult> {
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
    const where: Prisma.VPWhereInput = {
      organizationId: orgId,
      ...(status && { status }),
      ...(discipline && { discipline }),
      ...(!includeInactive && { status: { not: 'OFFLINE' as const } }),
    };

    // Get total count and data in parallel
    const [total, data] = await Promise.all([
      this.db.vP.count({ where }),
      this.db.vP.findMany({
        where,
        include: { user: true },
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
    ]);

    const lastItem = data[data.length - 1];
    return {
      data: data as VPWithUser[],
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Lists VPs by discipline.
   */
  async listVPsByDiscipline(discipline: string, organizationId?: string): Promise<VPWithUser[]> {
    const where: Prisma.VPWhereInput = {
      discipline,
      ...(organizationId && { organizationId }),
    };

    const vps = await this.db.vP.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return vps as VPWithUser[];
  }

  /**
   * Updates a VP.
   */
  async updateVP(id: string, data: UpdateVPInput): Promise<VPWithUser> {
    // Check VP exists
    const existing = await this.getVP(id);
    if (!existing) {
      throw new VPNotFoundError(id);
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        // Update User if name or bio changed
        if (data.name || data.bio || data.avatarUrl || data.charter) {
          const userUpdate: Prisma.UserUpdateInput = {};

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
            const existingConfig = this.parseVPConfig(existing.user.vpConfig);
            const mergedCharter = deepMerge(
              existingConfig.charter ?? DEFAULT_VP_CHARTER,
              data.charter,
            );
            userUpdate.vpConfig = {
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

        // Update VP
        const vpUpdate: Prisma.VPUpdateInput = {};

        if (data.discipline !== undefined) {
          vpUpdate.discipline = data.discipline;
        }

        if (data.role !== undefined) {
          vpUpdate.role = data.role;
        }

        if (data.capabilities !== undefined) {
          vpUpdate.capabilities = data.capabilities as Prisma.InputJsonValue;
        }

        if (data.daemonEndpoint !== undefined) {
          vpUpdate.daemonEndpoint = data.daemonEndpoint;
        }

        const vp = await tx.vP.update({
          where: { id },
          data: vpUpdate,
          include: { user: true },
        });

        return vp;
      });

      return result as VPWithUser;
    } catch (error) {
      if (error instanceof VPNotFoundError) {
        throw error;
      }
      throw new TransactionError('updateVP', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Deletes a VP and associated User.
   */
  async deleteVP(id: string): Promise<void> {
    const vp = await this.getVP(id);
    if (!vp) {
      throw new VPNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Delete VP first (due to foreign key constraint)
        await tx.vP.delete({
          where: { id },
        });

        // Delete associated User
        await tx.user.delete({
          where: { id: vp.userId },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteVP', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Activates a VP.
   */
  async activateVP(id: string): Promise<VPWithUser> {
    const vp = await this.getVP(id);
    if (!vp) {
      throw new VPNotFoundError(id);
    }

    const updated = await this.db.vP.update({
      where: { id },
      data: { status: 'ONLINE' },
      include: { user: true },
    });

    // Also update user status
    await this.db.user.update({
      where: { id: vp.userId },
      data: { status: 'ACTIVE' },
    });

    return updated as VPWithUser;
  }

  /**
   * Deactivates a VP.
   */
  async deactivateVP(id: string): Promise<VPWithUser> {
    const vp = await this.getVP(id);
    if (!vp) {
      throw new VPNotFoundError(id);
    }

    const updated = await this.db.vP.update({
      where: { id },
      data: { status: 'OFFLINE' },
      include: { user: true },
    });

    return updated as VPWithUser;
  }

  // ===========================================================================
  // Service Account Operations
  // ===========================================================================

  /**
   * Generates a new API key for a VP.
   */
  async generateAPIKey(vpId: string): Promise<APIKeyGenerationResult> {
    const vp = await this.getVP(vpId);
    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Check if there's already an active key
    const existingConfig = this.parseVPConfig(vp.user.vpConfig);
    if (existingConfig.apiKeyHash && !existingConfig.apiKeyRevoked) {
      throw new APIKeyGenerationError(
        vpId,
        'VP already has an active API key. Use rotateAPIKey to replace it.',
      );
    }

    // Generate new key
    const key = generateAPIKey('gns_');
    const keyHash = hashAPIKey(key);
    const keyPrefix = extractKeyPrefix(key);

    // Update VP config with new key hash
    const newConfig: VPServiceAccountConfig = {
      ...existingConfig,
      apiKeyHash: keyHash,
      apiKeyPrefix: keyPrefix,
      apiKeyCreatedAt: new Date().toISOString(),
      apiKeyRevoked: false,
    };

    await this.db.user.update({
      where: { id: vp.userId },
      data: {
        vpConfig: newConfig as Prisma.InputJsonValue,
      },
    });

    return {
      key,
      keyHash,
      keyPrefix,
    };
  }

  /**
   * Rotates the API key for a VP.
   */
  async rotateAPIKey(vpId: string): Promise<APIKeyRotationResult> {
    const vp = await this.getVP(vpId);
    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Generate new key
    const key = generateAPIKey('gns_');
    const keyHash = hashAPIKey(key);
    const keyPrefix = extractKeyPrefix(key);
    const previousKeyRevokedAt = new Date();

    // Update VP config with new key hash
    const existingConfig = this.parseVPConfig(vp.user.vpConfig);
    const newConfig: VPServiceAccountConfig = {
      ...existingConfig,
      apiKeyHash: keyHash,
      apiKeyPrefix: keyPrefix,
      apiKeyCreatedAt: new Date().toISOString(),
      apiKeyRevoked: false,
    };

    await this.db.user.update({
      where: { id: vp.userId },
      data: {
        vpConfig: newConfig as Prisma.InputJsonValue,
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
   * Revokes the API key for a VP.
   */
  async revokeAPIKey(vpId: string): Promise<void> {
    const vp = await this.getVP(vpId);
    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    const existingConfig = this.parseVPConfig(vp.user.vpConfig);

    if (!existingConfig.apiKeyHash) {
      return; // No key to revoke
    }

    const newConfig: VPServiceAccountConfig = {
      ...existingConfig,
      apiKeyRevoked: true,
    };

    await this.db.user.update({
      where: { id: vp.userId },
      data: {
        vpConfig: newConfig as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Validates an API key and returns the associated VP.
   */
  async validateAPIKey(key: string): Promise<APIKeyValidationResult> {
    // Check format
    if (!isValidAPIKeyFormat(key)) {
      return { valid: false, reason: 'invalid' };
    }

    // Find users with VP config containing a matching key hash
    // We need to search through all VP users
    const vpUsers = await this.db.user.findMany({
      where: {
        isVP: true,
      },
      include: {
        vp: true,
      },
    });

    // Check each VP's config for a matching key
    for (const user of vpUsers) {
      const config = this.parseVPConfig(user.vpConfig);

      if (config.apiKeyHash && verifyAPIKey(key, config.apiKeyHash)) {
        // Check if revoked
        if (config.apiKeyRevoked) {
          return { valid: false, reason: 'revoked' };
        }

        // Check if expired
        if (config.apiKeyExpiresAt && isExpired(config.apiKeyExpiresAt)) {
          return { valid: false, reason: 'expired' };
        }

        // Valid key - return VP
        if (user.vp) {
          return {
            valid: true,
            vp: {
              ...user.vp,
              user,
            } as VPWithUser,
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
   * Validates create VP input.
   */
  private validateCreateInput(data: CreateVPInput): void {
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
      throw new VPValidationError('VP validation failed', errors);
    }
  }

  /**
   * Builds VP config with charter.
   */
  private buildVPConfig(charter?: Partial<VPCharter>): VPServiceAccountConfig {
    const config: VPServiceAccountConfig = {};

    if (charter) {
      config.charter = deepMerge(DEFAULT_VP_CHARTER, charter);
    } else {
      config.charter = { ...DEFAULT_VP_CHARTER };
    }

    return config;
  }

  /**
   * Parses VP config from JSON.
   */
  private parseVPConfig(vpConfig: unknown): VPServiceAccountConfig {
    if (isVPServiceAccountConfig(vpConfig)) {
      return vpConfig;
    }
    return {};
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new VP service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns VP service instance implementing both VPService and ServiceAccountService
 *
 * @example
 * ```typescript
 * const vpService = createVPService();
 *
 * // Create a new VP
 * const vp = await vpService.createVP({
 *   name: 'Alex Chen',
 *   discipline: 'Engineering',
 *   role: 'VP of Engineering',
 *   organizationId: 'org_123',
 * });
 *
 * // Generate API key
 * const { key } = await vpService.generateAPIKey(vp.id);
 * ```
 */
export function createVPService(database?: PrismaClient): VPServiceImpl {
  return new VPServiceImpl(database);
}

/**
 * Default VP service instance using the singleton Prisma client.
 */
export const vpService = createVPService();
