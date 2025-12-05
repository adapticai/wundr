'use client';

import { Mic, MicOff, Maximize2, PhoneOff } from 'lucide-react';
import { useState, useCallback } from 'react';

import { cn, getInitials } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { Huddle, HuddleParticipant } from '@/types/call';

/**
 * Props for the HuddleBar component.
 */
export interface HuddleBarProps {
  /** The active huddle data */
  huddle: Huddle;
  /** Whether the local user is muted */
  isMuted: boolean;
  /** Callback to toggle mute state */
  onToggleMute: () => void;
  /** Callback to leave the huddle */
  onLeave: () => void;
  /** Callback to expand huddle to full view */
  onExpand: () => void;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Participant avatar component for huddle bar
 */
function ParticipantAvatar({
  participant,
  size = 'small',
}: {
  participant: HuddleParticipant;
  size?: 'small' | 'medium';
}) {
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
  };

  const avatarUrl = participant.user.image;

  return (
    <div
      className={cn(
        'rounded-full bg-stone-500/10 flex items-center justify-center',
        'text-stone-700 dark:text-stone-300 font-medium',
        'border-2 border-background',
        'relative',
        sizeClasses[size]
      )}
      title={participant.user.name || participant.user.email}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={participant.user.name || 'User'}
          className='w-full h-full rounded-lg object-cover'
        />
      ) : (
        getInitials(participant.user.name || participant.user.email)
      )}
      {/* Speaking indicator */}
      {participant.isSpeaking && (
        <div className='absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-background' />
      )}
    </div>
  );
}

/**
 * Stacked avatars component showing multiple participants
 */
function StackedAvatars({
  participants,
  maxVisible = 3,
}: {
  participants: HuddleParticipant[];
  maxVisible?: number;
}) {
  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = Math.max(0, participants.length - maxVisible);

  return (
    <div className='flex -space-x-2'>
      {visibleParticipants.map(participant => (
        <ParticipantAvatar key={participant.id} participant={participant} />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'w-6 h-6 rounded-full',
            'bg-muted flex items-center justify-center',
            'text-xs font-medium text-foreground',
            'border-2 border-background'
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

/**
 * Mini floating bar for active huddle
 * Shows participant avatars, mute toggle, and expand/leave buttons
 */
export function HuddleBar({
  huddle,
  isMuted,
  onToggleMute,
  onLeave,
  onExpand,
  className,
}: HuddleBarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, action: () => void) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    },
    []
  );

  // Find speaking participant(s)
  const speakingParticipants = huddle.participants.filter(p => p.isSpeaking);

  return (
    <TooltipProvider>
      <div
        className={cn(
          'fixed bottom-4 left-1/2 -translate-x-1/2',
          'flex items-center gap-3 px-4 py-2',
          'bg-card/95 backdrop-blur-sm',
          'border border-border rounded-full',
          'shadow-lg',
          'transition-all duration-200',
          isHovered && 'scale-105',
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role='region'
        aria-label={`Active huddle: ${huddle.name}`}
      >
      {/* Speaking indicator / Wave animation */}
      <div className='flex items-center gap-1'>
        {speakingParticipants.length > 0 ? (
          <div
            className='flex items-center gap-0.5 h-4'
            aria-label='Someone is speaking'
          >
            {[1, 2, 3].map(bar => (
              <div
                key={bar}
                className='w-0.5 bg-green-500 rounded-full animate-pulse'
                style={{
                  height: `${Math.random() * 12 + 4}px`,
                  animationDelay: `${bar * 100}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className='w-4 h-4 rounded-full bg-muted flex items-center justify-center'>
            <div className='w-1.5 h-1.5 bg-muted-foreground rounded-full' />
          </div>
        )}
      </div>

      {/* Huddle name */}
      <button
        onClick={onExpand}
        onKeyDown={e => handleKeyDown(e, onExpand)}
        className={cn(
          'text-sm font-medium text-foreground',
          'hover:text-stone-700 dark:hover:text-stone-300 transition-colors',
          'truncate max-w-[120px]'
        )}
        aria-label={`Expand huddle: ${huddle.name}`}
      >
        {huddle.name}
      </button>

      {/* Divider */}
      <div className='w-px h-4 bg-border' />

      {/* Participant avatars */}
      <StackedAvatars participants={huddle.participants} maxVisible={3} />

      {/* Participant count */}
      <span className='text-xs text-muted-foreground'>
        {huddle.participants.length}
      </span>

      {/* Divider */}
      <div className='w-px h-4 bg-border' />

      {/* Mute toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleMute}
            onKeyDown={e => handleKeyDown(e, onToggleMute)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all',
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
          >
            {isMuted ? (
              <MicOff className='w-4 h-4' />
            ) : (
              <Mic className='w-4 h-4' />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isMuted ? 'Unmute' : 'Mute'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Expand button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onExpand}
            onKeyDown={e => handleKeyDown(e, onExpand)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'bg-muted hover:bg-muted/80 text-foreground',
              'transition-colors'
            )}
            aria-label='Expand to full view'
          >
            <Maximize2 className='w-4 h-4' />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Expand to full view</p>
        </TooltipContent>
      </Tooltip>

      {/* Leave button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onLeave}
            onKeyDown={e => handleKeyDown(e, onLeave)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
              'transition-colors'
            )}
            aria-label='Leave huddle'
          >
            <PhoneOff className='w-4 h-4' />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Leave huddle</p>
        </TooltipContent>
      </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/**
 * Huddle notification toast for incoming huddle invites
 */
export function HuddleInviteToast({
  huddle,
  onJoin,
  onDismiss,
}: {
  huddle: Huddle;
  onJoin: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        'fixed bottom-4 right-4',
        'flex items-center gap-3 p-4',
        'bg-card border border-border rounded-lg',
        'shadow-lg',
        'animate-slide-up'
      )}
      role='alert'
    >
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium text-foreground truncate'>
          {huddle.name}
        </p>
        <p className='text-xs text-muted-foreground'>
          {huddle.participants.length} participant
          {huddle.participants.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className='flex gap-2'>
        <button
          onClick={onDismiss}
          className={cn(
            'px-3 py-1.5 rounded-lg',
            'bg-muted hover:bg-muted/80',
            'text-sm text-foreground',
            'transition-colors'
          )}
        >
          Dismiss
        </button>
        <button
          onClick={onJoin}
          className={cn(
            'px-3 py-1.5 rounded-lg',
            'bg-stone-700 hover:bg-stone-800 dark:bg-stone-600 dark:hover:bg-stone-700',
            'text-sm text-white',
            'transition-colors'
          )}
        >
          Join
        </button>
      </div>
    </div>
  );
}

export default HuddleBar;
