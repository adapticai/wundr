/**
 * Orchestrator Chat Component
 *
 * Provides an AI-powered chat interface for orchestrator management:
 * - Interactive chat about orchestrator configuration
 * - Charter and capability recommendations
 * - Operational guidance and best practices
 *
 * @module components/orchestrators/orchestrator-chat
 */
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Send, Loader2, X, Brain } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { Orchestrator } from '@/types/orchestrator';
import type { UIMessage } from '@ai-sdk/react';

export interface OrchestratorChatProps {
  orchestrator: Orchestrator;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * Extract text content from UIMessage
 */
function getMessageContent(message: UIMessage): string {
  if (!message.parts) {
    return '';
  }
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map(part => part.text)
    .join('');
}

/**
 * OrchestratorChat - AI-powered chat interface for orchestrator management
 *
 * Features:
 * - Context-aware chat about the orchestrator
 * - Configuration recommendations
 * - Charter and capability guidance
 * - Operational best practices
 */
export function OrchestratorChat({
  orchestrator,
  isOpen,
  onClose,
  className,
}: OrchestratorChatProps) {
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Chat hook
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: `/api/orchestrators/${orchestrator.id}/ai`,
    }),
  });

  // Auto-scroll to bottom of chat
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages]);

  // Handle chat submit
  const handleChatSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) {
        return;
      }

      const message = input;
      setInput('');
      await chat.sendMessage({ text: message });
    },
    [input, chat],
  );

  // Suggested prompts
  const suggestedPrompts = React.useMemo(
    () => [
      'How can I improve this orchestrator?',
      'Suggest capabilities for this discipline',
      'Help me write a better charter',
      'What operational settings should I use?',
    ],
    [],
  );

  const handleSuggestedPrompt = React.useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    [],
  );

  if (!isOpen) {
    return null;
  }

  const isChatLoading =
    chat.status === 'streaming' || chat.status === 'submitted';

  return (
    <Card
      className={cn(
        'flex h-full w-[450px] flex-col border-l shadow-lg',
        className,
      )}
    >
      {/* Header */}
      <CardHeader className='flex-shrink-0 border-b'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='rounded-full bg-primary/10 p-2'>
              <Brain className='h-5 w-5 text-primary' />
            </div>
            <div>
              <CardTitle className='text-lg'>AI Assistant</CardTitle>
              <p className='text-xs text-muted-foreground'>
                Chat about {orchestrator.title}
              </p>
            </div>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
            <span className='sr-only'>Close AI Chat</span>
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className='flex flex-1 flex-col overflow-hidden p-0'>
        {/* Chat Messages */}
        <div ref={scrollRef} className='flex-1 overflow-y-auto p-4'>
          <div className='space-y-4'>
            {chat.messages.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Bot className='h-16 w-16 text-muted-foreground mb-4' />
                <p className='text-sm font-medium text-foreground mb-2'>
                  Ask me anything about this orchestrator
                </p>
                <p className='text-xs text-muted-foreground mb-4'>
                  I can help with configuration, charter development, and
                  operational guidance
                </p>

                {/* Suggested Prompts */}
                <div className='w-full space-y-2'>
                  <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                    Try asking:
                  </p>
                  {suggestedPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant='outline'
                      size='sm'
                      className='w-full justify-start text-left text-xs h-auto py-2'
                      onClick={() => handleSuggestedPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              chat.messages.map(message => {
                const content = getMessageContent(message);
                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      isUser ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    {!isUser && (
                      <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0'>
                        <Bot className='h-4 w-4 text-primary' />
                      </div>
                    )}
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 max-w-[85%]',
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted',
                      )}
                    >
                      <p className='text-sm whitespace-pre-wrap break-words leading-relaxed'>
                        {content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            {isChatLoading && (
              <div className='flex gap-3'>
                <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0'>
                  <Bot className='h-4 w-4 text-primary' />
                </div>
                <div className='rounded-lg bg-muted px-4 py-3'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Input */}
        <div className='flex-shrink-0 border-t p-4'>
          <form onSubmit={handleChatSubmit} className='flex gap-2'>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='Ask about configuration, charter, capabilities...'
              className='min-h-[80px] resize-none'
              disabled={isChatLoading}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit(e);
                }
              }}
            />
            <Button
              type='submit'
              size='icon'
              className='h-[80px] w-[80px] flex-shrink-0'
              disabled={!input.trim() || isChatLoading}
            >
              <Send className='h-5 w-5' />
              <span className='sr-only'>Send message</span>
            </Button>
          </form>
          <p className='text-xs text-muted-foreground mt-2'>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
