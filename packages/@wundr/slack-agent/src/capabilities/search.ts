/**
 * @wundr.io/slack-agent - Search Capabilities
 *
 * Implements comprehensive Slack search functionality for the VP (Virtual Principal)
 * agent, enabling search across messages, files, and users with full support for
 * Slack's advanced search query syntax.
 *
 * Features:
 * - Message search with full-text and metadata filtering
 * - File search by name, type, and uploader
 * - User search by name, email, and title
 * - Advanced search modifiers (from:, in:, has:, etc.)
 * - Pagination support for large result sets
 * - Result highlighting for matched terms
 *
 * @packageDocumentation
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Sort direction for search results
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort field for message search
 */
export type MessageSortField = 'score' | 'timestamp';

/**
 * Sort field for file search
 */
export type FileSortField = 'score' | 'timestamp';

/**
 * Options for configuring search behavior
 */
export interface SearchOptions {
  /** Field to sort results by */
  sort?: MessageSortField | FileSortField;
  /** Sort direction */
  sortDir?: SortDirection;
  /** Number of results per page (max 100) */
  count?: number;
  /** Page number to retrieve (1-indexed) */
  page?: number;
  /** Whether to highlight matching text in results */
  highlight?: boolean;
}

/**
 * Pagination information for search results
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of results per page */
  perPage: number;
  /** Total number of results across all pages */
  total: number;
  /** Total number of pages available */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Generic search result container with pagination
 */
export interface SearchResult<T> {
  /** Array of matching items */
  matches: T[];
  /** Total number of matches found */
  total: number;
  /** Pagination metadata */
  pagination: PaginationInfo;
  /** The original query string */
  query: string;
}

/**
 * Slack message representation
 */
export interface Message {
  /** Message timestamp (acts as unique ID within channel) */
  ts: string;
  /** Channel ID where the message was posted */
  channel: MessageChannel;
  /** User ID who posted the message */
  user?: string;
  /** Username of the poster */
  username?: string;
  /** Message text content */
  text: string;
  /** Permalink URL to the message */
  permalink?: string;
  /** Message type */
  type: string;
  /** Unix timestamp of when message was posted */
  timestamp?: number;
  /** Whether the message is a bot message */
  isBotMessage?: boolean;
  /** Attachments included with the message */
  attachments?: MessageAttachment[];
  /** Blocks in the message */
  blocks?: MessageBlock[];
  /** Reactions on the message */
  reactions?: Reaction[];
  /** Files attached to the message */
  files?: File[];
  /** Thread information if message is part of a thread */
  thread?: ThreadInfo;
}

/**
 * Channel information in a message
 */
export interface MessageChannel {
  /** Channel ID */
  id: string;
  /** Channel name */
  name?: string;
  /** Whether this is a private channel */
  isPrivate?: boolean;
  /** Whether this is a direct message */
  isIm?: boolean;
  /** Whether this is a multi-party direct message */
  isMpim?: boolean;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  /** Attachment ID */
  id?: number;
  /** Attachment title */
  title?: string;
  /** Attachment text */
  text?: string;
  /** Attachment fallback text */
  fallback?: string;
  /** Color bar for the attachment */
  color?: string;
  /** URL for the attachment */
  fromUrl?: string;
  /** Image URL */
  imageUrl?: string;
  /** Thumbnail URL */
  thumbUrl?: string;
}

/**
 * Message block element
 */
export interface MessageBlock {
  /** Block type */
  type: string;
  /** Block ID */
  blockId?: string;
  /** Block elements */
  elements?: unknown[];
  /** Block text */
  text?: {
    type: string;
    text: string;
  };
}

/**
 * Reaction on a message
 */
export interface Reaction {
  /** Reaction emoji name */
  name: string;
  /** Number of users who added this reaction */
  count: number;
  /** User IDs who added this reaction */
  users: string[];
}

/**
 * Thread information
 */
export interface ThreadInfo {
  /** Thread parent message timestamp */
  threadTs: string;
  /** Number of replies in the thread */
  replyCount: number;
  /** User IDs who participated in the thread */
  replyUsers: string[];
  /** Timestamp of the latest reply */
  latestReply?: string;
}

/**
 * Slack file representation
 */
