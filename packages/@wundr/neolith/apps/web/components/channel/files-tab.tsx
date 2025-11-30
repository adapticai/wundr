'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Image, Video, Music, Archive, File, Download, ExternalLink, Loader2, Forward, Bookmark, MoreHorizontal, Link2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShareFileDialog, type ShareFileData } from './share-file-dialog';
import { DeleteFileDialog } from './delete-file-dialog';

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
 */
export function FilesTab({ channelId, workspaceSlug, currentUserId, currentUserRole, className, mode = 'channel' }: FilesTabProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
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
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  // Handler to open share dialog
  const handleOpenShareDialog = useCallback((file: FileItem) => {
    setFileToShare({
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl,
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
  const handleOpenDeleteDialog = useCallback((file: FileItem) => {
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
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error; // Re-throw to let dialog handle the error state
    }
  }, []);

  // Check if current user can delete a file
  const canDeleteFile = useCallback((file: FileItem) => {
    // User can delete if they uploaded the file OR if they're an admin/owner
    const isUploader = currentUserId === file.uploadedBy.id;
    const isAdminOrOwner = currentUserRole === 'ADMIN' || currentUserRole === 'OWNER';
    // Note: The API will also enforce this on the backend
    return isUploader || isAdminOrOwner;
  }, [currentUserId, currentUserRole]);

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

      // Use different endpoint based on mode
      const endpoint = mode === 'conversation'
        ? `/api/conversations/${channelId}/files`
        : `/api/channels/${channelId}/files`;
      const response = await fetch(`${endpoint}?${params.toString()}`);
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
  }, [channelId, filter, cursor, mode]);

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

  const contextText = mode === 'conversation' ? 'conversation' : 'channel';

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Filters - Always show filters */}
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
        ) : files.length === 0 ? (
          /* Empty state - show within the list area, not replacing the whole component */
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <div className="mb-8 rounded-full bg-muted p-6">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">
              {filter === 'all' ? 'No files yet' : `No ${filter} files`}
            </h2>
            <p className="max-w-md text-center text-muted-foreground">
              {filter === 'all'
                ? `Files shared in this ${contextText} will appear here. Share files by attaching them to messages.`
                : `No ${filter} files have been shared in this ${contextText} yet.`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              {files.map((file) => {
                const Icon = getFileIcon(file.mimeType);
                const isImage = file.mimeType.startsWith('image/');
                // Use thumbnailUrl if available, otherwise use the file URL for images
                const imagePreviewUrl = file.thumbnailUrl || (isImage ? file.url : null);

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    {/* Thumbnail or Icon */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
                      {isImage && imagePreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagePreviewUrl}
                          alt={file.originalName}
                          className="h-full w-full object-cover"
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
                    <FileActions
                      file={file}
                      workspaceSlug={workspaceSlug}
                      onShare={() => handleOpenShareDialog(file)}
                      onDelete={() => handleOpenDeleteDialog(file)}
                      canDelete={canDeleteFile(file)}
                    />
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

      {/* Share File Dialog */}
      <ShareFileDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        file={fileToShare}
        workspaceSlug={workspaceSlug}
        currentUserId={currentUserId}
        onShareSuccess={(destination) => {
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

/**
 * File Actions Component
 *
 * Action buttons with dropdown menu for file operations.
 */
interface FileActionsProps {
  file: FileItem;
  workspaceSlug: string;
  onShare?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

function FileActions({ file, workspaceSlug, onShare, onDelete, canDelete = false }: FileActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(file.url);
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShare = () => {
    onShare?.();
    setShowMenu(false);
  };

  const handleSaveForLater = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (isSaved && savedItemId) {
        // Remove from saved
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/saved-items/${savedItemId}`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          setIsSaved(false);
          setSavedItemId(null);
        }
      } else {
        // Save for later
        const response = await fetch(`/api/workspaces/${workspaceSlug}/saved-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'FILE',
            fileId: file.id,
          }),
        });
        if (response.ok) {
          const result = await response.json();
          setIsSaved(true);
          setSavedItemId(result.data?.id);
        } else if (response.status === 409) {
          // Already saved - get the existing item
          const result = await response.json();
          setIsSaved(true);
          setSavedItemId(result.data?.id);
        }
      }
    } catch (err) {
      console.error('Failed to save/unsave item:', err);
    } finally {
      setIsSaving(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative flex items-center gap-1" ref={menuRef}>
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
        onClick={handleDownload}
        title="Download"
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleShare}
        title="Share file..."
      >
        <Forward className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8', isSaved && 'text-yellow-500')}
        onClick={handleSaveForLater}
        disabled={isSaving}
        title={isSaved ? 'Remove from saved' : 'Save for later'}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setShowMenu(!showMenu)}
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              window.open(file.url, '_blank');
              setShowMenu(false);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleCopyLink}
          >
            <Link2 className="h-4 w-4" />
            Copy link
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleShare}
          >
            <Forward className="h-4 w-4" />
            Share file...
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            onClick={handleSaveForLater}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current text-yellow-500')} />
            )}
            {isSaving ? 'Saving...' : isSaved ? 'Remove from saved' : 'Save for later'}
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
              canDelete ? 'text-destructive' : 'text-muted-foreground cursor-not-allowed'
            )}
            onClick={() => {
              if (canDelete) {
                onDelete?.();
              }
              setShowMenu(false);
            }}
            disabled={!canDelete}
            title={canDelete ? 'Delete file' : 'Only the uploader or workspace admin can delete files'}
          >
            <Trash2 className="h-4 w-4" />
            Delete file
          </button>
        </div>
      )}
    </div>
  );
}

export default FilesTab;
