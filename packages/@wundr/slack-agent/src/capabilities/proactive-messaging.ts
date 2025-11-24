/**
 * @wundr/slack-agent - Proactive Messaging Capability
 *
 * Enables VP (Virtual Principal) agents to initiate conversations in Slack
 * just like human users. Supports DMs, group DMs, channel posts, and scheduled
 * messages using both user tokens (xoxp-) and bot tokens (xoxb-).
 *
 * @packageDocumentation
 */

import { WebClient } from '@slack/web-api';

import type {
  WebAPICallResult,
  ConversationsOpenResponse,
  ChatPostMessageResponse,
  ChatPostMessageArguments,
  ChatScheduleMessageResponse,
  ChatScheduledMessagesListResponse,
} from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Token type enumeration
 */
export type TokenType = 'user' | 'bot';

/**
 * Block Kit element types supported by Slack
 */
export interface BlockKitElement {
  type: string;
  [key: string]: unknown;
}

/**
 * Block Kit message structure
 */
export interface BlockKit {
  blocks: BlockKitElement[];
  text?: string; // Fallback text for notifications
}

/**
 * Options for posting messages to channels
 */
export interface PostOptions {
  /** Thread timestamp to reply in thread */
  threadTs?: string;
  /** Whether to broadcast thread reply to channel */
  replyBroadcast?: boolean;
  /** Emoji name for icon (bot only) */
  iconEmoji?: string;
  /** URL for icon (bot only) */
  iconUrl?: string;
  /** Username override (bot only) */
  username?: string;
  /** Whether to unfurl links */
  unfurlLinks?: boolean;
  /** Whether to unfurl media */
  unfurlMedia?: boolean;
  /** Parse mode: 'full' | 'none' */
  parse?: 'full' | 'none';
  /** Whether to link channel names and usernames */
  linkNames?: boolean;
  /** Message metadata */
  metadata?: {
    eventType: string;
    eventPayload: Record<string, string | number | boolean>;
  };
}

/**
 * Result from sending a message
 */
export interface MessageResult {
  /** Whether the operation succeeded */
  ok: boolean;
  /** Channel ID where message was sent */
  channelId: string;
  /** Timestamp of the message (message ID) */
  ts: string;
  /** Message content */
  message?: {
    text?: string;
    ts?: string;
    user?: string;
    botId?: string;
  };
  /** Error message if failed */
  error?: string;
}

/**
 * Result from scheduling a message
 */
