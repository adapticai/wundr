'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { VPStatus } from '@/types/orchestrator';
import { VP_STATUS_CONFIG } from '@/types/orchestrator';

interface VPStatusBadgeProps {
  status: VPStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
  currentTask?: string;
  showTooltip?: boolean;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function VPStatusBadge({
  status,
  size = 'md',
  showPulse = true,
  className,
  currentTask,
  showTooltip = false,
}: VPStatusBadgeProps) {
  const config = VP_STATUS_CONFIG[status];

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {showPulse && status === 'ONLINE' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {showPulse && status === 'BUSY' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
        </span>
      )}
      {showPulse && status === 'AWAY' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
        </span>
      )}
      {showPulse && status === 'OFFLINE' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-400" />
        </span>
      )}
      {config.label}
    </span>
  );

  if (showTooltip && currentTask) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              <span className="font-medium">Current task:</span> {currentTask}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

interface VPStatusDotProps {
  status: VPStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const dotSizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const statusDotColors: Record<VPStatus, string> = {
  ONLINE: 'bg-green-500',
  OFFLINE: 'bg-gray-400',
  BUSY: 'bg-yellow-500',
  AWAY: 'bg-orange-500',
};

export function VPStatusDot({
  status,
  size = 'md',
  showPulse = true,
  className,
}: VPStatusDotProps) {
  const isAnimated = showPulse && (status === 'ONLINE' || status === 'BUSY');

  return (
    <span
      className={cn('relative inline-flex', dotSizeClasses[size], className)}
      role="status"
      aria-label={`Status: ${VP_STATUS_CONFIG[status].label}`}
    >
      {isAnimated && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            status === 'ONLINE' ? 'animate-ping bg-green-400' : 'animate-pulse bg-yellow-400',
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          dotSizeClasses[size],
          statusDotColors[status],
        )}
      />
    </span>
  );
}
