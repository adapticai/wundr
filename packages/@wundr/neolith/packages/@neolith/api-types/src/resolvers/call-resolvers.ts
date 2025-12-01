/**
 * Call GraphQL Resolvers
 *
 * Comprehensive resolvers for voice/video call operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks (channel membership,
 * workspace membership), input validation, and proper error handling for real-time
 * communication features.
 *
 * @module @genesis/api-types/resolvers/call-resolvers
 */

import { GraphQLError } from 'graphql';

import type { PrismaClient, Prisma } from '@prisma/client';

import type {
  Call,
  CallTypeValue,
  CallStatusValue,
  CallSettings,
  CallParticipant,
  ParticipantStatusValue,
  CallRecording,
  RecordingStatusValue,
  Huddle,
  HuddleStatusValue,
  HuddleParticipant,
  CallPayload,
  HuddlePayload,
  RecordingPayload,
  CallDeletePayload,
  JoinCallResult,
  JoinCallOptions,
  StartCallInput,
  CreateHuddleInput,
  ConnectionConfig,
} from '../types/call.js';

import {
  CallType,
  CallStatus,
  ParticipantStatus,
  RecordingStatus,
  HuddleStatus,
  TrackType,
  DEFAULT_CALL_SETTINGS,
} from '../types/call.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Channel member role for authorization
 */
type ChannelMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Call service interface for WebRTC operations
 */
export interface CallService {
  /** Create a new call room */
  createRoom(callId: string, settings: CallSettings): Promise<string>;
  /** Generate access token for joining a call */
  generateToken(roomId: string, userId: string, role: string): Promise<string>;
  /** Get connection configuration */
  getConnectionConfig(): Promise<ConnectionConfig>;
  /** Start recording a call */
  startRecording(
    roomId: string,
    settings: Record<string, unknown>
  ): Promise<string>;
  /** Stop recording a call */
  stopRecording(recordingId: string): Promise<void>;
  /** End a call room */
  endRoom(roomId: string): Promise<void>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional call service for WebRTC operations */
  callService?: CallService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Channel member check result
 */
interface ChannelMemberInfo {
  isMember: boolean;
  role: ChannelMemberRole | null;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for call started */
export const CALL_STARTED = 'CALL_STARTED';

/** Event name for call ended */
export const CALL_ENDED = 'CALL_ENDED';

/** Event name for participant joined */
export const PARTICIPANT_JOINED = 'PARTICIPANT_JOINED';

/** Event name for participant left */
export const PARTICIPANT_LEFT = 'PARTICIPANT_LEFT';

/** Event name for participant updated (mute/unmute, etc.) */
export const PARTICIPANT_UPDATED = 'PARTICIPANT_UPDATED';

/** Event name for huddle updated */
export const HUDDLE_UPDATED = 'HUDDLE_UPDATED';

/** Event name for recording status changed */
export const RECORDING_STATUS_CHANGED = 'RECORDING_STATUS_CHANGED';

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface CallQueryArgs {
  id: string;
}

interface ActiveCallArgs {
  channelId: string;
}

interface CallHistoryArgs {
  channelId: string;
  pagination?: {
    first?: number | null;
    after?: string | null;
  } | null;
}

interface HuddleQueryArgs {
  id: string;
}

interface HuddlesArgs {
  workspaceId: string;
}

interface ActiveHuddlesArgs {
  workspaceId: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface StartCallArgs {
  channelId: string;
  type: CallTypeValue;
  title?: string | null;
  settings?: Partial<CallSettings> | null;
}

interface EndCallArgs {
  callId: string;
}

interface JoinCallArgs {
  callId: string;
  options?: JoinCallOptions | null;
}

interface LeaveCallArgs {
  callId: string;
}

interface InviteToCallArgs {
  callId: string;
  userIds: string[];
}

interface MuteParticipantArgs {
  callId: string;
  participantId: string;
  trackType: 'AUDIO' | 'VIDEO';
}

interface RemoveParticipantArgs {
  callId: string;
  participantId: string;
}

interface CreateHuddleArgs {
  input: CreateHuddleInput;
}

interface JoinHuddleArgs {
  huddleId: string;
}

interface LeaveHuddleArgs {
  huddleId: string;
}

interface DeleteHuddleArgs {
  huddleId: string;
}

interface StartRecordingArgs {
  callId: string;
}

interface StopRecordingArgs {
  callId: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface CallStartedSubArgs {
  channelId: string;
}

interface CallEndedSubArgs {
  channelId: string;
}

interface ParticipantJoinedSubArgs {
  callId: string;
}

interface ParticipantLeftSubArgs {
  callId: string;
}

interface HuddleUpdatedSubArgs {
  workspaceId: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 *
 * @param context - The GraphQL context
 * @returns True if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Type guard to check if user has system admin role
 *
 * @param context - The GraphQL context
 * @returns True if user is a system admin
 */
function isSystemAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user is a member of a workspace
 *
 * @param context - The GraphQL context
 * @param workspaceId - The workspace ID to check
 * @returns True if user is a workspace member
 */
async function isWorkspaceMember(
  context: GraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isSystemAdmin(context)) {
    return true;
  }

  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
  });

  return !!membership;
}

/**
 * Check if user is a member of a channel and get their role
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to check
 * @returns Channel member info
 */
async function getChannelMemberInfo(
  context: GraphQLContext,
  channelId: string
): Promise<ChannelMemberInfo> {
  if (!isAuthenticated(context)) {
    return { isMember: false, role: null };
  }

  const membership = await context.prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    // System admins can access any channel
    if (isSystemAdmin(context)) {
      return { isMember: true, role: 'ADMIN' };
    }
    return { isMember: false, role: null };
  }

  return { isMember: true, role: membership.role as ChannelMemberRole };
}

/**
 * Check if user can manage a call (is host/co-host or channel admin)
 *
 * @param context - The GraphQL context
 * @param callId - The call ID to check
 * @returns True if user can manage the call
 */
async function canManageCall(
  context: GraphQLContext,
  callId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isSystemAdmin(context)) {
    return true;
  }

  // Check if user is host or co-host
  const participant = (await context.prisma.$queryRaw`
    SELECT role FROM call_participants
    WHERE call_id = ${callId} AND user_id = ${context.user.id}
    LIMIT 1
  `) as Array<{ role: string }>;

  if (participant.length > 0) {
    const role = participant[0]!.role;
    if (role === 'HOST' || role === 'CO_HOST') {
      return true;
    }
  }

  // Check if user is channel admin
  const call = (await context.prisma.$queryRaw`
    SELECT channel_id FROM calls WHERE id = ${callId} LIMIT 1
  `) as Array<{ channel_id: string }>;

  if (call.length === 0) {
    return false;
  }

  const memberInfo = await getChannelMemberInfo(context, call[0]!.channel_id);
  return memberInfo.role === 'OWNER' || memberInfo.role === 'ADMIN';
}

/**
 * Generate cursor for pagination
 *
 * @param item - Item with createdAt and id
 * @returns Base64 encoded cursor
 */
function generateCursor(item: { createdAt: Date; id: string }): string {
  return Buffer.from(`${item.createdAt.toISOString()}:${item.id}`).toString(
    'base64'
  );
}

/**
 * Parse cursor to get timestamp and ID
 *
 * @param cursor - Base64 encoded cursor
 * @returns Parsed cursor data or null if invalid
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Create success payload for calls
 */
function createCallSuccessPayload(call: Call): CallPayload {
  return { call, errors: [] };
}

/**
 * Create error payload for calls
 */
function createCallErrorPayload(
  code: string,
  message: string,
  path?: string[]
): CallPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { call: null, errors };
}

/**
 * Create success payload for huddles
 */
