'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import React from 'react';
import { OrgNode, OrgNodeSkeleton } from './OrgNode';
import type { OrgChartProps } from './types';

/**
 * Organization Hierarchy Chart component (Wave 1.1.3)
 * Displays the full hierarchy: Organization > Workspaces > VPs
 * Features:
 * - Expandable/collapsible nodes
 * - Discipline-based color coding
 * - VP status indicators
 * - Reporting line visualization
 * - Responsive grid layout
 * - Drill-down to VP details
 */
export function OrgHierarchyChart({ hierarchy, onNodeClick, className }: OrgChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Organization Hierarchy</CardTitle>
          <CardDescription>
            View your organization structure, workspaces, and virtual persons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <OrgNodeRenderer node={hierarchy} depth={0} onNodeClick={onNodeClick} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Helper component to manage individual node state
 */
function OrgNodeRenderer({
  node,
  depth,
  onNodeClick,
}: {
  node: OrgChartProps['hierarchy'];
  depth: number;
  onNodeClick?: OrgChartProps['onNodeClick'];
}) {
  const [isExpanded, setIsExpanded] = React.useState(depth < 2); // Auto-expand org and workspace levels

  return (
    <OrgNode
      node={node}
      depth={depth}
      onNodeClick={onNodeClick}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
    />
  );
}

/**
 * Loading state for org hierarchy chart
 */
export function OrgHierarchyChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Hierarchy</CardTitle>
        <CardDescription>Loading organization structure...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <OrgNodeSkeleton type="organization" />
          <div className="ml-8 space-y-3">
            <OrgNodeSkeleton type="workspace" />
            <OrgNodeSkeleton type="workspace" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no organization data exists
 */
export function OrgHierarchyChartEmpty({ message = 'No organization data available' }: { message?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Organization Found</h3>
          <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Error state for org hierarchy chart
 */
export function OrgHierarchyChartError({ error }: { error: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Error Loading Organization</h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
      </CardContent>
    </Card>
  );
}
