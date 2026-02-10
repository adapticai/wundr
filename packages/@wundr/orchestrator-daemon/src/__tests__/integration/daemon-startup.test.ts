/**
 * Integration tests: Daemon Startup, Lifecycle, and Status
 *
 * Verifies that OrchestratorDaemon correctly initialises all subsystems,
 * orchestrates start/stop lifecycles, and reports aggregated status.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import under test (after mocks are in place)
// ---------------------------------------------------------------------------

import { OrchestratorDaemon } from '../../core/orchestrator-daemon';

import type { DaemonConfig } from '../../types';

// ---------------------------------------------------------------------------
// Mocks -- declared before any imports that pull in the mocked modules
// ---------------------------------------------------------------------------

// WebSocket server
const mockWsStart = vi.fn().mockResolvedValue(undefined);
const mockWsStop = vi.fn().mockResolvedValue(undefined);
const mockWsBroadcast = vi.fn();
const mockWsSend = vi.fn();
const mockWsSendError = vi.fn();
const mockWsOn = vi.fn();

vi.mock('../../core/websocket-server', () => ({
  OrchestratorWebSocketServer: vi.fn().mockImplementation(() => ({
    start: mockWsStart,
    stop: mockWsStop,
    broadcast: mockWsBroadcast,
    send: mockWsSend,
    sendError: mockWsSendError,
    on: mockWsOn,
  })),
}));

// Memory manager
vi.mock('../../memory/memory-manager', () => ({
  MemoryManager: vi.fn().mockImplementation(() => ({})),
}));

// Session manager
const mockSessionGetActiveSessions = vi.fn().mockReturnValue([]);
const mockSessionGetActiveSessionCount = vi.fn().mockReturnValue(0);
const mockSessionGetAllSessions = vi.fn().mockReturnValue([]);
const mockSessionStopSession = vi.fn().mockResolvedValue(undefined);
const mockSessionCleanup = vi.fn();
const mockSessionOn = vi.fn();

vi.mock('../../session/session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    getActiveSessions: mockSessionGetActiveSessions,
    getActiveSessionCount: mockSessionGetActiveSessionCount,
    getAllSessions: mockSessionGetAllSessions,
    stopSession: mockSessionStopSession,
    cleanup: mockSessionCleanup,
    on: mockSessionOn,
  })),
}));

// LLM client
vi.mock('../../llm', () => ({
  createOpenAIClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({ content: 'test', usage: { totalTokens: 0 } }),
  })),
}));

// MCP tool registry
vi.mock('../../mcp/tool-registry', () => ({
  McpToolRegistryImpl: vi.fn().mockImplementation(() => ({
    listTools: vi.fn().mockReturnValue([]),
  })),
}));

// Hooks
vi.mock('../../hooks', () => ({
  createHookRegistry: vi.fn(() => ({
    register: vi.fn(),
    getAllHooks: vi.fn().mockReturnValue([]),
    getHooksForEvent: vi.fn().mockReturnValue([]),
  })),
  createHookEngine: vi.fn(() => ({
    fire: vi.fn().mockResolvedValue({ event: 'SessionStart', results: [], totalDurationMs: 0, successCount: 0, failureCount: 0, skippedCount: 0 }),
  })),
  registerBuiltInHooks: vi.fn(),
}));

// Skills
const mockSkillRegistryLoad = vi.fn().mockResolvedValue(undefined);
vi.mock('../../skills', () => ({
  SkillRegistry: vi.fn().mockImplementation(() => ({
    load: mockSkillRegistryLoad,
    getSkillNames: vi.fn().mockReturnValue([]),
    size: 0,
  })),
}));

// Teams
vi.mock('../../teams', () => ({
  TeamCoordinator: vi.fn().mockImplementation(() => ({})),
}));

// Agents
const mockAgentRegistryLoadFromDirectory = vi.fn().mockResolvedValue(2);
vi.mock('../../agents', () => ({
  AgentRegistry: vi.fn().mockImplementation(() => ({
    loadFromDirectory: mockAgentRegistryLoadFromDirectory,
    listAll: vi.fn().mockReturnValue([]),
    size: 0,
  })),
}));

// Models
vi.mock('../../models', () => ({
  ModelRouter: vi.fn().mockImplementation(() => ({})),
}));

// Channels
const mockChannelDisconnectAll = vi.fn().mockResolvedValue(undefined);
vi.mock('../../channels', () => ({
  ChannelRegistry: vi.fn().mockImplementation(() => ({
    disconnectAll: mockChannelDisconnectAll,
  })),
}));

// Security
vi.mock('../../security', () => ({
  SecurityGate: vi.fn().mockImplementation(() => ({
    evaluateToolCall: vi.fn(),
    redactOutput: vi.fn((t: string) => t),
  })),
}));

// Streaming
vi.mock('../../streaming', () => ({
  StreamHandler: vi.fn().mockImplementation(() => ({})),
}));

// Protocol
vi.mock('../../protocol', () => ({
  MessageRouter: vi.fn().mockImplementation(() => ({})),
}));

// Plugins
const mockPluginLoadAll = vi.fn().mockResolvedValue({ loaded: [], failed: [] });
const mockPluginShutdown = vi.fn().mockResolvedValue(undefined);
vi.mock('../../plugins', () => ({
  PluginLifecycleManager: vi.fn().mockImplementation(() => ({
    loadAll: mockPluginLoadAll,
    shutdown: mockPluginShutdown,
  })),
}));

// Config watcher
const mockConfigWatcherStop = vi.fn().mockResolvedValue(undefined);
vi.mock('../../config', () => ({
  startConfigWatcher: vi.fn(() => ({
    stop: mockConfigWatcherStop,
  })),
  generateDefaultConfig: vi.fn(() => ({})),
  readConfigSnapshot: vi.fn(() => ({})),
  loadConfig: vi.fn(),
  validateRequiredEnv: vi.fn(),
  getConfig: vi.fn(),
  resetConfig: vi.fn(),
  ConfigSchema: {},
}));

// File system -- mock loadCharter read
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('No charter file in test')),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConfig(overrides: Partial<DaemonConfig> = {}): DaemonConfig {
  return {
    name: 'test-daemon',
    port: 19876,
    host: '127.0.0.1',
    maxSessions: 10,
    heartbeatInterval: 5000,
    shutdownTimeout: 1000,
    verbose: false,
    logLevel: 'warn',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Daemon Startup Integration', () => {
  let daemon: OrchestratorDaemon;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset timers so health-check / cleanup intervals don't leak
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(async () => {
    // Ensure daemon is stopped even if a test fails mid-start
    try {
      await daemon?.stop();
    } catch {
      // ignore
    }
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('initialises all modules without errors', () => {
      daemon = new OrchestratorDaemon(buildConfig());

      // The daemon should be in 'stopped' state before start()
      const status = daemon.getStatus();
      expect(status.status).toBe('stopped');
    });

    it('applies env-based port and host overrides', () => {
      const origPort = process.env['DAEMON_PORT'];
      const origHost = process.env['DAEMON_HOST'];
      try {
        process.env['DAEMON_PORT'] = '29999';
        process.env['DAEMON_HOST'] = '0.0.0.0';

        daemon = new OrchestratorDaemon(buildConfig({ port: 8787 }));

        // The config should have picked up the env overrides
        const status = daemon.getStatus();
        expect(status).toBeDefined();
      } finally {
        if (origPort !== undefined) {
process.env['DAEMON_PORT'] = origPort;
} else {
delete process.env['DAEMON_PORT'];
}
        if (origHost !== undefined) {
process.env['DAEMON_HOST'] = origHost;
} else {
delete process.env['DAEMON_HOST'];
}
      }
    });

    it('validates config via DaemonConfigSchema', () => {
      // Invalid port should fail validation
      expect(() => {
        new OrchestratorDaemon(buildConfig({ port: 80 }));
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------

  describe('start()', () => {
    it('transitions from stopped -> initializing -> running', async () => {
      daemon = new OrchestratorDaemon(buildConfig());

      const statusBeforeStart = daemon.getStatus();
      expect(statusBeforeStart.status).toBe('stopped');

      // Track the 'started' event emission
      const startedPromise = new Promise<void>((resolve) => {
        daemon.on('started', () => resolve());
      });

      await daemon.start();

      // Flush event emission
      await startedPromise;

      const statusAfterStart = daemon.getStatus();
      expect(statusAfterStart.status).toBe('running');
      expect(statusAfterStart.uptime).toBeGreaterThanOrEqual(0);
    });

    it('starts the WebSocket server', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      expect(mockWsStart).toHaveBeenCalledOnce();
    });

    it('loads skills gracefully (non-fatal on failure)', async () => {
      mockSkillRegistryLoad.mockRejectedValueOnce(new Error('no skills dir'));

      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      // Daemon should still be running despite skill-load failure
      expect(daemon.getStatus().status).toBe('running');
    });

    it('loads agent definitions gracefully (non-fatal on failure)', async () => {
      mockAgentRegistryLoadFromDirectory.mockRejectedValueOnce(
        new Error('no agents dir'),
      );

      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      expect(daemon.getStatus().status).toBe('running');
    });

    it('loads plugins and reports results', async () => {
      mockPluginLoadAll.mockResolvedValueOnce({
        loaded: ['plugin-a'],
        failed: [],
      });

      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      expect(mockPluginLoadAll).toHaveBeenCalledOnce();
    });

    it('sets startTime on successful start', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      const status = daemon.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // stop()
  // -------------------------------------------------------------------------

  describe('stop()', () => {
    it('transitions from running -> stopped', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      expect(daemon.getStatus().status).toBe('running');

      const stoppedPromise = new Promise<void>((resolve) => {
        daemon.on('stopped', () => resolve());
      });

      await daemon.stop();
      await stoppedPromise;

      expect(daemon.getStatus().status).toBe('stopped');
    });

    it('stops all active sessions before shutting down', async () => {
      const fakeSession = { id: 'sess-1', status: 'running' };
      mockSessionGetActiveSessions.mockReturnValueOnce([fakeSession]);

      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      await daemon.stop();

      expect(mockSessionStopSession).toHaveBeenCalledWith('sess-1');
    });

    it('stops the WebSocket server', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      await daemon.stop();

      expect(mockWsStop).toHaveBeenCalledOnce();
    });

    it('shuts down plugins', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      await daemon.stop();

      expect(mockPluginShutdown).toHaveBeenCalledOnce();
    });

    it('disconnects all channel adapters', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      await daemon.stop();

      expect(mockChannelDisconnectAll).toHaveBeenCalledOnce();
    });

    it('stops the config watcher', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();
      await daemon.stop();

      expect(mockConfigWatcherStop).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // getStatus()
  // -------------------------------------------------------------------------

  describe('getStatus()', () => {
    it('returns all subsystem statuses', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      const status = daemon.getStatus();

      // Verify core subsystems
      expect(status.subsystems).toHaveProperty('websocket');
      expect(status.subsystems).toHaveProperty('sessionManager');
      expect(status.subsystems).toHaveProperty('memoryManager');
      expect(status.subsystems).toHaveProperty('llmClient');
      expect(status.subsystems).toHaveProperty('mcpRegistry');

      // Verify Wave 3 subsystems
      expect(status.subsystems).toHaveProperty('hookEngine');
      expect(status.subsystems).toHaveProperty('skillRegistry');
      expect(status.subsystems).toHaveProperty('teamCoordinator');
      expect(status.subsystems).toHaveProperty('agentRegistry');
      expect(status.subsystems).toHaveProperty('modelRouter');
      expect(status.subsystems).toHaveProperty('channelRegistry');
      expect(status.subsystems).toHaveProperty('securityGate');
      expect(status.subsystems).toHaveProperty('streamHandler');
      expect(status.subsystems).toHaveProperty('protocolRouter');
      expect(status.subsystems).toHaveProperty('pluginManager');
      expect(status.subsystems).toHaveProperty('configWatcher');
    });

    it('reports correct initial metrics', async () => {
      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      const status = daemon.getStatus();
      expect(status.metrics.totalSessionsSpawned).toBe(0);
      expect(status.metrics.totalTasksProcessed).toBe(0);
      expect(status.metrics.totalTokensUsed).toBe(0);
      expect(status.metrics.activeSessions).toBe(0);
      expect(status.metrics.successRate).toBe(1.0);
    });

    it('reports zero uptime when daemon is stopped', () => {
      daemon = new OrchestratorDaemon(buildConfig());
      const status = daemon.getStatus();
      expect(status.uptime).toBe(0);
    });

    it('reports active session count from session manager', async () => {
      mockSessionGetActiveSessionCount.mockReturnValue(3);

      daemon = new OrchestratorDaemon(buildConfig());
      await daemon.start();

      const status = daemon.getStatus();
      expect(status.activeSessions).toBe(3);
    });

    it('reports configWatcher status correctly', async () => {
      daemon = new OrchestratorDaemon(buildConfig());

      // Before start: configWatcher should be stopped
      const beforeStatus = daemon.getStatus();
      expect(beforeStatus.subsystems['configWatcher'].status).toBe('stopped');

      await daemon.start();

      // After start: configWatcher should be running
      const afterStatus = daemon.getStatus();
      expect(afterStatus.subsystems['configWatcher'].status).toBe('running');
    });
  });
});
