'use client';

import { useState, memo, useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { Reaction } from '@/types/chat';

/**
 * Props for the ReactionDisplay component
 */
interface ReactionDisplayProps {
  /** Array of reactions to display */
  reactions: readonly Reaction[];
  /** Callback fired when toggling a reaction */
  onToggleReaction: (emoji: string) => void;
  /** Additional CSS class names */
  className?: string;
}

export const ReactionDisplay = memo(function ReactionDisplay({
  reactions,
  onToggleReaction,
  className,
}: ReactionDisplayProps) {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap gap-1', className)}
      role='group'
      aria-label='Message reactions'
    >
      {reactions.map(reaction => (
        <ReactionBadge
          key={reaction.emoji}
          reaction={reaction}
          onClick={() => onToggleReaction(reaction.emoji)}
        />
      ))}
    </div>
  );
});

interface ReactionBadgeProps {
  reaction: Reaction;
  onClick: () => void;
}

const ReactionBadge = memo(function ReactionBadge({
  reaction,
  onClick,
}: ReactionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getUserNames = useCallback(() => {
    // Note: The Reaction type uses userIds, not user objects
    // This function would need user data from a parent context or prop
    // For now, returning a simple count message
    if (reaction.count === 0) {
      return '';
    }
    if (reaction.count === 1) {
      return '1 person reacted';
    }
    return `${reaction.count} people reacted`;
  }, [reaction.count]);

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          reaction.hasReacted
            ? 'border-primary/50 bg-primary/10 text-primary hover:border-primary'
            : 'border-border bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted'
        )}
        aria-label={`${reaction.emoji} reaction, ${Number.isNaN(reaction.count) ? 0 : (reaction.count ?? 0)} ${reaction.count === 1 ? 'person' : 'people'}`}
      >
        <span className='text-base leading-none' aria-hidden='true'>
          {reaction.emoji}
        </span>
        <span className='min-w-[1ch] text-xs font-medium tabular-nums'>
          {Number.isNaN(reaction.count) ? 0 : (reaction.count ?? 0)}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && reaction.count > 0 && (
        <div
          className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-border'
          role='tooltip'
        >
          {getUserNames()}
          <div className='absolute left-1/2 top-full -translate-x-1/2'>
            <div className='h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-popover' />
          </div>
        </div>
      )}
    </div>
  );
});
