'use client';

import { clsx } from 'clsx';
import { Track } from 'livekit-client';
import { useMemo, useState } from 'react';

import { getInitials } from '@/lib/utils';

import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import type { Participant } from 'livekit-client';

/**
 * Props for the ParticipantList component
 */
export interface ParticipantListProps {
  /** Array of track references for all participants */
  tracks: TrackReferenceOrPlaceholder[];
  /** Whether the current user is the call creator/host */
  isHost?: boolean;
  /** ID of the current user */
  currentUserId?: string;
  /** Callback to mute a participant (host only) */
  onMuteParticipant?: (participantId: string) => void;
  /** Callback to kick a participant (host only) */
  onKickParticipant?: (participantId: string) => void;
  /** Callback to make someone a co-host (host only) */
  onPromoteParticipant?: (participantId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual participant item in the list
 */
function ParticipantItem({
  participant,
  isHost,
  isCurrentUser,
  onMute,
  onKick,
}: {
  participant: Participant;
  isHost?: boolean;
  isCurrentUser?: boolean;
  onMute?: (participantId: string) => void;
  onKick?: (participantId: string) => void;
  onPromote?: (participantId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  // Check if participant has raised hand (from metadata)
  const hasRaisedHand = useMemo(() => {
    try {
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        return metadata.handRaised === true;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, [participant.metadata]);

  // Get participant role from metadata
  const role = useMemo(() => {
    try {
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        return metadata.role || 'participant';
      }
    } catch {
      // Ignore parse errors
    }
    return 'participant';
  }, [participant.metadata]);

  const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrack = participant.getTrackPublication(Track.Source.Camera);

  const isMuted = audioTrack?.isMuted ?? true;
  const hasVideo = videoTrack && !videoTrack.isMuted;

  return (
    <div
      className={clsx(
        'flex items-center gap-3 p-3 rounded-lg transition-colors relative group',
        'hover:bg-muted',
        hasRaisedHand && 'bg-yellow-500/10 border border-yellow-500/20',
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm relative',
          hasVideo
            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
            : 'bg-stone-500/10 text-stone-700 dark:text-stone-300',
          participant.isSpeaking && !isMuted && 'ring-2 ring-green-500',
        )}
      >
        {getInitials(participant.name || participant.identity)}

        {/* Speaking indicator */}
        {participant.isSpeaking && !isMuted && (
          <div className='absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse' />
        )}
      </div>

      {/* Info */}
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <p className='text-sm font-medium truncate'>
            {participant.name || participant.identity}
            {isCurrentUser && ' (You)'}
          </p>

          {/* Role badge */}
          {role === 'host' && (
            <span className='px-1.5 py-0.5 text-xs font-medium bg-stone-700 dark:bg-stone-600 text-white rounded'>
              Host
            </span>
          )}

          {/* Raised hand indicator */}
          {hasRaisedHand && (
            <span
              className='text-lg animate-bounce'
              role='img'
              aria-label='Hand raised'
              title='Hand raised'
            >
              ✋
            </span>
          )}
        </div>

        <div className='flex items-center gap-2 mt-0.5'>
          {/* Connection quality */}
          <div className='flex items-center gap-0.5 h-2'>
            {[1, 2, 3].map(bar => (
              <div
                key={bar}
                className={clsx(
                  'w-0.5 rounded-full',
                  bar <= 3 ? 'bg-green-500' : 'bg-muted',
                )}
                style={{ height: `${bar * 2}px` }}
              />
            ))}
          </div>

          {/* Media status */}
          <div className='flex items-center gap-1'>
            {isMuted && (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3 h-3 text-red-500'
                aria-label='Muted'
              >
                <line x1='1' y1='1' x2='23' y2='23' />
                <path d='M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6' />
                <path d='M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23' />
                <line x1='12' y1='19' x2='12' y2='23' />
              </svg>
            )}

            {!hasVideo && (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3 h-3 text-muted-foreground'
                aria-label='Video off'
              >
                <path d='M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8' />
                <path d='M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z' />
                <line x1='2' x2='22' y1='2' y2='22' />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Host actions */}
      {isHost && !isCurrentUser && showActions && (
        <div className='flex items-center gap-1'>
          <button
            onClick={() => onMute?.(participant.sid)}
            className='p-1.5 rounded hover:bg-background transition-colors'
            title='Mute participant'
            aria-label='Mute participant'
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
              <line x1='1' y1='1' x2='23' y2='23' />
              <path d='M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6' />
              <path d='M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23' />
              <line x1='12' y1='19' x2='12' y2='23' />
            </svg>
          </button>

          <button
            onClick={() => onKick?.(participant.sid)}
            className='p-1.5 rounded hover:bg-background transition-colors text-red-500'
            title='Remove from call'
            aria-label='Remove participant from call'
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
              <path d='M3 6h18' />
              <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
              <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
              <line x1='10' x2='10' y1='11' y2='17' />
              <line x1='14' x2='14' y1='11' y2='17' />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ParticipantList component - displays a sidebar list of all call participants
 *
 * Features:
 * - Shows participant avatar, name, and status
 * - Displays mute/video status indicators
 * - Shows speaking indicator
 * - Hand raise indicator
 * - Host controls (mute, kick, promote)
 * - Connection quality indicator
 */
export function ParticipantList({
  tracks,
  isHost = false,
  currentUserId,
  onMuteParticipant,
  onKickParticipant,
  onPromoteParticipant,
  className,
}: ParticipantListProps) {
  // Get unique participants (filter duplicates by sid)
  const participants = useMemo(() => {
    const participantMap = new Map<string, Participant>();
    tracks.forEach(track => {
      if (track.participant) {
        participantMap.set(track.participant.sid, track.participant);
      }
    });
    return Array.from(participantMap.values());
  }, [tracks]);

  // Sort: local first, then by speaking, then by name
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Local participant first
      if (a.isLocal && !b.isLocal) {
        return -1;
      }
      if (!a.isLocal && b.isLocal) {
        return 1;
      }

      // Speaking participants next
      if (a.isSpeaking && !b.isSpeaking) {
        return -1;
      }
      if (!a.isSpeaking && b.isSpeaking) {
        return 1;
      }

      // Then alphabetically by name
      const nameA = a.name || a.identity;
      const nameB = b.name || b.identity;
      return nameA.localeCompare(nameB);
    });
  }, [participants]);

  return (
    <div
      className={clsx(
        'flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden',
        className,
      )}
      role='complementary'
      aria-label='Participants list'
    >
      {/* Header */}
      <div className='p-4 border-b border-border flex items-center justify-between'>
        <h2 className='font-semibold text-sm'>
          Participants ({participants.length})
        </h2>

        {isHost && (
          <button
            className='text-xs text-muted-foreground hover:text-foreground transition-colors'
            aria-label='Mute all'
          >
            Mute all
          </button>
        )}
      </div>

      {/* Participant list */}
      <div className='flex-1 overflow-y-auto p-2 space-y-1' role='list'>
        {sortedParticipants.map(participant => (
          <ParticipantItem
            key={participant.sid}
            participant={participant}
            isHost={isHost}
            isCurrentUser={participant.identity === currentUserId}
            onMute={onMuteParticipant}
            onKick={onKickParticipant}
            onPromote={onPromoteParticipant}
          />
        ))}
      </div>

      {/* Footer with actions */}
      {isHost && (
        <div className='p-3 border-t border-border'>
          <button
            className='w-full px-3 py-2 text-sm bg-stone-700 dark:bg-stone-600 hover:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-lg transition-colors'
            aria-label='Invite more people'
          >
            <span className='flex items-center justify-center gap-2'>
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
                <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
                <circle cx='9' cy='7' r='4' />
                <line x1='19' x2='19' y1='8' y2='14' />
                <line x1='22' x2='16' y1='11' y2='11' />
              </svg>
              Invite people
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ParticipantList;
