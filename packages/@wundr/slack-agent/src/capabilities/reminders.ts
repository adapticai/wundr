/**
 * @wundr/slack-agent - Reminders Capability
 *
 * Provides comprehensive reminder management for VP (Virtual Principal) agents
 * operating as full users in Slack workspaces. Enables creating, listing,
 * completing, and deleting reminders just like any human user using /remind.
 *
 * @packageDocumentation
 */

import { WebClient } from '@slack/web-api';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Represents a Slack reminder
 */
export interface Reminder {
  /** Unique identifier for the reminder */
  id: string;
  /** User ID who created the reminder */
  creator: string;
  /** User ID who will receive the reminder (can be same as creator) */
  user: string;
  /** The reminder text/message */
  text: string;
  /** Unix timestamp when the reminder was completed (null if not completed) */
  completeTs: number | null;
  /** Unix timestamp when the reminder is scheduled to trigger */
  time: number;
  /** Channel ID if the reminder is for a channel (null for personal reminders) */
  channel: string | null;
}

/**
 * Duration specification for reminder operations
 */
export interface ReminderDuration {
  /** Number of days to add */
  days?: number;
  /** Number of hours to add */
  hours?: number;
  /** Number of minutes to add */
  minutes?: number;
}

/**
 * Configuration options for ReminderManager
 */
export interface ReminderManagerConfig {
  /** Authenticated Slack WebClient instance */
  client: WebClient;
  /** Optional: Enable debug logging */
  debug?: boolean;
}

/**
 * Response structure for reminders.add API
 */
interface RemindersAddResponse {
  ok: boolean;
  error?: string;
  reminder?: {
    id: string;
    creator: string;
    user: string;
    text: string;
    recurring: boolean;
    time: number;
    complete_ts: number;
  };
}

/**
 * Response structure for reminders.list API
 */
interface RemindersListResponse {
  ok: boolean;
  error?: string;
  reminders?: Array<{
    id: string;
    creator: string;
    user: string;
    text: string;
    recurring: boolean;
    time: number;
    complete_ts: number;
    channel?: string;
  }>;
}

/**
 * Response structure for reminders.info API
 */
interface RemindersInfoResponse {
  ok: boolean;
  error?: string;
  reminder?: {
    id: string;
    creator: string;
    user: string;
    text: string;
    recurring: boolean;
    time: number;
    complete_ts: number;
    channel?: string;
  };
}

/**
 * Response structure for reminders.complete API
 */
interface RemindersCompleteResponse {
  ok: boolean;
  error?: string;
}

/**
 * Response structure for reminders.delete API
 */
interface RemindersDeleteResponse {
  ok: boolean;
  error?: string;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when reminder operations fail
 */
export class ReminderError extends Error {
  /** Slack API error code */
  public readonly code: string;
  /** Original error details */
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ReminderError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ReminderError.prototype);
  }
}

/**
 * Error thrown when a reminder is not found
 */
export class ReminderNotFoundError extends ReminderError {
  public readonly reminderId: string;

  constructor(reminderId: string) {
    super(`Reminder not found: ${reminderId}`, 'not_found');
    this.name = 'ReminderNotFoundError';
    this.reminderId = reminderId;
    Object.setPrototypeOf(this, ReminderNotFoundError.prototype);
  }
}

/**
 * Error thrown when a user is not found
 */
export class ReminderUserNotFoundError extends ReminderError {
  public readonly userId: string;

  constructor(userId: string) {
    super(`User not found: ${userId}`, 'user_not_found');
    this.name = 'ReminderUserNotFoundError';
    this.userId = userId;
    Object.setPrototypeOf(this, ReminderUserNotFoundError.prototype);
  }
}

/**
 * Error thrown when a channel is not found
 */
