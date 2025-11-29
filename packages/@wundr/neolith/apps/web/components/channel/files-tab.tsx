'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Image, Video, Music, Archive, File, Download, ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * File item type
 */
interface FileItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    displayName?: string;
    avatarUrl?: string;
    isOrchestrator?: boolean;
  };
}

/**
 * File type filter
 */
type FileTypeFilter = 'all' | 'image' | 'document' | 'video' | 'audio' | 'archive';

/**
 * Props for the FilesTab component
 */
interface FilesTabProps {
  channelId: string;
  className?: string;
}

/**
 * Files Tab Component
 *
 * Displays all files shared in the channel with filtering and download options.
 */
export function FilesTab({ channelId, className }: FilesTabProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileTypeFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchFiles = useCallback(async (loadMore = false) => {
    if (!channelId) return;

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (filter !== 'all') {
        params.set('type', filter);
      }
      if (loadMore && cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/channels/${channelId}/files?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const result = await response.json();
      const newFiles = result.data || [];

      if (loadMore) {
        setFiles((prev) => [...prev, ...newFiles]);
      } else {
        setFiles(newFiles);
      }

      setHasMore(result.pagination?.hasMore || false);
      setCursor(result.pagination?.nextCursor || null);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      setError(error instanceof Error ? error.message : 'Failed to load files');
      if (!loadMore) {
        setFiles([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [channelId, filter, cursor]);

  useEffect(() => {
    fetchFiles();
  }, [channelId, filter]);

  const handleFilterChange = (newFilter: FileTypeFilter) => {
    setFilter(newFilter);
    setCursor(null);
  };

  const handleLoadMore = () => {
    fetchFiles(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return Archive;
    return File;
  };

  const filters: { key: FileTypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'image', label: 'Images' },
    { key: 'document', label: 'Documents' },
    { key: 'video', label: 'Videos' },
    { key: 'audio', label: 'Audio' },
    { key: 'archive', label: 'Archives' },
  ];

  if (error && !isLoading) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center p-8', className)}>
        <div className="mb-8 rounded-full bg-destructive/10 p-6">
          <FileText className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Failed to load files</h2>
        <p className="max-w-md text-center text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => fetchFiles()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!isLoading && files.length === 0) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center p-8', className)}>
        <div className="mb-8 rounded-full bg-muted p-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">No files yet</h2>
        <p className="max-w-md text-center text-muted-foreground">
          Files shared in this channel will appear here. Share files by attaching them to messages.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Filters */}
      <div className="flex items-center gap-2 border-b px-4 py-3 overflow-x-auto">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleFilterChange(key)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Files list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              {files.map((file) => {
                const Icon = getFileIcon(file.mimeType);
                const isImage = file.mimeType.startsWith('image/');

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    {/* Thumbnail or Icon */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                      {isImage && file.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbnailUrl}
                          alt={file.originalName}
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{file.originalName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{file.uploadedBy.displayName || file.uploadedBy.name}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(file.url, '_blank')}
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = file.url;
                          link.download = file.originalName;
                          link.click();
                        }}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FilesTab;
