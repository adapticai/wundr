'use client';

import { cn } from '@/lib/utils';

/**
 * Props for the NotificationBadge component
 */
interface NotificationBadgeProps {
  /** Number of notifications to display */
  count: number;
  /** Maximum count to display before showing '+' */
  maxDisplay?: number;
  /** Whether to show a pulsing animation */
  showPulse?: boolean;
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Optional CSS class name */
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 min-w-4 text-[10px] font-sans',
  md: 'h-5 min-w-5 text-xs font-sans',
  lg: 'h-6 min-w-6 text-sm font-sans',
};

export function NotificationBadge({
  count,
  maxDisplay = 99,
  showPulse = false,
  size = 'md',
  className,
}: NotificationBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > maxDisplay ? `${maxDisplay}+` : count.toString();
  const isNew = showPulse && count > 0;

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-destructive px-1.5 font-medium text-destructive-foreground',
        sizeClasses[size],
        className,
      )}
      role='status'
      aria-label={`${count} unread notifications`}
    >
      {isNew && (
        <span
          className={cn(
            'absolute inset-0 rounded-full bg-destructive opacity-75 animate-ping',
          )}
        />
      )}
      <span className='relative'>{displayCount}</span>
    </span>
  );
}

/**
 * Props for the NotificationDot component
 */
interface NotificationDotProps {
  /** Whether to show the dot */
  show?: boolean;
  /** Whether to show a pulsing animation */
  showPulse?: boolean;
  /** Size of the dot */
  size?: 'sm' | 'md' | 'lg';
  /** Optional CSS class name */
  className?: string;
}

const dotSizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export function NotificationDot({
  show = true,
  showPulse = false,
  size = 'md',
  className,
}: NotificationDotProps) {
  if (!show) {
    return null;
  }

  return (
    <span
      className={cn('relative inline-flex', dotSizeClasses[size], className)}
      role='status'
      aria-label='New notification'
    >
      {showPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping',
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full bg-destructive',
          dotSizeClasses[size],
        )}
      />
    </span>
  );
}
