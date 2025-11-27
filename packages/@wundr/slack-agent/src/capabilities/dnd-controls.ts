/**
 * @wundr/slack-agent - DND (Do Not Disturb) Controls Capability
 *
 * Provides comprehensive Do Not Disturb management for Orchestrator (Virtual Principal) agents
 * operating as full users in Slack workspaces. Handles snooze activation, deactivation,
 * status queries, and team-wide DND information.
 *
 * @packageDocumentation
 */

import { WebClient } from '@slack/web-api';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Comprehensive DND (Do Not Disturb) status information
 */
export interface DndInfo {
  /** Whether DND is currently enabled for the user */
  dndEnabled: boolean;
  /** Unix timestamp when the next scheduled DND period starts */
  nextDndStartTs: number | null;
  /** Unix timestamp when the next scheduled DND period ends */
  nextDndEndTs: number | null;
  /** Whether snooze mode is currently active */
  snoozeEnabled: boolean;
  /** Unix timestamp when the current snooze period ends */
  snoozeEndTs: number | null;
  /** Minutes remaining in the current snooze period */
  snoozeRemaining: number | null;
}

/**
 * Duration specification for snooze operations
 */
export interface SnoozeDuration {
  /** Number of hours to snooze */
  hours?: number;
  /** Number of minutes to snooze */
  minutes?: number;
}

/**
 * Configuration options for DndControlsManager
 */
export interface DndControlsConfig {
  /** Authenticated Slack WebClient instance */
  client: WebClient;
  /** Optional: Enable debug logging */
  debug?: boolean;
}

/**
 * Response structure for DND set snooze operations
 */
interface DndSetSnoozeResponse {
  ok: boolean;
  error?: string;
  snooze_enabled?: boolean;
  snooze_endtime?: number;
  snooze_remaining?: number;
  snooze_is_indefinite?: boolean;
}

/**
 * Response structure for DND end snooze operations
 */
interface DndEndSnoozeResponse {
  ok: boolean;
  error?: string;
  dnd_enabled?: boolean;
  next_dnd_start_ts?: number;
  next_dnd_end_ts?: number;
  snooze_enabled?: boolean;
}

/**
 * Response structure for DND info operations
 */
interface DndInfoResponse {
  ok: boolean;
  error?: string;
  dnd_enabled?: boolean;
  next_dnd_start_ts?: number;
  next_dnd_end_ts?: number;
  snooze_enabled?: boolean;
  snooze_endtime?: number;
  snooze_remaining?: number;
  snooze_is_indefinite?: boolean;
}

/**
 * Response structure for team DND info operations
 */
interface DndTeamInfoResponse {
  ok: boolean;
  error?: string;
  users?: Record<
    string,
    {
      dnd_enabled?: boolean;
      next_dnd_start_ts?: number;
      next_dnd_end_ts?: number;
    }
  >;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when DND operations fail
 */
export class DndError extends Error {
  /** Slack API error code */
  public readonly code: string;
  /** Original error details */
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'DndError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DndError.prototype);
  }
}

/**
 * Error thrown when snooze is not currently active
 */
export class SnoozeNotActiveError extends DndError {
  constructor() {
    super('Snooze is not currently active', 'snooze_not_active');
    this.name = 'SnoozeNotActiveError';
    Object.setPrototypeOf(this, SnoozeNotActiveError.prototype);
  }
}

/**
 * Error thrown when a user is not found
 */
export class DndUserNotFoundError extends DndError {
  public readonly userId: string;

  constructor(userId: string) {
    super(`User not found: ${userId}`, 'user_not_found');
    this.name = 'DndUserNotFoundError';
    this.userId = userId;
    Object.setPrototypeOf(this, DndUserNotFoundError.prototype);
  }
}

// =============================================================================
// DndControlsManager Class
// =============================================================================

