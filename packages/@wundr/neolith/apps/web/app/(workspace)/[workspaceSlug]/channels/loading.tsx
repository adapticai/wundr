/**
 * Channels List Loading State
 * @module app/(workspace)/[workspaceId]/channels/loading
 */
import { ChannelListSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChannelsLoading() {
  return (
    <div className='flex h-full'>
      {/* Sidebar with channel list */}
      <div className='w-64 border-r'>
        <ChannelListSkeleton />
      </div>

      {/* Main content area */}
      <div className='flex-1 space-y-6 p-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-96' />
          </div>
          <Skeleton className='h-10 w-40' />
        </div>

        {/* Content placeholder */}
        <div className='space-y-4'>
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-64 w-full' />
        </div>
      </div>
    </div>
  );
}
