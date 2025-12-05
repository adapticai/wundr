'use client';

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { Mic, MicOff } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { useLocalMedia, useCallDuration } from '@/hooks/use-call';
import { cn } from '@/lib/utils';

import { CallControls } from './call-controls';
import { CallHeader } from './call-header';

/**
 * Props for the AudioRoom component.
 */
export interface AudioRoomProps {
  /** LiveKit room token for authentication */
  token: string;
  /** LiveKit server URL */
  serverUrl: string;
  /** Name of the room to join */
  roomName: string;
  /** Optional channel name associated with this call */
  channelName?: string;
  /** Callback when disconnected from the room */
  onDisconnect?: () => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Participant info for audio-only calls
 */
interface AudioParticipant {
  sid: string;
  identity: string;
  name?: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
}

/**
 * Inner component that uses LiveKit room context
 */
function AudioRoomInner({
  roomName,
  channelName,
  onDisconnect,
}: {
  roomName: string;
  channelName?: string;
  onDisconnect?: () => void;
}) {
  const room = useRoomContext();
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showParticipantList, setShowParticipantList] = useState(true);
  const { formattedDuration } = useCallDuration(startTime);

  const {
    isAudioEnabled,
    toggleAudio,
    devices,
    selectedAudioDevice,
    setAudioDevice,
  } = useLocalMedia();

  // Get audio tracks
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  // Get participants from tracks
  const participants = useMemo<AudioParticipant[]>(() => {
    const participantMap = new Map<string, AudioParticipant>();

    tracks.forEach(trackRef => {
      if (trackRef.participant) {
        const p = trackRef.participant;
        participantMap.set(p.sid, {
          sid: p.sid,
          identity: p.identity,
          name: p.name || p.identity,
          isLocal: p.isLocal,
          isSpeaking: p.isSpeaking,
          isMuted: trackRef.publication?.isMuted ?? true,
        });
      }
    });

    return Array.from(participantMap.values()).sort((a, b) => {
      // Local participant first
      if (a.isLocal) {
        return -1;
      }
      if (b.isLocal) {
        return 1;
      }
      // Then by name
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [tracks]);

  // Set start time when room connects
  useEffect(() => {
    if (room) {
      const handleConnected = () => {
        setStartTime(new Date());
      };

      room.on(RoomEvent.Connected, handleConnected);

      // If already connected
      if (room.state === 'connected') {
        setStartTime(new Date());
      }

      return () => {
        room.off(RoomEvent.Connected, handleConnected);
      };
    }
  }, [room]);

  // Handle audio toggle with room
  const handleToggleAudio = useCallback(async () => {
    if (room?.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
      toggleAudio();
    }
  }, [room, isAudioEnabled, toggleAudio]);

  // Handle disconnect
  const handleEndCall = useCallback(async () => {
    if (room) {
      await room.disconnect();
    }
    onDisconnect?.();
  }, [room, onDisconnect]);

  return (
    <div className='flex flex-col h-full bg-background'>
      {/* Audio renderer for all participants */}
      <RoomAudioRenderer />

      {/* Header */}
      <CallHeader
        roomName={roomName}
        channelName={channelName}
        participantCount={participants.length}
        duration={formattedDuration}
        isRecording={false}
        onToggleParticipantList={() =>
          setShowParticipantList(!showParticipantList)
        }
      />

      {/* Main content area */}
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='max-w-2xl w-full'>
          {/* Audio wave visualization placeholder */}
          <div className='flex items-center justify-center mb-8'>
            <div className='flex gap-1 h-32 items-end'>
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 bg-gradient-to-t from-stone-700 to-stone-500 dark:from-stone-400 dark:to-stone-200 rounded-full transition-all duration-200',
                    participants.some(p => p.isSpeaking)
                      ? 'animate-pulse'
                      : 'opacity-30'
                  )}
                  style={{
                    height: `${20 + Math.random() * 80}%`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Participant list */}
          {showParticipantList && (
            <div className='bg-card border border-border rounded-lg overflow-hidden'>
              <div className='p-4 border-b border-border'>
                <h2 className='font-semibold text-lg'>
                  Participants ({participants.length})
                </h2>
              </div>
              <div className='divide-y divide-border max-h-96 overflow-y-auto'>
                {participants.map(participant => (
                  <div
                    key={participant.sid}
                    className='flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors'
                  >
                    {/* Avatar */}
                    <div className='relative'>
                      <div className='w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 to-stone-500 dark:from-stone-400 dark:to-stone-200 flex items-center justify-center text-white dark:text-stone-900 font-semibold text-lg'>
                        {(participant.name || '?').charAt(0).toUpperCase()}
                      </div>
                      {participant.isSpeaking && !participant.isMuted && (
                        <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse' />
                      )}
                    </div>

                    {/* Name and status */}
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium truncate'>
                        {participant.name}
                        {participant.isLocal && (
                          <span className='text-muted-foreground ml-2'>
                            (You)
                          </span>
                        )}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {participant.isMuted ? 'Muted' : 'Speaking'}
                      </p>
                    </div>

                    {/* Microphone status */}
                    <div className='flex items-center gap-2'>
                      {participant.isMuted ? (
                        <MicOff className='w-5 h-5 text-muted-foreground' />
                      ) : (
                        <Mic
                          className={cn(
                            'w-5 h-5',
                            participant.isSpeaking
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          )}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className='p-4 flex justify-center'>
        <CallControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={false}
          isScreenSharing={false}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={() => {}}
          onToggleScreenShare={() => {}}
          onEndCall={handleEndCall}
          audioDevices={devices.audio}
          videoDevices={[]}
          selectedAudioDevice={selectedAudioDevice}
          selectedVideoDevice={selectedAudioDevice}
          onSelectAudioDevice={setAudioDevice}
          onSelectVideoDevice={setAudioDevice}
        />
      </div>
    </div>
  );
}

/**
 * Main audio room component that wraps LiveKitRoom
 *
 * Provides an audio-only interface for voice calls without video.
 * Displays participant list with speaking indicators and audio controls.
 */
export function AudioRoom({
  token,
  serverUrl,
  roomName,
  channelName,
  onDisconnect,
  onError,
  className,
}: AudioRoomProps) {
  return (
    <div className={cn('h-full w-full', className)}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={false}
        audio={true}
        onDisconnected={onDisconnect}
        onError={onError}
        data-lk-theme='default'
      >
        <AudioRoomInner
          roomName={roomName}
          channelName={channelName}
          onDisconnect={onDisconnect}
        />
      </LiveKitRoom>
    </div>
  );
}

export default AudioRoom;
