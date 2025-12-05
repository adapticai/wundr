'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChatInput } from './chat-input';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { ChatHistory } from './chat-history';
import { Conversation, useConversation } from './conversation';

/**
 * AI Message role types
 */
export type AIMessageRole = 'user' | 'assistant' | 'system';

/**
 * AI Message structure with streaming support
 */
export interface AIMessage {
  readonly id: string;
  role: AIMessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    regenerateCount?: number;
    [key: string]: unknown;
  };
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

/**
 * Chat interface props
 */
export interface ChatInterfaceProps {
  /**
   * Array of messages to display
   */
  messages: AIMessage[];

  /**
   * Callback when user sends a message
   */
  onSendMessage: (content: string, attachments?: File[]) => void;

  /**
   * Callback when user regenerates a response
   */
  onRegenerateResponse?: (messageId: string) => void;

  /**
   * Callback when user provides feedback
   */
  onMessageFeedback?: (messageId: string, feedback: 'up' | 'down') => void;

  /**
   * Whether AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for input
   */
  placeholder?: string;

  /**
   * Maximum file size for attachments (in bytes)
   */
  maxFileSize?: number;

  /**
   * Allowed file types for attachments
   */
  allowedFileTypes?: string[];

  /**
   * Whether to show chat history sidebar
   */
  showHistory?: boolean;

  /**
   * Chat history conversations
   */
  conversations?: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: Date;
  }>;

  /**
   * Callback when selecting a conversation from history
   */
  onSelectConversation?: (conversationId: string) => void;

  /**
   * Current active conversation ID
   */
  activeConversationId?: string;

  /**
   * Callback to create a new conversation
   */
  onNewConversation?: () => void;

  /**
   * Callback to delete a conversation
   */
  onDeleteConversation?: (conversationId: string) => void;

  /**
   * Custom avatar for assistant
   */
  assistantAvatar?: {
    src?: string;
    name?: string;
    fallback?: string;
  };

  /**
   * Custom avatar for user
   */
  userAvatar?: {
    src?: string;
    name?: string;
    fallback?: string;
  };

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether input is disabled
   */
  disabled?: boolean;
}

/**
 * ChatInterface - Complete AI chat interface with all features
 *
 * Features:
 * - Message display with streaming support
 * - File attachment support
 * - Voice input button (UI)
 * - Message actions (copy, regenerate, feedback)
 * - Keyboard shortcuts (Cmd+Enter to send)
 * - Auto-scroll with scroll-to-bottom button
 * - Chat history sidebar (optional)
 * - Typing indicators
 * - Markdown rendering
 * - Code syntax highlighting
 *
 * @example
 * ```tsx
 * const [messages, setMessages] = useState<AIMessage[]>([]);
 * const [isLoading, setIsLoading] = useState(false);
 *
 * const handleSendMessage = async (content: string) => {
 *   const userMessage: AIMessage = {
 *     id: nanoid(),
 *     role: 'user',
 *     content,
 *     timestamp: new Date(),
 *   };
 *
 *   setMessages(prev => [...prev, userMessage]);
 *   setIsLoading(true);
 *
 *   // Call your AI API here
 *   const response = await fetch('/api/chat', {
 *     method: 'POST',
 *     body: JSON.stringify({ message: content }),
 *   });
 *
 *   const data = await response.json();
 *   const assistantMessage: AIMessage = {
 *     id: nanoid(),
 *     role: 'assistant',
 *     content: data.content,
 *     timestamp: new Date(),
 *   };
 *
 *   setMessages(prev => [...prev, assistantMessage]);
 *   setIsLoading(false);
 * };
 *
 * <ChatInterface
 *   messages={messages}
 *   onSendMessage={handleSendMessage}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function ChatInterface({
  messages,
  onSendMessage,
  onRegenerateResponse,
  onMessageFeedback,
  isLoading = false,
  placeholder = 'Type your message...',
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes = ['image/*', '.pdf', '.txt', '.doc', '.docx'],
  showHistory = false,
  conversations = [],
  onSelectConversation,
  activeConversationId,
  onNewConversation,
  onDeleteConversation,
  assistantAvatar,
  userAvatar,
  className,
  disabled = false,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const handleSend = () => {
    if (!inputValue.trim() && attachedFiles.length === 0) {
      return;
    }

    onSendMessage(
      inputValue,
      attachedFiles.length > 0 ? attachedFiles : undefined
    );
    setInputValue('');
    setAttachedFiles([]);
  };

  const handleFileAttach = (files: File[]) => {
    // Filter files by size and type
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds maximum size`);
        return false;
      }
      return true;
    });

    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRegenerate = (messageId: string) => {
    if (onRegenerateResponse) {
      onRegenerateResponse(messageId);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
    if (onMessageFeedback) {
      onMessageFeedback(messageId, feedback);
    }
  };

  return (
    <div className={cn('flex h-full w-full', className)}>
      {/* Chat History Sidebar */}
      {showHistory && (
        <ChatHistory
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          onNewConversation={onNewConversation}
          onDeleteConversation={onDeleteConversation}
          className='w-80 border-r'
        />
      )}

      {/* Main Chat Area */}
      <div className='flex flex-1 flex-col'>
        {/* Messages Container */}
        <Conversation
          className='flex-1'
          initial='smooth'
          showScrollButton={true}
        >
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={
                  message.role === 'assistant' && onRegenerateResponse
                    ? () => handleRegenerate(message.id)
                    : undefined
                }
                onFeedback={
                  message.role === 'assistant' && onMessageFeedback
                    ? feedback => handleFeedback(message.id, feedback)
                    : undefined
                }
                assistantAvatar={assistantAvatar}
                userAvatar={userAvatar}
              />
            ))
          )}

          {/* Typing Indicator */}
          {isLoading && <TypingIndicator />}
        </Conversation>

        {/* Input Area */}
        <div className='border-t bg-background p-4'>
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onFileAttach={handleFileAttach}
            onRemoveFile={handleRemoveFile}
            attachedFiles={attachedFiles}
            isLoading={isLoading}
            disabled={disabled}
            placeholder={placeholder}
            maxFileSize={maxFileSize}
            allowedFileTypes={allowedFileTypes}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component for when there are no messages
 */
function EmptyState() {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 p-8 text-center'>
      <div className='rounded-full bg-primary/10 p-4'>
        <svg
          className='h-8 w-8 text-primary'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          aria-hidden='true'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
          />
        </svg>
      </div>
      <div className='space-y-2'>
        <h3 className='text-lg font-semibold'>Start a conversation</h3>
        <p className='text-sm text-muted-foreground max-w-md'>
          Ask me anything! I can help you with code, explanations, creative
          writing, and much more.
        </p>
      </div>
    </div>
  );
}
