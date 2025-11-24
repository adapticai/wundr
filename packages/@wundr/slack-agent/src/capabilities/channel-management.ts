/**
 * @wundr.io/slack-agent - Channel Management Capability
 *
 * Provides comprehensive Slack channel management capabilities for the VP agent.
 * The VP agent operates as a full user in Slack workspaces, enabling it to
 * create, archive, rename, and manage channels with appropriate permissions.
 *
 * @packageDocumentation
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Slack channel representation
 */
export interface Channel {
  /** Unique channel identifier */
  readonly id: string;
  /** Channel name (without # prefix) */
  readonly name: string;
  /** Whether channel is private */
  readonly isPrivate: boolean;
  /** Whether channel is archived */
  readonly isArchived: boolean;
  /** Channel topic */
  readonly topic?: string;
  /** Channel purpose/description */
  readonly purpose?: string;
  /** Number of members */
  readonly memberCount?: number;
  /** Channel creator user ID */
  readonly creator?: string;
  /** Creation timestamp (Unix epoch seconds) */
  readonly created?: number;
  /** Whether the VP agent is a member */
  readonly isMember?: boolean;
  /** Last activity timestamp */
  readonly lastActivity?: number;
}

/**
 * Options for creating a channel
 */
export interface CreateChannelOptions {
  /** Channel topic (max 250 characters) */
  topic?: string;
  /** Channel purpose/description (max 250 characters) */
  purpose?: string;
  /** Team ID for Enterprise Grid organizations */
  teamId?: string;
  /** User IDs to invite upon creation */
  initialMembers?: string[];
}

/**
 * Options for listing channels
 */
export interface ListChannelsOptions {
  /** Include archived channels */
  includeArchived?: boolean;
  /** Maximum number of channels to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Team ID for Enterprise Grid organizations */
  teamId?: string;
  /** Filter to only channels the VP is a member of */
  memberOnly?: boolean;
  /** Filter channels by name pattern (substring match) */
  namePattern?: string;
}

/**
 * Paginated channel list result
 */
export interface ListChannelsResult {
  /** Retrieved channels */
  readonly channels: Channel[];
  /** Pagination cursor for next page (if available) */
  readonly nextCursor?: string;
  /** Whether more results are available */
  readonly hasMore: boolean;
}

/**
 * Channel management error codes
 */
export enum ChannelErrorCode {
  /** Channel name already exists */
  NAME_TAKEN = 'name_taken',
  /** Invalid channel name format */
  INVALID_NAME = 'invalid_name',
  /** Channel not found */
  NOT_FOUND = 'channel_not_found',
  /** Insufficient permissions */
  PERMISSION_DENIED = 'not_allowed',
  /** Channel is already archived */
  ALREADY_ARCHIVED = 'already_archived',
  /** Channel is not archived (cannot unarchive) */
  NOT_ARCHIVED = 'not_archived',
  /** Rate limited */
  RATE_LIMITED = 'ratelimited',
  /** General error */
  UNKNOWN = 'unknown_error',
  /** Cannot convert private to public */
  CANNOT_CONVERT = 'method_not_supported_for_channel_type',
}

/**
 * Channel management error
 */
export class ChannelManagementError extends Error {
  /** Error code from Slack API or internal */
  readonly code: ChannelErrorCode | string;
  /** Original Slack API error (if available) */
  readonly slackError?: string;
  /** Channel ID related to the error (if available) */
  readonly channelId?: string;

  constructor(
    message: string,
    code: ChannelErrorCode | string,
    options?: { slackError?: string; channelId?: string },
  ) {
    super(message);
    this.name = 'ChannelManagementError';
    this.code = code;
    this.slackError = options?.slackError;
    this.channelId = options?.channelId;
  }
}

/**
 * Configuration for ChannelManager
 */
