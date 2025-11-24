/**
 * @wundr.io/slack-agent - Channel Bookmarks Capability
 *
 * Provides comprehensive Slack channel bookmark management capabilities for the VP agent.
 * The VP agent operates as a full user in Slack workspaces, enabling it to
 * create, edit, remove, and list channel bookmarks (the links at the top of channels).
 *
 * @packageDocumentation
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Bookmark type - currently only 'link' is supported by Slack API
 */
export type BookmarkType = 'link';

/**
 * Options for adding a bookmark to a channel
 */
export interface AddBookmarkOptions {
  /** Display title for the bookmark */
  title: string;
  /** Type of bookmark (currently only 'link' is supported) */
  type: BookmarkType;
  /** URL for link bookmarks */
  link: string;
  /** Emoji to display with the bookmark (e.g., ':memo:' or 'memo') */
  emoji?: string;
  /** Entity ID for entity-type bookmarks (reserved for future use) */
  entityId?: string;
  /** Parent folder ID if bookmark should be in a folder */
  parentId?: string;
}

/**
 * Options for updating an existing bookmark
 */
export interface BookmarkUpdate {
  /** New display title */
  title?: string;
  /** New URL */
  link?: string;
  /** New emoji (e.g., ':memo:' or 'memo') */
  emoji?: string;
}

/**
 * Slack channel bookmark representation
 */
export interface Bookmark {
  /** Unique bookmark identifier */
  readonly id: string;
  /** Channel ID where the bookmark exists */
  readonly channelId: string;
  /** Display title */
  readonly title: string;
  /** Bookmark URL */
  readonly link: string;
  /** Emoji displayed with the bookmark */
  readonly emoji?: string;
  /** Type of bookmark */
  readonly type: BookmarkType;
  /** Creation timestamp (Unix epoch seconds) */
  readonly dateCreated: number;
  /** Last update timestamp (Unix epoch seconds) */
  readonly dateUpdated: number;
  /** Sort order rank */
  readonly rank: string;
  /** Icon URL if provided */
  readonly iconUrl?: string;
  /** App ID if bookmark was created by an app */
  readonly appId?: string;
  /** User ID who created the bookmark */
  readonly createdBy?: string;
  /** User ID who last updated the bookmark */
  readonly updatedBy?: string;
  /** Shortcut link (deep link) */
  readonly shortcut?: string;
}

/**
 * Bookmark management error codes
 */
export enum BookmarkErrorCode {
  /** Bookmark not found */
  NOT_FOUND = 'bookmark_not_found',
  /** Channel not found */
  CHANNEL_NOT_FOUND = 'channel_not_found',
  /** Invalid bookmark URL */
  INVALID_URL = 'invalid_url',
  /** Invalid bookmark title */
  INVALID_TITLE = 'invalid_title',
  /** Insufficient permissions */
  PERMISSION_DENIED = 'not_allowed',
  /** Rate limited */
  RATE_LIMITED = 'ratelimited',
  /** Bookmark limit reached */
  LIMIT_REACHED = 'bookmark_limit_reached',
  /** General error */
  UNKNOWN = 'unknown_error',
}

/**
 * Bookmark management error
 */
export class BookmarkManagementError extends Error {
  /** Error code from Slack API or internal */
  readonly code: BookmarkErrorCode | string;
  /** Original Slack API error (if available) */
  readonly slackError?: string;
  /** Channel ID related to the error (if available) */
  readonly channelId?: string;
  /** Bookmark ID related to the error (if available) */
  readonly bookmarkId?: string;

  constructor(
    message: string,
    code: BookmarkErrorCode | string,
    options?: { slackError?: string; channelId?: string; bookmarkId?: string },
  ) {
    super(message);
    this.name = 'BookmarkManagementError';
    this.code = code;
    this.slackError = options?.slackError;
    this.channelId = options?.channelId;
    this.bookmarkId = options?.bookmarkId;
  }
}

/**
 * Configuration for BookmarkManager
 */
