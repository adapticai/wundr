'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

import type { Channel } from '@/types/channel';

/**
 * Props for the EditChannelDialog component
 */
interface EditChannelDialogProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { name?: string; description?: string; topic?: string }) => Promise<void>;
}

/**
 * Edit Channel Dialog
 *
 * Allows channel admins to edit channel name, description, and topic.
 */
export function EditChannelDialog({
  channel,
  isOpen,
  onClose,
  onSave,
}: EditChannelDialogProps) {
  const [name, setName] = useState(channel?.name || '');
  const [description, setDescription] = useState(channel?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen && channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      setError(null);
    }
  }, [isOpen, channel]);

  const handleSave = useCallback(async () => {
    if (!name?.trim()) {
      setError('Channel name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel');
    } finally {
      setIsSaving(false);
    }
  }, [name, description, onSave, onClose]);

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent className="max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit channel</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-4 p-4">
          {/* Channel name */}
          <div className="space-y-2">
            <label htmlFor="channel-name" className="text-sm font-medium">
              Channel name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
              <input
                id="channel-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className={cn(
                  'w-full rounded-md border bg-background px-3 py-2 pl-7 text-sm outline-none',
                  'focus:border-primary focus:ring-1 focus:ring-primary',
                  error && 'border-destructive'
                )}
                placeholder="channel-name"
                maxLength={80}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Names must be lowercase, without spaces or periods, and max 80 characters.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="channel-description" className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none resize-none',
                'focus:border-primary focus:ring-1 focus:ring-primary'
              )}
              placeholder="What's this channel about?"
              rows={3}
              maxLength={250}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/250 characters
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <ResponsiveModalFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name?.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default EditChannelDialog;
