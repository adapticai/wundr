/**
 * OrchestratorGrid Skeleton Component
 * @module components/skeletons/orchestrator-grid-skeleton
 */
'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface OrchestratorGridSkeletonProps {
  count?: number;
}

export function OrchestratorGridSkeleton({ count = 6 }: OrchestratorGridSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border p-6 space-y-4"
        >
          {/* Avatar and Status */}
          <div className="flex items-start justify-between">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Title and Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Tags */}
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          {/* Footer Stats */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
