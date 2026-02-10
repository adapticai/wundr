/**
 * Channel Abstraction Layer
 *
 * Provides channel adapters for multi-platform messaging (Slack, Discord,
 * Telegram, Terminal, WebSocket) with a unified plugin interface,
 * registry, and message routing.
 *
 * @module @wundr/orchestrator-daemon/channels
 */

// Types
export type {
  BuiltInChannelId,
  ChannelId,
  ChannelMeta,
  ChatType,
  ChannelCapabilities,
  NormalizedSender,
  NormalizedAttachment,
  MessageContent,
  NormalizedMessage,
  OutboundMessage,
  OutboundAttachment,
  DeliveryResult,
  TypingHandle,
  AckReactionScope,
  ReplyToMode,
  ThreadingToolContext,
  SlashCommandPayload,
  InteractiveAction,
  BlockKitBlock,
  BlockKitText,
  BlockKitElement,
  BlockKitOption,
  RateLimitState,
  PairingConfig,
  SenderValidation,
  ChannelConfig,
  ChannelEventType,
  ChannelEventMap,
  ChannelEventHandler,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelPlugin,
  // Media pipeline types
  MediaCategory,
  ScanResult,
  MediaProgressEvent,
  MediaProgressCallback,
  ChannelFormatTarget,
  ChannelFormattedContent,
  ImageResizeOptions,
  MediaScannerProvider,
  ImageResizerProvider,
  MediaCacheEntry,
  MediaCacheProvider,
} from './types';

export { BaseChannelAdapter } from './types';

// Registry
export {
  ChannelRegistry,
  getDefaultRegistry,
  setDefaultRegistry,
} from './registry';
export type { ChannelRegistryOptions } from './registry';

// Router
export { ChannelRouter } from './router';

// Media Pipeline
export {
  MediaPipeline,
  CHANNEL_MEDIA_LIMITS,
  DEFAULT_MAX_MEDIA_BYTES,
} from './media-pipeline';
export type {
  MediaValidationResult,
  MediaPipelineOptions,
} from './media-pipeline';
