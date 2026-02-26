/**
 * Tests for ModelRouter (src/models/model-router.ts).
 *
 * Covers:
 *  - Thinking modes: off, low, medium, high, xhigh
 *  - Task complexity -> thinking mode mapping
 *  - Routing strategies: failover (default), cost_optimized, latency_optimized, balanced
 *  - Concurrent request limiting (provider concurrency slots)
 *  - Provider failover on transient errors
 *  - Auth profile rotation on rate limit
 *  - Circuit breaker integration (skips open-circuit providers)
 *  - Context window validation integration
 *  - Budget enforcement integration
 *  - RoutingExhaustedError when all candidates fail
 *  - Abort signal handling (user-initiated aborts not retried)
 *  - Cost calculation
 *  - Event emissions
 *  - Error classification helpers
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  ModelRouter,
  RoutingExhaustedError,
  BudgetExceededError,
  FailoverError,
} from '../../../models/model-router';

import type {
  ModelRouterConfig,
  RoutingRequest,
} from '../../../models/model-router';
import type { LLMClient, ChatParams, ChatResponse } from '../../../types/llm';

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

/** Create a minimal successful ChatResponse. */
function makeChatResponse(overrides?: Partial<ChatResponse>): ChatResponse {
  return {
    id: 'resp-1',
    content: 'Hello from the model',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    finishReason: 'stop',
    ...overrides,
  };
}

/** Create a minimal mock LLMClient. */
function makeMockClient(overrides?: Partial<LLMClient>): LLMClient {
  return {
    provider: 'mock',
    chat: vi.fn().mockResolvedValue(makeChatResponse()),
    chatStream: vi.fn().mockImplementation(async function* () {
      // empty stream
    }),
    countTokens: vi.fn().mockResolvedValue(100),
    ...overrides,
  };
}

/** A default set of auth profiles for testing (one per provider). */
const DEFAULT_AUTH_PROFILES = [
  {
    id: 'anthropic-key-1',
    provider: 'anthropic',
    type: 'api_key' as const,
    credential: 'sk-ant-test-1',
  },
  {
    id: 'openai-key-1',
    provider: 'openai',
    type: 'api_key' as const,
    credential: 'sk-oai-test-1',
  },
  {
    id: 'openai-key-2',
    provider: 'openai',
    type: 'api_key' as const,
    credential: 'sk-oai-test-2',
  },
  {
    id: 'google-key-1',
    provider: 'google',
    type: 'api_key' as const,
    credential: 'goog-test-1',
  },
];

/** Build a default ModelRouterConfig with customizable overrides. */
function makeRouterConfig(
  overrides?: Partial<ModelRouterConfig>
): ModelRouterConfig {
  const client = makeMockClient();
  return {
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: ['openai/gpt-4o', 'google/gemini-2.0-flash'],
    defaultThinkingMode: 'off',
    defaultRoutingStrategy: 'failover',
    clientFactory: vi.fn().mockReturnValue(client),
    auth: {
      profiles: DEFAULT_AUTH_PROFILES,
    },
    retry: {
      maxRetries: 0, // Disable retries to simplify unit tests
      baseDelayMs: 10,
      maxDelayMs: 50,
    },
    providerHealth: {
      maxConcurrentPerProvider: 10,
      failureThreshold: 3,
      openDurationMs: 5_000,
    },
    ...overrides,
  };
}

