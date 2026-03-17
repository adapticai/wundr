'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function SuggestionChips({
  suggestions,
  onSelect,
  className,
}: SuggestionChipsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 scrollbar-none',
        className
      )}
    >
      {suggestions.map(suggestion => (
        <button
          key={suggestion}
          type='button'
          onClick={() => onSelect(suggestion)}
          className={cn(
            'flex-shrink-0 rounded-full border border-border bg-background',
            'px-3.5 py-1.5 text-sm text-muted-foreground',
            'hover:text-foreground hover:bg-muted transition-colors cursor-pointer',
            'whitespace-nowrap'
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