export interface BookmarkManagerConfig {
  /** Maximum retries on rate limit */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

// =============================================================================
// Bookmark Manager Implementation
// =============================================================================

/**
 * BookmarkManager - Manages Slack channel bookmarks for the VP agent
 *
 * Provides methods to add, edit, remove, and list channel bookmarks.
 * Handles permission errors gracefully and provides clear error messages.
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { BookmarkManager } from '@wundr.io/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const bookmarkManager = new BookmarkManager(client);
 *
 * // Add a link bookmark
 * const bookmark = await bookmarkManager.addLinkBookmark(
 *   'C12345',
 *   'Project Docs',
 *   'https://docs.example.com',
 *   ':memo:',
 * );
 *
 * // List all bookmarks in a channel
 * const bookmarks = await bookmarkManager.listBookmarks('C12345');
 * ```
 */
export class BookmarkManager {
  private readonly client: WebClient;
  private readonly config: Required<BookmarkManagerConfig>;

  /**
   * Creates a new BookmarkManager instance
   *
   * @param client - Authenticated Slack WebClient instance
   * @param config - Optional configuration
   */
  constructor(client: WebClient, config: BookmarkManagerConfig = {}) {
    this.client = client;
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };
  }

  // ===========================================================================
  // Bookmark Creation
  // ===========================================================================

  /**
   * Add a bookmark to a channel
   *
   * @param channelId - Channel ID to add bookmark to
   * @param options - Bookmark creation options
   * @returns Created bookmark
   * @throws BookmarkManagementError if creation fails
   *
   * @example
   * ```typescript
   * const bookmark = await bookmarkManager.addBookmark('C12345', {
   *   title: 'Team Wiki',
   *   type: 'link',
   *   link: 'https://wiki.example.com',
   *   emoji: ':books:',
   * });
   * ```
   */
  async addBookmark(
    channelId: string,
    options: AddBookmarkOptions,
  ): Promise<Bookmark> {
    this.validateBookmarkOptions(options);

    try {
      const response = await this.withRetry(() =>
        // Using type assertion as the bookmarks API may not be fully typed in @slack/web-api
        (
          (this.client as unknown as SlackClientWithBookmarks).bookmarks?.add?.({
            channel_id: channelId,
            title: options.title,
            type: options.type,
            link: options.link,
            emoji: options.emoji ? this.normalizeEmoji(options.emoji) : undefined,
            entity_id: options.entityId,
            parent_id: options.parentId,
          }) as Promise<SlackBookmarkResponse>
        ),
      );

      if (!response?.ok || !response?.bookmark) {
        throw new BookmarkManagementError(
          `Failed to add bookmark: ${response?.error || 'Unknown error'}`,
          response?.error || BookmarkErrorCode.UNKNOWN,
          { slackError: response?.error, channelId },
        );
      }

      return this.mapSlackBookmark(channelId, response.bookmark);
    } catch (error) {
      if (error instanceof BookmarkManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'add bookmark', channelId);
    }
  }

  /**
   * Add a link bookmark to a channel (convenience method)
   *
   * @param channelId - Channel ID to add bookmark to
   * @param title - Display title for the bookmark
   * @param link - URL for the bookmark
   * @param emoji - Optional emoji to display (e.g., ':link:' or 'link')
   * @returns Created bookmark
   * @throws BookmarkManagementError if creation fails
   *
   * @example
   * ```typescript
   * const bookmark = await bookmarkManager.addLinkBookmark(
   *   'C12345',
   *   'Meeting Notes',
   *   'https://docs.google.com/document/d/xxx',
   *   ':notebook:',
   * );
   * ```
   */
  async addLinkBookmark(
    channelId: string,
    title: string,
    link: string,
    emoji?: string,
  ): Promise<Bookmark> {
    return this.addBookmark(channelId, {
      title,
      type: 'link',
      link,
      emoji,
    });
  }

  // ===========================================================================
  // Bookmark Update
  // ===========================================================================

