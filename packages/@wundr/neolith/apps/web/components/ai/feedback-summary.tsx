/**
 * AI Feedback Summary Component
 *
 * Admin view for aggregated feedback statistics and trends
 *
 * @module components/ai/feedback-summary
 */

'use client';

import {
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Download,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface FeedbackStats {
  overview: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    positiveRate: number;
  };
  sentiments: {
    positive: number;
    negative: number;
    neutral: number;
  };
  categories: Record<string, number>;
  recentFeedback: Array<{
    id: string;
    sentiment: string;
    category: string | null;
    comment: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
  }>;
  trendData: Array<{
    date: string;
    sentiment: string;
    count: number;
  }>;
}

interface FeedbackSummaryProps {
  workspaceId: string;
  className?: string;
}

export function FeedbackSummary({
  workspaceId,
  className,
}: FeedbackSummaryProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadStats();
  }, [workspaceId, timeRange]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ workspaceId });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (timeRange === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      }

      if (timeRange !== 'all') {
        params.set('startDate', startDate.toISOString());
        params.set('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/ai/feedback/stats?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load feedback statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load feedback stats:', error);
      toast.error('Failed to load feedback statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        workspaceId,
        format,
      });

      const response = await fetch(`/api/ai/feedback/export?${params}`);

      if (!response.ok) {
        throw new Error('Failed to export feedback');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-feedback-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-feedback-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success(`Feedback exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export feedback:', error);
      toast.error('Failed to export feedback');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className='grid gap-4 md:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-16' />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const { overview, categories, recentFeedback } = stats;

  return (
    <div className={className}>
      {/* Header with time range and export */}
      <div className='flex items-center justify-between mb-6'>
        <div className='space-y-1'>
          <h2 className='text-2xl font-bold tracking-tight'>
            AI Feedback Analytics
          </h2>
          <p className='text-muted-foreground'>
            Monitor and analyze user feedback on AI responses
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='7d'>Last 7 days</SelectItem>
              <SelectItem value='30d'>Last 30 days</SelectItem>
              <SelectItem value='90d'>Last 90 days</SelectItem>
              <SelectItem value='all'>All time</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant='outline'
            size='sm'
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            <Download className='h-4 w-4 mr-2' />
            Export CSV
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => handleExport('json')}
            disabled={isExporting}
          >
            <Download className='h-4 w-4 mr-2' />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className='grid gap-4 md:grid-cols-4 mb-6'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Feedback
            </CardTitle>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{overview.total}</div>
            <p className='text-xs text-muted-foreground'>
              {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Positive</CardTitle>
            <ThumbsUp className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {overview.positive}
            </div>
            <p className='text-xs text-muted-foreground'>
              {overview.total > 0
                ? `${((overview.positive / overview.total) * 100).toFixed(1)}%`
                : '0%'}{' '}
              of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Negative</CardTitle>
            <ThumbsDown className='h-4 w-4 text-red-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              {overview.negative}
            </div>
            <p className='text-xs text-muted-foreground'>
              {overview.total > 0
                ? `${((overview.negative / overview.total) * 100).toFixed(1)}%`
                : '0%'}{' '}
              of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Satisfaction Rate
            </CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{overview.positiveRate}%</div>
            <p className='text-xs text-muted-foreground'>
              Positive feedback rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <div className='grid gap-4 md:grid-cols-2 mb-6'>
        <Card>
          <CardHeader>
            <CardTitle>Feedback by Category</CardTitle>
            <CardDescription>
              Most common issues reported by users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(categories).length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No categorized feedback yet
              </p>
            ) : (
              <div className='space-y-3'>
                {Object.entries(categories)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className='flex items-center justify-between'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center justify-between mb-1'>
                          <span className='text-sm font-medium capitalize'>
                            {category}
                          </span>
                          <span className='text-sm text-muted-foreground'>
                            {count}
                          </span>
                        </div>
                        <div className='h-2 bg-secondary rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-primary'
                            style={{
                              width: `${(count / overview.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback</CardTitle>
            <CardDescription>Latest feedback from users</CardDescription>
          </CardHeader>
          <CardContent>
            {recentFeedback.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No feedback yet</p>
            ) : (
              <div className='space-y-4'>
                {recentFeedback.slice(0, 5).map(item => (
                  <div key={item.id} className='flex gap-3 text-sm'>
                    <div className='flex-shrink-0 mt-0.5'>
                      {item.sentiment === 'POSITIVE' ? (
                        <ThumbsUp className='h-4 w-4 text-green-600' />
                      ) : item.sentiment === 'NEGATIVE' ? (
                        <ThumbsDown className='h-4 w-4 text-red-600' />
                      ) : (
                        <MessageSquare className='h-4 w-4 text-gray-600' />
                      )}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        {item.category && (
                          <span className='inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium'>
                            {item.category}
                          </span>
                        )}
                        <span className='text-xs text-muted-foreground'>
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {item.comment && (
                        <p className='mt-1 text-muted-foreground line-clamp-2'>
                          {item.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
