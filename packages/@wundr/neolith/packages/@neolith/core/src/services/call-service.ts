/**
 * @genesis/core - Call Service
 *
 * High-level call and huddle management service built on top of LiveKit.
 * Provides business logic for voice/video calls and persistent huddle rooms
 * with integration to the Genesis App data model.
 *
 * @packageDocumentation
 */

import { createId } from '@paralleldrive/cuid2';

import { GenesisError } from '../errors';
import {
  createLiveKitServiceFromEnv,
  LiveKitError,
  RoomNotFoundError,
} from './livekit-service';

import type { LiveKitServiceImpl } from './livekit-service';
import type { Participant, RecordingOptions } from '../types/livekit';

// =============================================================================
// Types
// =============================================================================

/**
 * Call types supported by the service.
 */
export type CallType = 'audio' | 'video' | 'screen_share';

/**
 * Call status.
 */
export type CallStatus = 'pending' | 'active' | 'ended' | 'failed';

/**
 * Huddle status.
 */
export type HuddleStatus = 'active' | 'inactive' | 'archived';

/**
 * Represents a call in the system.
 */
export interface Call {
  /** Unique call ID */
  id: string;

  /** Channel ID where the call is happening */
  channelId: string;

  /** Workspace ID */
  workspaceId?: string;

  /** Call type */
  type: CallType;

  /** Current status */
  status: CallStatus;

  /** LiveKit room name */
  roomName: string;

  /** LiveKit room SID */
  roomSid?: string;

  /** Call initiator user ID */
  initiatorId: string;

  /** Current participants */
  participantIds: string[];

  /** Call start time */
  startedAt: Date;

  /** Call end time */
  endedAt?: Date;

  /** Recording egress IDs */
  recordingIds?: string[];

  /** Call metadata */
  metadata?: CallMetadata;
}

/**
 * Call metadata.
 */
export interface CallMetadata {
  /** Call title/subject */
  title?: string;

  /** Call description */
  description?: string;

  /** Whether recording is enabled */
  recordingEnabled?: boolean;

  /** Maximum allowed participants */
  maxParticipants?: number;

  /** Custom data */
  custom?: Record<string, unknown>;
}

/**
 * Options for creating a call.
 */
export interface CreateCallOptions {
  /** Call type */
  type: CallType;

  /** Call initiator user ID */
  initiatorId: string;

  /** Optional metadata */
  metadata?: CallMetadata;

  /** Workspace ID */
  workspaceId?: string;
}

/**
 * Represents a persistent huddle room.
 */
export interface Huddle {
  /** Unique huddle ID */
  id: string;

  /** Workspace ID */
  workspaceId: string;

  /** Huddle name */
  name: string;

  /** Huddle description */
  description?: string;

  /** LiveKit room name */
  roomName: string;

  /** Current status */
  status: HuddleStatus;

  /** Current participants */
  participantIds: string[];

  /** Creator user ID */
  creatorId: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last activity timestamp */
  lastActivityAt: Date;

  /** Huddle metadata */
  metadata?: HuddleMetadata;
}

/**
 * Huddle metadata.
 */
export interface HuddleMetadata {
  /** Topic of discussion */
  topic?: string;

  /** Whether huddle is public */
  isPublic?: boolean;

  /** Maximum participants */
  maxParticipants?: number;

  /** Associated channel IDs */
  channelIds?: string[];

  /** Custom data */
  custom?: Record<string, unknown>;
}

/**
 * Options for creating a huddle.
 */
export interface HuddleOptions {
  /** Huddle name */
  name: string;

  /** Description */
  description?: string;

  /** Creator user ID */
  creatorId: string;

  /** Metadata */
  metadata?: HuddleMetadata;
}

/**
 * Result of joining a call or huddle.
 */
export interface JoinToken {
  /** JWT token for LiveKit */
  token: string;

  /** LiveKit server URL */
  serverUrl: string;

  /** Room name */
  roomName: string;

  /** Token expiration */
  expiresAt: Date;
}

/**
 * Call history query options.
 */
export interface HistoryOptions {
  /** Number of calls to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Filter by status */
  status?: CallStatus;

  /** Filter by type */
  type?: CallType;

  /** Start date filter */
  startDate?: Date;

