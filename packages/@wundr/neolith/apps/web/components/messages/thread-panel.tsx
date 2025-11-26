'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useThread } from '@/hooks/use-thread';
import { MessageItem } from '@/components/chat/message-item';

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
  onClose,
  onReaction,
  className,
}: ThreadPanelProps) {
  const { replies, isLoading, error, hasMore, totalCount, addReply, loadMore, refetch } =
    useThread(workspaceId, channelId, parentMessage.id);

  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-scroll to bottom when new replies arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

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
    <div
      className={cn(
        'flex h-full flex-col border-l bg-background',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold">Thread</h3>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'reply' : 'replies'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close thread"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Thread content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Parent message */}
        <div className="border-b bg-muted/30 px-4 py-2">
          <MessageItem
            message={parentMessage}
            currentUser={currentUser}
            onReaction={onReaction}
            isThreadView={true}
          />
        </div>

        {/* Replies */}
        <div className="px-4">
          {isLoading && replies.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading replies...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Failed to load replies</p>
                <p className="text-xs">{error.message}</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="mt-2 text-xs underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : replies.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No replies yet. Be the first to reply!
            </div>
          ) : (
            <>
              {replies.map((reply) => (
                <MessageItem
                  key={reply.id}
                  message={reply}
                  currentUser={currentUser}
                  onReaction={onReaction}
                  isThreadView={true}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/80 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
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
      <div className="border-t p-4">
        <form onSubmit={handleSubmitReply}>
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply to ${parentMessage.author.name}...`}
              className="min-h-[80px] w-full resize-none rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </span>
              <button
                type="submit"
                disabled={!replyContent.trim() || isSubmitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
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
    </div>
  );
});
