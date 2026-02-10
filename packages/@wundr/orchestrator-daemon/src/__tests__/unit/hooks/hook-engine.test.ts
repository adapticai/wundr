/**
 * Tests for the HookEngine class (src/hooks/hook-engine.ts).
 *
 * Covers:
 *  - Hook execution pipeline (pre / post)
 *  - Void hooks execute in parallel
 *  - Modifying hooks execute sequentially with result merging
 *  - Hook timeout enforcement
 *  - Hook error handling (catchErrors true / false)
 *  - Hook ordering / priority
 *  - Matcher-based filtering (toolName, sessionId, riskLevel, notificationLevel)
 *  - Prompt hook execution (with and without LLM client)
 *  - Agent hook execution (with and without session spawner)
 *  - Result caching for void events
 *  - Hook chaining for modifying events
 *  - Disposed engine returns empty results
 *  - Engine statistics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookEngine, createHookEngine } from '../../../hooks/hook-engine';
import { HookRegistry } from '../../../hooks/hook-registry';

import type {
  HookLogger,
  HookRegistration,
  SessionStartMetadata,
  PreToolUseMetadata,
  PreToolUseResult,
  PermissionRequestMetadata,
  NotificationMetadata,
} from '../../../hooks/hook-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogger(): HookLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeSessionStartMeta(overrides?: Partial<SessionStartMetadata>): SessionStartMetadata {
  return {
    sessionId: 'sess-1',
    orchestratorId: 'orch-1',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePreToolUseMeta(overrides?: Partial<PreToolUseMetadata>): PreToolUseMetadata {
  return {
    sessionId: 'sess-1',
    toolName: 'Bash',
    toolInput: { command: 'ls' },
    toolCallId: 'tc-1',
    iteration: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HookEngine', () => {
  let registry: HookRegistry;
  let engine: HookEngine;
  let logger: HookLogger;

  beforeEach(() => {
    logger = createLogger();
    registry = new HookRegistry({ logger });
    engine = new HookEngine({
      registry,
      logger,
      cacheTtlMs: 0, // disable caching by default in tests
      catchErrors: true,
    });
  });

  // =========================================================================
  // Basic firing
  // =========================================================================

  describe('fire (basic)', () => {
    it('should return an empty result when no hooks are registered', async () => {
      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.event).toBe('SessionStart');
      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.skippedCount).toBe(0);
    });

    it('should execute a registered handler-based hook', async () => {
      const handler = vi.fn();
      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler,
      } as HookRegistration);

      const meta = makeSessionStartMeta();
      await engine.fire('SessionStart', meta);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(meta);
    });

    it('should report success for a hook that resolves normally', async () => {
      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: vi.fn().mockResolvedValue(undefined),
      } as HookRegistration);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.results[0].success).toBe(true);
    });
  });

  // =========================================================================
  // Void hooks -- parallel execution
  // =========================================================================

  describe('void hooks (parallel)', () => {
    it('should execute multiple void hooks in parallel', async () => {
      const order: string[] = [];

      registry.register({
        id: 'slow',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        priority: 10,
        handler: async () => {
          await new Promise((r) => setTimeout(r, 50));
          order.push('slow');
        },
      } as HookRegistration);

      registry.register({
        id: 'fast',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        priority: 1,
        handler: async () => {
          order.push('fast');
        },
      } as HookRegistration);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      // Both should complete
      expect(result.successCount).toBe(2);
      // fast should finish before slow because they run in parallel
      expect(order[0]).toBe('fast');
    });
  });

  // =========================================================================
  // Modifying hooks -- sequential execution & result merging
  // =========================================================================

  describe('modifying hooks (sequential)', () => {
    it('should execute PreToolUse hooks sequentially in priority order', async () => {
      const executionOrder: string[] = [];

      registry.register({
        id: 'high',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 100,
        handler: async () => {
          executionOrder.push('high');
          return undefined;
        },
      } as HookRegistration);

      registry.register({
        id: 'low',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 0,
        handler: async () => {
          executionOrder.push('low');
          return undefined;
        },
      } as HookRegistration);

      await engine.fire('PreToolUse', makePreToolUseMeta());

      expect(executionOrder).toEqual(['high', 'low']);
    });

    it('should merge results from multiple modifying hooks', async () => {
      registry.register({
        id: 'first',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 10,
        handler: async (): Promise<PreToolUseResult> => ({
          toolInput: { modified: true },
        }),
      } as HookRegistration);

      registry.register({
        id: 'second',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 5,
        handler: async (): Promise<PreToolUseResult> => ({
          block: true,
          blockReason: 'Blocked by policy',
        }),
      } as HookRegistration);

      const result = await engine.fire('PreToolUse', makePreToolUseMeta());

      expect(result.mergedResult).toEqual({
        toolInput: { modified: true },
        block: true,
        blockReason: 'Blocked by policy',
      });
    });

    it('should pass chain context to subsequent modifying hooks when chaining is enabled', async () => {
      let receivedMeta: any;

      registry.register({
        id: 'first',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 10,
        handler: async (): Promise<PreToolUseResult> => ({
          block: false,
        }),
      } as HookRegistration);

      registry.register({
        id: 'second',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        priority: 5,
        handler: async (meta: any) => {
          receivedMeta = meta;
          return undefined;
        },
      } as HookRegistration);

      const chainEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        enableChaining: true,
      });

      await chainEngine.fire('PreToolUse', makePreToolUseMeta());

      expect(receivedMeta._chainContext).toEqual({ block: false });
    });
  });

  // =========================================================================
  // Timeout enforcement
  // =========================================================================

  describe('timeout enforcement', () => {
    it('should fail a hook that exceeds its timeout', async () => {
      registry.register({
        id: 'slow-hook',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        timeoutMs: 50,
        handler: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      } as HookRegistration);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.failureCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error?.message).toContain('timed out after');
    });

    it('should count timeouts in engine stats', async () => {
      registry.register({
        id: 'timeout-hook',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        timeoutMs: 10,
        handler: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      } as HookRegistration);

      await engine.fire('SessionStart', makeSessionStartMeta());

      const stats = engine.getStats();
      expect(stats.totalTimeouts).toBeGreaterThanOrEqual(1);
      expect(stats.totalErrors).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should catch errors when catchErrors is true (default)', async () => {
      registry.register({
        id: 'fail-hook',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        catchErrors: true,
        handler: async () => {
          throw new Error('boom');
        },
      } as HookRegistration);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.failureCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error?.message).toBe('boom');
    });

    it('should propagate errors when catchErrors is false on the hook', async () => {
      registry.register({
        id: 'fail-hook',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        catchErrors: false,
        handler: async () => {
          throw new Error('propagated');
        },
      } as HookRegistration);

      // When the engine-level catchErrors is also false
      const strictEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        catchErrors: false,
      });

      await expect(
        strictEngine.fire('SessionStart', makeSessionStartMeta()),
      ).rejects.toThrow('propagated');
    });

    it('should not crash other hooks when one fails (catchErrors=true)', async () => {
      const goodHandler = vi.fn();

      registry.register({
        id: 'bad',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        catchErrors: true,
        handler: async () => {
          throw new Error('bad hook');
        },
      } as HookRegistration);

      registry.register({
        id: 'good',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: goodHandler,
      } as HookRegistration);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      // Both attempted -- bad failed, good succeeded
      expect(goodHandler).toHaveBeenCalled();
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
    });
  });

  // =========================================================================
  // Matcher filtering
  // =========================================================================

  describe('matcher filtering', () => {
    it('should skip hooks whose toolName matcher does not match', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'h1',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        matcher: { toolName: 'Write' },
        handler,
      } as HookRegistration);

      await engine.fire('PreToolUse', makePreToolUseMeta({ toolName: 'Bash' }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should execute hooks whose toolName glob pattern matches', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'h1',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        matcher: { toolName: 'Ba*' },
        handler,
      } as HookRegistration);

      await engine.fire('PreToolUse', makePreToolUseMeta({ toolName: 'Bash' }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter by sessionId glob', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        matcher: { sessionId: 'sess-*' },
        handler,
      } as HookRegistration);

      await engine.fire('SessionStart', makeSessionStartMeta({ sessionId: 'sess-abc' }));
      expect(handler).toHaveBeenCalledTimes(1);

      handler.mockClear();
      await engine.fire('SessionStart', makeSessionStartMeta({ sessionId: 'other-123' }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should filter by minRiskLevel for PermissionRequest hooks', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'perm-h',
        event: 'PermissionRequest',
        type: 'command',
        command: 'echo',
        matcher: { minRiskLevel: 'high' },
        handler,
      } as HookRegistration);

      // low risk -- should be skipped
      await engine.fire('PermissionRequest', {
        sessionId: 's1',
        toolName: 'Read',
        toolInput: {},
        permissionType: 'read',
        riskLevel: 'low',
        reason: 'test',
      } as PermissionRequestMetadata);

      expect(handler).not.toHaveBeenCalled();

      // high risk -- should match
      await engine.fire('PermissionRequest', {
        sessionId: 's1',
        toolName: 'Write',
        toolInput: {},
        permissionType: 'write',
        riskLevel: 'high',
        reason: 'test',
      } as PermissionRequestMetadata);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter by notificationLevel', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'notif-h',
        event: 'Notification',
        type: 'command',
        command: 'echo',
        matcher: { notificationLevel: 'error' },
        handler,
      } as HookRegistration);

      // info level -- should be skipped
      await engine.fire('Notification', {
        sessionId: 's1',
        level: 'info',
        message: 'all good',
        source: 'test',
        timestamp: new Date().toISOString(),
      } as NotificationMetadata);

      expect(handler).not.toHaveBeenCalled();

      // error level -- should match
      await engine.fire('Notification', {
        sessionId: 's1',
        level: 'error',
        message: 'something bad',
        source: 'test',
        timestamp: new Date().toISOString(),
      } as NotificationMetadata);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should mark skipped-by-matcher hooks in the results', async () => {
      registry.register({
        id: 'skipped',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        matcher: { toolName: 'Write' },
        handler: vi.fn(),
      } as HookRegistration);

      const result = await engine.fire('PreToolUse', makePreToolUseMeta({ toolName: 'Bash' }));

      expect(result.skippedCount).toBe(1);
      expect(result.results[0].skipped).toBe(true);
      expect(result.results[0].skipReason).toContain('Matcher');
    });

    it('should execute hooks with no matcher against all events', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'h1',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        handler,
      } as HookRegistration);

      await engine.fire('PreToolUse', makePreToolUseMeta());
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Prompt hook execution
  // =========================================================================

  describe('prompt hooks', () => {
    it('should call the LLM client and parse JSON result', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          content: '{"block": true, "blockReason": "LLM says no"}',
          usage: { totalTokens: 50 },
        }),
      };

      registry.register({
        id: 'prompt-hook',
        event: 'PreToolUse',
        type: 'prompt',
        promptTemplate: 'Should tool {{metadata.toolName}} be blocked?',
      } as HookRegistration);

      const promptEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        llmClient: mockLlm,
      });

      const result = await promptEngine.fire('PreToolUse', makePreToolUseMeta({ toolName: 'Bash' }));

      expect(mockLlm.chat).toHaveBeenCalledTimes(1);
      const chatArgs = mockLlm.chat.mock.calls[0][0];
      expect(chatArgs.messages[1].content).toContain('Bash');
      expect(result.results[0].success).toBe(true);
    });

    it('should run in placeholder mode without an LLM client', async () => {
      registry.register({
        id: 'prompt-hook',
        event: 'PreToolUse',
        type: 'prompt',
        promptTemplate: 'test prompt',
      } as HookRegistration);

      const noLlmEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
      });

      const result = await noLlmEngine.fire('PreToolUse', makePreToolUseMeta());

      expect(result.results[0].success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('placeholder mode'),
      );
    });

    it('should throw when a prompt hook has no promptTemplate', async () => {
      // Register a valid prompt hook first (the registry rejects prompt hooks
      // without a promptTemplate or handler), then strip the promptTemplate
      // after registration to simulate a hook that reaches the engine broken.
      registry.register({
        id: 'bad-prompt',
        event: 'PreToolUse',
        type: 'prompt',
        promptTemplate: 'placeholder',
      } as HookRegistration);

      const hook = registry.getHookById('bad-prompt');
      if (hook) {
        (hook as any).promptTemplate = undefined;
        (hook as any).handler = undefined;
      }

      const result = await engine.fire('PreToolUse', makePreToolUseMeta());

      expect(result.failureCount).toBe(1);
      expect(result.results[0].error?.message).toContain('no promptTemplate');
    });
  });

  // =========================================================================
  // Agent hook execution
  // =========================================================================

  describe('agent hooks', () => {
    it('should spawn a sub-session via the session spawner', async () => {
      const mockSpawner = {
        spawnHookSession: vi.fn().mockResolvedValue({
          success: true,
          output: '{"decision": "approve"}',
        }),
      };

      registry.register({
        id: 'agent-hook',
        event: 'PermissionRequest',
        type: 'agent',
        agentConfig: { model: 'claude-opus-4-6' },
      } as any);

      const agentEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        sessionSpawner: mockSpawner,
      });

      const result = await agentEngine.fire('PermissionRequest', {
        sessionId: 's1',
        toolName: 'Write',
        toolInput: {},
        permissionType: 'write',
        riskLevel: 'medium',
        reason: 'test',
      } as PermissionRequestMetadata);

      expect(mockSpawner.spawnHookSession).toHaveBeenCalledTimes(1);
      expect(result.results[0].success).toBe(true);
    });

    it('should fail when the spawned session fails', async () => {
      const mockSpawner = {
        spawnHookSession: vi.fn().mockResolvedValue({
          success: false,
          error: 'sub-session crashed',
        }),
      };

      registry.register({
        id: 'agent-hook',
        event: 'SessionStart',
        type: 'agent',
        agentConfig: 'agent.yaml',
      } as any);

      const agentEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        sessionSpawner: mockSpawner,
      });

      const result = await agentEngine.fire('SessionStart', makeSessionStartMeta());

      expect(result.failureCount).toBe(1);
      expect(result.results[0].error?.message).toContain('sub-session failed');
    });

    it('should run in placeholder mode without a session spawner', async () => {
      registry.register({
        id: 'agent-hook',
        event: 'SessionStart',
        type: 'agent',
        agentConfig: 'agent.yaml',
      } as any);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.results[0].success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('placeholder mode'),
      );
    });
  });

  // =========================================================================
  // Caching
  // =========================================================================

  describe('result caching', () => {
    it('should return cached results for void events within TTL', async () => {
      const handler = vi.fn();

      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler,
      } as HookRegistration);

      const cachedEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 60_000, // 60s TTL
      });

      const meta = makeSessionStartMeta();
      await cachedEngine.fire('SessionStart', meta);
      await cachedEngine.fire('SessionStart', meta);

      // Handler should only be called once; second call is a cache hit
      expect(handler).toHaveBeenCalledTimes(1);
      expect(cachedEngine.getStats().totalCacheHits).toBe(1);
    });

    it('should never cache modifying event results', async () => {
      const handler = vi.fn().mockResolvedValue({ block: false });

      registry.register({
        id: 'h1',
        event: 'PreToolUse',
        type: 'command',
        command: 'echo',
        handler,
      } as HookRegistration);

      const cachedEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 60_000,
      });

      const meta = makePreToolUseMeta();
      await cachedEngine.fire('PreToolUse', meta);
      await cachedEngine.fire('PreToolUse', meta);

      // Both calls should invoke the handler (modifying events are never cached)
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should report cache size and allow clearing', async () => {
      const handler = vi.fn();
      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler,
      } as HookRegistration);

      const cachedEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 60_000,
      });

      await cachedEngine.fire('SessionStart', makeSessionStartMeta({ sessionId: 'a' }));
      await cachedEngine.fire('SessionStart', makeSessionStartMeta({ sessionId: 'b' }));

      expect(cachedEngine.getCacheSize()).toBe(2);

      cachedEngine.clearCache();
      expect(cachedEngine.getCacheSize()).toBe(0);
    });
  });

  // =========================================================================
  // Disposed engine
  // =========================================================================

  describe('disposed engine', () => {
    it('should return an empty result after disposal', async () => {
      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: vi.fn(),
      } as HookRegistration);

      await engine.dispose();

      const result = await engine.fire('SessionStart', makeSessionStartMeta());
      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
    });
  });

  // =========================================================================
  // hasHooks / getHookCount
  // =========================================================================

  describe('hasHooks / getHookCount', () => {
    it('should return false / 0 when no hooks are registered', () => {
      expect(engine.hasHooks('SessionStart')).toBe(false);
      expect(engine.getHookCount('SessionStart')).toBe(0);
    });

    it('should return true / count when hooks are registered', () => {
      registry.register({
        id: 'h1',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: vi.fn(),
      } as HookRegistration);
      registry.register({
        id: 'h2',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: vi.fn(),
      } as HookRegistration);

      expect(engine.hasHooks('SessionStart')).toBe(true);
      expect(engine.getHookCount('SessionStart')).toBe(2);
    });
  });

  // =========================================================================
  // Engine statistics
  // =========================================================================

  describe('getStats', () => {
    it('should track totalFired across multiple fire calls', async () => {
      await engine.fire('SessionStart', makeSessionStartMeta());
      await engine.fire('SessionStart', makeSessionStartMeta());
      await engine.fire('SessionStart', makeSessionStartMeta());

      expect(engine.getStats().totalFired).toBe(3);
    });

    it('should track errors and timeouts', async () => {
      registry.register({
        id: 'err-hook',
        event: 'SessionStart',
        type: 'command',
        command: 'echo',
        handler: async () => {
          throw new Error('oops');
        },
      } as HookRegistration);

      await engine.fire('SessionStart', makeSessionStartMeta());

      const stats = engine.getStats();
      expect(stats.totalErrors).toBe(1);
    });
  });

  // =========================================================================
  // createHookEngine factory
  // =========================================================================

  describe('createHookEngine', () => {
    it('should return a working HookEngine instance', async () => {
      const eng = createHookEngine({ registry, logger, cacheTtlMs: 0 });
      const result = await eng.fire('SessionStart', makeSessionStartMeta());
      expect(result.event).toBe('SessionStart');
    });
  });

  // =========================================================================
  // Unknown hook type
  // =========================================================================

  describe('unknown hook type', () => {
    it('should fail for a hook with unknown type and no handler', async () => {
      registry.register({
        id: 'bad-type',
        event: 'SessionStart',
        type: 'magic' as any,
        handler: undefined,
      } as any);

      const result = await engine.fire('SessionStart', makeSessionStartMeta());

      expect(result.failureCount).toBe(1);
      expect(result.results[0].error?.message).toContain('unknown type');
    });
  });

  // =========================================================================
  // Template interpolation
  // =========================================================================

  describe('template interpolation (via prompt hooks)', () => {
    it('should interpolate {{metadata.fieldName}} placeholders', async () => {
      let sentPrompt = '';
      const mockLlm = {
        chat: vi.fn().mockImplementation(async (params: any) => {
          sentPrompt = params.messages[1].content;
          return { content: '{}', usage: { totalTokens: 10 } };
        }),
      };

      registry.register({
        id: 'interpolate-hook',
        event: 'PreToolUse',
        type: 'prompt',
        promptTemplate: 'Tool name is {{metadata.toolName}}, call id is {{metadata.toolCallId}}',
      } as HookRegistration);

      const intEngine = new HookEngine({
        registry,
        logger,
        cacheTtlMs: 0,
        llmClient: mockLlm,
      });

      await intEngine.fire('PreToolUse', makePreToolUseMeta({ toolName: 'Write', toolCallId: 'tc-42' }));

      expect(sentPrompt).toBe('Tool name is Write, call id is tc-42');
    });
  });
});