export class ReminderChannelNotFoundError extends ReminderError {
  public readonly channelId: string;

  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`, 'channel_not_found');
    this.name = 'ReminderChannelNotFoundError';
    this.channelId = channelId;
    Object.setPrototypeOf(this, ReminderChannelNotFoundError.prototype);
  }
}

/**
 * Error thrown when the reminder time is invalid
 */
export class InvalidReminderTimeError extends ReminderError {
  constructor(message: string = 'Invalid reminder time') {
    super(message, 'invalid_time');
    this.name = 'InvalidReminderTimeError';
    Object.setPrototypeOf(this, InvalidReminderTimeError.prototype);
  }
}

// =============================================================================
// ReminderManager Class
// =============================================================================

/**
 * Manages reminders for the Slack VP agent.
 *
 * This class provides methods for the VP agent to:
 * - Create reminders for self, other users, or channels
 * - List all pending reminders
 * - Mark reminders as complete
 * - Delete reminders
 * - Get detailed information about specific reminders
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { ReminderManager } from '@wundr/slack-agent/capabilities/reminders';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const reminders = new ReminderManager({ client });
 *
 * // Create a reminder for yourself in 30 minutes
 * await reminders.remindMeIn('Check deployment status', { minutes: 30 });
 *
 * // Create a reminder for a team member
 * await reminders.remindUserIn('U123ABC456', 'Review the PR', { hours: 2 });
 *
 * // List all pending reminders
 * const allReminders = await reminders.listReminders();
 * console.log(`You have ${allReminders.length} pending reminders`);
 * ```
 */
export class ReminderManager {
  private readonly client: WebClient;
  private readonly debug: boolean;

  /**
   * Creates a new ReminderManager instance
   *
   * @param config - Configuration options
   */
  constructor(config: ReminderManagerConfig) {
    this.client = config.client;
    this.debug = config.debug ?? false;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ReminderManager] ${message}`, ...args);
    }
  }

  /**
   * Handle API response errors
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof ReminderError) {
      throw error;
    }

    const slackError = error as {
      code?: string;
      data?: { error?: string };
      message?: string;
    };

    const errorCode =
      slackError?.code || slackError?.data?.error || 'unknown_error';
    const errorMessage =
      slackError?.message || `${operation} failed: ${errorCode}`;

    // Map specific Slack error codes to custom error types
    switch (errorCode) {
      case 'not_found':
      case 'reminder_not_found':
        throw new ReminderNotFoundError('unknown');
      case 'user_not_found':
        throw new ReminderUserNotFoundError('unknown');
      case 'channel_not_found':
        throw new ReminderChannelNotFoundError('unknown');
      case 'cannot_parse':
      case 'invalid_time':
        throw new InvalidReminderTimeError(errorMessage);
      default:
        throw new ReminderError(errorMessage, errorCode, error);
    }
  }

  /**
   * Map Slack API reminder response to Reminder type
   */
  private mapReminder(reminder: {
    id: string;
    creator: string;
    user: string;
    text: string;
    time: number;
    complete_ts: number;
    channel?: string;
  }): Reminder {
    return {
      id: reminder.id,
      creator: reminder.creator,
      user: reminder.user,
      text: reminder.text,
      completeTs: reminder.complete_ts > 0 ? reminder.complete_ts : null,
      time: reminder.time,
      channel: reminder.channel ?? null,
    };
  }

  /**
   * Convert time to a Unix timestamp
   * Accepts Date objects, Unix timestamps (number), or natural language strings
   */
  private parseTime(time: Date | string | number): string {
    if (time instanceof Date) {
      return Math.floor(time.getTime() / 1000).toString();
    }
    if (typeof time === 'number') {
      return time.toString();
    }
    // For string inputs, pass directly to Slack API which handles natural language
    return time;
  }

  /**
   * Calculate a future timestamp from a duration
   */
  private calculateFutureTime(duration: ReminderDuration): number {
    const now = Date.now();
    const days = duration.days ?? 0;
    const hours = duration.hours ?? 0;
    const minutes = duration.minutes ?? 0;

    const totalMs =
      days * 24 * 60 * 60 * 1000 +
      hours * 60 * 60 * 1000 +
      minutes * 60 * 1000;

    if (totalMs <= 0) {
      throw new InvalidReminderTimeError(
        'Duration must be greater than 0',
      );
    }

    return Math.floor((now + totalMs) / 1000);
  }

  // ===========================================================================
  // Core Reminder Operations
  // ===========================================================================

  /**
   * Create a reminder for self or another user
   *
   * @param text - The reminder text/message
   * @param time - When to trigger the reminder (Date, Unix timestamp, or natural language)
   * @param userId - Optional user ID to remind (defaults to self)
   * @returns The created reminder
   * @throws {ReminderError} If the reminder cannot be created
   *
   * @example
   * ```typescript
   * // Remind yourself at a specific time
   * const reminder = await reminders.createReminder(
   *   'Team standup meeting',
   *   new Date('2024-01-15T09:00:00')
   * );
   *
   * // Remind yourself using natural language
   * const reminder = await reminders.createReminder(
   *   'Check emails',
   *   'tomorrow at 9am'
   * );
   *
   * // Remind another user
   * const reminder = await reminders.createReminder(
   *   'Please review the PR',
   *   'in 2 hours',
   *   'U123ABC456'
   * );
   * ```
   */
  async createReminder(
    text: string,
    time: Date | string,
    userId?: string,
  ): Promise<Reminder> {
    try {
      this.log(
        `Creating reminder: "${text}" at ${time}`,
        userId ? `for user ${userId}` : 'for self',
      );

      const params: { text: string; time: string; user?: string } = {
        text,
        time: this.parseTime(time),
      };

      if (userId) {
        params.user = userId;
      }

      const response = (await this.client.reminders.add(
        params,
      )) as RemindersAddResponse;

      if (!response.ok || !response.reminder) {
        throw new ReminderError(
          `Failed to create reminder: ${response.error}`,
          response.error || 'create_reminder_failed',
        );
      }

      this.log('Reminder created successfully:', response.reminder.id);
      return this.mapReminder(response.reminder);
    } catch (error) {
      this.handleError(error, 'create reminder');
    }
  }

  /**
   * Create a reminder for a channel
   *
   * @param text - The reminder text/message
   * @param time - When to trigger the reminder (Date, Unix timestamp, or natural language)
   * @param channelId - The channel ID to post the reminder to
   * @returns The created reminder
   * @throws {ReminderError} If the reminder cannot be created
   *
   * @example
   * ```typescript
   * // Post a reminder to a channel
   * const reminder = await reminders.createChannelReminder(
   *   'Weekly report due!',
   *   new Date('2024-01-15T17:00:00'),
   *   'C123ABC456'
   * );
   * ```
   */
  async createChannelReminder(
    text: string,
    time: Date | string,
    channelId: string,
  ): Promise<Reminder> {
    try {
      this.log(`Creating channel reminder: "${text}" for channel ${channelId}`);

      // For channel reminders, we format the text with the channel mention
      // Slack's reminders.add API doesn't directly support channel parameter
      // but we can mention the channel in the reminder text
      const channelText = `Reminder for <#${channelId}>: ${text}`;

