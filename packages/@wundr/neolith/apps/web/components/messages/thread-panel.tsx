'use client';

import { X, Loader2, AlertCircle, MessageSquare, Users } from 'lucide-react';
import { useState, useEffect, useRef, memo } from 'react';

import { MessageItem } from '@/components/chat/message-item';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { GroupAvatar } from '@/components/ui/user-avatar';
import { useThread } from '@/hooks/use-thread';
import { cn } from '@/lib/utils';

import type { Message, User } from '@/types/chat';

/**
 * Props for the ThreadPanel component
 */
interface ThreadPanelProps {
  /** Parent message that started the thread */
  parentMessage: Message;
  /** Current authenticated user */
  currentUser: User;
  /** Workspace ID */
  workspaceId: string;
  /** Channel ID */
  channelId: string;
  /** Whether the panel is open */
  open: boolean;
  /** Callback fired when closing the panel */
  onClose: () => void;
  /** Callback fired when adding a reaction */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Additional CSS class names */
  className?: string;
}

export const ThreadPanel = memo(function ThreadPanel({
  parentMessage,
  currentUser,
  workspaceId,
  channelId,
  open,
  onClose,
  onReaction,
  className,
}: ThreadPanelProps) {
  const {
    replies,
    isLoading,
    error,
    hasMore,
    totalCount,
    addReply,
    loadMore,
    refetch,
  } = useThread(workspaceId, channelId, parentMessage.id);

  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure Sheet is fully mounted
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-scroll to bottom when new replies arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  // Get unique participants from replies
  const participants = Array.from(
    new Set([parentMessage.author, ...replies.map(r => r.author)].filter(Boolean)),
  );

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addReply(replyContent.trim());
      setReplyContent('');
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to add reply:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmitReply(e);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side='right'
        className={cn('flex w-full flex-col p-0 sm:max-w-2xl', className)}
      >
        {/* Header */}
        <SheetHeader className='border-b px-6 py-4'>
          <div className='flex items-start justify-between'>
            <div className='flex-1 space-y-1'>
              <SheetTitle className='flex items-center gap-2 text-lg'>
                <MessageSquare className='h-5 w-5' />
                Thread
              </SheetTitle>
              <SheetDescription className='flex items-center gap-3 text-sm'>
                <span>
                  {totalCount} {totalCount === 1 ? 'reply' : 'replies'}
                </span>
                {participants.length > 0 && (
                  <>
                    <span className='text-muted-foreground'>•</span>
                    <div className='flex items-center gap-1.5'>
                      <Users className='h-3.5 w-3.5' />
                      <GroupAvatar
                        users={participants.slice(0, 5)}
                        max={5}
                        size='xs'
                      />
                      {participants.length > 5 && (
                        <span className='text-xs text-muted-foreground'>
                          +{participants.length - 5}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Thread content */}
        <div ref={scrollRef} className='flex-1 overflow-y-auto'>
          {/* Parent message */}
          <div className='border-b bg-muted/30 px-6 py-4'>
            <MessageItem
              message={parentMessage}
              currentUser={currentUser}
              onReaction={onReaction}
              isThreadView={true}
            />
          </div>

          {/* Replies */}
          <div className='px-6 py-2'>
            {isLoading && replies.length === 0 ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                <span className='ml-2 text-sm text-muted-foreground'>
                  Loading replies...
                </span>
              </div>
            ) : error ? (
              <div className='my-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
                <AlertCircle className='h-5 w-5 shrink-0' />
                <div>
                  <p className='font-medium'>Failed to load replies</p>
                  <p className='text-xs'>{error.message}</p>
                  <button
                    type='button'
                    onClick={refetch}
                    className='mt-2 text-xs underline hover:no-underline'
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : replies.length === 0 ? (
              <div className='py-12 text-center text-sm text-muted-foreground'>
                <MessageSquare className='mx-auto mb-2 h-8 w-8 opacity-50' />
                <p className='font-medium'>No replies yet</p>
                <p className='mt-1 text-xs'>
                  Be the first to reply to this message!
                </p>
              </div>
            ) : (
              <>
                {replies.map(reply => (
                  <MessageItem
                    key={reply.id}
                    message={reply}
                    currentUser={currentUser}
                    onReaction={onReaction}
                    isThreadView={true}
                  />
                ))}
                {hasMore && (
                  <div className='flex justify-center py-4'>
                    <button
                      type='button'
                      onClick={loadMore}
                      disabled={isLoading}
                      className='rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50'
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className='mr-2 inline-block h-4 w-4 animate-spin' />
                          Loading...
                        </>
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reply input */}
        <div className='border-t bg-background px-6 py-4'>
          <form onSubmit={handleSubmitReply}>
            <div className='space-y-3'>
              <textarea
                ref={textareaRef}
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Reply to ${parentMessage.author.name}...`}
                className='min-h-[100px] w-full resize-none rounded-md border bg-background p-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/20'
                disabled={isSubmitting}
              />
              <div className='flex items-center justify-between'>
                <span className='text-xs text-muted-foreground'>
                  Press <kbd className='rounded bg-muted px-1 py-0.5 text-xs font-semibold'>Enter</kbd> to send, <kbd className='rounded bg-muted px-1 py-0.5 text-xs font-semibold'>Shift+Enter</kbd> for new line
                </span>
                <button
                  type='submit'
                  disabled={!replyContent.trim() || isSubmitting}
                  className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className='mr-2 inline-block h-4 w-4 animate-spin' />
                      Sending...
                    </>
                  ) : (
                    'Send'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
});
