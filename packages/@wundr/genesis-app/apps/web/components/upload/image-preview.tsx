'use client';

import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/upload';

/**
 * Props for the ImagePreview component
 */
interface ImagePreviewProps {
  /** The File object to preview */
  file: File;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Callback when the preview is clicked */
  onClick?: () => void;
  /** Whether to show file info (name, size) */
  showInfo?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export function ImagePreview({
  file,
  onRemove,
  onClick,
  showInfo = true,
  className,
}: ImagePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!file.type.startsWith('image/')) {
      setError(true);
      setIsLoading(false);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setError(true);
  }, []);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2',
        className,
      )}
    >
      {/* Image Container */}
      <div
        className="relative aspect-square"
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {/* Loading Placeholder */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2 h-8 w-8 text-muted-foreground"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="text-xs text-muted-foreground">Preview unavailable</span>
          </div>
        )}

        {/* Preview Image */}
        {preview && !error && (
          <img
            src={preview}
            alt={file.name}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100',
            )}
          />
        )}

        {/* Hover Overlay with Zoom Icon */}
        {onClick && !isLoading && !error && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/40 opacity-0 transition-opacity duration-200',
              'group-hover:opacity-100',
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M11 8v6" />
              <path d="M8 11h6" />
            </svg>
          </div>
        )}
      </div>

      {/* File Info */}
      {showInfo && (
        <div className="border-t p-2">
          <p className="truncate text-xs font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        </div>
      )}

      {/* Remove Button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'absolute right-1 top-1 rounded-full p-1',
            'bg-black/50 text-white backdrop-blur-sm',
            'opacity-0 transition-opacity duration-200',
            'hover:bg-black/70',
            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white',
            'group-hover:opacity-100',
          )}
          aria-label={`Remove ${file.name}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Props for the ImagePreviewGrid component
 */
interface ImagePreviewGridProps {
  /** Array of File objects to preview */
  files: File[];
  /** Callback when a file is removed (receives index) */
  onRemove?: (index: number) => void;
  /** Callback when an image is clicked (receives index) */
  onImageClick?: (index: number) => void;
  /** Number of columns in the grid */
  columns?: 2 | 3 | 4;
  /** Optional CSS class name */
  className?: string;
}

export function ImagePreviewGrid({
  files,
  onRemove,
  onImageClick,
  columns = 3,
  className,
}: ImagePreviewGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-3', gridCols[columns], className)}>
      {files.map((file, index) => (
        <ImagePreview
          key={`${file.name}-${index}`}
          file={file}
          onRemove={onRemove ? () => onRemove(index) : undefined}
          onClick={onImageClick ? () => onImageClick(index) : undefined}
        />
      ))}
    </div>
  );
}
