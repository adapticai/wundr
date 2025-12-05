'use client';

import { Bell, BellOff, AtSign, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

/**
 * Notification preference type
 */
type NotificationPreference = 'all' | 'mentions' | 'none';

/**
 * Props for the NotificationsDialog component
 */
interface NotificationsDialogProps {
  channelId: string;
  channelName: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Notifications Dialog
 *
 * Allows users to configure their notification preferences for a channel.
 */
export function NotificationsDialog({
  channelId,
  channelName,
  isOpen,
  onClose,
}: NotificationsDialogProps) {
  const [preference, setPreference] = useState<NotificationPreference>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current notification settings
  useEffect(() => {
    if (isOpen && channelId) {
      setIsLoading(true);
      setError(null);

      fetch(`/api/channels/${channelId}/notifications`)
        .then(res => res.json())
        .then(data => {
          setPreference(data.preference || 'all');
        })
        .catch(() => {
          setError('Failed to load notification settings');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, channelId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification settings');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [channelId, preference, onClose]);

  const options: {
    value: NotificationPreference;
    icon: typeof Bell;
    label: string;
    description: string;
  }[] = [
    {
      value: 'all',
      icon: Bell,
      label: 'All messages',
      description: 'Get notified for all messages in this channel',
    },
    {
      value: 'mentions',
      icon: AtSign,
      label: 'Mentions only',
      description: 'Only get notified when someone @mentions you',
    },
    {
      value: 'none',
      icon: BellOff,
      label: 'Muted',
      description: 'Never get notified about this channel',
    },
  ];

  return (
    <ResponsiveModal open={isOpen} onOpenChange={open => !open && onClose()}>
      <ResponsiveModalContent className='max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            Notifications for #{channelName}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className='p-4'>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <div className='space-y-2'>
              {options.map(({ value, icon: Icon, label, description }) => (
                <button
                  key={value}
                  type='button'
                  onClick={() => setPreference(value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    preference === value
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-accent',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      preference === value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                    )}
                  >
                    <Icon className='h-5 w-5' />
                  </div>
                  <div>
                    <div className='font-medium'>{label}</div>
                    <div className='text-sm text-muted-foreground'>
                      {description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && <p className='mt-4 text-sm text-destructive'>{error}</p>}
        </div>

        <ResponsiveModalFooter className='border-t px-4 py-3'>
          <Button variant='outline' onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default NotificationsDialog;