  /** End date filter */
  endDate?: Date;
}

/**
 * Paginated call result.
 */
export interface PaginatedCallResult {
  /** Calls */
  calls: Call[];

  /** Total count */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;
}

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a call is not found.
 */
export class CallNotFoundError extends GenesisError {
  constructor(callId: string) {
    super(`Call not found: ${callId}`, 'CALL_NOT_FOUND', 404, { callId });
    this.name = 'CallNotFoundError';
  }
}

/**
 * Error thrown when there's already an active call.
 */
export class ActiveCallExistsError extends GenesisError {
  constructor(channelId: string) {
    super(
      `An active call already exists in channel: ${channelId}`,
      'ACTIVE_CALL_EXISTS',
      409,
      { channelId }
    );
    this.name = 'ActiveCallExistsError';
  }
}

/**
 * Error thrown when a huddle is not found.
 */
export class HuddleNotFoundError extends GenesisError {
  constructor(huddleId: string) {
    super(`Huddle not found: ${huddleId}`, 'HUDDLE_NOT_FOUND', 404, {
      huddleId,
    });
    this.name = 'HuddleNotFoundError';
  }
}

/**
 * Error thrown for call operation failures.
 */
export class CallOperationError extends GenesisError {
  constructor(operation: string, reason: string) {
    super(
      `Call operation '${operation}' failed: ${reason}`,
      'CALL_OPERATION_ERROR',
      500,
      { operation, reason }
    );
    this.name = 'CallOperationError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for call and huddle management operations.
 */
export interface CallService {
  // ==========================================================================
  // Call Management
  // ==========================================================================

  /**
   * Creates a new call in a channel.
   *
   * @param channelId - Channel to start the call in
   * @param options - Call creation options
   * @returns The created call
   * @throws {ActiveCallExistsError} If there's already an active call
   */
  createCall(channelId: string, options: CreateCallOptions): Promise<Call>;

  /**
   * Ends an active call.
   *
   * @param callId - Call ID to end
   * @throws {CallNotFoundError} If call doesn't exist
   */
  endCall(callId: string): Promise<void>;

  /**
   * Gets a call by ID.
   *
   * @param callId - Call ID
   * @returns The call or null if not found
   */
  getCall(callId: string): Promise<Call | null>;

  /**
   * Gets the active call in a channel.
   *
   * @param channelId - Channel ID
   * @returns The active call or null if none
   */
  getActiveCall(channelId: string): Promise<Call | null>;

  /**
   * Joins a call and gets a token.
   *
   * @param callId - Call ID to join
   * @param userId - User joining the call
   * @param name - Display name
   * @returns Join token with LiveKit credentials
   */
  joinCall(callId: string, userId: string, name?: string): Promise<JoinToken>;

  /**
   * Leaves a call.
   *
   * @param callId - Call ID
   * @param userId - User leaving
   */
  leaveCall(callId: string, userId: string): Promise<void>;

  /**
   * Gets participants in a call.
   *
   * @param callId - Call ID
   * @returns Array of participants
   */
  getCallParticipants(callId: string): Promise<Participant[]>;

  // ==========================================================================
  // Huddle Management
  // ==========================================================================

  /**
   * Creates a persistent huddle room.
   *
   * @param workspaceId - Workspace to create huddle in
   * @param options - Huddle creation options
   * @returns The created huddle
   */
  createHuddle(workspaceId: string, options: HuddleOptions): Promise<Huddle>;

  /**
   * Gets a huddle by ID.
   *
   * @param huddleId - Huddle ID
   * @returns The huddle or null if not found
   */
  getHuddle(huddleId: string): Promise<Huddle | null>;

  /**
   * Joins a huddle and gets a token.
   *
   * @param huddleId - Huddle ID to join
   * @param userId - User joining
   * @param name - Display name
   * @returns Join token with LiveKit credentials
   */
  joinHuddle(
    huddleId: string,
    userId: string,
    name?: string
  ): Promise<JoinToken>;

  /**
   * Leaves a huddle.
   *
   * @param huddleId - Huddle ID
   * @param userId - User leaving
   */
  leaveHuddle(huddleId: string, userId: string): Promise<void>;

  /**
   * Lists active huddles in a workspace.
   *
   * @param workspaceId - Workspace ID
   * @returns Array of active huddles
   */
  listHuddles(workspaceId: string): Promise<Huddle[]>;

  /**
   * Archives a huddle (soft delete).
   *
   * @param huddleId - Huddle ID
   */
  archiveHuddle(huddleId: string): Promise<void>;

  // ==========================================================================
  // Recording
  // ==========================================================================

  /**
   * Starts recording a call.
   *
   * @param callId - Call ID
   * @param options - Recording options
   * @returns Egress ID
   */
  startRecording(callId: string, options?: RecordingOptions): Promise<string>;

  /**
   * Stops recording a call.
   *
   * @param callId - Call ID
   * @param egressId - Egress ID to stop
   */
  stopRecording(callId: string, egressId: string): Promise<void>;

  // ==========================================================================
  // History
  // ==========================================================================

  /**
   * Gets call history for a channel.
   *
   * @param channelId - Channel ID
   * @param options - History query options
   * @returns Paginated call history
   */
  getCallHistory(
    channelId: string,
    options?: HistoryOptions
  ): Promise<PaginatedCallResult>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Call service implementation.
 *
 * Note: This implementation uses in-memory storage for calls and huddles.
 * In production, these should be persisted to a database.
 */
export class CallServiceImpl implements CallService {
  private readonly liveKitService: LiveKitServiceImpl;
  private readonly calls: Map<string, Call> = new Map();
  private readonly huddles: Map<string, Huddle> = new Map();
  private readonly channelActiveCalls: Map<string, string> = new Map();

  /**
   * Creates a new CallServiceImpl instance.
   *
   * @param liveKitService - Optional LiveKit service instance
   */
  constructor(liveKitService?: LiveKitServiceImpl) {
    this.liveKitService = liveKitService ?? createLiveKitServiceFromEnv();
  }

  // ===========================================================================
  // Call Management
  // ===========================================================================

  /**
   * Creates a new call in a channel.
   */
  async createCall(
    channelId: string,
    options: CreateCallOptions
  ): Promise<Call> {
    // Check for existing active call
    const activeCallId = this.channelActiveCalls.get(channelId);
    if (activeCallId) {
      const activeCall = this.calls.get(activeCallId);
      if (activeCall && activeCall.status === 'active') {
        throw new ActiveCallExistsError(channelId);
      }
    }

    const callId = createId();
    const roomName = `call-${callId}`;

    try {
      // Create LiveKit room
      const room = await this.liveKitService.createRoom({
        name: roomName,
        maxParticipants: options.metadata?.maxParticipants ?? 50,
        metadata: JSON.stringify({
          callId,
          channelId,
          type: options.type,
        }),
      });

      const call: Call = {
        id: callId,
        channelId,
        workspaceId: options.workspaceId,
        type: options.type,
        status: 'active',
        roomName,
        roomSid: room.sid,
        initiatorId: options.initiatorId,
        participantIds: [],
        startedAt: new Date(),
        metadata: options.metadata,
      };

      this.calls.set(callId, call);
      this.channelActiveCalls.set(channelId, callId);

      return call;
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new CallOperationError(
        'createCall',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Ends an active call.
   */
  async endCall(callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    try {
      // Delete LiveKit room
      await this.liveKitService.deleteRoom(call.roomName);
    } catch (error) {
      // Room might already be deleted, continue
      this.logError('Failed to delete LiveKit room', error);
    }

    // Update call status
    call.status = 'ended';
    call.endedAt = new Date();

    // Remove from active calls
    this.channelActiveCalls.delete(call.channelId);
  }

  /**
   * Gets a call by ID.
   */
  async getCall(callId: string): Promise<Call | null> {
    return this.calls.get(callId) ?? null;
  }

  /**
   * Gets the active call in a channel.
   */
  async getActiveCall(channelId: string): Promise<Call | null> {
    const callId = this.channelActiveCalls.get(channelId);
    if (!callId) {
      return null;
    }

    const call = this.calls.get(callId);
    if (!call || call.status !== 'active') {
      this.channelActiveCalls.delete(channelId);
      return null;
    }

    return call;
  }

  /**
   * Joins a call and gets a token.
   */
  async joinCall(
    callId: string,
    userId: string,
    name?: string
  ): Promise<JoinToken> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    if (call.status !== 'active') {
      throw new CallOperationError('joinCall', 'Call is not active');
    }

    // Generate token
    const tokenResult = await this.liveKitService.generateToken(
      userId,
      call.roomName,
      {
        name,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      }
    );

    // Add participant if not already present
    if (!call.participantIds.includes(userId)) {
      call.participantIds.push(userId);
    }

    return {
      token: tokenResult.token,
      serverUrl: this.liveKitService.getServerUrl(),
      roomName: call.roomName,
      expiresAt: tokenResult.expiresAt,
    };
  }

  /**
   * Leaves a call.
   */
  async leaveCall(callId: string, userId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    // Remove participant
    call.participantIds = call.participantIds.filter(id => id !== userId);

    // Try to remove from LiveKit room
    try {
      await this.liveKitService.removeParticipant(call.roomName, userId);
    } catch (error) {
      // Participant might have already left
      this.logError('Failed to remove participant from LiveKit', error);
    }

    // End call if no participants left
    if (call.participantIds.length === 0 && call.status === 'active') {
      await this.endCall(callId);
    }
  }

  /**
   * Gets participants in a call.
   */
  async getCallParticipants(callId: string): Promise<Participant[]> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    try {
      return await this.liveKitService.listParticipants(call.roomName);
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        return [];
      }
      throw error;
    }
  }

  // ===========================================================================
  // Huddle Management
  // ===========================================================================

  /**
   * Creates a persistent huddle room.
   */
  async createHuddle(
    workspaceId: string,
    options: HuddleOptions
  ): Promise<Huddle> {
    const huddleId = createId();
    const roomName = `huddle-${huddleId}`;

    try {
      // Create LiveKit room with long timeout (huddles persist)
      await this.liveKitService.createRoom({
        name: roomName,
        emptyTimeout: 86400, // 24 hours
        maxParticipants: options.metadata?.maxParticipants ?? 25,
        metadata: JSON.stringify({
          huddleId,
          workspaceId,
          name: options.name,
        }),
      });

      const huddle: Huddle = {
        id: huddleId,
        workspaceId,
        name: options.name,
        description: options.description,
        roomName,
        status: 'active',
        participantIds: [],
        creatorId: options.creatorId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        metadata: options.metadata,
      };

      this.huddles.set(huddleId, huddle);

      return huddle;
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new CallOperationError(
        'createHuddle',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Gets a huddle by ID.
   */
  async getHuddle(huddleId: string): Promise<Huddle | null> {
    return this.huddles.get(huddleId) ?? null;
  }

  /**
   * Joins a huddle and gets a token.
   */
  async joinHuddle(
    huddleId: string,
    userId: string,
    name?: string
  ): Promise<JoinToken> {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) {
      throw new HuddleNotFoundError(huddleId);
    }

    if (huddle.status !== 'active') {
      throw new CallOperationError('joinHuddle', 'Huddle is not active');
    }

    // Check if LiveKit room exists, recreate if needed
    const room = await this.liveKitService.getRoom(huddle.roomName);
    if (!room) {
      await this.liveKitService.createRoom({
        name: huddle.roomName,
        emptyTimeout: 86400,
        maxParticipants: huddle.metadata?.maxParticipants ?? 25,
      });
    }

    // Generate token
    const tokenResult = await this.liveKitService.generateToken(
      userId,
      huddle.roomName,
      {
        name,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      }
    );

    // Add participant if not already present
    if (!huddle.participantIds.includes(userId)) {
      huddle.participantIds.push(userId);
    }
    huddle.lastActivityAt = new Date();

    return {
      token: tokenResult.token,
      serverUrl: this.liveKitService.getServerUrl(),
      roomName: huddle.roomName,
      expiresAt: tokenResult.expiresAt,
    };
  }

  /**
   * Leaves a huddle.
   */
  async leaveHuddle(huddleId: string, userId: string): Promise<void> {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) {
      throw new HuddleNotFoundError(huddleId);
    }

    // Remove participant
    huddle.participantIds = huddle.participantIds.filter(id => id !== userId);
    huddle.lastActivityAt = new Date();

    // Try to remove from LiveKit room
    try {
      await this.liveKitService.removeParticipant(huddle.roomName, userId);
    } catch (error) {
      // Participant might have already left
      this.logError('Failed to remove participant from huddle', error);
    }

    // Mark inactive if no participants (but don't delete)
    if (huddle.participantIds.length === 0) {
      huddle.status = 'inactive';
    }
  }

  /**
   * Lists active huddles in a workspace.
   */
  async listHuddles(workspaceId: string): Promise<Huddle[]> {
    const huddles: Huddle[] = [];

    this.huddles.forEach(huddle => {
      if (huddle.workspaceId === workspaceId && huddle.status !== 'archived') {
        huddles.push(huddle);
      }
    });

    return huddles;
  }

  /**
   * Archives a huddle (soft delete).
   */
  async archiveHuddle(huddleId: string): Promise<void> {
    const huddle = this.huddles.get(huddleId);
    if (!huddle) {
      throw new HuddleNotFoundError(huddleId);
    }

    // Delete LiveKit room
    try {
      await this.liveKitService.deleteRoom(huddle.roomName);
    } catch (error) {
      this.logError('Failed to delete huddle room', error);
    }

    huddle.status = 'archived';
    huddle.participantIds = [];
  }

  // ===========================================================================
  // Recording
  // ===========================================================================

  /**
   * Starts recording a call.
   */
  async startRecording(
    callId: string,
    options?: RecordingOptions
  ): Promise<string> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    if (call.status !== 'active') {
      throw new CallOperationError('startRecording', 'Call is not active');
    }

    const egressId = await this.liveKitService.startRecording(
      call.roomName,
      options
    );

    // Track recording
    if (!call.recordingIds) {
      call.recordingIds = [];
    }
    call.recordingIds.push(egressId);

    return egressId;
  }

  /**
   * Stops recording a call.
   */
  async stopRecording(callId: string, egressId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }

    await this.liveKitService.stopRecording(egressId);
  }

  // ===========================================================================
  // History
  // ===========================================================================

  /**
   * Gets call history for a channel.
   */
  async getCallHistory(
    channelId: string,
    options?: HistoryOptions
  ): Promise<PaginatedCallResult> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let calls: Call[] = [];

    // Filter calls by channel
    this.calls.forEach(call => {
      if (call.channelId === channelId) {
        // Apply filters
        if (options?.status && call.status !== options.status) {
          return;
        }
        if (options?.type && call.type !== options.type) {
          return;
        }
        if (options?.startDate && call.startedAt < options.startDate) {
          return;
        }
        if (options?.endDate && call.startedAt > options.endDate) {
          return;
        }
        calls.push(call);
      }
    });

    // Sort by start time (newest first)
    calls.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = calls.length;

    // Apply pagination
    calls = calls.slice(offset, offset + limit);

    return {
      calls,
      total,
      hasMore: offset + calls.length < total,
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Error logging helper.
   */
  private logError(message: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(
      `[CallService] ${message}:`,
      error instanceof Error ? error.message : error
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new call service instance.
 *
 * @param liveKitService - Optional LiveKit service instance
 * @returns Call service instance
 *
 * @example
 * ```typescript
 * const callService = createCallService();
 *
 * // Create a video call
 * const call = await callService.createCall('channel-123', {
 *   type: 'video',
 *   initiatorId: 'user-1',
 * });
 *
 * // Join the call
 * const { token, serverUrl } = await callService.joinCall(call.id, 'user-2', 'John Doe');
 *
 * // Connect to LiveKit with the token
 * // (client-side code)
 * ```
 */
export function createCallService(
  liveKitService?: LiveKitServiceImpl
): CallServiceImpl {
  return new CallServiceImpl(liveKitService);
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Lazily initialized singleton call service instance.
 */
let _callService: CallServiceImpl | null = null;

/**
 * Gets the singleton call service instance.
 * Lazily initialized on first access.
 *
 * @returns Call service instance
 */
export function getCallService(): CallServiceImpl {
  if (!_callService) {
    _callService = createCallService();
  }
  return _callService;
}

/**
 * Singleton call service for convenience.
 * Automatically initializes on first use.
 */
export const callService = new Proxy({} as CallServiceImpl, {
  get(_target, prop) {
    const service = getCallService();
    const value = (service as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  },
});
