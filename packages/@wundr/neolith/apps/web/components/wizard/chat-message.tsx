/**
 * Chat Message Component
 * Displays a single message in the conversational wizard
 * @module components/wizard/chat-message
 */
'use client';

import * as React from 'react';
import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Optional timestamp */
  timestamp?: Date;
  /** Whether the message is currently being streamed */
  isStreaming?: boolean;
}

/**
 * ChatMessage - Renders a single message bubble in the conversation
 *
 * Features:
 * - Avatar for user/assistant
 * - Message bubble with appropriate styling
 * - Timestamp display
 * - Streaming indicator
 * - Accessibility support
 */
export function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  // System messages are displayed differently (centered, no avatar)
  if (isSystem) {
    return (
      <div className='flex w-full justify-center'>
        <div className='rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground'>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      role='article'
      aria-label={`${role} message`}
    >
      {/* Avatar */}
      <Avatar className='h-8 w-8 flex-shrink-0'>
        <AvatarFallback
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {isUser ? <User className='h-4 w-4' /> : <Bot className='h-4 w-4' />}
        </AvatarFallback>
      </Avatar>

      {/* Message bubble */}
      <div className={cn('flex max-w-[75%] flex-col', isUser && 'items-end')}>
        {/* Sender label */}
        <div
          className={cn(
            'mb-1 text-xs font-medium',
            isUser ? 'text-right text-foreground/70' : 'text-foreground/70'
          )}
        >
          {isUser ? 'You' : 'AI Assistant'}
        </div>

        {/* Content bubble */}
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <div className='whitespace-pre-wrap break-words text-sm leading-relaxed'>
            {content}
            {isStreaming && (
              <span className='ml-1 inline-block'>
                <StreamingCursor />
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div
            className={cn(
              'mt-1 text-xs text-muted-foreground',
              isUser && 'text-right'
            )}
          >
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StreamingCursor - Animated cursor for streaming messages
 */
function StreamingCursor() {
  return <span className='inline-block h-4 w-[2px] animate-pulse bg-current' />;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // Show "Just now" for messages less than 1 minute old
  if (diffMins < 1) {
    return 'Just now';
  }

  // Show "X minutes ago" for messages less than 60 minutes old
  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  }

  // Otherwise show time
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
