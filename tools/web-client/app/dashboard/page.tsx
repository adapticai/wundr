'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useAnalysisData } from '@/hooks/use-analysis-data';
import { useWebSocket } from '@/hooks/use-websocket';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileCode,
  Code,
  Copy,
  GitBranch,
  FileX,
  Bug,
  RefreshCw,
  Upload,
  Database,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const {
    data,
    loading,
    error,
    refresh,
    triggerAnalysis
  } = useAnalysisData({
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
    realtime: true
  });

  const [realtimeStats, setRealtimeStats] = useState<any>(null);

  const { isConnected, subscribe, lastMessage } = useWebSocket({
    enabled: true,
    onMessage: (message) => {
      if (message.type === 'data' && message.channel === 'dashboard') {
        setRealtimeStats(message.payload);
      }
    }
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('dashboard');
    }
  }, [isConnected, subscribe]);

  if (loading.isLoading && !data) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Dashboard</h1>
          <Skeleton className='h-10 w-32' />
        </div>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='h-32' />
          ))}
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          <Skeleton className='h-96' />
          <Skeleton className='h-96' />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-1 items-center justify-center p-4'>
        <div className='text-center space-y-4'>
          <AlertTriangle className='mx-auto h-12 w-12 text-destructive' />
          <h2 className='text-xl font-semibold'>Error Loading Dashboard</h2>
          <p className='text-lg text-muted-foreground mb-4'>{error.message}</p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={error.retry || refresh}>Try Again</Button>
            <Button variant='outline' onClick={triggerAnalysis}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Refresh Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='flex flex-1 items-center justify-center p-4'>
        <div className='text-center space-y-4'>
          <Database className='mx-auto h-12 w-12 text-muted-foreground' />
          <h2 className='text-xl font-semibold'>No Analysis Data Available</h2>
          <p className='text-muted-foreground max-w-md'>
            Trigger a new analysis to get started with real-time insights
          </p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={triggerAnalysis}>
              <Activity className='mr-2 h-4 w-4' />
              Start Analysis
            </Button>
            <Button variant='outline' onClick={refresh}>
              <Upload className='mr-2 h-4 w-4' />
              Check for Data
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const isRefreshing = loading.isRefreshing;
  const connectionStatus = isConnected ? 'connected' : 'disconnected';
  const lastUpdate = realtimeStats?.data?.lastUpdate || data.timestamp;

  return (
    <div className='flex flex-1 flex-col gap-4 p-4'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-3'>
            <h1 className='text-2xl font-bold'>Real-time Dashboard</h1>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              <Activity className='mr-1 h-3 w-3' />
              {connectionStatus}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            Last updated: {format(new Date(lastUpdate), 'PPpp')}
            {isRefreshing && ' • Refreshing...'}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button 
            variant='outline' 
            size='sm' 
            onClick={refresh} 
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size='sm' onClick={triggerAnalysis}>
            <Database className='mr-2 h-4 w-4' />
            New Analysis
          </Button>
        </div>
      </div>

      {/* Real-time Status Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Analysis Status</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>Active</div>
            <p className='text-xs text-muted-foreground'>
              Real-time monitoring enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Data Freshness</CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>Live</div>
            <p className='text-xs text-muted-foreground'>
              Updated {Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000)}s ago
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Critical Issues</CardTitle>
            <AlertTriangle className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              {data.recommendations.filter(r => r.priority === 'critical').length}
            </div>
            <p className='text-xs text-muted-foreground'>
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Quality Score</CardTitle>
            <TrendingUp className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {Math.round(summary.maintainabilityIndex)}
            </div>
            <p className='text-xs text-muted-foreground'>
              Maintainability index
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Metrics Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        <SummaryCard
          title='Total Files'
          value={realtimeStats?.data?.totalFiles || summary.totalFiles}
          icon={FileCode}
        />
        <SummaryCard
          title='Total Entities'
          value={realtimeStats?.data?.totalEntities || summary.totalEntities}
          icon={Code}
        />
        <SummaryCard
          title='Duplicate Clusters'
          value={realtimeStats?.data?.duplicateClusters || summary.duplicateClusters}
          icon={Copy}
          variant='critical'
        />
        <SummaryCard
          title='Circular Dependencies'
          value={realtimeStats?.data?.circularDependencies || summary.circularDependencies}
          icon={GitBranch}
          variant='warning'
        />
        <SummaryCard
          title='Unused Exports'
          value={realtimeStats?.data?.unusedExports || summary.unusedExports}
          icon={FileX}
          variant='info'
        />
        <SummaryCard
          title='Code Smells'
          value={realtimeStats?.data?.codeSmells || summary.codeSmells}
          icon={Bug}
        />
      </div>

      {/* Enhanced Dashboard Charts with Real-time Data */}
      <DashboardCharts 
        data={data as any} 
      />
    </div>
  );
}
