/**
 * @genesis/core - LiveKit Type Definitions
 *
 * Type definitions for LiveKit voice/video call integration.
 * Supports room management, token generation, participant control,
 * and recording functionality.
 *
 * @packageDocumentation
 */

// =============================================================================
// Room Types
// =============================================================================

/**
 * Options for creating a LiveKit room.
 */
export interface CreateRoomOptions {
  /** Unique room name/identifier */
  name: string;

  /** Time in seconds before an empty room is deleted (default: 300) */
  emptyTimeout?: number;

  /** Maximum number of participants allowed (default: unlimited) */
  maxParticipants?: number;

  /** Optional room metadata as JSON string */
  metadata?: string;

  /** Optional departure timeout for reconnection window */
  departureTimeout?: number;
}

/**
 * Represents a LiveKit room.
 */
export interface Room {
  /** Room name/identifier */
  name: string;

  /** Server-generated unique room ID */
  sid: string;

  /** Time in seconds before an empty room is deleted */
  emptyTimeout: number;

  /** Maximum number of participants allowed */
  maxParticipants: number;

  /** Room creation timestamp */
  creationTime: Date;

  /** Optional room metadata */
  metadata?: string;

  /** Current number of participants in the room */
  numParticipants: number;

  /** Room active publishers count */
  numPublishers?: number;

  /** Whether the room is currently active */
  activeRecording?: boolean;
}

/**
 * Room update options.
 */
export interface UpdateRoomOptions {
  /** Updated metadata */
  metadata?: string;

  /** Updated max participants */
  maxParticipants?: number;
}

// =============================================================================
// Token Types
// =============================================================================

/**
 * Track sources that can be published.
 */
export type TrackSource =
  | 'camera'
  | 'microphone'
  | 'screen_share'
  | 'screen_share_audio';

/**
 * Options for generating access tokens.
 */
export interface TokenOptions {
  /** Whether the participant can publish media tracks (default: true) */
  canPublish?: boolean;

  /** Whether the participant can subscribe to other tracks (default: true) */
  canSubscribe?: boolean;

  /** Whether the participant can publish data messages (default: true) */
  canPublishData?: boolean;

  /** Specific track sources allowed to publish */
  canPublishSources?: TrackSource[];

  /** Whether this is a room join grant (default: true) */
  roomJoin?: boolean;

  /** Whether the participant has admin privileges */
  roomAdmin?: boolean;

  /** Whether the participant can update room metadata */
  roomRecord?: boolean;

  /** Token time-to-live in seconds (default: 3600) */
  ttl?: number;

  /** Participant name for display */
  name?: string;

  /** Participant metadata as JSON string */
  metadata?: string;

  /** Hidden participant (won't show in participant list) */
  hidden?: boolean;
}

/**
 * Result of token generation.
 */
export interface TokenGenerationResult {
  /** The generated JWT token */
  token: string;

  /** Token expiration timestamp */
  expiresAt: Date;

  /** Room name the token is for */
  roomName: string;

  /** Participant identity */
  identity: string;
}

// =============================================================================
// Participant Types
// =============================================================================

/**
 * Participant connection state.
 */
export type ParticipantState = 'joining' | 'joined' | 'active' | 'disconnected';

/**
 * Track type enumeration.
 */
export type TrackType = 'audio' | 'video' | 'screen';

/**
 * Represents a published track.
 */
export interface Track {
  /** Server-generated track ID */
  sid: string;

  /** Track type */
  type: TrackType;

  /** Track name */
  name: string;

  /** Track source (camera, microphone, screen_share) */
  source: TrackSource;

  /** Whether the track is muted */
  muted: boolean;

  /** Track dimensions for video */
  width?: number;
  height?: number;

  /** Whether simulcast is enabled */
  simulcast?: boolean;

  /** Track MIME type */
  mimeType?: string;
}

/**
 * Represents a participant in a room.
 */
export interface Participant {
  /** Server-generated participant ID */
  sid: string;

  /** Participant identity (unique within room) */
  identity: string;

  /** Participant display name */
  name?: string;

  /** Current connection state */
  state: ParticipantState;

  /** Published tracks */
  tracks: Track[];

  /** Participant metadata */
  metadata?: string;

  /** Time participant joined */
  joinedAt: Date;

  /** Whether participant is a publisher */
  isPublisher?: boolean;

  /** Participant's connection quality */
  connectionQuality?: ConnectionQuality;
}

/**
 * Connection quality levels.
 */
export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'lost';

/**
 * Options for listing participants.
 */
export interface ListParticipantsOptions {
  /** Include track information */
  includeTracks?: boolean;
}

// =============================================================================
// Recording/Egress Types
// =============================================================================

