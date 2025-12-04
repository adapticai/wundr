'use client';

import { getStorageService } from '@neolith/core/services';
import { useState, useCallback } from 'react';

import type { UploadResult } from '@neolith/core/types';

export interface FileUpload {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: UploadResult;
}

interface UseFileUploadOptions {
  workspaceId: string;
  channelId?: string;
  maxFileSize?: number;
  allowedTypes?: string[];
  onUploadComplete?: (fileId: string, result: UploadResult) => void;
  onUploadError?: (fileId: string, error: string) => void;
}

export function useFileUpload({
  workspaceId,
  channelId,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  allowedTypes,
  onUploadComplete,
  onUploadError,
}: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<Map<string, FileUpload>>(new Map());

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxFileSize) {
        return `File size exceeds maximum of ${formatBytes(maxFileSize)}`;
      }

      // Check file type
      if (allowedTypes && allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
          if (type.endsWith('/*')) {
            const prefix = type.slice(0, -2);
            return file.type.startsWith(prefix);
          }
          return file.type === type;
        });

        if (!isAllowed) {
          return 'File type not allowed';
        }
      }

      return null;
    },
    [maxFileSize, allowedTypes]
  );

  const addFiles = useCallback(
    (files: File[]): string[] => {
      const newUploads = new Map(uploads);
      const addedIds: string[] = [];

      files.forEach(file => {
        const error = validateFile(file);
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        newUploads.set(id, {
          file,
          id,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined,
        });

        addedIds.push(id);
      });

      setUploads(newUploads);
      return addedIds;
    },
    [uploads, validateFile]
  );

  const removeFile = useCallback(
    (id: string) => {
      const newUploads = new Map(uploads);
      newUploads.delete(id);
      setUploads(newUploads);
    },
    [uploads]
  );

  const uploadFile = useCallback(
    async (id: string): Promise<UploadResult | null> => {
      const upload = uploads.get(id);
      if (!upload || upload.status === 'error') {
        return null;
      }

      try {
        // Update status to uploading
        setUploads(prev => {
          const newUploads = new Map(prev);
          const current = newUploads.get(id);
          if (current) {
            newUploads.set(id, {
              ...current,
              status: 'uploading',
              progress: 0,
            });
          }
          return newUploads;
        });

        // Get storage service
        const storage = getStorageService();

        // Generate S3 key
        const key = storage.generateKey({
          workspaceId,
          channelId,
          filename: upload.file.name,
        });

        // Convert File to Buffer
        const arrayBuffer = await upload.file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Simulate progress (in production, use presigned URL with progress tracking)
        const progressInterval = setInterval(() => {
          setUploads(prev => {
            const newUploads = new Map(prev);
            const current = newUploads.get(id);
            if (current && current.status === 'uploading') {
              const newProgress = Math.min(current.progress + 10, 90);
              newUploads.set(id, { ...current, progress: newProgress });
            }
            return newUploads;
          });
        }, 200);

        // Upload to S3
        const result = await storage.uploadBuffer(buffer, {
          key,
          contentType: upload.file.type,
          filename: upload.file.name,
        });

        clearInterval(progressInterval);

        // Update status to success
        setUploads(prev => {
          const newUploads = new Map(prev);
          newUploads.set(id, {
            ...upload,
            status: 'success',
            progress: 100,
            result,
          });
          return newUploads;
        });

        onUploadComplete?.(id, result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        setUploads(prev => {
          const newUploads = new Map(prev);
          newUploads.set(id, {
            ...upload,
            status: 'error',
            error: errorMessage,
          });
          return newUploads;
        });

        onUploadError?.(id, errorMessage);
        return null;
      }
    },
    [uploads, workspaceId, channelId, onUploadComplete, onUploadError]
  );

  const uploadAll = useCallback(async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    const uploadPromises: Promise<UploadResult | null>[] = [];

    uploads.forEach(upload => {
      if (upload.status === 'pending') {
        uploadPromises.push(uploadFile(upload.id));
      }
    });

    const uploadResults = await Promise.all(uploadPromises);
    uploadResults.forEach(result => {
      if (result) {
        results.push(result);
      }
    });

    return results;
  }, [uploads, uploadFile]);

  const clearAll = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    addFiles,
    removeFile,
    uploadFile,
    uploadAll,
    clearAll,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
