/**
 * Slack Channel Adapter
 *
 * Full-featured Slack integration for the Wundr Orchestrator. Bridges the
 * @wundr/slack-agent SlackUserAgent into the ChannelPlugin abstraction with:
 *
 * - Thread management (create, reply, track threads; replyToMode: off/first/all)
 * - Typing indicators via periodic Slack API calls
 * - Reaction acknowledgments (ack receipt, optional removal after reply)
 * - File/media upload support (buffer, path, URL proxy)
 * - Slash command handling (/wundr and custom)
 * - Interactive components (buttons, modals, dropdowns via Block Kit)
 * - Rate limiting and retry logic with exponential backoff
 * - Channel/DM routing based on conversation type
 * - User mention resolution and stripping
 * - Message formatting (Block Kit sections, mrkdwn)
 * - Error recovery and reconnection with jitter
 * - Event subscription management
 *
 * Design aligned with OpenClaw's decomposed channel dock pattern
 * (dock.ts, ack-reactions.ts, slack.actions.ts, outbound/slack.ts).
 *
 * @packageDocumentation
 */

import { BaseChannelAdapter } from '../types.js';

import type {
  AckReactionScope,
  BlockKitBlock,
  BlockKitElement,
  BlockKitText,
  ChannelCapabilities,
  ChannelConfig,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChatType,
  DeliveryResult,
  InteractiveAction,
  MessageContent,
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedSender,
  OutboundAttachment,
  OutboundMessage,
  PairingConfig,
  RateLimitState,
  ReplyToMode,
  SenderValidation,
  SlashCommandPayload,
  ThreadingToolContext,
  TypingHandle,
} from '../types.js';

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
  /** Text chunk limit for outbound messages (default: 4000). */
  readonly textChunkLimit?: number;
  /** DM allow-list: platform user IDs allowed to DM without approval. */
  readonly dmAllowList?: readonly string[];

  // -- Threading ----------------------------------------------------------
  /** Reply-to mode: off | first | all (default: "off"). */
  readonly replyToMode?: ReplyToMode;
  /** Per-chat-type overrides for replyToMode. */
  readonly replyToModeByChatType?: Partial<
    Record<'direct' | 'group' | 'channel', ReplyToMode>
  >;

  // -- Ack Reactions ------------------------------------------------------
  /** Ack reaction emoji (default: "eyes"). */
  readonly ackReactionEmoji?: string;
  /** Ack reaction scope (default: "off"). */
  readonly ackReactionScope?: AckReactionScope;
  /** Remove ack reaction after the agent finishes replying (default: false). */
  readonly ackReactionRemoveAfterReply?: boolean;

  // -- Slash Commands -----------------------------------------------------
  /** Slash command configuration. */
  readonly slashCommand?: SlackSlashCommandConfig;

  // -- Rate Limiting ------------------------------------------------------
  /** Maximum retries for rate-limited requests (default: 3). */
  readonly maxRetries?: number;

  // -- Reconnection -------------------------------------------------------
  /** Maximum reconnect attempts before giving up (default: 10). */
  readonly maxReconnectAttempts?: number;
  /** Base delay in ms for exponential backoff on reconnect (default: 1000). */
  readonly reconnectBaseDelayMs?: number;

  // -- Event Subscriptions ------------------------------------------------
  /** Slack event types to subscribe to. If omitted, defaults to standard set. */
  readonly eventSubscriptions?: readonly string[];
}

/**
 * Configuration for the slash command handler.
 */
export interface SlackSlashCommandConfig {
  /** Enable slash command handling (default: false). */
  readonly enabled?: boolean;
  /** Command name without leading "/" (default: "wundr"). */
  readonly name?: string;
  /** Reply ephemerally so only the invoker sees the response (default: true). */
  readonly ephemeral?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Slack API text limit per message (mrkdwn). */
const SLACK_TEXT_CHUNK_LIMIT = 4000;

/** Default typing indicator refresh interval in ms. */
const TYPING_INDICATOR_INTERVAL_MS = 3000;

/** Default ack reaction emoji. */
const DEFAULT_ACK_EMOJI = 'eyes';

/** Default event subscriptions matching OpenClaw's Slack manifest. */
const DEFAULT_EVENT_SUBSCRIPTIONS: readonly string[] = [
  'app_mention',
  'message.channels',
  'message.groups',
  'message.im',
  'message.mpim',
  'reaction_added',
  'reaction_removed',
  'member_joined_channel',
  'member_left_channel',
  'channel_rename',
  'pin_added',
  'pin_removed',
];

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

/**
 * Token-bucket rate limiter that honors Slack's Retry-After header.
 * Slack uses a Tier system; this provides a generic layer with per-method
 * throttling and global backoff.
 */
class SlackRateLimiter {
  /** Current rate-limit state indexed by API method prefix. */
  private readonly state = new Map<string, RateLimitState>();
  /** Global backoff until this timestamp (ms). */
  private globalBackoffUntil = 0;
  private readonly maxRetries: number;
  private readonly logger: ChannelLogger;

  constructor(maxRetries: number, logger: ChannelLogger) {
    this.maxRetries = maxRetries;
    this.logger = logger;
  }

