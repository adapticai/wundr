/**
 * @genesis/core - LiveKit Service
 *
 * Server-side LiveKit integration for voice/video call management.
 * Provides room management, token generation, participant control,
 * and recording functionality using the livekit-server-sdk.
 *
 * @packageDocumentation
 */

import {
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from '@livekit/protocol';
import {
  RoomServiceClient,
  AccessToken,
  EgressClient,
  type VideoGrant,
  type RoomCompositeOptions,
} from 'livekit-server-sdk';

import { GenesisError } from '../errors';
import {
  DEFAULT_LIVEKIT_CONFIG,
  DEFAULT_TOKEN_OPTIONS,
  HOST_TOKEN_OPTIONS,
  GUEST_TOKEN_OPTIONS,
} from '../types/livekit';

import type {
  CreateRoomOptions,
  Room,
  UpdateRoomOptions,
  TokenOptions,
  TokenGenerationResult,
  Participant,
  Track,
  TrackType,
  TrackSource,
  RecordingOptions,
  Recording,
  RecordingStatus,
  LiveKitConfig,
  ParticipantState,
} from '../types/livekit';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Base error class for LiveKit operations.
 */
export class LiveKitError extends GenesisError {
  constructor(
    message: string,
    code: string = 'LIVEKIT_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message, code, statusCode, details);
    this.name = 'LiveKitError';
  }
}

/**
 * Error thrown when a room is not found.
 */
export class RoomNotFoundError extends LiveKitError {
  constructor(roomName: string) {
    super(
      `Room not found: ${roomName}`,
      'ROOM_NOT_FOUND',
      404,
      { roomName },
    );
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Error thrown when a room already exists.
 */
export class RoomAlreadyExistsError extends LiveKitError {
  constructor(roomName: string) {
    super(
      `Room already exists: ${roomName}`,
      'ROOM_ALREADY_EXISTS',
      409,
      { roomName },
    );
    this.name = 'RoomAlreadyExistsError';
  }
}

/**
 * Error thrown when a participant is not found.
 */
export class ParticipantNotFoundError extends LiveKitError {
  constructor(roomName: string, identity: string) {
    super(
      `Participant not found: ${identity} in room ${roomName}`,
      'PARTICIPANT_NOT_FOUND',
      404,
      { roomName, identity },
    );
    this.name = 'ParticipantNotFoundError';
  }
}

/**
 * Error thrown when LiveKit configuration is invalid.
 */
export class LiveKitConfigError extends LiveKitError {
  constructor(message: string) {
    super(message, 'LIVEKIT_CONFIG_ERROR', 500);
    this.name = 'LiveKitConfigError';
  }
}

/**
 * Error thrown when token generation fails.
 */
export class TokenGenerationError extends LiveKitError {
  constructor(reason: string) {
    super(
      `Failed to generate token: ${reason}`,
      'TOKEN_GENERATION_ERROR',
      500,
      { reason },
    );
    this.name = 'TokenGenerationError';
  }
}

/**
 * Error thrown when recording operations fail.
 */
export class RecordingError extends LiveKitError {
  constructor(operation: string, reason: string) {
    super(
      `Recording ${operation} failed: ${reason}`,
      'RECORDING_ERROR',
      500,
      { operation, reason },
    );
    this.name = 'RecordingError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for LiveKit service operations.
 */
export interface LiveKitService {
  // ==========================================================================
  // Room Management
  // ==========================================================================

  /**
   * Creates a new LiveKit room.
   *
   * @param options - Room creation options
   * @returns The created room
   * @throws {RoomAlreadyExistsError} If room already exists
   * @throws {LiveKitError} If room creation fails
   */
  createRoom(options: CreateRoomOptions): Promise<Room>;

  /**
   * Deletes a LiveKit room.
   *
   * @param roomName - Name of the room to delete
   * @throws {RoomNotFoundError} If room doesn't exist
   * @throws {LiveKitError} If deletion fails
   */
  deleteRoom(roomName: string): Promise<void>;

  /**
   * Lists all active rooms.
   *
   * @returns Array of active rooms
   */
  listRooms(): Promise<Room[]>;

  /**
   * Gets a specific room by name.
   *
   * @param roomName - Room name to retrieve
   * @returns The room or null if not found
   */
  getRoom(roomName: string): Promise<Room | null>;

  /**
   * Updates room metadata.
   *
   * @param roomName - Room to update
   * @param options - Update options
   * @throws {RoomNotFoundError} If room doesn't exist
   */
  updateRoom(roomName: string, options: UpdateRoomOptions): Promise<Room>;

  // ==========================================================================
  // Token Generation
  // ==========================================================================

  /**
   * Generates an access token for a participant.
   *
   * @param identity - Unique participant identity
   * @param roomName - Room to join
   * @param options - Token options
   * @returns Token generation result with JWT
   */
  generateToken(
    identity: string,
    roomName: string,
    options?: TokenOptions
  ): Promise<TokenGenerationResult>;

  /**
   * Generates a host token with full permissions.
   *
   * @param identity - Host identity
   * @param roomName - Room name
   * @returns Token generation result
   */
  generateHostToken(identity: string, roomName: string): Promise<TokenGenerationResult>;

  /**
   * Generates a guest token with limited permissions.
   *
   * @param identity - Guest identity
   * @param roomName - Room name
   * @returns Token generation result
   */
  generateGuestToken(identity: string, roomName: string): Promise<TokenGenerationResult>;

  /**
   * Generates a viewer-only token (subscribe only).
   *
   * @param identity - Viewer identity
   * @param roomName - Room name
   * @returns Token generation result
   */
  generateViewerToken(identity: string, roomName: string): Promise<TokenGenerationResult>;

  // ==========================================================================
  // Participant Management
  // ==========================================================================

  /**
   * Gets a participant by identity.
   *
   * @param roomName - Room name
   * @param identity - Participant identity
   * @returns The participant or null if not found
   */
  getParticipant(roomName: string, identity: string): Promise<Participant | null>;

  /**
   * Lists all participants in a room.
   *
   * @param roomName - Room name
   * @returns Array of participants
   */
  listParticipants(roomName: string): Promise<Participant[]>;

  /**
   * Removes a participant from a room.
   *
   * @param roomName - Room name
   * @param identity - Participant identity
   * @throws {ParticipantNotFoundError} If participant doesn't exist
   */
  removeParticipant(roomName: string, identity: string): Promise<void>;

  /**
   * Mutes a participant's track.
   *
   * @param roomName - Room name
   * @param identity - Participant identity
   * @param trackType - Track type to mute
   * @throws {ParticipantNotFoundError} If participant doesn't exist
   */
  muteParticipant(
    roomName: string,
    identity: string,
    trackType: TrackType
  ): Promise<void>;

  /**
   * Updates participant metadata.
   *
   * @param roomName - Room name
   * @param identity - Participant identity
   * @param metadata - New metadata
   */
  updateParticipant(
    roomName: string,
    identity: string,
    metadata: string
  ): Promise<Participant>;

  // ==========================================================================
  // Recording/Egress
  // ==========================================================================

  /**
   * Starts recording a room.
   *
   * @param roomName - Room to record
   * @param options - Recording options
   * @returns Egress ID for the recording
   */
  startRecording(roomName: string, options?: RecordingOptions): Promise<string>;

  /**
   * Stops a recording.
   *
   * @param egressId - Egress ID to stop
   */
  stopRecording(egressId: string): Promise<void>;

  /**
   * Lists all recordings for a room.
   *
   * @param roomName - Room name
   * @returns Array of recordings
   */
  listRecordings(roomName: string): Promise<Recording[]>;

  /**
   * Gets recording status.
   *
   * @param egressId - Egress ID
   * @returns Recording details
   */
  getRecording(egressId: string): Promise<Recording | null>;

  // ==========================================================================
  // Utility
  // ==========================================================================

  /**
   * Checks if the service is properly configured.
   */
  isConfigured(): boolean;

  /**
   * Gets the LiveKit server URL.
   */
  getServerUrl(): string;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * LiveKit service implementation using livekit-server-sdk.
 */
export class LiveKitServiceImpl implements LiveKitService {
  private readonly config: LiveKitConfig;
  private readonly roomService: RoomServiceClient;
  private readonly egressClient: EgressClient;

  /**
   * Creates a new LiveKitServiceImpl instance.
   *
   * @param config - LiveKit configuration
   * @throws {LiveKitConfigError} If configuration is invalid
   */
  constructor(config: LiveKitConfig) {
    this.validateConfig(config);
    this.config = {
      ...DEFAULT_LIVEKIT_CONFIG,
      ...config,
    };

    this.roomService = new RoomServiceClient(
      this.config.url,
      this.config.apiKey,
      this.config.apiSecret,
    );

    this.egressClient = new EgressClient(
      this.config.url,
      this.config.apiKey,
      this.config.apiSecret,
    );
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  /**
   * Creates a new LiveKit room.
   */
  async createRoom(options: CreateRoomOptions): Promise<Room> {
    try {
      const existingRoom = await this.getRoom(options.name);
      if (existingRoom) {
        throw new RoomAlreadyExistsError(options.name);
      }

      const room = await this.roomService.createRoom({
        name: options.name,
        emptyTimeout: options.emptyTimeout ?? this.config.defaultEmptyTimeout,
        maxParticipants: options.maxParticipants ?? this.config.defaultMaxParticipants,
        metadata: options.metadata,
        departureTimeout: options.departureTimeout,
      });

      return this.mapRoom(room);
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new LiveKitError(
        `Failed to create room: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROOM_CREATE_ERROR',
        500,
        { roomName: options.name },
      );
    }
  }

  /**
   * Deletes a LiveKit room.
   */
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
    } catch (error) {
      throw new LiveKitError(
        `Failed to delete room: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROOM_DELETE_ERROR',
        500,
        { roomName },
      );
    }
  }

  /**
   * Lists all active rooms.
   */
  async listRooms(): Promise<Room[]> {
    try {
      const rooms = await this.roomService.listRooms();
      return rooms.map((room) => this.mapRoom(room));
    } catch (error) {
      throw new LiveKitError(
        `Failed to list rooms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROOM_LIST_ERROR',
        500,
      );
    }
  }

  /**
   * Gets a specific room by name.
   */
  async getRoom(roomName: string): Promise<Room | null> {
    try {
      const rooms = await this.roomService.listRooms([roomName]);
      if (rooms.length === 0) {
        return null;
      }
      const room = rooms[0];
      if (!room) {
        return null;
      }
      return this.mapRoom(room);
    } catch (error) {
      this.logError('Failed to get room', error);
      return null;
    }
  }

  /**
   * Updates room metadata.
   */
  async updateRoom(roomName: string, options: UpdateRoomOptions): Promise<Room> {
    try {
      const room = await this.getRoom(roomName);
      if (!room) {
        throw new RoomNotFoundError(roomName);
      }

      const updatedRoom = await this.roomService.updateRoomMetadata(
        roomName,
        options.metadata ?? '',
      );

      return this.mapRoom(updatedRoom);
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new LiveKitError(
        `Failed to update room: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROOM_UPDATE_ERROR',
        500,
        { roomName },
      );
    }
  }

  // ===========================================================================
  // Token Generation
  // ===========================================================================

  /**
   * Generates an access token for a participant.
   */
  async generateToken(
    identity: string,
    roomName: string,
    options?: TokenOptions,
  ): Promise<TokenGenerationResult> {
    try {
      const mergedOptions = { ...DEFAULT_TOKEN_OPTIONS, ...options };
      const ttl = mergedOptions.ttl ?? this.config.defaultTokenTtl ?? 3600;

      const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
        identity,
        name: mergedOptions.name,
        metadata: mergedOptions.metadata,
        ttl,
      });

      const videoGrant: VideoGrant = {
        room: roomName,
        roomJoin: mergedOptions.roomJoin,
        canPublish: mergedOptions.canPublish,
        canSubscribe: mergedOptions.canSubscribe,
        canPublishData: mergedOptions.canPublishData,
        canPublishSources: mergedOptions.canPublishSources as VideoGrant['canPublishSources'],
        roomAdmin: mergedOptions.roomAdmin,
        roomRecord: mergedOptions.roomRecord,
        hidden: mergedOptions.hidden,
      };

      token.addGrant(videoGrant);

      const jwt = await token.toJwt();
      const expiresAt = new Date(Date.now() + ttl * 1000);

      return {
        token: jwt,
        expiresAt,
        roomName,
        identity,
      };
    } catch (error) {
      throw new TokenGenerationError(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Generates a host token with full permissions.
   */
  async generateHostToken(identity: string, roomName: string): Promise<TokenGenerationResult> {
    return this.generateToken(identity, roomName, HOST_TOKEN_OPTIONS);
  }

  /**
   * Generates a guest token with limited permissions.
   */
  async generateGuestToken(identity: string, roomName: string): Promise<TokenGenerationResult> {
    return this.generateToken(identity, roomName, GUEST_TOKEN_OPTIONS);
  }

  /**
   * Generates a viewer-only token.
   */
  async generateViewerToken(identity: string, roomName: string): Promise<TokenGenerationResult> {
    return this.generateToken(identity, roomName, {
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
      roomJoin: true,
      roomAdmin: false,
    });
  }

  // ===========================================================================
  // Participant Management
  // ===========================================================================

  /**
   * Gets a participant by identity.
   */
  async getParticipant(roomName: string, identity: string): Promise<Participant | null> {
    try {
      const participant = await this.roomService.getParticipant(roomName, identity);
      return this.mapParticipant(participant);
    } catch (_error) {
      // LiveKit throws when participant not found
      return null;
    }
  }

  /**
   * Lists all participants in a room.
   */
  async listParticipants(roomName: string): Promise<Participant[]> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants.map((p) => this.mapParticipant(p));
    } catch (error) {
      throw new LiveKitError(
        `Failed to list participants: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARTICIPANT_LIST_ERROR',
        500,
        { roomName },
      );
    }
  }

  /**
   * Removes a participant from a room.
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    try {
      const participant = await this.getParticipant(roomName, identity);
      if (!participant) {
        throw new ParticipantNotFoundError(roomName, identity);
      }

      await this.roomService.removeParticipant(roomName, identity);
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new LiveKitError(
        `Failed to remove participant: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARTICIPANT_REMOVE_ERROR',
        500,
        { roomName, identity },
      );
    }
  }

  /**
   * Mutes a participant's track.
   */
  async muteParticipant(
    roomName: string,
    identity: string,
    trackType: TrackType,
  ): Promise<void> {
    try {
      const participant = await this.getParticipant(roomName, identity);
      if (!participant) {
        throw new ParticipantNotFoundError(roomName, identity);
      }

      // Find the track to mute based on type
      const track = participant.tracks.find((t) => t.type === trackType);
      if (track) {
        await this.roomService.mutePublishedTrack(roomName, identity, track.sid, true);
      }
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new LiveKitError(
        `Failed to mute participant: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARTICIPANT_MUTE_ERROR',
        500,
        { roomName, identity, trackType },
      );
    }
  }

  /**
   * Updates participant metadata.
   */
  async updateParticipant(
    roomName: string,
    identity: string,
    metadata: string,
  ): Promise<Participant> {
    try {
      const participant = await this.roomService.updateParticipant(
        roomName,
        identity,
        metadata,
      );
      return this.mapParticipant(participant);
    } catch (error) {
      throw new LiveKitError(
        `Failed to update participant: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARTICIPANT_UPDATE_ERROR',
        500,
        { roomName, identity },
      );
    }
  }

  // ===========================================================================
  // Recording/Egress
  // ===========================================================================

  /**
   * Starts recording a room.
   */
  async startRecording(roomName: string, options?: RecordingOptions): Promise<string> {
    try {
      const room = await this.getRoom(roomName);
      if (!room) {
        throw new RoomNotFoundError(roomName);
      }

      const compositeOptions: RoomCompositeOptions = {
        layout: 'grid',
        audioOnly: options?.audioOnly ?? false,
        videoOnly: options?.videoOnly ?? false,
      };

      // Build output configuration using the protocol types
      const filepath = options?.filepath ?? `recordings/${roomName}/{time}`;

      // Create encoded file output using the proper class constructor
      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath,
      });

      // Add S3 configuration if provided
      if (options?.s3) {
        fileOutput.output = {
          case: 's3',
          value: new S3Upload({
            bucket: options.s3.bucket,
            region: options.s3.region,
            accessKey: options.s3.accessKey ?? '',
            secret: options.s3.secretKey ?? '',
            endpoint: options.s3.endpoint ?? '',
            forcePathStyle: options.s3.forcePathStyle ?? false,
          }),
        };
      }

      const egress = await this.egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        compositeOptions,
      );

      return egress.egressId;
    } catch (error) {
      if (error instanceof LiveKitError) {
        throw error;
      }
      throw new RecordingError(
        'start',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Stops a recording.
   */
  async stopRecording(egressId: string): Promise<void> {
    try {
      await this.egressClient.stopEgress(egressId);
    } catch (error) {
      throw new RecordingError(
        'stop',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Lists all recordings for a room.
   */
  async listRecordings(roomName: string): Promise<Recording[]> {
    try {
      const egresses = await this.egressClient.listEgress({ roomName });
      return egresses.map((e) => this.mapRecording(e, roomName));
    } catch (error) {
      throw new LiveKitError(
        `Failed to list recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RECORDING_LIST_ERROR',
        500,
        { roomName },
      );
    }
  }

  /**
   * Gets recording status.
   */
  async getRecording(egressId: string): Promise<Recording | null> {
    try {
      const egresses = await this.egressClient.listEgress({ egressId });
      if (egresses.length === 0) {
        return null;
      }
      const egress = egresses[0];
      if (!egress) {
        return null;
      }
      return this.mapRecording(egress, '');
    } catch (_error) {
      return null;
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Checks if the service is properly configured.
   */
  isConfigured(): boolean {
    return !!(
      this.config.url &&
      this.config.apiKey &&
      this.config.apiSecret
    );
  }

  /**
   * Gets the LiveKit server URL.
   */
  getServerUrl(): string {
    return this.config.url;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates LiveKit configuration.
   */
  private validateConfig(config: LiveKitConfig): void {
    if (!config.url) {
      throw new LiveKitConfigError('LiveKit URL is required');
    }
    if (!config.apiKey) {
      throw new LiveKitConfigError('LiveKit API key is required');
    }
    if (!config.apiSecret) {
      throw new LiveKitConfigError('LiveKit API secret is required');
    }
  }

  /**
   * Maps LiveKit SDK room to our Room type.
   */
  private mapRoom(sdkRoom: {
    name: string;
    sid: string;
    emptyTimeout: number;
    maxParticipants: number;
    creationTime: bigint;
    metadata: string;
    numParticipants: number;
    numPublishers?: number;
    activeRecording?: boolean;
  }): Room {
    return {
      name: sdkRoom.name,
      sid: sdkRoom.sid,
      emptyTimeout: sdkRoom.emptyTimeout,
      maxParticipants: sdkRoom.maxParticipants,
      creationTime: new Date(Number(sdkRoom.creationTime) * 1000),
      metadata: sdkRoom.metadata || undefined,
      numParticipants: sdkRoom.numParticipants,
      numPublishers: sdkRoom.numPublishers,
      activeRecording: sdkRoom.activeRecording,
    };
  }

  /**
   * Maps LiveKit SDK participant to our Participant type.
   */
  private mapParticipant(sdkParticipant: {
    sid: string;
    identity: string;
    name: string;
    state: number;
    tracks: Array<{
      sid: string;
      type: number;
      name: string;
      source: number;
      muted: boolean;
      width?: number;
      height?: number;
      simulcast?: boolean;
      mimeType?: string;
    }>;
    metadata: string;
    joinedAt: bigint;
    isPublisher?: boolean;
  }): Participant {
    return {
      sid: sdkParticipant.sid,
      identity: sdkParticipant.identity,
      name: sdkParticipant.name || undefined,
      state: this.mapParticipantState(sdkParticipant.state),
      tracks: sdkParticipant.tracks.map((t) => this.mapTrack(t)),
      metadata: sdkParticipant.metadata || undefined,
      joinedAt: new Date(Number(sdkParticipant.joinedAt) * 1000),
      isPublisher: sdkParticipant.isPublisher,
    };
  }

  /**
   * Maps participant state number to ParticipantState.
   */
  private mapParticipantState(state: number): ParticipantState {
    switch (state) {
      case 0:
        return 'joining';
      case 1:
        return 'joined';
      case 2:
        return 'active';
      case 3:
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }

  /**
   * Maps LiveKit SDK track to our Track type.
   */
  private mapTrack(sdkTrack: {
    sid: string;
    type: number;
    name: string;
    source: number;
    muted: boolean;
    width?: number;
    height?: number;
    simulcast?: boolean;
    mimeType?: string;
  }): Track {
    return {
      sid: sdkTrack.sid,
      type: this.mapTrackType(sdkTrack.type),
      name: sdkTrack.name,
      source: this.mapTrackSource(sdkTrack.source),
      muted: sdkTrack.muted,
      width: sdkTrack.width,
      height: sdkTrack.height,
      simulcast: sdkTrack.simulcast,
      mimeType: sdkTrack.mimeType,
    };
  }

  /**
   * Maps track type number to TrackType.
   */
  private mapTrackType(type: number): TrackType {
    switch (type) {
      case 0:
        return 'audio';
      case 1:
        return 'video';
      default:
        return 'video';
    }
  }

  /**
   * Maps track source number to TrackSource.
   */
  private mapTrackSource(source: number): TrackSource {
    switch (source) {
      case 0:
        return 'camera';
      case 1:
        return 'microphone';
      case 2:
        return 'screen_share';
      case 3:
        return 'screen_share_audio';
      default:
        return 'camera';
    }
  }

  /**
   * Maps egress to Recording.
   */
  private mapRecording(
    egress: {
      egressId: string;
      roomName: string;
      status: number;
      startedAt: bigint;
      endedAt?: bigint;
      error?: string;
    },
    defaultRoomName: string,
  ): Recording {
    return {
      egressId: egress.egressId,
      roomName: egress.roomName || defaultRoomName,
      status: this.mapRecordingStatus(egress.status),
      startedAt: new Date(Number(egress.startedAt) * 1000),
      endedAt: egress.endedAt ? new Date(Number(egress.endedAt) * 1000) : undefined,
      error: egress.error,
    };
  }

  /**
   * Maps egress status number to RecordingStatus.
   */
  private mapRecordingStatus(status: number): RecordingStatus {
    switch (status) {
      case 0:
        return 'starting';
      case 1:
        return 'active';
      case 2:
        return 'ending';
      case 3:
        return 'complete';
      case 4:
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * Error logging helper.
   */
  private logError(message: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[LiveKitService] ${message}:`, error instanceof Error ? error.message : error);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a LiveKit service from configuration.
 *
 * @param config - LiveKit configuration
 * @returns LiveKit service instance
 *
 * @example
 * ```typescript
 * const liveKitService = createLiveKitService({
 *   url: 'wss://my-app.livekit.cloud',
 *   apiKey: 'your-api-key',
 *   apiSecret: 'your-api-secret',
 * });
 *
 * // Create a room
 * const room = await liveKitService.createRoom({
 *   name: 'meeting-123',
 *   maxParticipants: 10,
 * });
 *
 * // Generate a token for a participant
 * const { token } = liveKitService.generateToken('user-1', 'meeting-123');
 * ```
 */
export function createLiveKitService(config: LiveKitConfig): LiveKitServiceImpl {
  return new LiveKitServiceImpl(config);
}

/**
 * Creates a LiveKit service from environment variables.
 *
 * Expects the following environment variables:
 * - LIVEKIT_URL
 * - LIVEKIT_API_KEY
 * - LIVEKIT_API_SECRET
 *
 * @returns LiveKit service instance
 * @throws {LiveKitConfigError} If environment variables are missing
 *
 * @example
 * ```typescript
 * const liveKitService = createLiveKitServiceFromEnv();
 * ```
 */
export function createLiveKitServiceFromEnv(): LiveKitServiceImpl {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url) {
    throw new LiveKitConfigError('LIVEKIT_URL environment variable is required');
  }
  if (!apiKey) {
    throw new LiveKitConfigError('LIVEKIT_API_KEY environment variable is required');
  }
  if (!apiSecret) {
    throw new LiveKitConfigError('LIVEKIT_API_SECRET environment variable is required');
  }

  return createLiveKitService({
    url,
    apiKey,
    apiSecret,
    defaultTokenTtl: parseInt(process.env.LIVEKIT_DEFAULT_TOKEN_TTL ?? '3600', 10),
    defaultEmptyTimeout: parseInt(process.env.LIVEKIT_DEFAULT_EMPTY_TIMEOUT ?? '300', 10),
    defaultMaxParticipants: parseInt(process.env.LIVEKIT_DEFAULT_MAX_PARTICIPANTS ?? '100', 10),
  });
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Lazily initialized singleton LiveKit service instance.
 */
let _liveKitService: LiveKitServiceImpl | null = null;

/**
 * Gets the singleton LiveKit service instance.
 * Lazily initialized on first access using environment variables.
 *
 * @returns LiveKit service instance
 * @throws {LiveKitConfigError} If environment variables are missing
 */
export function getLiveKitService(): LiveKitServiceImpl {
  if (!_liveKitService) {
    _liveKitService = createLiveKitServiceFromEnv();
  }
  return _liveKitService;
}

/**
 * Singleton LiveKit service for convenience.
 * Automatically initializes from environment variables on first use.
 */
export const liveKitService = new Proxy({} as LiveKitServiceImpl, {
  get(_target, prop) {
    const service = getLiveKitService();
    const value = (service as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  },
});
