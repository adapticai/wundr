/**
 * @wundr/slack-agent - Presence and Status Management
 *
 * Implements Slack presence and status management for Orchestrator (Virtual Principal) agents.
 * Enables authentic presence behavior - appearing online, setting status messages,
 * and monitoring presence changes of other users.
 *
 * @example
 * ```typescript
 * import { PresenceStatusManager } from '@wundr/slack-agent/capabilities/presence-status';
 * import { WebClient } from '@slack/web-api';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const presenceManager = new PresenceStatusManager(client);
 *
 * // Set active presence
 * await presenceManager.setPresence('auto');
 *
 * // Set custom status
 * await presenceManager.setStatus('Working on feature X', ':computer:');
 *
 * // Use preset statuses
 * await presenceManager.setInMeeting(60); // 60 minutes
 * ```
 *
 * @packageDocumentation
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Presence state type - 'auto' shows as active when using Slack,
 * 'away' forces an away state
 */
export type PresenceState = 'auto' | 'away';

/**
 * Detailed presence information for a user
 */
export interface PresenceInfo {
  /** The user's presence state */
  presence: 'active' | 'away';
  /** Whether the user is online */
  online: boolean;
  /** Whether auto-away is triggered */
  autoAway: boolean;
  /** Whether the user has manually set away */
  manualAway: boolean;
  /** Timestamp of last activity (Unix timestamp, if available) */
  lastActivity?: number;
  /** Connection count (number of active clients) */
  connectionCount?: number;
}

/**
 * User status information
 */
export interface StatusInfo {
  /** Custom status text */
  text: string;
  /** Status emoji (e.g., ':palm_tree:', ':computer:') */
  emoji: string;
  /** Expiration timestamp (Unix timestamp, 0 means no expiration) */
  expiration: number;
  /** Whether status is set by a Slack admin */
  isCustom: boolean;
}

/**
 * Options for setting status
 */
export interface SetStatusOptions {
  /** Status text to display */
  text: string;
  /** Emoji to display (with or without colons) */
  emoji?: string;
  /** When the status should automatically clear */
  expiration?: Date;
}

/**
 * Preset status configuration
 */
export interface PresetStatus {
  /** Status text */
  text: string;
  /** Status emoji */
  emoji: string;
  /** Default duration in minutes (optional) */
  defaultDuration?: number;
}

/**
 * Presence change event
 */
export interface PresenceChangeEvent {
  /** User ID whose presence changed */
  userId: string;
  /** New presence state */
  presence: 'active' | 'away';
  /** Timestamp of the change */
  timestamp: Date;
}

/**
 * Callback for presence change subscriptions
 */
export type PresenceChangeCallback = (event: PresenceChangeEvent) => void;

/**
 * Error thrown when presence/status operations fail
 */
export class PresenceStatusError extends Error {
  public readonly code: string;
  public readonly slackError?: string;

  constructor(message: string, code: string, slackError?: string) {
    super(message);
    this.name = 'PresenceStatusError';
    this.code = code;
    this.slackError = slackError;
  }
}

// =============================================================================
// Preset Status Definitions
// =============================================================================

/**
 * Common preset statuses for quick status setting
 */
export const PresetStatuses = {
  IN_MEETING: {
    text: 'In a meeting',
    emoji: ':calendar:',
    defaultDuration: 60,
  },
  FOCUSING: {
    text: 'Focusing',
    emoji: ':headphones:',
    defaultDuration: 120,
  },
  OUT_OF_OFFICE: {
    text: 'Out of office',
    emoji: ':palm_tree:',
  },
  LUNCHING: {
    text: 'Out for lunch',
    emoji: ':fork_and_knife:',
    defaultDuration: 60,
  },
  WORKING: {
    text: 'Working remotely',
    emoji: ':house_with_garden:',
  },
  BUSY: {
    text: 'Busy',
    emoji: ':no_entry:',
    defaultDuration: 60,
  },
  COMMUTING: {
    text: 'Commuting',
    emoji: ':bus:',
    defaultDuration: 45,
  },
  SICK: {
    text: 'Out sick',
    emoji: ':face_with_thermometer:',
  },
  VACATIONING: {
    text: 'Vacationing',
    emoji: ':beach_with_umbrella:',
  },
  BRB: {
    text: 'Be right back',
    emoji: ':brb:',
    defaultDuration: 15,
  },
} as const satisfies Record<string, PresetStatus>;

