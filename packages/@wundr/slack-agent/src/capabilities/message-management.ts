/**
 * Slack Message Management Capabilities
 *
 * Provides message editing, deletion, pinning, and history management
 * for the Orchestrator (Virtual Principal) agent operating as a full Slack user.
 *
 * @module @wundr/slack-agent/capabilities/message-management
 */

import type {
  Block,
  ChatDeleteResponse,
  ChatGetPermalinkResponse,
  ChatUpdateResponse,
  ConversationsHistoryResponse,
  ConversationsRepliesResponse,
  KnownBlock,
  MessageAttachment,
  MessageMetadata,
  PinsAddResponse,
  PinsListResponse,
  PinsRemoveResponse,
  WebClient,
} from '@slack/web-api';
import type { MessageElement } from '@slack/web-api/dist/types/response/ConversationsHistoryResponse';

// ============================================================================
// Types
// ============================================================================

/**
 * Slack Block type alias for external use
 */
export type SlackBlock = KnownBlock | Block;

/**
 * Options for fetching message history
 */
export interface HistoryOptions {
  /** Maximum number of messages to retrieve (default: 100, max: 1000) */
  readonly limit?: number;
  /** Only messages after this Unix timestamp */
  readonly oldest?: string;
  /** Only messages before this Unix timestamp */
  readonly latest?: string;
  /** Include messages with inclusive=true */
  readonly inclusive?: boolean;
  /** Cursor for pagination */
  readonly cursor?: string;
  /** Include all metadata */
  readonly includeAllMetadata?: boolean;
}

/**
 * Represents a user who authored or modified a message
 */
export interface MessageUser {
  readonly id: string;
  readonly username?: string;
  readonly name?: string;
}

/**
 * Represents a reaction on a message
 */
export interface MessageReaction {
  readonly name: string;
  readonly count: number;
  readonly users: readonly string[];
}

/**
 * Represents a file attached to a message
 */
export interface MessageFile {
  readonly id: string;
  readonly name?: string;
  readonly mimetype?: string;
  readonly url_private?: string;
  readonly permalink?: string;
}

/**
 * Represents a Slack message with full metadata
 */
export interface Message {
  /** Message type (typically 'message') */
  readonly type: string;
  /** The user ID who sent the message */
  readonly user?: string;
  /** The message text content */
  readonly text?: string;
  /** Unix timestamp of the message (used as unique ID) */
  readonly ts: string;
  /** Thread timestamp if this is a threaded reply */
  readonly thread_ts?: string;
  /** Number of replies in thread */
  readonly reply_count?: number;
  /** Users who replied in thread */
  readonly reply_users?: readonly string[];
  /** Number of unique reply users */
  readonly reply_users_count?: number;
  /** Timestamp of latest reply */
  readonly latest_reply?: string;
  /** Message subtype (e.g., 'bot_message', 'channel_join') */
  readonly subtype?: string;
  /** Rich layout blocks */
  readonly blocks?: readonly SlackBlock[];
  /** Legacy attachments */
  readonly attachments?: readonly MessageAttachment[];
  /** Reactions on the message */
  readonly reactions?: readonly MessageReaction[];
  /** Files attached to the message */
  readonly files?: readonly MessageFile[];
  /** Whether the message has been edited */
  readonly edited?: {
    readonly user: string;
    readonly ts: string;
  };
  /** Bot ID if sent by a bot */
  readonly bot_id?: string;
  /** App ID if sent by an app */
  readonly app_id?: string;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;
  /** Whether message is pinned */
  readonly pinned_to?: readonly string[];
}

/**
 * Represents a pinned message with additional context
 */
export interface PinnedMessage {
  /** The message type */
  readonly type: 'message';
  /** The channel where the message is pinned */
  readonly channel: string;
  /** The pinned message content */
  readonly message: Message;
  /** When the message was created */
  readonly created: number;
  /** Who pinned the message */
  readonly created_by: string;
}

/**
 * Options for editing a message
 */
export interface EditMessageOptions {
  /** Update the blocks */
  readonly blocks?: readonly SlackBlock[];
  /** Update attachments */
  readonly attachments?: readonly MessageAttachment[];
  /** Parse mode for the text */
  readonly parse?: 'none' | 'full';
  /** Link names in the message */
  readonly linkNames?: boolean;
  /** Custom metadata to attach */
  readonly metadata?: MessageMetadata;
}

/**
 * Result of a message history query with pagination info
 */
