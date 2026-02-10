/**
 * Tests for the Anthropic Streaming Adapter (src/streaming/anthropic-stream.ts).
 *
 * Covers:
 *  - createAnthropicStream async generator (full lifecycle)
 *  - convertMessages (system, user, assistant, tool, assistant+toolCalls)
 *  - convertTools (empty, undefined, valid definitions)
 *  - convertStopReason mapping (end_turn, max_tokens, tool_use, stop_sequence, null)
 *  - Stream event conversion for every Anthropic SSE event type:
 *      message_start   -> stream_start + usage
 *      content_block_start (text, thinking, tool_use)
 *      content_block_delta (text_delta, thinking_delta, input_json_delta)
 *      content_block_stop  -> tool_use_end for tool blocks + content_block_stop
 *      message_delta   -> usage
 *      message_stop    -> (no-op; handled by finalMessage)
 *  - Abort / cancellation handling
 *  - Error recovery (rate_limit, overloaded, abort, generic)
 *  - Token usage tracking across the stream lifecycle
 *  - Extended thinking mode parameter wiring
 */

import { describe, it, expect, vi } from 'vitest';

import { createAnthropicStream } from '../../../streaming/anthropic-stream';

import type { StreamEvent } from '../../../streaming/block-parser';
import type { ChatParams, ToolDefinition } from '../../../types/llm';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Collect all events from the async generator into an array.
 */