// =============================================================================
// PresenceStatusManager Class
// =============================================================================

/**
 * Manages Slack presence and status for a Orchestrator agent.
 *
 * This class provides methods for:
 * - Setting and getting presence (active/away)
 * - Setting custom status with optional expiration
 * - Preset status helpers for common scenarios
 * - Monitoring other users' presence
 *
 * @remarks
 * Requires a USER token (xoxp-) for setting own presence/status.
 * Bot tokens cannot set presence or user status.
 *
 * @example
 * ```typescript
 * const manager = new PresenceStatusManager(webClient);
 *
 * // Go active
 * await manager.setPresence('auto');
 *
 * // Set a custom status
 * await manager.setStatus('Reviewing PRs', ':eyes:', new Date(Date.now() + 3600000));
 *
 * // Use preset
 * await manager.setFocusing(90); // Focus mode for 90 minutes
 *
 * // Check if someone is online
 * const presence = await manager.getPresence('U12345678');
 * console.log(presence.online ? 'User is online' : 'User is away');
 * ```
 */
export class PresenceStatusManager {
  private readonly client: WebClient;
  private readonly presenceSubscriptions: Map<string, PresenceChangeCallback[]> = new Map();

  /**
   * Creates a new PresenceStatusManager instance.
   *
   * @param client - Slack WebClient instance with a user token (xoxp-)
   */
  constructor(client: WebClient) {
    this.client = client;
  }

  // ===========================================================================
  // Presence Management
  // ===========================================================================

