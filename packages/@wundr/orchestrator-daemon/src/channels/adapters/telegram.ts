/**
 * Telegram Channel Adapter
 *
 * Implements the ChannelPlugin interface for Telegram using the Bot API.
 * Aligned with OpenClaw's Telegram dock which supports direct, group,
 * channel, and thread chat types with a 4096-character message limit.
 *
 * Key patterns ported from OpenClaw:
 * - Stale thread ID recovery (retry on "message thread not found" 400)
 * - HTML fallback when Markdown/HTML parse fails
 * - Rate limiting (Telegram's 30 msg/sec global limit)
 * - Inline keyboard buttons with callback query handling
 * - Command routing (/start, /help, custom commands)
 * - Webhook vs polling mode selection
 * - Group vs private chat routing with topic support
 * - Markdown-to-Telegram-HTML conversion
 * - Long message splitting preserving code blocks
 * - Telegram login widget authentication
 *
 * @packageDocumentation
 */

import { BaseChannelAdapter } from '../types.js';

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Telegram's maximum message text length. */
const TELEGRAM_MAX_TEXT = 4096;

/** Telegram's maximum caption length for media messages. */
const TELEGRAM_MAX_CAPTION = 1024;

/** Telegram Bot API standard file upload limit: 50 MB. */
const TELEGRAM_MAX_MEDIA_BYTES = 52_428_800;

/** Telegram global rate limit: 30 messages per second. */
const TELEGRAM_RATE_LIMIT_PER_SECOND = 30;

/** Telegram typing indicator duration in seconds. */
const TELEGRAM_TYPING_DURATION_SEC = 5;

/** Regex matching Telegram "can't parse entities" errors. */
const PARSE_ERR_RE = /can't parse entities|parse entities|find end of the entity/i;

/** Regex matching Telegram "message thread not found" 400 errors. */
const THREAD_NOT_FOUND_RE = /400:\s*Bad Request:\s*message thread not found/i;

/** Regex matching Telegram "chat not found" errors. */
const CHAT_NOT_FOUND_RE = /400:\s*Bad Request:\s*chat not found/i;

/** Regex matching Telegram "Forbidden" (403) errors where the bot was blocked/kicked. */
const FORBIDDEN_RE = /403:\s*Forbidden/i;

/** Regex matching Telegram "message to edit not found" errors. */
const EDIT_NOT_FOUND_RE = /400:\s*Bad Request:\s*message to edit not found/i;

/** Regex matching Telegram "message to delete not found" errors. */
const DELETE_NOT_FOUND_RE = /400:\s*Bad Request:\s*message to delete not found/i;

// ---------------------------------------------------------------------------
// Telegram-Specific Configuration
// ---------------------------------------------------------------------------

export interface TelegramChannelConfig extends ChannelConfig {
  /** Telegram Bot API token from @BotFather. */
  readonly botToken: string;
  /** Webhook URL (if using webhook mode instead of polling). */
  readonly webhookUrl?: string;
  /** Webhook secret for verification (X-Telegram-Bot-Api-Secret-Token). */
  readonly webhookSecret?: string;
  /** Webhook port for the internal HTTP server when using webhook mode. */
  readonly webhookPort?: number;
  /** DM allow-list: Telegram user IDs or usernames. */
  readonly dmAllowList?: readonly string[];
  /** Whether to use long polling (default) or webhook mode. */
  readonly mode?: 'polling' | 'webhook';
  /** Custom commands beyond the built-in /start and /help. */
  readonly customCommands?: readonly TelegramCommandDef[];
  /** Whether to drop pending updates on launch. Defaults to true. */
  readonly dropPendingUpdates?: boolean;
  /** Enable debug logging for API calls. */
  readonly debug?: boolean;
  /** Allowed update types (e.g. ["message", "callback_query"]). */
  readonly allowedUpdates?: readonly string[];
  /** Group mention policy: whether the bot must be mentioned to respond. */
  readonly groupRequireMention?: boolean;
  /** Forum topic -> skill mapping for supergroup topic routing. */
  readonly topicMapping?: Readonly<Record<number, string>>;
  /** Reply-to mode: "first" = reply to first message, "off" = no native reply. */
  readonly replyToMode?: 'first' | 'all' | 'off';
  /** HMAC secret for Telegram Login Widget validation. */
  readonly loginWidgetSecret?: string;
}

// ---------------------------------------------------------------------------
// Command Definition
// ---------------------------------------------------------------------------

/**
 * Defines a custom bot command that the adapter will register with Telegram
 * and route to a handler callback.
 */
