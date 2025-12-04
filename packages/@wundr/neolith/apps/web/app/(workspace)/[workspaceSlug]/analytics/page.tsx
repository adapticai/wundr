'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { usePageHeader } from '@/contexts/page-header-context';

export default function AnalyticsPage(): JSX.Element {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();

  // Guard against missing workspace slug
  if (!workspaceSlug) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-lg font-medium text-foreground'>
            Invalid workspace
          </p>
          <p className='text-sm text-muted-foreground mt-2'>
            Unable to load analytics without a valid workspace identifier
          </p>
        </div>
      </div>
    );
  }

  // Set page header
  useEffect(() => {
    setPageHeader('Analytics', 'View workspace analytics and insights');
  }, [setPageHeader]);

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        <AnalyticsDashboard workspaceId={workspaceSlug} />
      </div>
    </div>
  );
}
