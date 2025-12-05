'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { WidgetActions } from './widget-actions';
import type { AIMessage } from './chat-interface';
import type { QuickAction } from '@/lib/stores/widget-store';

/**
 * Props for WidgetChat component
 */
export interface WidgetChatProps {
  /**
   * Current messages in the conversation
   */
  messages: AIMessage[];

  /**
   * Callback when user sends a message
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Whether widget is minimized
   */
  isMinimized?: boolean;

  /**
   * Callback to start a new conversation
   */
  onNewConversation?: () => void;

  /**
   * Custom className
   */
  className?: string;
}

/**
 * WidgetChat - Mini chat interface for the widget
 *
 * Features:
 * - Compact message display
 * - Quick text input
 * - Auto-scroll to latest message
 * - Quick actions integration
 * - Loading states
 * - New conversation button
 *
 * @example
 * ```tsx
 * <WidgetChat
 *   messages={messages}
 *   onSendMessage={handleSend}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function WidgetChat({
  messages,
  onSendMessage,
  isLoading = false,
  isMinimized = false,
  onNewConversation,
  className,
}: WidgetChatProps) {
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Hide quick actions when there are messages
  useEffect(() => {
    setShowQuickActions(messages.length === 0);
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || isLoading) {
      return;
    }

    onSendMessage(input.trim());
    setInput('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd+Enter or Ctrl+Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
    setShowQuickActions(false);
    inputRef.current?.focus();
  };

  const handleNewConversation = () => {
    if (onNewConversation) {
      onNewConversation();
    }
    setShowQuickActions(true);
    setInput('');
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (isMinimized) {
    return (
      <div className={cn('flex items-center justify-between p-4', className)}>
        <div className='flex items-center gap-2'>
          <div className='h-2 w-2 animate-pulse rounded-full bg-primary' />
          <span className='text-sm text-muted-foreground'>
            AI Assistant ready
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <div className='h-2 w-2 rounded-full bg-green-500' />
          <span className='text-sm font-medium'>AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleNewConversation}
            className='h-7 gap-1 text-xs'
          >
            <RotateCcw className='h-3 w-3' />
            New Chat
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className='flex-1 p-4' ref={scrollRef}>
        {messages.length === 0 ? (
          showQuickActions ? (
            <WidgetActions onActionSelect={handleQuickAction} />
          ) : (
            <EmptyState />
          )
        ) : (
          <div className='space-y-4'>
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                userAvatar={{ fallback: 'U' }}
                assistantAvatar={{ fallback: 'AI' }}
              />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className='border-t p-4'>
        <div className='flex gap-2'>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder='Ask me anything...'
            disabled={isLoading}
            className='min-h-[40px] max-h-[120px] resize-none'
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size='icon'
            className='h-10 w-10 shrink-0'
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Send className='h-4 w-4' />
            )}
          </Button>
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          Press <kbd className='rounded border px-1'>⌘</kbd>+
          <kbd className='rounded border px-1'>Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}

/**
 * Empty state when no messages and quick actions are hidden
 */
function EmptyState() {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
      <div className='rounded-full bg-primary/10 p-3'>
        <Send className='h-6 w-6 text-primary' />
      </div>
      <div className='space-y-1'>
        <h4 className='text-sm font-semibold'>Start a conversation</h4>
        <p className='text-xs text-muted-foreground'>
          Ask me anything or use a quick action below
        </p>
      </div>
    </div>
  );
}
