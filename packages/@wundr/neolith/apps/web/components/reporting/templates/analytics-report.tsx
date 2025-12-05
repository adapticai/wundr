'use client';

/**
 * Analytics Report Template
 * Pre-built template for analytics and metrics reports
 */

import { Activity, BarChart3, TrendingUp, Users } from 'lucide-react';
import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { AreaChart } from '../charts/area-chart';
import { BarChart } from '../charts/bar-chart';
import { LineChart } from '../charts/line-chart';
import { PieChart } from '../charts/pie-chart';

import type { DateRange } from '../types';

interface AnalyticsReportProps {
  title?: string;
  dateRange?: DateRange;
  overviewData: {
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    avgSessionDuration: string;
  };
  timeSeriesData: Array<Record<string, string | number>>;
  categoryData: Array<{ name: string; value: number }>;
  comparisonData: Array<Record<string, string | number>>;
  className?: string;
}

export function AnalyticsReport({
  title = 'Analytics Report',
  dateRange,
  overviewData,
  timeSeriesData,
  categoryData,
  comparisonData,
  className,
}: AnalyticsReportProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {dateRange && (
          <p className="text-muted-foreground mt-1">
            {dateRange.from.toLocaleDateString()} -{' '}
            {dateRange.to.toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.totalUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.activeUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((overviewData.activeUsers / overviewData.totalUsers) * 100).toFixed(
                1,
              )}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.totalSessions.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Session Duration
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.avgSessionDuration}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <AreaChart
            title="Activity Over Time"
            description="User activity and engagement trends"
            data={timeSeriesData}
            dataKeys={Object.keys(timeSeriesData[0] || {}).filter(
              (k) => k !== 'date' && k !== 'name',
            )}
            xAxisKey="date"
            height={400}
            gradient
          />

          <div className="grid gap-4 md:grid-cols-2">
            <PieChart
              title="Category Distribution"
              description="Breakdown by category"
              data={categoryData}
              height={350}
              donut
            />

            <BarChart
              title="Category Comparison"
              description="Comparative analysis"
              data={comparisonData}
              dataKeys={Object.keys(comparisonData[0] || {}).filter(
                (k) => k !== 'category' && k !== 'name',
              )}
              xAxisKey="category"
              height={350}
            />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <LineChart
            title="Trend Analysis"
            description="Detailed trend analysis over time"
            data={timeSeriesData}
            dataKeys={Object.keys(timeSeriesData[0] || {}).filter(
              (k) => k !== 'date' && k !== 'name',
            )}
            xAxisKey="date"
            height={400}
            showGrid
          />

          <AreaChart
            title="Stacked Trends"
            description="Combined view of all metrics"
            data={timeSeriesData}
            dataKeys={Object.keys(timeSeriesData[0] || {}).filter(
              (k) => k !== 'date' && k !== 'name',
            )}
            xAxisKey="date"
            height={400}
            stacked
          />
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PieChart
              title="Distribution"
              data={categoryData}
              height={350}
            />

            <PieChart
              title="Donut View"
              data={categoryData}
              height={350}
              donut
              innerRadius={80}
            />
          </div>

          <BarChart
            title="Horizontal Comparison"
            description="Side-by-side category comparison"
            data={comparisonData}
            dataKeys={Object.keys(comparisonData[0] || {}).filter(
              (k) => k !== 'category' && k !== 'name',
            )}
            xAxisKey="category"
            height={400}
            horizontal
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
