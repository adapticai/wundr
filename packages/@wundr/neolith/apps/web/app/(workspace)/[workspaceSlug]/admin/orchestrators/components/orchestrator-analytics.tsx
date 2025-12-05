'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Activity, DollarSign, Clock, CheckCircle2, XCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OrchestratorAnalyticsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orchestratorId: string | null;
  workspaceSlug: string;
}

interface AnalyticsData {
  usage: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
  };
  budget: {
    spent: number;
    limit: number;
    costPerRequest: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
  };
  timeline: Array<{
    date: string;
    requests: number;
    cost: number;
  }>;
}

export function OrchestratorAnalytics({
  open,
  onOpenChange,
  orchestratorId,
  workspaceSlug,
}: OrchestratorAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (open && orchestratorId) {
      fetchAnalytics();
    }
  }, [open, orchestratorId]);

  const fetchAnalytics = async () => {
    if (!orchestratorId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${orchestratorId}/analytics`,
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const successRate = analytics
    ? ((analytics.usage.successfulRequests / analytics.usage.totalRequests) * 100).toFixed(1)
    : '0';

  const budgetUsagePercent = analytics
    ? ((analytics.budget.spent / analytics.budget.limit) * 100).toFixed(1)
    : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[700px] max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Orchestrator Analytics</DialogTitle>
          <DialogDescription>
            Usage statistics and performance metrics
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='py-12 text-center text-muted-foreground'>
            Loading analytics...
          </div>
        ) : !analytics ? (
          <div className='py-12 text-center text-muted-foreground'>
            No analytics data available
          </div>
        ) : (
          <Tabs defaultValue='overview' className='py-4'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='budget'>Budget</TabsTrigger>
              <TabsTrigger value='tasks'>Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value='overview' className='space-y-4'>
              {/* Usage Stats */}
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-lg border p-4'>
                  <div className='flex items-center gap-2 mb-2'>
                    <Activity className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Total Requests</span>
                  </div>
                  <p className='text-3xl font-bold'>{analytics.usage.totalRequests}</p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    {successRate}% success rate
                  </p>
                </div>

                <div className='rounded-lg border p-4'>
                  <div className='flex items-center gap-2 mb-2'>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Avg Response Time</span>
                  </div>
                  <p className='text-3xl font-bold'>
                    {analytics.usage.avgResponseTime.toFixed(0)}ms
                  </p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    Per request
                  </p>
                </div>
              </div>

              {/* Success/Failure */}
              <div className='rounded-lg border p-4'>
                <h3 className='text-sm font-medium mb-4'>Request Status</h3>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <CheckCircle2 className='h-4 w-4 text-green-500' />
                      <span className='text-sm'>Successful</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {analytics.usage.successfulRequests}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <XCircle className='h-4 w-4 text-red-500' />
                      <span className='text-sm'>Failed</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {analytics.usage.failedRequests}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='budget' className='space-y-4'>
              {/* Budget Overview */}
              <div className='rounded-lg border p-4 bg-muted/50'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='flex items-center gap-2'>
                    <DollarSign className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Budget Usage</span>
                  </div>
                  <span className='text-2xl font-bold'>
                    ${analytics.budget.spent.toFixed(2)}
                  </span>
                </div>
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm text-muted-foreground'>
                    <span>{budgetUsagePercent}% of budget</span>
                    <span>${analytics.budget.limit.toFixed(2)}</span>
                  </div>
                  <div className='h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className={`h-full transition-all ${
                        parseFloat(budgetUsagePercent) > 90
                          ? 'bg-red-500'
                          : parseFloat(budgetUsagePercent) > 80
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(parseFloat(budgetUsagePercent), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Cost Metrics */}
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-lg border p-4'>
                  <span className='text-sm font-medium text-muted-foreground'>
                    Cost per Request
                  </span>
                  <p className='text-2xl font-bold mt-2'>
                    ${analytics.budget.costPerRequest.toFixed(4)}
                  </p>
                </div>
                <div className='rounded-lg border p-4'>
                  <span className='text-sm font-medium text-muted-foreground'>
                    Remaining Budget
                  </span>
                  <p className='text-2xl font-bold mt-2'>
                    ${(analytics.budget.limit - analytics.budget.spent).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Timeline (simplified) */}
              <div className='rounded-lg border p-4'>
                <h3 className='text-sm font-medium mb-4'>Recent Activity</h3>
                <div className='space-y-2'>
                  {analytics.timeline.slice(0, 5).map((item, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between py-2 border-b last:border-0'
                    >
                      <span className='text-sm text-muted-foreground'>
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                      <div className='text-right'>
                        <p className='text-sm font-medium'>{item.requests} requests</p>
                        <p className='text-xs text-muted-foreground'>
                          ${item.cost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value='tasks' className='space-y-4'>
              {/* Task Stats */}
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-lg border p-4'>
                  <span className='text-sm font-medium text-muted-foreground'>
                    Total Tasks
                  </span>
                  <p className='text-3xl font-bold mt-2'>{analytics.tasks.total}</p>
                </div>
                <div className='rounded-lg border p-4'>
                  <span className='text-sm font-medium text-muted-foreground'>
                    Completion Rate
                  </span>
                  <p className='text-3xl font-bold mt-2'>
                    {analytics.tasks.total > 0
                      ? ((analytics.tasks.completed / analytics.tasks.total) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              {/* Task Breakdown */}
              <div className='rounded-lg border p-4'>
                <h3 className='text-sm font-medium mb-4'>Task Status</h3>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <CheckCircle2 className='h-4 w-4 text-green-500' />
                      <span className='text-sm'>Completed</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {analytics.tasks.completed}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Clock className='h-4 w-4 text-blue-500' />
                      <span className='text-sm'>In Progress</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {analytics.tasks.inProgress}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <XCircle className='h-4 w-4 text-red-500' />
                      <span className='text-sm'>Failed</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {analytics.tasks.failed}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
