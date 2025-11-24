/**
 * @wundr/slack-agent - Huddles and Calls Capability
 *
 * Implements Slack Huddles (audio/video calls) management for VP (Virtual Principal) agents.
 * Enables the VP agent to initiate, join, leave, and manage huddles like any human user.
 *
 * **IMPORTANT LIMITATIONS:**
 * Slack does not provide a public API for programmatically starting or joining huddles.
 * The Slack Web API only supports:
 * - Getting huddle status via `conversations.info` (limited information)
 * - Starting Slack Calls (different from Huddles) via `calls.add` API
 *
 * This module provides two approaches:
 * 1. **API-based methods** - Use official Slack APIs where available (limited functionality)
 * 2. **Desktop automation methods** - Use AppleScript to control the Slack desktop app on macOS
 *
 * Method suffix documentation:
 * - Methods without suffix: Use Slack API (may have limitations)
 * - Methods with `ViaDesktop` suffix: Use AppleScript/desktop automation (macOS only)
 *
 * @example
 * ```typescript
 * import { HuddleCallsManager } from '@wundr/slack-agent/capabilities/huddles-calls';
 * import { WebClient } from '@slack/web-api';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const huddleManager = new HuddleCallsManager(client);
 *
 * // Check if a huddle is active in a channel
 * const isActive = await huddleManager.isHuddleActive('C12345');
 *
 * // Start a huddle via desktop automation (macOS)
 * await huddleManager.startHuddleViaDesktop('C12345');
 *
 * // Get huddle status
 * const status = await huddleManager.getHuddleStatus('C12345');
 * ```
 *
 * @packageDocumentation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import type { WebClient } from '@slack/web-api';

const execAsync = promisify(exec);

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Participant information in a huddle
 */
export interface HuddleParticipant {
  /** User ID of the participant */
  readonly userId: string;
  /** Display name (if available) */
  readonly displayName?: string;
  /** Whether the participant is muted */
  readonly isMuted?: boolean;
  /** Whether the participant has video enabled */
  readonly hasVideo?: boolean;
  /** Timestamp when the user joined */
  readonly joinedAt?: number;
}

/**
 * Comprehensive huddle information
 */
export interface HuddleInfo {
  /** Channel ID where the huddle is taking place */
  readonly channelId: string;
  /** List of participants in the huddle */
  readonly participants: HuddleParticipant[];
  /** When the huddle started (Unix timestamp) */
  readonly startTime: number;
  /** Whether the huddle is currently active */
  readonly isActive: boolean;
  /** Huddle call ID (if available from API) */
  readonly callId?: string;
  /** Huddle title/topic (if set) */
  readonly title?: string;
  /** Whether this VP agent is in the huddle */
  readonly isSelfInHuddle?: boolean;
}

/**
 * Slack Call information (different from Huddle)
 * Slack Calls are external call integrations, not native Huddles
 */
export interface SlackCallInfo {
  /** Unique call ID */
  readonly callId: string;
  /** External unique ID */
  readonly externalUniqueId: string;
  /** Join URL for the call */
  readonly joinUrl: string;
  /** Desktop app URL */
  readonly desktopAppJoinUrl?: string;
  /** Call title */
  readonly title?: string;
  /** When the call was created */
  readonly dateStart: number;
  /** When the call ended (if ended) */
  readonly dateEnd?: number;
}

/**
 * Options for starting a Slack Call (not Huddle)
 */
export interface StartCallOptions {
  /** External display ID */
  externalDisplayId?: string;
  /** Call title */
  title?: string;
  /** Desktop app join URL */
  desktopAppJoinUrl?: string;
  /** User IDs to add to the call */
  users?: string[];
}

/**
 * Huddle error codes
 */
