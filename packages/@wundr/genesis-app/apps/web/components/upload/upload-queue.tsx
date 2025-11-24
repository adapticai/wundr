'use client';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/upload';

import { UploadProgress } from './upload-progress';

import type { UploadState } from '@/types/upload';


/**
 * Props for the UploadQueue component
 */
interface UploadQueueProps {
  /** Array of upload states to display */
  uploads: UploadState[];
  /** Callback to cancel a specific upload */
  onCancel?: (id: string) => void;
  /** Callback to cancel all uploads */
  onCancelAll?: () => void;
  /** Callback to retry a failed upload */
  onRetry?: (id: string) => void;
  /** Callback to pause all uploads */
  onPauseAll?: () => void;
  /** Callback to resume all uploads */
  onResumeAll?: () => void;
  /** Whether uploads are currently paused */
  isPaused?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export function UploadQueue({
  uploads,
  onCancel,
  onCancelAll,
  onRetry,
  onPauseAll,
  onResumeAll,
  isPaused = false,
  className,
}: UploadQueueProps) {
  if (uploads.length === 0) {
    return null;
  }

  const completedCount = uploads.filter((u) => u.status === 'completed').length;
  const failedCount = uploads.filter((u) => u.status === 'error').length;
  const uploadingCount = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'pending',
  ).length;

  const totalSize = uploads.reduce((acc, u) => acc + u.size, 0);
  const completedSize = uploads
    .filter((u) => u.status === 'completed')
    .reduce((acc, u) => acc + u.size, 0);

  const overallProgress =
    uploads.length > 0
      ? uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length
      : 0;

  const isAllComplete = completedCount === uploads.length;
  const hasErrors = failedCount > 0;

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">
            {isAllComplete ? (
              'Upload Complete'
            ) : (
              <>
                Uploading {uploadingCount} of {uploads.length} files
              </>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFileSize(completedSize)} of {formatFileSize(totalSize)}
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {uploadingCount > 0 && onPauseAll && onResumeAll && (
            <button
              type="button"
              onClick={isPaused ? onResumeAll : onPauseAll}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium',
                'border border-input bg-background',
                'hover:bg-accent hover:text-accent-foreground',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
            >
              {isPaused ? 'Resume All' : 'Pause All'}
            </button>
          )}

          {uploadingCount > 0 && onCancelAll && (
            <button
              type="button"
              onClick={onCancelAll}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium',
                'border border-destructive/50 text-destructive',
                'hover:bg-destructive/10',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
            >
              Cancel All
            </button>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      {!isAllComplete && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-300 ease-out', {
                'bg-primary': !hasErrors,
                'bg-yellow-500': hasErrors && uploadingCount > 0,
                'bg-destructive': hasErrors && uploadingCount === 0,
              })}
              style={{ width: `${overallProgress}%` }}
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Status Summary */}
      {(completedCount > 0 || failedCount > 0) && (
        <div className="flex items-center gap-4 border-b px-4 py-2 text-xs">
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {completedCount} completed
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
              {failedCount} failed
            </span>
          )}
        </div>
      )}

      {/* File List */}
      <div className="max-h-64 overflow-y-auto">
        <div className="space-y-2 p-3">
          {uploads.map((upload) => (
            <UploadProgress
              key={upload.id}
              upload={upload}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
