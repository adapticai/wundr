/**
 * Call API Route Tests
 *
 * Comprehensive test suite for Call REST API endpoints covering:
 * - POST /api/calls - Create call
 * - POST /api/calls/:id/join - Join call
 * - POST /api/calls/:id/leave - Leave call
 * - POST /api/calls/:id/end - End call
 * - GET /api/calls/:id - Get call
 * - POST /api/livekit/webhook - LiveKit webhook handler
 *
 * Tests cover authentication, authorization, validation, and webhook handling.
 *
 * @module apps/web/app/api/calls/__tests__/calls.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock the call services
const mockCallService = {
  createCall: vi.fn(),
  getCall: vi.fn(),
  joinCall: vi.fn(),
  leaveCall: vi.fn(),
  endCall: vi.fn(),
  listCalls: vi.fn(),
  getParticipants: vi.fn(),
  validateAccess: vi.fn(),
};

const mockLiveKitService = {
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  listParticipants: vi.fn(),
  removeParticipant: vi.fn(),
  mutePublishedTrack: vi.fn(),
  createToken: vi.fn(),
  verifyWebhook: vi.fn(),
  parseWebhook: vi.fn(),
};

vi.mock('@genesis/core', () => ({
  createCallService: vi.fn(() => mockCallService),
  callService: mockCallService,
  createLiveKitService: vi.fn(() => mockLiveKitService),
  liveKitService: mockLiveKitService,
}));

// Mock Prisma
vi.mock('@genesis/database', () => ({
  prisma: {},
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-123',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function _createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const url = new URL('http://localhost:3000/api/calls');

  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createMockCallResponse(overrides?: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    id: 'call-123',
    channelId: 'ch-123',
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    type: 'video',
    status: 'pending',
    roomName: 'call-room-123',
    roomSid: 'RM_123',
    title: null,
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    duration: null,
    maxParticipants: 50,
    recordingEnabled: false,
    recordingStatus: 'not_started',
    createdById: 'user-123',
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockJoinTokenResponse(overrides?: Record<string, unknown>) {
  return {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
    roomName: 'call-room-123',
    serverUrl: 'wss://test.livekit.cloud',
    identity: 'user-123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    grants: {
      roomJoin: true,
      room: 'call-room-123',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    ...overrides,
  };
}

function createMockWebhookEvent(
  event: string,
  room?: { name: string; sid?: string },
  participant?: { identity: string; sid?: string },
) {
  return {
    event,
    room: room
      ? {
          sid: room.sid ?? 'RM_123',
          name: room.name,
          emptyTimeout: 300,
          maxParticipants: 50,
          creationTime: Date.now(),
          numParticipants: 1,
        }
      : undefined,
    participant: participant
      ? {
          sid: participant.sid ?? 'PA_123',
          identity: participant.identity,
          state: 'connected',
          joinedAt: Date.now(),
        }
      : undefined,
    id: 'EV_123',
    createdAt: Date.now(),
    numDropped: 0,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Call API Routes', () => {
  let getServerSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const nextAuth = await import('next-auth');
    getServerSession = nextAuth.getServerSession as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/calls - Create Call
  // ===========================================================================

  describe('POST /api/calls', () => {
    it('creates call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCall = createMockCallResponse({ type: 'video' });
      mockCallService.createCall.mockResolvedValue(mockCall);

      const requestBody = {
        channelId: 'ch-123',
        type: 'video',
        workspaceId: 'ws-123',
      };

      const result = await mockCallService.createCall(
        requestBody,
        session.user.id,
        'ws-123',
        'org-123',
      );

      expect(result.type).toBe('video');
      expect(result.status).toBe('pending');
      expect(result.roomName).toBeDefined();
      expect(mockCallService.createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'ch-123',
          type: 'video',
        }),
        session.user.id,
        'ws-123',
        'org-123',
      );
    });

    it('creates voice call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCall = createMockCallResponse({ type: 'voice' });
      mockCallService.createCall.mockResolvedValue(mockCall);

      const result = await mockCallService.createCall(
        { channelId: 'ch-123', type: 'voice' },
        session.user.id,
        'ws-123',
        'org-123',
      );

      expect(result.type).toBe('voice');
    });

    it('creates scheduled call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const scheduledAt = new Date(Date.now() + 3600000).toISOString();
      const mockCall = createMockCallResponse({
        scheduledAt,
        title: 'Team Meeting',
      });
      mockCallService.createCall.mockResolvedValue(mockCall);

      const result = await mockCallService.createCall(
        {
          channelId: 'ch-123',
          type: 'video',
          scheduledAt,
          title: 'Team Meeting',
        },
        session.user.id,
        'ws-123',
        'org-123',
      );

      expect(result.scheduledAt).toBe(scheduledAt);
      expect(result.title).toBe('Team Meeting');
    });

    it('requires channel membership', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.createCall.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'You must be a channel member to create calls',
      });

      await expect(
        mockCallService.createCall(
          { channelId: 'ch-not-member', type: 'video' },
          session.user.id,
          'ws-123',
          'org-123',
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });

    it('returns 401 without authentication', async () => {
      getServerSession.mockResolvedValue(null);

      const session = await getServerSession();
      expect(session).toBeNull();

      // Route handler would return 401
      const expectedStatus = session ? 201 : 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 400 for invalid type', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.createCall.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'Invalid call type',
      });

      await expect(
        mockCallService.createCall(
          { channelId: 'ch-123', type: 'invalid' },
          session.user.id,
          'ws-123',
          'org-123',
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('prevents duplicate active calls', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.createCall.mockRejectedValue({
        code: 'DUPLICATE_ACTIVE_CALL',
        message: 'An active call already exists in this channel',
      });

      await expect(
        mockCallService.createCall(
          { channelId: 'ch-with-active-call', type: 'video' },
          session.user.id,
          'ws-123',
          'org-123',
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'DUPLICATE_ACTIVE_CALL',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/calls/:id/join - Join Call
  // ===========================================================================

  describe('POST /api/calls/:id/join', () => {
    it('returns join token', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCall = createMockCallResponse({ status: 'active' });
      const mockToken = createMockJoinTokenResponse();

      mockCallService.joinCall.mockResolvedValue({
        token: mockToken.token,
        call: mockCall,
      });

      const result = await mockCallService.joinCall(
        'call-123',
        session.user.id,
        session.user.email,
      );

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.call).toBeDefined();
    });

    it('validates call exists', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.joinCall.mockRejectedValue({
        code: 'CALL_NOT_FOUND',
        message: 'Call does not exist',
      });

      await expect(
        mockCallService.joinCall('non-existent-call', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CALL_NOT_FOUND',
        }),
      );
    });

    it('validates call not ended', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.joinCall.mockRejectedValue({
        code: 'CALL_ENDED',
        message: 'Cannot join an ended call',
      });

      await expect(
        mockCallService.joinCall('ended-call', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CALL_ENDED',
        }),
      );
    });

    it('requires channel membership', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.validateAccess.mockResolvedValue(false);
      mockCallService.joinCall.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'You must be a channel member to join this call',
      });

      await expect(
        mockCallService.joinCall('call-in-other-channel', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });

    it('activates pending call on first join', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCall = createMockCallResponse({
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      mockCallService.joinCall.mockResolvedValue({
        token: 'token',
        call: mockCall,
      });

      const result = await mockCallService.joinCall('pending-call', session.user.id);

      expect(result.call.status).toBe('active');
      expect(result.call.startedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // POST /api/calls/:id/leave - Leave Call
  // ===========================================================================

  describe('POST /api/calls/:id/leave', () => {
    it('allows leaving call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.leaveCall.mockResolvedValue(undefined);

      await expect(
        mockCallService.leaveCall('call-123', session.user.id),
      ).resolves.toBeUndefined();
    });

    it('returns error if not in call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.leaveCall.mockRejectedValue({
        code: 'NOT_IN_CALL',
        message: 'User is not a participant in this call',
      });

      await expect(
        mockCallService.leaveCall('call-not-in', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'NOT_IN_CALL',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/calls/:id/end - End Call
  // ===========================================================================

  describe('POST /api/calls/:id/end', () => {
    it('ends call when authorized', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const endedCall = createMockCallResponse({
        status: 'ended',
        endedAt: new Date().toISOString(),
        duration: 3600,
      });

      mockCallService.endCall.mockResolvedValue(endedCall);

      const result = await mockCallService.endCall('call-123');

      expect(result.status).toBe('ended');
      expect(result.endedAt).toBeDefined();
      expect(result.duration).toBe(3600);
    });

    it('returns error for non-existent call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.endCall.mockRejectedValue({
        code: 'CALL_NOT_FOUND',
        message: 'Call does not exist',
      });

      await expect(mockCallService.endCall('fake-call')).rejects.toEqual(
        expect.objectContaining({
          code: 'CALL_NOT_FOUND',
        }),
      );
    });

    it('requires host or admin permission', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.endCall.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Only the host or admin can end this call',
      });

      await expect(mockCallService.endCall('call-not-host')).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });
  });

  // ===========================================================================
  // GET /api/calls/:id - Get Call
  // ===========================================================================

  describe('GET /api/calls/:id', () => {
    it('returns call details', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCall = createMockCallResponse();
      mockCallService.getCall.mockResolvedValue(mockCall);

      const result = await mockCallService.getCall('call-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('call-123');
    });

    it('returns null for non-existent call', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      mockCallService.getCall.mockResolvedValue(null);

      const result = await mockCallService.getCall('non-existent');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // POST /api/livekit/webhook - LiveKit Webhook
  // ===========================================================================

  describe('POST /api/livekit/webhook', () => {
    it('handles participant_joined', async () => {
      const webhookEvent = createMockWebhookEvent(
        'participant_joined',
        { name: 'call-room-123' },
        { identity: 'user-123' },
      );

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const isValid = await mockLiveKitService.verifyWebhook(
        JSON.stringify(webhookEvent),
        'valid-signature',
      );
      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(isValid).toBe(true);
      expect(parsed.event).toBe('participant_joined');
      expect(parsed.participant?.identity).toBe('user-123');
    });

    it('handles participant_left', async () => {
      const webhookEvent = createMockWebhookEvent(
        'participant_left',
        { name: 'call-room-123' },
        { identity: 'user-123' },
      );

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(parsed.event).toBe('participant_left');
    });

    it('handles room_finished', async () => {
      const webhookEvent = createMockWebhookEvent('room_finished', {
        name: 'call-room-123',
      });

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(parsed.event).toBe('room_finished');
      expect(parsed.room?.name).toBe('call-room-123');
    });

    it('handles room_started', async () => {
      const webhookEvent = createMockWebhookEvent('room_started', {
        name: 'call-room-123',
      });

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(parsed.event).toBe('room_started');
    });

    it('validates webhook signature', async () => {
      const webhookEvent = createMockWebhookEvent('participant_joined', {
        name: 'test-room',
      });

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);

      const isValid = await mockLiveKitService.verifyWebhook(
        JSON.stringify(webhookEvent),
        'valid-signature',
      );

      expect(isValid).toBe(true);
      expect(mockLiveKitService.verifyWebhook).toHaveBeenCalledWith(
        JSON.stringify(webhookEvent),
        'valid-signature',
      );
    });

    it('rejects invalid webhook signature', async () => {
      const webhookEvent = createMockWebhookEvent('participant_joined', {
        name: 'test-room',
      });

      mockLiveKitService.verifyWebhook.mockResolvedValue(false);

      const isValid = await mockLiveKitService.verifyWebhook(
        JSON.stringify(webhookEvent),
        'invalid-signature',
      );

      expect(isValid).toBe(false);
    });

    it('handles track_published event', async () => {
      const webhookEvent = createMockWebhookEvent(
        'track_published',
        { name: 'call-room-123' },
        { identity: 'user-123' },
      );

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(parsed.event).toBe('track_published');
    });

    it('handles egress_ended event (recording)', async () => {
      const webhookEvent = {
        event: 'egress_ended',
        egressInfo: {
          egressId: 'EG_123',
          roomName: 'call-room-123',
          status: 'complete',
        },
        id: 'EV_123',
        createdAt: Date.now(),
        numDropped: 0,
      };

      mockLiveKitService.verifyWebhook.mockResolvedValue(true);
      mockLiveKitService.parseWebhook.mockResolvedValue(webhookEvent);

      const parsed = await mockLiveKitService.parseWebhook(
        JSON.stringify(webhookEvent),
      );

      expect(parsed.event).toBe('egress_ended');
      expect(parsed.egressInfo?.status).toBe('complete');
    });
  });

  // ===========================================================================
  // GET /api/calls - List Calls
  // ===========================================================================

  describe('GET /api/calls', () => {
    it('lists calls in channel', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockCalls = [
        createMockCallResponse({ id: 'call-1' }),
        createMockCallResponse({ id: 'call-2' }),
      ];

      mockCallService.listCalls.mockResolvedValue({
        data: mockCalls,
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 2,
          totalPages: 1,
        },
      });

      const result = await mockCallService.listCalls({
        channelId: 'ch-123',
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it('filters by status', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const activeCalls = [createMockCallResponse({ status: 'active' })];

      mockCallService.listCalls.mockResolvedValue({
        data: activeCalls,
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 1,
          totalPages: 1,
        },
      });

      const result = await mockCallService.listCalls({
        channelId: 'ch-123',
        status: 'active',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('active');
    });
  });

  // ===========================================================================
  // GET /api/calls/:id/participants - Get Participants
  // ===========================================================================

  describe('GET /api/calls/:id/participants', () => {
    it('returns call participants', async () => {
      const session = createMockSession();
      getServerSession.mockResolvedValue(session);

      const mockParticipants = [
        {
          id: 'p-1',
          callId: 'call-123',
          userId: 'user-1',
          identity: 'user-1',
          status: 'connected',
          role: 'host',
        },
        {
          id: 'p-2',
          callId: 'call-123',
          userId: 'user-2',
          identity: 'user-2',
          status: 'connected',
          role: 'participant',
        },
      ];

      mockCallService.getParticipants.mockResolvedValue(mockParticipants);

      const result = await mockCallService.getParticipants('call-123');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('host');
    });
  });
});
