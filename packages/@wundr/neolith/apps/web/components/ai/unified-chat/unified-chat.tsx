'use client';

import { Send } from 'lucide-react';
import * as React from 'react';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { ChatHeader } from './chat-header';
import { EmptyState } from './empty-state';
import { MessageGroup } from './message-group';
import { ProgressBar } from './progress-bar';
import { SuggestionChips } from './suggestion-chips';

import type { ExtractedData, UnifiedChatConfig } from './types';

interface UnifiedChatProps extends UnifiedChatConfig {
  onClose?: () => void;
  onMinimize?: () => void;
  className?: string;
}

const VARIANT_CONTAINER_CLASSES: Record<UnifiedChatProps['variant'], string> = {
  fullscreen: 'fixed inset-0 z-50 flex flex-col bg-background',
  panel:
    'flex flex-col bg-background border border-border rounded-xl shadow-lg overflow-hidden',
  dialog:
    'flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden',
  embedded: 'flex flex-col bg-background overflow-hidden',
};

export function UnifiedChat({
  apiEndpoint,
  variant,
  persona,
  progress,
  showToolCalls = true,
  showReasoning = true,
  requestBody,
  maxHeight,
  onDataExtracted,
  onReadyToCreate,
  onClose,
  onMinimize,
  className,
}: UnifiedChatProps) {
  const [input, setInput] = React.useState('');
  const [extractedData, setExtractedData] = React.useState<ExtractedData>({
    fields: {},
    completionPercent: 0,
    isReady: false,
    history: [],
  });

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: requestBody,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiEndpoint]
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onToolCall({ toolCall }) {
      const toolName =
        'toolName' in toolCall
          ? (toolCall as { toolName: string }).toolName
          : '';
      if (toolName.startsWith('extract_')) {
        const toolInput =
          'input' in toolCall
            ? (toolCall as { input?: Record<string, unknown> }).input
            : undefined;
        if (toolInput && typeof toolInput === 'object') {
          setExtractedData(prev => {
            const merged = { ...prev.fields, ...toolInput };
            const newFields = Object.keys(toolInput);

            const requiredFields = progress?.requiredFields ?? [];
            const filled = requiredFields.filter(
              f =>
                merged[f] !== undefined &&
                merged[f] !== null &&
                merged[f] !== ''
            );
            const completionPercent =
              requiredFields.length > 0
                ? Math.round((filled.length / requiredFields.length) * 100)
                : 0;
            const isReady =
              requiredFields.length > 0 &&
              filled.length === requiredFields.length;

            const updated: ExtractedData = {
              fields: merged,
              completionPercent,
              isReady,
              history: [
                ...prev.history,
                { timestamp: new Date(), fields: newFields },
              ],
            };

            onDataExtracted?.(merged);
            if (isReady && !prev.isReady) {
              onReadyToCreate?.(merged);
            }

            return updated;
          });
        }
      }
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-scroll to bottom on new messages or streaming
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ role: 'user', parts: [{ type: 'text', text: trimmed }] });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: suggestion }],
    });
  };

  const showProgress = progress?.enabled && extractedData.completionPercent > 0;
  const showSuggestions =
    persona.suggestions &&
    persona.suggestions.length > 0 &&
    messages.length >= 2;

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator = isStreaming && lastMessage?.role === 'user';

  return (
    <div
      className={cn(VARIANT_CONTAINER_CLASSES[variant], className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <ChatHeader
        persona={persona}
        variant={variant}
        onClose={onClose}
        onMinimize={onMinimize}
      />

      {showProgress && (
        <ProgressBar
          completionPercent={extractedData.completionPercent}
          isReady={extractedData.isReady}
        />
      )}

      {/* Message list */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-6'>
        {messages.length === 0 ? (
          <EmptyState
            persona={persona}
            onSuggestionClick={handleSuggestionSelect}
          />
        ) : (
          <>
            {messages.map(message => (
              <MessageGroup
                key={message.id}
                message={message}
                isStreaming={isStreaming && message.id === lastMessage?.id}
                showToolCalls={showToolCalls}
                showReasoning={showReasoning}
              />
            ))}

            {showTypingIndicator && (
              <div className='flex items-start gap-2'>
                <div className='h-7 w-7 flex-shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center'>
                  <span className='sr-only'>AI is thinking</span>
                </div>
                <div className='rounded-2xl rounded-bl-sm bg-muted px-4 py-3'>
                  <span className='flex gap-1'>
                    <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]' />
                    <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]' />
                    <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]' />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className='border-t border-border px-4 py-3 space-y-2'>
        {showSuggestions && (
          <SuggestionChips
            suggestions={persona.suggestions!}
            onSelect={handleSuggestionSelect}
          />
        )}

        <div className='flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring'>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder='Message...'
            rows={1}
            className={cn(
              'flex-1 resize-none border-0 bg-transparent p-0 shadow-none',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'text-sm placeholder:text-muted-foreground min-h-[1.5rem]'
            )}
          />
          <Button
            type='button'
            size='sm'
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className='h-8 w-8 flex-shrink-0 p-0 rounded-lg'
            aria-label='Send message'
          >
            <Send className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
