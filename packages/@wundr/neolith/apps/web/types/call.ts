/**
 * Call Types for Genesis App
 * Types for video calls and huddles using LiveKit
 *
 * @module types/call
 */

import type { User } from './chat';

/**
 * Status of a call connection
 */
export type CallStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/**
 * Type of call being conducted
 */
export type CallType = 'video' | 'audio' | 'huddle';

/**
 * Quality rating for participant network connection
 */
export type ParticipantConnectionQuality =
  | 'excellent'
  | 'good'
  | 'poor'
  | 'lost';

/**
 * Media device type for input/output selection
 */
export type MediaDeviceKind = 'audioinput' | 'audiooutput' | 'videoinput';

/**
 * ISO 8601 timestamp string for serialization-safe dates
 */
export type ISOTimestamp = string;

/**
 * Represents a participant in an active call
 */
export interface CallParticipant {
  /** Unique identifier for the participant */
  readonly id: string;
  /** LiveKit identity string */
  readonly identity: string;
  /** Display name of the participant */
  name: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** Whether the participant is currently speaking */
  isSpeaking: boolean;
  /** Whether the participant's audio is muted */
  isMuted: boolean;
  /** Whether the participant's video is enabled */
  isVideoEnabled: boolean;
  /** Whether the participant is sharing their screen */
  isScreenSharing: boolean;
  /** Whether this participant is pinned in the UI */
  isPinned: boolean;
  /** Current connection quality assessment */
  connectionQuality: ParticipantConnectionQuality;
  /** Whether this is the local user */
  readonly isLocal: boolean;
  /** ISO timestamp when participant joined */
  readonly joinedAt: ISOTimestamp;
}

/**
 * Represents an active or historical call session
 */
export interface Call {
  /** Unique identifier for the call */
  readonly id: string;
  /** LiveKit room name */
  readonly roomName: string;
  /** Type of call (video, audio, or huddle) */
  readonly type: CallType;
  /** Optional channel ID if call is associated with a channel */
  channelId?: string;
  /** Workspace ID where the call belongs */
  readonly workspaceId: string;
  /** ISO timestamp when call was created */
  readonly createdAt: ISOTimestamp;
  /** ISO timestamp when call actually started (first participant joined) */
  startedAt?: ISOTimestamp;
  /** ISO timestamp when call ended */
  endedAt?: ISOTimestamp;
  /** Current or final list of participants */
  participants: CallParticipant[];
  /** User who initiated the call */
  readonly createdBy: User;
  /** Whether the call is being recorded */
  isRecording: boolean;
  /** Maximum number of participants allowed (optional limit) */
  maxParticipants?: number;
  /** Extensible metadata for additional call properties */
  metadata?: Record<string, unknown>;
}

/**
 * Represents an active huddle (lightweight audio-only call)
 */
export interface Huddle {
  /** Unique identifier for the huddle */
  readonly id: string;
  /** Display name of the huddle */
  name: string;
  /** Workspace ID where the huddle belongs */
  readonly workspaceId: string;
  /** Optional channel ID if huddle is associated with a channel */
  channelId?: string;
  /** Current list of participants in the huddle */
  participants: HuddleParticipant[];
  /** ISO timestamp when huddle was created */
  readonly createdAt: ISOTimestamp;
  /** Whether the huddle is currently active */
  isActive: boolean;
}

/**
 * Represents a participant in a huddle
 */
export interface HuddleParticipant {
  /** Unique identifier for this participation instance */
  readonly id: string;
  /** User information for the participant */
  readonly user: User;
  /** Whether the participant's audio is muted */
  isMuted: boolean;
  /** Whether the participant is currently speaking */
  isSpeaking: boolean;
  /** ISO timestamp when participant joined the huddle */
  readonly joinedAt: ISOTimestamp;
}

/**
 * Represents a media device available for calls
 */
export interface MediaDevice {
  /** System device identifier */
  readonly deviceId: string;
  /** Human-readable device label */
  label: string;
  /** Type of media device */
  kind: MediaDeviceKind;
  /** Whether this device is currently active/selected */
  isActive?: boolean;
}

