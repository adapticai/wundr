'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { SystemOverview as SystemOverviewType } from '@neolith/core/types';
import { Activity, Users, Coins, AlertTriangle } from 'lucide-react';

interface SystemOverviewProps {
  data: SystemOverviewType;
}

export function SystemOverview({ data }: SystemOverviewProps) {
  const stats = [
    {
      label: 'Active Orchestrators',
      value: data.activeOrchestrators,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      label: 'Total Sessions',
      value: data.totalSessions,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Token Usage',
      value: `${data.tokenUsage.percentUsed.toFixed(1)}%`,
      subtitle: `${data.tokenUsage.daily.toLocaleString()} / ${data.tokenUsage.limit.toLocaleString()}`,
      icon: Coins,
      color:
        data.tokenUsage.percentUsed > 80
          ? 'text-orange-600'
          : 'text-purple-600',
      bgColor:
        data.tokenUsage.percentUsed > 80
          ? 'bg-orange-50 dark:bg-orange-950'
          : 'bg-purple-50 dark:bg-purple-950',
    },
    {
      label: 'Error Rate',
      value: `${data.errorRate.toFixed(2)}%`,
      icon: AlertTriangle,
      color: data.errorRate > 5 ? 'text-red-600' : 'text-yellow-600',
      bgColor:
        data.errorRate > 5
          ? 'bg-red-50 dark:bg-red-950'
          : 'bg-yellow-50 dark:bg-yellow-950',
    },
  ];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between space-x-4'>
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium text-muted-foreground'>
                    {stat.label}
                  </p>
                  <div className='flex items-baseline space-x-2'>
                    <p className='text-2xl font-bold'>{stat.value}</p>
                  </div>
                  {stat.subtitle && (
                    <p className='text-xs text-muted-foreground'>
                      {stat.subtitle}
                    </p>
                  )}
                </div>
                <div className={`rounded-full p-3 ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
