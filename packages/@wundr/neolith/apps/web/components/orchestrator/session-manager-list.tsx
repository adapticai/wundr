/**
 * Session Manager List Component
 *
 * Displays a list of Session Managers for an Orchestrator with status indicators.
 */

'use client';

import { Plus, Settings, Play, Pause, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SessionManager {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  subagents: { id: string; name: string; status: string }[];
  createdAt: string;
}

interface SessionManagerListProps {
  orchestratorId: string;
  onSelect?: (sessionManager: SessionManager) => void;
  onCreateNew?: () => void;
  className?: string;
}

const statusColors = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

export function SessionManagerList({
  orchestratorId,
  onSelect,
  onCreateNew,
  className,
}: SessionManagerListProps) {
  const [sessionManagers, setSessionManagers] = useState<SessionManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestratorId]);

  async function fetchSessionManagers() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/session-managers`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch session managers');
      }
      const { data } = await response.json();
      setSessionManagers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
    try {
      const response = await fetch(`/api/session-managers/${id}/${action}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to ${action} session manager`);
      }
      await fetchSessionManagers();
    } catch (err) {
      console.error(`Failed to ${action} session manager:`, err);
      // TODO: Add toast notification for error
    }
  }

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className='h-32 w-full' />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card
        className={cn(
          'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20',
          className
        )}
      >
        <CardContent className='pt-6'>
          <p className='text-red-600 dark:text-red-400'>Error: {error}</p>
          <Button
            variant='outline'
            onClick={fetchSessionManagers}
            className='mt-2'
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className='flex justify-between items-center'>
        <h2 className='text-lg font-semibold'>Session Managers</h2>
        {onCreateNew && (
          <Button onClick={onCreateNew} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            New Session Manager
          </Button>
        )}
      </div>

      {sessionManagers.length === 0 ? (
        <Card>
          <CardContent className='pt-6 text-center text-muted-foreground'>
            No session managers yet. Create one to start orchestrating Claude
            Code sessions.
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4'>
          {sessionManagers.map(sm => (
            <Card
              key={sm.id}
              className={cn(
                'cursor-pointer hover:border-primary/50 hover:shadow-md transition-all',
                className
              )}
              onClick={() => onSelect?.(sm)}
            >
              <CardHeader className='pb-3'>
                <div className='flex justify-between items-start'>
                  <div className='flex-1'>
                    <CardTitle className='text-base flex items-center gap-2'>
                      {sm.name}
                      {sm.isGlobal && (
                        <Badge variant='outline' className='text-xs'>
                          Global
                        </Badge>
                      )}
                    </CardTitle>
                    {sm.description && (
                      <CardDescription className='mt-1'>
                        {sm.description}
                      </CardDescription>
                    )}
                  </div>
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full flex-shrink-0',
                      statusColors[sm.status]
                    )}
                    title={sm.status}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className='flex justify-between items-center text-sm text-muted-foreground'>
                  <div className='flex items-center gap-4'>
                    <span className='flex items-center gap-1'>
                      <Users className='h-4 w-4' />
                      <span className='tabular-nums'>
                        {sm.subagents.length} / {sm.maxConcurrentSubagents}
                      </span>
                      <span className='text-xs'>subagents</span>
                    </span>
                    <span className='tabular-nums'>
                      {sm.tokenBudgetPerHour.toLocaleString()} tokens/hr
                    </span>
                  </div>
                  <div
                    className='flex gap-1'
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => toggleStatus(sm.id, sm.status)}
                      title={sm.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                    >
                      {sm.status === 'ACTIVE' ? (
                        <Pause className='h-4 w-4' />
                      ) : (
                        <Play className='h-4 w-4' />
                      )}
                    </Button>
                    <Button variant='ghost' size='icon' title='Settings'>
                      <Settings className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default SessionManagerList;
