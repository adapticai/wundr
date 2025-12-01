'use client';

import { cn } from '@/lib/utils';

import type { TypingUser } from '@/types/chat';

/**
 * Props for the TypingIndicator component
 */
interface TypingIndicatorProps {
  /** Array of users currently typing */
  typingUsers: TypingUser[];
  /** Additional CSS class names */
  className?: string;
}

export function TypingIndicator({
  typingUsers,
  className,
}: TypingIndicatorProps) {
  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user.name} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].user.name} and ${typingUsers[1].user.name} are typing`;
    }
    if (typingUsers.length === 3) {
      return `${typingUsers[0].user.name}, ${typingUsers[1].user.name}, and ${typingUsers[2].user.name} are typing`;
    }
    return `${typingUsers[0].user.name} and ${typingUsers.length - 1} others are typing`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground',
        className
      )}
    >
      <TypingDots />
      <span>{getTypingText()}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className='flex items-center gap-1'>
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]' />
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]' />
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground' />
    </div>
  );
}
