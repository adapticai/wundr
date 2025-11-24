/**
 * @genesis/core - Organization Service
 *
 * Service layer for organization operations including CRUD, membership management,
 * and organization-specific functionality.
 *
 * @packageDocumentation
 */

import { prisma } from '@genesis/database';

import {
  GenesisError,
  TransactionError,
  OrganizationNotFoundError,
} from '../errors';
import {
  DEFAULT_ORG_LIST_OPTIONS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SLUG_LENGTH,
} from '../types/organization';
import { generateSlug } from '../utils';

import type {
  OrganizationWithMembers,
  CreateOrgInput,
  UpdateOrgInput,
  ListOrgsOptions,
  PaginatedOrgResult,
  OrganizationMemberRole,
} from '../types/organization';
import type { PrismaClient, Prisma, OrganizationRole , Organization, OrganizationMember } from '@genesis/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when an organization with the given slug already exists.
 */
export class OrganizationAlreadyExistsError extends GenesisError {
  constructor(slug: string) {
    super(
      `Organization with slug '${slug}' already exists`,
      'ORGANIZATION_ALREADY_EXISTS',
      409,
      { slug },
    );
    this.name = 'OrganizationAlreadyExistsError';
  }
}

/**
 * Error thrown when organization validation fails.
 */
export class OrganizationValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'ORGANIZATION_VALIDATION_ERROR', 400, { errors });
    this.name = 'OrganizationValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when user is not found.
 */
export class UserNotFoundError extends GenesisError {
  constructor(userId: string) {
    super(
      `User not found: ${userId}`,
      'USER_NOT_FOUND',
      404,
      { userId },
    );
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when a member is not found in an organization.
 */
export class OrganizationMemberNotFoundError extends GenesisError {
  constructor(orgId: string, userId: string) {
    super(
      `User ${userId} is not a member of organization ${orgId}`,
      'ORGANIZATION_MEMBER_NOT_FOUND',
      404,
      { orgId, userId },
    );
    this.name = 'OrganizationMemberNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for organization CRUD operations.
 */
export interface OrganizationService {
  /**
   * Creates a new organization.
   *
   * @param data - Organization creation input
   * @returns The created organization
   * @throws {OrganizationAlreadyExistsError} If an organization with the slug already exists
   * @throws {OrganizationValidationError} If validation fails
   */
  createOrganization(data: CreateOrgInput): Promise<Organization>;

  /**
   * Gets an organization by ID.
   *
   * @param id - The organization ID
   * @returns The organization with members, or null if not found
   */
  getOrganization(id: string): Promise<Organization | null>;

  /**
   * Updates an organization.
   *
   * @param id - The organization ID
   * @param data - Update data
   * @returns The updated organization
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   */
  updateOrganization(id: string, data: UpdateOrgInput): Promise<Organization>;

  /**
   * Permanently deletes an organization and all associated data.
   *
   * @param id - The organization ID
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   */
  deleteOrganization(id: string): Promise<void>;

  // Membership operations

  /**
   * Adds a member to an organization.
   *
   * @param orgId - The organization ID
   * @param userId - The user ID to add
   * @param role - The member role
   * @returns The created organization member
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {UserNotFoundError} If the user doesn't exist
   */
  addMember(orgId: string, userId: string, role: OrganizationMemberRole): Promise<OrganizationMember>;

  /**
   * Removes a member from an organization.
   *
   * @param orgId - The organization ID
   * @param userId - The user ID to remove
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {OrganizationMemberNotFoundError} If the user is not a member
   */
  removeMember(orgId: string, userId: string): Promise<void>;

  /**
   * Updates a member's role in an organization.
   *
   * @param orgId - The organization ID
   * @param userId - The user ID
   * @param role - The new role
   * @returns The updated organization member
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {OrganizationMemberNotFoundError} If the user is not a member
   */
  updateMemberRole(orgId: string, userId: string, role: OrganizationMemberRole): Promise<OrganizationMember>;

  /**
   * Gets all members of an organization.
   *
   * @param orgId - The organization ID
   * @returns Array of organization members with user data
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   */
  getMembers(orgId: string): Promise<OrganizationMember[]>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Organization service implementation.
 */
export class OrganizationServiceImpl implements OrganizationService {
  private readonly db: PrismaClient;

  /**
   * Creates a new OrganizationServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Organization CRUD Operations
  // ===========================================================================

  /**
   * Creates a new organization.
   */
  async createOrganization(data: CreateOrgInput): Promise<Organization> {
    // Validate input
    this.validateCreateInput(data);

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: data.createdById },
    });

    if (!user) {
      throw new UserNotFoundError(data.createdById);
    }

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check if slug already exists
    const existingOrg = await this.db.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new OrganizationAlreadyExistsError(slug);
    }

    try {
      // Create organization and add creator as owner in a transaction
      const organization = await this.db.$transaction(async (tx) => {
        const newOrg = await tx.organization.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            avatarUrl: data.avatarUrl,
            settings: (data.settings ?? {}) as Prisma.InputJsonValue,
          },
        });

        // Add creator as owner
        await tx.organizationMember.create({
          data: {
            organizationId: newOrg.id,
            userId: data.createdById,
            role: 'OWNER',
          },
        });

        return newOrg;
      });

