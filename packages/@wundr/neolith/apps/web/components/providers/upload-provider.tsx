'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useFileUpload } from '@/hooks/use-upload';
import { DEFAULT_MAX_FILE_SIZE, DEFAULT_MAX_FILES } from '@/types/upload';

import type { UploadState, AcceptedFileTypes } from '@/types/upload';
import type { ReactNode } from 'react';

interface UploadContextValue {
  // Upload state
  uploads: UploadState[];
  isUploading: boolean;
  isPaused: boolean;
  progress: number;

  // Actions
  upload: (files: File[], channelId?: string) => void;
  cancel: (fileId: string) => void;
  cancelAll: () => void;
  retry: (fileId: string) => void;
  retryFailed: () => void;
  remove: (fileId: string) => void;
  clearCompleted: () => void;
  pauseAll: () => void;
  resumeAll: () => void;

  // Configuration
  setChannelId: (channelId: string | undefined) => void;
  maxSize: number;
  maxFiles: number;
  accept?: AcceptedFileTypes;

  // UI State
  isQueueVisible: boolean;
  showQueue: () => void;
  hideQueue: () => void;
  toggleQueue: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

/**
 * Props for the UploadProvider component
 */
interface UploadProviderProps {
  /** Child components */
  children: ReactNode;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files that can be uploaded */
  maxFiles?: number;
  /** Accepted file types configuration */
  accept?: AcceptedFileTypes;
  /** Callback when an upload completes successfully */
  onUploadComplete?: (fileId: string, url: string) => void;
  /** Callback when an upload fails */
  onUploadError?: (fileId: string, error: string) => void;
}

export function UploadProvider({
  children,
  maxSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  accept,
  onUploadComplete,
  onUploadError,
}: UploadProviderProps) {
  const [channelId, setChannelId] = useState<string | undefined>();
  const [isQueueVisible, setIsQueueVisible] = useState(false);

  const {
    uploads,
    isUploading,
    isPaused,
    progress,
    upload: uploadFiles,
    cancel,
    cancelAll,
    retry,
    retryFailed,
    remove,
    clearCompleted,
    pauseAll,
    resumeAll,
  } = useFileUpload({
    channelId,
    maxSize,
    maxFiles,
    accept,
    onComplete: (fileId, url) => {
      onUploadComplete?.(fileId, url);
    },
    onError: (fileId, error) => {
      onUploadError?.(fileId, error);
      // Auto-show queue on error
      setIsQueueVisible(true);
    },
  });

  const upload = useCallback(
    (files: File[], overrideChannelId?: string) => {
      if (overrideChannelId) {
        setChannelId(overrideChannelId);
      }
      uploadFiles(files);
      // Auto-show queue when files are added
      setIsQueueVisible(true);
    },
    [uploadFiles],
  );

  const showQueue = useCallback(() => setIsQueueVisible(true), []);
  const hideQueue = useCallback(() => setIsQueueVisible(false), []);
  const toggleQueue = useCallback(() => setIsQueueVisible(prev => !prev), []);

  const value = useMemo<UploadContextValue>(
    () => ({
      uploads,
      isUploading,
      isPaused,
      progress,
      upload,
      cancel,
      cancelAll,
      retry,
      retryFailed,
      remove,
      clearCompleted,
      pauseAll,
      resumeAll,
      setChannelId,
      maxSize,
      maxFiles,
      accept,
      isQueueVisible,
      showQueue,
      hideQueue,
      toggleQueue,
    }),
    [
      uploads,
      isUploading,
      isPaused,
      progress,
      upload,
      cancel,
      cancelAll,
      retry,
      retryFailed,
      remove,
      clearCompleted,
      pauseAll,
      resumeAll,
      maxSize,
      maxFiles,
      accept,
      isQueueVisible,
      showQueue,
      hideQueue,
      toggleQueue,
    ],
  );

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}

/**
 * Hook to access the upload context
 * @throws Error if used outside of UploadProvider
 */
export function useUploadContext(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadContext must be used within an UploadProvider');
  }
  return context;
}

/**
 * Hook to optionally access the upload context
 * Returns null if used outside of UploadProvider
 */
export function useOptionalUploadContext(): UploadContextValue | null {
  return useContext(UploadContext);
}
