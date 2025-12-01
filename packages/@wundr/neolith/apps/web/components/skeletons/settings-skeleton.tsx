/**
 * Settings Skeleton Component
 * @module components/skeletons/settings-skeleton
 */
'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='space-y-2'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-4 w-96' />
      </div>

      {/* Settings Sections */}
      <div className='space-y-6'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className='rounded-lg border p-6 space-y-4'>
            {/* Section Header */}
            <div className='space-y-2 pb-4 border-b'>
              <Skeleton className='h-6 w-40' />
              <Skeleton className='h-4 w-64' />
            </div>

            {/* Settings Items */}
            <div className='space-y-4'>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <Skeleton className='h-5 w-32' />
                    <Skeleton className='h-3 w-48' />
                  </div>
                  <Skeleton className='h-10 w-20' />
                </div>
              ))}
            </div>

            {/* Action Button */}
            <div className='pt-4 border-t'>
              <Skeleton className='h-10 w-32' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
