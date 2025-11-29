'use client';

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { clsx } from 'clsx';
import { Track, RoomEvent } from 'livekit-client';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { useLocalMedia, useCallDuration } from '@/hooks/use-call';

import { CallControls } from './call-controls';
import { CallHeader } from './call-header';
import { ParticipantTile } from './participant-tile';
import { GridView } from './grid-view';
import { SpeakerView } from './speaker-view';
import { ParticipantList } from './participant-list';
import { AddParticipantModal } from './add-participant-modal';

export type LayoutMode = 'grid' | 'spotlight' | 'sidebar';

/**
 * Props for the VideoRoom component.
 */
export interface VideoRoomProps {
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
  /** Initial layout mode for the video grid */
  initialLayout?: LayoutMode;
  /** Call ID for inviting participants */
  callId?: string;
  /** Workspace ID for searching users */
  workspaceId?: string;
  /** Whether the current user is the host */
  isHost?: boolean;
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
  callId,
  workspaceId,
  isHost = false,
}: {
  roomName: string;
  channelName?: string;
  onDisconnect?: () => void;
  layout: LayoutMode;
  setLayout: (layout: LayoutMode) => void;
  callId?: string;
  workspaceId?: string;
  isHost?: boolean;
}) {
  const room = useRoomContext();
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
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
    { onlySubscribed: false },
  );

  // Separate camera and screen share tracks
  const cameraTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.Camera),
    [tracks],
  );

  const screenShareTracks = useMemo(
    () => tracks.filter((t) => t.source === Track.Source.ScreenShare),
    [tracks],
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
    [participants, pinnedParticipantId],
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

  // Get other participants (excluding featured) - not currently used in new layout
  // const otherParticipants = useMemo(() => {
  //   if (!featuredParticipant?.participant) {
  // return participants;
  // }
  //   return participants.filter(
  //     (p) => p.participant?.sid !== featuredParticipant.participant?.sid,
  //   );
  // }, [participants, featuredParticipant]);

  // Handle invite participants
  const handleInviteParticipants = useCallback(
    async (userIds: string[], message?: string) => {
      if (!callId) return;

      try {
        const response = await fetch(`/api/calls/${callId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, message }),
        });

        if (!response.ok) {
          throw new Error('Failed to invite participants');
        }
      } catch (error) {
        console.error('Error inviting participants:', error);
        throw error;
      }
    },
    [callId],
  );

  // Handle mute participant (host only)
  const handleMuteParticipant = useCallback(
    async (participantId: string) => {
      if (!isHost || !room) return;

      // Use LiveKit's API to mute remote participant
      // This requires server-side implementation
      console.log('Muting participant:', participantId);
    },
    [isHost, room],
  );

  // Handle kick participant (host only)
  const handleKickParticipant = useCallback(
    async (participantId: string) => {
      if (!isHost || !callId) return;

      try {
        const response = await fetch(`/api/calls/${callId}/kick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId }),
        });

        if (!response.ok) {
          throw new Error('Failed to kick participant');
        }
      } catch (error) {
        console.error('Error kicking participant:', error);
      }
    },
    [isHost, callId],
  );

  // Render grid layout
  const renderGridLayout = () => {
    return (
      <GridView
        tracks={cameraTracks}
        pinnedParticipantId={pinnedParticipantId}
        onPin={handlePin}
      />
    );
  };

  // Render spotlight layout
  const renderSpotlightLayout = () => {
    return (
      <SpeakerView
        tracks={cameraTracks}
        featuredTrack={featuredParticipant}
        pinnedParticipantId={pinnedParticipantId}
        onPin={handlePin}
      />
    );
  };

  // Render sidebar layout (video grid on left, participants list on right)
  const renderSidebarLayout = () => {
    return (
      <div className="flex h-full gap-2 p-4">
        {/* Video area */}
        <div className="flex-1 min-w-0">
          <GridView
            tracks={cameraTracks}
            pinnedParticipantId={pinnedParticipantId}
            onPin={handlePin}
          />
        </div>

        {/* Participant List Sidebar */}
        <div className="w-80">
          <ParticipantList
            tracks={cameraTracks}
            isHost={isHost}
            currentUserId={room?.localParticipant?.identity}
            onMuteParticipant={handleMuteParticipant}
            onKickParticipant={handleKickParticipant}
          />
        </div>
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
              layout === 'grid' ? 'bg-stone-700 dark:bg-stone-600 text-white' : 'hover:bg-muted',
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
              layout === 'spotlight' ? 'bg-stone-700 dark:bg-stone-600 text-white' : 'hover:bg-muted',
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

      {/* Invite Modal */}
      {callId && workspaceId && (
        <AddParticipantModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteParticipants}
          callId={callId}
          workspaceId={workspaceId}
        />
      )}

      {/* Participant List Toggle Button (for mobile) */}
      {layout !== 'sidebar' && (
        <button
          onClick={() => setShowParticipantList(!showParticipantList)}
          className={clsx(
            'fixed right-4 top-24 z-10',
            'w-12 h-12 rounded-full',
            'bg-background/80 backdrop-blur-sm border border-border',
            'flex items-center justify-center',
            'hover:bg-muted transition-colors',
            'shadow-lg',
          )}
          aria-label={showParticipantList ? 'Hide participants' : 'Show participants'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      )}

      {/* Participant List Overlay (mobile/tablet) */}
      {showParticipantList && layout !== 'sidebar' && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setShowParticipantList(false)}
          />

          {/* Participant List */}
          <div className="fixed right-0 top-0 bottom-0 w-80 z-30">
            <ParticipantList
              tracks={cameraTracks}
              isHost={isHost}
              currentUserId={room?.localParticipant?.identity}
              onMuteParticipant={handleMuteParticipant}
              onKickParticipant={handleKickParticipant}
            />
          </div>
        </>
      )}
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
  callId,
  workspaceId,
  isHost = false,
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
          callId={callId}
          workspaceId={workspaceId}
          isHost={isHost}
        />
      </LiveKitRoom>
    </div>
  );
}

export default VideoRoom;
