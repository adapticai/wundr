import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  className?: string;
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;
}

export function TableSkeleton({
  className,
  columns = 5,
  rows = 10,
  showHeader = true,
  showFilters = true,
  showPagination = true,
}: TableSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters Section */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          {showHeader && (
            <thead className="bg-muted">
              <tr>
                {[...Array(columns)].map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton className="h-4 w-24" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border">
            {[...Array(rows)].map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/50">
                {[...Array(columns)].map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    {colIndex === 0 ? (
                      <TableCellWithAvatarSkeleton />
                    ) : colIndex === columns - 1 ? (
                      <Skeleton className="h-8 w-16 ml-auto rounded" />
                    ) : (
                      <Skeleton className={cn('h-4', getRandomWidth())} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded" />
            <Skeleton className="h-9 w-20 rounded" />
          </div>
        </div>
      )}
    </div>
  );
}

function TableCellWithAvatarSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function getRandomWidth(): string {
  const widths = ['w-24', 'w-32', 'w-40', 'w-48', 'w-56'];
  return widths[Math.floor(Math.random() * widths.length)];
}

// Specialized table skeletons for common use cases

export function MemberTableSkeleton({ className }: { className?: string }) {
  return (
    <TableSkeleton
      className={className}
      columns={6}
      rows={8}
      showHeader
      showFilters
      showPagination
    />
  );
}

export function AuditLogTableSkeleton({ className }: { className?: string }) {
  return (
    <TableSkeleton
      className={className}
      columns={5}
      rows={12}
      showHeader
      showFilters
      showPagination
    />
  );
}

export function IntegrationTableSkeleton({ className }: { className?: string }) {
  return (
    <TableSkeleton
      className={className}
      columns={4}
      rows={6}
      showHeader
      showFilters={false}
      showPagination={false}
    />
  );
}
