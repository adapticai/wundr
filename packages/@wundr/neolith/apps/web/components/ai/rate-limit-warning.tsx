'use client';

/**
 * Rate Limit Warning Component
 *
 * Displays warnings when users approach or exceed their AI rate limits.
 * Shows at 80% threshold with actionable guidance.
 */

import React from 'react';
import { AlertTriangle, Clock, Zap, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export interface RateLimitWarningProps {
  /** Current usage percentage (0-100) */
  percentage: number;
  /** Type of limit being approached */
  limitType: 'hourly' | 'daily' | 'monthly';
  /** Maximum limit value */
  limit: number;
  /** Current usage count */
  current: number;
  /** Time when limit resets */
  resetAt: Date;
  /** Whether limit is actually exceeded */
  exceeded?: boolean;
  /** Optional callback for upgrade action */
  onUpgrade?: () => void;
  /** Whether to show compact version */
  compact?: boolean;
}

export function RateLimitWarning({
  percentage,
  limitType,
  limit,
  current,
  resetAt,
  exceeded = false,
  onUpgrade,
  compact = false,
}: RateLimitWarningProps) {
  // Don't show warning if usage is below 80%
  if (percentage < 80 && !exceeded) {
    return null;
  }

  const isApproaching = percentage >= 80 && percentage < 100;
  const isExceeded = exceeded || percentage >= 100;

  const Icon = isExceeded ? AlertTriangle : TrendingUp;
  const variant = isExceeded ? 'destructive' : 'default';

  const getTitle = () => {
    if (isExceeded) {
      return `${getLimitTypeLabel(limitType)} Rate Limit Exceeded`;
    }
    return `Approaching ${getLimitTypeLabel(limitType)} Rate Limit`;
  };

  const getDescription = () => {
    const remaining = Math.max(0, limit - current);
    const resetTime = formatDistanceToNow(resetAt, { addSuffix: true });

    if (isExceeded) {
      return `You've reached your ${limitType} limit of ${limit.toLocaleString()} requests. Your limit will reset ${resetTime}.`;
    }

    return `You've used ${current.toLocaleString()} of ${limit.toLocaleString()} requests (${percentage.toFixed(0)}%). ${remaining.toLocaleString()} requests remaining. Resets ${resetTime}.`;
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
          isExceeded
            ? 'bg-destructive/10 text-destructive'
            : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
        }`}
      >
        <Icon className='h-4 w-4' />
        <span className='flex-1'>
          {isExceeded
            ? 'Rate limit exceeded'
            : `${percentage.toFixed(0)}% of ${limitType} limit used`}
        </span>
        <Clock className='h-3 w-3 opacity-60' />
        <span className='text-xs opacity-60'>
          {formatDistanceToNow(resetAt, { addSuffix: true })}
        </span>
      </div>
    );
  }

  return (
    <Alert variant={variant} className='mb-4'>
      <Icon className='h-4 w-4' />
      <AlertTitle>{getTitle()}</AlertTitle>
      <AlertDescription className='mt-2 space-y-3'>
        <p>{getDescription()}</p>

        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
          <div className='flex items-center gap-1'>
            <Zap className='h-3 w-3' />
            <span>
              {current.toLocaleString()} / {limit.toLocaleString()} requests
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            <span>
              Resets {formatDistanceToNow(resetAt, { addSuffix: true })}
            </span>
          </div>
        </div>

        {isExceeded && (
          <div className='pt-2 space-y-2'>
            <p className='text-sm'>
              <strong>What you can do:</strong>
            </p>
            <ul className='text-sm space-y-1 list-disc list-inside'>
              <li>Wait for your limit to reset</li>
              <li>Use AI features more sparingly</li>
              {onUpgrade && <li>Upgrade to a higher tier for more capacity</li>}
            </ul>

            {onUpgrade && (
              <Button size='sm' onClick={onUpgrade} className='mt-3'>
                <TrendingUp className='h-3 w-3 mr-2' />
                Upgrade Plan
              </Button>
            )}
          </div>
        )}

        {isApproaching && !isExceeded && (
          <div className='pt-2'>
            <p className='text-sm text-muted-foreground'>
              Consider pacing your AI requests to avoid hitting the limit before
              it resets.
            </p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function getLimitTypeLabel(type: 'hourly' | 'daily' | 'monthly'): string {
  switch (type) {
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return 'Daily';
    case 'monthly':
      return 'Monthly';
    default:
      return 'Rate';
  }
}

/**
 * Inline compact warning for use in forms and chat interfaces
 */
export function InlineRateLimitWarning({
  percentage,
  limitType,
  exceeded = false,
}: Pick<RateLimitWarningProps, 'percentage' | 'limitType' | 'exceeded'>) {
  if (percentage < 80 && !exceeded) {
    return null;
  }

  const isExceeded = exceeded || percentage >= 100;

  return (
    <div
      className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
        isExceeded
          ? 'bg-destructive/10 text-destructive'
          : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
      }`}
    >
      <AlertTriangle className='h-3 w-3' />
      <span>
        {isExceeded
          ? `${getLimitTypeLabel(limitType)} limit exceeded`
          : `${percentage.toFixed(0)}% of ${limitType} limit used`}
      </span>
    </div>
  );
}
