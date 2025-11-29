'use client';

import { useCallback } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
  /** Whether the thread is loading */
  isLoading?: boolean;
  /** Whether the thread panel is open */
  isOpen: boolean;
  /** Callback to close the thread panel */
  onClose: () => void;
  /** Callback fired when sending a reply */
  onSendReply: (content: string, mentions: string[], attachments: File[]) => void;
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
    [onSendReply],
  );

  if (!isOpen) {
return null;
}

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-lg sm:w-96 lg:relative lg:shadow-none',
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <ThreadIcon />
          <h2 className="font-semibold">Thread</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Close thread"
        >
          <CloseIcon />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : thread ? (
        <>
          {/* Parent message */}
          <div className="border-b">
            <MessageItem
              message={thread.parentMessage}
              currentUser={currentUser}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onReaction={onReaction}
              isThreadView
            />
          </div>

          {/* Participants */}
          {thread.participants.length > 0 && (
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <GroupAvatar users={thread.participants} max={5} size="sm" />
              <span className="text-xs text-muted-foreground">
                {thread.participants.length}{' '}
                {thread.participants.length === 1 ? 'participant' : 'participants'}
              </span>
            </div>
          )}

          {/* Thread messages */}
          <div className="flex-1 overflow-hidden">
            <MessageList
              messages={thread.messages}
              currentUser={currentUser}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onReaction={onReaction}
              isThreadView
            />
          </div>

          {/* Reply input */}
          <MessageInput
            channelId={channelId}
            parentId={thread.parentMessage.id}
            currentUser={currentUser}
            placeholder="Reply to thread..."
            onSend={handleSendReply}
          />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <ThreadIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">No thread selected</p>
            <p className="text-sm text-muted-foreground">
              Click on a message to view its thread.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'h-5 w-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
