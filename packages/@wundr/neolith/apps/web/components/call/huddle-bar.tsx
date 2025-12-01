'use client';

import { clsx } from 'clsx';
import { useState, useCallback } from 'react';

import { getInitials } from '@/lib/utils';

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
      className={clsx(
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
          className={clsx(
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
    <div
      className={clsx(
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
        className={clsx(
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
      <button
        onClick={onToggleMute}
        onKeyDown={e => handleKeyDown(e, onToggleMute)}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
          isMuted
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-muted hover:bg-muted/80 text-foreground'
        )}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        aria-pressed={isMuted}
      >
        {isMuted ? (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-4 h-4'
          >
            <line x1='2' x2='22' y1='2' y2='22' />
            <path d='M18.89 13.23A7.12 7.12 0 0 0 19 12v-2' />
            <path d='M5 10v2a7 7 0 0 0 12 5' />
            <path d='M15 9.34V5a3 3 0 0 0-5.68-1.33' />
            <path d='M9 9v3a3 3 0 0 0 5.12 2.12' />
            <line x1='12' x2='12' y1='19' y2='22' />
          </svg>
        ) : (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-4 h-4'
          >
            <path d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' />
            <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
            <line x1='12' x2='12' y1='19' y2='22' />
          </svg>
        )}
      </button>

      {/* Expand button */}
      <button
        onClick={onExpand}
        onKeyDown={e => handleKeyDown(e, onExpand)}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-muted hover:bg-muted/80 text-foreground',
          'transition-colors'
        )}
        aria-label='Expand to full view'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-4 h-4'
        >
          <path d='M15 3h6v6' />
          <path d='M9 21H3v-6' />
          <path d='m21 3-7 7' />
          <path d='m3 21 7-7' />
        </svg>
      </button>

      {/* Leave button */}
      <button
        onClick={onLeave}
        onKeyDown={e => handleKeyDown(e, onLeave)}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
          'transition-colors'
        )}
        aria-label='Leave huddle'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-4 h-4'
        >
          <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
          <line x1='1' x2='23' y1='1' y2='23' />
        </svg>
      </button>
    </div>
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
      className={clsx(
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
          className={clsx(
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
          className={clsx(
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
