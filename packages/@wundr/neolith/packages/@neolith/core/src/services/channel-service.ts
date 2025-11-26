/**
 * @genesis/core - Channel Service
 *
 * Service layer for channel operations including CRUD, membership management,
 * and channel-specific functionality.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import {
  GenesisError,
  TransactionError,
} from '../errors';
import {
  DEFAULT_CHANNEL_LIST_OPTIONS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SLUG_LENGTH,
} from '../types/organization';
import { generateSlug } from '../utils';

import type {
  CreateChannelInput,
  UpdateChannelInput,
  ChannelListOptions,
  ChannelMemberRole,
} from '../types/organization';
import type { PrismaClient, Prisma, ChannelRole , Channel, ChannelMember } from '@neolith/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a channel is not found.
 */
export class ChannelNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'slug' = 'id') {
    super(
      `Channel not found with ${identifierType}: ${identifier}`,
      'CHANNEL_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'ChannelNotFoundError';
  }
}

/**
 * Error thrown when a channel with the given slug already exists.
 */
export class ChannelAlreadyExistsError extends GenesisError {
  constructor(slug: string, workspaceId: string) {
    super(
      `Channel with slug '${slug}' already exists in workspace`,
      'CHANNEL_ALREADY_EXISTS',
      409,
      { slug, workspaceId },
    );
    this.name = 'ChannelAlreadyExistsError';
  }
}

/**
 * Error thrown when channel validation fails.
 */
export class ChannelValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'CHANNEL_VALIDATION_ERROR', 400, { errors });
    this.name = 'ChannelValidationError';
    this.errors = errors;
  }
}

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
 * Error thrown when a member is not found in a channel.
 */