      const response = (await this.client.reminders.add({
        text: channelText,
        time: this.parseTime(time),
      })) as RemindersAddResponse;

      if (!response.ok || !response.reminder) {
        throw new ReminderError(
          `Failed to create channel reminder: ${response.error}`,
          response.error || 'create_channel_reminder_failed',
        );
      }

      this.log('Channel reminder created successfully:', response.reminder.id);

      // Map the reminder but set the channel field
      const reminder = this.mapReminder(response.reminder);
      reminder.channel = channelId;
      return reminder;
    } catch (error) {
      this.handleError(error, 'create channel reminder');
    }
  }

  /**
   * List all reminders for the authenticated user
   *
   * @returns Array of all reminders (both complete and incomplete)
   * @throws {ReminderError} If the list cannot be retrieved
   *
   * @example
   * ```typescript
   * const allReminders = await reminders.listReminders();
   *
   * // Filter for pending reminders
   * const pending = allReminders.filter(r => r.completeTs === null);
   * console.log(`You have ${pending.length} pending reminders`);
   *
   * // Filter for completed reminders
   * const completed = allReminders.filter(r => r.completeTs !== null);
   * ```
   */
  async listReminders(): Promise<Reminder[]> {
    try {
      this.log('Listing all reminders');

      const response =
        (await this.client.reminders.list()) as RemindersListResponse;

      if (!response.ok) {
        throw new ReminderError(
          `Failed to list reminders: ${response.error}`,
          response.error || 'list_reminders_failed',
        );
      }

      const reminders = (response.reminders || []).map((r) =>
        this.mapReminder(r),
      );
      this.log(`Found ${reminders.length} reminders`);
      return reminders;
    } catch (error) {
      this.handleError(error, 'list reminders');
    }
  }

  /**
   * Mark a reminder as complete
   *
   * @param reminderId - The ID of the reminder to complete
   * @throws {ReminderNotFoundError} If the reminder is not found
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * await reminders.completeReminder('Rm123ABC456');
   * console.log('Reminder marked as complete');
   * ```
   */
  async completeReminder(reminderId: string): Promise<void> {
    try {
      this.log(`Completing reminder: ${reminderId}`);

      const response = (await this.client.reminders.complete({
        reminder: reminderId,
      })) as RemindersCompleteResponse;

      if (!response.ok) {
        if (response.error === 'not_found') {
          throw new ReminderNotFoundError(reminderId);
        }
        throw new ReminderError(
          `Failed to complete reminder: ${response.error}`,
          response.error || 'complete_reminder_failed',
        );
      }

      this.log('Reminder completed successfully');
    } catch (error) {
      this.handleError(error, 'complete reminder');
    }
  }

  /**
   * Delete a reminder
   *
   * @param reminderId - The ID of the reminder to delete
   * @throws {ReminderNotFoundError} If the reminder is not found
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * await reminders.deleteReminder('Rm123ABC456');
   * console.log('Reminder deleted');
   * ```
   */
  async deleteReminder(reminderId: string): Promise<void> {
    try {
      this.log(`Deleting reminder: ${reminderId}`);

      const response = (await this.client.reminders.delete({
        reminder: reminderId,
      })) as RemindersDeleteResponse;

      if (!response.ok) {
        if (response.error === 'not_found') {
          throw new ReminderNotFoundError(reminderId);
        }
        throw new ReminderError(
          `Failed to delete reminder: ${response.error}`,
          response.error || 'delete_reminder_failed',
        );
      }

      this.log('Reminder deleted successfully');
    } catch (error) {
      this.handleError(error, 'delete reminder');
    }
  }

  /**
   * Get detailed information about a specific reminder
   *
   * @param reminderId - The ID of the reminder to retrieve
   * @returns The reminder details
   * @throws {ReminderNotFoundError} If the reminder is not found
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * const reminder = await reminders.getReminderInfo('Rm123ABC456');
   * console.log(`Reminder: ${reminder.text}`);
   * console.log(`Scheduled for: ${new Date(reminder.time * 1000)}`);
   * ```
   */
  async getReminderInfo(reminderId: string): Promise<Reminder> {
    try {
      this.log(`Getting reminder info: ${reminderId}`);

      const response = (await this.client.reminders.info({
        reminder: reminderId,
      })) as RemindersInfoResponse;

      if (!response.ok || !response.reminder) {
        if (response.error === 'not_found') {
          throw new ReminderNotFoundError(reminderId);
        }
        throw new ReminderError(
          `Failed to get reminder info: ${response.error}`,
          response.error || 'get_reminder_info_failed',
        );
      }

      return this.mapReminder(response.reminder);
    } catch (error) {
      this.handleError(error, 'get reminder info');
    }
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Create a reminder for yourself after a specified duration
   *
   * @param text - The reminder text/message
   * @param duration - Duration object with optional days, hours, and minutes
   * @returns The created reminder
   * @throws {InvalidReminderTimeError} If the duration is invalid
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * // Remind me in 30 minutes
   * await reminders.remindMeIn('Check build status', { minutes: 30 });
   *
   * // Remind me in 2 hours
   * await reminders.remindMeIn('Follow up with client', { hours: 2 });
   *
   * // Remind me in 1 day and 3 hours
   * await reminders.remindMeIn('Weekly review', { days: 1, hours: 3 });
   * ```
   */
  async remindMeIn(
    text: string,
    duration: ReminderDuration,
  ): Promise<Reminder> {
    const futureTime = this.calculateFutureTime(duration);
    return this.createReminder(text, new Date(futureTime * 1000));
  }

  /**
   * Create a reminder for yourself at a specific time
   *
   * @param text - The reminder text/message
   * @param time - The exact time for the reminder
   * @returns The created reminder
   * @throws {InvalidReminderTimeError} If the time is in the past
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * // Remind me at 3 PM today
   * const today3pm = new Date();
   * today3pm.setHours(15, 0, 0, 0);
   * await reminders.remindMeAt('Team meeting', today3pm);
   *
   * // Remind me at a specific date and time
   * await reminders.remindMeAt(
   *   'Submit report',
   *   new Date('2024-01-20T09:00:00')
   * );
   * ```
   */
  async remindMeAt(text: string, time: Date): Promise<Reminder> {
    const now = new Date();
    if (time <= now) {
      throw new InvalidReminderTimeError('Reminder time must be in the future');
    }
    return this.createReminder(text, time);
  }

  /**
   * Create a reminder for another user after a specified duration
   *
   * @param userId - The user ID to remind
   * @param text - The reminder text/message
   * @param duration - Duration object with optional hours and minutes
   * @returns The created reminder
   * @throws {InvalidReminderTimeError} If the duration is invalid
   * @throws {ReminderUserNotFoundError} If the user is not found
   * @throws {ReminderError} If the operation fails
   *
   * @example
   * ```typescript
   * // Remind a user in 1 hour
   * await reminders.remindUserIn(
   *   'U123ABC456',
   *   'Please review the pull request',
   *   { hours: 1 }
   * );
   *
   * // Remind a user in 45 minutes
   * await reminders.remindUserIn(
   *   'U123ABC456',
   *   'Meeting starting soon',
   *   { minutes: 45 }
   * );
   * ```
   */
  async remindUserIn(
    userId: string,
    text: string,
    duration: ReminderDuration,
  ): Promise<Reminder> {
    const futureTime = this.calculateFutureTime(duration);
    return this.createReminder(text, new Date(futureTime * 1000), userId);
  }

  // ===========================================================================
  // Additional Utility Methods
  // ===========================================================================

  /**
   * Get all pending (incomplete) reminders
   *
   * @returns Array of incomplete reminders
   *
   * @example
   * ```typescript
   * const pending = await reminders.getPendingReminders();
   * console.log(`You have ${pending.length} pending reminders`);
   * ```
   */
  async getPendingReminders(): Promise<Reminder[]> {
    const allReminders = await this.listReminders();
    return allReminders.filter((r) => r.completeTs === null);
  }

  /**
   * Get all completed reminders
   *
   * @returns Array of completed reminders
   *
   * @example
   * ```typescript
   * const completed = await reminders.getCompletedReminders();
   * console.log(`You have completed ${completed.length} reminders`);
   * ```
   */
  async getCompletedReminders(): Promise<Reminder[]> {
    const allReminders = await this.listReminders();
    return allReminders.filter((r) => r.completeTs !== null);
  }

  /**
   * Get reminders scheduled for today
   *
   * @returns Array of reminders scheduled for today
   *
   * @example
   * ```typescript
   * const todayReminders = await reminders.getTodayReminders();
   * console.log(`You have ${todayReminders.length} reminders for today`);
   * ```
   */
  async getTodayReminders(): Promise<Reminder[]> {
    const allReminders = await this.listReminders();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    return allReminders.filter((r) => {
      const reminderTime = r.time * 1000;
      return (
        reminderTime >= todayStart.getTime() &&
        reminderTime < todayEnd.getTime()
      );
    });
  }

  /**
   * Get reminders scheduled for the next N hours
   *
   * @param hours - Number of hours to look ahead
   * @returns Array of reminders in the specified time window
   *
   * @example
   * ```typescript
   * // Get reminders for the next 4 hours
   * const upcoming = await reminders.getUpcomingReminders(4);
   * ```
   */
  async getUpcomingReminders(hours: number): Promise<Reminder[]> {
    const allReminders = await this.listReminders();
    const now = Date.now();
    const futureLimit = now + hours * 60 * 60 * 1000;

    return allReminders.filter((r) => {
      const reminderTime = r.time * 1000;
      return reminderTime >= now && reminderTime <= futureLimit;
    });
  }

  /**
   * Delete all completed reminders
   *
   * @returns Number of reminders deleted
   *
   * @example
   * ```typescript
   * const deletedCount = await reminders.clearCompletedReminders();
   * console.log(`Deleted ${deletedCount} completed reminders`);
   * ```
   */
  async clearCompletedReminders(): Promise<number> {
    const completed = await this.getCompletedReminders();
    let deletedCount = 0;

    for (const reminder of completed) {
      try {
        await this.deleteReminder(reminder.id);
        deletedCount++;
      } catch (error) {
        this.log(`Failed to delete reminder ${reminder.id}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Check if a reminder exists
   *
   * @param reminderId - The reminder ID to check
   * @returns True if the reminder exists
   *
   * @example
   * ```typescript
   * if (await reminders.reminderExists('Rm123ABC456')) {
   *   console.log('Reminder exists');
   * }
   * ```
   */
  async reminderExists(reminderId: string): Promise<boolean> {
    try {
      await this.getReminderInfo(reminderId);
      return true;
    } catch (error) {
      if (error instanceof ReminderNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Quick reminder presets for common scenarios
   */
  readonly presets = {
    /**
     * Remind in 15 minutes
     */
    inFifteenMinutes: (text: string): Promise<Reminder> =>
      this.remindMeIn(text, { minutes: 15 }),

    /**
     * Remind in 30 minutes
     */
    inThirtyMinutes: (text: string): Promise<Reminder> =>
      this.remindMeIn(text, { minutes: 30 }),

    /**
     * Remind in 1 hour
     */
    inOneHour: (text: string): Promise<Reminder> =>
      this.remindMeIn(text, { hours: 1 }),

    /**
     * Remind in 2 hours
     */
    inTwoHours: (text: string): Promise<Reminder> =>
      this.remindMeIn(text, { hours: 2 }),

    /**
     * Remind tomorrow at 9 AM
     */
    tomorrowMorning: (text: string): Promise<Reminder> => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return this.remindMeAt(text, tomorrow);
    },

    /**
     * Remind at end of day (5 PM)
     */
    endOfDay: (text: string): Promise<Reminder> => {
      const endOfDay = new Date();
      endOfDay.setHours(17, 0, 0, 0);

      // If it's already past 5 PM, set for tomorrow
      if (new Date() > endOfDay) {
        endOfDay.setDate(endOfDay.getDate() + 1);
      }

      return this.remindMeAt(text, endOfDay);
    },

    /**
     * Remind at start of next week (Monday 9 AM)
     */
    nextWeek: (text: string): Promise<Reminder> => {
      const nextMonday = new Date();
      const dayOfWeek = nextMonday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 0, 0, 0);
      return this.remindMeAt(text, nextMonday);
    },
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a ReminderManager instance
 *
 * @param config - Configuration options including the WebClient
 * @returns Configured ReminderManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createReminderManager } from '@wundr/slack-agent/capabilities/reminders';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const reminders = createReminderManager({ client });
 *
 * // Or with debug logging
 * const remindersDebug = createReminderManager({ client, debug: true });
 * ```
 */
export function createReminderManager(
  config: ReminderManagerConfig,
): ReminderManager {
  return new ReminderManager(config);
}

/**
 * Create a ReminderManager from a token string
 *
 * @param token - Slack user token (xoxp-...)
 * @param options - Optional additional options
 * @returns Configured ReminderManager instance
 *
 * @example
 * ```typescript
 * const reminders = createReminderManagerFromToken(process.env.SLACK_USER_TOKEN!, {
 *   debug: true,
 * });
 *
 * await reminders.remindMeIn('Check build status', { minutes: 30 });
 * ```
 */
export function createReminderManagerFromToken(
  token: string,
  options: { debug?: boolean } = {},
): ReminderManager {
  const client = new WebClient(token);
  return new ReminderManager({
    client,
    debug: options.debug,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default ReminderManager;
