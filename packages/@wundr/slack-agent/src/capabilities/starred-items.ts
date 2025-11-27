/**
 * @wundr/slack-agent - Starred Items Capability
 *
 * Provides starred items management for Orchestrator (Virtual Principal) agents
 * operating as full users in Slack workspaces. Enables starring/unstarring
 * of messages, files, and channels for quick reference and bookmarking.
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Types of items that can be starred
 */
export type StarredItemType = 'message' | 'file' | 'channel';

/**
 * Message data within a starred item
 */
export interface StarredMessageData {
  /** Channel ID where the message is located */
  channel: string;
  /** Message timestamp (unique identifier) */
  ts: string;
  /** Message text content */
  text?: string;
  /** User ID who posted the message */
  user?: string;
  /** Permalink to the message */
  permalink?: string;
}

/**
 * File data within a starred item
 */
export interface StarredFileData {
  /** File ID */
  id: string;
  /** File name */
  name?: string;
  /** File title */
  title?: string;
  /** File MIME type */
  mimetype?: string;
  /** File type (e.g., 'pdf', 'png') */
  filetype?: string;
  /** User ID who uploaded the file */
  user?: string;
  /** URL to download the file */
  url_private?: string;
  /** Permalink to the file */
  permalink?: string;
  /** File size in bytes */
  size?: number;
  /** Timestamp when file was created */
  created?: number;
}

/**
 * Channel data within a starred item
 */
export interface StarredChannelData {
  /** Channel ID */
  id: string;
  /** Channel name */
  name?: string;
  /** Whether the channel is private */
  is_private?: boolean;
  /** Whether the channel is archived */
  is_archived?: boolean;
  /** Channel creator user ID */
  creator?: string;
  /** Number of members in the channel */
  num_members?: number;
}

/**
 * Union type for starred item data
 */
export type StarredItemData = StarredMessageData | StarredFileData | StarredChannelData;

/**
 * Starred item structure
 */
export interface StarredItem {
  /** Type of starred item */
  type: StarredItemType;
  /** Item data (message, file, or channel) */
  item: StarredItemData;
  /** Unix timestamp when the item was starred */
  dateCreated: number;
}

/**
 * Options for listing starred items
 */
export interface ListOptions {
  /** Number of items to return per page (default: 100, max: 1000) */
  count?: number;
  /** Page number for pagination (starts at 1) */
  page?: number;
  /** Cursor for pagination (for cursor-based pagination) */
  cursor?: string;
}

/**
 * Response structure for listing starred items
 */
export interface ListStarredResponse {
  /** Array of starred items */
  items: StarredItem[];
  /** Pagination metadata */
  paging?: {
    /** Total count of starred items */
    count: number;
    /** Total number of items */
    total: number;
    /** Current page number */
    page: number;
    /** Total number of pages */
    pages: number;
  };
  /** Response metadata for cursor-based pagination */
  response_metadata?: {
    /** Next cursor for pagination */
    next_cursor?: string;
  };
}

// =============================================================================
// Slack API Response Types
// =============================================================================

interface SlackStarsAddResponse {
  ok: boolean;
  error?: string;
}

interface SlackStarsRemoveResponse {
  ok: boolean;
  error?: string;
}

interface SlackStarsListResponse {
  ok: boolean;
  error?: string;
  items?: Array<{
    type: string;
    channel?: string;
    message?: {
      ts: string;
      text?: string;
      user?: string;
      permalink?: string;
    };
    file?: {
      id: string;
      name?: string;
      title?: string;
      mimetype?: string;
      filetype?: string;
      user?: string;
      url_private?: string;
      permalink?: string;
      size?: number;
      created?: number;
    };
    // Channel type items have different structure
    date_create?: number;
  }>;
  paging?: {
    count: number;
    total: number;
    page: number;
    pages: number;
  };
  response_metadata?: {
    next_cursor?: string;
  };
}

