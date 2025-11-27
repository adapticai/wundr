'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { VPStatusBadge } from '@/components/orchestrator/orchestrator-status-badge';

import { DISCIPLINE_COLORS, type VPDetailsPopoverProps } from './types';

/**
 * Popover component showing quick Orchestrator details on hover/click
 */
export function VPDetailsPopover({ vp, children }: VPDetailsPopoverProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const disciplineColor = vp.discipline
    ? DISCIPLINE_COLORS[vp.discipline] || 'bg-gray-100 text-gray-800 border-gray-300'
    : 'bg-gray-100 text-gray-800 border-gray-300';

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header with avatar and name */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {vp.avatarUrl && <AvatarImage src={vp.avatarUrl} alt={vp.name} />}
              <AvatarFallback className="text-sm font-semibold">
                {getInitials(vp.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-base truncate">{vp.name}</h4>
              {vp.discipline && (
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${disciplineColor}`}
                >
                  {vp.discipline}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Status section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <OrchestratorStatusBadge status={vp.status} size="sm" />
            </div>

            {/* Current task */}
            {vp.currentTask && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Current Task</span>
                <p className="text-sm text-foreground bg-muted p-2 rounded-md break-words">
                  {vp.currentTask}
                </p>
              </div>
            )}
          </div>

          {/* Actions footer */}
          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 text-xs py-2 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/vp/${vp.id}`;
              }}
            >
              View Details
            </button>
            <button
              className="flex-1 text-xs py-2 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement chat navigation
                console.log('Start chat with VP:', vp.id);
              }}
            >
              Start Chat
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
