'use client';

/**
 * Quota Display Component
 *
 * Displays AI usage quotas with progress bars and detailed breakdowns.
 * Shows user or workspace quota information with visual indicators.
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { RateLimitWarning } from './rate-limit-warning';
import { cn } from '@/lib/utils';

export interface QuotaData {
  tier: string;
  requestsToday: number;
  requestsThisHour: number;
  requestsThisMonth: number;
  tokensThisMonth: number;
  limits: {
    maxRequestsPerDay: number;
    maxRequestsPerHour: number;
    maxRequestsPerMonth: number;
    maxTokensPerMonth: number;
  };
  percentages: {
    dailyRequests: number;
    hourlyRequests: number;
    monthlyRequests: number;
    monthlyTokens: number;
  };
  resetAt: {
    hour: string;
    day: string;
    month: string;
  };
}

export interface QuotaDisplayProps {
  /** Scope of the quota (user or workspace) */
  scope: 'user' | 'workspace';
  /** Workspace ID if scope is workspace */
  workspaceId?: string;
  /** Whether to auto-refresh data */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Show compact version */
  compact?: boolean;
}

export function QuotaDisplay({
  scope,
  workspaceId,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
  compact = false,
}: QuotaDisplayProps) {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ scope });
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }

      const response = await fetch(`/api/ai/usage?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quota');
      }

      const data = await response.json();
      setQuota(data.usage);
    } catch (err) {
      console.error('Error fetching quota:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();

    if (autoRefresh) {
      const interval = setInterval(fetchQuota, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [scope, workspaceId, autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <Card className={compact ? 'border-none shadow-none' : ''}>
        <CardContent className='flex items-center justify-center py-8'>
          <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    );
  }

  if (error || !quota) {
    return (
      <Card className={compact ? 'border-none shadow-none' : ''}>
        <CardContent className='py-6'>
          <p className='text-sm text-destructive'>
            Failed to load quota information
          </p>
          <Button
            size='sm'
            variant='outline'
            onClick={fetchQuota}
            className='mt-2'
          >
            <RefreshCw className='h-3 w-3 mr-2' />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'free':
        return 'bg-gray-500';
      case 'pro':
        return 'bg-blue-500';
      case 'enterprise':
        return 'bg-purple-500';
      case 'unlimited':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-primary';
  };

  if (compact) {
    return (
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Activity className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium'>AI Usage</span>
          </div>
          <Badge className={getTierColor(quota.tier)}>
            {quota.tier.toUpperCase()}
          </Badge>
        </div>

        <div className='space-y-2'>
          <div>
            <div className='flex justify-between text-xs mb-1'>
              <span>Today</span>
              <span className='text-muted-foreground'>
                {quota.requestsToday} / {quota.limits.maxRequestsPerDay}
              </span>
            </div>
            <Progress
              value={quota.percentages.dailyRequests}
              className={cn(
                'h-1.5',
                getProgressColor(quota.percentages.dailyRequests)
              )}
            />
          </div>
        </div>

        <RateLimitWarning
          percentage={quota.percentages.hourlyRequests}
          limitType='hourly'
          limit={quota.limits.maxRequestsPerHour}
          current={quota.requestsThisHour}
          resetAt={new Date(quota.resetAt.hour)}
          compact
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Activity className='h-5 w-5' />
              AI Usage & Quotas
            </CardTitle>
            <CardDescription>
              {scope === 'workspace' ? 'Workspace' : 'Your'} AI request limits
              and current usage
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Badge className={getTierColor(quota.tier)}>
              {quota.tier.toUpperCase()}
            </Badge>
            <Button size='sm' variant='ghost' onClick={fetchQuota}>
              <RefreshCw className='h-3 w-3' />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Hourly Limit */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <div className='flex items-center gap-2'>
              <Clock className='h-4 w-4 text-muted-foreground' />
              <span className='font-medium'>Hourly Requests</span>
            </div>
            <span className='text-muted-foreground'>
              {quota.requestsThisHour.toLocaleString()} /{' '}
              {quota.limits.maxRequestsPerHour.toLocaleString()}
            </span>
          </div>
          <Progress
            value={quota.percentages.hourlyRequests}
            className={cn(
              'h-2',
              getProgressColor(quota.percentages.hourlyRequests)
            )}
          />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>{quota.percentages.hourlyRequests.toFixed(1)}% used</span>
            <span>
              Resets{' '}
              {formatDistanceToNow(new Date(quota.resetAt.hour), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <RateLimitWarning
          percentage={quota.percentages.hourlyRequests}
          limitType='hourly'
          limit={quota.limits.maxRequestsPerHour}
          current={quota.requestsThisHour}
          resetAt={new Date(quota.resetAt.hour)}
        />

        {/* Daily Limit */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-muted-foreground' />
              <span className='font-medium'>Daily Requests</span>
            </div>
            <span className='text-muted-foreground'>
              {quota.requestsToday.toLocaleString()} /{' '}
              {quota.limits.maxRequestsPerDay.toLocaleString()}
            </span>
          </div>
          <Progress
            value={quota.percentages.dailyRequests}
            className={cn(
              'h-2',
              getProgressColor(quota.percentages.dailyRequests)
            )}
          />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>{quota.percentages.dailyRequests.toFixed(1)}% used</span>
            <span>
              Resets{' '}
              {formatDistanceToNow(new Date(quota.resetAt.day), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <RateLimitWarning
          percentage={quota.percentages.dailyRequests}
          limitType='daily'
          limit={quota.limits.maxRequestsPerDay}
          current={quota.requestsToday}
          resetAt={new Date(quota.resetAt.day)}
        />

        {/* Monthly Limits */}
        <div className='space-y-4 pt-4 border-t'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-2'>
                <TrendingUp className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>Monthly Requests</span>
              </div>
              <span className='text-muted-foreground'>
                {quota.requestsThisMonth.toLocaleString()} /{' '}
                {quota.limits.maxRequestsPerMonth.toLocaleString()}
              </span>
            </div>
            <Progress
              value={quota.percentages.monthlyRequests}
              className={cn(
                'h-2',
                getProgressColor(quota.percentages.monthlyRequests)
              )}
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>{quota.percentages.monthlyRequests.toFixed(1)}% used</span>
              <span>
                Resets{' '}
                {formatDistanceToNow(new Date(quota.resetAt.month), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-2'>
                <Zap className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>Monthly Tokens</span>
              </div>
              <span className='text-muted-foreground'>
                {quota.tokensThisMonth.toLocaleString()} /{' '}
                {quota.limits.maxTokensPerMonth.toLocaleString()}
              </span>
            </div>
            <Progress
              value={quota.percentages.monthlyTokens}
              className={cn(
                'h-2',
                getProgressColor(quota.percentages.monthlyTokens)
              )}
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>{quota.percentages.monthlyTokens.toFixed(1)}% used</span>
              <span>
                Resets{' '}
                {formatDistanceToNow(new Date(quota.resetAt.month), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </div>

        <RateLimitWarning
          percentage={Math.max(
            quota.percentages.monthlyRequests,
            quota.percentages.monthlyTokens
          )}
          limitType='monthly'
          limit={quota.limits.maxRequestsPerMonth}
          current={quota.requestsThisMonth}
          resetAt={new Date(quota.resetAt.month)}
        />
      </CardContent>
    </Card>
  );
}