/**
 * Recording output destination.
 */
export type RecordingDestination = 's3' | 'gcp' | 'azure';

/**
 * Recording options.
 */
export interface RecordingOptions {
  /** Output file path/prefix */
  filepath?: string;

  /** Recording destination */
  destination?: RecordingDestination;

  /** S3 bucket configuration */
  s3?: S3RecordingConfig;

  /** GCP bucket configuration */
  gcp?: GCPRecordingConfig;

  /** Azure blob configuration */
  azure?: AzureRecordingConfig;

  /** Audio-only recording */
  audioOnly?: boolean;

  /** Video-only recording */
  videoOnly?: boolean;

  /** Recording preset */
  preset?: RecordingPreset;

  /** Custom width */
  width?: number;

  /** Custom height */
  height?: number;

  /** Frame rate */
  frameRate?: number;

  /** Audio bitrate in kbps */
  audioBitrate?: number;

  /** Video bitrate in kbps */
  videoBitrate?: number;
}

/**
 * Recording presets.
 */
export type RecordingPreset =
  | 'H264_720P_30'
  | 'H264_720P_60'
  | 'H264_1080P_30'
  | 'H264_1080P_60'
  | 'PORTRAIT_H264_720P_30'
  | 'PORTRAIT_H264_720P_60'
  | 'PORTRAIT_H264_1080P_30'
  | 'PORTRAIT_H264_1080P_60';

/**
 * S3 recording configuration.
 */
export interface S3RecordingConfig {
  /** S3 bucket name */
  bucket: string;

  /** AWS region */
  region: string;

  /** AWS access key ID */
  accessKey?: string;

  /** AWS secret access key */
  secretKey?: string;

  /** S3 endpoint for custom S3-compatible storage */
  endpoint?: string;

  /** Force path style URLs */
  forcePathStyle?: boolean;
}

/**
 * GCP recording configuration.
 */
export interface GCPRecordingConfig {
  /** GCS bucket name */
  bucket: string;

  /** GCP credentials JSON */
  credentials?: string;
}

/**
 * Azure recording configuration.
 */
export interface AzureRecordingConfig {
  /** Azure storage account name */
  accountName: string;

  /** Azure storage account key */
  accountKey: string;

  /** Azure blob container name */
  containerName: string;
}

/**
 * Recording status.
 */
export type RecordingStatus =
  | 'starting'
  | 'active'
  | 'ending'
  | 'complete'
  | 'failed';

/**
 * Represents a recording.
 */
export interface Recording {
  /** Egress/Recording ID */
  egressId: string;

  /** Room name */
  roomName: string;

  /** Recording status */
  status: RecordingStatus;

  /** Recording start time */
  startedAt: Date;

  /** Recording end time */
  endedAt?: Date;

  /** Output file URL (when complete) */
  fileUrl?: string;

  /** File size in bytes */
  fileSize?: number;

  /** Recording duration in seconds */
  duration?: number;

  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * LiveKit service configuration.
 */
export interface LiveKitConfig {
  /** LiveKit server URL (e.g., wss://my-app.livekit.cloud) */
  url: string;

  /** LiveKit API key */
  apiKey: string;

  /** LiveKit API secret */
  apiSecret: string;

  /** Default token TTL in seconds */
  defaultTokenTtl?: number;

  /** Default room empty timeout in seconds */
  defaultEmptyTimeout?: number;

