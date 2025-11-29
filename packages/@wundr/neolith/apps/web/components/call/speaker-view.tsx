'use client';

import { clsx } from 'clsx';
import { useMemo } from 'react';

import { ParticipantTile } from './participant-tile';

import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

/**
 * Props for the SpeakerView component
 */
export interface SpeakerViewProps {
  /** Array of track references for all participants */
  tracks: TrackReferenceOrPlaceholder[];
  /** Featured track (pinned, screen share, or active speaker) */
  featuredTrack: TrackReferenceOrPlaceholder | null;
  /** ID of pinned participant (if any) */
  pinnedParticipantId: string | null;
  /** Callback when participant is pinned/unpinned */
  onPin: (participantId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SpeakerView component - displays one large featured video with other participants in a sidebar
 *
 * Features:
 * - Large featured video (pinned participant, screen share, or active speaker)
 * - Scrollable sidebar with other participants
 * - Responsive layout (sidebar on right for desktop, bottom for mobile)
 */
export function SpeakerView({
  tracks,
  featuredTrack,
  pinnedParticipantId,
  onPin,
  className,
}: SpeakerViewProps) {
  // Get unique participants (filter duplicates by sid)
  const participants = useMemo(() => {
    const participantMap = new Map<string, TrackReferenceOrPlaceholder>();
    tracks.forEach((track) => {
      if (track.participant) {
        participantMap.set(track.participant.sid, track);
      }
    });
    return Array.from(participantMap.values());
  }, [tracks]);

  // Get other participants (excluding featured)
  const otherParticipants = useMemo(() => {
    if (!featuredTrack?.participant) {
      return participants;
    }
    return participants.filter(
      (p) => p.participant?.sid !== featuredTrack.participant?.sid,
    );
  }, [participants, featuredTrack]);

  // Use first participant as fallback if no featured track
  const displayedFeatured = featuredTrack || participants[0];

  if (participants.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-full', className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No participants yet</p>
          <p className="text-sm mt-1">Waiting for others to join...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex flex-col lg:flex-row h-full gap-2 p-4',
        className,
      )}
      role="region"
      aria-label="Speaker view"
    >
      {/* Main featured view */}
      <div className="flex-1 min-h-0 min-w-0">
        {displayedFeatured?.participant && (
          <ParticipantTile
            participant={displayedFeatured.participant}
            isLocal={displayedFeatured.participant.isLocal}
            isPinned={displayedFeatured.participant.sid === pinnedParticipantId}
            onPin={onPin}
            size="large"
            className="w-full h-full group"
          />
        )}
      </div>

      {/* Sidebar with other participants */}
      {otherParticipants.length > 0 && (
        <div
          className={clsx(
            'flex lg:flex-col gap-2',
            'lg:w-64 lg:h-full',
            'w-full h-32',
            'overflow-x-auto lg:overflow-x-visible',
            'overflow-y-visible lg:overflow-y-auto',
            'flex-shrink-0',
          )}
          role="list"
          aria-label="Other participants"
        >
          {otherParticipants.map((trackRef) => (
            <div
              key={trackRef.participant?.sid || 'unknown'}
              className="flex-shrink-0 lg:flex-shrink"
              role="listitem"
            >
              <ParticipantTile
                participant={trackRef.participant!}
                isLocal={trackRef.participant?.isLocal}
                isPinned={trackRef.participant?.sid === pinnedParticipantId}
                onPin={onPin}
                size="small"
                className="group w-48 lg:w-full h-full lg:h-36"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SpeakerView;
