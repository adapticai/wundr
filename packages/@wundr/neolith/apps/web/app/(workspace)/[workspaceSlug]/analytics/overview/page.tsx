import {
  ArrowDown,
  ArrowUp,
  DollarSign,
  TrendingUp,
  Users,
  Activity,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Analytics Overview Page
 *
 * Demonstrates the analytics layout with sample metrics cards
 */
export default function AnalyticsOverviewPage() {
  const metrics = [
    {
      title: 'Total Users',
      value: '12,543',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      description: 'vs. previous period',
    },
    {
      title: 'Active Sessions',
      value: '8,234',
      change: '+8.2%',
      trend: 'up',
      icon: Activity,
      description: 'Last 30 days',
    },
    {
      title: 'Revenue',
      value: '$45,231',
      change: '+23.1%',
      trend: 'up',
      icon: DollarSign,
      description: 'Total revenue',
    },
    {
      title: 'Conversion Rate',
      value: '3.24%',
      change: '-2.4%',
      trend: 'down',
      icon: TrendingUp,
      description: 'vs. previous period',
    },
  ];

  return (
    <div className='space-y-6'>
      {/* Metrics Grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? ArrowUp : ArrowDown;

          return (
            <Card key={index}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  {metric.title}
                </CardTitle>
                <Icon className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{metric.value}</div>
                <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <span
                    className={
                      metric.trend === 'up'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    <TrendIcon className='inline h-3 w-3' />
                    {metric.change}
                  </span>
                  <span>{metric.description}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart Placeholders */}
      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>
              New users over the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex h-[300px] items-center justify-center rounded-md border border-dashed'>
              <p className='text-sm text-muted-foreground'>
                Chart component will render here
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement Metrics</CardTitle>
            <CardDescription>
              User engagement and activity patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex h-[300px] items-center justify-center rounded-md border border-dashed'>
              <p className='text-sm text-muted-foreground'>
                Chart component will render here
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Content */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events and user interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex h-[200px] items-center justify-center rounded-md border border-dashed'>
            <p className='text-sm text-muted-foreground'>
              Activity feed will render here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
