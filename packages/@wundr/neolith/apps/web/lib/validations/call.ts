/**
 * Call/Huddle Validation Schemas
 *
 * Zod schemas for video calling and huddle API endpoints.
 *
 * @module lib/validations/call
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Call-related error codes
 */
export const CALL_ERROR_CODES = {
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  CALL_ALREADY_ENDED: 'CALL_ALREADY_ENDED',
  CALL_FULL: 'CALL_FULL',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  ALREADY_IN_CALL: 'ALREADY_IN_CALL',
  ALREADY_IN_HUDDLE: 'ALREADY_IN_HUDDLE',
  INVALID_CALL_STATE: 'INVALID_CALL_STATE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FORBIDDEN: 'FORBIDDEN',
  LIVEKIT_ERROR: 'LIVEKIT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  RECORDING_NOT_AVAILABLE: 'RECORDING_NOT_AVAILABLE',
  RECORDING_ALREADY_ACTIVE: 'RECORDING_ALREADY_ACTIVE',
  RECORDING_NOT_ACTIVE: 'RECORDING_NOT_ACTIVE',
  RECORDING_NOT_STARTED: 'RECORDING_NOT_STARTED',
  HUDDLE_NOT_FOUND: 'HUDDLE_NOT_FOUND',
  HUDDLE_NOT_ACTIVE: 'HUDDLE_NOT_ACTIVE',
  HUDDLE_ALREADY_ENDED: 'HUDDLE_ALREADY_ENDED',
  HUDDLE_PRIVATE: 'HUDDLE_PRIVATE',
  NOT_IN_HUDDLE: 'NOT_IN_HUDDLE',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  LIVEKIT_TOKEN_ERROR: 'LIVEKIT_TOKEN_ERROR',
  LIVEKIT_CONFIG_ERROR: 'LIVEKIT_CONFIG_ERROR',
  ROOM_ALREADY_EXISTS: 'ROOM_ALREADY_EXISTS',
  WEBHOOK_VERIFICATION_FAILED: 'WEBHOOK_VERIFICATION_FAILED',
} as const;

export type CallErrorCode =
  (typeof CALL_ERROR_CODES)[keyof typeof CALL_ERROR_CODES];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standardized call error response
 */
