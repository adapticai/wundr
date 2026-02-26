/**
 * Orchestrator Daemon unit tests
 */

import { OrchestratorDaemon } from '../src/core/orchestrator-daemon';
import { DaemonConfig } from '../src/types';

describe('OrchestratorDaemon', () => {
  let daemon: OrchestratorDaemon;

  const testConfig: DaemonConfig = {
    name: 'test-daemon',
    port: 9999,
    host: '127.0.0.1',
    maxSessions: 10,
    heartbeatInterval: 5000,
    shutdownTimeout: 1000,
    verbose: false,
  };

  beforeEach(() => {
    daemon = new OrchestratorDaemon(testConfig);
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop().catch(() => {});
    }
  });

  describe('constructor', () => {
    it('should create a daemon instance with valid config', () => {
      expect(daemon).toBeDefined();
    });

    it('should throw error with invalid config', () => {
      expect(() => {
        new OrchestratorDaemon({ port: -1 } as DaemonConfig);
      }).toThrow();
    });
  });

  describe('start/stop', () => {
    it('should start and stop daemon successfully', async () => {
      await daemon.start();
      const status = daemon.getStatus();
      expect(status.status).toBe('running');

      await daemon.stop();
      const stoppedStatus = daemon.getStatus();
      expect(stoppedStatus.status).toBe('stopped');
    }, 10000);

    it('should emit started event when daemon starts', async () => {
      const startedPromise = new Promise<void>(resolve => {
        daemon.once('started', () => resolve());
      });

      await daemon.start();
      await startedPromise;

      expect(daemon.getStatus().status).toBe('running');
    }, 10000);

    it('should emit stopped event when daemon stops', async () => {
      await daemon.start();

      const stoppedPromise = new Promise<void>(resolve => {
        daemon.once('stopped', () => resolve());
      });

      await daemon.stop();
      await stoppedPromise;
    }, 10000);
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const status = daemon.getStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('activeSessions');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('subsystems');
    });

    it('should track uptime after starting', async () => {
      await daemon.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = daemon.getStatus();
      expect(status.uptime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('spawnSession', () => {
    it('should spawn a session successfully', async () => {
      await daemon.start();

      const task = {
        id: 'task-1',
        type: 'code' as const,
        description: 'Test task',
        priority: 'medium' as const,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const session = await daemon.spawnSession('orchestrator-1', task);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.orchestratorId).toBe('orchestrator-1');
      expect(session.task).toEqual(task);
    }, 10000);

    it('should track active sessions', async () => {
      await daemon.start();

      const task = {
        id: 'task-1',
        type: 'code' as const,
        description: 'Test task',
        priority: 'medium' as const,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await daemon.spawnSession('orchestrator-1', task);

      const status = daemon.getStatus();
      expect(status.activeSessions).toBeGreaterThan(0);
    }, 10000);
  });
});
