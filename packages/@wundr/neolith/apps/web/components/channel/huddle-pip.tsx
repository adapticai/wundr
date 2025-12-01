'use client';

import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import { Maximize2, Mic, MicOff, Video, X } from 'lucide-react';
import { useState } from 'react';
import type { CallParticipant } from '@/lib/validations/call';

interface HuddlePipProps {
  /** Channel name */
  channelName: string;
  /** List of participants */
  participants: CallParticipant[];
  /** Whether current user's audio is enabled */
  isAudioEnabled: boolean;
  /** Whether current user's video is enabled */
  isVideoEnabled: boolean;
  /** Callback to toggle audio */
  onToggleAudio?: () => void;
  /** Callback to toggle video */
  onToggleVideo?: () => void;
  /** Callback to expand to full view */
  onExpand?: () => void;
  /** Callback to leave huddle */
  onLeave?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * HuddlePip Component
 *
 * Picture-in-picture view of active huddle.
 * Minimized floating window that can be dragged around.
 */
export function HuddlePip({
  channelName,
  participants,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onExpand,
  onLeave,
  className,
}: HuddlePipProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const activeParticipants = participants.filter(p => !p.leftAt);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for drag
  if (typeof window !== 'undefined') {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }

  return (
    <div
      className={cn(
        'fixed z-50',
        'w-80 rounded-lg shadow-2xl border bg-background',
        'transition-shadow',
        isHovered && 'shadow-3xl',
        isDragging && 'cursor-grabbing',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header - draggable */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2',
          'border-b bg-muted/50 rounded-t-lg',
          'cursor-grab active:cursor-grabbing'
        )}
        onMouseDown={handleMouseDown}
      >
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <div className='h-2 w-2 bg-green-500 rounded-full animate-pulse' />
          <span className='text-sm font-medium truncate'>
            Huddle • #{channelName}
          </span>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onExpand}
            className='h-6 w-6 p-0'
            title='Expand'
          >
            <Maximize2 className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={onLeave}
            className='h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground'
            title='Leave huddle'
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className='p-3'>
        {/* Participants grid */}
        <div className='grid grid-cols-3 gap-2 mb-3'>
          {activeParticipants.slice(0, 6).map(participant => (
            <div
              key={participant.id}
              className='relative aspect-square rounded-lg bg-muted overflow-hidden'
            >
              {participant.isVideoEnabled ? (
                <div className='flex items-center justify-center h-full bg-muted'>
                  <Video className='h-6 w-6 text-muted-foreground' />
                </div>
              ) : (
                <div className='flex items-center justify-center h-full text-2xl font-medium'>
                  {participant.user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={participant.user.avatarUrl}
                      alt={participant.displayName ?? ''}
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    getInitials(
                      participant.displayName ?? participant.user?.name ?? '?'
                    )
                  )}
                </div>
              )}
              {!participant.isAudioEnabled && (
                <div className='absolute bottom-1 right-1 rounded-full bg-background/90 p-1'>
                  <MicOff className='h-3 w-3 text-red-500' />
                </div>
              )}
              <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1'>
                <p className='text-xs text-white font-medium truncate'>
                  {participant.displayName ??
                    participant.user?.name ??
                    'Unknown'}
                </p>
              </div>
            </div>
          ))}
          {activeParticipants.length > 6 && (
            <div className='aspect-square rounded-lg bg-muted flex items-center justify-center'>
              <span className='text-sm font-medium'>
                +{activeParticipants.length - 6}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className='flex items-center justify-center gap-2'>
          <Button
            variant={isAudioEnabled ? 'outline' : 'destructive'}
            size='sm'
            onClick={onToggleAudio}
            className='flex-1'
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <Mic className='h-4 w-4' />
            ) : (
              <MicOff className='h-4 w-4' />
            )}
          </Button>
          <Button
            variant={isVideoEnabled ? 'outline' : 'destructive'}
            size='sm'
            onClick={onToggleVideo}
            className='flex-1'
            title={isVideoEnabled ? 'Stop video' : 'Start video'}
          >
            <Video className='h-4 w-4' />
          </Button>
        </div>

        {/* Participant count */}
        <div className='mt-2 text-center'>
          <p className='text-xs text-muted-foreground'>
            {activeParticipants.length}{' '}
            {activeParticipants.length === 1 ? 'person' : 'people'} in huddle
          </p>
        </div>
      </div>
    </div>
  );
}

export default HuddlePip;
