'use client';

import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import { Mic, MicOff, Minimize2, X, Video as VideoIcon } from 'lucide-react';
import type { CallParticipant } from '@/lib/validations/call';

interface HuddleBarProps {
  /** Huddle ID */
  huddleId: string;
  /** Channel name */
  channelName: string;
  /** List of participants in the huddle */
  participants: CallParticipant[];
  /** Whether current user's audio is enabled */
  isAudioEnabled: boolean;
  /** Whether current user's video is enabled */
  isVideoEnabled: boolean;
  /** Callback to toggle audio */
  onToggleAudio?: () => void;
  /** Callback to toggle video */
  onToggleVideo?: () => void;
  /** Callback to minimize huddle to PIP */
  onMinimize?: () => void;
  /** Callback to leave huddle */
  onLeave?: () => void;
  /** Callback to expand huddle view */
  onExpand?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * HuddleBar Component
 *
 * Floating bar showing active huddle participants and controls.
 * Displayed at the top or bottom of the channel view when user is in a huddle.
 */
export function HuddleBar({
  channelName,
  participants,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onMinimize,
  onLeave,
  onExpand,
  className,
}: HuddleBarProps) {
  // Filter to active participants only
  const activeParticipants = participants.filter(p => !p.leftAt);

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background/95 backdrop-blur-sm border-t shadow-lg',
        'flex items-center justify-between gap-4 px-4 py-3',
        className
      )}
    >
      {/* Left: Huddle info and participants */}
      <div className='flex items-center gap-3 flex-1 min-w-0'>
        <button
          onClick={onExpand}
          className='flex flex-col items-start hover:bg-accent rounded-md px-2 py-1 transition-colors'
        >
          <span className='text-xs text-muted-foreground'>Huddle in</span>
          <span className='text-sm font-medium truncate'>#{channelName}</span>
        </button>

        {/* Participants */}
        <div className='flex items-center gap-2'>
          <div className='flex -space-x-2'>
            {activeParticipants.slice(0, 5).map((participant, index) => (
              <div
                key={participant.id}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center',
                  'rounded-full border-2 border-background bg-muted',
                  'text-xs font-medium'
                )}
                style={{ zIndex: 5 - index }}
                title={
                  participant.displayName ?? participant.user?.name ?? 'Unknown'
                }
              >
                {participant.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={participant.user.avatarUrl}
                    alt={participant.displayName ?? ''}
                    className='h-full w-full rounded-full object-cover'
                  />
                ) : (
                  getInitials(
                    participant.displayName ?? participant.user?.name ?? '?'
                  )
                )}
                {!participant.isAudioEnabled && (
                  <div className='absolute -bottom-1 -right-1 rounded-full bg-background p-0.5'>
                    <MicOff className='h-3 w-3 text-red-500' />
                  </div>
                )}
              </div>
            ))}
            {activeParticipants.length > 5 && (
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center',
                  'rounded-full border-2 border-background bg-muted',
                  'text-xs font-medium'
                )}
              >
                +{activeParticipants.length - 5}
              </div>
            )}
          </div>
          <span className='text-sm text-muted-foreground'>
            {activeParticipants.length}{' '}
            {activeParticipants.length === 1 ? 'person' : 'people'}
          </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className='flex items-center gap-2'>
        {/* Audio toggle */}
        <Button
          variant={isAudioEnabled ? 'ghost' : 'destructive'}
          size='sm'
          onClick={onToggleAudio}
          className={cn('h-9 w-9 p-0', isAudioEnabled && 'hover:bg-accent')}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? (
            <Mic className='h-4 w-4' />
          ) : (
            <MicOff className='h-4 w-4' />
          )}
        </Button>

        {/* Video toggle */}
        <Button
          variant={isVideoEnabled ? 'ghost' : 'destructive'}
          size='sm'
          onClick={onToggleVideo}
          className={cn('h-9 w-9 p-0', isVideoEnabled && 'hover:bg-accent')}
          title={isVideoEnabled ? 'Stop video' : 'Start video'}
        >
          {isVideoEnabled ? (
            <VideoIcon className='h-4 w-4' />
          ) : (
            <VideoIcon className='h-4 w-4' />
          )}
        </Button>

        {/* Minimize */}
        <Button
          variant='ghost'
          size='sm'
          onClick={onMinimize}
          className='h-9 w-9 p-0'
          title='Minimize to corner'
        >
          <Minimize2 className='h-4 w-4' />
        </Button>

        {/* Leave */}
        <Button
          variant='destructive'
          size='sm'
          onClick={onLeave}
          className='ml-2'
        >
          <X className='mr-1 h-4 w-4' />
          Leave
        </Button>
      </div>
    </div>
  );
}

export default HuddleBar;
