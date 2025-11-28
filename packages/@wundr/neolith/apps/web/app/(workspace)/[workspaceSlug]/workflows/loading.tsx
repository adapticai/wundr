/**
 * Workflows List Loading State
 * @module app/(workspace)/[workspaceId]/workflows/loading
 */
import { WorkflowGridSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function WorkflowsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 flex-1 max-w-md" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Workflow Grid */}
      <WorkflowGridSkeleton count={9} />
    </div>
  );
}
