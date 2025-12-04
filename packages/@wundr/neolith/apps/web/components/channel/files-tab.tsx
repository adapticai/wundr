'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { DeleteFileDialog } from './delete-file-dialog';
import { FileCard, type FileCardItem } from './file-card';
import { ShareFileDialog, type ShareFileData } from './share-file-dialog';

/**
 * File type filter
 */
type FileTypeFilter =
  | 'all'
  | 'image'
  | 'document'
  | 'video'
  | 'audio'
  | 'archive';

/**
 * Props for the FilesTab component
 */
interface FilesTabProps {
  channelId: string;
  /** The workspace slug for API calls (required for sharing) */
  workspaceSlug: string;
  /** Current user ID */
  currentUserId?: string;
  /** Current user's role in the workspace (for permission checks) */
  currentUserRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  className?: string;
  /**
   * Mode determines which API endpoint to use:
   * - 'channel': uses /api/channels/:id/files (default)
   * - 'conversation': uses /api/conversations/:id/files
   */
  mode?: 'channel' | 'conversation';
}

/**
 * Files Tab Component
 *
 * Displays all files shared in the channel or conversation with filtering and download options.
 * Supports both regular channels and DM conversations.
 * Mobile-responsive with adaptive layouts.
 */
export function FilesTab({
  channelId,
  workspaceSlug,
  currentUserId,
  currentUserRole,
  className,
  mode = 'channel',
}: FilesTabProps) {
  const [files, setFiles] = useState<FileCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileTypeFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<ShareFileData | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileCardItem | null>(null);

  // Handler to open share dialog
  const handleOpenShareDialog = useCallback((file: FileCardItem) => {
    setFileToShare({
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl ?? undefined,
      uploadedBy: {
        id: file.uploadedBy.id,
        name: file.uploadedBy.name,
        displayName: file.uploadedBy.displayName,
        avatarUrl: file.uploadedBy.avatarUrl,
      },
      uploadedAt: file.createdAt,
    });
    setShareDialogOpen(true);
  }, []);

  // Handler to open delete dialog
  const handleOpenDeleteDialog = useCallback((file: FileCardItem) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  }, []);

  // Handler to delete file
  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to delete file');
      }

      // Remove file from list
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error; // Re-throw to let dialog handle the error state
    }
  }, []);

  // Check if current user can delete a file
  const canDeleteFile = useCallback(
    (file: FileCardItem) => {
      // User can delete if they uploaded the file OR if they're an admin/owner
      const isUploader = currentUserId === file.uploadedBy.id;
      const isAdminOrOwner =
        currentUserRole === 'ADMIN' || currentUserRole === 'OWNER';
      // Note: The API will also enforce this on the backend
      return isUploader || isAdminOrOwner;
    },
    [currentUserId, currentUserRole]
  );

  const fetchFiles = useCallback(
    async (loadMore = false) => {
      if (!channelId) {
        return;
      }

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

        // Use different endpoint based on mode
        const endpoint =
          mode === 'conversation'
            ? `/api/conversations/${channelId}/files`
            : `/api/channels/${channelId}/files`;
        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const result = await response.json();
        const newFiles = result.data || [];

        if (loadMore) {
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(newFiles);
        }

        setHasMore(result.pagination?.hasMore || false);
        setCursor(result.pagination?.nextCursor || null);
      } catch (error) {
        console.error('Failed to fetch files:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to load files'
        );
        if (!loadMore) {
          setFiles([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, filter, cursor, mode]
  );

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
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center p-4 sm:p-8',
          className
        )}
      >
        <div className='mb-6 sm:mb-8 rounded-full bg-destructive/10 p-4 sm:p-6'>
          <FileText className='h-8 w-8 sm:h-12 sm:w-12 text-destructive' />
        </div>
        <h2 className='mb-2 text-lg sm:text-xl font-semibold text-center'>
          Failed to load files
        </h2>
        <p className='max-w-md text-center text-sm sm:text-base text-muted-foreground mb-4'>
          {error}
        </p>
        <Button onClick={() => fetchFiles()} variant='outline'>
          Try Again
        </Button>
      </div>
    );
  }

  const contextText = mode === 'conversation' ? 'conversation' : 'channel';

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Filters - Always show filters, scrollable on mobile */}
      <div className='flex items-center gap-1.5 sm:gap-2 border-b px-3 sm:px-4 py-2 sm:py-3 overflow-x-auto scrollbar-hide'>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => handleFilterChange(key)}
            className={cn(
              'shrink-0 rounded-md px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors',
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
      <div className='flex-1 overflow-y-auto p-3 sm:p-4'>
        {isLoading && files.length === 0 ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : files.length === 0 ? (
          /* Empty state - show within the list area, not replacing the whole component */
          <div className='flex flex-1 flex-col items-center justify-center py-12 sm:py-16 px-4'>
            <div className='mb-6 sm:mb-8 rounded-full bg-muted p-4 sm:p-6'>
              <FileText className='h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground' />
            </div>
            <h2 className='mb-2 text-lg sm:text-xl font-semibold text-center'>
              {filter === 'all' ? 'No files yet' : `No ${filter} files`}
            </h2>
            <p className='max-w-md text-center text-sm sm:text-base text-muted-foreground'>
              {filter === 'all'
                ? `Files shared in this ${contextText} will appear here. Share files by attaching them to messages.`
                : `No ${filter} files have been shared in this ${contextText} yet.`}
            </p>
          </div>
        ) : (
          <>
            <div className='grid gap-2'>
              {files.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  workspaceSlug={workspaceSlug}
                  onShare={() => handleOpenShareDialog(file)}
                  onDelete={() => handleOpenDeleteDialog(file)}
                  canDelete={canDeleteFile(file)}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className='mt-4 flex justify-center'>
                <Button
                  variant='outline'
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
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

      {/* Share File Dialog */}
      <ShareFileDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        file={fileToShare}
        workspaceSlug={workspaceSlug}
        currentUserId={currentUserId}
        onShareSuccess={destination => {
          console.log('File shared to:', destination);
          // Could add toast notification here
        }}
      />

      {/* Delete File Dialog */}
      <DeleteFileDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        file={fileToDelete}
        onConfirm={handleDeleteFile}
        canDelete={fileToDelete ? canDeleteFile(fileToDelete) : false}
      />
    </div>
  );
}

export default FilesTab;