export class ChannelMemberNotFoundError extends GenesisError {
  constructor(channelId: string, userId: string) {
    super(
      `User ${userId} is not a member of channel ${channelId}`,
      'CHANNEL_MEMBER_NOT_FOUND',
      404,
      { channelId, userId },
    );
    this.name = 'ChannelMemberNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for channel CRUD operations.
 */
export interface ChannelService {
  /**
   * Creates a new channel in a workspace.
   *
   * @param data - Channel creation input
   * @returns The created channel with members
   * @throws {WorkspaceNotFoundError} If the workspace doesn't exist
   * @throws {ChannelAlreadyExistsError} If a channel with the slug already exists
   * @throws {ChannelValidationError} If validation fails
   */
  createChannel(data: CreateChannelInput): Promise<Channel>;

  /**
   * Gets a channel by ID.
   *
   * @param id - The channel ID
   * @returns The channel with members, or null if not found
   */
  getChannel(id: string): Promise<Channel | null>;

  /**
   * Lists channels in a workspace with pagination.
   *
   * @param workspaceId - The workspace ID
   * @param options - Query options
   * @returns Paginated channel results
   */
  listChannels(workspaceId: string, options?: ChannelListOptions): Promise<Channel[]>;

  /**
   * Updates a channel.
   *
   * @param id - The channel ID
   * @param data - Update data
   * @returns The updated channel
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   */
  updateChannel(id: string, data: UpdateChannelInput): Promise<Channel>;

  /**
   * Archives a channel.
   *
   * @param id - The channel ID
   * @returns The archived channel
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   */
  archiveChannel(id: string): Promise<Channel>;

  /**
   * Permanently deletes a channel and all associated data.
   *
   * @param id - The channel ID
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   */
  deleteChannel(id: string): Promise<void>;

  // Membership operations

  /**
   * Adds a member to a channel.
   *
   * @param channelId - The channel ID
   * @param userId - The user ID to add
   * @param role - The member role (default: MEMBER)
   * @returns The created channel member
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   * @throws {UserNotFoundError} If the user doesn't exist
   */
  addMember(channelId: string, userId: string, role?: ChannelMemberRole): Promise<ChannelMember>;

  /**
   * Removes a member from a channel.
   *
   * @param channelId - The channel ID
   * @param userId - The user ID to remove
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   * @throws {ChannelMemberNotFoundError} If the user is not a member
   */
  removeMember(channelId: string, userId: string): Promise<void>;

  /**
   * Updates a member's role in a channel.
   *
   * @param channelId - The channel ID
   * @param userId - The user ID
   * @param role - The new role
   * @returns The updated channel member
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   * @throws {ChannelMemberNotFoundError} If the user is not a member
   */
  updateMemberRole(channelId: string, userId: string, role: ChannelMemberRole): Promise<ChannelMember>;

  /**
   * Gets all members of a channel.
   *
   * @param channelId - The channel ID
   * @returns Array of channel members with user data
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   */
  getMembers(channelId: string): Promise<ChannelMember[]>;

  /**
   * Checks if a user is a member of a channel.
   *
   * @param channelId - The channel ID
   * @param userId - The user ID
   * @returns True if the user is a member
   */
  isMember(channelId: string, userId: string): Promise<boolean>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Channel service implementation.
 */
export class ChannelServiceImpl implements ChannelService {
  private readonly db: PrismaClient;

  /**
   * Creates a new ChannelServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Channel CRUD Operations
  // ===========================================================================

  /**
   * Creates a new channel in a workspace.
   */
  async createChannel(data: CreateChannelInput): Promise<Channel> {
    // Validate input
    this.validateCreateInput(data);

    // Verify workspace exists
    const workspace = await this.db.workspace.findUnique({
      where: { id: data.workspaceId },
    });

    if (!workspace) {
      throw new WorkspaceNotFoundError(data.workspaceId);
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

    // Check if slug already exists in workspace
    const existingChannel = await this.db.channel.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: data.workspaceId,
          slug,
        },
      },
    });

    if (existingChannel) {
      throw new ChannelAlreadyExistsError(slug, data.workspaceId);
    }

    try {
      // Create channel and add creator as owner in a transaction
      const channel = await this.db.$transaction(async (tx) => {
        const newChannel = await tx.channel.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            type: data.type ?? 'PUBLIC',
            settings: (data.settings ?? {}) as Prisma.InputJsonValue,
            workspaceId: data.workspaceId,
            createdById: data.createdById,
          },
        });

        // Add creator as owner
        await tx.channelMember.create({
          data: {
            channelId: newChannel.id,
            userId: data.createdById,
            role: 'OWNER',
          },
        });

        return newChannel;
      });

      return channel;
    } catch (error) {
      throw new TransactionError('createChannel', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gets a channel by ID with members.
   */
  async getChannel(id: string): Promise<Channel | null> {
    const channel = await this.db.channel.findUnique({
      where: { id },
      include: {
        channelMembers: {
          include: { user: true },
        },
        workspace: true,
        createdBy: true,
      },
    });

    return channel;
  }

  /**
   * Lists channels in a workspace.
   */
  async listChannels(
    workspaceId: string,
    options: ChannelListOptions = {},
  ): Promise<Channel[]> {
    const {
      type,
      userId,
      includeArchived = DEFAULT_CHANNEL_LIST_OPTIONS.includeArchived,
      skip = DEFAULT_CHANNEL_LIST_OPTIONS.skip,
      take = DEFAULT_CHANNEL_LIST_OPTIONS.take,
      orderBy = DEFAULT_CHANNEL_LIST_OPTIONS.orderBy,
      orderDirection = DEFAULT_CHANNEL_LIST_OPTIONS.orderDirection,
    } = options;

    // Build where clause
    const where: Prisma.channelWhereInput = {
      workspaceId,
      ...(type && { type }),
      ...(!includeArchived && { isArchived: false }),
      ...(userId && {
        channelMembers: {
          some: { userId },
        },
      }),
    };

    const channels = await this.db.channel.findMany({
      where,
      include: {
        channelMembers: {
          include: { user: true },
        },
      },
      skip,
      take,
      orderBy: { [orderBy]: orderDirection },
    });

    return channels;
  }

  /**
   * Updates a channel.
   */
  async updateChannel(id: string, data: UpdateChannelInput): Promise<Channel> {
    // Validate input
    this.validateUpdateInput(data);

    // Check channel exists
    const existing = await this.getChannel(id);
    if (!existing) {
      throw new ChannelNotFoundError(id);
    }

    const updateData: Prisma.channelUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.settings !== undefined) {
      updateData.settings = data.settings as Prisma.InputJsonValue;
    }

    const updated = await this.db.channel.update({
      where: { id },
      data: updateData,
      include: {
        channelMembers: {
          include: { user: true },
        },
      },
    });

    return updated;
  }

  /**
   * Archives a channel.
   */
  async archiveChannel(id: string): Promise<Channel> {
    const existing = await this.getChannel(id);
    if (!existing) {
      throw new ChannelNotFoundError(id);
    }

    const archived = await this.db.channel.update({
      where: { id },
      data: { isArchived: true },
      include: {
        channelMembers: {
          include: { user: true },
        },
      },
    });

    return archived;
  }

  /**
   * Permanently deletes a channel.
   */
  async deleteChannel(id: string): Promise<void> {
    const existing = await this.getChannel(id);
    if (!existing) {
      throw new ChannelNotFoundError(id);
    }

    try {
      await this.db.$transaction(async (tx) => {
        // Delete all channel members
        await tx.channelMember.deleteMany({
          where: { channelId: id },
        });

        // Delete all messages in the channel
        await tx.message.deleteMany({
          where: { channelId: id },
        });

        // Delete the channel
        await tx.channel.delete({
          where: { id },
        });
      });
    } catch (error) {
      throw new TransactionError('deleteChannel', error instanceof Error ? error : undefined);
    }
  }

  // ===========================================================================
  // Membership Operations
  // ===========================================================================

  /**
   * Adds a member to a channel.
   */
  async addMember(
    channelId: string,
    userId: string,
    role: ChannelMemberRole = 'MEMBER',
  ): Promise<ChannelMember> {
    // Verify channel exists
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Check if already a member
    const existingMember = await this.db.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (existingMember) {
      // Return existing membership
      return existingMember;
    }

    const member = await this.db.channelMember.create({
      data: {
        channelId,
        userId,
        role: role as ChannelRole,
      },
      include: { user: true },
    });

    return member;
  }

  /**
   * Removes a member from a channel.
   */
  async removeMember(channelId: string, userId: string): Promise<void> {
    // Verify channel exists
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    // Verify membership exists
    const member = await this.db.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ChannelMemberNotFoundError(channelId, userId);
    }

    await this.db.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
  }

  /**
   * Updates a member's role.
   */
  async updateMemberRole(
    channelId: string,
    userId: string,
    role: ChannelMemberRole,
  ): Promise<ChannelMember> {
    // Verify channel exists
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    // Verify membership exists
    const member = await this.db.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ChannelMemberNotFoundError(channelId, userId);
    }

    const updated = await this.db.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      data: { role: role as ChannelRole },
      include: { user: true },
    });

    return updated;
  }

  /**
   * Gets all members of a channel.
   */
  async getMembers(channelId: string): Promise<ChannelMember[]> {
    // Verify channel exists
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    const members = await this.db.channelMember.findMany({
      where: { channelId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    return members;
  }

  /**
   * Checks if a user is a member of a channel.
   */
  async isMember(channelId: string, userId: string): Promise<boolean> {
    const member = await this.db.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
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
   * Validates create channel input.
   */
  private validateCreateInput(data: CreateChannelInput): void {
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

    if (!data.workspaceId) {
      errors.workspaceId = ['Workspace ID is required'];
    }

    if (!data.createdById) {
      errors.createdById = ['Creator ID is required'];
    }

    if (data.type && !['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'].includes(data.type)) {
      errors.type = ['Invalid channel type'];
    }

    if (Object.keys(errors).length > 0) {
      throw new ChannelValidationError('Channel validation failed', errors);
    }
  }

  /**
   * Validates update channel input.
   */
  private validateUpdateInput(data: UpdateChannelInput): void {
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

    if (data.type && !['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'].includes(data.type)) {
      errors.type = ['Invalid channel type'];
    }

    if (Object.keys(errors).length > 0) {
      throw new ChannelValidationError('Channel validation failed', errors);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new channel service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Channel service instance
 *
 * @example
 * ```typescript
 * const channelService = createChannelService();
 *
 * // Create a new channel
 * const channel = await channelService.createChannel({
 *   name: 'general',
 *   workspaceId: 'workspace_123',
 *   createdById: 'user_456',
 * });
 *
 * // Add a member
 * await channelService.addMember(channel.id, 'user_789', 'MEMBER');
 * ```
 */
export function createChannelService(database?: PrismaClient): ChannelServiceImpl {
  return new ChannelServiceImpl(database);
}

/**
 * Default channel service instance using the singleton Prisma client.
 */
export const channelService = createChannelService();
