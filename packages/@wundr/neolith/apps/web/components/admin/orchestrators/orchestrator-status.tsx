'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ORCHESTRATOR_STATUS_CONFIG } from '@/types/orchestrator';

import type { OrchestratorStatus } from '@/types/orchestrator';

interface OrchestratorStatusProps {
  status: OrchestratorStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OrchestratorStatusBadge({
  status,
  showLabel = true,
  size = 'md',
  className,
}: OrchestratorStatusProps) {
  const config = ORCHESTRATOR_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge
      variant='outline'
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', getStatusDotColor(status))} />
      {showLabel && config.label}
    </Badge>
  );
}

function getStatusDotColor(status: OrchestratorStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'bg-green-500';
    case 'OFFLINE':
      return 'bg-gray-400';
    case 'BUSY':
      return 'bg-yellow-500';
    case 'AWAY':
      return 'bg-orange-500';
    default:
      return 'bg-gray-400';
  }
}
