/**
 * Slack Channel Adapter
 *
 * Wraps the existing @wundr/slack-agent SlackUserAgent to conform to the
 * ChannelPlugin interface. The Orchestrator operates as a full Slack user
 * (not a bot), which is a key differentiator from OpenClaw's bot-mode approach.
 *
 * @packageDocumentation
 */

import type {
  ChannelCapabilities,
  ChannelConfig,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChatType,
  DeliveryResult,
  MessageContent,
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedSender,
  OutboundAttachment,
  OutboundMessage,
  PairingConfig,
  SenderValidation,
  TypingHandle,
} from '../types.js';
import { BaseChannelAdapter } from '../types.js';

// ---------------------------------------------------------------------------
// Slack-Specific Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the Slack channel adapter.
 * Extends the base ChannelConfig with Slack-specific fields.
 */
export interface SlackChannelConfig extends ChannelConfig {
  /** User token (xoxp-) for user-level operations. */
  readonly userToken: string;
  /** Bot token (xoxb-) for bot operations. */
  readonly botToken: string;
  /** App token (xapp-) for Socket Mode real-time events. */
  readonly appToken: string;
  /** Signing secret for request verification. */
  readonly signingSecret: string;
  /** Default team ID for Enterprise Grid workspaces. */
  readonly defaultTeamId?: string;
  /** Orchestrator identity display name. */
  readonly displayName?: string;
  /** Enable debug logging from the Slack SDK. */
  readonly debug?: boolean;
  /** Text chunk limit for outbound messages. */
  readonly textChunkLimit?: number;
  /** DM allow-list: platform user IDs allowed to DM without approval. */
  readonly dmAllowList?: readonly string[];
}

// ---------------------------------------------------------------------------
// SlackChannelAdapter
// ---------------------------------------------------------------------------

/**
 * Slack channel adapter that bridges the @wundr/slack-agent SlackUserAgent
 * into the ChannelPlugin abstraction.
 *
 * Design notes:
 * - Lazily imports @wundr/slack-agent to avoid hard dependency at module level.
 * - The SlackUserAgent is created on connect() and destroyed on disconnect().
 * - Inbound Slack events are normalized into NormalizedMessage format.
 * - Outbound messages are chunked per Slack's 4000-character limit.
 *
 * @example
 * ```typescript
 * const slack = new SlackChannelAdapter();
 * await slack.connect({
 *   enabled: true,
 *   userToken: process.env.SLACK_USER_TOKEN!,
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   appToken: process.env.SLACK_APP_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 * });
 * slack.on('message', (msg) => console.log(msg.content.text));
 * ```
 */
export class SlackChannelAdapter extends BaseChannelAdapter {
  readonly id = 'slack' as const;

