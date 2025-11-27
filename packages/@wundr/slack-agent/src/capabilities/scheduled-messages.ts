/**
 * @wundr/slack-agent - Scheduled Messages Capability
 *
 * Provides scheduled message functionality for Orchestrator (Virtual Principal) agents
 * operating as full users in Slack workspaces. Enables scheduling messages
 * for future delivery, just like the native Slack "schedule send" feature.
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Represents a block element in Slack Block Kit
 */
export interface Block {
  /** Block type (e.g., 'section', 'divider', 'actions') */
  type: string;
  /** Block identifier */
  block_id?: string;
  /** Text object for section blocks */
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  /** Accessory element for section blocks */
  accessory?: Record<string, unknown>;
  /** Elements array for context/actions blocks */
  elements?: Array<Record<string, unknown>>;
  /** Fields array for section blocks */
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  /** Image URL for image blocks */
  image_url?: string;
  /** Alt text for image blocks */
  alt_text?: string;
  /** Title for image blocks */
  title?: {
    type: 'plain_text';
    text: string;
  };
}

/**
 * Scheduled message structure returned by the API
 */
export interface ScheduledMessage {
  /** Unique identifier for the scheduled message */
  id: string;
  /** Channel ID where the message will be posted */
  channelId: string;
  /** Unix timestamp when the message is scheduled to be posted */
  postAt: Date;
  /** Message text content */
  text?: string;
  /** Date when the message was scheduled */
  dateCreated: Date;
  /** Thread timestamp if this is a thread reply */
  threadTs?: string;
  /** Block Kit blocks if used */
  blocks?: Block[];
}

/**
 * Raw scheduled message from Slack API
 */
interface SlackScheduledMessage {
  id: string;
  channel_id: string;
  post_at: number;
  date_created: number;
  text?: string;
}

/**
 * Options for scheduling a message
 */
export interface ScheduleMessageOptions {
  /** Thread timestamp to reply to */
  threadTs?: string;
  /** Block Kit blocks */
  blocks?: Block[];
  /** Parse mode for message formatting */
  parse?: 'full' | 'none';
  /** Link names in the message */
  linkNames?: boolean;
  /** Unfurl links */
  unfurlLinks?: boolean;
  /** Unfurl media */
  unfurlMedia?: boolean;
  /** Reply broadcast to channel */
  replyBroadcast?: boolean;
  /** Metadata for the message */
  metadata?: {
    event_type: string;
    event_payload: Record<string, unknown>;
  };
}

/**
 * Options for listing scheduled messages
 */
export interface ListScheduledMessagesOptions {
  /** Channel ID to filter by */
  channelId?: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum number of items to return */
  limit?: number;
  /** Filter for messages scheduled after this time */
  oldest?: Date;
  /** Filter for messages scheduled before this time */
  latest?: Date;
  /** Team ID (for org-wide apps) */
  teamId?: string;
}

/**
 * Paginated response for listing scheduled messages
 */
