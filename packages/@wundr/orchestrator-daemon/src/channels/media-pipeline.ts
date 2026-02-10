/**
 * Media Pipeline
 *
 * Comprehensive file handling for the channel abstraction layer. Validates,
 * normalizes, transforms, caches, and routes media through channel adapters
 * with per-channel size limits, MIME enforcement, security scanning, image
 * optimization, format conversion, and upload progress tracking.
 *
 * Design principles (inherited from OpenClaw):
 * - Capabilities-gated: callers check channel capabilities before invoking
 * - Pluggable providers: scanning, caching, and resizing are injected
 * - Deterministic: same input always produces the same validation result
 * - Safe by default: executables are blocked, sizes are enforced
 *
 * @packageDocumentation
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';

import type {
  ChannelFormatTarget,
  ChannelFormattedContent,
  ChannelId,
  ChannelLogger,
  ChannelPlugin,
  ImageResizeOptions,
  ImageResizerProvider,
  MediaCacheEntry,
  MediaCacheProvider,
  MediaCategory,
  MediaProgressCallback,
  MediaProgressEvent,
  MediaScannerProvider,
  NormalizedAttachment,
  OutboundAttachment,
  ScanResult,
} from './types';

// ---------------------------------------------------------------------------
// Media Limits
// ---------------------------------------------------------------------------

/**
 * Per-channel media size limits in bytes.
 * These are the documented platform limits as of 2026-02.
 */
export const CHANNEL_MEDIA_LIMITS: Readonly<Record<string, number>> = {
  slack: 1_073_741_824,    // 1 GB (Slack Business+)
  discord: 26_214_400,     // 25 MB (free tier; Nitro = 500 MB)
  telegram: 52_428_800,    // 50 MB (Bot API standard)
  terminal: -1,            // Unsupported
  websocket: -1,           // Use HTTP upload instead
};

/**
 * Per-channel maximum message length in characters.
 * Used by the message splitting logic.
 */
const CHANNEL_TEXT_LIMITS: Readonly<Record<string, number>> = {
  slack: 4000,
  discord: 2000,
  telegram: 4096,
  terminal: 0,      // unlimited
  websocket: 0,     // unlimited
};

/**
 * Per-channel image dimension limits (width x height).
 */
const CHANNEL_IMAGE_LIMITS: Readonly<Record<string, { maxWidth: number; maxHeight: number }>> = {
  slack: { maxWidth: 4096, maxHeight: 4096 },
  discord: { maxWidth: 4096, maxHeight: 4096 },
  telegram: { maxWidth: 5120, maxHeight: 5120 },
};

/**
 * Global fallback media limit when no channel-specific limit is configured.
 */
export const DEFAULT_MAX_MEDIA_BYTES = 26_214_400; // 25 MB

// ---------------------------------------------------------------------------
// MIME Types
// ---------------------------------------------------------------------------

/**
 * Known MIME type groups for media classification.
 */
const IMAGE_MIME_PREFIXES = ['image/'] as const;
const VIDEO_MIME_PREFIXES = ['video/'] as const;
const AUDIO_MIME_PREFIXES = ['audio/'] as const;

/**
 * Extension-to-MIME type mapping for common file types.
 */
const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',

  // Videos
  mp4: 'video/mp4',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  m4v: 'video/x-m4v',

  // Audio
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
  opus: 'audio/opus',

  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  md: 'text/markdown',
  rtf: 'application/rtf',
  yaml: 'application/x-yaml',
  yml: 'application/x-yaml',

  // Archives
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  bz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',

  // Code
  js: 'text/javascript',
  ts: 'text/typescript',
  py: 'text/x-python',
  rb: 'text/x-ruby',
  java: 'text/x-java-source',
  c: 'text/x-c',
  cpp: 'text/x-c++src',
  h: 'text/x-c',
  rs: 'text/x-rust',
  go: 'text/x-go',
  swift: 'text/x-swift',
  kt: 'text/x-kotlin',
  scala: 'text/x-scala',
  sh: 'text/x-shellscript',
  sql: 'text/x-sql',
};

/**
 * Map file extensions to language identifiers for syntax highlighting.
 */
const EXTENSION_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  toml: 'toml',
  ini: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  r: 'r',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  php: 'php',
  cs: 'csharp',
  fs: 'fsharp',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  vim: 'vim',
  tf: 'hcl',
  proto: 'protobuf',
  graphql: 'graphql',
  gql: 'graphql',
};

/**
 * Extensions that are considered executable and blocked by default.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'msp', 'mst',
  'cpl', 'hta', 'inf', 'ins', 'isp', 'jse', 'lnk', 'reg', 'rgs',
  'sct', 'shb', 'shs', 'vbe', 'vbs', 'wsc', 'wsf', 'wsh', 'ws',
  'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2',
  'dll', 'sys', 'drv', 'ocx',
  'app', 'action', 'command', 'workflow', 'sh', 'csh', 'ksh',
  'elf', 'bin', 'run', 'apk', 'deb', 'rpm',
]);

/**
 * MIME types that are considered executable and blocked by default.
 */
const EXECUTABLE_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sharedlib',
  'application/x-shellscript',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-mach-binary',
  'application/x-elf',
  'application/x-pie-executable',
]);

/**
 * Magic bytes for file type detection.
 */
const MAGIC_BYTES: ReadonlyArray<{
  bytes: readonly number[];
  offset: number;
  mimeType: string;
}> = [
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: 'image/webp' }, // RIFF header; WebP has "WEBP" at offset 8
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf' },
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: 'application/zip' },
  { bytes: [0x1F, 0x8B], offset: 0, mimeType: 'application/gzip' },
  { bytes: [0x42, 0x4D], offset: 0, mimeType: 'image/bmp' },
  { bytes: [0x4D, 0x5A], offset: 0, mimeType: 'application/x-msdownload' },
  { bytes: [0x7F, 0x45, 0x4C, 0x46], offset: 0, mimeType: 'application/x-elf' },
  { bytes: [0x49, 0x44, 0x33], offset: 0, mimeType: 'audio/mpeg' },
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mimeType: 'video/mp4' },
  { bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0, mimeType: 'audio/ogg' },
  { bytes: [0x66, 0x4C, 0x61, 0x43], offset: 0, mimeType: 'audio/flac' },
];

// ---------------------------------------------------------------------------
// File Policy
// ---------------------------------------------------------------------------

/**
 * Policy configuration for file type allowlisting/denylisting.
 */
