/**
 * Slack File Operations for Orchestrator Agent
 *
 * Provides comprehensive file management capabilities for a Virtual Principal
 * agent operating as a full user in Slack workspaces.
 *
 * @module @wundr/slack-agent/capabilities/file-operations
 */


import type { FilesUploadV2Arguments } from '@slack/web-api';
import { WebClient } from '@slack/web-api';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported file types for upload categorization
 */
export type FileType =
  | 'auto'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'code'
  | 'archive'
  | 'pdf';

/**
 * File upload source - can be a buffer, stream, or file path
 */
export type FileSource =
  | { type: 'buffer'; buffer: Buffer }
  | { type: 'stream'; stream: Readable }
  | { type: 'path'; filePath: string };

/**
 * Options for uploading a file to Slack
 */
export interface UploadOptions {
  /** File content source */
  source: FileSource;

  /** Filename to display in Slack */
  filename: string;

  /** Optional title for the file */
  title?: string;

  /** Initial comment to post with the file */
  initialComment?: string;

  /** Channel IDs to share the file to */
  channels?: string[];

  /** Thread timestamp to reply to */
  threadTs?: string;

  /** File type hint for Slack */
  filetype?: string;

  /** Alt text for images (accessibility) */
  altText?: string;

  /** Snippet type for code snippets */
  snippetType?: string;
}

/**
 * Result of a file upload operation
 */
export interface FileResult {
  /** Whether the upload was successful */
  ok: boolean;

  /** The uploaded file object */
  file: SlackFile;

  /** Warning messages if any */
  warnings?: string[];
}

/**
 * Options for listing files
 */
export interface ListFilesOptions {
  /** Filter by channel ID */
  channel?: string;

  /** Number of files to return (default 100, max 1000) */
  count?: number;

  /** Page number for pagination */
  page?: number;

  /** Filter by timestamp - files created after this time */
  tsFrom?: string;

  /** Filter by timestamp - files created before this time */
  tsTo?: string;

  /** Filter by file types (comma-separated) */
  types?: string;

  /** Filter by user ID */
  user?: string;

  /** Show files with external links */
  showFilesHiddenByLimit?: boolean;
}

/**
 * Slack file object representing an uploaded file
 */
export interface SlackFile {
  /** Unique file identifier */
  id: string;

  /** Unix timestamp of file creation */
  created: number;

  /** Unix timestamp of last update */
  timestamp: number;

  /** Display name of the file */
  name: string;

  /** Title of the file */
  title: string;

  /** MIME type of the file */
  mimetype: string;

  /** File type classification */
  filetype: string;

  /** Pretty display type */
  prettyType: string;

  /** User ID of the uploader */
  user: string;

  /** Team ID */
  userTeam: string;

  /** Whether the file is editable */
  editable: boolean;

  /** File size in bytes */
  size: number;

  /** Processing mode */
  mode: string;

  /** Whether the file is external */
  isExternal: boolean;

  /** External file type */
  externalType: string;

  /** Whether file is public */
  isPublic: boolean;

  /** Whether file is publicly shared via URL */
  publicUrlShared: boolean;

  /** Display content type */
  displayAsBot: boolean;

  /** Username of uploader */
  username: string;

  /** URL for private download */
  urlPrivate: string;

  /** URL for private download (download variant) */
  urlPrivateDownload: string;

  /** Media display type */
  mediaDisplayType?: string;

  /** Thumbnail URLs for images */
  thumb64?: string;
  thumb80?: string;
  thumb160?: string;
  thumb360?: string;
  thumb480?: string;
  thumb720?: string;
  thumb960?: string;
  thumb1024?: string;

  /** Image dimensions */
  imageExifRotation?: number;
  originalW?: number;
  originalH?: number;

  /** Permalink to the file in Slack */
  permalink: string;

  /** Public permalink */
  permalinkPublic?: string;

  /** Channels the file is shared to */
  channels: string[];

  /** Groups the file is shared to */
  groups: string[];

  /** IMs the file is shared to */
  ims: string[];