export interface File {
  /** File ID */
  id: string;
  /** File name */
  name: string;
  /** File title */
  title?: string;
  /** MIME type */
  mimetype?: string;
  /** File type (extension-based) */
  filetype?: string;
  /** Human-readable file type */
  prettyType?: string;
  /** User ID who uploaded the file */
  user?: string;
  /** Username of uploader */
  username?: string;
  /** File size in bytes */
  size?: number;
  /** URL for downloading the file */
  urlPrivate?: string;
  /** URL for downloading (requires auth) */
  urlPrivateDownload?: string;
  /** Permalink to the file */
  permalink?: string;
  /** Public permalink (if file is public) */
  permalinkPublic?: string;
  /** Unix timestamp when file was created */
  created?: number;
  /** Unix timestamp when file was last modified */
  timestamp?: number;
  /** Whether file is external */
  isExternal?: boolean;
  /** Whether file is public */
  isPublic?: boolean;
  /** Whether file is starred by the user */
  isStarred?: boolean;
  /** Channels where the file was shared */
  channels?: string[];
  /** Groups where the file was shared */
  groups?: string[];
  /** Direct messages where the file was shared */
  ims?: string[];
  /** Initial comment on the file */
  initialComment?: string;
  /** Number of comments on the file */
  commentsCount?: number;
  /** Thumbnail URLs for image files */
  thumb64?: string;
  thumb80?: string;
  thumb160?: string;
  thumb360?: string;
  thumb480?: string;
  thumb720?: string;
  thumb800?: string;
  thumb960?: string;
  thumb1024?: string;
  /** Preview content for text files */
  preview?: string;
  /** Whether preview is truncated */
  previewIsTruncated?: boolean;
  /** Lines in the preview */
  lines?: number;
  /** Total lines in the file */
  linesMore?: number;
}

/**
 * Slack user representation
 */
export interface User {
  /** User ID */
  id: string;
  /** Team ID */
  teamId?: string;
  /** Username (handle) */
  name: string;
  /** Real name */
  realName?: string;
  /** Display name */
  displayName?: string;
  /** User's title/job position */
  title?: string;
  /** User's email address */
  email?: string;
  /** User's phone number */
  phone?: string;
  /** User's profile image URLs */
  profile?: UserProfile;
  /** Whether the user is an admin */
  isAdmin?: boolean;
  /** Whether the user is an owner */
  isOwner?: boolean;
  /** Whether the user is the primary owner */
  isPrimaryOwner?: boolean;
  /** Whether the user is restricted */
  isRestricted?: boolean;
  /** Whether the user is ultra-restricted (single-channel guest) */
  isUltraRestricted?: boolean;
  /** Whether the user is a bot */
  isBot?: boolean;
  /** Whether the user is the app user */
  isAppUser?: boolean;
  /** Whether the user account is deleted */
  deleted?: boolean;
  /** User's timezone */
  tz?: string;
  /** User's timezone label */
  tzLabel?: string;
  /** User's timezone offset in seconds */
  tzOffset?: number;
  /** Unix timestamp when user was last updated */
  updated?: number;
  /** User's status text */
  statusText?: string;
  /** User's status emoji */
  statusEmoji?: string;
}

/**
 * User profile information
 */
export interface UserProfile {
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** Profile image 24x24 */
  image24?: string;
  /** Profile image 32x32 */
  image32?: string;
  /** Profile image 48x48 */
  image48?: string;
  /** Profile image 72x72 */
  image72?: string;
  /** Profile image 192x192 */
  image192?: string;
  /** Profile image 512x512 */
  image512?: string;
  /** Original profile image */
  imageOriginal?: string;
  /** User's email */
  email?: string;
  /** User's phone */
  phone?: string;
  /** User's Skype handle */
  skype?: string;
}

/**
 * Combined search result for searching all content types
 */
export interface CombinedSearchResult {
  /** Message search results */
  messages: SearchResult<Message>;
  /** File search results */
  files: SearchResult<File>;
  /** The original query string */
  query: string;
}

/**
 * Search modifiers supported by Slack
 */
export interface SearchModifiers {
  /** Search in specific channel: in:channel-name */
  in?: string[];
  /** Search from specific user: from:@username */
  from?: string[];
  /** Search content with specific type: has:link, has:emoji, has:reaction */
  has?: ('link' | 'emoji' | 'reaction' | 'pin' | 'star')[];
  /** Search before date: before:YYYY-MM-DD */
  before?: string;
  /** Search after date: after:YYYY-MM-DD */
  after?: string;
  /** Search on specific date: on:YYYY-MM-DD */
  on?: string;
  /** Search during time range: during:yesterday, during:week, during:month */
  during?: 'yesterday' | 'today' | 'week' | 'month' | 'year';
  /** Exclude content from channel: -in:channel-name */
  excludeIn?: string[];
  /** Exclude content from user: -from:@username */
  excludeFrom?: string[];
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when a search operation fails
 */
export class SlackSearchError extends Error {
  public readonly code: string;
  public readonly query: string;
  public readonly originalError?: Error;

