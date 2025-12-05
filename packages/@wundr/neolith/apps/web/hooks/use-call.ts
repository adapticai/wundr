'use client';

import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ConnectionQuality,
  createLocalVideoTrack,
  createLocalAudioTrack,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';

import type {
  CallParticipant,
  MediaDevice,
  Huddle,
  HuddleParticipant,
  ParticipantConnectionQuality,
} from '@/types/call';
import type {
  LocalParticipant,
  RemoteParticipant,
  LocalVideoTrack,
  LocalAudioTrack,
} from 'livekit-client';

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for the useCall hook
 */
export interface UseCallReturn {
  /** The LiveKit room instance */
  room: Room | null;
  /** List of all participants in the call */
  participants: CallParticipant[];
  /** The local participant */
  localParticipant: LocalParticipant | null;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether currently connecting */
  isConnecting: boolean;
  /** Error if connection failed */
  error: Error | null;
  /** Connect to the room */
  connect: (token: string) => Promise<void>;
  /** Disconnect from the room */
  disconnect: () => Promise<void>;
  /** Toggle pin for a participant */
  togglePin: (participantId: string) => void;
  /** Set of pinned participant IDs */
  pinnedParticipants: Set<string>;
  /** Currently active speaker */
  activeSpeaker: CallParticipant | null;
  /** List of participants sharing their screen */
  screenSharers: CallParticipant[];
}

/**
 * Return type for the useLocalMedia hook
 */
export interface UseLocalMediaReturn {
  /** Local video track */
  videoTrack: LocalVideoTrack | null;
  /** Local audio track */
  audioTrack: LocalAudioTrack | null;
  /** Whether video is enabled */
  isVideoEnabled: boolean;
  /** Whether audio is enabled */
  isAudioEnabled: boolean;
  /** Whether screen sharing is active */
  isScreenSharing: boolean;
  /** Toggle video on/off */
  toggleVideo: () => Promise<void>;
  /** Toggle audio on/off */
  toggleAudio: () => Promise<void>;
  /** Enable video */
  enableVideo: () => Promise<LocalVideoTrack | null>;
  /** Disable video */
  disableVideo: () => void;
  /** Enable audio */
  enableAudio: () => Promise<LocalAudioTrack | null>;
  /** Disable audio */
  disableAudio: () => void;
  /** Start screen sharing */
  shareScreen: () => Promise<void>;
  /** Stop screen sharing */
  stopScreenShare: () => void;
  /** Available media devices */
  devices: {
    video: MediaDevice[];
    audio: MediaDevice[];
    audioOutput: MediaDevice[];
  };
  /** Selected video device ID */
  selectedVideoDevice: string;
  /** Selected audio device ID */
  selectedAudioDevice: string;
  /** Selected audio output device ID */
  selectedAudioOutput: string;
  /** Change video device */
  setVideoDevice: (deviceId: string) => Promise<void>;
  /** Change audio device */
  setAudioDevice: (deviceId: string) => Promise<void>;
  /** Change audio output device */
  setAudioOutput: React.Dispatch<React.SetStateAction<string>>;
  /** Error if any media operation failed */
  error: Error | null;
  /** Enumerate available devices */
  enumerateDevices: () => Promise<void>;
}

/**
 * Return type for the useHuddle hook
 */
export interface UseHuddleReturn {
  /** List of available huddles */
  huddles: Huddle[];
  /** Currently active huddle */
  activeHuddle: Huddle | null;
  /** Whether loading huddles */
  isLoading: boolean;
  /** Whether joining a huddle */
  isJoining: boolean;
  /** Error if any operation failed */
  error: Error | null;
  /** Join a specific huddle */
  joinHuddle: (huddleId: string) => Promise<void>;
  /** Leave the active huddle */
  leaveHuddle: () => Promise<void>;
  /** Create a new huddle */
  createHuddle: (name: string, channelId?: string) => Promise<Huddle | null>;
  /** Refetch huddles */
  refetch: () => Promise<void>;
}

