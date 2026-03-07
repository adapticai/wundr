'use client';

import { Activity, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface FlowStatsData {
  totalToday: number;
  totalAll: number;
  avgCompletionMs: number | null;
  successRate: number; // 0..1
  tasksByDiscipline: Array<{ discipline: string; count: number }>;
  tasksByStatus: Record<string, number>;
}

interface FlowStatsProps {
  stats: FlowStatsData | null;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

const disciplineChartConfig: ChartConfig = {
  count: {
    label: 'Tasks',
    color: 'hsl(var(--primary))',
  },
};

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between'>
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-medium text-muted-foreground truncate'>
              {label}
            </p>
            <p className='mt-1 text-2xl font-bold text-foreground'>{value}</p>
            {sub && (
              <p className='mt-0.5 text-xs text-muted-foreground'>{sub}</p>
            )}
          </div>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted',
              iconClass
            )}
          >
            <Icon className='h-5 w-5' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <Skeleton className='h-3 w-24 rounded' />
        <Skeleton className='mt-2 h-8 w-16 rounded' />
        <Skeleton className='mt-1 h-3 w-32 rounded' />
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

export function FlowStats({ stats, isLoading, className }: FlowStatsProps) {
  const chartData = useMemo(
    () =>
      (stats?.tasksByDiscipline ?? []).map(d => ({
        name:
          d.discipline.charAt(0).toUpperCase() +
          d.discipline.slice(1).toLowerCase(),
        count: d.count,
      })),
    [stats?.tasksByDiscipline]
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardContent className='p-4'>
            <Skeleton className='h-36 w-full rounded' />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const successRatePct = Math.round(stats.successRate * 100);

  return (
    <div className={cn('space-y-4', className)}>
      {/* KPI cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          icon={Activity}
          label='Tasks Today'
          value={String(stats.totalToday)}
          sub={`${stats.totalAll} total`}
          iconClass='text-blue-600'
        />
        <StatCard
          icon={CheckCircle2}
          label='Success Rate'
          value={`${successRatePct}%`}
          sub={
            stats.tasksByStatus.DONE != null
              ? `${stats.tasksByStatus.DONE} completed`
              : undefined
          }
          iconClass='text-green-600'
        />
        <StatCard
          icon={Clock}
          label='Avg Completion'
          value={
            stats.avgCompletionMs != null
              ? formatDuration(stats.avgCompletionMs)
              : '--'
          }
          sub='from submit to done'
          iconClass='text-yellow-600'
        />
        <StatCard
          icon={TrendingUp}
          label='In Progress'
          value={String(stats.tasksByStatus.IN_PROGRESS ?? 0)}
          sub={`${stats.tasksByStatus.BLOCKED ?? 0} blocked`}
          iconClass='text-purple-600'
        />
      </div>

      {/* Tasks by discipline chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Tasks by Discipline
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4'>
            <ChartContainer
              config={disciplineChartConfig}
              className='h-36 w-full'
            >
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  className='stroke-border'
                />
                <XAxis
                  dataKey='name'
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickMargin={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={<ChartTooltipContent indicator='dot' />}
                />
                <Bar
                  dataKey='count'
                  fill='hsl(var(--primary))'
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
