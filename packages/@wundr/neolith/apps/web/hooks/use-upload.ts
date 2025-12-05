'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
  getFileType,
} from '@/types/upload';

import type {
  FileRecord,
  SignedUrl,
  UploadOptions,
  UploadState,
} from '@/types/upload';

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for the useFileUpload hook
 */
export interface UseFileUploadReturn {
  /** List of current uploads */
  uploads: UploadState[];
  /** Whether any file is currently uploading */
  isUploading: boolean;
  /** Overall progress percentage (0-100) */
  progress: number;
  /** Whether uploads are paused */
  isPaused: boolean;
  /** Add files to the upload queue and start uploading */
  upload: (files: File[]) => void;
  /** Cancel a specific upload */
  cancel: (fileId: string) => void;
  /** Cancel all pending/uploading uploads */
  cancelAll: () => void;
  /** Retry a specific failed upload */
  retry: (fileId: string) => void;
  /** Retry all failed uploads */
  retryFailed: () => void;
  /** Remove an upload from the list */
  remove: (fileId: string) => void;
  /** Clear all completed/failed uploads */
  clearCompleted: () => void;
  /** Pause all uploads */
  pauseAll: () => void;
  /** Resume paused uploads */
  resumeAll: () => void;
}

/**
 * Return type for the useSignedUpload hook
 */
export interface UseSignedUploadReturn {
  /** Get a signed URL for file upload */
  getUploadUrl: (filename: string, contentType: string) => Promise<SignedUrl>;
  /** Whether loading */
  isLoading: boolean;
  /** Error message if failed */
  error: string | null;
}

/**
 * Return type for the useChannelFiles hook
 */
export interface UseChannelFilesReturn {
  /** List of files in the channel */
  files: FileRecord[];
  /** Whether files are loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether there are more files to load */
  hasMore: boolean;
  /** Load more files */
  loadMore: () => void;
  /** Refresh files from the beginning */
  refresh: () => void;
}

/**
 * Generate a unique ID for tracking uploads
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing file uploads with progress tracking, cancellation, and retry support
 */
