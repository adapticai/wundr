'use client';

import { useAnalysis } from '@/lib/contexts/analysis-context';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { data, loading, error, loadSampleData } = useAnalysis();

  if (loading) {
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
        <div className='text-center'>
          <p className='text-lg text-muted-foreground mb-4'>{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
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
            Upload an analysis report or load sample data to get started
          </p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={loadSampleData}>
              <Database className='mr-2 h-4 w-4' />
              Load Sample Data
            </Button>
            <Button variant='outline'>
              <Upload className='mr-2 h-4 w-4' />
              Upload Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-4 p-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Dashboard</h1>
          <p className='text-sm text-muted-foreground'>
            Last updated: {format(new Date(data.timestamp), 'PPpp')}
          </p>
        </div>
        <Button variant='outline' size='sm'>
          <RefreshCw className='mr-2 h-4 w-4' />
          Refresh
        </Button>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        <SummaryCard
          title='Total Files'
          value={data.summary.totalFiles}
          icon={FileCode}
        />
        <SummaryCard
          title='Total Entities'
          value={data.summary.totalEntities}
          icon={Code}
        />
        <SummaryCard
          title='Duplicate Clusters'
          value={data.summary.duplicateClusters}
          icon={Copy}
          variant='critical'
        />
        <SummaryCard
          title='Circular Dependencies'
          value={data.summary.circularDependencies}
          icon={GitBranch}
          variant='warning'
        />
        <SummaryCard
          title='Unused Exports'
          value={data.summary.unusedExports}
          icon={FileX}
          variant='info'
        />
        <SummaryCard
          title='Code Smells'
          value={data.summary.codeSmells}
          icon={Bug}
        />
      </div>

      <DashboardCharts data={data} />
    </div>
  );
}