/**
 * User preferences and settings for calls
 */
export interface CallSettings {
  /** Whether video should be enabled by default */
  videoEnabled: boolean;
  /** Whether audio should be enabled by default */
  audioEnabled: boolean;
  /** Device ID of selected video input */
  selectedVideoDevice?: string;
  /** Device ID of selected audio input (microphone) */
  selectedAudioDevice?: string;
  /** Device ID of selected audio output (speaker/headphones) */
  selectedAudioOutput?: string;
  /** Whether noise suppression should be enabled */
  noiseSuppression: boolean;
  /** Whether echo cancellation should be enabled */
  echoCancellation: boolean;
  /** Whether automatic gain control should be enabled */
  autoGainControl: boolean;
  /** Preferred video quality/resolution */
  videoQuality?: 'low' | 'medium' | 'high';
  /** Whether to show participant names on video tiles */
  showParticipantNames?: boolean;
}

/**
 * Represents an invitation to join a call
 */
export interface CallInvite {
  /** ID of the call being invited to */
  readonly callId: string;
  /** LiveKit room name */
  readonly roomName: string;
  /** User who sent the invitation */
  readonly invitedBy: User;
  /** ISO timestamp when invitation was sent */
  readonly invitedAt: ISOTimestamp;
  /** ISO timestamp when invitation expires */
  readonly expiresAt: ISOTimestamp;
  /** Shareable link to join the call */
  readonly link: string;
}

/**
 * Input for creating a new call
 */
export interface CreateCallInput {
  /** Type of call to create */
  type: CallType;
  /** Workspace ID where call should be created */
  workspaceId: string;
  /** Optional channel ID to associate with the call */
  channelId?: string;
  /** Optional initial settings for the call */
  settings?: Partial<CallSettings>;
  /** Optional maximum number of participants */
  maxParticipants?: number;
  /** Optional list of user IDs to invite immediately */
  inviteUserIds?: string[];
}

/**
 * Input for joining an existing call
 */
export interface JoinCallInput {
  /** ID of the call to join */
  callId: string;
  /** Initial media settings for joining user */
  settings?: Partial<CallSettings>;
}

/**
 * Input for updating participant state
 */
export interface UpdateParticipantInput {
  /** ID of the participant to update */
  participantId: string;
  /** Whether to mute/unmute audio */
  isMuted?: boolean;
  /** Whether to enable/disable video */
  isVideoEnabled?: boolean;
  /** Whether to pin/unpin participant */
  isPinned?: boolean;
}

/**
 * Call event types for real-time updates
 */
export type CallEvent =
  | { type: 'participant_joined'; participant: CallParticipant }
  | { type: 'participant_left'; participantId: string }
  | { type: 'participant_updated'; participant: CallParticipant }
  | { type: 'call_started'; callId: string; startedAt: ISOTimestamp }
  | { type: 'call_ended'; callId: string; endedAt: ISOTimestamp }
  | { type: 'recording_started'; callId: string }
  | { type: 'recording_stopped'; callId: string }
  | {
      type: 'connection_quality_changed';
      participantId: string;
      quality: ParticipantConnectionQuality;
    };

/**
 * Error types specific to call operations
 */
export interface CallError {
  /** Error code for programmatic handling */
  code:
    | 'CALL_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'ROOM_FULL'
    | 'MEDIA_DEVICE_ERROR'
    | 'CONNECTION_FAILED'
    | 'INVALID_TOKEN';
  /** Human-readable error message */
  message: string;
  /** Optional additional error details */
  details?: Record<string, unknown>;
}

/**
 * Response wrapper for call API operations
 */
export interface CallResponse<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error information if failed */
  error?: CallError;
}

/**
 * Statistics for a call participant's connection
 */
export interface ParticipantStats {
  /** Participant ID */
  readonly participantId: string;
  /** Bytes sent per second */
  bytesSent: number;
  /** Bytes received per second */
  bytesReceived: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Round-trip time in milliseconds */
  rtt: number;
  /** Current connection quality assessment */
  quality: ParticipantConnectionQuality;
  /** Timestamp of last stats update */
  timestamp: ISOTimestamp;
}
