'use client';

import { MessageSquare, Users } from 'lucide-react';
import { useCallback } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { GroupAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

import { MessageInput } from './message-input';
import { MessageItem } from './message-item';
import { MessageList } from './message-list';

import type { Message, User, Thread } from '@/types/chat';

/**
 * Props for the ThreadPanel component
 */
interface ThreadPanelProps {
  /** The thread data to display (null when no thread selected) */
  thread: Thread | null;
  /** The current authenticated user */
  currentUser: User;
  /** The channel ID for the message input */
  channelId: string;
  /** The workspace slug for sharing files */
  workspaceSlug?: string;
  /** Whether the thread is loading */
  isLoading?: boolean;
  /** Whether the thread panel is open */
  isOpen: boolean;
  /** Callback to close the thread panel */
  onClose: () => void;
  /** Callback fired when sending a reply */
  onSendReply: (
    content: string,
    mentions: string[],
    attachments: File[]
  ) => void;
  /** Callback fired when editing a message */
  onEditMessage?: (message: Message) => void;
  /** Callback fired when deleting a message */
  onDeleteMessage?: (messageId: string) => void;
  /** Callback fired when adding/removing a reaction */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Additional CSS class names */
  className?: string;
}

export function ThreadPanel({
  thread,
  currentUser,
  channelId,
  workspaceSlug,
  isLoading = false,
  isOpen,
  onClose,
  onSendReply,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  className,
}: ThreadPanelProps) {
  const handleSendReply = useCallback(
    (content: string, mentions: string[], attachments: File[]) => {
      onSendReply(content, mentions, attachments);
    },
    [onSendReply]
  );

  const replyCount = thread?.messages?.length || 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side='right'
        className={cn('flex w-full flex-col p-0 sm:max-w-2xl', className)}
      >
        {isLoading ? (
          <div className='flex flex-1 items-center justify-center'>
            <LoadingSpinner size='lg' />
          </div>
        ) : thread ? (
          <>
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
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    {thread.participants.length > 0 && (
                      <>
                        <span className='text-muted-foreground'>•</span>
                        <div className='flex items-center gap-1.5'>
                          <Users className='h-3.5 w-3.5' />
                          <GroupAvatar
                            users={thread.participants.slice(0, 5)}
                            max={5}
                            size='xs'
                          />
                          {thread.participants.length > 5 && (
                            <span className='text-xs text-muted-foreground'>
                              +{thread.participants.length - 5}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Scrollable container for parent message + replies */}
            <div className='flex-1 overflow-y-auto'>
              {/* Parent message */}
              <div className='border-b bg-muted/30 px-6 py-4'>
                <MessageItem
                  message={thread.parentMessage}
                  currentUser={currentUser}
                  workspaceSlug={workspaceSlug}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                  onReaction={onReaction}
                  isThreadView
                />
              </div>

              {/* Thread messages */}
              {thread.messages.length === 0 ? (
                <div className='flex flex-1 items-center justify-center py-12'>
                  <div className='text-center'>
                    <MessageSquare className='mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50' />
                    <p className='font-medium text-foreground'>
                      No replies yet
                    </p>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      Be the first to reply to this message!
                    </p>
                  </div>
                </div>
              ) : (
                <div className='px-6 py-2'>
                  <MessageList
                    messages={thread.messages}
                    currentUser={currentUser}
                    workspaceSlug={workspaceSlug}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onReaction={onReaction}
                    isThreadView
                  />
                </div>
              )}
            </div>

            {/* Reply input - fixed at bottom */}
            <div className='border-t bg-background'>
              <MessageInput
                channelId={channelId}
                parentId={thread.parentMessage.id}
                currentUser={currentUser}
                placeholder='Reply to thread...'
                onSend={handleSendReply}
              />
            </div>
          </>
        ) : (
          <div className='flex flex-1 items-center justify-center'>
            <div className='text-center'>
              <MessageSquare className='mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50' />
              <p className='text-lg font-medium text-foreground'>
                No thread selected
              </p>
              <p className='text-sm text-muted-foreground'>
                Click on a message to view its thread.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
