'use client';

/**
 * Dashboard Widgets Demo
 *
 * This file demonstrates all available metric widgets with example data.
 * Use this as a reference for implementing widgets in your dashboards.
 */

import {
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  Activity,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react';
import React from 'react';

import {
  KPICard,
  SparklineChart,
  ProgressRing,
  ProgressRingGroup,
  StatComparisonCard,
  RealtimeMetrics,
  RealtimeActivityFeed,
} from '../metric-widgets';

// Sample data generators
function generateSparklineData(points: number, min: number, max: number) {
  const data = [];
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    data.push({
      x: now - (points - i) * 3600000,
      y: Math.random() * (max - min) + min,
      label: new Date(now - (points - i) * 3600000).toLocaleString(),
    });
  }
  return data;
}

function generateRealtimeMetrics() {
  return [
    {
      id: 'active-users',
      label: 'Active Users',
      value: Math.floor(Math.random() * 500) + 100,
      previousValue: Math.floor(Math.random() * 500) + 100,
      format: 'number' as const,
      status: 'active' as const,
      lastUpdated: new Date(),
    },
    {
      id: 'revenue',
      label: 'Revenue Today',
      value: Math.random() * 10000 + 5000,
      previousValue: Math.random() * 10000 + 5000,
      format: 'currency' as const,
      status: 'active' as const,
      lastUpdated: new Date(),
    },
    {
      id: 'conversion',
      label: 'Conversion Rate',
      value: Math.random() * 10 + 2,
      previousValue: Math.random() * 10 + 2,
      format: 'percentage' as const,
      status: 'warning' as const,
      lastUpdated: new Date(),
    },
  ];
}

