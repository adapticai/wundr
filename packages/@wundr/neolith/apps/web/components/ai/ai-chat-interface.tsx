'use client';

import { Send, Square, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
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
    isSending,
    error,
    sendMessage,
    regenerate,
    stop,
    draft,
    setDraft,
  } = useAIChat({
    sessionId: conversationId,
    workspaceSlug,
    entityType: 'workspace',
  });

  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft with input
  useEffect(() => {
    setInput(draft);
  }, [draft]);

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

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className='flex-1 px-4'>
        <div className='max-w-3xl mx-auto py-8 space-y-6'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <div className='rounded-full bg-primary/10 p-6 mb-4'>
                <MessageSquarePlusIcon className='h-12 w-12 text-primary' />
              </div>
              <h3 className='text-xl font-semibold mb-2'>
                Start a conversation
              </h3>
              <p className='text-muted-foreground max-w-md'>
                Ask me anything about your workspace, or let me help you create
                orchestrators, workflows, and more.
              </p>
            </div>
          )}

          {messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map((message, index) => (
              <MessageBubble
                key={message.id || message.localId || index}
                message={{
                  id: message.id || message.localId || `msg-${index}`,
                  role: message.role as 'user' | 'assistant',
                  content: message.content,
                  createdAt: message.createdAt,
                  status: message.status,
                }}
                isLatest={index === messages.length - 1}
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
              placeholder='Ask me anything...'
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
                  >
                    <Square className='h-4 w-4' />
                  </Button>
                  <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                </>
              ) : (
                <>
                  {messages.length > 0 && (
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
  isLatest: boolean;
}

function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const hasError = message.status === 'error';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className='h-8 w-8 mt-1'>
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
          <div className='prose prose-sm dark:prose-invert max-w-none'>
            {message.content ||
              (isStreaming && (
                <span className='inline-flex items-center gap-1'>
                  <span className='animate-bounce'>●</span>
                  <span className='animate-bounce delay-75'>●</span>
                  <span className='animate-bounce delay-150'>●</span>
                </span>
              ))}
          </div>
        </div>

        <div className='flex items-center gap-2 px-1'>
          <span className='text-xs text-muted-foreground'>
            {formatDistanceToNow(message.createdAt, { addSuffix: true })}
          </span>
          {hasError && (
            <span className='text-xs text-destructive'>Failed to send</span>
          )}
          {isStreaming && (
            <span className='text-xs text-muted-foreground'>Generating...</span>
          )}
        </div>
      </div>

      {isUser && (
        <Avatar className='h-8 w-8 mt-1'>
          <AvatarFallback className='bg-secondary text-xs'>U</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function MessageSquarePlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      <line x1='12' y1='9' x2='12' y2='13' />
      <line x1='10' y1='11' x2='14' y2='11' />
    </svg>
  );
}
