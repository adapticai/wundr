'use client';

import { useState, useCallback } from 'react';
import { FileIcon, FileText, Image, Loader2, Music, Video, Archive, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/hooks/use-media-query';

/**
 * File item type for deletion
 */
interface FileItem {
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
  };
}

/**
 * Props for the DeleteFileDialog component
 */
interface DeleteFileDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The file to delete */
  file: FileItem | null;
  /** Callback when delete is confirmed */
  onConfirm: (fileId: string) => Promise<void> | void;
  /** Whether the current user is the uploader or admin */
  canDelete?: boolean;
}

/**
 * Get file type icon based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return Archive;
  return FileIcon;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Delete File Confirmation Dialog
 *
 * Shows a confirmation dialog before deleting a file.
 * Displays a preview of the file being deleted with a warning
 * that it will also be removed from any messages.
 * Responsive: Dialog on desktop, Drawer on mobile/tablet.
 */
export function DeleteFileDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
  canDelete = true,
}: DeleteFileDialogProps) {
  const isDesktop = useIsDesktop();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!file) return;

    setIsDeleting(true);
    try {
      await onConfirm(file.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete file:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [file, onConfirm, onOpenChange]);

  if (!file) return null;

  const FileTypeIcon = getFileIcon(file.mimeType);
  const isImage = file.mimeType.startsWith('image/');
  const imagePreviewUrl = file.thumbnailUrl || (isImage ? file.url : null);

  // Shared content for both Dialog and Drawer
  const sharedContent = (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-destructive">This action cannot be undone</p>
          <p className="text-muted-foreground mt-1">
            This file will be permanently deleted and removed from any messages where it was shared.
          </p>
        </div>
      </div>

      {/* File preview */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
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
              <FileTypeIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-sm">{file.originalName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} • Uploaded by {file.uploadedBy.displayName || file.uploadedBy.name}
            </p>
          </div>
        </div>
      </div>

      {/* Permission warning */}
      {!canDelete && (
        <p className="text-sm text-destructive">
          You don&apos;t have permission to delete this file. Only the uploader or workspace admins can delete files.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting || !canDelete}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete file'
          )}
        </Button>
      </div>
    </div>
  );

  // Desktop: use Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
          </DialogHeader>
          {sharedContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile/Tablet: use Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Delete file</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          {sharedContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default DeleteFileDialog;
