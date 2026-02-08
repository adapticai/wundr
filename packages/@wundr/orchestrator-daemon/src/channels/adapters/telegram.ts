/**
 * Telegram Channel Adapter
 *
 * Implements the ChannelPlugin interface for Telegram using the Bot API.
 * Aligned with OpenClaw's Telegram dock which supports direct, group,
 * channel, and thread chat types with a 4000-character message limit.
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
// Telegram-Specific Configuration
// ---------------------------------------------------------------------------

export interface TelegramChannelConfig extends ChannelConfig {
  /** Telegram Bot API token from @BotFather. */
  readonly botToken: string;
  /** Webhook URL (if using webhook mode instead of polling). */
  readonly webhookUrl?: string;
  /** Webhook secret for verification. */
  readonly webhookSecret?: string;
  /** DM allow-list: Telegram user IDs or usernames. */
  readonly dmAllowList?: readonly string[];
  /** Whether to use long polling (default) or webhook mode. */
  readonly mode?: 'polling' | 'webhook';
  /** Enable debug logging. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// TelegramChannelAdapter
// ---------------------------------------------------------------------------

export class TelegramChannelAdapter extends BaseChannelAdapter {
  readonly id = 'telegram' as const;

  readonly meta: ChannelMeta = {
    id: 'telegram',
    label: 'Telegram',
    blurb: 'Telegram Bot API integration with groups, channels, and threads.',
    aliases: ['tg'],
    order: 30,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel', 'thread'],
    reactions: true,
    threads: true,
    media: true,
    edit: true,
    delete: true,
    typingIndicators: true,
    readReceipts: false,
    maxMessageLength: 4096,
    maxMediaBytes: 52_428_800, // 50 MB (standard bot limit)
  };

  private bot: TelegramBotLike | null = null;
  private telegramConfig: TelegramChannelConfig | null = null;
  private selfBotId: number | null = null;
  private selfUsername: string | null = null;
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
      this.logger.debug('Telegram adapter already connected, skipping.');
      return;
    }

    const telegramConfig = config as TelegramChannelConfig;
    this.telegramConfig = telegramConfig;

    if (!telegramConfig.botToken) {
      throw new Error('Telegram adapter requires botToken.');
    }

    try {
      // Lazy import of Telegraf/grammy.
      const { Telegraf } = await import('telegraf');
      this.bot = new Telegraf(telegramConfig.botToken) as unknown as TelegramBotLike;

      this.setupEventHandlers();

      // Get bot info.
      const botInfo = await this.bot.telegram.getMe();
      this.selfBotId = botInfo.id;
      this.selfUsername = botInfo.username ?? null;

      // Start receiving updates.
      if (telegramConfig.mode === 'webhook' && telegramConfig.webhookUrl) {
        await this.bot.telegram.setWebhook(telegramConfig.webhookUrl, {
          secret_token: telegramConfig.webhookSecret,
        });
      } else {
        // Long polling (default).
        this.bot.launch({ dropPendingUpdates: true });
      }

      this.connected = true;
      this.config = config;

      this.logger.info(
        `Telegram adapter connected (bot: @${this.selfUsername}, id: ${this.selfBotId}).`,
      );

      this.emit('connected', {
        channelId: this.id,
        accountId: String(this.selfBotId),
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Telegram adapter connect failed: ${this.lastError}`,
      );
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.bot) {
      return;
    }

    try {
      this.bot.stop('Orchestrator shutdown');
    } catch (err) {
      this.logger.error(
        `Error during Telegram disconnect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.bot = null;
    this.connected = false;

    this.emit('disconnected', {
      channelId: this.id,
      accountId: this.selfBotId ? String(this.selfBotId) : undefined,
    });

    this.logger.info('Telegram adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    if (!this.bot) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: this.lastError ?? 'Not connected',
      };
    }

    try {
      const me = await this.bot.telegram.getMe();
      return {
        channelId: this.id,
        healthy: true,
        connected: true,
        accountId: String(me.id),
        lastMessageAt: this.lastMessageAt ?? undefined,
        details: {
          username: me.username,
          firstName: me.first_name,
          canJoinGroups: me.can_join_groups,
          canReadAllGroupMessages: me.can_read_all_group_messages,
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

    const chatId = message.to;
    const chunks = this.chunkText(message.text);
    let lastResult: DeliveryResult = { ok: false, error: 'No chunks to send' };

    for (const chunk of chunks) {
      try {
        const sent = await this.bot!.telegram.sendMessage(chatId, chunk, {
          reply_to_message_id: message.replyTo
            ? parseInt(message.replyTo, 10)
            : undefined,
          message_thread_id: message.threadId
            ? parseInt(message.threadId, 10)
            : undefined,
          parse_mode: 'Markdown',
        });

        lastResult = {
          ok: true,
          messageId: String(sent.message_id),
          conversationId: String(sent.chat.id),
          timestamp: new Date(sent.date * 1000),
        };
      } catch (err) {
        // Retry without Markdown if parse fails.
        try {
          const sent = await this.bot!.telegram.sendMessage(chatId, chunk, {
            reply_to_message_id: message.replyTo
              ? parseInt(message.replyTo, 10)
              : undefined,
            message_thread_id: message.threadId
              ? parseInt(message.threadId, 10)
              : undefined,
          });
          lastResult = {
            ok: true,
            messageId: String(sent.message_id),
            conversationId: String(sent.chat.id),
            timestamp: new Date(sent.date * 1000),
          };
        } catch (retryErr) {
          lastResult = {
            ok: false,
            error:
              retryErr instanceof Error ? retryErr.message : String(retryErr),
          };
          break;
        }
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
      await this.bot!.telegram.editMessageText(
        conversationId,
        parseInt(messageId, 10),
        undefined,
        newText,
      );
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
      await this.bot!.telegram.deleteMessage(
        conversationId,
        parseInt(messageId, 10),
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to delete Telegram message ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Typing Indicators
  // -----------------------------------------------------------------------

  sendTypingIndicator(conversationId: string): TypingHandle {
    if (!this.connected || !this.bot) {
      return { stop: () => {} };
    }

    let active = true;
    // Telegram typing indicator lasts 5 seconds, so refresh periodically.
    const interval = setInterval(async () => {
      if (!active || !this.bot) return;
      try {
        await this.bot.telegram.sendChatAction(conversationId, 'typing');
      } catch {
        // Ignore typing failures.
      }
    }, 4000);

    // Send immediately.
    void (async () => {
      try {
        await this.bot!.telegram.sendChatAction(conversationId, 'typing');
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
      const source = this.resolveMediaSource(attachment);
      const extra: Record<string, unknown> = {};
      if (options?.text) extra.caption = options.text;
      if (options?.threadId) {
        extra.message_thread_id = parseInt(options.threadId, 10);
      }

      let sent: TelegramMessageLike;
      const type = inferMediaType(attachment.mimeType, attachment.filename);

      switch (type) {
        case 'photo':
          sent = await this.bot!.telegram.sendPhoto(
            conversationId,
            source,
            extra,
          );
          break;
        case 'video':
          sent = await this.bot!.telegram.sendVideo(
            conversationId,
            source,
            extra,
          );
          break;
        case 'audio':
          sent = await this.bot!.telegram.sendAudio(
            conversationId,
            source,
            extra,
          );
          break;
        default:
          sent = await this.bot!.telegram.sendDocument(
            conversationId,
            source,
            extra,
          );
      }

      return {
        ok: true,
        messageId: String(sent.message_id),
        conversationId: String(sent.chat.id),
        timestamp: new Date(sent.date * 1000),
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

    try {
      // Telegram Bot API setMessageReaction (available since Bot API 7.0).
      await this.bot!.telegram.callApi('setMessageReaction', {
        chat_id: conversationId,
        message_id: parseInt(messageId, 10),
        reaction: [{ type: 'emoji', emoji }],
      });
    } catch (err) {
      this.logger.warn(
        `Failed to add Telegram reaction: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    _emoji: string,
  ): Promise<void> {
    this.requireConnected();

    try {
      await this.bot!.telegram.callApi('setMessageReaction', {
        chat_id: conversationId,
        message_id: parseInt(messageId, 10),
        reaction: [],
      });
    } catch (err) {
      this.logger.warn(
        `Failed to remove Telegram reaction: ${err instanceof Error ? err.message : String(err)}`,
      );
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

    const config = this.telegramConfig;
    if (!config?.pairing?.requireApproval) {
      return { allowed: true };
    }

    const allowList = config.dmAllowList ?? config.pairing.allowList ?? [];
    const normalizedSender = senderId.trim().toLowerCase();
    const isAllowed = allowList.some((entry) => {
      const normalized = entry
        .trim()
        .toLowerCase()
        .replace(/^(telegram|tg):/i, '');
      return normalized === normalizedSender;
    });

    return isAllowed
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'DM sender not in allow-list.',
          pendingApproval: true,
        };
  }

  getPairingConfig(): PairingConfig | null {
    const config = this.telegramConfig;
    if (!config?.pairing) return null;
    return {
      requireApproval: config.pairing.requireApproval,
      allowList: config.dmAllowList ?? config.pairing.allowList ?? [],
      normalizeEntry: (raw: string) =>
        raw
          .trim()
          .toLowerCase()
          .replace(/^(telegram|tg):/i, ''),
    };
  }

  // -----------------------------------------------------------------------
  // Event Setup
  // -----------------------------------------------------------------------

  private setupEventHandlers(): void {
    if (!this.bot) return;

    this.bot.on('message', (ctx: TelegramContextLike) => {
      const msg = ctx.message;
      if (!msg) return;

      // Skip messages from self.
      if (msg.from?.id === this.selfBotId) return;

      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.emit('message', normalized);
      }
    });

    this.bot.on('edited_message', (ctx: TelegramContextLike) => {
      const msg = ctx.editedMessage ?? ctx.message;
      if (!msg || !msg.chat?.id || !msg.message_id) return;

      this.emit('message_edited', {
        channelId: this.id,
        conversationId: String(msg.chat.id),
        messageId: String(msg.message_id),
        newContent: this.normalizeTelegramContent(msg),
        timestamp: new Date(),
      });
    });
  }

  // -----------------------------------------------------------------------
  // Message Normalization
  // -----------------------------------------------------------------------

  private normalizeInboundMessage(
    msg: TelegramMessageLike,
  ): NormalizedMessage | null {
    if (!msg.chat?.id || !msg.message_id) return null;

    const chatType = this.resolveTelegramChatType(msg);
    const sender = this.normalizeTelegramSender(msg);
    const content = this.normalizeTelegramContent(msg);

    return {
      id: `telegram:${msg.message_id}`,
      channelId: this.id,
      platformMessageId: String(msg.message_id),
      conversationId: String(msg.chat.id),
      threadId: msg.message_thread_id
        ? String(msg.message_thread_id)
        : undefined,
      sender,
      content,
      timestamp: new Date(msg.date * 1000),
      chatType,
      replyTo: msg.reply_to_message?.message_id
        ? String(msg.reply_to_message.message_id)
        : undefined,
      raw: msg,
    };
  }

  private resolveTelegramChatType(msg: TelegramMessageLike): ChatType {
    if (msg.message_thread_id) return 'thread';
    const type = msg.chat?.type;
    if (type === 'private') return 'direct';
    if (type === 'group' || type === 'supergroup') return 'group';
    if (type === 'channel') return 'channel';
    return 'direct';
  }

  private normalizeTelegramSender(msg: TelegramMessageLike): NormalizedSender {
    const from = msg.from;
    return {
      id: from?.id ? String(from.id) : 'unknown',
      displayName:
        from?.first_name && from?.last_name
          ? `${from.first_name} ${from.last_name}`
          : from?.first_name ?? from?.username ?? 'Unknown',
      username: from?.username,
      isSelf: from?.id === this.selfBotId,
      isBot: from?.is_bot ?? false,
    };
  }

  private normalizeTelegramContent(msg: TelegramMessageLike): MessageContent {
    const text = msg.text ?? msg.caption ?? '';
    const entities = msg.entities ?? msg.caption_entities ?? [];

    const mentions: string[] = [];
    let mentionsSelf = false;

    for (const entity of entities) {
      if (entity.type === 'mention' && entity.offset !== undefined) {
        const mentionText = text.slice(
          entity.offset,
          entity.offset + entity.length,
        );
        mentions.push(mentionText.replace(/^@/, ''));
        if (
          this.selfUsername &&
          mentionText.toLowerCase() === `@${this.selfUsername.toLowerCase()}`
        ) {
          mentionsSelf = true;
        }
      }
      if (entity.type === 'text_mention' && entity.user?.id) {
        mentions.push(String(entity.user.id));
        if (entity.user.id === this.selfBotId) {
          mentionsSelf = true;
        }
      }
    }

    const attachments = this.extractTelegramAttachments(msg);

    return {
      text,
      rawText: text,
      attachments,
      mentions,
      mentionsSelf,
    };
  }

  private extractTelegramAttachments(
    msg: TelegramMessageLike,
  ): NormalizedAttachment[] {
    const attachments: NormalizedAttachment[] = [];

    if (msg.photo && msg.photo.length > 0) {
      // Take the largest photo.
      const largest = msg.photo[msg.photo.length - 1];
      attachments.push({
        type: 'image',
        filename: 'photo.jpg',
        sizeBytes: largest.file_size,
        url: `telegram:file:${largest.file_id}`,
      });
    }

    if (msg.document) {
      attachments.push({
        type: 'file',
        filename: msg.document.file_name ?? 'document',
        mimeType: msg.document.mime_type,
        sizeBytes: msg.document.file_size,
        url: `telegram:file:${msg.document.file_id}`,
      });
    }

    if (msg.video) {
      attachments.push({
        type: 'video',
        filename: msg.video.file_name ?? 'video.mp4',
        mimeType: msg.video.mime_type,
        sizeBytes: msg.video.file_size,
        url: `telegram:file:${msg.video.file_id}`,
      });
    }

    if (msg.audio) {
      attachments.push({
        type: 'audio',
        filename: msg.audio.file_name ?? 'audio.mp3',
        mimeType: msg.audio.mime_type,
        sizeBytes: msg.audio.file_size,
        url: `telegram:file:${msg.audio.file_id}`,
      });
    }

    if (msg.voice) {
      attachments.push({
        type: 'audio',
        filename: 'voice.ogg',
        mimeType: msg.voice.mime_type ?? 'audio/ogg',
        sizeBytes: msg.voice.file_size,
        url: `telegram:file:${msg.voice.file_id}`,
      });
    }

    return attachments;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private resolveMediaSource(
    attachment: OutboundAttachment,
  ): { source: Buffer; filename: string } | { url: string } | string {
    if (attachment.source === 'buffer' && attachment.buffer) {
      return { source: attachment.buffer, filename: attachment.filename };
    }
    if (attachment.source === 'url' && attachment.location) {
      return { url: attachment.location };
    }
    if (attachment.source === 'path' && attachment.location) {
      return attachment.location;
    }
    throw new Error(`Unsupported attachment source: ${attachment.source}`);
  }

  private requireConnected(): void {
    if (!this.connected || !this.bot) {
      throw new Error(
        'Telegram adapter is not connected. Call connect() first.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Type Stubs
// ---------------------------------------------------------------------------

interface TelegramBotLike {
  telegram: {
    getMe(): Promise<{
      id: number;
      username?: string;
      first_name: string;
      can_join_groups?: boolean;
      can_read_all_group_messages?: boolean;
    }>;
    sendMessage(
      chatId: string | number,
      text: string,
      extra?: Record<string, unknown>,
    ): Promise<TelegramMessageLike>;
    editMessageText(
      chatId: string | number,
      messageId: number,
      inlineMessageId: string | undefined,
      text: string,
      extra?: Record<string, unknown>,
    ): Promise<void>;
    deleteMessage(chatId: string | number, messageId: number): Promise<void>;
    sendChatAction(chatId: string | number, action: string): Promise<void>;
    sendPhoto(
      chatId: string | number,
      source: unknown,
      extra?: Record<string, unknown>,
    ): Promise<TelegramMessageLike>;
    sendVideo(
      chatId: string | number,
      source: unknown,
      extra?: Record<string, unknown>,
    ): Promise<TelegramMessageLike>;
    sendAudio(
      chatId: string | number,
      source: unknown,
      extra?: Record<string, unknown>,
    ): Promise<TelegramMessageLike>;
    sendDocument(
      chatId: string | number,
      source: unknown,
      extra?: Record<string, unknown>,
    ): Promise<TelegramMessageLike>;
    setWebhook(
      url: string,
      extra?: Record<string, unknown>,
    ): Promise<void>;
    callApi(method: string, params: Record<string, unknown>): Promise<void>;
  };
  on(event: string, handler: (ctx: TelegramContextLike) => void): void;
  launch(options?: { dropPendingUpdates?: boolean }): void;
  stop(reason?: string): void;
}

interface TelegramContextLike {
  message?: TelegramMessageLike;
  editedMessage?: TelegramMessageLike;
}

interface TelegramMessageLike {
  message_id: number;
  message_thread_id?: number;
  date: number;
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
  };
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
  caption?: string;
  entities?: TelegramEntityLike[];
  caption_entities?: TelegramEntityLike[];
  reply_to_message?: { message_id: number };
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  video?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  voice?: {
    file_id: string;
    mime_type?: string;
    file_size?: number;
  };
}

interface TelegramEntityLike {
  type: string;
  offset: number;
  length: number;
  user?: { id: number };
}

function inferMediaType(
  mimeType?: string,
  filename?: string,
): 'photo' | 'video' | 'audio' | 'document' {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? ''))
      return 'photo';
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext ?? ''))
      return 'video';
    if (['mp3', 'ogg', 'wav', 'flac', 'm4a'].includes(ext ?? ''))
      return 'audio';
  }
  return 'document';
}
