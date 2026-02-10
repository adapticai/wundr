/**
 * Tests for TeamCoordinator (src/teams/team-coordinator.ts).
 *
 * Covers:
 *  - Team creation and lifecycle
 *  - One-team-per-session enforcement
 *  - Backend detection (in-process, tmux, auto)
 *  - Teammate spawning and limits
 *  - Task assignment and tracking
 *  - Mailbox messaging between agents
 *  - Shared task lists
 *  - Delegate mode toggling
 *  - Team coordination events
 *  - Teammate shutdown and crash recovery
 *  - Force shutdown
 *  - Team cleanup
 *  - Health monitoring and heartbeats
 *  - Shared context
 *  - Progress reporting
 *  - Result aggregation
 *  - Metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  TeamCoordinator,
  TeamError,
  TeamErrorCode,
  type TeamSessionManager,
  type CreateTeamInput,
  type SpawnTeammateOptions,
  type TeamConfig,
  type TeamMember,
} from '../../../teams/team-coordinator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSessionManager(overrides?: Partial<TeamSessionManager>): TeamSessionManager {
  return {
    spawnSession: vi.fn().mockResolvedValue({ id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }),
    stopSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockReturnValue({ id: 'session_1', status: 'running' }),
    ...overrides,
  };
}

function defaultTeamInput(overrides?: Partial<CreateTeamInput>): CreateTeamInput {
  return {
    name: 'Test Team',
    teammateMode: 'in-process',
    maxTeammates: 5,
    ...overrides,
  };
}

function defaultSpawnOptions(overrides?: Partial<SpawnTeammateOptions>): SpawnTeammateOptions {
  return {
    name: 'Worker',
    role: 'developer',
    prompt: 'Implement feature X',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamCoordinator', () => {
  let sessionManager: TeamSessionManager;
  let coordinator: TeamCoordinator;

  beforeEach(() => {
    sessionManager = createMockSessionManager();
    coordinator = new TeamCoordinator(sessionManager);
  });

  afterEach(() => {
    coordinator.stopMonitoring();
  });

  // =========================================================================
  // Team Creation and Lifecycle
  // =========================================================================

  describe('createTeam', () => {
    it('should create a team with a unique ID', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(team.id).toMatch(/^team_/);
      expect(team.name).toBe('Test Team');
      expect(team.leadSessionId).toBe('lead-1');
      expect(team.status).toBe('active');
    });

    it('should register the lead as the first member', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(team.members).toHaveLength(1);
      expect(team.members[0].role).toBe('lead');
      expect(team.members[0].name).toBe('Lead');
      expect(team.members[0].sessionId).toBe('lead-1');
      expect(team.members[0].status).toBe('active');
    });

    it('should resolve in-process backend when mode is "in-process"', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput({ teammateMode: 'in-process' }));

      expect(team.resolvedBackend).toBe('in-process');
    });

    it('should default to auto mode when teammateMode is not specified', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput({ teammateMode: undefined }));

      // 'auto' resolves to 'in-process' outside tmux
      expect(['in-process', 'tmux']).toContain(team.resolvedBackend);
    });

    it('should use delegate mode from input when specified', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput({ delegateMode: true }));

      expect(team.delegateMode).toBe(true);
    });

    it('should default to non-delegate mode', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(team.delegateMode).toBe(false);
    });

    it('should store metadata on the team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput({
        metadata: { purpose: 'testing' },
      }));

      expect(team.metadata).toEqual({ purpose: 'testing' });
    });

    it('should emit team:created and team:active events', () => {
      const createdHandler = vi.fn();
      const activeHandler = vi.fn();
      coordinator.on('team:created', createdHandler);
      coordinator.on('team:active', activeHandler);

      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(createdHandler).toHaveBeenCalledWith(team);
      expect(activeHandler).toHaveBeenCalledWith(team);
    });

    it('should initialize a shared task list for the team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      const taskList = coordinator.getTaskList(team.id);
      expect(taskList).toBeDefined();
    });

    it('should initialize a mailbox for the team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      const mailbox = coordinator.getMailbox(team.id);
      expect(mailbox).toBeDefined();
    });

    it('should initialize a task assigner for the team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      const assigner = coordinator.getAssigner(team.id);
      expect(assigner).toBeDefined();
    });

    it('should initialize a dependency tracker for the team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      const tracker = coordinator.getDependencyTracker(team.id);
      expect(tracker).toBeDefined();
    });
  });

  // =========================================================================
  // One Team Per Session
  // =========================================================================

  describe('one-team-per-session', () => {
    it('should throw when creating a second team for the same lead session', () => {
      coordinator.createTeam('lead-1', defaultTeamInput());

      expect(() => {
        coordinator.createTeam('lead-1', defaultTeamInput({ name: 'Second Team' }));
      }).toThrow(TeamError);
    });

    it('should include error code ONE_TEAM_PER_SESSION', () => {
      coordinator.createTeam('lead-1', defaultTeamInput());

      try {
        coordinator.createTeam('lead-1', defaultTeamInput());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TeamError);
        expect((err as TeamError).code).toBe(TeamErrorCode.ONE_TEAM_PER_SESSION);
      }
    });

    it('should allow different sessions to each create a team', () => {
      const team1 = coordinator.createTeam('lead-1', defaultTeamInput());
      const team2 = coordinator.createTeam('lead-2', defaultTeamInput({ name: 'Team 2' }));

      expect(team1.id).not.toBe(team2.id);
    });
  });

  // =========================================================================
  // Teammate Spawning
  // =========================================================================

  describe('spawnTeammate', () => {
    let team: TeamConfig;

    beforeEach(() => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
    });

    it('should spawn a teammate and add it to the team', async () => {
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(member.name).toBe('Worker');
      expect(member.role).toBe('developer');
      expect(member.status).toBe('active');
      expect(member.agentType).toBe('teammate');
    });

    it('should call sessionManager.spawnSession', async () => {
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(sessionManager.spawnSession).toHaveBeenCalled();
    });

    it('should emit teammate:spawned and teammate:active events', async () => {
      const spawnedHandler = vi.fn();
      const activeHandler = vi.fn();
      coordinator.on('teammate:spawned', spawnedHandler);
      coordinator.on('teammate:active', activeHandler);

      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(spawnedHandler).toHaveBeenCalledWith(team.id, member);
      expect(activeHandler).toHaveBeenCalledWith(team.id, member.id);
    });

    it('should register the teammate in the mailbox', async () => {
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const mailbox = coordinator.getMailbox(team.id)!;
      expect(mailbox.hasMember(member.id)).toBe(true);
    });

    it('should respect maxTeammates limit', async () => {
      const smallTeam = coordinator.createTeam('lead-2', defaultTeamInput({
        name: 'Small Team',
        maxTeammates: 1,
      }));

      await coordinator.spawnTeammate(smallTeam.id, defaultSpawnOptions({ name: 'Worker 1' }));

      await expect(
        coordinator.spawnTeammate(smallTeam.id, defaultSpawnOptions({ name: 'Worker 2' })),
      ).rejects.toThrow(TeamError);
    });

    it('should throw MAX_TEAMMATES_REACHED when limit exceeded', async () => {
      const smallTeam = coordinator.createTeam('lead-2', defaultTeamInput({
        name: 'Small Team',
        maxTeammates: 1,
      }));

      await coordinator.spawnTeammate(smallTeam.id, defaultSpawnOptions());

      try {
        await coordinator.spawnTeammate(smallTeam.id, defaultSpawnOptions({ name: 'Extra' }));
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as TeamError).code).toBe(TeamErrorCode.MAX_TEAMMATES_REACHED);
      }
    });

    it('should throw TEAM_NOT_FOUND for nonexistent team', async () => {
      await expect(
        coordinator.spawnTeammate('nonexistent', defaultSpawnOptions()),
      ).rejects.toThrow(TeamError);
    });

    it('should throw TEAM_NOT_ACTIVE when team is not active', async () => {
      // Force shutdown to change status
      await coordinator.forceShutdownTeam(team.id);

      await expect(
        coordinator.spawnTeammate(team.id, defaultSpawnOptions()),
      ).rejects.toThrow(TeamError);
    });

    it('should wrap SESSION_SPAWN_FAILED when session manager throws', async () => {
      const failingManager = createMockSessionManager({
        spawnSession: vi.fn().mockRejectedValue(new Error('spawn failed')),
      });
      const coord = new TeamCoordinator(failingManager);
      const t = coord.createTeam('lead-1', defaultTeamInput());

      try {
        await coord.spawnTeammate(t.id, defaultSpawnOptions());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as TeamError).code).toBe(TeamErrorCode.SESSION_SPAWN_FAILED);
      }
    });

    it('should register capabilities when provided', async () => {
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions({
        capabilities: ['typescript', 'testing'],
        maxConcurrentTasks: 5,
      }));

      const assigner = coordinator.getAssigner(team.id)!;
      const caps = assigner.getCapabilities(member.id);
      expect(caps).toBeDefined();
      expect(caps!.capabilities).toEqual(['typescript', 'testing']);
      expect(caps!.maxConcurrent).toBe(5);
    });

    it('should assign model from options', async () => {
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions({
        model: 'claude-3-opus',
      }));

      expect(member.model).toBe('claude-3-opus');
    });

    it('should default model to null', async () => {
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(member.model).toBeNull();
    });
  });

  // =========================================================================
  // Task Coordination
  // =========================================================================

  describe('task coordination', () => {
    let team: TeamConfig;

    beforeEach(() => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
    });

    it('should create tasks via the coordinator', () => {
      const task = coordinator.createTask(team.id, 'lead', {
        title: 'Implement feature',
        description: 'Build the thing',
      });

      expect(task.title).toBe('Implement feature');
      expect(task.status).toBe('pending');
    });

    it('should throw for tasks on nonexistent teams', () => {
      expect(() => {
        coordinator.createTask('nonexistent', 'lead', {
          title: 'Task',
          description: 'desc',
        });
      }).toThrow(TeamError);
    });

    it('should allow claiming and completing tasks through the shared task list', async () => {
      const task = coordinator.createTask(team.id, 'lead', {
        title: 'Test task',
        description: 'testing',
      });

      const taskList = coordinator.getTaskList(team.id)!;
      await taskList.claimTask(task.id, 'member_2');
      await taskList.completeTask(task.id, 'member_2');

      const completed = taskList.getTask(task.id);
      expect(completed!.status).toBe('completed');
    });

    it('should report task stats correctly', () => {
      coordinator.createTask(team.id, 'lead', { title: 'T1', description: 'D1' });
      coordinator.createTask(team.id, 'lead', { title: 'T2', description: 'D2' });

      const taskList = coordinator.getTaskList(team.id)!;
      const stats = taskList.getStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.completed).toBe(0);
    });
  });

  // =========================================================================
  // Mailbox Messaging
  // =========================================================================

  describe('mailbox messaging', () => {
    let team: TeamConfig;
    let member: TeamMember;

    beforeEach(async () => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
      member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());
    });

    it('should allow the lead to send a message to a teammate', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      const message = mailbox.send(leadId, {
        toId: member.id,
        content: 'Hello teammate',
      });

      expect(message.content).toBe('Hello teammate');
      expect(message.fromId).toBe(leadId);
      expect(message.toId).toBe(member.id);
    });

    it('should allow a teammate to send a message to the lead', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      const message = mailbox.send(member.id, {
        toId: leadId,
        content: 'Task complete',
      });

      expect(message.fromId).toBe(member.id);
      expect(message.toId).toBe(leadId);
    });

    it('should allow broadcasting from the lead', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      const messages = mailbox.broadcast(leadId, 'Attention everyone');

      expect(messages.length).toBeGreaterThan(0);
    });

    it('should track unread messages', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      mailbox.send(leadId, {
        toId: member.id,
        content: 'Message 1',
      });
      mailbox.send(leadId, {
        toId: member.id,
        content: 'Message 2',
      });

      expect(mailbox.getUnreadCount(member.id)).toBe(2);
    });

    it('should mark messages as read', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      const msg = mailbox.send(leadId, {
        toId: member.id,
        content: 'Read me',
      });

      mailbox.markRead(msg.id, member.id);

      expect(mailbox.getUnreadCount(member.id)).toBe(0);
    });

    it('should provide inbox for a member', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const leadId = team.members[0].id;

      mailbox.send(leadId, {
        toId: member.id,
        content: 'Inbox test',
      });

      const inbox = mailbox.getInbox(member.id);
      expect(inbox).toHaveLength(1); // 1 direct message (joined notification is sent to others, not the joiner)
    });

    it('should provide mailbox stats', () => {
      const mailbox = coordinator.getMailbox(team.id)!;
      const stats = mailbox.getStats();

      expect(stats.memberCount).toBeGreaterThanOrEqual(2);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Delegate Mode
  // =========================================================================

  describe('delegate mode', () => {
    it('should toggle delegate mode', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      coordinator.setDelegateMode(team.id, true);
      expect(team.delegateMode).toBe(true);

      coordinator.setDelegateMode(team.id, false);
      expect(team.delegateMode).toBe(false);
    });

    it('should emit delegate-mode:changed event', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const handler = vi.fn();
      coordinator.on('delegate-mode:changed', handler);

      coordinator.setDelegateMode(team.id, true);

      expect(handler).toHaveBeenCalledWith(team.id, true);
    });

    it('should throw for nonexistent team', () => {
      expect(() => {
        coordinator.setDelegateMode('nonexistent', true);
      }).toThrow(TeamError);
    });
  });

  // =========================================================================
  // Teammate Shutdown
  // =========================================================================

  describe('requestShutdown', () => {
    let team: TeamConfig;
    let member: TeamMember;

    beforeEach(async () => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
      member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());
    });

    it('should stop a teammate', async () => {
      const result = await coordinator.requestShutdown(team.id, member.id);

      expect(result).toBe(true);
      expect(member.status).toBe('stopped');
    });

    it('should emit teammate:stopped event', async () => {
      const handler = vi.fn();
      coordinator.on('teammate:stopped', handler);

      await coordinator.requestShutdown(team.id, member.id);

      expect(handler).toHaveBeenCalledWith(team.id, member.id);
    });

    it('should emit teammate:shutdown-requested event', async () => {
      const handler = vi.fn();
      coordinator.on('teammate:shutdown-requested', handler);

      await coordinator.requestShutdown(team.id, member.id);

      expect(handler).toHaveBeenCalledWith(team.id, member.id);
    });

    it('should call sessionManager.stopSession', async () => {
      await coordinator.requestShutdown(team.id, member.id);

      expect(sessionManager.stopSession).toHaveBeenCalledWith(member.sessionId);
    });

    it('should release in-progress tasks when shutting down', async () => {
      const task = coordinator.createTask(team.id, 'lead', {
        title: 'Task for shutdown',
        description: 'test',
      });
      const taskList = coordinator.getTaskList(team.id)!;
      await taskList.claimTask(task.id, member.id);

      await coordinator.requestShutdown(team.id, member.id);

      const updatedTask = taskList.getTask(task.id);
      expect(updatedTask!.status).toBe('pending');
    });

    it('should return true if member is already stopped', async () => {
      await coordinator.requestShutdown(team.id, member.id);
      const result = await coordinator.requestShutdown(team.id, member.id);

      expect(result).toBe(true);
    });

    it('should throw when trying to shut down the lead', async () => {
      const leadId = team.members[0].id;

      await expect(
        coordinator.requestShutdown(team.id, leadId),
      ).rejects.toThrow(TeamError);
    });
  });

  // =========================================================================
  // Team Cleanup
  // =========================================================================

  describe('cleanupTeam', () => {
    it('should clean up a team after all members stopped', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      await coordinator.requestShutdown(team.id, member.id);
      coordinator.cleanupTeam(team.id);

      expect(coordinator.getTeam(team.id)).toBeUndefined();
    });

    it('should emit team:shutting-down and team:cleaned-up events', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const shuttingDownHandler = vi.fn();
      const cleanedUpHandler = vi.fn();
      coordinator.on('team:shutting-down', shuttingDownHandler);
      coordinator.on('team:cleaned-up', cleanedUpHandler);

      coordinator.cleanupTeam(team.id);

      expect(shuttingDownHandler).toHaveBeenCalledWith(team.id);
      expect(cleanedUpHandler).toHaveBeenCalledWith(team.id);
    });

    it('should throw if active teammates remain', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(() => {
        coordinator.cleanupTeam(team.id);
      }).toThrow(TeamError);
    });

    it('should include TEAM_HAS_ACTIVE_MEMBERS error code', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      try {
        coordinator.cleanupTeam(team.id);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as TeamError).code).toBe(TeamErrorCode.TEAM_HAS_ACTIVE_MEMBERS);
      }
    });

    it('should remove task list, mailbox, assigner, and dependency tracker', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      coordinator.cleanupTeam(team.id);

      expect(coordinator.getTaskList(team.id)).toBeUndefined();
      expect(coordinator.getMailbox(team.id)).toBeUndefined();
      expect(coordinator.getAssigner(team.id)).toBeUndefined();
      expect(coordinator.getDependencyTracker(team.id)).toBeUndefined();
    });
  });

  // =========================================================================
  // Force Shutdown
  // =========================================================================

  describe('forceShutdownTeam', () => {
    it('should stop all members and clean up', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W1' }));
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W2' }));

      await coordinator.forceShutdownTeam(team.id);

      expect(coordinator.getTeam(team.id)).toBeUndefined();
    });

    it('should call stopSession for each teammate', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W1' }));
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W2' }));

      await coordinator.forceShutdownTeam(team.id);

      // 2 teammates spawned = 2 stop calls
      expect(sessionManager.stopSession).toHaveBeenCalledTimes(2);
    });

    it('should emit teammate:stopped for each teammate', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W1' }));
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W2' }));

      const handler = vi.fn();
      coordinator.on('teammate:stopped', handler);

      await coordinator.forceShutdownTeam(team.id);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Crash Recovery
  // =========================================================================

  describe('handleTeammateCrash', () => {
    it('should mark crashed teammate as stopped', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      await coordinator.handleTeammateCrash(member.sessionId);

      expect(member.status).toBe('stopped');
    });

    it('should release in-progress tasks', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const task = coordinator.createTask(team.id, 'lead', {
        title: 'Crash test task',
        description: 'testing crash',
      });
      const taskList = coordinator.getTaskList(team.id)!;
      await taskList.claimTask(task.id, member.id);

      await coordinator.handleTeammateCrash(member.sessionId);

      const updatedTask = taskList.getTask(task.id);
      expect(updatedTask!.status).toBe('pending');
    });

    it('should emit teammate:crash-recovered with released task IDs', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const task = coordinator.createTask(team.id, 'lead', {
        title: 'Crash test',
        description: 'test',
      });
      const taskList = coordinator.getTaskList(team.id)!;
      await taskList.claimTask(task.id, member.id);

      const handler = vi.fn();
      coordinator.on('teammate:crash-recovered', handler);

      await coordinator.handleTeammateCrash(member.sessionId);

      expect(handler).toHaveBeenCalledWith(team.id, member.id, [task.id]);
    });

    it('should be a no-op for unknown session IDs', async () => {
      await coordinator.handleTeammateCrash('unknown-session');
      // No error thrown
    });
  });

  // =========================================================================
  // Health Monitoring
  // =========================================================================

  describe('health monitoring', () => {
    it('should start and stop monitoring without error', () => {
      coordinator.startMonitoring();
      coordinator.stopMonitoring();
    });

    it('should not start duplicate monitors', () => {
      coordinator.startMonitoring();
      coordinator.startMonitoring(); // Should not throw
      coordinator.stopMonitoring();
    });

    it('should record heartbeats', () => {
      // Should not throw
      coordinator.recordHeartbeat('session_1');
    });

    it('should emit monitor:heartbeat during health check', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const handler = vi.fn();
      coordinator.on('monitor:heartbeat', handler);

      coordinator.runHealthCheck();

      expect(handler).toHaveBeenCalledWith(team.id, expect.any(Number), expect.any(Number));
    });

    it('should detect stale teammates', async () => {
      const coord = new TeamCoordinator(sessionManager, {
        staleThresholdMs: 1, // Immediate staleness
      });

      const team = coord.createTeam('lead-1', defaultTeamInput());
      const member = await coord.spawnTeammate(team.id, defaultSpawnOptions());

      // Wait a tick so the heartbeat goes stale
      await new Promise(r => setTimeout(r, 10));

      const staleHandler = vi.fn();
      coord.on('monitor:stale-detected', staleHandler);

      coord.runHealthCheck();

      expect(staleHandler).toHaveBeenCalledWith(team.id, member.id);
      coord.stopMonitoring();
    });

    it('should handle teammate crash during health check', async () => {
      const crashManager = createMockSessionManager({
        getSession: vi.fn().mockReturnValue({ id: 'session_1', status: 'failed' }),
      });
      const coord = new TeamCoordinator(crashManager);
      const team = coord.createTeam('lead-1', defaultTeamInput());
      await coord.spawnTeammate(team.id, defaultSpawnOptions());

      const handler = vi.fn();
      coord.on('teammate:stopped', handler);

      coord.runHealthCheck();

      // Wait for async crash handling
      await new Promise(r => setTimeout(r, 50));

      expect(handler).toHaveBeenCalled();
      coord.stopMonitoring();
    });
  });

  // =========================================================================
  // Shared Context
  // =========================================================================

  describe('shared context', () => {
    let team: TeamConfig;

    beforeEach(() => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
    });

    it('should set and get shared context values', () => {
      coordinator.setSharedContext(team.id, 'key1', 'value1', 'lead');

      const value = coordinator.getSharedContext(team.id, 'key1');
      expect(value).toBe('value1');
    });

    it('should get all shared context', () => {
      coordinator.setSharedContext(team.id, 'k1', 'v1', 'lead');
      coordinator.setSharedContext(team.id, 'k2', 42, 'lead');

      const all = coordinator.getAllSharedContext(team.id);
      expect(all).toEqual({ k1: 'v1', k2: 42 });
    });

    it('should return undefined for missing keys', () => {
      const value = coordinator.getSharedContext(team.id, 'missing');
      expect(value).toBeUndefined();
    });
  });

  // =========================================================================
  // Progress Reporting
  // =========================================================================

  describe('progress reporting', () => {
    it('should return progress for a team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      coordinator.createTask(team.id, 'lead', { title: 'T1', description: 'D1' });

      const progress = coordinator.getTeamProgress(team.id);

      expect(progress).toBeDefined();
      expect(progress!.teamId).toBe(team.id);
      expect(progress!.totalTasks).toBe(1);
      expect(progress!.completedTasks).toBe(0);
    });

    it('should emit progress:updated event', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const handler = vi.fn();
      coordinator.on('progress:updated', handler);

      coordinator.getTeamProgress(team.id);

      expect(handler).toHaveBeenCalled();
    });

    it('should return undefined for nonexistent team', () => {
      const progress = coordinator.getTeamProgress('nonexistent');
      expect(progress).toBeUndefined();
    });
  });

  // =========================================================================
  // Result Aggregation
  // =========================================================================

  describe('result aggregation', () => {
    it('should aggregate results for a team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      const result = coordinator.aggregateResults(team.id);

      expect(result).toBeDefined();
      expect(result!.teamId).toBe(team.id);
      expect(result!.teamName).toBe('Test Team');
    });

    it('should return undefined for nonexistent team', () => {
      const result = coordinator.aggregateResults('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Queries
  // =========================================================================

  describe('queries', () => {
    it('should get team by ID', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(coordinator.getTeam(team.id)).toBe(team);
    });

    it('should return undefined for unknown team ID', () => {
      expect(coordinator.getTeam('nonexistent')).toBeUndefined();
    });

    it('should get team for lead session', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(coordinator.getTeamForSession('lead-1')).toBe(team);
    });

    it('should get team for teammate session', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(coordinator.getTeamForSession(member.sessionId)).toBe(team);
    });

    it('should return undefined for unknown session', () => {
      expect(coordinator.getTeamForSession('unknown')).toBeUndefined();
    });

    it('should get active teams', () => {
      coordinator.createTeam('lead-1', defaultTeamInput());
      coordinator.createTeam('lead-2', defaultTeamInput({ name: 'Team 2' }));

      expect(coordinator.getActiveTeams()).toHaveLength(2);
    });

    it('should get a member by ID', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      expect(coordinator.getMember(team.id, member.id)).toBe(member);
    });

    it('should return undefined for unknown member', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      expect(coordinator.getMember(team.id, 'unknown')).toBeUndefined();
    });

    it('should get active teammates (excluding lead)', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W1' }));
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions({ name: 'W2' }));

      const active = coordinator.getActiveTeammates(team.id);
      expect(active).toHaveLength(2);
      expect(active.every(m => m.role !== 'lead')).toBe(true);
    });

    it('should return comprehensive team status', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const status = coordinator.getTeamStatus(team.id);
      expect(status).toBeDefined();
      expect(status!.team).toBe(team);
      expect(status!.taskStats).toBeDefined();
      expect(status!.mailboxStats).toBeDefined();
      expect(status!.settings).toBeDefined();
    });

    it('should return undefined status for unknown team', () => {
      expect(coordinator.getTeamStatus('nonexistent')).toBeUndefined();
    });
  });

  // =========================================================================
  // Metrics
  // =========================================================================

  describe('metrics', () => {
    it('should track team and teammate counts', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const metrics = coordinator.getMetrics();
      expect(metrics.totalTeams).toBe(1);
      expect(metrics.activeTeams).toBe(1);
      expect(metrics.totalTeammates).toBe(1);
      expect(metrics.activeTeammates).toBe(1);
    });

    it('should report zero metrics when no teams exist', () => {
      const metrics = coordinator.getMetrics();

      expect(metrics.totalTeams).toBe(0);
      expect(metrics.activeTeams).toBe(0);
      expect(metrics.totalTeammates).toBe(0);
    });
  });

  // =========================================================================
  // Backend Detection
  // =========================================================================

  describe('detectBackend', () => {
    it('should return in-process for in-process mode', () => {
      expect(coordinator.detectBackend('in-process')).toBe('in-process');
    });

    it('should resolve auto mode based on environment', () => {
      // Outside tmux, auto should return in-process
      const backend = coordinator.detectBackend('auto');
      expect(['in-process', 'tmux']).toContain(backend);
    });
  });

  // =========================================================================
  // Dependency Tracking
  // =========================================================================

  describe('dependency tracking', () => {
    let team: TeamConfig;

    beforeEach(() => {
      team = coordinator.createTeam('lead-1', defaultTeamInput());
    });

    it('should add task dependencies', () => {
      coordinator.addTaskDependency(team.id, 'task-B', 'task-A');

      const tracker = coordinator.getDependencyTracker(team.id)!;
      const info = tracker.getDependencyInfo('task-B');
      expect(info.blockedBy).toContain('task-A');
    });

    it('should detect deadlocks', () => {
      const tracker = coordinator.getDependencyTracker(team.id)!;
      tracker.registerTask('A');
      tracker.registerTask('B');
      tracker.addDependency('A', 'B');

      // Trying to add B -> A should throw (cycle)
      expect(() => tracker.addDependency('B', 'A')).toThrow();
    });

    it('should return false for detectDeadlocks with no cycles', () => {
      coordinator.addTaskDependency(team.id, 'B', 'A');

      expect(coordinator.detectDeadlocks(team.id)).toBe(false);
    });

    it('should throw for dependency on nonexistent team', () => {
      expect(() => {
        coordinator.addTaskDependency('nonexistent', 'A', 'B');
      }).toThrow(TeamError);
    });
  });

  // =========================================================================
  // Assignment Strategy
  // =========================================================================

  describe('assignment strategy', () => {
    it('should set the assignment strategy', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      coordinator.setAssignmentStrategy(team.id, 'round-robin');

      const assigner = coordinator.getAssigner(team.id)!;
      expect(assigner.getStrategy()).toBe('round-robin');
    });

    it('should throw for unknown team', () => {
      expect(() => {
        coordinator.setAssignmentStrategy('nonexistent', 'round-robin');
      }).toThrow(TeamError);
    });

    it('should register member capabilities', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      coordinator.registerMemberCapabilities(team.id, {
        memberId: member.id,
        capabilities: ['backend', 'frontend'],
        maxConcurrent: 4,
      });

      const assigner = coordinator.getAssigner(team.id)!;
      const caps = assigner.getCapabilities(member.id);
      expect(caps!.capabilities).toEqual(['backend', 'frontend']);
    });
  });

  // =========================================================================
  // Hooks
  // =========================================================================

  describe('hooks', () => {
    it('should register a hook for a team', () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());

      coordinator.registerHook(team.id, {
        type: 'TaskCompleted',
        mode: 'function',
        handler: async () => ({ exitCode: 0 as const }),
        timeout: 5000,
        enabled: true,
      });

      const hooks = coordinator.getHooks();
      expect(hooks.hasHook(team.id, 'TaskCompleted')).toBe(true);
    });

    it('should throw when registering hook for nonexistent team', () => {
      expect(() => {
        coordinator.registerHook('nonexistent', {
          type: 'TaskCompleted',
          mode: 'function',
          timeout: 5000,
          enabled: true,
        });
      }).toThrow(TeamError);
    });
  });

  // =========================================================================
  // Auto-Assignment
  // =========================================================================

  describe('autoAssignPendingTasks', () => {
    it('should auto-assign pending tasks to available teammates', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      coordinator.createTask(team.id, 'lead', { title: 'Task 1', description: 'D1' });

      const handler = vi.fn();
      coordinator.on('task:auto-assigned', handler);

      const assigned = await coordinator.autoAssignPendingTasks(team.id);

      expect(assigned).toHaveLength(1);
      expect(handler).toHaveBeenCalled();
    });

    it('should return empty array when no pending tasks', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const assigned = await coordinator.autoAssignPendingTasks(team.id);
      expect(assigned).toHaveLength(0);
    });

    it('should return empty array when no teammates available', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      coordinator.createTask(team.id, 'lead', { title: 'Task', description: 'D' });

      const assigned = await coordinator.autoAssignPendingTasks(team.id);
      expect(assigned).toHaveLength(0);
    });
  });

  // =========================================================================
  // Work Redistribution
  // =========================================================================

  describe('redistributeWorkToIdle', () => {
    it('should assign pending tasks to an idle teammate', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      coordinator.createTask(team.id, 'lead', { title: 'T1', description: 'D1' });

      const handler = vi.fn();
      coordinator.on('teammate:work-redistributed', handler);

      const assigned = await coordinator.redistributeWorkToIdle(team.id, member.id);

      expect(assigned.length).toBeGreaterThan(0);
      expect(handler).toHaveBeenCalled();
    });

    it('should return empty when no pending tasks', async () => {
      const team = coordinator.createTeam('lead-1', defaultTeamInput());
      const member = await coordinator.spawnTeammate(team.id, defaultSpawnOptions());

      const assigned = await coordinator.redistributeWorkToIdle(team.id, member.id);
      expect(assigned).toHaveLength(0);
    });
  });
});