export function createCallErrorResponse(
  code: CallErrorCode,
  message: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({
      error: code,
      message,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

/**
 * Call ID parameter schema
 */
export const callIdParamSchema = z.object({
  callId: z.string().min(1, 'Invalid call ID format'),
});

export type CallIdParam = z.infer<typeof callIdParamSchema>;

/**
 * Huddle ID parameter schema
 */
export const huddleIdParamSchema = z.object({
  huddleId: z.string().min(1, 'Invalid huddle ID format'),
});

export type HuddleIdParam = z.infer<typeof huddleIdParamSchema>;

/**
 * Room ID parameter schema
 */
export const roomIdParamSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
});

export type RoomIdParam = z.infer<typeof roomIdParamSchema>;

// =============================================================================
// CALL SCHEMAS
// =============================================================================

/**
 * Call type enum
 */
export const callTypeEnum = z.enum(['video', 'audio', 'screen_share']);

export type CallType = z.infer<typeof callTypeEnum>;

/**
 * Call status enum
 */
export const callStatusEnum = z.enum([
  'pending',
  'ringing',
  'active',
  'ended',
  'missed',
  'declined',
  'failed',
]);

export type CallStatus = z.infer<typeof callStatusEnum>;

/**
 * Create call input schema
 */
export const createCallSchema = z.object({
  channelId: z.string().min(1, 'Invalid channel ID'),
  type: callTypeEnum.default('video'),
  participantIds: z.array(z.string().min(1)).optional(),
  invitees: z.array(z.string().min(1)).optional(),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;

/**
 * Call filters schema
 */
export const callFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: callStatusEnum.optional(),
  search: z.string().optional(),
  channelId: z.string().min(1).optional(),
  type: callTypeEnum.optional(),
  activeOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'startedAt', 'endedAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CallFilters = z.infer<typeof callFiltersSchema>;

/**
 * Call participant type (for live call state and API responses)
 * This interface supports both real-time participants and database participants
 */
export interface CallParticipant {
  id: string;
  name?: string;
  image?: string | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  joinedAt: string | Date;
  displayName?: string | null;
  leftAt?: Date | null;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  callId?: string;
  userId?: string;
  user?: {
    id: string;
    name: string | null;
    email?: string | null;
    image?: string | null;
    avatarUrl?: string | null;
  };
}

/**
 * Database participant row (for API responses)
 */
export interface DbCallParticipant {
  id: string;
  callId: string;
  userId: string;
  displayName: string | null;
  joinedAt: Date;
  leftAt: Date | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Call response type
 */
export interface CallResponse {
  id: string;
  channelId: string;
  type: CallType;
  status: CallStatus;
  participants?: (CallParticipant | DbCallParticipant)[];
  startedAt: string | Date | null;
  endedAt: string | Date | null;
  roomName: string;
  createdAt?: string | Date;
  createdBy?: {
    id: string;
    name?: string | null;
  };
  createdById?: string;
  participantCount?: number;
}

// =============================================================================
// HUDDLE SCHEMAS
// =============================================================================

/**
 * Huddle status enum
 */
export const huddleStatusEnum = z.enum(['active', 'ended']);

export type HuddleStatus = z.infer<typeof huddleStatusEnum>;

/**
 * Start huddle input schema
 */
export const startHuddleSchema = z.object({
  channelId: z.string().min(1, 'Invalid channel ID'),
});

export type StartHuddleInput = z.infer<typeof startHuddleSchema>;

/**
 * Create huddle input schema
 */
export const createHuddleSchema = z.object({
  channelId: z.string().min(1, 'Invalid channel ID').optional(),
  workspaceId: z.string().min(1, 'Invalid workspace ID'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  displayName: z.string().optional(),
});

export type CreateHuddleInput = z.infer<typeof createHuddleSchema>;

/**
 * Join huddle input schema
 */
export const joinHuddleSchema = z.object({
  displayName: z.string().optional(),
  audioOnly: z.boolean().optional(),
  deviceId: z.string().optional(),
});

export type JoinHuddleInput = z.infer<typeof joinHuddleSchema>;

/**
 * Huddle filters schema
 */
export const huddleFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: huddleStatusEnum.optional(),
  search: z.string().optional(),
  workspaceId: z.string().min(1).optional(),
  activeOnly: z.coerce.boolean().optional(),
  publicOnly: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'name', 'participantCount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type HuddleFilters = z.infer<typeof huddleFiltersSchema>;

/**
 * Huddle response type
 */
export interface HuddleResponse {
  id: string;
  channelId?: string;
  workspaceId?: string;
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  status: HuddleStatus;
  participants?: (CallParticipant | DbCallParticipant)[];
  startedAt?: Date | string | null;
  endedAt: Date | string | null;
  createdAt?: Date | string;
  createdBy?: {
    id: string;
    name: string | null;
  };
  participantCount?: number;
  roomName: string;
}

/**
 * Join response type (includes LiveKit token)
 */
export interface JoinResponse {
  token: string;
  roomName: string;
  participantName?: string;
  serverUrl?: string;
  participant?: {
    identity: string;
    name: string;
  };
  huddle?: HuddleResponse;
  call?: CallResponse;
}

// =============================================================================
// LIVEKIT SCHEMAS
// =============================================================================

/**
 * LiveKit token request schema
 */
export const livekitTokenSchema = z.object({
  roomName: z.string().min(1, 'Room name is required'),
  participantName: z.string().min(1, 'Participant name is required'),
});

export type LivekitTokenInput = z.infer<typeof livekitTokenSchema>;

/**
 * LiveKit webhook event type
 */
export const livekitWebhookEventEnum = z.enum([
  'room_started',
  'room_finished',
  'participant_joined',
  'participant_left',
  'track_published',
  'track_unpublished',
  'recording_started',
  'recording_finished',
  'egress_started',
  'egress_ended',
]);

export type LivekitWebhookEvent = z.infer<typeof livekitWebhookEventEnum>;
export type LiveKitWebhookPayload = LivekitWebhookPayload;

/**
 * LiveKit webhook payload schema
 */
export const livekitWebhookSchema = z.object({
  event: livekitWebhookEventEnum,
  room: z
    .object({
      name: z.string(),
      sid: z.string(),
    })
    .optional(),
  participant: z
    .object({
      identity: z.string(),
      sid: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  track: z
    .object({
      sid: z.string(),
      type: z.string(),
    })
    .optional(),
  egressInfo: z
    .object({
      egressId: z.string(),
      roomName: z.string().optional(),
      status: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export type LivekitWebhookPayload = z.infer<typeof livekitWebhookSchema>;

// =============================================================================
// RECORDING SCHEMAS
// =============================================================================

/**
 * Recording status enum
 */
export const recordingStatusEnum = z.enum([
  'idle',
  'pending',
  'starting',
  'recording',
  'stopping',
  'processing',
  'completed',
  'failed',
]);

export type RecordingStatus = z.infer<typeof recordingStatusEnum>;

/**
 * Recording response type
 */
export interface RecordingResponse {
  id?: string;
  callId?: string;
  status: RecordingStatus;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
  duration?: number | null;
  url?: string | null;
  egressId?: string | null;
  format?: string | null;
}

/**
 * Start recording input schema
 */
export const startRecordingSchema = z.object({
  callId: z.string().min(1, 'Invalid call ID'),
  format: z.enum(['mp4', 'webm', 'ogg']).default('mp4'),
});

export type StartRecordingInput = z.infer<typeof startRecordingSchema>;

// =============================================================================
// INVITE SCHEMAS
// =============================================================================

/**
 * Call invite input schema
 */
export const callInviteSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, 'At least one user is required'),
});

export type CallInviteInput = z.infer<typeof callInviteSchema>;

/**
 * Invite to call input schema (extended for invite route)
 */
export const inviteToCallSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, 'At least one user is required'),
  message: z
    .string()
    .max(500, 'Message must be less than 500 characters')
    .optional(),
});

export type InviteToCallInput = z.infer<typeof inviteToCallSchema>;

/**
 * Join call input schema
 */
export const joinCallSchema = z.object({
  displayName: z.string().optional(),
  audioOnly: z.boolean().optional(),
  deviceId: z.string().optional(),
});

export type JoinCallInput = z.infer<typeof joinCallSchema>;
