'use client';

import { cn } from '@/lib/utils';
import { VP_STATUS_CONFIG } from '@/types/vp';

import type { VPStatus } from '@/types/vp';

interface VPStatusBadgeProps {
  status: VPStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
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
}: VPStatusBadgeProps) {
  const config = VP_STATUS_CONFIG[status];

  return (
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
      {showPulse && status === 'ACTIVE' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {showPulse && status === 'PROVISIONING' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-stone-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-stone-500" />
        </span>
      )}
      {showPulse && status === 'ERROR' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
      {showPulse && (status === 'INACTIVE' || status === 'SUSPENDED') && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-400" />
        </span>
      )}
      {config.label}
    </span>
  );
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
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PROVISIONING: 'bg-stone-500',
  ERROR: 'bg-red-500',
  SUSPENDED: 'bg-yellow-500',
};

export function VPStatusDot({
  status,
  size = 'md',
  showPulse = true,
  className,
}: VPStatusDotProps) {
  const isAnimated = showPulse && (status === 'ACTIVE' || status === 'PROVISIONING');

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
            status === 'ACTIVE' ? 'animate-ping bg-green-400' : 'animate-pulse bg-stone-400',
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
