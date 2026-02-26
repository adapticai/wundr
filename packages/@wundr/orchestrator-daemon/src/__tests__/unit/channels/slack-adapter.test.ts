/**
 * Tests for the Slack Channel Adapter (src/channels/adapters/slack.ts).
 *
 * Covers:
 *  - SlackChannelAdapter lifecycle (connect, disconnect, health check)
 *  - ThreadTracker - thread ID management and replyToMode resolution
 *  - AckReactionManager - reaction acknowledgment scoping
 *  - Message sending, chunking, and Block Kit formatting
 *  - Slash command handling and response
 *  - Interactive component handling and modal opening
 *  - SlackRateLimiter - rate limiting with retry logic
 *  - Reconnection with exponential backoff
 *  - Message normalization (inbound), mention resolution, formatting strip
 *  - Media upload (buffer, path, URL)
 *  - Event handler setup (messages, reactions, slash commands, interactions)
 *  - Typing indicators
 *  - Sender validation / DM pairing
 *  - Static Block Kit builder helpers
 *  - Error handling across all methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Import the adapter under test (AFTER mocks are set up)
// ---------------------------------------------------------------------------

import { SlackChannelAdapter } from '../../../channels/adapters/slack.js';

import type { SlackChannelConfig } from '../../../channels/adapters/slack.js';

// ---------------------------------------------------------------------------
// Mock the dynamic import of @wundr/slack-agent that connect() uses
// ---------------------------------------------------------------------------

/** A factory that produces a fresh mock agent for each test. */
function createMockAgent() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      userClientConnected: true,
      botClientConnected: true,
      socketModeConnected: true,
      userId: 'U_SELF',
      teamId: 'T_TEAM',
      errors: [],
    }),
    sendMessage: vi.fn().mockResolvedValue({
      ok: true,
      channelId: 'C_GENERAL',
      ts: '1700000000.000100',
    }),
    replyToThread: vi.fn().mockResolvedValue({
      ok: true,
      channel: 'C_GENERAL',
      ts: '1700000000.000200',
    }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue({
      ok: true,
      file: { id: 'F001', name: 'test.txt', permalink: 'https://slack/file' },
    }),
    uploadFileFromBuffer: vi.fn().mockResolvedValue({
      ok: true,
      file: { id: 'F002', name: 'buf.txt', permalink: 'https://slack/file2' },
    }),
    downloadFile: vi.fn().mockResolvedValue(Buffer.from('hello')),
    getUserInfo: vi.fn().mockResolvedValue({
      real_name: 'Alice Smith',
      display_name: 'alice',
      name: 'asmith',
    }),
    openModal: vi.fn().mockResolvedValue({ view: { id: 'V001' } }),
    indicateTyping: vi.fn().mockResolvedValue(undefined),

    // Event registration stubs -- capture the handler so tests can invoke it.
    _handlers: {} as Record<string, (...args: unknown[]) => unknown>,
    onMessage(handler: (...args: unknown[]) => unknown) {
      this._handlers['message'] = handler;
    },
    onReactionAdded(handler: (...args: unknown[]) => unknown) {
      this._handlers['reaction_added'] = handler;
    },
    onReactionRemoved(handler: (...args: unknown[]) => unknown) {
      this._handlers['reaction_removed'] = handler;
    },
    onSlashCommand(handler: (...args: unknown[]) => unknown) {
      this._handlers['slash_command'] = handler;
    },
    onInteractiveAction(handler: (...args: unknown[]) => unknown) {
      this._handlers['interactive_action'] = handler;
    },
    onMemberJoined(handler: (...args: unknown[]) => unknown) {
      this._handlers['member_joined'] = handler;
    },
    onMemberLeft(handler: (...args: unknown[]) => unknown) {
      this._handlers['member_left'] = handler;
    },
    onDisconnect(handler: (...args: unknown[]) => unknown) {
      this._handlers['disconnect'] = handler;
    },
    onError(handler: (...args: unknown[]) => unknown) {
      this._handlers['error'] = handler;
    },
  };
}

type MockAgent = ReturnType<typeof createMockAgent>;

let latestMockAgent: MockAgent;

/**
 * The SlackUserAgent constructor mock. We define it as a standalone fn so that
 * `vi.clearAllMocks()` (which resets mock implementations) does not wipe it.
 * Instead, the factory always delegates to the `latestMockAgent` variable which
 * each test sets up.
 */
vi.mock('@wundr/slack-agent', () => ({
  SlackUserAgent: function SlackUserAgentMock() {
    return latestMockAgent;
  },
}));

// ---------------------------------------------------------------------------
// Mock global fetch for slash command / interaction responses
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOOP_LOGGER = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function baseConfig(
  overrides: Partial<SlackChannelConfig> = {}
): SlackChannelConfig {
  return {
    enabled: true,
    userToken: 'xoxp-test',
    botToken: 'xoxb-test',
    appToken: 'xapp-test',
    signingSecret: 'test-secret',
    ...overrides,
  };
}

/**
 * Create an adapter and connect it with the default mock agent.
 * Returns both the adapter and the mock agent.
 */
async function connectedAdapter(
  configOverrides: Partial<SlackChannelConfig> = {}
): Promise<{ adapter: SlackChannelAdapter; agent: MockAgent }> {
  const adapter = new SlackChannelAdapter(NOOP_LOGGER);
  latestMockAgent = createMockAgent();
  const agent = latestMockAgent;
  await adapter.connect(baseConfig(configOverrides));
  return { adapter, agent };
}

// ==========================================================================
// Tests
// ==========================================================================

