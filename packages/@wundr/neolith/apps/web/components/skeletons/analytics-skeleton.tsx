/**
 * Analytics Skeleton Component
 * @module components/skeletons/analytics-skeleton
 */
'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsSkeleton() {
  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-10 w-40' />
      </div>

      {/* Metric Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='rounded-lg border p-4 space-y-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-7 w-16' />
            <div className='flex items-center gap-2'>
              <Skeleton className='h-3 w-8' />
              <Skeleton className='h-3 w-12' />
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className='rounded-lg border p-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-9 w-32' />
        </div>
        <Skeleton className='h-[400px] w-full' />
      </div>

      {/* Secondary Charts */}
      <div className='grid gap-4 lg:grid-cols-2'>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className='rounded-lg border p-6 space-y-4'>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-[250px] w-full' />
          </div>
        ))}
      </div>
    </div>
  );
}
