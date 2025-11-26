'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { OrgNode } from './types';

interface OrgChartNodeProps {
  node: OrgNode;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick?: (node: OrgNode) => void;
}

const STATUS_CONFIG = {
  ONLINE: { label: 'Online', color: 'bg-green-500', dotColor: 'bg-green-400' },
  BUSY: { label: 'Busy', color: 'bg-yellow-500', dotColor: 'bg-yellow-400' },
  AWAY: { label: 'Away', color: 'bg-orange-500', dotColor: 'bg-orange-400' },
  OFFLINE: { label: 'Offline', color: 'bg-stone-500', dotColor: 'bg-stone-400' },
};

export function OrgChartNode({ node, isHighlighted, isDimmed, onClick }: OrgChartNodeProps) {
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <div
      className={cn(
        'relative flex flex-col items-center p-4 rounded-lg border transition-all',
        'bg-stone-900 border-stone-800 hover:border-stone-700 cursor-pointer',
        isHighlighted && 'ring-2 ring-stone-100 border-stone-100',
        isDimmed && 'opacity-30',
        !isDimmed && 'hover:shadow-lg',
      )}
      onClick={() => onClick?.(node)}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}, ${node.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(node);
        }
      }}
    >
      <div className="relative">
        <Avatar className="h-16 w-16 border-2 border-stone-800">
          <AvatarImage src={node.avatarUrl} alt={node.name} />
          <AvatarFallback className="bg-stone-800 text-stone-100 text-lg font-semibold">
            {node.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            'absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-stone-900',
            statusConfig.dotColor,
          )}
          aria-label={statusConfig.label}
        />
      </div>
      <div className="mt-3 text-center">
        <h4 className="font-semibold text-stone-100 text-sm">{node.name}</h4>
        <p className="text-xs text-stone-400 mt-1">{node.title}</p>
        <Badge
          variant="secondary"
          className="mt-2 bg-stone-800 text-stone-300 text-xs border-stone-700"
        >
          {node.discipline}
        </Badge>
      </div>
    </div>
  );
}
