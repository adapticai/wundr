/**
 * Call Types
 *
 * TypeScript type definitions for voice/video calls and huddles in the Genesis application.
 * These types support real-time communication features including calls, huddles, and recordings.
 *
 * @module @genesis/api-types/types/call
 */

// =============================================================================
// CALL TYPE ENUMS
// =============================================================================

/**
 * Call type enum - defines the type of call
 */
export const CallType = {
  /** Voice-only call */
  Voice: 'VOICE',
  /** Video call with audio */
  Video: 'VIDEO',
  /** Screen sharing session */
  ScreenShare: 'SCREEN_SHARE',
} as const;

export type CallTypeValue = (typeof CallType)[keyof typeof CallType];

/**
 * Call status enum - defines the current state of a call
 */
export const CallStatus = {
  /** Call is being initiated */
  Initiating: 'INITIATING',
  /** Call is ringing for participants */
  Ringing: 'RINGING',
  /** Call is in progress */
  Active: 'ACTIVE',
  /** Call is on hold */
  OnHold: 'ON_HOLD',
  /** Call has ended */
  Ended: 'ENDED',
  /** Call failed to connect */
  Failed: 'FAILED',
} as const;

export type CallStatusValue = (typeof CallStatus)[keyof typeof CallStatus];

/**
 * Participant status enum - defines the state of a call participant
 */
export const ParticipantStatus = {
  /** Participant is being invited */
  Invited: 'INVITED',
  /** Participant's device is ringing */
  Ringing: 'RINGING',
  /** Participant is connecting to the call */
  Connecting: 'CONNECTING',
  /** Participant is connected and active */
  Connected: 'CONNECTED',
  /** Participant is on hold */
  OnHold: 'ON_HOLD',
  /** Participant has left the call */
  Left: 'LEFT',
  /** Participant declined the call */
  Declined: 'DECLINED',
} as const;

export type ParticipantStatusValue = (typeof ParticipantStatus)[keyof typeof ParticipantStatus];

/**
 * Track type enum - defines the type of media track
 */
export const TrackType = {
  /** Audio track (microphone) */
  Audio: 'AUDIO',
  /** Video track (camera) */
  Video: 'VIDEO',
  /** Screen share track */
  Screen: 'SCREEN',
} as const;

export type TrackTypeValue = (typeof TrackType)[keyof typeof TrackType];

/**
 * Recording status enum - defines the state of a call recording
 */
export const RecordingStatus = {
  /** Recording is starting */
  Starting: 'STARTING',
  /** Recording is active */
  Recording: 'RECORDING',
  /** Recording is paused */
  Paused: 'PAUSED',
  /** Recording is stopping */
  Stopping: 'STOPPING',
  /** Recording is complete */
  Completed: 'COMPLETED',
  /** Recording failed */
  Failed: 'FAILED',
} as const;

export type RecordingStatusValue = (typeof RecordingStatus)[keyof typeof RecordingStatus];

/**
 * Huddle status enum - defines the state of a huddle
 */
export const HuddleStatus = {
  /** Huddle is active and can be joined */
  Active: 'ACTIVE',
  /** Huddle has ended */
  Ended: 'ENDED',
} as const;

export type HuddleStatusValue = (typeof HuddleStatus)[keyof typeof HuddleStatus];

// =============================================================================
// CALL ENTITY TYPES
// =============================================================================

/**
 * Call entity type - represents a voice/video call
 */