interface SlackConversationsInfoResponse {
  ok: boolean;
  error?: string;
  channel?: {
    id: string;
    name?: string;
    is_private?: boolean;
    is_archived?: boolean;
    creator?: string;
    num_members?: number;
  };
}

// =============================================================================
// Slack Client Interface
// =============================================================================

interface SlackStarsClient {
  stars: {
    add: (params: {
      channel?: string;
      timestamp?: string;
      file?: string;
    }) => Promise<SlackStarsAddResponse>;
    remove: (params: {
      channel?: string;
      timestamp?: string;
      file?: string;
    }) => Promise<SlackStarsRemoveResponse>;
    list: (params?: {
      count?: number;
      page?: number;
      cursor?: string;
    }) => Promise<SlackStarsListResponse>;
  };
  conversations: {
    info: (params: { channel: string }) => Promise<SlackConversationsInfoResponse>;
  };
}

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * Mock client for when @slack/web-api is unavailable
 */
class MockStarsClient implements SlackStarsClient {
  stars = {
    add: async (_params: {
      channel?: string;
      timestamp?: string;
      file?: string;
    }): Promise<SlackStarsAddResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    remove: async (_params: {
      channel?: string;
      timestamp?: string;
      file?: string;
    }): Promise<SlackStarsRemoveResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    list: async (_params?: {
      count?: number;
      page?: number;
      cursor?: string;
    }): Promise<SlackStarsListResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
  };

  conversations = {
    info: async (_params: { channel: string }): Promise<SlackConversationsInfoResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
  };
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Slack WebClient instance
 *
 * @param token - Slack user token (xoxp-...)
 * @returns Configured client instance
 */
async function createSlackClient(token: string): Promise<SlackStarsClient> {
  try {
    const slack = await import('@slack/web-api');
    return new slack.WebClient(token) as unknown as SlackStarsClient;
  } catch {
    // Slack SDK not available, use mock
    return new MockStarsClient();
  }
}

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when starred items operations fail
 */
export class StarredItemsError extends Error {
  /** Slack API error code */
  public readonly code: string;
  /** Original error details */
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'StarredItemsError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, StarredItemsError.prototype);
  }
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for StarredItemsManager
 */
export interface StarredItemsConfig {
  /** Slack user token (xoxp-...) */
  token: string;
  /** Optional: Pre-configured WebClient instance */
  client?: SlackStarsClient;
  /** Optional: Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// StarredItemsManager Class
// =============================================================================

/**
 * Manages starred items in Slack for Orchestrator agents.
 *
 * This class provides comprehensive starred items management including:
 * - Starring messages for quick reference
 * - Starring files for easy access
 * - Starring channels to bookmark important channels
 * - Unstarring any type of item
 * - Listing all starred items with pagination
 * - Checking if an item is starred
 *
 * @example
 * ```typescript
 * import { StarredItemsManager } from '@wundr/slack-agent/capabilities/starred-items';
 *
 * const manager = new StarredItemsManager({
 *   token: process.env.SLACK_USER_TOKEN!, // xoxp-...
 * });
 *
 * // Star an important message
 * await manager.starMessage('C123ABC456', '1234567890.123456');
 *
 * // Star a file for later reference
 * await manager.starFile('F123ABC456');
 *
 * // Star a channel to keep it handy
 * await manager.starChannel('C789DEF012');
 *
 * // List all starred items
 * const items = await manager.listStarredItems({ count: 50 });
 * ```
 */
export class StarredItemsManager {
  private client: SlackStarsClient | null = null;
  private readonly config: StarredItemsConfig;
  private initPromise: Promise<void>;

