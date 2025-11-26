'use client';

import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: Icon,
      title,
      description,
      action,
      secondaryAction,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8',
        className
      )}
      {...props}
    >
      <div className='flex w-full max-w-md flex-col items-center text-center'>
        {/* Icon */}
        <div className='mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted sm:h-16 sm:w-16'>
          <Icon className='h-7 w-7 text-muted-foreground sm:h-8 sm:w-8' />
        </div>

        {/* Title */}
        <h2 className='mb-2 text-lg font-semibold tracking-tight sm:text-xl md:text-2xl'>
          {title}
        </h2>

        {/* Description */}
        <p className='mb-6 text-sm text-muted-foreground sm:text-base md:mb-8'>
          {description}
        </p>

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className='flex w-full flex-col gap-2 sm:flex-row sm:justify-center'>
            {action && (
              <Button
                onClick={action.onClick}
                variant={action.variant || 'default'}
                className='w-full sm:w-auto'
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                onClick={secondaryAction.onClick}
                variant={secondaryAction.variant || 'outline'}
                className='w-full sm:w-auto'
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
);

EmptyState.displayName = 'EmptyState';

export { EmptyState, type EmptyStateProps, type EmptyStateAction };