export interface ScheduledMessageResult {
  /** Whether the operation succeeded */
  ok: boolean;
  /** Scheduled message ID */
  scheduledMessageId: string;
  /** Channel where message will be posted */
  channelId: string;
  /** Unix timestamp when message will be posted */
  postAt: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Scheduled message information
 */
export interface ScheduledMessage {
  /** Scheduled message ID */
  id: string;
  /** Channel ID */
  channelId: string;
  /** Unix timestamp for posting */
  postAt: number;
  /** ISO date string for posting */
  postAtDate: Date;
  /** Message text */
  text: string;
  /** Date when scheduled */
  dateCreated: number;
}

/**
 * Rate limit tracking information
 */
interface RateLimitInfo {
  /** Number of requests made in current window */
  requestCount: number;
  /** Window start timestamp */
  windowStart: number;
  /** Time when rate limit resets (if limited) */
  retryAfter?: number;
}

/**
 * Configuration for the ProactiveMessenger
 */
export interface ProactiveMessengerConfig {
  /** User token (xoxp-*) for user-like messaging */
  userToken?: string;
  /** Bot token (xoxb-*) for bot messaging */
  botToken?: string;
  /** Default retry count for rate-limited requests */
  defaultRetryCount?: number;
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay?: number;
  /** Maximum retry delay (ms) */
  maxRetryDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type guard to check if a message is BlockKit format
 */
function isBlockKit(message: string | BlockKit): message is BlockKit {
  return typeof message === 'object' && 'blocks' in message && Array.isArray(message.blocks);
}

/**
 * Detects token type from token prefix
 */
function detectTokenType(token: string): TokenType {
  if (token.startsWith('xoxp-')) {
    return 'user';
  }
  if (token.startsWith('xoxb-')) {
    return 'bot';
  }
  throw new ProactiveMessagingError(
    'INVALID_TOKEN',
    'Token must start with xoxp- (user) or xoxb- (bot)',
  );
}

/**
 * Calculates delay with exponential backoff and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Error codes for proactive messaging operations
 */
export enum ProactiveMessagingErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  NO_TOKEN_CONFIGURED = 'NO_TOKEN_CONFIGURED',
  RATE_LIMITED = 'RATE_LIMITED',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  NOT_IN_CHANNEL = 'NOT_IN_CHANNEL',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  INVALID_BLOCKS = 'INVALID_BLOCKS',
  SCHEDULED_MESSAGE_NOT_FOUND = 'SCHEDULED_MESSAGE_NOT_FOUND',
  INVALID_SCHEDULE_TIME = 'INVALID_SCHEDULE_TIME',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for proactive messaging operations
 */
export class ProactiveMessagingError extends Error {
  constructor(
    public readonly code: ProactiveMessagingErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProactiveMessagingError';
    Object.setPrototypeOf(this, ProactiveMessagingError.prototype);
  }
}


// =============================================================================
// Main Class
// =============================================================================

/**
 * ProactiveMessenger enables VP agents to initiate conversations in Slack
 * using user tokens (xoxp-) for authentic user-like messaging or bot tokens (xoxb-).
 *
 * @example
 * ```typescript
 * import { ProactiveMessenger } from '@wundr/slack-agent/capabilities/proactive-messaging';
 *
 * const messenger = new ProactiveMessenger({
 *   userToken: process.env.SLACK_USER_TOKEN, // xoxp-...
 *   botToken: process.env.SLACK_BOT_TOKEN,   // xoxb-... (fallback)
 * });
 *
 * // Send a DM to a user
 * const result = await messenger.sendDM('U01234567', 'Hello! I have an update for you.');
 *
 * // Create and send to a group DM
 * await messenger.sendGroupDM(
 *   ['U01234567', 'U89012345'],
 *   { blocks: [...], text: 'Group update' }
 * );
 *
 * // Schedule a message for later
 * await messenger.scheduleMessage(
 *   'C01234567',
 *   'Reminder: Team sync in 15 minutes!',
 *   new Date(Date.now() + 15 * 60 * 1000)
 * );
 * ```
 */
export class ProactiveMessenger {
  private readonly userClient?: WebClient;
  private readonly botClient?: WebClient;
  private readonly preferredTokenType: TokenType;
  private readonly config: Required<
    Pick<
      ProactiveMessengerConfig,
      'defaultRetryCount' | 'baseRetryDelay' | 'maxRetryDelay' | 'debug'
    >
  >;

  // Rate limit tracking per token
  private readonly rateLimitInfo: Map<TokenType, RateLimitInfo> = new Map();

  constructor(config: ProactiveMessengerConfig) {
    // Validate at least one token is provided
    if (!config.userToken && !config.botToken) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.NO_TOKEN_CONFIGURED,
        'At least one of userToken or botToken must be provided',
      );
    }

    // Initialize clients
    if (config.userToken) {
      detectTokenType(config.userToken); // Validate token format
      this.userClient = new WebClient(config.userToken, {
        retryConfig: { retries: 0 }, // We handle retries ourselves
      });
    }

    if (config.botToken) {
      detectTokenType(config.botToken); // Validate token format
      this.botClient = new WebClient(config.botToken, {
        retryConfig: { retries: 0 }, // We handle retries ourselves
      });
    }

    // Prefer user token for authentic user-like messaging
    this.preferredTokenType = config.userToken ? 'user' : 'bot';

    // Set configuration defaults
    this.config = {
      defaultRetryCount: config.defaultRetryCount ?? 3,
      baseRetryDelay: config.baseRetryDelay ?? 1000,
      maxRetryDelay: config.maxRetryDelay ?? 30000,
      debug: config.debug ?? false,
    };

