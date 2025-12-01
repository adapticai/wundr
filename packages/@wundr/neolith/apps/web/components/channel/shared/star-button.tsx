'use client';

import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the StarButton component
 */
interface StarButtonProps {
  /** Whether the item is starred */
  isStarred: boolean;
  /** Whether the star toggle is in progress */
  isLoading?: boolean;
  /** Callback when star is toggled */
  onToggle?: () => void;
  /** Additional class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

/**
 * Shared star/favorite button for Channels and DMs
 */
export function StarButton({
  isStarred,
  isLoading = false,
  onToggle,
  className,
  size = 'default',
}: StarButtonProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <Button
      variant='ghost'
      size='icon'
      className={cn(buttonSize, className)}
      onClick={onToggle}
      disabled={isLoading}
      title={isStarred ? 'Unstar' : 'Star'}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : (
        <Star
          className={cn(
            iconSize,
            isStarred && 'fill-yellow-400 text-yellow-400'
          )}
        />
      )}
    </Button>
  );
}

export default StarButton;
