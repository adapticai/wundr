/**
 * Test helpers barrel export.
 *
 * Usage:
 *   import { createMockSession, FIXTURES, WsTestClient } from '../helpers';
 */

export {
  // Mock factories
  resetIdCounter,
  createMockTask,
  createMockSession,
  createMockSessionMetrics,
  createMockMemoryEntry,
  createMockMemoryContext,
  createMockDaemonConfig,
  createMockMemoryConfig,
  createMockAuthConfig,
  createMockClientIdentity,
  createMockJwtPayload,
  createMockSpawnPayload,
  createMockExecutePayload,
  createMockDaemonStatus,
  createMockIncomingMessage,
  MockWebSocket,
  TEST_JWT_SECRET,
  TEST_API_KEY,
} from './mock-factories';

export type { MockIncomingMessageOptions } from './mock-factories';

// Test fixtures
export { FIXTURES } from './test-fixtures';

// WebSocket test client
export { WsTestClient } from './ws-test-client';
export type { WsTestClientOptions } from './ws-test-client';
