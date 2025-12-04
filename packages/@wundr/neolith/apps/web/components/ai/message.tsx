'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const messageVariants = cva('flex gap-3 w-full', {
  variants: {
    from: {
      user: 'flex-row-reverse',
      assistant: 'flex-row',
      system: 'justify-center',
    },
  },
  defaultVariants: {
    from: 'assistant',
  },
});

const bubbleVariants = cva('rounded-2xl px-4 py-3 max-w-[85%]', {
  variants: {
    from: {
      user: 'bg-primary text-primary-foreground rounded-br-sm',
      assistant: 'bg-muted rounded-bl-sm',
      system: 'bg-muted/50 text-muted-foreground text-sm italic',
    },
  },
  defaultVariants: {
    from: 'assistant',
  },
});

export type MessageFrom = 'user' | 'assistant' | 'system';

export interface MessageAvatarProps {
  src?: string;
  name?: string;
  fallback?: string;
}

export interface MessageProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  from?: MessageFrom;
  avatar?: MessageAvatarProps;
  timestamp?: Date | string;
  children?: React.ReactNode;
}

export function Message({
  from = 'assistant',
  avatar,
  timestamp,
  children,
  className,
  ...props
}: MessageProps) {
  const formatTimestamp = (ts: Date | string): string => {
    const date = typeof ts === 'string' ? new Date(ts) : ts;
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn(messageVariants({ from }), className)} {...props}>
      {avatar && from !== 'system' && (
        <MessageAvatar
          src={avatar.src}
          name={avatar.name}
          fallback={avatar.fallback}
        />
      )}
      <div className='flex flex-col gap-1'>
        <div className={bubbleVariants({ from })}>{children}</div>
        {timestamp && (
          <span
            className={cn(
              'text-xs text-muted-foreground px-1',
              from === 'user' ? 'text-right' : 'text-left'
            )}
          >
            {formatTimestamp(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

export function MessageContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageAvatar({ src, name, fallback }: MessageAvatarProps) {
  const initials = name ? name.slice(0, 2).toUpperCase() : fallback || 'AI';

  return (
    <Avatar className='h-8 w-8 shrink-0'>
      {src && <AvatarImage src={src} alt={name || 'Avatar'} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