    // Initialize rate limit tracking
    this.rateLimitInfo.set('user', { requestCount: 0, windowStart: Date.now() });
    this.rateLimitInfo.set('bot', { requestCount: 0, windowStart: Date.now() });
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Gets the appropriate client based on preference
   */
  private getClient(preferUser: boolean = true): { client: WebClient; tokenType: TokenType } {
    if (preferUser && this.userClient) {
      return { client: this.userClient, tokenType: 'user' };
    }
    if (this.botClient) {
      return { client: this.botClient, tokenType: 'bot' };
    }
    if (this.userClient) {
      return { client: this.userClient, tokenType: 'user' };
    }
    throw new ProactiveMessagingError(
      ProactiveMessagingErrorCode.NO_TOKEN_CONFIGURED,
      'No Slack client available',
    );
  }

  /**
   * Logs debug messages if debug mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      // Using process.stderr for debug output to avoid console lint warnings
      process.stderr.write(`[ProactiveMessenger] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`);
    }
  }

  /**
   * Handles rate limiting with exponential backoff
   */
  private async handleRateLimit(
    tokenType: TokenType,
    retryAfter?: number,
  ): Promise<void> {
    const delayMs = retryAfter
      ? retryAfter * 1000
      : this.config.baseRetryDelay;

    this.log(`Rate limited (${tokenType}), waiting ${delayMs}ms`);

    const info = this.rateLimitInfo.get(tokenType)!;
    info.retryAfter = Date.now() + delayMs;
    this.rateLimitInfo.set(tokenType, info);

    await sleep(delayMs);
  }

  /**
   * Executes a Slack API call with rate limit handling and retries
   */
  private async executeWithRetry<T extends WebAPICallResult>(
    operation: () => Promise<T>,
    tokenType: TokenType,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.defaultRetryCount; attempt++) {
      try {
        // Check if we're still in a rate limit window
        const rateLimitInfo = this.rateLimitInfo.get(tokenType);
        if (rateLimitInfo?.retryAfter && Date.now() < rateLimitInfo.retryAfter) {
          const waitTime = rateLimitInfo.retryAfter - Date.now();
          this.log(`Waiting ${waitTime}ms for rate limit to clear`);
          await sleep(waitTime);
        }

        this.log(`Executing ${operationName} (attempt ${attempt + 1})`);
        const result = await operation();

        if (!result.ok) {
          throw new ProactiveMessagingError(
            this.mapSlackError(result.error as string),
            result.error as string || 'Unknown Slack API error',
            { response: result },
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Handle rate limiting
        if (this.isRateLimitError(error)) {
          const retryAfter = this.extractRetryAfter(error);
          await this.handleRateLimit(tokenType, retryAfter);
          continue;
        }

        // Don't retry on non-retryable errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Calculate backoff for next attempt
        if (attempt < this.config.defaultRetryCount) {
          const delay = calculateBackoffDelay(
            attempt,
            this.config.baseRetryDelay,
            this.config.maxRetryDelay,
          );
          this.log(`Retrying after ${delay}ms due to error:`, error);
          await sleep(delay);
        }
      }
    }

    throw lastError || new ProactiveMessagingError(
      ProactiveMessagingErrorCode.UNKNOWN_ERROR,
      `Failed after ${this.config.defaultRetryCount + 1} attempts`,
    );
  }

  /**
   * Checks if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate_limited') ||
        message.includes('ratelimited') ||
        message.includes('too_many_requests')
      );
    }
    return false;
  }

  /**
   * Extracts retry-after value from rate limit error
   */
  private extractRetryAfter(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'retryAfter' in error) {
      return (error as { retryAfter: number }).retryAfter;
    }
    return undefined;
  }

