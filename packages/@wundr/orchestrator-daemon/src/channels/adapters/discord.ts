/**
 * Discord Channel Adapter
 *
 * Implements the ChannelPlugin interface for Discord using discord.js.
 * The Orchestrator connects as a bot application but operates with rich
 * user-like behavior (reactions, threads, file uploads, etc.).
 *
 * Capabilities aligned with OpenClaw's Discord dock:
 * - Chat types: direct, channel, thread
 * - Reactions, threads, media, message editing
 * - 2000-character message limit
 * - Block streaming with 1500-char/1000ms coalesce
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
// Discord-Specific Configuration
// ---------------------------------------------------------------------------

export interface DiscordChannelConfig extends ChannelConfig {
  /** Discord bot token. */
  readonly botToken: string;
  /** Application ID. */
  readonly applicationId?: string;
  /** Guild IDs to limit the bot to (empty = all guilds). */
  readonly guildIds?: readonly string[];
  /** DM allow-list: Discord user IDs allowed to DM. */
  readonly dmAllowList?: readonly string[];
  /** Whether to require mention in guild channels. */
  readonly requireMentionInGuilds?: boolean;
  /** Enable debug logging. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// DiscordChannelAdapter
// ---------------------------------------------------------------------------

export class DiscordChannelAdapter extends BaseChannelAdapter {
  readonly id = 'discord' as const;

  readonly meta: ChannelMeta = {
    id: 'discord',
    label: 'Discord',
    blurb: 'Discord bot integration with threads, reactions, and media.',
    aliases: ['dc'],
    order: 20,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'channel', 'thread'],
    reactions: true,
    threads: true,
    media: true,
    edit: true,
    delete: true,
    typingIndicators: true,
    readReceipts: false,
    maxMessageLength: 2000,
    maxMediaBytes: 26_214_400, // 25 MB (free tier)
  };

  private client: DiscordClientLike | null = null;
  private selfUserId: string | null = null;
  private discordConfig: DiscordChannelConfig | null = null;
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
      this.logger.debug('Discord adapter already connected, skipping.');
      return;
    }

    const discordConfig = config as DiscordChannelConfig;
    this.discordConfig = discordConfig;

    if (!discordConfig.botToken) {
      throw new Error('Discord adapter requires botToken.');
    }

    try {
      const discordJs = await import('discord.js');
      const { Client, GatewayIntentBits, Partials } = discordJs;

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.DirectMessageReactions,
          GatewayIntentBits.MessageContent,
        ],
        partials: [
          Partials.Channel,
          Partials.Message,
          Partials.Reaction,
        ],
      }) as unknown as DiscordClientLike;

      this.setupEventHandlers();
      await this.client.login(discordConfig.botToken);

      this.selfUserId = this.client.user?.id ?? null;
      this.connected = true;
      this.config = config;

      this.logger.info(
        `Discord adapter connected (user: ${this.selfUserId}).`,
      );

      this.emit('connected', {
        channelId: this.id,
        accountId: this.selfUserId ?? undefined,
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.logger.error(`Discord adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      this.client.destroy();
    } catch (err) {
      this.logger.error(
        `Error during Discord disconnect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.client = null;
    this.connected = false;

    this.emit('disconnected', {
      channelId: this.id,
      accountId: this.selfUserId ?? undefined,
    });

    this.logger.info('Discord adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    if (!this.client) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: this.lastError ?? 'Not connected',
      };
    }

    const ping = this.client.ws?.ping ?? -1;
    return {
      channelId: this.id,
      healthy: this.connected && ping >= 0,
      connected: this.connected,
      latencyMs: ping >= 0 ? ping : undefined,
      accountId: this.selfUserId ?? undefined,
      lastMessageAt: this.lastMessageAt ?? undefined,
      lastError: this.lastError ?? undefined,
      details: {
        guilds: this.client.guilds?.cache?.size ?? 0,
        ping,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const channel = await this.client!.channels.fetch(message.to);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: `Channel ${message.to} not found or not a text channel.` };
      }

      const chunks = this.chunkText(message.text);
      let lastMessageId: string | undefined;

      for (const chunk of chunks) {
        const sent = await channel.send({
          content: chunk,
          reply: message.replyTo
            ? { messageReference: message.replyTo }
            : undefined,
        });
        lastMessageId = sent.id;
      }

      return {
        ok: true,
        messageId: lastMessageId,
        conversationId: message.to,
        timestamp: new Date(),
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const channel = await this.client!.channels.fetch(conversationId);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: 'Channel not found.' };
      }
      const msg = await channel.messages.fetch(messageId);
      await msg.edit(newText);
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
      const channel = await this.client!.channels.fetch(conversationId);
      if (!channel || !isTextChannel(channel)) return false;
      const msg = await channel.messages.fetch(messageId);
      await msg.delete();
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to delete Discord message ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
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
      const thread = await this.client!.channels.fetch(threadId);
      if (!thread || !isTextChannel(thread)) {
        return { ok: false, error: `Thread ${threadId} not found.` };
      }

      const sent = await thread.send({ content: message.text });
      return {
        ok: true,
        messageId: sent.id,
        conversationId: threadId,
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
    const channel = await this.client!.channels.fetch(conversationId);
    if (!channel || !isTextChannel(channel)) return;
    const msg = await channel.messages.fetch(messageId);
    await msg.react(emoji);
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    const channel = await this.client!.channels.fetch(conversationId);
    if (!channel || !isTextChannel(channel)) return;
    const msg = await channel.messages.fetch(messageId);
    const reaction = msg.reactions.cache.find(
      (r: { emoji: { name: string | null } }) => r.emoji.name === emoji,
    );
    if (reaction && this.selfUserId) {
      await reaction.users.remove(this.selfUserId);
    }
  }

  // -----------------------------------------------------------------------
  // Typing Indicators
  // -----------------------------------------------------------------------

  sendTypingIndicator(conversationId: string): TypingHandle {
    if (!this.connected || !this.client) {
      return { stop: () => {} };
    }

    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const channel = await this.client!.channels.fetch(conversationId);
        if (channel && isTextChannel(channel)) {
          await channel.sendTyping();
        }
      } catch {
        // Ignore typing failures.
      }
    }, 5000);

    // Send initial typing indicator immediately.
    void (async () => {
      try {
        const channel = await this.client!.channels.fetch(conversationId);
        if (channel && isTextChannel(channel)) {
          await channel.sendTyping();
        }
      } catch {
        // Ignore.
      }
    })();

    return {
      stop: () => {
        active = false;
        clearInterval(interval);
      },
    };
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
      const channel = await this.client!.channels.fetch(conversationId);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: 'Channel not found.' };
      }

      const files: DiscordAttachmentLike[] = [];

      if (attachment.source === 'buffer' && attachment.buffer) {
        files.push({
          attachment: attachment.buffer,
          name: attachment.filename,
        });
      } else if (attachment.source === 'path' && attachment.location) {
        files.push({
          attachment: attachment.location,
          name: attachment.filename,
        });
      } else if (attachment.source === 'url' && attachment.location) {
        files.push({
          attachment: attachment.location,
          name: attachment.filename,
        });
      }

      const sent = await channel.send({
        content: options?.text ?? '',
        files,
      });

      return {
        ok: true,
        messageId: sent.id,
        conversationId,
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
  // Security / Pairing
  // -----------------------------------------------------------------------

  async validateSender(
    senderId: string,
    chatType: ChatType,
  ): Promise<SenderValidation> {
    if (chatType !== 'direct') {
      return { allowed: true };
    }

    const config = this.discordConfig;
    if (!config?.pairing?.requireApproval) {
      return { allowed: true };
    }

    const allowList = config.dmAllowList ?? config.pairing.allowList ?? [];
    const isAllowed = allowList.some(
      (entry) => entry.trim().toLowerCase() === senderId.trim().toLowerCase(),
    );

    return isAllowed
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'DM sender not in allow-list.',
          pendingApproval: true,
        };
  }

  getPairingConfig(): PairingConfig | null {
    const config = this.discordConfig;
    if (!config?.pairing) return null;
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
    if (!this.client) return;

    this.client.on('messageCreate', (msg: DiscordMessageLike) => {
      // Skip messages from self.
      if (msg.author.id === this.selfUserId) return;
      // Skip bot messages unless from a webhook.
      if (msg.author.bot && !msg.webhookId) return;

      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.emit('message', normalized);
      }
    });

    this.client.on('messageUpdate', (_old: unknown, updated: DiscordMessageLike) => {
      if (!updated.channel?.id || !updated.id) return;
      this.emit('message_edited', {
        channelId: this.id,
        conversationId: updated.channel.id,
        messageId: updated.id,
        newContent: this.normalizeDiscordContent(updated),
        timestamp: new Date(),
      });
    });

    this.client.on('messageDelete', (msg: DiscordMessageLike) => {
      if (!msg.channel?.id || !msg.id) return;
      this.emit('message_deleted', {
        channelId: this.id,
        conversationId: msg.channel.id,
        messageId: msg.id,
        timestamp: new Date(),
      });
    });

    this.client.on(
      'messageReactionAdd',
      (reaction: DiscordReactionLike, user: { id: string }) => {
        this.emit('reaction_added', {
          channelId: this.id,
          conversationId: reaction.message.channelId,
          messageId: reaction.message.id,
          userId: user.id,
          emoji: reaction.emoji.name ?? '',
        });
      },
    );

    this.client.on(
      'messageReactionRemove',
      (reaction: DiscordReactionLike, user: { id: string }) => {
        this.emit('reaction_removed', {
          channelId: this.id,
          conversationId: reaction.message.channelId,
          messageId: reaction.message.id,
          userId: user.id,
          emoji: reaction.emoji.name ?? '',
        });
      },
    );

    this.client.on('error', (err: Error) => {
      this.lastError = err.message;
      this.emit('error', {
        channelId: this.id,
        error: err,
        recoverable: true,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Message Normalization
  // -----------------------------------------------------------------------

  private normalizeInboundMessage(
    msg: DiscordMessageLike,
  ): NormalizedMessage | null {
    if (!msg.channel?.id || !msg.id) return null;

    const chatType = this.resolveDiscordChatType(msg);
    const sender = this.normalizeDiscordSender(msg);
    const content = this.normalizeDiscordContent(msg);

    return {
      id: `discord:${msg.id}`,
      channelId: this.id,
      platformMessageId: msg.id,
      conversationId: msg.channel.id,
      threadId: msg.channel.isThread?.() ? msg.channel.id : undefined,
      sender,
      content,
      timestamp: msg.createdAt ?? new Date(),
      chatType,
      replyTo: msg.reference?.messageId,
      guildId: msg.guildId ?? undefined,
      raw: msg,
    };
  }

  private resolveDiscordChatType(msg: DiscordMessageLike): ChatType {
    if (msg.channel?.isThread?.()) return 'thread';
    if (msg.channel?.isDMBased?.()) return 'direct';
    return 'channel';
  }

  private normalizeDiscordSender(msg: DiscordMessageLike): NormalizedSender {
    return {
      id: msg.author.id,
      displayName:
        msg.member?.displayName ?? msg.author.displayName ?? msg.author.username,
      username: msg.author.username,
      isSelf: msg.author.id === this.selfUserId,
      isBot: msg.author.bot ?? false,
      avatarUrl: msg.author.avatarURL?.() ?? undefined,
    };
  }

  private normalizeDiscordContent(msg: DiscordMessageLike): MessageContent {
    const text = msg.content ?? '';
    const mentions = this.extractDiscordMentions(text, msg);
    const mentionsSelf =
      this.selfUserId !== null && mentions.includes(this.selfUserId);

    const attachments = this.extractDiscordAttachments(msg);

    return {
      text: this.stripDiscordFormatting(text),
      rawText: text,
      attachments,
      mentions,
      mentionsSelf,
    };
  }

  private extractDiscordMentions(
    text: string,
    msg: DiscordMessageLike,
  ): string[] {
    const mentionedIds: string[] = [];

    // From message content regex.
    const regexMatches = text.matchAll(/<@!?(\d+)>/g);
    for (const match of regexMatches) {
      mentionedIds.push(match[1]);
    }

    // From message.mentions if available.
    if (msg.mentions?.users) {
      for (const [userId] of msg.mentions.users) {
        if (!mentionedIds.includes(userId)) {
          mentionedIds.push(userId);
        }
      }
    }

    return mentionedIds;
  }

  private extractDiscordAttachments(
    msg: DiscordMessageLike,
  ): NormalizedAttachment[] {
    if (!msg.attachments) return [];

    const result: NormalizedAttachment[] = [];
    for (const [, attachment] of msg.attachments) {
      result.push({
        type: resolveAttachmentType(attachment.contentType ?? undefined),
        filename: attachment.name ?? 'unknown',
        mimeType: attachment.contentType ?? undefined,
        sizeBytes: attachment.size,
        url: attachment.url,
        thumbnailUrl: attachment.proxyURL,
      });
    }
    return result;
  }

  private stripDiscordFormatting(text: string): string {
    return text
      .replace(/<@!?\d+>/g, '') // User mentions
      .replace(/<#\d+>/g, '') // Channel mentions
      .replace(/<@&\d+>/g, '') // Role mentions
      .trim();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private requireConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error(
        'Discord adapter is not connected. Call connect() first.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Type Stubs for Loose Coupling
// ---------------------------------------------------------------------------

interface DiscordClientLike {
  user?: { id: string };
  ws?: { ping: number };
  guilds?: { cache?: { size: number } };
  channels: {
    fetch(id: string): Promise<DiscordChannelLike | null>;
  };
  login(token: string): Promise<string>;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

interface DiscordChannelLike {
  id: string;
  send(options: {
    content: string;
    reply?: { messageReference: string };
    files?: DiscordAttachmentLike[];
  }): Promise<{ id: string }>;
  sendTyping(): Promise<void>;
  messages: {
    fetch(id: string): Promise<{
      id: string;
      edit(text: string): Promise<void>;
      delete(): Promise<void>;
      react(emoji: string): Promise<void>;
      reactions: {
        cache: {
          find(
            fn: (r: { emoji: { name: string | null } }) => boolean,
          ): { users: { remove(id: string): Promise<void> } } | undefined;
        };
      };
    }>;
  };
  isThread?(): boolean;
  isDMBased?(): boolean;
}

interface DiscordMessageLike {
  id: string;
  content?: string;
  author: {
    id: string;
    username: string;
    displayName?: string;
    bot?: boolean;
    avatarURL?(): string;
  };
  member?: { displayName: string };
  channel?: {
    id: string;
    isThread?(): boolean;
    isDMBased?(): boolean;
  };
  guildId?: string;
  webhookId?: string;
  createdAt?: Date;
  reference?: { messageId?: string };
  mentions?: { users: Map<string, unknown> };
  attachments?: Map<
    string,
    {
      name?: string;
      contentType?: string;
      size?: number;
      url: string;
      proxyURL?: string;
    }
  >;
}

interface DiscordReactionLike {
  message: { id: string; channelId: string };
  emoji: { name: string | null };
}

interface DiscordAttachmentLike {
  attachment: string | Buffer;
  name: string;
}

function isTextChannel(channel: unknown): channel is DiscordChannelLike {
  return channel !== null && typeof (channel as { send?: unknown }).send === 'function';
}

function resolveAttachmentType(
  mimeType?: string,
): 'image' | 'video' | 'audio' | 'file' {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}