export enum HuddleErrorCode {
  /** Huddle not found or not active */
  NOT_FOUND = 'huddle_not_found',
  /** Channel not found */
  CHANNEL_NOT_FOUND = 'channel_not_found',
  /** Permission denied */
  PERMISSION_DENIED = 'not_allowed',
  /** Rate limited */
  RATE_LIMITED = 'ratelimited',
  /** Desktop app not available */
  DESKTOP_NOT_AVAILABLE = 'desktop_not_available',
  /** Platform not supported (not macOS) */
  PLATFORM_NOT_SUPPORTED = 'platform_not_supported',
  /** AppleScript execution failed */
  APPLESCRIPT_FAILED = 'applescript_failed',
  /** API not supported for this operation */
  API_NOT_SUPPORTED = 'api_not_supported',
  /** Already in a huddle */
  ALREADY_IN_HUDDLE = 'already_in_huddle',
  /** Not in a huddle */
  NOT_IN_HUDDLE = 'not_in_huddle',
  /** General error */
  UNKNOWN = 'unknown_error',
}

/**
 * Error thrown when huddle operations fail
 */
export class HuddleError extends Error {
  /** Error code */
  readonly code: HuddleErrorCode | string;
  /** Original Slack API error (if available) */
  readonly slackError?: string;
  /** Channel ID related to the error (if available) */
  readonly channelId?: string;

  constructor(
    message: string,
    code: HuddleErrorCode | string,
    options?: { slackError?: string; channelId?: string },
  ) {
    super(message);
    this.name = 'HuddleError';
    this.code = code;
    this.slackError = options?.slackError;
    this.channelId = options?.channelId;
  }
}

/**
 * Configuration for HuddleCallsManager
 */
export interface HuddleCallsManagerConfig {
  /** Maximum retries on rate limit */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
  /** Timeout for AppleScript operations in milliseconds */
  appleScriptTimeoutMs?: number;
  /** Workspace domain for URL construction (e.g., 'mycompany.slack.com') */
  workspaceDomain?: string;
}

// =============================================================================
// HuddleCallsManager Implementation
// =============================================================================

/**
 * HuddleCallsManager - Manages Slack Huddles and Calls for the VP agent
 *
 * Provides methods to interact with Slack Huddles (native audio/video calls)
 * and Slack Calls API. Due to API limitations, some operations require
 * desktop automation via AppleScript on macOS.
 *
 * @remarks
 * **API Limitations:**
 * - Slack does NOT provide APIs to programmatically start/join huddles
 * - The `conversations.info` API provides limited huddle presence info
 * - The `calls.*` APIs are for external call integrations, NOT native huddles
 *
 * **Desktop Automation:**
 * - Uses AppleScript to control Slack desktop app on macOS
 * - Requires Slack desktop app to be installed and running
 * - Requires accessibility permissions for automation
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { HuddleCallsManager } from '@wundr/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const manager = new HuddleCallsManager(client);
 *
 * // Check huddle status (API-based)
 * const status = await manager.getHuddleStatus('C12345');
 * if (status?.isActive) {
 *   console.log(`Huddle active with ${status.participants.length} participants`);
 * }
 *
 * // Start huddle via desktop app (macOS only)
 * if (manager.isDesktopAutomationAvailable()) {
 *   await manager.startHuddleViaDesktop('C12345');
 * }
 * ```
 */
export class HuddleCallsManager {
  private readonly client: WebClient;
  private readonly config: Required<HuddleCallsManagerConfig>;
  private currentHuddleChannelId: string | null = null;

