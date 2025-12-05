/**
 * Delegation History Component
 *
 * Displays delegation history for an orchestrator including
 * both outgoing and incoming delegations.
 *
 * @module components/orchestrator/delegation-history
 */
'use client';

import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DelegationEntry {
  id: string;
  taskId: string;
  taskTitle?: string;
  fromOrchestratorId: string;
  fromOrchestratorTitle: string;
  toOrchestratorId: string;
  toOrchestratorTitle: string;
  delegatedAt: string;
  priority?: string;
  note?: string;
  status?: string;
}

interface DelegationHistoryProps {
  orchestratorId: string;
  refreshTrigger?: number;
}

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  LOW: { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  MEDIUM: { label: 'Medium', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  HIGH: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  CRITICAL: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  accepted: {
    label: 'Accepted',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export function DelegationHistory({
  orchestratorId,
  refreshTrigger,
}: DelegationHistoryProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [outgoingDelegations, setOutgoingDelegations] = useState<
    DelegationEntry[]
  >([]);
  const [incomingDelegations, setIncomingDelegations] = useState<
    DelegationEntry[]
  >([]);
  const [activeView, setActiveView] = useState<'outgoing' | 'incoming'>(
    'outgoing'
  );

  const fetchDelegationHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Since we don't have a dedicated delegation history endpoint yet,
      // we'll fetch tasks with delegation metadata
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/tasks?include_delegations=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch delegation history');
      }

      const result = await response.json();
      const tasks = result.data?.tasks || [];

      // Extract delegation information from task metadata
      const outgoing: DelegationEntry[] = [];
      const incoming: DelegationEntry[] = [];

      tasks.forEach((task: any) => {
        const metadata = task.metadata || {};
        const delegations = metadata.delegations || [];

        delegations.forEach((delegation: any) => {
          const entry: DelegationEntry = {
            id: `${task.id}_${delegation.delegatedAt}`,
            taskId: task.id,
            taskTitle: task.title,
            fromOrchestratorId: delegation.fromOrchestratorId,
            fromOrchestratorTitle:
              delegation.fromOrchestratorTitle || 'Unknown',
            toOrchestratorId: delegation.toOrchestratorId,
            toOrchestratorTitle: delegation.toOrchestratorTitle || 'Unknown',
            delegatedAt: delegation.delegatedAt,
            priority: delegation.priority,
            note: delegation.note,
            status: delegation.status || 'pending',
          };

          if (delegation.fromOrchestratorId === orchestratorId) {
            outgoing.push(entry);
          } else if (delegation.toOrchestratorId === orchestratorId) {
            incoming.push(entry);
          }
        });
      });

      // Sort by date (newest first)
      outgoing.sort(
        (a, b) =>
          new Date(b.delegatedAt).getTime() - new Date(a.delegatedAt).getTime()
      );
      incoming.sort(
        (a, b) =>
          new Date(b.delegatedAt).getTime() - new Date(a.delegatedAt).getTime()
      );

      setOutgoingDelegations(outgoing);
      setIncomingDelegations(incoming);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to fetch delegations');
      setError(error);
      console.error('[DelegationHistory] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orchestratorId]);

  useEffect(() => {
    fetchDelegationHistory();
  }, [fetchDelegationHistory, refreshTrigger]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const currentDelegations =
    activeView === 'outgoing' ? outgoingDelegations : incomingDelegations;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delegation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {[1, 2, 3].map(i => (
              <div key={i} className='flex gap-3 items-start'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-1/2' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delegation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8'>
            <AlertCircle className='h-8 w-8 text-red-600 mb-2' />
            <p className='text-sm text-red-800 font-medium'>
              Failed to load delegation history
            </p>
            <p className='text-xs text-red-600 mt-1'>{error.message}</p>
            <Button
              variant='outline'
              size='sm'
              onClick={fetchDelegationHistory}
              className='mt-3'
            >
              <RefreshCw className='h-4 w-4 mr-2' />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Delegation History</CardTitle>
          <div className='flex gap-2'>
            <Button
              variant={activeView === 'outgoing' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setActiveView('outgoing')}
            >
              <ArrowRight className='h-4 w-4 mr-1' />
              Outgoing ({outgoingDelegations.length})
            </Button>
            <Button
              variant={activeView === 'incoming' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setActiveView('incoming')}
            >
              <ArrowLeft className='h-4 w-4 mr-1' />
              Incoming ({incomingDelegations.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currentDelegations.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <FileText className='h-12 w-12 text-muted-foreground/50 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              No {activeView} delegations
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              {activeView === 'outgoing'
                ? 'Delegations you create will appear here'
                : 'Delegations you receive will appear here'}
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {currentDelegations.map(delegation => {
              const priorityConfig = delegation.priority
                ? PRIORITY_CONFIG[delegation.priority]
                : null;
              const statusConfig = delegation.status
                ? STATUS_CONFIG[delegation.status]
                : null;

              return (
                <div
                  key={delegation.id}
                  className='p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-2'>
                        {activeView === 'outgoing' ? (
                          <>
                            <span className='text-sm font-medium truncate'>
                              {delegation.toOrchestratorTitle}
                            </span>
                            <ArrowRight className='h-4 w-4 text-muted-foreground shrink-0' />
                          </>
                        ) : (
                          <>
                            <ArrowLeft className='h-4 w-4 text-muted-foreground shrink-0' />
                            <span className='text-sm font-medium truncate'>
                              {delegation.fromOrchestratorTitle}
                            </span>
                          </>
                        )}
                      </div>

                      {delegation.taskTitle && (
                        <p className='text-sm text-muted-foreground mb-2'>
                          Task: {delegation.taskTitle}
                        </p>
                      )}

                      {delegation.note && (
                        <p className='text-xs text-muted-foreground italic mb-2'>
                          &quot;{delegation.note}&quot;
                        </p>
                      )}

                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <Calendar className='h-3 w-3' />
                        {formatDate(delegation.delegatedAt)}
                      </div>
                    </div>

                    <div className='flex flex-col gap-2 shrink-0'>
                      {statusConfig && (
                        <Badge
                          className={cn(
                            statusConfig.bgColor,
                            statusConfig.color,
                            'text-xs'
                          )}
                        >
                          {statusConfig.label}
                        </Badge>
                      )}
                      {priorityConfig && (
                        <Badge
                          variant='outline'
                          className={cn('text-xs', priorityConfig.color)}
                        >
                          {priorityConfig.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
