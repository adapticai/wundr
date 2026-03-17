/**
 * Channel AI Assistant Component
 *
 * Provides AI-powered features for channels:
 * - Channel activity summarization
 * - Message suggestions
 * - Contextual chat assistance
 *
 * @module components/channels/channel-ai-assistant
 */
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  Bot,
  Sparkles,
  MessageSquare,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { UIMessage } from '@ai-sdk/react';

export interface ChannelAIAssistantProps {
  channelId: string;
  channelName: string;
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
      (part): part is { type: 'text'; text: string } => part.type === 'text'
    )
    .map(part => part.text)
    .join('');
}

/**
 * ChannelAIAssistant - AI-powered assistant panel for channels
 *
 * Features:
 * - One-click channel summarization
 * - Message suggestion generation
 * - Interactive chat interface via UnifiedChat
 * - Collapsible sections
 */
export function ChannelAIAssistant({
  channelId,
  channelName,
  isOpen,
  onClose,
  className,
}: ChannelAIAssistantProps) {
  const [activeSection, setActiveSection] = React.useState<
    'summary' | 'suggestions' | 'chat' | null
  >(null);

  // Separate hook for summarization
  const summaryChat = useChat({
    transport: new DefaultChatTransport({
      api: `/api/channels/${channelId}/ai`,
      body: { action: 'summarize' },
    }),
  });

  // Separate hook for suggestions
  const suggestionsChat = useChat({
    transport: new DefaultChatTransport({
      api: `/api/channels/${channelId}/ai`,
      body: { action: 'suggest' },
    }),
  });

  // Handle summarize button
  const handleSummarize = React.useCallback(async () => {
    setActiveSection('summary');
    if (summaryChat.messages.length === 0) {
      await summaryChat.sendMessage({
        text: 'Please provide a summary of the recent activity in this channel.',
      });
    }
  }, [summaryChat]);

  // Handle suggestions button
  const handleGetSuggestions = React.useCallback(async () => {
    setActiveSection('suggestions');
    if (suggestionsChat.messages.length === 0) {
      await suggestionsChat.sendMessage({
        text: 'Please suggest some relevant messages I could send based on the conversation.',
      });
    }
  }, [suggestionsChat]);

  // Handle section toggle
  const toggleSection = (section: typeof activeSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (!isOpen) {
    return null;
  }

  const isSummaryLoading =
    summaryChat.status === 'streaming' || summaryChat.status === 'submitted';
  const isSuggestionsLoading =
    suggestionsChat.status === 'streaming' ||
    suggestionsChat.status === 'submitted';

  return (
    <Card
      className={cn(
        'flex h-full w-[400px] flex-col border-l shadow-lg',
        className
      )}
    >
      {/* Header */}
      <CardHeader className='flex-shrink-0 border-b'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='rounded-full bg-primary/10 p-2'>
              <Bot className='h-5 w-5 text-primary' />
            </div>
            <CardTitle className='text-lg'>AI Assistant</CardTitle>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
            <span className='sr-only'>Close AI Assistant</span>
          </Button>
        </div>
        <p className='text-sm text-muted-foreground'>
          Get insights and suggestions for #{channelName}
        </p>
      </CardHeader>

      {/* Content */}
      <CardContent className='flex flex-1 flex-col gap-4 overflow-hidden p-4'>
        {/* Quick Actions */}
        <div className='flex flex-shrink-0 gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleSummarize}
            disabled={isSummaryLoading}
            className='flex-1'
          >
            {isSummaryLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Sparkles className='h-4 w-4' />
            )}
            <span className='ml-2'>Summarize</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleGetSuggestions}
            disabled={isSuggestionsLoading}
            className='flex-1'
          >
            {isSuggestionsLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <MessageSquare className='h-4 w-4' />
            )}
            <span className='ml-2'>Suggest</span>
          </Button>
        </div>

        {/* Summary Section */}
        {summaryChat.messages.length > 0 && (
          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => toggleSection('summary')}
              className='w-full justify-between'
            >
              <span className='font-semibold'>Channel Summary</span>
              {activeSection === 'summary' ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
            {activeSection === 'summary' && (
              <div className='mt-2 rounded-lg bg-muted p-3'>
                <div className='max-h-[200px] overflow-y-auto'>
                  <div className='whitespace-pre-wrap text-sm'>
                    {summaryChat.messages
                      .filter(m => m.role === 'assistant')
                      .map(m => getMessageContent(m))
                      .join('\n')}
                    {isSummaryLoading && (
                      <span className='inline-block ml-1'>
                        <Loader2 className='h-3 w-3 animate-spin' />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggestions Section */}
        {suggestionsChat.messages.length > 0 && (
          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => toggleSection('suggestions')}
              className='w-full justify-between'
            >
              <span className='font-semibold'>Message Suggestions</span>
              {activeSection === 'suggestions' ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
            {activeSection === 'suggestions' && (
              <div className='mt-2 rounded-lg bg-muted p-3'>
                <div className='max-h-[200px] overflow-y-auto'>
                  <div className='whitespace-pre-wrap text-sm'>
                    {suggestionsChat.messages
                      .filter(m => m.role === 'assistant')
                      .map(m => getMessageContent(m))
                      .join('\n')}
                    {isSuggestionsLoading && (
                      <span className='inline-block ml-1'>
                        <Loader2 className='h-3 w-3 animate-spin' />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Section */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          <UnifiedChat
            apiEndpoint={`/api/channels/${channelId}/ai`}
            variant='panel'
            persona={{
              name: `${channelName} Assistant`,
              greeting: `I can help with anything about #${channelName}. Ask me to summarize, suggest messages, or answer questions.`,
              suggestions: [
                'Summarize recent activity',
                'Suggest a message',
                'What topics are trending?',
              ],
            }}
            showToolCalls
            showReasoning
            enableActions
            requestBody={{ channelId, action: 'chat' }}
            onClose={onClose}
            maxHeight='calc(100vh - 8rem)'
          />
        </div>
      </CardContent>
    </Card>
  );
}