  /**
   * Edit an existing bookmark
   *
   * @param channelId - Channel ID containing the bookmark
   * @param bookmarkId - Bookmark ID to edit
   * @param updates - Fields to update
   * @returns Updated bookmark
   * @throws BookmarkManagementError if update fails
   *
   * @example
   * ```typescript
   * const updated = await bookmarkManager.editBookmark('C12345', 'Bk12345', {
   *   title: 'Updated Title',
   *   emoji: ':star:',
   * });
   * ```
   */
  async editBookmark(
    channelId: string,
    bookmarkId: string,
    updates: BookmarkUpdate,
  ): Promise<Bookmark> {
    if (!bookmarkId) {
      throw new BookmarkManagementError(
        'Bookmark ID is required',
        BookmarkErrorCode.NOT_FOUND,
        { channelId },
      );
    }

    // Validate title if provided
    if (updates.title !== undefined && updates.title.trim().length === 0) {
      throw new BookmarkManagementError(
        'Bookmark title cannot be empty',
        BookmarkErrorCode.INVALID_TITLE,
        { channelId, bookmarkId },
      );
    }

    // Validate link if provided
    if (updates.link !== undefined) {
      this.validateUrl(updates.link);
    }

    try {
      const response = await this.withRetry(() =>
        (
          (this.client as unknown as SlackClientWithBookmarks).bookmarks?.edit?.({
            channel_id: channelId,
            bookmark_id: bookmarkId,
            title: updates.title,
            link: updates.link,
            emoji: updates.emoji ? this.normalizeEmoji(updates.emoji) : undefined,
          }) as Promise<SlackBookmarkResponse>
        ),
      );

      if (!response?.ok || !response?.bookmark) {
        throw new BookmarkManagementError(
          `Failed to edit bookmark: ${response?.error || 'Unknown error'}`,
          response?.error || BookmarkErrorCode.UNKNOWN,
          { slackError: response?.error, channelId, bookmarkId },
        );
      }

      return this.mapSlackBookmark(channelId, response.bookmark);
    } catch (error) {
      if (error instanceof BookmarkManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'edit bookmark', channelId, bookmarkId);
    }
  }

  // ===========================================================================
  // Bookmark Deletion
  // ===========================================================================

  /**
   * Remove a bookmark from a channel
   *
   * @param channelId - Channel ID containing the bookmark
   * @param bookmarkId - Bookmark ID to remove
   * @throws BookmarkManagementError if removal fails
   *
   * @example
   * ```typescript
   * await bookmarkManager.removeBookmark('C12345', 'Bk12345');
   * ```
   */
  async removeBookmark(channelId: string, bookmarkId: string): Promise<void> {
    if (!bookmarkId) {
      throw new BookmarkManagementError(
        'Bookmark ID is required',
        BookmarkErrorCode.NOT_FOUND,
        { channelId },
      );
    }

    try {
      const response = await this.withRetry(() =>
        (
          (this.client as unknown as SlackClientWithBookmarks).bookmarks?.remove?.({
            channel_id: channelId,
            bookmark_id: bookmarkId,
          }) as Promise<SlackBookmarkDeleteResponse>
        ),
      );

      if (!response?.ok) {
        throw new BookmarkManagementError(
          `Failed to remove bookmark: ${response?.error || 'Unknown error'}`,
          response?.error || BookmarkErrorCode.UNKNOWN,
          { slackError: response?.error, channelId, bookmarkId },
        );
      }
    } catch (error) {
      if (error instanceof BookmarkManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'remove bookmark', channelId, bookmarkId);
    }
  }

  // ===========================================================================
  // Bookmark Queries
  // ===========================================================================

