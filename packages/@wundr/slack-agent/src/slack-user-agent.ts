/**
 * @wundr/slack-agent - Unified Slack User Agent
 *
 * The SlackUserAgent class integrates ALL Slack capabilities for a Orchestrator (Virtual Principal)
 * agent. The Orchestrator runs on its own dedicated machine with its own Slack user account,
 * appearing and behaving exactly like a human Slack user.
 *
 * This class provides a single, unified interface to:
 * - Messaging (send, reply, schedule, edit, delete)
 * - Reactions (add, remove, get)
 * - File operations (upload, download, share)
 * - Channel management (create, join, manage)
 * - Profile management (update, status, presence)
 * - Search (messages, files, users)
 * - Reminders
 * - Usergroups
 * - DND controls
 * - Starred items
 * - Bookmarks
 * - Threading
 *
 * @packageDocumentation
 */

import { LogLevel, SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { EventEmitter } from 'events';
import { BookmarkManager } from './capabilities/bookmarks.js';
import { ChannelManager } from './capabilities/channel-management.js';
import { ChannelMembershipManager } from './capabilities/channel-membership.js';
import { DndControlsManager } from './capabilities/dnd-controls.js';
import { SlackFileOperations } from './capabilities/file-operations.js';
import { MessageManager } from './capabilities/message-management.js';
import { PresenceStatusManager, PresetStatuses } from './capabilities/presence-status.js';
import { ProactiveMessenger } from './capabilities/proactive-messaging.js';
import { ProfileManager } from './capabilities/profile-management.js';
// Import all capability modules
import { CommonEmojis, SlackReactions } from './capabilities/reactions.js';
import { ReminderManager } from './capabilities/reminders.js';
import { SlackSearchCapability } from './capabilities/search.js';
import { StarredItemsManager } from './capabilities/starred-items.js';
import { SlackThreadingCapability } from './capabilities/threading.js';
import { UsergroupManager } from './capabilities/usergroups.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Orchestrator Identity information for the agent
 */
export interface VPIdentity {
  /** Full display name */
  name: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Email address */
  email: string;
  /** Optional path to avatar image */
  avatarPath?: string;
  /** Optional job title */
  title?: string;
  /** Optional pronouns */
  pronouns?: string;
  /** Optional timezone */
  timezone?: string;
}

/**
 * Configuration for the SlackUserAgent
 */
export interface SlackUserAgentConfig {
  /** User token (xoxp-) for user-level operations */
  userToken: string;
  /** Bot token (xoxb-) for bot operations */
  botToken: string;
  /** App token (xapp-) for Socket Mode */
  appToken: string;
  /** Signing secret for request verification */
  signingSecret: string;
  /** Orchestrator identity information */
  vpIdentity: VPIdentity;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-connect on start */
  autoConnect?: boolean;
  /** Default team ID for Enterprise Grid */
  defaultTeamId?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;
  /** User client connection status */
  userClientConnected: boolean;
  /** Bot client connection status */
  botClientConnected: boolean;
  /** Socket Mode connection status */
  socketModeConnected: boolean;
  /** User ID of the authenticated user */
  userId?: string;
  /** Team ID */
  teamId?: string;
  /** Any error messages */
  errors: string[];
}

/**
 * Slack event types for event handlers
 */
export type SlackEventType =
  | 'message'
  | 'app_mention'
  | 'reaction_added'
  | 'reaction_removed'
  | 'member_joined_channel'
  | 'member_left_channel'
  | 'channel_created'
  | 'channel_deleted'
  | 'channel_archive'
  | 'channel_unarchive'
  | 'user_change'
  | 'team_join'
  | 'file_shared'
  | 'file_created'
  | 'file_deleted'
  | 'pin_added'
  | 'pin_removed'
  | 'star_added'
  | 'star_removed';

/**
 * Generic Slack event payload
 */
export interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  ts?: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Event handler callback type
 */
export type EventHandler<T = SlackEvent> = (event: T) => void | Promise<void>;

// =============================================================================
// SlackUserAgent Class
// =============================================================================

/**
 * Unified Slack User Agent that integrates ALL Slack capabilities.
 *
 * The Orchestrator (Virtual Principal) agent operates as a full user in Slack workspaces,
 * with its own user account, tokens, and identity. This class provides a single
 * interface to all Slack functionality.
 *
 * @example
 * ```typescript
 * import { SlackUserAgent } from '@wundr/slack-agent';
 *
 * const agent = new SlackUserAgent({
 *   userToken: process.env.SLACK_USER_TOKEN!,
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   appToken: process.env.SLACK_APP_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 *   vpIdentity: {
 *     name: 'Ada VP',
 *     firstName: 'Ada',
 *     lastName: 'VP',
 *     email: 'ada@adaptic.ai',
 *   },
 * });
 *
 * // Start the agent
 * await agent.start();
 *
 * // Send a message
 * await agent.sendMessage('C123456', 'Hello from Ada!');
 *
 * // React to a message
 * await agent.addReaction('C123456', '1234567890.123456', 'thumbsup');
 *
 * // Set status
 * await agent.setStatus('Working on feature', ':computer:');
 *
 * // Listen for events
 * agent.onMessage(async (event) => {
 *   console.log(`Received message: ${event.text}`);
 * });
 *
 * // Stop the agent
 * await agent.stop();
 * ```
 */
export class SlackUserAgent extends EventEmitter {
  // Clients
  private readonly userClient: WebClient;
  private readonly botClient: WebClient;
  private socketModeClient: SocketModeClient | null = null;

  // Configuration
  private readonly config: SlackUserAgentConfig;
  private readonly debug: boolean;

  // State
  private isConnected: boolean = false;
  private userId: string | null = null;
  private teamId: string | null = null;

  // Capability modules
  private readonly _reactions: SlackReactions;
  private readonly _profile: ProfileManager;
  private readonly _search: SlackSearchCapability;
  private readonly _presence: PresenceStatusManager;
  private readonly _channels: ChannelManager;
  private readonly _membership: ChannelMembershipManager;
  private readonly _dnd: DndControlsManager;
  private readonly _files: SlackFileOperations;
  private readonly _threading: SlackThreadingCapability;
  private readonly _messages: MessageManager;
  private readonly _reminders: ReminderManager;
  private readonly _stars: StarredItemsManager;
  private readonly _proactive: ProactiveMessenger;
  private readonly _bookmarks: BookmarkManager;
  private readonly _usergroups: UsergroupManager;

  /**
   * Creates a new SlackUserAgent instance
   *
   * @param config - Configuration options
   */
  constructor(config: SlackUserAgentConfig) {
    super();
    this.config = config;
    this.debug = config.debug ?? false;

    // Initialize WebClients
    this.userClient = new WebClient(config.userToken);
    this.botClient = new WebClient(config.botToken);

    // Initialize all capability modules
    this._reactions = new SlackReactions(config.userToken);
    this._profile = new ProfileManager({ token: config.userToken });
    this._search = new SlackSearchCapability(this.userClient);
    this._presence = new PresenceStatusManager(this.userClient);
    this._channels = new ChannelManager(this.botClient, {
      defaultTeamId: config.defaultTeamId,
    });
    this._membership = new ChannelMembershipManager(this.botClient);
    this._dnd = new DndControlsManager({ client: this.userClient, debug: config.debug });
    this._files = new SlackFileOperations({ client: this.botClient });
    this._threading = new SlackThreadingCapability(this.botClient);
    this._messages = new MessageManager(this.botClient);
    this._reminders = new ReminderManager({ client: this.userClient, debug: config.debug });
    this._stars = new StarredItemsManager({ token: config.userToken, debug: config.debug });
    this._proactive = new ProactiveMessenger({
      userToken: config.userToken,
      botToken: config.botToken,
      debug: config.debug,
    });
    this._bookmarks = new BookmarkManager(this.botClient);
    this._usergroups = new UsergroupManager(this.botClient, {
      defaultTeamId: config.defaultTeamId,
    });

    this.log('SlackUserAgent initialized');
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Start the agent and connect to Slack
   *
   * Initializes Socket Mode for real-time events and sets up
   * the VP's profile based on the provided identity.
   *
   * @example
   * ```typescript
   * await agent.start();
   * console.log('Agent is now online!');
   * ```
   */
  async start(): Promise<void> {
    this.log('Starting SlackUserAgent...');

    try {
      // Test authentication and get user info
      const authResult = await this.userClient.auth.test();
      if (!authResult.ok) {
        throw new Error('Failed to authenticate user client');
      }

      this.userId = authResult.user_id as string;
      this.teamId = authResult.team_id as string;

      this.log(`Authenticated as user ${this.userId} in team ${this.teamId}`);

      // Initialize Socket Mode for real-time events
      this.socketModeClient = new SocketModeClient({
        appToken: this.config.appToken,
        logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
      });

      // Set up event handlers
      this.setupSocketModeHandlers();

      // Connect to Socket Mode
      await this.socketModeClient.start();
      this.isConnected = true;

      // Set up Orchestrator profile
      await this.setupVPProfile();

      this.log('SlackUserAgent started successfully');
      this.emit('ready', { userId: this.userId, teamId: this.teamId });
    } catch (error) {
      this.log('Failed to start SlackUserAgent', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Stop the agent and disconnect from Slack
   *
   * Gracefully shuts down Socket Mode connection and cleans up resources.
   *
   * @example
   * ```typescript
   * await agent.stop();
   * console.log('Agent is now offline');
   * ```
   */
  async stop(): Promise<void> {
    this.log('Stopping SlackUserAgent...');

    try {
      // Set presence to away before disconnecting
      await this._presence.setPresence('away').catch(() => {
        // Ignore errors when setting presence
      });

      // Disconnect Socket Mode
      if (this.socketModeClient) {
        await this.socketModeClient.disconnect();
        this.socketModeClient = null;
      }

      this.isConnected = false;
      this.log('SlackUserAgent stopped');
      this.emit('disconnected');
    } catch (error) {
      this.log('Error stopping SlackUserAgent', error);
      throw error;
    }
  }

  /**
   * Check if the agent is currently connected
   *
   * @returns True if connected to Slack
   */
  connected(): boolean {
    return this.isConnected;
  }

  /**
   * Perform a health check on all connections
   *
   * @returns Health check result with status of all components
   *
   * @example
   * ```typescript
   * const health = await agent.healthCheck();
   * if (!health.healthy) {
   *   console.error('Agent unhealthy:', health.errors);
   * }
   * ```
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      healthy: true,
      userClientConnected: false,
      botClientConnected: false,
      socketModeConnected: this.isConnected,
      errors: [],
    };

    // Test user client
    try {
      const userAuth = await this.userClient.auth.test();
      result.userClientConnected = userAuth.ok ?? false;
      result.userId = userAuth.user_id as string | undefined;
      result.teamId = userAuth.team_id as string | undefined;
    } catch (error) {
      result.userClientConnected = false;
      result.errors.push(`User client error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Test bot client
    try {
      const botAuth = await this.botClient.auth.test();
      result.botClientConnected = botAuth.ok ?? false;
    } catch (error) {
      result.botClientConnected = false;
      result.errors.push(`Bot client error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Check Socket Mode
    if (!result.socketModeConnected) {
      result.errors.push('Socket Mode not connected');
    }

    result.healthy = result.userClientConnected && result.botClientConnected && result.socketModeConnected;

    return result;
  }

  // ===========================================================================
  // Messaging Methods
  // ===========================================================================

  /**
   * Send a message to a channel
   *
   * @param channel - Channel ID
   * @param text - Message text
   * @param options - Additional options (thread_ts, etc.)
   * @returns Message result with timestamp
   *
   * @example
   * ```typescript
   * const result = await agent.sendMessage('C123456', 'Hello world!');
   * console.log(`Message sent: ${result.ts}`);
   * ```
   */
  async sendMessage(
    channel: string,
    text: string,
    options?: { threadTs?: string; replyBroadcast?: boolean },
  ): Promise<{ ok: boolean; channelId: string; ts: string }> {
    const result = await this._proactive.postToChannel(channel, text, {
      threadTs: options?.threadTs,
      replyBroadcast: options?.replyBroadcast,
    });
    return { ok: result.ok, channelId: result.channelId, ts: result.ts };
  }

  /**
   * Send a direct message to a user
   *
   * @param userId - User ID to message
   * @param text - Message text
   * @returns Message result
   *
   * @example
   * ```typescript
   * await agent.sendDM('U123456', 'Hi there!');
   * ```
   */
  async sendDM(userId: string, text: string): Promise<{ ok: boolean; channelId: string; ts: string }> {
    const result = await this._proactive.sendDM(userId, text);
    return { ok: result.ok, channelId: result.channelId, ts: result.ts };
  }

  /**
   * Reply to a thread
   *
   * @param channel - Channel ID
   * @param threadTs - Thread timestamp
   * @param text - Reply text
   * @param broadcast - Whether to broadcast to channel
   *
   * @example
   * ```typescript
   * await agent.replyToThread('C123456', '1234567890.123456', 'Great point!');
   * ```
   */
  async replyToThread(
    channel: string,
    threadTs: string,
    text: string,
    broadcast: boolean = false,
  ): Promise<{ ok: boolean; channel: string; ts: string }> {
    if (broadcast) {
      return this._threading.replyAndBroadcast(channel, threadTs, text);
    }
    return this._threading.replyToThread(channel, threadTs, text);
  }

  /**
   * Schedule a message for later
   *
   * @param channel - Channel ID
   * @param text - Message text
   * @param postAt - When to post the message
   * @returns Scheduled message result
   *
   * @example
   * ```typescript
   * const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
   * await agent.scheduleMessage('C123456', 'Reminder!', futureDate);
   * ```
   */
  async scheduleMessage(
    channel: string,
    text: string,
    postAt: Date,
  ): Promise<{ scheduledMessageId: string; channelId: string; postAt: number }> {
    return this._proactive.scheduleMessage(channel, text, postAt);
  }

  /**
   * Edit a message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param newText - New message text
   *
   * @example
   * ```typescript
   * await agent.editMessage('C123456', '1234567890.123456', 'Updated message');
   * ```
   */
  async editMessage(channel: string, ts: string, newText: string): Promise<void> {
    await this._messages.editMessage(channel, ts, newText);
  }

  /**
   * Delete a message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   *
   * @example
   * ```typescript
   * await agent.deleteMessage('C123456', '1234567890.123456');
   * ```
   */
  async deleteMessage(channel: string, ts: string): Promise<void> {
    await this._messages.deleteMessage(channel, ts);
  }

  // ===========================================================================
  // Reaction Methods
  // ===========================================================================

  /**
   * Add a reaction to a message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param emoji - Emoji name (with or without colons)
   *
   * @example
   * ```typescript
   * await agent.addReaction('C123456', '1234567890.123456', 'thumbsup');
   * ```
   */
  async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
    await this._reactions.addReaction(channel, ts, emoji);
  }

  /**
   * Remove a reaction from a message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param emoji - Emoji name
   *
   * @example
   * ```typescript
   * await agent.removeReaction('C123456', '1234567890.123456', 'thumbsup');
   * ```
   */
  async removeReaction(channel: string, ts: string, emoji: string): Promise<void> {
    await this._reactions.removeReaction(channel, ts, emoji);
  }

  /**
   * Get all reactions on a message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @returns Array of reactions with emoji name, count, and user IDs who reacted
   *
   * @example
   * ```typescript
   * const reactions = await agent.getReactions('C123456', '1234567890.123456');
   * for (const reaction of reactions) {
   *   console.log(`${reaction.name}: ${reaction.count} users`);
   * }
   * ```
   */
  async getReactions(channel: string, ts: string): Promise<Array<{ name: string; count: number; users: string[] }>> {
    return this._reactions.getReactions(channel, ts);
  }

  /**
   * Acknowledge a message with eyes emoji
   *
   * A quick way to show you've seen a message without replying.
   *
   * @param channel - Channel ID containing the message
   * @param ts - Message timestamp
   *
   * @example
   * ```typescript
   * // Let someone know you've seen their message
   * await agent.acknowledge('C123456', '1234567890.123456');
   * ```
   */
  async acknowledge(channel: string, ts: string): Promise<void> {
    await this._reactions.acknowledge(channel, ts);
  }

  /**
   * Approve a message with thumbs up
   *
   * Express approval or agreement with a message.
   *
   * @param channel - Channel ID containing the message
   * @param ts - Message timestamp
   *
   * @example
   * ```typescript
   * // Approve someone's suggestion
   * await agent.approve('C123456', '1234567890.123456');
   * ```
   */
  async approve(channel: string, ts: string): Promise<void> {
    await this._reactions.approve(channel, ts);
  }

  /**
   * Mark a message as complete with checkmark
   *
   * Indicate that a task or request has been completed.
   *
   * @param channel - Channel ID containing the message
   * @param ts - Message timestamp
   *
   * @example
   * ```typescript
   * // Mark a task request as done
   * await agent.complete('C123456', '1234567890.123456');
   * ```
   */
  async complete(channel: string, ts: string): Promise<void> {
    await this._reactions.complete(channel, ts);
  }

  // ===========================================================================
  // File Methods
  // ===========================================================================

  /**
   * Upload a file from a path
   *
   * @param filePath - Path to the file
   * @param channels - Channel IDs to share to
   * @param options - Additional options
   * @returns Upload result with file info
   *
   * @example
   * ```typescript
   * await agent.uploadFile('./report.pdf', ['C123456'], { title: 'Q4 Report' });
   * ```
   */
  async uploadFile(
    filePath: string,
    channels?: string[],
    options?: { title?: string; initialComment?: string },
  ): Promise<{ ok: boolean; file: { id: string; name: string; permalink: string } }> {
    const result = await this._files.uploadFileFromPath(filePath, channels, options);
    return {
      ok: result.ok,
      file: {
        id: result.file.id,
        name: result.file.name,
        permalink: result.file.permalink,
      },
    };
  }

  /**
   * Upload a file from a buffer
   *
   * @param buffer - File content
   * @param filename - Filename
   * @param channels - Channel IDs to share to
   * @param options - Additional options
   */
  async uploadFileFromBuffer(
    buffer: Buffer,
    filename: string,
    channels?: string[],
    options?: { title?: string; initialComment?: string },
  ): Promise<{ ok: boolean; file: { id: string; name: string; permalink: string } }> {
    const result = await this._files.uploadFileFromBuffer(buffer, filename, channels, options);
    return {
      ok: result.ok,
      file: {
        id: result.file.id,
        name: result.file.name,
        permalink: result.file.permalink,
      },
    };
  }

  /**
   * Download a file
   *
   * @param fileUrl - Private download URL
   * @returns File content as Buffer
   */
  async downloadFile(fileUrl: string): Promise<Buffer> {
    return this._files.downloadFile(fileUrl);
  }

  /**
   * Delete a file
   *
   * @param fileId - File ID
   */
  async deleteFile(fileId: string): Promise<void> {
    await this._files.deleteFile(fileId);
  }

  /**
   * Share a file to channels
   *
   * @param fileId - File ID
   * @param channels - Channel IDs
   */
  async shareFile(fileId: string, channels: string[]): Promise<void> {
    await this._files.shareFile(fileId, channels);
  }

  // ===========================================================================
  // Channel Methods
  // ===========================================================================

  /**
   * Create a public channel
   *
   * @param name - Channel name
   * @param options - Additional options
   * @returns Created channel info
   */
  async createChannel(
    name: string,
    options?: { topic?: string; purpose?: string },
  ): Promise<{ id: string; name: string }> {
    const channel = await this._channels.createChannel(name, options);
    return { id: channel.id, name: channel.name };
  }

  /**
   * Create a private channel
   *
   * @param name - Channel name
   * @param options - Additional options
   */
  async createPrivateChannel(
    name: string,
    options?: { topic?: string; purpose?: string },
  ): Promise<{ id: string; name: string }> {
    const channel = await this._channels.createPrivateChannel(name, options);
    return { id: channel.id, name: channel.name };
  }

  /**
   * Join a channel
   *
   * @param channelId - Channel ID
   */
  async joinChannel(channelId: string): Promise<void> {
    await this._membership.joinChannel(channelId);
  }

  /**
   * Leave a channel
   *
   * @param channelId - Channel ID
   */
  async leaveChannel(channelId: string): Promise<void> {
    await this._membership.leaveChannel(channelId);
  }

  /**
   * Invite users to a channel
   *
   * @param channelId - Channel ID
   * @param userIds - User IDs to invite
   */
  async inviteToChannel(channelId: string, userIds: string[]): Promise<void> {
    await this._membership.inviteMultipleToChannel(channelId, userIds);
  }

  /**
   * Archive a channel
   *
   * @param channelId - Channel ID
   */
  async archiveChannel(channelId: string): Promise<void> {
    await this._channels.archiveChannel(channelId);
  }

  /**
   * Set channel topic
   *
   * @param channelId - Channel ID
   * @param topic - New topic
   */
  async setChannelTopic(channelId: string, topic: string): Promise<void> {
    await this._channels.setTopic(channelId, topic);
  }

  /**
   * Get channel info
   *
   * @param channelId - Channel ID
   */
  async getChannelInfo(channelId: string): Promise<{
    id: string;
    name: string;
    isPrivate: boolean;
    memberCount?: number;
  }> {
    const info = await this._channels.getChannelInfo(channelId);
    return {
      id: info.id,
      name: info.name,
      isPrivate: info.isPrivate,
      memberCount: info.memberCount,
    };
  }

  /**
   * List channels the agent is a member of
   */
  async getMyChannels(): Promise<Array<{ id: string; name: string; isPrivate: boolean }>> {
    const channels = await this._membership.getMyChannels();
    return channels.map((c) => ({ id: c.id, name: c.name, isPrivate: c.isPrivate }));
  }

  // ===========================================================================
  // Profile Methods
  // ===========================================================================

  /**
   * Set the VP's status
   *
   * @param text - Status text
   * @param emoji - Status emoji
   * @param expiration - When status expires
   *
   * @example
   * ```typescript
   * await agent.setStatus('In a meeting', ':calendar:', new Date(Date.now() + 3600000));
   * ```
   */
  async setStatus(text: string, emoji?: string, expiration?: Date): Promise<void> {
    await this._presence.setStatus(text, emoji, expiration);
  }

  /**
   * Clear the VP's status
   */
  async clearStatus(): Promise<void> {
    await this._presence.clearStatus();
  }

  /**
   * Set presence to active or away
   *
   * @param presence - 'auto' or 'away'
   */
  async setPresence(presence: 'auto' | 'away'): Promise<void> {
    await this._presence.setPresence(presence);
  }

  /**
   * Update profile display name
   *
   * @param name - New display name
   */
  async setDisplayName(name: string): Promise<void> {
    await this._profile.setDisplayName(name);
  }

  /**
   * Update profile photo
   *
   * @param imagePath - Path to image file
   */
  async setProfilePhoto(imagePath: string): Promise<void> {
    await this._profile.setProfilePhoto(imagePath);
  }

  /**
   * Set status to "In a meeting"
   *
   * @param duration - Duration in minutes
   */
  async setInMeeting(duration?: number): Promise<void> {
    await this._presence.setInMeeting(duration);
  }

  /**
   * Set status to "Focusing"
   *
   * @param duration - Duration in minutes
   */
  async setFocusing(duration?: number): Promise<void> {
    await this._presence.setFocusing(duration);
  }

  // ===========================================================================
  // Search Methods
  // ===========================================================================

  /**
   * Search for messages
   *
   * @param query - Search query
   * @param options - Search options
   */
  async searchMessages(
    query: string,
    options?: { sort?: 'score' | 'timestamp'; sortDir?: 'asc' | 'desc'; count?: number },
  ): Promise<{
    matches: Array<{ ts: string; text?: string; channel: { id: string } }>;
    total: number;
  }> {
    const result = await this._search.searchMessages(query, options);
    return {
      matches: result.matches.map((m) => ({
        ts: m.ts,
        text: m.text,
        channel: { id: m.channel.id },
      })),
      total: result.total,
    };
  }

  /**
   * Search for files
   *
   * @param query - Search query
   */
  async searchFiles(
    query: string,
    options?: { count?: number },
  ): Promise<{
    matches: Array<{ id: string; name: string; user?: string }>;
    total: number;
  }> {
    const result = await this._search.searchFiles(query, options);
    return {
      matches: result.matches.map((f) => ({
        id: f.id,
        name: f.name,
        user: f.user,
      })),
      total: result.total,
    };
  }

  /**
   * Search for users
   *
   * @param query - Search query
   */
  async searchUsers(query: string): Promise<Array<{ id: string; name: string; realName?: string }>> {
    const users = await this._search.searchUsers(query);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      realName: u.realName,
    }));
  }

  // ===========================================================================
  // Reminder Methods
  // ===========================================================================

  /**
   * Create a reminder for yourself
   *
   * @param text - Reminder text
   * @param time - When to remind
   */
  async createReminder(text: string, time: Date | string): Promise<{ id: string }> {
    const reminder = await this._reminders.createReminder(text, time);
    return { id: reminder.id };
  }

  /**
   * Create a reminder in N minutes
   *
   * @param text - Reminder text
   * @param minutes - Minutes from now
   */
  async remindMeIn(text: string, minutes: number): Promise<{ id: string }> {
    const reminder = await this._reminders.remindMeIn(text, { minutes });
    return { id: reminder.id };
  }

  /**
   * List all reminders
   */
  async listReminders(): Promise<Array<{ id: string; text: string; time: number }>> {
    const reminders = await this._reminders.listReminders();
    return reminders.map((r) => ({
      id: r.id,
      text: r.text,
      time: r.time,
    }));
  }

  /**
   * Delete a reminder
   *
   * @param reminderId - Reminder ID
   */
  async deleteReminder(reminderId: string): Promise<void> {
    await this._reminders.deleteReminder(reminderId);
  }

  // ===========================================================================
  // Usergroup Methods
  // ===========================================================================

  /**
   * Create a usergroup
   *
   * @param name - Usergroup name
   * @param options - Additional options
   */
  async createUsergroup(
    name: string,
    options?: { handle?: string; description?: string },
  ): Promise<{ id: string; handle: string }> {
    const group = await this._usergroups.createUsergroup(name, options);
    return { id: group.id, handle: group.handle };
  }

  /**
   * Add members to a usergroup
   *
   * @param usergroupId - Usergroup ID
   * @param userIds - User IDs to add
   */
  async addUsergroupMembers(usergroupId: string, userIds: string[]): Promise<void> {
    await this._usergroups.addMembers(usergroupId, userIds);
  }

  /**
   * Remove members from a usergroup
   *
   * @param usergroupId - Usergroup ID
   * @param userIds - User IDs to remove
   */
  async removeUsergroupMembers(usergroupId: string, userIds: string[]): Promise<void> {
    await this._usergroups.removeMembers(usergroupId, userIds);
  }

  /**
   * List all usergroups
   */
  async listUsergroups(): Promise<Array<{ id: string; name: string; handle: string }>> {
    const groups = await this._usergroups.listUsergroups();
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      handle: g.handle,
    }));
  }

  // ===========================================================================
  // DND Methods
  // ===========================================================================

  /**
   * Enable Do Not Disturb for a duration
   *
   * @param minutes - Duration in minutes
   */
  async enableDnd(minutes: number): Promise<void> {
    await this._dnd.setSnooze(minutes);
  }

  /**
   * Disable Do Not Disturb
   */
  async disableDnd(): Promise<void> {
    await this._dnd.endSnooze();
  }

  /**
   * Check if DND is active
   */
  async isDndActive(): Promise<boolean> {
    return this._dnd.isDndActive();
  }

  // ===========================================================================
  // Star Methods
  // ===========================================================================

  /**
   * Star a message
   */
  async starMessage(channel: string, ts: string): Promise<void> {
    await this._stars.starMessage(channel, ts);
  }

  /**
   * Unstar a message
   */
  async unstarMessage(channel: string, ts: string): Promise<void> {
    await this._stars.unstarMessage(channel, ts);
  }

  /**
   * List starred items
   */
  async listStarredItems(): Promise<Array<{ type: string; dateCreated: number }>> {
    const items = await this._stars.listStarredItems();
    return items.map((i) => ({
      type: i.type,
      dateCreated: i.dateCreated,
    }));
  }

  // ===========================================================================
  // Bookmark Methods
  // ===========================================================================

  /**
   * Add a bookmark to a channel
   *
   * @param channelId - Channel ID
   * @param title - Bookmark title
   * @param link - Bookmark URL
   * @param emoji - Optional emoji
   */
  async addBookmark(
    channelId: string,
    title: string,
    link: string,
    emoji?: string,
  ): Promise<{ id: string }> {
    const bookmark = await this._bookmarks.addLinkBookmark(channelId, title, link, emoji);
    return { id: bookmark.id };
  }

  /**
   * Remove a bookmark
   *
   * @param channelId - Channel ID
   * @param bookmarkId - Bookmark ID
   */
  async removeBookmark(channelId: string, bookmarkId: string): Promise<void> {
    await this._bookmarks.removeBookmark(channelId, bookmarkId);
  }

  /**
   * List bookmarks in a channel
   *
   * @param channelId - Channel ID
   */
  async listBookmarks(channelId: string): Promise<Array<{ id: string; title: string; link: string }>> {
    const bookmarks = await this._bookmarks.listBookmarks(channelId);
    return bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      link: b.link,
    }));
  }

  // ===========================================================================
  // Pin Methods
  // ===========================================================================

  /**
   * Pin a message
   */
  async pinMessage(channel: string, ts: string): Promise<void> {
    await this._messages.pinMessage(channel, ts);
  }

  /**
   * Unpin a message
   */
  async unpinMessage(channel: string, ts: string): Promise<void> {
    await this._messages.unpinMessage(channel, ts);
  }

  // ===========================================================================
  // Event Handler Registration
  // ===========================================================================

  /**
   * Register a handler for message events
   *
   * @param handler - Event handler function
   *
   * @example
   * ```typescript
   * agent.onMessage(async (event) => {
   *   console.log(`Message from ${event.user}: ${event.text}`);
   *   if (event.text?.includes('hello')) {
   *     await agent.sendMessage(event.channel!, 'Hello back!');
   *   }
   * });
   * ```
   */
  onMessage(handler: EventHandler): void {
    this.on('message', handler);
  }

  /**
   * Register a handler for mention events
   *
   * @param handler - Event handler function
   */
  onMention(handler: EventHandler): void {
    this.on('app_mention', handler);
  }

  /**
   * Register a handler for reaction added events
   */
  onReactionAdded(handler: EventHandler): void {
    this.on('reaction_added', handler);
  }

  /**
   * Register a handler for reaction removed events
   */
  onReactionRemoved(handler: EventHandler): void {
    this.on('reaction_removed', handler);
  }

  /**
   * Register a generic event handler
   *
   * @param eventType - Event type to listen for
   * @param handler - Event handler function
   */
  onEvent(eventType: SlackEventType, handler: EventHandler): void {
    this.on(eventType, handler);
  }

  // ===========================================================================
  // Direct Access to Capability Modules
  // ===========================================================================

  /** Access to raw reactions capability */
  get reactions(): SlackReactions {
    return this._reactions;
  }

  /** Access to raw profile capability */
  get profile(): ProfileManager {
    return this._profile;
  }

  /** Access to raw search capability */
  get search(): SlackSearchCapability {
    return this._search;
  }

  /** Access to raw presence capability */
  get presence(): PresenceStatusManager {
    return this._presence;
  }

  /** Access to raw channels capability */
  get channels(): ChannelManager {
    return this._channels;
  }

  /** Access to raw membership capability */
  get membership(): ChannelMembershipManager {
    return this._membership;
  }

  /** Access to raw DND capability */
  get dnd(): DndControlsManager {
    return this._dnd;
  }

  /** Access to raw files capability */
  get files(): SlackFileOperations {
    return this._files;
  }

  /** Access to raw threading capability */
  get threading(): SlackThreadingCapability {
    return this._threading;
  }

  /** Access to raw messages capability */
  get messages(): MessageManager {
    return this._messages;
  }

  /** Access to raw reminders capability */
  get reminders(): ReminderManager {
    return this._reminders;
  }

  /** Access to raw stars capability */
  get stars(): StarredItemsManager {
    return this._stars;
  }

  /** Access to raw proactive messaging capability */
  get proactive(): ProactiveMessenger {
    return this._proactive;
  }

  /** Access to raw bookmarks capability */
  get bookmarks(): BookmarkManager {
    return this._bookmarks;
  }

  /** Access to raw usergroups capability */
  get usergroups(): UsergroupManager {
    return this._usergroups;
  }

  /** Access to user WebClient */
  get userWebClient(): WebClient {
    return this.userClient;
  }

  /** Access to bot WebClient */
  get botWebClient(): WebClient {
    return this.botClient;
  }

  /** Common emoji constants */
  static readonly Emojis = CommonEmojis;

  /** Preset status configurations */
  static readonly StatusPresets = PresetStatuses;

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Set up Orchestrator profile based on configuration
   */
  private async setupVPProfile(): Promise<void> {
    const { vpIdentity } = this.config;

    try {
      // Set real name
      await this._profile.setRealName(vpIdentity.firstName, vpIdentity.lastName);

      // Set display name
      await this._profile.setDisplayName(vpIdentity.name);

      // Set profile photo if provided
      if (vpIdentity.avatarPath) {
        await this._profile.setProfilePhoto(vpIdentity.avatarPath);
      }

      // Set title if provided
      if (vpIdentity.title) {
        await this._profile.setTitle(vpIdentity.title);
      }

      // Set pronouns if provided
      if (vpIdentity.pronouns) {
        await this._profile.setPronouns(vpIdentity.pronouns);
      }

      // Set presence to active
      await this._presence.setPresence('auto');

      this.log('VP profile configured successfully');
    } catch (error) {
      this.log('Error setting up Orchestrator profile (non-fatal)', error);
      // Don't throw - profile setup failure shouldn't prevent agent from working
    }
  }

  /**
   * Set up Socket Mode event handlers
   */
  private setupSocketModeHandlers(): void {
    if (!this.socketModeClient) return;

    // Handle all events
    this.socketModeClient.on('slack_event', async (args: { event: SlackEvent; body: unknown; ack: () => Promise<void> }) => {
      const { event, body, ack } = args;
      // Acknowledge the event
      await ack();

      const eventType = event.type as SlackEventType;
      this.log(`Received event: ${eventType}`, event);

      // Emit the event
      this.emit(eventType, event);

      // Also emit generic 'event' for catch-all handlers
      this.emit('event', { eventType, ...event, body });
    });

    // Handle connection events
    this.socketModeClient.on('connected', () => {
      this.log('Socket Mode connected');
      this.isConnected = true;
      this.emit('connected');
    });

    this.socketModeClient.on('disconnected', () => {
      this.log('Socket Mode disconnected');
      this.isConnected = false;
      this.emit('disconnected');
    });

    // Handle errors
    this.socketModeClient.on('error', (error: Error) => {
      this.log('Socket Mode error', error);
      this.emit('error', error);
    });
  }

  /**
   * Debug logging helper
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[SlackUserAgent] ${message}`, ...args);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SlackUserAgent instance
 *
 * @param config - Configuration options
 * @returns Configured SlackUserAgent instance
 *
 * @example
 * ```typescript
 * const agent = createSlackUserAgent({
 *   userToken: process.env.SLACK_USER_TOKEN!,
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   appToken: process.env.SLACK_APP_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 *   vpIdentity: {
 *     name: 'Ada VP',
 *     firstName: 'Ada',
 *     lastName: 'VP',
 *     email: 'ada@adaptic.ai',
 *   },
 * });
 * ```
 */
