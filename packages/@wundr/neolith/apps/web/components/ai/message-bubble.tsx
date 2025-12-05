'use client';

import { useState } from 'react';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreVertical,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Response } from './response';
import type { AIMessage } from './chat-interface';

export interface MessageBubbleProps {
  /**
   * The message to display
   */
  message: AIMessage;

  /**
   * Callback when user wants to regenerate response (assistant only)
   */
  onRegenerate?: () => void;

  /**
   * Callback when user provides feedback (assistant only)
   */
  onFeedback?: (feedback: 'up' | 'down') => void;

  /**
   * Custom assistant avatar
   */
  assistantAvatar?: {
    src?: string;
    name?: string;
    fallback?: string;
  };

  /**
   * Custom user avatar
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
}

/**
 * MessageBubble - Displays a single message with actions
 *
 * Features:
 * - User/Assistant/System message styling
 * - Markdown rendering for AI responses
 * - Copy message content
 * - Regenerate response (assistant only)
 * - Thumbs up/down feedback (assistant only)
 * - Streaming indicator
 * - Timestamp display
 * - Avatar display
 * - File attachments display
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={{
 *     id: '1',
 *     role: 'assistant',
 *     content: 'Hello! How can I help you?',
 *     timestamp: new Date(),
 *   }}
 *   onRegenerate={() => console.log('Regenerate')}
 *   onFeedback={(feedback) => console.log('Feedback:', feedback)}
 * />
 * ```
 */
export function MessageBubble({
  message,
  onRegenerate,
  onFeedback,
  assistantAvatar,
  userAvatar,
  className,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(prev => (prev === type ? null : type));
    if (onFeedback) {
      onFeedback(type);
    }
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // System messages have special styling
  if (isSystem) {
    return (
      <div className={cn('flex justify-center py-2', className)}>
        <div className='rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground'>
          {message.content}
        </div>
      </div>
    );
  }

  // Get avatar props based on role
  const avatarProps = isUser
    ? {
        src: userAvatar?.src,
        name: userAvatar?.name || 'User',
        fallback: userAvatar?.fallback || 'U',
      }
    : {
        src: assistantAvatar?.src,
        name: assistantAvatar?.name || 'AI Assistant',
        fallback: assistantAvatar?.fallback || 'AI',
      };

  return (
    <div
      className={cn(
        'group flex gap-3 w-full py-4',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <Avatar className='h-8 w-8 shrink-0'>
        {avatarProps.src && (
          <AvatarImage src={avatarProps.src} alt={avatarProps.name} />
        )}
        <AvatarFallback
          className={cn(
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          {avatarProps.fallback}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[85%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted rounded-bl-sm',
            message.isStreaming && 'animate-pulse'
          )}
        >
          {isAssistant ? (
            <Response
              isStreaming={message.isStreaming}
              showCursor={message.isStreaming}
            >
              {message.content}
            </Response>
          ) : (
            <div className='prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words'>
              {message.content}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className='mt-2 space-y-2'>
              {message.attachments.map(attachment => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timestamp and Actions */}
        <div
          className={cn(
            'flex items-center gap-2',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {/* Timestamp */}
          <span className='text-xs text-muted-foreground'>
            {formatTimestamp(message.timestamp)}
          </span>

          {/* Action Buttons - Show on hover or if feedback is given */}
          {!message.isStreaming && (isHovered || feedback !== null) && (
            <div className='flex items-center gap-1'>
              {/* Copy Button */}
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={handleCopy}
                title='Copy message'
              >
                {copied ? (
                  <Check className='h-3 w-3 text-green-500' />
                ) : (
                  <Copy className='h-3 w-3' />
                )}
              </Button>

              {/* Assistant-only actions */}
              {isAssistant && (
                <>
                  {/* Thumbs Up */}
                  {onFeedback && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className={cn(
                        'h-6 w-6',
                        feedback === 'up' && 'text-green-500'
                      )}
                      onClick={() => handleFeedback('up')}
                      title='Good response'
                    >
                      <ThumbsUp className='h-3 w-3' />
                    </Button>
                  )}

                  {/* Thumbs Down */}
                  {onFeedback && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className={cn(
                        'h-6 w-6',
                        feedback === 'down' && 'text-red-500'
                      )}
                      onClick={() => handleFeedback('down')}
                      title='Bad response'
                    >
                      <ThumbsDown className='h-3 w-3' />
                    </Button>
                  )}

                  {/* Regenerate */}
                  {onRegenerate && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={onRegenerate}
                      title='Regenerate response'
                    >
                      <RotateCcw className='h-3 w-3' />
                    </Button>
                  )}

                  {/* More Options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6'
                        title='More options'
                      >
                        <MoreVertical className='h-3 w-3' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem onClick={handleCopy}>
                        <Copy className='mr-2 h-4 w-4' />
                        Copy message
                      </DropdownMenuItem>
                      {onRegenerate && (
                        <DropdownMenuItem onClick={onRegenerate}>
                          <RotateCcw className='mr-2 h-4 w-4' />
                          Regenerate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          )}
        </div>

        {/* Metadata (if available) */}
        {message.metadata && (
          <div className='text-xs text-muted-foreground'>
            {message.metadata.model && (
              <span>Model: {message.metadata.model}</span>
            )}
            {message.metadata.tokensUsed && (
              <span className='ml-2'>
                Tokens: {message.metadata.tokensUsed}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Attachment preview component
 */
interface AttachmentPreviewProps {
  attachment: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  };
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = attachment.type.startsWith('image/');

  return (
    <a
      href={attachment.url}
      target='_blank'
      rel='noopener noreferrer'
      className='flex items-center gap-2 rounded-lg border p-2 hover:bg-accent transition-colors'
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          className='h-16 w-16 rounded object-cover'
        />
      ) : (
        <div className='flex h-16 w-16 items-center justify-center rounded bg-muted'>
          <span className='text-xs font-semibold text-muted-foreground'>
            {attachment.name.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium truncate'>{attachment.name}</p>
        <p className='text-xs text-muted-foreground'>
          {formatFileSize(attachment.size)}
        </p>
      </div>
    </a>
  );
}
