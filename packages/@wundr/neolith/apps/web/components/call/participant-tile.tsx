'use client';

import {
  VideoTrack,
  AudioTrack,
  useConnectionQualityIndicator,
  useIsSpeaking,
  useTracks,
} from '@livekit/components-react';
import { clsx } from 'clsx';
import { Track } from 'livekit-client';
import { getInitials } from '@/lib/utils';
import { useRef, useCallback, useMemo } from 'react';

import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import type { Participant } from 'livekit-client';

/**
 * Props for the ParticipantTile component.
 */
export interface ParticipantTileProps {
  /** The LiveKit participant object */
  participant: Participant;
  /** Whether this is the local user's tile */
  isLocal?: boolean;
  /** Whether this participant is pinned/featured */
  isPinned?: boolean;
  /** Callback when pin button is clicked */
  onPin?: (participantId: string) => void;
  /** Additional CSS classes to apply */
  className?: string;
  /** Whether to show control buttons (pin, etc.) */
  showControls?: boolean;
  /** Size variant of the tile */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Connection quality indicator component
 */
function ConnectionQualityBadge({ participant }: { participant: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });

  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-orange-500';
      default:
        return 'bg-red-500';
    }
  };

  const getQualityBars = () => {
    switch (quality) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      case 'poor':
        return 2;
      default:
        return 1;
    }
  };

  return (
    <div
      className='flex items-end gap-0.5 h-3'
      title={`Connection: ${quality}`}
      role='img'
      aria-label={`Connection quality: ${quality}`}
    >
      {[1, 2, 3, 4].map(bar => (
        <div
          key={bar}
          className={clsx(
            'w-0.5 rounded-full transition-colors',
            bar <= getQualityBars() ? getQualityColor() : 'bg-muted'
          )}
          style={{ height: `${bar * 3}px` }}
        />
      ))}
    </div>
  );
}

/**
 * Speaking indicator with animated bars
 */
function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
  if (!isSpeaking) {
    return null;
  }

  return (
    <div className='flex items-center gap-0.5 h-3' aria-label='Speaking'>
      {[1, 2, 3].map(bar => (
        <div
          key={bar}
          className='w-0.5 bg-green-500 rounded-full animate-pulse'
          style={{
            height: `${Math.random() * 8 + 4}px`,
            animationDelay: `${bar * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Participant tile component for video calls
 * Displays video/audio tracks, name, mute status, and connection quality
 */
export function ParticipantTile({
  participant,
  isLocal = false,
  isPinned = false,
  onPin,
  className,
  showControls = true,
  size = 'medium',
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useIsSpeaking(participant);

  // Get tracks for this participant
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Filter tracks for this participant
  const participantTracks = useMemo(() => {
    return tracks.filter(
      (track): track is TrackReferenceOrPlaceholder =>
        track.participant?.sid === participant.sid
    );
  }, [tracks, participant.sid]);

  const cameraTrack = participantTracks.find(
    t => t.source === Track.Source.Camera
  );
  const microphoneTrack = participantTracks.find(
    t => t.source === Track.Source.Microphone
  );

  const hasVideo =
    cameraTrack?.publication?.isSubscribed && !cameraTrack.publication?.isMuted;
  const isMuted =
    !microphoneTrack?.publication || microphoneTrack.publication?.isMuted;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'p' && onPin) {
        onPin(participant.sid);
      }
    },
    [onPin, participant.sid]
  );

  // Size classes
  const sizeClasses = {
    small: 'w-32 h-24',
    medium: 'w-64 h-48',
    large: 'w-full h-full min-h-[300px]',
  };

  return (
    <div
      className={clsx(
        'relative rounded-lg overflow-hidden bg-muted',
        'border-2 transition-all duration-200',
        isPinned
          ? 'border-stone-600 dark:border-stone-400 ring-2 ring-stone-500/20'
          : 'border-transparent',
        isSpeaking && !isMuted && 'ring-2 ring-green-500/50',
        sizeClasses[size],
        className
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role='article'
      aria-label={`${participant.name || participant.identity}${isLocal ? ' (You)' : ''}`}
    >
      {/* Video Track */}
      {hasVideo && cameraTrack && cameraTrack.publication ? (
        <VideoTrack
          trackRef={
            cameraTrack as TrackReferenceOrPlaceholder & {
              publication: NonNullable<
                TrackReferenceOrPlaceholder['publication']
              >;
            }
          }
          className={clsx(
            'w-full h-full object-cover',
            isLocal && 'transform scale-x-[-1]' // Mirror local video
          )}
          ref={videoRef}
        />
      ) : (
        /* Avatar placeholder when no video */
        <div className='w-full h-full flex items-center justify-center bg-muted'>
          <div
            className={clsx(
              'rounded-full bg-stone-500/10 flex items-center justify-center text-stone-700 dark:text-stone-300 font-semibold',
              size === 'small' ? 'w-12 h-12 text-lg' : 'w-20 h-20 text-2xl'
            )}
          >
            {getInitials(participant.name || participant.identity)}
          </div>
        </div>
      )}

      {/* Audio Track (hidden, just for playback) */}
      {microphoneTrack && microphoneTrack.publication && !isLocal && (
        <AudioTrack
          trackRef={
            microphoneTrack as TrackReferenceOrPlaceholder & {
              publication: NonNullable<
                TrackReferenceOrPlaceholder['publication']
              >;
            }
          }
        />
      )}

      {/* Bottom overlay with name and indicators */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0',
          'bg-gradient-to-t from-black/70 to-transparent',
          'p-2 flex items-end justify-between'
        )}
      >
        <div className='flex items-center gap-2 min-w-0'>
          {/* Mute indicator */}
          {isMuted && (
            <div
              className='flex-shrink-0 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center'
              title='Muted'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3 h-3 text-white'
              >
                <line x1='1' y1='1' x2='23' y2='23' />
                <path d='M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6' />
                <path d='M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23' />
                <line x1='12' y1='19' x2='12' y2='23' />
                <line x1='8' y1='23' x2='16' y2='23' />
              </svg>
            </div>
          )}

          {/* Speaking indicator */}
          <SpeakingIndicator isSpeaking={isSpeaking && !isMuted} />

          {/* Name */}
          <span className='text-white text-sm font-medium truncate'>
            {participant.name || participant.identity}
            {isLocal && ' (You)'}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {/* Connection quality */}
          <ConnectionQualityBadge participant={participant} />
        </div>
      </div>

      {/* Pin button */}
      {showControls && onPin && (
        <button
          onClick={() => onPin(participant.sid)}
          className={clsx(
            'absolute top-2 right-2',
            'w-8 h-8 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-200',
            isPinned
              ? 'bg-stone-700 dark:bg-stone-600 text-white'
              : 'bg-black/50 text-white hover:bg-black/70',
            'opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
          title={isPinned ? 'Unpin' : 'Pin'}
          aria-label={isPinned ? 'Unpin participant' : 'Pin participant'}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill={isPinned ? 'currentColor' : 'none'}
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-4 h-4'
          >
            <line x1='12' y1='17' x2='12' y2='22' />
            <path d='M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z' />
          </svg>
        </button>
      )}

      {/* Local indicator badge */}
      {isLocal && (
        <div className='absolute top-2 left-2 px-2 py-0.5 bg-stone-700 dark:bg-stone-600 text-white text-xs font-medium rounded'>
          You
        </div>
      )}
    </div>
  );
}

export default ParticipantTile;
