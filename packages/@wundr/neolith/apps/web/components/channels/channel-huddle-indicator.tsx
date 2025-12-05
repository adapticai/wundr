'use client';

import { Headphones, Loader2, Users } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { HuddleResponse } from '@/lib/validations/call';

/**
 * Props for the ChannelHuddleIndicator component
 */
interface ChannelHuddleIndicatorProps {
  /** Active huddle data, null if no active huddle */
  huddle: HuddleResponse | null;
  /** Whether the current user is in the huddle */
  isInHuddle: boolean;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Callback to start a new huddle */
  onStartHuddle: (audioOnly?: boolean) => Promise<void>;
  /** Callback to join an existing huddle */
  onJoinHuddle: (audioOnly?: boolean) => Promise<void>;
  /** Callback to leave the current huddle */
  onLeaveHuddle: () => Promise<void>;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Huddle indicator showing active huddle in channel header.
 * Displays participant count, allows quick join/leave, and shows who's in the huddle.
 */
export function ChannelHuddleIndicator({
  huddle,
  isInHuddle,
  isLoading,
  onStartHuddle,
  onJoinHuddle,
  onLeaveHuddle,
  className,
}: ChannelHuddleIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const participantCount = huddle?.participantCount || 0;
  const hasActiveHuddle = huddle?.status === 'active';

  const handleStartHuddle = useCallback(async () => {
    try {
      await onStartHuddle(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to start huddle:', error);
    }
  }, [onStartHuddle]);

  const handleJoinHuddle = useCallback(async () => {
    try {
      await onJoinHuddle(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to join huddle:', error);
    }
  }, [onJoinHuddle]);

  const handleLeaveHuddle = useCallback(async () => {
    try {
      await onLeaveHuddle();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to leave huddle:', error);
    }
  }, [onLeaveHuddle]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveHuddle ? 'default' : 'ghost'}
          size='sm'
          className={cn(
            'h-8 gap-1.5 relative',
            hasActiveHuddle && 'bg-green-600 hover:bg-green-700 text-white',
            isInHuddle && 'ring-2 ring-green-400 ring-offset-2',
            className
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <Headphones className='h-4 w-4' />
          )}
          {hasActiveHuddle && participantCount > 0 && (
            <span className='text-xs font-medium'>{participantCount}</span>
          )}
          {isInHuddle && (
            <span className='absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 border-2 border-background animate-pulse' />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-64 p-3'>
        <div className='space-y-3'>
          {hasActiveHuddle ? (
            <>
              {/* Active huddle info */}
              <div className='space-y-1'>
                <div className='flex items-center gap-2'>
                  <div className='h-2 w-2 rounded-full bg-green-500 animate-pulse' />
                  <span className='text-sm font-medium'>Active Huddle</span>
                </div>
                {huddle?.name && (
                  <p className='text-xs text-muted-foreground pl-4'>
                    {huddle.name}
                  </p>
                )}
              </div>

              {/* Participant count */}
              <div className='flex items-center gap-2 text-sm text-muted-foreground pl-4'>
                <Users className='h-3.5 w-3.5' />
                <span>
                  {participantCount}{' '}
                  {participantCount === 1 ? 'person' : 'people'} in huddle
                </span>
              </div>

              {/* Started by */}
              {huddle?.createdBy && (
                <p className='text-xs text-muted-foreground pl-4'>
                  Started by {huddle.createdBy.name || 'Unknown'}
                </p>
              )}

              <div className='h-px bg-border' />

              {/* Action button */}
              {isInHuddle ? (
                <Button
                  onClick={handleLeaveHuddle}
                  variant='destructive'
                  size='sm'
                  className='w-full'
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <Headphones className='h-4 w-4 mr-2' />
                  )}
                  Leave Huddle
                </Button>
              ) : (
                <Button
                  onClick={handleJoinHuddle}
                  variant='default'
                  size='sm'
                  className='w-full bg-green-600 hover:bg-green-700'
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <Headphones className='h-4 w-4 mr-2' />
                  )}
                  Join Huddle
                </Button>
              )}
            </>
          ) : (
            <>
              {/* No active huddle */}
              <div className='space-y-1'>
                <span className='text-sm font-medium'>No active huddle</span>
                <p className='text-xs text-muted-foreground'>
                  Start a huddle to have a quick audio conversation with your
                  team
                </p>
              </div>

              <div className='h-px bg-border' />

              <Button
                onClick={handleStartHuddle}
                variant='default'
                size='sm'
                className='w-full bg-green-600 hover:bg-green-700'
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin mr-2' />
                ) : (
                  <Headphones className='h-4 w-4 mr-2' />
                )}
                Start a Huddle
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ChannelHuddleIndicator;