export interface ChannelManagerConfig {
  /** Default team ID for Enterprise Grid (optional) */
  defaultTeamId?: string;
  /** Maximum retries on rate limit */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

// =============================================================================
// Channel Manager Implementation
// =============================================================================

/**
 * ChannelManager - Manages Slack channel operations for the VP agent
 *
 * Provides methods to create, archive, rename, and query channels.
 * Handles permission errors gracefully and provides clear error messages.
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { ChannelManager } from '@wundr.io/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const channelManager = new ChannelManager(client);
 *
 * // Create a public channel
 * const channel = await channelManager.createChannel('project-updates', {
 *   topic: 'Project status updates',
 *   purpose: 'Share project updates and announcements',
 * });
 *
 * // List all channels
 * const { channels } = await channelManager.listChannels();
 * ```
 */
export class ChannelManager {
  private readonly client: WebClient;
  private readonly config: Required<ChannelManagerConfig>;

  /**
   * Creates a new ChannelManager instance
   *
   * @param client - Authenticated Slack WebClient instance
   * @param config - Optional configuration
   */
  constructor(client: WebClient, config: ChannelManagerConfig = {}) {
    this.client = client;
    this.config = {
      defaultTeamId: config.defaultTeamId ?? '',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };
  }

  // ===========================================================================
  // Channel Creation
  // ===========================================================================

  /**
   * Create a public channel
   *
   * @param name - Channel name (lowercase, no spaces, max 80 characters)
   * @param options - Channel creation options
   * @returns Created channel
   * @throws ChannelManagementError if creation fails
   *
   * @example
   * ```typescript
   * const channel = await channelManager.createChannel('announcements', {
   *   topic: 'Company announcements',
   *   purpose: 'Official company-wide announcements',
   *   initialMembers: ['U12345', 'U67890'],
   * });
   * ```
   */
  async createChannel(
    name: string,
    options: CreateChannelOptions = {},
  ): Promise<Channel> {
    return this.createChannelInternal(name, false, options);
  }

  /**
   * Create a private channel (group)
   *
   * @param name - Channel name (lowercase, no spaces, max 80 characters)
   * @param options - Channel creation options
   * @returns Created channel
   * @throws ChannelManagementError if creation fails
   *
   * @example
   * ```typescript
   * const channel = await channelManager.createPrivateChannel('secret-project', {
   *   topic: 'Confidential project discussion',
   *   initialMembers: ['U12345'],
   * });
   * ```
   */
  async createPrivateChannel(
    name: string,
    options: CreateChannelOptions = {},
  ): Promise<Channel> {
    return this.createChannelInternal(name, true, options);
  }

