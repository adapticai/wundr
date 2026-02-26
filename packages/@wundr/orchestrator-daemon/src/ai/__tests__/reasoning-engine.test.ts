/**
 * ReasoningEngine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ReasoningEngine, createReasoningEngine } from '../reasoning-engine';
import { DefaultToolRegistry } from '../tool-registry';

import type { LLMClient, ChatParams, ChatResponse, ChatChunk } from '../../types/llm';
import type { ReasoningConfig } from '../reasoning-engine';
import type { ToolDescription } from '../tool-registry';

// =============================================================================
// Mock LLMClient factory
// =============================================================================

function createMockLLMClient(
  overrides?: Partial<LLMClient>,
): LLMClient & { chat: ReturnType<typeof vi.fn> } {
  const chat = vi.fn<[ChatParams], Promise<ChatResponse>>();
  return {
    provider: 'mock',
    chat,
    chatStream: overrides?.chatStream ??
      (async function* (): AsyncIterableIterator<ChatChunk> {
        /* noop */
      }),
    countTokens: overrides?.countTokens ?? vi.fn(async () => 10),
    ...overrides,
  } as LLMClient & { chat: ReturnType<typeof vi.fn> };
}

/**
 * Builds a standard ChatResponse for use in mock return values.
 */
function makeChatResponse(
  content: string,
  opts?: {
    toolCalls?: ChatResponse['toolCalls'];
    finishReason?: ChatResponse['finishReason'];
    totalTokens?: number;
  },
): ChatResponse {
  return {
    id: 'resp-1',
    content,
    toolCalls: opts?.toolCalls,
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: opts?.totalTokens ?? 30,
    },
    finishReason: opts?.finishReason ?? 'stop',
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ReasoningEngine', () => {
  let client: ReturnType<typeof createMockLLMClient>;
  let engine: ReasoningEngine;

  beforeEach(() => {
    client = createMockLLMClient();
    engine = new ReasoningEngine(client, {
      model: 'test-model',
      temperature: 0,
      maxReasoningSteps: 5,
    });
  });

  // ---------------------------------------------------------------------------
  // reason()
  // ---------------------------------------------------------------------------

  describe('reason', () => {
    it('should return a decision from a single-step response', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse('The answer is 42.'),
      );

      const result = await engine.reason('What is the meaning of life?');

      expect(result.decision).toBe('The answer is 42.');
      expect(result.steps.length).toBeGreaterThanOrEqual(2); // thought + decision
      expect(result.totalTokensUsed).toBe(30);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include context in the user message when provided', async () => {
      client.chat.mockResolvedValueOnce(makeChatResponse('Done'));

      await engine.reason('Analyse risk', { portfolio: 'balanced' });

      const messages = client.chat.mock.calls[0][0].messages;
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('"portfolio"');
      expect(userMessage?.content).toContain('balanced');
    });

    it('should execute tool calls and feed observations back to the LLM', async () => {
      const toolRegistry = new DefaultToolRegistry();
      const desc: ToolDescription = {
        name: 'get_price',
        description: 'Get a stock price',
        inputSchema: {
          type: 'object',
          properties: { ticker: { type: 'string' } },
          required: ['ticker'],
        },
      };
      toolRegistry.register(
        'get_price',
        vi.fn(async (args) => ({ price: 150.5, ticker: args.ticker })),
        desc,
      );

      const engineWithTools = new ReasoningEngine(client, {
        model: 'test-model',
        maxReasoningSteps: 5,
        toolRegistry,
      });

      // First call: LLM wants to call the tool
      client.chat.mockResolvedValueOnce(
        makeChatResponse('I need the price of AAPL.', {
          toolCalls: [
            { id: 'tc-1', name: 'get_price', arguments: '{"ticker":"AAPL"}' },
          ],
          finishReason: 'tool_calls',
        }),
      );

      // Second call: LLM receives tool result and provides final answer
      client.chat.mockResolvedValueOnce(
        makeChatResponse('AAPL is trading at $150.50.'),
      );

      const result = await engineWithTools.reason('What is the price of AAPL?');

      expect(result.decision).toBe('AAPL is trading at $150.50.');
      expect(client.chat).toHaveBeenCalledTimes(2);

      // Verify observation step exists
      const observationStep = result.steps.find(s => s.type === 'observation');
      expect(observationStep).toBeDefined();
      expect(observationStep!.content).toContain('150.5');
    });

    it('should strip common prefixes from the decision text', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse('Decision: Approve the transfer.'),
      );

      const result = await engine.reason('Should we approve?');

      expect(result.decision).toBe('Approve the transfer.');
    });

    it('should respect maxReasoningSteps limit', async () => {
      const limitedEngine = new ReasoningEngine(client, {
        model: 'test-model',
        maxReasoningSteps: 2,
      });

      const toolRegistry = new DefaultToolRegistry();
      toolRegistry.register(
        'slow_tool',
        vi.fn(async () => 'still working...'),
        {
          name: 'slow_tool',
          description: 'A slow tool',
          inputSchema: { type: 'object', properties: {} },
        },
      );

      const engineLimited = new ReasoningEngine(client, {
        model: 'test-model',
        maxReasoningSteps: 2,
        toolRegistry,
      });

      // Both calls return tool invocations so the loop never gets a 'stop'
      client.chat.mockResolvedValue(
        makeChatResponse('Thinking...', {
          toolCalls: [
            { id: 'tc-loop', name: 'slow_tool', arguments: '{}' },
          ],
          finishReason: 'tool_calls',
        }),
      );

      const result = await engineLimited.reason('Solve a hard problem');

      // The engine should have called the LLM at most maxReasoningSteps times
      expect(client.chat).toHaveBeenCalledTimes(2);
      // Confidence should be penalised for hitting the step limit
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should reduce confidence when tool execution returns an error', async () => {
      const toolRegistry = new DefaultToolRegistry();
      toolRegistry.register(
        'broken_tool',
        vi.fn(async () => { throw new Error('connection refused'); }),
        {
          name: 'broken_tool',
          description: 'A broken tool',
          inputSchema: { type: 'object', properties: {} },
        },
      );

      const engineBroken = new ReasoningEngine(client, {
        model: 'test-model',
        maxReasoningSteps: 3,
        toolRegistry,
      });

      client.chat
        .mockResolvedValueOnce(
          makeChatResponse('Let me try the tool.', {
            toolCalls: [
              { id: 'tc-err', name: 'broken_tool', arguments: '{}' },
            ],
            finishReason: 'tool_calls',
          }),
        )
        .mockResolvedValueOnce(
          makeChatResponse('The tool failed, but I can still answer.'),
        );

      const result = await engineBroken.reason('Do something');

      // An observation with "error" should be in the steps
      const errorObs = result.steps.find(
        s => s.type === 'observation' && s.content.includes('error'),
      );
      expect(errorObs).toBeDefined();
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  // ---------------------------------------------------------------------------
  // planTask()
  // ---------------------------------------------------------------------------

  describe('planTask', () => {
    it('should return a ReasoningResult containing a plan', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse(
          '1. Fetch data [depends: none]\n2. Analyse data [depends: 1]\n3. Report [depends: 2]',
        ),
      );

      const result = await engine.planTask('Analyse market data');

      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('confidence');
      expect(result.decision).toContain('Fetch data');
    });

    it('should include constraints in the prompt when provided', async () => {
      client.chat.mockResolvedValueOnce(makeChatResponse('1. Do the thing'));

      await engine.planTask('Build feature', ['Must use TypeScript', 'Under 1 hour']);

      const messages = client.chat.mock.calls[0][0].messages;
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('Must use TypeScript');
      expect(userMessage?.content).toContain('Under 1 hour');
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateAction()
  // ---------------------------------------------------------------------------

  describe('evaluateAction', () => {
    it('should parse a JSON approval response', async () => {
      const json = JSON.stringify({
        approved: true,
        reasoning: 'Low risk, high reward.',
        riskLevel: 'low',
      });

      client.chat.mockResolvedValueOnce(makeChatResponse(json));

      const evaluation = await engine.evaluateAction('Deploy to production', {
        env: 'staging-passed',
      });

      expect(evaluation.approved).toBe(true);
      expect(evaluation.reasoning).toBe('Low risk, high reward.');
      expect(evaluation.riskLevel).toBe('low');
    });

    it('should parse a JSON rejection response with alternatives', async () => {
      const json = JSON.stringify({
        approved: false,
        reasoning: 'Too risky during market hours.',
        riskLevel: 'high',
        alternatives: ['Wait until after hours', 'Deploy to staging first'],
      });

      client.chat.mockResolvedValueOnce(makeChatResponse(json));

      const evaluation = await engine.evaluateAction('Rebalance now', { market: 'open' });

      expect(evaluation.approved).toBe(false);
      expect(evaluation.riskLevel).toBe('high');
      expect(evaluation.alternatives).toHaveLength(2);
    });

    it('should fall back gracefully when LLM returns non-JSON', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse('I cannot evaluate this action properly.'),
      );

      const evaluation = await engine.evaluateAction('Unknown action', {});

      expect(evaluation.approved).toBe(false);
      expect(evaluation.riskLevel).toBe('high');
      expect(evaluation.reasoning).toContain('cannot evaluate');
    });
  });

  // ---------------------------------------------------------------------------
  // summarize()
  // ---------------------------------------------------------------------------

  describe('summarize', () => {
    it('should return summarised text', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse('Markets rose 2% today led by tech stocks.'),
      );

      const summary = await engine.summarize(
        'Today the S&P 500 rose by 2.1%. Technology stocks led the rally...',
      );

      expect(summary).toBe('Markets rose 2% today led by tech stocks.');
    });

    it('should pass bullet format instruction when format is bullets', async () => {
      client.chat.mockResolvedValueOnce(
        makeChatResponse('- Point 1\n- Point 2'),
      );

      await engine.summarize('Long content here', { format: 'bullets' });

      const systemMessage = client.chat.mock.calls[0][0].messages.find(
        m => m.role === 'system',
      );
      expect(systemMessage?.content).toContain('bullet-point');
    });

    it('should include max length guidance when specified', async () => {
      client.chat.mockResolvedValueOnce(makeChatResponse('Short summary.'));

      await engine.summarize('Content', { maxLength: 100 });

      const systemMessage = client.chat.mock.calls[0][0].messages.find(
        m => m.role === 'system',
      );
      expect(systemMessage?.content).toContain('100');
    });
  });

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  describe('createReasoningEngine', () => {
    it('should create a ReasoningEngine instance', () => {
      const created = createReasoningEngine(client);
      expect(created).toBeInstanceOf(ReasoningEngine);
    });
  });
});
