/**
 * Global test setup for orchestrator-daemon test suite.
 *
 * This file runs before every test file.  It:
 *  1. Sets a minimal OPENAI_API_KEY so config-dependent code does not throw.
 *  2. Suppresses noisy logger output during tests.
 *  3. Registers an afterEach hook that restores real timers to prevent leaks.
 */

import { afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Environment defaults -- ensure config loaders do not crash in test context
// ---------------------------------------------------------------------------

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-test-key-for-unit-tests-only-not-real';
}

// ---------------------------------------------------------------------------
// Logger suppression
// ---------------------------------------------------------------------------

// Silence the internal Logger during tests unless DEBUG_TESTS is set.
if (!process.env.DEBUG_TESTS) {
  vi.mock('../../utils/logger', () => {
    const noop = () => {};
    return {
      Logger: class MockLogger {
        debug = noop;
        info = noop;
        warn = noop;
        error = noop;
        constructor() {}
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Timer cleanup safety net
// ---------------------------------------------------------------------------

afterEach(() => {
  // Restore real timers if a test used vi.useFakeTimers() but forgot to restore.
  try {
    vi.useRealTimers();
  } catch {
    // Already using real timers -- nothing to do.
  }
});