export interface TelegramCommandDef {
  /** Command name without the leading slash (e.g. "settings"). */
  readonly command: string;
  /** Human-readable description shown in the command menu. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Inline Keyboard Types
// ---------------------------------------------------------------------------

/**
 * A single inline keyboard button.
 */
export interface InlineButton {
  /** Button label. */
  readonly text: string;
  /** Callback data (max 64 bytes). */
  readonly callbackData?: string;
  /** URL to open when the button is pressed. */
  readonly url?: string;
}

/**
 * Payload emitted when a user presses an inline keyboard button.
 */
export interface CallbackQueryPayload {
  /** Unique callback query identifier. */
  readonly queryId: string;
  /** The data attached to the button that was pressed. */
  readonly data: string;
  /** The message that contained the inline keyboard. */
  readonly message?: NormalizedMessage;
  /** The user who pressed the button. */
  readonly sender: NormalizedSender;
  /** Chat ID where the button was pressed. */
  readonly chatId: string;
  /** Original message ID the button is attached to. */
  readonly messageId: string;
}

// ---------------------------------------------------------------------------
// Extended Outbound Message
// ---------------------------------------------------------------------------

/**
 * Extended outbound message with Telegram-specific features.
 */
export interface TelegramOutboundMessage extends OutboundMessage {
  /** Parse mode: 'Markdown', 'MarkdownV2', 'HTML', or undefined for plain. */
  readonly parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  /** Inline keyboard buttons (rows of buttons). */
  readonly inlineKeyboard?: readonly (readonly InlineButton[])[];
  /** Disable link preview. */
  readonly disableLinkPreview?: boolean;
  /** Send silently (no notification sound). */
  readonly silent?: boolean;
  /** Protect content from forwarding/saving. */
  readonly protectContent?: boolean;
  /** Forum topic thread ID for supergroup topics. */
  readonly topicThreadId?: number;
}

// ---------------------------------------------------------------------------
// Token Bucket Rate Limiter
// ---------------------------------------------------------------------------

/**
 * Simple token-bucket rate limiter aligned with Telegram's 30 msg/sec
 * global limit. Callers await acquire() before each API call; if the
 * bucket is empty the promise resolves after enough tokens refill.
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxTokens: number = TELEGRAM_RATE_LIMIT_PER_SECOND,
    private readonly refillIntervalMs: number = 1000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.scheduleRefill();
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const periods = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + periods * this.maxTokens,
      );
      this.lastRefill += periods * this.refillIntervalMs;
      this.drainQueue();
    }
  }

  private drainQueue(): void {
    while (this.queue.length > 0 && this.tokens > 0) {
      this.tokens -= 1;
      const next = this.queue.shift();
      if (next) {
next();
}
    }
  }

  private scheduleRefill(): void {
    const delay = this.refillIntervalMs - (Date.now() - this.lastRefill);
    setTimeout(() => {
      this.refill();
    }, Math.max(0, delay));
  }
}

// ---------------------------------------------------------------------------
// TelegramChannelAdapter
// ---------------------------------------------------------------------------

export class TelegramChannelAdapter extends BaseChannelAdapter {
  readonly id = 'telegram' as const;

  readonly meta: ChannelMeta = {
    id: 'telegram',
    label: 'Telegram',
    blurb: 'Telegram Bot API integration with groups, channels, topics, and threads.',
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
    maxMessageLength: TELEGRAM_MAX_TEXT,
    maxMediaBytes: TELEGRAM_MAX_MEDIA_BYTES,
  };

  private bot: TelegramBotLike | null = null;
  private telegramConfig: TelegramChannelConfig | null = null;
  private selfBotId: number | null = null;
  private selfUsername: string | null = null;
  private lastMessageAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;
  private readonly rateLimiter = new TokenBucketRateLimiter();
  private readonly commandHandlers = new Map<string, Set<CommandHandler>>();
  private readonly callbackHandlers = new Set<CallbackQueryHandler>();
  private readonly seenCallbackQueryIds = new Map<string, number>();
  private seenCallbackCleanupTimer: ReturnType<typeof setInterval> | null = null;

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
      // Dynamic import -- telegraf/grammy may not be installed in all
      // environments. We try telegraf first, then grammy as a fallback.
      const BotConstructor = await loadBotConstructor();

      this.bot = new BotConstructor(
        telegramConfig.botToken,
      ) as unknown as TelegramBotLike;

      this.setupEventHandlers();
      this.setupCommandHandlers();
      this.setupCallbackQueryHandler();

      // Get bot info.
      const botInfo = await this.bot.telegram.getMe();
      this.selfBotId = botInfo.id;
      this.selfUsername = botInfo.username ?? null;

      // Start receiving updates.
      if (telegramConfig.mode === 'webhook' && telegramConfig.webhookUrl) {
        await this.bot.telegram.setWebhook(telegramConfig.webhookUrl, {
          secret_token: telegramConfig.webhookSecret,
          allowed_updates: telegramConfig.allowedUpdates as string[] | undefined,
        });
        this.logger.info(
          `Telegram webhook set: ${telegramConfig.webhookUrl}`,
        );
      } else {
        // Long polling (default).
        this.bot.launch({
          dropPendingUpdates: telegramConfig.dropPendingUpdates !== false,
          allowedUpdates: telegramConfig.allowedUpdates as string[] | undefined,
        });
      }

      // Set bot commands if custom commands are configured.
      await this.syncBotCommands();

      // Periodically clean stale callback query dedup entries.
      this.seenCallbackCleanupTimer = setInterval(() => {
        this.cleanupSeenCallbackQueries();
      }, 60_000);

      this.connected = true;
      this.config = config;

      this.logger.info(
        `Telegram adapter connected (bot: @${this.selfUsername}, id: ${this.selfBotId}, mode: ${telegramConfig.mode ?? 'polling'}).`,
      );

      this.emit('connected', {
        channelId: this.id,
        accountId: String(this.selfBotId),
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();
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

    if (this.seenCallbackCleanupTimer) {
      clearInterval(this.seenCallbackCleanupTimer);
      this.seenCallbackCleanupTimer = null;
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
    this.seenCallbackQueryIds.clear();
    this.callbackHandlers.clear();
    this.commandHandlers.clear();

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
        lastErrorAt: this.lastErrorAt ?? undefined,
      };
    }

    try {
      const start = Date.now();
      const me = await this.bot.telegram.getMe();
      const latencyMs = Date.now() - start;
      return {
        channelId: this.id,
        healthy: true,
        connected: true,
        latencyMs,
        accountId: String(me.id),
        lastMessageAt: this.lastMessageAt ?? undefined,
        lastErrorAt: this.lastErrorAt ?? undefined,
        details: {
          username: me.username,
          firstName: me.first_name,
          canJoinGroups: me.can_join_groups,
          canReadAllGroupMessages: me.can_read_all_group_messages,
          mode: this.telegramConfig?.mode ?? 'polling',
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errorMsg;
      this.lastErrorAt = new Date();
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: errorMsg,
        lastErrorAt: this.lastErrorAt,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    const extMsg = message as TelegramOutboundMessage;
    const chatId = message.to;
    const parseMode = extMsg.parseMode ?? 'HTML';
    const threadId = this.resolveThreadId(message.threadId, extMsg.topicThreadId);
    const inlineKeyboard = this.buildInlineKeyboardMarkup(extMsg.inlineKeyboard);

    // Split long messages to honor Telegram's 4096-char limit.
    const chunks = splitTelegramMessage(message.text, TELEGRAM_MAX_TEXT);
    let lastResult: DeliveryResult = { ok: false, error: 'No chunks to send' };

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const chunk = chunks[i];

      const baseExtra: Record<string, unknown> = {};
      if (threadId !== undefined) {
        baseExtra.message_thread_id = threadId;
      }
      // Only attach reply-to on the first chunk.
      if (i === 0 && message.replyTo) {
        baseExtra.reply_to_message_id = parseInt(message.replyTo, 10);
      }
      // Only attach inline keyboard on the last chunk.
      if (isLast && inlineKeyboard) {
        baseExtra.reply_markup = inlineKeyboard;
      }
      if (extMsg.silent) {
        baseExtra.disable_notification = true;
      }
      if (extMsg.protectContent) {
        baseExtra.protect_content = true;
      }
      if (extMsg.disableLinkPreview) {
        baseExtra.link_preview_options = { is_disabled: true };
      }

      lastResult = await this.sendTextWithFallbacks(
        chatId,
        chunk,
        parseMode,
        baseExtra,
      );

      if (!lastResult.ok) {
break;
}
    }

    return lastResult;
  }

  /**
   * Reply within a thread (forum topic or reply-to chain).
   *
   * For Telegram, this is equivalent to sendMessage with threadId set.
   * The method exists to satisfy the ChannelPlugin interface cleanly.
   */
  async replyToThread(
    conversationId: string,
    threadId: string,
    message: OutboundMessage,
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      ...message,
      to: conversationId,
      threadId,
    });
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      await this.rateLimiter.acquire();
      await this.bot!.telegram.editMessageText(
        conversationId,
        parseInt(messageId, 10),
        undefined,
        newText,
        { parse_mode: 'HTML' },
      );
      return { ok: true, messageId, conversationId };
    } catch (err) {
      const errMsg = formatErrorMessage(err);

      // If HTML parse fails, retry as plain text.
      if (PARSE_ERR_RE.test(errMsg)) {
        try {
          await this.bot!.telegram.editMessageText(
            conversationId,
            parseInt(messageId, 10),
            undefined,
            newText,
          );
          return { ok: true, messageId, conversationId };
        } catch (retryErr) {
          return {
            ok: false,
            error: formatErrorMessage(retryErr),
          };
        }
      }

      // Gracefully handle "message to edit not found".
      if (EDIT_NOT_FOUND_RE.test(errMsg)) {
        this.logger.warn(
          `Telegram editMessage: message ${messageId} not found in ${conversationId}.`,
        );
        return { ok: false, error: 'Message to edit not found.' };
      }

      return { ok: false, error: errMsg };
    }
  }

  /**
   * Edit a message's inline keyboard without changing its text.
   */
  async editMessageKeyboard(
    conversationId: string,
    messageId: string,
    inlineKeyboard?: readonly (readonly InlineButton[])[],
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      await this.rateLimiter.acquire();
      const markup = this.buildInlineKeyboardMarkup(inlineKeyboard) ?? {
        inline_keyboard: [],
      };
      await this.bot!.telegram.callApi('editMessageReplyMarkup', {
        chat_id: conversationId,
        message_id: parseInt(messageId, 10),
        reply_markup: markup,
      });
      return { ok: true, messageId, conversationId };
    } catch (err) {
      return { ok: false, error: formatErrorMessage(err) };
    }
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
  ): Promise<boolean> {
    this.requireConnected();

    try {
      await this.rateLimiter.acquire();
      await this.bot!.telegram.deleteMessage(
        conversationId,
        parseInt(messageId, 10),
      );
      return true;
    } catch (err) {
      const errMsg = formatErrorMessage(err);

      // Gracefully handle already-deleted messages.
      if (DELETE_NOT_FOUND_RE.test(errMsg)) {
        this.logger.debug(
          `Telegram deleteMessage: message ${messageId} already gone from ${conversationId}.`,
        );
        return true;
      }

      this.logger.error(
        `Failed to delete Telegram message ${messageId}: ${errMsg}`,
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
    const sendAction = async () => {
      if (!active || !this.bot) {
return;
}
      try {
        await this.bot.telegram.sendChatAction(conversationId, 'typing');
      } catch {
        // Ignore typing failures -- chat may have been deleted.
      }
    };

    // Telegram typing indicator lasts ~5 seconds, refresh every 4.
    const interval = setInterval(sendAction, (TELEGRAM_TYPING_DURATION_SEC - 1) * 1000);

    // Send immediately.
    void sendAction();

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

    // Validate file size.
    if (attachment.source === 'buffer' && attachment.buffer) {
      if (attachment.buffer.byteLength > TELEGRAM_MAX_MEDIA_BYTES) {
        return {
          ok: false,
          error:
            `File "${attachment.filename}" is ${formatBytes(attachment.buffer.byteLength)} ` +
            `but the Telegram limit is ${formatBytes(TELEGRAM_MAX_MEDIA_BYTES)}.`,
        };
      }
    }

    try {
      await this.rateLimiter.acquire();
      const source = this.resolveMediaSource(attachment);
      const extra: Record<string, unknown> = {};
      if (options?.text) {
        // Captions are limited to 1024 chars; truncate if needed.
        extra.caption = options.text.length > TELEGRAM_MAX_CAPTION
          ? options.text.slice(0, TELEGRAM_MAX_CAPTION - 3) + '...'
          : options.text;
        extra.parse_mode = 'HTML';
      }
      if (options?.threadId) {
        extra.message_thread_id = parseInt(options.threadId, 10);
      }

      const type = inferMediaType(attachment.mimeType, attachment.filename);
      const sent = await this.sendMediaWithThreadFallback(
        conversationId,
        type,
        source,
        extra,
      );

      return {
        ok: true,
        messageId: String(sent.message_id),
        conversationId: String(sent.chat.id),
        timestamp: new Date(sent.date * 1000),
      };
    } catch (err) {
      return { ok: false, error: formatErrorMessage(err) };
    }
  }

  /**
   * Download media from a Telegram file_id or URL.
   * For telegram:file:<file_id> URIs, uses getFileLink.
   */
  async downloadMedia(url: string): Promise<Buffer> {
    this.requireConnected();

    // Handle Telegram file_id URIs.
    const fileIdMatch = /^telegram:file:(.+)$/.exec(url);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      const fileLink = await this.bot!.telegram.callApi('getFile', {
        file_id: fileId,
      }) as { file_path?: string };

      if (!fileLink.file_path) {
        throw new Error(`Telegram getFile returned no file_path for ${fileId}`);
      }

      const downloadUrl =
        `https://api.telegram.org/file/bot${this.telegramConfig!.botToken}/${fileLink.file_path}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download Telegram file: HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }

    // Plain URL download.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
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
      await this.rateLimiter.acquire();
      await this.bot!.telegram.callApi('setMessageReaction', {
        chat_id: conversationId,
        message_id: parseInt(messageId, 10),
        reaction: [{ type: 'emoji', emoji }],
      });
    } catch (err) {
      this.logger.warn(
        `Failed to add Telegram reaction: ${formatErrorMessage(err)}`,
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
      await this.rateLimiter.acquire();
      await this.bot!.telegram.callApi('setMessageReaction', {
        chat_id: conversationId,
        message_id: parseInt(messageId, 10),
        reaction: [],
      });
    } catch (err) {
      this.logger.warn(
        `Failed to remove Telegram reaction: ${formatErrorMessage(err)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Command Handling
  // -----------------------------------------------------------------------

  /**
   * Register a handler for a specific bot command.
   * The command should be specified without the leading slash.
   *
   * @param command - Command name (e.g., "help", "settings").
   * @param handler - Callback invoked when the command is received.
   * @returns Unsubscribe function.
   */
  onCommand(
    command: string,
    handler: CommandHandler,
  ): () => void {
    const normalized = command.trim().toLowerCase();
    if (!this.commandHandlers.has(normalized)) {
      this.commandHandlers.set(normalized, new Set());
    }
    const handlers = this.commandHandlers.get(normalized)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * Register a handler for inline keyboard callback queries.
   * The handler receives the full callback payload and should return
   * true if it handled the query (to prevent further propagation).
   *
   * @param handler - Callback invoked when a callback query is received.
   * @returns Unsubscribe function.
   */
  onCallbackQuery(handler: CallbackQueryHandler): () => void {
    this.callbackHandlers.add(handler);
    return () => {
      this.callbackHandlers.delete(handler);
    };
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
    if (!config?.pairing) {
return null;
}
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

  /**
   * Validate a Telegram Login Widget authentication hash.
   *
   * Telegram login widget sends user data with a SHA-256 HMAC signature.
   * The secret key is SHA-256(bot_token), and the data-check-string is
   * the alphabetically sorted key=value pairs joined by newlines.
   *
   * @param authData - The authentication data received from the login widget.
   * @returns Whether the data is valid and not expired (within 1 day).
   */
  async validateLoginWidget(authData: Record<string, string>): Promise<{
    valid: boolean;
    userId?: string;
    username?: string;
    reason?: string;
  }> {
    const config = this.telegramConfig;
    const token = config?.loginWidgetSecret ?? config?.botToken;
    if (!token) {
      return { valid: false, reason: 'No bot token configured for login widget validation.' };
    }

    const { hash, ...data } = authData;
    if (!hash) {
      return { valid: false, reason: 'Missing hash in auth data.' };
    }

    // Check timestamp freshness (1 day).
    const authDate = parseInt(data.auth_date ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false, reason: 'Auth data has expired (older than 24 hours).' };
    }

    // Build the data-check-string.
    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    try {
      const crypto = await importNodeCrypto();
      const secretKey = crypto.createHash('sha256').update(token).digest();
      const hmac = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

      if (hmac !== hash) {
        return { valid: false, reason: 'Hash verification failed.' };
      }

      return {
        valid: true,
        userId: data.id,
        username: data.username,
      };
    } catch (err) {
      return {
        valid: false,
        reason: `Crypto error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Event Setup
  // -----------------------------------------------------------------------

  private setupEventHandlers(): void {
    if (!this.bot) {
return;
}

    // Inbound messages.
    this.bot.on('message', (ctx: TelegramContextLike) => {
      const msg = ctx.message;
      if (!msg) {
return;
}

      // Skip messages from self.
      if (msg.from?.id === this.selfBotId) {
return;
}

      // Check group mention policy.
      if (
        this.telegramConfig?.groupRequireMention &&
        this.isGroupChat(msg) &&
        !this.isSelfMentioned(msg)
      ) {
        return;
      }

      // Route commands separately.
      if (this.isCommandMessage(msg)) {
        this.dispatchCommand(msg);
        return;
      }

      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.emit('message', normalized);
      }
    });

    // Edited messages.
    this.bot.on('edited_message', (ctx: TelegramContextLike) => {
      const msg = ctx.editedMessage ?? ctx.message;
      if (!msg || !msg.chat?.id || !msg.message_id) {
return;
}

      this.emit('message_edited', {
        channelId: this.id,
        conversationId: String(msg.chat.id),
        messageId: String(msg.message_id),
        newContent: this.normalizeTelegramContent(msg),
        timestamp: new Date(),
      });
    });

    // Member events.
    this.bot.on('chat_member', (ctx: TelegramContextLike) => {
      const update = ctx.chatMember;
      if (!update) {
return;
}

      const chatId = String(update.chat?.id ?? '');
      const userId = String(update.new_chat_member?.user?.id ?? '');
      if (!chatId || !userId) {
return;
}

      const status = update.new_chat_member?.status;
      if (status === 'member' || status === 'administrator') {
        this.emit('member_joined', {
          channelId: this.id,
          conversationId: chatId,
          userId,
        });
      } else if (status === 'left' || status === 'kicked') {
        this.emit('member_left', {
          channelId: this.id,
          conversationId: chatId,
          userId,
        });
      }
    });
  }

  private setupCommandHandlers(): void {
    // Built-in /start command (required for Telegram bots).
    this.onCommand('start', (msg) => {
      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.emit('message', {
          ...normalized,
          content: {
            ...normalized.content,
            text: '/start' + (msg.text?.includes(' ')
              ? ' ' + msg.text.split(' ').slice(1).join(' ')
              : ''),
          },
        });
      }
    });

    // Built-in /help command.
    this.onCommand('help', (msg) => {
      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.emit('message', {
          ...normalized,
          content: {
            ...normalized.content,
            text: '/help',
          },
        });
      }
    });
  }

  private setupCallbackQueryHandler(): void {
    if (!this.bot) {
return;
}

    this.bot.on('callback_query', async (ctx: TelegramContextLike) => {
      const query = ctx.callbackQuery;
      if (!query || !query.data) {
return;
}

      // Dedup callback queries (Telegram may deliver duplicates).
      // Matches OpenClaw's deduplication pattern.
      const queryId = query.id;
      if (this.seenCallbackQueryIds.has(queryId)) {
        this.logger.debug(
          `Skipping duplicate callback_query ${queryId}.`,
        );
        return;
      }
      this.seenCallbackQueryIds.set(queryId, Date.now());

      const msg = query.message as TelegramMessageLike | undefined;
      const payload: CallbackQueryPayload = {
        queryId,
        data: query.data,
        message: msg ? (this.normalizeInboundMessage(msg) ?? undefined) : undefined,
        sender: {
          id: query.from?.id ? String(query.from.id) : 'unknown',
          displayName:
            query.from?.first_name && query.from?.last_name
              ? `${query.from.first_name} ${query.from.last_name}`
              : query.from?.first_name ?? 'Unknown',
          username: query.from?.username,
          isSelf: query.from?.id === this.selfBotId,
          isBot: query.from?.is_bot ?? false,
        },
        chatId: msg?.chat?.id ? String(msg.chat.id) : '',
        messageId: msg?.message_id ? String(msg.message_id) : '',
      };

      // Dispatch to registered handlers.
      let handled = false;
      for (const handler of this.callbackHandlers) {
        try {
          const result = await handler(payload);
          if (result === true) {
            handled = true;
            break;
          }
        } catch (err) {
          this.logger.error(
            `Error in callback query handler: ${formatErrorMessage(err)}`,
          );
        }
      }

      // Always answer the callback query to dismiss the loading indicator.
      try {
        await this.bot!.telegram.callApi('answerCallbackQuery', {
          callback_query_id: queryId,
        });
      } catch {
        // Answering may fail if the query is too old; ignore.
      }

      // If no handler consumed the callback, emit it as a message event
      // so the orchestrator's generic message pipeline can process it.
      if (!handled && payload.message) {
        this.emit('message', {
          ...payload.message,
          content: {
            ...payload.message.content,
            text: `[callback] ${payload.data}`,
          },
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Bot Command Sync
  // -----------------------------------------------------------------------

  /**
   * Sync registered bot commands with Telegram's command menu.
   * Combines built-in commands with custom commands from config.
   */
  private async syncBotCommands(): Promise<void> {
    if (!this.bot) {
return;
}

    const commands: Array<{ command: string; description: string }> = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help information' },
    ];

    const custom = this.telegramConfig?.customCommands ?? [];
    for (const cmd of custom) {
      commands.push({
        command: cmd.command.replace(/^\//, ''),
        description: cmd.description,
      });
    }

    try {
      await this.bot.telegram.callApi('setMyCommands', {
        commands,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to set Telegram bot commands: ${formatErrorMessage(err)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Message Normalization
  // -----------------------------------------------------------------------

  private normalizeInboundMessage(
    msg: TelegramMessageLike,
  ): NormalizedMessage | null {
    if (!msg.chat?.id || !msg.message_id) {
return null;
}

    const chatType = this.resolveTelegramChatType(msg);
    const sender = this.normalizeTelegramSender(msg);
    const content = this.normalizeTelegramContent(msg);

    return {
      id: `telegram:${msg.chat.id}:${msg.message_id}`,
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
    // If it is a supergroup with forum topics and has a thread_id, it is a thread.
    if (
      msg.chat?.type === 'supergroup' &&
      msg.is_topic_message &&
      msg.message_thread_id
    ) {
      return 'thread';
    }
    if (msg.message_thread_id && msg.chat?.type === 'supergroup') {
      return 'thread';
    }
    const type = msg.chat?.type;
    if (type === 'private') {
return 'direct';
}
    if (type === 'group' || type === 'supergroup') {
return 'group';
}
    if (type === 'channel') {
return 'channel';
}
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
      avatarUrl: undefined,
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
        mimeType: 'image/jpeg',
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
        mimeType: msg.video.mime_type ?? 'video/mp4',
        sizeBytes: msg.video.file_size,
        url: `telegram:file:${msg.video.file_id}`,
      });
    }

    if (msg.audio) {
      attachments.push({
        type: 'audio',
        filename: msg.audio.file_name ?? 'audio.mp3',
        mimeType: msg.audio.mime_type ?? 'audio/mpeg',
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

    if (msg.sticker) {
      attachments.push({
        type: 'image',
        filename: msg.sticker.set_name
          ? `${msg.sticker.set_name}.webp`
          : 'sticker.webp',
        mimeType: msg.sticker.is_animated ? 'application/x-tgsticker' : 'image/webp',
        url: `telegram:file:${msg.sticker.file_id}`,
      });
    }

    return attachments;
  }

  // -----------------------------------------------------------------------
  // Send With Fallbacks
  // -----------------------------------------------------------------------

  /**
   * Send a text message with:
   * 1. HTML parse mode
   * 2. Fallback to plain text if HTML parse fails
   * 3. Stale thread ID recovery if "message thread not found"
   * 4. Informative error wrapping for "chat not found"
   *
   * This implements the same retry/fallback chain OpenClaw uses in
   * send.ts -> sendWithThreadFallback + sendTelegramText.
   */
  private async sendTextWithFallbacks(
    chatId: string,
    text: string,
    parseMode: string,
    extra: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    const attempt = async (
      effectiveExtra: Record<string, unknown>,
    ): Promise<DeliveryResult> => {
      try {
        await this.rateLimiter.acquire();
        const sent = await this.bot!.telegram.sendMessage(chatId, text, {
          ...effectiveExtra,
          parse_mode: parseMode,
        });
        return {
          ok: true,
          messageId: String(sent.message_id),
          conversationId: String(sent.chat.id),
          timestamp: new Date(sent.date * 1000),
        };
      } catch (err) {
        const errMsg = formatErrorMessage(err);

        // Fallback: HTML/Markdown parse error -> retry as plain text.
        if (PARSE_ERR_RE.test(errMsg)) {
          this.logger.debug(
            `Telegram HTML parse failed, retrying as plain text: ${errMsg}`,
          );
          try {
            const sent = await this.bot!.telegram.sendMessage(chatId, text, {
              ...effectiveExtra,
              // Omit parse_mode to send as plain text.
            });
            return {
              ok: true,
              messageId: String(sent.message_id),
              conversationId: String(sent.chat.id),
              timestamp: new Date(sent.date * 1000),
            };
          } catch (plainErr) {
            return {
              ok: false,
              error: this.wrapChatNotFound(chatId, plainErr),
            };
          }
        }

        return {
          ok: false,
          error: this.wrapChatNotFound(chatId, err),
        };
      }
    };

    // First attempt with all parameters.
    const result = await attempt(extra);

    // Stale thread recovery: if the error is "message thread not found",
    // retry without message_thread_id. This matches OpenClaw's
    // sendWithThreadFallback pattern.
    if (
      !result.ok &&
      result.error &&
      THREAD_NOT_FOUND_RE.test(result.error) &&
      hasMessageThreadId(extra)
    ) {
      this.logger.warn(
        'Telegram thread not found, retrying without message_thread_id.',
      );
      const extraWithoutThread = { ...extra };
      delete extraWithoutThread.message_thread_id;
      return attempt(extraWithoutThread);
    }

    // Forbidden (403) recovery: the bot may have been blocked or kicked
    // from a group. Log and return a descriptive error.
    if (
      !result.ok &&
      result.error &&
      FORBIDDEN_RE.test(result.error)
    ) {
      this.logger.warn(
        `Telegram 403 Forbidden for chat ${chatId}: bot may be blocked or removed.`,
      );
    }

    return result;
  }

  /**
   * Send media with stale thread ID recovery.
   */
  private async sendMediaWithThreadFallback(
    conversationId: string,
    type: 'photo' | 'video' | 'audio' | 'document',
    source: unknown,
    extra: Record<string, unknown>,
  ): Promise<TelegramMessageLike> {
    const doSend = async (
      effectiveExtra: Record<string, unknown>,
    ): Promise<TelegramMessageLike> => {
      switch (type) {
        case 'photo':
          return this.bot!.telegram.sendPhoto(
            conversationId,
            source,
            effectiveExtra,
          );
        case 'video':
          return this.bot!.telegram.sendVideo(
            conversationId,
            source,
            effectiveExtra,
          );
        case 'audio':
          return this.bot!.telegram.sendAudio(
            conversationId,
            source,
            effectiveExtra,
          );
        default:
          return this.bot!.telegram.sendDocument(
            conversationId,
            source,
            effectiveExtra,
          );
      }
    };

    try {
      return await doSend(extra);
    } catch (err) {
      // Stale thread recovery.
      if (hasMessageThreadId(extra) && isTelegramThreadNotFoundError(err)) {
        this.logger.warn(
          'Telegram media send thread not found, retrying without message_thread_id.',
        );
        const extraWithoutThread = { ...extra };
        delete extraWithoutThread.message_thread_id;
        return doSend(extraWithoutThread);
      }
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Command Routing
  // -----------------------------------------------------------------------

  private isCommandMessage(msg: TelegramMessageLike): boolean {
    const entities = msg.entities ?? [];
    return entities.some(
      (e) => e.type === 'bot_command' && e.offset === 0,
    );
  }

  private dispatchCommand(msg: TelegramMessageLike): void {
    const text = msg.text ?? '';
    // Extract command: "/help@mybotname arg1" -> "help"
    const match = /^\/([a-zA-Z0-9_]+)(?:@\S+)?/.exec(text);
    if (!match) {
return;
}

    const command = match[1].toLowerCase();
    const handlers = this.commandHandlers.get(command);

    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(msg);
        } catch (err) {
          this.logger.error(
            `Error in command handler "/${command}": ${formatErrorMessage(err)}`,
          );
        }
      }
    } else {
      // No specific handler; emit as a regular message so the orchestrator
      // can handle it (e.g., custom agent commands).
      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.emit('message', normalized);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private resolveThreadId(
    threadId?: string,
    topicThreadId?: number,
  ): number | undefined {
    if (topicThreadId !== undefined) {
      return topicThreadId;
    }
    if (threadId) {
      const parsed = parseInt(threadId, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private buildInlineKeyboardMarkup(
    rows?: readonly (readonly InlineButton[])[],
  ): InlineKeyboardMarkup | undefined {
    if (!rows || rows.length === 0) {
return undefined;
}

    const keyboard = rows
      .map((row) =>
        row
          .filter((btn) => btn.text && (btn.callbackData || btn.url))
          .map((btn) => {
            if (btn.url) {
              return { text: btn.text, url: btn.url };
            }
            return { text: btn.text, callback_data: btn.callbackData! };
          }),
      )
      .filter((row) => row.length > 0);

    if (keyboard.length === 0) {
return undefined;
}
    return { inline_keyboard: keyboard };
  }

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

  private wrapChatNotFound(chatId: string, err: unknown): string {
    const errMsg = formatErrorMessage(err);
    if (CHAT_NOT_FOUND_RE.test(errMsg)) {
      return (
        `Telegram send failed: chat not found (chat_id=${chatId}). ` +
        'Likely: bot not started in DM, bot removed from group/channel, ' +
        'group migrated (new -100... id), or wrong bot token.'
      );
    }
    return errMsg;
  }

  private isGroupChat(msg: TelegramMessageLike): boolean {
    const type = msg.chat?.type;
    return type === 'group' || type === 'supergroup';
  }

  private isSelfMentioned(msg: TelegramMessageLike): boolean {
    const text = msg.text ?? msg.caption ?? '';
    if (!this.selfUsername) {
return false;
}
    return text.toLowerCase().includes(`@${this.selfUsername.toLowerCase()}`);
  }

  private requireConnected(): void {
    if (!this.connected || !this.bot) {
      throw new Error(
        'Telegram adapter is not connected. Call connect() first.',
      );
    }
  }

  private cleanupSeenCallbackQueries(): void {
    const cutoff = Date.now() - 120_000; // 2 minutes
    for (const [id, timestamp] of this.seenCallbackQueryIds) {
      if (timestamp < cutoff) {
        this.seenCallbackQueryIds.delete(id);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Message Splitting
// ---------------------------------------------------------------------------

/**
 * Split a message into chunks that fit within Telegram's text limit.
 * Preserves code blocks by avoiding splits within them.
 * Tries to split at newline boundaries, then space boundaries, then
 * hard-breaks as a last resort.
 *
 * This mirrors OpenClaw's chunkMarkdownIR + markdownToTelegramHtmlChunks
 * approach but operates on raw text for environments without the markdown IR.
 */
export function splitTelegramMessage(
  text: string,
  limit: number = TELEGRAM_MAX_TEXT,
): string[] {
  if (!text || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Determine if we are inside a code block at the cut point.
    const candidate = remaining.slice(0, limit);
    const codeBlockCount = countOccurrences(candidate, '```');
    const insideCodeBlock = codeBlockCount % 2 !== 0;

    let breakAt: number;

    if (insideCodeBlock) {
      // Try to break before the opening ``` of the unclosed code block.
      const lastOpener = candidate.lastIndexOf('```');
      if (lastOpener > 0) {
        // Break right before the code block.
        const nlBefore = candidate.lastIndexOf('\n', lastOpener);
        breakAt = nlBefore > 0 ? nlBefore : lastOpener;
      } else {
        // The code block starts at or near position 0. Try to include the
        // closing ``` by extending beyond the limit so the block stays atomic.
        const closerPos = remaining.indexOf('```', lastOpener + 3);
        if (closerPos !== -1) {
          // Include through the end of the closing ``` marker.
          breakAt = closerPos + 3;
          // Extend to the next newline after the closer if present.
          const nlAfterCloser = remaining.indexOf('\n', breakAt);
          if (nlAfterCloser !== -1 && nlAfterCloser <= breakAt + 1) {
            breakAt = nlAfterCloser;
          }
        } else {
          breakAt = findSoftBreak(candidate, limit);
        }
      }
    } else {
      breakAt = findSoftBreak(candidate, limit);
    }

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).replace(/^\n/, '');
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Markdown-to-Telegram-HTML Formatting
// ---------------------------------------------------------------------------

/**
 * Escape text for Telegram HTML parse mode.
 */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Basic Markdown-to-Telegram-HTML conversion.
 *
 * Handles:
 * - **bold** -> <b>bold</b>
 * - *italic* / _italic_ -> <i>italic</i>
 * - ~~strikethrough~~ -> <s>strikethrough</s>
 * - `code` -> <code>code</code>
 * - ```code block``` -> <pre><code>code block</code></pre>
 * - [text](url) -> <a href="url">text</a>
 * - ||spoiler|| -> <tg-spoiler>spoiler</tg-spoiler>
 *
 * For production use, consider a full markdown parser. This provides
 * a pragmatic baseline matching OpenClaw's format.ts patterns.
 */
export function markdownToTelegramHtml(markdown: string): string {
  let html = markdown;

  // Code blocks (must come first to avoid escaping inside them).
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeTelegramHtml(code.trimEnd())}</code></pre>`);
    return `\x00CB${idx}\x00`;
  });

  // Inline code (preserve before other formatting).
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeTelegramHtml(code)}</code>`);
    return `\x00IC${idx}\x00`;
  });

  // Escape remaining HTML entities.
  html = escapeTelegramHtml(html);

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/__(.+?)__/g, '<b>$1</b>');

  // Italic: *text* or _text_ (but not inside words with underscores).
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<i>$1</i>');
  html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<i>$1</i>');

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Spoiler: ||text||
  html = html.replace(/\|\|(.+?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );

  // Restore code blocks and inline code.
  // eslint-disable-next-line no-control-regex
  html = html.replace(/\x00IC(\d+)\x00/g, (_match, idx) => inlineCodes[parseInt(idx, 10)]);
  // eslint-disable-next-line no-control-regex
  html = html.replace(/\x00CB(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx, 10)]);

  return html;
}

// ---------------------------------------------------------------------------
// Dynamic Import Helpers
// ---------------------------------------------------------------------------

/**
 * Load the bot constructor from telegraf or grammy.
 * Uses dynamic import so the adapter compiles without either package installed.
 */
async function loadBotConstructor(): Promise<TelegramBotConstructor> {
  try {
    // eslint-disable-next-line import/no-unresolved
    const mod = await import('telegraf');
    return mod.Telegraf as unknown as TelegramBotConstructor;
  } catch {
    // telegraf not available; try grammy.
  }
  try {
    // @ts-expect-error -- grammy may not be installed; the dynamic import is
    // wrapped in try/catch and will fail gracefully at runtime.
    // eslint-disable-next-line import/no-unresolved
    const grammy = await import('grammy');
    return grammy.Bot as unknown as TelegramBotConstructor;
  } catch {
    // grammy not available either.
  }
  throw new Error(
    'Neither "telegraf" nor "grammy" packages are installed. ' +
    'Install one of them to use the Telegram adapter.',
  );
}

/**
 * Dynamic import of Node.js crypto module.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
async function importNodeCrypto(): Promise<typeof import('crypto')> {
  return await import('crypto');
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
return `${bytes} B`;
}
  if (bytes < 1_048_576) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
  if (bytes < 1_073_741_824) {
return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function hasMessageThreadId(
  params?: Record<string, unknown>,
): boolean {
  if (!params) {
return false;
}
  const value = params.message_thread_id;
  if (typeof value === 'number') {
return Number.isFinite(value);
}
  if (typeof value === 'string') {
return value.trim().length > 0;
}
  return false;
}

function isTelegramThreadNotFoundError(err: unknown): boolean {
  return THREAD_NOT_FOUND_RE.test(formatErrorMessage(err));
}

function inferMediaType(
  mimeType?: string,
  filename?: string,
): 'photo' | 'video' | 'audio' | 'document' {
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
return 'photo';
}
    if (mimeType.startsWith('video/')) {
return 'video';
}
    if (mimeType.startsWith('audio/')) {
return 'audio';
}
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext ?? '')) {
return 'photo';
}
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext ?? '')) {
return 'video';
}
    if (['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac'].includes(ext ?? '')) {
return 'audio';
}
  }
  return 'document';
}

function findSoftBreak(candidate: string, limit: number): number {
  // Try newline boundary within the limit.
  let breakAt = candidate.lastIndexOf('\n', limit);
  if (breakAt > 0 && breakAt >= limit * 0.5) {
    return breakAt;
  }

  // Try space boundary.
  breakAt = candidate.lastIndexOf(' ', limit);
  if (breakAt > 0 && breakAt >= limit * 0.5) {
    return breakAt;
  }

  // Hard break.
  return limit;
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Callback Types
// ---------------------------------------------------------------------------

/**
 * Handler for bot commands. Receives the raw Telegram message.
 */
type CommandHandler = (msg: TelegramMessageLike) => void;

/**
 * Handler for callback queries (inline keyboard button presses).
 * Return true to indicate the query was handled and prevent
 * further propagation.
 */
type CallbackQueryHandler = (
  payload: CallbackQueryPayload,
) => boolean | void | Promise<boolean | void>;

// ---------------------------------------------------------------------------
// Type Stubs
// ---------------------------------------------------------------------------
// Inline type stubs for the Telegram bot library. These allow the adapter
// to compile without telegraf/grammy installed, while matching the subset
// of the API surface actually used.

interface TelegramBotConstructor {
  new (token: string, options?: Record<string, unknown>): TelegramBotLike;
}

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
    callApi(method: string, params: Record<string, unknown>): Promise<unknown>;
  };
  on(event: string, handler: (ctx: TelegramContextLike) => void): void;
  launch(options?: {
    dropPendingUpdates?: boolean;
    allowedUpdates?: string[];
  }): void;
  stop(reason?: string): void;
}

interface TelegramContextLike {
  message?: TelegramMessageLike;
  editedMessage?: TelegramMessageLike;
  callbackQuery?: TelegramCallbackQueryLike;
  chatMember?: TelegramChatMemberUpdateLike;
}

interface TelegramCallbackQueryLike {
  id: string;
  data?: string;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message?: TelegramMessageLike;
}

interface TelegramChatMemberUpdateLike {
  chat?: { id: number };
  new_chat_member?: {
    user?: { id: number };
    status?: string;
  };
}

interface TelegramMessageLike {
  message_id: number;
  message_thread_id?: number;
  is_topic_message?: boolean;
  date: number;
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    is_forum?: boolean;
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
  sticker?: {
    file_id: string;
    set_name?: string;
    is_animated?: boolean;
  };
}

interface TelegramEntityLike {
  type: string;
  offset: number;
  length: number;
  user?: { id: number };
}

interface InlineKeyboardMarkup {
  inline_keyboard: Array<
    Array<{ text: string; callback_data?: string; url?: string }>
  >;
}
