/**
 * Tests for the Telegram Channel Adapter (src/channels/adapters/telegram.ts).
 *
 * Covers:
 *  - Connect / disconnect lifecycle
 *  - Webhook vs polling mode selection
 *  - Message sending (single chunk, multi-chunk, with extras)
 *  - Inline keyboard building
 *  - Rate limiting (token bucket)
 *  - Command handling and dispatch
 *  - Callback query handling with dedup
 *  - Stale thread ID recovery ("message thread not found" retry)
 *  - HTML parse error fallback to plain text
 *  - Chat not found error wrapping
 *  - Forbidden (403) error handling
 *  - Message editing with fallbacks
 *  - Message deletion with graceful "already deleted"
 *  - Typing indicators
 *  - Media sending with thread fallback
 *  - Attachment extraction (photo, document, video, audio, voice, sticker)
 *  - Chat type resolution (private, group, supergroup, forum topic)
 *  - Sender normalization
 *  - Content normalization with mentions and self-mention detection
 *  - Login Widget auth verification
 *  - DM allow-list validation
 *  - Pairing config
 *  - Message splitting (splitTelegramMessage)
 *  - HTML escaping (escapeTelegramHtml)
 *  - Markdown-to-Telegram-HTML conversion (markdownToTelegramHtml)
 *  - Health check
 *  - Reactions (add / remove)
 *  - Topic thread ID resolution
 *  - Edited message events
 *  - Member joined / left events
 *  - Group mention policy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Import the adapter AFTER mocking telegraf.
// ---------------------------------------------------------------------------

import {
  TelegramChannelAdapter,
  splitTelegramMessage,
  escapeTelegramHtml,
  markdownToTelegramHtml,
} from '../../../channels/adapters/telegram.js';

import type {
  TelegramChannelConfig,
  TelegramOutboundMessage,
} from '../../../channels/adapters/telegram.js';
import type { ChannelLogger } from '../../../channels/types.js';

// ---------------------------------------------------------------------------
// Mock the telegraf dynamic import so the adapter does not need a real package.
// We intercept loadBotConstructor() via the module-level import('telegraf').
// ---------------------------------------------------------------------------

const mockGetMe = vi.fn();
const mockSendMessage = vi.fn();
const mockEditMessageText = vi.fn();
const mockDeleteMessage = vi.fn();
const mockSendChatAction = vi.fn();
const mockSetWebhook = vi.fn();
const mockCallApi = vi.fn();
const mockSendPhoto = vi.fn();
const mockSendVideo = vi.fn();
const mockSendAudio = vi.fn();
const mockSendDocument = vi.fn();

const mockBotOn = vi.fn();
const mockBotLaunch = vi.fn();
const mockBotStop = vi.fn();

// The mock bot instance produced by `new Telegraf(token)`.
function createMockBotInstance() {
  return {
    telegram: {
      getMe: mockGetMe,
      sendMessage: mockSendMessage,
      editMessageText: mockEditMessageText,
      deleteMessage: mockDeleteMessage,
      sendChatAction: mockSendChatAction,
      setWebhook: mockSetWebhook,
      callApi: mockCallApi,
      sendPhoto: mockSendPhoto,
      sendVideo: mockSendVideo,
      sendAudio: mockSendAudio,
      sendDocument: mockSendDocument,
    },
    on: mockBotOn,
    launch: mockBotLaunch,
    stop: mockBotStop,
  };
}

// We mock the 'telegraf' module so the dynamic `import('telegraf')` resolves.
vi.mock('telegraf', () => ({
  Telegraf: vi.fn(() => createMockBotInstance()),
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function createLogger(): ChannelLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function baseTelegramConfig(
  overrides: Partial<TelegramChannelConfig> = {}
): TelegramChannelConfig {
  return {
    enabled: true,
    botToken: 'test-bot-token-12345',
    mode: 'polling',
    dropPendingUpdates: true,
    ...overrides,
  };
}

/** Standard getMe response used in most tests. */
const BOT_ME = {
  id: 9999,
  username: 'test_bot',
  first_name: 'TestBot',
  can_join_groups: true,
  can_read_all_group_messages: true,
};