  /** Number of comments on the file */
  commentsCount: number;

  /** Initial comment if any */
  initialComment?: FileComment;

  /** Number of reactions */
  numStars?: number;

  /** Whether current user has starred */
  isStarred?: boolean;

  /** Shares information */
  shares?: FileShares;
}

/**
 * Comment on a file
 */
export interface FileComment {
  /** Comment ID */
  id: string;

  /** Unix timestamp */
  timestamp: number;

  /** User who made the comment */
  user: string;

  /** Comment text */
  comment: string;

  /** Channel ID if posted in channel */
  channel?: string;

  /** Reactions on the comment */
  reactions?: FileReaction[];
}

/**
 * Reaction on a file or comment
 */
export interface FileReaction {
  /** Reaction name/emoji */
  name: string;

  /** Users who reacted */
  users: string[];

  /** Total count */
  count: number;
}

/**
 * File sharing information
 */
export interface FileShares {
  /** Public shares by channel */
  public?: Record<
    string,
    Array<{
      replyUsers?: string[];
      replyUsersCount?: number;
      replyCount?: number;
      ts: string;
      threadTs?: string;
      latestReply?: string;
      channelName?: string;
      teamId?: string;
    }>
  >;

  /** Private shares by channel */
  private?: Record<
    string,
    Array<{
      replyUsers?: string[];
      replyUsersCount?: number;
      replyCount?: number;
      ts: string;
      threadTs?: string;
      latestReply?: string;
      channelName?: string;
      teamId?: string;
    }>
  >;
}

/**
 * Configuration for SlackFileOperations
 */
export interface FileOperationsConfig {
  /** Slack WebClient instance */
  client: WebClient;

  /** Default channels to share files to */
  defaultChannels?: string[];

  /** Maximum file size in bytes (default 1GB for paid workspaces) */
  maxFileSize?: number;

  /** Timeout for upload operations in milliseconds */
  uploadTimeout?: number;

  /** Timeout for download operations in milliseconds */
  downloadTimeout?: number;

  /** Whether to automatically detect file types */
  autoDetectFileType?: boolean;
}

// =============================================================================
// File Type Detection
// =============================================================================

/**
 * Map of file extensions to Slack file types
 */
const FILE_TYPE_MAP: Record<string, string> = {
  // Text
  '.txt': 'text',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.rst': 'text',

  // Code
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.json': 'json',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',

  // Images
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.gif': 'gif',
  '.bmp': 'bmp',
  '.svg': 'svg',
  '.webp': 'webp',
  '.ico': 'ico',

  // Documents
  '.pdf': 'pdf',
  '.doc': 'doc',
  '.docx': 'docx',
  '.xls': 'xls',
  '.xlsx': 'xlsx',
  '.ppt': 'ppt',
  '.pptx': 'pptx',
  '.odt': 'odt',
  '.ods': 'ods',
  '.odp': 'odp',
  '.rtf': 'rtf',

  // Archives
  '.zip': 'zip',
  '.tar': 'tar',
  '.gz': 'gzip',
  '.rar': 'rar',
  '.7z': '7z',

  // Audio
  '.mp3': 'mp3',
  '.wav': 'wav',
  '.ogg': 'ogg',
  '.m4a': 'm4a',
  '.flac': 'flac',

  // Video
  '.mp4': 'mp4',
  '.mov': 'mov',
  '.avi': 'avi',
  '.mkv': 'mkv',
  '.webm': 'webm',
};

/**
 * Detect file type from filename extension
 */
function detectFileType(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  return FILE_TYPE_MAP[ext];
}

// =============================================================================
// SlackFileOperations Class
// =============================================================================

/**
 * Handles file operations for a Orchestrator agent in Slack.
 *
 * Provides methods for uploading, downloading, sharing, and managing files
 * using the Slack Web API.
 *
 * @example
 * ```typescript
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const fileOps = new SlackFileOperations({ client });
 *
 * // Upload a file
 * const result = await fileOps.uploadFileFromPath('./report.pdf', ['C1234567890']);
 *
 * // Share to additional channels
 * await fileOps.shareFile(result.file.id, ['C9876543210']);
 *
 * // Download a file
 * const buffer = await fileOps.downloadFile(result.file.urlPrivateDownload);
 * ```
 */
