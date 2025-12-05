'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface BudgetUsage {
  current: number;
  limit: number;
  period: 'hourly' | 'daily' | 'monthly';
  projectedExhaustion?: Date;
  costEstimate?: number;
}

export interface BudgetOverviewProps {
  usage: BudgetUsage;
  className?: string;
  onViewChange?: (view: 'hourly' | 'daily' | 'monthly') => void;
}

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(2)}K`;
  }
  return tokens.toLocaleString();
};

const formatCost = (cost: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost);
};

const formatTimeRemaining = (exhaustionDate: Date): string => {
  const now = new Date();
  const diff = exhaustionDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Budget exhausted';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 1) {
    return `${minutes}m remaining`;
  }
  if (hours < 24) {
    return `${hours}h ${minutes}m remaining`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h remaining`;
};

const getUsageColor = (percentage: number): string => {
  if (percentage >= 90) {
    return 'destructive';
  }
  if (percentage >= 75) {
    return 'warning';
  }
  return 'success';
};

const getUsageColorClass = (percentage: number): string => {
  if (percentage >= 90) {
    return 'bg-destructive';
  }
  if (percentage >= 75) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
};

export function BudgetOverview({
  usage,
  className,
  onViewChange,
}: BudgetOverviewProps) {
  const [selectedView, setSelectedView] = React.useState<
    'hourly' | 'daily' | 'monthly'
  >(usage.period);

  const usagePercentage =
    usage.limit > 0 ? (usage.current / usage.limit) * 100 : 0;
  const colorVariant = getUsageColor(usagePercentage);
  const progressColorClass = getUsageColorClass(usagePercentage);

  const handleViewChange = (view: 'hourly' | 'daily' | 'monthly') => {
    setSelectedView(view);
    onViewChange?.(view);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Token Budget</CardTitle>
            <CardDescription>
              Current usage for {usage.period} period
            </CardDescription>
          </div>
          <div className='flex gap-1'>
            {(['hourly', 'daily', 'monthly'] as const).map(view => (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  selectedView === view
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Progress Bar */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium'>
              {formatTokens(usage.current)} / {formatTokens(usage.limit)}
            </span>
            <Badge
              variant={
                colorVariant === 'destructive' ? 'destructive' : 'default'
              }
            >
              {usagePercentage.toFixed(1)}%
            </Badge>
          </div>
          <div className='relative'>
            <Progress value={usagePercentage} className='h-3' />
            <div
              className={cn(
                'absolute top-0 left-0 h-3 rounded-full transition-all',
                progressColorClass
              )}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className='grid grid-cols-2 gap-4'>
          {/* Projected Exhaustion */}
          {usage.projectedExhaustion && (
            <div className='space-y-1'>
              <p className='text-xs text-muted-foreground'>
                Projected Exhaustion
              </p>
              <p className='text-sm font-medium'>
                {formatTimeRemaining(usage.projectedExhaustion)}
              </p>
              <p className='text-xs text-muted-foreground'>
                {usage.projectedExhaustion.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}

          {/* Cost Estimate */}
          {usage.costEstimate !== undefined && (
            <div className='space-y-1'>
              <p className='text-xs text-muted-foreground'>Estimated Cost</p>
              <p className='text-sm font-medium'>
                {formatCost(usage.costEstimate)}
              </p>
              <p className='text-xs text-muted-foreground'>
                {formatCost(usage.costEstimate / usage.current)} per 1K tokens
              </p>
            </div>
          )}

          {/* Tokens Remaining */}
          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground'>Tokens Remaining</p>
            <p className='text-sm font-medium'>
              {formatTokens(Math.max(0, usage.limit - usage.current))}
            </p>
            <p className='text-xs text-muted-foreground'>
              {(
                (Math.max(0, usage.limit - usage.current) / usage.limit) *
                100
              ).toFixed(1)}
              % available
            </p>
          </div>

          {/* Usage Rate */}
          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground'>Status</p>
            <div className='flex items-center gap-2'>
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  usagePercentage >= 90
                    ? 'bg-destructive'
                    : usagePercentage >= 75
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                )}
              />
              <p className='text-sm font-medium'>
                {usagePercentage >= 90
                  ? 'Critical'
                  : usagePercentage >= 75
                    ? 'Warning'
                    : 'Healthy'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