  /**
   * Internal channel creation implementation
   */
  private async createChannelInternal(
    name: string,
    isPrivate: boolean,
    options: CreateChannelOptions,
  ): Promise<Channel> {
    const normalizedName = this.normalizeChannelName(name);
    this.validateChannelName(normalizedName);

    try {
      const response = await this.withRetry(() =>
        this.client.conversations.create({
          name: normalizedName,
          is_private: isPrivate,
          team_id: options.teamId || this.config.defaultTeamId || undefined,
        }),
      );

      if (!response.ok || !response.channel) {
        throw new ChannelManagementError(
          `Failed to create channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      const channelId = response.channel.id as string;

      // Set topic if provided
      if (options.topic) {
        await this.setTopic(channelId, options.topic);
      }

      // Set purpose if provided
      if (options.purpose) {
        await this.setPurpose(channelId, options.purpose);
      }

      // Invite initial members if provided
      if (options.initialMembers && options.initialMembers.length > 0) {
        await this.inviteMembers(channelId, options.initialMembers);
      }

      return this.mapSlackChannel(response.channel as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'create channel');
    }
  }

  // ===========================================================================
  // Channel Archival
  // ===========================================================================

  /**
   * Archive a channel
   *
   * Archives the specified channel. Archived channels are hidden from the
   * channel list but can be unarchived later.
   *
   * @param channelId - Channel ID to archive
   * @throws ChannelManagementError if archival fails
   *
   * @example
   * ```typescript
   * await channelManager.archiveChannel('C12345');
   * ```
   */
  async archiveChannel(channelId: string): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.archive({
          channel: channelId,
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to archive channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'archive channel', channelId);
    }
  }

  /**
   * Unarchive a channel
   *
   * Restores an archived channel, making it visible and active again.
   *
   * @param channelId - Channel ID to unarchive
   * @throws ChannelManagementError if unarchival fails
   *
   * @example
   * ```typescript
   * await channelManager.unarchiveChannel('C12345');
   * ```
   */
  async unarchiveChannel(channelId: string): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.unarchive({
          channel: channelId,
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to unarchive channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'unarchive channel', channelId);
    }
  }

  // ===========================================================================
  // Channel Updates
  // ===========================================================================

  /**
   * Rename a channel
   *
   * @param channelId - Channel ID to rename
   * @param newName - New channel name
   * @returns Updated channel
   * @throws ChannelManagementError if rename fails
   *
   * @example
   * ```typescript
   * const channel = await channelManager.renameChannel('C12345', 'new-name');
   * ```
   */
  async renameChannel(channelId: string, newName: string): Promise<Channel> {
    const normalizedName = this.normalizeChannelName(newName);
    this.validateChannelName(normalizedName);

    try {
      const response = await this.withRetry(() =>
        this.client.conversations.rename({
          channel: channelId,
          name: normalizedName,
        }),
      );

      if (!response.ok || !response.channel) {
        throw new ChannelManagementError(
          `Failed to rename channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }

      return this.mapSlackChannel(response.channel as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'rename channel', channelId);
    }
  }

  /**
   * Set channel topic
   *
   * @param channelId - Channel ID
   * @param topic - New topic (max 250 characters)
   * @throws ChannelManagementError if update fails
   *
   * @example
   * ```typescript
   * await channelManager.setTopic('C12345', 'Weekly standup notes');
   * ```
   */
  async setTopic(channelId: string, topic: string): Promise<void> {
    const truncatedTopic = topic.slice(0, 250);

    try {
      const response = await this.withRetry(() =>
        this.client.conversations.setTopic({
          channel: channelId,
          topic: truncatedTopic,
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to set topic: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'set topic', channelId);
    }
  }

  /**
   * Set channel purpose/description
   *
   * @param channelId - Channel ID
   * @param purpose - New purpose (max 250 characters)
   * @throws ChannelManagementError if update fails
   *
   * @example
   * ```typescript
   * await channelManager.setPurpose('C12345', 'Discussion about Q4 goals');
   * ```
   */
  async setPurpose(channelId: string, purpose: string): Promise<void> {
    const truncatedPurpose = purpose.slice(0, 250);

    try {
      const response = await this.withRetry(() =>
        this.client.conversations.setPurpose({
          channel: channelId,
          purpose: truncatedPurpose,
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to set purpose: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'set purpose', channelId);
    }
  }

  // ===========================================================================
  // Channel Queries
  // ===========================================================================

  /**
   * Get channel information
   *
   * @param channelId - Channel ID
   * @returns Channel details
   * @throws ChannelManagementError if channel not found
   *
   * @example
   * ```typescript
   * const channel = await channelManager.getChannelInfo('C12345');
   * console.log(`Channel: #${channel.name}, Members: ${channel.memberCount}`);
   * ```
   */
  async getChannelInfo(channelId: string): Promise<Channel> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.info({
          channel: channelId,
          include_num_members: true,
        }),
      );

      if (!response.ok || !response.channel) {
        throw new ChannelManagementError(
          `Failed to get channel info: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.NOT_FOUND,
          { slackError: response.error, channelId },
        );
      }

      return this.mapSlackChannel(response.channel as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'get channel info', channelId);
    }
  }

  /**
   * List public channels
   *
   * @param options - List options
   * @returns Paginated list of channels
   *
   * @example
   * ```typescript
   * // Get first page of channels
   * const result = await channelManager.listChannels({ limit: 100 });
   *
   * // Filter by name pattern
   * const projectChannels = await channelManager.listChannels({
   *   namePattern: 'project-',
   *   memberOnly: true,
   * });
   *
   * // Paginate through all channels
   * let cursor: string | undefined;
   * do {
   *   const { channels, nextCursor } = await channelManager.listChannels({ cursor });
   *   // Process channels...
   *   cursor = nextCursor;
   * } while (cursor);
   * ```
   */
  async listChannels(
    options: ListChannelsOptions = {},
  ): Promise<ListChannelsResult> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.list({
          exclude_archived: !options.includeArchived,
          limit: options.limit || 100,
          cursor: options.cursor,
          team_id: options.teamId || this.config.defaultTeamId || undefined,
          types: 'public_channel',
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to list channels: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      let channels = (response.channels || []).map((ch) =>
        this.mapSlackChannel(ch as Record<string, unknown>),
      );

      // Apply filters
      if (options.memberOnly) {
        channels = channels.filter((ch) => ch.isMember);
      }

      if (options.namePattern) {
        const pattern = options.namePattern.toLowerCase();
        channels = channels.filter((ch) =>
          ch.name.toLowerCase().includes(pattern),
        );
      }

      return {
        channels,
        nextCursor: response.response_metadata?.next_cursor || undefined,
        hasMore: !!response.response_metadata?.next_cursor,
      };
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'list channels');
    }
  }

  /**
   * List private channels the VP is a member of
   *
   * @returns List of private channels
   *
   * @example
   * ```typescript
   * const privateChannels = await channelManager.listPrivateChannels();
   * ```
   */
  async listPrivateChannels(): Promise<Channel[]> {
    try {
      const allChannels: Channel[] = [];
      let cursor: string | undefined;

      do {
        const response = await this.withRetry(() =>
          this.client.conversations.list({
            exclude_archived: true,
            limit: 200,
            cursor,
            types: 'private_channel',
          }),
        );

        if (!response.ok) {
          throw new ChannelManagementError(
            `Failed to list private channels: ${response.error || 'Unknown error'}`,
            response.error || ChannelErrorCode.UNKNOWN,
            { slackError: response.error },
          );
        }

        const channels = (response.channels || []).map((ch) =>
          this.mapSlackChannel(ch as Record<string, unknown>),
        );
        allChannels.push(...channels);

        cursor = response.response_metadata?.next_cursor || undefined;
      } while (cursor);

      return allChannels;
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'list private channels');
    }
  }

  // ===========================================================================
  // Channel Membership (Additional utilities)
  // ===========================================================================

  /**
   * Invite users to a channel
   *
   * @param channelId - Channel ID
   * @param userIds - User IDs to invite
   * @throws ChannelManagementError if invite fails
   */
  async inviteMembers(channelId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      const response = await this.withRetry(() =>
        this.client.conversations.invite({
          channel: channelId,
          users: userIds.join(','),
        }),
      );

      if (!response.ok) {
        // Ignore already_in_channel errors
        if (response.error !== 'already_in_channel') {
          throw new ChannelManagementError(
            `Failed to invite members: ${response.error || 'Unknown error'}`,
            response.error || ChannelErrorCode.UNKNOWN,
            { slackError: response.error, channelId },
          );
        }
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'invite members', channelId);
    }
  }

  /**
   * Join a public channel
   *
   * @param channelId - Channel ID to join
   * @returns Joined channel
   */
  async joinChannel(channelId: string): Promise<Channel> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.join({
          channel: channelId,
        }),
      );

      if (!response.ok || !response.channel) {
        throw new ChannelManagementError(
          `Failed to join channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }

      return this.mapSlackChannel(response.channel as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'join channel', channelId);
    }
  }

  /**
   * Leave a channel
   *
   * @param channelId - Channel ID to leave
   */
  async leaveChannel(channelId: string): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.leave({
          channel: channelId,
        }),
      );

      if (!response.ok) {
        throw new ChannelManagementError(
          `Failed to leave channel: ${response.error || 'Unknown error'}`,
          response.error || ChannelErrorCode.UNKNOWN,
          { slackError: response.error, channelId },
        );
      }
    } catch (error) {
      if (error instanceof ChannelManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'leave channel', channelId);
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Normalize channel name to Slack format
   */
  private normalizeChannelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 80);
  }

