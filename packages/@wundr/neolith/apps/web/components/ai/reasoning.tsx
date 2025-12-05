'use client';

import { Brain, ChevronDown } from 'lucide-react';
import * as React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ReasoningProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
  defaultOpen?: boolean;
  className?: string;
}

export function Reasoning({
  content,
  isStreaming = false,
  duration,
  defaultOpen = false,
  className,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [internalDuration, setInternalDuration] = React.useState(0);
  const startTimeRef = React.useRef<number | null>(null);

  // Auto-open during streaming
  React.useEffect(() => {
    if (isStreaming && !isOpen) {
      setIsOpen(true);
      startTimeRef.current = Date.now();
    }

    if (!isStreaming && startTimeRef.current) {
      setInternalDuration(
        Math.round((Date.now() - startTimeRef.current) / 1000),
      );
      // Auto-close after streaming ends (with delay)
      const timer = setTimeout(() => setIsOpen(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen]);

  // Update duration while streaming
  React.useEffect(() => {
    if (!isStreaming || !startTimeRef.current) {
      return;
    }

    const interval = setInterval(() => {
      setInternalDuration(
        Math.round((Date.now() - startTimeRef.current!) / 1000),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const displayDuration = duration ?? internalDuration;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('', className)}
    >
      <ReasoningTrigger isStreaming={isStreaming} duration={displayDuration} />
      <ReasoningContent>{content}</ReasoningContent>
    </Collapsible>
  );
}

interface ReasoningTriggerProps {
  isStreaming?: boolean;
  duration?: number;
  title?: string;
  className?: string;
}

export function ReasoningTrigger({
  isStreaming,
  duration,
  title = 'Reasoning',
  className,
}: ReasoningTriggerProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full',
        className,
      )}
    >
      <Brain
        className={cn('h-4 w-4', isStreaming && 'animate-pulse text-primary')}
      />
      <span className='font-medium'>{title}</span>
      {duration !== undefined && duration > 0 && (
        <span className='text-xs'>
          {isStreaming ? `${duration}s` : `Thought for ${duration}s`}
        </span>
      )}
      <ChevronDown className='h-4 w-4 ml-auto transition-transform [[data-state=open]_&]:rotate-180' />
    </CollapsibleTrigger>
  );
}

interface ReasoningContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ReasoningContent({
  children,
  className,
}: ReasoningContentProps) {
  return (
    <CollapsibleContent>
      <div
        className={cn(
          'mt-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground',
          'prose prose-sm dark:prose-invert max-w-none',
          className,
        )}
      >
        {typeof children === 'string' ? (
          <pre className='whitespace-pre-wrap font-sans'>{children}</pre>
        ) : (
          children
        )}
      </div>
    </CollapsibleContent>
  );
}

interface ReasoningBadgeProps {
  isActive?: boolean;
  duration?: number;
  className?: string;
}

// Simpler inline reasoning indicator
export function ReasoningBadge({
  isActive,
  duration,
  className,
}: ReasoningBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Brain className={cn('h-3 w-3', isActive && 'animate-pulse')} />
      {isActive ? (
        <span>Thinking{duration ? ` (${duration}s)` : '...'}</span>
      ) : (
        <span>Thought for {duration}s</span>
      )}
    </div>
  );
}