/**
 * Return type for the useCallDuration hook
 */
export interface UseCallDurationReturn {
  /** Duration in seconds */
  duration: number;
  /** Formatted duration string (e.g., "1:23" or "1:23:45") */
  formattedDuration: string;
}

/**
 * Map LiveKit connection quality to our internal type
 */
function mapConnectionQuality(
  quality: ConnectionQuality
): ParticipantConnectionQuality {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'excellent';
    case ConnectionQuality.Good:
      return 'good';
    case ConnectionQuality.Poor:
      return 'poor';
    case ConnectionQuality.Lost:
    case ConnectionQuality.Unknown:
    default:
      return 'lost';
  }
}

/**
 * Convert LiveKit participant to our CallParticipant type
 */
function toCallParticipant(
  participant: LocalParticipant | RemoteParticipant,
  isLocal: boolean,
  pinnedParticipants: Set<string>
): CallParticipant {
  const videoTrack = participant.getTrackPublication(Track.Source.Camera);
  const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
  const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare);

  let avatarUrl: string | undefined;
  try {
    if (participant.metadata) {
      avatarUrl = JSON.parse(participant.metadata).avatarUrl;
    }
  } catch {
    // Ignore metadata parse errors
  }

  return {
    id: participant.sid,
    identity: participant.identity,
    name: participant.name || participant.identity,
    avatarUrl,
    isSpeaking: participant.isSpeaking,
    isMuted: audioTrack?.isMuted ?? true,
    isVideoEnabled: (videoTrack?.isSubscribed && !videoTrack.isMuted) ?? false,
    isScreenSharing: screenTrack?.isSubscribed ?? false,
    isPinned: pinnedParticipants.has(participant.sid),
    connectionQuality: mapConnectionQuality(participant.connectionQuality),
    isLocal,
    joinedAt: participant.joinedAt?.toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Main hook for managing a video call room
 */
export function useCall(roomName: string): UseCallReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localParticipant, setLocalParticipant] =
    useState<LocalParticipant | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pinnedParticipants, setPinnedParticipants] = useState<Set<string>>(
    new Set()
  );
  const roomRef = useRef<Room | null>(null);

  // Update participants list whenever room state or pins change
  const updateParticipants = useCallback(() => {
    if (!roomRef.current) {
      return;
    }

    const allParticipants: CallParticipant[] = [];

    // Add local participant
    if (roomRef.current.localParticipant) {
      allParticipants.push(
        toCallParticipant(
          roomRef.current.localParticipant,
          true,
          pinnedParticipants
        )
      );
    }

    // Add remote participants
    roomRef.current.remoteParticipants.forEach(participant => {
      allParticipants.push(
        toCallParticipant(participant, false, pinnedParticipants)
      );
    });

    setParticipants(allParticipants);
  }, [pinnedParticipants]);

  // Connect to room
  const connect = useCallback(
    async (token: string) => {
      // Validate inputs and prevent duplicate connections
      if (!roomName || !token) {
        setError(new Error('Room name and token are required'));
        return;
      }

      if (isConnecting || connectionState === ConnectionState.Connected) {
        return;
      }

      setIsConnecting(true);
      setError(null);

      try {
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
        });

        // Set up event listeners
        newRoom.on(RoomEvent.ConnectionStateChanged, state => {
          setConnectionState(state);
        });

        newRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        newRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        newRoom.on(RoomEvent.TrackSubscribed, updateParticipants);
        newRoom.on(RoomEvent.TrackUnsubscribed, updateParticipants);
        newRoom.on(RoomEvent.TrackMuted, updateParticipants);
        newRoom.on(RoomEvent.TrackUnmuted, updateParticipants);
        newRoom.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
        newRoom.on(RoomEvent.ConnectionQualityChanged, updateParticipants);
        newRoom.on(RoomEvent.LocalTrackPublished, updateParticipants);
        newRoom.on(RoomEvent.LocalTrackUnpublished, updateParticipants);

        newRoom.on(RoomEvent.Disconnected, () => {
          setRoom(null);
          setLocalParticipant(null);
          setParticipants([]);
          roomRef.current = null;
        });

        // Get LiveKit server URL from environment
        const livekitUrl =
          process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://localhost:7880';

        await newRoom.connect(livekitUrl, token);

        roomRef.current = newRoom;
        setRoom(newRoom);
        setLocalParticipant(newRoom.localParticipant);
        updateParticipants();
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to connect to room')
        );
        // Clean up if connection failed
        roomRef.current = null;
        setRoom(null);
        setLocalParticipant(null);
        setParticipants([]);
      } finally {
        setIsConnecting(false);
      }
    },
    [roomName, isConnecting, connectionState, updateParticipants]
  );

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setLocalParticipant(null);
      setParticipants([]);
      setConnectionState(ConnectionState.Disconnected);
    }
  }, []);

  // Toggle pin for a participant
  const togglePin = useCallback((participantId: string) => {
    setPinnedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  }, []);

  // Update participants when pins change
  useEffect(() => {
    updateParticipants();
  }, [pinnedParticipants, updateParticipants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // Get active speaker
  const activeSpeaker = useMemo(
    () => participants.find(p => p.isSpeaking && !p.isLocal) || null,
    [participants]
  );

  // Get screen sharers
  const screenSharers = useMemo(
    () => participants.filter(p => p.isScreenSharing),
    [participants]
  );

  return {
    room,
    participants,
    localParticipant,
    connectionState,
    isConnecting,
    error,
    connect,
    disconnect,
    togglePin,
    pinnedParticipants,
    activeSpeaker,
    screenSharers,
  };
}

/**
 * Hook for managing local media (camera, microphone, screen share)
 */
export function useLocalMedia(): UseLocalMediaReturn {
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [devices, setDevices] = useState<{
    video: MediaDevice[];
    audio: MediaDevice[];
    audioOutput: MediaDevice[];
  }>({ video: [], audio: [], audioOutput: [] });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();

      const videoDevices: MediaDevice[] = [];
      const audioDevices: MediaDevice[] = [];
      const audioOutputDevices: MediaDevice[] = [];

      mediaDevices.forEach(device => {
        const mediaDevice: MediaDevice = {
          deviceId: device.deviceId,
          label:
            device.label || `${device.kind} ${device.deviceId.slice(0, 5)}`,
          kind: device.kind as MediaDevice['kind'],
        };

        if (device.kind === 'videoinput') {
          videoDevices.push(mediaDevice);
        } else if (device.kind === 'audioinput') {
          audioDevices.push(mediaDevice);
        } else if (device.kind === 'audiooutput') {
          audioOutputDevices.push(mediaDevice);
        }
      });

      setDevices({
        video: videoDevices,
        audio: audioDevices,
        audioOutput: audioOutputDevices,
      });

      // Set default devices if not already set
      if (!selectedVideoDevice && videoDevices.length > 0) {
        setSelectedVideoDevice(videoDevices[0].deviceId);
      }
      if (!selectedAudioDevice && audioDevices.length > 0) {
        setSelectedAudioDevice(audioDevices[0].deviceId);
      }
      if (!selectedAudioOutput && audioOutputDevices.length > 0) {
        setSelectedAudioOutput(audioOutputDevices[0].deviceId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to enumerate devices')
      );
    }
  }, [selectedVideoDevice, selectedAudioDevice, selectedAudioOutput]);

  // Initialize devices on mount
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);

    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        enumerateDevices
      );
    };
  }, [enumerateDevices]);

  // Enable video
  const enableVideo = useCallback(async () => {
    try {
      const track = await createLocalVideoTrack({
        deviceId: selectedVideoDevice || undefined,
        resolution: VideoPresets.h720.resolution,
      });
      setVideoTrack(track);
      setIsVideoEnabled(true);
      setError(null);
      return track;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to enable video')
      );
      return null;
    }
  }, [selectedVideoDevice]);

  // Disable video
  const disableVideo = useCallback(() => {
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(null);
    }
    setIsVideoEnabled(false);
  }, [videoTrack]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (isVideoEnabled) {
      disableVideo();
    } else {
      await enableVideo();
    }
  }, [isVideoEnabled, enableVideo, disableVideo]);

  // Enable audio
  const enableAudio = useCallback(async () => {
    try {
      const track = await createLocalAudioTrack({
        deviceId: selectedAudioDevice || undefined,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      });
      setAudioTrack(track);
      setIsAudioEnabled(true);
      setError(null);
      return track;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to enable audio')
      );
      return null;
    }
  }, [selectedAudioDevice]);

  // Disable audio
  const disableAudio = useCallback(() => {
    if (audioTrack) {
      audioTrack.stop();
      setAudioTrack(null);
    }
    setIsAudioEnabled(false);
  }, [audioTrack]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (isAudioEnabled) {
      disableAudio();
    } else {
      await enableAudio();
    }
  }, [isAudioEnabled, enableAudio, disableAudio]);

  // Start screen share
  const shareScreen = useCallback(async () => {
    try {
      setIsScreenSharing(true);
      // Screen share is handled by LiveKit's room.localParticipant.setScreenShareEnabled
      // This hook just tracks the state
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to share screen')
      );
      setIsScreenSharing(false);
    }
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    setIsScreenSharing(false);
  }, []);

  // Change video device
  const setVideoDevice = useCallback(
    async (deviceId: string) => {
      try {
        setSelectedVideoDevice(deviceId);
        if (isVideoEnabled && videoTrack) {
          videoTrack.stop();
          const newTrack = await createLocalVideoTrack({
            deviceId,
            resolution: VideoPresets.h720.resolution,
          });
          setVideoTrack(newTrack);
          setError(null);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to change video device')
        );
        // Restore previous state on error
        setIsVideoEnabled(false);
        setVideoTrack(null);
      }
    },
    [isVideoEnabled, videoTrack]
  );

  // Change audio device
  const setAudioDevice = useCallback(
    async (deviceId: string) => {
      try {
        setSelectedAudioDevice(deviceId);
        if (isAudioEnabled && audioTrack) {
          audioTrack.stop();
          const newTrack = await createLocalAudioTrack({
            deviceId,
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          });
          setAudioTrack(newTrack);
          setError(null);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to change audio device')
        );
        // Restore previous state on error
        setIsAudioEnabled(false);
        setAudioTrack(null);
      }
    },
    [isAudioEnabled, audioTrack]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoTrack) {
        videoTrack.stop();
      }
      if (audioTrack) {
        audioTrack.stop();
      }
    };
  }, [videoTrack, audioTrack]);

  return {
    videoTrack,
    audioTrack,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    enableVideo,
    disableVideo,
    enableAudio,
    disableAudio,
    shareScreen,
    stopScreenShare,
    devices,
    selectedVideoDevice,
    selectedAudioDevice,
    selectedAudioOutput,
    setVideoDevice,
    setAudioDevice,
    setAudioOutput: setSelectedAudioOutput,
    error,
    enumerateDevices,
  };
}

