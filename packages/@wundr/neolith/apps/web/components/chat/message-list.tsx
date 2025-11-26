'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';

import { MessageListSkeleton, MessageLoadingIndicator } from '@/components/skeletons';
import { cn } from '@/lib/utils';

import { MessageItem } from './message-item';

import type { Message, User } from '@/types/chat';



/**
 * Props for the MessageList component
 */
interface MessageListProps {
  /** Array of messages to display */
  messages: Message[];
  /** The current authenticated user */
  currentUser: User;
  /** Whether the initial load is in progress */
  isLoading?: boolean;
  /** Whether more messages are being loaded */
  isLoadingMore?: boolean;
  /** Whether there are more messages to load */
  hasMore?: boolean;
  /** Number of unread messages for the scroll button */
  unreadCount?: number;
  /** ID of the last read message for separator display */
  lastReadMessageId?: string;
  /** Callback to load more messages (infinite scroll) */
  onLoadMore?: () => void;
  /** Callback fired when replying to a message */
  onReply?: (message: Message) => void;
  /** Callback fired when editing a message */
  onEdit?: (message: Message) => void;
  /** Callback fired when deleting a message */
  onDelete?: (messageId: string) => void;
  /** Callback fired when adding/removing a reaction */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Callback fired when opening a message thread */
  onOpenThread?: (message: Message) => void;
  /** Whether this is a thread view (affects UI rendering) */
  isThreadView?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export function MessageList({
  messages,
  currentUser,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  unreadCount = 0,
  lastReadMessageId,
  onLoadMore,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onOpenThread,
  isThreadView = false,
  className,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMessageCountRef = useRef(messages.length);
  const isInitialLoadRef = useRef(true);

  // Calculate visible items for virtualization
  const ITEM_HEIGHT_ESTIMATE = 80;
  const BUFFER_SIZE = 5;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Handle scroll for infinite loading and auto-scroll detection
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
return;
}

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Load more when scrolling near top
    if (scrollTop < 100 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }

    // Detect if user is at bottom for auto-scroll
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom && scrollHeight - scrollTop - clientHeight > 200);

    // Update visible range for virtualization
    const scrollOffset = Math.max(0, scrollTop - BUFFER_SIZE * ITEM_HEIGHT_ESTIMATE);
    const startIndex = Math.floor(scrollOffset / ITEM_HEIGHT_ESTIMATE);
    const visibleCount = Math.ceil(clientHeight / ITEM_HEIGHT_ESTIMATE) + BUFFER_SIZE * 2;
    const endIndex = Math.min(messages.length, startIndex + visibleCount);

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [hasMore, isLoadingMore, onLoadMore, messages.length]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      if (autoScroll || isInitialLoadRef.current) {
        // Use instant scroll on initial load, smooth for new messages
        const behavior = isInitialLoadRef.current ? 'instant' : 'smooth';
        scrollToBottom(behavior as ScrollBehavior);
        isInitialLoadRef.current = false;
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, autoScroll, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0 && isInitialLoadRef.current) {
      scrollToBottom('instant' as ScrollBehavior);
    }
  }, [isLoading, messages.length, scrollToBottom]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
return;
}

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Determine which messages should show date separators
  const messagesWithSeparators = useMemo(() => {
    return messages.map((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const currentDate = new Date(message.createdAt).toDateString();
      const prevDate = prevMessage ? new Date(prevMessage.createdAt).toDateString() : null;
      const showDateSeparator = currentDate !== prevDate;

      // Determine unread separator
      const isUnreadSeparator =
        lastReadMessageId &&
        prevMessage?.id === lastReadMessageId &&
        message.id !== lastReadMessageId;

      return {
        message,
        showDateSeparator,
        isUnreadSeparator,
      };
    });
  }, [messages, lastReadMessageId]);

  // Get visible messages
  const visibleMessages = useMemo(() => {
    // For small lists, don't virtualize
    if (messages.length < 100) {
      return messagesWithSeparators;
    }
    return messagesWithSeparators.slice(visibleRange.start, visibleRange.end);
  }, [messagesWithSeparators, visibleRange, messages.length]);

  // Calculate spacer heights for virtualization
  const spacerHeights = useMemo(() => {
    if (messages.length < 100) {
      return { top: 0, bottom: 0 };
    }
    return {
      top: visibleRange.start * ITEM_HEIGHT_ESTIMATE,
      bottom: Math.max(0, (messages.length - visibleRange.end) * ITEM_HEIGHT_ESTIMATE),
    };
  }, [messages.length, visibleRange]);

  if (isLoading) {
    return <MessageListSkeleton className={className} messageCount={8} />;
  }

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <div className="text-center">
          <MessageEmptyIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            {isThreadView ? 'Start the conversation by replying.' : 'Be the first to send a message!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative flex-1 overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Message list"
      >
        {/* Loading more indicator */}
        {isLoadingMore && <MessageLoadingIndicator />}

        {/* Top spacer for virtualization */}
        {spacerHeights.top > 0 && <div style={{ height: spacerHeights.top }} />}

        {/* Messages */}
        {visibleMessages.map(({ message, showDateSeparator, isUnreadSeparator }) => (
          <MessageItem
            key={message.id}
            message={message}
            currentUser={currentUser}
            showDateSeparator={showDateSeparator}
            isUnreadSeparator={isUnreadSeparator || false}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReaction={onReaction}
            onOpenThread={onOpenThread}
            isThreadView={isThreadView}
          />
        ))}

        {/* Bottom spacer for virtualization */}
        {spacerHeights.bottom > 0 && <div style={{ height: spacerHeights.bottom }} />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-opacity hover:bg-primary/90"
        >
          <ScrollDownIcon />
          <span>
            {unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? 'message' : 'messages'}` : 'Jump to latest'}
          </span>
        </button>
      )}
    </div>
  );
}

function MessageEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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

function ScrollDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}
