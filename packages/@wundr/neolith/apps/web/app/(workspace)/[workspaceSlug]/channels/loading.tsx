/**
 * Channels List Loading State
 * @module app/(workspace)/[workspaceId]/channels/loading
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function ChannelsLoading() {
  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Action Button Header */}
      <div className='flex justify-end'>
        <Skeleton className='h-10 w-[152px]' />
      </div>

      {/* Channel Grid - matches sm:grid-cols-2 lg:grid-cols-3 */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='rounded-lg border bg-card p-4 space-y-3'>
            {/* Channel Header */}
            <div className='flex items-start justify-between gap-2'>
              <div className='flex items-center gap-2 min-w-0 flex-1'>
                <Skeleton className='h-4 w-4 flex-shrink-0' />
                <Skeleton className='h-5 w-32' />
              </div>
            </div>

            {/* Description */}
            <div className='space-y-2'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-3/4' />
            </div>

            {/* Stats */}
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-1'>
                <Skeleton className='h-3.5 w-3.5' />
                <Skeleton className='h-3 w-6' />
              </div>
              <div className='flex items-center gap-1'>
                <Skeleton className='h-3.5 w-3.5' />
                <Skeleton className='h-3 w-16' />
              </div>
            </div>

            {/* Last Message Preview */}
            <div className='pt-2 border-t'>
              <Skeleton className='h-3 w-full' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
