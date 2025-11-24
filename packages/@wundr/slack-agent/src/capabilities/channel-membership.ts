/**
 * Channel Membership Operations for Slack VP Agent
 *
 * Implements channel membership management capabilities allowing the VP agent
 * to join/leave channels and manage membership like any human user.
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a Slack channel with essential membership-related properties
 */
export interface Channel {
  /** Unique channel identifier (e.g., C1234567890) */
  id: string;
  /** Human-readable channel name */
  name: string;
  /** Whether this is a private channel */
  isPrivate: boolean;
  /** Whether the channel is archived */
  isArchived: boolean;
  /** Whether the VP agent is a member of this channel */
  isMember: boolean;
  /** Number of members in the channel */
  memberCount?: number;
  /** Channel topic */
  topic?: string;
  /** Channel purpose/description */
  purpose?: string;
  /** ISO timestamp of channel creation */
  created?: string;
}

/**
 * Result of an invite operation for a single user
 */
export interface InviteResult {
  /** The user ID that was invited */
  userId: string;
  /** Whether the invite was successful */
  success: boolean;
  /** Error message if the invite failed */
  error?: string;
  /** Error code from Slack API */
  errorCode?: string;
  /** Whether the user was already a member */
  alreadyMember?: boolean;
}

/**
 * Represents a channel member with basic profile info
 */
export interface ChannelMember {
  /** User ID */
  id: string;
  /** Display name */
  name?: string;
  /** Real name */
  realName?: string;
  /** Whether the user is a bot */
  isBot?: boolean;
  /** Whether the user is an admin */
  isAdmin?: boolean;
  /** Whether the user is the workspace owner */
  isOwner?: boolean;
}

/**
 * Options for listing channels
 */
export interface ListChannelsOptions {
  /** Include archived channels */
  includeArchived?: boolean;
  /** Only return channels where VP is a member */
  memberOnly?: boolean;
  /** Maximum number of channels to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by channel type: 'public' | 'private' | 'all' */
  types?: 'public' | 'private' | 'all';
}

/**
 * Paginated response for channel listings
 */
export interface PaginatedChannelResponse {
  channels: Channel[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Error thrown for Slack API permission issues
 */
export class SlackPermissionError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly channelId?: string,
    public readonly userId?: string,
  ) {
    super(message);
    this.name = 'SlackPermissionError';
  }
}

/**
 * Error thrown when a channel is not found
 */
export class ChannelNotFoundError extends Error {
  constructor(public readonly channelId: string) {
    super(`Channel not found: ${channelId}`);
    this.name = 'ChannelNotFoundError';
  }
}

/**
 * Error thrown when a user is not found
 */
export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Internal type for Slack API channel response
 */
interface SlackChannelResponse {
  id?: string;
  name?: string;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: { value?: string };
  purpose?: { value?: string };
  created?: number;
}

// =============================================================================
// Channel Membership Manager
// =============================================================================

/**
 * Manages channel membership operations for the Slack VP agent.
 *
 * This class provides methods for the VP agent to:
 * - Join and leave channels
 * - Invite and kick users from channels
 * - List channel members and the VP's channels
 * - Check channel membership status
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { ChannelMembershipManager } from './channel-membership';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const membership = new ChannelMembershipManager(client);
 *
 * // Join a channel
 * await membership.joinChannel('C1234567890');
 *
 * // Invite users to a channel
 * const results = await membership.inviteMultipleToChannel('C1234567890', ['U111', 'U222']);
 *
 * // List VP's channels
 * const channels = await membership.getMyChannels();
 * ```
 */
export class ChannelMembershipManager {
  private readonly client: WebClient;
  private cachedBotUserId: string | null = null;

  /**
   * Creates a new ChannelMembershipManager instance
   *
   * @param client - Authenticated Slack WebClient instance
   */
  constructor(client: WebClient) {
    this.client = client;
  }

  /**
   * Gets the bot/VP user ID, caching the result for future calls
   */
  private async getBotUserId(): Promise<string> {
    if (this.cachedBotUserId) {
      return this.cachedBotUserId;
    }

    const response = await this.client.auth.test();
    if (!response.ok || !response.user_id) {
      throw new Error('Failed to retrieve bot user ID');
    }

    this.cachedBotUserId = response.user_id;
    return this.cachedBotUserId;
  }

