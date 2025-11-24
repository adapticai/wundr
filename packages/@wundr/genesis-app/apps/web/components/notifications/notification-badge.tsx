'use client';

import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  count: number;
  maxDisplay?: number;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 min-w-4 text-[10px]',
  md: 'h-5 min-w-5 text-xs',
  lg: 'h-6 min-w-6 text-sm',
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
        className
      )}
      role="status"
      aria-label={`${count} unread notifications`}
    >
      {isNew && (
        <span
          className={cn(
            'absolute inset-0 rounded-full bg-destructive opacity-75 animate-ping'
          )}
        />
      )}
      <span className="relative">{displayCount}</span>
    </span>
  );
}

interface NotificationDotProps {
  show?: boolean;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
      role="status"
      aria-label="New notification"
    >
      {showPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping'
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full bg-destructive',
          dotSizeClasses[size]
        )}
      />
    </span>
  );
}
