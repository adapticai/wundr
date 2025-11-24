'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

import type { Reaction } from '@/types/chat';

interface ReactionDisplayProps {
  reactions: Reaction[];
  onToggleReaction: (emoji: string) => void;
  className?: string;
}

export function ReactionDisplay({
  reactions,
  onToggleReaction,
  className,
}: ReactionDisplayProps) {
  if (reactions.length === 0) {
return null;
}

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {reactions.map((reaction) => (
        <ReactionBadge
          key={reaction.emoji}
          reaction={reaction}
          onClick={() => onToggleReaction(reaction.emoji)}
        />
      ))}
    </div>
  );
}

interface ReactionBadgeProps {
  reaction: Reaction;
  onClick: () => void;
}

function ReactionBadge({ reaction, onClick }: ReactionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getUserNames = () => {
    if (reaction.users.length === 0) {
return '';
}
    if (reaction.users.length === 1) {
return reaction.users[0].name;
}
    if (reaction.users.length === 2) {
      return `${reaction.users[0].name} and ${reaction.users[1].name}`;
    }
    if (reaction.users.length <= 5) {
      const names = reaction.users.slice(0, -1).map((u) => u.name).join(', ');
      return `${names}, and ${reaction.users[reaction.users.length - 1].name}`;
    }
    const names = reaction.users.slice(0, 3).map((u) => u.name).join(', ');
    return `${names}, and ${reaction.users.length - 3} others`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors',
          reaction.hasReacted
            ? 'border-primary/50 bg-primary/10 text-primary hover:border-primary'
            : 'border-border bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted',
        )}
      >
        <span className="text-base">{reaction.emoji}</span>
        <span className="min-w-[1ch] text-xs font-medium">{reaction.count}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && reaction.users.length > 0 && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
          {getUserNames()}
          <div className="absolute left-1/2 top-full -translate-x-1/2">
            <div className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-popover" />
          </div>
        </div>
      )}
    </div>
  );
}
