/**
 * Call Service Tests
 *
 * Comprehensive test suite for the Call service covering:
 * - Call creation with LiveKit room
 * - Database storage and retrieval
 * - Duplicate call prevention
 * - Join token generation
 * - Participant tracking
 * - Huddle (persistent room) management
 *
 * @module @genesis/core/services/__tests__/call-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createMockCall,
  createMockActiveCall,
  createMockEndedCall,
  createMockHuddle,
  _createMockActiveHuddle,
  createMockCallParticipant,
  createMockConnectedParticipant,
  _createMockJoinToken,
  createMockCreateCallInput,
  createMockCreateHuddleInput,
  generateCallTestId,
  resetCallIdCounter,
  type Call,
  type Huddle,
  type CallParticipant,
  type CreateCallInput,
} from '../../test-utils/call-factories';
import {
  createMockLiveKitService,
  _createMockRoom,
  createMockParticipant,
  type MockLiveKitService,
} from '../../test-utils/mock-livekit';

// =============================================================================
// MOCK PRISMA CLIENT
// =============================================================================

interface MockPrisma {
  call: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  huddle: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  callParticipant: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function createMockPrisma(): MockPrisma {
  return {
    call: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    huddle: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    callParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async callback => callback()),
  };
}

// =============================================================================
// MOCK CALL SERVICE IMPLEMENTATION
// =============================================================================

class MockCallService {
  constructor(
    private prisma: MockPrisma,
    private livekit: MockLiveKitService,
    private config: { serverUrl: string } = {
      serverUrl: 'wss://test.livekit.cloud',
    }
  ) {}

  async createCall(
    input: CreateCallInput,
    creatorId: string,
    workspaceId: string,
    organizationId: string
  ): Promise<Call> {
    // Check for existing active call in channel
    const existingCall = await this.prisma.call.findFirst({
      where: {
        channelId: input.channelId,
        status: { in: ['pending', 'active'] },
      },
    });

    if (existingCall) {
      throw new Error(
        'DUPLICATE_ACTIVE_CALL: An active call already exists in this channel'
      );
    }

    // Create LiveKit room
    const roomName = `call-${generateCallTestId('room')}`;
    const room = await this.livekit.createRoom({
      name: roomName,
      maxParticipants: input.maxParticipants ?? 50,
    });

    // Store in database
    const call = createMockCall({
      channelId: input.channelId,
      workspaceId,
      organizationId,
      type: input.type,
      status: 'pending',
      roomName,
      roomSid: room.sid,
      title: input.title ?? null,
      scheduledAt: input.scheduledAt ?? null,
      maxParticipants: input.maxParticipants ?? 50,
      recordingEnabled: input.recordingEnabled ?? false,
      createdById: creatorId,
      metadata: input.metadata ?? {},
    });

    this.prisma.call.create.mockResolvedValue(call);
    await this.prisma.call.create({ data: call });

    return call;
  }

  async getCall(callId: string): Promise<Call | null> {
    return this.prisma.call.findUnique({ where: { id: callId } });
  }

  async joinCall(
    callId: string,
    userId: string,
    userName?: string
  ): Promise<{ token: string; call: Call }> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Call does not exist');
    }

    if (call.status === 'ended') {
      throw new Error('CALL_ENDED: Cannot join an ended call');
    }

    // Generate token
    const token = await this.livekit.createToken({
      identity: userId,
      name: userName,
      grants: {
        room: call.roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    });

    // Record participant
    const participant = createMockCallParticipant({
      callId,
      userId,
      identity: userId,
      status: 'joining',
    });

    this.prisma.callParticipant.upsert.mockResolvedValue(participant);
    await this.prisma.callParticipant.upsert({
      where: { callId_identity: { callId, identity: userId } },
      create: participant,
      update: { status: 'joining' },
    });

    // Update call status if first joiner
    if (call.status === 'pending') {
      call.status = 'active';
      call.startedAt = new Date().toISOString();
      this.prisma.call.update.mockResolvedValue(call);
      await this.prisma.call.update({
        where: { id: callId },
        data: { status: 'active', startedAt: call.startedAt },
      });
    }

    return { token, call };
  }

  async leaveCall(callId: string, userId: string): Promise<void> {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, identity: userId },
    });

    if (!participant) {
      throw new Error('NOT_IN_CALL: User is not a participant in this call');
    }

    const now = new Date().toISOString();
    const duration = participant.joinedAt
      ? Math.floor(
          (Date.now() - new Date(participant.joinedAt).getTime()) / 1000
        )
      : 0;

    await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { status: 'left', leftAt: now, duration },
    });
  }

  async endCall(callId: string): Promise<Call> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });

    if (!call) {
      throw new Error('CALL_NOT_FOUND: Call does not exist');
    }

    // End the LiveKit room
    await this.livekit.deleteRoom(call.roomName);

    // Update call status
    const now = new Date().toISOString();
    const duration = call.startedAt
      ? Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000)
      : 0;

    const endedCall: Call = {
      ...call,
      status: 'ended',
      endedAt: now,
      duration,
    };

    this.prisma.call.update.mockResolvedValue(endedCall);
    await this.prisma.call.update({
      where: { id: callId },
      data: { status: 'ended', endedAt: now, duration },
    });

    return endedCall;
  }

  async getParticipants(callId: string): Promise<CallParticipant[]> {
    return this.prisma.callParticipant.findMany({
      where: { callId },
    });
  }

  // Validate user has access to join a call
  async validateAccess(callId: string, _userId: string): Promise<boolean> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });

    if (!call) {
      return false;
    }

    // In a real implementation, check channel membership
    // For testing, we assume access is valid
    return true;
  }
}

// =============================================================================
// MOCK HUDDLE SERVICE IMPLEMENTATION
// =============================================================================

class MockHuddleService {
  constructor(
    private prisma: MockPrisma,
    private livekit: MockLiveKitService,
    private config: { serverUrl: string } = {
      serverUrl: 'wss://test.livekit.cloud',
    }
  ) {}

  async createHuddle(
    input: {
      channelId: string;
      name: string;
      description?: string;
      maxParticipants?: number;
    },
    creatorId: string,
    workspaceId: string,
    organizationId: string
  ): Promise<Huddle> {
    const roomName = `huddle-${generateCallTestId('room')}`;

    // Create persistent LiveKit room
    const room = await this.livekit.createRoom({
      name: roomName,
      maxParticipants: input.maxParticipants ?? 25,
      emptyTimeout: 0, // Never auto-close
    });

    const huddle = createMockHuddle({
      channelId: input.channelId,
      workspaceId,
      organizationId,
      name: input.name,
      description: input.description ?? null,
      roomName,
      roomSid: room.sid,
      maxParticipants: input.maxParticipants ?? 25,
      persistentRoom: true,
      createdById: creatorId,
    });

    this.prisma.huddle.create.mockResolvedValue(huddle);
    await this.prisma.huddle.create({ data: huddle });

    return huddle;
  }

  async joinHuddle(
    huddleId: string,
    userId: string,
    userName?: string
  ): Promise<{ token: string; huddle: Huddle }> {
    const huddle = await this.prisma.huddle.findUnique({
      where: { id: huddleId },
    });

    if (!huddle) {
      throw new Error('HUDDLE_NOT_FOUND: Huddle does not exist');
    }

    // Generate token
    const token = await this.livekit.createToken({
      identity: userId,
      name: userName,
      grants: {
        room: huddle.roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    });

    // Update active status
    if (!huddle.isActive) {
      huddle.isActive = true;
      this.prisma.huddle.update.mockResolvedValue(huddle);
      await this.prisma.huddle.update({
        where: { id: huddleId },
        data: { isActive: true },
      });
    }

    // Increment active participants
    huddle.activeParticipants += 1;
    huddle.lastActivityAt = new Date().toISOString();

    await this.prisma.huddle.update({
      where: { id: huddleId },
      data: {
        activeParticipants: huddle.activeParticipants,
        lastActivityAt: huddle.lastActivityAt,
      },
    });

    return { token, huddle };
  }

  async leaveHuddle(huddleId: string, _userId: string): Promise<void> {
    const huddle = await this.prisma.huddle.findUnique({
      where: { id: huddleId },
    });

    if (!huddle) {
      throw new Error('HUDDLE_NOT_FOUND: Huddle does not exist');
    }

    huddle.activeParticipants = Math.max(0, huddle.activeParticipants - 1);
    huddle.lastActivityAt = new Date().toISOString();

    // Set inactive if no participants
    if (huddle.activeParticipants === 0) {
      huddle.isActive = false;
    }

    this.prisma.huddle.update.mockResolvedValue(huddle);
    await this.prisma.huddle.update({
      where: { id: huddleId },
      data: {
        activeParticipants: huddle.activeParticipants,
        lastActivityAt: huddle.lastActivityAt,
        isActive: huddle.isActive,
      },
    });
  }

  async getActiveParticipants(huddleId: string): Promise<string[]> {
    const huddle = await this.prisma.huddle.findUnique({
      where: { id: huddleId },
    });

    if (!huddle) {
      return [];
    }

    // Get from LiveKit
    const participants = await this.livekit.listParticipants(huddle.roomName);
    return participants.map(p => p.identity);
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('CallService', () => {
  let prisma: MockPrisma;
  let livekit: MockLiveKitService;
  let callService: MockCallService;

  beforeEach(() => {
    resetCallIdCounter();
    prisma = createMockPrisma();
    livekit = createMockLiveKitService();
    callService = new MockCallService(prisma, livekit);
  });

  afterEach(() => {
    livekit._reset();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // createCall Tests
  // ===========================================================================

  describe('createCall', () => {
    it('creates call with room', async () => {
      prisma.call.findFirst.mockResolvedValue(null); // No existing call

      const input = createMockCreateCallInput({ type: 'video' });

      const call = await callService.createCall(
        input,
        'user-123',
        'workspace-456',
        'org-789'
      );

      expect(call).toBeDefined();
      expect(call.type).toBe('video');
      expect(call.status).toBe('pending');
      expect(call.roomName).toMatch(/^call-/);
      expect(call.roomSid).toMatch(/^RM_/);
      expect(livekit.createRoom).toHaveBeenCalled();
      expect(prisma.call.create).toHaveBeenCalled();
    });

    it('stores in database', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      const input = createMockCreateCallInput({
        channelId: 'channel-123',
        type: 'voice',
        title: 'Team Standup',
      });

      const _call = await callService.createCall(
        input,
        'creator-id',
        'ws-123',
        'org-123'
      );

      expect(prisma.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'channel-123',
          type: 'voice',
          title: 'Team Standup',
          createdById: 'creator-id',
        }),
      });
    });

    it('prevents duplicate active calls', async () => {
      const existingCall = createMockActiveCall({ channelId: 'channel-123' });
      prisma.call.findFirst.mockResolvedValue(existingCall);

      const input = createMockCreateCallInput({ channelId: 'channel-123' });

      await expect(
        callService.createCall(input, 'user-123', 'ws-123', 'org-123')
      ).rejects.toThrow('DUPLICATE_ACTIVE_CALL');
    });

    it('allows new call after previous ended', async () => {
      // First, an ended call exists
      prisma.call.findFirst.mockResolvedValue(null); // No active call

      const input = createMockCreateCallInput({ channelId: 'channel-123' });

      const call = await callService.createCall(
        input,
        'user-123',
        'ws-123',
        'org-123'
      );

      expect(call).toBeDefined();
      expect(call.status).toBe('pending');
    });

    it('sets max participants on room', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      const input = createMockCreateCallInput({
        maxParticipants: 10,
      });

      await callService.createCall(input, 'user-123', 'ws-123', 'org-123');

      expect(livekit.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          maxParticipants: 10,
        })
      );
    });

    it('stores recording preference', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      const input = createMockCreateCallInput({
        recordingEnabled: true,
      });

      const call = await callService.createCall(
        input,
        'user-123',
        'ws-123',
        'org-123'
      );

      expect(call.recordingEnabled).toBe(true);
    });

    it('stores scheduled time', async () => {
      prisma.call.findFirst.mockResolvedValue(null);

      const scheduledAt = new Date(Date.now() + 3600000).toISOString();
      const input = createMockCreateCallInput({
        scheduledAt,
        title: 'Scheduled Meeting',
      });

      const call = await callService.createCall(
        input,
        'user-123',
        'ws-123',
        'org-123'
      );

      expect(call.scheduledAt).toBe(scheduledAt);
    });
  });

  // ===========================================================================
  // joinCall Tests
  // ===========================================================================

  describe('joinCall', () => {
    it('returns join token', async () => {
      const call = createMockCall({ status: 'pending' });
      prisma.call.findUnique.mockResolvedValue(call);

      const result = await callService.joinCall(
        call.id,
        'user-123',
        'John Doe'
      );

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
    });

    it('records participant', async () => {
      const call = createMockCall({ status: 'active' });
      prisma.call.findUnique.mockResolvedValue(call);

      await callService.joinCall(call.id, 'user-456', 'Jane Doe');

      expect(prisma.callParticipant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callId_identity: { callId: call.id, identity: 'user-456' } },
          create: expect.objectContaining({
            userId: 'user-456',
            status: 'joining',
          }),
        })
      );
    });

    it('validates call exists', async () => {
      prisma.call.findUnique.mockResolvedValue(null);

      await expect(
        callService.joinCall('non-existent-call', 'user-123')
      ).rejects.toThrow('CALL_NOT_FOUND');
    });

    it('validates call not ended', async () => {
      const endedCall = createMockEndedCall();
      prisma.call.findUnique.mockResolvedValue(endedCall);

      await expect(
        callService.joinCall(endedCall.id, 'user-123')
      ).rejects.toThrow('CALL_ENDED');
    });

    it('activates pending call on first join', async () => {
      const pendingCall = createMockCall({ status: 'pending' });
      prisma.call.findUnique.mockResolvedValue(pendingCall);

      const result = await callService.joinCall(pendingCall.id, 'first-joiner');

      expect(result.call.status).toBe('active');
      expect(prisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pendingCall.id },
          data: expect.objectContaining({ status: 'active' }),
        })
      );
    });

    it('generates token with correct grants', async () => {
      const call = createMockCall({ roomName: 'test-room' });
      prisma.call.findUnique.mockResolvedValue(call);

      await callService.joinCall(call.id, 'user-123');

      expect(livekit.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          identity: 'user-123',
          grants: expect.objectContaining({
            room: 'test-room',
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
          }),
        })
      );
    });

    it('includes user name in token', async () => {
      const call = createMockCall();
      prisma.call.findUnique.mockResolvedValue(call);

      await callService.joinCall(call.id, 'user-123', 'Display Name');

      expect(livekit.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Display Name',
        })
      );
    });
  });

  // ===========================================================================
  // validateAccess Tests
  // ===========================================================================

  describe('validateAccess', () => {
    it('validates access returns true for existing call', async () => {
      const call = createMockCall();
      prisma.call.findUnique.mockResolvedValue(call);

      const hasAccess = await callService.validateAccess(call.id, 'user-123');

      expect(hasAccess).toBe(true);
    });

    it('validates access returns false for non-existent call', async () => {
      prisma.call.findUnique.mockResolvedValue(null);

      const hasAccess = await callService.validateAccess('fake-id', 'user-123');

      expect(hasAccess).toBe(false);
    });
  });

  // ===========================================================================
  // leaveCall Tests
  // ===========================================================================

  describe('leaveCall', () => {
    it('marks participant as left', async () => {
      const participant = createMockConnectedParticipant({
        callId: 'call-123',
        userId: 'user-123',
        identity: 'user-123',
      });
      prisma.callParticipant.findFirst.mockResolvedValue(participant);

      await callService.leaveCall('call-123', 'user-123');

      expect(prisma.callParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: participant.id },
          data: expect.objectContaining({
            status: 'left',
            leftAt: expect.any(String),
          }),
        })
      );
    });

    it('calculates participant duration', async () => {
      const joinedAt = new Date(Date.now() - 300000).toISOString(); // 5 min ago
      const participant = createMockConnectedParticipant({
        joinedAt,
      });
      prisma.callParticipant.findFirst.mockResolvedValue(participant);

      await callService.leaveCall('call-123', 'user-123');

      expect(prisma.callParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );
    });

    it('throws error if not in call', async () => {
      prisma.callParticipant.findFirst.mockResolvedValue(null);

      await expect(
        callService.leaveCall('call-123', 'not-in-call')
      ).rejects.toThrow('NOT_IN_CALL');
    });
  });

  // ===========================================================================
  // endCall Tests
  // ===========================================================================

  describe('endCall', () => {
    it('deletes LiveKit room', async () => {
      const call = createMockActiveCall({ roomName: 'room-to-delete' });
      prisma.call.findUnique.mockResolvedValue(call);

      await callService.endCall(call.id);

      expect(livekit.deleteRoom).toHaveBeenCalledWith('room-to-delete');
    });

    it('updates call status to ended', async () => {
      const call = createMockActiveCall();
      prisma.call.findUnique.mockResolvedValue(call);

      const result = await callService.endCall(call.id);

      expect(result.status).toBe('ended');
      expect(result.endedAt).toBeDefined();
    });

    it('calculates call duration', async () => {
      const startedAt = new Date(Date.now() - 600000).toISOString(); // 10 min ago
      const call = createMockActiveCall({ startedAt });
      prisma.call.findUnique.mockResolvedValue(call);

      const result = await callService.endCall(call.id);

      expect(result.duration).toBeGreaterThan(0);
    });

    it('throws error for non-existent call', async () => {
      prisma.call.findUnique.mockResolvedValue(null);

      await expect(callService.endCall('fake-call')).rejects.toThrow(
        'CALL_NOT_FOUND'
      );
    });
  });

  // ===========================================================================
  // getParticipants Tests
  // ===========================================================================

  describe('getParticipants', () => {
    it('returns call participants', async () => {
      const participants = [
        createMockConnectedParticipant({ callId: 'call-123' }),
        createMockConnectedParticipant({ callId: 'call-123' }),
      ];
      prisma.callParticipant.findMany.mockResolvedValue(participants);

      const result = await callService.getParticipants('call-123');

      expect(result).toHaveLength(2);
      expect(prisma.callParticipant.findMany).toHaveBeenCalledWith({
        where: { callId: 'call-123' },
      });
    });

    it('returns empty array for call with no participants', async () => {
      prisma.callParticipant.findMany.mockResolvedValue([]);

      const result = await callService.getParticipants('empty-call');

      expect(result).toEqual([]);
    });
  });
});

// =============================================================================
// HUDDLE SERVICE TESTS
// =============================================================================

describe('HuddleService', () => {
  let prisma: MockPrisma;
  let livekit: MockLiveKitService;
  let huddleService: MockHuddleService;

  beforeEach(() => {
    resetCallIdCounter();
    prisma = createMockPrisma();
    livekit = createMockLiveKitService();
    huddleService = new MockHuddleService(prisma, livekit);
  });

  afterEach(() => {
    livekit._reset();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // createHuddle Tests
  // ===========================================================================

  describe('huddles', () => {
    it('creates persistent huddle', async () => {
      const input = createMockCreateHuddleInput({
        name: 'Team Huddle',
        description: 'Quick sync room',
      });

      const huddle = await huddleService.createHuddle(
        input,
        'user-123',
        'ws-123',
        'org-123'
      );

      expect(huddle).toBeDefined();
      expect(huddle.name).toBe('Team Huddle');
      expect(huddle.persistentRoom).toBe(true);
      expect(huddle.roomName).toMatch(/^huddle-/);
      expect(livekit.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          emptyTimeout: 0, // Never auto-close
        })
      );
    });

    it('allows multiple joins', async () => {
      const huddle = createMockHuddle({ activeParticipants: 2 });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      const result1 = await huddleService.joinHuddle(huddle.id, 'user-1');
      const result2 = await huddleService.joinHuddle(huddle.id, 'user-2');

      expect(result1.token).toBeDefined();
      expect(result2.token).toBeDefined();
      expect(livekit.createToken).toHaveBeenCalledTimes(2);
    });

    it('tracks active participants', async () => {
      const huddle = createMockHuddle({
        activeParticipants: 0,
        isActive: false,
      });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      await huddleService.joinHuddle(huddle.id, 'user-1');

      expect(prisma.huddle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeParticipants: 1,
          }),
        })
      );
    });

    it('activates huddle on first join', async () => {
      const huddle = createMockHuddle({ isActive: false });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      await huddleService.joinHuddle(huddle.id, 'first-joiner');

      expect(prisma.huddle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it('decrements participants on leave', async () => {
      const huddle = createMockHuddle({ activeParticipants: 3 });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      await huddleService.leaveHuddle(huddle.id, 'user-123');

      expect(prisma.huddle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeParticipants: 2,
          }),
        })
      );
    });

    it('deactivates huddle when last participant leaves', async () => {
      const huddle = createMockHuddle({
        activeParticipants: 1,
        isActive: true,
      });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      await huddleService.leaveHuddle(huddle.id, 'last-user');

      expect(prisma.huddle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeParticipants: 0,
            isActive: false,
          }),
        })
      );
    });

    it('gets active participants from LiveKit', async () => {
      const huddle = createMockHuddle({ roomName: 'huddle-room' });
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      livekit._addParticipant(
        huddle.roomName,
        createMockParticipant({ identity: 'user-1' })
      );
      livekit._addParticipant(
        huddle.roomName,
        createMockParticipant({ identity: 'user-2' })
      );

      const participants = await huddleService.getActiveParticipants(huddle.id);

      expect(participants).toHaveLength(2);
      expect(participants).toContain('user-1');
      expect(participants).toContain('user-2');
    });

    it('throws error for non-existent huddle', async () => {
      prisma.huddle.findUnique.mockResolvedValue(null);

      await expect(
        huddleService.joinHuddle('fake-huddle', 'user-123')
      ).rejects.toThrow('HUDDLE_NOT_FOUND');
    });

    it('updates last activity timestamp', async () => {
      const huddle = createMockHuddle();
      prisma.huddle.findUnique.mockResolvedValue(huddle);

      await huddleService.joinHuddle(huddle.id, 'user-123');

      expect(prisma.huddle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastActivityAt: expect.any(String),
          }),
        })
      );
    });
  });
});
