/**
 * Mock LiveKit Client for Testing
 *
 * Provides a fully functional in-memory LiveKit mock implementation
 * for testing voice/video call services without a real LiveKit server.
 *
 * Implements:
 * - Room management: createRoom, deleteRoom, listRooms
 * - Token generation: createToken with grants
 * - Participant operations: listParticipants, removeParticipant, muteParticipant
 * - Webhook handling: signature verification
 *
 * @module @genesis/core/test-utils/mock-livekit
 */

import { vi } from 'vitest';

// =============================================================================
// TYPES
// =============================================================================

export type RoomStatus = 'active' | 'closed' | 'pending';

export type ParticipantState = 'connected' | 'disconnected' | 'reconnecting';

export type TrackSource = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio';

export interface Room {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: number;
  turnPassword: string;
  enabledCodecs: Array<{ mime: string; fmtpLine: string }>;
  metadata: string;
  numParticipants: number;
  numPublishers: number;
  activeRecording: boolean;
}

export interface Participant {
  sid: string;
  identity: string;
  state: ParticipantState;
  tracks: ParticipantTrack[];
  metadata: string;
  joinedAt: number;
  name: string;
  version: number;
  permission: ParticipantPermission;
  region: string;
  isPublisher: boolean;
}

export interface ParticipantTrack {
  sid: string;
  type: 'audio' | 'video' | 'data';
  source: TrackSource;
  muted: boolean;
  width: number;
  height: number;
  simulcast: boolean;
  disabled: boolean;
}

export interface ParticipantPermission {
  canSubscribe: boolean;
  canPublish: boolean;
  canPublishData: boolean;
  canPublishSources: TrackSource[];
  hidden: boolean;
  recorder: boolean;
  canUpdateMetadata: boolean;
}

export interface VideoGrant {
  roomCreate?: boolean;
  roomList?: boolean;
  roomRecord?: boolean;
  roomAdmin?: boolean;
  roomJoin?: boolean;
  room?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  canPublishSources?: TrackSource[];
  canUpdateOwnMetadata?: boolean;
  ingressAdmin?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

export interface TokenOptions {
  identity: string;
  name?: string;
  metadata?: string;
  ttl?: number;
  grants?: VideoGrant;
}

export interface RoomOptions {
  name: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
  egress?: EgressConfig;
  minPlayoutDelay?: number;
  maxPlayoutDelay?: number;
  syncStreams?: boolean;
}

export interface EgressConfig {
  room?: RoomCompositeEgress;
  participant?: ParticipantEgress;
  tracks?: TrackEgress;
}

export interface RoomCompositeEgress {
  layout?: string;
  customBaseUrl?: string;
}

export interface ParticipantEgress {
  segmentOutputs?: SegmentedOutput[];
}

export interface TrackEgress {
  imageOutputs?: ImageOutput[];
}

export interface SegmentedOutput {
  protocol?: string;
  filenamePrefix?: string;
}

export interface ImageOutput {
  captureInterval?: number;
  width?: number;
  height?: number;
}

export interface WebhookEvent {
  event: WebhookEventType;
  room?: Room;
  participant?: Participant;
  track?: ParticipantTrack;
  egressInfo?: EgressInfo;
  ingressInfo?: IngressInfo;
  id: string;
  createdAt: number;
  numDropped: number;
}

export type WebhookEventType =
  | 'room_started'
  | 'room_finished'
  | 'participant_joined'
  | 'participant_left'
  | 'track_published'
  | 'track_unpublished'
  | 'egress_started'
  | 'egress_updated'
  | 'egress_ended'
  | 'ingress_started'
  | 'ingress_ended';

export interface EgressInfo {
  egressId: string;
  roomName: string;
  status: 'starting' | 'active' | 'ending' | 'complete' | 'failed';
}

export interface IngressInfo {
  ingressId: string;
  name: string;
  roomName: string;
  participantIdentity: string;
  state: 'starting' | 'active' | 'disconnected' | 'reconnecting' | 'deleting';
}

// =============================================================================
// MOCK LIVEKIT STORE
// =============================================================================

export interface MockLiveKitStore {
  rooms: Map<string, Room>;
  participants: Map<string, Map<string, Participant>>;
  tokens: Map<string, { identity: string; grants: VideoGrant; expiresAt: number }>;
  webhookEvents: WebhookEvent[];
}

// =============================================================================
// MOCK LIVEKIT SERVICE INTERFACE
// =============================================================================

export interface MockLiveKitService {
  // Store access for assertions
  _store: MockLiveKitStore;
  _apiKey: string;
  _apiSecret: string;