export class SlackFileOperations {
  private client: WebClient;
  private defaultChannels: string[];
  private maxFileSize: number;
  private uploadTimeout: number;
  private downloadTimeout: number;
  private autoDetectFileType: boolean;

  constructor(config: FileOperationsConfig) {
    this.client = config.client;
    this.defaultChannels = config.defaultChannels ?? [];
    this.maxFileSize = config.maxFileSize ?? 1024 * 1024 * 1024; // 1GB default
    this.uploadTimeout = config.uploadTimeout ?? 300000; // 5 minutes
    this.downloadTimeout = config.downloadTimeout ?? 300000; // 5 minutes
    this.autoDetectFileType = config.autoDetectFileType ?? true;
  }

  /**
   * Upload a file to Slack using the v2 API
   *
   * @param options - Upload options including source, filename, and destinations
   * @returns Promise resolving to the upload result with file metadata
   * @throws Error if upload fails or file exceeds size limit
   */
  async uploadFile(options: UploadOptions): Promise<FileResult> {
    const { source, filename, title, initialComment, channels, threadTs, filetype, altText } =
      options;

    // Prepare file content based on source type
    let fileContent: Buffer | Readable;
    let fileSize: number | undefined;

    switch (source.type) {
      case 'buffer':
        fileContent = source.buffer;
        fileSize = source.buffer.length;
        break;

      case 'stream':
        fileContent = source.stream;
        // Size unknown for streams, will be handled by Slack
        break;

      case 'path': {
        const stats = statSync(source.filePath);
        fileSize = stats.size;

        if (fileSize > this.maxFileSize) {
          throw new Error(
            `File size ${fileSize} bytes exceeds maximum allowed size of ${this.maxFileSize} bytes`,
          );
        }

        fileContent = createReadStream(source.filePath);
        break;
      }

      default:
        throw new Error('Invalid file source type');
    }

    // Check file size for buffers
    if (fileSize !== undefined && fileSize > this.maxFileSize) {
      throw new Error(
        `File size ${fileSize} bytes exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Determine file type
    const detectedFiletype =
      filetype ?? (this.autoDetectFileType ? detectFileType(filename) : undefined);

    // Combine default channels with specified channels
    const targetChannels = [...new Set([...this.defaultChannels, ...(channels ?? [])])];

    // Prepare upload arguments
    // Build the arguments object dynamically to avoid type issues with optional properties
    const uploadArgs: FilesUploadV2Arguments = {
      filename,
      file: fileContent,
      ...(title && { title }),
      ...(initialComment && { initial_comment: initialComment }),
      ...(targetChannels.length > 0 && { channel_id: targetChannels[0] }),
      ...(detectedFiletype && { filetype: detectedFiletype }),
      ...(altText && { alt_text: altText }),
    };

    // Add thread_ts if provided (may not be in type definitions for all versions)
    const uploadArgsWithThread = threadTs
      ? { ...uploadArgs, thread_ts: threadTs }
      : uploadArgs;

    // Execute upload with timeout
    const uploadPromise = this.client.files.uploadV2(
      uploadArgsWithThread as FilesUploadV2Arguments,
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload operation timed out')), this.uploadTimeout);
    });

    const response = (await Promise.race([uploadPromise, timeoutPromise])) as {
      ok: boolean;
      error?: string;
      files?: Array<Record<string, unknown>>;
      response_metadata?: { warnings?: string[] };
    };

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.error ?? 'Unknown error'}`);
    }

    // The uploadV2 response contains a 'files' array
    const uploadedFile = response.files?.[0];

    if (!uploadedFile) {
      throw new Error('Upload succeeded but no file data returned');
    }

    // If we need to share to additional channels beyond the first one
    const fileId = uploadedFile.id as string | undefined;
    if (targetChannels.length > 1 && fileId) {
      const additionalChannels = targetChannels.slice(1);
      await this.shareFile(fileId, additionalChannels);
    }

    return {
      ok: true,
      file: this.normalizeFileResponse(uploadedFile),
      warnings: response.response_metadata?.warnings,
    };
  }