export interface PaginatedScheduledMessages {
  /** Array of scheduled messages */
  messages: ScheduledMessage[];
  /** Cursor for next page */
  nextCursor?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Batch scheduling result
 */
export interface BatchScheduleResult {
  /** Successfully scheduled messages */
  successful: ScheduledMessage[];
  /** Failed scheduling attempts */
  failed: Array<{
    channelId: string;
    text: string;
    error: string;
  }>;
}

/**
 * Time specification for scheduling tomorrow
 */
export interface TimeSpec {
  /** Hour in 24-hour format (0-23) */
  hour: number;
  /** Minute (0-59), defaults to 0 */
  minute?: number;
}

// =============================================================================
// Slack API Response Types
// =============================================================================

interface SlackScheduleMessageResponse {
  ok: boolean;
  error?: string;
  channel?: string;
  scheduled_message_id?: string;
  post_at?: number;
}

interface SlackScheduledMessagesListResponse {
  ok: boolean;
  error?: string;
  scheduled_messages?: SlackScheduledMessage[];
  response_metadata?: {
    next_cursor?: string;
  };
}

interface SlackDeleteScheduledMessageResponse {
  ok: boolean;
  error?: string;
}

// =============================================================================
// Slack Client Interface
// =============================================================================

interface SlackChatClient {
  chat: {
    scheduleMessage: (params: {
      channel: string;
      text?: string;
      post_at: number;
      blocks?: Block[];
      thread_ts?: string;
      parse?: string;
      link_names?: boolean;
      unfurl_links?: boolean;
      unfurl_media?: boolean;
      reply_broadcast?: boolean;
      metadata?: {
        event_type: string;
        event_payload: Record<string, unknown>;
      };
    }) => Promise<SlackScheduleMessageResponse>;
    scheduledMessages: {
      list: (params: {
        channel?: string;
        cursor?: string;
        limit?: number;
        oldest?: number;
        latest?: number;
        team_id?: string;
      }) => Promise<SlackScheduledMessagesListResponse>;
    };
    deleteScheduledMessage: (params: {
      channel: string;
      scheduled_message_id: string;
    }) => Promise<SlackDeleteScheduledMessageResponse>;
  };
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when scheduled message operations fail
 */
export class ScheduledMessageError extends Error {
  /** Slack API error code */
  public readonly code: string;
  /** Original error details */
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ScheduledMessageError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ScheduledMessageError.prototype);
  }
}

/**
 * Error thrown when scheduled time is invalid
 */
export class InvalidScheduleTimeError extends ScheduledMessageError {
  constructor(message: string) {
    super(message, 'invalid_schedule_time');
    this.name = 'InvalidScheduleTimeError';
    Object.setPrototypeOf(this, InvalidScheduleTimeError.prototype);
  }
}

/**
 * Error thrown when scheduled message is not found
 */
export class ScheduledMessageNotFoundError extends ScheduledMessageError {
  constructor(scheduledMessageId: string) {
    super(`Scheduled message not found: ${scheduledMessageId}`, 'scheduled_message_not_found');
    this.name = 'ScheduledMessageNotFoundError';
    Object.setPrototypeOf(this, ScheduledMessageNotFoundError.prototype);
  }
}

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * Mock WebClient for testing or when Slack SDK is unavailable
 */
