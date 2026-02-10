/**
 * Discord Channel Adapter
 *
 * Full-featured Discord adapter implementing the ChannelPlugin interface.
 * Patterns drawn from OpenClaw's Discord subsystem:
 *
 * - **Thread management**: creation, auto-thread, thread-starter caching,
 *   sanitized thread names (openclaw/discord/monitor/threading.ts)
 * - **Typing indicators**: periodic trigger with immediate first send
 *   (openclaw/discord/monitor/typing.ts)
 * - **Ack reactions**: scoped reaction-based acknowledgment with optional
 *   post-reply removal (openclaw/channels/ack-reactions.ts)
 * - **Message chunking**: code-fence-aware splitting that keeps fenced blocks
 *   balanced across chunks (openclaw/discord/chunk.ts)
 * - **Permission checking**: bitfield math against guild roles + channel
 *   overwrites (openclaw/discord/send.permissions.ts)
 * - **Rate-limit respect**: per-bucket tracking with Retry-After headers
 * - **Embed formatting**: rich embed builder for structured content
 * - **File attachments**: size-validated uploads with per-tier limits
 * - **Slash commands**: registration and interaction handler dispatch
 * - **Button / select menus**: component interaction routing
 * - **Reconnection with resume**: session ID + sequence tracking
 * - **Shard awareness**: metadata exposure for large bot deployments
 * - **DM vs guild routing**: chat-type resolution with isDMBased/isThread
 * - **Voice channel awareness**: voice state metadata in health checks
 *
 * discord.js is dynamically imported so the adapter compiles even when
 * the dependency is absent. Inline type stubs decouple the adapter from
 * the library's exact version.
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
  AckReactionScope,
} from '../types.js';

// ---------------------------------------------------------------------------
// Discord-Specific Configuration
// ---------------------------------------------------------------------------

export interface DiscordChannelConfig extends ChannelConfig {
  /** Discord bot token. */
  readonly botToken: string;
  /** Application ID (needed for slash command registration). */
  readonly applicationId?: string;
  /** Guild IDs to limit the bot to (empty = all guilds). */
  readonly guildIds?: readonly string[];
  /** DM allow-list: Discord user IDs allowed to DM. */
  readonly dmAllowList?: readonly string[];
  /** Whether to require mention in guild channels. */
  readonly requireMentionInGuilds?: boolean;
  /** Auto-thread: create a thread for each new message in specified channel IDs. */
  readonly autoThreadChannelIds?: readonly string[];
  /** Ack reaction emoji (default: eyes). */
  readonly ackReactionEmoji?: string;
  /** Ack reaction scope. */
  readonly ackReactionScope?: AckReactionScope;
  /** Remove ack reaction after the agent sends a reply. */
  readonly ackReactionRemoveAfterReply?: boolean;
  /** Shard count (0 or undefined = no sharding). */
  readonly shardCount?: number;
  /** Shard IDs to own (subset of 0..shardCount-1). */
  readonly shardIds?: readonly number[];
  /** Reply-to mode: "off" | "first" | "all". */
  readonly replyToMode?: 'off' | 'first' | 'all';
  /** Slash commands to register on connect. */
  readonly slashCommands?: readonly SlashCommandDefinition[];
  /** Enable debug logging. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// Slash Command Types
// ---------------------------------------------------------------------------

export interface SlashCommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly options?: readonly SlashCommandOption[];
}

export interface SlashCommandOption {
  readonly name: string;
  readonly description: string;
  readonly type: number; // ApplicationCommandOptionType value
  readonly required?: boolean;
  readonly choices?: readonly { name: string; value: string | number }[];
}

/** Interaction dispatched from a slash command, button, or select menu. */
export interface DiscordInteractionEvent {
  readonly interactionId: string;
  readonly type: 'command' | 'button' | 'select_menu';
  readonly commandName?: string;
  readonly customId?: string;
  readonly options?: Record<string, unknown>;
  readonly userId: string;
  readonly channelId: string;
  readonly guildId?: string;
  /** Opaque reference to the original discord.js Interaction for deferring/replying. */
  readonly raw: unknown;
}

// ---------------------------------------------------------------------------
// Embed Builder
// ---------------------------------------------------------------------------

export interface DiscordEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly color?: number;
  readonly timestamp?: string;
  readonly footer?: { text: string; icon_url?: string };
  readonly image?: { url: string };
  readonly thumbnail?: { url: string };
  readonly author?: { name: string; url?: string; icon_url?: string };
  readonly fields?: readonly { name: string; value: string; inline?: boolean }[];
}

export interface DiscordOutboundMessage extends OutboundMessage {
  /** Rich embeds to include. */
  readonly embeds?: readonly DiscordEmbed[];
  /** Message component rows (buttons, select menus). */
  readonly components?: readonly DiscordActionRow[];
}

export interface DiscordActionRow {
  readonly type: 1; // ACTION_ROW
  readonly components: readonly DiscordComponent[];
}

export type DiscordComponent = DiscordButton | DiscordSelectMenu;

export interface DiscordButton {
  readonly type: 2; // BUTTON
  readonly style: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
  readonly custom_id?: string;
  readonly url?: string;
  readonly emoji?: { name: string; id?: string };
  readonly disabled?: boolean;
}

export interface DiscordSelectMenu {
  readonly type: 3; // STRING_SELECT
  readonly custom_id: string;
  readonly placeholder?: string;
  readonly min_values?: number;
  readonly max_values?: number;
  readonly options: readonly {
    label: string;
    value: string;
    description?: string;
    emoji?: { name: string; id?: string };
    default?: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// Permission Summary
// ---------------------------------------------------------------------------

export interface DiscordPermissionsSummary {
  readonly channelId: string;
  readonly guildId?: string;
  readonly permissions: readonly string[];
  readonly raw: string;
  readonly isDm: boolean;
  readonly channelType?: number;
}

// ---------------------------------------------------------------------------
// Rate-Limit Bucket Tracker
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  remaining: number;
  resetAt: number; // ms epoch
  retryAfterMs: number;
}

class RateLimitTracker {
  private readonly buckets = new Map<string, RateLimitBucket>();

