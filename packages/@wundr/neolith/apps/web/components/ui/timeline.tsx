import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Timeline Container
const Timeline = React.forwardRef<
  HTMLOListElement,
  React.HTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn('relative space-y-8', className)}
    {...props}
  />
));
Timeline.displayName = 'Timeline';

// Timeline Item
const TimelineItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement> & {
    align?: 'left' | 'right';
  }
>(({ className, align = 'left', ...props }, ref) => (
  <li
    ref={ref}
    className={cn(
      'relative flex gap-4',
      align === 'right' && 'flex-row-reverse',
      className,
    )}
    {...props}
  />
));
TimelineItem.displayName = 'TimelineItem';

// Timeline Dot Variants
const timelineDotVariants = cva(
  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
  {
    variants: {
      variant: {
        default: 'border-muted-foreground/50 text-muted-foreground',
        success: 'border-green-500 bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
        warning: 'border-yellow-500 bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
        error: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
        info: 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        primary: 'border-primary bg-primary/10 text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface TimelineDotProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timelineDotVariants> {
  icon?: React.ReactNode;
}

const TimelineDot = React.forwardRef<HTMLDivElement, TimelineDotProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(timelineDotVariants({ variant }), className)}
      {...props}
    >
      {icon || children || (
        <div className="h-2 w-2 rounded-full bg-current" />
      )}
    </div>
  ),
);
TimelineDot.displayName = 'TimelineDot';

// Timeline Connector
const TimelineConnector = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'solid' | 'dashed';
  }
>(({ className, variant = 'solid', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute left-4 top-8 h-[calc(100%+2rem)] w-px -translate-x-1/2 bg-border',
      variant === 'dashed' && 'bg-[linear-gradient(to_bottom,var(--border)_50%,transparent_50%)] bg-[length:1px_8px]',
      className,
    )}
    {...props}
  />
));
TimelineConnector.displayName = 'TimelineConnector';

// Timeline Content
const TimelineContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-1 flex-col gap-1', className)}
    {...props}
  />
));
TimelineContent.displayName = 'TimelineContent';

// Timeline Time
const TimelineTime = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
));
TimelineTime.displayName = 'TimelineTime';

// Timeline Title
const TimelineTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
TimelineTitle.displayName = 'TimelineTitle';

// Timeline Description
const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
TimelineDescription.displayName = 'TimelineDescription';

export {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineTime,
  TimelineTitle,
  TimelineDescription,
  timelineDotVariants,
};
