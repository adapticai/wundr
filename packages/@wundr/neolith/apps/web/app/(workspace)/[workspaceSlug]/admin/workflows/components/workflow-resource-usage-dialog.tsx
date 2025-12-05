'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Cpu, Clock, Zap } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ResourceUsage {
  avgExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  totalExecutions: number;
  avgMemoryUsage: number;
  totalApiCalls: number;
  last24h: {
    executions: number;
    avgTime: number;
  };
  last7d: {
    executions: number;
    avgTime: number;
  };
}

interface WorkflowResourceUsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  workspaceSlug: string;
}

export function WorkflowResourceUsageDialog({
  open,
  onOpenChange,
  workflowId,
  workspaceSlug,
}: WorkflowResourceUsageDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);

  useEffect(() => {
    if (open && workflowId) {
      fetchUsage();
    }
  }, [open, workflowId]);

  const fetchUsage = async () => {
    if (!workflowId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/${workflowId}/resource-usage`,
      );

      if (!response.ok) throw new Error('Failed to fetch resource usage');

      const data = await response.json();
      setUsage(data.usage);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load resource usage',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Resource Usage
          </DialogTitle>
          <DialogDescription>
            View resource consumption metrics for this workflow
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='py-8 text-center text-muted-foreground'>
            Loading resource usage...
          </div>
        ) : !usage ? (
          <div className='py-8 text-center text-muted-foreground'>
            No data available
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Execution Time Metrics */}
            <div>
              <h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
                <Clock className='h-4 w-4' />
                Execution Time
              </h3>
              <div className='grid grid-cols-3 gap-4'>
                <MetricCard
                  label='Average'
                  value={`${usage.avgExecutionTime}ms`}
                />
                <MetricCard
                  label='Minimum'
                  value={`${usage.minExecutionTime}ms`}
                />
                <MetricCard
                  label='Maximum'
                  value={`${usage.maxExecutionTime}ms`}
                />
              </div>
            </div>

            {/* Resource Metrics */}
            <div>
              <h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
                <Cpu className='h-4 w-4' />
                Resource Consumption
              </h3>
              <div className='grid grid-cols-3 gap-4'>
                <MetricCard
                  label='Avg Memory'
                  value={`${(usage.avgMemoryUsage / 1024 / 1024).toFixed(2)} MB`}
                />
                <MetricCard
                  label='API Calls'
                  value={usage.totalApiCalls.toLocaleString()}
                />
                <MetricCard
                  label='Total Runs'
                  value={usage.totalExecutions.toLocaleString()}
                />
              </div>
            </div>

            {/* Time Period Metrics */}
            <div>
              <h3 className='text-sm font-semibold mb-3 flex items-center gap-2'>
                <Zap className='h-4 w-4' />
                Recent Activity
              </h3>
              <div className='grid grid-cols-2 gap-4'>
                <div className='rounded-lg border p-4 space-y-2'>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Last 24 Hours
                  </p>
                  <p className='text-2xl font-bold'>
                    {usage.last24h.executions}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Avg: {usage.last24h.avgTime}ms
                  </p>
                </div>
                <div className='rounded-lg border p-4 space-y-2'>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Last 7 Days
                  </p>
                  <p className='text-2xl font-bold'>
                    {usage.last7d.executions}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Avg: {usage.last7d.avgTime}ms
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border p-3 space-y-1'>
      <p className='text-xs font-medium text-muted-foreground'>{label}</p>
      <p className='text-lg font-bold'>{value}</p>
    </div>
  );
}