  /**
   * Execute `fn` with rate-limit awareness.
   * On 429 / rate_limited errors, wait and retry up to maxRetries times.
   */
  async execute<T>(
    method: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const methodKey = method.split('.').slice(0, 2).join('.');
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Wait if globally or per-method rate-limited.
      const waitMs = this.getWaitMs(methodKey);
      if (waitMs > 0) {
        this.logger.debug(
          `Rate limiter: waiting ${waitMs}ms before ${method} (attempt ${attempt + 1}).`,
        );
        await sleep(waitMs);
      }

      try {
        const result = await fn();
        // Clear rate-limit state on success.
        this.state.delete(methodKey);
        return result;
      } catch (err) {
        lastError = err;
        const retryAfter = extractRetryAfterSec(err);
        if (retryAfter > 0 && attempt < this.maxRetries) {
          this.logger.warn(
            `Rate limited on ${method}: retry after ${retryAfter}s (attempt ${attempt + 1}/${this.maxRetries}).`,
          );
          this.recordLimit(methodKey, retryAfter);
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  private getWaitMs(methodKey: string): number {
    const now = Date.now();
    const globalWait = Math.max(0, this.globalBackoffUntil - now);
    const methodState = this.state.get(methodKey);
    const methodWait = methodState
      ? Math.max(0, methodState.resetAt * 1000 - now)
      : 0;
    return Math.max(globalWait, methodWait);
  }

  private recordLimit(methodKey: string, retryAfterSec: number): void {
    const resetAt = Math.ceil(Date.now() / 1000) + retryAfterSec;
    this.state.set(methodKey, {
      remaining: 0,
      resetAt,
      limited: true,
      retryAfterSec,
    });
    // Also set a global backoff so parallel requests don't pile up.
    this.globalBackoffUntil = Math.max(
      this.globalBackoffUntil,
      Date.now() + retryAfterSec * 1000,
    );
  }
}

// ---------------------------------------------------------------------------
// Thread Tracker
// ---------------------------------------------------------------------------

/**
 * Tracks active threads and maps conversation + thread_ts to state.
 * Enables replyToMode enforcement per thread.
 */
class ThreadTracker {
  /** Map of `${conversationId}:${threadTs}` -> whether we have replied. */
  private readonly replied = new Map<string, boolean>();

  private static key(conversationId: string, threadTs: string): string {
    return `${conversationId}:${threadTs}`;
  }

  hasReplied(conversationId: string, threadTs: string): boolean {
    return this.replied.get(ThreadTracker.key(conversationId, threadTs)) === true;
  }

  markReplied(conversationId: string, threadTs: string): void {
    this.replied.set(ThreadTracker.key(conversationId, threadTs), true);
  }

  /**
   * Resolve the effective threadTs for an outbound message based on
   * replyToMode, matching OpenClaw's resolveThreadTsFromContext logic.
   */
  resolveThreadTs(
    explicitThreadTs: string | undefined,
    targetChannel: string,
    context: ThreadingToolContext | undefined,
  ): string | undefined {
    // Agent explicitly provided threadTs -- use it.
    if (explicitThreadTs) {
      return explicitThreadTs;
    }
    if (!context?.currentThreadTs || !context?.currentChannelId) {
      return undefined;
    }
    // Different channel -- don't inject.
    if (normalizeSlackChannelId(targetChannel) !== context.currentChannelId) {
      return undefined;
    }
    const mode = context.replyToMode ?? 'off';
    if (mode === 'all') {
      return context.currentThreadTs;
    }
    if (
      mode === 'first' &&
      context.hasRepliedRef &&
      !context.hasRepliedRef.value
    ) {
      context.hasRepliedRef.value = true;
      return context.currentThreadTs;
    }
    return undefined;
  }

  /** Build a ThreadingToolContext for the current message context. */
  buildToolContext(
    conversationId: string,
    threadTs: string | undefined,
    replyToMode: ReplyToMode,
  ): ThreadingToolContext {
    const hasRepliedRef = threadTs
      ? { value: this.hasReplied(conversationId, threadTs) }
      : undefined;
    return {
      currentChannelId: conversationId,
      currentThreadTs: threadTs,
      replyToMode,
      hasRepliedRef,
    };
  }
}

// ---------------------------------------------------------------------------
// Ack Reaction Manager
// ---------------------------------------------------------------------------

/**
 * Manages ack reactions following OpenClaw's shouldAckReaction gating.
 */
class AckReactionManager {
  private readonly adapter: SlackChannelAdapter;

  constructor(adapter: SlackChannelAdapter) {
    this.adapter = adapter;
  }

  /**
   * Determine whether to add an ack reaction based on scope, chat type,
   * and mention state. Mirrors OpenClaw's shouldAckReaction.
   */
  shouldAck(params: {
    scope: AckReactionScope | undefined;
    chatType: ChatType;
    mentionsSelf: boolean;
  }): boolean {
    const scope = params.scope ?? 'off';
    if (scope === 'off' || scope === 'none') {
      return false;
    }
    if (scope === 'all') {
      return true;
    }
    if (scope === 'direct') {
      return params.chatType === 'direct';
    }
    if (scope === 'group-all') {
      return params.chatType === 'group' || params.chatType === 'channel';
    }
    if (scope === 'group-mentions') {
      if (params.chatType !== 'group' && params.chatType !== 'channel') {
        return false;
      }
      return params.mentionsSelf;
    }
    return false;
  }

  /**
   * Add an ack reaction to a message if the scope permits it.
   * Returns a promise resolving to true if the reaction was added.
   */
  async tryAck(
    conversationId: string,
    messageId: string,
    emoji: string,
    chatType: ChatType,
    mentionsSelf: boolean,
    scope: AckReactionScope | undefined,
  ): Promise<boolean> {
    if (!this.shouldAck({ scope, chatType, mentionsSelf })) {
      return false;
    }
    try {
      await this.adapter.addReaction(conversationId, messageId, emoji);
      return true;
    } catch {
      // Non-fatal: ack reactions are best-effort.
      return false;
    }
  }

  /**
   * Remove the ack reaction after the agent finishes replying.
   * Mirrors OpenClaw's removeAckReactionAfterReply.
   */
  scheduleRemoval(
    conversationId: string,
    messageId: string,
    emoji: string,
    ackPromise: Promise<boolean>,
  ): void {
    void ackPromise.then(async (didAck) => {
      if (!didAck) {
return;
}
      try {
        await this.adapter.removeReaction(conversationId, messageId, emoji);
      } catch {
        // Non-fatal.
      }
    });
  }
}

// ---------------------------------------------------------------------------
// SlackChannelAdapter
// ---------------------------------------------------------------------------

/**
 * Production-grade Slack channel adapter implementing the full feature set
 * requested by the Orchestrator.
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
 *   replyToMode: 'first',
 *   ackReactionScope: 'group-mentions',
 *   slashCommand: { enabled: true, name: 'wundr' },
 * });
 * slack.on('message', (msg) => console.log(msg.content.text));
 * slack.on('slash_command', (cmd) => console.log(cmd.command, cmd.text));
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
    typingIndicators: true,
    readReceipts: false,
    maxMessageLength: SLACK_TEXT_CHUNK_LIMIT,
    maxMediaBytes: 1_073_741_824, // 1 GB
  };

  // -- Internal state ------------------------------------------------------
  private agent: SlackUserAgentLike | null = null;
  private selfUserId: string | null = null;
  private selfTeamId: string | null = null;
  private slackConfig: SlackChannelConfig | null = null;
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;
  private lastErrorAt: Date | null = null;

  // -- Sub-systems ---------------------------------------------------------
  private rateLimiter: SlackRateLimiter | null = null;
  private readonly threadTracker = new ThreadTracker();
  private readonly ackManager = new AckReactionManager(this);

  // -- Reconnection state --------------------------------------------------
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  // -- User cache for mention resolution -----------------------------------
  private readonly userDisplayNameCache = new Map<string, string>();

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // =======================================================================
  // Lifecycle
  // =======================================================================

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

    this.rateLimiter = new SlackRateLimiter(
      slackConfig.maxRetries ?? 3,
      this.logger,
    );
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;

    try {
      // eslint-disable-next-line import/no-unresolved
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

      // Extract self identity.
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
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();
      this.logger.error(`Slack adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.agent) {
      return;
    }

    this.intentionalDisconnect = true;
    this.clearReconnectTimer();

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
        lastErrorAt: this.lastErrorAt ?? undefined,
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
        lastErrorAt: this.lastErrorAt ?? undefined,
        details: {
          userClientConnected: health.userClientConnected,
          botClientConnected: health.botClientConnected,
          userId: health.userId,
          reconnectAttempts: this.reconnectAttempts,
        },
      };
    } catch (err) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: err instanceof Error ? err.message : String(err),
        lastErrorAt: new Date(),
      };
    }
  }

  // =======================================================================
  // Messaging
  // =======================================================================

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    const threadTs = this.threadTracker.resolveThreadTs(
      message.threadId,
      message.to,
      this.buildCurrentThreadContext(message.to, message.threadId),
    );

    const chunks = this.chunkText(message.text);
    let lastResult: DeliveryResult = {
      ok: false,
      error: 'No chunks to send',
    };

    for (let i = 0; i < chunks.length; i++) {
      try {
        lastResult = await this.sendTextChunk(
          message.to,
          chunks[i],
          threadTs,
        );
        // Track reply for "first" mode.
        if (lastResult.ok && threadTs) {
          this.threadTracker.markReplied(message.to, threadTs);
        }
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
          threadId: threadTs,
        });
      }
    }

    return lastResult;
  }

  /**
   * Send a message with Block Kit blocks for rich formatting.
   * Falls back to plain text if blocks fail.
   */
  async sendBlockMessage(
    conversationId: string,
    blocks: readonly BlockKitBlock[],
    options?: {
      text?: string;
      threadId?: string;
    },
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const result = await this.withRateLimit('chat.postMessage', () =>
        this.getAgent().sendMessage(conversationId, options?.text ?? '', {
          threadTs: options?.threadId,
          blocks: blocks as BlockKitBlock[],
        }),
      );
      return {
        ok: result.ok,
        messageId: result.ts,
        conversationId: result.channelId,
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
      await this.withRateLimit('chat.update', () =>
        this.getAgent().editMessage(conversationId, messageId, newText),
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
      await this.withRateLimit('chat.delete', () =>
        this.getAgent().deleteMessage(conversationId, messageId),
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to delete message ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // =======================================================================
  // Threading
  // =======================================================================

  async replyToThread(
    conversationId: string,
    threadId: string,
    message: OutboundMessage,
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      const result = await this.withRateLimit('chat.postMessage', () =>
        this.getAgent().replyToThread(
          conversationId,
          threadId,
          message.text,
        ),
      );

      if (result.ok) {
        this.threadTracker.markReplied(conversationId, threadId);
      }

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

  /**
   * Resolve the effective replyToMode for a given chat type.
   * Follows OpenClaw's resolveSlackReplyToMode pattern with per-chatType overrides.
   */
  resolveReplyToMode(chatType?: ChatType): ReplyToMode {
    const config = this.slackConfig;
    if (!config) {
return 'off';
}

    // Per-chat-type override takes precedence.
    if (chatType && config.replyToModeByChatType) {
      const mapped = chatType === 'thread' ? 'channel' : chatType;
      const override = config.replyToModeByChatType[
        mapped as 'direct' | 'group' | 'channel'
      ];
      if (override) {
return override;
}
    }

    return config.replyToMode ?? 'off';
  }

  /**
   * Build a ThreadingToolContext for the current conversation state.
   * Follows OpenClaw's buildSlackThreadingToolContext pattern.
   */
  getThreadContext(
    conversationId: string,
    threadTs?: string,
    chatType?: ChatType,
  ): ThreadingToolContext {
    const replyToMode = this.resolveReplyToMode(chatType);
    return this.threadTracker.buildToolContext(
      conversationId,
      threadTs,
      replyToMode,
    );
  }

  // =======================================================================
  // Reactions
  // =======================================================================

  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    const sanitized = emoji.replace(/:/g, '');
    await this.withRateLimit('reactions.add', () =>
      this.getAgent().addReaction(conversationId, messageId, sanitized),
    );
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.requireConnected();
    const sanitized = emoji.replace(/:/g, '');
    await this.withRateLimit('reactions.remove', () =>
      this.getAgent().removeReaction(conversationId, messageId, sanitized),
    );
  }

  /**
   * Acknowledge receipt of a message with a reaction.
   * Returns a promise resolving to true if the reaction was added.
   *
   * If ackReactionRemoveAfterReply is enabled, the reaction is automatically
   * removed when the returned promise is used with scheduleAckRemoval.
   */
  async ackReaction(
    conversationId: string,
    messageId: string,
    chatType: ChatType,
    mentionsSelf: boolean,
  ): Promise<boolean> {
    const emoji = this.slackConfig?.ackReactionEmoji ?? DEFAULT_ACK_EMOJI;
    const scope = this.slackConfig?.ackReactionScope;
    return this.ackManager.tryAck(
      conversationId,
      messageId,
      emoji,
      chatType,
      mentionsSelf,
      scope,
    );
  }

  /**
   * Schedule removal of the ack reaction after the agent finishes replying.
   */
  scheduleAckRemoval(
    conversationId: string,
    messageId: string,
    ackPromise: Promise<boolean>,
  ): void {
    if (!this.slackConfig?.ackReactionRemoveAfterReply) {
return;
}
    const emoji = this.slackConfig?.ackReactionEmoji ?? DEFAULT_ACK_EMOJI;
    this.ackManager.scheduleRemoval(
      conversationId,
      messageId,
      emoji,
      ackPromise,
    );
  }

  // =======================================================================
  // Typing Indicators
  // =======================================================================

  /**
   * Start a typing indicator that refreshes until stopped.
   * Slack does not have a persistent typing API, so we re-fire the
   * typing event at a regular interval to keep the indicator visible.
   */
  sendTypingIndicator(conversationId: string): TypingHandle {
    if (!this.connected || !this.agent) {
      return { stop: () => {} };
    }

    let active = true;
    const agent = this.getAgent();

    const sendTyping = () => {
      if (!active || !this.connected) {
return;
}
      agent.indicateTyping?.(conversationId)?.catch(() => {
        // Non-fatal: typing indicators are best-effort.
      });
    };

    // Fire immediately, then refresh.
    sendTyping();
    const interval = setInterval(sendTyping, TYPING_INDICATOR_INTERVAL_MS);

    return {
      stop: () => {
        active = false;
        clearInterval(interval);
      },
    };
  }

  // =======================================================================
  // Media / File Upload
  // =======================================================================

  async sendMedia(
    conversationId: string,
    attachment: OutboundAttachment,
    options?: { text?: string; threadId?: string },
  ): Promise<DeliveryResult> {
    this.requireConnected();

    try {
      if (attachment.source === 'buffer' && attachment.buffer) {
        const result = await this.withRateLimit('files.upload', () =>
          this.getAgent().uploadFileFromBuffer(
            attachment.buffer!,
            attachment.filename,
            [conversationId],
            {
              title: attachment.filename,
              threadTs: options?.threadId,
              initialComment: options?.text,
            },
          ),
        );
        return {
          ok: result.ok,
          messageId: result.file.id,
          conversationId,
          timestamp: new Date(),
        };
      }

      if (attachment.source === 'path' && attachment.location) {
        const result = await this.withRateLimit('files.upload', () =>
          this.getAgent().uploadFile(
            attachment.location!,
            [conversationId],
            {
              title: attachment.filename,
              threadTs: options?.threadId,
              initialComment: options?.text,
            },
          ),
        );
        return {
          ok: result.ok,
          messageId: result.file.id,
          conversationId,
          timestamp: new Date(),
        };
      }

      if (attachment.source === 'url' && attachment.location) {
        // Download from URL, then upload to Slack.
        const buffer = await this.downloadExternalUrl(attachment.location);
        const result = await this.withRateLimit('files.upload', () =>
          this.getAgent().uploadFileFromBuffer(
            buffer,
            attachment.filename,
            [conversationId],
            {
              title: attachment.filename,
              threadTs: options?.threadId,
              initialComment: options?.text,
            },
          ),
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
    return this.withRateLimit('files.info', () =>
      this.getAgent().downloadFile(url),
    );
  }

  // =======================================================================
  // Slash Command Handling
  // =======================================================================

  /**
   * Respond to a slash command ephemerally or in-channel.
   * Uses the responseUrl from the command payload for deferred responses.
   */
  async respondToSlashCommand(
    payload: SlashCommandPayload,
    text: string,
    options?: {
      blocks?: readonly BlockKitBlock[];
      ephemeral?: boolean;
    },
  ): Promise<DeliveryResult> {
    if (!payload.responseUrl) {
      // Fall back to sending a regular message.
      return this.sendMessage({
        to: payload.channelId,
        text,
        threadId: payload.threadTs,
      });
    }

    try {
      const response = await fetch(payload.responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          blocks: options?.blocks,
          response_type:
            options?.ephemeral !== false ? 'ephemeral' : 'in_channel',
          replace_original: false,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Slash command response failed: ${response.status} ${response.statusText}`,
        };
      }
      return { ok: true, conversationId: payload.channelId };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // =======================================================================
  // Interactive Components
  // =======================================================================

  /**
   * Respond to an interactive action by updating or replacing the source message.
   */
  async respondToInteraction(
    action: InteractiveAction,
    text: string,
    options?: {
      blocks?: readonly BlockKitBlock[];
      replaceOriginal?: boolean;
      deleteOriginal?: boolean;
    },
  ): Promise<DeliveryResult> {
    if (!action.responseUrl) {
      if (action.channelId) {
        return this.sendMessage({ to: action.channelId, text });
      }
      return { ok: false, error: 'No response URL or channel ID available.' };
    }

    try {
      const response = await fetch(action.responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          blocks: options?.blocks,
          replace_original: options?.replaceOriginal ?? false,
          delete_original: options?.deleteOriginal ?? false,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Interaction response failed: ${response.status} ${response.statusText}`,
        };
      }
      return { ok: true, conversationId: action.channelId };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Open a modal dialog. Requires a trigger_id from an interactive action
   * or slash command.
   */
  async openModal(
    triggerId: string,
    view: Record<string, unknown>,
  ): Promise<{ ok: boolean; viewId?: string; error?: string }> {
    this.requireConnected();

    try {
      const result = await this.withRateLimit('views.open', () =>
        this.getAgent().openModal(triggerId, view),
      );
      return { ok: true, viewId: result?.view?.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // =======================================================================
  // User Mention Resolution
  // =======================================================================

  /**
   * Resolve a Slack user ID to a display name.
   * Results are cached in memory for the adapter's lifetime.
   */
  async resolveUserDisplayName(userId: string): Promise<string> {
    const cached = this.userDisplayNameCache.get(userId);
    if (cached) {
return cached;
}

    if (!this.agent) {
return userId;
}

    try {
      const info = await this.withRateLimit('users.info', () =>
        this.getAgent().getUserInfo(userId),
      );
      const name =
        info?.real_name || info?.display_name || info?.name || userId;
      this.userDisplayNameCache.set(userId, name);
      return name;
    } catch {
      return userId;
    }
  }

  /**
   * Replace <@UXXXXX> mentions in text with display names.
   */
  async resolveUserMentions(text: string): Promise<string> {
    const mentionPattern = /<@([A-Z0-9_]+)>/gi;
    const matches = [...text.matchAll(mentionPattern)];
    if (matches.length === 0) {
return text;
}

    let result = text;
    for (const match of matches) {
      const userId = match[1];
      const displayName = await this.resolveUserDisplayName(userId);
      result = result.replace(match[0], `@${displayName}`);
    }
    return result;
  }

  // =======================================================================
  // Message Formatting Helpers
  // =======================================================================

  /**
   * Build a simple Block Kit section block with mrkdwn text.
   */
  static sectionBlock(text: string, blockId?: string): BlockKitBlock {
    return {
      type: 'section',
      ...(blockId ? { block_id: blockId } : {}),
      text: { type: 'mrkdwn', text } as BlockKitText,
    };
  }

  /**
   * Build a Block Kit actions block with button elements.
   */
  static actionsBlock(
    buttons: Array<{
      text: string;
      actionId: string;
      value?: string;
      style?: 'primary' | 'danger';
    }>,
    blockId?: string,
  ): BlockKitBlock {
    return {
      type: 'actions',
      ...(blockId ? { block_id: blockId } : {}),
      elements: buttons.map((btn) => ({
        type: 'button',
        action_id: btn.actionId,
        text: { type: 'plain_text', text: btn.text } as BlockKitText,
        ...(btn.value ? { value: btn.value } : {}),
        ...(btn.style ? { style: btn.style } : {}),
      })),
    };
  }

  /**
   * Build a Block Kit divider block.
   */
  static dividerBlock(): BlockKitBlock {
    return { type: 'divider' };
  }

  /**
   * Build a Block Kit context block with mrkdwn elements.
   */
  static contextBlock(
    elements: string[],
    blockId?: string,
  ): BlockKitBlock {
    // Context blocks use BlockKitText objects, which conform to
    // BlockKitElement's index signature since both have `type` + `text`.
    const textElements = elements.map((text) => ({
      type: 'mrkdwn' as const,
      text,
    }));
    return {
      type: 'context',
      ...(blockId ? { block_id: blockId } : {}),
      elements: textElements as unknown as BlockKitElement[],
    };
  }

  // =======================================================================
  // Security / Pairing
  // =======================================================================

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

  // =======================================================================
  // Event Subscriptions
  // =======================================================================

  /**
   * Get the list of Slack event subscriptions this adapter is configured for.
   */
  getEventSubscriptions(): readonly string[] {
    return this.slackConfig?.eventSubscriptions ?? DEFAULT_EVENT_SUBSCRIPTIONS;
  }

  // =======================================================================
  // Internal: Event Setup
  // =======================================================================

  private setupEventHandlers(): void {
    if (!this.agent) {
return;
}

    // -- Messages ----------------------------------------------------------
    this.agent.onMessage(async (event: SlackEventLike) => {
      // Skip own messages.
      if (event.user === this.selfUserId) {
return;
}
      // Skip message subtypes that are edits/deletes (handled separately).
      const subtype = (event as { subtype?: string }).subtype;
      if (subtype === 'message_changed') {
        this.handleMessageEdited(event);
        return;
      }
      if (subtype === 'message_deleted') {
        this.handleMessageDeleted(event);
        return;
      }

      const message = this.normalizeInboundMessage(event);
      if (message) {
        this.lastMessageAt = new Date();
        this.emit('message', message);
      }
    });

    // -- Reactions ---------------------------------------------------------
    this.agent.onReactionAdded((event: SlackEventLike) => {
      if (!event.user || !event.channel || !event.ts) {
return;
}
      this.emit('reaction_added', {
        channelId: this.id,
        conversationId: event.channel,
        messageId: event.ts,
        userId: event.user,
        emoji: (event as { reaction?: string }).reaction ?? '',
      });
    });

    this.agent.onReactionRemoved((event: SlackEventLike) => {
      if (!event.user || !event.channel || !event.ts) {
return;
}
      this.emit('reaction_removed', {
        channelId: this.id,
        conversationId: event.channel,
        messageId: event.ts,
        userId: event.user,
        emoji: (event as { reaction?: string }).reaction ?? '',
      });
    });

    // -- Slash Commands ----------------------------------------------------
    if (this.agent.onSlashCommand) {
      this.agent.onSlashCommand((event: SlackSlashCommandEvent) => {
        const slashConfig = this.slackConfig?.slashCommand;
        if (!slashConfig?.enabled) {
return;
}

        const expectedName = slashConfig.name ?? 'wundr';
        const commandName = (event.command ?? '').replace(/^\//, '');
        if (commandName !== expectedName) {
return;
}

        const payload: SlashCommandPayload = {
          command: event.command,
          text: event.text ?? '',
          userId: event.user_id,
          channelId: event.channel_id,
          threadTs: undefined,
          triggerId: event.trigger_id,
          responseUrl: event.response_url,
          teamId: event.team_id,
        };
        this.emit('slash_command', payload);
      });
    }

    // -- Interactive Components --------------------------------------------
    if (this.agent.onInteractiveAction) {
      this.agent.onInteractiveAction((event: SlackInteractiveEvent) => {
        const actions = event.actions ?? [];
        for (const action of actions) {
          const payload: InteractiveAction = {
            type: event.type ?? 'block_actions',
            actionId: action.action_id ?? '',
            blockId: action.block_id,
            value: action.value ?? action.selected_option?.value,
            userId: event.user?.id ?? '',
            channelId: event.channel?.id,
            messageTs: event.message?.ts,
            triggerId: event.trigger_id,
            responseUrl: event.response_url,
            raw: event,
          };
          this.emit('interactive_action', payload);
        }
      });
    }

    // -- Member Events -----------------------------------------------------
    if (this.agent.onMemberJoined) {
      this.agent.onMemberJoined((event: SlackEventLike) => {
        if (!event.user || !event.channel) {
return;
}
        this.emit('member_joined', {
          channelId: this.id,
          conversationId: event.channel,
          userId: event.user,
        });
      });
    }

    if (this.agent.onMemberLeft) {
      this.agent.onMemberLeft((event: SlackEventLike) => {
        if (!event.user || !event.channel) {
return;
}
        this.emit('member_left', {
          channelId: this.id,
          conversationId: event.channel,
          userId: event.user,
        });
      });
    }

    // -- Disconnect / Error Recovery ---------------------------------------
    if (this.agent.onDisconnect) {
      this.agent.onDisconnect((reason: string) => {
        if (this.intentionalDisconnect) {
return;
}

        this.connected = false;
        this.lastError = reason;
        this.lastErrorAt = new Date();
        this.logger.warn(`Slack adapter disconnected unexpectedly: ${reason}`);

        this.emit('disconnected', {
          channelId: this.id,
          accountId: this.selfTeamId ?? undefined,
          reason,
        });

        this.scheduleReconnect();
      });
    }

    if (this.agent.onError) {
      this.agent.onError((err: Error) => {
        this.lastError = err.message;
        this.lastErrorAt = new Date();
        this.logger.error(`Slack agent error: ${err.message}`);

        this.emit('error', {
          channelId: this.id,
          error: err,
          recoverable: true,
        });
      });
    }
  }

  // =======================================================================
  // Internal: Message Edit / Delete Events
  // =======================================================================

  private handleMessageEdited(event: SlackEventLike): void {
    const messageEvent = (event as { message?: SlackEventLike }).message;
    if (!messageEvent || !event.channel) {
return;
}

    const content = this.normalizeSlackContent(messageEvent);
    this.emit('message_edited', {
      channelId: this.id,
      conversationId: event.channel,
      messageId: messageEvent.ts ?? '',
      newContent: content,
      timestamp: new Date(),
    });
  }

  private handleMessageDeleted(event: SlackEventLike): void {
    const deletedTs = (event as { deleted_ts?: string }).deleted_ts;
    if (!deletedTs || !event.channel) {
return;
}

    this.emit('message_deleted', {
      channelId: this.id,
      conversationId: event.channel,
      messageId: deletedTs,
      timestamp: new Date(),
    });
  }

  // =======================================================================
  // Internal: Reconnection
  // =======================================================================

  private scheduleReconnect(): void {
    const maxAttempts = this.slackConfig?.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.logger.error(
        `Slack adapter: max reconnect attempts (${maxAttempts}) reached. Giving up.`,
      );
      this.emit('error', {
        channelId: this.id,
        error: new Error(
          `Max reconnect attempts (${maxAttempts}) exceeded.`,
        ),
        recoverable: false,
      });
      return;
    }

    const baseDelay = this.slackConfig?.reconnectBaseDelayMs ?? 1000;
    const delay = calculateBackoff(
      this.reconnectAttempts,
      baseDelay,
      60_000,
    );
    this.reconnectAttempts++;

    this.logger.info(
      `Slack adapter: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts}).`,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.intentionalDisconnect) {
return;
}
        if (this.agent) {
          await this.agent.start();
          const health = await this.agent.healthCheck();
          this.selfUserId = health.userId ?? this.selfUserId;
          this.selfTeamId = health.teamId ?? this.selfTeamId;
          this.connected = true;
          this.reconnectAttempts = 0;
          this.logger.info('Slack adapter: reconnected successfully.');
          this.emit('connected', {
            channelId: this.id,
            accountId: this.selfTeamId ?? undefined,
          });
        }
      } catch (err) {
        this.logger.error(
          `Slack adapter: reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // =======================================================================
  // Internal: Message Normalization
  // =======================================================================

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
      this.selfUserId !== null && mentions.includes(this.selfUserId);

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
    const matches = text.matchAll(/<@([A-Z0-9_]+)>/gi);
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

  /**
   * Strip Slack mrkdwn formatting to produce clean plaintext.
   * Matches OpenClaw's mention-stripping pattern: `<@[^>]+>`.
   */
  private stripSlackFormatting(text: string): string {
    return text
      .replace(/<@[A-Z0-9_]+>/gi, '') // Remove user mentions
      .replace(/<#[A-Z0-9]+\|([^>]+)>/gi, '#$1') // #channel references
      .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/gi, '$2') // URL with label
      .replace(/<(https?:\/\/[^>]+)>/gi, '$1') // Bare URL
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // =======================================================================
  // Internal: Helpers
  // =======================================================================

  private requireConnected(): void {
    if (!this.connected || !this.agent) {
      throw new Error('Slack adapter is not connected. Call connect() first.');
    }
  }

  private getAgent(): SlackUserAgentLike {
    if (!this.agent) {
      throw new Error('Slack adapter is not connected. Call connect() first.');
    }
    return this.agent;
  }

  /**
   * Execute a Slack API call through the rate limiter.
   */
  private async withRateLimit<T>(
    method: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!this.rateLimiter) {
      return fn();
    }
    return this.rateLimiter.execute(method, fn);
  }

  /**
   * Send a single text chunk to a conversation via the rate limiter.
   */
  private async sendTextChunk(
    to: string,
    text: string,
    threadTs?: string,
  ): Promise<DeliveryResult> {
    try {
      const result = await this.withRateLimit('chat.postMessage', () =>
        this.getAgent().sendMessage(to, text, { threadTs }),
      );
      return {
        ok: result.ok,
        messageId: result.ts,
        conversationId: result.channelId,
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
   * Build a ThreadingToolContext for the current outbound message.
   */
  private buildCurrentThreadContext(
    conversationId: string,
    threadTs?: string,
  ): ThreadingToolContext | undefined {
    if (!this.slackConfig) {
return undefined;
}
    const replyToMode = this.resolveReplyToMode();
    if (replyToMode === 'off') {
return undefined;
}
    return this.threadTracker.buildToolContext(
      conversationId,
      threadTs,
      replyToMode,
    );
  }

  /**
   * Download a file from an external URL (for url-sourced attachments).
   */
  private async downloadExternalUrl(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download from ${url}: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Override the chunk text to use Slack-specific limits from config.
   */
  protected override chunkText(text: string): string[] {
    const limit = this.slackConfig?.textChunkLimit ?? SLACK_TEXT_CHUNK_LIMIT;
    if (limit <= 0 || text.length <= limit) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= limit) {
        chunks.push(remaining);
        break;
      }

      // Try to break at a code block boundary to avoid splitting code.
      let breakAt = remaining.lastIndexOf('\n```', limit);
      if (breakAt > 0 && breakAt >= limit * 0.3) {
        breakAt += 1; // Include the newline.
      } else {
        // Try to break at a newline boundary within the limit.
        breakAt = remaining.lastIndexOf('\n', limit);
      }
      if (breakAt <= 0 || breakAt < limit * 0.5) {
        breakAt = remaining.lastIndexOf(' ', limit);
      }
      if (breakAt <= 0 || breakAt < limit * 0.5) {
        breakAt = limit;
      }

      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }

    return chunks;
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
    options?: { threadTs?: string; blocks?: BlockKitBlock[] },
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
    options?: {
      title?: string;
      threadTs?: string;
      initialComment?: string;
    },
  ): Promise<{
    ok: boolean;
    file: { id: string; name: string; permalink: string };
  }>;
  uploadFileFromBuffer(
    buffer: Buffer,
    filename: string,
    channels?: string[],
    options?: {
      title?: string;
      threadTs?: string;
      initialComment?: string;
    },
  ): Promise<{
    ok: boolean;
    file: { id: string; name: string; permalink: string };
  }>;
  downloadFile(fileUrl: string): Promise<Buffer>;
  getUserInfo(userId: string): Promise<{
    real_name?: string;
    display_name?: string;
    name?: string;
  }>;
  openModal(
    triggerId: string,
    view: Record<string, unknown>,
  ): Promise<{ view?: { id: string } }>;
  indicateTyping?(channel: string): Promise<void>;
  onMessage(
    handler: (event: SlackEventLike) => void | Promise<void>,
  ): void;
  onReactionAdded(
    handler: (event: SlackEventLike) => void | Promise<void>,
  ): void;
  onReactionRemoved(
    handler: (event: SlackEventLike) => void | Promise<void>,
  ): void;
  onSlashCommand?(
    handler: (event: SlackSlashCommandEvent) => void | Promise<void>,
  ): void;
  onInteractiveAction?(
    handler: (event: SlackInteractiveEvent) => void | Promise<void>,
  ): void;
  onMemberJoined?(
    handler: (event: SlackEventLike) => void | Promise<void>,
  ): void;
  onMemberLeft?(
    handler: (event: SlackEventLike) => void | Promise<void>,
  ): void;
  onDisconnect?(handler: (reason: string) => void): void;
  onError?(handler: (err: Error) => void): void;
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

interface SlackSlashCommandEvent {
  command: string;
  text?: string;
  user_id: string;
  channel_id: string;
  trigger_id?: string;
  response_url?: string;
  team_id?: string;
}

interface SlackInteractiveEvent {
  type?: string;
  trigger_id?: string;
  response_url?: string;
  user?: { id: string };
  channel?: { id: string };
  message?: { ts: string };
  actions?: Array<{
    action_id?: string;
    block_id?: string;
    value?: string;
    selected_option?: { value: string };
  }>;
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

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

/**
 * Extract Retry-After seconds from a Slack API error.
 * Slack returns `error: 'rate_limited'` with a `retryAfter` field in seconds.
 */
function extractRetryAfterSec(err: unknown): number {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // @slack/web-api CodedError shape.
    if (obj.code === 'slack_webapi_rate_limited_error') {
      const retryAfter = obj.retryAfter;
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        return retryAfter;
      }
    }
    // Generic Retry-After from HTTP headers.
    const headers = obj.headers as Record<string, string> | undefined;
    if (headers?.['retry-after']) {
      const parsed = parseInt(headers['retry-after'], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    // Fallback for rate_limited error string.
    if (
      typeof obj.error === 'string' &&
      obj.error === 'rate_limited'
    ) {
      return 5; // Default back-off.
    }
  }
  return 0;
}

/**
 * Calculate exponential backoff delay with jitter.
 */
function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  // Add 0-25% jitter to avoid thundering herd.
  const jitter = capped * Math.random() * 0.25;
  return Math.floor(capped + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a Slack channel identifier by stripping common prefixes.
 * Matches OpenClaw's resolveSlackChannelId / parseSlackTarget behavior.
 */
function normalizeSlackChannelId(raw: string): string {
  let value = raw.trim();
  // Strip prefixes like "channel:", "slack:", "#".
  value = value.replace(/^(channel:|slack:|#)/i, '');
  // Strip mention brackets: <#C123|general> -> C123.
  const bracketMatch = value.match(/^<#([A-Z0-9]+)(?:\|[^>]*)?>$/i);
  if (bracketMatch) {
    return bracketMatch[1];
  }
  return value;
}
