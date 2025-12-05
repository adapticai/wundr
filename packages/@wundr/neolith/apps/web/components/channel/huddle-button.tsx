'use client';

import { Video, Mic, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HuddleButtonProps {
  /** Whether there's an active huddle in the channel */
  hasActiveHuddle?: boolean;
  /** Number of participants in the active huddle */
  participantCount?: number;
  /** Whether the current user is in the huddle */
  isInHuddle?: boolean;
  /** Callback to start a new huddle */
  onStartHuddle?: (audioOnly: boolean) => void;
  /** Callback to join an existing huddle */
  onJoinHuddle?: (audioOnly: boolean) => void;
  /** Callback to leave the huddle */
  onLeaveHuddle?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * HuddleButton Component
 *
 * Button to start/join/leave huddles in a channel header.
 * Shows different states based on huddle status and user participation.
 */
export function HuddleButton({
  hasActiveHuddle = false,
  participantCount = 0,
  isInHuddle = false,
  onStartHuddle,
  onJoinHuddle,
  onLeaveHuddle,
  className,
  isLoading = false,
}: HuddleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // If user is in the huddle, show a Leave button
  if (isInHuddle) {
    return (
      <Button
        variant='outline'
        size='sm'
        onClick={onLeaveHuddle}
        disabled={isLoading}
        className={cn(
          'gap-2 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
          className,
        )}
      >
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <Mic className='h-4 w-4' />
            <div className='absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse' />
          </div>
          <span className='font-medium'>
            In Huddle {participantCount > 0 && `(${participantCount})`}
          </span>
        </div>
      </Button>
    );
  }

  // If there's an active huddle, show a Join button with dropdown
  if (hasActiveHuddle) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            disabled={isLoading}
            className={cn(
              'gap-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
              className,
            )}
          >
            <Mic className='h-4 w-4' />
            <span className='font-medium'>
              Join Huddle {participantCount > 0 && `(${participantCount})`}
            </span>
            <ChevronDown className='h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            onClick={() => {
              onJoinHuddle?.(false);
              setIsOpen(false);
            }}
          >
            <Video className='mr-2 h-4 w-4' />
            Join with video
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onJoinHuddle?.(true);
              setIsOpen(false);
            }}
          >
            <Mic className='mr-2 h-4 w-4' />
            Join audio only
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Otherwise, show a Start Huddle button with dropdown
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          disabled={isLoading}
          className={cn('gap-2', className)}
        >
          <Mic className='h-4 w-4' />
          <span>Huddle</span>
          <ChevronDown className='h-3 w-3' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => {
            onStartHuddle?.(false);
            setIsOpen(false);
          }}
        >
          <Video className='mr-2 h-4 w-4' />
          Start with video
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onStartHuddle?.(true);
            setIsOpen(false);
          }}
        >
          <Mic className='mr-2 h-4 w-4' />
          Start audio only
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HuddleButton;