async function collectEvents(
  gen: AsyncGenerator<StreamEvent>,
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

/**
 * Build a minimal ChatParams object for tests.
 */
function makeChatParams(overrides?: Partial<ChatParams>): ChatParams {
  return {
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

/**
 * An async iterable that yields pre-defined Anthropic MessageStreamEvent objects
 * one at a time, simulating the SDK's MessageStream.
 */
function createMockMessageStream(
  events: unknown[],
  options?: {
    finalMessage?: unknown;
    finalMessageError?: Error;
  },
) {
  // resolved tracking removed (was unused)
  const finalMsg = options?.finalMessage ?? {
    id: 'msg_final',
    type: 'message',
    role: 'assistant',
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  const stream = {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < events.length) {
            return { value: events[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
    async finalMessage() {
      resolved = true;
      if (options?.finalMessageError) {
        throw options.finalMessageError;
      }
      return finalMsg;
    },
  };

  return stream;
}

/**
 * Build a mock Anthropic SDK client whose messages.stream() returns
 * the given mock stream.
 */
function createMockClient(mockStream: ReturnType<typeof createMockMessageStream>) {
  return {
    messages: {
      stream: vi.fn().mockReturnValue(mockStream),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Anthropic SSE event factories
// ---------------------------------------------------------------------------

function messageStartEvent(
  msgId = 'msg_123',
  inputTokens = 100,
  outputTokens = 0,
) {
  return {
    type: 'message_start',
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      content: [],
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    },
  };
}

function contentBlockStartText(index = 0) {
  return {
    type: 'content_block_start',
    index,
    content_block: { type: 'text', text: '' },
  };
}

function contentBlockStartThinking(index = 0) {
  return {
    type: 'content_block_start',
    index,
    content_block: { type: 'thinking', thinking: '' },
  };
}

function contentBlockStartToolUse(
  index = 0,
  toolId = 'toolu_01',
  toolName = 'get_weather',
) {
  return {
    type: 'content_block_start',
    index,
    content_block: {
      type: 'tool_use',
      id: toolId,
      name: toolName,
      input: {},
    },
  };
}

function textDeltaEvent(index: number, text: string) {
  return {
    type: 'content_block_delta',
    index,
    delta: { type: 'text_delta', text },
  };
}

function thinkingDeltaEvent(index: number, thinking: string) {
  return {
    type: 'content_block_delta',
    index,
    delta: { type: 'thinking_delta', thinking },
  };
}

function inputJsonDeltaEvent(index: number, partialJson: string) {
  return {
    type: 'content_block_delta',
    index,
    delta: { type: 'input_json_delta', partial_json: partialJson },
  };
}

function contentBlockStopEvent(index: number) {
  return {
    type: 'content_block_stop',
    index,
  };
}

function messageDeltaEvent(outputTokens: number, stopReason = 'end_turn') {
  return {
    type: 'message_delta',
    delta: { stop_reason: stopReason },
    usage: { output_tokens: outputTokens },
  };
}

function messageStopEvent() {
  return { type: 'message_stop' };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AnthropicStreamAdapter', () => {
  // =========================================================================
  // convertMessages (exercised indirectly via createAnthropicStream)
  // =========================================================================

  describe('convertMessages', () => {
    it('should extract system messages and exclude them from message array', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.system).toBe('You are helpful.');
      // The messages array should contain only the user message
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Hi' },
      ]);
    });

    it('should join multiple system messages with newlines', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'system', content: 'First system.' },
          { role: 'system', content: 'Second system.' },
          { role: 'user', content: 'Go' },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.system).toBe('First system.\nSecond system.');
    });

    it('should not set system when there are no system messages', async () => {
      const params = makeChatParams({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.system).toBeUndefined();
    });

    it('should convert tool-role messages to user role with tool_result content', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'user', content: 'Use the tool' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              { id: 'tc_1', name: 'my_tool', arguments: '{"x":1}' },
            ],
          },
          { role: 'tool', content: 'Tool output here', toolCallId: 'tc_1' },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      const toolResultMsg = callArgs.messages[2];
      expect(toolResultMsg.role).toBe('user');
      expect(toolResultMsg.content).toEqual([
        {
          type: 'tool_result',
          tool_use_id: 'tc_1',
          content: 'Tool output here',
        },
      ]);
    });

    it('should convert assistant messages with toolCalls to content array', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'user', content: 'Do stuff' },
          {
            role: 'assistant',
            content: 'Thinking about it...',
            toolCalls: [
              { id: 'tc_a', name: 'search', arguments: '{"q":"vitest"}' },
            ],
          },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      const assistantMsg = callArgs.messages[1];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toEqual([
        { type: 'text', text: 'Thinking about it...' },
        { type: 'tool_use', id: 'tc_a', name: 'search', input: { q: 'vitest' } },
      ]);
    });

    it('should convert assistant messages with toolCalls but no text content', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'user', content: 'Do stuff' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              { id: 'tc_b', name: 'run', arguments: '{}' },
            ],
          },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      const assistantMsg = callArgs.messages[1];
      // Empty string is falsy, so no text block should be present
      expect(assistantMsg.content).toEqual([
        { type: 'tool_use', id: 'tc_b', name: 'run', input: {} },
      ]);
    });

    it('should convert plain assistant messages as simple content strings', async () => {
      const params = makeChatParams({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello there!' },
        ],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.messages[1]).toEqual({
        role: 'assistant',
        content: 'Hello there!',
      });
    });
  });

  // =========================================================================
  // convertTools
  // =========================================================================

  describe('convertTools', () => {
    it('should not include tools when undefined', async () => {
      const params = makeChatParams({ tools: undefined });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.tools).toBeUndefined();
    });

    it('should not include tools when empty array', async () => {
      const params = makeChatParams({ tools: [] });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.tools).toBeUndefined();
    });

    it('should convert tool definitions to Anthropic format', async () => {
      const tools: ToolDefinition[] = [
        {
          name: 'get_weather',
          description: 'Get current weather',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
      ];
      const params = makeChatParams({ tools });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.tools).toEqual([
        {
          name: 'get_weather',
          description: 'Get current weather',
          input_schema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
      ]);
    });
  });

  // =========================================================================
  // convertStopReason (exercised via stream_end events)
  // =========================================================================

  describe('convertStopReason', () => {
    it.each([
      ['end_turn', 'stop'],
      ['max_tokens', 'length'],
      ['tool_use', 'tool_calls'],
      ['stop_sequence', 'stop'],
      [null, 'stop'],
      ['unknown_value', 'stop'],
    ] as const)(
      'should map Anthropic stop_reason "%s" to FinishReason "%s"',
      async (anthropicReason, expectedReason) => {
        const mockStream = createMockMessageStream(
          [messageStartEvent(), messageStopEvent()],
          {
            finalMessage: {
              id: 'msg_final',
              type: 'message',
              role: 'assistant',
              content: [],
              stop_reason: anthropicReason,
              usage: { input_tokens: 5, output_tokens: 10 },
            },
          },
        );
        const client = createMockClient(mockStream);
        const params = makeChatParams();

        const events = await collectEvents(
          createAnthropicStream({ client, params }),
        );

        const streamEnd = events.find((e) => e.type === 'stream_end');
        expect(streamEnd).toBeDefined();
        expect((streamEnd as any).finishReason).toBe(expectedReason);
      },
    );
  });

  // =========================================================================
  // Request parameter wiring
  // =========================================================================

  describe('request parameter wiring', () => {
    it('should pass model, maxTokens, temperature, topP, and stop sequences', async () => {
      const params = makeChatParams({
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
        stop: ['STOP', 'END'],
        messages: [{ role: 'user', content: 'test' }],
      });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(2048);
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.top_p).toBe(0.9);
      expect(callArgs.stop_sequences).toEqual(['STOP', 'END']);
    });

    it('should default max_tokens to 4096 when not specified', async () => {
      const params = makeChatParams({ maxTokens: undefined });

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(createAnthropicStream({ client, params }));

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.max_tokens).toBe(4096);
    });

    it('should pass AbortController signal to stream options', async () => {
      const abortController = new AbortController();
      const params = makeChatParams();

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(
        createAnthropicStream({ client, params, abortController }),
      );

      const callOptions = client.messages.stream.mock.calls[0][1];
      expect(callOptions.signal).toBe(abortController.signal);
    });

    it('should enable extended thinking with default budget when enableThinking is true', async () => {
      const params = makeChatParams();

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(
        createAnthropicStream({ client, params, enableThinking: true }),
      );

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 10000,
      });
    });

    it('should use custom thinking budget tokens when provided', async () => {
      const params = makeChatParams();

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(
        createAnthropicStream({
          client,
          params,
          enableThinking: true,
          thinkingBudgetTokens: 50000,
        }),
      );

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 50000,
      });
    });

    it('should not set thinking when enableThinking is false', async () => {
      const params = makeChatParams();

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      await collectEvents(
        createAnthropicStream({ client, params, enableThinking: false }),
      );

      const callArgs = client.messages.stream.mock.calls[0][0];
      expect(callArgs.thinking).toBeUndefined();
    });
  });

  // =========================================================================
  // Stream event conversion: message_start
  // =========================================================================

  describe('message_start event', () => {
    it('should yield stream_start with messageId', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent('msg_abc'),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const startEvents = events.filter((e) => e.type === 'stream_start');
      expect(startEvents).toHaveLength(1);
      expect((startEvents[0] as any).messageId).toBe('msg_abc');
    });

    it('should yield usage event from message_start usage data', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent('msg_1', 150, 0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const usageEvents = events.filter((e) => e.type === 'usage');
      expect(usageEvents.length).toBeGreaterThanOrEqual(1);
      const firstUsage = usageEvents[0] as any;
      expect(firstUsage.inputTokens).toBe(150);
      expect(firstUsage.outputTokens).toBe(0);
    });
  });

  // =========================================================================
  // Stream event conversion: content_block_start
  // =========================================================================

  describe('content_block_start event', () => {
    it('should emit tool_use_start for tool_use blocks', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartToolUse(0, 'toolu_42', 'search_docs'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const toolStarts = events.filter((e) => e.type === 'tool_use_start');
      expect(toolStarts).toHaveLength(1);
      expect(toolStarts[0]).toMatchObject({
        type: 'tool_use_start',
        toolName: 'search_docs',
        toolId: 'toolu_42',
        blockIndex: 0,
      });
    });

    it('should track text blocks without emitting a start event', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartText(0),
        textDeltaEvent(0, 'hello'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // No explicit "text_block_start" event -- only text_delta
      const textDeltas = events.filter((e) => e.type === 'text_delta');
      expect(textDeltas.length).toBeGreaterThanOrEqual(1);
    });

    it('should track thinking blocks without emitting a start event', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartThinking(0),
        thinkingDeltaEvent(0, 'reasoning...'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const thinkingDeltas = events.filter((e) => e.type === 'thinking_delta');
      expect(thinkingDeltas.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Stream event conversion: content_block_delta
  // =========================================================================

  describe('content_block_delta events', () => {
    it('should yield text_delta for text_delta type', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartText(0),
        textDeltaEvent(0, 'Hello, '),
        textDeltaEvent(0, 'world!'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const textDeltas = events.filter((e) => e.type === 'text_delta');
      expect(textDeltas).toHaveLength(2);
      expect((textDeltas[0] as any).text).toBe('Hello, ');
      expect((textDeltas[1] as any).text).toBe('world!');
      expect((textDeltas[0] as any).blockIndex).toBe(0);
    });

    it('should yield thinking_delta for thinking_delta type', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartThinking(0),
        thinkingDeltaEvent(0, 'Let me think...'),
        thinkingDeltaEvent(0, 'Got it!'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const thinkingDeltas = events.filter((e) => e.type === 'thinking_delta');
      expect(thinkingDeltas).toHaveLength(2);
      expect((thinkingDeltas[0] as any).text).toBe('Let me think...');
      expect((thinkingDeltas[1] as any).text).toBe('Got it!');
      expect((thinkingDeltas[0] as any).blockIndex).toBe(0);
    });

    it('should yield tool_use_delta and accumulate arguments for input_json_delta', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartToolUse(0, 'toolu_01', 'get_weather'),
        inputJsonDeltaEvent(0, '{"ci'),
        inputJsonDeltaEvent(0, 'ty":"NY"}'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const toolDeltas = events.filter((e) => e.type === 'tool_use_delta');
      expect(toolDeltas).toHaveLength(2);
      expect((toolDeltas[0] as any).partialJson).toBe('{"ci');
      expect((toolDeltas[0] as any).toolId).toBe('toolu_01');
      expect((toolDeltas[1] as any).partialJson).toBe('ty":"NY"}');

      // The tool_use_end event should contain the full accumulated arguments
      const toolEnds = events.filter((e) => e.type === 'tool_use_end');
      expect(toolEnds).toHaveLength(1);
      expect((toolEnds[0] as any).arguments).toBe('{"city":"NY"}');
    });

    it('should ignore input_json_delta when no active tool block exists', async () => {
      // Simulate a pathological scenario: delta arrives for a block index
      // that has no matching content_block_start.
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartText(0),
        // Fabricate an input_json_delta on index 0 (which is a text block)
        inputJsonDeltaEvent(0, '{"bogus":true}'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // Since block at index 0 is text, input_json_delta should be silently ignored
      const toolDeltas = events.filter((e) => e.type === 'tool_use_delta');
      expect(toolDeltas).toHaveLength(0);
    });
  });

  // =========================================================================
  // Stream event conversion: content_block_stop
  // =========================================================================

  describe('content_block_stop event', () => {
    it('should emit tool_use_end + content_block_stop for tool_use blocks', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartToolUse(0, 'toolu_99', 'calculator'),
        inputJsonDeltaEvent(0, '{"expr":"2+2"}'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const toolEnd = events.find((e) => e.type === 'tool_use_end') as any;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.toolId).toBe('toolu_99');
      expect(toolEnd.toolName).toBe('calculator');
      expect(toolEnd.arguments).toBe('{"expr":"2+2"}');
      expect(toolEnd.blockIndex).toBe(0);

      const blockStop = events.find(
        (e) => e.type === 'content_block_stop' && (e as any).blockIndex === 0,
      ) as any;
      expect(blockStop).toBeDefined();
      expect(blockStop.blockType).toBe('tool_use');
    });

    it('should emit empty arguments "{}" when no JSON deltas were received', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartToolUse(0, 'toolu_empty', 'no_args_tool'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const toolEnd = events.find((e) => e.type === 'tool_use_end') as any;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.arguments).toBe('{}');
    });

    it('should emit content_block_stop with blockType "text" for text blocks', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartText(0),
        textDeltaEvent(0, 'Some text'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const blockStop = events.find(
        (e) => e.type === 'content_block_stop',
      ) as any;
      expect(blockStop).toBeDefined();
      expect(blockStop.blockType).toBe('text');
      expect(blockStop.blockIndex).toBe(0);
    });

    it('should emit content_block_stop with blockType "thinking" for thinking blocks', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStartThinking(0),
        thinkingDeltaEvent(0, 'Deep thoughts'),
        contentBlockStopEvent(0),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const blockStop = events.find(
        (e) => e.type === 'content_block_stop',
      ) as any;
      expect(blockStop).toBeDefined();
      expect(blockStop.blockType).toBe('thinking');
    });

    it('should not emit anything for content_block_stop with no tracked block', async () => {
      // content_block_stop for an index that was never started
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        contentBlockStopEvent(99),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const blockStops = events.filter(
        (e) => e.type === 'content_block_stop',
      );
      expect(blockStops).toHaveLength(0);
    });
  });

  // =========================================================================
  // Stream event conversion: message_delta
  // =========================================================================

  describe('message_delta event', () => {
    it('should yield usage event with output tokens', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent('msg_1', 50, 0),
        contentBlockStartText(0),
        textDeltaEvent(0, 'result'),
        contentBlockStopEvent(0),
        messageDeltaEvent(75, 'end_turn'),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // Filter usage events -- there should be one from message_start and one from message_delta
      const usageEvents = events.filter((e) => e.type === 'usage');
      expect(usageEvents.length).toBeGreaterThanOrEqual(2);

      const deltaUsage = usageEvents[usageEvents.length - 1] as any;
      expect(deltaUsage.outputTokens).toBe(75);
      // message_delta does not provide input tokens
      expect(deltaUsage.inputTokens).toBe(0);
    });
  });

  // =========================================================================
  // Stream event conversion: message_stop
  // =========================================================================

  describe('message_stop event', () => {
    it('should not produce events directly (handled by finalMessage)', async () => {
      // message_stop should be a no-op in convertStreamEvent;
      // stream_end is produced from finalMessage() instead.
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // There should be a stream_end from finalMessage handling, not from message_stop
      const streamEnds = events.filter((e) => e.type === 'stream_end');
      expect(streamEnds).toHaveLength(1);
    });
  });

  // =========================================================================
  // Full stream lifecycle
  // =========================================================================

  describe('full stream lifecycle', () => {
    it('should yield correct event sequence for a simple text response', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent('msg_lifecycle', 100, 0),
        contentBlockStartText(0),
        textDeltaEvent(0, 'Hello '),
        textDeltaEvent(0, 'world'),
        contentBlockStopEvent(0),
        messageDeltaEvent(25, 'end_turn'),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const types = events.map((e) => e.type);
      expect(types).toContain('stream_start');
      expect(types).toContain('usage');
      expect(types).toContain('text_delta');
      expect(types).toContain('content_block_stop');
      expect(types).toContain('stream_end');

      // stream_start should be first functional event
      expect(types[0]).toBe('stream_start');
      // stream_end should be last
      expect(types[types.length - 1]).toBe('stream_end');
    });

    it('should handle multiple content blocks (thinking + text)', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent('msg_multi', 80, 0),
        contentBlockStartThinking(0),
        thinkingDeltaEvent(0, 'Analyzing...'),
        contentBlockStopEvent(0),
        contentBlockStartText(1),
        textDeltaEvent(1, 'Here is the answer.'),
        contentBlockStopEvent(1),
        messageDeltaEvent(50, 'end_turn'),
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const thinkingDeltas = events.filter((e) => e.type === 'thinking_delta');
      const textDeltas = events.filter((e) => e.type === 'text_delta');
      const blockStops = events.filter((e) => e.type === 'content_block_stop');

      expect(thinkingDeltas).toHaveLength(1);
      expect(textDeltas).toHaveLength(1);
      expect(blockStops).toHaveLength(2);
      expect((blockStops[0] as any).blockType).toBe('thinking');
      expect((blockStops[1] as any).blockType).toBe('text');
    });

    it('should handle mixed text + tool_use blocks', async () => {
      const mockStream = createMockMessageStream(
        [
          messageStartEvent('msg_mixed'),
          contentBlockStartText(0),
          textDeltaEvent(0, 'Let me check...'),
          contentBlockStopEvent(0),
          contentBlockStartToolUse(1, 'toolu_abc', 'web_search'),
          inputJsonDeltaEvent(1, '{"query":"vitest"}'),
          contentBlockStopEvent(1),
          messageDeltaEvent(40, 'tool_use'),
          messageStopEvent(),
        ],
        {
          finalMessage: {
            id: 'msg_mixed',
            type: 'message',
            role: 'assistant',
            content: [],
            stop_reason: 'tool_use',
            usage: { input_tokens: 60, output_tokens: 40 },
          },
        },
      );
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      expect(events.filter((e) => e.type === 'text_delta')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'tool_use_start')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'tool_use_delta')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'tool_use_end')).toHaveLength(1);

      const streamEnd = events.find((e) => e.type === 'stream_end') as any;
      expect(streamEnd.finishReason).toBe('tool_calls');
    });
  });

  // =========================================================================
  // Token usage tracking
  // =========================================================================

  describe('token usage tracking', () => {
    it('should reflect finalMessage usage in stream_end', async () => {
      const mockStream = createMockMessageStream(
        [
          messageStartEvent('msg_usage', 200, 0),
          contentBlockStartText(0),
          textDeltaEvent(0, 'response'),
          contentBlockStopEvent(0),
          messageStopEvent(),
        ],
        {
          finalMessage: {
            id: 'msg_usage',
            type: 'message',
            role: 'assistant',
            content: [],
            stop_reason: 'end_turn',
            usage: { input_tokens: 200, output_tokens: 85 },
          },
        },
      );
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const streamEnd = events.find((e) => e.type === 'stream_end') as any;
      expect(streamEnd).toBeDefined();
      expect(streamEnd.usage).toEqual({
        promptTokens: 200,
        completionTokens: 85,
        totalTokens: 285,
      });
    });

    it('should use accumulated usage when finalMessage() fails', async () => {
      const mockStream = createMockMessageStream(
        [
          messageStartEvent('msg_fail', 100, 0),
          messageDeltaEvent(30),
          messageStopEvent(),
        ],
        {
          finalMessageError: new Error('Stream was aborted'),
        },
      );
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const streamEnd = events.find((e) => e.type === 'stream_end') as any;
      expect(streamEnd).toBeDefined();
      // The last usage event was from message_delta (inputTokens=0, outputTokens=30)
      // So finalUsage should reflect that
      expect(streamEnd.usage.completionTokens).toBe(30);
      expect(streamEnd.finishReason).toBe('stop');
    });
  });

  // =========================================================================
  // Abort / cancellation handling
  // =========================================================================

  describe('abort and cancellation', () => {
    it('should yield error and break when AbortController is signaled mid-stream', async () => {
      const abortController = new AbortController();

      // Create a stream that yields one event, then stalls so we can abort
      const events_raw = [
        messageStartEvent('msg_abort'),
      ];

      let eventIndex = 0;
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (eventIndex < events_raw.length) {
                const val = events_raw[eventIndex++];
                // After yielding first event, abort and then yield another
                abortController.abort();
                return { value: val, done: false };
              }
              // Yield a second event after abort
              return { value: { type: 'message_stop' }, done: false };
            },
          };
        },
        async finalMessage() {
          throw new Error('aborted');
        },
      };

      const client = createMockClient(mockStream as any);

      const collected: StreamEvent[] = [];
      for await (const event of createAnthropicStream({
        client,
        params: makeChatParams(),
        abortController,
      })) {
        collected.push(event);
        // Safety: break after collecting enough events to avoid infinite loop
        if (collected.length > 20) {
break;
}
      }

      const errorEvents = collected.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect((errorEvents[0] as any).error.message).toContain('aborted');
    });

    it('should handle AbortError during stream iteration', async () => {
      const abortController = new AbortController();

      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<{ value: any; done: boolean }> {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('aborted');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams(), abortController }),
      );

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0] as any).recoverable).toBe(false);

      // Abort errors should NOT emit stream_end
      const streamEnds = events.filter((e) => e.type === 'stream_end');
      expect(streamEnds).toHaveLength(0);
    });
  });

  // =========================================================================
  // Error recovery: rate limits, overloaded, generic
  // =========================================================================

  describe('error recovery', () => {
    it('should mark rate_limit errors as recoverable with retryAfter', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('rate_limit exceeded');
              err.status = 429;
              err.headers = { 'retry-after': '3' };
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.recoverable).toBe(true);
      expect(errorEvent.retryAfter).toBe(3000); // 3 seconds * 1000

      // Rate limit errors also emit stream_end with 'error' finishReason
      const streamEnd = events.find((e) => e.type === 'stream_end') as any;
      expect(streamEnd).toBeDefined();
      expect(streamEnd.finishReason).toBe('error');
    });

    it('should detect rate_limit from error type field', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('Too many requests');
              err.error = { type: 'rate_limit_error' };
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent.recoverable).toBe(true);
    });

    it('should detect rate_limit from message containing "429"', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw new Error('HTTP 429 Too Many Requests');
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent.recoverable).toBe(true);
    });

    it('should mark overloaded errors (529) as recoverable with min 10s retryAfter', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('API overloaded');
              err.status = 529;
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.recoverable).toBe(true);
      expect(errorEvent.retryAfter).toBeGreaterThanOrEqual(10000);
    });

    it('should detect overloaded from message containing "overloaded"', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw new Error('The API is currently overloaded');
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent.recoverable).toBe(true);
      expect(errorEvent.retryAfter).toBeGreaterThanOrEqual(10000);
    });

    it('should use retry-after header for overloaded errors when > 10s', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('overloaded');
              err.status = 529;
              err.headers = { 'retry-after': '30' };
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      // 30 seconds * 1000 = 30000, which is greater than 10000 minimum
      expect(errorEvent.retryAfter).toBe(30000);
    });

    it('should mark generic errors as non-recoverable', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw new Error('Something unexpected happened');
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.recoverable).toBe(false);
      expect(errorEvent.retryAfter).toBeUndefined();

      // Non-abort errors emit stream_end
      const streamEnd = events.find((e) => e.type === 'stream_end') as any;
      expect(streamEnd).toBeDefined();
      expect(streamEnd.finishReason).toBe('error');
    });

    it('should convert non-Error throws to Error objects', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw 'string error'; // eslint-disable-line no-throw-literal
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toBeInstanceOf(Error);
      expect(errorEvent.error.message).toBe('string error');
    });

    it('should not mark rate_limit+abort combination as recoverable', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('rate_limit but also aborted');
              err.status = 429;
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({
          client,
          params: makeChatParams(),
          abortController,
        }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      // When abort is also signaled, recoverable should be false
      expect(errorEvent.recoverable).toBe(false);
    });

    it('should use default retryAfter of 5000 when no retry-after header', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('rate_limit');
              err.status = 429;
              // No headers
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent.recoverable).toBe(true);
      expect(errorEvent.retryAfter).toBe(5000);
    });

    it('should use default retryAfter when retry-after header is non-numeric', async () => {
      const mockStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const err: any = new Error('rate_limit');
              err.status = 429;
              err.headers = { 'retry-after': 'not-a-number' };
              throw err;
            },
          };
        },
        async finalMessage() {
          throw new Error('no final');
        },
      };

      const client = createMockClient(mockStream as any);
      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent.retryAfter).toBe(5000);
    });
  });

  // =========================================================================
  // SDK client.messages.stream() initial failure
  // =========================================================================

  describe('initial stream creation failure', () => {
    it('should yield error event when client.messages.stream() throws', async () => {
      const client = {
        messages: {
          stream: vi.fn().mockImplementation(() => {
            throw new Error('Invalid API key');
          }),
        },
      } as any;

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect((events[0] as any).error.message).toBe('Invalid API key');
      expect((events[0] as any).recoverable).toBe(false);
    });

    it('should wrap non-Error throws from stream creation', async () => {
      const client = {
        messages: {
          stream: vi.fn().mockImplementation(() => {
            throw 42; // eslint-disable-line no-throw-literal
          }),
        },
      } as any;

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      expect(events).toHaveLength(1);
      expect((events[0] as any).error).toBeInstanceOf(Error);
      expect((events[0] as any).error.message).toBe('42');
    });
  });

  // =========================================================================
  // Unknown / unrecognized event types
  // =========================================================================

  describe('unknown event types', () => {
    it('should silently ignore unrecognized Anthropic event types', async () => {
      const mockStream = createMockMessageStream([
        messageStartEvent(),
        { type: 'ping' }, // Unknown event type
        { type: 'some_future_event', data: {} },
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // Should have stream_start, usage, and stream_end -- no errors
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(0);

      const streamStart = events.find((e) => e.type === 'stream_start');
      expect(streamStart).toBeDefined();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty stream (no events)', async () => {
      const mockStream = createMockMessageStream([]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // Should still emit stream_end from finalMessage
      const streamEnd = events.find((e) => e.type === 'stream_end');
      expect(streamEnd).toBeDefined();
    });

    it('should handle multiple tool blocks in sequence', async () => {
      const mockStream = createMockMessageStream(
        [
          messageStartEvent(),
          contentBlockStartToolUse(0, 'toolu_1', 'tool_a'),
          inputJsonDeltaEvent(0, '{"a":1}'),
          contentBlockStopEvent(0),
          contentBlockStartToolUse(1, 'toolu_2', 'tool_b'),
          inputJsonDeltaEvent(1, '{"b":2}'),
          contentBlockStopEvent(1),
          messageDeltaEvent(50, 'tool_use'),
          messageStopEvent(),
        ],
        {
          finalMessage: {
            id: 'msg_multi_tool',
            type: 'message',
            role: 'assistant',
            content: [],
            stop_reason: 'tool_use',
            usage: { input_tokens: 30, output_tokens: 50 },
          },
        },
      );
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      const toolStarts = events.filter((e) => e.type === 'tool_use_start');
      const toolEnds = events.filter((e) => e.type === 'tool_use_end');

      expect(toolStarts).toHaveLength(2);
      expect(toolEnds).toHaveLength(2);
      expect((toolEnds[0] as any).toolId).toBe('toolu_1');
      expect((toolEnds[0] as any).arguments).toBe('{"a":1}');
      expect((toolEnds[1] as any).toolId).toBe('toolu_2');
      expect((toolEnds[1] as any).arguments).toBe('{"b":2}');
    });

    it('should handle message_delta without usage field', async () => {
      const eventWithoutUsage = {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        // No `usage` property
      };

      const mockStream = createMockMessageStream([
        messageStartEvent(),
        eventWithoutUsage,
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // Should not crash -- the delta usage event is simply not emitted
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(0);
    });

    it('should handle message_start without usage field', async () => {
      const noUsageStart = {
        type: 'message_start',
        message: {
          id: 'msg_no_usage',
          type: 'message',
          role: 'assistant',
          content: [],
          // No `usage` property
        },
      };

      const mockStream = createMockMessageStream([
        noUsageStart,
        messageStopEvent(),
      ]);
      const client = createMockClient(mockStream);

      const events = await collectEvents(
        createAnthropicStream({ client, params: makeChatParams() }),
      );

      // stream_start should still be emitted
      const streamStart = events.find((e) => e.type === 'stream_start');
      expect(streamStart).toBeDefined();
      expect((streamStart as any).messageId).toBe('msg_no_usage');

      // No usage event from message_start
      // (usage comes from message_start only if msg.usage is truthy)
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(0);
    });
  });
});
