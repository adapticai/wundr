'use client';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/upload';

import type { UploadState } from '@/types/upload';

/**
 * Props for the UploadProgress component
 */
interface UploadProgressProps {
  /** The upload state to display */
  upload: UploadState;
  /** Callback to cancel the upload */
  onCancel?: (id: string) => void;
  /** Callback to retry a failed upload */
  onRetry?: (id: string) => void;
  /** Optional CSS class name */
  className?: string;
}

function FileTypeIcon({ type, mimeType }: { type: string; mimeType: string }) {
  const iconClass = 'h-8 w-8';

  if (type === 'image') {
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={cn(iconClass, 'text-green-500')}
      >
        <rect width='18' height='18' x='3' y='3' rx='2' ry='2' />
        <circle cx='9' cy='9' r='2' />
        <path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />
      </svg>
    );
  }

  if (type === 'video') {
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={cn(iconClass, 'text-stone-500')}
      >
        <path d='m22 8-6 4 6 4V8Z' />
        <rect width='14' height='12' x='2' y='6' rx='2' ry='2' />
      </svg>
    );
  }

  if (type === 'audio') {
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={cn(iconClass, 'text-orange-500')}
      >
        <path d='M9 18V5l12-2v13' />
        <circle cx='6' cy='18' r='3' />
        <circle cx='18' cy='16' r='3' />
      </svg>
    );
  }

  if (type === 'document' || mimeType.includes('pdf')) {
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={cn(iconClass, 'text-red-500')}
      >
        <path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' />
        <polyline points='14 2 14 8 20 8' />
        <line x1='16' x2='8' y1='13' y2='13' />
        <line x1='16' x2='8' y1='17' y2='17' />
        <line x1='10' x2='8' y1='9' y2='9' />
      </svg>
    );
  }

  if (type === 'archive') {
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={cn(iconClass, 'text-yellow-500')}
      >
        <path d='M22 20V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2h6' />
        <circle cx='16' cy='19' r='2' />
        <path d='M16 11v-1' />
        <path d='M16 17v-4' />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn(iconClass, 'text-muted-foreground')}
    >
      <path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' />
      <polyline points='14 2 14 8 20 8' />
    </svg>
  );
}

export function UploadProgress({
  upload,
  onCancel,
  onRetry,
  className,
}: UploadProgressProps) {
  const isUploading = upload.status === 'uploading';
  const isCompleted = upload.status === 'completed';
  const isError = upload.status === 'error';
  const isPending = upload.status === 'pending';
  const isCancelled = upload.status === 'cancelled';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        'bg-card transition-colors duration-200',
        {
          'border-muted': isPending || isUploading,
          'border-green-500/20 bg-green-500/5': isCompleted,
          'border-destructive/20 bg-destructive/5': isError || isCancelled,
        },
        className
      )}
    >
      {/* File Icon */}
      <div className='flex-shrink-0'>
        <FileTypeIcon type={upload.type} mimeType={upload.mimeType} />
      </div>

      {/* File Info and Progress */}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-sm font-medium' title={upload.name}>
            {upload.name}
          </p>
          {isCompleted && (
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-5 w-5 flex-shrink-0 text-green-500'
              aria-label='Upload completed'
            >
              <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
              <polyline points='22 4 12 14.01 9 11.01' />
            </svg>
          )}
        </div>

        <p className='mt-0.5 text-xs text-muted-foreground'>
          {formatFileSize(upload.size)}
        </p>

        {/* Progress Bar */}
        {(isUploading || isPending) && (
          <div className='mt-2'>
            <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-primary transition-all duration-300 ease-out'
                style={{ width: `${upload.progress}%` }}
                role='progressbar'
                aria-valuenow={upload.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {Math.round(upload.progress)}%
            </p>
          </div>
        )}

        {/* Error Message */}
        {isError && upload.error && (
          <p className='mt-1 text-xs text-destructive'>{upload.error}</p>
        )}

        {/* Cancelled State */}
        {isCancelled && (
          <p className='mt-1 text-xs text-muted-foreground'>Upload cancelled</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className='flex-shrink-0'>
        {(isUploading || isPending) && onCancel && (
          <button
            type='button'
            onClick={() => onCancel(upload.id)}
            className={cn(
              'rounded-full p-1.5',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
            aria-label='Cancel upload'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-4 w-4'
            >
              <line x1='18' x2='6' y1='6' y2='18' />
              <line x1='6' x2='18' y1='6' y2='18' />
            </svg>
          </button>
        )}

        {isError && onRetry && (
          <button
            type='button'
            onClick={() => onRetry(upload.id)}
            className={cn(
              'rounded-full p-1.5',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
            aria-label='Retry upload'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-4 w-4'
            >
              <path d='M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
              <path d='M3 3v5h5' />
              <path d='M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' />
              <path d='M16 21h5v-5' />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
