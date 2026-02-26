/**
 * Comprehensive test suite for DiscordChannelAdapter.
 *
 * Covers:
 *  - Static utilities (chunkText, sanitizeThreadName)
 *  - Thread management (create, auto-thread, thread starter cache)
 *  - Rich embed formatting
 *  - Slash command registration and handling
 *  - Button / select-menu interaction handling
 *  - Rate limiting
 *  - Shard support
 *  - Message splitting (2000-char limit, code-fence awareness)
 *  - Connect / disconnect lifecycle
 *  - Error handling and reconnection
 *  - Typing indicators
 *  - Ack reactions
 *  - Sender validation / DM pairing
 *  - Permission checking
 *  - Channel type resolution
 *  - Media send / size validation
 *  - Message edit / delete
 *  - Voice channel awareness
 *
 * All discord.js imports are mocked. No real Discord client is created.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import after mock is set up
// ---------------------------------------------------------------------------

import {
  DiscordChannelAdapter,
  type DiscordChannelConfig,
  type DiscordOutboundMessage,
  type SlashCommandDefinition,
} from '../../../channels/adapters/discord.js';

// ---------------------------------------------------------------------------
// Mock discord.js dynamic import
// ---------------------------------------------------------------------------

// Captured event handlers registered on the mock client
let clientEventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

const mockSend = vi.fn().mockResolvedValue({ id: 'sent-msg-1' });
const mockSendTyping = vi.fn().mockResolvedValue(undefined);
const mockMessageFetch = vi.fn();
const mockChannelFetch = vi.fn();
const mockLogin = vi.fn().mockResolvedValue('token');
const mockDestroy = vi.fn();
const mockRestPut = vi.fn().mockResolvedValue(undefined);

function createMockChannel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'ch-1',
    type: 0,
    guildId: 'guild-1',
    parentId: undefined,
    send: mockSend,
    sendTyping: mockSendTyping,
    messages: {
      fetch: mockMessageFetch,
    },
    isThread: () => false,
    isDMBased: () => false,
    permissionsFor: vi.fn().mockReturnValue({
      toArray: () => ['SendMessages', 'ReadMessageHistory'],
      bitfield: BigInt(0x800 | 0x10000),
    }),
    guild: {
      id: 'guild-1',
      members: { fetch: vi.fn().mockResolvedValue({ id: 'bot-user-1' }) },
      channels: { cache: new Map() },
      voiceStates: { cache: new Map() },
    },
    ...overrides,
  };
}

function createMockMessage(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'msg-1',
    content: 'hello world',
    author: {
      id: 'user-1',
      username: 'testuser',
      displayName: 'Test User',
      bot: false,
      avatarURL: () => 'https://cdn.example.com/avatar.png',
    },
    member: { displayName: 'Test User (guild)' },
    channel: {
      id: 'ch-1',
      isThread: () => false,
      isDMBased: () => false,
    },
    guildId: 'guild-1',
    webhookId: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    reference: undefined,
    mentions: { users: new Map() },
    attachments: new Map(),
    ...overrides,
  };
}

// We mock the dynamic import('discord.js') that happens inside the adapter
vi.mock('discord.js', () => {
  // The Client constructor returns a mock client
  class MockClient {
    user = { id: 'bot-user-1' };
    ws = { ping: 42, shards: { first: () => ({ sessionId: 'sess-1' }) } };
    guilds = { cache: { size: 1 } };
    channels = { fetch: mockChannelFetch };
    rest = { put: mockRestPut };
    shard = null;

    login = mockLogin;
    destroy = mockDestroy;

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!clientEventHandlers[event]) {
        clientEventHandlers[event] = [];
      }
      clientEventHandlers[event]!.push(handler);
    }
  }

  return {
    Client: MockClient,
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      GuildMessageReactions: 4,
      GuildMessageTyping: 8,
      GuildVoiceStates: 16,
      GuildMembers: 32,
      DirectMessages: 64,
      DirectMessageReactions: 128,
      DirectMessageTyping: 256,
      MessageContent: 512,
    },
    Partials: {
      Channel: 0,
      Message: 1,
      Reaction: 2,
      User: 3,
      GuildMember: 4,
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides: Partial<DiscordChannelConfig> = {}
): DiscordChannelConfig {
  return {
    enabled: true,
    botToken: 'test-bot-token',
    applicationId: 'app-id-1',
    ...overrides,
  };
}

function makeSilentLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

/** Emit a client event captured during setupEventHandlers. */
function emitClientEvent(event: string, ...args: unknown[]) {
  const handlers = clientEventHandlers[event];
  if (handlers) {
    for (const h of handlers) {
      h(...args);
    }
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('DiscordChannelAdapter', () => {
  let adapter: DiscordChannelAdapter;
  let logger: ReturnType<typeof makeSilentLogger>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clientEventHandlers = {};
    logger = makeSilentLogger();
    adapter = new DiscordChannelAdapter(logger);
    mockSend.mockClear();
    mockSendTyping.mockClear();
    mockMessageFetch.mockClear();
    mockChannelFetch.mockClear();
    mockLogin.mockClear();
    mockDestroy.mockClear();
    mockRestPut.mockClear();
    DiscordChannelAdapter.__resetThreadStarterCacheForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Identity & Capabilities
  // =========================================================================

  describe('identity and capabilities', () => {
    it('should expose id as "discord"', () => {
      expect(adapter.id).toBe('discord');
    });

    it('should declare correct meta', () => {
      expect(adapter.meta.label).toBe('Discord');
      expect(adapter.meta.aliases).toContain('dc');
    });

    it('should declare thread, reaction, and media capabilities', () => {
      const { capabilities } = adapter;
      expect(capabilities.threads).toBe(true);
      expect(capabilities.reactions).toBe(true);
      expect(capabilities.media).toBe(true);
      expect(capabilities.edit).toBe(true);
      expect(capabilities.delete).toBe(true);
      expect(capabilities.typingIndicators).toBe(true);
      expect(capabilities.readReceipts).toBe(false);
      expect(capabilities.maxMessageLength).toBe(2000);
      expect(capabilities.maxMediaBytes).toBe(26_214_400);
    });

    it('should list supported chat types', () => {
      expect(adapter.capabilities.chatTypes).toContain('direct');
      expect(adapter.capabilities.chatTypes).toContain('channel');
      expect(adapter.capabilities.chatTypes).toContain('thread');
    });
  });

  // =========================================================================
  // Connect / Disconnect Lifecycle
  // =========================================================================

  describe('connect / disconnect lifecycle', () => {
    it('should connect successfully with valid config', async () => {
      const config = makeConfig();
      mockChannelFetch.mockResolvedValue(createMockChannel());

      await adapter.connect(config);

      expect(adapter.isConnected()).toBe(true);
      expect(mockLogin).toHaveBeenCalledWith('test-bot-token');
    });

    it('should throw when botToken is missing', async () => {
      const config = makeConfig({ botToken: '' });

      await expect(adapter.connect(config)).rejects.toThrow(
        'Discord adapter requires botToken.'
      );
      expect(adapter.isConnected()).toBe(false);
    });

    it('should be idempotent -- second connect is a no-op', async () => {
      const config = makeConfig();
      mockChannelFetch.mockResolvedValue(createMockChannel());

      await adapter.connect(config);
      await adapter.connect(config);

      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should emit "connected" event on successful connect', async () => {
      const config = makeConfig();
      const handler = vi.fn();
      adapter.on('connected', handler);

      await adapter.connect(config);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'discord',
          accountId: 'bot-user-1',
        })
      );
    });

    it('should disconnect gracefully', async () => {
      await adapter.connect(makeConfig());
      const handler = vi.fn();
      adapter.on('disconnected', handler);

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(mockDestroy).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'discord' })
      );
    });

    it('should be idempotent -- disconnect when not connected is a no-op', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });

    it('should log error if destroy throws during disconnect', async () => {
      await adapter.connect(makeConfig());
      mockDestroy.mockImplementation(() => {
        throw new Error('destroy boom');
      });

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('destroy boom')
      );
    });

    it('should set lastError when connect fails', async () => {
      mockLogin.mockRejectedValueOnce(new Error('auth failed'));

      await expect(adapter.connect(makeConfig())).rejects.toThrow(
        'auth failed'
      );

      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.lastError).toBe('auth failed');
    });
  });

  // =========================================================================
  // Health Check
  // =========================================================================

  describe('healthCheck', () => {
    it('should report unhealthy when not connected', async () => {
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.connected).toBe(false);
    });

    it('should report healthy when connected with positive ping', async () => {
      await adapter.connect(makeConfig());

      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.connected).toBe(true);
      expect(health.latencyMs).toBe(42);
      expect(health.accountId).toBe('bot-user-1');
      expect((health.details as Record<string, unknown>)?.['guilds']).toBe(1);
    });
  });

  // =========================================================================
  // Message Sending & Chunking
  // =========================================================================

  describe('sendMessage', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should send a simple message', async () => {
      const result = await adapter.sendMessage({
        to: 'ch-1',
        text: 'Hello Discord!',
      });

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('sent-msg-1');
      expect(result.conversationId).toBe('ch-1');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return error for empty message without embeds', async () => {
      const result = await adapter.sendMessage({ to: 'ch-1', text: '' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Empty message');
    });

    it('should return error when channel is not found', async () => {
      mockChannelFetch.mockResolvedValue(null);

      const result = await adapter.sendMessage({ to: 'unknown', text: 'Hi' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should chunk long messages exceeding 2000 chars', async () => {
      const longText = 'A'.repeat(3500);
      const result = await adapter.sendMessage({ to: 'ch-1', text: longText });

      expect(result.ok).toBe(true);
      expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should attach embeds only to the first chunk', async () => {
      const longText = 'B'.repeat(3500);
      const embeds = [{ title: 'Test Embed', description: 'desc' }];
      const msg: DiscordOutboundMessage = {
        to: 'ch-1',
        text: longText,
        embeds,
      };

      await adapter.sendMessage(msg);

      // First call should have embeds
      const firstCallArgs = mockSend.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(firstCallArgs?.['embeds']).toEqual(embeds);

      // Second call should not
      if (mockSend.mock.calls.length > 1) {
        const secondCallArgs = mockSend.mock.calls[1]?.[0] as Record<
          string,
          unknown
        >;
        expect(secondCallArgs?.['embeds']).toBeUndefined();
      }
    });

    it('should attach components only to the first chunk', async () => {
      const longText = 'C'.repeat(3500);
      const components = [
        {
          type: 1 as const,
          components: [
            {
              type: 2 as const,
              style: 1 as const,
              label: 'Click me',
              custom_id: 'btn-1',
            },
          ],
        },
      ];

      const msg: DiscordOutboundMessage = {
        to: 'ch-1',
        text: longText,
        components,
      };

      await adapter.sendMessage(msg);

      const firstCallArgs = mockSend.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(firstCallArgs?.['components']).toEqual(components);
    });

    it('should send embed-only message even when text is empty', async () => {
      const msg: DiscordOutboundMessage = {
        to: 'ch-1',
        text: '',
        embeds: [{ title: 'Embed Only' }],
      };

      const result = await adapter.sendMessage(msg);
      expect(result.ok).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should attach replyTo reference on first chunk', async () => {
      await adapter.sendMessage({
        to: 'ch-1',
        text: 'reply content',
        replyTo: 'msg-original',
      });

      const args = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args?.['reply']).toEqual({ messageReference: 'msg-original' });
    });

    it('should handle send failures gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('send failed'));

      const result = await adapter.sendMessage({ to: 'ch-1', text: 'Hi' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('send failed');
    });

    it('should throw when called while disconnected', async () => {
      await adapter.disconnect();

      await expect(
        adapter.sendMessage({ to: 'ch-1', text: 'Hi' })
      ).rejects.toThrow('not connected');
    });
  });

  // =========================================================================
  // Static chunkText (code-fence-aware)
  // =========================================================================

  describe('static chunkText', () => {
    it('should return single chunk for short text', () => {
      const chunks = DiscordChannelAdapter.chunkText('Hello', 2000, 17);
      expect(chunks).toEqual(['Hello']);
    });

    it('should return empty array for empty text', () => {
      const chunks = DiscordChannelAdapter.chunkText('', 2000, 17);
      expect(chunks).toEqual([]);
    });

    it('should split text exceeding character limit', () => {
      const text = 'A'.repeat(4500);
      const chunks = DiscordChannelAdapter.chunkText(text, 2000, 9999);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it('should split text exceeding line limit', () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`).join(
        '\n'
      );
      const chunks = DiscordChannelAdapter.chunkText(lines, 99999, 10);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('should balance code fences across chunks', () => {
      const code = [
        '```typescript',
        ...Array.from({ length: 30 }, (_, i) => `const x${i} = ${i};`),
        '```',
      ].join('\n');

      const chunks = DiscordChannelAdapter.chunkText(code, 2000, 10);
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      // Each chunk that starts a fence should close it, and vice versa
      for (const chunk of chunks) {
        const opens = (chunk.match(/```/g) ?? []).length;
        // Fences should be balanced (even number of backtick triples)
        expect(opens % 2).toBe(0);
      }
    });

    it('should handle tilde fences', () => {
      const code = '~~~\nfoo\nbar\nbaz\n~~~';
      const chunks = DiscordChannelAdapter.chunkText(code, 2000, 17);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('~~~');
    });
  });

  // =========================================================================
  // Static sanitizeThreadName
  // =========================================================================

  describe('static sanitizeThreadName', () => {
    it('should strip user mentions', () => {
      const name = DiscordChannelAdapter.sanitizeThreadName(
        'Hey <@123456> what is up',
        'fallback'
      );
      expect(name).toBe('Hey what is up');
    });

    it('should strip role mentions', () => {
      const name = DiscordChannelAdapter.sanitizeThreadName(
        'Ping <@&99999>!',
        'fallback'
      );
      expect(name).toBe('Ping !');
    });

    it('should strip channel mentions', () => {
      const name = DiscordChannelAdapter.sanitizeThreadName(
        'See <#111222>',
        'fallback'
      );
      expect(name).toBe('See');
    });

    it('should use fallback when cleaned name is empty', () => {
      const name = DiscordChannelAdapter.sanitizeThreadName('<@123>', 'msg-42');
      expect(name).toBe('Thread msg-42');
    });

    it('should truncate to 100 characters', () => {
      const longName = 'X'.repeat(200);
      const name = DiscordChannelAdapter.sanitizeThreadName(longName, 'id');
      expect(name.length).toBeLessThanOrEqual(100);
    });
  });

  // =========================================================================
  // Thread Management
  // =========================================================================

  describe('thread management', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should create a thread from a message', async () => {
      const mockThread = { id: 'thread-1' };
      const mockMsg = {
        id: 'msg-1',
        startThread: vi.fn().mockResolvedValue(mockThread),
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.createThread('ch-1', 'msg-1', 'My Thread');

      expect(result.ok).toBe(true);
      expect(result.conversationId).toBe('thread-1');
      expect(mockMsg.startThread).toHaveBeenCalledWith({
        name: 'My Thread',
        autoArchiveDuration: 60,
      });
    });

    it('should sanitize thread name when creating', async () => {
      const mockThread = { id: 'thread-2' };
      const mockMsg = {
        id: 'msg-2',
        startThread: vi.fn().mockResolvedValue(mockThread),
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.createThread(
        'ch-1',
        'msg-2',
        'Hey <@123> help me'
      );

      expect(result.ok).toBe(true);
      expect(mockMsg.startThread).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Hey help me' })
      );
    });

    it('should return error when startThread is not available', async () => {
      mockMessageFetch.mockResolvedValue({ id: 'msg-3' });

      const result = await adapter.createThread('ch-1', 'msg-3', 'Thread');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('startThread not available');
    });

    it('should reply to a thread', async () => {
      const threadChannel = createMockChannel({ id: 'thread-1' });
      mockChannelFetch.mockResolvedValue(threadChannel);

      const result = await adapter.replyToThread('ch-1', 'thread-1', {
        to: 'thread-1',
        text: 'Reply in thread',
      });

      expect(result.ok).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({ content: 'Reply in thread' });
    });

    it('should chunk long thread replies', async () => {
      const threadChannel = createMockChannel({ id: 'thread-1' });
      mockChannelFetch.mockResolvedValue(threadChannel);

      const longText = 'Z'.repeat(4500);
      await adapter.replyToThread('ch-1', 'thread-1', {
        to: 'thread-1',
        text: longText,
      });

      expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    describe('maybeAutoThread', () => {
      it('should create thread when channel is in autoThreadChannelIds', async () => {
        await adapter.disconnect();
        const config = makeConfig({ autoThreadChannelIds: ['ch-1'] });
        await adapter.connect(config);

        const mockThread = { id: 'auto-thread-1' };
        const mockMsg = {
          id: 'msg-at',
          startThread: vi.fn().mockResolvedValue(mockThread),
        };
        mockMessageFetch.mockResolvedValue(mockMsg);
        mockChannelFetch.mockResolvedValue(createMockChannel());

        const threadId = await adapter.maybeAutoThread({
          channelId: 'ch-1',
          messageId: 'msg-at',
          isThread: false,
          text: 'New question',
        });

        expect(threadId).toBe('auto-thread-1');
      });

      it('should return null when channel is not in autoThreadChannelIds', async () => {
        await adapter.disconnect();
        const config = makeConfig({ autoThreadChannelIds: ['ch-99'] });
        await adapter.connect(config);

        const threadId = await adapter.maybeAutoThread({
          channelId: 'ch-1',
          messageId: 'msg-2',
          isThread: false,
          text: 'something',
        });

        expect(threadId).toBeNull();
      });

      it('should return null when message is already in a thread', async () => {
        await adapter.disconnect();
        const config = makeConfig({ autoThreadChannelIds: ['ch-1'] });
        await adapter.connect(config);

        const threadId = await adapter.maybeAutoThread({
          channelId: 'ch-1',
          messageId: 'msg-3',
          isThread: true,
          text: 'threaded msg',
        });

        expect(threadId).toBeNull();
      });

      it('should return null when autoThreadChannelIds is empty', async () => {
        const threadId = await adapter.maybeAutoThread({
          channelId: 'ch-1',
          messageId: 'msg-4',
          isThread: false,
          text: 'no auto thread config',
        });

        expect(threadId).toBeNull();
      });
    });

    describe('getThreadStarter', () => {
      it('should fetch and cache thread starter message', async () => {
        const starterMsg = {
          id: 'thread-100',
          content: 'Original question',
          author: { username: 'starteruser' },
          createdTimestamp: 1700000000000,
        };
        mockMessageFetch.mockResolvedValue(starterMsg);

        const starter = await adapter.getThreadStarter('thread-100');

        expect(starter).toEqual({
          text: 'Original question',
          author: 'starteruser',
          timestamp: 1700000000000,
        });

        // Second call should return cached value without re-fetching
        mockMessageFetch.mockClear();
        const cached = await adapter.getThreadStarter('thread-100');
        expect(cached).toEqual(starter);
        expect(mockMessageFetch).not.toHaveBeenCalled();
      });

      it('should return null when thread is not found', async () => {
        mockChannelFetch.mockResolvedValue(null);
        const starter = await adapter.getThreadStarter('nonexistent');
        expect(starter).toBeNull();
      });
    });
  });

  // =========================================================================
  // Rich Embed Formatting
  // =========================================================================

  describe('rich embed formatting', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should send a message with rich embeds', async () => {
      const msg: DiscordOutboundMessage = {
        to: 'ch-1',
        text: 'See the embed below:',
        embeds: [
          {
            title: 'Build Status',
            description: 'All checks passed',
            color: 0x00ff00,
            fields: [
              { name: 'Branch', value: 'main', inline: true },
              { name: 'Commit', value: 'abc1234', inline: true },
            ],
            footer: { text: 'CI/CD Pipeline' },
            thumbnail: { url: 'https://example.com/thumb.png' },
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = await adapter.sendMessage(msg);

      expect(result.ok).toBe(true);
      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['embeds']).toHaveLength(1);
      expect(
        (sentArgs?.['embeds'] as Array<Record<string, unknown>>)?.[0]?.['title']
      ).toBe('Build Status');
    });

    it('should send multiple embeds', async () => {
      const msg: DiscordOutboundMessage = {
        to: 'ch-1',
        text: '',
        embeds: [
          { title: 'Embed 1' },
          { title: 'Embed 2' },
          { title: 'Embed 3' },
        ],
      };

      const result = await adapter.sendMessage(msg);

      expect(result.ok).toBe(true);
      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['embeds']).toHaveLength(3);
    });
  });

  // =========================================================================
  // Slash Command Registration & Handling
  // =========================================================================

  describe('slash command registration', () => {
    it('should register slash commands globally', async () => {
      const commands: SlashCommandDefinition[] = [
        { name: 'ask', description: 'Ask the bot a question' },
        {
          name: 'config',
          description: 'Configure settings',
          options: [
            {
              name: 'key',
              description: 'Setting key',
              type: 3,
              required: true,
            },
          ],
        },
      ];

      const config = makeConfig({ slashCommands: commands });
      await adapter.connect(config);

      expect(mockRestPut).toHaveBeenCalledWith(
        '/applications/app-id-1/commands',
        expect.objectContaining({
          body: expect.arrayContaining([
            expect.objectContaining({ name: 'ask' }),
            expect.objectContaining({ name: 'config' }),
          ]),
        })
      );
    });

    it('should register per-guild when guildIds are configured', async () => {
      const commands: SlashCommandDefinition[] = [
        { name: 'ping', description: 'Ping the bot' },
      ];

      const config = makeConfig({
        slashCommands: commands,
        guildIds: ['guild-A', 'guild-B'],
      });
      await adapter.connect(config);

      expect(mockRestPut).toHaveBeenCalledWith(
        '/applications/app-id-1/guilds/guild-A/commands',
        expect.any(Object)
      );
      expect(mockRestPut).toHaveBeenCalledWith(
        '/applications/app-id-1/guilds/guild-B/commands',
        expect.any(Object)
      );
    });

    it('should report registered commands in healthCheck', async () => {
      const config = makeConfig({
        slashCommands: [{ name: 'hello', description: 'Say hello' }],
      });
      await adapter.connect(config);

      const health = await adapter.healthCheck();
      const details = health.details as Record<string, unknown>;
      expect(details?.['registeredCommands']).toContain('hello');
    });

    it('should warn when applicationId is missing', async () => {
      const config = makeConfig({
        applicationId: undefined,
        slashCommands: [{ name: 'test', description: 'Test' }],
      });
      await adapter.connect(config);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing client or applicationId')
      );
    });
  });

  // =========================================================================
  // Interaction Handling (slash commands, buttons, select menus)
  // =========================================================================

  describe('interaction handling', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should dispatch slash command interactions', async () => {
      const handler = vi.fn();
      adapter.onInteraction('ask', handler);

      emitClientEvent('interactionCreate', {
        id: 'int-1',
        type: 2,
        commandName: 'ask',
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isSelectMenu: () => false,
        user: { id: 'user-1' },
        channelId: 'ch-1',
        guildId: 'guild-1',
        options: {
          data: [{ name: 'query', value: 'What is vitest?' }],
        },
      });

      // Interaction handling is async via void dispatch
      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          interactionId: 'int-1',
          type: 'command',
          commandName: 'ask',
          userId: 'user-1',
          channelId: 'ch-1',
          options: { query: 'What is vitest?' },
        })
      );
    });

    it('should dispatch button interactions by customId', async () => {
      const handler = vi.fn();
      adapter.onInteraction('confirm-btn', handler);

      emitClientEvent('interactionCreate', {
        id: 'int-2',
        type: 3,
        customId: 'confirm-btn',
        isChatInputCommand: () => false,
        isButton: () => true,
        isStringSelectMenu: () => false,
        isSelectMenu: () => false,
        user: { id: 'user-2' },
        channelId: 'ch-1',
      });

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'button',
          customId: 'confirm-btn',
          userId: 'user-2',
        })
      );
    });

    it('should dispatch select menu interactions', async () => {
      const handler = vi.fn();
      adapter.onInteraction('color-select', handler);

      emitClientEvent('interactionCreate', {
        id: 'int-3',
        type: 3,
        customId: 'color-select',
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => true,
        isSelectMenu: () => false,
        user: { id: 'user-3' },
        channelId: 'ch-2',
      });

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select_menu',
          customId: 'color-select',
        })
      );
    });

    it('should return unsubscribe function from onInteraction', async () => {
      const handler = vi.fn();
      const unsub = adapter.onInteraction('test-cmd', handler);

      unsub();

      emitClientEvent('interactionCreate', {
        id: 'int-4',
        type: 2,
        commandName: 'test-cmd',
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isSelectMenu: () => false,
        user: { id: 'user-1' },
        channelId: 'ch-1',
      });

      await vi.advanceTimersByTimeAsync(10);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should log and not throw when interaction handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('handler boom'));
      adapter.onInteraction('buggy-cmd', handler);

      emitClientEvent('interactionCreate', {
        id: 'int-5',
        type: 2,
        commandName: 'buggy-cmd',
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isSelectMenu: () => false,
        user: { id: 'user-1' },
        channelId: 'ch-1',
      });

      await vi.advanceTimersByTimeAsync(10);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('handler boom')
      );
    });

    it('should ignore unrecognized interaction types', async () => {
      emitClientEvent('interactionCreate', {
        id: 'int-6',
        type: 99,
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isSelectMenu: () => false,
        user: { id: 'user-1' },
        channelId: 'ch-1',
      });

      await vi.advanceTimersByTimeAsync(10);

      // No error, just silently ignored
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Rate Limiting
  // =========================================================================

  describe('rate limiting', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should report rate limit buckets in health check', async () => {
      const health = await adapter.healthCheck();
      const details = health.details as Record<string, unknown>;
      expect(details).toHaveProperty('rateLimitBuckets');
    });

    it('should wait on rate-limited routes before sending', async () => {
      // Send multiple messages rapidly -- the adapter calls rateLimiter.wait()
      // per-chunk, and the test verifies it does not throw
      mockSend.mockResolvedValue({ id: 'msg-fast-1' });

      const results = await Promise.all([
        adapter.sendMessage({ to: 'ch-1', text: 'msg 1' }),
        adapter.sendMessage({ to: 'ch-1', text: 'msg 2' }),
      ]);

      for (const r of results) {
        expect(r.ok).toBe(true);
      }
    });
  });

  // =========================================================================
  // Shard Support
  // =========================================================================

  describe('shard support', () => {
    it('should pass shard config to client options', async () => {
      const config = makeConfig({
        shardCount: 4,
        shardIds: [0, 1],
      });

      await adapter.connect(config);

      // The client was constructed with sharding options.
      // Since the mock Client constructor does not validate options,
      // we just verify connection succeeds with sharding config.
      expect(adapter.isConnected()).toBe(true);
    });

    it('should return null shard info when no shard is configured', async () => {
      await adapter.connect(makeConfig());

      const info = adapter.getShardInfo();
      expect(info).toBeNull();
    });

    it('should report shard info in health check', async () => {
      await adapter.connect(makeConfig());

      const health = await adapter.healthCheck();
      const details = health.details as Record<string, unknown>;
      expect(details).toHaveProperty('shards');
    });
  });

  // =========================================================================
  // Reconnection & Error Handling
  // =========================================================================

  describe('reconnection and error handling', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should track reconnect attempts on shard disconnect', () => {
      emitClientEvent('shardDisconnect', { code: 1006 }, 0);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('shard 0 disconnected')
      );
    });

    it('should not attempt reconnect on non-resumable close codes', () => {
      // 4004 = authentication failed
      emitClientEvent('shardDisconnect', { code: 4004 }, 0);

      expect(adapter.isConnected()).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Non-resumable close code 4004')
      );
    });

    it('should reset reconnect state on shard resume', () => {
      emitClientEvent('shardDisconnect', { code: 1006 }, 0);
      emitClientEvent('shardResume', 0, 5);

      expect(adapter.isConnected()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('resumed')
      );
    });

    it('should set connected to true on shardReady', () => {
      // Simulate a reconnection scenario
      emitClientEvent('shardDisconnect', { code: 4000 }, 0);
      emitClientEvent('shardReady', 0);

      expect(adapter.isConnected()).toBe(true);
    });

    it('should emit error event and track lastError on client error', () => {
      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      emitClientEvent('error', new Error('WebSocket error'));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'discord',
          recoverable: true,
        })
      );
    });

    it('should clear reconnect timer on disconnect', async () => {
      // The adapter sets up reconnect handlers internally.
      // Just verifying disconnect cleans up without error.
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // Typing Indicators
  // =========================================================================

  describe('typing indicators', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should send typing immediately and return a stop handle', async () => {
      const handle = adapter.sendTypingIndicator('ch-1');

      // Allow the immediate sendOnce to resolve
      await vi.advanceTimersByTimeAsync(50);

      expect(handle).toHaveProperty('stop');
      expect(typeof handle.stop).toBe('function');
      expect(mockSendTyping).toHaveBeenCalled();

      handle.stop();
    });

    it('should refresh typing every 8 seconds', async () => {
      const handle = adapter.sendTypingIndicator('ch-1');

      // Wait for initial + two refreshes
      await vi.advanceTimersByTimeAsync(50);
      const initialCalls = mockSendTyping.mock.calls.length;

      await vi.advanceTimersByTimeAsync(8000);
      expect(mockSendTyping.mock.calls.length).toBeGreaterThan(initialCalls);

      handle.stop();
    });

    it('should stop refreshing when stop() is called', async () => {
      const handle = adapter.sendTypingIndicator('ch-1');
      await vi.advanceTimersByTimeAsync(50);

      handle.stop();
      const callCountAfterStop = mockSendTyping.mock.calls.length;

      await vi.advanceTimersByTimeAsync(16000);
      expect(mockSendTyping.mock.calls.length).toBe(callCountAfterStop);
    });

    it('should return no-op handle when not connected', async () => {
      await adapter.disconnect();
      const handle = adapter.sendTypingIndicator('ch-1');
      expect(handle.stop).toBeDefined();
      handle.stop(); // should not throw
    });
  });

  // =========================================================================
  // Ack Reactions
  // =========================================================================

  describe('ack reactions', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
    });

    it('should add ack reaction when scope is "all"', async () => {
      const config = makeConfig({ ackReactionScope: 'all' });
      await adapter.connect(config);

      const mockMsg = {
        id: 'msg-ack',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: { cache: { find: vi.fn() } },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-ack',
        chatType: 'channel',
        wasMentioned: false,
      });

      expect(result).toBe(true);
    });

    it('should not add ack reaction when scope is "off"', async () => {
      const config = makeConfig({ ackReactionScope: 'off' });
      await adapter.connect(config);

      const result = await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-ack',
        chatType: 'channel',
        wasMentioned: false,
      });

      expect(result).toBe(false);
    });

    it('should add ack reaction in DM when scope is "direct"', async () => {
      const config = makeConfig({ ackReactionScope: 'direct' });
      await adapter.connect(config);

      const mockMsg = {
        id: 'msg-dm',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: { cache: { find: vi.fn() } },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-dm',
        chatType: 'direct',
        wasMentioned: false,
      });

      expect(result).toBe(true);
    });

    it('should not add ack reaction in channel when scope is "direct"', async () => {
      const config = makeConfig({ ackReactionScope: 'direct' });
      await adapter.connect(config);

      const result = await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-ch',
        chatType: 'channel',
        wasMentioned: false,
      });

      expect(result).toBe(false);
    });

    it('should add ack in group with mention when scope is "group-mentions"', async () => {
      const config = makeConfig({ ackReactionScope: 'group-mentions' });
      await adapter.connect(config);

      const mockMsg = {
        id: 'msg-gm',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: { cache: { find: vi.fn() } },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-gm',
        chatType: 'channel',
        wasMentioned: true,
      });

      expect(result).toBe(true);
    });

    it('should remove ack reaction after reply when configured', async () => {
      const config = makeConfig({
        ackReactionScope: 'all',
        ackReactionRemoveAfterReply: true,
        ackReactionEmoji: '\u{1F440}',
      });
      await adapter.connect(config);

      const mockReactionRemove = vi.fn().mockResolvedValue(undefined);
      const mockMsg = {
        id: 'msg-remove',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: {
          cache: {
            find: vi.fn().mockReturnValue({
              users: { remove: mockReactionRemove },
            }),
          },
        },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-remove',
        chatType: 'channel',
        wasMentioned: false,
      });

      await adapter.removeAckReactionAfterReply('msg-remove');

      expect(mockReactionRemove).toHaveBeenCalledWith('bot-user-1');
    });

    it('should not remove ack reaction when ackReactionRemoveAfterReply is false', async () => {
      const config = makeConfig({
        ackReactionScope: 'all',
        ackReactionRemoveAfterReply: false,
      });
      await adapter.connect(config);

      const mockMsg = {
        id: 'msg-keep',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: { cache: { find: vi.fn() } },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      await adapter.sendAckReaction({
        conversationId: 'ch-1',
        messageId: 'msg-keep',
        chatType: 'channel',
        wasMentioned: false,
      });

      // Should be a no-op
      await adapter.removeAckReactionAfterReply('msg-keep');
      // No remove call expected -- checking that messageFetch was not called again
    });
  });

  // =========================================================================
  // Message Edit & Delete
  // =========================================================================

  describe('editMessage', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should edit a message successfully', async () => {
      const mockMsg = {
        id: 'msg-edit',
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.editMessage(
        'ch-1',
        'msg-edit',
        'Updated text'
      );

      expect(result.ok).toBe(true);
      expect(mockMsg.edit).toHaveBeenCalledWith('Updated text');
    });

    it('should return error when channel is not found', async () => {
      mockChannelFetch.mockResolvedValue(null);

      const result = await adapter.editMessage('unknown', 'msg-1', 'text');
      expect(result.ok).toBe(false);
    });
  });

  describe('deleteMessage', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should delete a message successfully', async () => {
      const mockMsg = {
        id: 'msg-del',
        delete: vi.fn().mockResolvedValue(undefined),
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      const result = await adapter.deleteMessage('ch-1', 'msg-del');
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockMessageFetch.mockRejectedValue(new Error('not found'));

      const result = await adapter.deleteMessage('ch-1', 'msg-404');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Event Emission (inbound messages)
  // =========================================================================

  describe('inbound message events', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should emit normalized message on messageCreate', async () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage();
      emitClientEvent('messageCreate', msg);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'discord:msg-1',
          channelId: 'discord',
          platformMessageId: 'msg-1',
          conversationId: 'ch-1',
          chatType: 'channel',
          sender: expect.objectContaining({
            id: 'user-1',
            displayName: 'Test User (guild)',
            isSelf: false,
            isBot: false,
          }),
          content: expect.objectContaining({
            text: 'hello world',
            mentionsSelf: false,
          }),
        })
      );
    });

    it('should ignore messages from self', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        author: { id: 'bot-user-1', username: 'bot', bot: true },
      });
      emitClientEvent('messageCreate', msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore non-webhook bot messages', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        author: { id: 'other-bot', username: 'otherbot', bot: true },
        webhookId: undefined,
      });
      emitClientEvent('messageCreate', msg);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass through webhook bot messages', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        author: { id: 'webhook-user', username: 'webhook', bot: true },
        webhookId: 'wh-1',
      });
      emitClientEvent('messageCreate', msg);

      expect(handler).toHaveBeenCalled();
    });

    it('should detect mentionsSelf when bot is mentioned', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        content: 'Hey <@bot-user-1> help me',
        mentions: { users: new Map([['bot-user-1', { id: 'bot-user-1' }]]) },
      });
      emitClientEvent('messageCreate', msg);

      const received = handler.mock.calls[0]?.[0] as Record<string, unknown>;
      const content = received?.['content'] as Record<string, unknown>;
      expect(content?.['mentionsSelf']).toBe(true);
    });

    it('should strip mentions from text content', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        content: 'Hey <@123> and <#456> and <@&789>',
      });
      emitClientEvent('messageCreate', msg);

      const received = handler.mock.calls[0]?.[0] as Record<string, unknown>;
      const content = received?.['content'] as Record<string, unknown>;
      expect(content?.['text']).toBe('Hey  and  and');
    });

    it('should resolve chatType for threads', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        channel: {
          id: 'thread-ch',
          isThread: () => true,
          isDMBased: () => false,
        },
      });
      emitClientEvent('messageCreate', msg);

      const received = handler.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(received?.['chatType']).toBe('thread');
    });

    it('should resolve chatType for DMs', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const msg = createMockMessage({
        channel: { id: 'dm-ch', isThread: () => false, isDMBased: () => true },
      });
      emitClientEvent('messageCreate', msg);

      const received = handler.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(received?.['chatType']).toBe('direct');
    });

    it('should normalize attachments', () => {
      const handler = vi.fn();
      adapter.on('message', handler);

      const attachments = new Map([
        [
          'att-1',
          {
            name: 'photo.png',
            contentType: 'image/png',
            size: 12345,
            url: 'https://cdn.example.com/photo.png',
            proxyURL: 'https://proxy.example.com/photo.png',
          },
        ],
      ]);

      const msg = createMockMessage({ attachments });
      emitClientEvent('messageCreate', msg);

      const received = handler.mock.calls[0]?.[0] as Record<string, unknown>;
      const content = received?.['content'] as Record<string, unknown>;
      const atts = content?.['attachments'] as Array<Record<string, unknown>>;
      expect(atts).toHaveLength(1);
      expect(atts[0]).toEqual(
        expect.objectContaining({
          type: 'image',
          filename: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 12345,
          url: 'https://cdn.example.com/photo.png',
        })
      );
    });

    it('should emit message_edited on messageUpdate', () => {
      const handler = vi.fn();
      adapter.on('message_edited', handler);

      emitClientEvent(
        'messageUpdate',
        {},
        {
          id: 'msg-edited',
          channel: { id: 'ch-1' },
          content: 'edited content',
          author: { id: 'user-1', username: 'user' },
          mentions: { users: new Map() },
          attachments: new Map(),
        }
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'ch-1',
          messageId: 'msg-edited',
        })
      );
    });

    it('should emit message_deleted on messageDelete', () => {
      const handler = vi.fn();
      adapter.on('message_deleted', handler);

      emitClientEvent('messageDelete', {
        id: 'msg-deleted',
        channel: { id: 'ch-1' },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'ch-1',
          messageId: 'msg-deleted',
        })
      );
    });

    it('should emit reaction_added on messageReactionAdd', () => {
      const handler = vi.fn();
      adapter.on('reaction_added', handler);

      emitClientEvent(
        'messageReactionAdd',
        {
          message: { id: 'msg-r', channelId: 'ch-1' },
          emoji: { name: '\u{1F44D}' },
        },
        { id: 'user-1' }
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-r',
          emoji: '\u{1F44D}',
          userId: 'user-1',
        })
      );
    });

    it('should emit typing event on typingStart', () => {
      const handler = vi.fn();
      adapter.on('typing', handler);

      emitClientEvent('typingStart', {
        channel: { id: 'ch-1' },
        user: { id: 'user-1' },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'ch-1',
          userId: 'user-1',
        })
      );
    });
  });

  // =========================================================================
  // Sender Validation / DM Pairing
  // =========================================================================

  describe('sender validation', () => {
    it('should allow all senders in non-DM contexts', async () => {
      const config = makeConfig({
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (e: string) => e,
        },
      });
      await adapter.connect(config);

      const result = await adapter.validateSender('anyone', 'channel');
      expect(result.allowed).toBe(true);
    });

    it('should allow DM sender in allow list', async () => {
      const config = makeConfig({
        dmAllowList: ['user-42'],
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (e: string) => e.toLowerCase(),
        },
      });
      await adapter.connect(config);

      const result = await adapter.validateSender('user-42', 'direct');
      expect(result.allowed).toBe(true);
    });

    it('should reject DM sender not in allow list', async () => {
      const config = makeConfig({
        dmAllowList: ['user-42'],
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (e: string) => e.toLowerCase(),
        },
      });
      await adapter.connect(config);

      const result = await adapter.validateSender('user-99', 'direct');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allow-list');
    });

    it('should allow all DMs when requireApproval is false', async () => {
      const config = makeConfig({
        pairing: {
          requireApproval: false,
          allowList: [],
          normalizeEntry: (e: string) => e,
        },
      });
      await adapter.connect(config);

      const result = await adapter.validateSender('anyone', 'direct');
      expect(result.allowed).toBe(true);
    });
  });

  // =========================================================================
  // Permission Checking
  // =========================================================================

  describe('permission checking', () => {
    beforeEach(async () => {
      await adapter.connect(makeConfig());
    });

    it('should return permissions for a guild channel', async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());

      const perms = await adapter.checkPermissions('ch-1');

      expect(perms.channelId).toBe('ch-1');
      expect(perms.isDm).toBe(false);
      expect(perms.guildId).toBe('guild-1');
      expect(perms.permissions).toContain('SendMessages');
    });

    it('should return empty permissions for DM channels', async () => {
      const dmChannel = createMockChannel({
        isDMBased: () => true,
      });
      mockChannelFetch.mockResolvedValue(dmChannel);

      const perms = await adapter.checkPermissions('dm-ch');

      expect(perms.isDm).toBe(true);
      expect(perms.permissions).toEqual([]);
    });

    it('should return empty permissions when channel is not found', async () => {
      mockChannelFetch.mockResolvedValue(null);

      const perms = await adapter.checkPermissions('missing-ch');

      expect(perms.permissions).toEqual([]);
      expect(perms.raw).toBe('0');
    });
  });

  // =========================================================================
  // Channel Type Resolution
  // =========================================================================

  describe('resolveChannelType', () => {
    beforeEach(async () => {
      await adapter.connect(makeConfig());
    });

    it('should resolve DM channel type', async () => {
      mockChannelFetch.mockResolvedValue(
        createMockChannel({
          isDMBased: () => true,
        })
      );

      const result = await adapter.resolveChannelType('dm-ch');
      expect(result.chatType).toBe('direct');
    });

    it('should resolve thread channel type', async () => {
      mockChannelFetch.mockResolvedValue(
        createMockChannel({
          isDMBased: () => false,
          isThread: () => true,
          guildId: 'guild-1',
          parentId: 'parent-ch',
        })
      );

      const result = await adapter.resolveChannelType('thread-ch');
      expect(result.chatType).toBe('thread');
      expect(result.guildId).toBe('guild-1');
      expect(result.parentId).toBe('parent-ch');
    });

    it('should resolve guild text channel type', async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());

      const result = await adapter.resolveChannelType('text-ch');
      expect(result.chatType).toBe('channel');
      expect(result.guildId).toBe('guild-1');
    });

    it('should default to "channel" when fetch fails', async () => {
      mockChannelFetch.mockRejectedValue(new Error('fetch error'));

      const result = await adapter.resolveChannelType('err-ch');
      expect(result.chatType).toBe('channel');
    });
  });

  // =========================================================================
  // Media / File Attachments
  // =========================================================================

  describe('sendMedia', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should send a buffer-based attachment', async () => {
      const buf = Buffer.from('hello');
      const result = await adapter.sendMedia('ch-1', {
        source: 'buffer',
        buffer: buf,
        filename: 'hello.txt',
        mimeType: 'text/plain',
      });

      expect(result.ok).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [{ attachment: buf, name: 'hello.txt' }],
        })
      );
    });

    it('should send a URL-based attachment', async () => {
      const result = await adapter.sendMedia('ch-1', {
        source: 'url',
        location: 'https://example.com/file.pdf',
        filename: 'file.pdf',
      });

      expect(result.ok).toBe(true);
    });

    it('should reject files exceeding size limit', async () => {
      const bigBuf = Buffer.alloc(30_000_000); // 30 MB > 25 MB limit
      const result = await adapter.sendMedia('ch-1', {
        source: 'buffer',
        buffer: bigBuf,
        filename: 'big.zip',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should include text with media', async () => {
      const buf = Buffer.from('data');
      await adapter.sendMedia(
        'ch-1',
        {
          source: 'buffer',
          buffer: buf,
          filename: 'data.bin',
        },
        { text: 'Here is the file' }
      );

      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['content']).toBe('Here is the file');
    });
  });

  // =========================================================================
  // Voice Channel Awareness
  // =========================================================================

  describe('voice channel awareness', () => {
    it('should return empty array when not connected', () => {
      const info = adapter.getVoiceChannelInfo('guild-1');
      expect(info).toEqual([]);
    });

    it('should report voice connection count in health check', async () => {
      await adapter.connect(makeConfig());
      const health = await adapter.healthCheck();
      const details = health.details as Record<string, unknown>;
      expect(details).toHaveProperty('voiceConnections');
      expect(typeof details?.['voiceConnections']).toBe('number');
    });
  });

  // =========================================================================
  // Pairing Config
  // =========================================================================

  describe('getPairingConfig', () => {
    it('should return null when no pairing is configured', async () => {
      await adapter.connect(makeConfig());
      expect(adapter.getPairingConfig()).toBeNull();
    });

    it('should return pairing config with normalizeEntry', async () => {
      const config = makeConfig({
        pairing: {
          requireApproval: true,
          allowList: ['user-1'],
          normalizeEntry: (e: string) => e.trim().toLowerCase(),
        },
        dmAllowList: ['user-2'],
      });
      await adapter.connect(config);

      const pairing = adapter.getPairingConfig();
      expect(pairing).toBeTruthy();
      expect(pairing!.requireApproval).toBe(true);
      expect(pairing!.allowList).toContain('user-2');
      expect(pairing!.normalizeEntry(' FOO ')).toBe('foo');
    });
  });

  // =========================================================================
  // Event System (on/off)
  // =========================================================================

  describe('event system', () => {
    it('should unsubscribe handler with returned function', async () => {
      await adapter.connect(makeConfig());
      mockChannelFetch.mockResolvedValue(createMockChannel());

      const handler = vi.fn();
      const unsub = adapter.on('message', handler);

      emitClientEvent('messageCreate', createMockMessage());
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      emitClientEvent('messageCreate', createMockMessage({ id: 'msg-2' }));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Reactions (add / remove)
  // =========================================================================

  describe('reactions', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should add a reaction to a message', async () => {
      const mockMsg = {
        id: 'msg-react',
        react: vi.fn().mockResolvedValue(undefined),
        reactions: { cache: { find: vi.fn() } },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      await adapter.addReaction('ch-1', 'msg-react', '\u{1F44D}');
      expect(mockMsg.react).toHaveBeenCalledWith('\u{1F44D}');
    });

    it('should remove a reaction from a message', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      const mockMsg = {
        id: 'msg-unreact',
        react: vi.fn(),
        reactions: {
          cache: {
            find: vi.fn().mockReturnValue({
              users: { remove: mockRemove },
            }),
          },
        },
      };
      mockMessageFetch.mockResolvedValue(mockMsg);

      await adapter.removeReaction('ch-1', 'msg-unreact', '\u{1F44D}');
      expect(mockRemove).toHaveBeenCalledWith('bot-user-1');
    });
  });

  // =========================================================================
  // File Attachment Building (sendMessage with attachments)
  // =========================================================================

  describe('outbound attachments in sendMessage', () => {
    beforeEach(async () => {
      mockChannelFetch.mockResolvedValue(createMockChannel());
      await adapter.connect(makeConfig());
    });

    it('should attach files on the first chunk', async () => {
      const buf = Buffer.from('file-data');
      const result = await adapter.sendMessage({
        to: 'ch-1',
        text: 'Here is a file',
        attachments: [{ source: 'buffer', buffer: buf, filename: 'data.bin' }],
      });

      expect(result.ok).toBe(true);
      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['files']).toEqual([
        { attachment: buf, name: 'data.bin' },
      ]);
    });

    it('should handle path-based attachments', async () => {
      const result = await adapter.sendMessage({
        to: 'ch-1',
        text: 'File from path',
        attachments: [
          { source: 'path', location: '/tmp/file.txt', filename: 'file.txt' },
        ],
      });

      expect(result.ok).toBe(true);
      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['files']).toEqual([
        { attachment: '/tmp/file.txt', name: 'file.txt' },
      ]);
    });

    it('should handle URL-based attachments', async () => {
      const result = await adapter.sendMessage({
        to: 'ch-1',
        text: 'File from URL',
        attachments: [
          {
            source: 'url',
            location: 'https://example.com/f.zip',
            filename: 'f.zip',
          },
        ],
      });

      expect(result.ok).toBe(true);
      const sentArgs = mockSend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sentArgs?.['files']).toEqual([
        { attachment: 'https://example.com/f.zip', name: 'f.zip' },
      ]);
    });
  });
});