      return organization;
    } catch (error) {
      throw new TransactionError('createOrganization', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets an organization by ID with members.
   */
  async getOrganization(id: string): Promise<Organization | null> {
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
        },
        workspaces: true,
        vps: {
          include: { user: true },
        },
      },
    });

    return organization;
  }

  /**
   * Gets an organization by slug.
   *
   * @param slug - The organization slug
   * @returns The organization with members, or null if not found
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const organization = await this.db.organization.findUnique({
      where: { slug },
      include: {
        members: {
          include: { user: true },
        },
        workspaces: true,
        vps: {
          include: { user: true },
        },
      },
    });

    return organization;
  }

  /**
   * Lists organizations with pagination.
   *
   * @param options - Query options
   * @returns Paginated organization results
   */
  async listOrganizations(options: ListOrgsOptions = {}): Promise<PaginatedOrgResult> {
    const {
      userId,
      skip = DEFAULT_ORG_LIST_OPTIONS.skip,
      take = DEFAULT_ORG_LIST_OPTIONS.take,
      orderBy = DEFAULT_ORG_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_ORG_LIST_OPTIONS.orderDirection,
    } = options;

    // Build where clause
    const where: Prisma.OrganizationWhereInput = {
      ...(userId && {
        members: {
          some: { userId },
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.db.organization.count({ where }),
      this.db.organization.findMany({
        where,
        include: {
          members: {
            include: { user: true },
          },
        },
        skip,
        take,
        orderBy: { [orderBy]: orderDirection },
      }),
    ]);

    const lastItem = data[data.length - 1];
    return {
      data: data as OrganizationWithMembers[],
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Updates an organization.
   */
  async updateOrganization(id: string, data: UpdateOrgInput): Promise<Organization> {
    // Validate input
    this.validateUpdateInput(data);

    // Check organization exists
    const existing = await this.getOrganization(id);
    if (!existing) {
      throw new OrganizationNotFoundError(id);
    }

    const updateData: Prisma.OrganizationUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    if (data.settings !== undefined) {
      updateData.settings = data.settings as Prisma.InputJsonValue;
    }

    const updated = await this.db.organization.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return updated;
  }

  /**
   * Permanently deletes an organization and all associated data.
   */
  async deleteOrganization(id: string): Promise<void> {
    const existing = await this.getOrganization(id);
    if (!existing) {
      throw new OrganizationNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Delete all organization members
        await tx.organizationMember.deleteMany({
          where: { organizationId: id },
        });

        // Get all workspaces to delete their data
        const workspaces = await tx.workspace.findMany({
          where: { organizationId: id },
          select: { id: true },
        });

        const workspaceIds = workspaces.map((w) => w.id);

        if (workspaceIds.length > 0) {
          // Delete all workspace members
          await tx.workspaceMember.deleteMany({
            where: { workspaceId: { in: workspaceIds } },
          });

          // Get all channels
          const channels = await tx.channel.findMany({
            where: { workspaceId: { in: workspaceIds } },
            select: { id: true },
          });

          const channelIds = channels.map((c) => c.id);

          if (channelIds.length > 0) {
            // Delete all channel members
            await tx.channelMember.deleteMany({
              where: { channelId: { in: channelIds } },
            });

            // Delete all messages
            await tx.message.deleteMany({
              where: { channelId: { in: channelIds } },
            });

            // Delete all channels
            await tx.channel.deleteMany({
              where: { id: { in: channelIds } },
            });
          }

          // Delete all files in workspaces
          await tx.file.deleteMany({
            where: { workspaceId: { in: workspaceIds } },
          });

          // Delete all workspaces
          await tx.workspace.deleteMany({
            where: { id: { in: workspaceIds } },
          });
        }

        // Delete all VPs in organization
        await tx.vP.deleteMany({
          where: { organizationId: id },
        });

        // Delete the organization
        await tx.organization.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteOrganization', error instanceof Error ? error : undefined);
    }
  }

  // ===========================================================================
  // Membership Operations
  // ===========================================================================

  /**
   * Adds a member to an organization.
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrganizationMemberRole,
  ): Promise<OrganizationMember> {
    // Verify organization exists
    const org = await this.getOrganization(orgId);
    if (!org) {
      throw new OrganizationNotFoundError(orgId);
    }

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Check if already a member
    const existingMember = await this.db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (existingMember) {
      // Return existing membership
      return existingMember;
    }

    const member = await this.db.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role: role as OrganizationRole,
      },
      include: { user: true },
    });

    return member;
  }

  /**
   * Removes a member from an organization.
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    // Verify organization exists
    const org = await this.getOrganization(orgId);
    if (!org) {
      throw new OrganizationNotFoundError(orgId);
    }

    // Verify membership exists
    const member = await this.db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member) {
      throw new OrganizationMemberNotFoundError(orgId, userId);
    }

    await this.db.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });
  }

  /**
   * Updates a member's role.
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    role: OrganizationMemberRole,
  ): Promise<OrganizationMember> {
    // Verify organization exists
    const org = await this.getOrganization(orgId);
    if (!org) {
      throw new OrganizationNotFoundError(orgId);
    }

    // Verify membership exists
    const member = await this.db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member) {
      throw new OrganizationMemberNotFoundError(orgId, userId);
    }

    const updated = await this.db.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      data: { role: role as OrganizationRole },
      include: { user: true },
    });

    return updated;
  }

  /**
   * Gets all members of an organization.
   */
  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    // Verify organization exists
    const org = await this.getOrganization(orgId);
    if (!org) {
      throw new OrganizationNotFoundError(orgId);
    }

    const members = await this.db.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    return members;
  }

  /**
   * Checks if a user is a member of an organization.
   *
   * @param orgId - The organization ID
   * @param userId - The user ID
   * @returns True if the user is a member
   */
  async isMember(orgId: string, userId: string): Promise<boolean> {
    const member = await this.db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    return member !== null;
  }

  // ===========================================================================
  // Private Validation Methods
  // ===========================================================================

  /**
   * Validates create organization input.
   */
  private validateCreateInput(data: CreateOrgInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (data.name.length > MAX_NAME_LENGTH) {
      errors.name = [`Name must be ${MAX_NAME_LENGTH} characters or less`];
    }

    if (data.slug && data.slug.length > MAX_SLUG_LENGTH) {
      errors.slug = [`Slug must be ${MAX_SLUG_LENGTH} characters or less`];
    }

    if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = [`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`];
    }

    if (!data.createdById) {
      errors.createdById = ['Creator ID is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new OrganizationValidationError('Organization validation failed', errors);
    }
  }

  /**
   * Validates update organization input.
   */
  private validateUpdateInput(data: UpdateOrgInput): void {
    const errors: Record<string, string[]> = {};

    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        errors.name = ['Name cannot be empty'];
      } else if (data.name.length > MAX_NAME_LENGTH) {
        errors.name = [`Name must be ${MAX_NAME_LENGTH} characters or less`];
      }
    }

    if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = [`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`];
    }

    if (Object.keys(errors).length > 0) {
      throw new OrganizationValidationError('Organization validation failed', errors);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new organization service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Organization service instance
 *
 * @example
 * ```typescript
 * const organizationService = createOrganizationService();
 *
 * // Create a new organization
 * const org = await organizationService.createOrganization({
 *   name: 'My Company',
 *   createdById: 'user_123',
 * });
 *
 * // Add a member
 * await organizationService.addMember(org.id, 'user_456', 'ADMIN');
 * ```
 */
export function createOrganizationService(database?: PrismaClient): OrganizationServiceImpl {
  return new OrganizationServiceImpl(database);
}

/**
 * Default organization service instance using the singleton Prisma client.
 */
export const organizationService = createOrganizationService();