/**
 * Manages Do Not Disturb (DND) operations for the Slack Orchestrator agent.
 *
 * This class provides methods for the Orchestrator agent to:
 * - Enable/disable snooze mode
 * - Check own DND status
 * - Query team members' DND status
 * - Calculate snooze duration and remaining time
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { DndControlsManager } from '@wundr/slack-agent/capabilities/dnd-controls';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const dnd = new DndControlsManager({ client });
 *
 * // Enable snooze for 30 minutes
 * await dnd.setSnooze(30);
 *
 * // Check if DND is active
 * const isActive = await dnd.isDndActive();
 * console.log(`DND is ${isActive ? 'active' : 'inactive'}`);
 *
 * // Snooze until end of work day
 * const endOfDay = new Date();
 * endOfDay.setHours(18, 0, 0, 0);
 * await dnd.snoozeUntil(endOfDay);
 * ```
 */
export class DndControlsManager {
  private readonly client: WebClient;
  private readonly debug: boolean;

  /**
   * Creates a new DndControlsManager instance
   *
   * @param config - Configuration options
   */
  constructor(config: DndControlsConfig) {
    this.client = config.client;
    this.debug = config.debug ?? false;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug && typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log(`[DndControlsManager] ${message}`, ...args);
    }
  }

  /**
   * Handle API response errors
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof DndError) {
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
      case 'snooze_not_active':
        throw new SnoozeNotActiveError();
      case 'user_not_found':
      case 'users_not_found':
        throw new DndUserNotFoundError('unknown');
      default:
        throw new DndError(errorMessage, errorCode, error);
    }
  }

  /**
   * Map Slack API response to DndInfo type
   */
  private mapDndInfo(response: DndInfoResponse | DndEndSnoozeResponse): DndInfo {
    return {
      dndEnabled: response.dnd_enabled ?? false,
      nextDndStartTs: response.next_dnd_start_ts ?? null,
      nextDndEndTs: response.next_dnd_end_ts ?? null,
      snoozeEnabled: response.snooze_enabled ?? false,
      snoozeEndTs:
        'snooze_endtime' in response && response.snooze_endtime
          ? response.snooze_endtime
          : null,
      snoozeRemaining:
        'snooze_remaining' in response && response.snooze_remaining
          ? response.snooze_remaining
          : null,
    };
  }

  /**
   * Map snooze response to DndInfo type
   */
  private mapSnoozeResponse(response: DndSetSnoozeResponse): DndInfo {
    return {
      dndEnabled: response.snooze_enabled ?? false,
      nextDndStartTs: null,
      nextDndEndTs: null,
      snoozeEnabled: response.snooze_enabled ?? false,
      snoozeEndTs: response.snooze_endtime ?? null,
      snoozeRemaining: response.snooze_remaining ?? null,
    };
  }

  // ===========================================================================
  // Core DND Operations
  // ===========================================================================

  /**
   * Enable Do Not Disturb mode (snooze) for a specified number of minutes
   *
   * @param minutes - Number of minutes to enable snooze (max 1440 = 24 hours)
   * @returns The updated DND information
   * @throws {DndError} If the snooze operation fails
   *
   * @example
   * ```typescript
   * // Snooze for 30 minutes
   * const info = await dnd.setSnooze(30);
   * console.log(`Snooze enabled until ${new Date(info.snoozeEndTs! * 1000)}`);
   *
   * // Snooze for 2 hours
   * await dnd.setSnooze(120);
   * ```
   */
  async setSnooze(minutes: number): Promise<DndInfo> {
    try {
      this.log(`Setting snooze for ${minutes} minutes`);

      // Validate minutes (Slack API accepts 1-1440 minutes)
      if (minutes < 1) {
        throw new DndError(
          'Snooze duration must be at least 1 minute',
          'invalid_duration',
        );
      }
      if (minutes > 1440) {
        throw new DndError(
          'Snooze duration cannot exceed 1440 minutes (24 hours)',
          'invalid_duration',
        );
      }

      const response = (await this.client.dnd.setSnooze({
        num_minutes: minutes,
      })) as DndSetSnoozeResponse;

      if (!response.ok) {
        throw new DndError(
          `Failed to set snooze: ${response.error}`,
          response.error || 'set_snooze_failed',
        );
      }

      this.log('Snooze enabled successfully');
      return this.mapSnoozeResponse(response);
    } catch (error) {
      this.handleError(error, 'set snooze');
    }
  }

  /**
   * Disable snooze mode early, before the scheduled end time
   *
   * @returns The updated DND information after disabling snooze
   * @throws {SnoozeNotActiveError} If snooze is not currently active
   * @throws {DndError} If the operation fails
   *
   * @example
   * ```typescript
   * try {
   *   const info = await dnd.endSnooze();
   *   console.log('Snooze disabled successfully');
   * } catch (error) {
   *   if (error instanceof SnoozeNotActiveError) {
   *     console.log('Snooze was not active');
   *   }
   * }
   * ```
   */
  async endSnooze(): Promise<DndInfo> {
    try {
      this.log('Ending snooze');

      const response = (await this.client.dnd.endSnooze()) as DndEndSnoozeResponse;

      if (!response.ok) {
        throw new DndError(
          `Failed to end snooze: ${response.error}`,
          response.error || 'end_snooze_failed',
        );
      }

      this.log('Snooze ended successfully');
      return this.mapDndInfo(response);
    } catch (error) {
      this.handleError(error, 'end snooze');
    }
  }

  /**
   * Get DND status information for the Orchestrator agent or another user
   *
   * @param userId - Optional user ID. If not provided, returns the VP's own status.
   * @returns DND information for the specified user
   * @throws {DndUserNotFoundError} If the specified user is not found
   * @throws {DndError} If the operation fails
   *
   * @example
   * ```typescript
   * // Get own DND status
   * const myStatus = await dnd.getDndInfo();
   *
   * // Get another user's DND status
   * const userStatus = await dnd.getDndInfo('U123ABC456');
   * if (userStatus.snoozeEnabled) {
   *   console.log(`User is in DND mode for ${userStatus.snoozeRemaining} more minutes`);
   * }
   * ```
   */
  async getDndInfo(userId?: string): Promise<DndInfo> {
    try {
      this.log('Getting DND info', userId ? `for user ${userId}` : 'for self');

      const response = (await this.client.dnd.info(
        userId ? { user: userId } : {},
      )) as DndInfoResponse;

      if (!response.ok) {
        throw new DndError(
          `Failed to get DND info: ${response.error}`,
          response.error || 'get_dnd_info_failed',
        );
      }

      return this.mapDndInfo(response);
    } catch (error) {
      this.handleError(error, 'get DND info');
    }
  }

  /**
   * Get DND status information for multiple team members
   *
   * @param userIds - Array of user IDs to query
   * @returns Map of user IDs to their DND information
   * @throws {DndError} If the operation fails
   *
   * @example
   * ```typescript
   * const teamDnd = await dnd.getTeamDndInfo(['U123', 'U456', 'U789']);
   *
   * for (const [userId, info] of teamDnd) {
   *   if (info.dndEnabled) {
   *     console.log(`User ${userId} has DND enabled`);
   *   }
   * }
   * ```
   */
  async getTeamDndInfo(userIds: string[]): Promise<Map<string, DndInfo>> {
    try {
      this.log(`Getting team DND info for ${userIds.length} users`);

      if (userIds.length === 0) {
        return new Map();
      }

      const response = (await this.client.dnd.teamInfo({
        users: userIds.join(','),
      })) as DndTeamInfoResponse;

      if (!response.ok) {
        throw new DndError(
          `Failed to get team DND info: ${response.error}`,
          response.error || 'get_team_dnd_info_failed',
        );
      }

      const result = new Map<string, DndInfo>();

      if (response.users) {
        for (const [uid, userData] of Object.entries(response.users)) {
          result.set(uid, {
            dndEnabled: userData.dnd_enabled ?? false,
            nextDndStartTs: userData.next_dnd_start_ts ?? null,
            nextDndEndTs: userData.next_dnd_end_ts ?? null,
            snoozeEnabled: false, // Team info doesn't include snooze details
            snoozeEndTs: null,
            snoozeRemaining: null,
          });
        }
      }

      this.log(`Retrieved DND info for ${result.size} users`);
      return result;
    } catch (error) {
      this.handleError(error, 'get team DND info');
    }
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Enable snooze using hours and minutes duration format
   *
   * @param duration - Duration object with optional hours and minutes
   * @returns The updated DND information
   * @throws {DndError} If the duration is invalid or the operation fails
   *
   * @example
   * ```typescript
   * // Snooze for 2 hours
   * await dnd.snoozeFor({ hours: 2 });
   *
   * // Snooze for 1 hour and 30 minutes
   * await dnd.snoozeFor({ hours: 1, minutes: 30 });
   *
   * // Snooze for 45 minutes
   * await dnd.snoozeFor({ minutes: 45 });
   * ```
   */
  async snoozeFor(duration: SnoozeDuration): Promise<DndInfo> {
    const hours = duration.hours ?? 0;
    const minutes = duration.minutes ?? 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 1) {
      throw new DndError(
        'Snooze duration must be at least 1 minute',
        'invalid_duration',
      );
    }

    return this.setSnooze(totalMinutes);
  }

  /**
   * Enable snooze until a specific end time
   *
   * @param endTime - Date object representing when snooze should end
   * @returns The updated DND information
   * @throws {DndError} If the end time is in the past or too far in the future
   *
   * @example
   * ```typescript
   * // Snooze until 5 PM today
   * const endOfDay = new Date();
   * endOfDay.setHours(17, 0, 0, 0);
   * await dnd.snoozeUntil(endOfDay);
   *
   * // Snooze until a specific timestamp
   * const meetingEnd = new Date('2024-01-15T14:30:00');
   * await dnd.snoozeUntil(meetingEnd);
   * ```
   */
  async snoozeUntil(endTime: Date): Promise<DndInfo> {
    const now = new Date();
    const diffMs = endTime.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      throw new DndError(
        'Snooze end time must be in the future',
        'invalid_end_time',
      );
    }

    if (diffMinutes > 1440) {
      throw new DndError(
        'Snooze end time cannot be more than 24 hours from now',
        'invalid_end_time',
      );
    }

    this.log(`Snoozing until ${endTime.toISOString()} (${diffMinutes} minutes)`);
    return this.setSnooze(diffMinutes);
  }

  /**
   * Check if DND is currently active for the Orchestrator agent or another user
   *
   * This checks both scheduled DND periods and manual snooze mode.
   *
   * @param userId - Optional user ID. If not provided, checks the VP's own status.
   * @returns True if DND is currently active (either scheduled or snoozed)
   *
   * @example
   * ```typescript
   * // Check own DND status
   * if (await dnd.isDndActive()) {
   *   console.log('DND is currently active');
   * }
   *
   * // Check another user
   * if (await dnd.isDndActive('U123ABC456')) {
   *   console.log('User has DND enabled, message may not be seen immediately');
   * }
   * ```
   */
  async isDndActive(userId?: string): Promise<boolean> {
    const info = await this.getDndInfo(userId);

    // DND is active if snooze is enabled
    if (info.snoozeEnabled) {
      return true;
    }

    // Or if we're within a scheduled DND period
    if (info.dndEnabled && info.nextDndStartTs && info.nextDndEndTs) {
      const now = Math.floor(Date.now() / 1000);
      return now >= info.nextDndStartTs && now < info.nextDndEndTs;
    }

    return false;
  }

  /**
   * Get the number of minutes remaining in the current snooze period
   *
   * @param userId - Optional user ID. If not provided, checks the VP's own snooze.
   * @returns Number of minutes remaining, or null if snooze is not active
   *
   * @example
   * ```typescript
   * const remaining = await dnd.getSnoozeRemaining();
   * if (remaining !== null) {
   *   console.log(`Snooze will end in ${remaining} minutes`);
   * } else {
   *   console.log('Snooze is not active');
   * }
   * ```
   */
  async getSnoozeRemaining(userId?: string): Promise<number | null> {
    const info = await this.getDndInfo(userId);

    if (!info.snoozeEnabled) {
      return null;
    }

    // Return the remaining time directly if available
    if (info.snoozeRemaining !== null) {
      return info.snoozeRemaining;
    }

    // Calculate from end timestamp if available
    if (info.snoozeEndTs !== null) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remainingSeconds = info.snoozeEndTs - nowSeconds;
      return remainingSeconds > 0 ? Math.ceil(remainingSeconds / 60) : 0;
    }

    return null;
  }

  // ===========================================================================
  // Additional Utility Methods
  // ===========================================================================

  /**
   * Get the snooze end time as a Date object
   *
   * @param userId - Optional user ID. If not provided, checks the VP's own snooze.
   * @returns Date object representing when snooze ends, or null if not active
   *
   * @example
   * ```typescript
   * const endTime = await dnd.getSnoozeEndTime();
   * if (endTime) {
   *   console.log(`Snooze ends at ${endTime.toLocaleTimeString()}`);
   * }
   * ```
   */
  async getSnoozeEndTime(userId?: string): Promise<Date | null> {
    const info = await this.getDndInfo(userId);

    if (!info.snoozeEnabled || info.snoozeEndTs === null) {
      return null;
    }

    return new Date(info.snoozeEndTs * 1000);
  }

  /**
   * Get the next scheduled DND period as Date objects
   *
   * @param userId - Optional user ID. If not provided, checks the VP's schedule.
   * @returns Object with start and end Date objects, or null if no scheduled DND
   *
   * @example
   * ```typescript
   * const schedule = await dnd.getNextDndSchedule();
   * if (schedule) {
   *   console.log(`Next DND: ${schedule.start.toLocaleString()} - ${schedule.end.toLocaleString()}`);
   * }
   * ```
   */
  async getNextDndSchedule(
    userId?: string,
  ): Promise<{ start: Date; end: Date } | null> {
    const info = await this.getDndInfo(userId);

    if (info.nextDndStartTs === null || info.nextDndEndTs === null) {
      return null;
    }

    return {
      start: new Date(info.nextDndStartTs * 1000),
      end: new Date(info.nextDndEndTs * 1000),
    };
  }

  /**
   * Quick snooze presets for common durations
   */
  readonly presets = {
    /**
     * Snooze for 15 minutes
     */
    fifteenMinutes: (): Promise<DndInfo> => this.setSnooze(15),

    /**
     * Snooze for 30 minutes
     */
    thirtyMinutes: (): Promise<DndInfo> => this.setSnooze(30),

    /**
     * Snooze for 1 hour
     */
    oneHour: (): Promise<DndInfo> => this.setSnooze(60),

    /**
     * Snooze for 2 hours
     */
    twoHours: (): Promise<DndInfo> => this.setSnooze(120),

    /**
     * Snooze for 4 hours
     */
    fourHours: (): Promise<DndInfo> => this.setSnooze(240),

    /**
     * Snooze until end of current day (6 PM)
     */
    untilEndOfDay: (): Promise<DndInfo> => {
      const endOfDay = new Date();
      endOfDay.setHours(18, 0, 0, 0);

      // If it's already past 6 PM, snooze until tomorrow
      if (new Date() > endOfDay) {
        endOfDay.setDate(endOfDay.getDate() + 1);
      }

      return this.snoozeUntil(endOfDay);
    },

    /**
     * Snooze until tomorrow morning (9 AM)
     */
    untilTomorrowMorning: (): Promise<DndInfo> => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return this.snoozeUntil(tomorrow);
    },
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a DndControlsManager instance
 *
 * @param config - Configuration options including the WebClient
 * @returns Configured DndControlsManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createDndControlsManager } from '@wundr/slack-agent/capabilities/dnd-controls';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const dnd = createDndControlsManager({ client });
 *
 * // Or with debug logging
 * const dndDebug = createDndControlsManager({ client, debug: true });
 * ```
 */
export function createDndControlsManager(
  config: DndControlsConfig,
): DndControlsManager {
  return new DndControlsManager(config);
}

/**
 * Create a DndControlsManager from a token string
 *
 * @param token - Slack user token (xoxp-...)
 * @param options - Optional additional options
 * @returns Configured DndControlsManager instance
 *
 * @example
 * ```typescript
 * const dnd = createDndControlsManagerFromToken(process.env.SLACK_USER_TOKEN!, {
 *   debug: true,
 * });
 * ```
 */
export function createDndControlsManagerFromToken(
  token: string,
  options: { debug?: boolean } = {},
): DndControlsManager {
  const client = new WebClient(token);
  return new DndControlsManager({
    client,
    debug: options.debug,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default DndControlsManager;