  constructor(message: string, code: string, query: string, originalError?: Error) {
    super(message);
    this.name = 'SlackSearchError';
    this.code = code;
    this.query = query;
    this.originalError = originalError;
    Object.setPrototypeOf(this, SlackSearchError.prototype);
  }
}

/**
 * Error thrown when search results cannot be parsed
 */
export class SearchResultParseError extends SlackSearchError {
  constructor(query: string, originalError?: Error) {
    super(
      `Failed to parse search results for query: ${query}`,
      'PARSE_ERROR',
      query,
      originalError,
    );
    this.name = 'SearchResultParseError';
    Object.setPrototypeOf(this, SearchResultParseError.prototype);
  }
}

/**
 * Error thrown when search rate limit is exceeded
 */
export class SearchRateLimitError extends SlackSearchError {
  public readonly retryAfter: number;

  constructor(query: string, retryAfter: number) {
    super(
      `Rate limit exceeded for search query. Retry after ${retryAfter} seconds.`,
      'RATE_LIMITED',
      query,
    );
    this.name = 'SearchRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, SearchRateLimitError.prototype);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a search query string with modifiers
 */
function buildSearchQuery(baseQuery: string, modifiers?: SearchModifiers): string {
  if (!modifiers) {
    return baseQuery;
  }

  const parts: string[] = [baseQuery];

  if (modifiers.in?.length) {
    parts.push(...modifiers.in.map((channel) => `in:${channel}`));
  }

  if (modifiers.from?.length) {
    parts.push(...modifiers.from.map((user) => `from:${user}`));
  }

  if (modifiers.has?.length) {
    parts.push(...modifiers.has.map((type) => `has:${type}`));
  }

  if (modifiers.before) {
    parts.push(`before:${modifiers.before}`);
  }

  if (modifiers.after) {
    parts.push(`after:${modifiers.after}`);
  }

  if (modifiers.on) {
    parts.push(`on:${modifiers.on}`);
  }

  if (modifiers.during) {
    parts.push(`during:${modifiers.during}`);
  }

  if (modifiers.excludeIn?.length) {
    parts.push(...modifiers.excludeIn.map((channel) => `-in:${channel}`));
  }

  if (modifiers.excludeFrom?.length) {
    parts.push(...modifiers.excludeFrom.map((user) => `-from:${user}`));
  }

  return parts.join(' ');
}

/**
 * Calculate pagination info from Slack API response
 */
function calculatePagination(
  page: number,
  perPage: number,
  total: number,
): PaginationInfo {
  const totalPages = Math.ceil(total / perPage);

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Transform Slack API message match to our Message type
 */
function transformMessageMatch(match: Record<string, unknown>): Message {
  const channel = match.channel as Record<string, unknown> | undefined;

  return {
    ts: String(match.ts ?? ''),
    channel: {
      id: String(channel?.id ?? match.channel ?? ''),
      name: channel?.name !== undefined && channel?.name !== null ? String(channel.name) : undefined,
      isPrivate: channel?.is_private === true,
      isIm: channel?.is_im === true,
      isMpim: channel?.is_mpim === true,
    },
    user: match.user !== null ? String(match.user) : undefined,
    username: match.username !== null ? String(match.username) : undefined,
    text: String(match.text ?? ''),
    permalink: match.permalink !== null ? String(match.permalink) : undefined,
    type: String(match.type ?? 'message'),
    timestamp: match.ts ? parseFloat(String(match.ts)) : undefined,
    isBotMessage: match.subtype === 'bot_message',
    attachments: Array.isArray(match.attachments)
      ? (match.attachments as Record<string, unknown>[]).map(transformAttachment)
      : undefined,
    blocks: Array.isArray(match.blocks)
      ? (match.blocks as MessageBlock[])
      : undefined,
    reactions: Array.isArray(match.reactions)
      ? (match.reactions as Reaction[])
      : undefined,
    files: Array.isArray(match.files)
      ? (match.files as Record<string, unknown>[]).map(transformFileMatch)
      : undefined,
    thread:
      match.thread_ts !== null
        ? {
            threadTs: String(match.thread_ts),
            replyCount: Number(match.reply_count ?? 0),
            replyUsers: Array.isArray(match.reply_users)
              ? (match.reply_users as string[])
              : [],
            latestReply:
              match.latest_reply !== null ? String(match.latest_reply) : undefined,
          }
        : undefined,
  };
}

/**
 * Transform attachment data
 */
function transformAttachment(attachment: Record<string, unknown>): MessageAttachment {
  return {
    id: attachment.id !== null ? Number(attachment.id) : undefined,
    title: attachment.title !== null ? String(attachment.title) : undefined,
    text: attachment.text !== null ? String(attachment.text) : undefined,
    fallback: attachment.fallback !== null ? String(attachment.fallback) : undefined,
    color: attachment.color !== null ? String(attachment.color) : undefined,
    fromUrl: attachment.from_url !== null ? String(attachment.from_url) : undefined,
    imageUrl: attachment.image_url !== null ? String(attachment.image_url) : undefined,
    thumbUrl: attachment.thumb_url !== null ? String(attachment.thumb_url) : undefined,
  };
}

/**
 * Transform Slack API file match to our File type
 */
function transformFileMatch(match: Record<string, unknown>): File {
  return {
    id: String(match.id ?? ''),
    name: String(match.name ?? ''),
    title: match.title !== null ? String(match.title) : undefined,
    mimetype: match.mimetype !== null ? String(match.mimetype) : undefined,
    filetype: match.filetype !== null ? String(match.filetype) : undefined,
    prettyType: match.pretty_type !== null ? String(match.pretty_type) : undefined,
    user: match.user !== null ? String(match.user) : undefined,
    username: match.username !== null ? String(match.username) : undefined,
    size: match.size !== null ? Number(match.size) : undefined,
    urlPrivate: match.url_private !== null ? String(match.url_private) : undefined,
    urlPrivateDownload:
      match.url_private_download !== null
        ? String(match.url_private_download)
        : undefined,
    permalink: match.permalink !== null ? String(match.permalink) : undefined,
    permalinkPublic:
      match.permalink_public !== null ? String(match.permalink_public) : undefined,
    created: match.created !== null ? Number(match.created) : undefined,
    timestamp: match.timestamp !== null ? Number(match.timestamp) : undefined,
    isExternal: match.is_external === true,
    isPublic: match.is_public === true,
    isStarred: match.is_starred === true,
    channels: Array.isArray(match.channels) ? (match.channels as string[]) : undefined,
    groups: Array.isArray(match.groups) ? (match.groups as string[]) : undefined,
    ims: Array.isArray(match.ims) ? (match.ims as string[]) : undefined,
    initialComment:
      match.initial_comment !== null ? String(match.initial_comment) : undefined,
    commentsCount: match.comments_count !== null ? Number(match.comments_count) : undefined,
    thumb64: match.thumb_64 !== null ? String(match.thumb_64) : undefined,
    thumb80: match.thumb_80 !== null ? String(match.thumb_80) : undefined,
    thumb160: match.thumb_160 !== null ? String(match.thumb_160) : undefined,
    thumb360: match.thumb_360 !== null ? String(match.thumb_360) : undefined,
    thumb480: match.thumb_480 !== null ? String(match.thumb_480) : undefined,
    thumb720: match.thumb_720 !== null ? String(match.thumb_720) : undefined,
    thumb800: match.thumb_800 !== null ? String(match.thumb_800) : undefined,
    thumb960: match.thumb_960 !== null ? String(match.thumb_960) : undefined,
    thumb1024: match.thumb_1024 !== null ? String(match.thumb_1024) : undefined,
    preview: match.preview !== null ? String(match.preview) : undefined,
    previewIsTruncated: match.preview_is_truncated === true,
    lines: match.lines !== null ? Number(match.lines) : undefined,
    linesMore: match.lines_more !== null ? Number(match.lines_more) : undefined,
  };
}

/**
 * Transform Slack API user to our User type
 */
function transformUser(member: Record<string, unknown>): User {
  const profile = member.profile as Record<string, unknown> | undefined;

  return {
    id: String(member.id ?? ''),
    teamId: member.team_id !== null ? String(member.team_id) : undefined,
    name: String(member.name ?? ''),
    realName: member.real_name !== null ? String(member.real_name) : undefined,
    displayName: profile?.display_name !== undefined && profile?.display_name !== null ? String(profile.display_name) : undefined,
    title: profile?.title !== undefined && profile?.title !== null ? String(profile.title) : undefined,
    email: profile?.email !== undefined && profile?.email !== null ? String(profile.email) : undefined,
    phone: profile?.phone !== undefined && profile?.phone !== null ? String(profile.phone) : undefined,
    profile: profile
      ? {
          firstName: profile.first_name !== null ? String(profile.first_name) : undefined,
          lastName: profile.last_name !== null ? String(profile.last_name) : undefined,
          image24: profile.image_24 !== null ? String(profile.image_24) : undefined,
          image32: profile.image_32 !== null ? String(profile.image_32) : undefined,
          image48: profile.image_48 !== null ? String(profile.image_48) : undefined,
          image72: profile.image_72 !== null ? String(profile.image_72) : undefined,
          image192: profile.image_192 !== null ? String(profile.image_192) : undefined,
          image512: profile.image_512 !== null ? String(profile.image_512) : undefined,
          imageOriginal:
            profile.image_original !== null ? String(profile.image_original) : undefined,
          email: profile.email !== null ? String(profile.email) : undefined,
          phone: profile.phone !== null ? String(profile.phone) : undefined,
          skype: profile.skype !== null ? String(profile.skype) : undefined,
        }
      : undefined,
    isAdmin: member.is_admin === true,
    isOwner: member.is_owner === true,
    isPrimaryOwner: member.is_primary_owner === true,
    isRestricted: member.is_restricted === true,
    isUltraRestricted: member.is_ultra_restricted === true,
    isBot: member.is_bot === true,
    isAppUser: member.is_app_user === true,
    deleted: member.deleted === true,
    tz: member.tz !== null ? String(member.tz) : undefined,
    tzLabel: member.tz_label !== null ? String(member.tz_label) : undefined,
    tzOffset: member.tz_offset !== null ? Number(member.tz_offset) : undefined,
    updated: member.updated !== null ? Number(member.updated) : undefined,
    statusText: profile?.status_text !== undefined && profile?.status_text !== null ? String(profile.status_text) : undefined,
    statusEmoji: profile?.status_emoji !== undefined && profile?.status_emoji !== null ? String(profile.status_emoji) : undefined,
  };
}

// =============================================================================
// SlackSearchCapability Class
// =============================================================================

/**
 * Slack search capability implementation for VP agents.
 *
 * Provides comprehensive search functionality across Slack workspaces,
 * including messages, files, and users with support for advanced search
 * modifiers and pagination.
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { SlackSearchCapability } from '@wundr.io/slack-agent/capabilities/search';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const search = new SlackSearchCapability(client);
 *
 * // Search messages
 * const messages = await search.searchMessages('project update', {
 *   sort: 'timestamp',
 *   sortDir: 'desc',
 *   count: 20,
 * });
 *
 * // Search with modifiers
 * const fromUser = await search.findMessagesFrom('U12345');
 *
 * // Search files
 * const files = await search.searchFiles('quarterly report', {
 *   count: 10,
 * });
 *
 * // Search users
 * const users = await search.searchUsers('john');
 * ```
 */
export class SlackSearchCapability {
  private readonly client: WebClient;

  /**
   * Create a new SlackSearchCapability instance
   *
   * @param client - Authenticated Slack WebClient instance
   */
  constructor(client: WebClient) {
    this.client = client;
  }

  // ===========================================================================
  // Core Search Methods
  // ===========================================================================

  /**
   * Search for messages in the Slack workspace
   *
   * @param query - Search query string (supports Slack search syntax)
   * @param options - Optional search configuration
   * @returns Search results with pagination
   * @throws {SlackSearchError} When the search fails
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = await search.searchMessages('budget');
   *
   * // Search with options
   * const results = await search.searchMessages('budget from:@john', {
   *   sort: 'timestamp',
   *   sortDir: 'desc',
   *   count: 50,
   *   highlight: true,
   * });
   * ```
   */
  async searchMessages(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    const page = options?.page ?? 1;
    const count = Math.min(options?.count ?? 20, 100);

    try {
      const response = await this.client.search.messages({
        query,
        sort: options?.sort ?? 'score',
        sort_dir: options?.sortDir ?? 'desc',
        count,
        page,
        highlight: options?.highlight ?? false,
      });

      if (!response.ok) {
        throw new SlackSearchError(
          `Slack API returned error: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN',
          query,
        );
      }

      const messages = response.messages as
        | { matches?: unknown[]; total?: number; pagination?: Record<string, unknown> }
        | undefined;

      const matches = (messages?.matches ?? []) as Record<string, unknown>[];
      const total = messages?.total ?? 0;

      return {
        matches: matches.map(transformMessageMatch),
        total,
        pagination: calculatePagination(page, count, total),
        query,
      };
    } catch (error) {
      if (error instanceof SlackSearchError) {
        throw error;
      }

      const err = error as { code?: string; retryAfter?: number; message?: string };
      if (err.code === 'slack_webapi_rate_limited_error') {
        throw new SearchRateLimitError(query, err.retryAfter ?? 60);
      }

      throw new SlackSearchError(
        `Failed to search messages: ${err.message ?? 'Unknown error'}`,
        'SEARCH_FAILED',
        query,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Search for files in the Slack workspace
   *
   * @param query - Search query string (supports Slack search syntax)
   * @param options - Optional search configuration
   * @returns Search results with pagination
   * @throws {SlackSearchError} When the search fails
   *
   * @example
   * ```typescript
   * // Search for PDFs
   * const pdfs = await search.searchFiles('type:pdf quarterly');
   *
   * // Search files from specific user
   * const userFiles = await search.searchFiles('from:@john presentation');
   * ```
   */
  async searchFiles(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult<File>> {
    const page = options?.page ?? 1;
    const count = Math.min(options?.count ?? 20, 100);

    try {
      const response = await this.client.search.files({
        query,
        sort: options?.sort ?? 'score',
        sort_dir: options?.sortDir ?? 'desc',
        count,
        page,
        highlight: options?.highlight ?? false,
      });

      if (!response.ok) {
        throw new SlackSearchError(
          `Slack API returned error: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN',
          query,
        );
      }

      const files = response.files as
        | { matches?: unknown[]; total?: number; pagination?: Record<string, unknown> }
        | undefined;

      const matches = (files?.matches ?? []) as Record<string, unknown>[];
      const total = files?.total ?? 0;

      return {
        matches: matches.map(transformFileMatch),
        total,
        pagination: calculatePagination(page, count, total),
        query,
      };
    } catch (error) {
      if (error instanceof SlackSearchError) {
        throw error;
      }

      const err = error as { code?: string; retryAfter?: number; message?: string };
      if (err.code === 'slack_webapi_rate_limited_error') {
        throw new SearchRateLimitError(query, err.retryAfter ?? 60);
      }

      throw new SlackSearchError(
        `Failed to search files: ${err.message ?? 'Unknown error'}`,
        'SEARCH_FAILED',
        query,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Search across both messages and files simultaneously
   *
   * @param query - Search query string
   * @param options - Optional search configuration
   * @returns Combined search results from messages and files
   * @throws {SlackSearchError} When either search fails
   *
   * @example
   * ```typescript
   * const results = await search.searchAll('Q4 planning');
   * console.log(`Found ${results.messages.total} messages`);
   * console.log(`Found ${results.files.total} files`);
   * ```
   */
  async searchAll(
    query: string,
    options?: SearchOptions,
  ): Promise<CombinedSearchResult> {
    const page = options?.page ?? 1;
    const count = Math.min(options?.count ?? 20, 100);

    try {
      const response = await this.client.search.all({
        query,
        sort: options?.sort ?? 'score',
        sort_dir: options?.sortDir ?? 'desc',
        count,
        page,
        highlight: options?.highlight ?? false,
      });

      if (!response.ok) {
        throw new SlackSearchError(
          `Slack API returned error: ${response.error ?? 'Unknown error'}`,
          response.error ?? 'UNKNOWN',
          query,
        );
      }

      const messages = response.messages as
        | { matches?: unknown[]; total?: number }
        | undefined;
      const files = response.files as
        | { matches?: unknown[]; total?: number }
        | undefined;

      const messageMatches = (messages?.matches ?? []) as Record<string, unknown>[];
      const messageTotal = messages?.total ?? 0;
      const fileMatches = (files?.matches ?? []) as Record<string, unknown>[];
      const fileTotal = files?.total ?? 0;

      return {
        messages: {
          matches: messageMatches.map(transformMessageMatch),
          total: messageTotal,
          pagination: calculatePagination(page, count, messageTotal),
          query,
        },
        files: {
          matches: fileMatches.map(transformFileMatch),
          total: fileTotal,
          pagination: calculatePagination(page, count, fileTotal),
          query,
        },
        query,
      };
    } catch (error) {
      if (error instanceof SlackSearchError) {
        throw error;
      }

      const err = error as { code?: string; retryAfter?: number; message?: string };
      if (err.code === 'slack_webapi_rate_limited_error') {
        throw new SearchRateLimitError(query, err.retryAfter ?? 60);
      }

      throw new SlackSearchError(
        `Failed to search all: ${err.message ?? 'Unknown error'}`,
        'SEARCH_FAILED',
        query,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Search for users in the Slack workspace
   *
   * Note: Slack doesn't have a dedicated user search API, so this uses
   * users.list and filters locally. For large workspaces, consider caching.
   *
   * @param query - Search query (matches against name, real_name, email, title)
   * @returns Array of matching users
   * @throws {SlackSearchError} When the search fails
   *
   * @example
   * ```typescript
   * // Search by name
   * const users = await search.searchUsers('john');
   *
   * // Search by email domain
   * const users = await search.searchUsers('@company.com');
   * ```
   */
  async searchUsers(query: string): Promise<User[]> {
    const normalizedQuery = query.toLowerCase().trim();

    try {
      const allUsers: User[] = [];
      let cursor: string | undefined;

      do {
        const response = await this.client.users.list({
          cursor,
          limit: 200,
        });

        if (!response.ok) {
          throw new SlackSearchError(
            `Slack API returned error: ${response.error ?? 'Unknown error'}`,
            response.error ?? 'UNKNOWN',
            query,
          );
        }

        const members = (response.members ?? []) as Record<string, unknown>[];
        const transformedUsers = members.map(transformUser);

        // Filter users that match the query
        const matchingUsers = transformedUsers.filter((user) => {
          if (user.deleted) {
            return false;
          }

          const searchableFields = [
            user.name,
            user.realName,
            user.displayName,
            user.email,
            user.title,
          ]
            .filter(Boolean)
            .map((field) => field!.toLowerCase());

          return searchableFields.some((field) => field.includes(normalizedQuery));
        });

        allUsers.push(...matchingUsers);

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      return allUsers;
    } catch (error) {
      if (error instanceof SlackSearchError) {
        throw error;
      }

      const err = error as { code?: string; retryAfter?: number; message?: string };
      if (err.code === 'slack_webapi_rate_limited_error') {
        throw new SearchRateLimitError(query, err.retryAfter ?? 60);
      }

      throw new SlackSearchError(
        `Failed to search users: ${err.message ?? 'Unknown error'}`,
        'SEARCH_FAILED',
        query,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // ===========================================================================
  // Convenience Search Methods
  // ===========================================================================

  /**
   * Find messages from a specific user
   *
   * @param userId - User ID (e.g., 'U12345') or username (e.g., '@john')
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * // By user ID
   * const messages = await search.findMessagesFrom('U12345678');
   *
   * // By username
   * const messages = await search.findMessagesFrom('@john.doe');
   * ```
   */
  async findMessagesFrom(
    userId: string,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    const fromQuery = userId.startsWith('@') ? userId : `<@${userId}>`;
    return this.searchMessages(`from:${fromQuery}`, options);
  }

  /**
   * Find messages in a specific channel
   *
   * @param channelId - Channel ID or name
   * @param query - Additional search query (optional)
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * // All messages in channel
   * const messages = await search.findMessagesIn('C12345678', '');
   *
   * // Messages containing specific text
   * const messages = await search.findMessagesIn('#engineering', 'deployment');
   * ```
   */
  async findMessagesIn(
    channelId: string,
    query?: string,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    const channelRef = channelId.startsWith('#') ? channelId : `<#${channelId}>`;
    const fullQuery = query ? `in:${channelRef} ${query}` : `in:${channelRef}`;
    return this.searchMessages(fullQuery, options);
  }

  /**
   * Find messages containing a specific URL or link
   *
   * @param url - URL to search for (partial match supported)
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * // Find messages with GitHub links
   * const messages = await search.findMessagesWithLink('github.com');
   *
   * // Find messages with specific PR
   * const messages = await search.findMessagesWithLink('github.com/org/repo/pull/123');
   * ```
   */
  async findMessagesWithLink(
    url: string,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    return this.searchMessages(`has:link ${url}`, options);
  }

  /**
   * Find recent mentions of a user
   *
   * @param userId - User ID to find mentions for (defaults to authenticated user)
   * @param options - Optional search configuration
   * @returns Array of messages mentioning the user
   *
   * @example
   * ```typescript
   * // Find mentions of current user
   * const mentions = await search.findRecentMentions();
   *
   * // Find mentions of specific user
   * const mentions = await search.findRecentMentions('U12345678');
   * ```
   */
  async findRecentMentions(
    userId?: string,
    options?: SearchOptions,
  ): Promise<Message[]> {
    let targetUserId = userId;

    // If no user ID provided, get the authenticated user's ID
    if (!targetUserId) {
      const authResponse = await this.client.auth.test();
      if (!authResponse.ok || !authResponse.user_id) {
        throw new SlackSearchError(
          'Failed to get authenticated user ID',
          'AUTH_ERROR',
          '',
        );
      }
      targetUserId = authResponse.user_id as string;
    }

    const searchOptions: SearchOptions = {
      sort: 'timestamp',
      sortDir: 'desc',
      count: 50,
      ...options,
    };

    const result = await this.searchMessages(`<@${targetUserId}>`, searchOptions);
    return result.matches;
  }

  // ===========================================================================
  // Advanced Search Methods
  // ===========================================================================

  /**
   * Search with advanced modifiers using a builder pattern
   *
   * @param baseQuery - Base search query
   * @param modifiers - Search modifiers to apply
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * const results = await search.searchWithModifiers('deployment', {
   *   from: ['@john', '@jane'],
   *   in: ['engineering', 'devops'],
   *   has: ['link', 'reaction'],
   *   after: '2024-01-01',
   *   before: '2024-06-01',
   * });
   * ```
   */
  async searchWithModifiers(
    baseQuery: string,
    modifiers: SearchModifiers,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    const fullQuery = buildSearchQuery(baseQuery, modifiers);
    return this.searchMessages(fullQuery, options);
  }

  /**
   * Search for messages during a specific time period
   *
   * @param query - Search query
   * @param period - Time period to search within
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * // Messages from yesterday
   * const results = await search.searchDuring('standup', 'yesterday');
   *
   * // Messages from this week
   * const results = await search.searchDuring('project update', 'week');
   * ```
   */
  async searchDuring(
    query: string,
    period: 'yesterday' | 'today' | 'week' | 'month' | 'year',
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    return this.searchMessages(`${query} during:${period}`, options);
  }

  /**
   * Search for messages in a date range
   *
   * @param query - Search query
   * @param after - Start date (YYYY-MM-DD format)
   * @param before - End date (YYYY-MM-DD format)
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * const results = await search.searchDateRange(
   *   'quarterly review',
   *   '2024-01-01',
   *   '2024-03-31'
   * );
   * ```
   */
  async searchDateRange(
    query: string,
    after: string,
    before: string,
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    return this.searchMessages(`${query} after:${after} before:${before}`, options);
  }

  /**
   * Search for messages with specific content types
   *
   * @param query - Search query
   * @param contentTypes - Types of content to filter by
   * @param options - Optional search configuration
   * @returns Search results with pagination
   *
   * @example
   * ```typescript
   * // Find messages with links and reactions
   * const results = await search.searchWithContent('important', ['link', 'reaction']);
   *
   * // Find pinned messages
   * const results = await search.searchWithContent('', ['pin']);
   * ```
   */
  async searchWithContent(
    query: string,
    contentTypes: ('link' | 'emoji' | 'reaction' | 'pin' | 'star')[],
    options?: SearchOptions,
  ): Promise<SearchResult<Message>> {
    const hasModifiers = contentTypes.map((type) => `has:${type}`).join(' ');
    return this.searchMessages(`${query} ${hasModifiers}`.trim(), options);
  }

  // ===========================================================================
  // Pagination Helpers
  // ===========================================================================

  /**
   * Get the next page of message search results
   *
   * @param previousResult - Previous search result to paginate from
   * @param options - Optional search configuration overrides
   * @returns Next page of results, or null if no more pages
   *
   * @example
   * ```typescript
   * let results = await search.searchMessages('project');
   * while (results.pagination.hasNextPage) {
   *   results = await search.getNextPage(results);
   *   // Process results...
   * }
   * ```
   */
  async getNextPage(
    previousResult: SearchResult<Message>,
    options?: Partial<SearchOptions>,
  ): Promise<SearchResult<Message> | null> {
    if (!previousResult.pagination.hasNextPage) {
      return null;
    }

    return this.searchMessages(previousResult.query, {
      ...options,
      page: previousResult.pagination.page + 1,
      count: previousResult.pagination.perPage,
    });
  }

  /**
   * Get all pages of results (use with caution for large result sets)
   *
   * @param query - Search query
   * @param options - Optional search configuration
   * @param maxPages - Maximum number of pages to fetch (default: 10)
   * @returns All matching messages across pages
   *
   * @example
   * ```typescript
   * // Get all results (up to 10 pages)
   * const allMessages = await search.getAllResults('from:@john', {}, 10);
   * ```
   */
  async getAllResults(
    query: string,
    options?: SearchOptions,
    maxPages: number = 10,
  ): Promise<Message[]> {
    const allMessages: Message[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore && currentPage <= maxPages) {
      const result = await this.searchMessages(query, {
        ...options,
        page: currentPage,
      });

      allMessages.push(...result.matches);
      hasMore = result.pagination.hasNextPage;
      currentPage++;
    }

    return allMessages;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a SlackSearchCapability instance
 *
 * @param client - Authenticated Slack WebClient
 * @returns Configured SlackSearchCapability instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createSlackSearchCapability } from '@wundr.io/slack-agent/capabilities/search';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const search = createSlackSearchCapability(client);
 * ```
 */
export function createSlackSearchCapability(client: WebClient): SlackSearchCapability {
  return new SlackSearchCapability(client);
}

// =============================================================================
// Default Export
// =============================================================================

export default SlackSearchCapability;