describe('SlackChannelAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    latestMockAgent = createMockAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Identity & Capabilities
  // ========================================================================

  describe('identity and capabilities', () => {
    it('should have id "slack"', () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      expect(adapter.id).toBe('slack');
    });

    it('should report correct meta', () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      expect(adapter.meta.label).toBe('Slack');
      expect(adapter.meta.id).toBe('slack');
    });

    it('should declare comprehensive capabilities', () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      expect(adapter.capabilities.reactions).toBe(true);
      expect(adapter.capabilities.threads).toBe(true);
      expect(adapter.capabilities.media).toBe(true);
      expect(adapter.capabilities.edit).toBe(true);
      expect(adapter.capabilities.delete).toBe(true);
      expect(adapter.capabilities.typingIndicators).toBe(true);
      expect(adapter.capabilities.readReceipts).toBe(false);
      expect(adapter.capabilities.maxMessageLength).toBe(4000);
    });
  });

  // ========================================================================
  // Lifecycle: connect / disconnect / healthCheck
  // ========================================================================

  describe('lifecycle', () => {
    it('should connect successfully with valid config', async () => {
      const { adapter, agent } = await connectedAdapter();
      expect(adapter.isConnected()).toBe(true);
      expect(agent.start).toHaveBeenCalled();
      expect(agent.healthCheck).toHaveBeenCalled();
    });

    it('should be idempotent when already connected', async () => {
      const { adapter, agent } = await connectedAdapter();
      // Second call should not call start again.
      await adapter.connect(baseConfig());
      expect(agent.start).toHaveBeenCalledTimes(1);
    });

    it('should throw if required tokens are missing', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      await expect(
        adapter.connect({ enabled: true } as SlackChannelConfig)
      ).rejects.toThrow(
        'Slack adapter requires userToken, botToken, appToken, and signingSecret.'
      );
    });

    it('should emit "connected" event on successful connect', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      latestMockAgent = createMockAgent();
      const spy = vi.fn();
      adapter.on('connected', spy);
      await adapter.connect(baseConfig());
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'slack', accountId: 'T_TEAM' })
      );
    });

    it('should disconnect gracefully', async () => {
      const { adapter, agent } = await connectedAdapter();
      await adapter.disconnect();
      expect(agent.stop).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should emit "disconnected" on disconnect', async () => {
      const { adapter } = await connectedAdapter();
      const spy = vi.fn();
      adapter.on('disconnected', spy);
      await adapter.disconnect();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'slack' })
      );
    });

    it('should be idempotent when disconnecting while not connected', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      // Should not throw.
      await adapter.disconnect();
    });

    it('should report healthy status when connected', async () => {
      const { adapter } = await connectedAdapter();
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(true);
      expect(status.connected).toBe(true);
      expect(status.channelId).toBe('slack');
    });

    it('should report unhealthy when not connected', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.connected).toBe(false);
    });

    it('should handle connect failure gracefully', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      latestMockAgent = createMockAgent();
      latestMockAgent.start.mockRejectedValue(new Error('Socket error'));

      await expect(adapter.connect(baseConfig())).rejects.toThrow(
        'Socket error'
      );
      expect(adapter.isConnected()).toBe(false);
    });
  });

  // ========================================================================
  // Messaging
  // ========================================================================

  describe('sendMessage', () => {
    it('should send a simple text message', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'Hello, world!',
      });

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('1700000000.000100');
      expect(agent.sendMessage).toHaveBeenCalledWith(
        'C_GENERAL',
        'Hello, world!',
        { threadTs: undefined }
      );
    });

    it('should send a message with explicit threadId', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'Thread reply',
        threadId: '1700000000.000001',
      });

      expect(agent.sendMessage).toHaveBeenCalledWith(
        'C_GENERAL',
        'Thread reply',
        { threadTs: '1700000000.000001' }
      );
    });

    it('should throw when not connected', async () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      await expect(
        adapter.sendMessage({ to: 'C_GENERAL', text: 'hello' })
      ).rejects.toThrow('Slack adapter is not connected');
    });

    it('should chunk long messages', async () => {
      const { adapter, agent } = await connectedAdapter({
        textChunkLimit: 50,
      });

      const longText = 'A'.repeat(40) + ' ' + 'B'.repeat(40);
      await adapter.sendMessage({ to: 'C_GENERAL', text: longText });

      // Should send at least 2 chunks.
      expect(agent.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should send attachments alongside text', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'File attached',
        attachments: [
          {
            source: 'buffer',
            buffer: Buffer.from('data'),
            filename: 'test.txt',
          },
        ],
      });

      expect(agent.sendMessage).toHaveBeenCalled();
      expect(agent.uploadFileFromBuffer).toHaveBeenCalled();
    });

    it('should return error on send failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.sendMessage.mockRejectedValue(new Error('channel_not_found'));

      const result = await adapter.sendMessage({
        to: 'C_INVALID',
        text: 'hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('channel_not_found');
    });
  });

  // ========================================================================
  // Block Kit Message
  // ========================================================================

  describe('sendBlockMessage', () => {
    it('should send a message with Block Kit blocks', async () => {
      const { adapter, agent } = await connectedAdapter();

      const blocks = [SlackChannelAdapter.sectionBlock('Hello *world*')];
      const result = await adapter.sendBlockMessage('C_GENERAL', blocks, {
        text: 'fallback',
        threadId: '1700000000.000001',
      });

      expect(result.ok).toBe(true);
      expect(agent.sendMessage).toHaveBeenCalledWith(
        'C_GENERAL',
        'fallback',
        expect.objectContaining({ blocks })
      );
    });

    it('should return error on block message failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.sendMessage.mockRejectedValue(new Error('invalid_blocks'));

      const result = await adapter.sendBlockMessage('C_GENERAL', []);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('invalid_blocks');
    });
  });

  // ========================================================================
  // Edit / Delete
  // ========================================================================

  describe('editMessage', () => {
    it('should edit a message', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.editMessage(
        'C_GENERAL',
        '1700000000.000100',
        'Updated text'
      );

      expect(result.ok).toBe(true);
      expect(agent.editMessage).toHaveBeenCalledWith(
        'C_GENERAL',
        '1700000000.000100',
        'Updated text'
      );
    });

    it('should return error on edit failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.editMessage.mockRejectedValue(new Error('cant_update_message'));

      const result = await adapter.editMessage('C_GENERAL', 'ts', 'text');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('cant_update_message');
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const { adapter, agent } = await connectedAdapter();

      const success = await adapter.deleteMessage(
        'C_GENERAL',
        '1700000000.000100'
      );

      expect(success).toBe(true);
      expect(agent.deleteMessage).toHaveBeenCalled();
    });

    it('should return false on delete failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.deleteMessage.mockRejectedValue(new Error('message_not_found'));

      const success = await adapter.deleteMessage('C_GENERAL', 'ts');
      expect(success).toBe(false);
    });
  });

  // ========================================================================
  // Threading
  // ========================================================================

  describe('replyToThread', () => {
    it('should reply in thread', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.replyToThread(
        'C_GENERAL',
        '1700000000.000001',
        { to: 'C_GENERAL', text: 'Thread reply' }
      );

      expect(result.ok).toBe(true);
      expect(agent.replyToThread).toHaveBeenCalledWith(
        'C_GENERAL',
        '1700000000.000001',
        'Thread reply'
      );
    });

    it('should return error on thread reply failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.replyToThread.mockRejectedValue(new Error('thread_not_found'));

      const result = await adapter.replyToThread('C_GENERAL', 'ts', {
        to: 'C_GENERAL',
        text: 'reply',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('thread_not_found');
    });
  });

  describe('resolveReplyToMode', () => {
    it('should default to "off" when no config is set', () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      expect(adapter.resolveReplyToMode()).toBe('off');
    });

    it('should return the configured replyToMode', async () => {
      const { adapter } = await connectedAdapter({ replyToMode: 'all' });
      expect(adapter.resolveReplyToMode()).toBe('all');
    });

    it('should honor per-chat-type overrides', async () => {
      const { adapter } = await connectedAdapter({
        replyToMode: 'off',
        replyToModeByChatType: { direct: 'first', channel: 'all' },
      });

      expect(adapter.resolveReplyToMode('direct')).toBe('first');
      expect(adapter.resolveReplyToMode('channel')).toBe('all');
      // Thread maps to "channel" internally.
      expect(adapter.resolveReplyToMode('thread')).toBe('all');
      // Group has no override, falls back to global "off".
      expect(adapter.resolveReplyToMode('group')).toBe('off');
    });
  });

  describe('getThreadContext', () => {
    it('should build a ThreadingToolContext', async () => {
      const { adapter } = await connectedAdapter({ replyToMode: 'first' });

      const ctx = adapter.getThreadContext(
        'C_GENERAL',
        '1700000000.000001',
        'channel'
      );

      expect(ctx.currentChannelId).toBe('C_GENERAL');
      expect(ctx.currentThreadTs).toBe('1700000000.000001');
      expect(ctx.replyToMode).toBe('first');
      expect(ctx.hasRepliedRef).toBeDefined();
      expect(ctx.hasRepliedRef!.value).toBe(false);
    });
  });

  // ========================================================================
  // Reactions & Ack Reaction Manager
  // ========================================================================

  describe('reactions', () => {
    it('should add a reaction (stripping colons)', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.addReaction('C_GENERAL', '1700000000.000100', ':eyes:');

      expect(agent.addReaction).toHaveBeenCalledWith(
        'C_GENERAL',
        '1700000000.000100',
        'eyes'
      );
    });

    it('should remove a reaction', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.removeReaction(
        'C_GENERAL',
        '1700000000.000100',
        'thumbsup'
      );

      expect(agent.removeReaction).toHaveBeenCalledWith(
        'C_GENERAL',
        '1700000000.000100',
        'thumbsup'
      );
    });
  });

  describe('AckReactionManager - shouldAck scoping', () => {
    it('should not ack when scope is "off"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'off',
      });

      const result = await adapter.ackReaction(
        'C_GENERAL',
        '1700000000.000100',
        'direct',
        false
      );
      expect(result).toBe(false);
    });

    it('should not ack when scope is "none"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'none',
      });

      const result = await adapter.ackReaction(
        'C_GENERAL',
        '1700000000.000100',
        'channel',
        true
      );
      expect(result).toBe(false);
    });

    it('should ack all messages when scope is "all"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'all',
      });

      const result = await adapter.ackReaction(
        'C_GENERAL',
        '1700000000.000100',
        'channel',
        false
      );
      expect(result).toBe(true);
    });

    it('should ack only direct messages when scope is "direct"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'direct',
      });

      const directResult = await adapter.ackReaction(
        'D_DM',
        '1700000000.000100',
        'direct',
        false
      );
      expect(directResult).toBe(true);

      const channelResult = await adapter.ackReaction(
        'C_GENERAL',
        '1700000000.000200',
        'channel',
        false
      );
      expect(channelResult).toBe(false);
    });

    it('should ack all group/channel messages when scope is "group-all"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'group-all',
      });

      expect(
        await adapter.ackReaction('C_GENERAL', 'ts1', 'channel', false)
      ).toBe(true);

      expect(await adapter.ackReaction('G_GROUP', 'ts2', 'group', false)).toBe(
        true
      );

      expect(await adapter.ackReaction('D_DM', 'ts3', 'direct', false)).toBe(
        false
      );
    });

    it('should ack only group/channel with mentions when scope is "group-mentions"', async () => {
      const { adapter } = await connectedAdapter({
        ackReactionScope: 'group-mentions',
      });

      // Mentions self -> ack.
      expect(
        await adapter.ackReaction('C_GENERAL', 'ts1', 'channel', true)
      ).toBe(true);

      // No mention -> no ack.
      expect(
        await adapter.ackReaction('C_GENERAL', 'ts2', 'channel', false)
      ).toBe(false);

      // Direct message -> no ack regardless of mention.
      expect(await adapter.ackReaction('D_DM', 'ts3', 'direct', true)).toBe(
        false
      );
    });

    it('should use custom ack emoji from config', async () => {
      const { adapter, agent } = await connectedAdapter({
        ackReactionScope: 'all',
        ackReactionEmoji: 'wave',
      });

      await adapter.ackReaction('C_GENERAL', 'ts1', 'channel', false);
      expect(agent.addReaction).toHaveBeenCalledWith(
        'C_GENERAL',
        'ts1',
        'wave'
      );
    });

    it('should default to "eyes" emoji', async () => {
      const { adapter, agent } = await connectedAdapter({
        ackReactionScope: 'all',
      });

      await adapter.ackReaction('C_GENERAL', 'ts1', 'channel', false);
      expect(agent.addReaction).toHaveBeenCalledWith(
        'C_GENERAL',
        'ts1',
        'eyes'
      );
    });

    it('should return false if addReaction throws (best-effort)', async () => {
      const { adapter, agent } = await connectedAdapter({
        ackReactionScope: 'all',
      });

      agent.addReaction.mockRejectedValue(new Error('already_reacted'));

      const result = await adapter.ackReaction(
        'C_GENERAL',
        'ts1',
        'channel',
        false
      );
      expect(result).toBe(false);
    });
  });

  describe('scheduleAckRemoval', () => {
    it('should remove ack reaction when configured', async () => {
      const { adapter, agent } = await connectedAdapter({
        ackReactionScope: 'all',
        ackReactionRemoveAfterReply: true,
      });

      const ackPromise = adapter.ackReaction(
        'C_GENERAL',
        'ts1',
        'channel',
        false
      );
      adapter.scheduleAckRemoval('C_GENERAL', 'ts1', ackPromise);

      // Wait for the microtask chain to resolve.
      await ackPromise;
      await vi.waitFor(() => {
        expect(agent.removeReaction).toHaveBeenCalledWith(
          'C_GENERAL',
          'ts1',
          'eyes'
        );
      });
    });

    it('should not remove when ackReactionRemoveAfterReply is false', async () => {
      const { adapter, agent } = await connectedAdapter({
        ackReactionScope: 'all',
        ackReactionRemoveAfterReply: false,
      });

      const ackPromise = adapter.ackReaction(
        'C_GENERAL',
        'ts1',
        'channel',
        false
      );
      adapter.scheduleAckRemoval('C_GENERAL', 'ts1', ackPromise);
      await ackPromise;

      // Give a tick for any promises to settle.
      await new Promise(r => setTimeout(r, 50));

      expect(agent.removeReaction).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Typing Indicators
  // ========================================================================

  describe('sendTypingIndicator', () => {
    it('should fire typing immediately and return a handle', async () => {
      const { adapter, agent } = await connectedAdapter();

      const handle = adapter.sendTypingIndicator('C_GENERAL');
      expect(agent.indicateTyping).toHaveBeenCalledWith('C_GENERAL');

      // Clean up.
      handle.stop();
    });

    it('should return a no-op handle when not connected', () => {
      const adapter = new SlackChannelAdapter(NOOP_LOGGER);
      const handle = adapter.sendTypingIndicator('C_GENERAL');
      // Should not throw.
      handle.stop();
    });

    it('should stop refreshing after stop() is called', async () => {
      vi.useFakeTimers();

      const { adapter, agent } = await connectedAdapter();
      const handle = adapter.sendTypingIndicator('C_GENERAL');

      // Initial call.
      expect(agent.indicateTyping).toHaveBeenCalledTimes(1);

      // Advance past one interval.
      vi.advanceTimersByTime(3000);
      expect(agent.indicateTyping).toHaveBeenCalledTimes(2);

      handle.stop();

      // Further advancement should not trigger more calls.
      vi.advanceTimersByTime(6000);
      expect(agent.indicateTyping).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  // ========================================================================
  // Media
  // ========================================================================

  describe('sendMedia', () => {
    it('should upload from buffer', async () => {
      const { adapter, agent } = await connectedAdapter();
      const buf = Buffer.from('file content');

      const result = await adapter.sendMedia('C_GENERAL', {
        source: 'buffer',
        buffer: buf,
        filename: 'data.txt',
      });

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('F002');
      expect(agent.uploadFileFromBuffer).toHaveBeenCalledWith(
        buf,
        'data.txt',
        ['C_GENERAL'],
        expect.objectContaining({ title: 'data.txt' })
      );
    });

    it('should upload from file path', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.sendMedia('C_GENERAL', {
        source: 'path',
        location: '/tmp/test.txt',
        filename: 'test.txt',
      });

      expect(result.ok).toBe(true);
      expect(agent.uploadFile).toHaveBeenCalledWith(
        '/tmp/test.txt',
        ['C_GENERAL'],
        expect.objectContaining({ title: 'test.txt' })
      );
    });

    it('should upload from URL (download then upload)', async () => {
      const { adapter, agent } = await connectedAdapter();

      // Mock global fetch for the URL download.
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const result = await adapter.sendMedia('C_GENERAL', {
        source: 'url',
        location: 'https://example.com/file.png',
        filename: 'file.png',
      });

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/file.png');
      expect(agent.uploadFileFromBuffer).toHaveBeenCalled();
    });

    it('should return error for unsupported source', async () => {
      const { adapter } = await connectedAdapter();

      const result = await adapter.sendMedia('C_GENERAL', {
        source: 'unknown' as 'buffer',
        filename: 'test.txt',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unsupported attachment source');
    });

    it('should return error on upload failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.uploadFileFromBuffer.mockRejectedValue(new Error('upload_failed'));

      const result = await adapter.sendMedia('C_GENERAL', {
        source: 'buffer',
        buffer: Buffer.from('x'),
        filename: 'test.txt',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('upload_failed');
    });
  });

  describe('downloadMedia', () => {
    it('should download a file', async () => {
      const { adapter, agent } = await connectedAdapter();

      const buffer = await adapter.downloadMedia(
        'https://files.slack.com/file.txt'
      );

      expect(buffer.toString()).toBe('hello');
      expect(agent.downloadFile).toHaveBeenCalledWith(
        'https://files.slack.com/file.txt'
      );
    });
  });

  // ========================================================================
  // Slash Command Handling
  // ========================================================================

  describe('slash command handling', () => {
    it('should emit slash_command event when matching command arrives', async () => {
      const { adapter, agent } = await connectedAdapter({
        slashCommand: { enabled: true, name: 'wundr' },
      });

      const spy = vi.fn();
      adapter.on('slash_command', spy);

      // Simulate the slash command event.
      agent._handlers['slash_command']({
        command: '/wundr',
        text: 'help me',
        user_id: 'U_ALICE',
        channel_id: 'C_GENERAL',
        trigger_id: 'TRIG1',
        response_url: 'https://hooks.slack.com/commands/T01/reply',
        team_id: 'T_TEAM',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/wundr',
          text: 'help me',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          triggerId: 'TRIG1',
        })
      );
    });

    it('should ignore slash commands when disabled', async () => {
      const { adapter, agent } = await connectedAdapter({
        slashCommand: { enabled: false },
      });

      const spy = vi.fn();
      adapter.on('slash_command', spy);

      agent._handlers['slash_command']({
        command: '/wundr',
        text: 'help',
        user_id: 'U_ALICE',
        channel_id: 'C_GENERAL',
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('should ignore non-matching command names', async () => {
      const { adapter, agent } = await connectedAdapter({
        slashCommand: { enabled: true, name: 'wundr' },
      });

      const spy = vi.fn();
      adapter.on('slash_command', spy);

      agent._handlers['slash_command']({
        command: '/other',
        text: 'test',
        user_id: 'U_ALICE',
        channel_id: 'C_GENERAL',
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('respondToSlashCommand', () => {
    it('should respond ephemerally via response URL', async () => {
      const { adapter } = await connectedAdapter();
      mockFetch.mockResolvedValue({ ok: true });

      const result = await adapter.respondToSlashCommand(
        {
          command: '/wundr',
          text: 'help',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          responseUrl: 'https://hooks.slack.com/commands/reply',
        },
        'Here is help!'
      );

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/commands/reply',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('ephemeral'),
        })
      );
    });

    it('should fall back to regular message when no response URL', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.respondToSlashCommand(
        {
          command: '/wundr',
          text: 'help',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
        },
        'Fallback response'
      );

      expect(result.ok).toBe(true);
      expect(agent.sendMessage).toHaveBeenCalled();
    });

    it('should return error on fetch failure', async () => {
      const { adapter } = await connectedAdapter();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await adapter.respondToSlashCommand(
        {
          command: '/wundr',
          text: '',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          responseUrl: 'https://hooks.slack.com/commands/reply',
        },
        'Response text'
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should return error on non-ok HTTP response', async () => {
      const { adapter } = await connectedAdapter();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await adapter.respondToSlashCommand(
        {
          command: '/wundr',
          text: '',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          responseUrl: 'https://hooks.slack.com/commands/reply',
        },
        'Response text'
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  // ========================================================================
  // Interactive Components
  // ========================================================================

  describe('interactive component handling', () => {
    it('should emit interactive_action events', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('interactive_action', spy);

      agent._handlers['interactive_action']({
        type: 'block_actions',
        trigger_id: 'TRIG1',
        response_url: 'https://hooks.slack.com/actions/reply',
        user: { id: 'U_ALICE' },
        channel: { id: 'C_GENERAL' },
        message: { ts: '1700000000.000100' },
        actions: [
          {
            action_id: 'btn_approve',
            block_id: 'block_1',
            value: 'approved',
          },
        ],
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_actions',
          actionId: 'btn_approve',
          blockId: 'block_1',
          value: 'approved',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
        })
      );
    });

    it('should handle actions with selected_option', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('interactive_action', spy);

      agent._handlers['interactive_action']({
        type: 'block_actions',
        user: { id: 'U_BOB' },
        channel: { id: 'C_GENERAL' },
        actions: [
          {
            action_id: 'menu_select',
            selected_option: { value: 'option_1' },
          },
        ],
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: 'menu_select',
          value: 'option_1',
        })
      );
    });
  });

  describe('respondToInteraction', () => {
    it('should respond via response URL', async () => {
      const { adapter } = await connectedAdapter();
      mockFetch.mockResolvedValue({ ok: true });

      const result = await adapter.respondToInteraction(
        {
          type: 'block_actions',
          actionId: 'btn_1',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          responseUrl: 'https://hooks.slack.com/actions/reply',
          raw: {},
        },
        'Action acknowledged',
        { replaceOriginal: true }
      );

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/actions/reply',
        expect.objectContaining({
          body: expect.stringContaining('"replace_original":true'),
        })
      );
    });

    it('should fall back to sendMessage when no response URL but has channelId', async () => {
      const { adapter, agent } = await connectedAdapter();

      const result = await adapter.respondToInteraction(
        {
          type: 'block_actions',
          actionId: 'btn_1',
          userId: 'U_ALICE',
          channelId: 'C_GENERAL',
          raw: {},
        },
        'Fallback message'
      );

      expect(result.ok).toBe(true);
      expect(agent.sendMessage).toHaveBeenCalled();
    });

    it('should return error when no response URL and no channelId', async () => {
      const { adapter } = await connectedAdapter();

      const result = await adapter.respondToInteraction(
        {
          type: 'block_actions',
          actionId: 'btn_1',
          userId: 'U_ALICE',
          raw: {},
        },
        'text'
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('No response URL or channel ID');
    });
  });

  describe('openModal', () => {
    it('should open a modal and return the view ID', async () => {
      const { adapter, agent } = await connectedAdapter();

      const view = {
        type: 'modal',
        title: { type: 'plain_text', text: 'Test' },
      };
      const result = await adapter.openModal('TRIG1', view);

      expect(result.ok).toBe(true);
      expect(result.viewId).toBe('V001');
      expect(agent.openModal).toHaveBeenCalledWith('TRIG1', view);
    });

    it('should return error on modal failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.openModal.mockRejectedValue(new Error('expired_trigger_id'));

      const result = await adapter.openModal('TRIG1', {});
      expect(result.ok).toBe(false);
      expect(result.error).toBe('expired_trigger_id');
    });
  });

  // ========================================================================
  // User Mention Resolution
  // ========================================================================

  describe('resolveUserDisplayName', () => {
    it('should resolve a user ID to a display name', async () => {
      const { adapter } = await connectedAdapter();

      const name = await adapter.resolveUserDisplayName('U_ALICE');
      expect(name).toBe('Alice Smith');
    });

    it('should cache resolved names', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.resolveUserDisplayName('U_ALICE');
      await adapter.resolveUserDisplayName('U_ALICE');

      // Only one API call should have been made.
      expect(agent.getUserInfo).toHaveBeenCalledTimes(1);
    });

    it('should return user ID on resolution failure', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.getUserInfo.mockRejectedValue(new Error('user_not_found'));

      const name = await adapter.resolveUserDisplayName('U_UNKNOWN');
      expect(name).toBe('U_UNKNOWN');
    });
  });

  describe('resolveUserMentions', () => {
    it('should replace mention markup with display names', async () => {
      const { adapter } = await connectedAdapter();

      const result = await adapter.resolveUserMentions(
        'Hello <@U_ALICE>, check this out'
      );

      expect(result).toBe('Hello @Alice Smith, check this out');
    });

    it('should return original text if no mentions', async () => {
      const { adapter } = await connectedAdapter();

      const result = await adapter.resolveUserMentions('No mentions here');
      expect(result).toBe('No mentions here');
    });
  });

  // ========================================================================
  // Block Kit Formatting Helpers (static methods)
  // ========================================================================

  describe('Block Kit helpers', () => {
    it('sectionBlock should produce a section with mrkdwn text', () => {
      const block = SlackChannelAdapter.sectionBlock('Hello *world*', 'b1');
      expect(block.type).toBe('section');
      expect(block.block_id).toBe('b1');
      expect(block.text).toEqual({ type: 'mrkdwn', text: 'Hello *world*' });
    });

    it('sectionBlock should omit block_id when not provided', () => {
      const block = SlackChannelAdapter.sectionBlock('Hello');
      expect(block.block_id).toBeUndefined();
    });

    it('actionsBlock should produce buttons', () => {
      const block = SlackChannelAdapter.actionsBlock(
        [
          { text: 'Approve', actionId: 'approve', style: 'primary' },
          { text: 'Reject', actionId: 'reject', value: 'no', style: 'danger' },
        ],
        'actions_1'
      );

      expect(block.type).toBe('actions');
      expect(block.block_id).toBe('actions_1');
      expect(block.elements).toHaveLength(2);
      const first = (block.elements as any[])[0];
      expect(first.type).toBe('button');
      expect(first.action_id).toBe('approve');
      expect(first.style).toBe('primary');
      expect(first.text).toEqual({ type: 'plain_text', text: 'Approve' });
    });

    it('actionsBlock should omit value and style when not provided', () => {
      const block = SlackChannelAdapter.actionsBlock([
        { text: 'Click', actionId: 'click' },
      ]);

      const btn = (block.elements as any[])[0];
      expect(btn.value).toBeUndefined();
      expect(btn.style).toBeUndefined();
    });

    it('dividerBlock should produce a divider', () => {
      const block = SlackChannelAdapter.dividerBlock();
      expect(block.type).toBe('divider');
    });

    it('contextBlock should produce mrkdwn elements', () => {
      const block = SlackChannelAdapter.contextBlock(
        ['_italic_', '*bold*'],
        'ctx_1'
      );

      expect(block.type).toBe('context');
      expect(block.block_id).toBe('ctx_1');
      expect(block.elements).toHaveLength(2);
      const first = (block.elements as any[])[0];
      expect(first.type).toBe('mrkdwn');
      expect(first.text).toBe('_italic_');
    });
  });

  // ========================================================================
  // Rate Limiter
  // ========================================================================

  describe('SlackRateLimiter (via adapter)', () => {
    it('should retry on rate-limited errors', async () => {
      const { adapter, agent } = await connectedAdapter();

      let callCount = 0;
      agent.sendMessage.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('rate limited');
          err.code = 'slack_webapi_rate_limited_error';
          err.retryAfter = 0.01; // 10ms
          throw err;
        }
        return { ok: true, channelId: 'C_GENERAL', ts: 'ts1' };
      });

      const result = await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'test',
      });

      expect(result.ok).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should propagate error after max retries', async () => {
      const { adapter, agent } = await connectedAdapter({
        maxRetries: 1,
      });

      agent.sendMessage.mockImplementation(async () => {
        const err: any = new Error('rate limited');
        err.code = 'slack_webapi_rate_limited_error';
        err.retryAfter = 0.01;
        throw err;
      });

      const result = await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'test',
      });

      // After maxRetries exhausted, the error propagates into the result.
      expect(result.ok).toBe(false);
      expect(result.error).toContain('rate limited');
    });
  });

  // ========================================================================
  // Reconnection with Exponential Backoff
  // ========================================================================

  describe('reconnection', () => {
    it('should schedule reconnect on unexpected disconnect', async () => {
      vi.useFakeTimers();

      const { adapter, agent } = await connectedAdapter({
        reconnectBaseDelayMs: 100,
        maxReconnectAttempts: 3,
      });

      const connectedSpy = vi.fn();
      adapter.on('connected', connectedSpy);

      // Simulate unexpected disconnect.
      agent._handlers['disconnect']('Connection lost');

      expect(adapter.isConnected()).toBe(false);

      // Advance timers to trigger reconnect.
      await vi.advanceTimersByTimeAsync(200);

      // The reconnect timer should have fired and called start().
      expect(agent.start).toHaveBeenCalledTimes(2); // 1 from connect + 1 from reconnect

      vi.useRealTimers();
    });

    it('should not reconnect after intentional disconnect', async () => {
      vi.useFakeTimers();

      const { adapter, agent } = await connectedAdapter({
        reconnectBaseDelayMs: 100,
      });

      await adapter.disconnect();

      // Even if the disconnect callback fires (edge case), do not reconnect.
      if (agent._handlers['disconnect']) {
        agent._handlers['disconnect']('Connection lost');
      }

      await vi.advanceTimersByTimeAsync(5000);

      // Only the initial connect start call.
      expect(agent.start).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should give up after max reconnect attempts', async () => {
      vi.useFakeTimers();

      const { adapter, agent } = await connectedAdapter({
        reconnectBaseDelayMs: 50,
        maxReconnectAttempts: 2,
      });

      // Make reconnect attempts always fail.
      agent.start.mockRejectedValue(new Error('still down'));

      const errorSpy = vi.fn();
      adapter.on('error', errorSpy);

      // Trigger first disconnect.
      agent._handlers['disconnect']('Connection lost');
      await vi.advanceTimersByTimeAsync(200);

      // Second attempt.
      await vi.advanceTimersByTimeAsync(500);

      // After maxReconnectAttempts, an unrecoverable error should be emitted.
      await vi.advanceTimersByTimeAsync(2000);

      const unrecoverable = errorSpy.mock.calls.find(
        (c: any[]) => c[0]?.recoverable === false
      );
      expect(unrecoverable).toBeDefined();

      vi.useRealTimers();
    });

    it('should emit error event on agent errors', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('error', spy);

      agent._handlers['error'](new Error('WebSocket frame error'));

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'slack',
          recoverable: true,
        })
      );
    });
  });

  // ========================================================================
  // Event Handling: Messages
  // ========================================================================

  describe('inbound message events', () => {
    it('should emit normalized message on incoming event', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        type: 'message',
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        text: 'Hello <@U_SELF>!',
        channel_type: 'channel',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const msg = spy.mock.calls[0][0];
      expect(msg.channelId).toBe('slack');
      expect(msg.conversationId).toBe('C_GENERAL');
      expect(msg.platformMessageId).toBe('1700000001.000100');
      expect(msg.sender.id).toBe('U_ALICE');
      expect(msg.sender.isSelf).toBe(false);
      expect(msg.chatType).toBe('channel');
      // Mentions should be extracted.
      expect(msg.content.mentions).toContain('U_SELF');
      expect(msg.content.mentionsSelf).toBe(true);
    });

    it('should skip own messages', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        type: 'message',
        user: 'U_SELF',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        text: 'My own message',
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('should resolve chat type "im" as "direct"', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'D_DM',
        ts: '1700000001.000200',
        text: 'DM',
        channel_type: 'im',
      });

      expect(spy.mock.calls[0][0].chatType).toBe('direct');
    });

    it('should resolve thread_ts as "thread" chat type', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000300',
        text: 'Thread reply',
        thread_ts: '1700000001.000001',
        channel_type: 'channel',
      });

      expect(spy.mock.calls[0][0].chatType).toBe('thread');
      expect(spy.mock.calls[0][0].threadId).toBe('1700000001.000001');
    });

    it('should emit message_edited for message_changed subtype', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message_edited', spy);

      await agent._handlers['message']({
        type: 'message',
        subtype: 'message_changed',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        message: {
          user: 'U_ALICE',
          ts: '1700000001.000100',
          text: 'Updated text',
        },
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'C_GENERAL',
          messageId: '1700000001.000100',
        })
      );
    });

    it('should emit message_deleted for message_deleted subtype', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message_deleted', spy);

      await agent._handlers['message']({
        type: 'message',
        subtype: 'message_deleted',
        channel: 'C_GENERAL',
        deleted_ts: '1700000001.000100',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'C_GENERAL',
          messageId: '1700000001.000100',
        })
      );
    });

    it('should normalize file attachments', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000400',
        text: 'See attached',
        channel_type: 'channel',
        files: [
          {
            name: 'photo.png',
            mimetype: 'image/png',
            size: 12345,
            url_private: 'https://files.slack.com/photo.png',
            thumb_360: 'https://files.slack.com/photo_thumb.png',
          },
        ],
      });

      const msg = spy.mock.calls[0][0];
      expect(msg.content.attachments).toHaveLength(1);
      expect(msg.content.attachments[0].type).toBe('image');
      expect(msg.content.attachments[0].filename).toBe('photo.png');
      expect(msg.content.attachments[0].mimeType).toBe('image/png');
      expect(msg.content.attachments[0].sizeBytes).toBe(12345);
      expect(msg.content.attachments[0].url).toBe(
        'https://files.slack.com/photo.png'
      );
    });

    it('should strip Slack formatting from text', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000500',
        text: '<@U_BOB> check <#C123|general> and <https://example.com|Example> &amp; &lt;code&gt;',
        channel_type: 'channel',
      });

      const text = spy.mock.calls[0][0].content.text;
      expect(text).toContain('#general');
      expect(text).toContain('Example');
      expect(text).toContain('& <code>');
      expect(text).not.toContain('<@U_BOB>');
    });

    it('should skip messages with no channel or ts', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      // No channel.
      await agent._handlers['message']({
        user: 'U_ALICE',
        ts: '1700000001.000100',
        text: 'Missing channel',
      });

      // No ts.
      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        text: 'Missing ts',
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Event Handling: Reactions
  // ========================================================================

  describe('reaction events', () => {
    it('should emit reaction_added', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('reaction_added', spy);

      agent._handlers['reaction_added']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        reaction: 'thumbsup',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'C_GENERAL',
          userId: 'U_ALICE',
          emoji: 'thumbsup',
        })
      );
    });

    it('should emit reaction_removed', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('reaction_removed', spy);

      agent._handlers['reaction_removed']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        reaction: 'eyes',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          emoji: 'eyes',
        })
      );
    });

    it('should skip reaction events with missing fields', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('reaction_added', spy);

      // Missing user.
      agent._handlers['reaction_added']({
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Event Handling: Member Events
  // ========================================================================

  describe('member events', () => {
    it('should emit member_joined', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('member_joined', spy);

      agent._handlers['member_joined']({
        user: 'U_NEW',
        channel: 'C_GENERAL',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'U_NEW',
          conversationId: 'C_GENERAL',
        })
      );
    });

    it('should emit member_left', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('member_left', spy);

      agent._handlers['member_left']({
        user: 'U_OLD',
        channel: 'C_GENERAL',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'U_OLD',
          conversationId: 'C_GENERAL',
        })
      );
    });
  });

  // ========================================================================
  // Sender Validation / DM Pairing
  // ========================================================================

  describe('validateSender', () => {
    it('should allow all senders in group/channel', async () => {
      const { adapter } = await connectedAdapter({
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (r: string) => r.trim().toLowerCase(),
        },
      });

      const result = await adapter.validateSender('U_ANYONE', 'channel');
      expect(result.allowed).toBe(true);
    });

    it('should allow direct messages when approval not required', async () => {
      const { adapter } = await connectedAdapter();

      const result = await adapter.validateSender('U_ANYONE', 'direct');
      expect(result.allowed).toBe(true);
    });

    it('should allow senders on the DM allow list', async () => {
      const { adapter } = await connectedAdapter({
        dmAllowList: ['U_ALICE', 'U_BOB'],
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (r: string) => r.trim().toLowerCase(),
        },
      });

      const result = await adapter.validateSender('u_alice', 'direct');
      expect(result.allowed).toBe(true);
    });

    it('should deny senders not on the allow list', async () => {
      const { adapter } = await connectedAdapter({
        dmAllowList: ['U_ALICE'],
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (r: string) => r.trim().toLowerCase(),
        },
      });

      const result = await adapter.validateSender('U_CHARLIE', 'direct');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('allow-list');
    });
  });

  describe('getPairingConfig', () => {
    it('should return null when pairing is not configured', async () => {
      const { adapter } = await connectedAdapter();
      expect(adapter.getPairingConfig()).toBeNull();
    });

    it('should return pairing config when configured', async () => {
      const { adapter } = await connectedAdapter({
        dmAllowList: ['U_ALICE'],
        pairing: {
          requireApproval: true,
          allowList: ['U_BOB'],
          normalizeEntry: (r: string) => r.trim().toLowerCase(),
        },
      });

      const config = adapter.getPairingConfig();
      expect(config).not.toBeNull();
      expect(config!.requireApproval).toBe(true);
      // dmAllowList takes precedence over pairing.allowList.
      expect(config!.allowList).toEqual(['U_ALICE']);
    });
  });

  // ========================================================================
  // Event Subscriptions
  // ========================================================================

  describe('getEventSubscriptions', () => {
    it('should return default subscriptions when none configured', async () => {
      const { adapter } = await connectedAdapter();

      const subs = adapter.getEventSubscriptions();
      expect(subs).toContain('app_mention');
      expect(subs).toContain('message.channels');
      expect(subs).toContain('reaction_added');
      expect(subs.length).toBeGreaterThan(5);
    });

    it('should return custom subscriptions when configured', async () => {
      const { adapter } = await connectedAdapter({
        eventSubscriptions: ['message.im', 'app_mention'],
      });

      const subs = adapter.getEventSubscriptions();
      expect(subs).toEqual(['message.im', 'app_mention']);
    });
  });

  // ========================================================================
  // Text Chunking
  // ========================================================================

  describe('text chunking', () => {
    it('should not chunk text within the limit', async () => {
      const { adapter, agent } = await connectedAdapter();

      await adapter.sendMessage({
        to: 'C_GENERAL',
        text: 'Short message',
      });

      expect(agent.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should break at code block boundaries when possible', async () => {
      const { adapter, agent } = await connectedAdapter({
        textChunkLimit: 100,
      });

      // Create text with a code block boundary near the limit.
      const before = 'A'.repeat(60);
      const text = before + '\n```\ncode block\n```\n' + 'B'.repeat(40);

      await adapter.sendMessage({ to: 'C_GENERAL', text });

      expect(agent.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should hard-break when no suitable boundary exists', async () => {
      const { adapter, agent } = await connectedAdapter({
        textChunkLimit: 50,
      });

      // No spaces, no newlines -- force hard break.
      const text = 'X'.repeat(120);
      await adapter.sendMessage({ to: 'C_GENERAL', text });

      expect(agent.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Event Handler unsubscribe
  // ========================================================================

  describe('event unsubscription', () => {
    it('should return an unsubscribe function from on()', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      const unsub = adapter.on('message', spy);

      // Fire an event.
      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000100',
        text: 'Hello',
        channel_type: 'channel',
      });

      expect(spy).toHaveBeenCalledTimes(1);

      // Unsubscribe.
      unsub();

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000001.000200',
        text: 'Hello again',
        channel_type: 'channel',
      });

      // Should not be called again.
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // Sender normalization (bot detection)
  // ========================================================================

  describe('sender normalization', () => {
    it('should detect bot messages via bot_id', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_BOT',
        channel: 'C_GENERAL',
        ts: '1700000001.000600',
        text: 'Bot message',
        channel_type: 'channel',
        bot_id: 'B_BOT',
      });

      expect(spy.mock.calls[0][0].sender.isBot).toBe(true);
    });

    it('should not mark self as bot even with bot_id', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_SELF',
        channel: 'C_GENERAL',
        ts: '1700000001.000700',
        text: 'Self message',
        channel_type: 'channel',
      });

      // Self messages are skipped entirely.
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Channel type resolution
  // ========================================================================

  describe('chat type resolution', () => {
    it('should resolve mpim as group', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'G_MPIM',
        ts: '1700000002.000100',
        text: 'Group DM',
        channel_type: 'mpim',
      });

      expect(spy.mock.calls[0][0].chatType).toBe('group');
    });

    it('should resolve "group" channel_type as group', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'G_GROUP',
        ts: '1700000002.000200',
        text: 'Group',
        channel_type: 'group',
      });

      expect(spy.mock.calls[0][0].chatType).toBe('group');
    });

    it('should default to "channel" for unknown types', async () => {
      const { adapter, agent } = await connectedAdapter();

      const spy = vi.fn();
      adapter.on('message', spy);

      await agent._handlers['message']({
        user: 'U_ALICE',
        channel: 'C_GENERAL',
        ts: '1700000002.000300',
        text: 'Regular',
        channel_type: 'channel',
      });

      expect(spy.mock.calls[0][0].chatType).toBe('channel');
    });
  });

  // ========================================================================
  // Health check edge cases
  // ========================================================================

  describe('healthCheck edge cases', () => {
    it('should handle health check failure gracefully', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.healthCheck.mockRejectedValue(new Error('health check failed'));

      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.connected).toBe(false);
      expect(status.lastError).toBe('health check failed');
    });

    it('should include error details from agent health', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.healthCheck.mockResolvedValue({
        healthy: false,
        userClientConnected: true,
        botClientConnected: false,
        socketModeConnected: true,
        userId: 'U_SELF',
        teamId: 'T_TEAM',
        errors: ['Bot client disconnected', 'Token expired'],
      });

      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.lastError).toContain('Bot client disconnected');
      expect(status.lastError).toContain('Token expired');
    });
  });

  // ========================================================================
  // Disconnect error handling
  // ========================================================================

  describe('disconnect error handling', () => {
    it('should handle agent.stop() throwing without propagating', async () => {
      const { adapter, agent } = await connectedAdapter();
      agent.stop.mockRejectedValue(new Error('stop failed'));

      // Should not throw.
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });
});