  /**
   * Validate channel name format
   */
  private validateChannelName(name: string): void {
    if (!name || name.length === 0) {
      throw new ChannelManagementError(
        'Channel name cannot be empty',
        ChannelErrorCode.INVALID_NAME,
      );
    }

    if (name.length > 80) {
      throw new ChannelManagementError(
        'Channel name cannot exceed 80 characters',
        ChannelErrorCode.INVALID_NAME,
      );
    }

    if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
      throw new ChannelManagementError(
        'Channel name must start with a letter or number and contain only lowercase letters, numbers, hyphens, and underscores',
        ChannelErrorCode.INVALID_NAME,
      );
    }
  }

  /**
   * Map Slack API channel response to Channel type
   */
  private mapSlackChannel(slackChannel: Record<string, unknown>): Channel {
    const topic = slackChannel.topic as { value?: string } | undefined;
    const purpose = slackChannel.purpose as { value?: string } | undefined;

    return {
      id: slackChannel.id as string,
      name: slackChannel.name as string,
      isPrivate: (slackChannel.is_private as boolean) ?? false,
      isArchived: (slackChannel.is_archived as boolean) ?? false,
      topic: topic?.value,
      purpose: purpose?.value,
      memberCount: slackChannel.num_members as number | undefined,
      creator: slackChannel.creator as string | undefined,
      created: slackChannel.created as number | undefined,
      isMember: slackChannel.is_member as boolean | undefined,
      lastActivity: slackChannel.last_read as number | undefined,
    };
  }

