/**
 * Session Manager Card Component
 *
 * Card used in list view to display a session manager's key details
 * with quick actions for viewing, activating, and deactivating.
 */
'use client';

import {
  Users,
  Play,
  Pause,
  ExternalLink,
  StopCircle,
  Zap,
  Globe,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SessionManagerCardProps {
  sessionManager: {
    id: string;
    name: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
    isGlobal: boolean;
    disciplineId?: string;
    maxConcurrentSubagents: number;
    tokenBudgetPerHour: number;
    subagents: Array<{ id: string; name: string; status: string }>;
  };
  onViewDetails?: (id: string) => void;
  onToggleStatus?: (id: string, currentStatus: string) => void;
  onStopAllSessions?: (id: string) => void;
  className?: string;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50 border-green-200',
  INACTIVE: 'text-gray-600 bg-gray-50 border-gray-200',
  PAUSED: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  ERROR: 'text-red-700 bg-red-50 border-red-200',
};

export function SessionManagerCard({
  sessionManager: sm,
  onViewDetails,
  onToggleStatus,
  onStopAllSessions,
  className,
}: SessionManagerCardProps) {
  const activeAgents = sm.subagents.filter(sa => sa.status === 'ACTIVE').length;

  const isToggling = sm.status === 'ACTIVE' || sm.status === 'INACTIVE';

  return (
    <Card
      className={cn(
        'group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all',
        className
      )}
      onClick={() => onViewDetails?.(sm.id)}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-3'>
          {/* Icon */}
          <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Users className='h-5 w-5' />
          </div>

          {/* Title block */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2'>
              <CardTitle className='text-base truncate leading-tight'>
                {sm.name}
              </CardTitle>
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full flex-shrink-0',
                  STATUS_DOT[sm.status] ?? 'bg-gray-400'
                )}
                title={sm.status}
              />
            </div>
            {sm.description && (
              <CardDescription className='mt-0.5 line-clamp-2 text-xs'>
                {sm.description}
              </CardDescription>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className='flex flex-wrap gap-1.5 mt-2'>
          <Badge
            className={cn(
              'text-xs border',
              STATUS_BADGE[sm.status] ??
                'text-gray-600 bg-gray-50 border-gray-200'
            )}
          >
            {sm.status}
          </Badge>
          {sm.isGlobal && (
            <Badge variant='outline' className='text-xs gap-1'>
              <Globe className='h-3 w-3' />
              Global
            </Badge>
          )}
          {sm.disciplineId && (
            <Badge variant='secondary' className='text-xs'>
              {sm.disciplineId}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className='pt-0 space-y-3'>
        {/* Stats row */}
        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Users className='h-3.5 w-3.5' />
            <span className='tabular-nums'>{sm.subagents.length}</span>
            <span>agents</span>
            {activeAgents > 0 && (
              <span className='text-green-600 font-medium'>
                ({activeAgents} active)
              </span>
            )}
          </span>
          <span className='flex items-center gap-1'>
            <Zap className='h-3.5 w-3.5' />
            <span className='tabular-nums'>
              {sm.tokenBudgetPerHour >= 1000
                ? `${(sm.tokenBudgetPerHour / 1000).toFixed(0)}K`
                : sm.tokenBudgetPerHour}
            </span>
            <span>tok/hr</span>
          </span>
        </div>

        {/* Capacity bar */}
        {sm.maxConcurrentSubagents > 0 && (
          <div>
            <div className='flex justify-between text-xs text-muted-foreground mb-1'>
              <span>Capacity</span>
              <span className='tabular-nums'>
                {activeAgents} / {sm.maxConcurrentSubagents}
              </span>
            </div>
            <div className='w-full bg-muted rounded-full h-1.5'>
              <div
                className='bg-primary rounded-full h-1.5 transition-all'
                style={{
                  width: `${Math.min(
                    (activeAgents / sm.maxConcurrentSubagents) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div
          className='flex items-center gap-1 pt-1'
          onClick={e => e.stopPropagation()}
        >
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            onClick={() => onViewDetails?.(sm.id)}
          >
            <ExternalLink className='h-3.5 w-3.5 mr-1' />
            Details
          </Button>

          {isToggling && (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs'
              onClick={() => onToggleStatus?.(sm.id, sm.status)}
              title={sm.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            >
              {sm.status === 'ACTIVE' ? (
                <>
                  <Pause className='h-3.5 w-3.5 mr-1' />
                  Pause
                </>
              ) : (
                <>
                  <Play className='h-3.5 w-3.5 mr-1' />
                  Activate
                </>
              )}
            </Button>
          )}

          {sm.status === 'ACTIVE' && onStopAllSessions && (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs text-destructive hover:text-destructive'
              onClick={() => onStopAllSessions(sm.id)}
              title='Stop all sessions'
            >
              <StopCircle className='h-3.5 w-3.5 mr-1' />
              Stop All
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionManagerCard;
