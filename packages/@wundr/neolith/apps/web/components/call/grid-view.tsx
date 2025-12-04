'use client';

import { clsx } from 'clsx';
import { useMemo } from 'react';

import { ParticipantTile } from './participant-tile';

import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

/**
 * Props for the GridView component
 */
export interface GridViewProps {
  /** Array of track references for all participants */
  tracks: TrackReferenceOrPlaceholder[];
  /** ID of pinned participant (if any) */
  pinnedParticipantId: string | null;
  /** Callback when participant is pinned/unpinned */
  onPin: (participantId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculate optimal grid layout based on participant count
 */
function getGridLayout(count: number): {
  cols: string;
  rows: string;
  maxParticipants: number;
} {
  if (count <= 1) {
    return { cols: 'grid-cols-1', rows: 'grid-rows-1', maxParticipants: 1 };
  }
  if (count <= 2) {
    return { cols: 'grid-cols-2', rows: 'grid-rows-1', maxParticipants: 2 };
  }
  if (count <= 4) {
    return { cols: 'grid-cols-2', rows: 'grid-rows-2', maxParticipants: 4 };
  }
  if (count <= 6) {
    return { cols: 'grid-cols-3', rows: 'grid-rows-2', maxParticipants: 6 };
  }
  if (count <= 9) {
    return { cols: 'grid-cols-3', rows: 'grid-rows-3', maxParticipants: 9 };
  }
  if (count <= 12) {
    return { cols: 'grid-cols-4', rows: 'grid-rows-3', maxParticipants: 12 };
  }
  if (count <= 16) {
    return { cols: 'grid-cols-4', rows: 'grid-rows-4', maxParticipants: 16 };
  }
  // For very large calls, use 5x5 grid
  return { cols: 'grid-cols-5', rows: 'grid-rows-5', maxParticipants: 25 };
}

/**
 * GridView component - displays participants in a responsive grid layout
 *
 * Supports dynamic layouts from 1x1 to 5x5 based on participant count.
 * Optimizes tile size and spacing for the best viewing experience.
 */
export function GridView({
  tracks,
  pinnedParticipantId,
  onPin,
  className,
}: GridViewProps) {
  // Get unique participants (filter duplicates by sid)
  const participants = useMemo(() => {
    const participantMap = new Map<string, TrackReferenceOrPlaceholder>();
    tracks.forEach(track => {
      if (track.participant) {
        participantMap.set(track.participant.sid, track);
      }
    });
    return Array.from(participantMap.values());
  }, [tracks]);

  const layout = useMemo(
    () => getGridLayout(participants.length),
    [participants.length]
  );

  // Determine tile size based on grid
  const tileSize = useMemo(() => {
    const count = participants.length;
    if (count <= 1) {
      return 'large';
    }
    if (count <= 4) {
      return 'medium';
    }
    return 'small';
  }, [participants.length]);

  if (participants.length === 0) {
    return (
      <div
        className={clsx('flex items-center justify-center h-full', className)}
      >
        <div className='text-center text-muted-foreground'>
          <p className='text-lg font-medium'>No participants yet</p>
          <p className='text-sm mt-1'>Waiting for others to join...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'grid gap-2 p-4 h-full w-full',
        layout.cols,
        layout.rows,
        'auto-rows-fr',
        className
      )}
      role='region'
      aria-label='Video grid'
    >
      {participants.map(trackRef => (
        <ParticipantTile
          key={trackRef.participant?.sid || 'unknown'}
          participant={trackRef.participant!}
          isLocal={trackRef.participant?.isLocal}
          isPinned={trackRef.participant?.sid === pinnedParticipantId}
          onPin={onPin}
          size={tileSize}
          className='group min-h-0 min-w-0'
        />
      ))}
    </div>
  );
}

export default GridView;