  /**
   * Creates a new HuddleCallsManager instance
   *
   * @param client - Authenticated Slack WebClient instance (user token recommended)
   * @param config - Optional configuration
   */
  constructor(client: WebClient, config: HuddleCallsManagerConfig = {}) {
    this.client = client;
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      appleScriptTimeoutMs: config.appleScriptTimeoutMs ?? 30000,
      workspaceDomain: config.workspaceDomain ?? '',
    };
  }

  // ===========================================================================
  // Huddle Status Methods (API-based)
  // ===========================================================================

  /**
   * Gets huddle status for a channel
   *
   * **Method Type:** API-based
   *
   * Uses the `conversations.info` API to check if a huddle is active.
   * Note: This provides limited information - full participant details
   * may not be available via API.
   *
   * @param channelId - Channel ID to check
   * @returns HuddleInfo if huddle is active, null otherwise
   * @throws {HuddleError} If the API call fails
   *
   * @example
   * ```typescript
   * const status = await manager.getHuddleStatus('C12345');
   * if (status) {
   *   console.log(`Huddle started at ${new Date(status.startTime * 1000)}`);
   *   console.log(`Participants: ${status.participants.length}`);
   * }
   * ```
   */
  async getHuddleStatus(channelId: string): Promise<HuddleInfo | null> {
    try {
      const response = await this.withRetry(() =>
        this.client.conversations.info({
          channel: channelId,
          include_num_members: true,
        }),
      );

      if (!response.ok || !response.channel) {
        throw new HuddleError(
          `Failed to get channel info: ${response.error || 'Unknown error'}`,
          response.error || HuddleErrorCode.CHANNEL_NOT_FOUND,
          { slackError: response.error, channelId },
        );
      }

      const channel = response.channel as Record<string, unknown>;

      // Check for huddle/call information in channel properties
      // Note: Slack's API returns huddle info in 'properties' object
      const properties = channel.properties as Record<string, unknown> | undefined;
      const canvas = properties?.canvas as Record<string, unknown> | undefined;
      const huddle = canvas?.huddle as Record<string, unknown> | undefined;

      // Alternative: Check for active call in the channel
      // This is limited information from the API
      const hasActiveHuddle = Boolean(huddle) || Boolean(channel.is_huddle_active);

      if (!hasActiveHuddle) {
        return null;
      }

      // Build huddle info from available data
      // Note: Full participant list is not available via conversations.info
      const huddleInfo: HuddleInfo = {
        channelId,
        participants: [],
        startTime: (huddle?.start_time as number) || Math.floor(Date.now() / 1000),
        isActive: true,
        callId: huddle?.call_id as string | undefined,
        title: huddle?.title as string | undefined,
        isSelfInHuddle: false,
      };

      // Try to get participant info if available
      const participantIds = huddle?.participants as string[] | undefined;
      if (participantIds && Array.isArray(participantIds)) {
        huddleInfo.participants.push(
          ...participantIds.map((userId) => ({
            userId,
          })),
        );
      }

      return huddleInfo;
    } catch (error) {
      if (error instanceof HuddleError) {
        throw error;
      }
      throw this.handleSlackError(error, 'get huddle status', channelId);
    }
  }

  /**
   * Checks if a huddle is currently active in a channel
   *
   * **Method Type:** API-based
   *
   * @param channelId - Channel ID to check
   * @returns True if a huddle is active, false otherwise
   *
   * @example
   * ```typescript
   * if (await manager.isHuddleActive('C12345')) {
   *   console.log('There is an active huddle in this channel');
   * }
   * ```
   */
  async isHuddleActive(channelId: string): Promise<boolean> {
    try {
      const status = await this.getHuddleStatus(channelId);
      return status !== null && status.isActive;
    } catch (error) {
      // If we can't check, assume no huddle
      if (error instanceof HuddleError && error.code === HuddleErrorCode.CHANNEL_NOT_FOUND) {
        return false;
      }
      throw error;
    }
  }

  // ===========================================================================
  // Huddle Management Methods (API-based - LIMITED SUPPORT)
  // ===========================================================================

  /**
   * Starts a huddle in a channel
   *
   * **Method Type:** API-based (LIMITED - NOT FULLY SUPPORTED)
   *
   * **IMPORTANT:** Slack does NOT provide a public API to start huddles programmatically.
   * This method will throw an error indicating the limitation.
   * Use `startHuddleViaDesktop()` for desktop automation approach.
   *
   * @param channelId - Channel ID to start huddle in
   * @returns HuddleInfo for the started huddle
   * @throws {HuddleError} Always throws - API not supported
   *
   * @example
   * ```typescript
   * try {
   *   await manager.startHuddle('C12345');
   * } catch (error) {
   *   if (error.code === 'api_not_supported') {
   *     // Use desktop automation instead
   *     await manager.startHuddleViaDesktop('C12345');
   *   }
   * }
   * ```
   */
  async startHuddle(channelId: string): Promise<HuddleInfo> {
    // Slack does not provide an API to start huddles
    // This method exists for API completeness but will throw
    throw new HuddleError(
      'Starting huddles via API is not supported by Slack. ' +
        'Use startHuddleViaDesktop() for macOS desktop automation, ' +
        'or use the Slack desktop/mobile app directly.',
      HuddleErrorCode.API_NOT_SUPPORTED,
      { channelId },
    );
  }

  /**
   * Joins an active huddle in a channel
   *
   * **Method Type:** API-based (LIMITED - NOT FULLY SUPPORTED)
   *
   * **IMPORTANT:** Slack does NOT provide a public API to join huddles programmatically.
   * This method will throw an error indicating the limitation.
   * Use `joinHuddleViaDesktop()` for desktop automation approach.
   *
   * @param channelId - Channel ID with active huddle
   * @throws {HuddleError} Always throws - API not supported
   *
   * @example
   * ```typescript
   * try {
   *   await manager.joinHuddle('C12345');
   * } catch (error) {
   *   if (error.code === 'api_not_supported') {
   *     await manager.joinHuddleViaDesktop('C12345');
   *   }
   * }
   * ```
   */
  async joinHuddle(channelId: string): Promise<void> {
    throw new HuddleError(
      'Joining huddles via API is not supported by Slack. ' +
        'Use joinHuddleViaDesktop() for macOS desktop automation, ' +
        'or use the Slack desktop/mobile app directly.',
      HuddleErrorCode.API_NOT_SUPPORTED,
      { channelId },
    );
  }

  /**
   * Leaves the current huddle
   *
   * **Method Type:** API-based (LIMITED - NOT FULLY SUPPORTED)
   *
   * **IMPORTANT:** Slack does NOT provide a public API to leave huddles programmatically.
   * This method will throw an error indicating the limitation.
   * Use `leaveHuddleViaDesktop()` for desktop automation approach.
   *
   * @throws {HuddleError} Always throws - API not supported
   *
   * @example
   * ```typescript
   * try {
   *   await manager.leaveHuddle();
   * } catch (error) {
   *   if (error.code === 'api_not_supported') {
   *     await manager.leaveHuddleViaDesktop();
   *   }
   * }
   * ```
   */
  async leaveHuddle(): Promise<void> {
    throw new HuddleError(
      'Leaving huddles via API is not supported by Slack. ' +
        'Use leaveHuddleViaDesktop() for macOS desktop automation, ' +
        'or use the Slack desktop/mobile app directly.',
      HuddleErrorCode.API_NOT_SUPPORTED,
    );
  }

  /**
   * Invites users to a huddle
   *
   * **Method Type:** API-based (LIMITED - NOT FULLY SUPPORTED)
   *
   * **IMPORTANT:** Slack does NOT provide a public API to invite to huddles programmatically.
   * This method will throw an error indicating the limitation.
   *
   * As a workaround, you can send a message mentioning users with a request to join.
   *
   * @param channelId - Channel ID with active huddle
   * @param userIds - User IDs to invite
   * @throws {HuddleError} Always throws - API not supported
   *
   * @example
   * ```typescript
   * // This will throw - use messaging as workaround
   * // await manager.inviteToHuddle('C12345', ['U67890']);
   *
   * // Workaround: Send a message instead
   * // await messageManager.postMessage('C12345', 'Hey <@U67890>, join our huddle!');
   * ```
   */
  async inviteToHuddle(channelId: string, userIds: string[]): Promise<void> {
    // Store for error context
    const _userIds = userIds;

    throw new HuddleError(
      'Inviting to huddles via API is not supported by Slack. ' +
        'Consider sending a message to the channel mentioning the users instead.',
      HuddleErrorCode.API_NOT_SUPPORTED,
      { channelId },
    );
  }

  // ===========================================================================
  // Desktop Automation Methods (AppleScript - macOS only)
  // ===========================================================================

  /**
   * Checks if desktop automation is available on this platform
   *
   * @returns True if running on macOS, false otherwise
   *
   * @example
   * ```typescript
   * if (manager.isDesktopAutomationAvailable()) {
   *   await manager.startHuddleViaDesktop('C12345');
   * } else {
   *   console.log('Desktop automation requires macOS');
   * }
   * ```
   */
  isDesktopAutomationAvailable(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Starts a huddle in a channel using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * Uses AppleScript to:
   * 1. Activate Slack desktop app
   * 2. Navigate to the specified channel
   * 3. Start a huddle using keyboard shortcuts
   *
   * **Requirements:**
   * - macOS operating system
   * - Slack desktop app installed and logged in
   * - Accessibility permissions for automation
   *
   * @param channelId - Channel ID to start huddle in
   * @throws {HuddleError} If platform is not macOS or automation fails
   *
   * @example
   * ```typescript
   * try {
   *   await manager.startHuddleViaDesktop('C12345');
   *   console.log('Huddle started via desktop app');
   * } catch (error) {
   *   if (error.code === 'platform_not_supported') {
   *     console.log('This feature requires macOS');
   *   }
   * }
   * ```
   */
  async startHuddleViaDesktop(channelId: string): Promise<void> {
    this.validatePlatform();

    const script = this.buildNavigateAndStartHuddleScript(channelId);

    try {
      await this.executeAppleScript(script);
      this.currentHuddleChannelId = channelId;
    } catch (error) {
      throw this.handleAppleScriptError(error, 'start huddle', channelId);
    }
  }

  /**
   * Joins an active huddle using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * Uses AppleScript to navigate to the channel and click the huddle join button.
   *
   * @param channelId - Channel ID with active huddle
   * @throws {HuddleError} If platform is not macOS or automation fails
   *
   * @example
   * ```typescript
   * // First check if huddle is active
   * if (await manager.isHuddleActive('C12345')) {
   *   await manager.joinHuddleViaDesktop('C12345');
   * }
   * ```
   */
  async joinHuddleViaDesktop(channelId: string): Promise<void> {
    this.validatePlatform();

    const script = this.buildNavigateAndJoinHuddleScript(channelId);

    try {
      await this.executeAppleScript(script);
      this.currentHuddleChannelId = channelId;
    } catch (error) {
      throw this.handleAppleScriptError(error, 'join huddle', channelId);
    }
  }

  /**
   * Leaves the current huddle using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * Uses AppleScript to click the leave button in the huddle window.
   *
   * @throws {HuddleError} If platform is not macOS or automation fails
   *
   * @example
   * ```typescript
   * await manager.leaveHuddleViaDesktop();
   * console.log('Left the huddle');
   * ```
   */
  async leaveHuddleViaDesktop(): Promise<void> {
    this.validatePlatform();

    const script = this.buildLeaveHuddleScript();

    try {
      await this.executeAppleScript(script);
      this.currentHuddleChannelId = null;
    } catch (error) {
      throw this.handleAppleScriptError(error, 'leave huddle');
    }
  }

  /**
   * Toggles mute status using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * Uses keyboard shortcut (Cmd+Shift+M) to toggle mute in active huddle.
   *
   * @throws {HuddleError} If platform is not macOS or automation fails
   *
   * @example
   * ```typescript
   * await manager.toggleMuteViaDesktop();
   * ```
   */
  async toggleMuteViaDesktop(): Promise<void> {
    this.validatePlatform();

    const script = `
      tell application "Slack"
        activate
      end tell
      delay 0.3
      tell application "System Events"
        keystroke "m" using {command down, shift down}
      end tell
    `;

    try {
      await this.executeAppleScript(script);
    } catch (error) {
      throw this.handleAppleScriptError(error, 'toggle mute');
    }
  }

  /**
   * Toggles video status using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * Uses keyboard shortcut (Cmd+Shift+V) to toggle video in active huddle.
   *
   * @throws {HuddleError} If platform is not macOS or automation fails
   *
   * @example
   * ```typescript
   * await manager.toggleVideoViaDesktop();
   * ```
   */
  async toggleVideoViaDesktop(): Promise<void> {
    this.validatePlatform();

    const script = `
      tell application "Slack"
        activate
      end tell
      delay 0.3
      tell application "System Events"
        keystroke "v" using {command down, shift down}
      end tell
    `;

    try {
      await this.executeAppleScript(script);
    } catch (error) {
      throw this.handleAppleScriptError(error, 'toggle video');
    }
  }

  /**
   * Opens the huddle thread/chat using Slack desktop app automation
   *
   * **Method Type:** Desktop automation (macOS only)
   *
   * @throws {HuddleError} If platform is not macOS or automation fails
   */
  async openHuddleThreadViaDesktop(): Promise<void> {
    this.validatePlatform();

    const script = `
      tell application "Slack"
        activate
      end tell
      delay 0.3
      tell application "System Events"
        keystroke "t" using {command down, shift down}
      end tell
    `;

    try {
      await this.executeAppleScript(script);
    } catch (error) {
      throw this.handleAppleScriptError(error, 'open huddle thread');
    }
  }

  // ===========================================================================
  // Slack Calls API (Different from Huddles)
  // ===========================================================================

  /**
   * Creates a new Slack Call (external call integration)
   *
   * **Method Type:** API-based
   *
   * **Note:** This is different from Huddles! Slack Calls are for integrating
   * external call services (like Zoom, Google Meet) into Slack.
   *
   * @param externalUniqueId - Unique ID from external call service
   * @param joinUrl - URL to join the call
   * @param options - Additional call options
   * @returns Created call information
   * @throws {HuddleError} If the API call fails
   *
   * @example
   * ```typescript
   * const call = await manager.createCall(
   *   'zoom-meeting-123',
   *   'https://zoom.us/j/123456789',
   *   { title: 'Team Standup' }
   * );
   * console.log(`Call created: ${call.callId}`);
   * ```
   */
  async createCall(
    externalUniqueId: string,
    joinUrl: string,
    options: StartCallOptions = {},
  ): Promise<SlackCallInfo> {
    try {
      const response = await this.withRetry(() =>
        this.client.calls.add({
          external_unique_id: externalUniqueId,
          join_url: joinUrl,
          external_display_id: options.externalDisplayId,
          title: options.title,
          desktop_app_join_url: options.desktopAppJoinUrl,
          users: options.users?.map((userId) => ({ slack_id: userId })),
        }),
      );

      if (!response.ok || !response.call) {
        throw new HuddleError(
          `Failed to create call: ${response.error || 'Unknown error'}`,
          response.error || HuddleErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      const call = response.call as Record<string, unknown>;

      return {
        callId: call.id as string,
        externalUniqueId: call.external_unique_id as string,
        joinUrl: call.join_url as string,
        desktopAppJoinUrl: call.desktop_app_join_url as string | undefined,
        title: call.title as string | undefined,
        dateStart: call.date_start as number,
        dateEnd: call.date_end as number | undefined,
      };
    } catch (error) {
      if (error instanceof HuddleError) {
        throw error;
      }
      throw this.handleSlackError(error, 'create call');
    }
  }

  /**
   * Ends a Slack Call
   *
   * **Method Type:** API-based
   *
   * @param callId - Call ID to end
   * @param duration - Optional call duration in seconds
   * @throws {HuddleError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.endCall('R12345', 1800); // 30 minute call
   * ```
   */
  async endCall(callId: string, duration?: number): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.calls.end({
          id: callId,
          duration,
        }),
      );

      if (!response.ok) {
        throw new HuddleError(
          `Failed to end call: ${response.error || 'Unknown error'}`,
          response.error || HuddleErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }
    } catch (error) {
      if (error instanceof HuddleError) {
        throw error;
      }
      throw this.handleSlackError(error, 'end call');
    }
  }

  /**
   * Updates call participants
   *
   * **Method Type:** API-based
   *
   * @param callId - Call ID to update
   * @param addUsers - User IDs to add
   * @param removeUsers - User IDs to remove
   * @throws {HuddleError} If the API call fails
   *
   * @example
   * ```typescript
   * await manager.updateCallParticipants(
   *   'R12345',
   *   ['U67890'], // add these users
   *   ['U11111']  // remove these users
   * );
   * ```
   */
  async updateCallParticipants(
    callId: string,
    addUsers?: string[],
    removeUsers?: string[],
  ): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.calls.participants.add({
          id: callId,
          users: addUsers?.map((userId) => ({ slack_id: userId })) || [],
        }),
      );

      if (!response.ok) {
        throw new HuddleError(
          `Failed to update call participants: ${response.error || 'Unknown error'}`,
          response.error || HuddleErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      // Remove users if specified
      if (removeUsers && removeUsers.length > 0) {
        const removeResponse = await this.withRetry(() =>
          this.client.calls.participants.remove({
            id: callId,
            users: removeUsers.map((userId) => ({ slack_id: userId })),
          }),
        );

        if (!removeResponse.ok) {
          throw new HuddleError(
            `Failed to remove call participants: ${removeResponse.error || 'Unknown error'}`,
            removeResponse.error || HuddleErrorCode.UNKNOWN,
            { slackError: removeResponse.error },
          );
        }
      }
    } catch (error) {
      if (error instanceof HuddleError) {
        throw error;
      }
      throw this.handleSlackError(error, 'update call participants');
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Validates that the current platform supports desktop automation
   */
  private validatePlatform(): void {
    if (!this.isDesktopAutomationAvailable()) {
      throw new HuddleError(
        'Desktop automation is only available on macOS',
        HuddleErrorCode.PLATFORM_NOT_SUPPORTED,
      );
    }
  }

  /**
   * Executes an AppleScript with timeout handling
   */
  private async executeAppleScript(script: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        timeout: this.config.appleScriptTimeoutMs,
      });
      return stdout.trim();
    } catch (error) {
      const err = error as { stderr?: string; message?: string };
      throw new HuddleError(
        `AppleScript execution failed: ${err.stderr || err.message || 'Unknown error'}`,
        HuddleErrorCode.APPLESCRIPT_FAILED,
        { slackError: err.stderr || err.message },
      );
    }
  }

  /**
   * Builds AppleScript to navigate to channel and start huddle
   */
  private buildNavigateAndStartHuddleScript(channelId: string): string {
    // Use Cmd+K to open quick switcher, then navigate to channel
    // Then use Cmd+Shift+H to start huddle (Slack's keyboard shortcut)
    return `
      tell application "Slack"
        activate
      end tell
      delay 0.5
      tell application "System Events"
        -- Open Quick Switcher
        keystroke "k" using {command down}
        delay 0.3
        -- Type channel ID (user should map this to channel name in practice)
        keystroke "${channelId}"
        delay 0.5
        -- Press Enter to go to channel
        keystroke return
        delay 0.5
        -- Start Huddle (Cmd+Shift+H)
        keystroke "h" using {command down, shift down}
      end tell
    `;
  }

  /**
   * Builds AppleScript to navigate to channel and join existing huddle
   */
  private buildNavigateAndJoinHuddleScript(channelId: string): string {
    return `
      tell application "Slack"
        activate
      end tell
      delay 0.5
      tell application "System Events"
        -- Open Quick Switcher
        keystroke "k" using {command down}
        delay 0.3
        -- Type channel ID
        keystroke "${channelId}"
        delay 0.5
        -- Press Enter to go to channel
        keystroke return
        delay 0.5
        -- Join Huddle (Cmd+Shift+H) - same as start if huddle exists
        keystroke "h" using {command down, shift down}
      end tell
    `;
  }

  /**
   * Builds AppleScript to leave current huddle
   */
  private buildLeaveHuddleScript(): string {
    return `
      tell application "Slack"
        activate
      end tell
      delay 0.3
      tell application "System Events"
        -- Leave Huddle (Cmd+Shift+H toggles huddle state)
        keystroke "h" using {command down, shift down}
      end tell
    `;
  }

  /**
   * Handle Slack API errors
   */
  private handleSlackError(
    error: unknown,
    operation: string,
    channelId?: string,
  ): HuddleError {
    const slackError =
      error instanceof Error
        ? (error as { data?: { error?: string } }).data?.error || error.message
        : 'Unknown error';

    let code: HuddleErrorCode | string = HuddleErrorCode.UNKNOWN;

    if (typeof slackError === 'string') {
      switch (slackError) {
        case 'channel_not_found':
          code = HuddleErrorCode.CHANNEL_NOT_FOUND;
          break;
        case 'not_allowed':
        case 'not_authorized':
        case 'missing_scope':
          code = HuddleErrorCode.PERMISSION_DENIED;
          break;
        case 'ratelimited':
          code = HuddleErrorCode.RATE_LIMITED;
          break;
        default:
          code = slackError;
      }
    }

    return new HuddleError(`Failed to ${operation}: ${slackError}`, code, {
      slackError: typeof slackError === 'string' ? slackError : undefined,
      channelId,
    });
  }

  /**
   * Handle AppleScript errors
   */
  private handleAppleScriptError(
    error: unknown,
    operation: string,
    channelId?: string,
  ): HuddleError {
    if (error instanceof HuddleError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    return new HuddleError(
      `Failed to ${operation} via desktop automation: ${message}`,
      HuddleErrorCode.APPLESCRIPT_FAILED,
      { slackError: message, channelId },
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

        const slackError =
          error instanceof Error
            ? (error as { data?: { error?: string } }).data?.error
            : undefined;

        if (slackError === 'ratelimited') {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

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

  /**
   * Gets the channel ID of the current huddle (if tracked)
   *
   * @returns Channel ID of current huddle, or null if not in a huddle
   */
  getCurrentHuddleChannelId(): string | null {
    return this.currentHuddleChannelId;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a HuddleCallsManager instance
 *
 * @param client - Authenticated Slack WebClient
 * @param config - Optional configuration
 * @returns HuddleCallsManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createHuddleCallsManager } from '@wundr/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_USER_TOKEN);
 * const huddleManager = createHuddleCallsManager(client);
 * ```
 */
export function createHuddleCallsManager(
  client: WebClient,
  config?: HuddleCallsManagerConfig,
): HuddleCallsManager {
  return new HuddleCallsManager(client, config);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is a HuddleError
 */
export function isHuddleError(error: unknown): error is HuddleError {
  return error instanceof HuddleError;
}

/**
 * Check if error indicates API is not supported
 */
export function isApiNotSupportedError(error: unknown): boolean {
  return isHuddleError(error) && error.code === HuddleErrorCode.API_NOT_SUPPORTED;
}

/**
 * Check if error is a permission error
 */
export function isHuddlePermissionError(error: unknown): boolean {
  return isHuddleError(error) && error.code === HuddleErrorCode.PERMISSION_DENIED;
}

/**
 * Check if error is a rate limit error
 */
export function isHuddleRateLimitError(error: unknown): boolean {
  return isHuddleError(error) && error.code === HuddleErrorCode.RATE_LIMITED;
}

/**
 * Check if error indicates platform not supported
 */
export function isPlatformNotSupportedError(error: unknown): boolean {
  return isHuddleError(error) && error.code === HuddleErrorCode.PLATFORM_NOT_SUPPORTED;
}

// =============================================================================
// Default Export
// =============================================================================

export default HuddleCallsManager;
