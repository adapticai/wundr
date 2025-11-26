'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import {
  MessageList,
  MessageInput,
  ThreadPanel,
  TypingIndicator,
} from '@/components/chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import {
  useMessages,
  useSendMessage,
  useChannel,
  useTypingIndicator,
  useThread,
} from '@/hooks/use-chat';

import type { Message, User } from '@/types/chat';

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Convert auth user to chat User type
  const currentUser = useMemo<User | null>(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.name || 'Unknown User',
      email: authUser.email || '',
      image: authUser.image,
      status: 'online',
    };
  }, [authUser]);

  // Fetch channel details
  const { channel, isLoading: isChannelLoading } = useChannel(channelId);

  // Fetch messages
  const {
    messages,
    isLoading: isMessagesLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  } = useMessages(channelId);

  // Send message hook
  const { sendMessage, editMessage, deleteMessage } = useSendMessage();

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    channelId,
    currentUser?.id || '',
  );

  // Thread state
  const {
    thread,
    isLoading: isThreadLoading,
    addOptimisticReply,
  } = useThread(activeThreadId || '');

  // Handle send message
  const handleSendMessage = useCallback(
    async (content: string, mentions: string[], attachments: File[]) => {
      if (!currentUser) return;

      const { optimisticId, message } = await sendMessage(
        { content, channelId, mentions, attachments },
        currentUser,
      );

      // Add optimistic message
      addOptimisticMessage({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: [],
      });

      // Replace optimistic message with real one
      if (message) {
        updateOptimisticMessage(optimisticId, { ...message, id: message.id });
      } else {
        // Remove on failure
        removeOptimisticMessage(optimisticId);
      }
    },
    [channelId, currentUser, sendMessage, addOptimisticMessage, updateOptimisticMessage, removeOptimisticMessage],
  );

  // Handle send thread reply
  const handleSendThreadReply = useCallback(
    async (content: string, mentions: string[], attachments: File[]) => {
      if (!activeThreadId || !currentUser) {
return;
}

      const { optimisticId } = await sendMessage(
        { content, channelId, parentId: activeThreadId, mentions, attachments },
        currentUser,
      );

      // Add optimistic reply
      addOptimisticReply({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId,
        parentId: activeThreadId,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: [],
      });

      // Update reply count on parent
      updateOptimisticMessage(activeThreadId, {
        replyCount: (messages.find((m) => m.id === activeThreadId)?.replyCount || 0) + 1,
      });
    },
    [activeThreadId, channelId, currentUser, sendMessage, addOptimisticReply, updateOptimisticMessage, messages],
  );

  // Handle edit message
  const handleEditMessage = useCallback(
    async (message: Message) => {
      const result = await editMessage(message.id, { content: message.content });
      if (result) {
        updateOptimisticMessage(message.id, result);
      }
    },
    [editMessage, updateOptimisticMessage],
  );

  // Handle delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const success = await deleteMessage(messageId);
      if (success) {
        removeOptimisticMessage(messageId);
      }
    },
    [deleteMessage, removeOptimisticMessage],
  );

  // Handle reaction toggle
  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUser) return;

      // Optimistic update
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
return;
}

      const existingReaction = message.reactions.find((r) => r.emoji === emoji);
      let updatedReactions = [...message.reactions];

      if (existingReaction) {
        if (existingReaction.hasReacted) {
          // Remove user's reaction
          if (existingReaction.count === 1) {
            updatedReactions = updatedReactions.filter((r) => r.emoji !== emoji);
          } else {
            updatedReactions = updatedReactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.count - 1,
                    hasReacted: false,
                    users: r.users.filter((u) => u.id !== currentUser.id),
                  }
                : r,
            );
          }
        } else {
          // Add user's reaction
          updatedReactions = updatedReactions.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count + 1,
                  hasReacted: true,
                  users: [...r.users, currentUser],
                }
              : r,
          );
        }
      } else {
        // New reaction
        updatedReactions.push({
          emoji,
          count: 1,
          hasReacted: true,
          users: [currentUser],
        });
      }

      updateOptimisticMessage(messageId, { reactions: updatedReactions });

      // Send to server
      try {
        await fetch(`/api/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      } catch {
        // Revert on error
        updateOptimisticMessage(messageId, { reactions: message.reactions });
      }
    },
    [currentUser, messages, updateOptimisticMessage],
  );

  // Handle reply (open thread)
  const handleReply = useCallback((message: Message) => {
    setActiveThreadId(message.id);
  }, []);

  // Handle open thread
  const handleOpenThread = useCallback((message: Message) => {
    setActiveThreadId(message.id);
  }, []);

  // Handle close thread
  const handleCloseThread = useCallback(() => {
    setActiveThreadId(null);
  }, []);

  const isLoading = isChannelLoading || isMessagesLoading || isAuthLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Require authentication
  if (!currentUser) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view this channel.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Channel Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <ChannelIcon type={channel?.type || 'public'} />
          <div>
            <h1 className="font-semibold">{channel?.name || 'Loading...'}</h1>
            {channel?.description && (
              <p className="text-xs text-muted-foreground">{channel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MemberCount count={channel?.members.length || 0} />
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Channel settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col">
          <MessageList
            messages={messages}
            currentUser={currentUser}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onReply={handleReply}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onReaction={handleReaction}
            onOpenThread={handleOpenThread}
          />

          {/* Typing indicator */}
          <TypingIndicator typingUsers={typingUsers} />

          {/* Message input */}
          <MessageInput
            channelId={channelId}
            currentUser={currentUser}
            placeholder={`Message #${channel?.name || 'channel'}...`}
            onSend={handleSendMessage}
            onTyping={startTyping}
            onStopTyping={stopTyping}
          />
        </div>

        {/* Thread panel */}
        <ThreadPanel
          thread={thread}
          currentUser={currentUser}
          channelId={channelId}
          isLoading={isThreadLoading}
          isOpen={!!activeThreadId}
          onClose={handleCloseThread}
          onSendReply={handleSendThreadReply}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReaction={handleReaction}
        />
      </div>
    </div>
  );
}

interface ChannelIconProps {
  type: 'public' | 'private' | 'direct';
}

function ChannelIcon({ type }: ChannelIconProps) {
  if (type === 'private') {
    return (
      <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }

  if (type === 'direct') {
    return (
      <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3 8 21" />
      <path d="M16 3 14 21" />
    </svg>
  );
}

interface MemberCountProps {
  count: number;
}

function MemberCount({ count }: MemberCountProps) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span>{count}</span>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
