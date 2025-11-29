'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, MessageSquare, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
        ? 'text-red-600'
        : 'text-gray-600';

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {change && (
          <span className={cn('text-xs font-medium', trendColor)}>{change}</span>
        )}
      </div>
    </div>
  );
}

interface OrchestratorMetricsProps {
  orchestratorId: string;
  totalMessages?: number;
  activeConversations?: number;
  avgResponseTime?: string;
  successRate?: string;
  className?: string;
}

export function OrchestratorMetrics({
  totalMessages = 0,
  activeConversations = 0,
  avgResponseTime = '0s',
  successRate = '0%',
  className,
}: OrchestratorMetricsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Messages"
            value={totalMessages.toLocaleString()}
            change="+12%"
            trend="up"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <MetricCard
            title="Active Conversations"
            value={activeConversations}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="Avg Response Time"
            value={avgResponseTime}
            change="-5%"
            trend="up"
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            title="Success Rate"
            value={successRate}
            change="+2%"
            trend="up"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}
