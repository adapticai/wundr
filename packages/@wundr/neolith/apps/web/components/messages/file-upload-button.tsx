'use client';

import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { getFileType } from '@/types/upload';

interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
}

export function FileUploadButton({
  onFilesSelected,
  disabled = false,
  multiple = true,
  accept = 'image/*,.pdf,.doc,.docx,.txt,.md',
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `${file.name}: File size exceeds ${formatBytes(maxSize)}`;
      }
      return null;
    },
    [maxSize],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validationErrors: string[] = [];
      const validFiles: File[] = [];

      // Check max files
      if (files.length > maxFiles) {
        validationErrors.push(
          `Too many files selected. Maximum is ${maxFiles}.`,
        );
        setErrors(validationErrors);
        return;
      }

      // Validate each file
      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(error);
        } else {
          validFiles.push(file);
        }
      });

      setErrors(validationErrors);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [validateFile, maxFiles, onFilesSelected],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className,
        )}
        title="Attach file"
      >
        <PlusIcon />
      </button>
      {errors.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive max-w-xs">
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="16" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
