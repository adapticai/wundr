'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { clsx } from 'clsx';
import { ParticipantTile } from './participant-tile';
import { CallControls } from './call-controls';
import { CallHeader } from './call-header';
import { useLocalMedia, useCallDuration } from '@/hooks/use-call';

export type LayoutMode = 'grid' | 'spotlight' | 'sidebar';

export interface VideoRoomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  channelName?: string;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  initialLayout?: LayoutMode;
}

/**
 * Inner component that uses LiveKit room context
 */
function VideoRoomInner({
  roomName,
  channelName,
  onDisconnect,
  layout,
  setLayout,
}: {
  roomName: string;
  channelName?: string;
  onDisconnect?: () => void;
  layout: LayoutMode;
  setLayout: (layout: LayoutMode) => void;
}) {
  const room = useRoomContext();
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const { formattedDuration } = useCallDuration(startTime);

  const {
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    shareScreen,
    stopScreenShare,
    devices,
    selectedVideoDevice,
    selectedAudioDevice,
    setVideoDevice,
    setAudioDevice,
  } = useLocalMedia();

  // Get all tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Separate camera and screen share tracks
  const cameraTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.Camera),
    [tracks]
  );

  const screenShareTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.ScreenShare),
    [tracks]
  );

  // Get participants
  const participants = useMemo(() => {
    const participantMap = new Map<string, (typeof cameraTracks)[0]>();
    cameraTracks.forEach((track) => {
      if (track.participant) {
        participantMap.set(track.participant.sid, track);
      }
    });
    return Array.from(participantMap.values());
  }, [cameraTracks]);

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

  // Auto-switch to spotlight when screen sharing
  useEffect(() => {
    if (screenShareTracks.length > 0 && layout === 'grid') {
      setLayout('spotlight');
    } else if (screenShareTracks.length === 0 && layout === 'spotlight') {
      setLayout('grid');
    }
  }, [screenShareTracks.length, layout, setLayout]);

  // Handle pin
  const handlePin = useCallback((participantId: string) => {
    setPinnedParticipantId((prev) => (prev === participantId ? null : participantId));
  }, []);

  // Handle screen share toggle
  const handleToggleScreenShare = useCallback(async () => {
    if (room?.localParticipant) {
      if (isScreenSharing) {
        await room.localParticipant.setScreenShareEnabled(false);
        stopScreenShare();
      } else {
        await room.localParticipant.setScreenShareEnabled(true);
        shareScreen();
      }
    }
  }, [room, isScreenSharing, shareScreen, stopScreenShare]);

  // Handle media toggles with room
  const handleToggleAudio = useCallback(async () => {
    if (room?.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
      toggleAudio();
    }
  }, [room, isAudioEnabled, toggleAudio]);

  const handleToggleVideo = useCallback(async () => {
    if (room?.localParticipant) {
      await room.localParticipant.setCameraEnabled(!isVideoEnabled);
      toggleVideo();
    }
  }, [room, isVideoEnabled, toggleVideo]);

  // Handle disconnect
  const handleEndCall = useCallback(async () => {
    if (room) {
      await room.disconnect();
    }
    onDisconnect?.();
  }, [room, onDisconnect]);

  // Get pinned participant
  const pinnedParticipant = useMemo(
    () => participants.find((p) => p.participant?.sid === pinnedParticipantId),
    [participants, pinnedParticipantId]
  );

  // Get featured participant (pinned, screen sharer, or active speaker)
  const featuredParticipant = useMemo(() => {
    if (screenShareTracks.length > 0) {
      return screenShareTracks[0];
    }
    if (pinnedParticipant) {
      return pinnedParticipant;
    }
    // Find active speaker
    const speaker = participants.find((p) => p.participant?.isSpeaking);
    return speaker || participants[0];
  }, [screenShareTracks, pinnedParticipant, participants]);

  // Get other participants (excluding featured)
  const otherParticipants = useMemo(() => {
    if (!featuredParticipant?.participant) return participants;
    return participants.filter(
      (p) => p.participant?.sid !== featuredParticipant.participant?.sid
    );
  }, [participants, featuredParticipant]);

  // Render grid layout
  const renderGridLayout = () => {
    const count = participants.length;
    const gridCols =
      count <= 1
        ? 'grid-cols-1'
        : count <= 4
          ? 'grid-cols-2'
          : count <= 9
            ? 'grid-cols-3'
            : 'grid-cols-4';

    return (
      <div className={clsx('grid gap-2 p-4 h-full auto-rows-fr', gridCols)}>
        {participants.map((trackRef) => (
          <ParticipantTile
            key={trackRef.participant?.sid || 'unknown'}
            participant={trackRef.participant!}
            isLocal={trackRef.participant?.isLocal}
            isPinned={trackRef.participant?.sid === pinnedParticipantId}
            onPin={handlePin}
            size="large"
            className="group"
          />
        ))}
      </div>
    );
  };

  // Render spotlight layout
  const renderSpotlightLayout = () => {
    return (
      <div className="flex flex-col lg:flex-row h-full gap-2 p-4">
        {/* Main featured view */}
        <div className="flex-1 min-h-0">
          {featuredParticipant?.participant && (
            <ParticipantTile
              participant={featuredParticipant.participant}
              isLocal={featuredParticipant.participant.isLocal}
              isPinned={featuredParticipant.participant.sid === pinnedParticipantId}
              onPin={handlePin}
              size="large"
              className="w-full h-full group"
            />
          )}
        </div>

        {/* Sidebar with other participants */}
        {otherParticipants.length > 0 && (
          <div className="lg:w-64 flex lg:flex-col gap-2 overflow-auto">
            {otherParticipants.map((trackRef) => (
              <ParticipantTile
                key={trackRef.participant?.sid || 'unknown'}
                participant={trackRef.participant!}
                isLocal={trackRef.participant?.isLocal}
                isPinned={trackRef.participant?.sid === pinnedParticipantId}
                onPin={handlePin}
                size="small"
                className="flex-shrink-0 group"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render sidebar layout (video grid on left, chat/participants on right)
  const renderSidebarLayout = () => {
    return (
      <div className="flex h-full gap-2 p-4">
        {/* Video area */}
        <div className="flex-1 min-w-0">
          {renderGridLayout()}
        </div>

        {/* Sidebar */}
        {showParticipantList && (
          <div className="w-80 bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Participants ({participants.length})</h2>
            </div>
            <div className="p-2 space-y-1 overflow-auto max-h-[calc(100%-60px)]">
              {participants.map((trackRef) => (
                <div
                  key={trackRef.participant?.sid || 'unknown'}
                  className={clsx(
                    'flex items-center gap-3 p-2 rounded-lg',
                    'hover:bg-muted transition-colors'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {(trackRef.participant?.name || trackRef.participant?.identity || '?')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {trackRef.participant?.name || trackRef.participant?.identity}
                      {trackRef.participant?.isLocal && ' (You)'}
                    </p>
                  </div>
                  {trackRef.participant?.isSpeaking && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Audio renderer for all participants */}
      <RoomAudioRenderer />

      {/* Header */}
      <CallHeader
        roomName={roomName}
        channelName={channelName}
        participantCount={participants.length}
        duration={formattedDuration}
        isRecording={false}
        onToggleParticipantList={() => setShowParticipantList(!showParticipantList)}
      />

      {/* Main video area */}
      <div className="flex-1 min-h-0 relative">
        {layout === 'grid' && renderGridLayout()}
        {layout === 'spotlight' && renderSpotlightLayout()}
        {layout === 'sidebar' && renderSidebarLayout()}

        {/* Layout toggle */}
        <div className="absolute top-4 right-4 flex gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1">
          <button
            onClick={() => setLayout('grid')}
            className={clsx(
              'p-2 rounded transition-colors',
              layout === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
            aria-label="Grid layout"
            aria-pressed={layout === 'grid'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setLayout('spotlight')}
            className={clsx(
              'p-2 rounded transition-colors',
              layout === 'spotlight' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
            aria-label="Spotlight layout"
            aria-pressed={layout === 'spotlight'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </button>
        </div>

        {/* Self-view (picture-in-picture) */}
        {layout === 'spotlight' && room?.localParticipant && (
          <div className="absolute bottom-20 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-background">
            <ParticipantTile
              participant={room.localParticipant}
              isLocal
              size="small"
              showControls={false}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 flex justify-center">
        <CallControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onEndCall={handleEndCall}
          audioDevices={devices.audio}
          videoDevices={devices.video}
          selectedAudioDevice={selectedAudioDevice}
          selectedVideoDevice={selectedVideoDevice}
          onSelectAudioDevice={setVideoDevice}
          onSelectVideoDevice={setAudioDevice}
        />
      </div>
    </div>
  );
}

/**
 * Main video room component that wraps LiveKitRoom
 */
export function VideoRoom({
  token,
  serverUrl,
  roomName,
  channelName,
  onDisconnect,
  onError,
  className,
  initialLayout = 'grid',
}: VideoRoomProps) {
  const [layout, setLayout] = useState<LayoutMode>(initialLayout);

  return (
    <div className={clsx('h-full w-full', className)}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={onDisconnect}
        onError={onError}
        data-lk-theme="default"
      >
        <VideoRoomInner
          roomName={roomName}
          channelName={channelName}
          onDisconnect={onDisconnect}
          layout={layout}
          setLayout={setLayout}
        />
      </LiveKitRoom>
    </div>
  );
}

export default VideoRoom;
