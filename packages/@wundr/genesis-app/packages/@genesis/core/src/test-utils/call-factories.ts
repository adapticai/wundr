/**
 * Call Test Data Factories
 *
 * Factory functions for creating consistent mock call and huddle data in tests.
 * These factories provide sensible defaults while allowing overrides
 * for specific test scenarios.
 *
 * @module @genesis/core/test-utils/call-factories
 */

import { vi } from 'vitest';

// =============================================================================
// ID GENERATORS
// =============================================================================

let callIdCounter = 0;

/**
 * Generate a unique test ID for call entities
 */
export function generateCallTestId(prefix = 'call'): string {
  callIdCounter += 1;
  return `${prefix}_${Date.now()}_${callIdCounter}`;
}

/**
 * Reset the call ID counter (useful between test suites)
 */
export function resetCallIdCounter(): void {
  callIdCounter = 0;
}

// =============================================================================
// CALL TYPES
// =============================================================================

export type CallType = 'voice' | 'video' | 'huddle';

export type CallStatus = 'pending' | 'active' | 'ended' | 'failed';

export type ParticipantRole = 'host' | 'co_host' | 'participant' | 'viewer';

export type ParticipantStatus = 'invited' | 'joining' | 'connected' | 'reconnecting' | 'left';

export type RecordingStatus = 'not_started' | 'recording' | 'paused' | 'stopped' | 'failed';

// =============================================================================
// CALL INTERFACES
// =============================================================================

/**
 * Call entity
 */
