'use client';

import {
  Send,
  Square,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronUp,
  MessageSquarePlus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAIChat } from '@/hooks/use-ai-chat';
import { cn } from '@/lib/utils';

interface AIChatInterfaceProps {
  conversationId?: string;
  workspaceSlug: string;
  className?: string;
}

export function AIChatInterface({
  conversationId,
  workspaceSlug,
  className,
}: AIChatInterfaceProps) {
  const {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    regenerate,
    stop,
    loadHistory,
    hasMoreHistory,
    draft,
    setDraft,
  } = useAIChat({
    sessionId: conversationId,
    workspaceSlug,
    entityType: 'workspace',
  });

  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft with input
  useEffect(() => {
    setInput(draft);
  }, [draft]);

  // Load history on mount for existing conversations
  useEffect(() => {
    if (conversationId && loadHistory) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    await sendMessage(input.trim());
    setInput('');
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    setDraft(value);
  };

  const handleLoadMore = async () => {
    if (isLoadingHistory || !hasMoreHistory) return;
    const firstMessageId = messages[0]?.id;
    setIsLoadingHistory(true);
    try {
      await loadHistory(firstMessageId);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const visibleMessages = messages.filter(
    m => m.role === 'user' || m.role === 'assistant'
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className='flex-1 px-4'>
        <div className='max-w-3xl mx-auto py-8 space-y-6'>
          {/* Load More History */}
          {conversationId && hasMoreHistory && (
            <div className='flex justify-center'>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleLoadMore}
                disabled={isLoadingHistory}
                className='text-muted-foreground'
              >
                {isLoadingHistory ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <ChevronUp className='mr-2 h-4 w-4' />
                )}
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Initial loading state for existing conversations */}
          {isLoading && conversationId && visibleMessages.length === 0 && (
            <div className='space-y-4'>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-3',
                    i % 2 === 0 ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className='h-8 w-8 rounded-full bg-muted animate-pulse' />
                  <div className='flex flex-col gap-2 max-w-[60%]'>
                    <div className='h-10 rounded-2xl bg-muted animate-pulse' />
                    <div className='h-3 w-20 rounded bg-muted animate-pulse' />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state for new conversations */}
          {visibleMessages.length === 0 && !isLoading && (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <div className='rounded-full bg-primary/10 p-6 mb-4'>
                <MessageSquarePlus className='h-12 w-12 text-primary' />
              </div>
              <h3 className='text-xl font-semibold mb-2'>
                How can I help you today?
              </h3>
              <p className='text-muted-foreground max-w-md mb-6'>
                Ask me about your portfolio performance, market analysis, risk
                exposure, or let me help you configure orchestrators and
                workflows.
              </p>
              <div className='grid grid-cols-2 gap-2 max-w-sm w-full'>
                {[
                  "Summarise today's portfolio performance",
                  'Analyse risk exposure across funds',
                  'Create a new workflow',
                  'Show recent trade activity',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    type='button'
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className='rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleMessages.map((message, index) => (
            <MessageBubble
              key={message.id || message.localId || index}
              message={{
                id: message.id || message.localId || `msg-${index}`,
                role: message.role as 'user' | 'assistant',
                content: message.content,
                createdAt: message.createdAt ?? new Date(),
                status: message.status,
              }}
            />
          ))}

          {error && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                {error.message}
                {error.code === 'NETWORK_ERROR' && (
                  <Button
                    variant='link'
                    size='sm'
                    onClick={() => window.location.reload()}
                    className='ml-2 h-auto p-0'
                  >
                    Try again
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className='border-t bg-background p-4'>
        <div className='max-w-3xl mx-auto'>
          <form onSubmit={handleSubmit} className='relative'>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder='Ask about your portfolio, funds, or workflows...'
              className='min-h-[80px] pr-24 resize-none'
              disabled={isSending}
            />
            <div className='absolute bottom-3 right-3 flex items-center gap-2'>
              {isSending ? (
                <>
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    onClick={stop}
                    className='h-8 w-8'
                    title='Stop generating'
                  >
                    <Square className='h-4 w-4' />
                  </Button>
                  <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                </>
              ) : (
                <>
                  {visibleMessages.length > 0 && (
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      onClick={regenerate}
                      className='h-8 w-8'
                      title='Regenerate last response'
                    >
                      <RotateCcw className='h-4 w-4' />
                    </Button>
                  )}
                  <Button
                    type='submit'
                    size='icon'
                    disabled={!input.trim() || isSending}
                    className='h-8 w-8'
                    title='Send message'
                  >
                    <Send className='h-4 w-4' />
                  </Button>
                </>
              )}
            </div>
          </form>
          <p className='text-xs text-muted-foreground text-center mt-3'>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    status?: 'sending' | 'sent' | 'error' | 'streaming';
  };
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const hasError = message.status === 'error';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className='h-8 w-8 mt-1 flex-shrink-0'>
          <AvatarFallback className='bg-primary text-primary-foreground text-xs'>
            AI
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
            hasError && 'border border-destructive'
          )}
        >
          {isStreaming && !message.content ? (
            <span className='inline-flex items-center gap-1 py-0.5'>
              <span
                className='h-1.5 w-1.5 rounded-full bg-current animate-bounce'
                style={{ animationDelay: '0ms' }}
              />
              <span
                className='h-1.5 w-1.5 rounded-full bg-current animate-bounce'
                style={{ animationDelay: '150ms' }}
              />
              <span
                className='h-1.5 w-1.5 rounded-full bg-current animate-bounce'
                style={{ animationDelay: '300ms' }}
              />
            </span>
          ) : (
            <div className='prose prose-sm dark:prose-invert max-w-none'>
              {message.content}
            </div>
          )}
        </div>

        <div className='flex items-center gap-2 px-1'>
          <span className='text-xs text-muted-foreground'>
            {formatDistanceToNow(message.createdAt, { addSuffix: true })}
          </span>
          {hasError && (
            <span className='text-xs text-destructive'>Failed to send</span>
          )}
          {isStreaming && message.content && (
            <span className='text-xs text-muted-foreground'>Generating...</span>
          )}
        </div>
      </div>

      {isUser && (
        <Avatar className='h-8 w-8 mt-1 flex-shrink-0'>
          <AvatarFallback className='bg-secondary text-xs'>U</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