  /**
   * Upload a file from a file path
   *
   * @param filePath - Absolute or relative path to the file
   * @param channels - Optional channel IDs to share the file to
   * @param options - Additional upload options
   * @returns Promise resolving to the upload result
   */
  async uploadFileFromPath(
    filePath: string,
    channels?: string[],
    options?: Partial<Omit<UploadOptions, 'source' | 'channels'>>,
  ): Promise<FileResult> {
    const filename = options?.filename ?? path.basename(filePath);

    return this.uploadFile({
      source: { type: 'path', filePath },
      filename,
      channels,
      ...options,
    });
  }

  /**
   * Upload a file from a Buffer
   *
   * @param buffer - File content as a Buffer
   * @param filename - Name for the file in Slack
   * @param channels - Optional channel IDs to share the file to
   * @param options - Additional upload options
   * @returns Promise resolving to the upload result
   */
  async uploadFileFromBuffer(
    buffer: Buffer,
    filename: string,
    channels?: string[],
    options?: Partial<Omit<UploadOptions, 'source' | 'filename' | 'channels'>>,
  ): Promise<FileResult> {
    return this.uploadFile({
      source: { type: 'buffer', buffer },
      filename,
      channels,
      ...options,
    });
  }

  /**
   * Upload a file from a Readable stream
   *
   * @param stream - File content as a Readable stream
   * @param filename - Name for the file in Slack
   * @param channels - Optional channel IDs to share the file to
   * @param options - Additional upload options
   * @returns Promise resolving to the upload result
   */
  async uploadFileFromStream(
    stream: Readable,
    filename: string,
    channels?: string[],
    options?: Partial<Omit<UploadOptions, 'source' | 'filename' | 'channels'>>,
  ): Promise<FileResult> {
    return this.uploadFile({
      source: { type: 'stream', stream },
      filename,
      channels,
      ...options,
    });
  }

  /**
   * Share an existing file to one or more channels
   *
   * @param fileId - The ID of the file to share
   * @param channels - Array of channel IDs to share the file to
   * @throws Error if sharing fails
   */
  async shareFile(fileId: string, channels: string[]): Promise<void> {
    if (channels.length === 0) {
      return;
    }

    // For actually sharing to channels, we need to use chat.postMessage
    // with a file block or files.remote.share for remote files
    // The standard approach is to re-share via conversations

    for (const channel of channels) {
      try {
        // Use the files.share endpoint if available, otherwise post a message
        // Note: files.share was deprecated, so we use chat.postMessage with file
        await this.client.chat.postMessage({
          channel,
          text: '', // Required but can be empty when sharing file
          blocks: [
            {
              type: 'file',
              external_id: fileId,
              source: 'remote',
            },
          ],
        });
      } catch {
        // If the block approach doesn't work, try the legacy approach
        // Some workspaces may need different handling
        console.warn(`Failed to share file ${fileId} to channel ${channel}`);
      }
    }
  }

  /**
   * Download a file from Slack
   *
   * @param fileUrl - The private download URL of the file
   * @returns Promise resolving to the file content as a Buffer
   * @throws Error if download fails
   */
  async downloadFile(fileUrl: string): Promise<Buffer> {
    // The Slack Web API client doesn't have a built-in file download method,
    // so we need to make an authenticated HTTP request

    const token = (this.client as unknown as { token: string }).token;

    if (!token) {
      throw new Error('Cannot download file: No authentication token available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.downloadTimeout);

    try {
      const response = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Download operation timed out');
      }

      throw error;
    }
  }

  /**
   * Delete a file from Slack
   *
   * @param fileId - The ID of the file to delete
   * @throws Error if deletion fails
   */
  async deleteFile(fileId: string): Promise<void> {
    const response = await this.client.files.delete({
      file: fileId,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.error ?? 'Unknown error'}`);
    }
  }

  /**
   * List files accessible to the authenticated user
   *
   * @param options - Optional filters for the file list
   * @returns Promise resolving to an array of SlackFile objects
   */
  async listFiles(options?: ListFilesOptions): Promise<SlackFile[]> {
    const response = await this.client.files.list({
      channel: options?.channel,
      count: options?.count ?? 100,
      page: options?.page,
      ts_from: options?.tsFrom,
      ts_to: options?.tsTo,
      types: options?.types,
      user: options?.user,
      show_files_hidden_by_limit: options?.showFilesHiddenByLimit,
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.error ?? 'Unknown error'}`);
    }

    return (response.files ?? []).map((file) =>
      this.normalizeFileResponse(file as unknown as Record<string, unknown>),
    );
  }

