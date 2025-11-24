'use client';

import { cn } from '@/lib/utils';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/**
 * Props for the PresenceIndicator component
 */
export interface PresenceIndicatorProps {
  /** Current presence status */
  status: PresenceStatus;
  /** Size of the indicator */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show a pulsing animation when online */
  showPulse?: boolean;
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
  /** Last seen timestamp for offline users */
  lastSeen?: Date | null;
  /** Custom status text to display */
  statusText?: string;
  /** Optional CSS class name */
  className?: string;
}

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const statusColors: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400',
};

const statusLabels: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

export function PresenceIndicator({
  status,
  size = 'md',
  showPulse = true,
  showTooltip = false,
  lastSeen,
  statusText,
  className,
}: PresenceIndicatorProps) {
  const isAnimated = showPulse && status === 'online';

  const tooltipContent = getTooltipContent(status, lastSeen, statusText);

  return (
    <span
      className={cn('relative inline-flex', sizeClasses[size], className)}
      role="status"
      aria-label={tooltipContent}
      title={showTooltip ? tooltipContent : undefined}
    >
      {isAnimated && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            'bg-green-400',
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeClasses[size],
          statusColors[status],
        )}
      />
    </span>
  );
}

function getTooltipContent(
  status: PresenceStatus,
  lastSeen?: Date | null,
  statusText?: string,
): string {
  let content = statusLabels[status];

  if (statusText) {
    content += `: ${statusText}`;
  }

  if (status === 'offline' && lastSeen) {
    content += ` - Last seen ${formatLastSeen(lastSeen)}`;
  }

  return content;
}

function formatLastSeen(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Props for the PresenceBadge component
 */
export interface PresenceBadgeProps {
  /** Current presence status */
  status: PresenceStatus;
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show a pulsing animation when online */
  showPulse?: boolean;
  /** Optional CSS class name */
  className?: string;
}

const badgeSizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const statusBgColors: Record<PresenceStatus, string> = {
  online: 'bg-green-100 dark:bg-green-900/30',
  away: 'bg-yellow-100 dark:bg-yellow-900/30',
  busy: 'bg-red-100 dark:bg-red-900/30',
  offline: 'bg-gray-100 dark:bg-gray-800',
};

const statusTextColors: Record<PresenceStatus, string> = {
  online: 'text-green-700 dark:text-green-300',
  away: 'text-yellow-700 dark:text-yellow-300',
  busy: 'text-red-700 dark:text-red-300',
  offline: 'text-gray-700 dark:text-gray-300',
};

export function PresenceBadge({
  status,
  size = 'md',
  showPulse = true,
  className,
}: PresenceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        statusBgColors[status],
        statusTextColors[status],
        badgeSizeClasses[size],
        className,
      )}
      role="status"
      aria-label={`Status: ${statusLabels[status]}`}
    >
      <PresenceIndicator status={status} size="sm" showPulse={showPulse} />
      {statusLabels[status]}
    </span>
  );
}

export { statusColors, statusLabels };
