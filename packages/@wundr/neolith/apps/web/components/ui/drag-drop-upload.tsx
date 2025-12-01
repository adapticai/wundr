/**
 * Drag and Drop Upload Component
 * Desktop-optimized file upload with drag-and-drop support
 * @module components/ui/drag-drop-upload
 */
'use client';

import { Upload, X, File, Image, Video, Music, FileText } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  error?: string;
  url?: string;
}

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileRemove?: (fileId: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  uploadedFiles?: UploadedFile[];
  showPreview?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) {
    return Image;
  }
  if (fileType.startsWith('video/')) {
    return Video;
  }
  if (fileType.startsWith('audio/')) {
    return Music;
  }
  if (fileType.startsWith('text/') || fileType.includes('document')) {
    return FileText;
  }
  return File;
};

export function DragDropUpload({
  onFilesSelected,
  onFileRemove,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  multiple = true,
  disabled = false,
  className,
  uploadedFiles = [],
  showPreview = true,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  const validateFiles = React.useCallback(
    (files: FileList | File[]): { valid: File[]; errors: string[] } => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const newErrors: string[] = [];

      // Check total file count
      const totalFiles = uploadedFiles.length + fileArray.length;
      if (totalFiles > maxFiles) {
        newErrors.push(`Maximum ${maxFiles} files allowed`);
        return { valid: validFiles, errors: newErrors };
      }

      fileArray.forEach(file => {
        // Check file size
        if (file.size > maxSize) {
          newErrors.push(
            `${file.name}: File size exceeds ${formatFileSize(maxSize)}`
          );
          return;
        }

        // Check file type
        if (accept) {
          const acceptedTypes = accept.split(',').map(t => t.trim());
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
          const isAccepted = acceptedTypes.some(
            type =>
              type === file.type ||
              type === fileExtension ||
              (type.endsWith('/*') &&
                file.type.startsWith(type.replace('/*', '')))
          );

          if (!isAccepted) {
            newErrors.push(`${file.name}: File type not accepted`);
            return;
          }
        }

        validFiles.push(file);
      });

      return { valid: validFiles, errors: newErrors };
    },
    [accept, maxSize, maxFiles, uploadedFiles.length]
  );

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const { valid, errors: validationErrors } = validateFiles(files);
      setErrors(validationErrors);

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [validateFiles, onFilesSelected]
  );

  const handleDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) {
        return;
      }

      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) {
        return;
      }

      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) {
        return;
      }

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles]
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8',
          'transition-colors cursor-pointer',
          'hover:border-primary/50 hover:bg-accent/50',
          isDragging && 'border-primary bg-accent',
          disabled &&
            'opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent',
          !isDragging && 'border-border'
        )}
      >
        <input
          ref={inputRef}
          type='file'
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className='hidden'
          aria-label='File upload input'
        />

        <div className='flex flex-col items-center justify-center text-center space-y-3'>
          <div
            className={cn(
              'p-3 rounded-full',
              isDragging ? 'bg-primary/20' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>

          <div className='space-y-1'>
            <p className='text-sm font-medium'>
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className='text-xs text-muted-foreground'>or click to browse</p>
          </div>

          <div className='text-xs text-muted-foreground space-y-1'>
            {accept && <p>Accepted: {accept}</p>}
            <p>Max size: {formatFileSize(maxSize)} per file</p>
            {maxFiles > 1 && <p>Max files: {maxFiles}</p>}
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className='rounded-md bg-destructive/10 p-3 space-y-1'>
          {errors.map((error, index) => (
            <p key={index} className='text-xs text-destructive'>
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {showPreview && uploadedFiles.length > 0 && (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>
            {uploadedFiles.length}{' '}
            {uploadedFiles.length === 1 ? 'file' : 'files'}
          </p>
          <div className='space-y-2'>
            {uploadedFiles.map(uploadedFile => {
              const FileIcon = getFileIcon(uploadedFile.file.type);
              const isComplete = uploadedFile.progress === 100;
              const hasError = !!uploadedFile.error;

              return (
                <div
                  key={uploadedFile.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-md border',
                    hasError
                      ? 'border-destructive/50 bg-destructive/5'
                      : 'border-border bg-background'
                  )}
                >
                  <FileIcon className='h-8 w-8 text-muted-foreground flex-shrink-0' />

                  <div className='flex-1 min-w-0 space-y-1'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className='text-sm font-medium truncate'>
                        {uploadedFile.file.name}
                      </p>
                      <span className='text-xs text-muted-foreground whitespace-nowrap'>
                        {formatFileSize(uploadedFile.file.size)}
                      </span>
                    </div>

                    {!isComplete && !hasError && (
                      <Progress value={uploadedFile.progress} className='h-1' />
                    )}

                    {hasError && (
                      <p className='text-xs text-destructive'>
                        {uploadedFile.error}
                      </p>
                    )}
                  </div>

                  {onFileRemove && (
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => onFileRemove(uploadedFile.id)}
                      className='h-7 w-7 flex-shrink-0'
                      aria-label='Remove file'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