  readonly meta: ChannelMeta = {
    id: 'slack',
    label: 'Slack',
    blurb: 'Full user-mode Slack integration via Socket Mode.',
    aliases: ['slk'],
    order: 10,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'channel', 'thread'],
    reactions: true,
    threads: true,
    media: true,
    edit: true,
    delete: true,
    typingIndicators: false, // Slack user API does not expose typing
    readReceipts: false,
    maxMessageLength: 4000,
    maxMediaBytes: 1_073_741_824, // 1 GB
  };

  /** Reference to the underlying SlackUserAgent (created on connect). */
  private agent: SlackUserAgentLike | null = null;
  private selfUserId: string | null = null;
  private selfTeamId: string | null = null;
  private slackConfig: SlackChannelConfig | null = null;
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(config: ChannelConfig): Promise<void> {
    if (this.connected) {
      this.logger.debug('Slack adapter already connected, skipping.');
      return;
    }

    const slackConfig = config as SlackChannelConfig;
    this.slackConfig = slackConfig;

    if (
      !slackConfig.userToken ||
      !slackConfig.botToken ||
      !slackConfig.appToken ||
      !slackConfig.signingSecret
    ) {
      throw new Error(
        'Slack adapter requires userToken, botToken, appToken, and signingSecret.',
      );
    }

    try {
      // Lazy import of @wundr/slack-agent to avoid hard dependency.
      const { SlackUserAgent } = await import('@wundr/slack-agent');
      this.agent = new SlackUserAgent({
        userToken: slackConfig.userToken,
        botToken: slackConfig.botToken,
        appToken: slackConfig.appToken,
        signingSecret: slackConfig.signingSecret,
        vpIdentity: {
          name: slackConfig.displayName ?? 'Orchestrator',
          firstName: slackConfig.displayName?.split(' ')[0] ?? 'Orchestrator',
          lastName:
            slackConfig.displayName?.split(' ').slice(1).join(' ') ?? '',
          email: 'orchestrator@wundr.io',
        },
        debug: slackConfig.debug,
        defaultTeamId: slackConfig.defaultTeamId,
      }) as SlackUserAgentLike;

      this.setupEventHandlers();
      await this.agent.start();

      // Extract self identity from health check.
      const health = await this.agent.healthCheck();
      this.selfUserId = health.userId ?? null;
      this.selfTeamId = health.teamId ?? null;

      this.connected = true;
      this.config = config;
      this.logger.info(
        `Slack adapter connected (user: ${this.selfUserId}, team: ${this.selfTeamId}).`,
      );

      this.emit('connected', {
        channelId: this.id,
        accountId: this.selfTeamId ?? undefined,
      });
    } catch (err) {
      this.lastError =
        err instanceof Error ? err.message : String(err);
      this.logger.error(`Slack adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.agent) {
      return;
    }

    try {
      await this.agent.stop();
    } catch (err) {
      this.logger.error(
        `Error during Slack disconnect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.agent = null;
    this.connected = false;

    this.emit('disconnected', {
      channelId: this.id,
      accountId: this.selfTeamId ?? undefined,
    });

    this.logger.info('Slack adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    if (!this.agent) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: this.lastError ?? 'Not connected',
      };
    }

    try {
      const health = await this.agent.healthCheck();
      return {
        channelId: this.id,
        healthy: health.healthy,
        connected: health.socketModeConnected,
        accountId: health.teamId,
        lastMessageAt: this.lastMessageAt ?? undefined,
        lastError:
          health.errors.length > 0
            ? health.errors.join('; ')
            : undefined,
        details: {
          userClientConnected: health.userClientConnected,
          botClientConnected: health.botClientConnected,
          userId: health.userId,
        },
      };
    } catch (err) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    const chunks = this.chunkText(message.text);
    let lastResult: DeliveryResult = {
      ok: false,
      error: 'No chunks to send',
    };

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await this.agent!.sendMessage(
          message.to,
          chunks[i],
          {
            threadTs: message.threadId,
          },
        );
        lastResult = {
          ok: result.ok,
          messageId: result.ts,
          conversationId: result.channelId,
          timestamp: new Date(),
        };
      } catch (err) {
        lastResult = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
        break;
      }
    }

    // Send attachments if present.
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        await this.sendMedia(message.to, attachment, {
          threadId: message.threadId,
        });
      }
    }

    return lastResult;
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      await this.agent!.editMessage(conversationId, messageId, newText);
      return { ok: true, messageId, conversationId };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
  ): Promise<boolean> {
    this.requireConnected();

    try {
      await this.agent!.deleteMessage(conversationId, messageId);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to delete message ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Threading
  // -----------------------------------------------------------------------

  async replyToThread(
    conversationId: string,
    threadId: string,
    message: OutboundMessage,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const result = await this.agent!.replyToThread(
        conversationId,
        threadId,
        message.text,
      );
      return {
        ok: result.ok,
        messageId: result.ts,
        conversationId: result.channel,
        timestamp: new Date(),
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // -----------------------------------------------------------------------
  // Reactions
  // -----------------------------------------------------------------------

  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    await this.agent!.addReaction(conversationId, messageId, emoji);
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    await this.agent!.removeReaction(conversationId, messageId, emoji);
  }

  // -----------------------------------------------------------------------
  // Media
  // -----------------------------------------------------------------------

  async sendMedia(
    conversationId: string,
    attachment: OutboundAttachment,
    options?: { text?: string; threadId?: string },
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      if (attachment.source === 'buffer' && attachment.buffer) {
        const result = await this.agent!.uploadFileFromBuffer(
          attachment.buffer,
          attachment.filename,
          [conversationId],
          { title: attachment.filename },
        );
        return {
          ok: result.ok,
          messageId: result.file.id,
          conversationId,
          timestamp: new Date(),
        };
      }

      if (
        attachment.source === 'path' &&
        attachment.location
      ) {
        const result = await this.agent!.uploadFile(
          attachment.location,
          [conversationId],
          { title: attachment.filename },
        );
        return {
          ok: result.ok,
          messageId: result.file.id,
          conversationId,
          timestamp: new Date(),
        };
      }

      return {
        ok: false,
        error: `Unsupported attachment source: ${attachment.source}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async downloadMedia(url: string): Promise<Buffer> {
    this.requireConnected();
    return this.agent!.downloadFile(url);
  }

  // -----------------------------------------------------------------------
  // Security / Pairing
  // -----------------------------------------------------------------------

  async validateSender(
    senderId: string,
    chatType: ChatType,
  ): Promise<SenderValidation> {
    // In group/channel contexts, all members are allowed.
    if (chatType !== 'direct') {
      return { allowed: true };
    }

    const config = this.slackConfig;
    if (!config?.pairing?.requireApproval) {
      return { allowed: true };
    }

    const allowList = config.dmAllowList ?? config.pairing.allowList ?? [];
    const normalizedSender = senderId.trim().toLowerCase();
    const isAllowed = allowList.some(
      (entry) => entry.trim().toLowerCase() === normalizedSender,
    );

    if (isAllowed) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'DM sender not in allow-list.',
      pendingApproval: config.pairing.requireApproval,
    };
  }

  getPairingConfig(): PairingConfig | null {
    const config = this.slackConfig;
    if (!config?.pairing) {
      return null;
    }
    return {
      requireApproval: config.pairing.requireApproval,
      allowList: config.dmAllowList ?? config.pairing.allowList ?? [],
      normalizeEntry: (raw: string) => raw.trim().toLowerCase(),
    };
  }

  // -----------------------------------------------------------------------
  // Event Setup
  // -----------------------------------------------------------------------

  private setupEventHandlers(): void {
    if (!this.agent) return;

    this.agent.onMessage(async (event: SlackEventLike) => {
      // Skip messages from self.
      if (event.user === this.selfUserId) return;

      const message = this.normalizeInboundMessage(event);
      if (message) {
        this.lastMessageAt = new Date();
        this.emit('message', message);
      }
    });

    this.agent.onReactionAdded((event: SlackEventLike) => {
      if (!event.user || !event.channel || !event.ts) return;
      this.emit('reaction_added', {
        channelId: this.id,
        conversationId: event.channel,
        messageId: event.ts,
        userId: event.user,
        emoji: (event as { reaction?: string }).reaction ?? '',
      });
    });

    this.agent.onReactionRemoved((event: SlackEventLike) => {
      if (!event.user || !event.channel || !event.ts) return;
      this.emit('reaction_removed', {
        channelId: this.id,
        conversationId: event.channel,
        messageId: event.ts,
        userId: event.user,
        emoji: (event as { reaction?: string }).reaction ?? '',
      });
    });
  }

  // -----------------------------------------------------------------------
  // Message Normalization
  // -----------------------------------------------------------------------

  private normalizeInboundMessage(
    event: SlackEventLike,
  ): NormalizedMessage | null {
    if (!event.channel || !event.ts) {
      return null;
    }

    const chatType = this.resolveSlackChatType(event);
    const sender = this.normalizeSlackSender(event);
    const content = this.normalizeSlackContent(event);

    return {
      id: `slack:${event.ts}`,
      channelId: this.id,
      platformMessageId: event.ts,
      conversationId: event.channel,
      threadId: (event as { thread_ts?: string }).thread_ts,
      sender,
      content,
      timestamp: new Date(parseFloat(event.ts) * 1000),
      chatType,
      replyTo: (event as { thread_ts?: string }).thread_ts,
      guildId: this.selfTeamId ?? undefined,
      raw: event,
    };
  }

  private resolveSlackChatType(event: SlackEventLike): ChatType {
    if ((event as { thread_ts?: string }).thread_ts) {
      return 'thread';
    }
    const channelType = (event as { channel_type?: string }).channel_type;
    if (channelType === 'im') {
      return 'direct';
    }
    if (channelType === 'mpim' || channelType === 'group') {
      return 'group';
    }
    return 'channel';
  }

  private normalizeSlackSender(event: SlackEventLike): NormalizedSender {
    return {
      id: event.user ?? 'unknown',
      displayName: event.user ?? 'Unknown',
      isSelf: event.user === this.selfUserId,
      isBot:
        (event as { bot_id?: string }).bot_id !== undefined &&
        event.user !== this.selfUserId,
    };
  }

  private normalizeSlackContent(event: SlackEventLike): MessageContent {
    const text = event.text ?? '';
    const mentions = this.extractSlackMentions(text);
    const mentionsSelf =
      this.selfUserId !== null &&
      mentions.includes(this.selfUserId);

    const attachments = this.extractSlackAttachments(event);

    return {
      text: this.stripSlackFormatting(text),
      rawText: text,
      attachments,
      mentions,
      mentionsSelf,
    };
  }

  private extractSlackMentions(text: string): string[] {
    const matches = text.matchAll(/<@([A-Z0-9]+)>/gi);
    return [...matches].map((m) => m[1]);
  }

  private extractSlackAttachments(
    event: SlackEventLike,
  ): NormalizedAttachment[] {
    const files = (event as { files?: SlackFileLike[] }).files;
    if (!files || !Array.isArray(files)) {
      return [];
    }

    return files.map((file) => ({
      type: resolveAttachmentType(file.mimetype),
      filename: file.name ?? 'unknown',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      url: file.url_private ?? file.url_private_download ?? '',
      thumbnailUrl: file.thumb_360,
    }));
  }

  private stripSlackFormatting(text: string): string {
    return text
      .replace(/<@[A-Z0-9]+>/gi, '') // Remove user mentions
      .replace(/<#[A-Z0-9]+\|([^>]+)>/gi, '#$1') // #channel references
      .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/gi, '$2') // URL with label
      .replace(/<(https?:\/\/[^>]+)>/gi, '$1') // Bare URL
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private requireConnected(): asserts this is { agent: SlackUserAgentLike } {
    if (!this.connected || !this.agent) {
      throw new Error('Slack adapter is not connected. Call connect() first.');
    }
  }
}

// ---------------------------------------------------------------------------
// Type Stubs for Loose Coupling
// ---------------------------------------------------------------------------
// These allow the adapter to work whether or not @wundr/slack-agent is installed.

interface SlackUserAgentLike {
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{
    healthy: boolean;
    userClientConnected: boolean;
    botClientConnected: boolean;
    socketModeConnected: boolean;
    userId?: string;
    teamId?: string;
    errors: string[];
  }>;
  sendMessage(
    channel: string,
    text: string,
    options?: { threadTs?: string },
  ): Promise<{ ok: boolean; channelId: string; ts: string }>;
  replyToThread(
    channel: string,
    threadTs: string,
    text: string,
    broadcast?: boolean,
  ): Promise<{ ok: boolean; channel: string; ts: string }>;
  editMessage(channel: string, ts: string, newText: string): Promise<void>;
  deleteMessage(channel: string, ts: string): Promise<void>;
  addReaction(channel: string, ts: string, emoji: string): Promise<void>;
  removeReaction(channel: string, ts: string, emoji: string): Promise<void>;
  uploadFile(
    filePath: string,
    channels?: string[],
    options?: { title?: string },
  ): Promise<{ ok: boolean; file: { id: string; name: string; permalink: string } }>;
  uploadFileFromBuffer(
    buffer: Buffer,
    filename: string,
    channels?: string[],
    options?: { title?: string },
  ): Promise<{ ok: boolean; file: { id: string; name: string; permalink: string } }>;
  downloadFile(fileUrl: string): Promise<Buffer>;
  onMessage(handler: (event: SlackEventLike) => void | Promise<void>): void;
  onReactionAdded(handler: (event: SlackEventLike) => void | Promise<void>): void;
  onReactionRemoved(handler: (event: SlackEventLike) => void | Promise<void>): void;
}

interface SlackEventLike {
  type?: string;
  user?: string;
  channel?: string;
  ts?: string;
  text?: string;
  [key: string]: unknown;
}

interface SlackFileLike {
  name?: string;
  mimetype?: string;
  size?: number;
  url_private?: string;
  url_private_download?: string;
  thumb_360?: string;
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function resolveAttachmentType(
  mimeType?: string,
): 'image' | 'video' | 'audio' | 'file' {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}
