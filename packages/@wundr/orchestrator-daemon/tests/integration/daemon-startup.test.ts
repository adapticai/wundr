/**
 * Integration test for daemon startup
 */

import { OrchestratorDaemon } from '../../src/core/orchestrator-daemon';
import type { DaemonConfig } from '../../src/types';

describe('Daemon Startup Integration', () => {
  let daemon: OrchestratorDaemon;

  const testConfig: DaemonConfig = {
    name: 'test-daemon',
    port: 18787, // Use different port for testing
    host: '127.0.0.1',
    maxSessions: 10,
    heartbeatInterval: 30000,
    shutdownTimeout: 5000,
    verbose: true,
    logLevel: 'debug',
  };

  beforeAll(() => {
    // Set test API key
    process.env.OPENAI_API_KEY = 'sk-test-key-not-real';
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
  });

  it('should create daemon instance without errors', () => {
    expect(() => {
      daemon = new OrchestratorDaemon(testConfig);
    }).not.toThrow();
  });

  it('should start daemon successfully', async () => {
    daemon = new OrchestratorDaemon(testConfig);

    await expect(daemon.start()).resolves.not.toThrow();

    const status = daemon.getStatus();
    expect(status.status).toBe('running');
    expect(status.activeSessions).toBe(0);
  }, 10000);

  it('should stop daemon gracefully', async () => {
    daemon = new OrchestratorDaemon(testConfig);
    await daemon.start();

    await expect(daemon.stop()).resolves.not.toThrow();

    const status = daemon.getStatus();
    expect(status.status).toBe('stopped');
  }, 10000);

  it('should spawn a session', async () => {
    daemon = new OrchestratorDaemon(testConfig);
    await daemon.start();

    const task = {
      id: 'test-task-1',
      type: 'analysis' as const,
      priority: 'high' as const,
      description: 'Analyze code quality',
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const session = await daemon.spawnSession('orchestrator-1', task);

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.orchestratorId).toBe('orchestrator-1');
    expect(session.task.id).toBe('test-task-1');

    const status = daemon.getStatus();
    expect(status.activeSessions).toBeGreaterThan(0);
  }, 15000);
});
