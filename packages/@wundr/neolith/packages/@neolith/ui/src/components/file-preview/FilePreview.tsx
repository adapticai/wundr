import * as React from 'react';

import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

import { AudioPreview, type AudioPreviewProps } from './AudioPreview';
import { DocumentPreview, type DocumentPreviewProps } from './DocumentPreview';
import { GenericFilePreview, type GenericFilePreviewProps } from './GenericFilePreview';
import { ImagePreview, type ImagePreviewProps } from './ImagePreview';
import { detectFileType } from './utils';
import { VideoPreview, type VideoPreviewProps } from './VideoPreview';

export interface FilePreviewProps {
  filename: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  alt?: string;
  onDownload?: () => void;
  className?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

/**
 * Main file preview component that automatically selects the appropriate
 * preview component based on file type
 *
 * @example
 * ```tsx
 * // Image preview
 * <FilePreview
 *   filename="photo.jpg"
 *   fileUrl="/uploads/photo.jpg"
 *   fileSize={1024000}
 *   mimeType="image/jpeg"
 * />
 *
 * // Video preview
 * <FilePreview
 *   filename="video.mp4"
 *   fileUrl="/uploads/video.mp4"
 *   fileSize={5242880}
 *   mimeType="video/mp4"
 * />
 *
 * // With upload progress
 * <FilePreview
 *   filename="document.pdf"
 *   fileUrl="/uploads/document.pdf"
 *   isUploading={true}
 *   uploadProgress={45}
 * />
 *
 * // With error state
 * <FilePreview
 *   filename="file.txt"
 *   fileUrl="/uploads/file.txt"
 *   error="Upload failed. Please try again."
 * />
 * ```
 */
export const FilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (
    {
      filename,
      fileUrl,
      fileSize,
      mimeType,
      thumbnailUrl,
      alt,
      onDownload,
      className,
      isUploading = false,
      uploadProgress = 0,
      error,
    },
    ref,
  ) => {
    const fileType = detectFileType(filename, mimeType);

    // Show upload progress
    if (isUploading) {
      return (
        <div ref={ref} className={cn('rounded-lg border bg-card p-4', className)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium">{filename}</p>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} max={100} />
            <p className="text-xs text-muted-foreground">Uploading...</p>
          </div>
        </div>
      );
    }

    // Show error state
    if (error) {
      return (
        <div ref={ref} className={cn('rounded-lg border border-destructive bg-card p-4', className)}>
          <div className="space-y-2">
            <p className="truncate text-sm font-medium text-foreground">{filename}</p>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      );
    }

    // Render appropriate preview based on file type
    const commonProps = {
      filename,
      fileUrl,
      fileSize,
      onDownload,
      className,
    };

    switch (fileType) {
      case 'image':
        return (
          <ImagePreview
            ref={ref}
            {...(commonProps as ImagePreviewProps)}
            alt={alt}
          />
        );

      case 'video':
        return (
          <VideoPreview
            ref={ref}
            {...(commonProps as VideoPreviewProps)}
            thumbnailUrl={thumbnailUrl}
          />
        );

      case 'audio':
        return <AudioPreview ref={ref} {...(commonProps as AudioPreviewProps)} />;

      case 'document':
        return (
          <DocumentPreview
            ref={ref}
            {...(commonProps as DocumentPreviewProps)}
            mimeType={mimeType}
          />
        );

      case 'code':
      case 'archive':
      case 'generic':
      default:
        return (
          <GenericFilePreview
            ref={ref}
            {...(commonProps as GenericFilePreviewProps)}
            mimeType={mimeType}
          />
        );
    }
  },
);

FilePreview.displayName = 'FilePreview';

// Re-export specialized components for direct use
export { ImagePreview, VideoPreview, AudioPreview, DocumentPreview, GenericFilePreview };
export type {
  ImagePreviewProps,
  VideoPreviewProps,
  AudioPreviewProps,
  DocumentPreviewProps,
  GenericFilePreviewProps,
};
