/**
 * @genesis/core - Workspace Service
 *
 * Service layer for workspace operations including CRUD, membership management,
 * and workspace-specific functionality.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import {
  GenesisError,
  TransactionError,
  OrganizationNotFoundError,
} from '../errors';
import {
  DEFAULT_WORKSPACE_LIST_OPTIONS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SLUG_LENGTH,
} from '../types/organization';
import { generateSlug } from '../utils';

import type {
  WorkspaceWithMembers,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  ListWorkspacesOptions,
  PaginatedWorkspaceResult,
  WorkspaceMemberRole,
} from '../types/organization';
import type { PrismaClient, Prisma, WorkspaceRole, WorkspaceVisibility , Workspace, WorkspaceMember } from '@neolith/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a workspace is not found.
 */
export class WorkspaceNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'slug' = 'id') {
    super(
      `Workspace not found with ${identifierType}: ${identifier}`,
      'WORKSPACE_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'WorkspaceNotFoundError';
  }
}

/**
 * Error thrown when a workspace with the given slug already exists.
 */
export class WorkspaceAlreadyExistsError extends GenesisError {
  constructor(slug: string, organizationId: string) {
    super(
      `Workspace with slug '${slug}' already exists in organization`,
      'WORKSPACE_ALREADY_EXISTS',
      409,
      { slug, organizationId },
    );
    this.name = 'WorkspaceAlreadyExistsError';
  }
}

/**
 * Error thrown when workspace validation fails.
 */
export class WorkspaceValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'WORKSPACE_VALIDATION_ERROR', 400, { errors });
    this.name = 'WorkspaceValidationError';
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
 * Error thrown when a member is not found in a workspace.
 */
export class WorkspaceMemberNotFoundError extends GenesisError {
  constructor(workspaceId: string, userId: string) {
    super(
      `User ${userId} is not a member of workspace ${workspaceId}`,
      'WORKSPACE_MEMBER_NOT_FOUND',
      404,
      { workspaceId, userId },
    );
    this.name = 'WorkspaceMemberNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for workspace CRUD operations.
 */
export interface WorkspaceService {
  /**
   * Creates a new workspace in an organization.
   *
   * @param data - Workspace creation input
   * @returns The created workspace
   * @throws {OrganizationNotFoundError} If the organization doesn't exist
   * @throws {WorkspaceAlreadyExistsError} If a workspace with the slug already exists
   * @throws {WorkspaceValidationError} If validation fails
   */
  createWorkspace(data: CreateWorkspaceInput): Promise<Workspace>;

  /**
   * Gets a workspace by ID.
   *
   * @param id - The workspace ID
   * @returns The workspace with members, or null if not found
   */
  getWorkspace(id: string): Promise<Workspace | null>;

  /**
   * Lists workspaces in an organization.
   *
   * @param orgId - The organization ID
   * @returns Array of workspaces
   */
  listWorkspaces(orgId: string): Promise<Workspace[]>;

  /**
   * Updates a workspace.
   *
   * @param id - The workspace ID
   * @param data - Update data
   * @returns The updated workspace
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   */
  updateWorkspace(id: string, data: UpdateWorkspaceInput): Promise<Workspace>;

  /**
   * Archives a workspace.
   *
   * @param id - The workspace ID
   * @returns The archived workspace
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   */
  archiveWorkspace(id: string): Promise<Workspace>;

  // Membership operations

  /**
   * Adds a member to a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param userId - The user ID to add
   * @param role - The member role
   * @returns The created workspace member
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   * @throws {UserNotFoundError} If the user doesn't exist
   */
  addMember(workspaceId: string, userId: string, role: WorkspaceMemberRole): Promise<WorkspaceMember>;

  /**
   * Removes a member from a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param userId - The user ID to remove
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   * @throws {WorkspaceMemberNotFoundError} If the user is not a member
   */
  removeMember(workspaceId: string, userId: string): Promise<void>;

  /**
   * Gets all members of a workspace.
   *
   * @param workspaceId - The workspace ID
   * @returns Array of workspace members with user data
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   */
  getMembers(workspaceId: string): Promise<WorkspaceMember[]>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Workspace service implementation.
 */
export class WorkspaceServiceImpl implements WorkspaceService {
  private readonly db: PrismaClient;

  /**
   * Creates a new WorkspaceServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Workspace CRUD Operations
  // ===========================================================================

  /**
   * Creates a new workspace in an organization.
   */
  async createWorkspace(data: CreateWorkspaceInput): Promise<Workspace> {
    // Validate input
    this.validateCreateInput(data);

    // Verify organization exists
    const organization = await this.db.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new OrganizationNotFoundError(data.organizationId);
    }

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: data.createdById },
    });

