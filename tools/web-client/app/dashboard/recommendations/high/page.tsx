'use client';

import React from 'react';
import { useAnalysis } from '@/lib/contexts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Clock,
  Flame,
  RefreshCw,
  Database,
} from 'lucide-react';

export default function HighPriorityRecommendationsPage() {
  const { state } = useAnalysis();
  const { data, loading, error } = state;

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">{error?.message || 'An error occurred'}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Database className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Analysis Data Available</h2>
          <p className="text-muted-foreground max-w-md">
            Upload an analysis report to view high priority recommendations
          </p>
        </div>
      </div>
    );
  }

  // Generate recommendations from data
  const highComplexityEntities = data.entities.filter((e: any) => (e.complexity || 0) > 15);
  const criticalDuplicates = data.duplicates.filter((d: any) => d.severity === 'high');
  
  const totalIssues = highComplexityEntities.length + criticalDuplicates.length;
  const criticalCount = criticalDuplicates.length;
  const estimatedHours = (highComplexityEntities.length * 8) + (criticalDuplicates.length * 4);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-500" />
            High Priority Recommendations
          </h1>
          <p className="text-sm text-muted-foreground">
            Critical issues requiring immediate attention
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalIssues}</div>
            <p className="text-xs text-muted-foreground">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Immediate action needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Effort</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedHours}h</div>
            <p className="text-xs text-muted-foreground">Total work hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2-3</div>
            <p className="text-xs text-muted-foreground">Weeks to resolve</p>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">High Priority Issues</h2>
        
        {criticalDuplicates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="destructive">CRITICAL</Badge>
                {criticalDuplicates.length} Code Duplications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Multiple identical code blocks detected that pose maintenance risks and increase technical debt.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>Impact: High</span>
                <span>Effort: {criticalDuplicates.length * 4}h</span>
                <span>Files: {criticalDuplicates.reduce((sum: number, d: any) => sum + d.occurrences.length, 0)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {highComplexityEntities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="destructive">HIGH</Badge>
                {highComplexityEntities.length} High Complexity Components
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Components with excessive complexity that are difficult to maintain and test.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>Impact: High</span>
                <span>Effort: {highComplexityEntities.length * 8}h</span>
                <span>Files: {highComplexityEntities.length}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}