  // Room Service
  createRoom: ReturnType<typeof vi.fn>;
  deleteRoom: ReturnType<typeof vi.fn>;
  listRooms: ReturnType<typeof vi.fn>;
  getRoom: ReturnType<typeof vi.fn>;
  updateRoomMetadata: ReturnType<typeof vi.fn>;

  // Participant Service
  listParticipants: ReturnType<typeof vi.fn>;
  getParticipant: ReturnType<typeof vi.fn>;
  removeParticipant: ReturnType<typeof vi.fn>;
  mutePublishedTrack: ReturnType<typeof vi.fn>;
  updateParticipant: ReturnType<typeof vi.fn>;

  // Token Service
  createToken: ReturnType<typeof vi.fn>;
  verifyToken: ReturnType<typeof vi.fn>;

  // Webhook Service
  verifyWebhook: ReturnType<typeof vi.fn>;
  parseWebhook: ReturnType<typeof vi.fn>;

  // Egress Service (recording)
  startRoomCompositeEgress: ReturnType<typeof vi.fn>;
  stopEgress: ReturnType<typeof vi.fn>;
  listEgress: ReturnType<typeof vi.fn>;

  // Helper methods
  _reset: () => void;
  _addParticipant: (roomName: string, participant: Participant) => void;
  _removeParticipant: (roomName: string, identity: string) => void;
  _simulateWebhook: (event: WebhookEvent) => void;
  _generateRoomSid: () => string;
  _generateParticipantSid: () => string;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

let roomSidCounter = 0;
let participantSidCounter = 0;
let eventIdCounter = 0;

/**
 * Creates a mock LiveKit service for testing
 *
 * @example
 * ```typescript
 * const livekit = createMockLiveKitService();
 *
 * // Use in service tests
 * const callService = new CallService(livekit);
 *
 * // Create a room
 * const room = await livekit.createRoom({ name: 'test-room' });
 *
 * // Verify operations
 * expect(livekit.createRoom).toHaveBeenCalledWith({ name: 'test-room' });
 * ```
 */
export function createMockLiveKitService(
  apiKey = 'test-api-key',
  apiSecret = 'test-api-secret',
): MockLiveKitService {
  const store: MockLiveKitStore = {
    rooms: new Map(),
    participants: new Map(),
    tokens: new Map(),
    webhookEvents: [],
  };

  const generateRoomSid = (): string => {
    roomSidCounter++;
    return `RM_${Date.now()}_${roomSidCounter}`;
  };

  const generateParticipantSid = (): string => {
    participantSidCounter++;
    return `PA_${Date.now()}_${participantSidCounter}`;
  };

  const generateEventId = (): string => {
    eventIdCounter++;
    return `EV_${Date.now()}_${eventIdCounter}`;
  };

  const service: MockLiveKitService = {
    _store: store,
    _apiKey: apiKey,
    _apiSecret: apiSecret,

    // =========================================================================
    // ROOM SERVICE
    // =========================================================================

    createRoom: vi.fn(async (options: RoomOptions): Promise<Room> => {
      if (store.rooms.has(options.name)) {
        // LiveKit returns existing room if name matches
        return store.rooms.get(options.name)!;
      }

      const room: Room = {
        sid: generateRoomSid(),
        name: options.name,
        emptyTimeout: options.emptyTimeout ?? 300,
        maxParticipants: options.maxParticipants ?? 50,
        creationTime: Date.now(),
        turnPassword: `turn-password-${Math.random().toString(36).substring(7)}`,
        enabledCodecs: [
          { mime: 'audio/opus', fmtpLine: '' },
          { mime: 'video/VP8', fmtpLine: '' },
          { mime: 'video/H264', fmtpLine: '' },
        ],
        metadata: options.metadata ?? '',
        numParticipants: 0,
        numPublishers: 0,
        activeRecording: false,
      };

      store.rooms.set(options.name, room);
      store.participants.set(options.name, new Map());

      return room;
    }),

    deleteRoom: vi.fn(async (roomName: string): Promise<void> => {
      store.rooms.delete(roomName);
      store.participants.delete(roomName);
    }),

    listRooms: vi.fn(async (names?: string[]): Promise<Room[]> => {
      if (names && names.length > 0) {
        return names
          .map((name) => store.rooms.get(name))
          .filter((room): room is Room => room !== undefined);
      }
      return Array.from(store.rooms.values());
    }),

    getRoom: vi.fn(async (roomName: string): Promise<Room | null> => {
      return store.rooms.get(roomName) ?? null;
    }),

    updateRoomMetadata: vi.fn(
      async (roomName: string, metadata: string): Promise<Room | null> => {
        const room = store.rooms.get(roomName);
        if (!room) {
return null;
}

        room.metadata = metadata;
        return room;
      },
    ),

    // =========================================================================
    // PARTICIPANT SERVICE
    // =========================================================================

    listParticipants: vi.fn(async (roomName: string): Promise<Participant[]> => {
      const roomParticipants = store.participants.get(roomName);
      if (!roomParticipants) {
return [];
}
      return Array.from(roomParticipants.values());
    }),

    getParticipant: vi.fn(
      async (roomName: string, identity: string): Promise<Participant | null> => {
        const roomParticipants = store.participants.get(roomName);
        if (!roomParticipants) {
return null;
}
        return roomParticipants.get(identity) ?? null;
      },
    ),

    removeParticipant: vi.fn(
      async (roomName: string, identity: string): Promise<void> => {
        const roomParticipants = store.participants.get(roomName);
        if (!roomParticipants) {
return;
}

        const participant = roomParticipants.get(identity);
        if (participant) {
          roomParticipants.delete(identity);

          // Update room participant count
          const room = store.rooms.get(roomName);
          if (room) {
            room.numParticipants = roomParticipants.size;
            room.numPublishers = Array.from(roomParticipants.values()).filter(
              (p) => p.isPublisher,
            ).length;
          }
        }
      },
    ),

    mutePublishedTrack: vi.fn(
      async (
        roomName: string,
        identity: string,
        trackSid: string,
        muted: boolean,
      ): Promise<ParticipantTrack | null> => {
        const roomParticipants = store.participants.get(roomName);
        if (!roomParticipants) {
return null;
}

        const participant = roomParticipants.get(identity);
        if (!participant) {
return null;
}

        const track = participant.tracks.find((t) => t.sid === trackSid);
        if (!track) {
return null;
}

        track.muted = muted;
        return track;
      },
    ),

    updateParticipant: vi.fn(
      async (
        roomName: string,
        identity: string,
        metadata?: string,
        permission?: Partial<ParticipantPermission>,
        name?: string,
      ): Promise<Participant | null> => {
        const roomParticipants = store.participants.get(roomName);
        if (!roomParticipants) {
return null;
}

        const participant = roomParticipants.get(identity);
        if (!participant) {
return null;
}

        if (metadata !== undefined) {
participant.metadata = metadata;
}
        if (name !== undefined) {
participant.name = name;
}
        if (permission) {
          participant.permission = { ...participant.permission, ...permission };
        }

        return participant;
      },
    ),

    // =========================================================================
    // TOKEN SERVICE
    // =========================================================================

    createToken: vi.fn(
      async (options: TokenOptions): Promise<string> => {
        const ttl = options.ttl ?? 3600; // Default 1 hour
        const expiresAt = Date.now() + ttl * 1000;

        const grants: VideoGrant = {
          roomJoin: true,
          room: options.grants?.room,
          canPublish: options.grants?.canPublish ?? true,
          canSubscribe: options.grants?.canSubscribe ?? true,
          canPublishData: options.grants?.canPublishData ?? true,
          ...options.grants,
        };

        const tokenId = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        store.tokens.set(tokenId, {
          identity: options.identity,
          grants,
          expiresAt,
        });

        // Return a mock JWT-like string
        const payload = {
          sub: options.identity,
          name: options.name,
          metadata: options.metadata,
          video: grants,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(expiresAt / 1000),
          iss: apiKey,
          jti: tokenId,
        };

        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
        return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.mock-signature`;
      },
    ),

    verifyToken: vi.fn(
      async (
        token: string,
      ): Promise<{ identity: string; grants: VideoGrant; valid: boolean }> => {
        try {
          const parts = token.split('.');
          if (parts.length !== 3) {
            return { identity: '', grants: {}, valid: false };
          }

          const payloadStr = parts[1];
          if (!payloadStr) {
            return { identity: '', grants: {}, valid: false };
          }

          const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
          const now = Math.floor(Date.now() / 1000);

          if (payload.exp && payload.exp < now) {
            return { identity: payload.sub, grants: payload.video, valid: false };
          }

          return { identity: payload.sub, grants: payload.video, valid: true };
        } catch {
          return { identity: '', grants: {}, valid: false };
        }
      },
    ),

    // =========================================================================
    // WEBHOOK SERVICE
    // =========================================================================

    verifyWebhook: vi.fn(
      async (body: string, signature: string): Promise<boolean> => {
        // In real implementation, this verifies HMAC-SHA256 signature using the body
        // For testing, we accept any signature that starts with 'valid-' or matches the secret
        // The body is included in the check to simulate real HMAC verification
        const isValidPrefix = signature.startsWith('valid-');
        const isSecretMatch = signature === `sha256=${apiSecret}`;
        const hasBody = body.length > 0;
        return (isValidPrefix || isSecretMatch) && hasBody;
      },
    ),

    parseWebhook: vi.fn(
      async (body: string): Promise<WebhookEvent> => {
        return JSON.parse(body) as WebhookEvent;
      },
    ),

    // =========================================================================
    // EGRESS SERVICE (Recording)
    // =========================================================================

    startRoomCompositeEgress: vi.fn(
      async (
        roomName: string,
        _output: { file?: { filepath: string }; stream?: { protocol: string; urls: string[] } },
      ): Promise<EgressInfo> => {
        const room = store.rooms.get(roomName);
        if (room) {
          room.activeRecording = true;
        }

        return {
          egressId: `EG_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          roomName,
          status: 'active',
        };
      },
    ),

    stopEgress: vi.fn(async (egressId: string): Promise<EgressInfo> => {
      // Find and update the recording status
      for (const room of store.rooms.values()) {
        room.activeRecording = false;
      }

      return {
        egressId,
        roomName: '',
        status: 'complete',
      };
    }),

    listEgress: vi.fn(async (roomName?: string): Promise<EgressInfo[]> => {
      // Return mock egress list
      if (roomName) {
        return [
          {
            egressId: `EG_mock_${roomName}`,
            roomName,
            status: 'complete',
          },
        ];
      }
      return [];
    }),

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    _reset: () => {
      store.rooms.clear();
      store.participants.clear();
      store.tokens.clear();
      store.webhookEvents.length = 0;
      roomSidCounter = 0;
      participantSidCounter = 0;
      eventIdCounter = 0;
      vi.clearAllMocks();
    },

    _addParticipant: (roomName: string, participant: Participant) => {
      let roomParticipants = store.participants.get(roomName);
      if (!roomParticipants) {
        roomParticipants = new Map();
        store.participants.set(roomName, roomParticipants);
      }

      roomParticipants.set(participant.identity, participant);

      // Update room counts
      const room = store.rooms.get(roomName);
      if (room) {
        room.numParticipants = roomParticipants.size;
        room.numPublishers = Array.from(roomParticipants.values()).filter(
          (p) => p.isPublisher,
        ).length;
      }
    },

    _removeParticipant: (roomName: string, identity: string) => {
      const roomParticipants = store.participants.get(roomName);
      if (roomParticipants) {
        roomParticipants.delete(identity);

        const room = store.rooms.get(roomName);
        if (room) {
          room.numParticipants = roomParticipants.size;
          room.numPublishers = Array.from(roomParticipants.values()).filter(
            (p) => p.isPublisher,
          ).length;
        }
      }
    },

    _simulateWebhook: (event: WebhookEvent) => {
      // Ensure event has an ID if not provided
      const eventWithId: WebhookEvent = {
        ...event,
        id: event.id || generateEventId(),
        createdAt: event.createdAt || Date.now(),
      };
      store.webhookEvents.push(eventWithId);
    },

    _generateRoomSid: generateRoomSid,
    _generateParticipantSid: generateParticipantSid,
  };