export interface Call {
  id: string;
  channelId: string;
  workspaceId: string;
  organizationId: string;
  type: CallType;
  status: CallStatus;
  roomName: string;
  roomSid: string | null;
  title: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  maxParticipants: number;
  recordingEnabled: boolean;
  recordingStatus: RecordingStatus;
  createdById: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Huddle (persistent call room)
 */
export interface Huddle {
  id: string;
  channelId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description: string | null;
  roomName: string;
  roomSid: string | null;
  isActive: boolean;
  maxParticipants: number;
  autoJoin: boolean;
  persistentRoom: boolean;
  activeParticipants: number;
  lastActivityAt: string | null;
  createdById: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Call participant
 */
export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  identity: string;
  participantSid: string | null;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: string | null;
  leftAt: string | null;
  duration: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Join token response
 */
export interface JoinToken {
  token: string;
  roomName: string;
  serverUrl: string;
  identity: string;
  expiresAt: string;
  grants: {
    roomJoin: boolean;
    room: string;
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
  };
}

/**
 * Call summary/stats
 */
export interface CallSummary {
  callId: string;
  totalParticipants: number;
  peakParticipants: number;
  totalDuration: number;
  averageParticipantDuration: number;
  recordingUrl: string | null;
  transcriptUrl: string | null;
}

/**
 * Call creation input
 */
export interface CreateCallInput {
  channelId: string;
  type: CallType;
  title?: string;
  scheduledAt?: string;
  maxParticipants?: number;
  recordingEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Huddle creation input
 */
export interface CreateHuddleInput {
  channelId: string;
  name: string;
  description?: string;
  maxParticipants?: number;
  autoJoin?: boolean;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CALL FACTORIES
// =============================================================================

/**
 * Create a mock call object
 */
export function createMockCall(overrides?: Partial<Call>): Call {
  const id = overrides?.id ?? generateCallTestId('call');
  const now = new Date().toISOString();

  return {
    id,
    channelId: overrides?.channelId ?? generateCallTestId('channel'),
    workspaceId: overrides?.workspaceId ?? generateCallTestId('workspace'),
    organizationId: overrides?.organizationId ?? generateCallTestId('org'),
    type: 'video',
    status: 'pending',
    roomName: `call-${id}`,
    roomSid: null,
    title: null,
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    duration: null,
    maxParticipants: 50,
    recordingEnabled: false,
    recordingStatus: 'not_started',
    createdById: overrides?.createdById ?? generateCallTestId('user'),
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock active call
 */
export function createMockActiveCall(overrides?: Partial<Call>): Call {
  const startedAt = new Date(Date.now() - 300000).toISOString(); // 5 minutes ago

  return createMockCall({
    status: 'active',
    startedAt,
    roomSid: `RM_${Date.now()}_active`,
    ...overrides,
  });
}

/**
 * Create a mock ended call
 */
export function createMockEndedCall(overrides?: Partial<Call>): Call {
  const startedAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  const endedAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
  const duration = 3540; // ~59 minutes in seconds

  return createMockCall({
    status: 'ended',
    startedAt,
    endedAt,
    duration,
    roomSid: `RM_${Date.now()}_ended`,
    ...overrides,
  });
}

/**
 * Create a mock scheduled call
 */
export function createMockScheduledCall(
  scheduledAt: Date,
  overrides?: Partial<Call>,
): Call {
  return createMockCall({
    status: 'pending',
    scheduledAt: scheduledAt.toISOString(),
    title: overrides?.title ?? 'Scheduled Meeting',
    ...overrides,
  });
}

/**
 * Create multiple mock calls
 */
export function createMockCallList(
  count: number,
  overrides?: Partial<Call>,
): Call[] {
  return Array.from({ length: count }, () => createMockCall(overrides));
}

// =============================================================================
// HUDDLE FACTORIES
// =============================================================================

/**
 * Create a mock huddle object
 */
export function createMockHuddle(overrides?: Partial<Huddle>): Huddle {
  const id = overrides?.id ?? generateCallTestId('huddle');
  const now = new Date().toISOString();

  return {
    id,
    channelId: overrides?.channelId ?? generateCallTestId('channel'),
    workspaceId: overrides?.workspaceId ?? generateCallTestId('workspace'),
    organizationId: overrides?.organizationId ?? generateCallTestId('org'),
    name: overrides?.name ?? 'Team Huddle',
    description: null,
    roomName: `huddle-${id}`,
    roomSid: null,
    isActive: false,
    maxParticipants: 25,
    autoJoin: false,
    persistentRoom: true,
    activeParticipants: 0,
    lastActivityAt: null,
    createdById: overrides?.createdById ?? generateCallTestId('user'),
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock active huddle
 */
export function createMockActiveHuddle(
  participantCount = 3,
  overrides?: Partial<Huddle>,
): Huddle {
  return createMockHuddle({
    isActive: true,
    activeParticipants: participantCount,
    roomSid: `RM_${Date.now()}_huddle`,
    lastActivityAt: new Date().toISOString(),
    ...overrides,
  });
}

/**
 * Create multiple mock huddles
 */
export function createMockHuddleList(
  count: number,
  overrides?: Partial<Huddle>,
): Huddle[] {
  return Array.from({ length: count }, (_, i) =>
    createMockHuddle({
      name: `Huddle ${i + 1}`,
      ...overrides,
    }),
  );
}

// =============================================================================
// PARTICIPANT FACTORIES
// =============================================================================

/**
 * Create a mock call participant
 */
export function createMockCallParticipant(
  overrides?: Partial<CallParticipant>,
): CallParticipant {
  const id = overrides?.id ?? generateCallTestId('participant');
  const userId = overrides?.userId ?? generateCallTestId('user');
  const now = new Date().toISOString();

  return {
    id,
    callId: overrides?.callId ?? generateCallTestId('call'),
    userId,
    identity: userId,
    participantSid: null,
    role: 'participant',
    status: 'invited',
    joinedAt: null,
    leftAt: null,
    duration: null,
    hasAudio: true,
    hasVideo: true,
    isScreenSharing: false,
    isMuted: false,
    isVideoOff: false,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock connected participant
 */
export function createMockConnectedParticipant(
  overrides?: Partial<CallParticipant>,
): CallParticipant {
  return createMockCallParticipant({
    status: 'connected',
    joinedAt: new Date(Date.now() - 60000).toISOString(),
    participantSid: `PA_${Date.now()}_connected`,
    ...overrides,
  });
}

/**
 * Create a mock host participant
 */
export function createMockHostParticipant(
  overrides?: Partial<CallParticipant>,
): CallParticipant {
  return createMockConnectedParticipant({
    role: 'host',
    ...overrides,
  });
}

/**
 * Create multiple mock participants for a call
 */
export function createMockCallParticipantList(
  callId: string,
  count: number,
  overrides?: Partial<CallParticipant>,
): CallParticipant[] {
  return Array.from({ length: count }, (_, i) =>
    createMockConnectedParticipant({
      callId,
      role: i === 0 ? 'host' : 'participant',
      ...overrides,
    }),
  );
}

// =============================================================================
// JOIN TOKEN FACTORIES
// =============================================================================

/**
 * Create a mock join token
 */
export function createMockJoinToken(overrides?: Partial<JoinToken>): JoinToken {
  const roomName = overrides?.roomName ?? `room-${generateCallTestId('room')}`;
  const identity = overrides?.identity ?? generateCallTestId('user');
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  const payload = {
    sub: identity,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'test-api-key',
    jti: `token_${Date.now()}`,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.mock-signature`;

  return {
    token,
    roomName,
    serverUrl: 'wss://test.livekit.cloud',
    identity,
    expiresAt,
    grants: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    ...overrides,
  };
}

/**
 * Create a mock viewer-only join token (no publish)
 */
export function createMockViewerToken(overrides?: Partial<JoinToken>): JoinToken {
  const token = createMockJoinToken(overrides);
  token.grants.canPublish = false;
  return token;
}

// =============================================================================
// CALL SUMMARY FACTORIES
// =============================================================================

/**
 * Create a mock call summary
 */
export function createMockCallSummary(overrides?: Partial<CallSummary>): CallSummary {
  return {
    callId: overrides?.callId ?? generateCallTestId('call'),
    totalParticipants: 5,
    peakParticipants: 4,
    totalDuration: 3600,
    averageParticipantDuration: 2400,
    recordingUrl: null,
    transcriptUrl: null,
    ...overrides,
  };
}

/**
 * Create a mock call summary with recording
 */
export function createMockCallSummaryWithRecording(
  callId: string,
  overrides?: Partial<CallSummary>,
): CallSummary {
  return createMockCallSummary({
    callId,
    recordingUrl: `https://storage.example.com/recordings/${callId}.mp4`,
    transcriptUrl: `https://storage.example.com/transcripts/${callId}.vtt`,
    ...overrides,
  });
}

// =============================================================================
// INPUT FACTORIES
// =============================================================================

/**
 * Create mock call creation input
 */
export function createMockCreateCallInput(
  overrides?: Partial<CreateCallInput>,
): CreateCallInput {
  return {
    channelId: generateCallTestId('channel'),
    type: 'video',
    ...overrides,
  };
}

/**
 * Create mock huddle creation input
 */
export function createMockCreateHuddleInput(
  overrides?: Partial<CreateHuddleInput>,
): CreateHuddleInput {
  return {
    channelId: generateCallTestId('channel'),
    name: 'New Huddle',
    ...overrides,
  };
}

// =============================================================================
// MOCK SERVICE FACTORIES
// =============================================================================

/**
 * Mock call service interface for type safety
 */
export interface MockCallService {
  createCall: ReturnType<typeof vi.fn>;
  getCall: ReturnType<typeof vi.fn>;
  listCalls: ReturnType<typeof vi.fn>;
  endCall: ReturnType<typeof vi.fn>;
  joinCall: ReturnType<typeof vi.fn>;
  leaveCall: ReturnType<typeof vi.fn>;
  updateCall: ReturnType<typeof vi.fn>;
  getCallParticipants: ReturnType<typeof vi.fn>;
  getCallSummary: ReturnType<typeof vi.fn>;
  startRecording: ReturnType<typeof vi.fn>;
  stopRecording: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock call service for testing call-related functionality
 *
 * @returns A mock call service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const callService = createMockCallService();
 * callService.createCall.mockResolvedValue(createMockCall());
 * await callService.createCall({ channelId: 'ch_123', type: 'video' });
 * expect(callService.createCall).toHaveBeenCalledOnce();
 * ```
 */
export function createMockCallService(): MockCallService {
  return {
    createCall: vi.fn(),
    getCall: vi.fn(),
    listCalls: vi.fn(),
    endCall: vi.fn(),
    joinCall: vi.fn(),
    leaveCall: vi.fn(),
    updateCall: vi.fn(),
    getCallParticipants: vi.fn(),
    getCallSummary: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  };
}

/**
 * Mock huddle service interface for type safety
 */
export interface MockHuddleService {
  createHuddle: ReturnType<typeof vi.fn>;
  getHuddle: ReturnType<typeof vi.fn>;
  listHuddles: ReturnType<typeof vi.fn>;
  updateHuddle: ReturnType<typeof vi.fn>;
  deleteHuddle: ReturnType<typeof vi.fn>;
  joinHuddle: ReturnType<typeof vi.fn>;
  leaveHuddle: ReturnType<typeof vi.fn>;
  getActiveParticipants: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock huddle service for testing huddle functionality
 *
 * @returns A mock huddle service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const huddleService = createMockHuddleService();
 * huddleService.createHuddle.mockResolvedValue(createMockHuddle());
 * await huddleService.createHuddle({ channelId: 'ch_123', name: 'Team Standup' });
 * expect(huddleService.createHuddle).toHaveBeenCalledOnce();
 * ```
 */
export function createMockHuddleService(): MockHuddleService {
  return {
    createHuddle: vi.fn(),
    getHuddle: vi.fn(),
    listHuddles: vi.fn(),
    updateHuddle: vi.fn(),
    deleteHuddle: vi.fn(),
    joinHuddle: vi.fn(),
    leaveHuddle: vi.fn(),
    getActiveParticipants: vi.fn(),
  };
}

/**
 * Mock LiveKit service wrapper interface for type safety
 */
export interface MockLiveKitServiceWrapper {
  createRoom: ReturnType<typeof vi.fn>;
  deleteRoom: ReturnType<typeof vi.fn>;
  getRoom: ReturnType<typeof vi.fn>;
  listRooms: ReturnType<typeof vi.fn>;
  generateToken: ReturnType<typeof vi.fn>;
  listParticipants: ReturnType<typeof vi.fn>;
  removeParticipant: ReturnType<typeof vi.fn>;
  muteParticipant: ReturnType<typeof vi.fn>;
  handleWebhook: ReturnType<typeof vi.fn>;
  verifyWebhook: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock LiveKit service wrapper for testing video/voice call integration
 *
 * @returns A mock LiveKit service with all methods as vi.fn() mocks
 *
 * @example
 * ```typescript
 * const liveKitService = createMockLiveKitServiceWrapper();
 * liveKitService.generateToken.mockResolvedValue(createMockJoinToken());
 * const token = await liveKitService.generateToken('user_123', 'room_456');
 * expect(token).toBeDefined();
 * ```
 */
export function createMockLiveKitServiceWrapper(): MockLiveKitServiceWrapper {
  return {
    createRoom: vi.fn(),
    deleteRoom: vi.fn(),
    getRoom: vi.fn(),
    listRooms: vi.fn(),
    generateToken: vi.fn(),
    listParticipants: vi.fn(),
    removeParticipant: vi.fn(),
    muteParticipant: vi.fn(),
    handleWebhook: vi.fn(),
    verifyWebhook: vi.fn(),
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const CallFactories = {
  // Calls
  call: createMockCall,
  activeCall: createMockActiveCall,
  endedCall: createMockEndedCall,
  scheduledCall: createMockScheduledCall,
  callList: createMockCallList,

  // Huddles
  huddle: createMockHuddle,
  activeHuddle: createMockActiveHuddle,
  huddleList: createMockHuddleList,

  // Participants
  participant: createMockCallParticipant,
  connectedParticipant: createMockConnectedParticipant,
  hostParticipant: createMockHostParticipant,
  participantList: createMockCallParticipantList,

  // Tokens
  joinToken: createMockJoinToken,
  viewerToken: createMockViewerToken,

  // Summaries
  callSummary: createMockCallSummary,
  callSummaryWithRecording: createMockCallSummaryWithRecording,

  // Inputs
  createCallInput: createMockCreateCallInput,
  createHuddleInput: createMockCreateHuddleInput,

  // Services
  callService: createMockCallService,
  huddleService: createMockHuddleService,
  liveKitService: createMockLiveKitServiceWrapper,

  // Utilities
  generateId: generateCallTestId,
  resetIdCounter: resetCallIdCounter,
};

export default CallFactories;
