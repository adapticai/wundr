'use client';

import React from 'react';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  X, 
  Eye, 
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileUploadItem as FileUploadItemType } from '@/hooks/use-file-upload';

interface FileUploadItemProps {
  upload: FileUploadItemType;
  onRemove: (id: string) => void;
  onPreview?: (upload: FileUploadItemType) => void;
  onRetry?: (id: string) => void;
  showPreview?: boolean;
}

export function FileUploadItem({ 
  upload, 
  onRemove, 
  onPreview, 
  onRetry,
  showPreview = true 
}: FileUploadItemProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (upload.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'uploading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const variants = {
      completed: 'default',
      processing: 'secondary',
      uploading: 'secondary',
      error: 'destructive',
      pending: 'outline'
    } as const;

    const labels = {
      completed: 'Completed',
      processing: 'Processing',
      uploading: 'Uploading',
      error: 'Failed',
      pending: 'Pending'
    };

    return (
      <Badge variant={variants[upload.status] || 'outline'}>
        {labels[upload.status] || upload.status}
      </Badge>
    );
  };

  const getFileTypeFromName = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return 'JSON';
      case 'csv':
        return 'CSV';
      case 'xlsx':
      case 'xls':
        return 'Excel';
      default:
        return ext?.toUpperCase() || 'Unknown';
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 transition-all duration-200 hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" title={upload.file.name}>
              {upload.file.name}
            </p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
              <span>{formatFileSize(upload.file.size)}</span>
              <span>•</span>
              <span>{getFileTypeFromName(upload.file.name)}</span>
              {upload.uploadedAt && (
                <>
                  <span>•</span>
                  <span>{upload.uploadedAt.toLocaleTimeString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {getStatusBadge()}
          
          {showPreview && upload.preview && onPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPreview(upload)}
              title="Preview file content"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          
          {upload.status === 'error' && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(upload.id)}
              title="Retry upload"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(upload.id)}
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {upload.status === 'uploading' && (
        <div className="space-y-2">
          <Progress value={upload.progress} className="w-full" />
          <p className="text-sm text-muted-foreground">
            Uploading... {Math.round(upload.progress)}%
          </p>
        </div>
      )}

      {/* Processing Indicator */}
      {upload.status === 'processing' && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-sm text-muted-foreground">
              Processing file content...
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {upload.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">Error</p>
          <p className="text-sm text-destructive/80 mt-1">{upload.error}</p>
        </div>
      )}

      {/* Success Message */}
      {upload.status === 'completed' && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ Upload completed successfully
            {upload.uploadedAt && ` at ${upload.uploadedAt.toLocaleTimeString()}`}
          </p>
        </div>
      )}

      {/* Preview Summary */}
      {upload.preview && (upload.status === 'completed' || upload.status === 'pending') && (
        <div className="p-3 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview Available</span>
            </div>
            {upload.preview.type === 'json' && (
              <span className="text-xs text-muted-foreground">
                {upload.preview.size} properties
              </span>
            )}
            {upload.preview.type === 'csv' && (
              <span className="text-xs text-muted-foreground">
                {upload.preview.rows} rows, {upload.preview.headers?.length} columns
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}