  return service;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a mock Room object
 */
export function createMockRoom(overrides?: Partial<Room>): Room {
  roomSidCounter++;
  return {
    sid: `RM_mock_${roomSidCounter}`,
    name: overrides?.name ?? `room-${roomSidCounter}`,
    emptyTimeout: 300,
    maxParticipants: 50,
    creationTime: Date.now(),
    turnPassword: 'mock-turn-password',
    enabledCodecs: [
      { mime: 'audio/opus', fmtpLine: '' },
      { mime: 'video/VP8', fmtpLine: '' },
    ],
    metadata: '',
    numParticipants: 0,
    numPublishers: 0,
    activeRecording: false,
    ...overrides,
  };
}

/**
 * Create a mock Participant object
 */
export function createMockParticipant(overrides?: Partial<Participant>): Participant {
  participantSidCounter++;
  const identity = overrides?.identity ?? `user-${participantSidCounter}`;

  return {
    sid: `PA_mock_${participantSidCounter}`,
    identity,
    state: 'connected',
    tracks: [],
    metadata: '',
    joinedAt: Date.now(),
    name: overrides?.name ?? identity,
    version: 1,
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: ['camera', 'microphone', 'screen_share'],
      hidden: false,
      recorder: false,
      canUpdateMetadata: true,
    },
    region: 'us-west-2',
    isPublisher: true,
    ...overrides,
  };
}

/**
 * Create a mock ParticipantTrack object
 */
export function createMockParticipantTrack(
  overrides?: Partial<ParticipantTrack>,
): ParticipantTrack {
  return {
    sid: `TR_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    type: 'video',
    source: 'camera',
    muted: false,
    width: 1280,
    height: 720,
    simulcast: true,
    disabled: false,
    ...overrides,
  };
}

/**
 * Create a mock token string
 */
export function createMockToken(
  identity: string,
  room?: string,
  grants?: Partial<VideoGrant>,
): string {
  const payload = {
    sub: identity,
    video: {
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      ...grants,
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'test-api-key',
    jti: `token_mock_${Date.now()}`,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.mock-signature`;
}

/**
 * Create a mock WebhookEvent
 */
export function createMockWebhookEvent(
  eventType: WebhookEventType,
  room?: Partial<Room>,
  participant?: Partial<Participant>,
): WebhookEvent {
  eventIdCounter++;
  return {
    event: eventType,
    room: room ? createMockRoom(room) : undefined,
    participant: participant ? createMockParticipant(participant) : undefined,
    id: `EV_mock_${eventIdCounter}`,
    createdAt: Date.now(),
    numDropped: 0,
  };
}

/**
 * Create a valid webhook signature for testing
 */
export function createMockWebhookSignature(): string {
  return 'valid-mock-signature';
}

// =============================================================================
// EXPORTS
// =============================================================================

export const LiveKitFactories = {
  service: createMockLiveKitService,
  room: createMockRoom,
  participant: createMockParticipant,
  track: createMockParticipantTrack,
  token: createMockToken,
  webhookEvent: createMockWebhookEvent,
  webhookSignature: createMockWebhookSignature,
};

export default createMockLiveKitService;
