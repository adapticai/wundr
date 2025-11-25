'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/upload';

import type { FileRecord } from '@/types/upload';

/**
 * Props for the FileAttachment component
 */
interface FileAttachmentProps {
  /** The file record to display */
  file: FileRecord;
  /** Whether the current user owns this file (enables delete) */
  isOwner?: boolean;
  /** Callback when download button is clicked */
  onDownload?: () => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Callback when preview is requested */
  onPreview?: () => void;
  /** Display in compact mode */
  compact?: boolean;
  /** Optional CSS class name */
  className?: string;
}

function FileIcon({ type, mimeType }: { type: string; mimeType: string }) {
  const iconClass = 'h-5 w-5';

  if (type === 'image') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconClass, 'text-green-500')}
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  }

  if (type === 'video') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconClass, 'text-stone-500')}
      >
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
      </svg>
    );
  }

  if (type === 'audio') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconClass, 'text-orange-500')}
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }

  if (type === 'document' || mimeType.includes('pdf')) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconClass, 'text-red-500')}
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    );
  }

  if (type === 'archive') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconClass, 'text-yellow-500')}
      >
        <path d="M22 20V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2h6" />
        <circle cx="16" cy="19" r="2" />
        <path d="M16 11v-1" />
        <path d="M16 17v-4" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(iconClass, 'text-muted-foreground')}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function FileAttachment({
  file,
  isOwner = false,
  onDownload,
  onDelete,
  onPreview,
  compact = false,
  className,
}: FileAttachmentProps) {
  const [imageError, setImageError] = useState(false);
  const isImage = file.type === 'image' && !imageError;

  // Truncate filename if too long
  const truncatedName = (name: string, maxLength: number = 24) => {
    if (name.length <= maxLength) {
return name;
}
    const ext = name.split('.').pop() || '';
    const baseName = name.slice(0, name.length - ext.length - 1);
    const truncatedBase = baseName.slice(0, maxLength - ext.length - 4) + '...';
    return `${truncatedBase}.${ext}`;
  };

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-2 py-1',
          'bg-muted/50 transition-colors hover:bg-muted',
          className,
        )}
      >
        <FileIcon type={file.type} mimeType={file.mimeType} />
        <span className="text-xs font-medium">{truncatedName(file.name, 16)}</span>
        <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-lg border bg-card',
        'transition-all duration-200 hover:shadow-md',
        className,
      )}
    >
      {/* Image Preview or File Icon Header */}
      {isImage ? (
        <div
          className="relative aspect-video cursor-pointer overflow-hidden bg-muted"
          onClick={onPreview}
          onKeyDown={(e) => e.key === 'Enter' && onPreview?.()}
          role="button"
          tabIndex={0}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.thumbnailUrl || file.url}
            alt={file.name}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/30 opacity-0 transition-opacity duration-200',
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
        </div>
      ) : (
        <div className="flex items-center justify-center bg-muted/50 p-4">
          <div className="rounded-lg bg-background p-3">
            <FileIcon type={file.type} mimeType={file.mimeType} />
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium" title={file.name}>
          {truncatedName(file.name)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <div className="flex gap-1">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className={cn(
                'rounded-md p-1.5',
                'text-muted-foreground hover:bg-muted hover:text-foreground',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
              aria-label={`Download ${file.name}`}
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
            </button>
          )}

          {isImage && onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className={cn(
                'rounded-md p-1.5',
                'text-muted-foreground hover:bg-muted hover:text-foreground',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
              aria-label={`Preview ${file.name}`}
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
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
        </div>

        {isOwner && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              'rounded-md p-1.5',
              'text-destructive/70 hover:bg-destructive/10 hover:text-destructive',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            )}
            aria-label={`Delete ${file.name}`}
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the FileAttachmentList component
 */
interface FileAttachmentListProps {
  /** Array of file records to display */
  files: FileRecord[];
  /** Current user's ID for ownership checks */
  currentUserId?: string;
  /** Callback when a file download is requested */
  onDownload?: (file: FileRecord) => void;
  /** Callback when a file deletion is requested */
  onDelete?: (file: FileRecord) => void;
  /** Callback when a file preview is requested */
  onPreview?: (file: FileRecord) => void;
  /** Display layout mode */
  layout?: 'grid' | 'list';
  /** Optional CSS class name */
  className?: string;
}

export function FileAttachmentList({
  files,
  currentUserId,
  onDownload,
  onDelete,
  onPreview,
  layout = 'grid',
  className,
}: FileAttachmentListProps) {
  if (files.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-2 h-12 w-12 opacity-50"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p>No files uploaded yet</p>
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        {files.map((file) => (
          <FileAttachment
            key={file.id}
            file={file}
            compact
            isOwner={currentUserId === file.uploaderId}
            onDownload={onDownload ? () => onDownload(file) : undefined}
            onDelete={onDelete ? () => onDelete(file) : undefined}
            onPreview={onPreview ? () => onPreview(file) : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {files.map((file) => (
        <FileAttachment
          key={file.id}
          file={file}
          isOwner={currentUserId === file.uploaderId}
          onDownload={onDownload ? () => onDownload(file) : undefined}
          onDelete={onDelete ? () => onDelete(file) : undefined}
          onPreview={onPreview ? () => onPreview(file) : undefined}
        />
      ))}
    </div>
  );
}
