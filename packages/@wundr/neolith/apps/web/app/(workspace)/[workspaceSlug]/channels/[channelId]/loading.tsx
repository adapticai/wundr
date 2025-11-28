import { MessageListSkeleton } from '@/components/skeletons';

export default function ChannelLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Channel Header Skeleton */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Messages Skeleton */}
      <div className="flex-1 overflow-hidden">
        <MessageListSkeleton messageCount={8} />
      </div>

      {/* Message Input Skeleton */}
      <div className="border-t p-4">
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
