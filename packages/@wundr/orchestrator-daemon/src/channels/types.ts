/**
 * Channel Abstraction Layer - Core Types
 *
 * Defines the ChannelPlugin interface and unified message format that all channel
 * adapters must implement. Inspired by OpenClaw's decomposed adapter pattern but
 * adapted for Wundr's Orchestrator model where agents operate as full users.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Channel Identity
// ---------------------------------------------------------------------------

/**
 * Known built-in channel identifiers. The string union is open-ended to allow
 * external/custom channel plugins.
 */
export type BuiltInChannelId =
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'terminal'
  | 'websocket';

export type ChannelId = BuiltInChannelId | (string & {});

/**
 * Display and documentation metadata for a channel.
 */
export interface ChannelMeta {
  /** Unique channel identifier. */
  readonly id: ChannelId;
  /** Human-readable label (e.g., "Slack"). */
  readonly label: string;
  /** Short description shown in channel selection UIs. */
  readonly blurb: string;
  /** Alternative identifiers that resolve to this channel. */
  readonly aliases?: readonly string[];
  /** Ordering hint for UI display (lower = higher priority). */
  readonly order?: number;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/** Conversation type within a channel. */
export type ChatType = 'direct' | 'group' | 'channel' | 'thread';

/**
 * Declares what features a channel adapter supports. The orchestrator uses this
 * to gate behavior -- e.g., only send typing indicators to channels that support
 * them, only attempt reactions where the platform allows it.
 */
export interface ChannelCapabilities {
  /** Supported conversation types. */
  readonly chatTypes: readonly ChatType[];
  /** Whether the platform supports emoji reactions. */
  readonly reactions: boolean;
  /** Whether the platform supports native threads. */
  readonly threads: boolean;
  /** Whether the platform supports file/media uploads. */
  readonly media: boolean;
  /** Whether the platform supports message editing after send. */
  readonly edit: boolean;
  /** Whether the platform supports message deletion. */
  readonly delete: boolean;
  /** Whether the platform supports typing indicators. */
  readonly typingIndicators: boolean;
  /** Whether the platform supports read receipts / acknowledgments. */
  readonly readReceipts: boolean;
  /** Maximum text message length in characters (0 = unlimited). */
  readonly maxMessageLength: number;
  /** Maximum media upload size in bytes (0 = unlimited, -1 = unsupported). */
  readonly maxMediaBytes: number;
}

// ---------------------------------------------------------------------------
// Normalized Message Format
// ---------------------------------------------------------------------------

/**
 * Sender identity normalized across all channels.
 */
export interface NormalizedSender {
  /** Platform-native user ID. */
  readonly id: string;
  /** Display name (may be username, real name, or handle depending on platform). */
  readonly displayName: string;
  /** Platform username/handle if available (e.g., Slack @handle, Discord username). */
  readonly username?: string;
  /** Whether this sender is the Orchestrator's own account. */
  readonly isSelf: boolean;
  /** Whether this sender is a bot (non-human, non-Orchestrator). */
  readonly isBot: boolean;
  /** Avatar URL if available. */
  readonly avatarUrl?: string;
}

/**
 * Media attachment normalized across all channels.
 */
export interface NormalizedAttachment {
  /** Attachment type. */
  readonly type: 'image' | 'video' | 'audio' | 'file';
  /** Original filename. */
  readonly filename: string;
  /** MIME type if known. */
  readonly mimeType?: string;
  /** File size in bytes if known. */
  readonly sizeBytes?: number;
  /** URL to download the attachment (platform-specific, may require auth). */
  readonly url: string;
  /** Thumbnail URL if available. */
  readonly thumbnailUrl?: string;
}

/**
 * Message content normalized across all channels.
 */
export interface MessageContent {
  /** Plain text content with platform markup stripped. */
  readonly text: string;
  /** Original platform-native formatted text (Slack mrkdwn, Discord markdown, etc.). */
  readonly rawText?: string;
  /** Media attachments. */
  readonly attachments: readonly NormalizedAttachment[];
  /** User IDs mentioned in this message. */
  readonly mentions: readonly string[];
  /** Whether the Orchestrator was explicitly mentioned. */
  readonly mentionsSelf: boolean;
}

/**
 * Unified message format produced by all channel adapters on inbound.
 * This is the "lingua franca" that flows through routing, session management,
 * and agent prompt construction.
 */
export interface NormalizedMessage {
  /** Globally unique message ID: `{channelId}:{platformMessageId}`. */
  readonly id: string;
  /** Which channel this message arrived on. */
  readonly channelId: ChannelId;
  /** Platform-native message ID (e.g., Slack ts, Discord snowflake). */
  readonly platformMessageId: string;
  /** Platform-native conversation/channel ID. */
  readonly conversationId: string;
  /** Thread ID if this message is part of a thread. */
  readonly threadId?: string;
  /** Sender information. */
  readonly sender: NormalizedSender;
  /** Message content. */
  readonly content: MessageContent;
  /** When the message was sent. */
  readonly timestamp: Date;
  /** Conversation type. */
  readonly chatType: ChatType;
  /** Platform message ID this message is replying to. */
  readonly replyTo?: string;
  /** Guild/server/workspace ID if applicable (Discord guild, Slack team, etc.). */
  readonly guildId?: string;
  /** Original platform payload for adapter-specific processing. */
  readonly raw: unknown;
}

// ---------------------------------------------------------------------------
// Outbound Message
// ---------------------------------------------------------------------------

/**
 * Message the Orchestrator wants to send through a channel.
 */
export interface OutboundMessage {
  /** Target conversation ID (platform-native). */
  readonly to: string;
  /** Text content to send. */
  readonly text: string;
  /** Thread to reply in (platform-native thread ID). */
  readonly threadId?: string;
  /** Platform message ID to reply to (for inline replies). */
  readonly replyTo?: string;
  /** Media to attach. */
  readonly attachments?: readonly OutboundAttachment[];
  /** Account ID to send from (for multi-account channels). */
  readonly accountId?: string;
}

/**
 * Media attachment to include in an outbound message.
 */
export interface OutboundAttachment {
  /** How the attachment is provided. */
  readonly source: 'url' | 'buffer' | 'path';
  /** URL, file path, or undefined if buffer. */
  readonly location?: string;
  /** Raw buffer content. */
  readonly buffer?: Buffer;
  /** Filename for the attachment. */
  readonly filename: string;
  /** MIME type. */
  readonly mimeType?: string;
}

// ---------------------------------------------------------------------------
// Media Pipeline Types
// ---------------------------------------------------------------------------

/**
 * Supported media categories for classification and policy enforcement.
 */
export type MediaCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'executable' | 'unknown';

/**
 * Result of scanning a file for malware / policy violations.
 */
export interface ScanResult {
  /** Whether the file passed the scan. */
  readonly clean: boolean;
  /** Scanner that produced this result. */
  readonly scanner: string;
  /** Human-readable verdict. */
  readonly verdict: string;
  /** Threat name if malicious. */
  readonly threatName?: string;
}

/**
 * Progress event emitted during upload or download operations.
 */
export interface MediaProgressEvent {
  /** Operation type. */
  readonly operation: 'upload' | 'download' | 'resize' | 'scan';
  /** Bytes transferred so far. */
  readonly bytesTransferred: number;
  /** Total bytes (0 if unknown). */
  readonly totalBytes: number;
  /** Progress as a fraction 0..1 (NaN if total is unknown). */
  readonly fraction: number;
  /** Target channel. */
  readonly channelId: ChannelId;
  /** Filename being processed. */
  readonly filename: string;
}

/**
 * Callback for upload/download progress tracking.
 */
export type MediaProgressCallback = (event: MediaProgressEvent) => void;

/**
 * Channel-specific format adaptation target.
 */
export type ChannelFormatTarget = 'slack' | 'discord' | 'telegram' | 'plain' | (string & {});

/**
 * Result of converting markdown content to a channel-native format.
 */
export interface ChannelFormattedContent {
  /** The formatted text in the target channel's native markup. */
  readonly text: string;
  /** Whether the content was truncated. */
  readonly truncated: boolean;
  /** Original length before conversion. */
  readonly originalLength: number;
  /** Overflow chunks if the content was split. */
  readonly chunks: readonly string[];
}

/**
 * Options for image resize operations.
 */
export interface ImageResizeOptions {
  /** Maximum width in pixels. */
  readonly maxWidth?: number;
  /** Maximum height in pixels. */
  readonly maxHeight?: number;
  /** Maximum file size in bytes after resize. */
  readonly maxBytes?: number;
  /** Output format (defaults to same as input). */
  readonly format?: 'jpeg' | 'png' | 'webp';
  /** JPEG/WebP quality 1-100. */
  readonly quality?: number;
}

/**
 * Interface for pluggable malware/virus scanning.
 */
export interface MediaScannerProvider {
  /** Unique name for this scanner. */
  readonly name: string;
  /** Scan a buffer and return the result. */
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

/**
 * Interface for pluggable image resize/optimization.
 */
export interface ImageResizerProvider {
  /**
   * Resize an image buffer. Returns the resized buffer and the new MIME type.
   * Return null if the image does not need resizing.
   */
  resize(
    buffer: Buffer,
    mimeType: string,
    options: ImageResizeOptions,
  ): Promise<{ buffer: Buffer; mimeType: string } | null>;
}

/**
 * Cache entry for a previously uploaded media file.
 */
export interface MediaCacheEntry {
  /** Cache key (content hash). */
  readonly key: string;
  /** Channel the file was uploaded to. */
  readonly channelId: ChannelId;
  /** Platform-native file ID or URL. */
  readonly platformFileId: string;
  /** When this entry was cached. */
  readonly cachedAt: Date;
  /** When this entry expires. */
  readonly expiresAt: Date;
  /** Original filename. */
  readonly filename: string;
  /** File size in bytes. */
  readonly sizeBytes: number;
}

/**
 * Interface for pluggable media cache backends.
 */
export interface MediaCacheProvider {
  /** Look up a cached upload by content hash + channel. */
  get(key: string, channelId: ChannelId): Promise<MediaCacheEntry | null>;
  /** Store a cache entry. */
  set(entry: MediaCacheEntry): Promise<void>;
  /** Invalidate a cache entry. */
  delete(key: string, channelId: ChannelId): Promise<void>;
  /** Clear all entries for a channel. */
  clearChannel(channelId: ChannelId): Promise<void>;
}

// ---------------------------------------------------------------------------
// Delivery Result
// ---------------------------------------------------------------------------

/**
 * Result of sending a message through a channel adapter.
 */
export interface DeliveryResult {
  /** Whether the send succeeded. */
  readonly ok: boolean;
  /** Platform-native message ID of the sent message. */
  readonly messageId?: string;
  /** Platform-native conversation ID. */
  readonly conversationId?: string;
  /** Timestamp of the sent message. */
  readonly timestamp?: Date;
  /** Error details if ok is false. */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Typing & Acknowledgment
// ---------------------------------------------------------------------------

/**
 * Typing indicator controller returned by sendTypingIndicator.
 * Call stop() to clear the indicator.
 */
export interface TypingHandle {
  /** Stop the typing indicator. */
  stop(): void;
}

/**
 * Ack reaction scope -- controls when the Orchestrator reacts to acknowledge
 * receipt of a message. Mirrors OpenClaw's AckReactionScope.
 */
export type AckReactionScope =
  | 'all'
  | 'direct'
  | 'group-all'
  | 'group-mentions'
  | 'off'
  | 'none';

// ---------------------------------------------------------------------------
// Threading
// ---------------------------------------------------------------------------

/**
 * Reply-to mode for thread management, matching OpenClaw's threading model.
 *
 * - "off": never auto-thread replies
 * - "first": thread only the first reply, then stop
 * - "all": always thread replies into the source thread
 */
export type ReplyToMode = 'off' | 'first' | 'all';

/**
 * Thread context passed to tool invocations so they can thread-aware send.
 * Modeled after OpenClaw's ChannelThreadingToolContext.
 */
export interface ThreadingToolContext {
  /** Current channel ID for auto-threading. */
  readonly currentChannelId?: string;
  /** Current thread timestamp for auto-threading. */
  readonly currentThreadTs?: string;
  /** Reply-to mode for auto-threading. */
  readonly replyToMode?: ReplyToMode;
  /** Mutable ref to track if a reply was sent (for "first" mode). */
  readonly hasRepliedRef?: { value: boolean };
}

// ---------------------------------------------------------------------------
// Slash Commands
// ---------------------------------------------------------------------------

/**
 * Parsed slash command from a platform.
 */
export interface SlashCommandPayload {
  /** The command name (e.g., "/wundr"). */
  readonly command: string;
  /** The text after the command. */
  readonly text: string;
  /** User ID who invoked the command. */
  readonly userId: string;
  /** Channel ID where the command was invoked. */
  readonly channelId: string;
  /** Thread timestamp if invoked in a thread. */
  readonly threadTs?: string;
  /** Trigger ID for opening modals. */
  readonly triggerId?: string;
  /** Response URL for deferred responses. */
  readonly responseUrl?: string;
  /** Team/workspace ID. */
  readonly teamId?: string;
}

// ---------------------------------------------------------------------------
// Interactive Components
// ---------------------------------------------------------------------------

/**
 * Block Kit element action payload from Slack interactive components.
 */
export interface InteractiveAction {
  /** The type of interaction (block_actions, view_submission, etc.). */
  readonly type: string;
  /** Action ID from the block element. */
  readonly actionId: string;
  /** Block ID containing the action. */
  readonly blockId?: string;
  /** The selected value or text. */
  readonly value?: string;
  /** User who triggered the action. */
  readonly userId: string;
  /** Channel where the action occurred. */
  readonly channelId?: string;
  /** Message timestamp if the action is on a message. */
  readonly messageTs?: string;
  /** Trigger ID for opening modals. */
  readonly triggerId?: string;
  /** Response URL for updating the source message. */
  readonly responseUrl?: string;
  /** Raw platform payload. */
  readonly raw: unknown;
}

// ---------------------------------------------------------------------------
// Block Kit Message Formatting
// ---------------------------------------------------------------------------

/**
 * Slack Block Kit block element.
 * https://api.slack.com/reference/block-kit/blocks
 */
export interface BlockKitBlock {
  readonly type: string;
  readonly block_id?: string;
  readonly text?: BlockKitText;
  readonly elements?: readonly BlockKitElement[];
  readonly accessory?: BlockKitElement;
  readonly fields?: readonly BlockKitText[];
  readonly [key: string]: unknown;
}

export interface BlockKitText {
  readonly type: 'plain_text' | 'mrkdwn';
  readonly text: string;
  readonly emoji?: boolean;
}

export interface BlockKitElement {
  readonly type: string;
  readonly action_id?: string;
  readonly text?: BlockKitText;
  readonly value?: string;
  readonly url?: string;
  readonly options?: readonly BlockKitOption[];
  readonly [key: string]: unknown;
}

export interface BlockKitOption {
  readonly text: BlockKitText;
  readonly value: string;
  readonly description?: BlockKitText;
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

/**
 * Rate limit state for API calls.
 */
export interface RateLimitState {
  /** Number of requests remaining in the current window. */
  readonly remaining: number;
  /** Unix timestamp (seconds) when the rate limit resets. */
  readonly resetAt: number;
  /** Whether we are currently being rate-limited. */
  readonly limited: boolean;
  /** Retry-After header value in seconds, if rate-limited. */
  readonly retryAfterSec: number;
}

// ---------------------------------------------------------------------------
// DM Pairing / Security
// ---------------------------------------------------------------------------

/**
 * DM pairing configuration for controlling who can message the Orchestrator.
 */
export interface PairingConfig {
  /** Whether new DM senders require explicit approval. */
  readonly requireApproval: boolean;
  /** Platform-native IDs of users allowed to DM without approval. */
  readonly allowList: readonly string[];
  /** Normalize a raw allow-list entry to canonical form. */
  normalizeEntry(raw: string): string;
}

/**
 * Result of validating whether a sender is allowed to message the Orchestrator.
 */
export interface SenderValidation {
  /** Whether the sender is allowed. */
  readonly allowed: boolean;
  /** Reason for denial if not allowed. */
  readonly reason?: string;
  /** Whether this sender is pending approval. */
  readonly pendingApproval?: boolean;
}

// ---------------------------------------------------------------------------
// Channel-Specific Configuration
// ---------------------------------------------------------------------------

/**
 * Base configuration that all channel adapters accept.
 * Each adapter extends this with platform-specific fields.
 */
export interface ChannelConfig {
  /** Whether this channel is enabled. */
  readonly enabled: boolean;
  /** Account identifier (for multi-account support). */
  readonly accountId?: string;
  /** DM pairing configuration. */
  readonly pairing?: PairingConfig;
  /** Ack reaction scope. */
  readonly ackReactionScope?: AckReactionScope;
  /** Ack reaction emoji. */
  readonly ackReactionEmoji?: string;
  /** Whether to remove ack reaction after the agent replies. */
  readonly ackReactionRemoveAfterReply?: boolean;
}

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

/** Events emitted by channel adapters. */
export type ChannelEventType =
  | 'message'
  | 'message_edited'
  | 'message_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'typing'
  | 'presence_change'
  | 'member_joined'
  | 'member_left'
  | 'slash_command'
  | 'interactive_action'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * Event payload map for type-safe event handling.
 */
export interface ChannelEventMap {
  message: NormalizedMessage;
  message_edited: {
    channelId: ChannelId;
    conversationId: string;
    messageId: string;
    newContent: MessageContent;
    timestamp: Date;
  };
  message_deleted: {
    channelId: ChannelId;
    conversationId: string;
    messageId: string;
    timestamp: Date;
  };
  reaction_added: {
    channelId: ChannelId;
    conversationId: string;
    messageId: string;
    userId: string;
    emoji: string;
  };
  reaction_removed: {
    channelId: ChannelId;
    conversationId: string;
    messageId: string;
    userId: string;
    emoji: string;
  };
  typing: {
    channelId: ChannelId;
    conversationId: string;
    userId: string;
  };
  presence_change: {
    channelId: ChannelId;
    userId: string;
    presence: 'active' | 'away' | 'offline';
  };
  member_joined: {
    channelId: ChannelId;
    conversationId: string;
    userId: string;
  };
  member_left: {
    channelId: ChannelId;
    conversationId: string;
    userId: string;
  };
  slash_command: SlashCommandPayload;
  interactive_action: InteractiveAction;
  connected: {
    channelId: ChannelId;
    accountId?: string;
  };
  disconnected: {
    channelId: ChannelId;
    accountId?: string;
    reason?: string;
  };
  error: {
    channelId: ChannelId;
    error: Error;
    recoverable: boolean;
  };
}

/** Type-safe event handler. */
export type ChannelEventHandler<E extends ChannelEventType> = (
  event: ChannelEventMap[E],
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/** Health status of a channel adapter. */
export interface ChannelHealthStatus {
  readonly channelId: ChannelId;
  readonly healthy: boolean;
  readonly connected: boolean;
  readonly latencyMs?: number;
  readonly accountId?: string;
  readonly lastMessageAt?: Date;
  readonly lastErrorAt?: Date;
  readonly lastError?: string;
  readonly details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Logger Interface
// ---------------------------------------------------------------------------

/** Minimal logger that channel adapters use. */
export interface ChannelLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

// ---------------------------------------------------------------------------
// ChannelPlugin Interface
// ---------------------------------------------------------------------------

/**
 * The core contract every channel adapter must implement.
 *
 * Design principles (inherited from OpenClaw):
 * - Decomposed: each concern is a separate method or group
 * - Capabilities-gated: callers check capabilities before invoking optional methods
 * - Normalized I/O: inbound messages are NormalizedMessage, outbound is OutboundMessage
 * - Lifecycle-aware: connect/disconnect with health monitoring
 */
export interface ChannelPlugin {
  // -- Identity -----------------------------------------------------------

  /** Unique channel identifier. */
  readonly id: ChannelId;
  /** Display metadata. */
  readonly meta: ChannelMeta;
  /** Feature flags. */
  readonly capabilities: ChannelCapabilities;

  // -- Lifecycle ----------------------------------------------------------

  /**
   * Connect to the platform and start receiving events.
   * Must be idempotent -- calling connect() when already connected is a no-op.
   */
  connect(config: ChannelConfig): Promise<void>;

  /**
   * Gracefully disconnect from the platform.
   * Must be idempotent -- calling disconnect() when already disconnected is a no-op.
   */
  disconnect(): Promise<void>;

  /** Check whether the adapter is currently connected. */
  isConnected(): boolean;

  /** Perform a health check and return detailed status. */
  healthCheck(): Promise<ChannelHealthStatus>;

  // -- Messaging ----------------------------------------------------------

  /**
   * Send a message to a conversation.
   * The adapter handles chunking for messages exceeding maxMessageLength.
   */
  sendMessage(message: OutboundMessage): Promise<DeliveryResult>;

  /**
   * Edit a previously sent message (requires capabilities.edit).
   */
  editMessage?(
    conversationId: string,
    messageId: string,
    newText: string,
  ): Promise<DeliveryResult>;

  /**
   * Delete a previously sent message (requires capabilities.delete).
   */
  deleteMessage?(conversationId: string, messageId: string): Promise<boolean>;

  // -- Event Handling -----------------------------------------------------

  /**
   * Register a handler for a specific event type.
   * Returns an unsubscribe function.
   */
  on<E extends ChannelEventType>(
    event: E,
    handler: ChannelEventHandler<E>,
  ): () => void;

  // -- Threading ----------------------------------------------------------

  /**
   * Reply within a thread (requires capabilities.threads).
   * Falls back to sendMessage with threadId if not separately implemented.
   */
  replyToThread?(
    conversationId: string,
    threadId: string,
    message: OutboundMessage,
  ): Promise<DeliveryResult>;

  // -- Reactions ----------------------------------------------------------

  /**
   * Add an emoji reaction to a message (requires capabilities.reactions).
   */
  addReaction?(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;

  /**
   * Remove an emoji reaction (requires capabilities.reactions).
   */
  removeReaction?(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;

  // -- Typing Indicators --------------------------------------------------

  /**
   * Start showing a typing indicator (requires capabilities.typingIndicators).
   * Returns a handle to stop the indicator.
   */
  sendTypingIndicator?(conversationId: string): TypingHandle;

  // -- Media --------------------------------------------------------------

  /**
   * Send a media message (requires capabilities.media).
   * Validates against maxMediaBytes before uploading.
   */
  sendMedia?(
    conversationId: string,
    attachment: OutboundAttachment,
    options?: { text?: string; threadId?: string },
  ): Promise<DeliveryResult>;

  /**
   * Download media from a platform URL.
   * Returns the raw buffer. The URL may require platform-specific auth headers.
   */
  downloadMedia?(url: string): Promise<Buffer>;

  // -- Security / Pairing -------------------------------------------------

  /**
   * Validate whether a sender is allowed to message the Orchestrator.
   * Used for DM pairing enforcement.
   */
  validateSender?(
    senderId: string,
    chatType: ChatType,
  ): Promise<SenderValidation>;

  /**
   * Get the current pairing configuration.
   */
  getPairingConfig?(): PairingConfig | null;
}

// ---------------------------------------------------------------------------
// Adapter Base Class
// ---------------------------------------------------------------------------

/**
 * Optional base class that provides common adapter boilerplate.
 * Concrete adapters can extend this or implement ChannelPlugin directly.
 */
export abstract class BaseChannelAdapter implements ChannelPlugin {
  abstract readonly id: ChannelId;
  abstract readonly meta: ChannelMeta;
  abstract readonly capabilities: ChannelCapabilities;

  protected connected = false;
  protected config: ChannelConfig | null = null;
  protected logger: ChannelLogger;

  private readonly handlers = new Map<
    ChannelEventType,
    Set<ChannelEventHandler<ChannelEventType>>
  >();

  constructor(logger?: ChannelLogger) {
    this.logger = logger ?? {
      info: (msg, ...args) => console.log(`[${this.id}] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${this.id}] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${this.id}] ${msg}`, ...args),
      debug: (msg, ...args) => console.debug(`[${this.id}] ${msg}`, ...args),
    };
  }

  abstract connect(config: ChannelConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(message: OutboundMessage): Promise<DeliveryResult>;

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    return {
      channelId: this.id,
      healthy: this.connected,
      connected: this.connected,
    };
  }

  on<E extends ChannelEventType>(
    event: E,
    handler: ChannelEventHandler<E>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const handlers = this.handlers.get(event)!;
    handlers.add(handler as ChannelEventHandler<ChannelEventType>);

    return () => {
      handlers.delete(handler as ChannelEventHandler<ChannelEventType>);
    };
  }

  /**
   * Emit an event to all registered handlers.
   * Errors in handlers are logged but do not propagate.
   */
  protected emit<E extends ChannelEventType>(
    event: E,
    payload: ChannelEventMap[E],
  ): void {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }
    for (const handler of handlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            this.logger.error(
              `Error in ${event} handler: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      } catch (err) {
        this.logger.error(
          `Error in ${event} handler: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Chunk a text message into segments that fit within the channel's
   * maxMessageLength. Returns an array of chunks.
   */
  protected chunkText(text: string): string[] {
    const limit = this.capabilities.maxMessageLength;
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

      // Try to break at a newline boundary within the limit.
      let breakAt = remaining.lastIndexOf('\n', limit);
      if (breakAt <= 0 || breakAt < limit * 0.5) {
        // Fall back to space boundary.
        breakAt = remaining.lastIndexOf(' ', limit);
      }
      if (breakAt <= 0 || breakAt < limit * 0.5) {
        // Hard break.
        breakAt = limit;
      }

      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }

    return chunks;
  }
}