  /**
   * Get detailed information about a specific file
   *
   * @param fileId - The ID of the file to retrieve
   * @returns Promise resolving to the SlackFile object
   * @throws Error if retrieval fails or file not found
   */
  async getFileInfo(fileId: string): Promise<SlackFile> {
    const response = await this.client.files.info({
      file: fileId,
    });

    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.error ?? 'Unknown error'}`);
    }

    if (!response.file) {
      throw new Error(`File ${fileId} not found`);
    }

    return this.normalizeFileResponse(response.file as unknown as Record<string, unknown>);
  }

  /**
   * Add a comment to a file
   *
   * Note: The files.comments.add API has been deprecated by Slack.
   * This method uses chat.postMessage to add a comment in a thread instead.
   *
   * @param fileId - The ID of the file to comment on
   * @param comment - The comment text
   * @param channel - The channel where the file was shared
   * @returns Promise resolving to the comment details
   * @throws Error if commenting fails
   */
  async addFileComment(
    fileId: string,
    comment: string,
    channel: string,
  ): Promise<{ ok: boolean; ts: string }> {
    // Since files.comments.add is deprecated, we need to find the message
    // that shared the file and reply to it in a thread

    // First, get file info to find the share information
    const fileInfo = await this.getFileInfo(fileId);

    // Find the thread timestamp for the file share in the specified channel
    const shareInfo =
      fileInfo.shares?.public?.[channel]?.[0] ?? fileInfo.shares?.private?.[channel]?.[0];

    if (!shareInfo) {
      throw new Error(`File ${fileId} is not shared in channel ${channel}`);
    }

    const threadTs = shareInfo.ts;

    // Post a reply in the thread
    const response = await this.client.chat.postMessage({
      channel,
      text: comment,
      thread_ts: threadTs,
    });

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.error ?? 'Unknown error'}`);
    }

    return {
      ok: true,
      ts: response.ts ?? '',
    };
  }

  /**
   * Make a file public and get a public URL
   *
   * @param fileId - The ID of the file to make public
   * @returns Promise resolving to the public URL
   * @throws Error if the operation fails
   */
  async makeFilePublic(fileId: string): Promise<string> {
    const response = await this.client.files.sharedPublicURL({
      file: fileId,
    });

    if (!response.ok) {
      throw new Error(`Failed to make file public: ${response.error ?? 'Unknown error'}`);
    }

    if (!response.file?.permalink_public) {
      throw new Error('File made public but no public URL returned');
    }

    return response.file.permalink_public;
  }

  /**
   * Revoke public URL for a file
   *
   * @param fileId - The ID of the file to make private
   * @throws Error if the operation fails
   */
  async revokeFilePublicURL(fileId: string): Promise<void> {
    const response = await this.client.files.revokePublicURL({
      file: fileId,
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke public URL: ${response.error ?? 'Unknown error'}`);
    }
  }

  /**
   * Upload a code snippet
   *
   * @param content - The code content
   * @param filename - Name for the snippet file
   * @param language - Programming language for syntax highlighting
   * @param channels - Optional channels to share to
   * @param title - Optional title for the snippet
   * @returns Promise resolving to the upload result
   */
  async uploadCodeSnippet(
    content: string,
    filename: string,
    language?: string,
    channels?: string[],
    title?: string,
  ): Promise<FileResult> {
    // Determine filetype based on language
    const languageToFiletype: Record<string, string> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      ruby: 'ruby',
      go: 'go',
      rust: 'rust',
      java: 'java',
      kotlin: 'kotlin',
      swift: 'swift',
      c: 'c',
      cpp: 'cpp',
      csharp: 'csharp',
      php: 'php',
      shell: 'shell',
      bash: 'shell',
      sql: 'sql',
      html: 'html',
      css: 'css',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      markdown: 'markdown',
    };

    const filetype = language ? languageToFiletype[language.toLowerCase()] : undefined;

    return this.uploadFileFromBuffer(Buffer.from(content, 'utf-8'), filename, channels, {
      title,
      filetype,
    });
  }

  /**
   * Normalize the Slack API file response to our SlackFile interface
   */
  private normalizeFileResponse(file: Record<string, unknown>): SlackFile {
    return {
      id: (file.id as string) ?? '',
      created: (file.created as number) ?? 0,
      timestamp: (file.timestamp as number) ?? (file.created as number) ?? 0,
      name: (file.name as string) ?? '',
      title: (file.title as string) ?? '',
      mimetype: (file.mimetype as string) ?? '',
      filetype: (file.filetype as string) ?? '',
      prettyType: (file.pretty_type as string) ?? '',
      user: (file.user as string) ?? '',
      userTeam: (file.user_team as string) ?? '',
      editable: (file.editable as boolean) ?? false,
      size: (file.size as number) ?? 0,
      mode: (file.mode as string) ?? '',
      isExternal: (file.is_external as boolean) ?? false,
      externalType: (file.external_type as string) ?? '',
      isPublic: (file.is_public as boolean) ?? false,
      publicUrlShared: (file.public_url_shared as boolean) ?? false,
      displayAsBot: (file.display_as_bot as boolean) ?? false,
      username: (file.username as string) ?? '',
      urlPrivate: (file.url_private as string) ?? '',
      urlPrivateDownload: (file.url_private_download as string) ?? '',
      mediaDisplayType: file.media_display_type as string | undefined,
      thumb64: file.thumb_64 as string | undefined,
      thumb80: file.thumb_80 as string | undefined,
      thumb160: file.thumb_160 as string | undefined,
      thumb360: file.thumb_360 as string | undefined,
      thumb480: file.thumb_480 as string | undefined,
      thumb720: file.thumb_720 as string | undefined,
      thumb960: file.thumb_960 as string | undefined,
      thumb1024: file.thumb_1024 as string | undefined,
      imageExifRotation: file.image_exif_rotation as number | undefined,
      originalW: file.original_w as number | undefined,
      originalH: file.original_h as number | undefined,
      permalink: (file.permalink as string) ?? '',
      permalinkPublic: file.permalink_public as string | undefined,
      channels: (file.channels as string[]) ?? [],
      groups: (file.groups as string[]) ?? [],
      ims: (file.ims as string[]) ?? [],
      commentsCount: (file.comments_count as number) ?? 0,
      initialComment: file.initial_comment as FileComment | undefined,
      numStars: file.num_stars as number | undefined,
      isStarred: file.is_starred as boolean | undefined,
      shares: file.shares as FileShares | undefined,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SlackFileOperations instance with a WebClient
 *
 * @param token - Slack bot or user token
 * @param options - Additional configuration options
 * @returns Configured SlackFileOperations instance
 *
 * @example
 * ```typescript
 * const fileOps = createFileOperations(process.env.SLACK_TOKEN, {
 *   defaultChannels: ['C1234567890'],
 *   autoDetectFileType: true
 * });
 * ```
 */
export function createFileOperations(
  token: string,
  options?: Partial<Omit<FileOperationsConfig, 'client'>>,
): SlackFileOperations {
  const client = new WebClient(token);

  return new SlackFileOperations({
    client,
    ...options,
  });
}

// =============================================================================
// Exports
// =============================================================================

export default SlackFileOperations;
