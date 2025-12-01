/**
 * Agents List Loading State
 * @module app/(workspace)/[workspaceSlug]/agents/loading
 */
import { AgentGridSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function AgentsLoading() {
  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <Skeleton className='h-10 w-32' />
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4 sm:flex-row'>
        <div className='flex-1'>
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-40' />
          <Skeleton className='h-10 w-40' />
        </div>
      </div>

      {/* Results count */}
      <Skeleton className='h-4 w-48' />

      {/* Agent Grid */}
      <AgentGridSkeleton count={9} />
    </div>
  );
}
