'use client';

import { memo, useCallback, useMemo } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { Reaction } from '@/types/chat';

/**
 * User data for reaction tooltips
 */
interface ReactionUser {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
}

/**
 * Extended reaction type with user details
 */
export interface ReactionWithUsers extends Reaction {
  users?: ReactionUser[];
}

/**
 * Props for the ReactionDisplay component
 */
interface ReactionDisplayProps {
  /** Array of reactions to display */
  reactions: readonly ReactionWithUsers[];
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
    <TooltipProvider delayDuration={300}>
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
    </TooltipProvider>
  );
});

interface ReactionBadgeProps {
  reaction: ReactionWithUsers;
  onClick: () => void;
}

const ReactionBadge = memo(function ReactionBadge({
  reaction,
  onClick,
}: ReactionBadgeProps) {
  /**
   * Generate user names for tooltip display
   * Shows individual names for small groups, count for large groups
   */
  const tooltipContent = useMemo(() => {
    if (!reaction.users || reaction.users.length === 0) {
      if (reaction.count === 0) {
        return null;
      }
      if (reaction.count === 1) {
        return '1 person reacted';
      }
      return `${reaction.count} people reacted`;
    }

    const names = reaction.users.map(
      user => user.displayName || user.name || 'Unknown User',
    );

    // For 1-5 users, show all names
    if (names.length <= 5) {
      if (names.length === 1) {
        return names[0];
      }
      if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
      }
      const lastName = names.pop();
      return `${names.join(', ')}, and ${lastName}`;
    }

    // For 6+ users, show first few and count
    const displayNames = names.slice(0, 3);
    const remaining = names.length - 3;
    return `${displayNames.join(', ')}, and ${remaining} ${remaining === 1 ? 'other' : 'others'}`;
  }, [reaction.users, reaction.count]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  const reactionCount = Number.isNaN(reaction.count) ? 0 : reaction.count ?? 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          onClick={handleClick}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            reaction.hasReacted
              ? 'border-primary/50 bg-primary/10 text-primary hover:border-primary hover:bg-primary/20 shadow-sm'
              : 'border-border bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted',
          )}
          aria-label={`${reaction.emoji} reaction, ${reactionCount} ${reactionCount === 1 ? 'person' : 'people'}`}
        >
          <span className='text-base leading-none' aria-hidden='true'>
            {reaction.emoji}
          </span>
          <span className='min-w-[1ch] text-xs font-medium tabular-nums'>
            {reactionCount}
          </span>
        </button>
      </TooltipTrigger>
      {tooltipContent && (
        <TooltipContent side='top' className='max-w-xs'>
          <p className='text-xs'>{tooltipContent}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
});