  /**
   * Handles Slack API errors and converts them to typed errors
   */
  private handleSlackError(
    error: unknown,
    operation: string,
    channelId?: string,
    userId?: string,
  ): never {
    const slackError = error as { data?: { error?: string }; message?: string };
    const errorCode = slackError?.data?.error || 'unknown_error';
    const message = slackError?.message || `${operation} failed`;

    // Map common error codes to specific error types
    switch (errorCode) {
      case 'channel_not_found':
        throw new ChannelNotFoundError(channelId || 'unknown');
      case 'user_not_found':
        throw new UserNotFoundError(userId || 'unknown');
      case 'not_in_channel':
      case 'cant_invite_self':
      case 'cant_kick_self':
      case 'cant_kick_from_general':
      case 'restricted_action':
      case 'missing_scope':
      case 'not_authed':
      case 'invalid_auth':
      case 'account_inactive':
      case 'user_is_restricted':
      case 'user_is_ultra_restricted':
      case 'cant_invite':
      case 'is_archived':
        throw new SlackPermissionError(
          `${operation}: ${errorCode}`,
          errorCode,
          channelId,
          userId,
        );
      default:
        throw new Error(`${operation} failed: ${errorCode} - ${message}`);
    }
  }

  // ===========================================================================
  // Core Membership Operations
  // ===========================================================================

  /**
   * Joins a public channel
   *
   * @param channelId - The ID of the channel to join (e.g., C1234567890)
   * @throws {ChannelNotFoundError} If the channel does not exist
   * @throws {SlackPermissionError} If the VP lacks permission to join
   *
   * @example
   * ```typescript
   * await membership.joinChannel('C1234567890');
   * ```
   */
  async joinChannel(channelId: string): Promise<void> {
    try {
      const response = await this.client.conversations.join({
        channel: channelId,
      });

      if (!response.ok) {
        throw new Error(`Failed to join channel: ${channelId}`);
      }
    } catch (error) {
      this.handleSlackError(error, 'Join channel', channelId);
    }
  }

  /**
   * Leaves a channel
   *
   * @param channelId - The ID of the channel to leave
   * @throws {ChannelNotFoundError} If the channel does not exist
   * @throws {SlackPermissionError} If leaving is not permitted (e.g., #general)
   *
   * @example
   * ```typescript
   * await membership.leaveChannel('C1234567890');
   * ```
   */
  async leaveChannel(channelId: string): Promise<void> {
    try {
      const response = await this.client.conversations.leave({
        channel: channelId,
      });

      if (!response.ok) {
        throw new Error(`Failed to leave channel: ${channelId}`);
      }
    } catch (error) {
      this.handleSlackError(error, 'Leave channel', channelId);
    }
  }

  /**
   * Invites a single user to a channel
   *
   * @param channelId - The ID of the channel
   * @param userId - The ID of the user to invite
   * @throws {ChannelNotFoundError} If the channel does not exist
   * @throws {UserNotFoundError} If the user does not exist
   * @throws {SlackPermissionError} If the VP lacks permission to invite
   *
   * @example
   * ```typescript
   * await membership.inviteToChannel('C1234567890', 'U9876543210');
   * ```
   */
  async inviteToChannel(channelId: string, userId: string): Promise<void> {
    try {
      const response = await this.client.conversations.invite({
        channel: channelId,
        users: userId,
      });

      if (!response.ok) {
        throw new Error(`Failed to invite user ${userId} to channel ${channelId}`);
      }
    } catch (error) {
      // Check if user is already in channel (not really an error)
      const slackError = error as { data?: { error?: string } };
      if (slackError?.data?.error === 'already_in_channel') {
        return; // Silently succeed if already a member
      }
      this.handleSlackError(error, 'Invite to channel', channelId, userId);
    }
  }

  /**
   * Invites multiple users to a channel, handling failures gracefully
   *
   * @param channelId - The ID of the channel
   * @param userIds - Array of user IDs to invite
   * @returns Array of results for each user invitation
   *
   * @example
   * ```typescript
   * const results = await membership.inviteMultipleToChannel('C1234567890', ['U111', 'U222', 'U333']);
   * const failed = results.filter(r => !r.success);
   * if (failed.length > 0) {
   *   console.log('Some invites failed:', failed);
   * }
   * ```
   */
  async inviteMultipleToChannel(
    channelId: string,
    userIds: string[],
  ): Promise<InviteResult[]> {
    const results: InviteResult[] = [];

    // Process invites sequentially to respect rate limits
    for (const userId of userIds) {
      try {
        const response = await this.client.conversations.invite({
          channel: channelId,
          users: userId,
        });

        results.push({
          userId,
          success: response.ok === true,
          alreadyMember: false,
        });
      } catch (error) {
        const slackError = error as { data?: { error?: string }; message?: string };
        const errorCode = slackError?.data?.error || 'unknown_error';

        if (errorCode === 'already_in_channel') {
          results.push({
            userId,
            success: true,
            alreadyMember: true,
          });
        } else {
          results.push({
            userId,
            success: false,
            error: slackError?.message || `Failed to invite user: ${errorCode}`,
            errorCode,
            alreadyMember: false,
          });
        }
      }
    }

    return results;
  }

