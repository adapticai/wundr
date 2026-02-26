'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ActivityEvent {
  id: string;
  type:
    | 'message_routed'
    | 'task_completed'
    | 'task_created'
    | 'escalation'
    | 'status_change'
    | 'error'
    | 'charter_updated';
  timestamp: string;
  agentName: string;
  agentId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AgentActivityTimelineProps {
  workspaceId: string;
  orchestratorId?: string;
  limit?: number;
  className?: string;
}

const EVENT_TYPE_CONFIG: Record<
  ActivityEvent['type'],
  { color: string; bgColor: string; label: string }
> = {
  message_routed: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Message Routed',
  },
  task_completed: {
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    label: 'Task Completed',
  },
  task_created: {
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    label: 'Task Created',
  },
  escalation: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    label: 'Escalation',
  },
  status_change: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30',
    label: 'Status Change',
  },
  error: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    label: 'Error',
  },
  charter_updated: {
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    label: 'Charter Updated',
  },
};

interface TrafficDecision {
  id?: string;
  timestamp?: string;
  agentId?: string;
  agentName?: string;
  description?: string;
  escalated?: boolean;
  [key: string]: unknown;
}

function mapDecisionsToEvents(decisions: TrafficDecision[]): ActivityEvent[] {
  return decisions.map((decision, index) => {
    const isEscalation = decision.escalated === true;
    return {
      id: String(decision.id ?? `decision-${index}`),
      type: isEscalation ? 'escalation' : 'message_routed',
      timestamp:
        typeof decision.timestamp === 'string'
          ? decision.timestamp
          : new Date().toISOString(),
      agentId: String(decision.agentId ?? ''),
      agentName: String(decision.agentName ?? 'Unknown Agent'),
      description:
        typeof decision.description === 'string'
          ? decision.description
          : isEscalation
            ? 'Message escalated for review'
            : 'Message routed to agent',
      metadata: decision as Record<string, unknown>,
    };
  });
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older';

function groupByDate(
  events: ActivityEvent[]
): Record<DateGroup, ActivityEvent[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<DateGroup, ActivityEvent[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const event of events) {
    const eventDate = new Date(event.timestamp);
    const eventDay = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    );

    if (eventDay >= today) {
      groups.Today.push(event);
    } else if (eventDay >= yesterday) {
      groups.Yesterday.push(event);
    } else if (eventDay >= weekAgo) {
      groups['This Week'].push(event);
    } else {
      groups.Older.push(event);
    }
  }

  return groups;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DATE_GROUP_ORDER: DateGroup[] = [
  'Today',
  'Yesterday',
  'This Week',
  'Older',
];

export function AgentActivityTimeline({
  workspaceId,
  orchestratorId,
  limit = 50,
  className,
}: AgentActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(limit);

  const fetchEvents = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ workspaceId });
      if (orchestratorId) {
        params.set('orchestratorId', orchestratorId);
      }

      const response = await fetch(
        `/api/traffic-manager/metrics?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }

      const data = await response.json();
      const decisions: TrafficDecision[] =
        data?.recentDecisions ?? data?.data?.recentDecisions ?? [];
      const mapped = mapDecisionsToEvents(decisions);
      setEvents(mapped);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load activity';
      setError(message);
      console.error('[AgentActivityTimeline]', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, orchestratorId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className='flex gap-3 items-start'>
            <Skeleton className='h-3 w-3 rounded-full mt-1.5 shrink-0' />
            <div className='flex-1 space-y-1.5'>
              <Skeleton className='h-4 w-1/3' />
              <Skeleton className='h-3 w-2/3' />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-red-200', className)}>
        <CardContent className='pt-6 text-center'>
          <p className='text-sm font-medium text-red-700 dark:text-red-400'>
            Failed to load activity
          </p>
          <p className='text-xs text-muted-foreground mt-1'>{error}</p>
          <Button
            variant='outline'
            size='sm'
            onClick={fetchEvents}
            className='mt-3'
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
      >
        <p className='text-sm font-medium text-muted-foreground'>
          No activity recorded yet
        </p>
        <p className='text-xs text-muted-foreground mt-1'>
          Activity will appear here as agents process messages
        </p>
      </div>
    );
  }

  const visibleEvents = events.slice(0, displayLimit);
  const grouped = groupByDate(visibleEvents);
  const hasMore = events.length > displayLimit;

  return (
    <div className={cn('space-y-6', className)}>
      {DATE_GROUP_ORDER.map(group => {
        const groupEvents = grouped[group];
        if (groupEvents.length === 0) return null;

        return (
          <div key={group}>
            <div className='flex items-center gap-2 mb-3'>
              <span className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                {group}
              </span>
              <div className='flex-1 h-px bg-border' />
            </div>

            <div className='space-y-3'>
              {groupEvents.map((event, index) => {
                const config = EVENT_TYPE_CONFIG[event.type];
                const isLast = index === groupEvents.length - 1;

                return (
                  <div key={event.id} className='flex gap-3 items-start'>
                    <div className='flex flex-col items-center shrink-0 mt-1.5'>
                      <div
                        className={cn(
                          'h-2.5 w-2.5 rounded-full shrink-0',
                          config.color
                        )}
                      />
                      {!isLast && (
                        <div className='w-px flex-1 min-h-[1.5rem] bg-border mt-1' />
                      )}
                    </div>

                    <div
                      className={cn(
                        'flex-1 rounded-md px-3 py-2 min-w-0',
                        config.bgColor
                      )}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex items-center gap-2 flex-wrap min-w-0'>
                          <Badge
                            variant='secondary'
                            className='text-xs shrink-0'
                          >
                            {event.agentName}
                          </Badge>
                          <span className='text-xs text-muted-foreground shrink-0'>
                            {config.label}
                          </span>
                        </div>
                        <span className='text-xs text-muted-foreground shrink-0 tabular-nums'>
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <p className='text-sm text-foreground mt-1 leading-snug'>
                        {event.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <div className='flex justify-center pt-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setDisplayLimit(prev => prev + limit)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default AgentActivityTimeline;
