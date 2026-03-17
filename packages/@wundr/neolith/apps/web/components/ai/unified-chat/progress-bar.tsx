'use client';

import { CheckCircle2 } from 'lucide-react';
import * as React from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  completionPercent: number;
  isReady: boolean;
  className?: string;
}

export function ProgressBar({
  completionPercent,
  isReady,
  className,
}: ProgressBarProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2', className)}>
      <Progress value={completionPercent} className='h-1.5 flex-1' />
      <span className='text-xs text-muted-foreground tabular-nums w-8 text-right'>
        {completionPercent}%
      </span>
      {isReady && (
        <span className='inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400'>
          <CheckCircle2 className='h-3 w-3' />
          Ready
        </span>
      )}
    </div>
  );
}
