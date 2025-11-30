'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

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
import { ConnectedUserAvatar } from '@/components/presence/user-avatar-with-presence';
import { useIsDesktop } from '@/hooks/use-media-query';

import type { Message, User } from '@/types/chat';

/**
 * Props for the DeleteMessageDialog component
 */
interface DeleteMessageDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The message to delete */
  message: Message | null;
  /** Callback when delete is confirmed */
  onConfirm: (messageId: string) => Promise<void> | void;
}

/**
 * Delete Message Confirmation Dialog
 *
 * Shows a confirmation dialog before deleting a message.
 * Displays a preview of the message being deleted.
 * Responsive: Dialog on desktop, Drawer on mobile/tablet.
 */
export function DeleteMessageDialog({
  open,
  onOpenChange,
  message,
  onConfirm,
}: DeleteMessageDialogProps) {
  const isDesktop = useIsDesktop();
  const [isDeleting, setIsDeleting] = useState(false);

  // Get author info with fallback
  const author: Pick<User, 'id' | 'name' | 'image'> = message?.author || {
    id: message?.authorId || '',
    name: 'Unknown User',
    image: null,
  };

  // Format timestamp
  const formattedTime = message
    ? new Date(message.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const handleDelete = useCallback(async () => {
    if (!message) return;

    setIsDeleting(true);
    try {
      await onConfirm(message.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete message:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [message, onConfirm, onOpenChange]);

  if (!message) return null;

  // Shared content for both Dialog and Drawer
  const sharedContent = (
    <div className="space-y-4">
      {/* Warning text */}
      <p className="text-sm text-muted-foreground">
        Are you sure you want to delete this message? This cannot be undone.
      </p>

      {/* Message preview */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="shrink-0">
            <ConnectedUserAvatar
              user={{ id: author.id, name: author.name ?? 'Unknown', image: author.image }}
              size="sm"
            />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-1 flex items-baseline gap-2">
              <span className="font-semibold text-foreground text-sm">{author.name}</span>
              <span className="text-xs text-muted-foreground">{formattedTime}</span>
            </div>

            {/* Message content (truncated if too long) */}
            <div className="text-sm text-foreground line-clamp-3">
              {message.content}
            </div>

            {/* Attachment indicator */}
            {message.attachments?.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

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
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete'
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
            <DialogTitle>Delete message</DialogTitle>
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
          <DrawerTitle>Delete message</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          {sharedContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default DeleteMessageDialog;
