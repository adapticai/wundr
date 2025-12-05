import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MessageListSkeletonProps {
  className?: string;
  messageCount?: number;
}

export function MessageListSkeleton({
  className,
  messageCount = 8,
}: MessageListSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-4 p-4', className)}>
      {[...Array(messageCount)].map((_, i) => (
        <MessageItemSkeleton key={i} isOwnMessage={i % 3 === 0} />
      ))}
    </div>
  );
}

interface MessageItemSkeletonProps {
  isOwnMessage?: boolean;
}

function MessageItemSkeleton({
  isOwnMessage = false,
}: MessageItemSkeletonProps) {
  return (
    <div
      className={cn(
        'flex gap-3',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <Skeleton className='h-10 w-10 rounded-full shrink-0' />

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[70%]',
          isOwnMessage ? 'items-end' : 'items-start',
        )}
      >
        {/* Header */}
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-3 w-16' />
        </div>

        {/* Message Body */}
        <div
          className={cn(
            'space-y-2 w-full',
            isOwnMessage ? 'items-end flex flex-col' : '',
          )}
        >
          <Skeleton className={cn('h-4', isOwnMessage ? 'w-3/4' : 'w-full')} />
          <Skeleton className={cn('h-4', isOwnMessage ? 'w-1/2' : 'w-5/6')} />
        </div>

        {/* Reactions (occasionally) */}
        {Math.random() > 0.6 && (
          <div className='flex gap-1'>
            <Skeleton className='h-6 w-12 rounded-full' />
            <Skeleton className='h-6 w-12 rounded-full' />
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageLoadingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-4', className)}>
      <div className='flex gap-2'>
        <Skeleton className='h-2 w-2 rounded-full animate-pulse' />
        <Skeleton className='h-2 w-2 rounded-full animate-pulse [animation-delay:0.2s]' />
        <Skeleton className='h-2 w-2 rounded-full animate-pulse [animation-delay:0.4s]' />
      </div>
    </div>
  );
}
