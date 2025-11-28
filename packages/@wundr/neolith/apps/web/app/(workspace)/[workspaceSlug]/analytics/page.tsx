'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Analytics', 'View workspace analytics and insights');
  }, [setPageHeader]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnalyticsDashboard workspaceId={workspaceSlug} />
      </div>
    </div>
  );
}