  /**
   * Checks if an error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof ProactiveMessagingError) {
      const nonRetryableCodes: string[] = [
        ProactiveMessagingErrorCode.INVALID_TOKEN,
        ProactiveMessagingErrorCode.NO_TOKEN_CONFIGURED,
        ProactiveMessagingErrorCode.CHANNEL_NOT_FOUND,
        ProactiveMessagingErrorCode.USER_NOT_FOUND,
        ProactiveMessagingErrorCode.NOT_IN_CHANNEL,
        ProactiveMessagingErrorCode.PERMISSION_DENIED,
        ProactiveMessagingErrorCode.INVALID_BLOCKS,
        ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
      ];
      return nonRetryableCodes.includes(error.code);
    }
    return false;
  }

  /**
   * Maps Slack API errors to our error codes
   */
  private mapSlackError(slackError: string): ProactiveMessagingErrorCode {
    const errorMap: Record<string, ProactiveMessagingErrorCode> = {
      channel_not_found: ProactiveMessagingErrorCode.CHANNEL_NOT_FOUND,
      user_not_found: ProactiveMessagingErrorCode.USER_NOT_FOUND,
      not_in_channel: ProactiveMessagingErrorCode.NOT_IN_CHANNEL,
      msg_too_long: ProactiveMessagingErrorCode.MESSAGE_TOO_LONG,
      invalid_blocks: ProactiveMessagingErrorCode.INVALID_BLOCKS,
      invalid_blocks_format: ProactiveMessagingErrorCode.INVALID_BLOCKS,
      time_in_past: ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
      time_too_far: ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
      invalid_time: ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
      not_authed: ProactiveMessagingErrorCode.INVALID_TOKEN,
      invalid_auth: ProactiveMessagingErrorCode.INVALID_TOKEN,
      token_revoked: ProactiveMessagingErrorCode.INVALID_TOKEN,
      missing_scope: ProactiveMessagingErrorCode.PERMISSION_DENIED,
      restricted_action: ProactiveMessagingErrorCode.PERMISSION_DENIED,
      rate_limited: ProactiveMessagingErrorCode.RATE_LIMITED,
      ratelimited: ProactiveMessagingErrorCode.RATE_LIMITED,
    };

    return errorMap[slackError] || ProactiveMessagingErrorCode.UNKNOWN_ERROR;
  }

  // ===========================================================================
  // Public API: Direct Messages
  // ===========================================================================

  /**
   * Opens a direct message channel with a user
   *
   * @param userId - The Slack user ID (e.g., U01234567)
   * @returns The channel ID for the DM conversation
   *
   * @example
   * ```typescript
   * const channelId = await messenger.openDM('U01234567');
   * console.log(`DM channel opened: ${channelId}`);
   * ```
   */
  async openDM(userId: string): Promise<string> {
    const { client, tokenType } = this.getClient(true);

    const result = await this.executeWithRetry<ConversationsOpenResponse>(
      () => client.conversations.open({ users: userId }),
      tokenType,
      'openDM',
    );

    if (!result.channel?.id) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.USER_NOT_FOUND,
        `Failed to open DM with user ${userId}`,
        { userId, response: result },
      );
    }