export interface HistoryResult {
  readonly messages: readonly Message[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly responseMetadata?: {
    readonly next_cursor?: string;
  };
}

/**
 * Error thrown when message operations fail
 */
export class SlackMessageError extends Error {
  public readonly code: string;
  public readonly channel?: string;
  public readonly timestamp?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    options?: {
      channel?: string;
      timestamp?: string;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'SlackMessageError';
    this.code = code;
    this.channel = options?.channel;
    this.timestamp = options?.timestamp;
    this.context = options?.context;
    Object.setPrototypeOf(this, SlackMessageError.prototype);
  }
}

// ============================================================================
// Message Management Class
// ============================================================================

/**
 * Manages Slack message operations for the Orchestrator agent.
 *
 * Provides capabilities to edit, delete, pin, and retrieve messages
 * with proper permission handling (can only modify own messages unless admin).
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { MessageManager } from '@wundr/slack-agent/capabilities/message-management';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const manager = new MessageManager(client);
 *
 * // Edit a message
 * await manager.editMessage('C123456', '1234567890.123456', 'Updated text');
 *
 * // Pin an important message
 * await manager.pinMessage('C123456', '1234567890.123456');
 *
 * // Get channel history
 * const messages = await manager.getHistory('C123456', { limit: 50 });
 * ```
 */
export class MessageManager {
  private readonly client: WebClient;
  private readonly botUserId?: string;

  /**
   * Creates a new MessageManager instance.
   *
   * @param client - Initialized Slack WebClient
   * @param botUserId - Optional bot user ID for permission checking
   */
  constructor(client: WebClient, botUserId?: string) {
    this.client = client;
    this.botUserId = botUserId;
  }

  // --------------------------------------------------------------------------
  // Message Editing
  // --------------------------------------------------------------------------

  /**
   * Edit a message's text content.
   *
   * Note: You can only edit messages sent by the authenticated user/bot,
   * unless you have admin permissions.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to edit
   * @param newText - The new text content
   * @throws {SlackMessageError} If the edit fails
   *
   * @example
   * ```typescript
   * await manager.editMessage(
   *   'C123456',
   *   '1234567890.123456',
   *   'This message has been updated'
   * );
   * ```
   */
  async editMessage(
    channel: string,
    timestamp: string,
    newText: string,
  ): Promise<void> {
    await this.performEdit(channel, timestamp, { text: newText });
  }

  /**
   * Edit a message with rich block content.
   *
   * Note: You can only edit messages sent by the authenticated user/bot,
   * unless you have admin permissions.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to edit
   * @param blocks - The new block content
   * @param fallbackText - Optional fallback text for notifications
   * @throws {SlackMessageError} If the edit fails
   *
   * @example
   * ```typescript
   * await manager.editMessageBlocks('C123456', '1234567890.123456', [
   *   {
   *     type: 'section',
   *     text: { type: 'mrkdwn', text: '*Updated content*' }
   *   }
   * ]);
   * ```
   */
  async editMessageBlocks(
    channel: string,
    timestamp: string,
    blocks: readonly SlackBlock[],
    fallbackText?: string,
  ): Promise<void> {
    await this.performEdit(channel, timestamp, {
      blocks: blocks as SlackBlock[],
      text: fallbackText ?? '',
    });
  }

  /**
   * Edit a message with full options.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to edit
   * @param text - The new text content
   * @param options - Additional edit options
   * @throws {SlackMessageError} If the edit fails
   */
  async editMessageWithOptions(
    channel: string,
    timestamp: string,
    text: string,
    options?: EditMessageOptions,
  ): Promise<void> {
    await this.performEdit(channel, timestamp, {
      text,
      blocks: options?.blocks as SlackBlock[] | undefined,
      attachments: options?.attachments as MessageAttachment[] | undefined,
      parse: options?.parse,
      link_names: options?.linkNames,
      metadata: options?.metadata,
    });
  }