    if (!user) {
      throw new UserNotFoundError(data.createdById);
    }

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check if slug already exists in organization
    const existingWorkspace = await this.db.workspace.findUnique({
      where: {
        organizationId_slug: {
          organizationId: data.organizationId,
          slug,
        },
      },
    });

    if (existingWorkspace) {
      throw new WorkspaceAlreadyExistsError(slug, data.organizationId);
    }

    try {
      // Create workspace and add creator as owner in a transaction
      const workspace = await this.db.$transaction(async (tx) => {
        const newWorkspace = await tx.workspace.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            avatarUrl: data.avatarUrl,
            visibility: data.visibility ?? 'PRIVATE',
            settings: (data.settings ?? {}) as Prisma.InputJsonValue,
            organizationId: data.organizationId,
          },
        });

        // Add creator as owner
        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: data.createdById,
            role: 'OWNER',
          },
        });

        return newWorkspace;
      });

      return workspace;
    } catch (error) {
      throw new TransactionError('createWorkspace', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets a workspace by ID with members.
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    const workspace = await this.db.workspace.findUnique({
      where: { id },
      include: {
        workspaceMembers: {
          include: { user: true },
        },
        channels: true,
        organization: true,
      },
    });

    return workspace;
  }

  /**
   * Gets a workspace by slug within an organization.
   *
   * @param slug - The workspace slug
   * @param organizationId - The organization ID
   * @returns The workspace with members, or null if not found
   */
  async getWorkspaceBySlug(slug: string, organizationId: string): Promise<Workspace | null> {
    const workspace = await this.db.workspace.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug,
        },
      },
      include: {
        workspaceMembers: {
          include: { user: true },
        },
        channels: true,
        organization: true,
      },
    });

    return workspace;
  }

  /**
   * Lists workspaces in an organization.
   */
  async listWorkspaces(orgId: string): Promise<Workspace[]> {
    const workspaces = await this.db.workspace.findMany({
      where: { organizationId: orgId },
      include: {
        workspaceMembers: {
          include: { user: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return workspaces;
  }

  /**
   * Lists workspaces with pagination and filtering.
   *
   * @param orgId - The organization ID
   * @param options - Query options
   * @returns Paginated workspace results
   */
  async listWorkspacesWithPagination(
    orgId: string,
    options: ListWorkspacesOptions = {},
  ): Promise<PaginatedWorkspaceResult> {
    const {
      visibility,
      userId,
      // includeArchived is reserved for future use
      includeArchived: _includeArchived = DEFAULT_WORKSPACE_LIST_OPTIONS.includeArchived,
      skip = DEFAULT_WORKSPACE_LIST_OPTIONS.skip,
      take = DEFAULT_WORKSPACE_LIST_OPTIONS.take,
      orderBy = DEFAULT_WORKSPACE_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_WORKSPACE_LIST_OPTIONS.orderDirection,
    } = options;

    // Build where clause
    const where: Prisma.workspaceWhereInput = {
      organizationId: orgId,
      ...(visibility && { visibility }),
      ...(userId && {
        workspaceMembers: {
          some: { userId },
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.db.workspace.count({ where }),
      this.db.workspace.findMany({
        where,
        include: {
          workspaceMembers: {
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
      data: data as WorkspaceWithMembers[],
      total,
      hasMore: skip + data.length < total,
      nextCursor: lastItem?.id,
    };
  }

  /**
   * Updates a workspace.
   */
  async updateWorkspace(id: string, data: UpdateWorkspaceInput): Promise<Workspace> {
    // Validate input
    this.validateUpdateInput(data);

    // Check workspace exists
    const existing = await this.getWorkspace(id);
    if (!existing) {
      throw new WorkspaceNotFoundError(id);
    }

    const updateData: Prisma.workspaceUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    if (data.visibility !== undefined) {
      updateData.visibility = data.visibility as WorkspaceVisibility;
    }

    if (data.settings !== undefined) {
      updateData.settings = data.settings as Prisma.InputJsonValue;
    }

    const updated = await this.db.workspace.update({
      where: { id },
      data: updateData,
      include: {
        workspaceMembers: {
          include: { user: true },
        },
      },
    });

    return updated;
  }

  /**
   * Archives a workspace (soft delete by adding archived flag to settings).
   */
  async archiveWorkspace(id: string): Promise<Workspace> {
    const existing = await this.getWorkspace(id);
    if (!existing) {
      throw new WorkspaceNotFoundError(id);
    }

    // Archive all channels in the workspace
    await this.db.channel.updateMany({
      where: { workspaceId: id },
      data: { isArchived: true },
    });

    // Update workspace settings to mark as archived
    const currentSettings = (existing.settings as Record<string, unknown>) || {};
    const archived = await this.db.workspace.update({
      where: { id },
      data: {
        settings: {
          ...currentSettings,
          isArchived: true,
          archivedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: {
        workspaceMembers: {
          include: { user: true },
        },
      },
    });

    return archived;
  }

  /**
   * Permanently deletes a workspace and all associated data.
   *
   * @param id - The workspace ID
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   */
  async deleteWorkspace(id: string): Promise<void> {
    const existing = await this.getWorkspace(id);
    if (!existing) {
      throw new WorkspaceNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Delete all workspace members
        await tx.workspaceMember.deleteMany({
          where: { workspaceId: id },
        });

        // Get all channels
        const channels = await tx.channel.findMany({
          where: { workspaceId: id },
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

        // Delete all files in workspace
        await tx.file.deleteMany({
          where: { workspaceId: id },
        });

        // Delete the workspace
        await tx.workspace.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteWorkspace', error instanceof Error ? error : undefined);
    }
  }

  // ===========================================================================
  // Membership Operations
  // ===========================================================================

  /**
   * Adds a member to a workspace.
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
  ): Promise<WorkspaceMember> {
    // Verify workspace exists
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Check if already a member
    const existingMember = await this.db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (existingMember) {
      // Return existing membership
      return existingMember;
    }

    const member = await this.db.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: role as WorkspaceRole,
      },
      include: { user: true },
    });

    return member;
  }

  /**
   * Removes a member from a workspace.
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    // Verify workspace exists
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    // Verify membership exists
    const member = await this.db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new WorkspaceMemberNotFoundError(workspaceId, userId);
    }

    // Also remove from all channels in the workspace
    await this.db.$transaction(async (tx) => {
      // Remove from workspace
      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      // Remove from all channels in this workspace
      const channels = await tx.channel.findMany({
        where: { workspaceId },
        select: { id: true },
      });

      const channelIds = channels.map((c) => c.id);

      if (channelIds.length > 0) {
        await tx.channelMember.deleteMany({
          where: {
            channelId: { in: channelIds },
            userId,
          },
        });
      }
    });
  }

  /**
   * Updates a member's role in a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param userId - The user ID
   * @param role - The new role
   * @returns The updated workspace member
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   * @throws {WorkspaceMemberNotFoundError} If the user is not a member
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
  ): Promise<WorkspaceMember> {
    // Verify workspace exists
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    // Verify membership exists
    const member = await this.db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new WorkspaceMemberNotFoundError(workspaceId, userId);
    }

    const updated = await this.db.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role: role as WorkspaceRole },
      include: { user: true },
    });

    return updated;
  }

  /**
   * Gets all members of a workspace.
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    // Verify workspace exists
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    const members = await this.db.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    return members;
  }

  /**
   * Checks if a user is a member of a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param userId - The user ID
   * @returns True if the user is a member
   */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
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
   * Validates create workspace input.
   */
  private validateCreateInput(data: CreateWorkspaceInput): void {
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

    if (!data.organizationId) {
      errors.organizationId = ['Organization ID is required'];
    }

    if (!data.createdById) {
      errors.createdById = ['Creator ID is required'];
    }

    if (data.visibility && !['PUBLIC', 'PRIVATE', 'INTERNAL'].includes(data.visibility)) {
      errors.visibility = ['Invalid visibility level'];
    }

    if (Object.keys(errors).length > 0) {
      throw new WorkspaceValidationError('Workspace validation failed', errors);
    }
  }

  /**
   * Validates update workspace input.
   */
  private validateUpdateInput(data: UpdateWorkspaceInput): void {
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

    if (data.visibility && !['PUBLIC', 'PRIVATE', 'INTERNAL'].includes(data.visibility)) {
      errors.visibility = ['Invalid visibility level'];
    }

    if (Object.keys(errors).length > 0) {
      throw new WorkspaceValidationError('Workspace validation failed', errors);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new workspace service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Workspace service instance
 *
 * @example
 * ```typescript
 * const workspaceService = createWorkspaceService();
 *
 * // Create a new workspace
 * const workspace = await workspaceService.createWorkspace({
 *   name: 'Engineering',
 *   organizationId: 'org_123',
 *   createdById: 'user_456',
 * });
 *
 * // Add a member
 * await workspaceService.addMember(workspace.id, 'user_789', 'MEMBER');
 * ```
 */
export function createWorkspaceService(database?: PrismaClient): WorkspaceServiceImpl {
  return new WorkspaceServiceImpl(database);
}

/**
 * Default workspace service instance using the singleton Prisma client.
 */
export const workspaceService = createWorkspaceService();