  /**
   * Removes a user from a channel (kick)
   *
   * Note: This requires appropriate permissions. The VP must be a channel admin
   * or workspace admin to kick users from channels.
   *
   * @param channelId - The ID of the channel
   * @param userId - The ID of the user to remove
   * @throws {ChannelNotFoundError} If the channel does not exist
   * @throws {UserNotFoundError} If the user does not exist
   * @throws {SlackPermissionError} If the VP lacks permission to kick
   *
   * @example
   * ```typescript
   * await membership.kickFromChannel('C1234567890', 'U9876543210');
   * ```
   */
  async kickFromChannel(channelId: string, userId: string): Promise<void> {
    try {
      const response = await this.client.conversations.kick({
        channel: channelId,
        user: userId,
      });

      if (!response.ok) {
        throw new Error(`Failed to kick user ${userId} from channel ${channelId}`);
      }
    } catch (error) {
      this.handleSlackError(error, 'Kick from channel', channelId, userId);
    }
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Gets all member IDs for a channel
   *
   * Handles pagination automatically to retrieve all members.
   *
   * @param channelId - The ID of the channel
   * @returns Array of user IDs who are members of the channel
   * @throws {ChannelNotFoundError} If the channel does not exist
   * @throws {SlackPermissionError} If the VP lacks permission to view members
   *
   * @example
   * ```typescript
   * const memberIds = await membership.getChannelMembers('C1234567890');
   * console.log(`Channel has ${memberIds.length} members`);
   * ```
   */
  async getChannelMembers(channelId: string): Promise<string[]> {
    const allMembers: string[] = [];
    let cursor: string | undefined;

    try {
      do {
        const response = await this.client.conversations.members({
          channel: channelId,
          cursor,
          limit: 1000, // Maximum allowed by Slack API
        });

        if (!response.ok) {
          throw new Error(`Failed to get channel members: ${channelId}`);
        }

        if (response.members) {
          allMembers.push(...response.members);
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      return allMembers;
    } catch (error) {
      this.handleSlackError(error, 'Get channel members', channelId);
    }
  }

  /**
   * Gets detailed information about channel members
   *
   * @param channelId - The ID of the channel
   * @returns Array of ChannelMember objects with profile information
   *
   * @example
   * ```typescript
   * const members = await membership.getChannelMembersDetailed('C1234567890');
   * const admins = members.filter(m => m.isAdmin);
   * ```
   */
  async getChannelMembersDetailed(channelId: string): Promise<ChannelMember[]> {
    const memberIds = await this.getChannelMembers(channelId);
    const detailedMembers: ChannelMember[] = [];

    // Fetch user info in batches to respect rate limits
    for (const userId of memberIds) {
      try {
        const response = await this.client.users.info({
          user: userId,
        });

        if (response.ok && response.user) {
          detailedMembers.push({
            id: response.user.id || userId,
            name: response.user.name,
            realName: response.user.real_name,
            isBot: response.user.is_bot,
            isAdmin: response.user.is_admin,
            isOwner: response.user.is_owner,
          });
        }
      } catch {
        // If we can't get user info, still include the ID
        detailedMembers.push({ id: userId });
      }
    }

    return detailedMembers;
  }

  /**
   * Gets all channels the VP agent is a member of
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of Channel objects
   *
   * @example
   * ```typescript
   * // Get all channels VP is a member of
   * const channels = await membership.getMyChannels();
   *
   * // Get only public channels
   * const publicChannels = await membership.getMyChannels({ types: 'public' });
   * ```
   */
  async getMyChannels(options: ListChannelsOptions = {}): Promise<Channel[]> {
    const allChannels: Channel[] = [];
    let cursor: string | undefined = options.cursor;
    const limit = options.limit || 1000;

    // Determine channel types to fetch
    let types = 'public_channel,private_channel';
    if (options.types === 'public') {
      types = 'public_channel';
    } else if (options.types === 'private') {
      types = 'private_channel';
    }

    try {
      do {
        const response = await this.client.conversations.list({
          cursor,
          limit: Math.min(limit - allChannels.length, 1000),
          types,
          exclude_archived: !options.includeArchived,
        });

        if (!response.ok) {
          throw new Error('Failed to list channels');
        }

        if (response.channels) {
          for (const channel of response.channels) {
            // Filter to only channels where VP is a member
            if (channel.is_member) {
              allChannels.push(this.mapChannelResponse(channel as SlackChannelResponse));
            }
          }
        }

        cursor = response.response_metadata?.next_cursor;

        // Stop if we've reached the requested limit
        if (options.limit && allChannels.length >= options.limit) {
          break;
        }
      } while (cursor);

      return allChannels;
    } catch (error) {
      this.handleSlackError(error, 'Get my channels');
    }
  }

  /**
   * Gets channels with pagination support
   *
   * @param options - Filtering and pagination options
   * @returns Paginated response with channels and cursor
   *
   * @example
   * ```typescript
   * let response = await membership.getMyChannelsPaginated({ limit: 10 });
   * while (response.hasMore) {
   *   console.log(`Fetched ${response.channels.length} channels`);
   *   response = await membership.getMyChannelsPaginated({
   *     limit: 10,
   *     cursor: response.nextCursor
   *   });
   * }
   * ```
   */
  async getMyChannelsPaginated(
    options: ListChannelsOptions = {},
  ): Promise<PaginatedChannelResponse> {
    const limit = options.limit || 100;

    let types = 'public_channel,private_channel';
    if (options.types === 'public') {
      types = 'public_channel';
    } else if (options.types === 'private') {
      types = 'private_channel';
    }

    try {
      const response = await this.client.conversations.list({
        cursor: options.cursor,
        limit,
        types,
        exclude_archived: !options.includeArchived,
      });

      if (!response.ok) {
        throw new Error('Failed to list channels');
      }

      const channels: Channel[] = [];
      if (response.channels) {
        for (const channel of response.channels) {
          if (channel.is_member) {
            channels.push(this.mapChannelResponse(channel as SlackChannelResponse));
          }
        }
      }

      const nextCursor = response.response_metadata?.next_cursor;

      return {
        channels,
        nextCursor: nextCursor || undefined,
        hasMore: !!nextCursor,
      };
    } catch (error) {
      this.handleSlackError(error, 'Get my channels paginated');
    }
  }

  /**
   * Checks if a user (or the VP itself) is a member of a channel
   *
   * @param channelId - The ID of the channel
   * @param userId - Optional user ID to check. If not provided, checks the VP itself.
   * @returns True if the user is a member of the channel
   *
   * @example
   * ```typescript
   * // Check if VP is in channel
   * const vpInChannel = await membership.isChannelMember('C1234567890');
   *
   * // Check if specific user is in channel
   * const userInChannel = await membership.isChannelMember('C1234567890', 'U9876543210');
   * ```
   */
  async isChannelMember(channelId: string, userId?: string): Promise<boolean> {
    try {
      // If no userId provided, check the VP itself
      const targetUserId = userId || (await this.getBotUserId());

      // Get channel members and check if target is in the list
      const members = await this.getChannelMembers(channelId);
      return members.includes(targetUserId);
    } catch (error) {
      // If we get a permission error, we're likely not in the channel
      if (error instanceof SlackPermissionError) {
        if (error.errorCode === 'not_in_channel') {
          return false;
        }
      }
      throw error;
    }
  }

  /**
   * Gets information about a specific channel
   *
   * @param channelId - The ID of the channel
   * @returns Channel object with full details
   * @throws {ChannelNotFoundError} If the channel does not exist
   *
   * @example
   * ```typescript
   * const channel = await membership.getChannelInfo('C1234567890');
   * console.log(`Channel: #${channel.name} (${channel.memberCount} members)`);
   * ```
   */
  async getChannelInfo(channelId: string): Promise<Channel> {
    try {
      const response = await this.client.conversations.info({
        channel: channelId,
        include_num_members: true,
      });

      if (!response.ok || !response.channel) {
        throw new ChannelNotFoundError(channelId);
      }

      return this.mapChannelResponse(response.channel as SlackChannelResponse);
    } catch (error) {
      this.handleSlackError(error, 'Get channel info', channelId);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Maps Slack API channel response to our Channel type
   */
  private mapChannelResponse(channel: SlackChannelResponse): Channel {
    return {
      id: channel.id || '',
      name: channel.name || '',
      isPrivate: channel.is_private || false,
      isArchived: channel.is_archived || false,
      isMember: channel.is_member || false,
      memberCount: channel.num_members,
      topic: channel.topic?.value,
      purpose: channel.purpose?.value,
      created: channel.created
        ? new Date(channel.created * 1000).toISOString()
        : undefined,
    };
  }
}
