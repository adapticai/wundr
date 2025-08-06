import { Suspense } from 'react';
import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';
import { HistoricalReportsArchive } from '@/components/reports/historical-reports-archive';

export const metadata: Metadata = {
  title: 'Reports | Wundr Dashboard',
  description: 'Generate, schedule, and manage migration reports with advanced filtering and export capabilities.',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate comprehensive migration reports with advanced analytics and scheduling capabilities.
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">Reports Dashboard</TabsTrigger>
          <TabsTrigger value="archive">Historical Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Suspense fallback={<LoadingSkeleton />}>
            <ReportsDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <Suspense fallback={<LoadingSkeleton />}>
            <HistoricalReportsArchive />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}