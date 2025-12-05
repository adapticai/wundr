'use client';

import * as React from 'react';
import { X, Sparkles, TrendingUp, Clock, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface Suggestion {
  id: string;
  text: string;
  category:
    | 'quick-action'
    | 'recent'
    | 'trending'
    | 'recommended'
    | 'personalized';
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  onDismiss?: (suggestionId: string) => void;
  isLoading?: boolean;
  maxVisible?: number;
  showCategories?: boolean;
  className?: string;
  variant?: 'pills' | 'chips' | 'compact';
  position?: 'top' | 'bottom' | 'floating';
}

const categoryConfig = {
  'quick-action': {
    icon: Zap,
    label: 'Quick Action',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  recent: {
    icon: Clock,
    label: 'Recent',
    color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  },
  trending: {
    icon: TrendingUp,
    label: 'Trending',
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  },
  recommended: {
    icon: Star,
    label: 'Recommended',
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  },
  personalized: {
    icon: Sparkles,
    label: 'For You',
    color: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  },
};

export function SmartSuggestions({
  suggestions,
  onSelect,
  onDismiss,
  isLoading = false,
  maxVisible = 5,
  showCategories = true,
  className,
  variant = 'pills',
  position = 'floating',
}: SmartSuggestionsProps) {
  const [visibleSuggestions, setVisibleSuggestions] = React.useState<
    Suggestion[]
  >([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);

  React.useEffect(() => {
    setVisibleSuggestions(suggestions.slice(0, maxVisible));
  }, [suggestions, maxVisible]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (visibleSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < visibleSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : visibleSuggestions.length - 1
          );
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < visibleSuggestions.length) {
            e.preventDefault();
            onSelect(visibleSuggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleSuggestions, selectedIndex, onSelect]);

  const handleDismiss = (e: React.MouseEvent, suggestionId: string) => {
    e.stopPropagation();
    setVisibleSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    onDismiss?.(suggestionId);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className='h-8 w-32 rounded-full' />
        ))}
      </div>
    );
  }

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const positionClasses = {
    top: 'justify-start',
    bottom: 'justify-end',
    floating: 'justify-center',
  };

  const variantClasses = {
    pills: 'gap-2 flex-wrap',
    chips: 'gap-1.5 flex-wrap',
    compact: 'gap-1 flex-nowrap overflow-x-auto',
  };

  return (
    <div
      className={cn(
        'flex items-center',
        positionClasses[position],
        variantClasses[variant],
        className
      )}
      role='listbox'
      aria-label='AI suggestions'
    >
      {visibleSuggestions.map((suggestion, index) => {
        const config = categoryConfig[suggestion.category];
        const Icon = config.icon;
        const isSelected = index === selectedIndex;

        return (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
              'hover:scale-105 active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              config.color,
              isSelected && 'ring-2 ring-primary scale-105',
              variant === 'pills' && 'px-4 py-2',
              variant === 'compact' && 'px-2.5 py-1 text-xs'
            )}
            role='option'
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
          >
            {showCategories && (
              <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
            )}
            <span className='truncate'>{suggestion.text}</span>
            {suggestion.confidence && suggestion.confidence > 0.8 && (
              <Badge
                variant='secondary'
                className='ml-1 h-4 px-1 text-[10px] font-semibold'
              >
                {Math.round(suggestion.confidence * 100)}%
              </Badge>
            )}
            {onDismiss && (
              <X
                className={cn(
                  'h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100',
                  'hover:text-destructive'
                )}
                onClick={e => handleDismiss(e, suggestion.id)}
                aria-label='Dismiss suggestion'
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Group suggestions by category
export function GroupedSmartSuggestions({
  suggestions,
  onSelect,
  onDismiss,
  isLoading = false,
  className,
}: Omit<SmartSuggestionsProps, 'maxVisible' | 'variant' | 'position'>) {
  const groupedSuggestions = React.useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    suggestions.forEach(suggestion => {
      if (!groups[suggestion.category]) {
        groups[suggestion.category] = [];
      }
      groups[suggestion.category].push(suggestion);
    });
    return groups;
  }, [suggestions]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <div className='flex gap-2'>
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className='h-8 w-32 rounded-full' />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(groupedSuggestions).map(
        ([category, categorySuggestions]) => {
          const config =
            categoryConfig[category as keyof typeof categoryConfig];
          if (!config) return null;

          return (
            <div key={category} className='space-y-2'>
              <div className='flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                <config.icon className='h-3.5 w-3.5' />
                {config.label}
              </div>
              <SmartSuggestions
                suggestions={categorySuggestions}
                onSelect={onSelect}
                onDismiss={onDismiss}
                showCategories={false}
                variant='pills'
                position='top'
              />
            </div>
          );
        }
      )}
    </div>
  );
}