export interface FilePolicy {
  /**
   * Mode of enforcement.
   * - 'denylist': block extensions/MIME types in the deny sets (default)
   * - 'allowlist': only permit extensions/MIME types in the allow sets
   */
  readonly mode: 'allowlist' | 'denylist';

  /** Extensions to allow (allowlist mode) or block (denylist mode). */
  readonly extensions?: ReadonlySet<string>;

  /** MIME types to allow (allowlist mode) or block (denylist mode). */
  readonly mimeTypes?: ReadonlySet<string>;

  /** Whether to block executables regardless of mode. Default: true. */
  readonly blockExecutables?: boolean;

  /** Maximum filename length. Default: 255. */
  readonly maxFilenameLength?: number;
}

// ---------------------------------------------------------------------------
// Channel Media Profile
// ---------------------------------------------------------------------------

/**
 * Per-channel media handling profile. Collects all channel-specific media
 * constraints in one place so the pipeline does not need scattered lookups.
 */
export interface ChannelMediaProfile {
  /** Maximum file size in bytes (-1 = unsupported, 0 = unlimited). */
  readonly maxBytes: number;
  /** Maximum text message length in characters (0 = unlimited). */
  readonly maxTextLength: number;
  /** Image dimension limits. */
  readonly imageLimits?: { readonly maxWidth: number; readonly maxHeight: number };
  /** Native format target for markdown conversion. */
  readonly formatTarget: ChannelFormatTarget;
  /** Whether the channel supports inline code blocks. */
  readonly supportsCodeBlocks: boolean;
  /** Whether the channel supports link previews natively. */
  readonly supportsLinkPreviews: boolean;
}

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of media validation.
 */
export interface MediaValidationResult {
  /** Whether the media passes validation. */
  readonly valid: boolean;
  /** Human-readable reason for failure. */
  readonly reason?: string;
  /** Resolved MIME type (may differ from input if inferred). */
  readonly mimeType?: string;
  /** Resolved attachment type. */
  readonly type?: NormalizedAttachment['type'];
  /** Resolved media category. */
  readonly category?: MediaCategory;
  /** Maximum allowed size in bytes for the target channel. */
  readonly maxBytes?: number;
  /** Whether the file was identified as an executable. */
  readonly isExecutable?: boolean;
  /** Malware scan result if scanning was performed. */
  readonly scanResult?: ScanResult;
}

// ---------------------------------------------------------------------------
// Pipeline Options
// ---------------------------------------------------------------------------

export interface MediaPipelineOptions {
  /** Custom per-channel overrides for max media bytes. */
  readonly channelLimits?: Readonly<Record<string, number>>;
  /** Global fallback max bytes. */
  readonly defaultMaxBytes?: number;
  /** File type enforcement policy. */
  readonly filePolicy?: FilePolicy;
  /** Pluggable malware scanner. */
  readonly scanner?: MediaScannerProvider;
  /** Pluggable image resizer/optimizer. */
  readonly resizer?: ImageResizerProvider;
  /** Pluggable media upload cache. */
  readonly cache?: MediaCacheProvider;
  /** Directory for temporary files. Defaults to os.tmpdir(). */
  readonly tempDir?: string;
  /** TTL in milliseconds for cached uploads. Default: 24 hours. */
  readonly cacheTtlMs?: number;
  /** Logger instance. */
  readonly logger?: ChannelLogger;
}

// ---------------------------------------------------------------------------
// InMemoryMediaCache
// ---------------------------------------------------------------------------

/**
 * Simple in-memory LRU-ish cache for media uploads.
 * Suitable for single-process daemons; replace with a Redis-backed
 * implementation via MediaCacheProvider for multi-process deployments.
 */
export class InMemoryMediaCache implements MediaCacheProvider {
  private readonly store = new Map<string, MediaCacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  async get(key: string, channelId: ChannelId): Promise<MediaCacheEntry | null> {
    const compositeKey = `${channelId}:${key}`;
    const entry = this.store.get(compositeKey);
    if (!entry) {
return null;
}
    if (entry.expiresAt < new Date()) {
      this.store.delete(compositeKey);
      return null;
    }
    return entry;
  }

