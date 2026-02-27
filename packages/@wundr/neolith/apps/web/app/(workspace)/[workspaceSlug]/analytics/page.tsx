'use client';

import { BarChart3 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { usePageHeader } from '@/contexts/page-header-context';

export default function AnalyticsPage(): JSX.Element {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader('Analytics', 'View workspace analytics and insights');
  }, [setPageHeader]);

  if (!workspaceSlug) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <BarChart3 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
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

  return <AnalyticsDashboard workspaceId={workspaceSlug} />;
}
