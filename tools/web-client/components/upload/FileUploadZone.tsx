'use client';

import React from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  maxFileSize: number;
  maxFiles: number;
  acceptedTypes: string[];
  className?: string;
  disabled?: boolean;
}

export function FileUploadZone({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  fileInputRef,
  maxFileSize,
  maxFiles,
  acceptedTypes,
  className,
  disabled = false
}: FileUploadZoneProps) {
  const formatFileSize = (bytes: number): string => {
    return `${bytes / 1024 / 1024}MB`;
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
        isDragOver 
          ? "border-primary bg-primary/5 scale-105" 
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Upload 
            className={cn(
              "h-12 w-12 text-muted-foreground transition-all duration-200",
              isDragOver && "text-primary scale-110"
            )}
          />
          {isDragOver && (
            <div className="absolute inset-0 animate-ping">
              <Upload className="h-12 w-12 text-primary opacity-20" />
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {isDragOver ? 'Drop files here' : 'Drop files here or click to browse'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {acceptedTypes.join(', ')} files • Max {formatFileSize(maxFileSize)} per file • Up to {maxFiles} files
          </p>
        </div>

        {!disabled && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="min-w-32"
              disabled={disabled}
            >
              <FileText className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={onFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </div>
  );
}