/**
 * Workflow Grid Skeleton Component
 * @module components/skeletons/workflow-grid-skeleton
 */
'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

interface WorkflowGridSkeletonProps {
  count?: number;
}

export function WorkflowGridSkeleton({ count = 6 }: WorkflowGridSkeletonProps) {
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='rounded-lg border p-6 space-y-4'>
          {/* Icon and Status */}
          <div className='flex items-start justify-between'>
            <Skeleton className='h-10 w-10 rounded-lg' />
            <Skeleton className='h-5 w-14 rounded-full' />
          </div>

          {/* Title and Description */}
          <div className='space-y-2'>
            <Skeleton className='h-5 w-40' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-2/3' />
          </div>

          {/* Trigger Info */}
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-4 rounded' />
            <Skeleton className='h-3 w-32' />
          </div>

          {/* Footer */}
          <div className='flex items-center justify-between pt-4 border-t'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-6 w-6 rounded-full' />
              <Skeleton className='h-4 w-20' />
            </div>
            <Skeleton className='h-4 w-16' />
          </div>
        </div>
      ))}
    </div>
  );
}