function createHuddleSuccessPayload(huddle: Huddle): HuddlePayload {
  return { huddle, errors: [] };
}

/**
 * Create error payload for huddles
 */
function createHuddleErrorPayload(
  code: string,
  message: string,
  path?: string[]
): HuddlePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { huddle: null, errors };
}

/**
 * Generate a unique room ID
 */
function generateRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// =============================================================================
// CALL QUERY RESOLVERS
// =============================================================================

/**
 * Call Query resolvers
 */
export const callQueries = {
  /**
   * Get a call by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing call ID
   * @param context - GraphQL context
   * @returns The call or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   call(id: "call_123") {
   *     id
   *     type
   *     status
   *     participants { user { displayName } }
   *   }
   * }
   * ```
   */
  call: async (
    _parent: unknown,
    args: CallQueryArgs,
    context: GraphQLContext
  ): Promise<Call | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Query call from database (assuming calls table exists)
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.id} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return null;
    }

    const call = callData[0]!;

    // Check channel access
    const memberInfo = await getChannelMemberInfo(
      context,
      call.channel_id as string
    );
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this call', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return {
      id: call.id as string,
      type: call.type as CallTypeValue,
      status: call.status as CallStatusValue,
      channelId: call.channel_id as string,
      initiatorId: call.initiator_id as string,
      roomId: call.room_id as string | null,
      title: call.title as string | null,
      isScheduled: call.is_scheduled as boolean,
      scheduledStartAt: call.scheduled_start_at as Date | null,
      startedAt: call.started_at as Date | null,
      endedAt: call.ended_at as Date | null,
      settings: (call.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (call.metadata as Record<string, unknown>) ?? {},
      createdAt: call.created_at as Date,
      updatedAt: call.updated_at as Date,
    };
  },

  /**
   * Get the active call in a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing channel ID
   * @param context - GraphQL context
   * @returns The active call or null if none
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   activeCall(channelId: "ch_123") {
   *     id
   *     type
   *     participants { user { displayName } }
   *   }
   * }
   * ```
   */
  activeCall: async (
    _parent: unknown,
    args: ActiveCallArgs,
    context: GraphQLContext
  ): Promise<Call | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check channel access
    const memberInfo = await getChannelMemberInfo(context, args.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Query active call
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls
      WHERE channel_id = ${args.channelId}
        AND status IN ('INITIATING', 'RINGING', 'ACTIVE', 'ON_HOLD')
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return null;
    }

    const call = callData[0]!;
    return {
      id: call.id as string,
      type: call.type as CallTypeValue,
      status: call.status as CallStatusValue,
      channelId: call.channel_id as string,
      initiatorId: call.initiator_id as string,
      roomId: call.room_id as string | null,
      title: call.title as string | null,
      isScheduled: call.is_scheduled as boolean,
      scheduledStartAt: call.scheduled_start_at as Date | null,
      startedAt: call.started_at as Date | null,
      endedAt: call.ended_at as Date | null,
      settings: (call.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (call.metadata as Record<string, unknown>) ?? {},
      createdAt: call.created_at as Date,
      updatedAt: call.updated_at as Date,
    };
  },

  /**
   * Get call history for a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with channelId and pagination
   * @param context - GraphQL context
   * @returns Paginated list of calls
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   callHistory(channelId: "ch_123", pagination: { first: 10 }) {
   *     edges {
   *       node { id type startedAt endedAt duration }
   *       cursor
   *     }
   *     pageInfo { hasNextPage }
   *     totalCount
   *   }
   * }
   * ```
   */
  callHistory: async (
    _parent: unknown,
    args: CallHistoryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check channel access
    const memberInfo = await getChannelMemberInfo(context, args.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const first = Math.min(Math.max(args.pagination?.first ?? 20, 1), 100);

    // Build query based on cursor
    let calls: Array<Record<string, unknown>>;
    if (args.pagination?.after) {
      const parsed = parseCursor(args.pagination.after);
      if (parsed) {
        calls = await context.prisma.$queryRaw`
          SELECT * FROM calls
          WHERE channel_id = ${args.channelId}
            AND (created_at < ${parsed.timestamp} OR (created_at = ${parsed.timestamp} AND id < ${parsed.id}))
          ORDER BY created_at DESC, id DESC
          LIMIT ${first + 1}
        `;
      } else {
        calls = await context.prisma.$queryRaw`
          SELECT * FROM calls
          WHERE channel_id = ${args.channelId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${first + 1}
        `;
      }
    } else {
      calls = await context.prisma.$queryRaw`
        SELECT * FROM calls
        WHERE channel_id = ${args.channelId}
        ORDER BY created_at DESC, id DESC
        LIMIT ${first + 1}
      `;
    }

    // Get total count
    const countResult = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM calls WHERE channel_id = ${args.channelId}
    `) as Array<{ count: bigint }>;
    const totalCount = Number(countResult[0]?.count ?? 0);

    const hasNextPage = calls.length > first;
    const nodes = hasNextPage ? calls.slice(0, -1) : calls;

    const edges = nodes.map(call => {
      const callData: Call = {
        id: call.id as string,
        type: call.type as CallTypeValue,
        status: call.status as CallStatusValue,
        channelId: call.channel_id as string,
        initiatorId: call.initiator_id as string,
        roomId: call.room_id as string | null,
        title: call.title as string | null,
        isScheduled: call.is_scheduled as boolean,
        scheduledStartAt: call.scheduled_start_at as Date | null,
        startedAt: call.started_at as Date | null,
        endedAt: call.ended_at as Date | null,
        settings: (call.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
        metadata: (call.metadata as Record<string, unknown>) ?? {},
        createdAt: call.created_at as Date,
        updatedAt: call.updated_at as Date,
      };
      return {
        node: callData,
        cursor: generateCursor({
          createdAt: call.created_at as Date,
          id: call.id as string,
        }),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!args.pagination?.after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get a huddle by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing huddle ID
   * @param context - GraphQL context
   * @returns The huddle or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   huddle(id: "huddle_123") {
   *     id
   *     title
   *     status
   *     participants { user { displayName } }
   *   }
   * }
   * ```
   */
  huddle: async (
    _parent: unknown,
    args: HuddleQueryArgs,
    context: GraphQLContext
  ): Promise<Huddle | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const huddleData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles WHERE id = ${args.id} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (huddleData.length === 0) {
      return null;
    }

    const huddle = huddleData[0]!;

    // Check workspace access
    const isMember = await isWorkspaceMember(
      context,
      huddle.workspace_id as string
    );
    if (!isMember) {
      throw new GraphQLError('Access denied to this huddle', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return {
      id: huddle.id as string,
      workspaceId: huddle.workspace_id as string,
      channelId: huddle.channel_id as string | null,
      creatorId: huddle.creator_id as string,
      title: huddle.title as string | null,
      status: huddle.status as HuddleStatusValue,
      roomId: huddle.room_id as string,
      isAudioOnly: huddle.is_audio_only as boolean,
      maxParticipants: huddle.max_participants as number,
      startedAt: huddle.started_at as Date,
      endedAt: huddle.ended_at as Date | null,
      createdAt: huddle.created_at as Date,
      updatedAt: huddle.updated_at as Date,
    };
  },

  /**
   * List huddles in a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing workspace ID
   * @param context - GraphQL context
   * @returns List of huddles
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   huddles(workspaceId: "ws_123") {
   *     id
   *     title
   *     status
   *     participantCount
   *   }
   * }
   * ```
   */
  huddles: async (
    _parent: unknown,
    args: HuddlesArgs,
    context: GraphQLContext
  ): Promise<Huddle[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check workspace access
    const isMember = await isWorkspaceMember(context, args.workspaceId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const huddlesData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles
      WHERE workspace_id = ${args.workspaceId}
      ORDER BY created_at DESC
      LIMIT 50
    `) as Array<Record<string, unknown>>;

    return huddlesData.map(huddle => ({
      id: huddle.id as string,
      workspaceId: huddle.workspace_id as string,
      channelId: huddle.channel_id as string | null,
      creatorId: huddle.creator_id as string,
      title: huddle.title as string | null,
      status: huddle.status as HuddleStatusValue,
      roomId: huddle.room_id as string,
      isAudioOnly: huddle.is_audio_only as boolean,
      maxParticipants: huddle.max_participants as number,
      startedAt: huddle.started_at as Date,
      endedAt: huddle.ended_at as Date | null,
      createdAt: huddle.created_at as Date,
      updatedAt: huddle.updated_at as Date,
    }));
  },

  /**
   * List active huddles in a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing workspace ID
   * @param context - GraphQL context
   * @returns List of active huddles
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   activeHuddles(workspaceId: "ws_123") {
   *     id
   *     title
   *     participantCount
   *   }
   * }
   * ```
   */
  activeHuddles: async (
    _parent: unknown,
    args: ActiveHuddlesArgs,
    context: GraphQLContext
  ): Promise<Huddle[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check workspace access
    const isMember = await isWorkspaceMember(context, args.workspaceId);
    if (!isMember) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const huddlesData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles
      WHERE workspace_id = ${args.workspaceId} AND status = 'ACTIVE'
      ORDER BY started_at DESC
    `) as Array<Record<string, unknown>>;

    return huddlesData.map(huddle => ({
      id: huddle.id as string,
      workspaceId: huddle.workspace_id as string,
      channelId: huddle.channel_id as string | null,
      creatorId: huddle.creator_id as string,
      title: huddle.title as string | null,
      status: huddle.status as HuddleStatusValue,
      roomId: huddle.room_id as string,
      isAudioOnly: huddle.is_audio_only as boolean,
      maxParticipants: huddle.max_participants as number,
      startedAt: huddle.started_at as Date,
      endedAt: huddle.ended_at as Date | null,
      createdAt: huddle.created_at as Date,
      updatedAt: huddle.updated_at as Date,
    }));
  },
};

// =============================================================================
// CALL MUTATION RESOLVERS
// =============================================================================

/**
 * Call Mutation resolvers
 */
export const callMutations = {
  /**
   * Start a new call in a channel
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channel ID, type, and optional settings
   * @param context - GraphQL context
   * @returns Call payload with created call or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   startCall(channelId: "ch_123", type: VIDEO) {
   *     call {
   *       id
   *       roomId
   *       status
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  startCall: async (
    _parent: unknown,
    args: StartCallArgs,
    context: GraphQLContext
  ): Promise<CallPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check channel membership
    const memberInfo = await getChannelMemberInfo(context, args.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('You must be a channel member to start a call', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if there's already an active call in this channel
    const existingCall = (await context.prisma.$queryRaw`
      SELECT id FROM calls
      WHERE channel_id = ${args.channelId}
        AND status IN ('INITIATING', 'RINGING', 'ACTIVE', 'ON_HOLD')
      LIMIT 1
    `) as Array<{ id: string }>;

    if (existingCall.length > 0) {
      return createCallErrorPayload(
        'CONFLICT',
        'There is already an active call in this channel'
      );
    }

    // Merge settings with defaults
    const settings: CallSettings = {
      ...DEFAULT_CALL_SETTINGS,
      ...(args.settings ?? {}),
    };

    // Generate room ID
    const roomId = generateRoomId();

    // Create the call
    const now = new Date();
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    await context.prisma.$executeRaw`
      INSERT INTO calls (id, type, status, channel_id, initiator_id, room_id, title, is_scheduled, settings, metadata, created_at, updated_at, started_at)
      VALUES (${callId}, ${args.type}, 'INITIATING', ${args.channelId}, ${context.user.id}, ${roomId}, ${args.title ?? null}, false, ${JSON.stringify(settings)}::jsonb, '{}'::jsonb, ${now}, ${now}, ${now})
    `;

    // Add initiator as host
    const participantId = `part_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await context.prisma.$executeRaw`
      INSERT INTO call_participants (id, call_id, user_id, status, role, is_muted, is_video_off, is_sharing_screen, is_hand_raised, joined_at, created_at, updated_at)
      VALUES (${participantId}, ${callId}, ${context.user.id}, 'CONNECTED', 'HOST', false, ${args.type === 'VOICE'}, false, false, ${now}, ${now}, ${now})
    `;

    // Create WebRTC room if call service is available
    if (context.callService) {
      try {
        await context.callService.createRoom(callId, settings);
      } catch (error) {
        // Clean up on failure
        await context.prisma
          .$executeRaw`DELETE FROM call_participants WHERE call_id = ${callId}`;
        await context.prisma
          .$executeRaw`DELETE FROM calls WHERE id = ${callId}`;
        return createCallErrorPayload(
          'INTERNAL_ERROR',
          'Failed to create call room'
        );
      }
    }

    // Update call status to active
    await context.prisma.$executeRaw`
      UPDATE calls SET status = 'ACTIVE', updated_at = ${new Date()} WHERE id = ${callId}
    `;

    const call: Call = {
      id: callId,
      type: args.type,
      status: 'ACTIVE',
      channelId: args.channelId,
      initiatorId: context.user.id,
      roomId,
      title: args.title ?? null,
      isScheduled: false,
      scheduledStartAt: null,
      startedAt: now,
      endedAt: null,
      settings,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    // Publish call started event
    await context.pubsub.publish(`${CALL_STARTED}_${args.channelId}`, {
      callStarted: {
        call,
        initiator: {
          id: context.user.id,
          displayName: context.user.name,
          avatarUrl: null,
        },
      },
    });

    return createCallSuccessPayload(call);
  },

  /**
   * End an active call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID
   * @param context - GraphQL context
   * @returns Call payload with ended call
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   endCall(callId: "call_123") {
   *     call { id status endedAt }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  endCall: async (
    _parent: unknown,
    args: EndCallArgs,
    context: GraphQLContext
  ): Promise<CallPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user can manage the call
    const canManage = await canManageCall(context, args.callId);
    if (!canManage) {
      throw new GraphQLError('You do not have permission to end this call', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get the call
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return createCallErrorPayload('NOT_FOUND', 'Call not found');
    }

    const existingCall = callData[0]!;

    if (existingCall.status === 'ENDED') {
      return createCallErrorPayload('BAD_USER_INPUT', 'Call has already ended');
    }

    // End the call
    const now = new Date();
    await context.prisma.$executeRaw`
      UPDATE calls SET status = 'ENDED', ended_at = ${now}, updated_at = ${now} WHERE id = ${args.callId}
    `;

    // Update all participants to left status
    await context.prisma.$executeRaw`
      UPDATE call_participants
      SET status = 'LEFT', left_at = ${now}, updated_at = ${now}
      WHERE call_id = ${args.callId} AND status = 'CONNECTED'
    `;

    // End WebRTC room if call service is available
    if (context.callService && existingCall.room_id) {
      try {
        await context.callService.endRoom(existingCall.room_id as string);
      } catch (error) {
        // Log but don't fail the mutation
        console.error('Failed to end WebRTC room:', error);
      }
    }

    const call: Call = {
      id: args.callId,
      type: existingCall.type as CallTypeValue,
      status: 'ENDED',
      channelId: existingCall.channel_id as string,
      initiatorId: existingCall.initiator_id as string,
      roomId: existingCall.room_id as string | null,
      title: existingCall.title as string | null,
      isScheduled: existingCall.is_scheduled as boolean,
      scheduledStartAt: existingCall.scheduled_start_at as Date | null,
      startedAt: existingCall.started_at as Date | null,
      endedAt: now,
      settings:
        (existingCall.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (existingCall.metadata as Record<string, unknown>) ?? {},
      createdAt: existingCall.created_at as Date,
      updatedAt: now,
    };

    // Calculate duration
    const duration = existingCall.started_at
      ? Math.round(
          (now.getTime() - (existingCall.started_at as Date).getTime()) / 1000
        )
      : null;

    // Publish call ended event
    await context.pubsub.publish(`${CALL_ENDED}_${existingCall.channel_id}`, {
      callEnded: {
        callId: args.callId,
        channelId: existingCall.channel_id,
        endReason: 'COMPLETED',
        duration,
      },
    });

    return createCallSuccessPayload(call);
  },

  /**
   * Join an active call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID and options
   * @param context - GraphQL context
   * @returns Join result with token and connection info
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   joinCall(callId: "call_123", options: { joinMuted: true }) {
   *     call { id status }
   *     participant { id role }
   *     token
   *     serverUrl
   *   }
   * }
   * ```
   */
  joinCall: async (
    _parent: unknown,
    args: JoinCallArgs,
    context: GraphQLContext
  ): Promise<JoinCallResult | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get the call
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      throw new GraphQLError('Call not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const existingCall = callData[0]!;

    if (existingCall.status !== 'ACTIVE' && existingCall.status !== 'ON_HOLD') {
      throw new GraphQLError('Call is not active', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Check channel membership
    const memberInfo = await getChannelMemberInfo(
      context,
      existingCall.channel_id as string
    );
    if (!memberInfo.isMember) {
      throw new GraphQLError('You must be a channel member to join this call', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if already a participant
    const existingParticipant = (await context.prisma.$queryRaw`
      SELECT * FROM call_participants
      WHERE call_id = ${args.callId} AND user_id = ${context.user.id}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const now = new Date();
    let participant: CallParticipant;
    const participantId =
      existingParticipant.length > 0
        ? (existingParticipant[0]!.id as string)
        : `part_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    if (existingParticipant.length > 0) {
      // Rejoin existing participant
      await context.prisma.$executeRaw`
        UPDATE call_participants
        SET status = 'CONNECTED', joined_at = ${now}, left_at = NULL, updated_at = ${now},
            is_muted = ${args.options?.joinMuted ?? false},
            is_video_off = ${args.options?.joinWithoutVideo ?? false}
        WHERE id = ${participantId}
      `;

      participant = {
        id: participantId,
        callId: args.callId,
        userId: context.user.id,
        status: 'CONNECTED',
        isMuted: args.options?.joinMuted ?? false,
        isVideoOff: args.options?.joinWithoutVideo ?? false,
        isSharingScreen: false,
        isHandRaised: false,
        role: existingParticipant[0]!.role as
          | 'HOST'
          | 'CO_HOST'
          | 'PARTICIPANT',
        joinedAt: now,
        leftAt: null,
        deviceInfo: null,
      };
    } else {
      // Create new participant
      await context.prisma.$executeRaw`
        INSERT INTO call_participants (id, call_id, user_id, status, role, is_muted, is_video_off, is_sharing_screen, is_hand_raised, joined_at, created_at, updated_at)
        VALUES (${participantId}, ${args.callId}, ${context.user.id}, 'CONNECTED', 'PARTICIPANT', ${args.options?.joinMuted ?? false}, ${args.options?.joinWithoutVideo ?? false}, false, false, ${now}, ${now}, ${now})
      `;

      participant = {
        id: participantId,
        callId: args.callId,
        userId: context.user.id,
        status: 'CONNECTED',
        isMuted: args.options?.joinMuted ?? false,
        isVideoOff: args.options?.joinWithoutVideo ?? false,
        isSharingScreen: false,
        isHandRaised: false,
        role: 'PARTICIPANT',
        joinedAt: now,
        leftAt: null,
        deviceInfo: null,
      };
    }

    // Generate token and get connection config
    let token = '';
    let serverUrl = '';
    let connectionConfig: ConnectionConfig = {
      stunServers: ['stun:stun.l.google.com:19302'],
      turnServers: [],
      iceTransportPolicy: 'all',
    };

    if (context.callService && existingCall.room_id) {
      try {
        token = await context.callService.generateToken(
          existingCall.room_id as string,
          context.user.id,
          participant.role
        );
        connectionConfig = await context.callService.getConnectionConfig();
        serverUrl = process.env.WEBRTC_SERVER_URL ?? '';
      } catch (error) {
        throw new GraphQLError('Failed to generate call token', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    }

    const call: Call = {
      id: args.callId,
      type: existingCall.type as CallTypeValue,
      status: existingCall.status as CallStatusValue,
      channelId: existingCall.channel_id as string,
      initiatorId: existingCall.initiator_id as string,
      roomId: existingCall.room_id as string | null,
      title: existingCall.title as string | null,
      isScheduled: existingCall.is_scheduled as boolean,
      scheduledStartAt: existingCall.scheduled_start_at as Date | null,
      startedAt: existingCall.started_at as Date | null,
      endedAt: null,
      settings:
        (existingCall.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (existingCall.metadata as Record<string, unknown>) ?? {},
      createdAt: existingCall.created_at as Date,
      updatedAt: existingCall.updated_at as Date,
    };

    // Publish participant joined event
    await context.pubsub.publish(`${PARTICIPANT_JOINED}_${args.callId}`, {
      participantJoined: {
        callId: args.callId,
        participant,
        user: {
          id: context.user.id,
          displayName: context.user.name,
          avatarUrl: null,
        },
      },
    });

    return {
      call,
      participant,
      token,
      serverUrl,
      connectionConfig,
    };
  },

  /**
   * Leave a call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   leaveCall(callId: "call_123") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  leaveCall: async (
    _parent: unknown,
    args: LeaveCallArgs,
    context: GraphQLContext
  ): Promise<CallDeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get participant
    const participantData = (await context.prisma.$queryRaw`
      SELECT * FROM call_participants
      WHERE call_id = ${args.callId} AND user_id = ${context.user.id}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (participantData.length === 0) {
      return {
        success: false,
        deletedId: null,
        errors: [
          {
            code: 'NOT_FOUND',
            message: 'You are not a participant in this call',
          },
        ],
      };
    }

    const participant = participantData[0]!;

    if (participant.status === 'LEFT') {
      return {
        success: true,
        deletedId: participant.id as string,
        errors: [],
      };
    }

    // Update participant status
    const now = new Date();
    await context.prisma.$executeRaw`
      UPDATE call_participants
      SET status = 'LEFT', left_at = ${now}, updated_at = ${now}
      WHERE id = ${participant.id}
    `;

    // Get call info for event
    const callData = (await context.prisma.$queryRaw`
      SELECT channel_id FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<{ channel_id: string }>;

    // Publish participant left event
    await context.pubsub.publish(`${PARTICIPANT_LEFT}_${args.callId}`, {
      participantLeft: {
        callId: args.callId,
        participantId: participant.id,
        userId: context.user.id,
        reason: 'LEFT',
      },
    });

    // Check if this was the last participant (end call if so)
    const remainingParticipants = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM call_participants
      WHERE call_id = ${args.callId} AND status = 'CONNECTED'
    `) as Array<{ count: bigint }>;

    if (Number(remainingParticipants[0]?.count ?? 0) === 0) {
      await context.prisma.$executeRaw`
        UPDATE calls SET status = 'ENDED', ended_at = ${now}, updated_at = ${now} WHERE id = ${args.callId}
      `;

      if (callData.length > 0) {
        await context.pubsub.publish(
          `${CALL_ENDED}_${callData[0]!.channel_id}`,
          {
            callEnded: {
              callId: args.callId,
              channelId: callData[0]!.channel_id,
              endReason: 'COMPLETED',
              duration: null,
            },
          }
        );
      }
    }

    return {
      success: true,
      deletedId: participant.id as string,
      errors: [],
    };
  },

  /**
   * Invite users to a call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID and user IDs
   * @param context - GraphQL context
   * @returns Call payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   inviteToCall(callId: "call_123", userIds: ["user_456", "user_789"]) {
   *     call { id participants { user { id } } }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  inviteToCall: async (
    _parent: unknown,
    args: InviteToCallArgs,
    context: GraphQLContext
  ): Promise<CallPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get the call
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return createCallErrorPayload('NOT_FOUND', 'Call not found');
    }

    const existingCall = callData[0]!;

    // Check if user is a participant
    const memberInfo = await getChannelMemberInfo(
      context,
      existingCall.channel_id as string
    );
    if (!memberInfo.isMember) {
      throw new GraphQLError('You must be a channel member to invite users', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Invite users
    const now = new Date();
    for (const userId of args.userIds) {
      // Check if already a participant
      const existing = (await context.prisma.$queryRaw`
        SELECT id FROM call_participants WHERE call_id = ${args.callId} AND user_id = ${userId} LIMIT 1
      `) as Array<{ id: string }>;

      if (existing.length === 0) {
        const participantId = `part_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await context.prisma.$executeRaw`
          INSERT INTO call_participants (id, call_id, user_id, status, role, is_muted, is_video_off, is_sharing_screen, is_hand_raised, created_at, updated_at)
          VALUES (${participantId}, ${args.callId}, ${userId}, 'INVITED', 'PARTICIPANT', false, false, false, false, ${now}, ${now})
        `;
      }
    }

    const call: Call = {
      id: args.callId,
      type: existingCall.type as CallTypeValue,
      status: existingCall.status as CallStatusValue,
      channelId: existingCall.channel_id as string,
      initiatorId: existingCall.initiator_id as string,
      roomId: existingCall.room_id as string | null,
      title: existingCall.title as string | null,
      isScheduled: existingCall.is_scheduled as boolean,
      scheduledStartAt: existingCall.scheduled_start_at as Date | null,
      startedAt: existingCall.started_at as Date | null,
      endedAt: null,
      settings:
        (existingCall.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (existingCall.metadata as Record<string, unknown>) ?? {},
      createdAt: existingCall.created_at as Date,
      updatedAt: existingCall.updated_at as Date,
    };

    return createCallSuccessPayload(call);
  },

  /**
   * Mute a participant's audio or video
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID, participant ID, and track type
   * @param context - GraphQL context
   * @returns Call payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   muteParticipant(callId: "call_123", participantId: "part_456", trackType: AUDIO) {
   *     call { id }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  muteParticipant: async (
    _parent: unknown,
    args: MuteParticipantArgs,
    context: GraphQLContext
  ): Promise<CallPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user can manage the call
    const canManage = await canManageCall(context, args.callId);
    if (!canManage) {
      throw new GraphQLError(
        'You do not have permission to mute participants',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Update participant
    const now = new Date();
    if (args.trackType === 'AUDIO') {
      await context.prisma.$executeRaw`
        UPDATE call_participants SET is_muted = true, updated_at = ${now} WHERE id = ${args.participantId}
      `;
    } else {
      await context.prisma.$executeRaw`
        UPDATE call_participants SET is_video_off = true, updated_at = ${now} WHERE id = ${args.participantId}
      `;
    }

    // Get call for response
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return createCallErrorPayload('NOT_FOUND', 'Call not found');
    }

    const existingCall = callData[0]!;
    const call: Call = {
      id: args.callId,
      type: existingCall.type as CallTypeValue,
      status: existingCall.status as CallStatusValue,
      channelId: existingCall.channel_id as string,
      initiatorId: existingCall.initiator_id as string,
      roomId: existingCall.room_id as string | null,
      title: existingCall.title as string | null,
      isScheduled: existingCall.is_scheduled as boolean,
      scheduledStartAt: existingCall.scheduled_start_at as Date | null,
      startedAt: existingCall.started_at as Date | null,
      endedAt: existingCall.ended_at as Date | null,
      settings:
        (existingCall.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS,
      metadata: (existingCall.metadata as Record<string, unknown>) ?? {},
      createdAt: existingCall.created_at as Date,
      updatedAt: existingCall.updated_at as Date,
    };

    // Publish participant updated event
    await context.pubsub.publish(`${PARTICIPANT_UPDATED}_${args.callId}`, {
      participantUpdated: {
        callId: args.callId,
        participantId: args.participantId,
        changes: {
          [args.trackType === 'AUDIO' ? 'isMuted' : 'isVideoOff']: true,
        },
      },
    });

    return createCallSuccessPayload(call);
  },

  /**
   * Remove a participant from a call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID and participant ID
   * @param context - GraphQL context
   * @returns Delete payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   removeParticipant(callId: "call_123", participantId: "part_456") {
   *     success
   *     errors { code message }
   *   }
   * }
   * ```
   */
  removeParticipant: async (
    _parent: unknown,
    args: RemoveParticipantArgs,
    context: GraphQLContext
  ): Promise<CallDeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user can manage the call
    const canManage = await canManageCall(context, args.callId);
    if (!canManage) {
      throw new GraphQLError(
        'You do not have permission to remove participants',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Get participant info
    const participantData = (await context.prisma.$queryRaw`
      SELECT user_id FROM call_participants WHERE id = ${args.participantId} LIMIT 1
    `) as Array<{ user_id: string }>;

    if (participantData.length === 0) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Participant not found' }],
      };
    }

    // Update participant status
    const now = new Date();
    await context.prisma.$executeRaw`
      UPDATE call_participants
      SET status = 'LEFT', left_at = ${now}, updated_at = ${now}
      WHERE id = ${args.participantId}
    `;

    // Publish participant left event
    await context.pubsub.publish(`${PARTICIPANT_LEFT}_${args.callId}`, {
      participantLeft: {
        callId: args.callId,
        participantId: args.participantId,
        userId: participantData[0]!.user_id,
        reason: 'KICKED',
      },
    });

    return {
      success: true,
      deletedId: args.participantId,
      errors: [],
    };
  },

  /**
   * Create a new huddle
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with huddle input
   * @param context - GraphQL context
   * @returns Huddle payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   createHuddle(input: { workspaceId: "ws_123", title: "Quick sync" }) {
   *     huddle { id roomId status }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  createHuddle: async (
    _parent: unknown,
    args: CreateHuddleArgs,
    context: GraphQLContext
  ): Promise<HuddlePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Check workspace membership
    const isMember = await isWorkspaceMember(context, input.workspaceId);
    if (!isMember) {
      throw new GraphQLError(
        'You must be a workspace member to create a huddle',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Generate room ID
    const roomId = generateRoomId();
    const huddleId = `huddle_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date();

    // Create the huddle
    await context.prisma.$executeRaw`
      INSERT INTO huddles (id, workspace_id, channel_id, creator_id, title, status, room_id, is_audio_only, max_participants, started_at, created_at, updated_at)
      VALUES (${huddleId}, ${input.workspaceId}, ${input.channelId ?? null}, ${context.user.id}, ${input.title ?? null}, 'ACTIVE', ${roomId}, ${input.isAudioOnly ?? false}, ${input.maxParticipants ?? 10}, ${now}, ${now}, ${now})
    `;

    // Add creator as participant
    const participantId = `hpart_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await context.prisma.$executeRaw`
      INSERT INTO huddle_participants (id, huddle_id, user_id, is_muted, is_video_off, is_speaking, joined_at, created_at, updated_at)
      VALUES (${participantId}, ${huddleId}, ${context.user.id}, false, ${input.isAudioOnly ?? false}, false, ${now}, ${now}, ${now})
    `;

    const huddle: Huddle = {
      id: huddleId,
      workspaceId: input.workspaceId,
      channelId: input.channelId ?? null,
      creatorId: context.user.id,
      title: input.title ?? null,
      status: 'ACTIVE',
      roomId,
      isAudioOnly: input.isAudioOnly ?? false,
      maxParticipants: input.maxParticipants ?? 10,
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Publish huddle updated event
    await context.pubsub.publish(`${HUDDLE_UPDATED}_${input.workspaceId}`, {
      huddleUpdated: {
        huddle,
        updateType: 'PARTICIPANT_JOINED',
        participantCount: 1,
      },
    });

    return createHuddleSuccessPayload(huddle);
  },

  /**
   * Join a huddle
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with huddle ID
   * @param context - GraphQL context
   * @returns Huddle payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   joinHuddle(huddleId: "huddle_123") {
   *     huddle { id participantCount }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  joinHuddle: async (
    _parent: unknown,
    args: JoinHuddleArgs,
    context: GraphQLContext
  ): Promise<HuddlePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get huddle
    const huddleData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles WHERE id = ${args.huddleId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (huddleData.length === 0) {
      return createHuddleErrorPayload('NOT_FOUND', 'Huddle not found');
    }

    const existingHuddle = huddleData[0]!;

    if (existingHuddle.status !== 'ACTIVE') {
      return createHuddleErrorPayload('BAD_USER_INPUT', 'Huddle is not active');
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(
      context,
      existingHuddle.workspace_id as string
    );
    if (!isMember) {
      throw new GraphQLError(
        'You must be a workspace member to join this huddle',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Check participant count
    const participantCount = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM huddle_participants
      WHERE huddle_id = ${args.huddleId} AND left_at IS NULL
    `) as Array<{ count: bigint }>;

    if (
      Number(participantCount[0]?.count ?? 0) >=
      (existingHuddle.max_participants as number)
    ) {
      return createHuddleErrorPayload('FORBIDDEN', 'Huddle is full');
    }

    // Check if already a participant
    const existingParticipant = (await context.prisma.$queryRaw`
      SELECT id FROM huddle_participants
      WHERE huddle_id = ${args.huddleId} AND user_id = ${context.user.id}
      LIMIT 1
    `) as Array<{ id: string }>;

    const now = new Date();
    if (existingParticipant.length > 0) {
      // Rejoin
      await context.prisma.$executeRaw`
        UPDATE huddle_participants
        SET left_at = NULL, joined_at = ${now}, updated_at = ${now}
        WHERE id = ${existingParticipant[0]!.id}
      `;
    } else {
      // New participant
      const participantId = `hpart_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      await context.prisma.$executeRaw`
        INSERT INTO huddle_participants (id, huddle_id, user_id, is_muted, is_video_off, is_speaking, joined_at, created_at, updated_at)
        VALUES (${participantId}, ${args.huddleId}, ${context.user.id}, false, ${existingHuddle.is_audio_only}, false, ${now}, ${now}, ${now})
      `;
    }

    // Get updated participant count
    const newCount = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM huddle_participants
      WHERE huddle_id = ${args.huddleId} AND left_at IS NULL
    `) as Array<{ count: bigint }>;

    const huddle: Huddle = {
      id: args.huddleId,
      workspaceId: existingHuddle.workspace_id as string,
      channelId: existingHuddle.channel_id as string | null,
      creatorId: existingHuddle.creator_id as string,
      title: existingHuddle.title as string | null,
      status: 'ACTIVE',
      roomId: existingHuddle.room_id as string,
      isAudioOnly: existingHuddle.is_audio_only as boolean,
      maxParticipants: existingHuddle.max_participants as number,
      startedAt: existingHuddle.started_at as Date,
      endedAt: null,
      createdAt: existingHuddle.created_at as Date,
      updatedAt: now,
    };

    // Publish huddle updated event
    await context.pubsub.publish(
      `${HUDDLE_UPDATED}_${existingHuddle.workspace_id}`,
      {
        huddleUpdated: {
          huddle,
          updateType: 'PARTICIPANT_JOINED',
          participantCount: Number(newCount[0]?.count ?? 0),
        },
      }
    );

    return createHuddleSuccessPayload(huddle);
  },

  /**
   * Leave a huddle
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with huddle ID
   * @param context - GraphQL context
   * @returns Huddle payload
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * mutation {
   *   leaveHuddle(huddleId: "huddle_123") {
   *     huddle { id participantCount }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  leaveHuddle: async (
    _parent: unknown,
    args: LeaveHuddleArgs,
    context: GraphQLContext
  ): Promise<HuddlePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get huddle
    const huddleData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles WHERE id = ${args.huddleId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (huddleData.length === 0) {
      return createHuddleErrorPayload('NOT_FOUND', 'Huddle not found');
    }

    const existingHuddle = huddleData[0]!;

    // Update participant
    const now = new Date();
    await context.prisma.$executeRaw`
      UPDATE huddle_participants
      SET left_at = ${now}, updated_at = ${now}
      WHERE huddle_id = ${args.huddleId} AND user_id = ${context.user.id}
    `;

    // Get updated participant count
    const newCount = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM huddle_participants
      WHERE huddle_id = ${args.huddleId} AND left_at IS NULL
    `) as Array<{ count: bigint }>;

    const participantCount = Number(newCount[0]?.count ?? 0);

    // End huddle if no participants left
    if (participantCount === 0) {
      await context.prisma.$executeRaw`
        UPDATE huddles SET status = 'ENDED', ended_at = ${now}, updated_at = ${now} WHERE id = ${args.huddleId}
      `;
    }

    const huddle: Huddle = {
      id: args.huddleId,
      workspaceId: existingHuddle.workspace_id as string,
      channelId: existingHuddle.channel_id as string | null,
      creatorId: existingHuddle.creator_id as string,
      title: existingHuddle.title as string | null,
      status: participantCount === 0 ? 'ENDED' : 'ACTIVE',
      roomId: existingHuddle.room_id as string,
      isAudioOnly: existingHuddle.is_audio_only as boolean,
      maxParticipants: existingHuddle.max_participants as number,
      startedAt: existingHuddle.started_at as Date,
      endedAt: participantCount === 0 ? now : null,
      createdAt: existingHuddle.created_at as Date,
      updatedAt: now,
    };

    // Publish huddle updated event
    await context.pubsub.publish(
      `${HUDDLE_UPDATED}_${existingHuddle.workspace_id}`,
      {
        huddleUpdated: {
          huddle,
          updateType: participantCount === 0 ? 'ENDED' : 'PARTICIPANT_LEFT',
          participantCount,
        },
      }
    );

    return createHuddleSuccessPayload(huddle);
  },

  /**
   * Delete a huddle
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with huddle ID
   * @param context - GraphQL context
   * @returns Delete payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteHuddle(huddleId: "huddle_123") {
   *     success
   *     deletedId
   *     errors { code message }
   *   }
   * }
   * ```
   */
  deleteHuddle: async (
    _parent: unknown,
    args: DeleteHuddleArgs,
    context: GraphQLContext
  ): Promise<CallDeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get huddle
    const huddleData = (await context.prisma.$queryRaw`
      SELECT * FROM huddles WHERE id = ${args.huddleId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (huddleData.length === 0) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Huddle not found' }],
      };
    }

    const existingHuddle = huddleData[0]!;

    // Only creator or system admin can delete
    if (
      existingHuddle.creator_id !== context.user.id &&
      !isSystemAdmin(context)
    ) {
      throw new GraphQLError('Only the huddle creator can delete the huddle', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // End huddle if active
    const now = new Date();
    if (existingHuddle.status === 'ACTIVE') {
      await context.prisma.$executeRaw`
        UPDATE huddles SET status = 'ENDED', ended_at = ${now}, updated_at = ${now} WHERE id = ${args.huddleId}
      `;
    }

    // Update all participants
    await context.prisma.$executeRaw`
      UPDATE huddle_participants SET left_at = ${now}, updated_at = ${now} WHERE huddle_id = ${args.huddleId} AND left_at IS NULL
    `;

    // Publish huddle updated event
    await context.pubsub.publish(
      `${HUDDLE_UPDATED}_${existingHuddle.workspace_id}`,
      {
        huddleUpdated: {
          huddle: {
            id: args.huddleId,
            workspaceId: existingHuddle.workspace_id,
            status: 'ENDED',
          },
          updateType: 'ENDED',
          participantCount: 0,
        },
      }
    );

    return {
      success: true,
      deletedId: args.huddleId,
      errors: [],
    };
  },

  /**
   * Start recording a call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID
   * @param context - GraphQL context
   * @returns Recording payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   startRecording(callId: "call_123") {
   *     recording { id status }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  startRecording: async (
    _parent: unknown,
    args: StartRecordingArgs,
    context: GraphQLContext
  ): Promise<RecordingPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user can manage the call
    const canManage = await canManageCall(context, args.callId);
    if (!canManage) {
      throw new GraphQLError('You do not have permission to start recording', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get call
    const callData = (await context.prisma.$queryRaw`
      SELECT * FROM calls WHERE id = ${args.callId} LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (callData.length === 0) {
      return {
        recording: null,
        errors: [{ code: 'NOT_FOUND', message: 'Call not found' }],
      };
    }

    const call = callData[0]!;
    const settings = (call.settings as CallSettings) ?? DEFAULT_CALL_SETTINGS;

    if (!settings.allowRecording) {
      return {
        recording: null,
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'Recording is not allowed for this call',
          },
        ],
      };
    }

    // Check if already recording
    const existingRecording = (await context.prisma.$queryRaw`
      SELECT id FROM call_recordings WHERE call_id = ${args.callId} AND status IN ('STARTING', 'RECORDING')
      LIMIT 1
    `) as Array<{ id: string }>;

    if (existingRecording.length > 0) {
      return {
        recording: null,
        errors: [
          { code: 'CONFLICT', message: 'Recording is already in progress' },
        ],
      };
    }

    const now = new Date();
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const recordingSettings = {
      resolution: '1080p',
      videoBitrate: 3000,
      audioBitrate: 128,
      compositeMode: true,
      layout: 'grid',
    };

    // Create recording record
    await context.prisma.$executeRaw`
      INSERT INTO call_recordings (id, call_id, status, started_by_id, started_at, format, settings, created_at, updated_at)
      VALUES (${recordingId}, ${args.callId}, 'STARTING', ${context.user.id}, ${now}, 'mp4', ${JSON.stringify(recordingSettings)}::jsonb, ${now}, ${now})
    `;

    // Start actual recording if call service is available
    if (context.callService && call.room_id) {
      try {
        await context.callService.startRecording(
          call.room_id as string,
          recordingSettings
        );
        await context.prisma.$executeRaw`
          UPDATE call_recordings SET status = 'RECORDING', updated_at = ${new Date()} WHERE id = ${recordingId}
        `;
      } catch (error) {
        await context.prisma.$executeRaw`
          UPDATE call_recordings SET status = 'FAILED', updated_at = ${new Date()} WHERE id = ${recordingId}
        `;
        return {
          recording: null,
          errors: [
            { code: 'INTERNAL_ERROR', message: 'Failed to start recording' },
          ],
        };
      }
    }

    const recording: CallRecording = {
      id: recordingId,
      callId: args.callId,
      status: 'RECORDING',
      startedById: context.user.id,
      startedAt: now,
      endedAt: null,
      duration: null,
      fileSize: null,
      fileUrl: null,
      format: 'mp4',
      settings: recordingSettings,
    };

    // Publish recording status event
    await context.pubsub.publish(`${RECORDING_STATUS_CHANGED}_${args.callId}`, {
      recordingStatusChanged: recording,
    });

    return { recording, errors: [] };
  },

  /**
   * Stop recording a call
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with call ID
   * @param context - GraphQL context
   * @returns Recording payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   stopRecording(callId: "call_123") {
   *     recording { id status duration fileUrl }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  stopRecording: async (
    _parent: unknown,
    args: StopRecordingArgs,
    context: GraphQLContext
  ): Promise<RecordingPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check if user can manage the call
    const canManage = await canManageCall(context, args.callId);
    if (!canManage) {
      throw new GraphQLError('You do not have permission to stop recording', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get active recording
    const recordingData = (await context.prisma.$queryRaw`
      SELECT * FROM call_recordings
      WHERE call_id = ${args.callId} AND status IN ('STARTING', 'RECORDING')
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (recordingData.length === 0) {
      return {
        recording: null,
        errors: [{ code: 'NOT_FOUND', message: 'No active recording found' }],
      };
    }

    const existingRecording = recordingData[0]!;
    const now = new Date();
    const duration = Math.round(
      (now.getTime() - (existingRecording.started_at as Date).getTime()) / 1000
    );

    // Stop actual recording if call service is available
    if (context.callService) {
      try {
        await context.callService.stopRecording(existingRecording.id as string);
      } catch (error) {
        // Log but continue
        console.error('Failed to stop WebRTC recording:', error);
      }
    }

    // Update recording record
    await context.prisma.$executeRaw`
      UPDATE call_recordings
      SET status = 'COMPLETED', ended_at = ${now}, duration = ${duration}, updated_at = ${now}
      WHERE id = ${existingRecording.id}
    `;

    const recording: CallRecording = {
      id: existingRecording.id as string,
      callId: args.callId,
      status: 'COMPLETED',
      startedById: existingRecording.started_by_id as string,
      startedAt: existingRecording.started_at as Date,
      endedAt: now,
      duration,
      fileSize: existingRecording.file_size as number | null,
      fileUrl: existingRecording.file_url as string | null,
      format: existingRecording.format as string,
      settings: existingRecording.settings as CallRecording['settings'],
    };

    // Publish recording status event
    await context.pubsub.publish(`${RECORDING_STATUS_CHANGED}_${args.callId}`, {
      recordingStatusChanged: recording,
    });

    return { recording, errors: [] };
  },
};

// =============================================================================
// CALL SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Call Subscription resolvers
 */
export const callSubscriptions = {
  /**
   * Subscribe to new calls in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   callStarted(channelId: "ch_123") {
   *     call { id type status }
   *     initiator { displayName }
   *   }
   * }
   * ```
   */
  callStarted: {
    subscribe: async (
      _parent: unknown,
      args: CallStartedSubArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify channel access
      const memberInfo = await getChannelMemberInfo(context, args.channelId);
      if (!memberInfo.isMember) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(`${CALL_STARTED}_${args.channelId}`);
    },
  },

  /**
   * Subscribe to call ended events in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   callEnded(channelId: "ch_123") {
   *     callId
   *     endReason
   *     duration
   *   }
   * }
   * ```
   */
  callEnded: {
    subscribe: async (
      _parent: unknown,
      args: CallEndedSubArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const memberInfo = await getChannelMemberInfo(context, args.channelId);
      if (!memberInfo.isMember) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(`${CALL_ENDED}_${args.channelId}`);
    },
  },

  /**
   * Subscribe to participant joined events for a call
   *
   * @example
   * ```graphql
   * subscription {
   *   participantJoined(callId: "call_123") {
   *     participant { id role isMuted }
   *     user { displayName avatarUrl }
   *   }
   * }
   * ```
   */
  participantJoined: {
    subscribe: async (
      _parent: unknown,
      args: ParticipantJoinedSubArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify call access
      const callData = (await context.prisma.$queryRaw`
        SELECT channel_id FROM calls WHERE id = ${args.callId} LIMIT 1
      `) as Array<{ channel_id: string }>;

      if (callData.length === 0) {
        throw new GraphQLError('Call not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const memberInfo = await getChannelMemberInfo(
        context,
        callData[0]!.channel_id
      );
      if (!memberInfo.isMember) {
        throw new GraphQLError('Access denied to this call', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${PARTICIPANT_JOINED}_${args.callId}`
      );
    },
  },

  /**
   * Subscribe to participant left events for a call
   *
   * @example
   * ```graphql
   * subscription {
   *   participantLeft(callId: "call_123") {
   *     participantId
   *     userId
   *     reason
   *   }
   * }
   * ```
   */
  participantLeft: {
    subscribe: async (
      _parent: unknown,
      args: ParticipantLeftSubArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const callData = (await context.prisma.$queryRaw`
        SELECT channel_id FROM calls WHERE id = ${args.callId} LIMIT 1
      `) as Array<{ channel_id: string }>;

      if (callData.length === 0) {
        throw new GraphQLError('Call not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const memberInfo = await getChannelMemberInfo(
        context,
        callData[0]!.channel_id
      );
      if (!memberInfo.isMember) {
        throw new GraphQLError('Access denied to this call', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(`${PARTICIPANT_LEFT}_${args.callId}`);
    },
  },

  /**
   * Subscribe to huddle updates in a workspace
   *
   * @example
   * ```graphql
   * subscription {
   *   huddleUpdated(workspaceId: "ws_123") {
   *     huddle { id title status }
   *     updateType
   *     participantCount
   *   }
   * }
   * ```
   */
  huddleUpdated: {
    subscribe: async (
      _parent: unknown,
      args: HuddleUpdatedSubArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify workspace access
      const isMember = await isWorkspaceMember(context, args.workspaceId);
      if (!isMember) {
        throw new GraphQLError('Access denied to this workspace', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${HUDDLE_UPDATED}_${args.workspaceId}`
      );
    },
  },
};

// =============================================================================
// CALL FIELD RESOLVERS
// =============================================================================

/**
 * Call field resolvers for nested types
 */
export const CallFieldResolvers = {
  /**
   * Resolve channel for a call
   *
   * @param parent - The parent Call object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The channel
   */
  channel: async (parent: Call, _args: unknown, context: GraphQLContext) => {
    return context.prisma.channel.findUnique({
      where: { id: parent.channelId },
    });
  },

  /**
   * Resolve participants for a call
   *
   * @param parent - The parent Call object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of call participants
   */
  participants: async (
    parent: Call,
    _args: unknown,
    context: GraphQLContext
  ): Promise<CallParticipant[]> => {
    const participants = (await context.prisma.$queryRaw`
      SELECT * FROM call_participants WHERE call_id = ${parent.id} ORDER BY joined_at ASC
    `) as Array<Record<string, unknown>>;

    return participants.map(p => ({
      id: p.id as string,
      callId: parent.id,
      userId: p.user_id as string,
      status: p.status as ParticipantStatusValue,
      isMuted: p.is_muted as boolean,
      isVideoOff: p.is_video_off as boolean,
      isSharingScreen: p.is_sharing_screen as boolean,
      isHandRaised: p.is_hand_raised as boolean,
      role: p.role as 'HOST' | 'CO_HOST' | 'PARTICIPANT',
      joinedAt: p.joined_at as Date | null,
      leftAt: p.left_at as Date | null,
      deviceInfo: p.device_info as CallParticipant['deviceInfo'],
    }));
  },

  /**
   * Resolve initiator for a call
   *
   * @param parent - The parent Call object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The initiator user
   */
  initiator: async (parent: Call, _args: unknown, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { id: parent.initiatorId },
    });
  },

  /**
   * Resolve recording for a call
   *
   * @param parent - The parent Call object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The active or most recent recording
   */
  recording: async (
    parent: Call,
    _args: unknown,
    context: GraphQLContext
  ): Promise<CallRecording | null> => {
    const recordings = (await context.prisma.$queryRaw`
      SELECT * FROM call_recordings
      WHERE call_id = ${parent.id}
      ORDER BY started_at DESC
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (recordings.length === 0) {
      return null;
    }

    const r = recordings[0]!;
    return {
      id: r.id as string,
      callId: parent.id,
      status: r.status as RecordingStatusValue,
      startedById: r.started_by_id as string,
      startedAt: r.started_at as Date,
      endedAt: r.ended_at as Date | null,
      duration: r.duration as number | null,
      fileSize: r.file_size as number | null,
      fileUrl: r.file_url as string | null,
      format: r.format as string,
      settings: r.settings as CallRecording['settings'],
    };
  },

  /**
   * Calculate call duration
   *
   * @param parent - The parent Call object
   * @returns Duration in seconds or null if not started/ended
   */
  duration: (parent: Call): number | null => {
    if (!parent.startedAt) {
      return null;
    }
    const endTime = parent.endedAt ?? new Date();
    return Math.round((endTime.getTime() - parent.startedAt.getTime()) / 1000);
  },
};

/**
 * Huddle field resolvers for nested types
 */
export const HuddleFieldResolvers = {
  /**
   * Resolve workspace for a huddle
   *
   * @param parent - The parent Huddle object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The workspace
   */
  workspace: async (
    parent: Huddle,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });
  },

  /**
   * Resolve creator for a huddle
   *
   * @param parent - The parent Huddle object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The creator user
   */
  creator: async (parent: Huddle, _args: unknown, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { id: parent.creatorId },
    });
  },

  /**
   * Resolve participants for a huddle
   *
   * @param parent - The parent Huddle object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of huddle participants
   */
  participants: async (
    parent: Huddle,
    _args: unknown,
    context: GraphQLContext
  ): Promise<HuddleParticipant[]> => {
    const participants = (await context.prisma.$queryRaw`
      SELECT * FROM huddle_participants
      WHERE huddle_id = ${parent.id} AND left_at IS NULL
      ORDER BY joined_at ASC
    `) as Array<Record<string, unknown>>;

    return participants.map(p => ({
      id: p.id as string,
      huddleId: parent.id,
      userId: p.user_id as string,
      isMuted: p.is_muted as boolean,
      isVideoOff: p.is_video_off as boolean,
      isSpeaking: p.is_speaking as boolean,
      joinedAt: p.joined_at as Date,
      leftAt: p.left_at as Date | null,
    }));
  },

  /**
   * Count active participants in a huddle
   *
   * @param parent - The parent Huddle object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Number of active participants
   */
  participantCount: async (
    parent: Huddle,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    const result = (await context.prisma.$queryRaw`
      SELECT COUNT(*) as count FROM huddle_participants
      WHERE huddle_id = ${parent.id} AND left_at IS NULL
    `) as Array<{ count: bigint }>;

    return Number(result[0]?.count ?? 0);
  },
};

// =============================================================================
// COMBINED CALL RESOLVERS
// =============================================================================

/**
 * Combined call resolvers object for use with graphql-tools
 */
export const callResolvers = {
  Query: callQueries,
  Mutation: callMutations,
  Subscription: callSubscriptions,
  Call: CallFieldResolvers,
  Huddle: HuddleFieldResolvers,
};

export default callResolvers;
