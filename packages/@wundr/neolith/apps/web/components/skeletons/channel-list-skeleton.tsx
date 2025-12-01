import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChannelListSkeletonProps {
  className?: string;
}

export function ChannelListSkeleton({ className }: ChannelListSkeletonProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search Bar */}
      <div className='p-3'>
        <Skeleton className='h-10 w-full rounded-md' />
      </div>

      <div className='flex-1 overflow-y-auto'>
        {/* Starred Section */}
        <ChannelSectionSkeleton title='Starred' itemCount={3} />

        {/* Channels Section */}
        <ChannelSectionSkeleton title='Channels' itemCount={5} showAction />

        {/* Direct Messages Section */}
        <ChannelSectionSkeleton
          title='Direct Messages'
          itemCount={4}
          showAction
        />
      </div>
    </div>
  );
}

interface ChannelSectionSkeletonProps {
  title: string;
  itemCount: number;
  showAction?: boolean;
}

function ChannelSectionSkeleton({
  title: _title,
  itemCount,
  showAction,
}: ChannelSectionSkeletonProps) {
  return (
    <div className='py-1'>
      {/* Section Header */}
      <div className='flex items-center justify-between py-1'>
        <div className='flex flex-1 items-center gap-1'>
          <Skeleton className='h-3 w-3 rounded' />
          <Skeleton className='h-3 w-24' />
        </div>
        {showAction && <Skeleton className='h-4 w-4 rounded' />}
      </div>

      {/* Channel Items */}
      <div className='mt-1 space-y-1'>
        {[...Array(itemCount)].map((_, i) => (
          <ChannelItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function ChannelItemSkeleton() {
  return (
    <div className='mx-2 flex items-center gap-2 rounded-md px-2 py-1.5'>
      <Skeleton className='h-4 w-4 rounded shrink-0' />
      <Skeleton className='h-4 flex-1' />
    </div>
  );
}
