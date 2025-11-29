/**
 * File Preview Components
 *
 * A collection of components for previewing different file types
 * with download functionality and upload progress tracking.
 */

export {
  FilePreview,
  ImagePreview,
  VideoPreview,
  AudioPreview,
  DocumentPreview,
  GenericFilePreview,
  type FilePreviewProps,
  type ImagePreviewProps,
  type VideoPreviewProps,
  type AudioPreviewProps,
  type DocumentPreviewProps,
  type GenericFilePreviewProps,
} from './FilePreview';

export {
  formatFileSize,
  getFileExtension,
  detectFileType,
  isPreviewableImage,
  isPreviewableVideo,
  truncateFilename,
  type FileType,
} from './utils';
