/**
 * @wundr/slack-agent - Threading Capabilities
 *
 * Implements Slack threading functionality for the VP (Virtual Principal) agent.
 * Enables natural participation in threaded conversations as a full Slack user.
 *
 * @packageDocumentation
 */

import type {
  WebClient,
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  ConversationsRepliesResponse,
} from '@slack/web-api';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Represents a Slack Block Kit element for rich message formatting
 */
export interface BlockKitElement {
  readonly type: string;
  readonly [key: string]: unknown;
}

/**
 * Block Kit message structure for rich formatting
 */
export interface BlockKit {
  readonly blocks: readonly BlockKitElement[];
  readonly text?: string;
  readonly attachments?: readonly Record<string, unknown>[];
}

/**
 * Result of a message operation
 */
export interface MessageResult {
  readonly ok: boolean;
  readonly channel: string;
  readonly ts: string;
  readonly threadTs?: string;
  readonly message?: SlackMessage;
  readonly error?: string;
}

/**
 * Represents a Slack message
 */
export interface SlackMessage {
  readonly type: string;
  readonly user?: string;
  readonly text?: string;
  readonly ts: string;
  readonly threadTs?: string;
  readonly replyCount?: number;
  readonly replyUsersCount?: number;
  readonly latestReply?: string;
  readonly replyUsers?: readonly string[];
  readonly subscribed?: boolean;
  readonly blocks?: readonly BlockKitElement[];
  readonly attachments?: readonly Record<string, unknown>[];
}

/**
 * Information about a thread
 */
export interface ThreadInfo {
  /** Number of replies in the thread */
  readonly replyCount: number;
  /** Number of unique participants in the thread */
  readonly participantCount: number;
  /** Timestamp of the latest reply */
  readonly latestReply: string | null;
  /** Whether the current user is subscribed to the thread */
  readonly isSubscribed: boolean;
  /** Parent message timestamp */
  readonly parentTs: string;
  /** Channel ID */
  readonly channel: string;
  /** List of user IDs who have participated */
  readonly participants: readonly string[];
  /** Parent message text (if available) */
  readonly parentText?: string;
}

/**
 * Options for fetching thread replies
 */
export interface GetThreadRepliesOptions {
  /** Maximum number of replies to fetch (default: 100) */
  readonly limit?: number;
  /** Cursor for pagination */
  readonly cursor?: string;
  /** Include the parent message in results */
  readonly inclusive?: boolean;
  /** Fetch replies newer than this timestamp */
  readonly oldest?: string;
  /** Fetch replies older than this timestamp */
  readonly latest?: string;
}

/**
 * Options for posting messages
 */
export interface PostMessageOptions {
  /** Parse mode for message text */
  readonly parse?: 'full' | 'none';
  /** Enable link unfurling */
  readonly unfurlLinks?: boolean;
  /** Enable media unfurling */
  readonly unfurlMedia?: boolean;
  /** Metadata to attach to the message */
  readonly metadata?: Record<string, unknown>;
  /** Icon emoji to use for the message */
  readonly iconEmoji?: string;
  /** Icon URL to use for the message */
  readonly iconUrl?: string;
  /** Username to display for the message */
  readonly username?: string;
}

/**
 * Type guard to check if content is BlockKit
 */
function isBlockKit(content: string | BlockKit): content is BlockKit {
  return typeof content === 'object' && 'blocks' in content;
}

// =============================================================================
// SlackThreadingCapability Class
// =============================================================================

/**
 * Provides threading capabilities for the Slack VP agent.
 *
 * This class enables the VP agent to participate in threaded conversations
 * naturally, including replying to threads, starting new threads, and
 * managing thread subscriptions.
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { SlackThreadingCapability } from './threading';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const threading = new SlackThreadingCapability(client);
 *
 * // Reply to an existing thread
 * const result = await threading.replyToThread(
 *   'C1234567890',
 *   '1234567890.123456',
 *   'This is my reply!'
 * );
 *
 * // Get thread information
 * const info = await threading.getThreadInfo('C1234567890', '1234567890.123456');
 * console.log(`Thread has ${info.replyCount} replies`);
 * ```
 */
export class SlackThreadingCapability {
  private readonly client: WebClient;
  private readonly botUserId?: string;

  /**
   * Creates a new SlackThreadingCapability instance.
   *
   * @param client - Slack WebClient instance with appropriate permissions
   * @param botUserId - Optional bot user ID for checking participation
   */
  constructor(client: WebClient, botUserId?: string) {
    this.client = client;
    this.botUserId = botUserId;
  }

  // ===========================================================================
  // Core Threading Methods
  // ===========================================================================

