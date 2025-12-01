'use client';

import Link from 'next/link';
import { ArrowDownIcon, ArrowUpIcon, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardStatsCardProps {
  /** Display label for the stat */
  label: string;
  /** The primary value to display */
  value: number | string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Optional trend indicator ('up' | 'down' | 'neutral') */
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    label?: string;
  };
  /** Optional link to navigate to when clicked */
  href?: string;
  /** Optional description text */
  description?: string;
  /** Optional className for custom styling */
  className?: string;
}

export function DashboardStatsCard({
  label,
  value,
  icon: Icon,
  trend,
  href,
  description,
  className,
}: DashboardStatsCardProps) {
  const content = (
    <Card
      className={cn(
        'transition-colors',
        href && 'cursor-pointer hover:bg-accent/50',
        className
      )}
    >
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        {Icon && <Icon className='h-4 w-4 text-muted-foreground' />}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {description && (
          <p className='text-xs text-muted-foreground mt-1'>{description}</p>
        )}
        {trend && (
          <div className='flex items-center gap-1 mt-2'>
            {trend.direction === 'up' && (
              <ArrowUpIcon className='h-3 w-3 text-green-600' />
            )}
            {trend.direction === 'down' && (
              <ArrowDownIcon className='h-3 w-3 text-red-600' />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                trend.direction === 'up' && 'text-green-600',
                trend.direction === 'down' && 'text-red-600',
                trend.direction === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend.value}
            </span>
            {trend.label && (
              <span className='text-xs text-muted-foreground ml-1'>
                {trend.label}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className='block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg'
      >
        {content}
      </Link>
    );
  }

  return content;
}
