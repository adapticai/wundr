/**
 * Vitest global setup.
 *
 * Silences console noise during tests and provides shared helpers.
 */

import { vi } from 'vitest';

// Silence console output during test runs to keep CI logs clean.
// Individual tests can restore if needed with vi.restoreAllMocks().
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
