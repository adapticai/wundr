'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { VPStatus } from '@/types/vp';

export type VPPresenceStatus = 'online' | 'offline' | 'working' | 'idle';

interface VPPresenceIndicatorProps {
  status: VPPresenceStatus;
  vpStatus?: VPStatus;
  currentActivity?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const presenceConfig: Record<VPPresenceStatus, {
  label: string;
  color: string;
  bgColor: string;
  animated: boolean;
}> = {
  online: {
    label: 'Online',
    color: 'text-green-700',
    bgColor: 'bg-green-500',
    animated: false,
  },
  offline: {
    label: 'Offline',
    color: 'text-gray-700',
    bgColor: 'bg-gray-400',
    animated: false,
  },
  working: {
    label: 'Working',
    color: 'text-blue-700',
    bgColor: 'bg-blue-500',
    animated: true,
  },
  idle: {
    label: 'Idle',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-500',
    animated: false,
  },
};

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export function VPPresenceIndicator({
  status,
  vpStatus,
  currentActivity,
  size = 'md',
  showLabel = false,
  className,
}: VPPresenceIndicatorProps) {
  const config = presenceConfig[status];

  const indicator = (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        className,
      )}
    >
      <span className={cn('relative inline-flex', sizeClasses[size])}>
        {config.animated && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              config.bgColor,
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClasses[size],
            config.bgColor,
          )}
          role="status"
          aria-label={config.label}
        />
      </span>
      {showLabel && (
        <span className={cn('text-sm font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );

  // Show tooltip if there's activity information
  if (currentActivity || vpStatus) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{indicator}</TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="text-sm font-medium">{config.label}</p>
              {vpStatus && (
                <p className="text-xs text-muted-foreground">
                  Status: {vpStatus}
                </p>
              )}
              {currentActivity && (
                <p className="text-xs text-muted-foreground">
                  {currentActivity}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return indicator;
}

// Composite component that shows both presence and current activity
interface VPPresenceCardProps {
  status: VPPresenceStatus;
  vpStatus?: VPStatus;
  vpName: string;
  currentActivity?: string;
  lastActiveAt?: Date;
  className?: string;
}

export function VPPresenceCard({
  status,
  vpName,
  currentActivity,
  lastActiveAt,
  className,
}: VPPresenceCardProps) {
  const config = presenceConfig[status];

  const formatLastActive = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-card p-4',
        className,
      )}
    >
      <VPPresenceIndicator status={status} size="md" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{vpName}</h4>
          <span className={cn('text-xs font-medium', config.color)}>
            {config.label}
          </span>
        </div>
        {currentActivity && (
          <p className="text-sm text-muted-foreground">
            {currentActivity}
          </p>
        )}
        {lastActiveAt && status !== 'working' && (
          <p className="text-xs text-muted-foreground">
            Last active: {formatLastActive(lastActiveAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// Animated typing indicator for when VP is actively working
export function VPTypingIndicator({ vpName }: { vpName: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
      <span>{vpName} is typing...</span>
    </div>
  );
}
