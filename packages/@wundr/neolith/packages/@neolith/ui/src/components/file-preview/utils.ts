/**
 * File preview utility functions
 */

/**
 * Format bytes to human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  const lastPart = parts[parts.length - 1];
  return parts.length > 1 && lastPart ? lastPart.toLowerCase() : '';
}

/**
 * Detect file type from filename or MIME type
 */
export type FileType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'code'
  | 'archive'
  | 'generic';

export function detectFileType(filename: string, mimeType?: string): FileType {
  const ext = getFileExtension(filename);

  // Check MIME type first if available
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'document';
  }

  // Image extensions
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  if (imageExts.includes(ext)) return 'image';

  // Video extensions
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
  if (videoExts.includes(ext)) return 'video';

  // Audio extensions
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
  if (audioExts.includes(ext)) return 'audio';

  // Document extensions
  const docExts = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'rtf',
    'odt',
  ];
  if (docExts.includes(ext)) return 'document';

  // Code extensions
  const codeExts = [
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'java',
    'c',
    'cpp',
    'h',
    'cs',
    'php',
    'rb',
    'go',
    'rs',
    'swift',
    'kt',
    'scala',
    'html',
    'css',
    'scss',
    'json',
    'xml',
    'yml',
    'yaml',
    'md',
    'sql',
  ];
  if (codeExts.includes(ext)) return 'code';

  // Archive extensions
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
  if (archiveExts.includes(ext)) return 'archive';

  return 'generic';
}

/**
 * Check if file is an image that can be previewed
 */
export function isPreviewableImage(
  filename: string,
  mimeType?: string
): boolean {
  return detectFileType(filename, mimeType) === 'image';
}

/**
 * Check if file is a video that can be previewed
 */
export function isPreviewableVideo(
  filename: string,
  mimeType?: string
): boolean {
  return detectFileType(filename, mimeType) === 'video';
}

/**
 * Truncate filename if too long
 */
export function truncateFilename(
  filename: string,
  maxLength: number = 40
): string {
  if (filename.length <= maxLength) return filename;

  const ext = getFileExtension(filename);
  const nameWithoutExt = filename.slice(0, -(ext.length + 1));
  const truncatedName = nameWithoutExt.slice(0, maxLength - ext.length - 4);

  return `${truncatedName}...${ext}`;
}
