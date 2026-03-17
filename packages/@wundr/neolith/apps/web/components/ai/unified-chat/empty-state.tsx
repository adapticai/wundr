'use client';

import { Sparkles } from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import type { ChatPersona } from './types';

interface EmptyStateProps {
  persona: ChatPersona;
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

export function EmptyState({
  persona,
  onSuggestionClick,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center flex-1 gap-6 px-6 py-12 text-center',
        className
      )}
    >
      <div className='relative'>
        <Avatar className='h-16 w-16 ring-2 ring-border'>
          {persona.avatar?.src && (
            <AvatarImage src={persona.avatar.src} alt={persona.name} />
          )}
          <AvatarFallback className='bg-primary/10 text-primary text-lg'>
            {persona.avatar?.fallback ?? <Sparkles className='h-7 w-7' />}
          </AvatarFallback>
        </Avatar>
        <span
          className='absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background'
          aria-label='Online'
        />
      </div>

      <div className='space-y-1.5 max-w-sm'>
        <p className='text-base font-semibold text-foreground'>
          {persona.name}
        </p>
        <p className='text-sm text-muted-foreground leading-relaxed'>
          {persona.greeting}
        </p>
      </div>

      {persona.suggestions && persona.suggestions.length > 0 && (
        <div className='flex flex-wrap justify-center gap-2 max-w-md'>
          {persona.suggestions.map(suggestion => (
            <button
              key={suggestion}
              type='button'
              onClick={() => onSuggestionClick?.(suggestion)}
              className={cn(
                'rounded-full border border-border bg-background px-3.5 py-1.5',
                'text-sm text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors cursor-pointer'
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