  /**
   * Sets the Orchestrator agent's presence state.
   *
   * @param presence - 'auto' to appear active when using Slack, 'away' to force away status
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Appear active
   * await manager.setPresence('auto');
   *
   * // Manually set away
   * await manager.setPresence('away');
   * ```
   */
  async setPresence(presence: PresenceState): Promise<void> {
    try {
      const response = await this.client.users.setPresence({
        presence,
      });

      if (!response.ok) {
        throw new PresenceStatusError(
          `Failed to set presence to '${presence}'`,
          'SET_PRESENCE_FAILED',
          response.error,
        );
      }
    } catch (error) {
      if (error instanceof PresenceStatusError) {
        throw error;
      }
      throw new PresenceStatusError(
        `Failed to set presence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SET_PRESENCE_ERROR',
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  /**
   * Gets presence information for a user.
   *
   * @param userId - Optional user ID. If not provided, gets own presence.
   * @returns Presence information including online status and activity details
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Get own presence
   * const myPresence = await manager.getPresence();
   *
   * // Get another user's presence
   * const userPresence = await manager.getPresence('U12345678');
   * console.log(`User is ${userPresence.online ? 'online' : 'offline'}`);
   * ```
   */
  async getPresence(userId?: string): Promise<PresenceInfo> {
    try {
      const response = await this.client.users.getPresence({
        user: userId,
      });

      if (!response.ok) {
        throw new PresenceStatusError(
          'Failed to get presence',
          'GET_PRESENCE_FAILED',
          response.error,
        );
      }

      return {
        presence: response.presence as 'active' | 'away',
        online: response.online ?? response.presence === 'active',
        autoAway: response.auto_away ?? false,
        manualAway: response.manual_away ?? false,
        lastActivity: response.last_activity,
        connectionCount: response.connection_count,
      };
    } catch (error) {
      if (error instanceof PresenceStatusError) {
        throw error;
      }
      throw new PresenceStatusError(
        `Failed to get presence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_PRESENCE_ERROR',
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  // ===========================================================================
  // Status Management
  // ===========================================================================

  /**
   * Sets a custom status for the Orchestrator agent.
   *
   * @param text - Status text to display
   * @param emoji - Optional emoji (e.g., ':computer:' or just 'computer')
   * @param expiration - Optional date when the status should automatically clear
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Simple status
   * await manager.setStatus('Working on reports');
   *
   * // Status with emoji
   * await manager.setStatus('Coding', ':computer:');
   *
   * // Status with expiration (clears in 2 hours)
   * await manager.setStatus(
   *   'In deep work mode',
   *   ':no_entry:',
   *   new Date(Date.now() + 2 * 60 * 60 * 1000)
   * );
   * ```
   */
  async setStatus(text: string, emoji?: string, expiration?: Date): Promise<void> {
    try {
      const statusEmoji = emoji ? this.normalizeEmoji(emoji) : '';
      const statusExpiration = expiration ? Math.floor(expiration.getTime() / 1000) : 0;

      const response = await this.client.users.profile.set({
        profile: {
          status_text: text,
          status_emoji: statusEmoji,
          status_expiration: statusExpiration,
        },
      });

      if (!response.ok) {
        throw new PresenceStatusError('Failed to set status', 'SET_STATUS_FAILED', response.error);
      }
    } catch (error) {
      if (error instanceof PresenceStatusError) {
        throw error;
      }
      throw new PresenceStatusError(
        `Failed to set status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SET_STATUS_ERROR',
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  /**
   * Clears the current status.
   *
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.clearStatus();
   * ```
   */
  async clearStatus(): Promise<void> {
    await this.setStatus('', '');
  }

  /**
   * Gets status information for a specific user.
   *
   * @param userId - The user ID to get status for
   * @returns Status information including text, emoji, and expiration
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * const status = await manager.getUserStatus('U12345678');
   * if (status.text) {
   *   console.log(`${status.emoji} ${status.text}`);
   * }
   * ```
   */
  async getUserStatus(userId: string): Promise<StatusInfo> {
    try {
      const response = await this.client.users.profile.get({
        user: userId,
      });

      if (!response.ok || !response.profile) {
        throw new PresenceStatusError(
          'Failed to get user status',
          'GET_STATUS_FAILED',
          response.error,
        );
      }

      const profile = response.profile;

      return {
        text: profile.status_text ?? '',
        emoji: profile.status_emoji ?? '',
        expiration: profile.status_expiration ?? 0,
        isCustom:
          (profile.status_text_canonical !== undefined &&
            profile.status_text_canonical !== profile.status_text) ||
          false,
      };
    } catch (error) {
      if (error instanceof PresenceStatusError) {
        throw error;
      }
      throw new PresenceStatusError(
        `Failed to get user status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_STATUS_ERROR',
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  // ===========================================================================
  // Preset Status Helpers
  // ===========================================================================

  /**
   * Sets status to "In a meeting".
   *
   * @param duration - Optional duration in minutes (default: 60)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Default 60 minute meeting
   * await manager.setInMeeting();
   *
   * // 30 minute meeting
   * await manager.setInMeeting(30);
   * ```
   */
  async setInMeeting(duration?: number): Promise<void> {
    const preset = PresetStatuses.IN_MEETING;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  /**
   * Sets status to "Focusing" (deep work mode).
   *
   * @param duration - Optional duration in minutes (default: 120)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Default 2 hour focus session
   * await manager.setFocusing();
   *
   * // 90 minute focus session
   * await manager.setFocusing(90);
   * ```
   */
  async setFocusing(duration?: number): Promise<void> {
    const preset = PresetStatuses.FOCUSING;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  /**
   * Sets status to "Out of office".
   *
   * @param returnDate - Optional date when returning to office
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Out of office indefinitely
   * await manager.setOutOfOffice();
   *
   * // Out of office until specific date
   * await manager.setOutOfOffice(new Date('2024-01-15'));
   * ```
   */
  async setOutOfOffice(returnDate?: Date): Promise<void> {
    const preset = PresetStatuses.OUT_OF_OFFICE;
    const text = returnDate
      ? `${preset.text} until ${returnDate.toLocaleDateString()}`
      : preset.text;
    await this.setStatus(text, preset.emoji, returnDate);
  }

  /**
   * Sets status to "Out for lunch".
   *
   * @param duration - Optional duration in minutes (default: 60)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Standard lunch break
   * await manager.setLunching();
   *
   * // Extended lunch
   * await manager.setLunching(90);
   * ```
   */
  async setLunching(duration?: number): Promise<void> {
    const preset = PresetStatuses.LUNCHING;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  /**
   * Sets status to "Working" with optional task description.
   *
   * @param task - Optional task description to include in status
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Generic working status
   * await manager.setWorking();
   *
   * // Working on specific task
   * await manager.setWorking('implementing user authentication');
   * ```
   */
  async setWorking(task?: string): Promise<void> {
    const preset = PresetStatuses.WORKING;
    const text = task ? `Working on ${task}` : preset.text;
    await this.setStatus(text, ':computer:');
  }

  /**
   * Sets status to "Busy" with optional reason.
   *
   * @param reason - Optional reason for being busy
   * @param duration - Optional duration in minutes (default: 60)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * // Generic busy status
   * await manager.setBusy();
   *
   * // Busy with reason and duration
   * await manager.setBusy('reviewing code', 45);
   * ```
   */
  async setBusy(reason?: string, duration?: number): Promise<void> {
    const preset = PresetStatuses.BUSY;
    const text = reason ? `Busy: ${reason}` : preset.text;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(text, preset.emoji, expiration);
  }

  /**
   * Sets status to "Commuting".
   *
   * @param duration - Optional duration in minutes (default: 45)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.setCommuting(30);
   * ```
   */
  async setCommuting(duration?: number): Promise<void> {
    const preset = PresetStatuses.COMMUTING;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  /**
   * Sets status to "Out sick".
   *
   * @param returnDate - Optional expected return date
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.setSick();
   * await manager.setSick(new Date('2024-01-10'));
   * ```
   */
  async setSick(returnDate?: Date): Promise<void> {
    const preset = PresetStatuses.SICK;
    await this.setStatus(preset.text, preset.emoji, returnDate);
  }

  /**
   * Sets status to "Vacationing".
   *
   * @param returnDate - Optional return date
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.setVacationing(new Date('2024-02-01'));
   * ```
   */
  async setVacationing(returnDate?: Date): Promise<void> {
    const preset = PresetStatuses.VACATIONING;
    const text = returnDate
      ? `${preset.text} - back ${returnDate.toLocaleDateString()}`
      : preset.text;
    await this.setStatus(text, preset.emoji, returnDate);
  }

  /**
   * Sets status to "Be right back" (BRB).
   *
   * @param duration - Optional duration in minutes (default: 15)
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.setBrb();
   * await manager.setBrb(5);
   * ```
   */
  async setBrb(duration?: number): Promise<void> {
    const preset = PresetStatuses.BRB;
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  // ===========================================================================
  // Presence Subscription (if available)
  // ===========================================================================

  /**
   * Subscribes to presence changes for specific users.
   *
   * @remarks
   * Presence subscriptions are handled via Slack's RTM API or Events API.
   * This method registers a callback that will be invoked when presence changes
   * are detected. The actual WebSocket/event handling should be set up separately.
   *
   * @param userIds - Array of user IDs to monitor
   * @param callback - Callback function invoked on presence changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = manager.subscribeToPresence(
   *   ['U12345678', 'U87654321'],
   *   (event) => {
   *     console.log(`${event.userId} is now ${event.presence}`);
   *   }
   * );
   *
   * // Later, to stop receiving updates:
   * unsubscribe();
   * ```
   */
  subscribeToPresence(userIds: string[], callback: PresenceChangeCallback): () => void {
    for (const userId of userIds) {
      const existingCallbacks = this.presenceSubscriptions.get(userId) ?? [];
      this.presenceSubscriptions.set(userId, [...existingCallbacks, callback]);
    }

    // Return unsubscribe function
    return () => {
      for (const userId of userIds) {
        const callbacks = this.presenceSubscriptions.get(userId);
        if (callbacks) {
          const filtered = callbacks.filter(cb => cb !== callback);
          if (filtered.length === 0) {
            this.presenceSubscriptions.delete(userId);
          } else {
            this.presenceSubscriptions.set(userId, filtered);
          }
        }
      }
    };
  }

  /**
   * Handles incoming presence change events.
   * Should be called from your RTM/Events API handler.
   *
   * @param userId - User ID whose presence changed
   * @param presence - New presence state
   *
   * @example
   * ```typescript
   * // In your RTM event handler:
   * rtmClient.on('presence_change', (event) => {
   *   manager.handlePresenceChange(event.user, event.presence);
   * });
   * ```
   */
  handlePresenceChange(userId: string, presence: 'active' | 'away'): void {
    const callbacks = this.presenceSubscriptions.get(userId);
    if (callbacks) {
      const event: PresenceChangeEvent = {
        userId,
        presence,
        timestamp: new Date(),
      };

      for (const callback of callbacks) {
        try {
          callback(event);
        } catch (error) {
          // Log but don't throw - we don't want one callback to break others
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.error('Error in presence change callback:', error);
          }
        }
      }
    }
  }

  /**
   * Gets all currently subscribed user IDs.
   *
   * @returns Array of user IDs with active subscriptions
   */
  getSubscribedUsers(): string[] {
    return Array.from(this.presenceSubscriptions.keys());
  }

  /**
   * Clears all presence subscriptions.
   */
  clearAllSubscriptions(): void {
    this.presenceSubscriptions.clear();
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Normalizes an emoji string to the Slack format (:emoji:).
   *
   * @param emoji - Emoji string (with or without colons)
   * @returns Normalized emoji string
   */
  private normalizeEmoji(emoji: string): string {
    if (!emoji) {
return '';
}

    // If already in :emoji: format, return as-is
    if (emoji.startsWith(':') && emoji.endsWith(':')) {
      return emoji;
    }

    // Add colons if not present
    return `:${emoji.replace(/^:|:$/g, '')}:`;
  }

  /**
   * Calculates expiration date from duration in minutes.
   *
   * @param durationMinutes - Duration in minutes (undefined = no expiration)
   * @returns Date object or undefined
   */
  private calculateExpiration(durationMinutes?: number): Date | undefined {
    if (durationMinutes === undefined || durationMinutes <= 0) {
      return undefined;
    }
    return new Date(Date.now() + durationMinutes * 60 * 1000);
  }

  /**
   * Sets a custom preset status.
   *
   * @param preset - Preset status configuration
   * @param duration - Optional duration override in minutes
   * @throws {PresenceStatusError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.setPresetStatus({
   *   text: 'On a call',
   *   emoji: ':phone:',
   *   defaultDuration: 30
   * });
   * ```
   */
  async setPresetStatus(preset: PresetStatus, duration?: number): Promise<void> {
    const expiration = this.calculateExpiration(duration ?? preset.defaultDuration);
    await this.setStatus(preset.text, preset.emoji, expiration);
  }

  /**
   * Checks if a user is currently online.
   * Convenience method that wraps getPresence.
   *
   * @param userId - User ID to check
   * @returns True if user is online, false otherwise
   *
   * @example
   * ```typescript
   * if (await manager.isOnline('U12345678')) {
   *   console.log('User is available');
   * }
   * ```
   */
  async isOnline(userId: string): Promise<boolean> {
    const presence = await this.getPresence(userId);
    return presence.online;
  }

  /**
   * Gets the current status text for a user.
   * Convenience method that wraps getUserStatus.
   *
   * @param userId - User ID to check
   * @returns Status text or empty string if no status
   *
   * @example
   * ```typescript
   * const status = await manager.getStatusText('U12345678');
   * console.log(`Current status: ${status || '(none)'}`);
   * ```
   */
  async getStatusText(userId: string): Promise<string> {
    const status = await this.getUserStatus(userId);
    return status.text;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new PresenceStatusManager instance.
 *
 * @param client - Slack WebClient with user token
 * @returns Configured PresenceStatusManager
 *
 * @example
 * ```typescript
 * import { createPresenceStatusManager } from '@wundr/slack-agent/capabilities/presence-status';
 * import { WebClient } from '@slack/web-api';
 *
 * const manager = createPresenceStatusManager(new WebClient(process.env.SLACK_USER_TOKEN));
 * ```
 */
export function createPresenceStatusManager(client: WebClient): PresenceStatusManager {
  return new PresenceStatusManager(client);
}

// =============================================================================
// Default Export
// =============================================================================

export default PresenceStatusManager;
