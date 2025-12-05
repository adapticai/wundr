'use client';

import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ProgressRingProps {
  /** Title of the metric */
  title: string;
  /** Current value */
  value: number;
  /** Maximum value (for percentage calculation) */
  max: number;
  /** Format type for value display */
  format?: 'number' | 'percentage' | 'currency' | 'compact';
  /** Size of the ring in pixels */
  size?: number;
  /** Thickness of the ring */
  strokeWidth?: number;
  /** Color scheme */
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gradient';
  /** Show percentage in center */
  showPercentage?: boolean;
  /** Show label below */
  showLabel?: boolean;
  /** Additional info text */
  subtitle?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Animation duration in ms */
  animationDuration?: number;
}

function formatValue(
  value: number,
  format: ProgressRingProps['format'] = 'number',
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(0)}%`;
    case 'compact':
      if (value < 1000) {
return value.toString();
}
      if (value < 1000000) {
return `${(value / 1000).toFixed(1)}K`;
}
      if (value < 1000000000) {
return `${(value / 1000000).toFixed(1)}M`;
}
      return `${(value / 1000000000).toFixed(1)}B`;
    default:
      return value.toLocaleString();
  }
}

function getColorClasses(
  color: ProgressRingProps['color'] = 'primary',
  percentage: number,
) {
  if (color === 'gradient') {
    if (percentage >= 80) {
return 'stroke-emerald-500';
}
    if (percentage >= 60) {
return 'stroke-blue-500';
}
    if (percentage >= 40) {
return 'stroke-amber-500';
}
    return 'stroke-rose-500';
  }

  const colors = {
    primary: 'stroke-primary',
    success: 'stroke-emerald-500',
    warning: 'stroke-amber-500',
    danger: 'stroke-rose-500',
    info: 'stroke-blue-500',
  };
  return colors[color];
}

export function ProgressRing({
  title,
  value,
  max,
  format = 'number',
  size = 120,
  strokeWidth = 8,
  color = 'primary',
  showPercentage = true,
  showLabel = true,
  subtitle,
  isLoading = false,
  className,
  animationDuration = 1000,
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = React.useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  // Animate the value on mount or when value changes
  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = animatedValue;
    const endValue = percentage;
    const duration = animationDuration;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;

      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, animationDuration]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className='p-6 flex flex-col items-center'>
          <Skeleton className='w-[120px] h-[120px] rounded-full mb-3' />
          <Skeleton className='h-4 w-24 mb-1' />
          <Skeleton className='h-3 w-32' />
        </CardContent>
      </Card>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;
  const center = size / 2;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className='p-6 flex flex-col items-center'>
        <div className='relative mb-3' style={{ width: size, height: size }}>
          <svg width={size} height={size} className='transform -rotate-90'>
            {/* Background circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill='none'
              stroke='currentColor'
              strokeWidth={strokeWidth}
              className='text-muted opacity-20'
            />

            {/* Progress circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill='none'
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap='round'
              className={cn(
                'transition-all duration-300',
                getColorClasses(color, percentage),
              )}
              style={{
                transitionProperty: 'stroke-dashoffset',
                transitionDuration: '300ms',
              }}
            />
          </svg>

          {/* Center content */}
          <div className='absolute inset-0 flex flex-col items-center justify-center'>
            {showPercentage && (
              <span className='text-2xl font-bold tracking-tight'>
                {Math.round(animatedValue)}%
              </span>
            )}
            {!showPercentage && (
              <div className='text-center'>
                <span className='text-xl font-bold block'>
                  {formatValue(value, format)}
                </span>
                <span className='text-xs text-muted-foreground'>
                  of {formatValue(max, format)}
                </span>
              </div>
            )}
          </div>
        </div>

        {showLabel && (
          <div className='text-center'>
            <h3 className='text-sm font-medium text-foreground mb-1'>
              {title}
            </h3>
            {subtitle && (
              <p className='text-xs text-muted-foreground'>{subtitle}</p>
            )}
            {showPercentage && (
              <p className='text-xs text-muted-foreground mt-1'>
                {formatValue(value, format)} of {formatValue(max, format)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface ProgressRingGroupProps {
  /** Array of progress rings to display */
  rings: Omit<ProgressRingProps, 'size' | 'strokeWidth'>[];
  /** Size of each ring */
  size?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ProgressRingGroup({
  rings,
  size = 100,
  isLoading = false,
  className,
}: ProgressRingGroupProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className='p-6'>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='flex flex-col items-center'>
                <Skeleton className='w-[100px] h-[100px] rounded-full mb-2' />
                <Skeleton className='h-4 w-20' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className='p-6'>
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {rings.map((ring, index) => (
            <div key={index} className='flex flex-col items-center'>
              <ProgressRing
                {...ring}
                size={size}
                strokeWidth={8}
                className='border-0 shadow-none p-0'
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
