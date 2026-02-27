'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { UsageAnalyticsDashboard } from '@/components/analytics/usage-analytics-dashboard';
import { usePageHeader } from '@/contexts/page-header-context';

export default function UsageAnalyticsPage(): JSX.Element {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Usage Analytics',
      'Monitor resource usage, costs, and feature adoption'
    );
  }, [setPageHeader]);

  if (!workspaceSlug) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <p className='text-lg font-medium text-foreground'>
            Invalid workspace
          </p>
          <p className='text-sm text-muted-foreground mt-2'>
            Unable to load usage analytics without a valid workspace identifier
          </p>
        </div>
      </div>
    );
  }

  return <UsageAnalyticsDashboard workspaceId={workspaceSlug} />;
}
