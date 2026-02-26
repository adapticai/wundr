'use client';

import { BarChart3 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PerformanceMonitoringDashboard } from '@/components/orchestrator/performance-monitoring-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';

export default function PerformancePage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageHeader(
      'Performance Monitoring',
      'Real-time metrics and performance data for orchestrators and the daemon'
    );
  }, [setPageHeader]);

  useEffect(() => {
    // Fetch workspace to get ID
    async function loadWorkspace() {
      setLoading(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceSlug}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspaceId(data.workspace?.id ?? data.id ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    void loadWorkspace();
  }, [workspaceSlug]);

  if (loading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <div className='grid gap-4 grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className='py-6'>
                <Skeleton className='h-16 w-full' />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Workspace not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <BarChart3 className='h-5 w-5 text-muted-foreground' />
        <h2 className='text-base font-semibold'>System Performance</h2>
      </div>
      <PerformanceMonitoringDashboard workspaceId={workspaceId} />
    </div>
  );
}