export function useFileUpload(
  options: UploadOptions = {},
): UseFileUploadReturn {
  const {
    channelId,
    maxSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    accept,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const uploadQueueRef = useRef<Map<string, AbortController>>(new Map());

  const isUploading = useMemo(
    () => uploads.some(u => u.status === 'uploading'),
    [uploads],
  );
  const progress = useMemo(
    () =>
      uploads.length > 0
        ? uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length
        : 0,
    [uploads],
  );

  /**
   * Validate file against constraints
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`;
      }

      if (accept) {
        const fileType = getFileType(file.type);
        const isAccepted =
          (accept.images && fileType === 'image') ||
          (accept.documents && fileType === 'document') ||
          (accept.videos && fileType === 'video') ||
          (accept.audio && fileType === 'audio') ||
          (accept.archives && fileType === 'archive');

        if (!isAccepted && Object.values(accept).some(Boolean)) {
          return 'File type not accepted';
        }
      }

      return null;
    },
    [maxSize, accept],
  );

  /**
   * Upload a single file
   */
  const uploadFile = useCallback(
    async (uploadState: UploadState) => {
      const abortController = new AbortController();
      uploadQueueRef.current.set(uploadState.id, abortController);

      try {
        // Update status to uploading
        setUploads(prev =>
          prev.map(u =>
            u.id === uploadState.id
              ? { ...u, status: 'uploading' as const, abortController }
              : u,
          ),
        );

        // Simulate getting a signed URL (replace with actual API call)
        const uploadUrl = '/api/upload';

        // Create form data
        const formData = new FormData();
        formData.append('file', uploadState.file);
        if (channelId) {
          formData.append('channelId', channelId);
        }

        // Perform upload with progress tracking
        const xhr = new XMLHttpRequest();

        const uploadPromise = new Promise<string>((resolve, reject) => {
          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              const percentComplete = Math.round(
                (event.loaded / event.total) * 100,
              );
              setUploads(prev =>
                prev.map(u =>
                  u.id === uploadState.id
                    ? { ...u, progress: percentComplete }
                    : u,
                ),
              );
              onProgress?.(uploadState.id, percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response.url || '');
              } catch {
                resolve('');
              }
            } else {
              let errorMessage = `Upload failed with status ${xhr.status}`;
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                if (errorResponse.error || errorResponse.message) {
                  errorMessage = errorResponse.error || errorResponse.message;
                }
              } catch {
                // Use default error message
              }
              reject(new Error(errorMessage));
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));

          xhr.open('POST', uploadUrl);
          xhr.send(formData);
        });

        // Listen for abort signal
        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
        });

        const url = await uploadPromise;

        // Update status to completed
        setUploads(prev =>
          prev.map(u =>
            u.id === uploadState.id
              ? { ...u, status: 'completed' as const, progress: 100, url }
              : u,
          ),
        );

        onComplete?.(uploadState.id, url);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        if (errorMessage === 'Upload cancelled') {
          setUploads(prev =>
            prev.map(u =>
              u.id === uploadState.id
                ? { ...u, status: 'cancelled' as const }
                : u,
            ),
          );
        } else {
          setUploads(prev =>
            prev.map(u =>
              u.id === uploadState.id
                ? { ...u, status: 'error' as const, error: errorMessage }
                : u,
            ),
          );
          onError?.(uploadState.id, errorMessage);
        }
      } finally {
        uploadQueueRef.current.delete(uploadState.id);
      }
    },
    [channelId, onProgress, onComplete, onError],
  );

  /**
   * Add files to upload queue and start uploading
   */
  const upload = useCallback(
    (files: File[]) => {
      const validFiles = files.slice(0, maxFiles);

      const newUploads: UploadState[] = validFiles.map(file => {
        const validationError = validateFile(file);

        return {
          id: generateUploadId(),
          file,
          name: file.name,
          size: file.size,
          type: getFileType(file.type),
          mimeType: file.type,
          progress: 0,
          status: validationError ? ('error' as const) : ('pending' as const),
          error: validationError || undefined,
        };
      });

      setUploads(prev => [...prev, ...newUploads]);

      // Start uploading valid files
      if (!isPaused) {
        newUploads
          .filter(u => u.status === 'pending')
          .forEach(uploadState => {
            uploadFile(uploadState);
          });
      }
    },
    [maxFiles, validateFile, isPaused, uploadFile],
  );

  /**
   * Cancel a specific upload
   */
  const cancel = useCallback((fileId: string) => {
    const controller = uploadQueueRef.current.get(fileId);
    if (controller) {
      controller.abort();
    }
    setUploads(prev =>
      prev.map(u =>
        u.id === fileId ? { ...u, status: 'cancelled' as const } : u,
      ),
    );
  }, []);

  /**
   * Cancel all uploads
   */
  const cancelAll = useCallback(() => {
    uploadQueueRef.current.forEach(controller => {
      controller.abort();
    });
    setUploads(prev =>
      prev.map(u =>
        u.status === 'uploading' || u.status === 'pending'
          ? { ...u, status: 'cancelled' as const }
          : u,
      ),
    );
  }, []);

  /**
   * Retry failed uploads
   */
  const retryFailed = useCallback(() => {
    setUploads(prev => {
      const failedUploads = prev.filter(u => u.status === 'error');
      failedUploads.forEach(uploadState => {
        uploadFile(uploadState);
      });
      return prev.map(u =>
        u.status === 'error'
          ? { ...u, status: 'pending' as const, progress: 0, error: undefined }
          : u,
      );
    });
  }, [uploadFile]);

  /**
   * Retry a specific failed upload
   */
  const retry = useCallback(
    (fileId: string) => {
      setUploads(prev => {
        const uploadState = prev.find(u => u.id === fileId);
        if (uploadState && uploadState.status === 'error') {
          uploadFile(uploadState);
          return prev.map(u =>
            u.id === fileId
              ? {
                  ...u,
                  status: 'pending' as const,
                  progress: 0,
                  error: undefined,
                }
              : u,
          );
        }
        return prev;
      });
    },
    [uploadFile],
  );

  /**
   * Remove an upload from the list
   */
  const remove = useCallback((fileId: string) => {
    const controller = uploadQueueRef.current.get(fileId);
    if (controller) {
      controller.abort();
    }
    setUploads(prev => prev.filter(u => u.id !== fileId));
  }, []);

  /**
   * Clear all completed/failed uploads
   */
  const clearCompleted = useCallback(() => {
    setUploads(prev =>
      prev.filter(u => u.status === 'uploading' || u.status === 'pending'),
    );
  }, []);

  /**
   * Pause all uploads
   */
  const pauseAll = useCallback(() => {
    setIsPaused(true);
    uploadQueueRef.current.forEach(controller => {
      controller.abort();
    });
    setUploads(prev =>
      prev.map(u =>
        u.status === 'uploading' ? { ...u, status: 'pending' as const } : u,
      ),
    );
  }, []);

  /**
   * Resume all uploads
   */
  const resumeAll = useCallback(() => {
    setIsPaused(false);
    setUploads(prev => {
      prev
        .filter(u => u.status === 'pending')
        .forEach(uploadState => {
          uploadFile(uploadState);
        });
      return prev;
    });
  }, [uploadFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      uploadQueueRef.current.forEach(controller => {
        controller.abort();
      });
    };
  }, []);

  return {
    upload,
    cancel,
    cancelAll,
    retry,
    retryFailed,
    remove,
    clearCompleted,
    pauseAll,
    resumeAll,
    uploads,
    isUploading,
    isPaused,
    progress,
  };
}

/**
 * Hook for getting signed upload URLs
 */
export function useSignedUpload(channelId: string): UseSignedUploadReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getUploadUrl = useCallback(
    async (filename: string, contentType: string): Promise<SignedUrl> => {
      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/upload/signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId,
            filename,
            contentType,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get upload URL');
        }

        const data = await response.json();
        return {
          uploadUrl: data.uploadUrl,
          fileUrl: data.fileUrl,
          expiresAt: new Date(data.expiresAt),
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get upload URL';
        setError(errorMessage);
        throw err;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [channelId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    getUploadUrl,
    isLoading,
    error,
  };
}

/**
 * Hook for fetching channel files with pagination
 */
export function useChannelFiles(channelId: string): UseChannelFilesReturn {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  const fetchFiles = useCallback(
    async (reset = false) => {
      if (isLoadingRef.current || (!hasMore && !reset)) {
        return;
      }

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          channelId,
          limit: '20',
        });

        if (!reset && cursor) {
          params.append('cursor', cursor);
        }

        const response = await fetch(`/api/files?${params}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const data = await response.json();

        if (reset) {
          setFiles(data.files);
        } else {
          setFiles(prev => [...prev, ...data.files]);
        }

        setHasMore(data.hasMore);
        setCursor(data.nextCursor);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch files';
        setError(errorMessage);
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [channelId, cursor, hasMore],
  );

  const loadMore = useCallback(() => {
    fetchFiles(false);
  }, [fetchFiles]);

  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    fetchFiles(true);
  }, [fetchFiles]);

  // Initial fetch
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    setFiles([]);
    fetchFiles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    files,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