  /**
   * Creates a new StarredItemsManager instance
   *
   * @param config - Configuration options
   */
  constructor(config: StarredItemsConfig) {
    this.config = config;
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the Slack client
   */
  private async initialize(): Promise<void> {
    if (this.config.client) {
      this.client = this.config.client;
    } else {
      this.client = await createSlackClient(this.config.token);
    }
  }

  /**
   * Get the initialized client
   */
  private async getClient(): Promise<SlackStarsClient> {
    await this.initPromise;
    if (!this.client) {
      throw new StarredItemsError('Slack client not initialized', 'client_not_initialized');
    }
    return this.client;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[StarredItemsManager] ${message}`, ...args);
    }
  }

  /**
   * Handle API response errors
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof StarredItemsError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      (error as { code?: string })?.code ||
      (error as { data?: { error?: string } })?.data?.error ||
      'unknown_error';

    throw new StarredItemsError(`Failed to ${operation}: ${errorMessage}`, errorCode, error);
  }

  // ===========================================================================
  // Star Methods
  // ===========================================================================

  /**
   * Star a message
   *
   * Saves a message to starred items for quick reference.
   *
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp (e.g., "1234567890.123456")
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.starMessage('C123ABC456', '1234567890.123456');
   * ```
   */
  async starMessage(channel: string, timestamp: string): Promise<void> {
    try {
      this.debug('Starring message', { channel, timestamp });
      const client = await this.getClient();

      const response = await client.stars.add({
        channel,
        timestamp,
      });

      if (!response.ok) {
        // Handle already_starred gracefully
        if (response.error === 'already_starred') {
          this.debug('Message already starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to star message: ${response.error}`,
          response.error || 'star_message_failed',
        );
      }

      this.debug('Message starred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'already_starred') {
        return;
      }
      this.handleError(error, 'star message');
    }
  }

  /**
   * Star a file
   *
   * Saves a file to starred items for easy access.
   *
   * @param fileId - File ID (e.g., "F123ABC456")
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.starFile('F123ABC456');
   * ```
   */
  async starFile(fileId: string): Promise<void> {
    try {
      this.debug('Starring file', { fileId });
      const client = await this.getClient();

      const response = await client.stars.add({
        file: fileId,
      });

      if (!response.ok) {
        // Handle already_starred gracefully
        if (response.error === 'already_starred') {
          this.debug('File already starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to star file: ${response.error}`,
          response.error || 'star_file_failed',
        );
      }

      this.debug('File starred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'already_starred') {
        return;
      }
      this.handleError(error, 'star file');
    }
  }

  /**
   * Star a channel
   *
   * Saves a channel to starred items for quick access.
   * Note: Starring a channel is done by starring a special reference to it.
   *
   * @param channelId - Channel ID (e.g., "C123ABC456")
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.starChannel('C123ABC456');
   * ```
   */
  async starChannel(channelId: string): Promise<void> {
    try {
      this.debug('Starring channel', { channelId });
      const client = await this.getClient();

      const response = await client.stars.add({
        channel: channelId,
      });

      if (!response.ok) {
        // Handle already_starred gracefully
        if (response.error === 'already_starred') {
          this.debug('Channel already starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to star channel: ${response.error}`,
          response.error || 'star_channel_failed',
        );
      }

      this.debug('Channel starred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'already_starred') {
        return;
      }
      this.handleError(error, 'star channel');
    }
  }

  // ===========================================================================
  // Unstar Methods
  // ===========================================================================

  /**
   * Unstar a message
   *
   * Removes a message from starred items.
   *
   * @param channel - Channel ID containing the message
   * @param timestamp - Message timestamp
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.unstarMessage('C123ABC456', '1234567890.123456');
   * ```
   */
  async unstarMessage(channel: string, timestamp: string): Promise<void> {
    try {
      this.debug('Unstarring message', { channel, timestamp });
      const client = await this.getClient();

      const response = await client.stars.remove({
        channel,
        timestamp,
      });

      if (!response.ok) {
        // Handle not_starred gracefully
        if (response.error === 'not_starred') {
          this.debug('Message was not starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to unstar message: ${response.error}`,
          response.error || 'unstar_message_failed',
        );
      }

      this.debug('Message unstarred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'not_starred') {
        return;
      }
      this.handleError(error, 'unstar message');
    }
  }

  /**
   * Unstar a file
   *
   * Removes a file from starred items.
   *
   * @param fileId - File ID
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.unstarFile('F123ABC456');
   * ```
   */
  async unstarFile(fileId: string): Promise<void> {
    try {
      this.debug('Unstarring file', { fileId });
      const client = await this.getClient();

      const response = await client.stars.remove({
        file: fileId,
      });

      if (!response.ok) {
        // Handle not_starred gracefully
        if (response.error === 'not_starred') {
          this.debug('File was not starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to unstar file: ${response.error}`,
          response.error || 'unstar_file_failed',
        );
      }

      this.debug('File unstarred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'not_starred') {
        return;
      }
      this.handleError(error, 'unstar file');
    }
  }

  /**
   * Unstar a channel
   *
   * Removes a channel from starred items.
   *
   * @param channelId - Channel ID
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * await manager.unstarChannel('C123ABC456');
   * ```
   */
  async unstarChannel(channelId: string): Promise<void> {
    try {
      this.debug('Unstarring channel', { channelId });
      const client = await this.getClient();

      const response = await client.stars.remove({
        channel: channelId,
      });

      if (!response.ok) {
        // Handle not_starred gracefully
        if (response.error === 'not_starred') {
          this.debug('Channel was not starred');
          return;
        }
        throw new StarredItemsError(
          `Failed to unstar channel: ${response.error}`,
          response.error || 'unstar_channel_failed',
        );
      }

      this.debug('Channel unstarred successfully');
    } catch (error) {
      if (error instanceof StarredItemsError && error.code === 'not_starred') {
        return;
      }
      this.handleError(error, 'unstar channel');
    }
  }

  // ===========================================================================
  // List Methods
  // ===========================================================================

  /**
   * List all starred items
   *
   * Retrieves all starred items for the authenticated user with pagination support.
   *
   * @param options - Pagination options
   * @returns Array of starred items
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * // Get first page of starred items
   * const items = await manager.listStarredItems({ count: 50 });
   *
   * // Get specific page
   * const page2 = await manager.listStarredItems({ count: 50, page: 2 });
   *
   * // Use cursor-based pagination
   * const result = await manager.listStarredItems({ cursor: 'dXNlcjpVMDYxTkZUVDI=' });
   * ```
   */
  async listStarredItems(options?: ListOptions): Promise<StarredItem[]> {
    try {
      this.debug('Listing starred items', options);
      const client = await this.getClient();

      const response = await client.stars.list({
        count: options?.count,
        page: options?.page,
        cursor: options?.cursor,
      });

      if (!response.ok) {
        throw new StarredItemsError(
          `Failed to list starred items: ${response.error}`,
          response.error || 'list_starred_items_failed',
        );
      }

      const items: StarredItem[] = [];

      if (response.items) {
        for (const item of response.items) {
          const starredItem = this.parseStarredItem(item);
          if (starredItem) {
            items.push(starredItem);
          }
        }
      }

      this.debug('Found starred items', items.length);
      return items;
    } catch (error) {
      this.handleError(error, 'list starred items');
    }
  }

  /**
   * Parse a raw starred item from the API into our typed format
   */
  private parseStarredItem(
    item: NonNullable<SlackStarsListResponse['items']>[number],
  ): StarredItem | null {
    const dateCreated = item.date_create || Math.floor(Date.now() / 1000);

    // Message type
    if (item.type === 'message' && item.message && item.channel) {
      return {
        type: 'message',
        item: {
          channel: item.channel,
          ts: item.message.ts,
          text: item.message.text,
          user: item.message.user,
          permalink: item.message.permalink,
        } as StarredMessageData,
        dateCreated,
      };
    }

    // File type
    if (item.type === 'file' && item.file) {
      return {
        type: 'file',
        item: {
          id: item.file.id,
          name: item.file.name,
          title: item.file.title,
          mimetype: item.file.mimetype,
          filetype: item.file.filetype,
          user: item.file.user,
          url_private: item.file.url_private,
          permalink: item.file.permalink,
          size: item.file.size,
          created: item.file.created,
        } as StarredFileData,
        dateCreated,
      };
    }

    // Channel type
    if (item.type === 'channel' && item.channel) {
      return {
        type: 'channel',
        item: {
          id: item.channel,
        } as StarredChannelData,
        dateCreated,
      };
    }

    // Unknown type
    this.debug('Unknown starred item type', item.type);
    return null;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Check if an item is starred
   *
   * Searches through starred items to determine if a specific item is starred.
   *
   * @param itemType - Type of item to check ('message', 'file', or 'channel')
   * @param id - Primary identifier (channel ID, file ID, or channel ID)
   * @param secondaryId - Secondary identifier (message timestamp for messages)
   * @returns True if the item is starred
   * @throws StarredItemsError if the operation fails
   *
   * @example
   * ```typescript
   * // Check if a message is starred
   * const isMessageStarred = await manager.isStarred('message', 'C123ABC456', '1234567890.123456');
   *
   * // Check if a file is starred
   * const isFileStarred = await manager.isStarred('file', 'F123ABC456');
   *
   * // Check if a channel is starred
   * const isChannelStarred = await manager.isStarred('channel', 'C789DEF012');
   * ```
   */
  async isStarred(
    itemType: StarredItemType,
    id: string,
    secondaryId?: string,
  ): Promise<boolean> {
    try {
      this.debug('Checking if item is starred', { itemType, id, secondaryId });

      // Fetch all starred items (paginated search)
      let cursor: string | undefined;
      let found = false;

      do {
        const client = await this.getClient();
        const response = await client.stars.list({
          count: 100,
          cursor,
        });

        if (!response.ok) {
          throw new StarredItemsError(
            `Failed to check starred status: ${response.error}`,
            response.error || 'check_starred_failed',
          );
        }

        if (response.items) {
          for (const item of response.items) {
            if (this.matchesStarredItem(item, itemType, id, secondaryId)) {
              found = true;
              break;
            }
          }
        }

        if (found) {
          break;
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      this.debug('Item starred status', found);
      return found;
    } catch (error) {
      this.handleError(error, 'check starred status');
    }
  }

  /**
   * Check if a raw starred item matches the given parameters
   */
  private matchesStarredItem(
    item: NonNullable<SlackStarsListResponse['items']>[number],
    itemType: StarredItemType,
    id: string,
    secondaryId?: string,
  ): boolean {
    switch (itemType) {
      case 'message':
        return (
          item.type === 'message' &&
          item.channel === id &&
          item.message?.ts === secondaryId
        );

      case 'file':
        return item.type === 'file' && item.file?.id === id;

      case 'channel':
        return item.type === 'channel' && item.channel === id;

      default:
        return false;
    }
  }

  /**
   * Toggle star status on a message
   *
   * Stars the message if not starred, unstars if already starred.
   *
   * @param channel - Channel ID
   * @param timestamp - Message timestamp
   * @returns True if message was starred, false if unstarred
   *
   * @example
   * ```typescript
   * const isNowStarred = await manager.toggleMessageStar('C123ABC456', '1234567890.123456');
   * console.log(isNowStarred ? 'Message starred' : 'Message unstarred');
   * ```
   */
  async toggleMessageStar(channel: string, timestamp: string): Promise<boolean> {
    const isCurrentlyStarred = await this.isStarred('message', channel, timestamp);

    if (isCurrentlyStarred) {
      await this.unstarMessage(channel, timestamp);
      return false;
    } else {
      await this.starMessage(channel, timestamp);
      return true;
    }
  }

  /**
   * Toggle star status on a file
   *
   * Stars the file if not starred, unstars if already starred.
   *
   * @param fileId - File ID
   * @returns True if file was starred, false if unstarred
   *
   * @example
   * ```typescript
   * const isNowStarred = await manager.toggleFileStar('F123ABC456');
   * ```
   */
  async toggleFileStar(fileId: string): Promise<boolean> {
    const isCurrentlyStarred = await this.isStarred('file', fileId);

    if (isCurrentlyStarred) {
      await this.unstarFile(fileId);
      return false;
    } else {
      await this.starFile(fileId);
      return true;
    }
  }

  /**
   * Toggle star status on a channel
   *
   * Stars the channel if not starred, unstars if already starred.
   *
   * @param channelId - Channel ID
   * @returns True if channel was starred, false if unstarred
   *
   * @example
   * ```typescript
   * const isNowStarred = await manager.toggleChannelStar('C789DEF012');
   * ```
   */
  async toggleChannelStar(channelId: string): Promise<boolean> {
    const isCurrentlyStarred = await this.isStarred('channel', channelId);

    if (isCurrentlyStarred) {
      await this.unstarChannel(channelId);
      return false;
    } else {
      await this.starChannel(channelId);
      return true;
    }
  }

  /**
   * Get starred items of a specific type
   *
   * Filters starred items by type for convenience.
   *
   * @param itemType - Type of items to retrieve
   * @param options - Pagination options
   * @returns Array of starred items of the specified type
   *
   * @example
   * ```typescript
   * // Get only starred messages
   * const messages = await manager.getStarredByType('message');
   *
   * // Get only starred files
   * const files = await manager.getStarredByType('file');
   *
   * // Get only starred channels
   * const channels = await manager.getStarredByType('channel');
   * ```
   */
  async getStarredByType(
    itemType: StarredItemType,
    options?: ListOptions,
  ): Promise<StarredItem[]> {
    const allItems = await this.listStarredItems(options);
    return allItems.filter((item) => item.type === itemType);
  }

  /**
   * Get the count of starred items
   *
   * @returns Total number of starred items
   *
   * @example
   * ```typescript
   * const count = await manager.getStarredCount();
   * console.log(`You have ${count} starred items`);
   * ```
   */
  async getStarredCount(): Promise<number> {
    try {
      const client = await this.getClient();

      const response = await client.stars.list({
        count: 1, // Minimal fetch just to get total
      });

      if (!response.ok) {
        throw new StarredItemsError(
          `Failed to get starred count: ${response.error}`,
          response.error || 'get_count_failed',
        );
      }

      return response.paging?.total || 0;
    } catch (error) {
      this.handleError(error, 'get starred count');
    }
  }

  /**
   * Unstar all items of a specific type
   *
   * Bulk operation to remove all starred items of a certain type.
   *
   * @param itemType - Type of items to unstar
   * @throws StarredItemsError if any unstar operation fails
   *
   * @example
   * ```typescript
   * // Clear all starred messages
   * await manager.clearStarredByType('message');
   * ```
   */
  async clearStarredByType(itemType: StarredItemType): Promise<void> {
    const items = await this.getStarredByType(itemType);
    const errors: string[] = [];

    for (const item of items) {
      try {
        switch (itemType) {
          case 'message': {
            const msgData = item.item as StarredMessageData;
            await this.unstarMessage(msgData.channel, msgData.ts);
            break;
          }
          case 'file': {
            const fileData = item.item as StarredFileData;
            await this.unstarFile(fileData.id);
            break;
          }
          case 'channel': {
            const channelData = item.item as StarredChannelData;
            await this.unstarChannel(channelData.id);
            break;
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push(error.message);
        }
      }
    }

    if (errors.length > 0) {
      throw new StarredItemsError(
        `Some unstar operations failed:\n${errors.join('\n')}`,
        'partial_clear_failure',
      );
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a StarredItemsManager instance
 *
 * @param config - Configuration options or just a token string
 * @returns Configured StarredItemsManager instance
 *
 * @example
 * ```typescript
 * // With token only
 * const manager = createStarredItemsManager(process.env.SLACK_USER_TOKEN!);
 *
 * // With full config
 * const manager = createStarredItemsManager({
 *   token: process.env.SLACK_USER_TOKEN!,
 *   debug: true,
 * });
 * ```
 */
export function createStarredItemsManager(
  config: StarredItemsConfig | string,
): StarredItemsManager {
  if (typeof config === 'string') {
    return new StarredItemsManager({ token: config });
  }
  return new StarredItemsManager(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default StarredItemsManager;