/**
 * Hook for managing huddles (quick audio-only calls in a workspace)
 */
export function useHuddle(workspaceId: string): UseHuddleReturn {
  const [huddles, setHuddles] = useState<Huddle[]>([]);
  const [activeHuddle, setActiveHuddle] = useState<Huddle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch available huddles
  const fetchHuddles = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/huddles`);
      if (!response.ok) {
        throw new Error(`Failed to fetch huddles: ${response.statusText}`);
      }

      const data = await response.json();
      setHuddles(
        data.huddles.map((h: Huddle) => ({
          ...h,
          createdAt: new Date(h.createdAt),
          participants: h.participants.map((p: HuddleParticipant) => ({
            ...p,
            joinedAt: new Date(p.joinedAt),
          })),
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch huddles')
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Subscribe to huddle updates
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    fetchHuddles();

    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const setupEventSource = () => {
      // Set up SSE for real-time huddle updates
      eventSource = new EventSource(
        `/api/workspaces/${workspaceId}/huddles/subscribe`
      );

      eventSource.onmessage = event => {
        try {
          reconnectAttempts = 0; // Reset on successful message
          const data = JSON.parse(event.data);
          if (data.type === 'huddle_created') {
            setHuddles(prev => [
              ...prev,
              {
                ...data.huddle,
                createdAt: new Date(data.huddle.createdAt),
              },
            ]);
          } else if (data.type === 'huddle_updated') {
            setHuddles(prev =>
              prev.map(h =>
                h.id === data.huddle.id
                  ? {
                      ...data.huddle,
                      createdAt: new Date(data.huddle.createdAt),
                    }
                  : h
              )
            );
            // Update active huddle if it's the one being updated
            if (activeHuddle?.id === data.huddle.id) {
              setActiveHuddle({
                ...data.huddle,
                createdAt: new Date(data.huddle.createdAt),
              });
            }
          } else if (data.type === 'huddle_ended') {
            setHuddles(prev => prev.filter(h => h.id !== data.huddleId));
            if (activeHuddle?.id === data.huddleId) {
              setActiveHuddle(null);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();

        // Exponential backoff with max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts - 1),
            30000
          );
          reconnectTimeout = setTimeout(() => {
            fetchHuddles();
            setupEventSource();
          }, delay);
        } else {
          setError(
            new Error('Failed to maintain connection to huddle updates')
          );
        }
      };
    };

    setupEventSource();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, [workspaceId, fetchHuddles, activeHuddle?.id]);

  // Join a huddle
  const joinHuddle = useCallback(
    async (huddleId: string) => {
      if (!workspaceId) {
        return;
      }

      setIsJoining(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/huddles/${huddleId}/join`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to join huddle: ${response.statusText}`);
        }

        const data = await response.json();
        setActiveHuddle({
          ...data.huddle,
          createdAt: new Date(data.huddle.createdAt),
        });
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to join huddle')
        );
      } finally {
        setIsJoining(false);
      }
    },
    [workspaceId]
  );

  // Leave the active huddle
  const leaveHuddle = useCallback(async () => {
    if (!workspaceId || !activeHuddle) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/huddles/${activeHuddle.id}/leave`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to leave huddle: ${response.statusText}`);
      }

      setActiveHuddle(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to leave huddle')
      );
    }
  }, [workspaceId, activeHuddle]);

  // Create a new huddle
  const createHuddle = useCallback(
    async (name: string, channelId?: string): Promise<Huddle | null> => {
      if (!workspaceId) {
        return null;
      }

      if (!name || name.trim().length === 0) {
        setError(new Error('Huddle name is required'));
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/huddles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, channelId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create huddle: ${response.statusText}`);
        }

        const data = await response.json();
        const huddle: Huddle = {
          ...data.huddle,
          createdAt: new Date(data.huddle.createdAt),
        };

        setHuddles(prev => [...prev, huddle]);
        setActiveHuddle(huddle);

        return huddle;
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to create huddle')
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  return {
    huddles,
    activeHuddle,
    isLoading,
    isJoining,
    error,
    joinHuddle,
    leaveHuddle,
    createHuddle,
    refetch: fetchHuddles,
  };
}

/**
 * Hook for call duration timer
 */
export function useCallDuration(startTime: Date | null): UseCallDurationReturn {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    duration,
    formattedDuration: formatDuration(duration),
  };
}