  async set(entry: MediaCacheEntry): Promise<void> {
    const compositeKey = `${entry.channelId}:${entry.key}`;
    // Evict oldest if at capacity.
    if (this.store.size >= this.maxEntries && !this.store.has(compositeKey)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
    this.store.set(compositeKey, entry);
  }

  async delete(key: string, channelId: ChannelId): Promise<void> {
    this.store.delete(`${channelId}:${key}`);
  }

  async clearChannel(channelId: ChannelId): Promise<void> {
    const prefix = `${channelId}:`;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Number of entries currently in the cache. */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// MediaPipeline
// ---------------------------------------------------------------------------

/**
 * Central media pipeline that validates, classifies, transforms, caches,
 * and routes media through channel adapters.
 *
 * Usage:
 * ```typescript
 * const pipeline = new MediaPipeline({
 *   scanner: myVirusScanner,
 *   resizer: sharpResizer,
 *   cache: new InMemoryMediaCache(),
 * });
 *
 * // Validate
 * const validation = pipeline.validate(attachment, 'discord');
 * if (!validation.valid) {
 *   console.error(`Media rejected: ${validation.reason}`);
 *   return;
 * }
 *
 * // Process (resize, scan, cache lookup)
 * const processed = await pipeline.process(attachment, 'discord', onProgress);
 *
 * // Send
 * const result = await pipeline.send(adapter, conversationId, processed);
 *
 * // Format content for channel
 * const formatted = pipeline.formatMarkdown('**hello** `world`', 'telegram');
 * ```
 */
export class MediaPipeline {
  private readonly channelLimits: Record<string, number>;
  private readonly defaultMaxBytes: number;
  private readonly filePolicy: Required<FilePolicy>;
  private readonly scanner: MediaScannerProvider | null;
  private readonly resizer: ImageResizerProvider | null;
  private readonly cache: MediaCacheProvider | null;
  private readonly tempDir: string;
  private readonly cacheTtlMs: number;
  private readonly logger: ChannelLogger;
  private readonly tempFiles = new Set<string>();

  constructor(options?: MediaPipelineOptions) {
    this.channelLimits = {
      ...CHANNEL_MEDIA_LIMITS,
      ...(options?.channelLimits ?? {}),
    };
    this.defaultMaxBytes =
      options?.defaultMaxBytes ?? DEFAULT_MAX_MEDIA_BYTES;
    this.filePolicy = {
      mode: options?.filePolicy?.mode ?? 'denylist',
      extensions: options?.filePolicy?.extensions ?? EXECUTABLE_EXTENSIONS,
      mimeTypes: options?.filePolicy?.mimeTypes ?? EXECUTABLE_MIME_TYPES,
      blockExecutables: options?.filePolicy?.blockExecutables ?? true,
      maxFilenameLength: options?.filePolicy?.maxFilenameLength ?? 255,
    };
    this.scanner = options?.scanner ?? null;
    this.resizer = options?.resizer ?? null;
    this.cache = options?.cache ?? null;
    this.tempDir = options?.tempDir ?? os.tmpdir();
    this.cacheTtlMs = options?.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    this.logger = options?.logger ?? {
      info: (msg, ...args) =>
        console.log(`[MediaPipeline] ${msg}`, ...args),
      warn: (msg, ...args) =>
        console.warn(`[MediaPipeline] ${msg}`, ...args),
      error: (msg, ...args) =>
        console.error(`[MediaPipeline] ${msg}`, ...args),
      debug: (msg, ...args) =>
        console.debug(`[MediaPipeline] ${msg}`, ...args),
    };
  }

  // -----------------------------------------------------------------------
  // Channel Media Profiles
  // -----------------------------------------------------------------------

  /**
   * Build the media profile for a channel. Collects all channel-specific
   * constraints (size, text length, image limits, format target) into a
   * single object.
   */
  getChannelProfile(channelId: ChannelId): ChannelMediaProfile {
    const normalized = channelId.trim().toLowerCase();
    const maxBytes = this.resolveMaxBytes(channelId);
    const maxTextLength = CHANNEL_TEXT_LIMITS[normalized] ?? 0;
    const imageLimits = CHANNEL_IMAGE_LIMITS[normalized];

    let formatTarget: ChannelFormatTarget;
    switch (normalized) {
      case 'slack':
        formatTarget = 'slack';
        break;
      case 'discord':
        formatTarget = 'discord';
        break;
      case 'telegram':
        formatTarget = 'telegram';
        break;
      default:
        formatTarget = 'plain';
    }

    return {
      maxBytes,
      maxTextLength,
      imageLimits,
      formatTarget,
      supportsCodeBlocks: normalized !== 'terminal',
      supportsLinkPreviews: ['slack', 'discord', 'telegram'].includes(normalized),
    };
  }

  // -----------------------------------------------------------------------
  // Size Resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the maximum media size in bytes for a channel.
   *
   * @param channelId - The target channel.
   * @returns Maximum bytes allowed, or -1 if media is unsupported.
   */
  resolveMaxBytes(channelId: ChannelId): number {
    const normalized = channelId.trim().toLowerCase();
    const limit = this.channelLimits[normalized];
    if (limit !== undefined) {
      return limit;
    }
    return this.defaultMaxBytes;
  }

  /**
   * Resolve max bytes from a channel plugin's capabilities.
   */
  resolveMaxBytesFromPlugin(plugin: ChannelPlugin): number {
    if (!plugin.capabilities.media) {
      return -1;
    }
    const capsLimit = plugin.capabilities.maxMediaBytes;
    if (capsLimit !== 0) {
      return capsLimit;
    }
    return this.resolveMaxBytes(plugin.id);
  }

  // -----------------------------------------------------------------------
  // MIME Type Resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve a MIME type from a filename extension.
   * Returns undefined if the extension is not recognized.
   */
  resolveMimeType(filename: string): string | undefined {
    const ext = extractExtension(filename);
    if (!ext) {
return undefined;
}
    return EXTENSION_MIME_MAP[ext];
  }

  /**
   * Detect MIME type from file content using magic bytes.
   * Falls back to extension-based detection if magic bytes are not recognized.
   */
  detectMimeType(buffer: Buffer, filename: string): string | undefined {
    // Try magic bytes first.
    for (const magic of MAGIC_BYTES) {
      if (buffer.length < magic.offset + magic.bytes.length) {
continue;
}
      let match = true;
      for (let i = 0; i < magic.bytes.length; i++) {
        if (buffer[magic.offset + i] !== magic.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Refine RIFF-based detection: check for WEBP at offset 8.
        if (magic.mimeType === 'image/webp') {
          if (
            buffer.length >= 12 &&
            buffer[8] === 0x57 && // W
            buffer[9] === 0x45 && // E
            buffer[10] === 0x42 && // B
            buffer[11] === 0x50   // P
          ) {
            return 'image/webp';
          }
          // RIFF but not WEBP -- could be AVI or WAV.
          continue;
        }
        return magic.mimeType;
      }
    }
    // Fall back to extension.
    return this.resolveMimeType(filename);
  }

  /**
   * Resolve the attachment type from a MIME type.
   */
  resolveAttachmentType(
    mimeType?: string,
  ): NormalizedAttachment['type'] {
    if (!mimeType) {
return 'file';
}
    if (IMAGE_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
return 'image';
}
    if (VIDEO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
return 'video';
}
    if (AUDIO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
return 'audio';
}
    return 'file';
  }

  /**
   * Classify a file into a broad media category.
   */
  classifyFile(mimeType: string | undefined, filename: string): MediaCategory {
    const ext = extractExtension(filename);
    if (ext && EXECUTABLE_EXTENSIONS.has(ext)) {
return 'executable';
}
    if (mimeType && EXECUTABLE_MIME_TYPES.has(mimeType)) {
return 'executable';
}

    if (!mimeType) {
return 'unknown';
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
    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/rtf'
    ) {
      return 'document';
    }
    if (
      mimeType === 'application/zip' ||
      mimeType === 'application/gzip' ||
      mimeType === 'application/x-tar' ||
      mimeType === 'application/x-7z-compressed' ||
      mimeType === 'application/vnd.rar' ||
      mimeType === 'application/x-bzip2' ||
      mimeType === 'application/x-xz'
    ) {
      return 'archive';
    }
    return 'unknown';
  }

  /**
   * Resolve a programming language identifier from a filename extension.
   * Used for syntax-highlighted code block formatting.
   */
  resolveLanguage(filename: string): string | undefined {
    const ext = extractExtension(filename);
    if (!ext) {
return undefined;
}
    return EXTENSION_LANGUAGE_MAP[ext];
  }

  // -----------------------------------------------------------------------
  // File Policy Enforcement
  // -----------------------------------------------------------------------

  /**
   * Check whether a file passes the configured file type policy.
   */
  checkFilePolicy(
    filename: string,
    mimeType?: string,
  ): { allowed: boolean; reason?: string } {
    // Filename length check.
    if (filename.length > this.filePolicy.maxFilenameLength) {
      return {
        allowed: false,
        reason: `Filename exceeds maximum length of ${this.filePolicy.maxFilenameLength} characters.`,
      };
    }

    // Sanitize filename for path traversal.
    const basename = path.basename(filename);
    if (basename !== filename && filename.includes('..')) {
      return {
        allowed: false,
        reason: 'Filename contains path traversal sequences.',
      };
    }

    const ext = extractExtension(filename);

    // Block executables regardless of mode if configured.
    if (this.filePolicy.blockExecutables) {
      if (ext && EXECUTABLE_EXTENSIONS.has(ext)) {
        return {
          allowed: false,
          reason: `Executable file type ".${ext}" is blocked by security policy.`,
        };
      }
      if (mimeType && EXECUTABLE_MIME_TYPES.has(mimeType)) {
        return {
          allowed: false,
          reason: `Executable MIME type "${mimeType}" is blocked by security policy.`,
        };
      }
    }

    if (this.filePolicy.mode === 'allowlist') {
      // In allowlist mode, file must match at least one allow criterion.
      const extAllowed = ext && this.filePolicy.extensions?.has(ext);
      const mimeAllowed = mimeType && this.filePolicy.mimeTypes?.has(mimeType);
      if (!extAllowed && !mimeAllowed) {
        return {
          allowed: false,
          reason: `File type "${ext ?? 'unknown'}" (${mimeType ?? 'unknown'}) is not in the allowlist.`,
        };
      }
    } else {
      // In denylist mode, file must not match any deny criterion.
      if (ext && this.filePolicy.extensions?.has(ext)) {
        return {
          allowed: false,
          reason: `File extension ".${ext}" is in the denylist.`,
        };
      }
      if (mimeType && this.filePolicy.mimeTypes?.has(mimeType)) {
        return {
          allowed: false,
          reason: `MIME type "${mimeType}" is in the denylist.`,
        };
      }
    }

    return { allowed: true };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate a media attachment against a target channel's constraints.
   *
   * Checks:
   * 1. Channel supports media uploads
   * 2. File type policy (allowlist/denylist, executable blocking)
   * 3. MIME type detection (magic bytes + extension)
   * 4. File size within channel limit
   *
   * @param attachment - The outbound attachment to validate.
   * @param channelId - The target channel ID.
   * @returns Validation result with resolved metadata.
   */
  validate(
    attachment: OutboundAttachment,
    channelId: ChannelId,
  ): MediaValidationResult {
    const maxBytes = this.resolveMaxBytes(channelId);

    // Channel does not support media.
    if (maxBytes === -1) {
      return {
        valid: false,
        reason: `Channel "${channelId}" does not support media uploads.`,
        maxBytes: -1,
      };
    }

    // Detect MIME type: prefer magic bytes over extension when buffer is available.
    let mimeType = attachment.mimeType;
    if (!mimeType && attachment.source === 'buffer' && attachment.buffer) {
      mimeType = this.detectMimeType(attachment.buffer, attachment.filename);
    }
    if (!mimeType) {
      mimeType = this.resolveMimeType(attachment.filename);
    }

    const type = this.resolveAttachmentType(mimeType);
    const category = this.classifyFile(mimeType, attachment.filename);
    const isExecutable = category === 'executable';

    // File policy check.
    const policyResult = this.checkFilePolicy(attachment.filename, mimeType);
    if (!policyResult.allowed) {
      return {
        valid: false,
        reason: policyResult.reason,
        mimeType,
        type,
        category,
        maxBytes,
        isExecutable,
      };
    }

    // Check size for buffer attachments.
    if (attachment.source === 'buffer' && attachment.buffer) {
      if (maxBytes > 0 && attachment.buffer.byteLength > maxBytes) {
        return {
          valid: false,
          reason:
            `File "${attachment.filename}" is ${formatBytes(attachment.buffer.byteLength)} ` +
            `but the maximum for ${channelId} is ${formatBytes(maxBytes)}.`,
          mimeType,
          type,
          category,
          maxBytes,
          isExecutable,
        };
      }
    }

    return {
      valid: true,
      mimeType,
      type,
      category,
      maxBytes,
      isExecutable,
    };
  }

  /**
   * Validate a media attachment against a channel plugin's capabilities.
   */
  validateForPlugin(
    attachment: OutboundAttachment,
    plugin: ChannelPlugin,
  ): MediaValidationResult {
    if (!plugin.capabilities.media) {
      return {
        valid: false,
        reason: `Channel "${plugin.id}" does not support media.`,
        maxBytes: -1,
      };
    }

    return this.validate(attachment, plugin.id);
  }

  // -----------------------------------------------------------------------
  // Processing Pipeline
  // -----------------------------------------------------------------------

  /**
   * Full processing pipeline for an outbound attachment:
   *
   * 1. Resolve the buffer (download URL or read file path if needed)
   * 2. Detect MIME type via magic bytes
   * 3. Enforce file policy
   * 4. Run malware scan (if scanner is configured)
   * 5. Check upload cache (skip re-upload if hit)
   * 6. Resize images if they exceed channel limits
   * 7. Validate final size against channel limit
   *
   * Returns a new OutboundAttachment with resolved buffer, MIME type,
   * and potentially resized content.
   */
  async process(
    attachment: OutboundAttachment,
    channelId: ChannelId,
    onProgress?: MediaProgressCallback,
  ): Promise<{
    attachment: OutboundAttachment;
    validation: MediaValidationResult;
    cached: boolean;
    cacheKey?: string;
    scanResult?: ScanResult;
  }> {
    // Step 1: Resolve buffer.
    let buffer = attachment.buffer;
    if (!buffer) {
      buffer = await this.resolveBuffer(attachment, channelId, onProgress);
    }

    // Step 2: Detect MIME.
    const mimeType =
      attachment.mimeType ??
      this.detectMimeType(buffer, attachment.filename) ??
      this.resolveMimeType(attachment.filename);

    const type = this.resolveAttachmentType(mimeType);
    const category = this.classifyFile(mimeType, attachment.filename);

    // Step 3: File policy.
    const policyResult = this.checkFilePolicy(attachment.filename, mimeType);
    if (!policyResult.allowed) {
      return {
        attachment,
        validation: {
          valid: false,
          reason: policyResult.reason,
          mimeType,
          type,
          category,
          maxBytes: this.resolveMaxBytes(channelId),
          isExecutable: category === 'executable',
        },
        cached: false,
      };
    }

    // Step 4: Malware scan.
    let scanResult: ScanResult | undefined;
    if (this.scanner) {
      this.emitProgress(onProgress, {
        operation: 'scan',
        bytesTransferred: 0,
        totalBytes: buffer.byteLength,
        fraction: 0,
        channelId,
        filename: attachment.filename,
      });

      scanResult = await this.scanner.scan(buffer, attachment.filename);

      this.emitProgress(onProgress, {
        operation: 'scan',
        bytesTransferred: buffer.byteLength,
        totalBytes: buffer.byteLength,
        fraction: 1,
        channelId,
        filename: attachment.filename,
      });

      if (!scanResult.clean) {
        return {
          attachment,
          validation: {
            valid: false,
            reason: `File "${attachment.filename}" failed security scan: ${scanResult.verdict}`,
            mimeType,
            type,
            category,
            maxBytes: this.resolveMaxBytes(channelId),
            scanResult,
          },
          cached: false,
          scanResult,
        };
      }
    }

    // Step 5: Cache lookup.
    const cacheKey = computeContentHash(buffer);
    if (this.cache) {
      const cacheEntry = await this.cache.get(cacheKey, channelId);
      if (cacheEntry) {
        this.logger.debug(
          `Cache hit for ${attachment.filename} -> ${channelId}:${cacheEntry.platformFileId}`,
        );
        return {
          attachment: {
            ...attachment,
            source: 'buffer',
            buffer,
            mimeType,
          },
          validation: {
            valid: true,
            mimeType,
            type,
            category,
            maxBytes: this.resolveMaxBytes(channelId),
          },
          cached: true,
          cacheKey,
          scanResult,
        };
      }
    }

    // Step 6: Image resize.
    let processedBuffer = buffer;
    let processedMimeType = mimeType;
    if (this.resizer && mimeType && category === 'image') {
      const profile = this.getChannelProfile(channelId);
      const maxBytes = this.resolveMaxBytes(channelId);
      const resizeOpts: ImageResizeOptions = {
        maxWidth: profile.imageLimits?.maxWidth,
        maxHeight: profile.imageLimits?.maxHeight,
        maxBytes: maxBytes > 0 ? maxBytes : undefined,
      };

      this.emitProgress(onProgress, {
        operation: 'resize',
        bytesTransferred: 0,
        totalBytes: buffer.byteLength,
        fraction: 0,
        channelId,
        filename: attachment.filename,
      });

      const resized = await this.resizer.resize(buffer, mimeType, resizeOpts);

      this.emitProgress(onProgress, {
        operation: 'resize',
        bytesTransferred: buffer.byteLength,
        totalBytes: buffer.byteLength,
        fraction: 1,
        channelId,
        filename: attachment.filename,
      });

      if (resized) {
        processedBuffer = resized.buffer;
        processedMimeType = resized.mimeType;
        this.logger.debug(
          `Resized ${attachment.filename}: ${formatBytes(buffer.byteLength)} -> ${formatBytes(processedBuffer.byteLength)}`,
        );
      }
    }

    // Step 7: Final size validation.
    const maxBytes = this.resolveMaxBytes(channelId);
    if (maxBytes > 0 && processedBuffer.byteLength > maxBytes) {
      return {
        attachment: {
          ...attachment,
          source: 'buffer',
          buffer: processedBuffer,
          mimeType: processedMimeType,
        },
        validation: {
          valid: false,
          reason:
            `File "${attachment.filename}" is ${formatBytes(processedBuffer.byteLength)} ` +
            `(after processing) but the maximum for ${channelId} is ${formatBytes(maxBytes)}.`,
          mimeType: processedMimeType,
          type,
          category,
          maxBytes,
        },
        cached: false,
        cacheKey,
        scanResult,
      };
    }

    return {
      attachment: {
        ...attachment,
        source: 'buffer',
        buffer: processedBuffer,
        mimeType: processedMimeType,
      },
      validation: {
        valid: true,
        mimeType: processedMimeType,
        type,
        category,
        maxBytes,
      },
      cached: false,
      cacheKey,
      scanResult,
    };
  }

  // -----------------------------------------------------------------------
  // Buffer Resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the raw bytes for an attachment from its source.
   * - 'buffer': return directly
   * - 'path': read from filesystem
   * - 'url': download via HTTP
   */
  private async resolveBuffer(
    attachment: OutboundAttachment,
    channelId: ChannelId,
    onProgress?: MediaProgressCallback,
  ): Promise<Buffer> {
    if (attachment.source === 'buffer' && attachment.buffer) {
      return attachment.buffer;
    }

    if (attachment.source === 'path' && attachment.location) {
      return this.readFileBuffer(attachment.location, attachment.filename, channelId, onProgress);
    }

    if (attachment.source === 'url' && attachment.location) {
      return this.downloadBuffer(attachment.location, attachment.filename, channelId, onProgress);
    }

    throw new Error(
      `Cannot resolve buffer for attachment "${attachment.filename}": ` +
      `source="${attachment.source}", location=${attachment.location ? 'set' : 'unset'}, ` +
      `buffer=${attachment.buffer ? 'set' : 'unset'}`,
    );
  }

  /**
   * Read a file from the filesystem with progress reporting.
   */
  private async readFileBuffer(
    filePath: string,
    filename: string,
    channelId: ChannelId,
    onProgress?: MediaProgressCallback,
  ): Promise<Buffer> {
    const stat = await fs.promises.stat(filePath);
    const totalBytes = stat.size;
    const chunks: Buffer[] = [];
    let bytesRead = 0;

    const stream = fs.createReadStream(filePath);

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        chunks.push(buf);
        bytesRead += buf.length;
        this.emitProgress(onProgress, {
          operation: 'download',
          bytesTransferred: bytesRead,
          totalBytes,
          fraction: totalBytes > 0 ? bytesRead / totalBytes : 0,
          channelId,
          filename,
        });
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Download a file from a URL with progress reporting.
   * Uses Node's built-in https/http modules for zero extra dependencies.
   */
  private async downloadBuffer(
    url: string,
    filename: string,
    channelId: ChannelId,
    onProgress?: MediaProgressCallback,
  ): Promise<Buffer> {
    // Dynamic import to allow the rest of the pipeline to work without network.
    const protocol = url.startsWith('https') ? await import('https') : await import('http');

    return new Promise<Buffer>((resolve, reject) => {
      const request = protocol.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Follow redirect.
          this.downloadBuffer(response.headers.location, filename, channelId, onProgress)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
          reject(new Error(`HTTP ${response.statusCode} downloading ${truncateUrl(url)}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] ?? '0', 10) || 0;
        const chunks: Buffer[] = [];
        let bytesRead = 0;

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          bytesRead += chunk.length;
          this.emitProgress(onProgress, {
            operation: 'download',
            bytesTransferred: bytesRead,
            totalBytes,
            fraction: totalBytes > 0 ? bytesRead / totalBytes : 0,
            channelId,
            filename,
          });
        });

        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(30_000, () => {
        request.destroy(new Error(`Download timed out for ${truncateUrl(url)}`));
      });
    });
  }

  // -----------------------------------------------------------------------
  // Streaming Upload Support
  // -----------------------------------------------------------------------

  /**
   * Create a readable stream from an outbound attachment.
   * Useful for channel adapters that support streaming uploads to avoid
   * buffering the entire file in memory.
   */
  createReadStream(attachment: OutboundAttachment): Readable {
    if (attachment.source === 'buffer' && attachment.buffer) {
      return Readable.from(attachment.buffer);
    }
    if (attachment.source === 'path' && attachment.location) {
      return fs.createReadStream(attachment.location);
    }
    throw new Error(
      `Cannot create read stream for source="${attachment.source}". ` +
      'URL-sourced attachments must be resolved to a buffer first.',
    );
  }

  // -----------------------------------------------------------------------
  // Send
  // -----------------------------------------------------------------------

  /**
   * Validate and send media through a channel adapter.
   *
   * This method validates the attachment, logs the operation, delegates
   * to the adapter's sendMedia method, and updates the cache on success.
   *
   * @param plugin - The channel adapter to send through.
   * @param conversationId - Target conversation.
   * @param attachment - The attachment to send.
   * @param options - Optional text, thread ID, and progress callback.
   * @returns Delivery result from the adapter.
   */
  async send(
    plugin: ChannelPlugin,
    conversationId: string,
    attachment: OutboundAttachment,
    options?: {
      text?: string;
      threadId?: string;
      onProgress?: MediaProgressCallback;
      cacheKey?: string;
    },
  ): Promise<{
    ok: boolean;
    messageId?: string;
    error?: string;
  }> {
    const validation = this.validateForPlugin(attachment, plugin);
    if (!validation.valid) {
      this.logger.warn(
        `Media validation failed for ${plugin.id}: ${validation.reason}`,
      );
      return { ok: false, error: validation.reason };
    }

    if (!plugin.sendMedia) {
      this.logger.warn(
        `Channel "${plugin.id}" declares media support but has no sendMedia method.`,
      );
      return {
        ok: false,
        error: `Channel "${plugin.id}" does not implement sendMedia.`,
      };
    }

    this.logger.debug(
      `Sending media to ${plugin.id}:${conversationId} ` +
        `(${attachment.filename}, ${validation.mimeType ?? 'unknown'}, ${attachment.buffer ? formatBytes(attachment.buffer.byteLength) : 'stream'})`,
    );

    this.emitProgress(options?.onProgress, {
      operation: 'upload',
      bytesTransferred: 0,
      totalBytes: attachment.buffer?.byteLength ?? 0,
      fraction: 0,
      channelId: plugin.id,
      filename: attachment.filename,
    });

    const result = await plugin.sendMedia(
      conversationId,
      attachment,
      { text: options?.text, threadId: options?.threadId },
    );

    this.emitProgress(options?.onProgress, {
      operation: 'upload',
      bytesTransferred: attachment.buffer?.byteLength ?? 0,
      totalBytes: attachment.buffer?.byteLength ?? 0,
      fraction: 1,
      channelId: plugin.id,
      filename: attachment.filename,
    });

    if (result.ok) {
      // Update cache on successful upload.
      if (this.cache && options?.cacheKey && result.messageId) {
        const now = new Date();
        await this.cache.set({
          key: options.cacheKey,
          channelId: plugin.id,
          platformFileId: result.messageId,
          cachedAt: now,
          expiresAt: new Date(now.getTime() + this.cacheTtlMs),
          filename: attachment.filename,
          sizeBytes: attachment.buffer?.byteLength ?? 0,
        });
      }
    } else {
      this.logger.error(
        `Media send failed for ${plugin.id}: ${result.error}`,
      );
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Download
  // -----------------------------------------------------------------------

  /**
   * Download media from a platform URL through a channel adapter.
   * The adapter handles platform-specific authentication.
   *
   * @param plugin - The channel adapter to download through.
   * @param url - The platform media URL.
   * @returns The raw media buffer.
   */
  async download(
    plugin: ChannelPlugin,
    url: string,
  ): Promise<Buffer> {
    if (!plugin.downloadMedia) {
      throw new Error(
        `Channel "${plugin.id}" does not implement downloadMedia.`,
      );
    }

    this.logger.debug(
      `Downloading media via ${plugin.id}: ${truncateUrl(url)}`,
    );

    return plugin.downloadMedia(url);
  }

  // -----------------------------------------------------------------------
  // Normalization
  // -----------------------------------------------------------------------

  /**
   * Ensure an attachment has a resolved MIME type and type classification.
   * Returns a new attachment with resolved fields if they were missing.
   */
  normalizeAttachment(
    attachment: NormalizedAttachment,
  ): NormalizedAttachment {
    if (attachment.mimeType && attachment.type !== 'file') {
      return attachment;
    }

    const mimeType =
      attachment.mimeType ??
      this.resolveMimeType(attachment.filename);
    const type = this.resolveAttachmentType(mimeType);

    return {
      ...attachment,
      mimeType: mimeType ?? attachment.mimeType,
      type,
    };
  }

  // -----------------------------------------------------------------------
  // Content Formatting: Markdown -> Channel Native
  // -----------------------------------------------------------------------

  /**
   * Convert markdown text to a channel's native format.
   *
   * Supported targets:
   * - 'slack': Slack mrkdwn (Block Kit compatible)
   * - 'discord': Discord markdown (mostly standard with some differences)
   * - 'telegram': Telegram HTML (MarkdownV2 is fragile; HTML is safer)
   * - 'plain': Strip all formatting
   *
   * Handles text chunking if the content exceeds the channel's text limit.
   */
  formatMarkdown(
    markdown: string,
    target: ChannelFormatTarget,
    maxLength?: number,
  ): ChannelFormattedContent {
    const originalLength = markdown.length;
    let converted: string;

    switch (target) {
      case 'slack':
        converted = markdownToSlackMrkdwn(markdown);
        break;
      case 'discord':
        converted = markdownToDiscord(markdown);
        break;
      case 'telegram':
        converted = markdownToTelegramHtml(markdown);
        break;
      case 'plain':
      default:
        converted = stripMarkdown(markdown);
        break;
    }

    const limit = maxLength ?? CHANNEL_TEXT_LIMITS[target] ?? 0;
    if (limit <= 0 || converted.length <= limit) {
      return {
        text: converted,
        truncated: false,
        originalLength,
        chunks: [converted],
      };
    }

    // Split into chunks.
    const chunks = splitTextIntoChunks(converted, limit);
    return {
      text: chunks[0],
      truncated: chunks.length > 1,
      originalLength,
      chunks,
    };
  }

  // -----------------------------------------------------------------------
  // Code Block Formatting
  // -----------------------------------------------------------------------

  /**
   * Format a code string as a channel-native code block with syntax
   * highlighting hints.
   *
   * @param code - The source code text.
   * @param language - Language identifier for highlighting.
   * @param target - Channel format target.
   * @returns Formatted code block string.
   */
  formatCodeBlock(
    code: string,
    language: string | undefined,
    target: ChannelFormatTarget,
  ): string {
    const lang = language ?? '';

    switch (target) {
      case 'slack':
        // Slack does not support language hints in code blocks.
        return '```\n' + code + '\n```';
      case 'discord':
        return '```' + lang + '\n' + code + '\n```';
      case 'telegram':
        if (lang) {
          return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
        }
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      case 'plain':
      default:
        return code;
    }
  }

  /**
   * Format a file's content as a code block, auto-detecting the language
   * from the filename extension.
   */
  formatFileAsCodeBlock(
    content: string,
    filename: string,
    target: ChannelFormatTarget,
  ): string {
    const language = this.resolveLanguage(filename);
    return this.formatCodeBlock(content, language, target);
  }

  // -----------------------------------------------------------------------
  // Link Preview Hints
  // -----------------------------------------------------------------------

  /**
   * Generate a link preview hint for a URL. Some channels auto-unfurl links
   * (Slack, Discord, Telegram); this method produces a formatted reference
   * for channels that do not.
   */
  formatLinkPreview(
    url: string,
    title: string | undefined,
    description: string | undefined,
    target: ChannelFormatTarget,
  ): string {
    switch (target) {
      case 'slack':
        // Slack auto-unfurls; just include the URL.
        return title ? `<${url}|${title}>` : url;
      case 'discord':
        // Discord auto-unfurls; just include the URL.
        return url;
      case 'telegram':
        if (title) {
          return `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>` +
            (description ? `\n${escapeHtml(description)}` : '');
        }
        return url;
      case 'plain':
      default:
        if (title) {
          return `${title}\n${url}` + (description ? `\n${description}` : '');
        }
        return url;
    }
  }

  // -----------------------------------------------------------------------
  // Multi-Part Message Splitting
  // -----------------------------------------------------------------------

  /**
   * Split a large text message into channel-appropriate chunks.
   * Preserves code block boundaries and avoids splitting mid-word.
   *
   * @param text - The text to split.
   * @param channelId - Target channel for limit resolution.
   * @returns Array of text chunks, each within the channel's limit.
   */
  splitMessage(text: string, channelId: ChannelId): string[] {
    const profile = this.getChannelProfile(channelId);
    if (profile.maxTextLength <= 0 || text.length <= profile.maxTextLength) {
      return [text];
    }
    return splitTextIntoChunks(text, profile.maxTextLength);
  }

  // -----------------------------------------------------------------------
  // Temporary File Management
  // -----------------------------------------------------------------------

  /**
   * Write a buffer to a temporary file and track it for cleanup.
   * Useful for adapters that require a file path instead of a buffer.
   */
  async writeTempFile(
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(
      this.tempDir,
      `wundr-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`,
    );
    await fs.promises.writeFile(tempPath, buffer);
    this.tempFiles.add(tempPath);
    return tempPath;
  }

  /**
   * Clean up all tracked temporary files.
   * Call this periodically or on shutdown.
   */
  async cleanupTempFiles(): Promise<{ cleaned: number; errors: number }> {
    let cleaned = 0;
    let errors = 0;

    for (const tempPath of this.tempFiles) {
      try {
        await fs.promises.unlink(tempPath);
        cleaned++;
      } catch (err) {
        // File may have already been deleted.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          errors++;
          this.logger.warn(`Failed to clean up temp file ${tempPath}: ${err}`);
        } else {
          cleaned++;
        }
      }
    }

    this.tempFiles.clear();
    if (cleaned > 0 || errors > 0) {
      this.logger.debug(`Temp file cleanup: ${cleaned} cleaned, ${errors} errors`);
    }
    return { cleaned, errors };
  }

  /**
   * Number of tracked temporary files awaiting cleanup.
   */
  get pendingTempFiles(): number {
    return this.tempFiles.size;
  }

  // -----------------------------------------------------------------------
  // Content Hash
  // -----------------------------------------------------------------------

  /**
   * Compute a SHA-256 content hash for a buffer.
   * Used as the cache key for deduplication.
   */
  computeHash(buffer: Buffer): string {
    return computeContentHash(buffer);
  }

  // -----------------------------------------------------------------------
  // Progress Emission
  // -----------------------------------------------------------------------

  private emitProgress(
    callback: MediaProgressCallback | undefined,
    event: MediaProgressEvent,
  ): void {
    if (!callback) {
return;
}
    try {
      callback(event);
    } catch (err) {
      this.logger.warn(
        `Progress callback error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Format Converters
// ---------------------------------------------------------------------------

/**
 * Convert standard markdown to Slack mrkdwn format.
 *
 * Key differences:
 * - Bold: **text** -> *text*
 * - Italic: *text* or _text_ -> _text_
 * - Strikethrough: ~~text~~ -> ~text~
 * - Links: [text](url) -> <url|text>
 * - Code blocks and inline code are the same.
 * - Headers become bold text.
 */
function markdownToSlackMrkdwn(md: string): string {
  let result = md;

  // Code blocks: preserve them (Slack uses the same syntax).
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Inline code: preserve.
  const inlineCode: string[] = [];
  result = result.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match);
    return `\x00IC${inlineCode.length - 1}\x00`;
  });

  // Links: [text](url) -> <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Images: ![alt](url) -> <url|alt> (Slack unfurls)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<$2|$1>');

  // Headers: # text -> *text*
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // Bold+Italic: ***text*** -> *_text_*
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '*_$1_*');

  // Bold: **text** -> *text*
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Italic: *text* -> _text_ (careful not to match bold)
  // Only convert single asterisks that are not already converted.
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Strikethrough: ~~text~~ -> ~text~
  result = result.replace(/~~(.+?)~~/g, '~$1~');

  // Blockquotes: > text -> > text (same in Slack)
  // No conversion needed.

  // Restore code blocks.
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x00CB(\d+)\x00/g, (_match, index) => {
    return codeBlocks[parseInt(index, 10)];
  });

  // Restore inline code.
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x00IC(\d+)\x00/g, (_match, index) => {
    return inlineCode[parseInt(index, 10)];
  });

  return result;
}

/**
 * Convert standard markdown to Discord markdown.
 * Discord uses a mostly-standard markdown dialect. Main differences:
 * - Headers are not rendered; convert to bold.
 * - Spoilers use ||text||.
 * - Underline uses __text__.
 * - Most other syntax is the same.
 */
function markdownToDiscord(md: string): string {
  let result = md;

  // Preserve code blocks.
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Headers -> bold (Discord does not render markdown headers in chat).
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  // Restore code blocks.
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x00CB(\d+)\x00/g, (_match, index) => {
    return codeBlocks[parseInt(index, 10)];
  });

  return result;
}

/**
 * Convert standard markdown to Telegram HTML.
 * Telegram MarkdownV2 has many escaping edge cases; HTML is more reliable.
 *
 * Supported tags: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="">, <blockquote>
 */
function markdownToTelegramHtml(md: string): string {
  let result = md;

  // Code blocks: ```lang\ncode\n``` -> <pre><code class="language-lang">code</code></pre>
  result = result.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_match, lang: string | undefined, code: string) => {
      const escaped = escapeHtml(code.replace(/\n$/, ''));
      if (lang) {
        return `<pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>`;
      }
      return `<pre><code>${escaped}</code></pre>`;
    },
  );

  // Inline code: `code` -> <code>code</code>
  result = result.replace(/`([^`]+)`/g, (_match, code: string) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Images: ![alt](url) -> <a href="url">alt</a> (images are auto-previewed)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, url: string) => {
      return `<a href="${escapeHtml(url)}">${escapeHtml(alt || url)}</a>`;
    },
  );

  // Links: [text](url) -> <a href="url">text</a>
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, url: string) => {
      return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
    },
  );

  // Headers: # text -> <b>text</b>
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Bold+Italic: ***text*** -> <b><i>text</i></b>
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');

  // Bold: **text** -> <b>text</b>
  result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Italic: *text* -> <i>text</i>
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

  // Italic: _text_ -> <i>text</i>
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<i>$1</i>');

  // Strikethrough: ~~text~~ -> <s>text</s>
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Blockquotes: > text -> <blockquote>text</blockquote>
  // Handle consecutive blockquote lines.
  result = result.replace(
    /(?:^> .+$\n?)+/gm,
    (match) => {
      const inner = match.replace(/^> /gm, '').trim();
      return `<blockquote>${inner}</blockquote>`;
    },
  );

  return result;
}

/**
 * Strip all markdown formatting, returning plain text.
 */
function stripMarkdown(md: string): string {
  let result = md;

  // Code blocks -> just the code.
  result = result.replace(/```\w*\n([\s\S]*?)```/g, '$1');

  // Inline code -> just the text.
  result = result.replace(/`([^`]+)`/g, '$1');

  // Images -> alt text or URL.
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => alt || url);

  // Links -> text (url).
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Headers -> just text.
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Bold/italic/strikethrough -> just text.
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1');
  result = result.replace(/~~(.+?)~~/g, '$1');

  // Blockquotes -> text.
  result = result.replace(/^> /gm, '');

  // Horizontal rules.
  result = result.replace(/^[-*_]{3,}$/gm, '');

  return result;
}

// ---------------------------------------------------------------------------
// Text Splitting
// ---------------------------------------------------------------------------

/**
 * Split text into chunks that fit within a character limit.
 * Respects code block boundaries and prefers breaking at line boundaries.
 */
function splitTextIntoChunks(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Check if we are inside a code block.
    const codeBlockStart = remaining.lastIndexOf('```', limit);
    const codeBlockEnd = remaining.indexOf('```', codeBlockStart + 3);

    // If a code block spans across the break point, try to break before it.
    if (
      codeBlockStart !== -1 &&
      codeBlockStart < limit &&
      (codeBlockEnd === -1 || codeBlockEnd > limit)
    ) {
      // Break before the code block if possible.
      const beforeCode = remaining.lastIndexOf('\n', codeBlockStart);
      if (beforeCode > limit * 0.3) {
        chunks.push(remaining.slice(0, beforeCode));
        remaining = remaining.slice(beforeCode + 1);
        continue;
      }
    }

    // Try to break at a double newline (paragraph boundary).
    let breakAt = remaining.lastIndexOf('\n\n', limit);
    if (breakAt > limit * 0.5) {
      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt + 2);
      continue;
    }

    // Try to break at a single newline.
    breakAt = remaining.lastIndexOf('\n', limit);
    if (breakAt > limit * 0.5) {
      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt + 1);
      continue;
    }

    // Try to break at a space.
    breakAt = remaining.lastIndexOf(' ', limit);
    if (breakAt > limit * 0.5) {
      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt + 1);
      continue;
    }

    // Hard break at the limit.
    chunks.push(remaining.slice(0, limit));
    remaining = remaining.slice(limit);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return undefined;
  }
  return filename.slice(lastDot + 1).toLowerCase();
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

function truncateUrl(url: string, maxLength = 80): string {
  if (url.length <= maxLength) {
return url;
}
  return url.slice(0, maxLength - 3) + '...';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compute a SHA-256 hash of a buffer, returned as a hex string.
 */
function computeContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