/** Produce a minimal "sent message" response from the Telegram API. */
function sentMsg(overrides: Record<string, unknown> = {}) {
  return {
    message_id: 100,
    chat: { id: -1001234, type: 'group' as const },
    date: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Connect the adapter with default mocks so tests can work with a
 * fully-connected instance.
 */
async function connectAdapter(
  adapter: TelegramChannelAdapter,
  configOverrides: Partial<TelegramChannelConfig> = {}
) {
  mockGetMe.mockResolvedValue(BOT_ME);
  mockCallApi.mockResolvedValue(true); // setMyCommands
  await adapter.connect(baseTelegramConfig(configOverrides));
}

// ---------------------------------------------------------------------------
// Helpers to trigger event handlers registered via bot.on(event, handler)
// ---------------------------------------------------------------------------

type EventHandlerMap = Record<string, ((ctx: unknown) => void)[]>;

function captureEventHandlers(): EventHandlerMap {
  const handlers: EventHandlerMap = {};
  mockBotOn.mockImplementation(
    (event: string, handler: (ctx: unknown) => void) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
    }
  );
  return handlers;
}

function triggerEvent(handlers: EventHandlerMap, event: string, ctx: unknown) {
  const fns = handlers[event];
  if (fns) {
    for (const fn of fns) {
      fn(ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TelegramChannelAdapter', () => {
  let adapter: TelegramChannelAdapter;
  let logger: ChannelLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    logger = createLogger();
    adapter = new TelegramChannelAdapter(logger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Meta / Capabilities
  // =========================================================================

  describe('meta and capabilities', () => {
    it('should have id "telegram"', () => {
      expect(adapter.id).toBe('telegram');
    });

    it('should declare correct capabilities', () => {
      const caps = adapter.capabilities;
      expect(caps.threads).toBe(true);
      expect(caps.reactions).toBe(true);
      expect(caps.media).toBe(true);
      expect(caps.edit).toBe(true);
      expect(caps.delete).toBe(true);
      expect(caps.typingIndicators).toBe(true);
      expect(caps.readReceipts).toBe(false);
      expect(caps.maxMessageLength).toBe(4096);
      expect(caps.maxMediaBytes).toBe(52_428_800);
    });

    it('should include chatTypes direct, group, channel, thread', () => {
      expect(adapter.capabilities.chatTypes).toEqual(
        expect.arrayContaining(['direct', 'group', 'channel', 'thread'])
      );
    });

    it('should expose meta with label and aliases', () => {
      expect(adapter.meta.label).toBe('Telegram');
      expect(adapter.meta.aliases).toContain('tg');
    });
  });

  // =========================================================================
  // Lifecycle: connect / disconnect
  // =========================================================================

  describe('connect', () => {
    it('should throw when botToken is missing', async () => {
      await expect(
        adapter.connect({
          enabled: true,
          botToken: '',
        } as TelegramChannelConfig)
      ).rejects.toThrow('botToken');
    });

    it('should connect in polling mode by default', async () => {
      mockGetMe.mockResolvedValue(BOT_ME);
      mockCallApi.mockResolvedValue(true);

      await adapter.connect(baseTelegramConfig());

      expect(adapter.isConnected()).toBe(true);
      expect(mockBotLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ dropPendingUpdates: true })
      );
      expect(mockSetWebhook).not.toHaveBeenCalled();
    });

    it('should connect in webhook mode when configured', async () => {
      mockGetMe.mockResolvedValue(BOT_ME);
      mockCallApi.mockResolvedValue(true);

      await adapter.connect(
        baseTelegramConfig({
          mode: 'webhook',
          webhookUrl: 'https://example.com/hook',
          webhookSecret: 's3cret',
        })
      );

      expect(adapter.isConnected()).toBe(true);
      expect(mockSetWebhook).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ secret_token: 's3cret' })
      );
      expect(mockBotLaunch).not.toHaveBeenCalled();
    });

    it('should be idempotent (second connect is a no-op)', async () => {
      await connectAdapter(adapter);
      const callsBefore = mockGetMe.mock.calls.length;

      await adapter.connect(baseTelegramConfig());

      expect(mockGetMe.mock.calls.length).toBe(callsBefore);
    });

    it('should emit "connected" event with channelId and accountId', async () => {
      const handler = vi.fn();
      adapter.on('connected', handler);

      await connectAdapter(adapter);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'telegram',
          accountId: '9999',
        })
      );
    });

    it('should sync bot commands including custom commands', async () => {
      mockGetMe.mockResolvedValue(BOT_ME);
      mockCallApi.mockResolvedValue(true);

      await adapter.connect(
        baseTelegramConfig({
          customCommands: [
            { command: 'settings', description: 'Bot settings' },
            { command: '/deploy', description: 'Deploy app' },
          ],
        })
      );

      expect(mockCallApi).toHaveBeenCalledWith('setMyCommands', {
        commands: expect.arrayContaining([
          { command: 'start', description: 'Start the bot' },
          { command: 'help', description: 'Show help information' },
          { command: 'settings', description: 'Bot settings' },
          { command: 'deploy', description: 'Deploy app' },
        ]),
      });
    });

    it('should record the error when connect fails', async () => {
      mockGetMe.mockRejectedValue(new Error('Network down'));

      await expect(adapter.connect(baseTelegramConfig())).rejects.toThrow(
        'Network down'
      );

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should stop the bot and emit disconnected', async () => {
      await connectAdapter(adapter);

      const handler = vi.fn();
      adapter.on('disconnected', handler);

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(mockBotStop).toHaveBeenCalledWith('Orchestrator shutdown');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'telegram' })
      );
    });

    it('should be idempotent (disconnect when already disconnected)', async () => {
      // Never connected.
      await adapter.disconnect();
      expect(mockBotStop).not.toHaveBeenCalled();
    });

    it('should not throw if bot.stop() throws', async () => {
      await connectAdapter(adapter);
      mockBotStop.mockImplementation(() => {
        throw new Error('stop failure');
      });

      // Should not throw.
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // Health Check
  // =========================================================================

  describe('healthCheck', () => {
    it('should return unhealthy when not connected', async () => {
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.connected).toBe(false);
    });

    it('should return healthy with latency when connected', async () => {
      await connectAdapter(adapter);
      mockGetMe.mockResolvedValue(BOT_ME);

      const status = await adapter.healthCheck();

      expect(status.healthy).toBe(true);
      expect(status.connected).toBe(true);
      expect(status.accountId).toBe('9999');
      expect(status.details).toMatchObject({
        username: 'test_bot',
        mode: 'polling',
      });
    });

    it('should return unhealthy when getMe throws', async () => {
      await connectAdapter(adapter);
      mockGetMe.mockRejectedValue(new Error('API timeout'));

      const status = await adapter.healthCheck();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toBe('API timeout');
    });
  });

  // =========================================================================
  // Send Message
  // =========================================================================

  describe('sendMessage', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should throw when not connected', async () => {
      const fresh = new TelegramChannelAdapter(logger);
      await expect(
        fresh.sendMessage({ to: '123', text: 'hi' })
      ).rejects.toThrow('not connected');
    });

    it('should send a simple text message with HTML parse mode', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      const result = await adapter.sendMessage({
        to: '-1001234',
        text: 'Hello world',
      });

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('100');
      expect(mockSendMessage).toHaveBeenCalledWith(
        '-1001234',
        'Hello world',
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('should attach reply_to_message_id on first chunk only', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'reply',
        replyTo: '42',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'reply',
        expect.objectContaining({ reply_to_message_id: 42 })
      );
    });

    it('should set silent and protectContent flags', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'quiet',
        silent: true,
        protectContent: true,
      } as TelegramOutboundMessage);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'quiet',
        expect.objectContaining({
          disable_notification: true,
          protect_content: true,
        })
      );
    });

    it('should set link preview disabled', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'no preview',
        disableLinkPreview: true,
      } as TelegramOutboundMessage);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'no preview',
        expect.objectContaining({
          link_preview_options: { is_disabled: true },
        })
      );
    });

    it('should set message_thread_id from topicThreadId', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'topic msg',
        topicThreadId: 42,
      } as TelegramOutboundMessage);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'topic msg',
        expect.objectContaining({ message_thread_id: 42 })
      );
    });

    it('should set message_thread_id from threadId string', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'thread msg',
        threadId: '55',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'thread msg',
        expect.objectContaining({ message_thread_id: 55 })
      );
    });

    it('should prefer topicThreadId over threadId', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'both',
        threadId: '55',
        topicThreadId: 99,
      } as TelegramOutboundMessage);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'both',
        expect.objectContaining({ message_thread_id: 99 })
      );
    });
  });

  // =========================================================================
  // Stale Thread Recovery
  // =========================================================================

  describe('stale thread recovery', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should retry without message_thread_id on "message thread not found"', async () => {
      mockSendMessage
        .mockRejectedValueOnce(
          new Error('400: Bad Request: message thread not found')
        )
        .mockResolvedValueOnce(sentMsg());

      const result = await adapter.sendMessage({
        to: '123',
        text: 'retry',
        topicThreadId: 42,
      } as TelegramOutboundMessage);

      expect(result.ok).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      // Second call should NOT have message_thread_id.
      const secondCallExtra = mockSendMessage.mock.calls[1][2];
      expect(secondCallExtra).not.toHaveProperty('message_thread_id');
    });

    it('should NOT retry if error is not thread-related', async () => {
      mockSendMessage.mockRejectedValue(
        new Error('400: Bad Request: chat not found')
      );

      const result = await adapter.sendMessage({
        to: '123',
        text: 'fail',
        topicThreadId: 42,
      } as TelegramOutboundMessage);

      expect(result.ok).toBe(false);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry thread recovery if no thread ID was set', async () => {
      mockSendMessage.mockRejectedValue(
        new Error('400: Bad Request: message thread not found')
      );

      const result = await adapter.sendMessage({
        to: '123',
        text: 'no thread',
      });

      expect(result.ok).toBe(false);
      // Only one attempt because there is no thread to strip.
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // HTML Parse Error Fallback
  // =========================================================================

  describe('HTML parse error fallback', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should retry as plain text when "can\'t parse entities" error occurs', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error("can't parse entities: invalid HTML"))
        .mockResolvedValueOnce(sentMsg());

      const result = await adapter.sendMessage({
        to: '123',
        text: 'broken <html',
      });

      expect(result.ok).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      // Second call should NOT have parse_mode.
      const secondCallExtra = mockSendMessage.mock.calls[1][2];
      expect(secondCallExtra).not.toHaveProperty('parse_mode');
    });

    it('should return error if plain text fallback also fails', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error("can't parse entities"))
        .mockRejectedValueOnce(new Error('some other error'));

      const result = await adapter.sendMessage({
        to: '123',
        text: 'double fail',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // =========================================================================
  // Chat Not Found Wrapping
  // =========================================================================

  describe('chat not found error wrapping', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should wrap "chat not found" with helpful context', async () => {
      mockSendMessage.mockRejectedValue(
        new Error('400: Bad Request: chat not found')
      );

      const result = await adapter.sendMessage({
        to: 'bad-chat',
        text: 'hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('chat not found');
      expect(result.error).toContain('chat_id=bad-chat');
      expect(result.error).toContain('bot not started');
    });
  });

  // =========================================================================
  // Forbidden (403) Error
  // =========================================================================

  describe('forbidden (403) handling', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should log a warning and return error on 403 Forbidden', async () => {
      mockSendMessage.mockRejectedValue(
        new Error('403: Forbidden: bot was blocked by the user')
      );

      const result = await adapter.sendMessage({
        to: '123',
        text: 'blocked',
      });

      expect(result.ok).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('403 Forbidden')
      );
    });
  });

  // =========================================================================
  // Inline Keyboards
  // =========================================================================

  describe('inline keyboards', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should attach inline keyboard markup to the last chunk', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'choose',
        inlineKeyboard: [
          [
            { text: 'Yes', callbackData: 'yes' },
            { text: 'No', callbackData: 'no' },
          ],
          [{ text: 'Open', url: 'https://example.com' }],
        ],
      } as TelegramOutboundMessage);

      expect(mockSendMessage).toHaveBeenCalledWith(
        '123',
        'choose',
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Yes', callback_data: 'yes' },
                { text: 'No', callback_data: 'no' },
              ],
              [{ text: 'Open', url: 'https://example.com' }],
            ],
          },
        })
      );
    });

    it('should filter out buttons without callbackData or url', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'partial',
        inlineKeyboard: [
          [
            { text: 'Valid', callbackData: 'ok' },
            { text: 'InvalidNoData' } as any,
          ],
        ],
      } as TelegramOutboundMessage);

      const extra = mockSendMessage.mock.calls[0][2] as Record<string, any>;
      expect(extra.reply_markup.inline_keyboard[0]).toHaveLength(1);
      expect(extra.reply_markup.inline_keyboard[0][0].text).toBe('Valid');
    });

    it('should not set reply_markup when inlineKeyboard is empty', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      await adapter.sendMessage({
        to: '123',
        text: 'no buttons',
        inlineKeyboard: [],
      } as TelegramOutboundMessage);

      const extra = mockSendMessage.mock.calls[0][2] as Record<string, any>;
      expect(extra.reply_markup).toBeUndefined();
    });

    it('should edit a message keyboard via editMessageKeyboard', async () => {
      mockCallApi.mockResolvedValue(true);

      const result = await adapter.editMessageKeyboard('123', '456', [
        [{ text: 'A', callbackData: 'a' }],
      ]);

      expect(result.ok).toBe(true);
      expect(mockCallApi).toHaveBeenCalledWith('editMessageReplyMarkup', {
        chat_id: '123',
        message_id: 456,
        reply_markup: {
          inline_keyboard: [[{ text: 'A', callback_data: 'a' }]],
        },
      });
    });

    it('should clear keyboard when editMessageKeyboard is called with undefined', async () => {
      mockCallApi.mockResolvedValue(true);

      const result = await adapter.editMessageKeyboard('123', '456');

      expect(result.ok).toBe(true);
      expect(mockCallApi).toHaveBeenCalledWith('editMessageReplyMarkup', {
        chat_id: '123',
        message_id: 456,
        reply_markup: { inline_keyboard: [] },
      });
    });
  });

  // =========================================================================
  // Rate Limiting (token bucket)
  // =========================================================================

  describe('rate limiting', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should allow up to 30 rapid sends before blocking', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      // Send 30 messages rapidly -- they should all resolve immediately.
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 30; i++) {
        promises.push(adapter.sendMessage({ to: '123', text: `msg${i}` }));
      }

      await Promise.all(promises);
      expect(mockSendMessage).toHaveBeenCalledTimes(30);
    });

    it('should delay the 31st message until bucket refills', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      // Exhaust the 30-token bucket.
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 30; i++) {
        promises.push(adapter.sendMessage({ to: '123', text: `msg${i}` }));
      }
      await Promise.all(promises);

      // 31st send should be queued.
      let resolved31 = false;
      const p31 = adapter.sendMessage({ to: '123', text: 'msg30' }).then(() => {
        resolved31 = true;
      });

      // It should not have resolved yet.
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved31).toBe(false);

      // Advance past the refill interval (1000ms).
      await vi.advanceTimersByTimeAsync(1000);
      await p31;
      expect(resolved31).toBe(true);
    });
  });

  // =========================================================================
  // Command Handling
  // =========================================================================

  describe('command handling', () => {
    it('should register and invoke custom command handlers', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const settingsHandler = vi.fn();
      adapter.onCommand('settings', settingsHandler);

      // Simulate an inbound /settings message through the 'message' bot event.
      const msg = {
        message_id: 1,
        chat: { id: 100, type: 'private' },
        from: { id: 42, is_bot: false, first_name: 'Alice' },
        date: Math.floor(Date.now() / 1000),
        text: '/settings',
        entities: [{ type: 'bot_command', offset: 0, length: 9 }],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(settingsHandler).toHaveBeenCalledWith(msg);
    });

    it('should unsubscribe command handler when unsub function is called', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const handler = vi.fn();
      const unsub = adapter.onCommand('test', handler);
      unsub();

      const msg = {
        message_id: 1,
        chat: { id: 100, type: 'private' },
        from: { id: 42, is_bot: false, first_name: 'Alice' },
        date: Math.floor(Date.now() / 1000),
        text: '/test',
        entities: [{ type: 'bot_command', offset: 0, length: 5 }],
      };

      // Since the handler was unsubscribed, it should emit as a regular
      // message instead.
      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      triggerEvent(handlers, 'message', { message: msg });

      expect(handler).not.toHaveBeenCalled();
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should extract command name ignoring @botname suffix', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const helpHandler = vi.fn();
      adapter.onCommand('help', helpHandler);

      const msg = {
        message_id: 1,
        chat: { id: 100, type: 'group' },
        from: { id: 42, is_bot: false, first_name: 'Alice' },
        date: Math.floor(Date.now() / 1000),
        text: '/help@test_bot',
        entities: [{ type: 'bot_command', offset: 0, length: 14 }],
      };

      triggerEvent(handlers, 'message', { message: msg });
      expect(helpHandler).toHaveBeenCalled();
    });

    it('should emit unregistered commands as regular messages', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 1,
        chat: { id: 100, type: 'private' },
        from: { id: 42, is_bot: false, first_name: 'Alice' },
        date: Math.floor(Date.now() / 1000),
        text: '/unknown_cmd arg1',
        entities: [{ type: 'bot_command', offset: 0, length: 12 }],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'telegram',
          content: expect.objectContaining({ text: '/unknown_cmd arg1' }),
        })
      );
    });

    it('should dispatch built-in /start command and emit message', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 1,
        chat: { id: 100, type: 'private' },
        from: { id: 42, is_bot: false, first_name: 'Alice' },
        date: Math.floor(Date.now() / 1000),
        text: '/start deeplink_param',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            text: '/start deeplink_param',
          }),
        })
      );
    });
  });

  // =========================================================================
  // Callback Query Handling
  // =========================================================================

  describe('callback query handling', () => {
    it('should dispatch callback queries to registered handlers', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true); // answerCallbackQuery

      const cbHandler = vi.fn().mockReturnValue(true);
      adapter.onCallbackQuery(cbHandler);

      const ctx = {
        callbackQuery: {
          id: 'cq-1',
          data: 'action:confirm',
          from: {
            id: 42,
            is_bot: false,
            first_name: 'Alice',
            username: 'alice',
          },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
          },
        },
      };

      await triggerEvent(handlers, 'callback_query', ctx);
      // Let async handlers settle.
      await vi.advanceTimersByTimeAsync(10);

      expect(cbHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          queryId: 'cq-1',
          data: 'action:confirm',
          chatId: '100',
        })
      );
    });

    it('should dedup duplicate callback queries', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      const cbHandler = vi.fn().mockReturnValue(true);
      adapter.onCallbackQuery(cbHandler);

      const ctx = {
        callbackQuery: {
          id: 'cq-dup',
          data: 'action:x',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
          },
        },
      };

      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);

      // Second delivery of the same query ID.
      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);

      expect(cbHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit unhandled callback queries as message events', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      // No callback handler registered, so it should fall through.
      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const ctx = {
        callbackQuery: {
          id: 'cq-unhandled',
          data: 'orphan_action',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            from: { id: 42, is_bot: false, first_name: 'A' },
          },
        },
      };

      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            text: '[callback] orphan_action',
          }),
        })
      );
    });

    it('should unsubscribe callback handler when unsub function is called', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      const cbHandler = vi.fn().mockReturnValue(true);
      const unsub = adapter.onCallbackQuery(cbHandler);
      unsub();

      const ctx = {
        callbackQuery: {
          id: 'cq-unsub',
          data: 'action',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            from: { id: 42, is_bot: false, first_name: 'A' },
          },
        },
      };

      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);

      expect(cbHandler).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edit Message
  // =========================================================================

  describe('editMessage', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should edit a message successfully', async () => {
      mockEditMessageText.mockResolvedValue(undefined);

      const result = await adapter.editMessage('123', '456', 'updated text');

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('456');
      expect(mockEditMessageText).toHaveBeenCalledWith(
        '123',
        456,
        undefined,
        'updated text',
        { parse_mode: 'HTML' }
      );
    });

    it('should retry as plain text on parse error', async () => {
      mockEditMessageText
        .mockRejectedValueOnce(new Error("can't parse entities"))
        .mockResolvedValueOnce(undefined);

      const result = await adapter.editMessage('123', '456', 'bad <html');

      expect(result.ok).toBe(true);
      expect(mockEditMessageText).toHaveBeenCalledTimes(2);
    });

    it('should handle "message to edit not found" gracefully', async () => {
      mockEditMessageText.mockRejectedValue(
        new Error('400: Bad Request: message to edit not found')
      );

      const result = await adapter.editMessage('123', '456', 'gone');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Message to edit not found.');
    });
  });

  // =========================================================================
  // Delete Message
  // =========================================================================

  describe('deleteMessage', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should delete a message successfully', async () => {
      mockDeleteMessage.mockResolvedValue(undefined);

      const ok = await adapter.deleteMessage('123', '456');

      expect(ok).toBe(true);
      expect(mockDeleteMessage).toHaveBeenCalledWith('123', 456);
    });

    it('should return true when message is already deleted', async () => {
      mockDeleteMessage.mockRejectedValue(
        new Error('400: Bad Request: message to delete not found')
      );

      const ok = await adapter.deleteMessage('123', '456');
      expect(ok).toBe(true);
    });

    it('should return false on unexpected error', async () => {
      mockDeleteMessage.mockRejectedValue(
        new Error('500: Internal Server Error')
      );

      const ok = await adapter.deleteMessage('123', '456');
      expect(ok).toBe(false);
    });
  });

  // =========================================================================
  // Typing Indicators
  // =========================================================================

  describe('sendTypingIndicator', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should send typing action immediately and return a stop handle', () => {
      mockSendChatAction.mockResolvedValue(undefined);

      const handle = adapter.sendTypingIndicator('123');

      expect(handle).toBeDefined();
      expect(handle.stop).toBeInstanceOf(Function);
      expect(mockSendChatAction).toHaveBeenCalledWith('123', 'typing');
    });

    it('should periodically refresh typing every 4 seconds', async () => {
      mockSendChatAction.mockResolvedValue(undefined);

      const handle = adapter.sendTypingIndicator('123');

      // Initial call.
      expect(mockSendChatAction).toHaveBeenCalledTimes(1);

      // After 4 seconds, should refresh.
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockSendChatAction).toHaveBeenCalledTimes(2);

      // After another 4 seconds.
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockSendChatAction).toHaveBeenCalledTimes(3);

      handle.stop();

      // After stopping, no more calls.
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockSendChatAction).toHaveBeenCalledTimes(3);
    });

    it('should return a no-op handle when not connected', () => {
      const fresh = new TelegramChannelAdapter(logger);
      const handle = fresh.sendTypingIndicator('123');
      expect(handle.stop).toBeInstanceOf(Function);
      handle.stop(); // Should not throw.
    });
  });

  // =========================================================================
  // Reactions
  // =========================================================================

  describe('reactions', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should call setMessageReaction with emoji on addReaction', async () => {
      mockCallApi.mockResolvedValue(true);

      await adapter.addReaction('123', '456', '👍');

      expect(mockCallApi).toHaveBeenCalledWith('setMessageReaction', {
        chat_id: '123',
        message_id: 456,
        reaction: [{ type: 'emoji', emoji: '👍' }],
      });
    });

    it('should call setMessageReaction with empty array on removeReaction', async () => {
      mockCallApi.mockResolvedValue(true);

      await adapter.removeReaction('123', '456', '👍');

      expect(mockCallApi).toHaveBeenCalledWith('setMessageReaction', {
        chat_id: '123',
        message_id: 456,
        reaction: [],
      });
    });

    it('should not throw on reaction errors', async () => {
      mockCallApi.mockRejectedValue(new Error('Bad Request'));

      await expect(
        adapter.addReaction('123', '456', '👍')
      ).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Inbound Message Normalization
  // =========================================================================

  describe('inbound message normalization', () => {
    it('should normalize a private chat message', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 7,
        chat: { id: 42, type: 'private' },
        from: {
          id: 100,
          is_bot: false,
          first_name: 'Alice',
          last_name: 'Smith',
          username: 'alice_s',
        },
        date: 1700000000,
        text: 'Hello bot!',
        entities: [],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'telegram:42:7',
          channelId: 'telegram',
          platformMessageId: '7',
          conversationId: '42',
          chatType: 'direct',
          sender: expect.objectContaining({
            id: '100',
            displayName: 'Alice Smith',
            username: 'alice_s',
            isSelf: false,
            isBot: false,
          }),
          content: expect.objectContaining({
            text: 'Hello bot!',
            mentionsSelf: false,
          }),
        })
      );
    });

    it('should resolve supergroup with thread as "thread" chat type', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 8,
        message_thread_id: 55,
        is_topic_message: true,
        chat: { id: -1001234, type: 'supergroup', is_forum: true },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'topic message',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'thread',
          threadId: '55',
        })
      );
    });

    it('should resolve group chat type', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 9,
        chat: { id: -500, type: 'group' },
        from: { id: 100, is_bot: false, first_name: 'Bob' },
        date: 1700000000,
        text: 'group hello',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ chatType: 'group' })
      );
    });

    it('should resolve channel chat type', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 10,
        chat: { id: -1009876, type: 'channel' },
        from: { id: 100, is_bot: false, first_name: 'Bob' },
        date: 1700000000,
        text: 'channel post',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ chatType: 'channel' })
      );
    });

    it('should skip messages from self', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 11,
        chat: { id: 42, type: 'private' },
        from: { id: 9999, is_bot: true, first_name: 'TestBot' },
        date: 1700000000,
        text: 'echo',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should detect self-mention via @username entity', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 12,
        chat: { id: -500, type: 'group' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '@test_bot help me',
        entities: [{ type: 'mention', offset: 0, length: 9 }],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            mentionsSelf: true,
            mentions: expect.arrayContaining(['test_bot']),
          }),
        })
      );
    });

    it('should detect self-mention via text_mention entity', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 13,
        chat: { id: -500, type: 'group' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'TestBot help me',
        entities: [
          { type: 'text_mention', offset: 0, length: 7, user: { id: 9999 } },
        ],
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            mentionsSelf: true,
            mentions: expect.arrayContaining(['9999']),
          }),
        })
      );
    });

    it('should extract reply_to message ID', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 14,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'reply text',
        reply_to_message: { message_id: 5 },
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: '5' })
      );
    });
  });

  // =========================================================================
  // Group Mention Policy
  // =========================================================================

  describe('group mention policy', () => {
    it('should drop group messages when groupRequireMention is true and bot is not mentioned', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter, { groupRequireMention: true });

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 1,
        chat: { id: -500, type: 'group' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'hello everyone',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should pass through group messages when bot is mentioned', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter, { groupRequireMention: true });

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 1,
        chat: { id: -500, type: 'group' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '@test_bot help me',
      };

      triggerEvent(handlers, 'message', { message: msg });

      expect(messageHandler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Attachment Extraction
  // =========================================================================

  describe('attachment extraction', () => {
    it('should extract photo attachment (largest size)', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 20,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        photo: [
          { file_id: 'small', file_size: 1000 },
          { file_id: 'medium', file_size: 5000 },
          { file_id: 'large', file_size: 20000 },
        ],
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments).toHaveLength(1);
      expect(normalized.content.attachments[0]).toMatchObject({
        type: 'image',
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        url: 'telegram:file:large',
        sizeBytes: 20000,
      });
    });

    it('should extract document attachment', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 21,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        document: {
          file_id: 'doc1',
          file_name: 'report.pdf',
          mime_type: 'application/pdf',
          file_size: 50000,
        },
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments[0]).toMatchObject({
        type: 'file',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        url: 'telegram:file:doc1',
      });
    });

    it('should extract video attachment', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 22,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        video: { file_id: 'vid1', mime_type: 'video/mp4', file_size: 80000 },
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments[0]).toMatchObject({
        type: 'video',
        url: 'telegram:file:vid1',
      });
    });

    it('should extract voice attachment', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 23,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        voice: { file_id: 'voice1', mime_type: 'audio/ogg', file_size: 3000 },
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments[0]).toMatchObject({
        type: 'audio',
        filename: 'voice.ogg',
        mimeType: 'audio/ogg',
      });
    });

    it('should extract sticker attachment', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 24,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        sticker: {
          file_id: 'sticker1',
          set_name: 'FunPack',
          is_animated: false,
        },
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments[0]).toMatchObject({
        type: 'image',
        filename: 'FunPack.webp',
        mimeType: 'image/webp',
      });
    });

    it('should mark animated sticker with tgsticker mime type', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      adapter.on('message', messageHandler);

      const msg = {
        message_id: 25,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: '',
        sticker: {
          file_id: 'sticker2',
          is_animated: true,
        },
      };

      triggerEvent(handlers, 'message', { message: msg });

      const normalized = messageHandler.mock.calls[0][0];
      expect(normalized.content.attachments[0].mimeType).toBe(
        'application/x-tgsticker'
      );
    });
  });

  // =========================================================================
  // Edited Message Events
  // =========================================================================

  describe('edited message events', () => {
    it('should emit message_edited when an edited_message event arrives', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const editHandler = vi.fn();
      adapter.on('message_edited', editHandler);

      const msg = {
        message_id: 30,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'edited text',
      };

      triggerEvent(handlers, 'edited_message', { editedMessage: msg });

      expect(editHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'telegram',
          conversationId: '42',
          messageId: '30',
          newContent: expect.objectContaining({ text: 'edited text' }),
        })
      );
    });
  });

  // =========================================================================
  // Member Events
  // =========================================================================

  describe('member events', () => {
    it('should emit member_joined when a new member joins', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const joinHandler = vi.fn();
      adapter.on('member_joined', joinHandler);

      const ctx = {
        chatMember: {
          chat: { id: -500 },
          new_chat_member: {
            user: { id: 200 },
            status: 'member',
          },
        },
      };

      triggerEvent(handlers, 'chat_member', ctx);

      expect(joinHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'telegram',
          conversationId: '-500',
          userId: '200',
        })
      );
    });

    it('should emit member_left when a member is kicked', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const leftHandler = vi.fn();
      adapter.on('member_left', leftHandler);

      const ctx = {
        chatMember: {
          chat: { id: -500 },
          new_chat_member: {
            user: { id: 200 },
            status: 'kicked',
          },
        },
      };

      triggerEvent(handlers, 'chat_member', ctx);

      expect(leftHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '-500',
          userId: '200',
        })
      );
    });
  });

  // =========================================================================
  // Reply To Thread
  // =========================================================================

  describe('replyToThread', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should delegate to sendMessage with threadId set', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      const result = await adapter.replyToThread('-1001234', '55', {
        to: '-1001234',
        text: 'thread reply',
      });

      expect(result.ok).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(
        '-1001234',
        'thread reply',
        expect.objectContaining({ message_thread_id: 55 })
      );
    });
  });

  // =========================================================================
  // Sender Validation / DM Allow-List
  // =========================================================================

  describe('validateSender', () => {
    it('should always allow group messages', async () => {
      await connectAdapter(adapter, {
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (raw: string) => raw,
        },
      });

      const result = await adapter.validateSender('unknown', 'group');
      expect(result.allowed).toBe(true);
    });

    it('should allow any DM sender when requireApproval is false', async () => {
      await connectAdapter(adapter);

      const result = await adapter.validateSender('anyone', 'direct');
      expect(result.allowed).toBe(true);
    });

    it('should deny DM senders not in allow list', async () => {
      await connectAdapter(adapter, {
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (raw: string) => raw,
        },
        dmAllowList: ['alice'],
      });

      const result = await adapter.validateSender('bob', 'direct');
      expect(result.allowed).toBe(false);
      expect(result.pendingApproval).toBe(true);
    });

    it('should allow DM senders in the allow list (case-insensitive)', async () => {
      await connectAdapter(adapter, {
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (raw: string) => raw,
        },
        dmAllowList: ['Alice', 'telegram:bob'],
      });

      const aliceResult = await adapter.validateSender('alice', 'direct');
      expect(aliceResult.allowed).toBe(true);

      const bobResult = await adapter.validateSender('bob', 'direct');
      expect(bobResult.allowed).toBe(true);
    });
  });

  // =========================================================================
  // Pairing Config
  // =========================================================================

  describe('getPairingConfig', () => {
    it('should return null when no pairing is configured', async () => {
      await connectAdapter(adapter);
      expect(adapter.getPairingConfig()).toBeNull();
    });

    it('should return pairing config with normalizeEntry that strips prefixes', async () => {
      await connectAdapter(adapter, {
        pairing: {
          requireApproval: true,
          allowList: [],
          normalizeEntry: (raw: string) => raw,
        },
        dmAllowList: ['alice'],
      });

      const config = adapter.getPairingConfig();
      expect(config).not.toBeNull();
      expect(config!.requireApproval).toBe(true);
      expect(config!.normalizeEntry('telegram:Alice')).toBe('alice');
      expect(config!.normalizeEntry('tg:Bob')).toBe('bob');
    });
  });

  // =========================================================================
  // Login Widget Authentication
  // =========================================================================

  describe('validateLoginWidget', () => {
    it('should return invalid when no bot token is available', async () => {
      // Fresh adapter, not connected.
      const result = await adapter.validateLoginWidget({
        id: '123',
        auth_date: String(Math.floor(Date.now() / 1000)),
        hash: 'abc',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No bot token');
    });

    it('should return invalid when hash is missing', async () => {
      await connectAdapter(adapter);

      const result = await adapter.validateLoginWidget({
        id: '123',
        auth_date: String(Math.floor(Date.now() / 1000)),
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing hash');
    });

    it('should return invalid when auth data has expired (>24h)', async () => {
      await connectAdapter(adapter);

      const oldTimestamp = Math.floor(Date.now() / 1000) - 90000; // >24h ago

      const result = await adapter.validateLoginWidget({
        id: '123',
        auth_date: String(oldTimestamp),
        hash: 'abc',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should validate a correct HMAC and return user info', async () => {
      await connectAdapter(adapter);

      // Compute the expected hash manually using the same algorithm.
      const crypto = await import('crypto');
      const token = 'test-bot-token-12345';
      const authDate = String(Math.floor(Date.now() / 1000));
      const data = { auth_date: authDate, id: '42', username: 'alice' };

      const checkString = Object.keys(data)
        .sort()
        .map(key => `${key}=${data[key as keyof typeof data]}`)
        .join('\n');

      const secretKey = crypto.createHash('sha256').update(token).digest();
      const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

      const result = await adapter.validateLoginWidget({
        ...data,
        hash: expectedHash,
      });

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('42');
      expect(result.username).toBe('alice');
    });

    it('should reject incorrect HMAC', async () => {
      await connectAdapter(adapter);

      const result = await adapter.validateLoginWidget({
        id: '42',
        auth_date: String(Math.floor(Date.now() / 1000)),
        hash: 'deadbeef1234567890abcdef',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Hash verification failed');
    });
  });

  // =========================================================================
  // Media Sending
  // =========================================================================

  describe('sendMedia', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should reject oversized buffer attachments', async () => {
      const bigBuffer = Buffer.alloc(52_428_800 + 1);

      const result = await adapter.sendMedia('123', {
        source: 'buffer',
        buffer: bigBuffer,
        filename: 'huge.bin',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('huge.bin');
      expect(result.error).toContain('limit');
    });

    it('should send a photo via sendPhoto', async () => {
      mockSendPhoto.mockResolvedValue(sentMsg());

      const result = await adapter.sendMedia('123', {
        source: 'buffer',
        buffer: Buffer.from('fake-image'),
        filename: 'img.jpg',
        mimeType: 'image/jpeg',
      });

      expect(result.ok).toBe(true);
      expect(mockSendPhoto).toHaveBeenCalled();
    });

    it('should send a document via sendDocument for non-media types', async () => {
      mockSendDocument.mockResolvedValue(sentMsg());

      const result = await adapter.sendMedia('123', {
        source: 'url',
        location: 'https://example.com/file.zip',
        filename: 'file.zip',
        mimeType: 'application/zip',
      });

      expect(result.ok).toBe(true);
      expect(mockSendDocument).toHaveBeenCalled();
    });

    it('should truncate caption to 1024 characters', async () => {
      mockSendPhoto.mockResolvedValue(sentMsg());

      const longCaption = 'a'.repeat(2000);

      await adapter.sendMedia(
        '123',
        {
          source: 'buffer',
          buffer: Buffer.from('img'),
          filename: 'img.png',
          mimeType: 'image/png',
        },
        { text: longCaption }
      );

      const extra = mockSendPhoto.mock.calls[0][2] as Record<string, any>;
      expect(extra.caption.length).toBeLessThanOrEqual(1024);
      expect(extra.caption.endsWith('...')).toBe(true);
    });

    it('should retry media send without thread on stale thread error', async () => {
      mockSendPhoto
        .mockRejectedValueOnce(
          new Error('400: Bad Request: message thread not found')
        )
        .mockResolvedValueOnce(sentMsg());

      const result = await adapter.sendMedia(
        '123',
        {
          source: 'buffer',
          buffer: Buffer.from('img'),
          filename: 'img.jpg',
          mimeType: 'image/jpeg',
        },
        { threadId: '42' }
      );

      expect(result.ok).toBe(true);
      expect(mockSendPhoto).toHaveBeenCalledTimes(2);

      const secondCallExtra = mockSendPhoto.mock.calls[1][2] as Record<
        string,
        any
      >;
      expect(secondCallExtra).not.toHaveProperty('message_thread_id');
    });
  });

  // =========================================================================
  // Message Splitting (exported function)
  // =========================================================================

  describe('splitTelegramMessage', () => {
    it('should return the original text in a single-element array when within limit', () => {
      const result = splitTelegramMessage('short text', 4096);
      expect(result).toEqual(['short text']);
    });

    it('should return [""] for empty text', () => {
      const result = splitTelegramMessage('', 4096);
      expect(result).toEqual(['']);
    });

    it('should split long messages at newline boundaries', () => {
      const line = 'Line content here\n';
      const text = line.repeat(300); // ~5400 chars

      const chunks = splitTelegramMessage(text, 100);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(100);
      }

      // Rejoining the chunks should reconstruct approximately the original text.
      const rejoined = chunks.join('\n');
      // Every line of content should be present.
      expect(rejoined).toContain('Line content here');
    });

    it('should split at space boundaries when no newlines in range', () => {
      const words = Array(100).fill('word').join(' '); // 499 chars
      const chunks = splitTelegramMessage(words, 50);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(50);
      }
    });

    it('should hard-break when no soft break is available', () => {
      const noSpaces = 'x'.repeat(200);
      const chunks = splitTelegramMessage(noSpaces, 50);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBe(50);
    });

    it('should avoid splitting inside code blocks', () => {
      const code = '```\n' + 'x'.repeat(80) + '\n```';
      const text = 'Before\n' + code + '\nAfter';

      // Use a limit that would cut into the code block.
      const chunks = splitTelegramMessage(text, 50);

      // The first chunk should not contain a partial code block opener
      // without a corresponding closer (or be split before the code block).
      // Verify that no chunk has an odd number of ``` markers.
      for (const chunk of chunks) {
        const count = (chunk.match(/```/g) || []).length;
        // Either 0 or 2 occurrences (not 1, which would be a split inside).
        expect(count % 2).toBe(0);
      }
    });
  });

  // =========================================================================
  // Multi-Chunk Sending
  // =========================================================================

  describe('multi-chunk message sending', () => {
    beforeEach(async () => {
      await connectAdapter(adapter);
    });

    it('should send multiple chunks and attach inline keyboard to last chunk only', async () => {
      mockSendMessage.mockResolvedValue(sentMsg());

      // Create a message that will split into at least 2 chunks.
      const longText = 'word '.repeat(1000); // ~5000 chars

      await adapter.sendMessage({
        to: '123',
        text: longText,
        inlineKeyboard: [[{ text: 'OK', callbackData: 'ok' }]],
      } as TelegramOutboundMessage);

      expect(mockSendMessage.mock.calls.length).toBeGreaterThan(1);

      // Only the last call should have reply_markup.
      const calls = mockSendMessage.mock.calls;
      for (let i = 0; i < calls.length - 1; i++) {
        const extra = calls[i][2] as Record<string, any>;
        expect(extra.reply_markup).toBeUndefined();
      }

      const lastExtra = calls[calls.length - 1][2] as Record<string, any>;
      expect(lastExtra.reply_markup).toBeDefined();
    });

    it('should stop sending chunks after the first failure', async () => {
      mockSendMessage
        .mockResolvedValueOnce(sentMsg())
        .mockRejectedValueOnce(new Error('rate limited'));

      const longText = 'word '.repeat(1000);

      const result = await adapter.sendMessage({
        to: '123',
        text: longText,
      });

      expect(result.ok).toBe(false);
      // Should have stopped at the second chunk.
      expect(mockSendMessage.mock.calls.length).toBe(2);
    });
  });

  // =========================================================================
  // HTML Escaping (exported function)
  // =========================================================================

  describe('escapeTelegramHtml', () => {
    it('should escape &, <, >', () => {
      expect(escapeTelegramHtml('a & b < c > d')).toBe(
        'a &amp; b &lt; c &gt; d'
      );
    });

    it('should handle empty string', () => {
      expect(escapeTelegramHtml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(escapeTelegramHtml('hello world')).toBe('hello world');
    });
  });

  // =========================================================================
  // Markdown-to-Telegram-HTML (exported function)
  // =========================================================================

  describe('markdownToTelegramHtml', () => {
    it('should convert **bold** to <b>bold</b>', () => {
      expect(markdownToTelegramHtml('**bold**')).toBe('<b>bold</b>');
    });

    it('should convert __bold__ to <b>bold</b>', () => {
      expect(markdownToTelegramHtml('__bold__')).toBe('<b>bold</b>');
    });

    it('should convert *italic* to <i>italic</i>', () => {
      expect(markdownToTelegramHtml('*italic*')).toBe('<i>italic</i>');
    });

    it('should convert _italic_ to <i>italic</i>', () => {
      expect(markdownToTelegramHtml('_italic_')).toBe('<i>italic</i>');
    });

    it('should convert ~~strike~~ to <s>strike</s>', () => {
      expect(markdownToTelegramHtml('~~strike~~')).toBe('<s>strike</s>');
    });

    it('should convert ||spoiler|| to <tg-spoiler>spoiler</tg-spoiler>', () => {
      expect(markdownToTelegramHtml('||spoiler||')).toBe(
        '<tg-spoiler>spoiler</tg-spoiler>'
      );
    });

    it('should convert `inline code` to <code>inline code</code>', () => {
      expect(markdownToTelegramHtml('`inline`')).toBe('<code>inline</code>');
    });

    it('should convert code blocks to <pre><code>...</code></pre>', () => {
      const input = '```js\nconsole.log("hi");\n```';
      const output = markdownToTelegramHtml(input);
      expect(output).toContain('<pre><code>');
      expect(output).toContain('console.log');
      expect(output).toContain('</code></pre>');
    });

    it('should convert [text](url) to <a href="url">text</a>', () => {
      expect(markdownToTelegramHtml('[click](https://example.com)')).toBe(
        '<a href="https://example.com">click</a>'
      );
    });

    it('should escape HTML entities in normal text but not inside code', () => {
      const input = 'a < b & c > d';
      const output = markdownToTelegramHtml(input);
      expect(output).toContain('&lt;');
      expect(output).toContain('&amp;');
      expect(output).toContain('&gt;');
    });

    it('should preserve content inside code blocks without double-escaping', () => {
      const input = '```\na < b & c\n```';
      const output = markdownToTelegramHtml(input);
      // Inside <pre><code>, entities should be escaped once.
      expect(output).toContain('a &lt; b &amp; c');
      // No double-escaping.
      expect(output).not.toContain('&amp;lt;');
    });
  });

  // =========================================================================
  // Event Unsubscribe
  // =========================================================================

  describe('event unsubscribe', () => {
    it('should stop receiving events after calling unsubscribe', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);

      const messageHandler = vi.fn();
      const unsub = adapter.on('message', messageHandler);

      const msg = {
        message_id: 1,
        chat: { id: 42, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'Alice' },
        date: 1700000000,
        text: 'first',
      };

      triggerEvent(handlers, 'message', { message: msg });
      expect(messageHandler).toHaveBeenCalledTimes(1);

      unsub();

      triggerEvent(handlers, 'message', {
        message: { ...msg, message_id: 2, text: 'second' },
      });
      expect(messageHandler).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Callback Query Cleanup
  // =========================================================================

  describe('callback query dedup cleanup', () => {
    it('should clean up stale entries after 2 minutes via the interval', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      const cbHandler = vi.fn().mockReturnValue(true);
      adapter.onCallbackQuery(cbHandler);

      // Deliver a callback query.
      const ctx = {
        callbackQuery: {
          id: 'cq-cleanup-test',
          data: 'action',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
          },
        },
      };

      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);
      expect(cbHandler).toHaveBeenCalledTimes(1);

      // Advance past the cleanup interval (60s) + dedup TTL (120s).
      await vi.advanceTimersByTimeAsync(180_000);

      // Deliver the same query ID again -- it should now be accepted
      // because the dedup entry was cleaned up.
      await triggerEvent(handlers, 'callback_query', ctx);
      await vi.advanceTimersByTimeAsync(10);
      expect(cbHandler).toHaveBeenCalledTimes(2);
    });

    it('should clear dedup map on disconnect', async () => {
      const handlers = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      const cbHandler = vi.fn().mockReturnValue(true);
      adapter.onCallbackQuery(cbHandler);

      await triggerEvent(handlers, 'callback_query', {
        callbackQuery: {
          id: 'cq-disc',
          data: 'x',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
          },
        },
      });
      await vi.advanceTimersByTimeAsync(10);

      await adapter.disconnect();

      // After disconnect + reconnect, same query ID should be accepted.
      vi.clearAllMocks();
      const handlers2 = captureEventHandlers();
      await connectAdapter(adapter);
      mockCallApi.mockResolvedValue(true);

      const cbHandler2 = vi.fn().mockReturnValue(true);
      adapter.onCallbackQuery(cbHandler2);

      await triggerEvent(handlers2, 'callback_query', {
        callbackQuery: {
          id: 'cq-disc',
          data: 'x',
          from: { id: 42, is_bot: false, first_name: 'A' },
          message: {
            message_id: 10,
            chat: { id: 100, type: 'private' },
            date: Math.floor(Date.now() / 1000),
          },
        },
      });
      await vi.advanceTimersByTimeAsync(10);

      expect(cbHandler2).toHaveBeenCalledTimes(1);
    });
  });
});