  /**
   * Posts a reply to an existing thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @param message - Message content (plain text or BlockKit)
   * @param options - Additional posting options
   * @returns Result of the message operation
   *
   * @example
   * ```typescript
   * // Plain text reply
   * await threading.replyToThread('C123', '1234.5678', 'Thanks for sharing!');
   *
   * // Block Kit reply
   * await threading.replyToThread('C123', '1234.5678', {
   *   blocks: [
   *     { type: 'section', text: { type: 'mrkdwn', text: '*Important update*' } }
   *   ]
   * });
   * ```
   */
  async replyToThread(
    channel: string,
    threadTs: string,
    message: string | BlockKit,
    options: PostMessageOptions = {},
  ): Promise<MessageResult> {
    try {
      const args = this.buildPostMessageArgs(channel, message, options, threadTs, false);
      const response: ChatPostMessageResponse = await this.client.chat.postMessage(args);
      return this.buildMessageResult(response);
    } catch (error) {
      return this.buildErrorResult(channel, error);
    }
  }

  /**
   * Posts a reply to a thread and also broadcasts it to the channel.
   *
   * This is useful when a reply contains important information that
   * should be visible to all channel members, not just thread participants.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @param message - Message content (plain text or BlockKit)
   * @param options - Additional posting options
   * @returns Result of the message operation
   *
   * @example
   * ```typescript
   * // Reply and broadcast to channel
   * await threading.replyAndBroadcast(
   *   'C123',
   *   '1234.5678',
   *   'Resolution: Issue has been fixed in v2.1.0'
   * );
   * ```
   */
  async replyAndBroadcast(
    channel: string,
    threadTs: string,
    message: string | BlockKit,
    options: PostMessageOptions = {},
  ): Promise<MessageResult> {
    try {
      const args = this.buildPostMessageArgs(channel, message, options, threadTs, true);
      const response: ChatPostMessageResponse = await this.client.chat.postMessage(args);
      return this.buildMessageResult(response);
    } catch (error) {
      return this.buildErrorResult(channel, error);
    }
  }

  /**
   * Fetches all replies in a thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @param options - Options for fetching replies
   * @returns Array of messages in the thread
   *
   * @example
   * ```typescript
   * const replies = await threading.getThreadReplies('C123', '1234.5678');
   * console.log(`Found ${replies.length} messages in thread`);
   *
   * // With pagination
   * const recent = await threading.getThreadReplies('C123', '1234.5678', {
   *   limit: 50,
   *   oldest: '1234567890.000000'
   * });
   * ```
   */
  async getThreadReplies(
    channel: string,
    threadTs: string,
    options: GetThreadRepliesOptions = {},
  ): Promise<SlackMessage[]> {
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined = options.cursor;

    do {
      const response: ConversationsRepliesResponse =
        await this.client.conversations.replies({
          channel,
          ts: threadTs,
          limit: options.limit ?? 100,
          cursor,
          inclusive: options.inclusive ?? true,
          oldest: options.oldest,
          latest: options.latest,
        });

      if (response.ok && response.messages) {
        const messages = response.messages.map((msg) =>
          this.mapToSlackMessage(msg),
        );
        allMessages.push(...messages);
      }

      cursor = response.response_metadata?.next_cursor;

      // If a specific limit was set, stop after first page
      if (options.limit !== undefined) {
        break;
      }
    } while (cursor);

    return allMessages;
  }

  /**
   * Gets a list of user IDs who have participated in a thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns Array of user IDs who have replied to the thread
   *
   * @example
   * ```typescript
   * const participants = await threading.getThreadParticipants('C123', '1234.5678');
   * console.log(`Thread has ${participants.length} participants`);
   * ```
   */
  async getThreadParticipants(
    channel: string,
    threadTs: string,
  ): Promise<string[]> {
    const replies = await this.getThreadReplies(channel, threadTs, {
      inclusive: true,
    });

    const participantSet = new Set<string>();

    for (const reply of replies) {
      if (reply.user) {
        participantSet.add(reply.user);
      }
    }

    return Array.from(participantSet);
  }

  /**
   * Checks if a user is participating in a thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @param userId - User ID to check (defaults to bot user ID)
   * @returns True if the user has posted in the thread
   *
   * @example
   * ```typescript
   * // Check if bot is in thread
   * const isInThread = await threading.isInThread('C123', '1234.5678');
   *
   * // Check if specific user is in thread
   * const userInThread = await threading.isInThread('C123', '1234.5678', 'U987654321');
   * ```
   */
  async isInThread(
    channel: string,
    threadTs: string,
    userId?: string,
  ): Promise<boolean> {
    const targetUserId = userId ?? this.botUserId;

    if (!targetUserId) {
      throw new Error(
        'User ID is required. Either pass it as a parameter or provide botUserId in constructor.',
      );
    }

    const participants = await this.getThreadParticipants(channel, threadTs);
    return participants.includes(targetUserId);
  }

