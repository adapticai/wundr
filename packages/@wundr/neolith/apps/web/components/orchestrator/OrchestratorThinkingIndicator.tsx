'use client';

import { Bot, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

interface OrchestratorThinkingIndicatorProps {
  orchestratorName?: string;
  taskContext?: string;
  variant?: 'dots' | 'spinner' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'gap-1.5 py-1 px-2',
    icon: 'h-3 w-3',
    dot: 'h-1 w-1',
    text: 'text-xs',
  },
  md: {
    container: 'gap-2 py-2 px-3',
    icon: 'h-4 w-4',
    dot: 'h-1.5 w-1.5',
    text: 'text-sm',
  },
  lg: {
    container: 'gap-2.5 py-3 px-4',
    icon: 'h-5 w-5',
    dot: 'h-2 w-2',
    text: 'text-base',
  },
};

export function OrchestratorThinkingIndicator({
  orchestratorName,
  taskContext,
  variant = 'dots',
  size = 'md',
  showText = true,
  className,
}: OrchestratorThinkingIndicatorProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-primary/10',
        sizes.container,
        className
      )}
      role='status'
      aria-live='polite'
      aria-label={`${orchestratorName || 'Orchestrator'} is working`}
    >
      <Bot className={cn('text-primary', sizes.icon)} />

      {variant === 'dots' && <ThinkingDots size={size} />}
      {variant === 'spinner' && (
        <Loader2 className={cn('animate-spin text-primary', sizes.icon)} />
      )}
      {variant === 'pulse' && <PulsingDot size={size} />}

      {showText && (
        <span className={cn('font-medium text-primary', sizes.text)}>
          {orchestratorName
            ? `${orchestratorName} is working`
            : 'Orchestrator is working'}
          {taskContext && (
            <span className='text-muted-foreground'>: {taskContext}</span>
          )}
        </span>
      )}
    </div>
  );
}

// Three-dot animation component
function ThinkingDots({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizes = sizeClasses[size];

  return (
    <div className='flex items-center gap-1'>
      <span
        className={cn('animate-bounce rounded-full bg-primary', sizes.dot)}
        style={{ animationDelay: '0ms', animationDuration: '1000ms' }}
      />
      <span
        className={cn('animate-bounce rounded-full bg-primary', sizes.dot)}
        style={{ animationDelay: '150ms', animationDuration: '1000ms' }}
      />
      <span
        className={cn('animate-bounce rounded-full bg-primary', sizes.dot)}
        style={{ animationDelay: '300ms', animationDuration: '1000ms' }}
      />
    </div>
  );
}

// Pulsing dot component
function PulsingDot({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizes = sizeClasses[size];

  return (
    <span className='relative flex'>
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75',
          sizes.dot
        )}
      />
      <span
        className={cn(
          'relative inline-flex rounded-full bg-primary',
          sizes.dot
        )}
      />
    </span>
  );
}

// Inline thinking indicator for chat messages
interface InlineThinkingIndicatorProps {
  className?: string;
}

export function InlineThinkingIndicator({
  className,
}: InlineThinkingIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2',
        className
      )}
    >
      <Bot className='h-4 w-4 text-muted-foreground' />
      <ThinkingDots size='sm' />
    </div>
  );
}

// Typing indicator with changing text
interface TypingIndicatorProps {
  messages?: string[];
  interval?: number;
  className?: string;
}

export function TypingIndicator({
  messages = ['Thinking', 'Processing', 'Working'],
  interval = 2000,
  className,
}: TypingIndicatorProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [messages.length, interval]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2',
        className
      )}
    >
      <Bot className='h-4 w-4 text-primary' />
      <span className='text-sm font-medium text-muted-foreground'>
        {messages[messageIndex]}
      </span>
      <ThinkingDots size='sm' />
    </div>
  );
}

// Full-width processing banner
interface ProcessingBannerProps {
  vpName: string;
  taskName?: string;
  onCancel?: () => void;
  className?: string;
}

export function ProcessingBanner({
  vpName,
  taskName,
  onCancel,
  className,
}: ProcessingBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3',
        className
      )}
    >
      <div className='flex items-center gap-3'>
        <div className='relative'>
          <Bot className='h-5 w-5 text-primary' />
          <span className='absolute -bottom-1 -right-1 flex h-3 w-3'>
            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75' />
            <span className='relative inline-flex h-3 w-3 rounded-full bg-primary' />
          </span>
        </div>
        <div className='space-y-0.5'>
          <p className='text-sm font-medium'>
            {vpName} is processing your request
          </p>
          {taskName && (
            <p className='text-xs text-muted-foreground'>{taskName}</p>
          )}
        </div>
      </div>
      {onCancel && (
        <button
          type='button'
          onClick={onCancel}
          className='text-sm font-medium text-muted-foreground hover:text-foreground'
        >
          Cancel
        </button>
      )}
    </div>
  );
}
