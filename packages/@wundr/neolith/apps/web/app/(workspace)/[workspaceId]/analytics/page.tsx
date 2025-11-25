'use client';

import { useParams } from 'next/navigation';

import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnalyticsDashboard workspaceId={workspaceId} />
      </div>
    </div>
  );
}