  /**
   * Gets detailed information about a thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns Thread information including reply count, participants, and subscription status
   *
   * @example
   * ```typescript
   * const info = await threading.getThreadInfo('C123', '1234.5678');
   * console.log(`
   *   Replies: ${info.replyCount}
   *   Participants: ${info.participantCount}
   *   Latest: ${info.latestReply}
   *   Subscribed: ${info.isSubscribed}
   * `);
   * ```
   */
  async getThreadInfo(channel: string, threadTs: string): Promise<ThreadInfo> {
    const response: ConversationsRepliesResponse =
      await this.client.conversations.replies({
        channel,
        ts: threadTs,
        limit: 1,
        inclusive: true,
      });

    if (!response.ok || !response.messages || response.messages.length === 0) {
      throw new Error(`Thread not found: ${channel}/${threadTs}`);
    }

    const parentMessage = response.messages[0];

    // Fetch all participants
    const participants = await this.getThreadParticipants(channel, threadTs);

    // Handle reply_users which may be an array or undefined
    const replyUsers = parentMessage.reply_users;
    const replyUsersArray: readonly string[] = Array.isArray(replyUsers)
      ? replyUsers
      : [];

    return {
      replyCount: parentMessage.reply_count ?? 0,
      participantCount: participants.length,
      latestReply: parentMessage.latest_reply ?? null,
      isSubscribed: parentMessage.subscribed ?? false,
      parentTs: threadTs,
      channel,
      participants: replyUsersArray.length > 0 ? replyUsersArray : participants,
      parentText: parentMessage.text,
    };
  }

  // ===========================================================================
  // Thread Subscription Methods
  // ===========================================================================

  /**
   * Subscribes to notifications for a thread.
   *
   * Note: This uses the undocumented subscriptions.thread.add API.
   * Consider using the official API when available.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns True if subscription was successful
   *
   * @example
   * ```typescript
   * const subscribed = await threading.followThread('C123', '1234.5678');
   * if (subscribed) {
   *   console.log('Now following thread');
   * }
   * ```
   */
  async followThread(channel: string, threadTs: string): Promise<boolean> {
    try {
      // Use conversations.replies with inclusive to mark as subscribed
      // This is the documented way to "follow" a thread - by interacting with it
      // For explicit subscription control, you may need to use the Web API beta features
      const response = await this.client.apiCall('subscriptions.thread.add', {
        channel,
        thread_ts: threadTs,
      });

      return response.ok === true;
    } catch {
      // If the API is not available, return false
      // The user can still manually follow via the Slack UI
      return false;
    }
  }

  /**
   * Unsubscribes from notifications for a thread.
   *
   * Note: This uses the undocumented subscriptions.thread.remove API.
   * Consider using the official API when available.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns True if unsubscription was successful
   *
   * @example
   * ```typescript
   * const unfollowed = await threading.unfollowThread('C123', '1234.5678');
   * if (unfollowed) {
   *   console.log('No longer following thread');
   * }
   * ```
   */
  async unfollowThread(channel: string, threadTs: string): Promise<boolean> {
    try {
      const response = await this.client.apiCall('subscriptions.thread.remove', {
        channel,
        thread_ts: threadTs,
      });

      return response.ok === true;
    } catch {
      // If the API is not available, return false
      return false;
    }
  }

  // ===========================================================================
  // Thread Creation Methods
  // ===========================================================================