class MockChatClient implements SlackChatClient {
  chat = {
    scheduleMessage: async (_params: {
      channel: string;
      text?: string;
      post_at: number;
      blocks?: Block[];
      thread_ts?: string;
    }): Promise<SlackScheduleMessageResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    scheduledMessages: {
      list: async (_params: {
        channel?: string;
        cursor?: string;
        limit?: number;
      }): Promise<SlackScheduledMessagesListResponse> => ({
        ok: false,
        error: 'slack_api_unavailable',
      }),
    },
    deleteScheduledMessage: async (_params: {
      channel: string;
      scheduled_message_id: string;
    }): Promise<SlackDeleteScheduledMessageResponse> => ({
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
 */
async function createSlackClient(token: string): Promise<SlackChatClient> {
  try {
    const slack = await import('@slack/web-api');
    return new slack.WebClient(token) as unknown as SlackChatClient;
  } catch {
    // Slack SDK not available, use mock
    return new MockChatClient();
  }
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for ScheduledMessagesManager
 */
export interface ScheduledMessagesConfig {
  /** Slack user token (xoxp-... or xoxb-...) */
  token: string;
  /** Optional: Pre-configured WebClient instance */
  client?: SlackChatClient;
  /** Optional: Enable debug logging */
  debug?: boolean;
  /** Optional: Default timezone for scheduling (IANA format) */
  defaultTimezone?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert Date to Unix timestamp (seconds)
 */
function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to Date
 */
function unixTimestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Validate that a scheduled time is in the future
 */
function validateScheduleTime(postAt: Date): void {
  const now = new Date();
  // Slack requires at least 1 second in the future (we use 10 seconds buffer)
  const minScheduleTime = new Date(now.getTime() + 10 * 1000);

  if (postAt < minScheduleTime) {
    throw new InvalidScheduleTimeError(
      'Scheduled time must be at least 10 seconds in the future. ' +
        `Provided: ${postAt.toISOString()}, Current: ${now.toISOString()}`,
    );
  }

  // Slack has a maximum schedule time of 120 days
  const maxScheduleTime = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  if (postAt > maxScheduleTime) {
    throw new InvalidScheduleTimeError(
      'Scheduled time cannot be more than 120 days in the future. ' +
        `Provided: ${postAt.toISOString()}`,
    );
  }
}

/**
 * Transform raw Slack scheduled message to our format
 */
function transformScheduledMessage(raw: SlackScheduledMessage): ScheduledMessage {
  return {
    id: raw.id,
    channelId: raw.channel_id,
    postAt: unixTimestampToDate(raw.post_at),
    text: raw.text,
    dateCreated: unixTimestampToDate(raw.date_created),
  };
}

// =============================================================================
// ScheduledMessagesManager Class
// =============================================================================

/**
 * Manages scheduled message operations for Orchestrator agents in Slack.
 *
 * This class provides comprehensive scheduled messaging capabilities including:
 * - Scheduling messages for future delivery
 * - Scheduling rich Block Kit messages
 * - Scheduling thread replies
 * - Listing pending scheduled messages
 * - Deleting/canceling scheduled messages
 * - Convenience methods for common scheduling patterns
 *
 * @example
 * ```typescript
 * import { ScheduledMessagesManager } from '@wundr/slack-agent/capabilities/scheduled-messages';
 *
 * const scheduler = new ScheduledMessagesManager({
 *   token: process.env.SLACK_USER_TOKEN!,
 * });
 *
 * // Schedule a message for 30 minutes from now
 * const scheduled = await scheduler.scheduleInMinutes('C123ABC', 'Reminder: standup in 5 min!', 30);
 *
 * // Schedule a message for tomorrow at 9am
 * const morning = await scheduler.scheduleTomorrow('C123ABC', 'Good morning team!', { hour: 9 });
 *
 * // List all scheduled messages
 * const pending = await scheduler.listScheduledMessages();
 * ```
 */
export class ScheduledMessagesManager {
  private client: SlackChatClient | null = null;
  private readonly config: ScheduledMessagesConfig;
  private initPromise: Promise<void>;

  /**
   * Creates a new ScheduledMessagesManager instance
   *
   * @param config - Configuration options
   */
  constructor(config: ScheduledMessagesConfig) {
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
  private async getClient(): Promise<SlackChatClient> {
    await this.initPromise;
    if (!this.client) {
      throw new ScheduledMessageError('Slack client not initialized', 'client_not_initialized');
    }
    return this.client;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ScheduledMessagesManager] ${message}`, ...args);
    }
  }

  /**
   * Handle API response errors
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof ScheduledMessageError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      (error as { code?: string })?.code ||
      (error as { data?: { error?: string } })?.data?.error ||
      'unknown_error';

    throw new ScheduledMessageError(`Failed to ${operation}: ${errorMessage}`, errorCode, error);
  }

  // ===========================================================================
  // Core Scheduling Methods
  // ===========================================================================

  /**
   * Schedule a text message for future delivery
   *
   * @param channelId - Channel ID where the message will be posted
   * @param text - Message text content
   * @param postAt - Date/time when the message should be posted
   * @param options - Additional scheduling options
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
   * const scheduled = await scheduler.scheduleMessage(
   *   'C123ABC456',
   *   'Reminder: Team meeting in 15 minutes!',
   *   futureTime
   * );
   * console.log(`Message scheduled for ${scheduled.postAt.toISOString()}`);
   * ```
   */
  async scheduleMessage(
    channelId: string,
    text: string,
    postAt: Date,
    options?: ScheduleMessageOptions,
  ): Promise<ScheduledMessage> {
    try {
      this.debug('Scheduling message', { channelId, postAt: postAt.toISOString() });

      validateScheduleTime(postAt);

      const client = await this.getClient();
      const postAtTimestamp = dateToUnixTimestamp(postAt);

      const response = await client.chat.scheduleMessage({
        channel: channelId,
        text,
        post_at: postAtTimestamp,
        thread_ts: options?.threadTs,
        blocks: options?.blocks,
        parse: options?.parse,
        link_names: options?.linkNames,
        unfurl_links: options?.unfurlLinks,
        unfurl_media: options?.unfurlMedia,
        reply_broadcast: options?.replyBroadcast,
        metadata: options?.metadata,
      });

      if (!response.ok) {
        throw new ScheduledMessageError(
          `Failed to schedule message: ${response.error}`,
          response.error || 'schedule_message_failed',
        );
      }

      if (!response.scheduled_message_id) {
        throw new ScheduledMessageError(
          'No scheduled message ID returned',
          'no_scheduled_message_id',
        );
      }

      const scheduledMessage: ScheduledMessage = {
        id: response.scheduled_message_id,
        channelId: response.channel || channelId,
        postAt: response.post_at ? unixTimestampToDate(response.post_at) : postAt,
        text,
        dateCreated: new Date(),
        threadTs: options?.threadTs,
        blocks: options?.blocks,
      };

      this.debug('Message scheduled successfully', { id: scheduledMessage.id });
      return scheduledMessage;
    } catch (error) {
      this.handleError(error, 'schedule message');
    }
  }

  /**
   * Schedule a Block Kit message for future delivery
   *
   * @param channelId - Channel ID where the message will be posted
   * @param blocks - Block Kit blocks
   * @param postAt - Date/time when the message should be posted
   * @param text - Fallback text for notifications (recommended)
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * const blocks = [
   *   {
   *     type: 'section',
   *     text: { type: 'mrkdwn', text: '*Daily Standup Reminder*' }
   *   },
   *   {
   *     type: 'section',
   *     text: { type: 'mrkdwn', text: 'Please post your updates in #standup' }
   *   }
   * ];
   *
   * const scheduled = await scheduler.scheduleBlockMessage(
   *   'C123ABC456',
   *   blocks,
   *   new Date('2024-01-15T09:00:00'),
   *   'Daily Standup Reminder'
   * );
   * ```
   */
  async scheduleBlockMessage(
    channelId: string,
    blocks: Block[],
    postAt: Date,
    text?: string,
  ): Promise<ScheduledMessage> {
    return this.scheduleMessage(channelId, text || '', postAt, { blocks });
  }

  /**
   * Schedule a thread reply for future delivery
   *
   * @param channelId - Channel ID containing the thread
   * @param threadTs - Thread parent message timestamp
   * @param text - Reply text content
   * @param postAt - Date/time when the reply should be posted
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * const scheduled = await scheduler.scheduleThreadReply(
   *   'C123ABC456',
   *   '1234567890.123456',
   *   'Follow-up: The task is now complete!',
   *   new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
   * );
   * ```
   */
  async scheduleThreadReply(
    channelId: string,
    threadTs: string,
    text: string,
    postAt: Date,
  ): Promise<ScheduledMessage> {
    return this.scheduleMessage(channelId, text, postAt, { threadTs });
  }

  // ===========================================================================
  // List and Query Methods
  // ===========================================================================

  /**
   * List scheduled messages
   *
   * @param channelId - Optional channel ID to filter by
   * @returns Array of scheduled messages
   *
   * @example
   * ```typescript
   * // List all scheduled messages
   * const all = await scheduler.listScheduledMessages();
   *
   * // List scheduled messages for a specific channel
   * const channelMessages = await scheduler.listScheduledMessages('C123ABC456');
   * ```
   */
  async listScheduledMessages(channelId?: string): Promise<ScheduledMessage[]> {
    try {
      this.debug('Listing scheduled messages', channelId ? { channelId } : 'all');

      const client = await this.getClient();
      const allMessages: ScheduledMessage[] = [];
      let cursor: string | undefined;

      do {
        const response = await client.chat.scheduledMessages.list({
          channel: channelId,
          cursor,
          limit: 100,
        });

        if (!response.ok) {
          throw new ScheduledMessageError(
            `Failed to list scheduled messages: ${response.error}`,
            response.error || 'list_scheduled_messages_failed',
          );
        }

        if (response.scheduled_messages) {
          const transformed = response.scheduled_messages.map(transformScheduledMessage);
          allMessages.push(...transformed);
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      this.debug('Listed scheduled messages', { count: allMessages.length });
      return allMessages;
    } catch (error) {
      this.handleError(error, 'list scheduled messages');
    }
  }

  /**
   * List scheduled messages with pagination support
   *
   * @param options - Listing options including pagination
   * @returns Paginated scheduled messages response
   *
   * @example
   * ```typescript
   * const result = await scheduler.listScheduledMessagesPaginated({
   *   channelId: 'C123ABC456',
   *   limit: 20,
   * });
   *
   * console.log(`Found ${result.messages.length} messages`);
   * if (result.hasMore) {
   *   const nextPage = await scheduler.listScheduledMessagesPaginated({
   *     cursor: result.nextCursor,
   *   });
   * }
   * ```
   */
  async listScheduledMessagesPaginated(
    options?: ListScheduledMessagesOptions,
  ): Promise<PaginatedScheduledMessages> {
    try {
      this.debug('Listing scheduled messages (paginated)', options);

      const client = await this.getClient();

      const response = await client.chat.scheduledMessages.list({
        channel: options?.channelId,
        cursor: options?.cursor,
        limit: options?.limit || 100,
        oldest: options?.oldest ? dateToUnixTimestamp(options.oldest) : undefined,
        latest: options?.latest ? dateToUnixTimestamp(options.latest) : undefined,
        team_id: options?.teamId,
      });

      if (!response.ok) {
        throw new ScheduledMessageError(
          `Failed to list scheduled messages: ${response.error}`,
          response.error || 'list_scheduled_messages_failed',
        );
      }

      const messages = (response.scheduled_messages || []).map(transformScheduledMessage);
      const nextCursor = response.response_metadata?.next_cursor;

      return {
        messages,
        nextCursor,
        hasMore: !!nextCursor,
      };
    } catch (error) {
      this.handleError(error, 'list scheduled messages (paginated)');
    }
  }

  // ===========================================================================
  // Delete Methods
  // ===========================================================================

  /**
   * Delete/cancel a scheduled message
   *
   * @param channelId - Channel ID where the message was scheduled
   * @param scheduledMessageId - The scheduled message ID to delete
   *
   * @example
   * ```typescript
   * await scheduler.deleteScheduledMessage('C123ABC456', 'Q1234567890');
   * console.log('Scheduled message canceled');
   * ```
   */
  async deleteScheduledMessage(channelId: string, scheduledMessageId: string): Promise<void> {
    try {
      this.debug('Deleting scheduled message', { channelId, scheduledMessageId });

      const client = await this.getClient();

      const response = await client.chat.deleteScheduledMessage({
        channel: channelId,
        scheduled_message_id: scheduledMessageId,
      });

      if (!response.ok) {
        if (response.error === 'invalid_scheduled_message_id') {
          throw new ScheduledMessageNotFoundError(scheduledMessageId);
        }
        throw new ScheduledMessageError(
          `Failed to delete scheduled message: ${response.error}`,
          response.error || 'delete_scheduled_message_failed',
        );
      }

      this.debug('Scheduled message deleted successfully');
    } catch (error) {
      this.handleError(error, 'delete scheduled message');
    }
  }

  /**
   * Delete all scheduled messages for a channel
   *
   * @param channelId - Channel ID to clear scheduled messages from
   * @returns Number of messages deleted
   *
   * @example
   * ```typescript
   * const count = await scheduler.deleteAllScheduledMessages('C123ABC456');
   * console.log(`Deleted ${count} scheduled messages`);
   * ```
   */
  async deleteAllScheduledMessages(channelId: string): Promise<number> {
    const messages = await this.listScheduledMessages(channelId);
    let deletedCount = 0;

    for (const message of messages) {
      try {
        await this.deleteScheduledMessage(message.channelId, message.id);
        deletedCount++;
      } catch (error) {
        this.debug('Failed to delete scheduled message', {
          id: message.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return deletedCount;
  }

  // ===========================================================================
  // Convenience Scheduling Methods
  // ===========================================================================

  /**
   * Schedule a message to be sent in a specified number of minutes
   *
   * @param channelId - Channel ID where the message will be posted
   * @param text - Message text content
   * @param minutes - Number of minutes from now
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * // Schedule a message for 30 minutes from now
   * const scheduled = await scheduler.scheduleInMinutes(
   *   'C123ABC456',
   *   'Time to take a break!',
   *   30
   * );
   * ```
   */
  async scheduleInMinutes(
    channelId: string,
    text: string,
    minutes: number,
  ): Promise<ScheduledMessage> {
    if (minutes <= 0) {
      throw new InvalidScheduleTimeError('Minutes must be a positive number');
    }

    const postAt = new Date(Date.now() + minutes * 60 * 1000);
    return this.scheduleMessage(channelId, text, postAt);
  }

  /**
   * Schedule a message to be sent in a specified number of hours
   *
   * @param channelId - Channel ID where the message will be posted
   * @param text - Message text content
   * @param hours - Number of hours from now
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * // Schedule a message for 2 hours from now
   * const scheduled = await scheduler.scheduleInHours(
   *   'C123ABC456',
   *   'Reminder: Submit your weekly report',
   *   2
   * );
   * ```
   */
  async scheduleInHours(channelId: string, text: string, hours: number): Promise<ScheduledMessage> {
    if (hours <= 0) {
      throw new InvalidScheduleTimeError('Hours must be a positive number');
    }

    const postAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return this.scheduleMessage(channelId, text, postAt);
  }

  /**
   * Schedule a message for tomorrow at a specific time
   *
   * @param channelId - Channel ID where the message will be posted
   * @param text - Message text content
   * @param time - Time specification with hour (0-23) and optional minute (0-59)
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * // Schedule for tomorrow at 9:00 AM
   * const scheduled = await scheduler.scheduleTomorrow(
   *   'C123ABC456',
   *   'Good morning! Here is your daily brief.',
   *   { hour: 9 }
   * );
   *
   * // Schedule for tomorrow at 2:30 PM
   * const afternoon = await scheduler.scheduleTomorrow(
   *   'C123ABC456',
   *   'Reminder: Team sync in 30 minutes',
   *   { hour: 14, minute: 30 }
   * );
   * ```
   */
  async scheduleTomorrow(
    channelId: string,
    text: string,
    time: TimeSpec,
  ): Promise<ScheduledMessage> {
    if (time.hour < 0 || time.hour > 23) {
      throw new InvalidScheduleTimeError('Hour must be between 0 and 23');
    }

    const minute = time.minute ?? 0;
    if (minute < 0 || minute > 59) {
      throw new InvalidScheduleTimeError('Minute must be between 0 and 59');
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(time.hour, minute, 0, 0);

    return this.scheduleMessage(channelId, text, tomorrow);
  }

  /**
   * Schedule a message for a specific day at a specific time
   *
   * @param channelId - Channel ID where the message will be posted
   * @param text - Message text content
   * @param date - Target date
   * @param time - Time specification with hour (0-23) and optional minute (0-59)
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * // Schedule for Monday, January 15th at 10:00 AM
   * const scheduled = await scheduler.scheduleForDate(
   *   'C123ABC456',
   *   'Weekly planning reminder',
   *   new Date('2024-01-15'),
   *   { hour: 10 }
   * );
   * ```
   */
  async scheduleForDate(
    channelId: string,
    text: string,
    date: Date,
    time: TimeSpec,
  ): Promise<ScheduledMessage> {
    if (time.hour < 0 || time.hour > 23) {
      throw new InvalidScheduleTimeError('Hour must be between 0 and 23');
    }

    const minute = time.minute ?? 0;
    if (minute < 0 || minute > 59) {
      throw new InvalidScheduleTimeError('Minute must be between 0 and 59');
    }

    const postAt = new Date(date);
    postAt.setHours(time.hour, minute, 0, 0);

    return this.scheduleMessage(channelId, text, postAt);
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  /**
   * Schedule the same message to multiple channels
   *
   * @param channelIds - Array of channel IDs
   * @param text - Message text content
   * @param postAt - Date/time when the messages should be posted
   * @returns Batch result with successful and failed operations
   *
   * @example
   * ```typescript
   * const result = await scheduler.scheduleToMultipleChannels(
   *   ['C123ABC456', 'C789DEF012', 'C345GHI678'],
   *   'Company-wide announcement: Office closed on Monday',
   *   new Date('2024-01-14T17:00:00')
   * );
   *
   * console.log(`Successfully scheduled to ${result.successful.length} channels`);
   * if (result.failed.length > 0) {
   *   console.log(`Failed to schedule to ${result.failed.length} channels`);
   * }
   * ```
   */
  async scheduleToMultipleChannels(
    channelIds: string[],
    text: string,
    postAt: Date,
  ): Promise<BatchScheduleResult> {
    const result: BatchScheduleResult = {
      successful: [],
      failed: [],
    };

    for (const channelId of channelIds) {
      try {
        const scheduled = await this.scheduleMessage(channelId, text, postAt);
        result.successful.push(scheduled);
      } catch (error) {
        result.failed.push({
          channelId,
          text,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.debug('Batch scheduling complete', {
      successful: result.successful.length,
      failed: result.failed.length,
    });

    return result;
  }

  /**
   * Schedule multiple different messages at once
   *
   * @param messages - Array of message specifications
   * @returns Batch result with successful and failed operations
   *
   * @example
   * ```typescript
   * const result = await scheduler.scheduleBatch([
   *   { channelId: 'C123ABC', text: 'Morning standup in 5!', postAt: new Date('2024-01-15T09:55:00') },
   *   { channelId: 'C456DEF', text: 'EOD report reminder', postAt: new Date('2024-01-15T16:30:00') },
   *   { channelId: 'C789GHI', text: 'Weekly sync starts soon', postAt: new Date('2024-01-15T14:55:00') },
   * ]);
   * ```
   */
  async scheduleBatch(
    messages: Array<{
      channelId: string;
      text: string;
      postAt: Date;
      options?: ScheduleMessageOptions;
    }>,
  ): Promise<BatchScheduleResult> {
    const result: BatchScheduleResult = {
      successful: [],
      failed: [],
    };

    for (const message of messages) {
      try {
        const scheduled = await this.scheduleMessage(
          message.channelId,
          message.text,
          message.postAt,
          message.options,
        );
        result.successful.push(scheduled);
      } catch (error) {
        result.failed.push({
          channelId: message.channelId,
          text: message.text,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.debug('Batch scheduling complete', {
      successful: result.successful.length,
      failed: result.failed.length,
    });

    return result;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Check if a scheduled message exists
   *
   * @param scheduledMessageId - The scheduled message ID to check
   * @returns True if the message exists and is still scheduled
   *
   * @example
   * ```typescript
   * const exists = await scheduler.isScheduled('Q1234567890');
   * if (exists) {
   *   console.log('Message is still scheduled');
   * }
   * ```
   */
  async isScheduled(scheduledMessageId: string): Promise<boolean> {
    const messages = await this.listScheduledMessages();
    return messages.some((m) => m.id === scheduledMessageId);
  }

  /**
   * Get a scheduled message by ID
   *
   * @param scheduledMessageId - The scheduled message ID
   * @returns The scheduled message or undefined if not found
   *
   * @example
   * ```typescript
   * const message = await scheduler.getScheduledMessage('Q1234567890');
   * if (message) {
   *   console.log(`Message scheduled for ${message.postAt.toISOString()}`);
   * }
   * ```
   */
  async getScheduledMessage(scheduledMessageId: string): Promise<ScheduledMessage | undefined> {
    const messages = await this.listScheduledMessages();
    return messages.find((m) => m.id === scheduledMessageId);
  }

  /**
   * Get the count of scheduled messages for a channel
   *
   * @param channelId - Optional channel ID to filter by
   * @returns Number of scheduled messages
   *
   * @example
   * ```typescript
   * const totalCount = await scheduler.getScheduledCount();
   * const channelCount = await scheduler.getScheduledCount('C123ABC456');
   * ```
   */
  async getScheduledCount(channelId?: string): Promise<number> {
    const messages = await this.listScheduledMessages(channelId);
    return messages.length;
  }

  /**
   * Get scheduled messages due within a time window
   *
   * @param windowMinutes - Minutes from now to look ahead
   * @param channelId - Optional channel ID to filter by
   * @returns Array of scheduled messages due within the window
   *
   * @example
   * ```typescript
   * // Get messages scheduled for the next hour
   * const upcoming = await scheduler.getUpcomingMessages(60);
   * ```
   */
  async getUpcomingMessages(
    windowMinutes: number,
    channelId?: string,
  ): Promise<ScheduledMessage[]> {
    const messages = await this.listScheduledMessages(channelId);
    const now = Date.now();
    const windowEnd = now + windowMinutes * 60 * 1000;

    return messages.filter((m) => {
      const postAtMs = m.postAt.getTime();
      return postAtMs >= now && postAtMs <= windowEnd;
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a ScheduledMessagesManager instance
 *
 * @param config - Configuration options or just a token string
 * @returns Configured ScheduledMessagesManager instance
 *
 * @example
 * ```typescript
 * // With token only
 * const scheduler = createScheduledMessagesManager(process.env.SLACK_USER_TOKEN!);
 *
 * // With full config
 * const scheduler = createScheduledMessagesManager({
 *   token: process.env.SLACK_USER_TOKEN!,
 *   debug: true,
 * });
 * ```
 */
export function createScheduledMessagesManager(
  config: ScheduledMessagesConfig | string,
): ScheduledMessagesManager {
  if (typeof config === 'string') {
    return new ScheduledMessagesManager({ token: config });
  }
  return new ScheduledMessagesManager(config);
}

/**
 * Create a ScheduledMessagesManager from environment variables
 *
 * Looks for SLACK_USER_TOKEN or SLACK_BOT_TOKEN environment variable.
 *
 * @param debug - Optional: Enable debug logging
 * @returns Configured ScheduledMessagesManager instance
 * @throws Error if no token is found in environment
 *
 * @example
 * ```typescript
 * const scheduler = createScheduledMessagesManagerFromEnv();
 * ```
 */
export function createScheduledMessagesManagerFromEnv(debug?: boolean): ScheduledMessagesManager {
  const token = process.env.SLACK_USER_TOKEN || process.env.SLACK_BOT_TOKEN;

  if (!token) {
    throw new Error(
      'No Slack token found in environment. Set SLACK_USER_TOKEN or SLACK_BOT_TOKEN.',
    );
  }

  return new ScheduledMessagesManager({ token, debug });
}

// =============================================================================
// Default Export
// =============================================================================

export default ScheduledMessagesManager;
