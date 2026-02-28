import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardSkeletonProps {
  className?: string;
}

export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn('p-4 md:p-6', className)}>
      {/* Header */}
      <Skeleton className='h-10 w-64 mb-8' />

      <div className='grid grid-cols-1 gap-8'>
        {/* Workspaces Section */}
        <section>
          <Skeleton className='h-7 w-40 mb-4' />
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            <WorkspaceCardSkeleton />
            <WorkspaceCardSkeleton />
            <WorkspaceCardSkeleton />
          </div>
        </section>

        {/* Dashboard Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {/* Recent Activity Card */}
          <DashboardCardSkeleton title='Recent Activity'>
            {[...Array(4)].map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </DashboardCardSkeleton>

          {/* Quick Stats Card */}
          <DashboardCardSkeleton title='Quick Stats'>
            {[...Array(4)].map((_, i) => (
              <StatItemSkeleton key={i} />
            ))}
          </DashboardCardSkeleton>

          {/* Quick Actions Card */}
          <DashboardCardSkeleton title='Quick Actions'>
            {[...Array(4)].map((_, i) => (
              <QuickActionSkeleton key={i} />
            ))}
          </DashboardCardSkeleton>
        </div>
      </div>
    </div>
  );
}

function WorkspaceCardSkeleton() {
  return (
    <div className='rounded-lg border bg-card p-6 shadow-sm'>
      <Skeleton className='h-6 w-3/4 mb-2' />
      <Skeleton className='h-4 w-full mb-4' />
      <div className='flex items-center justify-between'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-8 w-20' />
      </div>
    </div>
  );
}

interface DashboardCardSkeletonProps {
  title: string;
  children: React.ReactNode;
}

function DashboardCardSkeleton({
  title: _title,
  children,
}: DashboardCardSkeletonProps) {
  return (
    <div className='rounded-lg border bg-card p-6 shadow-sm'>
      <Skeleton className='h-6 w-32 mb-4' />
      <div className='space-y-3'>{children}</div>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className='flex items-start gap-3'>
      <Skeleton className='mt-1 h-2 w-2 rounded-full' />
      <div className='flex-1 min-w-0 space-y-1'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-3 w-1/2' />
      </div>
      <Skeleton className='h-3 w-16' />
    </div>
  );
}

function StatItemSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <Skeleton className='h-4 w-24' />
      <Skeleton className='h-8 w-12' />
    </div>
  );
}

function QuickActionSkeleton() {
  return (
    <div className='flex items-center justify-between rounded-lg border p-3'>
      <Skeleton className='h-4 w-32' />
      <Skeleton className='h-4 w-4 rounded' />
    </div>
  );
}