export function createSlackUserAgent(config: SlackUserAgentConfig): SlackUserAgent {
  return new SlackUserAgent(config);
}

/**
 * Create a SlackUserAgent from environment variables
 *
 * This factory function reads all configuration from environment variables,
 * making it easy to deploy Orchestrator agents in containerized environments.
 *
 * Required environment variables:
 * - `SLACK_USER_TOKEN` - User token (xoxp-*) for user-level operations
 * - `SLACK_BOT_TOKEN` - Bot token (xoxb-*) for bot operations
 * - `SLACK_APP_TOKEN` - App token (xapp-*) for Socket Mode
 * - `SLACK_SIGNING_SECRET` - Signing secret for request verification
 *
 * Optional environment variables:
 * - `VP_NAME` - Full display name (default: "VP Agent")
 * - `VP_FIRST_NAME` - First name (default: "VP")
 * - `VP_LAST_NAME` - Last name (default: "Agent")
 * - `VP_EMAIL` - Email address (default: "vp@example.com")
 * - `VP_AVATAR_PATH` - Path to avatar image
 * - `VP_TITLE` - Job title
 * - `VP_PRONOUNS` - Pronouns
 * - `VP_TIMEZONE` - Timezone identifier
 * - `SLACK_DEBUG` - Enable debug logging ("true" to enable)
 * - `SLACK_TEAM_ID` - Default team ID for Enterprise Grid
 *
 * @returns Configured SlackUserAgent instance
 * @throws Error if required environment variables are missing
 *
 * @example
 * ```typescript
 * // Ensure environment variables are set, then:
 * const agent = createSlackUserAgentFromEnv();
 * await agent.start();
 * ```
 */
export function createSlackUserAgentFromEnv(): SlackUserAgent {
  const userToken = process.env.SLACK_USER_TOKEN;
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!userToken || !botToken || !appToken || !signingSecret) {
    throw new Error(
      'Missing required environment variables: SLACK_USER_TOKEN, SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET',
    );
  }

  const vpIdentity: VPIdentity = {
    name: process.env.VP_NAME || 'VP Agent',
    firstName: process.env.VP_FIRST_NAME || 'VP',
    lastName: process.env.VP_LAST_NAME || 'Agent',
    email: process.env.VP_EMAIL || 'vp@example.com',
    avatarPath: process.env.VP_AVATAR_PATH,
    title: process.env.VP_TITLE,
    pronouns: process.env.VP_PRONOUNS,
    timezone: process.env.VP_TIMEZONE,
  };

  return new SlackUserAgent({
    userToken,
    botToken,
    appToken,
    signingSecret,
    vpIdentity,
    debug: process.env.SLACK_DEBUG === 'true',
    defaultTeamId: process.env.SLACK_TEAM_ID,
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default SlackUserAgent;
