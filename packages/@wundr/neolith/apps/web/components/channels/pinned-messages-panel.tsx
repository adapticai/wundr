'use client';

import { Pin, X, Loader2, AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Message } from '@/types/chat';

/**
 * Props for the PinnedMessagesPanel component
 */
interface PinnedMessagesPanelProps {
  channelId: string;
  channelName: string;
  isOpen: boolean;
  onClose: () => void;
  onMessageClick?: (messageId: string) => void;
  canManagePins: boolean;
  currentUserId?: string;
}

const MAX_PINS = 50;

/**
 * Pinned Messages Panel
 *
 * Displays and manages pinned messages in a channel.
 * Only admins/owners can pin/unpin messages.
 */
export function PinnedMessagesPanel({
  channelId,
  channelName,
  isOpen,
  onClose,
  onMessageClick,
  canManagePins,
  currentUserId,
}: PinnedMessagesPanelProps) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch pinned messages
  const fetchPinnedMessages = useCallback(async () => {
    if (!channelId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/pins`);

      if (!response.ok) {
        throw new Error('Failed to fetch pinned messages');
      }

      const result = await response.json();
      setPinnedMessages(result.data || []);
    } catch (err) {
      console.error('Failed to fetch pinned messages:', err);
      setError('Failed to load pinned messages');
      setPinnedMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Fetch on open or channel change
  useEffect(() => {
    if (isOpen) {
      fetchPinnedMessages();
    }
  }, [isOpen, fetchPinnedMessages]);

  // Unpin a message
  const handleUnpin = useCallback(
    async (messageId: string) => {
      if (!canManagePins) {
        toast({
          title: 'Permission denied',
          description: 'Only channel admins can unpin messages',
          variant: 'destructive',
        });
        return;
      }

      setUnpinningId(messageId);

      try {
        const response = await fetch(
          `/api/channels/${channelId}/pins?messageId=${messageId}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to unpin message');
        }

        // Remove from local state
        setPinnedMessages(prev => prev.filter(m => m.id !== messageId));

        toast({
          title: 'Message unpinned',
          description: 'The message has been removed from pins',
        });
      } catch (err) {
        console.error('Failed to unpin message:', err);
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to unpin message',
          variant: 'destructive',
        });
      } finally {
        setUnpinningId(null);
      }
    },
    [channelId, canManagePins, toast],
  );

  // Handle message click - scroll to message in main chat
  const handleMessageClick = useCallback(
    (messageId: string) => {
      onMessageClick?.(messageId);
      // Also close the panel after clicking
      onClose();
    },
    [onMessageClick, onClose],
  );

  const pinnedCount = pinnedMessages.length;
  const canPinMore = pinnedCount < MAX_PINS;

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-xl'>
      {/* Header */}
      <div className='flex h-14 items-center justify-between border-b px-4'>
        <div className='flex items-center gap-2'>
          <Pin className='h-5 w-5 text-muted-foreground' />
          <h2 className='font-semibold'>Pinned Messages</h2>
          <Badge variant='secondary' className='ml-1'>
            {pinnedCount}/{MAX_PINS}
          </Badge>
        </div>
        <Button variant='ghost' size='icon' onClick={onClose}>
          <X className='h-5 w-5' />
        </Button>
      </div>

      {/* Info bar */}
      <div className='border-b bg-muted/30 px-4 py-2'>
        <p className='text-xs text-muted-foreground'>
          {canManagePins
            ? canPinMore
              ? `Pin important messages to #{channelName}. ${MAX_PINS - pinnedCount} ${MAX_PINS - pinnedCount === 1 ? 'slot' : 'slots'} remaining.`
              : `Maximum of ${MAX_PINS} pins reached. Unpin a message to add new ones.`
            : 'View pinned messages in #{channelName}'}
        </p>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : error ? (
          <div className='flex flex-col items-center justify-center gap-2 py-12 px-4'>
            <AlertCircle className='h-8 w-8 text-destructive' />
            <p className='text-sm text-muted-foreground'>{error}</p>
            <Button variant='outline' size='sm' onClick={fetchPinnedMessages}>
              Try again
            </Button>
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className='flex flex-col items-center justify-center gap-2 py-12 px-4 text-center'>
            <Pin className='h-12 w-12 text-muted-foreground/40' />
            <p className='text-sm font-medium'>No pinned messages</p>
            <p className='text-xs text-muted-foreground'>
              {canManagePins
                ? 'Pin important messages to keep them handy'
                : 'Admins can pin important messages here'}
            </p>
          </div>
        ) : (
          <div className='divide-y'>
            {pinnedMessages.map(message => (
              <PinnedMessageItem
                key={message.id}
                message={message}
                onUnpin={handleUnpin}
                onClick={handleMessageClick}
                canUnpin={canManagePins}
                isUnpinning={unpinningId === message.id}
                isCurrentUser={message.authorId === currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PinnedMessageItemProps {
  message: Message;
  onUnpin: (messageId: string) => void;
  onClick: (messageId: string) => void;
  canUnpin: boolean;
  isUnpinning: boolean;
  isCurrentUser: boolean;
}

function PinnedMessageItem({
  message,
  onUnpin,
  onClick,
  canUnpin,
  isUnpinning,
  isCurrentUser,
}: PinnedMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formattedTime = useMemo(
    () =>
      new Date(message.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [message.createdAt],
  );

  const author = message.author || {
    id: message.authorId,
    name: 'Unknown User',
    email: '',
    image: null,
  };

  // Truncate long messages
  const truncatedContent = useMemo(() => {
    const maxLength = 200;
    if (message.content.length > maxLength) {
      return message.content.slice(0, maxLength) + '...';
    }
    return message.content;
  }, [message.content]);

  return (
    <div
      className={cn(
        'relative px-4 py-3 transition-colors hover:bg-accent/50 cursor-pointer',
        isUnpinning && 'opacity-50',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(message.id)}
    >
      <div className='flex gap-3'>
        {/* Avatar */}
        <div className='shrink-0'>
          <UserAvatar
            user={{
              name: author.name ?? 'Unknown',
              image: author.image,
            }}
            size='sm'
            shape='rounded'
          />
        </div>

        {/* Content */}
        <div className='min-w-0 flex-1'>
          {/* Header */}
          <div className='mb-1 flex items-baseline gap-2'>
            <span className='text-sm font-semibold text-foreground'>
              {author.name}
            </span>
            {isCurrentUser && (
              <span className='text-xs text-muted-foreground'>(you)</span>
            )}
            <span className='text-xs text-muted-foreground'>
              {formattedTime}
            </span>
          </div>

          {/* Message content */}
          <p className='text-sm leading-relaxed text-foreground'>
            {truncatedContent}
          </p>

          {/* Attachments indicator */}
          {message.attachments && message.attachments.length > 0 && (
            <div className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
              <svg
                width='12'
                height='12'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48' />
              </svg>
              <span>
                {message.attachments.length}{' '}
                {message.attachments.length === 1 ? 'attachment' : 'attachments'}
              </span>
            </div>
          )}

          {/* Reactions indicator */}
          {message.reactions && message.reactions.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1'>
              {message.reactions.slice(0, 3).map((reaction, idx) => (
                <span
                  key={idx}
                  className='inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs'
                >
                  <span>{reaction.emoji}</span>
                  <span className='text-muted-foreground'>{reaction.count}</span>
                </span>
              ))}
              {message.reactions.length > 3 && (
                <span className='text-xs text-muted-foreground'>
                  +{message.reactions.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unpin button */}
      {canUnpin && isHovered && !isUnpinning && (
        <div className='absolute top-3 right-3'>
          <Button
            variant='ghost'
            size='sm'
            onClick={e => {
              e.stopPropagation();
              onUnpin(message.id);
            }}
            className='h-7 px-2 text-xs'
          >
            <X className='h-3 w-3 mr-1' />
            Unpin
          </Button>
        </div>
      )}

      {isUnpinning && (
        <div className='absolute top-3 right-3'>
          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
        </div>
      )}
    </div>
  );
}

export default PinnedMessagesPanel;