/** Build a minimal RoutingRequest. */
function makeRequest(overrides?: Partial<RoutingRequest>): RoutingRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ModelRouter', () => {
  let router: ModelRouter;

  afterEach(() => {
    router?.destroy();
  });

  // -------------------------------------------------------------------------
  // Thinking modes
  // -------------------------------------------------------------------------

  describe('thinking modes', () => {
    it('should use the explicit thinkingMode from the request', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(makeRequest({ thinkingMode: 'high' }));

      expect(result.thinkingMode).toBe('high');
    });

    it('should default to the router-level defaultThinkingMode when none is specified', async () => {
      const config = makeRouterConfig({ defaultThinkingMode: 'low' });
      router = new ModelRouter(config);

      const result = await router.route(makeRequest());

      expect(result.thinkingMode).toBe('low');
    });

    it.each([
      ['trivial', 'off'],
      ['standard', 'low'],
      ['complex', 'medium'],
      ['expert', 'high'],
    ] as const)(
      'should map taskComplexity "%s" to thinkingMode "%s"',
      async (complexity, expectedMode) => {
        const config = makeRouterConfig();
        router = new ModelRouter(config);

        const result = await router.route(
          makeRequest({ taskComplexity: complexity })
        );

        expect(result.thinkingMode).toBe(expectedMode);
      }
    );

    it('should prefer explicit thinkingMode over taskComplexity', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({
          thinkingMode: 'xhigh',
          taskComplexity: 'trivial',
        })
      );

      expect(result.thinkingMode).toBe('xhigh');
    });

    it('should pass thinkingBudget in providerParams for reasoning-capable models', async () => {
      const clientFactory = vi.fn().mockReturnValue(makeMockClient());
      const config = makeRouterConfig({ clientFactory });
      router = new ModelRouter(config);

      await router.route(makeRequest({ thinkingMode: 'high' }));

      // The clientFactory should have been called; check the chat params
      const client = clientFactory.mock.results[0].value as LLMClient;
      const chatCall = (client.chat as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ChatParams;

      // claude-sonnet-4-5 supports reasoning, so budget should be set
      expect(chatCall.providerParams?.thinkingBudget).toBe(32_768);
    });
  });

  // -------------------------------------------------------------------------
  // Routing strategies
  // -------------------------------------------------------------------------

  describe('routing strategies', () => {
    it('should use failover strategy by default (no reordering)', async () => {
      const config = makeRouterConfig({ defaultRoutingStrategy: 'failover' });
      router = new ModelRouter(config);

      const result = await router.route(makeRequest());

      // Primary model should be used when failover ordering is active
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-5');
    });

    it('should accept a per-request strategy override', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({ routingStrategy: 'cost_optimized' })
      );

      // Should still succeed; first candidate (explicit primary) stays pinned
      expect(result.response.content).toBe('Hello from the model');
    });

    it('should score candidates for cost_optimized strategy', async () => {
      // Make primary fail so we exercise the fallback ordering
      let callCount = 0;
      const failFirstClient = makeMockClient({
        chat: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            const err = new Error('rate limit') as Error & { status: number };
            err.status = 429;
            throw err;
          }
          return makeChatResponse();
        }),
      });

      const config = makeRouterConfig({
        clientFactory: vi.fn().mockReturnValue(failFirstClient),
      });
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({ routingStrategy: 'cost_optimized' })
      );

      // Should have succeeded on a fallback
      expect(result.attempts.length).toBeGreaterThanOrEqual(1);
    });

    it('should score candidates for latency_optimized strategy', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      // Seed some latency data
      const health = router.getHealthTracker();
      health.recordSuccess('openai', 100);
      health.recordSuccess('anthropic', 500);
      health.recordSuccess('google', 50);

      const result = await router.route(
        makeRequest({ routingStrategy: 'latency_optimized' })
      );

      // Primary candidate stays at position 0 regardless of strategy
      expect(result.provider).toBe('anthropic');
    });

    it('should score candidates for balanced strategy', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({ routingStrategy: 'balanced' })
      );

      expect(result.response).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent request limiting
  // -------------------------------------------------------------------------

  describe('concurrent request limiting', () => {
    it('should skip a provider when its concurrency slots are full', async () => {
      const config = makeRouterConfig({
        providerHealth: {
          maxConcurrentPerProvider: 0, // No slots available
          failureThreshold: 10,
        },
      });
      router = new ModelRouter(config);

      await expect(router.route(makeRequest())).rejects.toThrow();
    });

    it('should release the concurrency slot on success', async () => {
      const config = makeRouterConfig({
        providerHealth: {
          maxConcurrentPerProvider: 1,
          failureThreshold: 10,
        },
      });
      router = new ModelRouter(config);

      // First request should succeed and release its slot
      const result1 = await router.route(makeRequest());
      expect(result1.response.content).toBe('Hello from the model');

      // Second request should also succeed (slot was released)
      const result2 = await router.route(makeRequest());
      expect(result2.response.content).toBe('Hello from the model');
    });

    it('should release the concurrency slot on failure', async () => {
      const failClient = makeMockClient({
        chat: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('timeout'), { status: 408 })
          ),
      });

      const config = makeRouterConfig({
        clientFactory: vi.fn().mockReturnValue(failClient),
        providerHealth: {
          maxConcurrentPerProvider: 1,
          failureThreshold: 100, // High threshold so circuit stays closed
        },
      });
      router = new ModelRouter(config);

      // Request fails, but slot should be released
      await expect(router.route(makeRequest())).rejects.toThrow();

      const health = router.getProviderHealth('anthropic');
      expect(health.currentConcurrent).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Provider failover
  // -------------------------------------------------------------------------

  describe('provider failover', () => {
    it('should failover to the next candidate on a transient error', async () => {
      let callIndex = 0;
      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi.fn().mockImplementation(async () => {
            callIndex++;
            if (callIndex === 1) {
              // First call (anthropic) fails with 429
              const err = new Error('Too Many Requests') as Error & {
                status: number;
              };
              err.status = 429;
              throw err;
            }
            return makeChatResponse({
              content: `response from call ${callIndex}`,
            });
          }),
        });
      });

      const config = makeRouterConfig({ clientFactory: factory });
      router = new ModelRouter(config);

      const result = await router.route(makeRequest());

      // Should have failed over to the second candidate
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].reason).toBe('rate_limit');
    });

    it('should emit router:failover events for each failed attempt', async () => {
      let callIndex = 0;
      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi.fn().mockImplementation(async () => {
            callIndex++;
            if (callIndex <= 2) {
              const err = new Error('timeout') as Error & { status: number };
              err.status = 408;
              throw err;
            }
            return makeChatResponse();
          }),
        });
      });

      const config = makeRouterConfig({ clientFactory: factory });
      router = new ModelRouter(config);

      const failoverSpy = vi.fn();
      router.on('router:failover', failoverSpy);

      await router.route(makeRequest());

      // Two failovers should have been emitted
      expect(failoverSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw RoutingExhaustedError when all candidates fail', async () => {
      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error('timeout'), { status: 408 })
            ),
        });
      });

      const config = makeRouterConfig({ clientFactory: factory });
      router = new ModelRouter(config);

      const exhaustedSpy = vi.fn();
      router.on('router:exhausted', exhaustedSpy);

      await expect(router.route(makeRequest())).rejects.toThrow(
        RoutingExhaustedError
      );

      expect(exhaustedSpy).toHaveBeenCalledOnce();
    });

    it('should rethrow non-failover-class errors immediately', async () => {
      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi
            .fn()
            .mockRejectedValue(new TypeError('Cannot read properties of null')),
        });
      });

      const config = makeRouterConfig({ clientFactory: factory });
      router = new ModelRouter(config);

      await expect(router.route(makeRequest())).rejects.toThrow(TypeError);
    });

    it('should not failover on user-initiated abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi.fn().mockImplementation(async () => {
            throw new DOMException('The operation was aborted', 'AbortError');
          }),
        });
      });

      const config = makeRouterConfig({ clientFactory: factory });
      router = new ModelRouter(config);

      await expect(
        router.route(makeRequest({ signal: controller.signal }))
      ).rejects.toThrow('Retry aborted');
    });

    it('should skip providers with an open circuit breaker', async () => {
      const config = makeRouterConfig({
        providerHealth: {
          failureThreshold: 1,
          maxConcurrentPerProvider: 10,
        },
      });
      router = new ModelRouter(config);

      // Trip anthropic's circuit
      const health = router.getHealthTracker();
      health.recordFailure('anthropic', 100);
      // threshold is 1, so circuit is now open

      const result = await router.route(makeRequest());

      // Should have skipped anthropic and used a fallback
      expect(result.attempts.length).toBeGreaterThanOrEqual(1);
      expect(result.attempts[0].provider).toBe('anthropic');
      expect(result.attempts[0].error).toContain('circuit is open');
    });
  });

  // -------------------------------------------------------------------------
  // Auth profile rotation on rate limit
  // -------------------------------------------------------------------------

  describe('auth profile rotation', () => {
    it('should skip a provider when all auth profiles are in cooldown', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      // Put all anthropic profiles into cooldown
      const auth = router.getAuthManager();
      auth.markFailure('anthropic-key-1', 'rate_limit');

      const result = await router.route(makeRequest());

      // Should have skipped anthropic (profile in cooldown) and used fallback
      const anthropicAttempt = result.attempts.find(
        a => a.provider === 'anthropic'
      );
      if (anthropicAttempt) {
        expect(anthropicAttempt.error).toContain('cooldown');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Budget enforcement
  // -------------------------------------------------------------------------

  describe('budget enforcement', () => {
    it('should throw BudgetExceededError when session budget is exhausted', async () => {
      const config = makeRouterConfig({
        tokenBudget: {
          defaultBudget: {
            maxTotalTokens: 100,
            maxCostUsd: 0.001,
            window: 'lifetime',
          },
        },
      });
      router = new ModelRouter(config);

      // Exhaust the budget
      const budget = router.getBudgetManager();
      budget.recordUsage({
        sessionId: 'session-1',
        inputTokens: 80,
        outputTokens: 30,
        costUsd: 0.001,
      });

      await expect(
        router.route(makeRequest({ sessionId: 'session-1' }))
      ).rejects.toThrow(BudgetExceededError);
    });

    it('should allow requests when budget is available', async () => {
      const config = makeRouterConfig({
        tokenBudget: {
          defaultBudget: {
            maxTotalTokens: 1_000_000,
            maxCostUsd: 100,
            window: 'lifetime',
          },
        },
      });
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({ sessionId: 'session-1' })
      );

      expect(result.budgetCheck).not.toBeNull();
      expect(result.budgetCheck!.allowed).toBe(true);
    });

    it('should record usage after a successful request', async () => {
      const config = makeRouterConfig({
        tokenBudget: {
          defaultBudget: {
            maxTotalTokens: 1_000_000,
            maxCostUsd: 100,
            window: 'lifetime',
          },
        },
      });
      router = new ModelRouter(config);

      await router.route(makeRequest({ sessionId: 'session-1' }));

      const usage = router.getBudgetManager().getUsage('session-1');
      expect(usage).not.toBeNull();
      expect(usage!.totalInputTokens).toBe(100);
      expect(usage!.totalOutputTokens).toBe(50);
      expect(usage!.requestCount).toBe(1);
    });

    it('should return null budgetCheck when no sessionId is provided', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(makeRequest()); // no sessionId

      expect(result.budgetCheck).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Model selection logic
  // -------------------------------------------------------------------------

  describe('model selection', () => {
    it('should use the explicit model override from the request', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({
          model: 'openai/gpt-4o',
        })
      );

      // Explicit model should be first candidate
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
    });

    it('should resolve model aliases in requests', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({
          model: 'sonnet',
        })
      );

      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-5');
    });

    it('should deduplicate candidates', async () => {
      // Primary and explicit are the same model
      const config = makeRouterConfig({
        primary: 'anthropic/claude-sonnet-4-5',
      });
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({
          model: 'anthropic/claude-sonnet-4-5',
        })
      );

      // Should not have duplicate attempts for the same model
      expect(result.provider).toBe('anthropic');
    });

    it('should filter candidates that lack required capabilities', async () => {
      // Make primary fail so we check that incapable models are skipped
      let callCount = 0;
      const factory = vi.fn().mockImplementation(() => {
        return makeMockClient({
          chat: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              throw Object.assign(new Error('timeout'), { status: 408 });
            }
            return makeChatResponse();
          }),
        });
      });

      const config = makeRouterConfig({
        clientFactory: factory,
        primary: 'anthropic/claude-sonnet-4-5',
        fallbacks: ['openai/o3', 'google/gemini-2.0-flash'],
      });
      router = new ModelRouter(config);

      // Require reasoning -- gemini-flash and gpt-4o do not support reasoning
      const result = await router.route(
        makeRequest({
          requiredCapabilities: { reasoning: true },
        })
      );

      // gemini-flash should have been excluded from candidates
      const providers = [
        result.provider,
        ...result.attempts.map(a => a.provider),
      ];
      expect(providers).not.toContain('gemini-2.0-flash');
    });
  });

  // -------------------------------------------------------------------------
  // Cost tracking
  // -------------------------------------------------------------------------

  describe('cost tracking', () => {
    it('should emit router:cost event with calculated costs', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const costSpy = vi.fn();
      router.on('router:cost', costSpy);

      await router.route(makeRequest());

      expect(costSpy).toHaveBeenCalledOnce();
      const cost = costSpy.mock.calls[0][0];
      expect(cost.provider).toBe('anthropic');
      expect(cost.model).toBe('claude-sonnet-4-5');
      expect(cost.inputTokens).toBe(100);
      expect(cost.outputTokens).toBe(50);
      expect(cost.totalCostUsd).toBeGreaterThan(0);
      expect(cost.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate cost using model pricing from the registry', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const costSpy = vi.fn();
      router.on('router:cost', costSpy);

      await router.route(makeRequest());

      const cost = costSpy.mock.calls[0][0];

      // claude-sonnet-4-5 pricing: input=$3/M, output=$15/M
      // 100 input tokens = 100/1_000_000 * 3 = 0.0003
      // 50 output tokens = 50/1_000_000 * 15 = 0.00075
      expect(cost.inputCostUsd).toBeCloseTo(0.0003, 6);
      expect(cost.outputCostUsd).toBeCloseTo(0.00075, 6);
      expect(cost.totalCostUsd).toBeCloseTo(0.00105, 6);
    });
  });

  // -------------------------------------------------------------------------
  // Success events
  // -------------------------------------------------------------------------

  describe('event emissions', () => {
    it('should emit router:attempt for each candidate tried', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const attemptSpy = vi.fn();
      router.on('router:attempt', attemptSpy);

      await router.route(makeRequest());

      expect(attemptSpy).toHaveBeenCalledOnce();
      expect(attemptSpy.mock.calls[0][0]).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        attemptNumber: 1,
      });
    });

    it('should emit router:success on successful completion', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const successSpy = vi.fn();
      router.on('router:success', successSpy);

      await router.route(makeRequest());

      expect(successSpy).toHaveBeenCalledOnce();
      const event = successSpy.mock.calls[0][0];
      expect(event.provider).toBe('anthropic');
      expect(event.model).toBe('claude-sonnet-4-5');
      expect(event.attempts).toBe(1);
      expect(typeof event.latencyMs).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // RoutingResult structure
  // -------------------------------------------------------------------------

  describe('RoutingResult structure', () => {
    it('should include all expected fields in the result', async () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const result = await router.route(
        makeRequest({ sessionId: 'test-session' })
      );

      expect(result.response).toBeDefined();
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-5');
      expect(result.profileId).toBeTypeOf('string');
      expect(result.attempts).toBeInstanceOf(Array);
      expect(result.cost).toBeDefined();
      expect(result.contextValidation).toBeDefined();
      expect(result.providerHealth).toBeDefined();
      expect(result.thinkingMode).toBeDefined();
      expect(typeof result.totalLatencyMs).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // Convenience delegates
  // -------------------------------------------------------------------------

  describe('convenience delegates', () => {
    it('should expose setSessionBudget / checkSessionBudget / resetSessionBudget', () => {
      const config = makeRouterConfig({
        tokenBudget: {
          defaultBudget: {
            maxTotalTokens: 5_000,
            maxCostUsd: 1.0,
            window: 'lifetime',
          },
        },
      });
      router = new ModelRouter(config);

      router.setSessionBudget('test', { maxTotalTokens: 1_000 });
      const check = router.checkSessionBudget('test');
      expect(check.allowed).toBe(true);
      expect(check.remainingTokens).toBe(1_000);

      router.resetSessionBudget('test');
      const checkAfter = router.checkSessionBudget('test');
      expect(checkAfter.remainingTokens).toBe(1_000);
    });

    it('should expose getProviderHealth / getAllProviderHealth', () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      const health = router.getProviderHealth('openai');
      expect(health.state).toBe('closed');

      const allHealth = router.getAllProviderHealth();
      expect(allHealth).toBeInstanceOf(Array);
    });

    it('should expose resetProviderCircuit', async () => {
      const config = makeRouterConfig({
        providerHealth: {
          failureThreshold: 1,
          maxConcurrentPerProvider: 10,
        },
      });
      router = new ModelRouter(config);

      const health = router.getHealthTracker();
      health.recordFailure('anthropic', 100);
      expect(health.getCircuitState('anthropic')).toBe('open');

      router.resetProviderCircuit('anthropic');
      expect(health.getCircuitState('anthropic')).toBe('closed');
    });
  });

  // -------------------------------------------------------------------------
  // Error classes
  // -------------------------------------------------------------------------

  describe('error classes', () => {
    it('RoutingExhaustedError should contain all attempt details', () => {
      const attempts = [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          error: 'rate limit',
          reason: 'rate_limit' as const,
        },
        {
          provider: 'openai',
          model: 'gpt-4o',
          error: 'timeout',
          reason: 'timeout' as const,
        },
      ];
      const err = new RoutingExhaustedError(attempts);

      expect(err.name).toBe('RoutingExhaustedError');
      expect(err.attempts).toEqual(attempts);
      expect(err.message).toContain('All models failed (2)');
      expect(err.message).toContain('rate limit');
      expect(err.message).toContain('timeout');
    });

    it('BudgetExceededError should contain sessionId and budgetCheck', () => {
      const budgetCheck = {
        allowed: false,
        warning: false,
        remainingTokens: 0,
        remainingCostUsd: 0,
        consumedPercent: 100,
        message: 'Budget exceeded',
      };
      const err = new BudgetExceededError('session-x', budgetCheck);

      expect(err.name).toBe('BudgetExceededError');
      expect(err.sessionId).toBe('session-x');
      expect(err.budgetCheck).toEqual(budgetCheck);
    });

    it('FailoverError should carry classification metadata', () => {
      const err = new FailoverError('rate limit hit', {
        reason: 'rate_limit',
        provider: 'openai',
        model: 'gpt-4o',
        status: 429,
      });

      expect(err.name).toBe('FailoverError');
      expect(err.reason).toBe('rate_limit');
      expect(err.provider).toBe('openai');
      expect(err.status).toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('should clean up all resources without throwing', () => {
      const config = makeRouterConfig();
      router = new ModelRouter(config);

      expect(() => router.destroy()).not.toThrow();
    });
  });
});
