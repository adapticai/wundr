/**
 * Deployments List Loading State
 * @module app/(workspace)/[workspaceSlug]/deployments/loading
 */
import { DeploymentCardSkeleton } from '@/components/deployments/deployment-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DeploymentsLoading() {
  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <Skeleton className='h-10 w-40' />
      </div>

      {/* Status Summary Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`stat-${i}`} className='rounded-lg border bg-card p-4'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-8 w-12 mt-1' />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-16' />
          <Skeleton className='h-10 w-24' />
          <Skeleton className='h-10 w-20' />
          <Skeleton className='h-10 w-28' />
        </div>
        <Skeleton className='h-10 w-full sm:w-64' />
      </div>

      {/* Deployment Grid */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {Array.from({ length: 4 }, (_, i) => (
          <DeploymentCardSkeleton key={`deployment-${i}`} />
        ))}
      </div>
    </div>
  );
}