export function DashboardWidgetsDemo() {
  const [realtimeMetrics, setRealtimeMetrics] = React.useState(
    generateRealtimeMetrics()
  );

  const handleRealtimeUpdate = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateRealtimeMetrics();
  };

  return (
    <div className='space-y-8 p-8'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>Dashboard Widgets Demo</h1>
        <p className='text-muted-foreground'>
          Comprehensive examples of all available metric widgets
        </p>
      </div>

      {/* KPI Cards Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>KPI Cards</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <KPICard
            title='Total Revenue'
            value={124567}
            format='currency'
            icon={<DollarSign className='w-5 h-5' />}
            trend={{
              current: 124567,
              previous: 98234,
              percentageChange: 26.8,
              direction: 'up',
              isPositive: true,
            }}
            target={150000}
            status='success'
          />

          <KPICard
            title='Active Users'
            value={8456}
            format='compact'
            icon={<Users className='w-5 h-5' />}
            trend={{
              current: 8456,
              previous: 8234,
              percentageChange: 2.7,
              direction: 'up',
              isPositive: true,
            }}
            description='Number of users active in the last 30 days'
            status='success'
          />

          <KPICard
            title='Conversion Rate'
            value={3.8}
            format='percentage'
            icon={<Target className='w-5 h-5' />}
            trend={{
              current: 3.8,
              previous: 4.2,
              percentageChange: -9.5,
              direction: 'down',
              isPositive: false,
            }}
            target={5}
            status='warning'
          />

          <KPICard
            title='Avg Response Time'
            value={245}
            format='duration'
            icon={<Zap className='w-5 h-5' />}
            trend={{
              current: 245,
              previous: 312,
              percentageChange: -21.5,
              direction: 'down',
              isPositive: true,
            }}
            status='success'
          />
        </div>
      </section>

      {/* Sparkline Charts Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>Sparkline Charts</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          <SparklineChart
            title='Revenue Trend'
            currentValue={124567}
            data={generateSparklineData(24, 80000, 150000)}
            format='currency'
            color='success'
            filled={true}
            showPoints={false}
          />

          <SparklineChart
            title='User Growth'
            currentValue={8456}
            data={generateSparklineData(24, 6000, 9000)}
            format='compact'
            color='primary'
            filled={true}
            showPoints={true}
          />

          <SparklineChart
            title='System Load'
            currentValue={67.8}
            data={generateSparklineData(24, 40, 90)}
            format='percentage'
            color='warning'
            filled={false}
            showPoints={false}
          />
        </div>
      </section>

      {/* Progress Rings Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>Progress Rings</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='grid grid-cols-2 gap-4'>
            <ProgressRing
              title='Sales Target'
              value={87500}
              max={100000}
              format='currency'
              color='success'
              showPercentage={true}
              subtitle='Q4 2024'
            />

            <ProgressRing
              title='Tasks Complete'
              value={76}
              max={100}
              format='number'
              color='gradient'
              showPercentage={true}
              subtitle='This sprint'
            />

            <ProgressRing
              title='Storage Used'
              value={45.6}
              max={100}
              format='percentage'
              color='warning'
              showPercentage={false}
            />

            <ProgressRing
              title='API Quota'
              value={4523}
              max={10000}
              format='compact'
              color='info'
              showPercentage={true}
            />
          </div>

          <ProgressRingGroup
            rings={[
              {
                title: 'Backend',
                value: 85,
                max: 100,
                format: 'percentage',
                color: 'success',
                showPercentage: true,
              },
              {
                title: 'Frontend',
                value: 72,
                max: 100,
                format: 'percentage',
                color: 'primary',
                showPercentage: true,
              },
              {
                title: 'Database',
                value: 91,
                max: 100,
                format: 'percentage',
                color: 'info',
                showPercentage: true,
              },
              {
                title: 'Testing',
                value: 56,
                max: 100,
                format: 'percentage',
                color: 'warning',
                showPercentage: true,
              },
            ]}
            size={100}
          />
        </div>
      </section>

      {/* Comparison Cards Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>Stat Comparison Cards</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <StatComparisonCard
            title='Revenue Comparison'
            current={{
              label: 'This Month',
              value: 124567,
              metadata: {
                count: 1234,
                average: 100.95,
                peak: 5678,
              },
            }}
            previous={{
              label: 'Last Month',
              value: 98234,
              metadata: {
                count: 1056,
                average: 93.02,
                peak: 4523,
              },
            }}
            format='currency'
            icon={<DollarSign className='w-5 h-5' />}
            showDetails={true}
            mode='both'
          />

          <StatComparisonCard
            title='User Engagement'
            current={{
              label: 'This Week',
              value: 8456,
              metadata: {
                count: 8456,
                average: 1208,
                peak: 1523,
              },
            }}
            previous={{
              label: 'Last Week',
              value: 7234,
              metadata: {
                count: 7234,
                average: 1033,
                peak: 1389,
              },
            }}
            format='compact'
            icon={<Users className='w-5 h-5' />}
            showDetails={true}
            mode='both'
          />
        </div>
      </section>

      {/* Real-time Metrics Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>Real-time Updates</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <RealtimeMetrics
            metrics={realtimeMetrics}
            updateInterval={5000}
            onUpdate={handleRealtimeUpdate}
            showLiveIndicator={true}
          />

          <RealtimeActivityFeed
            activities={[
              {
                id: '1',
                type: 'user',
                message: 'New user registration: john@example.com',
                timestamp: new Date(Date.now() - 30000),
              },
              {
                id: '2',
                type: 'success',
                message: 'Payment processed: $1,234.56',
                timestamp: new Date(Date.now() - 60000),
              },
              {
                id: '3',
                type: 'alert',
                message: 'API response time above threshold',
                timestamp: new Date(Date.now() - 120000),
              },
              {
                id: '4',
                type: 'system',
                message: 'Database backup completed',
                timestamp: new Date(Date.now() - 180000),
              },
              {
                id: '5',
                type: 'user',
                message: 'User sarah@example.com upgraded to Pro',
                timestamp: new Date(Date.now() - 240000),
              },
            ]}
            maxItems={8}
          />
        </div>
      </section>

      {/* Loading States Section */}
      <section>
        <h2 className='text-2xl font-semibold mb-4'>Loading States</h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <KPICard title='Loading KPI' value={0} isLoading={true} />
          <SparklineChart
            title='Loading Chart'
            currentValue={0}
            data={[]}
            isLoading={true}
          />
          <ProgressRing
            title='Loading Ring'
            value={0}
            max={100}
            isLoading={true}
          />
        </div>
      </section>
    </div>
  );
}
