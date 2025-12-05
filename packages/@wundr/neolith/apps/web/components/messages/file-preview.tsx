'use client';

import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { getFileType } from '@/types/upload';

interface FileAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  mimeType: string;
}

interface FilePreviewProps {
  attachment: FileAttachment;
  onRemove?: () => void;
  onClick?: () => void;
  showRemove?: boolean;
  compact?: boolean;
  className?: string;
}

export function FilePreview({
  attachment,
  onRemove,
  onClick,
  showRemove = true,
  compact = false,
  className,
}: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  const fileCategory = getFileType(attachment.mimeType);

  useEffect(() => {
    // For images, use the attachment URL directly
    if (isImage && attachment.url) {
      setPreviewUrl(attachment.url);
      setImageError(false);
    }
    return () => {
      // No cleanup needed for URL strings
    };
  }, [isImage, attachment.url]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onClick) {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }
    },
    [onClick]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isPdf) {
      return <PdfIcon />;
    }
    switch (fileCategory) {
      case 'document':
        return <DocumentIcon />;
      case 'video':
        return <VideoIcon />;
      case 'audio':
        return <AudioIcon />;
      case 'archive':
        return <ArchiveIcon />;
      default:
        return <FileIcon />;
    }
  };

  const showImage = isImage && previewUrl && !imageError;

  if (compact) {
    return (
      <div
        className={cn(
          'group relative inline-flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 hover:bg-muted transition-colors',
          onClick && 'cursor-pointer',
          className
        )}
        onClick={handleClick}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={attachment.name}
            className='h-6 w-6 rounded object-cover'
            onError={handleImageError}
          />
        ) : (
          <div className='h-6 w-6 text-muted-foreground'>{getFileIcon()}</div>
        )}
        <div className='flex-1 min-w-0'>
          <div className='truncate text-xs font-medium'>{attachment.name}</div>
        </div>
        {showRemove && onRemove && (
          <button
            type='button'
            onClick={handleRemove}
            className='rounded-full p-0.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity'
            title='Remove file'
          >
            <CloseIcon className='h-3 w-3' />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-md border bg-muted/30 p-3 hover:bg-muted transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      {showImage ? (
        <div className='relative h-12 w-12 rounded overflow-hidden flex-shrink-0'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={attachment.name}
            className='h-full w-full object-cover'
            onError={handleImageError}
          />
        </div>
      ) : (
        <div className='h-12 w-12 flex items-center justify-center text-muted-foreground flex-shrink-0'>
          {getFileIcon()}
        </div>
      )}
      <div className='flex-1 min-w-0'>
        <div className='truncate text-sm font-medium'>{attachment.name}</div>
        <div className='text-xs text-muted-foreground'>
          {formatSize(attachment.size)}
        </div>
      </div>
      {showRemove && onRemove && (
        <button
          type='button'
          onClick={handleRemove}
          className='absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm'
          title='Remove file'
        >
          <CloseIcon className='h-3 w-3' />
        </button>
      )}
    </div>
  );
}

// Upload Preview for files being uploaded
interface UploadPreviewProps {
  file: File;
  onRemove?: () => void;
  progress?: number;
  error?: string;
  className?: string;
}

export function UploadPreview({
  file,
  onRemove,
  progress,
  error,
  className,
}: UploadPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  const fileCategory = getFileType(file.type);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setImageError(false);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    return undefined;
  }, [file, isImage]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isPdf) {
      return <PdfIcon />;
    }
    switch (fileCategory) {
      case 'document':
        return <DocumentIcon />;
      case 'video':
        return <VideoIcon />;
      case 'audio':
        return <AudioIcon />;
      case 'archive':
        return <ArchiveIcon />;
      default:
        return <FileIcon />;
    }
  };

  const showImage = isImage && previewUrl && !imageError;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-md border bg-background p-3',
        error && 'border-destructive bg-destructive/5',
        className
      )}
    >
      {showImage ? (
        <div className='relative h-12 w-12 rounded overflow-hidden flex-shrink-0'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.name}
            className='h-full w-full object-cover'
            onError={handleImageError}
          />
        </div>
      ) : (
        <div className='h-12 w-12 flex items-center justify-center text-muted-foreground flex-shrink-0'>
          {getFileIcon()}
        </div>
      )}
      <div className='flex-1 min-w-0'>
        <div className='truncate text-sm font-medium'>{file.name}</div>
        <div className='text-xs text-muted-foreground'>
          {formatSize(file.size)}
        </div>
        {progress !== undefined && !error && (
          <div className='mt-1'>
            <div className='h-1 bg-muted rounded-full overflow-hidden'>
              <div
                className='h-full bg-primary transition-all duration-300'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {error && <div className='text-xs text-destructive mt-1'>{error}</div>}
      </div>
      {onRemove && (
        <button
          type='button'
          onClick={handleRemove}
          className='absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm'
          title='Remove file'
        >
          <CloseIcon className='h-3 w-3' />
        </button>
      )}
    </div>
  );
}

// Icons
function FileIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' x2='8' y1='13' y2='13' />
      <line x1='16' x2='8' y1='17' y2='17' />
      <polyline points='10 9 9 9 8 9' />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <path d='M10 12h4' />
      <path d='M10 16h2' />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polygon points='23 7 16 12 23 17 23 7' />
      <rect width='15' height='14' x='1' y='5' rx='2' ry='2' />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M9 18V5l12-2v13' />
      <circle cx='6' cy='18' r='3' />
      <circle cx='18' cy='16' r='3' />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='21 8 21 21 3 21 3 8' />
      <rect width='18' height='5' x='3' y='3' rx='1' />
      <polyline points='10 12 14 12' />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}
