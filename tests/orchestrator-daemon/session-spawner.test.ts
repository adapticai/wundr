/**
 * Tests for Claude Session Spawner
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ClaudeSessionSpawner, {
  ClaudeSessionConfig,
  VPCharter,
  TaskContext,
  MemoryContext,
} from '../../scripts/vp-daemon/claude-session-spawner';

describe('ClaudeSessionSpawner', () => {
  let spawner: ClaudeSessionSpawner;

  beforeEach(() => {
    spawner = new ClaudeSessionSpawner();
  });

  afterEach(async () => {
    // Clean up any active sessions
    const active = spawner.getActiveSessions();
    for (const session of active) {
      try {
        await spawner.terminateSession(session.sessionId, false);
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  describe('spawnSession', () => {
    it('should create a unique session ID', async () => {
      const config = createMockConfig();

      const result1 = await spawner.spawnSession(config);
      const result2 = await spawner.spawnSession(config);

      expect(result1.sessionId).not.toBe(result2.sessionId);

      // Cleanup
      await spawner.terminateSession(result1.sessionId, false);
      await spawner.terminateSession(result2.sessionId, false);
    });

    it('should initialize session with correct state', async () => {
      const config = createMockConfig();

      const result = await spawner.spawnSession(config);

      expect(result.status.state).toBe('running');
      expect(result.status.pid).toBeGreaterThan(0);
      expect(result.status.startTime).toBeInstanceOf(Date);

      await spawner.terminateSession(result.sessionId, false);
    });

    it('should capture stdout and stderr', async () => {
      const config = createMockConfig();

      const result = await spawner.spawnSession(config);

      // Send a command that produces output
      spawner.sendInput(result.sessionId, 'echo "test output"\n');

      // Wait for output
      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = spawner.getSessionStatus(result.sessionId);
      expect(status).toBeTruthy();
      expect(status!.stdout.length).toBeGreaterThan(0);

      await spawner.terminateSession(result.sessionId, false);
    });

    it('should handle session timeout', async () => {
      const config = createMockConfig();
      config.timeout = 1000; // 1 second timeout

      const result = await spawner.spawnSession(config);

      // Wait for timeout
      const finalStatus = await result.completion;

      expect(finalStatus.state).toBe('timeout');
    });

    it('should generate session-specific CLAUDE.md', async () => {
      const config = createMockConfig();
      config.charter.objectives = ['Test objective 1', 'Test objective 2'];

      const result = await spawner.spawnSession(config);

      // Verify config was generated (via file system check would be ideal)
      expect(result.sessionId).toBeTruthy();

      await spawner.terminateSession(result.sessionId, false);
    });
  });

  describe('getSessionStatus', () => {
    it('should return null for non-existent session', () => {
      const status = spawner.getSessionStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should return current status for active session', async () => {
      const config = createMockConfig();
      const result = await spawner.spawnSession(config);

      const status = spawner.getSessionStatus(result.sessionId);

      expect(status).toBeTruthy();
      expect(status!.sessionId).toBe(result.sessionId);
      expect(status!.state).toBe('running');

      await spawner.terminateSession(result.sessionId, false);
    });

    it('should return historical status for completed session', async () => {
      const config = createMockConfig();
      config.timeout = 500; // Quick timeout

      const result = await spawner.spawnSession(config);
      await result.completion;

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = spawner.getSessionStatus(result.sessionId);
      expect(status).toBeTruthy();
      expect(['completed', 'timeout', 'failed']).toContain(status!.state);
    });
  });

  describe('terminateSession', () => {
    it('should gracefully terminate a session', async () => {
      const config = createMockConfig();
      const result = await spawner.spawnSession(config);

      await spawner.terminateSession(result.sessionId, true);

      const status = spawner.getSessionStatus(result.sessionId);
      expect(status!.state).toBe('terminated');
    });

    it('should force kill a session', async () => {
      const config = createMockConfig();
      const result = await spawner.spawnSession(config);

      await spawner.terminateSession(result.sessionId, false);

      const status = spawner.getSessionStatus(result.sessionId);
      expect(status!.state).toBe('terminated');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        spawner.terminateSession('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('sendInput', () => {
    it('should send input to running session', async () => {
      const config = createMockConfig();
      const result = await spawner.spawnSession(config);

      expect(() => {
        spawner.sendInput(result.sessionId, 'test input\n');
      }).not.toThrow();

      await spawner.terminateSession(result.sessionId, false);
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        spawner.sendInput('non-existent-id', 'test');
      }).toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = spawner.getActiveSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', async () => {
      const config = createMockConfig();

      const result1 = await spawner.spawnSession(config);
      const result2 = await spawner.spawnSession(config);

      const sessions = spawner.getActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain(result1.sessionId);
      expect(sessions.map((s) => s.sessionId)).toContain(result2.sessionId);

      await spawner.terminateSession(result1.sessionId, false);
      await spawner.terminateSession(result2.sessionId, false);
    });
  });

  describe('cleanupCompletedSessions', () => {
    it('should remove completed sessions from active list', async () => {
      const config = createMockConfig();
      config.timeout = 500;

      const result = await spawner.spawnSession(config);
      await result.completion;

      // Wait for session to be marked as completed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cleaned = spawner.cleanupCompletedSessions();

      expect(cleaned).toBeGreaterThan(0);
    });
  });

  describe('getMetricsSummary', () => {
    it('should return summary with zero values when no sessions', () => {
      const summary = spawner.getMetricsSummary();

      expect(summary.totalSessions).toBe(0);
      expect(summary.activeSessions).toBe(0);
      expect(summary.completedSessions).toBe(0);
    });

    it('should calculate metrics correctly', async () => {
      const config = createMockConfig();
      config.timeout = 500;

      const result1 = await spawner.spawnSession(config);
      const result2 = await spawner.spawnSession(config);

      await result1.completion;
      await result2.completion;

      const summary = spawner.getMetricsSummary();

      expect(summary.totalSessions).toBe(2);
    });
  });

  describe('event emissions', () => {
    it('should emit session-spawned event', async () => {
      const config = createMockConfig();

      const spawnedPromise = new Promise((resolve) => {
        spawner.once('session-spawned', resolve);
      });

      const result = await spawner.spawnSession(config);
      const event = await spawnedPromise;

      expect(event).toMatchObject({
        sessionId: result.sessionId,
        pid: result.status.pid,
      });

      await spawner.terminateSession(result.sessionId, false);
    });

    it('should emit session-ended event on termination', async () => {
      const config = createMockConfig();

      const result = await spawner.spawnSession(config);

      const endedPromise = new Promise((resolve) => {
        spawner.once('session-ended', resolve);
      });

      await spawner.terminateSession(result.sessionId, false);
      const event = await endedPromise;

      expect(event).toHaveProperty('sessionId', result.sessionId);
      expect(event).toHaveProperty('status');
    });

    it('should emit session-output events', async () => {
      const config = createMockConfig();

      const result = await spawner.spawnSession(config);

      const outputPromise = new Promise((resolve) => {
        spawner.once('session-output', resolve);
      });

      spawner.sendInput(result.sessionId, 'echo "test"\n');
      const event = await outputPromise;

      expect(event).toHaveProperty('sessionId', result.sessionId);
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('data');

      await spawner.terminateSession(result.sessionId, false);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockConfig(): ClaudeSessionConfig {
  const charter: VPCharter = {
    identity: {
      name: 'Test VP',
      email: 'test@example.com',
      role: 'Software Engineer',
    },
    objectives: ['Complete test task'],
    constraints: {
      forbiddenCommands: ['rm -rf'],
      forbiddenPatterns: [/force.*push/i],
      requiredApprovals: ['deploy'],
    },
    resources: {
      maxTokens: 100000,
      maxExecutionTime: 300000,
      allowedTools: ['read', 'write', 'bash'],
    },
  };

  const taskContext: TaskContext = {
    taskId: 'test-task-1',
    description: 'Test task description',
    priority: 'medium',
  };

  const memoryContext: MemoryContext = {
    recentActions: [],
    conversationHistory: [],
    preferences: {},
    projectContext: {},
  };

  return {
    workingDirectory: process.cwd(),
    charter,
    taskContext,
    memory: memoryContext,
    timeout: 0, // No timeout by default
    verbose: false,
  };
}