export interface Call {
  /** Unique call identifier */
  id: string;
  /** Type of call (voice, video, screen share) */
  type: CallTypeValue;
  /** Current status of the call */
  status: CallStatusValue;
  /** Channel where the call is happening */
  channelId: string;
  /** User who initiated the call */
  initiatorId: string;
  /** WebRTC room/session identifier */
  roomId: string | null;
  /** Call title (optional) */
  title: string | null;
  /** Whether the call is a scheduled call */
  isScheduled: boolean;
  /** Scheduled start time (if scheduled) */
  scheduledStartAt: Date | null;
  /** Actual start time */
  startedAt: Date | null;
  /** End time */
  endedAt: Date | null;
  /** Call settings */
  settings: CallSettings;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Call settings configuration
 */
export interface CallSettings {
  /** Maximum number of participants allowed */
  maxParticipants: number;
  /** Whether participants can share their screen */
  allowScreenShare: boolean;
  /** Whether the call can be recorded */
  allowRecording: boolean;
  /** Whether to enable waiting room */
  enableWaitingRoom: boolean;
  /** Whether to mute participants on entry */
  muteOnEntry: boolean;
  /** Whether to disable video on entry */
  disableVideoOnEntry: boolean;
  /** Quality preset (low, medium, high, auto) */
  qualityPreset: string;
}

/**
 * Default call settings
 */
export const DEFAULT_CALL_SETTINGS: CallSettings = {
  maxParticipants: 50,
  allowScreenShare: true,
  allowRecording: false,
  enableWaitingRoom: false,
  muteOnEntry: false,
  disableVideoOnEntry: false,
  qualityPreset: 'auto',
};

/**
 * Call participant entity type
 */
export interface CallParticipant {
  /** Unique participant identifier */
  id: string;
  /** Call this participant belongs to */
  callId: string;
  /** User ID of the participant */
  userId: string;
  /** Current status of the participant */
  status: ParticipantStatusValue;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Whether video is disabled */
  isVideoOff: boolean;
  /** Whether screen is being shared */
  isSharingScreen: boolean;
  /** Whether hand is raised */
  isHandRaised: boolean;
  /** Role in the call (host, co-host, participant) */
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT';
  /** Time when participant joined */
  joinedAt: Date | null;
  /** Time when participant left */
  leftAt: Date | null;
  /** Device/client information */
  deviceInfo: ParticipantDeviceInfo | null;
}

/**
 * Participant device information
 */
export interface ParticipantDeviceInfo {
  /** Device type (desktop, mobile, tablet) */
  deviceType: string;
  /** Browser/client name */
  clientName: string;
  /** Client version */
  clientVersion: string;
  /** Operating system */
  os: string;
}

/**
 * Call recording entity type
 */
export interface CallRecording {
  /** Unique recording identifier */
  id: string;
  /** Call this recording belongs to */
  callId: string;
  /** Current status of the recording */
  status: RecordingStatusValue;
  /** User who started the recording */
  startedById: string;
  /** Recording start time */
  startedAt: Date;
  /** Recording end time */
  endedAt: Date | null;
  /** Recording duration in seconds */
  duration: number | null;
  /** File size in bytes */
  fileSize: number | null;
  /** Storage URL for the recording */
  fileUrl: string | null;
  /** File format (mp4, webm, etc.) */
  format: string;
  /** Recording settings used */
  settings: RecordingSettings;
}

/**
 * Recording settings configuration
 */
export interface RecordingSettings {
  /** Video resolution */
  resolution: string;
  /** Video bitrate in kbps */
  videoBitrate: number;
  /** Audio bitrate in kbps */
  audioBitrate: number;
  /** Whether to record with layout/composition */
  compositeMode: boolean;
  /** Layout type if composite mode */
  layout: string | null;
}

// =============================================================================
// HUDDLE TYPES
// =============================================================================

/**
 * Huddle entity type - represents an impromptu audio/video session
 */
export interface Huddle {
  /** Unique huddle identifier */
  id: string;
  /** Workspace where the huddle is happening */
  workspaceId: string;
  /** Channel associated with the huddle (optional) */
  channelId: string | null;
  /** User who created the huddle */
  creatorId: string;
  /** Huddle title/topic */
  title: string | null;
  /** Current status of the huddle */
  status: HuddleStatusValue;
  /** WebRTC room/session identifier */
  roomId: string;
  /** Whether it's an audio-only huddle */
  isAudioOnly: boolean;
  /** Maximum participants allowed */
  maxParticipants: number;
  /** Start time */
  startedAt: Date;
  /** End time */
  endedAt: Date | null;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Huddle participant entity type
 */
export interface HuddleParticipant {
  /** Unique participant identifier */
  id: string;
  /** Huddle this participant belongs to */
  huddleId: string;
  /** User ID of the participant */
  userId: string;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Whether video is disabled (if video huddle) */
  isVideoOff: boolean;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Time when participant joined */
  joinedAt: Date;
  /** Time when participant left */
  leftAt: Date | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for starting a new call
 */
export interface StartCallInput {
  /** Channel to start the call in */
  channelId: string;
  /** Type of call to start */
  type: CallTypeValue;
  /** Optional call title */
  title?: string | null;
  /** Optional call settings override */
  settings?: Partial<CallSettings> | null;
}

/**
 * Options for joining a call
 */
export interface JoinCallOptions {
  /** Whether to join with audio muted */
  joinMuted?: boolean;
  /** Whether to join with video off */
  joinWithoutVideo?: boolean;
  /** Device preferences */
  preferredDevices?: {
    audioInput?: string;
    audioOutput?: string;
    videoInput?: string;
  };
}

/**
 * Input for creating a huddle
 */
export interface CreateHuddleInput {
  /** Workspace to create the huddle in */
  workspaceId: string;
  /** Optional channel to associate */
  channelId?: string | null;
  /** Optional huddle title */
  title?: string | null;
  /** Whether to create as audio-only */
  isAudioOnly?: boolean;
  /** Maximum participants (default: 10) */
  maxParticipants?: number;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

/**
 * Call payload for mutations
 */
export interface CallPayload {
  /** The call object */
  call: Call | null;
  /** Error information */
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

/**
 * Join call result with access token
 */
export interface JoinCallResult {
  /** The call being joined */
  call: Call;
  /** Participant information */
  participant: CallParticipant;
  /** Access token for WebRTC connection */
  token: string;
  /** WebRTC server URL */
  serverUrl: string;
  /** Additional connection configuration */
  connectionConfig: ConnectionConfig;
}

/**
 * WebRTC connection configuration
 */
export interface ConnectionConfig {
  /** STUN servers */
  stunServers: string[];
  /** TURN servers with credentials */
  turnServers: Array<{
    url: string;
    username: string;
    credential: string;
  }>;
  /** ICE transport policy */
  iceTransportPolicy: 'all' | 'relay';
}

/**
 * Huddle payload for mutations
 */
export interface HuddlePayload {
  /** The huddle object */
  huddle: Huddle | null;
  /** Error information */
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

/**
 * Recording payload for mutations
 */
export interface RecordingPayload {
  /** The recording object */
  recording: CallRecording | null;
  /** Error information */
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

/**
 * Delete operation payload
 */
export interface CallDeletePayload {
  /** Whether the operation succeeded */
  success: boolean;
  /** ID of the deleted item */
  deletedId: string | null;
  /** Error information */
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT TYPES
// =============================================================================

/**
 * Call started event payload
 */
export interface CallStartedEvent {
  /** The started call */
  call: Call;
  /** Initiator information */
  initiator: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Call ended event payload
 */
export interface CallEndedEvent {
  /** ID of the ended call */
  callId: string;
  /** Channel ID */
  channelId: string;
  /** End reason */
  endReason: 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'NO_ANSWER';
  /** Call duration in seconds */
  duration: number | null;
}

/**
 * Participant joined event payload
 */
export interface ParticipantJoinedEvent {
  /** Call ID */
  callId: string;
  /** The participant who joined */
  participant: CallParticipant;
  /** User information */
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Participant left event payload
 */
export interface ParticipantLeftEvent {
  /** Call ID */
  callId: string;
  /** ID of the participant who left */
  participantId: string;
  /** User ID */
  userId: string;
  /** Reason for leaving */
  reason: 'LEFT' | 'KICKED' | 'DISCONNECTED';
}

/**
 * Huddle updated event payload
 */
export interface HuddleUpdatedEvent {
  /** The updated huddle */
  huddle: Huddle;
  /** Type of update */
  updateType: 'PARTICIPANT_JOINED' | 'PARTICIPANT_LEFT' | 'ENDED' | 'SETTINGS_CHANGED';
  /** Participant count */
  participantCount: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a value is a valid CallType
 *
 * @param value - Value to check
 * @returns True if value is a valid CallType
 */
export function isCallType(value: unknown): value is CallTypeValue {
  return Object.values(CallType).includes(value as CallTypeValue);
}

/**
 * Type guard to check if a value is a valid CallStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid CallStatus
 */
export function isCallStatus(value: unknown): value is CallStatusValue {
  return Object.values(CallStatus).includes(value as CallStatusValue);
}

/**
 * Type guard to check if a value is a valid ParticipantStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid ParticipantStatus
 */
export function isParticipantStatus(value: unknown): value is ParticipantStatusValue {
  return Object.values(ParticipantStatus).includes(value as ParticipantStatusValue);
}

/**
 * Type guard to check if a value is a valid RecordingStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid RecordingStatus
 */
export function isRecordingStatus(value: unknown): value is RecordingStatusValue {
  return Object.values(RecordingStatus).includes(value as RecordingStatusValue);
}

/**
 * Type guard to check if a call is active
 *
 * @param call - Call to check
 * @returns True if call is in an active state
 */
export function isCallActive(call: Call): boolean {
  return call.status === CallStatus.Active || call.status === CallStatus.OnHold;
}

/**
 * Type guard to check if a huddle is joinable
 *
 * @param huddle - Huddle to check
 * @returns True if huddle can be joined
 */
export function isHuddleJoinable(huddle: Huddle): boolean {
  return huddle.status === HuddleStatus.Active;
}