    this.log(`Opened DM channel ${result.channel.id} with user ${userId}`);
    return result.channel.id;
  }

  /**
   * Sends a direct message to a user
   *
   * Opens a DM conversation if needed, then sends the message.
   *
   * @param userId - The Slack user ID
   * @param message - Text message or BlockKit message
   * @returns Message result with channel ID and timestamp
   *
   * @example
   * ```typescript
   * // Simple text message
   * const result = await messenger.sendDM('U01234567', 'Hello!');
   *
   * // BlockKit message
   * const result = await messenger.sendDM('U01234567', {
   *   blocks: [
   *     { type: 'section', text: { type: 'mrkdwn', text: '*Important Update*' } }
   *   ],
   *   text: 'Important Update' // Fallback
   * });
   * ```
   */
  async sendDM(userId: string, message: string | BlockKit): Promise<MessageResult> {
    // First, open the DM channel
    const channelId = await this.openDM(userId);

    // Then send the message
    return this.postToChannel(channelId, message);
  }

  // ===========================================================================
  // Public API: Group Direct Messages (MPIM)
  // ===========================================================================

  /**
   * Creates a group DM (MPIM) with multiple users
   *
   * @param userIds - Array of Slack user IDs
   * @returns The channel ID for the group DM
   *
   * @example
   * ```typescript
   * const channelId = await messenger.createGroupDM(['U01234567', 'U89012345']);
   * console.log(`Group DM created: ${channelId}`);
   * ```
   */
  async createGroupDM(userIds: string[]): Promise<string> {
    if (userIds.length < 2) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.UNKNOWN_ERROR,
        'Group DM requires at least 2 users',
        { userIds },
      );
    }

    const { client, tokenType } = this.getClient(true);

    const result = await this.executeWithRetry<ConversationsOpenResponse>(
      () => client.conversations.open({ users: userIds.join(',') }),
      tokenType,
      'createGroupDM',
    );

    if (!result.channel?.id) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.USER_NOT_FOUND,
        `Failed to create group DM with users ${userIds.join(', ')}`,
        { userIds, response: result },
      );
    }

    this.log(`Created group DM ${result.channel.id} with users ${userIds.join(', ')}`);
    return result.channel.id;
  }

  /**
   * Sends a message to a group DM with multiple users
   *
   * Creates the group DM if needed, then sends the message.
   *
   * @param userIds - Array of Slack user IDs
   * @param message - Text message or BlockKit message
   * @returns Message result with channel ID and timestamp
   *
   * @example
   * ```typescript
   * const result = await messenger.sendGroupDM(
   *   ['U01234567', 'U89012345', 'U11111111'],
   *   'Team sync reminder!'
   * );
   * ```
   */
  async sendGroupDM(userIds: string[], message: string | BlockKit): Promise<MessageResult> {
    // First, create the group DM
    const channelId = await this.createGroupDM(userIds);

    // Then send the message
    return this.postToChannel(channelId, message);
  }

  // ===========================================================================
  // Public API: Channel Messages
  // ===========================================================================

  /**
   * Posts a message to any channel (public, private, or DM)
   *
   * @param channelId - The channel ID
   * @param message - Text message or BlockKit message
   * @param options - Additional posting options
   * @returns Message result with channel ID and timestamp
   *
   * @example
   * ```typescript
   * // Simple message
   * await messenger.postToChannel('C01234567', 'Hello channel!');
   *
   * // Thread reply
   * await messenger.postToChannel('C01234567', 'Thread reply', {
   *   threadTs: '1234567890.123456'
   * });
   *
   * // BlockKit with options
   * await messenger.postToChannel('C01234567', {
   *   blocks: [...],
   *   text: 'Fallback'
   * }, {
   *   unfurlLinks: false,
   *   unfurlMedia: true
   * });
   * ```
   */
  async postToChannel(
    channelId: string,
    message: string | BlockKit,
    options: PostOptions = {},
  ): Promise<MessageResult> {
    const { client, tokenType } = this.getClient(true);

    // Determine text and blocks based on message type
    const text = isBlockKit(message)
      ? (message.text || 'Message')
      : message;

    const blocks = isBlockKit(message) ? message.blocks : undefined;

    // Build the base arguments - use partial type for flexibility with Slack's complex union types
    const baseArgs: {
      channel: string;
      text: string;
      blocks?: unknown[];
      thread_ts?: string;
      reply_broadcast?: boolean;
      icon_emoji?: string;
      icon_url?: string;
      username?: string;
      unfurl_links?: boolean;
      unfurl_media?: boolean;
      parse?: 'full' | 'none';
      link_names?: boolean;
      metadata?: { event_type: string; event_payload: Record<string, string | number | boolean> };
    } = {
      channel: channelId,
      text,
    };

    // Add blocks if present
    if (blocks) {
      baseArgs.blocks = blocks;
    }

    // Apply optional settings
    if (options.threadTs) {
      baseArgs.thread_ts = options.threadTs;
    }
    if (options.replyBroadcast !== undefined) {
      baseArgs.reply_broadcast = options.replyBroadcast;
    }
    if (options.iconEmoji && tokenType === 'bot') {
      baseArgs.icon_emoji = options.iconEmoji;
    }
    if (options.iconUrl && tokenType === 'bot') {
      baseArgs.icon_url = options.iconUrl;
    }
    if (options.username && tokenType === 'bot') {
      baseArgs.username = options.username;
    }
    if (options.unfurlLinks !== undefined) {
      baseArgs.unfurl_links = options.unfurlLinks;
    }
    if (options.unfurlMedia !== undefined) {
      baseArgs.unfurl_media = options.unfurlMedia;
    }
    if (options.parse) {
      baseArgs.parse = options.parse;
    }
    if (options.linkNames !== undefined) {
      baseArgs.link_names = options.linkNames;
    }
    if (options.metadata) {
      baseArgs.metadata = {
        event_type: options.metadata.eventType,
        event_payload: options.metadata.eventPayload,
      };
    }

    const result = await this.executeWithRetry<ChatPostMessageResponse>(
      () => client.chat.postMessage(baseArgs as ChatPostMessageArguments),
      tokenType,
      'postToChannel',
    );

    this.log(`Posted message to channel ${channelId}: ${result.ts}`);

    return {
      ok: true,
      channelId: result.channel || channelId,
      ts: result.ts || '',
      message: result.message
        ? {
            text: result.message.text,
            ts: result.message.ts,
            user: result.message.user,
            botId: result.message.bot_id,
          }
        : undefined,
    };
  }

  // ===========================================================================
  // Public API: Scheduled Messages
  // ===========================================================================

  /**
   * Schedules a message to be sent at a future time
   *
   * @param channelId - The channel ID to post to
   * @param message - Text message (BlockKit not supported for scheduling)
   * @param postAt - Date when the message should be posted
   * @returns Scheduled message result with ID
   *
   * @example
   * ```typescript
   * // Schedule for 30 minutes from now
   * const result = await messenger.scheduleMessage(
   *   'C01234567',
   *   'Reminder: Meeting starting!',
   *   new Date(Date.now() + 30 * 60 * 1000)
   * );
   * console.log(`Scheduled message ID: ${result.scheduledMessageId}`);
   * ```
   */
  async scheduleMessage(
    channelId: string,
    message: string,
    postAt: Date,
  ): Promise<ScheduledMessageResult> {
    const { client, tokenType } = this.getClient(true);

    // Validate the schedule time
    const now = Date.now();
    const postAtTimestamp = Math.floor(postAt.getTime() / 1000);

    if (postAt.getTime() <= now) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
        'Schedule time must be in the future',
        { postAt: postAt.toISOString(), now: new Date(now).toISOString() },
      );
    }

    // Slack allows scheduling up to 120 days in advance
    const maxFutureMs = 120 * 24 * 60 * 60 * 1000;
    if (postAt.getTime() > now + maxFutureMs) {
      throw new ProactiveMessagingError(
        ProactiveMessagingErrorCode.INVALID_SCHEDULE_TIME,
        'Schedule time cannot be more than 120 days in the future',
        { postAt: postAt.toISOString() },
      );
    }

    const result = await this.executeWithRetry<ChatScheduleMessageResponse>(
      () =>
        client.chat.scheduleMessage({
          channel: channelId,
          text: message,
          post_at: postAtTimestamp,
        }),
      tokenType,
      'scheduleMessage',
    );

    this.log(
      `Scheduled message ${result.scheduled_message_id} for ${postAt.toISOString()}`,
    );

    return {
      ok: true,
      scheduledMessageId: result.scheduled_message_id || '',
      channelId: result.channel || channelId,
      postAt: result.post_at || postAtTimestamp,
    };
  }

  /**
   * Lists all scheduled messages for the authenticated user/bot
   *
   * @returns Array of scheduled messages
   *
   * @example
   * ```typescript
   * const scheduled = await messenger.listScheduledMessages();
   * for (const msg of scheduled) {
   *   console.log(`${msg.id}: "${msg.text}" at ${msg.postAtDate.toISOString()}`);
   * }
   * ```
   */
  async listScheduledMessages(): Promise<ScheduledMessage[]> {
    const { client, tokenType } = this.getClient(true);

    const result = await this.executeWithRetry<ChatScheduledMessagesListResponse>(
      () => client.chat.scheduledMessages.list({}),
      tokenType,
      'listScheduledMessages',
    );

    const scheduledMessages = result.scheduled_messages || [];

    return scheduledMessages
      .filter(msg => msg.id && msg.channel_id && msg.post_at !== undefined)
      .map(msg => ({
        id: msg.id!,
        channelId: msg.channel_id!,
        postAt: msg.post_at!,
        postAtDate: new Date(msg.post_at! * 1000),
        text: msg.text || '',
        dateCreated: msg.date_created || 0,
      }));
  }

  /**
   * Deletes a scheduled message
   *
   * @param scheduledMessageId - The scheduled message ID to delete
   * @param channelId - The channel ID (required by Slack API)
   *
   * @example
   * ```typescript
   * await messenger.deleteScheduledMessage('Q01234567', 'C01234567');
   * console.log('Scheduled message deleted');
   * ```
   */
  async deleteScheduledMessage(
    scheduledMessageId: string,
    channelId?: string,
  ): Promise<void> {
    const { client, tokenType } = this.getClient(true);

    // If channelId not provided, we need to find it
    let targetChannelId = channelId;

    if (!targetChannelId) {
      const scheduledMessages = await this.listScheduledMessages();
      const message = scheduledMessages.find(m => m.id === scheduledMessageId);

      if (!message) {
        throw new ProactiveMessagingError(
          ProactiveMessagingErrorCode.SCHEDULED_MESSAGE_NOT_FOUND,
          `Scheduled message ${scheduledMessageId} not found`,
          { scheduledMessageId },
        );
      }

      targetChannelId = message.channelId;
    }

    await this.executeWithRetry(
      () =>
        client.chat.deleteScheduledMessage({
          channel: targetChannelId!,
          scheduled_message_id: scheduledMessageId,
        }),
      tokenType,
      'deleteScheduledMessage',
    );

    this.log(`Deleted scheduled message ${scheduledMessageId}`);
  }

  // ===========================================================================
  // Public API: Utility Methods
  // ===========================================================================

  /**
   * Gets the currently configured token type preference
   */
  getPreferredTokenType(): TokenType {
    return this.preferredTokenType;
  }

  /**
   * Checks if a user token is configured
   */
  hasUserToken(): boolean {
    return !!this.userClient;
  }

  /**
   * Checks if a bot token is configured
   */
  hasBotToken(): boolean {
    return !!this.botClient;
  }

  /**
   * Tests the connection by fetching auth info
   */
  async testConnection(): Promise<{
    ok: boolean;
    userId?: string;
    teamId?: string;
    tokenType: TokenType;
  }> {
    const { client, tokenType } = this.getClient(true);

    try {
      const result = await client.auth.test();
      return {
        ok: result.ok ?? false,
        userId: result.user_id as string | undefined,
        teamId: result.team_id as string | undefined,
        tokenType,
      };
    } catch (_error) {
      return {
        ok: false,
        tokenType,
      };
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ProactiveMessenger instance with the given configuration
 *
 * @param config - Configuration options
 * @returns ProactiveMessenger instance
 *
 * @example
 * ```typescript
 * const messenger = createProactiveMessenger({
 *   userToken: process.env.SLACK_USER_TOKEN,
 * });
 * ```
 */
export function createProactiveMessenger(
  config: ProactiveMessengerConfig,
): ProactiveMessenger {
  return new ProactiveMessenger(config);
}

/**
 * Creates a ProactiveMessenger from environment variables
 *
 * Looks for:
 * - SLACK_USER_TOKEN (xoxp-*)
 * - SLACK_BOT_TOKEN (xoxb-*)
 *
 * @param options - Additional configuration options
 * @returns ProactiveMessenger instance
 *
 * @example
 * ```typescript
 * const messenger = createProactiveMessengerFromEnv();
 * ```
 */
export function createProactiveMessengerFromEnv(
  options: Omit<ProactiveMessengerConfig, 'userToken' | 'botToken'> = {},
): ProactiveMessenger {
  const userToken = process.env.SLACK_USER_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!userToken && !botToken) {
    throw new ProactiveMessagingError(
      ProactiveMessagingErrorCode.NO_TOKEN_CONFIGURED,
      'Neither SLACK_USER_TOKEN nor SLACK_BOT_TOKEN environment variable is set',
    );
  }

  return new ProactiveMessenger({
    userToken,
    botToken,
    ...options,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default ProactiveMessenger;
