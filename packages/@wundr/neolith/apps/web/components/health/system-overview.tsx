'use client';

import { Users, Activity, Coins, AlertTriangle } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SystemOverviewData {
  orchestrators: {
    total: number;
    active: number;
  };
  sessions: {
    total: number;
    active: number;
  };
  tokens: {
    used: number;
    total: number;
    percentage: number;
  };
  errorRate: {
    rate: number;
    threshold: number;
  };
}

interface SystemOverviewProps {
  data: SystemOverviewData;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  status: 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  status,
  className,
}) => {
  const statusColors = {
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    neutral: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  const iconColors = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    neutral: 'text-blue-600',
  };

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        statusColors[status],
        className,
      )}
    >
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <div className={cn('p-2 rounded-lg', iconColors[status])}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {subtitle && (
          <p className='text-xs text-muted-foreground mt-1'>{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

export const SystemOverview: React.FC<SystemOverviewProps> = ({
  data,
  className,
}) => {
  const getOrchestratorStatus = ():
    | 'success'
    | 'warning'
    | 'error'
    | 'neutral' => {
    const percentage =
      (data.orchestrators.active / data.orchestrators.total) * 100;
    if (percentage >= 90) {
      return 'success';
    }
    if (percentage >= 70) {
      return 'warning';
    }
    if (percentage < 70) {
      return 'error';
    }
    return 'neutral';
  };

  const getSessionStatus = (): 'success' | 'warning' | 'error' | 'neutral' => {
    if (data.sessions.active === 0) {
      return 'neutral';
    }
    if (data.sessions.active >= data.sessions.total * 0.8) {
      return 'warning';
    }
    return 'success';
  };

  const getTokenStatus = (): 'success' | 'warning' | 'error' | 'neutral' => {
    if (data.tokens.percentage >= 90) {
      return 'error';
    }
    if (data.tokens.percentage >= 75) {
      return 'warning';
    }
    return 'success';
  };

  const getErrorRateStatus = ():
    | 'success'
    | 'warning'
    | 'error'
    | 'neutral' => {
    if (data.errorRate.rate >= data.errorRate.threshold) {
      return 'error';
    }
    if (data.errorRate.rate >= data.errorRate.threshold * 0.7) {
      return 'warning';
    }
    return 'success';
  };

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <StatCard
        title='Orchestrators'
        value={data.orchestrators.active}
        subtitle={`${data.orchestrators.total} total`}
        icon={<Users className='h-4 w-4' />}
        status={getOrchestratorStatus()}
      />
      <StatCard
        title='Active Sessions'
        value={data.sessions.active}
        subtitle={`${data.sessions.total} total sessions`}
        icon={<Activity className='h-4 w-4' />}
        status={getSessionStatus()}
      />
      <StatCard
        title='Token Usage'
        value={`${data.tokens.percentage.toFixed(1)}%`}
        subtitle={`${data.tokens.used.toLocaleString()} / ${data.tokens.total.toLocaleString()}`}
        icon={<Coins className='h-4 w-4' />}
        status={getTokenStatus()}
      />
      <StatCard
        title='Error Rate'
        value={`${data.errorRate.rate.toFixed(2)}%`}
        subtitle={`Threshold: ${data.errorRate.threshold.toFixed(2)}%`}
        icon={<AlertTriangle className='h-4 w-4' />}
        status={getErrorRateStatus()}
      />
    </div>
  );
};

SystemOverview.displayName = 'SystemOverview';