  /**
   * Internal method to perform message edit with error handling.
   */
  private async performEdit(
    channel: string,
    timestamp: string,
    params: {
      text?: string;
      blocks?: SlackBlock[];
      attachments?: MessageAttachment[];
      parse?: 'none' | 'full';
      link_names?: boolean;
      metadata?: MessageMetadata;
    },
  ): Promise<ChatUpdateResponse> {
    try {
      // Build the update params - chat.update has multiple overloads
      // Use explicit object construction to satisfy TypeScript
      const response = params.attachments
        ? await this.client.chat.update({
            channel,
            ts: timestamp,
            text: params.text ?? '',
            attachments: params.attachments,
            parse: params.parse,
            link_names: params.link_names,
            metadata: params.metadata,
          })
        : params.blocks
          ? await this.client.chat.update({
              channel,
              ts: timestamp,
              text: params.text ?? '',
              blocks: params.blocks,
              parse: params.parse,
              link_names: params.link_names,
              metadata: params.metadata,
            })
          : await this.client.chat.update({
              channel,
              ts: timestamp,
              text: params.text ?? '',
              parse: params.parse,
              link_names: params.link_names,
              metadata: params.metadata,
            });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to edit message: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }

      return response;
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'edit'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  // --------------------------------------------------------------------------
  // Message Deletion
  // --------------------------------------------------------------------------

  /**
   * Delete a message from a channel.
   *
   * Note: You can only delete messages sent by the authenticated user/bot,
   * unless you have admin permissions. Workspace owners/admins can delete
   * any message in their workspace.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to delete
   * @throws {SlackMessageError} If the deletion fails
   *
   * @example
   * ```typescript
   * await manager.deleteMessage('C123456', '1234567890.123456');
   * ```
   */
  async deleteMessage(channel: string, timestamp: string): Promise<void> {
    try {
      const response: ChatDeleteResponse = await this.client.chat.delete({
        channel,
        ts: timestamp,
      });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to delete message: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'delete'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  // --------------------------------------------------------------------------
  // Message Pinning
  // --------------------------------------------------------------------------

  /**
   * Pin a message to a channel.
   *
   * Pinned messages appear in the channel's pinned items and are easily
   * accessible to all channel members.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to pin
   * @throws {SlackMessageError} If pinning fails
   *
   * @example
   * ```typescript
   * await manager.pinMessage('C123456', '1234567890.123456');
   * ```
   */
  async pinMessage(channel: string, timestamp: string): Promise<void> {
    try {
      const response: PinsAddResponse = await this.client.pins.add({
        channel,
        timestamp,
      });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to pin message: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'pin'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  /**
   * Unpin a message from a channel.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to unpin
   * @throws {SlackMessageError} If unpinning fails
   *
   * @example
   * ```typescript
   * await manager.unpinMessage('C123456', '1234567890.123456');
   * ```
   */
  async unpinMessage(channel: string, timestamp: string): Promise<void> {
    try {
      const response: PinsRemoveResponse = await this.client.pins.remove({
        channel,
        timestamp,
      });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to unpin message: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'unpin'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  /**
   * Get all pinned messages in a channel.
   *
   * @param channel - The channel to get pinned messages from
   * @returns Array of pinned messages with metadata
   * @throws {SlackMessageError} If retrieval fails
   *
   * @example
   * ```typescript
   * const pinnedMessages = await manager.getPinnedMessages('C123456');
   * pinnedMessages.forEach(pin => {
   *   console.log(`Pinned by ${pin.created_by}: ${pin.message.text}`);
   * });
   * ```
   */
  async getPinnedMessages(channel: string): Promise<PinnedMessage[]> {
    try {
      const response: PinsListResponse = await this.client.pins.list({
        channel,
      });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to get pinned messages: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel },
        );
      }

      // Transform the response items to PinnedMessage format
      const pinnedMessages: PinnedMessage[] = [];

      if (response.items) {
        for (const item of response.items) {
          // Only include message type pins (not files)
          // Use type narrowing with 'message' property check
          const itemWithMessage = item as {
            type?: string;
            message?: MessageElement;
            created?: number;
            created_by?: string;
          };
          if (itemWithMessage.type === 'message' && itemWithMessage.message) {
            pinnedMessages.push({
              type: 'message',
              channel,
              message: this.transformMessage(itemWithMessage.message),
              created: itemWithMessage.created ?? 0,
              created_by: itemWithMessage.created_by ?? '',
            });
          }
        }
      }

      return pinnedMessages;
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'list pins'),
        errorCode,
        { channel, context: { originalError: error } },
      );
    }
  }

  // --------------------------------------------------------------------------
  // Message Retrieval
  // --------------------------------------------------------------------------

  /**
   * Retrieve a specific message by its timestamp.
   *
   * Uses conversations.history with inclusive=true to fetch a single message.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts) to retrieve
   * @returns The message object
   * @throws {SlackMessageError} If the message is not found or retrieval fails
   *
   * @example
   * ```typescript
   * const message = await manager.getMessage('C123456', '1234567890.123456');
   * console.log(`Message from ${message.user}: ${message.text}`);
   * ```
   */
  async getMessage(channel: string, timestamp: string): Promise<Message> {
    try {
      const response: ConversationsHistoryResponse =
        await this.client.conversations.history({
          channel,
          latest: timestamp,
          oldest: timestamp,
          inclusive: true,
          limit: 1,
        });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to get message: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }

      if (!response.messages || response.messages.length === 0) {
        throw new SlackMessageError(
          'Message not found',
          'MESSAGE_NOT_FOUND',
          { channel, timestamp },
        );
      }

      return this.transformMessage(response.messages[0]);
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'get'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  /**
   * Retrieve message history from a channel.
   *
   * @param channel - The channel to fetch history from
   * @param options - Optional parameters for filtering and pagination
   * @returns Array of messages in reverse chronological order (newest first)
   * @throws {SlackMessageError} If retrieval fails
   *
   * @example
   * ```typescript
   * // Get last 50 messages
   * const messages = await manager.getHistory('C123456', { limit: 50 });
   *
   * // Get messages from a specific time range
   * const rangeMessages = await manager.getHistory('C123456', {
   *   oldest: '1609459200.000000', // 2021-01-01
   *   latest: '1640995200.000000', // 2022-01-01
   * });
   *
   * // Paginate through history
   * let cursor: string | undefined;
   * do {
   *   const result = await manager.getHistoryWithCursor('C123456', { cursor });
   *   // process result.messages
   *   cursor = result.nextCursor;
   * } while (cursor);
   * ```
   */
  async getHistory(
    channel: string,
    options?: HistoryOptions,
  ): Promise<Message[]> {
    const result = await this.getHistoryWithCursor(channel, options);
    return [...result.messages];
  }

  /**
   * Retrieve message history with pagination cursor support.
   *
   * @param channel - The channel to fetch history from
   * @param options - Optional parameters for filtering and pagination
   * @returns History result with messages and pagination info
   * @throws {SlackMessageError} If retrieval fails
   */
  async getHistoryWithCursor(
    channel: string,
    options?: HistoryOptions,
  ): Promise<HistoryResult> {
    try {
      const response: ConversationsHistoryResponse =
        await this.client.conversations.history({
          channel,
          limit: options?.limit ?? 100,
          oldest: options?.oldest,
          latest: options?.latest,
          inclusive: options?.inclusive,
          cursor: options?.cursor,
          include_all_metadata: options?.includeAllMetadata,
        });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to get history: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel },
        );
      }

      const messages = (response.messages ?? []).map((msg) =>
        this.transformMessage(msg),
      );

      return {
        messages,
        hasMore: response.has_more ?? false,
        nextCursor: response.response_metadata?.next_cursor,
        responseMetadata: response.response_metadata,
      };
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'get history'),
        errorCode,
        { channel, context: { originalError: error } },
      );
    }
  }

  /**
   * Retrieve replies to a threaded message.
   *
   * @param channel - The channel containing the thread
   * @param threadTimestamp - The parent message timestamp
   * @param options - Optional parameters for filtering and pagination
   * @returns Array of messages in the thread
   * @throws {SlackMessageError} If retrieval fails
   *
   * @example
   * ```typescript
   * const threadReplies = await manager.getThreadReplies(
   *   'C123456',
   *   '1234567890.123456'
   * );
   * ```
   */
  async getThreadReplies(
    channel: string,
    threadTimestamp: string,
    options?: HistoryOptions,
  ): Promise<Message[]> {
    try {
      const response: ConversationsRepliesResponse =
        await this.client.conversations.replies({
          channel,
          ts: threadTimestamp,
          limit: options?.limit ?? 100,
          oldest: options?.oldest,
          latest: options?.latest,
          inclusive: options?.inclusive,
          cursor: options?.cursor,
        });

      if (!response.ok) {
        throw new SlackMessageError(
          `Failed to get thread replies: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp: threadTimestamp },
        );
      }

      return (response.messages ?? []).map((msg) => this.transformMessage(msg));
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'get thread'),
        errorCode,
        { channel, timestamp: threadTimestamp, context: { originalError: error } },
      );
    }
  }

  // --------------------------------------------------------------------------
  // Message Permalink
  // --------------------------------------------------------------------------

  /**
   * Get a permanent shareable link to a message.
   *
   * @param channel - The channel containing the message
   * @param timestamp - The message timestamp (ts)
   * @returns The permalink URL
   * @throws {SlackMessageError} If retrieval fails
   *
   * @example
   * ```typescript
   * const link = await manager.getPermalink('C123456', '1234567890.123456');
   * console.log(`Share this message: ${link}`);
   * ```
   */
  async getPermalink(channel: string, timestamp: string): Promise<string> {
    try {
      const response: ChatGetPermalinkResponse =
        await this.client.chat.getPermalink({
          channel,
          message_ts: timestamp,
        });

      if (!response.ok || !response.permalink) {
        throw new SlackMessageError(
          `Failed to get permalink: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN_ERROR',
          { channel, timestamp },
        );
      }

      return response.permalink;
    } catch (error) {
      if (error instanceof SlackMessageError) {
        throw error;
      }

      const slackError = error as { data?: { error?: string } };
      const errorCode = slackError.data?.error ?? 'UNKNOWN_ERROR';

      throw new SlackMessageError(
        this.getErrorMessage(errorCode, 'get permalink'),
        errorCode,
        { channel, timestamp, context: { originalError: error } },
      );
    }
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Check if the authenticated user can modify a message.
   *
   * @param message - The message to check
   * @returns True if the user can edit/delete the message
   */
  canModifyMessage(message: Message): boolean {
    if (!this.botUserId) {
      // Cannot determine without bot user ID
      return false;
    }

    // Can modify if the message was sent by this user/bot
    return message.user === this.botUserId || message.bot_id === this.botUserId;
  }

  /**
   * Transform raw Slack API message to our Message interface.
   */
  private transformMessage(rawMessage: MessageElement): Message {
    // Cast to extended type to access optional properties not in base MessageElement
    const extendedMessage = rawMessage as MessageElement & {
      pinned_to?: string[];
    };

    return {
      type: rawMessage.type ?? 'message',
      user: rawMessage.user,
      text: rawMessage.text,
      ts: rawMessage.ts ?? '',
      thread_ts: rawMessage.thread_ts,
      reply_count: rawMessage.reply_count,
      reply_users: rawMessage.reply_users,
      reply_users_count: rawMessage.reply_users_count,
      latest_reply: rawMessage.latest_reply,
      subtype: rawMessage.subtype,
      blocks: rawMessage.blocks as readonly SlackBlock[] | undefined,
      attachments: rawMessage.attachments as readonly MessageAttachment[] | undefined,
      reactions: rawMessage.reactions as readonly MessageReaction[] | undefined,
      files: rawMessage.files as readonly MessageFile[] | undefined,
      edited: rawMessage.edited as { user: string; ts: string } | undefined,
      bot_id: rawMessage.bot_id,
      app_id: rawMessage.app_id,
      metadata: rawMessage.metadata as Record<string, unknown> | undefined,
      pinned_to: extendedMessage.pinned_to,
    };
  }

  /**
   * Get a user-friendly error message for Slack API errors.
   */
  private getErrorMessage(errorCode: string, operation: string): string {
    const errorMessages: Record<string, string> = {
      channel_not_found: 'The specified channel does not exist or is not accessible',
      message_not_found: 'The specified message was not found',
      cant_update_message: 'Cannot update this message (may belong to another user)',
      cant_delete_message: 'Cannot delete this message (may belong to another user)',
      edit_window_closed: 'The time window for editing this message has closed',
      msg_too_long: 'The message text is too long',
      no_text: 'Message text is required',
      not_authed: 'Authentication token is missing or invalid',
      invalid_auth: 'Authentication token is invalid',
      account_inactive: 'The authenticated account has been deactivated',
      token_revoked: 'The authentication token has been revoked',
      no_permission: 'The bot does not have permission to perform this action',
      missing_scope: 'The token is missing required OAuth scopes',
      already_pinned: 'This message is already pinned',
      not_pinned: 'This message is not currently pinned',
      permission_denied: 'Permission denied for this operation',
      restricted_action: 'This action is restricted by workspace settings',
      ratelimited: 'Rate limit exceeded. Please try again later',
      invalid_ts: 'The provided timestamp is invalid',
    };

    return (
      errorMessages[errorCode] ??
      `Failed to ${operation} message: ${errorCode}`
    );
  }
}

// ============================================================================
// Exports
// ============================================================================

export default MessageManager;
