/**
 * Tests for TokenBudgetManager (src/models/token-budget.ts).
 *
 * Covers:
 *  - Per-session budget tracking and enforcement
 *  - Token budget exceeded (blocked)
 *  - Cost budget exceeded (blocked)
 *  - Warning threshold at 80% consumed
 *  - Custom session budgets vs. default budget
 *  - Budget window kinds: lifetime, hourly, daily
 *  - Automatic window reset on expiry
 *  - Usage recording and aggregation
 *  - Manual usage reset
 *  - Event emissions: budget:warning, budget:exceeded, budget:reset
 *  - clear() removes all state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TokenBudgetManager } from '../../../models/token-budget';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;

  afterEach(() => {
    manager?.clear();
  });

  // ---------------------------------------------------------------------------
  // Default budget and basic checks
  // ---------------------------------------------------------------------------

  describe('default budget', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
      });
    });

    it('should allow requests when no usage has been recorded', () => {
      const check = manager.checkBudget('session-1');

      expect(check.allowed).toBe(true);
      expect(check.warning).toBe(false);
      expect(check.remainingTokens).toBe(10_000);
      expect(check.consumedPercent).toBe(0);
    });

    it('should report remaining budget correctly after usage', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 1_000,
        outputTokens: 500,
        costUsd: 0.1,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(true);
      expect(check.remainingTokens).toBe(8_500); // 10000 - 1500
      expect(check.consumedPercent).toBe(15); // 1500 / 10000 = 15%
    });

    it('should accumulate usage across multiple requests', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 2_000,
        outputTokens: 1_000,
        costUsd: 0.2,
      });
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 3_000,
        outputTokens: 2_000,
        costUsd: 0.3,
      });

      const check = manager.checkBudget('session-1');
      // Total: 2000+1000+3000+2000 = 8000 tokens
      expect(check.remainingTokens).toBe(2_000);
      expect(check.consumedPercent).toBe(80);
    });

    it('should track sessions independently', () => {
      manager.recordUsage({
        sessionId: 'session-a',
        inputTokens: 9_000,
        outputTokens: 500,
        costUsd: 0.8,
      });

      const checkA = manager.checkBudget('session-a');
      const checkB = manager.checkBudget('session-b');

      expect(checkA.remainingTokens).toBe(500);
      expect(checkB.remainingTokens).toBe(10_000);
    });
  });

  // ---------------------------------------------------------------------------
  // Token budget exceeded
  // ---------------------------------------------------------------------------

  describe('token budget exceeded', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 5_000,
          maxCostUsd: 100, // High cost limit so tokens trigger first
          window: 'lifetime',
        },
      });
    });

    it('should block requests when token budget is exhausted', () => {
      const exceededSpy = vi.fn();
      manager.on('budget:exceeded', exceededSpy);

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 3_000,
        outputTokens: 2_000,
        costUsd: 0.5,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(false);
      expect(check.remainingTokens).toBe(0);
      expect(check.consumedPercent).toBe(100);
      expect(check.message).toContain('token budget exceeded');
      expect(exceededSpy).toHaveBeenCalledOnce();
    });

    it('should block when tokens go over the limit', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 4_000,
        outputTokens: 2_000,
        costUsd: 0.3,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(false);
      expect(check.remainingTokens).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Cost budget exceeded
  // ---------------------------------------------------------------------------

  describe('cost budget exceeded', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000_000, // High token limit so cost triggers first
          maxCostUsd: 0.5,
          window: 'lifetime',
        },
      });
    });

    it('should block when cost budget is exhausted', () => {
      const exceededSpy = vi.fn();
      manager.on('budget:exceeded', exceededSpy);

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 1_000,
        outputTokens: 500,
        costUsd: 0.5,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(false);
      expect(check.message).toContain('cost budget exceeded');
      expect(exceededSpy).toHaveBeenCalledOnce();
    });

    it('should report remaining cost correctly', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.3,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(true);
      // remainingCostUsd = 0.50 - 0.30 = 0.20
      expect(check.remainingCostUsd).toBeCloseTo(0.2, 4);
    });
  });

  // ---------------------------------------------------------------------------
  // Warning threshold
  // ---------------------------------------------------------------------------

  describe('warning threshold', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
        warningThresholdPercent: 80,
      });
    });

    it('should not warn below 80% consumed', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 3_000,
        outputTokens: 1_000,
        costUsd: 0.3,
      });

      const check = manager.checkBudget('session-1');
      expect(check.warning).toBe(false);
      expect(check.allowed).toBe(true);
    });

    it('should emit a warning at exactly 80% consumed', () => {
      const warningSpy = vi.fn();
      manager.on('budget:warning', warningSpy);

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 5_000,
        outputTokens: 3_000,
        costUsd: 0.5,
      });

      const check = manager.checkBudget('session-1');
      expect(check.warning).toBe(true);
      expect(check.allowed).toBe(true);
      expect(check.consumedPercent).toBe(80);
      expect(check.message).toContain('80%');
      expect(warningSpy).toHaveBeenCalledOnce();
    });

    it('should warn between 80% and 100%', () => {
      const warningSpy = vi.fn();
      manager.on('budget:warning', warningSpy);

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 5_000,
        outputTokens: 4_000,
        costUsd: 0.5,
      });

      const check = manager.checkBudget('session-1');
      expect(check.warning).toBe(true);
      expect(check.allowed).toBe(true);
      expect(check.consumedPercent).toBe(90);
      expect(warningSpy).toHaveBeenCalledOnce();
    });

    it('should support custom warning threshold', () => {
      const customManager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
        warningThresholdPercent: 50,
      });

      customManager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 3_000,
        outputTokens: 2_000,
        costUsd: 0.3,
      });

      const check = customManager.checkBudget('session-1');
      expect(check.warning).toBe(true);
      expect(check.consumedPercent).toBe(50);

      customManager.clear();
    });
  });

  // ---------------------------------------------------------------------------
  // Custom session budgets
  // ---------------------------------------------------------------------------

  describe('custom session budgets', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 100_000,
          maxCostUsd: 10,
          window: 'lifetime',
        },
      });
    });

    it('should use the default budget when none is set for a session', () => {
      const budget = manager.getSessionBudget('session-x');
      expect(budget.maxTotalTokens).toBe(100_000);
      expect(budget.maxCostUsd).toBe(10);
    });

    it('should use a custom budget when set for a session', () => {
      manager.setSessionBudget('session-x', {
        maxTotalTokens: 5_000,
        maxCostUsd: 0.25,
      });

      const budget = manager.getSessionBudget('session-x');
      expect(budget.maxTotalTokens).toBe(5_000);
      expect(budget.maxCostUsd).toBe(0.25);
    });

    it('should fall back to defaults for omitted fields in a custom budget', () => {
      manager.setSessionBudget('session-x', {
        maxTotalTokens: 5_000,
        // maxCostUsd omitted -- should use default (10)
      });

      const budget = manager.getSessionBudget('session-x');
      expect(budget.maxTotalTokens).toBe(5_000);
      expect(budget.maxCostUsd).toBe(10);
    });

    it('should enforce custom session budget limits', () => {
      manager.setSessionBudget('session-strict', {
        maxTotalTokens: 1_000,
        maxCostUsd: 0.01,
      });

      manager.recordUsage({
        sessionId: 'session-strict',
        inputTokens: 600,
        outputTokens: 500,
        costUsd: 0.005,
      });

      const check = manager.checkBudget('session-strict');
      expect(check.allowed).toBe(false);
      expect(check.remainingTokens).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Budget windows: automatic reset
  // ---------------------------------------------------------------------------

  describe('budget windows', () => {
    it('should never auto-reset a lifetime window', () => {
      vi.useFakeTimers();

      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
      });

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 8_000,
        outputTokens: 1_000,
        costUsd: 0.5,
      });

      // Advance past 24h
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const check = manager.checkBudget('session-1');
      // Usage should NOT have reset
      expect(check.remainingTokens).toBe(1_000);

      vi.useRealTimers();
    });

    it('should auto-reset an hourly window after one hour', () => {
      vi.useFakeTimers();

      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'hourly',
        },
      });

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 8_000,
        outputTokens: 1_000,
        costUsd: 0.5,
      });

      const checkBefore = manager.checkBudget('session-1');
      expect(checkBefore.remainingTokens).toBe(1_000);

      // Advance past 1 hour
      vi.advanceTimersByTime(61 * 60 * 1000);

      const resetSpy = vi.fn();
      manager.on('budget:reset', resetSpy);

      const checkAfter = manager.checkBudget('session-1');
      expect(checkAfter.remainingTokens).toBe(10_000);
      expect(checkAfter.consumedPercent).toBe(0);
      expect(resetSpy).toHaveBeenCalledWith('session-1');

      vi.useRealTimers();
    });

    it('should auto-reset a daily window after 24 hours', () => {
      vi.useFakeTimers();

      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'daily',
        },
      });

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 9_000,
        outputTokens: 500,
        costUsd: 0.5,
      });

      // Not yet expired (23h)
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);
      const checkBefore = manager.checkBudget('session-1');
      expect(checkBefore.remainingTokens).toBe(500);

      // Past expiry (add another 2h)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      const checkAfter = manager.checkBudget('session-1');
      expect(checkAfter.remainingTokens).toBe(10_000);

      vi.useRealTimers();
    });

    it('should not reset the window before expiry', () => {
      vi.useFakeTimers();

      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'hourly',
        },
      });

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 5_000,
        outputTokens: 2_000,
        costUsd: 0.3,
      });

      // Advance 30 minutes (less than 1 hour)
      vi.advanceTimersByTime(30 * 60 * 1000);

      const check = manager.checkBudget('session-1');
      // Usage should still be accumulated
      expect(check.remainingTokens).toBe(3_000);

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Usage tracking helpers
  // ---------------------------------------------------------------------------

  describe('getUsage', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager();
    });

    it('should return null for an unknown session', () => {
      expect(manager.getUsage('nonexistent')).toBeNull();
    });

    it('should return usage data for a tracked session', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
      });

      const usage = manager.getUsage('session-1');
      expect(usage).not.toBeNull();
      expect(usage!.totalInputTokens).toBe(100);
      expect(usage!.totalOutputTokens).toBe(50);
      expect(usage!.totalCostUsd).toBe(0.01);
      expect(usage!.requestCount).toBe(1);
    });

    it('should increment requestCount on each recording', () => {
      manager.recordUsage({
        sessionId: 's1',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.001,
      });
      manager.recordUsage({
        sessionId: 's1',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.001,
      });
      manager.recordUsage({
        sessionId: 's1',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.001,
      });

      const usage = manager.getUsage('s1');
      expect(usage!.requestCount).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Manual reset
  // ---------------------------------------------------------------------------

  describe('resetUsage', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
      });
    });

    it('should clear usage for a specific session', () => {
      const resetSpy = vi.fn();
      manager.on('budget:reset', resetSpy);

      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 8_000,
        outputTokens: 1_000,
        costUsd: 0.5,
      });

      manager.resetUsage('session-1');

      const check = manager.checkBudget('session-1');
      expect(check.remainingTokens).toBe(10_000);
      expect(check.consumedPercent).toBe(0);
      expect(resetSpy).toHaveBeenCalledWith('session-1');
    });

    it('should not affect other sessions', () => {
      manager.recordUsage({
        sessionId: 'session-a',
        inputTokens: 5_000,
        outputTokens: 2_000,
        costUsd: 0.3,
      });
      manager.recordUsage({
        sessionId: 'session-b',
        inputTokens: 3_000,
        outputTokens: 1_000,
        costUsd: 0.2,
      });

      manager.resetUsage('session-a');

      const checkA = manager.checkBudget('session-a');
      const checkB = manager.checkBudget('session-b');

      expect(checkA.remainingTokens).toBe(10_000);
      expect(checkB.remainingTokens).toBe(6_000);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all session data and budgets', () => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 10_000,
          maxCostUsd: 1.0,
          window: 'lifetime',
        },
      });

      manager.setSessionBudget('session-1', { maxTotalTokens: 500 });
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
      });
      manager.recordUsage({
        sessionId: 'session-2',
        inputTokens: 200,
        outputTokens: 100,
        costUsd: 0.02,
      });

      manager.clear();

      // Usage should be gone
      expect(manager.getUsage('session-1')).toBeNull();
      expect(manager.getUsage('session-2')).toBeNull();

      // Custom budget should be cleared; should fall back to default
      const budget = manager.getSessionBudget('session-1');
      expect(budget.maxTotalTokens).toBe(10_000);
    });
  });

  // ---------------------------------------------------------------------------
  // remainingCostUsd: unlimited cost budget
  // ---------------------------------------------------------------------------

  describe('unlimited cost budget', () => {
    beforeEach(() => {
      manager = new TokenBudgetManager({
        defaultBudget: {
          maxTotalTokens: 100_000,
          maxCostUsd: 0, // 0 = unlimited
          window: 'lifetime',
        },
      });
    });

    it('should report -1 for remainingCostUsd when cost is unlimited', () => {
      const check = manager.checkBudget('session-1');
      expect(check.remainingCostUsd).toBe(-1);
    });

    it('should never block on cost when maxCostUsd is 0', () => {
      manager.recordUsage({
        sessionId: 'session-1',
        inputTokens: 1_000,
        outputTokens: 500,
        costUsd: 999.99,
      });

      const check = manager.checkBudget('session-1');
      expect(check.allowed).toBe(true);
    });
  });
});