  /**
   * List all bookmarks in a channel
   *
   * @param channelId - Channel ID to list bookmarks for
   * @returns Array of bookmarks in the channel
   * @throws BookmarkManagementError if listing fails
   *
   * @example
   * ```typescript
   * const bookmarks = await bookmarkManager.listBookmarks('C12345');
   * for (const bookmark of bookmarks) {
   *   console.log(`${bookmark.emoji || ''} ${bookmark.title}: ${bookmark.link}`);
   * }
   * ```
   */
  async listBookmarks(channelId: string): Promise<Bookmark[]> {
    try {
      const response = await this.withRetry(() =>
        (
          (this.client as unknown as SlackClientWithBookmarks).bookmarks?.list?.({
            channel_id: channelId,
          }) as Promise<SlackBookmarkListResponse>
        ),
      );

      if (!response?.ok) {
        throw new BookmarkManagementError(
          `Failed to list bookmarks: ${response?.error || 'Unknown error'}`,
          response?.error || BookmarkErrorCode.UNKNOWN,
          { slackError: response?.error, channelId },
        );
      }

      return (response.bookmarks || []).map((bookmark) =>
        this.mapSlackBookmark(channelId, bookmark),
      );
    } catch (error) {
      if (error instanceof BookmarkManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'list bookmarks', channelId);
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Validate bookmark creation options
   */
  private validateBookmarkOptions(options: AddBookmarkOptions): void {
    if (!options.title || options.title.trim().length === 0) {
      throw new BookmarkManagementError(
        'Bookmark title is required',
        BookmarkErrorCode.INVALID_TITLE,
      );
    }

    if (options.type !== 'link') {
      throw new BookmarkManagementError(
        `Invalid bookmark type: ${options.type}. Only 'link' is currently supported.`,
        BookmarkErrorCode.UNKNOWN,
      );
    }

    this.validateUrl(options.link);
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    if (!url || url.trim().length === 0) {
      throw new BookmarkManagementError(
        'Bookmark link URL is required',
        BookmarkErrorCode.INVALID_URL,
      );
    }

    try {
      new URL(url);
    } catch {
      throw new BookmarkManagementError(
        `Invalid URL format: ${url}`,
        BookmarkErrorCode.INVALID_URL,
      );
    }
  }

  /**
   * Normalize emoji input by removing colons if present
   * @param emoji - Emoji name with or without colons (e.g., ':memo:' or 'memo')
   * @returns Normalized emoji name without colons
   */
  private normalizeEmoji(emoji: string): string {
    return emoji.replace(/^:/, '').replace(/:$/, '');
  }

  /**
   * Map Slack API bookmark response to Bookmark type
   */
  private mapSlackBookmark(
    channelId: string,
    slackBookmark: SlackBookmark,
  ): Bookmark {
    return {
      id: slackBookmark.id,
      channelId,
      title: slackBookmark.title,
      link: slackBookmark.link || '',
      emoji: slackBookmark.emoji,
      type: (slackBookmark.type as BookmarkType) || 'link',
      dateCreated: slackBookmark.date_created || 0,
      dateUpdated: slackBookmark.date_updated || 0,
      rank: slackBookmark.rank || '0',
      iconUrl: slackBookmark.icon_url,
      appId: slackBookmark.app_id,
      createdBy: slackBookmark.created_by,
      updatedBy: slackBookmark.last_updated_by_user_id,
      shortcut: slackBookmark.shortcut,
    };
  }

  /**
   * Handle Slack API errors
   */
  private handleSlackError(
    error: unknown,
    operation: string,
    channelId?: string,
    bookmarkId?: string,
  ): BookmarkManagementError {
    const slackError =
      error instanceof Error
        ? (error as { data?: { error?: string } }).data?.error || error.message
        : 'Unknown error';

    // Map common Slack errors to our error codes
    let code: BookmarkErrorCode | string = BookmarkErrorCode.UNKNOWN;

    if (typeof slackError === 'string') {
      switch (slackError) {
        case 'bookmark_not_found':
          code = BookmarkErrorCode.NOT_FOUND;
          break;
        case 'channel_not_found':
          code = BookmarkErrorCode.CHANNEL_NOT_FOUND;
          break;
        case 'invalid_link':
        case 'invalid_url':
          code = BookmarkErrorCode.INVALID_URL;
          break;
        case 'invalid_title':
          code = BookmarkErrorCode.INVALID_TITLE;
          break;
        case 'not_allowed':
        case 'not_authorized':
        case 'missing_scope':
          code = BookmarkErrorCode.PERMISSION_DENIED;
          break;
        case 'ratelimited':
          code = BookmarkErrorCode.RATE_LIMITED;
          break;
        case 'bookmark_limit_reached':
          code = BookmarkErrorCode.LIMIT_REACHED;
          break;
        default:
          code = slackError;
      }
    }

    return new BookmarkManagementError(
      `Failed to ${operation}: ${slackError}`,
      code,
      {
        slackError: typeof slackError === 'string' ? slackError : undefined,
        channelId,
        bookmarkId,
      },
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
// Internal Slack API Types
// =============================================================================

/**
 * Extended WebClient interface with bookmarks API methods
 * The bookmarks API may not be fully typed in @slack/web-api
 */
interface SlackClientWithBookmarks {
  bookmarks?: {
    add?: (params: {
      channel_id: string;
      title: string;
      type: string;
      link?: string;
      emoji?: string;
      entity_id?: string;
      parent_id?: string;
    }) => Promise<SlackBookmarkResponse>;
    edit?: (params: {
      channel_id: string;
      bookmark_id: string;
      title?: string;
      link?: string;
      emoji?: string;
    }) => Promise<SlackBookmarkResponse>;
    remove?: (params: {
      channel_id: string;
      bookmark_id: string;
    }) => Promise<SlackBookmarkDeleteResponse>;
    list?: (params: {
      channel_id: string;
    }) => Promise<SlackBookmarkListResponse>;
  };
}

/**
 * Slack bookmark object from API response
 */
interface SlackBookmark {
  id: string;
  channel_id?: string;
  title: string;
  link?: string;
  emoji?: string;
  type?: string;
  date_created?: number;
  date_updated?: number;
  rank?: string;
  icon_url?: string;
  app_id?: string;
  created_by?: string;
  last_updated_by_user_id?: string;
  shortcut?: string;
}

/**
 * Slack bookmarks.add/edit API response
 */
interface SlackBookmarkResponse {
  ok: boolean;
  error?: string;
  bookmark?: SlackBookmark;
}

/**
 * Slack bookmarks.remove API response
 */
interface SlackBookmarkDeleteResponse {
  ok: boolean;
  error?: string;
}

/**
 * Slack bookmarks.list API response
 */
interface SlackBookmarkListResponse {
  ok: boolean;
  error?: string;
  bookmarks?: SlackBookmark[];
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a BookmarkManager instance
 *
 * @param client - Authenticated Slack WebClient
 * @param config - Optional configuration
 * @returns BookmarkManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createBookmarkManager } from '@wundr.io/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const bookmarkManager = createBookmarkManager(client);
 * ```
 */
export function createBookmarkManager(
  client: WebClient,
  config?: BookmarkManagerConfig,
): BookmarkManager {
  return new BookmarkManager(client, config);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is a BookmarkManagementError
 */
export function isBookmarkManagementError(
  error: unknown,
): error is BookmarkManagementError {
  return error instanceof BookmarkManagementError;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  return (
    isBookmarkManagementError(error) &&
    error.code === BookmarkErrorCode.PERMISSION_DENIED
  );
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return (
    isBookmarkManagementError(error) &&
    error.code === BookmarkErrorCode.RATE_LIMITED
  );
}

/**
 * Check if error is a bookmark not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    isBookmarkManagementError(error) &&
    error.code === BookmarkErrorCode.NOT_FOUND
  );
}

/**
 * Check if error is a channel not found error
 */
export function isChannelNotFoundError(error: unknown): boolean {
  return (
    isBookmarkManagementError(error) &&
    error.code === BookmarkErrorCode.CHANNEL_NOT_FOUND
  );
}

/**
 * Check if error is a bookmark limit reached error
 */
export function isLimitReachedError(error: unknown): boolean {
  return (
    isBookmarkManagementError(error) &&
    error.code === BookmarkErrorCode.LIMIT_REACHED
  );
}
