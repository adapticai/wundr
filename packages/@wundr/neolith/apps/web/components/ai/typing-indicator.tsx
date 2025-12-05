'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface TypingIndicatorProps {
  /**
   * Custom assistant avatar
   */
  assistantAvatar?: {
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
 * TypingIndicator - Animated typing indicator for AI responses
 *
 * Features:
 * - Smooth bouncing animation
 * - Matches message bubble styling
 * - Avatar display
 * - Accessible (aria-live)
 *
 * @example
 * ```tsx
 * {isLoading && <TypingIndicator />}
 *
 * {isLoading && (
 *   <TypingIndicator
 *     assistantAvatar={{
 *       src: '/ai-avatar.png',
 *       name: 'AI Assistant',
 *       fallback: 'AI',
 *     }}
 *   />
 * )}
 * ```
 */
export function TypingIndicator({
  assistantAvatar,
  className,
}: TypingIndicatorProps) {
  const avatarProps = {
    src: assistantAvatar?.src,
    name: assistantAvatar?.name || 'AI Assistant',
    fallback: assistantAvatar?.fallback || 'AI',
  };

  return (
    <div
      className={cn('flex gap-3 w-full py-4', className)}
      role='status'
      aria-live='polite'
      aria-label='AI is typing'
    >
      {/* Avatar */}
      <Avatar className='h-8 w-8 shrink-0'>
        {avatarProps.src && (
          <AvatarImage src={avatarProps.src} alt={avatarProps.name} />
        )}
        <AvatarFallback className='bg-muted'>
          {avatarProps.fallback}
        </AvatarFallback>
      </Avatar>

      {/* Typing Bubble */}
      <div className='rounded-2xl rounded-bl-sm bg-muted px-4 py-3'>
        <TypingDots />
      </div>
    </div>
  );
}

/**
 * Animated dots component
 */
function TypingDots() {
  return (
    <div className='flex items-center gap-1' aria-hidden='true'>
      <span
        className='h-2 w-2 rounded-full bg-muted-foreground animate-bounce'
        style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
      />
      <span
        className='h-2 w-2 rounded-full bg-muted-foreground animate-bounce'
        style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
      />
      <span
        className='h-2 w-2 rounded-full bg-muted-foreground animate-bounce'
        style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
      />
    </div>
  );
}
