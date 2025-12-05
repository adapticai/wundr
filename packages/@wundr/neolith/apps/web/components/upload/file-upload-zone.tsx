'use client';

import { useCallback, useState } from 'react';
import {
  useDropzone,
  type DropzoneOptions,
  type FileRejection,
} from 'react-dropzone';

import { cn } from '@/lib/utils';
import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
  formatFileSize,
  getAcceptString,
} from '@/types/upload';

import type { AcceptedFileTypes } from '@/types/upload';

/**
 * Props for the FileUploadZone component
 */
interface FileUploadZoneProps {
  /** Callback when files are selected via drop or click */
  onFilesSelected: (files: File[]) => void;
  /** Accepted file types configuration */
  accept?: AcceptedFileTypes;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files that can be selected */
  maxFiles?: number;
  /** Whether the upload zone is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Custom content to render inside the zone */
  children?: React.ReactNode;
}

export function FileUploadZone({
  onFilesSelected,
  accept,
  maxSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
  className,
  children,
}: FileUploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        const errorCode = rejection.errors[0]?.code;

        if (errorCode === 'file-too-large') {
          setError(
            `File is too large. Maximum size is ${formatFileSize(maxSize)}.`
          );
        } else if (errorCode === 'file-invalid-type') {
          setError('File type not supported.');
        } else if (errorCode === 'too-many-files') {
          setError(`Too many files. Maximum is ${maxFiles} files.`);
        } else {
          setError('Invalid file.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [maxSize, maxFiles, onFilesSelected]
  );

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: accept ? { '*/*': getAcceptString(accept).split(',') } : undefined,
    maxSize,
    maxFiles,
    disabled,
    multiple: maxFiles > 1,
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone(dropzoneOptions);

  const acceptTypes = accept
    ? Object.entries(accept)
        .filter(([, enabled]) => enabled)
        .map(([type]) => type)
        .join(', ')
    : 'all files';

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center',
          'rounded-lg border-2 border-dashed p-8',
          'transition-all duration-200 ease-in-out',
          'cursor-pointer',
          'hover:border-primary/50 hover:bg-accent/50',
          {
            'border-muted-foreground/25 bg-background': !isDragActive,
            'border-primary bg-primary/5': isDragActive && isDragAccept,
            'border-destructive bg-destructive/5': isDragReject,
            'cursor-not-allowed opacity-50': disabled,
          }
        )}
      >
        <input {...getInputProps()} aria-label='File upload input' />

        {children || (
          <>
            {/* Upload Icon */}
            <div
              className={cn(
                'mb-4 rounded-full p-4',
                'bg-stone-100 dark:bg-stone-800 transition-colors duration-200',
                {
                  'bg-primary/10': isDragActive && isDragAccept,
                  'bg-destructive/10': isDragReject,
                }
              )}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className={cn('h-8 w-8 text-muted-foreground', {
                  'text-primary': isDragActive && isDragAccept,
                  'text-destructive': isDragReject,
                })}
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='17 8 12 3 7 8' />
                <line x1='12' x2='12' y1='3' y2='15' />
              </svg>
            </div>

            {/* Instructions */}
            <div className='text-center'>
              {isDragActive ? (
                <p className='text-lg font-medium font-heading'>
                  {isDragAccept ? 'Drop files here' : 'File type not supported'}
                </p>
              ) : (
                <>
                  <p className='text-lg font-medium font-heading'>
                    Drag and drop files here, or{' '}
                    <span className='text-primary'>click to browse</span>
                  </p>
                  <p className='mt-2 text-sm text-muted-foreground font-sans'>
                    Accepts {acceptTypes} up to {formatFileSize(maxSize)}
                  </p>
                  {maxFiles > 1 && (
                    <p className='text-sm text-muted-foreground font-sans'>
                      Maximum {maxFiles} files at once
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          className='mt-2 flex items-center gap-2 text-sm text-destructive font-sans'
          role='alert'
          aria-live='polite'
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='12' cy='12' r='10' />
            <line x1='12' x2='12' y1='8' y2='12' />
            <line x1='12' x2='12.01' y1='16' y2='16' />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