  /**
   * Starts a new thread by replying to a message.
   *
   * This is an alias for replyToThread, provided for semantic clarity
   * when the intent is to start a new thread rather than continue one.
   *
   * @param channel - Channel ID where the message exists
   * @param messageTs - Timestamp of the message to start a thread from
   * @param message - Message content (plain text or BlockKit)
   * @param options - Additional posting options
   * @returns Result of the message operation
   *
   * @example
   * ```typescript
   * // Start a thread on an existing message
   * await threading.startThread(
   *   'C123',
   *   '1234.5678',
   *   'Let me expand on this point...'
   * );
   * ```
   */
  async startThread(
    channel: string,
    messageTs: string,
    message: string | BlockKit,
    options: PostMessageOptions = {},
  ): Promise<MessageResult> {
    return this.replyToThread(channel, messageTs, message, options);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Gets the total count of messages in a thread (including parent).
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns Total message count
   */
  async getThreadMessageCount(
    channel: string,
    threadTs: string,
  ): Promise<number> {
    const info = await this.getThreadInfo(channel, threadTs);
    return info.replyCount + 1; // +1 for parent message
  }

  /**
   * Checks if a message timestamp represents a thread parent.
   *
   * @param channel - Channel ID where the message exists
   * @param messageTs - Message timestamp to check
   * @returns True if the message has thread replies
   */
  async isThreadParent(channel: string, messageTs: string): Promise<boolean> {
    try {
      const info = await this.getThreadInfo(channel, messageTs);
      return info.replyCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets the latest reply in a thread.
   *
   * @param channel - Channel ID where the thread exists
   * @param threadTs - Timestamp of the parent message (thread_ts)
   * @returns The latest reply message, or null if no replies
   */
  async getLatestReply(
    channel: string,
    threadTs: string,
  ): Promise<SlackMessage | null> {
    const replies = await this.getThreadReplies(channel, threadTs, {
      limit: 2, // Get parent + 1 reply to find the latest
      inclusive: true,
    });

    // Filter out the parent message and get the last reply
    const nonParentReplies = replies.filter((msg) => msg.ts !== threadTs);

    if (nonParentReplies.length === 0) {
      // No replies yet, need to fetch with proper ordering
      const allReplies = await this.getThreadReplies(channel, threadTs, {
        inclusive: false,
      });

      return allReplies.length > 0 ? allReplies[allReplies.length - 1] : null;
    }

    return nonParentReplies[nonParentReplies.length - 1];
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Builds properly typed ChatPostMessageArguments for the Slack API.
   */
  private buildPostMessageArgs(
    channel: string,
    message: string | BlockKit,
    options: PostMessageOptions,
    threadTs: string,
    replyBroadcast: boolean,
  ): ChatPostMessageArguments {
    // Determine the text content
    const text = isBlockKit(message) ? (message.text ?? '') : message;

    // Build the arguments object - using Record to allow dynamic property assignment
    // then cast to ChatPostMessageArguments for the return
    const args: Record<string, unknown> = {
      channel,
      text,
      thread_ts: threadTs,
      reply_broadcast: replyBroadcast,
    };

    // Add blocks if using BlockKit
    if (isBlockKit(message)) {
      args.blocks = message.blocks;
      if (message.attachments) {
        args.attachments = message.attachments;
      }
    }

    // Add optional parameters
    if (options.parse !== undefined) {
      args.parse = options.parse;
    }
    if (options.unfurlLinks !== undefined) {
      args.unfurl_links = options.unfurlLinks;
    }
    if (options.unfurlMedia !== undefined) {
      args.unfurl_media = options.unfurlMedia;
    }
    if (options.metadata !== undefined) {
      args.metadata = options.metadata;
    }
    if (options.iconEmoji !== undefined) {
      args.icon_emoji = options.iconEmoji;
    }
    if (options.iconUrl !== undefined) {
      args.icon_url = options.iconUrl;
    }
    if (options.username !== undefined) {
      args.username = options.username;
    }

    return args as unknown as ChatPostMessageArguments;
  }

  /**
   * Builds a successful message result from API response.
   */
  private buildMessageResult(response: ChatPostMessageResponse): MessageResult {
    return {
      ok: response.ok ?? false,
      channel: response.channel ?? '',
      ts: response.ts ?? '',
      threadTs: response.message?.thread_ts,
      message: response.message
        ? this.mapToSlackMessage(response.message)
        : undefined,
    };
  }

  /**
   * Builds an error message result.
   */
  private buildErrorResult(channel: string, error: unknown): MessageResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      ok: false,
      channel,
      ts: '',
      error: errorMessage,
    };
  }

  /**
   * Maps a Slack API message to our SlackMessage type.
   */
  private mapToSlackMessage(
    msg: Record<string, unknown> | { type?: string; user?: string; text?: string; ts?: string; thread_ts?: string; reply_count?: number; reply_users_count?: number; latest_reply?: string; reply_users?: string[]; subscribed?: boolean; blocks?: unknown[]; attachments?: unknown[] },
  ): SlackMessage {
    return {
      type: (msg.type as string) ?? 'message',
      user: msg.user as string | undefined,
      text: msg.text as string | undefined,
      ts: (msg.ts as string) ?? '',
      threadTs: msg.thread_ts as string | undefined,
      replyCount: msg.reply_count as number | undefined,
      replyUsersCount: msg.reply_users_count as number | undefined,
      latestReply: msg.latest_reply as string | undefined,
      replyUsers: msg.reply_users as readonly string[] | undefined,
      subscribed: msg.subscribed as boolean | undefined,
      blocks: msg.blocks as readonly BlockKitElement[] | undefined,
      attachments: msg.attachments as readonly Record<string, unknown>[] | undefined,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new SlackThreadingCapability instance.
 *
 * @param client - Slack WebClient instance
 * @param botUserId - Optional bot user ID for checking participation
 * @returns SlackThreadingCapability instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createThreadingCapability } from './threading';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const threading = createThreadingCapability(client, 'U123BOT');
 * ```
 */
export function createThreadingCapability(
  client: WebClient,
  botUserId?: string,
): SlackThreadingCapability {
  return new SlackThreadingCapability(client, botUserId);
}

// =============================================================================
// Exports
// =============================================================================

export default SlackThreadingCapability;
