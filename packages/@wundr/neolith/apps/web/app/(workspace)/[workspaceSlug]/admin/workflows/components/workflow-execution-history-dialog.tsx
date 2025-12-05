'use client';

import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Execution {
  id: string;
  status: 'completed' | 'failed' | 'running' | 'pending';
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  triggeredBy: string;
  error: string | null;
}

interface WorkflowExecutionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  workspaceSlug: string;
}

export function WorkflowExecutionHistoryDialog({
  open,
  onOpenChange,
  workflowId,
  workspaceSlug,
}: WorkflowExecutionHistoryDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);

  useEffect(() => {
    if (open && workflowId) {
      fetchExecutions();
    }
  }, [open, workflowId]);

  const fetchExecutions = async () => {
    if (!workflowId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/${workflowId}/executions?limit=50`,
      );

      if (!response.ok) throw new Error('Failed to fetch executions');

      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load execution history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: Execution['status']) => {
    const config = {
      completed: {
        label: 'Completed',
        variant: 'default' as const,
        icon: CheckCircle,
      },
      failed: {
        label: 'Failed',
        variant: 'destructive' as const,
        icon: XCircle,
      },
      running: {
        label: 'Running',
        variant: 'default' as const,
        icon: Activity,
      },
      pending: {
        label: 'Pending',
        variant: 'secondary' as const,
        icon: Clock,
      },
    };
    const { label, variant, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className='flex items-center gap-1'>
        <Icon className='h-3 w-3' />
        {label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Activity className='h-5 w-5' />
            Execution History
          </DialogTitle>
          <DialogDescription>
            View recent execution history for this workflow
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='py-8 text-center text-muted-foreground'>
            Loading execution history...
          </div>
        ) : executions.length === 0 ? (
          <div className='py-8 text-center text-muted-foreground'>
            No executions found
          </div>
        ) : (
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-4'>
              {executions.map(execution => (
                <div
                  key={execution.id}
                  className='rounded-lg border p-4 space-y-3'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      {getStatusBadge(execution.status)}
                      <span className='text-sm text-muted-foreground'>
                        {new Date(execution.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {execution.duration !== null && (
                      <Badge variant='outline'>
                        <Clock className='h-3 w-3 mr-1' />
                        {execution.duration}ms
                      </Badge>
                    )}
                  </div>

                  <div className='text-sm'>
                    <span className='text-muted-foreground'>Triggered by: </span>
                    <span className='font-medium'>{execution.triggeredBy}</span>
                  </div>

                  {execution.error && (
                    <div className='rounded bg-red-50 dark:bg-red-900/20 p-3'>
                      <p className='text-sm font-medium text-red-900 dark:text-red-200 mb-1'>
                        Error
                      </p>
                      <p className='text-sm text-red-700 dark:text-red-300'>
                        {execution.error}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
