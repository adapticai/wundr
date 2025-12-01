'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileIcon,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Download,
  ExternalLink,
  Forward,
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  Link2,
  Trash2,
  Loader2,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFilePreview } from '@/components/file-preview';
import { cn } from '@/lib/utils';

/**
 * File item type for the FileCard component
 */
export interface FileCardItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    isOrchestrator?: boolean;
  };
}

/**
 * Props for the FileCard component
 */
interface FileCardProps {
  file: FileCardItem;
  /** Workspace slug for API calls */
  workspaceSlug: string;
  /** Handler for sharing files */
  onShare?: () => void;
  /** Handler for deleting files */
  onDelete?: () => void;
  /** Whether the current user can delete this file */
  canDelete?: boolean;
  /** Whether this file is saved for later */
  isSaved?: boolean;
  /** ID of the saved item (for removal) */
  savedItemId?: string | null;
  /** Handler for save/unsave toggle */
  onSaveToggle?: (saved: boolean) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file type icon based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text')
  )
    return FileText;
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar')
  )
    return Archive;
  return FileIcon;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString();
}

/**
 * FileCard Component
 *
 * A mobile-responsive file card that displays file information with action buttons.
 * Used in the Files tab of channels/DMs and the Later page.
 */
export function FileCard({
  file,
  workspaceSlug,
  onShare,
  onDelete,
  canDelete = false,
  isSaved: initialIsSaved = false,
  savedItemId: initialSavedItemId = null,
  onSaveToggle,
  className,
}: FileCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [savedItemId, setSavedItemId] = useState<string | null>(
    initialSavedItemId
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { openPreview } = useFilePreview();

  // Update state when props change
  useEffect(() => {
    setIsSaved(initialIsSaved);
    setSavedItemId(initialSavedItemId);
  }, [initialIsSaved, initialSavedItemId]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideDesktop = !desktopMenuRef.current?.contains(target);
      const isOutsideMobile = !mobileMenuRef.current?.contains(target);
      if (isOutsideDesktop && isOutsideMobile) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const Icon = getFileIcon(file.mimeType);
  const isImage = file.mimeType.startsWith('image/');
  const imagePreviewUrl = file.thumbnailUrl || (isImage ? file.url : null);

  // Open file preview modal
  const handlePreview = useCallback(() => {
    if (file.url) {
      openPreview({
        id: file.id,
        url: file.url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        thumbnailUrl: file.thumbnailUrl,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt,
      });
    }
  }, [file, openPreview]);

  const handleOpenInNewTab = () => {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  const handleDownload = () => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyLink = async () => {
    if (file.url) {
      try {
        await navigator.clipboard.writeText(file.url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        setShowMenu(false);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
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
          onSaveToggle?.(false);
        }
      } else {
        // Save for later
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/saved-items`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'FILE',
              fileId: file.id,
            }),
          }
        );
        if (response.ok) {
          const result = await response.json();
          setIsSaved(true);
          setSavedItemId(result.data?.id);
          onSaveToggle?.(true);
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

  const handleDelete = () => {
    if (canDelete) {
      onDelete?.();
    }
    setShowMenu(false);
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 sm:p-4 transition-shadow hover:shadow-md cursor-pointer',
        className
      )}
      onClick={handlePreview}
      role='button'
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePreview();
        }
      }}
    >
      <div className='flex gap-3'>
        {/* Thumbnail or Icon */}
        <div className='flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden'>
          {isImage && imagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt={file.originalName}
              className='h-full w-full object-cover'
            />
          ) : (
            <Icon className='h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground' />
          )}
        </div>

        {/* File info */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              <p className='truncate font-medium text-sm sm:text-base'>
                {file.originalName}
              </p>
              <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
                <span>{formatFileSize(file.size)}</span>
                <span className='hidden xs:inline'>•</span>
                <span className='hidden xs:inline'>
                  {formatRelativeTime(file.createdAt)}
                </span>
                <span className='hidden sm:inline'>•</span>
                <span className='hidden sm:inline truncate max-w-[120px]'>
                  {file.uploadedBy.displayName ||
                    file.uploadedBy.name ||
                    'Unknown'}
                </span>
              </div>
              {/* Mobile: show date on second line */}
              <div className='xs:hidden text-xs text-muted-foreground mt-0.5'>
                {formatRelativeTime(file.createdAt)}
              </div>
            </div>

            {/* Desktop: Action buttons on hover */}
            <div
              className='hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'
              onClick={e => e.stopPropagation()}
            >
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={handlePreview}
                title='Preview'
              >
                <Eye className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={handleOpenInNewTab}
                title='Open in new tab'
              >
                <ExternalLink className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={handleDownload}
                title='Download'
              >
                <Download className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={handleShare}
                title='Share file...'
              >
                <Forward className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className={cn('h-8 w-8', isSaved && 'text-yellow-500')}
                onClick={handleSaveForLater}
                disabled={isSaving}
                title={isSaved ? 'Remove from saved' : 'Save for later'}
              >
                {isSaving ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : isSaved ? (
                  <BookmarkCheck className='h-4 w-4 fill-current' />
                ) : (
                  <Bookmark className='h-4 w-4' />
                )}
              </Button>
              <div className='relative' ref={desktopMenuRef}>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setShowMenu(!showMenu)}
                  title='More actions'
                >
                  <MoreHorizontal className='h-4 w-4' />
                </Button>

                {/* Dropdown menu */}
                {showMenu && (
                  <DropdownMenu
                    onOpenInNewTab={handleOpenInNewTab}
                    onDownload={handleDownload}
                    onCopyLink={handleCopyLink}
                    onShare={handleShare}
                    onSaveForLater={handleSaveForLater}
                    onDelete={handleDelete}
                    isSaved={isSaved}
                    isSaving={isSaving}
                    copySuccess={copySuccess}
                    canDelete={canDelete}
                    onClose={() => setShowMenu(false)}
                  />
                )}
              </div>
            </div>

            {/* Mobile: Always visible more button */}
            <div
              className='sm:hidden relative'
              ref={mobileMenuRef}
              onClick={e => e.stopPropagation()}
            >
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={() => setShowMenu(!showMenu)}
                title='Actions'
              >
                <MoreHorizontal className='h-4 w-4' />
              </Button>

              {/* Dropdown menu */}
              {showMenu && (
                <DropdownMenu
                  onPreview={handlePreview}
                  onOpenInNewTab={handleOpenInNewTab}
                  onDownload={handleDownload}
                  onCopyLink={handleCopyLink}
                  onShare={handleShare}
                  onSaveForLater={handleSaveForLater}
                  onDelete={handleDelete}
                  isSaved={isSaved}
                  isSaving={isSaving}
                  copySuccess={copySuccess}
                  canDelete={canDelete}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dropdown menu for file actions
 */
interface DropdownMenuProps {
  onPreview?: () => void;
  onOpenInNewTab: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onSaveForLater: () => void;
  onDelete: () => void;
  onClose: () => void;
  isSaved: boolean;
  isSaving: boolean;
  copySuccess: boolean;
  canDelete: boolean;
}

function DropdownMenu({
  onPreview,
  onOpenInNewTab,
  onDownload,
  onCopyLink,
  onShare,
  onSaveForLater,
  onDelete,
  onClose,
  isSaved,
  isSaving,
  copySuccess,
  canDelete,
}: DropdownMenuProps) {
  return (
    <>
      {/* Backdrop for mobile - clicking closes the menu */}
      <div className='fixed inset-0 z-40 sm:hidden' onClick={onClose} />
      <div className='absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-lg'>
        {onPreview && (
          <button
            type='button'
            className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
            onClick={onPreview}
          >
            <Eye className='h-4 w-4' />
            Preview
          </button>
        )}
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
          onClick={onOpenInNewTab}
        >
          <ExternalLink className='h-4 w-4' />
          Open in new tab
        </button>
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
          onClick={onCopyLink}
        >
          <Link2 className='h-4 w-4' />
          {copySuccess ? 'Copied!' : 'Copy link'}
        </button>
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
          onClick={onDownload}
        >
          <Download className='h-4 w-4' />
          Download
        </button>
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
          onClick={onShare}
        >
          <Forward className='h-4 w-4' />
          Share file...
        </button>
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50'
          onClick={onSaveForLater}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : isSaved ? (
            <BookmarkCheck className='h-4 w-4 fill-current text-yellow-500' />
          ) : (
            <Bookmark className='h-4 w-4' />
          )}
          {isSaving
            ? 'Saving...'
            : isSaved
              ? 'Remove from saved'
              : 'Save for later'}
        </button>
        <div className='my-1 h-px bg-border' />
        <button
          type='button'
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
            canDelete
              ? 'text-destructive'
              : 'text-muted-foreground cursor-not-allowed'
          )}
          onClick={onDelete}
          disabled={!canDelete}
          title={
            canDelete
              ? 'Delete file'
              : 'Only the uploader or workspace admin can delete files'
          }
        >
          <Trash2 className='h-4 w-4' />
          Delete file
        </button>
      </div>
    </>
  );
}

export default FileCard;