  /** Default max participants per room */
  defaultMaxParticipants?: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * LiveKit event types.
 */
export type LiveKitEventType =
  | 'room.created'
  | 'room.deleted'
  | 'participant.joined'
  | 'participant.left'
  | 'track.published'
  | 'track.unpublished'
  | 'recording.started'
  | 'recording.stopped';

/**
 * Base LiveKit event.
 */
export interface BaseLiveKitEvent {
  /** Event type */
  type: LiveKitEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Room name */
  roomName: string;
}

/**
 * Room created event.
 */
export interface RoomCreatedEvent extends BaseLiveKitEvent {
  type: 'room.created';
  room: Room;
}

/**
 * Room deleted event.
 */
export interface RoomDeletedEvent extends BaseLiveKitEvent {
  type: 'room.deleted';
}

/**
 * Participant joined event.
 */
export interface ParticipantJoinedEvent extends BaseLiveKitEvent {
  type: 'participant.joined';
  participant: Participant;
}

/**
 * Participant left event.
 */
export interface ParticipantLeftEvent extends BaseLiveKitEvent {
  type: 'participant.left';
  participant: Participant;
}

/**
 * Track published event.
 */
export interface TrackPublishedEvent extends BaseLiveKitEvent {
  type: 'track.published';
  participant: Participant;
  track: Track;
}

/**
 * Track unpublished event.
 */
export interface TrackUnpublishedEvent extends BaseLiveKitEvent {
  type: 'track.unpublished';
  participant: Participant;
  track: Track;
}

/**
 * Recording started event.
 */
export interface RecordingStartedEvent extends BaseLiveKitEvent {
  type: 'recording.started';
  recording: Recording;
}

/**
 * Recording stopped event.
 */
export interface RecordingStoppedEvent extends BaseLiveKitEvent {
  type: 'recording.stopped';
  recording: Recording;
}

/**
 * Union of all LiveKit events.
 */
export type LiveKitEvent =
  | RoomCreatedEvent
  | RoomDeletedEvent
  | ParticipantJoinedEvent
  | ParticipantLeftEvent
  | TrackPublishedEvent
  | TrackUnpublishedEvent
  | RecordingStartedEvent
  | RecordingStoppedEvent;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Checks if a value is a valid track type.
 */
export function isTrackType(value: unknown): value is TrackType {
  return value === 'audio' || value === 'video' || value === 'screen';
}

/**
 * Checks if a value is a valid participant state.
 */
export function isParticipantState(value: unknown): value is ParticipantState {
  return (
    value === 'joining' ||
    value === 'joined' ||
    value === 'active' ||
    value === 'disconnected'
  );
}

/**
 * Checks if a value is a valid recording status.
 */
export function isRecordingStatus(value: unknown): value is RecordingStatus {
  return (
    value === 'starting' ||
    value === 'active' ||
    value === 'ending' ||
    value === 'complete' ||
    value === 'failed'
  );
}

/**
 * Checks if a value is a valid track source.
 */
export function isTrackSource(value: unknown): value is TrackSource {
  return (
    value === 'camera' ||
    value === 'microphone' ||
    value === 'screen_share' ||
    value === 'screen_share_audio'
  );
}

/**
 * Checks if a value is a valid CreateRoomOptions object.
 */
export function isCreateRoomOptions(
  value: unknown
): value is CreateRoomOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.name === 'string' && obj.name.length > 0;
}

/**
 * Checks if a value is a valid LiveKitConfig object.
 */
export function isLiveKitConfig(value: unknown): value is LiveKitConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.url === 'string' &&
    typeof obj.apiKey === 'string' &&
    typeof obj.apiSecret === 'string'
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default LiveKit configuration values.
 */
export const DEFAULT_LIVEKIT_CONFIG = {
  defaultTokenTtl: 3600, // 1 hour
  defaultEmptyTimeout: 300, // 5 minutes
  defaultMaxParticipants: 100,
} as const;

/**
 * Default token options.
 */
export const DEFAULT_TOKEN_OPTIONS: Required<
  Pick<
    TokenOptions,
    'canPublish' | 'canSubscribe' | 'canPublishData' | 'roomJoin' | 'ttl'
  >
> = {
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomJoin: true,
  ttl: 3600,
};

/**
 * Host token options (full permissions).
 */
export const HOST_TOKEN_OPTIONS: TokenOptions = {
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomJoin: true,
  roomAdmin: true,
  roomRecord: true,
  ttl: 7200, // 2 hours
};

/**
 * Guest token options (limited permissions).
 */
export const GUEST_TOKEN_OPTIONS: TokenOptions = {
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomJoin: true,
  roomAdmin: false,
  roomRecord: false,
  ttl: 3600, // 1 hour
};

/**
 * Viewer token options (subscribe only).
 */
export const VIEWER_TOKEN_OPTIONS: TokenOptions = {
  canPublish: false,
  canSubscribe: true,
  canPublishData: false,
  roomJoin: true,
  roomAdmin: false,
  ttl: 3600,
};

/**
 * Recording presets with their dimensions.
 */
export const RECORDING_PRESETS: Record<
  RecordingPreset,
  { width: number; height: number; frameRate: number }
> = {
  H264_720P_30: { width: 1280, height: 720, frameRate: 30 },
  H264_720P_60: { width: 1280, height: 720, frameRate: 60 },
  H264_1080P_30: { width: 1920, height: 1080, frameRate: 30 },
  H264_1080P_60: { width: 1920, height: 1080, frameRate: 60 },
  PORTRAIT_H264_720P_30: { width: 720, height: 1280, frameRate: 30 },
  PORTRAIT_H264_720P_60: { width: 720, height: 1280, frameRate: 60 },
  PORTRAIT_H264_1080P_30: { width: 1080, height: 1920, frameRate: 30 },
  PORTRAIT_H264_1080P_60: { width: 1080, height: 1920, frameRate: 60 },
};
