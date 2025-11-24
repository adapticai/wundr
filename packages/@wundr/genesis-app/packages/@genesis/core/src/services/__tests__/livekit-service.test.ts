/**
 * LiveKit Service Tests
 *
 * Comprehensive test suite for the LiveKit service covering:
 * - Room creation and management
 * - Token generation with grants
 * - Participant operations (list, remove, mute)
 * - Webhook handling and signature verification
 *
 * @module @genesis/core/services/__tests__/livekit-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockLiveKitService,
  createMockRoom,
  createMockParticipant,
  createMockParticipantTrack,
  createMockToken,
  createMockWebhookEvent,
  createMockWebhookSignature,
  type MockLiveKitService,
  type Room,
  type RoomOptions,
  type TokenOptions,
} from '../../test-utils/mock-livekit';
import {
  generateCallTestId,
  resetCallIdCounter,
} from '../../test-utils/call-factories';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  name: 'test-room',
  maxParticipants: 50,
  emptyTimeout: 300,
};

const DEFAULT_TOKEN_OPTIONS: TokenOptions = {
  identity: 'user-123',
  name: 'Test User',
  ttl: 3600,
  grants: {
    roomJoin: true,
    room: 'test-room',
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  },
};

// =============================================================================
// TESTS
// =============================================================================

describe('LiveKitService', () => {
  let livekit: MockLiveKitService;

  beforeEach(() => {
    resetCallIdCounter();
    livekit = createMockLiveKitService('test-api-key', 'test-api-secret');
  });

  afterEach(() => {
    livekit._reset();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Room Creation Tests
  // ===========================================================================

  describe('createRoom', () => {
    it('creates room with default options', async () => {
      const roomName = `room-${generateCallTestId('test')}`;

      const room = await livekit.createRoom({ name: roomName });

      expect(room).toBeDefined();
      expect(room.name).toBe(roomName);
      expect(room.sid).toMatch(/^RM_/);
      expect(room.numParticipants).toBe(0);
      expect(livekit.createRoom).toHaveBeenCalledWith({ name: roomName });
    });

    it('creates room with options', async () => {
      const options: RoomOptions = {
        name: 'custom-room',
        maxParticipants: 100,
        emptyTimeout: 600,
        metadata: JSON.stringify({ purpose: 'team-meeting' }),
      };

      const room = await livekit.createRoom(options);

      expect(room.name).toBe('custom-room');
      expect(room.maxParticipants).toBe(100);
      expect(room.emptyTimeout).toBe(600);
      expect(room.metadata).toBe(JSON.stringify({ purpose: 'team-meeting' }));
    });

    it('sets max participants', async () => {
      const room = await livekit.createRoom({
        name: 'limited-room',
        maxParticipants: 10,
      });

      expect(room.maxParticipants).toBe(10);
    });

    it('handles duplicate room by returning existing', async () => {
      const roomName = 'duplicate-test';

      const room1 = await livekit.createRoom({ name: roomName });
      const room2 = await livekit.createRoom({ name: roomName });

      expect(room1.sid).toBe(room2.sid);
      expect(room1.name).toBe(room2.name);
      expect(livekit._store.rooms.size).toBe(1);
    });

    it('stores room in internal store', async () => {
      const roomName = 'stored-room';

      await livekit.createRoom({ name: roomName });

      expect(livekit._store.rooms.has(roomName)).toBe(true);
      expect(livekit._store.participants.has(roomName)).toBe(true);
    });

    it('sets creation time', async () => {
      const beforeCreate = Date.now();
      const room = await livekit.createRoom({ name: 'time-test' });
      const afterCreate = Date.now();

      expect(room.creationTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(room.creationTime).toBeLessThanOrEqual(afterCreate);
    });

    it('initializes with default codecs', async () => {
      const room = await livekit.createRoom({ name: 'codec-test' });

      expect(room.enabledCodecs).toBeDefined();
      expect(room.enabledCodecs.length).toBeGreaterThan(0);
      expect(room.enabledCodecs.some((c) => c.mime === 'audio/opus')).toBe(true);
    });

    it('creates multiple rooms independently', async () => {
      const rooms = await Promise.all([
        livekit.createRoom({ name: 'room-1' }),
        livekit.createRoom({ name: 'room-2' }),
        livekit.createRoom({ name: 'room-3' }),
      ]);

      expect(rooms).toHaveLength(3);
      expect(new Set(rooms.map((r) => r.sid)).size).toBe(3);
      expect(new Set(rooms.map((r) => r.name)).size).toBe(3);
    });
  });

  // ===========================================================================
  // Token Generation Tests
  // ===========================================================================

  describe('generateToken', () => {
    it('generates valid JWT', async () => {
      const token = await livekit.createToken({
        identity: 'user-123',
        grants: { room: 'test-room', roomJoin: true },
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('includes correct grants', async () => {
      const grants = {
        room: 'my-room',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      };

      const token = await livekit.createToken({
        identity: 'user-456',
        grants,
      });

      const verification = await livekit.verifyToken(token);

      expect(verification.valid).toBe(true);
      expect(verification.grants.room).toBe('my-room');
      expect(verification.grants.canPublish).toBe(true);
      expect(verification.grants.canSubscribe).toBe(true);
    });

    it('sets expiration', async () => {
      const ttl = 1800; // 30 minutes

      const token = await livekit.createToken({
        identity: 'user-789',
        ttl,
        grants: { room: 'test-room', roomJoin: true },
      });

      // Parse the token to check expiration
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      const expectedExp = Math.floor(Date.now() / 1000) + ttl;
      expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 5);
      expect(payload.exp).toBeLessThanOrEqual(expectedExp + 5);
    });

    it('includes identity in token', async () => {
      const identity = 'unique-user-id';

      const token = await livekit.createToken({
        identity,
        grants: { room: 'test-room', roomJoin: true },
      });

      const verification = await livekit.verifyToken(token);
      expect(verification.identity).toBe(identity);
    });

    it('includes metadata in token', async () => {
      const token = await livekit.createToken({
        identity: 'user-with-meta',
        metadata: JSON.stringify({ role: 'moderator' }),
        grants: { room: 'test-room', roomJoin: true },
      });

      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      expect(payload.metadata).toBe(JSON.stringify({ role: 'moderator' }));
    });

    it('generates different tokens for different identities', async () => {
      const token1 = await livekit.createToken({
        identity: 'user-1',
        grants: { room: 'test-room', roomJoin: true },
      });

      const token2 = await livekit.createToken({
        identity: 'user-2',
        grants: { room: 'test-room', roomJoin: true },
      });

      expect(token1).not.toBe(token2);
    });

    it('supports viewer-only permissions', async () => {
      const token = await livekit.createToken({
        identity: 'viewer',
        grants: {
          room: 'test-room',
          roomJoin: true,
          canPublish: false,
          canSubscribe: true,
        },
      });

      const verification = await livekit.verifyToken(token);
      expect(verification.grants.canPublish).toBe(false);
      expect(verification.grants.canSubscribe).toBe(true);
    });

    it('supports admin grants', async () => {
      const token = await livekit.createToken({
        identity: 'admin',
        grants: {
          roomAdmin: true,
          roomCreate: true,
          roomList: true,
        },
      });

      const verification = await livekit.verifyToken(token);
      expect(verification.grants.roomAdmin).toBe(true);
      expect(verification.grants.roomCreate).toBe(true);
    });

    it('verifies expired tokens as invalid', async () => {
      // Create a token with very short TTL
      const token = await livekit.createToken({
        identity: 'expiring-user',
        ttl: -1, // Already expired
        grants: { room: 'test-room', roomJoin: true },
      });

      // Manually create an expired token for testing
      const payload = {
        sub: 'expiring-user',
        video: { roomJoin: true },
        iat: Math.floor(Date.now() / 1000) - 3700,
        exp: Math.floor(Date.now() / 1000) - 100, // Expired
        iss: 'test-api-key',
      };
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify(payload)
      ).toString('base64')}.mock-signature`;

      const verification = await livekit.verifyToken(expiredToken);
      expect(verification.valid).toBe(false);
    });
  });

  // ===========================================================================
  // Participant Operations Tests
  // ===========================================================================

  describe('participant operations', () => {
    let testRoom: Room;

    beforeEach(async () => {
      testRoom = await livekit.createRoom({ name: 'participant-test-room' });
    });

    it('lists participants', async () => {
      // Add some participants
      const participant1 = createMockParticipant({ identity: 'user-1' });
      const participant2 = createMockParticipant({ identity: 'user-2' });

      livekit._addParticipant(testRoom.name, participant1);
      livekit._addParticipant(testRoom.name, participant2);

      const participants = await livekit.listParticipants(testRoom.name);

      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.identity)).toContain('user-1');
      expect(participants.map((p) => p.identity)).toContain('user-2');
    });

    it('returns empty array for room with no participants', async () => {
      const participants = await livekit.listParticipants(testRoom.name);

      expect(participants).toEqual([]);
    });

    it('returns empty array for non-existent room', async () => {
      const participants = await livekit.listParticipants('non-existent-room');

      expect(participants).toEqual([]);
    });

    it('removes participant', async () => {
      const participant = createMockParticipant({ identity: 'to-remove' });
      livekit._addParticipant(testRoom.name, participant);

      expect(await livekit.listParticipants(testRoom.name)).toHaveLength(1);

      await livekit.removeParticipant(testRoom.name, 'to-remove');

      const remaining = await livekit.listParticipants(testRoom.name);
      expect(remaining).toHaveLength(0);
      expect(livekit.removeParticipant).toHaveBeenCalledWith(
        testRoom.name,
        'to-remove'
      );
    });

    it('updates room participant count on remove', async () => {
      const participant = createMockParticipant({ identity: 'counted' });
      livekit._addParticipant(testRoom.name, participant);

      const roomBefore = await livekit.getRoom(testRoom.name);
      expect(roomBefore?.numParticipants).toBe(1);

      await livekit.removeParticipant(testRoom.name, 'counted');

      const roomAfter = await livekit.getRoom(testRoom.name);
      expect(roomAfter?.numParticipants).toBe(0);
    });

    it('mutes participant audio track', async () => {
      const track = createMockParticipantTrack({
        sid: 'track-audio-1',
        type: 'audio',
        source: 'microphone',
        muted: false,
      });

      const participant = createMockParticipant({
        identity: 'speaker',
        tracks: [track],
      });

      livekit._addParticipant(testRoom.name, participant);

      const mutedTrack = await livekit.mutePublishedTrack(
        testRoom.name,
        'speaker',
        'track-audio-1',
        true
      );

      expect(mutedTrack).toBeDefined();
      expect(mutedTrack?.muted).toBe(true);
    });

    it('unmutes participant track', async () => {
      const track = createMockParticipantTrack({
        sid: 'track-video-1',
        type: 'video',
        source: 'camera',
        muted: true,
      });

      const participant = createMockParticipant({
        identity: 'video-user',
        tracks: [track],
      });

      livekit._addParticipant(testRoom.name, participant);

      const unmutedTrack = await livekit.mutePublishedTrack(
        testRoom.name,
        'video-user',
        'track-video-1',
        false
      );

      expect(unmutedTrack?.muted).toBe(false);
    });

    it('returns null when muting non-existent track', async () => {
      const participant = createMockParticipant({ identity: 'no-track' });
      livekit._addParticipant(testRoom.name, participant);

      const result = await livekit.mutePublishedTrack(
        testRoom.name,
        'no-track',
        'non-existent-track',
        true
      );

      expect(result).toBeNull();
    });

    it('gets specific participant', async () => {
      const participant = createMockParticipant({
        identity: 'specific-user',
        name: 'Specific User',
      });

      livekit._addParticipant(testRoom.name, participant);

      const found = await livekit.getParticipant(testRoom.name, 'specific-user');

      expect(found).toBeDefined();
      expect(found?.identity).toBe('specific-user');
      expect(found?.name).toBe('Specific User');
    });

    it('returns null for non-existent participant', async () => {
      const found = await livekit.getParticipant(testRoom.name, 'ghost-user');

      expect(found).toBeNull();
    });

    it('updates participant metadata', async () => {
      const participant = createMockParticipant({ identity: 'meta-user' });
      livekit._addParticipant(testRoom.name, participant);

      const updated = await livekit.updateParticipant(
        testRoom.name,
        'meta-user',
        JSON.stringify({ role: 'moderator' })
      );

      expect(updated?.metadata).toBe(JSON.stringify({ role: 'moderator' }));
    });

    it('updates participant permissions', async () => {
      const participant = createMockParticipant({
        identity: 'permission-user',
        permission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          canPublishSources: ['camera', 'microphone'],
          hidden: false,
          recorder: false,
          canUpdateMetadata: true,
        },
      });

      livekit._addParticipant(testRoom.name, participant);

      const updated = await livekit.updateParticipant(
        testRoom.name,
        'permission-user',
        undefined,
        { canPublish: false }
      );

      expect(updated?.permission.canPublish).toBe(false);
    });
  });

  // ===========================================================================
  // Webhook Tests
  // ===========================================================================

  describe('webhook handling', () => {
    it('validates webhook signature', async () => {
      const validSignature = createMockWebhookSignature();
      const body = JSON.stringify({ event: 'participant_joined' });

      const isValid = await livekit.verifyWebhook(body, validSignature);

      expect(isValid).toBe(true);
    });

    it('rejects invalid webhook signature', async () => {
      const invalidSignature = 'invalid-signature';
      const body = JSON.stringify({ event: 'participant_joined' });

      const isValid = await livekit.verifyWebhook(body, invalidSignature);

      expect(isValid).toBe(false);
    });

    it('parses participant_joined webhook', async () => {
      const event = createMockWebhookEvent(
        'participant_joined',
        { name: 'webhook-room' },
        { identity: 'joining-user' }
      );

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.event).toBe('participant_joined');
      expect(parsed.room?.name).toBe('webhook-room');
      expect(parsed.participant?.identity).toBe('joining-user');
    });

    it('parses participant_left webhook', async () => {
      const event = createMockWebhookEvent(
        'participant_left',
        { name: 'webhook-room' },
        { identity: 'leaving-user' }
      );

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.event).toBe('participant_left');
      expect(parsed.participant?.identity).toBe('leaving-user');
    });

    it('parses room_started webhook', async () => {
      const event = createMockWebhookEvent('room_started', { name: 'new-room' });

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.event).toBe('room_started');
      expect(parsed.room?.name).toBe('new-room');
    });

    it('parses room_finished webhook', async () => {
      const event = createMockWebhookEvent('room_finished', { name: 'ended-room' });

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.event).toBe('room_finished');
      expect(parsed.room?.name).toBe('ended-room');
    });

    it('parses track_published webhook', async () => {
      const event = createMockWebhookEvent(
        'track_published',
        { name: 'track-room' },
        { identity: 'publisher' }
      );

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.event).toBe('track_published');
    });

    it('includes event timestamp', async () => {
      const event = createMockWebhookEvent('room_started', { name: 'time-room' });

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.createdAt).toBeDefined();
      expect(typeof parsed.createdAt).toBe('number');
    });

    it('includes event ID', async () => {
      const event = createMockWebhookEvent('room_started', { name: 'id-room' });

      const body = JSON.stringify(event);
      const parsed = await livekit.parseWebhook(body);

      expect(parsed.id).toBeDefined();
      expect(parsed.id).toMatch(/^EV_/);
    });
  });

  // ===========================================================================
  // Room Management Tests
  // ===========================================================================

  describe('room management', () => {
    it('lists all rooms', async () => {
      await livekit.createRoom({ name: 'room-a' });
      await livekit.createRoom({ name: 'room-b' });
      await livekit.createRoom({ name: 'room-c' });

      const rooms = await livekit.listRooms();

      expect(rooms).toHaveLength(3);
      expect(rooms.map((r) => r.name).sort()).toEqual(['room-a', 'room-b', 'room-c']);
    });

    it('lists specific rooms by name', async () => {
      await livekit.createRoom({ name: 'room-1' });
      await livekit.createRoom({ name: 'room-2' });
      await livekit.createRoom({ name: 'room-3' });

      const rooms = await livekit.listRooms(['room-1', 'room-3']);

      expect(rooms).toHaveLength(2);
      expect(rooms.map((r) => r.name).sort()).toEqual(['room-1', 'room-3']);
    });

    it('returns empty array when no rooms exist', async () => {
      const rooms = await livekit.listRooms();

      expect(rooms).toEqual([]);
    });

    it('deletes room', async () => {
      const room = await livekit.createRoom({ name: 'to-delete' });

      expect(await livekit.getRoom('to-delete')).toBeDefined();

      await livekit.deleteRoom('to-delete');

      expect(await livekit.getRoom('to-delete')).toBeNull();
      expect(livekit.deleteRoom).toHaveBeenCalledWith('to-delete');
    });

    it('removes participants when room is deleted', async () => {
      const room = await livekit.createRoom({ name: 'delete-with-participants' });
      livekit._addParticipant(room.name, createMockParticipant({ identity: 'user-1' }));
      livekit._addParticipant(room.name, createMockParticipant({ identity: 'user-2' }));

      await livekit.deleteRoom(room.name);

      expect(livekit._store.participants.has(room.name)).toBe(false);
    });

    it('gets room by name', async () => {
      await livekit.createRoom({ name: 'get-test', maxParticipants: 25 });

      const room = await livekit.getRoom('get-test');

      expect(room).toBeDefined();
      expect(room?.name).toBe('get-test');
      expect(room?.maxParticipants).toBe(25);
    });

    it('returns null for non-existent room', async () => {
      const room = await livekit.getRoom('ghost-room');

      expect(room).toBeNull();
    });

    it('updates room metadata', async () => {
      await livekit.createRoom({ name: 'metadata-room' });

      const updated = await livekit.updateRoomMetadata(
        'metadata-room',
        JSON.stringify({ updated: true })
      );

      expect(updated?.metadata).toBe(JSON.stringify({ updated: true }));
    });
  });

  // ===========================================================================
  // Egress (Recording) Tests
  // ===========================================================================

  describe('egress (recording)', () => {
    it('starts room composite egress', async () => {
      const room = await livekit.createRoom({ name: 'record-room' });

      const egress = await livekit.startRoomCompositeEgress(room.name, {
        file: { filepath: '/recordings/output.mp4' },
      });

      expect(egress.egressId).toBeDefined();
      expect(egress.roomName).toBe(room.name);
      expect(egress.status).toBe('active');
    });

    it('updates room activeRecording status', async () => {
      const room = await livekit.createRoom({ name: 'active-recording' });

      expect(room.activeRecording).toBe(false);

      await livekit.startRoomCompositeEgress(room.name, {
        stream: { protocol: 'rtmp', urls: ['rtmp://stream.example.com/live'] },
      });

      const updatedRoom = await livekit.getRoom(room.name);
      expect(updatedRoom?.activeRecording).toBe(true);
    });

    it('stops egress', async () => {
      const room = await livekit.createRoom({ name: 'stop-recording' });
      const egress = await livekit.startRoomCompositeEgress(room.name, {
        file: { filepath: '/recordings/test.mp4' },
      });

      const stopped = await livekit.stopEgress(egress.egressId);

      expect(stopped.status).toBe('complete');
    });

    it('lists egress for room', async () => {
      const room = await livekit.createRoom({ name: 'list-egress-room' });

      const egressList = await livekit.listEgress(room.name);

      expect(Array.isArray(egressList)).toBe(true);
    });
  });

  // ===========================================================================
  // Reset and Cleanup Tests
  // ===========================================================================

  describe('reset and cleanup', () => {
    it('resets all stores', async () => {
      await livekit.createRoom({ name: 'room-to-reset' });
      await livekit.createToken({ identity: 'user', grants: {} });

      livekit._reset();

      expect(livekit._store.rooms.size).toBe(0);
      expect(livekit._store.tokens.size).toBe(0);
      expect(livekit._store.participants.size).toBe(0);
    });

    it('clears all mock call history', async () => {
      await livekit.createRoom({ name: 'call-history-test' });

      expect(livekit.createRoom).toHaveBeenCalled();

      livekit._reset();

      expect(livekit.createRoom).not.toHaveBeenCalled();
    });
  });
});