  /**
   * Handle Slack API errors
   */
  private handleSlackError(
    error: unknown,
    operation: string,
    channelId?: string,
  ): ChannelManagementError {
    const slackError =
      error instanceof Error
        ? (error as { data?: { error?: string } }).data?.error || error.message
        : 'Unknown error';

    // Map common Slack errors to our error codes
    let code: ChannelErrorCode | string = ChannelErrorCode.UNKNOWN;

    if (typeof slackError === 'string') {
      switch (slackError) {
        case 'name_taken':
          code = ChannelErrorCode.NAME_TAKEN;
          break;
        case 'invalid_name':
        case 'invalid_name_required':
        case 'invalid_name_maxlength':
        case 'invalid_name_punctuation':
        case 'invalid_name_specials':
          code = ChannelErrorCode.INVALID_NAME;
          break;
        case 'channel_not_found':
          code = ChannelErrorCode.NOT_FOUND;
          break;
        case 'not_allowed':
        case 'not_authorized':
        case 'missing_scope':
        case 'is_archived':
          code = ChannelErrorCode.PERMISSION_DENIED;
          break;
        case 'already_archived':
          code = ChannelErrorCode.ALREADY_ARCHIVED;
          break;
        case 'not_archived':
          code = ChannelErrorCode.NOT_ARCHIVED;
          break;
        case 'ratelimited':
          code = ChannelErrorCode.RATE_LIMITED;
          break;
        default:
          code = slackError;
      }
    }

    return new ChannelManagementError(
      `Failed to ${operation}: ${slackError}`,
      code,
      { slackError: typeof slackError === 'string' ? slackError : undefined, channelId },
    );
  }

  /**
   * Retry wrapper with exponential backoff for rate limits
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if rate limited
        const slackError =
          error instanceof Error
            ? (error as { data?: { error?: string } }).data?.error
            : undefined;

        if (slackError === 'ratelimited') {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // Re-throw non-rate-limit errors immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a ChannelManager instance
 *
 * @param client - Authenticated Slack WebClient
 * @param config - Optional configuration
 * @returns ChannelManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createChannelManager } from '@wundr.io/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const channelManager = createChannelManager(client);
 * ```
 */
export function createChannelManager(
  client: WebClient,
  config?: ChannelManagerConfig,
): ChannelManager {
  return new ChannelManager(client, config);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is a ChannelManagementError
 */
export function isChannelManagementError(
  error: unknown,
): error is ChannelManagementError {
  return error instanceof ChannelManagementError;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  return (
    isChannelManagementError(error) &&
    error.code === ChannelErrorCode.PERMISSION_DENIED
  );
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return (
    isChannelManagementError(error) &&
    error.code === ChannelErrorCode.RATE_LIMITED
  );
}

/**
 * Check if error is a channel not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    isChannelManagementError(error) && error.code === ChannelErrorCode.NOT_FOUND
  );
}