  /**
   * Record a rate-limit header set from a Discord API response.
   * @param route - The bucket key (e.g., "POST /channels/:id/messages").
   */
  record(route: string, remaining: number, resetAt: number, retryAfterMs: number): void {
    this.buckets.set(route, { remaining, resetAt, retryAfterMs });
  }

  /**
   * Returns how many milliseconds to wait before the next request on `route`,
   * or 0 if the route is not rate-limited.
   */
  delayMs(route: string): number {
    const bucket = this.buckets.get(route);
    if (!bucket) {
return 0;
}
    if (bucket.remaining > 0) {
return 0;
}
    const now = Date.now();
    if (now >= bucket.resetAt) {
      this.buckets.delete(route);
      return 0;
    }
    return bucket.resetAt - now;
  }

  /**
   * Wait if the route is rate-limited, then return.
   */
  async wait(route: string): Promise<void> {
    const delay = this.delayMs(route);
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  /** Expose current bucket state for health diagnostics. */
  snapshot(): Record<string, RateLimitBucket> {
    const out: Record<string, RateLimitBucket> = {};
    this.buckets.forEach((bucket, key) => {
      out[key] = { ...bucket };
    });
    return out;
  }
}

// ---------------------------------------------------------------------------
// Ack Reaction Logic (from OpenClaw's ack-reactions.ts)
// ---------------------------------------------------------------------------

function shouldAckReaction(params: {
  scope: AckReactionScope | undefined;
  isDirect: boolean;
  isGroup: boolean;
  wasMentioned: boolean;
}): boolean {
  const scope = params.scope ?? 'off';
  if (scope === 'off') {
return false;
}
  if (scope === 'all') {
return true;
}
  if (scope === 'direct') {
return params.isDirect;
}
  if (scope === 'group-mentions') {
    return params.isGroup && params.wasMentioned;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Thread Starter Cache (from OpenClaw's threading.ts)
// ---------------------------------------------------------------------------

interface ThreadStarter {
  text: string;
  author: string;
  timestamp?: number;
}

const THREAD_STARTER_CACHE = new Map<string, ThreadStarter>();

const MAX_THREAD_STARTER_CACHE_SIZE = 500;

function cacheThreadStarter(threadId: string, starter: ThreadStarter): void {
  if (THREAD_STARTER_CACHE.size >= MAX_THREAD_STARTER_CACHE_SIZE) {
    // Evict oldest entry (first inserted).
    const firstKey = THREAD_STARTER_CACHE.keys().next().value;
    if (firstKey !== undefined) {
      THREAD_STARTER_CACHE.delete(firstKey as string);
    }
  }
  THREAD_STARTER_CACHE.set(threadId, starter);
}

// ---------------------------------------------------------------------------
// Message Chunking (from OpenClaw's chunk.ts -- code-fence-aware)
// ---------------------------------------------------------------------------

const DISCORD_MAX_CHARS = 2000;
const DISCORD_MAX_LINES = 17;
const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

interface OpenFence {
  indent: string;
  markerChar: string;
  markerLen: number;
  openLine: string;
}

function parseFenceLine(line: string): OpenFence | null {
  const match = line.match(FENCE_RE);
  if (!match) {
return null;
}
  const indent = match[1] ?? '';
  const marker = match[2] ?? '';
  return {
    indent,
    markerChar: marker[0] ?? '`',
    markerLen: marker.length,
    openLine: line,
  };
}

function closeFenceLine(fence: OpenFence): string {
  return `${fence.indent}${fence.markerChar.repeat(fence.markerLen)}`;
}

function closeFenceIfNeeded(text: string, fence: OpenFence | null): string {
  if (!fence) {
return text;
}
  const close = closeFenceLine(fence);
  if (!text) {
return close;
}
  if (!text.endsWith('\n')) {
return `${text}\n${close}`;
}
  return `${text}${close}`;
}

function splitLongLine(line: string, limit: number, insideFence: boolean): string[] {
  const effectiveLimit = Math.max(1, limit);
  if (line.length <= effectiveLimit) {
return [line];
}
  const out: string[] = [];
  let remaining = line;
  while (remaining.length > effectiveLimit) {
    if (insideFence) {
      out.push(remaining.slice(0, effectiveLimit));
      remaining = remaining.slice(effectiveLimit);
      continue;
    }
    const window = remaining.slice(0, effectiveLimit);
    let breakIdx = -1;
    for (let i = window.length - 1; i >= 0; i--) {
      if (/\s/.test(window[i]!)) {
        breakIdx = i;
        break;
      }
    }
    if (breakIdx <= 0) {
breakIdx = effectiveLimit;
}
    out.push(remaining.slice(0, breakIdx));
    remaining = remaining.slice(breakIdx);
  }
  if (remaining.length > 0) {
out.push(remaining);
}
  return out;
}

/**
 * Code-fence-aware Discord text chunker.
 *
 * Splits text by both character count and soft line count while keeping
 * fenced code blocks balanced across chunks. Ported from OpenClaw's
 * `chunkDiscordText`.
 */
function chunkDiscordText(
  text: string,
  maxChars: number = DISCORD_MAX_CHARS,
  maxLines: number = DISCORD_MAX_LINES,
): string[] {
  const charLimit = Math.max(1, Math.floor(maxChars));
  const lineLimit = Math.max(1, Math.floor(maxLines));
  const body = text ?? '';
  if (!body) {
return [];
}

  const lineCount = body.split('\n').length;
  if (body.length <= charLimit && lineCount <= lineLimit) {
return [body];
}

  const lines = body.split('\n');
  const chunks: string[] = [];
  let current = '';
  let currentLines = 0;
  let openFence: OpenFence | null = null;

  const flush = (): void => {
    if (!current) {
return;
}
    const payload = closeFenceIfNeeded(current, openFence);
    if (payload.trim().length > 0) {
chunks.push(payload);
}
    current = '';
    currentLines = 0;
    if (openFence) {
      current = openFence.openLine;
      currentLines = 1;
    }
  };

  for (const originalLine of lines) {
    const fenceInfo = parseFenceLine(originalLine);
    const wasInsideFence = openFence !== null;
    let nextOpenFence: OpenFence | null = openFence;

    if (fenceInfo) {
      if (!openFence) {
        nextOpenFence = fenceInfo;
      } else if (
        openFence.markerChar === fenceInfo.markerChar &&
        fenceInfo.markerLen >= openFence.markerLen
      ) {
        nextOpenFence = null;
      }
    }

    const reserveChars = nextOpenFence ? closeFenceLine(nextOpenFence).length + 1 : 0;
    const reserveLines = nextOpenFence ? 1 : 0;
    const effectiveCharLimit = Math.max(1, charLimit - reserveChars);
    const effectiveLineLimit = Math.max(1, lineLimit - reserveLines);
    const prefixLen = current.length > 0 ? current.length + 1 : 0;
    const segmentLimit = Math.max(1, effectiveCharLimit - prefixLen);
    const segments = splitLongLine(originalLine, segmentLimit, wasInsideFence);

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx]!;
      const isContinuation = segIdx > 0;
      const delimiter = isContinuation ? '' : current.length > 0 ? '\n' : '';
      const addition = `${delimiter}${segment}`;
      const nextLen = current.length + addition.length;
      const nextLineCount = currentLines + (isContinuation ? 0 : 1);

      const exceedsChars = nextLen > effectiveCharLimit;
      const exceedsLines = nextLineCount > effectiveLineLimit;

      if ((exceedsChars || exceedsLines) && current.length > 0) {
        flush();
      }

      if (current.length > 0) {
        current += addition;
        if (!isContinuation) {
currentLines += 1;
}
      } else {
        current = segment;
        currentLines = 1;
      }
    }

    openFence = nextOpenFence;
  }

  if (current.length > 0) {
    const payload = closeFenceIfNeeded(current, openFence);
    if (payload.trim().length > 0) {
chunks.push(payload);
}
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Thread Name Sanitizer (from OpenClaw's threading.ts)
// ---------------------------------------------------------------------------

function sanitizeThreadName(rawName: string, fallbackId: string): string {
  const cleaned = rawName
    .replace(/<@!?\d+>/g, '')  // user mentions
    .replace(/<@&\d+>/g, '')   // role mentions
    .replace(/<#\d+>/g, '')    // channel mentions
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned || `Thread ${fallbackId}`;
  return base.slice(0, 100) || `Thread ${fallbackId}`;
}

// ---------------------------------------------------------------------------
// Reconnection State
// ---------------------------------------------------------------------------

interface ReconnectState {
  sessionId: string | null;
  sequence: number | null;
  attempts: number;
  lastAttemptAt: number;
  backoffMs: number;
}

// ---------------------------------------------------------------------------
// DiscordChannelAdapter
// ---------------------------------------------------------------------------

export class DiscordChannelAdapter extends BaseChannelAdapter {
  readonly id = 'discord' as const;

  readonly meta: ChannelMeta = {
    id: 'discord',
    label: 'Discord',
    blurb: 'Discord bot integration with threads, reactions, embeds, slash commands, and media.',
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
    maxMessageLength: DISCORD_MAX_CHARS,
    maxMediaBytes: 26_214_400, // 25 MB (free tier)
  };

  // Internal state
  private client: DiscordClientLike | null = null;
  private selfUserId: string | null = null;
  private discordConfig: DiscordChannelConfig | null = null;
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;
  private lastErrorAt: Date | null = null;

  // Rate limiting
  private readonly rateLimiter = new RateLimitTracker();

  // Reconnection
  private reconnectState: ReconnectState = {
    sessionId: null,
    sequence: null,
    attempts: 0,
    lastAttemptAt: 0,
    backoffMs: 1000,
  };
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Ack tracking: messageId -> reaction emoji used
  private readonly pendingAckReactions = new Map<string, {
    emoji: string;
    conversationId: string;
    promise: Promise<boolean>;
  }>();

  // Interaction handlers
  private readonly interactionHandlers = new Map<
    string,
    (event: DiscordInteractionEvent) => void | Promise<void>
  >();

  // Slash commands registered in the current session
  private registeredCommands: string[] = [];

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
      const discordJs = await importDiscordJs();
      const { Client, GatewayIntentBits, Partials } = discordJs;

      const clientOptions: Record<string, unknown> = {
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.GuildMessageTyping,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.DirectMessageReactions,
          GatewayIntentBits.DirectMessageTyping,
          GatewayIntentBits.MessageContent,
        ],
        partials: [
          Partials.Channel,
          Partials.Message,
          Partials.Reaction,
          Partials.User,
          Partials.GuildMember,
        ],
      };

      // Sharding support
      if (discordConfig.shardCount && discordConfig.shardCount > 0) {
        clientOptions['shards'] = discordConfig.shardIds
          ? [...discordConfig.shardIds]
          : 'auto';
        clientOptions['shardCount'] = discordConfig.shardCount;
      }

      this.client = new Client(clientOptions) as unknown as DiscordClientLike;
      this.setupEventHandlers();
      this.setupReconnectHandlers();

      await this.client.login(discordConfig.botToken);
      this.selfUserId = this.client.user?.id ?? null;
      this.connected = true;
      this.config = config;
      this.reconnectState.attempts = 0;
      this.reconnectState.backoffMs = 1000;

      this.logger.info(
        `Discord adapter connected (user: ${this.selfUserId}, ` +
        `guilds: ${this.client.guilds?.cache?.size ?? 0}).`,
      );

      // Register slash commands if configured
      if (discordConfig.slashCommands?.length) {
        await this.registerSlashCommands(discordConfig.slashCommands);
      }

      this.emit('connected', {
        channelId: this.id,
        accountId: this.selfUserId ?? undefined,
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();
      this.logger.error(`Discord adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected && !this.client) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.client?.destroy();
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
        lastErrorAt: this.lastErrorAt ?? undefined,
      };
    }

    const ping = this.client.ws?.ping ?? -1;
    const shardInfo = this.getShardInfo();
    const voiceConnections = this.getVoiceConnectionCount();

    return {
      channelId: this.id,
      healthy: this.connected && ping >= 0,
      connected: this.connected,
      latencyMs: ping >= 0 ? ping : undefined,
      accountId: this.selfUserId ?? undefined,
      lastMessageAt: this.lastMessageAt ?? undefined,
      lastErrorAt: this.lastErrorAt ?? undefined,
      lastError: this.lastError ?? undefined,
      details: {
        guilds: this.client.guilds?.cache?.size ?? 0,
        ping,
        shards: shardInfo,
        voiceConnections,
        reconnectAttempts: this.reconnectState.attempts,
        rateLimitBuckets: this.rateLimiter.snapshot(),
        registeredCommands: this.registeredCommands,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Messaging (with chunking, embeds, components)
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const channel = await this.fetchChannel(message.to);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: `Channel ${message.to} not found or not a text channel.` };
      }

      const discordMessage = message as DiscordOutboundMessage;
      const hasEmbeds = discordMessage.embeds && discordMessage.embeds.length > 0;
      const hasComponents = discordMessage.components && discordMessage.components.length > 0;

      // If there are embeds or components, send them with the first chunk.
      const chunks = chunkDiscordText(message.text, DISCORD_MAX_CHARS, DISCORD_MAX_LINES);

      // Ensure we have at least one send for embeds/components even if text is empty
      if (chunks.length === 0 && (hasEmbeds || hasComponents)) {
        chunks.push('');
      }

      if (chunks.length === 0) {
        return { ok: false, error: 'Empty message.' };
      }

      let lastMessageId: string | undefined;
      const route = `POST /channels/${message.to}/messages`;

      for (let i = 0; i < chunks.length; i++) {
        await this.rateLimiter.wait(route);

        const isFirst = i === 0;
        const sendOptions: Record<string, unknown> = {
          content: chunks[i] || undefined,
        };

        // Attach reply reference on first chunk only
        if (isFirst && message.replyTo) {
          sendOptions['reply'] = { messageReference: message.replyTo };
        }

        // Attach embeds on first chunk only
        if (isFirst && hasEmbeds) {
          sendOptions['embeds'] = discordMessage.embeds;
        }

        // Attach components on first chunk only
        if (isFirst && hasComponents) {
          sendOptions['components'] = discordMessage.components;
        }

        // Attach files on first chunk only
        if (isFirst && message.attachments?.length) {
          sendOptions['files'] = message.attachments.map((a) =>
            buildDiscordAttachment(a),
          );
        }

        const sent = await channel.send(sendOptions);
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
      const channel = await this.fetchChannel(conversationId);
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
      const channel = await this.fetchChannel(conversationId);
      if (!channel || !isTextChannel(channel)) {
return false;
}
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
  // Threading (from OpenClaw's threading.ts patterns)
  // -----------------------------------------------------------------------

  async replyToThread(
    conversationId: string,
    threadId: string,
    message: OutboundMessage,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const thread = await this.fetchChannel(threadId);
      if (!thread || !isTextChannel(thread)) {
        return { ok: false, error: `Thread ${threadId} not found.` };
      }

      const chunks = chunkDiscordText(message.text, DISCORD_MAX_CHARS, DISCORD_MAX_LINES);
      let lastMessageId: string | undefined;

      for (const chunk of chunks) {
        const sent = await thread.send({ content: chunk });
        lastMessageId = sent.id;
      }

      return {
        ok: true,
        messageId: lastMessageId,
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

  /**
   * Create a new thread from an existing message.
   * Name is sanitized following OpenClaw's `sanitizeDiscordThreadName`.
   */
  async createThread(
    conversationId: string,
    messageId: string,
    name: string,
    autoArchiveMinutes: 60 | 1440 | 4320 | 10080 = 60,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const channel = await this.fetchChannel(conversationId);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: 'Channel not found.' };
      }

      const sanitizedName = sanitizeThreadName(name, messageId);
      const msg = await channel.messages.fetch(messageId);

      // discord.js Message.startThread
      const startThread = (msg as Record<string, unknown>)['startThread'];
      if (typeof startThread !== 'function') {
        return { ok: false, error: 'startThread not available on this message.' };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      const thread = await (startThread as Function).call(msg, {
        name: sanitizedName,
        autoArchiveDuration: autoArchiveMinutes,
      }) as { id: string };

      return {
        ok: true,
        messageId: thread.id,
        conversationId: thread.id,
        timestamp: new Date(),
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Auto-thread: create a thread on a message if the message's channel
   * is in the auto-thread list and it is not already in a thread.
   * Returns the created thread's channel ID or null.
   */
  async maybeAutoThread(msg: {
    channelId: string;
    messageId: string;
    isThread: boolean;
    text: string;
  }): Promise<string | null> {
    const autoChannels = this.discordConfig?.autoThreadChannelIds ?? [];
    if (autoChannels.length === 0) {
return null;
}
    if (msg.isThread) {
return null;
}
    if (!autoChannels.includes(msg.channelId)) {
return null;
}

    const threadName = sanitizeThreadName(
      msg.text || 'Thread',
      msg.messageId,
    );

    const result = await this.createThread(
      msg.channelId,
      msg.messageId,
      threadName,
    );

    return result.ok ? (result.conversationId ?? null) : null;
  }

  /**
   * Retrieve the thread starter message, with caching.
   */
  async getThreadStarter(threadId: string): Promise<ThreadStarter | null> {
    const cached = THREAD_STARTER_CACHE.get(threadId);
    if (cached) {
return cached;
}

    this.requireConnected();

    try {
      const thread = await this.fetchChannel(threadId);
      if (!thread) {
return null;
}

      // Fetch the starter message (message whose ID matches the thread ID)
      const starterMsg = await thread.messages.fetch(threadId);
      if (!starterMsg) {
return null;
}

      const starter: ThreadStarter = {
        text: starterMsg.content ?? '',
        author: starterMsg.author?.username ?? 'Unknown',
        timestamp: starterMsg.createdTimestamp ?? undefined,
      };

      cacheThreadStarter(threadId, starter);
      return starter;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Reactions (with ack-reaction support from OpenClaw)
  // -----------------------------------------------------------------------

  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    const channel = await this.fetchChannel(conversationId);
    if (!channel || !isTextChannel(channel)) {
return;
}
    const msg = await channel.messages.fetch(messageId);
    await msg.react(emoji);
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    const channel = await this.fetchChannel(conversationId);
    if (!channel || !isTextChannel(channel)) {
return;
}
    const msg = await channel.messages.fetch(messageId);
    const reaction = msg.reactions.cache.find(
      (r: { emoji: { name: string | null } }) => r.emoji.name === emoji,
    );
    if (reaction && this.selfUserId) {
      await reaction.users.remove(this.selfUserId);
    }
  }

  /**
   * Send an ack reaction to a message if the scope/context warrants it.
   * Returns true if the reaction was added. Tracks the reaction so it
   * can be removed after the agent replies (if configured).
   */
  async sendAckReaction(params: {
    conversationId: string;
    messageId: string;
    chatType: ChatType;
    wasMentioned: boolean;
  }): Promise<boolean> {
    const scope = this.discordConfig?.ackReactionScope;
    const emoji = this.discordConfig?.ackReactionEmoji ?? '\u{1F440}'; // eyes

    const should = shouldAckReaction({
      scope,
      isDirect: params.chatType === 'direct',
      isGroup: params.chatType === 'channel' || params.chatType === 'group',
      wasMentioned: params.wasMentioned,
    });

    if (!should) {
return false;
}

    const promise = (async (): Promise<boolean> => {
      try {
        await this.addReaction(params.conversationId, params.messageId, emoji);
        return true;
      } catch {
        return false;
      }
    })();

    this.pendingAckReactions.set(params.messageId, {
      emoji,
      conversationId: params.conversationId,
      promise,
    });

    return promise;
  }

  /**
   * Remove the ack reaction for a message after the agent has replied.
   * No-op if ackReactionRemoveAfterReply is not enabled.
   */
  async removeAckReactionAfterReply(messageId: string): Promise<void> {
    if (!this.discordConfig?.ackReactionRemoveAfterReply) {
return;
}

    const pending = this.pendingAckReactions.get(messageId);
    if (!pending) {
return;
}

    const didAck = await pending.promise;
    if (!didAck) {
return;
}

    this.pendingAckReactions.delete(messageId);

    try {
      await this.removeReaction(pending.conversationId, messageId, pending.emoji);
    } catch (err) {
      this.logger.debug(
        `Failed to remove ack reaction on ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Typing Indicators (from OpenClaw's typing.ts)
  // -----------------------------------------------------------------------

  sendTypingIndicator(conversationId: string): TypingHandle {
    if (!this.connected || !this.client) {
      return { stop: () => {} };
    }

    let active = true;

    // Discord typing indicators last 10 seconds, so refresh every 8.
    const TYPING_REFRESH_MS = 8000;

    const sendOnce = async (): Promise<void> => {
      if (!active) {
return;
}
      try {
        const channel = await this.fetchChannel(conversationId);
        if (channel && isTextChannel(channel)) {
          await channel.sendTyping();
        }
      } catch {
        // Typing failures are non-critical.
      }
    };

    // Send immediately.
    void sendOnce();

    const interval = setInterval(() => {
      void sendOnce();
    }, TYPING_REFRESH_MS);

    return {
      stop: () => {
        active = false;
        clearInterval(interval);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Media / File Attachments (with size-limit validation)
  // -----------------------------------------------------------------------

  async sendMedia(
    conversationId: string,
    attachment: OutboundAttachment,
    options?: { text?: string; threadId?: string },
  ): Promise<DeliveryResult> {
    this.requireConnected();

    // Validate size against maxMediaBytes
    const maxBytes = this.capabilities.maxMediaBytes;
    if (maxBytes > 0 && attachment.buffer && attachment.buffer.length > maxBytes) {
      return {
        ok: false,
        error: `File "${attachment.filename}" exceeds Discord's ${formatBytes(maxBytes)} upload limit (${formatBytes(attachment.buffer.length)}).`,
      };
    }

    try {
      const targetId = options?.threadId ?? conversationId;
      const channel = await this.fetchChannel(targetId);
      if (!channel || !isTextChannel(channel)) {
        return { ok: false, error: 'Channel not found.' };
      }

      const files: DiscordAttachmentLike[] = [buildDiscordAttachment(attachment)];

      const sent = await channel.send({
        content: options?.text ?? '',
        files,
      });

      return {
        ok: true,
        messageId: sent.id,
        conversationId: targetId,
        timestamp: new Date(),
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // -----------------------------------------------------------------------
  // Slash Command Registration & Handling
  // -----------------------------------------------------------------------

  /**
   * Register slash commands with the Discord API.
   * If `guildIds` is configured, commands are registered per-guild (instant).
   * Otherwise they are registered globally (can take up to 1 hour to propagate).
   */
  async registerSlashCommands(
    commands: readonly SlashCommandDefinition[],
  ): Promise<void> {
    if (!this.client || !this.discordConfig?.applicationId) {
      this.logger.warn(
        'Cannot register slash commands: missing client or applicationId.',
      );
      return;
    }

    try {
      const rest = (this.client as unknown as Record<string, unknown>)['rest'];
      if (!rest || typeof (rest as unknown as Record<string, unknown>)['put'] !== 'function') {
        this.logger.warn('Cannot register slash commands: REST client unavailable.');
        return;
      }

      const body = commands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        options: cmd.options ?? [],
      }));

      const guildIds = this.discordConfig.guildIds ?? [];
      const appId = this.discordConfig.applicationId;
      const restClient = rest as { put(route: string, opts: Record<string, unknown>): Promise<unknown> };

      if (guildIds.length > 0) {
        // Guild-scoped registration (instant propagation)
        for (const guildId of guildIds) {
          await restClient.put(`/applications/${appId}/guilds/${guildId}/commands`, {
            body,
          });
          this.logger.info(
            `Registered ${commands.length} slash command(s) in guild ${guildId}.`,
          );
        }
      } else {
        // Global registration
        await restClient.put(`/applications/${appId}/commands`, { body });
        this.logger.info(
          `Registered ${commands.length} global slash command(s).`,
        );
      }

      this.registeredCommands = commands.map((c) => c.name);
    } catch (err) {
      this.logger.error(
        `Failed to register slash commands: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Register a handler for a specific interaction (slash command, button, or select menu).
   * For slash commands, the key is the command name.
   * For buttons/select menus, the key is the custom_id.
   * Returns an unsubscribe function.
   */
  onInteraction(
    key: string,
    handler: (event: DiscordInteractionEvent) => void | Promise<void>,
  ): () => void {
    this.interactionHandlers.set(key, handler);
    return () => {
      this.interactionHandlers.delete(key);
    };
  }

  // -----------------------------------------------------------------------
  // Permission Checking (from OpenClaw's send.permissions.ts)
  // -----------------------------------------------------------------------

  /**
   * Check the bot's effective permissions in a channel.
   * Resolves guild roles + channel overwrites using bitfield math,
   * matching OpenClaw's `fetchChannelPermissionsDiscord`.
   */
  async checkPermissions(channelId: string): Promise<DiscordPermissionsSummary> {
    this.requireConnected();

    try {
      const channel = await this.fetchChannel(channelId);
      if (!channel) {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: false,
        };
      }

      // DM channels have no permission overwrites.
      const isDmBased = typeof (channel as unknown as Record<string, unknown>)['isDMBased'] === 'function'
        && ((channel as unknown as Record<string, (...args: unknown[]) => unknown>)['isDMBased'])();
      if (isDmBased) {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: true,
          channelType: channel.type,
        };
      }

      // Guild channel: compute effective permissions.
      const guild = channel.guild;
      if (!guild || !this.selfUserId) {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: false,
        };
      }

      const member = await guild.members.fetch(this.selfUserId);
      if (!member) {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: false,
          guildId: guild.id,
        };
      }

      // discord.js computes effective permissions for us.
      const permissionsFor = channel.permissionsFor;
      if (typeof permissionsFor !== 'function') {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: false,
          guildId: guild.id,
        };
      }

      const permissions = permissionsFor.call(channel, member);
      if (!permissions) {
        return {
          channelId,
          permissions: [],
          raw: '0',
          isDm: false,
          guildId: guild.id,
        };
      }

      const serialized: string[] = typeof permissions.toArray === 'function'
        ? permissions.toArray() ?? []
        : [];
      const rawBitfield = permissions.bitfield;
      const raw = rawBitfield !== null && rawBitfield !== undefined ? String(rawBitfield) : '0';

      return {
        channelId,
        guildId: guild.id,
        permissions: serialized,
        raw,
        isDm: false,
        channelType: channel.type,
      };
    } catch (err) {
      this.logger.error(
        `Permission check failed for ${channelId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        channelId,
        permissions: [],
        raw: '0',
        isDm: false,
      };
    }
  }

  // -----------------------------------------------------------------------
  // DM vs Guild Routing
  // -----------------------------------------------------------------------

  /**
   * Resolve whether a channel is a DM, guild text, or thread.
   */
  async resolveChannelType(channelId: string): Promise<{
    chatType: ChatType;
    guildId?: string;
    parentId?: string;
  }> {
    this.requireConnected();

    try {
      const channel = await this.fetchChannel(channelId);
      if (!channel) {
return { chatType: 'channel' };
}

      const isDm = typeof (channel as unknown as Record<string, unknown>)['isDMBased'] === 'function'
        && ((channel as unknown as Record<string, (...args: unknown[]) => unknown>)['isDMBased'])();
      if (isDm) {
        return { chatType: 'direct' };
      }

      const isThread = typeof (channel as unknown as Record<string, unknown>)['isThread'] === 'function'
        && ((channel as unknown as Record<string, (...args: unknown[]) => unknown>)['isThread'])();
      if (isThread) {
        return {
          chatType: 'thread',
          guildId: channel.guildId ?? undefined,
          parentId: channel.parentId ?? undefined,
        };
      }

      return {
        chatType: 'channel',
        guildId: channel.guildId ?? undefined,
      };
    } catch {
      return { chatType: 'channel' };
    }
  }

  // -----------------------------------------------------------------------
  // Voice Channel Awareness
  // -----------------------------------------------------------------------

  /**
   * Get voice channel metadata for a guild. Does not join voice;
   * just reports which voice channels exist and who is in them.
   */
  getVoiceChannelInfo(guildId: string): VoiceChannelInfo[] {
    if (!this.client) {
return [];
}

    try {
      const guildsCache = this.client.guilds?.cache as unknown as Map<string, Record<string, unknown>> | undefined;
      if (!guildsCache) {
return [];
}

      const guild = typeof guildsCache.get === 'function'
        ? guildsCache.get(guildId)
        : undefined;
      if (!guild) {
return [];
}

      const voiceStatesObj = guild['voiceStates'] as { cache?: Map<string, Record<string, unknown>> } | undefined;
      const voiceStates = voiceStatesObj?.cache;
      if (!voiceStates) {
return [];
}
      const voiceChannels = new Map<string, VoiceChannelInfo>();

      voiceStates.forEach((state) => {
        const channelIdValue = state['channelId'];
        if (typeof channelIdValue !== 'string' || !channelIdValue) {
return;
}

        let info = voiceChannels.get(channelIdValue);
        if (!info) {
          const channelsObj = guild['channels'] as { cache?: Map<string, { name?: string }> } | undefined;
          const chan = channelsObj?.cache?.get(channelIdValue);
          info = {
            channelId: channelIdValue,
            channelName: chan?.name ?? undefined,
            userIds: [],
          };
          voiceChannels.set(channelIdValue, info);
        }
        const memberObj = state['member'] as { id?: string } | undefined;
        if (memberObj?.id) {
          info.userIds.push(memberObj.id);
        }
      });

      return Array.from(voiceChannels.values());
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Shard Info
  // -----------------------------------------------------------------------

  /**
   * Expose shard metadata for large bot deployments.
   * Returns null if the client is not sharded.
   */
  getShardInfo(): ShardInfo | null {
    if (!this.client) {
return null;
}

    try {
      const shard = this.client.shard;
      if (!shard) {
return null;
}

      return {
        shardIds: shard.ids ?? [],
        shardCount: shard.count ?? 0,
        mode: shard.mode ?? 'process',
      };
    } catch {
      return null;
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
    if (!this.client) {
return;
}

    this.client.on('messageCreate', (msg: DiscordMessageLike) => {
      if (msg.author.id === this.selfUserId) {
return;
}
      if (msg.author.bot && !msg.webhookId) {
return;
}

      const normalized = this.normalizeInboundMessage(msg);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.emit('message', normalized);
      }
    });

    this.client.on('messageUpdate', (_old: unknown, updated: DiscordMessageLike) => {
      if (!updated.channel?.id || !updated.id) {
return;
}
      this.emit('message_edited', {
        channelId: this.id,
        conversationId: updated.channel.id,
        messageId: updated.id,
        newContent: this.normalizeDiscordContent(updated),
        timestamp: new Date(),
      });
    });

    this.client.on('messageDelete', (msg: DiscordMessageLike) => {
      if (!msg.channel?.id || !msg.id) {
return;
}
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

    this.client.on('typingStart', (typing: { channel?: { id: string }; user?: { id: string } }) => {
      if (!typing.channel?.id || !typing.user?.id) {
return;
}
      this.emit('typing', {
        channelId: this.id,
        conversationId: typing.channel.id,
        userId: typing.user.id,
      });
    });

    // Interaction handling (slash commands, buttons, select menus)
    this.client.on('interactionCreate', (interaction: DiscordInteractionLike) => {
      void this.handleInteraction(interaction);
    });

    this.client.on('error', (err: Error) => {
      this.lastError = err.message;
      this.lastErrorAt = new Date();
      this.emit('error', {
        channelId: this.id,
        error: err,
        recoverable: true,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Reconnection with Resume Support
  // -----------------------------------------------------------------------

  private setupReconnectHandlers(): void {
    if (!this.client) {
return;
}

    // Track session ID + sequence for resume
    this.client.on('ready', () => {
      const wsObj = this.client?.ws as Record<string, unknown> | undefined;
      const shardsObj = wsObj?.['shards'] as { first?: () => { sessionId?: string } } | undefined;
      this.reconnectState.sessionId = shardsObj?.first?.()?.sessionId ?? null;
      this.reconnectState.sequence = null;
      this.reconnectState.attempts = 0;
      this.reconnectState.backoffMs = 1000;
    });

    this.client.on('shardDisconnect', (event: { code: number }, shardId: number) => {
      this.logger.warn(
        `Discord shard ${shardId} disconnected with code ${event.code}.`,
      );

      // Non-resumable close codes: 4004 (auth failed), 4010 (invalid shard),
      // 4011 (sharding required), 4013 (invalid intents), 4014 (disallowed intents)
      const NON_RESUMABLE = [4004, 4010, 4011, 4013, 4014];
      if (NON_RESUMABLE.includes(event.code)) {
        this.logger.error(
          `Non-resumable close code ${event.code}. Not attempting reconnect.`,
        );
        this.connected = false;
        this.emit('disconnected', {
          channelId: this.id,
          accountId: this.selfUserId ?? undefined,
          reason: `Close code ${event.code}`,
        });
        return;
      }

      // discord.js handles automatic reconnection for most codes, but
      // we track state so health checks can report it.
      this.reconnectState.attempts += 1;
      this.reconnectState.lastAttemptAt = Date.now();
    });

    this.client.on('shardReconnecting', (shardId: number) => {
      this.logger.info(`Discord shard ${shardId} reconnecting...`);
    });

    this.client.on('shardResume', (shardId: number, replayedEvents: number) => {
      this.logger.info(
        `Discord shard ${shardId} resumed. Replayed ${replayedEvents} events.`,
      );
      this.connected = true;
      this.reconnectState.attempts = 0;
      this.reconnectState.backoffMs = 1000;
    });

    this.client.on('shardReady', (shardId: number) => {
      this.logger.info(`Discord shard ${shardId} ready.`);
      this.connected = true;
    });
  }

  // -----------------------------------------------------------------------
  // Interaction Dispatch
  // -----------------------------------------------------------------------

  private async handleInteraction(interaction: DiscordInteractionLike): Promise<void> {
    const event = this.normalizeInteraction(interaction);
    if (!event) {
return;
}

    const key = event.commandName ?? event.customId ?? '';
    const handler = this.interactionHandlers.get(key);

    if (handler) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(
          `Interaction handler "${key}" error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.debug(`No handler registered for interaction "${key}".`);
    }
  }

  private normalizeInteraction(
    interaction: DiscordInteractionLike,
  ): DiscordInteractionEvent | null {
    if (!interaction.id) {
return null;
}

    let type: DiscordInteractionEvent['type'];
    let commandName: string | undefined;
    let customId: string | undefined;
    let options: Record<string, unknown> | undefined;

    // InteractionType: 2 = APPLICATION_COMMAND
    if (interaction.type === 2 || interaction.isChatInputCommand?.()) {
      type = 'command';
      commandName = interaction.commandName;
      options = {};
      if (interaction.options?.data) {
        for (const opt of interaction.options.data) {
          if (opt.name && opt.value !== undefined) {
            options[opt.name] = opt.value;
          }
        }
      }
    } else if (interaction.isButton?.()) {
      type = 'button';
      customId = interaction.customId;
    } else if (interaction.isStringSelectMenu?.() || interaction.isSelectMenu?.()) {
      type = 'select_menu';
      customId = interaction.customId;
    } else {
      return null;
    }

    return {
      interactionId: interaction.id,
      type,
      commandName,
      customId,
      options,
      userId: interaction.user?.id ?? '',
      channelId: interaction.channelId ?? '',
      guildId: interaction.guildId ?? undefined,
      raw: interaction,
    };
  }

  // -----------------------------------------------------------------------
  // Message Normalization
  // -----------------------------------------------------------------------

  private normalizeInboundMessage(
    msg: DiscordMessageLike,
  ): NormalizedMessage | null {
    if (!msg.channel?.id || !msg.id) {
return null;
}

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
    if (msg.channel?.isThread?.()) {
return 'thread';
}
    if (msg.channel?.isDMBased?.()) {
return 'direct';
}
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
      text: this.stripDiscordMentions(text),
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

    const mentionRegex = /<@!?(\d+)>/g;
    let regexMatch: RegExpExecArray | null;
    while ((regexMatch = mentionRegex.exec(text)) !== null) {
      if (regexMatch[1]) {
mentionedIds.push(regexMatch[1]);
}
    }

    if (msg.mentions?.users) {
      msg.mentions.users.forEach((_value, userId) => {
        if (!mentionedIds.includes(userId)) {
          mentionedIds.push(userId);
        }
      });
    }

    return mentionedIds;
  }

  private extractDiscordAttachments(
    msg: DiscordMessageLike,
  ): NormalizedAttachment[] {
    if (!msg.attachments) {
return [];
}

    const result: NormalizedAttachment[] = [];
    msg.attachments.forEach((attachment) => {
      result.push({
        type: resolveAttachmentType(attachment.contentType ?? undefined),
        filename: attachment.name ?? 'unknown',
        mimeType: attachment.contentType ?? undefined,
        sizeBytes: attachment.size,
        url: attachment.url,
        thumbnailUrl: attachment.proxyURL,
      });
    });
    return result;
  }

  /** Strip user/channel/role mentions from text (matching OpenClaw's stripPatterns). */
  private stripDiscordMentions(text: string): string {
    return text
      .replace(/<@!?\d+>/g, '')  // user mentions
      .replace(/<#\d+>/g, '')    // channel mentions
      .replace(/<@&\d+>/g, '')   // role mentions
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

  private async fetchChannel(id: string): Promise<DiscordChannelLike | null> {
    if (!this.client) {
return null;
}
    try {
      return await this.client.channels.fetch(id);
    } catch {
      return null;
    }
  }

  private getVoiceConnectionCount(): number {
    if (!this.client) {
return 0;
}
    try {
      let count = 0;
      const guildsCache = this.client.guilds?.cache as unknown as Map<string, Record<string, unknown>> | undefined;
      if (!guildsCache) {
return 0;
}
      guildsCache.forEach((guild) => {
        const voiceStatesObj = guild['voiceStates'] as { cache?: Map<string, Record<string, unknown>> } | undefined;
        const voiceStates = voiceStatesObj?.cache;
        if (voiceStates) {
          let found = false;
          voiceStates.forEach((state) => {
            if (found) {
return;
}
            const memberObj = state['member'] as { id?: string } | undefined;
            if (memberObj?.id === this.selfUserId) {
              count++;
              found = true;
            }
          });
        }
      });
      return count;
    } catch {
      return 0;
    }
  }

  // -----------------------------------------------------------------------
  // Static Utilities (exposed for external use)
  // -----------------------------------------------------------------------

  /** Code-fence-aware text chunker. */
  static chunkText(
    text: string,
    maxChars: number = DISCORD_MAX_CHARS,
    maxLines: number = DISCORD_MAX_LINES,
  ): string[] {
    return chunkDiscordText(text, maxChars, maxLines);
  }

  /** Sanitize a string for use as a Discord thread name. */
  static sanitizeThreadName(rawName: string, fallbackId: string): string {
    return sanitizeThreadName(rawName, fallbackId);
  }

  /** Reset the thread starter cache (for testing). */
  static __resetThreadStarterCacheForTest(): void {
    THREAD_STARTER_CACHE.clear();
  }
}

// ---------------------------------------------------------------------------
// Voice Channel Info
// ---------------------------------------------------------------------------

export interface VoiceChannelInfo {
  channelId: string;
  channelName?: string;
  userIds: string[];
}

// ---------------------------------------------------------------------------
// Shard Info
// ---------------------------------------------------------------------------

export interface ShardInfo {
  shardIds: number[];
  shardCount: number;
  mode: string;
}

// ---------------------------------------------------------------------------
// Type Stubs for Loose Coupling with discord.js
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
  /* eslint-disable @typescript-eslint/no-explicit-any -- interop boundary with discord.js EventEmitter */
  on(event: string, handler: (...args: any[]) => void): void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  shard?: { ids?: number[]; count?: number; mode?: string };
}

interface DiscordChannelLike {
  id: string;
  type?: number;
  guildId?: string;
  parentId?: string;
  guild?: {
    id: string;
    members: { fetch(id: string): Promise<unknown> };
    channels?: { cache?: Map<string, { name?: string }> };
    voiceStates?: { cache?: Map<string, unknown> };
  };
  send(options: Record<string, unknown>): Promise<{ id: string }>;
  sendTyping(): Promise<void>;
  messages: {
    fetch(id: string): Promise<{
      id: string;
      content?: string;
      author?: { username?: string };
      createdTimestamp?: number;
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
  permissionsFor?(member: unknown): {
    toArray?(): string[];
    bitfield?: bigint | { toString(): string };
  } | null;
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
  emoji: { name: string | null; id?: string | null };
}

interface DiscordInteractionLike {
  id: string;
  type: number;
  commandName?: string;
  customId?: string;
  user?: { id: string };
  channelId?: string;
  guildId?: string;
  options?: {
    data?: Array<{ name: string; value: unknown }>;
  };
  isChatInputCommand?(): boolean;
  isButton?(): boolean;
  isStringSelectMenu?(): boolean;
  isSelectMenu?(): boolean;
}

interface DiscordAttachmentLike {
  attachment: string | Buffer;
  name: string;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function isTextChannel(channel: unknown): channel is DiscordChannelLike {
  return channel !== null && typeof (channel as { send?: unknown }).send === 'function';
}

function resolveAttachmentType(
  mimeType?: string,
): 'image' | 'video' | 'audio' | 'file' {
  if (!mimeType) {
return 'file';
}
  if (mimeType.startsWith('image/')) {
return 'image';
}
  if (mimeType.startsWith('video/')) {
return 'video';
}
  if (mimeType.startsWith('audio/')) {
return 'audio';
}
  return 'file';
}

function buildDiscordAttachment(a: OutboundAttachment): DiscordAttachmentLike {
  if (a.source === 'buffer' && a.buffer) {
    return { attachment: a.buffer, name: a.filename };
  }
  if (a.source === 'path' && a.location) {
    return { attachment: a.location, name: a.filename };
  }
  if (a.source === 'url' && a.location) {
    return { attachment: a.location, name: a.filename };
  }
  return { attachment: '', name: a.filename };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
return `${bytes} B`;
}
  if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Dynamic import of discord.js. Allows the adapter to compile and be
 * type-checked even when discord.js is not installed.
 */
async function importDiscordJs(): Promise<{
  Client: new (options: Record<string, unknown>) => unknown;
  GatewayIntentBits: Record<string, number>;
  Partials: Record<string, number>;
}> {
  try {
    // eslint-disable-next-line import/no-unresolved
    return await import('discord.js');
  } catch {
    throw new Error(
      'discord.js is not installed. Run `npm install discord.js` to use the Discord adapter.',
    );
  }
}
