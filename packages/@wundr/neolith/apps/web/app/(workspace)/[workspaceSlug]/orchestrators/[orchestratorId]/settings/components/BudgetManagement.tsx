'use client';

/**
 * Budget Management Component
 *
 * Comprehensive budget management UI for orchestrators including:
 * - Current budget overview
 * - Usage history charts
 * - Budget alerts
 * - Budget limit configuration
 */

import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { BudgetAlerts } from '@/components/budget/budget-alerts';
import { BudgetOverview } from '@/components/budget/budget-overview';
import { BudgetSettings } from '@/components/budget/budget-settings';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBudget, useUsageHistory, useBudgetAlerts, useBudgetMutations } from '@/hooks/use-budget';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { AlertThresholds } from '@/components/budget/budget-alerts';
import type { BudgetConfiguration } from '@/components/budget/budget-settings';
import type { ChartConfig } from '@/components/ui/chart';

interface BudgetManagementProps {
  orchestratorId: string;
  disabled?: boolean;
}

const chartConfig = {
  tokensUsed: {
    label: 'Tokens Used',
    color: 'hsl(var(--chart-1))',
  },
  requestCount: {
    label: 'Request Count',
    color: 'hsl(var(--chart-2))',
  },
  averagePerRequest: {
    label: 'Avg Per Request',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function BudgetManagement({ orchestratorId, disabled = false }: BudgetManagementProps) {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'hourly' | 'daily' | 'monthly'>('daily');

  // Fetch budget data
  const { budget, isLoading: budgetLoading, refetch: refetchBudget } = useBudget(orchestratorId);

  // Fetch usage history
  const { history, isLoading: historyLoading } = useUsageHistory(orchestratorId, {
    granularity: selectedPeriod === 'hourly' ? 'hourly' : 'daily',
    limit: selectedPeriod === 'hourly' ? 24 : 30,
  });

  // Fetch alerts
  const {
    alerts,
    acknowledge,
    configureAlerts,
    isLoading: alertsLoading,
  } = useBudgetAlerts(orchestratorId);

  // Budget mutations
  const { updateBudget, setAutoPause, isPending } = useBudgetMutations(orchestratorId);

  // Transform history data for charts
  const chartData = useMemo(() => {
    return history.map(point => ({
      date: point.timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: selectedPeriod === 'hourly' ? '2-digit' : undefined,
      }),
      tokensUsed: point.tokensUsed,
      requestCount: point.requestCount,
      averagePerRequest: point.averagePerRequest,
    }));
  }, [history, selectedPeriod]);

  // Calculate trends
  const usageTrend = useMemo(() => {
    if (history.length < 2) {
return null;
}
    const recent = history.slice(0, Math.floor(history.length / 2));
    const older = history.slice(Math.floor(history.length / 2));

    const recentAvg = recent.reduce((sum, h) => sum + h.tokensUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.tokensUsed, 0) / older.length;

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    return {
      direction: percentChange > 0 ? 'up' : 'down',
      percentage: Math.abs(percentChange).toFixed(1),
    };
  }, [history]);

  // Transform budget data for BudgetOverview component
  const budgetUsage = useMemo(() => {
    if (!budget) {
return null;
}

    const periodMap = {
      hourly: budget.usage.daily / 24, // Rough estimate
      daily: budget.usage.daily,
      monthly: budget.usage.monthly,
    };

    const limitMap = {
      hourly: budget.limits.dailyLimit / 24,
      daily: budget.limits.dailyLimit,
      monthly: budget.limits.monthlyLimit,
    };

    return {
      current: periodMap[selectedPeriod] || 0,
      limit: limitMap[selectedPeriod] || 1,
      period: selectedPeriod,
      projectedExhaustion: budget.isDailyLimitExceeded
        ? new Date()
        : new Date(Date.now() + (budget.dailyRemaining / budget.usage.daily) * 86400000),
      costEstimate: (periodMap[selectedPeriod] || 0) * 0.00002, // Rough estimate at $0.02/1K tokens
    };
  }, [budget, selectedPeriod]);

  // Transform alerts for BudgetAlerts component
  const transformedAlerts = useMemo(() => {
    return alerts.map(alert => ({
      id: alert.id,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.createdAt,
      acknowledged: alert.acknowledged,
      threshold: alert.threshold,
      currentValue: alert.threshold, // This would come from the alert metadata
    }));
  }, [alerts]);

  const alertThresholds: AlertThresholds = {
    warningThreshold: 75,
    criticalThreshold: 90,
  };

  // Transform budget config for BudgetSettings component
  const budgetConfig: BudgetConfiguration | null = useMemo(() => {
    if (!budget) {
return null;
}
    return {
      hourlyLimit: budget.limits.dailyLimit / 24,
      dailyLimit: budget.limits.dailyLimit,
      monthlyLimit: budget.limits.monthlyLimit,
      autoPauseEnabled: budget.autoPauseEnabled,
      warningThreshold: 75,
      criticalThreshold: 90,
    };
  }, [budget]);

  // Handle save budget configuration
  const handleSaveBudget = async (config: BudgetConfiguration) => {
    try {
      await updateBudget({
        dailyLimit: config.dailyLimit,
        monthlyLimit: config.monthlyLimit,
        perRequestLimit: budget?.limits.perRequestLimit || 10000,
      });

      if (config.autoPauseEnabled !== budget?.autoPauseEnabled) {
        await setAutoPause(config.autoPauseEnabled);
      }

      toast({
        title: 'Budget Updated',
        description: 'Your budget configuration has been saved successfully.',
      });

      refetchBudget();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update budget',
        variant: 'destructive',
      });
    }
  };

  // Handle reset budget configuration
  const handleResetBudget = () => {
    toast({
      title: 'Reset Budget',
      description: 'Budget configuration has been reset to defaults.',
    });
  };

  // Handle acknowledge alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledge(alertId);
      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    }
  };

  // Handle dismiss alert
  const handleDismissAlert = async (alertId: string) => {
    // This would call an API to dismiss/delete the alert
    toast({
      title: 'Alert Dismissed',
      description: 'The alert has been dismissed.',
    });
  };

  // Handle update alert thresholds
  const handleUpdateThresholds = async (thresholds: AlertThresholds) => {
    try {
      await configureAlerts({
        enabled: true,
        thresholds: {
          info: 50,
          warning: thresholds.warningThreshold,
          critical: thresholds.criticalThreshold,
        },
        emailNotifications: true,
      });

      toast({
        title: 'Thresholds Updated',
        description: 'Alert thresholds have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update thresholds',
        variant: 'destructive',
      });
    }
  };

  const isLoading = budgetLoading || historyLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!budget || !budgetUsage || !budgetConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Budget Data Unavailable
          </CardTitle>
          <CardDescription>
            Unable to load budget information. Please try again later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Overview Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <BudgetOverview
          usage={budgetUsage}
          onViewChange={setSelectedPeriod}
        />

        <Card>
          <CardHeader>
            <CardTitle>Usage Trend</CardTitle>
            <CardDescription>
              Compared to previous period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageTrend ? (
              <div className="flex items-center gap-4">
                <div className={cn(
                  'flex items-center gap-2 text-2xl font-bold',
                  usageTrend.direction === 'up' ? 'text-destructive' : 'text-green-600',
                )}>
                  {usageTrend.direction === 'up' ? (
                    <TrendingUp className="h-6 w-6" />
                  ) : (
                    <TrendingDown className="h-6 w-6" />
                  )}
                  {usageTrend.percentage}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {usageTrend.direction === 'up' ? 'Increase' : 'Decrease'} in token usage
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not enough data to calculate trend
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-lg font-semibold">
                  {history.reduce((sum, h) => sum + h.requestCount, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg per Request</p>
                <p className="text-lg font-semibold">
                  {Math.round(
                    history.reduce((sum, h) => sum + h.averagePerRequest, 0) / history.length,
                  ).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peak Usage</p>
                <p className="text-lg font-semibold">
                  {Math.max(...history.map(h => h.tokensUsed)).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Token Usage</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Usage Over Time</CardTitle>
              <CardDescription>
                Historical token consumption for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="tokensUsed"
                    stroke="var(--color-tokensUsed)"
                    fill="var(--color-tokensUsed)"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Volume</CardTitle>
              <CardDescription>
                Number of requests over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="requestCount"
                    fill="var(--color-requestCount)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerts and Settings Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <BudgetAlerts
          alerts={transformedAlerts}
          thresholds={alertThresholds}
          onAcknowledge={handleAcknowledgeAlert}
          onDismiss={handleDismissAlert}
          onUpdateThresholds={handleUpdateThresholds}
        />

        <BudgetSettings
          config={budgetConfig}
          onSave={handleSaveBudget}
          onReset={handleResetBudget}
          isSaving={isPending}
        />
      </div>

      {/* Status Badge */}
      {budget.isPaused && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Orchestrator Paused
            </CardTitle>
            <CardDescription>
              This orchestrator has been paused due to budget limits. Increase your budget or wait for the next period to resume operations.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
